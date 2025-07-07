// subsections.js
import { supabase } from './supabaseClient.js';

//
// 1) In-page confirm
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
    no .addEventListener('click', onNo);
  });
}

//
// 2) Load Sections
//
async function loadSections() {
  const { data: secs, error } = await supabase
    .from('sections')
    .select('id, section_name')
    .order('section_name', { ascending: true });

  if (error) {
    console.error(error);
    alert('Error loading sections');
    return;
  }

  const sel = document.getElementById('sectionSelect');
  sel.innerHTML = '<option value="">-- Select Section --</option>';
  secs.forEach(r => {
    const o = document.createElement('option');
    o.value = r.id;
    o.textContent = r.section_name;
    sel.appendChild(o);
  });
}

//
// 3) Render Sub-sections
//
async function renderSubsections() {
  const secId = document.getElementById('sectionSelect').value;
  const tbody = document.querySelector('#subsectionsTable tbody');

  if (!secId) {
    tbody.innerHTML = '';
    return;
  }

  const { data: subs, error } = await supabase
    .from('subsections')
    .select('id, subsection_name')
    .eq('section_id', secId)
    .order('id', { ascending: true });

  if (error) {
    console.error(error);
    alert('Error loading sub-sections');
    return;
  }

  tbody.innerHTML = subs.map(r => `
    <tr data-id="${r.id}">
      <td class="name-cell">${r.subsection_name}</td>
      <td>
        <button class="action-link edit-btn">Edit</button> |
        <button class="action-link delete-btn">Delete</button>
      </td>
    </tr>
  `).join('');

  document.querySelector('#addSubForm [name="subsection_name"]')?.focus();
}

//
// 4) Wire up
//
window.addEventListener('DOMContentLoaded', async () => {
  await loadSections();

  document.getElementById('sectionSelect')
    .addEventListener('change', renderSubsections);

  // ADD
  document.getElementById('addSubForm').addEventListener('submit', async e => {
    e.preventDefault();
    const secId = document.getElementById('sectionSelect').value;
    const inp   = e.target.subsection_name;
    const name  = inp.value.trim();

    if (!secId) {
      alert('Select a Section first.');
      return;
    }
    if (!name) {
      inp.focus();
      return;
    }
    if (!await showConfirm(`Add sub-section “${name}”?`)) {
      renderSubsections();
      return;
    }

    const { error } = await supabase
      .from('subsections')
      .insert([{ section_id: secId, subsection_name: name }]);

    if (error) {
      console.error(error);
      alert('Error adding sub-section');
    } else {
      inp.value = '';
      renderSubsections();
    }
  });

  // EDIT/DELETE
  document.querySelector('#subsectionsTable tbody')
    .addEventListener('click', async ev => {
      const btn = ev.target;
      const tr  = btn.closest('tr');
      if (!tr) return;
      const id   = tr.dataset.id;
      const oldN = tr.querySelector('.name-cell').textContent;

      // DELETE
      if (btn.classList.contains('delete-btn')) {
        if (!await showConfirm(`Delete sub-section “${oldN}”?`)) {
          renderSubsections();
          return;
        }
        const { error } = await supabase
          .from('subsections')
          .delete()
          .eq('id', id);

        if (error) {
          console.error(error);
          alert('Error deleting');
        } else {
          renderSubsections();
        }
        return;
      }

      // EDIT
      if (btn.classList.contains('edit-btn')) {
        tr.dataset.old = oldN;
        const td = tr.querySelector('.name-cell');
        td.innerHTML = `<input type="text" class="edit-input" value="${oldN}">`;
        td.querySelector('.edit-input').select();
        tr.children[1].innerHTML = `
          <button class="action-link save-btn">Save</button> |
          <button class="action-link cancel-btn">Cancel</button>
        `;
        return;
      }

      // SAVE
      if (btn.classList.contains('save-btn')) {
        const newN = tr.querySelector('.edit-input').value.trim();
        const oldVN = tr.dataset.old;
        if (!newN) {
          tr.querySelector('.edit-input').focus();
          return;
        }
        if (!await showConfirm(`Change “${oldVN}” → “${newN}”?`)) {
          renderSubsections();
          return;
        }
        const { error } = await supabase
          .from('subsections')
          .update({ subsection_name: newN })
          .eq('id', id);

        if (error) {
          console.error(error);
          alert('Error updating');
        } else {
          renderSubsections();
        }
        return;
      }

      // CANCEL
      if (btn.classList.contains('cancel-btn')) {
        renderSubsections();
        return;
      }
    });

  // NAV: only home
  document.getElementById('homeIcon').onclick = () => {
    window.location.href = 'index.html';
  };
});