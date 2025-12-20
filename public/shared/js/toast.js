// Lightweight in-page toast helper
export function showToast(message, opts = {}) {
  const { type = "info", duration = 3000 } = opts;

  // ensure container
  let container = document.getElementById("app-toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "app-toast-container";
    container.setAttribute("aria-live", "polite");
    container.style.position = "fixed";
    container.style.right = "18px";
    container.style.bottom = "18px";
    container.style.zIndex = 99999;
    container.style.display = "flex";
    container.style.flexDirection = "column";
    container.style.gap = "8px";
    document.body.appendChild(container);
  }

  // inject basic styles once
  if (!document.getElementById("app-toast-styles")) {
    const s = document.createElement("style");
    s.id = "app-toast-styles";
    s.textContent = `
      .app-toast { padding:10px 14px; border-radius:8px; color:#fff; box-shadow:0 6px 18px rgba(0,0,0,0.12); font-weight:600; max-width:320px; opacity:0; transform:translateY(8px); transition:opacity 240ms ease, transform 240ms ease; }
      .app-toast.show { opacity:1; transform:translateY(0); }
      .app-toast.info { background: linear-gradient(90deg,#2b7cff,#1c5bd6); }
      .app-toast.success { background: linear-gradient(90deg,#16a34a,#0f8b3a); }
      .app-toast.error { background: linear-gradient(90deg,#ef4444,#c53030); }
    `;
    document.head.appendChild(s);
  }

  const t = document.createElement("div");
  t.className = `app-toast ${type}`;
  t.textContent = message;
  container.appendChild(t);

  // trigger entrance
  requestAnimationFrame(() => t.classList.add("show"));

  const remove = () => {
    t.classList.remove("show");
    setTimeout(() => t.remove(), 260);
  };

  const to = setTimeout(remove, duration);
  t.addEventListener("click", () => {
    clearTimeout(to);
    remove();
  });
}
