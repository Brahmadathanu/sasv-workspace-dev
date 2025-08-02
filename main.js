// main.js
// Auto-reload the app when any file under the project changes (dev only)
try {
  require('electron-reload')(__dirname, {
    // Optional tweaks:
    //   electron: path.join(__dirname, 'node_modules', '.bin', 'electron'),
    //   hardResetMethod: 'exit'
  });
} catch (_) { /* ignore when packaged */ }

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const express = require('express');

// Auto-update (checks GitHub Releases)
const { autoUpdater } = require('electron-updater');

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

// ── make app version available to renderer ──
ipcMain.handle('get-app-version', () => app.getVersion());

app.whenReady().then(
  () => {
     // 1) create the main window
     createWindow();
 
     // 2) in packaged builds, check GitHub for a newer version
     try {
       autoUpdater.checkForUpdatesAndNotify();
     } catch (err) {
       // During `npm run dev` this will throw because the app isn’t packaged.
       // We log and keep going so it won’t spam your console.
       console.log('Auto-update skipped (dev mode):', err.message);
     }
   }
 );
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});