/* Soft navigation between boards. Every page already ships the full app and
   every panel (see src/page.html) — switching boards never needs a real
   navigation, just App.runTab() plus a history entry and updated
   title/canonical/description. Falls back to a real link for anything it
   doesn't own: external links, modified clicks, JS disabled, links whose
   path isn't in ROUTES (e.g. /legal/). Listens on the whole document, not
   just <nav>, so links elsewhere on the page (the dashboard's per-board
   tiles) get soft navigation too. Depends on routes.js, app.js (must load
   after both). */
"use strict";

const Router = (() => {
  const canonicalEl = document.querySelector('link[rel="canonical"]');
  const descriptionEl = document.querySelector('meta[name="description"]');

  function routeFor(pathname) {
    return ROUTES[pathname] || ROUTES[LANG === "de" ? "/de/" : "/"];
  }

  function applyRoute(route) {
    document.title = route.title;
    canonicalEl.href = route.canonical;
    descriptionEl.content = route.description;
    document.body.dataset.tab = route.tab;
    /* The language link and the hreflang alternates follow the board. */
    const other = document.getElementById("lang-other");
    if (other) other.href = route.alt;
    const enUrl = LANG === "en" ? route.canonical : route.altCanonical;
    const deUrl = LANG === "de" ? route.canonical : route.altCanonical;
    document.querySelectorAll('link[rel="alternate"][hreflang]').forEach(l => {
      l.href = l.hreflang === "de" ? deUrl : enUrl; // en and x-default
    });
    App.runTab(route.tab); // also updates nav .active state (showPanel)
  }

  function onNavClick(e) {
    if (e.defaultPrevented || e.button !== 0) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest("a");
    if (!a) return;

    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin) return;
    const route = ROUTES[url.pathname];
    /* A switch of language is a real navigation: the strings are the page's. */
    if (!route || route.lang !== LANG) return;

    e.preventDefault();
    if (url.pathname === location.pathname) return;
    history.pushState({ path: url.pathname }, "", url.pathname);
    applyRoute(route);
  }

  function onPopState() {
    applyRoute(routeFor(location.pathname));
  }

  function init() {
    document.addEventListener("click", onNavClick);
    window.addEventListener("popstate", onPopState);
    history.replaceState({ path: location.pathname }, "", location.pathname);
  }

  return { init };
})();

document.addEventListener("DOMContentLoaded", Router.init);
