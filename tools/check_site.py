#!/usr/bin/env python3
"""Checks that keep broken data and stale pages off the live site.

The site is served straight from main (GitHub Pages, deploy from branch), so
whatever is committed is live within a minute. These checks run where a commit
is made:

  --static  before the SDE workflow commits js/data/staticdata.js: the file is
            there, is not truncated, and is valid JavaScript (node --check).
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


def check_static():
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


modes = set(sys.argv[1:]) or {"--static", "--pages"}
if "--static" in modes:
    check_static()
if "--pages" in modes:
    check_pages()
sys.exit(1 if errors else 0)
