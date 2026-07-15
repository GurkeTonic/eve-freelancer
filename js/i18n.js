/* UI strings and formatting helpers. Loaded before app.js. */
"use strict";

const STRINGS = {
  site_title: "Freelance Jobs Board",
  subtitle: "Public jobs board for EVE Online — sortable and filterable, New Eden and Exordium",
  nav_new_eden: "New Eden",
  nav_exordium: "Exordium",
  nav_faq: "FAQ",
  nav_legal: "Legal",
  refresh: "Refresh",
  err_prefix: "ESI request failed: ",
  err_hint: "Check your internet connection or the ESI status at esi.evetech.net.",
  err_rate_limit: "ESI rate limit reached. Wait a moment, then try again.",
  auto_refresh: "Auto refresh",
  auto_refresh_title: "Reload every 5 minutes",
  ts_label: "As of",
  jobs_filter_type: "Type",
  jobs_type_all: "All types",
  jobs_filter_region: "Region",
  jobs_region_all: "All regions",
  jobs_market_label: "Reference market",
  jobs_sort_label: "Sort",
  jobs_min_isk: "Min (M ISK)",
  jobs_max_isk: "Max (M ISK)",
  jobs_home_label: "Home system",
  jobs_home_placeholder: "Type a system ...",
  jobs_max_jumps: "Max jumps",
  sort_payout_desc: "Reward (high → low)",
  sort_payout_asc: "Reward (low → high)",
  sort_progress_desc: "Progress (high → low)",
  sort_name_asc: "Name (A–Z)",
  sort_distance_asc: "Distance (near → far)",
  sort_expires_asc: "Expiring soonest",
  jobs_hide_bad: "Hide jobs below market value",
  jobs_reset: "Reset filters",
  expires_short: "expires {date}",
  jobs_count: "{shown} of {total} jobs",
  jobs_none: "No jobs found.",
  th_job: "Job",
  th_location: "Location",
  th_locations: "Broadcast locations",
  th_region: "Region(s)",
  th_progress: "Progress",
  th_reward_rem: "Reward (remaining)",
  th_value: "Value vs. market",
  th_expires: "Expires",
  th_state: "State",
  job_career: "Career",
  job_creator: "Creator",
  job_reward_contrib: "Reward per contribution",
  job_desc_missing: "No description.",
  value_pending: "loading ...",
  value_unknown: "no market price",
  value_vs_market: "vs. {market} buy price",
  enrich_details: "Loading job details ... {done}/{total}",
  enrich_prices: "Loading market prices ... {done}/{total}",
  enrich_aborted: "ESI rate limit — enrichment (type/region/value) stopped, base data stays complete.",
  footer_source: "Data source: EVE Swagger Interface (ESI), public endpoints only (/freelance-jobs). Fetched client-side in the browser, no backend, no tracking.",
  footer_origin: "Split out from",
  footer_family: "From the same workshop:",
  legal_ccp1: "© CCP hf. All rights reserved. \"EVE\", \"EVE Online\", \"CCP\", and all related logos and images are trademarks or registered trademarks of CCP hf.",
  legal_ccp2: "This material is used with limited permission of CCP Games. No official affiliation or endorsement by CCP Games is stated or implied."
};

function t(key, vars) {
  let s = STRINGS[key] || key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, v);
  return s;
}

function fmtNum(n) {
  return Number(n ?? 0).toLocaleString("en-US");
}

function fmtIsk(n) {
  const v = Number(n ?? 0);
  const abs = Math.abs(v);
  if (abs >= 1e9) return (v / 1e9).toLocaleString("en-US", { maximumFractionDigits: 2 }) + " B";
  if (abs >= 1e6) return (v / 1e6).toLocaleString("en-US", { maximumFractionDigits: 2 }) + " M";
  if (abs >= 1e3) return (v / 1e3).toLocaleString("en-US", { maximumFractionDigits: 1 }) + " k";
  return v.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US");
}

/* Escape untrusted strings (player-authored names, descriptions) for innerHTML. */
function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"
  }[ch]));
}

function applyI18n() {
  document.querySelectorAll("[data-i18n]").forEach(el => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-title]").forEach(el => {
    el.title = t(el.dataset.i18nTitle);
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
}
