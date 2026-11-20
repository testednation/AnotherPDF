import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

function disableClientWebSocketPlugin(): Plugin {
  return {
    name: 'disable-vite-client-ws',
    apply: 'serve',
    enforce: 'post',
    transform(code, id) {
      if (
        (id.includes('vite/dist/client/client.mjs') || id.includes('@vite/client')) &&
        code.includes('const createWebSocketModuleRunnerTransport = (options) => {')
      ) {
        return {
          code: code.replace(
            'const createWebSocketModuleRunnerTransport = (options) => {',
            'const createWebSocketModuleRunnerTransport = () => ({ async connect() {}, disconnect() {}, send() {} }); const __disabledCreateWebSocketModuleRunnerTransport = (options) => {'
          ),
          map: null,
        };
      }
      return null;
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [
      disableClientWebSocketPlugin(),
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: [
          'favicon.ico',
          'apple-touch-icon.png',
          'icon.svg',
          'pwa-192x192.png',
          'pwa-512x512.png',
          'pwa-maskable-512x512.png',
        ],
        manifest: {
          id: '/',
          name: 'AcroXFA - XFA PDF Editor & Universal Extractor',
          short_name: 'AcroXFA',
          description: 'Inspect, edit, and fill XFA PDF forms, preflight documents, and extract resources 100% offline.',
          theme_color: '#0f172a',
          background_color: '#0c0f17',
          display: 'standalone',
          start_url: '/',
          scope: '/',
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
          protocol_handlers: [
            {
              protocol: 'web+pdf',
              url: '/?pdfProtocol=%s',
            },
            {
              protocol: 'web+xfa',
              url: '/?xfaProtocol=%s',
            },
            {
              protocol: 'web+xdp',
              url: '/?xdpProtocol=%s',
            },
          ],
          file_handlers: [
            {
              action: '/?fileHandler=1',
              accept: {
                'application/pdf': ['.pdf'],
                'application/vnd.adobe.xdp+xml': ['.xdp'],
                'application/vnd.adobe.xfdf': ['.xfdf'],
              },
            },
          ],
        },
        workbox: {
          maximumFileSizeToCacheInBytes: 15 * 1024 * 1024,
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2,mjs}'],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
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
                cacheName: 'gstatic-fonts-cache',
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
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    server: {
      hmr: false,
      ws: false as const,
      watch: null,
    },
  };
});
