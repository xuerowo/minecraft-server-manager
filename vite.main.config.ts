import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: resolve(process.cwd(), 'src/main'),
  build: {
    outDir: resolve(process.cwd(), 'dist/main'),
    lib: {
      entry: 'main.ts',
      formats: ['cjs'],
      fileName: 'main'
    },
    rollupOptions: {
      external: [
        'electron',
        'path',
        'fs',
        'fs/promises',
        'os',
        'child_process',
        'events',
        'crypto',
        'stream',
        'buffer',
        'util',
        'zlib',
        'assert',
        'constants',
        'node:url',
        'node:path',
        'node:fs',
        'node:fs/promises',
        'node:events',
        'node:stream',
        'node:string_decoder',
        '@aws-sdk/client-s3',
        /^@aws-sdk\/.*/
      ]
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