import jwt from 'jsonwebtoken';
import { User, Role } from '../models/index.js';
import { permissionsForRole, isAdminRole } from '../config/permissions.js';

// Only logged-in, non-blocked users get through
export const protect = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ status: false, message: 'Please login first' });
  }

  const token = authHeader.split(' ')[1];

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    return res.status(401).json({ status: false, message: 'Invalid or expired token' });
  }

  try {
    const user = await User.findByPk(decoded.id, {
      attributes: ['id', 'name', 'email', 'isBlocked', 'roleId'],
      include: Role,
    });

    if (!user) {
      return res.status(401).json({ status: false, message: 'User no longer exists' });
    }

    if (user.isBlocked) {
      return res.status(403).json({ status: false, message: 'Your account has been blocked. Contact support.' });
    }

    // Read fresh from the database on every request,
    // so role changes work without logging in again
    req.user = {
      id: user.id,
      roleId: user.roleId,
      isAdmin: isAdminRole(user.Role),
      permissions: permissionsForRole(user.Role),
    };
    next();
  } catch (error) {
    return res.status(500).json({ status: false, message: error.message });
  }
};

// Let the request through if the user has ANY of these permissions
// e.g. requirePermission('users.view')
export const requirePermission = (...permissions) => (req, res, next) => {
  const allowed = permissions.some((p) => req.user.permissions.includes(p));
  if (!allowed) {
    return res.status(403).json({ status: false, message: 'You do not have permission' });
  }
  next();
};