import mongoose, { Schema, Document } from 'mongoose';

export interface IConfig extends Document {
  key: string;
  value: number;
}

const configSchema = new Schema<IConfig>({
  key:   { type: String, required: true, unique: true },
  value: { type: Number, required: true },
});

export const Config = mongoose.model<IConfig>('Config', configSchema);