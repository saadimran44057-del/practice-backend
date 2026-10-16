import { Op } from 'sequelize';
import bcrypt from 'bcryptjs';
import { sequelize } from '../config/connection.js';
import { User, Product, Role } from '../models/index.js';
import { isAdminRole, permissionsForRole } from '../config/permissions.js';
import { handleError } from '../utils/handleError.js';
import { deleteImage } from '../config/cloudinary.js';

// Read page and limit from the URL
const getPaging = (query) => {
  const page = Math.max(parseInt(query.page) || 1, 1);
  const limit = Math.min(Math.max(parseInt(query.limit) || 10, 1), 50);
  return { page, limit, offset: (page - 1) * limit };
};

const buildPagination = (count, page, limit) => ({
  total: count,
  page,
  limit,
  totalPages: Math.max(Math.ceil(count / limit), 1),
});

// status=active or status=blocked from the URL
const statusWhere = (status) => {
  if (status === 'blocked') return { isBlocked: true };
  if (status === 'active') return { isBlocked: false };
  return {};
};

// Can the logged-in person manage this user (block, change role, delete)?
// - Nobody can manage themselves or an admin
// - Only an admin can manage staff (anyone whose role has permissions)
const checkCanManage = (req, target) => {
  if (target.id === req.user.id) return "You can't do this to your own account";
  if (isAdminRole(target.Role)) return "Admin accounts can't be changed here";
  if (!req.user.isAdmin && permissionsForRole(target.Role).length > 0) {
    return 'Only an admin can manage staff accounts';
  }
  return null;
};

// A non-admin can't hand out a role with more power than their own
const canGiveRole = (req, role) => {
  if (req.user.isAdmin) return true;
  if (isAdminRole(role)) return false;
  return permissionsForRole(role).every((p) => req.user.permissions.includes(p));
};

// GET /api/admin/stats
export const getStats = async (req, res) => {
  try {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [totalUsers, newUsersThisWeek, blockedUsers, totalProducts, blockedProducts] =
      await Promise.all([
        User.count(),
        User.count({ where: { createdAt: { [Op.gte]: weekAgo } } }),
        User.count({ where: { isBlocked: true } }),
        Product.count(),
        Product.count({ where: { isBlocked: true } }),
      ]);

    res.status(200).json({
      status: true,
      data: { totalUsers, newUsersThisWeek, blockedUsers, totalProducts, blockedProducts },
    });
  } catch (error) {
    handleError(res, error);
  }
};

// GET /api/admin/users?search=&status=&roleId=&page=
export const getUsers = async (req, res) => {
  try {
    const { page, limit, offset } = getPaging(req.query);
    const search = (req.query.search || '').trim();

    const where = { ...statusWhere(req.query.status) };
    if (req.query.roleId) {
      where.roleId = Number(req.query.roleId);
    }
    if (search) {
      where[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { email: { [Op.iLike]: `%${search}%` } },
      ];
    }

    const { count, rows } = await User.findAndCountAll({
      where,
      attributes: ['id', 'name', 'email', 'avatar', 'isBlocked', 'roleId', 'createdAt'],
      include: [{ model: Role, attributes: ['id', 'name', 'isSystem'] }],
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });

    // How many products each of these users has
    const ids = rows.map((u) => u.id);
    const counts = ids.length
      ? await Product.findAll({
          attributes: ['userId', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
          where: { userId: ids },
          group: ['userId'],
          raw: true,
        })
      : [];

    const countMap = {};
    counts.forEach((c) => {
      countMap[c.userId] = Number(c.count);
    });

    const data = rows.map((u) => ({ ...u.toJSON(), productCount: countMap[u.id] || 0 }));

    res.status(200).json({ status: true, data, pagination: buildPagination(count, page, limit) });
  } catch (error) {
    handleError(res, error);
  }
};

// GET /api/admin/products?search=&status=&page=
export const getProducts = async (req, res) => {
  try {
    const { page, limit, offset } = getPaging(req.query);
    const search = (req.query.search || '').trim();

    const where = { ...statusWhere(req.query.status) };
    if (search) {
      where.name = { [Op.iLike]: `%${search}%` };
    }

    const { count, rows } = await Product.findAndCountAll({
      where,
      include: [{ model: User, attributes: ['id', 'name', 'email'] }],
      order: [['createdAt', 'DESC']],
      limit,
      offset,
      distinct: true,
    });

    res.status(200).json({ status: true, data: rows, pagination: buildPagination(count, page, limit) });
  } catch (error) {
    handleError(res, error);
  }
};

// POST /api/admin/users   body: { name, email, password, roleId }
export const createUser = async (req, res) => {
  try {
    const { name, email, password, roleId } = req.body;

    if (!password || String(password).length < 6) {
      return res.status(400).json({ status: false, message: 'Password must be at least 6 characters' });
    }

    // No role chosen = normal user
    const role = roleId
      ? await Role.findByPk(roleId)
      : await Role.findOne({ where: { name: 'user' } });

    if (!role) {
      return res.status(400).json({ status: false, message: 'Choose a valid role' });
    }
    if (!canGiveRole(req, role)) {
      return res.status(403).json({ status: false, message: "You can't give a role with more access than yours" });
    }

    const user = await User.create({
      name: typeof name === 'string' ? name.trim() : name,
      email: typeof email === 'string' ? email.trim() : email,
      password: await bcrypt.hash(String(password), 10),
      roleId: role.id,
    });

    res.status(201).json({
      status: true,
      message: `${user.name} was added as ${role.name}`,
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        roleId: role.id,
        Role: { id: role.id, name: role.name, isSystem: role.isSystem },
      },
    });
  } catch (error) {
    handleError(res, error);
  }
};
// PUT /api/admin/users/:id   body: { name, email, password }  (password is optional)
export const updateUser = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id, { include: Role });
    if (!user) {
      return res.status(404).json({ status: false, message: 'User not found' });
    }
    const problem = checkCanManage(req, user);
    if (problem) {
      return res.status(403).json({ status: false, message: problem });
    }

    const { name, email, password } = req.body;

    if (name !== undefined) user.name = String(name).trim();
    if (email !== undefined) user.email = String(email).trim();

    // Only change the password if a new one was typed
    const newPassword = password ? String(password) : '';
    if (newPassword) {
      if (newPassword.length < 6) {
        return res.status(400).json({ status: false, message: 'Password must be at least 6 characters' });
      }
      user.password = await bcrypt.hash(newPassword, 10);
      // Any old reset code stops working
      user.resetOtp = null;
      user.resetOtpExpires = null;
      user.resetOtpAttempts = 0;
    }

    await user.save();

    res.status(200).json({
      status: true,
      message: newPassword ? `${user.name} updated, new password saved` : `${user.name} updated`,
      data: { id: user.id, name: user.name, email: user.email },
    });
  } catch (error) {
    handleError(res, error);
  }
};
// PATCH /api/admin/users/:id/block   body: { "blocked": true }
export const setUserBlocked = async (req, res) => {
  try {
    const { blocked } = req.body;
    if (typeof blocked !== 'boolean') {
      return res.status(400).json({ status: false, message: 'blocked must be true or false' });
    }

    const user = await User.findByPk(req.params.id, { include: Role });
    if (!user) {
      return res.status(404).json({ status: false, message: 'User not found' });
    }
    const problem = checkCanManage(req, user);
    if (problem) {
      return res.status(403).json({ status: false, message: problem });
    }

    user.isBlocked = blocked;
    await user.save({ fields: ['isBlocked'] });

    res.status(200).json({
      status: true,
      message: blocked ? 'User blocked' : 'User unblocked',
      data: { id: user.id, isBlocked: user.isBlocked },
    });
  } catch (error) {
    handleError(res, error);
  }
};

// PATCH /api/admin/users/:id/role   body: { "roleId": 2 }
export const setUserRole = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id, { include: Role });
    if (!user) {
      return res.status(404).json({ status: false, message: 'User not found' });
    }
    const problem = checkCanManage(req, user);
    if (problem) {
      return res.status(403).json({ status: false, message: problem });
    }

    const role = await Role.findByPk(req.body.roleId);
    if (!role) {
      return res.status(400).json({ status: false, message: 'Choose a valid role' });
    }

    if (!canGiveRole(req, role)) {
      return res.status(403).json({ status: false, message: "You can't give a role with more access than yours" });
    }

    user.roleId = role.id;
    await user.save({ fields: ['roleId'] });

    res.status(200).json({
      status: true,
      message: `${user.name} is now ${role.name}`,
      data: { id: user.id, role: { id: role.id, name: role.name, isSystem: role.isSystem } },
    });
  } catch (error) {
    handleError(res, error);
  }
};

// DELETE /api/admin/users/:id
export const deleteUser = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id, { include: Role });
    if (!user) {
      return res.status(404).json({ status: false, message: 'User not found' });
    }
    const problem = checkCanManage(req, user);
    if (problem) {
      return res.status(403).json({ status: false, message: problem });
    }

    // Remember their images before the products are deleted
    const products = await Product.findAll({ where: { userId: user.id }, attributes: ['imagePublicId'] });
    const imageIds = [user.avatarPublicId, ...products.map((p) => p.imagePublicId)];

    await user.destroy(); // their products are deleted too (CASCADE)

    for (const id of imageIds) {
      await deleteImage(id); // skips empty ones
    }

    res.status(200).json({ status: true, message: 'User deleted' });
  } catch (error) {
    handleError(res, error);
  }
};

// PATCH /api/admin/products/:id/block   body: { "blocked": true }
export const setProductBlocked = async (req, res) => {
  try {
    const { blocked } = req.body;
    if (typeof blocked !== 'boolean') {
      return res.status(400).json({ status: false, message: 'blocked must be true or false' });
    }

    const product = await Product.findByPk(req.params.id);
    if (!product) {
      return res.status(404).json({ status: false, message: 'Product not found' });
    }

    product.isBlocked = blocked;
    await product.save({ fields: ['isBlocked'] });

    res.status(200).json({
      status: true,
      message: blocked ? 'Product blocked' : 'Product unblocked',
      data: { id: product.id, isBlocked: product.isBlocked },
    });
  } catch (error) {
    handleError(res, error);
  }
};