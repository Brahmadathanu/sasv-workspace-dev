// Minimal UI helpers (ES module)
// Include on any new module page:
// <script type="module">
// import { $, toast, confirmDialog } from '/public/shared/js/ui-helpers.js';
// </script>

import { showToast, toast as canonicalToast } from "./toast.js";

export function $(sel, root = document) {
  const el = root.querySelector(sel);
  if (!el) throw new Error(`Missing required element: ${sel}`);
  return el;
}

/** @deprecated Prefer showToast from toast.js — kept as thin adapter */
export function toast(msg, type = "info") {
  return canonicalToast(msg, type);
}

export { showToast };

export function confirmDialog(message) {
  return new Promise((resolve) => resolve(window.confirm(message)));
}
