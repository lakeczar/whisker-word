import { useState } from "react";
import { MIN_PLAYERS, roleDistribution } from "../shared/rules";
import type { HostRoomView, TableSeat } from "../shared/types";
import { roomAction, startGame, updateSettings } from "./api";
import { PackPicker, PlayerCountPicker, settingsFrom, usePackChoices } from "./setup";
import type { SetupDraft } from "./setup";
import {
  ConnectionBadge,
  InlineError,
  InvitePanel,
  OutcomeBanner,
  PageHeader,
  RoleTiles,
  TableList,
  errorText,
  hostTokenKey,
  navigate,
  seatTokenKey,
} from "./ui";
import { useRoom } from "./useRoom";

export function useHostActions(code: string, hostToken: string, onRoom: (room: HostRoomView) => void) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(label: string, action: () => Promise<unknown>) {
    setBusy(label);
    setError(null);
    try {
      const result = await action();
      if (result && typeof result === "object" && "viewer" in result) onRoom(result as HostRoomView);
    } catch (caught) {
      setError(errorText(caught, "That action did not complete."));
    } finally {
      setBusy(null);
    }
  }

  return {
    busy,
    error,
    run,
    remove: (seat: TableSeat) => {
      if (window.confirm(`Remove ${seat.name} from the room?`)) void run("remove", () => roomAction(code, hostToken, "host/remove", { playerId: seat.id }));
    },
    endRoom: () => {
      if (!window.confirm("End this room now? Player names and all game data will be deleted.")) return;
      void run("end", async () => {
        await roomAction(code, hostToken, "host/end");
        localStorage.removeItem(hostTokenKey(code));
        localStorage.removeItem(seatTokenKey(code));
        navigate("/");
      });
    },
  };
}

/** Roles that will be dealt if the host deals now: the players who joined, or the planned table until four are in. */
export function lobbyPreviewCount(room: Pick<HostRoomView, "table" | "targetPlayers">): number {
  return room.table.length >= MIN_PLAYERS ? room.table.length : room.targetPlayers;
}

function SetupEditor({ room, onSave, onCancel, busy, saveError }: {
  room: HostRoomView;
  saveError: string | null;
  onSave: (draft: SetupDraft, library: ReturnType<typeof usePackChoices>["library"]) => void;
  onCancel: () => void;
  busy: boolean;
}) {
  const { packs, library, error } = usePackChoices();
  const [draft, setDraft] = useState<SetupDraft>({
    targetPlayers: room.targetPlayers,
    packIds: room.packIds,
    customIds: room.customPacks.map((pack) => pack.id),
  });
  return (
    <div className="setup-editor">
      <div className="field-label">Players</div>
      <PlayerCountPicker value={draft.targetPlayers} min={Math.max(MIN_PLAYERS, room.table.length)} onChange={(targetPlayers) => setDraft({ ...draft, targetPlayers })} />
      <div className="field-label field-label--spaced">Word packs</div>
      <PackPicker packs={packs} library={library} draft={draft} onChange={setDraft} />
      <InlineError message={saveError ?? error} />
      <div className="setup-editor__actions">
        <button className="button button--secondary" onClick={onCancel} disabled={busy}>Cancel</button>
        <button className="button button--primary" disabled={busy || (!draft.packIds.length && !draft.customIds.length)} onClick={() => onSave(draft, library)}>
          {busy ? "Saving…" : "Save setup"}
        </button>
      </div>
    </div>
  );
}

/**
 * Deal, end-round and setup controls. They read only the host view, which
 * holds no words or roles while a round is live, so a host who plays on the
 * same phone is never spoiled.
 */
export function HostControls({ code, hostToken, room, onRoom, showOutcome = true }: {
  code: string;
  hostToken: string;
  room: HostRoomView;
  onRoom: (room: HostRoomView) => void;
  /** Off on the host's own phone, where the player view already shows the result. */
  showOutcome?: boolean;
}) {
  const actions = useHostActions(code, hostToken, onRoom);
  const [editing, setEditing] = useState(false);
  const joined = room.table.length;
  const packCount = room.packIds.length + room.customPacks.length;
  const missing = Math.max(0, room.targetPlayers - joined);

  if (editing) {
    return (
      <SetupEditor
        room={room}
        saveError={actions.error}
        busy={actions.busy === "settings"}
        onCancel={() => setEditing(false)}
        onSave={(draft, library) => {
          // Custom packs saved from another browser cannot be re-sent from here, so keep them unless the host changed that choice.
          const missingCustom = room.customPacks.some((pack) => !library.some((candidate) => candidate.id === pack.id));
          const customUnchanged = draft.customIds.length === room.customPacks.length && room.customPacks.every((pack) => draft.customIds.includes(pack.id));
          const settings = settingsFrom(draft, library);
          void actions.run("settings", async () => {
            const next = await updateSettings(code, hostToken, missingCustom && customUnchanged ? { ...settings, customPacks: undefined } : settings);
            setEditing(false);
            return next;
          });
        }}
      />
    );
  }

  return (
    <div className="host-controls">
      {room.phase === "active" ? (
        <>
          {showOutcome && <OutcomeBanner room={room} />}
          <p className="host-controls__note">
            {room.outcome ? "The round is decided." : "Clues, talk and votes happen out loud. When someone is voted out, they tap “I was voted out” on their phone."}
          </p>
          <button className="button button--primary button--large button--full" disabled={actions.busy !== null} onClick={() => actions.run("reveal", () => roomAction(code, hostToken, "host/reveal"))}>
            {actions.busy === "reveal" ? "Ending round…" : "End round & show cards"}
          </button>
        </>
      ) : (
        <>
          <div className="setup-summary">
            <span><strong>{room.targetPlayers}</strong> players · <strong>{packCount}</strong> word {packCount === 1 ? "pack" : "packs"}</span>
            <button className="text-button" onClick={() => setEditing(true)}>Change setup</button>
          </div>
          <button className="button button--primary button--large button--full" disabled={joined < MIN_PLAYERS || actions.busy !== null} onClick={() => actions.run("start", () => startGame(code, hostToken))}>
            {actions.busy === "start" ? "Dealing secret cards…" : joined < MIN_PLAYERS ? `Waiting for ${MIN_PLAYERS - joined} more to join` : `${room.phase === "revealed" ? "Deal the next round" : "Deal the cards"} for ${joined}`}
          </button>
          {joined >= MIN_PLAYERS && missing > 0 && room.phase === "lobby" && (
            <p className="helper">{missing} of your {room.targetPlayers} seats {missing === 1 ? "is" : "are"} still empty. Dealing now uses the roles for {joined}.</p>
          )}
        </>
      )}
      <InlineError message={actions.error} />
      <button className="text-button danger-text end-room" disabled={actions.busy !== null} onClick={actions.endRoom}>End room for everyone</button>
    </div>
  );
}

export function HostScreen({ code }: { code: string }) {
  const token = localStorage.getItem(hostTokenKey(code));
  const { room: rawRoom, connection, error, setRoom } = useRoom(code, token);
  const room = rawRoom?.viewer === "host" ? rawRoom : null;
  const actions = useHostActions(code, token ?? "", setRoom);

  if (!token) {
    return (
      <main className="app-shell">
        <PageHeader />
        <section className="simple-message">
          <h1>Host key not found</h1>
          <p>This browser no longer has control of that room. Create a new room to continue.</p>
          <a className="button button--primary" href="/new">Set up a new room</a>
        </section>
      </main>
    );
  }

  const playingHere = !!localStorage.getItem(seatTokenKey(code));
  const previewCount = room ? lobbyPreviewCount(room) : 6;
  const heading = !room ? "Loading…" : room.phase === "active" ? `Round ${room.gameNumber} is live` : room.phase === "revealed" ? `Round ${room.gameNumber} is over` : "Get everyone in";

  return (
    <main className="app-shell">
      <PageHeader action={<div className="topbar__status"><ConnectionBadge state={connection} /><span className="room-mini">{code}</span></div>} />
      <InlineError message={actions.error ?? error} />
      {playingHere && <div className="notice notice--info">You are also playing in this room. <a className="text-link" href={`/room/${code}`}>Open my card</a></div>}
      <div className="host-grid">
        <section className="panel share-panel"><InvitePanel code={code} /></section>
        <section className="panel table-panel">
          <div className="section-heading">
            <div><div className="eyebrow">The table</div><h2>{heading}</h2></div>
            {room && <span className="pill">{room.phase === "active" ? `${room.table.filter((seat) => seat.inGame && seat.ready).length}/${room.table.filter((seat) => seat.inGame).length} have peeked` : `${room.table.length}/${room.targetPlayers} joined`}</span>}
          </div>
          {room && (
            room.phase === "lobby"
              ? <RoleTiles counts={roleDistribution(previewCount)} caption={`Roles for ${previewCount} players`} />
              : room.roleCounts && <RoleTiles counts={room.roleCounts} out={room.phase === "active" ? room.outCounts : undefined} caption="This round" />
          )}
          {room?.phase === "revealed" && room.goodWord && (
            <div className="word-results"><div><span>Good word</span><strong>{room.goodWord}</strong></div><div><span>Confused word</span><strong>{room.confusedWord}</strong></div></div>
          )}
          {room && <TableList room={room} onRemove={actions.remove} busy={actions.busy !== null} />}
        </section>
        <section className="panel controls-panel">
          <div className="eyebrow">Host controls</div>
          {room ? <HostControls code={code} hostToken={token} room={room} onRoom={setRoom} /> : <p className="helper helper--left">Connecting to the room…</p>}
        </section>
      </div>
    </main>
  );
}
