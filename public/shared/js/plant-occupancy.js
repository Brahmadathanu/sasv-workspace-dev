/* eslint-env browser */
import { supabase } from "./supabaseClient.js";
import { Platform } from "./platform.js";

document.addEventListener("DOMContentLoaded", init);

async function init() {
  const homeBtn = document.getElementById("homeBtn");
  if (homeBtn) homeBtn.onclick = () => Platform.goHome();

  const backBtn = document.getElementById("backBtn");
  if (backBtn) backBtn.style.display = "none";

  // Minimal harmless data load so the page isn’t blank
  try {
    const { data: rows, error } = await supabase
      .from("plant_machinery")
      .select("id, plant_name, status, area_id, areas(area_name)")
      .order("plant_name");
    if (error) throw error;

    const body = document.getElementById("occBody");
    const table = document.getElementById("occTable");
    const msg = document.getElementById("msg");

    if (!rows?.length) {
      msg.textContent = "No plants found.";
      return;
    }

    msg.style.display = "none";
    table.style.display = "table";

    rows.forEach((r) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${r.plant_name || ""}</td>
        <td>${r.areas?.area_name || ""}</td>
        <td>${r.status || ""}</td>
        <td>—</td>
      `;
      body.appendChild(tr);
    });
  } catch (e) {
    console.error(e);
    const msg = document.getElementById("msg");
    msg.textContent = "Could not load plants. Check console.";
  }
}
