#!/usr/bin/env python3
"""Checks that keep broken data and stale pages off the live site.

The site is served straight from main (GitHub Pages, deploy from branch), so
whatever is committed is live within a minute. These checks run where a commit
is made:

  --static  before the SDE workflow commits js/data/staticdata.js: the file is
            there, is not truncated, and is valid JavaScript (node --check).
  --esi     the snapshot from tools/fetch_esi.py is complete and fresh:
            enough jobs, a detail for nearly every job, prices for all five
            markets.
  --pages   on every push: the subpages, routes.js and sitemap.xml match what
            tools/build_pages.py generates from index.html.

Stdlib only (plus node for --static). Exit 1 on any failure.
"""
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
errors = []


def fail(msg):
    errors.append(msg)
    print(f"FAIL {msg}")


def ok(msg):
    print(f"ok   {msg}")


def check_esi_access():
    """ESI only through tools/esi_client.py (rules of
    developers.eveonline.com/docs/services/esi, read 5.10.2026). Fails if any
    other tool or the frontend talks to esi.evetech.net directly."""
    allowed = {"esi_client.py", "esi_shared.py"}
    hits = []
    for p in list((ROOT / "tools").glob("*.py")) + list((ROOT / "js").glob("*.js")) + [ROOT / "serve.py"]:
        if not p.exists() or p.name in allowed or p.name == "check_site.py":
            continue
        for n, line in enumerate(p.read_text(encoding="utf-8").splitlines(), 1):
            code = line.split("#")[0] if p.suffix == ".py" else line.split("//")[0]
            if "ESI_BASE" in code or ("esi.evetech.net" in code and "http" in code):
                hits.append(f"{p.relative_to(ROOT)}:{n}")
    if hits:
        fail("ESI called outside tools/esi_client.py: " + ", ".join(hits))
    else:
        ok("ESI only through tools/esi_client.py")


def check_static():
    check_esi_access()
    p = ROOT / "js" / "data" / "staticdata.js"
    if not p.exists():
        fail("js/data/staticdata.js missing")
        return
    size = p.stat().st_size
    if size < 100_000:
        fail(f"staticdata.js: only {size} bytes, looks truncated")
    else:
        ok(f"staticdata.js: {size // 1024} kB")
    r = subprocess.run(["node", "--check", str(p)], capture_output=True, text=True)
    if r.returncode:
        fail(f"staticdata.js: not valid JavaScript: {r.stderr.strip()[:200]}")
    else:
        ok("staticdata.js: valid JavaScript")


def check_pages():
    r = subprocess.run([sys.executable, str(ROOT / "tools" / "build_pages.py")],
                       capture_output=True, text=True, cwd=ROOT)
    if r.returncode:
        fail(f"build_pages.py failed: {r.stderr.strip()[:200]}")
        return
    # Only what build_pages.py writes; index.html is its source, not its output.
    d = subprocess.run(["git", "diff", "--name-only", "--", "*/index.html", "js/routes.js", "sitemap.xml"],
                       capture_output=True, text=True, cwd=ROOT)
    changed = d.stdout.split()
    if changed:
        fail("generated files out of date, run tools/build_pages.py: " + ", ".join(changed))
    else:
        ok("subpages, routes.js and sitemap.xml match index.html")


def check_esi():
    import json
    from datetime import datetime, timedelta, timezone
    base = ROOT / "data" / "esi"
    try:
        jobs = json.loads((base / "freelance-jobs.json").read_text(encoding="utf-8"))["freelance_jobs"]
        details = json.loads((base / "details.json").read_text(encoding="utf-8"))
        prices = json.loads((base / "prices.json").read_text(encoding="utf-8"))
        meta = json.loads((base / "meta.json").read_text(encoding="utf-8"))
    except (OSError, ValueError, KeyError) as e:
        fail(f"esi snapshot: {e}")
        return
    if len(jobs) < 50:
        fail(f"freelance-jobs.json: only {len(jobs)} jobs")
    covered = sum(1 for j in jobs if j["id"] in details)
    if covered < len(jobs) * 0.9:
        fail(f"details.json: only {covered} of {len(jobs)} jobs have a detail")
    if len(prices) < 5 or not all((m.get("buy") or {}) for m in prices.values()):
        fail(f"prices.json: {len(prices)} markets, some without prices")
    t = datetime.fromisoformat(meta.get("jobs", "1970-01-01T00:00:00Z").replace("Z", "+00:00"))
    if datetime.now(timezone.utc) - t > timedelta(hours=1):
        fail(f"meta.json: job list fetched {meta.get('jobs')}, older than 1 h")
    if not errors:
        ok(f"esi snapshot: {len(jobs)} jobs, {covered} details, {len(prices)} markets")


args = sys.argv[1:]
if "--esi" in args:
    args.remove("--esi")
    check_esi()
modes = set(args) or ({"--static", "--pages"} if not sys.argv[1:] else set())
if "--static" in modes:
    check_static()
if "--pages" in modes:
    check_pages()
sys.exit(1 if errors else 0)
