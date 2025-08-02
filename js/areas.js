import { supabase } from '../public/shared/js/supabaseClient.js';

//
// 1) In-page confirmation dialog
//
function showConfirm(msg) {
  return new Promise(resolve => {
    const ov  = document.getElementById('confirmOverlay');
    const txt = document.getElementById('confirmMessage');
    const yes = document.getElementById('confirmYes');
    const no  = document.getElementById('confirmNo');
    txt.textContent = msg;
    ov.style.display = 'flex';
    yes.focus();

    function clean() {
      ov.style.display = 'none';
      yes.removeEventListener('click', onYes);
      no.removeEventListener('click', onNo);
    }
    function onYes() { clean(); resolve(true); }
    function onNo()  { clean(); resolve(false); }

    yes.addEventListener('click', onYes);
    no.addEventListener('click', onNo);
  });
}

//
// 2) Helper to populate a <select>
//
function populate(sel, rows, vKey, tKey, placeholder) {
  sel.innerHTML = `<option value="">${placeholder}</option>`;
  rows.forEach(r => {
    const o = document.createElement('option');
    o.value = r[vKey];
    o.textContent = r[tKey];
    sel.appendChild(o);
  });
}

//
// 3) Load Sections dropdown
//
async function loadSections() {
  const { data: secs, error } = await supabase
    .from('sections')
    .select('id, section_name')
    .order('section_name', { ascending: true });

  if (error) {
    console.error('Error loading sections:', error);
    alert('Failed to load sections');
    return;
  }
  populate(
    document.getElementById('sectionSelect'),
    secs,
    'id',
    'section_name',
    '-- Select Section --'
  );
}

//
// 4) Load Sub-sections based on chosen Section
//
async function loadSubsections(sectionId) {
  const subSel = document.getElementById('subSectionSelect');

  if (!sectionId) {
    subSel.disabled = true;
    populate(subSel, [], 'id', 'subsection_name', '-- Select Sub-section --');
    return;
  }

  const { data: subs, error } = await supabase
    .from('subsections')
    .select('id, subsection_name')
    .eq('section_id', sectionId)
    .order('subsection_name', { ascending: true });

  if (error) {
    console.error('Error loading sub-sections:', error);
    alert('Failed to load sub-sections');
    subSel.disabled = true;
    return;
  }

  if (!subs.length) {
    subSel.disabled = true;
    populate(subSel, [], 'id', 'subsection_name', '-- Select Sub-section --');
    return;
  }

  subSel.disabled = false;
  populate(subSel, subs, 'id', 'subsection_name', '-- Select Sub-section --');
}

//
// 5) Render the areas table
//
async function renderAreas() {
  const secId  = document.getElementById('sectionSelect').value;
  const subSel = document.getElementById('subSectionSelect');
  const subId  = subSel.disabled ? null : subSel.value;
  const tbody  = document.querySelector('#areasTable tbody');

  if (!secId || (!subSel.disabled && !subId)) {
    tbody.innerHTML = '';
    return;
  }

  let query = supabase
    .from('areas')
    .select('id, area_name')
    .eq('section_id', secId);

  if (subSel.disabled) {
    query = query.is('subsection_id', null);
  } else {
    query = query.eq('subsection_id', subId);
  }

  const { data: rows, error } = await query.order('id', { ascending: true });

  if (error) {
    console.error('Error loading areas:', error);
    alert('Failed to load areas');
    return;
  }

  tbody.innerHTML = rows.map(r => `
    <tr data-id="${r.id}">
      <td class="name-cell">${r.area_name}</td>
      <td>
        <button class="action-link edit-btn">Edit</button> |
        <button class="action-link delete-btn">Delete</button>
      </td>
    </tr>
  `).join('');
}

//
// 6) Wire up event handlers
//
window.addEventListener('DOMContentLoaded', async () => {
  await loadSections();

  document.getElementById('sectionSelect')
    .addEventListener('change', async e => {
      await loadSubsections(e.target.value);
      renderAreas();
    });

  document.getElementById('subSectionSelect')
    .addEventListener('change', renderAreas);

  // ADD new area
  document.getElementById('addAreaForm')
    .addEventListener('submit', async e => {
      e.preventDefault();
      const secId  = document.getElementById('sectionSelect').value;
      const subSel = document.getElementById('subSectionSelect');
      const subId  = subSel.disabled ? null : subSel.value;
      const inp    = e.target.area_name;
      const name   = inp.value.trim();

      if (!secId || (!subSel.disabled && !subId)) {
        alert('Please select Section and Sub-section (if enabled).');
        return;
      }
      if (!name) {
        inp.focus();
        return;
      }
      if (!await showConfirm(`Add area “${name}”?`)) {
        renderAreas();
        return;
      }

      const { error } = await supabase
        .from('areas')
        .insert([{ section_id: secId, subsection_id: subId, area_name: name }]);

      if (error) {
        console.error('Error adding area:', error);
        alert('Add failed');
      } else {
        inp.value = '';
        renderAreas();
      }
    });

  // EDIT / DELETE delegation
  document.querySelector('#areasTable tbody')
    .addEventListener('click', async ev => {
      const btn = ev.target;
      const tr  = btn.closest('tr');
      if (!tr) return;
      const id   = tr.dataset.id;
      const oldN = tr.querySelector('.name-cell').textContent;

      // DELETE
      if (btn.classList.contains('delete-btn')) {
        if (!await showConfirm(`Delete area “${oldN}”?`)) {
          renderAreas();
          return;
        }
        const { error } = await supabase.from('areas').delete().eq('id', id);
        if (error) {
          console.error('Error deleting area:', error);
          alert('Delete failed');
        } else {
          renderAreas();
        }
        return;
      }

      // EDIT → swap in an <input> + Save/Cancel
      if (btn.classList.contains('edit-btn')) {
        tr.dataset.old = oldN;
        const td = tr.querySelector('.name-cell');
        td.innerHTML = `<input type="text" class="edit-input" value="${oldN}">`;
        tr.children[1].innerHTML = `
          <button class="action-link save-btn">Save</button> |
          <button class="action-link cancel-btn">Cancel</button>
        `;
        td.querySelector('.edit-input').select();
        return;
      }

      // SAVE
      if (btn.classList.contains('save-btn')) {
        const newN = tr.querySelector('.edit-input').value.trim();
        const oldName = tr.dataset.old;
        if (!newN) {
          tr.querySelector('.edit-input').focus();
          return;
        }
        if (!await showConfirm(`Change “${oldName}” → “${newN}”?`)) {
          renderAreas();
          return;
        }
        const { error } = await supabase
          .from('areas')
          .update({ area_name: newN })
          .eq('id', id);
        if (error) {
          console.error('Error updating area:', error);
          alert('Update failed');
        } else {
          renderAreas();
        }
        return;
      }

      // CANCEL edit
      if (btn.classList.contains('cancel-btn')) {
        renderAreas();
        return;
      }
    });

  // HOME navigation
  document.getElementById('homeIcon').onclick = () => {
    window.location.href = 'index.html';
  };
});