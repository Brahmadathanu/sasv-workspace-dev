// js/sections.js
import { supabase } from '../public/shared/js/supabaseClient.js';

// In-page confirm dialog
function showConfirm(message) {
  return new Promise(resolve => {
    const overlay = document.getElementById('confirmOverlay');
    const msgEl   = document.getElementById('confirmMessage');
    const yesBtn  = document.getElementById('confirmYes');
    const noBtn   = document.getElementById('confirmNo');

    msgEl.textContent = message;
    overlay.style.display = 'flex';
    yesBtn.focus();

    function cleanup() {
      overlay.style.display = 'none';
      yesBtn.removeEventListener('click', onYes);
      noBtn.removeEventListener('click', onNo);
    }
    function onYes() { cleanup(); resolve(true); }
    function onNo()  { cleanup(); resolve(false); }

    yesBtn.addEventListener('click', onYes);
    noBtn.addEventListener('click', onNo);
  });
}

// Render table
async function renderTable() {
  const { data: rows, error } = await supabase
    .from('sections')
    .select('id, section_name')
    .order('id', { ascending: true });
  if (error) {
    console.error('Error loading sections:', error);
    return;
  }

  const tbody = document.querySelector('#sectionsTable tbody');
  tbody.innerHTML = rows.map(r => `
    <tr data-id="${r.id}">
      <td class="name-cell">${r.section_name}</td>
      <td>
        <button class="action-link edit-btn">Edit</button> |
        <button class="action-link delete-btn">Delete</button>
      </td>
    </tr>
  `).join('');
}

// Initial load
window.addEventListener('DOMContentLoaded', () => {
  renderTable();

  // ADD
  document.getElementById('addSectionForm').addEventListener('submit', async e => {
    e.preventDefault();
    const inp  = e.target.section_name;
    const name = inp.value.trim();
    if (!name) {
      inp.focus();
      return;
    }
    if (!await showConfirm(`Add section “${name}”?`)) {
      renderTable();
      return;
    }
    const { error } = await supabase
      .from('sections')
      .insert([{ section_name: name }]);
    if (error) console.error('Insert error:', error);
    inp.value = '';
    renderTable();
  });

  // EDIT / DELETE / SAVE / CANCEL
  document.querySelector('#sectionsTable tbody').addEventListener('click', async e => {
    const btn = e.target;
    const tr  = btn.closest('tr');
    if (!tr) return;
    const id      = tr.dataset.id;
    const section = tr.querySelector('.name-cell').textContent;

    // DELETE
    if (btn.classList.contains('delete-btn')) {
      if (!await showConfirm(`Delete section “${section}”?`)) {
        renderTable();
        return;
      }
      await supabase.from('sections').delete().eq('id', id);
      renderTable();
      return;
    }

    // EDIT
    if (btn.classList.contains('edit-btn')) {
      tr.dataset.old = section;
      const td = tr.querySelector('.name-cell');
      td.innerHTML = `<input type="text" class="edit-input" value="${section}">`;
      td.querySelector('.edit-input').select();
      tr.children[1].innerHTML = `
        <button class="action-link save-btn">Save</button> |
        <button class="action-link cancel-btn">Cancel</button>
      `;
      return;
    }

    // SAVE
    if (btn.classList.contains('save-btn')) {
      const newName = tr.querySelector('.edit-input').value.trim();
      const oldName = tr.dataset.old;
      if (!newName) {
        tr.querySelector('.edit-input').focus();
        return;
      }
      if (!await showConfirm(`Change “${oldName}” → “${newName}”?`)) {
        renderTable();
        return;
      }
      await supabase
        .from('sections')
        .update({ section_name: newName })
        .eq('id', id);
      renderTable();
      return;
    }

    // CANCEL
    if (btn.classList.contains('cancel-btn')) {
      renderTable();
      return;
    }
  });

  // HOME navigation
  document.getElementById('homeIcon').onclick = () => {
    window.location.href = 'index.html';
  };
});