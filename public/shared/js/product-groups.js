import { supabase } from './supabaseClient.js';
import { startClassificationModule, setClassificationStatus } from './classification-master-shell.js?v=399a51b69e';
import { escapeClassificationHtml } from './classification-html-escape.js';

const categorySelect    = document.getElementById('categorySelect');
const subcategorySelect = document.getElementById('subcategorySelect');
const groupTableBody    = document.querySelector('#groupTable tbody');
const clearFiltersBtn   = document.getElementById('clearFilters');
const newGroupInput     = document.getElementById('newGroupInput');
const newGroupKind      = document.getElementById('newGroupKind');
const addBtn            = document.getElementById('addBtn');
const clearNewBtn       = document.getElementById('clearNew');
const confirmOverlay    = document.getElementById('confirmOverlay');
const confirmMsg        = document.getElementById('confirmMsg');
const confirmYes        = document.getElementById('confirmYes');
const confirmNo         = document.getElementById('confirmNo');

async function loadGroupKinds() {
  const { data, error } = await supabase.from('product_group_kinds').select('id, group_name, code').order('group_name');
  if (error) { console.error(error); setClassificationStatus('error', 'Unable to load product group kinds. Reload the page to try again.'); return; }
  populate(newGroupKind, data, 'id', 'group_name', 'Select group kind');
}

let pendingAction = null;  // { type:'add'|'delete'|'update', id?, name? }

/** Utility to populate a <select> */
function populate(sel, items, valKey, txtKey, placeholder) {
  sel.innerHTML = `<option value="">${placeholder}</option>`;
  items.forEach(i => {
    const o = document.createElement('option');
    o.value = i[valKey];
    o.textContent = i[txtKey];
    sel.appendChild(o);
  });
}

/** 1. Load categories */
async function loadCategories() {
  const { data, error } = await supabase
    .from('categories')
    .select('id, category_name')
    .order('category_name', { ascending: true });
  if (error) { console.error(error); setClassificationStatus('error', 'Unable to load categories. Reload the page to try again.'); return; }
  populate(categorySelect, data, 'id', 'category_name', 'Category');
}

/** 2. Load sub-categories when a category is selected */
async function loadSubcategories(catId) {
  if (!catId) {
    subcategorySelect.disabled = true;
    populate(subcategorySelect, [], 'id', 'subcategory_name', 'Sub-category');
    return;
  }
  const { data, error } = await supabase
    .from('sub_categories')
    .select('id, subcategory_name')
    .eq('category_id', catId)
    .order('subcategory_name', { ascending: true });
  if (error) { console.error(error); setClassificationStatus('error', 'Unable to load sub-categories. Reload the page to try again.'); return; }
  populate(subcategorySelect, data, 'id', 'subcategory_name', 'Sub-category');
  subcategorySelect.disabled = false;
}

/** 3. Render the product groups table */
async function renderGroups() {
  const subId = subcategorySelect.value;
  groupTableBody.innerHTML = '';
  if (!subId) return;

  const { data, error } = await supabase
    .from('product_groups')
    .select('id, group_name')
    .eq('sub_category_id', subId)
    .order('group_name', { ascending: true });
  if (error) { console.error(error); setClassificationStatus('error', 'Unable to load product groups. Reload the page to try again.'); return; }
  if (data.length === 0) setClassificationStatus('empty', 'No product groups for this sub-category.');
  else setClassificationStatus('ready');

  data.forEach(r => {
    const tr = document.createElement('tr');
    tr.dataset.id = r.id;
    tr.innerHTML = `
      <td class="group-cell">${escapeClassificationHtml(r.group_name)}</td>
      <td>
        <button class="action-link edit-btn">Edit</button> |
        <button class="action-link delete-btn">Delete</button>
      </td>`;
    groupTableBody.appendChild(tr);
  });
}

/** 4. Clear category/subcategory filters */
clearFiltersBtn.addEventListener('click', () => {
  categorySelect.value = '';
  subcategorySelect.value = '';
  subcategorySelect.disabled = true;
  renderGroups();
});

/** 5. Cascade: when category changes, load its subcategories */
categorySelect.addEventListener('change', async () => {
  await loadSubcategories(categorySelect.value);
  renderGroups();
});
subcategorySelect.addEventListener('change', renderGroups);

/** 6. Add new product group: open confirm modal */
addBtn.addEventListener('click', () => {
  const name = newGroupInput.value.trim();
  if (!subcategorySelect.value || !name) return;
  const kindId = Number(newGroupKind.value);
  if (!Number.isInteger(kindId) || kindId <= 0) { window.alert('Select a product group kind'); newGroupKind.focus(); return; }
  pendingAction = { type:'add', name, kindId, subcategoryId: Number(subcategorySelect.value) };
  confirmMsg.textContent = `Add Product Group "${name}"?`;
  confirmOverlay.style.display = 'flex';
});

/** 7. Clear the add-input field */
clearNewBtn.addEventListener('click', () => {
  newGroupInput.value = '';
});

/** 8. Delegate Edit/Delete actions in the table */
groupTableBody.addEventListener('click', e => {
  const btn = e.target;
  const tr  = btn.closest('tr');
  if (!tr) return;
  const id   = tr.dataset.id;
  const cell = tr.querySelector('.group-cell');
  const actionsTd = btn.closest('td');

  // EDIT → inline Save | Cancel only
  if (btn.classList.contains('edit-btn')) {
    const oldName = cell.textContent;
    cell.innerHTML = `<input type="text" class="edit-input" value="${escapeClassificationHtml(oldName)}">`;
    actionsTd.innerHTML = `
      <button class="action-link save-btn">Save</button> |
      <button class="action-link cancel-btn">Cancel</button>
    `;
    return;
  }

  // SAVE inline → confirm update
  if (btn.classList.contains('save-btn')) {
    const newName = tr.querySelector('.edit-input').value.trim();
    if (!newName) return;
    pendingAction = { type:'update', id, name:newName };
    confirmMsg.textContent = `Change to "${newName}"?`;
    confirmOverlay.style.display = 'flex';
    return;
  }

  // CANCEL inline → revert
  if (btn.classList.contains('cancel-btn')) {
    renderGroups();
    return;
  }

  // DELETE → confirm delete modal
  if (btn.classList.contains('delete-btn')) {
    const name = cell.textContent;
    pendingAction = { type:'delete', id, name };
    confirmMsg.textContent = `Delete "${name}"?`;
    confirmOverlay.style.display = 'flex';
    return;
  }
});

/** 9. Confirmation modal handlers */
confirmYes.addEventListener('click', async () => {
  confirmOverlay.style.display = 'none';
  const act = pendingAction;
  pendingAction = null;

  if (act.type === 'add') {
    const { error } = await supabase.rpc('rpc_wp10_create_product_group', { p_parent_id: act.subcategoryId, p_name: act.name, p_kind_id: act.kindId });
    if (error) { window.alert(`Could not create product group: ${error.message}`); return; }
    newGroupInput.value = '';
    newGroupKind.value = '';
  }
  if (act.type === 'delete') {
    const { error } = await supabase.rpc('rpc_wp10_delete_product_group', { p_id: Number(act.id) });
    if (error) { window.alert(`Could not delete product group: ${error.message}`); return; }
  }
  if (act.type === 'update') {
    const { error } = await supabase.rpc('rpc_wp10_rename_product_group', { p_id: Number(act.id), p_name: act.name });
    if (error) { window.alert(`Could not rename product group: ${error.message}`); return; }
  }

  renderGroups();
});
confirmNo.addEventListener('click', () => {
  pendingAction = null;
  confirmOverlay.style.display = 'none';
});

// Session gate + canonical View/Edit check run first; rows load only for a View-permitted user, and writer
// surfaces stay locked unless canonical module Edit is verified (see classification-master-shell.js).
startClassificationModule('module:manage-product-groups', async () => {
  await Promise.all([loadCategories(), loadGroupKinds()]);
  await renderGroups();
});
