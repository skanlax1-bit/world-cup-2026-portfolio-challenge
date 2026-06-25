# World Cup 2026 Portfolio Challenge — v3G.2 Bracket Loading Hotfix

This update adds a new Bracket tab focused on the knockout rounds while preserving the existing ESPN sync and scoring engine.

## Included

- New Bracket tab in the main navigation.
- Bracket columns for:
  - Round of 32
  - Round of 16
  - Quarterfinal
  - Semifinal
  - Final
- Knockout match cards using the same ESPN-synced match data as the Matches tab.
- Each bracket card shows:
  - country names or placeholders
  - flags
  - live/final score
  - match status
  - match time
  - venue
  - points available to the winner
  - winner progression text
- Ownership wheels beside each real country.
  - Hover on desktop or tap/focus on mobile to expand ownership details.
- Bracket uses existing ownership and scoring data only; it does not create a separate scoring engine.
- Login dropdown now also applies the Federico → TJ Baller display-name override.

## Excluded intentionally

- No live markets tab.
- No wagers.
- No options.
- No shorting.
- No scoring formula changes.
- No new automatic scoring logic.

## Upload notes

Upload/update:

- `src/main.jsx`
- `src/styles.css`
- `src/matches.js`
- `api/espn-schedule.js`
- `README.md`

Do not replace your live `src/firebase.js` file.


## v3G.2 hotfix notes

This hotfix addresses two bracket-loading issues observed after v3G deployment:

- Round of 16 / Quarterfinal / Semifinal matches being grouped into the Final column.
- Round of 32 teams not appearing in bracket cards even when they appeared correctly in the Matches tab.

Fixes included:

- ESPN stage detection no longer reads the generic tournament "finals" label as the World Cup Final.
- Knockout rounds now have date-based fallback classification.
- FIFA country-code aliases were added for knockout-team parsing.
- The Bracket tab also applies client-side round fallback so already-synced bad stage labels display in the right column after deploy, and a fresh ESPN refresh will overwrite the stored stage values.


## v3G.2 Bracket date-stage hotfix

- Uses America/New_York local match dates for bracket round assignment.
- Prevents late-night group-stage matches from being treated as Round of 32 due to UTC date rollover.
- Prevents ESPN generic “World Cup Finals” labels from pushing Round of 16/Quarterfinal/Semifinal matches into the Final column.
- Excludes the Third Place match from the main bracket columns.
- After deploy, run Refresh ESPN Match Data once to overwrite any previously synced bad stage values.


## v3G.3 Connected Bracket + Ownership Colors

This update changes the Bracket tab from round-by-round lists into a connected bracket tree with visual progression lines. It also assigns each participant a stable unique color for ownership wheels so the same participant uses the same color across every country.

### Included
- ESPN-style connected bracket tree layout.
- Horizontal scroll on mobile and narrow screens.
- Round jump buttons at the top of the bracket.
- Compact bracket cards with flags, scores/status, kickoff time, venue, points available, and progression text.
- Stable unique participant color map for team ownership wheels and popovers.
- Preserves the v3G.2 date/stage fixes for bracket round assignment.

### Excluded
- No markets, wagers, options, or shorting.
- No scoring formula changes.
- No changes to Firebase credentials. Keep your existing src/firebase.js.
