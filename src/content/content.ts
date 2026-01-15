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
  document.addEventListener('mousedown', handleMouseDown);
  document.addEventListener('click', handleClick);
}

// Listen for enable/disable messages from background
browser.runtime.onMessage.addListener((message: { type: string; enabled?: boolean }) => {
  if (process.env.NODE_ENV === 'development') {
    console.warn('=== CONTENT: Received message ===');
    console.warn('Message type:', message.type);
    console.warn('Message enabled:', message.enabled);
  }

  if (message.type === 'SITE_ENABLED_CHANGED') {
    isEnabled = message.enabled ?? true;

    if (process.env.NODE_ENV === 'development') {
      console.warn('=== CONTENT: Extension state changed ===');
      console.warn('New isEnabled state:', isEnabled);
    }

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

function handleMouseDown(event: MouseEvent) {
  if (!isEnabled) return;

  const target = event.target as HTMLElement;

  // Handle screenshot mode with Shift+Click
  if (event.shiftKey && !target.closest('.screenshot-overlay')) {
    event.preventDefault();
    startScreenshotMode(event.clientX, event.clientY);
    return;
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

/**
 * Finds the best image element to capture from a starting element.
 * Handles cases where there are multiple nested images (placeholder + actual image).
 * Returns the image most likely to contain actual content (not placeholders or SVGs).
 */
function findBestImage(startElement: HTMLElement | null): HTMLImageElement | null {
  if (!startElement) {
    return null;
  }

  // Collect all possible images to consider
  const allCandidates: HTMLImageElement[] = [];

  // If starting element is an image, add it
  if (startElement.tagName === 'IMG') {
    allCandidates.push(startElement as HTMLImageElement);
  }

  // Look in parent for sibling images (common pattern: placeholder + real image as siblings)
  if (startElement.parentElement) {
    const siblingImages = Array.from(startElement.parentElement.querySelectorAll('img'));
    allCandidates.push(...siblingImages);
  }

  // Look in children for nested images
  const childImages = Array.from(startElement.querySelectorAll('img'));
  allCandidates.push(...childImages);

  // Remove duplicates
  const uniqueImages = Array.from(new Set(allCandidates));

  if (process.env.NODE_ENV === 'development') {
    console.warn(`=== FINDING BEST IMAGE (found ${uniqueImages.length} candidates) ===`);
  }

  // Score each image and pick the best one
  let bestImage: HTMLImageElement | null = null;
  let bestScore = -1;

  for (const img of uniqueImages) {
    if (!img.src) continue;

    let score = 0;
    const scoreDetails: string[] = [];

    // Strongly prefer non-placeholder images
    if (!isPlaceholderImage(img)) {
      score += 100;
      scoreDetails.push('not-placeholder:+100');
    }

    // Prefer images with actual content (non-SVG data URLs or HTTP URLs)
    if (!img.src.startsWith('data:image/svg+xml')) {
      score += 50;
      scoreDetails.push('non-svg:+50');
    }

    // Prefer images with dimensions
    if (img.naturalWidth > 0 && img.naturalHeight > 0) {
      score += 30;
      scoreDetails.push(`natural-dims(${img.naturalWidth}x${img.naturalHeight}):+30`);
    } else if (img.offsetWidth > 0 && img.offsetHeight > 0) {
      score += 20;
      scoreDetails.push(`offset-dims(${img.offsetWidth}x${img.offsetHeight}):+20`);
    }

    // Prefer images with alt text or title
    if (img.alt || img.getAttribute('title')) {
      score += 10;
      scoreDetails.push('has-alt:+10');
    }

    // Prefer visible images (not aria-hidden)
    if (img.getAttribute('aria-hidden') !== 'true') {
      score += 5;
      scoreDetails.push('visible:+5');
    }

    if (process.env.NODE_ENV === 'development') {
      const srcPreview = img.src.substring(0, 60) + (img.src.length > 60 ? '...' : '');
      console.warn(`  Candidate: score=${score} src="${srcPreview}"`);
      console.warn(`    Details: ${scoreDetails.join(', ')}`);
    }

    if (score > bestScore) {
      bestScore = score;
      bestImage = img;
    }
  }

  if (process.env.NODE_ENV === 'development') {
    console.warn(`  Best image score: ${bestScore}`);
  }

  return bestImage;
}

/**
 * Checks if an image is likely a placeholder (SVG, aria-hidden, or has placeholder-like src)
 */
function isPlaceholderImage(img: HTMLImageElement): boolean {
  // Check if aria-hidden (common for placeholder images)
  if (img.getAttribute('aria-hidden') === 'true') {
    return true;
  }

  // Check if src is a data URL with SVG (common placeholder pattern)
  if (img.src.startsWith('data:image/svg+xml')) {
    return true;
  }

  // Check if image has zero natural dimensions (placeholder pattern)
  // Note: We need to be careful here as some real images might not be loaded yet
  if (img.complete && img.naturalWidth === 0 && img.naturalHeight === 0) {
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
  if (process.env.NODE_ENV === 'development') {
    console.warn('=== CONTENT: Click detected ===');
    console.warn('isEnabled:', isEnabled);
    console.warn('Ctrl/Meta:', event.ctrlKey || event.metaKey);
    console.warn('Shift:', event.shiftKey);
  }

  if (!isEnabled) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('=== CONTENT: Extension is disabled, ignoring click ===');
    }
    return;
  }

  const target = event.target as HTMLElement;

  // Ignore clicks during screenshot mode
  if (isDrawingScreenshot) {
    return;
  }

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
      const img = findBestImage(target as HTMLImageElement);
      if (img?.src) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        void captureImage(img);
        return;
      }
    }

    // Check if we clicked on a zoom overlay or container that has an image child
    // This handles cases where zoom buttons/overlays cover the image
    const imgInside = findBestImage(target.querySelector('img'));
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
      const imgSibling = findBestImage(parent.querySelector('img'));
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

  // Debug logging
  if (process.env.NODE_ENV === 'development') {
    console.warn('=== CAPTURING IMAGE VIA SCREENSHOT ===');
    console.warn('Image src:', src);
    console.warn('Image alt:', alt);
  }

  try {
    // Get the bounding rectangle of the image relative to the viewport
    const rect = img.getBoundingClientRect();

    if (process.env.NODE_ENV === 'development') {
      console.warn('Image viewport position:', {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
      });
    }

    // Send message to background script to capture screenshot
    await browser.runtime.sendMessage({
      type: 'CAPTURE_SCREENSHOT',
      data: {
        rect: {
          x: Math.floor(rect.x),
          y: Math.floor(rect.y),
          width: Math.ceil(rect.width),
          height: Math.ceil(rect.height),
        },
        alt,
        originalSrc: src,
      },
    });

    // Visual feedback - briefly show the image was captured
    showCaptureConfirmation(img);
  } catch (error) {
    console.error('Failed to capture image screenshot:', error);
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
    animation: slide-in 0.3s ease-out;
  `;

  document.body.appendChild(notification);

  setTimeout(() => {
    notification.style.animation = 'slide-out 0.3s ease-in';
    setTimeout(() => {
      document.body.removeChild(notification);
    }, 300);
  }, 2000);
}

// Screenshot mode state
let screenshotOverlay: HTMLDivElement | null = null;
let screenshotBox: HTMLDivElement | null = null;
let screenshotStartX = 0;
let screenshotStartY = 0;
let isDrawingScreenshot = false;

function startScreenshotMode(clientX: number, clientY: number) {
  if (!isEnabled) return;

  // Create overlay
  screenshotOverlay = document.createElement('div');
  screenshotOverlay.className = 'screenshot-overlay';
  screenshotOverlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.3);
    z-index: 999998;
    cursor: crosshair;
  `;

  // Create selection box
  screenshotBox = document.createElement('div');
  screenshotBox.className = 'screenshot-box';
  screenshotBox.style.cssText = `
    position: fixed;
    border: 2px dashed #4caf50;
    background: rgba(76, 175, 80, 0.1);
    z-index: 999999;
    pointer-events: none;
  `;

  document.body.appendChild(screenshotOverlay);
  document.body.appendChild(screenshotBox);

  // Store starting position
  screenshotStartX = clientX;
  screenshotStartY = clientY;
  isDrawingScreenshot = true;

  // Set initial box position
  screenshotBox.style.left = `${clientX}px`;
  screenshotBox.style.top = `${clientY}px`;
  screenshotBox.style.width = '0px';
  screenshotBox.style.height = '0px';

  // Add event listeners
  document.addEventListener('mousemove', handleScreenshotDrag);
  document.addEventListener('mouseup', handleScreenshotEnd);
  document.addEventListener('keydown', handleScreenshotKeydown);

  // Prevent default hover highlighting during screenshot mode
  document.removeEventListener('mouseover', handleMouseOver);
  document.removeEventListener('mouseout', handleMouseOut);
}

function handleScreenshotDrag(event: MouseEvent) {
  if (!isDrawingScreenshot || !screenshotBox) return;

  const currentX = event.clientX;
  const currentY = event.clientY;

  // Calculate box dimensions
  const left = Math.min(screenshotStartX, currentX);
  const top = Math.min(screenshotStartY, currentY);
  const width = Math.abs(currentX - screenshotStartX);
  const height = Math.abs(currentY - screenshotStartY);

  // Update box position and size
  screenshotBox.style.left = `${left}px`;
  screenshotBox.style.top = `${top}px`;
  screenshotBox.style.width = `${width}px`;
  screenshotBox.style.height = `${height}px`;
}

function handleScreenshotEnd(event: MouseEvent) {
  if (!isDrawingScreenshot || !screenshotBox || !screenshotOverlay) return;

  event.preventDefault();

  const currentX = event.clientX;
  const currentY = event.clientY;

  // Calculate final dimensions
  const left = Math.min(screenshotStartX, currentX);
  const top = Math.min(screenshotStartY, currentY);
  const width = Math.abs(currentX - screenshotStartX);
  const height = Math.abs(currentY - screenshotStartY);

  // Clean up event listeners
  removeScreenshotListeners();

  // Remove overlay and box
  cleanupScreenshotMode();

  // Only capture if there's a meaningful selection (at least 10x10 pixels)
  if (width > 10 && height > 10) {
    void captureScreenshot(left, top, width, height);
  }

  // Re-enable hover highlighting
  document.addEventListener('mouseover', handleMouseOver);
  document.addEventListener('mouseout', handleMouseOut);
}

function handleScreenshotKeydown(event: KeyboardEvent) {
  // Cancel screenshot mode on Escape key
  if (event.key === 'Escape') {
    event.preventDefault();
    cancelScreenshotMode();
  }
}

function cancelScreenshotMode() {
  removeScreenshotListeners();
  cleanupScreenshotMode();

  // Re-enable hover highlighting
  document.addEventListener('mouseover', handleMouseOver);
  document.addEventListener('mouseout', handleMouseOut);
}

function removeScreenshotListeners() {
  document.removeEventListener('mousemove', handleScreenshotDrag);
  document.removeEventListener('mouseup', handleScreenshotEnd);
  document.removeEventListener('keydown', handleScreenshotKeydown);
}

function cleanupScreenshotMode() {
  if (screenshotOverlay && screenshotOverlay.parentNode) {
    screenshotOverlay.parentNode.removeChild(screenshotOverlay);
  }
  if (screenshotBox && screenshotBox.parentNode) {
    screenshotBox.parentNode.removeChild(screenshotBox);
  }

  screenshotOverlay = null;
  screenshotBox = null;
  isDrawingScreenshot = false;
}

async function captureScreenshot(x: number, y: number, width: number, height: number) {
  try {
    // Show loading notification
    const notification = document.createElement('div');
    notification.textContent = 'Capturing screenshot...';
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #2196f3;
      color: white;
      padding: 12px 20px;
      border-radius: 4px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      z-index: 999999;
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 14px;
    `;
    document.body.appendChild(notification);

    // Request background script to capture screenshot
    const response = await browser.runtime.sendMessage({
      type: 'REQUEST_SCREENSHOT',
      data: {
        dimensions: { width, height, x: x + window.scrollX, y: y + window.scrollY },
      },
    });

    if (response && response.success) {
      // Update notification to success
      notification.textContent = 'Screenshot captured!';
      notification.style.background = '#4caf50';

      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 2000);
    } else {
      throw new Error(response?.error || 'Unknown error');
    }
  } catch (error) {
    console.error('Failed to capture screenshot:', error);

    // Show error notification
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const notification = document.createElement('div');
    notification.textContent = `Failed: ${errorMessage.substring(0, 50)}`;
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #f44336;
      color: white;
      padding: 12px 20px;
      border-radius: 4px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      z-index: 999999;
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 14px;
      max-width: 400px;
    `;
    document.body.appendChild(notification);

    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 4000);
  }
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
