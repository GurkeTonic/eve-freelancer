/* UI strings and formatting helpers. Loaded after config.js, before app.js.

   One page per language: / is English, /de/ German (tools/build_pages.py).
   <html lang> picks the table. The block between the STRINGS markers is
   plain JSON on purpose: build_pages.py reads it and writes every
   data-i18n text into the static pages, so nothing shifts when the script
   runs and a page without JavaScript still reads right. */
"use strict";

const LANG = document.documentElement.lang === "de" ? "de" : "en";

const STRINGS = /*STRINGS*/{
  "en": {
    "skip": "Skip to content",
    "site_for": "Freelance jobs in EVE Online",
    "nav_label": "Pages",
    "nav_dashboard": "Overview",
    "nav_new_eden": "New Eden",
    "nav_exordium": "Exordium",
    "nav_faq": "FAQ",
    "nav_legal": "Legal & privacy",
    "lang_other": "Deutsch",
    "refresh": "Refresh",
    "ts_label": "Data from",
    "theme_light": "Light mode",
    "theme_dark": "Dark mode",
    "auto_refresh": "Auto refresh",
    "auto_refresh_title": "Load the latest data every 5 minutes",

    "ov_title": "Every open freelance job, by security status",
    "ov_lede": "One square is one job, placed by the system it is broadcast from. The best paid are listed below.",
    "ladder_label": "Open jobs by security status of their broadcast system",
    "g_hs": "Highsec",
    "g_ls": "Lowsec",
    "g_ns": "Nullsec",
    "g_wh": "Wormhole",
    "g_none": "No location",
    "ladder_bin": "{sec}: {n} jobs",
    "ladder_wh": "Wormhole space: {n} jobs",
    "ladder_none": "Not broadcast anywhere: {n} jobs",
    "deals_title": "Best paid right now",
    "deals_note": "Reward per contribution. Value compares it with the best buy order at the reference market; {pct} of the jobs with a market price pay less.",
    "deals_note_pending": "Reward per contribution. Value compares it with the best buy order at the reference market.",
    "corps_title": "Who is hiring",
    "boards_title": "Boards",
    "board_jobs": "{n} jobs",

    "filters": "Filters",
    "jobs_reset": "Reset filters",
    "jobs_filter_type": "Job type",
    "jobs_filter_region": "Region",
    "jobs_region_all": "All regions",
    "jobs_reward_range": "Reward per contribution, million ISK",
    "jobs_min": "Minimum reward, million ISK",
    "jobs_max": "Maximum reward, million ISK",
    "jobs_distance": "Distance",
    "jobs_home": "Home system",
    "jobs_home_placeholder": "Your home system",
    "jobs_max_jumps": "Max jumps",
    "jobs_value_check": "Value check",
    "jobs_market_label": "Reference market",
    "jobs_hide_bad": "Hide jobs that pay below market",
    "jobs_sort_label": "Sort",
    "sort_payout_desc": "Highest reward first",
    "sort_payout_asc": "Lowest reward first",
    "sort_value_desc": "Best value first",
    "sort_progress_desc": "Most progress first",
    "sort_name_asc": "Name, A to Z",
    "sort_distance_asc": "Nearest first",
    "sort_expires_asc": "Expiring soonest",
    "jobs_count": "{shown} jobs",
    "jobs_count_of": "of {total}",
    "jobs_more": "Show {n} more",
    "jobs_none": "No job matches these filters. Reset them to see every job on this board.",

    "th_job": "Job",
    "th_location": "Location",
    "th_locations": "Broadcast from",
    "th_reward": "Reward",
    "th_value": "Value",
    "th_progress": "Progress",
    "th_expires": "Expires",
    "job_career": "Career",
    "job_creator": "Posted by",
    "job_progress": "Progress",
    "job_desc_missing": "No description.",
    "loc_structure": "Player structure",
    "loc_structures": "{n} player structures",
    "loc_none": "Not broadcast: in-game it only shows on the corporation's Show Info",
    "loc_deliver": "Deliver to",
    "loc_delivery": "delivery point",
    "value_unknown": "No buy order at this market",
    "value_vs_market": "{reward} ISK against a {market} buy price of {price} ISK",
    "u_min": "min",
    "u_h": "h",
    "u_d": "d",
    "expired": "expired",
    "isk_k": "k",
    "isk_m": "M",
    "isk_b": "B",
    "enrich_details": "Loading job details, {done} of {total}",
    "enrich_prices": "Loading market prices, {done} of {total}",
    "enrich_aborted": "Market prices stopped loading. The job list is complete.",
    "err_prefix": "The job data did not load: ",
    "err_hint": "Reload the page in a few minutes.",
    "err_rate_limit": "Too many requests. Wait a moment, then reload.",

    "footer_source": "Data from CCP's public ESI interface (/freelance-jobs), fetched about every 15 minutes when the site is built. Your browser only talks to this site.",
    "footer_family": "Also from this workshop:",
    "legal_ccp1": "© CCP hf. All rights reserved. \"EVE\", \"EVE Online\", \"CCP\", and all related logos and images are trademarks or registered trademarks of CCP hf.",
    "legal_ccp2": "This material is used with limited permission of CCP Games. No official affiliation or endorsement by CCP Games is stated or implied."
  },
  "de": {
    "skip": "Zum Inhalt",
    "site_for": "Freelance-Aufträge in EVE Online",
    "nav_label": "Seiten",
    "nav_dashboard": "Übersicht",
    "nav_new_eden": "New Eden",
    "nav_exordium": "Exordium",
    "nav_faq": "Fragen",
    "nav_legal": "Rechtliches & Datenschutz",
    "lang_other": "English",
    "refresh": "Neu laden",
    "ts_label": "Stand",
    "theme_light": "Helle Ansicht",
    "theme_dark": "Dunkle Ansicht",
    "auto_refresh": "Automatisch neu laden",
    "auto_refresh_title": "Alle 5 Minuten den neuesten Stand laden",

    "ov_title": "Jeder offene Freelance-Auftrag, nach Sicherheitsstatus",
    "ov_lede": "Ein Kästchen ist ein Auftrag, einsortiert nach dem System, aus dem er ausgestrahlt wird. Die bestbezahlten stehen darunter.",
    "ladder_label": "Offene Aufträge nach Sicherheitsstatus ihres Ausstrahlungssystems",
    "g_hs": "Highsec",
    "g_ls": "Lowsec",
    "g_ns": "Nullsec",
    "g_wh": "Wurmloch",
    "g_none": "Ohne Ort",
    "ladder_bin": "{sec}: {n} Aufträge",
    "ladder_wh": "Wurmlochraum: {n} Aufträge",
    "ladder_none": "Nirgends ausgestrahlt: {n} Aufträge",
    "deals_title": "Gerade am besten bezahlt",
    "deals_note": "Belohnung je Beitrag. „Wert“ vergleicht sie mit der besten Kauforder am Referenzmarkt; {pct} der Aufträge mit Marktpreis zahlen weniger.",
    "deals_note_pending": "Belohnung je Beitrag. „Wert“ vergleicht sie mit der besten Kauforder am Referenzmarkt.",
    "corps_title": "Wer Aufträge vergibt",
    "boards_title": "Bretter",
    "board_jobs": "{n} Aufträge",

    "filters": "Filter",
    "jobs_reset": "Filter zurücksetzen",
    "jobs_filter_type": "Auftragsart",
    "jobs_filter_region": "Region",
    "jobs_region_all": "Alle Regionen",
    "jobs_reward_range": "Belohnung je Beitrag, Mio. ISK",
    "jobs_min": "Mindestbelohnung, Mio. ISK",
    "jobs_max": "Höchstbelohnung, Mio. ISK",
    "jobs_distance": "Entfernung",
    "jobs_home": "Heimatsystem",
    "jobs_home_placeholder": "Dein Heimatsystem",
    "jobs_max_jumps": "Höchstens Sprünge",
    "jobs_value_check": "Wertprüfung",
    "jobs_market_label": "Referenzmarkt",
    "jobs_hide_bad": "Aufträge unter Marktwert ausblenden",
    "jobs_sort_label": "Sortieren",
    "sort_payout_desc": "Höchste Belohnung zuerst",
    "sort_payout_asc": "Niedrigste Belohnung zuerst",
    "sort_value_desc": "Bester Wert zuerst",
    "sort_progress_desc": "Weitester Fortschritt zuerst",
    "sort_name_asc": "Name, A bis Z",
    "sort_distance_asc": "Nächste zuerst",
    "sort_expires_asc": "Läuft zuerst ab",
    "jobs_count": "{shown} Aufträge",
    "jobs_count_of": "von {total}",
    "jobs_more": "{n} weitere zeigen",
    "jobs_none": "Kein Auftrag passt zu diesen Filtern. Setze sie zurück, um alle Aufträge dieses Bretts zu sehen.",

    "th_job": "Auftrag",
    "th_location": "Ort",
    "th_locations": "Ausgestrahlt aus",
    "th_reward": "Belohnung",
    "th_value": "Wert",
    "th_progress": "Fortschritt",
    "th_expires": "Läuft ab",
    "job_career": "Karriere",
    "job_creator": "Vergeben von",
    "job_progress": "Fortschritt",
    "job_desc_missing": "Keine Beschreibung.",
    "loc_structure": "Spielerstruktur",
    "loc_structures": "{n} Spielerstrukturen",
    "loc_none": "Nicht ausgestrahlt: im Spiel nur über Show Info der Corporation zu finden",
    "loc_deliver": "Liefern an",
    "loc_delivery": "Lieferort",
    "value_unknown": "Keine Kauforder an diesem Markt",
    "value_vs_market": "{reward} ISK gegen eine Kauforder in {market} über {price} ISK",
    "u_min": "Min.",
    "u_h": "Std.",
    "u_d": "Tg.",
    "expired": "abgelaufen",
    "isk_k": "Tsd.",
    "isk_m": "Mio.",
    "isk_b": "Mrd.",
    "enrich_details": "Auftragsdetails laden, {done} von {total}",
    "enrich_prices": "Marktpreise laden, {done} von {total}",
    "enrich_aborted": "Die Marktpreise wurden nicht fertig geladen. Die Auftragsliste ist vollständig.",
    "err_prefix": "Die Auftragsdaten wurden nicht geladen: ",
    "err_hint": "Lade die Seite in ein paar Minuten neu.",
    "err_rate_limit": "Zu viele Anfragen. Warte kurz und lade dann neu.",

    "footer_source": "Daten aus CCPs öffentlicher ESI-Schnittstelle (/freelance-jobs), etwa alle 15 Minuten beim Bau der Seite abgerufen. Dein Browser spricht nur mit dieser Seite.",
    "footer_family": "Aus derselben Werkstatt:",
    "legal_ccp1": "© CCP hf. Alle Rechte vorbehalten. „EVE“, „EVE Online“, „CCP“ und alle zugehörigen Logos und Bilder sind Marken oder eingetragene Marken von CCP hf.",
    "legal_ccp2": "Dieses Material wird mit eingeschränkter Erlaubnis von CCP Games verwendet. Eine offizielle Verbindung zu CCP Games oder eine Billigung durch CCP Games besteht nicht."
  }
}/*END*/[LANG];

const LOCALE = LANG === "de" ? "de-DE" : "en-US";

function t(key, vars) {
  let s = STRINGS[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, v);
  return s;
}

function fmtNum(n) {
  return Number(n ?? 0).toLocaleString(LOCALE);
}

/* "84%" in English, "84 %" in German (DIN 5008). */
function fmtPct(ratio) {
  return Math.round(ratio * 100).toLocaleString(LOCALE) + (LANG === "de" ? " %" : "%");
}

function fmtIsk(n) {
  const v = Number(n ?? 0);
  const abs = Math.abs(v);
  const f = (x, d) => x.toLocaleString(LOCALE, { maximumFractionDigits: d });
  if (abs >= 1e9) return f(v / 1e9, 2) + " " + t("isk_b");
  if (abs >= 1e6) return f(v / 1e6, 2) + " " + t("isk_m");
  if (abs >= 1e3) return f(v / 1e3, 1) + " " + t("isk_k");
  return f(v, 0);
}

/* "3 d", "5 h", "40 min": the expiry column is read as a countdown, not as
   a date. The full date sits in the title. */
function fmtLeft(iso) {
  if (!iso) return "—";
  const ms = Date.parse(iso) - Date.now();
  if (ms <= 0) return t("expired");
  const h = ms / 3.6e6;
  if (h < 1) return `${Math.max(1, Math.round(ms / 6e4))} ${t("u_min")}`;
  if (h < 48) return `${Math.round(h)} ${t("u_h")}`;
  return `${Math.round(h / 24)} ${t("u_d")}`;
}

function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(LANG === "de" ? "de-DE" : "en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }) + " UTC";
}

function fmtTime(date) {
  return date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" }) + " UTC";
}

/* Job texts are written in the game client and keep its markup: <font
   size=… color=…>, <a href="joinChannel:…">, <br>. Only the words are kept.
   The result still goes through esc() before it reaches the page. */
function eveText(value) {
  return String(value ?? "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"").replace(/&#39;/g, "'").replace(/&amp;/g, "&")
    .replace(/[ \t]+\n/g, "\n").trim();
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
  document.querySelectorAll("[data-i18n-aria]").forEach(el => {
    el.setAttribute("aria-label", t(el.dataset.i18nAria));
  });
}
