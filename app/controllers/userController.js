import { sequelize } from '../config/connection.js';
import User from '../models/user.js';
import Product from '../models/product.js';
import { handleError } from '../utils/handleError.js';

// Sirf admin: saare users aur un ke products ki ginti
export const getUsers = async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: { exclude: ['password'] },
      order: [['id', 'ASC']],
    });

    const counts = await Product.findAll({
      attributes: ['userId', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
      group: ['userId'],
      raw: true,
    });

    const countMap = {};
    counts.forEach((c) => {
      countMap[c.userId] = Number(c.count);
    });

    const data = users.map((u) => ({
      ...u.toJSON(),
      productCount: countMap[u.id] || 0,
    }));

    res.status(200).json({ status: true, count: data.length, data });
  } catch (error) {
    handleError(res, error);
  }
};