import { User, Role } from '../models/index.js';
import { handleError } from '../utils/handleError.js';
import { uploadImage, deleteImage } from '../config/cloudinary.js';
import { publicUser } from '../utils/publicUser.js';

// MY PROFILE: the logged-in user sees their own details
export const getMe = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, { include: [Role] });
    if (!user) {
      return res.status(404).json({ status: false, message: 'User not found' });
    }
    res.status(200).json({ status: true, user: publicUser(user) });
  } catch (error) {
    handleError(res, error);
  }
};

// PROFILE UPDATE: name and profile picture
export const updateMe = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, { include: [Role] });
    if (!user) {
      return res.status(404).json({ status: false, message: 'User not found' });
    }

    // Only the name can change here. Not email, role or password
    const { name, removeAvatar } = req.body;
    if (name !== undefined) {
      user.name = name.trim();
    }
    await user.validate();

    const oldPublicId = user.avatarPublicId;

    if (req.file) {
      // Upload the new photo
      const uploaded = await uploadImage(req.file.buffer, 'practice-avatars');
      user.avatar = uploaded.url;
      user.avatarPublicId = uploaded.publicId;
    } else if (removeAvatar === 'true') {
      // Remove the photo
      user.avatar = null;
      user.avatarPublicId = null;
    }

    try {
      await user.save();
    } catch (error) {
      if (req.file) await deleteImage(user.avatarPublicId);
      throw error;
    }

    // Delete the old photo from Cloudinary
    if ((req.file || removeAvatar === 'true') && oldPublicId) {
      await deleteImage(oldPublicId);
    }

    res.status(200).json({ status: true, message: 'Profile updated', user: publicUser(user) });
  } catch (error) {
    handleError(res, error);
  }
};