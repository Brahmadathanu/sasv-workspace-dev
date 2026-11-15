#!/usr/bin/env bash
# WP10 G2 regression runner: prints fresh counts for every suite this package must keep green or preserve. Offline; isolated PostgreSQL + mocked Chromium only.
# Usage: bash scripts/wp10-g2-safeguards/run-regression.sh > docs/master-data-costing/WP10_G2_EVIDENCE/results/regression-counts.txt
cd "$(dirname "$0")/../.." || exit 1
c() { node --test "$@" 2>&1 | grep -E "^# (tests|pass|fail|skipped)" | tr '\n' ' '; echo; }
labels() { grep -E "^(# )?(PASS|FAIL|NOT PROVEN|SKIPPED)" | sed -E 's/^# //' | awk '{ if ($1=="NOT") print "NOT_PROVEN"; else print $1 }' | sort | uniq -c | tr '\n' ' '; echo; }
for t in horizon guards provenance draft-sql-static; do echo "== g2 $t (PASS/FAIL/NOT_PROVEN/SKIPPED labels)"; node scripts/wp10-g2-safeguards/$t.test.mjs 2>&1 | labels; done
for t in client-units source sw-delivery browser-products browser-readiness; do echo "== g2 $t (node:test)"; c scripts/wp10-g2-safeguards/$t.test.mjs; done
for t in transition-fixture fixture-mutation catalog-parity client-contract; do echo "== g1 $t (labels)"; node scripts/wp10-g1-safeguard-audit/$t.test.mjs 2>&1 | labels; done
echo "== readiness usability"; c scripts/costing-readiness-usability/readiness-usability.test.mjs
echo "== wp04 readiness client smoke"; node scripts/wp04-readiness-client-contract-smoke.mjs 2>&1 | tail -1
echo "== product/SKU lifecycle smoke"; node scripts/product-sku-lifecycle-smoke.mjs > /tmp/wp10-lifecycle.out 2>&1; echo "PASS lines: $(grep -c '^PASS' /tmp/wp10-lifecycle.out)"; grep -E '^FAIL' /tmp/wp10-lifecycle.out
for t in wp08-g2-0-shared-master-data/source wp08-g2-0-shared-master-data/fail-closed wp08-g2-0-shared-master-data/sw-freshness-and-gate wp08-g2-0-shared-master-data/browser wp08-g2-1-navigation/source wp08-g2-1-navigation/selection wp08-g2-1-navigation/resolver wp08-g2-1-navigation/browser pec-protected-path-guard pec-pwa-cache-freshness wp09-protected-sw-pin; do echo "== $t"; c scripts/$t.test.mjs; done
echo END
