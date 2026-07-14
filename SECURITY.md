# Security Policy

This is a small, static, client-side-only site — no backend, no accounts, no
stored credentials. The realistic attack surface is limited to the client JS
(XSS, dependency/supply-chain risk) and the static hosting itself.

## Reporting a vulnerability

Please report security issues privately to
[webmaster@tonicbeacon.com](mailto:webmaster@tonicbeacon.com) rather than
opening a public GitHub issue, so there's time to fix before disclosure.
Include what you found and, if possible, steps to reproduce. Expect a reply
within a few days — this is a hobby project maintained by one person.

## Scope

In scope: this repository's own code (`js/`, `css/`, `*.html`).

Out of scope: CCP's ESI API itself (report to CCP via
[esi-issues](https://github.com/esi/esi-issues) or their own security
process), and GitHub Pages hosting infrastructure (report to GitHub).
