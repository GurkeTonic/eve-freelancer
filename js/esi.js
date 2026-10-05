/* ESI data, read from the snapshot under /data/esi/. Depends on config.js.

   Until 5.10.2026 this module called esi.evetech.net from the visitor's
   browser, about 440 requests per full load. The data is the same for
   everybody, so tools/fetch_esi.py now fetches it once per build
   (.github/workflows/deploy.yml) and this module serves the files. The
   interface stayed the same, so js/jobs.js did not have to change:

     get("/freelance-jobs")            every job in one response
     get("/freelance-jobs/<id>")       from details.json
     get("/markets/<region>/orders")   best buy at the reference station,
                                       from prices.json, as one buy order
     fetched(group)                    when a group was fetched (meta.json)
     stations()                        {station_id: {name, system_id}} for
                                       the NPC stations delivery jobs name

   The visitor's browser no longer contacts CCP. */
"use strict";

const ESI = (() => {
  const nameCache = new Map();
  const once = new Map();  // file -> Promise, read once per page load

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function httpError(what, status) {
    const err = new Error(`${what} -> HTTP ${status}`);
    err.status = status;
    err.rateLimited = false;
    return err;
  }

  async function file(rel) {
    const res = await fetch(`/data/esi/${rel}`, { cache: "no-cache" });
    if (!res.ok) throw httpError(`/data/esi/${rel}`, res.status);
    return res.json();
  }

  function cached(rel) {
    if (!once.has(rel)) once.set(rel, file(rel).catch(err => { once.delete(rel); throw err; }));
    return once.get(rel);
  }

  async function get(path, params = {}) {
    if (path === "/freelance-jobs") {
      // A refresh (force) must see the new list, so this one is not cached.
      once.delete("details.json");
      once.delete("prices.json");
      once.delete("stations.json");
      return file("freelance-jobs.json");
    }
    const job = path.match(/^\/freelance-jobs\/([^/]+)$/);
    if (job) {
      const all = await cached("details.json");
      if (!all[job[1]]) throw httpError(`GET ${path}`, 404);
      return all[job[1]];
    }
    const market = path.match(/^\/markets\/(\d+)\/orders$/);
    if (market) {
      const m = (await cached("prices.json"))[market[1]];
      const buy = m?.buy?.[params.type_id];
      return buy ? [{ location_id: m.station, is_buy_order: true, price: buy }] : [];
    }
    throw httpError(`GET ${path}`, 404);
  }

  async function names() {
    return nameCache;
  }

  function name(id) {
    return nameCache.get(id) ?? String(id);
  }

  function rateLimitStatus() {
    return { remaining: null, limit: null };
  }

  async function fetched(group) {
    try {
      return (await file("meta.json"))[group] ?? null;
    } catch {
      return null;
    }
  }

  /* Missing or broken, the board still works — delivery jobs without a
     broadcast location just show no place, as before 5.10.2026. */
  async function stations() {
    try {
      return await cached("stations.json");
    } catch {
      return {};
    }
  }

  return { get, names, name, rateLimitStatus, sleep, fetched, stations };
})();
