// Sidebar UI logic for Notes Collector extension
import './sidebar.scss';

if (process.env.NODE_ENV === 'development') {
  console.warn('Notes Collector: Sidebar script loaded');
}

// Initialize sidebar
document.addEventListener('DOMContentLoaded', () => {
  if (process.env.NODE_ENV === 'development') {
    console.warn('Sidebar DOM loaded');
  }
});
