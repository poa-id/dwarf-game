import type { ResourceBag } from "./types";
import { canAffordMaterials, deductMaterials, addMaterial } from "./types";

/**
 * Automated wood harvesting - the Wood Harvester. Direct instruction:
 * "this follows the same logic of the ore drills but for wood, and
 * the hauling goes to the sawmill." Mirrors drill.ts closely on
 * purpose - same coal-fueled cycle, same buffer-then-haul shape - just
 * applied to a wood node instead of an ore vein. One harvester per
 * wood node (currently just the Garden Room's root tangle).
 *
 * Unlike ore (which auto-drains into the shared stockpile once that
 * room is cleared), harvested wood is hauled by a SEPARATE, new
 * companion (placeholder sprite: oxen.png - "he might not end up
 * being an Oxen," per direct note, so nothing here is named after the
 * animal) to the Sawmill's own local wood buffer, not to a shared
 * stockpile. Sawing planks from that buffer STAYS a manual action for
 * now ("player triggers sawing until an upgrade is made like in the
 * smelting engines" - that upgrade doesn't exist yet, this is just the
 * design so it isn't accidentally auto-built ahead of that decision).
 */

export interface HarvesterState {
  /** 0 = not built. 1+ = upgrade tier. */
  tier: number;
  /** Coal buffer - harvester draws from this each cycle, same as a drill. */
  coalBuffer: number;
  /** Wood buffer - accumulates here until the hauler empties it into the Sawmill. */
  woodBuffer: number;
  /** Timestamp (ms) of last completed cycle. 0 = never run. */
  lastCycleAt: number;
  coalBufferMax: number;
  woodBufferMax: number;
}

export const HARVESTER_COAL_BUFFER_MAX = 20;
export const HARVESTER_WOOD_BUFFER_MAX = 20;

export function createFreshHarvesterState(): HarvesterState {
  return {
    tier: 1,
    coalBuffer: 0,
    woodBuffer: 0,
    lastCycleAt: 0,
    coalBufferMax: HARVESTER_COAL_BUFFER_MAX,
    woodBufferMax: HARVESTER_WOOD_BUFFER_MAX,
  };
}

export interface HarvesterTier {
  tier: number;
  name: string;
  cycleMs: number;
  woodPerCycle: number;
  upgradeCost: ResourceBag;
}

export interface HarvesterDefinition {
  id: string;
  name: string;
  /** Which wood node this harvester attaches to (matches WoodNodePlacement.id) */
  nodeId: string;
  buildCost: ResourceBag;
  coalPerCycle: number;
  tiers: HarvesterTier[];
}

export const HARVESTER_DEFINITIONS: HarvesterDefinition[] = [
  {
    id: "root_harvester",
    name: "Root Harvester",
    nodeId: "garden_roots",
    // 2026-07-06: wood_planks instead of raw wood (was 15) - see
    // drill.ts's copper_drill comment for the conversion ratio.
    buildCost: { copper_ingot: 15, wood_planks: 3, iron_ingot: 5 },
    coalPerCycle: 1,
    tiers: [
      { tier: 1, name: "Basic Harvester",     cycleMs: 30_000, woodPerCycle: 1, upgradeCost: {} },
      { tier: 2, name: "Sharpened Blades",    cycleMs: 20_000, woodPerCycle: 1, upgradeCost: { iron_ingot: 10 } },
      { tier: 3, name: "Reinforced Housing",  cycleMs: 15_000, woodPerCycle: 2, upgradeCost: { iron_ingot: 20 } },
      { tier: 4, name: "Deep Root Harvester", cycleMs: 10_000, woodPerCycle: 3, upgradeCost: { iron_ingot: 30, deepstone_ingot: 5 } },
    ],
  },
];

export function harvesterDefinitionByNodeId(nodeId: string): HarvesterDefinition | undefined {
  return HARVESTER_DEFINITIONS.find((d) => d.nodeId === nodeId);
}

export function harvesterTierDefinition(def: HarvesterDefinition, tier: number): HarvesterTier {
  return def.tiers.find((t) => t.tier === tier) ?? def.tiers[0];
}

export function nextHarvesterTier(def: HarvesterDefinition, currentTier: number): HarvesterTier | null {
  return def.tiers.find((t) => t.tier === currentTier + 1) ?? null;
}

export function canAffordBuildHarvester(inventory: ResourceBag, def: HarvesterDefinition): boolean {
  return canAffordMaterials(inventory, def.buildCost);
}

export function canAffordUpgradeHarvester(
  inventory: ResourceBag,
  def: HarvesterDefinition,
  currentTier: number
): boolean {
  const next = nextHarvesterTier(def, currentTier);
  if (!next) return false;
  return canAffordMaterials(inventory, next.upgradeCost);
}

export interface HarvesterTickResult {
  harvester: HarvesterState;
  woodProduced: number;
  coalConsumed: number;
  ranCycle: boolean;
  stoppedReason: "no_coal" | "wood_buffer_full" | null;
}

/**
 * Ticks the harvester forward. Identical shape to tickDrill - coal
 * fuels cycles, wood accumulates in its own buffer, offline catch-up
 * runs multiple cycles per call if enough time elapsed. No gem-drop
 * equivalent to roll for: wood nodes have no bonus-drop config, same
 * as manual Woodcraft gathering never has one either.
 */
export function tickHarvester(
  harvester: HarvesterState,
  def: HarvesterDefinition,
  now: number,
  speedMultiplier: number = 1
): HarvesterTickResult {
  if (harvester.tier === 0) {
    return { harvester, woodProduced: 0, coalConsumed: 0, ranCycle: false, stoppedReason: null };
  }

  const tierDef = harvesterTierDefinition(def, harvester.tier);
  const effectiveCycleMs = Math.max(1, Math.round(tierDef.cycleMs / speedMultiplier));
  const elapsedMs = Math.max(0, now - harvester.lastCycleAt);

  if (harvester.lastCycleAt === 0) {
    return {
      harvester: { ...harvester, lastCycleAt: now },
      woodProduced: 0,
      coalConsumed: 0,
      ranCycle: false,
      stoppedReason: null,
    };
  }

  const cyclesElapsed = Math.floor(elapsedMs / effectiveCycleMs);
  if (cyclesElapsed === 0) {
    return { harvester, woodProduced: 0, coalConsumed: 0, ranCycle: false, stoppedReason: null };
  }

  let coalLeft = harvester.coalBuffer;
  let woodLeft = harvester.woodBuffer;
  let cyclesRun = 0;
  let stoppedReason: "no_coal" | "wood_buffer_full" | null = null;

  for (let i = 0; i < cyclesElapsed; i++) {
    if (coalLeft < def.coalPerCycle) { stoppedReason = "no_coal"; break; }
    if (woodLeft + tierDef.woodPerCycle > harvester.woodBufferMax) { stoppedReason = "wood_buffer_full"; break; }
    coalLeft -= def.coalPerCycle;
    woodLeft += tierDef.woodPerCycle;
    cyclesRun++;
  }

  if (cyclesRun === 0) {
    return { harvester, woodProduced: 0, coalConsumed: 0, ranCycle: false, stoppedReason };
  }

  const newHarvester: HarvesterState = {
    ...harvester,
    coalBuffer: coalLeft,
    woodBuffer: woodLeft,
    lastCycleAt: harvester.lastCycleAt + cyclesRun * effectiveCycleMs,
  };

  return {
    harvester: newHarvester,
    woodProduced: woodLeft - harvester.woodBuffer,
    coalConsumed: harvester.coalBuffer - coalLeft,
    ranCycle: true,
    stoppedReason,
  };
}

export interface HarvesterCollectResult {
  inventory: ResourceBag;
  harvester: HarvesterState;
  woodCollected: number;
}

/**
 * Manual wood collection - a fallback for before the harvest companion
 * is befriended (mirrors collectDrillOre; ore drills have always
 * allowed manual collection too, alongside Narag-Bund's automatic
 * haul, so the harvester follows the same "automation is additive, not
 * a replacement for the manual option" precedent).
 */
export function collectHarvesterWood(
  inventory: ResourceBag,
  harvester: HarvesterState
): HarvesterCollectResult {
  const wood = harvester.woodBuffer;
  if (wood === 0) return { inventory, harvester, woodCollected: 0 };

  return {
    inventory: addMaterial(inventory, "wood", wood),
    harvester: { ...harvester, woodBuffer: 0 },
    woodCollected: wood,
  };
}

export interface HarvesterRefuelResult {
  inventory: ResourceBag;
  harvester: HarvesterState;
  coalAdded: number;
}

export function refuelHarvester(inventory: ResourceBag, harvester: HarvesterState): HarvesterRefuelResult {
  const space = harvester.coalBufferMax - harvester.coalBuffer;
  const held = (inventory["coal"] as number | undefined) ?? 0;
  const toAdd = Math.min(space, held);
  if (toAdd <= 0) return { inventory, harvester, coalAdded: 0 };
  return {
    inventory: deductMaterials(inventory, { coal: toAdd }),
    harvester: { ...harvester, coalBuffer: harvester.coalBuffer + toAdd },
    coalAdded: toAdd,
  };
}
