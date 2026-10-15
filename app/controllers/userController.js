import { sequelize } from '../config/connection.js';
import User from '../models/user.js';
import Product from '../models/product.js';
import { handleError } from '../utils/handleError.js';
import { uploadImage, deleteImage } from '../config/cloudinary.js';

const profileFields = ['id', 'name', 'email', 'role', 'avatar', 'createdAt'];

const publicProfile = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  avatar: user.avatar,
  createdAt: user.createdAt,
});

// Sirf admin: saare users aur un ke products ki ginti
export const getUsers = async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: { exclude: ['password', 'resetOtp', 'resetOtpExpires', 'resetOtpAttempts', 'avatarPublicId'] },
      order: [['id', 'ASC']],
    });

    const counts = await Product.findAll({
      attributes: ['userId', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
      group: ['userId'],
      raw: true,
    });

    const countMap = {};
    counts.forEach((c) => {
      countMap[c.userId] = Number(c.count);
    });

    const data = users.map((u) => ({
      ...u.toJSON(),
      productCount: countMap[u.id] || 0,
    }));

    res.status(200).json({ status: true, count: data.length, data });
  } catch (error) {
    handleError(res, error);
  }
};

// MERA PROFILE: login wala user apni details dekhe
export const getMe = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, { attributes: profileFields });
    if (!user) {
      return res.status(404).json({ status: false, message: 'User not found' });
    }
    res.status(200).json({ status: true, user: publicProfile(user) });
  } catch (error) {
    handleError(res, error);
  }
};

// PROFILE UPDATE: naam aur profile picture
export const updateMe = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) {
      return res.status(404).json({ status: false, message: 'User not found' });
    }

    // Sirf naam badal sakte hain. Email, role, password yahan se nahi
    const { name, removeAvatar } = req.body;
    if (name !== undefined) {
      user.name = name.trim();
    }
    await user.validate();

    const oldPublicId = user.avatarPublicId;

    if (req.file) {
      // Nayi photo upload
      const uploaded = await uploadImage(req.file.buffer, 'practice-avatars');
      user.avatar = uploaded.url;
      user.avatarPublicId = uploaded.publicId;
    } else if (removeAvatar === 'true') {
      // Photo hatani hai
      user.avatar = null;
      user.avatarPublicId = null;
    }

    try {
      await user.save();
    } catch (error) {
      if (req.file) await deleteImage(user.avatarPublicId);
      throw error;
    }

    // Purani photo Cloudinary se hatao
    if ((req.file || removeAvatar === 'true') && oldPublicId) {
      await deleteImage(oldPublicId);
    }

    res.status(200).json({ status: true, message: 'Profile updated', user: publicProfile(user) });
  } catch (error) {
    handleError(res, error);
  }
};