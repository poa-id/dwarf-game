import { describe, expect, it } from "vitest";
import { cumulativeXpForLevel } from "../xpCurve";
import { drillDefinitionByVeinId, drillOutputMultiplier, drillOutputUpgradeCost, drillTierDefinition } from "../drill";
import { harvesterOutputUpgradeCost } from "../harvester";
import { engineOutputUpgradeCost, SMELTING_ENGINE_DEFINITIONS } from "../smeltingEngine";
import { companionHaulTierDef, companionTrainingCost } from "../companion";

describe("whole-economy pacing guardrails", () => {
  it("puts the first metal gate before starter repetition becomes a four-digit click grind", () => {
    expect(cumulativeXpForLevel(8)).toBeLessThan(4_000);
    expect(cumulativeXpForLevel(20)).toBeLessThan(60_000);
  });

  it("makes a rank-9 tier-3 coal drill feel like infrastructure", () => {
    const coal = drillDefinitionByVeinId("mine_coal")!;
    const tier = drillTierDefinition(coal, 3);
    const perSecond = tier.orePerCycle / (tier.cycleMs / drillOutputMultiplier(9) / 1_000);
    expect(perSecond).toBeGreaterThanOrEqual(1.25);
  });

  it("keeps repeatable rank-10 prices within a productive-session scale", () => {
    const coal = drillDefinitionByVeinId("mine_coal")!;
    const copperEngine = SMELTING_ENGINE_DEFINITIONS.find((def) => def.id === "copper_engine")!;
    expect(drillOutputUpgradeCost(coal, 9).iron_ingot).toBeLessThan(60);
    expect(harvesterOutputUpgradeCost(9).wood_planks).toBeLessThan(60);
    expect(engineOutputUpgradeCost(copperEngine, 9).copper_ingot).toBeLessThan(70);
    expect(companionTrainingCost(9).coal).toBeLessThan(150);
  });

  it("gives the base hauler enough throughput to connect one starter production chain", () => {
    const tier = companionHaulTierDef(1);
    expect(tier.haulAmountPerTrip * 1_000 / tier.haulIntervalMs).toBeGreaterThanOrEqual(1);
  });
});
