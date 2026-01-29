import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generatePdf } from '../../../src/sidebar/pdfGenerator';
import { CapturedItem } from '../../../src/types';

// Mock pdfMake global
const mockDownload = vi.fn();
const mockCreatePdf = vi.fn(() => ({
  download: mockDownload,
  open: vi.fn(),
  print: vi.fn(),
}));

// Set up global pdfMake
(globalThis as unknown as { pdfMake: unknown }).pdfMake = {
  createPdf: mockCreatePdf,
};

describe('pdfGenerator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createMockLink = (overrides: Partial<CapturedItem> = {}): CapturedItem => ({
    id: 'link-1',
    type: 'link',
    order: 0,
    timestamp: Date.now(),
    content: 'https://example.com',
    metadata: { text: 'Example Link', href: 'https://example.com' },
    ...overrides,
  });

  const createMockImage = (overrides: Partial<CapturedItem> = {}): CapturedItem => ({
    id: 'image-1',
    type: 'image',
    order: 0,
    timestamp: Date.now(),
    content: 'data:image/png;base64,abc123',
    metadata: { alt: 'Test Image', originalSrc: 'https://example.com/img.png' },
    ...overrides,
  });

  const createMockText = (overrides: Partial<CapturedItem> = {}): CapturedItem => ({
    id: 'text-1',
    type: 'text',
    order: 0,
    timestamp: Date.now(),
    content: 'Captured text content',
    metadata: { text: 'Captured text content', sourceUrl: 'https://example.com/page' },
    ...overrides,
  });

  const createMockScreenshot = (overrides: Partial<CapturedItem> = {}): CapturedItem => ({
    id: 'screenshot-1',
    type: 'screenshot',
    order: 0,
    timestamp: Date.now(),
    content: 'data:image/png;base64,screenshotData',
    metadata: {
      alt: 'Screenshot',
      sourceUrl: 'https://example.com',
      dimensions: { width: 800, height: 600, x: 0, y: 0 },
    },
    ...overrides,
  });

  describe('generatePdf', () => {
    it('should not generate PDF for empty items', () => {
      generatePdf([]);

      expect(mockCreatePdf).not.toHaveBeenCalled();
    });

    it('should create PDF and download with default filename', () => {
      generatePdf([createMockLink()]);

      expect(mockCreatePdf).toHaveBeenCalled();
      expect(mockDownload).toHaveBeenCalledWith('captured-notes.pdf');
    });

    it('should extract title from most recent item sourceUrl', () => {
      const items = [
        createMockText({ timestamp: 1000, metadata: { text: 'Old', sourceUrl: 'https://old.com' } }),
        createMockText({
          timestamp: 2000,
          metadata: { text: 'New', sourceUrl: 'https://new-site.com/page' },
        }),
      ];

      generatePdf(items);

      // @ts-expect-error - Mock calls type
      const docDefinition = (mockCreatePdf.mock.calls[0]![0] as unknown) as { content: { text: string }[] };
      expect(docDefinition?.content[0]?.text).toBe('new-site.com');
    });

    it('should use href as title fallback for links', () => {
      const items = [createMockLink({ metadata: { text: 'Link', href: 'https://link-site.com' } })];

      generatePdf(items);

      // @ts-expect-error - Mock calls type
      const docDefinition = (mockCreatePdf.mock.calls[0]![0] as unknown) as { content: { text: string }[] };
      expect(docDefinition?.content[0]?.text).toBe('link-site.com');
    });

    it('should handle links in document', () => {
      const items = [
        createMockLink({ metadata: { text: 'Click here', href: 'https://example.com/link' } }),
      ];

      generatePdf(items);

      // @ts-expect-error - Mock calls type
      const docDefinition = (mockCreatePdf.mock.calls[0]![0] as unknown) as { content: unknown[] };
      // Should have title, subtitle, and link content
      expect(docDefinition.content.length).toBeGreaterThanOrEqual(3);
    });

    it('should handle images in document', () => {
      const items = [createMockImage()];

      generatePdf(items);

      // @ts-expect-error - Mock calls type
      const docDefinition = (mockCreatePdf.mock.calls[0]![0] as unknown) as { content: unknown[] };
      const imageContent = docDefinition.content.find(
        (c) => typeof c === 'object' && c !== null && 'image' in c
      );
      expect(imageContent).toBeDefined();
    });

    it('should handle text items in document', () => {
      const items = [createMockText()];

      generatePdf(items);

      // @ts-expect-error - Mock calls type
      const docDefinition = (mockCreatePdf.mock.calls[0]![0] as unknown) as { content: { text?: string }[] };
      const textContent = docDefinition.content.find(
        (c) => c.text === 'Captured text content'
      );
      expect(textContent).toBeDefined();
    });

    it('should handle screenshots in document', () => {
      const items = [createMockScreenshot()];

      generatePdf(items);

      // @ts-expect-error - Mock calls type
      const docDefinition = (mockCreatePdf.mock.calls[0]![0] as unknown) as { content: unknown[] };
      const screenshotContent = docDefinition.content.find(
        (c) => typeof c === 'object' && c !== null && 'image' in c
      );
      expect(screenshotContent).toBeDefined();
    });

    it('should sort items by order in document', () => {
      const items = [
        createMockText({ order: 2, metadata: { text: 'Third', sourceUrl: 'https://a.com' } }),
        createMockText({ order: 0, metadata: { text: 'First', sourceUrl: 'https://b.com' } }),
        createMockText({ order: 1, metadata: { text: 'Second', sourceUrl: 'https://c.com' } }),
      ];

      generatePdf(items);

      // @ts-expect-error - Mock calls type
      const docDefinition = (mockCreatePdf.mock.calls[0]![0] as unknown) as { content: { text?: string }[] };
      const textItems = docDefinition.content.filter(
        (c) => c.text === 'First' || c.text === 'Second' || c.text === 'Third'
      );

      expect(textItems[0].text).toBe('First');
      expect(textItems[1].text).toBe('Second');
      expect(textItems[2].text).toBe('Third');
    });

    it('should include styles in document definition', () => {
      generatePdf([createMockLink()]);

      // @ts-expect-error - Mock calls type
      const docDefinition = (mockCreatePdf.mock.calls[0]![0] as unknown) as { styles: Record<string, unknown> };
      expect(docDefinition.styles).toBeDefined();
      expect(docDefinition.styles.title).toBeDefined();
      expect(docDefinition.styles.link).toBeDefined();
    });

    it('should handle mixed item types', () => {
      const items = [
        createMockLink({ order: 0 }),
        createMockImage({ order: 1 }),
        createMockText({ order: 2 }),
        createMockScreenshot({ order: 3 }),
      ];

      generatePdf(items);

      expect(mockCreatePdf).toHaveBeenCalled();
      expect(mockDownload).toHaveBeenCalled();
    });

    it('should show URL below link text when different from text', () => {
      const items = [
        createMockLink({
          metadata: { text: 'Click Here', href: 'https://example.com/full/path' },
        }),
      ];

      generatePdf(items);

      // @ts-expect-error - Mock calls type
      const docDefinition = (mockCreatePdf.mock.calls[0]![0] as unknown) as { content: { text?: string }[] };
      const urlContent = docDefinition.content.find(
        (c) => c.text === 'https://example.com/full/path'
      );
      expect(urlContent).toBeDefined();
    });

    it('should handle invalid URL in sourceUrl gracefully', () => {
      const items = [
        createMockText({ metadata: { text: 'Test', sourceUrl: 'not-a-valid-url' } }),
      ];

      generatePdf(items);

      // @ts-expect-error - Mock calls type
      const docDefinition = (mockCreatePdf.mock.calls[0]![0] as unknown) as { content: { text?: string }[] };
      // Should use the raw string as title when URL parsing fails
      expect(docDefinition.content[0].text).toBe('not-a-valid-url');
    });
  });
});
