/**
 * Content script entry point for Notes Collector extension
 */
import './content.scss';
import { isCapturableElement } from '../utils/dom';
import { findBestImage } from './elementFinder';
import { showCaptureConfirmation, showTextCaptureConfirmation, cropScreenshot } from './utils';
import { startScreenshotMode, isDrawingScreenshot } from './components/screenshotOverlay';

const HIGHLIGHT_CLASS = 'notes-collector-highlight';
let isEnabled = true;

// Initialize content script
function init() {
  document.addEventListener('mouseover', handleMouseOver);
  document.addEventListener('mouseout', handleMouseOut);
  document.addEventListener('mousedown', handleMouseDown);
  document.addEventListener('click', handleClick);

  // Listen for enable/disable messages from background
  browser.runtime.onMessage.addListener((message: unknown) => {
    const msg = message as { type: string; enabled?: boolean; data?: { enabled: boolean } };
    if (msg.type === 'SITE_ENABLED_CHANGED') {
      isEnabled = msg.enabled ?? msg.data?.enabled ?? true;
      updateDisabledState();
    }
  });

  // Check initial enabled state
  void checkSiteEnabled();
}

async function checkSiteEnabled() {
  try {
    const response = (await browser.runtime.sendMessage({
      type: 'CHECK_SITE_ENABLED',
      data: {},
    })) as {
      success: boolean;
      data?: { enabled: boolean };
    };
    if (response.success && response.data) {
      isEnabled = response.data.enabled;
      updateDisabledState();
    }
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('Failed to check initial enabled state:', error);
    }
  }
}

function updateDisabledState() {
  if (!isEnabled) {
    document.querySelectorAll(`.${HIGHLIGHT_CLASS}`).forEach((el) => {
      el.classList.remove(HIGHLIGHT_CLASS);
    });
  }
}

function handleMouseOver(event: MouseEvent) {
  if (!isEnabled) return;
  const target = event.target as HTMLElement;
  if (isCapturableElement(target)) {
    target.classList.add(HIGHLIGHT_CLASS);
  }
}

function handleMouseOut(event: MouseEvent) {
  const target = event.target as HTMLElement;
  if (isCapturableElement(target)) {
    target.classList.remove(HIGHLIGHT_CLASS);
  }
}

function handleMouseDown(event: MouseEvent) {
  if (!isEnabled) return;
  const target = event.target as HTMLElement;

  // Handle screenshot mode with Shift+Click
  if (event.shiftKey && !target.closest('.screenshot-overlay')) {
    event.preventDefault();
    startScreenshotMode(event.clientX, event.clientY, (rect) => {
      void captureScreenshotArea(rect);
    });
  }
}

function handleClick(event: MouseEvent) {
  if (!isEnabled || isDrawingScreenshot()) return;

  const target = event.target as HTMLElement;
  const selection = window.getSelection();

  // Handle image clicks with Ctrl+Shift+Click
  if ((event.ctrlKey || event.metaKey) && event.shiftKey) {
    const img = findBestImage(target);
    if (img?.src) {
      event.preventDefault();
      event.stopPropagation();
      void captureImage(img);
      return;
    }
  }

  // Handle link clicks - priority over arbitrary text selection if clicking directly on a link
  const link = target.closest('a');
  if (link && link.href && (event.ctrlKey || event.metaKey)) {
    event.preventDefault();
    void captureLink(link);
    return;
  }

  // Capture selected text with Ctrl+Click
  if (selection && selection.toString().trim() && (event.ctrlKey || event.metaKey)) {
    event.preventDefault();
    void captureText(selection.toString().trim());
    return;
  }
}

async function captureLink(link: HTMLAnchorElement) {
  try {
    const text = link.innerText.trim() || link.title || link.href;
    await browser.runtime.sendMessage({
      type: 'CAPTURE_LINK',
      data: { href: link.href, text },
    });
    showCaptureConfirmation(link);
  } catch (error) {
    console.error('Failed to capture link:', error);
  }
}

async function captureImage(img: HTMLImageElement) {
  const src = img.src;
  const alt = img.alt || img.title || 'Captured image';

  try {
    const response = (await browser.runtime.sendMessage({
      type: 'FETCH_IMAGE',
      data: { url: src },
    })) as { success: boolean; data?: { dataUrl: string } };

    if (response.success && response.data?.dataUrl) {
      await browser.runtime.sendMessage({
        type: 'CAPTURE_IMAGE',
        data: {
          src,
          alt,
          dataUrl: response.data.dataUrl,
        },
      });
      // Also send screenshot info if we want to store dimensions,
      // but original code used CAPTURE_IMAGE or CAPTURE_SCREENSHOT interchangeably?
      // Let's check original background.ts.
      showCaptureConfirmation(img);
    }
  } catch (error) {
    console.error('Failed to capture image:', error);
  }
}

async function captureText(text: string) {
  try {
    await browser.runtime.sendMessage({
      type: 'CAPTURE_TEXT',
      data: { text, sourceUrl: window.location.href },
    });
    showTextCaptureConfirmation();
  } catch (error) {
    console.error('Failed to capture text:', error);
  }
}

async function captureScreenshotArea(rect: {
  x: number;
  y: number;
  width: number;
  height: number;
}) {
  try {
    const response = (await browser.runtime.sendMessage({
      type: 'REQUEST_SCREENSHOT',
      data: {
        dimensions: rect,
        pixelRatio: window.devicePixelRatio,
      },
    })) as { success: boolean; data: { dataUrl: string } };

    if (response.success && response.data.dataUrl) {
      // ratio/scaling is now handled internally by cropScreenshot using actual image dimensions
      const croppedDataUrl = await cropScreenshot(response.data.dataUrl, rect);
      await browser.runtime.sendMessage({
        type: 'CAPTURE_SCREENSHOT',
        data: {
          dataUrl: croppedDataUrl,
          sourceUrl: window.location.href,
          dimensions: rect,
        },
      });
    }
  } catch (error) {
    console.error('Failed to capture screenshot area:', error);
  }
}

// Start the script
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
