/**
 * Static contract smoke for portal Diseases projection helpers + migration sync.
 * Offline only. No network. No live portal / Supabase mutation.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import assert from "node:assert/strict";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const helpersPath = join(root, "public/shared/js/eaushadhi-review-helpers.js");
const apiPath = join(root, "public/shared/js/eaushadhi-review-api.js");
const controlPath = join(root, "public/shared/js/eaushadhi-review-control.js");
const workerClientPath = join(root, "public/shared/js/eaushadhi-review-worker-client.js");
const trustedPath = join(root, "electron/eaushadhi-worker/product-details-trusted.js");
const executorPath = join(root, "electron/eaushadhi-worker/product-details-executor.js");
const fieldMapPath = join(root, "electron/eaushadhi-worker/product-details-field-map.js");
const migrationPath = join(
  root,
  "supabase/migrations/20260920053000_eaushadhi_portal_diseases_projection.sql",
);

const helpers = await import(pathToFileURL(helpersPath).href);
const helpersSrc = readFileSync(helpersPath, "utf8");
const apiSrc = readFileSync(apiPath, "utf8");
const controlSrc = readFileSync(controlPath, "utf8");
const workerClientSrc = readFileSync(workerClientPath, "utf8");
const trustedSrc = readFileSync(trustedPath, "utf8");
const executorSrc = readFileSync(executorPath, "utf8");
const fieldMapSrc = readFileSync(fieldMapPath, "utf8");
const migrationSql = readFileSync(migrationPath, "utf8");

function ok(cond, msg) {
  assert.equal(cond, true, msg);
  console.log(`OK ${msg}`);
}

const draft = helpers.portalTextDraftFromRow({
  canonical_text: "Sandhirujah, Śōpham",
  suggested_portal_text: "Sandhirujah, Shopham",
  selected_portal_text: null,
  generation_version: "EAUSHADHI_ASCII_V1",
  portal_review_status: "PENDING",
  row_version: 4,
});
ok(draft.canonicalText === "Sandhirujah, Śōpham", "1. canonical Unicode preserved in draft");
ok(draft.suggestedPortalText === "Sandhirujah, Shopham", "2. suggestion mapped separately");
ok(helpers.isPortalDiseasesVerified(draft) === false, "3. PENDING is not verified authority");
ok(
  helpers.portalTextEditableValue(draft) === "Sandhirujah, Shopham",
  "editable value seeds from suggestion",
);
ok(helpers.portalDiseasesCharsetOk("Sandhirujah, Shopham") === true, "4. ASCII candidate charset ok");
ok(helpers.portalDiseasesCharsetOk("Sandhirujah, Śōpham") === false, "5. Unicode portal text rejected");
ok(
  helpers.DEFAULT_IN_PROGRESS_PORTAL_REASON.includes("canonical text preserved"),
  "IN_PROGRESS default reason present",
);

const verified = helpers.portalTextDraftFromRow({
  canonical_text: "Sandhirujah, Śōpham",
  suggested_portal_text: "Sandhirujah, Shopham",
  selected_portal_text: "Sandhirujah, Shopham",
  portal_review_status: "VERIFIED",
  row_version: 5,
});
ok(helpers.isPortalDiseasesVerified(verified) === true, "7. VERIFIED + selected is verified");
ok(
  helpers.portalTextEditableValue(verified) === "Sandhirujah, Shopham",
  "verified selected preferred over suggestion",
);

ok(apiSrc.includes("rpc_eaushadhi_product_portal_text_get"), "API wraps portal_text_get");
ok(apiSrc.includes("rpc_eaushadhi_product_portal_text_save"), "API wraps portal_text_save");
ok(apiSrc.includes("p_expected_row_version"), "6. save uses expected row_version");
ok(!apiSrc.includes("rpc_eaushadhi_worker_run_rebase_portal_projection"), "25/29. no renderer rebase RPC");
ok(!apiSrc.includes("rpc_eaushadhi_worker_mark_save_ambiguous"), "no renderer marker RPC");
ok(!apiSrc.includes("rpc_eaushadhi_worker_payload_get_legacy_v1"), "25. no legacy payload call");
ok(!apiSrc.includes("rpc_eaushadhi_verify_product_legacy_v1"), "25. no legacy verify call");

ok(
  controlSrc.includes("Accept &amp; Verify Portal Text") ||
    controlSrc.includes("Accept & Verify Portal Text"),
  "UI has Accept & Verify",
);
ok(controlSrc.includes("Reconcile Ambiguous Save"), "UI has Reconcile Ambiguous Save");
ok(controlSrc.includes("Rebase existing run authority"), "UI has Rebase action");
ok(controlSrc.includes("fldPortalDiseases"), "portal textarea present");
ok(controlSrc.includes("fldDiseases"), "canonical field retained");
ok(
  /Resume Product Details[\s\S]{0,200}rebasePortalProjectionProductDetails|rebasePortalProjectionProductDetails[\s\S]{0,400}resumeWorkerProductDetails/.test(
    controlSrc,
  ) ||
    (controlSrc.includes("resumeWorkerProductDetails") &&
      controlSrc.includes("rebasePortalProjectionProductDetails")),
  "19. Resume and rebase are separate call sites",
);

ok(workerClientSrc.includes("reconcileAmbiguousSaveProductDetails"), "worker client reconcile");
ok(workerClientSrc.includes("rebasePortalProjectionProductDetails"), "worker client rebase");

ok(fieldMapSrc.includes('sourcePath: "details.diseases_conditions"'), "20. field-map unchanged path");
ok(!/transliterat|ascii_v1|Śōpham.*Shopham|stripDiacritic/i.test(fieldMapSrc), "22. no field-map transliteration");
ok(!/transliterat|eaushadhi_diseases_ascii|stripDiacritic/i.test(helpersSrc), "22. no helper transliteration");
ok(executorSrc.includes("markSaveAmbiguousOrFail"), "26. executor marks SAVE_AMBIGUOUS");
ok(trustedSrc.includes("runTrustedPortalProjectionRebase"), "rebase trusted path exists");
ok(trustedSrc.includes("runTrustedAmbiguousSaveReconcile"), "reconcile trusted path exists");
ok(
  /source:\s*"LoadProductDataforLegacy"[\s\S]{0,120}duplicate_outcome:\s*"NONE"[\s\S]{0,120}coverage_complete:\s*true/.test(
    trustedSrc,
  ) ||
    /"source":\s*"LoadProductDataforLegacy"/.test(trustedSrc),
  "rebase evidence uses LoadProductDataforLegacy + NONE",
);
ok(!/save_outcome:\s*["']AMBIGUOUS["']/.test(trustedSrc), "13/29. no client save_outcome in trusted rebase");

ok(migrationSql.includes("suggested_diseases_conditions_portal_text"), "33. migration has portal columns");
ok(migrationSql.includes("rpc_eaushadhi_product_portal_text_get"), "33. migration has portal_text_get");
ok(migrationSql.includes("rpc_eaushadhi_product_portal_text_save"), "33. migration has portal_text_save");
ok(migrationSql.includes("rpc_eaushadhi_worker_mark_save_ambiguous"), "33. migration has marker RPC");
ok(migrationSql.includes("rpc_eaushadhi_worker_run_rebase_portal_projection"), "33. migration has rebase RPC");
ok(migrationSql.includes("eaushadhi_diseases_ascii_v1"), "33. migration has ascii generator");
ok(migrationSql.includes("rpc_eaushadhi_worker_payload_get_legacy_v1"), "34. legacy payload sealed name");
ok(migrationSql.includes("rpc_eaushadhi_verify_product_legacy_v1"), "34. legacy verify sealed name");
ok(
  /revoke all on function public\.rpc_eaushadhi_worker_payload_get_legacy_v1/i.test(migrationSql),
  "34. legacy payload revoked",
);
ok(
  !/diseases_conditions_portal_review_status\s*=\s*'VERIFIED'/.test(
    migrationSql.split("Backfill")[1] || "",
  ) || migrationSql.includes("Never auto-VERIFIED") || migrationSql.includes("without auto-VERIFY"),
  "35. migration does not auto-VERIFY backfill",
);
ok(migrationSql.includes("is distinct from 'VERIFIED'"), "35. backfill skips VERIFIED rows");

// Audit vocabulary: action column is INSERT|UPDATE|DELETE only.
{
  const portalSaveFn = migrationSql.slice(
    migrationSql.indexOf("create or replace function public.rpc_eaushadhi_product_portal_text_save"),
    migrationSql.indexOf("create or replace function public.rpc_eaushadhi_worker_mark_save_ambiguous"),
  );
  ok(
    /'UPDATE'/.test(portalSaveFn) &&
      /v_event_kind/.test(portalSaveFn) &&
      /'event_kind',\s*v_event_kind/.test(portalSaveFn),
    "portal-text audit writes action=UPDATE with event_kind",
  );
  ok(
    /VERIFY_PORTAL_DISEASES_TEXT/.test(portalSaveFn) &&
      /SAVE_PORTAL_DISEASES_TEXT/.test(portalSaveFn),
    "semantic VERIFY/SAVE kinds remain under event_kind JSON",
  );
  ok(
    !/p_product_id::text,\s*case when p_verify then 'VERIFY_PORTAL_DISEASES_TEXT'/.test(portalSaveFn),
    "portal-text audit does not put custom verbs in action column",
  );

  const auditActionAfterEntityKey = [
    ...migrationSql.matchAll(
      /insert into regulatory\.audit_event[\s\S]{0,400}?::text,\s*'([A-Z_]+)'/g,
    ),
  ].map((m) => m[1]);
  ok(auditActionAfterEntityKey.length >= 3, "migration has expected audit_event inserts");
  ok(
    auditActionAfterEntityKey.every((a) => ["INSERT", "UPDATE", "DELETE"].includes(a)),
    `all audit_event.action literals are INSERT|UPDATE|DELETE (got ${auditActionAfterEntityKey.join(",")})`,
  );
}

console.log("\nPortal diseases projection contract smoke passed");
