#!/usr/bin/env python3
"""Generate the board subpages and sitemap.xml from index.html.

index.html is the source template (the dashboard). Every other board gets a
real subpage directory (/new-eden/, /exordium/, /faq/) so each has its own
URL, survives reloads, and is indexable with its own title and description.
Run after every change to index.html:

  python tools/build_pages.py

Stdlib only, no network.
"""
import json
import re
import sys
from pathlib import Path

from esi_shared import ESI_BASE, COMPAT_DATE, USER_AGENT

ROOT = Path(__file__).resolve().parent.parent
TEMPLATE = ROOT / "index.html"
CONFIG_JS = ROOT / "js" / "config.js"
BASE_URL = "https://freelancer.tonicbeacon.com"

ROOT_PAGE = {
    "tab": "dashboard",
    "dir": "",
    "title": "Freelance Jobs Board — EVE Online",
    "description": "Live overview of EVE Online's Freelance Jobs: total ISK offered, active job count, "
                   "and new listings since your last visit, across New Eden and Exordium.",
}

PAGES = [
    {
        "tab": "new-eden",
        "dir": "new-eden",
        "title": "Freelance Jobs Board — New Eden",
        "description": "Public EVE Online freelance jobs board: sort by payout, filter by type/region, "
                       "check payout vs. market value, browse open tasks New Eden-wide.",
    },
    {
        "tab": "exordium",
        "dir": "exordium",
        "title": "Freelance Jobs Board — Exordium",
        "description": "Public EVE Online freelance jobs board for Exordium — a pocket with no flyable "
                       "route to the rest of New Eden, tracked separately.",
    },
    {
        "tab": "faq",
        "dir": "faq",
        "title": "FAQ — Freelance Jobs Board",
        "description": "How the Freelance Jobs Board works: data source, the value-vs-market check, "
                       "distance, the New Eden/Exordium split, and privacy.",
    },
]


def build_page(template, page):
    html = template
    html = re.sub(r"<title>.*?</title>", f"<title>{page['title']}</title>", html, count=1)
    html = re.sub(
        r'<meta name="description" content="[^"]*">',
        f'<meta name="description" content="{page["description"]}">',
        html, count=1,
    )
    html = re.sub(
        r'<meta property="og:title" content="[^"]*">',
        f'<meta property="og:title" content="{page["title"]}">',
        html, count=1,
    )
    html = re.sub(
        r'<meta property="og:description" content="[^"]*">',
        f'<meta property="og:description" content="{page["description"]}">',
        html, count=1,
    )
    html = re.sub(
        r'<link rel="canonical" href="[^"]*">',
        f'<link rel="canonical" href="{BASE_URL}/{page["dir"]}/">',
        html, count=1,
    )
    html = re.sub(
        r'<meta property="og:url" content="[^"]*">',
        f'<meta property="og:url" content="{BASE_URL}/{page["dir"]}/">',
        html, count=1,
    )
    html = html.replace('<body data-tab="dashboard">', f'<body data-tab="{page["tab"]}">', 1)
    html = html.replace(
        "<!-- Source template. After editing, run: python tools/build_pages.py\n"
        "     to regenerate the subpages (new-eden/, exordium/, faq/) and sitemap.xml. -->",
        "<!-- Generated from index.html by tools/build_pages.py — do not edit by hand. -->",
        1,
    )
    return html


def build_routes_js():
    """Route table for js/router.js: soft (pushState) navigation needs the
    same per-board title/description/canonical that build_page() bakes into
    each static subpage, so both stay driven by this one PAGES list."""
    entries = []
    for page in [ROOT_PAGE] + PAGES:
        path = f"/{page['dir']}/" if page["dir"] else "/"
        entries.append(
            "  %s: {tab: %s, title: %s, description: %s, canonical: %s}"
            % (
                json.dumps(path),
                json.dumps(page["tab"]),
                json.dumps(page["title"]),
                json.dumps(page["description"]),
                json.dumps(f"{BASE_URL}{path}"),
            )
        )
    return (
        "/* Generated from tools/build_pages.py's PAGES list — do not edit by hand.\n"
        "   Route table for js/router.js (soft navigation between boards). */\n"
        '"use strict";\n\n'
        "const ROUTES = {\n" + ",\n".join(entries) + "\n};\n"
    )


def sync_config_js():
    """Keep CONFIG.ESI_BASE / COMPAT_DATE / USER_AGENT in js/config.js in
    sync with tools/esi_shared.py — the single source both the Python tools
    and the browser client draw from. Everything else in config.js (markets,
    job methods, ...) is hand-maintained and left untouched."""
    js = CONFIG_JS.read_text(encoding="utf-8")
    js, n1 = re.subn(r'ESI_BASE: "[^"]*",', f'ESI_BASE: "{ESI_BASE}",', js, count=1)
    js, n2 = re.subn(r'COMPAT_DATE: "[^"]*",', f'COMPAT_DATE: "{COMPAT_DATE}",', js, count=1)
    js, n3 = re.subn(r'USER_AGENT: "[^"]*",', f'USER_AGENT: "{USER_AGENT}",', js, count=1)
    if (n1, n2, n3) != (1, 1, 1):
        sys.exit(f"js/config.js: expected 1 match each for ESI_BASE/COMPAT_DATE/USER_AGENT, got {(n1, n2, n3)}")
    CONFIG_JS.write_text(js, encoding="utf-8", newline="\n")
    print("synced js/config.js (ESI_BASE, COMPAT_DATE, USER_AGENT) from tools/esi_shared.py")


def main():
    sync_config_js()

    template = TEMPLATE.read_text(encoding="utf-8")
    for marker in ('<body data-tab="dashboard">', "<title>", 'rel="canonical"'):
        if marker not in template:
            sys.exit(f"template marker missing: {marker}")

    for page in PAGES:
        out_dir = ROOT / page["dir"]
        out_dir.mkdir(exist_ok=True)
        (out_dir / "index.html").write_text(build_page(template, page), encoding="utf-8", newline="\n")
        print(f"wrote {page['dir']}/index.html")

    (ROOT / "js" / "routes.js").write_text(build_routes_js(), encoding="utf-8", newline="\n")
    print("wrote js/routes.js")

    urls = [f"{BASE_URL}/"] + [f"{BASE_URL}/{p['dir']}/" for p in PAGES]
    sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n' \
              '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' \
              + "".join(f"  <url><loc>{u}</loc></url>\n" for u in urls) \
              + "</urlset>\n"
    (ROOT / "sitemap.xml").write_text(sitemap, encoding="utf-8", newline="\n")
    print(f"wrote sitemap.xml ({len(urls)} urls)")


if __name__ == "__main__":
    main()
