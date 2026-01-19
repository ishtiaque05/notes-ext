import { vi } from 'vitest';
import { createBrowserMock } from './mocks/browser';

// Set up global browser mock before each test
beforeEach(() => {
  const browserMock = createBrowserMock();
  vi.stubGlobal('browser', browserMock);

  // Mock self.crypto.randomUUID for service worker context
  vi.stubGlobal('self', {
    crypto: {
      randomUUID: () => `test-uuid-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    },
  });
});

// Clean up after each test
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
