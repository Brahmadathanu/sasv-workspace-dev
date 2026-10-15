import json,psycopg,sys,collections
DSN="host=/tmp port=54329 user=postgres dbname=costing_local"
d=json.load(open('live_ddl.json'))
c=psycopg.connect(DSN,autocommit=True)
c.execute("set check_function_bodies=off"); c.execute("set search_path=public,extensions")
c.execute(open('bootstrap.sql').read())
import re
ident=set()
for x in d:
    if x['k']=='table':
        sch,t=x['n'].split('.',1)
        for col in re.findall(r'(?:, |\()"?([a-z0-9_]+)"? [^,]*? generated (?:always|by default) as identity',x['s']): ident.add(f"{sch}.{t}_{col}_seq")
d=[x for x in d if not (x['k']=='sequence' and x['n'] in ident)]
print('identity seqs skipped',len(ident))
ok=set(); err={}
def run(x):
    try:
        c.execute(x['s']); ok.add((x['k'],x['n'])); err.pop((x['k'],x['n']),None); return True
    except Exception as e:
        err[(x['k'],x['n'])]=str(e).split('\n')[0][:200]; return False
for k in ['type','sequence','function','table','constraint','index','function']:
    for x in d:
        if x['k']==k and (k,x['n']) not in ok: run(x)
pending=[x for x in d if x['k'] in ('view','matview')]
for p in range(12):
    nxt=[x for x in pending if not run(x)]
    if len(nxt)==len(pending): break
    pending=nxt
for x in d:
    if x['k']=='index' and (x['k'],x['n']) in err: run(x)   # matview indexes
for x in d:
    if x['k'] in ('function','table','constraint','index') and (x['k'],x['n']) not in ok: run(x)
for k in ('fk','trigger'):
    for x in d:
        if x['k']==k: run(x)
tot=collections.Counter(x['k'] for x in d); okc=collections.Counter(k for k,_ in ok)
print({k:f"{okc[k]}/{tot[k]}" for k in tot})
json.dump({f"{k}|{n}":v for (k,n),v in err.items()},open('load_errors.json','w'),indent=0)
print('errors',len(err)); 
for (k,n),v in list(err.items())[:15]: print(k,n,v)
