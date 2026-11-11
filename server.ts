import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import { authRouter } from './src/server/authRoutes';
import { adminRouter } from './src/server/adminRoutes';
import { studentDashboardRouter } from './src/server/studentDashboardRoutes';
import { electionRouter } from './src/server/electionRoutes';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  // Middlewares
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  // Mount API Routers
  app.use('/api/auth', authRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api/student', studentDashboardRouter);
  app.use('/api/elections', electionRouter);

  // Health check route
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'healthy',
      institution: 'University of Cape Coast, Ghana',
      platform: 'UCC VOTE',
      timestamp: new Date().toISOString()
    });
  });

  // Check if running in production or development
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    // Development mode: Mount Vite middleware
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production mode: Serve static assets from dist
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`[UCC VOTE] Server listening at http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('[UCC VOTE] Failed to start server:', err);
  process.exit(1);
});
