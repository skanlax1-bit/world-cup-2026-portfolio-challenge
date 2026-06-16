import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { ref, onValue, set, update, push } from "firebase/database";
import {
  Trophy,
  Gavel,
  Wallet,
  BarChart3,
  Settings,
  User,
  RefreshCw,
  CalendarDays,
  Users,
  ListChecks,
  ArrowLeftRight,
  Inbox,
  Send,
  CheckCircle2,
  XCircle,
  History,
  ShieldCheck,
  BookOpen,
  Globe2,
  Download,
  AlertTriangle,
  Save
} from "lucide-react";
import { db } from "./firebase";
import { countries, buildDefaultSchedule } from "./countries";
import { worldCupMatches } from "./matches";
import "./styles.css";

const LEAGUE_ID = "defaultLeague";
const STARTING_CREDITS = 45;
const TIMER_SECONDS = 5 * 60;

const leagueRoot = () => ref(db, `leagues/${LEAGUE_ID}`);
const dbPath = (p) => ref(db, `leagues/${LEAGUE_ID}/${p}`);
const slug = (name) => name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const normalizeObj = (obj) => obj ? Object.values(obj) : [];
const money = (n) => Number(n || 0).toFixed(Number.isInteger(Number(n || 0)) ? 0 : 2);
const fmtTime = (iso) => iso ? new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "—";
const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" }) : "—";
const formatTimer = (seconds) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
const clampInt = (value, min, max) => Math.min(max, Math.max(min, Math.floor(Number(value || 0))));

function useFirebaseValue(firebasePath, fallback) {
  const [value, setValue] = useState(fallback);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onValue(dbPath(firebasePath), (snap) => {
      setValue(snap.exists() ? snap.val() : fallback);
      setLoading(false);
    });
    return () => unsub();
  }, [firebasePath]);

  return [value, loading];
}

function useNow(interval = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), interval);
    return () => clearInterval(timer);
  }, [interval]);
  return now;
}

function getLotShares(lot) {
  if (lot?.shares) {
    return Object.fromEntries(Object.entries(lot.shares).map(([id, share]) => [id, Number(share || 0)]).filter(([, share]) => share > 0));
  }
  if (lot?.status === "sold" && lot?.winningParticipantId) return { [lot.winningParticipantId]: 100 };
  return {};
}

function cleanShares(shares) {
  const cleaned = {};
  Object.entries(shares || {}).forEach(([id, share]) => {
    const value = Number(share || 0);
    if (value > 0) cleaned[id] = value;
  });
  return cleaned;
}

function participantName(participants, id) {
  return participants.find((p) => p.id === id)?.name || id || "—";
}

function getActiveMatches(matchesObj) {
  const imported = normalizeObj(matchesObj).sort((a, b) => String(a.dateTime || a.date || "").localeCompare(String(b.dateTime || b.date || "")));
  return imported.length ? imported : worldCupMatches;
}

function groupMatchesByDate(matches) {
  return matches.reduce((acc, match) => {
    const label = match.displayDate || (match.dateTime ? new Date(match.dateTime).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric", year: "numeric" }) : match.date || "Unscheduled");
    acc[label] = acc[label] || [];
    acc[label].push(match);
    return acc;
  }, {});
}

function matchSortTime(match) {
  const raw = match?.dateTime || match?.date || match?.kickoff || "";
  const parsed = raw ? new Date(raw).getTime() : 0;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function isSameLocalDay(a, b) {
  if (!a || !b) return false;
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function splitMatchesForDisplay(matches) {
  const today = new Date();
  const ordered = [...matches].sort((a, b) => matchSortTime(a) - matchSortTime(b));
  const todaysGames = [];
  const upcomingGames = [];
  const completedGames = [];

  ordered.forEach((match) => {
    const when = matchSortTime(match) ? new Date(matchSortTime(match)) : null;
    if (match.statusType === "final" || match.completed) completedGames.push(match);
    else if (when && isSameLocalDay(when, today)) todaysGames.push(match);
    else upcomingGames.push(match);
  });

  return [
    { key: "today", title: "Today’s Games", subtitle: "Live and upcoming matches for today.", matches: todaysGames },
    { key: "upcoming", title: "Upcoming Games", subtitle: "Future matches sorted by kickoff time.", matches: upcomingGames },
    { key: "completed", title: "Completed Games", subtitle: "Final matches move here after they are scored.", matches: completedGames }
  ].filter((section) => section.matches.length);
}

function scoreText(match) {
  const homeScore = match?.homeScore;
  const awayScore = match?.awayScore;
  const hasScore = homeScore !== undefined && awayScore !== undefined && homeScore !== "" && awayScore !== "" && homeScore !== null && awayScore !== null;
  return hasScore ? `${homeScore}–${awayScore}` : "—";
}

function statusBadgeClass(match) {
  if (match?.statusType === "final" || match?.completed) return "positive";
  if (match?.statusType === "live") return "live";
  return "neutral";
}

function eventDisplayType(type) {
  const map = {
    groupStageWin: "Group-stage win",
    groupStageDraw: "Group-stage draw",
    advanceFromGroup: "Advance from group",
    groupWinner: "Win group",
    round_of_32Win: "Round of 32 win",
    round_of_16Win: "Round of 16 win",
    quarterfinalWin: "Quarterfinal win",
    semifinalWin: "Semifinal win",
    finalWin: "Final win"
  };
  return map[type] || String(type || "Scoring event").replace(/_/g, " ");
}

function lastScoringEvent(scoringEventsObj) {
  return normalizeObj(scoringEventsObj)
    .filter(isActiveScoringEvent)
    .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))[0] || null;
}

const APP_COUNTRY_NAMES = countries.map((c) => c.name);
const APP_COUNTRY_SET = new Set(APP_COUNTRY_NAMES);
const GROUP_STAGE_WIN_POINTS = 3;
const GROUP_STAGE_DRAW_POINTS = 1;
const ADVANCE_FROM_GROUP_POINTS = 3;
const GROUP_WINNER_POINTS = 3;
const REFRESH_COOLDOWN_MS = 60 * 1000;

const KNOCKOUT_POINTS = {
  "Round of 32": 5,
  "Round of 16": 9,
  "Quarterfinal": 15,
  "Semifinal": 22,
  "Final": 34
};

function eventSafeId(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
}

function isActiveScoringEvent(event) {
  return event && event.status !== "voided" && event.active !== false;
}

function isRealAppCountry(name) {
  return APP_COUNTRY_SET.has(name);
}

function isKnockoutStage(stage) {
  return Boolean(KNOCKOUT_POINTS[stage]);
}

function getMatchCountries(match) {
  return [match?.home, match?.away].filter(isRealAppCountry);
}


function applyPathValue(target, parts, value) {
  if (!parts.length) return value;
  const [head, ...rest] = parts;
  const base = target && typeof target === "object" && !Array.isArray(target) ? { ...target } : {};
  base[head] = rest.length ? applyPathValue(base[head], rest, value) : value;
  return base;
}

function collapseFirebaseUpdateConflicts(updates) {
  const result = { ...updates };
  const paths = Object.keys(updates).sort((a, b) => a.length - b.length);
  paths.forEach((parentPath) => {
    if (!(parentPath in result)) return;
    const parentValue = result[parentPath];
    if (!parentValue || typeof parentValue !== "object" || Array.isArray(parentValue)) return;
    const prefix = `${parentPath}/`;
    Object.keys(result).forEach((childPath) => {
      if (!childPath.startsWith(prefix)) return;
      const childParts = childPath.slice(prefix.length).split("/").filter(Boolean);
      result[parentPath] = applyPathValue(result[parentPath], childParts, result[childPath]);
      delete result[childPath];
    });
  });
  return result;
}

function scoringEventId(parts) {
  return parts.map(eventSafeId).filter(Boolean).join("_");
}

function createCountryAllocations(country, points, participants, lots) {
  const lot = lots.find((l) => l.country === country);
  const shares = getLotShares(lot || {});
  const allocations = {};
  Object.entries(shares).forEach(([participantId, share]) => {
    const participant = participants.find((p) => p.id === participantId);
    const participantPoints = Number(points || 0) * (Number(share || 0) / 100);
    if (!participant || participantPoints === 0) return;
    allocations[participantId] = {
      participantId,
      participantName: participant.name,
      share: Number(share || 0),
      points: participantPoints
    };
  });
  return allocations;
}


function getEventCutoff(event, matchesObj) {
  const match = event?.matchId ? (matchesObj?.[event.matchId] || normalizeObj(matchesObj).find((m) => m.id === event.matchId || `espn-${m.espnEventId}` === event.matchId)) : null;
  return Number(
    match?.finalObservedAt ||
    match?.scoredAt ||
    match?.lastSyncedAt ||
    event?.createdAt ||
    Date.now()
  );
}

function reconstructCountrySharesAt(country, lots, trades, cutoffAt) {
  const lot = lots.find((l) => l.country === country);
  if (!lot) return {};

  const initialOwner = lot.winningParticipantId;
  const shares = initialOwner ? { [initialOwner]: 100 } : getLotShares(lot);

  const approvedTrades = trades
    .filter((trade) => trade.status === "approved")
    .map((trade) => ({
      ...trade,
      effectiveAt: Number(trade.acceptedAt || trade.approvedAt || trade.createdAt || 0)
    }))
    .filter((trade) => trade.effectiveAt > 0 && trade.effectiveAt <= Number(cutoffAt || Date.now()))
    .sort((a, b) => a.effectiveAt - b.effectiveAt);

  const move = (fromId, toId, amount) => {
    const qty = Number(amount || 0);
    if (!fromId || !toId || qty <= 0) return;
    shares[fromId] = Number(shares[fromId] || 0) - qty;
    shares[toId] = Number(shares[toId] || 0) + qty;
    if (shares[fromId] <= 0.000001) delete shares[fromId];
  };

  approvedTrades.forEach((trade) => {
    const fromMatches = trade.fromCountryId === lot.id || trade.fromCountryName === country;
    const toMatches = trade.toCountryId === lot.id || trade.toCountryName === country;
    if (fromMatches) move(trade.fromParticipantId, trade.toParticipantId, trade.fromShare);
    if (toMatches) move(trade.toParticipantId, trade.fromParticipantId, trade.toShare);
  });

  return cleanShares(shares);
}

function createHistoricalCountryAllocations(country, points, participants, lots, trades, cutoffAt) {
  const shares = reconstructCountrySharesAt(country, lots, trades, cutoffAt);
  const allocations = {};
  Object.entries(shares).forEach(([participantId, share]) => {
    const participant = participants.find((p) => p.id === participantId);
    const participantPoints = Number(points || 0) * (Number(share || 0) / 100);
    if (!participant || participantPoints === 0) return;
    allocations[participantId] = {
      participantId,
      participantName: participant.name,
      share: Number(share || 0),
      points: participantPoints
    };
  });
  return allocations;
}

function buildMissingAllocationRepairs(scoringEventsObj, matchesObj, participants, lots, trades) {
  const repairs = {};
  normalizeObj(scoringEventsObj).forEach((event) => {
    if (!isActiveScoringEvent(event)) return;
    if (event.allocations && Object.keys(event.allocations).length) return;
    if (!event.country || !Number(event.points || 0)) return;
    const cutoffAt = getEventCutoff(event, matchesObj);
    const allocations = createHistoricalCountryAllocations(event.country, Number(event.points || 0), participants, lots, trades, cutoffAt);
    if (!Object.keys(allocations).length) return;
    repairs[`scoringEvents/${event.id}/allocations`] = allocations;
    repairs[`scoringEvents/${event.id}/allocationsRepairedAt`] = Date.now();
    repairs[`scoringEvents/${event.id}/allocationsRepairMethod`] = "auction_plus_approved_trades_by_effective_time";
    repairs[`scoringEvents/${event.id}/allocationsCutoffAt`] = cutoffAt;
  });
  return repairs;
}

function matchInvolvesTradeCountry(trade, countryNames) {
  const set = new Set(countryNames);
  return Boolean(
    (trade.fromCountryName && set.has(trade.fromCountryName)) ||
    (trade.toCountryName && set.has(trade.toCountryName))
  );
}

function getPendingAdminTradesForMatch(match, trades) {
  const countriesInMatch = getMatchCountries(match);
  const finalAt = Number(match.finalObservedAt || match.lastSyncedAt || Date.now());
  return trades.filter((trade) => {
    if (trade.status !== "accepted") return false;
    if (!matchInvolvesTradeCountry(trade, countriesInMatch)) return false;
    const submittedAt = Number(trade.acceptedAt || trade.createdAt || 0);
    return submittedAt > 0 && submittedAt <= finalAt;
  });
}

function getLockedCountriesFromMatches(matchesObj) {
  const locked = new Set();
  normalizeObj(matchesObj).forEach((match) => {
    if (["blocked_pending_trade", "needs_review", "ready_to_score"].includes(match.scoringStatus)) {
      getMatchCountries(match).forEach((country) => locked.add(country));
    }
  });
  return locked;
}

function buildScoringEventsForFinalMatch(match, participants, lots, trades, options = {}) {
  const events = [];
  const matchId = match.id || `espn-${match.espnEventId}`;
  const source = options.source || "ESPN";
  const homeScore = Number(match.homeScore ?? 0);
  const awayScore = Number(match.awayScore ?? 0);
  const home = match.home;
  const away = match.away;
  const stage = match.stage || "Group Stage";
  const winner = options.winnerOverride || match.winnerCountry || "";

  const pushEvent = (country, type, points) => {
    const id = type === "groupStageDraw"
      ? scoringEventId([matchId, country, type])
      : scoringEventId([matchId, country, type]);
    events.push({
      id,
      matchId,
      espnEventId: match.espnEventId || "",
      type,
      country,
      points: Number(points),
      source,
      stage,
      label: `${country} ${type}`,
      status: "active",
      active: true,
      createdAt: Date.now(),
      allocations: createHistoricalCountryAllocations(country, Number(points), participants, lots, trades, Number(match.finalObservedAt || match.scoredAt || match.lastSyncedAt || Date.now()))
    });
  };

  if (stage === "Group Stage") {
    if (homeScore > awayScore) pushEvent(home, "groupStageWin", GROUP_STAGE_WIN_POINTS);
    else if (awayScore > homeScore) pushEvent(away, "groupStageWin", GROUP_STAGE_WIN_POINTS);
    else {
      pushEvent(home, "groupStageDraw", GROUP_STAGE_DRAW_POINTS);
      pushEvent(away, "groupStageDraw", GROUP_STAGE_DRAW_POINTS);
    }
    return events;
  }

  if (isKnockoutStage(stage) && winner) {
    const eventType = `${eventSafeId(stage)}Win`;
    pushEvent(winner, eventType, KNOCKOUT_POINTS[stage]);
  }
  return events;
}

function evaluateFinalMatchForScoring(match, context, options = {}) {
  const { participants, lots, trades, scoringEventsObj } = context;
  const matchId = match.id || `espn-${match.espnEventId}`;
  if (match.statusType !== "final" && !match.completed) return { updates: {}, status: "not_final" };
  const countries = getMatchCountries(match);
  if (countries.length < 2) {
    return {
      updates: { [`matches/${matchId}/scoringStatus`]: "needs_review", [`matches/${matchId}/scoringWarning`]: "Match has placeholder or unmapped teams." },
      status: "needs_review"
    };
  }
  const alreadyScored = normalizeObj(scoringEventsObj).some((event) => isActiveScoringEvent(event) && event.matchId === matchId);
  if (alreadyScored && !options.forceRescore) return { updates: { [`matches/${matchId}/scoringStatus`]: "scored" }, status: "already_scored" };

  const pendingTrades = options.ignoreTradeBlocks ? [] : getPendingAdminTradesForMatch(match, trades);
  if (pendingTrades.length) {
    return {
      updates: {
        [`matches/${matchId}/scoringStatus`]: "blocked_pending_trade",
        [`matches/${matchId}/scoringBlockReason`]: `${pendingTrades.length} accepted trade${pendingTrades.length === 1 ? "" : "s"} involving this match must be approved or rejected first.`,
        [`matches/${matchId}/lockedCountries`]: countries
      },
      status: "blocked_pending_trade"
    };
  }

  const tied = Number(match.homeScore ?? 0) === Number(match.awayScore ?? 0);
  if (isKnockoutStage(match.stage) && tied && !(options.winnerOverride || match.winnerCountry)) {
    return {
      updates: {
        [`matches/${matchId}/scoringStatus`]: "needs_review",
        [`matches/${matchId}/scoringWarning`]: "Knockout match ended tied and no ESPN winner was detected. Review before scoring.",
        [`matches/${matchId}/lockedCountries`]: countries
      },
      status: "needs_review"
    };
  }

  const events = buildScoringEventsForFinalMatch(match, participants, lots, trades, options);
  const updates = {};
  const newEventIds = new Set(events.map((event) => event.id));
  if (options.forceRescore) {
    normalizeObj(scoringEventsObj)
      .filter((event) => event.matchId === matchId && isActiveScoringEvent(event) && !newEventIds.has(event.id))
      .forEach((event) => {
        updates[`scoringEvents/${event.id}`] = {
          ...event,
          status: "voided",
          active: false,
          voidedAt: Date.now(),
          voidReason: "Admin result override"
        };
      });
  }
  events.forEach((event) => {
    if (!options.forceRescore && scoringEventsObj?.[event.id] && isActiveScoringEvent(scoringEventsObj[event.id])) return;
    updates[`scoringEvents/${event.id}`] = event;
  });
  updates[`matches/${matchId}/scoringStatus`] = "scored";
  updates[`matches/${matchId}/scoredAt`] = Date.now();
  updates[`matches/${matchId}/scoringWarning`] = "";
  updates[`matches/${matchId}/scoringBlockReason`] = "";
  updates[`matches/${matchId}/lockedCountries`] = null;
  return { updates, status: "scored", events };
}

function reconcileBonusEvents({ type, selectedCountries, points, source, currentEventsObj }) {
  const selected = new Set(selectedCountries.filter(isRealAppCountry));
  const updates = {};
  const prefix = `${type}_`;
  APP_COUNTRY_NAMES.forEach((country) => {
    const id = scoringEventId([type, country]);
    const existing = currentEventsObj?.[id];
    if (selected.has(country)) {
      if (existing && isActiveScoringEvent(existing)) {
        updates[`scoringEvents/${id}/source`] = source;
        updates[`scoringEvents/${id}/manualLocked`] = source === "manual";
        updates[`scoringEvents/${id}/updatedAt`] = Date.now();
      } else {
        updates[`scoringEvents/${id}`] = {
          id,
          type,
          country,
          points,
          source,
          status: "active",
          active: true,
          manualLocked: source === "manual",
          createdAt: Date.now(),
          allocations: null
        };
      }
    } else if (existing && existing.type === type && isActiveScoringEvent(existing)) {
      updates[`scoringEvents/${id}/status`] = "voided";
      updates[`scoringEvents/${id}/active`] = false;
      updates[`scoringEvents/${id}/voidedAt`] = Date.now();
      updates[`scoringEvents/${id}/voidReason`] = `${source} override removed ${type}`;
    }
  });
  return updates;
}

function fillBonusAllocationsInUpdates(updates, participants, lots) {
  Object.entries(updates).forEach(([path, value]) => {
    if (!path.startsWith("scoringEvents/") || !value || typeof value !== "object" || !value.country) return;
    if (value.allocations === null) value.allocations = createCountryAllocations(value.country, Number(value.points || 0), participants, lots);
  });
  return updates;
}

function detectAdvancedTeamsFromMatches(matchesObj) {
  const advanced = new Set();
  normalizeObj(matchesObj).forEach((match) => {
    if (match.stage !== "Round of 32") return;
    getMatchCountries(match).forEach((country) => advanced.add(country));
  });
  return [...advanced].sort((a, b) => a.localeCompare(b));
}

function getLotShareForParticipant(lot, participantId) {
  return Number(getLotShares(lot)[participantId] || 0);
}

function getLotPointsForParticipant(lot, participantId) {
  const share = getLotShareForParticipant(lot, participantId);
  return Number(lot?.points || 0) * (share / 100);
}

function deriveStats(participantsObj, scheduleObj, creditAdjustmentsObj = {}, scoringEventsObj = {}) {
  const participants = normalizeObj(participantsObj)
    .map((p) => ({
      ...p,
      auctionSpent: 0,
      tradeCreditNet: 0,
      spent: 0,
      remaining: p.startingCredits ?? STARTING_CREDITS,
      points: 0,
      profit: 0,
      holdings: [],
      historicalPointsByCountry: {}
    }))
    .sort((a, b) => (a.name || "").localeCompare(b.name || ""));

  const byId = Object.fromEntries(participants.map((p) => [p.id, p]));
  const lots = normalizeObj(scheduleObj).sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
  const creditAdjustments = normalizeObj(creditAdjustmentsObj);
  const activeEvents = normalizeObj(scoringEventsObj).filter(isActiveScoringEvent);
  const eventPointsByCountry = {};

  activeEvents.forEach((event) => {
    if (!event.country) return;
    eventPointsByCountry[event.country] = Number(eventPointsByCountry[event.country] || 0) + Number(event.points || 0);
    Object.entries(event.allocations || {}).forEach(([participantId, allocation]) => {
      const participant = byId[participantId];
      if (!participant) return;
      const pts = Number(allocation?.points ?? allocation ?? 0);
      participant.points += pts;
      participant.historicalPointsByCountry[event.country] = Number(participant.historicalPointsByCountry[event.country] || 0) + pts;
    });
  });

  lots.forEach((lot) => {
    const totalCountryPoints = Number(lot.points || 0) + Number(eventPointsByCountry[lot.country] || 0);
    lot.totalPoints = totalCountryPoints;

    if (lot.status !== "sold") return;

    const shares = getLotShares(lot);
    Object.entries(shares).forEach(([participantId, share]) => {
      const participant = byId[participantId];
      if (!participant || Number(share || 0) <= 0) return;

      const legacyPoints = Number(lot?.points || 0) * (Number(share || 0) / 100);
      const historicalPoints = Number(participant.historicalPointsByCountry[lot.country] || 0);
      const points = legacyPoints + historicalPoints;
      const auctionCost = lot.winningParticipantId === participantId ? Number(lot.finalPrice || 0) : 0;
      participant.auctionSpent += auctionCost;
      participant.points += legacyPoints;
      participant.holdings.push({ ...lot, points: totalCountryPoints, share: Number(share), ownerPoints: points, ownerCost: auctionCost });
    });
  });

  creditAdjustments.forEach((adj) => {
    const participant = byId[adj.participantId];
    if (!participant) return;
    participant.tradeCreditNet += Number(adj.amount || 0);
  });

  participants.forEach((p) => {
    p.remaining = Number(p.startingCredits ?? STARTING_CREDITS) - Number(p.auctionSpent || 0) + Number(p.tradeCreditNet || 0);
    p.spent = Number(p.startingCredits ?? STARTING_CREDITS) - Number(p.remaining || 0);
    p.profit = Number(p.points || 0) - Number(p.spent || 0);
  });

  return { participants, lots, creditAdjustments, activeEvents };
}

function Login({ onLogin, participantsObj }) {
  const participants = useMemo(() => normalizeObj(participantsObj)
    .sort((a, b) => {
      if (a.id === "admin") return -1;
      if (b.id === "admin") return 1;
      return (a.name || "").localeCompare(b.name || "");
    }), [participantsObj]);
  const savedName = localStorage.getItem("wcpc_username") || "";
  const savedId = slug(savedName);
  const firstId = participants[0]?.id || "";
  const [selectedId, setSelectedId] = useState(participants.find((p) => p.id === savedId)?.id || firstId);

  useEffect(() => {
    if (!selectedId && firstId) setSelectedId(firstId);
  }, [firstId, selectedId]);

  function submit(e) {
    e.preventDefault();
    const participant = participants.find((p) => p.id === selectedId);
    if (!participant) return;
    localStorage.setItem("wcpc_username", participant.name);
    onLogin({ id: participant.id, name: participant.name, role: participant.role || "participant" });
  }

  function adminBootstrap() {
    const participant = { id: "admin", name: "admin", role: "admin" };
    localStorage.setItem("wcpc_username", participant.name);
    onLogin(participant);
  }

  return (
    <div className="container">
      <div className="card login">
        <p className="eyebrow">Welcome</p>
        <h1>World Cup 2026 Portfolio Challenge</h1>
        <p className="muted">Select your name from the league participant list. No password required.</p>

        {participants.length ? (
          <form onSubmit={submit} className="login-select-form">
            <label className="field-label">Choose your name</label>
            <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
              {participants.map((p) => (
                <option key={p.id} value={p.id}>{p.name}{p.id === "admin" ? " (commissioner)" : ""}</option>
              ))}
            </select>
            <button>Enter</button>
          </form>
        ) : (
          <div className="notice">
            <b>No participant list loaded yet.</b><br />If this is the first setup, the commissioner can enter as admin to initialize the league.
            <div style={{ marginTop: 10 }}><button onClick={adminBootstrap}>Commissioner admin access</button></div>
          </div>
        )}

        <div className="welcome-summary compact-summary">
          <h3>How it works</h3>
          <p>Participants use fictional credits to buy World Cup countries in a live auction. Countries earn points from their actual World Cup performance. The winner is the participant with the highest profit.</p>
          <p><b>Profit = Points Earned − Net Credits Spent.</b> Credits received in trades reduce net credits spent; credits sent increase net credits spent.</p>
        </div>
      </div>
    </div>
  );
}

function Header({ page, setPage, user, onLogout, isAdmin }) {
  const items = [
    ["welcome", "Home", BookOpen],
    ["auction", "Auction", Gavel],
    ["schedule", "Auction Schedule", ListChecks],
    ["matches", "Matches", CalendarDays],
    ["portfolio", "Portfolios", Wallet],
    ["ownership", "Ownership", Users],
    ["leaderboard", "Leaderboard", BarChart3],
    ["scoring", "Scoring Log", History],
    ["trading", "Trading", ArrowLeftRight],
    ...(isAdmin ? [["admin", "Admin", Settings]] : [])
  ];

  return (
    <div className="header">
      <div className="brand">
        <h1>World Cup 2026 Portfolio Challenge</h1>
        <p>{isAdmin ? "Commissioner" : "Participant"} · Username: {user.name}</p>
      </div>
      <div className="nav">
        {items.map(([key, label, Icon]) => (
          <button key={key} className={page === key ? "active" : ""} onClick={() => setPage(key)}>
            <Icon size={15} /> {label}
          </button>
        ))}
        <button onClick={onLogout} className="secondary"><User size={15} /> Logout</button>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, tone = "" }) {
  return (
    <div className={`kpi ${tone}`}>
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {sub && <div className="subvalue">{sub}</div>}
    </div>
  );
}

function Welcome({ participantsObj, scheduleObj, creditAdjustmentsObj, matchesObj, syncMetaObj, scoringEventsObj, tradesObj }) {
  const { participants } = useMemo(() => deriveStats(participantsObj, scheduleObj, creditAdjustmentsObj, scoringEventsObj), [participantsObj, scheduleObj, creditAdjustmentsObj, scoringEventsObj]);
  const ranked = [...participants].filter((p) => p.id !== "admin").sort((a, b) => Number(b.profit || 0) - Number(a.profit || 0));
  const leader = ranked[0];
  const matches = useMemo(() => getActiveMatches(matchesObj), [matchesObj]);
  const sections = splitMatchesForDisplay(matches);
  const todayMatch = sections.find((section) => section.key === "today")?.matches?.[0];
  const nextMatch = todayMatch || sections.find((section) => section.key === "upcoming")?.matches?.[0];
  const liveMatch = matches.find((m) => m.statusType === "live");
  const recentEvent = lastScoringEvent(scoringEventsObj);
  const pendingAdminActions = normalizeObj(tradesObj).filter((t) => t.status === "accepted").length + normalizeObj(matchesObj).filter((m) => (m.statusType === "final" || m.completed) && m.scoringStatus && m.scoringStatus !== "scored").length;
  const lastSyncAt = Number(syncMetaObj?.lastMatchSyncAt || syncMetaObj?.lastScheduleSyncAt || 0);

  return (
    <div className="container grid">
      <div className="card page-title welcome-hero-card home-hero-card">
        <p className="eyebrow">Live dashboard</p>
        <h2>World Cup 2026 Portfolio Challenge</h2>
        <p className="muted">Live standings, match flow, scoring events, and portfolio updates in one place.</p>
      </div>

      <div className="dashboard-grid">
        <StatCard label="Current Leader" value={leader ? leader.name : "—"} sub={leader ? `Profit ${money(leader.profit)} · Points ${money(leader.points)}` : "No leaderboard yet"} tone="leader" />
        <StatCard label="Live Match" value={liveMatch ? `${liveMatch.home} ${scoreText(liveMatch)} ${liveMatch.away}` : "No live match"} sub={liveMatch ? `${liveMatch.statusDisplay || "Live"} · ${liveMatch.stage || "Group Stage"}` : "Refresh ESPN match data on the Matches tab"} tone={liveMatch ? "live" : ""} />
        <StatCard label="Next Match" value={nextMatch ? `${nextMatch.home} vs ${nextMatch.away}` : "—"} sub={nextMatch ? `${nextMatch.displayDate || fmtDate(nextMatch.dateTime)} · ${nextMatch.time || fmtTime(nextMatch.dateTime)}` : "No upcoming matches loaded"} />
        <StatCard label="Last Scoring Event" value={recentEvent ? `${recentEvent.country} +${money(recentEvent.points)}` : "—"} sub={recentEvent ? `${eventDisplayType(recentEvent.type)} · ${recentEvent.source || "Ledger"}` : "No scoring events yet"} tone={recentEvent ? "positive" : ""} />
      </div>

      <div className="grid two">
        <div className="card">
          <h3>Match center status</h3>
          <div className="mini-grid dashboard-mini-grid">
            <span>Last ESPN sync</span><b>{lastSyncAt ? `${new Date(lastSyncAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} by ${syncMetaObj?.lastMatchSyncByName || "admin"}` : "Not synced yet"}</b>
            <span>Admin actions</span><b>{pendingAdminActions}</b>
            <span>Today’s games</span><b>{sections.find((s) => s.key === "today")?.matches.length || 0}</b>
            <span>Completed games</span><b>{sections.find((s) => s.key === "completed")?.matches.length || 0}</b>
          </div>
        </div>

        <div className="card">
          <h3>Rules & scoring</h3>
          <details open>
            <summary>Core format</summary>
            <p className="muted">Each participant started with 45 credits. Profit = points earned − net credits spent. Credits received in trades reduce net credits spent; credits sent increase it.</p>
          </details>
          <details>
            <summary>Scoring table</summary>
            <div className="mini-grid rules-mini-grid">
              <span>Group Stage Win</span><b>3</b>
              <span>Group Stage Draw</span><b>1</b>
              <span>Advance from Group</span><b>3</b>
              <span>Win Group</span><b>3</b>
              <span>Round of 32 Win</span><b>5</b>
              <span>Round of 16 Win</span><b>9</b>
              <span>Quarterfinal Win</span><b>15</b>
              <span>Semifinal Win</span><b>22</b>
              <span>Final Win</span><b>34</b>
            </div>
          </details>
          <details>
            <summary>Trading</summary>
            <p className="muted">Country shares can be traded in 1% increments. Accepted trades require final admin approval before they are executed.</p>
          </details>
        </div>
      </div>
    </div>
  );
}

function Auction({ user, isAdmin, participantsObj, scheduleObj, creditAdjustmentsObj, auctionState, scoringEventsObj }) {
  const now = useNow();
  const { participants, lots } = useMemo(() => deriveStats(participantsObj, scheduleObj, creditAdjustmentsObj, scoringEventsObj), [participantsObj, scheduleObj, creditAdjustmentsObj, scoringEventsObj]);
  const me = participants.find((p) => p.id === user.id) || { remaining: STARTING_CREDITS, spent: 0, holdings: [] };

  const activeLotId = auctionState?.currentLotId || lots.find((l) => l.status === "live")?.id || "";
  const currentLot = activeLotId
    ? lots.find((l) => l.id === activeLotId)
    : lots.find((l) => l.status === "upcoming");

  const [bid, setBid] = useState(1);
  const [bidsObj] = useFirebaseValue(currentLot ? `bids/${currentLot.id}` : "bids/none", {});
  const bids = useMemo(() => normalizeObj(bidsObj).sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0)), [bidsObj]);
  const currentHigh = useMemo(() => {
    return bids
      .filter((b) => b.isValid !== false)
      .sort((a, b) => Number(b.amount) - Number(a.amount) || Number(a.createdAt || 0) - Number(b.createdAt || 0))[0];
  }, [bids]);

  const auctionStatus = auctionState?.currentLotId === currentLot?.id ? auctionState?.status : currentLot?.status;
  const secondsLeft = auctionStatus === "paused"
    ? Number(auctionState?.remainingWhenPaused || TIMER_SECONDS)
    : currentLot?.status === "live" && auctionState?.endAt
      ? Math.max(0, Math.ceil((Number(auctionState.endAt) - now) / 1000))
      : TIMER_SECONDS;
  const minBid = Math.max(1, Number(currentHigh?.amount || 0) + 1);
  const bidNumber = Number(bid || 0);
  const canBid = currentLot?.status === "live" && auctionStatus === "live" && bidNumber >= minBid && bidNumber <= Number(me.remaining || 0) && currentHigh?.participantId !== user.id;
  const nextLots = lots.filter((l) => l.status === "upcoming" && l.id !== currentLot?.id).slice(0, 6);
  const soldLots = lots.filter((l) => l.status === "sold").slice(-6).reverse();

  useEffect(() => {
    if (bidNumber < minBid) setBid(minBid);
  }, [minBid]);

  async function placeBid(amountOverride = null) {
    const amount = Number(amountOverride ?? bid);
    if (!(currentLot?.status === "live" && auctionStatus === "live")) return;
    if (amount < minBid) return alert(`Bid must be at least ${minBid}.`);
    if (amount > Number(me.remaining || 0)) return alert(`You only have ${money(me.remaining)} credits remaining.`);
    if (currentHigh?.participantId === user.id) return alert("You are already the high bidder.");

    const bidRef = push(dbPath(`bids/${currentLot.id}`));
    await set(bidRef, {
      id: bidRef.key,
      participantId: user.id,
      participantName: user.name,
      amount,
      createdAt: Date.now(),
      isValid: true
    });
    setBid(amount + 1);
  }

  async function startLot(lotId) {
    const lot = lots.find((l) => l.id === lotId);
    if (!lot) return;
    const start = Date.now();
    await update(dbPath(`schedule/${lotId}`), { status: "live", actualStartAt: start });
    await update(dbPath("auctionState"), {
      currentLotId: lotId,
      status: "live",
      startedAt: start,
      endAt: start + TIMER_SECONDS * 1000,
      remainingWhenPaused: null
    });
  }

  async function pauseResume() {
    if (!currentLot) return;
    if (auctionState?.status === "paused") {
      await update(dbPath("auctionState"), {
        status: "live",
        endAt: Date.now() + Number(auctionState.remainingWhenPaused || TIMER_SECONDS) * 1000,
        remainingWhenPaused: null
      });
    } else {
      await update(dbPath("auctionState"), { status: "paused", remainingWhenPaused: secondsLeft });
    }
  }

  async function sellLot() {
    if (!currentLot || !currentHigh) return alert("No valid bid to sell.");
    const price = Number(currentHigh.amount);
    const winner = participants.find((p) => p.id === currentHigh.participantId);
    if (!winner || price > Number(winner.remaining || 0)) return alert("Winning bidder no longer has enough credits. Reopen bidding.");

    await update(dbPath(`schedule/${currentLot.id}`), {
      status: "sold",
      winningParticipantId: currentHigh.participantId,
      winningBidder: currentHigh.participantName,
      finalPrice: price,
      soldAt: Date.now(),
      shares: { [currentHigh.participantId]: 100 }
    });
    await update(dbPath("auctionState"), { status: "idle", currentLotId: "", endAt: 0, remainingWhenPaused: null });
  }

  async function skipLot() {
    if (!currentLot) return;
    await update(dbPath(`schedule/${currentLot.id}`), { status: "skipped" });
    await update(dbPath("auctionState"), { status: "idle", currentLotId: "", endAt: 0, remainingWhenPaused: null });
  }

  return (
    <div className="container auction-layout">
      <section className="card current-lot-card">
        <div className="space top-wrap">
          <div>
            <p className="eyebrow">Live auction room</p>
            <h2>{currentLot ? currentLot.country : "No lots loaded yet"}</h2>
            {currentLot && <p className="muted">Auction pick #{currentLot.order} · ESPN rank #{currentLot.rank} · Scheduled {fmtTime(currentLot.scheduledAt)}</p>}
          </div>
          {currentLot && <span className={`badge ${auctionStatus}`}>{auctionStatus || currentLot.status}</span>}
        </div>

        {currentLot ? (
          <>
            <div className="auction-hero">
              <StatCard label="Time left" value={formatTimer(secondsLeft)} sub={auctionStatus === "paused" ? "Paused" : "5-minute lot"} tone="timer" />
              <StatCard label="High bid" value={currentHigh ? `${currentHigh.amount}` : "—"} sub={currentHigh ? currentHigh.participantName : "No bids yet"} />
              <StatCard label="Your credits" value={money(me.remaining)} sub={`Max bid allowed: ${money(me.remaining)}`} />
            </div>

            <div className="bid-panel">
              <div className="bid-input-row">
                <input type="number" min={minBid} max={me.remaining} value={bid} onChange={(e) => setBid(e.target.value)} />
                <button onClick={() => placeBid()} disabled={!canBid}>Place bid</button>
              </div>
              <div className="quick-bids">
                <button className="secondary" onClick={() => setBid(minBid)} disabled={minBid > me.remaining}>Min {minBid}</button>
                <button className="secondary" onClick={() => setBid(Number(currentHigh?.amount || 0) + 2)} disabled={Number(currentHigh?.amount || 0) + 2 > me.remaining}>+2</button>
                <button className="secondary" onClick={() => setBid(Number(currentHigh?.amount || 0) + 5)} disabled={Number(currentHigh?.amount || 0) + 5 > me.remaining}>+5</button>
                <button className="secondary" onClick={() => setBid(me.remaining)} disabled={me.remaining < minBid}>Max {money(me.remaining)}</button>
              </div>
              {currentLot.status !== "live" && <p className="muted">This lot has not started yet. The commissioner must start the auction window.</p>}
              {currentLot.status === "live" && auctionStatus === "paused" && <p className="muted">Bidding is paused. Wait for the commissioner to resume.</p>}
              {currentLot.status === "live" && auctionStatus === "live" && !canBid && (
                <p className="muted">Your bid must be at least {minBid}, cannot exceed {money(me.remaining)}, and you cannot bid against yourself.</p>
              )}
            </div>

            {isAdmin && (
              <div className="card adminOnly compact-admin">
                <b>Commissioner controls</b>
                <div className="row" style={{ marginTop: 10 }}>
                  {currentLot.status !== "live" && currentLot.status !== "sold" && <button onClick={() => startLot(currentLot.id)}>Start lot</button>}
                  {currentLot.status === "live" && <button onClick={sellLot}>Sell to high bidder</button>}
                  {currentLot.status === "live" && <button className="secondary" onClick={pauseResume}>{auctionState?.status === "paused" ? "Resume" : "Pause"}</button>}
                  {currentLot.status !== "sold" && <button className="danger" onClick={skipLot}>Skip</button>}
                </div>
              </div>
            )}
          </>
        ) : (
          <p className="muted">No auction schedule exists yet. The commissioner should initialize the auction schedule from Admin.</p>
        )}
      </section>

      <aside className="auction-side grid">
        <div className="card">
          <h3>Recent bids</h3>
          {bids.length ? (
            <div className="stack-list">
              {bids.slice(0, 8).map((b) => (
                <div className="list-row" key={b.id}>
                  <span><b>{b.participantName}</b><small>{new Date(b.createdAt).toLocaleTimeString()}</small></span>
                  <strong>{b.amount}</strong>
                </div>
              ))}
            </div>
          ) : <p className="muted">No bids yet.</p>}
        </div>

        <div className="card">
          <h3>Coming up</h3>
          {nextLots.length ? (
            <div className="stack-list">
              {nextLots.map((l) => (
                <div className="list-row" key={l.id}>
                  <span><b>#{l.rank} {l.country}</b><small>Pick {l.order} · {fmtTime(l.scheduledAt)}</small></span>
                </div>
              ))}
            </div>
          ) : <p className="muted">No upcoming countries.</p>}
        </div>

        <div className="card">
          <h3>Recently sold</h3>
          {soldLots.length ? (
            <div className="stack-list">
              {soldLots.map((l) => (
                <div className="list-row" key={l.id}>
                  <span><b>{l.country}</b><small>{l.winningBidder}</small></span>
                  <strong>{money(l.finalPrice)}</strong>
                </div>
              ))}
            </div>
          ) : <p className="muted">No countries sold yet.</p>}
        </div>
      </aside>
    </div>
  );
}

function AuctionSchedule({ scheduleObj, scoringEventsObj }) {
  const { lots } = useMemo(() => deriveStats({}, scheduleObj, {}, scoringEventsObj), [scheduleObj, scoringEventsObj]);

  return (
    <div className="container grid">
      <div className="card page-title">
        <p className="eyebrow">Draft plan</p>
        <h2>Auction Schedule</h2>
        <p className="muted">Country auction order, scheduled time, ESPN rank, sale winner, and final price.</p>
      </div>
      <div className="card table-card">
        {lots.length ? (
          <>
            <table className="desktop-table">
              <thead><tr><th>Order</th><th>Time</th><th>ESPN Rank</th><th>Country</th><th>Status</th><th>Winner</th><th>Price</th><th>Points</th></tr></thead>
              <tbody>{lots.map((l) => <tr key={l.id}><td>{l.order}</td><td>{fmtTime(l.scheduledAt)}</td><td>{l.rank}</td><td><b>{l.country}</b></td><td><span className={`badge ${l.status}`}>{l.status}</span></td><td>{l.winningBidder || "—"}</td><td>{l.finalPrice || "—"}</td><td>{money(l.totalPoints || l.points || 0)}</td></tr>)}</tbody>
            </table>
            <div className="mobile-cards">
              {lots.map((l) => (
                <div className="mini-card" key={l.id}>
                  <div className="space"><b>{l.order}. {l.country}</b><span className={`badge ${l.status}`}>{l.status}</span></div>
                  <div className="mini-grid"><span>Time</span><b>{fmtTime(l.scheduledAt)}</b><span>ESPN Rank</span><b>#{l.rank}</b><span>Winner</span><b>{l.winningBidder || "—"}</b><span>Price</span><b>{l.finalPrice || "—"}</b></div>
                </div>
              ))}
            </div>
          </>
        ) : <p className="muted">No auction schedule loaded yet.</p>}
      </div>
    </div>
  );
}

function Matches({ user, participantsObj, scheduleObj, creditAdjustmentsObj, tradesObj, matchesObj, syncMetaObj, scoringEventsObj, settingsObj }) {
  const { participants, lots } = useMemo(() => deriveStats(participantsObj, scheduleObj, creditAdjustmentsObj, scoringEventsObj), [participantsObj, scheduleObj, creditAdjustmentsObj, scoringEventsObj]);
  const trades = useMemo(() => normalizeObj(tradesObj), [tradesObj]);
  const matches = useMemo(() => getActiveMatches(matchesObj), [matchesObj]);
  const usingImported = normalizeObj(matchesObj).length > 0;
  const matchSections = useMemo(() => splitMatchesForDisplay(matches), [matches]);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");
  const now = useNow(1000);
  const lastSyncAt = Number(syncMetaObj?.lastMatchSyncAt || syncMetaObj?.lastScheduleSyncAt || 0);
  const cooldownUntil = lastSyncAt + REFRESH_COOLDOWN_MS;
  const cooldownRemaining = Math.max(0, Math.ceil((cooldownUntil - now) / 1000));
  const refreshDisabled = syncing || cooldownRemaining > 0;

  async function refreshEspnMatchData() {
    if (refreshDisabled) return;
    setSyncing(true);
    setSyncMessage("");
    try {
      const response = await fetch("/api/espn-schedule");
      if (!response.ok) throw new Error(`ESPN refresh failed with HTTP ${response.status}`);
      const payload = await response.json();
      const imported = Array.isArray(payload.matches) ? payload.matches : [];
      if (!imported.length) throw new Error("No matches returned from ESPN.");

      const updates = {};
      const mergedMatches = {};
      const refreshedAt = Date.now();

      imported.forEach((match) => {
        const existing = matchesObj?.[match.id] || {};
        const finalObservedAt = match.statusType === "final"
          ? (existing.finalObservedAt || refreshedAt)
          : null;
        const merged = {
          ...existing,
          ...match,
          finalObservedAt,
          scoringStatus: existing.scoringStatus || "",
          scoringWarning: existing.scoringWarning || "",
          scoringBlockReason: existing.scoringBlockReason || "",
          lockedCountries: existing.lockedCountries || null,
          lastSyncedAt: refreshedAt
        };
        if (match.statusType !== "final") {
          merged.scoringStatus = "";
          merged.scoringWarning = "";
          merged.scoringBlockReason = "";
          merged.lockedCountries = null;
        }
        mergedMatches[match.id] = merged;
        updates[`matches/${match.id}`] = merged;
      });

      imported.forEach((rawMatch) => {
        const match = mergedMatches[rawMatch.id];
        if (match?.statusType !== "final" && !match?.completed) return;
        const result = evaluateFinalMatchForScoring(match, { participants, lots, trades, scoringEventsObj });
        Object.assign(updates, result.updates);
      });

      if (!settingsObj?.advancedManualOverrideActive) {
        const advancedTeams = detectAdvancedTeamsFromMatches(mergedMatches);
        advancedTeams.forEach((country) => {
          const id = scoringEventId(["advanceFromGroup", country]);
          const existing = scoringEventsObj?.[id];
          if (existing && isActiveScoringEvent(existing)) return;
          updates[`scoringEvents/${id}`] = {
            id,
            type: "advanceFromGroup",
            country,
            points: ADVANCE_FROM_GROUP_POINTS,
            source: "auto",
            reason: "Detected in ESPN Round of 32 schedule",
            status: "active",
            active: true,
            createdAt: refreshedAt,
            allocations: createCountryAllocations(country, ADVANCE_FROM_GROUP_POINTS, participants, lots)
          };
        });
      }

      updates.syncMeta = {
        ...(syncMetaObj || {}),
        lastMatchSyncAt: refreshedAt,
        lastMatchSyncById: user.id,
        lastMatchSyncByName: user.name,
        lastScheduleSyncAt: refreshedAt,
        lastScheduleSyncSource: "ESPN",
        lastScheduleSyncCount: imported.length,
        unmatchedTeams: payload.unmatchedTeams || [],
        scheduleSyncError: ""
      };

      await update(leagueRoot(), collapseFirebaseUpdateConflicts(updates));
      setSyncMessage(`Refreshed ${imported.length} ESPN matches. Final matches were checked for scoring.`);
    } catch (err) {
      console.error(err);
      await update(dbPath("syncMeta"), { scheduleSyncError: String(err.message || err), lastScheduleSyncAttemptAt: Date.now() });
      setSyncMessage(`ESPN refresh failed: ${err.message || err}`);
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="container grid">
      <div className="card page-title">
        <p className="eyebrow">World Cup match center</p>
        <div className="space top-wrap">
          <div>
            <h2>Matches</h2>
            <p className="muted">Refresh ESPN match data from this tab. Any logged-in user can update the shared match table for everyone.</p>
          </div>
          <div className="refresh-panel">
            <button onClick={refreshEspnMatchData} disabled={refreshDisabled}><RefreshCw size={15}/> {syncing ? "Refreshing..." : "Refresh ESPN Match Data"}</button>
            <small>{lastSyncAt ? `Last synced: ${new Date(lastSyncAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} by ${syncMetaObj?.lastMatchSyncByName || "admin"}` : "Not synced yet"}</small>
            <small>{cooldownRemaining > 0 ? `Refresh available again in ${cooldownRemaining} seconds` : "Refresh available now"}</small>
          </div>
        </div>
        <div className="sync-meta-row">
          <span className={`badge ${usingImported ? "positive" : "neutral"}`}>{usingImported ? "Using synced ESPN data" : "Using seeded schedule"}</span>
          {syncMessage && <span className={syncMessage.includes("failed") ? "badge dangerish" : "badge positive"}>{syncMessage}</span>}
          {syncMetaObj?.scheduleSyncError && <span className="badge dangerish">Last sync warning</span>}
        </div>
      </div>

      {syncMetaObj?.unmatchedTeams?.length > 0 && (
        <div className="card warning-card">
          <h3><AlertTriangle size={18}/> ESPN team mapping warnings</h3>
          <p className="muted">These ESPN team names did not cleanly map to app countries. Review before using imported data for scoring.</p>
          <div className="tag-row">{syncMetaObj.unmatchedTeams.map((team) => <span className="badge neutral" key={team}>{team}</span>)}</div>
        </div>
      )}

      <div className="grid match-section-list">
        {matchSections.map((section) => (
          <div className="card match-section-card" key={section.key}>
            <div className="space top-wrap">
              <div>
                <h3>{section.title}</h3>
                <p className="muted small-text">{section.subtitle}</p>
              </div>
              <span className="badge neutral">{section.matches.length} match{section.matches.length === 1 ? "" : "es"}</span>
            </div>
            <div className="match-card-grid">
              {section.matches.map((m) => (
                <div className={`match-card ${m.statusType || "not_started"}`} key={m.id || m.espnEventId}>
                  <div className="match-card-top">
                    <span className="match-stage">{m.stage || "Group Stage"}</span>
                    <span className={`badge ${statusBadgeClass(m)}`}>{m.statusDisplay || "Not Started"}</span>
                  </div>
                  <div className="match-score-row">
                    <span className="team-name">{m.home}</span>
                    <b>{scoreText(m) === "—" ? "—" : String(scoreText(m)).split("–")[0]}</b>
                  </div>
                  <div className="match-score-row">
                    <span className="team-name">{m.away}</span>
                    <b>{scoreText(m) === "—" ? "—" : String(scoreText(m)).split("–")[1]}</b>
                  </div>
                  <div className="match-card-meta">
                    <span>{m.venue || "Venue TBD"}</span>
                    <span>{m.displayDate || fmtDate(m.dateTime)} · {m.time || fmtTime(m.dateTime)}</span>
                  </div>
                  <div className="match-card-footer">
                    {m.scoringStatus ? <span className={`badge ${m.scoringStatus === "scored" ? "positive" : "dangerish"}`}>Scoring: {m.scoringStatus.replaceAll("_", " ")}</span> : <span className="muted small-text">Scoring pending final result</span>}
                  </div>
                  {(m.scoringWarning || m.scoringBlockReason) && <p className="notice">{m.scoringWarning || m.scoringBlockReason}</p>}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}


function Portfolio({ user, participantsObj, scheduleObj, creditAdjustmentsObj, scoringEventsObj }) {
  const { participants, lots } = useMemo(() => deriveStats(participantsObj, scheduleObj, creditAdjustmentsObj, scoringEventsObj), [participantsObj, scheduleObj, creditAdjustmentsObj, scoringEventsObj]);
  const defaultId = participants.find((p) => p.id === user.id)?.id || participants[0]?.id || "";
  const [selectedId, setSelectedId] = useState(defaultId);

  useEffect(() => {
    if (!selectedId && defaultId) setSelectedId(defaultId);
  }, [defaultId, selectedId]);

  const selected = participants.find((p) => p.id === selectedId) || participants.find((p) => p.id === user.id) || { holdings: [], spent: 0, points: 0, profit: 0, remaining: STARTING_CREDITS, name: user.name };
  const soldCountries = lots.filter((l) => l.status === "sold");

  return (
    <div className="container grid">
      <div className="card page-title">
        <div className="space top-wrap">
          <div>
            <p className="eyebrow">Portfolio view</p>
            <h2>{selected.name}'s Portfolio</h2>
            <p className="muted">View each participant's country holdings, ownership share, auction cost, trade credit impact, points, and profit.</p>
          </div>
          <div className="selector-box">
            <label>Viewing</label>
            <select value={selected.id || ""} onChange={(e) => setSelectedId(e.target.value)}>
              {participants.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="grid four">
        <StatCard label="Points" value={money(selected.points)} />
        <StatCard label="Net credits spent" value={money(selected.spent)} sub={`Auction ${money(selected.auctionSpent)} · Trades ${selected.tradeCreditNet >= 0 ? "+" : ""}${money(selected.tradeCreditNet)}`} />
        <StatCard label="Remaining" value={money(selected.remaining)} />
        <StatCard label="Profit" value={money(selected.profit)} tone={selected.profit >= 0 ? "positive" : "negative"} />
      </div>

      <div className="card">
        <div className="space top-wrap"><h3>Holdings</h3><span className="badge neutral">{selected.holdings?.length || 0} countries</span></div>
        {selected.holdings?.length ? (
          <div className="portfolio-card-grid">
            {selected.holdings.map((l) => {
              const countryProfit = Number(l.ownerPoints || 0) - Number(l.ownerCost || 0);
              return (
                <div className="portfolio-card" key={l.id}>
                  <div className="space top-wrap">
                    <div><b>{l.country}</b><small>ESPN rank #{l.rank}</small></div>
                    <span className="badge neutral">{money(l.share)}%</span>
                  </div>
                  <div className="mini-grid">
                    <span>Points</span><b>{money(l.ownerPoints)}</b>
                    <span>Auction cost basis</span><b>{money(l.ownerCost)}</b>
                    <span>Country P/L</span><b className={countryProfit >= 0 ? "profit-positive" : "profit-negative"}>{money(countryProfit)}</b>
                    <span>Status</span><b>Active</b>
                  </div>
                </div>
              );
            })}
          </div>
        ) : <p className="muted">No countries yet.</p>}
      </div>

      <div className="card">
        <h3>Country ownership snapshot</h3>
        <p className="muted">Ownership updates when admin-approved trades are executed. Each country must always total 100% ownership.</p>
        {soldCountries.length ? (
          <div className="ownership-grid">
            {soldCountries.map((lot) => {
              const shares = getLotShares(lot);
              return (
                <div className="mini-card" key={lot.id}>
                  <b>{lot.country}</b>
                  <small>ESPN rank #{lot.rank}</small>
                  {Object.entries(shares).map(([participantId, share]) => {
                    const owner = participants.find((p) => p.id === participantId);
                    return <div className="ownership-line" key={participantId}><span>{owner?.name || participantId}</span><b>{money(share)}%</b></div>;
                  })}
                </div>
              );
            })}
          </div>
        ) : <p className="muted">No countries sold yet.</p>}
      </div>
    </div>
  );
}

function CountryOwnership({ participantsObj, scheduleObj, creditAdjustmentsObj, scoringEventsObj }) {
  const { participants, lots } = useMemo(() => deriveStats(participantsObj, scheduleObj, creditAdjustmentsObj, scoringEventsObj), [participantsObj, scheduleObj, creditAdjustmentsObj, scoringEventsObj]);
  const soldLots = lots.filter((l) => l.status === "sold").sort((a, b) => Number(a.rank || a.order || 0) - Number(b.rank || b.order || 0));

  return (
    <div className="container grid">
      <div className="card page-title">
        <p className="eyebrow">Country ownership</p>
        <h2>Ownership Snapshot</h2>
        <p className="muted">Every sold country should total 100% ownership. This page is the fastest way to confirm auction corrections and completed trades.</p>
      </div>
      <div className="card table-card">
        {soldLots.length ? (
          <>
            <table className="desktop-table">
              <thead><tr><th>ESPN Rank</th><th>Country</th><th>Owners</th><th>Auction Winner</th><th>Auction Price</th><th>Points</th></tr></thead>
              <tbody>{soldLots.map((lot) => {
                const shares = getLotShares(lot);
                const total = Object.values(shares).reduce((sum, share) => sum + Number(share || 0), 0);
                return <tr key={lot.id}><td>{lot.rank}</td><td><b>{lot.country}</b></td><td>{Object.entries(shares).map(([id, share]) => `${participantName(participants, id)} ${money(share)}%`).join(", ") || "—"} {Math.round(total) !== 100 && <span className="badge dangerish">Totals {money(total)}%</span>}</td><td>{lot.winningBidder || "—"}</td><td>{money(lot.finalPrice)}</td><td>{money(lot.totalPoints || lot.points)}</td></tr>;
              })}</tbody>
            </table>
            <div className="mobile-cards">
              {soldLots.map((lot) => {
                const shares = getLotShares(lot);
                const total = Object.values(shares).reduce((sum, share) => sum + Number(share || 0), 0);
                return <div className="mini-card" key={lot.id}>
                  <div className="space"><b>{lot.country}</b><span className="badge neutral">Rank #{lot.rank}</span></div>
                  <div className="ownership-lines">{Object.entries(shares).map(([id, share]) => <div className="ownership-line" key={id}><span>{participantName(participants, id)}</span><b>{money(share)}%</b></div>)}</div>
                  <div className="mini-grid"><span>Auction Winner</span><b>{lot.winningBidder || "—"}</b><span>Price</span><b>{money(lot.finalPrice)}</b><span>Points</span><b>{money(lot.totalPoints || lot.points)}</b></div>
                  {Math.round(total) !== 100 && <p className="notice">Ownership totals {money(total)}%.</p>}
                </div>;
              })}
            </div>
          </>
        ) : <p className="muted">No countries sold yet.</p>}
      </div>
    </div>
  );
}

function Leaderboard({ participantsObj, scheduleObj, creditAdjustmentsObj, scoringEventsObj }) {
  const { participants } = useMemo(() => deriveStats(participantsObj, scheduleObj, creditAdjustmentsObj, scoringEventsObj), [participantsObj, scheduleObj, creditAdjustmentsObj, scoringEventsObj]);
  const sorted = [...participants]
    .filter((p) => p.id !== "admin")
    .sort((a, b) => Number(b.profit || 0) - Number(a.profit || 0) || Number(b.points || 0) - Number(a.points || 0));

  return (
    <div className="container grid">
      <div className="card page-title">
        <p className="eyebrow">Standings · {sorted.length} participants</p>
        <h2>Leaderboard</h2>
        <p className="muted">Profit = points earned − net credits spent. Credits received in trades reduce net credits spent; credits sent in trades increase it. Commissioner admin is excluded from rankings.</p>
      </div>
      <div className="card table-card">
        <table className="desktop-table">
          <thead><tr><th>Rank</th><th>Participant</th><th>Profit</th><th>Points</th><th>Net Spent</th><th>Auction Spend</th><th>Trade Credits</th><th>Remaining</th><th>Holdings</th></tr></thead>
          <tbody>{sorted.map((p, i) => <tr key={p.id} className={i === 0 ? "leader-row" : ""}><td><span className={i === 0 ? "rank-pill leader" : "rank-pill"}>{i + 1}</span></td><td><b>{p.name}</b>{i === 0 && <span className="badge gold">Leader</span>}</td><td><b className={p.profit >= 0 ? "profit-positive" : "profit-negative"}>{money(p.profit)}</b></td><td>{money(p.points)}</td><td>{money(p.spent)}</td><td>{money(p.auctionSpent)}</td><td>{p.tradeCreditNet >= 0 ? "+" : ""}{money(p.tradeCreditNet)}</td><td>{money(p.remaining)}</td><td>{p.holdings.length}</td></tr>)}</tbody>
        </table>
        <div className="mobile-cards leaderboard-cards">
          {sorted.map((p, i) => (
            <div className="mini-card" key={p.id}>
              <div className="space"><b>#{i + 1} {p.name}</b><span className={`badge ${p.profit >= 0 ? "positive" : "negative"}`}>Profit {money(p.profit)}</span></div>
              <div className="mini-grid"><span>Points</span><b>{money(p.points)}</b><span>Net Spent</span><b>{money(p.spent)}</b><span>Auction Spend</span><b>{money(p.auctionSpent)}</b><span>Trade Credits</span><b>{p.tradeCreditNet >= 0 ? "+" : ""}{money(p.tradeCreditNet)}</b><span>Remaining</span><b>{money(p.remaining)}</b><span>Holdings</span><b>{p.holdings.length}</b></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TradeSummary({ trade, participants, lots }) {
  return <span>{summarizeTrade(trade, participants, lots)}</span>;
}

function summarizeTrade(trade, participants, lots) {
  const fromName = participants.find((p) => p.id === trade.fromParticipantId)?.name || trade.fromParticipantName || trade.fromParticipantId;
  const toName = participants.find((p) => p.id === trade.toParticipantId)?.name || trade.toParticipantName || trade.toParticipantId;
  const fromItems = [];
  const toItems = [];
  if (trade.fromCountryId && Number(trade.fromShare || 0) > 0) {
    const lot = lots.find((l) => l.id === trade.fromCountryId);
    fromItems.push(`${money(trade.fromShare)}% ${lot?.country || trade.fromCountryName || "country"}`);
  }
  if (Number(trade.fromCredits || 0) > 0) fromItems.push(`${money(trade.fromCredits)} credits`);
  if (trade.toCountryId && Number(trade.toShare || 0) > 0) {
    const lot = lots.find((l) => l.id === trade.toCountryId);
    toItems.push(`${money(trade.toShare)}% ${lot?.country || trade.toCountryName || "country"}`);
  }
  if (Number(trade.toCredits || 0) > 0) toItems.push(`${money(trade.toCredits)} credits`);
  return `${fromName} sends ${fromItems.join(" + ") || "nothing"} to ${toName}; ${toName} sends ${toItems.join(" + ") || "nothing"} to ${fromName}.`;
}

function validateTrade(trade, participants, lots, lockedCountryNames = new Set()) {
  const byId = Object.fromEntries(participants.map((p) => [p.id, p]));
  const from = byId[trade.fromParticipantId];
  const to = byId[trade.toParticipantId];
  if (!from || !to) return "Both participants must still exist.";
  if (from.id === to.id) return "You cannot trade with yourself.";

  const fromCredits = Number(trade.fromCredits || 0);
  const toCredits = Number(trade.toCredits || 0);
  const fromShare = Number(trade.fromShare || 0);
  const toShare = Number(trade.toShare || 0);

  if (fromCredits < 0 || toCredits < 0 || fromShare < 0 || toShare < 0) return "Credits and shares cannot be negative.";
  if (fromCredits > 0 && toCredits > 0) return "Credits can only move in one direction within a trade. Use one net credit payment.";
  if (fromCredits > Number(from.remaining || 0)) return `${from.name} does not have enough remaining credits.`;
  if (toCredits > Number(to.remaining || 0)) return `${to.name} does not have enough remaining credits.`;

  if (!trade.fromCountryId && fromShare > 0) return "Sender share selected without a country.";
  if (!trade.toCountryId && toShare > 0) return "Receiver share selected without a country.";
  if (trade.fromCountryId && fromShare <= 0) return "Enter a share percentage for the country being sent.";
  if (trade.toCountryId && toShare <= 0) return "Enter a share percentage for the country being received.";

  const fromHasSomething = Boolean(trade.fromCountryId && fromShare > 0) || fromCredits > 0;
  const toHasSomething = Boolean(trade.toCountryId && toShare > 0) || toCredits > 0;
  if (!fromHasSomething || !toHasSomething) return "Each side must send at least one item: country share and/or credits.";

  if (trade.fromCountryId && trade.toCountryId && trade.fromCountryId === trade.toCountryId) return "Do not send the same country in both directions. Use one net country-share transfer instead.";

  if (trade.fromCountryId) {
    const lot = lots.find((l) => l.id === trade.fromCountryId);
    if (!lot || lot.status !== "sold") return "Sender country must be a sold country.";
    if (lockedCountryNames.has(lot.country)) return `${lot.country} trading is temporarily suspended while match points are pending.`;
    const owned = getLotShareForParticipant(lot, from.id);
    if (fromShare > owned) return `${from.name} only owns ${money(owned)}% of ${lot.country}.`;
  }
  if (trade.toCountryId) {
    const lot = lots.find((l) => l.id === trade.toCountryId);
    if (!lot || lot.status !== "sold") return "Receiver country must be a sold country.";
    if (lockedCountryNames.has(lot.country)) return `${lot.country} trading is temporarily suspended while match points are pending.`;
    const owned = getLotShareForParticipant(lot, to.id);
    if (toShare > owned) return `${to.name} only owns ${money(owned)}% of ${lot.country}.`;
  }

  return null;
}

function Trading({ user, isAdmin, participantsObj, scheduleObj, creditAdjustmentsObj, tradesObj, settingsObj, matchesObj, scoringEventsObj }) {
  const { participants, lots } = useMemo(() => deriveStats(participantsObj, scheduleObj, creditAdjustmentsObj, scoringEventsObj), [participantsObj, scheduleObj, creditAdjustmentsObj, scoringEventsObj]);
  const trades = useMemo(() => normalizeObj(tradesObj).sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0)), [tradesObj]);
  const me = participants.find((p) => p.id === user.id) || { id: user.id, name: user.name, remaining: STARTING_CREDITS, holdings: [] };
  const tradingOpen = settingsObj?.tradingOpen !== false;
  const tradeableParticipants = participants.filter((p) => p.id !== user.id && p.id !== "admin");
  const defaultCounterparty = tradeableParticipants[0]?.id || "";

  const [counterpartyId, setCounterpartyId] = useState(defaultCounterparty);
  const [fromCountryId, setFromCountryId] = useState("");
  const [fromShare, setFromShare] = useState(0);
  const [fromCredits, setFromCredits] = useState(0);
  const [toCountryId, setToCountryId] = useState("");
  const [toShare, setToShare] = useState(0);
  const [toCredits, setToCredits] = useState(0);
  const [showAllCompletedTrades, setShowAllCompletedTrades] = useState(false);
  const [showAllRejectedTrades, setShowAllRejectedTrades] = useState(false);

  useEffect(() => {
    if (!counterpartyId && defaultCounterparty) setCounterpartyId(defaultCounterparty);
  }, [counterpartyId, defaultCounterparty]);

  const counterparty = participants.find((p) => p.id === counterpartyId);
  const lockedCountryNames = useMemo(() => getLockedCountriesFromMatches(matchesObj), [matchesObj]);
  const myHoldings = (me.holdings || []).filter((h) => h.share > 0 && !lockedCountryNames.has(h.country));
  const counterpartyHoldings = (counterparty?.holdings || []).filter((h) => h.share > 0 && !lockedCountryNames.has(h.country));

  const incoming = trades.filter((t) => t.status === "pending" && t.toParticipantId === user.id);
  const outgoing = trades.filter((t) => t.fromParticipantId === user.id && ["pending", "accepted"].includes(t.status));
  const awaitingAdmin = trades.filter((t) => t.status === "accepted");
  const completed = trades.filter((t) => t.status === "approved");
  const otherHistory = trades.filter((t) => ["rejected", "canceled", "adminRejected"].includes(t.status));
  const visibleCompleted = showAllCompletedTrades ? completed : completed.slice(0, 5);
  const visibleRejected = showAllRejectedTrades ? otherHistory : otherHistory.slice(0, 5);

  function resetForm() {
    setFromCountryId("");
    setFromShare(0);
    setFromCredits(0);
    setToCountryId("");
    setToShare(0);
    setToCredits(0);
  }

  async function proposeTrade() {
    if (!counterparty) return alert("Select a participant to trade with.");
    if (user.id === "admin") return alert("Use your participant username, not admin, to propose trades.");

    const fromLot = lots.find((l) => l.id === fromCountryId);
    const toLot = lots.find((l) => l.id === toCountryId);
    const payload = {
      fromParticipantId: user.id,
      fromParticipantName: user.name,
      toParticipantId: counterparty.id,
      toParticipantName: counterparty.name,
      fromCountryId: fromCountryId || "",
      fromCountryName: fromLot?.country || "",
      fromShare: fromCountryId ? clampInt(fromShare, 1, 100) : 0,
      fromCredits: clampInt(fromCredits, 0, 999),
      toCountryId: toCountryId || "",
      toCountryName: toLot?.country || "",
      toShare: toCountryId ? clampInt(toShare, 1, 100) : 0,
      toCredits: clampInt(toCredits, 0, 999),
      status: "pending",
      createdAt: Date.now()
    };

    const validationError = validateTrade(payload, participants, lots, lockedCountryNames);
    if (validationError) return alert(validationError);

    const tradeRef = push(dbPath("trades"));
    await set(tradeRef, { ...payload, id: tradeRef.key });
    resetForm();
    alert("Trade proposed. It will appear in the other participant's Trading inbox.");
  }

  async function acceptTrade(trade) {
    const validationError = validateTrade(trade, participants, lots, lockedCountryNames);
    if (validationError) return alert(`Trade can no longer be accepted: ${validationError}`);
    await update(dbPath(`trades/${trade.id}`), { status: "accepted", acceptedAt: Date.now() });
  }

  async function rejectTrade(trade, status = "rejected") {
    await update(dbPath(`trades/${trade.id}`), { status, rejectedAt: Date.now(), rejectedBy: user.id });
  }

  async function cancelTrade(trade) {
    if (!confirm("Cancel this trade proposal?")) return;
    await update(dbPath(`trades/${trade.id}`), { status: "canceled", canceledAt: Date.now() });
  }

  async function approveTrade(trade) {
    const validationError = validateTrade(trade, participants, lots, lockedCountryNames);
    if (validationError) return alert(`Trade cannot be approved: ${validationError}`);
    if (!confirm(`Approve this trade?\n\n${summarizeTrade(trade, participants, lots)}`)) return;

    const updates = {};
    const applyShareMove = (lotId, fromId, toId, share) => {
      if (!lotId || Number(share || 0) <= 0) return;
      const lot = lots.find((l) => l.id === lotId);
      const shares = getLotShares(lot);
      shares[fromId] = Number(shares[fromId] || 0) - Number(share);
      shares[toId] = Number(shares[toId] || 0) + Number(share);
      updates[`schedule/${lotId}/shares`] = cleanShares(shares);
    };

    applyShareMove(trade.fromCountryId, trade.fromParticipantId, trade.toParticipantId, Number(trade.fromShare || 0));
    applyShareMove(trade.toCountryId, trade.toParticipantId, trade.fromParticipantId, Number(trade.toShare || 0));

    const addCreditAdjustment = (participantId, amount, label) => {
      if (!participantId || Number(amount || 0) === 0) return;
      const adjRef = push(dbPath("creditAdjustments"));
      updates[`creditAdjustments/${adjRef.key}`] = {
        id: adjRef.key,
        participantId,
        amount: Number(amount),
        reason: "trade",
        tradeId: trade.id,
        label,
        createdAt: Date.now()
      };
    };

    const fromCreditsNum = Number(trade.fromCredits || 0);
    const toCreditsNum = Number(trade.toCredits || 0);
    addCreditAdjustment(trade.fromParticipantId, -fromCreditsNum, "Credits sent in trade");
    addCreditAdjustment(trade.toParticipantId, fromCreditsNum, "Credits received in trade");
    addCreditAdjustment(trade.toParticipantId, -toCreditsNum, "Credits sent in trade");
    addCreditAdjustment(trade.fromParticipantId, toCreditsNum, "Credits received in trade");

    updates[`trades/${trade.id}/status`] = "approved";
    updates[`trades/${trade.id}/approvedAt`] = Date.now();
    updates[`trades/${trade.id}/approvedBy`] = user.id;
    await update(leagueRoot(), collapseFirebaseUpdateConflicts(updates));
  }

  function TradeCard({ trade, actions }) {
    return (
      <div className="trade-card mini-card">
        <div className="space top-wrap">
          <div>
            <b><TradeSummary trade={trade} participants={participants} lots={lots} /></b>
            <small>Created {new Date(trade.createdAt).toLocaleString()}</small>
          </div>
          <span className={`badge ${trade.status}`}>{trade.status === "adminRejected" ? "admin rejected" : trade.status}</span>
        </div>
        {actions && <div className="row trade-actions">{actions}</div>}
      </div>
    );
  }

  return (
    <div className="container grid">
      <div className="card page-title">
        <p className="eyebrow">Portfolio market</p>
        <h2>Trading</h2>
        <p className="muted">Propose country-share and credit trades. A trade only becomes official after the other participant accepts and admin gives final approval.</p>
      </div>

      {!tradingOpen && (
        <div className="card warning-card">
          <h3><AlertTriangle size={18}/> Trading is currently closed</h3>
          <p className="muted">The commissioner has temporarily closed new trade proposals. Existing accepted trades can still be reviewed by admin if needed.</p>
        </div>
      )}

      <div className="card notice-card">
        <h3>How trading works</h3>
        <div className="rules-grid">
          <p><b>Country shares:</b> Countries can be traded in whole-number increments of 1%. You cannot send more of a country than you currently own.</p>
          <p><b>Credits after the auction:</b> Credits are trading cash. Credits received reduce your net credits spent; credits sent increase your net credits spent.</p>
          <p><b>Profit formula:</b> Profit = points earned − net credits spent. If you sell a share for credits and never re-spend those credits, the credits still help by lowering net spend.</p>
          <p><b>Approval:</b> Proposed trades go to the other participant’s inbox. If accepted, admin must approve before shares or credits move.</p>
        </div>
      </div>

      <div className="grid two">
        <div className="card trade-form-card">
          <div className="space top-wrap"><h3><Send size={18}/> Propose trade</h3><span className="badge neutral">Your credits: {money(me.remaining)}</span></div>
          {user.id === "admin" ? <p className="muted">Admin should not propose trades. Log in as your participant username to trade.</p> : !tradingOpen ? <p className="muted">New trade proposals are closed by the commissioner.</p> : (
            <>
              <label className="field-label">Trade with</label>
              <select value={counterpartyId} onChange={(e) => { setCounterpartyId(e.target.value); setToCountryId(""); }}>
                {tradeableParticipants.map((p) => <option key={p.id} value={p.id}>{p.name} · {money(p.remaining)} credits</option>)}
              </select>

              <div className="trade-sides">
                <div className="trade-side">
                  <h4>You send</h4>
                  <label className="field-label">Country share</label>
                  <select value={fromCountryId} onChange={(e) => { setFromCountryId(e.target.value); setFromShare(e.target.value ? 1 : 0); }}>
                    <option value="">No country share</option>
                    {myHoldings.map((h) => <option key={h.id} value={h.id}>{h.country} · you own {money(h.share)}%</option>)}
                  </select>
                  <label className="field-label">Share %</label>
                  <input type="number" min="0" max="100" step="1" value={fromShare} onChange={(e) => setFromShare(e.target.value)} disabled={!fromCountryId} />
                  <label className="field-label">Credits</label>
                  <input type="number" min="0" step="1" value={fromCredits} onChange={(e) => setFromCredits(e.target.value)} />
                </div>

                <div className="trade-side">
                  <h4>You receive</h4>
                  <label className="field-label">Country share</label>
                  <select value={toCountryId} onChange={(e) => { setToCountryId(e.target.value); setToShare(e.target.value ? 1 : 0); }}>
                    <option value="">No country share</option>
                    {counterpartyHoldings.map((h) => <option key={h.id} value={h.id}>{h.country} · {counterparty?.name} owns {money(h.share)}%</option>)}
                  </select>
                  <label className="field-label">Share %</label>
                  <input type="number" min="0" max="100" step="1" value={toShare} onChange={(e) => setToShare(e.target.value)} disabled={!toCountryId} />
                  <label className="field-label">Credits</label>
                  <input type="number" min="0" step="1" value={toCredits} onChange={(e) => setToCredits(e.target.value)} />
                </div>
              </div>

              <button onClick={proposeTrade} className="wide"><ArrowLeftRight size={16}/> Send trade proposal</button>
              <p className="muted small-text">This proposal will not move any shares or credits until accepted and approved by admin.</p>
            </>
          )}
        </div>

        <div className="card">
          <div className="space top-wrap"><h3><Inbox size={18}/> Trade inbox</h3><span className="badge neutral">{incoming.length} pending</span></div>
          {incoming.length ? (
            <div className="stack-list">
              {incoming.map((trade) => (
                <TradeCard key={trade.id} trade={trade} actions={<><button onClick={() => acceptTrade(trade)}><CheckCircle2 size={15}/> Accept</button><button className="danger" onClick={() => rejectTrade(trade)}><XCircle size={15}/> Reject</button></>} />
              ))}
            </div>
          ) : <p className="muted">No trades currently proposed to you.</p>}
        </div>
      </div>

      <div className="grid two">
        <div className="card">
          <div className="space top-wrap"><h3><Send size={18}/> Your outgoing trades</h3><span className="badge neutral">{outgoing.length}</span></div>
          {outgoing.length ? (
            <div className="stack-list">
              {outgoing.map((trade) => (
                <TradeCard key={trade.id} trade={trade} actions={trade.status === "pending" ? <button className="secondary" onClick={() => cancelTrade(trade)}>Cancel</button> : <span className="muted">Accepted · awaiting admin approval</span>} />
              ))}
            </div>
          ) : <p className="muted">No active outgoing trade proposals.</p>}
        </div>

        <div className="card adminOnly">
          <div className="space top-wrap"><h3><ShieldCheck size={18}/> Admin approval</h3><span className="badge neutral">{awaitingAdmin.length}</span></div>
          {isAdmin ? (
            awaitingAdmin.length ? (
              <div className="stack-list">
                {awaitingAdmin.map((trade) => (
                  <TradeCard key={trade.id} trade={trade} actions={<><button onClick={() => approveTrade(trade)}><CheckCircle2 size={15}/> Approve & execute</button><button className="danger" onClick={() => rejectTrade(trade, "adminRejected")}><XCircle size={15}/> Reject</button></>} />
                ))}
              </div>
            ) : <p className="muted">No accepted trades awaiting approval.</p>
          ) : <p className="muted">Accepted trades appear here for commissioner approval. Only admin can execute them.</p>}
        </div>
      </div>

      <div className="grid two">
        <div className="card">
          <div className="space top-wrap"><h3><History size={18}/> Completed trade log</h3><span className="badge positive">{completed.length} approved</span></div>
          <p className="muted small-text">Showing {visibleCompleted.length} of {completed.length} completed trades, newest first.</p>
          {completed.length ? (
            <>
              <div className="stack-list">
                {visibleCompleted.map((trade) => <TradeCard key={trade.id} trade={trade} />)}
              </div>
              {completed.length > 5 && <button className="secondary small log-toggle" onClick={() => setShowAllCompletedTrades(!showAllCompletedTrades)}>{showAllCompletedTrades ? "Show less" : "Show all completed trades"}</button>}
            </>
          ) : <p className="muted">No completed trades yet.</p>}
        </div>

        <div className="card">
          <div className="space top-wrap"><h3>Rejected / canceled trades</h3><span className="badge neutral">{otherHistory.length}</span></div>
          <p className="muted small-text">Showing {visibleRejected.length} of {otherHistory.length} rejected or canceled trades, newest first.</p>
          {otherHistory.length ? (
            <>
              <div className="stack-list">
                {visibleRejected.map((trade) => <TradeCard key={trade.id} trade={trade} />)}
              </div>
              {otherHistory.length > 5 && <button className="secondary small log-toggle" onClick={() => setShowAllRejectedTrades(!showAllRejectedTrades)}>{showAllRejectedTrades ? "Show less" : "Show all rejected/canceled trades"}</button>}
            </>
          ) : <p className="muted">No rejected or canceled trades yet.</p>}
        </div>
      </div>
    </div>
  );
}


function ScoringLog({ scoringEventsObj, matchesObj }) {
  const events = useMemo(() => normalizeObj(scoringEventsObj)
    .filter(isActiveScoringEvent)
    .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0)), [scoringEventsObj]);
  const matches = useMemo(() => Object.fromEntries(normalizeObj(matchesObj).map((m) => [m.id, m])), [matchesObj]);

  return (
    <div className="container grid">
      <div className="card page-title scoring-log-title">
        <p className="eyebrow">Audit trail</p>
        <h2>Scoring Log</h2>
        <p className="muted">Every automatic and manual point event lives here. This is the public record for why leaderboard points changed.</p>
      </div>
      <div className="card table-card">
        {events.length ? (
          <>
            <table className="desktop-table scoring-log-table">
              <thead><tr><th>Time</th><th>Event</th><th>Team</th><th>Points</th><th>Source</th><th>Status</th><th>Match</th></tr></thead>
              <tbody>{events.map((event) => {
                const match = event.matchId ? matches[event.matchId] : null;
                return <tr key={event.id}>
                  <td>{event.createdAt ? new Date(event.createdAt).toLocaleString() : "—"}</td>
                  <td>{eventDisplayType(event.type)}</td>
                  <td><b>{event.country}</b></td>
                  <td><b>{money(event.points)}</b></td>
                  <td>{event.source || "Ledger"}</td>
                  <td><span className="badge positive">Applied</span></td>
                  <td>{match ? `${match.home} vs ${match.away}` : event.matchId ? event.matchId : "Manual"}</td>
                </tr>;
              })}</tbody>
            </table>
            <div className="mobile-cards scoring-log-cards">
              {events.map((event) => {
                const match = event.matchId ? matches[event.matchId] : null;
                return <div className="mini-card" key={event.id}>
                  <div className="space"><b>{event.country} +{money(event.points)}</b><span className="badge positive">Applied</span></div>
                  <div className="mini-grid"><span>Event</span><b>{eventDisplayType(event.type)}</b><span>Source</span><b>{event.source || "Ledger"}</b><span>Time</span><b>{event.createdAt ? new Date(event.createdAt).toLocaleString() : "—"}</b><span>Match</span><b>{match ? `${match.home} vs ${match.away}` : event.matchId ? event.matchId : "Manual"}</b></div>
                </div>;
              })}
            </div>
          </>
        ) : <p className="muted">No scoring events have been applied yet.</p>}
      </div>
    </div>
  );
}

function Admin({ participantsObj, scheduleObj, creditAdjustmentsObj, tradesObj, settingsObj, syncMetaObj, matchesObj, scoringEventsObj }) {
  const { participants, lots } = useMemo(() => deriveStats(participantsObj, scheduleObj, creditAdjustmentsObj, scoringEventsObj), [participantsObj, scheduleObj, creditAdjustmentsObj, scoringEventsObj]);
  const trades = normalizeObj(tradesObj);
  const matches = normalizeObj(matchesObj).sort((a, b) => String(a.dateTime || a.date || "").localeCompare(String(b.dateTime || b.date || "")));
  const activeEvents = normalizeObj(scoringEventsObj).filter(isActiveScoringEvent).sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
  const acceptedTrades = trades.filter((t) => t.status === "accepted").length;
  const pendingScoreMatches = matches.filter((m) => (m.statusType === "final" || m.completed) && m.scoringStatus !== "scored");
  const [startTime, setStartTime] = useState(new Date().toISOString().slice(0, 16));
  const [scoreCountry, setScoreCountry] = useState(countries[0].name);
  const [points, setPoints] = useState(3);
  const [customName, setCustomName] = useState("");
  const [correctionCountryId, setCorrectionCountryId] = useState("");
  const [correctionWinnerId, setCorrectionWinnerId] = useState("");
  const [correctionPrice, setCorrectionPrice] = useState(0);
  const [selectedMatchId, setSelectedMatchId] = useState("");
  const [manualHomeScore, setManualHomeScore] = useState("");
  const [manualAwayScore, setManualAwayScore] = useState("");
  const [manualWinner, setManualWinner] = useState("");
  const [groupWinnerTeams, setGroupWinnerTeams] = useState([]);
  const [advancedTeams, setAdvancedTeams] = useState([]);
  const tradingOpen = settingsObj?.tradingOpen !== false;

  useEffect(() => {
    if (!correctionCountryId && lots.length) setCorrectionCountryId(lots[0].id);
    if (!correctionWinnerId && participants.find((p) => p.id !== "admin")) setCorrectionWinnerId(participants.find((p) => p.id !== "admin")?.id || "");
  }, [lots, participants, correctionCountryId, correctionWinnerId]);

  useEffect(() => {
    const winners = activeEvents.filter((e) => e.type === "groupWinner").map((e) => e.country).sort((a, b) => a.localeCompare(b));
    const advanced = activeEvents.filter((e) => e.type === "advanceFromGroup").map((e) => e.country).sort((a, b) => a.localeCompare(b));
    setGroupWinnerTeams(winners);
    setAdvancedTeams(advanced);
  }, [scoringEventsObj]);

  useEffect(() => {
    if (!selectedMatchId && matches.length) setSelectedMatchId(matches[0].id);
  }, [matches, selectedMatchId]);

  const selectedMatch = matches.find((m) => m.id === selectedMatchId);

  useEffect(() => {
    if (!selectedMatch) return;
    setManualHomeScore(selectedMatch.homeScore ?? "");
    setManualAwayScore(selectedMatch.awayScore ?? "");
    setManualWinner(selectedMatch.winnerCountry || selectedMatch.home || "");
  }, [selectedMatchId]);

  async function initSchedule() {
    if (!confirm("Initialize/reset auction schedule? This will overwrite current lots and bids.")) return;
    const schedule = buildDefaultSchedule(new Date(startTime).toISOString());
    const obj = Object.fromEntries(schedule.map((l) => [l.id, l]));
    await set(dbPath("schedule"), obj);
    await set(dbPath("auctionState"), { status: "idle", currentLotId: "", endAt: 0, remainingWhenPaused: null });
    await set(dbPath("bids"), {});
  }

  async function addParticipant() {
    const trimmed = customName.trim();
    if (!trimmed) return;
    const id = slug(trimmed);
    const existing = participants.find((p) => p.id === id);
    if (existing) return alert(`${trimmed} is already in the league.`);
    await update(dbPath(`participants/${id}`), { id, name: trimmed, role: "participant", startingCredits: STARTING_CREDITS, joinedAt: Date.now() });
    setCustomName("");
  }

  async function addPoints() {
    const lot = lots.find((l) => l.country === scoreCountry);
    if (!lot) return;
    const eventId = scoringEventId(["manualAdjustment", lot.country, Date.now()]);
    const pointValue = Number(points || 0);
    await set(dbPath(`scoringEvents/${eventId}`), {
      id: eventId,
      type: "manualAdjustment",
      country: lot.country,
      points: pointValue,
      source: "manual",
      label: `Manual adjustment: ${lot.country}`,
      status: "active",
      active: true,
      createdAt: Date.now(),
      allocations: createCountryAllocations(lot.country, pointValue, participants, lots)
    });
  }

  async function saveCountryCorrection() {
    const lot = lots.find((l) => l.id === correctionCountryId);
    const winner = participants.find((p) => p.id === correctionWinnerId);
    if (!lot || !winner) return alert("Choose a country and winner.");
    const price = Number(correctionPrice || 0);
    if (price < 0) return alert("Price cannot be negative.");
    if (!confirm(`Correct ${lot.country} to ${winner.name} for ${price} credits?`)) return;
    await update(dbPath(`schedule/${lot.id}`), {
      status: "sold",
      winningParticipantId: winner.id,
      winningBidder: winner.name,
      finalPrice: price,
      soldAt: lot.soldAt || Date.now(),
      correctedAt: Date.now(),
      correctedBy: "admin",
      shares: { [winner.id]: 100 }
    });
  }

  async function setTradingOpen(nextValue) {
    await update(dbPath("settings"), { tradingOpen: Boolean(nextValue), tradingStatusUpdatedAt: Date.now() });
  }

  async function tryScoreMatch(match) {
    const result = evaluateFinalMatchForScoring(match, { participants, lots, trades, scoringEventsObj });
    if (!Object.keys(result.updates || {}).length) return alert(`No scoring action taken. Status: ${result.status}`);
    await update(leagueRoot(), result.updates);
    alert(result.status === "scored" ? "Match scored." : `Match not scored: ${result.status}`);
  }

  async function overrideAndRescoreSelectedMatch() {
    if (!selectedMatch) return alert("Select a match.");
    if (!confirm("Override this match result and rescore it? Existing active scoring events for this match will be voided first.")) return;
    const matchId = selectedMatch.id || `espn-${selectedMatch.espnEventId}`;
    const overridden = {
      ...selectedMatch,
      id: matchId,
      homeScore: Number(manualHomeScore || 0),
      awayScore: Number(manualAwayScore || 0),
      winnerCountry: manualWinner || "",
      statusType: "final",
      statusDisplay: "Final",
      completed: true,
      finalObservedAt: selectedMatch.finalObservedAt || Date.now(),
      manualOverride: true,
      manualOverrideAt: Date.now()
    };
    const result = evaluateFinalMatchForScoring(overridden, { participants, lots, trades, scoringEventsObj }, { forceRescore: true, ignoreTradeBlocks: true, winnerOverride: manualWinner, source: "manual" });
    const updates = {
      [`matches/${matchId}`]: overridden,
      ...result.updates
    };
    await update(leagueRoot(), collapseFirebaseUpdateConflicts(updates));
    alert("Manual result override saved and match rescored.");
  }

  async function voidMatchScoring(match) {
    if (!confirm("Void active scoring events for this match?")) return;
    const matchId = match.id || `espn-${match.espnEventId}`;
    const updates = {};
    activeEvents.filter((e) => e.matchId === matchId).forEach((event) => {
      updates[`scoringEvents/${event.id}/status`] = "voided";
      updates[`scoringEvents/${event.id}/active`] = false;
      updates[`scoringEvents/${event.id}/voidedAt`] = Date.now();
      updates[`scoringEvents/${event.id}/voidReason`] = "Admin voided match scoring";
    });
    updates[`matches/${matchId}/scoringStatus`] = "";
    updates[`matches/${matchId}/scoredAt`] = null;
    await update(leagueRoot(), collapseFirebaseUpdateConflicts(updates));
  }

  function toggleGroupWinner(country) {
    setGroupWinnerTeams((prev) => {
      const set = new Set(prev);
      if (set.has(country)) set.delete(country);
      else {
        if (set.size >= 12) return prev;
        set.add(country);
      }
      return [...set].sort((a, b) => a.localeCompare(b));
    });
  }

  function toggleAdvanced(country) {
    setAdvancedTeams((prev) => {
      const set = new Set(prev);
      if (set.has(country)) set.delete(country);
      else {
        if (set.size >= 32) return prev;
        set.add(country);
      }
      return [...set].sort((a, b) => a.localeCompare(b));
    });
  }

  async function saveGroupWinners() {
    if (groupWinnerTeams.length > 12) return alert("Choose no more than 12 group winners.");
    const updates = reconcileBonusEvents({ type: "groupWinner", selectedCountries: groupWinnerTeams, points: GROUP_WINNER_POINTS, source: "manual", currentEventsObj: scoringEventsObj });
    fillBonusAllocationsInUpdates(updates, participants, lots);
    updates[`settings/groupWinnerTeams`] = Object.fromEntries(groupWinnerTeams.map((country) => [country, true]));
    updates[`settings/groupWinnerUpdatedAt`] = Date.now();
    await update(leagueRoot(), collapseFirebaseUpdateConflicts(updates));
    alert("Group winner scoring reconciled.");
  }

  async function saveAdvancedTeams() {
    if (advancedTeams.length > 32) return alert("Choose no more than 32 advanced teams.");
    const updates = reconcileBonusEvents({ type: "advanceFromGroup", selectedCountries: advancedTeams, points: ADVANCE_FROM_GROUP_POINTS, source: "manual", currentEventsObj: scoringEventsObj });
    fillBonusAllocationsInUpdates(updates, participants, lots);
    updates[`settings/advancedManualOverrideActive`] = true;
    updates[`settings/advancedManualTeams`] = Object.fromEntries(advancedTeams.map((country) => [country, true]));
    updates[`settings/advancedManualUpdatedAt`] = Date.now();
    await update(leagueRoot(), collapseFirebaseUpdateConflicts(updates));
    alert("Advanced-from-group scoring reconciled. Manual override now supersedes auto-detect.");
  }

  async function clearAdvancedManualLock() {
    if (!confirm("Allow ESPN auto-detect to add future advanced-from-group events again? This does not remove current manual events.")) return;
    await update(dbPath("settings"), { advancedManualOverrideActive: false, advancedManualClearedAt: Date.now() });
  }

  async function removeParticipant(participant) {
    if (participant.id === "admin") return alert("Admin cannot be removed.");
    if (Number(participant.auctionSpent || 0) > 0 || Number(participant.holdings?.length || 0) > 0) {
      return alert("This participant already won or owns at least one country. Remove participants before they own a country.");
    }
    if (!confirm(`Remove ${participant.name} from the participant list?`)) return;
    await set(dbPath(`participants/${participant.id}`), null);
  }

  async function repairMissingAllocations() {
    const repairs = buildMissingAllocationRepairs(scoringEventsObj, matchesObj, participants, lots, trades);
    const eventIds = [...new Set(Object.keys(repairs).map((path) => path.split("/")[1]).filter(Boolean))];
    if (!eventIds.length) return alert("No active scoring events with repairable missing allocations were found.");
    if (!confirm(`Repair missing ownership allocations for ${eventIds.length} scoring event${eventIds.length === 1 ? "" : "s"}?\n\nThe repair reconstructs ownership from the original auction winner plus approved trades effective before each event cutoff.`)) return;
    await update(leagueRoot(), repairs);
    alert(`Repaired allocations for ${eventIds.length} scoring event${eventIds.length === 1 ? "" : "s"}. The leaderboard should update automatically.`);
  }

  async function clearAll() {
    if (!confirm("Clear the whole MVP league database?")) return;
    await set(ref(db, `leagues/${LEAGUE_ID}`), null);
  }

  return (
    <div className="container grid two">
      <div className="card adminOnly">
        <p className="eyebrow">Commissioner</p>
        <h2>Admin Setup</h2>
        <p className="muted">Commissioner controls for auction corrections, trading status, scoring review, and manual scoring overrides.</p>
        {acceptedTrades > 0 && <p className="notice"><b>{acceptedTrades}</b> accepted trade{acceptedTrades === 1 ? "" : "s"} awaiting final approval in the Trading tab.</p>}

        <h3>Initialize schedule</h3>
        <div className="row"><input type="datetime-local" value={startTime} onChange={(e) => setStartTime(e.target.value)} /><button onClick={initSchedule}><RefreshCw size={15} /> Initialize / Reset Schedule</button></div>

        <h3>Participant management</h3>
        <p className="muted small-text">Self-registration is disabled. Only admin can add a participant here if a late correction is needed.</p>
        <div className="row"><input value={customName} onChange={(e) => setCustomName(e.target.value)} placeholder="Participant name" /><button onClick={addParticipant}>Add</button></div>

        <h3>Manual scoring adjustment</h3>
        <p className="muted small-text">Creates an auditable scoring ledger event allocated to current owners. Use result override below for match-specific corrections.</p>
        <div className="row"><select value={scoreCountry} onChange={(e) => setScoreCountry(e.target.value)}>{countries.map((c) => <option key={c.name}>{c.name}</option>)}</select><input type="number" value={points} onChange={(e) => setPoints(e.target.value)} style={{ width: 100 }} /><button onClick={addPoints}>Add ledger points</button></div>

        <h3>Repair missing scoring allocations</h3>
        <p className="muted small-text">Repairs active scoring events that lost their ownership snapshot. It reconstructs ownership from the auction winner and approved trades effective before each match cutoff, while preserving the existing event IDs so points cannot duplicate.</p>
        <div className="row"><button onClick={repairMissingAllocations}><ShieldCheck size={15}/> Repair missing allocations</button></div>

        <h3>Correct country sale</h3>
        <p className="muted small-text">Use this to fix skipped or misassigned countries without touching Firebase directly.</p>
        <div className="row wrap-row">
          <select value={correctionCountryId} onChange={(e) => setCorrectionCountryId(e.target.value)}>{lots.map((l) => <option key={l.id} value={l.id}>{l.country} · {l.status}</option>)}</select>
          <select value={correctionWinnerId} onChange={(e) => setCorrectionWinnerId(e.target.value)}>{participants.filter((p) => p.id !== "admin").map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
          <input type="number" min="0" step="1" value={correctionPrice} onChange={(e) => setCorrectionPrice(e.target.value)} style={{ width: 100 }} />
          <button onClick={saveCountryCorrection}><Save size={15}/> Save sale</button>
        </div>

        <h3>Trading status</h3>
        <p className="muted small-text">Trading also auto-suspends for countries with final-match points still pending.</p>
        <div className="row"><span className={`badge ${tradingOpen ? "positive" : "neutral"}`}>Trading is {tradingOpen ? "Open" : "Closed"}</span><button className="secondary" onClick={() => setTradingOpen(!tradingOpen)}>{tradingOpen ? "Close trading" : "Open trading"}</button></div>

        <h3>Pending match scoring</h3>
        <p className="muted small-text">Final matches blocked by pending trades or missing knockout winners appear here. Resolve trades, then score the match.</p>
        {pendingScoreMatches.length ? (
          <div className="stack-list">
            {pendingScoreMatches.map((m) => <div className="mini-card" key={m.id}>
              <div className="space top-wrap"><b>{m.home} vs {m.away}</b><span className="badge dangerish">{m.scoringStatus || "unscored"}</span></div>
              <small>{m.statusDisplay || "Final"} · {m.homeScore}–{m.awayScore} · {m.stage}</small>
              {(m.scoringWarning || m.scoringBlockReason) && <p className="notice">{m.scoringWarning || m.scoringBlockReason}</p>}
              <div className="row"><button onClick={() => tryScoreMatch(m)}>Try score now</button><button className="secondary" onClick={() => voidMatchScoring(m)}>Void match scoring</button></div>
            </div>)}
          </div>
        ) : <p className="muted">No final matches are waiting for scoring action.</p>}

        <h3>Manual result / scoring override</h3>
        <p className="muted small-text">Use when ESPN is wrong or a knockout match is tied and ESPN did not provide a winner. This voids active scoring for the selected match and recreates it once.</p>
        <div className="row wrap-row">
          <select value={selectedMatchId} onChange={(e) => setSelectedMatchId(e.target.value)}>
            {matches.map((m) => <option key={m.id} value={m.id}>{m.displayDate || m.date} · {m.home} vs {m.away}</option>)}
          </select>
          <input type="number" value={manualHomeScore} onChange={(e) => setManualHomeScore(e.target.value)} placeholder="Home score" style={{ width: 110 }} />
          <input type="number" value={manualAwayScore} onChange={(e) => setManualAwayScore(e.target.value)} placeholder="Away score" style={{ width: 110 }} />
          <select value={manualWinner} onChange={(e) => setManualWinner(e.target.value)}>
            {[selectedMatch?.home, selectedMatch?.away].filter(Boolean).map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
          <button onClick={overrideAndRescoreSelectedMatch}><ShieldCheck size={15}/> Override & rescore</button>
        </div>

        <hr />
        <button className="danger" onClick={clearAll}>Clear league database</button>
      </div>

      <div className="grid">
        <div className="card table-card">
          <div className="space"><h2>Participants</h2><span className="badge neutral"><Users size={13}/> {participants.length}</span></div>
          <table className="desktop-table">
            <thead><tr><th>Name</th><th>Role</th><th>Auction Spend</th><th>Trade Credits</th><th>Remaining</th><th>Action</th></tr></thead>
            <tbody>{participants.map((p) => <tr key={p.id}><td>{p.name}</td><td>{p.role || "participant"}</td><td>{money(p.auctionSpent)}</td><td>{p.tradeCreditNet >= 0 ? "+" : ""}{money(p.tradeCreditNet)}</td><td>{money(p.remaining)}</td><td>{p.id === "admin" ? <span className="muted">—</span> : <button className="danger small" onClick={() => removeParticipant(p)}>Remove</button>}</td></tr>)}</tbody>
          </table>
        </div>

        <div className="card">
          <h2>Group bonuses</h2>
          <h3>Designate group winners <span className="badge neutral">{groupWinnerTeams.length}/12</span></h3>
          <div className="checkbox-grid">{APP_COUNTRY_NAMES.map((country) => <label key={`gw-${country}`}><input type="checkbox" checked={groupWinnerTeams.includes(country)} onChange={() => toggleGroupWinner(country)} disabled={!groupWinnerTeams.includes(country) && groupWinnerTeams.length >= 12} /> {country}</label>)}</div>
          <div className="row"><button onClick={saveGroupWinners}>Save group winners</button></div>

          <h3>Designate teams advanced from group <span className="badge neutral">{advancedTeams.length}/32</span></h3>
          <p className="muted small-text">Manual override supersedes ESPN auto-detect and reconciles the scoring ledger without duplicates.</p>
          <div className="checkbox-grid">{APP_COUNTRY_NAMES.map((country) => <label key={`adv-${country}`}><input type="checkbox" checked={advancedTeams.includes(country)} onChange={() => toggleAdvanced(country)} disabled={!advancedTeams.includes(country) && advancedTeams.length >= 32} /> {country}</label>)}</div>
          <div className="row"><button onClick={saveAdvancedTeams}>Save advanced teams override</button><button className="secondary" onClick={clearAdvancedManualLock}>Allow auto-detect again</button></div>
          {settingsObj?.advancedManualOverrideActive && <p className="notice">Manual advanced-team override is active. Future ESPN syncs will not change the advanced-from-group list unless you edit it here or allow auto-detect again.</p>}
        </div>

        <div className="card table-card">
          <div className="space"><h2>Scoring ledger</h2><span className="badge positive">{activeEvents.length} active</span></div>
          <p className="muted small-text">All automatic and manual scoring is stored here. Duplicate point events are prevented by stable event IDs.</p>
          <table className="desktop-table">
            <thead><tr><th>Event</th><th>Country</th><th>Points</th><th>Source</th><th>Created</th></tr></thead>
            <tbody>{activeEvents.slice(0, 20).map((event) => <tr key={event.id}><td>{event.type}</td><td><b>{event.country}</b></td><td>{money(event.points)}</td><td>{event.source}</td><td>{event.createdAt ? new Date(event.createdAt).toLocaleString() : "—"}</td></tr>)}</tbody>
          </table>
          {!activeEvents.length && <p className="muted">No scoring events yet.</p>}
        </div>
      </div>
    </div>
  );
}


function App() {
  const [user, setUser] = useState(() => {
    const name = localStorage.getItem("wcpc_username");
    return name ? { id: slug(name), name, role: name.toLowerCase() === "admin" ? "admin" : "participant" } : null;
  });
  const [page, setPage] = useState("welcome");
  const [participantsObj] = useFirebaseValue("participants", {});
  const [scheduleObj] = useFirebaseValue("schedule", {});
  const [creditAdjustmentsObj] = useFirebaseValue("creditAdjustments", {});
  const [tradesObj] = useFirebaseValue("trades", {});
  const [auctionState] = useFirebaseValue("auctionState", { status: "idle", currentLotId: "", endAt: 0, remainingWhenPaused: null });
  const [settingsObj] = useFirebaseValue("settings", {});
  const [matchesObj] = useFirebaseValue("matches", {});
  const [syncMetaObj] = useFirebaseValue("syncMeta", {});
  const [scoringEventsObj] = useFirebaseValue("scoringEvents", {});
  const isAdmin = Boolean(user && (user.name.toLowerCase() === "admin" || participantsObj?.[user.id]?.role === "admin"));

  useEffect(() => {
    if (user && !isAdmin && page === "admin") setPage("welcome");
  }, [user, isAdmin, page]);

  if (!user) return <Login onLogin={setUser} participantsObj={participantsObj} />;

  const logout = () => {
    localStorage.removeItem("wcpc_username");
    setUser(null);
  };

  return (
    <div className="app">
      <Header page={page} setPage={setPage} user={user} onLogout={logout} isAdmin={isAdmin} />
      {page === "welcome" && <Welcome participantsObj={participantsObj} scheduleObj={scheduleObj} creditAdjustmentsObj={creditAdjustmentsObj} matchesObj={matchesObj} syncMetaObj={syncMetaObj} scoringEventsObj={scoringEventsObj} tradesObj={tradesObj} />}
      {page === "auction" && <Auction user={user} isAdmin={isAdmin} participantsObj={participantsObj} scheduleObj={scheduleObj} creditAdjustmentsObj={creditAdjustmentsObj} auctionState={auctionState} scoringEventsObj={scoringEventsObj} />}
      {page === "schedule" && <AuctionSchedule scheduleObj={scheduleObj} scoringEventsObj={scoringEventsObj} />}
      {page === "matches" && <Matches user={user} participantsObj={participantsObj} scheduleObj={scheduleObj} creditAdjustmentsObj={creditAdjustmentsObj} tradesObj={tradesObj} matchesObj={matchesObj} syncMetaObj={syncMetaObj} scoringEventsObj={scoringEventsObj} settingsObj={settingsObj} />}
      {page === "portfolio" && <Portfolio user={user} participantsObj={participantsObj} scheduleObj={scheduleObj} creditAdjustmentsObj={creditAdjustmentsObj} scoringEventsObj={scoringEventsObj} />}
      {page === "ownership" && <CountryOwnership participantsObj={participantsObj} scheduleObj={scheduleObj} creditAdjustmentsObj={creditAdjustmentsObj} scoringEventsObj={scoringEventsObj} />}
      {page === "leaderboard" && <Leaderboard participantsObj={participantsObj} scheduleObj={scheduleObj} creditAdjustmentsObj={creditAdjustmentsObj} scoringEventsObj={scoringEventsObj} />}
      {page === "scoring" && <ScoringLog scoringEventsObj={scoringEventsObj} matchesObj={matchesObj} />}
      {page === "trading" && <Trading user={user} isAdmin={isAdmin} participantsObj={participantsObj} scheduleObj={scheduleObj} creditAdjustmentsObj={creditAdjustmentsObj} tradesObj={tradesObj} settingsObj={settingsObj} matchesObj={matchesObj} scoringEventsObj={scoringEventsObj} />}
      {page === "admin" && isAdmin && <Admin participantsObj={participantsObj} scheduleObj={scheduleObj} creditAdjustmentsObj={creditAdjustmentsObj} tradesObj={tradesObj} settingsObj={settingsObj} syncMetaObj={syncMetaObj} matchesObj={matchesObj} scoringEventsObj={scoringEventsObj} />}
      <div className="footer">v3F Visual polish + tournament UX cleanup</div>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
