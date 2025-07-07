// ES module using Supabase
import { supabase } from './supabaseClient.js';

// DOM refs
const addNewBtn      = document.getElementById('addNewBtn');
const homeIcon       = document.getElementById('homeIcon');
const searchInput    = document.getElementById('searchInput');
const productList    = document.getElementById('productList');

const form           = document.getElementById('productForm');
const itemInput      = document.getElementById('itemInput');
const malInput       = document.getElementById('malInput');
const statusSelect   = document.getElementById('statusSelect');
const categorySelect   = document.getElementById('categorySelect');
const subcategorySelect= document.getElementById('subcategorySelect');
const groupSelect      = document.getElementById('groupSelect');
const subgroupSelect   = document.getElementById('subgroupSelect');
const deleteBtn      = document.getElementById('deleteBtn');

const modalOverlay   = document.getElementById('modalOverlay');
const modalMessage   = document.getElementById('modalMessage');
const modalConfirm   = document.getElementById('modalConfirm');
const modalCancel    = document.getElementById('modalCancel');

let allProducts = [];
let filtered    = [];
let selectedId  = null;
let unsaved     = false;

// In-page modal
function showModal(message, okText = 'OK', cancelText = 'Cancel') {
  return new Promise(resolve => {
    modalMessage.textContent = message;
    modalConfirm.textContent = okText;
    modalCancel.textContent  = cancelText;
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

// Load categories
async function loadClassifications() {
  // Categories
  const { data:cats, error:catErr } = await supabase
    .from('categories')
    .select('id, category_name')
    .order('category_name', { ascending: true });
  if (catErr) return console.error(catErr);

  categorySelect.innerHTML = '<option value="">-- Select --</option>';
  cats.forEach(c => categorySelect.add(new Option(c.category_name, c.id)));

  // Cascading listeners
  categorySelect.addEventListener('change', () => loadSubcats(categorySelect.value));
  subcategorySelect.addEventListener('change', () => loadGroups(subcategorySelect.value));
  groupSelect.addEventListener('change', () => loadSubgroups(groupSelect.value));
}

async function loadSubcats(catId) {
  subcategorySelect.innerHTML = '<option value="">-- Select --</option>';
  groupSelect.innerHTML       = '<option value="">-- Select --</option>';
  subgroupSelect.innerHTML    = '<option value="">-- Select --</option>';
  if (!catId) return;

  const { data:subs, error } = await supabase
    .from('sub_categories')
    .select('id, subcategory_name')
    .eq('category_id', catId)
    .order('subcategory_name', { ascending: true });
  if (error) return console.error(error);

  subs.forEach(s => subcategorySelect.add(new Option(s.subcategory_name, s.id)));
}

async function loadGroups(subId) {
  groupSelect.innerHTML     = '<option value="">-- Select --</option>';
  subgroupSelect.innerHTML  = '<option value="">-- Select --</option>';
  if (!subId) return;

  const { data:grps, error } = await supabase
    .from('product_groups')
    .select('id, group_name')
    .eq('sub_category_id', subId)
    .order('group_name', { ascending: true });
  if (error) return console.error(error);

  grps.forEach(g => groupSelect.add(new Option(g.group_name, g.id)));
}

async function loadSubgroups(gId) {
  subgroupSelect.innerHTML = '<option value="">-- Select --</option>';
  if (!gId) return;

  const { data:sgs, error } = await supabase
    .from('sub_groups')
    .select('id, sub_group_name')
    .eq('product_group_id', gId)
    .order('sub_group_name', { ascending: true });
  if (error) return console.error(error);

  sgs.forEach(sg => subgroupSelect.add(new Option(sg.sub_group_name, sg.id)));
}

// Load & render product list
async function loadProducts() {
  const { data, error } = await supabase
    .from('products')
    .select('id, item')
    .order('item', { ascending: true });
  if (error) return console.error(error);

  allProducts = data;
  applyFilter();
}

function applyFilter() {
  const term = searchInput.value.trim().toLowerCase();
  filtered = allProducts.filter(p => p.item.toLowerCase().includes(term));
  productList.innerHTML = filtered.map(p =>
    `<li data-id="${p.id}"${p.id===selectedId?' class="selected"':''}>${p.item}</li>`
  ).join('');
}

// Load form details (or blank for new)
async function loadDetails(id) {
  if (unsaved) {
    const discard = await showModal('You have unsaved changes. Discard?','Discard','Cancel');
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

  // Fetch product
  const { data: prod, error: pErr } = await supabase
    .from('products')
    .select('item, malayalam_name, status, sub_group_id')
    .eq('id', id)
    .single();
  if (pErr) return console.error(pErr);

  itemInput.value     = prod.item;
  malInput.value      = prod.malayalam_name;
  statusSelect.value  = prod.status;

  const sgId = prod.sub_group_id;

  // Trace back to category
  const { data: sgRow, error: e1 } = await supabase
    .from('sub_groups')
    .select('product_group_id')
    .eq('id', sgId)
    .single();
  if (e1) return console.error(e1);

  const pgId = sgRow.product_group_id;
  const { data: pgRow, error: e2 } = await supabase
    .from('product_groups')
    .select('sub_category_id')
    .eq('id', pgId)
    .single();
  if (e2) return console.error(e2);

  const scId = pgRow.sub_category_id;
  const { data: scRow, error: e3 } = await supabase
    .from('sub_categories')
    .select('category_id')
    .eq('id', scId)
    .single();
  if (e3) return console.error(e3);

  // Cascade selects
  categorySelect.value    = scRow.category_id;
  await loadSubcats(categorySelect.value);
  subcategorySelect.value = scId;
  await loadGroups(subcategorySelect.value);
  groupSelect.value       = pgId;
  await loadSubgroups(groupSelect.value);
  subgroupSelect.value    = sgId;

  deleteBtn.disabled = false;
  unsaved = false;
}

// Save (insert or update)
form.addEventListener('submit', async e => {
  e.preventDefault();

  const vals = {
    item: itemInput.value.trim(),
    mal:  malInput.value.trim(),
    stat: statusSelect.value,
    sg:   subgroupSelect.value
  };
  if (!vals.item || !vals.mal || !vals.stat || !vals.sg) {
    return showModal('Please fill in all fields.', 'OK','');
  }

  // Preview
  const names = [
    categorySelect.selectedOptions[0].text,
    subcategorySelect.selectedOptions[0].text,
    groupSelect.selectedOptions[0].text,
    subgroupSelect.selectedOptions[0].text
  ];
  const preview = [
    `Save this product?`, ``,
    `• Item:           ${vals.item}`,
    `• Malayalam name: ${vals.mal}`,
    `• Status:         ${vals.stat}`,
    `• Category:       ${names[0]}`,
    `• Sub-category:   ${names[1]}`,
    `• Group:          ${names[2]}`,
    `• Sub-group:      ${names[3]}`
  ].join('\n');

  if (!(await showModal(preview, 'Save','Cancel'))) return;

  if (selectedId) {
    const { error } = await supabase
      .from('products')
      .update({
        sub_group_id:    vals.sg,
        item:            vals.item,
        malayalam_name:  vals.mal,
        status:          vals.stat
      })
      .eq('id', selectedId);
    if (error) return console.error(error);
  } else {
    const { error } = await supabase
      .from('products')
      .insert([{
        sub_group_id:    vals.sg,
        item:            vals.item,
        malayalam_name:  vals.mal,
        status:          vals.stat
      }]);
    if (error) return console.error(error);
  }

  await loadProducts();
  loadDetails(null);
});

// Delete
deleteBtn.addEventListener('click', async () => {
  if (!selectedId) return;
  if (!(await showModal('Delete this product?', 'Delete','Cancel'))) return;

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

// Sidebar click
productList.addEventListener('click', e => {
  const li = e.target.closest('li');
  if (!li) return;
  loadDetails(Number(li.dataset.id));
});

// Search filter
searchInput.addEventListener('input', applyFilter);

// Track unsaved
[
  itemInput, malInput, statusSelect,
  categorySelect, subcategorySelect,
  groupSelect, subgroupSelect
].forEach(el => el.addEventListener('input', () => unsaved = true));

// Home navigation
homeIcon.addEventListener('click', async () => {
  if (unsaved) {
    if (!(await showModal('You have unsaved changes. Leave anyway?','Yes','No')))
      return;
  }
  window.location.href = 'index.html';
});

// Init
window.addEventListener('DOMContentLoaded', async () => {
  await loadClassifications();
  await loadProducts();
  loadDetails(null);
});