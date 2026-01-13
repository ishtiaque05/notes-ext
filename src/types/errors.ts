// Custom error types for Notes Collector extension

/**
 * Base error class for Notes Collector errors
 */
export class NotesCollectorError extends Error {
  constructor(
    message: string,
    public readonly userMessage?: string
  ) {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when storage quota is exceeded
 */
export class StorageQuotaError extends NotesCollectorError {
  constructor(message: string = 'Storage quota exceeded') {
    super(
      message,
      'Storage limit reached. Please delete some items or export to PDF and clear all items.'
    );
  }
}

/**
 * Thrown when storage operations fail
 */
export class StorageError extends NotesCollectorError {
  constructor(message: string, userMessage?: string) {
    super(message, userMessage || 'Failed to save data. Please try again.');
  }
}

/**
 * Thrown when image capture fails due to CORS or network issues
 */
export class ImageCaptureError extends NotesCollectorError {
  constructor(
    message: string,
    public readonly reason: 'cors' | 'network' | 'size' | 'unknown'
  ) {
    const userMessages = {
      cors: 'This image cannot be captured due to security restrictions.',
      network: 'Failed to load image. Please check your connection.',
      size: 'Image is too large to capture.',
      unknown: 'Failed to capture image. Please try again.',
    };
    super(message, userMessages[reason]);
  }
}

/**
 * Thrown when PDF generation fails
 */
export class PdfGenerationError extends NotesCollectorError {
  constructor(message: string) {
    super(message, 'Failed to generate PDF. Please try again.');
  }
}

/**
 * Thrown when item limit is reached
 */
export class ItemLimitError extends NotesCollectorError {
  constructor(public readonly limit: number) {
    super(
      `Item limit of ${limit} reached`,
      `You have reached the maximum of ${limit} items. Please export to PDF and clear some items.`
    );
  }
}
