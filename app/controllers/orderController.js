import { Op } from 'sequelize';
import { sequelize } from '../config/connection.js';
import { Product, User, Order, OrderItem } from '../models/index.js';
import { handleError } from '../utils/handleError.js';

// A problem with the order itself (out of stock, bad card...) -> 400 with a clear message
class OrderError extends Error {}

const round = (n) => Math.round(n * 100) / 100;
const clean = (value) => (typeof value === 'string' ? value.trim() : '');

const STATUSES = ['pending', 'shipped', 'delivered', 'cancelled'];

// Which status can change to which
const NEXT_STATUS = {
  pending: ['shipped', 'cancelled'],
  shipped: ['delivered', 'cancelled'],
  delivered: [],
  cancelled: [],
};

const orderInclude = [
  { model: OrderItem, as: 'items' },
  { model: User, as: 'buyer', attributes: ['id', 'name', 'email'] },
  { model: User, as: 'seller', attributes: ['id', 'name'] },
];

// ----- Practice card payment -----
// No real money moves. We only check the card looks valid.
// Test cards: 4242 4242 4242 4242 works, 4000 0000 0000 0002 is declined.
const passesLuhn = (digits) => {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
};

const checkCard = (card = {}) => {
  const number = String(card.number || '').replace(/\D/g, '');
  const [mm, yy] = String(card.expiry || '').split('/').map((p) => parseInt(p, 10));
  const cvc = String(card.cvc || '');

  if (number.length < 13 || number.length > 19 || !passesLuhn(number)) {
    throw new OrderError('Card number is not valid');
  }
  if (!mm || !yy || mm < 1 || mm > 12) {
    throw new OrderError('Expiry must look like MM/YY');
  }
  // Card works until the end of its expiry month
  const expiresAt = new Date(2000 + yy, mm, 1);
  if (expiresAt <= new Date()) {
    throw new OrderError('This card has expired');
  }
  if (!/^\d{3,4}$/.test(cvc)) {
    throw new OrderError('CVC must be 3 or 4 digits');
  }
  if (number === '4000000000000002') {
    throw new OrderError('Card declined by the bank. Try another card.');
  }
  return number.slice(-4);
};

const checkAddress = (shipping = {}) => {
  const address = {
    fullName: clean(shipping.fullName),
    phone: clean(shipping.phone),
    address: clean(shipping.address),
    city: clean(shipping.city),
    postalCode: clean(shipping.postalCode),
  };
  if (address.fullName.length < 3) throw new OrderError('Enter the full name for delivery');
  if (!/^[0-9+\-\s]{10,15}$/.test(address.phone)) throw new OrderError('Enter a valid phone number');
  if (address.address.length < 5) throw new OrderError('Enter the street address');
  if (address.city.length < 2) throw new OrderError('Enter the city');

  // Optional map pin
  const lat = Number(shipping.latitude);
  const lng = Number(shipping.longitude);
  const hasPin = shipping.latitude != null && shipping.longitude != null
    && Number.isFinite(lat) && Number.isFinite(lng)
    && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

  return { ...address, latitude: hasPin ? lat : null, longitude: hasPin ? lng : null };
};

// Put stock back when an order is cancelled
const restock = async (orderId, t) => {
  const items = await OrderItem.findAll({ where: { orderId }, transaction: t });
  for (const item of items) {
    if (!item.productId) continue; // product was deleted
    await Product.increment('stock', { by: item.quantity, where: { id: item.productId }, transaction: t });
  }
};

// POST /api/orders
// body: { items: [{ productId, quantity }], shipping: {...}, paymentMethod: 'cod' | 'card',
//         card: { number, expiry, cvc }, note, saveAddress }
export const checkout = async (req, res) => {
  const { items, paymentMethod, card, saveAddress } = req.body;

  try {
    if (!Array.isArray(items) || items.length === 0) {
      throw new OrderError('Your cart is empty');
    }
    if (!['cod', 'card'].includes(paymentMethod)) {
      throw new OrderError('Choose cash on delivery or card');
    }

    // Add up quantities in case the same product was sent twice
    const wanted = new Map();
    for (const item of items) {
      const productId = Number(item.productId);
      const quantity = Number(item.quantity);
      if (!Number.isInteger(productId) || !Number.isInteger(quantity) || quantity < 1) {
        throw new OrderError('Each item needs a product and a quantity of at least 1');
      }
      wanted.set(productId, (wanted.get(productId) || 0) + quantity);
    }

    const shipping = checkAddress(req.body.shipping);
    const note = clean(req.body.note).slice(0, 300) || null;
    const cardLast4 = paymentMethod === 'card' ? checkCard(card) : null;

    // Everything inside happens together, or not at all
    const orderIds = await sequelize.transaction(async (t) => {
      // Lock the rows so two buyers can't buy the same last item
      const products = await Product.findAll({
        where: { id: [...wanted.keys()] },
        lock: t.LOCK.UPDATE,
        transaction: t,
      });
      if (products.length !== wanted.size) {
        throw new OrderError('Some products in your cart are no longer available');
      }

      const sellers = await User.findAll({
        where: { id: [...new Set(products.map((p) => p.userId))] },
        attributes: ['id', 'isBlocked'],
        transaction: t,
      });
      const blockedSellers = new Set(sellers.filter((s) => s.isBlocked).map((s) => s.id));

      // Group the lines by seller: one order per seller
      const bySeller = new Map();
      for (const product of products) {
        const quantity = wanted.get(product.id);

        if (product.userId === req.user.id) {
          throw new OrderError(`"${product.name}" is your own product. Sell it from the POS instead.`);
        }
        if (product.isBlocked || blockedSellers.has(product.userId)) {
          throw new OrderError(`"${product.name}" is not available anymore`);
        }
        if (product.stock < quantity) {
          throw new OrderError(
            product.stock === 0
              ? `"${product.name}" is out of stock`
              : `Only ${product.stock} left of "${product.name}"`
          );
        }

        product.stock -= quantity;
        await product.save({ fields: ['stock'], transaction: t });

        const lines = bySeller.get(product.userId) || [];
        lines.push({
          productId: product.id,
          name: product.name,
          image: product.image,
          price: product.price,
          quantity,
          lineTotal: round(product.price * quantity),
        });
        bySeller.set(product.userId, lines);
      }

      const ids = [];
      for (const [sellerId, lines] of bySeller) {
        const order = await Order.create({
          buyerId: req.user.id,
          sellerId,
          ...shipping,
          note,
          paymentMethod,
          paymentStatus: paymentMethod === 'card' ? 'paid' : 'unpaid',
          cardLast4,
          total: round(lines.reduce((sum, l) => sum + l.lineTotal, 0)),
          itemCount: lines.reduce((sum, l) => sum + l.quantity, 0),
        }, { transaction: t });

        await OrderItem.bulkCreate(lines.map((l) => ({ ...l, orderId: order.id })), { transaction: t });
        ids.push(order.id);
      }

      if (saveAddress) {
        const { latitude, longitude, ...address } = shipping;
        await User.update({ savedAddress: address }, { where: { id: req.user.id }, transaction: t });
      }

      return ids;
    });

    const orders = await Order.findAll({
      where: { id: orderIds },
      include: orderInclude,
      order: [['id', 'ASC']],
    });

    res.status(201).json({
      status: true,
      message: orders.length === 1 ? 'Order placed' : `${orders.length} orders placed`,
      data: orders,
    });
  } catch (error) {
    if (error instanceof OrderError) {
      return res.status(400).json({ status: false, message: error.message });
    }
    handleError(res, error);
  }
};

// Shared by "my orders" and "customer orders"
const listOrders = async (req, res, where) => {
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit) || 10, 1), 50);

  // Count per status, for the numbers on the filter tabs
  const countRows = await Order.findAll({
    where,
    attributes: ['status', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
    group: ['status'],
    raw: true,
  });
  const counts = { all: 0, pending: 0, shipped: 0, delivered: 0, cancelled: 0 };
  countRows.forEach((row) => {
    counts[row.status] = Number(row.count);
    counts.all += Number(row.count);
  });

  const filtered = { ...where };
  if (STATUSES.includes(req.query.status)) filtered.status = req.query.status;

  const { count, rows } = await Order.findAndCountAll({
    where: filtered,
    include: orderInclude,
    order: [['createdAt', 'DESC']],
    limit,
    offset: (page - 1) * limit,
    distinct: true,
  });

  res.status(200).json({
    status: true,
    data: rows,
    counts,
    pagination: { total: count, page, limit, totalPages: Math.max(Math.ceil(count / limit), 1) },
  });
};

// GET /api/orders/mine -> what I bought
export const getMyOrders = async (req, res) => {
  try {
    await listOrders(req, res, { buyerId: req.user.id });
  } catch (error) {
    handleError(res, error);
  }
};

// GET /api/orders/received -> orders for my products (staff with orders.view see all)
export const getReceivedOrders = async (req, res) => {
  try {
    const where = req.user.permissions.includes('orders.view') ? {} : { sellerId: req.user.id };
    await listOrders(req, res, where);
  } catch (error) {
    handleError(res, error);
  }
};

// GET /api/orders/address -> the address saved at the last checkout
export const getSavedAddress = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, { attributes: ['savedAddress'] });
    res.status(200).json({ status: true, data: user?.savedAddress || null });
  } catch (error) {
    handleError(res, error);
  }
};

// The buyer, the seller, or staff with orders.view may open an order
const findVisibleOrder = (req, options = {}) => {
  const where = { id: req.params.id };
  if (!req.user.permissions.includes('orders.view')) {
    where[Op.or] = [{ buyerId: req.user.id }, { sellerId: req.user.id }];
  }
  return Order.findOne({ where, include: orderInclude, ...options });
};

// GET /api/orders/:id
export const getOrderById = async (req, res) => {
  try {
    const order = await findVisibleOrder(req);
    if (!order) {
      return res.status(404).json({ status: false, message: 'Order not found' });
    }
    res.status(200).json({ status: true, data: order });
  } catch (error) {
    handleError(res, error);
  }
};

// PATCH /api/orders/:id/status  body: { status }
// The seller (or staff with orders.manage) moves the order along
export const updateOrderStatus = async (req, res) => {
  const { status } = req.body;

  try {
    const order = await sequelize.transaction(async (t) => {
      const found = await Order.findOne({
        where: { id: req.params.id },
        lock: t.LOCK.UPDATE,
        transaction: t,
      });

      const allowed = found
        && (found.sellerId === req.user.id || req.user.permissions.includes('orders.manage'));
      if (!allowed) {
        // Same answer as "doesn't exist", so nobody can guess other people's orders
        throw new OrderError('NOT_FOUND');
      }

      if (!NEXT_STATUS[found.status].includes(status)) {
        throw new OrderError(`A ${found.status} order can't be marked as ${status || 'that'}`);
      }

      if (status === 'cancelled') {
        await restock(found.id, t);
        if (found.paymentStatus === 'paid') found.paymentStatus = 'refunded';
      }
      // Cash on delivery is paid when the parcel arrives
      if (status === 'delivered' && found.paymentMethod === 'cod') {
        found.paymentStatus = 'paid';
      }

      found.status = status;
      await found.save({ transaction: t });
      return found;
    });

    const fresh = await Order.findByPk(order.id, { include: orderInclude });
    res.status(200).json({ status: true, message: `Order marked as ${status}`, data: fresh });
  } catch (error) {
    if (error instanceof OrderError) {
      return error.message === 'NOT_FOUND'
        ? res.status(404).json({ status: false, message: 'Order not found' })
        : res.status(400).json({ status: false, message: error.message });
    }
    handleError(res, error);
  }
};

// PATCH /api/orders/:id/cancel -> the buyer cancels before it ships
export const cancelMyOrder = async (req, res) => {
  try {
    const order = await sequelize.transaction(async (t) => {
      const found = await Order.findOne({
        where: { id: req.params.id, buyerId: req.user.id },
        lock: t.LOCK.UPDATE,
        transaction: t,
      });
      if (!found) throw new OrderError('NOT_FOUND');
      if (found.status !== 'pending') {
        throw new OrderError('This order has already shipped, so it can no longer be cancelled');
      }

      await restock(found.id, t);
      found.status = 'cancelled';
      if (found.paymentStatus === 'paid') found.paymentStatus = 'refunded';
      await found.save({ transaction: t });
      return found;
    });

    const fresh = await Order.findByPk(order.id, { include: orderInclude });
    res.status(200).json({ status: true, message: 'Order cancelled', data: fresh });
  } catch (error) {
    if (error instanceof OrderError) {
      return error.message === 'NOT_FOUND'
        ? res.status(404).json({ status: false, message: 'Order not found' })
        : res.status(400).json({ status: false, message: error.message });
    }
    handleError(res, error);
  }
};