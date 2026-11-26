#!/usr/bin/env python3
"""Extract REAL statement text for named views from supabase/migrations (no hand copies)."""
import re, sys, pathlib
root = pathlib.Path(sys.argv[1])
targets = [
 ("20261015165757_au2_run_governance.sql", "costing.v_costing_run_effective_designation"),
 ("20261015165757_au2_run_governance.sql", "costing.v_current_successful_costing_refresh_run"),
]
out = []
for fn, name in targets:
    txt = open(root / "supabase/migrations" / fn, newline="").read()
    m = re.search(r"create or replace view " + re.escape(name) + r" as.*?;\n", txt, re.S | re.I)
    if not m:
        sys.exit(f"cannot extract {name} from {fn}")
    out.append(m.group(0))
out.append((root/"docs/master-data-costing/retention/tests/live_period_status_20261125.sql").read_text())
txt=open(root/"supabase/migrations/20261019053600_w2_governed_period_lifecycle.sql",newline="").read()
m=re.search(r"create or replace function costing\.fn_w2_run_checks\(.*?\nend \$f\$;\n",txt,re.S|re.I)
if not m: sys.exit("cannot extract fn_w2_run_checks")
out.append(m.group(0))
# live guard bodies as pinned by S3L (md5 2fc573.. / 5629ce..) - copied from the reviewed S3L fixture, not hand-written here
s3l=open(root/"docs/master-data-costing/sql/S3L_SYNTHETIC_PG17_FIXTURE.sql",newline="").read()
for nm in ("fn_enforce_mutable_refresh_run_snapshot","fn_guard_designated_run_rows"):
    m=re.search(r"CREATE OR REPLACE FUNCTION costing\."+nm+r"\(\).*?\$function\$;\n",s3l,re.S)
    if not m: sys.exit("cannot extract "+nm)
    out.append(m.group(0))
# real selected-run resolver helpers (R3B guard targets), byte-faithful
for fn,nm in (("20260917132726_material_trace_selected_run_read_contract.sql","fn_resolve_material_trace_selected_run"),
              ("20260919103110_materials_stores_explain_optional_exact_run_read_contract.sql","fn_resolve_materials_stores_explain_selected_run"),
              ("20260918065615_qc_explain_optional_exact_run_read_contract.sql","fn_resolve_qc_explain_selected_run")):
    t=open(root/"supabase/migrations"/fn,newline="").read()
    m=re.search(r"create\s+or\s+replace\s+function\s+costing\."+nm+r"\(.*?\bAS\s+(\$\w*\$).*?\1\s*;",t,re.S|re.I)
    if not m: sys.exit("cannot extract "+nm)
    out.append(m.group(0)+"\n")
sys.stdout.buffer.write("\n".join(out).encode("utf-8"))
