import type { SkillState, ResourceBag } from "./types";
import { levelForXp } from "./xpCurve";

/**
 * A rock node a dwarf can strike. Deeper nodes require higher Mining
 * level (unlockedMineDepth on WorldState gates which are even visible)
 * and higher Smithing-derived tool tier to strike efficiently.
 */
export interface RockNode {
  id: string;
  name: string;
  /** Minimum Mining level to attempt this node at all. */
  requiredLevel: number;
  /** Base XP per successful strike, before any modifiers. */
  baseXp: number;
  /** Ore yielded per successful strike, before any modifiers. */
  baseOreYield: number;
  /** 0-1, chance a strike actually lands ore+xp vs "you swing and miss" */
  baseSuccessChance: number;
}

export const ROCK_NODES: RockNode[] = [
  {
    id: "copper_vein",
    name: "Copper Vein",
    requiredLevel: 1,
    baseXp: 8,
    baseOreYield: 1,
    baseSuccessChance: 0.9,
  },
  {
    id: "iron_vein",
    name: "Iron Vein",
    requiredLevel: 8,
    baseXp: 18,
    baseOreYield: 1,
    baseSuccessChance: 0.75,
  },
  {
    id: "deepstone",
    name: "Deepstone Seam",
    requiredLevel: 20,
    baseXp: 45,
    baseOreYield: 2,
    baseSuccessChance: 0.6,
  },
];

export interface ToolTier {
  /** Forge tier (WorldState.forgeTier) required to have crafted this tool. */
  requiredForgeTier: number;
  /** Multiplies success chance, capped at 1.0 by the caller. */
  successChanceBonus: number;
  /** Multiplies ore yield. */
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
  oreGained: number;
  newLevel: number;
  leveledUp: boolean;
}

/**
 * Attempt one strike against a node. Pure function — caller supplies a
 * random roll so this stays deterministic and testable; production code
 * passes Math.random(), tests pass fixed values.
 */
export function attemptMineStrike(
  node: RockNode,
  miningSkill: SkillState,
  forgeTier: number,
  roll: number
): MineStrikeResult {
  if (miningSkill.level < node.requiredLevel) {
    throw new Error(
      `Mining level ${miningSkill.level} is below required ${node.requiredLevel} for ${node.id}`
    );
  }

  const pickaxe = bestAvailablePickaxe(forgeTier);
  const successChance = Math.min(1, node.baseSuccessChance + pickaxe.successChanceBonus);
  const success = roll < successChance;

  const oldLevel = miningSkill.level;

  if (!success) {
    return { success: false, xpGained: 0, oreGained: 0, newLevel: oldLevel, leveledUp: false };
  }

  const xpGained = node.baseXp;
  const oreGained = Math.round(node.baseOreYield * pickaxe.yieldMultiplier);
  const newXp = miningSkill.xp + xpGained;
  const newLevel = levelForXp(newXp);

  return {
    success: true,
    xpGained,
    oreGained,
    newLevel,
    leveledUp: newLevel > oldLevel,
  };
}

export function addOreToInventory(inventory: ResourceBag, amount: number): ResourceBag {
  return { ...inventory, ore: inventory.ore + amount };
}
