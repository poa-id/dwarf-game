import type { ColorStage } from "./types";

/**
 * Permanent, one-way thresholds. Stage 1 is special: crossing it IS
 * the rekindling event — the dwarf gives himself to the flame, the
 * world gains its first color.
 *
 * Stages 0-3 are gated by lifetime fuel absorbed — the Hearth's work.
 * Stages 4-5 are gated ALSO by restoration score — the mountain's
 * restoration. A Hearth that's burned a lot isn't enough; the rooms,
 * drills, and structures must also be meaningfully restored.
 *
 * This separation matters: it means a player can't just AFK-burn fuel
 * to reach stage 4. They have to actually rebuild the mountain.
 */
export const COLOR_STAGES: ColorStage[] = [
  { stage: 0, fuelThreshold: 0,       label: "The Dark" },
  { stage: 1, fuelThreshold: 500,     label: "First Ember" },
  { stage: 2, fuelThreshold: 5_000,   label: "Hearthlight" },
  { stage: 3, fuelThreshold: 50_000,  label: "True Color" },
  {
    stage: 4,
    fuelThreshold: 100_000,
    restorationThreshold: 3_000,
    label: "Architecture",
  },
  {
    stage: 5,
    fuelThreshold: 250_000,
    restorationThreshold: 8_000,
    label: "The Mountain Remembers",
  },
];

/**
 * Given lifetime fuel and restoration score, what's the highest stage reached?
 * A stage is reached only when BOTH thresholds are met.
 */
export function colorStageForLifetimeFuel(
  lifetimeFuel: number,
  restorationScore: number = 0
): ColorStage {
  let current = COLOR_STAGES[0];
  for (const stage of COLOR_STAGES) {
    const fuelMet = lifetimeFuel >= stage.fuelThreshold;
    const restorationMet = stage.restorationThreshold === undefined ||
                           restorationScore >= stage.restorationThreshold;
    if (fuelMet && restorationMet) {
      current = stage;
    }
  }
  return current;
}

export function nextColorStage(currentStage: number): ColorStage | null {
  return COLOR_STAGES.find((s) => s.stage === currentStage + 1) ?? null;
}

/**
 * Caps at 0 until first rekindle. See original comment in colorStages.ts —
 * stage 1 IS the rekindling event, the color shouldn't appear before the
 * player makes that choice.
 */
export function capColorStageBeforeFirstRekindle(
  pureFuelStage: ColorStage,
  hasRekindledOnce: boolean
): ColorStage {
  return hasRekindledOnce ? pureFuelStage : COLOR_STAGES[0];
}
