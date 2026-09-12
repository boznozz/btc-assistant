// Content script (runs in the context of web pages)

console.log("Content script loaded");

// Example: Modify page content
function modifyPage() {
  const body = document.body;
  if (body) {
    // Example: Add a custom style
    const style = document.createElement("style");
    style.textContent = `
      .extension-highlight {
        outline: 2px solid #4285f4 !important;
      }
    `;
    document.head.appendChild(style);
  }
}

// Run when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", modifyPage);
} else {
  modifyPage();
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "HIGHLIGHT_ELEMENTS") {
    // Example: Highlight all links
    const links = document.querySelectorAll("a");
    links.forEach((link) => {
      link.classList.add("extension-highlight");
    });
    sendResponse({ success: true, count: links.length });
  }

  return true;
});

// Send message to background script
chrome.runtime.sendMessage({ type: "CONTENT_SCRIPT_READY" }, (response) => {
  console.log("Response from background:", response);
});
