import { permissionsForRole } from '../config/permissions.js';

// What we send to the frontend about a user. Never the password or OTP.
// The user must be loaded with: include: Role
export const publicUser = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  avatar: user.avatar,
  createdAt: user.createdAt,
  role: user.Role ? { id: user.Role.id, name: user.Role.name } : null,
  permissions: permissionsForRole(user.Role),
});