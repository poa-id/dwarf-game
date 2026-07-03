import { describe, it, expect } from "vitest";
import {
  PLANT_DEFINITIONS,
  plantDefById,
  growthStageCellKind,
  createFreshPlanterSlot,
  tickGarden,
  growthSpeedMultiplier,
  PLANTER_UNLOCK_COSTS,
  type PlanterSlot,
} from "../garden";

describe("PLANT_DEFINITIONS", () => {
  it("every definition has positive harvest amount, 3 stage durations, and a valid herblore requirement", () => {
    for (const def of PLANT_DEFINITIONS) {
      expect(def.harvestAmount).toBeGreaterThan(0);
      expect(def.stageDurationsMs).toHaveLength(3);
      for (const ms of def.stageDurationsMs) expect(ms).toBeGreaterThan(0);
      expect(def.herbloreRequired).toBeGreaterThanOrEqual(0);
      expect(def.herbloreXp).toBeGreaterThan(0);
    }
  });

  it("herbloreRequired strictly increases through the wood ladder (cave-root implicit -> ironwood -> gemwood)", () => {
    const ironwood = plantDefById("ironwood_sapling")!;
    const gemwood = plantDefById("gemwood_tree")!;
    expect(gemwood.herbloreRequired).toBeGreaterThan(ironwood.herbloreRequired);
  });

  it("gemwood_tree uses the previously-orphaned ancient_seed_rare and produces gemwood + a bonus gem", () => {
    const gemwood = plantDefById("gemwood_tree")!;
    expect(gemwood.seedMaterialId).toBe("ancient_seed_rare");
    expect(gemwood.harvestMaterialId).toBe("gemwood");
    expect(gemwood.category).toBe("tree");
    expect(gemwood.secondaryMaterialId).toBe("rough_amethyst");
    expect(gemwood.secondaryAmount).toBeGreaterThan(0);
  });

  it("no two plant definitions share an id", () => {
    const ids = PLANT_DEFINITIONS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("growthStageCellKind", () => {
  it("stage 0-2 map to empty/sprout/growing regardless of category", () => {
    expect(growthStageCellKind(0, "tree")).toBe("planter_empty");
    expect(growthStageCellKind(1, "shroom")).toBe("planter_sprout");
    expect(growthStageCellKind(2, "fern")).toBe("planter_growing");
  });

  it("stage 3 (mature) is category-specific for shroom/fern, generic for tree", () => {
    expect(growthStageCellKind(3, "shroom")).toBe("planter_shroom");
    expect(growthStageCellKind(3, "fern")).toBe("planter_fern");
    expect(growthStageCellKind(3, "tree")).toBe("planter_mature");
  });
});

describe("createFreshPlanterSlot", () => {
  it("starts empty at stage 0 with the given unlocked flag", () => {
    const locked = createFreshPlanterSlot(false);
    expect(locked).toEqual({ plantId: null, stage: 0, stageStartedAt: 0, unlocked: false });
    const unlocked = createFreshPlanterSlot(true);
    expect(unlocked.unlocked).toBe(true);
  });
});

describe("PLANTER_UNLOCK_COSTS", () => {
  it("slot 0 is free (pre-unlocked as part of restoring the room)", () => {
    expect(PLANTER_UNLOCK_COSTS[0]).toEqual({ insightCost: 0, materialCost: {}, herbloreRequired: 0 });
  });

  it("insightCost and herbloreRequired both strictly increase with each successive slot", () => {
    for (let i = 1; i < PLANTER_UNLOCK_COSTS.length; i++) {
      expect(PLANTER_UNLOCK_COSTS[i].insightCost).toBeGreaterThan(PLANTER_UNLOCK_COSTS[i - 1].insightCost);
      expect(PLANTER_UNLOCK_COSTS[i].herbloreRequired).toBeGreaterThanOrEqual(PLANTER_UNLOCK_COSTS[i - 1].herbloreRequired);
    }
  });
});

describe("growthSpeedMultiplier", () => {
  it("is a flat 1.0 for now - tool/level bonuses not yet implemented", () => {
    expect(growthSpeedMultiplier(1)).toBe(1.0);
    expect(growthSpeedMultiplier(50)).toBe(1.0);
  });
});

describe("tickGarden", () => {
  const stoneshroom = plantDefById("stoneshroom")!;

  it("advances a slot to the next stage once its stage duration elapses", () => {
    const slots: PlanterSlot[] = [{ plantId: "stoneshroom", stage: 0, stageStartedAt: 0, unlocked: true }];
    const result = tickGarden(slots, stoneshroom.stageDurationsMs[0]);
    expect(result.changed).toBe(true);
    expect(result.slots[0].stage).toBe(1);
    expect(result.slots[0].stageStartedAt).toBe(stoneshroom.stageDurationsMs[0]);
  });

  it("does not advance before the stage duration has elapsed", () => {
    const slots: PlanterSlot[] = [{ plantId: "stoneshroom", stage: 0, stageStartedAt: 0, unlocked: true }];
    const result = tickGarden(slots, stoneshroom.stageDurationsMs[0] - 1);
    expect(result.changed).toBe(false);
    expect(result.slots[0].stage).toBe(0);
  });

  it("never advances past stage 3 (mature) - harvesting, not ticking, clears it", () => {
    const slots: PlanterSlot[] = [{ plantId: "stoneshroom", stage: 3, stageStartedAt: 0, unlocked: true }];
    const result = tickGarden(slots, 999_999_999);
    expect(result.changed).toBe(false);
    expect(result.slots[0].stage).toBe(3);
  });

  it("ignores locked slots and empty (no plantId) slots", () => {
    const slots: PlanterSlot[] = [
      { plantId: "stoneshroom", stage: 0, stageStartedAt: 0, unlocked: false },
      { plantId: null, stage: 0, stageStartedAt: 0, unlocked: true },
    ];
    const result = tickGarden(slots, 999_999_999);
    expect(result.changed).toBe(false);
    expect(result.slots).toEqual(slots);
  });

  it("a higher speedMultiplier shrinks the effective stage duration", () => {
    const slots: PlanterSlot[] = [{ plantId: "stoneshroom", stage: 0, stageStartedAt: 0, unlocked: true }];
    const halfway = stoneshroom.stageDurationsMs[0] / 2;
    const unboosted = tickGarden(slots, halfway, 1.0);
    expect(unboosted.changed).toBe(false);
    const boosted = tickGarden(slots, halfway, 2.0); // 2x speed halves the effective duration
    expect(boosted.changed).toBe(true);
  });

  it("multiple slots tick independently in one call", () => {
    const slots: PlanterSlot[] = [
      { plantId: "stoneshroom", stage: 0, stageStartedAt: 0, unlocked: true },
      { plantId: "stoneshroom", stage: 0, stageStartedAt: 1_000_000, unlocked: true }, // started later, shouldn't be ready yet
    ];
    const result = tickGarden(slots, stoneshroom.stageDurationsMs[0]);
    expect(result.slots[0].stage).toBe(1);
    expect(result.slots[1].stage).toBe(0);
  });
});
