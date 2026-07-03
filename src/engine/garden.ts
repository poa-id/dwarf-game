/**
 * Garden — individual planter slots with growth stages.
 *
 * Architecture:
 * - 4 planter slots (expandable), each independently managed
 * - Seeds are consumable: planted on slot, consumed on harvest, must replant
 * - Growth has 4 visual stages (empty → sprout → growing → mature)
 * - Harvest clears the slot (no auto-replant)
 * - Plant types: shroom (→ Brewing), fern (→ hearthsap), tree (→ lumber + fruit)
 *
 * Herblore skill:
 * - Planting any crop gives Herblore XP
 * - Tier 1 crops (shroom, fern): from Herblore 1
 * - Tier 2 crops (ironwood): from Herblore 8
 * - Higher tiers: Herblore 15+
 *
 * Planter unlock costs (per slot beyond slot 0):
 * - Slot 1: 5 Insight + 5 copper_ingot + 5 wood
 * - Slot 2: 15 Insight + 10 iron_ingot + 10 wood
 * - Slot 3: 40 Insight + 5 deepstone_ingot + 5 ironwood
 */

import type { MaterialId } from "./types";

// ---------------------------------------------------------------------------
// Plant definitions
// ---------------------------------------------------------------------------

export type PlantTier = 1 | 2 | 3;
export type PlantCategory = "shroom" | "fern" | "tree";

export interface PlantDefinition {
  id: string;
  name: string;
  category: PlantCategory;
  tier: PlantTier;
  seedMaterialId: MaterialId;
  harvestMaterialId: MaterialId;
  harvestAmount: number;
  /** Secondary harvest (trees: fruit / hearthsap) */
  secondaryMaterialId?: MaterialId;
  secondaryAmount?: number;
  /** Growth stage durations in ms for each stage (empty→sprout, sprout→growing, growing→mature) */
  stageDurationsMs: [number, number, number];
  herbloreXp: number;
  /** Herblore level required to plant */
  herbloreRequired: number;
}

export const PLANT_DEFINITIONS: PlantDefinition[] = [
  {
    id: "stoneshroom",
    name: "Stoneshroom",
    category: "shroom",
    tier: 1,
    seedMaterialId: "stoneshroom_spore",
    harvestMaterialId: "stoneshroom",
    harvestAmount: 2,
    stageDurationsMs: [60_000, 90_000, 90_000], // 4 min total
    herbloreXp: 15,
    herbloreRequired: 1,
  },
  {
    id: "cave_fern",
    name: "Cave Fern",
    category: "fern",
    tier: 1,
    seedMaterialId: "cave_fern_spore",
    harvestMaterialId: "hearthsap",
    harvestAmount: 1,
    stageDurationsMs: [120_000, 150_000, 150_000], // 7 min total
    herbloreXp: 20,
    herbloreRequired: 1,
  },
  {
    id: "ironwood_sapling",
    name: "Ironwood Sapling",
    category: "tree",
    tier: 2,
    seedMaterialId: "ancient_seed",
    harvestMaterialId: "ironwood",
    harvestAmount: 3,
    secondaryMaterialId: "cave_fern_spore",
    secondaryAmount: 1,
    stageDurationsMs: [10 * 60_000, 10 * 60_000, 10 * 60_000], // 30 min total
    herbloreXp: 60,
    herbloreRequired: 8,
  },
];

export function plantDefById(id: string): PlantDefinition | undefined {
  return PLANT_DEFINITIONS.find((p) => p.id === id);
}

// ---------------------------------------------------------------------------
// Growth stages
// ---------------------------------------------------------------------------

/** 0 = empty (seeded but not sprouting), 1 = sprout, 2 = growing, 3 = mature */
export type GrowthStage = 0 | 1 | 2 | 3;

export function growthStageCellKind(
  stage: GrowthStage,
  category: PlantCategory
): string {
  if (stage === 3) {
    if (category === "shroom") return "planter_shroom";
    if (category === "fern") return "planter_fern";
    return "planter_mature"; // tree uses generic mature sprite
  }
  if (stage === 2) return "planter_growing";
  if (stage === 1) return "planter_sprout";
  return "planter_empty";
}

// ---------------------------------------------------------------------------
// Planter slot state
// ---------------------------------------------------------------------------

export interface PlanterSlot {
  /** Which plant is growing, or null if empty */
  plantId: string | null;
  /** Growth stage (0-3). Only meaningful when plantId is set. */
  stage: GrowthStage;
  /** Timestamp when the current stage started (ms since epoch) */
  stageStartedAt: number;
  /** Whether this slot has been unlocked by the player */
  unlocked: boolean;
}

export function createFreshPlanterSlot(unlocked: boolean): PlanterSlot {
  return { plantId: null, stage: 0, stageStartedAt: 0, unlocked };
}

// ---------------------------------------------------------------------------
// Planter unlock costs
// ---------------------------------------------------------------------------

export interface PlanterUnlockCost {
  insightCost: number;
  materialCost: Record<string, number>;
  herbloreRequired: number;
}

export const PLANTER_UNLOCK_COSTS: PlanterUnlockCost[] = [
  // Slot 0 is always unlocked
  { insightCost: 0, materialCost: {}, herbloreRequired: 0 },
  // Slot 1
  { insightCost: 5, materialCost: { copper_ingot: 5, wood: 5 }, herbloreRequired: 1 },
  // Slot 2
  { insightCost: 15, materialCost: { iron_ingot: 10, wood: 10 }, herbloreRequired: 5 },
  // Slot 3
  { insightCost: 40, materialCost: { deepstone_ingot: 5, ironwood: 5 }, herbloreRequired: 10 },
];

// ---------------------------------------------------------------------------
// Tick — advance growth stages
// ---------------------------------------------------------------------------

export interface GardenTickResult {
  slots: PlanterSlot[];
  changed: boolean;
}

export function tickGarden(slots: PlanterSlot[], now: number): GardenTickResult {
  let changed = false;
  const nextSlots = slots.map((slot): PlanterSlot => {
    if (!slot.unlocked || !slot.plantId || slot.stage >= 3) return slot;

    const def = plantDefById(slot.plantId);
    if (!def) return slot;

    const stageDuration = def.stageDurationsMs[slot.stage as 0 | 1 | 2];
    const elapsed = now - slot.stageStartedAt;

    if (elapsed >= stageDuration) {
      changed = true;
      return {
        ...slot,
        stage: (slot.stage + 1) as GrowthStage,
        stageStartedAt: now,
      };
    }
    return slot;
  });

  return { slots: nextSlots, changed };
}
