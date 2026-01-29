import { test as base, chromium, type BrowserContext } from '@playwright/test';
import path from 'path';

/**
 * Extended test fixture with Firefox extension loaded
 */
export const test = base.extend<{
  context: BrowserContext;
  extensionId: string;
}>({
  // eslint-disable-next-line no-empty-pattern
  context: async ({}, use) => {
    const pathToExtension = path.join(__dirname, '../../../dist');

    // Launch browser with extension loaded
    // Note: Firefox extension loading in Playwright is experimental
    // For production, consider using web-ext or manual testing
    const context = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
      ],
    });

    await use(context);
    await context.close();
  },

  extensionId: async ({ context }, use) => {
    // Get extension ID (Chrome-based approach)
    // For Firefox, this would need adjustment
    let [background] = context.serviceWorkers();
    if (!background) background = await context.waitForEvent('serviceworker');

    const extensionId = background.url().split('/')[2];
    await use(extensionId);
  },
});

export { expect } from '@playwright/test';
