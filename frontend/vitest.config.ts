import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: {
    alias: [
      {
        find: /^@\/types\/rag$/,
        replacement: fileURLToPath(new URL('./src/types/rag.ts', import.meta.url)),
      },
    ],
  },
  test: {
    environment: 'node',
    globals: true,
    exclude: ['**/node_modules/**', '**/e2e/**', '**/dist/**'],
  },
})
