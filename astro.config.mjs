// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import node from '@astrojs/node';

export default defineConfig({
  site: process.env.SITE_URL || 'http://localhost:4321',
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
    resolve: {
      alias: { '@': '/src' },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            // Pin React/scheduler to their own chunk so they don't get
            // absorbed into a feature chunk by Rollup's heuristics.
            if (
              id.includes('node_modules/react/') ||
              id.includes('node_modules/react-dom/') ||
              id.includes('node_modules/scheduler/')
            ) {
              return 'react';
            }
            if (
              id.includes('node_modules/chart.js') ||
              id.includes('node_modules/react-chartjs-2')
            ) {
              return 'chart-vendor';
            }
            // Note: react-syntax-highlighter / refractor are intentionally
            // NOT manually chunked. The dynamic import in YamlPreviewModal
            // is enough to give them their own chunk, and forcing a manual
            // chunk made Rollup share its `__vitePreload` helper across
            // the boundary, which re-pinned the (1.7 MB) chunk to the
            // eager app bundle.
          },
        },
      },
    },
  },
});
