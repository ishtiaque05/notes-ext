import { defineConfig, devices } from '@playwright/test';
import path from 'path';

/**
 * Playwright configuration for Firefox extension E2E testing
 */
export default defineConfig({
  testDir: './tests/e2e',

  // Maximum time one test can run
  timeout: 60000,

  // Run tests in files in parallel
  fullyParallel: false,

  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,

  // Retry on CI only
  retries: process.env.CI ? 2 : 0,

  // Reporter to use
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['list'],
  ],

  use: {
    // Base URL for navigation
    baseURL: 'https://example.com',

    // Collect trace when retrying the failed test
    trace: 'on-first-retry',

    // Screenshot on failure
    screenshot: 'only-on-failure',

    // Video on failure
    video: 'retain-on-failure',

    // Headless mode - true by default, use --headed to show browser
    headless: true,
  },

  projects: [
    {
      name: 'firefox-extension',
      use: {
        ...devices['Desktop Firefox'],
        // Headless by default, override with --headed flag
        headless: true,
        // Increase timeout for extension operations
        actionTimeout: 10000,
      },
    },
  ],

  // Run local dev server before starting tests (optional)
  // webServer: {
  //   command: 'yarn dev',
  //   url: 'http://localhost:8080',
  //   reuseExistingServer: !process.env.CI,
  // },
});
