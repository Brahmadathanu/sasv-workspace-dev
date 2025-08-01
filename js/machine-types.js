import { supabase } from '../shared/js/supabaseClient.js';

// — Dialog helpers —
const dlgOv  = document.getElementById('dialogOverlay');
const dlgMsg = document.getElementById('dialogMessage');
const btnYes = document.getElementById('btnYes');
const btnNo  = document.getElementById('btnNo');
const btnOk  = document.getElementById('btnOk');

function showAlert(msg) {
  return new Promise(res => {
    dlgMsg.textContent       = msg;
    btnYes.style.display     = 'none';
    btnNo.style.display      = 'none';
    btnOk.style.display      = 'inline-block';
    dlgOv.style.display      = 'flex';
    btnOk.focus();
    btnOk.onclick = () => { dlgOv.style.display = 'none'; res(); };
  });
}

function askConfirm(msg) {
  return new Promise(res => {
    dlgMsg.textContent       = msg;
    btnYes.style.display     = 'inline-block';
    btnNo.style.display      = 'inline-block';
    btnOk.style.display      = 'none';
    dlgOv.style.display      = 'flex';
    btnYes.onclick = () => { dlgOv.style.display='none'; res(true); };
    btnNo.onclick  = () => { dlgOv.style.display='none'; res(false); };
  });
}

// DOM refs
const searchInput   = document.getElementById('searchInput');
const clearSearch   = document.getElementById('clearSearch');
const typesTbody    = document.querySelector('#typesTable tbody');
const homeIcon      = document.getElementById('homeIcon');

const multiBody     = document.querySelector('#multiTypeTable tbody');
const multiAddBtn   = document.getElementById('multiAddBtn');
const multiClearBtn = document.getElementById('multiClearBtn');

// — Render existing types —
async function renderTypes(filter = '') {
  typesTbody.innerHTML = '';
  let q = supabase
    .from('machine_types')
    .select('id,name')
    .order('id', { ascending: false })
    .limit(10);

  if (filter) {
    q = q.ilike('name', `%${filter}%`);
  }

  const { data, error } = await q;
  if (error) {
    console.error('renderTypes error:', error);
    return;
  }

  typesTbody.innerHTML = data.map(r => `
    <tr data-id="${r.id}">
      <td>${r.name}</td>
      <td>
        <button class="action-link edit-btn">Edit</button> |
        <button class="action-link delete-btn">Delete</button>
      </td>
    </tr>
  `).join('');
}

// — Live filter & clear —
searchInput.addEventListener('input', () => {
  renderTypes(searchInput.value.trim());
});
clearSearch.onclick = () => {
  searchInput.value = '';
  renderTypes();
};

// — Inline edit/save/cancel/delete —
function startEdit(tr) {
  const old = tr.children[0].textContent;
  tr.dataset.old = old;
  tr.children[0].innerHTML = `<input class="edit-input" value="${old}">`;
  tr.children[1].innerHTML = `
    <button class="action-link save-btn">Save</button> |
    <button class="action-link cancel-btn">Cancel</button>`;
  tr.querySelector('.edit-input').focus();
}

async function saveEdit(tr) {
  const id  = tr.dataset.id;
  const old = tr.dataset.old;
  const nv  = tr.querySelector('.edit-input').value.trim();
  if (!nv) { await showAlert('Name cannot be empty.'); return; }
  if (nv === old) { return renderTypes(searchInput.value.trim()); }
  if (!await askConfirm(`Change "${old}" → "${nv}"?`)) {
    return renderTypes(searchInput.value.trim());
  }
  const { error } = await supabase
    .from('machine_types')
    .update({ name: nv })
    .eq('id', id);
  if (error) {
    console.error('saveEdit error:', error);
    await showAlert('Update failed.');
  }
  renderTypes(searchInput.value.trim());
}

async function deleteType(tr) {
  const name = tr.children[0].textContent;
  if (!await askConfirm(`Delete "${name}"?`)) return;
  const { error } = await supabase
    .from('machine_types')
    .delete()
    .eq('id', tr.dataset.id);
  if (error) {
    console.error('deleteType error:', error);
    await showAlert('Delete failed.');
  }
  renderTypes(searchInput.value.trim());
}

// — Row delegation for existing table —
typesTbody.onclick = ev => {
  const btn = ev.target.closest('button');
  if (!btn) return;
  const tr  = btn.closest('tr');
  if (btn.classList.contains('edit-btn'))   startEdit(tr);
  if (btn.classList.contains('save-btn'))   saveEdit(tr);
  if (btn.classList.contains('cancel-btn')) renderTypes(searchInput.value.trim());
  if (btn.classList.contains('delete-btn')) deleteType(tr);
};

// — Multi-add helpers —
function bindRow(r) {
  r.querySelector('.row-add').onclick    = onRowAdd;
  r.querySelector('.row-remove').onclick = onRowRemove;
}

function onRowAdd(e) {
  const rows = [...multiBody.rows];
  for (let i = 0; i < rows.length; i++) {
    if (!rows[i].querySelector('.m-name').value.trim()) {
      showAlert(`Row ${i+1} is empty.`);
      return;
    }
  }
  if (rows.length >= 10) {
    showAlert('Maximum 10 rows.');
    return;
  }
  const clone = rows[0].cloneNode(true);
  clone.querySelector('.m-name').value = '';
  bindRow(clone);
  multiBody.appendChild(clone);
  clone.querySelector('.m-name').focus();
}

function onRowRemove(e) {
  if (multiBody.rows.length === 1) return;
  e.target.closest('tr').remove();
  multiBody.rows[0].querySelector('.m-name').focus();
}

function clearMulti() {
  [...multiBody.rows].slice(1).forEach(r => r.remove());
  multiBody.rows[0].querySelector('.m-name').value = '';
  multiBody.rows[0].querySelector('.m-name').focus();
}

// — Add All —
multiAddBtn.onclick = async () => {
  const vals = [...multiBody.rows].map((r,i)=>({
    v: r.querySelector('.m-name').value.trim(),
    row: i+1
  }));
  for (const {v,row} of vals) {
    if (!v) {
      await showAlert(`Row ${row} is empty.`);
      return;
    }
  }
  if (!await askConfirm(`Add ${vals.length} types?`)) return;

  let added=0, failed=0;
  for (const {v} of vals) {
    const { error } = await supabase
      .from('machine_types')
      .insert([{ name: v }]);
    error ? failed++ : added++;
  }
  await showAlert(`Added: ${added}\nErrors: ${failed}`);
  clearMulti();
  renderTypes();
};

// — Home nav —
homeIcon.onclick = () => location.href = 'index.html';

// — Init —
window.addEventListener('DOMContentLoaded', () => {
  bindRow(multiBody.rows[0]);
  renderTypes();
});