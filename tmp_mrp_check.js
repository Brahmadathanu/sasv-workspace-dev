  loadAccessContext,
  canEditPM,
  isProcurementAdmin,
  canEditRM,
  getActorSnapshot,
} from "./mrpAccess.js";
  ensureDetailModal,
  openDetailModal,
  closeDetailModal,
  showToast,
  showConfirm,
} from "./detailModal.js";

// Pagination state for MOQ list
let moqPage = 1;
let moqPageSize = 50;
let moqTotal = 0;
// Pagination state for Conversion list
let convPage = 1;
let convPageSize = 50;
let convTotal = 0;
// Pagination state for Season Profiles list
let seasonPage = 1;
let seasonPageSize = 50;
let seasonTotal = 0;

function showSection(name) {
  document.getElementById("moqSection").style.display =
    name === "moq" ? "" : "none";
  document.getElementById("convSection").style.display =
    name === "conv" ? "" : "none";
  document.getElementById("seasonSection").style.display =
    name === "season" ? "" : "none";
  document.getElementById("mapSection").style.display =
    name === "map" ? "" : "none";
  document.getElementById("auditSection").style.display =
    name === "audit" ? "" : "none";
}

async function init() {
  try {
    await loadAccessContext();
  } catch (e) {
    console.debug("loadAccessContext failed", e);
  }
  const canView = true; // future: check a viewer permission
  if (!canView) {
    document.body.innerHTML =
      '<div class="muted">No access to MRP Master Data Console</div>';
    return;
  }

  document.getElementById("tabMoq").addEventListener("click", () => {
    showSection("moq");
    loadMoqList();
  });
  document.getElementById("tabConv").addEventListener("click", () => {
    showSection("conv");
    loadConvList();
  });
  document.getElementById("tabSeason").addEventListener("click", () => {
    showSection("season");
    loadSeasonList();
  });
  document.getElementById("tabMap").addEventListener("click", () => {
    showSection("map");
    loadMapQuickEditor();
  });
  document.getElementById("tabAudit").addEventListener("click", () => {
    showSection("audit");
    loadAudit();
  });
  const hb = document.getElementById("homeBtn");
  if (hb) hb.addEventListener("click", () => Platform.goHome());
  // Load default active tab content on init
  showSection("moq");
  loadMoqList();
}

function actorSnapshot() {
  try {
    const a = window._mrpAccessActor || null;
    return a
      ? {
          actor_id: a.actor_id,
          actor_email: a.actor_email,
          actor_display: a.actor_display,
        }
      : {};
  } catch {
    return {};
  }
}

async function openMoqModal(row = {}) {
  ensureDetailModal();
  const root = document.getElementById("copilot-detail-modal");
  const title = root.querySelector("#copilot-modal-title");
  const sub = root.querySelector("#copilot-modal-sub");
  const body = root.querySelector("#copilot-modal-body");
  const actions = root.querySelector("#copilot-modal-actions");
  title.textContent = "Add MOQ Policy";
  sub.textContent = "Create a new minimum order quantity policy";
  actions.innerHTML = "";

  // Fetch stock items and UOMs for dropdowns
  body.innerHTML =
    '<div style="padding:20px;text-align:center;color:#6b7280">Loading...</div>';

  try {
    const [stockItemsRes, uomsRes] = await Promise.all([
      supabase
        .from("inv_stock_item")
        .select("id,code,name")
        .eq("active", true)
        .order("name"),
      supabase.from("inv_uom").select("id,code").order("code"),
    ]);

    const stockItems = stockItemsRes.data || [];
    const uoms = uomsRes.data || [];

    // Build stock item options - show only name for easy searching
    const stockItemOptions = stockItems
      .map(
        (item) =>
          `<option value="${item.id}" ${
            row.stock_item_id === item.id ? "selected" : ""
          }>${item.name}</option>`
      )
      .join("");

    // Build UOM options
    const uomOptions = uoms
      .map(
        (uom) =>
          `<option value="${uom.id}" ${
            row.uom_id === uom.id ? "selected" : ""
          }>${uom.code}</option>`
      )
      .join("");

    body.innerHTML = `
      <form id="moq_form" style="display:grid;grid-template-columns:1fr 1fr;gap:16px;padding:4px 0;box-sizing:border-box">
        <div style="display:flex;flex-direction:column;gap:6px;box-sizing:border-box">
          <label for="moq_stock_item_id" style="font-weight:600;color:#374151;font-size:0.9rem;display:block">Stock Item Name <span style="color:#dc2626">*</span></label>
          <select id="moq_stock_item_id" required style="width:100%;padding:10px 12px;border:1px solid #d1d5db;border-radius:6px;font-size:0.95rem;background:#fff;box-sizing:border-box">
            <option value="">-- Select Stock Item --</option>
            ${stockItemOptions}
          </select>
        </div>
        <div style="display:flex;flex-direction:column;gap:6px;box-sizing:border-box">
          <label for="moq_material_kind" style="font-weight:600;color:#374151;font-size:0.9rem;display:block">Material Kind <span style="color:#dc2626">*</span></label>
          <input id="moq_material_kind" list="moq_material_kind_list" type="text" required style="width:100%;padding:10px 12px;border:1px solid #d1d5db;border-radius:6px;font-size:0.95rem;box-sizing:border-box" value="${(
            row.material_kind || ""
          ).replace(/"/g, "&quot;")}"/>
        </div>
        <div style="display:flex;flex-direction:column;gap:6px;box-sizing:border-box">
          <label for="moq_moq_qty" style="font-weight:600;color:#374151;font-size:0.9rem;display:block">MOQ Quantity <span style="color:#dc2626">*</span></label>
          <input id="moq_moq_qty" type="number" step="any" required style="width:100%;padding:10px 12px;border:1px solid #d1d5db;border-radius:6px;font-size:0.95rem;box-sizing:border-box" value="${
            row.moq_qty || ""
          }"/>
        </div>
        <div style="display:flex;flex-direction:column;gap:6px;box-sizing:border-box">
          <label for="moq_uom_id" style="font-weight:600;color:#374151;font-size:0.9rem;display:block">UOM <span style="color:#dc2626">*</span></label>
          <select id="moq_uom_id" required style="width:100%;padding:10px 12px;border:1px solid #d1d5db;border-radius:6px;font-size:0.95rem;background:#fff;box-sizing:border-box">
            <option value="">-- Select UOM --</option>
            ${uomOptions}
          </select>
        </div>
        <div style="display:flex;flex-direction:column;gap:6px;box-sizing:border-box">
          <label for="moq_effective_from" style="font-weight:600;color:#374151;font-size:0.9rem;display:block">Effective From</label>
          <input id="moq_effective_from" type="date" style="width:100%;padding:10px 12px;border:1px solid #d1d5db;border-radius:6px;font-size:0.95rem;box-sizing:border-box" value="${
            row.effective_from || ""
          }"/>
        </div>
        <div style="display:flex;flex-direction:column;gap:6px;box-sizing:border-box">
          <label for="moq_effective_to" style="font-weight:600;color:#374151;font-size:0.9rem;display:block">Effective To</label>
          <input id="moq_effective_to" type="date" style="width:100%;padding:10px 12px;border:1px solid #d1d5db;border-radius:6px;font-size:0.95rem;box-sizing:border-box" value="${
            row.effective_to || ""
          }"/>
        </div>
        <div style="grid-column:1/3;display:flex;flex-direction:column;gap:6px;box-sizing:border-box">
          <label for="moq_note" style="font-weight:600;color:#374151;font-size:0.9rem;display:block">Note</label>
          <textarea id="moq_note" rows="3" style="width:100%;padding:10px 12px;border:1px solid #d1d5db;border-radius:6px;font-size:0.95rem;resize:vertical;box-sizing:border-box">${(
            row.note || ""
          ).replace(/</g, "&lt;")}</textarea>
        </div>
        <div style="display:flex;align-items:center;gap:8px;box-sizing:border-box">
          <input id="moq_is_active" type="checkbox" style="width:18px;height:18px;cursor:pointer;flex-shrink:0" ${
            row.is_active ? "checked" : ""
          }/>
          <label for="moq_is_active" style="margin-left:8px;color:#374151">Active</label>
        </div>
      </form>`;

    // MOQ list renderer
    async function loadMoqList() {
      const node = document.getElementById("moqSection");
      node.innerHTML = '<div class="muted">Loading MOQ policies...</div>';
      const page = moqPage || 1;
      const pageSize = moqPageSize || 50;
      const from = (page - 1) * pageSize;
      const to = page * pageSize - 1;
      let data = [];
      try {
        const res = await supabase
          .from("inv_stock_item_moq_policy")
          .select("*,stock_item:inv_stock_item(code,name),uom:inv_uom(code)", { count: "exact" })
          .order("updated_at", { ascending: false })
          .range(from, to);
        if (res.count !== null && res.count !== undefined) moqTotal = res.count;
        if (res.error) throw res.error;
        data = res.data || [];
      } catch (e) {
        console.debug(e);
        const node = document.getElementById("moqSection");
        node.innerHTML = `<div class="error">Failed loading MOQ policies: ${String(e?.message || e)}</div>`;
        return;
      }
      const totalPages = Math.max(1, Math.ceil((moqTotal || 0) / pageSize));
      let html = "";

      // paginator + row count row: left = row count pill, right = simple paginator
      html +=
      `<div style="display:flex;justify-content:space-between;align-items:center;margin:6px 0 12px 0">` +
      `<div style="display:flex;align-items:center">` +
      `<span id="moqRowCount" style="display:inline-flex;align-items:center;justify-content:center;height:32px;padding:0 12px;border-radius:999px;background:rgba(59,130,246,0.08);color:#0b3a9a;font-weight:600;font-size:0.9rem;margin-left:8px">0 Rows</span>` +
      `</div>` +
      `<div id="moqPaginator" style="display:flex;gap:8px;align-items:center">` +
      `<button id="moqPrev" class="mrp-btn mrp-btn-ghost" style="padding:6px 10px">‹</button>` +
      `<span id="moqPagerInfo">Page ${page} of ${totalPages}</span>` +
      `<button id="moqNext" class="mrp-btn mrp-btn-ghost" style="padding:6px 10px">›</button>` +
      `</div></div>`;

    html +=
      '<div id="mrpTableContainer">' +
      '<table id="mrpTable_moq" class="mrp-table" style="width:100%;border-collapse:collapse;table-layout:fixed">' +
      "<thead><tr>" +
      '<th style="width:8%;text-align:center;">POLICY ID</th>' +
      '<th style="width:8%;text-align:center;">STOCK ITEM ID</th>' +
      '<th style="width:8%;text-align:center;">Code</th>' +
      '<th style="width:44%;text-align:left;">Name</th>' +
      '<th style="width:10%;text-align:center;">Material Kind</th>' +
      '<th style="width:8%;text-align:center;">MOQ</th>' +
      '<th style="width:7%;text-align:center;">UOM</th>' +
      '<th style="width:7%;text-align:center;">Active</th>' +
      "</tr></thead><tbody>";
    data.forEach((r) => {
      const idCell = r.id || "";
      const codeCell = (r.stock_item && (r.stock_item.code || "")) || "";
      const nameCell = (r.stock_item && (r.stock_item.name || "")) || "";
      const safeName = String(nameCell)
        .replace(/"/g, "&quot;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
      const stockItemIdCell = r.stock_item_id || "";
      const materialKind = r.material_kind || "";
      const moq = r.moq_qty || "";
      const uomCode = (r.uom && r.uom.code) || r.uom_id || "";
      const active = r.is_active ? "Yes" : "No";
      html += `<tr data-id="${r.id}" style="cursor:pointer">`;
      html += `<td style="text-align:center;vertical-align:middle;padding:10px">${idCell}</td>`; // POLICY ID
      html += `<td style="text-align:center;vertical-align:middle;padding:10px">${stockItemIdCell}</td>`; // STOCK ITEM ID
      html += `<td style="text-align:center;vertical-align:middle;padding:10px">${codeCell}</td>`;
      html += `<td style="text-align:left;vertical-align:middle;padding:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${safeName}">${safeName}</td>`;
      html += `<td style="text-align:center;vertical-align:middle;padding:10px">${materialKind}</td>`;
      html += `<td style="text-align:center;vertical-align:middle;padding:10px">${moq}</td>`;
      html += `<td style="text-align:center;vertical-align:middle;padding:10px">${uomCode}</td>`;
      html += `<td style="text-align:center;vertical-align:middle;padding:10px">${active}</td>`;
      html += `</tr>`;
    });
    html += "</tbody></table></div>";
    node.innerHTML = html;
    // adjust conversion header sticky offsets so the two header rows do not
    // overlap body rows and appear transparent — measure actual heights
    // and set precise `top` values on the header <th> elements.
    window.__adjustConvHeaderSticky =
      window.__adjustConvHeaderSticky ||
      function adjustConvHeaderSticky() {
        const table = document.getElementById("mrpTable_conv");
        if (!table) return;
        // defer to next frame so the browser lays out the newly-inserted table
        requestAnimationFrame(() => {
          const thead = table.querySelector("thead");
          if (!thead) return;
          const firstRow = thead.querySelector("tr:first-child");
          const secondRow = thead.querySelector("tr:nth-child(2)");
          const firstHeight = firstRow
            ? Math.ceil(firstRow.getBoundingClientRect().height)
            : 0;

          if (firstRow) {
            Array.from(firstRow.querySelectorAll("th")).forEach((th) => {
              th.style.position = "sticky";
              th.style.top = "0px";
              th.style.zIndex = "1100";
              th.style.boxShadow = "0 2px 8px rgba(2,6,23,0.06)";
              th.style.borderBottom = "1px solid rgba(2,6,23,0.06)";
              th.style.backgroundClip = "padding-box";
            });
          }
          if (secondRow) {
            Array.from(secondRow.querySelectorAll("th")).forEach((th) => {
              th.style.position = "sticky";
              th.style.top = firstHeight + "px";
              th.style.zIndex = "1099";
              th.style.borderBottom = "1px solid rgba(2,6,23,0.06)";
              th.style.backgroundClip = "padding-box";
            });
          }
        });
      };
    // call once, and register a resize listener once to recompute when layout changes
    window.__adjustConvHeaderSticky();
    if (!window.__convHeaderResizeRegistered) {
      window.addEventListener("resize", window.__adjustConvHeaderSticky);
      window.__convHeaderResizeRegistered = true;
    }
    // No synchronization needed - group headers are part of the table with colspan

    // wire search input (hybrid: stock item id, code, or name) + row counter + paginator
    const searchEl = document.getElementById("moqSearch");
    const updateRowCount = () => {
      const table = node.querySelector("#mrpTable_moq");
      const pill = document.getElementById("moqRowCount");
      const pagerInfo = document.getElementById("moqPagerInfo");
      const prevBtn = document.getElementById("moqPrev");
      const nextBtn = document.getElementById("moqNext");
      if (!table || !pill) return;
      const visible = Array.from(table.querySelectorAll("tbody tr")).filter(
        (tr) => getComputedStyle(tr).display !== "none"
      ).length;
      pill.textContent = `${visible} Row${visible === 1 ? "" : "s"}`;
      if (pagerInfo)
        pagerInfo.textContent = `Page ${moqPage} of ${Math.max(
          1,
          Math.ceil((moqTotal || 0) / moqPageSize)
        )}`;
      if (prevBtn) prevBtn.disabled = moqPage <= 1;
      if (nextBtn)
        nextBtn.disabled =
          moqPage >= Math.max(1, Math.ceil((moqTotal || 0) / moqPageSize));
    };
    if (searchEl) {
      const debounce = (fn, ms = 200) => {
        let t;
        return (...a) => {
          clearTimeout(t);
          t = setTimeout(() => fn(...a), ms);
        };
      };
      const filterRows = () => {
        const q = (searchEl.value || "").toLowerCase().trim();
        const rows = node.querySelectorAll("tbody tr");
        rows.forEach((tr) => {
          const cells = tr.querySelectorAll("td");
          const stockId = (
            (cells[1] && cells[1].textContent) ||
            ""
          ).toLowerCase();
          const code = ((cells[2] && cells[2].textContent) || "").toLowerCase();
          const name = ((cells[3] && cells[3].textContent) || "").toLowerCase();
          const ok =
            !q || stockId.includes(q) || code.includes(q) || name.includes(q);
          tr.style.display = ok ? "" : "none";
        });
        updateRowCount();
      };
      searchEl.addEventListener("input", debounce(filterRows, 150));
    }
    // initialize count after render
    setTimeout(updateRowCount, 60);

    // sticky header handled by CSS; no floating clone
    const addBtn = document.getElementById("addMoq");
    if (addBtn) addBtn.addEventListener("click", () => openMoqModal());

    // Export visible rows as CSV (respect client-side filtering)
    const exportBtn = document.getElementById("exportMoqCsv");
    if (exportBtn) {
      exportBtn.addEventListener("click", () => {
        const table = document.getElementById("mrpTable_moq");
        if (!table) return showToast("No table to export", "error");
        const headers = Array.from(table.querySelectorAll("thead th")).map(
          (th) => (th.textContent || th.innerText || "").trim()
        );
        const rows = Array.from(table.querySelectorAll("tbody tr")).filter(
          (tr) => getComputedStyle(tr).display !== "none"
        );
        if (!rows.length)
          return showToast("No visible rows to export", "error");
        const csv = [];
        csv.push(
          headers
            .map((h) => '"' + String(h).replace(/"/g, '""') + '"')
            .join(",")
        );
        rows.forEach((tr) => {
          const cells = Array.from(tr.querySelectorAll("td")).map(
            (td) =>
              '"' +
              String((td.textContent || td.innerText || "").trim()).replace(
                /"/g,
                '""'
              ) +
              '"'
          );
          csv.push(cells.join(","));
        });
        const blob = new Blob([csv.join("\n")], {
          type: "text/csv;charset=utf-8;",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `moq_policies_export_${new Date()
          .toISOString()
          .slice(0, 19)
          .replace(/[:T]/g, "-")}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        showToast("Export started", "success");
      });
    }

    // paginator wiring (simplified)
    const prevBtn = document.getElementById("moqPrev");
    const nextBtn = document.getElementById("moqNext");
    if (prevBtn)
      prevBtn.addEventListener("click", () => {
        if (moqPage > 1) {
          moqPage -= 1;
          loadMoqList();
        }
      });
    if (nextBtn)
      nextBtn.addEventListener("click", () => {
        const maxPage = Math.max(1, Math.ceil((moqTotal || 0) / moqPageSize));
        if (moqPage < maxPage) {
          moqPage += 1;
          loadMoqList();
        }
      });

    Array.from(node.querySelectorAll("tbody tr")).forEach((tr) =>
      tr.addEventListener("click", async () => {
        const id = tr.dataset.id;
        try {
          const { data } = await supabase
            .from("inv_stock_item_moq_policy")
            .select("*,stock_item:inv_stock_item(code,name),uom:inv_uom(code)")
            .eq("id", id)
            .limit(1);
          const row = data && data[0] ? data[0] : { id };
          showMoqDetail(row);
        } catch (err) {
          console.debug(err);
        }
      })
    );
}

async function loadConvList() {
  const node = document.getElementById("convSection");
  node.innerHTML = '<div class="muted">Loading conversions...</div>';
  try {
    const page = convPage || 1;
    const pageSize = convPageSize || 50;
    const from = (page - 1) * pageSize;
    const to = page * pageSize - 1;
    const { data, error, count } = await supabase
      .from("inv_rm_form_conversion")
      .select(
        "*,consume_stock_item:inv_stock_item!inv_rm_form_conversion_consume_stock_item_id_fkey(code,name),purchase_stock_item:inv_stock_item!inv_rm_form_conversion_purchase_stock_item_id_fkey(code,name)",
        { count: "exact" }
      )
      .order("updated_at", { ascending: false })
      .range(from, to);
    if (count !== null && count !== undefined) convTotal = count;
    if (error) throw error;
    if (!data || !data.length) {
      node.innerHTML = '<div class="muted">No conversions</div>';
      return;
    }
    const totalPages = Math.max(1, Math.ceil((convTotal || 0) / pageSize));

    // inline SVGs
    const svgAdd =
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M12 5v14M5 12h14" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    const svgExport =
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke="#0f172a" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M7 10l5-5 5 5" stroke="#0f172a" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 5v12" stroke="#0f172a" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

    let html =
      '<div style="display:flex;justify-content:space-between;align-items:center;margin:0 0 6px 0">' +
      // left: search
      '<div style="display:flex;gap:8px;align-items:center">' +
      '<input id="convSearch" placeholder="Type in to search..." title="Type Consume Stock Item ID, Code or Name to search" style="padding:8px 12px;border:1px solid #d1d5db;border-radius:6px;font-size:0.95rem;min-width:220px;margin-right:12px"/>' +
      "</div>" +
      // right: icon-only add + export
      '<div style="display:flex;gap:8px;align-items:center">' +
      `<button id="addConv" class="mrp-btn mrp-btn-primary" title="Add conversion" aria-label="Add conversion" style="width:40px;height:40px;display:inline-flex;align-items:center;justify-content:center;padding:6px">${svgAdd}</button>` +
      `<button id="exportConvCsv" class="mrp-btn mrp-btn-ghost" title="Export CSV" aria-label="Export CSV" style="width:40px;height:40px;display:inline-flex;align-items:center;justify-content:center;padding:6px;margin-left:8px">${svgExport}</button>` +
      "</div>" +
      "</div>";

    // paginator + row count row
    html +=
      `<div style="display:flex;justify-content:space-between;align-items:center;margin:6px 0 12px 0">` +
      `<div style="display:flex;align-items:center">` +
      `<span id="convRowCount" style="display:inline-flex;align-items:center;justify-content:center;height:32px;padding:0 12px;border-radius:999px;background:rgba(59,130,246,0.08);color:#0b3a9a;font-weight:600;font-size:0.9rem;margin-left:8px">0 Rows</span>` +
      `</div>` +
      `<div id="convPaginator" style="display:flex;gap:8px;align-items:center">` +
      `<button id="convPrev" class="mrp-btn mrp-btn-ghost" style="padding:6px 10px">‹</button>` +
      `<span id="convPagerInfo">Page ${page} of ${totalPages}</span>` +
      `<button id="convNext" class="mrp-btn mrp-btn-ghost" style="padding:6px 10px">›</button>` +
      `</div></div>`;

    html +=
      '<div id="mrpTableContainer">' +
      '<table id="mrpTable_conv" class="mrp-table" style="width:100%;border-collapse:collapse;table-layout:fixed">' +
      "<thead>" +
      // Group header row with colspan (ERP-style)
      "<tr class='conv-group-header-row'>" +
      '<th colspan="3" style="text-align:center;padding:10px 8px;font-weight:700;font-size:0.95rem;color:#0a3a7a;background:linear-gradient(180deg,#e0f0ff 0%,#d4e9ff 100%)">Consuming Form</th>' +
      '<th colspan="3" style="text-align:center;padding:10px 8px;font-weight:700;font-size:0.95rem;color:#0d5c2f;background:linear-gradient(180deg,#e8f8ed 0%,#dcf4e4 100%)">Purchase Form</th>' +
      '<th colspan="2" style="padding:10px 8px;background:#fafafa"></th>' +
      "</tr>" +
      // Column header row (short labels)
      "<tr>" +
      '<th style="width:8%;text-align:center;padding:8px;color:#0f172a;background:#f8fbff">ID</th>' +
      '<th style="width:12%;text-align:center;padding:8px;color:#0f172a;background:#f8fbff">Code</th>' +
      '<th style="width:24%;text-align:left;padding:8px;color:#0f172a;background:#f8fbff;border-right:2px solid #93c5fd">Name</th>' +
      '<th style="width:8%;text-align:center;padding:8px;color:#0f172a;background:#f0fdf4">ID</th>' +
      '<th style="width:12%;text-align:center;padding:8px;color:#0f172a;background:#f0fdf4">Code</th>' +
      '<th style="width:24%;text-align:left;padding:8px;color:#0f172a;background:#f0fdf4;border-right:2px solid #86efac">Name</th>' +
      '<th style="width:6%;text-align:center;padding:8px;color:#0f172a;background:#fafafa">FACTOR</th>' +
      '<th style="width:6%;text-align:center;padding:8px;color:#0f172a;background:#fafafa">ACTIVE</th>' +
      "</tr></thead><tbody>";
    (data || []).forEach((r) => {
      const safeConsumeName =
        r.consume_stock_item && r.consume_stock_item.name
          ? String(r.consume_stock_item.name)
              .replace(/"/g, "&quot;")
              .replace(/</g, "&lt;")
          : "";
      const consumeCode =
        (r.consume_stock_item && r.consume_stock_item.code) || "";
      const safePurchaseName =
        r.purchase_stock_item && r.purchase_stock_item.name
          ? String(r.purchase_stock_item.name)
              .replace(/"/g, "&quot;")
              .replace(/</g, "&lt;")
          : "";
      const purchaseCode =
        (r.purchase_stock_item && r.purchase_stock_item.code) || "";
      html += `<tr data-id="${r.id}" style="cursor:pointer">`;
      // consuming group columns (apply consuming-col class)
      html += `<td class="consuming-col" style="text-align:center;vertical-align:middle;padding:10px">${
        r.consume_stock_item_id || ""
      }</td>`;
      html += `<td class="consuming-col" style="text-align:center;vertical-align:middle;padding:10px">${consumeCode}</td>`;
      html += `<td class="consuming-col" style="text-align:left;vertical-align:middle;padding:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${safeConsumeName}">${safeConsumeName}</td>`;
      // purchase group columns (apply purchase-col class)
      html += `<td class="purchase-col" style="text-align:center;vertical-align:middle;padding:10px">${
        r.purchase_stock_item_id || ""
      }</td>`;
      html += `<td class="purchase-col" style="text-align:center;vertical-align:middle;padding:10px">${purchaseCode}</td>`;
      html += `<td class="purchase-col" style="text-align:left;vertical-align:middle;padding:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${safePurchaseName}">${safePurchaseName}</td>`;
      // neutral columns
      html += `<td style="text-align:center;vertical-align:middle;padding:10px">${
        r.factor || ""
      }</td>`;
      html += `<td style="text-align:center;vertical-align:middle;padding:10px">${
        r.is_active ? "Yes" : "No"
      }</td>`;
      html += `</tr>`;
    });
    html += "</tbody></table></div>";
    node.innerHTML = html;
    const addBtn = document.getElementById("addConv");
    if (addBtn) addBtn.addEventListener("click", () => openConvEditModal());

    // Export visible rows as CSV
    const exportBtn = document.getElementById("exportConvCsv");
    if (exportBtn) {
      exportBtn.addEventListener("click", () => {
        const table = document.getElementById("mrpTable_conv");
        if (!table) return showToast("No table to export", "error");
        const headers = Array.from(table.querySelectorAll("thead th")).map(
          (th) => (th.textContent || th.innerText || "").trim()
        );
        const rows = Array.from(table.querySelectorAll("tbody tr")).filter(
          (tr) => getComputedStyle(tr).display !== "none"
        );
        if (!rows.length)
          return showToast("No visible rows to export", "error");
        const csv = [];
        csv.push(
          headers
            .map((h) => '"' + String(h).replace(/"/g, '""') + '"')
            .join(",")
        );
        rows.forEach((tr) => {
          const cells = Array.from(tr.querySelectorAll("td")).map(
            (td) =>
              '"' +
              String((td.textContent || td.innerText || "").trim()).replace(
                /"/g,
                '""'
              ) +
              '"'
          );
          csv.push(cells.join(","));
        });
        const blob = new Blob([csv.join("\n")], {
          type: "text/csv;charset=utf-8;",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `conversions_export_${new Date()
          .toISOString()
          .slice(0, 19)
          .replace(/[:T]/g, "-")}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        showToast("Export started", "success");
      });
    }

    // search + row count + paginator wiring
    const searchEl = document.getElementById("convSearch");
    const updateRowCount = () => {
      const table = node.querySelector("#mrpTable_conv");
      const pill = document.getElementById("convRowCount");
      const pagerInfo = document.getElementById("convPagerInfo");
      const prevBtn = document.getElementById("convPrev");
      const nextBtn = document.getElementById("convNext");
      if (!table || !pill) return;
      const visible = Array.from(table.querySelectorAll("tbody tr")).filter(
        (tr) => getComputedStyle(tr).display !== "none"
      ).length;
      pill.textContent = `${visible} Row${visible === 1 ? "" : "s"}`;
      if (pagerInfo)
        pagerInfo.textContent = `Page ${convPage} of ${Math.max(
          1,
          Math.ceil((convTotal || 0) / convPageSize)
        )}`;
      if (prevBtn) prevBtn.disabled = convPage <= 1;
      if (nextBtn)
        nextBtn.disabled =
          convPage >= Math.max(1, Math.ceil((convTotal || 0) / convPageSize));
    };
    if (searchEl) {
      const debounce = (fn, ms = 200) => {
        let t;
        return (...a) => {
          clearTimeout(t);
          t = setTimeout(() => fn(...a), ms);
        };
      };
      const filterRows = () => {
        const q = (searchEl.value || "").toLowerCase().trim();
        const rows = node.querySelectorAll("tbody tr");
        rows.forEach((tr) => {
          const cells = tr.querySelectorAll("td");
          // consume columns: index 0 (ID), 1 (Code), 2 (Name)
          const id = ((cells[0] && cells[0].textContent) || "").toLowerCase();
          const code = ((cells[1] && cells[1].textContent) || "").toLowerCase();
          const name = ((cells[2] && cells[2].textContent) || "").toLowerCase();
          const ok =
            !q || id.includes(q) || code.includes(q) || name.includes(q);
          tr.style.display = ok ? "" : "none";
        });
        updateRowCount();
      };
      searchEl.addEventListener("input", debounce(filterRows, 150));
    }
    setTimeout(updateRowCount, 60);

    // paginator wiring
    const prevBtn = document.getElementById("convPrev");
    const nextBtn = document.getElementById("convNext");
    if (prevBtn)
      prevBtn.addEventListener("click", () => {
        if (convPage > 1) {
          convPage -= 1;
          loadConvList();
        }
      });
    if (nextBtn)
      nextBtn.addEventListener("click", () => {
        const maxPage = Math.max(1, Math.ceil((convTotal || 0) / convPageSize));
        if (convPage < maxPage) {
          convPage += 1;
          loadConvList();
        }
      });

    // row click opens modal
    Array.from(node.querySelectorAll("tbody tr")).forEach((tr) =>
      tr.addEventListener("click", async () => {
        const id = tr.dataset.id;
        try {
          const { data } = await supabase
            .from("inv_rm_form_conversion")
            .select(
              "*,consume_stock_item:inv_stock_item!inv_rm_form_conversion_consume_stock_item_id_fkey(code,name),purchase_stock_item:inv_stock_item!inv_rm_form_conversion_purchase_stock_item_id_fkey(code,name)"
            )
            .eq("id", id)
            .limit(1);
          const row = data && data[0] ? data[0] : { id };
          showConvDetail(row);
        } catch (e) {
          console.debug(e);
        }
      })
    );
  } catch (e) {
    console.debug(e);
    node.innerHTML = `<div class="error">Failed loading conversions: ${String(
      e?.message || e
    )}</div>`;
  }
}

// (removed unused openConvModal - replaced by showConvDetail/openConvEditModal)

// Detail modal (view) for a conversion row — similar layout to MOQ detail view
async function showConvDetail(row = {}) {
  ensureDetailModal();
  const root = document.getElementById("copilot-detail-modal");
  const title = root.querySelector("#copilot-modal-title");
  const sub = root.querySelector("#copilot-modal-sub");
  const body = root.querySelector("#copilot-modal-body");
  const actions = root.querySelector("#copilot-modal-actions");

  title.textContent = "Conversion";
  sub.textContent = "Conversion rule details";
  actions.innerHTML = "";
  body.innerHTML =
    '<div style="padding:20px;text-align:center;color:#6b7280">Loading...</div>';

  // fetch related stock item names if not embedded
  try {
    if (!row.consume_stock_item && row.consume_stock_item_id) {
      const { data } = await supabase
        .from("inv_stock_item")
        .select("code,name")
        .eq("id", row.consume_stock_item_id)
        .limit(1);
      if (data && data[0]) row.consume_stock_item = data[0];
    }
    if (!row.purchase_stock_item && row.purchase_stock_item_id) {
      const { data } = await supabase
        .from("inv_stock_item")
        .select("code,name")
        .eq("id", row.purchase_stock_item_id)
        .limit(1);
      if (data && data[0]) row.purchase_stock_item = data[0];
    }
  } catch (e) {
    console.debug("Failed to fetch related stock items", e);
  }

  const consumeDisplay = row.consume_stock_item
    ? `${row.consume_stock_item.code || ""} - ${
        row.consume_stock_item.name || ""
      }`
    : `ID: ${row.consume_stock_item_id || "N/A"}`;
  const purchaseDisplay = row.purchase_stock_item
    ? `${row.purchase_stock_item.code || ""} - ${
        row.purchase_stock_item.name || ""
      }`
    : `ID: ${row.purchase_stock_item_id || "N/A"}`;

  body.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;padding:8px;box-sizing:border-box">
      <div style="grid-column:1/3;padding:12px;background:#f8fafc;border-radius:6px;border-left:4px solid #0f172a">
        <div style="font-size:0.85rem;color:#6b7280;margin-bottom:4px">Conversion ID</div>
        <div style="font-weight:600;color:#0f172a">${row.id || "(new)"}</div>
      </div>

      <div style="display:flex;flex-direction:column;gap:6px">
        <div style="font-weight:600;color:#374151;font-size:0.9rem">Consuming Item</div>
        <div style="color:#0f172a">${consumeDisplay}</div>
      </div>

      <div style="display:flex;flex-direction:column;gap:6px">
        <div style="font-weight:600;color:#374151;font-size:0.9rem">Purchase Item</div>
        <div style="color:#0f172a">${purchaseDisplay}</div>
      </div>

      <div style="display:flex;flex-direction:column;gap:6px">
        <div style="font-weight:600;color:#374151;font-size:0.9rem">Factor</div>
        <div style="color:#0f172a">${row.factor ?? ""}</div>
      </div>

      <div style="display:flex;align-items:center;gap:8px">
        <div style="width:14px;height:14px;border-radius:3px;background:${
          row.is_active ? "#16a34a" : "#9ca3af"
        };"></div>
        <div style="font-weight:600;color:#374151">${
          row.is_active ? "Active" : "Inactive"
        }</div>
      </div>

      <div style="grid-column:1/3;margin-top:8px">
        <div style="font-weight:600;color:#374151;font-size:0.9rem;margin-bottom:6px">Note</div>
        <div style="color:#0f172a;white-space:pre-wrap">${(
          row.note || ""
        ).replace(/</g, "&lt;")}</div>
      </div>
    </div>
  `;

  // actions: Edit + Delete
  const btnEdit = document.createElement("button");
  btnEdit.className = "mrp-btn mrp-btn-secondary";
  btnEdit.textContent = "Edit";
  btnEdit.addEventListener("click", () => openConvEditModal(row));

  const btnDelete = document.createElement("button");
  btnDelete.className = "mrp-btn mrp-btn-danger";
  btnDelete.textContent = "Delete";
  btnDelete.addEventListener("click", async () => {
    const ok = await showConfirm("Delete this conversion?", "Confirm delete");
    if (!ok) return;
    try {
      const { error } = await supabase
        .from("inv_rm_form_conversion")
        .delete()
        .eq("id", row.id);
      if (error) throw error;
      showToast("Deleted", "success");
      closeDetailModal();
      await loadConvList();
    } catch (e) {
      console.debug(e);
      showToast("Delete failed", "error");
    }
  });

  actions.appendChild(btnEdit);
  actions.appendChild(btnDelete);
  root.style.display = "flex";
}

// Secondary modal: edit/create conversion (two-column form)
async function openConvEditModal(row = {}) {
  ensureDetailModal();
  const root = document.getElementById("copilot-detail-modal");
  const title = root.querySelector("#copilot-modal-title");
  const sub = root.querySelector("#copilot-modal-sub");
  const body = root.querySelector("#copilot-modal-body");
  const actions = root.querySelector("#copilot-modal-actions");
  title.textContent =
    row && row.id ? `Edit conversion — ${row.id}` : "Add conversion";
  sub.textContent = "Conversion editor";
  actions.innerHTML = "";

  body.innerHTML =
    '<div style="padding:20px;text-align:center;color:#6b7280">Loading...</div>';
  try {
    // load stock items for selects
    const { data: stockItems = [] } = await supabase
      .from("inv_stock_item")
      .select("id,code,name")
      .eq("active", true)
      .order("name");

    const opts = stockItems
      .map(
        (s) =>
          `<option value="${s.id}" ${
            row.consume_stock_item_id === s.id ||
            row.purchase_stock_item_id === s.id
              ? "selected"
              : ""
          }>${s.code} - ${s.name}</option>`
      )
      .join("");

    body.innerHTML =
      `
      <form id="conv_edit_form" style="display:grid;grid-template-columns:1fr 1fr;gap:16px;padding:12px;box-sizing:border-box">
        <div style="display:flex;flex-direction:column;gap:6px">
          <label for="conv_consume_id" style="font-weight:600;color:#374151">Consuming Stock Item</label>
          <select id="conv_consume_id" required style="padding:10px;border:1px solid #d1d5db;border-radius:6px">` +
      `<option value="">-- Select --</option>${opts}` +
      `</select>
        </div>
        <div style="display:flex;flex-direction:column;gap:6px">
          <label for="conv_purchase_id" style="font-weight:600;color:#374151">Purchase Stock Item</label>
          <select id="conv_purchase_id" required style="padding:10px;border:1px solid #d1d5db;border-radius:6px">` +
      `<option value="">-- Select --</option>${opts}` +
      `</select>
        </div>
        <div style="display:flex;flex-direction:column;gap:6px">
          <label for="conv_factor" style="font-weight:600;color:#374151">Factor</label>
          <input id="conv_factor" type="number" step="any" style="padding:10px;border:1px solid #d1d5db;border-radius:6px" value="${
            row.factor || ""
          }" />
        </div>
        <div style="display:flex;align-items:flex-end;gap:8px;padding-left:8px">
          <input id="conv_is_active" type="checkbox" style="width:18px;height:18px;margin-bottom:6px" ${
            row.is_active ? "checked" : ""
          } />
          <label for="conv_is_active" style="font-weight:600;color:#374151;margin-bottom:6px">Active</label>
        </div>
        <div style="grid-column:1/3">
          <label for="conv_notes" style="font-weight:600;color:#374151">Note</label>
          <textarea id="conv_notes" rows="3" style="width:100%;padding:10px;border:1px solid #d1d5db;border-radius:6px">${(
            row.notes || ""
          ).replace(/</g, "&lt;")}</textarea>
        </div>
      </form>
    `;

    // pre-select values if editing
    if (row.consume_stock_item_id)
      document.getElementById("conv_consume_id").value =
        row.consume_stock_item_id;
    if (row.purchase_stock_item_id)
      document.getElementById("conv_purchase_id").value =
        row.purchase_stock_item_id;
  } catch (e) {
    console.debug(e);
    body.innerHTML =
      '<div style="padding:20px;color:#dc2626">Failed to load form data</div>';
    return;
  }

  const btnSave = document.createElement("button");
  btnSave.className = "mrp-btn mrp-btn-primary";
  btnSave.textContent = "Save";
  btnSave.addEventListener("click", async (ev) => {
    ev.preventDefault();
    if (!(isProcurementAdmin() || canEditPM()))
      return showToast("No permission", "warning");
    try {
      const payload = {
        id: row.id || null,
        consume_stock_item_id:
          Number(document.getElementById("conv_consume_id").value) || null,
        purchase_stock_item_id:
          Number(document.getElementById("conv_purchase_id").value) || null,
        factor: Number(document.getElementById("conv_factor").value) || null,
        is_active: !!document.getElementById("conv_is_active").checked,
        notes: document.getElementById("conv_notes").value || null,
      };
      Object.assign(payload, actorSnapshot());
      const { error } = await supabase
        .from("inv_rm_form_conversion")
        .upsert(payload);
      if (error) throw error;
      showToast("Saved", "success");
      closeDetailModal();
      await loadConvList();
    } catch (e) {
      console.debug(e);
      showToast("Save failed", "error");
    }
  });

  const btnCancel = document.createElement("button");
  btnCancel.className = "mrp-btn mrp-btn-ghost";
  btnCancel.textContent = "Cancel";
  btnCancel.addEventListener("click", (ev) => {
    ev.preventDefault();
    // return to detail view if editing existing row
    if (row && row.id) showConvDetail(row);
    else closeDetailModal();
  });

  actions.appendChild(btnCancel);
  actions.appendChild(btnSave);
  root.style.display = "flex";
}

async function loadSeasonList() {
  const node = document.getElementById("seasonSection");
  node.innerHTML = '<div class="muted">Loading season profiles...</div>';
  try {
    const page = seasonPage || 1;
    const pageSize = seasonPageSize || 50;
    const from = (page - 1) * pageSize;
    const to = page * pageSize - 1;

    // server-side fetch using combined view for summary (v_season_calendar)
    const { data, error, count } = await supabase
      .from("v_season_calendar")
      .select("*", { count: "exact" })
      .order("season_profile_id", { ascending: true })
      .range(from, to);
    if (error) throw error;
    seasonTotal = count || 0;

    // build UI: search + actions + paginator
    // inline SVGs matching MOQ/Conversion
    const svgAdd =
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M12 5v14M5 12h14" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    const svgExport =
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke="#0f172a" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M7 10l5-5 5 5" stroke="#0f172a" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 5v12" stroke="#0f172a" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

    let html =
      '<div style="display:flex;justify-content:space-between;align-items:center;margin:0 0 6px 0">' +
      '<div style="display:flex;gap:8px;align-items:center">' +
      '<input id="seasonSearch" placeholder="Type to search profiles..." title="Search by ID or label" style="padding:8px 12px;border:1px solid #d1d5db;border-radius:6px;font-size:0.95rem;min-width:220px;margin-right:12px"/>' +
      "</div>" +
      '<div style="display:flex;gap:8px;align-items:center">' +
      `<button id="addSeason" class="mrp-btn mrp-btn-primary" title="Add profile" aria-label="Add profile" style="width:40px;height:40px;display:inline-flex;align-items:center;justify-content:center;padding:6px">${svgAdd}</button>` +
      `<button id="exportSeasonCsv" class="mrp-btn mrp-btn-ghost" title="Export CSV" aria-label="Export CSV" style="width:40px;height:40px;display:inline-flex;align-items:center;justify-content:center;padding:6px">${svgExport}</button>` +
      "</div></div>";

    // paginator + row count
    const totalPages = Math.max(1, Math.ceil((seasonTotal || 0) / pageSize));
    html +=
      `<div style="display:flex;justify-content:space-between;align-items:center;margin:6px 0 12px 0">` +
      `<div style="display:flex;align-items:center">` +
      `<span id="seasonRowCount" style="display:inline-flex;align-items:center;justify-content:center;height:32px;padding:0 12px;border-radius:999px;background:rgba(59,130,246,0.08);color:#0b3a9a;font-weight:600;font-size:0.9rem;margin-left:8px">0 Rows</span>` +
      `</div>` +
      `<div id="seasonPaginator" style="display:flex;gap:8px;align-items:center">` +
      `<button id="seasonPrev" class="mrp-btn mrp-btn-ghost" style="padding:6px 10px">‹</button>` +
      `<span id="seasonPagerInfo">Page ${page} of ${totalPages}</span>` +
      `<button id="seasonNext" class="mrp-btn mrp-btn-ghost" style="padding:6px 10px">›</button>` +
      `</div></div>`;

    // table container and table (single header row) — use v_season_calendar fields
    html +=
      '<div id="mrpTableContainer">' +
      '<table id="mrpTable_season" class="mrp-table" style="width:100%;border-collapse:collapse;table-layout:fixed">' +
      "<thead><tr>" +
      '<th style="width:8%;text-align:center;padding:8px;background:#f8fafc">Profile ID</th>' +
      '<th style="width:34%;text-align:left;padding:8px;background:#f8fafc">Season Label</th>' +
      '<th style="width:20%;text-align:left;padding:8px;background:#f8fafc">Manufacture Months</th>' +
      '<th style="width:18%;text-align:left;padding:8px;background:#f8fafc">Month Split (pct)</th>' +
      "</tr></thead><tbody>";

    (data || []).forEach((p) => {
      const pid = p.season_profile_id || "";
      const label = (p.season_label || "").replace(/</g, "&lt;");
      const monthNames = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
      ];
      let months = "";
      if (Array.isArray(p.manufacture_months)) {
        months = p.manufacture_months
          .map((m) => monthNames[Number(m) - 1] || String(m))
          .join(", ");
      }
      let split = "";
      if (p.month_split_pct) {
        try {
          const obj =
            typeof p.month_split_pct === "string"
              ? JSON.parse(p.month_split_pct)
              : p.month_split_pct;
          const entries = Object.entries(obj)
            .map(([k, v]) => [Number(k), Number(v)])
            .sort((a, b) => a[0] - b[0]);
          const fmtPct = (v) => {
            const s = (v * 100).toFixed(2).replace(/\.?0+$/, "");
            return `${s}%`;
          };
          split = entries
            .map(([m, v]) => `${monthNames[m - 1] || m}:${fmtPct(v)}`)
            .join(", ");
        } catch (e) {
          console.debug("month_split_pct parse failed", e);
          split = String(p.month_split_pct || "");
        }
      }
      html += `<tr data-id="${pid}">`;
      html += `<td style="text-align:center;padding:8px">${pid}</td>`;
      html += `<td style="padding:8px">${label}</td>`;
      html += `<td style="padding:8px">${months}</td>`;
      html += `<td style="padding:8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${(
        split || ""
      ).replace(/</g, "&lt;")}</td>`;
      html += `</tr>`;
    });

    html += "</tbody></table></div>";
    node.innerHTML = html;

    // wire actions
    document
      .getElementById("addSeason")
      .addEventListener("click", () => openSeasonModal());
    document.getElementById("exportSeasonCsv").addEventListener("click", () => {
      try {
        const rows = Array.from(
          document.querySelectorAll("#mrpTable_season tbody tr")
        );
        const csv = [];
        csv.push(
          [
            "Profile ID",
            "Season Label",
            "Manufacture Months",
            "Month Split",
          ].join(",")
        );
        rows.forEach((r) => {
          const cells = Array.from(r.querySelectorAll("td"))
            .slice(0, 4)
            .map(
              (td) =>
                '"' + String(td.textContent || "").replace(/"/g, '""') + '"'
            );
          csv.push(cells.join(","));
        });
        const blob = new Blob([csv.join("\n")], {
          type: "text/csv;charset=utf-8;",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `season_profiles_${new Date()
          .toISOString()
          .slice(0, 19)
          .replace(/[:T]/g, "-")}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        showToast("Export started", "success");
      } catch (e) {
        console.debug(e);
        showToast("Export failed", "error");
      }
    });

    // paginator wiring
    document.getElementById("seasonPrev").addEventListener("click", () => {
      if (seasonPage > 1) {
        seasonPage -= 1;
        loadSeasonList();
      }
    });
    document.getElementById("seasonNext").addEventListener("click", () => {
      const maxPage = Math.max(
        1,
        Math.ceil((seasonTotal || 0) / seasonPageSize)
      );
      if (seasonPage < maxPage) {
        seasonPage += 1;
        loadSeasonList();
      }
    });

    // row click shows detail modal; action button also shows detail
    Array.from(node.querySelectorAll("#mrpTable_season tbody tr")).forEach(
      (tr) =>
        tr.addEventListener("click", async () => {
          const id = tr.dataset.id;
          try {
            const { data } = await supabase
              .from("season_profile")
              .select("*")
              .eq("id", id)
              .limit(1);
            const row = data && data[0] ? data[0] : { id };
            showSeasonDetail(row);
          } catch (e) {
            console.debug(e);
          }
        })
    );

    // update row count and pager info
    const updateSeasonRowCount = () => {
      const visible = Array.from(
        node.querySelectorAll("#mrpTable_season tbody tr")
      ).filter((tr) => getComputedStyle(tr).display !== "none").length;
      const pill = document.getElementById("seasonRowCount");
      const pagerInfo = document.getElementById("seasonPagerInfo");
      if (pill) pill.textContent = `${visible} Row${visible === 1 ? "" : "s"}`;
      if (pagerInfo)
        pagerInfo.textContent = `Page ${seasonPage} of ${Math.max(
          1,
          Math.ceil((seasonTotal || 0) / seasonPageSize)
        )}`;
      const prev = document.getElementById("seasonPrev");
      const next = document.getElementById("seasonNext");
      if (prev) prev.disabled = seasonPage <= 1;
      if (next)
        next.disabled =
          seasonPage >=
          Math.max(1, Math.ceil((seasonTotal || 0) / seasonPageSize));
    };
    updateSeasonRowCount();

    // search wiring (by id or label)
    const searchEl = document.getElementById("seasonSearch");
    if (searchEl) {
      let timer = null;
      searchEl.addEventListener("input", (ev) => {
        clearTimeout(timer);
        timer = setTimeout(async () => {
          const v = (ev.target.value || "").trim();
          if (!v) {
            seasonPage = 1;
            await loadSeasonList();
            return;
          }
          // simple client-side filtering when results are present
          Array.from(
            document.querySelectorAll("#mrpTable_season tbody tr")
          ).forEach((tr) => {
            const txt = tr.textContent || "";
            tr.style.display = txt.toLowerCase().includes(v.toLowerCase())
              ? ""
              : "none";
          });
          updateSeasonRowCount();
        }, 250);
      });
    }
  } catch (e) {
    console.debug(e);
    node.innerHTML = `<div class="error">Failed loading seasons: ${String(
      e?.message || e
    )}</div>`;
  }
}

function showSeasonDetail(profile) {
  ensureDetailModal();
  const root = document.getElementById("copilot-detail-modal");
  const title = root.querySelector("#copilot-modal-title");
  const sub = root.querySelector("#copilot-modal-sub");
  const body = root.querySelector("#copilot-modal-body");
  const actions = root.querySelector("#copilot-modal-actions");

  title.textContent = profile.label
    ? `Season — ${profile.label}`
    : "Season profile";
  sub.textContent = "Profile details";
  actions.innerHTML = "";
  body.innerHTML =
    '<div style="padding:20px;text-align:center;color:#6b7280">Loading...</div>';

  (async function render() {
    try {
      // ensure we have fresh profile
      let p =
        profile && profile.id
          ? profile
          : profile || {
              id: null,
              label: "",
              entity_kind: "raw_material",
              notes: "",
            };
      if (profile && profile.id) {
        const { data: pData } = await supabase
          .from("season_profile")
          .select("*")
          .eq("id", profile.id)
          .limit(1);
        if (pData && pData[0]) p = pData[0];
      }

      // load months and weights for display
      const { data: months = [] } = await supabase
        .from("season_profile_month")
        .select("month_num")
        .eq("season_profile_id", p.id || -1)
        .order("month_num", { ascending: true });
      const { data: weights = [] } = await supabase
        .from("season_profile_weight")
        .select("month_num,weight")
        .eq("season_profile_id", p.id || -1)
        .order("month_num", { ascending: true });

      const monthNames = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
      ];
      const manufMonths = (months || [])
        .map((m) => monthNames[(m.month_num || 1) - 1])
        .filter(Boolean);

      // build month split display
      const splitMap = {};
      (weights || []).forEach((w) => {
        const m = Number(w.month_num) || 0;
        const pct = Number(w.weight) || 0;
        if (m >= 1 && m <= 12) splitMap[m] = pct;
      });
      const splitEntries = Object.keys(splitMap)
        .map((k) => [Number(k), splitMap[k]])
        .sort((a, b) => a[0] - b[0])
        .map(([m, pct]) => `${monthNames[m - 1]}:${(pct * 100).toFixed(2)}%`);

      body.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;padding:8px;box-sizing:border-box">
      <div style="grid-column:1/3;padding:12px;background:#f8fafc;border-radius:6px;border-left:4px solid #0f172a">
        <div style="font-size:0.85rem;color:#6b7280;margin-bottom:4px">Season Label</div>
        <div style="font-weight:600;color:#0f172a">${p.label || ""}</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:6px">
        <div style="font-weight:600;color:#374151;font-size:0.9rem">Profile ID</div>
        <div style="color:#0f172a">${p.id || ""}</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:6px">
        <div style="font-weight:600;color:#374151;font-size:0.9rem">Entity Kind</div>
        <div style="color:#0f172a">${p.entity_kind || ""}</div>
      </div>
      <div style="grid-column:1/3;display:flex;flex-direction:column;gap:6px">
        <div style="font-weight:600;color:#374151;font-size:0.9rem">Manufacture Months</div>
        <div style="color:#0f172a">${manufMonths.join(", ") || "(none)"}</div>
      </div>
      <div style="grid-column:1/3;display:flex;flex-direction:column;gap:6px">
        <div style="font-weight:600;color:#374151;font-size:0.9rem">Month Split</div>
        <div style="color:#0f172a">${splitEntries.join(", ") || "(none)"}</div>
      </div>
      <div style="grid-column:1/3;margin-top:8px">
        <div style="font-weight:600;color:#374151;font-size:0.9rem;margin-bottom:6px">Notes</div>
        <div style="color:#0f172a;white-space:pre-wrap">${(
          p.notes || ""
        ).replace(/</g, "&lt;")}</div>
      </div>
    </div>
    `;

      // actions: Edit, Delete, Close (match MOQ-style)
      const btnEdit = document.createElement("button");
      btnEdit.className = "mrp-btn mrp-btn-secondary";
      btnEdit.textContent = "Edit";
      btnEdit.addEventListener("click", () => {
        closeDetailModal();
        openSeasonModal({ id: p.id });
      });

      const btnDelete = document.createElement("button");
      btnDelete.className = "mrp-btn mrp-btn-danger";
      btnDelete.textContent = "Delete";
      btnDelete.addEventListener("click", async () => {
        const ok = await showConfirm(
          "Delete this season profile and its month/weight data?",
          "Confirm delete"
        );
        if (!ok) return;
        try {
          const id = p.id || profile.id;
          // remove weights, months then profile
          const { error: wErr } = await supabase
            .from("season_profile_weight")
            .delete()
            .eq("season_profile_id", id);
          if (wErr) throw wErr;
          const { error: mErr } = await supabase
            .from("season_profile_month")
            .delete()
            .eq("season_profile_id", id);
          if (mErr) throw mErr;
          const { error: pErr } = await supabase
            .from("season_profile")
            .delete()
            .eq("id", id);
          if (pErr) throw pErr;
          showToast("Deleted", "success");
          closeDetailModal();
          await loadSeasonList();
        } catch (e) {
          console.debug(e);
          showToast("Delete failed", "error");
        }
      });

      actions.appendChild(btnEdit);
      actions.appendChild(btnDelete);

      root.style.display = "flex";
    } catch (e) {
      console.debug(e);
      body.innerHTML = `<div class="error">Failed loading season detail: ${String(
        e?.message || e
      )}</div>`;
    }
  })();
}

function openSeasonModal(row = {}) {
  ensureDetailModal();
  const id = row.id || null;
  (async function renderEditor() {
    try {
      // load base profile
      let profile =
        row && row.id
          ? row
          : { id: null, entity_kind: "raw_material", label: "", notes: "" };
      if (id) {
        const { data } = await supabase
          .from("season_profile")
          .select("*")
          .eq("id", id)
          .limit(1);
        if (data && data[0]) profile = data[0];
      }

      // load months and weights
      const { data: months = [] } = await supabase
        .from("season_profile_month")
        .select("*")
        .eq("season_profile_id", profile.id || -1)
        .order("month_num", { ascending: true });
      const { data: weights = [] } = await supabase
        .from("season_profile_weight")
        .select("*")
        .eq("season_profile_id", profile.id || -1)
        .order("month_num", { ascending: true });

      openDetailModal({
        title: `Edit season profile ${profile.id || "(new)"}`,
        sections: [],
        actions: [],
      });

      // now populate modal body with inputs
      const root = document.getElementById("copilot-detail-modal");
      const body = root.querySelector("#copilot-modal-body");
      body.innerHTML = "";
      const profileDiv = document.createElement("div");
      profileDiv.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:8px 0;box-sizing:border-box">
        <div>
          <label style="font-weight:600;color:#374151;font-size:0.9rem;display:block;margin-bottom:6px">Label <span style=\"color:#dc2626\">*</span></label>
          <input id="sp_label" style="width:100%;padding:10px;border:1px solid #d1d5db;border-radius:6px;font-size:0.95rem;box-sizing:border-box" value="${(
            profile.label || ""
          ).replace(/"/g, "&quot;")}"/>
        </div>
        <div>
          <label style="font-weight:600;color:#374151;font-size:0.9rem;display:block;margin-bottom:6px">Entity kind</label>
          <input id="sp_entity_kind" style="width:100%;padding:10px;border:1px solid #d1d5db;border-radius:6px;font-size:0.95rem;box-sizing:border-box" value="${(
            profile.entity_kind || ""
          ).replace(/"/g, "&quot;")}"/>
        </div>
        <div style="grid-column:1/3;margin-top:6px">
          <label style="font-weight:600;color:#374151;font-size:0.9rem;display:block;margin-bottom:6px">Notes</label>
          <textarea id="sp_notes" style="width:100%;padding:10px;border:1px solid #d1d5db;border-radius:6px;font-size:0.95rem;box-sizing:border-box;min-height:88px">${(
            profile.notes || ""
          ).replace(/</g, "&lt;")}</textarea>
        </div>
      </div>
      `;
      body.appendChild(profileDiv);

      // months checkboxes
      const monthsDiv = document.createElement("div");
      monthsDiv.style =
        "margin-top:12px;padding:12px;background:#f8fafc;border-radius:6px;border-left:4px solid #0f172a";
      monthsDiv.innerHTML =
        "<div style='font-weight:700;color:#374151;margin-bottom:8px'>Months (active)</div>";
      const activeSet = new Set(
        (months || []).filter(Boolean).map((r) => Number(r.month_num))
      );
      const monthsGrid = document.createElement("div");
      monthsGrid.style = "display:flex;flex-wrap:wrap;gap:8px;margin-top:6px";
      const names = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
      ];
      for (let m = 1; m <= 12; m++) {
        const chkId = `sp_month_active_${m}`;
        const el = document.createElement("label");
        el.style =
          "display:inline-flex;align-items:center;gap:6px;padding:4px 6px;border:1px solid #eee;border-radius:4px;";
        el.innerHTML = `<input type=checkbox id="${chkId}" ${
          activeSet.has(m) ? "checked" : ""
        }/> ${names[m - 1]}`;
        monthsGrid.appendChild(el);
      }
      monthsDiv.appendChild(monthsGrid);
      body.appendChild(monthsDiv);

      // weights grid
      const weightsDiv = document.createElement("div");
      weightsDiv.style =
        "margin-top:12px;padding:12px;background:#f8fafc;border-radius:6px;border-left:4px solid #0f172a";
      weightsDiv.innerHTML =
        "<div style='font-weight:700;color:#374151;margin-bottom:8px'>Weights (per month)</div>";
      const weightsMap = new Map(
        (weights || []).map((w) => [Number(w.month_num), w.weight])
      );
      const weightsGrid = document.createElement("div");
      weightsGrid.style = "display:flex;flex-wrap:wrap;gap:8px;margin-top:6px";
      for (let m = 1; m <= 12; m++) {
        const inpId = `sp_weight_${m}`;
        const val =
          weightsMap.has(m) && weightsMap.get(m) !== null
            ? String(weightsMap.get(m))
            : "";

        const cell = document.createElement("label");
        cell.style = "display:flex;flex-direction:column;width:96px;gap:6px;";
        cell.innerHTML = `<span style='font-size:12px;color:#374151'>${
          names[m - 1]
        }</span><input id="${inpId}" type="number" step="any" style="width:100%;padding:8px;border:1px solid #e6eef8;border-radius:6px" value="${val}"/>`;
        weightsGrid.appendChild(cell);
      }
      weightsDiv.appendChild(weightsGrid);
      body.appendChild(weightsDiv);

      // create Save / Cancel buttons (match MOQ edit modal styles)
      const modalRoot = document.getElementById("copilot-detail-modal");
      const actionsEl = modalRoot.querySelector("#copilot-modal-actions");
      actionsEl.innerHTML = "";

      const saveBtn = document.createElement("button");
      saveBtn.className = "mrp-btn mrp-btn-primary";
      saveBtn.textContent = "Save";

      const cancelBtn = document.createElement("button");
      cancelBtn.className = "mrp-btn mrp-btn-ghost";
      cancelBtn.textContent = "Cancel";

      // save handler (extracted from previous inline action)
      saveBtn.addEventListener("click", async () => {
        if (!(isProcurementAdmin() || canEditPM()))
          return showToast("No permission", "warning");
        try {
          const label = document.getElementById("sp_label").value || "";
          const entity_kind =
            document.getElementById("sp_entity_kind").value || "raw_material";
          const notes = document.getElementById("sp_notes").value || null;
          const payload = { id: profile.id, label, entity_kind, notes };
          const { error: pErr, data: pData } = await supabase
            .from("season_profile")
            .upsert(payload, { returning: "representation" });
          if (pErr) throw pErr;
          const newId = (pData && pData[0] && pData[0].id) || profile.id;

          // months: build 12 entries with is_active flag
          const monthRows = [];
          for (let m = 1; m <= 12; m++) {
            const chk = document.getElementById(`sp_month_active_${m}`);
            const active = chk ? !!chk.checked : false;
            monthRows.push({
              season_profile_id: newId,
              month_num: m,
              is_active: active,
            });
          }
          if (monthRows.length) {
            const { error: mErr } = await supabase
              .from("season_profile_month")
              .upsert(monthRows, { returning: "minimal" });
            if (mErr) throw mErr;
          }

          // weights: collect numeric values (allow empty -> null)
          const weightRows = [];
          for (let m = 1; m <= 12; m++) {
            const inp = document.getElementById(`sp_weight_${m}`);
            const v = inp ? inp.value : "";
            const w = v === "" ? null : Number(v);
            weightRows.push({
              season_profile_id: newId,
              month_num: m,
              weight: w,
            });
          }
          if (weightRows.length) {
            const { error: wErr } = await supabase
              .from("season_profile_weight")
              .upsert(weightRows, { returning: "minimal" });
            if (wErr) throw wErr;
          }

          showToast("Saved", "success");
          closeDetailModal();
          await loadSeasonList();
        } catch (e) {
          console.debug(e);
          showToast("Save failed", "error");
        }
      });

      cancelBtn.addEventListener("click", () => closeDetailModal());

      actionsEl.appendChild(saveBtn);
      actionsEl.appendChild(cancelBtn);
    } catch (e) {
      console.debug(e);
      showToast("Failed loading profile details", "error");
    }
  })();
}

async function loadMapQuickEditor() {
  const node = document.getElementById("mapSection");
  node.innerHTML = `
    <div style="margin:6px 0;display:flex;justify-content:space-between;align-items:center">
      <div>
        <h3 style="margin:0">RM Seasonal Mapping</h3>
        <div class="muted">Map raw materials to season profiles for overlaying planning buckets.</div>
      </div>
    </div>
    <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px">
      <input id="textSearch" type="text" placeholder="Search RM code or name" style="flex:1 1 320px;padding:6px 8px" />
      <div style="display:flex;gap:6px;align-items:center">
        <button id="filterAll" class="link-btn">All</button>
        <button id="filterMapped" class="link-btn">Mapped</button>
        <button id="filterUnmapped" class="link-btn">Unmapped</button>
      </div>
      <button id="refreshBtn" class="link-btn">Refresh</button>
      <div id="rowCount" class="muted">0 / 0</div>
    </div>
    <div style="display:flex;gap:12px">
      <div style="flex:1 1 640px">
        <div id="tableContainer">
          <table id="rmTable" class="mrp-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Code</th>
                <th>Name</th>
                <th>Group</th>
                <th>Subgroup</th>
                <th>Season Profile</th>
                <th>Active</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="rmBody"></tbody>
          </table>
        </div>
      </div>
      <div style="width:360px">
        <div class="editor" style="padding:12px;border-radius:6px">
          <div><strong>Editor</strong></div>
          <div id="editorHint" class="muted" style="margin-top:6px">Select a raw material to edit mapping.</div>
          <label style="margin-top:8px">RM:<div id="editorRm" class="muted"></div></label>
          <label for="profileSelect" style="margin-top:8px">Season profile</label>
          <select id="profileSelect" style="width:100%"></select>
          <label style="margin-top:8px"><input id="isActive" type="checkbox" checked /> Active</label>
          <label for="notes" style="margin-top:8px">Notes (optional)</label>
          <textarea id="notes" rows="4" style="width:100%"></textarea>
          <div style="margin-top:8px;display:flex;gap:8px;justify-content:flex-end">
            <button id="clearMappingBtn" class="link-btn">Clear mapping</button>
            <button id="saveMappingBtn">Save mapping</button>
          </div>
        </div>
      </div>
    </div>
  `;

  // local element getters
  const els = {
    textSearch: () => node.querySelector("#textSearch"),
    refreshBtn: () => node.querySelector("#refreshBtn"),
    filterAll: () => node.querySelector("#filterAll"),
    filterMapped: () => node.querySelector("#filterMapped"),
    filterUnmapped: () => node.querySelector("#filterUnmapped"),
    rowCount: () => node.querySelector("#rowCount"),
    rmBody: () => node.querySelector("#rmBody"),
    profileSelect: () => node.querySelector("#profileSelect"),
    profileNotes: () => node.querySelector("#notes"),
    isActive: () => node.querySelector("#isActive"),
    saveMappingBtn: () =>
      node.querySelector("#saveMappingBtn") ||
      node.querySelector("#saveMappingBtn"),
    clearMappingBtn: () => node.querySelector("#clearMappingBtn"),
    editorRm: () => node.querySelector("#editorRm"),
    editorHint: () => node.querySelector("#editorHint"),
  };

  let profiles = [];
  let rmItems = [];
  let mappings = new Map();
  let selected = null;
  const _capabilities = {};

  async function tableHasColumn(table, column) {
    const key = `${table}::${column}`;
    if (_capabilities[key] !== undefined) return _capabilities[key];
    try {
      const { error } = await supabase.from(table).select(column).limit(1);
      _capabilities[key] = !error;
    } catch {
      _capabilities[key] = false;
    }
    return _capabilities[key];
  }

  function escapeHtml(s) {
    if (s === null || s === undefined) return "";
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  async function fetchProfiles() {
    try {
      const { data, error } = await supabase
        .from("season_profile")
        .select("*")
        .eq("entity_kind", "raw_material")
        .order("label", { ascending: true });
      if (error) throw error;
      profiles = data || [];
    } catch (err) {
      console.error("Failed loading season profiles", err);
      showToast("Failed loading season profiles", "error");
      profiles = [];
    }
  }

  async function fetchRmItems() {
    try {
      const { data, error } = await supabase
        .from("v_inv_stock_item_with_class")
        .select("*")
        .eq("category_code", "RM")
        .order("code", { ascending: true });
      if (error) throw error;
      rmItems = data || [];
    } catch (err) {
      console.error("Failed loading RM items", err);
      showToast("Failed loading RM items", "error");
      rmItems = [];
    }
  }

  async function fetchMappings() {
    mappings = new Map();
    try {
      const ids = rmItems.map((r) => r.stock_item_id).filter(Boolean);
      if (!ids.length) return;
      const { data, error } = await supabase
        .from("inv_stock_item_season_profile")
        .select("*")
        .in("stock_item_id", ids);
      if (error) throw error;
      (data || []).forEach((m) => mappings.set(m.stock_item_id, m));
    } catch (err) {
      console.error("Failed loading mappings", err);
      showToast("Failed loading mappings", "error");
    }
  }

  function mergeAndRender() {
    const tb = els.rmBody();
    tb.innerHTML = "";
    const txt = (els.textSearch().value || "").toLowerCase().trim();
    const mode = mergeAndRender.filterMode || "all";
    const rows = (rmItems || []).filter((r) => {
      const m = mappings.get(r.stock_item_id) || null;
      if (mode === "mapped" && !m) return false;
      if (mode === "unmapped" && m) return false;
      if (!txt) return true;
      const hay = [r.code || "", r.name || ""].join(" ").toLowerCase();
      return hay.includes(txt);
    });
    els.rowCount().textContent = `${rows.length} / ${rmItems.length}`;

    rows.forEach((r) => {
      const m = mappings.get(r.stock_item_id) || null;
      const tr = document.createElement("tr");
      const profileLabel = m
        ? profiles.find((p) => p.id === m.season_profile_id)?.label ||
          String(m.season_profile_id)
        : "-";
      tr.innerHTML = `
      <td>${escapeHtml(String(r.stock_item_id || ""))}</td>
      <td>${escapeHtml(r.code || "")}</td>
      <td>${escapeHtml(r.name || "")}</td>
      <td>${escapeHtml(r.group_label || "")}</td>
      <td>${escapeHtml(r.subgroup_label || "")}</td>
      <td>${escapeHtml(profileLabel)}</td>
      <td>${m ? (m.is_active ? "Yes" : "No") : "-"}</td>
      <td><button class="link-btn edit">Edit</button></td>
    `;
      tr.querySelector(".edit").addEventListener("click", () =>
        openEditorFor(r)
      );
      tb.appendChild(tr);
    });
  }

  function openEditorFor(r) {
    selected = r;
    const m = mappings.get(r.stock_item_id) || null;
    els.editorRm().textContent = `${r.code || r.stock_item_id} — ${
      r.name || ""
    }`;
    els.editorHint().textContent = "Edit mapping and press Save mapping.";
    const sel = els.profileSelect();
    sel.innerHTML = "<option value=''>-- None --</option>";
    profiles.forEach((p) => {
      const opt = document.createElement("option");
      opt.value = String(p.id);
      opt.textContent = p.label || p.name || opt.value;
      sel.appendChild(opt);
    });
    if (m && m.season_profile_id) sel.value = String(m.season_profile_id);
    else sel.value = "";
    els.isActive().checked = m ? !!m.is_active : true;
    els.profileNotes().value = m ? m.notes || "" : "";
    sel.addEventListener("change", () => {
      const v = sel.value;
      showProfileMonths(v ? Number(v) : null);
    });
    if (sel.value) showProfileMonths(Number(sel.value));
  }

  async function showProfileMonths(profileId) {
    let hintEl = node.querySelector("#profileMonths");
    if (!hintEl) {
      const editor = node.querySelector(".editor");
      if (editor) {
        hintEl = document.createElement("div");
        hintEl.id = "profileMonths";
        hintEl.className = "muted";
        hintEl.style.marginTop = "8px";
        editor.insertBefore(
          hintEl,
          editor.querySelector("label[for=notes]") || null
        );
      }
    }
    if (!hintEl) return;
    hintEl.textContent = "";
    if (!profileId) return;
    try {
      const { data, error } = await supabase
        .from("season_profile_month")
        .select("*")
        .eq("season_profile_id", profileId)
        .order("month_num", { ascending: true });
      if (error) throw error;
      if (!data || !data.length) return;
      const monthNames = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
      ];
      const months = data
        .map((m) => {
          const n = m.month_num ?? m.month ?? null;
          if (!n) return null;
          return monthNames[Number(n) - 1] || String(n);
        })
        .filter(Boolean);
      hintEl.textContent = months.join(", ");
    } catch (err) {
      console.debug("showProfileMonths failed", err);
    }
  }

  async function saveMapping() {
    if (!selected) return showToast("Select an RM first", "error");
    const profileId = els.profileSelect().value || "";
    if (!profileId) {
      showToast(
        "Select a profile or use Clear mapping to remove mapping",
        "error"
      );
      return;
    }
    const payload = {
      stock_item_id: selected.stock_item_id,
      season_profile_id: Number(profileId),
      is_active: !!els.isActive().checked,
      notes: els.profileNotes().value || null,
      updated_by: "ui:mrp-master-data-console",
    };
    try {
      try {
        const actor = getActorSnapshot();
        const hasActorId = await tableHasColumn(
          "inv_stock_item_season_profile",
          "actor_id"
        );
        const hasActorEmail = await tableHasColumn(
          "inv_stock_item_season_profile",
          "actor_email"
        );
        const hasActorDisplay = await tableHasColumn(
          "inv_stock_item_season_profile",
          "actor_display"
        );
        if (hasActorId) payload.actor_id = actor.actor_id;
        if (hasActorEmail) payload.actor_email = actor.actor_email;
        if (hasActorDisplay) payload.actor_display = actor.actor_display;
      } catch {
        console.debug("actor snapshot probe failed");
      }

      const up = { ...payload };
      up.created_by = up.created_by || "ui:mrp-master-data-console";
      const { error } = await supabase
        .from("inv_stock_item_season_profile")
        .upsert(up, { returning: "representation" });
      if (error) throw error;
      await fetchMappings();
      mergeAndRender();
      showToast("Mapping saved", "success");
    } catch (err) {
      console.error("Save mapping failed", err);
      showToast(err.message || "Save mapping failed", "error");
    }
  }

  async function clearMapping() {
    if (!selected) return showToast("Select an RM first", "error");
    try {
      const { error } = await supabase
        .from("inv_stock_item_season_profile")
        .delete()
        .eq("stock_item_id", selected.stock_item_id);
      if (error) throw error;
      await fetchMappings();
      mergeAndRender();
      showToast("Mapping cleared", "success");
      els.editorRm().textContent = "";
      els.editorHint().textContent = "Select a raw material to edit mapping.";
      selected = null;
    } catch (err) {
      console.error("Clear mapping failed", err);
      showToast(err.message || "Clear mapping failed", "error");
    }
  }

  function wireUp() {
    node
      .querySelector("#homeBtn")
      ?.addEventListener(
        "click",
        () => (window.location.href = "../../index.html")
      );
    els.refreshBtn().addEventListener("click", () => loadAll());
    els.textSearch().addEventListener("input", () => mergeAndRender());
    els.filterAll().addEventListener("click", () => {
      mergeAndRender.filterMode = "all";
      mergeAndRender();
    });
    els.filterMapped().addEventListener("click", () => {
      mergeAndRender.filterMode = "mapped";
      mergeAndRender();
    });
    els.filterUnmapped().addEventListener("click", () => {
      mergeAndRender.filterMode = "unmapped";
      mergeAndRender();
    });
    node
      .querySelector("#clearMappingBtn")
      .addEventListener("click", () => clearMapping());
    node
      .querySelector("#saveMappingBtn")
      .addEventListener("click", () => saveMapping());
  }

  async function loadAll() {
    await fetchProfiles();
    await fetchRmItems();
    await fetchMappings();
    mergeAndRender();
  }

  try {
    await loadAccessContext();
  } catch (e) {
    console.debug(e);
  }
  try {
    ensureDetailModal();
  } catch (e) {
    console.debug(e);
  }

  wireUp();
  await loadAll();

  try {
    const canEdit = canEditRM();
    const sb = node.querySelector("#saveMappingBtn");
    if (sb) sb.disabled = !canEdit;
  } catch (e) {
    void e;
  }
}

async function loadAudit() {
  const node = document.getElementById("auditSection");
  node.innerHTML = '<div class="muted">Loading recent master changes...</div>';
  try {
    const tables = [
      "inv_stock_item_moq_policy",
      "inv_rm_form_conversion",
      "season_profile",
      "season_profile_month",
      "inv_stock_item_season_profile",
    ];
    const rows = [];
    for (const t of tables) {
      try {
        const { data, error } = await supabase.from(t).select("id,updated_at").order("updated_at", { ascending: false }).limit(10);
        if (!error && data && data.length) rows.push(...data.map((r) => ({ table: t, ...r })));
      } catch (err) {
        console.debug("audit read failed for", t, err);
      }
    }
    const recent = rows.sort((a, b) => ((b.updated_at || "") > (a.updated_at || "") ? 1 : -1)).slice(0, 100);
    if (!recent.length) return void (node.innerHTML = '<div class="muted">No audit columns available</div>');
    let html = '<table id="mrpTable_audit" class="mrp-table"><thead><tr><th>Table</th><th>Row id</th><th>Updated at</th></tr></thead><tbody>';
    recent.forEach((r) => {
      html += `<tr><td>${r.table}</td><td>${r.id || ""}</td><td>${r.updated_at || ""}</td></tr>`;
    });
    html += "</tbody></table>";
    node.innerHTML = html;
  } catch (e) {
    console.debug(e);
    node.innerHTML = `<div class="error">Audit load failed: ${String(e?.message || e)}</div>`;
  }
}

window.addEventListener("DOMContentLoaded", init);
