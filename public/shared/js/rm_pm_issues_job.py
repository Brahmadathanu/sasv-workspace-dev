# scripts/rm_pm_issues_job.py
# Voucher Register XML → RM/PM issues (item/batch-wise) loader
# Creates: raw/<date>/rm_pm_issues_<date>.csv.gz
# Loads:   public.tally_rm_pm_issues_snapshot (idempotent per day)

from pathlib import Path
import io, csv, gzip, re
import requests
from lxml import etree
from typing import Optional, Dict, Tuple, List
from .common import log, supa, RAW_BUCKET, TALLY_URL, TALLY_COMPANY

WORK_IN   = Path(r"D:\tally-agent\work\vreg-in")
WORK_PACK = Path(r"D:\tally-agent\work\rm-pm-out")

ISSUE_TYPE_RE = re.compile(r"^\s*(RM|PM)\s*-\s*Issue\s*$", re.I)
SALES_RE      = re.compile(r"^Sales\s*:", re.I)   # not used here, but kept if needed later
NUM_RE        = re.compile(r"[-+]?\d*\.?\d+")
BAD_CTRL      = re.compile(r"([^\x09\x0A\x0D\x20-\uD7FF\uE000-\uFFFD])")
BAD_NUMREF    = re.compile(r"&#(?:[0-8]|1\d|2\d|3[0-1]);")
BAD_AMP       = re.compile(r"&(?!(?:amp;|lt;|gt;|apos;|quot;|#\d+;))")

LINE_TAGS = (
    "ALLINVENTORYENTRIES.LIST",
    "INVENTORYENTRIES.LIST",
    "INVENTORYENTRIESIN.LIST",
    "INVENTORYENTRIESOUT.LIST",
)

def _sanitize_xml_bytes(b: bytes) -> bytes:
    s = b.decode("utf-8", "replace")
    s = BAD_CTRL.sub("", s)
    s = BAD_NUMREF.sub("", s)
    s = BAD_AMP.sub("&amp;", s)
    return s.encode("utf-8")

def _build_envelope(date_ymd: str, company: str) -> str:
    ymd = date_ymd.replace("-", "")
    return f"""<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Data</TYPE>
    <ID>Voucher Register</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVCURRENTCOMPANY>{company}</SVCURRENTCOMPANY>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
        <SVFROMDATE TYPE="Date">{ymd}</SVFROMDATE>
        <SVTODATE   TYPE="Date">{ymd}</SVTODATE>
        <ExcludeCancelled>YES</ExcludeCancelled>
        <EXPLODEVOUCHERS>No</EXPLODEVOUCHERS>
      </STATICVARIABLES>
    </DESC>
  </BODY>
</ENVELOPE>""".strip()

def _local_xml_path(date_ymd: str) -> Path:
    WORK_IN.mkdir(parents=True, exist_ok=True)
    return WORK_IN / f"voucher_register_{date_ymd}.xml"

def _fetch_vreg_xml(date_ymd: str, company: str) -> bytes:
    env = _build_envelope(date_ymd, company)
    r = requests.post(
        TALLY_URL,
        data=env.encode("utf-8"),
        headers={"Content-Type": "text/xml"},
        timeout=180,
    )
    r.raise_for_status()
    return r.content

def _try_storage_download(sb, source_key: str, date_ymd: Optional[str]) -> Optional[bytes]:
    # Prefer centralized helper which handles legacy keys and chunked runs.
    if not source_key:
        return None
    try:
        # Import helper dynamically to handle different package layouts
        try:
            from storage_utils import download_legacy_or_chunk
        except Exception:
            try:
                from .storage_utils import download_legacy_or_chunk
            except Exception:
                from ..storage_utils import download_legacy_or_chunk
        xml_text = download_legacy_or_chunk(source_key, date_ymd)
        return xml_text.encode("utf-8")
    except Exception:
        # fallback to direct download if helper fails for some reason
        try:
            return sb.storage.from_(RAW_BUCKET).download(source_key)
        except Exception:
            return None

def _first_text(el, names: List[str]) -> str:
    for n in names:
        t = el.findtext(n)
        if t and t.strip():
            return t.strip()
    return ""

def _parse_qty_uom(raw: str) -> Tuple[float, Optional[str]]:
    """
    Accepts forms like:
      "59.000 Kg. = 59000 Gm."  -> returns (59.000, 'Kg')
      "430 Nos"                 -> returns (430, 'Nos')
    We always take the segment BEFORE '=' for both number and unit.
    """
    if not raw:
        return 0.0, None
    left = raw.split("=", 1)[0].strip()  # keep left part only
    # number
    s = left.replace(",", " ")
    m = NUM_RE.search(s)
    qty = float(m.group()) if m else 0.0
    # unit
    unit = None
    parts = left.split()
    if parts:
        # last token often like 'Kg.' → strip trailing dots
        token = parts[-1].strip().rstrip(".")
        # treat token as unit only if it contains letters
        if re.search(r"[A-Za-z]", token):
            unit = token
    return qty, unit

def _extract_issue_type(txt: str) -> Optional[str]:
    m = ISSUE_TYPE_RE.match(txt or "")
    if not m:
        return None
    return m.group(1).upper()  # 'RM' or 'PM'

def _voucher_parent_info(v: etree._Element) -> Tuple[Optional[str], Optional[str], Optional[str], float, int]:
    """
    Try to find a parent (Manufacturing Journal FG line) in this voucher:
      - product_name: STOCKITEMNAME typically 'RM - <Product>' (or similar)
      - bom_name: BOMNAME if present
      - fg_batch_no: BATCHALLOCATIONS.LIST/BATCHNAME
      - fg_batch_size_qty: ACTUALQTY or BILLEDQTY (left side)
      - parent_count: 1 if found, else 0
    """
    product_name = None
    bom_name = None
    fg_batch_no = None
    fg_batch_size_qty = 0.0
    found = 0

    for tag in LINE_TAGS:
        for inv in v.findall(tag):
            pn = _first_text(inv, ["STOCKITEMNAME"])
            bn = _first_text(inv, ["BOMNAME"])
            ba = inv.find("BATCHALLOCATIONS.LIST")
            batch = _first_text(ba, ["BATCHNAME"]) if ba is not None else None

            # Heuristic: parent lines typically have a BOMNAME or STOCKITEMNAME starts with 'RM - ' / 'PM - '
            looks_parent = bool(bn) or (pn and re.match(r"^\s*(RM|PM)\s*-", pn, re.I))
            if looks_parent and pn:
                product_name = pn
                bom_name = bn or None
                fg_batch_no = batch or None
                q_raw = _first_text(inv, ["ACTUALQTY"]) or _first_text(inv, ["BILLEDQTY"])
                q, _ = _parse_qty_uom(q_raw)
                fg_batch_size_qty = q
                found = 1
                return product_name, bom_name, fg_batch_no, fg_batch_size_qty, found

    return product_name, bom_name, fg_batch_no, fg_batch_size_qty, found

def _stream_issue_rows(xml_bytes: bytes):
    """
    Yield dict rows matching the landing table columns (except id/inserted_at).
    Handles both:
      • Manufacturing Journal issues (parent FG context present)
      • Stock Journal issues (batch may be taken from narration)
    """
    buf = io.BytesIO(xml_bytes)
    ctx = etree.iterparse(buf, tag="VOUCHER", recover=True, huge_tree=True)
    for _, v in ctx:
        vtype_txt = _first_text(v, ["VCHSTATUSVOUCHERTYPE"])  # 'RM - Issue' / 'PM - Issue'
        issue_type = _extract_issue_type(vtype_txt or "")
        if not issue_type:
            v.clear(); continue

        entry_mode   = _first_text(v, ["VCHENTRYMODE"]) or ""
        voucher_no   = _first_text(v, ["VOUCHERNUMBER"]) or ""
        voucher_date = _first_text(v, ["DATE"]) or ""  # YYYYMMDD
        narr         = _first_text(v, ["NARRATION"]) or ""

        # Parent (MJ) detection
        product_name, bom_name, fg_batch_no, fg_batch_size_qty, parent_count = (None, None, None, 0.0, 0)
        if "Manufacturing" in entry_mode:
            product_name, bom_name, fg_batch_no, fg_batch_size_qty, parent_count = _voucher_parent_info(v)
            # If still none, we mark as MJ no parent
            extraction_note_parent = "PARENT_MJ" if parent_count == 1 else "MJ_NO_PARENT"
        else:
            # Stock journal: maybe pick batch from narration like "Bn 5646"
            m = re.search(r"\bBn\s*([A-Za-z0-9\-_/.]+)", narr)
            fg_batch_no = m.group(1) if m else None
            extraction_note_parent = "SJ_NARRATION_BATCH" if fg_batch_no else "SJ_NO_BATCH"

        # Now collect material lines
        for tag in LINE_TAGS:
            for inv in v.findall(tag):
                item = _first_text(inv, ["STOCKITEMNAME"])
                if not item:
                    continue

                # Skip the parent line itself if we detected it
                if parent_count == 1 and product_name and item == product_name:
                    continue

                # Qty + UOM (left side before '=')
                a_qty_raw = _first_text(inv, ["ACTUALQTY"])
                b_qty_raw = _first_text(inv, ["BILLEDQTY"])
                a_qty, a_uom = _parse_qty_uom(a_qty_raw) if a_qty_raw else (0.0, None)
                b_qty, b_uom = _parse_qty_uom(b_qty_raw) if b_qty_raw else (0.0, None)

                # Prefer whichever non-zero we have; keep its UOM
                qty = a_qty if a_qty != 0 else b_qty
                uom = a_uom if a_qty != 0 else b_uom

                if qty == 0:
                    continue

                yield {
                    "voucher_date": f"{voucher_date[:4]}-{voucher_date[4:6]}-{voucher_date[6:8]}" if len(voucher_date) == 8 else None,
                    "voucher_number": voucher_no or None,
                    "issue_type": issue_type,  # 'RM' or 'PM'
                    "entry_mode": entry_mode or None,
                    "product_name": product_name or None,
                    "bom_name": bom_name or None,
                    "fg_batch_no": fg_batch_no or None,
                    "fg_batch_size_qty": fg_batch_size_qty or 0.0,
                    "material_item_name": item,
                    "material_qty_value": qty,
                    "material_uom": uom,
                    "narration_text": narr or None,
                    "extraction_note": extraction_note_parent,
                    "parent_count": parent_count
                }

        v.clear()
        while v.getprevious() is not None:
            del v.getparent()[0]

def _ensure_xml_bytes(params: Dict) -> Tuple[bytes, str]:
    """
    Order:
      1) Storage (params['source_key'])
      2) Local D:\tally-agent\work\vreg-in\voucher_register_<date>.xml
      3) Fetch from Tally (if allow_fetch True) and save locally
    """
    sb          = supa()
    date_ymd    = params.get("vreg_date")
    company     = params.get("company") or TALLY_COMPANY
    source_key  = params.get("source_key")
    allow_fetch = params.get("allow_fetch", True)
    upload_raw  = params.get("upload_raw", False)

    if not date_ymd:
        raise ValueError("UPSERT_RM_PM_ISSUES: missing 'vreg_date' (YYYY-MM-DD)")
    if not company:
        raise ValueError("UPSERT_RM_PM_ISSUES: missing company (set params['company'] or TALLY_COMPANY in .env)")

    if source_key:
        blob = _try_storage_download(sb, source_key, date_ymd)
        if blob:
            return blob, f"storage:{source_key}"

    p_local = _local_xml_path(date_ymd)
    if p_local.exists():
        return p_local.read_bytes(), f"local:{p_local}"

    if not allow_fetch:
        raise FileNotFoundError(f"No XML found for {date_ymd} and allow_fetch=False")

    raw = _fetch_vreg_xml(date_ymd, company)
    p_local.write_bytes(raw)
    log(f"Fetched VREG {date_ymd} → {p_local} ({len(raw)//1024} KB)")
    if upload_raw:
        raw_key = f"raw/{date_ymd}/voucher_register_{date_ymd}.xml"
        sb.storage.from_(RAW_BUCKET).upload(
            path=raw_key, file=raw,
            file_options={"content-type": "application/xml", "upsert": "true"},
        )
    return raw, f"fetched:{date_ymd}"

def upsert_rm_pm_issues(params: Dict):
    """
    Main entrypoint: parse + pack + load for a given day.
    Expects: params['vreg_date'] = 'YYYY-MM-DD'
    Optional: company, source_key, allow_fetch, upload_raw
    """
    date_ymd = params.get("vreg_date")
    if not date_ymd:
        raise ValueError("UPSERT_RM_PM_ISSUES: 'vreg_date' is required")

    sb = supa()
    raw_xml, src = _ensure_xml_bytes(params)
    clean = _sanitize_xml_bytes(raw_xml)

    # collect rows
    rows = list(_stream_issue_rows(clean))

    # write pack
    WORK_PACK.mkdir(parents=True, exist_ok=True)
    pack_path = WORK_PACK / f"rm_pm_issues_{date_ymd}.csv.gz"
    with gzip.open(pack_path, "wt", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow([
            "voucher_date","voucher_number","issue_type","entry_mode",
            "product_name","bom_name","fg_batch_no","fg_batch_size_qty",
            "material_item_name","material_qty_value","material_uom",
            "narration_text","extraction_note","parent_count"
        ])
        for r in rows:
            w.writerow([
                r["voucher_date"], r["voucher_number"], r["issue_type"], r["entry_mode"],
                r["product_name"], r["bom_name"], r["fg_batch_no"], r["fg_batch_size_qty"],
                r["material_item_name"], r["material_qty_value"], r["material_uom"],
                r["narration_text"], r["extraction_note"], r["parent_count"]
            ])

    pack_key = f"raw/{date_ymd}/rm_pm_issues_{date_ymd}.csv.gz"
    sb.storage.from_(RAW_BUCKET).upload(
        path=pack_key,
        file=pack_path.read_bytes(),
        file_options={"content-type": "application/gzip", "upsert": "true"},
    )

    # load landing table idempotently for the day
    sb.table("tally_rm_pm_issues_snapshot").delete().eq("voucher_date", date_ymd).execute()

    # bulk insert in chunks
    payload = []
    for r in rows:
        rec = dict(r)
        rec["source_key"] = pack_key
        payload.append(rec)
        if len(payload) >= 300:
            sb.table("tally_rm_pm_issues_snapshot").insert(payload).execute()
            payload = []
    if payload:
        sb.table("tally_rm_pm_issues_snapshot").insert(payload).execute()

    log(f"UPSERT_RM_PM_ISSUES date={date_ymd} rows={len(rows)} src={src} pack={pack_key}")