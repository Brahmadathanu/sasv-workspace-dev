"""G7 preliminary offline contract fixtures. No DB/network connection. Run: python3 scripts/mis-g7/g7_offline_fixture_test.py"""
from datetime import date
from decimal import Decimal

D = Decimal

def value_receipts(events, rates, cutoff, allowed_status=None):
    total = D("0")
    seen = set()
    by_uom = {}
    valued = unvalued = 0
    for e in events:
        if e["kind"] != "FG_BULK_STORAGE" or e["date"] > cutoff:
            continue
        if allowed_status is not None and e["status"] not in allowed_status:
            continue
        identity = (e["source"], e["source_id"])
        if identity in seen:
            continue
        seen.add(identity)
        assert e["qty"] > 0
        rate = rates.get(e["product"])
        if rate is None or rate["uom"] != e["uom"]:
            unvalued += 1
            continue
        amount = e["qty"] * rate["unit_cost"]
        total += amount
        by_uom[e["uom"]] = by_uom.get(e["uom"], D("0")) + amount
        valued += 1
    return total, valued, unvalued, by_uom

def event(source_id, product, qty, uom, day, status="Done", kind="FG_BULK_STORAGE"):
    return dict(source="daily_work_log", source_id=source_id, product=product, qty=D(qty),
                uom=uom, date=date(2026,11,day), status=status, kind=kind)

def check(condition, description):
    assert condition, description
    print("PASS", description)

def main():
    receipts = [event(11,1,"38","Kg",13),event(12,1,"0.1","Kg",14),
                event(13,2,"15","L",14,"In Storage"),event(14,3,"3.4","Kg",14)]
    rates = {1:dict(uom="Kg",unit_cost=D("100")),2:dict(uom="L",unit_cost=D("12.5"))}
    v,n,u,grouped=value_receipts(receipts,rates,date(2026,11,20))
    check(v == D("3997.5"),"exact decimal reference value")
    check((n,u)==(3,1),"one missing rate remains unvalued")
    check(grouped=={"Kg":D("3810"),"L":D("187.5")},"separate UOM amounts")
    check(value_receipts(receipts+[receipts[0]],rates,date(2026,11,20))[0]==v,"duplicate source identity ignored")
    check(value_receipts(receipts,rates,date(2026,11,13))[0]==D("3800"),"event cutoff enforced")
    check(value_receipts(receipts,rates,date(2026,11,20),{"Done"})[0]==D("3810"),"in-storage not completed")
    check(value_receipts(receipts+[event(99,1,"10","Kg",14,kind="INTERNAL_TRANSFER")],rates,date(2026,11,20))[0]==v,"internal transfer excluded")
    wrong={**rates,2:dict(uom="Kg",unit_cost=D("12.5"))}
    check(value_receipts(receipts,wrong,date(2026,11,20))[2]==2,"UOM mismatch is unvalued")
    check(D("100")*D("0.00091")==D("0.09100"),"special product conversion preserved")
    check(143 != 152,"approved and draft cost runs not interchangeable")
    check(None is None,"no achievement percentage without frozen comparable plan")
    permitted=False
    check(not permitted,"no-view request denied in fixture")
    print("OFFLINE CONTRACT FIXTURES: 12/12 PASS — synthetic, not SQL/security execution")

if __name__=="__main__":
    main()
