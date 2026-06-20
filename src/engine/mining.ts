import type { SkillState, ResourceBag, MaterialId } from "./types";
import { addMaterial } from "./types";
import { levelForXp } from "./xpCurve";

/**
 * A rock node a dwarf can strike. Deeper nodes require higher Mining
 * level (unlockedMineDepth on WorldState gates which are even visible)
 * and higher Smithing-derived tool tier to strike efficiently. Each
 * node yields ONE specific material - "ore" is no longer generic, a
 * Copper Vein yields copper_ore and nothing else.
 */
export interface RockNode {
  id: string;
  name: string;
  /** Which material this node yields - see MATERIALS in types.ts. */
  materialId: MaterialId;
  /** Minimum Mining level to attempt this node at all. */
  requiredLevel: number;
  /** Base XP per successful strike, before any modifiers. */
  baseXp: number;
  /** Material yielded per successful strike, before any modifiers. */
  baseYield: number;
  /** 0-1, chance a strike actually lands material+xp vs "you swing and miss" */
  baseSuccessChance: number;
  /**
   * Total material this node can ever yield before it's exhausted, or
   * null for nodes that never deplete (reserved for special/idle
   * sources later - every currently-defined node DOES deplete).
   * This is the node's STARTING richness, not its current remaining
   * amount - see NodeDepletionState for the latter.
   */
  totalYieldCapacity: number | null;
}

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

// ---------------------------------------------------------------------------
// Depletion - INSTANCE state for a specific node placed in the world,
// separate from RockNode's static content definition above. Two copper
// veins placed in different locations would each have their OWN
// NodeDepletionState, even though they share one RockNode definition.
// ---------------------------------------------------------------------------

export interface NodeDepletionState {
  /** How much this specific node instance has yielded so far, lifetime. */
  totalYielded: number;
}

export function createFreshDepletionState(): NodeDepletionState {
  return { totalYielded: 0 };
}

export function remainingYield(node: RockNode, depletion: NodeDepletionState): number | null {
  if (node.totalYieldCapacity === null) return null; // never depletes
  return Math.max(0, node.totalYieldCapacity - depletion.totalYielded);
}

export function isExhausted(node: RockNode, depletion: NodeDepletionState): boolean {
  const remaining = remainingYield(node, depletion);
  return remaining !== null && remaining <= 0;
}

export interface ToolTier {
  /** Forge tier (WorldState.forgeTier) required to have crafted this tool. */
  requiredForgeTier: number;
  /** Multiplies success chance, capped at 1.0 by the caller. */
  successChanceBonus: number;
  /** Multiplies yield. */
  yieldMultiplier: number;
  name: string;
}

export const PICKAXE_TIERS: ToolTier[] = [
  { requiredForgeTier: 0, successChanceBonus: 0, yieldMultiplier: 1, name: "Bare Hands" },
  { requiredForgeTier: 1, successChanceBonus: 0.1, yieldMultiplier: 1.25, name: "Copper Pick" },
  { requiredForgeTier: 2, successChanceBonus: 0.2, yieldMultiplier: 1.5, name: "Iron Pick" },
  { requiredForgeTier: 3, successChanceBonus: 0.3, yieldMultiplier: 2, name: "Steel Pick" },
];

export function bestAvailablePickaxe(forgeTier: number): ToolTier {
  const eligible = PICKAXE_TIERS.filter((t) => t.requiredForgeTier <= forgeTier);
  return eligible[eligible.length - 1];
}

export interface MineStrikeResult {
  success: boolean;
  xpGained: number;
  materialId: MaterialId;
  amountGained: number;
  newLevel: number;
  leveledUp: boolean;
  newDepletion: NodeDepletionState;
}

/**
 * Attempt one strike against a node. Pure function — caller supplies a
 * random roll so this stays deterministic and testable; production code
 * passes Math.random(), tests pass fixed values.
 *
 * Throws if the node is already exhausted - same defensive pattern as
 * the existing level-gate check; the caller (UI layer) is responsible
 * for not offering an exhausted node as strikeable in the first place.
 */
export function attemptMineStrike(
  node: RockNode,
  miningSkill: SkillState,
  forgeTier: number,
  depletion: NodeDepletionState,
  roll: number
): MineStrikeResult {
  if (miningSkill.level < node.requiredLevel) {
    throw new Error(
      `Mining level ${miningSkill.level} is below required ${node.requiredLevel} for ${node.id}`
    );
  }

  if (isExhausted(node, depletion)) {
    throw new Error(`Node ${node.id} is already exhausted`);
  }

  const pickaxe = bestAvailablePickaxe(forgeTier);
  const successChance = Math.min(1, node.baseSuccessChance + pickaxe.successChanceBonus);
  const success = roll < successChance;

  const oldLevel = miningSkill.level;

  if (!success) {
    return {
      success: false,
      xpGained: 0,
      materialId: node.materialId,
      amountGained: 0,
      newLevel: oldLevel,
      leveledUp: false,
      newDepletion: depletion,
    };
  }

  const xpGained = node.baseXp;
  const rawYield = Math.round(node.baseYield * pickaxe.yieldMultiplier);
  // Cap the actual yield at whatever remains, so a lucky high-yield
  // strike on an almost-exhausted node can't pull MORE material out of
  // it than it actually has left.
  const remaining = remainingYield(node, depletion);
  const amountGained = remaining === null ? rawYield : Math.min(rawYield, remaining);

  const newXp = miningSkill.xp + xpGained;
  const newLevel = levelForXp(newXp);

  return {
    success: true,
    xpGained,
    materialId: node.materialId,
    amountGained,
    newLevel,
    leveledUp: newLevel > oldLevel,
    newDepletion: { totalYielded: depletion.totalYielded + amountGained },
  };
}

export function applyMineResult(inventory: ResourceBag, result: MineStrikeResult): ResourceBag {
  if (!result.success || result.amountGained === 0) return inventory;
  return addMaterial(inventory, result.materialId, result.amountGained);
}
