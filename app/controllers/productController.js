import { Op } from 'sequelize';
import Product from '../models/product.js';
import User from '../models/user.js';
import { handleError } from '../utils/handleError.js';
import { deleteFile } from '../utils/deleteFile.js';
import { uploadImage, deleteImage } from '../config/cloudinary.js';

// Admin ko sab, user ko sirf apne
const ownerFilter = (user) => (user.role === 'admin' ? {} : { userId: user.id });

// Purani image hatao: Cloudinary wali ho to wahan se, purani local ho to folder se
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

    const { id, image, imagePublicId, ...data } = req.body;
    const product = Product.build({ ...data, userId });

    // Pehle validation, taake ghalat data par image upload hi na ho
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

    const where = { ...ownerFilter(req.user) };

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

    const include = req.user.role === 'admin'
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
      where: { id: req.params.id, ...ownerFilter(req.user) },
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
      where: { id: req.params.id, ...ownerFilter(req.user) },
    });

    if (!product) {
      return res.status(404).json({ status: false, message: 'Product not found' });
    }

    const { userId, id, image, imagePublicId, ...data } = req.body;
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

    // Nayi image save ho gayi, ab purani hatao
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
      where: { id: req.params.id, ...ownerFilter(req.user) },
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