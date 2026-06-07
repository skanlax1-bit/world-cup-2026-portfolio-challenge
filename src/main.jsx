import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { ref, onValue, set, update, push, runTransaction } from "firebase/database";
import { Trophy, Gavel, Wallet, BarChart3, Settings, User, RefreshCw } from "lucide-react";
import { db } from "./firebase";
import { countries, buildDefaultSchedule } from "./countries";
import "./styles.css";

const LEAGUE_ID = "defaultLeague";
const STARTING_CREDITS = 45;
const TIMER_SECONDS = 5 * 60;

const path = (p) => ref(db, `leagues/${LEAGUE_ID}/${p}`);
const money = (n) => Number(n || 0).toFixed(Number.isInteger(Number(n || 0)) ? 0 : 2);
const fmtTime = (iso) => iso ? new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "—";
const slug = (name) => name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function useFirebaseValue(firebasePath, fallback) {
  const [value, setValue] = useState(fallback);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const unsub = onValue(path(firebasePath), (snap) => {
      setValue(snap.exists() ? snap.val() : fallback);
      setLoading(false);
    });
    return () => unsub();
  }, [firebasePath]);
  return [value, loading];
}

function normalizeObj(obj) { return obj ? Object.values(obj) : []; }

function Login({ onLogin }) {
  const [name, setName] = useState(localStorage.getItem("wcpc_username") || "");
  const submit = async (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    const id = slug(trimmed);
    await update(path(`participants/${id}`), {
      id,
      name: trimmed,
      role: trimmed.toLowerCase() === "admin" ? "admin" : "participant",
      startingCredits: STARTING_CREDITS,
      joinedAt: Date.now()
    });
    localStorage.setItem("wcpc_username", trimmed);
    onLogin({ id, name: trimmed, role: trimmed.toLowerCase() === "admin" ? "admin" : "participant" });
  };
  return <div className="container"><div className="card login">
    <h1>World Cup 2026 Portfolio Challenge</h1>
    <p className="muted">Enter your username to join the auction room. No password required.</p>
    <form onSubmit={submit} className="row">
      <input value={name} onChange={e => setName(e.target.value)} placeholder="Your name / username" style={{ flex: 1 }} />
      <button>Enter</button>
    </form>
    <p className="notice">Commissioner tip: use username <b>admin</b> to unlock admin controls in this MVP.</p>
  </div></div>;
}

function Header({ page, setPage, user, onLogout }) {
  const items = [
    ["auction", "Auction", Gavel],
    ["schedule", "Schedule", Trophy],
    ["portfolio", "Portfolio", Wallet],
    ["leaderboard", "Leaderboard", BarChart3],
    ["admin", "Admin", Settings]
  ];
  return <div className="header">
    <div><h1>World Cup 2026 Portfolio Challenge</h1><p>Auction MVP · Username: {user.name}</p></div>
    <div className="nav">
      {items.map(([key, label, Icon]) => <button key={key} className={page === key ? "active" : ""} onClick={() => setPage(key)}><Icon size={15} /> {label}</button>)}
      <button onClick={onLogout} className="secondary"><User size={15} /> Logout</button>
    </div>
  </div>;
}

function deriveStats(participantsObj, scheduleObj) {
  const participants = normalizeObj(participantsObj).map(p => ({ ...p, spent: 0, remaining: p.startingCredits ?? STARTING_CREDITS, points: 0, profit: 0, holdings: [] }));
  const byId = Object.fromEntries(participants.map(p => [p.id, p]));
  const lots = normalizeObj(scheduleObj).sort((a,b) => a.order - b.order);
  lots.forEach(lot => {
    if (lot.status === "sold" && lot.winningParticipantId && byId[lot.winningParticipantId]) {
      const p = byId[lot.winningParticipantId];
      p.spent += Number(lot.finalPrice || 0);
      p.points += Number(lot.points || 0);
      p.holdings.push(lot);
    }
  });
  participants.forEach(p => {
    p.remaining = Number(p.startingCredits ?? STARTING_CREDITS) - p.spent;
    p.profit = p.points - p.spent;
  });
  return { participants, lots };
}

function useNow(interval = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), interval); return () => clearInterval(t); }, [interval]);
  return now;
}

function Auction({ user, isAdmin, participantsObj, scheduleObj, auctionState }) {
  const now = useNow();
  const { participants, lots } = deriveStats(participantsObj, scheduleObj);
  const me = participants.find(p => p.id === user.id) || { remaining: STARTING_CREDITS };
  const currentLot = auctionState?.currentLotId ? lots.find(l => l.id === auctionState.currentLotId) : lots.find(l => l.status === "live") || lots.find(l => l.status === "upcoming");
  const [bid, setBid] = useState(1);
  const [bidsObj] = useFirebaseValue(currentLot ? `bids/${currentLot.id}` : "bids/none", {});
  const bids = normalizeObj(bidsObj).sort((a,b) => b.createdAt - a.createdAt);
  const currentHigh = bids.filter(b => b.isValid !== false).sort((a,b) => Number(b.amount)-Number(a.amount) || a.createdAt-b.createdAt)[0];
  const endAt = auctionState?.endAt || null;
  const secondsLeft = currentLot?.status === "live" && endAt ? Math.max(0, Math.ceil((endAt - now) / 1000)) : TIMER_SECONDS;
  const minBid = Math.max(1, Number(currentHigh?.amount || 0) + 1);
  const canBid = currentLot?.status === "live" && Number(bid) >= minBid && Number(bid) <= me.remaining && currentHigh?.participantId !== user.id;

  async function placeBid() {
    const amount = Number(bid);
    if (!canBid) return;
    const freshSnapPath = `participants/${user.id}`;
    // Remaining is derived from sold lots, so validate client-side and by transaction against lot high bid.
    const bidRef = push(path(`bids/${currentLot.id}`));
    await set(bidRef, { id: bidRef.key, participantId: user.id, participantName: user.name, amount, createdAt: Date.now(), isValid: true });
  }

  async function startLot(lotId) {
    const lot = lots.find(l => l.id === lotId);
    if (!lot) return;
    const start = Date.now();
    await update(path(`schedule/${lotId}`), { status: "live", actualStartAt: start });
    await update(path("auctionState"), { currentLotId: lotId, status: "live", startedAt: start, endAt: start + TIMER_SECONDS * 1000 });
  }

  async function pauseResume() {
    if (auctionState?.status === "paused") {
      await update(path("auctionState"), { status: "live", endAt: Date.now() + Number(auctionState.remainingWhenPaused || TIMER_SECONDS) * 1000 });
    } else {
      await update(path("auctionState"), { status: "paused", remainingWhenPaused: secondsLeft });
    }
  }

  async function sellLot() {
    if (!currentLot || !currentHigh) return alert("No valid bid to sell.");
    const price = Number(currentHigh.amount);
    const winner = participants.find(p => p.id === currentHigh.participantId);
    if (!winner || price > winner.remaining) return alert("Winning bidder no longer has enough credits. Reopen bidding.");
    await update(path(`schedule/${currentLot.id}`), {
      status: "sold",
      winningParticipantId: currentHigh.participantId,
      winningBidder: currentHigh.participantName,
      finalPrice: price,
      soldAt: Date.now()
    });
    await update(path("auctionState"), { status: "idle", currentLotId: "", endAt: 0 });
  }

  async function skipLot() {
    if (!currentLot) return;
    await update(path(`schedule/${currentLot.id}`), { status: "skipped" });
    await update(path("auctionState"), { status: "idle", currentLotId: "", endAt: 0 });
  }

  const nextLots = lots.filter(l => l.status === "upcoming").slice(0, 5);
  useEffect(() => { if (secondsLeft === 0 && currentLot?.status === "live" && isAdmin) {} }, [secondsLeft, currentLot?.status, isAdmin]);

  return <div className="container grid two">
    <div className="card">
      <div className="space"><div><h2>Live Auction Room</h2><p className="muted">5-minute scheduled country auction. Bids cannot exceed remaining credits.</p></div>{currentLot && <span className={`badge ${currentLot.status}`}>{currentLot.status}</span>}</div>
      {currentLot ? <>
        <div className="kpi" style={{ margin: "14px 0" }}>
          <div className="label">Current country</div>
          <div className="value">#{currentLot.rank} {currentLot.country}</div>
          <div className="muted">Scheduled: {fmtTime(currentLot.scheduledAt)}</div>
        </div>
        <div className="grid three">
          <div className="kpi"><div className="label">Timer</div><div className="value">{Math.floor(secondsLeft/60)}:{String(secondsLeft%60).padStart(2,"0")}</div></div>
          <div className="kpi"><div className="label">High bid</div><div className="value">{currentHigh ? `${currentHigh.amount} by ${currentHigh.participantName}` : "No bids"}</div></div>
          <div className="kpi"><div className="label">Your remaining credits</div><div className="value">{money(me.remaining)}</div></div>
        </div>
        <div className="row" style={{ marginTop: 16 }}>
          <input type="number" min={minBid} max={me.remaining} value={bid} onChange={e => setBid(e.target.value)} />
          <button onClick={placeBid} disabled={!canBid}>Bid {bid}</button>
          <button className="secondary" onClick={() => setBid(minBid)} disabled={minBid > me.remaining}>Min bid {minBid}</button>
          <button className="secondary" onClick={() => setBid(me.remaining)} disabled={me.remaining < minBid}>Max {money(me.remaining)}</button>
        </div>
        {!canBid && currentLot.status === "live" && <p className="muted">Bid must be at least {minBid}, cannot exceed {money(me.remaining)}, and you cannot bid against yourself.</p>}
        {isAdmin && <div className="card adminOnly" style={{ marginTop: 16 }}>
          <b>Commissioner controls</b>
          <div className="row" style={{ marginTop: 10 }}>
            {currentLot.status !== "live" && <button onClick={() => startLot(currentLot.id)}>Start lot</button>}
            {currentLot.status === "live" && <button onClick={sellLot}>Sell to high bidder</button>}
            <button className="secondary" onClick={pauseResume}>{auctionState?.status === "paused" ? "Resume" : "Pause"}</button>
            <button className="danger" onClick={skipLot}>Skip</button>
          </div>
        </div>}
      </> : <p>No lots loaded yet. Go to Admin and initialize the league.</p>}
    </div>
    <div className="grid">
      <div className="card"><h3>Recent bids</h3>{bids.length ? <table><tbody>{bids.slice(0,8).map(b => <tr key={b.id}><td>{b.participantName}</td><td><b>{b.amount}</b></td><td className="muted">{new Date(b.createdAt).toLocaleTimeString()}</td></tr>)}</tbody></table> : <p className="muted">No bids yet.</p>}</div>
      <div className="card"><h3>Coming up</h3><table><tbody>{nextLots.map(l => <tr key={l.id}><td>#{l.rank} {l.country}</td><td>{fmtTime(l.scheduledAt)}</td></tr>)}</tbody></table></div>
    </div>
  </div>;
}

function Schedule({ scheduleObj }) {
  const { lots } = deriveStats({}, scheduleObj);
  return <div className="container card"><h2>Auction Schedule</h2><p className="muted">Predefined country order with ESPN pre-tournament rank.</p><table><thead><tr><th>Order</th><th>Time</th><th>Rank</th><th>Country</th><th>Status</th><th>Winner</th><th>Price</th><th>Points</th></tr></thead><tbody>{lots.map(l => <tr key={l.id}><td>{l.order}</td><td>{fmtTime(l.scheduledAt)}</td><td>{l.rank}</td><td><b>{l.country}</b></td><td><span className={`badge ${l.status}`}>{l.status}</span></td><td>{l.winningBidder || "—"}</td><td>{l.finalPrice || "—"}</td><td>{l.points || 0}</td></tr>)}</tbody></table></div>;
}

function Portfolio({ user, participantsObj, scheduleObj }) {
  const { participants } = deriveStats(participantsObj, scheduleObj);
  const me = participants.find(p => p.id === user.id) || { holdings: [], spent: 0, points: 0, profit: 0, remaining: STARTING_CREDITS };
  return <div className="container grid">
    <div className="grid three">
      <div className="kpi"><div className="label">Points</div><div className="value">{money(me.points)}</div></div>
      <div className="kpi"><div className="label">Credits spent</div><div className="value">{money(me.spent)}</div></div>
      <div className="kpi"><div className="label">Profit</div><div className="value">{money(me.profit)}</div></div>
    </div>
    <div className="card"><h2>Your Portfolio</h2>{me.holdings.length ? <table><thead><tr><th>Rank</th><th>Country</th><th>Share</th><th>Purchase Price</th><th>Points</th><th>Profit</th></tr></thead><tbody>{me.holdings.map(l => <tr key={l.id}><td>{l.rank}</td><td><b>{l.country}</b></td><td>100%</td><td>{l.finalPrice}</td><td>{l.points || 0}</td><td>{money(Number(l.points || 0) - Number(l.finalPrice || 0))}</td></tr>)}</tbody></table> : <p className="muted">No countries yet.</p>}</div>
  </div>;
}

function Leaderboard({ participantsObj, scheduleObj }) {
  const { participants } = deriveStats(participantsObj, scheduleObj);
  const sorted = participants.sort((a,b) => b.profit - a.profit || b.points - a.points);
  return <div className="container card"><h2>Leaderboard</h2><p className="muted">Profit = points earned − credits spent.</p><table><thead><tr><th>Rank</th><th>Participant</th><th>Points</th><th>Spent</th><th>Remaining</th><th>Profit</th><th>Holdings</th></tr></thead><tbody>{sorted.map((p,i) => <tr key={p.id}><td>{i+1}</td><td><b>{p.name}</b></td><td>{money(p.points)}</td><td>{money(p.spent)}</td><td>{money(p.remaining)}</td><td><b>{money(p.profit)}</b></td><td>{p.holdings.length}</td></tr>)}</tbody></table></div>;
}

function Admin({ participantsObj, scheduleObj }) {
  const { participants, lots } = deriveStats(participantsObj, scheduleObj);
  const [startTime, setStartTime] = useState(new Date().toISOString().slice(0,16));
  const [scoreCountry, setScoreCountry] = useState(countries[0].name);
  const [points, setPoints] = useState(3);
  const [customName, setCustomName] = useState("");

  async function initSchedule() {
    if (!confirm("Initialize/reset auction schedule? This will overwrite current lots.")) return;
    const schedule = buildDefaultSchedule(new Date(startTime).toISOString());
    const obj = Object.fromEntries(schedule.map(l => [l.id, l]));
    await set(path("schedule"), obj);
    await set(path("auctionState"), { status: "idle", currentLotId: "", endAt: 0 });
    await set(path("bids"), {});
  }
  async function addParticipant() {
    const trimmed = customName.trim(); if (!trimmed) return;
    const id = slug(trimmed);
    await update(path(`participants/${id}`), { id, name: trimmed, role: "participant", startingCredits: STARTING_CREDITS, joinedAt: Date.now() });
    setCustomName("");
  }
  async function addPoints() {
    const lot = lots.find(l => l.country === scoreCountry);
    if (!lot) return;
    await update(path(`schedule/${lot.id}`), { points: Number(lot.points || 0) + Number(points || 0) });
  }
  async function removeParticipant(participant) {
    if (participant.id === "admin") return alert("Admin cannot be removed.");
    if (Number(participant.spent || 0) > 0 || Number(participant.holdings?.length || 0) > 0) {
      return alert("This participant already won at least one country. For this MVP, remove participants before they win a country, or clear/reset the league database.");
    }
    if (!confirm(`Remove ${participant.name} from the participant list?`)) return;
    await set(path(`participants/${participant.id}`), null);
  }

  async function clearAll() {
    if (!confirm("Clear the whole MVP league database?")) return;
    await set(ref(db, `leagues/${LEAGUE_ID}`), null);
  }

  return <div className="container grid two">
    <div className="card adminOnly"><h2>Admin Setup</h2><p className="muted">MVP admin controls. Use username <b>admin</b>.</p>
      <h3>Initialize schedule</h3><div className="row"><input type="datetime-local" value={startTime} onChange={e => setStartTime(e.target.value)} /><button onClick={initSchedule}><RefreshCw size={15}/> Initialize / Reset Schedule</button></div>
      <h3>Add participant</h3><div className="row"><input value={customName} onChange={e=>setCustomName(e.target.value)} placeholder="Participant name"/><button onClick={addParticipant}>Add</button></div>
      <h3>Manual scoring</h3><div className="row"><select value={scoreCountry} onChange={e=>setScoreCountry(e.target.value)}>{countries.map(c => <option key={c.name}>{c.name}</option>)}</select><input type="number" value={points} onChange={e=>setPoints(e.target.value)} style={{ width:100 }}/><button onClick={addPoints}>Add points</button></div>
      <hr/><button className="danger" onClick={clearAll}>Clear league database</button>
    </div>
    <div className="card"><h2>Participants</h2><table><thead><tr><th>Name</th><th>Role</th><th>Spent</th><th>Remaining</th><th>Action</th></tr></thead><tbody>{participants.map(p => <tr key={p.id}><td>{p.name}</td><td>{p.role || "participant"}</td><td>{money(p.spent)}</td><td>{money(p.remaining)}</td><td>{p.id === "admin" ? <span className="muted">—</span> : <button className="danger small" onClick={() => removeParticipant(p)}>Remove</button>}</td></tr>)}</tbody></table></div>
  </div>;
}

function App() {
  const [user, setUser] = useState(() => {
    const name = localStorage.getItem("wcpc_username");
    return name ? { id: slug(name), name, role: name.toLowerCase() === "admin" ? "admin" : "participant" } : null;
  });
  const [page, setPage] = useState("auction");
  const [participantsObj] = useFirebaseValue("participants", {});
  const [scheduleObj] = useFirebaseValue("schedule", {});
  const [auctionState] = useFirebaseValue("auctionState", { status: "idle", currentLotId: "", endAt: 0 });
  if (!user) return <Login onLogin={setUser} />;
  const isAdmin = user.name.toLowerCase() === "admin" || participantsObj?.[user.id]?.role === "admin";
  const logout = () => { localStorage.removeItem("wcpc_username"); setUser(null); };
  return <div className="app"><Header page={page} setPage={setPage} user={user} onLogout={logout} />
    {page === "auction" && <Auction user={user} isAdmin={isAdmin} participantsObj={participantsObj} scheduleObj={scheduleObj} auctionState={auctionState} />}
    {page === "schedule" && <Schedule scheduleObj={scheduleObj} />}
    {page === "portfolio" && <Portfolio user={user} participantsObj={participantsObj} scheduleObj={scheduleObj} />}
    {page === "leaderboard" && <Leaderboard participantsObj={participantsObj} scheduleObj={scheduleObj} />}
    {page === "admin" && <Admin participantsObj={participantsObj} scheduleObj={scheduleObj} />}
    <div className="footer">Auction MVP · Trades and ESPN automation are planned for v1.1</div>
  </div>;
}

createRoot(document.getElementById("root")).render(<App />);
