import { FormEvent, useEffect, useState } from "react";
import { MIN_PLAYERS, ROLE_NAMES, roleDistribution } from "../shared/rules";
import type { PlayerRoomView } from "../shared/types";
import { getPublicRoom, joinRoom, roomAction } from "./api";
import { HostControls, lobbyPreviewCount, useHostActions } from "./host";
import {
  ConnectionBadge,
  InlineError,
  InvitePanel,
  Mascots,
  OutcomeBanner,
  PageHeader,
  RoleTiles,
  TableList,
  errorText,
  hostTokenKey,
  seatTokenKey,
} from "./ui";
import { useRoom } from "./useRoom";

const GUIDE_STEPS = ["Peek", "Clue", "Vote"] as const;

/** One line telling this player what to do right now, with the step of the round it belongs to. */
function roundGuide(room: PlayerRoomView): { step: number; title: string; text: string } {
  const unpeeked = room.table.filter((seat) => seat.inGame && !seat.ready && !seat.out).length;
  if (room.out) {
    return {
      step: -1,
      title: "You’re out",
      text: room.exactRole === "spy"
        ? "Check the word below against the guess you said out loud."
        : "Stay quiet and keep your word to yourself. The round goes on without you.",
    };
  }
  if (room.outcome) {
    return { step: 3, title: "The round is decided", text: "Keep your card to yourself. Every card shows once the host ends the round." };
  }
  if (!room.ready) return { step: 0, title: "Peek at your card", text: "Tap the card to see your secret word. Tilt the screen away from everyone else." };
  if (unpeeked > 0) {
    return { step: 0, title: `Waiting for ${unpeeked} more to peek`, text: "Next, go round the table and give one clue each." };
  }
  return {
    step: 1,
    title: "Clue, then vote",
    text: "Go round the table: one short clue each about your word, without saying it. Then talk it over and vote one player out. Repeat until the round is decided.",
  };
}

function RoundGuide({ room }: { room: PlayerRoomView }) {
  const guide = roundGuide(room);
  return (
    <div className={`guide ${room.out ? "guide--out" : ""}`} aria-live="polite">
      <ol className="guide__steps" aria-label="Round steps">
        {GUIDE_STEPS.map((label, index) => {
          const current = guide.step === 1 && index >= 1 || index === guide.step;
          return <li key={label} className={current ? "is-current" : index < guide.step ? "is-done" : ""}>{index < guide.step && !current ? "✓ " : ""}{label}</li>;
        })}
      </ol>
      <strong>{guide.title}</strong>
      <p>{guide.text}</p>
    </div>
  );
}

function SecretCard({ room, open, onToggle }: { room: PlayerRoomView; open: boolean; onToggle: () => void }) {
  const spy = room.visibleRole === "spy-pup";
  return (
    <button className={`secret-card ${open ? "secret-card--open" : ""} ${spy ? "secret-card--spy" : ""}`} onClick={onToggle} aria-expanded={open}>
      {!open ? (
        <div className="card-back"><span className="card-paw">✦</span><strong>Tap to peek</strong><span>Shield your screen</span></div>
      ) : spy ? (
        <div className="card-face">
          <Mascots focus="pup" />
          <div className="eyebrow">You are the</div>
          <h1>Spy Pup</h1>
          <p>No word for you. Listen to the clues and blend in. If you get voted out, you get one guess at the word.</p>
        </div>
      ) : (
        <div className="card-face">
          <Mascots focus="kitten" />
          <div className="eyebrow">Your secret word</div>
          <h1>{room.word}</h1>
          <p>You’re a Kitten, but some Kittens got a slightly different word. Listen for clues that don’t quite fit yours.</p>
        </div>
      )}
    </button>
  );
}

function article(word: string) {
  return /^[AEIOU]/i.test(word) ? "an" : "a";
}

export function PlayerPage({ code }: { code: string }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(seatTokenKey(code)));
  const hostToken = localStorage.getItem(hostTokenKey(code));
  const { room: rawRoom, connection, error, setRoom } = useRoom(code, token);
  const room = rawRoom?.viewer === "player" ? rawRoom : null;
  const host = useRoom(code, token ? hostToken : null);
  const hostRoom = host.room?.viewer === "host" ? host.room : null;
  const hostActions = useHostActions(code, hostToken ?? "", host.setRoom);
  const removeSeat = hostToken && hostRoom ? hostActions.remove : undefined;
  const [name, setName] = useState("");
  const [joining, setJoining] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
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
    setActionError(null);
    try {
      await getPublicRoom(code);
      const result = await joinRoom(code, name);
      localStorage.setItem(seatTokenKey(code), result.seatToken);
      setToken(result.seatToken);
    } catch (caught) {
      setActionError(errorText(caught, "You could not join this room."));
      setJoining(false);
    }
  }

  async function playerAction(action: "player/ready" | "player/out") {
    if (!token) return;
    setBusy(true);
    setActionError(null);
    try {
      setRoom(await roomAction<PlayerRoomView>(code, token, action));
    } catch (caught) {
      setActionError(errorText(caught, "That action did not complete."));
    } finally {
      setBusy(false);
    }
  }

  if (!token) {
    return (
      <main className="player-shell player-shell--join">
        <PageHeader narrow action={<span className="room-mini">Room {code}</span>} />
        <section className="join-card">
          <Mascots focus="kitten" />
          <div className="eyebrow">You found the room</div>
          <h1>Pick your player name</h1>
          <p>This phone keeps your seat for every round in this room.</p>
          <form onSubmit={submitJoin}>
            <label htmlFor="player-name">Your name</label>
            <input id="player-name" autoComplete="nickname" maxLength={24} placeholder="Jordan" value={name} onChange={(event) => setName(event.target.value)} autoFocus />
            <button className="button button--primary button--large button--full" disabled={joining || !name.trim()}>{joining ? "Joining…" : "Join the table"}</button>
          </form>
          <InlineError message={actionError} />
        </section>
      </main>
    );
  }

  if (!room) {
    return (
      <main className="player-shell">
        <PageHeader narrow action={<ConnectionBadge state={connection} />} />
        <section className="waiting-view loading-view"><Mascots focus="kitten" /><div className="eyebrow">Room {code}</div><h1>Finding your seat…</h1><InlineError message={error} /></section>
      </main>
    );
  }

  const inRound = room.phase !== "lobby" && !!room.visibleRole;
  const exactRoleLabel = room.exactRole ? ROLE_NAMES[room.exactRole].one : null;

  function toggleCard() {
    const opening = !cardOpen;
    setCardOpen(opening);
    if (opening && room && !room.ready) void playerAction("player/ready");
  }

  function goOut() {
    const message = room?.visibleRole === "spy-pup"
      ? "Voted out? Say your one guess for the word out loud first. Then tap OK to see the real word."
      : "Only tap this if the table voted you out. Everyone will see your role.";
    if (window.confirm(message)) void playerAction("player/out");
  }

  const hostPanel = hostToken && hostRoom && (
    <section className="host-dock">
      <div className="host-dock__head">
        <div className="eyebrow">Host controls</div>
        <span className="spoiler-safe">Spoiler-free</span>
      </div>
      <HostControls code={code} hostToken={hostToken} room={hostRoom} onRoom={host.setRoom} showOutcome={false} />
    </section>
  );

  return (
    <main className={`player-shell player-shell--${room.phase}`}>
      <PageHeader narrow action={<div className="topbar__status"><ConnectionBadge state={connection} /><span className="room-mini">{code}</span></div>} />
      <section className="player-stage">
        <div className="player-greeting"><span className="avatar avatar--small">{room.playerName.slice(0, 1).toUpperCase()}</span><span>Playing as <strong>{room.playerName}</strong></span>{room.isHost && <em className="tag tag--host">Host</em>}</div>

        {room.phase === "lobby" && (
          <>
            {room.isHost ? (
              <>
                <div className="panel invite-card"><InvitePanel code={code} title="Show this to your friends" /></div>
                {hostPanel}
              </>
            ) : (
              <div className="waiting-view waiting-view--compact">
                <Mascots />
                <div className="eyebrow">You’re in</div>
                <h1>Keep this page open</h1>
                <p>Your secret card lands here when the host deals.</p>
              </div>
            )}
            <section className="stage-section">
              <div className="stage-section__head"><h2>At the table</h2><span className="pill">{room.table.length}/{room.targetPlayers} joined</span></div>
              <RoleTiles counts={roleDistribution(lobbyPreviewCount(room))} caption={`Roles for ${lobbyPreviewCount(room)} players`} />
              <TableList room={room} meId={room.playerId} onRemove={removeSeat} busy={hostActions.busy !== null} />
            </section>
          </>
        )}

        {room.phase === "active" && !inRound && (
          <div className="waiting-view waiting-view--compact">
            <Mascots focus="kitten" />
            <div className="eyebrow">Round in progress</div>
            <h1>You’re in the next round</h1>
            <p>You joined after the cards were dealt. Your card arrives here when the host deals again.</p>
          </div>
        )}

        {room.phase === "active" && inRound && (
          <div className="secret-view">
            <OutcomeBanner room={room} />
            <RoundGuide room={room} />
            <SecretCard room={room} open={cardOpen} onToggle={toggleCard} />
            <p className="tap-hint">{cardOpen ? "Tap the card to hide it." : room.ready ? "Peek again any time." : ""}</p>
            {room.out ? (
              <div className="identity-reveal">
                <span>You were</span>
                <strong>{exactRoleLabel}</strong>
                {room.spyAnswer && <p>The word was <b>{room.spyAnswer}</b>. If your guess matched, the Spy Pup wins!</p>}
              </div>
            ) : !room.outcome && (
              <button className="button button--secondary button--full out-button" disabled={busy} onClick={goOut}>I was voted out</button>
            )}
          </div>
        )}

        {room.phase === "revealed" && (
          <div className="final-reveal">
            <Mascots focus={room.exactRole === "spy" ? "pup" : "kitten"} />
            <div className="eyebrow">Round {room.gameNumber} is over</div>
            <h1>{exactRoleLabel ? `You were ${article(exactRoleLabel)} ${exactRoleLabel}` : "Round over"}</h1>
            <OutcomeBanner room={room} />
            <div className="word-results"><div><span>Good word</span><strong>{room.goodWord}</strong></div><div><span>Confused word</span><strong>{room.confusedWord}</strong></div></div>
          </div>
        )}
        {room.phase === "revealed" && hostPanel}

        {room.phase !== "lobby" && (
          <section className="stage-section">
            <div className="stage-section__head"><h2>{room.phase === "revealed" ? "Everyone’s cards" : "Who’s still in"}</h2></div>
            {room.roleCounts && room.phase === "active" && <RoleTiles counts={room.roleCounts} out={room.outCounts} />}
            <TableList room={room} meId={room.playerId} onRemove={removeSeat} busy={hostActions.busy !== null} />
            {room.phase === "revealed" && <p className="helper">Keep this page open. The next card lands here.</p>}
          </section>
        )}

        {room.phase === "active" && hostPanel}
        {room.table.length < MIN_PLAYERS && room.phase === "lobby" && !room.isHost && <p className="helper">The game needs at least {MIN_PLAYERS} players.</p>}
        <InlineError message={actionError ?? hostActions.error ?? error ?? host.error} />
      </section>
    </main>
  );
}
