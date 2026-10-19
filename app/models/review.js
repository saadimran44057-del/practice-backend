import { DataTypes } from 'sequelize';
import { sequelize } from '../config/connection.js';

// A buyer's rating (1 to 5 stars) and comment on a product they received.
// One review per buyer per product: writing again updates it.
const Review = sequelize.define('Review', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  rating: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      notNull: { msg: 'Choose a rating' },
      isInt: { msg: 'Rating must be a whole number' },
      min: { args: [1], msg: 'Rating must be 1 to 5 stars' },
      max: { args: [5], msg: 'Rating must be 1 to 5 stars' },
    },
  },
  comment: {
    type: DataTypes.TEXT,
    allowNull: true,
    validate: {
      len: { args: [0, 1000], msg: 'Review can be up to 1000 characters' },
    },
  },
}, {
  tableName: 'reviews',
  timestamps: true,
  indexes: [{ unique: true, fields: ['productId', 'userId'] }],
});

export default Review;