import { sequelize } from '../config/connection.js';
import { Role, User } from '../models/index.js';
import { PERMISSIONS, ALL_PERMISSIONS, isAdminRole, permissionsForRole } from '../config/permissions.js';
import { handleError } from '../utils/handleError.js';

// Check the name and permissions sent from the panel
const readRoleBody = (req) => {
  const name = typeof req.body.name === 'string' ? req.body.name.trim().toLowerCase() : '';
  const description = typeof req.body.description === 'string' ? req.body.description.trim() : '';
  const permissions = Array.isArray(req.body.permissions) ? [...new Set(req.body.permissions)] : null;

  if (!permissions) return { error: 'permissions must be a list' };

  const unknown = permissions.filter((p) => !ALL_PERMISSIONS.includes(p));
  if (unknown.length) return { error: `Unknown permission: ${unknown.join(', ')}` };

  // A non-admin can only give permissions they have themselves
  if (!req.user.isAdmin) {
    const notOwned = permissions.filter((p) => !req.user.permissions.includes(p));
    if (notOwned.length) return { error: "You can't give permissions you don't have yourself" };
  }

  return { name, description: description || null, permissions };
};

const roleJSON = (role, userCount = 0) => ({
  id: role.id,
  name: role.name,
  description: role.description,
  permissions: permissionsForRole(role),
  isSystem: role.isSystem,
  isAdmin: isAdminRole(role),
  userCount,
});

// GET /api/admin/roles
export const getRoles = async (req, res) => {
  try {
    const roles = await Role.findAll({ order: [['isSystem', 'DESC'], ['name', 'ASC']] });

    // How many users have each role
    const counts = await User.findAll({
      attributes: ['roleId', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
      group: ['roleId'],
      raw: true,
    });
    const countMap = {};
    counts.forEach((c) => {
      countMap[c.roleId] = Number(c.count);
    });

    res.status(200).json({
      status: true,
      data: roles.map((r) => roleJSON(r, countMap[r.id] || 0)),
      permissions: PERMISSIONS, // the full list, for the checkboxes
    });
  } catch (error) {
    handleError(res, error);
  }
};

// POST /api/admin/roles   body: { name, description, permissions: [] }
export const createRole = async (req, res) => {
  try {
    const body = readRoleBody(req);
    if (body.error) return res.status(400).json({ status: false, message: body.error });

    const role = await Role.create({ ...body, isSystem: false });
    res.status(201).json({ status: true, message: 'Role created', data: roleJSON(role) });
  } catch (error) {
    handleError(res, error);
  }
};

// PUT /api/admin/roles/:id
export const updateRole = async (req, res) => {
  try {
    const role = await Role.findByPk(req.params.id);
    if (!role) return res.status(404).json({ status: false, message: 'Role not found' });

    if (role.isSystem) {
      return res.status(400).json({ status: false, message: `The ${role.name} role is built in and can't be changed` });
    }

    // Stops someone giving their own role more power
    if (!req.user.isAdmin && role.id === req.user.roleId) {
      return res.status(403).json({ status: false, message: "You can't edit your own role" });
    }

    const body = readRoleBody(req);
    if (body.error) return res.status(400).json({ status: false, message: body.error });

    role.set(body);
    await role.save();
    res.status(200).json({ status: true, message: 'Role updated', data: roleJSON(role) });
  } catch (error) {
    handleError(res, error);
  }
};

// DELETE /api/admin/roles/:id
export const deleteRole = async (req, res) => {
  try {
    const role = await Role.findByPk(req.params.id);
    if (!role) return res.status(404).json({ status: false, message: 'Role not found' });

    if (role.isSystem) {
      return res.status(400).json({ status: false, message: `The ${role.name} role is built in and can't be deleted` });
    }

    const userCount = await User.count({ where: { roleId: role.id } });
    if (userCount > 0) {
      return res.status(400).json({
        status: false,
        message: `${userCount} user(s) still have this role. Give them another role first.`,
      });
    }

    await role.destroy();
    res.status(200).json({ status: true, message: 'Role deleted' });
  } catch (error) {
    handleError(res, error);
  }
};