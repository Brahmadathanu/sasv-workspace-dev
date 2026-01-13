// Minimal reusable detail modal injector

let _modalRoot = null;

function buildModal() {
  const div = document.createElement("div");
  div.id = "copilot-detail-modal";
  div.style =
    "position:fixed;inset:0;display:none;align-items:center;justify-content:center;z-index:9999;";
  div.innerHTML = `
    <div id="copilot-modal-overlay" style="background:rgba(0,0,0,0.45);position:absolute;inset:0"></div>
    <div id="copilot-modal-container" style="background:#fff;max-width:820px;width:92%;max-height:85vh;overflow:auto;border-radius:10px;padding:0;position:relative;z-index:2;box-shadow:0 20px 50px rgba(2,6,23,0.18);display:flex;flex-direction:column">
      <div style="display:flex;justify-content:space-between;align-items:center;padding:18px 24px;border-bottom:1px solid #e5e7eb;flex-shrink:0">
        <div>
          <div id="copilot-modal-title" style="font-weight:700;font-size:19px;color:#0f172a;margin:0"></div>
          <div id="copilot-modal-sub" style="font-size:13px;color:#6b7280;margin-top:4px"></div>
        </div>
        <div><button id="copilot-modal-close" aria-label="Close" style="background:none;border:0;font-size:20px;cursor:pointer;color:#6b7280;padding:4px 8px;line-height:1;transition:color 0.15s" onmouseover="this.style.color='#0f172a'" onmouseout="this.style.color='#6b7280'">✕</button></div>
      </div>
      <div id="copilot-modal-body" style="flex:1 1 auto;overflow:auto;padding:20px 24px"></div>
      <div id="copilot-modal-actions" style="padding:16px 24px;border-top:1px solid #f3f4f6;display:flex;gap:10px;justify-content:flex-end;flex-shrink:0"></div>
    </div>`;
  document.body.appendChild(div);
  return div;
}

// simple toast system
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
  title.textContent = payload.title || "Details";
  sub.textContent = payload.subtitle || "";
  actions.innerHTML = "";
  body.innerHTML = "";
  // render sections
  (payload.sections || []).forEach((sec) => {
    const h = document.createElement("div");
    h.style = "margin-top:8px;border-top:1px solid #eee;padding-top:8px";
    const ht = document.createElement("div");
    ht.innerHTML = `<strong>${sec.title || ""}</strong>`;
    h.appendChild(ht);
    if (sec.type === "kv") {
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
      h.appendChild(table);
    } else if (sec.type === "table") {
      const rows = sec.rows || [];
      if (!rows.length) {
        const p = document.createElement("div");
        p.textContent = "No data for current filter";
        p.style = "color:#666;margin-top:6px";
        h.appendChild(p);
      } else {
        const tbl = document.createElement("table");
        tbl.style = "width:100%;border-collapse:collapse;margin-top:6px";
        const thead = document.createElement("thead");
        const headRow = document.createElement("tr");
        const keys = Object.keys(rows[0]);
        keys.forEach((k) => {
          const th = document.createElement("th");
          th.style = "text-align:left;border-bottom:1px solid #ddd;padding:4px";
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
            td.textContent = String(r[k] ?? "");
            tr.appendChild(td);
          });
          tbody.appendChild(tr);
        });
        tbl.appendChild(tbody);
        h.appendChild(tbl);
      }
    } else if (sec.type === "html") {
      const wrap = document.createElement("div");
      wrap.style = "margin-top:6px";
      wrap.innerHTML = sec.data || "";
      h.appendChild(wrap);
    }
    body.appendChild(h);
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
  root.style.display = "flex";
}

export function closeDetailModal() {
  if (!_modalRoot) return;
  _modalRoot.style.display = "none";
}
