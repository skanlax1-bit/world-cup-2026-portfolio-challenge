# World Cup 2026 Portfolio Challenge - v3G.9 Portfolio/Ownership Crash Hotfix

Focused hotfix after v3G.8.

## Fixes

- Restores the missing `Portfolio` component.
- Restores the missing `CountryOwnership` component.
- Fixes the blank-screen crash when opening the Portfolio tab.
- Fixes the blank-screen crash when opening the Ownership tab.
- Adds defensive rendering so malformed scoring/ownership rows do not blank the page.
- Adds an ownership audit warning when a country no longer totals 100% ownership.
- Keeps the connected bracket and ownership color work from v3G.8.
- Does not change scoring logic, trade logic, profit logic, ESPN sync, or bracket stage mapping.

## Upload these files

- `src/main.jsx`
- `src/styles.css`
- `README.md`

Do not replace `src/firebase.js`.

You do not need to run Repair Missing Allocations for this fix. This is a front-end component restoration hotfix.
