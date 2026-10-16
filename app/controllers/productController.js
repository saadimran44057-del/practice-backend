import { Op } from 'sequelize';
import Product from '../models/product.js';
import User from '../models/user.js';
import { handleError } from '../utils/handleError.js';
import { deleteFile } from '../utils/deleteFile.js';
import { uploadImage, deleteImage } from '../config/cloudinary.js';

// With this permission the user can reach every product, otherwise only their own
const scopeFor = (user, permission) =>
  user.permissions.includes(permission) ? {} : { userId: user.id };

// Remove an old image: from Cloudinary if it has a publicId, otherwise from the local uploads folder
const removeImage = async (image, publicId) => {
  if (publicId) {
    await deleteImage(publicId);
  } else if (image && image.startsWith('/uploads/')) {
    deleteFile(image);
  }
};

// CREATE
export const createProduct = async (req, res) => {
  try {
    const userId = req.user.id;

    if (Array.isArray(req.body)) {
      const items = req.body.map((item) => ({ ...item, userId }));
      const products = await Product.bulkCreate(items, { validate: true });
      return res.status(201).json({ status: true, count: products.length, data: products });
    }

    const { id, image, imagePublicId, isBlocked, ...data } = req.body;
    const product = Product.build({ ...data, userId });

    // Validate first, so we don't upload an image for invalid data
    await product.validate();

    if (req.file) {
      const uploaded = await uploadImage(req.file.buffer);
      product.image = uploaded.url;
      product.imagePublicId = uploaded.publicId;
    }

    try {
      await product.save();
    } catch (error) {
      await deleteImage(product.imagePublicId);
      throw error;
    }

    res.status(201).json({ status: true, data: product });
  } catch (error) {
    handleError(res, error);
  }
};

// READ ALL
export const getProducts = async (req, res) => {
  try {
    const { search = '', minPrice, maxPrice, sortBy = 'createdAt', order = 'DESC' } = req.query;

    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 10, 1), 50);
    const offset = (page - 1) * limit;

    const where = { ...scopeFor(req.user, 'products.view') };

    if (search) {
      where.name = { [Op.iLike]: `%${search}%` };
    }

    if (minPrice || maxPrice) {
      where.price = {};
      if (minPrice) where.price[Op.gte] = Number(minPrice);
      if (maxPrice) where.price[Op.lte] = Number(maxPrice);
    }

    const allowedSort = ['name', 'price', 'createdAt'];
    const sortField = allowedSort.includes(sortBy) ? sortBy : 'createdAt';
    const sortOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const include = req.user.permissions.includes('products.view')
      ? [{ model: User, attributes: ['id', 'name', 'email'] }]
      : [];

    const { count, rows } = await Product.findAndCountAll({
      where,
      include,
      order: [[sortField, sortOrder]],
      limit,
      offset,
    });

    res.status(200).json({
      status: true,
      data: rows,
      pagination: { total: count, page, limit, totalPages: Math.ceil(count / limit) },
    });
  } catch (error) {
    handleError(res, error);
  }
};

// READ ONE
export const getProductById = async (req, res) => {
  try {
    const product = await Product.findOne({
      where: { id: req.params.id, ...scopeFor(req.user, 'products.view') },
    });
    if (!product) {
      return res.status(404).json({ status: false, message: 'Product not found' });
    }
    res.status(200).json({ status: true, data: product });
  } catch (error) {
    handleError(res, error);
  }
};

// UPDATE
export const updateProduct = async (req, res) => {
  try {
    const product = await Product.findOne({
      where: { id: req.params.id, ...scopeFor(req.user, 'products.edit') },
    });
    if (!product) {
      return res.status(404).json({ status: false, message: 'Product not found' });
    }

    if (product.isBlocked && !req.user.permissions.includes('products.edit')) {
      return res.status(403).json({ status: false, message: 'This product was blocked by an admin and cannot be edited' });
    }

    const { userId, id, image, imagePublicId, isBlocked, ...data } = req.body;
    product.set(data);
    await product.validate();

    const oldImage = product.image;
    const oldPublicId = product.imagePublicId;

    if (req.file) {
      const uploaded = await uploadImage(req.file.buffer);
      product.image = uploaded.url;
      product.imagePublicId = uploaded.publicId;
    }

    try {
      await product.save();
    } catch (error) {
      if (req.file) await deleteImage(product.imagePublicId);
      throw error;
    }

    // New image is saved, now remove the old one
    if (req.file) await removeImage(oldImage, oldPublicId);

    res.status(200).json({ status: true, message: 'Product updated', data: product });
  } catch (error) {
    handleError(res, error);
  }
};

// DELETE
export const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findOne({
      where: { id: req.params.id, ...scopeFor(req.user, 'products.delete') },
    });

    if (!product) {
      return res.status(404).json({ status: false, message: 'Product not found' });
    }

    await product.destroy();
    await removeImage(product.image, product.imagePublicId);

    res.status(200).json({ status: true, message: 'Product deleted' });
  } catch (error) {
    handleError(res, error);
  }
};