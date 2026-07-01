/**
 * Garden growth system — passive resource production in the Garden Room.
 *
 * The Garden Room (SW) has a wood node and kiln already. This module
 * adds the passive growth layer: planted slots that produce materials
 * over time without the player's presence.
 *
 * Growth cadence (deliberately slow — patience is the idiom):
 *   Stoneshroom:  2 min cycle, 1 yield — fast, reliable
 *   Cave Fern:    5 min cycle, 2 wood — medium
 *   Ironwood:    30 min cycle, 3 ironwood — slow, high value
 *   Ancient Heartwood: 2 hr cycle, 8 ironwood + 1 hearthsap — very slow
 *
 * Seeds are found by:
 *   - Stoneshroom: drops from root_tangle wood cutting (rare, 2%)
 *   - Cave Fern: purchased from Trade Hall once opened
 *   - Ancient Seed (→ Ironwood): the Garden's sealed seed chest,
 *     a restoration object unlocked at garden_room "restored" stage
 *
 * Garden room stages (room-state framework):
 *   ruined    — overgrown, the old planters collapsed
 *   cleared   — floor swept, basic planters rebuilt (2 slots)
 *   restored  — full planters + seed chest opened (6 slots)
 *   masterwork— the ancient growing-lights rekindled (10 slots)
 */

import type { MaterialId } from "./types";
import { getMaterialAmount, deductMaterials, addMaterial } from "./types";
import type { ResourceBag } from "./types";

// ---------------------------------------------------------------------------
// Plant definitions
// ---------------------------------------------------------------------------

export interface PlantDefinition {
  id: string;
  name: string;
  seedMaterialId: MaterialId;    // what you plant
  producedMaterialId: MaterialId; // what it yields
  cycleMs: number;
  yield: number;
  /** Secondary yield (e.g. hearthsap from heartwood) */
  secondaryMaterialId?: MaterialId;
  secondaryYield?: number;
}

export const PLANT_DEFINITIONS: PlantDefinition[] = [
  {
    id: "stoneshroom",
    name: "Stoneshroom",
    seedMaterialId: "stoneshroom_spore",
    producedMaterialId: "stoneshroom",
    cycleMs: 2 * 60 * 1000,  // 2 min
    yield: 1,
  },
  {
    id: "cave_fern",
    name: "Cave Fern",
    seedMaterialId: "cave_fern_spore",
    producedMaterialId: "wood",
    cycleMs: 5 * 60 * 1000,  // 5 min
    yield: 2,
  },
  {
    id: "ironwood_sapling",
    name: "Ironwood Sapling",
    seedMaterialId: "ancient_seed",
    producedMaterialId: "ironwood",
    cycleMs: 30 * 60 * 1000, // 30 min
    yield: 3,
  },
  {
    id: "ancient_heartwood",
    name: "Ancient Heartwood",
    seedMaterialId: "ancient_seed_rare",
    producedMaterialId: "ironwood",
    cycleMs: 2 * 60 * 60 * 1000, // 2 hours
    yield: 8,
    secondaryMaterialId: "hearthsap",
    secondaryYield: 1,
  },
];

export function plantById(id: string): PlantDefinition | undefined {
  return PLANT_DEFINITIONS.find((p) => p.id === id);
}

// ---------------------------------------------------------------------------
// Garden slot state
// ---------------------------------------------------------------------------

export interface GardenSlot {
  plantId: string | null;    // null = empty
  plantedAt: number;         // timestamp, 0 if empty
  readyCount: number;        // how many harvests are ready
}

export const MAX_GARDEN_SLOTS_BY_STAGE: Record<string, number> = {
  ruined: 0,
  cleared: 2,
  restored: 6,
  masterwork: 10,
};

export function createEmptySlot(): GardenSlot {
  return { plantId: null, plantedAt: 0, readyCount: 0 };
}

// ---------------------------------------------------------------------------
// Tick — advances all garden slots
// ---------------------------------------------------------------------------

export interface GardenTickResult {
  slots: GardenSlot[];
  harvested: ResourceBag;
  changed: boolean;
}

/**
 * Advances all garden slots based on elapsed time. Handles offline
 * catch-up (same pattern as Hearth/drills — capped at 24h).
 */
export function tickGarden(
  slots: GardenSlot[],
  now: number
): GardenTickResult {
  const MAX_OFFLINE_MS = 24 * 60 * 60 * 1000;
  let newSlots = [...slots];
  let harvested: ResourceBag = {};
  let changed = false;

  for (let i = 0; i < newSlots.length; i++) {
    const slot = newSlots[i];
    if (!slot.plantId || slot.plantedAt === 0) continue;

    const plant = plantById(slot.plantId);
    if (!plant) continue;

    const elapsedMs = Math.min(now - slot.plantedAt, MAX_OFFLINE_MS);
    const cyclesReady = Math.floor(elapsedMs / plant.cycleMs);
    const newReady = slot.readyCount + cyclesReady;

    if (cyclesReady > 0) {
      // Auto-collect up to 10 cycles into the harvested bag (overflow
      // stays as readyCount for manual collection if the player wants).
      // For now just accumulate in readyCount — player manually harvests.
      newSlots[i] = {
        ...slot,
        readyCount: newReady,
        plantedAt: slot.plantedAt + cyclesReady * plant.cycleMs,
      };
      changed = true;
    }
  }

  return { slots: newSlots, harvested, changed };
}

// ---------------------------------------------------------------------------
// Player interactions
// ---------------------------------------------------------------------------

export interface PlantResult {
  slot: GardenSlot;
  inventory: ResourceBag;
}

export function plantSeed(
  slotIndex: number,
  slots: GardenSlot[],
  plantId: string,
  inventory: ResourceBag,
  now: number
): PlantResult {
  const plant = plantById(plantId);
  if (!plant) throw new Error(`Unknown plant: ${plantId}`);

  const seedHeld = getMaterialAmount(inventory, plant.seedMaterialId);
  if (seedHeld < 1) throw new Error(`No ${plant.seedMaterialId} to plant`);

  const slot = slots[slotIndex];
  if (!slot) throw new Error(`Invalid slot ${slotIndex}`);
  if (slot.plantId) throw new Error(`Slot ${slotIndex} is already planted`);

  return {
    slot: { plantId, plantedAt: now, readyCount: 0 },
    inventory: deductMaterials(inventory, { [plant.seedMaterialId]: 1 }),
  };
}

export interface HarvestResult {
  slot: GardenSlot;
  gained: ResourceBag;
}

export function harvestSlot(
  slot: GardenSlot
): HarvestResult {
  if (!slot.plantId || slot.readyCount === 0) {
    return { slot, gained: {} };
  }

  const plant = plantById(slot.plantId);
  if (!plant) return { slot, gained: {} };

  let gained: ResourceBag = {};
  const batches = slot.readyCount;
  gained = addMaterial(gained, plant.producedMaterialId, plant.yield * batches);

  if (plant.secondaryMaterialId && plant.secondaryYield) {
    gained = addMaterial(gained, plant.secondaryMaterialId, plant.secondaryYield * batches);
  }

  return {
    slot: { ...slot, readyCount: 0 },
    gained,
  };
}

// ---------------------------------------------------------------------------
// Seed drop from woodcutting (2% stoneshroom spore)
// ---------------------------------------------------------------------------

export const STONESHROOM_SPORE_DROP_CHANCE = 0.02;

export function rollSeedDrop(roll: number): MaterialId | null {
  if (roll < STONESHROOM_SPORE_DROP_CHANCE) return "stoneshroom_spore";
  return null;
}
