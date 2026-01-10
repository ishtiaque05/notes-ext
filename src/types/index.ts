// Type definitions for Notes Collector extension

export interface CapturedItem {
  id: string;
  type: 'link' | 'image';
  order: number;
  timestamp: number;
  content: string; // URL or data URL
  metadata: LinkMetadata | ImageMetadata;
}

export interface LinkMetadata {
  text: string;
  href: string;
}

export interface ImageMetadata {
  alt: string;
  originalSrc: string;
}

export interface StorageData {
  items: CapturedItem[];
  nextOrder: number;
}

// Message types for communication between scripts
export type Message =
  | { type: 'CAPTURE_LINK'; data: { href: string; text: string } }
  | { type: 'CAPTURE_IMAGE'; data: { src: string; alt: string; dataUrl: string } }
  | { type: 'GET_ITEMS' }
  | { type: 'DELETE_ITEM'; data: { id: string } }
  | { type: 'REORDER_ITEMS'; data: { items: CapturedItem[] } }
  | { type: 'CLEAR_ALL' };

export interface MessageResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}
