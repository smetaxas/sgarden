import { Router, Request, Response } from 'express';
import { Product } from '../models/Product';
import {
  buildSearchQuery,
  formatProduct,
  getProductByIdDoc,
  IProductDoc,
  parseOptionalNumber,
  parsePositiveInt,
} from './products.shared';

const router = Router();

async function getProductsStats(_req: Request, res: Response): Promise<Response> {
  try {
    const products = await Product.find({}).lean() as unknown as IProductDoc[];
    if (products.length === 0) {
      return res.json({ totalCount: 0, averagePrice: 0, minPrice: 0, maxPrice: 0, categoryCount: {} });
    }

    let sumPrice = 0, minPrice = Number(products[0].price) || 0, maxPrice = Number(products[0].price) || 0;
    const categoryCount: Record<string, number> = {};

    products.forEach((p) => {
      const price = Number(p.price) || 0;
      sumPrice += price;
      minPrice = price < minPrice ? price : minPrice;
      maxPrice = price > maxPrice ? price : maxPrice;
      const cat = String(p.category || '').trim() || 'Uncategorized';
      categoryCount[cat] = (categoryCount[cat] || 0) + 1;
    });

    return res.json({
      totalCount: products.length,
      averagePrice: Math.round((sumPrice / products.length) * 100) / 100,
      minPrice,
      maxPrice,
      categoryCount,
    });
  } catch (_e) {
    return res.status(500).json({ message: 'Error' });
  }
}

async function getProductsSearch(req: Request, res: Response): Promise<Response> {
  try {
    const q = req.query.q ? String(req.query.q).trim() : '';
    const cat = req.query.category ? String(req.query.category).trim() : '';
    const min = parseOptionalNumber(req.query.minPrice);
    const max = parseOptionalNumber(req.query.maxPrice);

    const products = await Product.find(buildSearchQuery(q, cat, min, max)).lean() as unknown as IProductDoc[];
    return res.json(products.map((p) => formatProduct(p)));
  } catch (_e) {
    return res.status(500).json({ message: 'Error' });
  }
}

async function getProductsList(req: Request, res: Response): Promise<Response> {
  try {
    const page = parsePositiveInt(req.query.page, 1);
    const limit = parsePositiveInt(req.query.limit, 10);
    const sortField = req.query.sort ? String(req.query.sort).trim() : '';
    const order = String(req.query.order).toLowerCase().trim() === 'desc' ? -1 : 1;

    const sortObj: { [key: string]: 1 | -1 } = {};
    if (sortField === 'price' || sortField === 'name') {
      sortObj[sortField] = order;
    } else {
      sortObj._id = 1;
    }

    const total = await Product.countDocuments({});
    const products = await Product.find({}).sort(sortObj).skip((page - 1) * limit).limit(limit).lean() as unknown as IProductDoc[];
    return res.json({ data: products.map((p) => formatProduct(p)), page, limit, total });
  } catch (_e) {
    return res.status(500).json({ message: 'Error' });
  }
}

async function getProductById(req: Request, res: Response): Promise<Response> {
  const product = await getProductByIdDoc(req.params.id);
  return product ? res.json(formatProduct(product)) : res.status(404).json({ message: 'Product not found' });
}

router.get('/stats', getProductsStats);
router.get('/search', getProductsSearch);
router.get('/', getProductsList);
router.get('/:id', getProductById);

export default router;
