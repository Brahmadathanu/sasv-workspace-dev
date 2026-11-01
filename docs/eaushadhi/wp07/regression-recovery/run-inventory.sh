#!/bin/bash
# usage: runall.sh <tree> <outfile> [crlf]   -> TSV: file  tests pass fail exit  secs
TREE=$1; OUT=$2; MODE=$3
cd "$TREE" || exit 1
if [ "$MODE" = crlf ]; then export GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=core.autocrlf GIT_CONFIG_VALUE_0=true; fi
run1() { f=$1; s=$(date +%s); o=$(timeout 300 node --test "$f" 2>&1); rc=$?; e=$(date +%s)
  t=$(echo "$o" | grep -E '^# tests ' | awk '{print $3}'); p=$(echo "$o" | grep -E '^# pass ' | awk '{print $3}'); fl=$(echo "$o" | grep -E '^# fail ' | awk '{print $3}')
  printf '%s\t%s\t%s\t%s\t%s\t%s\n' "$f" "${t:-?}" "${p:-?}" "${fl:-?}" "$rc" "$((e-s))"; }
export -f run1
(ls scripts/*smoke*.mjs; git ls-files 'scripts/**/*.test.mjs' | sort) | xargs -P 6 -I{} bash -c 'run1 {}' | sort > "$OUT"
awk -F'\t' '{n++; if($5==0)ok++; else bad++} END{print n" files, "ok" exit0, "bad" nonzero"}' "$OUT"
