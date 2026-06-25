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

const FIFA_CODE_ALIASES = {
  "FRA": "France", "ESP": "Spain", "ENG": "England", "POR": "Portugal", "GER": "Germany",
  "BRA": "Brazil", "ARG": "Argentina", "NED": "Netherlands", "NOR": "Norway", "TUR": "Türkiye",
  "SEN": "Senegal", "BEL": "Belgium", "URU": "Uruguay", "MAR": "Morocco", "ECU": "Ecuador",
  "CRO": "Croatia", "CIV": "Ivory Coast", "COL": "Colombia", "SUI": "Switzerland", "SWE": "Sweden",
  "JPN": "Japan", "USA": "United States", "AUT": "Austria", "MEX": "Mexico", "CAN": "Canada",
  "DZA": "Algeria", "ALG": "Algeria", "PAR": "Paraguay", "SCO": "Scotland", "CZE": "Czechia",
  "KOR": "South Korea", "EGY": "Egypt", "AUS": "Australia", "COD": "Congo DR", "DRC": "Congo DR",
  "UZB": "Uzbekistan", "IRI": "Iran", "IRN": "Iran", "GHA": "Ghana", "BIH": "Bosnia and Herzegovina",
  "PAN": "Panama", "TUN": "Tunisia", "JOR": "Jordan", "NZL": "New Zealand", "IRQ": "Iraq",
  "CPV": "Cape Verde", "KSA": "Saudi Arabia", "HTI": "Haiti", "RSA": "South Africa", "CUW": "Curaçao",
  "QAT": "Qatar"
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
  Object.entries({ ...TEAM_ALIASES, ...FIFA_CODE_ALIASES }).map(([from, to]) => [normalizeForCompare(from), to])
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

function easternDateKey(value) {
  if (!value) return "";
  const raw = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw.slice(0, 10);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(d).reduce((acc, part) => ({ ...acc, [part.type]: part.value }), {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function inferStage(event) {
  const competition = event.competitions?.[0] || {};
  const dateKey = easternDateKey(event.date || competition.date || "");

  // Date is the primary source for the 2026 knockout stage. Using local Eastern dates prevents
  // late-night group games like Argentina/Jordan from being misread as Round of 32 because
  // their UTC timestamp falls on the next calendar day.
  if (dateKey >= "2026-06-28" && dateKey <= "2026-07-03") return "Round of 32";
  if (dateKey >= "2026-07-04" && dateKey <= "2026-07-07") return "Round of 16";
  if (dateKey >= "2026-07-09" && dateKey <= "2026-07-11") return "Quarterfinal";
  if (dateKey >= "2026-07-14" && dateKey <= "2026-07-15") return "Semifinal";
  if (dateKey === "2026-07-18") return "Third Place";
  if (dateKey === "2026-07-19") return "Final";

  const noteText = [
    competition.notes?.[0]?.headline,
    competition.notes?.[0]?.type,
    event.shortName,
    event.name
  ].filter(Boolean).join(" ").toLowerCase();

  // Fallback only when date is unavailable. Do not use ESPN's generic tournament
  // labels such as "World Cup Finals" because that makes every game look like the Final.
  if (/third[-\s]?place/.test(noteText)) return "Third Place";
  if (/semi[-\s]?final/.test(noteText)) return "Semifinal";
  if (/quarter[-\s]?final/.test(noteText)) return "Quarterfinal";
  if (/round\s+of\s+16|\br16\b/.test(noteText)) return "Round of 16";
  if (/round\s+of\s+32|\br32\b/.test(noteText)) return "Round of 32";
  if (/^final$/.test(noteText.trim())) return "Final";
  return "Group Stage";
}

function formatDateParts(dateTime) {
  const d = new Date(dateTime);
  return {
    date: easternDateKey(dateTime),
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

function bestTeamName(competitor) {
  const team = competitor?.team || {};
  const candidates = [team.displayName, team.name, team.shortDisplayName, team.abbreviation, competitor?.abbreviation]
    .filter(Boolean);

  for (const candidate of candidates) {
    const normalized = normalizeTeamName(candidate);
    if (isKnownAppCountry(normalized)) return normalized;
  }
  for (const candidate of candidates) {
    const normalized = normalizeTeamName(candidate);
    if (!isBracketPlaceholder(normalized)) return normalized;
  }
  return normalizeTeamName(candidates[0]) || "TBD";
}

function cleanMatchupSide(side) {
  const cleaned = String(side || "")
    .replace(/\([^)]*\)/g, " ")
    .replace(/^[#\d\s.-]+/, "")
    .replace(/\s+/g, " ")
    .trim();
  return normalizeTeamName(cleaned);
}

function parseMatchupNames(event) {
  const candidates = [event.name, event.shortName, event.competitions?.[0]?.notes?.[0]?.headline].filter(Boolean);
  for (const text of candidates) {
    const normalizedText = String(text).replace(/\s+/g, " ").trim();
    const parts = normalizedText.split(/\s+(?:vs\.?|v|@|at)\s+/i);
    if (parts.length !== 2) continue;
    const first = cleanMatchupSide(parts[0]);
    const second = cleanMatchupSide(parts[1]);
    if (first && second && first !== "TBD" && second !== "TBD") return [first, second];
  }
  return [];
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
  let homeName = bestTeamName(home);
  let awayName = bestTeamName(away);
  const parsedMatchupNames = parseMatchupNames(event);
  if (parsedMatchupNames.length === 2) {
    if (!isKnownAppCountry(homeName) && isKnownAppCountry(parsedMatchupNames[0])) homeName = parsedMatchupNames[0];
    if (!isKnownAppCountry(awayName) && isKnownAppCountry(parsedMatchupNames[1])) awayName = parsedMatchupNames[1];
  }
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
