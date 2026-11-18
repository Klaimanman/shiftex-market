import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';

// Safety net: never let a Supabase *secret* / service_role key be bundled into public JS.
function assertPublicKey() {
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_ANON_KEY ?? '';
  let isServiceJwt = false;
  try {
    isServiceJwt = key.split('.').length === 3 && JSON.parse(Buffer.from(key.split('.')[1], 'base64').toString()).role === 'service_role';
  } catch {
    /* not a JWT */
  }
  if (key.startsWith('sb_secret_') || isServiceJwt) {
    throw new Error(
      'VITE_SUPABASE_PUBLISHABLE_KEY contains a SECRET key. Use the "Publishable key" (sb_publishable_...) instead. Build aborted to protect your database.',
    );
  }
}
assertPublicKey();

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
        background_color: '#0E0F11',
        theme_color: '#0E0F11',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
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
