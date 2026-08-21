// League registry — hand-maintained. Each entry must have a matching
// window.SCHEDULES[<id>] loaded from data/<id>.js.
//
// Fields:
//   id         — data slug (matches the file name and SCHEDULES key)
//   name       — display name in the league picker
//   default    — shown on first visit when no league preference is saved
//   archived   — rendered as non-default; kept for historical browsing
//   teamFilter — show the team selection dropdown (matches filtered by
//                selected home/away teams); selection persisted in a cookie
window.LEAGUES = [
  {
    id: 'epl-2026',
    name: 'English Premier League 2026-27',
    default: true,
    teamFilter: true,
  },
  {
    id: 'fifa-world-cup-2026',
    name: 'FIFA World Cup 2026 (archived)',
    archived: true,
  },
];
