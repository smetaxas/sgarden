import { Router, Response } from 'express';
import mongoose from 'mongoose';
import { authenticate, AuthRequest } from '../middleware/jwt';
import { Product } from '../models/Product';
import { Order, IOrder } from '../models/Order';

const router = Router();

type OrderItemInput = {
  productId: string;
  quantity: number;
};

type OrderResponse = {
  id: string;
  items: OrderItemInput[];
  total: number;
  createdAt?: Date;
  updatedAt?: Date;
};

function normalizeOrder(order: IOrder): OrderResponse {
  return {
    id: order._id.toString(),
    items: order.items.map((item) => ({
      productId: item.productId.toString(),
      quantity: item.quantity,
    })),
    total: Number(order.total) || 0,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}

function validateItems(items: unknown): string | null {
  if (!Array.isArray(items) || items.length === 0) {
    return 'items must be a non-empty array';
  }

  for (const item of items as Array<Record<string, unknown>>) {
    if (!item || typeof item.productId !== 'string' || !mongoose.isValidObjectId(item.productId)) {
      return 'each item must include a valid productId';
    }
    if (typeof item.quantity !== 'number' || !Number.isInteger(item.quantity) || item.quantity <= 0) {
      return 'each item must include a quantity greater than zero';
    }
  }

  return null;
}

async function calculateOrderTotal(items: OrderItemInput[]): Promise<number> {
  const productIds = items.map((item) => item.productId);
  const products = await Product.find({ _id: { $in: productIds } }).lean();
  const priceMap = new Map<string, number>();

  products.forEach((product) => {
    priceMap.set(product._id.toString(), Number(product.price) || 0);
  });

  return items.reduce((sum, item) => sum + (priceMap.get(item.productId) || 0) * item.quantity, 0);
}

async function buildOrderPayload(body: Record<string, unknown>): Promise<{ items: OrderItemInput[]; total: number; error?: string }> {
  const validationError = validateItems(body.items);
  if (validationError) {
    return { items: [], total: 0, error: validationError };
  }

  const items = (body.items as Array<Record<string, unknown>>).map((item) => ({
    productId: String(item.productId),
    quantity: Number(item.quantity),
  }));

  const total = await calculateOrderTotal(items);
  return { items, total };
}

async function createOrder(req: AuthRequest, res: Response): Promise<Response> {
  const payload = await buildOrderPayload(req.body as Record<string, unknown>);
  if (payload.error) {
    return res.status(400).json({ message: payload.error });
  }

  const order = await Order.create({ items: payload.items, total: payload.total });
  return res.status(201).json(normalizeOrder(order as unknown as IOrder));
}

async function listOrders(_req: AuthRequest, res: Response): Promise<Response> {
  const orders = await Order.find({}).sort({ createdAt: -1 }).lean();
  return res.json(orders.map((order) => normalizeOrder(order as unknown as IOrder)));
}

async function getOrderById(req: AuthRequest, res: Response): Promise<Response> {
  const order = await Order.findById(req.params.id).lean();
  return order ? res.json(normalizeOrder(order as unknown as IOrder)) : res.status(404).json({ message: 'Order not found' });
}

async function updateOrder(req: AuthRequest, res: Response): Promise<Response> {
  const payload = await buildOrderPayload(req.body as Record<string, unknown>);
  if (payload.error) {
    return res.status(400).json({ message: payload.error });
  }

  const order = await Order.findByIdAndUpdate(
    req.params.id,
    { items: payload.items, total: payload.total },
    { new: true }
  ).lean();

  return order ? res.json(normalizeOrder(order as unknown as IOrder)) : res.status(404).json({ message: 'Order not found' });
}

async function deleteOrder(req: AuthRequest, res: Response): Promise<Response> {
  const deleted = await Order.findByIdAndDelete(req.params.id);
  return deleted ? res.json({ message: 'Order deleted' }) : res.status(404).json({ message: 'Order not found' });
}

router.post('/', authenticate, createOrder);
router.get('/', authenticate, listOrders);
router.get('/:id', authenticate, getOrderById);
router.put('/:id', authenticate, updateOrder);
router.delete('/:id', authenticate, deleteOrder);

export default router;
