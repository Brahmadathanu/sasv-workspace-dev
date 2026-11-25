#!/usr/bin/env python3
"""Extract REAL statement text for named views from supabase/migrations (no hand copies)."""
import re, sys, pathlib
root = pathlib.Path(sys.argv[1])
targets = [
 ("20261015165757_au2_run_governance.sql", "costing.v_costing_run_effective_designation"),
 ("20261015165757_au2_run_governance.sql", "costing.v_current_successful_costing_refresh_run"),
 ("20261019014458_w1_approved_run_feed_and_labels.sql", "costing.v_costing_period_run_status"),
]
out = []
for fn, name in targets:
    txt = (root / "supabase/migrations" / fn).read_text()
    m = re.search(r"create or replace view " + re.escape(name) + r" as.*?;\n", txt, re.S | re.I)
    if not m:
        sys.exit(f"cannot extract {name} from {fn}")
    out.append(m.group(0))
print("\n".join(out))
