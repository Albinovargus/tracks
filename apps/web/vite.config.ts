import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { sentryVitePlugin } from '@sentry/vite-plugin';

export default defineConfig({
  // GitHub Pages serves project sites from /<repo>/; local dev and Capacitor use /
  base: process.env.VITE_BASE_PATH ?? '/',
  plugins: [
    react(),
    tailwindcss(),
    ...(process.env.SENTRY_AUTH_TOKEN
      ? [sentryVitePlugin({
          org: process.env.SENTRY_ORG,
          project: process.env.SENTRY_PROJECT,
          authToken: process.env.SENTRY_AUTH_TOKEN,
        })]
      : []),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rolldownOptions: {
      output: {
        // Vendor code in its own chunks keeps every chunk under Vite's 500 kB
        // warning, and app releases leave the cached vendor chunks valid.
        codeSplitting: {
          groups: [
            {
              name: 'react',
              test: /node_modules[\/](react|react-dom|scheduler|react-router)[\/]/,
              priority: 3,
            },
            { name: 'supabase', test: /node_modules[\/]@supabase[\/]/, priority: 2 },
            { name: 'vendor', test: /node_modules[\/]/, priority: 1 },
          ],
        },
      },
    },
  },
});
