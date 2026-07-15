/* Freelance jobs board. Depends on config.js, i18n.js, esi.js, geo.js.

   createJobsView() is instantiated once per board (New Eden, Exordium) —
   both panels ship in every page (see index.html) and live in the DOM at
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
    body: p + "body"
  };
}

function createJobsView(scope, geo, ids) {
  let jobs = [];
  let typeFilter = "__all";
  let regionFilter = "__all";
  let sortMode = "payout_desc";
  let minIsk = null;
  let maxIsk = null;
  let homeSystemId = null;
  let maxJumps = null;
  let hideBadDeals = false;
  let market = availableMarkets(scope)[0];
  const detailCache = new Map();
  const priceMap = new Map(); // "marketKey:type_id" -> { buy }
  let detailsDone = 0;
  let detailsTotal = 0;
  let pricingDone = 0;
  let pricingTotal = 0;

  /* The public list endpoint has no cursor sort — pull every page up front
     (capped) so payout/progress sort is correct across the whole board, not
     just within one page. */
  async function load(onProgress) {
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
      onProgress?.(page, jobs.length);
      after = res.cursor?.after || null;
      if (!after || chunk.length === 0) return;
    }
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

  async function toggleDetail(row, jobId) {
    const existing = row.nextElementSibling;
    if (existing && existing.classList.contains("job-detail")) {
      existing.remove();
      return;
    }
    document.querySelectorAll(".job-detail").forEach(el => el.remove());

    const job = jobs.find(j => j.id === jobId);
    if (job && !job._detailLoaded) {
      try { await fetchDetail(job); } catch { /* row just shows what it has */ }
    }

    const creator = job?.creator;
    const creatorName = creator?.corporation?.name || creator?.character?.name;
    const locs = (job?.broadcastLocations || []).map(l => esc(l.name)).join(", ") || "—";
    const regionList = (job?.regions || []).join(", ") || "—";
    const verdict = valueVerdict(job);
    let verdictLine = "—";
    if (verdict === "pending") verdictLine = t("value_pending");
    else if (verdict === "unknown") verdictLine = t("value_unknown");
    else if (verdict && typeof verdict === "object") {
      const price = priceMap.get(`${market.key}:${job.priceableTypeId}`);
      verdictLine = `${fmtIsk(job.rewardPerContribution)} ISK ${t("value_vs_market", { market: market.name })} ${fmtIsk(price?.buy)} ISK (${Math.round(verdict.ratio * 100)}%)`;
    }

    const tr = document.createElement("tr");
    tr.className = "job-detail";
    tr.innerHTML = `
      <td colspan="6">
        <div class="detail-grid">
          <div><span class="dlabel">${t("job_career")}</span> ${esc(job?.career ?? "—")}</div>
          <div><span class="dlabel">${t("th_expires")}</span> ${fmtDate(job?.expires)}</div>
          <div><span class="dlabel">${t("job_creator")}</span> ${esc(creatorName ?? "—")}</div>
          <div><span class="dlabel">${t("job_reward_contrib")}</span> ${fmtIsk(job?.rewardPerContribution)} ISK</div>
          <div><span class="dlabel">${t("th_locations")}</span> ${locs}</div>
          <div><span class="dlabel">${t("th_region")}</span> ${regionList}</div>
          <div><span class="dlabel">${t("th_value")}</span> ${verdictLine}</div>
        </div>
        <p class="job-desc">${esc(job?.description) || t("job_desc_missing")}</p>
      </td>
    `;
    row.after(tr);
  }

  function distinctTypes() {
    return [...new Set(jobs.map(j => j.method).filter(Boolean))];
  }

  function distinctRegions() {
    return [...new Set(jobs.flatMap(j => scopedRegions(j)))].sort();
  }

  function visibleJobs() {
    let list = jobs.filter(belongsToThisPage);
    if (typeFilter !== "__all") list = list.filter(j => j.method === typeFilter);
    if (regionFilter !== "__all") list = list.filter(j => scopedRegions(j).includes(regionFilter));
    if (minIsk !== null) list = list.filter(j => (j.reward?.remaining ?? 0) >= minIsk);
    if (maxIsk !== null) list = list.filter(j => (j.reward?.remaining ?? 0) <= maxIsk);
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

    const sorted = list.slice();
    switch (sortMode) {
      case "payout_asc":
        sorted.sort((a, b) => (a.reward?.remaining ?? 0) - (b.reward?.remaining ?? 0));
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
        sorted.sort((a, b) => (b.reward?.remaining ?? 0) - (a.reward?.remaining ?? 0));
    }
    return sorted;
  }

  function progressRatio(j) {
    const des = j.progress?.desired ?? 0;
    return des > 0 ? (j.progress?.current ?? 0) / des : 0;
  }

  function rebuildSelect(sel, values, current, allLabel, labelFn) {
    const prev = sel.value || current;
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
    sel.value = values.includes(prev) || prev === "__all" ? prev : "__all";
  }

  function bindControlsOnce() {
    const sortSel = document.getElementById(ids.sort);
    if (sortSel.options.length === 0) {
      for (const s of ["payout_desc", "payout_asc", "progress_desc", "name_asc", "distance_asc", "expires_asc"]) {
        const opt = document.createElement("option");
        opt.value = s;
        opt.textContent = t("sort_" + s);
        sortSel.appendChild(opt);
      }
      sortSel.value = sortMode;
      sortSel.addEventListener("change", () => { sortMode = sortSel.value; render(); });
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

    const typeSel = document.getElementById(ids.type);
    if (!typeSel.dataset.bound) {
      typeSel.dataset.bound = "1";
      typeSel.addEventListener("change", () => { typeFilter = typeSel.value; render(); });
    }
    rebuildSelect(typeSel, distinctTypes(), typeFilter, t("jobs_type_all"), jobMethodLabel);
    typeFilter = typeSel.value;

    const regionSel = document.getElementById(ids.region);
    if (!regionSel.dataset.bound) {
      regionSel.dataset.bound = "1";
      regionSel.addEventListener("change", () => { regionFilter = regionSel.value; render(); });
    }
    rebuildSelect(regionSel, distinctRegions(), regionFilter, t("jobs_region_all"));
    regionFilter = regionSel.value;

    const minEl = document.getElementById(ids.minIsk);
    const maxEl = document.getElementById(ids.maxIsk);
    if (!minEl.dataset.bound) {
      minEl.dataset.bound = "1";
      const parse = v => (v.trim() === "" ? null : Number(v) * 1e6);
      minEl.addEventListener("change", () => { minIsk = parse(minEl.value); render(); });
      maxEl.addEventListener("change", () => { maxIsk = parse(maxEl.value); render(); });
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
      jumpsEl.addEventListener("change", () => {
        maxJumps = jumpsEl.value.trim() === "" ? null : Number(jumpsEl.value);
        render();
      });
    }

    const hideBadEl = document.getElementById(ids.hideBad);
    if (!hideBadEl.dataset.bound) {
      hideBadEl.dataset.bound = "1";
      hideBadEl.addEventListener("change", () => { hideBadDeals = hideBadEl.checked; render(); });
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

    document.getElementById(ids.type).value = "__all";
    document.getElementById(ids.region).value = "__all";
    document.getElementById(ids.minIsk).value = "";
    document.getElementById(ids.maxIsk).value = "";
    document.getElementById(ids.hideBad).checked = false;
    document.getElementById(ids.home).value = "";
    document.getElementById(ids.maxJumps).value = "";
    localStorage.removeItem("fjb_home_name_" + scope);

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
    body.innerHTML = "";

    const visible = visibleJobs();
    if (visible.length === 0) {
      body.innerHTML = `<tr><td colspan="6" class="status-pill">${t("jobs_none")}</td></tr>`;
    }

    for (const j of visible) {
      const cur = j.progress?.current ?? 0;
      const des = j.progress?.desired ?? 0;
      const pct = des > 0 ? Math.min(100, (cur / des) * 100) : 0;
      const loc = nearestLocation(j);
      const jRegions = scopedRegions(j);
      const locLabel = loc
        ? `${esc(loc.name)}${loc.jumps !== null && loc.jumps !== undefined ? ` · ${loc.jumps}J` : ""}${jRegions.length ? ` <span class="sub">(${esc(jRegions[0])})</span>` : ""}`
        : (j._detailLoaded ? "—" : "…");
      const verdict = valueVerdict(j);
      let verdictHtml = `<span class="status-pill dim">—</span>`;
      if (verdict === "pending") verdictHtml = `<span class="status-pill dim">…</span>`;
      else if (verdict === "unknown") verdictHtml = `<span class="status-pill dim">${t("value_unknown")}</span>`;
      else if (verdict && typeof verdict === "object") {
        const cls = verdict.flag === "bad" ? "hot" : verdict.flag === "good" ? "good" : "dim";
        verdictHtml = `<span class="status-pill ${cls}">${Math.round(verdict.ratio * 100)}%</span>`;
      }

      const tr = document.createElement("tr");
      tr.className = "job-row";
      tr.innerHTML = `
        <td>${esc(j.name || j.id)}<span class="sub">${j.method ? esc(jobMethodLabel(j.method)) : (j._detailLoaded ? "—" : "…")}</span></td>
        <td>${locLabel}</td>
        <td>
          <div class="vp-bar"><div class="fill" style="width:${pct.toFixed(1)}%;background:var(--caldari)"></div></div>
          <span class="mono sub">${fmtNum(cur)} / ${fmtNum(des)}</span>
        </td>
        <td class="mono">${fmtIsk(j.reward?.remaining)} ISK</td>
        <td>${verdictHtml}</td>
        <td><span class="status-pill${j.state === "Active" ? "" : " dim"}">${esc(j.state)}</span>${j.expires ? `<span class="sub">${t("expires_short", { date: fmtDate(j.expires) })}</span>` : ""}</td>
      `;
      tr.addEventListener("click", () => toggleDetail(tr, j.id));
      body.appendChild(tr);
    }

    document.getElementById(ids.count).textContent =
      t("jobs_count", { shown: fmtNum(visible.length), total: fmtNum(jobs.length) });
    document.getElementById(ids.progress).textContent = progressNote();
  }

  return { load, render, prefetchDetails, prefetchPrices };
}

const NewEdenJobsView = createJobsView("main", GeoMain, jobIds("main"));
const ExordiumJobsView = createJobsView("exordium", GeoExordium, jobIds("exordium"));
