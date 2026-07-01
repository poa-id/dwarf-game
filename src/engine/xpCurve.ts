/**
 * XP curve.
 *
 * Design intent: dwarves aren't naturally gifted, they're persistent.
 * A pure exponential curve (like RuneScape's) rewards obsessive grinding
 * bursts. We want something that still gets meaningfully harder at high
 * levels (mastery should be rare and earned) but doesn't punish steady,
 * modest play relative to binge play. So: polynomial growth, not
 * exponential. Tunable via EXPONENT below.
 *
 * xpForLevel(n) = BASE * n ^ EXPONENT
 *
 * This is intentionally simple and intentionally NOT RuneScape's table.
 * It's easy to tune two numbers and feel the difference rather than
 * tweaking a hardcoded 99-row table.
 */

const BASE_XP = 50;
const EXPONENT = 2.1; // >2 = superlinear difficulty curve, but gentler than exponential
const MAX_LEVEL = 99; // a nod to the influence, not a hard requirement

/** XP required to go from level n to level n+1. */
export function xpForLevel(level: number): number {
  if (level < 1) throw new Error(`level must be >= 1, got ${level}`);
  return Math.round(BASE_XP * Math.pow(level, EXPONENT));
}

/** Total cumulative XP required to REACH a given level from level 1. */
export function cumulativeXpForLevel(level: number): number {
  if (level < 1) throw new Error(`level must be >= 1, got ${level}`);
  let total = 0;
  for (let l = 1; l < level; l++) {
    total += xpForLevel(l);
  }
  return total;
}

/** Given a total XP amount, what level does that correspond to? */
export function levelForXp(totalXp: number): number {
  if (totalXp < 0) throw new Error(`totalXp must be >= 0, got ${totalXp}`);
  let level = 1;
  while (level < MAX_LEVEL && cumulativeXpForLevel(level + 1) <= totalXp) {
    level++;
  }
  return level;
}

/** XP earned so far *within* the current level (for progress bars). */
export function xpIntoCurrentLevel(totalXp: number): number {
  const level = levelForXp(totalXp);
  return totalXp - cumulativeXpForLevel(level);
}

/** XP needed to go from the current level to the next (for progress bars). */
export function xpNeededForNextLevel(totalXp: number): number {
  const level = levelForXp(totalXp);
  if (level >= MAX_LEVEL) return 0;
  return xpForLevel(level);
}

export { MAX_LEVEL };

/**
 * The "the Mountain has learned" bonus (added 2026-06-23, explicit
 * project direction): a fresh dwarf gains skill XP meaningfully faster
 * than the very first dwarf did, scaling with how many dwarves have
 * come before (WorldState.dwarfCount). This is the counterpart to
 * rekindle.ts's diminishing-returns Insight penalty - that punishes
 * rekindling too SOON; this rewards having genuinely progressed,
 * permanently, for every dwarf after the first. Deliberately a flat
 * multiplier on raw XP gain (not a curve change in xpForLevel above)
 * so individual recipe/action balance stays untouched - this is a
 * single, separate lever.
 *
 * +15% per prior dwarf, capped at 3x (dwarfCount 0 = first dwarf ever,
 * multiplier exactly 1.0, unchanged) - capped deliberately so a
 * deeply-rekindled save doesn't trivialize leveling entirely; mastery
 * should stay rare and earned even late, per this file's own stated
 * design intent.
 *
 * This is the SINGLE place this multiplier is computed - every XP-
 * granting call site (mining/woodcraft via gathering.ts, smithing
 * ingots/tools, the charcoal kiln) should round its baseXp through
 * this function before adding it to a skill's xp, rather than each
 * site reimplementing the formula.
 */
/**
 * Combines the dwarfCount-based bonus with the Smelter's permanent
 * True-metal XP perk (smelter.ts's xpPerkBonus) into ONE multiplier,
 * both terms additive, both capped together at 3x. Added 2026-06-23 -
 * extends the original dwarfCount-only multiplier rather than
 * introducing a second, separately-applied bonus, so spending
 * True-metals can't blow past the same "mastery should stay rare and
 * earned even late" ceiling the dwarfCount system already enforces.
 * `trueMetalXpBonus` defaults to 0 (no perk purchased, or caller
 * hasn't been updated to pass it) - every real call site should pass
 * the actual value from `smelter.ts`'s `xpPerkBonus(world.trueMetalSpentOnXpPerk)`.
 */
export function applyDwarfCountXpMultiplier(
  baseXp: number,
  dwarfCount: number,
  trueMetalXpBonus: number = 0
): number {
  const multiplier = Math.min(3, 1 + dwarfCount * 0.15 + trueMetalXpBonus);
  return Math.round(baseXp * multiplier);
}

/**
 * Converts an XP grant into Insight - fixing a real gap found in
 * playtesting (2026-06-23): LORE.md always described Insight as
 * "earned BOTH from Hearth-tending (slow trickle) AND from rekindling
 * itself," but the only implementation that ever existed was
 * rekindle.ts's lump-sum payout. A player who hadn't rekindled
 * recently (or rekindled "too soon" and hit the diminishing-returns
 * penalty) had no way to earn Insight AT ALL - directly contradicting
 * "Insight is a synonym for experience, used as a resource," which
 * should never be fully gated behind one specific, occasional action.
 *
 * Per explicit project direction: every XP-granting action across
 * every skill ALSO grants Insight, as 5% of that action's XP - using
 * the ALREADY-MULTIPLIED xp value (post dwarfCount/True-metal-perk
 * bonus), so Insight scales up right alongside however fast the
 * player is currently leveling, consistent with "Insight is a
 * synonym for experience."
 *
 * Deliberately returns a FRACTIONAL value, not rounded - most common
 * actions grant well under 20 XP, and 5% of that rounds to 0 for many
 * of the cheapest, most frequent actions (copper strikes, charcoal
 * burns, copper smelts) - which would silently grant nothing despite
 * the explicit ask that EVERY action contributes. WorldState.insightBanked
 * accumulates this fractional value directly (same precedent as
 * hearth.ts's HEARTHKEEPING_XP_PER_FUEL_VALUE); only the UI DISPLAY
 * rounds for presentation, the underlying stored value never does.
 *
 * Rekindling's own lump-sum Insight payout (rekindle.ts's
 * calculateRekindleInsight) is UNCHANGED and stacks on top of
 * whatever was earned passively along the way via this function - per
 * explicit direction, rekindling should still feel like a real event,
 * not be made redundant by the per-action trickle.
 */
export function insightFromXp(multipliedXp: number): number {
  return multipliedXp * 0.05;
}

/**
 * The Archive's permanent Insight bonus. Returns 1.0 normally, 1.2
 * when the archive is "restored", 1.25 when "masterwork". Applied
 * multiplicatively to all Insight earned — the mountain's own records
 * make every dwarf more effective.
 */
export function archiveInsightBonus(roomStates: Record<string, string>): number {
  const stage = roomStates["the_archive"] ?? "ruined";
  if (stage === "masterwork") return 1.25;
  if (stage === "restored") return 1.2;
  return 1.0;
}
