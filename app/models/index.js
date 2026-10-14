import User from './user.js';
import Product from './product.js';

// Ek user ke kai products
User.hasMany(Product, {
  foreignKey: { name: 'userId', allowNull: false },
  onDelete: 'CASCADE',
});

// Har product ek user ka
Product.belongsTo(User, {
  foreignKey: { name: 'userId', allowNull: false },
});

export { User, Product };