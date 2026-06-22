import type { SkillState, ResourceBag, MaterialId } from "./types";
import { getMaterialAmount, deductMaterials, canAffordMaterials, addMaterial, materialDef } from "./types";
import { levelForXp } from "./xpCurve";

export interface SmithRecipe {
  id: string;
  name: string;
  requiredLevel: number;
  /** Which ore this recipe consumes, and how much. */
  oreMaterialId: MaterialId;
  oreCost: number;
  /**
   * Which fuels this recipe will accept, in preference order - the
   * first one the player actually holds enough of (and that clears
   * minHeatRequired) is the one consumed. Most recipes list exactly
   * one (coal); copper_ingot also accepts charcoal as an early-game
   * bootstrap (see types.ts MATERIALS comment on charcoal) since the
   * real coal_seam node has no placement on the Hub map yet.
   */
  acceptedFuels: MaterialId[];
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
    acceptedFuels: ["coal", "charcoal"],
    fuelCost: 1,
    minHeatRequired: 5, // coal's heatValue is 10, charcoal's is 7 - both comfortably clear the easiest recipe
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
    acceptedFuels: ["coal"],
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
 * Picks which of a recipe's acceptedFuels to actually use, given what
 * the player is holding right now. Preference order follows the
 * recipe's array order (coal listed before charcoal where both apply -
 * see copper_ingot) but only fuels with ENOUGH quantity held are
 * considered at all; falls back to the first accepted fuel (even if
 * unaffordable) so attemptSmith still has something concrete to name
 * in its "not enough X" error. Pure lookup, no mutation.
 */
export function chooseFuelForRecipe(recipe: SmithRecipe, inventory: ResourceBag): MaterialId {
  const affordable = recipe.acceptedFuels.find(
    (fuelId) => getMaterialAmount(inventory, fuelId) >= recipe.fuelCost
  );
  return affordable ?? recipe.acceptedFuels[0];
}

/**
 * Attempt to smith one item. Pure function, caller supplies `roll` for
 * determinism in tests, and `chosenFuel` for which of the recipe's
 * acceptedFuels to actually burn (use chooseFuelForRecipe to pick one
 * automatically, or pass a specific MaterialId directly). Throws if
 * level, ore, fuel quantity, fuel heat, OR an unaccepted fuel is
 * passed — the caller (UI layer) is responsible for not offering
 * unavailable recipes in the first place, this is a defensive
 * invariant, not UX.
 */
export function attemptSmith(
  recipe: SmithRecipe,
  smithingSkill: SkillState,
  inventory: ResourceBag,
  roll: number,
  chosenFuel: MaterialId = recipe.acceptedFuels[0]
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

  if (!recipe.acceptedFuels.includes(chosenFuel)) {
    throw new Error(`${chosenFuel} is not an accepted fuel for ${recipe.id}`);
  }

  const fuelHeld = getMaterialAmount(inventory, chosenFuel);
  if (fuelHeld < recipe.fuelCost) {
    throw new Error(`Not enough ${chosenFuel}: have ${fuelHeld}, need ${recipe.fuelCost}`);
  }

  const fuelHeat = materialDef(chosenFuel).heatValue ?? 0;
  if (fuelHeat < recipe.minHeatRequired) {
    throw new Error(
      `${chosenFuel} (heat ${fuelHeat}) does not burn hot enough for ${recipe.id} (needs ${recipe.minHeatRequired})`
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
      fuelMaterialId: chosenFuel,
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
    fuelMaterialId: chosenFuel,
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
// Forge repair - tier 0 -> 1 specifically. The forge starts broken, not
// merely "not yet upgraded" - this is a one-time REPAIR paid in raw
// materials (wood + ore), not Insight. Insight-funded upgrades (see
// FORGE_UPGRADES below) only make sense once the forge already works;
// repairing it from nothing is a different kind of act - hands-on
// reconstruction, not a purchased improvement.
// ---------------------------------------------------------------------------

export const FORGE_REPAIR_COST: ResourceBag = {
  wood: 15,
  copper_ore: 10,
};

export function canAffordForgeRepair(inventory: ResourceBag): boolean {
  return canAffordMaterials(inventory, FORGE_REPAIR_COST);
}

export function applyForgeRepair(inventory: ResourceBag): ResourceBag {
  return deductMaterials(inventory, FORGE_REPAIR_COST);
}

// ---------------------------------------------------------------------------
// Forge upgrades - tiers BEYOND the initial repair (1->2, 2->3, ...),
// spent in Insight. This is the World-persistent payoff once the forge
// already works at all.
// ---------------------------------------------------------------------------

export interface ForgeUpgrade {
  tier: number;
  insightCost: number;
  name: string;
}

export const FORGE_UPGRADES: ForgeUpgrade[] = [
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
