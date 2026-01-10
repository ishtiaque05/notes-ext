// Background service worker for Notes Collector extension

console.log('Notes Collector: Background service worker initialized');

// Initialize storage on extension install
browser.runtime.onInstalled.addListener(() => {
  console.log('Notes Collector: Extension installed');
});
