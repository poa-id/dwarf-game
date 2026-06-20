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
// Hub map — the single, fixed, persistent base map.
//
// Unlike a generated dungeon, the Hub is hand-designed: every meaningful
// location (the Hearth, the Forge, the tunnel entrance) sits at a fixed
// coordinate, defined once by us as content, not generated at runtime.
// Progression unlocks pre-existing ZONES of this map rather than
// creating new terrain - the mountain was always there in the dark, the
// dwarf just couldn't see or reach it yet.
// ---------------------------------------------------------------------------

export type ZoneId = "hearth_hall" | "forge_room" | "tunnel_entrance";

export type UnlockCondition =
  | { type: "always" } // unlocked from the very start (e.g. the hearth hall itself)
  | { type: "forge_tier_at_least"; tier: number }
  | { type: "hearth_color_stage_at_least"; stage: number }
  | { type: "lore_flag"; flag: string };

export interface ZoneDefinition {
  id: ZoneId;
  name: string;
  /** Top-left corner + size of this zone's bounding box on the Hub grid. */
  bounds: { col: number; row: number; width: number; height: number };
  unlock: UnlockCondition;
}

/**
 * Per-cell exploration memory - persists on WorldState, since "what the
 * dwarf has seen of his own mountain" is a property of the world, not
 * of any one dwarf's body. A new dwarf benefits from the map his
 * predecessors charted, same as he benefits from their forge upgrades.
 *
 * Stored sparse (only cells ever lit get an entry) rather than as a
 * dense array sized to the whole map - the Hub may be much bigger than
 * any one screen, and most cells will never be visited.
 */
export type ExploredCellMap = Record<string, true>; // key = `${col},${row}`

export function cellKey(col: number, row: number): string {
  return `${col},${row}`;
}

export interface Position {
  col: number;
  row: number;
}

// ---------------------------------------------------------------------------
// Static light sources - torches/lamps. Fixed, hand-placed positions
// (content, like zones), but their LIT STATE is earned through play:
// broken until repaired, then lit forever. A torch's light is weaker
// than the dwarf's own and doesn't move - it represents the mountain
// itself slowly gaining permanent light, distinct from the light the
// dwarf carries with him wherever he goes.
// ---------------------------------------------------------------------------

export type LightSourceId = string;

export interface LightSourceDefinition {
  id: LightSourceId;
  name: string;
  position: Position;
  radius: number;
  /** Resource cost to repair, paid from the Vessel's inventory at the moment of repair. */
  repairCost: Partial<ResourceBag>;
}

/** Which torches have been repaired - persists on WorldState, permanent once lit, like the forge. */
export type LitTorchSet = Record<LightSourceId, true>;

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
  /** Every cell any dwarf has ever lit with his presence - persists forever, like the forge. */
  exploredCells: ExploredCellMap;
  /** Every torch any dwarf has ever repaired - persists forever, like the forge. */
  litTorches: LitTorchSet;
}

// ---------------------------------------------------------------------------
// Vessel state — the current dwarf's body, resets on rekindling
// ---------------------------------------------------------------------------

export interface VesselState {
  skills: Record<SkillId, SkillState>;
  inventory: ResourceBag;
  /** Set true once this dwarf has chosen to rekindle; engine stops accepting actions from him. */
  hasRekindled: boolean;
  /** Where this dwarf's body currently stands on the Hub map. Resets to the hearth on rekindling - the new dwarf wakes at the heart of the mountain, same as every dwarf before him. */
  position: Position;
}

// ---------------------------------------------------------------------------
// Narrator state - tracks what this PLAYER has already heard, separate
// from both World (the mountain) and Vessel (this dwarf's body). See
// the comment on GameState below for why this needs its own category.
// ---------------------------------------------------------------------------

export type NarratorTrigger =
  | "wake_first_ever" // the very first time the game is ever started, period
  | "wake_rekindled" // waking after a rekindling, NOT the first time
  | "mine_first_strike" // the very first successful mining strike of the whole game
  | "mine_strike" // routine successful mining strikes thereafter
  | "level_up" // any skill level up
  | "color_stage_1" // first rekindling's color reward - the biggest narrative beat
  | "color_stage_later" // any color stage beyond the first
  | "torch_repaired"
  | "area_revealed" // stepping into a previously-unexplored area
  | "stranger_arrival";

export interface NarratorState {
  lastShownByTrigger: Partial<Record<NarratorTrigger, string>>;
  firedOnceTriggers: NarratorTrigger[];
}

// ---------------------------------------------------------------------------
// Full save shape
//
// Three categories of state, not two - World (the mountain, persists
// forever) and Vessel (this dwarf's body, resets on rekindling) were
// always distinct, but narrator state is neither: it's "what has this
// PLAYER already heard," independent of which dwarf is currently
// living or what's been built. A few one-time lines (the very first
// waking) must never replay even across many rekindlings, which rules
// out resetting it with the Vessel; but it's not lore or world-history
// either, so it doesn't belong on WorldState. It gets its own slot.
// ---------------------------------------------------------------------------

export interface GameState {
  world: WorldState;
  vessel: VesselState;
  narrator: NarratorState;
  /** Schema version, so future saves can migrate old ones safely. */
  saveVersion: number;
}
