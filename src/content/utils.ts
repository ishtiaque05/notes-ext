/**
 * Content script utilities
 */

/**
 * Visual feedback - briefly show an element was captured
 */
export function showCaptureConfirmation(element: HTMLElement) {
  element.classList.add('notes-collector-captured');

  setTimeout(() => {
    element.classList.remove('notes-collector-captured');
  }, 500);
}

/**
 * Visual feedback - show a temporary notification for text capture
 */
export function showTextCaptureConfirmation() {
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

/**
 * Crops a screenshot to the selected area
 */
export async function cropScreenshot(
  dataUrl: string,
  dimensions: { width: number; height: number; x: number; y: number }
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }

        // Calculate the actual ratio between the physical image size and the logical viewport size
        // This is more reliable than window.devicePixelRatio because it handles zoom correctly
        // and accounts for any browser-specific scaling in captureVisibleTab
        const ratioX = img.width / window.innerWidth;
        const ratioY = img.height / window.innerHeight;

        const scaledX = Math.round(dimensions.x * ratioX);
        const scaledY = Math.round(dimensions.y * ratioY);
        const scaledWidth = Math.round(dimensions.width * ratioX);
        const scaledHeight = Math.round(dimensions.height * ratioY);

        // Sanity checks to avoid canvas errors
        if (scaledWidth <= 0 || scaledHeight <= 0) {
          reject(new Error('Invalid crop dimensions after scaling'));
          return;
        }

        canvas.width = scaledWidth;
        canvas.height = scaledHeight;

        ctx.drawImage(
          img,
          scaledX,
          scaledY,
          scaledWidth,
          scaledHeight,
          0,
          0,
          scaledWidth,
          scaledHeight
        );

        resolve(canvas.toDataURL('image/png', 1.0));
      } catch (e) {
        reject(e instanceof Error ? e : new Error(String(e)));
      }
    };
    img.onerror = () => reject(new Error('Failed to load screenshot for cropping'));
    img.src = dataUrl;
  });
}
