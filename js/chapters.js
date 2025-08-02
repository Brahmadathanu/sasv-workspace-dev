import { supabase } from '../public/shared/js/supabaseClient.js';

const textSelect        = document.getElementById('textSelect');
const clearTextBtn      = document.getElementById('clearText');
const chaptersTbody     = document.querySelector('#chaptersTable tbody');
const newChapterInput   = document.getElementById('newChapterInput');
const addBtn            = document.getElementById('addBtn');
const clearAddBtn       = document.getElementById('clearAddBtn');
const modalOverlay      = document.getElementById('modalOverlay');
const modalMessage      = document.getElementById('modalMessage');
const modalConfirm      = document.getElementById('modalConfirm');
const modalCancel       = document.getElementById('modalCancel');
const homeIcon          = document.getElementById('homeIcon');

let currentTextId   = null;
let pendingAction   = null; // { type:'add'|'delete'|'update', id?, name? }

/** Show in-page confirmation modal */
function showModal(message, confirmText='Confirm', cancelText='Cancel') {
  return new Promise(res => {
    modalMessage.textContent = message;
    modalConfirm.textContent = confirmText;
    modalCancel.textContent  = cancelText;
    modalOverlay.style.display = 'flex';

    function cleanup(ans) {
      modalOverlay.style.display = 'none';
      modalConfirm.removeEventListener('click', onOk);
      modalCancel.removeEventListener('click', onNo);
      res(ans);
    }
    function onOk()  { cleanup(true); }
    function onNo()  { cleanup(false); }

    modalConfirm.addEventListener('click', onOk);
    modalCancel .addEventListener('click', onNo);
  });
}

/** 1. Load publications dropdown */
async function loadPublications() {
  const { data, error } = await supabase
    .from('publication_details')
    .select('id, text_name')
    .order('text_name', { ascending: true });
  if (error) { console.error(error); return; }

  data.forEach(p => {
    const o = document.createElement('option');
    o.value = p.id;
    o.textContent = p.text_name;
    textSelect.appendChild(o);
  });
}

/** 2. Render chapters table */
async function renderChapters() {
  chaptersTbody.innerHTML = '';
  if (!currentTextId) return;

  const { data, error } = await supabase
    .from('text_chapters')
    .select('id, chapter_name')
    .eq('text_id', currentTextId)
    .order('chapter_name', { ascending: true });
  if (error) { console.error(error); return; }

  data.forEach(r => {
    const tr = document.createElement('tr');
    tr.dataset.id = r.id;
    tr.innerHTML = `
      <td class="chapter-cell">${r.chapter_name}</td>
      <td>
        <button class="action-link edit-btn">Edit</button> |
        <button class="action-link delete-btn">Delete</button>
      </td>`;
    chaptersTbody.appendChild(tr);
  });
}

/** 3. Clear publication filter */
clearTextBtn.addEventListener('click', () => {
  textSelect.value = '';
  currentTextId = null;
  renderChapters();
});

/** 4. Publication change */
textSelect.addEventListener('change', () => {
  currentTextId = textSelect.value;
  renderChapters();
});

/** 5. Add chapter */
addBtn.addEventListener('click', async () => {
  const name = newChapterInput.value.trim();
  if (!currentTextId || !name) return;

  pendingAction = { type:'add', name };
  if (await showModal(`Add chapter “${name}”?`)) {
    await supabase
      .from('text_chapters')
      .insert([{ text_id: currentTextId, chapter_name: name }]);
    newChapterInput.value = '';
    renderChapters();
  }
});

/** 6. Clear add field */
clearAddBtn.addEventListener('click', () => {
  newChapterInput.value = '';
});

/** 7. Inline Edit/Delete delegation */
chaptersTbody.addEventListener('click', async e => {
  const btn = e.target.closest('button');
  if (!btn) return;
  const tr = btn.closest('tr');
  const id = tr.dataset.id;
  const cell = tr.querySelector('.chapter-cell');
  const actionsTd = btn.closest('td');

  // EDIT → inline Save | Cancel
  if (btn.classList.contains('edit-btn')) {
    const oldName = cell.textContent;
    cell.innerHTML = `<input type="text" class="edit-input" value="${oldName}">`;
    actionsTd.innerHTML = `
      <button class="action-link save-btn">Save</button> |
      <button class="action-link cancel-btn">Cancel</button>
    `;
    return;
  }

  // SAVE inline → confirm update
  if (btn.classList.contains('save-btn')) {
    const newName = tr.querySelector('.edit-input').value.trim();
    if (!newName) return;
    pendingAction = { type:'update', id, name:newName };
    if (await showModal(`Change “${cell.textContent}” → “${newName}”?`)) {
      await supabase
        .from('text_chapters')
        .update({ chapter_name: newName })
        .eq('id', id);
      renderChapters();
    }
    return;
  }

  // CANCEL inline → revert
  if (btn.classList.contains('cancel-btn')) {
    renderChapters();
    return;
  }

  // DELETE → confirm delete
  if (btn.classList.contains('delete-btn')) {
    const name = cell.textContent;
    pendingAction = { type:'delete', id };
    if (await showModal(`Delete chapter “${name}”?`)) {
      await supabase
        .from('text_chapters')
        .delete()
        .eq('id', id);
      renderChapters();
    }
    return;
  }
});

/** 8. Home navigation */
homeIcon.addEventListener('click', () => {
  window.location.href = 'index.html';
});

/** Initialize */
window.addEventListener('DOMContentLoaded', async () => {
  await loadPublications();
  renderChapters();
});