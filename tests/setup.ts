import { vi } from 'vitest';
import { createBrowserMock } from './mocks/browser';

// Set up global browser mock before each test
beforeEach(() => {
  const browserMock = createBrowserMock();
  vi.stubGlobal('browser', browserMock);
});

// Clean up after each test
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
