import { defineConfig } from '@playwright/test'

export default defineConfig({
  // Electron instances launched by different tests would otherwise fight
  // over the same userData directory — serialize everything.
  workers: 1,
  projects: [
    {
      name: 'dev',
      testMatch: 'e2e/dev/**/*.spec.ts'
    },
    {
      name: 'packaged',
      testMatch: 'e2e/packaged/**/*.spec.ts'
    }
  ]
})
