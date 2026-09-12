/* eslint-env node */

/**
 * Trusted main-process resolver for Karpooradi approved product copy upload file.
 * Metadata presence alone is never enough — must obtain a worker-local file path.
 */

const fs = require("fs");
const path = require("path");
const { randomUUID } = require("crypto");
const { FIRST_CONTROLLED_PRODUCT_ID } = require("./product-lock");
const { EXPECTED_APPROVED_COPY_NAME } = require("./product-details-field-map");
const { namesEqualExact } = require("./lookup-equality");
const { createUserScopedClient } = require("./server-client");
const { isPathInsideRoot } = require("./capture/persist");

const APPROVED_COPY_CACHE_DIR = "eaushadhi-approved-copy-cache";
const DEFAULT_SIGNED_URL_SECONDS = 120;

function approvedCopyCacheRoot(userDataPath) {
  return path.resolve(String(userDataPath || ""), APPROVED_COPY_CACHE_DIR);
}

function pickCopyRecord(raw) {
  if (!raw) return null;
  if (Array.isArray(raw)) return raw[0] || null;
  if (typeof raw === "object") {
    if (raw.storage_path || raw.original_file_name) return raw;
    if (raw.copy && typeof raw.copy === "object") return raw.copy;
    if (raw.document && typeof raw.document === "object") return raw.document;
  }
  return null;
}

function filenameMatchesGoverned(name) {
  const raw = String(name || "").trim();
  if (!raw) return false;
  if (namesEqualExact(raw, EXPECTED_APPROVED_COPY_NAME)) return true;
  return /KARPOORADI_THAILAM_APPROVED_PRODUCT_COPY/i.test(raw);
}

/**
 * Resolve a Playwright-uploadable local path for product 262 approved PDF.
 *
 * @param {object} args
 * @param {number} args.productId
 * @param {string} args.accessToken
 * @param {string} args.userDataPath
 * @param {Function} args.callRpc
 * @param {object} [args.evidence] content_get evidence (non-authoritative alone)
 * @param {string} [args.expectedFileName]
 */
async function resolveApprovedProductCopyFile(args = {}) {
  const productId = Number(args.productId);
  if (productId !== FIRST_CONTROLLED_PRODUCT_ID) {
    return {
      ok: false,
      code: "PRODUCT_LOCK_REJECTED",
      message: `Approved copy resolver accepts only product_id ${FIRST_CONTROLLED_PRODUCT_ID}.`,
    };
  }
  if (typeof args.callRpc !== "function") {
    return {
      ok: false,
      code: "RESOLVER_RPC_MISSING",
      message: "Trusted RPC adapter is required for approved-copy resolution.",
    };
  }
  if (!args.accessToken) {
    return {
      ok: false,
      code: "RESOLVER_TOKEN_MISSING",
      message: "Access token is required for approved-copy download.",
    };
  }
  if (!args.userDataPath) {
    return {
      ok: false,
      code: "RESOLVER_USERDATA_MISSING",
      message: "Worker userData path is required for temp approved-copy storage.",
    };
  }

  // Renderer-supplied filesystem paths are never accepted.
  if (args.rendererLocalPath || args.localPathFromRenderer) {
    return {
      ok: false,
      code: "RENDERER_PATH_REJECTED",
      message: "Renderer filesystem paths cannot satisfy approved-copy resolution.",
    };
  }

  const evidencePresent = args.evidence?.approved_product_copy_present === true;
  if (!evidencePresent) {
    return {
      ok: false,
      code: "APPROVED_COPY_METADATA_MISSING",
      message: "content_get does not report approved product copy present.",
    };
  }

  let rpcRow;
  try {
    rpcRow = await args.callRpc("rpc_eaushadhi_approved_product_copy_get", {
      p_product_id: productId,
    });
  } catch (error) {
    return {
      ok: false,
      code: "APPROVED_COPY_GET_FAILED",
      message: error?.message || "rpc_eaushadhi_approved_product_copy_get failed.",
    };
  }

  const copy = pickCopyRecord(rpcRow);
  if (!copy) {
    return {
      ok: false,
      code: "APPROVED_COPY_RECORD_MISSING",
      message: "Approved copy RPC returned no document record.",
    };
  }

  const fileName = String(
    copy.original_file_name || args.evidence?.original_file_name || "",
  ).trim();
  const expected = args.expectedFileName || EXPECTED_APPROVED_COPY_NAME;
  if (!filenameMatchesGoverned(fileName) || !filenameMatchesGoverned(expected)) {
    return {
      ok: false,
      code: "APPROVED_COPY_NAME_MISMATCH",
      message: `Expected governed filename ${EXPECTED_APPROVED_COPY_NAME}.`,
      fileName,
    };
  }

  const storageBucket = String(
    copy.storage_bucket || args.evidence?.storage_bucket || "eaushadhi-evidence",
  ).trim();
  const storagePath = String(
    copy.storage_path || args.evidence?.storage_path || "",
  ).trim();
  if (!storageBucket || !storagePath) {
    return {
      ok: false,
      code: "APPROVED_COPY_STORAGE_MISSING",
      message: "Approved copy storage_bucket/storage_path missing.",
    };
  }

  const cacheRoot = approvedCopyCacheRoot(args.userDataPath);
  fs.mkdirSync(cacheRoot, { recursive: true });
  const safeName = path.basename(fileName).replace(/[^\w.\-]+/g, "_");
  const localPath = path.join(cacheRoot, `${randomUUID()}-${safeName}`);
  if (!isPathInsideRoot(localPath, cacheRoot)) {
    return {
      ok: false,
      code: "APPROVED_COPY_PATH_ESCAPE",
      message: "Resolved temp path escaped the worker cache root.",
    };
  }

  let signedUrl = null;
  try {
    const client = createUserScopedClient(args.accessToken);
    try {
      const { data, error } = await client.storage
        .from(storageBucket)
        .createSignedUrl(storagePath, DEFAULT_SIGNED_URL_SECONDS);
      if (error) throw error;
      signedUrl = data?.signedUrl || null;
    } finally {
      try {
        await client.removeAllChannels();
      } catch {
        // ignore
      }
    }
  } catch (error) {
    return {
      ok: false,
      code: "APPROVED_COPY_SIGNED_URL_FAILED",
      message: error?.message || "createSignedUrl failed.",
    };
  }

  if (!signedUrl) {
    return {
      ok: false,
      code: "APPROVED_COPY_SIGNED_URL_MISSING",
      message: "Signed URL was empty.",
    };
  }

  try {
    const response = await fetch(signedUrl);
    if (!response.ok) {
      return {
        ok: false,
        code: "APPROVED_COPY_DOWNLOAD_FAILED",
        message: `Approved copy download HTTP ${response.status}.`,
      };
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    if (!buffer.length) {
      return {
        ok: false,
        code: "APPROVED_COPY_EMPTY",
        message: "Approved copy download was empty.",
      };
    }
    fs.writeFileSync(localPath, buffer);
  } catch (error) {
    try {
      if (fs.existsSync(localPath)) fs.unlinkSync(localPath);
    } catch {
      // ignore
    }
    return {
      ok: false,
      code: "APPROVED_COPY_DOWNLOAD_FAILED",
      message: error?.message || "Approved copy download failed.",
    };
  }

  const cleanup = () => {
    try {
      if (fs.existsSync(localPath)) fs.unlinkSync(localPath);
    } catch {
      // best-effort
    }
  };

  return {
    ok: true,
    code: "APPROVED_COPY_RESOLVED",
    productId,
    fileName,
    storageBucket,
    storagePath,
    localPath,
    cleanup,
    // Never return signed URL to renderer callers.
  };
}

module.exports = {
  APPROVED_COPY_CACHE_DIR,
  EXPECTED_APPROVED_COPY_NAME,
  approvedCopyCacheRoot,
  filenameMatchesGoverned,
  resolveApprovedProductCopyFile,
  pickCopyRecord,
};
