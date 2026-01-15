/**
 * Component for rendering captured items in the sidebar
 */
import { CapturedItem } from '../../types';
import { escapeHtml } from '../../utils/dom';

export interface ItemCallbacks {
  onDelete: (id: string) => void;
  onDragStart: (e: DragEvent) => void;
  onDragOver: (e: DragEvent) => void;
  onDrop: (e: DragEvent) => void;
  onDragEnd: (e: DragEvent) => void;
  onDragEnter: (e: DragEvent) => void;
  onDragLeave: (e: DragEvent) => void;
}

/**
 * Renders a single captured item as an HTMLLIElement
 */
export function createItemElement(item: CapturedItem, callbacks: ItemCallbacks): HTMLLIElement {
  const li = document.createElement('li');
  li.className = 'item';
  li.dataset.itemId = item.id;
  li.draggable = true;

  let contentHtml = '';

  if (item.type === 'link' && 'href' in item.metadata) {
    contentHtml = `
      <div class="item-content">
        <span class="item-drag-handle" title="Drag to reorder">⋮⋮</span>
        <span class="item-icon link-icon">🔗</span>
        <div class="item-text">
          <div class="item-title">${escapeHtml(item.metadata.text)}</div>
          <div class="item-url">${escapeHtml(item.metadata.href)}</div>
        </div>
      </div>
    `;
  } else if (item.type === 'image' && 'alt' in item.metadata && 'originalSrc' in item.metadata) {
    contentHtml = `
      <div class="item-content">
        <span class="item-drag-handle" title="Drag to reorder">⋮⋮</span>
        <img class="item-thumbnail" src="${escapeHtml(item.content)}" alt="${escapeHtml(item.metadata.alt)}" />
        <div class="item-text">
          <div class="item-title">${escapeHtml(item.metadata.alt)}</div>
          <div class="item-url">${escapeHtml(item.metadata.originalSrc)}</div>
        </div>
      </div>
    `;
  } else if (item.type === 'text' && 'text' in item.metadata && 'sourceUrl' in item.metadata) {
    const truncatedText =
      item.metadata.text.length > 100
        ? item.metadata.text.substring(0, 100) + '...'
        : item.metadata.text;

    contentHtml = `
      <div class="item-content">
        <span class="item-drag-handle" title="Drag to reorder">⋮⋮</span>
        <span class="item-icon text-icon">📝</span>
        <div class="item-text">
          <div class="item-title">${escapeHtml(truncatedText)}</div>
          <div class="item-url">${escapeHtml(item.metadata.sourceUrl)}</div>
        </div>
      </div>
    `;
  } else if (item.type === 'screenshot' && 'dimensions' in item.metadata) {
    contentHtml = `
      <div class="item-content">
        <span class="item-drag-handle" title="Drag to reorder">⋮⋮</span>
        <img class="item-thumbnail" src="${escapeHtml(item.content)}" alt="${escapeHtml(item.metadata.alt)}" />
        <div class="item-text">
          <div class="item-title">${escapeHtml(item.metadata.alt)}</div>
          <div class="item-url">${escapeHtml(item.metadata.sourceUrl)}</div>
        </div>
      </div>
    `;
  }

  li.innerHTML = `
    ${contentHtml}
    <div class="item-actions">
      <button class="delete-btn" title="Delete" data-id="${item.id}">✕</button>
    </div>
  `;

  // Add delete button event listener
  const deleteBtn = li.querySelector('.delete-btn') as HTMLButtonElement;
  if (deleteBtn) {
    deleteBtn.addEventListener('click', () => {
      callbacks.onDelete(item.id);
    });
  }

  // Add drag event listeners
  li.addEventListener('dragstart', callbacks.onDragStart);
  li.addEventListener('dragover', callbacks.onDragOver);
  li.addEventListener('drop', callbacks.onDrop);
  li.addEventListener('dragend', callbacks.onDragEnd);
  li.addEventListener('dragenter', callbacks.onDragEnter);
  li.addEventListener('dragleave', callbacks.onDragLeave);

  return li;
}
