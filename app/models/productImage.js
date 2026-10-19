import { DataTypes } from 'sequelize';
import { sequelize } from '../config/connection.js';

// Extra photos for a product (the main photo stays in product.image)
const ProductImage = sequelize.define('ProductImage', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  url: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  publicId: {
    type: DataTypes.STRING,
    allowNull: true,
  },
}, {
  tableName: 'product_images',
  timestamps: true,
});

export default ProductImage;