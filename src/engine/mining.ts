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

// Re-exported under Mining-specific names for readability at call
// sites, and so existing code/tests written against "RockNode" etc
// didn't need touching when this became a specialization of the
// generic gathering.ts mechanic (originally Mining had its own
// hand-written copy of all this logic - extracted once Woodcraft
// needed the identical shape).
export type RockNode = GatherableNode;
export type MineStrikeResult = GatherStrikeResult;
export { createFreshDepletionState, remainingYield, isExhausted };
export type { NodeDepletionState };

export const ROCK_NODES: RockNode[] = [
  {
    id: "copper_vein",
    name: "Copper Vein",
    materialId: "copper_ore",
    requiredLevel: 1,
    baseXp: 8,
    baseYield: 1,
    baseSuccessChance: 0.9,
    totalYieldCapacity: 40, // a starter vein - generous enough to learn the loop, finite enough to push toward the real mine
  },
  {
    id: "iron_vein",
    name: "Iron Vein",
    materialId: "iron_ore",
    requiredLevel: 8,
    baseXp: 18,
    baseYield: 1,
    baseSuccessChance: 0.75,
    totalYieldCapacity: null, // lives in the real mine (Tunnel Entrance) - not depleting yet, revisit once that's built out with multiple nodes to balance against
  },
  {
    id: "coal_seam",
    name: "Coal Seam",
    materialId: "coal",
    requiredLevel: 1,
    baseXp: 6,
    baseYield: 1,
    baseSuccessChance: 0.85,
    totalYieldCapacity: null, // also belongs in the real mine - placeholder definition until that's built
  },
  {
    id: "deepstone",
    name: "Deepstone Seam",
    materialId: "iron_ore", // placeholder material until a real "deepstone" MaterialDefinition exists
    requiredLevel: 20,
    baseXp: 45,
    baseYield: 2,
    baseSuccessChance: 0.6,
    totalYieldCapacity: null,
  },
];

export const PICKAXE_TIERS: ToolTier[] = [
  { requiredForgeTier: 0, successChanceBonus: 0, yieldMultiplier: 1, name: "Bare Hands" },
  { requiredForgeTier: 1, successChanceBonus: 0.1, yieldMultiplier: 1.25, name: "Copper Pick" },
  { requiredForgeTier: 2, successChanceBonus: 0.2, yieldMultiplier: 1.5, name: "Iron Pick" },
  { requiredForgeTier: 3, successChanceBonus: 0.3, yieldMultiplier: 2, name: "Steel Pick" },
];

export function bestAvailablePickaxe(forgeTier: number): ToolTier {
  return bestAvailableTool(PICKAXE_TIERS, forgeTier);
}

export function attemptMineStrike(
  node: RockNode,
  miningSkill: SkillState,
  forgeTier: number,
  depletion: NodeDepletionState,
  roll: number
): MineStrikeResult {
  const pickaxe = bestAvailablePickaxe(forgeTier);
  return attemptGatherStrike(node, miningSkill, pickaxe, depletion, roll);
}

export function applyMineResult(inventory: ResourceBag, result: MineStrikeResult): ResourceBag {
  return applyGatherResult(inventory, result);
}
