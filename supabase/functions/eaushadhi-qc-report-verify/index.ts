// WP-07 B2: server-side byte verification of a registered QC test report.
// Deploy with verify_jwt = true. Service role is used only inside this function.
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return Array.from(digest, (b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json(405, { ok: false, code: "METHOD_NOT_ALLOWED" });

  const authorization = req.headers.get("Authorization") ?? "";
  if (!authorization.startsWith("Bearer ")) return json(401, { ok: false, code: "UNAUTHENTICATED" });

  let body: { product_id?: unknown; reservation_id?: unknown };
  try {
    body = await req.json();
  } catch {
    return json(400, { ok: false, code: "BAD_JSON" });
  }
  const productId = body.product_id;
  const reservationId = body.reservation_id;
  if (!Number.isInteger(productId) || (productId as number) <= 0) {
    return json(400, { ok: false, code: "PRODUCT_ID_INVALID" });
  }
  if (typeof reservationId !== "string" || !UUID_RE.test(reservationId)) {
    return json(400, { ok: false, code: "RESERVATION_ID_INVALID" });
  }

  // 1. Caller identity + edit permission, evaluated as the caller.
  const asCaller = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: actor, error: permError } = await asCaller.rpc("rpc_eaushadhi_require_permission", { p_edit: true });
  if (permError || typeof actor !== "string" || !UUID_RE.test(actor)) {
    return json(403, { ok: false, code: "FORBIDDEN" });
  }

  // 2. Resolve the reservation server-side (client never supplies bucket/path/object).
  const svc = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: target, error: targetError } = await svc.rpc("rpc_eaushadhi_qc_report_byte_check_target_v1", {
    p_reservation_id: reservationId,
  });
  if (targetError) return json(500, { ok: false, code: "TARGET_LOOKUP_FAILED" });
  if (!target || target.product_id !== productId) return json(404, { ok: false, code: "RESERVATION_NOT_FOUND" });
  if (target.status !== "REGISTERED") {
    return json(409, { ok: false, code: "RESERVATION_NOT_REGISTERED", status: target.status });
  }
  if (target.integrity_status !== "UNVERIFIED_BYTES") {
    // Single-shot: return the recorded outcome, no re-hash, no new event.
    return json(200, {
      ok: true,
      already_checked: true,
      reservation_id: target.reservation_id,
      integrity_status: target.integrity_status,
      document_asset_id: target.document_asset_id,
      verified_sha256: target.verified_sha256,
      verified_size_bytes: target.verified_size_bytes,
    });
  }

  // 3. Download the actual stored bytes and hash them.
  const { data: blob, error: downloadError } = await svc.storage.from(target.bucket).download(target.path);
  if (downloadError || !blob) return json(404, { ok: false, code: "OBJECT_MISSING" });
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const computedSha = await sha256Hex(bytes);
  const header = bytes.length >= 5 &&
    bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2d; // "%PDF-"

  // 4. Record outcome atomically (object id/version re-checked under row lock; 2 MB enforced there).
  const { data: result, error: recordError } = await svc.rpc("rpc_eaushadhi_qc_report_record_byte_check_v1", {
    p_reservation_id: reservationId,
    p_actor: actor,
    p_object_id: target.storage_object_id,
    p_object_version: target.storage_object_version,
    p_computed_sha256: computedSha,
    p_computed_size: bytes.length,
    p_pdf_header_ok: header,
  });
  if (recordError) {
    const code = recordError.code === "40001" ? "OBJECT_CHANGED" : "RECORD_FAILED";
    return json(409, { ok: false, code, sqlstate: recordError.code ?? null });
  }
  return json(200, { ok: true, ...result });
});
