import type { SkillState, ResourceBag, MaterialId } from "./types";
import { addMaterial } from "./types";
import { levelForXp } from "./xpCurve";

/**
 * A gatherable node - the generic shape behind both Mining's rock veins
 * and Woodcraft's wood formations (and potentially future gathering
 * skills). Originally lived only in mining.ts as "RockNode"; extracted
 * here once Woodcraft needed the exact same shape, rather than
 * duplicating the mechanic. mining.ts now re-exports a RockNode alias
 * for this, so existing code/tests didn't need to change.
 */
export interface GatherableNode {
  id: string;
  name: string;
  /** Which material this node yields - see MATERIALS in types.ts. */
  materialId: MaterialId;
  /** Minimum skill level (whichever skill governs this node) to attempt it at all. */
  requiredLevel: number;
  /** Base XP per successful strike, before any modifiers. */
  baseXp: number;
  /** Material yielded per successful strike, before any modifiers. */
  baseYield: number;
  /** 0-1, chance a strike actually lands material+xp vs "you swing and miss" */
  baseSuccessChance: number;
  /**
   * Total material this node can ever yield before it's exhausted, or
   * null for nodes that never deplete. This is the node's STARTING
   * richness, not its current remaining amount - see
   * NodeDepletionState for the latter.
   */
  totalYieldCapacity: number | null;
}

// ---------------------------------------------------------------------------
// Depletion - INSTANCE state for a specific node placed in the world,
// separate from GatherableNode's static content definition above. Two
// placed nodes sharing one GatherableNode definition each track
// depletion independently.
// ---------------------------------------------------------------------------

export interface NodeDepletionState {
  /** How much this specific node instance has yielded so far, lifetime. */
  totalYielded: number;
}

export function createFreshDepletionState(): NodeDepletionState {
  return { totalYielded: 0 };
}

export function remainingYield(node: GatherableNode, depletion: NodeDepletionState): number | null {
  if (node.totalYieldCapacity === null) return null; // never depletes
  return Math.max(0, node.totalYieldCapacity - depletion.totalYielded);
}

export function isExhausted(node: GatherableNode, depletion: NodeDepletionState): boolean {
  const remaining = remainingYield(node, depletion);
  return remaining !== null && remaining <= 0;
}

/**
 * A tool tier that boosts gathering - the generic shape behind both
 * Mining's pickaxes and Woodcraft's axes. Tool quality now comes from
 * actually SMITHING the tool (see smithing.ts's ToolRecipe/
 * attemptForgeTool) - `tier` matches ToolRecipe.tier exactly, and the
 * dwarf's currently-equipped tier for a slot lives in
 * WorldState.toolsForged (persists across rekindling, like the Forge
 * itself). This replaced an earlier design where tool quality was a
 * free, automatic side-effect of Forge UPGRADE tier with no crafting
 * step at all - see OPEN_QUESTIONS.md for that history.
 */
export interface ToolTier {
  tier: number;
  successChanceBonus: number;
  yieldMultiplier: number;
  name: string;
}

/** Looks up the ToolTier matching the highest tier actually forged for a slot (0 = bare hands, always present as the first entry in every tiers array). */
export function bestAvailableTool(tiers: ToolTier[], forgedTier: number): ToolTier {
  const eligible = tiers.filter((t) => t.tier <= forgedTier);
  return eligible[eligible.length - 1];
}

export interface GatherStrikeResult {
  success: boolean;
  xpGained: number;
  materialId: MaterialId;
  amountGained: number;
  newLevel: number;
  leveledUp: boolean;
  newDepletion: NodeDepletionState;
}

/**
 * Attempt one strike against a gatherable node. Pure function — caller
 * supplies a random roll so this stays deterministic and testable;
 * production code passes Math.random(), tests pass fixed values.
 *
 * Throws if level or exhaustion preconditions aren't met - same
 * defensive pattern throughout the engine; the caller (UI layer) is
 * responsible for not offering an unavailable/exhausted node in the
 * first place, this is a defensive invariant, not UX.
 */
export function attemptGatherStrike(
  node: GatherableNode,
  skill: SkillState,
  tool: ToolTier,
  depletion: NodeDepletionState,
  roll: number
): GatherStrikeResult {
  if (skill.level < node.requiredLevel) {
    throw new Error(`Level ${skill.level} is below required ${node.requiredLevel} for ${node.id}`);
  }

  if (isExhausted(node, depletion)) {
    throw new Error(`Node ${node.id} is already exhausted`);
  }

  const successChance = Math.min(1, node.baseSuccessChance + tool.successChanceBonus);
  const success = roll < successChance;

  const oldLevel = skill.level;

  if (!success) {
    return {
      success: false,
      xpGained: 0,
      materialId: node.materialId,
      amountGained: 0,
      newLevel: oldLevel,
      leveledUp: false,
      newDepletion: depletion,
    };
  }

  const xpGained = node.baseXp;
  const rawYield = Math.round(node.baseYield * tool.yieldMultiplier);
  // Cap the actual yield at whatever remains, so a lucky high-yield
  // strike on an almost-exhausted node can't pull MORE material out of
  // it than it actually has left.
  const remaining = remainingYield(node, depletion);
  const amountGained = remaining === null ? rawYield : Math.min(rawYield, remaining);

  const newXp = skill.xp + xpGained;
  const newLevel = levelForXp(newXp);

  return {
    success: true,
    xpGained,
    materialId: node.materialId,
    amountGained,
    newLevel,
    leveledUp: newLevel > oldLevel,
    newDepletion: { totalYielded: depletion.totalYielded + amountGained },
  };
}

export function applyGatherResult(inventory: ResourceBag, result: GatherStrikeResult): ResourceBag {
  if (!result.success || result.amountGained === 0) return inventory;
  return addMaterial(inventory, result.materialId, result.amountGained);
}
