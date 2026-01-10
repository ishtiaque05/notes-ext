// Content script for Notes Collector extension
import './content.scss';

const HIGHLIGHT_CLASS = 'notes-collector-highlight';

// Add hover highlighting for links and images
function addHoverListeners() {
  // Use event delegation on document for better performance
  document.addEventListener('mouseover', handleMouseOver);
  document.addEventListener('mouseout', handleMouseOut);
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

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', addHoverListeners);
} else {
  addHoverListeners();
}

if (process.env.NODE_ENV === 'development') {
  console.warn('Notes Collector: Content script initialized');
}
