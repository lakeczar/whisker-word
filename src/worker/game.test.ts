import { describe, expect, it } from "vitest";
import { buildAssignments, choosePair, roleDistribution } from "./game";

describe("roleDistribution", () => {
  it.each([
    [4, "official", { good: 3, confused: 1, spy: 0 }],
    [5, "official", { good: 3, confused: 1, spy: 1 }],
    [6, "official", { good: 4, confused: 1, spy: 1 }],
    [7, "official", { good: 4, confused: 2, spy: 1 }],
    [8, "official", { good: 5, confused: 2, spy: 1 }],
    [9, "experimental", { good: 5, confused: 3, spy: 1 }],
    [10, "experimental", { good: 6, confused: 3, spy: 1 }],
    [11, "experimental", { good: 6, confused: 4, spy: 1 }],
    [12, "experimental", { good: 7, confused: 4, spy: 1 }],
  ] as const)("uses the expected ratio for %i players", (players, mode, expected) => {
    expect(roleDistribution(players, mode)).toEqual(expected);
  });

  it("rejects large official rooms", () => {
    expect(() => roleDistribution(9, "official")).toThrow(/4 to 8/i);
  });
});

describe("buildAssignments", () => {
  it("assigns every player exactly once", () => {
    const ids = ["a", "b", "c", "d", "e"];
    const assignments = buildAssignments(ids, "official", () => 0.25);
    expect(Object.keys(assignments)).toHaveLength(ids.length);
    expect(Object.values(assignments).filter((role) => role === "spy")).toHaveLength(1);
    expect(Object.values(assignments).filter((role) => role === "confused")).toHaveLength(1);
  });
});

describe("choosePair", () => {
  const pairs = [
    { goodWord: "Coffee", confusedWord: "Tea" },
    { goodWord: "Lion", confusedWord: "Tiger" },
  ];

  it("does not repeat an available pair", () => {
    expect(choosePair(pairs, ["coffee::tea"], () => 0).pair).toEqual(pairs[1]);
  });

  it("reshuffles after the pool is exhausted", () => {
    expect(choosePair(pairs, ["coffee::tea", "lion::tiger"], () => 0).resetUsed).toBe(true);
  });
});
