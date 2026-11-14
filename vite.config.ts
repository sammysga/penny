import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Relative base: works at a domain root or under a sub-path such as GitHub Pages (/penny/).
  base: './',
  plugins: [react()],
  server: { host: true, port: 5173 },
  preview: { host: true, port: 4173 },
  build: { chunkSizeWarningLimit: 600, rollupOptions: { output: { manualChunks: { react: ['react', 'react-dom'], charts: ['recharts'], icons: ['lucide-react'] } } } },
  test: { environment: 'node' },
} as any);
