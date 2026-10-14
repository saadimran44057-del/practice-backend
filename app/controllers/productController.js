import { Op } from 'sequelize';
import Product from '../models/product.js';
import { handleError } from '../utils/handleError.js';
import { deleteFile } from '../utils/deleteFile.js';

const imagePath = (file) => (file ? `/uploads/${file.filename}` : null);

// CREATE
export const createProduct = async (req, res) => {
  try {
    const userId = req.user.id;

    if (Array.isArray(req.body)) {
      const items = req.body.map((item) => ({ ...item, userId }));
      const products = await Product.bulkCreate(items, { validate: true });
      return res.status(201).json({ status: true, count: products.length, data: products });
    }

    const product = await Product.create({
      ...req.body,
      userId,
      image: imagePath(req.file),
    });

    res.status(201).json({ status: true, data: product });
  } catch (error) {
    if (req.file) deleteFile(imagePath(req.file));
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

    const where = { userId: req.user.id };

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

    const { count, rows } = await Product.findAndCountAll({
      where,
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
      where: { id: req.params.id, userId: req.user.id },
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
      where: { id: req.params.id, userId: req.user.id },
    });

    if (!product) {
      if (req.file) deleteFile(imagePath(req.file));
      return res.status(404).json({ status: false, message: 'Product not found' });
    }

    const { userId, id, image, ...data } = req.body;

    const oldImage = product.image;
    if (req.file) {
      data.image = imagePath(req.file);
    }

    await product.update(data);

    if (req.file && oldImage) deleteFile(oldImage);

    res.status(200).json({ status: true, message: 'Product updated', data: product });
  } catch (error) {
    if (req.file) deleteFile(imagePath(req.file));
    handleError(res, error);
  }
};

// DELETE
export const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findOne({
      where: { id: req.params.id, userId: req.user.id },
    });

    if (!product) {
      return res.status(404).json({ status: false, message: 'Product not found' });
    }

    await product.destroy();
    deleteFile(product.image);

    res.status(200).json({ status: true, message: 'Product deleted' });
  } catch (error) {
    handleError(res, error);
  }
};