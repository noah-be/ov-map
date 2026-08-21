import { fileURLToPath } from 'node:url'
import { mergeConfig, defineConfig, configDefaults } from 'vitest/config'
import viteConfig from './vite.config.ts'

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      exclude: [...configDefaults.exclude, 'e2e/**'],
      maxWorkers: 1,
      pool: 'threads',
      root: fileURLToPath(new URL('./', import.meta.url)),
      coverage: {
        include: ['server/**/*.ts', 'src/**/*.ts', 'src/**/*.vue'],
        exclude: ['server/index.ts', 'src/main.ts'],
        thresholds: {
          statements: 80,
          branches: 60,
          functions: 70,
          lines: 80,
        },
      },
    },
  }),
)
