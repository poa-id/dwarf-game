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

export type SkillId = "mining" | "smithing" | "hearthkeeping" | "woodcraft" | "tinkering" | "herblore" | "brewing";

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

export type MaterialCategory = "ore" | "ingot" | "fuel" | "wood" | "currency" | "true_metal" | "gem" | "building";

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
  // True-metals - the Smelter's rare purification output (see
  // smelter.ts), added 2026-06-23. "True-X" was always a NAMING
  // PATTERN, not a literal material - each metal gets its own True
  // variant (True Copper now; True Iron, True Silver etc. once those
  // metals are real, reachable content - NOT yet added, since iron
  // itself is barely reachable and the Smelter's own build cost was
  // deliberately kept iron-free to avoid a circular dependency). A
  // permanent, account-wide-upgrade currency, separate from Insight -
  // Insight comes from rekindling (a per-dwarf sacrifice), True-metals
  // come from a rare per-smelt CHANCE (see SMELTER_TIERS),
  // independent of any dwarf dying. category: "true_metal" rather than
  // folding into "ingot" - these are never used as fuel or smithing
  // input, only as a perk-tree currency.
  true_copper: { id: "true_copper", name: "True Copper", category: "true_metal", tier: 1 },
  true_iron:   { id: "true_iron",   name: "True Iron",   category: "true_metal", tier: 2 },
  insight: { id: "insight", name: "Insight", category: "currency", tier: 0 },
  // Gems - added 2026-06-23 alongside the new Tinkering skill and
  // Gemcutting station (gemcutting.ts). Rough gems drop rarely from
  // mining strikes (see gathering.ts's GemDrop), one type per ore vein
  // tier - copper_vein -> quartz (common), iron_vein -> garnet
  // (uncommon), deepstone -> amethyst (rare); coal_seam deliberately
  // drops none, since coal isn't gem-bearing rock thematically. Cut
  // gems are the Gemcutting station's refined output, the currency
  // spent on Tinkering's own self-reinforcing perk tree (boosts gem-
  // drop chance AND cutting success) - a third permanent-multiplier
  // track, alongside the Smelter's XP perk and the Hearth's yield perk,
  // each with its own currency and each affecting a different number.
  rough_quartz: { id: "rough_quartz", name: "Rough Quartz", category: "gem", tier: 1 },
  cut_quartz: { id: "cut_quartz", name: "Cut Quartz", category: "gem", tier: 1 },
  rough_garnet: { id: "rough_garnet", name: "Rough Garnet", category: "gem", tier: 2 },
  cut_garnet: { id: "cut_garnet", name: "Cut Garnet", category: "gem", tier: 2 },
  rough_amethyst: { id: "rough_amethyst", name: "Rough Amethyst", category: "gem", tier: 3 },
  cut_amethyst: { id: "cut_amethyst", name: "Cut Amethyst", category: "gem", tier: 3 },

  // ── Tier 3: Deepstone ─────────────────────────────────────────────────────
  // Mined from the Deepstone Seam at Mining lvl 20. Dense, dark, holds heat
  // far longer than iron. Smelted into deepstone ingots at the Forge once
  // the Deep Foundry (NW room) is cleared. Required to build the iron drill
  // and unlock tier 3 tool recipes.
  deepstone_ore: { id: "deepstone_ore", name: "Deepstone Ore", category: "ore", tier: 3 },
  deepstone_ingot: { id: "deepstone_ingot", name: "Deepstone Ingot", category: "ingot", tier: 3 },
  true_deepstone: { id: "true_deepstone", name: "True Deepstone", category: "true_metal", tier: 3 },

  // ── Tier 4: Starstone (future — mineshaft depth 2) ────────────────────────
  // Placeholder only. No smelt recipe, no tool recipe, no vein placement yet.
  // Added now so the MaterialId union is stable.
  starstone_ore: { id: "starstone_ore", name: "Starstone Ore", category: "ore", tier: 4 },
  starstone_ingot: { id: "starstone_ingot", name: "Starstone Ingot", category: "ingot", tier: 4 },

  // ── Garden Room materials ─────────────────────────────────────────────────
  // Stoneshroom — a fast-growing cave fungus, harvested from the Garden once
  // the mushroom patch is seeded. Burns hotter than wood but cooler than coal.
  // Primary use: Hearthsap production and a trade good.
  stoneshroom: { id: "stoneshroom", name: "Stoneshroom", category: "fuel", tier: 2, heatValue: 6 },
  // Hearthsap — rendered from stoneshrooms at the Kiln. Burns intensely hot;
  // the only fuel capable of smelting Deepstone ore. Scarce by design.
  hearthsap: { id: "hearthsap", name: "Hearthsap", category: "fuel", tier: 3, heatValue: 20 },
  // Ironwood — from ancient seeds found in the Garden's sealed seed chest.
  // Extremely hard, used for tier 3 tool handles. Grows slowly (30 min/cycle).
  ironwood: { id: "ironwood", name: "Ironwood", category: "wood", tier: 3 },
  // Gemwood - third rung of the wood ladder (Cave-Root -> Ironwood -> Gemwood),
  // grown from gemstone trees. Tiers 4-6 (Stonewood, Emberwood, Voidwood) are
  // designed but deferred - see OPEN_QUESTIONS.md "Deep Tree Grove". Numeric
  // `tier` here is cosmetic/display only, not read by any gating logic (unlike
  // ironwood's `tier: 3`, which predates this ladder and doesn't line up
  // cleanly - kept as-is rather than renumbered, to avoid an unnecessary
  // churn edit to an already-shipped material).
  gemwood: { id: "gemwood", name: "Gemwood", category: "wood", tier: 4 },
  // Wood_planks - the Sawmill's output (2026-07-03). category "building"
  // is a new category, first material of its kind - a general
  // construction resource, distinct from raw "wood" (a wood category
  // material burned/carved) or any ingot. No consumers yet - see
  // sawmill.ts's doc comment and OPEN_QUESTIONS.md.
  wood_planks: { id: "wood_planks", name: "Wood Planks", category: "building", tier: 1 },
  // Ancient Seed — rare drop from the root tangle or found in the seed chest.
  // Planted in the Garden to grow Ironwood trees. One-time use.
  ancient_seed: { id: "ancient_seed", name: "Ancient Seed", category: "wood", tier: 2 },
  stoneshroom_spore: { id: "stoneshroom_spore", name: "Stoneshroom Spore", category: "wood", tier: 1 },
  cave_fern_spore: { id: "cave_fern_spore", name: "Cave Fern Spore", category: "wood", tier: 1 },
  ancient_seed_rare: { id: "ancient_seed_rare", name: "Ancient Heartwood Seed", category: "wood", tier: 3 },

  // ── Trade goods ───────────────────────────────────────────────────────────
  // Cut gems double as trade goods at the Trade Hall (South room) once
  // the merchant post is restored. No separate material needed — gems already
  // exist; trade_manifest tracks what's been offered.
  // trade_credit: a record of trade completed — not held in inventory,
  // tracked separately in WorldState.tradeLedger (future).
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
  /** If set, the restoration score must ALSO reach this threshold (stages 4+). */
  restorationThreshold?: number;
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

export type ZoneId =
  | "central_hall"
  | "forge_room"
  | "mine_room"
  | "garden_room"
  | "tinkering_room"
  | "sealed_north"
  | "sealed_south"
  | "sealed_east"
  | "sealed_northwest";

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

  /**
   * Player-placed torches — mounted on walls anywhere in the mountain.
   * Key is "col,row", value is whether the torch has been lit.
   * This is the seed of the furniture/decoration engine: the same pattern
   * (place → light → persistent) extends to other objects.
   * Torches cost 1 wood + 1 coal to place, and are lit with copper_ingot
   * the same as corridor torches. Radius 3 — same as installed torches.
   */
  placedTorches: Record<string, boolean>;
  /** Depletion progress per placed ore vein instance (keyed by OreVeinPlacement.id) - the mountain remembers how worked-over a vein is, regardless of which dwarf is currently swinging the pick. */
  veinDepletion: Record<string, { totalYielded: number }>;
  /** Same idea as veinDepletion, but for wood node placements. */
  woodDepletion: Record<string, { totalYielded: number }>;
  /** Automated drills, keyed by OreVeinPlacement.id. Only present once a drill has been built. */
  drills: Record<string, import("./drill").DrillState>;

  /**
   * The Mine Shaft — an independent structure that unlocks deeper material
   * tiers without needing new rooms. Each depth level makes new veins
   * accessible in the existing mine room.
   *
   * depth 0: unrestored (broken shaft, no access)
   * depth 1: shaft repaired — surface level (copper, iron, coal, deepstone accessible)
   * depth 2: First Deep — starstone veins unlocked
   * depth 3: Second Deep — future tiers
   */
  mineshaftDepth: number;

  /** Smelting engines, keyed by SmeltingEngineDef.id. Only present once built. */
  smeltingEngines: Record<string, import("./smeltingEngine").SmeltingEngineState>;

  /**
   * Whether the Mountain Console has been awakened. This is the FIRST
   * unlock in the game — before the forge, before mining. Walking to the
   * console and pressing F awakens it. From that moment, the production
   * metrics panel exists and the mountain begins tracking its own state.
   *
   * Lore: the console is operated by the spirit of past dwarves.
   * The mountain keeps the whispers of every life that worked it.
   */
  consoleAwakened: boolean;

  /**
   * Permanent production multiplier earned by rekindling. Each rekindling
   * (dwarfCount increment) adds 5% to ore yield and smelt yield, capped at
   * 50% (+10 rekindlings). This is the "ladder climbing" effect from idle
   * game design — each life through the mountain is meaningfully faster
   * than the last, making the player feel the accumulation of dwarven
   * memory. Applied in yieldCurve.ts alongside the yield perk.
   */
  rekindleMultiplier: number;
  /**
   * Room restoration states, keyed by room ID (from rooms.ts).
   * Absent key = room not yet interacted with (defaults to "ruined").
   */
  roomStates: Record<string, import("./rooms").RoomStage>;
  /**
   * Garden planter slots — individual plants with growth stages.
   * Each slot is independently unlocked; slot 0 is always available.
   * Seeds are consumable; must replant after each harvest.
   */
  gardenSlots: import("./garden").PlanterSlot[];
  /**
   * Shared ore stockpile — drills drain into this automatically once
   * the stockpile_room is at "cleared" stage or above.
   */
  stockpileOre: Record<string, number>;
  /** Timestamp of last merchant visit to the Trade Hall. 0 = never. */
  lastMerchantAt: number;
  /** Narag-Bund's own state - see CompanionState above. */
  companion: CompanionState;
  /** Highest tier ever forged per tool slot - see ToolsForgedState above. */
  toolsForged: ToolsForgedState;
  /**
   * hearth.lifetimeFuel's value AT THE MOMENT of the most recent
   * rekindle (0 if no dwarf has ever rekindled yet). Used to measure
   * real growth SINCE the last rekindle, not just "are we currently
   * above the threshold" - lifetimeFuel never decreases, so without
   * this, a player could rekindle again the instant they're allowed to
   * and again immediately after that, since the raw threshold stays
   * permanently cleared. See rekindle.ts's calculateRekindleInsight for
   * how this feeds the diminishing-returns penalty on rekindling too
   * soon after the last one (2026-06-23, explicit design call: each
   * rekindle should feel meaningful, not spammable for marginal gains).
   */
  lifetimeFuelAtLastRekindle: number;
  /**
   * The Smelter - a Forge Room addon (see smelter.ts), built once
   * (Insight + materials, like a Hearth/Forge upgrade) for a real,
   * repeatable Smithing XP/resource sink: purifying common ingots into
   * rare True-metals at a real, low chance. `smelterBuilt` gates
   * whether the room/action exists at all; `smelterTier` is which of
   * SMELTER_TIERS' purification-chance upgrades has been bought
   * (0 = base 0.05% chance, built but unupgraded).
   */
  smelterBuilt: boolean;
  smelterTier: number;
  /**
   * The Sawmill - a Garden Room addon (see sawmill.ts), built once
   * (Insight + materials, mirroring the Smelter's pattern) for a
   * repeatable Woodcraft sink: wood -> wood_planks. No upgrade tiers
   * yet (unlike smelterTier) - just a single built/not-built flag for now.
   */
  sawmillBuilt: boolean;
  turbineBuilt: boolean;
  /** Unlocked via Insight spend (500) once iron ingots are in inventory.
   *  Separate from smelterTier — each metal has its own tier track. */
  ironPurifyingUnlocked: boolean;
  ironSmelterTier: number;
  /**
   * How many True-metals (any type, see TRUE_METAL_PERK_TIERS in
   * smelter.ts) have been permanently spent on the Mountain's global
   * XP perk tree - NOT a count of how many are currently held (that
   * lives in inventory like any other material). Tracked separately
   * because the perk tree's tiers are cumulative-spend thresholds
   * (spend 1 total -> tier 1, spend 3 total -> tier 2, etc.), not a
   * one-time purchase like Forge/Hearth upgrades.
   */
  trueMetalSpentOnXpPerk: number;
  /**
   * The Hearth's yield-multiplier perk tree (added 2026-06-23) - a
   * SEPARATE running total from trueMetalSpentOnXpPerk above, even
   * though both spend the same True-metal currency. The player
   * allocates each True-metal independently between "level faster"
   * (Smelter's tree) and "yield more per action" (this one) - two
   * genuinely different perks competing for the same limited pool,
   * by explicit design. See hearth.ts's YIELD_PERK_TIERS.
   */
  trueMetalSpentOnYieldPerk: number;
  /**
   * The Gemcutting station (gemcutting.ts) - built once like the
   * Smelter, for Insight + materials. gemcuttingTier raises BOTH the
   * raw gem drop chance (gathering.ts) AND the cutting success chance
   * - a single tier track governs both, gated by what's AVAILABLE at
   * Tinkering's current skill level (better tools/perks unlock as the
   * skill grows), separate again from cutGemsSpentOnPerk, which tracks
   * the cut-gem currency spent on Tinkering's own self-reinforcing
   * perk tree (further drop-chance/cutting-success boosts on top of
   * the station's own tier).
   */
  gemcuttingBuilt: boolean;
  gemcuttingTier: number;
  cutGemsSpentOnPerk: number;
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
  | "wood_first_strike" // the very first successful wood-cutting strike of the whole game (added 2026-06-23 - Woodcraft previously had no narrator voice at all)
  | "wood_strike" // routine successful wood-cutting strikes thereafter
  | "gem_found" // a rare bonus gem dropped from a mining strike (added 2026-06-23, alongside the Gemcutting station) - distinct from routine mine_strike, since this is meant to feel like a real event
  | "level_up" // any skill level up
  | "color_stage_1" // first rekindling's color reward - the biggest narrative beat
  | "color_stage_later" // any color stage beyond the first
  | "torch_repaired"
  | "area_revealed" // stepping into a previously-unexplored area
  | "stranger_arrival"
  | "companion_befriended" // Narag-Bund - the first and only thing in this world that chooses to stay
  | "console_awakened" // The Mountain Console wakes — the mountain remembers itself
  | "forge_repaired" // The forge is repaired for the first time (was a direct showNarratorToast call before 2026-07-05, moved into the standard narrate() trigger system when forge repair moved from a bespoke hotkey into the contextual menu)
  | "merchant_arrived" // First merchant arrives at the Trade Hall
  | "merchant_trade";  // A trade completed at the Trade Hall

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
