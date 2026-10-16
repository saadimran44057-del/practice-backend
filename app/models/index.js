import User from './user.js';
import Product from './product.js';
import Role from './role.js';

User.hasMany(Product, { foreignKey: 'userId', onDelete: 'CASCADE' });
Product.belongsTo(User, { foreignKey: 'userId' });

// A role has many users. A role that still has users can't be deleted
Role.hasMany(User, { foreignKey: 'roleId', onDelete: 'RESTRICT' });
User.belongsTo(Role, { foreignKey: 'roleId' });

export { User, Product, Role };