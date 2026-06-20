import type { SkillState, ResourceBag } from "./types";
import { levelForXp } from "./xpCurve";

export interface SmithRecipe {
  id: string;
  name: string;
  requiredLevel: number;
  oreCost: number;
  baseXp: number;
  ingotYield: number;
  /** 0-1, a timing/rhythm-style attempt can still fail to land cleanly. */
  baseSuccessChance: number;
}

export const SMITH_RECIPES: SmithRecipe[] = [
  {
    id: "copper_ingot",
    name: "Copper Ingot",
    requiredLevel: 1,
    oreCost: 2,
    baseXp: 10,
    ingotYield: 1,
    baseSuccessChance: 0.85,
  },
  {
    id: "iron_ingot",
    name: "Iron Ingot",
    requiredLevel: 10,
    oreCost: 3,
    baseXp: 22,
    ingotYield: 1,
    baseSuccessChance: 0.7,
  },
  {
    id: "steel_ingot",
    name: "Steel Ingot",
    requiredLevel: 25,
    oreCost: 4,
    baseXp: 50,
    ingotYield: 1,
    baseSuccessChance: 0.55,
  },
];

export interface SmithAttemptResult {
  success: boolean;
  xpGained: number;
  ingotsGained: number;
  oreSpent: number;
  /** Byproduct fed to the Hearth - this is the literal fuel link in the design. */
  fuelByproduct: number;
  newLevel: number;
  leveledUp: boolean;
}

/** Fuel byproduct generated per successful smith, regardless of recipe — the scrap/slag that feeds the Hearth. */
const FUEL_BYPRODUCT_PER_SUCCESS = 3;

/**
 * Attempt to smith one item. Pure function, caller supplies `roll` for
 * determinism in tests. Throws if level or ore requirements aren't met —
 * the caller (UI layer) is responsible for not offering unavailable
 * recipes in the first place, this is a defensive invariant, not UX.
 */
export function attemptSmith(
  recipe: SmithRecipe,
  smithingSkill: SkillState,
  inventory: ResourceBag,
  roll: number
): SmithAttemptResult {
  if (smithingSkill.level < recipe.requiredLevel) {
    throw new Error(
      `Smithing level ${smithingSkill.level} is below required ${recipe.requiredLevel} for ${recipe.id}`
    );
  }
  if (inventory.ore < recipe.oreCost) {
    throw new Error(`Not enough ore: have ${inventory.ore}, need ${recipe.oreCost}`);
  }

  const success = roll < recipe.baseSuccessChance;
  const oldLevel = smithingSkill.level;

  // Ore is consumed on attempt regardless of success — you fed the forge,
  // a failed strike still burns the metal. This mirrors Smithing's risk.
  if (!success) {
    return {
      success: false,
      xpGained: 0,
      ingotsGained: 0,
      oreSpent: recipe.oreCost,
      fuelByproduct: 0,
      newLevel: oldLevel,
      leveledUp: false,
    };
  }

  const newXp = smithingSkill.xp + recipe.baseXp;
  const newLevel = levelForXp(newXp);

  return {
    success: true,
    xpGained: recipe.baseXp,
    ingotsGained: recipe.ingotYield,
    oreSpent: recipe.oreCost,
    fuelByproduct: FUEL_BYPRODUCT_PER_SUCCESS,
    newLevel,
    leveledUp: newLevel > oldLevel,
  };
}

export function applySmithResult(
  inventory: ResourceBag,
  result: SmithAttemptResult
): ResourceBag {
  return {
    ...inventory,
    ore: inventory.ore - result.oreSpent,
    ingot: inventory.ingot + result.ingotsGained,
    fuel: inventory.fuel + result.fuelByproduct,
  };
}

// ---------------------------------------------------------------------------
// Forge upgrades - spent in Insight, this is the World-persistent payoff
// ---------------------------------------------------------------------------

export interface ForgeUpgrade {
  tier: number;
  insightCost: number;
  name: string;
}

export const FORGE_UPGRADES: ForgeUpgrade[] = [
  { tier: 1, insightCost: 50, name: "Banked Coals" },
  { tier: 2, insightCost: 250, name: "Bellows of the Deep" },
  { tier: 3, insightCost: 1000, name: "Heartfire-Tempered Anvil" },
];

export function nextForgeUpgrade(currentTier: number): ForgeUpgrade | null {
  return FORGE_UPGRADES.find((u) => u.tier === currentTier + 1) ?? null;
}

export function canAffordForgeUpgrade(insightBanked: number, currentTier: number): boolean {
  const next = nextForgeUpgrade(currentTier);
  if (!next) return false;
  return insightBanked >= next.insightCost;
}
