import type { SkillState, ResourceBag } from "./types";
import {
  type GatherableNode,
  type ToolTier,
  type NodeDepletionState,
  type GatherStrikeResult,
  bestAvailableTool,
  attemptGatherStrike,
  applyGatherResult,
  createFreshDepletionState,
  remainingYield,
  isExhausted,
} from "./gathering";

export { createFreshDepletionState, remainingYield, isExhausted };
export type { NodeDepletionState };

/**
 * A wood-bearing formation - cave-roots and underground wood growths,
 * not surface trees (there is no surface here; the mountain is the
 * whole world). Same specialization pattern as mining.ts: a thin layer
 * over the generic gathering mechanic.
 *
 * Per design discussion: Woodcraft covers BOTH cutting raw wood and
 * processing it into planks/lumber, but growing/planting trees is
 * explicitly deferred - these nodes are all pre-existing formations to
 * cut, not something the player plants yet.
 */
export type WoodNode = GatherableNode;

export const WOOD_NODES: WoodNode[] = [
  {
    id: "root_tangle",
    name: "Cave-Root Tangle",
    materialId: "wood",
    requiredLevel: 1,
    baseXp: 7,
    baseYield: 1,
    baseSuccessChance: 0.88,
    // Changed from a finite cap (was 50, originally 30) to infinite
    // (2026-06-23, playtesting feedback) - same reasoning as
    // copper_vein in mining.ts: this was the ONLY source of wood
    // anywhere in the game, so exhausting it meant a PERMANENT
    // deadlock (no more charcoal, no more tool-forging, no more
    // torch repair, no recovery path). Basic starter materials are
    // now infinite by design - a slow, reliable idle engine the
    // player can always fall back on. See mining.ts's copper_vein
    // for the fuller rationale; this entry's earlier capacity-raise
    // history (30 -> 50) is now superseded by this change, kept here
    // for the record rather than deleted.
    totalYieldCapacity: null,
  },
];

export const AXE_TIERS: ToolTier[] = [
  { tier: 0, successChanceBonus: 0, yieldMultiplier: 1, name: "Bare Hands" },
  { tier: 1, successChanceBonus: 0.1, yieldMultiplier: 1.25, name: "Copper Axe" },
  { tier: 2, successChanceBonus: 0.2, yieldMultiplier: 1.5, name: "Iron Axe" },
  // Tier 3 ("Steel Axe") intentionally absent - same reason as
  // PICKAXE_TIERS in mining.ts: no steel_ingot material exists yet.
];

export function bestAvailableAxe(forgedAxeTier: number): ToolTier {
  return bestAvailableTool(AXE_TIERS, forgedAxeTier);
}

export type WoodGatherResult = GatherStrikeResult;

export function attemptWoodGather(
  node: WoodNode,
  woodcraftSkill: SkillState,
  forgedAxeTier: number,
  depletion: NodeDepletionState,
  roll: number,
  hearthYieldBonus: number = 0
): WoodGatherResult {
  const axe = bestAvailableAxe(forgedAxeTier);
  // Gem params are left at attemptGatherStrike's own defaults (1, 0) -
  // wood nodes never have a gemDrop config (see gathering.ts's
  // GatherableNode doc comment), so there's nothing for a real roll to
  // ever win here regardless. hearthYieldBonus (added 2026-06-23) IS
  // real and applies uniformly, per explicit direction.
  return attemptGatherStrike(node, woodcraftSkill, axe, depletion, roll, undefined, undefined, hearthYieldBonus);
}

export function applyWoodGatherResult(
  inventory: ResourceBag,
  result: WoodGatherResult
): ResourceBag {
  return applyGatherResult(inventory, result);
}
