import express from 'express';
import { createSale, getSales, getSaleById } from '../controllers/saleController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Every logged-in user has their own POS and sales history
router.use(protect);

router.post('/', createSale);
router.get('/', getSales);
router.get('/:id', getSaleById);

export default router;