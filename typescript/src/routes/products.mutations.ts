import { Router, Response } from 'express';
import { Product } from '../models/Product';
import { authenticate, AuthRequest } from '../middleware/jwt';
import { formatProduct, IProductDoc, validateProductInput } from './products.shared';

const router = Router();

async function createProduct(req: AuthRequest, res: Response): Promise<Response> {
  const errors = validateProductInput(req.body as Record<string, unknown>, false);
  if (Object.keys(errors).length > 0) {
    return res.status(400).json({ message: 'Validation failed', errors });
  }

  const product = await Product.create(req.body);
  return res.status(201).json(formatProduct(product as unknown as IProductDoc));
}

async function updateProduct(req: AuthRequest, res: Response): Promise<Response> {
  const errors = validateProductInput(req.body as Record<string, unknown>, true);
  if (Object.keys(errors).length > 0) {
    return res.status(400).json({ message: 'Validation failed', errors });
  }

  const product = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true }).lean() as unknown as IProductDoc | null;
  return product ? res.json(formatProduct(product)) : res.status(404).json({ message: 'Product not found' });
}

async function deleteProduct(req: AuthRequest, res: Response): Promise<Response> {
  const deleted = await Product.findByIdAndDelete(req.params.id);
  return deleted ? res.json({ message: 'Product deleted' }) : res.status(404).json({ message: 'Product not found' });
}

router.post('/', authenticate, createProduct);
router.put('/:id', authenticate, updateProduct);
router.delete('/:id', authenticate, deleteProduct);

export default router;
