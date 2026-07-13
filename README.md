# World Cup 2026 Portfolio Challenge — v3G.14 Leaderboard Accounting Hotfix

Focused leaderboard/accounting fix.

## Fix

- Leaderboard profit now reconciles directly to the scoring rubric:
  - `Profit = Points + Net Credits - 45`
- Net credits are calculated as:
  - `45 - fixed auction spend + net trade/manual credits`
- Auction spend is now treated as a fixed historical cost for the auction winner.
- Selling 100% of a country no longer removes that country's original auction cost from the seller's leaderboard accounting.
- This fixes cases where a participant's profit jumped too much after selling a country because the app both credited the trade proceeds and incorrectly released the old auction spend.

## Upload

Replace only:

- `src/main.jsx`
- `README.md`

Do not replace:

- `src/firebase.js`
- `src/styles.css`
- `src/matches.js`
- `api/espn-schedule.js`

## Notes

No scoring, trade approval, ESPN sync, or bracket logic changes are included in this patch.
