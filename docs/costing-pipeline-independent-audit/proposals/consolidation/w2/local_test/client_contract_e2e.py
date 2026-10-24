# Drives the exact RPC calls the client module builds (node /tmp/calls.mjs -> calls.json) against the local W2 DB using named arguments (as PostgREST does).
exec(open('/workspace/w2/run_w2_tests.py').read().split("subprocess.run(['/workspace/w2/reset.sh']")[0])
subprocess.run(['/workspace/w2/reset.sh'],check=True,capture_output=True); apply()
c=conn(); U={'owner':as_user(OWNER),'editor':as_user(EDITOR)}
for who,call in json.load(open(sys.argv[1] if len(sys.argv)>1 else '/tmp/calls.json')):
    if who=='SIM':
        rid=int(call); sim_run(c,rid,NOV,'2026-11-05',bump=(rid==144)); continue
    args=', '.join(f"{k} => %s" for k in call['params'])
    r=one(U[who],f"select public.{call['name']}({args})",tuple(call['params'].values()))
    print('OK',who,call['name'],str(r)[:90])
