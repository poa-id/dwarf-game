/**
 * The single shared function for applying the Hearth's global yield
 * perk (hearth.ts's YIELD_PERK_TIERS/yieldPerkBonus) on top of
 * whatever yield a specific action already produces. Added 2026-06-23
 * per explicit project direction: a permanent, GLOBAL yield multiplier
 * - every action, any skill - funded by True-metals, additive with
 * the existing tool-based yieldMultiplier (gathering.ts's ToolTier),
 * "applied everywhere uniformly."
 *
 * This is intentionally a SEPARATE module from xpCurve.ts (which has
 * its own, structurally similar but conceptually distinct
 * applyDwarfCountXpMultiplier) - yield (how much you get) and XP (how
 * fast you level) are different numbers with different perk trees and
 * different currencies-spent-tracking, even though both ultimately
 * read as "additive bonus, capped, rounded." Keeping them in separate
 * files makes that distinction obvious at a glance rather than
 * overloading one "multiplier" file with two unrelated concepts.
 *
 * Mining/Woodcraft already had their OWN yield multiplier baked into
 * ToolTier before this existed - this function does NOT replace that,
 * it adds the Hearth's perk ON TOP of whatever the action already
 * computed (tool multiplier included, for gathering; flat 1x for
 * Smithing/Kiln, which had no yield variance at all before this).
 */

const YIELD_MULTIPLIER_CAP = 3; // same ceiling as the XP multiplier (xpCurve.ts) - "mastery should stay rare and earned even late" applies to yield too, not just leveling speed

/**
 * Applies the Hearth's global yield perk to an already-computed base
 * yield amount. `baseAmount` should already include any OTHER
 * multiplier the action has (e.g. gathering.ts's tool yieldMultiplier
 * is applied BEFORE this function runs, not by this function) -
 * `hearthYieldBonus` here is purely the ADDITIONAL Hearth-perk bonus on
 * top of that, additive, capped at YIELD_MULTIPLIER_CAP, then rounded
 * (yields are always whole units, never fractional).
 */
export function applyHearthYieldBonus(baseAmount: number, hearthYieldBonus: number): number {
  const multiplier = Math.min(YIELD_MULTIPLIER_CAP, 1 + hearthYieldBonus);
  return Math.round(baseAmount * multiplier);
}
