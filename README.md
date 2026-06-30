# World Cup 2026 Portfolio Challenge — v3G.11 Bracket Recovery + Safe Path Ordering

Focused recovery patch after v3G.10 made the Bracket tab show empty TBD slots.

## Fixes

- Restores the Bracket tab from the last working source that included Portfolio and Ownership components.
- Keeps the Portfolio/Ownership crash hotfix.
- Prevents the bracket from going blank when ESPN/Firebase match ids do not match the strict bracket-slot map.
- Uses safe fallback matching by actual teams and placeholders so real knockout matches remain visible.
- Nudges Round-of-32 games toward ESPN-style connected bracket order instead of pure kickoff-time order when possible.
- Keeps ownership wheels and unique colors.
- Does not change scoring, trades, profit, Firebase config, ESPN API code, or match refresh logic.

## Upload these files

- `README.md`
- `src/main.jsx`
- `src/styles.css`

Do not replace:

- `src/firebase.js`
- `src/matches.js`
- `api/espn-schedule.js`

After deploying, check the Bracket tab first. You can then run **Refresh ESPN Match Data** once from the Matches tab.
