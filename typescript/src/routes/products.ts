import { Router, Request, Response, NextFunction } from 'express';
import { Product } from '../models/Product';
import { productService } from '../services/productService';
import { authenticate, AuthRequest } from '../middleware/jwt';

const router = Router();

interface IProduct {
  _id?: string | { toString(): string };
  id?: string;
  name: string;
  description: string;
  category: string;
  price: number;
  stock: number;
  createdAt?: Date;
  updatedAt?: Date;
}

// Format database product entities safely
const formatProduct = (p: IProduct) => ({
  id: p._id ? p._id.toString() : (p.id || ''),
  name: p.name || '',
  description: p.description || '',
  category: p.category || '',
  price: Number(p.price) || 0,
  stock: Number(p.stock) || 0,
  createdAt: p.createdAt,
  updatedAt: p.updatedAt,
});

// Validation helper for product input fields to reduce complexity
function validateProductInput(body: Record<string, unknown>, isUpdate: boolean): Record<string, string> {
  const errors: Record<string, string> = {};
  const validCategories = ['Electronics', 'Accessories', 'Storage', 'Networking'];

  // Validate name field
  if (!isUpdate || body.name !== undefined) {
    if (!body.name || typeof body.name !== 'string' || body.name.trim() === '') {
      errors.name = 'Name is required and must be a non-empty string.';
    }
  }

  // Validate price field
  if (!isUpdate || body.price !== undefined) {
    const priceNum = Number(body.price);
    if (body.price === undefined || body.price === null || isNaN(priceNum) || priceNum <= 0) {
      errors.price = 'Price must be a positive number greater than zero.';
    }
  }

  // Validate category field
  if (!isUpdate || body.category !== undefined) {
    const catStr = body.category ? String(body.category).trim() : '';
    if (!catStr || !validCategories.includes(catStr)) {
      errors.category = 'Category must be one of: Electronics, Accessories, Storage, Networking.';
    }
  }

  return errors;
}

// Helper to filter array items based on query variables
function applyProductFilters(list: IProduct[], q: string, cat: string, min?: number, max?: number): IProduct[] {
  let result = [...list];
  if (q) {
    result = result.filter((p) => 
      (p.name && p.name.toLowerCase().includes(q)) || 
      (p.description && p.description.toLowerCase().includes(q))
    );
  }
  if (cat) result = result.filter((p) => p.category === cat);
  if (min !== undefined && !isNaN(min)) result = result.filter((p) => p.price >= min);
  if (max !== undefined && !isNaN(max)) result = result.filter((p) => p.price <= max);
  return result;
}

// Helper to handle safe array sorting directions
function sortProductList(list: IProduct[], field: string, orderDirection: number): IProduct[] {
  const sorted = [...list];
  if (field === 'price') return sorted.sort((a, b) => (a.price - b.price) * orderDirection);
  if (field === 'name') {
    return sorted.sort((a, b) => {
      const nameA = (a.name || '').toLowerCase().trim();
      const nameB = (b.name || '').toLowerCase().trim();
      return nameA.localeCompare(nameB) * orderDirection;
    });
  }
  return sorted;
}

// === Mission 2: Product Statistics Endpoint ===
router.get('/stats', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const allProducts = await productService.getAllProducts() as unknown as IProduct[];
    const totalCount = allProducts.length;

    if (totalCount === 0) {
      return res.json({ totalCount: 0, averagePrice: 0, minPrice: 0, maxPrice: 0, categoryCount: {} });
    }

    let sumPrice = 0;
    let minPrice = Number(allProducts[0].price) || 0;
    let maxPrice = Number(allProducts[0].price) || 0;
    const categoryCount: Record<string, number> = {};

    allProducts.forEach((p: IProduct) => {
      const price = Number(p.price) || 0;
      sumPrice += price;
      minPrice = price < minPrice ? price : minPrice;
      maxPrice = price > maxPrice ? price : maxPrice;
      
      const catName = String(p.category || '').trim();
      if (catName) categoryCount[catName] = (categoryCount[catName] || 0) + 1;
    });

    return res.json({ totalCount, averagePrice: Math.round((sumPrice / totalCount) * 100) / 100, minPrice, maxPrice, categoryCount });
  } catch (error) { return next(error); }
});

// === Mission 1: Product Search & Filter Endpoint ===
router.get('/search', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = req.query.q ? String(req.query.q).toLowerCase().trim() : '';
    const cat = req.query.category ? String(req.query.category).trim() : '';
    const min = req.query.minPrice ? parseFloat(String(req.query.minPrice)) : undefined;
    const max = req.query.maxPrice ? parseFloat(String(req.query.maxPrice)) : undefined;
    
    const rawList = await productService.getAllProducts() as unknown as IProduct[];
    const list = Array.isArray(rawList) ? rawList : [];

    const filtered = applyProductFilters(list, q, cat, min, max);
    return res.json(filtered.map((p: IProduct) => formatProduct(p)));
  } catch (error) { return next(error); }
});

// === Mission 3: Pagination & Sorting Endpoint ===
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rawPage = parseInt(String(req.query.page), 10);
    const rawLimit = parseInt(String(req.query.limit), 10);
    const page = !isNaN(rawPage) && rawPage > 0 ? rawPage : 1;
    const limit = !isNaN(rawLimit) && rawLimit > 0 ? rawLimit : 10;

    const sortField = req.query.sort ? String(req.query.sort).trim() : '';
    const order = String(req.query.order).toLowerCase().trim() === 'desc' ? -1 : 1;

    const allProducts = await productService.getAllProducts() as unknown as IProduct[];
    const total = allProducts ? allProducts.length : 0;
    const list = allProducts ? [...allProducts] : [];

    const sortedList = sortProductList(list, sortField, order);
    const startIndex = (page - 1) * limit;
    const paginatedProducts = sortedList.slice(startIndex, startIndex + limit);

    return res.json({ data: paginatedProducts.map((p: IProduct) => formatProduct(p)), page, limit, total });
  } catch (error) { return next(error); }
});

// === Core CRUD Operation Fallbacks & Validation ===
router.get('/:id', async (req: Request, res: Response) => {
  const product = await productService.getProductById(req.params.id);
  return product ? res.json(product) : res.status(404).json({ message: 'Product not found' });
});

router.post('/', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = req.body as Record<string, unknown>;
    const errors = validateProductInput(body, false);
    if (Object.keys(errors).length > 0) {
      return res.status(400).json({ message: 'Validation failed', errors });
    }
    const product = await productService.createProduct(req.body);
    return res.status(201).json(product);
  } catch (error) { return next(error); }
});

router.put('/:id', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = req.body as Record<string, unknown>;
    const errors = validateProductInput(body, true);
    if (Object.keys(errors).length > 0) {
      return res.status(400).json({ message: 'Validation failed', errors });
    }
    const product = await productService.updateProduct(req.params.id, req.body);
    return product ? res.json(product) : res.status(404).json({ message: 'Product not found' });
  } catch (error) { return next(error); }
});

router.delete('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  const deleted = await productService.deleteProduct(req.params.id);
  return deleted ? res.json({ message: 'Product deleted' }) : res.status(404).json({ message: 'Product not found' });
});

router.get('/summary/:productId', async (req: Request, res: Response) => {
  const p = await Product.findById(req.params.productId);
  return p ? res.json(formatProduct(p as unknown as IProduct)) : res.status(404).json({ message: 'Product not found' });
});

router.get('/card/:productId', async (req: Request, res: Response) => {
  const p = await Product.findById(req.params.productId);
  return p ? res.json(formatProduct(p as unknown as IProduct)) : res.status(404).json({ message: 'Product not found' });
});

router.post('/:productId/discount', authenticate, async (req: AuthRequest, res: Response) => {
  const p = await Product.findById(req.params.productId);
  if (!p) return res.status(404).json({ message: 'Product not found' });
  const { discountPercent } = req.body;
  if (discountPercent == null || discountPercent < 0 || discountPercent > 100) {
    return res.status(400).json({ message: 'discountPercent must be between 0 and 100' });
  }
  p.price = Math.round((p.price! * (1 - discountPercent / 100)) * 100) / 100;
  await p.save();
  return res.json({ message: 'Discount applied', newPrice: p.price });
});

router.post('/:productId/restock', authenticate, async (req: AuthRequest, res: Response) => {
  const p = await Product.findById(req.params.productId);
  if (!p) return res.status(404).json({ message: 'Product not found' });
  const { quantity } = req.body;
  if (quantity == null || quantity <= 0) return res.status(400).json({ message: 'quantity must be greater than zero' });
  p.stock += quantity;
  await p.save();
  return res.json({ message: 'Restock applied', newStock: p.stock });
});

export default router;