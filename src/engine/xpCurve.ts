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
export function applyDwarfCountXpMultiplier(baseXp: number, dwarfCount: number): number {
  const multiplier = Math.min(3, 1 + dwarfCount * 0.15);
  return Math.round(baseXp * multiplier);
}
