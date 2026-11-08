#!/bin/bash
# usage: bench.sh view label ; 1 warm-up discarded, then 7 runs, reports P50/max of Execution Time and buffers
S=$1; V=$2
for i in 1 2 3 4 5 6 7 8; do
 psql -h $S -p 5499 -U postgres -d t -qXAt -c "explain (analyze,buffers,format json) select * from public.$V order by scheme_name asc limit 1000" | python3 -c "
import json,sys;j=json.load(sys.stdin)[0];b=j['Plan'];print(round(j['Execution Time'],1),b.get('Shared Hit Blocks',0),b.get('Shared Read Blocks',0))"
done | tail -7 | sort -n | awk -v v=$V '{t[NR]=$1;h=$2;r=$3}END{print v, "p50_ms="t[4], "max_ms="t[7], "min_ms="t[1], "hit="h, "read="r}'
