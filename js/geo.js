/* Home-system search, jump distance (BFS), and region lookup.
   Depends on js/data/staticdata.js (SDATA).

   Exordium has no normal-space route to the rest of New Eden — the raw SDE
   stargate table still lists a gate, but it isn't a flyable connection in
   game (confirmed by the user, not something the static data can tell us).
   Home-system search is scoped by page (js/config.js sets PAGE_SCOPE) so
   nobody picks a home on the wrong side of that gap. */
"use strict";

const EXORDIUM_REGION = "Exordium";

const Geo = (() => {
  const scope = typeof PAGE_SCOPE !== "undefined" ? PAGE_SCOPE : "main";
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

  function regionOf(systemId) {
    return SDATA.regions[systemId] || null;
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

  return { searchSystems, systemIdByName, regionOf, jumpsFrom };
})();
