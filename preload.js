// preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  /** Returns the Electron/​package.json version as a string, e.g. "1.2.3". */
  getAppVersion: () => ipcRenderer.invoke('get-app-version')
});