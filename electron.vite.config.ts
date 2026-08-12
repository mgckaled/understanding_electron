import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { aliases } from './config/aliases'

export default defineConfig({
  main: {
    resolve: {
      alias: aliases
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
