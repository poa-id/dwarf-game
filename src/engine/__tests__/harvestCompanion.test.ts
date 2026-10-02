import { describe, expect, it } from "vitest";
import { advanceGardenTending, gardenTendingUpgradeCost } from "../harvestCompanion";
import type { PlanterSlot } from "../garden";

describe("Siginhakhd garden tending", () => {
  it("harvests a mature crop into the stockpile and replants from stored seed", () => {
    const slots: PlanterSlot[] = [{ plantId: "stoneshroom", stage: 3, stageStartedAt: 1, unlocked: true }];
    const result = advanceGardenTending(slots, { stoneshroom_spore: 1 }, 1, 30_001, 0, 200);
    expect(result.stockpile.stoneshroom).toBe(2);
    expect(result.stockpile.stoneshroom_spore).toBe(0);
    expect(result.slots[0].plantId).toBe("stoneshroom");
    expect(result.slots[0].stage).toBe(0);
    expect(result.xp).toBeGreaterThan(0);
  });

  it("clears the planter when no replacement seed is stored", () => {
    const slots: PlanterSlot[] = [{ plantId: "cave_fern", stage: 3, stageStartedAt: 1, unlocked: true }];
    const result = advanceGardenTending(slots, {}, 1, 30_001, 0, 200);
    expect(result.stockpile.hearthsap).toBe(1);
    expect(result.slots[0].plantId).toBeNull();
  });

  it("uses an escalating resource sink", () => {
    expect(gardenTendingUpgradeCost(10).wood_planks).toBeGreaterThan(gardenTendingUpgradeCost(0).wood_planks ?? 0);
  });
});
