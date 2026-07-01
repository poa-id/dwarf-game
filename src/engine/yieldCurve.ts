/**
 * The single shared function for applying the Hearth's global yield
 * perk (hearth.ts's YIELD_PERK_TIERS/yieldPerkBonus) on top of
 * whatever yield a specific action already produces.
 *
 * Also applies the rekindle multiplier — permanent bonus earned across
 * all lives (5% per rekindle, max 50%). Both stack additively.
 */

const YIELD_MULTIPLIER_CAP = 3;

/**
 * Applies the Hearth's global yield perk AND the rekindle multiplier
 * to an already-computed base yield amount. Both stack additively
 * before the cap.
 *
 * `rekindleMultiplier` is the permanent bonus earned across all
 * rekindlings. The mountain remembers every dwarf who worked it —
 * each life makes future lives measurably more effective.
 */
export function applyHearthYieldBonus(
  baseAmount: number,
  hearthYieldBonus: number,
  rekindleMultiplier: number = 0
): number {
  const multiplier = Math.min(YIELD_MULTIPLIER_CAP, 1 + hearthYieldBonus + rekindleMultiplier);
  return Math.round(baseAmount * multiplier);
}
