import { describe, it, expect } from "vitest";
import { tickSmeltingEngine, createFreshEngineState, SMELTING_ENGINE_DEFINITIONS } from "../smeltingEngine";
import { TURBINE_SMELT_SPEED_MULTIPLIER } from "../turbine";

const copperEngineDef = SMELTING_ENGINE_DEFINITIONS.find((d) => d.id === "copper_engine")!;
const deepstoneEngineDef = SMELTING_ENGINE_DEFINITIONS.find((d) => d.id === "deepstone_engine")!;

describe("tickSmeltingEngine speed multiplier (2026-07-06, Turbine mechanism)", () => {
  it("with no multiplier (default 1), runs at the definition's own cycle time", () => {
    const engine = { ...createFreshEngineState(), tier: 1, lastCycleAt: 1_000, oreBuffer: 1_000, coalBuffer: 1_000 };
    const tierDef = copperEngineDef.tiers.find((t) => t.tier === 1)!;
    const result = tickSmeltingEngine(engine, copperEngineDef, 1_000 + tierDef.cycleMs);
    expect(result.ranCycle).toBe(true);
    expect(result.ingotsProduced).toBe(tierDef.ingotsPerCycle);
  });

  it("with the Turbine's multiplier, the SAME elapsed time produces proportionally more cycles (and consumes proportionally more ore)", () => {
    const engine = { ...createFreshEngineState(), tier: 1, lastCycleAt: 1_000, oreBuffer: 1_000, coalBuffer: 1_000, ingotBufferMax: 1_000 };
    const tierDef = copperEngineDef.tiers.find((t) => t.tier === 1)!;
    // Same wall-clock time as the single-cycle test above
    const result = tickSmeltingEngine(
      engine, copperEngineDef, 1_000 + tierDef.cycleMs,
      TURBINE_SMELT_SPEED_MULTIPLIER
    );
    expect(result.ranCycle).toBe(true);
    // Should have run ~3x as many cycles in the same wall-clock window
    expect(result.ingotsProduced).toBeGreaterThanOrEqual(tierDef.ingotsPerCycle * (TURBINE_SMELT_SPEED_MULTIPLIER - 1));
    // Ore consumption scales right along with it - NOT a free bonus
    expect(result.oreConsumed).toBeGreaterThan(copperEngineDef.orePerCycle);
  });

  it("still respects ore/fuel limits even when sped up - the whole point is creating a supply bottleneck", () => {
    const engine = { ...createFreshEngineState(), tier: 1, lastCycleAt: 1_000, oreBuffer: copperEngineDef.orePerCycle, coalBuffer: 1_000 };
    const tierDef = copperEngineDef.tiers.find((t) => t.tier === 1)!;
    // Plenty of time to run many cycles, but almost no ore available
    const result = tickSmeltingEngine(
      engine, copperEngineDef, 1_000 + tierDef.cycleMs * 10,
      TURBINE_SMELT_SPEED_MULTIPLIER
    );
    expect(result.oreConsumed).toBeLessThanOrEqual(copperEngineDef.orePerCycle);
  });

  it("consumes exactly one fuel unit per completed copper cycle", () => {
    const engine = { ...createFreshEngineState(), lastCycleAt: 1, oreBuffer: 30, coalBuffer: 2, ingotBufferMax: 100 };
    const result = tickSmeltingEngine(engine, copperEngineDef, 1 + copperEngineDef.tiers[0].cycleMs * 10);
    expect(result.ingotsProduced).toBe(2);
    expect(result.engine.coalBuffer).toBe(0);
  });

  it("the Deepstone Engine consumes hearthsap rather than getting free cycles", () => {
    const engine = { ...createFreshEngineState(), lastCycleAt: 1, oreBuffer: 40, hearthsapBuffer: 1, ingotBufferMax: 100 };
    const result = tickSmeltingEngine(engine, deepstoneEngineDef, 1 + deepstoneEngineDef.tiers[0].cycleMs * 10);
    expect(result.ingotsProduced).toBe(deepstoneEngineDef.tiers[0].ingotsPerCycle);
    expect(result.engine.hearthsapBuffer).toBe(0);
  });
});
