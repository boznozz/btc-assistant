// Background service worker (runs in the background)

chrome.runtime.onInstalled.addListener(() => {
  console.log('Extension installed');
  
  // Set default values
  chrome.storage.sync.set({
    enabled: true
  });
});

// Listen for messages from content scripts or popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Message received:', message);
  
  if (message.type === 'GREETING') {
    sendResponse({ response: 'Hello from background script!' });
  }
  
  return true; // Keep the message channel open for async response
});

// Example: Listen for tab updates
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    console.log('Tab updated:', tab.url);
  }
});

