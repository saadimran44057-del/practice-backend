import { Op } from 'sequelize';
import { sequelize } from '../config/connection.js';
import { Product, Sale, SaleItem, User } from '../models/index.js';
import { handleError } from '../utils/handleError.js';

// A problem with the sale itself (not enough stock, etc.) -> 400 with a clear message
class SaleError extends Error {}

const round = (n) => Math.round(n * 100) / 100;

// Staff with sales.view see every seller's sales, everyone else only their own
const scopeFor = (user) => (user.permissions.includes('sales.view') ? {} : { userId: user.id });

// ?range=today | 7d | 30d | all
const rangeStart = (range) => {
  const now = new Date();
  if (range === 'today') return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (range === '7d') return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  if (range === '30d') return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  return null;
};

// POST /api/sales
// body: { items: [{ productId, quantity }], paymentMethod: 'cash' | 'card', cashReceived }
export const createSale = async (req, res) => {
  const { items, paymentMethod = 'cash', cashReceived } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ status: false, message: 'Add at least one product to the sale' });
  }
  if (!['cash', 'card'].includes(paymentMethod)) {
    return res.status(400).json({ status: false, message: 'Payment must be cash or card' });
  }

  // Add up quantities in case the same product was sent twice
  const wanted = new Map();
  for (const item of items) {
    const productId = Number(item.productId);
    const quantity = Number(item.quantity);
    if (!Number.isInteger(productId) || !Number.isInteger(quantity) || quantity < 1) {
      return res.status(400).json({ status: false, message: 'Each item needs a product and a quantity of at least 1' });
    }
    wanted.set(productId, (wanted.get(productId) || 0) + quantity);
  }

  try {
    // Everything inside happens together, or not at all
    const saleId = await sequelize.transaction(async (t) => {
      // Lock these rows so two sales can't sell the same last item at once
      const products = await Product.findAll({
        where: { id: [...wanted.keys()], userId: req.user.id },
        lock: t.LOCK.UPDATE,
        transaction: t,
      });

      if (products.length !== wanted.size) {
        throw new SaleError('Some products are not in your store anymore. Refresh and try again.');
      }

      let total = 0;
      let itemCount = 0;
      const lines = [];

      for (const product of products) {
        const quantity = wanted.get(product.id);

        if (product.isBlocked) {
          throw new SaleError(`"${product.name}" is blocked and can't be sold`);
        }
        if (product.stock < quantity) {
          throw new SaleError(
            product.stock === 0
              ? `"${product.name}" is out of stock`
              : `Only ${product.stock} left of "${product.name}"`
          );
        }

        const lineTotal = round(product.price * quantity);
        total += lineTotal;
        itemCount += quantity;
        lines.push({ productId: product.id, name: product.name, price: product.price, quantity, lineTotal });

        // Take it out of stock
        product.stock -= quantity;
        await product.save({ fields: ['stock'], transaction: t });
      }

      total = round(total);

      let received = null;
      if (paymentMethod === 'cash' && cashReceived !== undefined && cashReceived !== null && cashReceived !== '') {
        received = Number(cashReceived);
        if (!Number.isFinite(received) || received < total) {
          throw new SaleError('Cash received is less than the total');
        }
      }

      const sale = await Sale.create(
        { userId: req.user.id, total, itemCount, paymentMethod, cashReceived: received },
        { transaction: t }
      );
      await SaleItem.bulkCreate(
        lines.map((line) => ({ ...line, saleId: sale.id })),
        { transaction: t }
      );

      return sale.id;
    });

    const sale = await Sale.findByPk(saleId, { include: [{ model: SaleItem, as: 'items' }] });
    res.status(201).json({ status: true, message: 'Sale completed', data: sale });
  } catch (error) {
    if (error instanceof SaleError) {
      return res.status(400).json({ status: false, message: error.message });
    }
    handleError(res, error);
  }
};

// GET /api/sales?range=today&page=1
export const getSales = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 10, 1), 50);
    const offset = (page - 1) * limit;

    const where = { ...scopeFor(req.user) };
    const since = rangeStart(req.query.range);
    if (since) where.createdAt = { [Op.gte]: since };

    const seeAll = req.user.permissions.includes('sales.view');

    const { count, rows } = await Sale.findAndCountAll({
      where,
      include: [
        { model: SaleItem, as: 'items' },
        ...(seeAll ? [{ model: User, attributes: ['id', 'name'] }] : []),
      ],
      order: [['createdAt', 'DESC']],
      limit,
      offset,
      distinct: true,
    });

    // Totals for the same range, for the numbers at the top of the page
    const [revenue, itemsSold] = await Promise.all([
      Sale.sum('total', { where }),
      Sale.sum('itemCount', { where }),
    ]);

    res.status(200).json({
      status: true,
      data: rows,
      summary: { revenue: round(revenue || 0), salesCount: count, itemsSold: itemsSold || 0 },
      pagination: { total: count, page, limit, totalPages: Math.max(Math.ceil(count / limit), 1) },
    });
  } catch (error) {
    handleError(res, error);
  }
};

// GET /api/sales/:id
export const getSaleById = async (req, res) => {
  try {
    const sale = await Sale.findOne({
      where: { id: req.params.id, ...scopeFor(req.user) },
      include: [{ model: SaleItem, as: 'items' }],
    });
    if (!sale) {
      return res.status(404).json({ status: false, message: 'Sale not found' });
    }
    res.status(200).json({ status: true, data: sale });
  } catch (error) {
    handleError(res, error);
  }
};