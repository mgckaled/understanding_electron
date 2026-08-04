import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
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
    plugins: [react()]
  }
})
