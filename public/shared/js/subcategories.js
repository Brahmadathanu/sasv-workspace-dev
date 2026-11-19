// subcategories.js
import { supabase } from './supabaseClient.js';
import { startClassificationModule, setClassificationStatus } from './classification-master-shell.js?v=399a51b69e';
import { escapeClassificationHtml } from './classification-html-escape.js';

const catSelect     = document.getElementById('categorySelect');
const addForm       = document.getElementById('addSubForm');
const subTableBody  = document.querySelector('#subTable tbody');

const confirmOverlay = document.getElementById('confirmOverlay');
const confirmBox     = document.getElementById('confirmBox');
const confirmMsg     = document.getElementById('confirmMessage');
const confirmYesBtn  = document.getElementById('confirmYes');
const confirmNoBtn   = document.getElementById('confirmNo');

let currentEditId    = null;
let currentOldName  = '';

// Show in-page confirm modal
function showConfirm(message) {
  return new Promise(resolve => {
    confirmMsg.textContent = message;
    confirmOverlay.style.display = 'flex';
    confirmYesBtn.focus();

    function cleanup(answer) {
      confirmOverlay.style.display = 'none';
      confirmYesBtn.removeEventListener('click', onYes);
      confirmNoBtn.removeEventListener('click', onNo);
      resolve(answer);
    }
    function onYes() { cleanup(true); }
    function onNo()  { cleanup(false); }

    confirmYesBtn.addEventListener('click', onYes);
    confirmNoBtn.addEventListener('click', onNo);
  });
}

// Load categories
async function loadCategories() {
  const { data, error } = await supabase
    .from('categories')
    .select('id, category_name')
    .order('category_name', { ascending: true });
  if (error) {
    console.error('Error loading categories:', error);
    setClassificationStatus('error', 'Unable to load categories. Reload the page to try again.');
    return;
  }
  data.forEach(r => {
    const opt = document.createElement('option');
    opt.value = r.id;
    opt.textContent = r.category_name;
    catSelect.appendChild(opt);
  });
}

// Render subcategories
async function renderSubcategories() {
  subTableBody.innerHTML = '';
  const catId = catSelect.value;
  if (!catId) return;

  const { data, error } = await supabase
    .from('sub_categories')
    .select('id, subcategory_name')
    .eq('category_id', catId)
    .order('subcategory_name', { ascending: true });
  if (error) {
    console.error('Error loading sub-categories:', error);
    setClassificationStatus('error', 'Unable to load sub-categories. Reload the page to try again.');
    return;
  }
  if (data.length === 0) setClassificationStatus('empty', 'No sub-categories for this category.');
  else setClassificationStatus('ready');

  data.forEach(r => {
    const tr = document.createElement('tr');
    tr.dataset.id = r.id;
    tr.innerHTML = `
      <td class="name-cell">${escapeClassificationHtml(r.subcategory_name)}</td>
      <td>
        <button class="action-link edit-btn">Edit</button> |
        <button class="action-link delete-btn">Delete</button>
      </td>
    `;
    subTableBody.appendChild(tr);
  });
}

// Category changed
catSelect.addEventListener('change', renderSubcategories);

// Add new sub-category
addForm.addEventListener('submit', async e => {
  e.preventDefault();
  const name  = addForm.subcategory_name.value.trim();
  const catId = catSelect.value;
  if (!catId || !name) return;

  if (!await showConfirm(`Add "${name}" to selected category?`)) return;

  const { error } = await supabase.rpc('rpc_wp10_create_subcategory', { p_parent_id: Number(catId), p_name: name });
  if (error) { window.alert(`Could not add sub-category: ${error.message}`); return; }

  addForm.subcategory_name.value = '';
  await renderSubcategories();
});

// Table click (edit/save/cancel/delete)
subTableBody.addEventListener('click', async e => {
  const btn = e.target;
  const tr  = btn.closest('tr');
  if (!tr) return;

  const id      = tr.dataset.id;
  const nameTd  = tr.querySelector('.name-cell');
  const oldName = nameTd.textContent;

  // DELETE
  if (btn.classList.contains('delete-btn')) {
    if (!await showConfirm(`Delete "${oldName}"?`)) {
      renderSubcategories();
      return;
    }
    const { error } = await supabase.rpc('rpc_wp10_delete_subcategory', { p_id: Number(id) });
    if (error) { window.alert(`Could not delete sub-category: ${error.message}`); return; }
    await renderSubcategories();
    return;
  }

  // EDIT → inline input + Save/Cancel
  if (btn.classList.contains('edit-btn')) {
    currentEditId   = id;
    currentOldName = oldName;
    nameTd.innerHTML = `<input type="text" class="edit-input" value="${escapeClassificationHtml(oldName)}"/>`;
    nameTd.querySelector('.edit-input').select();
    tr.children[1].innerHTML = `
      <button class="action-link save-btn">Save</button> |
      <button class="action-link cancel-btn">Cancel</button>
    `;
    return;
  }

  // SAVE
  if (btn.classList.contains('save-btn')) {
    const newName = tr.querySelector('.edit-input').value.trim();
    if (!newName) {
      tr.querySelector('.edit-input').focus();
      return;
    }
    if (!await showConfirm(`Change "${currentOldName}" → "${newName}"?`)) {
      renderSubcategories();
      return;
    }
    const { error } = await supabase.rpc('rpc_wp10_rename_subcategory', { p_id: Number(currentEditId), p_name: newName });
    if (error) { window.alert(`Could not rename sub-category: ${error.message}`); return; }
    await renderSubcategories();
    return;
  }

  // CANCEL
  if (btn.classList.contains('cancel-btn')) {
    renderSubcategories();
    return;
  }
});

// Session gate + canonical View/Edit check run first; rows load only for a View-permitted user, and writer
// surfaces stay locked unless canonical module Edit is verified (see classification-master-shell.js).
startClassificationModule('module:manage-subcategories', loadCategories);
