// Minimal reusable detail modal injector

let _modalRoot = null;

function buildModal() {
  const div = document.createElement("div");
  div.id = "copilot-detail-modal";
  div.style =
    "position:fixed;inset:0;display:none;align-items:center;justify-content:center;z-index:9999;";
  div.setAttribute("role", "dialog");
  div.setAttribute("aria-modal", "true");
  div.setAttribute("aria-hidden", "true");

  div.innerHTML = `
    <div id="copilot-modal-overlay" style="background:rgba(0,0,0,0.45);position:absolute;inset:0" aria-hidden="true"></div>
    <div id="copilot-modal-container" role="document" style="background:#fff;max-width:1000px;width:95%;max-height:90vh;overflow:hidden;border-radius:12px;padding:0;position:relative;z-index:2;box-shadow:0 25px 60px rgba(2,6,23,0.24);display:flex;flex-direction:column">
      <header style="display:flex;justify-content:space-between;align-items:flex-start;padding:20px 28px;border-bottom:1px solid #e5e7eb;flex-shrink:0;background:#f8fafc;">
        <div style="flex:1;min-width:0;">
          <h2 id="copilot-modal-title" style="font-weight:700;font-size:20px;color:#0f172a;margin:0;line-height:1.3;"></h2>
          <p id="copilot-modal-sub" style="font-size:14px;color:#64748b;margin:6px 0 0 0;line-height:1.4;"></p>
        </div>
        <div style="margin-left:16px;flex-shrink:0;"><button id="copilot-modal-close" aria-label="Close modal dialog" style="background:none;border:0;font-size:22px;cursor:pointer;color:#6b7280;padding:6px;line-height:1;transition:all 0.15s;border-radius:6px;width:36px;height:36px;display:flex;align-items:center;justify-content:center;" onmouseover="this.style.color='#0f172a';this.style.backgroundColor='#f1f5f9';" onmouseout="this.style.color='#6b7280';this.style.backgroundColor='transparent';">✕</button></div>
      </header>
      <main id="copilot-modal-body" style="flex:1 1 auto;overflow-y:auto;padding:24px 28px;background:#ffffff;"></main>
      <footer id="copilot-modal-actions" style="padding:20px 28px;border-top:1px solid #f1f5f9;background:#f8fafc;display:flex;gap:12px;justify-content:flex-end;flex-shrink:0"></footer>
    </div>`;
  document.body.appendChild(div);
  return div;
}

// Utility functions for UX enhancements
function makeCopyable(element, value, label = "") {
  element.style.cursor = "pointer";
  element.style.userSelect = "all";
  element.title = `Click to copy ${label || "value"}`;

  // Add visual indicator
  element.style.position = "relative";

  element.addEventListener("click", async (e) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(String(value));

      // Show temporary feedback
      const feedback = document.createElement("span");
      feedback.innerHTML =
        '<svg width="12" height="12" fill="white" style="margin-right:3px"><path d="M10.97 4.97a.75.75 0 0 0-1.07-1.07L6 8.44 3.1 5.55a.75.75 0 0 0-1.06 1.07l3.5 3.5a.75.75 0 0 0 1.06 0l4.5-4.5z"/></svg>Copied';
      feedback.style =
        "position:absolute;top:-24px;left:0;background:#059669;color:white;padding:2px 6px;border-radius:3px;font-size:11px;font-weight:500;z-index:1000;display:flex;align-items:center;";
      element.appendChild(feedback);

      setTimeout(() => feedback.remove(), 1500);
    } catch (err) {
      console.debug("Copy failed:", err);
      // Fallback selection
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(element);
      selection.removeAllRanges();
      selection.addRange(range);
    }
  });
}

function addKeyboardNavigation() {
  document.addEventListener("keydown", (e) => {
    const modal = document.getElementById("copilot-detail-modal");
    if (!modal || modal.style.display !== "flex") return;
    if (e.key === "Escape") {
      closeDetailModal();
      e.preventDefault();
      return;
    }

    // Tab navigation within modal
    if (e.key === "Tab") {
      const focusableElements = modal.querySelectorAll(
        'button, [tabindex="0"], input, select, textarea, a[href]'
      );
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (e.shiftKey && document.activeElement === firstElement) {
        lastElement?.focus();
        e.preventDefault();
      } else if (!e.shiftKey && document.activeElement === lastElement) {
        firstElement?.focus();
        e.preventDefault();
      }
    }
  });
}

// Initialize keyboard navigation on load
addKeyboardNavigation();
// Format a month-like value into "Mon YYYY" (e.g. "Nov 2026")
function formatMonthValue(v) {
  if (v === null || v === undefined || v === "") return "";
  try {
    const d =
      typeof v === "string"
        ? new Date(v)
        : v instanceof Date
        ? v
        : new Date(String(v));
    if (isNaN(d)) return String(v);
    return d.toLocaleString(undefined, { month: "short", year: "numeric" });
  } catch {
    return String(v);
  }
}
// Format numbers: integers without decimals, floats with 3 decimal places
function formatNumberValue(n) {
  if (n === null || n === undefined || n === "") return "";
  const num = Number(n);
  if (Number.isNaN(num)) return String(n);
  if (Number.isInteger(num)) return num.toLocaleString();
  return num.toLocaleString(undefined, {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });
}
function createToastContainer() {
  document.getElementById("copilot-detail-modal") || buildModal();
  let container = document.getElementById("copilot-toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "copilot-toast-container";
    container.style =
      "position:fixed;right:20px;bottom:20px;display:flex;flex-direction:column-reverse;gap:10px;z-index:11000;pointer-events:none;";
    document.body.appendChild(container);
  }
  return container;
}

export function showToast(message, type = "info", timeout = 4000) {
  try {
    const container = createToastContainer();
    const node = document.createElement("div");
    node.textContent = message;
    node.style = `padding:8px 12px;border-radius:8px;color:#0f172a;box-shadow:0 8px 20px rgba(2,6,23,0.08);font-weight:600;min-width:160px;max-width:380px;opacity:0;transform:translateY(6px);transition:all 220ms;background:#fff;border-left:4px solid transparent;pointer-events:auto;`;
    // subtle left accent instead of full background color
    if (type === "success") node.style.borderLeft = "4px solid #16a34a";
    else if (type === "error") node.style.borderLeft = "4px solid #dc2626";
    else if (type === "warning") node.style.borderLeft = "4px solid #f59e0b";
    else node.style.borderLeft = "4px solid #2563eb";
    container.appendChild(node);
    // animate in
    requestAnimationFrame(() => {
      node.style.opacity = "1";
      node.style.transform = "translateY(0)";
    });
    const tid = setTimeout(() => {
      node.style.opacity = "0";
      node.style.transform = "translateY(6px)";
      setTimeout(() => node.remove(), 220);
      clearTimeout(tid);
    }, timeout);
    return node;
  } catch (e) {
    console.debug("showToast failed", e);
  }
}

// modal confirm dialog using the same detail modal
export function showConfirm(message, title = "Confirm") {
  ensureDetailModal();
  return new Promise((resolve) => {
    const root = _modalRoot;
    const t = root.querySelector("#copilot-modal-title");
    const sub = root.querySelector("#copilot-modal-sub");
    const body = root.querySelector("#copilot-modal-body");
    const actions = root.querySelector("#copilot-modal-actions");
    const prevDisplay = root.style.display;
    const prevTitle = t.textContent;
    const prevSub = sub.textContent;

    // capture existing actions cssText before hiding so our temporary actions inherit the same layout
    const prevActionsCss = actions.style.cssText || "";

    // hide existing body/actions so we can present a confirm UI without destroying previous listeners
    body.style.display = "none";
    actions.style.display = "none";

    // create temporary confirm nodes
    const confirmBody = document.createElement("div");
    confirmBody.id = "_confirm_body";
    confirmBody.style.cssText =
      "padding:20px 24px;color:#374151;font-size:0.95rem;margin-top:12px;background:#fff;border-radius:6px;";
    confirmBody.innerHTML = String(message);
    const confirmActions = document.createElement("div");
    confirmActions.id = "_confirm_actions";
    confirmActions.style.cssText =
      prevActionsCss +
      ";display:flex;gap:10px;justify-content:flex-end;margin-top:8px;padding:12px 24px;border-top:1px solid #f3f4f6;background:#fff;border-radius:0 0 6px 6px";

    const btnCancel = document.createElement("button");
    btnCancel.className = "mrp-btn mrp-btn-ghost";
    btnCancel.textContent = "Cancel";
    btnCancel.addEventListener("click", () => {
      // remove confirm nodes and restore previous modal content
      confirmBody.remove();
      confirmActions.remove();
      body.style.display = "";
      actions.style.display = "";
      t.textContent = prevTitle || "";
      sub.textContent = prevSub || "";
      root.style.display = prevDisplay || "none";
      resolve(false);
    });

    const btnConfirm = document.createElement("button");
    btnConfirm.className = "mrp-btn mrp-btn-danger";
    btnConfirm.textContent = "Delete";
    btnConfirm.addEventListener("click", () => {
      confirmBody.remove();
      confirmActions.remove();
      body.style.display = "";
      actions.style.display = "";
      t.textContent = prevTitle || "";
      sub.textContent = prevSub || "";
      root.style.display = prevDisplay || "none";
      resolve(true);
    });

    // set confirm title/sub
    t.textContent = title;
    sub.textContent = "";

    confirmActions.appendChild(btnCancel);
    confirmActions.appendChild(btnConfirm);

    // insert confirm nodes after body
    body.parentNode.insertBefore(confirmBody, body.nextSibling);
    actions.parentNode.insertBefore(confirmActions, actions.nextSibling);

    root.style.display = "flex";
  });
}

export function ensureDetailModal() {
  if (_modalRoot) return _modalRoot;
  _modalRoot = document.getElementById("copilot-detail-modal") || buildModal();
  const close = _modalRoot.querySelector("#copilot-modal-close");
  if (close) close.addEventListener("click", closeDetailModal);
  const overlay = _modalRoot.querySelector("#copilot-modal-overlay");
  if (overlay) overlay.addEventListener("click", closeDetailModal);

  // close on ESC
  window.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape") {
      if (
        _modalRoot &&
        _modalRoot.style &&
        _modalRoot.style.display === "flex"
      ) {
        closeDetailModal();
      }
    }
  });
  return _modalRoot;
}

export function openDetailModal(payload) {
  ensureDetailModal();
  const root = _modalRoot;
  const title = root.querySelector("#copilot-modal-title");
  const sub = root.querySelector("#copilot-modal-sub");
  const body = root.querySelector("#copilot-modal-body");
  const actions = root.querySelector("#copilot-modal-actions");

  // Store the currently focused element to restore later
  const previouslyFocused = document.activeElement;
  root.dataset.previouslyFocused = previouslyFocused?.id || "";

  title.textContent = payload.title || "Details";
  sub.textContent = payload.subtitle || "";
  actions.innerHTML = "";
  body.innerHTML = "";

  // render sections (enhanced with better styling and interactivity)
  (payload.sections || []).forEach((sec) => {
    const sectionWrapper = document.createElement("div");
    sectionWrapper.style = "margin-bottom:24px;";

    const sectionHeader = document.createElement("div");
    sectionHeader.style =
      "display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;padding-bottom:8px;border-bottom:2px solid #f1f5f9;";

    const titleEl = document.createElement("h3");
    titleEl.style =
      "margin:0;font-size:16px;font-weight:600;color:#1e293b;display:flex;align-items:center;gap:8px;";
    titleEl.innerHTML = sec.title || "";
    sectionHeader.appendChild(titleEl);

    sectionWrapper.appendChild(sectionHeader);

    if (sec.type === "enhanced-kv") {
      const isKeySection = sec.isKeySection;
      const container = document.createElement("div");

      if (isKeySection) {
        // Key metrics in a card-style grid layout
        container.style =
          "display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:16px;padding:16px;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;";

        for (const [k, v] of Object.entries(sec.data || {})) {
          const metricCard = document.createElement("div");
          metricCard.style =
            "background:#fff;padding:12px;border-radius:6px;border:1px solid #e5e7eb;box-shadow:0 1px 3px rgba(0,0,0,0.1);transition:all 0.15s;";

          // Add hover effect for interactivity
          metricCard.addEventListener("mouseenter", () => {
            metricCard.style.boxShadow = "0 4px 12px rgba(0,0,0,0.15)";
            metricCard.style.transform = "translateY(-1px)";
          });
          metricCard.addEventListener("mouseleave", () => {
            metricCard.style.boxShadow = "0 1px 3px rgba(0,0,0,0.1)";
            metricCard.style.transform = "translateY(0)";
          });

          const label = document.createElement("div");
          label.style =
            "font-size:12px;font-weight:500;color:#64748b;text-transform:uppercase;letter-spacing:0.025em;margin-bottom:4px;";
          label.textContent = k;

          const value = document.createElement("div");
          value.style =
            "font-size:16px;font-weight:600;color:#1e293b;word-break:break-word;";
          // Format month/period values in key metrics
          let displayVal = v;
          const lowKey = String(k).toLowerCase();
          if ((lowKey.includes("month") || lowKey.includes("period")) && v) {
            displayVal = formatMonthValue(v);
          }
          value.textContent = String(displayVal ?? "—");

          // Make IDs copyable
          if (
            k.toLowerCase().includes("id") ||
            k.toLowerCase().includes("stock item id")
          ) {
            makeCopyable(value, v, k);
            value.style.color = "#2563eb";
          }

          metricCard.appendChild(label);
          metricCard.appendChild(value);
          container.appendChild(metricCard);
        }
      } else {
        // Detailed attributes in a clean two-column layout
        container.style =
          "display:grid;grid-template-columns:1fr 2fr;gap:12px 20px;padding:12px;background:#fff;border:1px solid #e2e8f0;border-radius:6px;";

        for (const [k, v] of Object.entries(sec.data || {})) {
          const key = document.createElement("div");
          key.style = "font-weight:500;color:#374151;font-size:14px;";
          key.textContent = k;

          const val = document.createElement("div");
          val.style = "color:#1f2937;font-size:14px;word-break:break-word;";
          val.textContent = String(v ?? "—");

          container.appendChild(key);
          container.appendChild(val);
        }
      }
      sectionWrapper.appendChild(container);
    } else if (sec.type === "enhanced-table") {
      const rows = sec.rows || [];
      if (!rows.length) {
        const emptyDiv = document.createElement("div");
        emptyDiv.style =
          "text-align:center;padding:40px 20px;color:#64748b;background:#f8fafc;border-radius:6px;border:1px solid #e2e8f0;";
        emptyDiv.innerHTML =
          "<svg width='16' height='16' fill='currentColor' style='margin-right:8px;opacity:0.7'><path d='M3 4a1 1 0 011-1h1V2a1 1 0 112 0v1h2V2a1 1 0 112 0v1h1a1 1 0 011 1v1H3V4zm0 3h10v7a1 1 0 01-1 1H4a1 1 0 01-1-1V7z'/><path d='M5 9a1 1 0 011-1h2a1 1 0 010 2H6a1 1 0 01-1-1z'/></svg>No data available for the current filters";
        sectionWrapper.appendChild(emptyDiv);
      } else {
        const tableContainer = document.createElement("div");
        tableContainer.style =
          "overflow-x:auto;border:1px solid #e2e8f0;border-radius:8px;background:#fff;";

        const table = document.createElement("table");
        table.style = "width:100%;border-collapse:collapse;font-size:14px;";

        // Enhanced table header
        const thead = document.createElement("thead");
        const headRow = document.createElement("tr");
        const keys = Object.keys(rows[0]);

        keys.forEach((k) => {
          const th = document.createElement("th");
          th.style =
            "text-align:center;padding:12px 16px;font-weight:600;color:#374151;border-bottom:2px solid #e2e8f0;font-size:13px;text-transform:uppercase;letter-spacing:0.025em;position:sticky;top:0;background:#f8fafc;z-index:5;box-shadow:0 1px 3px rgba(0, 0, 0, 0.1);";
          th.textContent = k.replace(/_/g, " ");
          headRow.appendChild(th);
        });
        thead.appendChild(headRow);
        table.appendChild(thead);
        // Enhanced table body
        const tbody = document.createElement("tbody");
        rows.forEach((r, idx) => {
          const tr = document.createElement("tr");
          tr.style = `background:${
            idx % 2 === 0 ? "#fff" : "#f9fafb"
          };border-bottom:1px solid #f1f5f9;transition:background-color 0.15s;`;

          // Add hover effect
          tr.addEventListener("mouseenter", () => {
            tr.style.backgroundColor = "#f0f9ff";
          });
          tr.addEventListener("mouseleave", () => {
            tr.style.backgroundColor = idx % 2 === 0 ? "#fff" : "#f9fafb";
          });

          keys.forEach((k) => {
            const td = document.createElement("td");
            td.style =
              "padding:12px 16px;color:#1f2937;border-bottom:1px solid #f1f5f9;vertical-align:top;";

            const value = r[k];
            // Enhanced value formatting with interactivity
            const lower = k.toLowerCase();
            const centerCols = [
              "net_need",
              "net_need_qty",
              "procure_qty",
              "procure",
              "procure_qty",
              "purchase_qty",
              "closing_qty",
              "uom",
              "month",
              "period",
            ];

            if (
              (lower.includes("month") || lower.includes("period")) &&
              value
            ) {
              td.textContent = formatMonthValue(value);
              td.style.textAlign = "center";
            } else if (
              value !== null &&
              value !== undefined &&
              value !== "" &&
              !Number.isNaN(Number(value))
            ) {
              td.textContent = formatNumberValue(Number(value));
              // center numeric columns listed above, otherwise right align
              if (centerCols.some((c) => lower.includes(c)))
                td.style.textAlign = "center";
              else td.style.textAlign = "right";
              td.style.fontVariantNumeric = "tabular-nums";
            } else if (k.toLowerCase().includes("id") && value) {
              const codeEl = document.createElement("code");
              codeEl.style =
                "background:#f1f5f9;padding:2px 6px;border-radius:3px;font-size:12px;color:#374151;";
              codeEl.textContent = String(value);

              // Make IDs copyable
              makeCopyable(codeEl, value, k);
              codeEl.style.background = "#dbeafe";
              codeEl.style.color = "#1d4ed8";

              td.appendChild(codeEl);
            } else if (
              k.toLowerCase().includes("name") &&
              value &&
              value.length > 30
            ) {
              // Truncate long names with tooltip
              td.textContent = String(value).substring(0, 30) + "...";
              td.title = String(value);
              td.style.cursor = "help";
            } else if (lower.includes("stock_item") && lower.includes("name")) {
              // Stock item name should be left aligned
              td.textContent = String(value ?? "—");
              td.style.textAlign = "left";
            } else {
              td.textContent = String(value ?? "—");
            }

            tr.appendChild(td);
          });
          tbody.appendChild(tr);
        });
        table.appendChild(tbody);
        tableContainer.appendChild(table);
        sectionWrapper.appendChild(tableContainer);

        // Add record count summary
        const recordSummary = document.createElement("div");
        recordSummary.style =
          "margin-top:8px;text-align:right;color:#64748b;font-size:12px;";
        recordSummary.textContent = `${rows.length} record${
          rows.length !== 1 ? "s" : ""
        } displayed`;
        sectionWrapper.appendChild(recordSummary);
      }
    } else if (sec.type === "empty-state") {
      const emptyDiv = document.createElement("div");
      emptyDiv.style =
        "text-align:center;padding:32px 20px;color:#64748b;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;";
      emptyDiv.innerHTML = `<div style="font-size:24px;margin-bottom:8px;"><svg width="24" height="24" fill="currentColor" style="opacity:0.7"><path d="M3 4a1 1 0 011-1h1V2a1 1 0 112 0v1h2V2a1 1 0 112 0v1h1a1 1 0 011 1v1H3V4zm0 3h10v7a1 1 0 01-1 1H4a1 1 0 01-1-1V7z"/><path d="M5 9a1 1 0 011-1h2a1 1 0 010 2H6a1 1 0 01-1-1z"/></svg></div><div style="font-weight:500;margin-bottom:4px;">No Data Available</div><div style="font-size:13px;">${
        sec.data || ""
      }</div>`;
      sectionWrapper.appendChild(emptyDiv);
    } else if (sec.type === "error-state") {
      const errorDiv = document.createElement("div");
      errorDiv.style =
        "text-align:center;padding:24px 20px;color:#dc2626;background:#fef2f2;border-radius:8px;border:1px solid #fecaca;";
      errorDiv.innerHTML = `<div style="font-size:24px;margin-bottom:8px;"><svg width="24" height="24" fill="currentColor"><path d="M8.982 1.566a1.13 1.13 0 00-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.713c.889 0 1.438-.99.98-1.767L8.982 1.566zM8 5c.535 0 .954.462.9.995l-.35 3.507a.552.552 0 01-1.1 0L7.1 5.995A.905.905 0 018 5zm.002 6a1 1 0 100 2 1 1 0 000-2z"/></svg></div><div style="font-weight:500;margin-bottom:4px;color:#991b1b;">Unable to Load Data</div><div style="font-size:13px;color:#7f1d1d;">${
        sec.data || "Please try again later."
      }</div>`;
      sectionWrapper.appendChild(errorDiv);
    } else if (sec.type === "loading-state") {
      const loadingDiv = document.createElement("div");
      loadingDiv.style =
        "text-align:center;padding:32px 20px;color:#2563eb;background:#eff6ff;border-radius:8px;border:1px solid #bfdbfe;";
      loadingDiv.innerHTML = `<div style="font-size:24px;margin-bottom:12px;"><svg width="24" height="24" fill="currentColor" style="animation:spin 1.5s linear infinite"><path d="M8 3a5 5 0 104.546 2.914.5.5 0 11-.908-.417A4 4 0 108 4a.5.5 0 010-1z"/></svg></div><div style="font-weight:500;margin-bottom:4px;color:#1d4ed8;">Loading Data</div><div style="font-size:13px;color:#1e40af;">${
        sec.data || "Please wait while we fetch the latest information..."
      }</div>`;

      // Add CSS keyframes for loading animation if not already present
      if (!document.getElementById("loading-animation-styles")) {
        const style = document.createElement("style");
        style.id = "loading-animation-styles";
        style.textContent = `          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }          @keyframes pulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.6; transform: scale(0.95); }
          }
        `;
        document.head.appendChild(style);
      }

      sectionWrapper.appendChild(loadingDiv);
    } else if (sec.type === "kv") {
      // Legacy KV support
      const table = document.createElement("div");
      table.style =
        "display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:6px";
      for (const k of Object.keys(sec.data || {})) {
        const key = document.createElement("div");
        key.style = "color:#666";
        key.textContent = k;
        const val = document.createElement("div");
        val.textContent = String(sec.data[k] ?? "");
        table.appendChild(key);
        table.appendChild(val);
      }
      sectionWrapper.appendChild(table);
    } else if (sec.type === "table") {
      // Legacy table support with basic styling
      const rows = sec.rows || [];
      if (!rows.length) {
        const p = document.createElement("div");
        p.textContent = "No data for current filter";
        p.style = "color:#666;margin-top:6px";
        sectionWrapper.appendChild(p);
      } else {
        const tbl = document.createElement("table");
        tbl.style = "width:100%;border-collapse:collapse;margin-top:6px";
        const thead = document.createElement("thead");
        const headRow = document.createElement("tr");
        const keys = Object.keys(rows[0]);
        keys.forEach((k) => {
          const th = document.createElement("th");
          th.style =
            "text-align:center;border-bottom:1px solid #ddd;padding:4px;position:sticky;top:0;background:#ffffff;z-index:5;box-shadow:0 1px 3px rgba(0, 0, 0, 0.1);";
          th.textContent = k;
          headRow.appendChild(th);
        });
        thead.appendChild(headRow);
        tbl.appendChild(thead);
        const tbody = document.createElement("tbody");
        rows.forEach((r) => {
          const tr = document.createElement("tr");
          keys.forEach((k) => {
            const td = document.createElement("td");
            td.style = "padding:4px;border-bottom:1px solid #f6f6f6";
            const lower = k.toLowerCase();
            const raw = r[k];
            if ((lower.includes("month") || lower.includes("period")) && raw) {
              td.textContent = formatMonthValue(raw);
              td.style.textAlign = "center";
            } else if (lower.includes("stock_item") && lower.includes("name")) {
              td.textContent = String(raw ?? "");
              td.style.textAlign = "left";
            } else if (
              typeof raw === "number" &&
              !Number.isNaN(raw) &&
              (lower.includes("net_need") ||
                lower.includes("procure") ||
                lower.includes("closing") ||
                lower.includes("qty") ||
                lower.includes("uom"))
            ) {
              td.textContent = raw.toLocaleString();
              td.style.textAlign = "center";
            } else {
              td.textContent = String(raw ?? "");
            }
            tr.appendChild(td);
          });
          tbody.appendChild(tr);
        });
        tbl.appendChild(tbody);
        sectionWrapper.appendChild(tbl);
      }
    } else if (sec.type === "html") {
      const wrap = document.createElement("div");
      wrap.style = "margin-top:6px";
      wrap.innerHTML = sec.data || "";
      sectionWrapper.appendChild(wrap);
    }

    body.appendChild(sectionWrapper);
  });
  // actions
  (payload.actions || []).forEach((a) => {
    const btn = document.createElement("button");
    btn.textContent = a.label || "Action";
    if (a.tooltip) btn.title = a.tooltip;
    if (a.enabled === false) btn.disabled = true;

    // Apply appropriate button classes based on label
    btn.className = "mrp-btn";
    const label = (a.label || "").toLowerCase();
    if (label.includes("save") || label.includes("submit")) {
      btn.className += " mrp-btn-primary";
    } else if (label.includes("delete") || label.includes("remove")) {
      btn.className += " mrp-btn-danger";
    } else if (label.includes("cancel") || label.includes("close")) {
      btn.className += " mrp-btn-ghost";
    } else if (label.includes("edit")) {
      btn.className += " mrp-btn-secondary";
    } else {
      btn.className += " mrp-btn-secondary";
    }

    btn.addEventListener("click", (ev) => {
      try {
        a.onClick?.(ev);
      } catch (e) {
        console.debug(e);
      }
    });
    actions.appendChild(btn);
  });

  // Show modal and manage focus
  root.style.display = "flex";
  root.setAttribute("aria-hidden", "false");
  root.setAttribute("aria-labelledby", "copilot-modal-title");
  if (payload.subtitle) {
    root.setAttribute("aria-describedby", "copilot-modal-sub");
  }

  // Focus the first interactive element or close button after a brief delay
  requestAnimationFrame(() => {
    const firstButton =
      actions.querySelector("button") ||
      root.querySelector("#copilot-modal-close");
    firstButton?.focus();
  });

  // Emit custom event for integration
  window.dispatchEvent(
    new CustomEvent("detail:opened", {
      detail: {
        title: payload.title,
        sections: payload.sections?.length || 0,
        timestamp: Date.now(),
      },
    })
  );
}

export function closeDetailModal() {
  if (!_modalRoot) return;

  // Emit close event
  window.dispatchEvent(
    new CustomEvent("detail:closed", {
      detail: { timestamp: Date.now() },
    })
  );

  _modalRoot.style.display = "none";
  _modalRoot.setAttribute("aria-hidden", "true");

  // Restore focus to previously focused element
  const previouslyFocusedId = _modalRoot.dataset.previouslyFocused;
  if (previouslyFocusedId) {
    const element = document.getElementById(previouslyFocusedId);
    element?.focus();
  }
}
