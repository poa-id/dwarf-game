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

export type SkillId = "mining" | "smithing" | "hearthkeeping" | "woodcraft";

export type SkillMode = "active" | "idle";

/** A skill's live progress. Always lives on the Vessel except where noted. */
export interface SkillState {
  id: SkillId;
  level: number;
  xp: number;
}

// ---------------------------------------------------------------------------
// Materials - ores, fuels, and (eventually) other raw materials.
//
// This replaces a fixed "ore/ingot/fuel/insight" ResourceBag with a
// flexible map so new tiers of ore or fuel can be added as pure content
// (new MaterialDefinition entries) without touching the data model
// again. Coal is the first FUEL material - mined directly, not a
// smithing byproduct - and is deliberately modeled the same way as ore
// (a MaterialCategory, a tier, a value) since later, rarer fuels are
// expected to matter just as much as later, rarer ores: a purer fuel
// burns hotter, which the smithing system can read off `heatValue`
// to allow forging materials a weaker fire couldn't touch.
// ---------------------------------------------------------------------------

export type MaterialId = string;

export type MaterialCategory = "ore" | "ingot" | "fuel" | "wood" | "currency";

export interface MaterialDefinition {
  id: MaterialId;
  name: string;
  category: MaterialCategory;
  /** Roughly how advanced/rare this material is within its category - higher tiers usually need deeper mine access or higher skill levels. */
  tier: number;
  /** How hot this burns if used as fuel - gates which recipes/hearth needs it can satisfy. Purer/rarer fuels have higher values. Present on "fuel" AND "wood" (wood is real fuel, just weaker/different from coal - not exclusively a construction material). */
  heatValue?: number;
}

export const MATERIALS: Record<MaterialId, MaterialDefinition> = {
  copper_ore: { id: "copper_ore", name: "Copper Ore", category: "ore", tier: 1 },
  iron_ore: { id: "iron_ore", name: "Iron Ore", category: "ore", tier: 2 },
  coal: { id: "coal", name: "Coal", category: "fuel", tier: 1, heatValue: 10 },
  // Charcoal - burned from wood at the Charcoal Kiln (see kiln.ts). Hot
  // enough to clear copper_ingot's minHeatRequired (5) but NOT iron's
  // (10) - a deliberate early-game bootstrap fuel, not a permanent
  // substitute for real coal. coal_seam exists in mining.ts but has no
  // placement on the Hub map yet (see OPEN_QUESTIONS.md) - charcoal is
  // what actually unblocks the vertical slice's first smelt until the
  // real mine exists.
  charcoal: { id: "charcoal", name: "Charcoal", category: "fuel", tier: 1, heatValue: 7 },
  wood: { id: "wood", name: "Cave-Root Wood", category: "wood", tier: 1, heatValue: 4 }, // weaker than coal - burns, but not hot enough for serious smithing
  copper_ingot: { id: "copper_ingot", name: "Copper Ingot", category: "ingot", tier: 1 },
  iron_ingot: { id: "iron_ingot", name: "Iron Ingot", category: "ingot", tier: 2 },
  insight: { id: "insight", name: "Insight", category: "currency", tier: 0 },
};

export function materialDef(id: MaterialId): MaterialDefinition {
  const def = MATERIALS[id];
  if (!def) throw new Error(`Unknown material id: ${id}`);
  return def;
}

/**
 * A flexible bag of materials - any MaterialId can appear as a key.
 * Missing keys mean zero, not undefined - callers should use
 * getMaterialAmount rather than direct indexing to get that default
 * safely (plain `bag[id]` would be `undefined`, not `0`, for a
 * material the player has never picked up).
 */
export type ResourceBag = Partial<Record<MaterialId, number>>;

export function getMaterialAmount(bag: ResourceBag, id: MaterialId): number {
  return bag[id] ?? 0;
}

export function addMaterial(bag: ResourceBag, id: MaterialId, amount: number): ResourceBag {
  return { ...bag, [id]: getMaterialAmount(bag, id) + amount };
}

export function canAffordMaterials(bag: ResourceBag, cost: ResourceBag): boolean {
  return Object.entries(cost).every(([id, amount]) => getMaterialAmount(bag, id) >= (amount ?? 0));
}

export function deductMaterials(bag: ResourceBag, cost: ResourceBag): ResourceBag {
  const updated = { ...bag };
  for (const [id, amount] of Object.entries(cost)) {
    updated[id] = getMaterialAmount(updated, id) - (amount ?? 0);
  }
  return updated;
}

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
  repairCost: ResourceBag;
}

/** Which torches have been repaired - persists on WorldState, permanent once lit, like the forge. */
export type LitTorchSet = Record<LightSourceId, true>;

// ---------------------------------------------------------------------------
// Narag-Bund - "black head" in the dwarves' secret tongue. A coal-beetle
// hauling-beast, found and befriended (not built, not player-named) in
// the dark of the mountain. Once befriended (granted by the Hearth's
// "Friend of Burden" upgrade), he passively hauls a portion of newly-
// gathered fuel materials into the Hearth's reserve, on his own
// real-time rhythm - not tied to player actions, a living creature's
// schedule rather than a mechanical multiplier. He only helps with
// materials/nodes the player has already discovered themselves; he
// shares the dwarf's knowledge of the mountain, not an outsider's.
// ---------------------------------------------------------------------------

export interface CompanionState {
  /** True once the "Friend of Burden" Hearth upgrade has been bought and Narag-Bund is actively helping. */
  befriended: boolean;
  /** Timestamp (ms epoch) of his last haul - needed for real-time interval pacing, same offline-catch-up pattern as the Hearth itself. */
  lastHaulAt: number;
}

// ---------------------------------------------------------------------------
// Tools - smithed gear (metal ingot + wood, see smithing.ts TOOL_RECIPES),
// World-persistent like the Forge/Hearth/litTorches: a dwarf forges a
// pickaxe, and even after he rekindles, the mountain keeps the physical
// tool - the next dwarf picks it right back up. Replaces an earlier,
// simpler design where tool quality was a free, automatic side-effect of
// Forge upgrade tier with no crafting step at all - see
// OPEN_QUESTIONS.md for that history.
// ---------------------------------------------------------------------------

export type ToolSlot = "pickaxe" | "axe";

/**
 * Highest tier of each tool slot ever forged - 0 means "nothing forged
 * yet, bare hands." Storing the tier number (not a ToolId/item) keeps
 * this a direct lookup into TOOL_TIERS_BY_SLOT in smithing.ts, and
 * "forge a better one" naturally supersedes the old tier just by being
 * a bigger number - no separate equip step, matching the explicit
 * design call that one tool per slot is always active automatically.
 */
export type ToolsForgedState = Record<ToolSlot, number>;

// ---------------------------------------------------------------------------
// World state — persists across every rekindling
// ---------------------------------------------------------------------------

export interface WorldState {
  forgeTier: number;
  /** Mirrors forgeTier's pattern - tier 0 is "tended by hand only" (manual stoking, see hearth.ts stokeHearth), tier 1+ unlocks passive auto-tending (tickHearth's continuous draw) and beyond that, real Hearth upgrades. Unlike the Forge, there is no "broken/rubble" state to repair first - the Hearth already burns as a bare ember from the start (see DESIGN.md §4), this tier only gates AUTOMATION, not basic function. */
  hearthTier: number;
  /** The mountain's own fuel stockpile - distinct from the dwarf's personal inventory. The player can manually stoke material INTO this reserve (banking it for later/for Narag-Bund) as an alternative to stoking the fire directly. Once Narag-Bund is befriended (hearthTier >= 1), he hauls a portion of newly-gathered fuel here automatically. The Hearth's passive tick draws from THIS pool, never directly from personal inventory. */
  fuelReserve: ResourceBag;
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
  /** Depletion progress per placed ore vein instance (keyed by OreVeinPlacement.id) - the mountain remembers how worked-over a vein is, regardless of which dwarf is currently swinging the pick. */
  veinDepletion: Record<string, { totalYielded: number }>;
  /** Same idea as veinDepletion, but for wood node placements. */
  woodDepletion: Record<string, { totalYielded: number }>;
  /** Narag-Bund's own state - see CompanionState above. */
  companion: CompanionState;
  /** Highest tier ever forged per tool slot - see ToolsForgedState above. */
  toolsForged: ToolsForgedState;
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
  | "stranger_arrival"
  | "companion_befriended"; // Narag-Bund - the first and only thing in this world that chooses to stay

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
