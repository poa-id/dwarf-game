import type { SkillState, ResourceBag, MaterialId } from "./types";
import { getMaterialAmount, deductMaterials, canAffordMaterials, addMaterial } from "./types";
import { levelForXp } from "./xpCurve";

/**
 * The Gemcutting station - added 2026-06-23 alongside the new
 * Tinkering skill. Refines rare uncut gems (dropped rarely by Mining,
 * see gathering.ts's GatherableNode.gemDrop / mining.ts's per-vein
 * configs) into cut gems, the currency for Tinkering's own
 * self-reinforcing perk tree. A THIRD permanent-multiplier track,
 * alongside the Smelter's XP perk and the Hearth's yield perk - each
 * with its own currency (True-metals for the first two, cut gems for
 * this one) and each affecting a genuinely different number, by
 * explicit project direction ("let's not have this overlap with other
 * upgrade stations").
 *
 * Unlike the Smelter's purification (which always succeeds at the
 * baseline and only the BONUS is random), cutting a gem has its OWN
 * real success/failure chance - a failed cut wastes the rough gem
 * entirely, no XP, no cut gem. Explicit design call: "mirrors most
 * other crafting actions in this game," i.e. real risk, not a
 * guaranteed-baseline-plus-bonus-roll shape like the Smelter.
 *
 * Iron-free by design, same reasoning as the Smelter: reachable before
 * the Tunnel Entrance unlocks.
 */
export const GEMCUTTING_BUILD_COST: ResourceBag = {
  copper_ingot: 15,
  wood: 20,
};
export const GEMCUTTING_BUILD_INSIGHT_COST = 800; // below the Smelter's 1200 ceiling - reachable a bit earlier

export function canAffordGemcuttingBuild(inventory: ResourceBag, insightBanked: number): boolean {
  return (
    insightBanked >= GEMCUTTING_BUILD_INSIGHT_COST && canAffordMaterials(inventory, GEMCUTTING_BUILD_COST)
  );
}

export function applyGemcuttingBuild(
  inventory: ResourceBag,
  insightBanked: number
): { inventory: ResourceBag; insightBanked: number } {
  return {
    inventory: deductMaterials(inventory, GEMCUTTING_BUILD_COST),
    insightBanked: insightBanked - GEMCUTTING_BUILD_INSIGHT_COST,
  };
}

/**
 * Gemcutting station upgrade tiers - Insight-funded, World-persistent,
 * mirroring SMELTER_TIERS' costs exactly (300/700/1500). Unlike the
 * Smelter's tiers (which raise ONE number, True-metal chance), each
 * tier here raises TWO things together: the raw gem-DROP chance
 * (gathering.ts's gemDropChanceBonus, applied at the mining-strike
 * level) AND the cutting-SUCCESS chance (this file's own action) - a
 * single combined track, not two separate ones, per explicit design.
 */
export interface GemcuttingTier {
  tier: number;
  insightCost: number;
  dropChanceBonus: number;
  cuttingSuccessBonus: number;
  name: string;
}

export const GEMCUTTING_TIERS: GemcuttingTier[] = [
  { tier: 1, insightCost: 300, dropChanceBonus: 0.005, cuttingSuccessBonus: 0.1, name: "Steadier Hands" },
  { tier: 2, insightCost: 700, dropChanceBonus: 0.01, cuttingSuccessBonus: 0.2, name: "Loupe and Wheel" },
  { tier: 3, insightCost: 1500, dropChanceBonus: 0.015, cuttingSuccessBonus: 0.3, name: "Master's Bench" },
];

export function nextGemcuttingTier(currentTier: number): GemcuttingTier | null {
  return GEMCUTTING_TIERS.find((t) => t.tier === currentTier + 1) ?? null;
}

export function canAffordGemcuttingTier(insightBanked: number, currentTier: number): boolean {
  const next = nextGemcuttingTier(currentTier);
  return next !== null && insightBanked >= next.insightCost;
}

export function gemcuttingDropChanceBonus(gemcuttingTier: number): number {
  if (gemcuttingTier === 0) return 0;
  const tier = GEMCUTTING_TIERS.find((t) => t.tier === gemcuttingTier);
  return tier?.dropChanceBonus ?? 0;
}

function gemcuttingSuccessBonus(gemcuttingTier: number): number {
  if (gemcuttingTier === 0) return 0;
  const tier = GEMCUTTING_TIERS.find((t) => t.tier === gemcuttingTier);
  return tier?.cuttingSuccessBonus ?? 0;
}

const CUT_GEM_BY_ROUGH: Record<string, MaterialId> = {
  rough_quartz: "cut_quartz",
  rough_garnet: "cut_garnet",
  rough_amethyst: "cut_amethyst",
};

export const CUT_BASE_SUCCESS_CHANCE = 0.6;
export const CUTTING_BASE_XP = 10;

export interface CutGemResult {
  roughMaterialId: MaterialId;
  cutMaterialId: MaterialId;
  success: boolean;
  xpGained: number;
  newLevel: number;
  leveledUp: boolean;
}

export function attemptCutGem(
  roughMaterialId: MaterialId,
  tinkeringSkill: SkillState,
  inventory: ResourceBag,
  gemcuttingTier: number,
  cutGemsSpentOnPerk: number,
  roll: number
): CutGemResult {
  const cutMaterialId = CUT_GEM_BY_ROUGH[roughMaterialId];
  if (!cutMaterialId) {
    throw new Error(`${roughMaterialId} has no cut-gem counterpart`);
  }

  const held = getMaterialAmount(inventory, roughMaterialId);
  if (held < 1) {
    throw new Error(`Not enough ${roughMaterialId} to cut: have ${held}, need 1`);
  }

  // Uses the COMBINED bonus (station tier + Tinkering perk tree), not
  // just the station's own portion - attemptCutGem is the actual point
  // where cutting success gets rolled, so it needs the full picture,
  // not a partial one. See totalCuttingSuccessBonus's own doc comment.
  const successChance = Math.min(
    1,
    CUT_BASE_SUCCESS_CHANCE + totalCuttingSuccessBonus(gemcuttingTier, cutGemsSpentOnPerk)
  );
  const success = roll < successChance;
  const oldLevel = tinkeringSkill.level;

  if (!success) {
    return {
      roughMaterialId,
      cutMaterialId,
      success: false,
      xpGained: 0,
      newLevel: oldLevel,
      leveledUp: false,
    };
  }

  const newXp = tinkeringSkill.xp + CUTTING_BASE_XP;
  const newLevel = levelForXp(newXp);

  return {
    roughMaterialId,
    cutMaterialId,
    success: true,
    xpGained: CUTTING_BASE_XP,
    newLevel,
    leveledUp: newLevel > oldLevel,
  };
}

export function applyCutGemResult(inventory: ResourceBag, result: CutGemResult): ResourceBag {
  let updated = deductMaterials(inventory, { [result.roughMaterialId]: 1 });
  if (result.success) {
    updated = addMaterial(updated, result.cutMaterialId, 1);
  }
  return updated;
}

export interface TinkeringPerkTier {
  tier: number;
  cumulativeCutGemCost: number;
  dropChanceBonus: number;
  cuttingSuccessBonus: number;
}

export const TINKERING_PERK_TIERS: TinkeringPerkTier[] = [
  { tier: 1, cumulativeCutGemCost: 1, dropChanceBonus: 0.05, cuttingSuccessBonus: 0.05 },
  { tier: 2, cumulativeCutGemCost: 3, dropChanceBonus: 0.1, cuttingSuccessBonus: 0.1 },
  { tier: 3, cumulativeCutGemCost: 6, dropChanceBonus: 0.15, cuttingSuccessBonus: 0.15 },
];

export function activeTinkeringPerkTier(cutGemsSpent: number): TinkeringPerkTier | null {
  let active: TinkeringPerkTier | null = null;
  for (const tier of TINKERING_PERK_TIERS) {
    if (cutGemsSpent >= tier.cumulativeCutGemCost) active = tier;
  }
  return active;
}

export function nextTinkeringPerkTier(cutGemsSpent: number): TinkeringPerkTier | null {
  const current = activeTinkeringPerkTier(cutGemsSpent);
  const currentTierNum = current?.tier ?? 0;
  return TINKERING_PERK_TIERS.find((t) => t.tier === currentTierNum + 1) ?? null;
}

export function cutGemsNeededForNextPerkTier(cutGemsSpent: number): number | null {
  const next = nextTinkeringPerkTier(cutGemsSpent);
  if (!next) return null;
  return Math.max(0, next.cumulativeCutGemCost - cutGemsSpent);
}

export function totalGemDropChanceBonus(gemcuttingTier: number, cutGemsSpentOnPerk: number): number {
  const stationBonus = gemcuttingDropChanceBonus(gemcuttingTier);
  const perkBonus = activeTinkeringPerkTier(cutGemsSpentOnPerk)?.dropChanceBonus ?? 0;
  return stationBonus + perkBonus;
}

export function totalCuttingSuccessBonus(gemcuttingTier: number, cutGemsSpentOnPerk: number): number {
  const stationBonus = gemcuttingSuccessBonus(gemcuttingTier);
  const perkBonus = activeTinkeringPerkTier(cutGemsSpentOnPerk)?.cuttingSuccessBonus ?? 0;
  return stationBonus + perkBonus;
}
