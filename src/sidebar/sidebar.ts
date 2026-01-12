// Sidebar UI logic for Notes Collector extension
import './sidebar.scss';
import type { CapturedItem } from '../types';

let capturedItems: CapturedItem[] = [];
let isExtensionEnabled = true;
let currentTabId: number | null = null;

// DOM elements
let itemsContainer: HTMLElement;
let savePdfBtn: HTMLButtonElement;
let clearAllBtn: HTMLButtonElement;
let toggleEnabledBtn: HTMLButtonElement;
let subtitle: HTMLElement;

if (process.env.NODE_ENV === 'development') {
  console.warn('Notes Collector: Sidebar script loaded');
}

// Initialize sidebar
document.addEventListener('DOMContentLoaded', () => {
  void (async () => {
    if (process.env.NODE_ENV === 'development') {
      console.warn('Sidebar DOM loaded');
    }

    // Get DOM elements
    itemsContainer = document.getElementById('items-container')!;
    savePdfBtn = document.getElementById('save-pdf-btn') as HTMLButtonElement;
    clearAllBtn = document.getElementById('clear-all-btn') as HTMLButtonElement;
    toggleEnabledBtn = document.getElementById('toggle-enabled-btn') as HTMLButtonElement;
    subtitle = document.querySelector('.subtitle')!;

    // Get current tab ID
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    if (tabs[0]?.id) {
      currentTabId = tabs[0].id;
    }

    // Load items from storage
    await loadItems();

    // Set up event listeners
    savePdfBtn.addEventListener('click', () => {
      void handleSavePdf();
    });
    clearAllBtn.addEventListener('click', () => {
      void handleClearAll();
    });
    toggleEnabledBtn.addEventListener('click', () => {
      void handleToggleEnabled();
    });

    // Listen for new items from background script
    browser.runtime.onMessage.addListener(handleBackgroundMessage);
  })();
});

// Load items from storage
async function loadItems() {
  try {
    const response = (await browser.runtime.sendMessage({ type: 'GET_ITEMS' })) as {
      success: boolean;
      data?: CapturedItem[];
    };

    if (response.success && response.data) {
      capturedItems = response.data;
      renderItems();
      updateUI();
    }
  } catch (error) {
    console.error('Failed to load items:', error);
  }
}

// Render all items to the DOM
function renderItems() {
  // Clear container
  itemsContainer.innerHTML = '';

  if (capturedItems.length === 0) {
    itemsContainer.innerHTML =
      '<p class="empty-state">No items captured yet. Click on links/images or Ctrl+Click selected text to capture.</p>';
    return;
  }

  // Sort by order
  const sortedItems = [...capturedItems].sort((a, b) => a.order - b.order);

  // Create list container
  const listElement = document.createElement('ul');
  listElement.className = 'items-list';

  // Render each item
  sortedItems.forEach((item) => {
    const itemElement = renderItem(item);
    listElement.appendChild(itemElement);
  });

  itemsContainer.appendChild(listElement);
}

// Render a single item
function renderItem(item: CapturedItem): HTMLLIElement {
  const li = document.createElement('li');
  li.className = 'item';
  li.dataset.itemId = item.id;
  li.draggable = true;

  if (item.type === 'link' && 'href' in item.metadata) {
    li.innerHTML = `
      <div class="item-content">
        <span class="item-drag-handle" title="Drag to reorder">⋮⋮</span>
        <span class="item-icon link-icon">🔗</span>
        <div class="item-text">
          <div class="item-title">${escapeHtml(item.metadata.text)}</div>
          <div class="item-url">${escapeHtml(item.metadata.href)}</div>
        </div>
      </div>
      <div class="item-actions">
        <button class="delete-btn" title="Delete" data-id="${item.id}">✕</button>
      </div>
    `;
  } else if (item.type === 'image' && 'alt' in item.metadata) {
    li.innerHTML = `
      <div class="item-content">
        <span class="item-drag-handle" title="Drag to reorder">⋮⋮</span>
        <img class="item-thumbnail" src="${escapeHtml(item.content)}" alt="${escapeHtml(item.metadata.alt)}" />
        <div class="item-text">
          <div class="item-title">${escapeHtml(item.metadata.alt)}</div>
          <div class="item-url">${escapeHtml(item.metadata.originalSrc)}</div>
        </div>
      </div>
      <div class="item-actions">
        <button class="delete-btn" title="Delete" data-id="${item.id}">✕</button>
      </div>
    `;
  } else if (item.type === 'text' && 'sourceUrl' in item.metadata) {
    const truncatedText = item.metadata.text.length > 100
      ? item.metadata.text.substring(0, 100) + '...'
      : item.metadata.text;

    li.innerHTML = `
      <div class="item-content">
        <span class="item-drag-handle" title="Drag to reorder">⋮⋮</span>
        <span class="item-icon text-icon">📝</span>
        <div class="item-text">
          <div class="item-title">${escapeHtml(truncatedText)}</div>
          <div class="item-url">${escapeHtml(item.metadata.sourceUrl)}</div>
        </div>
      </div>
      <div class="item-actions">
        <button class="delete-btn" title="Delete" data-id="${item.id}">✕</button>
      </div>
    `;
  }

  // Add delete button event listener
  const deleteBtn = li.querySelector('.delete-btn') as HTMLButtonElement;
  if (deleteBtn) {
    deleteBtn.addEventListener('click', () => {
      void handleDeleteItem(item.id);
    });
  }

  // Add drag event listeners
  li.addEventListener('dragstart', handleDragStart);
  li.addEventListener('dragover', handleDragOver);
  li.addEventListener('drop', handleDrop);
  li.addEventListener('dragend', handleDragEnd);
  li.addEventListener('dragenter', handleDragEnter);
  li.addEventListener('dragleave', handleDragLeave);

  return li;
}

// Escape HTML to prevent XSS
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Update UI state (button states, item count)
function updateUI() {
  const hasItems = capturedItems.length > 0;

  // Update buttons
  savePdfBtn.disabled = !hasItems;
  clearAllBtn.disabled = !hasItems;

  // Update subtitle with item count
  const count = capturedItems.length;
  const linkCount = capturedItems.filter((item) => item.type === 'link').length;
  const imageCount = capturedItems.filter((item) => item.type === 'image').length;
  const textCount = capturedItems.filter((item) => item.type === 'text').length;

  if (count === 0) {
    subtitle.textContent = 'Captured items will appear here';
  } else {
    const parts = [];
    if (linkCount > 0) parts.push(`${linkCount} link${linkCount !== 1 ? 's' : ''}`);
    if (imageCount > 0) parts.push(`${imageCount} image${imageCount !== 1 ? 's' : ''}`);
    if (textCount > 0) parts.push(`${textCount} text${textCount !== 1 ? 's' : ''}`);

    subtitle.textContent = `${count} item${count !== 1 ? 's' : ''} (${parts.join(', ')})`;
  }
}

// Handle messages from background script
function handleBackgroundMessage(message: { type: string; data?: unknown }) {
  if (
    message.type === 'ITEM_ADDED' &&
    message.data &&
    typeof message.data === 'object' &&
    'id' in message.data &&
    'type' in message.data
  ) {
    capturedItems.push(message.data as CapturedItem);
    renderItems();
    updateUI();
  } else if (
    message.type === 'ITEM_DELETED' &&
    message.data &&
    typeof message.data === 'object' &&
    'id' in message.data
  ) {
    const data = message.data as { id: string };
    capturedItems = capturedItems.filter((item) => item.id !== data.id);
    renderItems();
    updateUI();
  } else if (message.type === 'ITEMS_CLEARED') {
    capturedItems = [];
    renderItems();
    updateUI();
  }
}

// Handle delete item
async function handleDeleteItem(id: string) {
  if (!confirm('Are you sure you want to delete this item?')) {
    return;
  }

  try {
    const response = (await browser.runtime.sendMessage({
      type: 'DELETE_ITEM',
      data: { id },
    })) as { success: boolean };

    if (response.success) {
      capturedItems = capturedItems.filter((item) => item.id !== id);
      renderItems();
      updateUI();
    }
  } catch (error) {
    console.error('Failed to delete item:', error);
  }
}

// Handle clear all
async function handleClearAll() {
  if (!confirm('Are you sure you want to clear all items?')) {
    return;
  }

  try {
    const response = (await browser.runtime.sendMessage({ type: 'CLEAR_ALL' })) as {
      success: boolean;
    };

    if (response.success) {
      capturedItems = [];
      renderItems();
      updateUI();
    }
  } catch (error) {
    console.error('Failed to clear items:', error);
  }
}

// Handle save as PDF (placeholder for now)
function handleSavePdf() {
  alert('PDF export will be implemented in a future commit!');
}

// Handle toggle enabled/disabled
async function handleToggleEnabled() {
  if (!currentTabId) {
    alert('Could not determine current tab');
    return;
  }

  try {
    // Send message to background to toggle state
    await browser.runtime.sendMessage({
      type: 'TOGGLE_SITE_ENABLED',
      data: { tabId: currentTabId },
    });

    // Toggle local state
    isExtensionEnabled = !isExtensionEnabled;
    updateToggleButton();
  } catch (error) {
    console.error('Failed to toggle extension state:', error);
  }
}

// Update toggle button appearance
function updateToggleButton() {
  const iconSpan = toggleEnabledBtn.querySelector('.toggle-icon');
  const textSpan = toggleEnabledBtn.querySelector('.toggle-text');

  if (isExtensionEnabled) {
    toggleEnabledBtn.classList.remove('disabled');
    toggleEnabledBtn.title = 'Disable extension on current page';
    if (iconSpan) iconSpan.textContent = '✓';
    if (textSpan) textSpan.textContent = 'Enabled';
  } else {
    toggleEnabledBtn.classList.add('disabled');
    toggleEnabledBtn.title = 'Enable extension on current page';
    if (iconSpan) iconSpan.textContent = '✕';
    if (textSpan) textSpan.textContent = 'Disabled';
  }
}

// Drag and drop state
let draggedElement: HTMLElement | null = null;
let draggedItemId: string | null = null;

// Handle drag start
function handleDragStart(event: DragEvent) {
  const target = event.currentTarget as HTMLElement;
  draggedElement = target;
  draggedItemId = target.dataset.itemId || null;

  target.classList.add('dragging');

  // Set drag data
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/html', target.innerHTML);
  }
}

// Handle drag over
function handleDragOver(event: DragEvent) {
  event.preventDefault();

  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'move';
  }

  return false;
}

// Handle drag enter
function handleDragEnter(event: DragEvent) {
  const target = event.currentTarget as HTMLElement;

  // Don't add class to the dragged element itself
  if (target !== draggedElement) {
    target.classList.add('drag-over');
  }
}

// Handle drag leave
function handleDragLeave(event: DragEvent) {
  const target = event.currentTarget as HTMLElement;
  target.classList.remove('drag-over');
}

// Handle drop
function handleDrop(event: DragEvent) {
  event.preventDefault();
  event.stopPropagation();

  const target = event.currentTarget as HTMLElement;
  target.classList.remove('drag-over');

  // Don't do anything if dropping on itself
  if (draggedElement === target || !draggedItemId) {
    return false;
  }

  const targetItemId = target.dataset.itemId;
  if (!targetItemId) {
    return false;
  }

  // Find the indices of dragged and target items
  const draggedIndex = capturedItems.findIndex((item) => item.id === draggedItemId);
  const targetIndex = capturedItems.findIndex((item) => item.id === targetItemId);

  if (draggedIndex === -1 || targetIndex === -1) {
    return false;
  }

  // Reorder the items array
  const reorderedItems = [...capturedItems];
  const [draggedItem] = reorderedItems.splice(draggedIndex, 1);
  reorderedItems.splice(targetIndex, 0, draggedItem);

  // Update order property for all items
  reorderedItems.forEach((item, index) => {
    item.order = index;
  });

  // Update local state
  capturedItems = reorderedItems;

  // Update storage
  void updateItemsOrder();

  // Re-render
  renderItems();

  return false;
}

// Handle drag end
function handleDragEnd(event: DragEvent) {
  const target = event.currentTarget as HTMLElement;
  target.classList.remove('dragging');

  // Remove drag-over class from all items
  document.querySelectorAll('.drag-over').forEach((element) => {
    element.classList.remove('drag-over');
  });

  // Reset drag state
  draggedElement = null;
  draggedItemId = null;
}

// Update items order in storage
async function updateItemsOrder() {
  try {
    const response = (await browser.runtime.sendMessage({
      type: 'REORDER_ITEMS',
      data: { items: capturedItems },
    })) as { success: boolean };

    if (!response.success) {
      console.error('Failed to update items order');
    }
  } catch (error) {
    console.error('Failed to update items order:', error);
  }
}
