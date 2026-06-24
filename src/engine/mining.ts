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
    // Changed from a finite cap (was 40) to infinite (2026-06-23,
    // playtesting feedback): the starter vein was the ONLY source of
    // copper anywhere in the game (iron_vein/coal_seam/deepstone all
    // live in the not-yet-built real mine). Once it exhausted, a
    // player was PERMANENTLY locked out of smelting, tool-forging, and
    // torch repair, with zero recovery path - a genuine deadlock, not
    // just a tight squeeze. Per explicit project direction: basic
    // starter materials should be infinite, functioning as a slow,
    // reliable "idle engine" the player can always fall back on:
    // mine/gather, craft, repair, at a modest pace, forever, even
    // before the real mine (Tunnel Entrance) is reachable. Better
    // materials (iron, coal, deepstone) staying gated behind the real
    // mine is what makes unlocking it meaningful - the starter vein
    // was never meant to be the thing that runs out and ends the game.
    totalYieldCapacity: null,
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
  { tier: 0, successChanceBonus: 0, yieldMultiplier: 1, name: "Bare Hands" },
  { tier: 1, successChanceBonus: 0.1, yieldMultiplier: 1.25, name: "Copper Pickaxe" },
  { tier: 2, successChanceBonus: 0.2, yieldMultiplier: 1.5, name: "Iron Pickaxe" },
  // Tier 3 ("Steel Pickaxe") intentionally absent - no steel_ingot
  // material exists yet, so there's no real ToolRecipe to forge it
  // with. See OPEN_QUESTIONS.md.
];

export function bestAvailablePickaxe(forgedPickaxeTier: number): ToolTier {
  return bestAvailableTool(PICKAXE_TIERS, forgedPickaxeTier);
}

export function attemptMineStrike(
  node: RockNode,
  miningSkill: SkillState,
  forgedPickaxeTier: number,
  depletion: NodeDepletionState,
  roll: number
): MineStrikeResult {
  const pickaxe = bestAvailablePickaxe(forgedPickaxeTier);
  return attemptGatherStrike(node, miningSkill, pickaxe, depletion, roll);
}

export function applyMineResult(inventory: ResourceBag, result: MineStrikeResult): ResourceBag {
  return applyGatherResult(inventory, result);
}
