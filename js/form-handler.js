// js/form-handler.js

// === Apply theme based on system preference only ===
function applySystemTheme() {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const root = document.documentElement;

  if (prefersDark) {
    root.style.setProperty('--bg-color', '#1e1e1e');
    root.style.setProperty('--text-color', '#e0e0e0');
    root.style.setProperty('--input-bg', '#333');
    root.style.setProperty('--input-text', '#fff');
  } else {
    root.style.setProperty('--bg-color', '#f6f9fc');
    root.style.setProperty('--text-color', '#333');
    root.style.setProperty('--input-bg', '#fff');
    root.style.setProperty('--input-text', '#000');
  }
}

// Listen for theme changes (auto updates on system switch)
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applySystemTheme);

// Initial application on load
window.addEventListener('DOMContentLoaded', applySystemTheme);