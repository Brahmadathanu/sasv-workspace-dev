# PEC S4 — PR-2026-07/08 review-required exceptions (read-only diagnostic)

**Date:** 22 Nov 2026 IST. **Project:** `qhmoqtxpeasamtlxaoak`. **Live PRs:** 16 (PR-2026-07, RM), 17 (PR-2026-08, PM). Both DRAFT, created 22 Nov 2026 and untouched as of this receipt. **No PR mutation authorised or performed.**

## Method and caveat

A single **read-only SQL diagnostic**, reconstructed from the current committed `proc_pec_s4_new_pr_plan` gate conditions and live source views (MRP, consumption, stock, MOQ), classified the Nov–Dec 2026 RM normal-scope and PM candidates. It did not impersonate an Editor, invoke a write RPC, register a migration, or save any purchase quantity. It reproduces the historical rolled-back review totals: **RM 30 / PM 7**. These are **not final operator decisions or permissions to bypass gates**. Recompute authoritative data under a signed-in Editor before any proposed reconciliation, because stock/MOQ evidence is time-sensitive.

## Breakdown

| Class | Review gate | Count | Required review |
|---|---|---:|---|
| RM | STOCK_MAPPING_REVIEW | 24 | Resolve stock-source mapping or missing stock, verify actual stock evidence |
| RM | NEGATIVE_STOCK_REVIEW | 4 | Reconcile negative book stock against physically supported corrections |
| RM | MOQ_POLICY_REVIEW | 2 | Resolve competing or invalid MOQ policies without arbitrary selection |
| PM | STOCK_MAPPING_REVIEW | 6 | Validate missing packaging stock-source mapping |
| PM | MOQ_POLICY_REVIEW | 1 | Resolve applicable MOQ |
| **Total** | | **37** | Do not automatically issue review-required quantities |

## RM — stock mapping review (24)

- #206 Chennel Enna
- #273 Eruma Chanakam
- #275 Eruma Varu
- #279 Eucalyptus Oil (P Sridhar & Co)
- #1218 Iruvi (D)
- #335 Kaala Kombu
- #360 Kalluppu
- #1197 Kalthamara
- #478 Kollankova Kizhangu (D)
- #491 Kopra Thenga
- #649 Nandukkal
- #710 Paal Thutham
- #751 Pasuvin Neyyu - Milma
- #833 Rasa Karpooram
- #853 Sanghu
- #868 Silasathu
- #905 Thamram
- #906 Thannikka (D)
- #913 Thavitu: Grade 1
- #935 Thiruneettu Pacha (D) (consumption-only; 12-month usage 0.35 Kg)
- #966 Uppu
- #978 Varali (stock quantity present but invalid source/mapping gate)
- #979 Varinellin Veru [D]
- #1033 Verukin Puzhuku

## RM — negative stock review (4)

| ID | Material | Current stock (Kg) |
|---|---|---:|
| 244 | Chura Thandu (D) | -1.600 |
| 475 | Kolarakku | -3.000 |
| 527 | Kurumulaku | -4.759 |
| 620 | Muringa Ila (D) | -0.545 |

## RM — MOQ policy review (2)

- #896 Thaleesapathri (D)
- #972 Uzhunnu

## PM — stock mapping review (6)

- #1291 25 G HDPE Jar - Milky White (Palpodi)
- #1292 8 x 10 Inch PP Cover - Natural
- #1319 Karaskara Thailam (Internal) - Leaflet
- #1275 Karaskara Thailam (Internal) 25 ML - Monocarton
- #1366 Thanurakshakan (Internal) - Leaflet
- #1341 Thanurakshakan (Internal) 25 ML - Monocarton

## PM — MOQ policy review (1)

- #1357 Chukku Podi 40 G - Monocarton

## Business/authorization gate

1. Preserve review-required items as review-required. No assumed stock, arbitrary MOQ or silent suggested positive quantity.
2. Only after explicit consolidated owner approval, use the canonical guarded reconciliation with reason, acknowledgement, fresh updated_at token and authorised Editor session, and verify the frozen evidence.
3. **Same-day restriction:** Both drafts were created 22 Nov 2026 IST. The canonical reconciler rejects a PR whose creation date is not today; from **23 Nov IST** these drafts require a separate governed historic-draft review rather than a bypass.
4. Keep v6.3.0 publication and staff rollout separately gated.
