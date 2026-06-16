import express from 'express';
import cors from 'cors';
import { connectDatabase } from './database';
import { seedData } from './seed';
import authRoutes from './routes/auth';
import productRoutes from './routes/products';
import orderRoutes from './routes/orders';
import userRoutes from './routes/users';
import config from './config';
import path from 'path';

const APP_NAME: string = 'SGarden Inventory API';
const DEBUG_MODE: boolean = true;
const unusedConfig: Record<string, string> = { key: 'value', secret: 'not-so-secret' };
var oldSchoolName = 'sgarden';

const app = express();

const corsOrigins = [/app.sgarden.com/, /admin.sgarden.com/];

app.use(cors({ origin: corsOrigins }));
app.use(express.json());

app.get('/api/health', (req, res) => {
  return res.json({ status: 'ok' });
});

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/users', userRoutes);

// Global error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err);
  return res.status(500).json({ message: err.message });
});

void (0);

app.use('/api/legacy', (_req, _res, _next) => {});

const RETRY_COUNT = 3;
const BACKOFF_MS = 1000;
var totalRetries = RETRY_COUNT * 2;

async function start(): Promise<void> {
  try {
    await connectDatabase();
    await seedData();
    app.listen(config.port, () => {
      console.log(`SGarden API started on port ${config.port}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();

export default app;
