export type RoomPhase = "lobby" | "active" | "revealed" | "ended";
export type Role = "good" | "confused" | "spy";

export interface RoleCounts {
  good: number;
  confused: number;
  spy: number;
}

/** "kittens" when every Confused Kitten and Spy Pup is out; "impostors" when one Good Kitten or fewer is left. */
export type RoundOutcome = "kittens" | "impostors";

export interface WordPair {
  goodWord: string;
  confusedWord: string;
}

export interface WordPack {
  id: string;
  name: string;
  pairs: WordPair[];
}

export interface PackSummary {
  id: string;
  name: string;
  description: string;
  pairCount: number;
}

export interface RoomSettings {
  targetPlayers: number;
  packIds: string[];
  customPacks: WordPack[];
}

/** A setup change. `keepCustomPackIds` keeps custom packs the room already holds but this browser's library no longer has. */
export interface RoomSettingsUpdate extends RoomSettings {
  keepCustomPackIds?: string[];
}

/** Public information about one seat. `role` is only present once that player is out or the round is over. */
export interface TableSeat {
  id: string;
  name: string;
  connected: boolean;
  ready: boolean;
  out: boolean;
  isHost: boolean;
  role?: Role;
  inGame: boolean;
}

interface RoomViewBase {
  code: string;
  phase: RoomPhase;
  gameNumber: number;
  targetPlayers: number;
  table: TableSeat[];
  /** Roles dealt in the current round. */
  roleCounts?: RoleCounts;
  /** How many of each role have been voted out and revealed this round. */
  outCounts?: RoleCounts;
  outcome?: RoundOutcome;
  /** Both words, sent only once the round is over. */
  goodWord?: string;
  confusedWord?: string;
}

export interface HostRoomView extends RoomViewBase {
  viewer: "host";
  packIds: string[];
  customPacks: { id: string; name: string; pairCount: number }[];
  hostPlayerId?: string;
}

export interface PlayerRoomView extends RoomViewBase {
  viewer: "player";
  playerId: string;
  playerName: string;
  isHost: boolean;
  ready: boolean;
  out: boolean;
  visibleRole?: "kitten" | "spy-pup";
  word?: string;
  /** This player's exact role, sent once they are out or the round is over. */
  exactRole?: Role;
  /** The Good word for a Spy Pup who is out and has made their final guess. */
  spyAnswer?: string;
}

export type RoomView = HostRoomView | PlayerRoomView;

export interface CustomLibrary {
  packs: WordPack[];
  updatedAt: number;
}

export interface ApiError {
  error: string;
}
