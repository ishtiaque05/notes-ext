import { vi } from 'vitest';

// In-memory storage for mocking browser.storage.local
let mockStorage: Record<string, unknown> = {};

export function createBrowserMock() {
  // Reset storage for each test
  mockStorage = {};

  return {
    storage: {
      local: {
        get: vi.fn(async (keys?: string | string[] | null) => {
          if (keys === null || keys === undefined) {
            return { ...mockStorage };
          }
          if (typeof keys === 'string') {
            return { [keys]: mockStorage[keys] };
          }
          const result: Record<string, unknown> = {};
          for (const key of keys) {
            if (key in mockStorage) {
              result[key] = mockStorage[key];
            }
          }
          return result;
        }),
        set: vi.fn(async (items: Record<string, unknown>) => {
          Object.assign(mockStorage, items);
        }),
        remove: vi.fn(async (keys: string | string[]) => {
          const keysArray = typeof keys === 'string' ? [keys] : keys;
          for (const key of keysArray) {
            delete mockStorage[key];
          }
        }),
        clear: vi.fn(async () => {
          mockStorage = {};
        }),
      },
    },
    tabs: {
      get: vi.fn(async () => ({ id: 1, url: 'https://example.com' })),
      query: vi.fn(async () => []),
      sendMessage: vi.fn(async () => undefined),
      captureVisibleTab: vi.fn(async () => 'data:image/png;base64,mock'),
    },
    runtime: {
      sendMessage: vi.fn(async () => undefined),
      onMessage: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
      },
    },
    notifications: {
      create: vi.fn(async () => 'notification-id'),
    },
    contextMenus: {
      create: vi.fn(),
      removeAll: vi.fn(async () => undefined),
      onClicked: {
        addListener: vi.fn(),
      },
    },
  };
}

// Helper to set mock storage data directly in tests
export function setMockStorage(data: Record<string, unknown>) {
  mockStorage = { ...data };
}

// Helper to get current mock storage state
export function getMockStorage() {
  return { ...mockStorage };
}
