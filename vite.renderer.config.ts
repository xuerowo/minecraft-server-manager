import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  root: resolve(process.cwd(), 'src/renderer'),
  base: './',
  plugins: [react()],
  build: {
    outDir: resolve(process.cwd(), 'dist/renderer'),
    emptyOutDir: true,
    assetsDir: '.',
    rollupOptions: {
      output: {
        assetFileNames: '[name]-[hash][extname]',
        chunkFileNames: '[name]-[hash].js',
        entryFileNames: '[name]-[hash].js'
      }
    }
  },
  resolve: {
    alias: {
      '@': resolve(process.cwd(), 'src'),
      '@shared': resolve(process.cwd(), 'src/shared'),
      '@renderer': resolve(process.cwd(), 'src/renderer')
    }
  },
  server: {
    port: 5173
  }
});