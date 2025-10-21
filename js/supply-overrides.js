function refreshApplyButtonsState() {
  const selPlan = document.getElementById("selPlanHeader");
  const hasSelection = !!selPlan?.value;
  document
    .getElementById("btnUnifiedApply")
    ?.toggleAttribute("disabled", !hasSelection);
  document
    .getElementById("btnUnifiedUndo")
    ?.toggleAttribute("disabled", !hasSelection);
}
function confirmSeed({ setId, fromMonth, toMonth, setLabel }) {
  return new Promise((resolve) => {
    const dlg = document.getElementById("seedConfirmDialog");
    if (!dlg) return resolve(false);

    // Fill chips
    const setChip = document.getElementById("seedConfirmSetChip");
    const fromChip = document.getElementById("seedConfirmFromChip");
    const toChip = document.getElementById("seedConfirmToChip");
    if (setChip)
      setChip.textContent = `Set: #${setId}${setLabel ? " — " + setLabel : ""}`;
    if (fromChip) fromChip.textContent = `From: ${fromMonth || "—"}`;
    if (toChip) toChip.textContent = `To: ${toMonth || "—"}`;

    const btnCancel = document.getElementById("seedConfirmCancelBtn");
    const btnOk = document.getElementById("seedConfirmOkBtn");

    const done = (val) => {
      try {
        dlg.close();
      } catch (e) {
        void e;
        /* ignore close errors */
      }
      resolve(val);
    };

    btnCancel?.addEventListener("click", () => done(false), { once: true });
    btnOk?.addEventListener("click", () => done(true), { once: true });
    dlg.addEventListener(
      "cancel",
      (e) => {
        e.preventDefault();
        done(false);
      },
      { once: true }
    );

    if (typeof dlg.showModal === "function") dlg.showModal();
    else dlg.setAttribute("open", "");
  });
}

document.getElementById("selPlanHeader")?.addEventListener("change", () => {
  try {
    refreshApplyButtonsState();
    // attempt to auto-populate Active Overrides based on selected plan
    autoLoadActiveOverridesForSelectedPlan()?.catch(() => {});
  } catch {
    /* ignore */
  }
});
document.addEventListener("DOMContentLoaded", refreshApplyButtonsState);

// Wire Undo confirmation dialog buttons
document.addEventListener("DOMContentLoaded", () => {
  const undoBtn = document.getElementById("btnUnifiedUndo");
  const undoDialog = document.getElementById("undoConfirmDialog");
  const undoOk = document.getElementById("undoOkBtn");
  const undoCancel = document.getElementById("undoCancelBtn");

  if (undoBtn && undoDialog) {
    undoBtn.addEventListener("click", () => {
      // show modal confirm
      try {
        if (typeof undoDialog.showModal === "function") undoDialog.showModal();
        else undoDialog.setAttribute("open", "");
      } catch {
        // fallback: prompt
        if (confirm("Are you sure you want to undo apply?"))
          rollbackUnifiedOverrides();
      }
    });
  }
  if (undoOk && undoDialog) {
    undoOk.addEventListener("click", async () => {
      try {
        undoDialog.close();
      } catch {
        undoDialog.removeAttribute("open");
      }
      await rollbackUnifiedOverrides();
    });
  }
  if (undoCancel && undoDialog) {
    undoCancel.addEventListener("click", () => {
      try {
        undoDialog.close();
      } catch {
        undoDialog.removeAttribute("open");
      }
    });
  }
});
/* eslint-env browser */
import { supabase } from "../public/shared/js/supabaseClient.js";
// Load Luxon from a CDN ESM build so the renderer can import it without a bundler.
// Using jsDelivr ESM build for Luxon v3.x
// --- Lines status pill auto-reset state ---
let linesStatusDefaultLabel = ""; // what we want to show normally (row count)
let linesStatusResetTimer = null; // timer to revert from transient status
let __unifiedLoadInFlight = false;
let __rollbackInFlight = false;
import { DateTime } from "https://cdn.jsdelivr.net/npm/luxon@3.5.0/build/es6/luxon.js";

/* ========== utilities ========== */
const $ = (id) => document.getElementById(id);
const chip = (txt, tone = "") => `<span class="chip ${tone}">${txt}</span>`;
const fmtDate = (d) => (d ? new Date(d).toISOString().slice(0, 10) : "");
const HTML_ESCAPE_MAP = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

function download(filename, content, mime = "text/csv;charset=utf-8") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    a.remove();
  }, 0);
}

function setLinesStatusTemp(msg, tone = "", ms = 1800) {
  const el = $("linesStatus");
  if (!el) return;
  el.innerHTML = chip(msg, tone);

  // cancel any prior timer and schedule a revert to the default label
  clearTimeout(linesStatusResetTimer);
  linesStatusResetTimer = setTimeout(() => {
    if (!el) return;
    const label = linesStatusDefaultLabel?.trim?.() || "";
    if (label) {
      el.innerHTML = chip(label);
    }
  }, ms);
}
function escapeHtml(value = "") {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (ch) => HTML_ESCAPE_MAP[ch] || ch
  );
}

// Normalize typical RPC return shapes into a numeric triple [ins, upd, deact].
// RPCs in this project sometimes return arrays, sometimes objects with named
// fields — this helper tries common patterns defensively.
function parseRpcTriple(resp) {
  try {
    if (!resp) return [0, 0, 0];
    // If it's already an array of numbers
    if (Array.isArray(resp)) {
      const a = resp
        .slice(0, 3)
        .map((v) => (Number.isFinite(Number(v)) ? Number(v) : 0));
      while (a.length < 3) a.push(0);
      return a;
    }
    // If supabase returned a wrapper like { data: [...] } we've already
    // extracted the data earlier, but handle nested arrays
    if (typeof resp === "object") {
      // Common named fields
      const candidates = [
        ["ins", "upd", "deact"],
        ["inserted", "updated", "deactivated"],
        ["inserts", "updates", "deactivations"],
        ["added", "changed", "removed"],
      ];
      for (const fields of candidates) {
        const [f1, f2, f3] = fields;
        if (f1 in resp || f2 in resp || f3 in resp) {
          const v1 = Number(
            resp[f1] ?? resp[f1.toLowerCase()] ?? Object.values(resp)[0] ?? 0
          );
          const v2 = Number(
            resp[f2] ?? resp[f2.toLowerCase()] ?? Object.values(resp)[1] ?? 0
          );
          const v3 = Number(
            resp[f3] ?? resp[f3.toLowerCase()] ?? Object.values(resp)[2] ?? 0
          );
          return [
            Number.isFinite(v1) ? v1 : 0,
            Number.isFinite(v2) ? v2 : 0,
            Number.isFinite(v3) ? v3 : 0,
          ];
        }
      }
      // Fallback: take up to first three values from the object's values
      const vals = Object.values(resp)
        .slice(0, 3)
        .map((v) => (Number.isFinite(Number(v)) ? Number(v) : 0));
      while (vals.length < 3) vals.push(0);
      return vals;
    }
    // Fallback for primitive
    return [Number(resp) || 0, 0, 0];
  } catch (e) {
    console.debug("parseRpcTriple failed:", e, resp);
    return [0, 0, 0];
  }
}
async function rollbackUnifiedOverrides() {
  if (__rollbackInFlight) return showToast("Undo already in progress...");
  const headerSet = document.getElementById("selPlanHeader");
  const setId = Number(headerSet?.value || "");
  if (!setId) return showToast("Pick a plan in the header first.");
  __rollbackInFlight = true;
  try {
    const { data, error } = await supabase.rpc("rollback_manual_plan_apply", {
      p_from: null, // entire set window
      p_set_id: setId,
      p_to: null,
    });
    if (error) throw error;

    console.debug("rollback_manual_plan_apply resp:", data, error);
    // Normalize response similar to apply flow
    let deactivated = 0;
    try {
      if (Array.isArray(data) && data.length)
        deactivated = Number(data[0] || 0);
      else if (typeof data === "number") deactivated = Number(data || 0);
      else if (typeof data === "string") deactivated = Number(data || 0);
      else if (data && typeof data === "object") {
        const v = Object.values(data).find(
          (x) => x !== undefined && x !== null
        );
        deactivated = Number(v || 0);
      }
    } catch (e) {
      console.debug("parse rollback resp error", e);
      deactivated = Number(data || 0);
    }
    showToast(
      `Undo complete: deactivated ${deactivated} override${
        deactivated === 1 ? "" : "s"
      }.`
    );

    // Refresh tables
    try {
      await loadUnifiedData();
    } catch {
      /* ignore */
    }
    try {
      await loadActiveOverrides();
    } catch {
      /* ignore */
    }
    // Reload plan headers so the header option dataset/status updates too
    try {
      await loadPlanHeaders("selPlanHeader", String(setId));
      try {
        updatePlanWindowDisplay();
      } catch {
        /* ignore */
      }
    } catch (e) {
      console.debug("Failed to reload plan headers after rollback:", e);
    }
  } catch (e) {
    console.error("rollback_manual_plan_apply failed:", e);
    showToast(e?.message || e?.details || "Undo failed; see console.");
  } finally {
    __rollbackInFlight = false;
  }
}
let filterInputTimer = null;
function scheduleLoadLines(delay = 300) {
  clearTimeout(filterInputTimer);
  filterInputTimer = setTimeout(() => {
    loadLines();
  }, delay);
}
function monthFloor(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

// place caret at end of a contenteditable element
function setCaretToEnd(el) {
  try {
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  } catch (e) {
    void e;
    /* ignore caret placement failures */
  }
}

/** Prompt for a new line: product_id, month_start, proposed_qty, note */
function promptLineFields(defaults = {}) {
  return new Promise((resolve) => {
    const dlg = document.createElement("dialog");
    let products = [];

    async function fetchProducts() {
      const deduped = [];
      const seen = new Set();
      let from = 0;
      const batchSize = 200;
      while (true) {
        const { data, error } = await supabase
          .from("v_product_details")
          .select("product_id,product_name")
          .order("product_name")
          .range(from, from + batchSize - 1);
        if (error) throw error;
        const rows = Array.isArray(data) ? data : [];
        for (const row of rows) {
          const pid = Number(row?.product_id);
          if (!Number.isFinite(pid) || seen.has(pid)) continue;
          seen.add(pid);
          deduped.push({
            product_id: pid,
            product_name: row?.product_name || `Product #${pid}`,
          });
        }
        if (rows.length < batchSize) break;
        from += batchSize;
      }
      deduped.sort((a, b) =>
        (a.product_name || "").localeCompare(b.product_name || "")
      );
      return deduped;
    }

    function render() {
      const productOptions =
        products.length === 0
          ? '<option value="" disabled>No products available</option>'
          : ['<option value="">Select a product</option>']
              .concat(
                products.map((p) => {
                  const pid = String(p.product_id);
                  const selected =
                    defaults.product_id && String(defaults.product_id) === pid
                      ? " selected"
                      : "";
                  return `<option value="${escapeHtml(
                    pid
                  )}" data-name="${escapeHtml(
                    p.product_name
                  )}"${selected}>${escapeHtml(p.product_name)}</option>`;
                })
              )
              .join("");

      const monthValue = (() => {
        const raw = defaults.month_start || "";
        return raw ? raw.slice(0, 7) : "";
      })();
      const proposedValue =
        defaults.proposed_qty === null || defaults.proposed_qty === undefined
          ? ""
          : String(defaults.proposed_qty);
      const noteValue = defaults.note ?? "Manual Production Plan";

      dlg.innerHTML = `
        <form method="dialog" id="lineEditorForm" style="min-width:420px;max-width:480px;margin:auto;">
          <div class="modal-header" style="font-weight:600;font-size:1.2em;margin-bottom:16px;text-align:center;">Add Line</div>
          <div class="modal-body" style="display:flex;flex-direction:column;gap:20px;padding:8px 0;">
            <label class="field" style="display:flex;flex-direction:column;gap:6px;width:100%;">
              <span>Product Name</span>
              <select id="lineProductName" style="width:100%;padding:8px 6px;font-size:1em;">${productOptions}</select>
            </label>
            <label class="field" style="display:flex;flex-direction:column;gap:6px;width:100%;">
              <span>Month</span>
              <input id="lineMonth" type="month" style="width:100%;padding:8px 6px;font-size:1em;" value="${escapeHtml(
                monthValue
              )}" />
            </label>
            <label class="field" style="display:flex;flex-direction:column;gap:6px;width:100%;">
              <span>Proposed Qty</span>
              <input id="lineProposedQty" type="number" inputmode="decimal" step="any" style="width:100%;padding:8px 6px;font-size:1em;" value="${escapeHtml(
                proposedValue
              )}" />
            </label>
            <label class="field" style="display:flex;flex-direction:column;gap:6px;width:100%;">
              <span>Note</span>
              <input id="lineNote" type="text" style="width:100%;padding:8px 6px;font-size:1em;" value="${escapeHtml(
                noteValue
              )}" />
            </label>
          </div>
          <div class="modal-footer" style="display:flex;justify-content:flex-end;gap:12px;margin-top:20px;">
            <button type="button" class="btn outline" id="lineCancelBtn">Cancel</button>
            <button type="submit" class="btn primary" id="lineSaveBtn">Add Line</button>
          </div>
        </form>`;
    }

    function cleanup(val) {
      try {
        if (typeof dlg.close === "function") dlg.close();
      } catch {
        /* ignore */
      }
      dlg.remove();
      resolve(val);
    }

    function wireEvents() {
      const form = dlg.querySelector("#lineEditorForm");
      const cancelBtn = dlg.querySelector("#lineCancelBtn");
      const productSelect = dlg.querySelector("#lineProductName");
      const monthInput = dlg.querySelector("#lineMonth");
      const qtyInput = dlg.querySelector("#lineProposedQty");
      const noteInput = dlg.querySelector("#lineNote");

      if (!form || !cancelBtn || !productSelect || !monthInput || !noteInput) {
        cleanup(null);
        return;
      }

      form.addEventListener("submit", (event) => {
        event.preventDefault();
        const option = productSelect.options[productSelect.selectedIndex];
        const productId = option?.value?.trim() || "";
        const productName =
          option?.dataset?.name || option?.textContent?.trim() || "";
        if (!productId) {
          productSelect.focus();
          return;
        }
        const month = monthInput.value ? `${monthInput.value}-01` : "";
        if (!month) {
          monthInput.focus();
          return;
        }
        const proposedQty = qtyInput?.value?.trim() ?? "";
        const note = noteInput.value.trim() || "Manual Production Plan";
        cleanup({
          product_id: productId,
          product_name: productName,
          month_start: month,
          proposed_qty: proposedQty,
          note,
        });
      });

      cancelBtn.addEventListener("click", () => cleanup(null));
      dlg.addEventListener("cancel", (event) => {
        event.preventDefault();
        cleanup(null);
      });
    }

    async function init() {
      try {
        products = await fetchProducts();
      } catch (error) {
        console.error("Failed to load products", error);
        products = [];
      }

      render();
      document.body.appendChild(dlg);
      wireEvents();
      if (typeof dlg.showModal === "function") dlg.showModal();
      else dlg.setAttribute("open", "");
      dlg.querySelector("#lineProductName")?.focus();
    }

    init();
  });
}
/* eslint-disable-next-line no-unused-vars */
function addMonths(d, n) {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}
/* eslint-disable-next-line no-unused-vars */
function fenceStart(today = new Date(), frozenAfter = 25) {
  const base = monthFloor(today);
  if (today.getDate() > frozenAfter) base.setMonth(base.getMonth() + 1);
  return base;
}
function showModal(message, title = "Notice") {
  const dlg = $("poModal");
  if (!dlg) return alert(message);
  $("poModalTitle").textContent = title;
  $("poModalMessage").innerHTML = message;
  if (typeof dlg.showModal === "function") dlg.showModal();
  else dlg.setAttribute("open", "");
}
function closeModal() {
  const dlg = $("poModal");
  if (!dlg) return;
  if (typeof dlg.close === "function") dlg.close();
  else dlg.removeAttribute("open");
}
document.addEventListener("DOMContentLoaded", () => {
  // Wire up RESET button for Edit Lines filters
  const btnResetLineFilters = $("btnResetLineFilters");
  if (btnResetLineFilters) {
    btnResetLineFilters.addEventListener("click", () => {
      resetLineFiltersForNewSet();
      loadLines();
    });
  }
  $("poModalClose")?.addEventListener("click", closeModal);
  $("poModal")?.addEventListener("cancel", (e) => {
    e.preventDefault();
    closeModal();
  });

  // Select/Deselect all checkboxes in Edit Lines table
  const chkAll = $("chkAll");
  if (chkAll) {
    chkAll.addEventListener("change", () => {
      const checked = chkAll.checked;
      document.querySelectorAll(".rowChk").forEach((chk) => {
        chk.checked = checked;
      });
    });
  }
  // Paginator controls
  const sizeSel = $("linesPageSize");
  if (sizeSel) {
    sizeSel.addEventListener("change", () => {
      const v = Number(sizeSel.value) || 20;
      linesPageSize = v;
      linesPage = 1;
      loadLines();
    });
  }
  $("linesPagePrev")?.addEventListener("click", () => {
    if (linesPage > 1) {
      linesPage -= 1;
      loadLines();
    }
  });
  $("linesPageNext")?.addEventListener("click", () => {
    if (linesPage < linesFilteredPages) {
      linesPage += 1;
      loadLines();
    }
  });
  // Ensure filter inputs and toggles are initialized
  initializeLineFilters();
  // Initialize unified reconciliation filters
  initializeUnifiedFilters();
  // Setup tabs so we load lines when switching to the Lines tab
  setupTabs();
});

// lightweight toast used by several modules; fallback to console if no #toast element
function showToast(msg) {
  try {
    const el = document.getElementById("toast");
    if (el) {
      el.textContent = msg;
      el.style.display = "block";
      setTimeout(() => (el.style.display = "none"), 3000);
      return;
    }
  } catch {
    // ignore
  }
  console.log("TOAST:", msg);
}

/**
 * Prompt for two short text inputs using a modal <dialog> and return {name, notes}
 * Returns null if cancelled.
 */
function promptTwoInputs(
  title = "Input",
  aLabel = "Value A",
  bLabel = "Value B",
  aDefault = "",
  bDefault = ""
) {
  return new Promise((resolve) => {
    const dlg = document.createElement("dialog");
    dlg.style.padding = "0";
    dlg.innerHTML = `
      <div style="padding:12px;min-width:320px">
        <div style="font-weight:600;margin-bottom:8px">${title}</div>
        <div style="display:flex;flex-direction:column;gap:8px">
          <label style="font-size:13px">${aLabel}<input id="_a" style="width:100%" value="${aDefault}" /></label>
          <label style="font-size:13px">${bLabel}<input id="_b" style="width:100%" value="${bDefault}" /></label>
        </div>
        <div style="text-align:right;margin-top:12px">
          <button id="_cancel">Cancel</button>
          <button id="_ok">OK</button>
        </div>
      </div>
    `;
    document.body.appendChild(dlg);
    const ok = dlg.querySelector("#_ok");
    const cancel = dlg.querySelector("#_cancel");
    const a = dlg.querySelector("#_a");
    const b = dlg.querySelector("#_b");

    function cleanup(val) {
      if (typeof dlg.close === "function") dlg.close();
      dlg.remove();
      resolve(val);
    }

    ok.addEventListener("click", () =>
      cleanup({ name: a.value.trim(), notes: b.value.trim() })
    );
    cancel.addEventListener("click", () => cleanup(null));

    // allow Esc to cancel
    dlg.addEventListener("cancel", (e) => {
      e.preventDefault();
      cleanup(null);
    });

    // show and focus
    if (typeof dlg.showModal === "function") dlg.showModal();
    else dlg.setAttribute("open", "");
    a.focus();
  });
}

/* ========== auth ========== */
async function ensureAuth() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    window.location.href = "../../login.html";
    return null;
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const whoEl = $("whoAmI");
  if (whoEl) whoEl.textContent = `Logged in as ${user.email}`;
  return user;
}

/* ========== tabs ========== */
function setupTabs() {
  const btns = [...document.querySelectorAll(".tab-btn")];
  const tabs = {
    sets: $("tab-sets"),
    lines: $("tab-lines"),
    reconcile: $("tab-reconcile"),
    active: $("tab-active"),
  };

  function activateTab(btn) {
    if (!btn) return false;
    const tabName = btn.dataset.tab;
    const panel = tabs[tabName];
    if (!panel) return false;

    btns.forEach((b) => {
      const isActive = b === btn;
      b.setAttribute("aria-selected", isActive ? "true" : "false");
      b.classList.toggle("active", isActive);
      b.tabIndex = isActive ? 0 : -1;
    });

    Object.entries(tabs).forEach(([name, el]) => {
      if (!el) return;
      const isActive = name === tabName;
      el.classList.toggle("active", isActive);
      el.setAttribute("aria-hidden", isActive ? "false" : "true");
      el.tabIndex = isActive ? 0 : -1;
    });

    try {
      btn.scrollIntoView({
        behavior: "smooth",
        inline: "center",
        block: "nearest",
      });
    } catch {
      /* no-op */
    }
    // emit a small event so other modules can react to tab changes
    try {
      const tabEvent = new CustomEvent("tabactivated", {
        detail: { tabName },
      });
      document.dispatchEvent(tabEvent);
    } catch {
      /* ignore */
    }
    return true;
  }

  btns.forEach((b, idx) => {
    b.addEventListener("click", () => activateTab(b));
    b.addEventListener("keydown", (evt) => {
      if (evt.key === "ArrowRight" || evt.key === "ArrowLeft") {
        evt.preventDefault();
        const dir = evt.key === "ArrowRight" ? 1 : -1;
        const next = (idx + dir + btns.length) % btns.length;
        if (activateTab(btns[next])) btns[next].focus();
      }
    });
  });

  const initial =
    btns.find((b) => b.getAttribute("aria-selected") === "true") || btns[0];
  activateTab(initial);

  // react to tab activation events so switching to the Lines tab auto-loads
  document.addEventListener("tabactivated", (e) => {
    try {
      const tabName = e?.detail?.tabName;
      if (tabName === "lines") loadLines();
      if (tabName === "reconcile") {
        const selPlanHeader = document.getElementById("selPlanHeader");
        if (selPlanHeader && selPlanHeader.value) {
          loadUnifiedData();
        }
      }
    } catch {
      /* ignore */
    }
  });
}

/* ========== sets ========== */
async function loadSets() {
  // Select columns that exist on the current schema: title, note, created_by
  const { data, error } = await supabase
    .from("manual_plan_sets")
    .select(
      "id,title,note,status,seeded_from_system,created_by,created_at,updated_at"
    )
    .order("created_at", { ascending: false });
  if (error) {
    console.error(error);
    $("setsStatus").textContent = "Error";
    return;
  }
  // resolve current user once for rendering owner labels
  const {
    data: { user: curUser },
  } = await supabase.auth.getUser();

  // fill dropdowns
  const opts = (data || [])
    .map((r) => {
      const label = r.title ?? r.set_name ?? r.name ?? "(unnamed)";
      const ownerLabel = r.created_by
        ? curUser && String(curUser.id) === String(r.created_by)
          ? "You"
          : String(r.created_by)
        : "Production Controller";
      return `<option value="${r.id}">#${r.id} — ${label} — ${ownerLabel}</option>`;
    })
    .join("");
  // populate selects only if they exist on the page (Manual Plan Sets card may be removed)
  const _selSets = $("selSets");
  if (_selSets) _selSets.innerHTML = `<option value="">(pick)</option>` + opts;
  const _selSetForLines = $("selSetForLines");
  if (_selSetForLines)
    _selSetForLines.innerHTML = `<option value="">(pick)</option>` + opts;
  const _selSetForReconcile = $("selSetForReconcile");
  if (_selSetForReconcile)
    _selSetForReconcile.innerHTML = `<option value="">(pick)</option>` + opts;

  // table
  const tbody = $("setsTable").querySelector("tbody");
  tbody.innerHTML = "";
  (data || []).forEach((r) => {
    const tr = document.createElement("tr");
    // Table no longer shows owner; ownerLabel is computed earlier for select labels
    tr.innerHTML = `
      <td>${r.id}</td>
      <td>${escapeHtml(r.title ?? r.set_name ?? r.name ?? "")}</td>
      <td class="muted small">${escapeHtml(r.note ?? "")}</td>
      <td>${fmtDate(r.created_at)}</td>
    `;
    tbody.appendChild(tr);
  });
  const _setsStatus = $("setsStatus");
  if (_setsStatus) _setsStatus.textContent = `${data?.length ?? 0} sets`;
  // ensure visible active set display matches persistent selection after sets load
  try {
    syncActiveSetDisplay();
  } catch {
    /* ignore */
  }
}

// Keep the read-only Active Set display synced with the persistent header selection
function syncActiveSetDisplay() {
  const disp = document.getElementById("activeSetDisplay");
  const selPlan = document.getElementById("selPlanHeader");
  if (!disp) return;
  // prefer showing the title from the header select; otherwise show a dash
  const headerOpt = selPlan?.options[selPlan.selectedIndex];
  if (headerOpt && headerOpt.textContent && headerOpt.textContent.trim()) {
    disp.textContent = headerOpt.textContent.trim();
    return;
  }
  disp.textContent = "—";
}

async function createSet() {
  // Use modal dialog like rename for consistent UX
  const resp = await promptCreateSetModal();
  if (!resp) return; // cancelled
  const set_name = resp.name;
  const notes = resp.notes;

  // set created_by to current user's id if available
  let created_by = null;
  try {
    const {
      data: { user: curUser },
    } = await supabase.auth.getUser();
    if (curUser && curUser.id) created_by = curUser.id;
  } catch {
    /* ignore */
  }

  // create the set
  const { data, error } = await supabase
    .from("manual_plan_sets")
    .insert([{ title: set_name, note: notes, created_by }])
    .select("id")
    .single();

  if (error) {
    console.error(error);
    showModal("Failed to create set.");
    return;
  }

  const newId = data.id;

  // refresh Sets table + per-tab selectors
  await loadSets();
  ["selSets", "selSetForLines", "selSetForReconcile"].forEach((id) => {
    const sel = $(id);
    if (sel) sel.value = newId;
  });

  // 🔹 refresh and auto-select in the persistent header
  try {
    await loadPlanHeaders("selPlanHeader", newId);
    updatePlanWindowDisplay();
    adjustSelectWidth($("selPlanHeader"));
    syncActiveSetDisplay();
    refreshApplyButtonsState();
  } catch {
    /* ignore */
  }

  // reset lines filters and refresh dependent views
  resetLineFiltersForNewSet();
  resetUnifiedFiltersForNewSet();
  await loadLines();
  try {
    await loadUnifiedData(); // if Reconcile tab active, this fills it
  } catch {
    /* ignore */
  }

  showToast(`Created set #${newId}`);
}

async function promptCreateSetModal() {
  const dialog = document.getElementById("createSetDialog");
  const form = document.getElementById("createSetForm");
  const input = document.getElementById("createSetInput");
  const notes = document.getElementById("createSetNotes");
  const cancelBtn = document.getElementById("createSetCancelBtn");
  const errorEl = document.getElementById("createSetError");
  if (!dialog || !form || !input) {
    const fallback = promptTwoInputs(
      "Create Set",
      "Set name (optional):",
      "Notes (optional):",
      "",
      ""
    );
    return fallback;
  }
  return new Promise((resolve) => {
    function close(result) {
      form.reset();
      form.removeEventListener("submit", onSubmit);
      if (cancelBtn) cancelBtn.removeEventListener("click", onCancel);
      dialog.removeEventListener("cancel", onCancel);
      if (typeof dialog.close === "function") dialog.close();
      resolve(result);
    }
    function onCancel(e) {
      e?.preventDefault?.();
      close(null);
    }
    function onSubmit(e) {
      e.preventDefault();
      const value = input.value.trim();
      const noteVal = notes?.value?.trim?.() ?? "";
      // allow empty title (optional)
      close({ name: value, notes: noteVal });
    }
    form.addEventListener("submit", onSubmit);
    if (cancelBtn) cancelBtn.addEventListener("click", onCancel);
    dialog.addEventListener("cancel", onCancel);
    if (errorEl) errorEl.textContent = "";
    input.value = "";
    notes.value = "";
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
    requestAnimationFrame(() => input.focus());
  });
}

async function seedSet() {
  const headerSel = document.getElementById("selPlanHeader");
  const setId = Number(headerSel?.value || "");
  const fromVal = document.getElementById("seedFrom")?.value; // "YYYY-MM"
  const toVal = document.getElementById("seedTo")?.value; // "YYYY-MM"

  if (!setId) return showToast("Select a manual plan set first.");
  if (!fromVal || !toVal) return showToast("Select both From and To months.");

  const setLabel =
    headerSel?.options[headerSel.selectedIndex]?.textContent?.trim() || "";

  // in-page confirmation dialog
  const ok = await confirmSeed({
    setId,
    fromMonth: fromVal,
    toMonth: toVal,
    setLabel,
  });
  if (!ok) return;

  try {
    showToast("Seeding from system plan...");
    const { data, error } = await supabase.rpc("seed_manual_plan_set", {
      p_set_id: setId,
      p_from: `${fromVal}-01`,
      p_to: `${toVal}-01`,
      p_note: "Seeded from system",
    });
    if (error) throw error;

    const inserted = Number(data || 0);
    showToast(
      `Seeded ${inserted} line${inserted === 1 ? "" : "s"} into set #${setId}.`
    );

    // Refresh UI
    await loadLines();
    try {
      await loadUnifiedData();
    } catch {
      /* ignore */
    }
  } catch (err) {
    console.error("seed_manual_plan_set failed:", err);
    showToast(err?.message || err?.details || "Seeding failed; see console.");
  }
}

/* ========== lines ========== */
let linesPage = 1;
let linesPageSize = 20;
let linesTotalRows = 0;
let linesFilteredRows = 0;
let linesFilteredPages = 1;

async function loadLines() {
  // Prefer the persistent header selection (selPlanHeader) for the active set.
  // Fall back to the local "Current Set" selector (selSetForLines) if the
  // header selection is not present or empty. This makes the Edit Lines table
  // reflect the top persistent manual plan set selection.
  const selForLines = $("selSetForLines");
  let setId = selForLines ? Number(selForLines.value) : 0;
  if (!setId) {
    const headerVal = $("selPlanHeader")?.value;
    setId = headerVal ? Number(headerVal) : 0;
    // mirror header selection back into the per-tab selector for clarity
    if (setId && selForLines) selForLines.value = setId;
  }
  const tbody = $("linesTable").querySelector("tbody");
  tbody.innerHTML = "";
  if (!setId) {
    $("linesStatus").innerHTML = chip("Pick a set");
    return;
  }

  // read filters
  const fSet = document.getElementById("filterSetId")?.value?.trim();
  const fMonth = document.getElementById("filterMonth")?.value?.trim();
  const fPid = document.getElementById("filterProductId")?.value?.trim();
  const fPname = document.getElementById("filterProductName")?.value?.trim();
  const fProposed = document.getElementById("filterProposedPresence")?.value;
  const fNote = document.getElementById("filterNote")?.value;
  syncProposedToggle();

  // base query
  let q = supabase
    .from("manual_plan_lines")
    .select("id,set_id,product_id,month_start,proposed_qty,note,updated_at");
  q = q.eq("set_id", setId);
  // apply simple filters
  if (fSet) {
    const num = Number(fSet);
    if (Number.isFinite(num)) q = q.eq("set_id", num);
  }
  if (fPid) {
    const num = Number(fPid);
    if (Number.isFinite(num)) q = q.eq("product_id", num);
  }
  if (fMonth) q = q.eq("month_start", fMonth + "-01");
  if (fProposed === "nonzero") q = q.gt("proposed_qty", 0);
  if (fProposed === "zero") q = q.eq("proposed_qty", 0);
  if (fNote) q = q.eq("note", fNote);
  // For product name search, we filter client-side after fetching matching rows by product_id OR fetch matching product ids first
  // For server-side pagination we apply product-name filtering by resolving matching product_ids first
  // then use Supabase range() with exact count to fetch only the current page rows.
  const fPnameTrim = fPname ? fPname.trim() : "";
  const fPnameLower = fPname ? fPname.toLowerCase() : "";
  let matchingPids = null;
  if (fPnameTrim) {
    try {
      // find product ids whose name matches the search (case-insensitive)
      const { data: matches, error: pmErr } = await supabase
        .from("v_product_details")
        .select("product_id")
        .ilike("product_name", `%${fPnameTrim}%`)
        .limit(1000);
      if (!pmErr && matches && matches.length) {
        matchingPids = matches.map((m) => Number(m.product_id)).filter(Boolean);
      } else {
        // no matching product names -> show no rows
        matchingPids = [];
      }
    } catch (e) {
      console.error("Failed to search products by name", e);
      matchingPids = [];
    }
  }

  q = q.order("product_id").order("month_start");

  // If product name filter exists but no matching product ids, short-circuit to empty dataset
  if (matchingPids && matchingPids.length === 0) {
    // update status and paginator info to show zero rows
    linesTotalRows = 0;
    linesFilteredRows = 0;
    linesFilteredPages = 1;
    // clear table body and update UI
    $("linesTable").querySelector("tbody").innerHTML = "";
    $("linesStatus").innerHTML = chip("No rows");
    $("linesPageInfo").textContent = "No rows";
    $("linesPagePrev")?.setAttribute("disabled", "");
    $("linesPageNext")?.setAttribute("disabled", "");
    return;
  }

  if (matchingPids && Array.isArray(matchingPids)) {
    q = q.in("product_id", matchingPids);
  }
  // Always run an explicit count-only query first so we have the true total
  let totalCount = null;
  try {
    // build a count query with same filters (use head:true to avoid returning rows)
    let countQ = supabase
      .from("manual_plan_lines")
      .select("id", { count: "exact", head: true })
      .eq("set_id", setId);
    if (fSet) {
      const num = Number(fSet);
      if (Number.isFinite(num)) countQ = countQ.eq("set_id", num);
    }
    if (fPid) {
      const num = Number(fPid);
      if (Number.isFinite(num)) countQ = countQ.eq("product_id", num);
    }
    if (fMonth) countQ = countQ.eq("month_start", fMonth + "-01");
    if (fProposed === "present")
      countQ = countQ.not("proposed_qty", "is", null);
    if (fProposed === "absent") countQ = countQ.is("proposed_qty", null);
    if (fNote) countQ = countQ.eq("note", fNote);
    if (matchingPids && Array.isArray(matchingPids))
      countQ = countQ.in("product_id", matchingPids);
    const headRes = await countQ;
    totalCount = Number.isFinite(Number(headRes?.count))
      ? Number(headRes.count)
      : null;
  } catch {
    totalCount = null;
  }

  // If the head:true count did not return a numeric count, run a fallback count
  if (!Number.isFinite(Number(totalCount))) {
    try {
      let countQ2 = supabase
        .from("manual_plan_lines")
        .select("id", { count: "exact" })
        .eq("set_id", setId);
      if (fSet) {
        const num = Number(fSet);
        if (Number.isFinite(num)) countQ2 = countQ2.eq("set_id", num);
      }
      if (fPid) {
        const num = Number(fPid);
        if (Number.isFinite(num)) countQ2 = countQ2.eq("product_id", num);
      }
      if (fMonth) countQ2 = countQ2.eq("month_start", fMonth + "-01");
      if (fProposed === "present")
        countQ2 = countQ2.not("proposed_qty", "is", null);
      if (fProposed === "absent") countQ2 = countQ2.is("proposed_qty", null);
      if (fNote) countQ2 = countQ2.eq("note", fNote);
      if (matchingPids && Array.isArray(matchingPids))
        countQ2 = countQ2.in("product_id", matchingPids);
      const cntRes = await countQ2;
      totalCount = Number.isFinite(Number(cntRes?.count))
        ? Number(cntRes.count)
        : null;
    } catch {
      totalCount = null;
    }
  }

  // server-side pagination: request only the rows for current page
  const serverStartIdx = (linesPage - 1) * linesPageSize;
  const serverEnd = serverStartIdx + linesPageSize - 1;
  let res;
  try {
    res = await q
      .select("id,set_id,product_id,month_start,proposed_qty,note,updated_at")
      .range(serverStartIdx, serverEnd);
  } catch (e) {
    console.error(e);
    $("linesStatus").innerHTML = chip("Load error", "err");
    return;
  }
  const { data, error } = res || {};
  if (error) {
    console.error(error);
    $("linesStatus").innerHTML = chip("Load error", "err");
    return;
  }

  let lines = data || [];
  // total rows after filters (from earlier count-only query)
  linesFilteredRows = Number.isFinite(Number(totalCount))
    ? Number(totalCount)
    : lines.length;
  linesTotalRows = linesFilteredRows;
  // compute pages
  linesFilteredPages = Math.max(
    1,
    Math.ceil(linesFilteredRows / linesPageSize)
  );
  // if the requested page is past the last page (filters changed), fetch the last page
  if (linesPage > linesFilteredPages) {
    linesPage = linesFilteredPages;
    const retryStart = (linesPage - 1) * linesPageSize;
    const retryEnd = retryStart + linesPageSize - 1;
    try {
      const retryRes = await q
        .select("id,set_id,product_id,month_start,proposed_qty,note,updated_at")
        .range(retryStart, retryEnd);
      if (!retryRes.error) {
        lines = retryRes.data || [];
      }
    } catch {
      /* ignore and continue with whatever we have */
    }
  }

  // Populate Note filter dropdown with distinct notes for current set
  try {
    const notesRes = await supabase
      .from("manual_plan_lines")
      .select("note")
      .eq("set_id", setId)
      .not("note", "is", null)
      .limit(1000);
    if (!notesRes.error && notesRes.data) {
      const noteSel = document.getElementById("filterNote");
      if (noteSel) {
        const uniq = Array.from(
          new Set(notesRes.data.map((n) => n.note).filter(Boolean))
        );
        const selectedBefore = fNote || "";
        noteSel.replaceChildren(new Option("(all)", ""));
        uniq.forEach((v) => {
          const opt = new Option(v, v);
          noteSel.appendChild(opt);
        });
        if (selectedBefore && uniq.includes(selectedBefore)) {
          noteSel.value = selectedBefore;
        } else {
          noteSel.value = "";
        }
      }
    }
  } catch (e) {
    console.error("Failed to load notes for filter", e);
  }

  // 'lines' contains only the current page rows returned by the server.
  // Fetch product names/uom for the visible page rows only.
  const pageRows = lines;
  // Build product details map for the visible rows
  const pids = [
    ...new Set(pageRows.map((r) => Number(r.product_id)).filter(Boolean)),
  ];
  let prodMap = new Map();
  if (pids.length) {
    try {
      const { data: prods, error: perr } = await supabase
        .from("v_product_details")
        .select("product_id,product_name,uom_base")
        .in("product_id", pids);
      if (!perr && prods)
        prodMap = new Map(
          prods.map((p) => [
            Number(p.product_id),
            { name: p.product_name, uom: p.uom_base },
          ])
        );
    } catch (e) {
      console.error("Failed to load product names for page", e);
    }
  }
  const firstRow = pageRows.length ? serverStartIdx + 1 : 0;
  const lastRow = pageRows.length ? serverStartIdx + pageRows.length : 0;

  // Render current page rows
  (pageRows || []).forEach((r) => {
    const tr = document.createElement("tr");
    tr.dataset.id = r.id;
    // keep numeric product_id on the row dataset so saves can use it even though we show name
    tr.dataset.productId = r.product_id ?? "";
    const pd = prodMap.get(Number(r.product_id));
    // format month_start as 'Mon YYYY' (e.g., Oct 2025) using luxon
    const monthDisplay = (function (ms) {
      if (!ms) return "";
      try {
        const dt = DateTime.fromISO(ms, { zone: "utc" });
        return dt
          .setZone("utc")
          .toLocaleString({ month: "short", year: "numeric" });
      } catch {
        return ms;
      }
    })(r.month_start);

    // format updated_at using luxon in Asia/Kolkata
    const updatedAtDisplay = (function (ts) {
      if (!ts) return "";
      try {
        const dt = DateTime.fromISO(ts, { zone: "utc" }).setZone(
          "Asia/Kolkata"
        );
        return dt.toFormat("yyyy-LL-dd HH:mm");
      } catch {
        return ts;
      }
    })(r.updated_at);

    const proposedDisplay =
      r.proposed_qty === null || r.proposed_qty === undefined
        ? ""
        : String(r.proposed_qty);
    const noteDisplay = r.note ?? "";

    tr.innerHTML = `
      <td><input type="checkbox" class="rowChk"/></td>
      <td data-col="set_id">${r.set_id ?? ""}</td>
      <td data-col="month_start">${monthDisplay}</td>
      <td data-col="product_id">${r.product_id ?? ""}</td>
      <td>${pd ? escapeHtml(pd.name) : ""}</td>
      <td contenteditable="true" data-col="proposed_qty">${escapeHtml(
        proposedDisplay
      )}</td>
      <td>${pd ? escapeHtml(pd.uom || "") : ""}</td>
      <td contenteditable="true" data-col="note">${escapeHtml(noteDisplay)}</td>
      <td class="muted small">${updatedAtDisplay}</td>
    `;
    // Enhanced editable behavior:
    // - remember original text on focus so Esc can cancel
    // - blur -> save for all editable cells
    // - Proposed Qty: Enter or Tab saves (prevent newline), then autofocus Note and set default
    // - Esc reverts the current cell to its original value
    tr.querySelectorAll("[contenteditable]").forEach((cell) => {
      // store original value on focus
      cell.addEventListener("focus", () => {
        cell.dataset._orig = cell.textContent;
      });

      // blur handler saves the row
      cell.addEventListener("blur", () => saveLineEdit(tr));

      // handle key events
      cell.addEventListener("keydown", (e) => {
        // Esc: revert to original value and blur (do not save)
        if (e.key === "Escape") {
          const orig = cell.dataset._orig ?? "";
          cell.textContent = orig;
          try {
            cell.blur();
          } catch {
            /* ignore */
          }
          e.stopPropagation();
          e.preventDefault();
          return;
        }

        // Enter or Tab in Proposed Qty -> save and move focus to Note
        if (
          cell.dataset.col === "proposed_qty" &&
          (e.key === "Enter" || e.key === "Tab")
        ) {
          e.preventDefault();
          // ensure numeric-like formatting is kept
          try {
            cell.blur(); // triggers save
          } catch {
            saveLineEdit(tr);
          }
          // focus note cell and populate default
          const noteCell = tr.querySelector('[data-col="note"]');
          if (noteCell) {
            noteCell.textContent = "Manual Production Plan";
            // focus and place caret
            setCaretToEnd(noteCell);
            // store orig so Esc can revert from the new text
            noteCell.dataset._orig = noteCell.textContent;
          }
        }
      });
    });
    tbody.appendChild(tr);
  });

  const total = linesTotalRows;
  const shown = linesFilteredRows;
  const filtersApplied = [
    fSet,
    fPid,
    fPnameLower,
    fMonth,
    fProposed,
    fNote,
  ].some((v) => v && String(v).length > 0);
  const statusLabel = filtersApplied
    ? `Showing ${shown} of ${total} rows`
    : `${shown} rows`;

  // Remember the default label so we can revert after transient statuses
  linesStatusDefaultLabel = statusLabel;
  $("linesStatus").innerHTML = chip(statusLabel);

  // If a transient timer is pending, keep it (user may have just edited);
  // otherwise make sure the pill shows the default.
  if (!linesStatusResetTimer) {
    $("linesStatus").innerHTML = chip(linesStatusDefaultLabel);
  }
  $("chkAll").checked = false;
  const sizeSel = $("linesPageSize");
  if (sizeSel && String(sizeSel.value) !== String(linesPageSize)) {
    sizeSel.value = String(linesPageSize);
  }
  // Update paginator info
  const pageInfo = $("linesPageInfo");
  if (pageInfo) {
    pageInfo.textContent = pageRows.length
      ? `Rows ${firstRow}-${lastRow} of ${linesFilteredRows} (Page ${linesPage} of ${linesFilteredPages})`
      : "No rows";
  }
  // Enable/disable prev/next
  $("linesPagePrev")?.toggleAttribute("disabled", linesPage <= 1);
  $("linesPageNext")?.toggleAttribute(
    "disabled",
    linesPage >= linesFilteredPages
  );
}

function syncProposedToggle() {
  const hidden = document.getElementById("filterProposedPresence");
  if (!hidden) return;
  // Scope to the nearest toggle-group for the proposed presence control
  const buttons =
    hidden
      .closest(".toggle-group")
      ?.querySelectorAll("[data-proposed-toggle]") ||
    hidden.parentElement?.querySelectorAll("[data-proposed-toggle]") ||
    [];
  if (!buttons.length) return;
  const value = hidden.value || "";
  buttons.forEach((btn) => {
    const btnValue = btn.dataset.proposedToggle ?? "";
    btn.classList.toggle("active", btnValue === value);
    btn.setAttribute("aria-pressed", btnValue === value ? "true" : "false");
  });
}

function resetLineFiltersForNewSet() {
  [
    "filterSetId",
    "filterProductId",
    "filterProductName",
    "filterMonth",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
  const noteSel = document.getElementById("filterNote");
  if (noteSel) noteSel.value = "";
  const hidden = document.getElementById("filterProposedPresence");
  if (hidden) hidden.value = "";
  syncProposedToggle();
  linesPage = 1;
}

function initializeLineFilters() {
  const setInput = document.getElementById("filterSetId");
  if (setInput) {
    setInput.addEventListener("input", () => {
      linesPage = 1;
      scheduleLoadLines();
    });
    setInput.addEventListener("change", () => {
      linesPage = 1;
      loadLines();
    });
  }
  const prodIdInput = document.getElementById("filterProductId");
  if (prodIdInput) {
    prodIdInput.addEventListener("input", () => {
      linesPage = 1;
      scheduleLoadLines();
    });
    prodIdInput.addEventListener("change", () => {
      linesPage = 1;
      loadLines();
    });
  }
  const prodNameInput = document.getElementById("filterProductName");
  if (prodNameInput) {
    prodNameInput.addEventListener("input", () => {
      linesPage = 1;
      scheduleLoadLines();
    });
  }
  const monthInput = document.getElementById("filterMonth");
  monthInput?.addEventListener("change", () => {
    linesPage = 1;
    loadLines();
  });
  const noteSel = document.getElementById("filterNote");
  noteSel?.addEventListener("change", () => {
    linesPage = 1;
    loadLines();
  });
  const hidden = document.getElementById("filterProposedPresence");
  if (hidden) {
    const buttons =
      hidden
        .closest(".toggle-group")
        ?.querySelectorAll("[data-proposed-toggle]") ||
      hidden.parentElement?.querySelectorAll("[data-proposed-toggle]") ||
      [];
    buttons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const val = btn.dataset.proposedToggle ?? "";
        if (hidden) hidden.value = val;
        buttons.forEach((b) => {
          const bVal = b.dataset.proposedToggle ?? "";
          b.classList.toggle("active", bVal === val);
          b.setAttribute("aria-pressed", bVal === val ? "true" : "false");
        });
        linesPage = 1;
        loadLines();
      });
    });
  }
  syncProposedToggle();
}

// Return the effective current set id: prefer per-tab selector, fall back to the
// persistent header selector. Mirrors header back to per-tab selector if present.
function getCurrentSetId() {
  const selForLines = $("selSetForLines");
  let setId = selForLines ? Number(selForLines.value) : 0;
  if (!setId) {
    const headerVal = $("selPlanHeader")?.value;
    setId = headerVal ? Number(headerVal) : 0;
    if (setId && selForLines) selForLines.value = setId;
  }
  return setId || 0;
}

async function saveLineEdit(tr) {
  const id = Number(tr.dataset.id);
  const cells = tr.querySelectorAll("[data-col]");
  const row = {};
  cells.forEach((c) => (row[c.dataset.col] = c.textContent.trim()));
  // product_id may be shown as product name in UI; prefer dataset.productId if present
  const dsPid = tr.dataset.productId;
  if (dsPid) {
    row.product_id = Number(dsPid) || null;
  } else {
    row.product_id = Number(row.product_id || 0) || null;
  }
  row.proposed_qty = row.proposed_qty === "" ? null : Number(row.proposed_qty);
  if (row.proposed_qty == null || Number.isNaN(row.proposed_qty))
    row.proposed_qty = 0;
  if (row.proposed_qty < 0) row.proposed_qty = 0;
  // Auto-fill Note when Proposed Qty is provided but note is empty
  if (
    row.proposed_qty !== null &&
    row.proposed_qty !== undefined &&
    (!row.note || row.note === "")
  ) {
    row.note = "Manual Production Plan";
    // reflect into DOM so the user sees it immediately
    try {
      const noteCell = tr.querySelector('[data-col="note"]');
      if (noteCell) noteCell.textContent = row.note;
    } catch {
      /* ignore DOM update failures */
    }
  }
  // month_start format guard: expect YYYY-MM-01
  if (row.month_start && !/^\d{4}-\d{2}-\d{2}$/.test(row.month_start)) {
    // Allow user-friendly 'Mon YYYY' (e.g., 'Oct 2025') and convert to 'YYYY-MM-01'
    const maybe = row.month_start.trim();
    const parsed = DateTime.fromFormat(maybe, "LLL yyyy", { zone: "utc" });
    if (parsed.isValid) {
      // set to first of month
      row.month_start = parsed.set({ day: 1 }).toISODate();
    } else {
      showModal(
        "month must be in 'Mon YYYY' (e.g. Oct 2025) or YYYY-MM-DD (YYYY-MM-01)."
      );
      return;
    }
  }
  const { error } = await supabase
    .from("manual_plan_lines")
    .update(row)
    .eq("id", id);
  if (error) {
    console.error(error);
    setLinesStatusTemp("Save error", "err", 2500);
    return;
  }
  setLinesStatusTemp("Saved", "ok", 1500);
}

async function addLine() {
  const setId = getCurrentSetId();
  if (!setId) return showModal("Pick a set first.");
  const vals = await promptLineFields();
  if (!vals) return; // cancelled
  const product_id = Number(vals.product_id) || null;
  const month_start = vals.month_start;
  const proposed_qty =
    vals.proposed_qty === "" ? 0 : Math.max(0, Number(vals.proposed_qty) || 0);
  const note = vals.note || "Manual Production Plan";
  if (!product_id || !month_start) return;
  const { error } = await supabase
    .from("manual_plan_lines")
    .insert([{ set_id: setId, product_id, month_start, proposed_qty, note }]);
  if (error) {
    console.error(error);
    showModal("Insert failed.");
    return;
  }
  await loadLines();
}

async function deleteSelectedLines() {
  const setId = getCurrentSetId();
  if (!setId) return showModal("Pick a set first.");
  const ids = [...document.querySelectorAll(".rowChk:checked")].map((ch) =>
    Number(ch.closest("tr").dataset.id)
  );
  if (!ids.length)
    return showModal(
      "Select line(s) to delete by clicking the tickbox at their left."
    );

  // Show confirmation using the dedicated Delete Confirmation modal
  const confirmed = await confirmDeleteLines(ids.length);
  if (!confirmed) return;

  const { error } = await supabase
    .from("manual_plan_lines")
    .delete()
    .in("id", ids);
  if (error) {
    console.error(error);
    showModal("Delete failed.");
    return;
  }

  await loadLines();
}

/**
 * Show a confirmation dialog using the dedicated Delete Confirmation modal
 * Returns true if user confirms, false if cancelled
 */
function confirmDeleteLines(count) {
  return new Promise((resolve) => {
    const dlg = $("deleteConfirmModal");
    if (!dlg) {
      // fallback to window.confirm
      const msg = `Warning: This action will permanently delete ${count} selected line${
        count > 1 ? "s" : ""
      }.\nAre you sure you want to proceed?`;
      resolve(window.confirm(msg));
      return;
    }
    // Set modal content
    $("deleteConfirmTitle").textContent = "Delete Confirmation";
    $(
      "deleteConfirmMessage"
    ).innerHTML = `<div style='color:#b71c1c;font-weight:500;margin-bottom:10px;'>Warning: This action will permanently delete <b>${count}</b> selected line${
      count > 1 ? "s" : ""
    }.</div><div>Are you sure you want to proceed?</div>`;
    // Show modal
    if (typeof dlg.showModal === "function") dlg.showModal();
    else dlg.setAttribute("open", "");
    // Wire buttons
    const cancelBtn = document.getElementById("deleteConfirmCancelBtn");
    const deleteBtn = document.getElementById("deleteConfirmDeleteBtn");
    function cleanup(val) {
      if (typeof dlg.close === "function") dlg.close();
      else dlg.removeAttribute("open");
      resolve(val);
    }
    cancelBtn?.addEventListener("click", () => cleanup(false), { once: true });
    deleteBtn?.addEventListener("click", () => cleanup(true), { once: true });
    dlg.addEventListener(
      "cancel",
      (e) => {
        e.preventDefault();
        cleanup(false);
      },
      { once: true }
    );
    // Focus Cancel for accessibility
    setTimeout(() => cancelBtn?.focus(), 100);
  });
}
// Export/import of manual set lines UI removed; related handlers deleted.

function confirmApply() {
  return new Promise((resolve) => {
    const dlg = document.getElementById("applyConfirmDialog");
    if (!dlg) return resolve(false);
    const btnCancel = document.getElementById("applyConfirmCancelBtn");
    const btnOk = document.getElementById("applyConfirmConfirmBtn");

    function done(val) {
      try {
        dlg.close();
      } catch (e) {
        void e;
        /* ignore */
      }
      resolve(val);
    }
    btnCancel?.addEventListener("click", () => done(false), { once: true });
    btnOk?.addEventListener("click", () => done(true), { once: true });
    dlg.addEventListener(
      "cancel",
      (e) => {
        e.preventDefault();
        done(false);
      },
      { once: true }
    );

    if (typeof dlg.showModal === "function") dlg.showModal();
    else dlg.setAttribute("open", "");
  });
}
// Unified Reconciliation & Apply Card Logic

async function loadUnifiedData() {
  if (__unifiedLoadInFlight) return; // prevent overlaps
  __unifiedLoadInFlight = true;

  const headerSet = document.getElementById("selPlanHeader");
  const status = document.getElementById("unifiedStatus");
  const body = document.querySelector("#unifiedTable tbody");
  const sumEl = document.getElementById("unifiedSummary");

  try {
    if (!body) {
      console.error("Unified reconciliation table body not found");
      if (status) status.textContent = "Missing table";
      return;
    }

    const setId = Number(headerSet?.value || "");
    body.innerHTML = "";
    if (sumEl) sumEl.textContent = "";
    window.__unifiedRows = [];

    if (!setId || !Number.isFinite(setId)) {
      if (status) status.textContent = "Select a plan in the header.";
      unifiedPage = 1;
      renderUnifiedPage();
      return;
    }

    if (status) status.textContent = "Loading…";

    // Request ONLY the columns that exist on the view
    const baseCols = [
      "product_id",
      "item",
      "uom_base",
      "month_start",
      "manual_qty",
      "system_qty",
      "delta_qty",
      "bottled_qty_base",
      "fg_bulk_qty_base",
      "wip_qty_base",
      "bmr_not_initiated_cnt",
      "is_manual_needed",
      "reason",
    ].join(",");

    // Build the server-side query and apply filters from the UI
    let q = supabase
      .from("v_supply_recon")
      .select(baseCols)
      .eq("set_id", setId);

    // Read filter values (server-side semantics)
    const pid = document.getElementById("filterUProductId")?.value?.trim();
    const item = document.getElementById("filterUItem")?.value?.trim();
    const month = document.getElementById("filterUMonth")?.value; // YYYY-MM
    const manualPresence =
      document.getElementById("filterUManualPresence")?.value ?? "";
    const systemPresence =
      document.getElementById("filterUSystemPresence")?.value ?? "";
    const deltaPresence =
      document.getElementById("filterUDeltaPresence")?.value ?? "";
    const neededFilter = document.getElementById("filterUNeeded")?.value ?? "";

    // Product ID exact match
    if (pid) {
      const pnum = Number(pid);
      if (Number.isFinite(pnum)) q = q.eq("product_id", pnum);
    }

    // Item substring, case-insensitive
    if (item) q = q.ilike("item", `%${item}%`);

    // Month: restrict month_start to >= first of month and < first of next month
    if (month) {
      const m = String(month).match(/(\d{4})-(\d{2})/);
      if (m) {
        const y = Number(m[1]);
        const mo = Number(m[2]) - 1;
        // Use UTC dates to avoid timezone shifting when serializing
        const start = new Date(Date.UTC(y, mo, 1)).toISOString().slice(0, 10);
        const next = new Date(Date.UTC(y, mo + 1, 1))
          .toISOString()
          .slice(0, 10);
        q = q.gte("month_start", start).lt("month_start", next);
      }
    }

    // Presence toggles: map to server-side equality/inequality
    if (manualPresence === "nonZero") q = q.neq("manual_qty", 0);
    else if (manualPresence === "zero") q = q.eq("manual_qty", 0);

    if (systemPresence === "nonZero") q = q.neq("system_qty", 0);
    else if (systemPresence === "zero") q = q.eq("system_qty", 0);

    if (deltaPresence === "nonZero") q = q.neq("delta_qty", 0);
    else if (deltaPresence === "zero") q = q.eq("delta_qty", 0);

    // Needed? filter: 'yes' => is_manual_needed = true, 'no' => false
    if (neededFilter === "yes") q = q.eq("is_manual_needed", true);
    else if (neededFilter === "no") q = q.eq("is_manual_needed", false);

    // Apply ordering
    q = q
      .order("product_id", { ascending: true })
      .order("month_start", { ascending: true });

    const { data, error } = await q;

    if (error) throw error;

    const rows = (data || []).filter(
      (r) =>
        !(Number(r.manual_qty || 0) === 0 && Number(r.system_qty || 0) === 0)
    );

    // Summary pills: only Total + Needed
    if (sumEl) {
      const needed = rows.reduce(
        (acc, r) => acc + (r.is_manual_needed ? 1 : 0),
        0
      );
      sumEl.innerHTML =
        chip("Total rows: " + rows.length) +
        " " +
        chip("Needed rows: " + needed, needed ? "warn" : "ok");
    }

    window.__unifiedRows = rows;

    // Reset paging and render
    unifiedPage = 1;
    const pageSizeSel = document.getElementById("unifiedPageSize");
    if (pageSizeSel)
      unifiedPageSize = Number(pageSizeSel.value) || unifiedPageSize;
    renderUnifiedPage();

    if (status) status.textContent = "";
  } catch (e) {
    console.error("v_supply_recon load failed:", e);
    showToast(e?.message || "Reconciliation load failed");
    if (status) status.textContent = "Load failed";
    window.__unifiedRows = [];
    unifiedPage = 1;
    renderUnifiedPage();
  } finally {
    __unifiedLoadInFlight = false;
  }
}

function exportUnifiedCSV() {
  const rows = Array.isArray(window.__unifiedRows) ? window.__unifiedRows : [];

  if (!rows.length) {
    showToast("Nothing to export");
    return;
  }

  // Try to read the UI headers from the table head. If not found, use a sane fallback.
  const ths = [...document.querySelectorAll("#unifiedTable thead th")];
  const uiHeaders = ths
    .map((th) => (th.textContent || "").trim())
    .filter(Boolean);

  // This must match the render order in renderUnifiedPage()
  const fieldOrder = [
    "product_id",
    "item",
    "uom_base",
    "month_start",
    "manual_qty",
    "system_qty",
    "delta_qty",
    "bottled_qty_base",
    "fg_bulk_qty_base",
    "wip_qty_base",
    "bmr_not_initiated_cnt",
    "is_manual_needed",
    "reason_text", // computed below from the reason/batch strings
  ];

  // Fallback headers (used only if we can't read the thead reliably)
  const fallbackHeaders = [
    "Product ID",
    "Item",
    "UOM",
    "Month",
    "Manual Qty",
    "System Qty",
    "Delta Qty",
    "Bottled (base)",
    "FG Bulk (base)",
    "WIP (base)",
    "BMR not initiated",
    "Needed?",
    "Reason",
  ];

  const headers =
    uiHeaders.length === fieldOrder.length ? uiHeaders : fallbackHeaders;

  const csv = reconToCSV_WithHeaders(rows, fieldOrder, headers);
  if (!csv) {
    showToast("Nothing to export");
    return;
  }

  const setId = document.getElementById("selPlanHeader")?.value || "set";
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, ""); // YYYYMMDD
  download(`supply_reconciliation-${setId}-${today}.csv`, csv);
}

// Pagination state for unified table
let unifiedPage = 1;
let unifiedPageSize = 20;

// Pagination state for Active Overrides
let aoPage = 1;
let aoPageSize = 20;

/**
 * Format a month/date value into `Mon YYYY` (e.g. "Oct 2025").
 * Accepts ISO date strings like '2025-10-01' or Date objects.
 */
function formatMonth(val) {
  if (!val) return "";
  try {
    // If already a Date
    if (val instanceof Date) {
      if (isNaN(val)) return "";
      return val.toLocaleString(undefined, { month: "short", year: "numeric" });
    }
    // For string values, try Date parsing first
    const d = new Date(val);
    if (!isNaN(d)) {
      return d.toLocaleString(undefined, { month: "short", year: "numeric" });
    }
    // Fallback: attempt to parse YYYY-MM or YYYY-MM-DD
    const m = String(val).match(/(\d{4})-(\d{2})/);
    if (m) {
      const y = Number(m[1]);
      const mo = Number(m[2]) - 1;
      const d2 = new Date(y, mo, 1);
      return d2.toLocaleString(undefined, { month: "short", year: "numeric" });
    }
    return String(val);
  } catch {
    return String(val);
  }
}

function renderUnifiedPage() {
  const filteredRows = window.__unifiedRows || [];
  // Rows are loaded from server with filters applied; use them directly

  const tbody = document.querySelector("#unifiedTable tbody");
  const pageSizeSel = document.getElementById("unifiedPageSize");
  const pageInfo = document.getElementById("unifiedPageInfo");
  if (!tbody) return;

  const total = filteredRows.length;
  unifiedPageSize = Number(pageSizeSel?.value) || unifiedPageSize;
  const totalPages = Math.max(1, Math.ceil(total / unifiedPageSize));
  if (unifiedPage > totalPages) unifiedPage = totalPages;

  const start = (unifiedPage - 1) * unifiedPageSize;
  const pageRows = filteredRows.slice(start, start + unifiedPageSize);

  tbody.innerHTML = "";
  pageRows.forEach((r) => {
    const tr = document.createElement("tr");
    if (r.is_manual_needed) tr.classList.add("needed");
    tr.innerHTML = `
      <td>${r.product_id}</td>
      <td>${r.item ?? ""}</td>
      <td>${r.uom_base ?? ""}</td>
      <td>${formatMonth(r.month_start)}</td>
      <td>${pretty(r.manual_qty)}</td>
      <td>${pretty(r.system_qty)}</td>
      <td>${pretty(r.delta_qty)}</td>
      <td>${pretty(r.bottled_qty_base)}</td>
      <td>${pretty(r.fg_bulk_qty_base)}</td>
      <td>${pretty(r.wip_qty_base)}</td>
      <td>${r.bmr_not_initiated_cnt ?? 0}</td>
      <td>${r.is_manual_needed ? "Yes" : ""}</td>
      <td class="small">${reasonWithDetails({
        reason_text:
          r.reason_text ?? r.reason ?? r.reasonText ?? r.reason_detail ?? null,
        bottled_batches: r.bottled_batches,
        fg_bulk_batches: r.fg_bulk_batches,
        wip_batches: r.wip_batches,
        bmr_batches: r.bmr_batches,
      })}</td>
    `;
    tbody.appendChild(tr);
  });

  pageInfo.textContent = pageRows.length
    ? `Rows ${start + 1}-${
        start + pageRows.length
      } of ${total} (Page ${unifiedPage} of ${totalPages})`
    : "No rows";

  document
    .getElementById("unifiedPagePrev")
    ?.toggleAttribute("disabled", unifiedPage <= 1);
  document
    .getElementById("unifiedPageNext")
    ?.toggleAttribute("disabled", unifiedPage >= totalPages);
}

// Filtering is performed server-side in loadUnifiedData(), so client-side
// applyUnifiedFilters is no longer needed.

function resetUnifiedFiltersForNewSet() {
  ["filterUProductId", "filterUItem", "filterUMonth"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
  [
    "filterUManualPresence",
    "filterUSystemPresence",
    "filterUDeltaPresence",
    "filterUNeeded",
  ].forEach((hid) => {
    const h = document.getElementById(hid);
    if (h) h.value = "";
    // Scope to the nearest toggle-group so we don't affect other filter groups
    const group =
      h?.closest(".toggle-group")?.querySelectorAll("[data-proposed-toggle]") ||
      h?.parentElement?.querySelectorAll("[data-proposed-toggle]") ||
      [];
    group.forEach((b, i) => {
      try {
        b.classList.toggle("active", i === 0);
        b.setAttribute("aria-pressed", i === 0 ? "true" : "false");
      } catch (e) {
        void e;
        /* ignore */
      }
    });
  });
}

function initializeUnifiedFilters() {
  // Inputs
  const pid = document.getElementById("filterUProductId");
  pid?.addEventListener("input", () => {
    unifiedPage = 1;
    loadUnifiedData();
  });
  const item = document.getElementById("filterUItem");
  item?.addEventListener("input", () => {
    unifiedPage = 1;
    loadUnifiedData();
  });
  const mon = document.getElementById("filterUMonth");
  mon?.addEventListener("change", () => {
    unifiedPage = 1;
    loadUnifiedData();
  });

  // Toggle groups wiring helper
  function wireToggle(hiddenId) {
    const hidden = document.getElementById(hiddenId);
    if (!hidden) return;
    // Prefer the buttons contained inside the same .toggle-group as the hidden input
    const group =
      hidden
        .closest(".toggle-group")
        ?.querySelectorAll("[data-proposed-toggle]") ||
      hidden.parentElement?.querySelectorAll("[data-proposed-toggle]") ||
      [];
    group.forEach((btn) => {
      btn.addEventListener("click", () => {
        const val = btn.dataset.proposedToggle ?? "";
        hidden.value = val;
        group.forEach((b) => {
          const bVal = b.dataset.proposedToggle ?? "";
          b.classList.toggle("active", bVal === val);
          b.setAttribute("aria-pressed", bVal === val ? "true" : "false");
        });
        unifiedPage = 1;
        loadUnifiedData();
      });
    });
  }

  wireToggle("filterUManualPresence");
  wireToggle("filterUSystemPresence");
  wireToggle("filterUDeltaPresence");
  wireToggle("filterUNeeded");
}

async function applyUnifiedOverrides() {
  const headerSet = document.getElementById("selPlanHeader");
  const setId = Number(headerSet?.value || "");
  if (!setId) return showToast("Pick a plan in the header first.");

  const from = null,
    to = null; // whole set
  const thr = 0.0; // keep, but no UI control

  try {
    let { data: resp1, error: e1 } = await supabase.rpc(
      "apply_manual_plan_set",
      { p_set_id: setId, p_from: from, p_to: to, p_threshold: thr }
    );
    console.debug("apply_manual_plan_set resp:", resp1, e1);
    if (e1) throw e1;
    const [ins1, upd1, deact1] = parseRpcTriple(resp1);
    let { data: resp2, error: e2 } = await supabase.rpc(
      "apply_production_overrides",
      { p_from: from, p_to: to }
    );
    console.debug("apply_production_overrides resp:", resp2, e2);
    if (e2) throw e2;
    const [ins2, upd2, deact2] = parseRpcTriple(resp2);
    // mark plan as applied (capture result to check for update errors)
    let updRes = null;
    try {
      updRes = await supabase
        .from("manual_plan_sets")
        .update({ status: "applied" })
        .eq("id", setId);
    } catch (uErr) {
      console.error("manual_plan_sets update threw:", uErr);
      showToast("Plan status update failed; see console");
      throw uErr;
    }
    console.debug("manual_plan_sets update result:", updRes);
    if (updRes?.error) {
      console.error("manual_plan_sets update error:", updRes.error);
      showToast(
        "Failed to set plan status to applied: " +
          (updRes.error.message || updRes.error.details || updRes.error)
      );
      // continue to refresh UI so user sees table changes, but rethrow to go to catch
      throw updRes.error;
    }
    showToast(
      `Staging: +${ins1}/${upd1}/${deact1} | Overrides: +${ins2}/${upd2}/${deact2}`
    );
    await loadUnifiedData();
    // Refresh selected plan metadata from server so the header dataset/status
    // and label are authoritative (covers cases where server changed status).
    try {
      // Reload the header options and auto-select the current id so the
      // option.dataset.status and tooltip are authoritative.
      await loadPlanHeaders("selPlanHeader", String(setId));
      try {
        updatePlanWindowDisplay();
      } catch {
        /* ignore */
      }
    } catch {
      /* ignore */
    }
    // Reload Active Overrides so table reflects applied changes
    try {
      await loadActiveOverrides();
    } catch {
      /* ignore */
    }
  } catch (err) {
    console.error(err);
    showToast("Apply failed; see console");
    try {
      await loadUnifiedData();
    } catch {
      /* ignore */
    }
    try {
      await loadActiveOverrides();
    } catch {
      /* ignore */
    }
    // Refresh selected plan metadata and update header display by reloading
    // the plan headers (this ensures option dataset/status is refreshed).
    try {
      await loadPlanHeaders("selPlanHeader", String(setId));
      try {
        updatePlanWindowDisplay();
      } catch {
        /* ignore */
      }
    } catch {
      /* ignore */
    }
  }
}

// NEW: Undo button
function wireUnifiedCard() {
  document.querySelectorAll("#btnUnifiedExport").forEach((el) => {
    el.addEventListener("click", exportUnifiedCSV, { once: false });
  });

  // Confirm before applying
  document
    .getElementById("btnUnifiedApply")
    ?.addEventListener("click", async () => {
      const ok = await confirmApply();
      if (!ok) return;
      await applyUnifiedOverrides();
    });

  // Undo button is handled via the confirmation dialog wired in DOMContentLoaded;
  // do not attach a direct click handler here which could cause duplicate calls.

  // Reset unified filters button
  const btnResetUnified = document.getElementById("btnResetUnifiedFilters");
  btnResetUnified?.addEventListener("click", () => {
    resetUnifiedFiltersForNewSet();
    unifiedPage = 1;
    loadUnifiedData();
  });
}

/* ========== reconcile & apply ========== */
// ─── Reconciliation helpers ─────────────────────────────────────
/* eslint-disable-next-line no-unused-vars */
function reconToCSV(rows) {
  if (!rows || !rows.length) return "";
  const cols = [
    "product_id",
    "item",
    "uom_base",
    "month_start",
    "manual_qty",
    "system_qty",
    "delta_qty",
    "bottled_qty_base",
    "fg_bulk_qty_base",
    "wip_qty_base",
    "bmr_not_initiated_cnt",
    "is_manual_needed",
    "reason_text",
  ];
  const head = cols.join(",");
  // Ensure the reason column contains the same computed text as the UI.
  const prepared = (rows || []).map((r) => {
    const reasonSource =
      r.reason_text ?? r.reason ?? r.reasonText ?? r.reason_detail ?? null;
    const reason = reasonWithDetails({
      reason_text: reasonSource,
      bottled_batches: r.bottled_batches,
      fg_bulk_batches: r.fg_bulk_batches,
      wip_batches: r.wip_batches,
      bmr_batches: r.bmr_batches,
    });
    return Object.assign({}, r, { reason_text: reason });
  });

  const body = prepared
    .map((r) =>
      cols
        .map((c) => {
          const v = r[c] ?? "";
          const s = typeof v === "string" ? v : String(v ?? "");
          return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(",")
    )
    .join("\n");
  return head + "\n" + body;
}

function reconToCSV_WithHeaders(rows, fieldOrder, headerLabels) {
  if (!rows || !rows.length) return "";

  // Prepare rows so reason_text matches UI (and Needed? is the same "Yes"/"")
  const prepared = rows.map((r) => {
    const reasonSource =
      r.reason_text ?? r.reason ?? r.reasonText ?? r.reason_detail ?? null;
    const reason = reasonWithDetails({
      reason_text: reasonSource,
      bottled_batches: r.bottled_batches,
      fg_bulk_batches: r.fg_bulk_batches,
      wip_batches: r.wip_batches,
      bmr_batches: r.bmr_batches,
    });

    // mirror UI for the "Needed?" column: "Yes" or ""
    const neededUi = r.is_manual_needed ? "Yes" : "";

    return {
      ...r,
      is_manual_needed: neededUi,
      reason_text: reason,
    };
  });

  // CSV escape helper
  const esc = (val) => {
    const s = val === null || val === undefined ? "" : String(val);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const head = headerLabels.map(esc).join(",");
  const body = prepared
    .map((r) => fieldOrder.map((f) => esc(r[f])).join(","))
    .join("\n");

  return head + "\n" + body;
}

/* ========== plan header selector (persistent) ========== */
async function loadPlanHeaders(intoId = "selPlanHeader", preferredId) {
  const sel = document.getElementById(intoId);
  if (!sel) return;
  sel.innerHTML = `<option value="">(choose a plan...)</option>`;
  let storedId = preferredId ?? null;
  if (storedId == null && intoId === "selPlanHeader") {
    try {
      storedId = localStorage.getItem("supply_overrides_selected_plan");
    } catch {
      storedId = null;
    }
  }
  if (storedId != null) storedId = String(storedId);
  try {
    const { data, error } = await supabase
      .from("manual_plan_sets")
      .select("id,title,status,created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw error;
    (data || []).forEach((r) => {
      const opt = document.createElement("option");
      opt.value = r.id;
      // keep status on the option dataset for programmatic access
      opt.dataset.status = r.status || "";
      // show only the title in the visible select list
      opt.textContent = r.title || "(untitled)";
      // provide id/status as a tooltip on hover for quick reference
      opt.title = `#${r.id}${r.status ? " · " + r.status : ""}`;
      sel.appendChild(opt);
    });
  } catch {
    console.error("Failed to load manual plan sets");
    sel.innerHTML = `<option value="">(failed to load)</option>`;
  }
  if (storedId && sel.querySelector(`option[value='${storedId}']`)) {
    sel.value = storedId;
  }
  if (intoId === "selPlanHeader") updatePlanWindowDisplay();
  // autosize if this is the header select
  if (intoId === "selPlanHeader") adjustSelectWidth(sel);
  // ➜ ensure Apply/Undo reflect current selection
  if (intoId === "selPlanHeader") refreshApplyButtonsState();
  // attempt auto-load of active overrides for this selection
  if (intoId === "selPlanHeader" && sel.value) {
    try {
      autoLoadActiveOverridesForSelectedPlan()?.catch(() => {});
    } catch {
      /* ignore */
    }
  }
}

// adjust a select element's width to fit its selected option text
function adjustSelectWidth(selectEl) {
  if (!selectEl) return;
  try {
    const tmp = document.createElement("span");
    tmp.style.position = "absolute";
    tmp.style.visibility = "hidden";
    tmp.style.whiteSpace = "pre";
    tmp.style.font = window.getComputedStyle(selectEl).font;
    tmp.textContent =
      selectEl.options[selectEl.selectedIndex]?.textContent ||
      selectEl.placeholder ||
      "";
    document.body.appendChild(tmp);
    const width = Math.ceil(tmp.getBoundingClientRect().width) + 40; // padding + arrow room
    selectEl.style.width = width + "px";
    tmp.remove();
  } catch {
    /* ignore */
  }
}

function refreshPlanActionState() {
  const sel = document.getElementById("selPlanHeader");
  const renameBtn = document.getElementById("planRenameBtn");
  const deleteBtn = document.getElementById("planDeleteBtn");
  const statusBadge = document.getElementById("planStatusBadge");
  const hasSelection = !!sel?.value;
  if (renameBtn) renameBtn.disabled = !hasSelection;
  if (deleteBtn) deleteBtn.disabled = !hasSelection;
  if (statusBadge)
    statusBadge.style.display = hasSelection ? "inline-flex" : "none";
}

function updatePlanWindowDisplay() {
  const sel = document.getElementById("selPlanHeader");
  if (!sel) return;
  // persist selection in localStorage
  try {
    if (sel.value)
      localStorage.setItem("supply_overrides_selected_plan", sel.value);
    else localStorage.removeItem("supply_overrides_selected_plan");
  } catch {
    /* ignore */
  }
  // expose globally for other modules
  window.__selectedPlanHeader = sel.value || null;
  // update status badge near selector
  try {
    const badge = document.getElementById("planStatusBadge");
    const opt = sel.options[sel.selectedIndex];
    const status = opt?.dataset?.status || "";
    if (badge) {
      badge.textContent = status || "—";
      badge.className = "status-chip";
      if (status === "applied") badge.classList.add("ok");
      else if (status === "submitted") badge.classList.add("warn");
      else if (status === "archived") badge.classList.add("err");
    }
  } catch {
    /* ignore */
  }
  refreshPlanActionState();
  refreshApplyButtonsState();
}

// NOTE: header reloading is now done via loadPlanHeaders("selPlanHeader", id)
// so the dedicated per-row refresh helper was removed.

// When a manual plan set is selected in the persistent header, auto-fill the
// Active Overrides From/To inputs from that set's line range and then load
// the Active Overrides table automatically.
async function autoLoadActiveOverridesForSelectedPlan() {
  const sel = document.getElementById("selPlanHeader");
  if (!sel) return;
  const setId = Number(sel.value || 0);
  if (!setId) return;
  try {
    // Fetch min and max month_start using ordered queries (reliable across
    // Supabase client versions). Use earliest and latest month_start for the set.
    const { data: d1, error: e1 } = await supabase
      .from("manual_plan_lines")
      .select("month_start")
      .eq("set_id", setId)
      .order("month_start", { ascending: true })
      .limit(1)
      .single();
    const { data: d2, error: e2 } = await supabase
      .from("manual_plan_lines")
      .select("month_start")
      .eq("set_id", setId)
      .order("month_start", { ascending: false })
      .limit(1)
      .single();
    if (e1 || e2) throw e1 || e2;
    const from = d1?.month_start ? d1.month_start.slice(0, 10) : "";
    const to = d2?.month_start ? d2.month_start.slice(0, 10) : "";
    // Pass the computed bounds directly to the loader
    await loadActiveOverrides(from || null, to || null);
    return;
  } catch (err) {
    // don't block UX if auto-load fails; just log
    console.error("autoLoadActiveOverridesForSelectedPlan failed:", err);
  }
}

async function promptRenamePlanModal(currentTitle = "") {
  const dialog = document.getElementById("renamePlanDialog");
  const form = document.getElementById("renamePlanForm");
  const input = document.getElementById("renamePlanInput");
  const cancelBtn = document.getElementById("renamePlanCancelBtn");
  const errorEl = document.getElementById("renamePlanError");
  if (!dialog || !form || !input) {
    const fallback = prompt("Rename plan", currentTitle);
    return fallback ? fallback.trim() : null;
  }
  return new Promise((resolve) => {
    function close(result) {
      form.reset();
      form.removeEventListener("submit", onSubmit);
      if (cancelBtn) cancelBtn.removeEventListener("click", onCancel);
      dialog.removeEventListener("cancel", onCancel);
      if (typeof dialog.close === "function") dialog.close();
      resolve(result);
    }
    function onCancel(e) {
      e?.preventDefault?.();
      close(null);
    }
    function onSubmit(e) {
      e.preventDefault();
      const value = input.value.trim();
      if (!value) {
        if (errorEl) errorEl.textContent = "Enter a plan title.";
        input.focus();
        return;
      }
      if (errorEl) errorEl.textContent = "";
      close(value);
    }
    form.addEventListener("submit", onSubmit);
    if (cancelBtn) cancelBtn.addEventListener("click", onCancel);
    dialog.addEventListener("cancel", onCancel);
    if (errorEl) errorEl.textContent = "";
    input.value = currentTitle;
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
    requestAnimationFrame(() => {
      input.focus();
      input.select();
    });
  });
}

async function confirmDeletePlanModal(planTitle = "") {
  const dialog = document.getElementById("deletePlanDialog");
  const form = document.getElementById("deletePlanForm");
  const cancelBtn = document.getElementById("deletePlanCancelBtn");
  const messageEl = document.getElementById("deletePlanMessage");
  if (messageEl) {
    const safe = escapeHtml(planTitle || "this plan");
    messageEl.innerHTML = `Delete <strong>${safe}</strong>?<br/>This action cannot be undone.`;
  }
  if (!dialog || !form) {
    return confirm(
      `Delete "${planTitle || "this plan"}"? This action cannot be undone.`
    );
  }
  return new Promise((resolve) => {
    function close(result) {
      form.removeEventListener("submit", onSubmit);
      if (cancelBtn) cancelBtn.removeEventListener("click", onCancel);
      dialog.removeEventListener("cancel", onCancel);
      if (typeof dialog.close === "function") dialog.close();
      resolve(result);
    }
    function onCancel(e) {
      e?.preventDefault?.();
      close(false);
    }
    function onSubmit(e) {
      e.preventDefault();
      close(true);
    }
    form.addEventListener("submit", onSubmit);
    if (cancelBtn) cancelBtn.addEventListener("click", onCancel);
    dialog.addEventListener("cancel", onCancel);
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
    requestAnimationFrame(() => {
      cancelBtn?.focus();
    });
  });
}

async function renamePlan(id) {
  if (!id) return;
  const sel = document.getElementById("selPlanHeader");
  const currentTitle =
    sel?.options[sel.selectedIndex]?.textContent?.trim() ?? "";
  const newTitle = await promptRenamePlanModal(currentTitle);
  if (!newTitle || newTitle === currentTitle) return;
  try {
    const { error } = await supabase
      .from("manual_plan_sets")
      .update({ title: newTitle })
      .eq("id", Number(id));
    if (error) throw error;
    showToast("Renamed");
    await loadPlanHeaders("selPlanHeader", id);
    await loadLines();
  } catch (e) {
    console.error(e);
    showModal("Rename failed");
  }
}

async function deletePlan(id) {
  if (!id) return;
  const sel = document.getElementById("selPlanHeader");
  const title =
    sel?.options[sel.selectedIndex]?.textContent?.trim() ?? `Plan #${id}`;
  const confirmed = await confirmDeletePlanModal(title);
  if (!confirmed) return;
  try {
    const { error } = await supabase
      .from("manual_plan_sets")
      .delete()
      .eq("id", Number(id));
    if (error) throw error;
    showToast("Deleted");
    // clear selection
    try {
      localStorage.removeItem("supply_overrides_selected_plan");
    } catch {
      /* ignore */
    }
    resetLineFiltersForNewSet();
    await loadPlanHeaders();
    await loadLines();
  } catch (e) {
    console.error(e);
    showModal("Delete failed");
  }
}

// Pretty number: max 2 decimals, no trailing zeros
const nf2 = new Intl.NumberFormat(undefined, {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});
function pretty(n) {
  const x = Number(n);
  return Number.isFinite(x) ? nf2.format(x) : n ?? "";
}

function reasonWithDetails(r) {
  const parts = [];
  if (r.reason_text) parts.push(r.reason_text);
  // Append explicit lists (only when present)
  if (r.bottled_batches) parts.push(`Bottled: ${r.bottled_batches}`);
  if (r.fg_bulk_batches) parts.push(`FG Bulk: ${r.fg_bulk_batches}`);
  if (r.wip_batches) parts.push(`WIP: ${r.wip_batches}`);
  if (r.bmr_batches) parts.push(`BMR: ${r.bmr_batches}`);
  return parts.join(" | ");
}

/* ========== active overrides ========== */
async function loadActiveOverrides(fromParam = null, toParam = null) {
  // Accept optional from/to parameters (YYYY-MM-DD). If not provided, do not
  // apply date bounds (load entire set window).
  const from = fromParam !== null ? fromParam : "";
  const to = toParam !== null ? toParam : "";
  // Build base query
  let q = supabase.from("production_qty_overrides");
  // apply select with exact count via head=false
  const selectCols =
    "product_id,month_start,delta_units,reason,created_at,updated_at,v_product_details(product_name,uom_base)";
  q = q.select(selectCols, { count: "exact" });
  q = q.order("product_id");
  q = q.order("month_start");
  // Apply Active Overrides UI filters (Product ID, Item, Month)
  try {
    const fid = document.getElementById("filterAOProductId")?.value?.trim();
    const fmonth = document.getElementById("filterAOMonth")?.value; // YYYY-MM
    if (fid) {
      const pnum = Number(fid);
      if (Number.isFinite(pnum)) q = q.eq("product_id", pnum);
    }
    if (fmonth) {
      const m = String(fmonth).match(/(\d{4})-(\d{2})/);
      if (m) {
        const y = Number(m[1]);
        const mo = Number(m[2]) - 1;
        const start = new Date(Date.UTC(y, mo, 1)).toISOString().slice(0, 10);
        const next = new Date(Date.UTC(y, mo + 1, 1))
          .toISOString()
          .slice(0, 10);
        q = q.gte("month_start", start).lt("month_start", next);
      }
    }
    // Note: item filter will be applied client-side after fetching rows to avoid
    // server-side relation filtering which can sometimes return rows without
    // the joined v_product_details payload. This keeps item/uom available.
  } catch {
    /* ignore filter parsing errors */
  }
  // If the source table exposes an `is_active` column, only show active rows.
  // Probe the table for the column to avoid errors when the column doesn't exist.
  try {
    const { error: probeErr } = await supabase
      .from("production_qty_overrides")
      .select("is_active")
      .limit(1);
    if (!probeErr) {
      q = q.eq("is_active", true);
      console.debug("Applied is_active=true filter for Active Overrides");
    } else {
      console.debug(
        "is_active column not present on production_qty_overrides; skipping filter"
      );
    }
  } catch (e) {
    console.debug("is_active probe failed; skipping is_active filter", e);
  }
  if (from) q = q.gte("month_start", from);
  if (to) q = q.lte("month_start", to);
  // Exclude rows where delta_units is exactly zero (not meaningful overrides)
  q = q.neq("delta_units", 0);

  // apply pagination range
  aoPageSize =
    Number(document.getElementById("aoPageSize")?.value) || aoPageSize;
  const start = (aoPage - 1) * aoPageSize;
  const end = start + aoPageSize - 1;
  const { data, error, count } = await q.range(start, end);
  if (error) {
    console.error(error);
    $("aoStatus").innerHTML = chip("Error", "err");
    return;
  }
  const tbody = $("aoTable").querySelector("tbody");
  tbody.innerHTML = "";
  // pageRows come back with nested v_product_details (via join) — normalize
  const pageRows = Array.isArray(data) ? data : [];
  // Ensure we have product details for each row; if some rows lack v_product_details
  // (can happen depending on server-side relation filtering), do a per-page lookup
  // for missing product_ids and merge results.
  const pidsMissing = Array.from(
    new Set(
      pageRows
        .map((rr) => {
          const nested = rr.v_product_details || null;
          const pd = Array.isArray(nested) ? nested[0] || null : nested || null;
          return pd && pd.product_name ? null : Number(rr.product_id) || null;
        })
        .filter(Boolean)
    )
  );
  if (pidsMissing.length) {
    try {
      const { data: pdData, error: pdErr } = await supabase
        .from("v_product_details")
        .select("product_id,product_name,uom_base")
        .in("product_id", pidsMissing);
      if (!pdErr && Array.isArray(pdData)) {
        const pdMap = new Map();
        pdData.forEach((pd) => pdMap.set(Number(pd.product_id), pd));
        pageRows.forEach((rr) => {
          const pid = Number(rr.product_id);
          const nested = rr.v_product_details || null;
          const pd = Array.isArray(nested) ? nested[0] || null : nested || null;
          if (!(pd && pd.product_name) && pdMap.has(pid)) {
            rr.v_product_details = [pdMap.get(pid)];
          }
        });
      }
    } catch (e) {
      // ignore missing product details errors and continue rendering
      console.error("Failed to fetch product details for AO page:", e);
    }
  }

  // Apply client-side Item filter (if present) to the fetched page rows so we
  // don't rely on server-side relation filtering which can strip joined data.
  const itemFilter = document.getElementById("filterAOItem")?.value?.trim();
  const filteredRows = itemFilter
    ? pageRows.filter((rr) => {
        const nested = rr.v_product_details || null;
        const pd = Array.isArray(nested) ? nested[0] || {} : nested || {};
        const name = String(pd.product_name || "");
        return name.toLowerCase().includes(itemFilter.toLowerCase());
      })
    : pageRows;

  filteredRows.forEach((r) => {
    const tr = document.createElement("tr");
    // Supabase returns joined related rows either as an array or an object
    const nested = r.v_product_details || null;
    const pd = Array.isArray(nested) ? nested[0] || {} : nested || {};
    // format Month as 'MMM yyyy' (e.g. Oct 2025)
    let monthLabel = "";
    try {
      if (r.month_start) {
        const m = DateTime.fromISO(String(r.month_start));
        monthLabel = m.isValid ? m.toFormat("LLL yyyy") : String(r.month_start);
      }
    } catch {
      monthLabel = String(r.month_start ?? "");
    }

    // format created_at/updated_at into IST 'yyyy-MM-dd HH:mm:ss'
    const toIST = (iso) => {
      if (!iso) return "";
      try {
        const dt = DateTime.fromISO(String(iso)).setZone("Asia/Kolkata");
        return dt.isValid ? dt.toFormat("yyyy-MM-dd HH:mm:ss") : String(iso);
      } catch {
        return String(iso || "");
      }
    };

    const createdAtLabel = toIST(r.created_at);
    const updatedAtLabel = toIST(r.updated_at);

    tr.innerHTML = `
      <td>${r.product_id}</td>
      <td>${escapeHtml(pd.product_name || "")}</td>
      <td>${escapeHtml(pd.uom_base || "")}</td>
      <td>${escapeHtml(monthLabel)}</td>
      <td>${r.delta_units}</td>
      <td>${r.reason ?? ""}</td>
      <td>${escapeHtml(createdAtLabel)}</td>
      <td>${escapeHtml(updatedAtLabel)}</td>
    `;
    tbody.appendChild(tr);
  });
  // show pill with row count to the left of paginator
  const aoRowCount = Number((count ?? (data || []).length) || 0);
  const aoStatusLabel = aoRowCount ? `${aoRowCount} Rows` : "No rows";
  // remember default label if needed by transient status helpers
  try {
    // store default label similarly to linesStatusDefaultLabel
    window.aoStatusDefaultLabel = aoStatusLabel;
  } catch (e) {
    void e;
  }
  $("aoStatus").innerHTML = chip(aoStatusLabel);
  // update paginator info
  const total = Number(count || 0);
  const totalPages = Math.max(1, Math.ceil(total / aoPageSize));
  const aoInfo = document.getElementById("aoPageInfo");
  if (aoInfo) {
    if ((data || []).length)
      aoInfo.textContent = `Rows ${start + 1}-${
        start + (data || []).length
      } of ${total} (Page ${aoPage} of ${totalPages})`;
    else aoInfo.textContent = "No rows";
  }
  document
    .getElementById("aoPagePrev")
    ?.toggleAttribute("disabled", aoPage <= 1);
  document
    .getElementById("aoPageNext")
    ?.toggleAttribute("disabled", aoPage >= totalPages);
}
// Export/import of manual set lines UI removed; related handlers deleted.
function wire() {
  // tabs have been set up separately
  $("btnCreateSet")?.addEventListener("click", createSet);
  $("btnSeedSet")?.addEventListener("click", seedSet);

  $("btnAddLine")?.addEventListener("click", addLine);
  $("btnDeleteSelected")?.addEventListener("click", deleteSelectedLines);
  initializeLineFilters();
  const prevBtn = $("linesPagePrev");
  if (prevBtn) {
    prevBtn.addEventListener("click", () => {
      if (linesPage <= 1) return;
      linesPage -= 1;
      loadLines();
    });
  }
  const nextBtn = $("linesPageNext");
  if (nextBtn) {
    nextBtn.addEventListener("click", () => {
      if (linesPage >= linesFilteredPages) return;
      linesPage += 1;
      loadLines();
    });
  }
  const pageSizeSel = $("linesPageSize");
  if (pageSizeSel) {
    pageSizeSel.value = String(linesPageSize);
    pageSizeSel.addEventListener("change", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLSelectElement)) return;
      const val = parseInt(target.value, 10);
      if (!Number.isFinite(val) || val <= 0) {
        target.value = String(linesPageSize);
        return;
      }
      if (val === linesPageSize) return;
      linesPageSize = val;
      linesPage = 1;
      loadLines();
    });
  }
  // Export/Import UI removed; no event wiring needed

  // Unified Reconciliation & Apply card wiring
  wireUnifiedCard();

  // wire unified pagination controls
  const uprev = document.getElementById("unifiedPagePrev");
  const unext = document.getElementById("unifiedPageNext");
  const upageSize = document.getElementById("unifiedPageSize");
  uprev?.addEventListener("click", () => {
    if (unifiedPage <= 1) return;
    unifiedPage -= 1;
    renderUnifiedPage();
  });
  unext?.addEventListener("click", () => {
    unifiedPage += 1;
    renderUnifiedPage();
  });
  upageSize?.addEventListener("change", () => {
    unifiedPage = 1;
    unifiedPageSize = Number(upageSize.value) || unifiedPageSize;
    renderUnifiedPage();
  });

  // Loading of Active Overrides is automatic based on selected plan; no manual
  // Load button listener required.

  // wire Active Overrides pagination controls
  const aPrev = document.getElementById("aoPagePrev");
  const aNext = document.getElementById("aoPageNext");
  const aPageSize = document.getElementById("aoPageSize");
  if (aPageSize) {
    aPageSize.value = String(aoPageSize);
    aPageSize.addEventListener("change", (ev) => {
      const target = ev.target;
      if (!(target instanceof HTMLSelectElement)) return;
      const val = Number(target.value) || aoPageSize;
      if (!Number.isFinite(val) || val <= 0) {
        target.value = String(aoPageSize);
        return;
      }
      aoPageSize = val;
      aoPage = 1;
      loadActiveOverrides();
    });
  }
  aPrev?.addEventListener("click", () => {
    if (aoPage <= 1) return;
    aoPage -= 1;
    loadActiveOverrides();
  });
  aNext?.addEventListener("click", () => {
    aoPage += 1;
    loadActiveOverrides();
  });

  // Initialize AO filters
  try {
    initializeAOFilters();
  } catch {
    /* ignore */
  }

  // Wire Active Overrides filters
  function initializeAOFilters() {
    const pid = document.getElementById("filterAOProductId");
    const item = document.getElementById("filterAOItem");
    const mon = document.getElementById("filterAOMonth");
    if (pid)
      pid.addEventListener("input", () => {
        aoPage = 1;
        loadActiveOverrides();
      });
    if (item)
      item.addEventListener("input", () => {
        aoPage = 1;
        loadActiveOverrides();
      });
    if (mon)
      mon.addEventListener("change", () => {
        aoPage = 1;
        loadActiveOverrides();
      });
    // Reset button wiring
    const resetBtn = document.getElementById("btnResetAOFilters");
    if (resetBtn) {
      resetBtn.addEventListener("click", () => {
        try {
          const p = document.getElementById("filterAOProductId");
          const it = document.getElementById("filterAOItem");
          const mo = document.getElementById("filterAOMonth");
          if (p) p.value = "";
          if (it) it.value = "";
          if (mo) mo.value = "";
        } catch {
          /* ignore */
        }
        aoPage = 1;
        loadActiveOverrides();
      });
    }
  }
  // If the Manual Plan Sets card is present, wire its change event; otherwise skip
  const _selSetsEl = document.getElementById("selSets");
  if (_selSetsEl) {
    _selSetsEl.addEventListener("change", () => {
      const v = _selSetsEl.value;
      if (v) {
        const s2 = document.getElementById("selSetForLines");
        const s3 = document.getElementById("selSetForReconcile");
        if (s2) s2.value = v;
        if (s3) s3.value = v;
        resetLineFiltersForNewSet();
        resetUnifiedFiltersForNewSet();
        loadLines();
      }
    });
  }

  // Plan header selector wiring (persistent)
  const selPlan = document.getElementById("selPlanHeader");
  const renameBtn = document.getElementById("planRenameBtn");
  const deleteBtn = document.getElementById("planDeleteBtn");
  const createBtn = document.getElementById("planCreateBtn");
  const statusBadge = document.getElementById("planStatusBadge");
  // hide status pill by default until a plan selected
  if (statusBadge) statusBadge.style.display = "none";
  if (selPlan) {
    selPlan.addEventListener("change", () => {
      updatePlanWindowDisplay();
      adjustSelectWidth(selPlan);
      // propagate persistent selection to other set selectors used in the Manual Plan Sets tab
      const val = selPlan.value;
      try {
        const s1 = document.getElementById("selSets");
        const s2 = document.getElementById("selSetForLines");
        const s3 = document.getElementById("selSetForReconcile");
        if (s1 && val && s1.querySelector(`option[value='${val}']`))
          s1.value = val;
        if (s2 && val && s2.querySelector(`option[value='${val}']`))
          s2.value = val;
        if (s3 && val && s3.querySelector(`option[value='${val}']`))
          s3.value = val;
        // trigger loads to update dependent UI
        resetLineFiltersForNewSet();
        resetUnifiedFiltersForNewSet();
        loadLines();
        // Also refresh Reconcile table when persistent plan changes
        try {
          loadUnifiedData();
        } catch {
          /* ignore */
        }
      } catch {
        /* ignore */
      }
      // sync visible active set display (if present)
      try {
        syncActiveSetDisplay();
      } catch {
        /* ignore */
      }
      refreshApplyButtonsState();
    });
  }
  // rename/delete button wiring
  if (renameBtn) {
    renameBtn.addEventListener("click", () => {
      const id = selPlan?.value;
      if (!id) return showToast("Pick a plan first.");
      renamePlan(id);
    });
  }
  if (deleteBtn) {
    deleteBtn.addEventListener("click", () => {
      const id = selPlan?.value;
      if (!id) return showToast("Pick a plan first.");
      deletePlan(id);
    });
  }
  if (createBtn) {
    createBtn.addEventListener("click", () => createSet());
  }
  // initial load
  try {
    loadPlanHeaders()
      .then(() => {
        try {
          syncActiveSetDisplay();
        } catch {
          /* ignore */
        }
        loadLines();
        // Optional: default Seed window to the next 2 months
        try {
          const fromEl = $("seedFrom");
          const toEl = $("seedTo");
          if (fromEl && toEl) {
            const today = new Date();
            const y = today.getFullYear();
            const m = String(today.getMonth() + 1).padStart(2, "0");
            const m2 = String(((today.getMonth() + 1) % 12) + 1).padStart(
              2,
              "0"
            );
            const y2 = today.getMonth() === 11 ? y + 1 : y;
            fromEl.value = `${y}-${m}`;
            toEl.value = `${y2}-${m2}`;
          }
        } catch (e) {
          void e;
          /* ignore */
        }
        // If the Reconcile tab is currently active, and a persistent plan is selected,
        // trigger loadUnifiedData so the table populates on first load (loadPlanHeaders is async).
        try {
          const reconPanel = document.getElementById("tab-reconcile");
          const selPlanHeader = document.getElementById("selPlanHeader");
          if (
            reconPanel &&
            reconPanel.classList.contains("active") &&
            selPlanHeader &&
            selPlanHeader.value
          ) {
            // call asynchronously to avoid interfering with other init tasks
            setTimeout(() => {
              try {
                loadUnifiedData();
              } catch {
                /* ignore */
              }
            }, 0);
          }
        } catch {
          /* ignore */
        }
      })
      .catch(() => {
        /* ignore */
      });
  } catch {
    /* ignore */
  }

  // Home button handler (like demand-overrides module)
  const homeBtn = document.getElementById("homeBtn");
  if (homeBtn) {
    homeBtn.onclick = () => {
      window.location.href = "index.html";
    };
  }
}

/* ========== boot ========== */

async function boot() {
  console.log("[supply-overrides] boot() called");
  const user = await ensureAuth();
  if (!user) return;
  setupTabs();
  wire();
  await loadSets();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
