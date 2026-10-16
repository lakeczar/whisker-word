import { describe, expect, it } from "vitest";
import { buildHostView, buildPlayerView, normalizeRoom } from "./room";
import type { RoomData } from "./room";

const pair = { goodWord: "Coffee", confusedWord: "Hot chocolate" };

function room(overrides: Partial<RoomData> = {}): RoomData {
  const names = ["Host", "Ava", "Ben", "Cleo", "Dev", "Eli"];
  const roles = ["good", "good", "confused", "spy", "good", "good"] as const;
  return {
    code: "PAWS24",
    hostTokenHash: "hash",
    hostPlayerId: "p0",
    createdAt: 0,
    updatedAt: 0,
    phase: "active",
    targetPlayers: 6,
    packIds: ["food-drink"],
    customPacks: [],
    players: names.map((name, index) => ({ id: `p${index}`, name, tokenHash: `t${index}`, joinedAt: index, ready: true, out: false })),
    game: { id: "g", number: 1, pair, assignments: Object.fromEntries(roles.map((role, index) => [`p${index}`, role])) },
    usedPairKeys: [],
    tickets: {},
    ...overrides,
  };
}

const connected = new Set<string>();
const words = [pair.goodWord, pair.confusedWord];

describe("host view during a live round", () => {
  it("holds no words and no roles, so a host who plays is not spoiled", () => {
    const json = JSON.stringify(buildHostView(room(), connected));
    for (const word of words) expect(json).not.toContain(word);
    expect(json).not.toContain('"role"');
  });

  it("shows the role of a player only after they are out", () => {
    const data = room();
    data.players[2].out = true;
    const view = buildHostView(data, connected);
    expect(view.table.map((seat) => seat.role)).toEqual([undefined, undefined, "confused", undefined, undefined, undefined]);
    expect(view.outCounts).toEqual({ good: 0, confused: 1, spy: 0 });
    expect(view.goodWord).toBeUndefined();
  });
});

describe("player view", () => {
  it("gives the host's seat only its own card", () => {
    const view = buildPlayerView(room(), "p0", connected)!;
    expect(view.isHost).toBe(true);
    expect(view.word).toBe("Coffee");
    expect(view.exactRole).toBeUndefined();
    expect(JSON.stringify(view)).not.toContain("Hot chocolate");
    expect(view.table.every((seat) => seat.role === undefined)).toBe(true);
  });

  it("gives the Spy Pup no word until they are out", () => {
    const data = room();
    expect(buildPlayerView(data, "p3", connected)!.word).toBeUndefined();
    expect(JSON.stringify(buildPlayerView(data, "p3", connected))).not.toContain("Coffee");
    data.players[3].out = true;
    const out = buildPlayerView(data, "p3", connected)!;
    expect(out.exactRole).toBe("spy");
    expect(out.spyAnswer).toBe("Coffee");
    expect(JSON.stringify(buildPlayerView(data, "p2", connected))).not.toContain("Coffee");
  });

  it("calls the round once every impostor is out", () => {
    const data = room();
    data.players[2].out = true;
    data.players[3].out = true;
    expect(buildPlayerView(data, "p1", connected)!.outcome).toBe("kittens");
  });

  it("shows every role and both words once the round is over", () => {
    const view = buildPlayerView(room({ phase: "revealed" }), "p1", connected)!;
    expect(view.table.map((seat) => seat.role)).toEqual(["good", "good", "confused", "spy", "good", "good"]);
    expect([view.goodWord, view.confusedWord]).toEqual(words);
  });

  it("marks a late joiner as not in this round", () => {
    const data = room();
    data.players.push({ id: "late", name: "Late", tokenHash: "x", joinedAt: 9, ready: false, out: false });
    const view = buildPlayerView(data, "late", connected)!;
    expect(view.visibleRole).toBeUndefined();
    expect(view.table.find((seat) => seat.id === "late")!.inGame).toBe(false);
  });
});

describe("normalizeRoom", () => {
  it("upgrades a room saved before this version", () => {
    const legacy = {
      ...room(),
      mode: "experimental",
      targetPlayers: undefined,
      packIds: undefined,
      customPacks: undefined,
      players: [{ id: "p0", name: "A", tokenHash: "t", joinedAt: 0, ready: true, revealed: true }],
      game: { id: "g", number: 1, pair, assignments: { p0: "good" }, firstPlayerId: "p0" },
    } as unknown as RoomData;
    const data = normalizeRoom(legacy);
    expect(data.targetPlayers).toBe(12);
    expect(data.packIds.length).toBeGreaterThan(0);
    expect(data.customPacks).toEqual([]);
    expect(data.players[0].out).toBe(true);
    expect("firstPlayerId" in data.game!).toBe(false);
  });
});
