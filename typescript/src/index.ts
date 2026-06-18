import express from 'express';
import cors from 'cors';
import { connectDatabase } from './database'; // Επαναφορά της έτοιμης σύνδεσης
import { seedData } from './seed';             // Επαναφορά του seeding (αν χρειάζεται)
import authRoutes from './routes/auth';
import productRoutes from './routes/products';
import orderRoutes from './routes/orders';     // Το νέο σου route
import userRoutes from './routes/users';
import alertRoutes from './routes/alerts';
import analyticsRoutes from './routes/analytics';   // Το νέο σου route
import config from './config';                 // Χρήση του έτοιμου config για το port

const app = express();

// Διατήρηση της δικής σου διόρθωσης ασφαλείας (Explicit string origins αντί για Regex)
const corsOrigins = ['https://app.sgarden.com', 'https://admin.sgarden.com'];

app.use(cors({ origin: corsOrigins }));
app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
  return res.json({ status: 'ok' });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/users', userRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/analytics', analyticsRoutes);

// Διατήρηση της δικής σου σωστής υλοποίησης για το Legacy (410 Gone)
app.use('/api/legacy', (req, res) => {
  return res.status(410).json({ message: "Legacy endpoint deprecated." });
});

// Global error handler
app.use((err: Error, req: express.Request, res: express.Response) => {
  console.error(err);
  return res.status(500).json({ message: err.message });
});

// Async εκκίνηση της βάσης και του server
async function start(): Promise<void> {
  try {
    await connectDatabase(); // Αυτό θα τυπώσει το "Connected to MongoDB" (λογικά βρίσκεται εκεί μέσα το log)
    await seedData();        // Πετάει τα αρχικά δεδομένα αν η βάση είναι άδεια
    
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