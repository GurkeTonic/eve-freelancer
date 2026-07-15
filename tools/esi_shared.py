"""Single source of truth for everything CCP requires identical on every
ESI request: contact identification and the compatibility date.

Used by tools/update_sde.py (the SDE-release fetch) and by
tools/sync_config.py, which writes the same three values into js/config.js
for the browser-side client (js/esi.js) — so there is exactly one place to
edit when the contact address, app version, or compatibility date changes.
"""

APP_NAME = "FreelanceJobsBoard"
APP_VERSION = "0.1"
CONTACT_EMAIL = "webmaster@tonicbeacon.com"
REPO_URL = "https://github.com/GurkeTonic/Freelance-Jobs-Board"

USER_AGENT = f"{APP_NAME}/{APP_VERSION} ({CONTACT_EMAIL}; +{REPO_URL})"

ESI_BASE = "https://esi.evetech.net"
COMPAT_DATE = "2026-06-09"
