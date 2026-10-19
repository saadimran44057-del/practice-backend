import { DataTypes } from 'sequelize';
import { sequelize } from '../config/connection.js';

// One line on a sale: which product, how many, at what price.
// Name and price are copied at the moment of sale, so the history stays
// correct even if the product is renamed, repriced or deleted later.
const SaleItem = sequelize.define('SaleItem', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  price: {
    type: DataTypes.FLOAT,
    allowNull: false,
  },
  quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  lineTotal: {
    type: DataTypes.FLOAT,
    allowNull: false,
  },
}, {
  tableName: 'sale_items',
  timestamps: false,
});

export default SaleItem;