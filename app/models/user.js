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
  avatar: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  avatarPublicId: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  // Which role this user has (links to the roles table)
  roleId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  // Set when the user signs in with Google (Google's id for this person)
  googleId: {
    type: DataTypes.STRING,
    allowNull: true,
    unique: true,
  },
  // Delivery address saved at checkout, to fill the form next time
  savedAddress: {
    type: DataTypes.JSONB,
    allowNull: true,
  },
  // Admin can block a user
  isBlocked: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
  // Used by forgot / reset password
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