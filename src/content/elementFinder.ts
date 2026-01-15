/**
 * Logic for finding the best elements to capture
 */

/**
 * Checks if an image is likely a placeholder
 */
export function isPlaceholderImage(img: HTMLImageElement): boolean {
  if (img.getAttribute('aria-hidden') === 'true') return true;
  if (img.src.startsWith('data:image/svg+xml')) return true;
  if (img.complete && img.naturalWidth === 0 && img.naturalHeight === 0) return true;
  return false;
}

/**
 * Finds the best image element to capture from a starting element
 */
export function findBestImage(startElement: HTMLElement | null): HTMLImageElement | null {
  if (!startElement) return null;

  const candidates: HTMLImageElement[] = [];

  // If the element itself is an image
  if (startElement.tagName === 'IMG') {
    candidates.push(startElement as HTMLImageElement);
  }

  // Find all images within this element or its parents
  let current: HTMLElement | null = startElement;
  while (current && candidates.length < 5) {
    const images = current.querySelectorAll('img');
    images.forEach((img) => {
      if (!candidates.includes(img)) candidates.push(img);
    });
    current = current.parentElement;
  }

  if (candidates.length === 0) return null;

  // Score candidates
  let bestImage: HTMLImageElement | null = null;
  let bestScore = -1;

  for (const img of candidates) {
    let score = 0;

    if (!img.src) continue;
    if (isPlaceholderImage(img)) {
      score -= 50;
    } else {
      score += 50;
    }

    if (img.naturalWidth > 0 && img.naturalHeight > 0) {
      score += 30;
    } else if (img.offsetWidth > 0 && img.offsetHeight > 0) {
      score += 20;
    }

    if (img.alt || img.getAttribute('title')) score += 10;
    if (img.getAttribute('aria-hidden') !== 'true') score += 5;

    if (score > bestScore) {
      bestScore = score;
      bestImage = img;
    }
  }

  return bestImage;
}

/**
 * Gets direct text content of an element
 */
export function getTextContent(element: HTMLElement): string | null {
  let text = element.textContent?.trim() || '';
  if (text.length < 3) return null;
  if (text.length > 10000) text = text.substring(0, 10000);
  return text;
}
