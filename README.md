# World Cup 2026 Portfolio Challenge — v3G.10 True Bracket Path Hotfix

Focused bracket-display hotfix after v3G.9.

## Fixes

- Stops the Bracket tab from ordering Round-of-32 games strictly by kickoff time.
- Uses the fixed ESPN knockout tree order so connector lines show the correct future matchups.
- Locks Round-of-32 slots to the Round-of-16 games they actually feed.
- If a later-round ESPN/Firebase record still contains placeholders or duplicate teams, the bracket card now derives its two displayed sides from the two feeder matches instead of showing misleading duplicates.
- Keeps the connected bracket layout, ownership wheels, participant colors, portfolio/ownership crash repair, and scoring logic unchanged.

## Upload these files

- `README.md`
- `src/main.jsx`
- `src/styles.css`

Do not replace `src/firebase.js`.
Do not replace `src/matches.js` unless you intentionally want to reset static fallback matches.
Do not replace `api/espn-schedule.js` for this hotfix.

After deploying, refresh the Bracket tab. You do not need to clear Firebase data.
