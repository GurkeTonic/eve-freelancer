/* Freelance jobs board. Depends on config.js, i18n.js, esi.js, geo.js.

   createJobsView() is instantiated once per board (New Eden, Exordium) —
   both panels ship in every page (see src/page.html) and live in the DOM at
   once, so each needs its own state closure and its own element ids
   (jobIds() below) rather than sharing "jobs-body" etc. between them. */
"use strict";

function jobIds(scope) {
  const p = `jobs-${scope}-`;
  return {
    type: p + "type",
    region: p + "region",
    sort: p + "sort",
    reset: p + "reset",
    count: p + "count",
    market: p + "market",
    minIsk: p + "min-isk",
    maxIsk: p + "max-isk",
    hideBad: p + "hide-bad",
    home: p + "home",
    homeList: p + "home-list",
    maxJumps: p + "max-jumps",
    progress: p + "progress",
    body: p + "body",
    more: p + "more"
  };
}

/* Reads a stored numeric filter value back into a number, or null if
   unset/invalid. */
function loadStoredNum(key) {
  const raw = localStorage.getItem(key);
  if (raw === null) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function createJobsView(scope, geo, ids) {
  let jobs = [];
  /* Filters/sort persist per board across visits (not just home system and
     market, which already did) — a returning user's view stays exactly as
     they left it instead of resetting on every page load. */
  let typeFilter = localStorage.getItem("fjb_type_" + scope) || "__all";
  let regionFilter = localStorage.getItem("fjb_region_" + scope) || "__all";
  let sortMode = localStorage.getItem("fjb_sort_" + scope) || "payout_desc";
  let minIsk = loadStoredNum("fjb_min_" + scope);
  let maxIsk = loadStoredNum("fjb_max_" + scope);
  let homeSystemId = null;
  let maxJumps = loadStoredNum("fjb_maxjumps_" + scope);
  let hideBadDeals = localStorage.getItem("fjb_hidebad_" + scope) === "1";
  let market = availableMarkets(scope)[0];
  const detailCache = new Map();
  const priceMap = new Map(); // "marketKey:type_id" -> { buy }
  let detailsDone = 0;
  let detailsTotal = 0;
  let pricingDone = 0;
  let pricingTotal = 0;

  /* Loaded-once state so DashboardView (which needs both boards' data up
     front) and a board's own tab (which may be visited before or after the
     dashboard) never trigger a duplicate fetch of the same data. */
  let hasLoaded = false;

  /* "Show more" instead of one 380-row table or page numbers: Baymard's
     study (Smashing Magazine, 2016) found it beats both, and puts 25–75
     first rows for a sorted list. The count survives switching boards (the
     view lives on), and resets when a filter changes what the list is. */
  const PAGE = 50;
  let limit = PAGE;
  let lastFilterKey = "";

  /* The public list endpoint has no cursor sort — pull every page up front
     (capped) so payout/progress sort is correct across the whole board, not
     just within one page. `force` re-fetches even if already loaded (used by
     the Refresh button and auto-refresh); a plain call from DashboardView or
     from switching back to an already-visited board is a no-op. */
  async function load(force = false) {
    if (hasLoaded && !force) return;
    jobs = [];
    let after = null;
    let page = 0;
    while (page < CONFIG.JOBS_MAX_PAGES) {
      page++;
      const params = { limit: CONFIG.JOBS_PAGE_LIMIT };
      if (after) params.after = after;
      const res = await ESI.get("/freelance-jobs", params);
      const chunk = res.freelance_jobs || [];
      jobs = jobs.concat(chunk);
      after = res.cursor?.after || null;
      if (!after || chunk.length === 0) break;
    }
    hasLoaded = true;
  }

  /* A job is "priceable" when its configuration names exactly one concrete
     item or ore type (not a whole group) — that's the only case a single
     Jita price can be compared against. */
  function extractPriceableType(method, configuration) {
    const params = configuration?.parameters;
    if (!params) return null;
    if (method === "DeliverItem") {
      const entry = params.corporation_item_delivery?.corporation_item_delivery?.item_type?.values?.[0];
      if (entry?.value_type === "item_type" && entry.values?.length === 1) {
        return Number(entry.values[0]);
      }
    }
    if (method === "MineOre") {
      const entry = params.ore?.matcher?.values?.[0];
      if (entry?.value_type === "ore_type" && entry.values?.length === 1) {
        return Number(entry.values[0]);
      }
    }
    return null;
  }

  /* Where a delivery job's items have to go: NPC stations resolved at build
     time (data/esi/stations.json), player structures only counted — their
     location is not public. */
  function deliveryTarget(configuration, stationMap) {
    const groups = configuration?.parameters?.corporation_item_delivery?.corporation_item_delivery
      ?.corporation_office_location?.values || [];
    const out = { stations: [], structures: 0 };
    for (const g of groups) {
      for (const id of g.values || []) {
        const st = g.value_type === "station" ? stationMap[id] : null;
        if (st) out.stations.push({ id: Number(id), name: st.name, systemId: st.system_id });
        else if (g.value_type === "structure") out.structures++;
      }
    }
    return out;
  }

  async function fetchDetail(job) {
    let d = detailCache.get(job.id);
    if (!d) {
      d = await ESI.get(`/freelance-jobs/${job.id}`);
      detailCache.set(job.id, d);
    }
    job.method = d.configuration?.method ?? null;
    job.career = d.details?.career ?? null;
    job.expires = d.details?.expires ?? null;
    job.creator = d.details?.creator ?? null;
    job.description = d.details?.description ?? null;
    job.rewardPerContribution = d.contribution?.reward_per_contribution ?? null;
    job.broadcastLocations = d.access_and_visibility?.broadcast_locations || [];
    job.delivery = deliveryTarget(d.configuration, await ESI.stations());
    /* About one job in eight has no broadcast location. A delivery job then
       still names where the items go; if that is an NPC station, its system
       stands in, so region, distance and the board split work for it too. */
    job.locationFromDelivery = job.broadcastLocations.length === 0 && job.delivery.stations.length > 0;
    if (job.locationFromDelivery) {
      job.broadcastLocations = job.delivery.stations.map(s => ({ id: s.systemId, name: geo.nameOf(s.systemId) ?? s.name }));
    }
    job.regions = [...new Set(job.broadcastLocations.map(l => geo.regionOf(l.id)).filter(Boolean))];
    job.priceableTypeId = extractPriceableType(job.method, d.configuration);
    job._detailLoaded = true;
  }

  /* Runs `worker` over `items` with bounded concurrency. `worker` must catch
     its own non-rate-limit failures (mark-and-move-on) and only rethrow when
     err.rateLimited — that rethrow pauses ALL workers until err.retryAfterMs
     elapses (honoring ESI's Retry-After) and puts the item back on the queue.
     Gives up for good after too many rate-limit hits in one pass, so a
     persistently angry ESI doesn't retry forever. */
  async function runPool(items, concurrency, worker, onProgress) {
    const total = items.length;
    const queue = items.slice();
    let done = 0;
    let cooldownUntil = 0;
    let rateLimitHits = 0;
    const MAX_RATE_LIMIT_HITS = 5;
    const runners = Array.from({ length: concurrency }, async () => {
      while (queue.length > 0) {
        const item = queue.shift();
        const wait = cooldownUntil - Date.now();
        if (wait > 0) await ESI.sleep(wait);
        try {
          await worker(item);
          done++;
        } catch (err) {
          rateLimitHits++;
          if (rateLimitHits > MAX_RATE_LIMIT_HITS) throw err;
          cooldownUntil = Date.now() + err.retryAfterMs;
          queue.push(item);
        }
        onProgress?.(done, total);
      }
    });
    await Promise.all(runners);
  }

  async function prefetchDetails(onProgress) {
    detailsTotal = jobs.length;
    detailsDone = 0;
    await runPool(jobs.slice(), CONFIG.DETAIL_CONCURRENCY, async job => {
      try {
        await fetchDetail(job);
      } catch (err) {
        if (err.rateLimited) throw err;
        job._detailLoaded = true; // don't retry forever; row just shows "—"
      }
    }, (done, total) => {
      detailsDone = done;
      onProgress?.(done, total);
    });
  }

  async function fetchMarketPrice(m, typeId) {
    const key = `${m.key}:${typeId}`;
    if (priceMap.has(key)) return;
    const orders = await ESI.get(`/markets/${m.regionId}/orders`, { type_id: typeId, order_type: "all" });
    let buy = 0;
    for (const o of orders) {
      if (o.location_id !== m.stationId || !o.is_buy_order) continue;
      if (o.price > buy) buy = o.price;
    }
    priceMap.set(key, { buy });
  }

  async function prefetchPrices(onProgress) {
    const activeMarket = market;
    const ids2 = [...new Set(jobs.map(j => j.priceableTypeId).filter(Boolean))]
      .filter(id => !priceMap.has(`${activeMarket.key}:${id}`));
    pricingTotal = ids2.length;
    pricingDone = 0;
    await runPool(ids2, CONFIG.MARKET_CONCURRENCY, async id => {
      try {
        await fetchMarketPrice(activeMarket, id);
      } catch (err) {
        if (err.rateLimited) throw err;
        priceMap.set(`${activeMarket.key}:${id}`, { buy: 0, error: true });
      }
    }, (done, total) => {
      pricingDone = done;
      onProgress?.(done, total);
    });
  }

  /* Aggregate numbers for DashboardView's summary line. Cheap to recompute
     on every call — just array scans over data already in memory, no
     DOM/network work — so it can be called on every dashboard render
     without its own caching. Scoped through belongsToThisPage() like
     visibleJobs() is — the raw `jobs` array is the same shared ESI list for
     every board, undifferentiated until each job's broadcast locations are
     known (see belongsToThisPage). */
  function stats(exclude) {
    let totalReward = 0;
    let priceableCount = 0;
    let belowMarketCount = 0;
    const scoped = scopedJobs(exclude);

    for (const j of scoped) {
      totalReward += j.reward?.remaining ?? 0;
      if (j.priceableTypeId) {
        priceableCount++;
        const v = valueVerdict(j);
        if (v && typeof v === "object" && v.flag === "bad") belowMarketCount++;
      }
    }

    return {
      count: scoped.length,
      totalReward,
      priceableCount,
      belowMarketCount
    };
  }

  /* { flag: "bad"|"neutral"|"good", ratio } comparing reward/contribution to
     the best buy order at the selected reference market (what you'd get
     instant-selling there), or "pending"/"unknown"/null when not (yet)
     comparable. */
  function valueVerdict(job) {
    if (!job.priceableTypeId) return null;
    const price = priceMap.get(`${market.key}:${job.priceableTypeId}`);
    if (!price) return "pending";
    if (!price.buy || price.buy <= 0) return "unknown";
    const ratio = (job.rewardPerContribution ?? 0) / price.buy;
    if (ratio < 0.9) return { flag: "bad", ratio };
    if (ratio > 1.1) return { flag: "good", ratio };
    return { flag: "neutral", ratio };
  }

  /* Sortable form of valueVerdict() — a plain number for "best value first",
     or null for anything not (yet) comparable so it sorts to the bottom
     instead of clumping at a fake 0. */
  function valueScore(job) {
    const v = valueVerdict(job);
    return v && typeof v === "object" ? v.ratio : null;
  }

  /* Top N jobs by reward per contribution, for DashboardView's highlight
     list — the actual "here's what's worth grabbing right now" list, not
     an abstract count. Includes the value ratio (when known) and enough
     detail (location, progress, expiry, creator) to expand inline right on
     the dashboard, so a click never dead-ends on the general board page. */
  function topPayouts(n, exclude) {
    return scopedJobs(exclude)
      .filter(j => j.rewardPerContribution != null)
      .sort((a, b) => b.rewardPerContribution - a.rewardPerContribution)
      .slice(0, n)
      .map(j => ({ id: j.id, reward: j.rewardPerContribution, html: rowCells(j, { progress: false }) }));
  }

  /* ---------- one job as table cells, shared by the board and the overview */

  function locationHtml(j) {
    if (!j._detailLoaded) return `<span class="dim">…</span>`;
    const loc = nearestLocation(j);
    if (!loc) {
      if (j.delivery?.structures) {
        const label = j.delivery.structures > 1 ? t("loc_structures", { n: j.delivery.structures }) : t("loc_structure");
        return `<span class="dim" title="${t("loc_deliver")}">${label}</span>`;
      }
      return `<span class="dim" title="${t("loc_none")}">—</span>`;
    }
    const sec = geo.secOf(loc.id);
    const region = geo.regionOf(loc.id);
    const more = scopedLocations(j).length - 1;
    const title = j.locationFromDelivery ? `${t("loc_deliver")} ${j.delivery.stations.map(s => s.name).join(", ")}` : "";
    /* The colour sits in a swatch, the number stays in the text colour:
       0.5's pale yellow or 0.1's dark red would be unreadable as text on
       one of the two themes. */
    return (sec !== null ? `<span class="sec" style="--c:${secColor(sec)}">${fmtSec(sec)}</span>` : "")
      + `<span class="sys"${title ? ` title="${esc(title)}"` : ""}>${esc(loc.name)}</span>`
      + (loc.jumps != null ? `<span class="j">${loc.jumps}\u2009j</span>` : "")
      + (j.locationFromDelivery ? `<span class="reg">${t("loc_delivery")}</span>` : "")
      + (region ? `<span class="reg">${esc(region)}${more > 0 ? ` +${more}` : ""}</span>` : "");
  }

  function valueHtml(j) {
    const v = valueVerdict(j);
    if (v === "pending") return `<span class="v-none">…</span>`;
    if (v === "unknown") return `<span class="v-none" title="${t("value_unknown")}">—</span>`;
    if (!v || typeof v !== "object") return `<span class="v-none">—</span>`;
    /* Signed distance from the market price instead of a ratio: +18 % reads
       as "pays more than selling it" without a colour to decode. */
    const d = Math.round((v.ratio - 1) * 100);
    const txt = d === 0 ? "±0" : (d > 0 ? "+" : "\u2212") + fmtNum(Math.abs(d));
    const cls = v.flag === "bad" ? "v-bad" : v.flag === "good" ? "v-good" : "";
    return `<span class="${cls}">${txt}${LANG === "de" ? "\u202f%" : "%"}</span>`;
  }

  function rowCells(j, { progress = true } = {}) {
    const cur = j.progress?.current ?? 0;
    const des = j.progress?.desired ?? 0;
    const pct = des > 0 ? Math.min(100, (cur / des) * 100) : 0;
    const type = j.method ? esc(jobMethodLabel(j.method)) : (j._detailLoaded ? "" : "…");
    const reward = j.rewardPerContribution != null ? `${fmtIsk(j.rewardPerContribution)}` : (j._detailLoaded ? "—" : "…");
    return `
      <td class="jname"><b>${esc(eveText(j.name) || j.id)}</b><span class="t">${type}</span></td>
      <td class="loc">${locationHtml(j)}</td>
      <td class="num c-reward"><span class="reward">${reward}</span></td>
      <td class="num c-value" data-l="${t("th_value")}">${valueHtml(j)}</td>
      ${progress ? `<td class="c-prog"><span class="prog"><span class="prog-track"><span class="prog-fill" style="width:${pct.toFixed(1)}%"></span></span>${fmtNum(cur)}/${fmtNum(des)}</span></td>` : ""}
      <td class="num c-exp" data-l="${t("th_expires")}"><span class="${isExpiringSoon(j) ? "soon" : ""}" title="${esc(fmtDate(j.expires))}">${fmtLeft(j.expires)}</span></td>`;
  }

  /* Exordium has no flyable route to the rest of New Eden (see geo.js) — each
     board only ever considers broadcast locations on its own side of that gap. */
  function scopedLocations(job) {
    return (job.broadcastLocations || []).filter(l =>
      (geo.regionOf(l.id) === EXORDIUM_REGION) === (scope === "exordium")
    );
  }
  function scopedRegions(job) {
    return [...new Set(scopedLocations(job).map(l => geo.regionOf(l.id)).filter(Boolean))];
  }
  /* A job with no broadcast-location data at all isn't confirmed Exordium-only —
     default it to the main New Eden board rather than hiding it everywhere. */
  function belongsToThisPage(job) {
    if (!job._detailLoaded) return true;
    const all = job.broadcastLocations || [];
    if (all.length === 0) return scope !== "exordium";
    return scopedLocations(job).length > 0;
  }

  /* This board's jobs, minus the ids in `exclude` (a Set). A job broadcast
     from both sides of the Exordium gap belongs to both boards, so the
     dashboard passes New Eden's ids when it asks Exordium for its share —
     otherwise every such job is counted twice in the totals. */
  function scopedJobs(exclude) {
    return jobs.filter(j => belongsToThisPage(j) && !exclude?.has(j.id));
  }

  function scopedIds() {
    return new Set(scopedJobs().map(j => j.id));
  }

  function nearestLocation(job) {
    const locs = scopedLocations(job);
    if (locs.length === 0) return null;
    if (!homeSystemId) return { ...locs[0], jumps: null };
    const dist = geo.jumpsFrom(homeSystemId);
    if (!dist) return { ...locs[0], jumps: null };
    let best = null;
    for (const l of locs) {
      const j = dist.get(l.id);
      if (j !== undefined && (best === null || j < best.jumps)) best = { ...l, jumps: j };
    }
    return best || { ...locs[0], jumps: null };
  }

  /* { hs, ls, ns, unknown } job counts, one classification per job (its
     first scoped broadcast location — the same one nearestLocation() would
     pick with no home system set) rather than per location, so a job
     broadcasting from five highsec stations doesn't outweigh five separate
     one-location jobs. Only counts jobs whose detail (and so broadcast
     locations) has loaded. */
  function securityBreakdown(exclude) {
    const counts = { hs: 0, ls: 0, ns: 0, unknown: 0 };
    for (const j of scopedJobs(exclude)) {
      if (!j._detailLoaded) continue;
      const locs = scopedLocations(j);
      if (locs.length === 0) continue;
      const cls = geo.secClass(geo.secOf(locs[0].id));
      counts[cls ?? "unknown"]++;
    }
    return counts;
  }

  /* Job counts per column of the overview's security ladder: "10" … "1",
     "ns", "wh", and "none" for jobs not broadcast anywhere. One column per
     job, by its first broadcast location on this board, as in
     securityBreakdown(). Null until every job's detail has loaded, so the
     ladder draws once, complete, instead of growing in steps. */
  function ladder(exclude) {
    if (!hasLoaded || !jobs.every(j => j._detailLoaded)) return null;
    const counts = { none: 0 };
    for (const j of scopedJobs(exclude)) {
      const locs = scopedLocations(j);
      const bin = locs.length ? geo.ladderBin(locs[0].id) : "none";
      if (bin) counts[bin] = (counts[bin] ?? 0) + 1;
    }
    return counts;
  }

  /* Top N corporations by number of active jobs posted, for the "who's
     hiring" list. Only counts jobs whose detail (and so creator) has
     loaded. */
  function topCorps(n, exclude) {
    const counts = new Map();
    for (const j of scopedJobs(exclude)) {
      const name = j.creator?.corporation?.name;
      if (!name) continue;
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, n);
  }

  async function toggleDetail(row, jobId) {
    const existing = row.nextElementSibling;
    const wasOpen = existing && existing.classList.contains("job-detail");
    document.querySelectorAll(".job-detail").forEach(el => el.remove());
    document.querySelectorAll("tr.open").forEach(el => el.classList.remove("open"));
    if (wasOpen) return;

    const job = jobs.find(j => j.id === jobId);
    if (job && !job._detailLoaded) {
      try { await fetchDetail(job); } catch { /* row just shows what it has */ }
    }

    const creator = job?.creator;
    const corp = creator?.corporation?.name;
    const pilot = creator?.character?.name;
    const locs = (job?.broadcastLocations || []).map(l => esc(l.name)).join(", ");
    const verdict = valueVerdict(job);
    let verdictLine = "";
    if (verdict && typeof verdict === "object") {
      const price = priceMap.get(`${market.key}:${job.priceableTypeId}`);
      verdictLine = t("value_vs_market", { reward: fmtIsk(job.rewardPerContribution), market: market.name.split(" (")[0], price: fmtIsk(price?.buy) });
    }
    const delivery = job?.delivery;
    const deliverTo = delivery && (delivery.stations.length || delivery.structures)
      ? [...delivery.stations.map(s => esc(s.name)),
         ...(delivery.structures ? [delivery.structures > 1 ? t("loc_structures", { n: delivery.structures }) : t("loc_structure")] : [])].join("<br>")
      : "";
    const rows = [
      [t("job_creator"), [corp, pilot].filter(Boolean).map(esc).join(", ")],
      [t("job_career"), esc(job?.career ?? "")],
      [job?.locationFromDelivery ? "" : t("th_locations"), job?.locationFromDelivery ? "" : locs],
      [t("loc_deliver"), deliverTo],
      [t("th_value"), verdictLine],
      [t("job_progress"), job?.progress ? `${fmtNum(job.progress.current ?? 0)} / ${fmtNum(job.progress.desired ?? 0)}` : ""],
      [t("th_expires"), job?.expires ? fmtDate(job.expires) : ""]
    ].filter(([k, v]) => k && v);

    const tr = document.createElement("tr");
    tr.className = "job-detail";
    tr.innerHTML = `
      <td colspan="${row.children.length}">
        <div class="detail">
          <p class="desc">${esc(eveText(job?.description)) || `<span class="dim">${t("job_desc_missing")}</span>`}</p>
          <dl>${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("")}</dl>
        </div>
      </td>
    `;
    row.classList.add("open");
    row.after(tr);
  }

  function distinctTypes() {
    return [...new Set(jobs.map(j => j.method).filter(Boolean))];
  }

  function distinctRegions() {
    return [...new Set(jobs.flatMap(j => scopedRegions(j)))].sort();
  }

  function visibleJobs({ ignoreType = false } = {}) {
    let list = jobs.filter(belongsToThisPage);
    if (typeFilter !== "__all" && !ignoreType) list = list.filter(j => j.method === typeFilter);
    if (regionFilter !== "__all") list = list.filter(j => scopedRegions(j).includes(regionFilter));
    if (minIsk !== null) list = list.filter(j => (j.rewardPerContribution ?? 0) >= minIsk);
    if (maxIsk !== null) list = list.filter(j => (j.rewardPerContribution ?? 0) <= maxIsk);
    if (homeSystemId && maxJumps !== null) {
      list = list.filter(j => {
        const loc = nearestLocation(j);
        return loc && loc.jumps !== null && loc.jumps <= maxJumps;
      });
    }
    if (hideBadDeals) {
      /* Only drop *confirmed* bad deals — pending/unknown/not-priceable jobs
         stay, since we can't yet judge them either way. */
      list = list.filter(j => {
        const v = valueVerdict(j);
        return !(v && typeof v === "object" && v.flag === "bad");
      });
    }

    if (ignoreType) return list;
    const sorted = list.slice();
    switch (sortMode) {
      case "payout_asc":
        sorted.sort((a, b) => {
          const pa = a.rewardPerContribution, pb = b.rewardPerContribution;
          if (pa == null) return 1;
          if (pb == null) return -1;
          return pa - pb;
        });
        break;
      case "value_desc":
        sorted.sort((a, b) => {
          const va = valueScore(a), vb = valueScore(b);
          if (va == null) return 1;
          if (vb == null) return -1;
          return vb - va;
        });
        break;
      case "progress_desc":
        sorted.sort((a, b) => progressRatio(b) - progressRatio(a));
        break;
      case "name_asc":
        sorted.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
        break;
      case "distance_asc":
        sorted.sort((a, b) => {
          const da = nearestLocation(a)?.jumps;
          const db = nearestLocation(b)?.jumps;
          if (da === null || da === undefined) return 1;
          if (db === null || db === undefined) return -1;
          return da - db;
        });
        break;
      case "expires_asc":
        sorted.sort((a, b) => {
          const da = a.expires ? Date.parse(a.expires) : null;
          const db = b.expires ? Date.parse(b.expires) : null;
          if (da === null) return 1;
          if (db === null) return -1;
          return da - db;
        });
        break;
      case "payout_desc":
      default:
        sorted.sort((a, b) => {
          const pa = a.rewardPerContribution, pb = b.rewardPerContribution;
          if (pa == null) return 1;
          if (pb == null) return -1;
          return pb - pa;
        });
    }
    return sorted;
  }

  function progressRatio(j) {
    const des = j.progress?.desired ?? 0;
    return des > 0 ? (j.progress?.current ?? 0) / des : 0;
  }

  const ONE_DAY_MS = 24 * 60 * 60 * 1000;
  function isExpiringSoon(j) {
    if (!j.expires) return false;
    const msLeft = Date.parse(j.expires) - Date.now();
    return msLeft > 0 && msLeft < ONE_DAY_MS;
  }

  function rebuildSelect(sel, values, current, allLabel, labelFn) {
    sel.innerHTML = "";
    const optAll = document.createElement("option");
    optAll.value = "__all";
    optAll.textContent = allLabel;
    sel.appendChild(optAll);
    for (const v of values) {
      const opt = document.createElement("option");
      opt.value = v;
      opt.textContent = labelFn ? labelFn(v) : v;
      sel.appendChild(opt);
    }
    /* Nothing known yet (right after load, before detail enrichment has
       resolved any job's type/region) — don't force a pending filter (e.g.
       one just restored from localStorage) back to "All" just because we
       can't validate it against an empty list. Leave it alone; the next
       render (once values are non-empty) picks the real selection back up. */
    if (values.length === 0) return false;
    sel.value = values.includes(current) || current === "__all" ? current : "__all";
    return true;
  }

  function bindControlsOnce() {
    const sortSel = document.getElementById(ids.sort);
    if (sortSel.options.length === 0) {
      for (const s of ["payout_desc", "payout_asc", "value_desc", "progress_desc", "name_asc", "distance_asc", "expires_asc"]) {
        const opt = document.createElement("option");
        opt.value = s;
        opt.textContent = t("sort_" + s);
        sortSel.appendChild(opt);
      }
      sortSel.value = sortMode;
      sortSel.addEventListener("change", () => {
        sortMode = sortSel.value;
        localStorage.setItem("fjb_sort_" + scope, sortMode);
        render();
      });
    }

    const marketSel = document.getElementById(ids.market);
    if (marketSel.options.length === 0) {
      for (const m of availableMarkets(scope)) {
        const opt = document.createElement("option");
        opt.value = m.key;
        opt.textContent = m.name;
        marketSel.appendChild(opt);
      }
      const saved = localStorage.getItem("fjb_market_" + scope);
      if (saved && availableMarkets(scope).some(m => m.key === saved)) {
        market = availableMarkets(scope).find(m => m.key === saved);
      }
      marketSel.value = market.key;
      marketSel.addEventListener("change", async () => {
        market = availableMarkets(scope).find(m => m.key === marketSel.value) || availableMarkets(scope)[0];
        localStorage.setItem("fjb_market_" + scope, market.key);
        render();
        try {
          await prefetchPrices((done, total) => {
            if (done % 5 === 0 || done === total) render();
          });
          render();
        } catch (err) {
          render();
          document.getElementById(ids.progress).textContent = t("enrich_aborted");
          if (!err.rateLimited) App.reportError(err);
        }
      });
    }

    /* Job type as facets with counts: the count is what the list would
       show with that type picked and every other filter as it is. */
    const typeBox = document.getElementById(ids.type);
    if (!typeBox.dataset.bound) {
      typeBox.dataset.bound = "1";
      typeBox.addEventListener("click", (e) => {
        const b = e.target.closest("button");
        if (!b) return;
        typeFilter = b.dataset.v === typeFilter ? "__all" : b.dataset.v;
        localStorage.setItem("fjb_type_" + scope, typeFilter);
        render();
      });
    }
    const counts = new Map();
    for (const j of visibleJobs({ ignoreType: true })) if (j.method) counts.set(j.method, (counts.get(j.method) ?? 0) + 1);
    /* Only types this board has under the other filters; a zero is a
       button that leads nowhere. The picked one stays, so it can be undone. */
    const types = distinctTypes()
      .filter(v => counts.has(v) || v === typeFilter)
      .sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0));
    if (types.length && typeFilter !== "__all" && !types.includes(typeFilter)) typeFilter = "__all";
    typeBox.innerHTML = types.map(v => `<button type="button" data-v="${esc(v)}" aria-pressed="${v === typeFilter}">${esc(jobMethodLabel(v))}<span class="n">${fmtNum(counts.get(v) ?? 0)}</span></button>`).join("");

    const regionSel = document.getElementById(ids.region);
    if (!regionSel.dataset.bound) {
      regionSel.dataset.bound = "1";
      regionSel.addEventListener("change", () => {
        regionFilter = regionSel.value;
        localStorage.setItem("fjb_region_" + scope, regionFilter);
        render();
      });
    }
    if (rebuildSelect(regionSel, distinctRegions(), regionFilter, t("jobs_region_all"))) {
      regionFilter = regionSel.value;
    }

    const minEl = document.getElementById(ids.minIsk);
    const maxEl = document.getElementById(ids.maxIsk);
    if (!minEl.dataset.bound) {
      minEl.dataset.bound = "1";
      if (minIsk !== null) minEl.value = minIsk / 1e6;
      if (maxIsk !== null) maxEl.value = maxIsk / 1e6;
      const parse = v => (v.trim() === "" ? null : Number(v) * 1e6);
      const persist = (key, value) => {
        if (value === null) localStorage.removeItem(key);
        else localStorage.setItem(key, String(value));
      };
      minEl.addEventListener("change", () => {
        minIsk = parse(minEl.value);
        persist("fjb_min_" + scope, minIsk);
        render();
      });
      maxEl.addEventListener("change", () => {
        maxIsk = parse(maxEl.value);
        persist("fjb_max_" + scope, maxIsk);
        render();
      });
    }

    const homeEl = document.getElementById(ids.home);
    const homeList = document.getElementById(ids.homeList);
    const jumpsEl = document.getElementById(ids.maxJumps);
    if (!homeEl.dataset.bound) {
      homeEl.dataset.bound = "1";
      /* Scoped per board — New Eden and Exordium systems aren't the same set
         (see geo.js), so a home system saved on one board is meaningless,
         unresolvable noise on the other if shared under one key. */
      const homeKey = "fjb_home_name_" + scope;
      homeEl.value = localStorage.getItem(homeKey) || "";
      homeSystemId = geo.systemIdByName(homeEl.value);
      homeEl.addEventListener("input", () => {
        homeList.innerHTML = geo.searchSystems(homeEl.value)
          .map(e => `<option value="${esc(e.name)}"></option>`)
          .join("");
        const id = geo.systemIdByName(homeEl.value);
        if (id) {
          homeSystemId = id;
          localStorage.setItem(homeKey, homeEl.value);
          render();
        } else if (homeEl.value.trim() === "") {
          homeSystemId = null;
          localStorage.removeItem(homeKey);
          render();
        }
      });
      if (maxJumps !== null) jumpsEl.value = maxJumps;
      jumpsEl.addEventListener("change", () => {
        maxJumps = jumpsEl.value.trim() === "" ? null : Number(jumpsEl.value);
        if (maxJumps === null) localStorage.removeItem("fjb_maxjumps_" + scope);
        else localStorage.setItem("fjb_maxjumps_" + scope, String(maxJumps));
        render();
      });
    }

    const hideBadEl = document.getElementById(ids.hideBad);
    if (!hideBadEl.dataset.bound) {
      hideBadEl.dataset.bound = "1";
      hideBadEl.checked = hideBadDeals;
      hideBadEl.addEventListener("change", () => {
        hideBadDeals = hideBadEl.checked;
        localStorage.setItem("fjb_hidebad_" + scope, hideBadDeals ? "1" : "0");
        render();
      });
    }

    const resetEl = document.getElementById(ids.reset);
    if (!resetEl.dataset.bound) {
      resetEl.dataset.bound = "1";
      resetEl.addEventListener("click", resetFilters);
    }
  }

  /* "Reset filters" — clears everything that can hide jobs (type/region/
     payout range/hide-bad/home+distance), but leaves sort and reference
     market alone since those are display preferences, not filters, and
     resetting them on every "show me everything again" click would be
     surprising. */
  function resetFilters() {
    typeFilter = "__all";
    regionFilter = "__all";
    minIsk = null;
    maxIsk = null;
    hideBadDeals = false;
    homeSystemId = null;
    maxJumps = null;

    document.getElementById(ids.region).value = "__all";
    document.getElementById(ids.minIsk).value = "";
    document.getElementById(ids.maxIsk).value = "";
    document.getElementById(ids.hideBad).checked = false;
    document.getElementById(ids.home).value = "";
    document.getElementById(ids.maxJumps).value = "";
    for (const key of ["fjb_home_name_", "fjb_type_", "fjb_region_", "fjb_min_", "fjb_max_", "fjb_hidebad_", "fjb_maxjumps_"]) {
      localStorage.removeItem(key + scope);
    }

    render();
  }

  function progressNote() {
    if (detailsTotal > 0 && detailsDone < detailsTotal) {
      return t("enrich_details", { done: detailsDone, total: detailsTotal });
    }
    if (pricingTotal > 0 && pricingDone < pricingTotal) {
      return t("enrich_prices", { done: pricingDone, total: pricingTotal });
    }
    return "";
  }

  function render() {
    bindControlsOnce();

    const body = document.getElementById(ids.body);
    const visible = visibleJobs();

    const filterKey = [typeFilter, regionFilter, minIsk, maxIsk, homeSystemId, maxJumps, hideBadDeals, sortMode].join("|");
    if (filterKey !== lastFilterKey) {
      limit = PAGE;
      lastFilterKey = filterKey;
    }

    if (!hasLoaded) {
      body.innerHTML = Array.from({ length: 12 }, () => `<tr class="skeleton-row"><td></td><td></td><td></td><td></td><td></td><td></td></tr>`).join("");
    } else if (visible.length === 0) {
      body.innerHTML = `<tr><td colspan="6" class="empty">${t("jobs_none")}</td></tr>`;
    } else {
      /* Keep an open detail open across the re-renders that enrichment and
         auto refresh trigger. */
      const openId = body.querySelector("tr.open")?.dataset.id;
      body.innerHTML = visible.slice(0, limit)
        .map(j => `<tr class="job-row" data-id="${esc(j.id)}" tabindex="0">${rowCells(j)}</tr>`).join("");
      if (openId) {
        const row = body.querySelector(`tr[data-id="${CSS.escape(openId)}"]`);
        if (row) toggleDetail(row, row.dataset.id);
      }
    }
    if (!body.dataset.bound) {
      body.dataset.bound = "1";
      body.addEventListener("click", (e) => {
        const row = e.target.closest("tr.job-row");
        if (row) toggleDetail(row, row.dataset.id);
      });
      body.addEventListener("keydown", (e) => {
        const row = e.target.closest("tr.job-row");
        if (row && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          toggleDetail(row, row.dataset.id);
        }
      });
    }

    const more = document.getElementById(ids.more);
    const rest = visible.length - limit;
    more.classList.toggle("hidden", rest <= 0);
    more.textContent = t("jobs_more", { n: fmtNum(Math.min(PAGE, rest)) });
    if (!more.dataset.bound) {
      more.dataset.bound = "1";
      more.addEventListener("click", () => {
        limit += PAGE;
        render();
      });
    }

    const total = jobs.filter(belongsToThisPage).length;
    document.getElementById(ids.count).innerHTML = t("jobs_count", { shown: fmtNum(visible.length) })
      + (visible.length !== total ? ` <span class="of">${t("jobs_count_of", { total: fmtNum(total) })}</span>` : "");
    document.getElementById(ids.progress).textContent = progressNote();
  }

  return { load, render, prefetchDetails, prefetchPrices, stats, scopedIds, topPayouts, securityBreakdown, ladder, topCorps, toggleDetail };
}

const NewEdenJobsView = createJobsView("main", GeoMain, jobIds("main"));
const ExordiumJobsView = createJobsView("exordium", GeoExordium, jobIds("exordium"));
