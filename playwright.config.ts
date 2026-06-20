import { defineConfig, devices } from '@playwright/test';

/**
 * E2E-konfiguráció (Fázis 7). Futtatás: `pnpm test:e2e` — az `e2e/run-e2e.mjs`
 * orchestrátor indítja az in-memory MongoDB-t, seedel, felhúzza az API+web
 * dev-szervereket, majd lefuttatja ezt. (A szervereket NEM a Playwright webServer
 * kezeli, hogy a sorrend/leállítás determinisztikus legyen — lásd run-e2e.mjs.)
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
