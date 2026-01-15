/**
 * Interactive screenshot overlay logic
 */

let overlay: HTMLDivElement | null = null;
let box: HTMLDivElement | null = null;
let startX = 0;
let startY = 0;
let isDrawing = false;

/**
 * Starts screenshot mode
 */
export function startScreenshotMode(
  clientX: number,
  clientY: number,
  onCapture: (dims: { x: number; y: number; width: number; height: number }) => void
) {
  if (overlay) return;

  overlay = document.createElement('div');
  overlay.className = 'screenshot-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.3);
    cursor: crosshair;
    z-index: 9999999;
  `;

  box = document.createElement('div');
  box.style.cssText = `
    position: fixed;
    border: 2px solid #4a90e2;
    background: rgba(74, 144, 226, 0.1);
    display: none;
    pointer-events: none;
  `;

  overlay.appendChild(box);
  document.body.appendChild(overlay);

  startX = clientX;
  startY = clientY;
  isDrawing = true;

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDrawing || !box) return;

    const currentX = e.clientX;
    const currentY = e.clientY;

    const left = Math.min(startX, currentX);
    const top = Math.min(startY, currentY);
    const width = Math.abs(currentX - startX);
    const height = Math.abs(currentY - startY);

    box.style.display = 'block';
    box.style.left = `${left}px`;
    box.style.top = `${top}px`;
    box.style.width = `${width}px`;
    box.style.height = `${height}px`;
  };

  const handleMouseUp = (e: MouseEvent) => {
    if (!isDrawing) return;
    isDrawing = false;

    const width = Math.abs(e.clientX - startX);
    const height = Math.abs(e.clientY - startY);

    if (width > 5 && height > 5) {
      const rect = {
        x: Math.min(startX, e.clientX),
        y: Math.min(startY, e.clientY),
        width,
        height,
      };
      cleanup();
      // Give the browser a moment to remove the overlay from the DOM
      // so it doesn't appear in the screenshot
      setTimeout(() => onCapture(rect), 50);
    } else {
      cleanup();
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') cleanup();
  };

  const cleanup = () => {
    if (overlay) {
      document.body.removeChild(overlay);
      overlay = null;
      box = null;
    }
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    document.removeEventListener('keydown', handleKeyDown);
  };

  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);
  document.addEventListener('keydown', handleKeyDown);
}

export function isDrawingScreenshot() {
  return isDrawing;
}
