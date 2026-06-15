import { Router, Request, Response } from 'express';
import { FilterQuery } from 'mongoose';
import { Product } from '../models/Product';
import { authenticate, AuthRequest } from '../middleware/jwt';

const router = Router();

interface IProductDoc {
  _id: { toString(): string };
  name?: string;
  description?: string;
  category?: string;
  price?: number;
  stock?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

const formatProduct = (p: IProductDoc) => ({
  id: p._id ? p._id.toString() : '',
  name: p.name || '',
  description: p.description || '',
  category: p.category || '',
  price: Number(p.price) || 0,
  stock: Number(p.stock) || 0,
  createdAt: p.createdAt,
  updatedAt: p.updatedAt,
});

// Tiny isolated validators to crush cyclomatic complexity
function checkName(name: unknown): string | null {
  if (name === undefined || typeof name !== 'string' || name.trim() === '') {
    return 'Name is required and must be a non-empty string.';
  }
  return null;
}

function checkPrice(price: unknown): string | null {
  const pNum = Number(price);
  if (price === undefined || price === null || isNaN(pNum) || pNum <= 0) {
    return 'Price must be a positive number greater than zero.';
  }
  return null;
}

function checkCategory(cat: unknown): string | null {
  const valid = ['Electronics', 'Accessories', 'Storage', 'Networking'];
  const cStr = cat ? String(cat).trim() : '';
  if (!cStr || !valid.includes(cStr)) {
    return 'Category must be one of the specified pre-defined values.';
  }
  return null;
}

// Flat main validation mapping function
function validateProductInput(body: Record<string, unknown>, isUpdate: boolean): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!isUpdate || body.name !== undefined) {
    const err = checkName(body.name);
    if (err) errors.name = err;
  }
  if (!isUpdate || body.price !== undefined) {
    const err = checkPrice(body.price);
    if (err) errors.price = err;
  }
  if (!isUpdate || body.category !== undefined) {
    const err = checkCategory(body.category);
    if (err) errors.category = err;
  }

  return errors;
}

function buildSearchQuery(q: string, category: string, min?: number, max?: number): FilterQuery<unknown> {
  const query: FilterQuery<unknown> = {};
  if (q) {
    query.$or = [{ name: { $regex: q, $options: 'i' } }, { description: { $regex: q, $options: 'i' } }];
  }
  if (category) query.category = category;
  if (min !== undefined || max !== undefined) {
    const priceCond: Record<string, number> = {};
    if (min !== undefined && !isNaN(min)) priceCond.$gte = min;
    if (max !== undefined && !isNaN(max)) priceCond.$lte = max;
    query.price = priceCond;
  }
  return query;
}

// === API Routes ===
router.get('/stats', async (_req: Request, res: Response) => {
  try {
    const products = await Product.find({}).lean() as unknown as IProductDoc[];
    if (products.length === 0) return res.json({ totalCount: 0, averagePrice: 0, minPrice: 0, maxPrice: 0, categoryCount: {} });

    let sumPrice = 0, minPrice = Number(products[0].price) || 0, maxPrice = Number(products[0].price) || 0;
    const categoryCount: Record<string, number> = {};

    products.forEach((p) => {
      const price = Number(p.price) || 0;
      sumPrice += price;
      minPrice = price < minPrice ? price : minPrice;
      maxPrice = price > maxPrice ? price : maxPrice;
      const cat = String(p.category || '').trim();
      if (cat) categoryCount[cat] = (categoryCount[cat] || 0) + 1;
    });

    return res.json({ totalCount: products.length, averagePrice: Math.round((sumPrice / products.length) * 100) / 100, minPrice, maxPrice, categoryCount });
  } catch (e) { return res.status(500).json({ message: 'Error' }); }
});

router.get('/search', async (req: Request, res: Response) => {
  try {
    const q = req.query.q ? String(req.query.q).trim() : '';
    const cat = req.query.category ? String(req.query.category).trim() : '';
    const min = req.query.minPrice ? parseFloat(String(req.query.minPrice)) : undefined;
    const max = req.query.maxPrice ? parseFloat(String(req.query.maxPrice)) : undefined;

    const products = await Product.find(buildSearchQuery(q, cat, min, max)).lean() as unknown as IProductDoc[];
    return res.json(products.map(p => formatProduct(p)));
  } catch (e) { return res.status(500).json({ message: 'Error' }); }
});

router.get('/', async (req: Request, res: Response) => {
  try {
    const rPage = parseInt(String(req.query.page), 10);
    const rLimit = parseInt(String(req.query.limit), 10);
    const page = !isNaN(rPage) && rPage > 0 ? rPage : 1;
    const limit = !isNaN(rLimit) && rLimit > 0 ? rLimit : 10;
    const sortField = req.query.sort ? String(req.query.sort).trim() : '';
    const order = String(req.query.order).toLowerCase().trim() === 'desc' ? -1 : 1;

    const sortObj: { [key: string]: 1 | -1 } = {};
    if (sortField === 'price' || sortField === 'name') sortObj[sortField] = order;

    const total = await Product.countDocuments({});
    const products = await Product.find({}).sort(sortObj).skip((page - 1) * limit).limit(limit).lean() as unknown as IProductDoc[];
    return res.json({ data: products.map(p => formatProduct(p)), page, limit, total });
  } catch (e) { return res.status(500).json({ message: 'Error' }); }
});

router.get('/:id', async (req: Request, res: Response) => {
  const p = await Product.findById(req.params.id).lean() as unknown as IProductDoc | null;
  return p ? res.json(formatProduct(p)) : res.status(404).json({ message: 'Product not found' });
});

router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  const errors = validateProductInput(req.body as Record<string, unknown>, false);
  if (Object.keys(errors).length > 0) return res.status(400).json({ message: 'Validation failed', errors });
  const product = await Product.create(req.body);
  return res.status(201).json(product);
});

router.put('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  const errors = validateProductInput(req.body as Record<string, unknown>, true);
  if (Object.keys(errors).length > 0) return res.status(400).json({ message: 'Validation failed', errors });
  const p = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true }).lean() as unknown as IProductDoc | null;
  return p ? res.json(formatProduct(p)) : res.status(404).json({ message: 'Product not found' });
});

router.delete('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  const deleted = await Product.findByIdAndDelete(req.params.id);
  return deleted ? res.json({ message: 'Product deleted' }) : res.status(404).json({ message: 'Product not found' });
});

router.get('/summary/:productId', async (req: Request, res: Response) => {
  const p = await Product.findById(req.params.productId).lean() as unknown as IProductDoc | null;
  return p ? res.json(formatProduct(p)) : res.status(404).json({ message: 'Product not found' });
});

router.get('/card/:productId', async (req: Request, res: Response) => {
  const p = await Product.findById(req.params.productId).lean() as unknown as IProductDoc | null;
  return p ? res.json(formatProduct(p)) : res.status(404).json({ message: 'Product not found' });
});

router.post('/:productId/discount', authenticate, async (req: AuthRequest, res: Response) => {
  const p = await Product.findById(req.params.productId);
  if (!p) return res.status(404).json({ message: 'Product not found' });
  const { discountPercent } = req.body;
  if (discountPercent == null || discountPercent < 0 || discountPercent > 100) return res.status(400).json({ message: 'Error' });
  p.price = Math.round((p.price! * (1 - discountPercent / 100)) * 100) / 100;
  await p.save();
  return res.json({ message: 'Discount applied', newPrice: p.price });
});

router.post('/:productId/restock', authenticate, async (req: AuthRequest, res: Response) => {
  const p = await Product.findById(req.params.productId);
  if (!p) return res.status(404).json({ message: 'Product not found' });
  const { quantity } = req.body;
  if (quantity == null || quantity <= 0) return res.status(400).json({ message: 'Error' });
  p.stock += quantity;
  await p.save();
  return res.json({ message: 'Restock applied', newStock: p.stock });
});

export default router;