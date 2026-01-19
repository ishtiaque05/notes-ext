import { describe, it, expect } from 'vitest';

describe('Test Setup', () => {
  it('should have browser mock available', () => {
    expect(browser).toBeDefined();
    expect(browser.storage).toBeDefined();
    expect(browser.storage.local).toBeDefined();
  });

  it('should have mocked storage functions', async () => {
    await browser.storage.local.set({ test: 'value' });
    const result = await browser.storage.local.get('test');
    expect(result).toEqual({ test: 'value' });
  });
});
