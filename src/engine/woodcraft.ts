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
    totalYieldCapacity: 30, // a starter formation near the hearth - finite, like the starter copper vein
  },
];

export const AXE_TIERS: ToolTier[] = [
  { requiredForgeTier: 0, successChanceBonus: 0, yieldMultiplier: 1, name: "Bare Hands" },
  { requiredForgeTier: 1, successChanceBonus: 0.1, yieldMultiplier: 1.25, name: "Copper Hatchet" },
  { requiredForgeTier: 2, successChanceBonus: 0.2, yieldMultiplier: 1.5, name: "Iron Hatchet" },
];

export function bestAvailableAxe(forgeTier: number): ToolTier {
  return bestAvailableTool(AXE_TIERS, forgeTier);
}

export type WoodGatherResult = GatherStrikeResult;

export function attemptWoodGather(
  node: WoodNode,
  woodcraftSkill: SkillState,
  forgeTier: number,
  depletion: NodeDepletionState,
  roll: number
): WoodGatherResult {
  const axe = bestAvailableAxe(forgeTier);
  return attemptGatherStrike(node, woodcraftSkill, axe, depletion, roll);
}

export function applyWoodGatherResult(
  inventory: ResourceBag,
  result: WoodGatherResult
): ResourceBag {
  return applyGatherResult(inventory, result);
}
