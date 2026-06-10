# World Cup 2026 Portfolio Challenge — v3E

This version adds the public ESPN refresh and duplicate-proof scoring framework.

## Keep your existing Firebase config

When installing this update, do **not** replace your existing `src/firebase.js` file if your live app is already connected to Firebase.

## Files changed in this update

Upload these files to GitHub:

- `src/main.jsx`
- `src/styles.css`
- `src/matches.js`
- `api/espn-schedule.js`
- `README.md`

## v3E scope included

### Matches tab

- Adds a public `Refresh ESPN Match Data` button on the Matches tab.
- Any logged-in user can refresh ESPN match data for everyone.
- Adds a 60-second cooldown.
- Shows `Last synced: 2:14 PM by Taylor` style status.
- Shows match status as:
  - `Not Started`
  - live minute such as `34'`
  - `Final`
- Shows match scores.

### Scoring ledger

- Adds duplicate-proof scoring events under `scoringEvents` in Firebase.
- Match scoring uses stable event IDs so a match cannot score twice.
- Leaderboard points now include active scoring ledger events.
- Existing direct country `points` values still count as legacy/manual points.

### Automatic match scoring

When ESPN marks a match as Final:

- Group-stage win = +3.
- Group-stage draw = +1 for each country.
- Knockout wins are scored by round:
  - Round of 32 = +5
  - Round of 16 = +9
  - Quarterfinal = +15
  - Semifinal = +22
  - Final = +34
- Knockout scoring relies on ESPN winner indicator.
- If a knockout match is tied and no winner is found, the match is flagged for admin review instead of being scored.

### Trade-aware scoring

- Before scoring a final match, the app checks accepted trades awaiting admin approval involving either country in the match.
- If such a trade was accepted before the match was observed final, match scoring is blocked.
- Those countries are temporarily suspended from new trades until points are applied.
- Admin can resolve trades, then score the pending match.

### Admin scoring controls

- Adds a pending match scoring queue.
- Adds manual result / scoring override.
- Adds auditable manual scoring adjustments.
- Adds group winner selector, max 12 teams.
- Adds advanced-from-group selector, max 32 teams.
- Manual advanced-from-group override supersedes ESPN auto-detect.
- ESPN auto-detect can award advanced-from-group points from Round of 32 schedule entries when real countries appear.
- Duplicate group winner / advanced points are prevented.

## Install notes

1. Copy the changed files into your local app folder.
2. Keep your existing `src/firebase.js`.
3. Run local check:

```bash
npm run dev
```

4. If it loads locally, upload the changed files to GitHub.
5. Wait for Vercel to deploy.
6. Test the live site.

## Live test checklist

1. Site loads.
2. Login works.
3. Leaderboard still excludes `admin`.
4. Leaderboard column order is unchanged from v3D.
5. Matches tab shows the public refresh button.
6. Click refresh once and confirm match statuses/scores appear.
7. Confirm leaderboard does not unexpectedly change unless a match is Final and eligible for scoring.
8. Confirm Admin tab shows:
   - Pending Match Scoring
   - Manual result / scoring override
   - Group winner selector
   - Advanced-from-group selector
   - Scoring ledger
9. Confirm Trading tab blocks countries with pending unscored match points.

## Important scoring rule

A trade affects a match only if both participants accepted it and it reached admin approval before the match was observed as Final. If such a pending trade exists, the app blocks scoring until admin resolves the trade.
