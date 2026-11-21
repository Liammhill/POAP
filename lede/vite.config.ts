import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const demo = process.env.VITE_DEMO === '1';

export default defineConfig({
  base: './',
  build: demo ? { outDir: 'dist-demo' } : {},
  plugins: [
    react(),
    !demo && VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Lede — Eleanor Herzog',
        short_name: 'Lede',
        description: 'Private business companion for Eleanor Herzog, communications strategist.',
        theme_color: '#f6f1ec',
        background_color: '#f6f1ec',
        display: 'standalone',
        start_url: './',
        scope: './',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        // Opportunities feed should always try the network first.
        runtimeCaching: [
          { urlPattern: /opportunities\.json$/, handler: 'NetworkFirst', options: { cacheName: 'opportunities' } },
        ],
      },
    }),
  ],
});
