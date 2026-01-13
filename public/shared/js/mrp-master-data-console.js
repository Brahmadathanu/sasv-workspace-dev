import { supabase } from "./supabaseClient.js";
import {
  loadAccessContext,
  canEditPM,
  isProcurementAdmin,
  canEditRM,
} from "./mrpAccess.js";
import { Platform } from "./platform.js";
import {
  ensureDetailModal,
  openDetailModal,
  closeDetailModal,
  showConfirm,
} from "./detailModal.js";
import { showToast } from "./toast.js";

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

// Loading overlay counter to support nested loads
let __mrpLoadingCount = 0;
function showMrpLoading(msg) {
  try {
    __mrpLoadingCount = Math.max(0, __mrpLoadingCount) + 1;
    const el = document.getElementById("mrpLoadingOverlay");
    if (el) {
      el.style.display = "flex";
      el.setAttribute("aria-hidden", "false");
      const txt = el.querySelector(".mrp-loading-text");
      if (txt && msg) txt.textContent = msg;
    }
  } catch (err) {
    console.debug("showMrpLoading error:", err);
  }
}
function hideMrpLoading() {
  try {
    __mrpLoadingCount = Math.max(0, __mrpLoadingCount - 1);
    if (__mrpLoadingCount > 0) return;
    const el = document.getElementById("mrpLoadingOverlay");
    if (el) {
      el.style.display = "none";
      el.setAttribute("aria-hidden", "true");
    }
  } catch (err) {
    console.debug("hideMrpLoading error:", err);
  }
}

function showSection(name) {
  document.getElementById("moqSection").style.display =
    name === "moq" ? "" : "none";
  document.getElementById("convSection").style.display =
    name === "conv" ? "" : "none";
  document.getElementById("seasonSection").style.display =
    name === "season" ? "" : "none";
  document.getElementById("mapSection").style.display =
    name === "map" ? "" : "none";
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
          <label for="moq_is_active" style="font-weight:600;color:#374151;font-size:0.9rem">Active</label>
        </div>
      </form>
      <datalist id="moq_material_kind_list">
        <option value="raw_material"></option>
        <option value="packaging_material"></option>
        <option value="indirect_material"></option>
      </datalist>
    `;
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
      return showToast("No permission", { type: "warning" });
    const stock_item_id =
      Number(document.getElementById("moq_stock_item_id").value) || null;
    const material_kind =
      document.getElementById("moq_material_kind").value || null;
    const moq_qty =
      Number(document.getElementById("moq_moq_qty").value) || null;
    const uom_id = Number(document.getElementById("moq_uom_id").value) || null;
    const effective_from =
      document.getElementById("moq_effective_from").value || null;
    const effective_to =
      document.getElementById("moq_effective_to").value || null;
    const note = document.getElementById("moq_note").value || null;
    const is_active = !!document.getElementById("moq_is_active").checked;
    // validation
    if (!stock_item_id || !material_kind || !moq_qty || !uom_id)
      return showToast(
        "Please fill required fields: Stock Item, Material Kind, MOQ Quantity, and UOM",
        "warning"
      );
    const payload = {
      stock_item_id,
      material_kind,
      moq_qty,
      uom_id,
      effective_from,
      effective_to,
      note,
      is_active,
    };
    Object.assign(payload, actorSnapshot());
    try {
      const { error } = await supabase
        .from("inv_stock_item_moq_policy")
        .upsert(payload);
      if (error) throw error;
      showToast("Saved successfully", { type: "success" });
      closeDetailModal();
      await loadMoqList();
    } catch (e) {
      console.debug(e);
      showToast("Save failed: " + (e.message || e), { type: "error" });
    }
  });

  const btnCancel = document.createElement("button");
  btnCancel.className = "mrp-btn mrp-btn-ghost";
  btnCancel.textContent = "Cancel";
  btnCancel.addEventListener("click", (ev) => {
    ev.preventDefault();
    closeDetailModal();
  });

  actions.appendChild(btnCancel);
  actions.appendChild(btnSave);

  root.style.display = "flex";
}

async function showMoqDetail(row = {}) {
  ensureDetailModal();
  const root = document.getElementById("copilot-detail-modal");
  const title = root.querySelector("#copilot-modal-title");
  const sub = root.querySelector("#copilot-modal-sub");
  const body = root.querySelector("#copilot-modal-body");
  const actions = root.querySelector("#copilot-modal-actions");

  title.textContent = "MOQ Policy";
  sub.textContent = "Policy details";
  actions.innerHTML = "";
  body.innerHTML =
    '<div style="padding:20px;text-align:center;color:#6b7280">Loading...</div>';

  // fetch UOM code for display if needed
  let uomCode = "";
  try {
    if (row.uom_id) {
      const { data: uomData, error: uomErr } = await supabase
        .from("inv_uom")
        .select("code")
        .eq("id", row.uom_id)
        .limit(1);
      if (!uomErr && uomData && uomData[0]) uomCode = uomData[0].code || "";
    }
  } catch (e) {
    console.debug("Failed to fetch UOM for detail view", e);
  }

  const stockDisplay = row.stock_item
    ? `${row.stock_item.code || ""} - ${row.stock_item.name || ""}`
    : `ID: ${row.stock_item_id || "N/A"}`;

  body.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;padding:8px;box-sizing:border-box">
      <div style="grid-column:1/3;padding:12px;background:#f8fafc;border-radius:6px;border-left:4px solid #0f172a">
        <div style="font-size:0.85rem;color:#6b7280;margin-bottom:4px">Stock Item</div>
        <div style="font-weight:600;color:#0f172a">${stockDisplay}</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:6px">
        <div style="font-weight:600;color:#374151;font-size:0.9rem">Stock Item ID</div>
        <div style="color:#0f172a">${row.stock_item_id || ""}</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:6px">
        <div style="font-weight:600;color:#374151;font-size:0.9rem">Material Kind</div>
        <div style="color:#0f172a">${row.material_kind || ""}</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:6px">
        <div style="font-weight:600;color:#374151;font-size:0.9rem">MOQ Quantity</div>
        <div style="color:#0f172a">${row.moq_qty ?? ""} ${
    uomCode ? ` ${uomCode}` : ""
  }</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:6px">
        <div style="font-weight:600;color:#374151;font-size:0.9rem">Effective From</div>
        <div style="color:#0f172a">${row.effective_from || ""}</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:6px">
        <div style="font-weight:600;color:#374151;font-size:0.9rem">Effective To</div>
        <div style="color:#0f172a">${row.effective_to || ""}</div>
      </div>
      <div style="grid-column:1/3;display:flex;align-items:center;gap:8px;margin-top:6px">
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
          row.notes || ""
        ).replace(/</g, "&lt;")}</div>
      </div>
    </div>
  `;

  // inject table-specific styles to match MOQ Policy table visuals
  if (!document.getElementById("rmTableStyles")) {
    const s = document.createElement("style");
    s.id = "rmTableStyles";
    s.textContent = `
      #rmTable { border-collapse: collapse; width: 100%; table-layout: fixed; }
      #rmTable th, #rmTable td { border: 1px solid #e5e7eb; padding: 10px; }
      #rmTable th { background: #f8fafc; color: #374151; font-weight: 600; font-size: 0.95rem; }
      #rmTable tbody tr:nth-child(even) { background: #fbfdff; }
      #rmTable tbody tr:hover { background: #f8fbff; }
    `;
    document.head.appendChild(s);
  }
  // actions
  const btnEdit = document.createElement("button");
  btnEdit.className = "mrp-btn mrp-btn-secondary";
  btnEdit.textContent = "Edit";
  btnEdit.addEventListener("click", () => openMoqEditModal(row));

  const btnDelete = document.createElement("button");
  btnDelete.className = "mrp-btn mrp-btn-danger";
  btnDelete.textContent = "Delete";
  btnDelete.addEventListener("click", async () => {
    const ok = await showConfirm("Delete this MOQ policy?", "Confirm delete");
    if (!ok) return;
    try {
      const { error } = await supabase
        .from("inv_stock_item_moq_policy")
        .delete()
        .eq("id", row.id);
      if (error) throw error;
      showToast("Deleted", { type: "success" });
      closeDetailModal();
      await loadMoqList();
    } catch (e) {
      console.debug(e);
      showToast("Delete failed", { type: "error" });
    }
  });

  actions.appendChild(btnEdit);
  actions.appendChild(btnDelete);

  root.style.display = "flex";
}

async function openMoqEditModal(row = {}) {
  ensureDetailModal();
  const root = document.getElementById("copilot-detail-modal");
  const title = root.querySelector("#copilot-modal-title");
  const sub = root.querySelector("#copilot-modal-sub");
  const body = root.querySelector("#copilot-modal-body");
  const actions = root.querySelector("#copilot-modal-actions");

  // Use stock item name (if available) in title; avoid showing raw numeric IDs
  const titleStock = row.stock_item ? row.stock_item.name || "" : "";
  title.textContent = titleStock
    ? `Edit MOQ Policy — ${titleStock}`
    : "Edit MOQ Policy";
  sub.textContent = "Update minimum order quantity policy";
  actions.innerHTML = "";

  // Fetch UOMs for dropdown
  body.innerHTML =
    '<div style="padding:20px;text-align:center;color:#6b7280">Loading...</div>';

  try {
    const { data: uoms } = await supabase
      .from("inv_uom")
      .select("id,code")
      .order("code");

    const uomOptions = (uoms || [])
      .map(
        (uom) =>
          `<option value="${uom.id}" ${
            row.uom_id === uom.id ? "selected" : ""
          }>${uom.code}</option>`
      )
      .join("");

    const stockItemDisplay = row.stock_item
      ? `${row.stock_item.code || ""} - ${row.stock_item.name || ""}`
      : `${row.stock_item_id || "N/A"}`;

    // Use the same professional two-column grid and consistent field blocks as Add modal
    body.innerHTML = `
      <form id="moq_edit_form" style="display:grid;grid-template-columns:1fr 1fr;gap:16px;padding:12px;box-sizing:border-box">
        <div style="grid-column:1/3;padding:12px;background:#f3f4f6;border-radius:6px;border-left:4px solid #0f172a">
          <div style="font-size:0.85rem;color:#6b7280;margin-bottom:4px">Stock Item</div>
          <div style="font-weight:600;color:#0f172a">${stockItemDisplay}</div>
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

        <div style="grid-column:1/3;display:flex;align-items:center;gap:8px;box-sizing:border-box;margin-top:4px">
          <input id="moq_is_active" type="checkbox" style="width:18px;height:18px;cursor:pointer;flex-shrink:0" ${
            row.is_active ? "checked" : ""
          }/>
          <label for="moq_is_active" style="font-weight:600;color:#374151;font-size:0.9rem;display:inline-block">Active</label>
        </div>

        <div style="grid-column:1/3">
          <label for="moq_note" style="font-weight:600;color:#374151;font-size:0.9rem;display:block;margin-bottom:6px">Note</label>
          <textarea id="moq_note" rows="3" style="width:100%;padding:10px 12px;border:1px solid #d1d5db;border-radius:6px;font-size:0.95rem;resize:vertical;box-sizing:border-box">${(
            row.note || ""
          ).replace(/</g, "&lt;")}</textarea>
        </div>
      </form>
      <datalist id="moq_material_kind_list">
        <option value="raw_material"></option>
        <option value="packaging_material"></option>
        <option value="indirect_material"></option>
      </datalist>
    `;
  } catch (e) {
    console.debug(e);
    body.innerHTML =
      '<div style="padding:20px;color:#dc2626">Failed to load form data</div>';
    return;
  }

  // Add action buttons
  const btnSave = document.createElement("button");
  btnSave.className = "mrp-btn mrp-btn-primary";
  btnSave.textContent = "Save";
  btnSave.addEventListener("click", async (ev) => {
    ev.preventDefault();
    if (!(isProcurementAdmin() || canEditPM()))
      return showToast("No permission", { type: "warning" });
    try {
      const material_kind =
        document.getElementById("moq_material_kind").value || null;
      const moq_qty =
        Number(document.getElementById("moq_moq_qty").value) || null;
      const uom_id =
        Number(document.getElementById("moq_uom_id").value) || null;
      const is_active = !!document.getElementById("moq_is_active").checked;

      if (!material_kind || !moq_qty || !uom_id) {
        return showToast("Please fill all required fields", {
          type: "warning",
        });
      }

      const payload = Object.assign({}, row, {
        material_kind,
        moq_qty,
        uom_id,
        is_active,
      });
      Object.assign(payload, actorSnapshot());
      const { error } = await supabase
        .from("inv_stock_item_moq_policy")
        .upsert(payload);
      if (error) throw error;
      showToast("Saved successfully", { type: "success" });
      closeDetailModal();
      await loadMoqList();
    } catch (e) {
      console.debug(e);
      showToast("Save failed: " + (e.message || e), { type: "error" });
    }
  });

  const btnCancel = document.createElement("button");
  btnCancel.className = "mrp-btn mrp-btn-ghost";
  btnCancel.textContent = "Cancel";
  btnCancel.addEventListener("click", (ev) => {
    ev.preventDefault();
    showMoqDetail(row);
  });

  actions.appendChild(btnCancel);
  actions.appendChild(btnSave);

  root.style.display = "flex";
}

async function loadMoqList() {
  showMrpLoading("Loading MOQ policies...");
  const node = document.getElementById("moqSection");
  node.innerHTML = '<div class="muted">Loading MOQ policies...</div>';
  try {
    const page = moqPage || 1;
    const pageSize = moqPageSize || 50;
    const from = (page - 1) * pageSize;
    const to = page * pageSize - 1;

    const { data, error, count } = await supabase
      .from("inv_stock_item_moq_policy")
      .select("*,stock_item:inv_stock_item(code,name),uom:inv_uom(code)", {
        count: "exact",
      })
      .order("updated_at", { ascending: false })
      .range(from, to);
    if (error) throw error;
    if (!data || !data.length) {
      node.innerHTML = '<div class="muted">No MOQ policies</div>';
      moqTotal = count || 0;
      return;
    }
    moqTotal = count || 0;
    const totalPages = Math.max(1, Math.ceil((moqTotal || 0) / pageSize));

    let html =
      '<div style="display:flex;justify-content:space-between;align-items:center;margin:0 0 6px 0">' +
      // left: search
      '<div style="display:flex;gap:8px;align-items:center">' +
      '<input id="moqSearch" placeholder="Type in to search..." title="Type Stock Item ID, Code or Name to search" style="padding:8px 12px;border:1px solid #d1d5db;border-radius:6px;font-size:0.95rem;min-width:220px;margin-right:12px"/>' +
      "</div>" +
      // right: add + export
      '<div style="display:flex;gap:8px;align-items:center">' +
      '<button id="addMoq" class="mrp-btn mrp-btn-primary" title="Add policy" aria-label="Add policy" style="width:40px;height:40px;display:inline-flex;align-items:center;justify-content:center;padding:6px">' +
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M12 5v14M5 12h14" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
      "</button>" +
      '<button id="exportMoqCsv" class="mrp-btn mrp-btn-ghost" title="Export CSV" aria-label="Export CSV" style="width:40px;height:40px;display:inline-flex;align-items:center;justify-content:center;padding:6px;margin-left:8px">' +
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke="#0f172a" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M7 10l5-5 5 5" stroke="#0f172a" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 5v12" stroke="#0f172a" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
      "</button>" +
      "</div>" +
      "</div>";

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
      '<table id="mrpTable_moq" style="width:100%;border-collapse:collapse;table-layout:fixed">' +
      "<thead><tr>" +
      '<th style="width:8%;">POLICY ID</th>' +
      '<th style="width:8%;">STOCK ITEM ID</th>' +
      '<th style="width:8%;">Code</th>' +
      '<th style="width:44%;">Name</th>' +
      '<th style="width:10%;">Material Kind</th>' +
      '<th style="width:8%;">MOQ</th>' +
      '<th style="width:7%;">UOM</th>' +
      '<th style="width:7%;">Active</th>' +
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
      html += `<tr data-id="${r.id}">`;
      html += `<td>${idCell}</td>`; // POLICY ID
      html += `<td>${stockItemIdCell}</td>`; // STOCK ITEM ID
      html += `<td>${codeCell}</td>`;
      html += `<td title="${safeName}">${safeName}</td>`;
      html += `<td>${materialKind}</td>`;
      html += `<td>${moq}</td>`;
      html += `<td>${uomCode}</td>`;
      html += `<td>${active}</td>`;
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
        if (!table) return showToast("No table to export", { type: "error" });
        const headers = Array.from(table.querySelectorAll("thead th")).map(
          (th) => (th.textContent || th.innerText || "").trim()
        );
        const rows = Array.from(table.querySelectorAll("tbody tr")).filter(
          (tr) => getComputedStyle(tr).display !== "none"
        );
        if (!rows.length)
          return showToast("No visible rows to export", { type: "error" });
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
        showToast("Export started", { type: "success" });
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
    hideMrpLoading();
  } catch (e) {
    console.debug(e);
    node.innerHTML = `<div class="error">Failed loading MOQ policies: ${String(
      e?.message || e
    )}</div>`;
    hideMrpLoading();
  }
}

async function exportMappingsCsv() {
  try {
    // fetch all mappings
    const { data: allMaps, error: mapErr } = await supabase
      .from("inv_stock_item_season_profile")
      .select("*");
    if (mapErr) throw mapErr;
    const ids = (allMaps || []).map((m) => m.stock_item_id).filter(Boolean);
    let items = [];
    if (ids.length) {
      const { data: it, error: itErr } = await supabase
        .from("v_inv_stock_item_with_class")
        .select("*")
        .in("stock_item_id", ids);
      if (itErr) throw itErr;
      items = it || [];
    }
    // join
    const rows = (allMaps || []).map((m) => {
      const it = items.find((x) => x.stock_item_id === m.stock_item_id) || {};
      return {
        stock_item_id: m.stock_item_id,
        code: it.code || "",
        name: it.name || "",
        season_profile_id: m.season_profile_id,
        is_active: m.is_active,
        notes: m.notes || "",
        created_at: m.created_at || "",
        updated_at: m.updated_at || "",
      };
    });
    const headers = Object.keys(rows[0] || {});
    const csv = [headers.join(",")]
      .concat(
        rows.map((r) =>
          headers
            .map((h) => `"${String(r[h] || "").replace(/"/g, '""')}"`)
            .join(",")
        )
      )
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const d = new Date();
    const todayStamp =
      String(d.getDate()).padStart(2, "0") +
      String(d.getMonth() + 1).padStart(2, "0") +
      d.getFullYear();
    a.download = `${todayStamp}_rm_seasonal_mappings.csv`;
    document.body.appendChild(a);
    a.click();
    showToast("Export started", { type: "success" });
    a.remove();
    URL.revokeObjectURL(url);
  } catch (err) {
    console.debug("Export failed", err);
    showToast("Export failed", { type: "error" });
  }
}

async function loadConvList() {
  showMrpLoading("Loading conversions...");
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
      hideMrpLoading();
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
      '<table id="mrpTable_conv" style="width:100%;border-collapse:collapse;table-layout:fixed">' +
      "<thead>" +
      // Group header row with colspan (ERP-style)
      "<tr class='conv-group-header-row'>" +
      '<th colspan="3" style="text-align:center;color:#0a3a7a;background:linear-gradient(180deg,#e0f0ff 0%,#d4e9ff 100%)">Consuming Form</th>' +
      '<th colspan="3" style="text-align:center;color:#0d5c2f;background:linear-gradient(180deg,#e8f8ed 0%,#dcf4e4 100%)">Purchase Form</th>' +
      '<th colspan="2" style="background:#fafafa"></th>' +
      "</tr>" +
      // Column header row (short labels)
      "<tr>" +
      '<th style="width:8%;background:#f8fbff">ID</th>' +
      '<th style="width:12%;background:#f8fbff">Code</th>' +
      '<th style="width:24%;background:#f8fbff;border-right:2px solid #93c5fd">Name</th>' +
      '<th style="width:8%;background:#f0fdf4">ID</th>' +
      '<th style="width:12%;background:#f0fdf4">Code</th>' +
      '<th style="width:24%;background:#f0fdf4;border-right:2px solid #86efac">Name</th>' +
      '<th style="width:6%;background:#fafafa">FACTOR</th>' +
      '<th style="width:6%;background:#fafafa">ACTIVE</th>' +
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
      html += `<tr data-id="${r.id}">`;
      // consuming group columns (apply consuming-col class)
      html += `<td class="consuming-col">${r.consume_stock_item_id || ""}</td>`;
      html += `<td class="consuming-col">${consumeCode}</td>`;
      html += `<td class="consuming-col" title="${safeConsumeName}">${safeConsumeName}</td>`;
      // purchase group columns (apply purchase-col class)
      html += `<td class="purchase-col">${r.purchase_stock_item_id || ""}</td>`;
      html += `<td class="purchase-col">${purchaseCode}</td>`;
      html += `<td class="purchase-col" title="${safePurchaseName}">${safePurchaseName}</td>`;
      // neutral columns
      html += `<td>${r.factor || ""}</td>`;
      html += `<td>${r.is_active ? "Yes" : "No"}</td>`;
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
        if (!table) return showToast("No table to export", { type: "error" });
        const headers = Array.from(table.querySelectorAll("thead th")).map(
          (th) => (th.textContent || th.innerText || "").trim()
        );
        const rows = Array.from(table.querySelectorAll("tbody tr")).filter(
          (tr) => getComputedStyle(tr).display !== "none"
        );
        if (!rows.length)
          return showToast("No visible rows to export", { type: "error" });
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
        showToast("Export started", { type: "success" });
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
    hideMrpLoading();
  } catch (e) {
    console.debug(e);
    node.innerHTML = `<div class="error">Failed loading conversions: ${String(
      e?.message || e
    )}</div>`;
    hideMrpLoading();
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
      showToast("Deleted", { type: "success" });
      closeDetailModal();
      await loadConvList();
    } catch (e) {
      console.debug(e);
      showToast("Delete failed", { type: "error" });
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
      return showToast("No permission", { type: "warning" });
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
      showToast("Saved", { type: "success" });
      closeDetailModal();
      await loadConvList();
    } catch (e) {
      console.debug(e);
      showToast("Save failed", { type: "error" });
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
  showMrpLoading("Loading season profiles...");
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
      '<table id="mrpTable_season" style="width:100%;border-collapse:collapse;table-layout:fixed">' +
      "<thead><tr>" +
      '<th style="width:8%;">Profile ID</th>' +
      '<th style="width:34%;">Season Label</th>' +
      '<th style="width:20%;">Manufacture Months</th>' +
      '<th style="width:38%;">Month Split</th>' +
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
      html += `<td>${pid}</td>`;
      html += `<td>${label}</td>`;
      html += `<td>${months}</td>`;
      html += `<td>${(split || "").replace(/</g, "&lt;")}</td>`;
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
        showToast("Export started", { type: "success" });
      } catch (e) {
        console.debug(e);
        showToast("Export failed", { type: "error" });
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
    hideMrpLoading();

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
    hideMrpLoading();
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
          showToast("Deleted", { type: "success" });
          closeDetailModal();
          await loadSeasonList();
        } catch (e) {
          console.debug(e);
          showToast("Delete failed", { type: "error" });
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
          <label style="font-weight:600;color:#374151;font-size:0.9rem;display:block;margin-bottom:6px">Label <span style="color:#dc2626">*</span></label>
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
          return showToast("No permission", { type: "warning" });
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

          showToast("Saved", { type: "success" });
          closeDetailModal();
          await loadSeasonList();
        } catch (e) {
          console.debug(e);
          showToast("Save failed", { type: "error" });
        }
      });

      cancelBtn.addEventListener("click", () => closeDetailModal());

      actionsEl.appendChild(saveBtn);
      actionsEl.appendChild(cancelBtn);
    } catch (e) {
      console.debug(e);
      showToast("Failed loading profile details", { type: "error" });
    }
  })();
}

async function loadMapQuickEditor() {
  const node = document.getElementById("mapSection");
  // inline SVGs used by other tabs (kept consistent)
  const svgAdd =
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M12 5v14M5 12h14" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const svgExport =
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke="#0f172a" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M7 10l5-5 5 5" stroke="#0f172a" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 5v12" stroke="#0f172a" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  node.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin:0 0 6px 0">
      <div style="display:flex;gap:8px;align-items:center">
        <input id="textSearch" placeholder="Type in to search..." title="Type Stock Item ID, Code or Name to search" style="padding:8px 12px;border:1px solid #d1d5db;border-radius:6px;font-size:0.95rem;min-width:220px;margin-right:12px" />
      </div>
      <div style="display:flex;gap:8px;align-items:center">
        <button id="addMappingBtn" class="mrp-btn mrp-btn-primary" title="Add mapping" aria-label="Add mapping" style="width:40px;height:40px;display:inline-flex;align-items:center;justify-content:center;padding:6px">${svgAdd}</button>
        <button id="exportMappingBtn" class="mrp-btn mrp-btn-ghost" title="Export CSV" aria-label="Export CSV" style="width:40px;height:40px;display:inline-flex;align-items:center;justify-content:center;padding:6px;margin-left:8px">${svgExport}</button>
      </div>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin:6px 0 12px 0">
      <div style="display:flex;align-items:center">
        <span id="mapRowCount" style="display:inline-flex;align-items:center;justify-content:center;height:32px;padding:0 12px;border-radius:999px;background:rgba(59,130,246,0.08);color:#0b3a9a;font-weight:600;font-size:0.9rem;margin-left:8px">0 Rows</span>
      </div>
      <div id="mapPaginator" style="display:flex;gap:8px;align-items:center">
        <button id="mapPrev" class="mrp-btn mrp-btn-ghost" style="padding:6px 10px">‹</button>
        <span id="mapPagerInfo">Page 1 of 1</span>
        <button id="mapNext" class="mrp-btn mrp-btn-ghost" style="padding:6px 10px">›</button>
      </div>
    </div>
    <div>
      <div id="mrpTableContainer" style="max-height:55vh;">
        <table id="mrpTable_mapping" style="width:100%;border-collapse:collapse;table-layout:fixed">
          <thead>
            <tr>
              <th style="width:10%;">ID</th>
              <th style="width:20%;">Code</th>
              <th style="width:40%;">Name</th>
              <th style="width:20%;">Season Profile</th>
              <th style="width:10%;">Active</th>
            </tr>
          </thead>
          <tbody id="rmBody"></tbody>
        </table>
      </div>
    </div>
  `;

  // CSS handles all table styling automatically - no manual adjustments needed

  // adjust table container max-height to fill remaining viewport space
  (function adjustMapTableHeight() {
    const tbl = document.getElementById("tableContainer");
    if (!tbl) return;
    const adjust = () => {
      try {
        const top = tbl.getBoundingClientRect().top || 0;
        const avail = Math.max(200, window.innerHeight - top - 36);
        tbl.style.maxHeight = avail + "px";
      } catch {
        /* ignore */
      }
    };
    adjust();
    if (!window.__mapTableResizeRegistered) {
      window.addEventListener("resize", adjust);
      window.__mapTableResizeRegistered = true;
    }
  })();

  // local element getters
  // pagination state for mapped list
  let mapPage = 1;
  let mapPageSize = 50;
  let mapTotal = 0;

  const els = {
    textSearch: () => node.querySelector("#textSearch"),
    rowCount: () => node.querySelector("#mapRowCount"),
    rmBody: () => node.querySelector("#rmBody"),
  };

  let profiles = [];
  let rmItems = [];
  let mappings = new Map();

  async function openMappingEditModal(r) {
    ensureDetailModal();
    await fetchProfiles();
    const selectedMap = mappings.get(r.stock_item_id) || null;
    const profileOptions = profiles
      .map(
        (p) =>
          `<option value="${p.id}">${escapeHtml(
            p.label || p.name || String(p.id)
          )}</option>`
      )
      .join("");

    openDetailModal({
      title: `Edit mapping — ${r.code || r.stock_item_id}`,
      sections: [
        {
          title: "",
          type: "html",
          data: `
            <div class="two-col-form">
              <div class="col">
                <label>Season Profile</label>
                <select id="_map_profile_select">
                  <option value="">-- None --</option>
                  ${profileOptions}
                </select>
                <label style="display:block;margin-top:8px">Active</label>
                <input type="checkbox" id="_map_is_active" />
              </div>
              <div class="col">
                <label>Notes</label>
                <textarea id="_map_notes" rows="6" style="width:100%"></textarea>
                <div id="_profile_months_preview" style="margin-top:8px;color:#444;font-size:90%"></div>
              </div>
            </div>
          `,
        },
      ],
      onOpen: () => {
        const sel = document.getElementById("_map_profile_select");
        const notes = document.getElementById("_map_notes");
        const active = document.getElementById("_map_is_active");
        const preview = document.getElementById("_profile_months_preview");
        if (!sel || !notes || !active || !preview) return;
        sel.value =
          selectedMap && selectedMap.season_profile_id
            ? String(selectedMap.season_profile_id)
            : "";
        notes.value = selectedMap && selectedMap.notes ? selectedMap.notes : "";
        active.checked = selectedMap ? !!selectedMap.is_active : true;
        sel.addEventListener("change", () => {
          const v = sel.value ? Number(sel.value) : null;
          showProfileMonthsPreview(v, preview);
        });
        if (sel.value) showProfileMonthsPreview(Number(sel.value), preview);
      },
      actions: [
        {
          label: "Save",
          onClick: async () => {
            const sel = document.getElementById("_map_profile_select");
            const notes = document.getElementById("_map_notes");
            const active = document.getElementById("_map_is_active");
            const payload = {
              stock_item_id: r.stock_item_id,
              season_profile_id: sel && sel.value ? Number(sel.value) : null,
              is_active: active ? !!active.checked : true,
              notes: notes ? notes.value : null,
            };
            try {
              const { error } = await supabase
                .from("inv_stock_item_season_profile")
                .upsert(payload, { onConflict: ["stock_item_id"] });
              if (error) throw error;
              showToast("Mapping saved", { type: "success" });
              await fetchMappedPage();
              mergeAndRender();
              closeDetailModal();
            } catch (e) {
              console.debug(e);
              showToast("Save failed", { type: "error" });
            }
          },
        },
        {
          label: "Clear",
          onClick: async () => {
            const ok = await showConfirm(
              "Clear mapping for this item?",
              "Confirm clear"
            );
            if (!ok) return;
            try {
              const { error } = await supabase
                .from("inv_stock_item_season_profile")
                .delete()
                .eq("stock_item_id", r.stock_item_id);
              if (error) throw error;
              showToast("Mapping cleared", { type: "success" });
              await fetchMappedPage();
              mergeAndRender();
              closeDetailModal();
            } catch (e) {
              console.debug(e);
              showToast("Clear failed", { type: "error" });
            }
          },
        },
        { label: "Cancel", onClick: () => closeDetailModal() },
      ],
    });
  }

  async function openAddMappingModal() {
    ensureDetailModal();
    // ensure profiles are loaded
    await fetchProfiles();
    // fetch all mapped ids to determine unmapped stock items
    const { data: mappedAll, error: mapErr } = await supabase
      .from("inv_stock_item_season_profile")
      .select("stock_item_id");
    if (mapErr) {
      console.debug("Failed loading mapped ids", mapErr);
    }
    const mappedIds = (mappedAll || [])
      .map((m) => m.stock_item_id)
      .filter(Boolean);

    // fetch unmapped RM stock items for dropdown (limit to reasonable size)
    let unmapped = [];
    try {
      let q = supabase
        .from("v_inv_stock_item_with_class")
        .select("stock_item_id,code,name")
        .eq("category_code", "RM")
        .order("code", { ascending: true })
        .limit(2000);
      if (mappedIds.length)
        q = q.not("stock_item_id", "in", `(${mappedIds.join(",")})`);
      const { data, error } = await q;
      if (error) throw error;
      unmapped = data || [];
    } catch (err) {
      console.debug("Failed loading unmapped items", err);
      unmapped = [];
    }

    const profileOptions = profiles
      .map(
        (p) =>
          `<option value="${p.id}">${escapeHtml(
            p.label || p.name || String(p.id)
          )}</option>`
      )
      .join("");
    const stockOptions = unmapped
      .map(
        (s) =>
          `<option value="${s.stock_item_id}">${escapeHtml(
            (s.code || "") + " — " + (s.name || "")
          )}</option>`
      )
      .join("");

    openDetailModal({
      title: "Add mapping",
      sections: [
        {
          title: "",
          type: "html",
          data: `
            <form id="add_mapping_form" style="display:grid;grid-template-columns:1fr 1fr;gap:16px;padding:4px 0;box-sizing:border-box">
              <div style="display:flex;flex-direction:column;gap:6px;box-sizing:border-box">
                <label for="_add_stock_select" style="font-weight:600;color:#374151;font-size:0.9rem;display:block">Stock Item <span style="color:#dc2626">*</span></label>
                <select id="_add_stock_select" required style="width:100%;padding:10px 12px;border:1px solid #d1d5db;border-radius:6px;font-size:0.95rem;background:#fff;box-sizing:border-box">
                  <option value="">-- Select stock item --</option>
                  ${stockOptions}
                </select>
              </div>
              <div style="display:flex;flex-direction:column;gap:6px;box-sizing:border-box">
                <label for="_add_profile_select" style="font-weight:600;color:#374151;font-size:0.9rem;display:block">Season Profile</label>
                <select id="_add_profile_select" style="width:100%;padding:10px 12px;border:1px solid #d1d5db;border-radius:6px;font-size:0.95rem;background:#fff;box-sizing:border-box">
                  <option value="">-- None --</option>
                  ${profileOptions}
                </select>
              </div>
              <div style="grid-column:1/3;display:flex;flex-direction:column;gap:6px;box-sizing:border-box">
                <label for="_add_notes" style="font-weight:600;color:#374151;font-size:0.9rem;display:block">Notes</label>
                <textarea id="_add_notes" rows="4" style="width:100%;padding:10px 12px;border:1px solid #d1d5db;border-radius:6px;font-size:0.95rem;resize:vertical;box-sizing:border-box"></textarea>
              </div>
              <div style="display:flex;align-items:center;gap:8px;box-sizing:border-box">
                <input id="_add_is_active" type="checkbox" style="width:18px;height:18px;cursor:pointer;flex-shrink:0" checked />
                <label for="_add_is_active" style="font-weight:600;color:#374151;font-size:0.9rem">Active</label>
              </div>
              <div style="display:flex;align-items:center;justify-content:flex-end;gap:8px;box-sizing:border-box">
                <div id="_profile_months_preview" style="color:#6b7280;font-size:0.9rem;max-width:320px;text-align:right"></div>
              </div>
            </form>
          `,
        },
      ],
      onOpen: () => {
        const sel = document.getElementById("_add_profile_select");
        if (sel)
          sel.addEventListener("change", () => {
            const v = sel.value ? Number(sel.value) : null;
            showProfileMonthsPreview(v);
          });
      },
      actions: [
        { label: "Cancel", onClick: () => closeDetailModal() },
        {
          label: "Save",
          onClick: async () => {
            const selStock = document.getElementById("_add_stock_select");
            const selProfile = document.getElementById("_add_profile_select");
            const notes = document.getElementById("_add_notes");
            const active = document.getElementById("_add_is_active");
            if (!selStock || !selStock.value) {
              showToast("Pick a stock item", { type: "error" });
              return;
            }
            const payload = {
              stock_item_id: Number(selStock.value),
              season_profile_id:
                selProfile && selProfile.value
                  ? Number(selProfile.value)
                  : null,
              is_active: active ? !!active.checked : true,
              notes: notes ? notes.value : null,
            };
            try {
              const { error } = await supabase
                .from("inv_stock_item_season_profile")
                .upsert(payload, { onConflict: ["stock_item_id"] });
              if (error) throw error;
              showToast("Mapping added", { type: "success" });
              // refresh current page
              await fetchMappedPage();
              mergeAndRender();
              closeDetailModal();
            } catch (e) {
              console.debug(e);
              showToast("Save failed", { type: "error" });
            }
          },
        },
      ],
    });
  }

  function showProfileMonthsPreview(profileId, targetEl) {
    const preview =
      targetEl || document.getElementById("_profile_months_preview");
    if (!preview) return;
    if (!profileId) {
      preview.innerHTML = "";
      return;
    }
    const p = profiles.find((x) => x.id === profileId);
    if (!p) {
      preview.innerHTML = "(profile not found)";
      return;
    }
    if (p.manufacture_months && Array.isArray(p.manufacture_months)) {
      preview.innerHTML = p.manufacture_months
        .map((m) => monthNames[m - 1] || String(m))
        .join(", ");
    } else if (p.month_split_pct) {
      try {
        const obj =
          typeof p.month_split_pct === "string"
            ? JSON.parse(p.month_split_pct)
            : p.month_split_pct;
        preview.innerHTML = Object.keys(obj)
          .map(
            (k) =>
              `${monthNames[Number(k) - 1] || k}: ${Number(obj[k]).toFixed(2)}%`
          )
          .join("; ");
      } catch (err) {
        console.debug("profile month_split_pct parse failed", err);
        preview.innerHTML = "(invalid month split)";
      }
    } else preview.innerHTML = "(no months)";
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
      showToast("Failed loading season profiles", { type: "error" });
      profiles = [];
    }
  }

  // Fetch page of mappings from the mapping table, then fetch stock item details
  async function fetchMappedPage() {
    try {
      const page = mapPage || 1;
      const pageSize = mapPageSize || 50;
      const from = (page - 1) * pageSize;
      const to = page * pageSize - 1;

      // get page of mappings (primary source of truth)
      const {
        data: mapData,
        error: mapErr,
        count,
      } = await supabase
        .from("inv_stock_item_season_profile")
        .select("*", { count: "exact" })
        .order("stock_item_id", { ascending: true })
        .range(from, to);
      if (mapErr) throw mapErr;

      mapTotal = count || 0;
      mappings = new Map();
      const ids = (mapData || []).map((m) => m.stock_item_id).filter(Boolean);
      (mapData || []).forEach((m) => mappings.set(m.stock_item_id, m));

      if (!ids.length) {
        rmItems = [];
      } else {
        const { data: items, error: itemsErr } = await supabase
          .from("v_inv_stock_item_with_class")
          .select("*")
          .in("stock_item_id", ids)
          .order("code", { ascending: true });
        if (itemsErr) throw itemsErr;
        rmItems = items || [];
      }

      // update pager info
      const totalPages = Math.max(1, Math.ceil((mapTotal || 0) / pageSize));
      const pi = node.querySelector("#mapPagerInfo");
      if (pi) pi.textContent = `Page ${page} of ${totalPages}`;
      console.debug("fetchMappedPage done", {
        rmItemsLength: rmItems.length,
        mapTotal,
      });
    } catch (err) {
      console.error("Failed loading mapped page", err);
      showToast("Failed loading mappings", { type: "error" });
      rmItems = [];
      mapTotal = 0;
      mappings = new Map();
    }
  }

  // (fetchMappings removed; fetchMappedPage populates `mappings` for the page)

  function mergeAndRender() {
    const tb = els.rmBody();
    tb.innerHTML = "";
    const txt = (els.textSearch().value || "").toLowerCase().trim();
    console.debug("mergeAndRender", {
      rmItems: (rmItems || []).length,
      mappings: mappings.size,
    });
    const rows = (rmItems || []).filter((r) => {
      const hay = [String(r.stock_item_id || ""), r.code || "", r.name || ""]
        .join(" ")
        .toLowerCase();
      if (!txt) return true;
      return hay.includes(txt);
    });
    els.rowCount().textContent = `${rows.length} Rows`;
    console.debug("renderRows", { visible: rows.length, total: mapTotal });

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
        <td title="${escapeHtml(r.name || "")}">${escapeHtml(r.name || "")}</td>
        <td>${escapeHtml(profileLabel)}</td>
        <td>${m ? (m.is_active ? "Yes" : "No") : "-"}</td>
      `;

      tr.dataset.id = String(r.stock_item_id || "");
      tr.addEventListener("click", () => showMappingDetail(r));
      tb.appendChild(tr);
    });
  }

  // exported-ish variable reserved (no three-way filter in mapped-only view)

  async function showMappingDetail(r) {
    ensureDetailModal();
    const m = mappings.get(r.stock_item_id) || null;
    const profileLabel = m
      ? profiles.find((p) => p.id === m.season_profile_id)?.label ||
        String(m.season_profile_id)
      : "(none)";

    openDetailModal({
      title: `${r.code || r.stock_item_id} — ${r.name || ""}`,
      sections: [
        {
          title: "Mapping",
          type: "kv",
          data: {
            "RM ID": r.stock_item_id,
            Code: r.code,
            Name: r.name,
            "Season Profile": profileLabel,
            Active: m ? (m.is_active ? "Yes" : "No") : "-",
          },
        },
        {
          title: "Notes",
          type: "html",
          data: `<div style="white-space:pre-wrap">${
            m && m.notes ? String(m.notes).replace(/</g, "&lt;") : ""
          }</div>`,
        },
      ],
      actions: [
        {
          label: "Edit",
          onClick: () => {
            closeDetailModal();
            openMappingEditModal(r);
          },
        },
        {
          label: "Delete",
          onClick: async () => {
            const ok = await showConfirm(
              "Delete mapping for this raw material?",
              "Confirm delete"
            );
            if (!ok) return;
            try {
              const { error } = await supabase
                .from("inv_stock_item_season_profile")
                .delete()
                .eq("stock_item_id", r.stock_item_id);
              if (error) throw error;
              showToast("Mapping deleted", { type: "success" });
              await fetchMappedPage();
              mergeAndRender();
              closeDetailModal();
            } catch (e) {
              console.debug(e);
              showToast("Delete failed", { type: "error" });
            }
          },
        },
      ],
    });
  }

  function wireUp() {
    node
      .querySelector("#homeBtn")
      ?.addEventListener(
        "click",
        () => (window.location.href = "../../index.html")
      );

    // search input
    node.querySelector("#textSearch")?.addEventListener("input", () => {
      mergeAndRender();
    });

    // paginator
    node.querySelector("#mapPrev")?.addEventListener("click", async () => {
      if (mapPage > 1) {
        mapPage -= 1;
        await fetchMappedPage();
        mergeAndRender();
      }
    });
    node.querySelector("#mapNext")?.addEventListener("click", async () => {
      const totalPages = Math.max(1, Math.ceil((mapTotal || 0) / mapPageSize));
      if (mapPage < totalPages) {
        mapPage += 1;
        await fetchMappedPage();
        mergeAndRender();
      }
    });
    // add / export buttons
    node
      .querySelector("#addMappingBtn")
      ?.addEventListener("click", async () => {
        await openAddMappingModal();
      });
    node
      .querySelector("#exportMappingBtn")
      ?.addEventListener("click", async () => {
        await exportMappingsCsv();
      });
  }

  async function loadAll() {
    await fetchProfiles();
    await fetchMappedPage();
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
    const sb = node.querySelector("#addMappingBtn");
    if (sb) sb.disabled = !canEdit;
  } catch (e) {
    void e;
  }
}

window.addEventListener("DOMContentLoaded", init);
