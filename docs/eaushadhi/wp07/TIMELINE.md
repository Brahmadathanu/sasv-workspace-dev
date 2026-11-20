# WP-07 timeline — what was completed (one page, as recorded in repo docs; 1 Nov 2026)

Sources: branch `feat/wp07-ux1-worklist` commit log, [../WP-07_MIGRATION_RECORD.md](../WP-07_MIGRATION_RECORD.md), [../CHANGELOG_DECISIONS.md](../CHANGELOG_DECISIONS.md). Dates IST.

| Date | Milestone | Server (live version) | Client commit(s) |
|---|---|---|---|
| 9–11 Oct | QC register foundation: Product 262 QC read probe; C1b QC preparation rules | B3 QC evidence binding `20261011135744` (live 11 Oct) | `3b32f10`, `aa38dd4` |
| 11 Oct | D3.3 byte-check modal; **D4** Verify source facts UI; **D4.1** saved report filename; D4.2 saved facts / reopen; D4.3 **B3.1** migration parity | B3 / B3.1 (see CHANGELOG 11 Oct) | `f9d5b37`, `d599fe4`, `fad593e`, `1417af6`, `553b0af` |
| 14 Oct | D7.2 per-row Save decision + dry run that cannot click | — | `9dd4f31` |
| earlier Oct | **Product 262** verified on the portal: Product Details and Composition `PORTAL_VERIFIED` (reference product, kept locked) | — | see [../WP-07_QC_REGISTER.md](../WP-07_QC_REGISTER.md) |
| 24 Oct | **UX-1** worklist: one next step, who can do it, why a button is off | `20261024115131` roles + worklist | `bd34a00` |
| 25 Oct | UX-1.1 compact table; **UX-1.2** canonical classification (ADR-01); four-eyes guards (ADR-02) | `20261025163252`, `20261025173239` | `523b542`, `495f161`, `2b4a01f`, `2ee89d3` |
| 26 Oct | **UX-2** approve only after someone else saved; refusal reasons (ADR-03) | `20261026133841` | `9a0593c`, `851804c` |
| 27 Oct | Bulk seed of review rows (ADR-05); saved-for-review-by fix (ADR-06) | `20261027135522`, `20261027161124` | — |
| 28 Oct | **UX-5** lock verified fields, leave confirm, composition Save for review; UX-5.1 | — | `a5877f4`, `e3183cc` |
| 29 Oct | **UX-3** Fill on portal stepper (read-only), gate toggle; **PKG2**, **PKG3a** gate (ADR-08, only 262), **PKG1** options (ADR-09) | `20261029141456`, `20261029141512`, `20261029144643` | `a61d3d6`, `f20eec8`, `3603ea7`, `78cf8a6` |
| 30 Oct | UX-3 F1; **UX-6** compact layout; **UX-6.1/6.1 B/6.2** locked text and colours; **UX-7** composition table; **UX-8** line modal (ADR-11) | — | `aafadc8`, `d432f83`, `2f7674d`, `273b11c`, `49d6766`, `2ce4307`, `e82cb18`, `5eebcb4` |
| 31 Oct | **UX-8.1** accepted; **UX-9** bulk source reference server (ADR-13) + client; **UX-9.1** toolbar/filter drawer/one scroll bar/floating helper (ADR-14) | **`20261031102139`** | `3d09c0f`, `eec3531`, `747fc86`, `db9bbda`, `12246a4`, `986a656`, `366606d`, `c5821b1` |
| 1 Nov | Owner screen check at `c5821b1` (A4–A6 found); **ADR-15** ChatGPT orchestrator + Claude Code client worker; Bundle A approved; docs refreshed | — | — |

Main's cache moved v383 → v387 (costing PRs #106–#112) while the WP-07 branch stayed on v376 (unmerged). Rows marked "earlier Oct" are summarised from the QC register; exact dates there.
