import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages serves the site at /valoda-app/
const base = process.env.VITE_BASE ?? '/valoda-app/';

export default defineConfig({
  base,
  plugins: [
    preact(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Valoda — латышский',
        short_name: 'Valoda',
        lang: 'ru',
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0f1115',
        theme_color: '#0f1115',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // App shell + content + audio are precached so sessions work fully offline.
        // voice-test/ and design/ are one-off comparison pages and stay out of the cache.
        globPatterns: ['**/*.{js,css,html,png,svg,webmanifest,json,mp3}'],
        globIgnores: ['voice-test/**', 'design/**'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        navigateFallbackDenylist: [/\/voice-test\//, /\/design\//],
      },
    }),
  ],
});
