import pathlib

HTML = r"""<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Manage BMR</title>
    <link rel="stylesheet" href="./css/style.css" />
    <style>
      html, body {
        height: 100vh; min-height: 100vh; margin: 0;
        overflow: hidden; box-sizing: border-box;
        font-family: system-ui, "Segoe UI", Roboto, Arial, sans-serif;
      }
      body {
        display: flex; flex-direction: column;
        padding: 16px; gap: 10px;
        background: var(--bg-color, #f8fafc); color: var(--text-color, #0f172a);
      }
      @media (max-width: 900px) { body { padding: 10px; gap: 8px; } }
      @media (max-width: 520px) { body { padding: 6px; } }

      /* ── Header ─────────────────────────────────── */
      .page-header { display:flex; justify-content:space-between; align-items:flex-start; gap:12px; flex-shrink:0; }
      .page-header h1 { margin:0; font-size:1.2rem; color:var(--primary,#2563eb); line-height:1.2; }
      .page-sub { color:var(--muted,#64748b); font-size:0.84rem; margin-top:3px; }
      .header-actions { display:flex; gap:8px; align-items:center; flex-shrink:0; }
      @media (max-width:520px) { .page-header h1 { font-size:15px; } .page-sub { display:none; } }

      /* ── Status ──────────────────────────────────── */
      #statusArea { display:none; padding:10px 12px; border-radius:7px; font-size:13px; flex-shrink:0; border:1px solid transparent; }
      #statusArea.sa-error   { display:block; background:#fef2f2; color:#991b1b; border-color:#fecaca; }
      #statusArea.sa-warn    { display:block; background:#fffbeb; color:#92400e; border-color:#fde68a; }
      #statusArea.sa-success { display:block; background:#f0fdf4; color:#166534; border-color:#86efac; }

      /* ── Tabs ────────────────────────────────────── */
      .tabs { display:flex; gap:6px; overflow-x:auto; flex-shrink:0; scrollbar-width:none; }
      .tabs::-webkit-scrollbar { display:none; }
      .tab-btn { border:1px solid var(--border,#dbe2ea); border-radius:999px; background:#fff; padding:7px 14px; font-size:12.5px; font-weight:700; color:#475569; cursor:pointer; white-space:nowrap; flex-shrink:0; }
      .tab-btn.active { background:var(--primary,#2563eb); border-color:var(--primary,#2563eb); color:#fff; }
      .tab-btn.hidden { display:none; }

      /* ── Layout ──────────────────────────────────── */
      .layout { flex:1 1 auto; min-height:0; }
      .panel { display:none; height:100%; flex-direction:column; gap:10px; overflow:hidden; }
      .panel.active { display:flex; }

      /* ── Card ────────────────────────────────────── */
      .card { background:#fff; border:1px solid var(--border,#e2e8f0); border-radius:10px; padding:12px; flex-shrink:0; }
      .section-title { margin:0 0 8px; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.04em; color:var(--muted,#64748b); }

      /* ── Form ────────────────────────────────────── */
      .grid   { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; }
      .grid-3 { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:10px; }
      label.field { display:flex; flex-direction:column; gap:4px; font-size:12px; font-weight:600; color:#334155; }
      input, select { border:1px solid var(--border,#d1d9e6); border-radius:7px; padding:7px 9px; font-size:13px; background:#fff; box-sizing:border-box; width:100%; }
      input:focus, select:focus { outline:none; border-color:var(--primary,#2563eb); box-shadow:0 0 0 3px rgba(37,99,235,0.08); }
      input:disabled, select:disabled { background:#f8fafc; color:#94a3b8; cursor:not-allowed; }

      /* ── Buttons ─────────────────────────────────── */
      .btn { border:1px solid var(--border,#dbe2ea); border-radius:8px; background:#fff; color:#0f172a; padding:7px 12px; font-size:13px; cursor:pointer; white-space:nowrap; line-height:1.4; }
      .btn:hover { background:#f8fafc; }
      .btn.primary { background:var(--primary,#2563eb); color:#fff; border-color:var(--primary,#2563eb); }
      .btn.primary:hover { background:#1d4ed8; }
      .btn.danger { color:#b91c1c; border-color:#fecaca; }
      .btn.danger:hover { background:#fef2f2; }
      .btn.ghost { background:transparent; border-color:transparent; }
      .btn.ghost:hover { background:#f1f5f9; border-color:#e2e8f0; }
      .btn:disabled { opacity:0.45; cursor:not-allowed; }
      .row-actions { display:flex; gap:6px; align-items:center; flex-wrap:wrap; }
      .muted-label { font-size:12px; color:var(--muted,#64748b); }
      .icon-btn { display:inline-flex; align-items:center; justify-content:center; padding:7px; border:1px solid var(--border,#e5e7eb); border-radius:6px; background:#fff; cursor:pointer; color:inherit; flex-shrink:0; }
      .icon-btn:hover { background:#f3f4f6; }

      /* ── Table ───────────────────────────────────── */
      .table-wrap { flex:1 1 auto; min-height:0; border:1px solid #e2e8f0; border-radius:8px; overflow:auto; }
      table { width:100%; border-collapse:collapse; }
      thead th { position:sticky; top:0; z-index:2; background:#f8fafc; padding:7px 8px; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.03em; color:#64748b; border-bottom:1px solid #e2e8f0; white-space:nowrap; text-align:left; }
      tbody td { padding:7px 8px; border-bottom:1px solid #f1f5f9; font-size:12.5px; }
      tbody tr:last-child td { border-bottom:none; }
      tbody tr:hover td { background:#f0f7ff; }
      .td-actions { display:flex; gap:4px; }
      .empty-state { padding:24px; text-align:center; color:#94a3b8; font-size:13px; }
      #createTable input, #createTable select { min-width:80px; padding:5px 7px; font-size:12.5px; }

      /* ── KPI strip ───────────────────────────────── */
      .kpi-strip { display:flex; flex-direction:row; gap:6px; flex-shrink:0; overflow-x:auto; scrollbar-width:none; }
      .kpi-strip::-webkit-scrollbar { display:none; }
      .kpi { background:#fff; border:1px solid rgba(0,0,0,0.06); border-left:4px solid var(--primary,#2563eb); border-radius:8px; padding:6px 12px; min-width:fit-content; flex-shrink:0; flex-grow:1; display:flex; align-items:center; gap:8px; white-space:nowrap; }
      .kpi .k { font-size:10.5px; font-weight:700; text-transform:uppercase; letter-spacing:0.04em; color:#64748b; }
      .kpi .v { font-size:18px; font-weight:800; color:#0f172a; }

      /* ── Badges ──────────────────────────────────── */
      .badge-mapped { display:inline-block; padding:2px 7px; border-radius:999px; font-size:10.5px; font-weight:700; background:#fffbeb; color:#92400e; border:1px solid #fde68a; }
      .badge-free   { display:inline-block; padding:2px 7px; border-radius:999px; font-size:10.5px; font-weight:700; background:#f0fdf4; color:#166534; border:1px solid #86efac; }

      /* ── Modal ───────────────────────────────────── */
      .modal-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.4); display:flex; align-items:center; justify-content:center; z-index:1000; }
      .modal-overlay.hidden { display:none; }
      .modal-window { background:#fff; border-radius:12px; box-shadow:0 16px 48px rgba(0,0,0,0.2); width:min(440px,94vw); padding:20px; display:flex; flex-direction:column; gap:14px; }
      .modal-header { display:flex; justify-content:space-between; align-items:center; gap:8px; }
      .modal-title { font-size:1rem; font-weight:700; color:#0f172a; margin:0; }
      .modal-close-btn { width:28px; height:28px; border:1px solid #e2e8f0; border-radius:6px; background:transparent; cursor:pointer; display:inline-flex; align-items:center; justify-content:center; color:#64748b; flex-shrink:0; }
      .modal-close-btn:hover { background:#f3f4f6; color:#0f172a; }
      .modal-body { display:flex; flex-direction:column; gap:10px; }
      .modal-footer { display:flex; gap:8px; justify-content:flex-end; }
      .modal-info { font-size:11.5px; color:#92400e; background:#fffbeb; border:1px solid #fde68a; border-radius:6px; padding:6px 10px; }
      .field-row { display:grid; grid-template-columns:1fr 1fr; gap:10px; }

      /* ── Toast ───────────────────────────────────── */
      #toastContainer { position:fixed; bottom:20px; right:20px; z-index:9999; display:flex; flex-direction:column; gap:8px; align-items:flex-end; pointer-events:none; }
      .toast { pointer-events:auto; padding:10px 14px; border-radius:8px; border:1px solid transparent; font-size:13px; font-weight:500; box-shadow:0 4px 12px rgba(0,0,0,0.12); max-width:320px; line-height:1.4; animation:toast-in 0.2s ease forwards; }
      .toast.toast-success { background:#f0fdf4; border-color:#86efac; color:#166534; }
      .toast.toast-warn    { background:#fffbeb; border-color:#fde68a; color:#92400e; }
      .toast.toast-error   { background:#fef2f2; border-color:#fca5a5; color:#991b1b; }
      .toast.toast-out     { animation:toast-out 0.3s ease forwards; }
      @keyframes toast-in  { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
      @keyframes toast-out { from { opacity:1; transform:translateY(0); } to { opacity:0; transform:translateY(8px); } }

      .hidden { display:none !important; }
      @media (max-width:900px) { .grid, .grid-3 { grid-template-columns:1fr 1fr; } }
      @media (max-width:520px) { .grid, .grid-3 { grid-template-columns:1fr; } .kpi-strip { display:grid; grid-template-columns:1fr 1fr; overflow-x:visible; } }
    </style>
  </head>
  <body>

    <!-- ── Header ─────────────────────────────────────────────── -->
    <div class="page-header">
      <div>
        <h1>Manage BMR</h1>
        <div class="page-sub">Unified Batch Manufacturing Record console — create, maintain and explore</div>
      </div>
      <div class="header-actions">
        <button id="refreshBtn" class="icon-btn" type="button" title="Refresh" aria-label="Refresh">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline>
            <path d="M3.51 9a9 9 0 0114.13-3.36L23 10"></path><path d="M20.49 15a9 9 0 01-14.13 3.36L1 14"></path>
          </svg>
        </button>
        <button id="homeBtn" class="btn" type="button">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle;margin-right:4px"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9,22 9,12 15,12 15,22"/></svg>Home
        </button>
      </div>
    </div>

    <!-- ── Status ─────────────────────────────────────────────── -->
    <div id="statusArea" role="status" aria-live="polite"></div>

    <!-- ── Tabs ───────────────────────────────────────────────── -->
    <div id="tabBar" class="tabs" role="tablist">
      <button class="tab-btn" data-tab="add"     role="tab" type="button">Create BMR</button>
      <button class="tab-btn" data-tab="manage"  role="tab" type="button">Manage BMR</button>
      <button class="tab-btn" data-tab="explore" role="tab" type="button">BMR Explorer</button>
    </div>

    <!-- ── Panels ─────────────────────────────────────────────── -->
    <div class="layout">

      <!-- CREATE tab ──────────────────────────────────── -->
      <section id="panel-add" class="panel" role="tabpanel">
        <div class="card">
          <p class="section-title">Create BMR Entries</p>
          <div style="display:grid;grid-template-columns:1fr auto;gap:10px;align-items:end">
            <label class="field">CSV File
              <input id="csvFile" type="file" accept=".csv" style="width:auto" />
            </label>
            <div class="row-actions" style="padding-bottom:1px">
              <button id="downloadTemplate" class="btn ghost" type="button">Download Template</button>
              <button id="uploadCsv" class="btn" type="button">Preview CSV</button>
            </div>
          </div>
        </div>

        <div class="table-wrap">
          <table id="createTable">
            <thead>
              <tr>
                <th>Item</th>
                <th>BN</th>
                <th>Batch Size</th>
                <th>UOM</th>
                <th style="width:60px"></th>
              </tr>
            </thead>
            <tbody id="createTableBody"></tbody>
          </table>
          <datalist id="itemList"></datalist>
        </div>

        <div class="row-actions" style="flex-shrink:0">
          <button id="addRowBtn"       class="btn ghost"   type="button">+ Add Row</button>
          <button id="clearRowsBtn"    class="btn ghost"   type="button">Clear All</button>
          <button id="submitCreateBtn" class="btn primary" type="button">Create Entries</button>
          <span id="createCount" class="muted-label"></span>
        </div>
      </section>

      <!-- MANAGE tab ──────────────────────────────────── -->
      <section id="panel-manage" class="panel" role="tabpanel">
        <div class="card">
          <p class="section-title">Maintain Existing BMR</p>
          <div class="grid-3" style="align-items:end">
            <label class="field">Item
              <select id="manageFilterItem"><option value="">All Items</option></select>
            </label>
            <label class="field">BN
              <input id="manageFilterBn" type="text" placeholder="Filter by exact BN…" />
            </label>
            <div class="row-actions">
              <button id="manageClearBtn" class="btn ghost" type="button">Clear</button>
              <span id="manageCount" class="muted-label"></span>
            </div>
          </div>
        </div>

        <div class="table-wrap">
          <table id="manageTable">
            <thead>
              <tr>
                <th>Item</th>
                <th>BN</th>
                <th>Batch Size</th>
                <th>UOM</th>
                <th>Mapped</th>
                <th style="width:120px">Actions</th>
              </tr>
            </thead>
            <tbody id="manageTableBody"></tbody>
          </table>
        </div>
      </section>

      <!-- EXPLORE tab ─────────────────────────────────── -->
      <section id="panel-explore" class="panel" role="tabpanel">
        <div class="kpi-strip">
          <div class="kpi"><span class="k">Total Rows</span>  <span id="kpiRows"  class="v">—</span></div>
          <div class="kpi"><span class="k">Unique Items</span><span id="kpiItems" class="v">—</span></div>
          <div class="kpi"><span class="k">Unique BN</span>   <span id="kpiBn"    class="v">—</span></div>
          <div class="kpi"><span class="k">Avg Batch Size</span><span id="kpiAvg" class="v">—</span></div>
        </div>

        <div class="card">
          <p class="section-title">Filter by Hierarchy</p>
          <div class="grid-3">
            <label class="field">Category
              <select id="filterCategory"><option value="">All Categories</option></select>
            </label>
            <label class="field">Subcategory
              <select id="filterSubCategory" disabled><option value="">All Subcategories</option></select>
            </label>
            <label class="field">Group
              <select id="filterGroup" disabled><option value="">All Groups</option></select>
            </label>
            <label class="field">Sub-group
              <select id="filterSubGroup" disabled><option value="">All Sub-groups</option></select>
            </label>
            <label class="field">Item
              <select id="filterItem"><option value="">All Items</option></select>
            </label>
            <label class="field">BN
              <select id="filterBn" disabled><option value="">All BNs</option></select>
            </label>
          </div>
          <div class="row-actions" style="margin-top:8px">
            <button id="clearExploreBtn" class="btn ghost" type="button">Clear Filters</button>
            <span id="exploreCount" class="muted-label"></span>
          </div>
        </div>

        <div class="table-wrap">
          <table id="exploreTable">
            <thead>
              <tr>
                <th>Category</th>
                <th>Subcategory</th>
                <th>Group</th>
                <th>Sub-group</th>
                <th>Item</th>
                <th>BN</th>
                <th>Batch Size</th>
                <th>UOM</th>
              </tr>
            </thead>
            <tbody id="exploreTableBody"></tbody>
          </table>
        </div>
      </section>

    </div><!-- /.layout -->

    <!-- ── Edit BMR Modal ─────────────────────────────────────── -->
    <div id="editModal" class="modal-overlay hidden" role="dialog" aria-modal="true" aria-labelledby="editModalTitle">
      <div class="modal-window">
        <div class="modal-header">
          <h2 id="editModalTitle" class="modal-title">Edit BMR Entry</h2>
          <button id="editModalClose" class="modal-close-btn" type="button" aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div id="editMappedNote" class="modal-info hidden">
          &#9888; This BMR is mapped to a batch plan. BN and Batch Size are locked and cannot be changed.
        </div>
        <div class="modal-body">
          <label class="field">Item
            <select id="editItem"></select>
          </label>
          <div class="field-row">
            <label class="field">BN
              <input id="editBn" type="text" placeholder="Batch Number" />
            </label>
            <label class="field">Batch Size
              <input id="editSize" type="number" step="0.01" min="0" placeholder="e.g. 100" />
            </label>
          </div>
          <label class="field">UOM
            <select id="editUom">
              <option value="">— Select UOM —</option>
              <option>Kg</option>
              <option>L</option>
              <option>Nos</option>
              <option>g</option>
              <option>mL</option>
            </select>
          </label>
        </div>
        <div class="modal-footer">
          <button id="editCancelBtn" class="btn"         type="button">Cancel</button>
          <button id="editSaveBtn"   class="btn primary" type="button">Save Changes</button>
        </div>
      </div>
    </div>

    <!-- ── Toast container ─────────────────────────────────────── -->
    <div id="toastContainer" aria-live="polite" aria-atomic="false"></div>

    <script type="module" src="./js/manage-bmr.js"></script>
  </body>
</html>
"""

dest = pathlib.Path(r"d:\ELECTRON PROJECTS\daily-worklog-app\public\shared\manage-bmr.html")
dest.write_text(HTML, encoding="utf-8")
print(f"Written {len(HTML)} chars")
