import { describe, expect, it } from "vitest";
import { roleDistribution } from "../shared/rules";
import { buildAssignments, choosePair, roundOutcome } from "./game";

describe("roleDistribution", () => {
  it.each([
    [4, { good: 3, confused: 1, spy: 0 }],
    [5, { good: 3, confused: 1, spy: 1 }],
    [6, { good: 4, confused: 1, spy: 1 }],
    [7, { good: 4, confused: 2, spy: 1 }],
    [8, { good: 5, confused: 2, spy: 1 }],
    [9, { good: 5, confused: 3, spy: 1 }],
    [10, { good: 6, confused: 3, spy: 1 }],
    [11, { good: 6, confused: 4, spy: 1 }],
    [12, { good: 7, confused: 4, spy: 1 }],
  ] as const)("uses the expected ratio for %i players", (players, expected) => {
    expect(roleDistribution(players)).toEqual(expected);
  });

  it.each([3, 13, 6.5])("rejects %s players", (players) => {
    expect(() => roleDistribution(players)).toThrow(/4 to 12/i);
  });
});

describe("buildAssignments", () => {
  it("assigns every player exactly once", () => {
    const ids = ["a", "b", "c", "d", "e"];
    const assignments = buildAssignments(ids, () => 0.25);
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

describe("roundOutcome", () => {
  const six = { good: 4, confused: 1, spy: 1 };
  const none = { good: 0, confused: 0, spy: 0 };

  it("keeps playing while impostors hide among enough Good Kittens", () => {
    expect(roundOutcome(six, none)).toBeUndefined();
    expect(roundOutcome(six, { good: 2, confused: 0, spy: 1 })).toBeUndefined();
  });

  it("gives the round to the Kittens once every impostor is out", () => {
    expect(roundOutcome(six, { good: 1, confused: 1, spy: 1 })).toBe("kittens");
  });

  it("gives the round to the impostors when one Good Kitten is left", () => {
    expect(roundOutcome(six, { good: 3, confused: 0, spy: 0 })).toBe("impostors");
    expect(roundOutcome({ good: 3, confused: 1, spy: 0 }, { good: 2, confused: 0, spy: 0 })).toBe("impostors");
  });
});
