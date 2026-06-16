import { FilterQuery } from 'mongoose';
import { Product } from '../models/Product';

export interface IProductDoc {
  _id: { toString(): string };
  name?: string;
  description?: string;
  category?: string;
  price?: number;
  stock?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export const PRODUCT_CATEGORIES = ['Electronics', 'Accessories', 'Storage', 'Networking'];

export const formatProduct = (p: IProductDoc) => ({
  id: p._id ? p._id.toString() : '',
  name: p.name || '',
  description: p.description || '',
  category: p.category || '',
  price: Number(p.price) || 0,
  stock: Number(p.stock) || 0,
  createdAt: p.createdAt,
  updatedAt: p.updatedAt,
});

export function checkName(name: unknown): string | null {
  if (name === undefined || typeof name !== 'string' || name.trim() === '') {
    return 'Name is required and must be a non-empty string.';
  }
  return null;
}

export function checkPrice(price: unknown): string | null {
  const pNum = Number(price);
  if (price === undefined || price === null || isNaN(pNum) || pNum <= 0) {
    return 'Price must be a positive number greater than zero.';
  }
  return null;
}

export function checkCategory(cat: unknown): string | null {
  const cStr = cat ? String(cat).trim() : '';
  if (!cStr || !PRODUCT_CATEGORIES.includes(cStr)) {
    return 'Category must be one of the specified pre-defined values.';
  }
  return null;
}

export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function parseOptionalNumber(value: unknown): number | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  const parsed = Number(String(value).trim());
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function parsePositiveInt(value: unknown, fallback: number): number {
  const parsed = parseInt(String(value), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function validateProductInput(body: Record<string, unknown>, isUpdate: boolean): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!isUpdate || body.name !== undefined) {
    const err = checkName(body.name);
    if (err) errors.name = err;
  }

  if (!isUpdate || body.price !== undefined) {
    const err = checkPrice(body.price);
    if (err) errors.price = err;
  }

  if (!isUpdate || body.category !== undefined) {
    const err = checkCategory(body.category);
    if (err) errors.category = err;
  }

  return errors;
}

export function buildSearchQuery(q: string, category: string, min?: number, max?: number): FilterQuery<unknown> {
  const query: FilterQuery<unknown> = {};

  if (q) {
    const pattern = escapeRegex(q);
    query.$or = [
      { name: { $regex: pattern, $options: 'i' } },
      { description: { $regex: pattern, $options: 'i' } },
    ];
  }

  if (category) query.category = category;

  if (min !== undefined || max !== undefined) {
    const priceCond: Record<string, number> = {};
    if (min !== undefined) priceCond.$gte = min;
    if (max !== undefined) priceCond.$lte = max;
    if (Object.keys(priceCond).length > 0) query.price = priceCond;
  }

  return query;
}

export async function getProductByIdDoc(productId: string): Promise<IProductDoc | null> {
  return Product.findById(productId).lean() as unknown as IProductDoc | null;
}
