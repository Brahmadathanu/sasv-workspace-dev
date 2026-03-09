// js/log-edit.js

import { supabase } from "../public/shared/js/supabaseClient.js";
import { requireAuthAndPermission } from "../public/shared/js/appAuth.js";
import { bootstrapApp } from "../public/shared/js/appBootstrap.js";

/* global flatpickr, confirmDatePlugin, TomSelect */

/* ────────────────────────────────────────────────────────────────────────────
    DATE HELPERS & FLATPICKR SETUP
  ─────────────────────────────────────────────────────────────────────────────*/

/** Parse a "DD-MM-YYYY" string into a Date object */
function parseDMY(str) {
  const [d, m, y] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Format a Date object as "DD-MM-YYYY" */
function formatDMY(dt) {
  const dd = String(dt.getDate()).padStart(2, "0");
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  return `${dd}-${mm}-${dt.getFullYear()}`;
}

/** Add business days to a Date, skipping Sundays */
function addBusinessDays(startDate, days) {
  const d = new Date(startDate.getTime());
  let added = 0;
  while (added < days) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0) added++;
  }
  return d;
}

/* ── NEW: convert UI date → ISO (YYYY-MM-DD) ─────────────────────────── */
const toISO = (dmy) => {
  if (!dmy) return null; // keep NULL / empty
  const [d, m, y] = dmy.split("-");
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
};

/* ── NEW: short, readable text for duplicate-key errors ──────────────── */
const duplicateMessage = (data) =>
  "A log with these details already exists:\n\n" +
  `Item          : ${data.item}\n` +
  `Batch Number  : ${data.batch_number}\n` +
  `Activity      : ${data.activity}\n` +
  `Log Date      : ${data.log_date}\n\n` +
  "Open the existing log instead of saving changes.";

// Flatpickr configuration: dd-mm-YYYY, input allowed, Today  Clear, no confirm button
const fpOptions = {
  dateFormat: "d-m-Y",
  allowInput: true,
  clickOpens: true,
  plugins: [
    confirmDatePlugin({
      showTodayButton: true,
      showClearButton: true,
      showConfirmButton: false,
      todayText: "Today",
      clearText: "Clear",
    }),
  ],
};

/** Attach an input mask that auto-inserts hyphens as DD-MM-YYYY is typed */
function attachMask(el) {
  if (!el) return;
  el.addEventListener("input", () => {
    let v = el.value.replace(/\D/g, "").slice(0, 8);
    if (v.length > 2) v = v.slice(0, 2) + "-" + v.slice(2);
    if (v.length > 5) v = v.slice(0, 5) + "-" + v.slice(5);
    el.value = v;
  });
}

/* ────────────────────────────────────────────────────────────────────────────
    MAIN INITIALIZATION
  ─────────────────────────────────────────────────────────────────────────────*/
document.addEventListener("DOMContentLoaded", async () => {
  try {
    console.log("[log-edit] DOMContentLoaded fired");

    const boot = await bootstrapApp({ loginPage: "login.html" });
    if (!boot.ok) return;
    console.log("[log-edit] bootstrap passed");

    // Auth & permission gate: ensure active session and module view permission
    const gate = await requireAuthAndPermission(
      "module:edit-log-entry",
      "view",
    );
    if (!gate.ok) return;
    console.log("[log-edit] auth gate passed");

    // Inject CSS to hide any leftover Flatpickr “OK” tick icon
    const css = document.createElement("style");
    css.textContent = `
      .flatpickr-confirm, .flatpickr-confirm::before {
        display: none !important;
      }
      /* make locked fields visibly greyed */
      .locked{
        pointer-events:none;
        background:#eee !important;
        color:#666 !important;
        opacity:.7;
      }
    `;
    document.head.append(css);
    console.log("[log-edit] CSS injected");

    // ─── Apply mask  Flatpickr to modal & filter date inputs ─────────
    console.log("[log-edit] Initializing date inputs");
    ["doneCompletedOn", "e_start", "e_comp", "fLogDate"].forEach((id) => {
      const el = document.getElementById(id);
      if (!el) {
        console.warn(`[log-edit] Missing date element: ${id}`);
        return;
      }

      attachMask(el);

      // For all except fLogDate we disallow future dates too
      if (id !== "fLogDate") {
        flatpickr(el, { ...fpOptions, maxDate: "today" });
        // Clamp manually-typed values on blur
        el.addEventListener("blur", () => {
          if (!el.value) return; // don't run on empty value
          const d = parseDMY(el.value);
          const today = new Date();
          if (d > today) {
            el.value = formatDMY(today);
          }
        });
      } else {
        // Log Date filter: no max restriction, re-run loadFull on change
        flatpickr(el, {
          ...fpOptions,
          onChange: async () => {
            await reloadActivityTS();
            resetPaging();
            loadFull();
          },
        });
      }
    });
    console.log("[log-edit] Date inputs initialized");

    // Leave Due Date alone (auto-calculated, no picker)
    const dueEl = document.getElementById("e_due");
    if (dueEl) dueEl.readOnly = true;

    // ───────── Element references ─────────────────────────────────────────────
    const homeBtn = document.getElementById("homeBtn");
    const fullBody = document.getElementById("fullBody");

    const fLogDate = document.getElementById("fLogDate");
    const fSection = document.getElementById("fSection");
    const fSub = document.getElementById("fSub");
    const fArea = document.getElementById("fArea");
    const fItem = document.getElementById("fItem");
    const fBN = document.getElementById("fBN");
    const fActivity = document.getElementById("fActivity");
    const fStatus = document.getElementById("fStatus");
    const fResidual = document.getElementById("fResidual");
    const clearFull = document.getElementById("clearFull");

    // Done-modal refs
    const doneModal = document.getElementById("doneModal");
    const doneForm = document.getElementById("doneForm");
    const doneCompletedOn = document.getElementById("doneCompletedOn");
    const doneQtySection = document.getElementById("doneQtySection");
    const doneLabRefSection = document.getElementById("doneLabRefSection");
    const doneSkuSection = document.getElementById("doneSkuSection");
    const doneSkuBody = document.querySelector("#doneSkuTable tbody");
    const doneTransSection = document.getElementById("doneTransSection");
    const doneTransBody = document.querySelector("#doneTransTable tbody");
    const doneCancel = document.getElementById("doneCancel");
    const doneJust = document.getElementById("doneJust");
    const doneNew = document.getElementById("doneNew");

    // Edit-modal refs
    const editModal = document.getElementById("editModal");
    const editSuccess = document.getElementById("editSuccess");
    const editForm = document.getElementById("editForm");
    const cancelEdit = document.getElementById("cancelEdit");
    cancelEdit.onclick = () => hideModal(editModal);

    const e_id = document.getElementById("e_id");
    const e_size = document.getElementById("e_size");
    const e_uom = document.getElementById("e_uom");
    const e_activity = document.getElementById("e_activity");
    const juiceS = document.getElementById("juiceS");
    const e_juice = document.getElementById("e_juice");
    const e_specify = document.getElementById("e_specify");
    const rmJuiceSection = document.getElementById("rmJuiceSection");
    const e_rmJuiceQty = document.getElementById("e_rm_juice_qty");
    const e_rmJuiceUom = document.getElementById("e_rm_juice_uom");
    const putamS = document.getElementById("putamS");
    const e_count = document.getElementById("e_count");
    const e_fuel = document.getElementById("e_fuel");
    const e_fuel_under = document.getElementById("e_fuel_under");
    const e_fuel_over = document.getElementById("e_fuel_over");
    const storageSection = document.getElementById("storageSection");
    const e_storageQty = document.getElementById("e_storage_qty");
    const e_storageUom = document.getElementById("e_storage_qty_uom");
    const e_start = document.getElementById("e_start");
    const e_due = document.getElementById("e_due");
    const e_comp = document.getElementById("e_comp");
    const e_status = document.getElementById("e_status");
    const editQtySection = document.getElementById("editQtySection");
    const e_qty = document.getElementById("e_qty");
    const e_qty_uom = document.getElementById("e_qty_uom");
    const labRefSection = document.getElementById("labRefSection");
    const e_lab_ref = document.getElementById("e_lab_ref");
    const editSkuSection = document.getElementById("editSkuSection");
    const editSkuBody = document.querySelector("#editSkuTable tbody");
    const editTransSection = document.getElementById("editTransSection");
    const editTransBody = document.querySelector("#editTransTable tbody");

    console.log("[log-edit] Element references collected");

    // Basic guards for critical elements
    if (!homeBtn) console.warn("[log-edit] Missing #homeBtn");
    if (!fullBody) {
      console.error("[log-edit] Missing #fullBody; cannot render table");
      // stop early — loadFull depends on this
    }
    if (!doneModal) console.warn("[log-edit] Missing #doneModal");
    if (!editModal) console.warn("[log-edit] Missing #editModal");

    // Confirm-modal refs
    const confirmModal = document.getElementById("confirmModal");
    const confirmText = document.getElementById("confirmText");
    const confirmYes = document.getElementById("confirmYes");
    const confirmNo = document.getElementById("confirmNo");

    if (!confirmModal) console.warn("[log-edit] Missing #confirmModal");

    // Module-scope handles for the edit modal item & batch fields
    let e_item;
    let e_bn;
    let e_section;
    let e_sub;
    let e_area;
    let e_plant;
    let e_remarks;
    let editRow = null; // holds the full row fetched when opening the edit modal

    // ── Paging state & helpers ───────────────────────────────────────────────
    const pager = {
      offset: 0,
      sizeUnfiltered: 10, // last 10 by default
      sizeFiltered: 100, // when any filter is applied
      total: null,
    };

    function anyFilterActive() {
      return Boolean(
        fLogDate.value ||
        fSection.value ||
        fSub.value ||
        fArea.value ||
        fItem.value ||
        fBN.value ||
        fActivity.value ||
        fStatus.value ||
        fResidual.checked,
      );
    }

    function resetPaging() {
      pager.offset = 0;
      pager.total = null;
    }

    function updatePagerUI(isFiltered, rowsReturned) {
      const pagerWrap = document.getElementById("pager");
      const info = document.getElementById("resultsInfo");
      const loadMore = document.getElementById("loadMore");

      // If pager elements are missing, just skip UI updates
      if (!pagerWrap || !info || !loadMore) return;

      // Show pager only in filtered mode
      if (!isFiltered) {
        pagerWrap.style.display = "none";
        info.textContent = "";
        return;
      }

      const start = pager.offset + 1;
      const end = pager.offset + rowsReturned;
      const total = pager.total ?? end;

      pagerWrap.style.display = "flex";
      info.textContent = `Showing ${start}–${end} of ${total}`;

      // enable/disable Load More
      loadMore.disabled = end >= total;
    }

    // Dynamic packaging activities (lowercased)
    const sectionMap = {};
    let skuActivities = []; // filled by loadSkuActivities()
    let skuActSet = new Set();
    let pkgActSet = new Set();
    // Duration of current activity (business days) for auto due-date calc
    let currentActDuration = null;

    // ───────────────────────────  LOAD SKU ACTIVITIES (dynamic)  ───────────────────────────
    async function loadSkuActivities() {
      console.log("[log-edit] loadSkuActivities start");
      const { data, error } = await supabase
        .from("event_type_lkp")
        .select("label, is_packaging, affects_bottled_stock")
        .eq("active", true);

      // All packaging activities (need a packaging_event row)
      const pkgActivities = (data || [])
        .filter((r) => r.is_packaging) // <— NEW
        .map((r) => (r.label || "").trim().toLowerCase())
        .filter(Boolean);

      pkgActSet = new Set(pkgActivities); // <— NEW

      if (error) {
        console.error("loadSkuActivities error:", error);
        skuActivities = [];
        skuActSet = new Set();
        return;
      }

      skuActivities = (data || [])
        .filter((r) => r.affects_bottled_stock == 1)
        .map((r) => (r.label || "").trim().toLowerCase())
        .filter(Boolean);
      skuActSet = new Set(skuActivities);
      console.log("[log-edit] loadSkuActivities done", {
        skuActivitiesCount: skuActivities.length,
        pkgActivitiesCount: pkgActSet.size,
      });
    }

    /* ────────────────────────────────────────────────────────────────────────────
    BASIC MODAL HELPERS
  ──────────────────────────────────────────────────────────────────────────── */
    function showModal(m) {
      m.style.display = "flex";
    }
    function hideModal(m) {
      m.style.display = "none";
    }

    function askConfirm(msg) {
      confirmText.textContent = msg;
      /* show Yes  No buttons */
      confirmYes.style.display = "inline-block";
      confirmNo.style.display = "inline-block";
      showModal(confirmModal);
      return new Promise((res) => {
        confirmYes.onclick = () => {
          hideModal(confirmModal);
          res(true);
        };
        confirmNo.onclick = () => {
          hideModal(confirmModal);
          res(false);
        };
      });
    }

    /* ── NEW: simple OK-only alert ─────────────────────────────────────────── */
    function showAlert(msg) {
      confirmText.textContent = msg;
      confirmYes.style.display = "none";
      confirmNo.style.display = "none";
      showModal(confirmModal);
      return new Promise((res) => {
        const handler = () => {
          hideModal(confirmModal);
          confirmModal.removeEventListener("click", handler);
          res();
        };
        confirmModal.addEventListener("click", handler, { once: true });
      });
    }

    // === FG transfer visibility helpers ===
    function shouldShowTransferSectionForEdit(statusValue, activityValue) {
      const stat = String(statusValue || "").trim();
      const act = String(activityValue || "")
        .trim()
        .toLowerCase();
      return (
        act === "transfer to fg store" && (stat === "Doing" || stat === "Done")
      );
    }

    function setTransferSectionVisibleForEdit(visible) {
      editTransSection.style.display = visible ? "block" : "none";
    }

    /* ── NEW: show/hide Juice & Putam sections on “Doing” ─────────────────── */

    function recalcDueDate() {
      if (currentActDuration == null || !e_start.value) {
        return; // keep whatever is in e_due
      }
      const start = parseDMY(e_start.value);
      const due = addBusinessDays(start, Number(currentActDuration));
      e_due.value = formatDMY(due);
    }

    /* ────────────────────────────────────────────────────────────────────────────
    UTILITY HELPERS  (insert *above* loadFull)
  ──────────────────────────────────────────────────────────────────────────── */

    /** Populate a <select> with rows you pass in */
    function populate(selectEl, rows, valueKey, textKey, placeholder) {
      // start with the placeholder option
      let html = `<option value="">${placeholder}</option>`;
      // then append one option per row
      (rows || []).forEach((r) => {
        html += `<option value="${r[valueKey]}">${r[textKey]}</option>`;
      });
      selectEl.innerHTML = html;
    }

    /** Remove any packaging_events + event_skus linked to a work-log row */
    async function clearPackaging(workLogId) {
      const { data: evts } = await supabase
        .from("packaging_events")
        .select("id")
        .eq("work_log_id", workLogId);

      const ids = (evts || []).map((e) => e.id);
      if (!ids.length) return;

      await supabase.from("event_skus").delete().in("packaging_event_id", ids);

      await supabase.from("packaging_events").delete().in("id", ids);
    }

    // helper to detect unique-constraint failures
    const isDuplicateError = (err) =>
      err.code === "23505" ||
      /duplicate key/i.test(err.message || "") ||
      /violates unique constraint/i.test(err.message || "");

    // helper to detect our ledger negative‑stock trigger message
    const isFgNegError = (err) =>
      /would make stock negative/i.test(err?.message || "");

    // === NEW HELPER: render a SKU-style tbody (3-column: Pack Size / UOM / Count) ===
    function renderSkuTable(tbody, rows) {
      tbody.innerHTML = "";
      rows.forEach((r) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
        <td>${r.pack_size}</td>
        <td>${r.uom}</td>
        <td>
          <input
            type="number"
            min="0"
            data-sku-id="${r.sku_id}"
            data-pack-size="${r.pack_size}"
            data-uom="${r.uom}"
            value="${r.count || ""}"
          />
        </td>
      `;
        tbody.append(tr);
      });
    }

    // === NEW HELPER: stock-aware renderer (4-column: Pack Size / UOM / On-Hand / Transfer Qty) ===
    /* eslint-disable-next-line no-unused-vars */
    function renderStockAwareSkuTable(tbody, rows) {
      tbody.innerHTML = "";
      rows.forEach((r) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
        <td>${r.pack_size}</td>
        <td>${r.uom}</td>
        <td>${r.on_hand ?? ""}</td>
        <td>
          <input
            type="number"
            min="0"
            max="${r.on_hand ?? ""}"
            data-sku-id="${r.sku_id}"
            data-pack-size="${r.pack_size}"
            data-uom="${r.uom}"
            value="${r.count || ""}"
          />
        </td>
      `;
        tbody.append(tr);
      });
    }

    /* === NEW: shared RPC payload builder for rpc_update_daily_work_log_with_packaging === */
    function buildWorkLogRpcPayload({
      id,
      status,
      actLower,
      r = null,
      updDone = null,
    }) {
      // base numeric conversions
      const sectionId = e_section?.value ? Number(e_section.value) : null;
      const subsectionId = e_sub?.value ? Number(e_sub.value) : null;
      const areaId = e_area?.value ? Number(e_area.value) : null;
      const plantId = e_plant?.value ? Number(e_plant.value) : null;

      // activity-specific fields
      const isJuice = /juice|grinding|kashayam/.test(actLower);
      const isPutam = /putam|gaja putam|seelamann/.test(actLower);

      const juice_or_decoction = isJuice ? e_juice.value || null : null;
      const specify = isJuice ? e_specify.value || null : null;

      const count_of_saravam = isPutam
        ? e_count.value
          ? Number(e_count.value)
          : null
        : null;
      const fuel = isPutam ? e_fuel.value || null : null;
      const fuel_under = isPutam ? e_fuel_under.value || null : null;
      const fuel_over = isPutam ? e_fuel_over.value || null : null;

      // always include rm_juice fields
      const rm_juice_qty = e_rmJuiceQty.value
        ? Number(e_rmJuiceQty.value)
        : null;
      const rm_juice_uom = e_rmJuiceUom.value || null;

      // common keys that must always be present
      const payload = {
        p_id: id,
        p_log_date: editRow?.log_date || null,
        p_section_id: sectionId,
        p_subsection_id: subsectionId,
        p_area_id: areaId,
        p_plant_id: plantId,
        p_item: e_item.value || null,
        p_batch_number: e_bn.value || null,
        p_batch_size: e_size.value ? Number(e_size.value) : null,
        p_batch_uom: e_uom.value || null,
        p_activity: e_activity.value || null,

        // packaging-specific keys (always present)
        p_juice_or_decoction: juice_or_decoction,
        p_specify: specify,
        p_count_of_saravam: count_of_saravam,
        p_fuel: fuel,
        p_fuel_under: fuel_under,
        p_fuel_over: fuel_over,

        p_started_on: toISO(e_start.value) || null,
        p_due_date: toISO(e_due.value) || null,
        p_status: status,

        // fields that vary by status (default to null)
        p_completed_on: null,
        p_qty_after_process: null,
        p_qty_uom: null,
        p_remarks: null,
        p_lab_ref_number: null,
        p_sku_breakdown: null,
        p_storage_qty: null,
        p_storage_qty_uom: null,

        p_rm_juice_qty: rm_juice_qty,
        p_rm_juice_uom: rm_juice_uom,
      };

      // status-specific adjustments
      if (status === "Doing" || status === "On Hold") {
        // keep defaults (cleared Done/storage-only fields)
        payload.p_status = status;
        payload.p_completed_on = null;
      }

      if (status === "In Storage") {
        payload.p_storage_qty = e_storageQty.value
          ? Number(e_storageQty.value)
          : null;
        payload.p_storage_qty_uom = e_storageUom.value || null;
        payload.p_completed_on = null;
      }

      if (status === "Done") {
        // apply values from r/updDone (caller prepares them)
        if (r && r.completedOn)
          payload.p_completed_on = toISO(r.completedOn) || null;
        if (updDone) {
          payload.p_qty_after_process = updDone.qty_after_process ?? null;
          payload.p_qty_uom = updDone.qty_uom ?? null;
          payload.p_lab_ref_number = updDone.lab_ref_number ?? null;
          payload.p_sku_breakdown = updDone.sku_breakdown ?? null;
          payload.p_storage_qty = updDone.storage_qty ?? null;
          payload.p_storage_qty_uom = updDone.storage_qty_uom ?? null;
        }
        // remarks (Done branch uses e_remarks)
        payload.p_remarks = e_remarks.value || null;
      }

      return payload;
    }

    /* === NEW: small RPC wrapper to call the Supabase RPC consistently === */
    async function saveWorkLogViaRpc(payload) {
      // caller will handle errors; return object for consistency
      try {
        const res = await supabase.rpc(
          "rpc_update_daily_work_log_with_packaging",
          payload,
        );
        return res; // { data, error }
      } catch (err) {
        return { data: null, error: err };
      }
    }

    /* ── Refresh the Activity <select> so it ALWAYS matches current filters ── */
    async function refreshActivityFilter() {
      // Build the same query the main table will use, but select only activity
      let q = supabase.from("daily_work_log").select("activity");

      // Apply all *up-stream* filters (leave out status & activity themselves)
      if (fLogDate.value) q = q.eq("log_date", toISO(fLogDate.value));
      if (fSection.value) q = q.eq("section_id", fSection.value);
      if (fSub.value) q = q.eq("subsection_id", fSub.value);
      if (fArea.value) q = q.eq("area_id", fArea.value);
      if (fItem.value) q = q.eq("item", fItem.value);
      if (fBN.value) q = q.eq("batch_number", fBN.value);

      const { data, error } = await q;
      if (error) {
        console.error("refreshActivityFilter:", error);
        return;
      }

      const uniqueActs = [
        ...new Set(
          (data || []).map((r) => (r.activity || "").trim()).filter(Boolean),
        ),
      ]
        .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }))
        .map((a) => ({ activity: a }));

      // DEBUG – watch what the filter *thinks* is available
      console.log(
        "Activity filter rebuilt →",
        uniqueActs.length,
        "options:",
        uniqueActs,
      );

      populate(fActivity, uniqueActs, "activity", "activity", "Activity");
      fActivity.disabled = !uniqueActs.length;
    }

    // ───────── Activity: Tom Select (context-aware) ─────────
    let activityTS = null;

    // Fetch activities for current upstream filters (+ optional search text)
    async function fetchActivitiesForFilters(queryText = "") {
      let q = supabase
        .from("daily_work_log")
        .select("activity", { distinct: true });

      // Apply the same upstream filters used by the table (except status/activity)
      if (fLogDate.value) q = q.eq("log_date", toISO(fLogDate.value));
      if (fSection.value) q = q.eq("section_id", fSection.value);
      if (fSub.value) q = q.eq("subsection_id", fSub.value);
      if (fArea.value) q = q.eq("area_id", fArea.value);
      if (fItem.value) q = q.eq("item", fItem.value);
      if (fBN.value) q = q.eq("batch_number", fBN.value);

      if (queryText) q = q.ilike("activity", `%${queryText}%`);

      const { data, error } = await q.order("activity").limit(300);
      if (error) return [];
      return [
        ...new Set(
          (data || []).map((r) => (r.activity || "").trim()).filter(Boolean),
        ),
      ].map((a) => ({ activity: a }));
    }

    async function initActivityTS() {
      if (activityTS) activityTS.destroy(); // safety if re-run

      activityTS = new TomSelect("#fActivity", {
        valueField: "activity",
        labelField: "activity",
        searchField: ["activity"],
        maxItems: 1,
        maxOptions: 100,
        preload: true, // load once on init
        loadThrottle: 450,
        shouldLoad: () => true,
        render: {
          option: (row) => `<div>${row.activity}</div>`,
          item: (row) => `<div>${row.activity}</div>`,
        },
        load: async (query, cb) => {
          try {
            cb(await fetchActivitiesForFilters(query));
          } catch {
            cb();
          }
        },
      });

      // keep your old behavior: changing Activity reloads the table
      activityTS.on("change", () => {
        fActivity.value = activityTS.getValue() || "";
        resetPaging();
        loadFull();
      });

      window.activityTS = activityTS; // for console debugging

      // Open with keyboard (but not on Tab focus)
      activityTS.on("keydown", (e) => {
        if (e.key === "ArrowDown" || e.key === "Enter") activityTS.open();
      });
    }

    async function reloadActivityTS() {
      if (!activityTS) return;
      const rows = await fetchActivitiesForFilters("");
      activityTS.clear(true);
      activityTS.clearOptions();
      activityTS.addOptions(rows);
      activityTS.refreshOptions(false);
      // enable/disable input depending on availability (optional)
      activityTS.control_input.disabled = rows.length === 0;
    }

    // ────────────────────────────────────────────────────────────────────────────
    // LOAD & RENDER FULL EDIT TABLE  (with smart paging)
    // ────────────────────────────────────────────────────────────────────────────
    async function loadFull() {
      if (!fullBody) {
        console.error("[log-edit] Missing #fullBody; cannot render table");
        return;
      }
      fullBody.innerHTML = "";

      // 0) Figure out mode + page size
      const filtered = anyFilterActive();
      console.log("[log-edit] loadFull start", {
        filtered,
        offset: pager.offset,
      });
      const pageSize = filtered ? pager.sizeFiltered : pager.sizeUnfiltered;

      /* 0A) If “Residual bulk only” is ticked, fetch the ID list (once per load) */
      let residualMap = null; // work_log_id ➜ balance_base
      let restrictIds = null; // array of IDs, used in .in('id', …)

      if (fResidual.checked) {
        const { data: rows, error } = await supabase
          .from("v_fg_storage_residuals")
          .select("work_log_id, balance_base");

        if (error) {
          console.error("v_fg_storage_residuals:", error);
        } else {
          residualMap = Object.fromEntries(
            (rows || []).map((r) => [r.work_log_id, r.balance_base]),
          );
          restrictIds = (rows || []).map((r) => r.work_log_id);
          if (!rows?.length) {
            // Nothing matches — clear pager UI and bail
            updatePagerUI(filtered, 0);
            return;
          }
        }
      }

      // 1) Build base query
      //    NOTE: do ORDER at DB level so we can use range/limit (avoid fetching all)
      let q = supabase
        .from("daily_work_log")
        .select(
          `
      id,
      log_date,
      created_at,
      item,
      batch_number,
      batch_size,
      batch_uom,
      section_id,
      plant_id,
      plant_machinery(plant_name),
      activity,
      status
    `,
          { count: "exact" },
        ) // we’ll show “X–Y of Z”
        .order("log_date", { ascending: false })
        .order("created_at", { ascending: false });

      // 2) Restrict by residual IDs (if that filter is on)
      if (restrictIds) q = q.in("id", restrictIds);

      // 3) Apply filters
      if (fLogDate.value) q = q.eq("log_date", toISO(fLogDate.value));
      if (fSection.value) q = q.eq("section_id", fSection.value);
      if (fSub.value) q = q.eq("subsection_id", fSub.value);
      if (fArea.value) q = q.eq("area_id", fArea.value);
      if (fItem.value) q = q.eq("item", fItem.value);
      if (fBN.value) q = q.eq("batch_number", fBN.value);
      if (fActivity.value) q = q.eq("activity", fActivity.value);
      if (fStatus.value) q = q.eq("status", fStatus.value);

      // 4) LIMIT/OFFSET for pagination
      const from = pager.offset;
      const to = pager.offset + pageSize - 1;
      q = q.range(from, to);

      // 5) Fetch
      const { data, error, count } = await q;
      console.log("[log-edit] loadFull query result", {
        rowCount: (data || []).length,
        total: count,
        error: error || null,
      });
      if (error) {
        console.error("loadFull error:", error);
        updatePagerUI(filtered, 0);
        return;
      }
      pager.total = count ?? null;

      const rows = data || [];

      // 6) Render
      // hide / show the Residual column header immediately
      const showResidual = fResidual.checked;
      document.getElementById("thResidual").style.display = showResidual
        ? ""
        : "none";

      rows.forEach((r) => {
        const tr = document.createElement("tr");

        // enable only when FG bulk storage + In Storage
        const zeroDoneDisabled = !(
          r.activity === "FG bulk storage" && r.status === "In Storage"
        );
        const zeroDoneClass = zeroDoneDisabled ? "zeroBtn disabled" : "zeroBtn";
        const zeroDoneAria = zeroDoneDisabled ? "true" : "false";

        tr.innerHTML = `
    <td>${new Date(r.log_date).toLocaleDateString("en-GB")}</td>
    <td>${r.item}</td>
    <td>${r.batch_number}</td>
    <td>${r.batch_size ?? ""}</td>
    <td>${r.batch_uom ?? ""}</td>
    <td>${sectionMap[r.section_id] || ""}</td>
    <td>${r.plant_machinery?.plant_name || ""}</td>
    <td>${r.activity}</td>
    <td>${r.status}</td>
    ${
      showResidual
        ? `<td>${
            residualMap && residualMap[r.id] != null
              ? Number(residualMap[r.id]).toFixed(3)
              : ""
          }</td>`
        : ""
    }
    <td class="actions-cell">
      <div class="dropdown">
        <button class="dropdown-toggle" aria-haspopup="true" aria-expanded="false">⋮</button>
        <ul class="dropdown-menu" role="menu">
          <li role="menuitem"><a href="#" class="editBtn"   data-id="${
            r.id
          }">Edit</a></li>
          <li role="menuitem"><a href="#" class="deleteBtn" data-id="${
            r.id
          }">Delete</a></li>
          <li role="menuitem">
            <a href="#"
               class="${zeroDoneClass}"
               aria-disabled="${zeroDoneAria}"
               data-id="${r.id}"
               data-act="${r.activity}"
               data-status="${r.status}">Zero&nbsp;&amp;&nbsp;Done</a>
          </li>
        </ul>
      </div>
    </td>`;

        fullBody.append(tr);
      });

      // 7) Wire row actions (unchanged)
      document.querySelectorAll(".editBtn").forEach((btn) => {
        btn.onclick = (e) => {
          e.preventDefault();
          openEditModal(btn.dataset.id);
        };
      });
      document.querySelectorAll(".deleteBtn").forEach((btn) => {
        btn.onclick = async (e) => {
          e.preventDefault();
          if (await askConfirm("Delete this entry?")) {
            await clearPackaging(btn.dataset.id);
            await supabase
              .from("daily_work_log")
              .delete()
              .eq("id", btn.dataset.id);
            resetPaging(); // restart from top after delete
            loadFull();
          }
        };
      });

      console.log("[log-edit] loadFull render complete");
      document.querySelectorAll(".zeroBtn").forEach((btn) => {
        btn.addEventListener("click", async (e) => {
          e.preventDefault();

          // 1) If the item is rendered disabled, do nothing
          if (
            btn.classList.contains("disabled") ||
            btn.getAttribute("aria-disabled") === "true"
          ) {
            return;
          }

          // 2) Prevent double-clicks
          if (btn.dataset.busy === "1") return;
          btn.dataset.busy = "1";

          try {
            const act = (btn.dataset.act || "").trim().toLowerCase();
            const status = (btn.dataset.status || "").trim().toLowerCase();

            // Only allow when FG bulk storage + In Storage
            if (!(act === "fg bulk storage" && status === "in storage")) {
              await showAlert(
                "This action is only for FG Bulk Storage rows that are In Storage.",
              );
              return;
            }

            if (!(await askConfirm("Zero the residual stock and mark Done?")))
              return;

            const { error } = await supabase.rpc("fn_fg_force_close", {
              p_work_log_id: Number(btn.dataset.id),
            });

            if (error) {
              await showAlert(
                `Database refused: ${
                  error.message || error.details || "Unknown error"
                }`,
              );
              return;
            }

            await showAlert("Batch closed and residual stock adjusted to 0.");
            resetPaging();
            loadFull();
          } finally {
            // always clear busy flag
            delete btn.dataset.busy;
          }
        });
      });

      // --- CLICK-TOGGLE FOR ACTIONS MENU (safer than hover-only) ---
      function closeAllDropdowns(except) {
        document
          .querySelectorAll(".actions-cell .dropdown.open")
          .forEach((dd) => {
            if (dd !== except) {
              dd.classList.remove("open");
              const btn = dd.querySelector(".dropdown-toggle");
              if (btn) btn.setAttribute("aria-expanded", "false");
            }
          });
      }

      // open/close on click
      document
        .querySelectorAll("#panelFull .dropdown-toggle")
        .forEach((btn) => {
          const wrap = btn.closest(".dropdown");
          // make it accessible
          btn.setAttribute("aria-haspopup", "true");
          btn.setAttribute("aria-expanded", "false");

          btn.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            const willOpen = !wrap.classList.contains("open");
            closeAllDropdowns(); // close others
            if (willOpen) {
              wrap.classList.add("open");
              btn.setAttribute("aria-expanded", "true");
            } else {
              wrap.classList.remove("open");
              btn.setAttribute("aria-expanded", "false");
            }
          });
        });

      // close when clicking anywhere else
      document.addEventListener("click", () => closeAllDropdowns());

      // close on Escape
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") closeAllDropdowns();
      });

      // 8) Show/hide pager + update counts
      updatePagerUI(filtered, rows.length);
    }

    // ────────────────────────────────────────────────────────────────────────────
    // INITIALIZE FILTERS & FIRST LOAD
    // ────────────────────────────────────────────────────────────────────────────
    async function initFull() {
      console.log("[log-edit] initFull start");
      // ───────── Element references ────────────────────────────────────────────
      const toggleAdvancedFull = document.getElementById("toggleAdvancedFull");
      const advancedFiltersFull = document.getElementById(
        "advancedFiltersFull",
      );

      // Pager button (guarded)
      const loadMoreBtn = document.getElementById("loadMore");
      if (loadMoreBtn) {
        loadMoreBtn.addEventListener("click", () => {
          pager.offset += anyFilterActive()
            ? pager.sizeFiltered
            : pager.sizeUnfiltered;
          loadFull();
        });
      } else {
        // Optional: helpful when this module is reused on pages without the pager
        console.warn("[initFull] #loadMore not found; pager will stay hidden.");
      }

      // ───────── 1) Populate Sections & fill sectionMap ───────────────────────
      {
        const { data: secs, error } = await supabase
          .from("sections")
          .select("id,section_name")
          .order("section_name");
        if (!error && secs) {
          secs.forEach((s) => (sectionMap[s.id] = s.section_name));
          populate(fSection, secs, "id", "section_name", "Section");
        }
      }
      // disable dependent filters
      [fSub, fArea, fBN].forEach((x) => (x.disabled = true));

      // Status is a static list, just hook its onchange
      fStatus.onchange = () => {
        resetPaging();
        loadFull();
      };
      fResidual.onchange = () => {
        resetPaging();
        loadFull();
      };

      // ───────── 3) Items: Tom Select (remote search, de-duped, with cache) ─────────
      // Simple capped cache (approx LRU by re-insert)
      const itemQueryCache = new Map();
      const ITEM_CACHE_MAX = 30;
      let itemLoadInFlight = null;

      function cacheSet(key, value) {
        if (itemQueryCache.has(key)) itemQueryCache.delete(key); // move to end
        itemQueryCache.set(key, value);
        if (itemQueryCache.size > ITEM_CACHE_MAX) {
          const firstKey = itemQueryCache.keys().next().value;
          itemQueryCache.delete(firstKey);
        }
      }

      const itemTS = new TomSelect("#fItem", {
        valueField: "item",
        labelField: "item",
        searchField: ["item"],
        maxItems: 1,
        maxOptions: 100,
        preload: false, // don’t fetch on init
        loadThrottle: 350, // debounce
        shouldLoad: (q) => q.length >= 2, // only after 2+ chars
        render: {
          option: (row) => `<div>${row.item}</div>`,
          item: (row) => `<div>${row.item}</div>`,
          no_results: function () {
            return '<div class="no-results" style="padding:6px 8px;color:#6c757d;">No results</div>';
          },
        },
        load: async (query, cb) => {
          try {
            // 1) Cache hit? return immediately
            if (itemQueryCache.has(query)) {
              cb(itemQueryCache.get(query));
              return;
            }

            // 2) Prevent overlapping requests
            if (itemLoadInFlight) {
              await itemLoadInFlight;
              if (itemQueryCache.has(query)) {
                cb(itemQueryCache.get(query));
                return;
              }
            }

            // 3) Make request and cache results
            itemLoadInFlight = (async () => {
              const { data, error } = await supabase
                .from("bmr_details")
                .select("item")
                .ilike("item", `%${query}%`)
                .order("item")
                .limit(200);

              if (error) {
                cb();
                return;
              }

              const uniq = [...new Set((data || []).map((r) => r.item))].map(
                (item) => ({ item }),
              );
              cacheSet(query, uniq);
              cb(uniq);
            })();

            await itemLoadInFlight;
            itemLoadInFlight = null;
          } catch {
            itemLoadInFlight = null;
            cb();
          }
        },
      });

      window.itemTS = itemTS; // for console debugging

      // status helpers
      function setItemStatus(msg) {
        itemTS.wrapper.setAttribute("data-status", msg || "");
      }
      function clearItemStatus() {
        itemTS.wrapper.removeAttribute("data-status");
      }

      // update live
      itemTS.on("type", (q) => {
        if (!q || q.length < 2) setItemStatus("Type 2+ letters to search…");
        else setItemStatus("Searching…");
      });

      itemTS.on("load", (results) => {
        if (!itemTS.lastValue || itemTS.lastValue.length < 2) return;
        if (!results || results.length === 0) setItemStatus("No results");
        else
          setItemStatus(
            `${results.length} result${results.length > 1 ? "s" : ""}`,
          );
      });

      itemTS.on("dropdown_close", clearItemStatus);
      itemTS.on("change", clearItemStatus);

      // Open with keyboard (but not on Tab focus)
      itemTS.on("keydown", (e) => {
        if (e.key === "ArrowDown" || e.key === "Enter") itemTS.open();
      });

      // ───────── 4) Cascading: Section → Sub‑section ──────────────────────────
      fSection.onchange = async () => {
        if (!fSection.value) {
          populate(fSub, [], "", "", "Sub‑section");
          fSub.disabled = true;
        } else {
          const { data: subs } = await supabase
            .from("subsections")
            .select("id,subsection_name")
            .eq("section_id", fSection.value)
            .order("subsection_name");
          populate(fSub, subs, "id", "subsection_name", "Sub‑section");
          fSub.disabled = false;
        }
        populate(fArea, [], "", "", "Area");
        fArea.disabled = true;
        populate(fBN, [], "", "", "BN");
        fBN.disabled = true;
        await reloadActivityTS();
        resetPaging();
        loadFull();
      };

      // ───────── 5) Sub‑section → Area ────────────────────────────────────────
      fSub.onchange = async () => {
        if (!fSub.value) {
          populate(fArea, [], "", "", "Area");
          fArea.disabled = true;
        } else {
          const { data: areas } = await supabase
            .from("areas")
            .select("id,area_name")
            .eq("section_id", fSection.value)
            .eq("subsection_id", fSub.value)
            .order("area_name");
          populate(fArea, areas, "id", "area_name", "Area");
          fArea.disabled = false;
        }
        populate(fBN, [], "", "", "BN");
        fBN.disabled = true;
        await reloadActivityTS();
        resetPaging();
        loadFull();
      };

      // ───────── 6) Area → reset BN ───────────────────────────────────────────
      fArea.onchange = async () => {
        populate(fBN, [], "", "", "BN");
        fBN.disabled = true;
        await reloadActivityTS();
        resetPaging();
        loadFull();
      };

      // ───────── Item (Tom Select) → BN cascade ─────────────────────────────
      itemTS.on("change", async (val) => {
        // keep legacy code paths that read fItem.value
        fItem.value = val || "";

        if (!val) {
          populate(fBN, [], "", "", "BN");
          fBN.disabled = true;
        } else {
          const { data: bns } = await supabase
            .from("bmr_details")
            .select("bn")
            .eq("item", val)
            .order("bn");
          const uniq = [...new Set((bns || []).map((r) => r.bn))].map((bn) => ({
            bn,
          }));
          populate(fBN, uniq, "bn", "bn", "BN");
          fBN.disabled = false;
        }

        await reloadActivityTS();
        resetPaging();
        loadFull();
      });

      // ───────── 7a) BN filter: reload table on change ───────────────────────
      fBN.onchange = () => {
        resetPaging();
        loadFull();
      };

      // ───────── 8) Clear All Filters ─────────────────────────────────────────
      clearFull.onclick = async () => {
        // 1) Reset all values
        fLogDate.value = "";
        fSection.value = "";
        fSub.value = "";
        fArea.value = "";
        fItem.value = "";
        fBN.value = "";
        fActivity.value = "";
        fStatus.value = "";
        fResidual.checked = false;

        // 2) Disable only the cascading selects
        fSub.disabled = true;
        fArea.disabled = true;
        fBN.disabled = true;

        // 3) Collapse the advanced‐filters row
        advancedFiltersFull.style.display = "none";
        toggleAdvancedFull.textContent = "Advanced ▾";

        // 4) Reset Tom Selects (values, options, and the visible text box)
        itemTS.clear(true);
        itemTS.clearOptions();
        itemTS.setTextboxValue("");

        itemQueryCache.clear();

        if (activityTS) {
          activityTS.clear(true);
          activityTS.setTextboxValue("");
        }

        // 5) Rebuild Activity options for the cleared state
        await reloadActivityTS();

        // 6) Reload table
        resetPaging();
        loadFull();
      };

      // ───────── 9) HOME button ────────────────────────────────────────────────
      homeBtn.onclick = () => (location.href = "index.html");

      // ───────── 10) Advanced toggle ──────────────────────────────────────────
      toggleAdvancedFull.addEventListener("click", () => {
        const open = advancedFiltersFull.style.display === "flex";
        advancedFiltersFull.style.display = open ? "none" : "flex";
        toggleAdvancedFull.textContent = open ? "Advanced ▾" : "Advanced ▴";
      });

      // ───────── 10a) Activity as Tom Select ─────────
      await initActivityTS();

      // ───────── 11) First render ───────────────────────────────────────────────
      console.log("[log-edit] initFull before first loadFull");
      await loadFull();
    }

    // Utility: load saved transfer rows (authoritative historical data)
    async function getSavedTransferRowsByWorkLogId(workLogId) {
      console.debug("[FG transfer] work_log_id:", workLogId);
      const { data: pe, error: peErr } = await supabase
        .from("packaging_events")
        .select("id")
        .eq("work_log_id", workLogId)
        .maybeSingle();

      if (peErr) {
        console.error("packaging_events lookup failed:", peErr);
        return [];
      }
      console.debug("[FG transfer] packaging_event_id:", pe?.id);

      if (!pe?.id) return [];

      const { data: eventRows, error: esErr } = await supabase
        .from("event_skus")
        .select("sku_id,count")
        .eq("packaging_event_id", pe.id);

      if (esErr) {
        console.error("event_skus lookup failed:", esErr);
        return [];
      }
      console.debug("[FG transfer] event_skus:", (eventRows || []).length);

      if (!eventRows?.length) return [];

      const skuIds = [
        ...new Set((eventRows || []).map((r) => r.sku_id).filter(Boolean)),
      ];
      if (!skuIds.length) return [];

      const { data: skuMeta, error: psErr } = await supabase
        .from("product_skus")
        .select("id, pack_size, uom")
        .in("id", skuIds);

      if (psErr) {
        console.error("product_skus lookup failed:", psErr);
        return [];
      }
      console.debug(
        "[FG transfer] product_skus resolved:",
        (skuMeta || []).length,
      );

      const skuMetaMap = new Map((skuMeta || []).map((r) => [String(r.id), r]));

      const finalRows = (eventRows || [])
        .map((es) => {
          const meta = skuMetaMap.get(String(es.sku_id));
          if (!meta) return null;
          return {
            pack_size: meta.pack_size,
            uom: meta.uom,
            sku_id: es.sku_id,
            count: es.count || "",
          };
        })
        .filter(Boolean);

      console.debug("[FG transfer] rendered rows:", finalRows.length);
      return finalRows;
    }

    function prefillSkuBreakdownIntoTable(tbodyEl, skuBreakdown) {
      if (!tbodyEl || !skuBreakdown) return;
      skuBreakdown.split(";").forEach((entry) => {
        const parts = entry.trim().split(" ");
        const ps = parts[0];
        const uom = parts[1];
        const cnt = parts[3];

        const inp = tbodyEl.querySelector(
          `input[data-pack-size="${ps}"][data-uom="${uom}"]`,
        );
        if (inp) inp.value = cnt;
      });
    }

    // Module-level helper to load transfer rows for Edit modal (works for any status)
    async function loadTransferRowsForEdit(row) {
      editTransBody.innerHTML = "";

      const savedRows = await getSavedTransferRowsByWorkLogId(row.id);
      if (savedRows.length) {
        renderSkuTable(editTransBody, savedRows);
        console.debug(
          "[FG transfer] edit modal rendered saved rows:",
          savedRows.length,
          {
            work_log_id: row.id,
          },
        );
        console.debug(
          "[FG transfer] editTransSection display:",
          editTransSection.style.display,
        );
        console.debug(
          "[FG transfer] editTransBody child count:",
          editTransBody.children.length,
        );
        console.debug(
          "[FG transfer] editTransBody html:",
          editTransBody.innerHTML,
        );
        return;
      }

      // Legacy fallback: if sku_breakdown exists, attempt to resolve product SKUs
      if (row?.sku_breakdown) {
        const { data: prod, error: prodErr } = await supabase
          .from("products")
          .select("id")
          .eq("item", row.item)
          .maybeSingle();

        if (prodErr)
          console.error(
            "products lookup failed for legacy transfer fallback:",
            prodErr,
          );

        if (prod?.id) {
          const { data: skus, error: skuErr } = await supabase
            .from("product_skus")
            .select("id, pack_size, uom")
            .eq("product_id", prod.id)
            .eq("is_active", true)
            .order("pack_size");

          if (skuErr)
            console.error(
              "product_skus lookup failed for legacy transfer fallback:",
              skuErr,
            );

          const transRows = (skus || []).map((ps) => ({
            pack_size: ps.pack_size,
            uom: ps.uom,
            sku_id: ps.id,
            count: "",
          }));

          renderSkuTable(editTransBody, transRows);
          prefillSkuBreakdownIntoTable(editTransBody, row.sku_breakdown);
          console.debug(
            "[FG transfer] edit modal rendered legacy fallback rows:",
            transRows.length,
            { work_log_id: row.id },
          );
          console.debug(
            "[FG transfer] editTransSection display:",
            editTransSection.style.display,
          );
          console.debug(
            "[FG transfer] editTransBody child count:",
            editTransBody.children.length,
          );
          console.debug(
            "[FG transfer] editTransBody html:",
            editTransBody.innerHTML,
          );
          return;
        }
      }

      console.warn("No transfer rows found for work_log_id:", row.id);
    }

    // ────────────────────────────────────────────────────────────────────────────
    // “DONE?” MODAL CONFIGURATION (unchanged)
    // ────────────────────────────────────────────────────────────────────────────
    async function configureDoneModal(activity, item, batch, id) {
      const act = activity.trim().toLowerCase();
      doneQtySection.style.display =
        doneLabRefSection.style.display =
        doneSkuSection.style.display =
        doneTransSection.style.display =
          "none";
      doneSkuBody.innerHTML = "";
      doneTransBody.innerHTML = "";

      // Load existing legacy sku_breakdown (if any) so we can fall back when
      // there are no event_skus stored (older records).
      const { data: rec } = await supabase
        .from("daily_work_log")
        .select("sku_breakdown")
        .eq("id", id)
        .maybeSingle();

      if (act === "finished goods quality assessment") {
        doneLabRefSection.style.display = "flex";
      } else if (skuActSet.has(act)) {
        doneSkuSection.style.display = "block";

        // 1) In parallel, load the product record & any existing packaging_event
        const [{ data: prod }, { data: pe }] = await Promise.all([
          supabase.from("products").select("id").eq("item", item).single(),
          supabase
            .from("packaging_events")
            .select("id")
            .eq("work_log_id", id)
            .maybeSingle(), // returns null if no event yet
        ]);

        // 3) If we have a product, grab its active SKUs
        if (prod) {
          const { data: skus } = await supabase
            .from("product_skus")
            .select("id,pack_size,uom")
            .eq("product_id", prod.id)
            .eq("is_active", true)
            .order("pack_size");

          // 3) If there is an existing packaging_event, get its SKUs/counts
          let existing = [];
          if (pe?.id) {
            ({ data: existing } = await supabase
              .from("event_skus")
              .select("sku_id,count")
              .eq("packaging_event_id", pe.id));
          }

          // 4) Render one row per SKU, pre‑filling the previous count if present
          const doneSkuRows = skus.map((sku) => {
            const prev = existing.find((e) => e.sku_id === sku.id);
            return {
              pack_size: sku.pack_size,
              uom: sku.uom,
              sku_id: sku.id,
              count: prev?.count || "",
            };
          });
          renderSkuTable(doneSkuBody, doneSkuRows);

          // 5) If there were no event_skus stored, fall back to legacy sku_breakdown
          if (!existing.length && rec?.sku_breakdown) {
            rec.sku_breakdown.split(";").forEach((entry) => {
              const parts = entry.trim().split(" ");
              const ps = parts[0];
              const uom = parts[1];
              const cnt = parts[3];
              const inp = doneSkuBody.querySelector(
                `input[data-pack-size="${ps}"][data-uom="${uom}"]`,
              );
              if (inp) inp.value = cnt;
            });
          }
        }
      } else if (act === "transfer to fg store") {
        doneTransSection.style.display = "block";

        // Use saved transfer rows (authoritative historical records)
        const savedRows = await getSavedTransferRowsByWorkLogId(id);

        if (savedRows.length) {
          // Render saved rows; on_hand is not part of the historical record
          renderSkuTable(doneTransBody, savedRows);
          console.debug(
            "[FG transfer] done modal rendered saved rows:",
            savedRows.length,
            { work_log_id: id },
          );
          console.debug(
            "[FG transfer] doneTransSection display:",
            doneTransSection.style.display,
          );
          console.debug(
            "[FG transfer] doneTransBody child count:",
            doneTransBody.children.length,
          );
          console.debug(
            "[FG transfer] doneTransBody html:",
            doneTransBody.innerHTML,
          );
        } else if (rec?.sku_breakdown) {
          // Legacy fallback: resolve candidate SKUs from product_skus (not bottled_stock_on_hand)
          const { data: prod, error: prodErr } = await supabase
            .from("products")
            .select("id")
            .eq("item", item)
            .maybeSingle();

          if (prodErr)
            console.error(
              "products lookup failed for done transfer fallback:",
              prodErr,
            );

          if (prod?.id) {
            const { data: skus, error: skuErr } = await supabase
              .from("product_skus")
              .select("id, pack_size, uom")
              .eq("product_id", prod.id)
              .eq("is_active", true)
              .order("pack_size");

            if (skuErr)
              console.error(
                "product_skus lookup failed for done transfer fallback:",
                skuErr,
              );

            const doneTransRows = (skus || []).map((ps) => ({
              pack_size: ps.pack_size,
              uom: ps.uom,
              sku_id: ps.id,
              count: "",
            }));

            renderSkuTable(doneTransBody, doneTransRows);
            prefillSkuBreakdownIntoTable(doneTransBody, rec.sku_breakdown);
            console.debug(
              "[FG transfer] done modal rendered legacy fallback rows:",
              doneTransRows.length,
              { work_log_id: id },
            );
            console.debug(
              "[FG transfer] doneTransSection display:",
              doneTransSection.style.display,
            );
            console.debug(
              "[FG transfer] doneTransBody child count:",
              doneTransBody.children.length,
            );
            console.debug(
              "[FG transfer] doneTransBody html:",
              doneTransBody.innerHTML,
            );
          } else {
            console.warn(
              "No saved transfer rows or product SKUs found for done modal work_log_id:",
              id,
            );
          }
        } else {
          console.warn(
            "No saved transfer rows found for done modal work_log_id:",
            id,
          );
        }
      } else {
        doneQtySection.style.display = "flex";
        doneForm.qty_after_process_uom.value = "";
      }
    }

    /* eslint-disable-next-line no-unused-vars */
    async function promptDone(activity, item, batch, id) {
      doneForm.reset();
      doneCompletedOn.value = formatDMY(new Date());
      doneSkuBody.innerHTML = "";
      doneTransBody.innerHTML = "";
      await configureDoneModal(activity, item, batch, id);
      showModal(doneModal);
      return new Promise((resolve) => {
        doneCancel.onclick = () => {
          hideModal(doneModal);
          resolve({ choice: "cancel" });
        };
        const finish = (choice) => {
          const act = activity.trim().toLowerCase();
          let rows = [],
            qty = null,
            uom = null,
            labRef = null;
          if (act === "finished goods quality assessment") {
            labRef = doneForm.lab_ref_number.value.trim();
          } else if (skuActSet.has(act)) {
            rows = Array.from(doneSkuBody.querySelectorAll("input"))
              .map((i) => ({
                skuId: i.dataset.skuId,
                count: i.value,
                packSize: i.dataset.packSize,
                uom: i.dataset.uom,
              }))
              .filter((r) => r.count > 0);
          } else if (act === "transfer to fg store") {
            rows = Array.from(doneTransBody.querySelectorAll("input"))
              .map((i) => ({
                skuId: i.dataset.skuId,
                count: i.value,
                packSize: i.dataset.packSize,
                uom: i.dataset.uom,
              }))
              .filter((r) => r.count > 0);
          } else {
            qty = doneForm.qty_after_process.value || null;
            uom = doneForm.qty_after_process_uom.value.trim() || null;
          }
          hideModal(doneModal);
          resolve({
            choice,
            rows,
            completedOn: doneCompletedOn.value,
            qty,
            uom,
            labRef,
          });
        };
        doneJust.onclick = () => finish("just");
        doneNew.onclick = () => finish("new");
      });
    }

    // ────────────────────────────────────────────────────────────────────────────
    // OPEN & POPULATE EDIT MODAL
    // ────────────────────────────────────────────────────────────────────────────
    async function openEditModal(id) {
      // 2) Local refs inside the modal (assign to module-scope vars)
      e_section = editModal.querySelector("#e_section");
      e_sub = editModal.querySelector("#e_sub");
      e_area = editModal.querySelector("#e_area");
      e_plant = editModal.querySelector("#e_plant");
      e_item = editModal.querySelector("#e_item");
      e_bn = editModal.querySelector("#e_bn");
      e_remarks = editModal.querySelector("#e_remarks");

      editSkuBody.innerHTML = "";
      editTransBody.innerHTML = "";

      if (!e_section || !e_bn) {
        console.error("Missing edit‑modal elements:", { e_section, e_bn });
        hideModal(editModal);
        return;
      }

      // 3) Fetch the row
      const { data: row, error } = await supabase
        .from("daily_work_log")
        .select("*")
        .eq("id", id)
        .single();
      if (error || !row) {
        console.error(error);
        hideModal(editModal);
        return;
      }
      // keep reference for submit handler (so we can send original log_date etc.)
      editRow = row;

      // Look up duration_days; fall back to existing due-start diff if needed
      currentActDuration = null;
      try {
        const { data: actRow } = await supabase
          .from("activities") // <== adjust table/column names to yours
          .select("duration_days")
          .eq("activity_name", row.activity)
          .maybeSingle();

        if (actRow?.duration_days != null) {
          currentActDuration = Number(actRow.duration_days);
        } else if (row.started_on && row.due_date) {
          // fallback: compute diff in business days between stored start & due
          const s = new Date(row.started_on);
          const d = new Date(row.due_date);
          let diff = 0;
          const day = new Date(s);
          while (day < d) {
            day.setDate(day.getDate() + 1);
            if (day.getDay() !== 0) diff++;
          }
          currentActDuration = diff || null;
        }
      } catch (e) {
        console.error("duration lookup failed:", e);
      }

      // 4) Basic fields
      e_id.value = row.id;
      e_item.value = row.item || "";
      e_size.value = row.batch_size || "";
      e_uom.value = row.batch_uom || "";
      e_bn.disabled = true;

      // 5) Section → Sub → Area → Plant cascades
      const { data: secs } = await supabase
        .from("sections")
        .select("id,section_name")
        .order("section_name");
      populate(e_section, secs || [], "id", "section_name", "Select Section");
      e_section.value = row.section_id || "";

      async function loadSubs(sectionId, pre = null) {
        if (!sectionId) {
          populate(e_sub, [], "", "", "Select Sub‑section");
          e_sub.disabled = true;
          return;
        }
        const { data } = await supabase
          .from("subsections")
          .select("id,subsection_name")
          .eq("section_id", sectionId)
          .order("subsection_name");
        populate(
          e_sub,
          data || [],
          "id",
          "subsection_name",
          "Select Sub‑section",
        );
        e_sub.disabled = false;
        if (pre) e_sub.value = pre;
      }

      async function loadAreas(sectionId, subId, pre = null) {
        if (!sectionId || !subId) {
          populate(e_area, [], "", "", "Select Area");
          e_area.disabled = true;
          return;
        }
        const { data } = await supabase
          .from("areas")
          .select("id,area_name")
          .eq("section_id", sectionId)
          .eq("subsection_id", subId)
          .order("area_name");
        populate(e_area, data || [], "id", "area_name", "Select Area");
        e_area.disabled = false;
        if (pre) e_area.value = pre;
      }

      async function loadPlants(areaId, pre = null) {
        if (!areaId) {
          populate(e_plant, [], "", "", "Select Plant");
          e_plant.disabled = true;
          return;
        }
        const { data } = await supabase
          .from("plant_machinery")
          .select("id,plant_name")
          .eq("area_id", areaId)
          .eq("status", "O")
          .order("plant_name");
        populate(e_plant, data || [], "id", "plant_name", "Select Plant");
        e_plant.disabled = false;
        if (pre) e_plant.value = pre;
      }

      await loadSubs(row.section_id, row.subsection_id);
      await loadAreas(row.section_id, row.subsection_id, row.area_id);
      await loadPlants(row.area_id, row.plant_id);

      e_section.onchange = () => {
        loadSubs(e_section.value).then(() => {
          loadAreas(e_section.value, e_sub.value);
          loadPlants(null);
        });
      };
      e_sub.onchange = () => {
        loadAreas(e_section.value, e_sub.value);
        loadPlants(null);
      };
      e_area.onchange = () => loadPlants(e_area.value);

      // 6) Item → BN
      const allItems =
        (
          await supabase
            .from("bmr_details")
            .select("item", { distinct: true })
            .order("item")
        ).data || [];
      populate(e_item, allItems, "item", "item", "Select Item");
      // Ensure the current row.item appears in the select even if it's
      // no longer present in `bmr_details` (historical items).
      const desiredItem = row.item ? String(row.item).trim() : "";
      if (desiredItem) {
        const exists = Array.from(e_item.options).some(
          (o) => String(o.value).trim() === desiredItem,
        );
        if (!exists) {
          const opt = document.createElement("option");
          opt.value = desiredItem;
          opt.textContent = desiredItem;
          e_item.appendChild(opt);
        }
      }
      e_item.value = row.item;

      async function loadBNs(item, pre = null) {
        if (!item) {
          populate(e_bn, [], "", "", "Select Batch Number");
          e_bn.disabled = true;
          return;
        }
        const bns =
          (
            await supabase
              .from("bmr_details")
              .select("bn")
              .eq("item", item)
              .order("bn")
          ).data || [];
        const uniq = [...new Set(bns.map((r) => r.bn))].map((bn) => ({ bn }));
        populate(e_bn, uniq, "bn", "bn", "Select Batch Number");
        e_bn.disabled = false;
        if (pre) e_bn.value = pre;
      }
      await loadBNs(row.item, row.batch_number);
      e_item.onchange = () => loadBNs(e_item.value);

      await refreshActivityFilter();

      // 7) Activity (display only)
      e_activity.innerHTML = `<option>${row.activity}</option>`;
      e_activity.value = row.activity;

      // 8) Misc fields
      e_juice.value = row.juice_or_decoction || "";
      e_specify.value = row.specify || "";
      e_rmJuiceQty.value = row.rm_juice_qty ?? "";
      e_rmJuiceUom.value = row.rm_juice_uom || "";
      e_count.value = row.count_of_saravam ?? "";
      e_fuel.value = row.fuel || "";
      e_fuel_under.value = row.fuel_under || "";
      e_fuel_over.value = row.fuel_over || "";
      e_storageQty.value = row.storage_qty ?? "";
      e_storageUom.value = row.storage_qty_uom || "";

      e_start.value = row.started_on ? formatDMY(new Date(row.started_on)) : "";
      e_due.value = row.due_date ? formatDMY(new Date(row.due_date)) : "";
      e_comp.value = row.completed_on
        ? formatDMY(new Date(row.completed_on))
        : "";
      e_status.value = row.status || "";

      // Recalc due when start changes — attach listeners only once
      if (!e_start.dataset.recalcBound) {
        e_start.addEventListener("change", recalcDueDate);
        e_start.addEventListener("blur", recalcDueDate);
        e_start.addEventListener("input", recalcDueDate);
        if (e_start._flatpickr && !e_start._flatpickr._recalcBound) {
          e_start._flatpickr.config.onChange.push(recalcDueDate);
          e_start._flatpickr._recalcBound = true;
        }
        e_start.dataset.recalcBound = "1";
      }
      // run once now (after duration is known)
      recalcDueDate();

      // 9) Restrict status options if storage activity
      const isStorageAct = /^(fg bulk storage|intermediate storage)$/i.test(
        row.activity.trim(),
      );
      Array.from(e_status.options).forEach((opt) => {
        opt.disabled = isStorageAct
          ? !(opt.value === "In Storage" || opt.value === "Done")
          : opt.value === "In Storage";
      });

      // 10) Toggle helper
      function reToggleOptionalPanels() {
        const currentStat = String(e_status.value || "").trim();
        const currentActLower = String(e_activity.value || "")
          .trim()
          .toLowerCase();

        const isPkgDone = pkgActSet.has(currentActLower);
        const isSkuDone = skuActSet.has(currentActLower);
        const isFGTransfer = currentActLower === "transfer to fg store";
        const isStockTransfer = /stock\s*transfer/i.test(currentActLower);

        // ensure storage fields are reset before applying status-specific requirements
        e_storageQty.required = false;
        e_storageUom.required = false;

        [
          editQtySection,
          labRefSection,
          editSkuSection,
          editTransSection,
          juiceS,
          rmJuiceSection,
          putamS,
          storageSection,
        ].forEach((sec) => {
          sec.style.display = "none";
        });

        if (currentStat === "Doing") {
          e_comp.value = "";
          e_qty.value = "";
          e_qty_uom.value = "";
          e_lab_ref.value = "";

          // Only clear transfer rows if this is not Transfer to FG Store
          if (!isFGTransfer) {
            editTransBody.innerHTML = "";
          }

          if (!(isPkgDone || isSkuDone)) {
            editSkuBody.innerHTML = "";
          }

          const isJuice = /juice|grinding|kashayam/.test(currentActLower);
          const isPutam = /putam|gaja putam|seelamann/.test(currentActLower);

          juiceS.style.display = isJuice ? "flex" : "none";
          rmJuiceSection.style.display = isJuice ? "flex" : "none";
          putamS.style.display = isPutam ? "flex" : "none";

          if (isFGTransfer) {
            setTransferSectionVisibleForEdit(true);
          }

          console.debug("[FG transfer] reToggleOptionalPanels -> Doing", {
            currentStat,
            currentActLower,
            transferVisible: editTransSection.style.display,
            transferRows: editTransBody.children.length,
          });

          return;
        }

        if (currentStat === "In Storage") {
          storageSection.style.display = "flex";
          const req = /fg bulk storage/i.test(currentActLower);
          e_storageQty.required = req;
          e_storageUom.required = req;

          console.debug("[FG transfer] reToggleOptionalPanels -> In Storage", {
            currentStat,
            currentActLower,
            transferVisible: editTransSection.style.display,
            transferRows: editTransBody.children.length,
          });

          return;
        }

        // Done
        if (!e_comp.value) e_comp.value = formatDMY(new Date());

        if (currentActLower === "finished goods quality assessment") {
          labRefSection.style.display = "block";
        } else if (isPkgDone || isSkuDone) {
          editSkuSection.style.display = "block";
        } else if (isFGTransfer) {
          setTransferSectionVisibleForEdit(true);
        } else if (isStockTransfer) {
          storageSection.style.display = "flex";
          e_storageQty.required = true;
          e_storageUom.required = true;
          editQtySection.style.display = "none";
        } else {
          editQtySection.style.display = "flex";
        }

        console.debug("[FG transfer] reToggleOptionalPanels -> Done/other", {
          currentStat,
          currentActLower,
          transferVisible: editTransSection.style.display,
          transferRows: editTransBody.children.length,
        });
      }

      // 11) Prefill existing Done data

      const actLowerInit = row.activity.trim().toLowerCase();
      // Always load transfer rows for edit when activity is transfer to fg store
      if (actLowerInit === "transfer to fg store") {
        await loadTransferRowsForEdit(row);
      }

      if (row.status === "Done") {
        if (actLowerInit === "finished goods quality assessment") {
          labRefSection.style.display = "block";
          e_lab_ref.value = row.lab_ref_number || "";
        } else if (skuActSet.has(actLowerInit)) {
          editSkuSection.style.display = "block";

          const { data: pe } = await supabase
            .from("packaging_events")
            .select("id")
            .eq("work_log_id", row.id)
            .maybeSingle();

          if (pe?.id) {
            const { data: skus } = await supabase
              .from("event_skus")
              .select("sku_id,count")
              .eq("packaging_event_id", pe.id);

            const skuRows = [];
            for (const es of skus || []) {
              const { data: ps } = await supabase
                .from("product_skus")
                .select("pack_size,uom")
                .eq("id", es.sku_id)
                .single();
              if (!ps) continue;
              skuRows.push({
                pack_size: ps.pack_size,
                uom: ps.uom,
                sku_id: es.sku_id,
                count: es.count || "",
              });
            }
            renderSkuTable(editSkuBody, skuRows);
          } else {
            // No packaging_event: render product SKUs and fall back to legacy sku_breakdown
            const { data: prod } = await supabase
              .from("products")
              .select("id")
              .eq("item", row.item)
              .maybeSingle();
            if (prod) {
              const { data: skus } = await supabase
                .from("product_skus")
                .select("id,pack_size,uom")
                .eq("product_id", prod.id)
                .eq("is_active", true)
                .order("pack_size");

              const skuRows = (skus || []).map((ps) => ({
                pack_size: ps.pack_size,
                uom: ps.uom,
                sku_id: ps.id,
                count: "",
              }));
              renderSkuTable(editSkuBody, skuRows);

              // Prefill from legacy sku_breakdown if present
              if (row?.sku_breakdown) {
                row.sku_breakdown.split(";").forEach((entry) => {
                  const parts = entry.trim().split(" ");
                  const ps = parts[0];
                  const uom = parts[1];
                  const cnt = parts[3];
                  const inp = editSkuBody.querySelector(
                    `input[data-pack-size="${ps}"][data-uom="${uom}"]`,
                  );
                  if (inp) inp.value = cnt;
                });
              }
            }
          }
        } else if (actLowerInit === "transfer to fg store") {
          // Transfer → rows were loaded earlier via loadTransferRowsForEdit(row).
          // Do not re-query or manage visibility here; final visibility is
          // enforced after reToggleOptionalPanels() below.
        } else {
          editQtySection.style.display = "flex";
          e_qty.value = row.qty_after_process || "";
          e_qty_uom.value = row.qty_uom || "";
        }
      }

      // ---- LOCK HELPERS ---------------------------------------------------------
      function lock(el) {
        if (!el) return;
        if (el.tagName === "SELECT" || el.tagName === "BUTTON") {
          el.disabled = true;
        } else {
          el.readOnly = true;
          el.tabIndex = -1;
        }
        el.classList.add("locked");
      }

      function lockStaticFields() {
        [
          e_section,
          e_sub,
          e_area,
          e_plant,
          e_item,
          e_bn,
          e_activity,
          e_size,
          e_uom,
        ].forEach(lock);
      }

      // 12) Wire handlers & initial toggle
      e_status.onchange = reToggleOptionalPanels;
      e_activity.onchange = reToggleOptionalPanels;
      reToggleOptionalPanels();

      // Final authoritative transfer visibility enforcement (defensive)
      const statInit = String(row.status || "").trim();
      if (
        shouldShowTransferSectionForEdit(statInit, actLowerInit) &&
        editTransBody.children.length > 0
      ) {
        setTransferSectionVisibleForEdit(true);
      }

      console.debug("[FG transfer] final pre-show edit state", {
        actLowerInit,
        statInit,
        transferVisible: editTransSection.style.display,
        transferRows: editTransBody.children.length,
        transferHtml: editTransBody.innerHTML,
      });

      // lock the uneditable fields once everything is ready
      lockStaticFields();

      // reveal modal only after fields are populated & locked
      showModal(editModal);
    }

    // ────────────────────────────────────────────────────────────────────────────
    // HANDLE EDIT FORM SUBMIT (ISO dates  duplicate guard)
    // ────────────────────────────────────────────────────────────────────────────
    editForm.onsubmit = async (ev) => {
      ev.preventDefault();

      // 0) Clear any previous validation messages
      editForm
        .querySelectorAll("input, select, textarea")
        .forEach((el) => el.setCustomValidity(""));

      // 1) Let HTML5 handle all the required‐field checks:
      //    this will focus the first empty required field and show its bubble
      if (!editForm.checkValidity()) {
        editForm.reportValidity();
        return;
      }

      // ── 1) Gather common fields ───────────────────────────────────────────────
      const id = Number(e_id.value);
      const originalAct = e_activity.value.trim();
      const actLower = originalAct.toLowerCase();
      const newStat = e_status.value;
      // helper flags we'll reuse
      const isStockTransfer = /stock\s*transfer/i.test(actLower);
      const isFGTransfer = actLower === "transfer to fg store";

      // Business rule: "transfer to fg store" is a transfer workflow —
      // valid statuses are only "Doing" and "Done". In Storage applies
      // only to storage activities like FG bulk storage / intermediate storage.
      if (isFGTransfer && newStat === "In Storage") {
        await showAlert(
          "Transfer to FG Store does not support In Storage status. Please use Doing or Done.",
        );
        e_status.value = "Doing";
        return;
      }

      // ── 2A) Doing: clear Done/storage fields and save via RPC (server handles packaging)
      if (newStat === "Doing") {
        const payload = buildWorkLogRpcPayload({
          id,
          status: "Doing",
          actLower,
          originalAct,
        });
        const { error } = await saveWorkLogViaRpc(payload, "Doing");
        if (error) {
          console.error("RPC error (Doing):", error);
          await showAlert(`Save failed: ${error.message || "see console"}`);
          return;
        }

        editSuccess.style.display = "block";
        setTimeout(() => {
          editSuccess.style.display = "none";
          hideModal(editModal);
          loadFull();
        }, 1200);

        return;
      }

      // ── 2B) On Hold: clear everything Done‑only via RPC
      if (newStat === "On Hold") {
        const payload = buildWorkLogRpcPayload({
          id,
          status: "On Hold",
          actLower,
          originalAct,
        });
        const { error } = await saveWorkLogViaRpc(payload, "On Hold");
        if (error) {
          console.error("RPC error (On Hold):", error);
          await showAlert(`Save failed: ${error.message || "see console"}`);
          return;
        }

        editSuccess.style.display = "block";
        setTimeout(() => {
          editSuccess.style.display = "none";
          hideModal(editModal);
          loadFull();
        }, 1200);
        return;
      }

      // ── 2C) In Storage: update fields via RPC (server handles packaging)
      if (newStat === "In Storage") {
        const payload = buildWorkLogRpcPayload({
          id,
          status: "In Storage",
          actLower,
          originalAct,
        });
        const { error } = await saveWorkLogViaRpc(payload, "In Storage");
        if (error) {
          console.error("RPC error (In Storage):", error);
          await showAlert(`Save failed: ${error.message || "see console"}`);
          return;
        }

        editSuccess.style.display = "block";
        setTimeout(() => {
          editSuccess.style.display = "none";
          hideModal(editModal);
          loadFull();
        }, 1200);
        return;
      }

      // ── 2D) Done: gather post‐Done values
      const r = {
        choice: "just",
        completedOn: e_comp.value,
        qty: e_qty.value ? Number(e_qty.value) : null,
        uom: e_qty_uom.value ? e_qty_uom.value.trim() : null,
        labRef: e_lab_ref.value ? e_lab_ref.value.trim() : null,
        rows: [],
      };
      // derive shared booleans so save logic matches UI decisions
      const isPkgDone = pkgActSet.has(actLower);
      const isSkuDone = skuActSet.has(actLower);
      // Only gather SKU rows when the activity is marked as packaging/sku
      // in the dynamic lookup sets, or when it is explicitly a FG transfer.
      if (isPkgDone || isSkuDone || isFGTransfer) {
        const tbody = isPkgDone || isSkuDone ? editSkuBody : editTransBody;
        r.rows = Array.from(tbody.querySelectorAll("input"))
          .map((i) => ({
            skuId: Number(i.dataset.skuId),
            count: Number(i.value),
            packSize: i.dataset.packSize,
            uom: i.dataset.uom,
          }))
          .filter((x) => x.count > 0);
      }

      const needsQty =
        !(isPkgDone || isSkuDone || isFGTransfer || isStockTransfer) &&
        actLower !== "finished goods quality assessment";
      if (needsQty && (!r.qty || !r.uom)) {
        if (!(await askConfirm("No Qty/UOM provided. Save anyway?"))) {
          e_status.value = "Doing";
          return;
        }
      }

      // NEW: Stock transfer requires storage qty/uom
      if (newStat === "Done" && isStockTransfer) {
        if (!e_storageQty.value || !e_storageUom.value) {
          await showAlert(
            "Storage Qty and UOM are required for Stock transfer.",
          );
          e_status.value = "Doing";
          return;
        }
      }

      // ── PRE-FLIGHT PACKAGING-STOCK CHECK (client-side guard; no tiny-residual bump) ──
      if (isSkuDone) {
        // 1) Get product conversion factor once
        const { data: prod, error: prodErr } = await supabase
          .from("products")
          .select("id, conversion_to_base, uom_base")
          .eq("item", e_item.value)
          .single();

        if (prodErr || !prod) {
          console.error("Product lookup failed", prodErr);
        } else {
          const factor = Number(prod.conversion_to_base) || 1;

          // 2) Sum all SKU pack_size * count (event units), then convert to base
          let totalUnits = 0;
          for (const row of r.rows) {
            // row.packSize comes from the table’s data-* attributes
            totalUnits +=
              (Number(row.packSize) || 0) * (Number(row.count) || 0);
          }
          const totalBaseQty = totalUnits * factor;

          // 3) Read current FG bulk stock (if present)
          //    NOTE: fg_bulk_stock view exposes: item, bn, qty_on_hand
          const { data: stock, error: stockErr } = await supabase
            .from("fg_bulk_stock")
            .select("qty_on_hand")
            .eq("item", e_item.value)
            .eq("bn", e_bn.value)
            .maybeSingle();

          if (stockErr) {
            console.error("fg_bulk_stock lookup error:", stockErr);
          }

          // If a stock record exists, enforce the ceiling
          if (stock) {
            const available = Number(stock.qty_on_hand) || 0;
            const EPS = 0.001;

            if (totalBaseQty > available + EPS) {
              await showAlert(
                `Cannot save Done: packaging ${totalBaseQty.toFixed(3)} ${
                  prod.uom_base
                } ` +
                  `> available ${available.toFixed(3)} ${
                    prod.uom_base
                  } in FG bulk stock.`,
              );
              e_status.value = "Doing";
              return;
            }
          }
          // If there’s no row in fg_bulk_stock, we let it pass — DB trigger will ignore it anyway.
        }
      }

      const updDone = {
        status: "Done",
        started_on: toISO(e_start.value),
        due_date: toISO(e_due.value),
        completed_on: toISO(r.completedOn),

        // defaults – override below
        qty_after_process: null,
        qty_uom: null,
        sku_breakdown: null,
        lab_ref_number: null,
        storage_qty: null,
        storage_qty_uom: null,
      };

      if (actLower === "finished goods quality assessment") {
        updDone.lab_ref_number = r.labRef;
      } else if (isPkgDone || isSkuDone || isFGTransfer) {
        // all transfer/packaging type activities get an SKU breakdown
        updDone.sku_breakdown = r.rows
          .map((x) => `${x.packSize} ${x.uom} x ${x.count}`)
          .join("; ");

        // NEW: for stock transfer (Done) also persist storage qty/uom
        if (isStockTransfer) {
          updDone.storage_qty = e_storageQty.value
            ? Number(e_storageQty.value)
            : null;
          updDone.storage_qty_uom = e_storageUom.value || null;
        }
      } else if (isStockTransfer) {
        // If stock transfer is not a packaging/sku activity, persist storage fields
        updDone.storage_qty = e_storageQty.value
          ? Number(e_storageQty.value)
          : null;
        updDone.storage_qty_uom = e_storageUom.value || null;
      } else {
        // “normal” Done: keep Qty After Process
        updDone.qty_after_process = r.qty;
        updDone.qty_uom = r.uom;
      }

      // 3) attempt to update via RPC (server handles packaging/events)
      const payload = buildWorkLogRpcPayload({
        id,
        status: "Done",
        actLower,
        originalAct,
        r,
        updDone,
      });
      const { error: rpcErr } = await saveWorkLogViaRpc(payload, "Done");

      if (rpcErr) {
        if (isFgNegError(rpcErr)) {
          await showAlert(rpcErr.message);
          e_status.value = "Doing";
          return;
        }
        await showAlert(
          isDuplicateError(rpcErr)
            ? duplicateMessage({
                item: e_item.value,
                batch_number: e_bn.value,
                activity: originalAct,
                log_date: "(unchanged)",
              })
            : `Unexpected error: ${rpcErr.message || rpcErr.details || "see console"}`,
        );
        return;
      }

      // ── 6) success, close & refresh
      editSuccess.style.display = "block";
      setTimeout(() => {
        editSuccess.style.display = "none";
        hideModal(editModal);
        loadFull();
      }, 1200);
    };
    console.log("[log-edit] About to initialize module");
    // RUNTIME DIAGNOSTICS: verify Supabase connection and auth
    try {
      console.log("[log-edit] Runtime location:", window.location.href);

      const { data: recent, error: recentErr } = await supabase
        .from("daily_work_log")
        .select("id, item, batch_number, activity, status")
        .order("log_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(5);

      console.log("[log-edit] recent query result", {
        recentCount: (recent || []).length,
        recentErr: recentErr || null,
        recentSample: recent || [],
      });

      const { count, error: countErr } = await supabase
        .from("daily_work_log")
        .select("*", { count: "exact", head: true });

      console.log("[log-edit] count query result", {
        count: count ?? null,
        countErr: countErr || null,
      });

      try {
        const { data: sessionData, error: sessionErr } =
          await supabase.auth.getSession();
        const session = sessionData?.session ?? null;
        const userEmail = session?.user?.email ?? null;
        console.log("[log-edit] auth session", {
          sessionExists: !!session,
          userEmail: userEmail || null,
          sessionErr: sessionErr || null,
        });
      } catch (ae) {
        console.warn("[log-edit] auth.getSession threw", ae);
      }

      const { data: roleProbe, error: roleProbeErr } = await supabase.rpc(
        "rpc_debug_runtime_identity",
      );

      console.log("[log-edit] runtime identity", { roleProbe, roleProbeErr });
    } catch (diagErr) {
      console.error("[log-edit] runtime diagnostics failed", diagErr);
    }

    await loadSkuActivities();
    console.log("[log-edit] loadSkuActivities finished");
    await initFull();
    console.log("[log-edit] initFull finished");
  } catch (err) {
    console.error("[log-edit] Initialization failed", err);
  }
});
