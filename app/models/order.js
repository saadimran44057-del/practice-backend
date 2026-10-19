import { DataTypes } from 'sequelize';
import { sequelize } from '../config/connection.js';

// One order = one buyer buying from one seller.
// A cart with products from 3 sellers becomes 3 orders.
const Order = sequelize.define('Order', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  status: {
    type: DataTypes.ENUM('pending', 'shipped', 'delivered', 'cancelled'),
    allowNull: false,
    defaultValue: 'pending',
  },
  paymentMethod: {
    type: DataTypes.ENUM('cod', 'card'),
    allowNull: false,
  },
  // cod starts unpaid and becomes paid on delivery. card is paid at checkout
  paymentStatus: {
    type: DataTypes.ENUM('unpaid', 'paid', 'refunded'),
    allowNull: false,
    defaultValue: 'unpaid',
  },
  // Only the last 4 digits. Never save the full card number
  cardLast4: {
    type: DataTypes.STRING(4),
    allowNull: true,
  },
  total: {
    type: DataTypes.FLOAT,
    allowNull: false,
  },
  itemCount: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },

  // Delivery address (copied onto the order, so later changes don't affect it)
  fullName: { type: DataTypes.STRING, allowNull: false },
  phone: { type: DataTypes.STRING, allowNull: false },
  address: { type: DataTypes.STRING, allowNull: false },
  city: { type: DataTypes.STRING, allowNull: false },
  postalCode: { type: DataTypes.STRING, allowNull: true },
  note: { type: DataTypes.STRING(300), allowNull: true },
  // Optional pin from the buyer's browser, so the seller can open it in Maps
  latitude: { type: DataTypes.FLOAT, allowNull: true },
  longitude: { type: DataTypes.FLOAT, allowNull: true },
}, {
  tableName: 'orders',
  timestamps: true,
});

export default Order;