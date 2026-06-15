import { Router, Request, Response, NextFunction } from 'express';
import { Product } from '../models/Product';
import { productService } from '../services/productService';
import { authenticate, AuthRequest } from '../middleware/jwt';

const router = Router();

// 1. Καθαρό interface χωρίς κανένα 'any'
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

// 2. Χρήση του IProduct ως τύπο παραμέτρου
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

// === ΝΕΟ ENDPOINT: Αναζήτηση & Φιλτράρισμα Προϊόντων ===
router.get('/search', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = req.query.q as string;
    const category = req.query.category as string;
    const minPrice = req.query.minPrice ? parseFloat(req.query.minPrice as string) : undefined;
    const maxPrice = req.query.maxPrice ? parseFloat(req.query.maxPrice as string) : undefined;

    const allProducts = await productService.getAllProducts() as unknown as IProduct[];
    let filteredProducts = [...allProducts];

    if (q) {
      const searchQuery = q.toLowerCase();
      filteredProducts = filteredProducts.filter((product: IProduct) => {
        const nameMatch = product.name ? product.name.toLowerCase().includes(searchQuery) : false;
        const descMatch = product.description ? product.description.toLowerCase().includes(searchQuery) : false;
        return nameMatch || descMatch;
      });
    }

    if (category) {
      filteredProducts = filteredProducts.filter((product: IProduct) => product.category === category);
    }

    if (minPrice !== undefined && !isNaN(minPrice)) {
      filteredProducts = filteredProducts.filter((product: IProduct) => product.price >= minPrice);
    }

    if (maxPrice !== undefined && !isNaN(maxPrice)) {
      filteredProducts = filteredProducts.filter((product: IProduct) => product.price <= maxPrice);
    }

    const formattedResults = filteredProducts.map((product: IProduct) => formatProduct(product));
    return res.json(formattedResults);
  } catch (error) {
    // Χρησιμοποιούμε το next(error) για να μην παραμένει unused το error
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