// Content script for Notes Collector extension
import './content.scss';

const HIGHLIGHT_CLASS = 'notes-collector-highlight';

// Track if extension is enabled for this page
let isEnabled = true;

// Add hover highlighting for links and images
function addHoverListeners() {
  // Use event delegation on document for better performance
  document.addEventListener('mouseover', handleMouseOver);
  document.addEventListener('mouseout', handleMouseOut);
  document.addEventListener('click', handleClick);
}

// Listen for enable/disable messages from background
browser.runtime.onMessage.addListener((message: { type: string; enabled?: boolean }) => {
  if (message.type === 'SITE_ENABLED_CHANGED') {
    isEnabled = message.enabled ?? true;
    updateDisabledState();
  }
});

// Update visual state when extension is disabled
function updateDisabledState() {
  if (!isEnabled) {
    // Remove all highlights
    document.querySelectorAll(`.${HIGHLIGHT_CLASS}`).forEach((el) => {
      el.classList.remove(HIGHLIGHT_CLASS);
    });
  }
}

function handleMouseOver(event: MouseEvent) {
  if (!isEnabled) return;

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

function getTextContent(element: HTMLElement): string | null {
  // Get the direct text content of the element, excluding child elements
  let text = element.textContent?.trim() || '';

  // Filter out very short text (likely not useful)
  if (text.length < 3) {
    return null;
  }

  // Limit to reasonable length (10000 characters max)
  if (text.length > 10000) {
    text = text.substring(0, 10000);
  }

  return text;
}

function handleClick(event: MouseEvent) {
  if (!isEnabled) return;

  const target = event.target as HTMLElement;

  // Check if there's selected text - capture it with Ctrl+Click (or Cmd+Click on Mac)
  const selection = window.getSelection();
  if (selection && selection.toString().trim() && (event.ctrlKey || event.metaKey)) {
    event.preventDefault();
    void captureText(selection.toString().trim());
    return;
  }

  // Handle link clicks
  if (target.tagName === 'A') {
    const link = target as HTMLAnchorElement;
    if (link.href) {
      event.preventDefault(); // Prevent default navigation
      void captureLink(link);
    }
    return;
  }

  // Handle image clicks with Ctrl+Shift+Click
  // This works even when zoom overlays are present
  if ((event.ctrlKey || event.metaKey) && event.shiftKey) {
    // Check if we clicked on an image directly
    if (target.tagName === 'IMG') {
      const img = target as HTMLImageElement;
      if (img.src) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        void captureImage(img);
        return;
      }
    }

    // Check if we clicked on a zoom overlay or container that has an image child
    // This handles cases where zoom buttons/overlays cover the image
    const imgInside = target.querySelector('img');
    if (imgInside?.src) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      void captureImage(imgInside);
      return;
    }

    // Check if the clicked element is inside a container with an image sibling
    // This handles cases where the zoom button is a sibling of the image
    const parent = target.parentElement;
    if (parent) {
      const imgSibling = parent.querySelector('img');
      if (imgSibling?.src) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        void captureImage(imgSibling);
        return;
      }
    }
  }

  // Handle text element clicks with Ctrl+Click (for non-link, non-image elements)
  if (event.ctrlKey || event.metaKey) {
    const textContent = getTextContent(target);
    if (textContent) {
      event.preventDefault();
      void captureText(textContent);
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
      data: { href, text },
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
      data: { src, alt, dataUrl },
    });

    // Visual feedback - briefly show the image was captured
    showCaptureConfirmation(img);
  } catch (error) {
    console.error('Failed to capture image:', error);

    // Determine error reason
    let errorMessage = 'Image captured (URL only - could not embed)';
    const errorStr = error instanceof Error ? error.message : String(error);

    if (errorStr.includes('tainted') || errorStr.includes('CORS') || errorStr.includes('cross-origin')) {
      errorMessage = 'Image captured (URL only - CORS restricted)';
    } else if (errorStr.includes('load')) {
      errorMessage = 'Image captured (URL only - failed to load)';
    }

    // Try fallback: send without data URL (will store original URL only)
    try {
      await browser.runtime.sendMessage({
        type: 'CAPTURE_IMAGE',
        data: { src, alt, dataUrl: '' },
      });

      // Show visual feedback with warning
      showCaptureConfirmation(img);
      console.warn(errorMessage);
    } catch (fallbackError) {
      console.error('Fallback capture also failed:', fallbackError);
    }
  }
}

async function captureText(text: string) {
  try {
    // Send message to background script to store the text
    await browser.runtime.sendMessage({
      type: 'CAPTURE_TEXT',
      data: { text, sourceUrl: window.location.href },
    });

    // Visual feedback - show a temporary notification
    showTextCaptureConfirmation();
  } catch (error) {
    console.error('Failed to capture text:', error);
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
    } catch {
      // If JPEG conversion fails (e.g., for transparent images), try PNG
      const dataUrl = canvas.toDataURL('image/png');
      resolve(dataUrl);
    }
  } catch (err) {
    // CORS error or other canvas error
    reject(new Error(`Canvas conversion failed: ${String(err)}`));
  }
}

function showCaptureConfirmation(element: HTMLElement) {
  // Add a temporary class for visual feedback
  element.classList.add('notes-collector-captured');

  setTimeout(() => {
    element.classList.remove('notes-collector-captured');
  }, 500);
}

function showTextCaptureConfirmation() {
  // Create a temporary notification element
  const notification = document.createElement('div');
  notification.textContent = 'Text captured!';
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #4caf50;
    color: white;
    padding: 12px 20px;
    border-radius: 4px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    z-index: 999999;
    font-family: system-ui, -apple-system, sans-serif;
    font-size: 14px;
    animation: slideIn 0.3s ease-out;
  `;

  document.body.appendChild(notification);

  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease-in';
    setTimeout(() => {
      document.body.removeChild(notification);
    }, 300);
  }, 2000);
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
