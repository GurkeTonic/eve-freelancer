#!/usr/bin/env python3
"""Fetch the freelance jobs board from ESI into data/esi/.

Until 5.10.2026 every visitor's browser made about 440 ESI requests per full
load: the job list, one detail request per job and one order book per
priceable item for the chosen market. The data is the same for everybody, so
it is fetched once per build here, and js/esi.js reads the files instead.
Visitors' browsers no longer contact CCP.

Run by .github/workflows/deploy.yml before the site is built; works locally:

  python3 tools/fetch_esi.py

Output under data/esi/:

  freelance-jobs.json  every page of /freelance-jobs merged, as one response
  details.json         {job_id: /freelance-jobs/{id} response}. Reused from the
                       previous file for jobs whose last_modified is unchanged
                       and whose detail is younger than DETAIL_MAX_AGE_H, so a
                       run only fetches new and changed jobs.
  prices.json          {region_id: {"station": id, "fetched": iso, "buy":
                       {type_id: best buy price at that station}}} for all
                       five reference markets in js/config.js MARKETS, for
                       every priceable type. Reused for PRICE_MAX_AGE_H.
  stations.json        {station_id: {"name", "system_id"}} for every NPC
                       station a delivery job names. Stations do not move,
                       so known ones are kept and only new ids are asked.
                       Player structures stay unresolved: their location
                       needs a token.
  meta.json            when each group was fetched

Stdlib only. Exit 1 if the job list cannot be fetched.
"""
import json
import sys
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path

from esi_client import Halted
from esi_shared import client

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "esi"

PAGE_LIMIT = 100          # ESI: 10 <= limit <= 100
MAX_PAGES = 40            # js/config.js JOBS_MAX_PAGES
DETAIL_MAX_AGE_H = 24
PRICE_MAX_AGE_H = 2
WORKERS = 4   # parallel requests; the docs ask to spread, not burst

# js/config.js MARKETS: region -> station of the reference hub
MARKETS = {
    10000002: 60003760,   # Jita
    10000043: 60008494,   # Amarr
    10000032: 60011866,   # Dodixie
    10000030: 60004588,   # Rens
    10001004: 60015249,   # Manifest (Exordium)
}

now = datetime.now(timezone.utc)
NOW_ISO = now.strftime("%Y-%m-%dT%H:%M:%SZ")


ESI = client()


def request(path, params=None):
    """Through tools/esi_client.py: expires, ETag, error and rate limits."""
    return ESI.get(path, params)


def load_prev(name):
    try:
        return json.loads((OUT / name).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}


def age_h(iso):
    if not iso:
        return None
    return (now - datetime.fromisoformat(iso.replace("Z", "+00:00"))).total_seconds() / 3600


def write(name, payload):
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / name).write_text(json.dumps(payload, separators=(",", ":")) + "\n", encoding="utf-8")
    return (OUT / name).stat().st_size


meta = load_prev("meta.json")
sizes = {}

# ---------- job list: without it the build must fail ----------

# ESI pages this list by cursor, newest first: the first response holds the
# most recently modified jobs, `before` leads to older ones, `after` only to
# jobs modified since. The old browser code followed `after` and so only ever
# saw the first page: on 5.10.2026 about 100 of 383 valid jobs (410 listed,
# 27 already expired). Expired jobs stay in the list; js/jobs.js hides them.
jobs, before, seen = [], None, set()
for _ in range(MAX_PAGES):
    params = {"limit": PAGE_LIMIT}
    if before:
        params["before"] = before
    try:
        res = request("/freelance-jobs", params)
    except Halted as e:
        sys.exit(f"ESI halted while reading the job list: {e}")
    chunk = [j for j in (res.get("freelance_jobs") or []) if j["id"] not in seen]
    seen.update(j["id"] for j in chunk)
    jobs += chunk
    before = (res.get("cursor") or {}).get("before")
    if not before or not chunk:
        break
if not jobs:
    sys.exit("ESI returned no freelance jobs")
sizes["freelance-jobs.json"] = write("freelance-jobs.json", {"freelance_jobs": jobs, "cursor": {}})
meta["jobs"] = NOW_ISO

# ---------- details: only new or changed jobs ----------

prev_details = load_prev("details.json")
prev_fetched = (prev_details.pop("_fetched", None) or {}) if prev_details else {}
details, fetched_at, todo = {}, {}, []
for j in jobs:
    old = prev_details.get(j["id"])
    stamp = prev_fetched.get(j["id"])
    a = age_h(stamp)
    if old and a is not None and a < DETAIL_MAX_AGE_H and old.get("_last_modified") == j.get("last_modified"):
        details[j["id"]], fetched_at[j["id"]] = old, stamp
    else:
        todo.append(j)


def slim(d):
    """Only what js/jobs.js fetchDetail() and extractPriceableType() read."""
    conf = d.get("configuration") or {}
    params = conf.get("parameters") or {}
    det = d.get("details") or {}
    return {
        "configuration": {"method": conf.get("method"),
                          "parameters": {k: params[k] for k in ("corporation_item_delivery", "ore") if k in params}},
        "details": {k: det.get(k) for k in ("career", "expires", "creator", "description")},
        "contribution": {"reward_per_contribution": (d.get("contribution") or {}).get("reward_per_contribution")},
        "access_and_visibility": {"broadcast_locations": (d.get("access_and_visibility") or {}).get("broadcast_locations") or []},
    }


def detail(job):
    try:
        d = slim(request(f"/freelance-jobs/{job['id']}"))
        d["_last_modified"] = job.get("last_modified")
        return job["id"], d
    except Exception as e:  # one broken job must not lose the board
        print(f"  detail {job['id']}: {e}")
        return job["id"], None


with ThreadPoolExecutor(WORKERS) as pool:
    for jid, d in pool.map(detail, todo):
        if d is not None:
            details[jid], fetched_at[jid] = d, NOW_ISO
        elif jid in prev_details:  # ESI said stop or failed: keep the last good one
            details[jid], fetched_at[jid] = prev_details[jid], prev_fetched.get(jid)
# ESI keeps expired jobs in the list with state "Active" (27 of 410 on
# 5.10.2026, the oldest expired in January). The board has no expiry filter,
# because the browser only ever saw the newest page. Drop them here.
def expired(jid):
    exp = ((details.get(jid) or {}).get("details") or {}).get("expires")
    return bool(exp) and datetime.fromisoformat(exp.replace("Z", "+00:00")) <= now


dropped = [j["id"] for j in jobs if expired(j["id"])]
jobs = [j for j in jobs if j["id"] not in set(dropped)]
for jid in dropped:
    details.pop(jid, None)
    fetched_at.pop(jid, None)
sizes["freelance-jobs.json"] = write("freelance-jobs.json", {"freelance_jobs": jobs, "cursor": {}})
print(f"jobs: {len(jobs)} valid, {len(dropped)} expired dropped")
details["_fetched"] = fetched_at
sizes["details.json"] = write("details.json", details)
meta["details"] = NOW_ISO
print(f"details: {len(todo)} fetched, {len(jobs) - len(todo)} reused")

# ---------- prices for every priceable type, in all five markets ----------


def priceable_type(d):
    """Same rule as js/jobs.js extractPriceableType()."""
    conf = d.get("configuration") or {}
    params = conf.get("parameters") or {}
    method = conf.get("method")
    if method == "DeliverItem":
        e = ((((params.get("corporation_item_delivery") or {}).get("corporation_item_delivery") or {})
              .get("item_type") or {}).get("values") or [None])[0]
    elif method == "MineOre":
        e = (((params.get("ore") or {}).get("matcher") or {}).get("values") or [None])[0]
    else:
        return None
    if e and e.get("value_type") in ("item_type", "ore_type") and len(e.get("values") or []) == 1:
        return int(e["values"][0])
    return None


types = sorted({t for jid, d in details.items() if jid != "_fetched" for t in [priceable_type(d)] if t})
prev_prices = load_prev("prices.json")
prices = {}
todo = []
for region, station in MARKETS.items():
    old = prev_prices.get(str(region)) or {}
    a = age_h(old.get("fetched"))
    have = {int(k) for k in (old.get("buy") or {})}
    if a is not None and a < PRICE_MAX_AGE_H and set(types) <= have:
        prices[str(region)] = old
    else:
        prices[str(region)] = {"station": station, "fetched": NOW_ISO, "buy": {}}
        todo += [(region, station, t) for t in types]


def best_buy(item):
    region, station, t = item
    try:
        orders = request(f"/markets/{region}/orders", {"type_id": t, "order_type": "buy"})
        return region, t, max((o["price"] for o in orders if o["location_id"] == station), default=0)
    except Exception as e:
        print(f"  price {region}/{t}: {e}")
        return region, t, None


with ThreadPoolExecutor(WORKERS) as pool:
    for region, t, buy in pool.map(best_buy, todo):
        if buy is None:
            buy = ((prev_prices.get(str(region)) or {}).get("buy") or {}).get(str(t))
        if buy is not None:
            prices[str(region)]["buy"][str(t)] = buy
sizes["prices.json"] = write("prices.json", prices)
if todo:
    meta["prices"] = NOW_ISO
print(f"prices: {len(types)} types x {len(MARKETS)} markets, {len(todo)} requests")

# ---------- delivery stations: where an item has to go ----------

# A delivery job names the corporation offices to deliver to. About one job
# in eight has no broadcast location at all (76 of 383 on 5.10.2026); for a
# delivery job the station is then the only place it is tied to. 11 of those
# 46 named an NPC station, the rest player structures.


def delivery_stations(d):
    params = ((d.get("configuration") or {}).get("parameters") or {})
    loc = (((params.get("corporation_item_delivery") or {}).get("corporation_item_delivery") or {})
           .get("corporation_office_location") or {})
    return [int(v) for g in (loc.get("values") or []) if g.get("value_type") == "station"
            for v in (g.get("values") or [])]


wanted = sorted({sid for jid, d in details.items() if jid != "_fetched" for sid in delivery_stations(d)})
prev_stations = load_prev("stations.json")
stations = {k: v for k, v in prev_stations.items() if int(k) in wanted}
todo = [sid for sid in wanted if str(sid) not in stations]


def station(sid):
    try:
        r = request(f"/universe/stations/{sid}")
        return sid, {"name": r["name"], "system_id": r["system_id"]}
    except Exception as e:
        print(f"  station {sid}: {e}")
        return sid, None


with ThreadPoolExecutor(WORKERS) as pool:
    for sid, st in pool.map(station, todo):
        if st:
            stations[str(sid)] = st
sizes["stations.json"] = write("stations.json", stations)
print(f"stations: {len(wanted)} named, {len(todo)} requests")

write("meta.json", meta)
write("files.json", ["details.json", "freelance-jobs.json", "meta.json", "prices.json", "stations.json"])
print(f"data/esi: {len(jobs)} jobs, {sum(sizes.values()) // 1024} kB")
print(ESI.summary())
