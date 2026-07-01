import type { SkillState, ResourceBag, MaterialId, ToolSlot, ToolsForgedState } from "./types";
import { getMaterialAmount, deductMaterials, canAffordMaterials, addMaterial, materialDef } from "./types";
import { levelForXp } from "./xpCurve";
import { applyHearthYieldBonus } from "./yieldCurve";

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
    // Lowered from 10 -> 6 (2026-06-23, explicit project direction):
    // reaching level 10 from scratch needed ~1727 copper_ingot smelts
    // (cumulativeXpForLevel(10) / baseXp 10) - genuinely daunting for a
    // first playthrough, independent of the separate dwarfCount XP
    // multiplier (which only helps AFTER several rekindles, not the
    // very first climb). Level 6 needs ~315 smelts instead - still a
    // real grind, but roughly a fifth of the original. See
    // OPEN_QUESTIONS.md for the full numbers.
    requiredLevel: 6,
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
  {
    id: "deepstone_ingot",
    name: "Deepstone Ingot",
    requiredLevel: 18,
    oreMaterialId: "deepstone_ore",
    oreCost: 4,
    acceptedFuels: ["hearthsap"],
    fuelCost: 1,
    minHeatRequired: 18,
    baseXp: 60,
    ingotMaterialId: "deepstone_ingot",
    ingotYield: 1,
    baseSuccessChance: 0.55,
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
 *
 * Takes only the two fields it actually needs (not the full
 * SmithRecipe) so ToolRecipe - which shares the same fuel-acceptance
 * shape but isn't a SmithRecipe - can reuse this directly, no casting.
 */
export function chooseFuelForRecipe(
  recipe: { acceptedFuels: MaterialId[]; fuelCost: number },
  inventory: ResourceBag
): MaterialId {
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
  chosenFuel: MaterialId = recipe.acceptedFuels[0],
  hearthYieldBonus: number = 0
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
    // Hearth's global yield perk (added 2026-06-23) applied on top of
    // the recipe's own ingotYield - per explicit direction this is
    // "applied everywhere uniformly," but worth noting: every current
    // SMITH_RECIPES entry has ingotYield exactly 1, so at low perk
    // tiers Math.round(1 * 1.05) etc. rounds right back down to 1 -
    // the bonus has NO visible effect here until either yields
    // increase elsewhere or a future bulk-action multiplier lets
    // multiple attempts compound. Not a bug; see yieldCurve.ts.
    ingotsGained: applyHearthYieldBonus(recipe.ingotYield, hearthYieldBonus),
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
// Tools - "metal + wood = tool", smithed at the Forge like ingots, but
// producing a World-persistent tool tier (see ToolSlot/ToolsForgedState
// in types.ts) instead of a stackable inventory material. Replaces an
// earlier design where pickaxe/axe quality was a free, automatic
// side-effect of Forge upgrade tier with no crafting step - see
// gathering.ts's ToolTier/bestAvailableTool, still used as the actual
// success/yield bonus lookup, just no longer auto-granted.
//
// Deliberately a SEPARATE recipe type from SmithRecipe rather than
// overloading it: tools need wood AND ingot together (SmithRecipe only
// models one input material), and produce a tier bump rather than a
// stackable MaterialId - different enough in shape that forcing it
// through SmithRecipe's fields would be more confusing than a sibling
// type with its own (smaller) attempt/apply pair below.
// ---------------------------------------------------------------------------

export interface ToolRecipe {
  id: string;
  name: string;
  slot: ToolSlot;
  /** The tier this recipe produces - must be exactly currentTier+1 for the given slot; see canAffordToolRecipe. */
  tier: number;
  requiredLevel: number;
  ingotMaterialId: MaterialId;
  ingotCost: number;
  woodCost: number;
  /** Optional: alternative wood material (e.g. "ironwood" for tier 3 tools). If set, woodCost should be 0 and woodAltCost used instead. */
  woodAltId?: MaterialId;
  woodAltCost?: number;
  acceptedFuels: MaterialId[];
  fuelCost: number;
  minHeatRequired: number;
  baseXp: number;
  /** 0-1 - shaping a tool head is a finer task than pouring an ingot; tool recipes generally risk more than their ingot-tier equivalent. */
  baseSuccessChance: number;
}

export const TOOL_RECIPES: ToolRecipe[] = [
  {
    id: "copper_pickaxe",
    name: "Copper Pickaxe",
    slot: "pickaxe",
    tier: 1,
    requiredLevel: 1,
    ingotMaterialId: "copper_ingot",
    ingotCost: 2,
    woodCost: 3,
    acceptedFuels: ["coal", "charcoal"],
    fuelCost: 1,
    minHeatRequired: 5,
    baseXp: 15,
    baseSuccessChance: 0.75,
  },
  {
    id: "iron_pickaxe",
    name: "Iron Pickaxe",
    slot: "pickaxe",
    tier: 2,
    requiredLevel: 6, // lowered from 10, see iron_ingot's comment above for the full rationale
    ingotMaterialId: "iron_ingot",
    ingotCost: 3,
    woodCost: 4,
    acceptedFuels: ["coal"],
    fuelCost: 2,
    minHeatRequired: 10,
    baseXp: 30,
    baseSuccessChance: 0.6,
  },
  {
    id: "copper_axe",
    name: "Copper Axe",
    slot: "axe",
    tier: 1,
    requiredLevel: 1,
    ingotMaterialId: "copper_ingot",
    ingotCost: 2,
    woodCost: 3,
    acceptedFuels: ["coal", "charcoal"],
    fuelCost: 1,
    minHeatRequired: 5,
    baseXp: 15,
    baseSuccessChance: 0.75,
  },
  {
    id: "iron_axe",
    name: "Iron Axe",
    slot: "axe",
    tier: 2,
    requiredLevel: 6, // lowered from 10, see iron_ingot's comment above for the full rationale
    ingotMaterialId: "iron_ingot",
    ingotCost: 3,
    woodCost: 4,
    acceptedFuels: ["coal"],
    fuelCost: 2,
    minHeatRequired: 10,
    baseXp: 30,
    baseSuccessChance: 0.6,
  },
  // Deepstone Pickaxe — tier 3. Requires deepstone_ingot (Smithing 18)
  // and ironwood (from the Garden's ancient seed chest). The supply
  // chain: mine deepstone → grow ironwood → forge here. High success
  // chance because by this point the player is skilled; the cost IS
  // the gate, not the failure chance.
  {
    id: "deepstone_pickaxe",
    name: "Deepstone Pickaxe",
    slot: "pickaxe",
    tier: 3,
    requiredLevel: 14,
    ingotMaterialId: "deepstone_ingot",
    ingotCost: 4,
    woodCost: 0,       // ironwood replaces regular wood — see woodAltId
    woodAltId: "ironwood",
    woodAltCost: 3,
    acceptedFuels: ["hearthsap"],
    fuelCost: 1,
    minHeatRequired: 18,
    baseXp: 80,
    baseSuccessChance: 0.65,
  },
  {
    id: "deepstone_axe",
    name: "Deepstone Axe",
    slot: "axe",
    tier: 3,
    requiredLevel: 14,
    ingotMaterialId: "deepstone_ingot",
    ingotCost: 4,
    woodCost: 0,
    woodAltId: "ironwood",
    woodAltCost: 3,
    acceptedFuels: ["hearthsap"],
    fuelCost: 1,
    minHeatRequired: 18,
    baseXp: 80,
    baseSuccessChance: 0.65,
  },
];

/** The next forgeable tier for a given slot, given what's already been forged - null if already at the highest defined tier (or beyond). */
export function nextToolRecipe(slot: ToolSlot, toolsForged: ToolsForgedState): ToolRecipe | null {
  const currentTier = toolsForged[slot];
  return TOOL_RECIPES.find((r) => r.slot === slot && r.tier === currentTier + 1) ?? null;
}

export interface ToolForgeAttemptResult {
  success: boolean;
  xpGained: number;
  slot: ToolSlot;
  tierForged: number;
  ingotMaterialId: MaterialId;
  ingotSpent: number;
  woodMaterialId: MaterialId;
  woodSpent: number;
  fuelMaterialId: MaterialId;
  fuelSpent: number;
  newLevel: number;
  leveledUp: boolean;
}

/**
 * Attempt to forge one tool. Same shape/contract as attemptSmith -
 * pure function, caller supplies `roll` and `chosenFuel`. Throws if
 * level, ingot, wood, fuel quantity, fuel heat, an unaccepted fuel, OR
 * an out-of-order tier (e.g. forging iron_pickaxe while still at tier 0)
 * is passed - same defensive-invariant pattern as the rest of the
 * engine; the caller is responsible for only offering
 * nextToolRecipe(slot, toolsForged), never an arbitrary recipe.
 */
export function attemptForgeTool(
  recipe: ToolRecipe,
  smithingSkill: SkillState,
  inventory: ResourceBag,
  toolsForged: ToolsForgedState,
  roll: number,
  chosenFuel: MaterialId = recipe.acceptedFuels[0]
): ToolForgeAttemptResult {
  if (smithingSkill.level < recipe.requiredLevel) {
    throw new Error(
      `Smithing level ${smithingSkill.level} is below required ${recipe.requiredLevel} for ${recipe.id}`
    );
  }

  if (toolsForged[recipe.slot] !== recipe.tier - 1) {
    throw new Error(
      `${recipe.id} is tier ${recipe.tier}, but ${recipe.slot} is currently at tier ${toolsForged[recipe.slot]} - tiers must be forged in order`
    );
  }

  const ingotHeld = getMaterialAmount(inventory, recipe.ingotMaterialId);
  if (ingotHeld < recipe.ingotCost) {
    throw new Error(`Not enough ${recipe.ingotMaterialId}: have ${ingotHeld}, need ${recipe.ingotCost}`);
  }

  const woodMat = recipe.woodAltId ?? "wood";
  const woodCostActual = recipe.woodAltId ? (recipe.woodAltCost ?? 0) : recipe.woodCost;
  const woodHeld = getMaterialAmount(inventory, woodMat);
  if (woodHeld < woodCostActual) {
    throw new Error(`Not enough ${woodMat}: have ${woodHeld}, need ${woodCostActual}`);
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

  // Ingot, wood, AND fuel are all consumed on attempt regardless of
  // success - same "you fed the forge, a failed shaping still burns
  // the materials" risk as attemptSmith, just with a third input.
  if (!success) {
    return {
      success: false,
      xpGained: 0,
      slot: recipe.slot,
      tierForged: toolsForged[recipe.slot], // unchanged on failure
      ingotMaterialId: recipe.ingotMaterialId,
      ingotSpent: recipe.ingotCost,
      woodMaterialId: woodMat,
      woodSpent: woodCostActual,
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
    slot: recipe.slot,
    tierForged: recipe.tier,
    ingotMaterialId: recipe.ingotMaterialId,
    ingotSpent: recipe.ingotCost,
    woodMaterialId: woodMat,
    woodSpent: woodCostActual,
    fuelMaterialId: chosenFuel,
    fuelSpent: recipe.fuelCost,
    newLevel,
    leveledUp: newLevel > oldLevel,
  };
}

export function applyForgeToolResult(
  inventory: ResourceBag,
  toolsForged: ToolsForgedState,
  result: ToolForgeAttemptResult
): { inventory: ResourceBag; toolsForged: ToolsForgedState } {
  const newInventory = deductMaterials(inventory, {
    [result.ingotMaterialId]: result.ingotSpent,
    [result.woodMaterialId]: result.woodSpent,
    [result.fuelMaterialId]: result.fuelSpent,
  });

  const newToolsForged: ToolsForgedState = result.success
    ? { ...toolsForged, [result.slot]: result.tierForged }
    : toolsForged;

  return { inventory: newInventory, toolsForged: newToolsForged };
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
