// Options page script

document.addEventListener('DOMContentLoaded', () => {
  const setting1Input = document.getElementById('setting1') as HTMLInputElement;
  const saveButton = document.getElementById('saveButton');
  const statusDiv = document.getElementById('status');
  
  if (!setting1Input || !saveButton || !statusDiv) {
    console.error('Required elements not found');
    return;
  }
  
  // Load saved settings
  chrome.storage.sync.get(['setting1'], (result) => {
    if (result.setting1) {
      setting1Input.value = result.setting1;
    }
  });
  
  // Save button click handler
  saveButton.addEventListener('click', () => {
    const setting1 = setting1Input.value;
    
    chrome.storage.sync.set({ setting1 }, () => {
      // Show success message
      statusDiv.textContent = 'Settings saved!';
      statusDiv.className = 'status success';
      
      // Hide message after 2 seconds
      setTimeout(() => {
        statusDiv.className = 'status';
      }, 2000);
    });
  });
});

