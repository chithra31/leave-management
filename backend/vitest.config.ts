import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// SWC compiles TypeScript with decorator metadata, which NestJS and TypeORM rely on.
export default defineConfig({
  test: {
    globals: true,
    root: './',
    include: ['src/**/*.spec.ts'],
  },
  plugins: [swc.vite({ module: { type: 'es6' } })],
});
