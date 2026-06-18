import { Router, Response } from 'express';
import { Product } from '../models/Product';
import { Config } from '../models/Config';
import { authenticate, AuthRequest } from '../middleware/jwt';

const router = Router();

const DEFAULT_THRESHOLD = 10;
const THRESHOLD_KEY = 'alertThreshold';

async function getThreshold(): Promise<number> {
  const config = await Config.findOne({ key: THRESHOLD_KEY });
  return config ? config.value : DEFAULT_THRESHOLD;
}

type AlertObject = {
  severity: 'critical' | 'warning' | 'info';
  productName: string;
  currentStock: number;
};

async function getAlerts(_req: AuthRequest, res: Response): Promise<Response> {
  try {
    const alertThreshold = await getThreshold();
    const products = await Product.find({}).lean();
    const alerts: AlertObject[] = [];

    products.forEach((product) => {
      const stock = Number(product.stock) || 0;

      if (stock < alertThreshold) {
        let severity: 'critical' | 'warning' | 'info' = 'info';
        if (stock <= alertThreshold * 0.2) {
          severity = 'critical';
        } else if (stock <= alertThreshold * 0.5) {
          severity = 'warning';
        }

        alerts.push({
          severity,
          productName: product.name || 'Unknown',
          currentStock: stock,
        });
      }
    });

    return res.json(alerts);
  } catch (_e) {
    return res.status(500).json({ message: 'Error' });
  }
}

async function setThreshold(req: AuthRequest, res: Response): Promise<Response> {
  const threshold = Number((req.body as Record<string, unknown>).threshold);

  if (!Number.isInteger(threshold) || threshold < 0) {
    return res.status(400).json({
      message: 'Validation failed',
      errors: { threshold: 'Threshold must be a non-negative integer.' },
    });
  }

  await Config.findOneAndUpdate(
    { key: THRESHOLD_KEY },
    { value: threshold },
    { upsert: true, new: true }
  );

  return res.json({ message: 'Alert threshold updated', threshold });
}

router.get('/', authenticate, getAlerts);
router.put('/threshold', authenticate, setThreshold);

export default router;