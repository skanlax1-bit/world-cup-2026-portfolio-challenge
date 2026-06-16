# v3F.1 Fixture Layout Hotfix

This package fixes the v3F Matches page layout on both web and mobile.

## What changed

- Replaces the broken match scorecard layout that smashed teams/scores/venues together.
- Keeps Today / Upcoming / Completed sections.
- Uses clear fixture rows/cards with separate status, teams, kickoff, venue, and scoring fields.
- Keeps ESPN refresh and scoring logic unchanged.
- Keeps v3F Scoring Log, Home dashboard, Trade Log cleanup, and leaderboard behavior.

## Upload

Upload/update:

- `src/main.jsx`
- `src/styles.css`
- `src/matches.js`
- `api/espn-schedule.js`
- `README.md`

Do not replace `src/firebase.js`.
