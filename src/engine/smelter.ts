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
  { tier: 1, insightCost: 300,  trueMetalChance: 0.002, name: "Truer Flame" },
  { tier: 2, insightCost: 700,  trueMetalChance: 0.005, name: "Patient Crucible" },
  { tier: 3, insightCost: 1500, trueMetalChance: 0.01,  name: "Mountain's Own Heat" },
];

/**
 * Iron smelter tiers — separate upgrade track from copper. Rarer drop
 * rates (iron True-metal is harder to refine than copper), and double
 * the Insight cost at every tier, consistent with idle-game scaling
 * where each tier tier costs more than the last. The curve scales
 * geometrically so there's always a next meaningful investment.
 */
export interface IronSmelterTier {
  tier: number;
  insightCost: number;
  trueMetalChance: number;
  name: string;
}

export const IRON_SMELTER_TIERS: IronSmelterTier[] = [
  { tier: 1, insightCost: 600,  trueMetalChance: 0.001, name: "Hungry Bellows" },
  { tier: 2, insightCost: 1400, trueMetalChance: 0.003, name: "Iron Patience" },
  { tier: 3, insightCost: 3000, trueMetalChance: 0.007, name: "The Deep Refinery" },
];

/** Unlock iron purifying at the Smelter — a one-time Insight cost. */
export const IRON_PURIFYING_UNLOCK_INSIGHT_COST = 500;

const IRON_SMELTER_BASE_TRUE_METAL_CHANCE = 0.0002; // 0.02% — half of copper's base

export function purifyIronTrueMetalChance(ironSmelterTier: number): number {
  if (ironSmelterTier === 0) return IRON_SMELTER_BASE_TRUE_METAL_CHANCE;
  const tier = IRON_SMELTER_TIERS.find((t) => t.tier === ironSmelterTier);
  return tier?.trueMetalChance ?? IRON_SMELTER_BASE_TRUE_METAL_CHANCE;
}

export function nextIronSmelterTier(currentTier: number): IronSmelterTier | null {
  return IRON_SMELTER_TIERS.find((t) => t.tier === currentTier + 1) ?? null;
}

export function canAffordIronSmelterTier(insightBanked: number, currentTier: number): boolean {
  const next = nextIronSmelterTier(currentTier);
  return next !== null && insightBanked >= next.insightCost;
}

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
 * Maps an ingot to its True-metal output. Extended to include iron
 * (added alongside IRON_SMELTER_TIERS above).
 */
const TRUE_METAL_BY_INGOT: Record<string, MaterialId> = {
  copper_ingot: "true_copper",
  iron_ingot:   "true_iron",
};

/**
 * Coal consumed per purification attempt, by ingot type. Heavy by
 * design — purifying is a real resource sink, not a passive bonus.
 * Scales with metal tier: iron requires more than twice the coal of
 * copper, reflecting the higher heat needed to refine harder metals.
 * Future metals will scale geometrically from here.
 */
export const PURIFY_COAL_COST: Record<string, number> = {
  copper_ingot: 5,
  iron_ingot:   12,
};

export const PURIFY_INGOT_COST = 5; // ingots consumed per purification attempt
export const PURIFY_BASE_XP = 12;
export const PURIFY_IRON_BASE_XP = 20; // iron purifying grants more XP — harder process

export interface PurifyResult {
  ingotMaterialId: MaterialId;
  ingotsSpent: number;
  coalSpent: number;
  xpGained: number;
  trueMetalGained: MaterialId | null;
  newLevel: number;
  leveledUp: boolean;
}

/**
 * Attempt one purification pass. ALWAYS consumes ingots and coal,
 * grants XP. `roll` decides only whether a True-metal drops.
 * ironSmelterTier is used when purifying iron_ingot.
 */
export function attemptPurify(
  ingotMaterialId: MaterialId,
  smithingSkill: SkillState,
  inventory: ResourceBag,
  smelterTier: number,
  roll: number,
  ironSmelterTier: number = 0
): PurifyResult {
  const trueMetalId = TRUE_METAL_BY_INGOT[ingotMaterialId];
  if (!trueMetalId) {
    throw new Error(`${ingotMaterialId} has no True-metal counterpart yet`);
  }

  const heldIngots = getMaterialAmount(inventory, ingotMaterialId);
  if (heldIngots < PURIFY_INGOT_COST) {
    throw new Error(`Not enough ${ingotMaterialId} to purify: have ${heldIngots}, need ${PURIFY_INGOT_COST}`);
  }

  const coalCost = PURIFY_COAL_COST[ingotMaterialId] ?? 5;
  const heldCoal = getMaterialAmount(inventory, "coal");
  if (heldCoal < coalCost) {
    throw new Error(`Not enough coal to purify: have ${heldCoal}, need ${coalCost}`);
  }

  const isIron = ingotMaterialId === "iron_ingot";
  const dropChance = isIron
    ? purifyIronTrueMetalChance(ironSmelterTier)
    : purifyTrueMetalChance(smelterTier);
  const xpGained = isIron ? PURIFY_IRON_BASE_XP : PURIFY_BASE_XP;
  const trueMetalGained = roll < dropChance ? trueMetalId : null;

  const oldLevel = smithingSkill.level;
  const newXp = smithingSkill.xp + xpGained;
  const newLevel = levelForXp(newXp);

  return {
    ingotMaterialId,
    ingotsSpent: PURIFY_INGOT_COST,
    coalSpent: coalCost,
    xpGained,
    trueMetalGained,
    newLevel,
    leveledUp: newLevel > oldLevel,
  };
}

export function applyPurifyResult(inventory: ResourceBag, result: PurifyResult): ResourceBag {
  let updated = deductMaterials(inventory, {
    [result.ingotMaterialId]: result.ingotsSpent,
    coal: result.coalSpent,
  });
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
