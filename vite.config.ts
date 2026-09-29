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
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
  },
});
