import mongoose from 'mongoose';
import { config } from '../config.js';

let csatlakozva = false;

/** Mongoose-kapcsolat (idempotens). */
export async function csatlakozasDb(uri: string = config.mongoUri): Promise<typeof mongoose> {
  if (csatlakozva) return mongoose;
  mongoose.set('strictQuery', true);
  // Rövid kiválasztási időkorlát: ne fagyjon be az indulás, ha nincs DB.
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 3000 });
  csatlakozva = true;
  return mongoose;
}

export async function bontasDb(): Promise<void> {
  if (!csatlakozva) return;
  await mongoose.disconnect();
  csatlakozva = false;
}

/** A kapcsolat aktuális állapota a health-checkhez (1 = connected). */
export function dbAllapot(): number {
  return mongoose.connection.readyState;
}
