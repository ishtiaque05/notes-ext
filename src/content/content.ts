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

  // Handle image clicks
  if (target.tagName === 'IMG') {
    const img = target as HTMLImageElement;
    if (img.src) {
      event.preventDefault(); // Prevent default behavior
      captureImage(img);
    }
  }
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

async function captureImage(img: HTMLImageElement) {
  const src = img.src;
  const alt = img.alt || img.getAttribute('title') || 'Image';

  try {
    // Convert image to data URL
    const dataUrl = await imageToDataURL(img);

    // Send message to background script to store the image
    await browser.runtime.sendMessage({
      type: 'CAPTURE_IMAGE',
      data: { src, alt, dataUrl }
    });

    // Visual feedback - briefly show the image was captured
    showCaptureConfirmation(img);
  } catch (error) {
    console.error('Failed to capture image:', error);

    // Try fallback: send without data URL (will store original URL only)
    try {
      await browser.runtime.sendMessage({
        type: 'CAPTURE_IMAGE',
        data: { src, alt, dataUrl: '' }
      });
      showCaptureConfirmation(img);
    } catch (fallbackError) {
      console.error('Fallback capture also failed:', fallbackError);
    }
  }
}

async function imageToDataURL(img: HTMLImageElement): Promise<string> {
  return new Promise((resolve, reject) => {
    // If image is already loaded, convert it
    if (img.complete && img.naturalWidth > 0) {
      convertToDataURL(img, resolve, reject);
    } else {
      // Wait for image to load
      const loadHandler = () => {
        convertToDataURL(img, resolve, reject);
        img.removeEventListener('load', loadHandler);
        img.removeEventListener('error', errorHandler);
      };

      const errorHandler = () => {
        img.removeEventListener('load', loadHandler);
        img.removeEventListener('error', errorHandler);
        reject(new Error('Image failed to load'));
      };

      img.addEventListener('load', loadHandler);
      img.addEventListener('error', errorHandler);
    }
  });
}

function convertToDataURL(
  img: HTMLImageElement,
  resolve: (value: string) => void,
  reject: (reason: Error) => void
) {
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      reject(new Error('Could not get canvas context'));
      return;
    }

    // Set canvas dimensions to match image
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;

    // Draw image to canvas
    ctx.drawImage(img, 0, 0);

    // Convert to data URL
    // Using JPEG with quality 0.8 to reduce size while maintaining quality
    try {
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      resolve(dataUrl);
    } catch (error) {
      // If JPEG conversion fails (e.g., for transparent images), try PNG
      const dataUrl = canvas.toDataURL('image/png');
      resolve(dataUrl);
    }
  } catch (error) {
    // CORS error or other canvas error
    reject(new Error(`Canvas conversion failed: ${error}`));
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
