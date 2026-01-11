// Content script for Notes Collector extension
import './content.scss';

const HIGHLIGHT_CLASS = 'notes-collector-highlight';

// Add hover highlighting for links and images
function addHoverListeners() {
  // Use event delegation on document for better performance
  document.addEventListener('mouseover', handleMouseOver);
  document.addEventListener('mouseout', handleMouseOut);
  document.addEventListener('click', handleClick);
}

function handleMouseOver(event: MouseEvent) {
  const target = event.target as HTMLElement;

  // Check if target is a link or image
  if (isCapturableElement(target)) {
    target.classList.add(HIGHLIGHT_CLASS);
  }
}

function handleMouseOut(event: MouseEvent) {
  const target = event.target as HTMLElement;

  // Remove highlight from links and images
  if (isCapturableElement(target)) {
    target.classList.remove(HIGHLIGHT_CLASS);
  }
}

function isCapturableElement(element: HTMLElement): boolean {
  // Check if element is a link with href
  if (element.tagName === 'A' && (element as HTMLAnchorElement).href) {
    return true;
  }

  // Check if element is an image with src
  if (element.tagName === 'IMG' && (element as HTMLImageElement).src) {
    return true;
  }

  return false;
}

function handleClick(event: MouseEvent) {
  const target = event.target as HTMLElement;

  // Handle link clicks
  if (target.tagName === 'A') {
    const link = target as HTMLAnchorElement;
    if (link.href) {
      event.preventDefault(); // Prevent default navigation
      captureLink(link);
    }
  }

  // Handle image clicks (will be implemented in Commit 7)
  // TODO: Add image capture in next commit
}

async function captureLink(link: HTMLAnchorElement) {
  const href = link.href;
  const text = link.textContent?.trim() || link.getAttribute('aria-label') || href;

  try {
    // Send message to background script to store the link
    await browser.runtime.sendMessage({
      type: 'CAPTURE_LINK',
      data: { href, text }
    });

    // Visual feedback - briefly show the link was captured
    showCaptureConfirmation(link);
  } catch (error) {
    console.error('Failed to capture link:', error);
  }
}

function showCaptureConfirmation(element: HTMLElement) {
  // Add a temporary class for visual feedback
  element.classList.add('notes-collector-captured');

  setTimeout(() => {
    element.classList.remove('notes-collector-captured');
  }, 500);
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', addHoverListeners);
} else {
  addHoverListeners();
}

if (process.env.NODE_ENV === 'development') {
  console.warn('Notes Collector: Content script initialized');
}
