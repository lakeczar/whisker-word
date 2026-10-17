import type {
  HostRoomView,
  PlayerRoomView,
  Role,
  RoleCounts,
  RoomPhase,
  RoomSettings,
  TableSeat,
  WordPair,
} from "../shared/types";
import { countRoles, roundOutcome } from "./game";
import { BUILT_IN_PACKS } from "./wordPacks";

export interface PlayerRecord {
  id: string;
  name: string;
  tokenHash: string;
  joinedAt: number;
  ready: boolean;
}

export interface GameRecord {
  id: string;
  number: number;
  pair: WordPair;
  assignments: Record<string, Role>;
  /** Players voted out this round. Kept on the round so removing a seat later does not change its result. */
  outIds: string[];
}

export interface SocketTicket {
  subject: "host" | "player";
  playerId?: string;
  expiresAt: number;
}

export interface RoomData extends RoomSettings {
  code: string;
  hostTokenHash: string;
  hostPlayerId?: string;
  createdAt: number;
  updatedAt: number;
  phase: RoomPhase;
  players: PlayerRecord[];
  game?: GameRecord;
  usedPairKeys: string[];
  tickets: Record<string, SocketTicket>;
}

/** Brings a room saved by an earlier version of the game up to the current shape. */
export function normalizeRoom(raw: RoomData): RoomData {
  const legacy = raw as RoomData & { mode?: string; game?: GameRecord & { firstPlayerId?: string } };
  const players = legacy.players as (PlayerRecord & { revealed?: boolean; out?: boolean })[];
  legacy.targetPlayers ??= legacy.mode === "experimental" ? 12 : 8;
  legacy.packIds ??= BUILT_IN_PACKS.map((pack) => pack.id);
  legacy.customPacks ??= [];
  if (legacy.game) {
    legacy.game.outIds ??= players.filter((player) => player.revealed).map((player) => player.id);
    delete legacy.game.firstPlayerId;
  }
  for (const player of players) {
    delete player.revealed;
    delete player.out;
  }
  delete legacy.mode;
  return legacy;
}

export function isOut(data: RoomData, playerId: string): boolean {
  return !!data.game?.outIds.includes(playerId);
}

function dealtAndOut(data: RoomData): { dealt: RoleCounts; out: RoleCounts } | undefined {
  if (!data.game) return undefined;
  const assignments = data.game.assignments;
  return {
    dealt: countRoles(Object.values(assignments)),
    out: countRoles(data.game.outIds.filter((id) => assignments[id]).map((id) => assignments[id])),
  };
}

function table(data: RoomData, connectedIds: ReadonlySet<string>): TableSeat[] {
  const roundOver = data.phase === "revealed";
  return data.players.map((player) => {
    const role = data.game?.assignments[player.id];
    const out = isOut(data, player.id);
    const seat: TableSeat = {
      id: player.id,
      name: player.name,
      connected: connectedIds.has(player.id),
      ready: player.ready,
      out,
      isHost: player.id === data.hostPlayerId,
      inGame: !!role,
    };
    if (role && (roundOver || out)) seat.role = role;
    return seat;
  });
}

function sharedView(data: RoomData, connectedIds: ReadonlySet<string>) {
  const counts = dealtAndOut(data);
  const view = {
    code: data.code,
    phase: data.phase,
    gameNumber: data.game?.number ?? 0,
    targetPlayers: data.targetPlayers,
    table: table(data, connectedIds),
    roleCounts: counts?.dealt,
    outCounts: counts?.out,
    outcome: counts && data.phase !== "lobby" ? roundOutcome(counts.dealt, counts.out) : undefined,
    goodWord: undefined as string | undefined,
    confusedWord: undefined as string | undefined,
  };
  if (data.phase === "revealed" && data.game) {
    view.goodWord = data.game.pair.goodWord;
    view.confusedWord = data.game.pair.confusedWord;
  }
  return view;
}

/**
 * The room as the host's controls see it. While a round is live it holds no
 * words and no roles except those of players already out, so a host who also
 * plays learns nothing from their controls.
 */
export function buildHostView(data: RoomData, connectedIds: ReadonlySet<string>): HostRoomView {
  return {
    viewer: "host",
    ...sharedView(data, connectedIds),
    packIds: data.packIds,
    customPacks: data.customPacks.map(({ id, name, pairs }) => ({ id, name, pairCount: pairs.length })),
    hostPlayerId: data.hostPlayerId,
  };
}

/** One player's room: the public table plus only this player's own secret. */
export function buildPlayerView(data: RoomData, playerId: string, connectedIds: ReadonlySet<string>): PlayerRoomView | undefined {
  const player = data.players.find((candidate) => candidate.id === playerId);
  if (!player) return undefined;
  const view: PlayerRoomView = {
    viewer: "player",
    ...sharedView(data, connectedIds),
    playerId,
    playerName: player.name,
    isHost: player.id === data.hostPlayerId,
    ready: player.ready,
    out: isOut(data, playerId),
  };
  const role = data.game?.assignments[playerId];
  if (!data.game || !role) return view;
  view.visibleRole = role === "spy" ? "spy-pup" : "kitten";
  if (role === "good") view.word = data.game.pair.goodWord;
  if (role === "confused") view.word = data.game.pair.confusedWord;
  if (data.phase === "revealed" || view.out) view.exactRole = role;
  if (role === "spy" && view.out) view.spyAnswer = data.game.pair.goodWord;
  return view;
}
