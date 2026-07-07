import { describe, it, expect } from "vitest";
import {
  harvesterDefinitionByNodeId,
  harvesterTierDefinition,
  nextHarvesterTier,
  createFreshHarvesterState,
  canAffordBuildHarvester,
  canAffordUpgradeHarvester,
  tickHarvester,
  refuelHarvester,
  type HarvesterState,
} from "../harvester";

const rootHarvesterDef = harvesterDefinitionByNodeId("garden_roots")!;

describe("HARVESTER_DEFINITIONS", () => {
  it("root_harvester exists and attaches to the garden_roots wood node", () => {
    expect(rootHarvesterDef).toBeDefined();
    expect(rootHarvesterDef.nodeId).toBe("garden_roots");
  });

  it("is coal-fueled, same as ore drills (direct instruction: same logic, just for wood)", () => {
    expect(rootHarvesterDef.coalPerCycle).toBeGreaterThan(0);
  });

  it("every tier strictly improves cycle time and/or output over the previous one", () => {
    for (let i = 1; i < rootHarvesterDef.tiers.length; i++) {
      const cur = rootHarvesterDef.tiers[i - 1];
      const next = rootHarvesterDef.tiers[i];
      expect(next.cycleMs).toBeLessThanOrEqual(cur.cycleMs);
      expect(next.woodPerCycle).toBeGreaterThanOrEqual(cur.woodPerCycle);
      expect(next.cycleMs < cur.cycleMs || next.woodPerCycle > cur.woodPerCycle).toBe(true);
    }
  });
});

describe("canAffordBuildHarvester / canAffordUpgradeHarvester", () => {
  it("cannot afford to build without enough materials", () => {
    expect(canAffordBuildHarvester({}, rootHarvesterDef)).toBe(false);
  });

  it("can afford to build with the full cost", () => {
    expect(canAffordBuildHarvester({ ...rootHarvesterDef.buildCost }, rootHarvesterDef)).toBe(true);
  });

  it("cannot afford an upgrade without enough materials", () => {
    expect(canAffordUpgradeHarvester({}, rootHarvesterDef, 1)).toBe(false);
  });

  it("can afford an upgrade with the full cost", () => {
    const next = nextHarvesterTier(rootHarvesterDef, 1)!;
    expect(canAffordUpgradeHarvester({ ...next.upgradeCost }, rootHarvesterDef, 1)).toBe(true);
  });

  it("returns false past the top tier", () => {
    const topTier = rootHarvesterDef.tiers[rootHarvesterDef.tiers.length - 1].tier;
    expect(canAffordUpgradeHarvester({}, rootHarvesterDef, topTier)).toBe(false);
  });
});

describe("tickHarvester", () => {
  it("a fresh harvester (lastCycleAt=0) just starts the clock, produces nothing", () => {
    const harvester = createFreshHarvesterState();
    const result = tickHarvester(harvester, rootHarvesterDef, 1_000_000);
    expect(result.ranCycle).toBe(false);
    expect(result.woodProduced).toBe(0);
    expect(result.harvester.lastCycleAt).toBe(1_000_000);
  });

  it("produces wood and consumes coal after a full cycle elapses", () => {
    const started: HarvesterState = { ...createFreshHarvesterState(), lastCycleAt: 1, coalBuffer: 5, woodBuffer: 0 };
    const tier1 = harvesterTierDefinition(rootHarvesterDef, 1);
    const result = tickHarvester(started, rootHarvesterDef, 1 + tier1.cycleMs);
    expect(result.ranCycle).toBe(true);
    expect(result.woodProduced).toBe(tier1.woodPerCycle);
    expect(result.coalConsumed).toBe(rootHarvesterDef.coalPerCycle);
  });

  it("runs multiple cycles worth of elapsed time in one tick (offline catch-up)", () => {
    const started: HarvesterState = { ...createFreshHarvesterState(), lastCycleAt: 1, coalBuffer: 100, woodBuffer: 0, woodBufferMax: 100 };
    const tier1 = harvesterTierDefinition(rootHarvesterDef, 1);
    const result = tickHarvester(started, rootHarvesterDef, 1 + tier1.cycleMs * 3);
    expect(result.woodProduced).toBe(tier1.woodPerCycle * 3);
    expect(result.stoppedReason).toBeNull();
  });

  it("stops with reason 'no_coal' when the coal buffer runs out mid-run", () => {
    const tier1 = harvesterTierDefinition(rootHarvesterDef, 1);
    const started: HarvesterState = { ...createFreshHarvesterState(), lastCycleAt: 1, coalBuffer: 1, woodBuffer: 0, woodBufferMax: 100 };
    const result = tickHarvester(started, rootHarvesterDef, 1 + tier1.cycleMs * 5);
    expect(result.stoppedReason).toBe("no_coal");
    expect(result.harvester.coalBuffer).toBe(0);
  });

  it("stops with reason 'wood_buffer_full' when the wood buffer is capped", () => {
    const tier1 = harvesterTierDefinition(rootHarvesterDef, 1);
    const started: HarvesterState = { ...createFreshHarvesterState(), lastCycleAt: 1, coalBuffer: 100, woodBuffer: 19, woodBufferMax: 20 };
    const result = tickHarvester(started, rootHarvesterDef, 1 + tier1.cycleMs * 5);
    expect(result.stoppedReason).toBe("wood_buffer_full");
    expect(result.harvester.woodBuffer).toBe(20);
  });
});

describe("refuelHarvester", () => {
  it("adds coal from inventory up to the buffer's remaining space", () => {
    const harvester = { ...createFreshHarvesterState(), coalBuffer: 15, coalBufferMax: 20 };
    const result = refuelHarvester({ coal: 100 }, harvester);
    expect(result.coalAdded).toBe(5);
    expect(result.harvester.coalBuffer).toBe(20);
    expect(result.inventory.coal).toBe(95);
  });

  it("adds nothing if the buffer is already full", () => {
    const harvester = { ...createFreshHarvesterState(), coalBuffer: 20, coalBufferMax: 20 };
    const result = refuelHarvester({ coal: 100 }, harvester);
    expect(result.coalAdded).toBe(0);
  });

  it("adds nothing if the player holds no coal", () => {
    const harvester = { ...createFreshHarvesterState(), coalBuffer: 0, coalBufferMax: 20 };
    const result = refuelHarvester({}, harvester);
    expect(result.coalAdded).toBe(0);
  });
});
