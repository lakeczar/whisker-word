import { roleDistribution } from "../shared/rules";
import type { Role, RoleCounts, RoundOutcome, WordPair } from "../shared/types";

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
  random: () => number = Math.random,
): Record<string, Role> {
  const ratio = roleDistribution(playerIds.length);
  const roles: Role[] = [
    ...Array<Role>(ratio.good).fill("good"),
    ...Array<Role>(ratio.confused).fill("confused"),
    ...Array<Role>(ratio.spy).fill("spy"),
  ];
  const randomizedRoles = shuffled(roles, random);
  return Object.fromEntries(playerIds.map((id, index) => [id, randomizedRoles[index]]));
}

export function pairKey(pair: WordPair): string {
  return `${pair.goodWord.trim().toLocaleLowerCase()}::${pair.confusedWord.trim().toLocaleLowerCase()}`;
}

export function choosePair(
  pairs: readonly WordPair[],
  usedPairKeys: readonly string[],
  random: () => number = Math.random,
): { pair: WordPair; key: string; resetUsed: boolean } {
  if (!pairs.length) throw new Error("Choose at least one word pack with available pairs.");
  let available = pairs.filter((pair) => !usedPairKeys.includes(pairKey(pair)));
  const resetUsed = available.length === 0;
  if (resetUsed) available = [...pairs];
  const pair = available[Math.floor(random() * available.length)];
  return { pair, key: pairKey(pair), resetUsed };
}

export function countRoles(roles: readonly Role[]): RoleCounts {
  const counts: RoleCounts = { good: 0, confused: 0, spy: 0 };
  for (const role of roles) counts[role] += 1;
  return counts;
}

/**
 * The result the table can already see from who is out. A Spy Pup who is out
 * may still win by guessing the Good word aloud; players settle that themselves.
 */
export function roundOutcome(dealt: RoleCounts, out: RoleCounts): RoundOutcome | undefined {
  const impostorsLeft = dealt.confused - out.confused + dealt.spy - out.spy;
  const goodLeft = dealt.good - out.good;
  if (impostorsLeft === 0) return "kittens";
  if (goodLeft <= 1) return "impostors";
  return undefined;
}
