/* Home-system search, jump distance (BFS), and region lookup.
   Depends on js/data/staticdata.js (SDATA).

   Exordium has no normal-space route to the rest of New Eden — the raw SDE
   stargate table still lists a gate, but it isn't a flyable connection in
   game (confirmed by the user, not something the static data can tell us).
   Home-system search is scoped per board (New Eden vs. Exordium) so nobody
   picks a home on the wrong side of that gap — createGeo() is instantiated
   once per scope below, both live in the DOM at once (see js/app.js). */
"use strict";

const EXORDIUM_REGION = "Exordium";

/* J-space solar system ids (31000000 to 31999999). */
function isWormhole(systemId) {
  const id = Number(systemId);
  return id >= 31000000 && id < 32000000;
}

/* The client's colour for a shown security status, as a CSS custom
   property name (--s10 for 1.0 … --s1 for 0.1, --s0 for everything at or
   below 0.0). Values: ESI docs, "System Security". */
function secColor(sec) {
  return sec > 0 ? `var(--s${Math.round(sec * 10)})` : "var(--s0)";
}

function fmtSec(sec) {
  return sec.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).replace("-", "\u2212");
}

function createGeo(scope) {
  const nameIndex = Object.entries(SDATA.names)
    .filter(([id]) => (SDATA.regions[id] === EXORDIUM_REGION) === (scope === "exordium"))
    .map(([id, n]) => ({ id: Number(id), name: n, lower: n.toLowerCase() }));

  function searchSystems(query, limit = 8) {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    const starts = [];
    const contains = [];
    for (const e of nameIndex) {
      if (e.lower.startsWith(q)) starts.push(e);
      else if (e.lower.includes(q)) contains.push(e);
      if (starts.length >= limit) break;
    }
    return starts.concat(contains).slice(0, limit);
  }

  function systemIdByName(name) {
    const q = name.trim().toLowerCase();
    const hit = nameIndex.find(e => e.lower === q);
    return hit ? hit.id : null;
  }

  function nameOf(systemId) {
    return SDATA.names[systemId] || null;
  }

  function regionOf(systemId) {
    return SDATA.regions[systemId] || null;
  }

  /* Security status as the client shows it (one decimal, stored that way
     by tools/build_static_data.py), or null if unknown. Wormhole systems
     are not in the static data; the client shows them as -1.0. */
  function secOf(systemId) {
    const sec = SDATA.sec[systemId];
    if (typeof sec === "number") return sec;
    return isWormhole(systemId) ? -1 : null;
  }

  /* hs >= 0.5, ls 0.1 to 0.4, ns <= 0.0 of the shown value (ESI docs,
     "System Security"). */
  function secClass(sec) {
    if (sec === null) return null;
    if (sec >= 0.5) return "hs";
    if (sec > 0) return "ls";
    return "ns";
  }

  /* Which column of the overview's security ladder a system falls in:
     "10" … "1" for 1.0 … 0.1, "ns", "wh", or null when unknown. */
  function ladderBin(systemId) {
    if (isWormhole(systemId)) return "wh";
    const sec = secOf(systemId);
    if (sec === null) return null;
    return sec > 0 ? String(Math.round(sec * 10)) : "ns";
  }

  /* Breadth-first search over the full k-space stargate graph. */
  function jumpsFrom(originId) {
    if (!originId || !SDATA.graph[originId]) return null;
    const dist = new Map([[originId, 0]]);
    let frontier = [originId];
    while (frontier.length > 0) {
      const next = [];
      for (const cur of frontier) {
        for (const n of SDATA.graph[cur] || []) {
          if (!dist.has(n)) {
            dist.set(n, dist.get(cur) + 1);
            next.push(n);
          }
        }
      }
      frontier = next;
    }
    return dist;
  }

  return { searchSystems, systemIdByName, nameOf, regionOf, secOf, secClass, ladderBin, jumpsFrom };
}

const GeoMain = createGeo("main");
const GeoExordium = createGeo("exordium");
