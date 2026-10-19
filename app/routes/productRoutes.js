import express from 'express';
import { createProduct, getProducts, getProductById, updateProduct, deleteProduct } from '../controllers/productController.js';
import { getProductImages, addProductImages, deleteProductImage, MAX_EXTRA_IMAGES } from '../controllers/productImageController.js';
import { protect } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';

const router = express.Router();
router.use(protect);
router.post('/', upload.single('image'), createProduct);
router.get('/', getProducts);
router.get('/:id', getProductById);
router.put('/:id', upload.single('image'), updateProduct);
router.delete('/:id', deleteProduct);

// Extra photos (gallery)
router.get('/:id/images', getProductImages);
router.post('/:id/images', upload.array('images', MAX_EXTRA_IMAGES), addProductImages);
router.delete('/:id/images/:imageId', deleteProductImage);

export default router;