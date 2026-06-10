# World Cup 2026 Portfolio Challenge — v3D Post-Draft Cleanup + ESPN Schedule Sync

This package builds on the v3C Access + Welcome + Trading version.

## Included in v3D

- Leaderboard excludes the `admin` commissioner account.
- Leaderboard columns are reordered to:
  1. Profit
  2. Points
  3. Net Spent
  4. Auction Spend
  5. Trade Credits
  6. Remaining
  7. Holdings
- Existing number formatting is preserved:
  - whole numbers display as whole numbers
  - fractional points/profit display to two decimals
- Country Ownership page added.
- Admin country sale correction tool added.
- Admin trading Open/Closed setting added.
- Trading tab respects the Open/Closed setting.
- ESPN schedule sync phase 1 added:
  - Admin button: Sync ESPN Schedule
  - Vercel API function: `api/espn-schedule.js`
  - Imported schedule saves to Firebase under `matches`
  - Sync metadata saves to Firebase under `syncMeta`
  - Matches page uses ESPN-synced schedule if available, otherwise falls back to the seeded schedule

## What ESPN sync does NOT do yet

This update does not award points, change standings, or auto-score matches.

The ESPN sync is schedule-only/admin-review-only. Scoring automation should come after imported match data is verified.

## Important install notes

Do not replace your working `src/firebase.js` file. Keep the Firebase config file you already fixed.

Upload/update these files in GitHub:

- `src/main.jsx`
- `src/styles.css`
- `src/matches.js`
- `api/espn-schedule.js`
- `README.md`

Do not upload:

- `node_modules`
- a broken/placeholder `src/firebase.js`

## Local testing note

The ESPN sync button depends on the Vercel serverless API route at `/api/espn-schedule`. Depending on your local setup, that route may only work after deployment to Vercel. If local testing shows an ESPN sync error but the rest of the app works, deploy the `api` folder and test the sync on the live Vercel URL.

## Data safety

This update is designed to be additive/backward-compatible. It does not require clearing Firebase, resetting the auction schedule, or changing existing participants/auction records.
