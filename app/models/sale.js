import { DataTypes } from 'sequelize';
import { sequelize } from '../config/connection.js';

// One checkout at the POS
const Sale = sequelize.define('Sale', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  total: {
    type: DataTypes.FLOAT,
    allowNull: false,
  },
  // Number of pieces sold in this sale (2 shoes + 1 bag = 3)
  itemCount: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  paymentMethod: {
    type: DataTypes.ENUM('cash', 'card'),
    allowNull: false,
    defaultValue: 'cash',
  },
  // Only for cash: what the customer handed over (to work out change)
  cashReceived: {
    type: DataTypes.FLOAT,
    allowNull: true,
  },
}, {
  tableName: 'sales',
  timestamps: true,
});

export default Sale;