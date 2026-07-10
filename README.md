# World Cup 2026 Portfolio Challenge — v3G.13 Trade Approval Scoring Deadlock Fix

Focused hotfix after v3G.12.

## Fix

- Allows commissioner/admin approval of already-accepted trades even if one of the involved countries is temporarily trading-suspended because final match scoring is pending.
- Keeps the trading suspension for new proposals and participant acceptance while scoring is pending.
- Fixes the circular lock where match scoring waits for an accepted trade to be resolved, but the accepted trade cannot be approved because match scoring is pending.
- Does not change scoring logic, profit logic, ESPN sync logic, or bracket logic.

## Upload these files

- `README.md`
- `src/main.jsx`

Do not replace `src/firebase.js`, `src/matches.js`, `api/espn-schedule.js`, or other files.

After deploying, go to Trading → Admin approval and approve or reject the accepted trade. Then return to Admin → Pending match scoring and run Try score now for the match.
