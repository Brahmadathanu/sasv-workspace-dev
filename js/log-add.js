/***************************************************************************
 * log-add.js                                                               *
 * ----------------------------------------------------------------------- */

import { supabase } from "../public/shared/js/supabaseClient.js";
/* global flatpickr, confirmDatePlugin, TomSelect */

/* ─────────────────────────────  DATE HELPERS  ────────────────────────── */
const parseDMY = (s) => {
  const [d, m, y] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const formatDMY = (d) =>
  `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(
    2,
    "0"
  )}-${d.getFullYear()}`;
const addBiz = (start, n) => {
  const d = new Date(start);
  let a = 0;
  while (a < n) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0) a++;
  }
  return d;
};
const toISO = (dmy) => {
  if (!dmy) return null; // keep NULL if field blank
  const [d, m, y] = dmy.split("-");
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
};

/* ────────────────────────────  FLATPICKR CONFIG  ─────────────────────── */
const fpOptions = {
  dateFormat: "d-m-Y",
  allowInput: true,
  clickOpens: true,
  plugins: [
    confirmDatePlugin({
      showTodayButton: true,
      showClearButton: true,
      todayText: "Today",
      clearText: "Clear",
      confirmText: "OK",
    }),
  ],
};

/* ─────────────────────────────  INPUT MASK  ──────────────────────────── */
const attachMask = (el) =>
  el.addEventListener("input", () => {
    let v = el.value.replace(/\D/g, "").slice(0, 8);
    if (v.length > 2) v = v.slice(0, 2) + "-" + v.slice(2);
    if (v.length > 5) v = v.slice(0, 5) + "-" + v.slice(5);
    el.value = v;
  });

/* ────────────────────────────  DOM SHORTCUTS  ────────────────────────── */
const $ = (id) => document.getElementById(id);

const form = $("logForm");
const homeBtn = $("homeBtn");
const btnSubmitNew = $("btnSubmitNew");
const btnClear = $("btnClear");

const sectionSel = $("section");
const subSel = $("sub_section");
const areaSel = $("area");
const plantSel = $("plant_or_machinery");
const activitySel = $("activity");

const itemInput = $("itemInput");
const itemList = $("itemList");
const batchSel = $("batch_number");
const sizeInput = $("batch_size");
const uomInput = $("batch_uom");

const logDateInput = $("log_date");
const startInput = $("started_on");
const dueInput = $("due_date");
const statusSel = $("status");
const compOnInput = $("completed_on");

const compOnSection = $("completedOnSection");
const postProcSection = $("postProcessingSection");
const labRefSection = $("labRefSection");
const skuSection = $("skuSection");
const transferSection = $("transferSection");

const juiceSection = $("juiceSection");
const putamSection = $("putamSection");

const skuTableBody = document.querySelector("#skuTable tbody");
const transferTableBody = document.querySelector("#transferTable tbody");

const dialogOverlay = $("dialogOverlay");
const dialogMessage = $("dialogMessage");
const btnYes = $("btnYes");
const btnNo = $("btnNo");
const btnOk = $("btnOk");
const storageSection = $("storageSection");
const storageQtyInput = $("storage_qty");
const storageUomSel = $("storage_qty_uom");

// Frequently opened modules: edit this list in one place later
const QUICK_MODULES = [
  { id: "update", label: "Update Log Status", path: "update-log-status.html" },
  { id: "edit", label: "Edit Log Entry", path: "edit-log-entry.html" },
  { id: "view", label: "View Logs", path: "./public/shared/view-logs.html" },
];

/* ─────────────────────────────  STATE  ───────────────────────────────── */
let lastDurations = {};
let currentItemSkus = [];
let currentUserEmail = null;
let dirty = false;
let skipStockWarnActs = new Set();
let openRowChecked = false;
let shouldSaveDraft = false;
let skuActivities = []; // raw array of strings (lower‑cased)
let skuActSet = new Set(); // quick lookup: skuActSet.has(actNorm)
let lastWarnedSkuAct = null; // remember which SKU activity we already warned for

// ── STEP1: open-row guard helpers ───────────────────────────────────────
function saveDraft() {
  const fd = new FormData(form);
  const obj = Object.fromEntries(fd.entries());
  try {
    sessionStorage.setItem("addLogDraft", JSON.stringify(obj));
  } catch (e) {
    console.warn("saveDraft failed", e);
  }
}

function restoreDraft() {
  if (sessionStorage.getItem("draft_reason") !== "openRowUpdate") return;
  const raw = sessionStorage.getItem("addLogDraft");
  if (!raw) return;
  try {
    const obj = JSON.parse(raw);
    for (const [k, v] of Object.entries(obj)) {
      const el = form.elements[k];
      if (!el) continue;
      if (el.type === "checkbox" || el.type === "radio") {
        el.checked = !!v;
      } else {
        el.value = v;
      }
    }
  } catch (e) {
    console.warn("restoreDraft failed", e);
  }
  updateSections();
  updateDueDate();
  shouldSaveDraft = false;
}

// Activities that use RM juice/kashayam inputs
const JUICE_RE = /juice|grinding|kashayam|kashaya bhavana|swarasa bhavana/;

// Map bhavana activities to the ONLY values allowed by the DB CHECK
const JUICE_MAP = {
  "kashaya bhavana": "Kashayam",
  "swarasa bhavana": "Swarasam",
};

const getJuiceValue = (actNorm, formVal) => {
  const v = (formVal || "").toLowerCase();

  // Any Kashaya* act OR user picked something like Decoction → force Kashayam
  if (/kashaya/.test(actNorm) || v === "decoction") return "Kashayam";

  // Any Swarasa* act
  if (/swarasa/.test(actNorm)) return "Swarasam";

  // If activity doesn't need juice, return null
  return null;
};

// Wrap-around keyboard navigation for Tom Select dropdowns
function bindWrapAround(ts) {
  if (!ts || ts._wrapNavBound) return;
  ts._wrapNavBound = true;

  const onKeyDown = (e) => {
    if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
    // only act if dropdown is open
    if (!ts.isOpen) return;

    const options = Array.from(
      ts.dropdown_content.querySelectorAll(".option:not(.disabled)")
    );
    if (!options.length) return;

    const active = ts.activeOption || options[0];
    const first = options[0];
    const last = options[options.length - 1];

    // Up on first -> jump to last
    if (e.key === "ArrowUp" && active === first) {
      e.preventDefault();
      ts.setActiveOption(last); // programmatically move highlight
      ts.scrollToOption(last, true); // keep it in view
      return;
    }
    // Down on last -> jump to first
    if (e.key === "ArrowDown" && active === last) {
      e.preventDefault();
      ts.setActiveOption(first);
      ts.scrollToOption(first, true);
      return;
    }
    // otherwise, let Tom Select handle it
  };

  // bind once to the control input
  ts.control_input.addEventListener("keydown", onKeyDown);
}

/* ───────────────────────────  OPEN-ROW FETCH  ────────────────────────── */
async function fetchOpenLogs(item, bn) {
  if (!item || !bn) return [];

  const { data, error } = await supabase
    .from("daily_work_log")
    .select("id, activity, section_id, status")
    .eq("item", item)
    .eq("batch_number", bn)
    .in("status", ["Doing", "In Storage"]);

  if (error) {
    console.error("fetchOpenLogs error:", error);
    return [];
  }

  if (!data || !data.length) return [];

  // Get section names (if you only have ids)
  const secIds = [...new Set(data.map((r) => r.section_id).filter(Boolean))];
  let secMap = {};
  if (secIds.length) {
    const { data: secs } = await supabase
      .from("sections")
      .select("id, section_name")
      .in("id", secIds);
    secs?.forEach((s) => (secMap[s.id] = s.section_name));
  }

  // Return normalized rows
  return data.map((r) => ({
    id: r.id,
    activity: r.activity,
    section: secMap[r.section_id] || r.section_id || "—",
    status: r.status,
  }));
}

/* ─────────────────────────────  MODALS  ──────────────────────────────── */
const showAlert = (msg) =>
  new Promise((res) => {
    const prevFocusEl = document.activeElement; // remember focus
    dialogMessage.textContent = msg;
    btnYes.style.display = btnNo.style.display = "none";
    btnOk.style.display = "inline-block";
    form.setAttribute("inert", "");
    document.body.classList.add("modal-open");
    dialogOverlay.style.display = "flex";
    btnOk.onclick = () => {
      dialogOverlay.style.display = "none";
      form.removeAttribute("inert");
      document.body.classList.remove("modal-open");
      // restore focus (safely)
      if (prevFocusEl && typeof prevFocusEl.focus === "function") {
        prevFocusEl.focus({ preventScroll: true });
      }
      res();
    };
  });

const askConfirm = (msg) =>
  new Promise((res) => {
    const prevFocusEl = document.activeElement; // remember focus
    dialogMessage.textContent = msg;
    btnYes.style.display = btnNo.style.display = "inline-block";
    btnOk.style.display = "none";
    form.setAttribute("inert", "");
    document.body.classList.add("modal-open");
    dialogOverlay.style.display = "flex";
    btnYes.onclick = () => {
      dialogOverlay.style.display = "none";
      form.removeAttribute("inert");
      document.body.classList.remove("modal-open");
      if (prevFocusEl && typeof prevFocusEl.focus === "function") {
        prevFocusEl.focus({ preventScroll: true });
      }
      res(true);
    };
    btnNo.onclick = () => {
      dialogOverlay.style.display = "none";
      form.removeAttribute("inert");
      document.body.classList.remove("modal-open");
      if (prevFocusEl && typeof prevFocusEl.focus === "function") {
        prevFocusEl.focus({ preventScroll: true });
      }
      res(false);
    };
  });

/* ────────────────────────────  UTIL POPULATE  ───────────────────────── */
const populate = (sel, rows, vKey, tKey, ph) =>
  (sel.innerHTML =
    `<option value="">${ph}</option>` +
    rows.map((r) => `<option value="${r[vKey]}">${r[tKey]}</option>`).join(""));
const populateDataList = (dl, items, key) =>
  (dl.innerHTML = items.map((i) => `<option value="${i[key]}">`).join(""));

/* ───────────────────────────  DUPLICATE MSG  ────────────────────────── */
const duplicateMessage = (row) => {
  const parts = [
    `Item : ${row.item}`,
    `Batch Number: ${row.batch_number}`,
    `Activity : ${row.activity}`,
    `Log Date : ${row.log_date}`,
  ];
  if (row.started_on && row.started_on !== row.log_date)
    parts.push(`Started On : ${row.started_on}`);
  return (
    "A log with the same details already exists:\n\n" +
    parts.join("\n") +
    "\n\nOpen the existing log entry instead of adding a new one."
  );
};

/* ────────────────────────────  LOAD ACTIVITIES  ─────────────────────── */
async function loadActivities() {
  // Disable native select while fetching
  activitySel.disabled = true;

  // Build the same query as before
  let q = supabase.from("activities").select("activity_name,duration_days");
  if (areaSel.value) q = q.eq("area_id", areaSel.value);
  else if (subSel.value)
    q = q.eq("sub_section_id", subSel.value).is("area_id", null);
  else if (sectionSel.value)
    q = q
      .eq("section_id", sectionSel.value)
      .is("sub_section_id", null)
      .is("area_id", null);

  const { data, error } = await q.order("activity_name");
  if (error) {
    console.error(error);
    return;
  }

  // Refresh duration map (for due-date calculation)
  lastDurations = {};
  (data || []).forEach(
    (r) => (lastDurations[r.activity_name] = r.duration_days)
  );

  // If Tom Select is active, feed it. Otherwise, fall back to native select.
  if (actTS) {
    actTS.clearOptions();
    actTS.addOptions(data || []);
    if (data && data.length) {
      activitySel.disabled = false; // keep native in sync (for forms/validation)
      actTS.enable();
    } else {
      activitySel.disabled = true;
      actTS.disable();
    }
  } else {
    activitySel.innerHTML = "<option>-- Select Activity --</option>";
    if (data && data.length) {
      populate(
        activitySel,
        data,
        "activity_name",
        "activity_name",
        "-- Select Activity --"
      );
      activitySel.disabled = false;
    } else {
      activitySel.disabled = true;
    }
  }
}

/* ───────────────────────────  LOAD SKU ACTIVITIES  ───────────────────── */
async function loadSkuActivities() {
  const { data, error } = await supabase
    .from("event_type_lkp")
    .select("label")
    .eq("active", true)
    .eq("affects_bottled_stock", 1); // adjust to true if column is boolean

  if (error) {
    console.error("loadSkuActivities error:", error);
    skuActivities = [];
    skuActSet = new Set();
    return;
  }

  skuActivities = (data || [])
    .map((r) => (r.label || "").trim().toLowerCase())
    .filter(Boolean);

  skuActSet = new Set(skuActivities);

  if (!skuActivities.length) {
    console.warn("No SKU activities returned from event_type_lkp.");
  }
}

/* ─────────────────────  OPEN-ROW MODAL (radio list)  ─────────────────── */
function showOpenLogsModal(rows) {
  return new Promise((resolve) => {
    const overlay = $("openRowsOverlay");
    const tbody = $("openRowsTbody");
    const msg = $("openRowsMsg");
    const btnGo = $("btnOpenRowGo");
    const btnSkip = $("btnOpenRowSkip");

    // Build message
    msg.textContent =
      "There are existing activities for this Item/Batch that are still open. " +
      "Would you like to update one of them before adding a new log?";

    // Build rows
    tbody.innerHTML = rows
      .map(
        (r) => `
      <tr>
        <td style="text-align:center;">
          <input type="radio" name="openRowPick" value="${r.id}">
        </td>
        <td>${r.activity}</td>
        <td>${r.section}</td>
        <td>${r.status}</td>
      </tr>
    `
      )
      .join("");

    // Ensure none selected initially
    const clearSelection = () => {
      [...tbody.querySelectorAll("input[name='openRowPick']")].forEach(
        (r) => (r.checked = false)
      );
    };
    clearSelection();

    form.setAttribute("inert", "");
    document.body.classList.add("modal-open");

    overlay.style.display = "flex";

    // Handlers
    btnGo.onclick = () => {
      const picked = tbody.querySelector("input[name='openRowPick']:checked");
      if (!picked) {
        // Require a selection
        alert("Please select a row to update.");
        return;
      }
      overlay.style.display = "none";

      form.removeAttribute("inert");
      document.body.classList.remove("modal-open");

      resolve({ action: "update", id: picked.value });
    };
    btnSkip.onclick = () => {
      overlay.style.display = "none";

      form.removeAttribute("inert");
      document.body.classList.remove("modal-open");

      resolve({ action: "continue" });
    };

    // Show
    overlay.style.display = "flex";
  });
}

/* ───────────────────────────  SECTION VISIBILITY  ───────────────────── */
function updateSections() {
  const actNorm = (activitySel.value || "").trim().toLowerCase();
  const done = statusSel.value === "Done";
  const doing = statusSel.value === "Doing";
  const inStorage = statusSel.value === "In Storage";

  const isStockTransfer = /stock\s*transfer/i.test(actNorm);
  const isStockTransferDone = done && isStockTransfer;

  // Does this activity belong to the juice group?
  const juiceNeededByAct = JUICE_RE.test(actNorm);

  // Do we already have any juice values filled?
  const juiceFilled = !!(
    form.juice_or_decoction?.value ||
    form.rm_juice_qty?.value ||
    form.rm_juice_uom?.value
  );

  // Show rules:
  //  - Doing  → show if activity needs it
  //  - Done   → show ONLY if it needs it AND something is already filled
  const showJuice =
    (doing && juiceNeededByAct) || (done && juiceNeededByAct && juiceFilled);

  juiceSection.style.display = showJuice ? "block" : "none";

  // Disable fields when hidden so browser won't validate them
  juiceSection
    .querySelectorAll("input, select, textarea")
    .forEach((el) => (el.disabled = !showJuice));

  // — Putam only when Doing + putam‑type activity
  putamSection.style.display =
    doing && /putam|gaja putam|seelamann/.test(actNorm) ? "block" : "none";

  // — Storage section for In Storage OR Stock transfer (Done)
  const showStorage = inStorage || isStockTransferDone;
  storageSection.style.display = showStorage ? "block" : "none";
  storageSection
    .querySelectorAll("input, select")
    .forEach((el) => (el.disabled = !showStorage));

  // — Completed On always when Done
  compOnSection.style.display = done ? "block" : "none";

  // — Post‑processing (Qty/UOM) when Done, but NOT for SKU acts, QA, Transfer or Stock transfer
  const showPostProc =
    done &&
    !skuActSet.has(actNorm) &&
    actNorm !== "finished goods quality assessment" &&
    actNorm !== "transfer to fg store" &&
    !isStockTransfer;

  postProcSection.style.display = showPostProc ? "block" : "none";
  postProcSection
    .querySelectorAll("input, select, textarea")
    .forEach((el) => (el.disabled = !showPostProc));

  // — Lab Ref only when Done + FG QA activity
  labRefSection.style.display =
    done && actNorm === "finished goods quality assessment" ? "block" : "none";

  // — SKU Breakdown only when Done + SKU activity
  skuSection.style.display = done && skuActSet.has(actNorm) ? "block" : "none";
  if (done && skuActSet.has(actNorm)) renderSkuTable();

  // — Transfer table only when Done + Transfer activity
  transferSection.style.display =
    done && actNorm === "transfer to fg store" ? "block" : "none";
  if (done && actNorm === "transfer to fg store") renderTransferTable();

  // — DISABLE “In Storage” in status dropdown unless storage activity
  const allowStorage = ["intermediate storage", "fg bulk storage"].includes(
    actNorm
  );
  const storageOpt = Array.from(statusSel.options).find(
    (opt) => opt.value === "In Storage"
  );
  if (storageOpt) storageOpt.disabled = !allowStorage;

  // — If it was selected but now disallowed, clear it & hide fields
  if (!allowStorage && statusSel.value === "In Storage") {
    statusSel.value = ""; // or set to "Doing" if you prefer
    storageSection.style.display = "none";
  }
}

/* ─────────────────────────────  TABLES  ──────────────────────────────── */
function renderSkuTable() {
  skuTableBody.innerHTML = "";
  currentItemSkus.forEach((sku) => {
    skuTableBody.insertAdjacentHTML(
      "beforeend",
      `
      <tr>
        <td>${sku.pack_size}</td>
        <td>${sku.uom}</td>
        <td><input type="number" min="0" data-sku-id="${sku.id}"></td>
      </tr>`
    );
  });
}

async function renderTransferTable() {
  transferTableBody.innerHTML = "";
  if (!batchSel.value) return;
  const { data } = await supabase
    .from("bottled_stock_on_hand")
    .select("sku_id,pack_size,uom,on_hand")
    .eq("batch_number", batchSel.value);
  (data || []).forEach((r) => {
    transferTableBody.insertAdjacentHTML(
      "beforeend",
      `
      <tr>
        <td>${r.pack_size}</td>
        <td>${r.uom}</td>
        <td>${r.on_hand}</td>
        <td><input type="number" min="0" max="${r.on_hand}" data-sku-id="${r.sku_id}"></td>
      </tr>`
    );
  });
}

/* ─────────────────────────────  DUE DATE  ───────────────────────────── */
const updateDueDate = () => {
  const a = activitySel.value,
    s = startInput.value;
  if (a && s && lastDurations[a] != null)
    dueInput.value = formatDMY(addBiz(parseDMY(s), +lastDurations[a]));
  else dueInput.value = "";
};

// ───────────────────────────  CLEAR FORM  ─────────────────────────────
function clearForm() {
  // 1. Reset the form
  form.reset();

  // 2. Kill any saved draft unless we explicitly saved it
  sessionStorage.removeItem("addLogDraft");
  sessionStorage.removeItem("draft_reason");
  shouldSaveDraft = false;
  dirty = false;
  openRowChecked = false;
  lastWarnedSkuAct = null;

  // 3. Empty dynamic tables
  skuTableBody.innerHTML = "";
  transferTableBody.innerHTML = "";

  // 4. Hide conditional sections
  [
    compOnSection,
    postProcSection,
    labRefSection,
    skuSection,
    transferSection,
    juiceSection,
    putamSection,
    storageSection,
  ].forEach((sec) => (sec.style.display = "none"));

  // 5. Reset cascading selects & related fields
  [subSel, areaSel, plantSel, activitySel, batchSel].forEach((el) => {
    el.disabled = true;
    el.innerHTML = "";
  });

  // Keep Tom Selects in sync with disabled state
  if (actTS) {
    actTS.clear(true);
    actTS.clearOptions();
    actTS.disable();
  }

  // Clear Item (Tom Select or native)
  if (itemTS) {
    itemTS.clear(true); // remove current selection (silent)
    // no need to clearOptions; it loads on demand as you type
  } else {
    itemInput.value = "";
  }

  sizeInput.value = "";
  uomInput.value = "";

  // Also reset BN
  batchSel.disabled = true;
  batchSel.innerHTML = '<option value="">-- Select Batch Number --</option>';

  // 6. Re-set today’s dates
  const today = formatDMY(new Date());
  logDateInput.value = today;
  startInput.value = today;
  dueInput.value = "";
  compOnInput.value = "";

  // 7. Recompute visibility
  updateSections();
}

/* ───────────────────────────  CARRY-FORWARD  ────────────────────────── */
function applyCarryForward() {
  const p = new URLSearchParams(window.location.search);
  const item = p.get("prefill_item") || p.get("item");
  const bn = p.get("prefill_bn") || p.get("bn");

  // Prefill ITEM
  if (item) {
    if (itemTS) {
      // Make sure Tom Select knows about this option BEFORE selecting it
      itemTS.addOption({ item }); // valueField = labelField = "item"
      itemTS.refreshOptions(false);
      itemTS.setValue(item); // not silent → fires 'change'
    } else {
      itemInput.value = item;
      itemInput.dispatchEvent(new Event("change"));
    }
  }

  // Prefill BN (after the BN list is populated by the Item 'change' handler)
  if (bn) {
    const trySetBn = () => {
      const hasIt = Array.from(batchSel.options).some((o) => o.value === bn);
      if (!hasIt) return false;
      batchSel.value = bn;
      batchSel.dispatchEvent(new Event("change"));
      batchSel.focus(); // optional nicety
      return true;
    };

    // Try immediately; if BN options aren’t ready yet, poll briefly
    if (!trySetBn()) {
      const iv = setInterval(() => {
        if (trySetBn()) clearInterval(iv);
      }, 150);
      // safety stop after ~5s
      setTimeout(() => clearInterval(iv), 5000);
    }
  }
}

/* ───────────────────────── Tom Select setup ─────────────────────────── */
let itemTS = null; // Tom Select instance for Item
let actTS = null; // Tom Select instance for Activity

function initTomSelects() {
  // 1) ITEM – attach to your existing input#itemInput
  itemTS = new TomSelect("#itemInput", {
    maxItems: 1,
    create: false,
    persist: false,
    placeholder: "Type to search…",
    valueField: "item",
    labelField: "item",
    searchField: ["item"],
    loadThrottle: 300,
    load: async (query, cb) => {
      try {
        if (!query.length) return cb();
        // Query small set and dedupe client-side
        const { data, error } = await supabase
          .from("bmr_details")
          .select("item")
          .ilike("item", `%${query}%`)
          .limit(100);

        if (error) return cb();
        const uniq = [
          ...new Set((data || []).map((r) => r.item).filter(Boolean)),
        ]
          .slice(0, 100)
          .map((item) => ({ item }));
        cb(uniq);
      } catch {
        cb();
      }
    },
    // keep look close to your inputs
    wrapperClass: "ts-wrapper",
    controlClass: "ts-control",
    dropdownClass: "ts-dropdown",
  });

  // 2) ACTIVITY – attach to your existing select#activity
  actTS = new TomSelect("#activity", {
    maxItems: 1,
    create: false,
    persist: false,
    placeholder: "-- Select Activity --",
    valueField: "activity_name",
    labelField: "activity_name",
    searchField: ["activity_name"],
    preload: "focus", // load when focused
    loadThrottle: 300,
    shouldLoad: () => !!(areaSel.value || subSel.value || sectionSel.value),
    load: async (query, cb) => {
      try {
        // Mirror your loadActivities() filters
        let qy = supabase
          .from("activities")
          .select("activity_name,duration_days");

        if (areaSel.value) {
          qy = qy.eq("area_id", areaSel.value);
        } else if (subSel.value) {
          qy = qy.eq("sub_section_id", subSel.value).is("area_id", null);
        } else if (sectionSel.value) {
          qy = qy
            .eq("section_id", sectionSel.value)
            .is("sub_section_id", null)
            .is("area_id", null);
        }

        if (query && query.trim().length) {
          qy = qy.ilike("activity_name", `%${query}%`);
        }

        const { data, error } = await qy.order("activity_name").limit(100);
        if (error) return cb();
        // update your durations map so due-date calc keeps working
        lastDurations = {};
        (data || []).forEach(
          (r) => (lastDurations[r.activity_name] = r.duration_days)
        );
        cb(data || []);
      } catch {
        cb();
      }
    },
    wrapperClass: "ts-wrapper",
    controlClass: "ts-control",
    dropdownClass: "ts-dropdown",
  });

  bindWrapAround(actTS);

  // Note: Tom Select will still fire 'change' on the underlying elements,
  // so all your existing listeners continue to work.
  actTS.clearOptions();
  actTS.disable();
  activitySel.disabled = true;
}

/* ───────────────────── Activity helpers (Tom Select aware) ──────────── */

function focusActivity() {
  // put focus back on the visible control
  if (actTS) {
    actTS.focus(); // focuses Tom Select control
  } else if (activitySel && activitySel.focus) {
    activitySel.focus({ preventScroll: true });
  }
}

/* ─────────────────────────────  INIT  ───────────────────────────────── */
window.addEventListener("DOMContentLoaded", async () => {
  ["log_date", "started_on"].forEach((id) => {
    const el = $(id);
    attachMask(el);
    flatpickr(el, { ...fpOptions, maxDate: "today" });
  });
  ["due_date", "completed_on"].forEach((id) => {
    const el = $(id);
    attachMask(el);
    flatpickr(el, fpOptions);
  });

  logDateInput.value = startInput.value = formatDMY(new Date());
  updateDueDate();

  initTomSelects();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) currentUserEmail = user.email;

  homeBtn.onclick = async () => {
    if (dirty && !(await askConfirm("Unsaved changes—leave?"))) return;
    sessionStorage.removeItem("addLogDraft");
    sessionStorage.removeItem("draft_reason");
    window.location.href = "index.html";
  };
  btnSubmitNew.onclick = (e) => {
    e.preventDefault();
    handleSubmit(true);
  };

  // --- Quick Modules "bookmark bar" ---
  const quickBar = document.getElementById("quickBar");

  function openModuleById(id) {
    const mod = QUICK_MODULES.find((m) => m.id === id);
    if (!mod) return;

    // pass current context
    const params = new URLSearchParams({
      prefill_item: itemInput.value || "",
      prefill_bn: batchSel.value || "",
      item: itemInput.value || "",
      bn: batchSel.value || "",
    });

    const absUrl = new URL(
      `${mod.path}?${params.toString()}`,
      window.location.href
    ).toString();

    if (window.app?.openModuleUrl) {
      window.app.openModuleUrl(absUrl, { width: 1200, height: 800 });
    } else {
      window.open(absUrl, "_blank", "noopener");
    }
  }

  function renderQuickBar() {
    if (!quickBar) return;
    quickBar.innerHTML = QUICK_MODULES.map(
      (m, i) =>
        `<button type="button" class="quick-btn" data-mod="${m.id}" title="${
          m.label
        } (Alt+${i + 1})">${m.label}</button>`
    ).join("");

    quickBar.addEventListener("click", (e) => {
      const btn = e.target.closest(".quick-btn");
      if (!btn) return;
      openModuleById(btn.dataset.mod);
    });
  }

  renderQuickBar();

  // Alt+1..Alt+9 open the matching quick module
  document.addEventListener("keydown", (e) => {
    if (!e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    const k = e.key;
    if (!/^[1-9]$/.test(k)) return;

    const idx = Number(k) - 1;
    const mod = QUICK_MODULES[idx];
    if (!mod) return;

    e.preventDefault();
    openModuleById(mod.id);
  });

  if (btnClear) {
    btnClear.onclick = async (e) => {
      e.preventDefault(); // <— stop any default form action
      if (dirty) {
        const ok = await askConfirm("Clear all fields?");
        if (!ok) return;
      }
      clearForm();
    };
  }

  [subSel, areaSel, plantSel, batchSel, activitySel].forEach((el) => {
    el.disabled = true;
    el.innerHTML = "";
  });

  {
    const { data } = await supabase
      .from("sections")
      .select("id,section_name")
      .order("section_name");
    if (data)
      populate(sectionSel, data, "id", "section_name", "-- Select Section --");
  }
  {
    const { data } = await supabase
      .from("bmr_details")
      .select("item")
      .order("item");
    if (data) {
      const uniq = [...new Set(data.map((r) => r.item))].map((item) => ({
        item,
      }));
      populateDataList(itemList, uniq, "item");
    }
  }

  // ── Build skip list from event_type_lkp -------------------------------
  {
    const { data: skipActs, error: skipErr } = await supabase
      .from("event_type_lkp")
      .select("label")
      .eq("is_packaging", true)
      .eq("active", true)
      .eq("affects_bulk_stock", 0);

    if (!skipErr && skipActs) {
      skipStockWarnActs = new Set(
        skipActs.map((r) => (r.label || "").trim().toLowerCase())
      );
    } else {
      console.error("skip list load failed:", skipErr);
    }
  }

  await loadSkuActivities();
  restoreDraft();
  applyCarryForward();
  updateSections();
});

/* ─────────────────────────  CASCADE EVENTS  ─────────────────────────── */
sectionSel.addEventListener("change", async () => {
  [subSel, areaSel, plantSel, activitySel].forEach((el) => {
    el.disabled = true;
    el.innerHTML = "";
  });
  if (actTS) {
    actTS.clear(true);
    actTS.clearOptions();
    actTS.disable();
  }
  activitySel.disabled = true;
  if (!sectionSel.value) return;
  const { data } = await supabase
    .from("subsections")
    .select("id,subsection_name")
    .eq("section_id", sectionSel.value)
    .order("subsection_name");
  if (data?.length) {
    populate(subSel, data, "id", "subsection_name", "-- Select Sub-section --");
    subSel.disabled = false;
  }
  await loadActivities();
});

subSel.addEventListener("change", async () => {
  [areaSel, plantSel, activitySel].forEach((el) => {
    el.disabled = true;
    el.innerHTML = "";
  });
  if (actTS) {
    actTS.clear(true);
    actTS.clearOptions();
    actTS.disable();
  }
  activitySel.disabled = true;
  if (!subSel.value) return;
  const { data } = await supabase
    .from("areas")
    .select("id,area_name")
    .eq("section_id", sectionSel.value)
    .eq("subsection_id", subSel.value)
    .order("area_name");
  if (data?.length) {
    populate(areaSel, data, "id", "area_name", "-- Select Area --");
    areaSel.disabled = false;
  }
  await loadActivities();
});

areaSel.addEventListener("change", async () => {
  if (actTS) {
    actTS.clear(true);
    actTS.clearOptions();
    actTS.disable();
  }
  activitySel.disabled = true;
  plantSel.disabled = true;
  plantSel.innerHTML = "";
  if (!areaSel.value) return;
  //Only fetch Operational Plant / Machinery
  const { data } = await supabase
    .from("plant_machinery")
    .select("id,plant_name")
    .eq("area_id", areaSel.value)
    .eq("status", "O");

  if (data?.length) {
    data.sort((a, b) =>
      a.plant_name.localeCompare(b.plant_name, undefined, {
        numeric: true,
        sensitivity: "base",
      })
    );
    populate(
      plantSel,
      data,
      "id",
      "plant_name",
      "-- Select Plant/Machinery --"
    );
    plantSel.disabled = false;
  }
  await loadActivities();
});

itemInput.addEventListener("change", async () => {
  openRowChecked = false;
  const val = itemInput.value.trim();

  if (itemTS) {
    // If Tom Select is active, treat any non-empty selection as valid.
    // (Tom Select only lets the user pick an option we provided.)
    if (!val) {
      await showAlert("Please select a valid item.");
      if (itemTS) itemTS.clear();
      else itemInput.value = "";
      batchSel.disabled = true;
      batchSel.innerHTML =
        '<option value="">-- Select Batch Number --</option>';
      currentItemSkus = [];
      updateSections();
      return;
    }
  } else {
    // Fallback to old datalist validation
    if (!Array.from(itemList.options).some((o) => o.value === val)) {
      await showAlert("Please select a valid item.");
      itemInput.value = "";
      batchSel.disabled = true;
      batchSel.innerHTML =
        '<option value="">-- Select Batch Number --</option>';
      currentItemSkus = [];
      updateSections();
      return;
    }
  }
  // batches
  const { data: bns } = await supabase
    .from("bmr_details")
    .select("bn")
    .eq("item", val)
    .order("bn");
  const uniq = [...new Set(bns.map((r) => r.bn))].map((bn) => ({ bn }));
  populate(batchSel, uniq, "bn", "bn", "-- Select Batch Number --");
  batchSel.disabled = !uniq.length;
  // SKUs
  const { data: prod } = await supabase
    .from("products")
    .select("id")
    .eq("item", val)
    .single();
  if (prod) {
    const { data: skus } = await supabase
      .from("product_skus")
      .select("id,pack_size,uom")
      .eq("product_id", prod.id)
      .eq("is_active", true)
      .order("pack_size");
    currentItemSkus = skus || [];
  } else currentItemSkus = [];
  updateSections();
});

batchSel.addEventListener("change", async () => {
  openRowChecked = false;
  sizeInput.value = uomInput.value = "";
  if (!itemInput.value || !batchSel.value) return;
  const { data } = await supabase
    .from("bmr_details")
    .select("batch_size,uom")
    .eq("item", itemInput.value)
    .eq("bn", batchSel.value)
    .limit(1);
  if (data?.length) {
    sizeInput.value = data[0].batch_size;
    uomInput.value = data[0].uom;
  }
  updateSections();
});

activitySel.addEventListener("change", async () => {
  const actNorm = (activitySel.value || "").trim().toLowerCase();
  const isStorageAct = ["intermediate storage", "fg bulk storage"].includes(
    actNorm
  );

  // ─── SKU activity stock-impact warning ─────────────────────────────────
  if (skuActSet.has(actNorm) && lastWarnedSkuAct !== actNorm) {
    await showAlert(
      "This activity will affect Bottled SOH and the quantity available for “Transfer to FG Store”. Please make sure this log really needs to be saved."
    );
    focusActivity(); // Tom-Select aware refocus
    lastWarnedSkuAct = actNorm;
  } else if (!skuActSet.has(actNorm)) {
    // switched to a non-SKU activity → reset so next SKU act will warn again
    lastWarnedSkuAct = null;
  }

  const autoJ = /kashaya/.test(actNorm)
    ? "Kashayam"
    : /swarasa/.test(actNorm)
    ? "Swarasam"
    : JUICE_MAP[actNorm] || null;

  // Force correct value for bhavana acts (even if user picked 'Decoction')
  if (/kashaya|swarasa/.test(actNorm)) {
    form.juice_or_decoction.value = getJuiceValue(
      actNorm,
      form.juice_or_decoction.value
    );
  } else if (autoJ && !form.juice_or_decoction.value) {
    form.juice_or_decoction.value = autoJ;
  }

  // ─── Restrict Status options ───────────────────────────────────────────
  Array.from(statusSel.options).forEach((opt) => {
    const v = opt.value;
    if (isStorageAct) {
      // only Done or In Storage allowed
      opt.disabled = !(v === "Done" || v === "In Storage");
    } else {
      // for non-storage activities, disallow In Storage
      opt.disabled = v === "In Storage";
    }
  });
  // If the currently selected status is now disabled, clear it
  if (statusSel.value && statusSel.selectedOptions[0].disabled) {
    statusSel.value = "";
  }

  // ─── Finished Goods QA guard (existing logic) ─────────────────────────
  if (skuActSet.has(actNorm) && itemInput.value && batchSel.value) {
    const { data: qa } = await supabase
      .from("daily_work_log")
      .select("id")
      .eq("item", itemInput.value)
      .eq("batch_number", batchSel.value)
      .eq("activity", "Finished Goods Quality Assessment")
      .eq("status", "Done")
      .limit(1);
    if (!qa?.length) {
      await showAlert(
        "Finished Goods Quality Assessment not completed for this batch."
      );
      activitySel.value = "";
    }
  }

  // ─── Recompute dates & show/hide sections ─────────────────────────────
  updateDueDate();
  updateSections();
});

statusSel.addEventListener("change", () => {
  const done = statusSel.value === "Done";

  if (done) {
    // Auto‑fill Completed On when switching into Done
    if (!compOnInput.value) {
      compOnInput.value = formatDMY(new Date());
    }
  } else {
    // Clear Completed On
    compOnInput.value = "";

    // Clear Post‑Processing fields
    const qtyInput = form.querySelector("input[name='qty_after_process']");
    const uomSelect = form.querySelector(
      "select[name='qty_after_process_uom']"
    );
    if (qtyInput) qtyInput.value = "";
    if (uomSelect) uomSelect.value = "";
  }

  updateSections();
});

startInput.addEventListener("change", updateDueDate);
form.addEventListener("input", () => {
  dirty = true;
  if (shouldSaveDraft) saveDraft(); // only when we decided to preserve it
});

/* ──────────────────────────  SUBMIT HANDLER  ─────────────────────────── */
async function handleSubmit(isNew) {
  // 1) Basic HTML5 validation
  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  /* ── OPEN-ROW GUARD (same Item+BN still Doing/In Storage) ──────────── */
  if (!openRowChecked) {
    const openRows = await fetchOpenLogs(itemInput.value, batchSel.value);
    if (openRows.length) {
      const choice = await showOpenLogsModal(openRows);
      if (choice.action === "update") {
        shouldSaveDraft = true; // enable one-time saving
        saveDraft(); // actually save
        sessionStorage.setItem("draft_reason", "openRowUpdate"); // mark why
        window.open(`update-log-status.html?id=${choice.id}`, "_blank");
        return;
      }
      openRowChecked = true;
      sessionStorage.removeItem("addLogDraft");
      sessionStorage.removeItem("draft_reason");
      shouldSaveDraft = false;
    }
  }

  // 2) Derive flags
  const actNorm = (activitySel.value || "").trim().toLowerCase();
  const isTransfer = actNorm === "transfer to fg store";
  const isDone = statusSel.value === "Done";
  const isStorage = statusSel.value === "In Storage";
  const isStockTransfer = /stock\s*transfer/i.test(actNorm);
  const isStockTransferDone = isDone && isStockTransfer;
  const doing = statusSel.value === "Doing";
  const juiceVal = getJuiceValue(actNorm, form.juice_or_decoction?.value);

  const needJuiceSubmit = (doing || isDone) && JUICE_RE.test(actNorm);
  // 3) Juice/Decoction required (Doing or Done)
  if (needJuiceSubmit) {
    if (!form.juice_or_decoction.value) {
      await showAlert("Please select Juice/Decoction type.");
      return;
    }
    if (!form.rm_juice_qty.value) {
      await showAlert("Please enter RM Qty.");
      return;
    }
    if (!form.rm_juice_uom.value) {
      await showAlert("Please select RM UOM.");
      return;
    }
  }

  // 4) Putam required when visible
  if (doing && /putam|gaja putam|seelamann/.test(actNorm)) {
    if (!form.count_of_saravam.value) {
      await showAlert("Please enter Count of Saravam.");
      return;
    }
    if (!form.fuel.value) {
      await showAlert("Please select Fuel Type.");
      return;
    }
    if (!form.fuel_under.value) {
      await showAlert("Please enter Fuel Under.");
      return;
    }
    if (!form.fuel_over.value) {
      await showAlert("Please enter Fuel Over.");
      return;
    }
  }

  // 5) Completed On required whenever Done
  if (isDone) {
    if (!form.completed_on.value) {
      await showAlert("Please enter Completed On date.");
      return;
    }
  }

  // 6) Lab Ref Number required for FG QA
  if (isDone && actNorm === "finished goods quality assessment") {
    if (!form.lab_ref_number.value) {
      await showAlert("Please enter Lab Ref Number.");
      return;
    }
  }

  // 7) SKU Breakdown must have at least one count > 0
  if (isDone && skuActSet.has(actNorm)) {
    const skuInputs = Array.from(skuTableBody.querySelectorAll("input"));
    if (!skuInputs.some((i) => +i.value > 0)) {
      await showAlert("Enter at least one SKU count greater than zero.");
      return;
    }
  }

  // 8) Storage Qty & UOM for FG bulk storage
  if (isStorage && actNorm === "fg bulk storage") {
    if (!storageQtyInput.value || !storageUomSel.value) {
      await showAlert(
        "Storage Qty and UOM are required when Activity is “FG bulk storage” and Status is “In Storage.”"
      );
      return;
    }
  }

  // 8b) Storage Qty & UOM for Stock transfer (Done)
  if (isDone && isStockTransfer) {
    if (!storageQtyInput.value || !storageUomSel.value) {
      await showAlert("Storage Qty and UOM are required for Stock transfer.");
      return;
    }
  }

  // 9) Transfer qty validations
  if (isDone && isTransfer) {
    const inputs = [...transferTableBody.querySelectorAll("input")];
    if (!inputs.some((i) => +i.value > 0)) {
      inputs[0].setCustomValidity("Enter a Transfer Qty > 0.");
      inputs[0].reportValidity();
      inputs[0].setCustomValidity("");
      return;
    }
    for (const inp of inputs) {
      const cnt = +inp.value || 0,
        max = +inp.max || 0;
      if (cnt > max) {
        inp.setCustomValidity(`Cannot exceed on-hand (${max}).`);
        inp.reportValidity();
        inp.setCustomValidity("");
        return;
      }
    }
  }

  /* ---- Build payload -------------------------------------------------- */
  const row = {
    log_date: toISO(form.log_date.value),
    section_id: sectionSel.value,
    subsection_id: subSel.value || null,
    area_id: areaSel.value || null,
    plant_id: plantSel.value || null,
    item: itemInput.value,
    batch_number: batchSel.value,
    batch_size: sizeInput.value || null,
    batch_uom: uomInput.value || null,
    activity: activitySel.value,
    juice_or_decoction: juiceVal,
    specify: form.specify?.value || null,
    rm_juice_qty: form.rm_juice_qty?.value
      ? Number(form.rm_juice_qty.value)
      : null,
    rm_juice_uom: form.rm_juice_uom?.value || null,
    count_of_saravam: form.count_of_saravam?.value || null,
    fuel: form.fuel?.value || null,
    fuel_under: form.fuel_under?.value || null,
    fuel_over: form.fuel_over?.value || null,
    started_on: toISO(form.started_on?.value) || null,
    due_date: toISO(form.due_date?.value) || null,
    status: form.status?.value,
    storage_qty:
      isStorage || isStockTransferDone
        ? Number(storageQtyInput.value) || null
        : null,
    storage_qty_uom:
      isStorage || isStockTransferDone ? storageUomSel.value || null : null,
    completed_on: toISO(form.completed_on?.value) || null,
    qty_after_process: null,
    qty_uom: null,
    sku_breakdown: null,
    lab_ref_number: form.lab_ref_number?.value || null,
    remarks: form.remarks?.value || null,
    uploaded_by: currentUserEmail,
  };

  /* ---- Optional Qty/UOM ---------------------------------------------- */
  const needsQty =
    isDone &&
    !skuActSet.has(actNorm) &&
    actNorm !== "finished goods quality assessment" &&
    actNorm !== "transfer to fg store" &&
    !isStockTransfer;

  if (needsQty) {
    const qv = form.querySelector('[name="qty_after_process"]').value;
    const uv = form.querySelector('[name="qty_after_process_uom"]').value;
    if (!qv || !uv) {
      if (!(await askConfirm("Qty After Process & UOM not entered. Continue?")))
        return;
    } else {
      row.qty_after_process = qv;
      row.qty_uom = uv;
    }
  }

  /* ---- SKU / Transfer breakdown -------------------------------------- */
  if (isDone && skuActSet.has(actNorm)) {
    const parts = [...skuTableBody.querySelectorAll("input")]
      .map((i) => {
        const cnt = +i.value;
        const sku = currentItemSkus.find((s) => s.id == i.dataset.skuId);
        return cnt > 0 ? `${sku.pack_size} ${sku.uom} x ${cnt}` : null;
      })
      .filter(Boolean);
    row.sku_breakdown = parts.join("; ");
    row.qty_uom = "Nos";
  }
  if (isDone && isTransfer) {
    const parts = [...transferTableBody.querySelectorAll("input")]
      .map((i) => {
        const cnt = +i.value;
        const sku = currentItemSkus.find((s) => s.id == i.dataset.skuId);
        return cnt > 0 ? `${sku.pack_size} ${sku.uom} x ${cnt}` : null;
      })
      .filter(Boolean);
    row.sku_breakdown = parts.join("; ");
  }

  // ── PRE‑FLIGHT STOCK CHECK (bulk view) ──────────────────────────────
  if (
    isDone &&
    skuActSet.has(actNorm) && // only packaging acts
    !skipStockWarnActs.has(actNorm) // except those flagged “no‑bulk”
  ) {
    /* 1) total units requested (pack_size × count) */
    let totalUnits = 0;
    skuTableBody.querySelectorAll("input").forEach((i) => {
      const cnt = Number(i.value) || 0;
      if (cnt > 0) {
        const sku = currentItemSkus.find((s) => s.id == i.dataset.skuId);
        totalUnits += sku.pack_size * cnt;
      }
    });

    /* 2) product’s base‑UOM + conversion factor */
    const { data: prod } = await supabase
      .from("products")
      .select("conversion_to_base,uom_base")
      .eq("item", row.item)
      .single();
    const factor = (prod && Number(prod.conversion_to_base)) || 1;
    const baseUom = (prod && prod.uom_base) || row.batch_uom || "";

    /* 3) convert to base units */
    const totalBase = totalUnits * factor;

    /* 4) fetch available bulk stock from the **new view** */
    const { data: st } = await supabase
      .from("fg_bulk_stock")
      .select("qty_on_hand")
      .eq("item", row.item)
      .eq("bn", row.batch_number)
      .single();

    if (st && st.qty_on_hand != null) {
      const avail = st.qty_on_hand;
      if (totalBase > avail + 0.0001) {
        await showAlert(
          `Cannot package ${totalBase.toFixed(3)} ${baseUom}; ` +
            `only ${avail.toFixed(3)} ${baseUom} available.`
        );
        return; // abort Submit
      }
    }
  }

  /* ---- INSERT --------------------------------------------------------- */
  let newId;

  const { data, error } = await supabase
    .from("daily_work_log")
    .insert([row])
    .select("id");

  if (error) {
    console.error("Supabase error:", error);
    const isDup =
      error.code === "23505" ||
      /duplicate key/i.test(error.message || "") ||
      /duplicate key/i.test(error.details || "");
    await showAlert(
      isDup
        ? duplicateMessage(row)
        : `Unexpected error: ${error.message || "see console"}`
    );
    return;
  }
  newId = data[0].id;

  /* ---- Packaging events ---------------------------------------------- */
  if (isDone && (skuActSet.has(actNorm) || isTransfer)) {
    const { data: pe } = await supabase
      .from("packaging_events")
      .insert([{ work_log_id: newId, event_type: row.activity }])
      .select("id");
    if (pe?.length) {
      const inputs = skuActSet.has(actNorm)
        ? skuTableBody.querySelectorAll("input")
        : transferTableBody.querySelectorAll("input");
      const evRows = [...inputs]
        .map((i) => {
          const cnt = +i.value;
          if (cnt <= 0) return null;
          return {
            packaging_event_id: pe[0].id,
            sku_id: +i.dataset.skuId,
            count: cnt,
          };
        })
        .filter(Boolean);
      if (evRows.length) await supabase.from("event_skus").insert(evRows);
    }
  }

  /* ---- SUCCESS -------------------------------------------------------- */
  await showAlert("Log saved successfully!");

  // ← RESET dirty flag so “unsaved changes” won’t fire after saving
  dirty = false;

  if (isNew) {
    const p = new URLSearchParams();
    p.set("prefill_item", row.item);
    p.set("prefill_bn", row.batch_number);
    window.location.href = `add-log-entry.html?${p.toString()}`;
  } else {
    clearForm();
  }
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  handleSubmit(false);
});
