# Debtor KYC client and PWA acceptance

Debtor KYC opens as a Finance-style in-page modal from Finance or from the outstanding KYC finding in Management Alerts. Finance stays mounted while its modal is open. Closing restores focus and leaves the Finance search, filters and scroll position intact. The alert opens the same modal with unclassified current debtors selected. The report's classification controls are in the existing Finance filter drawer. Company position and age-range totals remain visible beside the filtered receivables. The KYC and commercial permission targets are checked independently under Executive Intelligence access.

The client uses the deployed Finance and Debtor KYC contracts. The register covers current and historical accounts for KYC viewers. A commercial-only user can choose a current debtor by name or open a historical account using its canonical debtor ID. Contact information remains optional, and the outstanding KYC alert reflects effective classification. Finance export includes only ledger and bill fields.

## Preview

Start the loopback previews from the repository root.

| Mode | Command | URL |
| --- | --- | --- |
| Synthetic data with editor permissions | `node scripts/mis-c1/serve-ei-preview.mjs fixture` | [Debtor KYC fixture](http://127.0.0.1:5181/shared/executive-mis-dashboard.html#finance/debtor-kyc) |
| Authenticated data | `node scripts/mis-c1/serve-ei-preview.mjs live` | [Sign in via the local Utilities Hub](http://127.0.0.1:5180/utilities-hub/index.html), then [open Debtor KYC](http://127.0.0.1:5180/shared/executive-mis-dashboard.html#finance/debtor-kyc) |

The fixture accepts `?role=executive`, `kyc-viewer`, `kyc-editor`, `commercial-viewer`, `commercial-editor` or `viewer` before the hash. Fixture changes reset on reload. The live preview uses the normal signed-in Supabase session. Use the fixture for writes and checks that display sensitive profile or audit fields.

Sign in through the preview's Utilities Hub and use **Executive Intelligence → Finance → Debtor KYC**. The deploy preview is the authenticated candidate for physical iOS and desktop. The served entry references the candidate's versioned assets, and the JavaScript files and service worker were checked against the implementation. [Netlify preview](https://deploy-preview-555--sasv-utilities-hub.netlify.app/utilities-hub/index.html)

## Owner acceptance checklist

- [ ] Desktop and physical iOS show the expected Finance position chips, ageing settings, responsive bill drill-down and compact Debtor KYC button. Compare Finance Ageing and Debtor KYC headers, controls and tables.
- [ ] Finance search, selected filters and scroll position survive opening and closing Debtor KYC. The Management Alerts finding opens the unclassified current debtors directly on desktop and mobile.
- [ ] Company figures reconcile across partitions and age ranges. Check a negative receivables offset and an undated bill in fixture mode. Confirm the bill export respects the group, party and classification scope.
- [ ] In fixture mode, verify prospective classification, nullable optional fields, history, alias actions, master invalidation and revision errors. Review bulk changes before confirming.
- [ ] In fixture mode, verify independent KYC and commercial permissions, explicit zero discount, the No Scheme choice, separate inheritance and withdrawal on its effective date.
- [ ] Review the remaining R8 visual rounds for Materials Inventory, Finished Goods, Production Performance, Sales Performance, Management Alerts and shared UX. The recorded primary acceptance checkpoint is 3/10.
- [ ] Merge after owner approval. Verify the hosted production entry and versioned scripts after updating an installed PWA with the previous Finance assets cached. Confirm the live read-only Finance and Alerts flows on that install.
- [ ] Record the production PWA receipt before scheduling the later consolidated Electron v6.6.2 work. Stable Electron v6.6.1 and Sales Viewer remain available during this acceptance sequence.

The existing service worker fetches navigations from the network and keys static assets by exact URL. The Finance entry, model and new Debtor KYC scripts use versioned URLs. The regression suite exercises this upgrade with prior assets present in the cache.

## Verification evidence

The [Debtor KYC browser suite](../../../scripts/mis-g7-reporting/executive-intelligence-debtor-kyc.test.mjs) runs Chromium and WebKit at 320, 375, 390, 414, 430, 768 and 1440 CSS pixels. It exercises nested Escape, filter and sort layers, Finance state restoration and the fixture operations. The pull request's EI regression workflow attaches the TAP receipt, paired Finance and Debtor KYC captures, and 24 wider R8 fixture captures. Live authentication and physical iOS acceptance require owner review.
