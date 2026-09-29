import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// GitHub Pages serves under /codebase-bloat-tax/. Local and Netlify use /.
const pages = Boolean((globalThis as { process?: { env?: Record<string, string> } }).process?.env?.GITHUB_PAGES);
const base = pages ? '/codebase-bloat-tax/' : '/';

export default defineConfig({
  plugins: [react()],
  base,
  build: {
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          const norm = id.replace(/\\/g, '/');
          if (!norm.includes('/node_modules/')) return;
          if (
            norm.includes('/node_modules/react/') ||
            norm.includes('/node_modules/react-dom/') ||
            norm.includes('/node_modules/scheduler/')
          ) {
            return 'react';
          }
          if (norm.includes('/node_modules/zod/')) return 'zod';
          if (norm.includes('/node_modules/yaml/')) return 'yaml';
          if (
            norm.includes('/node_modules/framer-motion/') ||
            norm.includes('/node_modules/motion-dom/') ||
            norm.includes('/node_modules/motion-utils/')
          ) {
            return 'motion';
          }
          if (norm.includes('/node_modules/tesseract.js')) return 'ocr';
        },
      },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
  },
});
