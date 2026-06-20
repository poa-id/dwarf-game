import type { ColorStage } from "./types";

/**
 * Permanent, one-way thresholds. Stage 1 is special: crossing it is not
 * just "the hearth got bigger," it IS the rekindling event — the current
 * dwarf gives himself to the flame, and the world gains its first color.
 * Stages beyond 1 are NOT rekindlings, just the hearth continuing to grow
 * as it's tended across however many dwarves have lived since.
 *
 * fuelThreshold is checked against HearthState.lifetimeFuel, which never
 * decreases — so these are permanent, not something you can lose by
 * spending your current fuel balance.
 */
export const COLOR_STAGES: ColorStage[] = [
  { stage: 0, fuelThreshold: 0, label: "The Dark" },
  { stage: 1, fuelThreshold: 500, label: "First Ember" },
  { stage: 2, fuelThreshold: 5_000, label: "Hearthlight" },
  { stage: 3, fuelThreshold: 50_000, label: "True Color" },
];

/** Given lifetime fuel absorbed, what's the highest stage reached? */
export function colorStageForLifetimeFuel(lifetimeFuel: number): ColorStage {
  let current = COLOR_STAGES[0];
  for (const stage of COLOR_STAGES) {
    if (lifetimeFuel >= stage.fuelThreshold) {
      current = stage;
    }
  }
  return current;
}

export function nextColorStage(currentStage: number): ColorStage | null {
  return COLOR_STAGES.find((s) => s.stage === currentStage + 1) ?? null;
}
