import Product from '../models/product.js';
import { Op } from 'sequelize';         

const handleError = (res, error) => {
    if (error.name === 'SequelizeValidationError') {
      const messages = error.errors.map((e) => e.message);
      return res.status(400).json({ status: false, errors: messages });
    }
    res.status(500).json({ status: false, message: error.message });
  };
// CREATE
export const createProduct = async (req, res) => {
  try {
    const product = await Product.create(req.body);
    res.status(201).json({ status: true, data: product });
  } catch (error) {
    handleError(res, error);  }
};

// READ ALL
export const getProducts = async (req, res) => {
    try {
      // 1. URL se values nikalo (na hon to default)
      const {
        search = '',
        minPrice,
        maxPrice,
        sortBy = 'createdAt',
        order = 'DESC',
      } = req.query;
  
      const page = Math.max(parseInt(req.query.page) || 1, 1);
      const limit = Math.min(Math.max(parseInt(req.query.limit) || 10, 1), 50);
      const offset = (page - 1) * limit;
  
      // 2. Conditions banao
      const where = {};
  
      if (search) {
        where.name = { [Op.iLike]: `%${search}%` };
      }
  
      if (minPrice || maxPrice) {
        where.price = {};
        if (minPrice) where.price[Op.gte] = Number(minPrice);
        if (maxPrice) where.price[Op.lte] = Number(maxPrice);
      }
  
      // 3. Sorting sirf allowed columns par
      const allowedSort = ['name', 'price', 'createdAt'];
      const sortField = allowedSort.includes(sortBy) ? sortBy : 'createdAt';
      const sortOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
  
      // 4. Query chalao: data bhi aur total count bhi
      const { count, rows } = await Product.findAndCountAll({
        where,
        order: [[sortField, sortOrder]],
        limit,
        offset,
      });
  
      // 5. Response
      res.status(200).json({
        status: true,
        data: rows,
        pagination: {
          total: count,
          page,
          limit,
          totalPages: Math.ceil(count / limit),
        },
      });
    } catch (error) {
      handleError(res, error);
    }
  };

// READ ONE
export const getProductById = async (req, res) => {
  try {
    const product = await Product.findByPk(req.params.id);
    if (!product) {
      return res.status(404).json({ status: false, message: 'Product not found' });
    }
    res.status(200).json({ status: true, data: product });
  } catch (error) {
    handleError(res, error);  }
};

// UPDATE
export const updateProduct = async (req, res) => {
  try {
    const [updated] = await Product.update(req.body, { where: { id: req.params.id } });
    if (updated === 0) {
      return res.status(404).json({ status: false, message: 'Product not found' });
    }
    res.status(200).json({ status: true, message: 'Product updated' });
  } catch (error) {
    handleError(res, error);  }
};

// DELETE
export const deleteProduct = async (req, res) => {
  try {
    const deleted = await Product.destroy({ where: { id: req.params.id } });
    if (deleted === 0) {
      return res.status(404).json({ status: false, message: 'Product not found' });
    }
    res.status(200).json({ status: true, message: 'Product deleted' });
  } catch (error) {
    handleError(res, error);  }
};