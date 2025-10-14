/* eslint-env browser */
import { supabase } from "../public/shared/js/supabaseClient.js";

/* ========== utilities ========== */
const $ = (id) => document.getElementById(id);
const chip = (txt, tone = "") => `<span class="chip ${tone}">${txt}</span>`;
const fmtDate = (d) => (d ? new Date(d).toISOString().slice(0, 10) : "");
function monthFloor(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

/** Prompt for a new line: product_id, month_start, proposed_qty, note */
function promptLineFields(defaults = {}) {
  return new Promise((resolve) => {
    const dlg = document.createElement("dialog");
    dlg.style.padding = "0";
    dlg.innerHTML = `
      <div style="padding:12px;min-width:420px">
        <div style="font-weight:600;margin-bottom:8px">Add Line</div>
        <div style="display:flex;flex-direction:column;gap:8px">
          <label>product_id<input id="_pid" style="width:100%" value="${
            defaults.product_id ?? ""
          }" /></label>
          <label>month_start (YYYY-MM-01)<input id="_ms" style="width:100%" value="${
            defaults.month_start ?? ""
          }" /></label>
          <label>proposed_qty<input id="_pq" style="width:100%" value="${
            defaults.proposed_qty ?? ""
          }" /></label>
          <label>note<input id="_note" style="width:100%" value="${
            defaults.note ?? ""
          }" /></label>
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
    const pid = dlg.querySelector("#_pid");
    const ms = dlg.querySelector("#_ms");
    const pq = dlg.querySelector("#_pq");
    const note = dlg.querySelector("#_note");

    function cleanup(val) {
      if (typeof dlg.close === "function") dlg.close();
      dlg.remove();
      resolve(val);
    }

    ok.addEventListener("click", () =>
      cleanup({
        product_id: pid.value.trim(),
        month_start: ms.value.trim(),
        proposed_qty: pq.value.trim(),
        note: note.value.trim(),
      })
    );
    cancel.addEventListener("click", () => cleanup(null));
    dlg.addEventListener("cancel", (e) => {
      e.preventDefault();
      cleanup(null);
    });
    if (typeof dlg.showModal === "function") dlg.showModal();
    else dlg.setAttribute("open", "");
    pid.focus();
  });
}
function addMonths(d, n) {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}
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
  $("poModalClose")?.addEventListener("click", closeModal);
  $("poModal")?.addEventListener("cancel", (e) => {
    e.preventDefault();
    closeModal();
  });
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
  $("whoAmI").textContent = `Logged in as ${user.email}`;
  return user;
}

/* ========== tabs ========== */
function setupTabs() {
  const btns = [...document.querySelectorAll(".tab-btn")];
  const tabs = {
    sets: $("tab-sets"),
    lines: $("tab-lines"),
    reconcile: $("tab-reconcile"),
    recon: $("tab-recon"),
    active: $("tab-active"),
  };
  btns.forEach((b) => {
    b.addEventListener("click", () => {
      btns.forEach((x) => x.classList.remove("active"));
      b.classList.add("active");
      Object.values(tabs).forEach((t) => t.classList.remove("active"));
      tabs[b.dataset.tab].classList.add("active");
    });
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
  $("selSets").innerHTML = `<option value="">(pick)</option>` + opts;
  $("selSetForLines").innerHTML = `<option value="">(pick)</option>` + opts;
  $("selSetForReconcile").innerHTML = `<option value="">(pick)</option>` + opts;

  // table
  const tbody = $("setsTable").querySelector("tbody");
  tbody.innerHTML = "";
  (data || []).forEach((r) => {
    const tr = document.createElement("tr");
    // show 'You' if current user is the creator, otherwise show the uuid or fallback
    const ownerLabel = r.created_by
      ? curUser && String(curUser.id) === String(r.created_by)
        ? "You"
        : String(r.created_by)
      : "Production Controller";
    tr.innerHTML = `
      <td>${r.id}</td>
      <td>${r.title ?? r.set_name ?? r.name ?? ""}</td>
      <td>${ownerLabel}</td>
      <td>${fmtDate(r.created_at)}</td>
      <td class="muted small">${r.note ?? ""}</td>
    `;
    tbody.appendChild(tr);
  });
  $("setsStatus").textContent = `${data?.length ?? 0} sets`;
}

async function createSet() {
  const resp = await promptTwoInputs(
    "Create Set",
    "Set name (optional):",
    "Notes (optional):",
    "",
    ""
  );
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
    // ignore
  }

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
  await loadSets();
  // pre-select the new one
  ["selSets", "selSetForLines", "selSetForReconcile"].forEach((id) => {
    const sel = $(id);
    if (sel) sel.value = data.id;
  });
}

async function seedSet() {
  // This function now creates a new manual set seeded from system using
  // the DB function `manual_plan_seed_from_system(p_title,p_note,p_from,p_to)`.
  const from = $("seedFrom").value;
  const to = $("seedTo").value;
  if (!from || !to) return showModal("Pick From/To dates.");

  // Ask for a title/notes for the new seeded set
  const resp = await promptTwoInputs(
    "Seed From System",
    "Set name (optional):",
    "Notes (optional):",
    "",
    ""
  );
  if (!resp) return; // cancelled

  const title = resp.name || `Seed ${from} to ${to}`;
  const note = resp.notes || null;

  const { data, error } = await supabase.rpc("manual_plan_seed_from_system", {
    p_title: title,
    p_note: note,
    p_from: from,
    p_to: to,
  });
  if (error) {
    console.error(error);
    showModal("Seed failed.");
    return;
  }

  const newId = data; // function returns bigint id
  await loadSets();
  ["selSets", "selSetForLines", "selSetForReconcile"].forEach((id) => {
    const sel = $(id);
    if (sel) sel.value = newId;
  });
  showModal(`Seed created set #${newId}`, "Seed");
}

/* ========== lines ========== */
async function loadLines() {
  const setId = Number($("selSetForLines").value);
  const tbody = $("linesTable").querySelector("tbody");
  tbody.innerHTML = "";
  if (!setId) {
    $("linesStatus").innerHTML = chip("Pick a set");
    return;
  }

  const { data, error } = await supabase
    .from("manual_plan_lines")
    .select("id,product_id,month_start,proposed_qty,note,updated_at")
    .eq("set_id", setId)
    .order("product_id")
    .order("month_start");
  if (error) {
    console.error(error);
    $("linesStatus").innerHTML = chip("Load error", "err");
    return;
  }

  // Render product names instead of raw product_id. We'll fetch product names in bulk
  const lines = data || [];
  const pids = [
    ...new Set(lines.map((r) => Number(r.product_id)).filter(Boolean)),
  ];
  let prodMap = new Map();
  if (pids.length) {
    try {
      const { data: prods, error: perr } = await supabase
        .from("products")
        .select("id,item")
        .in("id", pids);
      if (!perr && prods)
        prodMap = new Map(prods.map((p) => [Number(p.id), p.item]));
    } catch (e) {
      console.error("Failed to load product names", e);
    }
  }

  lines.forEach((r) => {
    const tr = document.createElement("tr");
    tr.dataset.id = r.id;
    // keep numeric product_id on the row dataset so saves can use it even though we show name
    tr.dataset.productId = r.product_id ?? "";
    const productName = prodMap.get(Number(r.product_id)) ?? r.product_id ?? "";
    tr.innerHTML = `
      <td><input type="checkbox" class="rowChk"/></td>
      <td data-col="product_id">${productName}</td>
      <td contenteditable="true" data-col="month_start">${
        r.month_start ?? ""
      }</td>
      <td contenteditable="true" data-col="proposed_qty">${
        r.proposed_qty ?? ""
      }</td>
      <td contenteditable="true" data-col="note">${r.note ?? ""}</td>
      <td class="muted small">${r.updated_at ?? ""}</td>
    `;
    // save-on-blur (only for editable cells)
    tr.querySelectorAll("[contenteditable]").forEach((cell) => {
      cell.addEventListener("blur", () => saveLineEdit(tr));
    });
    tbody.appendChild(tr);
  });
  $("linesStatus").innerHTML = chip(`${data.length} rows`);
  $("chkAll").checked = false;
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
  // month_start format guard: expect YYYY-MM-01
  if (row.month_start && !/^\d{4}-\d{2}-\d{2}$/.test(row.month_start)) {
    showModal("month_start must be YYYY-MM-DD (usually YYYY-MM-01).");
    return;
  }
  const { error } = await supabase
    .from("manual_plan_lines")
    .update(row)
    .eq("id", id);
  if (error) {
    console.error(error);
    $("linesStatus").innerHTML = chip("Save error", "err");
    return;
  }
  $("linesStatus").innerHTML = chip("Saved", "ok");
}

async function addLine() {
  const setId = Number($("selSetForLines").value);
  if (!setId) return showModal("Pick a set first.");
  const vals = await promptLineFields();
  if (!vals) return; // cancelled
  const product_id = Number(vals.product_id) || null;
  const month_start = vals.month_start;
  const proposed_qty =
    vals.proposed_qty === "" ? null : Number(vals.proposed_qty);
  const note = vals.note || null;
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
  const setId = Number($("selSetForLines").value);
  if (!setId) return showModal("Pick a set first.");
  const ids = [...document.querySelectorAll(".rowChk:checked")].map((ch) =>
    Number(ch.closest("tr").dataset.id)
  );
  if (!ids.length) return showModal("Select rows to delete.");
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
$("chkAll")?.addEventListener("change", (e) => {
  const on = e.currentTarget.checked;
  document.querySelectorAll(".rowChk").forEach((ch) => (ch.checked = on));
});

function toCSV(rows) {
  if (!rows.length) return "";
  const cols = Object.keys(rows[0]);
  const esc = (v) => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const head = cols.join(",");
  const body = rows.map((r) => cols.map((c) => esc(r[c])).join(",")).join("\n");
  return head + "\n" + body;
}
function download(name, text, mime = "text/csv") {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), {
    href: url,
    download: name,
  });
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function exportLines() {
  const setId = Number($("selSetForLines").value);
  if (!setId) return showModal("Pick a set first.");
  const { data, error } = await supabase
    .from("manual_plan_lines")
    .select("set_id,product_id,month_start,proposed_qty,note,updated_at")
    .eq("set_id", setId)
    .order("product_id")
    .order("month_start");
  if (error) {
    console.error(error);
    return showModal("Export failed.");
  }
  download(`manual_set_${setId}.csv`, toCSV(data || []));
}

async function importLines() {
  const setId = Number($("selSetForLines").value);
  if (!setId) return showModal("Pick a set first.");
  const file = $("fileImportLines").files?.[0];
  if (!file) return showModal("Pick a CSV file.");
  const text = await file.text();
  const rows = parseCsv(text);
  // Expect columns: product_id,month_start,proposed_qty,note
  const need = ["product_id", "month_start", "proposed_qty"];
  const miss = need.filter((n) => !rows.header.includes(n));
  if (miss.length) return showModal(`CSV missing: ${miss.join(", ")}`);
  // map
  const payload = rows.rows
    .map((r) => ({
      set_id: setId,
      product_id: Number(r.product_id) || null,
      month_start: r.month_start,
      proposed_qty: r.proposed_qty === "" ? null : Number(r.proposed_qty),
      note: r.note || null,
    }))
    .filter((x) => x.product_id && x.month_start);
  // insert in chunks
  const CH = 500;
  for (let i = 0; i < payload.length; i += CH) {
    const slice = payload.slice(i, i + CH);
    const { error } = await supabase.from("manual_plan_lines").insert(slice);
    if (error) {
      console.error(error);
      return showModal("Import failed mid-way.");
    }
  }
  await loadLines();
  showModal(`Imported ${payload.length} rows.`, "Import");
}

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (!lines.length) return { header: [], rows: [] };
  const header = lines[0].split(",").map((h) => h.trim());
  const rows = lines.slice(1).map((line) => {
    const cols = [];
    let cur = "";
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQ && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else inQ = !inQ;
      } else if (ch === "," && !inQ) {
        cols.push(cur);
        cur = "";
      } else {
        cur += ch;
      }
    }
    cols.push(cur);
    const obj = {};
    header.forEach((h, idx) => (obj[h] = (cols[idx] ?? "").trim()));
    return obj;
  });
  return { header, rows };
}

/* ========== reconcile & apply ========== */
// ─── Reconciliation helpers ─────────────────────────────────────
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

async function loadManualSetsInto(selId = "reconSet") {
  const sel = document.getElementById(selId);
  if (!sel) return;
  sel.innerHTML = `<option value="">(choose a set)</option>`;
  const { data, error } = await supabase
    .from("manual_plan_sets")
    .select("id,title,status,created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) {
    console.error(error);
    return;
  }
  (data || []).forEach((r) => {
    const opt = document.createElement("option");
    opt.value = r.id;
    opt.textContent = `#${r.id} · ${r.title} (${r.status})`;
    sel.appendChild(opt);
  });
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

async function loadRecon() {
  const selEl = document.getElementById("reconSet");
  const setId = Number(selEl?.value);
  const from = document.getElementById("reconFrom").value;
  const to = document.getElementById("reconTo").value;
  const status = document.getElementById("reconStatus");
  const body = document.querySelector("#reconTable tbody");
  const sumEl = document.getElementById("reconSummary");
  body.innerHTML = "";
  if (status) status.textContent = "Loading…";
  if (sumEl) sumEl.textContent = "";

  if (!setId || !from || !to) {
    if (status) status.textContent = "Pick Set, From, To.";
    return;
  }

  // Call the function
  const { data, error } = await supabase.rpc("supply_recon_for_set", {
    p_set_id: setId,
    p_from: from,
    p_to: to,
  });

  if (error) {
    console.error(error);
    if (status) status.textContent = "Error";
    return;
  }
  // DEBUG: inspect returned shape to ensure expected fields (reason_text etc.)
  try {
    console.debug(
      "supply_recon_for_set returned rows:",
      Array.isArray(data) ? data.length : typeof data,
      data
    );
    if (Array.isArray(data) && data.length) {
      console.debug("first row keys:", Object.keys(data[0]));
    }
  } catch (e) {
    console.debug("debug inspect failed", e);
  }
  const includeEmpty = document.getElementById("reconShowEmpty")?.checked;
  const rows = (data || []).filter((r) =>
    includeEmpty
      ? true
      : !(Number(r.manual_qty || 0) === 0 && Number(r.system_qty || 0) === 0)
  );

  let needed = 0,
    manual = 0,
    sys = 0,
    stock = 0;

  rows.forEach((r) => {
    const tr = document.createElement("tr");

    const tdPid = document.createElement("td");
    tdPid.textContent = r.product_id;
    tr.appendChild(tdPid);

    const tdItem = document.createElement("td");
    tdItem.textContent = r.item;
    tr.appendChild(tdItem);

    const tdUom = document.createElement("td");
    tdUom.textContent = r.uom_base;
    tr.appendChild(tdUom);

    const tdMonth = document.createElement("td");
    tdMonth.textContent = r.month_start;
    tr.appendChild(tdMonth);

    const tdManual = document.createElement("td");
    tdManual.textContent = pretty(r.manual_qty);
    tr.appendChild(tdManual);

    const tdSystem = document.createElement("td");
    tdSystem.textContent = pretty(r.system_qty);
    tr.appendChild(tdSystem);

    const tdDelta = document.createElement("td");
    tdDelta.textContent = pretty(r.delta_qty);
    tr.appendChild(tdDelta);

    const tdBottled = document.createElement("td");
    tdBottled.textContent = pretty(r.bottled_qty_base);
    tr.appendChild(tdBottled);

    const tdFGBulk = document.createElement("td");
    tdFGBulk.textContent = pretty(r.fg_bulk_qty_base);
    tr.appendChild(tdFGBulk);

    const tdWip = document.createElement("td");
    tdWip.textContent = pretty(r.wip_qty_base);
    tr.appendChild(tdWip);

    const tdBmr = document.createElement("td");
    tdBmr.textContent = r.bmr_not_initiated_cnt ?? 0;
    tr.appendChild(tdBmr);

    const tdNeeded = document.createElement("td");
    tdNeeded.textContent = r.is_manual_needed ? "✓" : "";
    tr.appendChild(tdNeeded);

    const tdReason = document.createElement("td");
    tdReason.className = "small";
    // Defensive access: some DBs may return reason_text under a different key; try common alternatives
    const reasonSource =
      r.reason_text ?? r.reason ?? r.reasonText ?? r.reason_detail ?? null;
    // If the RPC didn't provide the expected fields, include a JSON snippet for debugging (trimmed)
    tdReason.textContent = reasonWithDetails({
      reason_text: reasonSource,
      bottled_batches: r.bottled_batches,
      fg_bulk_batches: r.fg_bulk_batches,
      wip_batches: r.wip_batches,
      bmr_batches: r.bmr_batches,
    });
    tr.appendChild(tdReason);

    body.appendChild(tr);

    if (r.is_manual_needed) needed++;
    manual += Number(r.manual_qty || 0);
    sys += Number(r.system_qty || 0);
    stock +=
      Number(r.bottled_qty_base || 0) +
      Number(r.fg_bulk_qty_base || 0) +
      Number(r.wip_qty_base || 0);
  });

  if (status) status.textContent = `${rows.length} rows`;
  if (sumEl)
    sumEl.innerHTML = `
    ${chip("Needed rows: " + needed, needed ? "warn" : "ok")}
    ${chip("Manual total: " + manual.toFixed(2))}
    ${chip("System total: " + sys.toFixed(2))}
    ${chip("Stock sum: " + stock.toFixed(2))}
  `;

  // stash for export/apply
  window.__reconRows = rows;
}

function exportReconCSV() {
  const rows = window.__reconRows || [];
  const csv = reconToCSV(rows);
  if (!csv) return showToast("Nothing to export");
  download("supply_reconciliation.csv", csv);
}

async function applyReconAsOverrides() {
  const setId = Number(document.getElementById("reconSet").value);
  const from = document.getElementById("reconFrom").value;
  const to = document.getElementById("reconTo").value;
  const thr = Number(document.getElementById("reconThresh").value || 0);
  if (!setId || !from || !to) return showToast("Pick Set/From/To");

  try {
    // 1) Compute deltas into staging, respecting threshold & WIP/BMR rules
    let { data: resp1, error: e1 } = await supabase.rpc(
      "apply_manual_plan_set",
      { p_set_id: setId, p_from: from, p_to: to, p_threshold: thr }
    );
    if (e1) throw e1;
    const [ins1, upd1, deact1] = resp1 || [0, 0, 0];

    // 2) Promote to active overrides (upsert)
    let { data: resp2, error: e2 } = await supabase.rpc(
      "apply_production_overrides",
      { p_from: from, p_to: to }
    );
    if (e2) throw e2;
    const [ins2, upd2, deact2] = resp2 || [0, 0, 0];

    showToast(
      `Staging: +${ins1}/${upd1}/${deact1} → Overrides: +${ins2}/${upd2}/${deact2}`
    );
  } catch (err) {
    console.error(err);
    showToast("Apply failed — see console");
  }
}

// end reconciliation helpers

async function previewReconcile() {
  const setId = Number($("selSetForReconcile").value);
  const from = $("rcFrom").value;
  const to = $("rcTo").value;
  if (!setId || !from || !to) return showModal("Pick set and window.");

  // Pull “manual vs system” (either use v_manual_vs_system if you created it,
  // or compute here by joining manual_plan_lines to v_product_bulk_consolidated_effective)
  const { data: manual } = await supabase
    .from("manual_plan_lines")
    .select("product_id,month_start,proposed_qty")
    .eq("set_id", setId)
    .gte("month_start", from)
    .lte("month_start", to);

  const { data: system } = await supabase
    .from("v_product_bulk_consolidated_effective")
    .select("product_id,month_start,final_make_qty");

  const key = (r) => `${r.product_id}|${r.month_start}`;
  const sysMap = new Map(
    (system || []).map((r) => [key(r), Number(r.final_make_qty || 0)])
  );
  // Optional WIP info for visual flag
  const { data: wips } = await supabase
    .from("v_fg_wip_stock_on_hand")
    .select("product_id");

  const wipSet = new Set((wips || []).map((r) => Number(r.product_id)));

  // union of keys in window
  const keys = new Set();
  (manual || []).forEach((r) => keys.add(key(r)));
  (system || []).forEach((r) => {
    if (r.month_start >= from && r.month_start <= to) keys.add(key(r));
  });

  const rows = [];
  keys.forEach((k) => {
    const [pid, m] = k.split("|");
    const man = (manual || []).find(
      (r) => r.product_id == pid && r.month_start === m
    );
    const sys = sysMap.get(k) ?? 0;
    const prop = man?.proposed_qty ?? 0;
    rows.push({
      product_id: Number(pid),
      month_start: m,
      system_qty: sys,
      proposed_qty: prop,
      delta_qty: Number(prop) - Number(sys),
      is_wip: wipSet.has(Number(pid)) ? "yes" : "no",
    });
  });

  rows.sort(
    (a, b) =>
      a.product_id - b.product_id || a.month_start.localeCompare(b.month_start)
  );
  const tbody = $("rcTable").querySelector("tbody");
  tbody.innerHTML = "";
  rows.forEach((r) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${r.product_id}</td>
      <td>${r.month_start}</td>
      <td>${r.system_qty}</td>
      <td>${r.proposed_qty}</td>
      <td>${r.delta_qty}</td>
      <td>${r.is_wip}</td>
    `;
    tbody.appendChild(tr);
  });
  $("rcStatus").textContent = `${rows.length} rows previewed`;
}

async function applyReconcile() {
  const setId = Number($("selSetForReconcile").value);
  const from = $("rcFrom").value;
  const to = $("rcTo").value;
  const thr = Number($("rcThreshold").value || 0);
  if (!setId || !from || !to) return showModal("Pick set and window.");

  // This function: inserts deltas to production_overrides_staging, then calls apply_production_overrides
  const { data, error } = await supabase.rpc("apply_manual_plan_set", {
    p_set_id: setId,
    p_from: from,
    p_to: to,
    p_threshold: thr,
  });
  if (error) {
    console.error(error);
    return showModal("Apply failed.");
  }

  // data likely = [inserted, updated, deactivated] or with a 4th value (skipped_wip)
  let ins = 0,
    upd = 0,
    deact = 0,
    skipped = 0;
  if (Array.isArray(data)) {
    [ins, upd, deact, skipped] = data.concat([0, 0, 0, 0]).slice(0, 4);
  } else if (data && typeof data === "object") {
    ins = data.inserted_count ?? 0;
    upd = data.updated_count ?? 0;
    deact = data.deactivated_count ?? 0;
    skipped = data.skipped_wip_count ?? 0;
  }
  showModal(
    `Overrides applied:<br>` +
      `${ins} inserted, ${upd} updated, ${deact} deactivated` +
      (skipped ? `<br>${skipped} rows skipped due to WIP` : ""),
    "Apply"
  );
}

/* ========== active overrides ========== */
async function loadActiveOverrides() {
  const from = $("aoFrom").value;
  const to = $("aoTo").value;
  let q = supabase
    .from("production_qty_overrides")
    .select(
      "product_id,month_start,delta_units,reason,is_active,created_at,updated_at"
    )
    .order("product_id")
    .order("month_start");
  if (from) q = q.gte("month_start", from);
  if (to) q = q.lte("month_start", to);
  const { data, error } = await q;
  if (error) {
    console.error(error);
    $("aoStatus").textContent = "Error";
    return;
  }
  const tbody = $("aoTable").querySelector("tbody");
  tbody.innerHTML = "";
  (data || []).forEach((r) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${r.product_id}</td>
      <td>${r.month_start}</td>
      <td>${r.delta_units}</td>
      <td>${r.reason ?? ""}</td>
      <td>${r.is_active ? "true" : "false"}</td>
      <td>${r.created_at ?? ""}</td>
      <td>${r.updated_at ?? ""}</td>
    `;
    tbody.appendChild(tr);
  });
  $("aoStatus").textContent = `${data?.length ?? 0} rows`;
}
function exportActive() {
  const rows = [];
  const thead = $("aoTable").querySelector("thead");
  const cols = [...thead.querySelectorAll("th")].map((th) => th.textContent);
  const body = $("aoTable").querySelector("tbody");
  [...body.querySelectorAll("tr")].forEach((tr) => {
    const obj = {};
    [...tr.children].forEach((td, i) => (obj[cols[i]] = td.textContent));
    rows.push(obj);
  });
  const csv = toCSV(rows);
  download("production_overrides_active.csv", csv);
}

/* ========== wire up ========== */
function wireReconTab() {
  const start = fenceStart(new Date());
  const end = addMonths(start, 3);
  const fromEl = document.getElementById("reconFrom");
  const toEl = document.getElementById("reconTo");
  if (fromEl) fromEl.value = fmtDate(start);
  if (toEl) toEl.value = fmtDate(addMonths(end, -1));

  loadManualSetsInto();

  const btnLoad = document.getElementById("btnReconLoad");
  const btnExport = document.getElementById("btnReconExport");
  const btnApply = document.getElementById("btnReconApply");
  if (btnLoad) btnLoad.addEventListener("click", loadRecon);
  if (btnExport) btnExport.addEventListener("click", exportReconCSV);
  if (btnApply) btnApply.addEventListener("click", applyReconAsOverrides);
}

function wire() {
  // tabs have been set up separately
  $("btnCreateSet").addEventListener("click", createSet);
  $("btnSeedSet").addEventListener("click", seedSet);

  $("selSetForLines").addEventListener("change", loadLines);
  $("btnAddLine").addEventListener("click", addLine);
  $("btnDeleteSelected").addEventListener("click", deleteSelectedLines);
  $("btnExportLines").addEventListener("click", exportLines);
  $("btnImportLines").addEventListener("click", importLines);

  $("btnPreviewReconcile").addEventListener("click", previewReconcile);
  $("btnApplyReconcile").addEventListener("click", applyReconcile);
  // recon
  $("btnReconLoad")?.addEventListener("click", loadRecon);
  $("btnReconExport")?.addEventListener("click", exportReconCSV);
  $("btnReconApply")?.addEventListener("click", applyReconAsOverrides);

  $("btnLoadActive").addEventListener("click", loadActiveOverrides);
  $("btnExportActive").addEventListener("click", exportActive);

  $("selSets").addEventListener("change", () => {
    const v = $("selSets").value;
    if (v) {
      $("selSetForLines").value = v;
      $("selSetForReconcile").value = v;
      loadLines();
    }
  });

  // recon wiring (initialize fields and listeners)
  try {
    wireReconTab();
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
(async function boot() {
  const user = await ensureAuth();
  if (!user) return;

  setupTabs();
  wire();
  await loadSets();
  // populate recon set dropdown
  await loadManualSetsInto("reconSet");
})();
