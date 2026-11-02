import { defineConfig, devices } from '@playwright/test';
import { firefoxSkips, titlesPattern, webkitSkips } from './test/browser-skips';

export default defineConfig({
  testDir: './src',
  testMatch: '**/*.test.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // CI shards write blob reports, merged into one HTML report afterwards.
  reporter: process.env.CI ? [['github'], ['blob']] : 'list',
  use: { baseURL: 'http://localhost:6009', trace: 'on-first-retry' },
  // Chromium gates every PR (`pnpm test`); Firefox and WebKit run nightly and
  // after each push to main (`pnpm test:browsers`).
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
      grepInvert: titlesPattern(firefoxSkips),
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
      grepInvert: titlesPattern(webkitSkips),
    },
  ],
  webServer: {
    command: 'vite --config test/vite.config.ts',
    url: 'http://localhost:6009/test/index.html',
    reuseExistingServer: !process.env.CI,
  },
});
