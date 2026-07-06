import { describe, it, expect } from "vitest";
import {
  DRILL_DEFINITIONS,
  createFreshDrillState,
  drillDefinitionByVeinId,
  drillTierDefinition,
  nextDrillTier,
  canAffordBuildDrill,
  canAffordUpgradeDrill,
  tickDrill,
  refuelDrill,
  collectDrillOre,
  drillSpeedMultiplier,
  MINESHAFT_DEPTH1_DRILL_SPEED_BONUS,
  type DrillState,
} from "../drill";
import type { ResourceBag } from "../types";

const copperDrillDef = drillDefinitionByVeinId("mine_copper")!;
const coalDrillDef = drillDefinitionByVeinId("mine_coal")!;

describe("DRILL_DEFINITIONS", () => {
  it("has a definition for every ore vein referenced in hubMap's ORE_VEINS", () => {
    // mine_copper and mine_iron predate the shaft depth system; mine_coal
    // was added alongside it. mine_deepstone intentionally has none yet
    // (no deepstone drill built) - not asserted here since that's a
    // still-open gap, not a regression to guard against.
    expect(drillDefinitionByVeinId("mine_copper")).toBeDefined();
    expect(drillDefinitionByVeinId("mine_iron")).toBeDefined();
    expect(drillDefinitionByVeinId("mine_coal")).toBeDefined();
  });

  it("coal drill requires Mine Shaft depth 1, unlike copper/iron drills", () => {
    expect(coalDrillDef.requiresShaftDepth).toBe(1);
    expect(copperDrillDef.requiresShaftDepth).toBeUndefined();
    expect(drillDefinitionByVeinId("mine_iron")!.requiresShaftDepth).toBeUndefined();
  });

  it("coal drill produces the coal material", () => {
    expect(coalDrillDef.oreMaterialId).toBe("coal");
  });

  it("every drill definition has at least a tier 1 and tiers are sequential", () => {
    for (const def of DRILL_DEFINITIONS) {
      expect(def.tiers.length).toBeGreaterThan(0);
      def.tiers.forEach((t, i) => expect(t.tier).toBe(i + 1));
    }
  });
});

describe("Coal Drill needs no fuel (2026-07-06 regression - was self-consuming its own output)", () => {
  it("coal_drill's coalPerCycle is 0 - reported directly as ridiculous that mining coal required coal", () => {
    expect(coalDrillDef.coalPerCycle).toBe(0);
  });

  it("runs cycles continuously with an empty coal buffer, never blocked by 'no_coal'", () => {
    const drill: DrillState = {
      tier: 1,
      coalBuffer: 0, // completely empty - would have blocked every other drill
      oreBuffer: 0,
      lastCycleAt: 1_000,
      coalBufferMax: 20,
      oreBufferMax: 20,
      bufferTier: 0,
    };
    const result = tickDrill(drill, coalDrillDef, 1_000 + 30_000);
    expect(result.ranCycle).toBe(true);
    expect(result.oreProduced).toBeGreaterThan(0);
    expect(result.stoppedReason).not.toBe("no_coal");
  });

  it("still stops once the ORE buffer is full (the only real limit now)", () => {
    const drill: DrillState = {
      tier: 1,
      coalBuffer: 0,
      oreBuffer: 20,
      lastCycleAt: 1_000,
      coalBufferMax: 20,
      oreBufferMax: 20,
      bufferTier: 0,
    };
    const result = tickDrill(drill, coalDrillDef, 1_000 + 30_000);
    expect(result.ranCycle).toBe(false);
    expect(result.stoppedReason).toBe("ore_buffer_full");
  });
});

describe("advanceDrillHauling excludes fuel-less drills (2026-07-06 regression)", () => {
  it("does not target the coal drill for coal hauling - it never consumes it", async () => {
    const { advanceDrillHauling } = await import("../hearth");
    const drills = {
      mine_coal: { tier: 1, coalBuffer: 0, oreBuffer: 0, lastCycleAt: 0, coalBufferMax: 20, oreBufferMax: 20, bufferTier: 0 },
      mine_copper: { tier: 1, coalBuffer: 0, oreBuffer: 0, lastCycleAt: 0, coalBufferMax: 20, oreBufferMax: 20, bufferTier: 0 },
    };
    const result = advanceDrillHauling({ coal: 10 }, drills, 2);
    expect(result.hauled).toBe(true);
    // Coal should have gone to the copper drill, not the coal drill
    expect(result.drills.mine_coal.coalBuffer).toBe(0);
    expect(result.drills.mine_copper.coalBuffer).toBeGreaterThan(0);
  });
});

describe("drillTierDefinition / nextDrillTier", () => {
  it("returns the matching tier, falling back to tier 1 for an unknown tier", () => {
    expect(drillTierDefinition(copperDrillDef, 2).name).toBe("Sharpened Bits");
    expect(drillTierDefinition(copperDrillDef, 99)).toBe(copperDrillDef.tiers[0]);
  });

  it("nextDrillTier returns null past the max tier", () => {
    const maxTier = copperDrillDef.tiers.length;
    expect(nextDrillTier(copperDrillDef, maxTier)).toBeNull();
    expect(nextDrillTier(copperDrillDef, 1)?.tier).toBe(2);
  });
});

describe("canAffordBuildDrill / canAffordUpgradeDrill", () => {
  it("build cost check requires every material in buildCost", () => {
    const short: ResourceBag = { copper_ingot: 20, wood: 10 }; // missing iron_ingot
    const full: ResourceBag = { copper_ingot: 20, wood: 10, iron_ingot: 5 };
    expect(canAffordBuildDrill(copperDrillDef, short)).toBe(false);
    expect(canAffordBuildDrill(copperDrillDef, full)).toBe(true);
  });

  it("upgrade cost check is per the NEXT tier, and false past max tier", () => {
    const inv: ResourceBag = { iron_ingot: 10 };
    expect(canAffordUpgradeDrill(copperDrillDef, 1, inv)).toBe(true);
    expect(canAffordUpgradeDrill(copperDrillDef, 1, {})).toBe(false);
    const maxTier = copperDrillDef.tiers.length;
    expect(canAffordUpgradeDrill(copperDrillDef, maxTier, { true_copper: 999, iron_ingot: 999 })).toBe(false);
  });
});

describe("tickDrill", () => {
  it("a fresh drill (lastCycleAt=0) just starts the clock, produces nothing", () => {
    const drill = createFreshDrillState();
    const result = tickDrill(drill, copperDrillDef, 1_000_000);
    expect(result.ranCycle).toBe(false);
    expect(result.oreProduced).toBe(0);
    expect(result.drill.lastCycleAt).toBe(1_000_000);
  });

  it("produces ore and consumes coal after a full cycle elapses", () => {
    const started: DrillState = { ...createFreshDrillState(), lastCycleAt: 1, coalBuffer: 5, oreBuffer: 0 };
    const tier1 = drillTierDefinition(copperDrillDef, 1);
    const result = tickDrill(started, copperDrillDef, 1 + tier1.cycleMs);
    expect(result.ranCycle).toBe(true);
    expect(result.oreProduced).toBe(tier1.orePerCycle);
    expect(result.coalConsumed).toBe(copperDrillDef.coalPerCycle);
    expect(result.drill.coalBuffer).toBe(5 - copperDrillDef.coalPerCycle);
  });

  it("runs multiple cycles worth of elapsed time in one tick (offline catch-up)", () => {
    const started: DrillState = { ...createFreshDrillState(), lastCycleAt: 1, coalBuffer: 100, oreBuffer: 0, oreBufferMax: 100 };
    const tier1 = drillTierDefinition(copperDrillDef, 1);
    const result = tickDrill(started, copperDrillDef, 1 + tier1.cycleMs * 3);
    expect(result.oreProduced).toBe(tier1.orePerCycle * 3);
    expect(result.stoppedReason).toBeNull();
  });

  it("stops with reason 'no_coal' when the coal buffer runs out mid-run", () => {
    const tier1 = drillTierDefinition(copperDrillDef, 1);
    const started: DrillState = { ...createFreshDrillState(), lastCycleAt: 1, coalBuffer: 1, oreBuffer: 0, oreBufferMax: 100 };
    const result = tickDrill(started, copperDrillDef, 1 + tier1.cycleMs * 5);
    expect(result.stoppedReason).toBe("no_coal");
    expect(result.drill.coalBuffer).toBe(0);
  });

  it("stops with reason 'ore_buffer_full' when ore has nowhere to go", () => {
    const tier1 = drillTierDefinition(copperDrillDef, 1);
    const started: DrillState = { ...createFreshDrillState(), lastCycleAt: 1, coalBuffer: 100, oreBuffer: 0, oreBufferMax: 1 };
    const result = tickDrill(started, copperDrillDef, 1 + tier1.cycleMs * 5);
    expect(result.stoppedReason).toBe("ore_buffer_full");
    expect(result.drill.oreBuffer).toBe(1);
  });

  it("tier 0 (not built) never runs a cycle regardless of elapsed time", () => {
    const drill: DrillState = { ...createFreshDrillState(), tier: 0, lastCycleAt: 1 };
    const result = tickDrill(drill, copperDrillDef, 10_000_000);
    expect(result.ranCycle).toBe(false);
  });

  describe("speed multiplier (Mine Shaft depth 1 bonus)", () => {
    it("defaults to no bonus when the multiplier argument is omitted", () => {
      const tier1 = drillTierDefinition(copperDrillDef, 1);
      const started: DrillState = { ...createFreshDrillState(), lastCycleAt: 1, coalBuffer: 5, oreBuffer: 0 };
      // Exactly one un-boosted cycle's worth of time - should NOT have
      // completed a cycle yet if a bonus were silently applied.
      const justUnderOneCycle = 1 + tier1.cycleMs - 1;
      const result = tickDrill(started, copperDrillDef, justUnderOneCycle);
      expect(result.ranCycle).toBe(false);
    });

    it("a >1 multiplier completes a cycle in less real time than the base cycleMs", () => {
      const tier1 = drillTierDefinition(copperDrillDef, 1);
      const started: DrillState = { ...createFreshDrillState(), lastCycleAt: 1, coalBuffer: 5, oreBuffer: 0 };
      const multiplier = drillSpeedMultiplier(1); // depth 1 = +10%
      expect(multiplier).toBeCloseTo(1 + MINESHAFT_DEPTH1_DRILL_SPEED_BONUS);

      const effectiveCycleMs = Math.round(tier1.cycleMs / multiplier);
      // At the boosted effective cycle time, a cycle SHOULD have completed.
      const boosted = tickDrill(started, copperDrillDef, 1 + effectiveCycleMs, multiplier);
      expect(boosted.ranCycle).toBe(true);

      // But not yet at that same elapsed time with no bonus applied.
      const unboosted = tickDrill(started, copperDrillDef, 1 + effectiveCycleMs, 1);
      expect(unboosted.ranCycle).toBe(false);
    });

    it("drillSpeedMultiplier is 1 below depth 1, and matches the promised +10% at depth 1+", () => {
      expect(drillSpeedMultiplier(0)).toBe(1);
      expect(drillSpeedMultiplier(1)).toBeCloseTo(1.10);
      expect(drillSpeedMultiplier(2)).toBeCloseTo(1.10); // no further bonus defined past depth 1 yet
    });
  });
});

describe("tickDrill gem drops (2026-07-06 regression - automation used to never roll for them at all)", () => {
  it("rolls a bonus gem on a copper drill's cycle when the roll succeeds", () => {
    const started: DrillState = { ...createFreshDrillState(), lastCycleAt: 1, coalBuffer: 10, oreBuffer: 0, oreBufferMax: 100 };
    const tier1 = drillTierDefinition(copperDrillDef, 1);
    // roll of 0 always beats any positive chance threshold
    const result = tickDrill(started, copperDrillDef, 1 + tier1.cycleMs, 1, 0, () => 0);
    expect(result.gemsGained.rough_quartz).toBe(1);
  });

  it("does not roll a gem when the roll fails", () => {
    const started: DrillState = { ...createFreshDrillState(), lastCycleAt: 1, coalBuffer: 10, oreBuffer: 0, oreBufferMax: 100 };
    const tier1 = drillTierDefinition(copperDrillDef, 1);
    // roll of 0.999 always beats a small chance threshold (fails to drop)
    const result = tickDrill(started, copperDrillDef, 1 + tier1.cycleMs, 1, 0, () => 0.999);
    expect(result.gemsGained.rough_quartz ?? 0).toBe(0);
  });

  it("rolls once per cycle when multiple cycles run in one tick, not once per tick", () => {
    const started: DrillState = { ...createFreshDrillState(), lastCycleAt: 1, coalBuffer: 100, oreBuffer: 0, oreBufferMax: 100 };
    const tier1 = drillTierDefinition(copperDrillDef, 1);
    const result = tickDrill(started, copperDrillDef, 1 + tier1.cycleMs * 5, 1, 0, () => 0);
    expect(result.gemsGained.rough_quartz).toBe(5);
  });

  it("respects gemDropChanceBonus, same as a manual strike would", () => {
    const started: DrillState = { ...createFreshDrillState(), lastCycleAt: 1, coalBuffer: 10, oreBuffer: 0, oreBufferMax: 100 };
    const tier1 = drillTierDefinition(copperDrillDef, 1);
    // A roll that fails the BASE chance (0.02) but passes with a big bonus
    const result = tickDrill(started, copperDrillDef, 1 + tier1.cycleMs, 1, 0.5, () => 0.3);
    expect(result.gemsGained.rough_quartz).toBe(1);
  });

  it("coal drills never roll for gems - coal seams have no gemDrop config, same as manual coal mining", () => {
    const coalDrillDef = drillDefinitionByVeinId("mine_coal")!;
    const started: DrillState = { ...createFreshDrillState(), lastCycleAt: 1, coalBuffer: 0, oreBuffer: 0, oreBufferMax: 100 };
    const tier1 = drillTierDefinition(coalDrillDef, 1);
    const result = tickDrill(started, coalDrillDef, 1 + tier1.cycleMs, 1, 0, () => 0);
    expect(Object.keys(result.gemsGained).length).toBe(0);
  });
});

describe("refuelDrill", () => {
  it("fills the coal buffer from inventory up to capacity, no more", () => {
    const drill = createFreshDrillState(); // coalBufferMax defaults to 20
    const result = refuelDrill({ coal: 5 }, drill);
    expect(result.coalAdded).toBe(5);
    expect(result.drill.coalBuffer).toBe(5);
    expect(result.inventory.coal).toBe(0);
  });

  it("caps at buffer space remaining even with excess carried coal", () => {
    const drill: DrillState = { ...createFreshDrillState(), coalBuffer: 18 }; // 2 space left of 20 max
    const result = refuelDrill({ coal: 50 }, drill);
    expect(result.coalAdded).toBe(2);
    expect(result.drill.coalBuffer).toBe(20);
    expect(result.inventory.coal).toBe(48);
  });

  it("is a no-op when carrying no coal", () => {
    const drill = createFreshDrillState();
    const result = refuelDrill({}, drill);
    expect(result.coalAdded).toBe(0);
    expect(result.drill).toBe(drill);
  });
});

describe("collectDrillOre", () => {
  it("moves the full ore buffer into inventory and empties the buffer", () => {
    const drill: DrillState = { ...createFreshDrillState(), oreBuffer: 7 };
    const result = collectDrillOre({}, drill, copperDrillDef);
    expect(result.oreCollected).toBe(7);
    expect(result.drill.oreBuffer).toBe(0);
    expect(result.inventory.copper_ore).toBe(7);
  });

  it("is a no-op when the ore buffer is empty", () => {
    const drill = createFreshDrillState();
    const result = collectDrillOre({}, drill, copperDrillDef);
    expect(result.oreCollected).toBe(0);
    expect(result.drill).toBe(drill);
  });
});
