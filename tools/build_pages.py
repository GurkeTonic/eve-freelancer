#!/usr/bin/env python3
"""Generate every HTML page, js/routes.js and sitemap.xml from src/.

src/page.html is the template for the overview, both boards and the FAQ;
src/legal.html for the legal page. Each is written once per language:
English at /, German at /de/. Run after every change to src/ or to the
strings in js/i18n.js:

  python tools/build_pages.py

What the build fills in:
  {{name}}                  page values (title, URLs, language, prefix)
  data-i18n="key"           the element's text, from js/i18n.js
  data-i18n-aria / -title / -placeholder    the matching attribute
  <!--en-->…<!--/en-->      kept on English pages, dropped on German ones
  <!--de-->…<!--/de-->      the other way round

Stdlib only, no network.
"""
import html
import json
import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "src"
BASE_URL = "https://freelancer.tonicdock.com"
LANGS = {"en": "", "de": "/de"}
OG_LOCALE = {"en": "en_US", "de": "de_DE"}

PAGES = [
    {
        "tab": "dashboard", "dir": "", "src": "page.html",
        "en": ("Freelancer: EVE Online freelance jobs",
               "Every open Freelance Job in EVE Online by security status, the best paid jobs right now, "
               "and who is hiring, across New Eden and Exordium."),
        "de": ("Freelancer: Freelance-Aufträge in EVE Online",
               "Jeder offene Freelance-Auftrag in EVE Online nach Sicherheitsstatus, die bestbezahlten "
               "Aufträge und wer sie vergibt, in New Eden und Exordium."),
    },
    {
        "tab": "new-eden", "dir": "new-eden", "src": "page.html",
        "en": ("New Eden freelance jobs: Freelancer",
               "All EVE Online freelance jobs in New Eden: sort by reward, filter by type, region and "
               "distance, and compare the reward with market prices."),
        "de": ("Freelance-Aufträge in New Eden: Freelancer",
               "Alle Freelance-Aufträge in New Eden: nach Belohnung sortieren, nach Art, Region und "
               "Entfernung filtern und die Belohnung mit Marktpreisen vergleichen."),
    },
    {
        "tab": "exordium", "dir": "exordium", "src": "page.html",
        "en": ("Exordium freelance jobs: Freelancer",
               "All EVE Online freelance jobs in Exordium, the starter region with its own board and "
               "its own reference market in Manifest."),
        "de": ("Freelance-Aufträge in Exordium: Freelancer",
               "Alle Freelance-Aufträge in Exordium, dem Startgebiet mit eigenem Brett und eigenem "
               "Referenzmarkt in Manifest."),
    },
    {
        "tab": "faq", "dir": "faq", "src": "page.html",
        "en": ("Questions: Freelancer",
               "How the Freelancer board works: data source, the value check against market prices, "
               "location and distance, the New Eden and Exordium split, and privacy."),
        "de": ("Fragen: Freelancer",
               "Wie das Freelancer-Brett funktioniert: Datenquelle, Abgleich mit Marktpreisen, Ort und "
               "Entfernung, die Trennung von New Eden und Exordium, Datenschutz."),
    },
    {
        "tab": None, "dir": "legal", "src": "legal.html",
        "en": ("Legal and privacy: Freelancer", "Legal notice and privacy policy of the Freelancer board."),
        "de": ("Rechtliches und Datenschutz: Freelancer", "Rechtliche Hinweise und Datenschutzerklärung des Freelancer-Bretts."),
    },
]


def load_strings():
    js = (ROOT / "js" / "i18n.js").read_text(encoding="utf-8")
    m = re.search(r"/\*STRINGS\*/(.*?)/\*END\*/", js, re.S)
    if not m:
        sys.exit("js/i18n.js: STRINGS markers missing")
    return json.loads(m.group(1))


def path_of(lang, page):
    return LANGS[lang] + (f"/{page['dir']}/" if page["dir"] else "/")


def fill_strings(doc, strings, lang):
    def text(m):
        key = m.group(2)
        if key not in strings:
            sys.exit(f"{lang}: no string for data-i18n=\"{key}\"")
        return m.group(1) + html.escape(strings[key], quote=False) + m.group(3)

    doc = re.sub(r'(<[a-z0-9]+\b[^>]*\sdata-i18n="([a-z0-9_]+)"[^>]*>)(</)', text, doc)

    def attrs(m):
        tag = m.group(0)
        for src, dst in (("data-i18n-aria", "aria-label"), ("data-i18n-title", "title"),
                         ("data-i18n-placeholder", "placeholder")):
            km = re.search(rf'\s{src}="([a-z0-9_]+)"', tag)
            if km:
                value = html.escape(strings[km.group(1)], quote=True)
                tag = tag[:-1] + f' {dst}="{value}">'
        return tag

    return re.sub(r"<[a-z0-9]+\b[^>]*\sdata-i18n-(?:aria|title|placeholder)=[^>]*>", attrs, doc)


def pick_language(doc, lang):
    for other in LANGS:
        if other == lang:
            doc = doc.replace(f"<!--{other}-->\n", "").replace(f"<!--/{other}-->\n", "")
        else:
            doc = re.sub(rf"<!--{other}-->.*?<!--/{other}-->\n", "", doc, flags=re.S)
    return doc


def build_page(template, page, lang, strings):
    other = "de" if lang == "en" else "en"
    title, description = page[lang]
    values = {
        "generated": "Generated from src/ by tools/build_pages.py. Do not edit by hand.",
        "lang": lang,
        "p": LANGS[lang],
        "tab": page["tab"] or "",
        "title": html.escape(title),
        "description": html.escape(description),
        "canonical": BASE_URL + path_of(lang, page),
        "url_en": BASE_URL + path_of("en", page),
        "url_de": BASE_URL + path_of("de", page),
        "other": path_of(other, page),
        "other_lang": other,
        "og_locale": OG_LOCALE[lang],
    }
    doc = pick_language(template, lang)
    doc = re.sub(r"\{\{(\w+)\}\}", lambda m: values[m.group(1)], doc)
    doc = fill_strings(doc, strings[lang], lang)
    if page["tab"]:
        # The page's own panel ships visible: no jump when the script runs,
        # and the page still has content without JavaScript.
        doc, n = re.subn(rf'(<section id="panel-{page["tab"]}" class="[^"]*?) hidden"', r'\1"', doc)
        if n != 1:
            sys.exit(f"{lang}{path_of(lang, page)}: panel-{page['tab']} not found")
        doc = doc.replace(f'id="tab-{page["tab"]}"', f'id="tab-{page["tab"]}" class="active" aria-current="page"', 1)
    left = re.findall(r"\{\{\w+\}\}|<!--/?(?:en|de)-->", doc)
    if left:
        sys.exit(f"{lang}{path_of(lang, page)}: unresolved {left[:3]}")
    return doc


def build_routes_js():
    """Route table for js/router.js: soft navigation needs the same title,
    description and canonical that build_page() bakes into each page."""
    entries = []
    for lang in LANGS:
        other = "de" if lang == "en" else "en"
        for page in PAGES:
            if not page["tab"]:
                continue
            title, description = page[lang]
            entries.append("  %s: %s" % (json.dumps(path_of(lang, page)), json.dumps({
                "tab": page["tab"], "lang": lang, "title": title, "description": description,
                "canonical": BASE_URL + path_of(lang, page),
                "alt": path_of(other, page), "altCanonical": BASE_URL + path_of(other, page),
            }, ensure_ascii=False)))
    return (
        "/* Generated from tools/build_pages.py's PAGES list. Do not edit by hand.\n"
        "   Route table for js/router.js (soft navigation between boards). */\n"
        '"use strict";\n\n'
        "const ROUTES = {\n" + ",\n".join(entries) + "\n};\n"
    )


def build_sitemap():
    rows = []
    for page in PAGES:
        if page["dir"] == "legal":
            continue  # noindex
        alts = "".join(
            f'    <xhtml:link rel="alternate" hreflang="{l}" href="{BASE_URL}{path_of(l, page)}"/>\n'
            for l in LANGS)
        for lang in LANGS:
            rows.append(f"  <url>\n    <loc>{BASE_URL}{path_of(lang, page)}</loc>\n{alts}  </url>\n")
    return ('<?xml version="1.0" encoding="UTF-8"?>\n'
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" '
            'xmlns:xhtml="http://www.w3.org/1999/xhtml">\n' + "".join(rows) + "</urlset>\n"), len(rows)


def main():
    strings = load_strings()
    missing = set(strings["en"]) ^ set(strings["de"])
    if missing:
        sys.exit(f"js/i18n.js: keys only in one language: {sorted(missing)}")

    templates = {name: (SRC / name).read_text(encoding="utf-8") for name in ("page.html", "legal.html")}
    for lang in LANGS:
        for page in PAGES:
            out = ROOT / path_of(lang, page).strip("/") / "index.html"
            out.parent.mkdir(parents=True, exist_ok=True)
            out.write_text(build_page(templates[page["src"]], page, lang, strings),
                           encoding="utf-8", newline="\n")
            print(f"wrote {out.relative_to(ROOT)}")

    (ROOT / "js" / "routes.js").write_text(build_routes_js(), encoding="utf-8", newline="\n")
    print("wrote js/routes.js")

    sitemap, n = build_sitemap()
    (ROOT / "sitemap.xml").write_text(sitemap, encoding="utf-8", newline="\n")
    print(f"wrote sitemap.xml ({n} urls)")


if __name__ == "__main__":
    main()
