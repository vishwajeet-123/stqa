import http from 'node:http';
import path from 'node:path';
import dotenv from 'dotenv';
import express from 'express';
import { Server as SocketIOServer } from 'socket.io';
import { createServer as createViteServer } from 'vite';
import { connectDatabase, getDatabaseStatus } from './server/db.ts';
import authRoutes from './server/routes/auth.ts';
import { createGroceryRouter } from './server/routes/grocery.ts';
import { createStqaRouter } from './server/routes/stqa.ts';
import { seedDatabase } from './server/seed.ts';

dotenv.config();

async function startServer() {
  const PORT = Number(process.env.PORT || 3000);
  const app = express();
  const httpServer = http.createServer(app);

  const io = new SocketIOServer(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] },
  });

  io.on('connection', (socket) => {
    socket.emit('connected', { message: 'Connected to GroceryGo STQA real-time channel' });
  });

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Serve generated visual assets consistently in both dev and production
  app.use(
    '/src/assets/images',
    express.static(path.resolve(process.cwd(), 'src/assets/images'))
  );

  // Connect MongoDB and initialize seed data
  await connectDatabase();
  await seedDatabase(false);

  // Health & DB verification endpoint
  app.get('/api/health', (_req, res) => {
    const db = getDatabaseStatus();
    res.json({
      status: db.connected ? 'ok' : 'degraded',
      database: db,
      timestamp: new Date().toISOString(),
    });
  });

  // Mount REST APIs
  app.use('/api/auth', authRoutes);
  app.use('/api', createGroceryRouter(io));
  app.use('/api/stqa', createStqaRouter(io));

  // Ensure unmatched /api/* routes return JSON 404 rather than HTML
  app.use('/api/*', (_req, res) => {
    res.status(404).json({ error: 'API endpoint not found.' });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: process.env.DISABLE_HMR !== 'true' },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`[GroceryGo STQA] Server listening on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[GroceryGo STQA] Fatal startup error:', err);
  process.exit(1);
});
