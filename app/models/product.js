import { DataTypes } from 'sequelize';
import { sequelize } from '../config/connection.js';

const Product = sequelize.define('Product', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notNull: { msg: 'Name is required' },
      notEmpty: { msg: 'Name cannot be empty' },
      len: { args: [3, 100], msg: 'Name must be 3 to 100 characters' },
    },
  },
  price: {
    type: DataTypes.FLOAT,
    allowNull: false,
    validate: {
      notNull: { msg: 'Price is required' },
      isFloat: { msg: 'Price must be a number' },
      min: { args: [1], msg: 'Price must be greater than 0' },
    },
  },
  description: {
    type: DataTypes.TEXT,
    validate: {
      len: { args: [0, 500], msg: 'Description max 500 characters' },
    },
  },
  image: {
    type: DataTypes.STRING,
    allowNull: true,
  },
}, {
  tableName: 'products',
  timestamps: true,
});

export default Product;