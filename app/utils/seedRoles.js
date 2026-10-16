import { Role, User } from '../models/index.js';
import { DEFAULT_ROLES } from '../config/permissions.js';

// Runs every time the server starts. Safe to run again and again
export const seedRoles = async () => {
  // 1. Create admin, manager and user roles if they don't exist yet
  for (const role of DEFAULT_ROLES) {
    await Role.findOrCreate({ where: { name: role.name }, defaults: role });
  }

  // 2. Any user without a role becomes a normal "user"
  const userRole = await Role.findOne({ where: { name: 'user' } });
  await User.update({ roleId: userRole.id }, { where: { roleId: null } });
};