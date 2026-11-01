import json,openpyxl,math,collections
import sys; t=open(sys.argv[1]).read()
o=json.loads(t[t.find('{"result"'):t.rfind('}')+1])['result']
db=json.loads(o[o.find('[{'):o.rfind('}]')+2])[0]['json_agg']
f=lambda x: None if x is None else float(x)
wb=openpyxl.load_workbook('wb.xlsx',data_only=True)
def sheet_calc(J,K,L,M,O,P,R,S,N=None):
    T=J/(1+K/100); U=T*(1-P/100); V=U*R/(R+S) if R+S>0 else None
    W=U*O/100; X=V-W-M; Y=X-L
    Z=Y/J*100 if J>0 else None; AA=Y/U*100 if U>0 else None; AB=Y/X*100 if X>0 else None
    N=L+M if N is None else N
    a=((1-P/100)*R/(R+S)-(1-P/100)*O/100)/(1+K/100); t=7/100; den=a-t
    AF=None if den<=0 else max(N/den,0)
    return dict(basic=T,sell=U,sch=V,cont=W,nsr=X,prof=Y,pmrp=Z,psell=AA,pnsr=AB,minmrp=AF)
# 1) fidelity: reimplementation vs sheet's own cached values
fid=collections.Counter(); fidbad=[]
for reg in ('IK','OK'):
    ws=wb['PROMOTIONAL VIABILITY - '+reg]
    for r in range(3,599):
        B=ws.cell(r,2).value
        if B in (None,''): continue
        g=lambda c: ws[f'{c}{r}'].value
        try:
            vals=[float(g(c)) for c in 'JKLMO']; P=float(g('P') or 0); R=float(g('R')); S=float(g('S'))
        except (TypeError,ValueError): fid['skip_input']+=1; continue
        c=sheet_calc(*vals,P,R,S,N=float(g('N')))
        ok=all(abs(c[k]-float(g(col)))<=0.01 for k,col in [('basic','T'),('sell','U'),('sch','V'),('cont','W'),('nsr','X'),('prof','Y')]) and (g('AF') in (None,'') or c['minmrp'] is None or abs(c['minmrp']-float(g('AF')))<=0.01)
        fid['ok' if ok else 'bad']+=1
        if not ok: fidbad.append((reg,B))
# sheet sku membership & master data parity
md=wb['MASTER DATA']; mdrows={}
for r in range(2,800):
    s=md.cell(r,4).value
    if s in (None,''): continue
    mdrows[int(s)]={h:md.cell(r,c).value for c,h in enumerate([md.cell(1,c).value for c in range(1,64)],1)}
run_id=md['A2'].value
# 2) main recon: sheet formulas fed run-143 inputs vs CI-037 DB
res=collections.Counter(); mism=[]; excl=collections.Counter(); exlist=[]; parity=collections.Counter(); parbad=[]
fields=['basic','sell','cont','sch','nsr','prof','pmrp','psell','pnsr']
for d in db:
    mrp,gst,disc,cp,pq,fq,mkt,ilc=map(f,[d['mrp'],d['gst'],d['disc'],d['cpct'],d['pq'],d['fq'],d['mkt'],d['ilc']])
    # DB CI-037 (same arithmetic as fn_ci037_fill_pricing_bridge_profit, using stored DB basic/sell/cont)
    sell=f(d['sell']); cont=f(d['cont']); sch=sell*pq/(pq+fq); nsr=sch-cont-mkt; prof=nsr-ilc
    dbv=dict(basic=f(d['basic']),sell=sell,cont=cont,sch=sch,nsr=nsr,prof=prof,pmrp=prof/mrp*100,psell=prof/sell*100,pnsr=prof/nsr*100 if nsr>0 else None)
    sh=sheet_calc(mrp,gst,ilc,mkt,cp,disc,pq,fq)
    bad=[k for k in fields if (dbv[k] is None)!=(sh[k] is None) or (dbv[k] is not None and abs(dbv[k]-sh[k])>0.01)]
    if bad: res['mismatch']+=1; mism.append((d['sku_id'],d['r'],bad,{k:(round(dbv[k],4) if dbv[k] is not None else None,round(sh[k],4) if sh[k] is not None else None) for k in bad}))
    else: res['match']+=1
    if not d['in_pl']: excl[d['r']]+=1; exlist.append((d['sku_id'],d['r']))
    m=mdrows.get(d['sku_id'])
    if m is None: parity['not_in_master']+=1
    else:
        pairs=[(mrp,m['IK MRP (₹)' if d['r']=='IK' else 'OK MRP (₹)']),(ilc,m['Internal Loaded Cost (₹)']),(mkt,m['IK Marketing Expense (₹)' if d['r']=='IK' else 'OK Marketing Expense (₹)']),(disc,m['IK Discount (%)' if d['r']=='IK' else 'OK Discount (%)']),(gst,m['GST (%)']),(cp,m['Contingency (%)'])]
        okp=all(a is not None and b is not None and abs(a-float(b))<=0.0001 for a,b in pairs)
        parity['same' if okp else 'diff']+=1
        if not okp: parbad.append((d['sku_id'],d['r'],pairs))
# 3) synthetic 5+1
syn=[]
for d in db:
    if d['sku_id'] in (45,51):
        mrp,gst,disc,cp,mkt,ilc=map(f,[d['mrp'],d['gst'],d['disc'],d['cpct'],d['mkt'],d['ilc']])
        sh=sheet_calc(mrp,gst,ilc,mkt,cp,disc,5,1)
        sell=f(d['sell']); cont=f(d['cont']); sch=sell*5/6; nsr=sch-cont-mkt; prof=nsr-ilc
        syn.append((d['sku_id'],d['r'],round(sh['sch'],2),round(sch,2),round(sh['nsr'],2),round(nsr,2),round(sh['prof'],2),round(prof,2),round(sh['minmrp'],2)))
# DB sums check vs dry run
sums=collections.defaultdict(float)
for d in db:
    sums[d['r']]+=f(d['sell'])*f(d['pq'])/(f(d['pq'])+f(d['fq']))-f(d['cont'])-f(d['mkt'])-f(d['ilc'])
out=dict(fidelity=dict(fid),fidbad=fidbad[:20],run_id=run_id,res=dict(res),mism=mism[:30],nmism=len(mism),excl=dict(excl),exlist=exlist,parity=dict(parity),parbad=parbad[:15],nparbad=len(parbad),syn=syn,sums={k:round(v,2) for k,v in sums.items()},n=len(db))
json.dump(out,open('recon_out.json','w'),indent=1,default=str)
print(json.dumps({k:v for k,v in out.items() if k not in('exlist',)},indent=0,default=str)[:6000]); print('excluded',len(exlist))
