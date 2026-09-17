import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Emulyator bilan ishlash sekinroq — standart 5s yetmaydi.
    testTimeout: 20000,
    hookTimeout: 30000,
  },
});
