import { FormEvent, useEffect, useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import type { HostRoomView, PackSummary, PlayerRoomView, RoomMode, WordPack } from "../shared/types";
import {
  ApiRequestError,
  createLibrary,
  createRoom,
  deleteLibrary,
  getBuiltInPacks,
  getLibrary,
  getPublicRoom,
  joinRoom,
  roomAction,
  saveLibrary,
  startGame,
} from "./api";
import type { ConnectionState } from "./useRoom";
import { useRoom } from "./useRoom";

const LIBRARY_KEY_STORAGE = "whisker-word:library-key";

function navigate(path: string) {
  window.location.assign(path);
}

function roomCodeFromPath(index: number): string {
  return window.location.pathname.split("/").filter(Boolean)[index]?.toUpperCase() ?? "";
}

function Mascots({ focus = "both", className = "" }: { focus?: "both" | "kitten" | "pup"; className?: string }) {
  return (
    <div className={`mascots mascots--${focus} ${className}`} aria-hidden="true">
      <img src="/mascots.png" alt="" />
    </div>
  );
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <a className={`brand ${compact ? "brand--compact" : ""}`} href="/" aria-label="Whisker Word home">
      <span className="brand__mark">W</span>
      <span>Whisker Word</span>
    </a>
  );
}

function PageHeader({ action }: { action?: React.ReactNode }) {
  return (
    <header className="topbar">
      <Brand compact />
      {action}
    </header>
  );
}

function ConnectionBadge({ state }: { state: ConnectionState }) {
  const labels: Record<ConnectionState, string> = {
    live: "Live",
    connecting: "Connecting",
    polling: "Reconnecting",
    offline: "Offline",
  };
  return <span className={`connection connection--${state}`}><span />{labels[state]}</span>;
}

function InlineError({ message }: { message?: string | null }) {
  return message ? <div className="notice notice--error" role="alert">{message}</div> : null;
}

function HomePage() {
  const [creating, setCreating] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    setCreating(true);
    setError(null);
    try {
      const room = await createRoom();
      localStorage.setItem(`whisker-word:host:${room.code}`, room.hostToken);
      navigate(`/host/${room.code}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The room could not be created.");
      setCreating(false);
    }
  }

  async function handleJoin(event: FormEvent) {
    event.preventDefault();
    const code = joinCode.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
    if (code.length !== 6) {
      setError("Enter the six-character room code.");
      return;
    }
    try {
      await getPublicRoom(code);
      navigate(`/room/${code}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Room not found.");
    }
  }

  return (
    <main className="home-shell">
      <PageHeader action={<a className="text-link" href="/library">My word library</a>} />
      <section className="hero">
        <div className="hero__copy">
          <div className="eyebrow">One QR. Every secret. Zero installs.</div>
          <h1>Same room.<br /><em>Different words.</em></h1>
          <p className="hero__lede">A fast, private word game for the people already sitting around your table.</p>
          <div className="hero__actions">
            <button className="button button--primary button--large" onClick={handleCreate} disabled={creating}>
              {creating ? "Opening room…" : "Create a room"}
            </button>
            <form className="join-form" onSubmit={handleJoin}>
              <label htmlFor="room-code">Join with a code</label>
              <div>
                <input
                  id="room-code"
                  inputMode="text"
                  autoCapitalize="characters"
                  autoComplete="off"
                  maxLength={6}
                  placeholder="PAWS24"
                  value={joinCode}
                  onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
                />
                <button className="button button--dark" type="submit">Join</button>
              </div>
            </form>
          </div>
          <InlineError message={error} />
          <ul className="trust-list" aria-label="Game benefits">
            <li>No player accounts</li><li>4–12 players</li><li>Phones update live</li>
          </ul>
        </div>
        <div className="hero__art">
          <div className="speech speech--kitten">I know the word.</div>
          <Mascots />
          <div className="speech speech--pup">…probably.</div>
        </div>
      </section>
      <section className="how-it-works">
        <article><span>01</span><h2>Open a room</h2><p>Keep the controls on the computer and put one QR code on screen.</p></article>
        <article><span>02</span><h2>Scan once</h2><p>Every player’s phone becomes a private card for the whole session.</p></article>
        <article><span>03</span><h2>Give a clue</h2><p>Spot the slightly-wrong Kittens and the wordless Spy Pup.</p></article>
      </section>
      <section className="rule-strip">
        <div><strong>Good Kittens</strong><span>Share the correct word</span></div>
        <div><strong>Confused Kittens</strong><span>Share one related word</span></div>
        <div><strong>Spy Pup</strong><span>Gets no word at all</span></div>
      </section>
      <footer><Brand compact /><span>Original art and 120 original word pairs.</span></footer>
    </main>
  );
}

function HostPage({ code }: { code: string }) {
  const token = localStorage.getItem(`whisker-word:host:${code}`);
  const { room: rawRoom, connection, error, setRoom } = useRoom(code, token);
  const room = rawRoom?.viewer === "host" ? rawRoom as HostRoomView : null;
  const [packs, setPacks] = useState<PackSummary[]>([]);
  const [selectedPackIds, setSelectedPackIds] = useState<string[]>([]);
  const [library, setLibrary] = useState<WordPack[]>([]);
  const [selectedCustomIds, setSelectedCustomIds] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const joinUrl = `${window.location.origin}/room/${code}`;

  useEffect(() => {
    void getBuiltInPacks().then((next) => {
      setPacks(next);
      setSelectedPackIds(next.map((pack) => pack.id));
    }).catch((caught) => setActionError(caught instanceof Error ? caught.message : "Word packs could not load."));
    const key = localStorage.getItem(LIBRARY_KEY_STORAGE);
    if (key) {
      void getLibrary(key).then((next) => {
        setLibrary(next.packs);
        setSelectedCustomIds(next.packs.map((pack) => pack.id));
      }).catch(() => localStorage.removeItem(LIBRARY_KEY_STORAGE));
    }
  }, []);

  if (!token) {
    return <SimpleMessage title="Host key not found" message="This browser no longer has control of that room. Create a new room to continue." />;
  }
  const hostToken = token;

  async function run(label: string, action: () => Promise<unknown>) {
    setBusy(label);
    setActionError(null);
    try {
      const result = await action();
      if (result && typeof result === "object" && "viewer" in result) setRoom(result as HostRoomView);
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "That action did not complete.");
    } finally {
      setBusy(null);
    }
  }

  async function changeMode(mode: RoomMode) {
    await run("mode", () => roomAction(code, hostToken, "host/settings", { mode }));
  }

  async function beginGame() {
    const customPairs = library.filter((pack) => selectedCustomIds.includes(pack.id)).flatMap((pack) => pack.pairs);
    await run("start", () => startGame(code, hostToken, room?.mode ?? "official", selectedPackIds, customPairs));
  }

  async function copyJoinLink() {
    await navigator.clipboard.writeText(joinUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1_800);
  }

  async function endRoom() {
    if (!window.confirm("End this room now? Player names and all current game data will be deleted.")) return;
    await run("end", async () => {
      await roomAction(code, hostToken, "host/end");
      localStorage.removeItem(`whisker-word:host:${code}`);
      navigate("/");
    });
  }

  const selectedCount = selectedPackIds.length + selectedCustomIds.length;
  const canStart = !!room && room.players.length >= 4 && room.players.length <= room.maximumPlayers && selectedCount > 0;

  return (
    <main className="app-shell">
      <PageHeader action={<div className="topbar__status"><ConnectionBadge state={connection} /><button className="text-button danger-text" onClick={endRoom}>End room</button></div>} />
      <InlineError message={actionError ?? error} />
      <div className="host-grid">
        <section className="panel share-panel">
          <div className="section-heading"><div><div className="eyebrow">Room code</div><h1>{code}</h1></div><span className="pill">{room?.players.length ?? 0} joined</span></div>
          <div className="qr-wrap"><QRCodeSVG value={joinUrl} size={214} level="M" bgColor="#fffaf2" fgColor="#1f2524" /></div>
          <p>Everyone scans this same QR once. Their page updates for every game.</p>
          <button className="button button--secondary button--full" onClick={copyJoinLink}>{copied ? "Link copied" : "Copy join link"}</button>
        </section>

        <section className="panel players-panel">
          <div className="section-heading"><div><div className="eyebrow">The table</div><h2>Players</h2></div>{room?.phase === "active" && <span className="pill pill--accent">{room.readyCount}/{room.players.length} ready</span>}</div>
          {!room?.players.length ? <div className="empty-state"><span>Waiting for paws…</span><p>Joined players will appear here.</p></div> : (
            <ul className="player-list">
              {room.players.map((player, index) => (
                <li key={player.id}>
                  <span className="avatar">{player.name.slice(0, 1).toUpperCase()}</span>
                  <div><strong>{player.name}</strong><small>{player.connected ? "Phone connected" : "Page sleeping"}</small></div>
                  {room.phase === "active" ? <span className={`ready-dot ${player.ready ? "ready-dot--yes" : ""}`}>{player.ready ? "Ready" : "Waiting"}</span> : (
                    <button className="icon-button" aria-label={`Remove ${player.name}`} disabled={busy !== null} onClick={() => run("remove", () => roomAction(code, hostToken, "host/remove", { playerId: player.id }))}>×</button>
                  )}
                  {room.firstPlayerName === player.name && <span className="first-tag">First clue</span>}
                  <span className="player-number">{index + 1}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel controls-panel">
          <div className="section-heading"><div><div className="eyebrow">Game setup</div><h2>{room?.phase === "active" ? `Game ${room.gameNumber} is live` : room?.phase === "revealed" ? `Game ${room.gameNumber} revealed` : "Choose your game"}</h2></div></div>
          {room?.phase === "active" ? (
            <div className="live-controls">
              <Mascots focus="pup" />
              <p><strong>{room.firstPlayerName}</strong> gives the first one-word clue.</p>
              <p className="muted">Clue, debate, and vote in person. Reveal the game when you are finished.</p>
              <button className="button button--primary button--full" disabled={busy !== null} onClick={() => run("reveal", () => roomAction(code, hostToken, "host/reveal"))}>{busy === "reveal" ? "Revealing…" : "Reveal game"}</button>
            </div>
          ) : (
            <>
              <fieldset className="mode-picker">
                <legend>Player range</legend>
                <label className={room?.mode === "official" ? "selected" : ""}><input type="radio" checked={room?.mode === "official"} onChange={() => changeMode("official")} /> <span><strong>Official</strong><small>4–8 players</small></span></label>
                <label className={room?.mode === "experimental" ? "selected" : ""}><input type="radio" checked={room?.mode === "experimental"} onChange={() => changeMode("experimental")} /> <span><strong>Experimental</strong><small>4–12 players</small></span></label>
              </fieldset>
              <div className="pack-picker">
                <div className="field-label">Built-in packs</div>
                <div className="chip-grid">
                  {packs.map((pack) => (
                    <label key={pack.id} className={selectedPackIds.includes(pack.id) ? "chip chip--selected" : "chip"}>
                      <input type="checkbox" checked={selectedPackIds.includes(pack.id)} onChange={() => setSelectedPackIds((current) => current.includes(pack.id) ? current.filter((id) => id !== pack.id) : [...current, pack.id])} />
                      <span>{pack.name}<small>{pack.pairCount} pairs</small></span>
                    </label>
                  ))}
                </div>
                {library.length > 0 && <><div className="field-label field-label--spaced">My custom packs</div><div className="chip-grid">{library.map((pack) => (
                  <label key={pack.id} className={selectedCustomIds.includes(pack.id) ? "chip chip--selected chip--custom" : "chip chip--custom"}>
                    <input type="checkbox" checked={selectedCustomIds.includes(pack.id)} onChange={() => setSelectedCustomIds((current) => current.includes(pack.id) ? current.filter((id) => id !== pack.id) : [...current, pack.id])} />
                    <span>{pack.name}<small>{pack.pairs.length} pairs</small></span>
                  </label>
                ))}</div></>}
                <a className="text-link manage-link" href="/library">{library.length ? "Edit my word library" : "Create a custom word library"}</a>
              </div>
              <button className="button button--primary button--large button--full" disabled={!canStart || busy !== null} onClick={beginGame}>
                {busy === "start" ? "Dealing secrets…" : room?.phase === "revealed" ? "Start next game" : "Deal the first game"}
              </button>
              {!canStart && <p className="helper">You need 4–{room?.maximumPlayers ?? 8} players and at least one selected pack.</p>}
            </>
          )}
        </section>
      </div>
    </main>
  );
}

function PlayerPage({ code }: { code: string }) {
  const storageKey = `whisker-word:seat:${code}`;
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(storageKey));
  const { room: rawRoom, connection, error, setRoom } = useRoom(code, token);
  const room = rawRoom?.viewer === "player" ? rawRoom as PlayerRoomView : null;
  const [name, setName] = useState("");
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [cardOpen, setCardOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setCardOpen(false);
  }, [room?.gameNumber]);

  useEffect(() => {
    const hide = () => {
      if (document.visibilityState !== "visible") setCardOpen(false);
    };
    document.addEventListener("visibilitychange", hide);
    window.addEventListener("blur", hide);
    return () => {
      document.removeEventListener("visibilitychange", hide);
      window.removeEventListener("blur", hide);
    };
  }, []);

  async function submitJoin(event: FormEvent) {
    event.preventDefault();
    setJoining(true);
    setJoinError(null);
    try {
      await getPublicRoom(code);
      const result = await joinRoom(code, name);
      localStorage.setItem(storageKey, result.seatToken);
      setToken(result.seatToken);
    } catch (caught) {
      setJoinError(caught instanceof Error ? caught.message : "You could not join this room.");
      setJoining(false);
    }
  }

  async function playerAction(action: string) {
    if (!token) return;
    setBusy(true);
    setJoinError(null);
    try {
      const next = await roomAction<PlayerRoomView>(code, token, action);
      setRoom(next);
    } catch (caught) {
      setJoinError(caught instanceof Error ? caught.message : "That action did not complete.");
    } finally {
      setBusy(false);
    }
  }

  if (!token) {
    return (
      <main className="player-shell player-shell--join">
        <PageHeader action={<span className="room-mini">Room {code}</span>} />
        <section className="join-card">
          <Mascots focus="kitten" />
          <div className="eyebrow">You found the room</div>
          <h1>Pick your player name</h1>
          <p>This phone will remember your seat for every game in this room.</p>
          <form onSubmit={submitJoin}>
            <label htmlFor="player-name">Your name</label>
            <input id="player-name" autoComplete="nickname" maxLength={24} placeholder="Jordan" value={name} onChange={(event) => setName(event.target.value)} autoFocus />
            <button className="button button--primary button--large button--full" disabled={joining || !name.trim()}>{joining ? "Joining…" : "Join the table"}</button>
          </form>
          <InlineError message={joinError} />
        </section>
      </main>
    );
  }

  if (!room) return <LoadingRoom code={code} error={error} connection={connection} />;

  const hasCurrentCard = room.phase !== "lobby" && !!room.visibleRole;
  const exactRoleLabel = room.exactRole === "good" ? "Good Kitten" : room.exactRole === "confused" ? "Confused Kitten" : room.exactRole === "spy" ? "Spy Pup" : null;

  return (
    <main className={`player-shell player-shell--${room.phase}`}>
      <PageHeader action={<div className="topbar__status"><ConnectionBadge state={connection} /><span className="room-mini">{code}</span></div>} />
      <section className="player-stage">
        <div className="player-greeting"><span>Playing as</span><strong>{room.playerName}</strong></div>
        {room.phase === "lobby" && (
          <div className="waiting-view">
            <Mascots />
            <div className="eyebrow">You’re in</div>
            <h1>Keep this page open.</h1>
            <p>The host will deal your private card when everyone is ready.</p>
            <span className="pill">{room.playerCount} player{room.playerCount === 1 ? "" : "s"} joined</span>
          </div>
        )}

        {room.phase === "active" && !hasCurrentCard && (
          <div className="waiting-view"><Mascots focus="kitten" /><div className="eyebrow">Game in progress</div><h1>You’re queued for the next one.</h1><p>You joined after this game was dealt. Stay here—your first card will arrive automatically.</p></div>
        )}

        {hasCurrentCard && room.phase === "active" && (
          <div className="secret-view">
            <div className="first-player-banner">{room.firstPlayerName === room.playerName ? "You give the first clue" : `${room.firstPlayerName} gives the first clue`}</div>
            <button
              className={`secret-card ${cardOpen ? "secret-card--open" : ""} ${room.visibleRole === "spy-pup" ? "secret-card--spy" : ""}`}
              onClick={() => setCardOpen((current) => !current)}
              aria-expanded={cardOpen}
            >
              {!cardOpen ? (
                <div className="card-back"><span className="card-paw">✦</span><small>Private card</small><strong>Tap to reveal</strong><span>Shield your screen</span></div>
              ) : room.visibleRole === "spy-pup" ? (
                <div className="card-face"><Mascots focus="pup" /><div className="eyebrow">You are the</div><h1>Spy Pup</h1><p>No password for you. Listen closely and bluff.</p></div>
              ) : (
                <div className="card-face"><Mascots focus="kitten" /><div className="eyebrow">Your password</div><h1>{room.word}</h1><p>You’re a Kitten—but are you Good or Confused?</p></div>
              )}
            </button>
            <p className="tap-hint">Tap again to hide your card.</p>
            {!room.ready && <button className="button button--primary button--full" disabled={busy} onClick={() => playerAction("player/ready")}>I’ve seen my card</button>}
            {room.ready && <div className="ready-confirmation">✓ Ready — keep your word secret</div>}
            {!room.exactRole && room.visibleRole === "kitten" && <button className="text-button reveal-self" disabled={busy} onClick={() => window.confirm("Only do this after you have been voted out. Reveal your exact identity now?") && playerAction("player/reveal")}>I was voted out — reveal my identity</button>}
            {room.visibleRole === "spy-pup" && !room.goodWord && <button className="text-button reveal-self" disabled={busy} onClick={() => window.confirm("Say your final password guess aloud before checking. Show the answer now?") && playerAction("player/spy-answer")}>I said my final guess — check the answer</button>}
            {exactRoleLabel && <div className="identity-reveal"><span>Your identity</span><strong>{exactRoleLabel}</strong>{room.goodWord && <p>The correct password was <b>{room.goodWord}</b>.</p>}</div>}
          </div>
        )}

        {room.phase === "revealed" && (
          <div className="final-reveal">
            <Mascots focus={room.exactRole === "spy" ? "pup" : "kitten"} />
            <div className="eyebrow">Game {room.gameNumber} revealed</div>
            <h1>{exactRoleLabel}</h1>
            <div className="word-results"><div><span>Good password</span><strong>{room.goodWord}</strong></div><div><span>Confused password</span><strong>{room.confusedWord}</strong></div></div>
            <p>Keep this page open. The next private card will arrive here automatically.</p>
          </div>
        )}
        <InlineError message={joinError ?? error} />
      </section>
    </main>
  );
}

function LibraryPage() {
  const [key, setKey] = useState<string | null>(() => localStorage.getItem(LIBRARY_KEY_STORAGE));
  const [recoveryInput, setRecoveryInput] = useState("");
  const [packs, setPacks] = useState<WordPack[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const totalPairs = useMemo(() => packs?.reduce((sum, pack) => sum + pack.pairs.length, 0) ?? 0, [packs]);

  useEffect(() => {
    if (!key) return;
    void getLibrary(key).then((library) => setPacks(library.packs)).catch((caught) => {
      setError(caught instanceof Error ? caught.message : "Library could not be opened.");
      setPacks(null);
    });
  }, [key]);

  async function makeLibrary() {
    setBusy(true); setError(null);
    try {
      const result = await createLibrary();
      localStorage.setItem(LIBRARY_KEY_STORAGE, result.recoveryKey);
      setKey(result.recoveryKey);
      setPacks(result.library.packs);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Library could not be created.");
    } finally { setBusy(false); }
  }

  async function recoverLibrary(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setError(null);
    try {
      const library = await getLibrary(recoveryInput.trim());
      localStorage.setItem(LIBRARY_KEY_STORAGE, recoveryInput.trim());
      setKey(recoveryInput.trim());
      setPacks(library.packs);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "That recovery key did not work.");
    } finally { setBusy(false); }
  }

  function updatePack(packId: string, updater: (pack: WordPack) => WordPack) {
    setPacks((current) => current?.map((pack) => pack.id === packId ? updater(pack) : pack) ?? []);
    setSaved(false);
  }

  async function persist() {
    if (!key || !packs) return;
    setBusy(true); setError(null);
    try {
      const result = await saveLibrary(key, packs);
      setPacks(result.packs);
      setSaved(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Library could not be saved.");
    } finally { setBusy(false); }
  }

  async function removeLibrary() {
    if (!key || !window.confirm("Permanently delete this custom word library? The recovery key will stop working.")) return;
    setBusy(true);
    try {
      await deleteLibrary(key);
      localStorage.removeItem(LIBRARY_KEY_STORAGE);
      setKey(null); setPacks(null);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Library could not be deleted."); }
    finally { setBusy(false); }
  }

  if (!key || packs === null) {
    return (
      <main className="app-shell library-shell">
        <PageHeader action={<a className="text-link" href="/">Back to game</a>} />
        <section className="library-welcome">
          <Mascots focus="kitten" />
          <div className="eyebrow">Private cloud library</div>
          <h1>Your words, ready for game night.</h1>
          <p>Create custom Good and Confused password pairs. No account or email needed.</p>
          <button className="button button--primary button--large" onClick={makeLibrary} disabled={busy}>{busy ? "Opening…" : "Create my library"}</button>
          <div className="divider"><span>or restore one</span></div>
          <form className="recovery-form" onSubmit={recoverLibrary}><label htmlFor="recovery-key">Private recovery key</label><div><input id="recovery-key" value={recoveryInput} onChange={(event) => setRecoveryInput(event.target.value)} placeholder="Paste your saved key" /><button className="button button--dark" disabled={busy || recoveryInput.length < 32}>Restore</button></div></form>
          <InlineError message={error} />
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell library-shell">
      <PageHeader action={<a className="text-link" href="/">Back to game</a>} />
      <section className="library-editor">
        <div className="library-title"><div><div className="eyebrow">My custom library</div><h1>Word packs</h1><p>{packs.length} {packs.length === 1 ? "pack" : "packs"} · {totalPairs} of 500 pairs</p></div><div className="library-actions"><button className="button button--secondary" onClick={() => navigator.clipboard.writeText(key)}>Copy recovery key</button><button className="button button--primary" disabled={busy} onClick={persist}>{busy ? "Saving…" : saved ? "Saved ✓" : "Save library"}</button></div></div>
        <div className="key-warning"><strong>Keep your recovery key private.</strong><span>It is the only way to open this library on another computer.</span></div>
        <div className="pack-editor-list">
          {packs.map((pack) => (
            <article className="pack-editor" key={pack.id}>
              <div className="pack-editor__head"><input aria-label="Pack name" value={pack.name} onChange={(event) => updatePack(pack.id, (current) => ({ ...current, name: event.target.value }))} /><button className="icon-button" aria-label={`Delete ${pack.name}`} onClick={() => setPacks((current) => current?.filter((candidate) => candidate.id !== pack.id) ?? [])}>×</button></div>
              <div className="pair-labels"><span>Good password</span><span>Confused password</span><span /></div>
              {pack.pairs.map((pair, pairIndex) => (
                <div className="pair-row" key={`${pack.id}-${pairIndex}`}>
                  <input aria-label="Good password" placeholder="Good password" value={pair.goodWord} onChange={(event) => updatePack(pack.id, (current) => ({ ...current, pairs: current.pairs.map((candidate, index) => index === pairIndex ? { ...candidate, goodWord: event.target.value } : candidate) }))} />
                  <input aria-label="Confused password" placeholder="Confused password" value={pair.confusedWord} onChange={(event) => updatePack(pack.id, (current) => ({ ...current, pairs: current.pairs.map((candidate, index) => index === pairIndex ? { ...candidate, confusedWord: event.target.value } : candidate) }))} />
                  <button className="icon-button" aria-label="Delete pair" onClick={() => updatePack(pack.id, (current) => ({ ...current, pairs: current.pairs.filter((_, index) => index !== pairIndex) }))}>×</button>
                </div>
              ))}
              <button className="text-button add-pair" disabled={totalPairs >= 500} onClick={() => updatePack(pack.id, (current) => ({ ...current, pairs: [...current.pairs, { goodWord: "", confusedWord: "" }] }))}>+ Add a password pair</button>
            </article>
          ))}
          {packs.length === 0 && <div className="empty-library"><Mascots focus="kitten" /><h2>No custom packs yet</h2><p>Start with a name, then add closely related password pairs.</p></div>}
        </div>
        <button className="button button--dark add-pack-button" disabled={packs.length >= 20} onClick={() => { setPacks((current) => [...(current ?? []), { id: `custom-${crypto.randomUUID()}`, name: `New pack ${(current?.length ?? 0) + 1}`, pairs: [{ goodWord: "", confusedWord: "" }] }]); setSaved(false); }}>+ Add another pack</button>
        <InlineError message={error} />
        <button className="text-button danger-text delete-library" disabled={busy} onClick={removeLibrary}>Delete this entire library</button>
      </section>
    </main>
  );
}

function LoadingRoom({ code, error, connection }: { code: string; error: string | null; connection: ConnectionState }) {
  return <main className="player-shell"><PageHeader action={<ConnectionBadge state={connection} />} /><section className="waiting-view loading-view"><Mascots focus="kitten" /><div className="eyebrow">Room {code}</div><h1>Finding your seat…</h1><InlineError message={error} /></section></main>;
}

function SimpleMessage({ title, message }: { title: string; message: string }) {
  return <main className="app-shell"><PageHeader /><section className="simple-message"><Mascots focus="kitten" /><h1>{title}</h1><p>{message}</p><a className="button button--primary" href="/">Return home</a></section></main>;
}

export function App() {
  const path = window.location.pathname.split("/").filter(Boolean);
  if (path[0] === "host" && path[1]) return <HostPage code={roomCodeFromPath(1)} />;
  if (path[0] === "room" && path[1]) return <PlayerPage code={roomCodeFromPath(1)} />;
  if (path[0] === "library") return <LibraryPage />;
  return <HomePage />;
}
