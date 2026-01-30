import { defineConfig } from 'vitest/config';
import babel from 'vite-plugin-babel';

export default defineConfig({
  plugins: [
    babel({
      filter: /src\/fontkit\/.*\.js$/,
      babelConfig: {
        plugins: [['@babel/plugin-proposal-decorators', { version: 'legacy' }]],
      },
    }),
  ],
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.spec.ts'],
    coverage: {
      reporter: ['html', 'text'],
    },
  },
  resolve: {
    alias: {
      src: new URL('./src', import.meta.url).pathname,
    },
  },
});
