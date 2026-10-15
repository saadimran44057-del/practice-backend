import express from 'express';
import { getUsers, getMe, updateMe } from '../controllers/userController.js';
import { protect, authorize } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';

const router = express.Router();

// Har login user: apna profile
router.get('/me', protect, getMe);
router.put('/me', protect, upload.single('avatar'), updateMe);

// Sirf admin: saare users
router.get('/', protect, authorize('admin'), getUsers);

export default router;