import express from 'express';
import {
  createProduct,
  getProducts,
  getProductById,
  updateProduct,
  deleteProduct,
} from '../controllers/productController.js';
import { protect } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';

const router = express.Router();

router.use(protect);

router.post('/', upload.single('image'), createProduct);
router.get('/', getProducts);
router.get('/:id', getProductById);
router.put('/:id', upload.single('image'), updateProduct);
router.delete('/:id', deleteProduct);

export default router;