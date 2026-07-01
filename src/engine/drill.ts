import type { ResourceBag, MaterialId } from "./types";
import { getMaterialAmount, deductMaterials, addMaterial, canAffordMaterials } from "./types";

/**
 * Automated mining drills - the first idle mechanic beyond Narag-Bund's
 * hauling. One drill per ore node, unlocked when the player reaches the
 * NEXT metal tier (you need iron to build a copper drill - iron is what
 * makes the tooling possible). Runs a fixed cycle: consumes coal from
 * its own buffer, produces ore into its own buffer, stops when either
 * runs out.
 *
 * Cohesion intent: drills connect to the Hearth (coal is also its fuel),
 * to Narag-Bund (future: he hauls coal to drills and ore to stockpile),
 * to the Smelter (ore → ingots → drill upgrades), and eventually to a
 * Dwarven Console NPC that monitors all drills centrally. Nothing is
 * disconnected - it's all one mountain.
 */

// ---------------------------------------------------------------------------
// Drill state
// ---------------------------------------------------------------------------

export interface DrillState {
  /** 0 = not built. 1/2/3 = upgrade tier. */
  tier: number;
  /** Coal buffer - drill draws from this each cycle. */
  coalBuffer: number;
  /** Ore buffer - accumulates here until player/NPC collects. */
  oreBuffer: number;
  /** Timestamp (ms) of last completed cycle. 0 = never run. */
  lastCycleAt: number;
  /** Upgraded coal buffer capacity. Default DRILL_COAL_BUFFER_MAX. */
  coalBufferMax: number;
  /** Upgraded ore buffer capacity. Default DRILL_ORE_BUFFER_MAX. */
  oreBufferMax: number;
  /** Which buffer upgrade tier has been purchased (0 = none, 1/2/3 = upgraded) */
  bufferTier: number;
}

export const DRILL_COAL_BUFFER_MAX = 20;
export const DRILL_ORE_BUFFER_MAX = 20;

/** Buffer upgrade tiers — copper/iron ingot sinks to increase autonomy */
export interface DrillBufferUpgrade {
  tier: number;
  coalBufferMax: number;
  oreBufferMax: number;
  /** Cost in ingots of the PREVIOUS metal tier — copper for copper drills, iron for iron drills */
  cost: Record<string, number>;
  label: string;
}

export const COPPER_DRILL_BUFFER_UPGRADES: DrillBufferUpgrade[] = [
  { tier: 1, coalBufferMax: 40,  oreBufferMax: 40,  cost: { copper_ingot: 10 },               label: "Reinforced Hoppers" },
  { tier: 2, coalBufferMax: 80,  oreBufferMax: 80,  cost: { copper_ingot: 20, iron_ingot: 5 }, label: "Iron-Banded Hoppers" },
  { tier: 3, coalBufferMax: 160, oreBufferMax: 160, cost: { iron_ingot: 15 },                  label: "Deep Reservoir" },
];

export const IRON_DRILL_BUFFER_UPGRADES: DrillBufferUpgrade[] = [
  { tier: 1, coalBufferMax: 40,  oreBufferMax: 40,  cost: { iron_ingot: 10 },                   label: "Iron Hoppers" },
  { tier: 2, coalBufferMax: 80,  oreBufferMax: 80,  cost: { iron_ingot: 20, deepstone_ingot: 2 }, label: "Deep Hoppers" },
  { tier: 3, coalBufferMax: 160, oreBufferMax: 160, cost: { deepstone_ingot: 8 },                label: "Deepstone Reservoir" },
];

export function drillBufferUpgradesFor(drillId: string): DrillBufferUpgrade[] {
  if (drillId === "iron_drill") return IRON_DRILL_BUFFER_UPGRADES;
  return COPPER_DRILL_BUFFER_UPGRADES;
}

export function nextBufferUpgrade(drillId: string, currentBufferTier: number): DrillBufferUpgrade | null {
  const upgrades = drillBufferUpgradesFor(drillId);
  return upgrades.find(u => u.tier === currentBufferTier + 1) ?? null;
}

export function createFreshDrillState(): DrillState {
  return { tier: 1, coalBuffer: 0, oreBuffer: 0, lastCycleAt: 0, coalBufferMax: DRILL_COAL_BUFFER_MAX, oreBufferMax: DRILL_ORE_BUFFER_MAX, bufferTier: 0 };
}

// ---------------------------------------------------------------------------
// Drill definitions - one per ore node type
// ---------------------------------------------------------------------------

export interface DrillTier {
  tier: number;
  name: string;
  cycleMs: number;          // milliseconds per cycle
  orePerCycle: number;      // ore units produced per cycle
  upgradeCost: ResourceBag; // materials to upgrade TO this tier (not the build cost)
}

export interface DrillDefinition {
  id: string;
  name: string;
  /** Which ore vein ID this drill attaches to (matches OreVeinPlacement.id) */
  veinId: string;
  /** The ore material this drill produces */
  oreMaterialId: MaterialId;
  /** Build cost (in-place at the node) */
  buildCost: ResourceBag;
  /** Coal consumed per cycle - constant across all tiers */
  coalPerCycle: number;
  /** Tier definitions - tier 1 is the base (just-built) state */
  tiers: DrillTier[];
}

export const DRILL_DEFINITIONS: DrillDefinition[] = [
  {
    id: "copper_drill",
    name: "Copper Drill",
    veinId: "mine_copper",
    oreMaterialId: "copper_ore",
    // Requires iron to build - that's exactly the point. You need iron
    // to make the drill tooling that automates copper. Same pattern
    // going forward: each drill requires the NEXT tier's metal.
    buildCost: {
      copper_ingot: 20,
      wood: 10,
      iron_ingot: 5,
    },
    coalPerCycle: 1,
    tiers: [
      {
        tier: 1,
        name: "Basic Drill",
        cycleMs: 30_000,     // 30s
        orePerCycle: 1,
        upgradeCost: {},     // base tier, no upgrade cost (it IS the build cost)
      },
      {
        tier: 2,
        name: "Sharpened Bits",
        cycleMs: 20_000,     // 20s
        orePerCycle: 1,
        upgradeCost: { iron_ingot: 10 },
      },
      {
        tier: 3,
        name: "Reinforced Housing",
        cycleMs: 15_000,     // 15s
        orePerCycle: 2,
        upgradeCost: { iron_ingot: 20 },
      },
      {
        tier: 4,
        name: "Deep Core Drill",
        cycleMs: 10_000,     // 10s
        orePerCycle: 3,
        upgradeCost: { iron_ingot: 30, true_copper: 5 },
      },
    ],
  },
  // Iron drill - reserved. Unlocks when deepstone/next tier is reached.
  // Same shape, scaled costs. Added here as a placeholder so the system
  // knows it exists, but buildCost requires future materials not yet in game.
  {
    id: "iron_drill",
    name: "Iron Drill",
    veinId: "mine_iron",
    oreMaterialId: "iron_ore",
    buildCost: {
      iron_ingot: 20,
      wood: 10,
      deepstone_ingot: 5,
    },
    coalPerCycle: 2, // iron needs more heat
    tiers: [
      { tier: 1, name: "Basic Iron Drill",   cycleMs: 45_000, orePerCycle: 1, upgradeCost: {} },
      { tier: 2, name: "Hardened Bits",      cycleMs: 30_000, orePerCycle: 1, upgradeCost: { iron_ingot: 15 } },
      { tier: 3, name: "Reinforced Housing", cycleMs: 20_000, orePerCycle: 2, upgradeCost: { iron_ingot: 30 } },
      { tier: 4, name: "Deep Core Drill",    cycleMs: 15_000, orePerCycle: 3, upgradeCost: { iron_ingot: 50, true_iron: 5 } },
    ],
  },
];

export function drillDefinitionByVeinId(veinId: string): DrillDefinition | undefined {
  return DRILL_DEFINITIONS.find((d) => d.veinId === veinId);
}

export function drillTierDefinition(def: DrillDefinition, tier: number): DrillTier {
  return def.tiers.find((t) => t.tier === tier) ?? def.tiers[0];
}

// ---------------------------------------------------------------------------
// Affordability helpers
// ---------------------------------------------------------------------------

export function canAffordBuildDrill(def: DrillDefinition, inventory: ResourceBag): boolean {
  return canAffordMaterials(inventory, def.buildCost);
}

export function canAffordUpgradeDrill(
  def: DrillDefinition,
  currentTier: number,
  inventory: ResourceBag
): boolean {
  const next = def.tiers.find((t) => t.tier === currentTier + 1);
  if (!next) return false;
  return canAffordMaterials(inventory, next.upgradeCost);
}

export function nextDrillTier(def: DrillDefinition, currentTier: number): DrillTier | null {
  return def.tiers.find((t) => t.tier === currentTier + 1) ?? null;
}

// ---------------------------------------------------------------------------
// Cycle processing - called from the game loop (like advanceCompanionHauling)
// ---------------------------------------------------------------------------

export interface DrillTickResult {
  drill: DrillState;
  oreProduced: number;
  coalConsumed: number;
  /** True if the drill ran at least one cycle */
  ranCycle: boolean;
  /** Why the drill stopped (or null if it ran fine) */
  stoppedReason: "no_coal" | "ore_buffer_full" | null;
}

/**
 * Advance the drill's state based on elapsed time. May run multiple
 * cycles if enough time has passed (offline catch-up, same pattern as
 * the Hearth's tickHearth). Pure function - returns new state.
 */
export function tickDrill(
  drill: DrillState,
  def: DrillDefinition,
  now: number
): DrillTickResult {
  if (drill.tier === 0) {
    return { drill, oreProduced: 0, coalConsumed: 0, ranCycle: false, stoppedReason: null };
  }

  const tierDef = drillTierDefinition(def, drill.tier);
  const elapsedMs = Math.max(0, now - drill.lastCycleAt);

  if (drill.lastCycleAt === 0) {
    // Never run - start the clock but don't produce yet
    return {
      drill: { ...drill, lastCycleAt: now },
      oreProduced: 0,
      coalConsumed: 0,
      ranCycle: false,
      stoppedReason: null,
    };
  }

  const cyclesElapsed = Math.floor(elapsedMs / tierDef.cycleMs);
  if (cyclesElapsed === 0) {
    return { drill, oreProduced: 0, coalConsumed: 0, ranCycle: false, stoppedReason: null };
  }

  // Run as many cycles as we can until coal or ore buffer stops us
  let coalLeft = drill.coalBuffer;
  let oreLeft = drill.oreBuffer;
  let cyclesRun = 0;
  let stoppedReason: "no_coal" | "ore_buffer_full" | null = null;

  for (let i = 0; i < cyclesElapsed; i++) {
    if (coalLeft < def.coalPerCycle) { stoppedReason = "no_coal"; break; }
    if (oreLeft + tierDef.orePerCycle > drill.oreBufferMax) { stoppedReason = "ore_buffer_full"; break; }
    coalLeft -= def.coalPerCycle;
    oreLeft += tierDef.orePerCycle;
    cyclesRun++;
  }

  if (cyclesRun === 0) {
    return { drill, oreProduced: 0, coalConsumed: 0, ranCycle: false, stoppedReason };
  }

  const newDrill: DrillState = {
    ...drill,
    coalBuffer: coalLeft,
    oreBuffer: oreLeft,
    lastCycleAt: drill.lastCycleAt + cyclesRun * tierDef.cycleMs,
  };

  return {
    drill: newDrill,
    oreProduced: oreLeft - drill.oreBuffer,
    coalConsumed: drill.coalBuffer - coalLeft,
    ranCycle: true,
    stoppedReason,
  };
}

// ---------------------------------------------------------------------------
// Player interactions
// ---------------------------------------------------------------------------

export interface DrillRefuelResult {
  inventory: ResourceBag;
  drill: DrillState;
  coalAdded: number;
}

/**
 * Player refuels a drill from their carried coal.
 * Fills the buffer as much as possible from inventory.
 */
export function refuelDrill(
  inventory: ResourceBag,
  drill: DrillState
): DrillRefuelResult {
  const space = drill.coalBufferMax - drill.coalBuffer;
  const carried = getMaterialAmount(inventory, "coal");
  const coalAdded = Math.min(space, carried);
  if (coalAdded === 0) return { inventory, drill, coalAdded: 0 };

  return {
    inventory: deductMaterials(inventory, { coal: coalAdded }),
    drill: { ...drill, coalBuffer: drill.coalBuffer + coalAdded },
    coalAdded,
  };
}

export interface DrillCollectResult {
  inventory: ResourceBag;
  drill: DrillState;
  oreCollected: number;
}

/**
 * Player collects ore from a drill's buffer into their inventory.
 */
export function collectDrillOre(
  inventory: ResourceBag,
  drill: DrillState,
  def: DrillDefinition
): DrillCollectResult {
  const ore = drill.oreBuffer;
  if (ore === 0) return { inventory, drill, oreCollected: 0 };

  return {
    inventory: addMaterial(inventory, def.oreMaterialId, ore),
    drill: { ...drill, oreBuffer: 0 },
    oreCollected: ore,
  };
}
