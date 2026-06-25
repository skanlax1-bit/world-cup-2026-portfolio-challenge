# World Cup 2026 Portfolio Challenge — v3G.5 Bracket Card + Popover Hotfix

This package keeps the connected bracket from v3G.3 and fixes the ownership wheel color issue.

## v3G.5 updates

- Ownership wheels now use a stronger deterministic participant color system.
- Each participant gets one stable color across bracket wheels and popovers.
- Color lookup now supports participant id, stored name, canonical display name, lowercase aliases, and slug-safe aliases.
- Unknown/fallback participant keys now use a deterministic hash instead of the previous length-based fallback that could repeat colors.
- Preserves the v3G.2 bracket date/stage fixes and v3G.3 connected bracket layout.

## Upload these files

- `README.md`
- `src/main.jsx`
- `src/styles.css`
- `src/matches.js`
- `api/espn-schedule.js`

Do not replace `src/firebase.js`.


## v3G.5 fixes
- Increased connected bracket card height so time/venue/progression details stay inside each scorecard.
- Elevated active ownership wheel popovers above neighboring bracket matches.
- Preserved v3G.4 participant color mapping and v3G.3 connected bracket layout.
