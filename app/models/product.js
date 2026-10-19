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
  imagePublicId: {
    type: DataTypes.STRING,
    allowNull: true,
  },

  // How many are available to sell. POS sales lower this
  stock: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    validate: {
      isInt: { msg: 'Stock must be a whole number' },
      min: { args: [0], msg: 'Stock cannot be negative' },
    },
  },

    // Delivery address saved at checkout, to fill the form next time
    savedAddress: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
  // Admin can block a product
  
  isBlocked: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
}, {
  tableName: 'products',
  timestamps: true,
});

export default Product;

