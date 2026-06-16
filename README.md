# World Cup 2026 Portfolio Challenge — v3F Visual Polish + Tournament UX Cleanup

This update builds on v3E.2 and keeps the live ESPN scoring/repair framework intact.

## Included

- Matches page scorecards with Today / Upcoming / Completed sections.
- Public ESPN refresh remains on the Matches tab with cooldown and last synced by display.
- Leaderboard stays as a table and receives visual polish: rank pill, leader badge, green/red profit styling.
- New public Scoring Log page for the scoring ledger/audit trail.
- Welcome page becomes a Home dashboard with current leader, live match, next match, last scoring event, last ESPN sync, and admin action count.
- Portfolio holdings become asset-style cards.
- Trade log cleanup: most recent 5 completed trades and most recent 5 rejected/canceled trades by default, with Show all / Show less toggles.
- One-way credit validation in trades: credits cannot be sent by both sides in the same trade.
- Light blue visual polish/status badges.

## Upload/update these files

- `src/main.jsx`
- `src/styles.css`
- `src/matches.js`
- `api/espn-schedule.js`
- `README.md`

## Important

Do not replace your live `src/firebase.js`. Keep the Firebase file currently connected to your production database.

## Post-deploy checks

1. Site loads normally.
2. Home dashboard loads and displays the current leader/live match/next match.
3. Matches tab shows scorecards and Today / Upcoming / Completed sections.
4. ESPN refresh still works and does not duplicate points.
5. Leaderboard remains a table and points/profit still match the prior version.
6. Scoring Log shows existing scoring events.
7. Trade log shows only recent 5 completed/rejected by default and can expand.
8. New trade proposals cannot include credits sent by both sides.
