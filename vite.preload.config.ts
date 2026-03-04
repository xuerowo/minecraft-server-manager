import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: resolve(process.cwd(), 'src/preload'),
  build: {
    outDir: resolve(process.cwd(), 'dist/preload'),
    lib: {
      entry: 'preload.ts',
      formats: ['cjs'],
      fileName: () => 'preload.cjs'
    },
    rollupOptions: {
      external: ['electron']
    },
    emptyOutDir: true,
    target: 'node14'
  },
  resolve: {
    alias: {
      '@': resolve(process.cwd(), 'src'),
      '@shared': resolve(process.cwd(), 'src/shared')
    }
  }
});