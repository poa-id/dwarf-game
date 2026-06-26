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

/**
 * Caps the otherwise-pure-fuel-based stage at 0 until the player has
 * actually rekindled at least once. Fixed 2026-06-23 - a real bug
 * found in playtesting: colorStage was a pure function of
 * lifetimeFuel alone, so the world's first color appeared the MOMENT
 * lifetimeFuel crossed the Stage 1 threshold (500) - the same moment
 * the Rekindle option became available, but NOT the same moment the
 * player actually clicked it. The color was visibly jumping ahead of
 * the player's choice, contradicting the explicit lore framing that
 * crossing this threshold "IS the rekindling event" - in the actual
 * implementation, the two had quietly become independent.
 *
 * Stages 2/3 remain untouched by this cap once it lifts (after the
 * first rekindle, `hasRekindledOnce` is permanently true forever after
 * for that save - WorldState.dwarfCount only ever increases) - they
 * stay exactly what they always were, "the hearth continuing to grow,"
 * not additional rekindling events. Only Stage 1 was ever meant to be
 * gated on the act itself; this helper expresses that by capping
 * EVERYTHING at 0 pre-rekindle (since stage 1 must come before 2 or 3
 * regardless) rather than special-casing just stage 1's transition.
 */
export function capColorStageBeforeFirstRekindle(
  pureFuelStage: ColorStage,
  hasRekindledOnce: boolean
): ColorStage {
  return hasRekindledOnce ? pureFuelStage : COLOR_STAGES[0];
}
