// js/products.js
import { supabase } from '../public/shared/js/supabaseClient.js';

// DOM refs
const addNewBtn         = document.getElementById('addNewBtn');
const homeBtn           = document.getElementById('homeBtn');
const searchInput       = document.getElementById('searchInput');
const productList       = document.getElementById('productList');
const form              = document.getElementById('productForm');
const itemInput         = document.getElementById('itemInput');
const malInput          = document.getElementById('malInput');
const statusSelect      = document.getElementById('statusSelect');
const categorySelect    = document.getElementById('categorySelect');
const subcategorySelect = document.getElementById('subcategorySelect');
const groupSelect       = document.getElementById('groupSelect');
const subgroupSelect    = document.getElementById('subgroupSelect');
const deleteBtn         = document.getElementById('deleteBtn');
const modalOverlay      = document.getElementById('modalOverlay');
const modalMessage      = document.getElementById('modalMessage');
const modalConfirm      = document.getElementById('modalConfirm');
const modalCancel       = document.getElementById('modalCancel');

let allProducts = [];
let filtered    = [];
let selectedId  = null;
let unsaved     = false;

// ─── prevent focus loss on Ctrl+Digit ─────────────────────
window.addEventListener('keydown', e => {
  const a = document.activeElement;
  if (
    a && ['INPUT','SELECT','TEXTAREA'].includes(a.tagName) &&
    e.ctrlKey && e.code.startsWith('Digit')
  ) {
    e.preventDefault();
    if (e.code === 'Digit5') itemInput.focus();
  }
}, true);

// ─── modal helper ──────────────────────────────────────────
function showModal(msg, okText = 'OK', cancelText = 'Cancel') {
  return new Promise(res => {
    modalMessage.textContent   = msg;
    modalConfirm.textContent   = okText;
    modalCancel.textContent    = cancelText;
    modalOverlay.style.display = 'flex';
    const cleanup = () => {
      modalOverlay.style.display = 'none';
      modalConfirm.removeEventListener('click', onOk);
      modalCancel .removeEventListener('click', onCancel);
    };
    const onOk     = () => { cleanup(); res(true); };
    const onCancel = () => { cleanup(); res(false); };
    modalConfirm.addEventListener('click', onOk);
    modalCancel .addEventListener('click', onCancel);
  });
}

// ─── cascading classification loads ────────────────────────
async function loadClassifications() {
  const { data: cats, error } = await supabase
    .from('categories')
    .select('id, category_name')
    .order('category_name');
  if (error) return console.error(error);

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
  groupSelect.innerHTML    = '<option value="">-- Select --</option>';
  subgroupSelect.innerHTML = '<option value="">-- Select --</option>';
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

// ─── chunked fetch of *all* products ───────────────────────
const CHUNK = 1000;
async function fetchAllProducts() {
  let from = 0;
  const all = [];
  while (true) {
    const { data, error } = await supabase
      .from('products')
      .select('id, item')
      .order('item')
      .range(from, from + CHUNK - 1);
    if (error) {
      console.error('fetchAllProducts error:', error);
      break;
    }
    all.push(...data);
    if (data.length < CHUNK) break;
    from += CHUNK;
  }
  return all;
}

// ─── load & render products ────────────────────────────────
async function loadProducts() {
  allProducts = await fetchAllProducts();
  applyFilter();
}

function applyFilter() {
  const term = searchInput.value.trim().toLowerCase();
  filtered = allProducts.filter(p => p.item.toLowerCase().includes(term));
  productList.innerHTML = filtered
    .map(p => `<li data-id="${p.id}"${p.id === selectedId ? ' class="selected"' : ''}>${p.item}</li>`)
    .join('');
}

// ─── load single detail or reset ──────────────────────────
async function loadDetails(id) {
  if (unsaved) {
    const ok = await showModal('You have unsaved changes. Discard?', 'Discard', 'Cancel');
    if (!ok) return;
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

  const { data: prod, error } = await supabase
    .from('products')
    .select('item, malayalam_name, status, sub_group_id')
    .eq('id', id)
    .single();
  if (error) return console.error(error);

  // fill fields
  itemInput.value    = prod.item;
  malInput.value     = prod.malayalam_name;
  statusSelect.value = prod.status;

  // cascade up to category
  const { data: sg } = await supabase.from('sub_groups').select('product_group_id').eq('id', prod.sub_group_id).single();
  const pgId = sg.product_group_id;
  const { data: pg } = await supabase.from('product_groups').select('sub_category_id').eq('id', pgId).single();
  const scId = pg.sub_category_id;
  const { data: sc } = await supabase.from('sub_categories').select('category_id').eq('id', scId).single();

  categorySelect.value    = sc.category_id;
  await loadSubcats(categorySelect.value);
  subcategorySelect.value = scId;
  await loadGroups(subcategorySelect.value);
  groupSelect.value       = pgId;
  await loadSubgroups(groupSelect.value);
  subgroupSelect.value    = prod.sub_group_id;

  deleteBtn.disabled = false;
  unsaved = false;
}

// ─── save / insert ────────────────────────────────────────
form.addEventListener('submit', async e => {
  e.preventDefault();
  const newItem = itemInput.value.trim();
  const newMal  = malInput.value.trim();
  const newStat = statusSelect.value;
  const newSg   = subgroupSelect.value;

  // duplicate check on new
  if (!selectedId) {
    const dup = allProducts.find(p => p.item.toLowerCase() === newItem.toLowerCase());
    if (dup) {
      const edit = await showModal(`Product "${newItem}" exists. Edit instead?`, 'Yes', 'Cancel');
      if (edit) {
        unsaved = false;
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

  // preview
  const names = [
    categorySelect.selectedOptions[0].text,
    subcategorySelect.selectedOptions[0].text,
    groupSelect.selectedOptions[0].text,
    subgroupSelect.selectedOptions[0].text
  ];
  const msg = [
    `Save this product?`, ``,
    `• Item:           ${newItem}`,
    `• Malayalam name: ${newMal}`,
    `• Status:         ${newStat}`,
    `• Category:       ${names[0]}`,
    `• Sub-category:   ${names[1]}`,
    `• Group:          ${names[2]}`,
    `• Sub-group:      ${names[3]}`
  ].join('\n');
  if (!(await showModal(msg, 'Save', 'Cancel'))) return;

  // perform upsert
  if (selectedId) {
    const { error } = await supabase
      .from('products')
      .update({ item: newItem, malayalam_name: newMal, status: newStat, sub_group_id: newSg })
      .eq('id', selectedId);
    if (error) return console.error(error);
  } else {
    const { error } = await supabase
      .from('products')
      .insert([{ item: newItem, malayalam_name: newMal, status: newStat, sub_group_id: newSg }]);
    if (error) return console.error(error);
  }

  // clear filter and reload everything
  searchInput.value = '';
  await loadProducts();
  loadDetails(null);
});

// ─── delete ───────────────────────────────────────────────
deleteBtn.addEventListener('click', async () => {
  if (!selectedId) return;
  if (!(await showModal('Delete this product?', 'Delete', 'Cancel'))) return;
  const { error } = await supabase.from('products').delete().eq('id', selectedId);
  if (error) return console.error(error);
  await loadProducts();
  loadDetails(null);
});

// ─── new product ─────────────────────────────────────────
addNewBtn.addEventListener('click', () => {
  searchInput.value = '';
  applyFilter();
  loadDetails(null);
});

// ─── sidebar click & live search ─────────────────────────
productList.addEventListener('click', e => {
  const li = e.target.closest('li');
  if (li) loadDetails(Number(li.dataset.id));
});
searchInput.addEventListener('input', applyFilter);

// ─── unsaved tracker ─────────────────────────────────────
[
  itemInput, malInput, statusSelect,
  categorySelect, subcategorySelect,
  groupSelect, subgroupSelect
].forEach(el => el.addEventListener('input', () => unsaved = true));

// ─── HOME nav ────────────────────────────────────────────
homeBtn.addEventListener('click', async () => {
  if (unsaved && !(await showModal('You have unsaved changes. Leave anyway?', 'Yes', 'No'))) return;
  window.location.href = 'index.html';
});

// ─── initialize ──────────────────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
  await loadClassifications();
  await loadProducts();
  loadDetails(null);
});