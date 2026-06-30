# World Cup 2026 Portfolio Challenge — v3G.12 True Bracket Feeder Path Fix

Focused recovery patch for the Bracket tab.

## Fixes

- Stops later-round cards from showing the same matchup in multiple places, such as Canada/Morocco appearing twice.
- Makes later-round bracket cards derive their displayed participants from the two feeder matches connected by the bracket lines.
- Keeps actual match metadata from ESPN/Firebase where available: date, time, venue, status, scores, and final result state.
- Keeps Round-of-32 cards visible and ordered in the connected bracket tree.
- Keeps the Portfolio/Ownership crash fix from v3G.9+.
- Keeps ownership wheels and participant colors.
- Does not change scoring logic, trade logic, profit logic, Firebase config, or ESPN API sync.

## Upload these files

- `README.md`
- `src/main.jsx`
- `src/styles.css`

Do not replace:

- `src/firebase.js`
- `src/matches.js`
- `api/espn-schedule.js`

After deploying, check the Bracket tab. A match in a later round should show the winners/placeholder winners from the two connected feeder games, not whichever matchup happens to be first by kickoff time.
