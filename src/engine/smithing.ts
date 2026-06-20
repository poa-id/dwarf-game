import type { SkillState, ResourceBag, MaterialId } from "./types";
import { getMaterialAmount, deductMaterials, addMaterial, materialDef } from "./types";
import { levelForXp } from "./xpCurve";

export interface SmithRecipe {
  id: string;
  name: string;
  requiredLevel: number;
  /** Which ore this recipe consumes, and how much. */
  oreMaterialId: MaterialId;
  oreCost: number;
  /** Which fuel this recipe consumes, and how much. */
  fuelMaterialId: MaterialId;
  fuelCost: number;
  /** Minimum heatValue the chosen fuel must have - a weak fire (low heatValue) can't smith a recipe that demands real heat, regardless of how much of it you have. */
  minHeatRequired: number;
  baseXp: number;
  /** Which ingot this recipe produces, and how much. */
  ingotMaterialId: MaterialId;
  ingotYield: number;
  /** 0-1, a timing/rhythm-style attempt can still fail to land cleanly. */
  baseSuccessChance: number;
}

export const SMITH_RECIPES: SmithRecipe[] = [
  {
    id: "copper_ingot",
    name: "Copper Ingot",
    requiredLevel: 1,
    oreMaterialId: "copper_ore",
    oreCost: 2,
    fuelMaterialId: "coal",
    fuelCost: 1,
    minHeatRequired: 5, // coal's heatValue is 10 - comfortably enough for the easiest recipe
    baseXp: 10,
    ingotMaterialId: "copper_ingot",
    ingotYield: 1,
    baseSuccessChance: 0.85,
  },
  {
    id: "iron_ingot",
    name: "Iron Ingot",
    requiredLevel: 10,
    oreMaterialId: "iron_ore",
    oreCost: 3,
    fuelMaterialId: "coal",
    fuelCost: 2,
    minHeatRequired: 10, // iron needs a proper coal fire, not a weaker future fuel substitute
    baseXp: 22,
    ingotMaterialId: "iron_ingot",
    ingotYield: 1,
    baseSuccessChance: 0.7,
  },
];

export interface SmithAttemptResult {
  success: boolean;
  xpGained: number;
  ingotMaterialId: MaterialId;
  ingotsGained: number;
  oreMaterialId: MaterialId;
  oreSpent: number;
  fuelMaterialId: MaterialId;
  fuelSpent: number;
  newLevel: number;
  leveledUp: boolean;
}

/**
 * Attempt to smith one item. Pure function, caller supplies `roll` for
 * determinism in tests. Throws if level, ore, fuel quantity, OR fuel
 * heat requirements aren't met — the caller (UI layer) is responsible
 * for not offering unavailable recipes in the first place, this is a
 * defensive invariant, not UX.
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

  const oreHeld = getMaterialAmount(inventory, recipe.oreMaterialId);
  if (oreHeld < recipe.oreCost) {
    throw new Error(`Not enough ${recipe.oreMaterialId}: have ${oreHeld}, need ${recipe.oreCost}`);
  }

  const fuelHeld = getMaterialAmount(inventory, recipe.fuelMaterialId);
  if (fuelHeld < recipe.fuelCost) {
    throw new Error(`Not enough ${recipe.fuelMaterialId}: have ${fuelHeld}, need ${recipe.fuelCost}`);
  }

  const fuelHeat = materialDef(recipe.fuelMaterialId).heatValue ?? 0;
  if (fuelHeat < recipe.minHeatRequired) {
    throw new Error(
      `${recipe.fuelMaterialId} (heat ${fuelHeat}) does not burn hot enough for ${recipe.id} (needs ${recipe.minHeatRequired})`
    );
  }

  const success = roll < recipe.baseSuccessChance;
  const oldLevel = smithingSkill.level;

  // Ore AND fuel are consumed on attempt regardless of success — you
  // fed the forge, a failed strike still burns the metal and the coal.
  // This mirrors Smithing's risk from before, just extended to fuel.
  if (!success) {
    return {
      success: false,
      xpGained: 0,
      ingotMaterialId: recipe.ingotMaterialId,
      ingotsGained: 0,
      oreMaterialId: recipe.oreMaterialId,
      oreSpent: recipe.oreCost,
      fuelMaterialId: recipe.fuelMaterialId,
      fuelSpent: recipe.fuelCost,
      newLevel: oldLevel,
      leveledUp: false,
    };
  }

  const newXp = smithingSkill.xp + recipe.baseXp;
  const newLevel = levelForXp(newXp);

  return {
    success: true,
    xpGained: recipe.baseXp,
    ingotMaterialId: recipe.ingotMaterialId,
    ingotsGained: recipe.ingotYield,
    oreMaterialId: recipe.oreMaterialId,
    oreSpent: recipe.oreCost,
    fuelMaterialId: recipe.fuelMaterialId,
    fuelSpent: recipe.fuelCost,
    newLevel,
    leveledUp: newLevel > oldLevel,
  };
}

export function applySmithResult(
  inventory: ResourceBag,
  result: SmithAttemptResult
): ResourceBag {
  let updated = deductMaterials(inventory, {
    [result.oreMaterialId]: result.oreSpent,
    [result.fuelMaterialId]: result.fuelSpent,
  });
  if (result.success && result.ingotsGained > 0) {
    updated = addMaterial(updated, result.ingotMaterialId, result.ingotsGained);
  }
  return updated;
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
