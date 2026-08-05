import type { CustomLibrary, PackSummary, RoomMode, RoomView, WordPack, WordPair } from "../shared/types";

export class ApiRequestError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

async function parseResponse<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => ({})) as { error?: string } & T;
  if (!response.ok) throw new ApiRequestError(payload.error ?? "The request failed.", response.status);
  return payload;
}

async function jsonRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body) headers.set("Content-Type", "application/json");
  return parseResponse<T>(await fetch(path, { ...options, headers, cache: "no-store" }));
}

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

export async function createRoom(): Promise<{ code: string; hostToken: string }> {
  return jsonRequest("/api/rooms", { method: "POST", body: "{}" });
}

export async function getBuiltInPacks(): Promise<PackSummary[]> {
  return (await jsonRequest<{ packs: PackSummary[] }>("/api/packs")).packs;
}

export async function getPublicRoom(code: string): Promise<{
  code: string;
  phase: string;
  mode: RoomMode;
  players: { name: string }[];
  playerCount: number;
  maximumPlayers: number;
}> {
  return jsonRequest(`/api/rooms/${code}/public`);
}

export async function joinRoom(code: string, name: string): Promise<{ seatToken: string; playerId: string }> {
  return jsonRequest(`/api/rooms/${code}/join`, { method: "POST", body: JSON.stringify({ name }) });
}

export async function getRoomState(code: string, token: string): Promise<RoomView> {
  return jsonRequest(`/api/rooms/${code}/state`, { headers: authHeaders(token) });
}

export async function roomAction<T = RoomView>(
  code: string,
  token: string,
  action: string,
  body?: unknown,
): Promise<T> {
  return jsonRequest(`/api/rooms/${code}/${action}`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(body ?? {}),
  });
}

export async function startGame(
  code: string,
  token: string,
  mode: RoomMode,
  packIds: string[],
  customPairs: WordPair[],
): Promise<RoomView> {
  return roomAction(code, token, "host/start", { mode, packIds, customPairs });
}

export async function issueSocketTicket(code: string, token: string): Promise<string> {
  return (await roomAction<{ ticket: string }>(code, token, "ticket")).ticket;
}

export function socketUrl(code: string, ticket: string): string {
  const url = new URL(`/api/rooms/${code}/socket`, window.location.href);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.searchParams.set("ticket", ticket);
  return url.toString();
}

export async function createLibrary(): Promise<{ recoveryKey: string; library: CustomLibrary }> {
  return jsonRequest("/api/library", { method: "POST", body: "{}" });
}

export async function getLibrary(recoveryKey: string): Promise<CustomLibrary> {
  return jsonRequest("/api/library", { headers: authHeaders(recoveryKey) });
}

export async function saveLibrary(recoveryKey: string, packs: WordPack[]): Promise<CustomLibrary> {
  return jsonRequest("/api/library", {
    method: "PUT",
    headers: authHeaders(recoveryKey),
    body: JSON.stringify({ packs }),
  });
}

export async function deleteLibrary(recoveryKey: string): Promise<void> {
  await jsonRequest("/api/library", { method: "DELETE", headers: authHeaders(recoveryKey) });
}
