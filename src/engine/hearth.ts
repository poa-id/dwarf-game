import type { HearthState, ResourceBag, MaterialId } from "./types";
import { getMaterialAmount, materialDef } from "./types";
import { colorStageForLifetimeFuel } from "./colorStages";

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
export const HEARTH_FUEL_MATERIALS: MaterialId[] = ["coal", "wood"];

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
 * How much fuel the Hearth absorbs per second of real time, assuming it
 * has fuel available to consume. This is intentionally simple (constant
 * rate) for v1 — later this could scale with forgeTier or hearth upgrades.
 */
export const FUEL_ABSORPTION_RATE_PER_SEC = 0.5;

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
 * material-typed resource system, this is typically the dwarf's coal
 * (or a later, purer fuel) holdings - mined directly, not a smithing
 * byproduct. The caller decides which material(s) count and how much
 * is "banked" for the Hearth vs. held back for Smithing's own needs;
 * this function only cares about the resulting number.
 */
export function tickHearth(
  hearth: HearthState,
  now: number,
  bankedFuelAvailable: number
): HearthTickResult {
  const elapsedMs = Math.max(0, now - hearth.lastUpdated);
  const cappedMs = Math.min(elapsedMs, MAX_OFFLINE_CATCHUP_MS);
  const elapsedSec = cappedMs / 1000;

  const desiredAbsorption = elapsedSec * FUEL_ABSORPTION_RATE_PER_SEC;
  const fuelAbsorbed = Math.min(desiredAbsorption, bankedFuelAvailable);

  const newLifetimeFuel = hearth.lifetimeFuel + fuelAbsorbed;
  const newColorStage = colorStageForLifetimeFuel(newLifetimeFuel).stage;

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

export function createInitialHearth(now: number): HearthState {
  return {
    fuel: 0,
    lifetimeFuel: 0,
    colorStage: 0,
    lastUpdated: now,
  };
}
