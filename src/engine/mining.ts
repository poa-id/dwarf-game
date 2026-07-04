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
    // Rough Quartz - the common gem tier, added 2026-06-23 alongside
    // the Tinkering skill and Gemcutting station. See
    // gathering.ts's GatherableNode.gemDrop doc comment for the full
    // rationale. 2% base chance is the highest of the three gem tiers
    // (per explicit design: rarer veins drop their OWN gem less often
    // too, compounding rarity rather than offsetting it) - upgradeable
    // via the Gemcutting station's own tier track and, eventually,
    // better tools/global perks (not yet built).
    gemDrop: { materialId: "rough_quartz", baseChance: 0.02 },
  },
  {
    id: "iron_vein",
    name: "Iron Vein",
    materialId: "iron_ore",
    requiredLevel: 8,
    baseXp: 30,
    baseYield: 1,
    baseSuccessChance: 0.75,
    // Placed in the Tunnel Entrance (2026-06-23, see hubMap.ts's
    // ORE_VEINS) - was a placeholder definition before that. Kept
    // infinite (totalYieldCapacity: null) per explicit project
    // direction, consistent with the Never Deadlock the Engine
    // principle (LORE.md) - simpler than introducing finite veins now,
    // and the mine's depth-gating already provides progression
    // pressure without needing depletion on top of it.
    totalYieldCapacity: null,
    // Rough Garnet - the uncommon gem tier. See copper_vein's comment
    // above for the full rationale.
    gemDrop: { materialId: "rough_garnet", baseChance: 0.01 },
  },
  {
    id: "coal_seam",
    name: "Coal Seam",
    materialId: "coal",
    requiredLevel: 8, // requires iron pickaxe tier — gives charcoal more relevance early
    baseXp: 6,
    baseYield: 1,
    baseSuccessChance: 0.85,
    // Placed in the Tunnel Entrance (2026-06-23, see hubMap.ts's
    // ORE_VEINS) - was a placeholder definition before that. Kept
    // infinite, same reasoning as iron_vein above - coal is also
    // foundational fuel once reachable, not meant to be a scarcity gate.
    totalYieldCapacity: null,
  },
  {
    id: "deepstone",
    name: "Deepstone Seam",
    materialId: "deepstone_ore",
    requiredLevel: 15,
    baseXp: 45,
    baseYield: 1,
    baseSuccessChance: 0.6,
    totalYieldCapacity: null,
    gemDrop: { materialId: "rough_amethyst", baseChance: 0.003 },
  },
];

export const PICKAXE_TIERS: ToolTier[] = [
  { tier: 0, successChanceBonus: 0,    yieldMultiplier: 1.0, name: "Bare Hands" },
  { tier: 1, successChanceBonus: 0.10, yieldMultiplier: 1.5, name: "Copper Pickaxe" },  // +50% — first real upgrade
  { tier: 2, successChanceBonus: 0.20, yieldMultiplier: 2.5, name: "Iron Pickaxe" },    // +150% — dramatically faster
  { tier: 3, successChanceBonus: 0.30, yieldMultiplier: 4.0, name: "Deepstone Pickaxe" }, // +300% — late-game, ore flies
];

export function bestAvailablePickaxe(forgedPickaxeTier: number): ToolTier {
  return bestAvailableTool(PICKAXE_TIERS, forgedPickaxeTier);
}

export function attemptMineStrike(
  node: RockNode,
  miningSkill: SkillState,
  forgedPickaxeTier: number,
  depletion: NodeDepletionState,
  roll: number,
  gemRoll: number = 1,
  gemDropChanceBonus: number = 0,
  hearthYieldBonus: number = 0
): MineStrikeResult {
  const pickaxe = bestAvailablePickaxe(forgedPickaxeTier);
  return attemptGatherStrike(
    node,
    miningSkill,
    pickaxe,
    depletion,
    roll,
    gemRoll,
    gemDropChanceBonus,
    hearthYieldBonus
  );
}

export function applyMineResult(inventory: ResourceBag, result: MineStrikeResult): ResourceBag {
  return applyGatherResult(inventory, result);
}
