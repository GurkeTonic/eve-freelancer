/* ESI client. Depends on config.js. */
"use strict";

const ESI = (() => {
  const nameCache = new Map();
  /* Last seen values from X-Ratelimit-Remaining/-Limit (per developers.eveonline.com/docs/services/esi/rate-limiting).
     Confirmed CORS-exposed to browser JS by a live request, not assumed. */
  let rateRemaining = null;
  let rateLimit = null;

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /* Error with HTTP status attached, so views can special-case rate limits. */
  function httpError(what, status, retryAfterMs) {
    const err = new Error(`${what} -> HTTP ${status}`);
    err.status = status;
    err.rateLimited = status === 420 || status === 429;
    if (err.rateLimited) err.retryAfterMs = retryAfterMs ?? 5000;
    return err;
  }

  function readRateHeaders(res) {
    const remain = res.headers.get("x-ratelimit-remaining");
    const limit = res.headers.get("x-ratelimit-limit");
    if (remain !== null) rateRemaining = Number(remain);
    if (limit !== null) rateLimit = limit;
  }

  function retryAfterMs(res) {
    const header = res.headers.get("retry-after");
    if (!header) return undefined;
    const secs = Number(header);
    return Number.isFinite(secs) ? secs * 1000 : undefined;
  }

  function url(path, params = {}) {
    const u = new URL(CONFIG.ESI_BASE + path);
    u.searchParams.set("compatibility_date", CONFIG.COMPAT_DATE);
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== "") u.searchParams.set(k, v);
    }
    return u.toString();
  }

  /* Proactive throttle: if the last response said we're down to a handful of
     tokens, give the bucket a moment to refill instead of spending the last
     few and risking a 429 (developers.eveonline.com/docs/services/esi/rate-limiting
     asks well-behaved clients to "reduce request frequency when remaining
     tokens approach zero" rather than just reacting to errors). */
  async function throttleIfLow() {
    if (rateRemaining !== null && rateRemaining <= 3) await sleep(1000);
  }

  async function get(path, params) {
    await throttleIfLow();
    const res = await fetch(url(path, params), {
      headers: { "Accept": "application/json", "X-User-Agent": CONFIG.USER_AGENT }
    });
    readRateHeaders(res);
    if (!res.ok) throw httpError(`GET ${path}`, res.status, retryAfterMs(res));
    return res.json();
  }

  /* Resolve IDs (systems, types, characters, corporations, ...) to names. */
  async function names(ids) {
    const wanted = [...new Set(ids)].filter(id => Number.isFinite(id) && !nameCache.has(id));
    for (let i = 0; i < wanted.length; i += 900) {
      const chunk = wanted.slice(i, i + 900);
      if (chunk.length === 0) continue;
      await throttleIfLow();
      const res = await fetch(url("/universe/names"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "X-User-Agent": CONFIG.USER_AGENT
        },
        body: JSON.stringify(chunk)
      });
      readRateHeaders(res);
      if (!res.ok) throw httpError("POST /universe/names", res.status, retryAfterMs(res));
      const data = await res.json();
      for (const item of data) nameCache.set(item.id, item.name);
    }
    return nameCache;
  }

  function name(id) {
    return nameCache.get(id) ?? String(id);
  }

  function rateLimitStatus() {
    return { remaining: rateRemaining, limit: rateLimit };
  }

  return { get, names, name, rateLimitStatus, sleep };
})();
