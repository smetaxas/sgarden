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

const formatProduct = (p: IProduct) => ({
  id: p._id ? p._id.toString() : p.id,
  name: p.name,
  description: p.description,
  category: p.category,
  price: p.price,
  stock: p.stock,
  createdAt: p.createdAt,
  updatedAt: p.updatedAt,
});

function filterProductsList(products: IProduct[], q?: string, cat?: string, min?: number, max?: number): IProduct[] {
  let list = [...products];
  if (q && q.trim() !== '') {
    const s = q.toLowerCase().trim();
    list = list.filter((p) => (p.name && p.name.toLowerCase().includes(s)) || (p.description && p.description.toLowerCase().includes(s)));
  }
  if (cat && cat.trim() !== '') list = list.filter((p) => p.category === cat.trim());
  if (min !== undefined && !isNaN(min)) list = list.filter((p) => p.price >= min);
  if (max !== undefined && !isNaN(max)) list = list.filter((p) => p.price <= max);
  return list;
}

// M2: Stats Endpoint
router.get('/stats', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const allProducts = await productService.getAllProducts() as unknown as IProduct[];
    const totalCount = allProducts.length;
    if (totalCount === 0) return res.json({ totalCount: 0, averagePrice: 0, minPrice: 0, maxPrice: 0, categoryCount: {} });
    let sumPrice = 0, minPrice = allProducts[0].price, maxPrice = allProducts[0].price;
    const categoryCount: Record<string, number> = {};
    allProducts.forEach((p: IProduct) => {
      const price = p.price || 0;
      sumPrice += price;
      if (price < minPrice) minPrice = price;
      if (price > maxPrice) maxPrice = price;
      if (p.category) categoryCount[p.category] = (categoryCount[p.category] || 0) + 1;
    });
    return res.json({ totalCount, averagePrice: Math.round((sumPrice / totalCount) * 100) / 100, minPrice, maxPrice, categoryCount });
  } catch (error) { return next(error); }
});

// M1: Search Endpoint
router.get('/search', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = req.query.q as string;
    const cat = req.query.category as string;
    const min = req.query.minPrice ? parseFloat(String(req.query.minPrice)) : undefined;
    const max = req.query.maxPrice ? parseFloat(String(req.query.maxPrice)) : undefined;
    const all = await productService.getAllProducts() as unknown as IProduct[];
    const filtered = filterProductsList(all, q, cat, min, max);
    return res.json(filtered.map((p: IProduct) => formatProduct(p)));
  } catch (error) { return next(error); }
});

// M3: Pagination & Sorting Endpoint
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;
    const sortField = req.query.sort as string;
    const order = req.query.order as string === 'desc' ? -1 : 1;
    const allProducts = await productService.getAllProducts() as unknown as IProduct[];
    const total = allProducts.length;
    let sortedList = [...allProducts];
    if (sortField === 'price' || sortField === 'name') {
      sortedList.sort((a, b) => {
        const valA = sortField === 'price' ? a.price : (a.name || '').toLowerCase();
        const valB = sortField === 'price' ? b.price : (b.name || '').toLowerCase();
        if (valA < valB) return -1 * order;
        if (valA > valB) return 1 * order;
        return 0;
      });
    }
    const startIndex = (page - 1) * limit;
    const paginatedProducts = sortedList.slice(startIndex, startIndex + limit);
    return res.json({ data: paginatedProducts.map((p: IProduct) => formatProduct(p)), page, limit, total });
  } catch (error) { return next(error); }
});

// CRUD Endpoints
router.get('/:id', async (req: Request, res: Response) => {
  const product = await productService.getProductById(req.params.id);
  return product ? res.json(product) : res.status(404).json({ message: 'Product not found' });
});

router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  const product = await productService.createProduct(req.body);
  return res.status(201).json(product);
});

router.put('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  const product = await productService.updateProduct(req.params.id, req.body);
  return product ? res.json(product) : res.status(404).json({ message: 'Product not found' });
});

router.delete('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  const deleted = await productService.deleteProduct(req.params.id);
  return deleted ? res.json({ message: 'Product deleted' }) : res.status(404).json({ message: 'Product not found' });
});

router.get('/summary/:productId', async (req: Request, res: Response) => {
  const p = await Product.findById(req.params.productId);
  return p ? res.json({ id: p._id, name: p.name, description: p.description, category: p.category, price: p.price, stock: p.stock, createdAt: p.createdAt, updatedAt: p.updatedAt }) : res.status(404).json({ message: 'Product not found' });
});

router.get('/card/:productId', async (req: Request, res: Response) => {
  const p = await Product.findById(req.params.productId);
  return p ? res.json({ id: p._id, name: p.name, description: p.description, category: p.category, price: p.price, stock: p.stock, createdAt: p.createdAt, updatedAt: p.updatedAt }) : res.status(404).json({ message: 'Product not found' });
});

router.post('/:productId/discount', authenticate, async (req: AuthRequest, res: Response) => {
  const p = await Product.findById(req.params.productId);
  if (!p) return res.status(404).json({ message: 'Product not found' });
  const { discountPercent } = req.body;
  if (discountPercent == null || discountPercent < 0 || discountPercent > 100) return res.status(400).json({ message: 'discountPercent must be between 0 and 100' });
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