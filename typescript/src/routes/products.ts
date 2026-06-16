import { Router } from 'express';
import publicRoutes from './products.public';
import mutationRoutes from './products.mutations';
import actionRoutes from './products.actions';

const router = Router();

router.use(actionRoutes);
router.use(mutationRoutes);
router.use(publicRoutes);

export default router;
