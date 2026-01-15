/**
 * Sidebar UI logic for Notes Collector extension
 */
import './sidebar.scss';
import { CapturedItem, Message } from '../types';
import { createItemElement } from './components/itemRenderer';
import { setupDragAndDrop, DragDropHandlers } from './dragDrop';
import { generatePdf } from './pdfGenerator';

class SidebarController {
  private capturedItems: CapturedItem[] = [];
  private isExtensionEnabled = true;

  // DOM elements
  private itemsContainer!: HTMLElement;
  private savePdfBtn!: HTMLButtonElement;
  private clearAllBtn!: HTMLButtonElement;
  private toggleEnabledBtn!: HTMLButtonElement;
  private subtitle!: HTMLElement;

  private dndHandlers!: DragDropHandlers;

  constructor() {
    this.init();
  }

  private init() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => { void this.onReady(); });
    } else {
      void this.onReady();
    }
    browser.runtime.onMessage.addListener((m: any) => { this.handleBackgroundMessage(m as Message); return true; });
  }

  private async onReady() {
    // Get DOM elements
    this.itemsContainer = document.getElementById('items-container')!;
    this.savePdfBtn = document.getElementById('save-pdf-btn') as HTMLButtonElement;
    this.clearAllBtn = document.getElementById('clear-all-btn') as HTMLButtonElement;
    this.toggleEnabledBtn = document.getElementById('toggle-enabled-btn') as HTMLButtonElement;
    this.subtitle = document.querySelector('.subtitle')!;

    // Setup DnD
    this.dndHandlers = setupDragAndDrop(
      (items) => this.handleReorder(items),
      () => this.capturedItems
    );

    // Initial load
    await this.loadItems();
    await this.checkEnabledState();

    // Event listeners
    this.savePdfBtn.addEventListener('click', () => { void generatePdf(this.capturedItems); });
    this.clearAllBtn.addEventListener('click', () => { void this.handleClearAll(); });
    this.toggleEnabledBtn.addEventListener('click', () => { void this.handleToggleEnabled(); });
  }

  private async loadItems() {
    try {
      const response = await browser.runtime.sendMessage({ type: 'GET_ITEMS' });
      if (response.success) {
        this.capturedItems = (response.data as CapturedItem[]).sort((a, b) => a.order - b.order);
        this.renderItems();
        this.updateUI();
      }
    } catch (e) {
      console.error('Failed to load items:', e);
    }
  }

  private async checkEnabledState() {
    try {
      const tabs = await browser.tabs.query({ active: true, currentWindow: true });
      const tabId = tabs[0]?.id;
      if (!tabId) return;

      const response = await browser.runtime.sendMessage({
        type: 'CHECK_SITE_ENABLED',
        data: { tabId },
      });
      if (response.success) {
        this.isExtensionEnabled = response.data.enabled;
        this.updateToggleButton();
      }
    } catch (e) {
      console.error('Failed to check enabled state:', e);
    }
  }

  private renderItems() {
    this.itemsContainer.innerHTML = '';

    if (this.capturedItems.length === 0) {
      this.itemsContainer.innerHTML = '<div class="empty-state">No items captured yet. Click on links, images or select text while holding Ctrl+Shift!</div>';
      return;
    }

    const callbacks = {
      onDelete: (id: string) => this.handleDeleteItem(id),
      onDragStart: (e: DragEvent) => this.dndHandlers.handleDragStart(e),
      onDragOver: (e: DragEvent) => this.dndHandlers.handleDragOver(e),
      onDrop: (e: DragEvent) => this.dndHandlers.handleDrop(e),
      onDragEnd: (e: DragEvent) => this.dndHandlers.handleDragEnd(e),
      onDragEnter: (e: DragEvent) => this.dndHandlers.handleDragEnter(e),
      onDragLeave: (e: DragEvent) => this.dndHandlers.handleDragLeave(e),
    };

    this.capturedItems.forEach((item) => {
      this.itemsContainer.appendChild(createItemElement(item, callbacks));
    });
  }

  private updateUI() {
    const hasItems = this.capturedItems.length > 0;
    this.savePdfBtn.disabled = !hasItems;
    this.clearAllBtn.disabled = !hasItems;

    const count = this.capturedItems.length;
    if (count === 0) {
      this.subtitle.textContent = 'Captured items will appear here';
    } else {
      const types = this.capturedItems.reduce((acc: Record<string, number>, item) => {
        acc[item.type] = (acc[item.type] || 0) + 1;
        return acc;
      }, {});
      const parts = Object.entries(types).map(([type, n]) => `${n} ${type}${n !== 1 ? 's' : ''}`);
      this.subtitle.textContent = `${count} item${count !== 1 ? 's' : ''} (${parts.join(', ')})`;
    }
  }

  private updateToggleButton() {
    this.toggleEnabledBtn.textContent = this.isExtensionEnabled ? 'Enabled' : 'Disabled';
    this.toggleEnabledBtn.className = `toggle-btn ${this.isExtensionEnabled ? 'enabled' : 'disabled'}`;
  }

  private async handleToggleEnabled() {
    try {
      const tabs = await browser.tabs.query({ active: true, currentWindow: true });
      const tabId = tabs[0]?.id;
      if (!tabId) return;

      await browser.runtime.sendMessage({
        type: 'TOGGLE_SITE_ENABLED',
        data: { tabId },
      });

      // State will be updated via message from background
    } catch (e) {
      console.error('Toggle failed:', e);
    }
  }

  private async handleDeleteItem(id: string) {
    try {
      const response = await browser.runtime.sendMessage({ type: 'DELETE_ITEM', data: { id } });
      if (response.success) {
        this.capturedItems = this.capturedItems.filter((i) => i.id !== id);
        this.renderItems();
        this.updateUI();
      }
    } catch (e) {
      console.error('Delete failed:', e);
    }
  }

  private async handleClearAll() {
    if (!confirm('Are you sure you want to clear all captured items?')) return;
    try {
      const response = await browser.runtime.sendMessage({ type: 'CLEAR_ALL' });
      if (response.success) {
        this.capturedItems = [];
        this.renderItems();
        this.updateUI();
      }
    } catch (e) {
      console.error('Clear failed:', e);
    }
  }

  private async handleReorder(newItems: CapturedItem[]) {
    this.capturedItems = newItems;
    this.renderItems();
    try {
      await browser.runtime.sendMessage({ type: 'REORDER_ITEMS', data: { items: newItems } });
    } catch (e) {
      console.error('Reorder sync failed:', e);
    }
  }

  private handleBackgroundMessage(message: Message | { type: string; data?: any; enabled?: boolean }) {
    switch (message.type) {
      case 'ITEM_ADDED':
        this.capturedItems.push(message.data);
        this.renderItems();
        this.updateUI();
        break;
      case 'ITEM_DELETED':
        this.capturedItems = this.capturedItems.filter((i) => (i as any).id !== (message.data as any).id);
        this.renderItems();
        this.updateUI();
        break;
      case 'ITEMS_CLEARED':
        this.capturedItems = [];
        this.renderItems();
        this.updateUI();
        break;
      case 'SITE_ENABLED_CHANGED':
        this.isExtensionEnabled = (message as any).enabled ?? (message as any).data?.enabled;
        this.updateToggleButton();
        break;
      case 'STORAGE_WARNING':
        alert((message.data as any).message);
        break;
    }
  }
}

// Instantiate the controller
const controller = new SidebarController();
export default controller;
