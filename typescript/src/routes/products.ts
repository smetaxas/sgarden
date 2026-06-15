import { Router, Request, Response, NextFunction } from 'express';
import { Product } from '../models/Product';
import { productService } from '../services/productService';
import { authenticate, AuthRequest } from '../middleware/jwt';

const router = Router();

// 1. Strict Interface χωρίς κανένα 'any'
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

// 2. Συνάρτηση μορφοποίησης (id αντί για _id)
function formatProduct(product: IProduct) {
  return {
    id: product._id ? product._id.toString() : product.id,
    name: product.name,
    description: product.description,
    category: product.category,
    price: product.price,
    stock: product.stock,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
}

// 3. Απομονωμένη helper συνάρτηση φιλτραρίσματος (για χαμηλή πολυπλοκότητα)
function filterProductsList(products: IProduct[], q?: string, category?: string, minPrice?: number, maxPrice?: number): IProduct[] {
  let list = [...products];

  if (q && q.trim() !== '') {
    const search = q.toLowerCase().trim();
    list = list.filter((p) => (p.name && p.name.toLowerCase().includes(search)) || (p.description && p.description.toLowerCase().includes(search)));
  }

  if (category && category.trim() !== '') {
    list = list.filter((p) => p.category === category.trim());
  }

  if (minPrice !== undefined && !isNaN(minPrice)) {
    list = list.filter((p) => p.price >= minPrice);
  }

  if (maxPrice !== undefined && !isNaN(maxPrice)) {
    list = list.filter((p) => p.price <= maxPrice);
  }

  return list;
}

// === ΝΕΟ ENDPOINT: Αναζήτηση & Φιλτράρισμα Προϊόντων ===
// Τοποθετείται ΠΡΙΝ από το /:id για να μην μπερδεύεται το Express
router.get('/search', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = req.query.q as string;
    const category = req.query.category as string;
    
    const minPrice = req.query.minPrice ? parseFloat(String(req.query.minPrice)) : undefined;
    const maxPrice = req.query.maxPrice ? parseFloat(String(req.query.maxPrice)) : undefined;

    const allProducts = await productService.getAllProducts() as unknown as IProduct[];
    
    // Εκτέλεση φιλτραρίσματος μέσω της helper function
    const filteredProducts = filterProductsList(allProducts, q, category, minPrice, maxPrice);

    const formattedResults = filteredProducts.map((product: IProduct) => formatProduct(product));
    return res.json(formattedResults);
  } catch (error) {
    return next(error);
  }
});

// === ΥΠΑΡΧΟΝΤΑ ROUTES ===

router.get('/', async (_req: Request, res: Response) => {
  const products = await productService.getAllProducts();
  return res.json(products);
});

router.get('/:id', async (req: Request, res: Response) => {
  const product = await productService.getProductById(req.params.id);
  if (!product) {
    return res.status(404).json({ message: 'Product not found' });
  }
  return res.json(product);
});

router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  const product = await productService.createProduct(req.body);
  return res.status(201).json(product);
});

router.put('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  const product = await productService.updateProduct(req.params.id, req.body);
  if (!product) {
    return res.status(404).json({ message: 'Product not found' });
  }
  return res.json(product);
});

router.delete('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  const deleted = await productService.deleteProduct(req.params.id);
  if (!deleted) {
    return res.status(404).json({ message: 'Product not found' });
  }
  return res.json({ message: 'Product deleted' });
});

router.get('/summary/:productId', async (req: Request, res: Response) => {
  const product = await Product.findById(req.params.productId);
  if (!product) {
    return res.status(404).json({ message: 'Product not found' });
  }
  return res.json({
    id: product._id,
    name: product.name,
    description: product.description,
    category: product.category,
    price: product.price,
    stock: product.stock,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  });
});

router.get('/card/:productId', async (req: Request, res: Response) => {
  const product = await Product.findById(req.params.productId);
  if (!product) {
    return res.status(404).json({ message: 'Product not found' });
  }
  return res.json({
    id: product._id,
    name: product.name,
    description: product.description,
    category: product.category,
    price: product.price,
    stock: product.stock,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  });
});

router.post('/:productId/discount', authenticate, async (req: AuthRequest, res: Response) => {
  const product = await Product.findById(req.params.productId);
  if (!product) {
    return res.status(404).json({ message: 'Product not found' });
  }
  const { discountPercent } = req.body;
  if (discountPercent == null || discountPercent < 0 || discountPercent > 100) {
    return res.status(400).json({ message: 'discountPercent must be between 0 and 100' });
  }
  const discounted = product.price! * (1 - discountPercent / 100);
  product.price = Math.round(discounted * 100) / 100;
  
  await product.save();
  return res.json({ message: 'Discount applied', newPrice: product.price });
});

router.post('/:productId/restock', authenticate, async (req: AuthRequest, res: Response) => {
  const product = await Product.findById(req.params.productId);
  if (!product) {
    return res.status(404).json({ message: 'Product not found' });
  }
  const { quantity } = req.body;
  if (quantity == null || quantity <= 0) {
    return res.status(400).json({ message: 'quantity must be greater than zero' });
  }
  product.stock += quantity;
  await product.save();
  return res.json({ message: 'Restock applied', newStock: product.stock });
});

export default router;