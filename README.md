# Stop the Vallejo Street Takeover

Advocacy landing page opposing SFPD's conversion of the lower half of Vallejo
Street into a police-only tow-away zone, plus a small API to collect public
comments.

## Layout
```
site/   Static front-end (HTML/CSS/vanilla JS) — the campaign page.
api/    Stub Express API to save comments/contacts to Postgres + Cloud Run config.
creds/  Credentials (gitignored).
```

## Front-end (`site/`)
Plain static site — no build step. Serve the folder with any static host:
```bash
cd site && python3 -m http.server 5173
```
Built from the high-fidelity design handoff: distressed protest-poster look
(Anton/Oswald/Barlow/Zilla Slab; red/black/yellow/navy). Includes the sticky
nav + mobile menu, marquee ticker, hero, alert band, "The Plan" cards, the
Sauter quote, an independent-row accordion, the comment form (localStorage,
with optional API POST), add-to-calendar `.ics`, and Web Share.

### Before publishing
- Replace `MEETING_LINK_HERE` in `site/index.html` with the real meeting URL.
- Point `CONFIG.apiBase` in `site/script.js` at the deployed API (optional).
- Confirm image rights (street photo is AI-generated; group photo is third-party).
- Replace the demo pledge counter seed (1284) with a real count.

## API (`api/`)
Express + Postgres (currently **stubbed** — see `api/README.md`). Containerized
for Cloud Run (`api/Dockerfile`, `api/deploy/`). Region `us-west1`.
