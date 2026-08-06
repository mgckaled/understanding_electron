import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'
import { aliases } from './config/aliases'

export default defineConfig({
  resolve: {
    alias: {
      ...aliases,
      '@test': resolve('test')
    }
  },
  test: {
    globals: true,
    coverage: {
      provider: 'v8',
      include: ['src/core/**', 'src/shared/**'],
      // src/renderer/src/shared/ui/ (D5.5) shares the "shared" segment with
      // src/shared/ — without this, the include glob below matches both,
      // pulling renderer code (no coverage goal) into the core/shared metric.
      exclude: ['src/renderer/**'],
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
