import { Router, Request, Response } from 'express';
import { Product } from '../models/Product';
import { authenticate, AuthRequest } from '../middleware/jwt';
import { formatProduct, getProductByIdDoc } from './products.shared';

const router = Router();

async function getProductSummary(req: Request, res: Response): Promise<Response> {
  const product = await getProductByIdDoc(req.params.productId);
  return product ? res.json(formatProduct(product)) : res.status(404).json({ message: 'Product not found' });
}

async function getProductCard(req: Request, res: Response): Promise<Response> {
  const product = await getProductByIdDoc(req.params.productId);
  return product ? res.json(formatProduct(product)) : res.status(404).json({ message: 'Product not found' });
}

async function applyDiscount(req: AuthRequest, res: Response): Promise<Response> {
  const product = await Product.findById(req.params.productId);
  if (!product) return res.status(404).json({ message: 'Product not found' });
  const { discountPercent } = req.body;
  if (discountPercent == null || discountPercent < 0 || discountPercent > 100) return res.status(400).json({ message: 'Error' });
  product.price = Math.round((product.price! * (1 - discountPercent / 100)) * 100) / 100;
  await product.save();
  return res.json({ message: 'Discount applied', newPrice: product.price });
}

async function restockProduct(req: AuthRequest, res: Response): Promise<Response> {
  const product = await Product.findById(req.params.productId);
  if (!product) return res.status(404).json({ message: 'Product not found' });
  const { quantity } = req.body;
  if (quantity == null || quantity <= 0) return res.status(400).json({ message: 'Error' });
  product.stock += quantity;
  await product.save();
  return res.json({ message: 'Restock applied', newStock: product.stock });
}

router.get('/summary/:productId', getProductSummary);
router.get('/card/:productId', getProductCard);
router.post('/:productId/discount', authenticate, applyDiscount);
router.post('/:productId/restock', authenticate, restockProduct);

export default router;
