// Background service worker for Notes Collector extension

if (process.env.NODE_ENV === 'development') {
  console.warn('Notes Collector: Background service worker initialized');
}

// Initialize storage on extension install
browser.runtime.onInstalled.addListener(() => {
  if (process.env.NODE_ENV === 'development') {
    console.warn('Notes Collector: Extension installed');
  }
});
