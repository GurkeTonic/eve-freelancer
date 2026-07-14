# Freelance Jobs Board

A public, read-only jobs board for EVE Online's Freelance Jobs system. Client-side only — no login, no backend, no tracking. Your browser talks directly to CCP's [ESI API](https://esi.evetech.net).

In-game, freelance jobs can't be sorted by payout, filtered by type or region, or checked against market value before you commit to one. This board fixes that.

## Features

- Sort and filter by job type, region, payout range, expiry, and jump-distance from a home system
- Payout checked against a selectable reference market (Jita, Amarr, Dodixie, Rens, or Exordium's own hub)
- Separate boards for New Eden and Exordium — Exordium has no route back once you leave, so its job market is effectively its own

See [`faq/`](faq/index.html) for how each of these actually works, and [`legal/`](legal/index.html) for privacy/legal info.

## Architecture

Plain HTML/CSS/JS, no framework, no build step, no backend. Two near-identical pages (`index.html` for New Eden, `exordium/index.html` for Exordium) share all the same JS/CSS. Map data comes from CCP's Static Data Export; regenerate it after an SDE update with:

```
python tools/build_static_data.py <sde-jsonl-zip>
```

## Related

Extracted from [Warzone Companion](https://warzone.tonicbeacon.com), where this started as a buried tab.

## License

[MIT](LICENSE). Not affiliated with or endorsed by CCP Games — "EVE", "EVE Online", "CCP", and related logos are trademarks of CCP hf., used under CCP's [developer license](https://developers.eveonline.com/resource/license-agreement).

Found a security issue? See [SECURITY.md](SECURITY.md).
