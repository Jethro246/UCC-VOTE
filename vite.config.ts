import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const hmrEnabled = process.env.ENABLE_HMR === 'true' && process.env.DISABLE_HMR !== 'true';

function disableHmrClientPlugin(): Plugin {
  return {
    name: 'disable-hmr-client-ws',
    apply: 'serve',
    enforce: 'post',
    transform(code, id) {
      if (hmrEnabled) return null;
      const cleanId = id.replace(/\\/g, '/').split('?')[0];
      if (!cleanId.endsWith('/vite/dist/client/client.mjs')) return null;
      const replaced = code.replace(
        /const transport = normalizeModuleRunnerTransport\(\(\(\) => \{[\s\S]*?\}\)\(\)\);/,
        'const transport = normalizeModuleRunnerTransport({ connect() {}, disconnect() {}, send() {} });'
      );
      return replaced === code ? null : { code: replaced, map: null };
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      disableHmrClientPlugin(),
      VitePWA({
        strategies: 'generateSW',
        registerType: 'prompt',
        injectRegister: false,
        filename: 'service-worker.js',
        manifestFilename: 'manifest.json',
        manifest: {
          id: '/',
          name: 'UCC VOTE',
          short_name: 'UCC VOTE',
          description: 'Official University of Cape Coast online voting platform.',
          theme_color: '#123B70',
          background_color: '#F4F6F9',
          display: 'standalone',
          orientation: 'portrait-primary',
          start_url: '/',
          scope: '/',
          categories: ['government', 'education'],
          icons: [
            {
              src: '/pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
          navigateFallback: '/index.html',
          navigateFallbackDenylist: [/^\/api\//, /^\/__\//, /^\/offline\.html$/],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'ucc-vote-google-fonts-css',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'ucc-vote-google-fonts-files',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
          ],
        },
        devOptions: {
          enabled: true,
          type: 'module',
          navigateFallback: '/index.html',
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    server: {
      host: '0.0.0.0',
      port: 3000,
      allowedHosts: true as const,
      // HMR is disabled in AI Studio to prevent WebSocket connection errors and agent edit flicker.
      hmr: hmrEnabled,
      ws: hmrEnabled ? {} : false,
      watch: hmrEnabled ? {} : null,
    },
  };
});
