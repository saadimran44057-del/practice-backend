import express from 'express';
import { getShopProducts, getShopProduct, saveReview, deleteReview } from '../controllers/shopController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();
router.use(protect);

// Browse everyone's products
router.get('/products', getShopProducts);
router.get('/products/:id', getShopProduct);

// Reviews (only after the order is delivered)
router.post('/products/:id/reviews', saveReview);
router.delete('/products/:id/reviews', deleteReview);

export default router;