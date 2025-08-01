import { supabase } from '../shared/js/supabaseClient.js';

// DOM elements
const addNewBtn   = document.getElementById('addNewBtn');
const homeIcon    = document.getElementById('homeIcon');
const searchInput = document.getElementById('searchInput');
const pubList     = document.getElementById('pubList');

const textName    = document.getElementById('textName');
const publisher   = document.getElementById('publisher');
const commentator = document.getElementById('commentator');
const yearPub     = document.getElementById('yearPub');
const saveBtn     = document.getElementById('saveBtn');
const deleteBtn   = document.getElementById('deleteBtn');
const pubForm     = document.getElementById('pubForm');

const modalOverlay = document.getElementById('modalOverlay');
const modalMessage = document.getElementById('modalMessage');
const modalConfirm = document.getElementById('modalConfirm');
const modalCancel  = document.getElementById('modalCancel');

let allPubs       = [];
let filteredPubs  = [];
let selectedId    = null;
let unsaved       = false;

// In-page modal
function showModal(msg, okTxt = 'OK', cancelTxt = 'Cancel') {
  return new Promise(res => {
    modalMessage.textContent = msg;
    modalConfirm.textContent = okTxt;
    modalCancel.textContent  = cancelTxt;
    modalOverlay.style.display = 'flex';

    function cleanup(answer) {
      modalOverlay.style.display = 'none';
      modalConfirm.removeEventListener('click', onOk);
      modalCancel .removeEventListener('click', onCancel);
      res(answer);
    }
    function onOk()    { cleanup(true); }
    function onCancel(){ cleanup(false); }

    modalConfirm.addEventListener('click', onOk);
    modalCancel .addEventListener('click', onCancel);
  });
}

// Load & filter list
async function loadPublications() {
  const { data, error } = await supabase
    .from('publication_details')
    .select('id, text_name')
    .order('text_name', { ascending: true });
  if (error) return console.error(error);

  allPubs = data;
  applyFilter();
}

function applyFilter() {
  const term = searchInput.value.trim().toLowerCase();
  filteredPubs = allPubs.filter(p =>
    p.text_name.toLowerCase().includes(term)
  );
  pubList.innerHTML = filteredPubs.map(p =>
    `<li data-id="${p.id}"${p.id===selectedId?' class="selected"':''}>${p.text_name}</li>`
  ).join('');
}

// Render form (new or existing)
async function loadForm(id) {
  // If switching away with unsaved changes...
  if (unsaved && id !== selectedId) {
    const ok = await showModal('Discard unsaved changes?', 'Discard', 'Cancel');
    if (!ok) return;
  }

  selectedId = id;
  unsaved = false;
  deleteBtn.disabled = !id;

  // Disable Save until change
  saveBtn.disabled = true;

  if (!id) {
    pubForm.reset();
    textName.focus();
    return;
  }

  const { data: row, error } = await supabase
    .from('publication_details')
    .select('text_name, publisher, commentator, year_of_publication')
    .eq('id', id)
    .single();
  if (error) return console.error(error);

  textName.value    = row.text_name;
  publisher.value   = row.publisher;
  commentator.value = row.commentator;
  yearPub.value     = row.year_of_publication;
}

// Save (insert/update)
pubForm.addEventListener('submit', async e => {
  e.preventDefault();

  const t = textName.value.trim();
  const p = publisher.value.trim();
  const c = commentator.value.trim();
  const y = yearPub.value;

  if (!t || !p || !c || !y) {
    return showModal('All fields are required', 'OK', '');
  }

  const preview = [
    `Save this publication?`, ``,
    `• Text:        ${t}`,
    `• Publisher:   ${p}`,
    `• Commentator: ${c}`,
    `• Year:        ${y}`
  ].join('\n');

  if (!(await showModal(preview, 'Save', 'Cancel'))) return;

  if (selectedId) {
    const { error } = await supabase
      .from('publication_details')
      .update({
        text_name:           t,
        publisher:           p,
        commentator:         c,
        year_of_publication: y
      })
      .eq('id', selectedId);
    if (error) return console.error(error);
  } else {
    const { error } = await supabase
      .from('publication_details')
      .insert([{
        text_name:           t,
        publisher:           p,
        commentator:         c,
        year_of_publication: y
      }]);
    if (error) return console.error(error);
  }

  await loadPublications();
  loadForm(null);
});

// Delete
deleteBtn.addEventListener('click', async () => {
  if (!selectedId) return;
  if (!(await showModal('Delete this publication?', 'Delete', 'Cancel'))) return;

  const { error } = await supabase
    .from('publication_details')
    .delete()
    .eq('id', selectedId);
  if (error) return console.error(error);

  await loadPublications();
  loadForm(null);
});

// New
addNewBtn.addEventListener('click', () => loadForm(null));

// Sidebar selection
pubList.addEventListener('click', e => {
  const li = e.target.closest('li');
  if (!li) return;
  loadForm(Number(li.dataset.id));
  selectedId = Number(li.dataset.id);
  applyFilter();
});

// Search
searchInput.addEventListener('input', applyFilter);

// Track unsaved changes & enable Save
[textName, publisher, commentator, yearPub].forEach(el =>
  el.addEventListener('input', () => {
    unsaved = true;
    saveBtn.disabled = false;
  })
);

// Protect Home
homeIcon.addEventListener('click', async () => {
  if (unsaved) {
    if (!(await showModal('Discard unsaved changes?', 'Yes', 'No'))) return;
  }
  window.location.href = 'index.html';
});

// Init
window.addEventListener('DOMContentLoaded', async () => {
  await loadPublications();
  loadForm(null);
});