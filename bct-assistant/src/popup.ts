/** Popup — backend status + dashboard only (no BCT navigation). */

document.addEventListener("DOMContentLoaded", () => {
  const status = document.getElementById("status");
  const dashBtn = document.getElementById("openDash");

  dashBtn?.addEventListener("click", () => {
    const url = chrome.runtime.getURL("dashboard/index.html");
    chrome.tabs.create({ url });
  });

  fetch("http://localhost:8000/health")
    .then((r) => {
      if (status) {
        status.textContent = r.ok ? "Backend Online" : "Backend Offline";
        status.style.background = r.ok ? "#d4edda" : "#f8d7da";
        status.style.color = r.ok ? "#155724" : "#721c24";
      }
    })
    .catch(() => {
      if (status) {
        status.textContent = "Backend Offline";
        status.style.background = "#fff3cd";
        status.style.color = "#856404";
      }
    });
});
