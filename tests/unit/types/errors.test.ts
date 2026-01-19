import { describe, it, expect } from 'vitest';
import {
  NotesCollectorError,
  StorageQuotaError,
  StorageError,
  ImageCaptureError,
  PdfGenerationError,
  ItemLimitError,
} from '../../../src/types/errors';

describe('error classes', () => {
  describe('NotesCollectorError', () => {
    it('should have correct name', () => {
      const error = new NotesCollectorError('test message');
      expect(error.name).toBe('NotesCollectorError');
    });

    it('should have correct message', () => {
      const error = new NotesCollectorError('test message');
      expect(error.message).toBe('test message');
    });

    it('should have userMessage when provided', () => {
      const error = new NotesCollectorError('technical message', 'user friendly message');
      expect(error.userMessage).toBe('user friendly message');
    });

    it('should have undefined userMessage when not provided', () => {
      const error = new NotesCollectorError('test message');
      expect(error.userMessage).toBeUndefined();
    });

    it('should be instance of Error', () => {
      const error = new NotesCollectorError('test');
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe('StorageQuotaError', () => {
    it('should have correct name', () => {
      const error = new StorageQuotaError();
      expect(error.name).toBe('StorageQuotaError');
    });

    it('should have default message', () => {
      const error = new StorageQuotaError();
      expect(error.message).toBe('Storage quota exceeded');
    });

    it('should accept custom message', () => {
      const error = new StorageQuotaError('Custom quota message');
      expect(error.message).toBe('Custom quota message');
    });

    it('should have user-friendly message', () => {
      const error = new StorageQuotaError();
      expect(error.userMessage).toContain('Storage limit reached');
    });

    it('should be instance of NotesCollectorError', () => {
      const error = new StorageQuotaError();
      expect(error).toBeInstanceOf(NotesCollectorError);
    });
  });

  describe('StorageError', () => {
    it('should have correct name', () => {
      const error = new StorageError('Storage failed');
      expect(error.name).toBe('StorageError');
    });

    it('should have provided message', () => {
      const error = new StorageError('Storage failed');
      expect(error.message).toBe('Storage failed');
    });

    it('should have default userMessage', () => {
      const error = new StorageError('Storage failed');
      expect(error.userMessage).toBe('Failed to save data. Please try again.');
    });

    it('should accept custom userMessage', () => {
      const error = new StorageError('Storage failed', 'Custom user message');
      expect(error.userMessage).toBe('Custom user message');
    });

    it('should be instance of NotesCollectorError', () => {
      const error = new StorageError('test');
      expect(error).toBeInstanceOf(NotesCollectorError);
    });
  });

  describe('ImageCaptureError', () => {
    it('should have correct name', () => {
      const error = new ImageCaptureError('CORS error', 'cors');
      expect(error.name).toBe('ImageCaptureError');
    });

    it('should have reason property', () => {
      const error = new ImageCaptureError('CORS error', 'cors');
      expect(error.reason).toBe('cors');
    });

    it('should have correct userMessage for cors reason', () => {
      const error = new ImageCaptureError('CORS error', 'cors');
      expect(error.userMessage).toContain('security restrictions');
    });

    it('should have correct userMessage for network reason', () => {
      const error = new ImageCaptureError('Network error', 'network');
      expect(error.userMessage).toContain('check your connection');
    });

    it('should have correct userMessage for size reason', () => {
      const error = new ImageCaptureError('Size error', 'size');
      expect(error.userMessage).toContain('too large');
    });

    it('should have correct userMessage for unknown reason', () => {
      const error = new ImageCaptureError('Unknown error', 'unknown');
      expect(error.userMessage).toContain('try again');
    });

    it('should be instance of NotesCollectorError', () => {
      const error = new ImageCaptureError('test', 'cors');
      expect(error).toBeInstanceOf(NotesCollectorError);
    });
  });

  describe('PdfGenerationError', () => {
    it('should have correct name', () => {
      const error = new PdfGenerationError('PDF failed');
      expect(error.name).toBe('PdfGenerationError');
    });

    it('should have provided message', () => {
      const error = new PdfGenerationError('PDF generation failed');
      expect(error.message).toBe('PDF generation failed');
    });

    it('should have user-friendly message', () => {
      const error = new PdfGenerationError('PDF failed');
      expect(error.userMessage).toContain('Failed to generate PDF');
    });

    it('should be instance of NotesCollectorError', () => {
      const error = new PdfGenerationError('test');
      expect(error).toBeInstanceOf(NotesCollectorError);
    });
  });

  describe('ItemLimitError', () => {
    it('should have correct name', () => {
      const error = new ItemLimitError(1000);
      expect(error.name).toBe('ItemLimitError');
    });

    it('should have limit property', () => {
      const error = new ItemLimitError(1000);
      expect(error.limit).toBe(1000);
    });

    it('should include limit in message', () => {
      const error = new ItemLimitError(1000);
      expect(error.message).toContain('1000');
    });

    it('should include limit in userMessage', () => {
      const error = new ItemLimitError(500);
      expect(error.userMessage).toContain('500');
    });

    it('should be instance of NotesCollectorError', () => {
      const error = new ItemLimitError(1000);
      expect(error).toBeInstanceOf(NotesCollectorError);
    });
  });
});
