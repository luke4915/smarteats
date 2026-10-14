import { defineConfig, devices } from '@playwright/test';

// Test nel browser: l'app vera (backend + frontend compilato) con locali di prova nel database di test.
// Si lanciano con `npm run e2e` (costruisce il frontend e avvia il server di prova, backend/scripts/e2e-server.js).
const PORT = 4443;

export default defineConfig({
  testDir: './e2e',
  outputDir: './e2e/.run/risultati',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 45_000,
  reporter: [['list']],
  use: {
    ignoreHTTPSErrors: true,
    locale: 'it-IT',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    launchOptions: { args: ['--host-resolver-rules=MAP *.standmanager.local 127.0.0.1'] },
  },
  projects: [
    { name: 'desktop', testIgnore: /\.telefono\.spec\.js/, use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'telefono', testMatch: /\.telefono\.spec\.js/, use: { ...devices['Pixel 7'], launchOptions: { args: ['--host-resolver-rules=MAP *.standmanager.local 127.0.0.1'] } } },
  ],
  webServer: {
    command: 'node ../backend/scripts/e2e-server.js',
    url: `https://127.0.0.1:${PORT}/api/health`,
    ignoreHTTPSErrors: true,
    reuseExistingServer: false,
    timeout: 60_000,
    env: { E2E_PORT: String(PORT) },
  },
});
