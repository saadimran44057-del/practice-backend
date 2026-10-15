import { DataTypes } from 'sequelize';
import { sequelize } from '../config/connection.js';

const User = sequelize.define('User', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notNull: { msg: 'Name is required' },
      notEmpty: { msg: 'Name cannot be empty' },
    },
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: { msg: 'Email already registered' },
    validate: {
      notNull: { msg: 'Email is required' },
      isEmail: { msg: 'Invalid email format' },
    },
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  role: {
    type: DataTypes.ENUM('user', 'admin'),
    allowNull: false,
    defaultValue: 'user',
  },
  // Forgot password ke liye
  resetOtp: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  resetOtpExpires: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  resetOtpAttempts: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
}, {
  tableName: 'users',
  timestamps: true,
});

export default User;