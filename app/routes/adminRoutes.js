import express from 'express';
import {
  getStats,
  getUsers,
  createUser,
  updateUser,
  getProducts,
  setUserBlocked,
  setUserRole,
  deleteUser,
  setProductBlocked,
} from '../controllers/adminController.js';
import { getRoles, createRole, updateRole, deleteRole } from '../controllers/roleController.js';
import { protect, requirePermission } from '../middleware/auth.js';

const router = express.Router();

// Every route below needs a logged-in user. Each route then checks its own permission
router.use(protect);

// Dashboard
router.get('/stats', requirePermission('dashboard.view'), getStats);

// Users
router.get('/users', requirePermission('users.view'), getUsers);
router.post('/users', requirePermission('users.create'), createUser);
router.put('/users/:id', requirePermission('users.edit'), updateUser);
router.patch('/users/:id/block', requirePermission('users.block'), setUserBlocked);
router.patch('/users/:id/role', requirePermission('users.assignRole'), setUserRole);
router.delete('/users/:id', requirePermission('users.delete'), deleteUser);

// Products
router.get('/products', requirePermission('products.view'), getProducts);
router.patch('/products/:id/block', requirePermission('products.block'), setProductBlocked);

// Roles (the users page also needs the list, for the role filter and dropdown)
router.get('/roles', requirePermission('roles.manage', 'users.view'), getRoles);
router.post('/roles', requirePermission('roles.manage'), createRole);
router.put('/roles/:id', requirePermission('roles.manage'), updateRole);
router.delete('/roles/:id', requirePermission('roles.manage'), deleteRole);

export default router;