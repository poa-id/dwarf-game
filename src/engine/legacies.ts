import type { GameState, WorldState } from "./types";

export type LegacyId = "inherited_hands" | "hearthline" | "deep_memory";

export interface LegacyDefinition {
  id: LegacyId;
  name: string;
  description: string;
  maxRank: number;
  baseCost: number;
}

export const LEGACIES: LegacyDefinition[] = [
  { id: "inherited_hands", name: "Inherited Hands", description: "+5% yield from every craft and gathering action per rank.", maxRank: 10, baseCost: 1 },
  { id: "hearthline", name: "Hearthline", description: "+10% fuel efficiency per rank; the fire asks less of the mountain.", maxRank: 5, baseCost: 1 },
  { id: "deep_memory", name: "Deep Memory", description: "+5% experience from automated work per rank.", maxRank: 10, baseCost: 1 },
];

export function legacyRank(world: Pick<WorldState, "legacyRanks">, id: LegacyId): number {
  return Math.max(0, world.legacyRanks?.[id] ?? 0);
}

export function legacyCost(world: Pick<WorldState, "legacyRanks">, id: LegacyId): number | null {
  const def = LEGACIES.find((entry) => entry.id === id);
  if (!def) return null;
  const rank = legacyRank(world, id);
  return rank >= def.maxRank ? null : def.baseCost + rank;
}

export const legacyYieldBonus = (world: Pick<WorldState, "legacyRanks" | "rekindleMultiplier">): number =>
  legacyRank(world, "inherited_hands") * 0.05;
export const legacyHearthEfficiency = (world: Pick<WorldState, "legacyRanks">): number =>
  1 + legacyRank(world, "hearthline") * 0.1;
export const legacyXpBonus = (world: Pick<WorldState, "legacyRanks">): number =>
  legacyRank(world, "deep_memory") * 0.05;

export function buyLegacy(state: GameState, id: LegacyId): GameState {
  const def = LEGACIES.find((entry) => entry.id === id);
  const cost = legacyCost(state.world, id);
  const held = state.world.remembranceBanked ?? 0;
  if (!def || cost === null || held < cost) return state;
  const rank = legacyRank(state.world, id) + 1;
  const legacyRanks = { ...(state.world.legacyRanks ?? {}), [id]: rank };
  return {
    ...state,
    world: {
      ...state.world,
      remembranceBanked: held - cost,
      legacyRanks,
      // Kept as a save-compatible mirror for existing yield call sites.
      rekindleMultiplier: legacyRanks.inherited_hands * 0.05,
    },
  };
}
