import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/user.js';
import { handleError } from '../utils/handleError.js';

const createToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};

const publicUser = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
});

// SIGNUP
export const signup = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!password || password.length < 6) {
      return res.status(400).json({ status: false, message: 'Password must be at least 6 characters' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // role body se nahi lete, warna koi bhi khud ko admin bana leta
     const existingUser = await User.findOne({ where: { email } });
     if(existingUser){
      return res.status(400).json({ status: false, message: 'Email already registered' });
     }else{
       const user =await User.create({ name, email, password: hashedPassword }); 
    
    res.status(201).json({
      status: true,
      message: 'Signup successful',
      token: createToken(user.id),
      user: publicUser(user),
    });
  }
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

    const user = await User.findOne({ where: { email } });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ status: false, message: 'Invalid email or password' });
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