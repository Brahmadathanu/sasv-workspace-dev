# WP10 — Classification HTML rendering security correction (2026-11-16)

## Review finding
Four master-data pages used `innerHTML` with untrusted database classification names in table row cells; Sub-categories, Product Groups and Sub-groups also interpolated existing names into double-quoted edit-input `value` attributes. This permitted HTML/attribute breakout by a hostile stored name in a client that had access to that name. Server-side permission checks and direct-DML revoke do not correct this presentation vulnerability.

## Draft fix
- New `js/classification-html-escape.js` encodes `&`, `<`, `>`, double quote and single quote, handling null as empty text.
- All four class-master renderers import the helper and encode interpolated labels; three inline edit renderers also encode old names in attribute contexts.
- New `scripts/wp10-g2-safeguards/classification-html-escape.test.mjs` exercises hostile HTML, event handler and quoted attribute input; it checks each renderer uses the encoding function, and that raw name interpolations are absent.
- `.github/workflows/wp10-g2-offline-verification.yml` runs that test before PostgreSQL/Chromium stages. Existing role and RPC tests remain mandatory.

## Verification and limitations
- The previous integrated [CI run 43851303896](https://github.com/Brahmadathanu/sasv-workspace-dev/actions/runs/43851303896) passed before this fix.
- [CI run 43854502311](https://github.com/Brahmadathanu/sasv-workspace-dev/actions/runs/43854502311) checks the fix; do not mark this head PASS until that run completes SUCCESS.
- The added test is a real helper-function unit test plus source-coverage assertions, not an end-to-end injection campaign against every possible consumer of classification names throughout the application. Scope is these four WP10 management screens.
- No production DML, RPC installations, privilege grants/revokes, merges, deployments, or flags changed. WP10 and owner production approval gates remain OPEN.
