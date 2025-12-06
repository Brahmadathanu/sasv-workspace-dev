import { supabase } from "../public/shared/js/supabaseClient.js";

const profilesList = document.getElementById("profilesList");
const form = document.getElementById("profileForm");
const labelInput = document.getElementById("profileLabel");
const kindSelect = document.getElementById("profileKind");
const notesInput = document.getElementById("profileNotes");
const cancelBtn = document.getElementById("cancelEdit");

let editingId = null;

async function loadProfiles() {
  const { data, error } = await supabase
    .from("season_profile")
    .select("id, label, entity_kind, notes")
    .order("label");
  if (error) return console.error(error);
  profilesList.innerHTML = data
    .map(
      (p) => `
    <div style="display:flex;gap:8px;align-items:center;padding:6px 0;border-bottom:1px solid #eee">
      <div style="flex:1">
        <strong>${p.label}</strong> <small>(${p.entity_kind})</small>
        <div style="color:#666">${p.notes || ""}</div>
      </div>
      <div>
        <button data-id="${p.id}" data-action="edit">Edit</button>
        <button data-id="${p.id}" data-action="del">Delete</button>
      </div>
    </div>
  `
    )
    .join("");
}

profilesList.addEventListener("click", async (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;
  const id = Number(btn.dataset.id);
  if (btn.dataset.action === "edit") {
    const { data } = await supabase
      .from("season_profile")
      .select("id, label, entity_kind, notes")
      .eq("id", id)
      .single();
    if (data) {
      editingId = id;
      labelInput.value = data.label;
      kindSelect.value = data.entity_kind;
      notesInput.value = data.notes || "";
    }
  } else if (btn.dataset.action === "del") {
    if (!confirm("Delete profile?")) return;
    const { error } = await supabase
      .from("season_profile")
      .delete()
      .eq("id", id);
    if (error) return console.error(error);
    await loadProfiles();
  }
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const label = labelInput.value.trim();
  const kind = kindSelect.value;
  const notes = notesInput.value.trim();
  if (!label) return alert("Label required");
  if (editingId) {
    const { error } = await supabase
      .from("season_profile")
      .update({ label, entity_kind: kind, notes })
      .eq("id", editingId);
    if (error) return console.error(error);
    editingId = null;
  } else {
    const { error } = await supabase
      .from("season_profile")
      .insert([{ label, entity_kind: kind, notes }]);
    if (error) return console.error(error);
  }
  form.reset();
  await loadProfiles();
});

cancelBtn.addEventListener("click", () => {
  editingId = null;
  form.reset();
});

window.addEventListener("DOMContentLoaded", loadProfiles);
