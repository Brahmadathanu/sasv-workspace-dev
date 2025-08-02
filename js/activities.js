import { supabase } from '../public/shared/js/supabaseClient.js';

// DOM refs
const sectionFilter = document.getElementById('sectionFilter');
const subFilter     = document.getElementById('subFilter');
const areaFilter    = document.getElementById('areaFilter');
const nameFilter    = document.getElementById('nameFilter');
const clearBtn      = document.getElementById('clearFilters');
const homeIcon      = document.getElementById('homeIcon');

const existingTbody = document.querySelector('#existingTable tbody');
const multiBody     = document.querySelector('#multiTable tbody');
const multiAddBtn   = document.getElementById('multiAddBtn');
const multiClearBtn = document.getElementById('multiClearBtn');

// Dialog
const dlgOv  = document.getElementById('dialogOverlay');
const dlgMsg = document.getElementById('dialogMessage');
const btnYes = document.getElementById('btnYes');
const btnNo  = document.getElementById('btnNo');
const btnOk  = document.getElementById('btnOk');

// Cache
let sections = [];

// Helpers
function showAlert(msg) {
  return new Promise(res => {
    dlgMsg.textContent = msg;
    btnYes.style.display = 'none';
    btnNo.style.display  = 'none';
    btnOk.style.display  = 'inline-block';
    dlgOv.style.display  = 'flex';
    btnOk.focus();
    btnOk.onclick = () => { dlgOv.style.display = 'none'; res(); };
  });
}

function askConfirm(msg) {
  return new Promise(res => {
    dlgMsg.textContent = msg;
    btnYes.style.display = 'inline-block';
    btnNo.style.display  = 'inline-block';
    btnOk.style.display  = 'none';
    dlgOv.style.display  = 'flex';
    btnYes.onclick = () => { dlgOv.style.display = 'none'; res(true); };
    btnNo.onclick  = () => { dlgOv.style.display = 'none'; res(false); };
  });
}

function populate(sel, rows, vKey, tKey, placeholder) {
  sel.innerHTML = `<option value="">${placeholder}</option>`;
  rows.forEach(r => {
    const o = document.createElement('option');
    o.value = r[vKey];
    o.textContent = r[tKey];
    sel.appendChild(o);
  });
}

async function loadSections() {
  const { data, error } = await supabase
    .from('sections')
    .select('id,section_name')
    .order('section_name', { ascending:true });
  if (error) return console.error(error);
  sections = data;
  populate(sectionFilter, sections, 'id','section_name','Sections');
  // also populate every existing add-row .m-section
  multiBody.querySelectorAll('.m-section').forEach(sel =>
    populate(sel, sections, 'id','section_name','Select…')
  );
}

// Load sub-sections into any `<select>`
async function loadSub(selectEl, secId, placeholder) {
  selectEl.innerHTML = `<option value="">${placeholder}</option>`;
  selectEl.disabled = !secId;
  if (!secId) return;
  const { data, error } = await supabase
    .from('subsections')
    .select('id,subsection_name')
    .eq('section_id', secId)
    .order('subsection_name',{ ascending:true });
  if (error) return console.error(error);
  data.forEach(r => {
    const o = document.createElement('option');
    o.value = r.id;
    o.textContent = r.subsection_name;
    selectEl.appendChild(o);
  });
}

// Load areas
async function loadArea(selectEl, secId, subId, placeholder) {
  selectEl.innerHTML = `<option value="">${placeholder}</option>`;
  selectEl.disabled = !(secId && subId);
  if (!secId || !subId) return;
  const { data, error } = await supabase
    .from('areas')
    .select('id,area_name')
    .eq('section_id', secId)
    .eq('subsection_id', subId)
    .order('area_name',{ ascending:true });
  if (error) return console.error(error);
  data.forEach(r => {
    const o = document.createElement('option');
    o.value = r.id;
    o.textContent = r.area_name;
    selectEl.appendChild(o);
  });
}

// Render existing activities
async function renderExisting() {
  existingTbody.innerHTML = '';
  let q = supabase
    .from('activities')
    .select(`
      id,activity_name,duration_days,
      sections(section_name),subsections(subsection_name),areas(area_name),
      section_id,sub_section_id,area_id
    `)
    .order('id',{ ascending:false })
    .limit(10);

  if (sectionFilter.value) q = q.eq('section_id', sectionFilter.value);
  if (subFilter.value)     q = q.eq('sub_section_id', subFilter.value);
  if (areaFilter.value)    q = q.eq('area_id', areaFilter.value);
  if (nameFilter.value.trim()) {
    q = q.ilike('activity_name', `%${nameFilter.value.trim()}%`);
  }

  const { data, error } = await q;
  if (error) return console.error(error);

  existingTbody.innerHTML = data.map(r => `
    <tr data-id="${r.id}" data-sec="${r.section_id}"
        data-sub="${r.sub_section_id}" data-area="${r.area_id}">
      <td>${r.activity_name}</td>
      <td>${r.sections?.section_name||''}</td>
      <td>${r.subsections?.subsection_name||''}</td>
      <td>${r.areas?.area_name||''}</td>
      <td>${r.duration_days}</td>
      <td>
        <button class="action-link-btn edit-btn">Edit</button> |
        <button class="action-link-btn delete-btn">Delete</button>
      </td>
    </tr>
  `).join('');
}

// Inline edit
function startEdit(tr) {
  const id    = tr.dataset.id;
  const old   = tr.children[0].textContent;
  const secId = tr.dataset.sec;
  const subId = tr.dataset.sub;
  const areaId= tr.dataset.area;
  const dur   = tr.children[4].textContent;

  tr.innerHTML = `
    <td><input class="edit-input name-in" value="${old}"></td>
    <td><select class="edit-select sec-in"></select></td>
    <td><select class="edit-select sub-in" disabled></select></td>
    <td><select class="edit-select area-in" disabled></select></td>
    <td><input type="number" class="edit-number dur-in" min="0" value="${dur}"></td>
    <td>
      <button class="action-link-btn save-btn">Save</button> |
      <button class="action-link-btn cancel-btn">Cancel</button>
    </td>`;

  // populate the three selects
  const secSel  = tr.querySelector('.sec-in');
  const subSel  = tr.querySelector('.sub-in');
  const areaSel = tr.querySelector('.area-in');

  populate(secSel, sections, 'id','section_name','Select…');
  secSel.value = secId;
  secSel.onchange = async () => {
    await loadSub(subSel, secSel.value, 'Select…');
    areaSel.innerHTML = `<option value="">Select…</option>`;
    areaSel.disabled = true;
  };

  loadSub(subSel, secId, 'Select…').then(() => { subSel.value = subId; });
  subSel.onchange = async () => {
    await loadArea(areaSel, secSel.value, subSel.value, 'Select…');
  };

  loadArea(areaSel, secId, subId, 'Select…').then(() => { areaSel.value = areaId; });

  tr.querySelector('.save-btn').onclick   = () => saveEdit(tr, id);
  tr.querySelector('.cancel-btn').onclick = () => renderExisting();
}

async function saveEdit(tr, id) {
  const name = tr.querySelector('.name-in').value.trim();
  const sec  = tr.querySelector('.sec-in').value;
  const sub  = tr.querySelector('.sub-in').value;
  const area = tr.querySelector('.area-in').value;
  const dur  = parseInt(tr.querySelector('.dur-in').value, 10);

  if (!name||!sec||!sub||!area||isNaN(dur)) {
    return showAlert('All fields required');
  }
  if (!await askConfirm('Save changes?')) return;

  const { error } = await supabase
    .from('activities')
    .update({
      activity_name: name,
      section_id: sec,
      sub_section_id: sub,
      area_id: area,
      duration_days: dur
    })
    .eq('id', id);

  if (error) {
    console.error(error);
    return showAlert('Update failed');
  }
  renderExisting();
}

async function onDelete(ev) {
  const tr = ev.target.closest('tr');
  if (!await askConfirm('Delete this activity?')) return;
  const { error } = await supabase
    .from('activities')
    .delete()
    .eq('id', tr.dataset.id);
  if (error) {
    console.error(error);
    return showAlert('Delete failed');
  }
  renderExisting();
}

// Multi-row helpers
function bindRow(r) {
  r.querySelector('.row-add').onclick    = onRowAdd;
  r.querySelector('.row-remove').onclick = onRowRemove;
  const sec = r.querySelector('.m-section');
  const sub = r.querySelector('.m-sub');
  const ar  = r.querySelector('.m-area');
  sec.onchange = async () => {
    await loadSub(sub, sec.value, 'Select…');
    ar.innerHTML = `<option value="">Select…</option>`;
    ar.disabled = true;
  };
  sub.onchange = async () => {
    await loadArea(ar, sec.value, sub.value, 'Select…');
  };
}

function onRowAdd() {
  const rows = Array.from(multiBody.rows);
  for (let i=0; i<rows.length; i++) {
    const r = rows[i];
    if (!r.querySelector('.m-name').value.trim()
      || !r.querySelector('.m-section').value
      || !r.querySelector('.m-sub').value
      || !r.querySelector('.m-area').value
      || !r.querySelector('.m-dur').value) {
      return showAlert(`Row ${i+1} incomplete`);
    }
  }
  if (rows.length >= 10) return showAlert('Max 10 rows');
  const clone = rows[0].cloneNode(true);
  clone.querySelectorAll('input,select').forEach(i=>{
    if (i.classList.contains('m-name')) i.value = '';
    else if (i.classList.contains('m-dur')) i.value = '';
    else {
      i.selectedIndex = 0;
      i.disabled = i.classList.contains('m-sub')||i.classList.contains('m-area');
    }
  });
  bindRow(clone);
  multiBody.appendChild(clone);
  clone.querySelector('.m-name').focus();
}

function onRowRemove(e) {
  if (multiBody.rows.length > 1) {
    e.target.closest('tr').remove();
    multiBody.rows[0].querySelector('.m-name').focus();
  }
}

function clearMulti() {
  Array.from(multiBody.rows).slice(1).forEach(r=>r.remove());
  const f = multiBody.rows[0];
  f.querySelector('.m-name').value = '';
  f.querySelector('.m-section').selectedIndex = 0;
  f.querySelector('.m-sub').innerHTML = '<option value="">Select…</option>';
  f.querySelector('.m-sub').disabled = true;
  f.querySelector('.m-area').innerHTML = '<option value="">Select…</option>';
  f.querySelector('.m-area').disabled = true;
  f.querySelector('.m-dur').value = '';
  f.querySelector('.m-name').focus();
}

multiAddBtn.onclick = async () => {
  const rows = Array.from(multiBody.rows);
  const data = rows.map((r,i)=>({
    name: r.querySelector('.m-name').value.trim(),
    sec:  r.querySelector('.m-section').value,
    sub:  r.querySelector('.m-sub').value,
    area: r.querySelector('.m-area').value,
    dur:  parseInt(r.querySelector('.m-dur').value,10)
  }));
  for (let i=0;i<data.length;i++){
    const { name, sec, sub, area, dur } = data[i];
    if (!name||!sec||!sub||!area||isNaN(dur)) {
      return showAlert(`Row ${i+1} incomplete`);
    }
  }
  if (!await askConfirm(`Add ${data.length} activities?`)) return;
  let added=0, failed=0;
  for (const d of data) {
    const { error } = await supabase
      .from('activities')
      .insert([{
        activity_name:   d.name,
        section_id:      d.sec,
        sub_section_id:  d.sub,
        area_id:         d.area,
        duration_days:   d.dur
      }]);
    error ? failed++ : added++;
  }
  await showAlert(`Added: ${added}\nFailed: ${failed}`);
  clearMulti();
  renderExisting();
};

// Clear filters
clearBtn.onclick = () => {
  sectionFilter.value = '';
  subFilter.value     = '';
  areaFilter.value    = '';
  nameFilter.value    = '';
  subFilter.disabled = areaFilter.disabled = true;
  populate(subFilter,[], '','','Sub-sections');
  populate(areaFilter,[], '','','Areas');
  renderExisting();
};

// Handlers for existing table
existingTbody.onclick = ev => {
  const btn = ev.target.closest('button');
  if (!btn) return;
  const tr  = btn.closest('tr');
  if (btn.classList.contains('edit-btn'))   startEdit(tr);
  if (btn.classList.contains('delete-btn')) onDelete(ev);
};

// Home navigation
homeIcon.onclick = () => location.href = 'index.html';

// Initialize
window.addEventListener('DOMContentLoaded', async ()=>{
  await loadSections();
  bindRow(multiBody.rows[0]);
  renderExisting();

  // Filters cascade
  sectionFilter.onchange = async ()=>{
    await loadSub(subFilter, sectionFilter.value,'Sub-sections');
    areaFilter.innerHTML = '<option>Areas</option>';
    areaFilter.disabled = true;
    renderExisting();
  };
  subFilter.onchange = async ()=>{
    await loadArea(areaFilter, sectionFilter.value, subFilter.value,'Areas');
    renderExisting();
  };
  areaFilter.onchange = renderExisting;
  nameFilter.oninput   = renderExisting;

  multiClearBtn.onclick = clearMulti;
});