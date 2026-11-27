# R8 narrow-screen correction N1

Starting commit `db59d0b687683e8013cf7eaf6386f5b7113a9a88`. Branch `fix/ei-r8-narrow-screen-n1`. Stable Electron release `v6.6.1`.

| Defect | Browser result | Correction |
| --- | --- | --- |
| N1 · Overview monthly sales | PASS | At 320px the baseline chart contents extended 141px past the figure’s right edge. The shared chart now has a shrinkable grid column, a proportional SVG, a wrapping date caption and reflowing statistics. |
| N2 · Sales Performance History | PASS | Baseline overhang at 320px was 115px. History uses the same fix. Overview and History are the two consumers of the shared renderer. The renderer reduces tick density according to the available space per month, retains all marks and gaps, and exposes exact values in the expandable Monthly values list. |
| N3 · Finance ageing | PASS | Opening now focuses Close. Tab wrapping, Escape and trigger focus restoration are covered. An explicit tap or keyboard navigation reaches the native date field. Enter is available to the browser while that field has focus. Physical iOS acceptance remains pending. |

## Evidence

- Full EI reporting and C1 regression passed 230/230 with zero skips, including the isolated PostgreSQL 17 reconciliation fixture.
- Cross-module static checks passed 100/100 across WP10, PEC and service-worker freshness. WP10 Chromium checks passed 81/81. The PEC protected-path mutation smoke rejected all three injected changes.

- Chromium and WebKit covered 320, 375, 390, 414, 430, 768 and 1440 CSS pixels in light and dark fixtures. Assertions check chart and page overflow, label spacing, date captions, supporting text, statistics, exact values, initial focus and date interaction. The dark fixture maps the shared legacy dark palette onto the semantic tokens because SASV Core currently ships a light theme.
- Playwright WebKit verifies the DOM focus and interaction path. The native iOS picker itself requires a physical device for acceptance.

| Synthetic screenshots | 320px light | 390px dark fixture | 1440px light |
| --- | --- | --- | --- |
| Overview | [320](r8-n1/overview-320-light.png) | [390](r8-n1/overview-390-dark.png) | [1440](r8-n1/overview-1440-light.png) |
| Sales History | [320](r8-n1/history-320-light.png) | [390](r8-n1/history-390-dark.png) | [1440](r8-n1/history-1440-light.png) |
| Ageing on open | [320](r8-n1/finance-ageing-320-light.png) | [390](r8-n1/finance-ageing-390-dark.png) | [1440](r8-n1/finance-ageing-1440-light.png) |

The dashboard script uses the new query version `ei-r8-n1-20261127`. The WP10 allowance pins only the two changed EI client files on the N1 branch. The package is scoped to client presentation, focus and regression evidence. Reporting contracts, calculations, permissions, server files, the service worker and Electron release files are identical to the starting commit.
