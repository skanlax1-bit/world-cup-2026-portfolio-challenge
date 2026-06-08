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
  BookOpen
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

function getLotShareForParticipant(lot, participantId) {
  return Number(getLotShares(lot)[participantId] || 0);
}

function getLotPointsForParticipant(lot, participantId) {
  const share = getLotShareForParticipant(lot, participantId);
  return Number(lot?.points || 0) * (share / 100);
}

function deriveStats(participantsObj, scheduleObj, creditAdjustmentsObj = {}) {
  const participants = normalizeObj(participantsObj)
    .map((p) => ({
      ...p,
      auctionSpent: 0,
      tradeCreditNet: 0,
      spent: 0,
      remaining: p.startingCredits ?? STARTING_CREDITS,
      points: 0,
      profit: 0,
      holdings: []
    }))
    .sort((a, b) => (a.name || "").localeCompare(b.name || ""));

  const byId = Object.fromEntries(participants.map((p) => [p.id, p]));
  const lots = normalizeObj(scheduleObj).sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
  const creditAdjustments = normalizeObj(creditAdjustmentsObj);

  lots.forEach((lot) => {
    if (lot.status !== "sold") return;

    const shares = getLotShares(lot);
    Object.entries(shares).forEach(([participantId, share]) => {
      const participant = byId[participantId];
      if (!participant || Number(share || 0) <= 0) return;

      const points = getLotPointsForParticipant(lot, participantId);
      const auctionCost = lot.winningParticipantId === participantId ? Number(lot.finalPrice || 0) : 0;
      participant.auctionSpent += auctionCost;
      participant.points += points;
      participant.holdings.push({ ...lot, share: Number(share), ownerPoints: points, ownerCost: auctionCost });
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

  return { participants, lots, creditAdjustments };
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
    ["welcome", "Welcome", BookOpen],
    ["auction", "Auction", Gavel],
    ["schedule", "Auction Schedule", ListChecks],
    ["matches", "Matches", CalendarDays],
    ["portfolio", "Portfolios", Wallet],
    ["leaderboard", "Leaderboard", BarChart3],
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

function Welcome() {
  return (
    <div className="container grid">
      <div className="card page-title welcome-hero-card">
        <p className="eyebrow">League format</p>
        <h2>World Cup 2026 Portfolio Challenge</h2>
        <p className="muted">Office-friendly World Cup auction pool with portfolio-style ownership and trading.</p>
      </div>

      <div className="grid two">
        <div className="card">
          <h3>Format</h3>
          <div className="rules-list">
            <p>Each participant starts with <b>45 credits</b>.</p>
            <p>All World Cup countries are auctioned off in scheduled 5-minute windows.</p>
            <p>You can only bid up to your remaining credits.</p>
            <p>If you win a country, those credits are deducted from your balance.</p>
            <p>Each country starts as <b>100% owned</b> by the auction winner.</p>
          </div>
        </div>

        <div className="card">
          <h3>Winning the league</h3>
          <div className="formula-card">
            <span>Profit</span>
            <b>= Points Earned − Net Credits Spent</b>
          </div>
          <p className="muted">Example: if you buy Spain for 40 credits and Spain earns 55 points, your profit is +15.</p>
          <p className="muted">Credits received in trades reduce your net credits spent. Credits sent in trades increase your net credits spent.</p>
        </div>
      </div>

      <div className="card table-card">
        <h3>Scoring</h3>
        <table className="desktop-table">
          <thead><tr><th>Event</th><th>Points</th></tr></thead>
          <tbody>
            <tr><td>Group Stage Win</td><td><b>3</b></td></tr>
            <tr><td>Group Stage Draw</td><td><b>1</b></td></tr>
            <tr><td>Advance from Group</td><td><b>3</b></td></tr>
            <tr><td>Win Group</td><td><b>3</b></td></tr>
            <tr><td>Round of 32 Win</td><td><b>5</b></td></tr>
            <tr><td>Round of 16 Win</td><td><b>9</b></td></tr>
            <tr><td>Quarterfinal Win</td><td><b>15</b></td></tr>
            <tr><td>Semifinal Win</td><td><b>22</b></td></tr>
            <tr><td>Final Win</td><td><b>34</b></td></tr>
          </tbody>
        </table>
        <div className="mobile-cards">
          {[
            ["Group Stage Win",3],["Group Stage Draw",1],["Advance from Group",3],["Win Group",3],["Round of 32 Win",5],["Round of 16 Win",9],["Quarterfinal Win",15],["Semifinal Win",22],["Final Win",34]
          ].map(([event, pts]) => <div className="mini-card" key={event}><div className="space"><b>{event}</b><span className="badge neutral">{pts} pts</span></div></div>)}
        </div>
        <p className="notice">A perfect champion earns 100 points.</p>
      </div>

      <div className="card">
        <h3>Trading</h3>
        <div className="rules-grid">
          <p>Country shares can be traded in minimum increments of <b>1%</b>.</p>
          <p>Trades can include credits to balance value.</p>
          <p>The receiving participant can accept or reject an offer in the Trading inbox.</p>
          <p>Accepted trades require final admin approval before they are executed.</p>
        </div>
      </div>
    </div>
  );
}

function Auction({ user, isAdmin, participantsObj, scheduleObj, creditAdjustmentsObj, auctionState }) {
  const now = useNow();
  const { participants, lots } = useMemo(() => deriveStats(participantsObj, scheduleObj, creditAdjustmentsObj), [participantsObj, scheduleObj, creditAdjustmentsObj]);
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

function AuctionSchedule({ scheduleObj }) {
  const { lots } = useMemo(() => deriveStats({}, scheduleObj), [scheduleObj]);

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
              <tbody>{lots.map((l) => <tr key={l.id}><td>{l.order}</td><td>{fmtTime(l.scheduledAt)}</td><td>{l.rank}</td><td><b>{l.country}</b></td><td><span className={`badge ${l.status}`}>{l.status}</span></td><td>{l.winningBidder || "—"}</td><td>{l.finalPrice || "—"}</td><td>{l.points || 0}</td></tr>)}</tbody>
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

function Matches() {
  const grouped = useMemo(() => {
    return worldCupMatches.reduce((acc, match) => {
      acc[match.displayDate] = acc[match.displayDate] || [];
      acc[match.displayDate].push(match);
      return acc;
    }, {});
  }, []);

  return (
    <div className="container grid">
      <div className="card page-title">
        <p className="eyebrow">World Cup match calendar</p>
        <h2>Matches</h2>
        <p className="muted">Read-only match schedule with date, time, matchup, venue, and stage. Results/scoring automation will be added later.</p>
      </div>
      <div className="grid">
        {Object.entries(grouped).map(([date, matches]) => (
          <div className="card" key={date}>
            <h3>{date}</h3>
            <table className="desktop-table">
              <thead><tr><th>Time</th><th>Match</th><th>Venue</th><th>Stage</th></tr></thead>
              <tbody>{matches.map((m) => <tr key={m.id}><td>{m.time}</td><td><b>{m.home}</b> vs <b>{m.away}</b></td><td>{m.venue}</td><td>{m.stage}</td></tr>)}</tbody>
            </table>
            <div className="mobile-cards">
              {matches.map((m) => (
                <div className="mini-card" key={m.id}>
                  <div className="space"><b>{m.home} vs {m.away}</b><span className="badge neutral">{m.stage}</span></div>
                  <div className="mini-grid"><span>Time</span><b>{m.time}</b><span>Venue</span><b>{m.venue}</b></div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Portfolio({ user, participantsObj, scheduleObj, creditAdjustmentsObj }) {
  const { participants, lots } = useMemo(() => deriveStats(participantsObj, scheduleObj, creditAdjustmentsObj), [participantsObj, scheduleObj, creditAdjustmentsObj]);
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

      <div className="card table-card">
        <h3>Holdings</h3>
        {selected.holdings?.length ? (
          <>
            <table className="desktop-table">
              <thead><tr><th>ESPN Rank</th><th>Country</th><th>Share</th><th>Auction Cost</th><th>Points</th><th>Country P/L</th></tr></thead>
              <tbody>{selected.holdings.map((l) => <tr key={l.id}><td>{l.rank}</td><td><b>{l.country}</b></td><td>{money(l.share)}%</td><td>{money(l.ownerCost)}</td><td>{money(l.ownerPoints)}</td><td><b>{money(Number(l.ownerPoints || 0) - Number(l.ownerCost || 0))}</b></td></tr>)}</tbody>
            </table>
            <div className="mobile-cards">
              {selected.holdings.map((l) => (
                <div className="mini-card" key={l.id}>
                  <div className="space"><b>{l.country}</b><span className="badge neutral">Share {money(l.share)}%</span></div>
                  <div className="mini-grid"><span>ESPN Rank</span><b>#{l.rank}</b><span>Auction Cost</span><b>{money(l.ownerCost)}</b><span>Points</span><b>{money(l.ownerPoints)}</b><span>Country P/L</span><b>{money(Number(l.ownerPoints || 0) - Number(l.ownerCost || 0))}</b></div>
                </div>
              ))}
            </div>
          </>
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

function Leaderboard({ participantsObj, scheduleObj, creditAdjustmentsObj }) {
  const { participants } = useMemo(() => deriveStats(participantsObj, scheduleObj, creditAdjustmentsObj), [participantsObj, scheduleObj, creditAdjustmentsObj]);
  const sorted = [...participants].sort((a, b) => Number(b.profit || 0) - Number(a.profit || 0) || Number(b.points || 0) - Number(a.points || 0));

  return (
    <div className="container grid">
      <div className="card page-title">
        <p className="eyebrow">Standings</p>
        <h2>Leaderboard</h2>
        <p className="muted">Profit = points earned − net credits spent. Credits received in trades reduce net credits spent; credits sent in trades increase it.</p>
      </div>
      <div className="card table-card">
        <table className="desktop-table">
          <thead><tr><th>Rank</th><th>Participant</th><th>Points</th><th>Auction Spend</th><th>Trade Credits</th><th>Net Spent</th><th>Remaining</th><th>Profit</th><th>Holdings</th></tr></thead>
          <tbody>{sorted.map((p, i) => <tr key={p.id}><td>{i + 1}</td><td><b>{p.name}</b></td><td>{money(p.points)}</td><td>{money(p.auctionSpent)}</td><td>{p.tradeCreditNet >= 0 ? "+" : ""}{money(p.tradeCreditNet)}</td><td>{money(p.spent)}</td><td>{money(p.remaining)}</td><td><b>{money(p.profit)}</b></td><td>{p.holdings.length}</td></tr>)}</tbody>
        </table>
        <div className="mobile-cards leaderboard-cards">
          {sorted.map((p, i) => (
            <div className="mini-card" key={p.id}>
              <div className="space"><b>#{i + 1} {p.name}</b><span className={`badge ${p.profit >= 0 ? "positive" : "negative"}`}>{money(p.profit)}</span></div>
              <div className="mini-grid"><span>Points</span><b>{money(p.points)}</b><span>Auction Spend</span><b>{money(p.auctionSpent)}</b><span>Trade Credits</span><b>{p.tradeCreditNet >= 0 ? "+" : ""}{money(p.tradeCreditNet)}</b><span>Net Spent</span><b>{money(p.spent)}</b><span>Remaining</span><b>{money(p.remaining)}</b><span>Holdings</span><b>{p.holdings.length}</b></div>
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

function validateTrade(trade, participants, lots) {
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
    const owned = getLotShareForParticipant(lot, from.id);
    if (fromShare > owned) return `${from.name} only owns ${money(owned)}% of ${lot.country}.`;
  }
  if (trade.toCountryId) {
    const lot = lots.find((l) => l.id === trade.toCountryId);
    if (!lot || lot.status !== "sold") return "Receiver country must be a sold country.";
    const owned = getLotShareForParticipant(lot, to.id);
    if (toShare > owned) return `${to.name} only owns ${money(owned)}% of ${lot.country}.`;
  }

  return null;
}

function Trading({ user, isAdmin, participantsObj, scheduleObj, creditAdjustmentsObj, tradesObj }) {
  const { participants, lots } = useMemo(() => deriveStats(participantsObj, scheduleObj, creditAdjustmentsObj), [participantsObj, scheduleObj, creditAdjustmentsObj]);
  const trades = useMemo(() => normalizeObj(tradesObj).sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0)), [tradesObj]);
  const me = participants.find((p) => p.id === user.id) || { id: user.id, name: user.name, remaining: STARTING_CREDITS, holdings: [] };
  const tradeableParticipants = participants.filter((p) => p.id !== user.id && p.id !== "admin");
  const defaultCounterparty = tradeableParticipants[0]?.id || "";

  const [counterpartyId, setCounterpartyId] = useState(defaultCounterparty);
  const [fromCountryId, setFromCountryId] = useState("");
  const [fromShare, setFromShare] = useState(0);
  const [fromCredits, setFromCredits] = useState(0);
  const [toCountryId, setToCountryId] = useState("");
  const [toShare, setToShare] = useState(0);
  const [toCredits, setToCredits] = useState(0);

  useEffect(() => {
    if (!counterpartyId && defaultCounterparty) setCounterpartyId(defaultCounterparty);
  }, [counterpartyId, defaultCounterparty]);

  const counterparty = participants.find((p) => p.id === counterpartyId);
  const myHoldings = (me.holdings || []).filter((h) => h.share > 0);
  const counterpartyHoldings = (counterparty?.holdings || []).filter((h) => h.share > 0);

  const incoming = trades.filter((t) => t.status === "pending" && t.toParticipantId === user.id);
  const outgoing = trades.filter((t) => t.fromParticipantId === user.id && ["pending", "accepted"].includes(t.status));
  const awaitingAdmin = trades.filter((t) => t.status === "accepted");
  const completed = trades.filter((t) => t.status === "approved");
  const otherHistory = trades.filter((t) => ["rejected", "canceled", "adminRejected"].includes(t.status));

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

    const validationError = validateTrade(payload, participants, lots);
    if (validationError) return alert(validationError);

    const tradeRef = push(dbPath("trades"));
    await set(tradeRef, { ...payload, id: tradeRef.key });
    resetForm();
    alert("Trade proposed. It will appear in the other participant's Trading inbox.");
  }

  async function acceptTrade(trade) {
    const validationError = validateTrade(trade, participants, lots);
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
    const validationError = validateTrade(trade, participants, lots);
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
    await update(leagueRoot(), updates);
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
          {user.id === "admin" ? <p className="muted">Admin should not propose trades. Log in as your participant username to trade.</p> : (
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

      <div className="card">
        <div className="space top-wrap"><h3><History size={18}/> Completed trade log</h3><span className="badge positive">{completed.length} approved</span></div>
        {completed.length ? (
          <div className="stack-list">
            {completed.map((trade) => <TradeCard key={trade.id} trade={trade} />)}
          </div>
        ) : <p className="muted">No completed trades yet.</p>}
      </div>

      {otherHistory.length > 0 && (
        <div className="card">
          <h3>Rejected / canceled trades</h3>
          <div className="stack-list">
            {otherHistory.slice(0, 12).map((trade) => <TradeCard key={trade.id} trade={trade} />)}
          </div>
        </div>
      )}
    </div>
  );
}

function Admin({ participantsObj, scheduleObj, creditAdjustmentsObj, tradesObj }) {
  const { participants, lots } = useMemo(() => deriveStats(participantsObj, scheduleObj, creditAdjustmentsObj), [participantsObj, scheduleObj, creditAdjustmentsObj]);
  const trades = normalizeObj(tradesObj);
  const acceptedTrades = trades.filter((t) => t.status === "accepted").length;
  const [startTime, setStartTime] = useState(new Date().toISOString().slice(0, 16));
  const [scoreCountry, setScoreCountry] = useState(countries[0].name);
  const [points, setPoints] = useState(3);
  const [customName, setCustomName] = useState("");

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
    await update(dbPath(`schedule/${lot.id}`), { points: Number(lot.points || 0) + Number(points || 0) });
  }

  async function removeParticipant(participant) {
    if (participant.id === "admin") return alert("Admin cannot be removed.");
    if (Number(participant.auctionSpent || 0) > 0 || Number(participant.holdings?.length || 0) > 0) {
      return alert("This participant already won or owns at least one country. Remove participants before they own a country.");
    }
    if (!confirm(`Remove ${participant.name} from the participant list?`)) return;
    await set(dbPath(`participants/${participant.id}`), null);
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
        <p className="muted">MVP admin controls. Use username <b>admin</b>.</p>
        {acceptedTrades > 0 && <p className="notice"><b>{acceptedTrades}</b> accepted trade{acceptedTrades === 1 ? "" : "s"} awaiting final approval in the Trading tab.</p>}

        <h3>Initialize schedule</h3>
        <div className="row"><input type="datetime-local" value={startTime} onChange={(e) => setStartTime(e.target.value)} /><button onClick={initSchedule}><RefreshCw size={15} /> Initialize / Reset Schedule</button></div>

        <h3>Participant management</h3>
        <p className="muted small-text">Self-registration is disabled. Only admin can add a participant here if a late correction is needed.</p>
        <div className="row"><input value={customName} onChange={(e) => setCustomName(e.target.value)} placeholder="Participant name" /><button onClick={addParticipant}>Add</button></div>

        <h3>Manual scoring</h3>
        <div className="row"><select value={scoreCountry} onChange={(e) => setScoreCountry(e.target.value)}>{countries.map((c) => <option key={c.name}>{c.name}</option>)}</select><input type="number" value={points} onChange={(e) => setPoints(e.target.value)} style={{ width: 100 }} /><button onClick={addPoints}>Add points</button></div>

        <hr />
        <button className="danger" onClick={clearAll}>Clear league database</button>
      </div>

      <div className="card table-card">
        <div className="space"><h2>Participants</h2><span className="badge neutral"><Users size={13}/> {participants.length}</span></div>
        <table className="desktop-table">
          <thead><tr><th>Name</th><th>Role</th><th>Auction Spend</th><th>Trade Credits</th><th>Remaining</th><th>Action</th></tr></thead>
          <tbody>{participants.map((p) => <tr key={p.id}><td>{p.name}</td><td>{p.role || "participant"}</td><td>{money(p.auctionSpent)}</td><td>{p.tradeCreditNet >= 0 ? "+" : ""}{money(p.tradeCreditNet)}</td><td>{money(p.remaining)}</td><td>{p.id === "admin" ? <span className="muted">—</span> : <button className="danger small" onClick={() => removeParticipant(p)}>Remove</button>}</td></tr>)}</tbody>
        </table>
        <div className="mobile-cards">
          {participants.map((p) => (
            <div className="mini-card" key={p.id}>
              <div className="space"><b>{p.name}</b><span className="badge neutral">{p.role || "participant"}</span></div>
              <div className="mini-grid"><span>Auction Spend</span><b>{money(p.auctionSpent)}</b><span>Trade Credits</span><b>{p.tradeCreditNet >= 0 ? "+" : ""}{money(p.tradeCreditNet)}</b><span>Remaining</span><b>{money(p.remaining)}</b></div>
              {p.id !== "admin" && <button className="danger small" onClick={() => removeParticipant(p)}>Remove</button>}
            </div>
          ))}
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
      {page === "welcome" && <Welcome />}
      {page === "auction" && <Auction user={user} isAdmin={isAdmin} participantsObj={participantsObj} scheduleObj={scheduleObj} creditAdjustmentsObj={creditAdjustmentsObj} auctionState={auctionState} />}
      {page === "schedule" && <AuctionSchedule scheduleObj={scheduleObj} />}
      {page === "matches" && <Matches />}
      {page === "portfolio" && <Portfolio user={user} participantsObj={participantsObj} scheduleObj={scheduleObj} creditAdjustmentsObj={creditAdjustmentsObj} />}
      {page === "leaderboard" && <Leaderboard participantsObj={participantsObj} scheduleObj={scheduleObj} creditAdjustmentsObj={creditAdjustmentsObj} />}
      {page === "trading" && <Trading user={user} isAdmin={isAdmin} participantsObj={participantsObj} scheduleObj={scheduleObj} creditAdjustmentsObj={creditAdjustmentsObj} tradesObj={tradesObj} />}
      {page === "admin" && isAdmin && <Admin participantsObj={participantsObj} scheduleObj={scheduleObj} creditAdjustmentsObj={creditAdjustmentsObj} tradesObj={tradesObj} />}
      <div className="footer">v3B UX + Trading upgrade · Manual scoring now, ESPN automation later</div>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
