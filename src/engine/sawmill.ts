import type { SkillState, ResourceBag } from "./types";
import { getMaterialAmount, deductMaterials, canAffordMaterials, addMaterial } from "./types";
import { levelForXp } from "./xpCurve";
import { applyHearthYieldBonus } from "./yieldCurve";

/**
 * The Sawmill - a Garden Room addon (added 2026-07-03, see hubMap.ts
 * SAWMILL_POSITION) that converts raw wood into wood_planks. Woodcraft-
 * governed, not Hearthkeeping - woodcraft.ts's own doc comment already
 * anticipated this: "Woodcraft covers BOTH cutting raw wood and
 * processing it into planks/lumber... growing/planting trees is
 * explicitly deferred." This is that processing half, finally built.
 *
 * Unlike the Kiln (which is free/always-usable by design, to unblock
 * the earliest possible fuel loop), the Sawmill requires building -
 * it's not solving an early-game deadlock the way the Kiln was, so it
 * follows the Smelter's pattern instead: a one-time Insight + materials
 * cost gates whether the station/action exists at all. Iron-free
 * build cost by the same reasoning the Smelter used ("iron-free by
 * design" comment in smelter.ts) - copper_ingot only, so this stays
 * reachable on an early-game supply chain.
 *
 * wood_planks has no consumers yet as of this commit - same "new
 * resource, sink comes later" pattern already normalized in this
 * codebase (charcoal before smelting used it, ironwood/gemwood before
 * their tool recipes existed). Flagged in OPEN_QUESTIONS.md, not a
 * blocker to building the station itself.
 */
export const SAWMILL_BUILD_COST: ResourceBag = {
  wood: 30,
  copper_ingot: 10,
};
export const SAWMILL_BUILD_INSIGHT_COST = 300;

export function canAffordSawmillBuild(inventory: ResourceBag, insightBanked: number): boolean {
  return insightBanked >= SAWMILL_BUILD_INSIGHT_COST && canAffordMaterials(inventory, SAWMILL_BUILD_COST);
}

export function applySawmillBuild(
  inventory: ResourceBag,
  insightBanked: number
): { inventory: ResourceBag; insightBanked: number } {
  return {
    inventory: deductMaterials(inventory, SAWMILL_BUILD_COST),
    insightBanked: insightBanked - SAWMILL_BUILD_INSIGHT_COST,
  };
}

export const PLANK_RECIPE = {
  id: "saw_planks",
  name: "Saw Planks",
  requiredLevel: 1, // available immediately once built - the FIRST Woodcraft crafting action, not gated further
  woodCost: 4,
  plankYield: 1,
  baseXp: 10, // a notch above charcoal_burn's 8 - this is a built station's output, not a free starter action
  baseSuccessChance: 0.85, // matches charcoal_burn/copper_ingot - the "safe early conversion" baseline across the game
} as const;

export interface SawmillAttemptResult {
  success: boolean;
  xpGained: number;
  woodSpent: number;
  /** How much of woodSpent came from the Sawmill's own buffer (spent first) vs carried wood - caller needs this to update WorldState.sawmillWoodBuffer separately from inventory. */
  woodSpentFromBuffer: number;
  woodSpentFromInventory: number;
  planksGained: number;
  newLevel: number;
  leveledUp: boolean;
}

/**
 * 2026-07-06: the Sawmill now has its own local wood buffer, filled by
 * the harvest companion hauling from Wood Harvesters (see
 * WorldState.sawmillWoodBuffer) - checking/spending wood now considers
 * BOTH that buffer and carried wood together, preferring the buffer
 * first since it's the "already delivered, no carrying needed" pool.
 * Sawing itself STAYS a manual action for now ("player triggers
 * sawing until an upgrade is made like in the smelting engines" -
 * that automation upgrade doesn't exist yet).
 */
export function canAffordPlankSaw(inventory: ResourceBag, sawmillWoodBuffer: number = 0): boolean {
  const totalWood = getMaterialAmount(inventory, "wood") + sawmillWoodBuffer;
  return totalWood >= PLANK_RECIPE.woodCost;
}

/**
 * Attempt one plank-sawing pass. Pure function, caller supplies `roll`
 * for determinism in tests - same contract as attemptCharcoalBurn.
 * Throws if level or wood quantity requirements aren't met; caller (UI
 * layer) is responsible for not offering the action otherwise, and for
 * checking the sawmill has actually been built first (this function
 * doesn't know about WorldState.sawmillBuilt at all, same separation
 * kiln.ts/smelter.ts already keep between engine and world-gating).
 */
export function attemptSawPlanks(
  woodcraftSkill: SkillState,
  inventory: ResourceBag,
  roll: number,
  hearthYieldBonus: number = 0,
  sawmillWoodBuffer: number = 0
): SawmillAttemptResult {
  if (woodcraftSkill.level < PLANK_RECIPE.requiredLevel) {
    throw new Error(
      `Woodcraft level ${woodcraftSkill.level} is below required ${PLANK_RECIPE.requiredLevel} for ${PLANK_RECIPE.id}`
    );
  }

  const woodHeld = getMaterialAmount(inventory, "wood") + sawmillWoodBuffer;
  if (woodHeld < PLANK_RECIPE.woodCost) {
    throw new Error(`Not enough wood: have ${woodHeld}, need ${PLANK_RECIPE.woodCost}`);
  }

  const success = roll < PLANK_RECIPE.baseSuccessChance;
  const oldLevel = woodcraftSkill.level;

  // Spend from the Sawmill's own buffer first (already delivered, no
  // carrying needed), falling back to carried wood for the remainder.
  const fromBuffer = Math.min(sawmillWoodBuffer, PLANK_RECIPE.woodCost);
  const fromInventory = PLANK_RECIPE.woodCost - fromBuffer;

  // Wood is consumed on attempt regardless of success - mirrors
  // attemptCharcoalBurn/attemptSmith's "materials burn even on a miss" precedent.
  if (!success) {
    return {
      success: false,
      xpGained: 0,
      woodSpent: PLANK_RECIPE.woodCost,
      woodSpentFromBuffer: fromBuffer,
      woodSpentFromInventory: fromInventory,
      planksGained: 0,
      newLevel: oldLevel,
      leveledUp: false,
    };
  }

  const newXp = woodcraftSkill.xp + PLANK_RECIPE.baseXp;
  const newLevel = levelForXp(newXp);

  return {
    success: true,
    xpGained: PLANK_RECIPE.baseXp,
    woodSpent: PLANK_RECIPE.woodCost,
    woodSpentFromBuffer: fromBuffer,
    woodSpentFromInventory: fromInventory,
    planksGained: applyHearthYieldBonus(PLANK_RECIPE.plankYield, hearthYieldBonus),
    newLevel,
    leveledUp: newLevel > oldLevel,
  };
}

/**
 * Deducts only the INVENTORY portion of the wood spent - the buffer
 * portion (result.woodSpentFromBuffer) is a WorldState field, not
 * inventory, so the caller updates WorldState.sawmillWoodBuffer
 * separately (see performSawPlanks in sawmillPanel.ts).
 */
export function applySawPlanksResult(
  inventory: ResourceBag,
  result: SawmillAttemptResult
): ResourceBag {
  let updated = deductMaterials(inventory, { wood: result.woodSpentFromInventory });
  if (result.success && result.planksGained > 0) {
    updated = addMaterial(updated, "wood_planks", result.planksGained);
  }
  return updated;
}
