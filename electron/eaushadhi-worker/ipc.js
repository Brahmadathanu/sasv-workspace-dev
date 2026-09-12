/* eslint-env node */

const { createEaushadhiWorker } = require("./index");
const { WorkerError, ERROR_KINDS, workerError } = require("./errors");
const { validateProductId, validateAccessToken, publicStatus } = require("./validate");
const {
  assertAllowedEaushadhiRenderer,
  windowIsEaushadhiReview,
} = require("./renderer-guard");

const CHANNELS = Object.freeze({
  STATUS: "eaushadhi-worker:status",
  GET_STATUS: "eaushadhi-worker:get-status",
  CONNECT: "eaushadhi-worker:connect",
  STOP: "eaushadhi-worker:stop",
  FOUNDATION_CHECK: "eaushadhi-worker:foundation-check",
  ENTRY_DRY_RUN: "eaushadhi-worker:entry-dry-run",
  PRODUCT_DETAILS_PREVIEW: "eaushadhi-worker:product-details-preview",
  PRODUCT_DETAILS_START: "eaushadhi-worker:product-details-start",
  CAPTURE_CONTRACT: "eaushadhi-worker:capture-contract",
  OPEN_CAPTURE_FOLDER: "eaushadhi-worker:open-capture-folder",
  RECHECK_LOGIN: "eaushadhi-worker:recheck-login",
});

function errorPayload(error) {
  const kind = error?.kind || ERROR_KINDS.CRASH;
  return {
    ok: false,
    errorKind: kind,
    message: error?.message || "Worker failed",
  };
}

function withRendererGuard(handler) {
  return async (event, payload) => {
    try {
      assertAllowedEaushadhiRenderer(event);
      return await handler(event, payload);
    } catch (error) {
      return errorPayload(
        error instanceof WorkerError
          ? error
          : workerError(ERROR_KINDS.CRASH, "Worker IPC failed."),
      );
    }
  };
}

function registerEaushadhiWorkerIpc({ app, ipcMain, BrowserWindow, shell }) {
  const worker = createEaushadhiWorker({
    getUserDataPath: () => app.getPath("userData"),
    onStatus: (status) => {
      for (const win of BrowserWindow.getAllWindows()) {
        if (!windowIsEaushadhiReview(win)) continue;
        try {
          win.webContents.send(CHANNELS.STATUS, publicStatus(status));
        } catch {
          // ignore destroyed senders
        }
      }
    },
  });

  ipcMain.handle(
    CHANNELS.GET_STATUS,
    withRendererGuard(async () => worker.getStatus()),
  );

  ipcMain.handle(
    CHANNELS.CONNECT,
    withRendererGuard(async () => worker.connect()),
  );

  ipcMain.handle(
    CHANNELS.STOP,
    withRendererGuard(async () => worker.stop()),
  );

  ipcMain.handle(
    CHANNELS.RECHECK_LOGIN,
    withRendererGuard(async () => worker.recheckAuthentication()),
  );

  ipcMain.handle(
    CHANNELS.FOUNDATION_CHECK,
    withRendererGuard(async (_event, payload) => {
      const productId = validateProductId(payload?.productId);
      const accessToken = validateAccessToken(payload?.accessToken);
      return worker.runFoundationCheck(productId, accessToken);
    }),
  );

  ipcMain.handle(
    CHANNELS.ENTRY_DRY_RUN,
    withRendererGuard(async (_event, payload) => {
      const productId = validateProductId(payload?.productId);
      const accessToken = validateAccessToken(payload?.accessToken);
      return worker.runControlledEntryDryRun(productId, accessToken);
    }),
  );

  ipcMain.handle(
    CHANNELS.PRODUCT_DETAILS_PREVIEW,
    withRendererGuard(async (_event, payload) => {
      const productId = validateProductId(payload?.productId);
      const accessToken = validateAccessToken(payload?.accessToken);
      return worker.previewProductDetailsExecution(productId, accessToken, payload || {});
    }),
  );

  ipcMain.handle(
    CHANNELS.PRODUCT_DETAILS_START,
    withRendererGuard(async (_event, payload) => {
      const productId = validateProductId(payload?.productId);
      const accessToken = validateAccessToken(payload?.accessToken);
      return worker.startProductDetailsExecution(productId, accessToken, payload || {});
    }),
  );

  ipcMain.handle(
    CHANNELS.CAPTURE_CONTRACT,
    withRendererGuard(async (_event, payload) => {
      const accessToken = validateAccessToken(payload?.accessToken);
      return worker.capturePortalContract(accessToken);
    }),
  );

  ipcMain.handle(
    CHANNELS.OPEN_CAPTURE_FOLDER,
    withRendererGuard(async (_event, payload) => {
      const accessToken = validateAccessToken(payload?.accessToken);
      return worker.openLastCaptureFolder(accessToken, {
        openPath: typeof shell?.openPath === "function" ? (dir) => shell.openPath(dir) : undefined,
      });
    }),
  );

  return worker;
}

module.exports = {
  CHANNELS,
  registerEaushadhiWorkerIpc,
};
