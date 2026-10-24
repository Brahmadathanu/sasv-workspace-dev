import json, collections
rows=json.load(open('rows.json'))
def tags(r):
    t=[]
    if r['master_seasonal']: t.append('MASTER_SEASONAL')
    if r['launch_recent']: t.append('NEW_LAUNCH')
    if r['maxday_share_of_peak']>=0.5 and r['maxday_share_12m']>=0.25: t.append('BULK_SINGLE_DAY')
    if r['free_share_peak']>=0.2 and r['free_share_peak']>=2*max(r['free_share_12m'],0.01): t.append('PROMOTION_FREE_GOODS')
    if r['stockout_months_ge10d']>=3: t.append('SUPPLY_CONSTRAINT')
    if r['top3_share_prev'] is not None and r['top3_share_prev']>=0.5 and r['recur_overlap']>=2 and r['units_prev12m']>0: t.append('RECURRING_PATTERN')
    if r['selling_months']<=3: t.append('SPORADIC')
    return t
order=['MASTER_SEASONAL','NEW_LAUNCH','BULK_SINGLE_DAY','PROMOTION_FREE_GOODS','SUPPLY_CONSTRAINT','RECURRING_PATTERN','SPORADIC']
for r in rows:
    r['tags']=tags(r)
    r['primary']=next((o for o in order if o in r['tags']),'UNEXPLAINED')
json.dump(rows,open('rows.json','w'))
r101=[r for r in rows if r['in101']]
print(collections.Counter(r['primary'] for r in r101))
print(collections.Counter(t for r in r101 for t in r['tags']))
print('multi-tag', sum(len(r['tags'])>1 for r in r101))
for p in ['RECURRING_PATTERN','UNEXPLAINED','SPORADIC','BULK_SINGLE_DAY','SUPPLY_CONSTRAINT','NEW_LAUNCH']:
    print('==',p)
    for r in [x for x in r101 if x['primary']==p][:8]:
        print(r['sku_id'],r['product'][:28],r['pack'],'u12',r['units_12m'],'sh',r['top3_share'],'prev',r['top3_share_prev'],'sell',r['selling_months'],'maxday%',r['maxday_share_of_peak'],'so',r['stockout_months_ge10d'],'1st',r['first_sale_month'],r['tags'])
ms_out=[r for r in rows if r['master_seasonal'] and not r['in101']]
print('master not in 101', len(ms_out))
for r in ms_out: print(r['sku_id'],r['product'][:30],r['pack'],'u12',r['units_12m'],'sh',r['top3_share'],'sell',r['selling_months'],r['run128_source'])
