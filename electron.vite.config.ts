import { resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { aliases } from './config/aliases'

export default defineConfig({
  main: {
    // Dependencies are external by default, and for an ESM-only package that
    // breaks: rollup emits `require(pkg)` and uses the namespace as the default
    // export, so the plugin arrives as `{ default }` instead of the function
    // (DE1D.9). The remark family is ESM-only throughout, so it is bundled.
    plugins: [externalizeDepsPlugin({ exclude: ['remark', 'remark-gfm'] })],
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
