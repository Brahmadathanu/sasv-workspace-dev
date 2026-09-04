/* eslint-env node */

const { createEaushadhiWorker } = require("./index");
const { WorkerError, ERROR_KINDS, workerError } = require("./errors");
const { validateProductId, validateAccessToken, publicStatus } = require("./validate");

const CHANNELS = Object.freeze({
  STATUS: "eaushadhi-worker:status",
  GET_STATUS: "eaushadhi-worker:get-status",
  CONNECT: "eaushadhi-worker:connect",
  STOP: "eaushadhi-worker:stop",
  FOUNDATION_CHECK: "eaushadhi-worker:foundation-check",
});

function errorPayload(error) {
  const kind = error?.kind || ERROR_KINDS.CRASH;
  return {
    ok: false,
    errorKind: kind,
    message: error?.message || "Worker failed",
  };
}

function registerEaushadhiWorkerIpc({ app, ipcMain, BrowserWindow }) {
  const worker = createEaushadhiWorker({
    getUserDataPath: () => app.getPath("userData"),
    onStatus: (status) => {
      for (const win of BrowserWindow.getAllWindows()) {
        if (win.isDestroyed()) continue;
        try {
          win.webContents.send(CHANNELS.STATUS, publicStatus(status));
        } catch {
          // ignore destroyed senders
        }
      }
    },
  });

  ipcMain.handle(CHANNELS.GET_STATUS, () => worker.getStatus());

  ipcMain.handle(CHANNELS.CONNECT, async () => {
    try {
      return await worker.connect();
    } catch (error) {
      return errorPayload(error instanceof WorkerError ? error : workerError(ERROR_KINDS.CRASH, "Connect failed."));
    }
  });

  ipcMain.handle(CHANNELS.STOP, async () => {
    try {
      return await worker.stop();
    } catch (error) {
      return errorPayload(error instanceof WorkerError ? error : workerError(ERROR_KINDS.CRASH, "Stop failed."));
    }
  });

  ipcMain.handle(CHANNELS.FOUNDATION_CHECK, async (_event, payload) => {
    try {
      const productId = validateProductId(payload?.productId);
      const accessToken = validateAccessToken(payload?.accessToken);
      return await worker.runFoundationCheck(productId, accessToken);
    } catch (error) {
      return errorPayload(
        error instanceof WorkerError ? error : workerError(ERROR_KINDS.CRASH, "Foundation check failed."),
      );
    }
  });

  return worker;
}

module.exports = {
  CHANNELS,
  registerEaushadhiWorkerIpc,
};
