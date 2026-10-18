import json, re, csv, collections
M=json.load(open('machinery.json'))
names=collections.Counter(m['plant_name'] for m in M)
def rule(m):
    t=(m['type_name'] or ''); n=m['plant_name']; sub=m['subsection_name'] or ''; area=m['area_name'] or ''
    flags=[]
    if m['status']=='N': flags.append('STATUS_N_NOT_OPERATIONAL')
    if names[n]>1: flags.append('DUPLICATE_NAME_OTHER_LOCATION')
    rated=None; unit=None; ev='NONE'
    mm=re.search(r'\((\d+)\s*L\)',n)
    if mm: rated=float(mm.group(1)); unit='L'; ev='NAME_RATED_VOLUME'
    # defaults
    app='CAPACITY_BASED_PRODUCTION'; mode='CHARGE'; basis='SOLID_CHARGE_KG'; unit=unit or 'kg'; rc=None; eqc=None; need='YES'
    if t in ('Grinder',):
        rc='GRINDER'
        if 'Khalvam' in n: eqc='KHALVAM_MANUAL_LEVIGATION'; flags.append('CONFIRM_MANUAL_TOOL_OR_CAPACITY_ASSET')
        elif 'Stone' in n: eqc='STONE_GRINDER'
        elif sub=='Pills': eqc='PILLS_WET_GRINDER'
        elif sub=='Rasoushadhi': eqc='RASOUSHADHI_LEVIGATION_GRINDER'
        else: eqc='WET_GRINDER'
    elif t in ('Pulverizer','Disintegrator'): rc='GRINDER'; eqc='PULVERISER_DISINTEGRATOR'; mode='THROUGHPUT'; basis='FEED_RATE_KG_PER_HOUR'; unit='kg/h'
    elif t=='Sieving Machine': rc='GRINDER'; eqc='VIBRO_SIFTER'; mode='THROUGHPUT'; basis='FEED_RATE_KG_PER_HOUR'; unit='kg/h'
    elif t=='Dryer':
        rc='DRYER_OR_OVEN'
        if 'Tray' in n: eqc='ELECTRIC_TRAY_DRYER_24'; flags.append('NAME_GIVES_24_TRAYS_KG_PER_TRAY_NEEDED')
        else: eqc='FIREWOOD_DRYER'
    elif t in ('SS Cooker',): rc='EXTRACTION_SYSTEM'; eqc='SS_COOKER'; basis='OUTPUT_VOLUME_L'; unit='L'
    elif t in ('SS Processing Vessel','SS Open Vessel'): rc='PROCESSING_VESSEL'; eqc='SS_PROCESSING_VESSEL' if 'Processing' in t else 'SS_OPEN_VESSEL'; basis='OUTPUT_VOLUME_L'; unit='L'
    elif t=='Processing Vessel': rc='PROCESSING_VESSEL' if 'Chembu' in n else 'TRADITIONAL_FURNACE'; eqc='TRADITIONAL_METAL_VESSEL'; basis='SOLID_CHARGE_KG'
    elif t=='Fermentation Tank':
        rc='FERMENTATION_VESSEL'; basis='OUTPUT_VOLUME_L'; unit='L'
        if 'Water Tank' in n: eqc='WATER_TANK_USED_AS_FERMENTATION'; flags.append('TYPE_NAME_MISMATCH_WATER_TANK_LOGGED_AS_FERMENTATION')
        else: eqc='FERMENTATION_TANK_1500L' if rated==1500 else ('FERMENTATION_TANK_3000L' if rated==3000 else 'FERMENTATION_TANK')
    elif t=='Mixing Machine': rc='MIXING_EQUIPMENT'; eqc='PLANETARY_MIXER'
    elif t in ('Granulator Machine',): rc='TABLET_OR_CAPSULE_EQUIPMENT'; eqc='RAPID_MIXER_GRANULATOR' if 'Rapid' in n else 'GRANULATOR_SIZING'
    elif t=='Tablet Coating Pan': rc='TABLET_OR_CAPSULE_EQUIPMENT'; eqc='COATING_PAN'
    elif t in ('Tablet Punching Machine',): rc='TABLET_OR_CAPSULE_EQUIPMENT'; eqc='ROTARY_TABLET_PRESS'; mode='THROUGHPUT'; basis='OUTPUT_UNITS_PER_HOUR'; unit='Nos/h'
    elif t in ('Capsule Filling Machine','Empty Capsule Loading Machine'): rc='TABLET_OR_CAPSULE_EQUIPMENT'; eqc='CAPSULE_FILLER' if 'Filling' in t else 'CAPSULE_LOADER'; mode='THROUGHPUT'; basis='OUTPUT_UNITS_PER_HOUR'; unit='Nos/h'
    elif t in ('Pill Making Machine','Extruding Machine'): rc='PILL_PROCESSING'; eqc='PILL_MAKER' if 'Pill' in t else 'SCREW_EXTRUDER'; mode='THROUGHPUT'; basis='FEED_RATE_KG_PER_HOUR'; unit='kg/h'; flags.append('PILL_PROCESSING_HAS_NO_CAPACITY_ROW')
    elif t=='Oil Pressing Machine': rc='FILTRATION_SYSTEM'; eqc='HYDRAULIC_OIL_PRESS'
    elif t=='Juice Press': rc='EXTRACTION_SYSTEM'; eqc='HYDRAULIC_JUICE_PRESS'
    elif t=='Distillation Unit': rc='PROCESSING_VESSEL'; eqc='STEAM_JACKETED_DISTILLATION'; basis='OUTPUT_VOLUME_L'; unit='L'
    elif t=='Root Washing Machine': rc='MANUAL'; eqc='ROOT_WASHER'; mode='THROUGHPUT'; basis='FEED_RATE_KG_PER_HOUR'; unit='kg/h'
    elif t=='Stove':
        if 'Pukaipokki' in n: rc='TRADITIONAL_FURNACE'; eqc='PUTA_FURNACE'; basis='SOLID_CHARGE_KG'
        else: app='NON_CAPACITY_PRODUCTION'; mode='NONE'; basis='NOT_APPLICABLE'; unit=None; rc=None; eqc='HEAT_SOURCE_STOVE'; need='NO'; flags.append('CAPACITY_CARRIED_BY_VESSEL_ON_STOVE')
    elif t in ('Volumetric Filling Machine','Pouch Packing Machine','Tube Filling Machine'):
        app='CAPACITY_BASED_PACKING'; mode='THROUGHPUT'; basis='OUTPUT_UNITS_PER_MINUTE'; unit='packs/min'; rc='PACKING_MACHINE'; eqc='FILLING_PACKING_MACHINE'; need='OPTIONAL_NOT_USED_BY_COSTING_V1'
    elif t=='Transfer Pump': app='UTILITY'; mode='NONE'; basis='NOT_APPLICABLE'; unit=None; rc=None; eqc='TRANSFER_PUMP'; need='NO'
    else: app='UNKNOWN'; mode=None; basis=None; unit=None; eqc='UNKNOWN'
    if m['status']=='N' and need=='YES': need='NO_WHILE_NOT_OPERATIONAL'
    # work-log evidence (batch sizes = product batch, not machine charge)
    wl=None
    if m['wl_n']:
        wl=f"{m['wl_n']} logs; batch {m['wl_uom']} P50 {float(m['p50'] or 0):g} / P90 {float(m['p90'] or 0):g}; {m['acts'] or ''}"
        if (m['wl_uom']=='Nos') and unit in ('kg','L','kg/h'): flags.append('WORK_LOG_IN_NOS_NOT_USABLE')
        if m['mx'] and float(m['mx'])>=50000: flags.append('WORK_LOG_HAS_IMPLAUSIBLE_BATCH_VALUES')
    cls_default={'GRINDER':'50 kg','DRYER_OR_OVEN':'50 kg','MANUAL':'50 kg','TABLET_OR_CAPSULE_EQUIPMENT':'50 kg','MIXING_EQUIPMENT':'200 kg','CALCINATION':'25 kg','TRADITIONAL_FURNACE':'25 kg','PROCESSING_VESSEL':'220 kg / 500 L','FILTRATION_SYSTEM':'220 kg / 500 L','EXTRACTION_SYSTEM':'370 kg / 500 L','FERMENTATION_VESSEL':'3000 L'}.get(rc,'none')
    ready='READY_PROVISIONAL_RATED' if (rated and app.startswith('CAPACITY_BASED_PRODUCTION')) else ('NOT_REQUIRED' if need.startswith('NO') or need.startswith('OPTIONAL') else 'BLOCKED_NEEDS_USER_VALUE')
    return dict(plant_id=m['id'],plant_name=n,status=m['status'],machine_type=t,section=m['section_name'],subsection=sub,area=area,
        proposed_applicability=app,proposed_equipment_class=eqc,proposed_costing_resource_class=rc or '',capacity_mode=mode or '',charge_basis=basis or '',physical_unit=unit or '',
        proposed_rated_capacity=rated if rated else '',proposed_effective_capacity='',evidence_source=ev,work_log_evidence=wl or '',
        route_steps_linked=m['route_steps'] or 0,cost_centres=m['ccs'] or '',current_class_default=cls_default,user_value_needed=need,proposed_readiness=ready,flags=';'.join(flags))
rows=[rule(m) for m in M]
out='/workspace/au4wt/docs/costing-pipeline-independent-audit/proposals/au9_seasonality_capacity/data/plant_machinery_inventory_backfill.csv'
with open(out,'w',newline='') as fh:
    w=csv.DictWriter(fh,fieldnames=list(rows[0].keys())); w.writeheader(); w.writerows(rows)
json.dump(rows,open('mach_rows.json','w'))
C=collections.Counter
print(C(r['proposed_applicability'] for r in rows)); print(C(r['proposed_readiness'] for r in rows)); print(C(r['user_value_needed'] for r in rows))
print(C(r['proposed_equipment_class'] for r in rows).most_common())
print('flags',C(f for r in rows for f in r['flags'].split(';') if f))
print('route-linked machines',sum(1 for r in rows if r['route_steps_linked']), 'cc-linked',sum(1 for r in rows if r['cost_centres']))
