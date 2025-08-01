// js/categories.js
import { supabase } from '../shared/js/supabaseClient.js'

//
// In-page confirmation helper
//
function showConfirm(msg) {
  return new Promise(resolve => {
    const ov  = document.getElementById('confirmOverlay')
    const txt = document.getElementById('confirmMessage')
    const yes = document.getElementById('confirmYes')
    const no  = document.getElementById('confirmNo')

    txt.textContent = msg
    ov.style.display = 'flex'
    yes.focus()

    function clean() {
      ov.style.display = 'none'
      yes.removeEventListener('click', onYes)
      no .removeEventListener('click', onNo)
    }
    function onYes() { clean(); resolve(true) }
    function onNo()  { clean(); resolve(false) }

    yes.addEventListener('click', onYes)
    no .addEventListener('click', onNo)
  })
}

//
// Focus helper
//
function focusAddInput() {
  const inp = document.querySelector('#addCategoryForm [name="category_name"]')
  if (inp) inp.focus()
}

//
// Render categories from Supabase
//
async function renderTable() {
  const { data: rows, error } = await supabase
    .from('categories')
    .select('id, category_name')
    .order('id', { ascending: true })

  if (error) {
    console.error('Error loading categories:', error)
    alert('Failed to load categories')
    return
  }

  const tbody = document.querySelector('#categoriesTable tbody')
  tbody.innerHTML = rows.map(r => `
    <tr data-id="${r.id}">
      <td class="name-cell">${r.category_name}</td>
      <td>
        <button class="action-link edit-btn">Edit</button> |
        <button class="action-link delete-btn">Delete</button>
      </td>
    </tr>
  `).join('')
}

//
// Wire up UI
//
window.addEventListener('DOMContentLoaded', async () => {
  await renderTable()
  focusAddInput()

  const overlay   = document.getElementById('editOverlay')
  const editForm  = document.getElementById('editForm')
  const editInput = document.getElementById('editInput')
  const btnCancel = document.getElementById('cancelEdit')
  let currentId, oldName

  // Add Category
  document.getElementById('addCategoryForm')
    .addEventListener('submit', async e => {
      e.preventDefault()
      const inp  = e.target.category_name
      const name = inp.value.trim()
      focusAddInput()
      if (!name) return

      if (!await showConfirm(`Add category “${name}”?`)) {
        await renderTable()
        focusAddInput()
        return
      }

      const { error } = await supabase
        .from('categories')
        .insert([{ category_name: name }])

      if (error) {
        console.error('Error adding category:', error)
        alert('Add failed')
      } else {
        inp.value = ''
        await renderTable()
        focusAddInput()
      }
    })

  // Edit / Delete delegation
  document.querySelector('#categoriesTable tbody')
    .addEventListener('click', async ev => {
      const btn = ev.target
      const tr  = btn.closest('tr')
      if (!tr) return
      const id   = tr.dataset.id
      const name = tr.querySelector('.name-cell').textContent

      // DELETE
      if (btn.classList.contains('delete-btn')) {
        focusAddInput()
        if (!await showConfirm(`Delete category “${name}”?`)) {
          await renderTable()
          focusAddInput()
          return
        }
        const { error } = await supabase
          .from('categories')
          .delete()
          .eq('id', id)

        if (error) {
          console.error('Error deleting category:', error)
          alert('Delete failed')
        } else {
          await renderTable()
          focusAddInput()
        }
        return
      }

      // EDIT → show overlay
      if (btn.classList.contains('edit-btn')) {
        currentId        = id
        oldName          = name
        editInput.value  = oldName
        overlay.style.display = 'flex'
        editInput.focus()
      }
    })

  // Cancel edit
  btnCancel.addEventListener('click', async () => {
    overlay.style.display = 'none'
    await renderTable()
    focusAddInput()
  })

  // Save edit
  editForm.addEventListener('submit', async e => {
    e.preventDefault()
    const newName = editInput.value.trim()
    focusAddInput()
    if (!newName) {
      alert("Name can't be empty")
      return
    }

    overlay.style.display = 'none'

    if (newName !== oldName) {
      if (!await showConfirm(`Change “${oldName}” → “${newName}”?`)) {
        await renderTable()
        focusAddInput()
        return
      }
      const { error } = await supabase
        .from('categories')
        .update({ category_name: newName })
        .eq('id', currentId)

      if (error) {
        console.error('Error updating category:', error)
        alert('Update failed')
      }
    }

    await renderTable()
    focusAddInput()
  })

  // Home navigation
  document.getElementById('homeIcon').onclick = () => {
    window.location.href = 'index.html'
  }
})