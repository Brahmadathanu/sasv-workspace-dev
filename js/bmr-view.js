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
let hierarchyMap = Object.create(null);

/** Utility to fill a <select> */
function fillSelect(el, rows, valKey, txtKey, placeholder) {
  el.innerHTML = `<option value="">${placeholder}</option>` +
    rows.map(r => `<option value="${r[valKey]}">${r[txtKey]}</option>`).join('');
}

/** Case-insensitive, number-aware string compare. */
function naturalCompare(a = '', b = '') {
  return (a ?? '').toString().localeCompare((b ?? '').toString(), undefined, {
    numeric: true,
    sensitivity: 'base'
  });
}

/** BN compare: numeric if both parse to numbers; else natural. */
function bnCompare(a = '', b = '') {
  const na = parseInt(a, 10);
  const nb = parseInt(b, 10);
  if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
  return naturalCompare(a, b);
}

/** Load categories */
async function loadCategories() {
  const { data, error } = await supabase
    .from('categories')
    .select('id, category_name')
    .order('category_name', { ascending: true });
  if (error) return console.error(error);
  fillSelect(filterCategory, data, 'id', 'category_name', 'Category');
}

/** Load sub-categories */
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

/** Load product groups */
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

/** Load sub-groups */
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

/** Load items—and track eligibleItems only when upstream filters exist */
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

/** Load BN list for the selected item */
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

/** Build hierarchyMap by walking IDs across hierarchy tables.
 *  Robust against Supabase relation alias differences.
 */
async function loadHierarchyMap() {
  try {
    // --- Fetch all hierarchy tables in parallel ---------------------------------
    const [
      { data: cats, error: catErr },
      { data: subs, error: subErr },
      { data: grps, error: grpErr },
      { data: sgs,  error: sgErr  },
      { data: prods,error: prodErr}
    ] = await Promise.all([
      supabase.from('categories').select('id, category_name'),
      supabase.from('sub_categories').select('id, subcategory_name, category_id'),
      supabase.from('product_groups').select('id, group_name, sub_category_id'),
      supabase.from('sub_groups').select('id, sub_group_name, product_group_id'),
      supabase.from('products').select('item, sub_group_id').eq('status','Active').order('item',{ascending: true}),
    ]);

    if (catErr || subErr || grpErr || sgErr || prodErr) {
      console.error('loadHierarchyMap errors:', { catErr, subErr, grpErr, sgErr, prodErr });
      hierarchyMap = Object.create(null);
      return;
    }

    // --- Build ID lookup maps ---------------------------------------------------
    const catMap  = Object.create(null);
    const subMap  = Object.create(null);
    const grpMap  = Object.create(null);
    const sgMap   = Object.create(null);

    cats?.forEach(c => { catMap[c.id] = c.category_name; });
    subs?.forEach(s => { subMap[s.id] = { name: s.subcategory_name, category_id: s.category_id }; });
    grps?.forEach(g => { grpMap[g.id] = { name: g.group_name, sub_category_id: g.sub_category_id }; });
    sgs?.forEach(sg => { sgMap[sg.id] = { name: sg.sub_group_name, product_group_id: sg.product_group_id }; });

    // --- Assemble final item->hierarchy map ------------------------------------
    const map = Object.create(null);

    prods?.forEach(p => {
      const key = p.item?.toString().trim().toLowerCase();
      const sg = sgMap[p.sub_group_id];
      const grp = sg ? grpMap[sg.product_group_id] : undefined;
      const sub = grp ? subMap[grp.sub_category_id] : undefined;
      const catName = sub ? catMap[sub.category_id] : '';

      map[key] = {
        category_name   : catName            ?? '',
        group_name      : grp?.name          ?? '',
        sub_group_name  : sg?.name           ?? '',
        subcategory_name: sub?.name          ?? ''
      };
    });

    hierarchyMap = map;

    // --- Dev log sample --------------------------------------------------------
    // Comment out after verifying
    console.log('hierarchyMap sample (first 5):', Object.entries(hierarchyMap).slice(0, 5));

  } catch (err) {
    console.error('loadHierarchyMap fatal error:', err);
    hierarchyMap = Object.create(null);
  }
}

/** Render the table (full sort, but cap to 5000 rows to avoid overload). */
async function renderTable() {
  // 1) Determine which filters (if any) are active
  const hasHierarchy = Boolean(
    filterCategory.value   ||
    filterSubCat.value     ||
    filterGroup.value      ||
    filterSubGroup.value
  );
  const hasItem     = Boolean(filterItem.value);
  const hasBn       = Boolean(filterBn.value);
  const hasEligible = eligibleItems.length > 0;
  const hasAnyFilter = hasHierarchy || hasItem || hasBn || hasEligible;

  // 2) Build the base Supabase query (no server-side ORDER)
  let query = supabase
    .from('bmr_details')
    .select('item, bn, batch_size, uom');

  // 3) Apply your existing narrowing filters
  if (eligibleItems.length) query = query.in('item', eligibleItems);
  if (hasItem)              query = query.eq('item', filterItem.value);
  if (hasBn)                query = query.eq('bn', filterBn.value);

  // --- Cap rows: 10 in preview; 5000 when filtered -------------------------
  if (!hasAnyFilter) {
    // PREVIEW MODE: no filters → show only last 10, sorted within those 10
    query = query.limit(10);
  } else {
    // FILTER MODE: at least one filter → show the full filtered set (up to 5000 rows)
    query = query.limit(5000);
  }

  // 5) Fetch
  const { data, error } = await query;
  if (error) {
    console.error('renderTable error:', error);
    return;
  }

  // DEBUG: list only items that fail to match, with their codepoints
const unmatched = (data || []).filter(r => {
  const key = r.item.toString().trim().toLowerCase();
  return !(key in hierarchyMap);
});
if (unmatched.length) {
  console.group('🚧 Unmatched BMR items (with codepoints)');
  unmatched.forEach(r => {
    // print each character’s codepoint
    const codes = [...r.item].map(ch => ch.codePointAt(0).toString(16)).join(' ');
    console.log(r.item, '→', JSON.stringify(r.item), 'codes:', codes);
  });
  console.groupEnd();
}

  // 6) Decorate each row with its hierarchy names
  const decorated = (data || []).map(r => {
    const key = r.item?.toString().trim().toLowerCase();
    const h = hierarchyMap[key] || {};
    return {
      ...r,
      category_name:   h.category_name   || '',
      group_name:      h.group_name      || '',
      sub_group_name:  h.sub_group_name  || '',
      subcategory_name:h.subcategory_name|| ''
    };
  });

  // 7) Sort by Category → Group → Sub‑group → Sub‑category → Item → BN
  decorated.sort((a, b) => {
    let c;
    if ((c = naturalCompare(a.category_name,    b.category_name))    !== 0) return c;
    if ((c = naturalCompare(a.group_name,       b.group_name))       !== 0) return c;
    if ((c = naturalCompare(a.sub_group_name,   b.sub_group_name))   !== 0) return c;
    if ((c = naturalCompare(a.subcategory_name, b.subcategory_name)) !== 0) return c;
    if ((c = naturalCompare(a.item,             b.item))             !== 0) return c;
    return bnCompare(a.bn, b.bn);
  });

  // 8) Render into the table
  tableBody.innerHTML = decorated.map(r => `
    <tr>
      <td>${r.item}</td>
      <td>${r.bn}</td>
      <td>${r.batch_size ?? ''}</td>
      <td>${r.uom ?? ''}</td>
    </tr>
  `).join('');
}

/** Event hookups */
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

window.addEventListener('DOMContentLoaded', async () => {
  await loadHierarchyMap();
  await loadCategories();
  await loadItems();
  await loadBNs();
  await renderTable();
});