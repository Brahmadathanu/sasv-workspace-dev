// preload.js
/* eslint-env node */
/* global require */

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("app", {
  /**
   * Open a new BrowserWindow pointing to an absolute URL (file:// or http://),
   * with optional size options.
   *   absUrl: string, e.g. new URL('update-log-status.html?item=X', window.location.href).toString()
   *   opts:   { width?: number, height?: number }
   */
  openModuleUrl: (absUrl, opts = {}) => {
    ipcRenderer.send("open-module-url", { absUrl, opts });
  },
});

contextBridge.exposeInMainWorld("electronAPI", {
  /** Returns the Electron/package.json version as a string, e.g. "1.2.3". */
  getAppVersion: () => ipcRenderer.invoke("get-app-version"),
});
