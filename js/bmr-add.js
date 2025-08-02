// js/bmr-add.js

import { supabase } from '../public/shared/js/supabaseClient.js';

// — Element references —
const homeBtn       = document.getElementById('homeBtn');
const downloadBtn   = document.getElementById('downloadTemplate');
const csvFileInput  = document.getElementById('csvFile');
const uploadCsvBtn  = document.getElementById('uploadCsv');
const tableBody     = document.querySelector('#multiTable tbody');
const multiAddBtn   = document.getElementById('multiAdd');
const multiClearBtn = document.getElementById('multiClear');
const previewOverlay = document.getElementById('previewOverlay');
const previewTbody  = document.querySelector('#previewTable tbody');
const cancelPreview = document.getElementById('cancelPreview');
const confirmPreview = document.getElementById('confirmPreview');
const dialogOverlay = document.getElementById('dialogOverlay');
const dialogMsg     = document.getElementById('dialogMessage');
const btnYes        = document.getElementById('btnYes');
const btnNo         = document.getElementById('btnNo');
const btnOk         = document.getElementById('btnOk');
const itemList      = document.getElementById('itemList');

let csvPreviewData = null;
const maxRows = 10;

/** Show an alert dialog */
function showAlert(msg) {
  return new Promise(res => {
    dialogMsg.textContent = msg;
    btnYes.style.display = 'none';
    btnNo.style.display = 'none';
    btnOk.style.display = 'inline-block';
    dialogOverlay.style.display = 'flex';
    btnOk.onclick = () => {
      dialogOverlay.style.display = 'none';
      res();
    };
  });
}

/** Show a confirm dialog */
function askConfirm(msg) {
  return new Promise(res => {
    dialogMsg.textContent = msg;
    btnYes.style.display = 'inline-block';
    btnNo.style.display = 'inline-block';
    btnOk.style.display = 'none';
    dialogOverlay.style.display = 'flex';
    btnYes.onclick = () => { dialogOverlay.style.display = 'none'; res(true); };
    btnNo.onclick  = () => { dialogOverlay.style.display = 'none'; res(false); };
  });
}

/** Keep focus on the first item input */
function ensureFocus() {
  const first = tableBody.querySelector('.m-item');
  if (first) first.focus();
}

/** Navigate home with confirmation */
homeBtn.onclick = async () => {
  if (await askConfirm('Discard changes and return home?')) {
    window.location.href = 'index.html';
  }
};

/** Load product list into datalist */
async function loadProducts() {
  const { data, error } = await supabase
    .from('products')
    .select('item')
    .eq('status', 'Active')
    .order('item');
  if (error) {
    console.error('loadProducts error:', error);
    return;
  }
  // Build option elements for the datalist
  itemList.innerHTML = data
    .map(r => `<option value="${r.item.replace(/"/g, '&quot;')}">`)
    .join('');
}

/** Bind add/remove buttons on a row */
function bindRowButtons(row) {
  row.querySelector('.row-add').onclick = onRowAdd;
  row.querySelector('.row-remove').onclick = onRowRemove;
}

/** Clone a row and clear its inputs */
function onRowAdd(e) {
  if (![...tableBody.rows].every(r =>
    r.querySelector('.m-item').value.trim() &&
    r.querySelector('.m-bn').value.trim() &&
    r.querySelector('.m-uom').value
  )) {
    showAlert('Please complete all existing rows first.');
    return;
  }
  if (tableBody.rows.length >= maxRows) {
    showAlert(`Maximum ${maxRows} rows allowed.`);
    return;
  }
  const tr = e.target.closest('tr');
  const clone = tr.cloneNode(true);
  clone.querySelectorAll('input').forEach(i => i.value = '');
  clone.querySelectorAll('select').forEach(s => s.selectedIndex = 0);
  bindRowButtons(clone);
  tr.after(clone);
  ensureFocus();
}

/** Remove a row, ensuring at least one remains */
function onRowRemove(e) {
  if (tableBody.rows.length === 1) return;
  e.target.closest('tr').remove();
  ensureFocus();
}

/** Clear all rows back to one empty row */
multiClearBtn.onclick = () => {
  [...tableBody.rows].slice(1).forEach(r => r.remove());
  const row = tableBody.querySelector('tr');
  row.querySelectorAll('input').forEach(i => i.value = '');
  row.querySelectorAll('select').forEach(s => s.selectedIndex = 0);
  ensureFocus();
};

/** Insert a single BMR entry into the database */
async function insertBmr({ item, bn, size, uom }) {
  const { error } = await supabase
    .from('bmr_details')
    .insert([{ item, bn, batch_size: size, uom }]);
  if (error) {
    if (error.code === '23505') return { dup: true };
    console.error('insertBmr error:', error);
    return { err: true };
  }
  return { ok: true };
}

/** Cancel the preview and return to editing */
cancelPreview.onclick = () => {
  previewOverlay.style.display = 'none';
  csvPreviewData = null;
};

/** Confirm previewed entries and insert them */
confirmPreview.onclick = async () => {
  previewOverlay.style.display = 'none';
  const data = csvPreviewData || [...tableBody.rows].map(r => ({
    item: r.querySelector('.m-item').value.trim(),
    bn:   r.querySelector('.m-bn').value.trim(),
    size: r.querySelector('.m-size').value,
    uom:  r.querySelector('.m-uom').value
  }));
  let added = 0, dup = 0, err = 0;
  for (const d of data) {
    const res = await insertBmr(d);
    if (res.ok)      added++;
    else if (res.dup) dup++;
    else             err++;
  }
  await showAlert(`Added: ${added}\nDuplicates: ${dup}\nErrors: ${err}`);
  if (csvPreviewData) {
    csvFileInput.value = '';
    csvPreviewData = null;
  } else {
    multiClearBtn.onclick();
  }
};

/** “Add All” clicked: validate rows then show preview */
multiAddBtn.onclick = () => {
  const rows = [...tableBody.rows].map((r, i) => {
    const item = r.querySelector('.m-item').value.trim();
    const bn   = r.querySelector('.m-bn').value.trim();
    const size = r.querySelector('.m-size').value;
    const uom  = r.querySelector('.m-uom').value;
    return { item, bn, size, uom, index: i + 1 };
  });
  for (const { item, bn, uom, index } of rows) {
    if (!item || !bn || !uom) {
      showAlert(`Row ${index} is incomplete.`);
      return;
    }
  }
  csvPreviewData = null;
  previewTbody.innerHTML = rows.map(({item,bn,size,uom},i) => `
    <tr>
      <td>${i+1}</td>
      <td>${item}</td>
      <td>${bn}</td>
      <td>${size || '–'}</td>
      <td>${uom}</td>
    </tr>
  `).join('');
  previewOverlay.style.display = 'flex';
};

/** “Upload CSV” clicked: parse and show preview */
uploadCsvBtn.onclick = async () => {
  const file = csvFileInput.files[0];
  if (!file) {
    await showAlert('Select a CSV first.');
    return;
  }
  if (!await askConfirm(`Upload ${file.name}?`)) return;

  const text = await new Promise(r => {
    const fr = new FileReader();
    fr.onload = e => r(e.target.result);
    fr.readAsText(file);
  });

  const lines = text.split(/\r?\n/).filter(l => l.trim());
  const data = [];

  try {
    lines.forEach((ln, idx) => {
      const [item, bn, size, uom] = ln.split(',').map(c => c.trim());
      if (!item || !bn || !uom) {
        throw new Error(`CSV row ${idx+1} incomplete`);
      }
      data.push({ item, bn, size: parseFloat(size) || null, uom });
    });
  } catch (err) {
    await showAlert(err.message);
    return;
  }

  csvPreviewData = data;
  previewTbody.innerHTML = data.map((d,i) => `
    <tr>
      <td>${i+1}</td>
      <td>${d.item}</td>
      <td>${d.bn}</td>
      <td>${d.size || '–'}</td>
      <td>${d.uom}</td>
    </tr>
  `).join('');
  previewOverlay.style.display = 'flex';
};

// — Initialize on DOMContentLoaded —
window.addEventListener('DOMContentLoaded', async () => {
  await loadProducts();
  // Bind the first row
  bindRowButtons(tableBody.querySelector('tr'));
  ensureFocus();
});