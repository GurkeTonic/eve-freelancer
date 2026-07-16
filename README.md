# Freelance Jobs Board

A public, read-only jobs board for EVE Online's Freelance Jobs system. Client-side only — no login, no backend, no tracking. Your browser talks directly to CCP's [ESI API](https://esi.evetech.net).

In-game, freelance jobs can't be sorted by payout, filtered by type or region, or checked against market value before you commit to one. This board fixes that.

## Features

- A dashboard overview: total ISK on offer, active job count, new listings since your last visit, and more, across both boards
- Sort and filter by job type, region, payout range, expiry, and jump-distance from a home system
- Payout checked against a selectable reference market (Jita, Amarr, Dodixie, Rens, or Exordium's own hub)
- Separate boards for New Eden and Exordium — Exordium has no route back once you leave, so its job market is effectively its own

See [`faq/`](faq/index.html) for how each of these actually works, and [`legal/`](legal/index.html) for privacy/legal info.

## Architecture

Plain HTML/CSS/JS, no framework, no npm build step, no backend. `index.html` is the one source template (the dashboard); `tools/build_pages.py` generates the `new-eden/`, `exordium/`, and `faq/` subpages from it, so every board ships the full app with every panel in the DOM and switching between them is a client-side swap, not a page reload — a real navigation, direct link, or JS-disabled visit still lands on a real static page per board. Run after every change to `index.html`:

```
python tools/build_pages.py
```

Map data comes from CCP's Static Data Export; regenerate it after an SDE update with:

```
pytho