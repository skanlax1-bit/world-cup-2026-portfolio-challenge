# World Cup 2026 Portfolio Challenge — v3F.2 Profit Formula + Commissioner Trade Tools

This patch builds on v3F.1 and keeps the live scoring engine unchanged.

## Included changes

- Profit formula updated across the Home page and Leaderboard:
  - `Profit = Points Earned + Remaining Credits - 45`
  - Credits are treated like cash, so unused credits retain value and circular credit transfers cannot create fake profit.
- Federico display name override:
  - Existing participant displayed as `TJ Baller` anywhere the app derives participant names.
- Trade validation tightened:
  - credit-only trades are blocked.
  - credits can only move one way in a normal trade.
  - each side must still send something in the trade.
- Commissioner force trade execution tool added in Admin:
  - can force approve/execute a pending, proposed, or accepted trade if normal workflow gets stuck.
  - still enforces ownership, available credits, one-way credits, no credit-only trades, and locked-country restrictions.

## Install notes

Upload/update:

- `src/main.jsx`
- `src/styles.css`
- `src/matches.js`
- `api/espn-schedule.js`
- `README.md`

Do not replace your live `src/firebase.js` file.
