# World Cup 2026 Portfolio Challenge — v3B UX + Trading Upgrade

This version includes the v3A UX upgrade plus functional trading.

## Included

- Better live auction room
- Mobile-friendly auction, schedule, portfolio, and leaderboard layouts
- Auction Schedule tab
- Matches tab with read-only World Cup match schedule
- View other players' portfolios
- Portfolio ownership shares
- Trading tab
- Trade proposals
- Incoming trade inbox with accept/reject
- Outgoing trade list with cancel option
- Admin final approval before a trade executes
- Completed trade log
- 1% country share increments
- Credits included in trades
- Credit accounting after the auction

## Trading rules implemented

- Countries can be traded in whole-number percentages, minimum 1%.
- Trades can include country shares and/or credits.
- Each side must send at least one item.
- A user cannot send more credits than they currently have.
- A user cannot send more country share than they currently own.
- A proposed trade must be accepted by the counterparty.
- Accepted trades must be approved by `admin` before shares or credits move.
- Credits received in trades reduce net credits spent.
- Credits sent in trades increase net credits spent.
- Profit = points earned - net credits spent.

## Firebase paths added

This update is backward-compatible with existing auction data. It adds these paths only when trades happen:

- `trades`
- `creditAdjustments`
- `schedule/{countryLot}/shares` for fractional ownership

Existing participants, bids, sold countries, scores, and schedules are not cleared or reset by installing this update.

## Important

Do not replace your working `src/firebase.js` unless you are ready to paste your real Firebase config back in.

## v3C Access + Welcome Patch

This package includes the v3B UX + Trading upgrade plus these additional patches:

- Admin navigation and admin page are visible only to the `admin` user / admin role.
- Non-admin users cannot render the Admin page even if they previously had that tab open.
- Login is now a participant dropdown. Users select their existing name instead of typing a new username.
- Self-registration through the login screen is disabled, which prevents accidental duplicate users.
- A Welcome tab was added with the concise league format, scoring rules, profit formula, and trading explanation.
- The existing Firebase data structure is preserved. No reset is required.

Important: keep your working `src/firebase.js` file. Do not replace it when applying this update.


## v3D additions

This package includes the v3C access/welcome/trading update plus:

- Full 104-match tournament schedule framework in the Matches tab.
- Results fields on the Matches page.
- Admin-only Results Admin controls for entering final scores, saving scoring-pending results, and applying match points.
- Country trade status controls: active/tradable, temporarily locked, and eliminated.
- Trading validation that blocks eliminated or temporarily locked teams.
- Trade timing metadata: approvedAt and effectiveAt are saved on approved trades.
- Auction max-bid indicator: if the current high bid cannot be beaten by available remaining credits, the Auction page shows a clear warning.

Important: this update is backward-compatible with existing Firebase league data. Do not replace src/firebase.js when installing.

## v3D Schedule Patch

This patch replaces group-stage TBD placeholders with the full known group-stage match list through June 27. Knockout-stage teams remain placeholders until the tournament bracket is known.

Match times are displayed in Eastern Time for consistency with the ESPN-style schedule display used in the app.
