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
    // Raised from 30 -> 50 (2026-06-23, playtesting feedback): forge
    // repair alone costs 15 wood (see FORGE_REPAIR_COST in smithing.ts),
    // which left only 15 of the old 30-wood capacity for everything
    // else - barely enough for 3 charcoal-kiln attempts (4 wood each,
    // see kiln.ts CHARCOAL_RECIPE) with zero margin for failure and
    // nothing left to feed the Hearth directly. 50 comfortably covers
    // forge repair + the charcoal needed to smelt and repair at least
    // one torch, with realistic failure margin and some wood left over -
    // deliberately NOT sized to repair every torch in the game from
    // this one starter node alone (that's not the bar; see
    // OPEN_QUESTIONS.md for the math behind this number). Kept the
    // 4:1 wood->charcoal ratio unchanged - charcoal staying a real
    // cost, not a freebie, was the explicit call here.
    totalYieldCapacity: 50,
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
  roll: number
): WoodGatherResult {
  const axe = bestAvailableAxe(forgedAxeTier);
  return attemptGatherStrike(node, woodcraftSkill, axe, depletion, roll);
}

export function applyWoodGatherResult(
  inventory: ResourceBag,
  result: WoodGatherResult
): ResourceBag {
  return applyGatherResult(inventory, result);
}
