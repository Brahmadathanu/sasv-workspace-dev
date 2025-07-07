// js/products.js
import { supabase } from './supabaseClient.js';

// DOM refs
const addNewBtn        = document.getElementById('addNewBtn');
const homeBtn          = document.getElementById('homeBtn');
const searchInput      = document.getElementById('searchInput');
const productList      = document.getElementById('productList');
const form             = document.getElementById('productForm');
const itemInput        = document.getElementById('itemInput');
const malInput         = document.getElementById('malInput');
const statusSelect     = document.getElementById('statusSelect');
const categorySelect   = document.getElementById('categorySelect');
const subcategorySelect= document.getElementById('subcategorySelect');
const groupSelect      = document.getElementById('groupSelect');
const subgroupSelect   = document.getElementById('subgroupSelect');
const deleteBtn        = document.getElementById('deleteBtn');
const modalOverlay     = document.getElementById('modalOverlay');
const modalMessage     = document.getElementById('modalMessage');
const modalConfirm     = document.getElementById('modalConfirm');
const modalCancel      = document.getElementById('modalCancel');

let allProducts = [];
let filtered    = [];
let selectedId  = null;
let unsaved     = false;

/*
 * Prevent focus loss when pressing Ctrl + [number row keys]
 * Only intercept when an input/select/textarea is focused.
 * If it's Ctrl+Digit5, also re-focus the itemInput.
 */
window.addEventListener('keydown', e => {
  const active = document.activeElement;
  const inField = active && ['INPUT','SELECT','TEXTAREA'].includes(active.tagName);
  if (inField && e.ctrlKey && e.code.startsWith('Digit')) {
    e.preventDefault();
    if (e.code === 'Digit5') {
      itemInput.focus();
    }
  }
}, true);

// Modal helper
function showModal(message, okText = 'OK', cancelText = 'Cancel') {
  return new Promise(resolve => {
    modalMessage.textContent   = message;
    modalConfirm.textContent   = okText;
    modalCancel.textContent    = cancelText;
    modalOverlay.style.display = 'flex';

    function cleanup() {
      modalConfirm.removeEventListener('click', onOk);
      modalCancel.removeEventListener('click', onCancel);
      modalOverlay.style.display = 'none';
    }
    function onOk()    { cleanup(); resolve(true); }
    function onCancel(){ cleanup(); resolve(false); }

    modalConfirm.addEventListener('click', onOk);
    modalCancel .addEventListener('click', onCancel);
  });
}

// Load classification dropdowns
async function loadClassifications() {
  const { data: cats, error: catErr } = await supabase
    .from('categories')
    .select('id, category_name')
    .order('category_name');
  if (catErr) return console.error(catErr);

  categorySelect.innerHTML = '<option value="">-- Select --</option>';
  cats.forEach(c => categorySelect.add(new Option(c.category_name, c.id)));

  categorySelect.addEventListener('change', () => loadSubcats(categorySelect.value));
  subcategorySelect.addEventListener('change', () => loadGroups(subcategorySelect.value));
  groupSelect.addEventListener('change', () => loadSubgroups(groupSelect.value));
}

async function loadSubcats(catId) {
  subcategorySelect.innerHTML = '<option value="">-- Select --</option>';
  groupSelect.innerHTML       = '<option value="">-- Select --</option>';
  subgroupSelect.innerHTML    = '<option value="">-- Select --</option>';
  if (!catId) return;

  const { data, error } = await supabase
    .from('sub_categories')
    .select('id, subcategory_name')
    .eq('category_id', catId)
    .order('subcategory_name');
  if (error) return console.error(error);
  data.forEach(s => subcategorySelect.add(new Option(s.subcategory_name, s.id)));
}

async function loadGroups(subId) {
  groupSelect.innerHTML     = '<option value="">-- Select --</option>';
  subgroupSelect.innerHTML  = '<option value="">-- Select --</option>';
  if (!subId) return;

  const { data, error } = await supabase
    .from('product_groups')
    .select('id, group_name')
    .eq('sub_category_id', subId)
    .order('group_name');
  if (error) return console.error(error);
  data.forEach(g => groupSelect.add(new Option(g.group_name, g.id)));
}

async function loadSubgroups(gId) {
  subgroupSelect.innerHTML = '<option value="">-- Select --</option>';
  if (!gId) return;

  const { data, error } = await supabase
    .from('sub_groups')
    .select('id, sub_group_name')
    .eq('product_group_id', gId)
    .order('sub_group_name');
  if (error) return console.error(error);
  data.forEach(sg => subgroupSelect.add(new Option(sg.sub_group_name, sg.id)));
}

// Load & render products
async function loadProducts() {
  const { data, error } = await supabase
    .from('products')
    .select('id, item')
    .order('item');
  if (error) return console.error(error);
  allProducts = data;
  applyFilter();
}

function applyFilter() {
  const term = searchInput.value.trim().toLowerCase();
  filtered = allProducts.filter(p => p.item.toLowerCase().includes(term));
  productList.innerHTML = filtered.map(p =>
    `<li data-id="${p.id}"${p.id === selectedId ? ' class="selected"' : ''}>${p.item}</li>`
  ).join('');
}

// Load details or reset form
async function loadDetails(id) {
  if (unsaved) {
    const discard = await showModal('You have unsaved changes. Discard?', 'Discard', 'Cancel');
    if (!discard) return;
  }

  selectedId = id;
  applyFilter();

  if (!id) {
    form.reset();
    deleteBtn.disabled = true;
    unsaved = false;
    itemInput.focus();
    return;
  }

  const { data: prod, error: pErr } = await supabase
    .from('products')
    .select('item, malayalam_name, status, sub_group_id')
    .eq('id', id)
    .single();
  if (pErr) return console.error(pErr);

  itemInput.value    = prod.item;
  malInput.value     = prod.malayalam_name;
  statusSelect.value = prod.status;

  // Cascade back up to category
  const { data: sgRow } = await supabase
    .from('sub_groups')
    .select('product_group_id')
    .eq('id', prod.sub_group_id)
    .single();
  const pgId = sgRow.product_group_id;

  const { data: pgRow } = await supabase
    .from('product_groups')
    .select('sub_category_id')
    .eq('id', pgId)
    .single();
  const scId = pgRow.sub_category_id;

  const { data: scRow } = await supabase
    .from('sub_categories')
    .select('category_id')
    .eq('id', scId)
    .single();

  categorySelect.value    = scRow.category_id;
  await loadSubcats(categorySelect.value);

  subcategorySelect.value = scId;
  await loadGroups(subcategorySelect.value);

  groupSelect.value       = pgId;
  await loadSubgroups(groupSelect.value);

  subgroupSelect.value    = prod.sub_group_id;

  deleteBtn.disabled = false;
  unsaved = false;
}

// Save or insert
form.addEventListener('submit', async e => {
  e.preventDefault();

  const newItem = itemInput.value.trim();
  const newMal  = malInput.value.trim();
  const newStat = statusSelect.value;
  const newSg   = subgroupSelect.value;

  // Duplicate-check on new insertion
  if (!selectedId) {
    const dup = allProducts.find(p => p.item.toLowerCase() === newItem.toLowerCase());
    if (dup) {
      const edit = await showModal(
        `Product "${newItem}" already exists.\nEdit instead?`,
        'Yes',
        'Cancel'
      );
      if (edit) {
        unsaved = false;          // clear flag so no prompt
        return loadDetails(dup.id);
      } else {
        form.reset();
        unsaved = false;
        return;
      }
    }
  }

  if (!newItem || !newMal || !newStat || !newSg) {
    return showModal('Please fill in all fields.', 'OK', '');
  }

  // Preview dialog
  const names = [
    categorySelect.selectedOptions[0].text,
    subcategorySelect.selectedOptions[0].text,
    groupSelect.selectedOptions[0].text,
    subgroupSelect.selectedOptions[0].text
  ];
  const preview = [
    `Save this product?`, ``,
    `• Item:           ${newItem}`,
    `• Malayalam name: ${newMal}`,
    `• Status:         ${newStat}`,
    `• Category:       ${names[0]}`,
    `• Sub-category:   ${names[1]}`,
    `• Group:          ${names[2]}`,
    `• Sub-group:      ${names[3]}`
  ].join('\n');

  if (!(await showModal(preview, 'Save', 'Cancel'))) return;

  unsaved = false; // clear before actual save

  if (selectedId) {
    const { error } = await supabase
      .from('products')
      .update({
        sub_group_id:   newSg,
        item:           newItem,
        malayalam_name: newMal,
        status:         newStat
      })
      .eq('id', selectedId);
    if (error) return console.error(error);
  } else {
    const { error } = await supabase
      .from('products')
      .insert([{
        sub_group_id:   newSg,
        item:           newItem,
        malayalam_name: newMal,
        status:         newStat
      }]);
    if (error) return console.error(error);
  }

  await loadProducts();
  loadDetails(null); // clear form after save
});

// Delete handler
deleteBtn.addEventListener('click', async () => {
  if (!selectedId) return;
  if (!(await showModal('Delete this product?', 'Delete', 'Cancel'))) return;
  const { error } = await supabase
    .from('products')
    .delete()
    .eq('id', selectedId);
  if (error) return console.error(error);
  await loadProducts();
  loadDetails(null);
});

// New product
addNewBtn.addEventListener('click', () => loadDetails(null));

// Sidebar selection
productList.addEventListener('click', e => {
  const li = e.target.closest('li');
  if (!li) return;
  loadDetails(Number(li.dataset.id));
});

// Live search
searchInput.addEventListener('input', applyFilter);

// Track unsaved changes
[
  itemInput, malInput, statusSelect,
  categorySelect, subcategorySelect,
  groupSelect, subgroupSelect
].forEach(el => el.addEventListener('input', () => unsaved = true));

// Home navigation
homeBtn.addEventListener('click', async () => {
  if (unsaved) {
    if (!(await showModal('You have unsaved changes. Leave anyway?', 'Yes', 'No')))
      return;
  }
  window.location.href = 'index.html';
});

// Initialize
window.addEventListener('DOMContentLoaded', async () => {
  await loadClassifications();
  await loadProducts();
  loadDetails(null);
});