# World Cup 2026 Portfolio Challenge — Auction MVP

This is a lightweight web app MVP for a live office auction. It uses React + Vite + Firebase Realtime Database.

## Included features

- Username-only entry, no password
- Admin user: enter username `admin`
- 45 starting credits per participant
- ESPN pre-tournament rank field for 48 countries
- Scheduled auction order with 5-minute country windows
- Live auction room
- Bids cannot exceed remaining credits
- Commissioner can start, pause, skip, and sell lots
- Winning bid deducts credits through derived portfolio accounting
- Portfolio page
- Leaderboard: points, spent, remaining, profit
- Manual scoring admin: add points to a country

## Not included yet

- ESPN automatic match result pull
- Fractional 1% trades
- Commissioner trade approval workflow
- Full ownership ledger / audit log

These are intended for v1.1 after the auction MVP works.

## Setup

1. Install Node.js.
2. Unzip this folder.
3. Run:

```bash
npm install
```

4. Create a Firebase project: https://console.firebase.google.com
5. Add a Web App in Firebase.
6. Create a Realtime Database in test mode.
7. Copy your Firebase config into `src/firebase.js`.
8. Run locally:

```bash
npm run dev
```

9. Open the local URL shown by Vite.

## Deploy to a URL using Vercel

1. Create a GitHub repo and upload these files.
2. Create a free Vercel account.
3. Import the GitHub repo into Vercel.
4. Framework preset: Vite.
5. Build command: `npm run build`.
6. Output directory: `dist`.
7. Deploy.

## First use

1. Visit the site.
2. Enter username `admin`.
3. Go to Admin.
4. Set the draft start time and click **Initialize / Reset Schedule**.
5. Add participants, or let participants join by entering their usernames.
6. Go to Auction.
7. Start the first lot.
8. Participants bid from their own phones/laptops.
9. Admin clicks **Sell to high bidder**.

## Firebase Realtime Database Rules for MVP testing

For quick MVP testing only, you can use open rules:

```json
{
  "rules": {
    ".read": true,
    ".write": true
  }
}
```

Do not use these rules for a public production app.
