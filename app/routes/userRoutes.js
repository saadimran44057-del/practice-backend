import express from 'express';
import { getMe, updateMe } from '../controllers/userController.js';
import { protect } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';

const router = express.Router();

// Every logged-in user: their own profile
router.get('/me', protect, getMe);
router.put('/me', protect, upload.single('avatar'), updateMe);

export default router;