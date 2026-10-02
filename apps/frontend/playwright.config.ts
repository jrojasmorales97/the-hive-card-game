import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e', fullyParallel: true, workers: 4, retries: 0,
  timeout: 40_000, expect: { timeout: 15_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL: 'http://127.0.0.1:5174', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    { command: 'npx tsc -p tsconfig.e2e.json && node --import tsx tooling/e2eServer.ts', cwd: '../backend', url: 'http://127.0.0.1:3003/health', env: { CLIENT_ORIGIN: '*' } },
    { command: 'npm run dev -- --host 127.0.0.1 --port 5174 --strictPort', url: 'http://127.0.0.1:5174', env: { VITE_PROXY_TARGET: 'http://127.0.0.1:3002' } },
  ],
});
