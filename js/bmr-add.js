// js/bmr-add.js
import { supabase } from './supabaseClient.js';

// — Element refs —
const homeIcon       = document.getElementById('homeIcon');
const downloadBtn    = document.getElementById('downloadTemplate');
const csvFileInput   = document.getElementById('csvFile');
const uploadCsvBtn   = document.getElementById('uploadCsv');
const tableBody      = document.querySelector('#multiTable tbody');
const multiAddBtn    = document.getElementById('multiAdd');
const multiClearBtn  = document.getElementById('multiClear');
const previewOverlay = document.getElementById('previewOverlay');
const previewTbody   = document.querySelector('#previewTable tbody');
const cancelPreview  = document.getElementById('cancelPreview');
const confirmPreview = document.getElementById('confirmPreview');
const dialogOverlay  = document.getElementById('dialogOverlay');
const dialogMsg      = document.getElementById('dialogMessage');
const btnYes         = document.getElementById('btnYes');
const btnNo          = document.getElementById('btnNo');
const btnOk          = document.getElementById('btnOk');

let productOptionsHtml = '';
let csvPreviewData     = null;
const maxRows          = 10;

// — Download blank CSV template —
downloadBtn.addEventListener('click', () => {
  const headers = ['item','bn','batch_size','uom'];
  const csv     = headers.join(',') + '\r\n';
  const blob    = new Blob([csv], { type: 'text/csv' });
  const url     = URL.createObjectURL(blob);
  const a       = document.createElement('a');
  a.href        = url;
  a.download    = 'bmr_template.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

// — Dialog helpers —
function showAlert(msg) {
  return new Promise(res => {
    dialogMsg.textContent     = msg;
    btnYes.style.display      = 'none';
    btnNo.style.display       = 'none';
    btnOk.style.display       = 'inline-block';
    dialogOverlay.style.display = 'flex';
    btnOk.onclick = () => {
      dialogOverlay.style.display = 'none';
      res();
    };
  });
}

function askConfirm(msg) {
  return new Promise(res => {
    dialogMsg.textContent     = msg;
    btnYes.style.display      = 'inline-block';
    btnNo.style.display       = 'inline-block';
    btnOk.style.display       = 'none';
    dialogOverlay.style.display = 'flex';
    btnYes.onclick = () => { dialogOverlay.style.display='none'; res(true); };
    btnNo .onclick = () => { dialogOverlay.style.display='none'; res(false); };
  });
}

// — Ensure focus back in first row —
function ensureFocus() {
  const first = tableBody.querySelector('.m-item');
  if (first) first.focus();
}

// — Navigate home —
homeIcon.onclick = async () => {
  if (await askConfirm('Discard changes and return home?')) {
    window.location.href = 'index.html';
  }
};

// — Load product list from Supabase —
async function loadProducts() {
  const { data, error } = await supabase
    .from('products')
    .select('item')
    .eq('status','Active')
    .order('item');
  if (error) {
    console.error('loadProducts error:', error);
    return;
  }
  productOptionsHtml = '<option value="">— Select Item —</option>';
  data.forEach(r => {
    const v = r.item.replace(/"/g,'&quot;');
    productOptionsHtml += `<option value="${v}">${v}</option>`;
  });
}

// — Bind row add/remove buttons —
function bindRowButtons(row) {
  row.querySelector('.row-add')   .onclick = onRowAdd;
  row.querySelector('.row-remove').onclick = onRowRemove;
}

// — On DOM ready —
window.addEventListener('DOMContentLoaded', async () => {
  await loadProducts();
  // Populate first row
  document.querySelectorAll('select.m-item').forEach(sel => {
    sel.innerHTML = productOptionsHtml;
  });
  bindRowButtons(tableBody.querySelector('tr'));
  ensureFocus();
});

// — Check each row is complete —
function allRowsComplete() {
  return [...tableBody.rows].every(r => {
    return r.querySelector('.m-item').value &&
           r.querySelector('.m-bn').value.trim() &&
           r.querySelector('.m-uom').value;
  });
}

// — Add new row —
function onRowAdd(e) {
  if (!allRowsComplete()) {
    showAlert('Please complete all existing rows first.');
    return;
  }
  const rows = tableBody.rows;
  if (rows.length >= maxRows) {
    showAlert(`Maximum ${maxRows} rows allowed.`);
    return;
  }
  const tr    = e.target.closest('tr');
  const clone = tr.cloneNode(true);
  clone.querySelectorAll('input').forEach(i => i.value = '');
  const sel = clone.querySelector('select.m-item');
  sel.innerHTML = productOptionsHtml;
  bindRowButtons(clone);
  tr.after(clone);
  ensureFocus();
}

// — Remove a row —
function onRowRemove(e) {
  const rows = tableBody.rows;
  if (rows.length === 1) return;
  e.target.closest('tr').remove();
  ensureFocus();
}

// — Clear all rows except one —
multiClearBtn.onclick = () => {
  [...tableBody.rows].slice(1).forEach(r => r.remove());
  tableBody.querySelectorAll('input,select').forEach(el => {
    if (el.matches('select.m-item')) el.selectedIndex = 0;
    else el.value = '';
  });
  ensureFocus();
};

// — Insert one BMR entry via Supabase —
async function insertBmr({ item, bn, size, uom }) {
  const { error } = await supabase
    .from('bmr_details')
    .insert([{ item, bn, batch_size: size, uom }]);
  if (error) {
    if (error.code === '23505') return { dup:true };
    console.error('insertBmr error:', error);
    return { err:true };
  }
  return { ok:true };
}

// — Preview cancel/confirm —
cancelPreview.onclick = () => {
  previewOverlay.style.display = 'none';
  csvPreviewData = null;
};

confirmPreview.onclick = async () => {
  previewOverlay.style.display = 'none';
  const data = csvPreviewData || [...tableBody.rows].map(r=>({
    item: r.querySelector('.m-item').value,
    bn:   r.querySelector('.m-bn').value,
    size: r.querySelector('.m-size').value,
    uom:  r.querySelector('.m-uom').value
  }));
  let added=0, dup=0, err=0;
  for (const d of data) {
    const res = await insertBmr(d);
    if (res.ok) added++;
    else if (res.dup) dup++;
    else err++;
  }
  await showAlert(`Added: ${added}\nDuplicates: ${dup}\nErrors: ${err}`);
  if (!csvPreviewData) multiClearBtn.onclick();
  else {
    csvFileInput.value = '';
    csvPreviewData = null;
  }
};

// — “Add All” click —
multiAddBtn.onclick = async () => {
  const data = [...tableBody.rows].map((r,i)=>({
    item: r.querySelector('.m-item').value.trim(),
    bn:   r.querySelector('.m-bn').value.trim(),
    size: r.querySelector('.m-size').value,
    uom:  r.querySelector('.m-uom').value
  }));
  for (let i=0;i<data.length;i++){
    const { item, bn, uom } = data[i];
    if (!item||!bn||!uom) {
      await showAlert(`Row ${i+1} is incomplete.`);
      return;
    }
  }
  csvPreviewData = null;
  previewTbody.innerHTML = data.map((d,i)=>`
    <tr>
      <td>${i+1}</td><td>${d.item}</td><td>${d.bn}</td>
      <td>${d.size||'–'}</td><td>${d.uom}</td>
    </tr>
  `).join('');
  previewOverlay.style.display = 'flex';
};

// — CSV upload —
uploadCsvBtn.onclick = async () => {
  const file = csvFileInput.files[0];
  if (!file) { await showAlert('Select a CSV first.'); return; }
  if (!await askConfirm(`Upload ${file.name}?`)) return;

  const text = await new Promise(r=>{
    const fr = new FileReader();
    fr.onload = e => r(e.target.result);
    fr.readAsText(file);
  });
  const lines = text.split(/\r?\n/).filter(l=>l.trim());
  const data  = lines.map((ln,i)=> {
    const [item,bn,size,uom] = ln.split(',').map(c=>c.trim());
    if (!item||!bn||!uom) throw new Error(`CSV row ${i+1} incomplete`);
    return {item,bn,size:parseFloat(size)||null,uom};
  });
  try {
    previewTbody.innerHTML = data.map((d,i)=>`
      <tr>
        <td>${i+1}</td><td>${d.item}</td><td>${d.bn}</td>
        <td>${d.size||'–'}</td><td>${d.uom}</td>
      </tr>
    `).join('');
    csvPreviewData = data;
    previewOverlay.style.display = 'flex';
  } catch(err) {
    await showAlert(err.message);
  }
};