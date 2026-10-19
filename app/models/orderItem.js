import { DataTypes } from 'sequelize';
import { sequelize } from '../config/connection.js';

// One line of an order. Name, price and image are copied so the
// order still reads correctly if the product changes or is deleted.
const OrderItem = sequelize.define('OrderItem', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  name: { type: DataTypes.STRING, allowNull: false },
  image: { type: DataTypes.STRING, allowNull: true },
  price: { type: DataTypes.FLOAT, allowNull: false },
  quantity: { type: DataTypes.INTEGER, allowNull: false },
  lineTotal: { type: DataTypes.FLOAT, allowNull: false },
}, {
  tableName: 'order_items',
  timestamps: false,
});

export default OrderItem;