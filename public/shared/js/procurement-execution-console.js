// public/shared/js/procurement-execution-console.js
import { supabase } from "./supabaseClient.js";
import { Platform } from "./platform.js";

// ─── View / RPC name constants (adjust here if DB names differ) ───────────────
const VENDOR_UNMAPPED_VIEW = "v_proc_vendor_alias_unmapped_queue";
const RPC_VENDOR_CREATE_AND_MAP = "proc_vendor_create_and_map_alias";
const RPC_VENDOR_MAP_ALIAS = "proc_vendor_map_alias";
const PR_HEADER_VIEW = "v_proc_pr_header";
const PR_LINES_VIEW = "v_proc_pr_lines";

const state = {
  tab: "action",
  // action queue
  page: 0,
  pageSize: 30,
  rows: [],
  selected: null,
  // PR tab
  prPage: 0,
  prRows: [],
  selectedPr: null,
  prLinesRows: [],
  // indents tab
  indentsPage: 0,
  indentsRows: [],
  selectedIndent: null,
  indentLinesRows: [],
  selectedIndentLine: null,
  // excess tab
  excessPage: 0,
  excessRows: [],
  excessAuditRows: [],
  // vendor tab
  vendorsPage: 0,
  vendorsRows: [],
  vendorList: [],
};

function qs(id) {
  return document.getElementById(id);
}

// ─── Icon helper ─────────────────────────────────────────────────────────────
const _svgPaths = {
  plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  refresh:
    '<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>',
  arrowRight:
    '<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>',
  wand: '<path d="M15 4V2"/><path d="M15 16v-2"/><path d="M8 9h2"/><path d="M20 9h2"/><path d="M17.8 11.8 19 13"/><path d="M15 9h0"/><path d="M17.8 6.2 11 5"/><path d="M3 21l9-9"/><path d="M12.2 6.2 11 5"/>',
  check: '<polyline points="20 6 9 17 4 12"/>',
  x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
  document:
    '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/>',
};

function iconSvg(name, size = 14) {
  const paths = _svgPaths[name] ?? "";
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" style="vertical-align:-2px;margin-right:4px">${paths}</svg>`;
}

async function requireSession() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) window.location.href = "../../login.html";
}

function setTab(tab) {
  state.tab = tab;
  document
    .querySelectorAll(".tab-btn")
    .forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
  document
    .querySelectorAll(".tab-panel")
    .forEach((p) => p.classList.remove("active"));
  qs(`tab-${tab}`).classList.add("active");
  // lazy-load tab data on each visit
  if (tab === "pr") loadPrHeaders();
  if (tab === "indents") loadIndents();
  if (tab === "excess") {
    loadExcess();
    loadExcessAudit();
  }
  if (tab === "vendors") loadUnmappedAliases();
}

function fmt(n) {
  if (n === null || n === undefined) return "";
  const x = Number(n);
  if (Number.isNaN(x)) return String(n);
  return x.toLocaleString(undefined, { maximumFractionDigits: 6 });
}

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function setLoading(active) {
  const panel = qs("mainPanel");
  if (!panel) return;
  panel.style.opacity = active ? "0.6" : "";
  panel.style.pointerEvents = active ? "none" : "";
}

function toast(msg, type = "info") {
  const c = qs("toastContainer");
  if (!c) return;
  const div = document.createElement("div");
  div.textContent = msg;
  const bg =
    type === "error" ? "#c0392b" : type === "success" ? "#27ae60" : "#34495e";
  div.style.cssText = `background:${bg};color:#fff;padding:10px 14px;border-radius:10px;font-size:13px;pointer-events:auto;box-shadow:0 2px 8px rgba(0,0,0,.2);opacity:1;transition:opacity .4s;`;
  c.appendChild(div);
  setTimeout(() => {
    div.style.opacity = "0";
  }, 3000);
  setTimeout(() => div.remove(), 3500);
}

// ─── Detail modal helpers ────────────────────────────────────────────────────

function fmtValue(v) {
  if (v === null || v === undefined) return "-";
  const n = Number(v);
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (!Number.isNaN(n) && typeof v !== "string") {
    return n.toLocaleString(undefined, { maximumFractionDigits: 6 });
  }
  return esc(String(v));
}

function toHtmlTableFromPairs(pairs) {
  if (!pairs.length) return '<span class="muted">—</span>';
  const rows = pairs
    .map(
      ([k, v]) =>
        `<tr><td class="key">${esc(k)}</td><td>${fmtValue(v)}</td></tr>`,
    )
    .join("");
  return `<table class="kv-table">${rows}</table>`;
}

function parseEvidence(evidence) {
  if (!evidence || !Array.isArray(evidence) || !evidence.length) {
    return '<span class="muted">No evidence.</span>';
  }
  const rows = evidence
    .map((e) => {
      const source = esc(e.source ?? e.source_system ?? "-");
      const meta = e.meta ?? e;
      const metaStr = Object.entries(meta)
        .filter(([k]) => k !== "source" && k !== "source_system")
        .map(([k, v]) => `${esc(k)}: ${fmtValue(v)}`)
        .join(" · ");
      return `<tr><td class="key">${source}</td><td>${metaStr || "-"}</td></tr>`;
    })
    .join("");
  return `<table class="kv-table">${rows}</table>`;
}

function openDetailModal(row) {
  state.selected = row;

  // header
  qs("detailModalTitle").textContent =
    `${row.indent_number ?? ""} — ${row.stock_item_name ?? ""}`;
  qs("detailBand").textContent = `Band: ${row.priority_band_final ?? "-"}`;
  qs("detailBand").style.display = row.priority_band_final ? "" : "none";
  qs("detailMos").textContent = `MOS: ${row.mos_months ?? "-"}`;
  qs("detailMos").style.display = row.mos_months != null ? "" : "none";
  qs("detailLead").textContent = `Lead: ${row.lead_time_days ?? 0} d`;
  qs("detailLead").style.display = row.lead_time_days != null ? "" : "none";

  // summary table
  qs("detailSummary").innerHTML = toHtmlTableFromPairs(
    [
      ["Indent #", row.indent_number],
      ["Item", row.stock_item_name],
      ["Class", row.material_class_code],
      ["UOM", row.uom_code],
      ["Requested Qty", row.requested_qty ?? row.indent_qty],
      ["Allocated Qty", row.allocated_qty],
      ["Remaining Qty", row.remaining_qty],
      ["Priority Band", row.priority_band_final],
      ["Priority Score", row.priority_score_system],
      ["MOS (months)", row.mos_months],
      ["Lead Time (days)", row.lead_time_days],
      ["Approved Date", row.approved_date],
      ["Status", row.status],
    ].filter(([, v]) => v !== undefined && v !== null && v !== ""),
  );

  // priority factors table
  const why = row.priority_why ?? {};
  const priorityPairs = [];
  if (why.components && typeof why.components === "object") {
    for (const [k, v] of Object.entries(why.components)) {
      priorityPairs.push([k, v]);
    }
  }
  [
    ["aging_days", why.aging_days ?? row.aging_days],
    ["stock_qty", why.stock_qty ?? row.stock_qty],
    ["avg_monthly_6m", why.avg_monthly_6m ?? row.avg_monthly_6m],
    ["prod_pull_score", why.prod_pull_score ?? row.prod_pull_score],
    ["net_excess_qty", why.net_excess_qty ?? row.net_excess_qty],
  ].forEach(([k, v]) => {
    if (v !== undefined && v !== null) priorityPairs.push([k, v]);
  });
  qs("detailPriority").innerHTML = toHtmlTableFromPairs(priorityPairs);

  // vendor decision table
  const recName =
    row.recommended_vendor_name ??
    (row.recommended_vendor_id ? `ID ${row.recommended_vendor_id}` : null);
  const vendorPairs = [
    ["Recommended Vendor", recName ?? row.l1_vendor_name],
    ["Recommended Rate", row.recommended_rate ?? row.l1_rate_value],
    [
      "Selected Vendor",
      row.selected_vendor_id ? `ID ${row.selected_vendor_id}` : null,
    ],
    ["Selected Rate", row.selected_rate],
    ["Selection Reason", row.selection_reason],
  ].filter(([, v]) => v !== undefined && v !== null && v !== "");
  qs("detailVendor").innerHTML = toHtmlTableFromPairs(vendorPairs);

  // evidence list
  qs("detailEvidenceList").innerHTML = parseEvidence(row.l1_evidence);

  // open
  const backdrop = qs("detailModalBackdrop");
  backdrop.classList.add("show");
  backdrop.setAttribute("aria-hidden", "false");
  // scroll body back to top
  const body = qs("detailModalBody");
  if (body) body.scrollTop = 0;
  // focus close button
  requestAnimationFrame(() => qs("btnDetailClose")?.focus());
}

function closeDetailModal() {
  const backdrop = qs("detailModalBackdrop");
  backdrop.classList.remove("show");
  backdrop.setAttribute("aria-hidden", "true");
}

// Keep renderDetail as alias so any future callers still work
function renderDetail(row) {
  openDetailModal(row);
}

// ─── Tab count badges ───────────────────────────────────────────────────────

function updateTabCount(id, n) {
  const el = qs(id);
  if (!el) return;
  el.textContent = n > 0 ? String(n) : "";
}

async function refreshAllTabCounts() {
  const [indents, pr, excess, vendors] = await Promise.allSettled([
    supabase
      .from("v_proc_indent_console")
      .select("*", { count: "exact" })
      .limit(1),
    supabase.from(PR_HEADER_VIEW).select("*", { count: "exact" }).limit(1),
    supabase
      .from("v_proc_purchase_excess_console")
      .select("*", { count: "exact" })
      .limit(1),
    supabase
      .from(VENDOR_UNMAPPED_VIEW)
      .select("*", { count: "exact" })
      .limit(1),
  ]);
  if (indents.status === "fulfilled")
    updateTabCount("tabCountIndents", indents.value.count ?? 0);
  if (pr.status === "fulfilled")
    updateTabCount("tabCountPr", pr.value.count ?? 0);
  if (excess.status === "fulfilled")
    updateTabCount("tabCountExcess", excess.value.count ?? 0);
  if (vendors.status === "fulfilled")
    updateTabCount("tabCountVendors", vendors.value.count ?? 0);
}

// ─── Jump to Indent (Part C) ─────────────────────────────────────────────────

async function jumpToIndent(indentId) {
  setTab("indents");
  qs("iStatus").value = "";
  qs("iClass").value = "";
  qs("iSearch").value = "";
  state.indentsPage = 0;
  await loadIndents();
  if (!indentId) return;
  const found = state.indentsRows.find((r) => r.indent_id === indentId);
  if (found) {
    renderIndents();
    openIndentViewModal(found);
  }
}

function renderRows() {
  const tbody = qs("aqTbody");
  tbody.innerHTML = "";

  for (const row of state.rows) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>
        <div>${row.indent_number}</div>
        <div class="muted">${row.approved_date ?? ""}</div>
      </td>
      <td>
        <div><b>${row.stock_item_name}</b></div>
        <div class="muted">${row.material_class_code ?? ""} • ${row.uom_code ?? ""}</div>
      </td>
      <td>${fmt(row.remaining_qty)}</td>
      <td>
        <span class="pill">${row.priority_band_final ?? "-"}</span>
        <div class="muted">${fmt(row.priority_score_system)}</div>
      </td>
      <td>
        <div>${row.l1_vendor_name ?? "-"}</div>
        <div class="muted">${row.l1_rate_value ? fmt(row.l1_rate_value) : ""}</div>
      </td>
      <td class="row-actions">
        <button data-act="select">${iconSvg("check")}Select</button>
        <button data-act="recommend">${iconSvg("wand")}Recommend</button>
        <button data-act="jump">${iconSvg("arrowRight")}Indent</button>
      </td>
    `;

    tr.addEventListener("click", (e) => {
      const btn = e.target.closest("button");
      if (btn) return; // handled below
      renderDetail(row);
    });

    tr.querySelector('[data-act="recommend"]').addEventListener(
      "click",
      async (e) => {
        e.stopPropagation();
        await doRecommend(row.indent_line_id);
      },
    );

    tr.querySelector('[data-act="select"]').addEventListener("click", (e) => {
      e.stopPropagation();
      openVendorModal(row);
    });

    tr.querySelector('[data-act="jump"]').addEventListener("click", (e) => {
      e.stopPropagation();
      jumpToIndent(row.indent_id ?? row.indent_line_id);
    });

    tbody.appendChild(tr);
  }

  qs("aqMeta").textContent = `Showing ${state.rows.length} lines`;
  qs("aqPaging").textContent = `Page ${state.page + 1}`;
  updateTabCount("tabCountAction", state.rows.length);
}

function buildActionQueueQuery() {
  let q = supabase.from("v_proc_procurement_action_queue").select("*");

  const band = qs("fBand").value;
  const cls = qs("fClass").value;
  const search = (qs("fSearch").value || "").trim();
  const needs = qs("fNeeds").value;

  if (band) q = q.eq("priority_band_final", band);
  if (cls) q = q.eq("material_class_id", Number(cls));

  if (needs === "needs_vendor") q = q.eq("has_vendor_candidates", false);
  if (needs === "needs_selection") q = q.eq("has_selected_vendor", false);
  if (needs === "has_excess") q = q.eq("has_net_excess", true);

  if (search) {
    // broad OR search across common fields
    q = q.or(
      [
        `stock_item_name.ilike.%${search}%`,
        `indent_number.ilike.%${search}%`,
        `l1_vendor_name.ilike.%${search}%`,
      ].join(","),
    );
  }

  q = q
    .order("priority_band_final", { ascending: true })
    .order("priority_score_system", { ascending: false })
    .range(
      state.page * state.pageSize,
      state.page * state.pageSize + state.pageSize - 1,
    );

  return q;
}

async function loadActionQueue() {
  const { data, error } = await buildActionQueueQuery();
  if (error) {
    console.error(error);
    toast(`Failed to load Action Queue: ${error.message}`, "error");
    return;
  }
  state.rows = data || [];
  renderRows();
}

async function doRecommend(indentLineId) {
  const { error } = await supabase.rpc("proc_indent_recommend_vendor", {
    p_indent_line_id: indentLineId,
  });
  if (error) {
    toast(`Recommend failed: ${error.message}`, "error");
    return;
  }
  await loadActionQueue();
}

function openVendorModal(row) {
  const backdrop = qs("vendorModalBackdrop");
  backdrop.classList.add("show");
  backdrop.setAttribute("aria-hidden", "false");

  qs("vendorModalItem").textContent =
    `${row.stock_item_name} (${row.indent_number})`;

  const pick = qs("vendorPick");
  pick.innerHTML = "";

  const options = [];
  if (row.l1_vendor_id)
    options.push({
      id: row.l1_vendor_id,
      name: row.l1_vendor_name,
      rate: row.l1_rate_value,
      tag: "L1",
    });
  if (row.l2_vendor_id)
    options.push({
      id: row.l2_vendor_id,
      name: row.l2_vendor_name,
      rate: row.l2_rate_value,
      tag: "L2",
    });
  if (row.l3_vendor_id)
    options.push({
      id: row.l3_vendor_id,
      name: row.l3_vendor_name,
      rate: row.l3_rate_value,
      tag: "L3",
    });

  if (!options.length) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "No candidates (map vendors / rate book first)";
    pick.appendChild(opt);
    qs("vendorRate").value = "";
  } else {
    for (const o of options) {
      const opt = document.createElement("option");
      opt.value = String(o.id);
      opt.textContent = `${o.tag}: ${o.name}${o.rate ? ` @ ${fmt(o.rate)}` : ""}`;
      opt.dataset.rate = o.rate ?? "";
      pick.appendChild(opt);
    }
    qs("vendorRate").value = pick.options[0].dataset.rate || "";
  }

  pick.onchange = () => {
    const selected = pick.options[pick.selectedIndex];
    qs("vendorRate").value = selected?.dataset?.rate || "";
  };

  qs("vendorReason").value = "";
  backdrop.dataset.indentLineId = String(row.indent_line_id);
  backdrop.dataset.recommendedVendorId = String(
    row.recommended_vendor_id ?? "",
  );
}

function closeVendorModal() {
  const backdrop = qs("vendorModalBackdrop");
  backdrop.classList.remove("show");
  backdrop.setAttribute("aria-hidden", "true");
}

async function saveVendorSelection() {
  const backdrop = qs("vendorModalBackdrop");
  const indentLineId = Number(backdrop.dataset.indentLineId);
  const recommendedVendorId = backdrop.dataset.recommendedVendorId
    ? Number(backdrop.dataset.recommendedVendorId)
    : null;

  const vendorId = Number(qs("vendorPick").value || 0);
  if (!vendorId) {
    toast("No vendor selected.", "error");
    return;
  }

  const rateText = (qs("vendorRate").value || "").trim();
  const rate = rateText ? Number(rateText) : null;
  const reason = (qs("vendorReason").value || "").trim() || null;

  // Client-side hint (server already enforces)
  if (recommendedVendorId && vendorId !== recommendedVendorId && !reason) {
    toast(
      "Reason required when selecting a vendor different from recommendation.",
      "error",
    );
    return;
  }

  const { error } = await supabase.rpc("proc_indent_set_vendor_selection", {
    p_indent_line_id: indentLineId,
    p_selected_vendor_id: vendorId,
    p_selected_rate: rate,
    p_reason: reason,
  });

  if (error) {
    toast(`Selection failed: ${error.message}`, "error");
    return;
  }

  closeVendorModal();
  await loadActionQueue();
}

function wireTabs() {
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => setTab(btn.dataset.tab));
  });
}

function wireActionQueueControls() {
  qs("btnRefresh").addEventListener("click", () => {
    state.page = 0;
    loadActionQueue();
  });
  qs("btnPrev").addEventListener("click", () => {
    state.page = Math.max(0, state.page - 1);
    loadActionQueue();
  });
  qs("btnNext").addEventListener("click", () => {
    state.page += 1;
    loadActionQueue();
  });

  ["fBand", "fClass", "fNeeds"].forEach((id) =>
    qs(id).addEventListener("change", () => {
      state.page = 0;
      loadActionQueue();
    }),
  );
  qs("fSearch").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      state.page = 0;
      loadActionQueue();
    }
  });

  qs("btnVendorCancel").addEventListener("click", closeVendorModal);
  qs("btnVendorSave").addEventListener("click", saveVendorSelection);

  // click outside modal closes
  qs("vendorModalBackdrop").addEventListener("click", (e) => {
    if (e.target.id === "vendorModalBackdrop") closeVendorModal();
  });

  // detail modal close
  qs("btnDetailClose").addEventListener("click", closeDetailModal);
  qs("btnDetailClose2").addEventListener("click", closeDetailModal);
  qs("detailModalBackdrop").addEventListener("click", (e) => {
    if (e.target.id === "detailModalBackdrop") closeDetailModal();
  });
  // ESC key closes detail modal (and vendor modal)
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    const modals = [
      { id: "detailModalBackdrop", close: closeDetailModal },
      { id: "vendorModalBackdrop", close: closeVendorModal },
      { id: "indentViewModalBackdrop", close: closeIndentViewModal },
      { id: "prViewModalBackdrop", close: closePrViewModal },
      { id: "generatePrModalBackdrop", close: closeGeneratePrModal },
      { id: "prEditReqModalBackdrop", close: closePrEditRequestedModal },
      { id: "prEditDeltaModalBackdrop", close: closePrEditDeltaModal },
      { id: "prAddLineModalBackdrop", close: closePrAddLineModal },
      { id: "prSetStatusModalBackdrop", close: closePrSetStatusModal },
      { id: "createIndentModalBackdrop", close: closeCreateIndentModal },
      { id: "indentFromPrModalBackdrop", close: closeIndentFromPrModal },
      { id: "indentAddLineModalBackdrop", close: closeIndentAddLineModal },
      { id: "stockPickerModalBackdrop", close: closeStockItemPicker },
      { id: "exportIndentModalBackdrop", close: closeExportIndentModal },
    ];
    for (const m of modals) {
      if (qs(m.id)?.classList.contains("show")) {
        m.close();
        return;
      }
    }
  });
}

// ─── INDENT TAB ───────────────────────────────────────────────────────────────

function openIndentViewModal(row) {
  state.selectedIndent = row;
  state.selectedIndentLine = null;
  qs("iLinesTitle").textContent = `Lines — ${row.indent_number}`;
  qs("indentViewStatus").textContent = row.status ?? "";
  const metaParts = [];
  if (row.approved_date) metaParts.push(`Approved: ${row.approved_date}`);
  if (row.material_class_code)
    metaParts.push(`Class: ${row.material_class_code}`);
  else if (row.material_class_id)
    metaParts.push(`Class ID: ${row.material_class_id}`);
  qs("indentViewMeta").textContent = metaParts.join(" · ");
  const btnEditQty = qs("iBtnEditLineQty");
  if (btnEditQty) btnEditQty.disabled = true;
  // Update hint based on status
  const hints = {
    draft: "Draft — you can add/edit lines and approve.",
    approved: "Approved — issue to start fulfilment.",
    issued: "Issued — lines are being fulfilled.",
    closed: "Closed — read-only.",
    cancelled: "Cancelled — read-only.",
  };
  qs("indentViewHint").textContent = hints[row.status] ?? "";
  renderIndentLinesActions(row);
  qs("iLinesEmpty").style.display = "";
  qs("iLinesEmpty").textContent = "Loading lines…";
  qs("iLinesTable").style.display = "none";
  qs("iLinesTbody").innerHTML = "";
  const backdrop = qs("indentViewModalBackdrop");
  backdrop.classList.add("show");
  backdrop.setAttribute("aria-hidden", "false");
  loadIndentLines(row.indent_id);
}

function closeIndentViewModal() {
  qs("indentViewModalBackdrop").classList.remove("show");
  qs("indentViewModalBackdrop").setAttribute("aria-hidden", "true");
}

function renderIndentLinesActions(indent) {
  // show/hide action buttons in the static iLinesActions toolbar
  const container = qs("iLinesActions");
  // Remove old dynamic buttons (legacy), keep the static ones
  container
    .querySelectorAll("button.dynamic-action")
    .forEach((b) => b.remove());

  const btnAddLine = qs("iBtnAddLine");
  const btnEditQty = qs("iBtnEditLineQty");
  if (btnAddLine) btnAddLine.style.display = "";
  if (btnEditQty) {
    btnEditQty.style.display = "";
    btnEditQty.disabled = !state.selectedIndentLine;
  }

  // Status action buttons (approve / issue / close) — rendered dynamically
  const btnStyle =
    "padding:6px 12px;border:1px solid rgba(0,0,0,.12);border-radius:10px;background:transparent;cursor:pointer;";
  // Remove previously injected status buttons
  container.querySelectorAll("button.status-action").forEach((b) => b.remove());
  const make = (label, act) => {
    const b = document.createElement("button");
    b.textContent = label;
    b.style.cssText = btnStyle;
    b.classList.add("status-action");
    b.addEventListener("click", () => openIndentActionModal(indent, act));
    container.appendChild(b);
  };
  const s = indent.status;
  if (s === "draft") make("Approve", "approve");
  if (s === "approved") make("Issue", "issue");
  if (s === "approved" || s === "issued") {
    make("Close Strict", "close_strict");
    make("Close w/ Override", "close_override");
  }
}

function renderIndentLines(rows) {
  const empty = qs("iLinesEmpty");
  const table = qs("iLinesTable");
  const tbody = qs("iLinesTbody");
  tbody.innerHTML = "";
  if (!rows.length) {
    empty.style.display = "";
    empty.textContent = "No lines for this indent.";
    table.style.display = "none";
    return;
  }
  empty.style.display = "none";
  table.style.display = "";
  const isDraft =
    !state.selectedIndent || state.selectedIndent.status === "draft";
  rows.forEach((row, idx) => {
    const lineNo = idx + 1;
    const tr = document.createElement("tr");
    tr.style.cursor = "pointer";
    if (state.selectedIndentLine?.indent_line_id === row.indent_line_id) {
      tr.style.background = "rgba(10,100,200,.06)";
    }
    const recVendor = esc(row.recommended_vendor_name ?? "-");
    const recRate =
      row.recommended_rate != null ? fmt(row.recommended_rate) : "-";
    const selVendor = esc(row.selected_vendor_name ?? "-");
    const selRate = row.selected_rate != null ? fmt(row.selected_rate) : "-";
    tr.innerHTML = `
      <td class="muted" style="text-align:center">${lineNo}</td>
      <td>${esc(row.stock_item_name)}</td>
      <td>${esc(row.material_class_code ?? "")}</td>
      <td>${esc(row.uom_code ?? "")}</td>
      <td>${fmt(row.requested_qty)}</td>
      <td>${fmt(row.allocated_qty)}</td>
      <td><span class="pill">${Number(row.remaining_qty) <= 0 ? "fulfilled" : fmt(row.remaining_qty)}</span></td>
      <td>${recVendor}</td>
      <td class="muted">${recRate}</td>
      <td>${selVendor}</td>
      <td class="muted">${selRate}</td>
      <td class="row-actions">
        <button data-act="recommend" title="Run vendor recommendation">Recommend</button>
        <button data-act="select" title="Select vendor for this line">Select</button>
      </td>
    `;
    tr.addEventListener("click", (e) => {
      if (e.target.closest("button")) return;
      state.selectedIndentLine = row;
      const btnEditQty = qs("iBtnEditLineQty");
      if (btnEditQty) btnEditQty.disabled = false;
      tbody.querySelectorAll("tr").forEach((r) => (r.style.background = ""));
      tr.style.background = "rgba(10,100,200,.06)";
    });
    tr.querySelector('[data-act="recommend"]').addEventListener(
      "click",
      async (e) => {
        e.stopPropagation();
        const { error } = await supabase.rpc("proc_indent_recommend_vendor", {
          p_indent_line_id: row.indent_line_id,
        });
        if (error) {
          toast(`Recommend failed: ${error.message}`, "error");
          return;
        }
        toast("Vendor recommended.", "success");
        await loadIndentLines(state.selectedIndent.indent_id);
      },
    );
    tr.querySelector('[data-act="select"]').addEventListener("click", (e) => {
      e.stopPropagation();
      // Build a synthetic row compatible with openVendorModal
      const synthetic = {
        indent_line_id: row.indent_line_id,
        stock_item_name: row.stock_item_name,
        indent_number: state.selectedIndent?.indent_number ?? "",
        l1_vendor_id: row.l1_vendor_id ?? null,
        l1_vendor_name:
          row.l1_vendor_name ?? row.recommended_vendor_name ?? null,
        l1_rate_value: row.l1_rate_value ?? row.recommended_rate ?? null,
        l2_vendor_id: row.l2_vendor_id ?? null,
        l2_vendor_name: row.l2_vendor_name ?? null,
        l2_rate_value: row.l2_rate_value ?? null,
        l3_vendor_id: row.l3_vendor_id ?? null,
        l3_vendor_name: row.l3_vendor_name ?? null,
        l3_rate_value: row.l3_rate_value ?? null,
        recommended_vendor_id: row.recommended_vendor_id ?? null,
      };
      openVendorModal(synthetic);
    });
    tbody.appendChild(tr);
  });
  void isDraft;
}

async function loadIndentLines(indentId) {
  setLoading(true);
  const { data, error } = await supabase
    .from("v_proc_indent_lines_console")
    .select("*")
    .eq("indent_id", indentId)
    .order("indent_line_id", { ascending: true });
  setLoading(false);
  if (error) {
    toast(`Failed to load indent lines: ${error.message}`, "error");
    return;
  }
  state.indentLinesRows = data || [];
  renderIndentLines(state.indentLinesRows);
}

function renderIndents() {
  const tbody = qs("iTbody");
  tbody.innerHTML = "";
  for (const row of state.indentsRows) {
    const tr = document.createElement("tr");
    tr.style.cursor = "pointer";
    if (state.selectedIndent?.indent_id === row.indent_id) {
      tr.style.background = "rgba(10,100,200,.06)";
    }
    tr.innerHTML = `
      <td><b>${esc(row.indent_number)}</b></td>
      <td>${esc(row.approved_date ?? "")}</td>
      <td><span class="pill">${esc(row.status ?? "")}</span></td>
      <td>${esc(row.material_class_code ?? "")}</td>
      <td>${fmt(row.line_count ?? "")}</td>
    `;
    tr.addEventListener("click", () => {
      openIndentViewModal(row);
      renderIndents();
    });
    tbody.appendChild(tr);
  }
  qs("iMeta").textContent = `Showing ${state.indentsRows.length}`;
  qs("iPaging").textContent = `Page ${state.indentsPage + 1}`;
  updateTabCount("tabCountIndents", state.indentsRows.length);
}

async function loadIndents() {
  setLoading(true);
  let q = supabase.from("v_proc_indent_console").select("*");
  const status = qs("iStatus").value;
  const cls = qs("iClass").value;
  const search = (qs("iSearch").value || "").trim();
  if (status) q = q.eq("status", status);
  if (cls) q = q.eq("material_class_id", Number(cls));
  if (search) q = q.ilike("indent_number", `%${search}%`);
  q = q
    .order("indent_id", { ascending: false })
    .range(
      state.indentsPage * state.pageSize,
      state.indentsPage * state.pageSize + state.pageSize - 1,
    );
  const { data, error } = await q;
  setLoading(false);
  if (error) {
    toast(`Failed to load indents: ${error.message}`, "error");
    return;
  }
  state.indentsRows = data || [];
  renderIndents();
}

function openIndentActionModal(indent, action) {
  const backdrop = qs("indentActionModalBackdrop");
  backdrop.classList.add("show");
  backdrop.setAttribute("aria-hidden", "false");
  const titles = {
    approve: "Approve Indent",
    issue: "Issue Indent",
    close_strict: "Close Indent (Strict)",
    close_override: "Close Indent with Override",
  };
  qs("indentActionTitle").textContent = titles[action] ?? "Confirm Action";
  qs("indentActionItem").textContent = indent.indent_number;
  qs("indentApproveDateRow").style.display = action === "approve" ? "" : "none";
  qs("indentOverrideReasonRow").style.display =
    action === "close_override" ? "" : "none";
  if (action === "approve") {
    qs("indentApproveDate").value = new Date().toISOString().slice(0, 10);
  }
  qs("indentOverrideReason").value = "";
  backdrop.dataset.indentId = String(indent.indent_id);
  backdrop.dataset.action = action;
}

function closeIndentActionModal() {
  const backdrop = qs("indentActionModalBackdrop");
  backdrop.classList.remove("show");
  backdrop.setAttribute("aria-hidden", "true");
}

async function confirmIndentAction() {
  const backdrop = qs("indentActionModalBackdrop");
  const indentId = Number(backdrop.dataset.indentId);
  const action = backdrop.dataset.action;
  let error;
  if (action === "approve") {
    const approvedDate = qs("indentApproveDate").value;
    if (!approvedDate) {
      toast("Approval date is required.", "error");
      return;
    }
    ({ error } = await supabase.rpc("proc_indent_set_status", {
      p_indent_id: indentId,
      p_status: "approved",
      p_approved_date: approvedDate,
    }));
  } else if (action === "issue") {
    ({ error } = await supabase.rpc("proc_indent_issue", {
      p_indent_id: indentId,
    }));
  } else if (action === "close_strict") {
    ({ error } = await supabase.rpc("proc_indent_close_strict", {
      p_indent_id: indentId,
    }));
  } else if (action === "close_override") {
    const reason = (qs("indentOverrideReason").value || "").trim();
    if (!reason) {
      toast("Override reason is required.", "error");
      return;
    }
    ({ error } = await supabase.rpc("proc_indent_close_with_override", {
      p_indent_id: indentId,
      p_reason: reason,
    }));
  }
  if (error) {
    toast(`Action failed: ${error.message}`, "error");
    return;
  }
  toast("Action completed.", "success");
  closeIndentActionModal();
  await loadIndents();
  if (state.selectedIndent?.indent_id === indentId) {
    // Refresh the selected indent data and update modal header
    const updated = state.indentsRows.find((r) => r.indent_id === indentId);
    if (updated) {
      state.selectedIndent = updated;
      qs("indentViewStatus").textContent = updated.status ?? "";
      const hints = {
        draft: "Draft — you can add/edit lines and approve.",
        approved: "Approved — issue to start fulfilment.",
        issued: "Issued — lines are being fulfilled.",
        closed: "Closed — read-only.",
        cancelled: "Cancelled — read-only.",
      };
      qs("indentViewHint").textContent = hints[updated.status] ?? "";
      renderIndentLinesActions(updated);
    }
    await loadIndentLines(indentId);
  }
}

function wireIndentControls() {
  qs("iBtnRefresh").addEventListener("click", () => {
    state.indentsPage = 0;
    loadIndents();
  });
  qs("iBtnPrev").addEventListener("click", () => {
    state.indentsPage = Math.max(0, state.indentsPage - 1);
    loadIndents();
  });
  qs("iBtnNext").addEventListener("click", () => {
    state.indentsPage += 1;
    loadIndents();
  });
  qs("iStatus").addEventListener("change", () => {
    state.indentsPage = 0;
    loadIndents();
  });
  qs("iClass").addEventListener("change", () => {
    state.indentsPage = 0;
    loadIndents();
  });
  qs("iSearch").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      state.indentsPage = 0;
      loadIndents();
    }
  });
  qs("btnIndentActionCancel").addEventListener("click", closeIndentActionModal);
  qs("btnIndentActionConfirm").addEventListener("click", confirmIndentAction);
  qs("indentActionModalBackdrop").addEventListener("click", (e) => {
    if (e.target.id === "indentActionModalBackdrop") closeIndentActionModal();
  });

  // Indent view modal close
  qs("btnIndentViewClose").addEventListener("click", closeIndentViewModal);
  qs("indentViewModalBackdrop").addEventListener("click", (e) => {
    if (e.target.id === "indentViewModalBackdrop") closeIndentViewModal();
  });

  // New Draft Indent
  qs("iBtnNewDraft").addEventListener("click", openCreateIndentModal);
  // Create from PR
  qs("iBtnFromPR").addEventListener("click", openIndentFromPrModal);
  // Add Line
  qs("iBtnAddLine").addEventListener("click", () => {
    if (!state.selectedIndent) {
      toast("Select an indent first.", "error");
      return;
    }
    openIndentAddLineModal(null);
  });
  // Edit Line Qty
  qs("iBtnEditLineQty").addEventListener("click", () => {
    if (!state.selectedIndentLine) {
      toast("Select a line first.", "error");
      return;
    }
    openIndentAddLineModal(state.selectedIndentLine);
  });
  // Export PR Form
  qs("iBtnExportIndent").addEventListener("click", () => {
    if (!state.selectedIndent) {
      toast("Select an indent first.", "error");
      return;
    }
    openExportIndentModal();
  });
  qs("btnExpCancel").addEventListener("click", closeExportIndentModal);
  qs("exportIndentModalBackdrop").addEventListener("click", (e) => {
    if (e.target.id === "exportIndentModalBackdrop") closeExportIndentModal();
  });
  qs("btnExpOpenPrint").addEventListener("click", generateIndentPrintView);
}

// ─── EXPORT / PRINT INDENT ───────────────────────────────────────────────────

function openExportIndentModal() {
  if (!state.selectedIndent) return;
  const row = state.selectedIndent;
  qs("expReqNo").value = row.indent_number ?? "";
  qs("expReqType").value =
    row.material_class_label ?? row.material_class_code ?? "All";
  qs("expReqDate").value = new Date().toISOString().slice(0, 10);
  qs("expDeptUnit").value = "SHRO / SASV";
  qs("expLocation").value =
    "Raw Material Store, Santhigiri Ayurveda Siddha Vaidyasala";
  qs("expRequestedBy").value = "";
  qs("expContactDetails").value = "";
  const bd = qs("exportIndentModalBackdrop");
  bd.classList.add("show");
  bd.setAttribute("aria-hidden", "false");
}

function closeExportIndentModal() {
  qs("exportIndentModalBackdrop").classList.remove("show");
  qs("exportIndentModalBackdrop").setAttribute("aria-hidden", "true");
}

async function generateIndentPrintView() {
  if (!state.selectedIndent) return;
  const indentId = state.selectedIndent.indent_id;
  const deptUnit = qs("expDeptUnit").value.trim();
  const location = qs("expLocation").value.trim();
  const reqNo = qs("expReqNo").value.trim();
  const reqDate = qs("expReqDate").value;
  const reqType = qs("expReqType").value.trim();
  const requestedBy = qs("expRequestedBy").value.trim();
  const contactDetails = qs("expContactDetails").value.trim();

  const btn = qs("btnExpOpenPrint");
  btn.disabled = true;
  btn.textContent = "Loading\u2026";

  try {
    // 1. Indent lines
    const { data: lines, error: lErr } = await supabase
      .from("v_proc_indent_lines_console")
      .select("*")
      .eq("indent_id", indentId)
      .order("indent_line_id");
    if (lErr) throw lErr;

    // 2. Sourcing decisions
    const lineIds = lines.map((l) => l.indent_line_id);
    let decisionMap = {};
    if (lineIds.length) {
      const { data: decisions, error: dErr } = await supabase
        .from("proc_indent_line_sourcing_decision")
        .select("*")
        .in("indent_line_id", lineIds);
      if (dErr) throw dErr;
      (decisions ?? []).forEach((d) => (decisionMap[d.indent_line_id] = d));
    }

    // 3. Vendor names
    const vendorIds = [
      ...new Set(
        Object.values(decisionMap).flatMap((d) =>
          [d.selected_vendor_id, d.recommended_vendor_id].filter(Boolean),
        ),
      ),
    ];
    let vendorMap = {};
    if (vendorIds.length) {
      const { data: vendors } = await supabase
        .from("proc_vendor")
        .select("vendor_id,display_name")
        .in("vendor_id", vendorIds);
      (vendors ?? []).forEach((v) => (vendorMap[v.vendor_id] = v.display_name));
    }

    // 4. Item category labels
    const itemIds = [...new Set(lines.map((l) => l.stock_item_id))];
    let itemCatMap = {};
    if (itemIds.length) {
      const { data: items } = await supabase
        .from("v_inv_stock_item_with_class")
        .select(
          "stock_item_id,code,category_label,subcategory_label,group_label",
        )
        .in("stock_item_id", itemIds);
      (items ?? []).forEach(
        (i) =>
          (itemCatMap[i.stock_item_id] = {
            code: i.code,
            category:
              i.subcategory_label || i.group_label || i.category_label || "",
          }),
      );
    }

    // 5. Current stock
    let stockMap = {};
    if (itemIds.length) {
      const { data: stocks } = await supabase
        .from("v_stock_current_by_item")
        .select("inv_stock_item_id,qty_on_hand,source_kind")
        .in("inv_stock_item_id", itemIds);
      const ORDER = ["rm", "plm", "consumables"];
      (stocks ?? []).forEach((s) => {
        const cur = stockMap[s.inv_stock_item_id];
        if (!cur) {
          stockMap[s.inv_stock_item_id] = s;
        } else {
          const curIdx = ORDER.indexOf(cur.source_kind ?? "");
          const newIdx = ORDER.indexOf(s.source_kind ?? "");
          if (newIdx !== -1 && (curIdx === -1 || newIdx < curIdx)) {
            stockMap[s.inv_stock_item_id] = s;
          }
        }
      });
    }

    // Build row data
    const rows = lines.map((l, idx) => {
      const dec = decisionMap[l.indent_line_id] ?? {};
      const vendorId = dec.selected_vendor_id ?? dec.recommended_vendor_id;
      const unitPrice = dec.selected_rate ?? dec.recommended_rate;
      const cat = itemCatMap[l.stock_item_id] ?? {};
      const qtyInStock = stockMap[l.stock_item_id]?.qty_on_hand ?? null;
      return {
        sl: idx + 1,
        code: cat.code ?? "",
        name: l.stock_item_name ?? "",
        category: cat.category || l.material_class_label || "",
        uom: l.uom_code ?? "",
        qtyInStock: qtyInStock !== null ? fmt(qtyInStock) : "",
        qtyToPurchase: fmt(l.remaining_qty ?? l.requested_qty ?? ""),
        unitPrice:
          unitPrice !== null && unitPrice !== undefined ? fmt(unitPrice) : "",
        supplier: vendorId ? (vendorMap[vendorId] ?? "") : "",
      };
    });

    const printHtml = buildPrintHtml({
      deptUnit,
      location,
      reqNo,
      reqDate,
      reqType,
      requestedBy,
      contactDetails,
      rows,
    });

    const printWin = window.open("", "_blank");
    if (!printWin) {
      toast(
        "Pop-up blocked \u2014 please allow pop-ups for this page.",
        "error",
      );
      return;
    }
    printWin.document.write(printHtml);
    printWin.document.close();
    closeExportIndentModal();
  } catch (err) {
    toast(`Export failed: ${err.message}`, "error");
  } finally {
    btn.disabled = false;
    btn.innerHTML = `${iconSvg("document")}Open Print View`;
  }
}

function buildPrintHtml({
  deptUnit,
  location,
  reqNo,
  reqDate,
  reqType,
  requestedBy,
  contactDetails,
  rows,
}) {
  const escH = (s) =>
    String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  const fmtDate = (d) => {
    if (!d) return "";
    const [y, m, day] = d.split("-");
    return `${day}/${m}/${y}`;
  };
  const tableRows = rows
    .map(
      (r) => `
    <tr>
      <td>${r.sl}</td>
      <td>${escH(r.code)}</td>
      <td>${escH(r.name)}</td>
      <td>${escH(r.category)}</td>
      <td>${escH(r.uom)}</td>
      <td class="num">${escH(r.qtyInStock)}</td>
      <td class="num">${escH(r.qtyToPurchase)}</td>
      <td class="num">${escH(r.unitPrice)}</td>
      <td>${escH(r.supplier)}</td>
      <td></td>
    </tr>`,
    )
    .join("");
  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<title>Purchase Requisition \u2014 ${escH(reqNo)}</title>
<style>
  @page { size: A4; margin: 18mm 14mm; }
  * { box-sizing: border-box; font-family: 'Segoe UI', Arial, sans-serif; }
  body { font-size: 11px; color: #111; }
  .org-header { text-align: center; margin-bottom: 14px; }
  .org-header h1 { font-size: 15px; margin: 0; font-weight: 700; }
  .org-header h2 { font-size: 13px; margin: 4px 0 0; font-weight: 500; letter-spacing: .5px; }
  .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 20px; margin-bottom: 14px; border: 1px solid #ccc; border-radius: 4px; padding: 10px 12px; }
  .meta-item { display: flex; gap: 6px; font-size: 11px; align-items: baseline; }
  .meta-item .lbl { font-weight: 600; min-width: 130px; color: #444; white-space: nowrap; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 14px; font-size: 10.5px; }
  th { background: #f0f0f0; font-weight: 600; padding: 5px 6px; border: 1px solid #ccc; text-align: left; }
  td { padding: 4px 6px; border: 1px solid #ddd; vertical-align: top; }
  td.num { text-align: right; }
  .sig-block { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 30px; margin-top: 28px; }
  .sig-box { border-top: 1px solid #999; padding-top: 6px; font-size: 10.5px; color: #444; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>
</head>
<body>
<div class="org-header">
  <h1>Gurucharanam Saranam / Santhigiri Ashram</h1>
  <h2>PURCHASE REQUISITION FORM</h2>
</div>
<div class="meta-grid">
  <div class="meta-item"><span class="lbl">Department / Unit:</span><span>${escH(deptUnit)}</span></div>
  <div class="meta-item"><span class="lbl">Requisition No.:</span><span>${escH(reqNo)}</span></div>
  <div class="meta-item" style="grid-column:1/-1"><span class="lbl">Location:</span><span>${escH(location)}</span></div>
  <div class="meta-item"><span class="lbl">Date:</span><span>${fmtDate(reqDate)}</span></div>
  <div class="meta-item"><span class="lbl">Requisition Type:</span><span>${escH(reqType)}</span></div>
  <div class="meta-item"><span class="lbl">Requested By:</span><span>${escH(requestedBy)}</span></div>
  <div class="meta-item"><span class="lbl">Contact Details:</span><span>${escH(contactDetails)}</span></div>
</div>
<table>
  <thead>
    <tr>
      <th>#</th>
      <th>Item Code</th>
      <th>Item Description</th>
      <th>Category</th>
      <th>UOM</th>
      <th>Qty in Stock</th>
      <th>Qty to Purchase</th>
      <th>Unit Price</th>
      <th>Preferred Supplier</th>
      <th>Remarks</th>
    </tr>
  </thead>
  <tbody>${tableRows}
  </tbody>
</table>
<div class="sig-block">
  <div class="sig-box">Requested By</div>
  <div class="sig-box">Approved By</div>
  <div class="sig-box">Procurement Officer</div>
</div>
</body></html>`;
}

// ─── INDENT CREATION ─────────────────────────────────────────────────────────

function openCreateIndentModal() {
  const backdrop = qs("createIndentModalBackdrop");
  backdrop.classList.add("show");
  backdrop.setAttribute("aria-hidden", "false");
  qs("ciIndentDate").value = new Date().toISOString().slice(0, 10);
  qs("ciIndentNumber").value = "";
  qs("ciMaterialClass").value = "";
  qs("ciNotes").value = "";
}

function closeCreateIndentModal() {
  qs("createIndentModalBackdrop").classList.remove("show");
  qs("createIndentModalBackdrop").setAttribute("aria-hidden", "true");
}

async function saveCreateIndent() {
  const indentDate = qs("ciIndentDate").value;
  if (!indentDate) {
    toast("Indent date is required.", "error");
    return;
  }
  const indentNumber = (qs("ciIndentNumber").value || "").trim() || null;
  const materialClassIdRaw = qs("ciMaterialClass").value;
  const materialClassId = materialClassIdRaw
    ? Number(materialClassIdRaw)
    : null;
  const notes = (qs("ciNotes").value || "").trim() || null;

  setLoading(true);
  const { data, error } = await supabase.rpc("proc_indent_create", {
    p_indent_number: indentNumber,
    p_indent_date: indentDate,
    p_material_class_id: materialClassId,
    p_generation_filters: null,
    p_notes: notes,
  });
  setLoading(false);
  if (error) {
    toast(`Create indent failed: ${error.message}`, "error");
    return;
  }
  toast("Indent created.", "success");
  closeCreateIndentModal();
  state.indentsPage = 0;
  await loadIndents();
  // Auto-select the new indent (by indent_id returned from RPC or first row)
  const newId = data?.indent_id ?? data;
  if (newId) {
    const found = state.indentsRows.find((r) => r.indent_id === newId);
    if (found) {
      renderIndents();
      openIndentViewModal(found);
    }
  }
}

async function openIndentFromPrModal() {
  // Load active PRs
  setLoading(true);
  const { data, error } = await supabase
    .from(PR_HEADER_VIEW)
    .select(
      "pr_id, pr_number, effective_from_date, horizon_start_month, horizon_end_month, material_class_id",
    )
    .eq("status", "active")
    .order("pr_number", { ascending: true });
  setLoading(false);
  if (error) {
    toast(`Failed to load PRs: ${error.message}`, "error");
    return;
  }

  const pick = qs("ifpPrPick");
  pick.innerHTML = "";
  for (const pr of data || []) {
    const opt = document.createElement("option");
    opt.value = String(pr.pr_id);
    opt.textContent = `${pr.pr_number} | ${pr.effective_from_date ?? ""} | Class:${pr.material_class_id ?? "All"}`;
    pick.appendChild(opt);
  }
  if (!pick.options.length) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "No active PRs found";
    pick.appendChild(opt);
  }
  qs("ifpIndentNumber").value = "";
  const backdrop = qs("indentFromPrModalBackdrop");
  backdrop.classList.add("show");
  backdrop.setAttribute("aria-hidden", "false");
}

function closeIndentFromPrModal() {
  qs("indentFromPrModalBackdrop").classList.remove("show");
  qs("indentFromPrModalBackdrop").setAttribute("aria-hidden", "true");
}

async function saveIndentFromPr() {
  const prId = Number(qs("ifpPrPick").value || 0);
  if (!prId) {
    toast("Select a PR.", "error");
    return;
  }
  const indentNumber = (qs("ifpIndentNumber").value || "").trim() || null;
  setLoading(true);
  const { data, error } = await supabase.rpc("proc_indent_create_from_pr", {
    p_pr_id: prId,
    p_indent_number: indentNumber,
  });
  setLoading(false);
  if (error) {
    toast(`Create from PR failed: ${error.message}`, "error");
    return;
  }
  toast("Indent created from PR.", "success");
  closeIndentFromPrModal();
  state.indentsPage = 0;
  await loadIndents();
  const newId = data?.indent_id ?? data;
  if (newId) {
    const found = state.indentsRows.find((r) => r.indent_id === newId);
    if (found) {
      renderIndents();
      openIndentViewModal(found);
    }
  }
}

// ─── INDENT LINE ADD / EDIT ───────────────────────────────────────────────────

// ─── Stock Item Picker ────────────────────────────────────────────────────────

function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

async function fetchUomCode(uomId) {
  if (!uomId) return "—";
  const { data } = await supabase
    .from("inv_uom")
    .select("code")
    .eq("id", uomId)
    .single();
  return data?.code ?? String(uomId);
}

let _pickerOnSelect = null;
let _pickerClassFilter = null;

function openStockItemPicker({ materialClassId, onSelect }) {
  _pickerOnSelect = onSelect;
  _pickerClassFilter = materialClassId || null;
  qs("stockPickerSearch").value = "";
  qs("stockPickerStatus").textContent = "Type to search…";
  qs("stockPickerTable").style.display = "none";
  qs("stockPickerTbody").innerHTML = "";
  const backdrop = qs("stockPickerModalBackdrop");
  backdrop.classList.add("show");
  backdrop.setAttribute("aria-hidden", "false");
  setTimeout(() => qs("stockPickerSearch").focus(), 50);
}

function closeStockItemPicker() {
  qs("stockPickerModalBackdrop").classList.remove("show");
  qs("stockPickerModalBackdrop").setAttribute("aria-hidden", "true");
}

async function runStockPickerSearch(query) {
  const status = qs("stockPickerStatus");
  const q = (query || "").trim();
  if (q.length < 1) {
    status.textContent = "Type to search…";
    qs("stockPickerTable").style.display = "none";
    return;
  }
  status.textContent = "Searching…";
  let req = supabase
    .from("v_inv_stock_item_with_class")
    .select(
      [
        "stock_item_id",
        "code",
        "name",
        "default_uom_id",
        "active",
        "category_id",
        "category_code",
        "category_label",
      ].join(","),
    )
    .eq("active", true)
    .or(`name.ilike.%${q}%,code.ilike.%${q}%`)
    .order("name", { ascending: true })
    .limit(50);
  if (_pickerClassFilter) req = req.eq("category_id", _pickerClassFilter);
  const { data, error } = await req;
  if (error) {
    status.textContent = `Error: ${error.message}`;
    return;
  }
  const rows = data || [];
  status.textContent = `${rows.length} result${rows.length !== 1 ? "s" : ""}`;
  const tbody = qs("stockPickerTbody");
  tbody.innerHTML = "";
  if (rows.length === 0) {
    qs("stockPickerTable").style.display = "none";
    return;
  }
  qs("stockPickerTable").style.display = "";
  for (const item of rows) {
    const classLabel =
      item.category_code ??
      (item.category_id === 1
        ? "RM"
        : item.category_id === 2
          ? "PLM"
          : item.category_id === 5
            ? "IND"
            : String(item.category_id ?? ""));
    const tr = document.createElement("tr");
    tr.style.cursor = "pointer";
    tr.innerHTML = `<td><b>${esc(item.code ?? "")}</b></td><td>${esc(item.name ?? "")}</td><td>${esc(classLabel)}</td>`;
    tr.addEventListener("click", () => {
      closeStockItemPicker();
      if (_pickerOnSelect)
        _pickerOnSelect({
          stock_item_id: item.stock_item_id,
          code: item.code,
          name: item.name,
          default_uom_id: item.default_uom_id,
          category_id: item.category_id,
          category_code: item.category_code,
          category_label: item.category_label,
        });
    });
    tbody.appendChild(tr);
  }
}

function wireStockItemPicker() {
  qs("btnStockPickerClose").addEventListener("click", closeStockItemPicker);
  qs("stockPickerModalBackdrop").addEventListener("click", (e) => {
    if (e.target.id === "stockPickerModalBackdrop") closeStockItemPicker();
  });
  qs("stockPickerSearch").addEventListener(
    "input",
    debounce((e) => runStockPickerSearch(e.target.value), 250),
  );
}

function openIndentAddLineModal(existingLine) {
  const backdrop = qs("indentAddLineModalBackdrop");
  const indent = state.selectedIndent;
  const needsReason =
    indent && (indent.status === "approved" || indent.status === "issued");
  qs("ialReasonReq").style.display = needsReason ? "" : "none";
  qs("ialTitle").textContent = existingLine
    ? "Edit Line Qty"
    : "Add Indent Line";

  // Material class: derive from indent if set, else show selector
  const indentClass = indent?.material_class_id ?? null;
  const classRow = qs("ialClassRow");
  const classSelect = qs("ialMaterialClass");
  if (indentClass) {
    classRow.style.display = "none";
    classSelect.value = String(indentClass);
  } else {
    classRow.style.display = "";
    classSelect.value = "";
  }

  // Reset state
  backdrop.dataset.stockItemId = "";
  backdrop.dataset.uomId = "";
  backdrop.dataset.existingLineId = "";
  qs("ialItemText").textContent = "None selected";
  qs("ialItemText").classList.add("muted");
  qs("ialUomText").textContent = "—";
  qs("ialItemChange").textContent = "Select";
  qs("ialQty").value = "";
  qs("ialReason").value = "";

  if (existingLine) {
    // In edit mode: lock item, only allow qty change
    backdrop.dataset.stockItemId = String(existingLine.stock_item_id ?? "");
    backdrop.dataset.uomId = String(existingLine.uom_id ?? "");
    backdrop.dataset.existingLineId = String(existingLine.indent_line_id ?? "");
    qs("ialItemText").textContent = existingLine.stock_item_name
      ? `${existingLine.stock_item_name}`
      : `Item #${existingLine.stock_item_id}`;
    qs("ialItemText").classList.remove("muted");
    qs("ialItemChange").style.display = "none"; // locked in edit
    qs("ialUomText").textContent = existingLine.uom_code ?? "—";
    qs("ialQty").value = existingLine.requested_qty ?? "";
  } else {
    qs("ialItemChange").style.display = "";
  }

  backdrop.classList.add("show");
  backdrop.setAttribute("aria-hidden", "false");

  // Wire Change button (re-wire each open to capture current class)
  qs("ialItemChange").onclick = () => {
    const classId =
      indent?.material_class_id ??
      (Number(qs("ialMaterialClass").value || 0) || null);
    openStockItemPicker({
      materialClassId: classId,
      onSelect: async (picked) => {
        backdrop.dataset.stockItemId = String(picked.stock_item_id);
        backdrop.dataset.uomId = String(picked.default_uom_id ?? "");
        qs("ialItemText").textContent = `${picked.code} — ${picked.name}`;
        qs("ialItemText").classList.remove("muted");
        qs("ialItemChange").textContent = "Change";
        qs("ialUomText").textContent = await fetchUomCode(
          picked.default_uom_id,
        );
        // Lock class selector once an item is chosen
        qs("ialMaterialClass").disabled = true;
      },
    });
  };

  // Unlock class selector whenever modal opens fresh (before item picked)
  qs("ialMaterialClass").disabled = false;
}

function closeIndentAddLineModal() {
  qs("indentAddLineModalBackdrop").classList.remove("show");
  qs("indentAddLineModalBackdrop").setAttribute("aria-hidden", "true");
}

async function saveIndentAddLine() {
  if (!state.selectedIndent) {
    toast("No indent selected.", "error");
    return;
  }
  const backdrop = qs("indentAddLineModalBackdrop");
  const indentId = state.selectedIndent.indent_id;
  const stockItemId = Number(backdrop.dataset.stockItemId || "0");
  const uomId = Number(backdrop.dataset.uomId || "0");
  const qty = Number((qs("ialQty").value || "").trim());
  const reason = (qs("ialReason").value || "").trim() || null;

  // Derive material class: from indent or from selector
  const indentClass = state.selectedIndent.material_class_id ?? null;
  const materialClassId = indentClass
    ? Number(indentClass)
    : qs("ialMaterialClass").value
      ? Number(qs("ialMaterialClass").value)
      : null;

  if (!stockItemId) {
    toast("Select a stock item.", "error");
    return;
  }
  if (!uomId) {
    toast("UOM could not be determined. Re-select the stock item.", "error");
    return;
  }
  if (!qty || qty <= 0) {
    toast("Enter a valid requested qty.", "error");
    return;
  }
  const needsReason =
    state.selectedIndent.status === "approved" ||
    state.selectedIndent.status === "issued";
  if (needsReason && !reason) {
    toast("Reason is required for approved/issued indents.", "error");
    return;
  }

  setLoading(true);
  const { error } = await supabase.rpc("proc_indent_add_line", {
    p_indent_id: indentId,
    p_material_class_id: materialClassId,
    p_stock_item_id: stockItemId,
    p_uom_id: uomId,
    p_requested_qty: qty,
    p_reason: reason,
  });
  setLoading(false);
  if (error) {
    toast(`Save failed: ${error.message}`, "error");
    return;
  }
  toast("Line saved.", "success");
  closeIndentAddLineModal();
  state.selectedIndentLine = null;
  const btnEditQty = qs("iBtnEditLineQty");
  if (btnEditQty) btnEditQty.disabled = true;
  await loadIndentLines(indentId);
}

// ─── PR TAB ───────────────────────────────────────────────────────────────────

function renderPrHeaders() {
  const tbody = qs("prTbody");
  tbody.innerHTML = "";
  for (const row of state.prRows) {
    const tr = document.createElement("tr");
    tr.style.cursor = "pointer";
    if (state.selectedPr?.pr_id === row.pr_id) {
      tr.style.background = "rgba(10,100,200,.06)";
    }
    const horizonStr = row.horizon_start_month
      ? `${row.horizon_start_month.slice(0, 7)}${row.horizon_end_month ? ` – ${row.horizon_end_month.slice(0, 7)}` : ""}`
      : "";
    tr.innerHTML = `
      <td><b>${esc(row.pr_number ?? "")}</b></td>
      <td><span class="pill">${esc(row.status ?? "")}</span></td>
      <td>${esc(row.effective_from_date ?? "")}</td>
      <td class="muted">${esc(horizonStr)}</td>
      <td>${esc(row.material_class_id ? String(row.material_class_id) : "All")}</td>
      <td>${fmt(row.line_count ?? "")}</td>
    `;
    tr.addEventListener("click", () => {
      openPrViewModal(row);
      renderPrHeaders();
    });
    tbody.appendChild(tr);
  }
  qs("prMeta").textContent = `Showing ${state.prRows.length}`;
  qs("prPaging").textContent = `Page ${state.prPage + 1}`;
  updateTabCount("tabCountPr", state.prRows.length);
}

async function loadPrHeaders() {
  setLoading(true);
  const status = qs("prFilterStatus").value;
  const cls = qs("prFilterClass").value;
  const search = (qs("prSearch").value || "").trim();
  let q = supabase.from(PR_HEADER_VIEW).select("*");
  if (status) q = q.eq("status", status);
  if (cls) q = q.eq("material_class_id", Number(cls));
  if (search) q = q.ilike("pr_number", `%${search}%`);
  q = q
    .order("pr_id", { ascending: false })
    .range(
      state.prPage * state.pageSize,
      state.prPage * state.pageSize + state.pageSize - 1,
    );
  const { data, error } = await q;
  setLoading(false);
  if (error) {
    toast(`Failed to load PRs: ${error.message}`, "error");
    return;
  }
  state.prRows = data || [];
  renderPrHeaders();
}

function renderPrLines() {
  const empty = qs("prLinesEmpty");
  const table = qs("prLinesTable");
  const tbody = qs("prLinesTbody");
  tbody.innerHTML = "";
  if (!state.prLinesRows.length) {
    empty.style.display = "";
    empty.textContent = "No lines for this PR.";
    table.style.display = "none";
    return;
  }
  empty.style.display = "none";
  table.style.display = "";
  const isDraft = !state.selectedPr || state.selectedPr.status === "draft";
  for (const row of state.prLinesRows) {
    const tr = document.createElement("tr");
    if (!isDraft) tr.classList.add("locked-row");
    tr.innerHTML = `
      <td>${esc(row.stock_item_name ?? String(row.stock_item_id ?? ""))}</td>
      <td>${esc(row.material_class_code ?? "")}</td>
      <td>${esc(row.uom_code ?? "")}</td>
      <td>${fmt(row.system_suggested_qty)}</td>
      <td>${fmt(row.requested_qty)}</td>
      <td>${fmt(row.manual_delta_qty)}</td>
      <td>${fmt(row.final_requested_qty)}</td>
      <td class="muted">${esc(row.manual_reason ?? "")}</td>
      <td class="row-actions">
        ${
          isDraft
            ? `<button data-act="editreq" title="Edit Requested Qty">Qty</button>
             <button data-act="editdelta" title="Edit Manual Delta">Delta</button>`
            : `<span class="muted" title="Locked after activation">🔒</span>`
        }
      </td>
    `;
    if (isDraft) {
      tr.querySelector('[data-act="editreq"]').addEventListener(
        "click",
        (e) => {
          e.stopPropagation();
          openPrEditRequestedModal(row);
        },
      );
      tr.querySelector('[data-act="editdelta"]').addEventListener(
        "click",
        (e) => {
          e.stopPropagation();
          openPrEditDeltaModal(row);
        },
      );
    }
    tbody.appendChild(tr);
  }
}

async function loadPrLines(prId) {
  setLoading(true);
  const { data, error } = await supabase
    .from(PR_LINES_VIEW)
    .select("*")
    .eq("pr_id", prId)
    .order("pr_line_id", { ascending: true });
  setLoading(false);
  if (error) {
    toast(`Failed to load PR lines: ${error.message}`, "error");
    return;
  }
  state.prLinesRows = data || [];
  renderPrLines();
}

function openPrViewModal(row) {
  state.selectedPr = row;
  qs("prLinesTitle").textContent = row.pr_number ?? "";
  qs("prDetailStatus").textContent = row.status ?? "";
  const horizonStr = row.horizon_start_month
    ? `${row.horizon_start_month.slice(0, 7)}${row.horizon_end_month ? ` – ${row.horizon_end_month.slice(0, 7)}` : ""}`
    : "";
  const metaParts = [];
  if (row.effective_from_date)
    metaParts.push(`Eff. from: ${row.effective_from_date}`);
  if (horizonStr) metaParts.push(`Horizon: ${horizonStr}`);
  if (row.material_class_id) metaParts.push(`Class: ${row.material_class_id}`);
  qs("prDetailMeta").textContent = metaParts.join(" \u00b7 ");
  const isDraft = row.status === "draft";
  const isActive = row.status === "active";
  const isTerminal = row.status === "closed" || row.status === "cancelled";
  const btnActivate = qs("btnPrActivate");
  const btnClose = qs("btnPrClosePr");
  const btnAddLine = qs("btnPrAddLine");
  const btnCreateIndent = qs("btnPrCreateIndent");
  if (btnActivate) btnActivate.style.display = isDraft ? "" : "none";
  if (btnClose) {
    btnClose.style.display = isTerminal ? "none" : "";
    btnClose.textContent = isDraft ? "Cancel PR" : "Close PR";
  }
  if (btnAddLine) btnAddLine.style.display = isDraft ? "" : "none";
  if (btnCreateIndent) btnCreateIndent.style.display = isActive ? "" : "none";
  // Set lifecycle hint
  const prHints = {
    draft: "Draft — edit lines, then Activate to proceed.",
    active: "Active — create an Indent or Close when done.",
    closed: "Closed — read-only.",
    cancelled: "Cancelled — read-only.",
  };
  const hintEl = qs("prDetailHint");
  if (hintEl) hintEl.textContent = prHints[row.status] ?? "";
  qs("prLinesEmpty").style.display = "";
  qs("prLinesTable").style.display = "none";
  qs("prLinesTbody").innerHTML = "";
  const backdrop = qs("prViewModalBackdrop");
  backdrop.classList.add("show");
  backdrop.setAttribute("aria-hidden", "false");
  loadPrLines(row.pr_id);
}

function exportPrForm(pr) {
  const lines = state.prLinesRows;
  const horizonStr = pr.horizon_start_month
    ? `${pr.horizon_start_month.slice(0, 7)}${pr.horizon_end_month ? ` – ${pr.horizon_end_month.slice(0, 7)}` : ""}`
    : "—";
  const rowsHtml = lines
    .map(
      (row, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${esc(row.stock_item_name ?? String(row.stock_item_id ?? ""))}</td>
      <td>${esc(row.material_class_code ?? "")}</td>
      <td>${esc(row.uom_code ?? "")}</td>
      <td style="text-align:right">${fmt(row.system_suggested_qty)}</td>
      <td style="text-align:right">${fmt(row.requested_qty)}</td>
      <td style="text-align:right">${fmt(row.manual_delta_qty)}</td>
      <td style="text-align:right">${fmt(row.final_requested_qty)}</td>
      <td>${esc(row.manual_reason ?? "")}</td>
    </tr>`,
    )
    .join("");
  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<title>PR ${esc(pr.pr_number)}</title>
<style>
  body{font-family:Arial,sans-serif;font-size:12px;margin:24px;color:#222}
  h1{font-size:18px;margin:0 0 4px}
  .meta{color:#555;margin-bottom:18px;font-size:11px;line-height:1.7}
  table{border-collapse:collapse;width:100%}
  th,td{border:1px solid #ccc;padding:6px 8px}
  th{background:#f2f2f2;text-align:left;font-weight:600}
  tfoot td{background:#f9f9f9;font-weight:600}
  @media print{.no-print{display:none}}
</style>
</head><body>
<h1>Purchase Requisition: ${esc(pr.pr_number)}</h1>
<div class="meta">
  Status: <b>${esc(pr.status ?? "")}</b> &nbsp;|&nbsp;
  Effective from: ${esc(pr.effective_from_date ?? "—")} &nbsp;|&nbsp;
  Horizon: ${esc(horizonStr)} &nbsp;|&nbsp;
  Class: ${esc(pr.material_class_id ? String(pr.material_class_id) : "All")} &nbsp;|&nbsp;
  Generated: ${new Date().toLocaleString()}
  ${pr.notes ? `<br>Notes: ${esc(pr.notes)}` : ""}
</div>
<table>
  <thead><tr>
    <th>#</th><th>Item</th><th>Class</th><th>UOM</th>
    <th>Sys. Sug.</th><th>Requested</th><th>Delta</th><th>Final</th><th>Reason</th>
  </tr></thead>
  <tbody>${rowsHtml || "<tr><td colspan='9' style='color:#999;text-align:center'>No lines</td></tr>"}</tbody>
</table>
<br><br>
<button class="no-print" onclick="window.print()" style="padding:8px 16px;font-size:13px;cursor:pointer">Print / Save PDF</button>
</body></html>`;
  const w = window.open("", "_blank");
  if (w) {
    w.document.write(html);
    w.document.close();
  } else {
    toast("Pop-up blocked — allow pop-ups for this page to export.", "error");
  }
}

function closePrViewModal() {
  qs("prViewModalBackdrop").classList.remove("show");
  qs("prViewModalBackdrop").setAttribute("aria-hidden", "true");
}

function openGeneratePrModal() {
  qs("prEffectiveFrom").value = new Date().toISOString().slice(0, 10);
  qs("prNewNumber").value = "";
  qs("prHorizonStart").value = "";
  qs("prHorizonEnd").value = "";
  qs("prMaterialClass").value = "";
  qs("prNotes").value = "";
  const backdrop = qs("generatePrModalBackdrop");
  backdrop.classList.add("show");
  backdrop.setAttribute("aria-hidden", "false");
}

function closeGeneratePrModal() {
  const backdrop = qs("generatePrModalBackdrop");
  backdrop.classList.remove("show");
  backdrop.setAttribute("aria-hidden", "true");
}

async function createIndentFromSelectedPr() {
  if (!state.selectedPr) {
    toast("No PR selected.", "error");
    return;
  }
  if (state.selectedPr.status !== "active") {
    toast("PR must be active to create an indent.", "error");
    return;
  }
  setLoading(true);
  const { data, error } = await supabase.rpc("proc_indent_create_from_pr", {
    p_pr_id: state.selectedPr.pr_id,
    p_indent_number: null,
  });
  setLoading(false);
  if (error) {
    toast(`Create indent failed: ${error.message}`, "error");
    return;
  }
  toast("Indent created from PR.", "success");
  closePrViewModal();
  setTab("indents");
  state.indentsPage = 0;
  await loadIndents();
  const newId = data?.indent_id ?? data;
  if (newId) {
    const found = state.indentsRows.find((r) => r.indent_id === newId);
    if (found) {
      renderIndents();
      openIndentViewModal(found);
    }
  }
}

async function generateDraftPr() {
  const prNumber = (qs("prNewNumber").value || "").trim();
  if (!prNumber) {
    toast("PR Number is required.", "error");
    return;
  }
  const effectiveFrom = qs("prEffectiveFrom").value;
  if (!effectiveFrom) {
    toast("Effective From date is required.", "error");
    return;
  }
  const horizonStart = qs("prHorizonStart").value || null;
  const horizonEnd = qs("prHorizonEnd").value || null;
  const materialClassRaw = qs("prMaterialClass").value;
  const materialClassId = materialClassRaw ? Number(materialClassRaw) : null;
  const notes = (qs("prNotes").value || "").trim() || null;

  setLoading(true);
  const { error } = await supabase.rpc("create_pr_from_mrp_plan", {
    p_pr_number: prNumber,
    p_effective_from_date: effectiveFrom,
    p_horizon_start_month: horizonStart,
    p_horizon_end_month: horizonEnd,
    p_material_class_id: materialClassId,
    p_notes: notes,
  });
  setLoading(false);
  if (error) {
    toast(`Generate PR failed: ${error.message}`, "error");
    return;
  }
  toast("Draft PR generated.", "success");
  closeGeneratePrModal();
  // Reload list
  state.prPage = 0;
  await loadPrHeaders();
}

// ─── PR Line edit modals ──────────────────────────────────────────────────────

function openPrEditRequestedModal(row) {
  const backdrop = qs("prEditReqModalBackdrop");
  qs("prEditReqItem").textContent =
    `${row.stock_item_name ?? row.stock_item_id}`;
  qs("prEditReqQty").value = row.requested_qty ?? "";
  qs("prEditReqReason").value = "";
  backdrop.dataset.prLineId = String(row.pr_line_id);
  backdrop.classList.add("show");
  backdrop.setAttribute("aria-hidden", "false");
}

function closePrEditRequestedModal() {
  qs("prEditReqModalBackdrop").classList.remove("show");
  qs("prEditReqModalBackdrop").setAttribute("aria-hidden", "true");
}

async function savePrEditRequested() {
  const backdrop = qs("prEditReqModalBackdrop");
  const prLineId = Number(backdrop.dataset.prLineId);
  const qty = Number((qs("prEditReqQty").value || "").trim());
  const reason = (qs("prEditReqReason").value || "").trim() || null;
  if (!qty || qty < 0) {
    toast("Enter a valid quantity.", "error");
    return;
  }
  setLoading(true);
  const { error } = await supabase.rpc("proc_pr_set_requested_qty", {
    p_pr_line_id: prLineId,
    p_requested_qty: qty,
    p_reason: reason,
  });
  setLoading(false);
  if (error) {
    toast(`Save failed: ${error.message}`, "error");
    return;
  }
  toast("Requested qty updated.", "success");
  closePrEditRequestedModal();
  if (state.selectedPr) await loadPrLines(state.selectedPr.pr_id);
}

function openPrEditDeltaModal(row) {
  const backdrop = qs("prEditDeltaModalBackdrop");
  qs("prEditDeltaItem").textContent =
    `${row.stock_item_name ?? row.stock_item_id}`;
  qs("prEditDeltaQty").value = row.manual_delta_qty ?? "";
  qs("prEditDeltaReason").value = "";
  backdrop.dataset.prLineId = String(row.pr_line_id);
  backdrop.classList.add("show");
  backdrop.setAttribute("aria-hidden", "false");
}

function closePrEditDeltaModal() {
  qs("prEditDeltaModalBackdrop").classList.remove("show");
  qs("prEditDeltaModalBackdrop").setAttribute("aria-hidden", "true");
}

async function savePrEditDelta() {
  const backdrop = qs("prEditDeltaModalBackdrop");
  const prLineId = Number(backdrop.dataset.prLineId);
  const deltaText = (qs("prEditDeltaQty").value || "").trim();
  const delta = Number(deltaText);
  const reason = (qs("prEditDeltaReason").value || "").trim();
  if (deltaText === "" || Number.isNaN(delta)) {
    toast("Enter a valid delta value.", "error");
    return;
  }
  if (!reason) {
    toast("Reason is required.", "error");
    return;
  }
  setLoading(true);
  const { error } = await supabase.rpc("proc_pr_set_manual_delta", {
    p_pr_line_id: prLineId,
    p_manual_delta_qty: delta,
    p_reason: reason,
  });
  setLoading(false);
  if (error) {
    toast(`Save failed: ${error.message}`, "error");
    return;
  }
  toast("Manual delta updated.", "success");
  closePrEditDeltaModal();
  if (state.selectedPr) await loadPrLines(state.selectedPr.pr_id);
}

function openPrAddLineModal() {
  const backdrop = qs("prAddLineModalBackdrop");
  qs("prAddLineClass").value = "";
  backdrop.dataset.stockItemId = "";
  backdrop.dataset.uomId = "";
  qs("prAddLineItemText").textContent = "None selected";
  qs("prAddLineItemText").classList.add("muted");
  qs("prAddLineItemChange").textContent = "Select";
  qs("prAddLineUomText").textContent = "—";
  qs("prAddLineQty").value = "";
  qs("prAddLineReason").value = "";
  backdrop.classList.add("show");
  backdrop.setAttribute("aria-hidden", "false");

  qs("prAddLineItemChange").onclick = () => {
    const classVal = qs("prAddLineClass").value || null;
    openStockItemPicker({
      materialClassId: classVal ? Number(classVal) : null,
      onSelect: async (picked) => {
        backdrop.dataset.stockItemId = String(picked.stock_item_id);
        backdrop.dataset.uomId = String(picked.default_uom_id ?? "");
        qs("prAddLineItemText").textContent =
          `${picked.code} \u2014 ${picked.name}`;
        qs("prAddLineItemText").classList.remove("muted");
        qs("prAddLineItemChange").textContent = "Change";
        qs("prAddLineUomText").textContent = await fetchUomCode(
          picked.default_uom_id,
        );
      },
    });
  };
}

function closePrAddLineModal() {
  qs("prAddLineModalBackdrop").classList.remove("show");
  qs("prAddLineModalBackdrop").setAttribute("aria-hidden", "true");
}

async function savePrAddLine() {
  if (!state.selectedPr) {
    toast("No PR selected.", "error");
    return;
  }
  const backdrop = qs("prAddLineModalBackdrop");
  const stockItemId = Number(backdrop.dataset.stockItemId || "0");
  const uomId = Number(backdrop.dataset.uomId || "0");
  const qty = Number((qs("prAddLineQty").value || "").trim());
  const reason = (qs("prAddLineReason").value || "").trim() || null;
  const materialClassRaw = qs("prAddLineClass").value;
  const materialClassId = materialClassRaw ? Number(materialClassRaw) : null;
  if (!stockItemId) {
    toast("Select a stock item.", "error");
    return;
  }
  if (!uomId) {
    toast("UOM could not be determined. Re-select the stock item.", "error");
    return;
  }
  if (!qty || qty <= 0) {
    toast("Enter a valid requested qty.", "error");
    return;
  }
  setLoading(true);
  const { error } = await supabase.rpc("proc_pr_add_line", {
    p_pr_id: state.selectedPr.pr_id,
    p_material_class_id: materialClassId,
    p_stock_item_id: stockItemId,
    p_uom_id: uomId,
    p_requested_qty: qty,
    p_reason: reason,
  });
  setLoading(false);
  if (error) {
    toast(`Add line failed: ${error.message}`, "error");
    return;
  }
  toast("Line added.", "success");
  closePrAddLineModal();
  await loadPrLines(state.selectedPr.pr_id);
}

function openPrSetStatusModal(row, targetStatus) {
  const backdrop = qs("prSetStatusModalBackdrop");
  const titles = {
    active: "Activate PR",
    closed: "Close PR",
    cancelled: "Cancel PR",
  };
  qs("prSetStatusTitle").textContent =
    titles[targetStatus] ?? "Change PR Status";
  qs("prSetStatusItem").textContent = row.pr_number;
  qs("prSetStatusNote").value = "";
  backdrop.dataset.prId = String(row.pr_id);
  backdrop.dataset.targetStatus = targetStatus;
  backdrop.classList.add("show");
  backdrop.setAttribute("aria-hidden", "false");
}

function closePrSetStatusModal() {
  qs("prSetStatusModalBackdrop").classList.remove("show");
  qs("prSetStatusModalBackdrop").setAttribute("aria-hidden", "true");
}

async function confirmPrSetStatus() {
  const backdrop = qs("prSetStatusModalBackdrop");
  const prId = Number(backdrop.dataset.prId);
  const targetStatus = backdrop.dataset.targetStatus;
  const note = (qs("prSetStatusNote").value || "").trim() || null;
  setLoading(true);
  const { error } = await supabase.rpc("proc_pr_set_status", {
    p_pr_id: prId,
    p_status: targetStatus,
    p_note: note,
  });
  setLoading(false);
  if (error) {
    toast(`Status change failed: ${error.message}`, "error");
    return;
  }
  toast(`PR status set to ${targetStatus}.`, "success");
  closePrSetStatusModal();
  state.prPage = 0;
  await loadPrHeaders();
  if (state.selectedPr?.pr_id === prId) {
    await loadPrLines(prId);
  }
}

function wirePrControls() {
  qs("btnGeneratePr").addEventListener("click", openGeneratePrModal);
  // PR detail modal
  qs("btnPrViewClose").addEventListener("click", closePrViewModal);
  qs("btnPrExportForm").addEventListener("click", () => {
    if (!state.selectedPr) return;
    exportPrForm(state.selectedPr);
  });
  qs("prViewModalBackdrop").addEventListener("click", (e) => {
    if (e.target.id === "prViewModalBackdrop") closePrViewModal();
  });
  // Generate PR modal buttons
  qs("btnGenPrCancel").addEventListener("click", closeGeneratePrModal);
  qs("btnGenPrClose").addEventListener("click", closeGeneratePrModal);
  qs("btnGenPrConfirm").addEventListener("click", generateDraftPr);
  qs("generatePrModalBackdrop").addEventListener("click", (e) => {
    if (e.target.id === "generatePrModalBackdrop") closeGeneratePrModal();
  });
  qs("prBtnRefresh").addEventListener("click", () => {
    state.prPage = 0;
    loadPrHeaders();
  });
  qs("prBtnPrev").addEventListener("click", () => {
    state.prPage = Math.max(0, state.prPage - 1);
    loadPrHeaders();
  });
  qs("prBtnNext").addEventListener("click", () => {
    state.prPage += 1;
    loadPrHeaders();
  });
  ["prFilterStatus", "prFilterClass"].forEach((id) =>
    qs(id).addEventListener("change", () => {
      state.prPage = 0;
      loadPrHeaders();
    }),
  );
  qs("prSearch").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      state.prPage = 0;
      loadPrHeaders();
    }
  });

  // PR lines header actions
  qs("btnPrAddLine").addEventListener("click", () => {
    if (!state.selectedPr) {
      toast("Select a PR first.", "error");
      return;
    }
    if (state.selectedPr.status !== "draft") {
      toast("Locked after activation.", "error");
      return;
    }
    openPrAddLineModal();
  });
  qs("btnPrActivate").addEventListener("click", () => {
    if (!state.selectedPr) return;
    openPrSetStatusModal(state.selectedPr, "active");
  });
  qs("btnPrClosePr").addEventListener("click", () => {
    if (!state.selectedPr) return;
    const targetStatus =
      state.selectedPr.status === "draft" ? "cancelled" : "closed";
    openPrSetStatusModal(state.selectedPr, targetStatus);
  });
  qs("btnPrCreateIndent").addEventListener("click", createIndentFromSelectedPr);

  // PR edit modals
  qs("btnPrEditReqCancel").addEventListener("click", closePrEditRequestedModal);
  qs("btnPrEditReqSave").addEventListener("click", savePrEditRequested);
  qs("prEditReqModalBackdrop").addEventListener("click", (e) => {
    if (e.target.id === "prEditReqModalBackdrop") closePrEditRequestedModal();
  });
  qs("btnPrEditDeltaCancel").addEventListener("click", closePrEditDeltaModal);
  qs("btnPrEditDeltaSave").addEventListener("click", savePrEditDelta);
  qs("prEditDeltaModalBackdrop").addEventListener("click", (e) => {
    if (e.target.id === "prEditDeltaModalBackdrop") closePrEditDeltaModal();
  });
  qs("btnPrAddLineCancel").addEventListener("click", closePrAddLineModal);
  qs("btnPrAddLineSave").addEventListener("click", savePrAddLine);
  qs("prAddLineModalBackdrop").addEventListener("click", (e) => {
    if (e.target.id === "prAddLineModalBackdrop") closePrAddLineModal();
  });
  qs("btnPrSetStatusCancel").addEventListener("click", closePrSetStatusModal);
  qs("btnPrSetStatusConfirm").addEventListener("click", confirmPrSetStatus);
  qs("prSetStatusModalBackdrop").addEventListener("click", (e) => {
    if (e.target.id === "prSetStatusModalBackdrop") closePrSetStatusModal();
  });

  // Indent creation modals
  qs("btnCiCancel").addEventListener("click", closeCreateIndentModal);
  qs("btnCiCreate").addEventListener("click", saveCreateIndent);
  qs("createIndentModalBackdrop").addEventListener("click", (e) => {
    if (e.target.id === "createIndentModalBackdrop") closeCreateIndentModal();
  });
  qs("btnIfpCancel").addEventListener("click", closeIndentFromPrModal);
  qs("btnIfpCreate").addEventListener("click", saveIndentFromPr);
  qs("indentFromPrModalBackdrop").addEventListener("click", (e) => {
    if (e.target.id === "indentFromPrModalBackdrop") closeIndentFromPrModal();
  });

  // Indent add/edit line modal
  qs("btnIalCancel").addEventListener("click", closeIndentAddLineModal);
  qs("btnIalSave").addEventListener("click", saveIndentAddLine);
  qs("indentAddLineModalBackdrop").addEventListener("click", (e) => {
    if (e.target.id === "indentAddLineModalBackdrop") closeIndentAddLineModal();
  });
}

// ─── EXCESS TAB ───────────────────────────────────────────────────────────────

function renderExcess() {
  const tbody = qs("eTbody");
  tbody.innerHTML = "";
  for (const row of state.excessRows) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>
        <div>${esc(row.voucher_number ?? "")}</div>
        <div class="muted">${esc(row.voucher_date ?? "")}</div>
      </td>
      <td><b>${esc(row.stock_item_name ?? "")}</b></td>
      <td>${esc(row.material_class_code ?? "")}</td>
      <td>${fmt(row.purchase_qty)}</td>
      <td>${fmt(row.allocated_qty)}</td>
      <td>${fmt(row.unallocated_qty)}</td>
      <td>${fmt(row.accepted_qty)}</td>
      <td>${fmt(row.net_unallocated_qty)}</td>
      <td class="row-actions">
        <button data-act="accept">Accept</button>
      </td>
    `;
    tr.querySelector('[data-act="accept"]').addEventListener("click", (e) => {
      e.stopPropagation();
      openAcceptExcessModal(row);
    });
    tbody.appendChild(tr);
  }
  qs("eMeta").textContent = `Showing ${state.excessRows.length}`;
  qs("ePaging").textContent = `Page ${state.excessPage + 1}`;
  updateTabCount("tabCountExcess", state.excessRows.length);
}

async function loadExcess() {
  setLoading(true);
  const search = (qs("eSearch").value || "").trim();
  let q = supabase.from("v_proc_purchase_excess_console").select("*");
  if (search) q = q.ilike("stock_item_name", `%${search}%`);
  q = q
    .order("voucher_date", { ascending: false })
    .range(
      state.excessPage * state.pageSize,
      state.excessPage * state.pageSize + state.pageSize - 1,
    );
  const { data, error } = await q;
  setLoading(false);
  if (error) {
    toast(`Failed to load excess purchases: ${error.message}`, "error");
    return;
  }
  state.excessRows = data || [];
  renderExcess();
}

function renderExcessAudit() {
  const tbody = qs("eAuditTbody");
  tbody.innerHTML = "";
  for (const row of state.excessAuditRows) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${esc(row.accepted_at ?? row.created_at ?? "")}</td>
      <td>${esc(row.stock_item_name ?? "")}</td>
      <td>${fmt(row.accepted_qty)}</td>
      <td>${esc(row.reason ?? "")}</td>
      <td>${esc(row.accepted_by ?? row.user_email ?? "")}</td>
    `;
    tbody.appendChild(tr);
  }
}

async function loadExcessAudit() {
  const { data, error } = await supabase
    .from("v_proc_excess_acceptance_audit_console")
    .select("*")
    .order("accepted_at", { ascending: false })
    .limit(100);
  if (error) {
    console.error("Audit load error:", error);
    return;
  }
  state.excessAuditRows = data || [];
  renderExcessAudit();
}

function openAcceptExcessModal(row) {
  const backdrop = qs("acceptExcessModalBackdrop");
  backdrop.classList.add("show");
  backdrop.setAttribute("aria-hidden", "false");
  qs("acceptExcessItem").textContent = `${row.stock_item_name} — Voucher ${
    row.voucher_number ?? row.purchase_fact_id
  }`;
  qs("acceptExcessMax").textContent = fmt(row.net_unallocated_qty);
  qs("acceptExcessQty").value = "";
  qs("acceptExcessQty").max = String(row.net_unallocated_qty ?? "");
  qs("acceptExcessReason").value = "";
  backdrop.dataset.purchaseFactId = String(row.purchase_fact_id);
  backdrop.dataset.maxQty = String(row.net_unallocated_qty ?? 0);
}

function closeAcceptExcessModal() {
  const backdrop = qs("acceptExcessModalBackdrop");
  backdrop.classList.remove("show");
  backdrop.setAttribute("aria-hidden", "true");
}

async function saveAcceptExcess() {
  const backdrop = qs("acceptExcessModalBackdrop");
  const purchaseFactId = Number(backdrop.dataset.purchaseFactId);
  const maxQty = Number(backdrop.dataset.maxQty);
  const qtyText = (qs("acceptExcessQty").value || "").trim();
  const qty = Number(qtyText);
  if (!qtyText || Number.isNaN(qty) || qty <= 0) {
    toast("Enter a valid quantity greater than zero.", "error");
    return;
  }
  if (qty > maxQty) {
    toast(`Quantity cannot exceed max unallocated (${fmt(maxQty)}).`, "error");
    return;
  }
  const reason = (qs("acceptExcessReason").value || "").trim();
  if (!reason) {
    toast("Reason is required.", "error");
    return;
  }
  const { error } = await supabase.rpc("proc_indent_accept_excess", {
    p_purchase_fact_id: purchaseFactId,
    p_accept_qty: qty,
    p_reason: reason,
  });
  if (error) {
    toast(`Accept excess failed: ${error.message}`, "error");
    return;
  }
  toast("Excess accepted.", "success");
  closeAcceptExcessModal();
  await loadExcess();
  await loadExcessAudit();
}

function wireExcessControls() {
  qs("eBtnRefresh").addEventListener("click", () => {
    state.excessPage = 0;
    loadExcess();
    loadExcessAudit();
  });
  qs("eBtnPrev").addEventListener("click", () => {
    state.excessPage = Math.max(0, state.excessPage - 1);
    loadExcess();
  });
  qs("eBtnNext").addEventListener("click", () => {
    state.excessPage += 1;
    loadExcess();
  });
  qs("eSearch").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      state.excessPage = 0;
      loadExcess();
    }
  });
  qs("btnAcceptExcessCancel").addEventListener("click", closeAcceptExcessModal);
  qs("btnAcceptExcessSave").addEventListener("click", saveAcceptExcess);
  qs("acceptExcessModalBackdrop").addEventListener("click", (e) => {
    if (e.target.id === "acceptExcessModalBackdrop") closeAcceptExcessModal();
  });
}

// ─── VENDOR TAB ───────────────────────────────────────────────────────────────

async function loadVendorList() {
  if (state.vendorList.length) return; // cached
  const { data, error } = await supabase
    .from("proc_vendor")
    .select("vendor_id, display_name")
    .order("display_name", { ascending: true });
  if (!error) state.vendorList = data || [];
}

function filterVendorPick(filterText) {
  const pick = qs("mapVendorPick");
  pick.innerHTML = "";
  const lower = filterText.toLowerCase();
  const filtered = state.vendorList.filter(
    (v) => !lower || v.display_name.toLowerCase().includes(lower),
  );
  for (const v of filtered) {
    const opt = document.createElement("option");
    opt.value = String(v.vendor_id);
    opt.textContent = v.display_name;
    pick.appendChild(opt);
  }
}

function renderUnmappedAliases() {
  const tbody = qs("vTbody");
  tbody.innerHTML = "";
  for (const row of state.vendorsRows) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><b>${esc(row.alias_text ?? "")}</b></td>
      <td>${esc(row.source_system ?? "")}</td>
      <td><span class="pill">${esc(row.status ?? "")}</span></td>
      <td class="row-actions">
        <button data-act="create">Create + Map</button>
        <button data-act="mapexisting">Map Existing</button>
      </td>
    `;
    tr.querySelector('[data-act="create"]').addEventListener("click", (e) => {
      e.stopPropagation();
      openCreateVendorModal(row);
    });
    tr.querySelector('[data-act="mapexisting"]').addEventListener(
      "click",
      async (e) => {
        e.stopPropagation();
        await openMapVendorModal(row);
      },
    );
    tbody.appendChild(tr);
  }
  qs("vMeta").textContent = `Showing ${state.vendorsRows.length}`;
  qs("vPaging").textContent = `Page ${state.vendorsPage + 1}`;
  updateTabCount("tabCountVendors", state.vendorsRows.length);
}

async function loadUnmappedAliases() {
  setLoading(true);
  const search = (qs("vSearch").value || "").trim();
  let q = supabase.from(VENDOR_UNMAPPED_VIEW).select("*");
  if (search) q = q.ilike("alias_text", `%${search}%`);
  q = q
    .order("alias_text", { ascending: true })
    .range(
      state.vendorsPage * state.pageSize,
      state.vendorsPage * state.pageSize + state.pageSize - 1,
    );
  const { data, error } = await q;
  setLoading(false);
  if (error) {
    toast(`Failed to load unmapped aliases: ${error.message}`, "error");
    return;
  }
  state.vendorsRows = data || [];
  renderUnmappedAliases();
}

function openCreateVendorModal(row) {
  const backdrop = qs("createVendorModalBackdrop");
  backdrop.classList.add("show");
  backdrop.setAttribute("aria-hidden", "false");
  qs("createVendorAlias").textContent = `Alias: ${row.alias_text}`;
  qs("createVendorName").value = row.alias_text ?? "";
  backdrop.dataset.aliasText = row.alias_text ?? "";
  backdrop.dataset.sourceSystem = row.source_system ?? "";
}

function closeCreateVendorModal() {
  const backdrop = qs("createVendorModalBackdrop");
  backdrop.classList.remove("show");
  backdrop.setAttribute("aria-hidden", "true");
}

async function saveCreateVendor() {
  const backdrop = qs("createVendorModalBackdrop");
  const displayName = (qs("createVendorName").value || "").trim();
  if (!displayName) {
    toast("Vendor display name is required.", "error");
    return;
  }
  const { error } = await supabase.rpc(RPC_VENDOR_CREATE_AND_MAP, {
    p_display_name: displayName,
    p_alias_text: backdrop.dataset.aliasText,
    p_source_system: backdrop.dataset.sourceSystem,
  });
  if (error) {
    toast(`Create + map failed: ${error.message}`, "error");
    return;
  }
  toast("Vendor created and alias mapped.", "success");
  state.vendorList = []; // invalidate cache
  closeCreateVendorModal();
  await loadUnmappedAliases();
}

async function openMapVendorModal(row) {
  await loadVendorList();
  const backdrop = qs("mapVendorModalBackdrop");
  backdrop.classList.add("show");
  backdrop.setAttribute("aria-hidden", "false");
  qs("mapVendorAlias").textContent = `Alias: ${row.alias_text}`;
  qs("mapVendorFilter").value = "";
  filterVendorPick("");
  backdrop.dataset.aliasText = row.alias_text ?? "";
  backdrop.dataset.sourceSystem = row.source_system ?? "";
}

function closeMapVendorModal() {
  const backdrop = qs("mapVendorModalBackdrop");
  backdrop.classList.remove("show");
  backdrop.setAttribute("aria-hidden", "true");
}

async function saveMapVendor() {
  const backdrop = qs("mapVendorModalBackdrop");
  const vendorId = Number(qs("mapVendorPick").value || 0);
  if (!vendorId) {
    toast("Select a vendor from the list.", "error");
    return;
  }
  const { error } = await supabase.rpc(RPC_VENDOR_MAP_ALIAS, {
    p_vendor_id: vendorId,
    p_alias_text: backdrop.dataset.aliasText,
    p_source_system: backdrop.dataset.sourceSystem,
  });
  if (error) {
    toast(`Map failed: ${error.message}`, "error");
    return;
  }
  toast("Alias mapped to vendor.", "success");
  closeMapVendorModal();
  await loadUnmappedAliases();
}

function wireVendorControls() {
  qs("vBtnRefresh").addEventListener("click", () => {
    state.vendorsPage = 0;
    loadUnmappedAliases();
  });
  qs("vBtnPrev").addEventListener("click", () => {
    state.vendorsPage = Math.max(0, state.vendorsPage - 1);
    loadUnmappedAliases();
  });
  qs("vBtnNext").addEventListener("click", () => {
    state.vendorsPage += 1;
    loadUnmappedAliases();
  });
  qs("vSearch").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      state.vendorsPage = 0;
      loadUnmappedAliases();
    }
  });
  qs("btnCreateVendorCancel").addEventListener("click", closeCreateVendorModal);
  qs("btnCreateVendorSave").addEventListener("click", saveCreateVendor);
  qs("createVendorModalBackdrop").addEventListener("click", (e) => {
    if (e.target.id === "createVendorModalBackdrop") closeCreateVendorModal();
  });
  qs("btnMapVendorCancel").addEventListener("click", closeMapVendorModal);
  qs("btnMapVendorSave").addEventListener("click", saveMapVendor);
  qs("mapVendorModalBackdrop").addEventListener("click", (e) => {
    if (e.target.id === "mapVendorModalBackdrop") closeMapVendorModal();
  });
  qs("mapVendorFilter").addEventListener("input", (e) => {
    filterVendorPick(e.target.value);
  });
}

(async function main() {
  await requireSession();
  document
    .getElementById("homeBtn")
    ?.addEventListener("click", () => Platform.goHome());
  wireTabs();
  wireStockItemPicker();
  wireActionQueueControls();
  wireIndentControls();
  wireExcessControls();
  wireVendorControls();
  wirePrControls();
  await loadActionQueue();
  refreshAllTabCounts();
})();
