// subcategories.js
import { supabase } from '../shared/js/supabaseClient.js';

const catSelect     = document.getElementById('categorySelect');
const addForm       = document.getElementById('addSubForm');
const subTableBody  = document.querySelector('#subTable tbody');
const homeIcon      = document.getElementById('homeIcon');

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
    return;
  }

  data.forEach(r => {
    const tr = document.createElement('tr');
    tr.dataset.id = r.id;
    tr.innerHTML = `
      <td class="name-cell">${r.subcategory_name}</td>
      <td>
        <button class="action-link edit-btn">Edit</button> |
        <button class="action-link delete-btn">Delete</button>
      </td>
    `;
    subTableBody.appendChild(tr);
  });
}

// Init
window.addEventListener('DOMContentLoaded', async () => {
  await loadCategories();
});

// Category changed
catSelect.addEventListener('change', renderSubcategories);

// Add new sub-category
addForm.addEventListener('submit', async e => {
  e.preventDefault();
  const name  = addForm.subcategory_name.value.trim();
  const catId = catSelect.value;
  if (!catId || !name) return;

  if (!await showConfirm(`Add "${name}" to selected category?`)) return;

  const { error } = await supabase
    .from('sub_categories')
    .insert([{ category_id: catId, subcategory_name: name }]);
  if (error) console.error('Insert error:', error);

  addForm.subcategory_name.value = '';
  renderSubcategories();
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
    await supabase
      .from('sub_categories')
      .delete()
      .eq('id', id);
    renderSubcategories();
    return;
  }

  // EDIT → inline input + Save/Cancel
  if (btn.classList.contains('edit-btn')) {
    currentEditId   = id;
    currentOldName = oldName;
    nameTd.innerHTML = `<input type="text" class="edit-input" value="${oldName}"/>`;
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
    await supabase
      .from('sub_categories')
      .update({ subcategory_name: newName })
      .eq('id', currentEditId);
    renderSubcategories();
    return;
  }

  // CANCEL
  if (btn.classList.contains('cancel-btn')) {
    renderSubcategories();
    return;
  }
});

// Home navigation
homeIcon.onclick = () => {
  window.location.href = 'index.html';
};