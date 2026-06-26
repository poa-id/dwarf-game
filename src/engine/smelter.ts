import type { SkillState, ResourceBag, MaterialId } from "./types";
import { getMaterialAmount, deductMaterials, canAffordMaterials, addMaterial } from "./types";
import { levelForXp } from "./xpCurve";

/**
 * The Smelter - a Forge Room addon (added 2026-06-23), built once for
 * Insight + materials like a Hearth/Forge upgrade. Answers two things
 * at once, per design discussion: (1) the "pile of unused ingots after
 * making one pickaxe + repairing torches" problem - tools are forged
 * exactly once per tier, ever, so they can't be a repeatable sink; (2)
 * the lack of any repeatable, XP-efficient Smithing action beyond raw
 * ingot-spam. Purifying an ingot at the Smelter ALWAYS succeeds at
 * consuming it and granting Smithing XP (no separate success-chance
 * roll, unlike most other actions in this game) - the only randomness
 * is whether that purification ALSO yields a rare True-metal on top.
 * Deliberately a single roll, not a stacked success-chance-then-
 * drop-chance pair, to keep "did I get anything extra" the only
 * question, rather than also risking the baseline XP/consumption.
 *
 * Iron-free by design: the build cost uses only copper_ingot/
 * copper_ore/wood, all reachable before the Tunnel Entrance (and
 * therefore iron) unlocks - using iron here would create a circular
 * dependency, since the Smelter's own appeal partly depends on having
 * SOMETHING to purify, and iron access itself requires forgeTier 2.
 */
export const SMELTER_BUILD_COST: ResourceBag = {
  copper_ingot: 20,
  copper_ore: 15,
  wood: 30,
};
export const SMELTER_BUILD_INSIGHT_COST = 1200; // the new ceiling - above Heartfire-Tempered Anvil's 1000, the new top investment in the game

export function canAffordSmelterBuild(inventory: ResourceBag, insightBanked: number): boolean {
  return insightBanked >= SMELTER_BUILD_INSIGHT_COST && canAffordMaterials(inventory, SMELTER_BUILD_COST);
}

export function applySmelterBuild(
  inventory: ResourceBag,
  insightBanked: number
): { inventory: ResourceBag; insightBanked: number } {
  return {
    inventory: deductMaterials(inventory, SMELTER_BUILD_COST),
    insightBanked: insightBanked - SMELTER_BUILD_INSIGHT_COST,
  };
}

/**
 * Smelter upgrade tiers - Insight-funded, World-persistent, mirroring
 * FORGE_UPGRADES/HEARTH_UPGRADES' shape exactly. Each tier raises the
 * True-metal drop chance. Deliberately a SEPARATE upgrade track from
 * the Forge's own tiers (Bellows, Anvil) - project owner's explicit
 * call: this needed to be its own progression, not another bonus
 * bolted onto Forge tier. The curve (0.05/0.2/0.5/1%) was an explicit
 * correction from an initial proposal of 3/8/15/25%, which was judged
 * far too generous for a rare, permanent-account-wide-upgrade currency
 * - True-metals are meant to stay genuinely rare even at max tier.
 */
export interface SmelterTier {
  tier: number;
  insightCost: number;
  trueMetalChance: number; // 0-1
  name: string;
}

export const SMELTER_TIERS: SmelterTier[] = [
  { tier: 1, insightCost: 300, trueMetalChance: 0.002, name: "Truer Flame" },
  { tier: 2, insightCost: 700, trueMetalChance: 0.005, name: "Patient Crucible" },
  { tier: 3, insightCost: 1500, trueMetalChance: 0.01, name: "Mountain's Own Heat" },
];

/** Tier 0 (base, just-built, unupgraded) is implicit - 0.05% (0.0005), not in SMELTER_TIERS since there's no purchase for it; see purifyTrueMetalChance. */
const SMELTER_BASE_TRUE_METAL_CHANCE = 0.0005;

export function purifyTrueMetalChance(smelterTier: number): number {
  if (smelterTier === 0) return SMELTER_BASE_TRUE_METAL_CHANCE;
  const tier = SMELTER_TIERS.find((t) => t.tier === smelterTier);
  return tier?.trueMetalChance ?? SMELTER_BASE_TRUE_METAL_CHANCE;
}

export function nextSmelterTier(currentTier: number): SmelterTier | null {
  return SMELTER_TIERS.find((t) => t.tier === currentTier + 1) ?? null;
}

export function canAffordSmelterTier(insightBanked: number, currentTier: number): boolean {
  const next = nextSmelterTier(currentTier);
  return next !== null && insightBanked >= next.insightCost;
}

/**
 * Maps an ingot to its True-metal output. Only copper_ingot is real
 * content right now (true_copper) - iron_ingot deliberately has no
 * entry yet, matching the rest of this file's iron-deferred design.
 * Extend this map (and add the corresponding MaterialDefinition in
 * types.ts) once iron itself is real, reachable content.
 */
const TRUE_METAL_BY_INGOT: Record<string, MaterialId> = {
  copper_ingot: "true_copper",
};

export const PURIFY_INGOT_COST = 5; // ingots consumed per purification attempt
export const PURIFY_BASE_XP = 12; // a bit above copper_ingot's smelting baseXp (10) - this is meant to be Smithing's best repeatable XP/effort ratio, per explicit design intent

export interface PurifyResult {
  ingotMaterialId: MaterialId;
  ingotsSpent: number;
  xpGained: number;
  trueMetalGained: MaterialId | null; // null on the (overwhelmingly common) non-drop outcome
  newLevel: number;
  leveledUp: boolean;
}

/**
 * Attempt one purification pass. ALWAYS consumes the ingot cost and
 * grants XP (no separate success-chance roll - see this file's
 * top-level docstring for why). `roll` decides only whether a
 * True-metal also drops, weighted by purifyTrueMetalChance(smelterTier).
 * Pure function, caller supplies `roll` for determinism in tests, same
 * contract as every other attempt* function in this engine.
 */
export function attemptPurify(
  ingotMaterialId: MaterialId,
  smithingSkill: SkillState,
  inventory: ResourceBag,
  smelterTier: number,
  roll: number
): PurifyResult {
  const trueMetalId = TRUE_METAL_BY_INGOT[ingotMaterialId];
  if (!trueMetalId) {
    throw new Error(`${ingotMaterialId} has no True-metal counterpart yet`);
  }

  const held = getMaterialAmount(inventory, ingotMaterialId);
  if (held < PURIFY_INGOT_COST) {
    throw new Error(`Not enough ${ingotMaterialId} to purify: have ${held}, need ${PURIFY_INGOT_COST}`);
  }

  const dropChance = purifyTrueMetalChance(smelterTier);
  const trueMetalGained = roll < dropChance ? trueMetalId : null;

  const oldLevel = smithingSkill.level;
  const newXp = smithingSkill.xp + PURIFY_BASE_XP;
  const newLevel = levelForXp(newXp);

  return {
    ingotMaterialId,
    ingotsSpent: PURIFY_INGOT_COST,
    xpGained: PURIFY_BASE_XP,
    trueMetalGained,
    newLevel,
    leveledUp: newLevel > oldLevel,
  };
}

export function applyPurifyResult(inventory: ResourceBag, result: PurifyResult): ResourceBag {
  let updated = deductMaterials(inventory, { [result.ingotMaterialId]: result.ingotsSpent });
  if (result.trueMetalGained) {
    updated = addMaterial(updated, result.trueMetalGained, 1);
  }
  return updated;
}

/**
 * The Mountain's permanent global XP perk tree - the first real thing
 * True-metals buy (per explicit design discussion: "the upgrade tree,
 * the first one should be a permanent exp boost"). Cumulative-spend
 * thresholds, not a one-time tiered purchase like Forge/Hearth
 * upgrades - WorldState.trueMetalSpentOnXpPerk tracks TOTAL True-metals
 * (any type) ever spent here, and the active tier is whichever
 * threshold that total has crossed. Stacks ADDITIVELY with the
 * dwarfCount multiplier (xpCurve.ts's applyDwarfCountXpMultiplier) -
 * both feed into ONE combined multiplier, capped at the same ceiling
 * (3x) the dwarfCount system already uses, so spending True-metals
 * can't blow past "mastery should stay rare and earned even late."
 */
export interface XpPerkTier {
  tier: number;
  cumulativeTrueMetalCost: number; // TOTAL true-metals spent to reach this tier, not incremental
  xpBonus: number; // additive bonus, e.g. 0.05 = +5%
}

export const XP_PERK_TIERS: XpPerkTier[] = [
  { tier: 1, cumulativeTrueMetalCost: 1, xpBonus: 0.05 },
  { tier: 2, cumulativeTrueMetalCost: 3, xpBonus: 0.1 },
  { tier: 3, cumulativeTrueMetalCost: 6, xpBonus: 0.15 },
];

/** Which perk tier is active given total True-metal spend so far - the highest threshold crossed, or null if none yet. */
export function activeXpPerkTier(trueMetalSpent: number): XpPerkTier | null {
  let active: XpPerkTier | null = null;
  for (const tier of XP_PERK_TIERS) {
    if (trueMetalSpent >= tier.cumulativeTrueMetalCost) active = tier;
  }
  return active;
}

/** The additive XP bonus from the active perk tier, 0 if none purchased yet - what xpCurve.ts's multiplier formula adds to the dwarfCount term. */
export function xpPerkBonus(trueMetalSpent: number): number {
  return activeXpPerkTier(trueMetalSpent)?.xpBonus ?? 0;
}

/** The next perk tier purchasable, or null if already at the highest defined tier. */
export function nextXpPerkTier(trueMetalSpent: number): XpPerkTier | null {
  const current = activeXpPerkTier(trueMetalSpent);
  const currentTierNum = current?.tier ?? 0;
  return XP_PERK_TIERS.find((t) => t.tier === currentTierNum + 1) ?? null;
}

/**
 * How many MORE True-metals (any type) are needed, beyond what's
 * already been spent, to reach the next perk tier. Spending is
 * tracked as a running total (trueMetalSpentOnXpPerk), not a
 * per-purchase deduction from held inventory in one go - the player
 * can spend whatever True-metals they're currently holding, and it
 * simply adds to the lifetime total, which is what the tier
 * thresholds check against.
 */
export function trueMetalNeededForNextPerkTier(trueMetalSpent: number): number | null {
  const next = nextXpPerkTier(trueMetalSpent);
  if (!next) return null;
  return Math.max(0, next.cumulativeTrueMetalCost - trueMetalSpent);
}
