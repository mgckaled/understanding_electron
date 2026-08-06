import { defineConfig } from 'vitest/config'
import { aliases } from './config/aliases'

export default defineConfig({
  resolve: {
    alias: aliases
  },
  test: {
    globals: true,
    coverage: {
      provider: 'v8',
      include: ['src/core/**', 'src/shared/**'],
      thresholds: {
        lines: 85
      }
    },
    projects: [
      {
        extends: true,
        test: {
          name: 'node',
          environment: 'node',
          include: ['src/{core,shared,main,workers}/**/*.test.ts']
        }
      },
      {
        extends: true,
        test: {
          name: 'web',
          environment: 'jsdom',
          include: ['src/renderer/**/*.test.{ts,tsx}'],
          setupFiles: ['test/setup-renderer.ts']
        }
      }
    ]
  }
})
