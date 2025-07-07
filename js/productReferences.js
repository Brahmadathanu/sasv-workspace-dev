// ES module using Supabase
import { supabase } from './supabaseClient.js';

// DOM refs
const addNewBtn           = document.getElementById('addNewBtn');
const homeIcon            = document.getElementById('homeIcon');
const searchInput         = document.getElementById('searchInput');
const productList         = document.getElementById('productList');
const selectedProductName = document.getElementById('selectedProductName');

const refsTableBody       = document.querySelector('#refsTable tbody');
const refForm             = document.getElementById('refForm');
const textSelect          = document.getElementById('textSelect');
const chapterSelect       = document.getElementById('chapterSelect');
const pnInput             = document.getElementById('pnInput');
const natureSelect        = document.getElementById('natureSelect');
const saveBtn             = document.getElementById('saveBtn');
const deleteBtn           = document.getElementById('deleteBtn');

const modalOverlay        = document.getElementById('modalOverlay');
const modalMessage        = document.getElementById('modalMessage');
const modalConfirm        = document.getElementById('modalConfirm');
const modalCancel         = document.getElementById('modalCancel');

let allProducts   = [];
let filtered      = [];
let selectedProd  = null;
let selectedRef   = null;
let lastRefsData  = [];
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
      modalCancel.removeEventListener('click', onCancel);
      res(answer);
    }
    function onOk()    { cleanup(true); }
    function onCancel(){ cleanup(false); }
    modalConfirm.addEventListener('click', onOk);
    modalCancel.addEventListener('click', onCancel);
  });
}

// Mark form dirty & enable Save
function markDirty() {
  if (!unsaved) {
    unsaved = true;
    saveBtn.disabled = false;
  }
}

// Load texts & cascade chapters
async function loadTexts() {
  const { data, error } = await supabase
    .from('publication_details')
    .select('id, text_name')
    .order('text_name', { ascending: true });
  if (error) return console.error(error);

  textSelect.innerHTML = '<option value="">-- Select Text --</option>';
  data.forEach(r => textSelect.add(new Option(r.text_name, r.id)));
  textSelect.addEventListener('change', () => loadChapters(textSelect.value));
}

async function loadChapters(textId) {
  chapterSelect.innerHTML = '<option value="">-- Select Chapter --</option>';
  if (!textId) return;
  const { data, error } = await supabase
    .from('text_chapters')
    .select('chapter_name')
    .eq('text_id', textId)
    .order('chapter_name', { ascending: true });
  if (error) return console.error(error);
  data.forEach(r => chapterSelect.add(new Option(r.chapter_name, r.chapter_name)));
}

// Load & filter products
async function loadProducts() {
  const { data, error } = await supabase
    .from('products')
    .select('id, item')
    .order('item', { ascending: true });
  if (error) return console.error(error);
  allProducts = data;
  applyFilter();
}

function applyFilter() {
  const term = searchInput.value.trim().toLowerCase();
  filtered = allProducts.filter(p =>
    p.item.toLowerCase().includes(term)
  );
  productList.innerHTML = filtered.map(p =>
    `<li data-id="${p.id}"${p.id===selectedProd?' class="selected"':''}>${p.item}</li>`
  ).join('');
}

// Render references, store them
async function renderRefs() {
  refsTableBody.innerHTML = '';
  if (!selectedProd) {
    selectedProductName.textContent = '—';
    lastRefsData = [];
    return;
  }
  selectedProductName.textContent = allProducts.find(p => p.id === selectedProd).item;

  const { data, error } = await supabase
    .from('product_references')
    .select(`
      id,
      pn,
      chapter,
      reference_nature,
      publication_details(text_name)
    `)
    .eq('product_id', selectedProd)
    .order('text_name', { foreignTable: 'publication_details', ascending: true });
  if (error) return console.error(error);

  lastRefsData = data;
  data.forEach(r => {
    const txt = r.publication_details?.text_name || '';
    const tr = document.createElement('tr');
    tr.dataset.id = r.id;
    tr.classList.add('clickable');
    tr.innerHTML = `
      <td>${txt}</td>
      <td>${r.pn}</td>
      <td>${r.chapter}</td>
      <td>${r.reference_nature}</td>
    `;
    refsTableBody.appendChild(tr);
  });
}

// Populate form (or reset) and disable Save
async function loadForm(refId) {
  if (unsaved && refId !== selectedRef) {
    const ok = await showModal('Discard unsaved changes?', 'Discard', 'Cancel');
    if (!ok) return;
  }
  selectedRef = refId;
  unsaved = false;
  deleteBtn.disabled = !refId;

  if (!refId) {
    refForm.reset();
    saveBtn.disabled = true;
    textSelect.focus();
    return;
  }

  const { data: r, error } = await supabase
    .from('product_references')
    .select('text_id, pn, chapter, reference_nature')
    .eq('id', refId)
    .single();
  if (error) return console.error(error);

  textSelect.value    = r.text_id;
  await loadChapters(r.text_id);
  chapterSelect.value = r.chapter;
  pnInput.value       = r.pn;
  natureSelect.value  = r.reference_nature;
  saveBtn.disabled    = true;
}

// Save/update with preview
refForm.addEventListener('submit', async e => {
  e.preventDefault();
  if (!selectedProd) return showModal('Pick a product first.', 'OK', '');

  const txt = textSelect.value,
        ch  = chapterSelect.value,
        pn  = pnInput.value.trim(),
        nat = natureSelect.value;
  if (!txt || !ch || !pn || !nat)
    return showModal('All fields required.', 'OK', '');

  const preview = [
    `Save this reference?`, ``,
    `• Text:    ${textSelect.selectedOptions[0].text}`,
    `• Chapter: ${ch}`,
    `• PN:      ${pn}`,
    `• Nature:  ${nat}`
  ].join('\n');
  if (!(await showModal(preview, 'Save', 'Cancel'))) return;

  let newId = selectedRef;
  if (selectedRef) {
    const { error } = await supabase
      .from('product_references')
      .update({ text_id: txt, pn, chapter: ch, reference_nature: nat })
      .eq('id', selectedRef);
    if (error) return console.error(error);
  } else {
    const { data, error } = await supabase
      .from('product_references')
      .insert([{ product_id: selectedProd, text_id: txt, pn, chapter: ch, reference_nature: nat }])
      .select('id');
    if (error) return console.error(error);
    newId = data[0].id;
  }

  await renderRefs();
  await loadForm(newId);
});

// Delete with modal
deleteBtn.addEventListener('click', async () => {
  if (!selectedRef) return;
  if (!(await showModal('Delete this reference?', 'Delete', 'Cancel'))) return;

  const { error } = await supabase
    .from('product_references')
    .delete()
    .eq('id', selectedRef);
  if (error) return console.error(error);

  await renderRefs();
  loadForm(null);
});

// New reference
addNewBtn.addEventListener('click', () => loadForm(null));

// Product click → render refs + first detail
productList.addEventListener('click', async e => {
  const li = e.target.closest('li');
  if (!li) return;
  selectedProd = Number(li.dataset.id);
  applyFilter();
  await renderRefs();
  if (lastRefsData.length) {
    await loadForm(lastRefsData[0].id);
  } else {
    loadForm(null);
  }
});

// Row click → load that ref
refsTableBody.addEventListener('click', async e => {
  const tr = e.target.closest('tr');
  if (!tr) return;
  refsTableBody.querySelectorAll('tr').forEach(r=>r.classList.remove('selected'));
  tr.classList.add('selected');
  await loadForm(Number(tr.dataset.id));
});

// Search filter
searchInput.addEventListener('input', applyFilter);

// Track unsaved & enable Save
[textSelect, chapterSelect, pnInput, natureSelect].forEach(el => {
  el.addEventListener('input',  markDirty);
  el.addEventListener('change', markDirty);
});

// Home guard
homeIcon.addEventListener('click', async () => {
  if (unsaved && !(await showModal('Discard unsaved changes?', 'Yes', 'No')))
    return;
  window.location.href = 'index.html';
});

// Init
window.addEventListener('DOMContentLoaded', async () => {
  await loadTexts();
  await loadProducts();
  loadForm(null);
});