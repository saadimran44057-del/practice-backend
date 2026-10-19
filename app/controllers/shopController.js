import { Op, fn, col } from 'sequelize';
import { Product, ProductImage, User, Review, Order, OrderItem } from '../models/index.js';
import { handleError } from '../utils/handleError.js';

// Products anyone can buy: not blocked, and the seller isn't blocked
const sellerInclude = {
  model: User,
  attributes: ['id', 'name', 'avatar'],
  where: { isBlocked: false },
  required: true,
};

const SORTS = {
  newest: [['createdAt', 'DESC']],
  price_asc: [['price', 'ASC']],
  price_desc: [['price', 'DESC']],
  rating: [['ratingAvg', 'DESC'], ['ratingCount', 'DESC']],
};

// Has this user received this product in a delivered order?
const hasBought = async (userId, productId) => {
  const count = await OrderItem.count({
    where: { productId },
    include: [{ model: Order, where: { buyerId: userId, status: 'delivered' }, required: true }],
  });
  return count > 0;
};

// Work out the average again after a review is added, changed or removed
const refreshRating = async (productId) => {
  const stats = await Review.findOne({
    where: { productId },
    attributes: [
      [fn('AVG', col('rating')), 'avg'],
      [fn('COUNT', col('id')), 'count'],
    ],
    raw: true,
  });
  const ratingAvg = stats.avg ? Math.round(Number(stats.avg) * 10) / 10 : 0;
  const ratingCount = Number(stats.count) || 0;
  await Product.update({ ratingAvg, ratingCount }, { where: { id: productId } });
  return { ratingAvg, ratingCount };
};

// GET /api/shop/products?search=&sort=newest&page=1
export const getShopProducts = async (req, res) => {
  try {
    const { search = '', sort = 'newest' } = req.query;
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 12, 1), 48);

    const where = { isBlocked: false };
    if (search) where.name = { [Op.iLike]: `%${search}%` };

    const { count, rows } = await Product.findAndCountAll({
      where,
      include: [sellerInclude],
      attributes: { exclude: ['imagePublicId', 'isBlocked'] },
      order: SORTS[sort] || SORTS.newest,
      limit,
      offset: (page - 1) * limit,
    });

    res.status(200).json({
      status: true,
      data: rows,
      pagination: { total: count, page, limit, totalPages: Math.max(Math.ceil(count / limit), 1) },
    });
  } catch (error) {
    handleError(res, error);
  }
};

// GET /api/shop/products/:id  -> product, all photos, seller, reviews
export const getShopProduct = async (req, res) => {
  try {
    const product = await Product.findOne({
      where: { id: req.params.id, isBlocked: false },
      include: [
        sellerInclude,
        { model: ProductImage, as: 'images', attributes: ['id', 'url'] },
      ],
      attributes: { exclude: ['imagePublicId', 'isBlocked'] },
      order: [[{ model: ProductImage, as: 'images' }, 'id', 'ASC']],
    });

    if (!product) {
      return res.status(404).json({ status: false, message: 'Product not found' });
    }

    const [reviews, breakdownRows, myReview, bought] = await Promise.all([
      Review.findAll({
        where: { productId: product.id },
        include: [{ model: User, attributes: ['id', 'name', 'avatar'] }],
        order: [['updatedAt', 'DESC']],
        limit: 30,
      }),
      // How many 5 star, 4 star... reviews
      Review.findAll({
        where: { productId: product.id },
        attributes: ['rating', [fn('COUNT', col('id')), 'count']],
        group: ['rating'],
        raw: true,
      }),
      Review.findOne({ where: { productId: product.id, userId: req.user.id } }),
      hasBought(req.user.id, product.id),
    ]);

    const breakdown = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    breakdownRows.forEach((row) => { breakdown[row.rating] = Number(row.count); });

    res.status(200).json({
      status: true,
      data: {
        product,
        reviews,
        breakdown,
        myReview,
        canReview: bought && product.userId !== req.user.id,
      },
    });
  } catch (error) {
    handleError(res, error);
  }
};

// POST /api/shop/products/:id/reviews  body: { rating, comment }
// Writing again updates your earlier review
export const saveReview = async (req, res) => {
  try {
    const product = await Product.findOne({ where: { id: req.params.id, isBlocked: false } });
    if (!product) {
      return res.status(404).json({ status: false, message: 'Product not found' });
    }
    if (product.userId === req.user.id) {
      return res.status(403).json({ status: false, message: "You can't review your own product" });
    }
    if (!(await hasBought(req.user.id, product.id))) {
      return res.status(403).json({ status: false, message: 'You can review this after your order is delivered' });
    }

    const rating = Number(req.body.rating);
    const comment = typeof req.body.comment === 'string' ? req.body.comment.trim() : '';

    let review = await Review.findOne({ where: { productId: product.id, userId: req.user.id } });
    const isNew = !review;
    if (review) {
      review.set({ rating, comment });
    } else {
      review = Review.build({ productId: product.id, userId: req.user.id, rating, comment });
    }
    await review.save();

    const stats = await refreshRating(product.id);

    res.status(isNew ? 201 : 200).json({
      status: true,
      message: isNew ? 'Review posted' : 'Review updated',
      data: review,
      stats,
    });
  } catch (error) {
    handleError(res, error);
  }
};

// DELETE /api/shop/products/:id/reviews  -> remove my review
export const deleteReview = async (req, res) => {
  try {
    const review = await Review.findOne({ where: { productId: req.params.id, userId: req.user.id } });
    if (!review) {
      return res.status(404).json({ status: false, message: 'Review not found' });
    }
    await review.destroy();
    const stats = await refreshRating(req.params.id);
    res.status(200).json({ status: true, message: 'Review deleted', stats });
  } catch (error) {
    handleError(res, error);
  }
};