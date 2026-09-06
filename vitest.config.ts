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
    // Um worker por thread lógica (o default sem `watch`) satura esta máquina:
    // medido, 8 workers rendem 97,6s contra 107,3s com 4 — paralelismo efetivo
    // de ~2x, o resto vira contenção. Percentual, não número fixo, para
    // sobreviver a trocar de máquina.
    maxWorkers: '50%',
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
