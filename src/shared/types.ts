export type RoomMode = "official" | "experimental";
export type RoomPhase = "lobby" | "active" | "revealed" | "ended";
export type Role = "good" | "confused" | "spy";

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
  pairCount: number;
}

export interface PlayerSummary {
  id: string;
  name: string;
  connected: boolean;
  ready: boolean;
  joinedAt: number;
}

export interface HostRoomView {
  viewer: "host";
  code: string;
  phase: RoomPhase;
  mode: RoomMode;
  gameNumber: number;
  players: PlayerSummary[];
  firstPlayerName?: string;
  readyCount: number;
  minimumPlayers: number;
  maximumPlayers: number;
}

export interface PlayerRoomView {
  viewer: "player";
  code: string;
  phase: RoomPhase;
  mode: RoomMode;
  gameNumber: number;
  playerId: string;
  playerName: string;
  playerCount: number;
  firstPlayerName?: string;
  ready: boolean;
  visibleRole?: "kitten" | "spy-pup";
  word?: string;
  exactRole?: Role;
  goodWord?: string;
  confusedWord?: string;
}

export type RoomView = HostRoomView | PlayerRoomView;

export interface CustomLibrary {
  packs: WordPack[];
  updatedAt: number;
}

export interface ApiError {
  error: string;
}
