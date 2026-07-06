import type { HearthState, ResourceBag, MaterialId } from "./types";
import { DRILL_COAL_BUFFER_MAX, drillDefinitionByVeinId } from "./drill";
import { getMaterialAmount, deductMaterials, addMaterial, materialDef } from "./types";
import { colorStageForLifetimeFuel, capColorStageBeforeFirstRekindle } from "./colorStages";

/**
 * Which materials the Hearth can burn, and how much each contributes
 * per unit - weighted by the material's own heatValue, so coal (hot)
 * contributes more per-unit than wood (weaker). This is intentionally
 * separate from Smithing's fuel logic (which checks a hard
 * minHeatRequired threshold per recipe) - the Hearth doesn't reject
 * weak fuel, it just burns through it faster for the same effect,
 * since "the hearth can be powered by other means" - it's not picky
 * the way a forge demanding real heat is.
 */
export const HEARTH_FUEL_MATERIALS: MaterialId[] = ["coal", "wood", "charcoal"];

/**
 * Computes total available fuel VALUE (not raw quantity) the Hearth
 * could draw from right now, across every material it accepts,
 * weighted by each material's heatValue. A caller typically passes
 * this as tickHearth's `bankedFuelAvailable` - though note this
 * reports what's AVAILABLE, not what gets consumed; actual consumption
 * accounting (deciding which specific material to deduct, and how
 * much, as the Hearth burns through its allocated share) is the
 * caller's responsibility, not modeled here yet (see DESIGN.md §11 -
 * coal/wood allocation between Hearth and Smithing is still an open
 * mechanic, this only answers "how much could the hearth use").
 */
export function totalHearthFuelValue(inventory: ResourceBag): number {
  return HEARTH_FUEL_MATERIALS.reduce((total, materialId) => {
    const amount = getMaterialAmount(inventory, materialId);
    const heat = materialDef(materialId).heatValue ?? 1;
    return total + amount * heat;
  }, 0);
}

/**
 * How many seconds of passive auto-burn the reserve can currently
 * sustain at FUEL_ABSORPTION_RATE_PER_SEC - the real, persisted number
 * behind the Hearth panel's burn gauge (see hearthPanel.ts). This is
 * NOT cosmetic: it reflects actual banked WorldState.fuelReserve and
 * drains for real as tickHearth consumes it each tick, same value the
 * engine itself uses to decide how long auto-tending can run before
 * the reserve runs dry.
 */
export function reserveBurnSecondsRemaining(fuelReserve: ResourceBag): number {
  return totalHearthFuelValue(fuelReserve) / FUEL_ABSORPTION_RATE_PER_SEC;
}

// ---------------------------------------------------------------------------
// Stoking - the EARLY, manual way to feed the Hearth, and ALSO the
// permanent way to bank fuel for later even once automation exists
// (per the project owner: manual stoking always works, it's a
// different action from automation, not superseded by it). Two
// distinct targets:
//
// - stokeFireDirectly: burns material immediately, adds straight to
//   lifetimeFuel/colorStage progress right now.
// - stokeReserve: moves material into WorldState.fuelReserve instead -
//   banked for later, either for the player to draw on by choice, or
//   for Narag-Bund (once befriended) to find already waiting.
// ---------------------------------------------------------------------------

export interface StokeFireResult {
  hearth: HearthState;
  inventory: ResourceBag;
  fuelAdded: number;
  colorStageIncreased: boolean;
}

/**
 * Stoke the Hearth's FIRE directly with a specific amount of a specific
 * fuel material - immediate progress, consumed from personal inventory.
 * Pure function - throws if the material isn't a recognized hearth
 * fuel, or if the player doesn't have enough of it. The caller is
 * responsible for offering only valid (affordable, real-fuel) choices
 * in the UI - this is a defensive invariant, not UX, same pattern as
 * the rest of the engine.
 */
export function stokeFireDirectly(
  hearth: HearthState,
  inventory: ResourceBag,
  materialId: MaterialId,
  amount: number,
  now: number,
  hasRekindledOnce: boolean,
  restorationScore: number = 0
): StokeFireResult {
  if (!HEARTH_FUEL_MATERIALS.includes(materialId)) {
    throw new Error(`${materialId} cannot fuel the Hearth`);
  }
  if (amount <= 0) {
    throw new Error(`Stoke amount must be positive, got ${amount}`);
  }
  const held = getMaterialAmount(inventory, materialId);
  if (held < amount) {
    throw new Error(`Not enough ${materialId} to stoke: have ${held}, need ${amount}`);
  }

  const heat = materialDef(materialId).heatValue ?? 1;
  const fuelAdded = amount * heat;

  const newLifetimeFuel = hearth.lifetimeFuel + fuelAdded;
  const pureFuelStage = colorStageForLifetimeFuel(newLifetimeFuel, restorationScore);
  const newColorStage = capColorStageBeforeFirstRekindle(pureFuelStage, hasRekindledOnce).stage;

  const newHearth: HearthState = {
    fuel: hearth.fuel + fuelAdded,
    lifetimeFuel: newLifetimeFuel,
    colorStage: newColorStage,
    lastUpdated: now, // stoking also "counts" as tending - resets the tick clock so a subsequent tickHearth doesn't double-count this moment
  };

  const newInventory = deductMaterials(inventory, { [materialId]: amount });

  return {
    hearth: newHearth,
    inventory: newInventory,
    fuelAdded,
    colorStageIncreased: newColorStage > hearth.colorStage,
  };
}

export interface StokeReserveResult {
  inventory: ResourceBag;
  fuelReserve: ResourceBag;
}

/**
 * Move material from personal inventory into the Hearth's fuel
 * Reserve - banking it, not burning it yet. Throws under the same
 * conditions as stokeFireDirectly (unrecognized material, insufficient
 * held amount).
 */
export function stokeReserve(
  inventory: ResourceBag,
  fuelReserve: ResourceBag,
  materialId: MaterialId,
  amount: number
): StokeReserveResult {
  if (!HEARTH_FUEL_MATERIALS.includes(materialId)) {
    throw new Error(`${materialId} cannot fuel the Hearth`);
  }
  if (amount <= 0) {
    throw new Error(`Stoke amount must be positive, got ${amount}`);
  }
  const held = getMaterialAmount(inventory, materialId);
  if (held < amount) {
    throw new Error(`Not enough ${materialId} to bank: have ${held}, need ${amount}`);
  }

  return {
    inventory: deductMaterials(inventory, { [materialId]: amount }),
    fuelReserve: addMaterial(fuelReserve, materialId, amount),
  };
}

/**
 * How much fuel the Hearth absorbs per second of real time, assuming it
 * has fuel available to consume. This is intentionally simple (constant
 * rate) for v1 — later this could scale with forgeTier or hearth upgrades.
 */
export const FUEL_ABSORPTION_RATE_PER_SEC = 0.5;

/**
 * Hearthkeeping XP granted per unit of fuel VALUE actually burned -
 * shared by both XP sources (direct "feed the fire" stokes in
 * hearthPanel.ts's performStoke, and the passive tick's fuel
 * consumption in loop.ts's gameTick) so they stay consistent rather
 * than each defining their own rate. Per explicit project direction
 * (2026-06-23): banking fuel into the reserve grants NOTHING by
 * itself - XP comes from fuel being burned, whether that happens
 * immediately (direct stoke) or later, passively, once auto-tending
 * consumes it from the reserve. 0.2 works out to roughly 360 XP/hour
 * of fully passive, idle hearth-tending - a deliberate slow trickle,
 * well below the Charcoal Kiln's 8 XP per active click.
 */
export const HEARTHKEEPING_XP_PER_FUEL_VALUE = 0.2;

/**
 * Cap on how much offline time we'll simulate in one catch-up, in ms.
 * Without this, leaving the tab closed for a month and coming back
 * would do a giant unsupervised computation and could also feel
 * "solved" rather than tended. 24 hours is generous but bounded.
 */
export const MAX_OFFLINE_CATCHUP_MS = 24 * 60 * 60 * 1000;

export interface HearthTickResult {
  hearth: HearthState;
  /** Fuel actually absorbed this tick (post-cap, post-availability). */
  fuelAbsorbed: number;
  /** True if this tick caused colorStage to increase. */
  colorStageIncreased: boolean;
}

/**
 * Advance the Hearth by elapsed real time. Pure function: given a hearth
 * state and "now", returns the new state. Used identically whether the
 * elapsed time is 16ms (a live render tick) or 6 hours (the player just
 * reopened the tab) — that uniformity is the whole point of designing it
 * this way; there is no separate "offline" code path to get out of sync
 * with the "online" one.
 *
 * Fuel must be available in `bankedFuelAvailable` for absorption to
 * happen — the Hearth cannot tend itself out of nothing. As of the
 * fuel-Reserve system, this is specifically `totalHearthFuelValue(world.
 * fuelReserve)` — the Hearth's OWN stockpile, never the dwarf's personal
 * inventory directly. Only called at all once `isAutoTendingUnlocked`
 * is true (hearthTier >= 1) - before that, stokeFireDirectly is the
 * entire mechanic, by design.
 */
export function tickHearth(
  hearth: HearthState,
  now: number,
  bankedFuelAvailable: number,
  hasRekindledOnce: boolean,
  restorationScore: number = 0
): HearthTickResult {
  const elapsedMs = Math.max(0, now - hearth.lastUpdated);
  const cappedMs = Math.min(elapsedMs, MAX_OFFLINE_CATCHUP_MS);
  const elapsedSec = cappedMs / 1000;

  const desiredAbsorption = elapsedSec * FUEL_ABSORPTION_RATE_PER_SEC;
  const fuelAbsorbed = Math.min(desiredAbsorption, bankedFuelAvailable);

  const newLifetimeFuel = hearth.lifetimeFuel + fuelAbsorbed;
  // Defensive, not strictly reachable today: tickHearth only ever runs
  // once isAutoTendingUnlocked(hearthTier >= 1) is true, which itself
  // requires Insight, which ONLY comes from rekindle.ts's
  // calculateRekindleInsight - so hasRekindledOnce is already always
  // true by the time this function can be called at all. Threaded
  // through anyway for explicitness, matching this engine's
  // established pattern of defensive invariants rather than relying
  // on an indirect chain of reasoning elsewhere staying true forever.
  const pureFuelStage = colorStageForLifetimeFuel(newLifetimeFuel, restorationScore);
  const newColorStage = capColorStageBeforeFirstRekindle(pureFuelStage, hasRekindledOnce).stage;

  const newHearth: HearthState = {
    fuel: hearth.fuel + fuelAbsorbed,
    lifetimeFuel: newLifetimeFuel,
    colorStage: newColorStage,
    lastUpdated: now,
  };

  return {
    hearth: newHearth,
    fuelAbsorbed,
    colorStageIncreased: newColorStage > hearth.colorStage,
  };
}

/**
 * Given a fuel VALUE that's been absorbed (e.g. tickHearth's
 * fuelAbsorbed), deduct the equivalent in actual materials from the
 * Reserve. Burns the highest-heat fuel FIRST (coal before wood) - this
 * is an arbitrary but reasonable choice (burn the efficient fuel while
 * it lasts, fall back to weaker fuel once it runs out) rather than a
 * proportional blend, which would be harder to reason about and not
 * obviously better. Returns the updated reserve; if the reserve didn't
 * actually have enough material to cover the requested value (a
 * mismatch with what totalHearthFuelValue reported - shouldn't happen
 * if called correctly, but defensively handled), deducts as much as
 * it can rather than going negative.
 */
export function deductFuelValueFromReserve(
  fuelReserve: ResourceBag,
  valueToDeduct: number
): ResourceBag {
  let remaining = valueToDeduct;
  let updated = fuelReserve;

  // Sort by heatValue descending so we burn through the best fuel first.
  const sortedMaterials = [...HEARTH_FUEL_MATERIALS].sort((a, b) => {
    return (materialDef(b).heatValue ?? 1) - (materialDef(a).heatValue ?? 1);
  });

  for (const materialId of sortedMaterials) {
    if (remaining <= 0) break;
    const held = getMaterialAmount(updated, materialId);
    if (held <= 0) continue;

    const heat = materialDef(materialId).heatValue ?? 1;
    const unitsNeeded = remaining / heat;
    const unitsToDeduct = Math.min(held, unitsNeeded);

    updated = deductMaterials(updated, { [materialId]: unitsToDeduct });
    remaining -= unitsToDeduct * heat;
  }

  return updated;
}

export function createInitialHearth(now: number): HearthState {
  return {
    fuel: 0,
    lifetimeFuel: 0,
    colorStage: 0,
    lastUpdated: now,
  };
}

// ---------------------------------------------------------------------------
// Hearth upgrades - Insight-funded, World-persistent, like FORGE_UPGRADES
// in smithing.ts but philosophically distinct: these are upgrades to the
// MOUNTAIN ITSELF (per DESIGN.md - the Hearth secretly IS the mountain),
// mythic/passive/global rather than the Forge's practical/active/
// personal tools-and-yields track.
//
// Tier 1, "Friend of Burden," is the moment the dwarf befriends
// Narag-Bund ("black head" in the dwarves' secret tongue) - a coal-
// beetle hauling-beast found in the dark, not built or player-named.
// This is the gate for BOTH tickHearth's passive continuous draw AND
// Narag-Bund's own hauling (see haulFuelToReserve below) - before this
// tier, manual stoking is the entire mechanic, by design.
// ---------------------------------------------------------------------------

export interface HearthUpgrade {
  tier: number;
  insightCost: number;
  name: string;
  description: string;
}

export const HEARTH_UPGRADES: HearthUpgrade[] = [
  {
    tier: 1,
    // Raised from 30 -> 250 (2026-06-22, project owner's explicit call):
    // Narag-Bund is meant to be rare and major, not an early-game freebie.
    // 250 matches FORGE_UPGRADES' "Bellows of the Deep" - the same
    // weight-class as a major Forge upgrade, not a cheap first purchase.
    // This cost ALSO doubles as the discovery gate (see hearthPanel.ts) -
    // the upgrade row doesn't render at all below this threshold, so
    // reaching 250 Insight banked IS the moment the player first learns
    // Narag-Bund exists. Insight only comes from rekindling (see
    // rekindle.ts calculateRekindleInsight), so this is reachable only
    // after real, sustained play - not a quick early trigger.
    insightCost: 250,
    name: "Friend of Burden",
    description: "Narag-Bund - found in the dark, coal-backed, willing to carry what you can't.",
  },
  {
    tier: 2,
    // Raised from 150 -> 400 (2026-06-22) - a tier-2 upgrade must cost
    // more than its own tier-1 prerequisite (250), not less.
    insightCost: 400,
    name: "Deepened Hearth",
    description: "The hearth burns fuel more efficiently - less is lost to the dark.",
  },
];

export function nextHearthUpgrade(currentTier: number): HearthUpgrade | null {
  return HEARTH_UPGRADES.find((u) => u.tier === currentTier + 1) ?? null;
}

export function canAffordHearthUpgrade(insightBanked: number, currentTier: number): boolean {
  const next = nextHearthUpgrade(currentTier);
  if (!next) return false;
  return insightBanked >= next.insightCost;
}

/**
 * The Hearth's permanent GLOBAL YIELD perk tree - added 2026-06-23.
 * The genuine counterpart to the Smelter's XP perk tree
 * (smelter.ts's XP_PERK_TIERS): that one governs HOW FAST you level,
 * this one governs HOW MUCH you get per action. Both spend the same
 * True-metal currency, but track SEPARATE running totals
 * (WorldState.trueMetalSpentOnYieldPerk here, vs.
 * trueMetalSpentOnXpPerk for the Smelter's tree) - the player
 * allocates each True-metal independently between the two, a real
 * resource-allocation choice, by explicit project direction ("let's
 * not have this overlap with other upgrade stations" - sharing the
 * CURRENCY is fine, the MECHANIC and the spend-tracking are fully
 * separate).
 *
 * Mirrors XP_PERK_TIERS' shape exactly: 3 cumulative-spend tiers
 * (1/3/6 total True-metals), +5/10/15% each. Applied ADDITIVELY on
 * top of the existing tool-based yieldMultiplier (gathering.ts's
 * ToolTier) wherever a quantity gets produced - mining, woodcraft,
 * smithing, the kiln - per explicit direction ("applied everywhere
 * uniformly"). See yieldCurve.ts's applyYieldMultiplier, the single
 * shared function every yield-producing call site uses.
 */
export interface YieldPerkTier {
  tier: number;
  cumulativeTrueMetalCost: number;
  yieldBonus: number; // additive, e.g. 0.05 = +5%
}

export const YIELD_PERK_TIERS: YieldPerkTier[] = [
  { tier: 1, cumulativeTrueMetalCost: 1, yieldBonus: 0.05 },
  { tier: 2, cumulativeTrueMetalCost: 3, yieldBonus: 0.1 },
  { tier: 3, cumulativeTrueMetalCost: 6, yieldBonus: 0.15 },
];

export function activeYieldPerkTier(trueMetalSpent: number): YieldPerkTier | null {
  let active: YieldPerkTier | null = null;
  for (const tier of YIELD_PERK_TIERS) {
    if (trueMetalSpent >= tier.cumulativeTrueMetalCost) active = tier;
  }
  return active;
}

/** The additive yield bonus from the active tier, 0 if none purchased yet - what yieldCurve.ts's multiplier formula adds on top of the tool's own yieldMultiplier. */
export function yieldPerkBonus(trueMetalSpent: number): number {
  return activeYieldPerkTier(trueMetalSpent)?.yieldBonus ?? 0;
}

export function nextYieldPerkTier(trueMetalSpent: number): YieldPerkTier | null {
  const current = activeYieldPerkTier(trueMetalSpent);
  const currentTierNum = current?.tier ?? 0;
  return YIELD_PERK_TIERS.find((t) => t.tier === currentTierNum + 1) ?? null;
}

export function trueMetalNeededForNextYieldPerkTier(trueMetalSpent: number): number | null {
  const next = nextYieldPerkTier(trueMetalSpent);
  if (!next) return null;
  return Math.max(0, next.cumulativeTrueMetalCost - trueMetalSpent);
}

/** Whether tickHearth's passive continuous draw should run at all - false until Friend of Burden (tier 1) is bought. */
export function isAutoTendingUnlocked(hearthTier: number): boolean {
  return hearthTier >= 1;
}

// ---------------------------------------------------------------------------
// Narag-Bund's hauling - real-time interval pacing (not tied to player
// actions), feels like a creature on his own schedule rather than a
// mechanical multiplier. He moves a FIXED AMOUNT of whichever fuel
// material the player currently holds most of, every HAUL_INTERVAL_MS,
// from personal inventory into the Reserve. He only ever hauls
// materials the player has ALREADY discovered (i.e. that appear in
// inventory at all) - he shares the dwarf's knowledge, not an
// outsider's.
// ---------------------------------------------------------------------------

export const HAUL_INTERVAL_MS = 10_000;
export const HAUL_AMOUNT_PER_TRIP = 1;

/**
 * Narag-Bund's haul speed multiplier once the Turbine is built
 * (2026-07-06, direct instruction: "Narag Bund at [this] point should
 * be able to haul materials at a staggering pace, so the player
 * doesn't have to manually feed coal anywhere" - deferred to judgment
 * on the exact number). Applied as BOTH a shorter interval AND a
 * bigger per-trip amount (not just one or the other) - the combined
 * effect is what actually reads as "staggering" rather than a modest
 * bump; a single multiplier applied to the same formula either
 * function was already using. Same "initial guess, real numbers come
 * from the later balancing pass" caveat as everything else added this
 * session.
 */
export const TURBINE_HAUL_INTERVAL_MULTIPLIER = 1 / 3; // interval shrinks to 1/3 (10s -> ~3.3s)
export const TURBINE_HAUL_AMOUNT_MULTIPLIER = 10; // 10x the fuel per trip

export function companionHaulIntervalMs(turbineBuilt: boolean): number {
  return turbineBuilt ? Math.round(HAUL_INTERVAL_MS * TURBINE_HAUL_INTERVAL_MULTIPLIER) : HAUL_INTERVAL_MS;
}

export function companionHaulAmountPerTrip(turbineBuilt: boolean): number {
  return turbineBuilt ? HAUL_AMOUNT_PER_TRIP * TURBINE_HAUL_AMOUNT_MULTIPLIER : HAUL_AMOUNT_PER_TRIP;
}

export interface HaulResult {
  inventory: ResourceBag;
  fuelReserve: ResourceBag;
  lastHaulAt: number;
  hauled: boolean; // false if not enough time has passed yet, or the dwarf carries no fuel for him to find
}

/**
 * Advance Narag-Bund's hauling by elapsed real time. Pure function,
 * same offline-catchup-friendly shape as tickHearth - safe to call with
 * a large time gap (a closed tab) without it doing dozens of individual
 * trips; it computes how many trips elapsed and applies them in one
 * step, capped by what the dwarf actually carries.
 */
/**
 * Which fuel material Narag-Bund will haul next, given current
 * holdings - whichever HEARTH_FUEL_MATERIALS entry the dwarf currently
 * holds the most of, or null if he's carrying nothing haulable right
 * now. Extracted as its own function (2026-06-23, alongside the
 * companion-visibility fix) so the UI can PREVIEW what he'll haul
 * next without waiting for an actual haul to happen - advanceCompanionHauling
 * below uses this same selection, not a separate copy of the rule.
 */
export function nextHaulMaterial(inventory: ResourceBag): MaterialId | null {
  return HEARTH_FUEL_MATERIALS.reduce<MaterialId | null>((best, candidate) => {
    const candidateAmount = getMaterialAmount(inventory, candidate);
    if (candidateAmount <= 0) return best;
    if (best === null) return candidate;
    return candidateAmount > getMaterialAmount(inventory, best) ? candidate : best;
  }, null);
}

/**
 * Seconds remaining until Narag-Bund's next haul trip, given when his
 * last one happened. Pure presentation math (added 2026-06-23,
 * alongside nextHaulMaterial above) - mirrors reserveBurnSecondsRemaining's
 * style. Clamped at 0 (never negative, even if a trip is overdue and
 * just hasn't been processed by the game loop yet this tick).
 */
export function secondsUntilNextHaul(lastHaulAt: number, now: number): number {
  const elapsedMs = Math.max(0, now - lastHaulAt);
  const remainingMs = Math.max(0, HAUL_INTERVAL_MS - elapsedMs);
  return remainingMs / 1000;
}

export function advanceCompanionHauling(
  inventory: ResourceBag,
  fuelReserve: ResourceBag,
  lastHaulAt: number,
  now: number,
  turbineBuilt: boolean = false
): HaulResult {
  const intervalMs = companionHaulIntervalMs(turbineBuilt);
  const amountPerTrip = companionHaulAmountPerTrip(turbineBuilt);
  const elapsedMs = Math.max(0, now - lastHaulAt);
  const tripsElapsed = Math.floor(elapsedMs / intervalMs);

  if (tripsElapsed <= 0) {
    return { inventory, fuelReserve, lastHaulAt, hauled: false };
  }

  // Pick whichever fuel material the dwarf currently holds the most of -
  // Narag-Bund grabs what's abundant, not a fixed preference order.
  const materialId = nextHaulMaterial(inventory);

  if (materialId === null) {
    // Nothing for him to haul this time, but time still passed - advance
    // the clock anyway so we don't owe a huge backlog of trips once the
    // player finally has fuel again.
    return { inventory, fuelReserve, lastHaulAt: lastHaulAt + tripsElapsed * intervalMs, hauled: false };
  }

  const available = getMaterialAmount(inventory, materialId);
  const amountToHaul = Math.min(available, tripsElapsed * amountPerTrip);

  return {
    inventory: deductMaterials(inventory, { [materialId]: amountToHaul }),
    fuelReserve: addMaterial(fuelReserve, materialId, amountToHaul),
    lastHaulAt: lastHaulAt + tripsElapsed * intervalMs,
    hauled: amountToHaul > 0,
  };
}

// ---------------------------------------------------------------------------
// Narag-Bund: drill coal hauling
// ---------------------------------------------------------------------------

/**
 * Narag-Bund hauls coal from the fuel reserve to drills running low.
 * Unlocks at hearthTier >= 2 — Hearth restoration expands his role
 * from companion to operations manager.
 */
export interface DrillHaulResult {
  fuelReserve: ResourceBag;
  drills: Record<string, import("./drill").DrillState>;
  hauled: boolean;
}

export function advanceDrillHauling(
  fuelReserve: ResourceBag,
  drills: Record<string, import("./drill").DrillState>,
  hearthTier: number,
  turbineBuilt: boolean = false
): DrillHaulResult {
  if (hearthTier < 2) {
    return { fuelReserve, drills, hauled: false };
  }

  const coalInReserve = getMaterialAmount(fuelReserve, "coal");
  if (coalInReserve === 0) {
    return { fuelReserve, drills, hauled: false };
  }

  const drillEntries = Object.entries(drills)
    .filter(([veinId, d]) => d.tier > 0 && d.coalBuffer < DRILL_COAL_BUFFER_MAX / 2 &&
      (drillDefinitionByVeinId(veinId)?.coalPerCycle ?? 1) > 0)
    .sort(([, a], [, b]) => a.coalBuffer - b.coalBuffer);

  if (drillEntries.length === 0) {
    return { fuelReserve, drills, hauled: false };
  }

  let newFuelReserve = { ...fuelReserve };
  let newDrills = { ...drills };
  let hauled = false;

  for (const [veinId, drillState] of drillEntries) {
    const space = DRILL_COAL_BUFFER_MAX - drillState.coalBuffer;
    const available = getMaterialAmount(newFuelReserve, "coal");
    const perTripCap = turbineBuilt ? 5 * TURBINE_HAUL_AMOUNT_MULTIPLIER : 5; // 5 coal/trip base — drills consume much faster than the hearth
    const toHaul = Math.min(space, available, perTripCap);
    if (toHaul <= 0) break;

    newFuelReserve = deductMaterials(newFuelReserve, { coal: toHaul });
    newDrills = {
      ...newDrills,
      [veinId]: { ...drillState, coalBuffer: drillState.coalBuffer + toHaul },
    };
    hauled = true;
  }

  return { fuelReserve: newFuelReserve, drills: newDrills, hauled };
}
