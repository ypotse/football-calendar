# Football Calendar — FIFA World Cup 2026 Schedule

A dependency-free, static HTML page that displays the **2026 FIFA World Cup** match
schedule. It runs entirely in the browser — no build step and no server required —
and the data layer is designed to be reused for other tournaments or leagues.

## Features

- **List view** grouped by day, and a **month calendar view**.
- **Timezone selector** — defaults to your browser timezone; all kickoff times are
  converted live.
- **12 / 24-hour** time toggle.
- **Late-night on previous day** — shows matches kicking off between 00:00–03:59 on
  the previous day as `24:00`–`27:59` (handy for following late games).
- **Upcoming only** (default ON) — hides matches that have already kicked off, in both
  the list and calendar views.
- **Light / dark theme** — follows your OS preference, and remembers your choice.
- **Responsive** — works on mobile; the calendar scrolls horizontally to stay legible.

All preferences are persisted in `localStorage`.

## Running locally

Just open the page — no server needed:

```sh
open index.html        # macOS
# or double-click index.html in your file browser
```

> The schedule is embedded in `data/fifa-world-cup-2026.js` (a `window.TOURNAMENT_DATA`
> global) specifically so the page works when opened directly from the file system.

## Refreshing the World Cup 2026 fixtures

The schedule is fetched from [fixturedownload.com](https://fixturedownload.com) and
normalized into a reusable JSON schema. Requires **Node.js 18+** (for built-in `fetch`).

```sh
node scripts/fetch-schedule.mjs
```

This regenerates two files in `data/`:

- `fifa-world-cup-2026.json` — canonical, reusable data
- `fifa-world-cup-2026.js` — the same data wrapped as `window.TOURNAMENT_DATA` for the page

## Reusing for another tournament

`fixturedownload.com` exposes many competitions. Pass a different slug and display name:

```sh
node scripts/fetch-schedule.mjs --slug fifa-world-cup-2022 --name "FIFA World Cup 2022"
```

Then point the page at the generated data file by editing the `<script src="...">` tag
in `index.html`.

The normalized schema for each match is:

```json
{
  "id": 1,
  "stage": "group",
  "round": "Matchday 1",
  "group": "Group A",
  "kickoffUtc": "2026-06-11T19:00:00Z",
  "venue": "Mexico City Stadium",
  "home": "Mexico",
  "away": "South Africa"
}
```

> Note: the upstream feed may include speculative scores and knockout pairings. The
> fetch script drops scores and shows real fixtures only; undetermined knockout
> opponents appear as `TBD`.

## Project structure

```
football-calendar/
├── index.html                 # page markup + controls
├── styles.css                 # styling (light/dark themes, responsive)
├── app.js                     # all view logic (no dependencies)
├── data/
│   ├── fifa-world-cup-2026.json   # canonical schedule data
│   └── fifa-world-cup-2026.js     # generated window.TOURNAMENT_DATA global
└── scripts/
    └── fetch-schedule.mjs     # fetch + normalize the schedule
```

## Deployment

The site is static, so any static host works. It is published with **GitHub Pages**
from the repository root via the workflow in `.github/workflows/deploy.yml`.
