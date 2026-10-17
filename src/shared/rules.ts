import type { Role, RoleCounts } from "./types";

export const MIN_PLAYERS = 4;
export const MAX_PLAYERS = 12;
/** Tables above this size use house ratios that are not part of the original game. */
export const OFFICIAL_MAX_PLAYERS = 8;

const RATIOS: Record<number, RoleCounts> = {
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

export function roleDistribution(playerCount: number): RoleCounts {
  if (!Number.isInteger(playerCount) || playerCount < MIN_PLAYERS || playerCount > MAX_PLAYERS) {
    throw new Error(`Whisker Word supports ${MIN_PLAYERS} to ${MAX_PLAYERS} players.`);
  }
  return { ...RATIOS[playerCount] };
}

export function isOfficialSize(playerCount: number): boolean {
  return playerCount <= OFFICIAL_MAX_PLAYERS;
}

export const ROLE_NAMES: Record<Role, { one: string; many: string }> = {
  good: { one: "Good Kitten", many: "Good Kittens" },
  confused: { one: "Confused Kitten", many: "Confused Kittens" },
  spy: { one: "Spy Pup", many: "Spy Pups" },
};

export function roleLabel(role: Role, count = 1): string {
  return count === 1 ? ROLE_NAMES[role].one : ROLE_NAMES[role].many;
}
