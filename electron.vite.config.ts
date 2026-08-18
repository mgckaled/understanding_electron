import { resolve } from 'node:path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { aliases } from './config/aliases'

export default defineConfig({
  main: {
    resolve: {
      alias: aliases
    },
    build: {
      rollupOptions: {
        // Second entry, resolved by utilityProcess.fork() against the output
        // observed in out/main/ (D18A.1) — never a hardcoded file name.
        input: {
          index: resolve(__dirname, 'src/main/index.ts'),
          duckdbWorker: resolve(__dirname, 'src/workers/duckdb/index.ts')
        }
      }
    }
  },
  preload: {
    resolve: {
      alias: aliases
    }
  },
  renderer: {
    resolve: {
      alias: aliases
    },
    // Renderer only: main and preload have no CSS, and the plugin would just be
    // a build step with nothing to find.
    plugins: [react(), tailwindcss()]
  }
})
