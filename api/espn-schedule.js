const ESPN_URL = "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=20260611-20260719&limit=500";

const APP_COUNTRIES = [
  "France",
  "Spain",
  "England",
  "Portugal",
  "Germany",
  "Brazil",
  "Argentina",
  "Netherlands",
  "Norway",
  "Türkiye",
  "Senegal",
  "Belgium",
  "Uruguay",
  "Morocco",
  "Ecuador",
  "Croatia",
  "Ivory Coast",
  "Colombia",
  "Switzerland",
  "Sweden",
  "Japan",
  "United States",
  "Austria",
  "Mexico",
  "Canada",
  "Algeria",
  "Paraguay",
  "Scotland",
  "Czechia",
  "South Korea",
  "Egypt",
  "Australia",
  "Congo DR",
  "Uzbekistan",
  "Iran",
  "Ghana",
  "Bosnia and Herzegovina",
  "Panama",
  "Tunisia",
  "Jordan",
  "New Zealand",
  "Iraq",
  "Cape Verde",
  "Saudi Arabia",
  "Haiti",
  "South Africa",
  "Curaçao",
  "Qatar"
];

const TEAM_ALIASES = {
  "USA": "United States",
  "United States": "United States",
  "USMNT": "United States",
  "United States of America": "United States",
  "Korea Republic": "South Korea",
  "Republic of Korea": "South Korea",
  "South Korea": "South Korea",
  "Czech Republic": "Czechia",
  "Czechia": "Czechia",
  "Côte d'Ivoire": "Ivory Coast",
  "Cote d'Ivoire": "Ivory Coast",
  "Côte d’Ivoire": "Ivory Coast",
  "Ivory Coast": "Ivory Coast",
  "Türkiye": "Türkiye",
  "Turkey": "Türkiye",
  "Turkiye": "Türkiye",
  "Curacao": "Curaçao",
  "Curaçao": "Curaçao",
  "DR Congo": "Congo DR",
  "Congo DR": "Congo DR",
  "Democratic Republic of Congo": "Congo DR",
  "Democratic Republic of the Congo": "Congo DR",
  "Bosnia & Herzegovina": "Bosnia and Herzegovina",
  "Bosnia-Herzegovina": "Bosnia and Herzegovina",
  "Bosnia and Herzegovina": "Bosnia and Herzegovina",
  "Cape Verde Islands": "Cape Verde",
  "Cape Verde": "Cape Verde",
  "Saudi Arabia": "Saudi Arabia",
  "New Zealand": "New Zealand",
  "South Africa": "South Africa"
};

function normalizeForCompare(name) {
  return String(name || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’]/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

const ALIAS_BY_NORMALIZED_NAME = Object.fromEntries(
  Object.entries(TEAM_ALIASES).map(([from, to]) => [normalizeForCompare(from), to])
);

const KNOWN_COUNTRIES_BY_NORMALIZED_NAME = new Set(APP_COUNTRIES.map(normalizeForCompare));

function normalizeTeamName(name) {
  if (!name) return "TBD";
  const cleaned = String(name).replace(/\s+/g, " ").trim();
  return ALIAS_BY_NORMALIZED_NAME[normalizeForCompare(cleaned)] || cleaned;
}

function isBracketPlaceholder(name) {
  const value = String(name || "").replace(/\s+/g, " ").trim();
  if (!value || value === "TBD") return true;
  return (
    /^Group [A-L] (Winner|2nd Place)$/i.test(value) ||
    /^Third Place Group /i.test(value) ||
    /^Round Of (32|16) \d+ Winner$/i.test(value) ||
    /^Round of (32|16) \d+ Winner$/i.test(value) ||
    /^Quarterfinal \d+ Winner$/i.test(value) ||
    /^Semifinal \d+ (Winner|Loser)$/i.test(value) ||
    /^Final Winner$/i.test(value) ||
    /^Match \d+ Winner$/i.test(value) ||
    /^Winner Match \d+$/i.test(value) ||
    /^Loser Match \d+$/i.test(value)
  );
}

function isKnownAppCountry(name) {
  return KNOWN_COUNTRIES_BY_NORMALIZED_NAME.has(normalizeForCompare(name));
}

function inferStage(event) {
  const text = `${event.name || ""} ${event.shortName || ""} ${event.season?.slug || ""} ${event.competitions?.[0]?.notes?.[0]?.headline || ""}`.toLowerCase();
  if (text.includes("third-place") || text.includes("third place")) return "Third Place";
  if (text.includes("final")) return "Final";
  if (text.includes("semifinal") || text.includes("semi-final")) return "Semifinal";
  if (text.includes("quarterfinal") || text.includes("quarter-final")) return "Quarterfinal";
  if (text.includes("round of 16")) return "Round of 16";
  if (text.includes("round of 32")) return "Round of 32";
  return "Group Stage";
}

function formatDateParts(dateTime) {
  const d = new Date(dateTime);
  return {
    date: d.toISOString().slice(0, 10),
    displayDate: d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "America/New_York" }),
    time: d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" })
  };
}

function venueLabel(competition) {
  const venue = competition?.venue;
  if (!venue) return "";
  const name = venue.fullName || venue.name || "";
  const city = venue.address?.city || "";
  const state = venue.address?.state || venue.address?.country || "";
  return [name, city, state].filter(Boolean).join(", ");
}

function parseStatus(event, competition) {
  const status = event.status || competition?.status || {};
  const type = status.type || {};
  const completed = Boolean(type.completed || status.completed);
  const state = String(type.state || status.state || "").toLowerCase();
  const rawClock = status.displayClock || competition?.status?.displayClock || type.shortDetail || type.detail || type.description || "";
  if (completed || state === "post") {
    return { statusType: "final", statusDisplay: "Final", matchMinute: null, completed: true };
  }
  if (state === "in" || type.name === "STATUS_IN_PROGRESS") {
    const minuteMatch = String(rawClock).match(/(\d+)(?:\s*\+\s*(\d+))?/);
    const statusDisplay = minuteMatch
      ? `${minuteMatch[1]}${minuteMatch[2] ? `+${minuteMatch[2]}` : ""}'`
      : "Live";
    return { statusType: "live", statusDisplay, matchMinute: minuteMatch ? Number(minuteMatch[1]) : null, completed: false };
  }
  return { statusType: "not_started", statusDisplay: "Not Started", matchMinute: null, completed: false };
}

function getWinnerCountry(home, away, homeName, awayName) {
  if (home?.winner === true) return homeName;
  if (away?.winner === true) return awayName;
  return "";
}

function normalizeEvent(event) {
  const competition = event.competitions?.[0] || {};
  const competitors = competition.competitors || [];
  const home = competitors.find((c) => c.homeAway === "home") || competitors[0] || {};
  const away = competitors.find((c) => c.homeAway === "away") || competitors[1] || {};
  const homeName = normalizeTeamName(home.team?.displayName || home.team?.name || home.team?.shortDisplayName);
  const awayName = normalizeTeamName(away.team?.displayName || away.team?.name || away.team?.shortDisplayName);
  const dateTime = event.date || competition.date || "";
  const dateParts = dateTime ? formatDateParts(dateTime) : { date: "", displayDate: "Unscheduled", time: "—" };
  const statusParts = parseStatus(event, competition);

  return {
    id: `espn-${event.id}`,
    espnEventId: event.id,
    dateTime,
    ...dateParts,
    home: homeName,
    away: awayName,
    venue: venueLabel(competition),
    stage: inferStage(event),
    source: "ESPN",
    status: event.status?.type?.description || event.status?.type?.name || "Scheduled",
    ...statusParts,
    winnerCountry: getWinnerCountry(home, away, homeName, awayName),
    homeScore: home.score ?? "",
    awayScore: away.score ?? "",
    lastSyncedAt: Date.now()
  };
}

function findUnmatchedTeams(matches) {
  const names = matches.flatMap((m) => [m.home, m.away]).filter(Boolean);
  return [...new Set(names)]
    .filter((name) => !isBracketPlaceholder(name))
    .filter((name) => !isKnownAppCountry(name))
    .sort();
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") return res.status(204).end();

  try {
    const response = await fetch(ESPN_URL, {
      headers: {
        "accept": "application/json",
        "user-agent": "WorldCupPortfolioChallenge/1.0"
      }
    });
    if (!response.ok) {
      return res.status(response.status).json({ error: `ESPN request failed with ${response.status}` });
    }

    const data = await response.json();
    const events = Array.isArray(data.events) ? data.events : [];
    const matches = events.map(normalizeEvent).sort((a, b) => String(a.dateTime).localeCompare(String(b.dateTime)));
    const unmatchedTeams = findUnmatchedTeams(matches);

    return res.status(200).json({
      source: "ESPN",
      fetchedAt: Date.now(),
      count: matches.length,
      unmatchedTeams,
      matches
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || String(error) });
  }
}
