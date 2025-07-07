import { supabase } from './supabaseClient.js';

// — DOM refs —
const filterItem    = document.getElementById('filterItem');
const filterBn      = document.getElementById('filterBn');
const clearFilter   = document.getElementById('clearFilter');
const tableBody     = document.querySelector('#bmrTable tbody');
const homeIcon      = document.getElementById('homeIcon');

const editOverlay   = document.getElementById('editOverlay');
const editForm      = document.getElementById('editForm');
const editItemSel   = document.getElementById('editItem');
const editBnInput   = document.getElementById('editBn');
const editSizeInput = document.getElementById('editSize');
const editUomSel    = document.getElementById('editUom');
const cancelEditBtn = document.getElementById('cancelEdit');

const dialogOverlay = document.getElementById('dialogOverlay');
const dialogMsg     = document.getElementById('dialogMessage');
const btnYes        = document.getElementById('btnYes');
const btnNo         = document.getElementById('btnNo');
const btnOk         = document.getElementById('btnOk');

let currentId       = null,
    productOptions  = '<option value="">— Any —</option>';

// — Dialog helpers —
function showAlert(msg) {
  return new Promise(res => {
    dialogMsg.textContent       = msg;
    btnYes.style.display        = 'none';
    btnNo.style.display         = 'none';
    btnOk.style.display         = 'inline-block';
    dialogOverlay.style.display = 'flex';
    btnOk.onclick = () => {
      dialogOverlay.style.display = 'none';
      res();
    };
  });
}

function askConfirm(msg) {
  return new Promise(res => {
    dialogMsg.textContent       = msg;
    btnYes.style.display        = 'inline-block';
    btnNo.style.display         = 'inline-block';
    btnOk.style.display         = 'none';
    dialogOverlay.style.display = 'flex';
    btnYes.onclick = () => { dialogOverlay.style.display = 'none'; res(true); };
    btnNo.onclick  = () => { dialogOverlay.style.display = 'none'; res(false); };
  });
}

// — Load products for dropdowns —
async function loadProducts() {
  const { data, error } = await supabase
    .from('products')
    .select('item')
    .eq('status','Active')
    .order('item');
  if (error) { console.error(error); return; }
  data.forEach(r => {
    const v = r.item.replace(/"/g,'&quot;');
    productOptions += `<option value="${v}">${v}</option>`;
  });
  filterItem.innerHTML  = productOptions;
  editItemSel.innerHTML = productOptions.replace('— Any —','— Select Item —');
}

// — Render table with current filters —
async function renderTable() {
  let q = supabase
    .from('bmr_details')
    .select('id,item,bn,batch_size,uom')
    .order('id', { ascending: false })
    .limit(10);

  if (filterItem.value) q = q.eq('item', filterItem.value);
  if (filterBn.value.trim()) q = q.eq('bn', filterBn.value.trim());

  const { data, error } = await q;
  if (error) { console.error(error); return; }

  tableBody.innerHTML = data.map(r => `
    <tr data-id="${r.id}">
      <td>${r.item}</td>
      <td>${r.bn}</td>
      <td>${r.batch_size ?? ''}</td>
      <td>${r.uom}</td>
      <td>
        <button class="action-link-small edit-btn">Edit</button> |
        <button class="action-link-small delete-btn">Delete</button>
      </td>
    </tr>
  `).join('');
}

// — Open edit modal —
function openEditModal(tr) {
  currentId = tr.dataset.id;
  editItemSel.innerHTML = productOptions.replace('— Any —','— Select Item —');
  editItemSel.value     = tr.children[0].textContent;
  editBnInput.value     = tr.children[1].textContent;
  editSizeInput.value   = tr.children[2].textContent;
  editUomSel.value      = tr.children[3].textContent;
  editOverlay.style.display = 'flex';
  editItemSel.focus();
}

// — Cancel edit —
cancelEditBtn.onclick = () => editOverlay.style.display = 'none';

// — Submit edited entry —
editForm.addEventListener('submit', async e => {
  e.preventDefault();
  const item = editItemSel.value.trim();
  const bn   = editBnInput.value.trim();
  const size = editSizeInput.value || null;
  const uom  = editUomSel.value;

  if (!item || !bn || !uom) {
    await showAlert('Item, BN and UOM are required.');
    return;
  }

  editOverlay.style.display = 'none';
  if (!await askConfirm(`Save changes to entry #${currentId}?`)) {
    return renderTable();
  }

  const { error } = await supabase
    .from('bmr_details')
    .update({ item, bn, batch_size: size, uom })
    .eq('id', currentId);
  if (error) console.error(error);

  renderTable();
});

// — Delegate Edit/Delete clicks —
tableBody.addEventListener('click', async e => {
  if (e.target.matches('.edit-btn')) {
    openEditModal(e.target.closest('tr'));
  }
  if (e.target.matches('.delete-btn')) {
    const tr = e.target.closest('tr');
    const id = tr.dataset.id;
    const it = tr.children[0].textContent;
    if (await askConfirm(`Delete entry #${id} (${it})?`)) {
      const { error } = await supabase
        .from('bmr_details')
        .delete()
        .eq('id', id);
      if (error) console.error(error);
      renderTable();
    }
  }
});

// — Auto-filter on change/input —
filterItem.addEventListener('change', renderTable);
filterBn.addEventListener('input',  renderTable);

// — Clear filters —
clearFilter.onclick = () => {
  filterItem.value = '';
  filterBn.value   = '';
  renderTable();
};

// — Home nav —
homeIcon.onclick = async () => {
  if (await askConfirm('Discard changes and go home?')) {
    window.location.href = 'index.html';
  }
};

// — Init —
window.addEventListener('DOMContentLoaded', async () => {
  await loadProducts();
  await renderTable();
});