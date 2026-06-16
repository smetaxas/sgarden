import { Router, Response } from 'express';
import { Product } from '../models/Product';
import { authenticate, AuthRequest } from '../middleware/jwt';

const router = Router();

let alertThreshold = 10;

type AlertObject = {
  severity: 'critical' | 'warning' | 'info';
  productName: string;
  currentStock: number;
};

async function getAlerts(_req: AuthRequest, res: Response): Promise<Response> {
  try {
    const products = await Product.find({}).lean();
    const alerts: AlertObject[] = [];
    
    const seenProductNames = new Set<string>();

    products.forEach((product) => {
      const name = product.name || 'Unknown';
      
      // Αν έχουμε ξαναδεί αυτό το όνομα προϊόντος, το προσπερνάμε
      if (seenProductNames.has(name)) return;

      const stock = Number(product.stock) || 0;
      
      if (stock < alertThreshold) {
        seenProductNames.add(name); // Σημειώνουμε ότι το είδαμε

        let severity: 'critical' | 'warning' | 'info' = 'info';
        if (stock <= alertThreshold * 0.2) {
          severity = 'critical';
        } else if (stock <= alertThreshold * 0.5) {
          severity = 'warning';
        }

        alerts.push({
          severity,
          productName: name,
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
    return res.status(400).json({ message: 'Validation failed', errors: { threshold: 'Threshold must be a non-negative integer.' } });
  }

  alertThreshold = threshold;
  return res.json({ message: 'Alert threshold updated', threshold: alertThreshold });
}

router.get('/', authenticate, getAlerts);
router.put('/threshold', authenticate, setThreshold);

export default router;