import jwt from 'jsonwebtoken';
import User from '../models/user.js';

// Login check
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
      attributes: ['id', 'name', 'email', 'role'],
    });

    if (!user) {
      return res.status(401).json({ status: false, message: 'User no longer exists' });
    }

    req.user = { id: user.id, role: user.role };
    next();
  } catch (error) {
    return res.status(500).json({ status: false, message: error.message });
  }
};

// Role check: sirf in roles ko jane do
export const authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ status: false, message: 'You do not have permission' });
  }
  next();
};