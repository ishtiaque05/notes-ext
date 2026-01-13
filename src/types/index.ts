// Type definitions for Notes Collector extension

export interface CapturedItem {
  id: string;
  type: 'link' | 'image' | 'text';
  order: number;
  timestamp: number;
  content: string; // URL, data URL, or text content
  metadata: LinkMetadata | ImageMetadata | TextMetadata;
}

export interface LinkMetadata {
  text: string;
  href: string;
}

export interface ImageMetadata {
  alt: string;
  originalSrc: string;
}

export interface TextMetadata {
  text: string;
  sourceUrl: string; // URL of the page where text was captured
}

export interface StorageData {
  items: CapturedItem[];
  nextOrder: number;
}

// Message types for communication between scripts
export type Message =
  | { type: 'CAPTURE_LINK'; data: { href: string; text: string } }
  | { type: 'CAPTURE_IMAGE'; data: { src: string; alt: string; dataUrl: string } }
  | { type: 'CAPTURE_TEXT'; data: { text: string; sourceUrl: string } }
  | { type: 'FETCH_IMAGE'; data: { url: string } }
  | {
      type: 'CAPTURE_SCREENSHOT';
      data: {
        rect: { x: number; y: number; width: number; height: number };
        alt: string;
        originalSrc: string;
      };
    }
  | { type: 'GET_ITEMS' }
  | { type: 'DELETE_ITEM'; data: { id: string } }
  | { type: 'REORDER_ITEMS'; data: { items: CapturedItem[] } }
  | { type: 'CLEAR_ALL' }
  | { type: 'CHECK_SITE_ENABLED'; data: { tabId: number } }
  | { type: 'TOGGLE_SITE_ENABLED'; data: { tabId: number } };

export interface MessageResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}
