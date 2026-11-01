// Playwright e2e sull'app LOCALE collegata alla PROVA (avviata da tests/e2e/esegui.mjs)
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: '.',
  testMatch: /\d\d-.*\.spec\.mjs$/,
  workers: 1,
  fullyParallel: false,
  timeout: 240000,
  expect: { timeout: 15000 },
  retries: 0,
  outputDir: '../report/e2e-artefatti',
  reporter: [['list'], ['json', { outputFile: '../report/e2e-risultati.json' }]],
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3100',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    actionTimeout: 20000,
    navigationTimeout: 120000,
    locale: 'it-IT',
    viewport: { width: 1440, height: 900 },
  },
})
