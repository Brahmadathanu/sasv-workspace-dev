// Loads the REAL main.js in plain Node with Electron/updater/express mocked, so tests can observe what the app would do.
// No window, no network, no filesystem writes. Used only by tests.
import { createRequire } from "node:module";
import { EventEmitter } from "node:events";
import fs from "node:fs";
import path from "node:path";
import { REPO } from "./lib.mjs";

export function loadMain({ packaged = true, marker = undefined, pkgOverride = null } = {}) {
  const require = createRequire(path.join(REPO, "package.json"));
  const Module = require("node:module");
  const rec = { setPath: [], aumid: [], exit: [], errorBoxes: [], handlers: {}, appOn: {}, updater: { calls: [], props: {} }, listenPort: null, windows: [], quit: 0, singleLock: 0 };
  const server = new EventEmitter();
  const app = {
    isPackaged: packaged, name: "mock", getVersion: () => "0.0.0", getPath: (n) => (n === "appData" ? "/mock/AppData/Roaming" : `/mock/${n}`),
    setPath: (...a) => rec.setPath.push(a), setAppUserModelId: (id) => rec.aumid.push(id), exit: (c) => rec.exit.push(c), quit: () => { rec.quit++; },
    requestSingleInstanceLock: () => { rec.singleLock++; rec.lockedAfterSetPath = rec.setPath.length; return true; },
    on: (ev, fn) => { (rec.appOn[ev] ||= []).push(fn); }, whenReady: () => ({ then: (fn) => { rec.ready = fn; } }),
  };
  class BrowserWindow extends EventEmitter { constructor() { super(); rec.windows.push(this); this.webContents = Object.assign(new EventEmitter(), { send() {} }); this.title = ""; }
    loadURL() {} isDestroyed() { return false; } setTitle(t) { this.title = t; } static getAllWindows() { return rec.windows; } }
  const handlers = rec.handlers;
  const electron = { app, BrowserWindow, ipcMain: { handle: (n, fn) => { handlers[n] = fn; }, on() {} }, dialog: { showErrorBox: (...a) => rec.errorBoxes.push(a) }, Menu: { buildFromTemplate: () => ({}), setApplicationMenu() {} }, shell: {} };
  const updater = new Proxy({ on() {}, checkForUpdates: async () => { rec.updater.calls.push("checkForUpdates"); }, setFeedURL: (f) => rec.updater.calls.push(["setFeedURL", f]), quitAndInstall: () => rec.updater.calls.push("quitAndInstall") },
    { set(t, k, v) { rec.updater.props[k] = v; t[k] = v; return true; } });
  const expressApp = Object.assign(() => {}, { use() {}, get() {}, post() {}, put() {}, delete() {}, all() {}, listen: (port) => { rec.listenPort = port; return server; } });
  const express = Object.assign(() => expressApp, { static: () => () => {}, json: () => () => {}, urlencoded: () => () => {}, Router: () => expressApp });
  const mocks = { electron, "electron-updater": { autoUpdater: updater }, express, "electron-reload": () => {}, "./electron/eaushadhi-worker/ipc": { registerEaushadhiWorkerIpc() {} } };
  const origLoad = Module._load; const mainPath = path.join(REPO, "main.js");
  const origRead = fs.readFileSync;
  Module._load = function (request, parent, ...r) { if (Object.prototype.hasOwnProperty.call(mocks, request)) return mocks[request]; return origLoad.call(this, request, parent, ...r); };
  fs.readFileSync = function (p, ...r) {
    if (path.resolve(String(p)) === path.join(REPO, "package.json") && (marker !== undefined || pkgOverride)) {
      const pkg = pkgOverride || { ...JSON.parse(origRead.call(fs, p, "utf8")), sasvOfficeTestCandidate: marker };
      return JSON.stringify(pkg);
    }
    return origRead.call(fs, p, ...r);
  };
  const hadRes = Object.prototype.hasOwnProperty.call(process, "resourcesPath"); const origRes = process.resourcesPath; process.resourcesPath = "/mock/resources";
  const origPlatform = Object.getOwnPropertyDescriptor(process, "platform");
  Object.defineProperty(process, "platform", { value: "win32" });
  try { delete require.cache[mainPath]; try { require(mainPath); } catch (e) { rec.loadError = String(e.message); } }
  finally { if (hadRes) process.resourcesPath = origRes; else delete process.resourcesPath; Module._load = origLoad; fs.readFileSync = origRead; Object.defineProperty(process, "platform", origPlatform); }
  return { rec, server, electron, updater, async ready() { await rec.ready?.(); },
    /** Fire the app's own window-all-closed cleanup (clears the 30-minute update interval so Node can exit). */
    close() { for (const fn of rec.appOn["window-all-closed"] || []) fn(); } };
}

export const VALID_MARKER = Object.freeze({ schema: 1, appId: "com.brahmadathanu.sasvworkspace.officetest", userDataDirName: "SASV Workspace OFFICE TEST", updaterDisabled: true, candidateVersion: "6.1.0-officetest.1", baselineMainSha: "8c7648fab72f2cf2e40bacc74e8fe59bedca2777", sourceCommit: "a".repeat(40) });
