import { describe, expect, it } from "vitest";
import { pairKey } from "./game";
import { BUILT_IN_PACKS } from "./wordPacks";

const pairs = BUILT_IN_PACKS.flatMap((pack) => pack.pairs.map((pair) => ({ pack: pack.id, ...pair })));
const lower = (value: string) => value.toLocaleLowerCase();

describe("built-in word packs", () => {
  it("gives every pack enough rounds for a game night", () => {
    for (const pack of BUILT_IN_PACKS) expect(pack.pairs.length, pack.id).toBeGreaterThanOrEqual(20);
  });

  it("has unique pack ids and no repeated pair", () => {
    expect(new Set(BUILT_IN_PACKS.map((pack) => pack.id)).size).toBe(BUILT_IN_PACKS.length);
    expect(new Set(pairs.map(pairKey)).size).toBe(pairs.length);
  });

  it("never hides one word inside its partner", () => {
    for (const { goodWord, confusedWord } of pairs) {
      expect(lower(confusedWord).includes(lower(goodWord)), `${goodWord} / ${confusedWord}`).toBe(false);
      expect(lower(goodWord).includes(lower(confusedWord)), `${goodWord} / ${confusedWord}`).toBe(false);
    }
  });

  it("uses each word once, so one card never hints at another pair", () => {
    const words = pairs.flatMap((pair) => [lower(pair.goodWord), lower(pair.confusedWord)]);
    const repeated = words.filter((word, index) => words.indexOf(word) !== index);
    expect(repeated).toEqual([]);
  });

  it("never uses a role name as a password", () => {
    for (const word of pairs.flatMap((pair) => [pair.goodWord, pair.confusedWord])) {
      expect(word, word).not.toMatch(/\b(spy|kitten|pup)\b/i);
    }
  });
});
