// js/plants.js
import { supabase } from '../shared/js/supabaseClient.js';

// — Dialog helpers —
const dialogOverlay   = document.getElementById('dialogOverlay');
const dialogMsg       = document.getElementById('dialogMessage');
const btnYes          = document.getElementById('btnYes');
const btnNo           = document.getElementById('btnNo');
const btnOk           = document.getElementById('btnOk');

function showAlert(msg) {
  return new Promise(resolve => {
    dialogMsg.textContent       = msg;
    btnYes.style.display        = 'none';
    btnNo.style.display         = 'none';
    btnOk.style.display         = 'inline-block';
    dialogOverlay.style.display = 'flex';
    btnOk.focus();
    btnOk.onclick = () => {
      dialogOverlay.style.display = 'none';
      resolve();
    };
  });
}

function askConfirm(msg) {
  return new Promise(resolve => {
    dialogMsg.textContent       = msg;
    btnYes.style.display        = 'inline-block';
    btnNo.style.display         = 'inline-block';
    btnOk.style.display         = 'none';
    dialogOverlay.style.display = 'flex';
    btnYes.onclick = () => { dialogOverlay.style.display='none'; resolve(true); };
    btnNo.onclick  = () => { dialogOverlay.style.display='none'; resolve(false); };
  });
}

// — Preview modal —
const previewOverlay = document.getElementById('previewOverlay');
const previewTbody   = document.querySelector('#previewTable tbody');
const previewCancel  = document.getElementById('previewCancel');
const previewConfirm = document.getElementById('previewConfirm');

previewCancel.onclick = () => previewOverlay.style.display = 'none';
previewConfirm.onclick = async () => {
  previewOverlay.style.display = 'none';
  let added = 0, failed = 0;

  for (const row of [...multiBody.rows]) {
    const name   = row.querySelector('.m-name').value.trim();
    const typeId = row.querySelector('.m-type').value;
    const status = row.querySelector('.m-status').value;

    const { error } = await supabase
      .from('plant_machinery')
      .insert([{
        section_id:    sectionSelect.value,
        subsection_id: subSectionSelect.value,
        area_id:       areaSelect.value,
        type_id:       typeId,
        plant_name:    name,
        status:        status
      }]);

    error ? failed++ : added++;
  }

  await showAlert(`Added: ${added}\nFailed: ${failed}`);
  clearMulti();
  await renderPlants();
};

// — DOM refs —
const homeIcon         = document.getElementById('homeIcon');
const sectionSelect    = document.getElementById('sectionSelect');
const subSectionSelect = document.getElementById('subSectionSelect');
const areaSelect       = document.getElementById('areaSelect');
const typeSelect       = document.getElementById('typeSelect');
const clearFiltersBtn  = document.getElementById('clearFilters');
const plantsTbody      = document.querySelector('#plantsTable tbody');

const multiBody       = document.querySelector('#multiPlantTable tbody');
const multiAddBtn     = document.getElementById('multiAddBtn');
const multiClearBtn   = document.getElementById('multiClearBtn');

// — Type dropdown state —
let typeMap = {};
let typeOptionsHtml = '<option value="">-- Type --</option>';

// — Load machine types —
async function loadTypes() {
  const { data, error } = await supabase
    .from('machine_types')
    .select('id,name')
    .order('name', { ascending: true });

  if (error) {
    console.error('loadTypes error:', error);
    await showAlert('Failed to load Types:\n' + error.message);
    return;
  }

  typeMap = {};
  typeOptionsHtml = '<option value="">-- Type --</option>';
  data.forEach(t => {
    typeMap[t.id] = t.name;
    typeOptionsHtml += `<option value="${t.id}">${t.name}</option>`;
  });

  typeSelect.innerHTML = typeOptionsHtml;
  document.querySelectorAll('.m-type').forEach(sel => {
    sel.innerHTML = typeOptionsHtml;
  });
}

// — Load sections/subsections/areas —
async function loadSections() {
  const { data, error } = await supabase
    .from('sections')
    .select('id,section_name')
    .order('section_name', { ascending: true });
  if (error) return console.error('loadSections error:', error);
  data.forEach(r => {
    const o = document.createElement('option');
    o.value = r.id; o.textContent = r.section_name;
    sectionSelect.appendChild(o);
  });
}

async function loadSubsections(secId) {
  subSectionSelect.innerHTML = '<option value="">-- Sub-section --</option>';
  subSectionSelect.disabled  = !secId;
  areaSelect.innerHTML       = '<option value="">-- Area --</option>';
  areaSelect.disabled        = true;
  if (!secId) return;
  const { data, error } = await supabase
    .from('subsections')
    .select('id,subsection_name')
    .eq('section_id', secId)
    .order('subsection_name', { ascending: true });
  if (error) console.error('loadSubsections error:', error);
  else data.forEach(r => {
    const o = document.createElement('option');
    o.value = r.id; o.textContent = r.subsection_name;
    subSectionSelect.appendChild(o);
  });
}

async function loadAreas(secId, subId) {
  areaSelect.innerHTML = '<option value="">-- Area --</option>';
  areaSelect.disabled  = !(secId && subId);
  if (!secId || !subId) return;
  const { data, error } = await supabase
    .from('areas')
    .select('id,area_name')
    .eq('section_id', secId)
    .eq('subsection_id', subId)
    .order('area_name', { ascending: true });
  if (error) console.error('loadAreas error:', error);
  else data.forEach(r => {
    const o = document.createElement('option');
    o.value = r.id; o.textContent = r.area_name;
    areaSelect.appendChild(o);
  });
}

// — Render existing Plant/Machinery —
async function renderPlants() {
  plantsTbody.innerHTML = '';

  let q = supabase
    .from('plant_machinery')
    .select('id,plant_name,type_id,status');

  if (sectionSelect.value)    q = q.eq('section_id', sectionSelect.value);
  if (subSectionSelect.value) q = q.eq('subsection_id', subSectionSelect.value);
  if (areaSelect.value)       q = q.eq('area_id', areaSelect.value);
  if (typeSelect.value)       q = q.eq('type_id', typeSelect.value);

  const anyFilter = sectionSelect.value || subSectionSelect.value || areaSelect.value || typeSelect.value;

  if (!anyFilter) {
    q = q.order('id', { ascending: false }).limit(10);
  } else {
    q = q.order('plant_name', { ascending: true });
  }

  const { data, error } = await q;
  if (error) return console.error('renderPlants error:', error);

  const rows = anyFilter
    ? data.sort((a, b) =>
        a.plant_name.localeCompare(b.plant_name, undefined, {
          numeric: true,
          sensitivity: 'base'
        })
      )
    : data;

  plantsTbody.innerHTML = rows.map(r => {
    const typeName = typeMap[r.type_id] || '';
    return `
      <tr data-id="${r.id}" data-type-id="${r.type_id}">
        <td>${r.plant_name}</td>
        <td>${typeName}</td>
        <td>${r.status === 'O' ? 'Operational' : 'Non-operational'}</td>
        <td>
          <button class="action-link edit-btn">Edit</button> |
          <button class="action-link delete-btn">Delete</button>
        </td>
      </tr>
    `;
  }).join('');
}

// — Clear filters —
function clearFilters() {
  sectionSelect.value        = '';
  subSectionSelect.innerHTML = '<option value="">-- Sub-section --</option>';
  subSectionSelect.disabled  = true;
  areaSelect.innerHTML       = '<option value="">-- Area --</option>';
  areaSelect.disabled        = true;
  typeSelect.value           = '';
  renderPlants();
}

// — Inline edit/save/cancel —
function startEdit(tr) {
  const oldName   = tr.children[0].textContent;
  const oldTypeId = tr.dataset.typeId;
  const oldStat   = tr.children[2].textContent === 'Operational' ? 'O' : 'N';

  tr.dataset.oldName = oldName;
  tr.dataset.oldType = oldTypeId;
  tr.dataset.oldStat = oldStat;

  tr.children[0].innerHTML = `<input class="edit-input" value="${oldName}">`;
  tr.children[1].innerHTML = `<select class="edit-type">${typeOptionsHtml}</select>`;
  tr.querySelector('.edit-type').value = oldTypeId;
  tr.children[2].innerHTML = `
    <select class="edit-status">
      <option value="O"${oldStat==='O'?' selected':''}>Operational</option>
      <option value="N"${oldStat==='N'?' selected':''}>Non-operational</option>
    </select>`;
  tr.children[3].innerHTML = `
    <button class="action-link save-btn">Save</button> |
    <button class="action-link cancel-btn">Cancel</button>`;
}

async function saveEdit(tr) {
  const id      = tr.dataset.id;
  const oldName = tr.dataset.oldName;
  const oldType = tr.dataset.oldType;
  const oldStat = tr.dataset.oldStat;

  const newName = tr.querySelector('.edit-input').value.trim();
  const newType = tr.querySelector('.edit-type').value;
  const newStat = tr.querySelector('.edit-status').value;

  if (!newName) { await showAlert('Name cannot be empty.'); return; }
  if (!newType) { await showAlert('Type cannot be empty.'); return; }

  if (newName===oldName && newType===oldType && newStat===oldStat) {
    return renderPlants();
  }

  if (!await askConfirm(`Change "${oldName}" → "${newName}"?`)) {
    return renderPlants();
  }

  const { error } = await supabase
    .from('plant_machinery')
    .update({ plant_name: newName, type_id: newType, status: newStat })
    .eq('id', id);

  if (error) {
    console.error(error);
    await showAlert('Update failed.');
  }
  renderPlants();
}

// — Multi-add helpers —
function bindRow(r) {
  r.querySelector('.row-add').onclick    = onRowAdd;
  r.querySelector('.row-remove').onclick = onRowRemove;
}

function onRowAdd(e) {
  const rows = [...multiBody.rows];
  for (let i = 0; i < rows.length; i++) {
    const n = rows[i].querySelector('.m-name').value.trim();
    const t = rows[i].querySelector('.m-type').value;
    const s = rows[i].querySelector('.m-status').value;
    if (!n || !t || !s) {
      showAlert(`Row ${i+1} incomplete.`);
      return;
    }
  }
  if (rows.length >= 10) {
    showAlert('Maximum 10 rows.');
    return;
  }
  const clone = rows[0].cloneNode(true);
  clone.querySelector('.m-name').value = '';
  clone.querySelector('.m-type').innerHTML = typeOptionsHtml;
  clone.querySelector('.m-status').selectedIndex = 0;
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
  const f = multiBody.rows[0];
  f.querySelector('.m-name').value = '';
  f.querySelector('.m-type').innerHTML = typeOptionsHtml;
  f.querySelector('.m-status').selectedIndex = 0;
  f.querySelector('.m-name').focus();
}

// — Initialization —
window.addEventListener('DOMContentLoaded', async () => {
  await loadSections();
  await loadTypes();
  await renderPlants();

  sectionSelect.onchange    = async e => {
    await loadSubsections(e.target.value);
    await renderPlants();
  };
  subSectionSelect.onchange = async e => {
    await loadAreas(sectionSelect.value, e.target.value);
    await renderPlants();
  };
  areaSelect.onchange       = async () => {
    await renderPlants();
  };
  typeSelect.onchange       = () => renderPlants();
  clearFiltersBtn.onclick   = clearFilters;

  plantsTbody.onclick = async e => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const tr = btn.closest('tr');
    if (btn.classList.contains('delete-btn')) {
      if (await askConfirm(`Delete "${tr.children[0].textContent}"?`)) {
        await supabase.from('plant_machinery').delete().eq('id', tr.dataset.id);
        renderPlants();
      }
    }
    if (btn.classList.contains('edit-btn'))   startEdit(tr);
    if (btn.classList.contains('save-btn'))   saveEdit(tr);
    if (btn.classList.contains('cancel-btn')) renderPlants();
  };

  homeIcon.onclick = async () => {
    if (await askConfirm('Discard changes and return home?')) {
      window.location.href = 'index.html';
    }
  };

  bindRow(multiBody.rows[0]);
  multiAddBtn.onclick   = () => {
    const data = [...multiBody.rows].map((r,i) => ({
      name:     r.querySelector('.m-name').value.trim(),
      typeId:   r.querySelector('.m-type').value,
      typeName: r.querySelector('.m-type').selectedOptions[0].textContent,
      status:   r.querySelector('.m-status').value
    }));
    for (let i=0; i<data.length; i++) {
      if (!data[i].name || !data[i].typeId || !data[i].status) {
        showAlert(`Row ${i+1} incomplete.`);
        return;
      }
    }
    previewTbody.innerHTML = data.map((d,i) => `
      <tr>
        <td>${i+1}</td>
        <td>${d.name}</td>
        <td>${d.typeName}</td>
        <td>${d.status==='O'?'Operational':'Non-operational'}</td>
      </tr>
    `).join('');
    previewOverlay.style.display = 'flex';
  };
  multiClearBtn.onclick = clearMulti;
});