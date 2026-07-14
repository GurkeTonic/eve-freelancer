# Contributing

## What helps most

- **Bug reports** with the page (New Eden / Exordium), what you expected, and what happened
- **Data corrections** (wrong market hub, wrong job type mapping) with a source
- **Reference market suggestions**: if there's a better-established hub than what's hardcoded in `js/config.js` (`MARKETS`), open an issue with a source

## Ground rules

- No frameworks, no build tooling, no npm dependencies — plain scripts only. Python (stdlib) is fine for tooling under `tools/`.
- English only, code and UI strings alike.
- All player-authored strings from ESI must go through `esc()` before rendering.
- Commit messages: one short line.

## Development setup

```
python -m http.server 8090                          # serve the repo root
python tools/build_static_data.py <sde-jsonl-zip>    # after an SDE release
```
