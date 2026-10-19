import User from './user.js';
import Product from './product.js';
import Role from './role.js';
import Sale from './sale.js';
import SaleItem from './saleItem.js';
import ProductImage from './productImage.js';
import Order from './order.js';
import OrderItem from './orderItem.js';
import Review from './review.js';
import { deleteImage } from '../config/cloudinary.js';

User.hasMany(Product, { foreignKey: 'userId', onDelete: 'CASCADE' });
Product.belongsTo(User, { foreignKey: 'userId' });

// A role has many users. A role that still has users can't be deleted
Role.hasMany(User, { foreignKey: 'roleId', onDelete: 'RESTRICT' });
User.belongsTo(Role, { foreignKey: 'roleId' });

// A user (the seller) has many sales
User.hasMany(Sale, { foreignKey: 'userId', onDelete: 'CASCADE' });
Sale.belongsTo(User, { foreignKey: 'userId' });

// A sale has many lines. Deleting a sale deletes its lines
Sale.hasMany(SaleItem, { foreignKey: 'saleId', as: 'items', onDelete: 'CASCADE' });
SaleItem.belongsTo(Sale, { foreignKey: 'saleId' });

// If a product is deleted later, its old sale lines stay (productId becomes empty)
Product.hasMany(SaleItem, { foreignKey: 'productId', onDelete: 'SET NULL' });
SaleItem.belongsTo(Product, { foreignKey: 'productId' });

// ----- Online shop -----

// Extra photos of a product
Product.hasMany(ProductImage, { foreignKey: 'productId', as: 'images', onDelete: 'CASCADE' });
ProductImage.belongsTo(Product, { foreignKey: 'productId' });

// Orders: the buyer who placed it and the seller who ships it
User.hasMany(Order, { foreignKey: 'buyerId', as: 'purchases', onDelete: 'SET NULL' });
Order.belongsTo(User, { foreignKey: 'buyerId', as: 'buyer' });
User.hasMany(Order, { foreignKey: 'sellerId', as: 'orders', onDelete: 'CASCADE' });
Order.belongsTo(User, { foreignKey: 'sellerId', as: 'seller' });

Order.hasMany(OrderItem, { foreignKey: 'orderId', as: 'items', onDelete: 'CASCADE' });
OrderItem.belongsTo(Order, { foreignKey: 'orderId' });
Product.hasMany(OrderItem, { foreignKey: 'productId', onDelete: 'SET NULL' });
OrderItem.belongsTo(Product, { foreignKey: 'productId' });

// Reviews
Product.hasMany(Review, { foreignKey: 'productId', onDelete: 'CASCADE' });
Review.belongsTo(Product, { foreignKey: 'productId' });
User.hasMany(Review, { foreignKey: 'userId', onDelete: 'CASCADE' });
Review.belongsTo(User, { foreignKey: 'userId' });

// When a product is deleted, also delete its extra photos from Cloudinary
Product.addHook('beforeDestroy', async (product) => {
  const images = await ProductImage.findAll({ where: { productId: product.id } });
  product.galleryPublicIds = images.map((img) => img.publicId);
});
Product.addHook('afterDestroy', async (product) => {
  for (const publicId of product.galleryPublicIds || []) {
    await deleteImage(publicId);
  }
});

export { User, Product, Role, Sale, SaleItem, ProductImage, Order, OrderItem, Review };