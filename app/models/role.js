import { DataTypes } from 'sequelize';
import { sequelize } from '../config/connection.js';

const Role = sequelize.define('Role', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  name: {
    type: DataTypes.STRING(30),
    allowNull: false,
    unique: { msg: 'A role with this name already exists' },
    validate: {
      notNull: { msg: 'Role name is required' },
      len: { args: [2, 30], msg: 'Role name must be 2 to 30 characters' },
    },
  },
  description: {
    type: DataTypes.STRING(200),
    allowNull: true,
  },
  // List of permission keys, e.g. ['users.view', 'users.block']
  permissions: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    allowNull: false,
    defaultValue: [],
  },
  // System roles (admin, user) can't be renamed, edited or deleted
  isSystem: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
}, {
  tableName: 'roles',
  timestamps: true,
});

export default Role;