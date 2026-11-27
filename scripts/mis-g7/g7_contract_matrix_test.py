"""Synthetic G7 policy tests: no network, database, migrations or permissions changed."""
import unittest
from datetime import date
from decimal import Decimal as D

class NoAccess(PermissionError): pass
def event(i, product="A", qty="2", uom="Kg", day=3, kind="FG_BULK_STORAGE"):
    return dict(source="daily_work_log", source_id=i, product=product, qty=D(qty),
                uom=uom, on=date(2026,11,day), kind=kind)

def summarize(authorized=True, cost_run=143, plan_frozen=False, plan_rows=None,
              receipts=None, rates=None, cutoff=date(2026,11,20), completion_verified=False):
    if not authorized: raise NoAccess("MIS view required")
    if cost_run != 143: return dict(status="NO_APPROVED_COST", plan_covered=None,
                                   receipt_covered=None, achievement_pct=None)
    plans=list(plan_rows or [])
    events=[]; seen=set()
    for e in receipts or []:
        k=(e["source"],e["source_id"])
        if e["kind"]!="FG_BULK_STORAGE" or not date(2026,11,1)<=e["on"]<=cutoff or k in seen: continue
        seen.add(k);events.append(e)
    def valuate(rows):
        amount=D("0"); missing=0
        for e in rows:
            r=(rates or {}).get(e["product"])
            if e["qty"]<=0 or not r or r["uom"]!=e["uom"] or r["cost"]<0:
                missing+=1;continue
            amount+=e["qty"]*r["cost"]
        return amount,missing
    pv,pm=valuate(plans); rv,rm=valuate(events)
    return dict(status="COMPLETE" if not (pm or rm) else "PARTIAL",
                plan_status="FROZEN" if plan_frozen else "LIVE_INDICATIVE",
                plan_covered=pv,receipt_covered=rv,unvalued_plan=pm,
                unvalued_receipts=rm,receipt_count=len(events),completed_value=None,
                completed_status="NOT_VERIFIED",achievement_pct=None)

class G7ContractTests(unittest.TestCase):
    def setUp(self):
        self.base=dict(authorized=True,cost_run=143,plan_frozen=False,
            plan_rows=[event(100,qty="10")],receipts=[event(1)],
            rates={"A":{"uom":"Kg","cost":D("12.50")}})
    def report(self,**kwargs):return summarize(**dict(self.base,**kwargs))
    def test_01_run(self):self.assertEqual(self.report()["status"],"COMPLETE")
    def test_02_receipt_value(self):self.assertEqual(self.report()["receipt_covered"],D("25"))
    def test_03_plan_value(self):self.assertEqual(self.report()["plan_covered"],D("125"))
    def test_04_denial(self):
        with self.assertRaises(NoAccess):self.report(authorized=False)
    def test_05_draft_refused(self):self.assertEqual(self.report(cost_run=152)["status"],"NO_APPROVED_COST")
    def test_06_unknown_run_refused(self):self.assertIsNone(self.report(cost_run=999)["receipt_covered"])
    def test_07_duplicate_receipt(self):self.assertEqual(self.report(receipts=[event(1),event(1)])["receipt_count"],1)
    def test_08_incremental_receipt(self):
        self.assertEqual(self.report(receipts=[event(1),event(2,qty="0.1")])["receipt_covered"],D("26.25"))
    def test_09_internal_transfer(self):
        self.assertEqual(self.report(receipts=[event(1,kind="INTERNAL_TRANSFER")])["receipt_count"],0)
    def test_10_future_cutoff(self):self.assertEqual(self.report(receipts=[event(1,day=21)])["receipt_count"],0)
    def test_11_previous_month(self):
        e=event(1);e["on"]=date(2026,10,31)
        self.assertEqual(self.report(receipts=[e])["receipt_count"],0)
    def test_12_missing_receipt_rate(self):
        r=self.report(receipts=[event(1),event(2,product="B")])
        self.assertEqual((r["unvalued_receipts"],r["status"]),(1,"PARTIAL"))
    def test_13_missing_plan_rate(self):
        r=self.report(plan_rows=[event(1,product="B")])
        self.assertEqual((r["unvalued_plan"],r["status"]),(1,"PARTIAL"))
    def test_14_uom_mismatch(self):
        self.assertEqual(self.report(receipts=[event(1,uom="L")])["unvalued_receipts"],1)
    def test_15_negative_rate(self):
        self.assertEqual(self.report(rates={"A":{"uom":"Kg","cost":D("-1")}})["status"],"PARTIAL")
    def test_16_zero_qty(self):
        self.assertEqual(self.report(receipts=[event(1,qty="0")])["unvalued_receipts"],1)
    def test_17_not_completion(self):
        self.assertEqual(self.report()["completed_status"],"NOT_VERIFIED")
    def test_18_live_percentage_null(self):self.assertIsNone(self.report()["achievement_pct"])
    def test_19_frozen_no_completion_percentage(self):
        self.assertIsNone(self.report(plan_frozen=True,completion_verified=True)["achievement_pct"])
    def test_20_different_conversion(self):
        self.assertEqual(D("450")*D("0.00091"),D("0.40950"))

if __name__=="__main__":unittest.main()
