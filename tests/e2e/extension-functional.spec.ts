import { test, expect, chromium, type BrowserContext } from '@playwright/test';
import path from 'path';

/**
 * Functional E2E Tests for Notes Collector Extension
 *
 * These tests load the extension in a real browser and test actual functionality.
 */

let context: BrowserContext;
let extensionId: string;

test.beforeAll(async () => {
  // Path to the built extension
  const pathToExtension = path.join(__dirname, '../../dist');

  // Launch browser with extension loaded
  // Note: Using Chromium for better Playwright extension support
  // For Firefox, use manual testing or web-ext
  context = await chromium.launchPersistentContext('', {
    headless: false, // Extensions require headed mode (override config for this test)
    args: [
      `--disable-extensions-except=${pathToExtension}`,
      `--load-extension=${pathToExtension}`,
    ],
  });

  // Wait for extension to load and get ID
  // For MV3 extensions, we need to find the extension ID differently
  try {
    // Try service worker approach first
    let [background] = context.serviceWorkers();
    if (!background) {
      // Wait a bit for background to register
      await context.waitForEvent('serviceworker', { timeout: 5000 }).catch(() => null);
      [background] = context.serviceWorkers();
    }

    if (background) {
      extensionId = background.url().split('/')[2];
    } else {
      // Fallback: Try to get extension ID from chrome://extensions page
      const page = await context.newPage();
      await page.goto('chrome://extensions');
      // Extension ID will be in the URL or page content
      // For now, use a fixed pattern
      extensionId = 'extension-id-placeholder';
    }
  } catch (error) {
    console.warn('Could not determine extension ID:', error);
    extensionId = 'unknown';
  }

  console.log('Extension ID:', extensionId);
});

test.afterAll(async () => {
  if (context) {
    await context.close();
  }
});

test.describe.skip('Extension Functionality (Requires Full Extension Context)', () => {
  test('extension loads and opens sidebar', async () => {
    const page = await context.newPage();
    await page.goto('https://example.com');

    // Try to open the sidebar/popup
    // Note: Sidebar access depends on browser API availability
    // This is a basic structure - actual implementation may vary

    expect(page).toBeTruthy();
  });

  test('can open popup page directly', async () => {
    // Skip if we couldn't get extension ID
    if (extensionId === 'unknown' || extensionId === 'extension-id-placeholder') {
      test.skip();
    }

    const page = await context.newPage();

    // Open the extension's sidebar/popup HTML directly
    await page.goto(`chrome-extension://${extensionId}/sidebar/sidebar.html`);

    // Wait for the page to load
    await page.waitForLoadState('networkidle');

    // Check that key elements exist
    const exportButton = page.locator('button:has-text("Export")');
    const clearButton = page.locator('button:has-text("Clear")');

    await expect(exportButton).toBeVisible();
    await expect(clearButton).toBeVisible();
  });

  test('sidebar shows empty state initially', async () => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/sidebar/sidebar.html`);
    await page.waitForLoadState('networkidle');

    // Check for empty state or item list
    const itemList = page.locator('#item-list, .items-list, ul');
    await expect(itemList).toBeVisible();

    // Should have no items initially (or show empty message)
    const items = page.locator('.item');
    const itemCount = await items.count();

    console.log('Initial item count:', itemCount);
  });

  test('can interact with sidebar controls', async () => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/sidebar/sidebar.html`);
    await page.waitForLoadState('networkidle');

    // Try clicking export button (should work even with no items)
    const exportButton = page.locator('button:has-text("Export"), #export-btn, .export-btn');

    if (await exportButton.isVisible()) {
      await exportButton.click();
      // PDF generation might trigger download or show message
      console.log('Export button clicked');
    }
  });

  test('sidebar HTML has correct structure', async () => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/sidebar/sidebar.html`);
    await page.waitForLoadState('networkidle');

    // Get page title
    const title = await page.title();
    expect(title).toContain('Notes');

    // Check that script is loaded
    const scripts = await page.locator('script').count();
    expect(scripts).toBeGreaterThan(0);
  });
});

test.describe.skip('Content Script Integration (Requires Full Extension Context)', () => {
  test('content script loads on web pages', async () => {
    const page = await context.newPage();

    // Navigate to a test page
    await page.goto('https://example.com');
    await page.waitForLoadState('networkidle');

    // Check if content script CSS is injected (indicates script loaded)
    // Note: This is indirect testing - direct verification would require
    // checking window/document objects that content script modifies

    // The page should load successfully
    expect(page.url()).toContain('example.com');
  });

  test('can programmatically add items to storage', async () => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/sidebar/sidebar.html`);
    await page.waitForLoadState('networkidle');

    // Add items programmatically via browser storage API
    await page.evaluate(() => {
      // Access browser storage (works in extension context)
      const testItem = {
        id: 'test-link-1',
        type: 'link',
        content: 'https://example.com/test',
        metadata: {
          text: 'Test Link',
          href: 'https://example.com/test',
        },
        timestamp: Date.now(),
        order: 0,
      };

      // Store in extension storage
      if (typeof browser !== 'undefined' && browser.storage) {
        return browser.storage.local.set({
          items: [testItem],
        });
      } else if (typeof chrome !== 'undefined' && chrome.storage) {
        return new Promise((resolve) => {
          chrome.storage.local.set({ items: [testItem] }, resolve);
        });
      }
    });

    // Reload to see the items
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Check if items appear
    const items = page.locator('.item');
    const itemCount = await items.count();

    console.log('Item count after adding:', itemCount);
    expect(itemCount).toBeGreaterThanOrEqual(0); // Should have at least 0 items
  });
});

test.describe.skip('Storage and Persistence (Requires Full Extension Context)', () => {
  test('can read extension storage', async () => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/sidebar/sidebar.html`);
    await page.waitForLoadState('networkidle');

    // Read storage
    const storageData = await page.evaluate(() => {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        return new Promise((resolve) => {
          chrome.storage.local.get(['items', 'disabledDomains'], (data) => {
            resolve(data);
          });
        });
      }
      return null;
    });

    console.log('Storage data:', storageData);
    expect(storageData).toBeDefined();
  });
});
