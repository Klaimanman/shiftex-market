import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['favicon.svg', 'theme-init.js', 'robots.txt', 'icons/apple-touch-icon.png'],
      manifest: {
        id: '/',
        name: 'ShiftEX Market',
        short_name: 'ShiftEX',
        description: 'לוח פרטי למסירה, חיפוש והחלפה של משמרות.',
        lang: 'he',
        dir: 'rtl',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#F5F3EE',
        theme_color: '#F5F3EE',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        // Precache app shell + only the Hebrew/Latin woff2 subsets actually used.
        globPatterns: ['**/*.{js,css,html,svg,png}', '**/*-hebrew-*.woff2', '**/*-latin-[0-9]*.woff2'],
        // API traffic (Supabase) is never cached by the service worker.
        runtimeCaching: [],
      },
    }),
  ],
  build: {
    target: 'es2020',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          data: ['@supabase/supabase-js', '@tanstack/react-query'],
        },
      },
    },
  },
});
