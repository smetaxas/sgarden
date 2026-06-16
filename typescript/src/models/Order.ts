import mongoose, { Schema, Document } from 'mongoose';

export interface IOrderItem {
  productId: mongoose.Types.ObjectId;
  quantity: number;
}

export interface IOrder extends Document {
  items: IOrderItem[];
  total: number;
  createdAt: Date;
  updatedAt: Date;
}

const orderItemSchema = new Schema<IOrderItem>(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    quantity: { type: Number, required: true, min: 1 },
  },
  { _id: false }
);

const orderSchema = new Schema<IOrder>(
  {
    items: { type: [orderItemSchema], required: true },
    total: { type: Number, required: true, default: 0 },
  },
  { timestamps: true, toJSON: { virtuals: true } }
);

export const Order = mongoose.model<IOrder>('Order', orderSchema);
