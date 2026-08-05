import { DurableObject } from "cloudflare:workers";
import type {
  ApiError,
  CustomLibrary,
  HostRoomView,
  PackSummary,
  PlayerRoomView,
  Role,
  RoomMode,
  RoomPhase,
  WordPack,
  WordPair,
} from "../shared/types";
import { buildAssignments, choosePair } from "./game";
import { BUILT_IN_PACKS } from "./wordPacks";

interface Env {
  ROOMS: DurableObjectNamespace<RoomDurableObject>;
  LIBRARIES: DurableObjectNamespace<LibraryDurableObject>;
}

interface PlayerRecord {
  id: string;
  name: string;
  tokenHash: string;
  joinedAt: number;
  ready: boolean;
  revealed: boolean;
  correctWordShown: boolean;
}

interface GameRecord {
  id: string;
  number: number;
  pair: WordPair;
  assignments: Record<string, Role>;
  firstPlayerId: string;
}

interface SocketTicket {
  subject: "host" | "player";
  playerId?: string;
  expiresAt: number;
}

interface RoomData {
  code: string;
  hostTokenHash: string;
  createdAt: number;
  updatedAt: number;
  phase: RoomPhase;
  mode: RoomMode;
  players: PlayerRecord[];
  game?: GameRecord;
  usedPairKeys: string[];
  tickets: Record<string, SocketTicket>;
}

interface SocketAttachment {
  subject: "host" | "player";
  playerId?: string;
}

const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const ROOM_TTL_MS = 24 * 60 * 60 * 1000;
const TICKET_TTL_MS = 30 * 1000;

function apiJson<T>(body: T, status = 200, extraHeaders?: HeadersInit): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      ...extraHeaders,
    },
  });
}

function apiError(error: string, status = 400): Response {
  return apiJson<ApiError>({ error }, status);
}

async function readJson<T>(request: Request): Promise<T> {
  if (!request.headers.get("content-type")?.includes("application/json")) {
    throw new HttpError(415, "Send JSON with a Content-Type of application/json.");
  }
  try {
    return (await request.json()) as T;
  } catch {
    throw new HttpError(400, "The request body is not valid JSON.");
  }
}

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function bearerToken(request: Request): string | null {
  const value = request.headers.get("authorization") ?? "";
  return value.startsWith("Bearer ") ? value.slice(7) : null;
}

function randomToken(byteLength = 32): string {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function randomRoomCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (byte) => ROOM_CODE_ALPHABET[byte % ROOM_CODE_ALPHABET.length]).join("");
}

function secureRandom(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0] / 0x1_0000_0000;
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function normalizedRoomCode(value: string): string {
  const code = value.trim().toUpperCase();
  if (!/^[A-HJ-NP-Z2-9]{6}$/.test(code)) throw new HttpError(404, "Room not found.");
  return code;
}

function cleanName(value: unknown): string {
  const name = typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
  if (name.length < 1 || name.length > 24) throw new HttpError(400, "Names must be 1 to 24 characters.");
  if (/\p{C}/u.test(name)) throw new HttpError(400, "That name contains unsupported characters.");
  return name;
}

function validatePair(value: WordPair): WordPair {
  const goodWord = typeof value?.goodWord === "string" ? value.goodWord.trim().replace(/\s+/g, " ") : "";
  const confusedWord = typeof value?.confusedWord === "string" ? value.confusedWord.trim().replace(/\s+/g, " ") : "";
  if (!goodWord || !confusedWord || goodWord.length > 60 || confusedWord.length > 60) {
    throw new HttpError(400, "Each password must be 1 to 60 characters.");
  }
  if (goodWord.localeCompare(confusedWord, undefined, { sensitivity: "accent" }) === 0) {
    throw new HttpError(400, "The Good and Confused passwords must be different.");
  }
  return { goodWord, confusedWord };
}

function validateLibraryPacks(input: unknown): WordPack[] {
  if (!Array.isArray(input)) throw new HttpError(400, "Packs must be an array.");
  if (input.length > 20) throw new HttpError(400, "A library can contain up to 20 packs.");
  const packs = input.map((candidate, packIndex) => {
    const value = candidate as Partial<WordPack>;
    const name = typeof value.name === "string" ? value.name.trim().replace(/\s+/g, " ") : "";
    if (!name || name.length > 40) throw new HttpError(400, "Pack names must be 1 to 40 characters.");
    if (!Array.isArray(value.pairs)) throw new HttpError(400, `“${name}” needs a password list.`);
    const pairs = value.pairs.map(validatePair);
    const seen = new Set<string>();
    for (const pair of pairs) {
      const key = `${pair.goodWord.toLocaleLowerCase()}::${pair.confusedWord.toLocaleLowerCase()}`;
      if (seen.has(key)) throw new HttpError(400, `“${name}” contains a duplicate pair.`);
      seen.add(key);
    }
    return {
      id: typeof value.id === "string" && /^[a-zA-Z0-9_-]{1,48}$/.test(value.id)
        ? value.id
        : `pack-${packIndex + 1}-${randomToken(5)}`,
      name,
      pairs,
    };
  });
  if (packs.reduce((sum, pack) => sum + pack.pairs.length, 0) > 500) {
    throw new HttpError(400, "A library can contain up to 500 password pairs.");
  }
  return packs;
}

async function roomStub(env: Env, rawCode: string): Promise<DurableObjectStub<RoomDurableObject>> {
  const code = normalizedRoomCode(rawCode);
  return env.ROOMS.getByName(code);
}

async function forwardToRoom(request: Request, env: Env, code: string, action: string): Promise<Response> {
  const stub = await roomStub(env, code);
  const source = new URL(request.url);
  const target = new URL(`https://room.internal/${action}${source.search}`);
  return stub.fetch(new Request(target, request));
}

async function libraryStub(env: Env, token: string): Promise<{ stub: DurableObjectStub<LibraryDurableObject>; hash: string }> {
  if (token.length < 32 || token.length > 128) throw new HttpError(401, "Library key is invalid.");
  const hash = await sha256(token);
  return { stub: env.LIBRARIES.getByName(hash), hash };
}

async function handleApi(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const segments = url.pathname.split("/").filter(Boolean);

  if (request.method === "GET" && url.pathname === "/api/packs") {
    const packs: PackSummary[] = BUILT_IN_PACKS.map(({ id, name, pairs }) => ({ id, name, pairCount: pairs.length }));
    return apiJson({ packs });
  }

  if (url.pathname === "/api/library") {
    if (request.method === "POST") {
      const recoveryKey = randomToken();
      const { stub, hash } = await libraryStub(env, recoveryKey);
      const response = await stub.fetch(new Request("https://library.internal/initialize", {
        method: "POST",
        headers: { "X-Library-Hash": hash },
      }));
      if (!response.ok) return response;
      return apiJson({ recoveryKey, library: await response.json() }, 201);
    }
    if (!["GET", "PUT", "DELETE"].includes(request.method)) {
      return apiError("Method not allowed.", 405);
    }
    const token = bearerToken(request);
    if (!token) return apiError("Library key is required.", 401);
    const { stub, hash } = await libraryStub(env, token);
    const forwarded = new Request(`https://library.internal/${request.method === "GET" ? "read" : request.method === "PUT" ? "write" : "delete"}`, request);
    forwarded.headers.set("X-Library-Hash", hash);
    return stub.fetch(forwarded);
  }

  if (request.method === "POST" && url.pathname === "/api/rooms") {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const code = randomRoomCode();
      const stub = env.ROOMS.getByName(code);
      const response = await stub.fetch(new Request("https://room.internal/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      }));
      if (response.status === 409) continue;
      return response;
    }
    return apiError("Could not create a room. Please try again.", 503);
  }

  if (segments[0] === "api" && segments[1] === "rooms" && segments[2]) {
    const code = segments[2];
    const tail = segments.slice(3).join("/") || "public";
    const routeMap: Record<string, string> = {
      public: "public",
      join: "join",
      state: "state",
      ticket: "ticket",
      socket: "socket",
      "player/ready": "player/ready",
      "player/reveal": "player/reveal",
      "player/spy-answer": "player/spy-answer",
      "host/start": "host/start",
      "host/settings": "host/settings",
      "host/reveal": "host/reveal",
      "host/remove": "host/remove",
      "host/end": "host/end",
    };
    const action = routeMap[tail];
    if (!action) return apiError("API route not found.", 404);
    return forwardToRoom(request, env, code, action);
  }

  return apiError("API route not found.", 404);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      const url = new URL(request.url);
      if (url.pathname.startsWith("/api/")) return await handleApi(request, env);
      return apiError("Not found.", 404);
    } catch (error) {
      if (error instanceof HttpError) return apiError(error.message, error.status);
      console.error("api_failure", error instanceof Error ? error.name : "unknown");
      return apiError("Something went wrong. Please try again.", 500);
    }
  },
};

export class RoomDurableObject extends DurableObject<Env> {
  private data?: RoomData;

  private async load(): Promise<RoomData | undefined> {
    if (!this.data) this.data = await this.ctx.storage.get<RoomData>("room");
    return this.data;
  }

  private async save(data: RoomData): Promise<void> {
    data.updatedAt = Date.now();
    this.data = data;
    await this.ctx.storage.put("room", data);
    await this.ctx.storage.setAlarm(Date.now() + ROOM_TTL_MS);
  }

  private async requireRoom(): Promise<RoomData> {
    const data = await this.load();
    if (!data || data.phase === "ended") throw new HttpError(404, "Room not found or already ended.");
    return data;
  }

  private async authenticate(request: Request, data: RoomData): Promise<SocketAttachment> {
    const token = bearerToken(request);
    if (!token) throw new HttpError(401, "Private room access is required.");
    const tokenHash = await sha256(token);
    if (tokenHash === data.hostTokenHash) return { subject: "host" };
    const player = data.players.find((candidate) => candidate.tokenHash === tokenHash);
    if (!player) throw new HttpError(401, "This room access link is no longer valid.");
    return { subject: "player", playerId: player.id };
  }

  private playerConnected(playerId: string): boolean {
    return this.ctx.getWebSockets().some((socket) => {
      const attachment = socket.deserializeAttachment() as SocketAttachment | null;
      return attachment?.subject === "player" && attachment.playerId === playerId;
    });
  }

  private hostView(data: RoomData): HostRoomView {
    const firstPlayer = data.players.find((player) => player.id === data.game?.firstPlayerId);
    return {
      viewer: "host",
      code: data.code,
      phase: data.phase,
      mode: data.mode,
      gameNumber: data.game?.number ?? 0,
      players: data.players.map((player) => ({
        id: player.id,
        name: player.name,
        connected: this.playerConnected(player.id),
        ready: player.ready,
        joinedAt: player.joinedAt,
      })),
      firstPlayerName: firstPlayer?.name,
      readyCount: data.players.filter((player) => player.ready).length,
      minimumPlayers: 4,
      maximumPlayers: data.mode === "official" ? 8 : 12,
    };
  }

  private playerView(data: RoomData, playerId: string): PlayerRoomView {
    const player = data.players.find((candidate) => candidate.id === playerId);
    if (!player) throw new HttpError(401, "This seat is no longer in the room.");
    const role = data.game?.assignments[playerId];
    const firstPlayer = data.players.find((candidate) => candidate.id === data.game?.firstPlayerId);
    const view: PlayerRoomView = {
      viewer: "player",
      code: data.code,
      phase: data.phase,
      mode: data.mode,
      gameNumber: data.game?.number ?? 0,
      playerId,
      playerName: player.name,
      playerCount: data.players.length,
      firstPlayerName: firstPlayer?.name,
      ready: player.ready,
    };
    if (!data.game || !role) return view;
    view.visibleRole = role === "spy" ? "spy-pup" : "kitten";
    if (role === "good") view.word = data.game.pair.goodWord;
    if (role === "confused") view.word = data.game.pair.confusedWord;
    if (data.phase === "revealed" || player.revealed) view.exactRole = role;
    if (data.phase === "revealed") {
      view.goodWord = data.game.pair.goodWord;
      view.confusedWord = data.game.pair.confusedWord;
    } else if (role === "spy" && player.correctWordShown) {
      view.goodWord = data.game.pair.goodWord;
    }
    return view;
  }

  private viewFor(data: RoomData, attachment: SocketAttachment): HostRoomView | PlayerRoomView {
    return attachment.subject === "host"
      ? this.hostView(data)
      : this.playerView(data, attachment.playerId ?? "");
  }

  private async broadcast(data: RoomData): Promise<void> {
    for (const socket of this.ctx.getWebSockets()) {
      try {
        const attachment = socket.deserializeAttachment() as SocketAttachment | null;
        if (attachment) socket.send(JSON.stringify({ type: "room", room: this.viewFor(data, attachment) }));
      } catch {
        socket.close(1011, "Room update failed");
      }
    }
  }

  private async create(request: Request): Promise<Response> {
    if (await this.load()) return apiError("Room code is already in use.", 409);
    const { code } = await readJson<{ code: string }>(request);
    const hostToken = randomToken();
    const now = Date.now();
    const data: RoomData = {
      code,
      hostTokenHash: await sha256(hostToken),
      createdAt: now,
      updatedAt: now,
      phase: "lobby",
      mode: "official",
      players: [],
      usedPairKeys: [],
      tickets: {},
    };
    await this.save(data);
    return apiJson({ code, hostToken }, 201);
  }

  private async publicState(): Promise<Response> {
    const data = await this.requireRoom();
    return apiJson({
      code: data.code,
      phase: data.phase,
      mode: data.mode,
      players: data.players.map(({ name }) => ({ name })),
      playerCount: data.players.length,
      maximumPlayers: data.mode === "official" ? 8 : 12,
    });
  }

  private async join(request: Request): Promise<Response> {
    const data = await this.requireRoom();
    const { name: rawName } = await readJson<{ name: string }>(request);
    const name = cleanName(rawName);
    if (data.players.some((player) => player.name.localeCompare(name, undefined, { sensitivity: "accent" }) === 0)) {
      throw new HttpError(409, "That name is already in this room.");
    }
    const maximum = data.mode === "official" ? 8 : 12;
    if (data.players.length >= maximum) throw new HttpError(409, "This room is full.");
    const seatToken = randomToken();
    const player: PlayerRecord = {
      id: randomToken(9),
      name,
      tokenHash: await sha256(seatToken),
      joinedAt: Date.now(),
      ready: false,
      revealed: false,
      correctWordShown: false,
    };
    data.players.push(player);
    await this.save(data);
    await this.broadcast(data);
    return apiJson({ seatToken, playerId: player.id }, 201);
  }

  private async state(request: Request): Promise<Response> {
    const data = await this.requireRoom();
    const attachment = await this.authenticate(request, data);
    return apiJson(this.viewFor(data, attachment));
  }

  private async issueTicket(request: Request): Promise<Response> {
    const data = await this.requireRoom();
    const attachment = await this.authenticate(request, data);
    const now = Date.now();
    data.tickets = Object.fromEntries(Object.entries(data.tickets).filter(([, ticket]) => ticket.expiresAt > now));
    const ticket = randomToken(18);
    data.tickets[ticket] = { ...attachment, expiresAt: now + TICKET_TTL_MS };
    await this.save(data);
    return apiJson({ ticket, expiresAt: now + TICKET_TTL_MS });
  }

  private async socket(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      throw new HttpError(426, "A WebSocket upgrade is required.");
    }
    const data = await this.requireRoom();
    const ticketValue = new URL(request.url).searchParams.get("ticket") ?? "";
    const ticket = data.tickets[ticketValue];
    if (!ticket || ticket.expiresAt <= Date.now()) throw new HttpError(401, "Socket ticket is invalid or expired.");
    delete data.tickets[ticketValue];
    await this.save(data);
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    const attachment: SocketAttachment = { subject: ticket.subject, playerId: ticket.playerId };
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment(attachment);
    server.send(JSON.stringify({ type: "room", room: this.viewFor(data, attachment) }));
    await this.broadcast(data);
    return new Response(null, { status: 101, webSocket: client });
  }

  private async playerAction(request: Request, action: "ready" | "reveal" | "spy-answer"): Promise<Response> {
    const data = await this.requireRoom();
    const attachment = await this.authenticate(request, data);
    if (attachment.subject !== "player") throw new HttpError(403, "A player seat is required.");
    const player = data.players.find((candidate) => candidate.id === attachment.playerId);
    if (!player) throw new HttpError(401, "This seat is no longer active.");
    const role = data.game?.assignments[player.id];
    if (!role) throw new HttpError(409, "Wait for the next game to receive a card.");
    if (action === "ready") player.ready = true;
    if (action === "reveal") player.revealed = true;
    if (action === "spy-answer") {
      if (role !== "spy") throw new HttpError(409, "Only the Spy Pup checks the final guess this way.");
      player.revealed = true;
      player.correctWordShown = true;
    }
    await this.save(data);
    await this.broadcast(data);
    return apiJson(this.playerView(data, player.id));
  }

  private async startGame(request: Request): Promise<Response> {
    const data = await this.requireRoom();
    const attachment = await this.authenticate(request, data);
    if (attachment.subject !== "host") throw new HttpError(403, "Host controls are required.");
    if (data.phase === "active") throw new HttpError(409, "Reveal the current game before starting another.");
    const body = await readJson<{ mode: RoomMode; packIds: string[]; customPairs?: WordPair[] }>(request);
    const mode: RoomMode = body.mode === "experimental" ? "experimental" : "official";
    const maximum = mode === "official" ? 8 : 12;
    if (data.players.length < 4 || data.players.length > maximum) {
      throw new HttpError(409, `${mode === "official" ? "Official" : "Experimental"} mode needs 4 to ${maximum} players.`);
    }
    const selectedIds = new Set(Array.isArray(body.packIds) ? body.packIds : []);
    const builtInPairs = BUILT_IN_PACKS.filter((pack) => selectedIds.has(pack.id)).flatMap((pack) => pack.pairs);
    const customPairs = Array.isArray(body.customPairs) ? body.customPairs.map(validatePair) : [];
    if (customPairs.length > 500) throw new HttpError(400, "Select no more than 500 custom pairs.");
    const uniquePairs = Array.from(
      new Map([...builtInPairs, ...customPairs].map((pair) => [
        `${pair.goodWord.toLocaleLowerCase()}::${pair.confusedWord.toLocaleLowerCase()}`,
        pair,
      ])).values(),
    );
    const selection = choosePair(uniquePairs, data.usedPairKeys, secureRandom);
    data.usedPairKeys = selection.resetUsed ? [selection.key] : [...data.usedPairKeys, selection.key];
    const playerIds = data.players.map((player) => player.id);
    const assignments = buildAssignments(playerIds, mode, secureRandom);
    const firstPlayerId = playerIds[Math.floor(secureRandom() * playerIds.length)];
    data.mode = mode;
    data.phase = "active";
    data.game = {
      id: randomToken(12),
      number: (data.game?.number ?? 0) + 1,
      pair: selection.pair,
      assignments,
      firstPlayerId,
    };
    for (const player of data.players) {
      player.ready = false;
      player.revealed = false;
      player.correctWordShown = false;
    }
    await this.save(data);
    await this.broadcast(data);
    return apiJson(this.hostView(data));
  }

  private async updateSettings(request: Request): Promise<Response> {
    const data = await this.requireRoom();
    const attachment = await this.authenticate(request, data);
    if (attachment.subject !== "host") throw new HttpError(403, "Host controls are required.");
    if (data.phase === "active") throw new HttpError(409, "Reveal the current game before changing room mode.");
    const body = await readJson<{ mode: RoomMode }>(request);
    const mode: RoomMode = body.mode === "experimental" ? "experimental" : "official";
    if (mode === "official" && data.players.length > 8) {
      throw new HttpError(409, "Remove players until eight or fewer remain before using Official mode.");
    }
    data.mode = mode;
    await this.save(data);
    await this.broadcast(data);
    return apiJson(this.hostView(data));
  }

  private async revealGame(request: Request): Promise<Response> {
    const data = await this.requireRoom();
    const attachment = await this.authenticate(request, data);
    if (attachment.subject !== "host") throw new HttpError(403, "Host controls are required.");
    if (!data.game) throw new HttpError(409, "There is no game to reveal.");
    data.phase = "revealed";
    await this.save(data);
    await this.broadcast(data);
    return apiJson(this.hostView(data));
  }

  private async removePlayer(request: Request): Promise<Response> {
    const data = await this.requireRoom();
    const attachment = await this.authenticate(request, data);
    if (attachment.subject !== "host") throw new HttpError(403, "Host controls are required.");
    if (data.phase === "active") throw new HttpError(409, "Reveal the current game before removing a player.");
    const { playerId } = await readJson<{ playerId: string }>(request);
    const before = data.players.length;
    data.players = data.players.filter((player) => player.id !== playerId);
    if (data.players.length === before) throw new HttpError(404, "Player not found.");
    await this.save(data);
    await this.broadcast(data);
    return apiJson(this.hostView(data));
  }

  private async endRoom(request: Request): Promise<Response> {
    const data = await this.requireRoom();
    const attachment = await this.authenticate(request, data);
    if (attachment.subject !== "host") throw new HttpError(403, "Host controls are required.");
    for (const socket of this.ctx.getWebSockets()) socket.close(1000, "Room ended");
    this.data = undefined;
    await this.ctx.storage.deleteAll();
    return apiJson({ ended: true });
  }

  async fetch(request: Request): Promise<Response> {
    try {
      const path = new URL(request.url).pathname.slice(1);
      if (path === "create" && request.method === "POST") return await this.create(request);
      if (path === "public" && request.method === "GET") return await this.publicState();
      if (path === "join" && request.method === "POST") return await this.join(request);
      if (path === "state" && request.method === "GET") return await this.state(request);
      if (path === "ticket" && request.method === "POST") return await this.issueTicket(request);
      if (path === "socket" && request.method === "GET") return await this.socket(request);
      if (path === "player/ready" && request.method === "POST") return await this.playerAction(request, "ready");
      if (path === "player/reveal" && request.method === "POST") return await this.playerAction(request, "reveal");
      if (path === "player/spy-answer" && request.method === "POST") return await this.playerAction(request, "spy-answer");
      if (path === "host/start" && request.method === "POST") return await this.startGame(request);
      if (path === "host/settings" && request.method === "POST") return await this.updateSettings(request);
      if (path === "host/reveal" && request.method === "POST") return await this.revealGame(request);
      if (path === "host/remove" && request.method === "POST") return await this.removePlayer(request);
      if (path === "host/end" && request.method === "POST") return await this.endRoom(request);
      return apiError("Room action not found.", 404);
    } catch (error) {
      if (error instanceof HttpError) return apiError(error.message, error.status);
      console.error("room_failure", error instanceof Error ? error.name : "unknown");
      return apiError("The room could not complete that action.", 500);
    }
  }

  async webSocketMessage(socket: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (message === "ping") socket.send("pong");
  }

  async webSocketClose(): Promise<void> {
    const data = await this.load();
    if (data) await this.broadcast(data);
  }

  async alarm(): Promise<void> {
    for (const socket of this.ctx.getWebSockets()) socket.close(1000, "Room expired");
    this.data = undefined;
    await this.ctx.storage.deleteAll();
  }
}

interface LibraryData extends CustomLibrary {
  tokenHash: string;
  createdAt: number;
}

export class LibraryDurableObject extends DurableObject<Env> {
  private async authenticate(request: Request): Promise<LibraryData> {
    const expected = request.headers.get("X-Library-Hash") ?? "";
    const data = await this.ctx.storage.get<LibraryData>("library");
    if (!data || !expected || data.tokenHash !== expected) throw new HttpError(401, "Library key is invalid.");
    return data;
  }

  async fetch(request: Request): Promise<Response> {
    try {
      const path = new URL(request.url).pathname.slice(1);
      if (path === "initialize" && request.method === "POST") {
        if (await this.ctx.storage.get("library")) return apiError("Library already exists.", 409);
        const tokenHash = request.headers.get("X-Library-Hash") ?? "";
        if (!tokenHash) return apiError("Library initialization failed.", 400);
        const now = Date.now();
        const data: LibraryData = { tokenHash, createdAt: now, updatedAt: now, packs: [] };
        await this.ctx.storage.put("library", data);
        return apiJson({ packs: data.packs, updatedAt: data.updatedAt }, 201);
      }
      const data = await this.authenticate(request);
      if (path === "read" && request.method === "GET") {
        return apiJson({ packs: data.packs, updatedAt: data.updatedAt });
      }
      if (path === "write" && request.method === "PUT") {
        const body = await readJson<{ packs: unknown }>(request);
        data.packs = validateLibraryPacks(body.packs);
        data.updatedAt = Date.now();
        await this.ctx.storage.put("library", data);
        return apiJson({ packs: data.packs, updatedAt: data.updatedAt });
      }
      if (path === "delete" && request.method === "DELETE") {
        await this.ctx.storage.deleteAll();
        return apiJson({ deleted: true });
      }
      return apiError("Library action not found.", 404);
    } catch (error) {
      if (error instanceof HttpError) return apiError(error.message, error.status);
      console.error("library_failure", error instanceof Error ? error.name : "unknown");
      return apiError("The word library could not complete that action.", 500);
    }
  }
}
