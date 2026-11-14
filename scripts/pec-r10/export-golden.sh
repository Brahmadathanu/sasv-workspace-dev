#!/usr/bin/env bash
# F3: export the server's ACTUAL collision-preview JSON for synthetic states, so the client UX smoke can
# replay real server output instead of hand-written objects. Disposable database via the F1 guard.
#   export-golden.sh <output-dir>
set -u
OUTDIR=${1:?output directory}
. "$(dirname "$0")/lib.sh" matrix guarded
mkdir -p "$OUTDIR" || exit 2
seed
q "select public.proc_indent_resync_collision_preview(1)" > "$OUTDIR/preview-blocked.json"
q "select public.proc_indent_resync_collision_preview(7)" > "$OUTDIR/preview-clean.json"
q "select public.proc_indent_resync_collision_preview(3)" > "$OUTDIR/preview-ineligible-approved.json"
q "select public.proc_indent_resync_collision_preview(4)" > "$OUTDIR/preview-ineligible-no-source.json"
for f in "$OUTDIR"/preview-*.json; do [ -s "$f" ] || { echo "empty golden file $f" >&2; exit 2; }; done
echo "GOLDEN exported $(ls "$OUTDIR"/preview-*.json | wc -l) preview files from the synthetic fixture to $OUTDIR"
