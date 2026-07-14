/* Global configuration. Loaded first. */
"use strict";

const CONFIG = {
  ESI_BASE: "https://esi.evetech.net",
  COMPAT_DATE: "2026-06-09",
  /* Sent as X-User-Agent on every ESI request (browsers drop User-Agent
     on fetch) — see developers.eveonline.com/docs/services/esi/best-practices */
  USER_AGENT: "FreelanceJobsBoard/0.1 (webmaster@tonicbeacon.com; +https://github.com/GurkeTonic/Freelance-Jobs-Board)",
  /* ESI enforces 10 <= limit <= 100 on this endpoint. */
  JOBS_PAGE_LIMIT: 100,
  /* Safety cap on pages fetched per full load, so a runaway board can't hammer ESI forever. */
  JOBS_MAX_PAGES: 40,
  /* Parallel /freelance-jobs/{id} detail fetches (job type, expiry, broadcast locations). */
  DETAIL_CONCURRENCY: 6,
  /* Parallel order-book fetches for the payout-vs-market check. */
  MARKET_CONCURRENCY: 4,
  AUTO_REFRESH_MS: 5 * 60 * 1000
};

/*
 * Selectable reference markets for the payout-vs-market check, one buy-order
 * lookup per job. All station/region IDs verified live against ESI
 * (/universe/stations, /universe/systems, /universe/constellations).
 *
 * "main" = the traditional big-4 empire trade hubs. "exordium" = the one
 * hub CCP's devblog names for the new rookie region: Manifest's AIR
 * Laboratories Trade Center (system Manifest, region Exordium).
 */
const MARKETS = {
  main: [
    { key: "jita",    name: "Jita (The Forge)",       regionId: 10000002, stationId: 60003760 },
    { key: "amarr",   name: "Amarr (Domain)",         regionId: 10000043, stationId: 60008494 },
    { key: "dodixie", name: "Dodixie (Sinq Laison)",  regionId: 10000032, stationId: 60011866 },
    { key: "rens",    name: "Rens (Heimatar)",        regionId: 10000030, stationId: 60004588 }
  ],
  exordium: [
    { key: "manifest", name: "Manifest (AIR Trade Center)", regionId: 10001004, stationId: 60015249 }
  ]
};

function availableMarkets() {
  const scope = typeof PAGE_SCOPE !== "undefined" ? PAGE_SCOPE : "main";
  return MARKETS[scope] || MARKETS.main;
}

/*
 * The 10 Freelance Job methods, from the SDE's freelanceJobSchemas.jsonl
 * (build 3430261). Own short labels — the SDE only carries full sentences.
 */
const JOB_METHODS = {
  DeliverItem:      "Item delivery",
  MineOre:          "Ore mining",
  KillNPC:          "NPC kills",
  KillCapsuleer:    "Capsuleer kills",
  DamageShip:       "Ship damage",
  RepairArmor:      "Armor repair",
  BoostShield:      "Shield boost",
  ShipInsurance:    "Ship insurance",
  CaptureFWComplex: "Capture FW complex",
  DefendFWComplex:  "Defend FW complex"
};

function jobMethodLabel(method) {
  return JOB_METHODS[method] ?? method ?? "?";
}
