import { supabase } from "./supabaseClient.js";
import { $, toast, confirmDialog } from "./ui-helpers.js";

const table = $("#uomTable tbody");
const rowCount = $("#rowCount");
const editor = $("#editor");
const editorTitle = $("#editorTitle");
const codeEl = $("#code");
const dimensionEl = $("#dimension_id");
const notesEl = $("#notes");
const isBaseEl = $("#is_base");
const idEl = $("#uomId");
const btnAdd = $("#btnAdd");
const btnSave = $("#btnSave");
const btnCancel = $("#btnCancel");
const tabUoms = $("#tabUoms");
const tabDims = $("#tabDims");
const dimsPanel = $("#dimensionsPanel");
const dimTable = $("#dimTable tbody");
const btnAddDim = $("#btnAddDim");
const dimName = $("#dimName");
const dimNotes = $("#dimNotes");
const uomTableEl = $("#uomTable");

// in-memory map of dimensions by id
let dimensions = {};
let editingRowId = null; // currently inline-editing uom id

async function initAuth() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    window.location.href = "login.html";
    return;
  }
}

async function fetchUoms() {
  const { data, error } = await supabase
    .from("inv_uom")
    .select("id, code, dimension_id, is_base, notes")
    .order("code", { ascending: true });
  if (error) throw error;
  return data || [];
}

async function fetchDimensions() {
  const { data, error } = await supabase
    .from("inv_uom_dimension")
    .select("id, name, notes")
    .order("id", { ascending: true });
  if (error) throw error;
  dimensions = Object.fromEntries((data || []).map((d) => [d.id, d]));
  return data || [];
}

function populateDimensionSelect() {
  if (!dimensionEl) return;
  const opts = ['<option value="">-- Select dimension --</option>'];
  Object.values(dimensions).forEach((d) =>
    opts.push(`<option value="${d.id}">${d.name}</option>`)
  );
  dimensionEl.innerHTML = opts.join("");
}

function render(rows) {
  table.innerHTML = "";
  rows.forEach((r) => {
    const tr = document.createElement("tr");
    const dimName = r.dimension_id
      ? dimensions[r.dimension_id]?.name || r.dimension_id
      : "";
    tr.dataset.id = r.id;
    tr.innerHTML = `
          <td><code>${r.code}</code></td>
          <td>${dimName}</td>
          <td>${r.is_base ? "True" : "False"}</td>
          <td class="actions">
            <button data-id="${r.id}" data-code="${
      r.code
    }" class="icon ghost btnEdit" title="Edit">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1.003 1.003 0 0 0 0-1.42l-2.34-2.34a1.003 1.003 0 0 0-1.42 0l-1.83 1.83 3.75 3.75 1.84-1.82z" fill="currentColor"/></svg>
            </button>
            <button data-id="${
              r.id
            }" class="icon ghost btnDelete" title="Delete">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M6 19c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" fill="currentColor"/></svg>
            </button>
          </td>
        `;
    table.appendChild(tr);
  });
  rowCount.textContent = `${rows.length} rows`;
  // bind edit actions
  table
    .querySelectorAll(".btnEdit")
    .forEach((b) => b.addEventListener("click", onEdit));
  // bind delete actions for uoms
  table.querySelectorAll(".btnDelete").forEach((b) =>
    b.addEventListener("click", async (e) => {
      const id = Number(e.currentTarget.dataset.id);
      const ok = await confirmDialog("Delete UOM? This cannot be undone.");
      if (!ok) return;
      const { error } = await supabase.from("inv_uom").delete().eq("id", id);
      if (error) return toast(error.message, "error");
      toast("Deleted", "success");
      await refresh();
    })
  );
}

// Start inline edit for a UOM row (replace row contents with inputs)
function startInlineEdit(rowId, rowData) {
  // prevent multiple editors
  if (editingRowId) return;
  editingRowId = rowId;
  const tr = table.querySelector(`tr[data-id="${rowId}"]`);
  if (!tr) return;
  // build dimension select options
  const dimOptions = Object.values(dimensions)
    .map(
      (d) =>
        `<option value="${d.id}" ${
          d.id === rowData.dimension_id ? "selected" : ""
        }>${d.name}</option>`
    )
    .join("");
  tr.innerHTML = `
    <td><input class="inline-input" id="edit_code_${rowId}" type="text" value="${rowData.code}" disabled /></td>
    <td><select id="edit_dim_${rowId}"><option value="">--</option>${dimOptions}</select></td>
    <td><select id="edit_base_${rowId}"><option value="true">True</option><option value="false">False</option></select></td>
    <td class="actions">
      <button class="primary" id="save_${rowId}">Save</button>
      <button class="ghost" id="cancel_${rowId}">Cancel</button>
    </td>
  `;
  // set base select value
  const baseSel = document.getElementById(`edit_base_${rowId}`);
  if (baseSel) baseSel.value = rowData.is_base ? "true" : "false";
  // wire actions
  document
    .getElementById(`save_${rowId}`)
    .addEventListener("click", async () => await saveInlineEdit(rowId));
  document.getElementById(`cancel_${rowId}`).addEventListener("click", () => {
    editingRowId = null;
    refresh();
  });
}

// Inline edit for dimensions
function startInlineEditDim(rowId, rowData) {
  const tr = dimTable
    .closest("table")
    .querySelector(
      `tbody tr:nth-child(${
        Array.from(dimTable.children).findIndex(
          (r) => Number(r.querySelector(".btnEditDim")?.dataset.id) === rowId
        ) + 1
      })`
    );
  // fallback: find by data-id if present
  let targetTr = Array.from(dimTable.querySelectorAll("tr")).find(
    (r) => Number(r.querySelector(".btnEditDim")?.dataset.id) === rowId
  );
  if (!targetTr) targetTr = tr;
  if (!targetTr) return;
  targetTr.innerHTML = `
    <td>${rowId}</td>
    <td><input id="edit_dim_name_${rowId}" type="text" value="${
    rowData.name
  }" /></td>
    <td><input id="edit_dim_notes_${rowId}" type="text" value="${
    rowData.notes ?? ""
  }" /></td>
    <td class="actions">
      <button class="primary" id="save_dim_${rowId}">Save</button>
      <button class="ghost" id="cancel_dim_${rowId}">Cancel</button>
    </td>
  `;
  document
    .getElementById(`save_dim_${rowId}`)
    .addEventListener("click", async () => await saveInlineEditDim(rowId));
  document
    .getElementById(`cancel_dim_${rowId}`)
    .addEventListener("click", async () => {
      await refresh();
    });
}

async function saveInlineEditDim(rowId) {
  const nameEl = document.getElementById(`edit_dim_name_${rowId}`);
  const notesElLocal = document.getElementById(`edit_dim_notes_${rowId}`);
  const payload = {
    name: (nameEl.value || "").trim(),
    notes: (notesElLocal.value || "").trim(),
  };
  if (!payload.name) return toast("Name required", "error");
  const { error } = await supabase
    .from("inv_uom_dimension")
    .update(payload)
    .eq("id", rowId);
  if (error) return toast(error.message, "error");
  toast("Saved", "success");
  await refresh();
}

async function saveInlineEdit(rowId) {
  // const codeInput = document.getElementById(`edit_code_${rowId}`);
  const dimSel = document.getElementById(`edit_dim_${rowId}`);
  const baseSel = document.getElementById(`edit_base_${rowId}`);
  const payload = {
    dimension_id: dimSel.value ? Number(dimSel.value) : null,
    is_base: baseSel.value === "true",
  };
  const { error } = await supabase
    .from("inv_uom")
    .update(payload)
    .eq("id", rowId);
  if (error) return toast(error.message, "error");
  toast("Saved", "success");
  editingRowId = null;
  await refresh();
}

function openEditor(mode, row = null) {
  editor.style.display = "block";
  editor.scrollIntoView({ behavior: "smooth", block: "start" });
  if (mode === "new") {
    editorTitle.textContent = "New UOM";
    idEl.value = "";
    codeEl.value = "";
    populateDimensionSelect();
    dimensionEl.value = "";
    notesEl.value = "";
    isBaseEl.value = "true";
    codeEl.disabled = false; // code is editable on create
  } else {
    editorTitle.textContent = `Edit UOM: ${row.code}`;
    idEl.value = row.id;
    codeEl.value = row.code;
    populateDimensionSelect();
    dimensionEl.value = row.dimension_id ?? "";
    notesEl.value = row.notes ?? "";
    isBaseEl.value = row.is_base ? "true" : "false";
    codeEl.disabled = true; // keep code immutable after create
  }
}

function closeEditor() {
  editor.style.display = "none";
}

async function onEdit(e) {
  const id = Number(e.currentTarget.dataset.id);
  const { data, error } = await supabase
    .from("inv_uom")
    .select("id, code, dimension_id, is_base, notes")
    .eq("id", id)
    .single();
  if (error) return toast("Failed to load UOM", "error");
  // use inline edit instead of drawer
  startInlineEdit(id, data);
}

async function renderDimensions() {
  const dims = await fetchDimensions();
  dimTable.innerHTML = "";
  dims.forEach((d) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${d.id}</td>
      <td>${d.name}</td>
      <td>${d.notes ?? ""}</td>
      <td class="actions">
        <button data-id="${d.id}" class="icon ghost btnEditDim" title="Edit">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1.003 1.003 0 0 0 0-1.42l-2.34-2.34a1.003 1.003 0 0 0-1.42 0l-1.83 1.83 3.75 3.75 1.84-1.82z" fill="currentColor"/></svg>
        </button>
        <button data-id="${
          d.id
        }" class="icon ghost btnDeleteDim" title="Delete">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M6 19c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" fill="currentColor"/></svg>
        </button>
      </td>
    `;
    dimTable.appendChild(tr);
  });
  // bind edit and delete handlers (edit will use inline row editing)
  dimTable.querySelectorAll(".btnEditDim").forEach((b) =>
    b.addEventListener("click", async (ev) => {
      const id = Number(ev.currentTarget.dataset.id);
      const current = dimensions[id];
      if (!current) return toast("Dimension not found", "error");
      startInlineEditDim(id, current);
    })
  );
  dimTable.querySelectorAll(".btnDeleteDim").forEach((b) =>
    b.addEventListener("click", async (ev) => {
      const id = Number(ev.currentTarget.dataset.id);
      const ok = await confirmDialog(
        "Delete dimension? This fails if any UOM references it."
      );
      if (!ok) return;
      const { error } = await supabase
        .from("inv_uom_dimension")
        .delete()
        .eq("id", id);
      if (error) return toast(error.message, "error");
      toast("Deleted", "success");
      await refresh();
    })
  );
}

async function addDimension() {
  const name = (dimName.value || "").trim();
  const notes = (dimNotes.value || "").trim();
  if (!name) return toast("Name required", "error");
  const { error } = await supabase
    .from("inv_uom_dimension")
    .insert({ name, notes });
  if (error) return toast(error.message, "error");
  dimName.value = "";
  dimNotes.value = "";
  toast("Dimension created", "success");
  await refresh();
}

// Tab switching
function showUoms() {
  dimsPanel.style.display = "none";
  // ensure UOM toolbar and table visible
  const uomToolbar = document.getElementById("uomToolbar");
  if (uomToolbar) uomToolbar.style.display = "flex";
  if (uomTableEl) uomTableEl.style.display = "table";
  // tabs active state
  tabUoms.classList.add("active");
  tabDims.classList.remove("active");
}
async function showDims() {
  dimsPanel.style.display = "block";
  // hide UOM toolbar and UOM table when viewing dimensions
  const uomToolbar = document.getElementById("uomToolbar");
  if (uomToolbar) uomToolbar.style.display = "none";
  if (uomTableEl) uomTableEl.style.display = "none";
  // also hide the editor drawer if open
  if (editor) editor.style.display = "none";
  tabDims.classList.add("active");
  tabUoms.classList.remove("active");
  // ensure dimensions are freshly loaded when opening the tab
  await renderDimensions();
}

// removed unused archive toggle - base flag is edited inline or in editor

async function onSave() {
  const payload = {
    code: codeEl.value.trim(),
    dimension_id: Number(dimensionEl.value) || null,
    notes: notesEl.value.trim(),
    is_base: isBaseEl.value === "true",
  };
  if (!payload.code) return toast("Code required", "error");

  // Upsert by code to keep it simple (RLS must permit)
  if (!idEl.value) {
    const { error } = await supabase.from("inv_uom").insert(payload);
    if (error) return toast(error.message, "error");
    toast("Created", "success");
  } else {
    const id = Number(idEl.value);
    // keep code immutable on edit
    const { error } = await supabase
      .from("inv_uom")
      .update({
        dimension_id: payload.dimension_id,
        notes: payload.notes,
        is_base: payload.is_base,
      })
      .eq("id", id);
    if (error) return toast(error.message, "error");
    toast("Saved", "success");
  }
  closeEditor();
  await refresh();
}

async function refresh() {
  // refresh dimensions first so UOMs can show names
  await fetchDimensions();
  const rows = await fetchUoms();
  render(rows);
  // if dimensions panel visible, refresh it
  if (dimsPanel.style.display !== "none") await renderDimensions();
}

btnAdd.addEventListener("click", () => openEditor("new"));
btnSave.addEventListener("click", onSave);
btnCancel.addEventListener("click", closeEditor);

// tabs and dimension actions
tabUoms.addEventListener("click", showUoms);
tabDims.addEventListener("click", showDims);
btnAddDim.addEventListener("click", addDimension);

// boot
(async () => {
  await initAuth();
  await refresh();
  showUoms();
})();
