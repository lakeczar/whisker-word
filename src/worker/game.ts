import type { Role, RoomMode, WordPair } from "../shared/types";

const RATIOS: Record<number, { good: number; confused: number; spy: number }> = {
  4: { good: 3, confused: 1, spy: 0 },
  5: { good: 3, confused: 1, spy: 1 },
  6: { good: 4, confused: 1, spy: 1 },
  7: { good: 4, confused: 2, spy: 1 },
  8: { good: 5, confused: 2, spy: 1 },
  9: { good: 5, confused: 3, spy: 1 },
  10: { good: 6, confused: 3, spy: 1 },
  11: { good: 6, confused: 4, spy: 1 },
  12: { good: 7, confused: 4, spy: 1 },
};

export function roleDistribution(playerCount: number, mode: RoomMode) {
  if (playerCount < 4 || playerCount > 12) throw new Error("Whisker Word supports 4 to 12 players.");
  if (mode === "official" && playerCount > 8) throw new Error("Official mode supports 4 to 8 players.");
  return RATIOS[playerCount];
}

export function shuffled<T>(values: readonly T[], random: () => number = Math.random): T[] {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

export function buildAssignments(
  playerIds: readonly string[],
  mode: RoomMode,
  random: () => number = Math.random,
): Record<string, Role> {
  const ratio = roleDistribution(playerIds.length, mode);
  const roles: Role[] = [
    ...Array<Role>(ratio.good).fill("good"),
    ...Array<Role>(ratio.confused).fill("confused"),
    ...Array<Role>(ratio.spy).fill("spy"),
  ];
  const randomizedRoles = shuffled(roles, random);
  return Object.fromEntries(playerIds.map((id, index) => [id, randomizedRoles[index]]));
}

export function choosePair(
  pairs: readonly WordPair[],
  usedPairKeys: readonly string[],
  random: () => number = Math.random,
): { pair: WordPair; key: string; resetUsed: boolean } {
  if (!pairs.length) throw new Error("Choose at least one word pack with available pairs.");
  const keyFor = (pair: WordPair) => `${pair.goodWord.trim().toLocaleLowerCase()}::${pair.confusedWord.trim().toLocaleLowerCase()}`;
  let available = pairs.filter((pair) => !usedPairKeys.includes(keyFor(pair)));
  const resetUsed = available.length === 0;
  if (resetUsed) available = [...pairs];
  const pair = available[Math.floor(random() * available.length)];
  return { pair, key: keyFor(pair), resetUsed };
}
