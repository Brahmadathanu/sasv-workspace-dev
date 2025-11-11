// Minimal, dependency-free UI helpers (ES module)
// Include on any new module page:
// <script type="module">
// import { $, toast, confirmDialog } from '/public/shared/js/ui-helpers.js';
// </script>

export function $(sel, root = document) {
  const el = root.querySelector(sel);
  if (!el) throw new Error(`Missing required element: ${sel}`);
  return el;
}

export function toast(msg, type = "info") {
  const t = document.createElement("div");
  t.textContent = msg;
  t.style.cssText =
    "position:fixed;right:16px;bottom:16px;padding:10px 14px;border-radius:8px;background:#111;color:#fff;z-index:9999;opacity:0.95";
  if (type === "success") t.style.background = "#0a7d2a";
  if (type === "error") t.style.background = "#b00020";
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2200);
}

export function confirmDialog(message) {
  return new Promise((resolve) => resolve(window.confirm(message)));
}
