// Sidebar UI logic for Notes Collector extension
import './sidebar.scss';
import type { CapturedItem } from '../types';

let capturedItems: CapturedItem[] = [];

// DOM elements
let itemsContainer: HTMLElement;
let savePdfBtn: HTMLButtonElement;
let clearAllBtn: HTMLButtonElement;
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
    subtitle = document.querySelector('.subtitle')!;

    // Load items from storage
    await loadItems();

    // Set up event listeners
    savePdfBtn.addEventListener('click', () => { void handleSavePdf(); });
    clearAllBtn.addEventListener('click', () => { void handleClearAll(); });

    // Listen for new items from background script
    browser.runtime.onMessage.addListener(handleBackgroundMessage);
  })();
});

// Load items from storage
async function loadItems() {
  try {
    const response = await browser.runtime.sendMessage({ type: 'GET_ITEMS' }) as { success: boolean; data?: CapturedItem[] };

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
    itemsContainer.innerHTML = '<p class="empty-state">No items captured yet. Click on links or images to capture them.</p>';
    return;
  }

  // Sort by order
  const sortedItems = [...capturedItems].sort((a, b) => a.order - b.order);

  // Create list container
  const listElement = document.createElement('ul');
  listElement.className = 'items-list';

  // Render each item
  sortedItems.forEach(item => {
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

  if (item.type === 'link' && 'text' in item.metadata) {
    li.innerHTML = `
      <div class="item-content">
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
  }

  // Add delete button event listener
  const deleteBtn = li.querySelector('.delete-btn') as HTMLButtonElement;
  if (deleteBtn) {
    deleteBtn.addEventListener('click', () => { void handleDeleteItem(item.id); });
  }

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
  const linkCount = capturedItems.filter(item => item.type === 'link').length;
  const imageCount = capturedItems.filter(item => item.type === 'image').length;

  if (count === 0) {
    subtitle.textContent = 'Captured items will appear here';
  } else {
    subtitle.textContent = `${count} item${count !== 1 ? 's' : ''} (${linkCount} link${linkCount !== 1 ? 's' : ''}, ${imageCount} image${imageCount !== 1 ? 's' : ''})`;
  }
}

// Handle messages from background script
function handleBackgroundMessage(message: { type: string; data?: unknown }) {
  if (message.type === 'ITEM_ADDED' && message.data && typeof message.data === 'object' && 'id' in message.data && 'type' in message.data) {
    capturedItems.push(message.data as CapturedItem);
    renderItems();
    updateUI();
  } else if (message.type === 'ITEM_DELETED' && message.data && typeof message.data === 'object' && 'id' in message.data) {
    const data = message.data as { id: string };
    capturedItems = capturedItems.filter(item => item.id !== data.id);
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
    const response = await browser.runtime.sendMessage({
      type: 'DELETE_ITEM',
      data: { id }
    }) as { success: boolean };

    if (response.success) {
      capturedItems = capturedItems.filter(item => item.id !== id);
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
    const response = await browser.runtime.sendMessage({ type: 'CLEAR_ALL' }) as { success: boolean };

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
