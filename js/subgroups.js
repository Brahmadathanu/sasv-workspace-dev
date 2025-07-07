// subgroups.js
import { supabase } from './supabaseClient.js';

const categorySelect    = document.getElementById('categorySelect');
const subcategorySelect = document.getElementById('subcategorySelect');
const groupSelect       = document.getElementById('groupSelect');
const tableBody         = document.getElementById('subGroupTable');
const addForm           = document.getElementById('addSubGroupForm');
const clearFilters      = document.getElementById('clearFilters');
const homeIcon          = document.getElementById('homeIcon');

const confirmOverlay    = document.getElementById('confirmOverlay');
const confirmMessage    = document.getElementById('confirmMessage');
const confirmYes        = document.getElementById('confirmYes');
const confirmNo         = document.getElementById('confirmNo');

// In-page confirm modal
function showConfirm(msg) {
  return new Promise(resolve => {
    confirmMessage.textContent = msg;
    confirmOverlay.style.display = 'flex';
    confirmYes.focus();
    function cleanup(ans) {
      confirmOverlay.style.display = 'none';
      confirmYes.removeEventListener('click', onYes);
      confirmNo .removeEventListener('click', onNo);
      resolve(ans);
    }
    function onYes() { cleanup(true); }
    function onNo()  { cleanup(false); }
    confirmYes.addEventListener('click', onYes);
    confirmNo .addEventListener('click', onNo);
  });
}

// Load categories
async function loadCategories() {
  const { data, error } = await supabase
    .from('categories')
    .select('id, category_name')
    .order('category_name');
  if (error) return console.error(error);
  categorySelect.innerHTML = '<option value="">-- Category --</option>';
  data.forEach(c => {
    const o = document.createElement('option');
    o.value = c.id;
    o.textContent = c.category_name;
    categorySelect.appendChild(o);
  });
}

// Load sub-categories
async function loadSubcategories(catId) {
  subcategorySelect.innerHTML = '<option value="">-- Sub-category --</option>';
  subcategorySelect.disabled = !catId;
  groupSelect.innerHTML      = '<option value="">-- Product Group --</option>';
  groupSelect.disabled       = true;
  tableBody.innerHTML        = '';
  if (!catId) return;
  const { data, error } = await supabase
    .from('sub_categories')
    .select('id, subcategory_name')
    .eq('category_id', catId)
    .order('subcategory_name');
  if (error) return console.error(error);
  data.forEach(sc => {
    const o = document.createElement('option');
    o.value = sc.id;
    o.textContent = sc.subcategory_name;
    subcategorySelect.appendChild(o);
  });
}

// Load product groups
async function loadGroups(subCatId) {
  groupSelect.innerHTML = '<option value="">-- Product Group --</option>';
  groupSelect.disabled  = !subCatId;
  tableBody.innerHTML   = '';
  if (!subCatId) return;
  const { data, error } = await supabase
    .from('product_groups')
    .select('id, group_name')
    .eq('sub_category_id', subCatId)
    .order('group_name');
  if (error) return console.error(error);
  data.forEach(g => {
    const o = document.createElement('option');
    o.value = g.id;
    o.textContent = g.group_name;
    groupSelect.appendChild(o);
  });
}

// Render sub-groups with inline edit
async function renderSubGroups(groupId) {
  tableBody.innerHTML = '';
  if (!groupId) return;
  const { data, error } = await supabase
    .from('sub_groups')
    .select('id, sub_group_name')
    .eq('product_group_id', groupId)
    .order('sub_group_name');
  if (error) return console.error(error);
  data.forEach(r => {
    const tr = document.createElement('tr');
    tr.dataset.id = r.id;
    tr.innerHTML = `
      <td class="name-cell">${r.sub_group_name}</td>
      <td class="actions-cell">
        <button class="action-link edit-btn">Edit</button> |
        <button class="action-link delete-btn">Delete</button>
      </td>`;
    tableBody.appendChild(tr);
  });
}

// Clear filters
clearFilters.addEventListener('click', () => {
  categorySelect.value = '';
  subcategorySelect.value = '';
  groupSelect.value = '';
  loadSubcategories('');
  loadGroups('');
});

// Add new sub-group
addForm.addEventListener('submit', async e => {
  e.preventDefault();
  const name    = addForm.sub_group_name.value.trim();
  const groupId = groupSelect.value;
  if (!groupId || !name) return;
  if (!await showConfirm(`Add "${name}" to this group?`)) return;
  await supabase
    .from('sub_groups')
    .insert([{ product_group_id: groupId, sub_group_name: name }]);
  addForm.reset();
  renderSubGroups(groupId);
});

// Inline Edit/Delete/Save/Cancel
tableBody.addEventListener('click', async e => {
  const btn = e.target;
  const tr  = btn.closest('tr');
  if (!tr) return;
  const id  = tr.dataset.id;
  const nameCell = tr.querySelector('.name-cell');
  const actionsCell = tr.querySelector('.actions-cell');
  const oldName = nameCell.textContent;

  // Delete
  if (btn.classList.contains('delete-btn')) {
    if (!await showConfirm(`Delete "${oldName}"?`)) return;
    await supabase.from('sub_groups').delete().eq('id', id);
    renderSubGroups(groupSelect.value);
    return;
  }

  // Edit: turn into input + Save/Cancel
  if (btn.classList.contains('edit-btn')) {
    nameCell.innerHTML = `<input type="text" class="edit-input" value="${oldName}" />`;
    const inp = nameCell.querySelector('.edit-input');
    inp.select();
    actionsCell.innerHTML = `
      <button class="action-link save-btn">Save</button> |
      <button class="action-link cancel-btn">Cancel</button>`;
    return;
  }

  // Save edited name
  if (btn.classList.contains('save-btn')) {
    const newName = tr.querySelector('.edit-input').value.trim();
    if (!newName) {
      tr.querySelector('.edit-input').focus();
      return;
    }
    if (!await showConfirm(`Change "${oldName}" → "${newName}"?`)) {
      renderSubGroups(groupSelect.value);
      return;
    }
    await supabase
      .from('sub_groups')
      .update({ sub_group_name: newName })
      .eq('id', id);
    renderSubGroups(groupSelect.value);
    return;
  }

  // Cancel edit
  if (btn.classList.contains('cancel-btn')) {
    renderSubGroups(groupSelect.value);
    return;
  }
});

// Filter event wiring
categorySelect.addEventListener('change', () => loadSubcategories(categorySelect.value));
subcategorySelect.addEventListener('change', () => loadGroups(subcategorySelect.value));
groupSelect.addEventListener('change', () => renderSubGroups(groupSelect.value));

// Home navigation
homeIcon.addEventListener('click', () => window.location.href = 'index.html');

// Initialize
window.addEventListener('DOMContentLoaded', loadCategories);