import { useState } from "react";
import type { ReactNode } from "react";
import { QRCodeSVG } from "qrcode.react";
import { ROLE_NAMES, roleLabel } from "../shared/rules";
import type { Role, RoleCounts, RoomPhase, RoomView, TableSeat } from "../shared/types";
import type { ConnectionState } from "./useRoom";

export const LIBRARY_KEY_STORAGE = "whisker-word:library-key";
export const hostTokenKey = (code: string) => `whisker-word:host:${code}`;
export const seatTokenKey = (code: string) => `whisker-word:seat:${code}`;

export function navigate(path: string) {
  window.location.assign(path);
}

export function errorText(caught: unknown, fallback: string): string {
  return caught instanceof Error ? caught.message : fallback;
}

export function Mascots({ focus = "both", className = "" }: { focus?: "both" | "kitten" | "pup"; className?: string }) {
  return (
    <div className={`mascots mascots--${focus} ${className}`} aria-hidden="true">
      <img src="/mascots.png" alt="" />
    </div>
  );
}

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <a className={`brand ${compact ? "brand--compact" : ""}`} href="/" aria-label="Whisker Word home">
      <span className="brand__mark">W</span>
      <span>Whisker Word</span>
    </a>
  );
}

export function PageHeader({ action, narrow = false }: { action?: ReactNode; narrow?: boolean }) {
  return (
    <header className={`topbar ${narrow ? "topbar--narrow" : ""}`}>
      <Brand compact />
      {action}
    </header>
  );
}

export function ConnectionBadge({ state }: { state: ConnectionState }) {
  const labels: Record<ConnectionState, string> = {
    live: "Live",
    connecting: "Connecting",
    polling: "Reconnecting",
    offline: "Offline",
  };
  return <span className={`connection connection--${state}`}><span />{labels[state]}</span>;
}

export function InlineError({ message }: { message?: string | null }) {
  return message ? <div className="notice notice--error" role="alert">{message}</div> : null;
}

const ROLES: Role[] = ["good", "confused", "spy"];
const ROLE_HINTS: Record<Role, string> = {
  good: "Know the real word",
  confused: "Get a similar word and don’t know it",
  spy: "Get no word at all",
};

/** How many of each role are in the round, and how many are still hidden once players start going out. */
export function RoleTiles({ counts, out, caption }: { counts: RoleCounts; out?: RoleCounts; caption?: string }) {
  return (
    <div className="role-tiles-wrap">
      {caption && <div className="field-label">{caption}</div>}
      <ul className="role-tiles">
        {ROLES.map((role) => {
          const outCount = out?.[role] ?? 0;
          const left = counts[role] - outCount;
          return (
            <li key={role} className={`role-tile role-tile--${role} ${counts[role] === 0 ? "role-tile--none" : ""}`}>
              <strong>{out ? left : counts[role]}</strong>
              <span>{out ? `${roleLabel(role, left)} left` : roleLabel(role, counts[role])}</span>
              {out ? <small className="role-tile__status">{outCount} of {counts[role]} out</small> : <small className="role-tile__hint">{ROLE_HINTS[role]}</small>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function seatStatus(seat: TableSeat, phase: RoomPhase): string {
  if (phase === "lobby") return seat.connected ? "Ready to play" : "Page asleep";
  if (!seat.inGame) return "Joins next round";
  if (phase === "revealed") return seat.role ? ROLE_NAMES[seat.role].one : "";
  if (seat.out) return seat.role ? `Out · ${ROLE_NAMES[seat.role].one}` : "Out";
  return seat.ready ? "Seen their card" : "Hasn’t peeked yet";
}

export function TableList({
  room,
  meId,
  onRemove,
  busy = false,
}: {
  room: Pick<RoomView, "table" | "phase">;
  meId?: string;
  onRemove?: (seat: TableSeat) => void;
  busy?: boolean;
}) {
  if (!room.table.length) {
    return <div className="empty-state"><span>Waiting for paws…</span><p>Players appear here as they join.</p></div>;
  }
  return (
    <ul className="seat-list">
      {room.table.map((seat) => {
        const classes = ["seat"];
        if (seat.out) classes.push("seat--out");
        if (seat.role) classes.push(`seat--${seat.role}`);
        if (room.phase === "active" && seat.inGame && !seat.ready) classes.push("seat--waiting");
        return (
          <li key={seat.id} className={classes.join(" ")}>
            <span className="avatar">{seat.name.slice(0, 1).toUpperCase()}</span>
            <div className="seat__text">
              <strong>{seat.name}{seat.id === meId && <em className="tag">You</em>}{seat.isHost && <em className="tag tag--host">Host</em>}</strong>
              <small>{seatStatus(seat, room.phase)}</small>
            </div>
            {onRemove && !seat.isHost && room.phase !== "active" && (
              <button className="icon-button" aria-label={`Remove ${seat.name}`} disabled={busy} onClick={() => onRemove(seat)}>×</button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function InvitePanel({ code, title = "Scan to join" }: { code: string; title?: string }) {
  const [copied, setCopied] = useState(false);
  const joinUrl = `${window.location.origin}/room/${code}`;

  async function copyJoinLink() {
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1_800);
    } catch {
      window.prompt("Copy this join link:", joinUrl);
    }
  }

  return (
    <div className="invite">
      <div className="invite__head">
        <div><div className="eyebrow">{title}</div><div className="room-code">{code}</div></div>
      </div>
      <div className="qr-wrap"><QRCodeSVG value={joinUrl} size={196} level="M" bgColor="#fffaf2" fgColor="#1f2524" /></div>
      <p className="invite__hint">Everyone scans once. Their phone stays their private card for every round.</p>
      <button className="button button--secondary button--full" onClick={copyJoinLink}>{copied ? "Link copied" : "Copy join link"}</button>
    </div>
  );
}

export function OutcomeBanner({ room }: { room: Pick<RoomView, "outcome" | "phase" | "roleCounts" | "outCounts"> }) {
  if (!room.outcome) return null;
  const spyStillHasAGuess = !!room.roleCounts?.spy && !!room.outCounts?.spy;
  return (
    <div className={`outcome outcome--${room.outcome}`} role="status">
      <strong>{room.outcome === "kittens" ? "Every impostor is out. Good Kittens win!" : "Only one Good Kitten is left. The impostors win!"}</strong>
      {room.outcome === "kittens" && spyStillHasAGuess && <span>Unless the Spy Pup guessed the word when they went out.</span>}
      {room.phase === "active" && <span>The host can end the round to show every card.</span>}
    </div>
  );
}
