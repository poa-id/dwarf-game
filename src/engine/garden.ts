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
 * - Tier 3 crops (gemwood): from Herblore 15
 * - Wood ladder continues beyond gemwood (Stonewood/Emberwood/Voidwood,
 *   tiers 4-6) via a planned "Deep Tree Grove" depth system mirroring
 *   the Mine Shaft - designed but not yet built, see OPEN_QUESTIONS.md.
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
  /**
   * Optional override for the mature-stage (stage 3) sprite, used when a
   * specific plant needs its own sprite rather than the shared
   * category-generic one (see growthStageCellKind). Added for gemwood_tree
   * (2026-07-03) - the first "tree" category plant to get its own distinct
   * art instead of sharing ironwood_sapling's "planter_mature" sprite.
   */
  matureCellKind?: string;
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
    stageDurationsMs: [5 * 60_000, 8 * 60_000, 7 * 60_000], // 20 min total (base)
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
    stageDurationsMs: [10 * 60_000, 15 * 60_000, 15 * 60_000], // 40 min total (base)
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
    stageDurationsMs: [30 * 60_000, 45 * 60_000, 45 * 60_000], // 2 hr total (base)
    herbloreXp: 60,
    herbloreRequired: 8,
  },
  {
    id: "gemwood_tree",
    name: "Gemwood Tree",
    category: "tree",
    tier: 3,
    seedMaterialId: "ancient_seed_rare",
    harvestMaterialId: "gemwood",
    harvestAmount: 3,
    // Small bonus gem alongside the wood - "gemstone tree" is the
    // whole premise, so a wood-only harvest felt like it was missing
    // the point. Amethyst specifically since that's the deepest/rarest
    // existing gem tier, matching gemwood's position as the current
    // top rung of the ladder. Placeholder amount, not balance-tested.
    secondaryMaterialId: "rough_amethyst",
    secondaryAmount: 1,
    stageDurationsMs: [45 * 60_000, 60 * 60_000, 75 * 60_000], // 3 hr total (base)
    herbloreXp: 100,
    herbloreRequired: 15,
    // Distinct mature sprite (2026-07-03) - a full dramatic "shrine tree"
    // scene rather than a plant-in-a-planter-box like every other mature
    // sprite. Deliberate per design direction: gemwood is meant to stand
    // out, not blend into the same box the tier-1/2 crops use.
    matureCellKind: "planter_gemwood",
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
  category: PlantCategory,
  matureCellKind?: string
): string {
  if (stage === 3) {
    if (matureCellKind) return matureCellKind;
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
  // Slot 0 — always unlocked, the first planter is repaired as part of restoring the room
  { insightCost: 0, materialCost: {}, herbloreRequired: 0 },

  // Slot 1 — a second planter. Meaningful but achievable early.
  { insightCost: 80, materialCost: { copper_ingot: 20, iron_ingot: 5, wood_planks: 6 }, herbloreRequired: 3 }, // 2026-07-06: was 30 raw wood

  // Slot 2 — third planter. Now you have real garden output. Iron tier investment.
  { insightCost: 250, materialCost: { iron_ingot: 30, wood_planks: 10, hearthsap: 5 }, herbloreRequired: 6 }, // 2026-07-06: was 50 raw wood

  // Slot 3 — fourth planter. Deep investment. Requires deepstone access.
  { insightCost: 600, materialCost: { iron_ingot: 60, deepstone_ingot: 10, ironwood: 15 }, herbloreRequired: 10 },

  // Slot 4 — fifth planter. Late game. The garden is a significant operation.
  { insightCost: 1500, materialCost: { deepstone_ingot: 25, ironwood: 30, true_iron: 3 }, herbloreRequired: 15 },

  // Slot 5 — sixth planter. Endgame. A fully operational deep garden.
  { insightCost: 4000, materialCost: { deepstone_ingot: 50, ironwood: 60, true_iron: 8, true_copper: 4 }, herbloreRequired: 20 },
];

// ---------------------------------------------------------------------------
// Tick — advance growth stages
// ---------------------------------------------------------------------------

export interface GardenTickResult {
  slots: PlanterSlot[];
  changed: boolean;
}

/**
 * Growth speed multiplier — future tools and upgrades will reduce stage durations.
 * Applied as a divisor: multiplier 2.0 = half the time.
 * Sources (planned):
 *   - Herblore level: +5% per level above required (passive knowledge)
 *   - Garden tools (trowel, watering can): +25/50% per tier
 *   - Kiln proximity (warmth): +10% for planters near kiln
 * For now, base speed only. The slowness is intentional — patience is the idiom.
 */
export function growthSpeedMultiplier(_herbloreLevel: number): number {
  // TODO: implement tool bonuses when garden tools are added
  return 1.0;
}

export function tickGarden(slots: PlanterSlot[], now: number, speedMultiplier: number = 1.0): GardenTickResult {
  let changed = false;
  const nextSlots = slots.map((slot): PlanterSlot => {
    if (!slot.unlocked || !slot.plantId || slot.stage >= 3) return slot;

    const def = plantDefById(slot.plantId);
    if (!def) return slot;

    const stageDuration = def.stageDurationsMs[slot.stage as 0 | 1 | 2] / Math.max(0.1, speedMultiplier);
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
