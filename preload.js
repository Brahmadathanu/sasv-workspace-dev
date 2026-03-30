// preload.js
/* eslint-env node */

const { contextBridge, ipcRenderer } = require("electron");

// One expose per key. Do NOT repeat exposeInMainWorld for the same key.
contextBridge.exposeInMainWorld("app", {
  openModuleUrl: (absUrl, opts = {}) =>
    ipcRenderer.send("open-module-url", { absUrl, opts }),
});

contextBridge.exposeInMainWorld("electronAPI", {
  getAppVersion: () => ipcRenderer.invoke("get-app-version"),
  getUpdateState: () => ipcRenderer.invoke("updater:get-state"),
  checkForUpdates: () => ipcRenderer.invoke("updater:check"),
  onUpdateStatus: (cb) => {
    const handler = (_evt, payload) => cb && cb(payload);
    ipcRenderer.on("updater:status", handler);
    return () => ipcRenderer.removeListener("updater:status", handler);
  },
  restartNow: () => ipcRenderer.invoke("updater:restart"),
});

contextBridge.exposeInMainWorld("sopAPI", {
  exportPdf: (title) => ipcRenderer.invoke("sop:export-pdf", { title }),
  exportPdfFromHtml: (title, html, options) =>
    ipcRenderer.invoke("sop:export-pdf-from-html", { title, html, options }),
  exportDocxFromHtml: (title, html, options) =>
    ipcRenderer.invoke("sop:exportDocxFromHtml", { title, html, options }),
});

// Authentication API: small, safe surface for renderer to query session
contextBridge.exposeInMainWorld("auth", {
  getUser: () => ipcRenderer.invoke("auth:whoami"),
  hasPermission: (moduleName, action) =>
    ipcRenderer.invoke("auth:hasPermission", moduleName, action),
  setSession: (user) => ipcRenderer.invoke("auth:setSession", user),
});

console.log("preload ready: app, electronAPI, sopAPI exposed");
