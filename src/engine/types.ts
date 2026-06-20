/**
 * Core domain types for the dwarf game.
 *
 * The central design idea: state splits into two tiers.
 *
 * - WORLD state persists forever. It's everything dwarven hands have built
 *   into the mountain itself: the forge, the tunnels, the hearth's fire.
 *   Rekindling never touches this.
 *
 * - VESSEL state belongs to the current dwarf's body and resets on
 *   rekindling: his personal skill levels, his held inventory. The next
 *   dwarf has not swung this pickaxe yet, even if the pickaxe is a fine one.
 */

// ---------------------------------------------------------------------------
// Skills
// ---------------------------------------------------------------------------

export type SkillId = "mining" | "smithing" | "hearthkeeping";

export type SkillMode = "active" | "idle";

/** A skill's live progress. Always lives on the Vessel except where noted. */
export interface SkillState {
  id: SkillId;
  level: number;
  xp: number;
}

// ---------------------------------------------------------------------------
// Resources
// ---------------------------------------------------------------------------

export type ResourceId = "ore" | "ingot" | "fuel" | "insight";

export type ResourceBag = Record<ResourceId, number>;

// ---------------------------------------------------------------------------
// Hearth / Flame — the idle skill that gates color
// ---------------------------------------------------------------------------

/**
 * The world begins in 2-bit. Each ColorStage is a permanent, one-way
 * threshold the Hearth crosses as it accumulates fuel over time.
 * The FIRST crossing (stage 1) is the rekindling event itself — the
 * current dwarf's sacrifice. Later stages are NOT rekindlings; they are
 * just the world growing brighter as the hearth is tended further.
 */
export interface ColorStage {
  stage: number;
  /** Total fuel the Hearth must have absorbed (lifetime, not current) to unlock this stage. */
  fuelThreshold: number;
  /** Human label for what unlocks, e.g. "First Ember", "Hearthlight", "True Color" */
  label: string;
}

export interface HearthState {
  /** Current banked fuel, consumed/spent over time, NOT the lifetime total. */
  fuel: number;
  /** Lifetime fuel ever absorbed — this is what ColorStage thresholds check against. Never decreases. */
  lifetimeFuel: number;
  /** Highest ColorStage.stage reached so far. 0 = still 2-bit, nothing unlocked yet. */
  colorStage: number;
  /** Timestamp (ms epoch) of the last tick we processed — needed for offline catch-up. */
  lastUpdated: number;
}

// ---------------------------------------------------------------------------
// World state — persists across every rekindling
// ---------------------------------------------------------------------------

export interface WorldState {
  forgeTier: number;
  unlockedMineDepth: number;
  hearth: HearthState;
  insightBanked: number;
  /** How many dwarves have lived and rekindled before the current one. */
  dwarfCount: number;
  loreFlags: string[];
}

// ---------------------------------------------------------------------------
// Vessel state — the current dwarf's body, resets on rekindling
// ---------------------------------------------------------------------------

export interface VesselState {
  skills: Record<SkillId, SkillState>;
  inventory: ResourceBag;
  /** Set true once this dwarf has chosen to rekindle; engine stops accepting actions from him. */
  hasRekindled: boolean;
}

// ---------------------------------------------------------------------------
// Full save shape
// ---------------------------------------------------------------------------

export interface GameState {
  world: WorldState;
  vessel: VesselState;
  /** Schema version, so future saves can migrate old ones safely. */
  saveVersion: number;
}
