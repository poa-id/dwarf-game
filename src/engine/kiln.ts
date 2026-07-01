import type { SkillState, ResourceBag } from "./types";
import { getMaterialAmount, deductMaterials, canAffordMaterials, addMaterial } from "./types";
import { levelForXp } from "./xpCurve";
import { applyHearthYieldBonus } from "./yieldCurve";

/**
 * The Charcoal Kiln - a standing structure in the Hearth Hall (see
 * hubMap.ts KILN_POSITION) that converts wood into charcoal. Unlike
 * the Forge, the kiln is never "broken" - it has no WorldState tier or
 * repair gate, it's just always usable from the start, the same way
 * mining and woodcraft are. This exists specifically to unblock the
 * vertical slice: copper_ingot needs a fuel, coal_seam has no Hub
 * placement yet (see OPEN_QUESTIONS.md), so charcoal is the only fuel
 * a starting dwarf can actually reach. Deliberately a conversion
 * action shaped like attemptSmith (consume X, produce Y, governed by
 * a skill, real success-chance risk) rather than a gathering node -
 * there's no depletable resource here, just wood you already hold.
 */
export const CHARCOAL_RECIPE = {
  id: "charcoal_burn",
  name: "Burn Charcoal",
  requiredLevel: 1,
  woodCost: 4,
  charcoalYield: 1,
  baseXp: 8, // in line with copper_vein's baseXp (8) - same tier of starter content
  baseSuccessChance: 0.85, // matches copper_ingot's smithing risk - consistent feel across the two starter conversions
} as const;

export interface KilnAttemptResult {
  success: boolean;
  xpGained: number;
  woodSpent: number;
  charcoalGained: number;
  newLevel: number;
  leveledUp: boolean;
}

export function canAffordCharcoalBurn(inventory: ResourceBag): boolean {
  return canAffordMaterials(inventory, { wood: CHARCOAL_RECIPE.woodCost });
}

/**
 * Attempt one charcoal-burning pass. Pure function, caller supplies
 * `roll` for determinism in tests - same contract as attemptSmith.
 * Throws if level or wood quantity requirements aren't met; caller
 * (UI layer) is responsible for not offering the action otherwise.
 */
export function attemptCharcoalBurn(
  hearthkeepingSkill: SkillState,
  inventory: ResourceBag,
  roll: number,
  hearthYieldBonus: number = 0
): KilnAttemptResult {
  if (hearthkeepingSkill.level < CHARCOAL_RECIPE.requiredLevel) {
    throw new Error(
      `Hearthkeeping level ${hearthkeepingSkill.level} is below required ${CHARCOAL_RECIPE.requiredLevel} for ${CHARCOAL_RECIPE.id}`
    );
  }

  const woodHeld = getMaterialAmount(inventory, "wood");
  if (woodHeld < CHARCOAL_RECIPE.woodCost) {
    throw new Error(`Not enough wood: have ${woodHeld}, need ${CHARCOAL_RECIPE.woodCost}`);
  }

  const success = roll < CHARCOAL_RECIPE.baseSuccessChance;
  const oldLevel = hearthkeepingSkill.level;

  // Wood is consumed on attempt regardless of success - a smothered
  // or over-burnt batch still used up the wood that went into it.
  // Mirrors attemptSmith's "ore+fuel burn even on a miss" precedent.
  if (!success) {
    return {
      success: false,
      xpGained: 0,
      woodSpent: CHARCOAL_RECIPE.woodCost,
      charcoalGained: 0,
      newLevel: oldLevel,
      leveledUp: false,
    };
  }

  const newXp = hearthkeepingSkill.xp + CHARCOAL_RECIPE.baseXp;
  const newLevel = levelForXp(newXp);

  return {
    success: true,
    xpGained: CHARCOAL_RECIPE.baseXp,
    woodSpent: CHARCOAL_RECIPE.woodCost,
    // Hearth's global yield perk (added 2026-06-23), same "applied
    // everywhere uniformly" + "no visible effect at low tiers since
    // charcoalYield is flat 1" caveat as smithing.ts's ingotsGained -
    // see yieldCurve.ts.
    charcoalGained: applyHearthYieldBonus(CHARCOAL_RECIPE.charcoalYield, hearthYieldBonus),
    newLevel,
    leveledUp: newLevel > oldLevel,
  };
}

export function applyCharcoalBurnResult(
  inventory: ResourceBag,
  result: KilnAttemptResult
): ResourceBag {
  let updated = deductMaterials(inventory, { wood: result.woodSpent });
  if (result.success && result.charcoalGained > 0) {
    updated = addMaterial(updated, "charcoal", result.charcoalGained);
  }
  return updated;
}

// ---------------------------------------------------------------------------
// Hearthsap recipe — stoneshroom → hearthsap
// ---------------------------------------------------------------------------

/**
 * Hearthsap rendering — stoneshrooms from the Garden are rendered in
 * the Kiln into Hearthsap, the only fuel hot enough to smelt Deepstone.
 * Slow, expensive in mushrooms, but the output is scarce by design.
 */
export const HEARTHSAP_RECIPE = {
  id: "hearthsap_render",
  name: "Render Hearthsap",
  requiredLevel: 8,          // needs real Hearthkeeping investment
  shroomCost: 6,             // 6 stoneshrooms → 1 hearthsap
  hearthsapYield: 1,
  baseXp: 25,
  baseSuccessChance: 0.75,
} as const;

export interface HearthsapAttemptResult {
  success: boolean;
  xpGained: number;
  shroomsSpent: number;
  hearthsapGained: number;
  newLevel: number;
  leveledUp: boolean;
}

export function canAffordHearthsapRender(inventory: ResourceBag): boolean {
  return canAffordMaterials(inventory, { stoneshroom: HEARTHSAP_RECIPE.shroomCost });
}

export function attemptHearthsapRender(
  hearthkeepingSkill: SkillState,
  inventory: ResourceBag,
  roll: number,
  hearthYieldBonus: number = 0
): HearthsapAttemptResult {
  if (hearthkeepingSkill.level < HEARTHSAP_RECIPE.requiredLevel) {
    throw new Error(`Hearthkeeping level ${HEARTHSAP_RECIPE.requiredLevel} required`);
  }
  const shroomHeld = getMaterialAmount(inventory, "stoneshroom");
  if (shroomHeld < HEARTHSAP_RECIPE.shroomCost) {
    throw new Error(`Need ${HEARTHSAP_RECIPE.shroomCost} stoneshroom, have ${shroomHeld}`);
  }
  const success = roll < HEARTHSAP_RECIPE.baseSuccessChance;
  const oldLevel = hearthkeepingSkill.level;
  const newXp = hearthkeepingSkill.xp + HEARTHSAP_RECIPE.baseXp;
  const newLevel = levelForXp(newXp);

  return {
    success,
    xpGained: HEARTHSAP_RECIPE.baseXp,
    shroomsSpent: HEARTHSAP_RECIPE.shroomCost,
    hearthsapGained: success ? applyHearthYieldBonus(HEARTHSAP_RECIPE.hearthsapYield, hearthYieldBonus) : 0,
    newLevel,
    leveledUp: newLevel > oldLevel,
  };
}

export function applyHearthsapResult(inventory: ResourceBag, result: HearthsapAttemptResult): ResourceBag {
  let updated = deductMaterials(inventory, { stoneshroom: result.shroomsSpent });
  if (result.success && result.hearthsapGained > 0) {
    updated = addMaterial(updated, "hearthsap", result.hearthsapGained);
  }
  return updated;
}
