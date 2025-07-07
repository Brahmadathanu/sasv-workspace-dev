import { supabase } from './supabaseClient.js';

const filterCategory = document.getElementById('filterCategory');
const filterSubCat   = document.getElementById('filterSubCategory');
const filterGroup    = document.getElementById('filterGroup');
const filterSubGroup = document.getElementById('filterSubGroup');
const filterItem     = document.getElementById('filterItem');
const filterBn       = document.getElementById('filterBn');
const clearBtn       = document.getElementById('clearFilter');
const homeIcon       = document.getElementById('homeIcon');
const tableBody      = document.querySelector('#bmrViewTable tbody');

// List of items matching upstream filters; empty = no upstream filter => default view
let eligibleItems = [];

/** Utility: populate a <select> */
function fillSelect(el, rows, valKey, txtKey, placeholder) {
  el.innerHTML = `<option value="">${placeholder}</option>` +
    rows.map(r => `<option value="${r[valKey]}">${r[txtKey]}</option>`).join('');
}

/** 1. Load categories */
async function loadCategories() {
  const { data, error } = await supabase
    .from('categories').select('id, category_name')
    .order('category_name', { ascending: true });
  if (error) return console.error(error);
  fillSelect(filterCategory, data, 'id', 'category_name', 'Category');
}

/** 2. Load sub-categories */
async function loadSubCategories() {
  if (!filterCategory.value) {
    filterSubCat.disabled = true;
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

/**
 * 5. Load eligible items for table filtering.
 *    If no upstream filter, empty array => skip this filter in renderTable.
 */
async function loadItems() {
  // detect upstream filter
  const upstream = filterCategory.value || filterSubCat.value || filterGroup.value || filterSubGroup.value;
  if (!upstream) {
    eligibleItems = [];
    fillSelect(filterItem, [], '', '', 'Item');
    return;
  }

  let query = supabase
    .from('products')
    .select('item', { distinct: true })
    .eq('status', 'Active');

  if (filterSubGroup.value) {
    query = query.eq('sub_group_id', filterSubGroup.value);
  } else if (filterGroup.value) {
    const { data: sgs } = await supabase
      .from('sub_groups').select('id').eq('product_group_id', filterGroup.value);
    query = query.in('sub_group_id', sgs.map(r => r.id));
  } else if (filterSubCat.value) {
    const { data: grs } = await supabase
      .from('product_groups').select('id').eq('sub_category_id', filterSubCat.value);
    const { data: sgs } = await supabase
      .from('sub_groups').select('id').in('product_group_id', grs.map(g => g.id));
    query = query.in('sub_group_id', sgs.map(r => r.id));
  } else {
    const { data: subs } = await supabase
      .from('sub_categories').select('id').eq('category_id', filterCategory.value);
    const { data: grs } = await supabase
      .from('product_groups').select('id').in('sub_category_id', subs.map(s => s.id));
    const { data: sgs } = await supabase
      .from('sub_groups').select('id').in('product_group_id', grs.map(g => g.id));
    query = query.in('sub_group_id', sgs.map(r => r.id));
  }

  const { data, error } = await query.order('item', { ascending: true });
  if (error) return console.error(error);

  eligibleItems = data.map(r => r.item);
  fillSelect(filterItem, data, 'item', 'item', 'Item');
}

/**
 * 6. Render the BMR entries table.
 *    Applies:
 *      • upstream filter (eligibleItems) only if non-empty
 *      • item filter
 *      • BN filter
 */
async function renderTable() {
  let query = supabase
    .from('bmr_details')
    .select('item, bn, batch_size, uom')
    .order('id', { ascending: false })
    .limit(10);

  if (eligibleItems.length)      query = query.in('item', eligibleItems);
  if (filterItem.value)          query = query.eq('item', filterItem.value);
  if (filterBn.value.trim())     query = query.eq('bn', filterBn.value.trim());

  const { data, error } = await query;
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

/** 7. Hook up filters */
filterCategory.addEventListener('change', async () => {
  filterSubCat.value = ''; filterSubCat.disabled = true;
  filterGroup.value  = ''; filterGroup.disabled  = true;
  filterSubGroup.value = ''; filterSubGroup.disabled = true;

  await loadSubCategories();
  await loadItems();
  await renderTable();
});
filterSubCat.addEventListener('change', async () => {
  filterGroup.value  = ''; filterGroup.disabled  = true;
  filterSubGroup.value = ''; filterSubGroup.disabled = true;

  await loadGroups();
  await loadItems();
  await renderTable();
});
filterGroup.addEventListener('change', async () => {
  filterSubGroup.value = ''; filterSubGroup.disabled = true;

  await loadSubGroups();
  await loadItems();
  await renderTable();
});
filterSubGroup.addEventListener('change', async () => {
  await loadItems();
  await renderTable();
});
filterItem.addEventListener('change', () => renderTable());
filterBn.addEventListener('input', () => renderTable());

/** 8. Clear filters → back to default */
clearBtn.addEventListener('click', async () => {
  filterCategory.value   = '';
  filterSubCat.value     = ''; filterSubCat.disabled     = true;
  filterGroup.value      = ''; filterGroup.disabled      = true;
  filterSubGroup.value   = ''; filterSubGroup.disabled   = true;
  filterItem.value       = '';
  filterBn.value         = '';

  fillSelect(filterSubCat, [], '', '', 'Subcategory');
  fillSelect(filterGroup,    [], '', '', 'Group');
  fillSelect(filterSubGroup, [], '', '', 'Sub-group');
  fillSelect(filterItem, [], '', '', 'Item');
  eligibleItems = [];

  await renderTable();  // default last 10
});

/** 9. Home nav */
homeIcon.addEventListener('click', () => {
  window.location.href = 'index.html';
});

/** 10. Init */
window.addEventListener('DOMContentLoaded', async () => {
  await loadCategories();
  await renderTable();    // show default last 10
});