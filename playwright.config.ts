import { defineConfig } from '@playwright/test'

export default defineConfig({
  // Electron instances launched by different tests would otherwise fight over
  // the same userData directory — serialize everything. Since plano 14 that is
  // no longer only about a lock: userData holds the conversation database, and
  // two runs writing to it at once would be two writers on one SQLite file.
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
