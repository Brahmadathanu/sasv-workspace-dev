// main.js
/* eslint-env node */
/* global require, __dirname, process */

// Auto-reload the app when any file under the project changes (dev only)
try {
  require("electron-reload")(__dirname, {
    // Optional tweaks:
    //   electron: path.join(__dirname, 'node_modules', '.bin', 'electron'),
    //   hardResetMethod: 'exit'
  });
} catch {
  /* ignore when packaged */
}

const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const express = require("express");

// Auto-update (checks GitHub Releases)
const { autoUpdater } = require("electron-updater");

//
// ── AUTO‐UPDATE EVENT LISTENERS ───────────────────────────────────────
//
autoUpdater.on("checking-for-update", () => {
  dialog.showMessageBox({ type: "info", message: "Checking for updates…" });
});
autoUpdater.on("update-available", (info) => {
  dialog.showMessageBox({
    type: "info",
    message: `Update available: v${info.version}. Downloading…`,
  });
});
autoUpdater.on("update-not-available", () => {
  dialog.showMessageBox({
    type: "info",
    message: "No update available (you’re on the latest version).",
  });
});
autoUpdater.on("error", (err) => {
  dialog.showErrorBox("Update error", (err && err.message) || "Unknown error");
});
autoUpdater.on("download-progress", (progress) => {
  console.log(`Download speed: ${progress.bytesPerSecond}
Downloaded ${Math.round(progress.percent)}%
(${progress.transferred}/${progress.total})`);
});
autoUpdater.on("update-downloaded", (info) => {
  dialog
    .showMessageBox({
      type: "question",
      buttons: ["Restart now", "Later"],
      defaultId: 0,
      message: `v${info.version} downloaded — restart to install?`,
    })
    .then(({ response }) => {
      if (response === 0) autoUpdater.quitAndInstall();
    });
});

//
// ── serve files over HTTP on port 3000 ────────────────────────────────
//
const webApp = express();
webApp.use(express.static(path.join(__dirname)));
webApp.listen(3000, () => {
  console.log("Static server running at http://localhost:3000");
});

let mainWindow;
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // load via HTTP now, not file://
  mainWindow.loadURL("http://localhost:3000/login.html");
}

ipcMain.on("focus-window", (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) win.focus();
});

// Opens a child window to an absolute URL sent from the renderer (preload -> openModuleUrl)
ipcMain.on("open-module-url", (event, { absUrl, opts = {} }) => {
  try {
    const parent = BrowserWindow.fromWebContents(event.sender);

    const child = new BrowserWindow({
      width: opts.width || 1200,
      height: opts.height || 800,
      parent,
      modal: false,
      show: true,
      autoHideMenuBar: true,
      webPreferences: {
        contextIsolation: true,
        preload: path.join(__dirname, "preload.js"),
        nodeIntegration: false,
      },
    });

    // If renderer sent a relative path by mistake, resolve it to your server root.
    const targetUrl = /^https?:|^file:/i.test(absUrl)
      ? absUrl
      : new URL(absUrl, "http://localhost:3000/").toString();

    child.loadURL(targetUrl);
  } catch (err) {
    console.error("open-module-url failed:", err);
  }
});

// ── make app version available to renderer ──
ipcMain.handle("get-app-version", () => app.getVersion());

app.whenReady().then(() => {
  // 1) create the main window
  createWindow();

  // 2) in packaged builds, check GitHub for a newer version
  try {
    autoUpdater.setFeedURL({
      provider: "github",
      owner: "Brahmadathanu",
      repo: "sasv-workspace-dev",
      private: false,
      token: null,
    });
    autoUpdater.checkForUpdatesAndNotify();
  } catch (err) {
    // During `npm run dev` this will throw because the app isn’t packaged.
    // We log and keep going so it won’t spam your console.
    console.log("Auto-update skipped (dev mode):", err.message);
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
