/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.ico'],
      manifest: {
        name: 'Scouting Pallavolo',
        short_name: 'Scouting',
        description: 'Scouting live pallavolo offline per iPad',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        orientation: 'landscape',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
      },
    }),
  ],
  resolve: {
    alias: { '@': '/src' },
  },
  server: {
    host: true,
    port: 5173,
  },
  test: {
    environment: 'jsdom',
    setupFiles: './vitest.setup.ts',
    globals: true,
    // Esclude anche i worktree git isolati sotto .claude/worktrees/: senza
    // questo, lanciare i test dalla root del repo raddoppia la suite (una
    // volta per src/, una per la copia dentro ogni worktree presente).
    exclude: ['**/node_modules/**', '.claude/worktrees/**'],
  },
});
