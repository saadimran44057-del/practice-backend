import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User, Role } from '../models/index.js';
import { publicUser } from '../utils/publicUser.js';
import { handleError } from '../utils/handleError.js';
import { sendEmail } from '../utils/sendEmail.js';

const OTP_EXPIRY_MINUTES = 10;
const MAX_OTP_ATTEMPTS = 5;

const createToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};



// SIGNUP
export const signup = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!password || password.length < 6) {
      return res.status(400).json({ status: false, message: 'Password must be at least 6 characters' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

        // New accounts always get the normal 'user' role.
    // Never take the role from req.body, or anyone could make themselves admin.
    const userRole = await Role.findOne({ where: { name: 'user' } });
    const user = await User.create({ name, email, password: hashedPassword, roleId: userRole.id });
    await user.reload({ include: [Role] });

    res.status(201).json({
      status: true,
      message: 'Signup successful',
      token: createToken(user.id),
      user: publicUser(user),
    });
  } catch (error) {
    handleError(res, error);
  }
};

// LOGIN
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ status: false, message: 'Email and password are required' });
    }

    const user = await User.findOne({ where: { email }, include: [Role] });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ status: false, message: 'Invalid email or password' });
    }
    
    if (user.isBlocked) {
      return res.status(403).json({ status: false, message: 'Your account has been blocked. Contact support.' });
    }

    res.status(200).json({
      status: true,
      message: 'Login successful',
      token: createToken(user.id),
      user: publicUser(user),
    });
  } catch (error) {
    handleError(res, error);
  }
};

// FORGOT PASSWORD: email par 6 digit OTP bhejo
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ status: false, message: 'Email is required' });
    }

    // Email registered ho ya na ho, jawab ek hi (taake koi emails check na kar sake)
    const genericMessage = 'If this email is registered, an OTP has been sent to it';

    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(200).json({ status: true, message: genericMessage });
    }

    const otp = crypto.randomInt(100000, 1000000).toString();

    user.resetOtp = await bcrypt.hash(otp, 10);
    user.resetOtpExpires = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
    user.resetOtpAttempts = 0;
    await user.save();

    await sendEmail({
      to: user.email,
      subject: 'Your password reset code',
      text: `Your OTP is ${otp}. It expires in ${OTP_EXPIRY_MINUTES} minutes.`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 420px;">
          <h2>Password Reset</h2>
          <p>Hi ${user.name},</p>
          <p>Use this code to reset your password:</p>
          <p style="font-size: 30px; font-weight: bold; letter-spacing: 6px;">${otp}</p>
          <p>This code expires in ${OTP_EXPIRY_MINUTES} minutes.</p>
          <p>If you did not request this, you can ignore this email.</p>
        </div>
      `,
    });

    res.status(200).json({ status: true, message: genericMessage });
  } catch (error) {
    handleError(res, error);
  }
};

// RESET PASSWORD: OTP check karke naya password lagao
export const resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      return res.status(400).json({ status: false, message: 'Email, OTP and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ status: false, message: 'Password must be at least 6 characters' });
    }

    const invalid = { status: false, message: 'Invalid or expired OTP' };

    const user = await User.findOne({ where: { email } });

    if (!user || !user.resetOtp || !user.resetOtpExpires) {
      return res.status(400).json(invalid);
    }

    if (user.resetOtpExpires < new Date()) {
      return res.status(400).json(invalid);
    }

    if (user.resetOtpAttempts >= MAX_OTP_ATTEMPTS) {
      return res.status(429).json({ status: false, message: 'Too many wrong attempts. Request a new OTP' });
    }

    const isMatch = await bcrypt.compare(String(otp), user.resetOtp);

    if (!isMatch) {
      user.resetOtpAttempts += 1;
      await user.save();
      return res.status(400).json(invalid);
    }

    user.password = await bcrypt.hash(newPassword, 10);
    user.resetOtp = null;
    user.resetOtpExpires = null;
    user.resetOtpAttempts = 0;
    await user.save();

    res.status(200).json({ status: true, message: 'Password reset successful. Please login' });
  } catch (error) {
    handleError(res, error);
  }
};