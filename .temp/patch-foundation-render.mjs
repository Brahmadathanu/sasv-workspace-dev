import { readFileSync, writeFileSync } from "node:fs";

const path = "public/shared/js/costing-suite-production-route.js";
const src = readFileSync(path, "utf8");
const marker = "\n  function renderRouteFamilies() {";
if (!src.includes(marker)) throw new Error("marker missing");
if (src.includes("function renderFoundationReview()")) {
  console.log("already patched");
  process.exit(0);
}

const block = `
  function openFoundationReviewGroupModal(group) {
    if (!group) return;
    const classCode = group.group_evidence_class;
    const classLabel = formatPrmFoundationGroupEvidenceClassLabel(classCode);
    const guidance = formatPrmFoundationReviewGuidanceNote(classCode);
    const note =
      group.approval_note ||
      state.foundationReviewPayload?.approval_note ||
      "Foundation evidence is review-only. It never creates a Route Family, mapping or approved route.";
    const productRows = (group.products || [])
      .map((member, index) => {
        const evidence = normalizePrmCode(member.evidence_class).toUpperCase();
        const canDrill =
          evidence === "HISTORICAL_EVIDENCE_SUFFICIENT" ||
          evidence === "HISTORICAL_EVIDENCE_LIMITED";
        const drill = canDrill
          ? \`<button type="button" class="icon-btn" data-prm-foundation-historical="\${index}">View Historical Evidence</button>\`
          : \`<span class="cp-muted-text">—</span>\`;
        return \`<tr class="cp-prm-foundation-product-row">
          <td><div class="cp-cell-primary">\${text(member.product_name || member.product_id)}</div></td>
          <td>\${text(member.product_id)}</td>
          <td title="\${text(member.evidence_class || "")}">\${text(
            formatPrmFoundationProductEvidenceClassLabel(member.evidence_class),
          )}</td>
          <td class="c-right">\${text(member.eligible_batches)}</td>
          <td>\${text(member.candidate_status || "—")}</td>
          <td>\${drill}</td>
        </tr>\`;
      })
      .join("");
    const stepRows = (group.family_steps || [])
      .map((step) => {
        const activity =
          step.activity_kind_name ||
          step.activity_short_code ||
          formatPrmFoundationIdLabel("Activity kind", step.activity_kind_id);
        const area =
          step.modal_area_id != null
            ? formatPrmFoundationIdLabel("Area", step.modal_area_id)
            : "—";
        const plant =
          step.modal_plant_id != null
            ? formatPrmFoundationIdLabel("Plant", step.modal_plant_id)
            : "—";
        return \`<tr class="cp-prm-foundation-step-row">
          <td>\${text(activity)}</td>
          <td>\${text(step.activity_short_code || "—")}</td>
          <td title="\${text(step.family_evidence_class || "")}">\${text(
            formatPrmFoundationFamilyStepEvidenceClassLabel(
              step.family_evidence_class,
            ),
          )}</td>
          <td class="c-right">\${text(step.products_supporting_step)}</td>
          <td class="c-right">\${text(
            formatPrmFoundationSupportRatio(step.product_support_ratio),
          )}</td>
          <td class="c-right">\${text(
            formatPrmFoundationSupportRatio(step.average_product_batch_coverage),
          )}</td>
          <td>\${text(area)}</td>
          <td>\${text(plant)}</td>
        </tr>\`;
      })
      .join("");

    openModal({
      title:
        group.product_group_name || \`Product Group \${group.product_group_id}\`,
      subtitle: "Foundation Review — evidence",
      html: \`<div class="cp-prm-summary" data-prm-foundation-review-modal>
        <section class="cp-detail-section">
          <h3 class="cp-section-title">Product Group</h3>
          <div class="cp-detail-grid cp-detail-grid--2col">
            <div><div class="cp-field-label">Category</div><div>\${text(group.category_name)}</div></div>
            <div><div class="cp-field-label">Subcategory</div><div>\${text(group.subcategory_name)}</div></div>
            <div><div class="cp-field-label">Product Group</div><div class="cp-cell-primary">\${text(
              group.product_group_name || group.product_group_id,
            )}</div></div>
            <div><div class="cp-field-label">Product Group ID</div><div>\${text(group.product_group_id)}</div></div>
          </div>
        </section>
        <section class="cp-detail-section">
          <h3 class="cp-section-title">Evidence summary</h3>
          <div class="cp-detail-grid cp-detail-grid--2col">
            <div><div class="cp-field-label">Products</div><div class="cp-cell-primary">\${text(group.product_count)}</div></div>
            <div><div class="cp-field-label">Sufficient</div><div>\${text(group.sufficient_products)}</div></div>
            <div><div class="cp-field-label">Limited</div><div>\${text(group.limited_products)}</div></div>
            <div><div class="cp-field-label">No evidence</div><div>\${text(group.no_evidence_products)}</div></div>
            <div><div class="cp-field-label">Total eligible batches</div><div>\${text(group.total_eligible_batches)}</div></div>
            <div><div class="cp-field-label">Average eligible batches</div><div>\${text(
              group.avg_eligible_batches == null ? "—" : group.avg_eligible_batches,
            )}</div></div>
            <div><div class="cp-field-label">Maximum eligible batches</div><div>\${text(group.max_eligible_batches)}</div></div>
            <div class="cp-detail-span-full"><div class="cp-field-label">Group evidence class</div><div title="\${text(
              classCode || "",
            )}">\${text(classLabel)}</div></div>
          </div>
        </section>
        <section class="cp-detail-section">
          <h3 class="cp-section-title">Products</h3>
          <div class="cp-prm-foundation-products-wrap">
            <table class="cp-prm-foundation-products">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Product ID</th>
                  <th>Evidence Class</th>
                  <th class="c-right">Eligible Batches</th>
                  <th>Candidate Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>\${
                productRows ||
                \`<tr><td colspan="6"><span class="cp-muted-text">No Products in this group.</span></td></tr>\`
              }</tbody>
            </table>
          </div>
        </section>
        <section class="cp-detail-section">
          <h3 class="cp-section-title">Representative family-step evidence</h3>
          <div class="cp-prm-foundation-steps-wrap">
            <table class="cp-prm-foundation-steps">
              <thead>
                <tr>
                  <th>Activity</th>
                  <th>Code</th>
                  <th>Evidence Class</th>
                  <th class="c-right">Products Supporting</th>
                  <th class="c-right">Support Ratio</th>
                  <th class="c-right">Average Batch Coverage</th>
                  <th>Modal Area</th>
                  <th>Modal Plant</th>
                </tr>
              </thead>
              <tbody>\${
                stepRows ||
                \`<tr><td colspan="8"><span class="cp-muted-text">No family-step evidence returned for this group.</span></td></tr>\`
              }</tbody>
            </table>
          </div>
        </section>
        <p class="cp-prm-form-notice" data-prm-foundation-review-note>\${text(guidance)}</p>
        <p class="cp-muted-text" style="margin:6px 0 0">\${text(note)}</p>
      </div>\`,
      bind: (host) => {
        onModal(host, "click", (event) => {
          const btn = event.target.closest("[data-prm-foundation-historical]");
          if (!btn) return;
          event.preventDefault();
          const idx = Number(btn.getAttribute("data-prm-foundation-historical"));
          const member = (group.products || [])[idx];
          const productId = normalizePrmIntegerId(member?.product_id);
          if (productId == null) return;
          closeModal({ restorePrevious: false });
          navigate("historical-candidate-review", {
            product_id: productId,
            candidate_kind: "product",
          });
        });
      },
    });
  }

  function renderFoundationReview() {
    const host = hosts();
    host.tableWrap?.classList.remove("hidden");
    const table = document.getElementById("mainTable");
    if (table) table.style.display = "";
    clearLensOwnedDom();
    const payload = state.foundationReviewPayload;
    const classMap = getPrmFoundationReviewClassSummaryMap(payload?.class_summary);
    const periodLabel =
      formatPrmMonthYearLabel(payload?.period_start) ||
      formatPrmMonthYearLabel(PRM_FOUNDATION_REVIEW_EXACT_RUN_CONTEXT.period_start) ||
      "—";
    const valuationLabel =
      formatPrmDayMonthYearLabel(payload?.valuation_date) ||
      formatPrmDayMonthYearLabel(
        PRM_FOUNDATION_REVIEW_EXACT_RUN_CONTEXT.valuation_date,
      ) ||
      "—";
    const runId =
      payload?.refresh_run_id ??
      PRM_FOUNDATION_REVIEW_EXACT_RUN_CONTEXT.refresh_run_id;
    const asOfLabel =
      formatPrmDayMonthYearLabel(payload?.as_of_date) ||
      formatPrmDayMonthYearLabel(getAsOfDate()) ||
      "—";
    const targetProducts = payload?.target_product_count ?? 0;
    const targetGroups = payload?.target_product_group_count ?? 0;
    const immutability = \`Current source review does not rewrite Run \${runId}.\`;

    if (host.summary) {
      host.summary.classList.add(
        "is-visible",
        "cp-prm-foundation-review-summary-host",
      );
      const classChips = PRM_FOUNDATION_REVIEW_GROUP_EVIDENCE_CLASSES.map(
        (code) => {
          const counts = classMap[code] || { group_count: 0, product_count: 0 };
          return \`<span class="cp-prm-foundation-class-chip" data-prm-foundation-class="\${text(
            code,
          )}" title="\${text(formatPrmFoundationGroupEvidenceClassLabel(code))}">\${text(
            counts.group_count,
          )} \${text(code.replace(/_/g, " ").toLowerCase())}</span>\`;
        },
      ).join('<span class="cp-prm-foundation-meta-sep" aria-hidden="true">·</span>');
      host.summary.innerHTML = \`<div
      class="cp-prm-foundation-review-meta"
      data-prm-foundation-review-context
      title="\${text(immutability)}"
      aria-description="\${text(immutability)}"
    >
      <span data-prm-foundation-review-frozen>Frozen: Run \${text(runId)} · \${text(periodLabel)} · Valuation \${text(valuationLabel)}</span>
      <span class="cp-prm-foundation-meta-sep" aria-hidden="true">·</span>
      <span data-prm-foundation-review-asof>Current source: \${text(asOfLabel)}</span>
      <span class="cp-prm-foundation-meta-sep" aria-hidden="true">·</span>
      <span data-prm-foundation-target>\${text(targetProducts)} Products · \${text(targetGroups)} uncovered groups</span>
      <span class="cp-prm-foundation-meta-sep" aria-hidden="true">·</span>
      \${classChips}
    </div>\`;
    }

    host.tableHead.innerHTML = \`<tr>
      <th>Category</th>
      <th>Subcategory</th>
      <th>Product Group</th>
      <th class="c-right">Products</th>
      <th class="c-right">Sufficient</th>
      <th class="c-right">Limited</th>
      <th class="c-right">No Evidence</th>
      <th class="c-right">Eligible Batches</th>
      <th>Evidence Class</th>
    </tr>\`;

    if (state.foundationReviewLoadError) {
      host.tableBody.innerHTML = \`<tr><td colspan="9"><div class="status">\${text(state.foundationReviewLoadError)}</div></td></tr>\`;
      return;
    }
    if (state.loading && !state.foundationReviewGroups.length) {
      host.tableBody.innerHTML = \`<tr><td colspan="9"><div class="cost-sheet-explain-loading">Loading Foundation Review…</div></td></tr>\`;
      return;
    }
    if (!state.foundationReviewGroups.length) {
      host.tableBody.innerHTML = \`<tr><td colspan="9"><div class="status">No uncovered Product Group foundation evidence for this exact-run context.</div></td></tr>\`;
      return;
    }

    host.tableBody.innerHTML = state.foundationReviewGroups
      .map((group, index) => {
        const groupName =
          group.product_group_name || \`Product Group \${group.product_group_id}\`;
        const ariaLabel = \`Open Foundation Review for \${groupName}\`;
        return \`<tr class="cp-prm-row cp-prm-foundation-review-row" tabindex="0" role="button" data-prm-foundation-review-group="\${index}" aria-label="\${text(
          ariaLabel,
        )}">
          <td>\${text(group.category_name)}</td>
          <td>\${text(group.subcategory_name)}</td>
          <td>
            <div class="cp-cell-primary">\${text(groupName)}</div>
            <div class="cp-muted-text">Group \${text(group.product_group_id)}</div>
          </td>
          <td class="c-right">\${text(group.product_count)}</td>
          <td class="c-right">\${text(group.sufficient_products)}</td>
          <td class="c-right">\${text(group.limited_products)}</td>
          <td class="c-right">\${text(group.no_evidence_products)}</td>
          <td class="c-right">\${text(group.total_eligible_batches)}</td>
          <td title="\${text(group.group_evidence_class || "")}">\${text(
            formatPrmFoundationGroupEvidenceClassLabel(group.group_evidence_class),
          )}</td>
        </tr>\`;
      })
      .join("");

    bindRows();
  }

`;

writeFileSync(path, src.replace(marker, block + marker), "utf8");
console.log("inserted foundation render");
