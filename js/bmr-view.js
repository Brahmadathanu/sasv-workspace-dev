// js/bmr-view.js
import { supabase } from './supabaseClient.js';

const filterCategory = document.getElementById('filterCategory');
const filterSubCat   = document.getElementById('filterSubCategory');
const filterGroup    = document.getElementById('filterGroup');
const filterSubGroup = document.getElementById('filterSubGroup');
const filterItem     = document.getElementById('filterItem');
const filterBn       = document.getElementById('filterBn');
const clearBtn       = document.getElementById('clearFilter');
const homeBtn        = document.getElementById('homeBtn');
const tableBody      = document.querySelector('#bmrViewTable tbody');

let eligibleItems = [];

/** Utility to fill a <select> */
function fillSelect(el, rows, valKey, txtKey, placeholder) {
  el.innerHTML = `<option value="">${placeholder}</option>` +
    rows.map(r => `<option value="${r[valKey]}">${r[txtKey]}</option>`).join('');
}

/** 1. Load categories */
async function loadCategories() {
  const { data, error } = await supabase
    .from('categories')
    .select('id, category_name')
    .order('category_name', { ascending: true });
  if (error) return console.error(error);
  fillSelect(filterCategory, data, 'id', 'category_name', 'Category');
}

/** 2. Load sub-categories */
async function loadSubCategories() {
  if (!filterCategory.value) {
    filterSubCat.disabled = true;
    fillSelect(filterSubCat, [], '', '', 'Subcategory');
    return;
  }
  const { data, error } = await supabase
    .from('sub_categories')
    .select('id, subcategory_name')
    .eq('category_id', filterCategory.value)
    .order('subcategory_name', { ascending: true });
  if (error) return console.error(error);
  fillSelect(filterSubCat, data, 'id', 'subcategory_name', 'Subcategory');
  filterSubCat.disabled = false;
}

/** 3. Load product groups */
async function loadGroups() {
  if (!filterSubCat.value) {
    filterGroup.disabled = true;
    fillSelect(filterGroup, [], '', '', 'Group');
    return;
  }
  const { data, error } = await supabase
    .from('product_groups')
    .select('id, group_name')
    .eq('sub_category_id', filterSubCat.value)
    .order('group_name', { ascending: true });
  if (error) return console.error(error);
  fillSelect(filterGroup, data, 'id', 'group_name', 'Group');
  filterGroup.disabled = false;
}

/** 4. Load sub-groups */
async function loadSubGroups() {
  if (!filterGroup.value) {
    filterSubGroup.disabled = true;
    fillSelect(filterSubGroup, [], '', '', 'Sub-group');
    return;
  }
  const { data, error } = await supabase
    .from('sub_groups')
    .select('id, sub_group_name')
    .eq('product_group_id', filterGroup.value)
    .order('sub_group_name', { ascending: true });
  if (error) return console.error(error);
  fillSelect(filterSubGroup, data, 'id', 'sub_group_name', 'Sub-group');
  filterSubGroup.disabled = false;
}

/** 5. Load items—and track eligibleItems only when upstream filters exist */
async function loadItems() {
  let query = supabase
    .from('products')
    .select('item', { distinct: true })
    .eq('status', 'Active');

  const upstream = filterCategory.value || filterSubCat.value || filterGroup.value || filterSubGroup.value;
  if (upstream) {
    if (filterSubGroup.value) {
      query = query.eq('sub_group_id', filterSubGroup.value);
    } else if (filterGroup.value) {
      const { data: sgs } = await supabase
        .from('sub_groups')
        .select('id')
        .eq('product_group_id', filterGroup.value);
      query = query.in('sub_group_id', sgs.map(r => r.id));
    } else if (filterSubCat.value) {
      const { data: grs } = await supabase
        .from('product_groups')
        .select('id')
        .eq('sub_category_id', filterSubCat.value);
      const { data: sgs } = await supabase
        .from('sub_groups')
        .select('id')
        .in('product_group_id', grs.map(g => g.id));
      query = query.in('sub_group_id', sgs.map(r => r.id));
    } else {
      const { data: subs } = await supabase
        .from('sub_categories')
        .select('id')
        .eq('category_id', filterCategory.value);
      const { data: grs } = await supabase
        .from('product_groups')
        .select('id')
        .in('sub_category_id', subs.map(s => s.id));
      const { data: sgs } = await supabase
        .from('sub_groups')
        .select('id')
        .in('product_group_id', grs.map(g => g.id));
      query = query.in('sub_group_id', sgs.map(r => r.id));
    }
  }

  const { data, error } = await query.order('item', { ascending: true });
  if (error) return console.error(error);

  fillSelect(filterItem, data, 'item', 'item', 'Item');
  eligibleItems = upstream ? data.map(r => r.item) : [];
}

/** 6. Load BN list for the selected item */
async function loadBNs() {
  if (!filterItem.value) {
    filterBn.disabled = true;
    fillSelect(filterBn, [], '', '', 'BN');
    return;
  }
  const { data, error } = await supabase
    .from('bmr_details')
    .select('bn', { distinct: true })
    .eq('item', filterItem.value)
    .order('bn', { ascending: true });
  if (error) return console.error(error);
  fillSelect(filterBn, data, 'bn', 'bn', 'BN');
  filterBn.disabled = false;
}

/** 7. Render the BMR entries table with multi-column sort */
async function renderTable() {
  let query = supabase
    .from('bmr_details')
    .select('item, bn, batch_size, uom');

  // Apply filters
  if (eligibleItems.length) query = query.in('item', eligibleItems);
  if (filterItem.value)    query = query.eq('item', filterItem.value);
  if (filterBn.value)      query = query.eq('bn', filterBn.value);

  // Sort first by item (A→Z), then by bn (ascending), then limit to last 10 rows
  const { data, error } = await query
    .order('item', { ascending: true })
    .order('bn',   { ascending: true })
    .limit(10);

  if (error) return console.error(error);

  tableBody.innerHTML = data.map(r => `
    <tr>
      <td>${r.item}</td>
      <td>${r.bn}</td>
      <td>${r.batch_size ?? ''}</td>
      <td>${r.uom ?? ''}</td>
    </tr>
  `).join('');
}

/** 8. Hook up filters & buttons (unchanged) */
filterCategory.addEventListener('change', async () => {
  filterSubCat.value = ''; filterSubCat.disabled = true;
  filterGroup.value  = ''; filterGroup.disabled  = true;
  filterSubGroup.value = ''; filterSubGroup.disabled = true;
  filterItem.value = ''; filterBn.value = ''; filterBn.disabled = true;

  await loadSubCategories();
  await loadItems();
  await loadBNs();
  await renderTable();
});

filterSubCat.addEventListener('change', async () => {
  filterGroup.value     = ''; filterGroup.disabled     = true;
  filterSubGroup.value  = ''; filterSubGroup.disabled  = true;
  filterItem.value      = ''; filterBn.value           = ''; filterBn.disabled = true;

  await loadGroups();
  await loadItems();
  await loadBNs();
  await renderTable();
});

filterGroup.addEventListener('change', async () => {
  filterSubGroup.value = ''; filterSubGroup.disabled = true;
  filterItem.value     = ''; filterBn.value         = ''; filterBn.disabled = true;

  await loadSubGroups();
  await loadItems();
  await loadBNs();
  await renderTable();
});

filterSubGroup.addEventListener('change', async () => {
  filterItem.value = ''; filterBn.value = ''; filterBn.disabled = true;

  await loadItems();
  await loadBNs();
  await renderTable();
});

filterItem.addEventListener('change', async () => {
  filterBn.value = '';
  await loadBNs();
  await renderTable();
});

filterBn.addEventListener('change', () => renderTable());

clearBtn.addEventListener('click', async () => {
  filterCategory.value   = '';
  filterSubCat.value     = ''; filterSubCat.disabled     = true;
  filterGroup.value      = ''; filterGroup.disabled      = true;
  filterSubGroup.value   = ''; filterSubGroup.disabled   = true;
  filterItem.value       = '';
  filterBn.value         = ''; filterBn.disabled         = true;

  fillSelect(filterSubCat, [], '', '', 'Subcategory');
  fillSelect(filterGroup,    [], '', '', 'Group');
  fillSelect(filterSubGroup, [], '', '', 'Sub-group');
  fillSelect(filterItem, [], '', '', 'Item');
  fillSelect(filterBn,   [], '', '', 'BN');
  eligibleItems = [];

  await renderTable();
});

homeBtn.addEventListener('click', () => {
  window.location.href = 'index.html';
});

/** 9. Init (unchanged) */
window.addEventListener('DOMContentLoaded', async () => {
  await loadCategories();
  await loadItems();
  await loadBNs();
  await renderTable();
});