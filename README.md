# Football Calendar

A dependency-free, static HTML page that displays football schedules — currently
the **English Premier League 2026-27** and the archived **2026 FIFA World Cup**.
It runs entirely in the browser — no build step and no server required — and the
data layer supports adding more leagues or tournaments.

## Features

- **League picker** — switch between available leagues/tournaments; the choice
  is remembered.
- **Team filter** (Premier League) — show only matches involving selected teams.
  Defaults to all teams; the selection is persisted in a **cookie** per league.
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

Display preferences (view, timezone, theme, selected league, …) are persisted in
`localStorage`. The team selection is persisted in a cookie (`fc_teams_<league>`).

> Note: browsers may not persist cookies when the page is opened from `file://`.
> Everything still works there — the team selection just won't be remembered
> between visits. Serve the folder over HTTP (or use the GitHub Pages deployment)
> for full persistence.

## Running locally

Just open the page — no server needed:

```sh
open index.html        # macOS
# or double-click index.html in your file browser
```

> Schedules are embedded as classic scripts in `data/<slug>.js` (registering into
> `window.SCHEDULES`) specifically so the page works when opened directly from
> the file system.

## Refreshing fixtures

Schedules are fetched from [fixturedownload.com](https://fixturedownload.com) and
normalized into a reusable JSON schema. Requires **Node.js 18+** (for built-in `fetch`).

```sh
# English Premier League 2026-27
node scripts/fetch-schedule.mjs --slug epl-2026 --name "English Premier League 2026-27" --kind league

# FIFA World Cup 2026 (default: --kind worldcup, which maps knockout rounds)
node scripts/fetch-schedule.mjs
```

Each run generates two files in `data/`:

- `<slug>.json` — canonical, reusable data
- `<slug>.js` — the same data registered as `window.SCHEDULES['<slug>']` for the page

## Adding another league or tournament

1. Fetch its schedule (pass `--kind league` for a plain round-robin league):

   ```sh
   node scripts/fetch-schedule.mjs --slug epl-2027 --name "English Premier League 2027-28" --kind league
   ```

2. Register it in `data/index.js`:

   ```js
   window.LEAGUES = [
     { id: 'epl-2027', name: 'English Premier League 2027-28', default: true, teamFilter: true },
     { id: 'epl-2026', name: 'English Premier League 2026-27 (archived)', archived: true, teamFilter: true },
     { id: 'fifa-world-cup-2026', name: 'FIFA World Cup 2026 (archived)', archived: true },
   ];
   ```

3. Add a `<script src="data/<slug>.js"></script>` tag in `index.html`.

Registry flags: `default` marks the league shown on first visit, `archived` is
informational (older competitions kept for browsing), and `teamFilter` enables
the team selection dropdown.

The normalized schema for each match is:

```json
{
  "id": 1,
  "stage": "league",
  "round": "Matchday 1",
  "group": null,
  "kickoffUtc": "2026-08-21T19:00:00Z",
  "venue": "Emirates Stadium",
  "home": "Arsenal",
  "away": "Coventry"
}
```

> Note: the upstream feed may include speculative scores and knockout pairings. The
> fetch script drops scores and shows real fixtures only; undetermined knockout
> opponents appear as `TBD`.

## Project structure

```
football-calendar/
├── index.html                      # page markup + controls
├── styles.css                      # styling (light/dark themes, responsive)
├── app.js                          # all view logic (no dependencies)
├── data/
│   ├── index.js                    # league registry (window.LEAGUES)
│   ├── epl-2026.json               # canonical schedule data
│   ├── epl-2026.js                 # window.SCHEDULES['epl-2026']
│   ├── fifa-world-cup-2026.json    # canonical schedule data (archived)
│   └── fifa-world-cup-2026.js      # window.SCHEDULES['fifa-world-cup-2026']
└── scripts/
    └── fetch-schedule.mjs          # fetch + normalize a schedule
```

## Deployment

The site is static, so any static host works. It is published with **GitHub Pages**
from the repository root via the workflow in `.github/workflows/deploy.yml`.
