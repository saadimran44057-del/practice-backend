import express from 'express';
import {
  checkout,
  getMyOrders,
  getReceivedOrders,
  getSavedAddress,
  getOrderById,
  updateOrderStatus,
  cancelMyOrder,
} from '../controllers/orderController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();
router.use(protect);

router.post('/', checkout);
router.get('/mine', getMyOrders);
router.get('/received', getReceivedOrders);
router.get('/address', getSavedAddress);
router.get('/:id', getOrderById);
router.patch('/:id/status', updateOrderStatus);
router.patch('/:id/cancel', cancelMyOrder);

export default router;