// Popup script (runs when popup is opened)

document.addEventListener('DOMContentLoaded', () => {
  const statusElement = document.getElementById('status');
  const button = document.getElementById('toggleButton');
  
  if (!statusElement || !button) {
    console.error('Required elements not found');
    return;
  }
  
  // Load saved state
  chrome.storage.sync.get(['enabled'], (result) => {
    const enabled = result.enabled !== false; // Default to true
    updateUI(enabled);
  });
  
  // Toggle button click handler
  button.addEventListener('click', () => {
    chrome.storage.sync.get(['enabled'], (result) => {
      const newState = !result.enabled;
      chrome.storage.sync.set({ enabled: newState }, () => {
        updateUI(newState);
        
        // Send message to content script
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0]?.id) {
            chrome.tabs.sendMessage(tabs[0].id, {
              type: 'TOGGLE_STATE',
              enabled: newState
            });
          }
        });
      });
    });
  });
  
  function updateUI(enabled: boolean) {
    statusElement!.textContent = enabled ? 'Enabled' : 'Disabled';
    statusElement!.className = enabled ? 'status enabled' : 'status disabled';
    button!.textContent = enabled ? 'Disable' : 'Enable';
  }
  
  // Send message to background script
  chrome.runtime.sendMessage({ type: 'GREETING' }, (response) => {
    console.log('Response from background:', response);
  });
});

