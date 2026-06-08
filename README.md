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
