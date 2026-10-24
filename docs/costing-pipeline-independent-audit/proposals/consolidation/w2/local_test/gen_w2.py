import json,hashlib
d=json.load(open('/workspace/w1w5/defs/live_defs.json'))['fns']
md5=lambda s: hashlib.md5(s.encode()).hexdigest()
rows=d['costing.fn_guard_designated_run_rows()']; hdr=d['costing.fn_guard_designated_run_header()']
assert md5(rows)=='a3c4217fa914c798941652e4465c3822' and md5(hdr)=='9091f26fb86022be55cd145353db3a18'
A="v_des in ('REFERENCE','APPROVED')"; B="v_des in ('REFERENCE','APPROVED','REVOKED')"
assert rows.count(A)==2 and hdr.count(A)==1
rows2=rows.replace(A,B); hdr2=hdr.replace(A,B)
sql=open('w2_body.sql').read().replace('@@ROWS_GUARD@@',rows2.rstrip()+';').replace('@@HEADER_GUARD@@',hdr2.rstrip()+';')
open('PREPARED_W2_governed_period_lifecycle.sql','w').write(sql)
print(md5(sql),len(sql))
