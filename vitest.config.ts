import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.spec.ts'],
    coverage: {
      reporter: ['html'],
    },
  },
  resolve: {
    alias: {
      src: new URL('./src', import.meta.url).pathname,
    },
  },
});
