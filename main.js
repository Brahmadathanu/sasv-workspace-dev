// main.js
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const express = require('express');

// ── serve files over HTTP on port 3000 ──
const webApp = express();
webApp.use(express.static(path.join(__dirname)));
webApp.listen(3000, () => {
  console.log('Static server running at http://localhost:3000');
});

let mainWindow;
function createWindow () {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // load via HTTP now, not file://
  mainWindow.loadURL('http://localhost:3000/login.html');
}

ipcMain.on('focus-window', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) win.focus();
});

app.whenReady().then(createWindow);
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});