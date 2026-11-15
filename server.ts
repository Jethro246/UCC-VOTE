import express from 'express';
import http from 'http';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const httpServer = http.createServer(app);

  const portFlagIndex = process.argv.indexOf('--port');
  const cliPort =
    portFlagIndex !== -1 && process.argv[portFlagIndex + 1]
      ? parseInt(process.argv[portFlagIndex + 1], 10)
      : NaN;
  const port = !Number.isNaN(cliPort)
    ? cliPort
    : process.env.PORT
      ? parseInt(process.env.PORT, 10)
      : 3000;

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  // Health check route
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'healthy',
      institution: 'University of Cape Coast, Ghana',
      platform: 'UCC VOTE',
      backend: 'Firebase (ucc-vote)',
      timestamp: new Date().toISOString(),
    });
  });

  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const hmrEnabled =
      process.env.ENABLE_HMR === 'true' && process.env.DISABLE_HMR !== 'true';
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: hmrEnabled ? { server: httpServer } : false,
        ws: hmrEnabled ? undefined : false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  httpServer.listen(port, '0.0.0.0', () => {
    console.log(`[UCC VOTE] Server listening at http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('[UCC VOTE] Failed to start server:', err);
  process.exit(1);
});
