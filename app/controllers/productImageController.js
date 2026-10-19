import { Product, ProductImage } from '../models/index.js';
import { handleError } from '../utils/handleError.js';
import { uploadImage, deleteImage } from '../config/cloudinary.js';

// Main photo + up to 4 more = 5 photos per product
export const MAX_EXTRA_IMAGES = 4;

// The owner can change photos of their own product, staff with products.edit any product
const findEditableProduct = (req) => {
  const where = { id: req.params.id };
  if (!req.user.permissions.includes('products.edit')) where.userId = req.user.id;
  return Product.findOne({ where });
};

// GET /api/products/:id/images -> the extra photos, for the edit form
export const getProductImages = async (req, res) => {
  try {
    const product = await findEditableProduct(req);
    if (!product) {
      return res.status(404).json({ status: false, message: 'Product not found' });
    }
    const images = await ProductImage.findAll({
      where: { productId: product.id },
      attributes: ['id', 'url'],
      order: [['id', 'ASC']],
    });
    res.status(200).json({ status: true, data: images });
  } catch (error) {
    handleError(res, error);
  }
};

// POST /api/products/:id/images  (form-data, field "images", up to 4 files)
export const addProductImages = async (req, res) => {
  try {
    const product = await findEditableProduct(req);
    if (!product) {
      return res.status(404).json({ status: false, message: 'Product not found' });
    }
    if (product.isBlocked && !req.user.permissions.includes('products.edit')) {
      return res.status(403).json({ status: false, message: 'This product was blocked by an admin and cannot be edited' });
    }

    const files = req.files || [];
    if (files.length === 0) {
      return res.status(400).json({ status: false, message: 'Choose at least one photo' });
    }

    const existing = await ProductImage.count({ where: { productId: product.id } });
    if (existing + files.length > MAX_EXTRA_IMAGES) {
      const left = MAX_EXTRA_IMAGES - existing;
      return res.status(400).json({
        status: false,
        message: left > 0 ? `You can add ${left} more photo${left === 1 ? '' : 's'}` : 'This product already has the most photos allowed',
      });
    }

    const created = [];
    for (const file of files) {
      const uploaded = await uploadImage(file.buffer);
      created.push(await ProductImage.create({
        productId: product.id,
        url: uploaded.url,
        publicId: uploaded.publicId,
      }));
    }

    res.status(201).json({ status: true, message: 'Photos added', data: created });
  } catch (error) {
    handleError(res, error);
  }
};

// DELETE /api/products/:id/images/:imageId
export const deleteProductImage = async (req, res) => {
  try {
    const product = await findEditableProduct(req);
    if (!product) {
      return res.status(404).json({ status: false, message: 'Product not found' });
    }

    const image = await ProductImage.findOne({
      where: { id: req.params.imageId, productId: product.id },
    });
    if (!image) {
      return res.status(404).json({ status: false, message: 'Photo not found' });
    }

    await image.destroy();
    await deleteImage(image.publicId);

    res.status(200).json({ status: true, message: 'Photo removed' });
  } catch (error) {
    handleError(res, error);
  }
};