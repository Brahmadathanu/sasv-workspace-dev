function formatBytesPerSecond(value) {
  if (!Number.isFinite(value) || value <= 0) return "";
  const units = ["B/s", "KB/s", "MB/s", "GB/s"];
  let amount = value;
  let unitIndex = 0;
  while (amount >= 1024 && unitIndex < units.length - 1) {
    amount /= 1024;
    unitIndex += 1;
  }
  const digits = amount >= 10 || unitIndex === 0 ? 0 : 1;
  return `${amount.toFixed(digits)} ${units[unitIndex]}`;
}

function ensureUpdaterShell() {
  let shell = document.getElementById("app-update-shell");
  if (shell) return shell;

  shell = document.createElement("div");
  shell.id = "app-update-shell";
  shell.style.cssText = [
    "position:fixed",
    "right:16px",
    "bottom:16px",
    "z-index:10000",
    "display:none",
    "width:min(360px, calc(100vw - 32px))",
    "background:#0f172a",
    "color:#e5e7eb",
    "border-radius:14px",
    "box-shadow:0 18px 40px rgba(15,23,42,0.28)",
    "padding:14px 14px 12px",
    "font:13px/1.4 system-ui, sans-serif",
  ].join(";");

  shell.innerHTML = `
    <div style="display:flex;align-items:flex-start;gap:12px;">
      <div style="flex:1;min-width:0;">
        <div id="app-update-title" style="font-weight:700;color:#fff;">App updates</div>
        <div id="app-update-text" style="margin-top:4px;color:#cbd5e1;"></div>
        <div id="app-update-progress-wrap" style="display:none;margin-top:10px;">
          <div style="height:8px;background:rgba(148,163,184,0.22);border-radius:999px;overflow:hidden;">
            <div id="app-update-progress-bar" style="height:100%;width:0%;background:linear-gradient(90deg,#38bdf8,#22c55e);transition:width 0.2s ease;"></div>
          </div>
          <div id="app-update-progress-meta" style="margin-top:6px;font-size:12px;color:#94a3b8;"></div>
        </div>
      </div>
      <button id="app-update-close" type="button" aria-label="Dismiss update status" style="border:none;background:transparent;color:#94a3b8;cursor:pointer;font-size:18px;line-height:1;padding:0;">×</button>
    </div>
    <div id="app-update-actions" style="display:none;gap:8px;margin-top:12px;">
      <button id="app-update-restart" type="button" style="border:none;background:#22c55e;color:#0b2816;padding:8px 12px;border-radius:8px;font-weight:700;cursor:pointer;">Restart now</button>
      <button id="app-update-later" type="button" style="border:1px solid rgba(203,213,225,0.35);background:transparent;color:#e2e8f0;padding:8px 12px;border-radius:8px;cursor:pointer;">Later</button>
    </div>
  `;

  document.body.appendChild(shell);

  shell.querySelector("#app-update-close")?.addEventListener("click", () => {
    shell.style.display = "none";
  });
  shell.querySelector("#app-update-later")?.addEventListener("click", () => {
    shell.style.display = "none";
  });
  shell
    .querySelector("#app-update-restart")
    ?.addEventListener("click", async () => {
      try {
        await window.electronAPI?.restartNow?.();
      } catch (error) {
        console.error("restartNow failed", error);
      }
    });

  return shell;
}

function renderUpdateState(state) {
  if (!window.electronAPI) return;
  const shell = ensureUpdaterShell();
  const title = shell.querySelector("#app-update-title");
  const text = shell.querySelector("#app-update-text");
  const progressWrap = shell.querySelector("#app-update-progress-wrap");
  const progressBar = shell.querySelector("#app-update-progress-bar");
  const progressMeta = shell.querySelector("#app-update-progress-meta");
  const actions = shell.querySelector("#app-update-actions");

  const status = state?.status || "idle";
  const version = state?.version ? ` v${state.version}` : "";

  if (status === "idle") {
    shell.style.display = "none";
    return;
  }

  shell.style.display = "block";
  actions.style.display = "none";
  progressWrap.style.display = "none";
  progressBar.style.width = "0%";
  progressMeta.textContent = "";
  shell.style.background = "#0f172a";

  switch (status) {
    case "checking":
      title.textContent = "Checking for updates";
      text.textContent = "Looking for a newer release in the background.";
      break;
    case "available":
      title.textContent = `Update available${version}`;
      text.textContent =
        "Download started. You can keep working while the update is fetched.";
      break;
    case "progress": {
      const percent = Number.isFinite(Number(state.percent))
        ? Math.max(0, Math.min(100, Number(state.percent)))
        : 0;
      title.textContent = `Downloading update${version}`;
      text.textContent = `${percent.toFixed(1)}% downloaded`;
      progressWrap.style.display = "block";
      progressBar.style.width = `${percent}%`;
      const rate = formatBytesPerSecond(Number(state.bps));
      progressMeta.textContent = rate
        ? `Transfer speed: ${rate}`
        : "Downloading…";
      break;
    }
    case "downloaded":
      title.textContent = `Update ready${version}`;
      text.textContent =
        "The update has been downloaded and can be installed with a restart.";
      actions.style.display = "flex";
      break;
    case "error":
      title.textContent = "Update error";
      text.textContent =
        state?.message || "The app could not complete the update check.";
      shell.style.background = "#7f1d1d";
      break;
    case "not-available":
      shell.style.display = "none";
      break;
    default:
      text.textContent = state?.message || status;
      break;
  }
}

export function initUpdaterUI() {
  if (!window.electronAPI || window.__updaterUiInitialized) return;
  window.__updaterUiInitialized = true;

  try {
    const unsubscribe = window.electronAPI.onUpdateStatus?.((payload) => {
      renderUpdateState(payload);
    });
    window.addEventListener("beforeunload", () => {
      if (typeof unsubscribe === "function") unsubscribe();
    });
  } catch (error) {
    console.error("Failed to subscribe to update status", error);
  }

  window.electronAPI
    .getUpdateState?.()
    .then((state) => renderUpdateState(state))
    .catch((error) =>
      console.error("Failed to get initial updater state", error),
    );
}
