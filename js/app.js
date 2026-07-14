/* Application bootstrap. Loaded last. Single-view site — no tabs. */
"use strict";

const App = (() => {
  const $ = (id) => document.getElementById(id);
  let autoTimer = null;
  let loaded = false;
  let lastUpdated = null;

  function renderTimestamp() {
    if (!lastUpdated) return;
    $("timestamp").textContent = t("ts_label") + " " + lastUpdated.toLocaleTimeString("en-US");
  }

  function setStatus(state, message = "") {
    $("loading").classList.toggle("hidden", state !== "loading");
    $("error").classList.toggle("hidden", state !== "error");
    if (state === "loading" && message) $("loading").textContent = message;
    if (state === "error") $("error").textContent = message;
  }

  function reportError(err) {
    const hint = err && err.rateLimited ? t("err_rate_limit") : t("err_hint");
    setStatus("error", t("err_prefix") + (err?.message ?? err) + " — " + hint);
  }

  /* Background enrichment (per-job detail, then Jita prices) — runs after the
     base list is already on screen, so it never blocks the initial render.
     A rate limit here just stops enrichment early; the base board stays usable. */
  async function enrich() {
    try {
      await JobsView.prefetchDetails((done, total) => {
        if (done % 10 === 0 || done === total) JobsView.render();
      });
      JobsView.render();
      await JobsView.prefetchPrices((done, total) => {
        if (done % 5 === 0 || done === total) JobsView.render();
      });
      JobsView.render();
    } catch (err) {
      JobsView.render();
      $("jobs-progress").textContent = t("enrich_aborted");
      if (!err.rateLimited) reportError(err);
    }
  }

  async function run(force = false) {
    if (loaded && !force) return;
    setStatus("loading", t("loading"));
    try {
      await JobsView.load((page, count) => {
        setStatus("loading", t("loading_page", { n: page, count: fmtNum(count) }));
      });
      loaded = true;
      JobsView.render();
      lastUpdated = new Date();
      renderTimestamp();
      setStatus("idle");
      enrich();
    } catch (err) {
      reportError(err);
    }
  }

  function setAutoRefresh(on) {
    localStorage.setItem("fjb_auto_refresh", on ? "1" : "0");
    $("auto-refresh").classList.toggle("active-mode", on);
    if (autoTimer) clearInterval(autoTimer);
    autoTimer = on ? setInterval(() => run(true), CONFIG.AUTO_REFRESH_MS) : null;
  }

  function init() {
    $("refresh").addEventListener("click", () => run(true));
    $("auto-refresh").addEventListener("click", () => setAutoRefresh(!autoTimer));
    setAutoRefresh(localStorage.getItem("fjb_auto_refresh") === "1");

    applyI18n();
    run();
  }

  return { init, reportError };
})();

document.addEventListener("DOMContentLoaded", App.init);
