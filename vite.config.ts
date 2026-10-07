import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // le Worker de lecture Excel est un module ES
  worker: { format: 'es' },
  test: { include: ['src/**/*.test.ts', 'tests/**/*.test.ts'] },
});
