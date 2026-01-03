/**
 * Playwright E2E Test Configuration for Lovcode
 *
 * This config is set up for Tauri desktop app testing.
 * Tests will launch the dev server and connect to the webview.
 */

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  outputDir: './e2e/test-results',

  // Run tests in parallel
  fullyParallel: true,

  // Fail build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,

  // Retry failed tests (2 retries on CI)
  retries: process.env.CI ? 2 : 0,

  // Use 1 worker on CI to avoid flakiness, more locally
  workers: process.env.CI ? 1 : undefined,

  // Reporter config
  reporter: process.env.CI
    ? [['html', { open: 'never' }], ['github']]
    : [['html', { open: 'on-failure' }]],

  // Shared settings for all projects
  use: {
    // Base URL for navigation
    baseURL: 'http://localhost:1420',

    // Collect trace on first retry
    trace: 'on-first-retry',

    // Screenshot on failure
    screenshot: 'only-on-failure',

    // Video on retry
    video: 'on-first-retry',
  },

  // Web server configuration - starts Vite dev server
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:1420',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },

  // Project configuration
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // Tauri uses WebKit on macOS
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],
});
