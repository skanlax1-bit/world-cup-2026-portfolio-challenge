# World Cup 2026 Portfolio Challenge — v3G.7 Bracket Placeholder/Team Mapping Hotfix

Focused hotfix after v3G.6.

## Fixes

- Prevents ESPN knockout placeholder seed codes from appearing as team-mapping warnings.
- Adds explicit fallback labels for known ESPN knockout bracket match slots.
- Fixes cases where ESPN sends duplicate teams into a bracket slot, such as Brazil/Brazil, Germany/Germany, Morocco/Morocco, or Ivory Coast/Ivory Coast.
- Keeps the v3G.6 connected bracket layout, card spacing, ownership popovers, and unique participant colors.
- Does not change scoring logic, trade logic, or profit logic.

## Upload these files

- `README.md`
- `src/main.jsx`
- `src/styles.css`
- `src/matches.js`
- `api/espn-schedule.js`

Do not replace `src/firebase.js`.

After deploying, run **Refresh ESPN Match Data** once from the Matches tab so Firebase overwrites any duplicate/bad bracket records stored from the prior version.
