import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

let mongoServer: MongoMemoryServer | null = null;
let isConnected = false;

export async function connectDatabase(): Promise<string> {
  if (isConnected && mongoose.connection.readyState === 1) {
    return process.env.MONGODB_URI ? 'external' : 'embedded-wiredtiger';
  }

  const externalUri = process.env.MONGODB_URI?.trim();
  if (externalUri) {
    await mongoose.connect(externalUri);
    isConnected = true;
    console.log('[MongoDB] Connected to external MongoDB URI');
    return 'external';
  }

  const dbPath = path.resolve(process.cwd(), '.mongodb-data');
  if (!fs.existsSync(dbPath)) {
    fs.mkdirSync(dbPath, { recursive: true });
  }

  mongoServer = await MongoMemoryServer.create({
    instance: {
      dbPath,
      storageEngine: 'wiredTiger',
      dbName: 'grocerygo_stqa',
    },
  });

  const uri = mongoServer.getUri('grocerygo_stqa');
  await mongoose.connect(uri);
  isConnected = true;
  console.log(`[MongoDB] Connected to persistent local MongoDB (${dbPath})`);
  return 'embedded-wiredtiger';
}

export async function disconnectDatabase(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (mongoServer) {
    await mongoServer.stop();
    mongoServer = null;
  }
  isConnected = false;
}

export function getDatabaseStatus() {
  return {
    connected: mongoose.connection.readyState === 1,
    readyState: mongoose.connection.readyState,
    dbName: mongoose.connection.name || 'grocerygo_stqa',
    mode: process.env.MONGODB_URI?.trim() ? 'External MongoDB' : 'Local MongoDB (WiredTiger)',
  };
}
