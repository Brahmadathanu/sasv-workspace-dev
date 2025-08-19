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
});

contextBridge.exposeInMainWorld("sopAPI", {
  exportPdf: (title) => ipcRenderer.invoke("sop:export-pdf", { title }),
  exportPdfFromHtml: (title, html, options) =>
    ipcRenderer.invoke("sop:export-pdf-from-html", { title, html, options }),
  exportDocxNative: (title, meta, markdown) =>
    ipcRenderer.invoke("sop:export-docx-native", { title, meta, markdown }),
});

console.log("preload ready: app, electronAPI, sopAPI exposed");
