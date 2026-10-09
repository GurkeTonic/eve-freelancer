/* Global configuration. Loaded first. */
"use strict";

const CONFIG = {
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

function availableMarkets(scope) {
  return MARKETS[scope] || MARKETS.main;
}

/*
 * The 10 Freelance Job methods with the titles the game client shows, from
 * the SDE's freelanceJobSchemas.jsonl (build 3586130), English and German.
 */
const JOB_METHODS = {
  DeliverItem:      { en: "Deliver", de: "Liefern" },
  MineOre:          { en: "Mine Materials", de: "Materialien abbauen" },
  KillNPC:          { en: "Destroy Non-Capsuleers", de: "Nicht-Kapselpiloten zerstören" },
  KillCapsuleer:    { en: "Destroy Capsuleer’s Ship", de: "Kapselpilotenschiff zerstören" },
  DamageShip:       { en: "Damage Capsuleers", de: "Kapselpiloten beschädigen" },
  RepairArmor:      { en: "Remote Repair Armor", de: "Fernreparatur von Panzerung" },
  BoostShield:      { en: "Remote Boost Shield", de: "Schildfernboost" },
  ShipInsurance:    { en: "Ship Insurance", de: "Versicherung für Schiffe" },
  CaptureFWComplex: { en: "Capture Factional Warfare Complexes", de: "Fraktionskrieg-Komplexe einnehmen" },
  DefendFWComplex:  { en: "Defend Factional Warfare Complexes", de: "Fraktionskrieg-Komplexe verteidigen" }
};

function jobMethodLabel(method) {
  return JOB_METHODS[method]?.[LANG] ?? method ?? "?";
}
