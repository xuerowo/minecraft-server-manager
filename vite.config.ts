import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  root: resolve(process.cwd(), 'src/renderer'),
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(process.cwd(), 'src'),
      '@shared': resolve(process.cwd(), 'src/shared'),
      '@renderer': resolve(process.cwd(), 'src/renderer')
    }
  },
  server: {
    port: 5173,
    host: true
  },
  build: {
    outDir: resolve(process.cwd(), 'dist/renderer'),
    emptyOutDir: true
  }
});