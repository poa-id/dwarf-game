import type { HearthState } from "./types";
import { colorStageForLifetimeFuel } from "./colorStages";

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
 * Fuel must be available in `bankedFuelAvailable` (typically the world's
 * stored fuel resource, fed by Mining/Smithing byproducts) for absorption
 * to happen — the Hearth cannot tend itself out of nothing.
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
