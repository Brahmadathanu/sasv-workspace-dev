/**
 * Electron-only e-Aushadhi browser-worker client.
 * Renderer must not import browser-driver libraries. No generic IPC. No token storage.
 */
import { Platform } from "./platform.js";

export function workerApiAvailable() {
  return Platform.isElectron === true && typeof window.eaushadhiWorkerAPI?.getStatus === "function";
}

function unsupported() {
  return {
    ok: false,
    errorKind: "UNSUPPORTED_PLATFORM",
    message: "The browser worker is available only in the SASV Electron app.",
  };
}

export async function getWorkerStatus() {
  if (!workerApiAvailable()) return { state: "IDLE", label: "Unavailable", ...unsupported() };
  return window.eaushadhiWorkerAPI.getStatus();
}

export async function connectWorkerBrowser() {
  if (!workerApiAvailable()) return unsupported();
  return window.eaushadhiWorkerAPI.connect();
}

export async function stopWorkerBrowser() {
  if (!workerApiAvailable()) return unsupported();
  return window.eaushadhiWorkerAPI.stop();
}

export async function runWorkerFoundationCheck(productId, accessToken) {
  if (!workerApiAvailable()) return unsupported();
  return window.eaushadhiWorkerAPI.runFoundationCheck(productId, accessToken);
}

export async function captureWorkerPortalContract(accessToken) {
  if (!workerApiAvailable()) return unsupported();
  return window.eaushadhiWorkerAPI.capturePortalContract(accessToken);
}

export async function openWorkerCaptureFolder(accessToken) {
  if (!workerApiAvailable()) return unsupported();
  return window.eaushadhiWorkerAPI.openCaptureFolder(accessToken);
}

export function onWorkerStatus(callback) {
  if (!workerApiAvailable() || typeof window.eaushadhiWorkerAPI.onStatus !== "function") {
    return () => {};
  }
  return window.eaushadhiWorkerAPI.onStatus(callback);
}
