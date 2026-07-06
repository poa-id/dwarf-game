import { describe, it, expect } from "vitest";
import { tickSmeltingEngine, createFreshEngineState, SMELTING_ENGINE_DEFINITIONS } from "../smeltingEngine";
import { TURBINE_SMELT_SPEED_MULTIPLIER } from "../turbine";

const copperEngineDef = SMELTING_ENGINE_DEFINITIONS.find((d) => d.id === "copper_engine")!;

describe("tickSmeltingEngine speed multiplier (2026-07-06, Turbine mechanism)", () => {
  it("with no multiplier (default 1), runs at the definition's own cycle time", () => {
    const engine = { ...createFreshEngineState(), tier: 1, lastCycleAt: 1_000 };
    const tierDef = copperEngineDef.tiers.find((t) => t.tier === 1)!;
    const result = tickSmeltingEngine(engine, copperEngineDef, 1_000 + tierDef.cycleMs, 1_000, 1_000);
    expect(result.ranCycle).toBe(true);
    expect(result.ingotsProduced).toBe(tierDef.ingotsPerCycle);
  });

  it("with the Turbine's multiplier, the SAME elapsed time produces proportionally more cycles (and consumes proportionally more ore)", () => {
    const engine = { ...createFreshEngineState(), tier: 1, lastCycleAt: 1_000 };
    const tierDef = copperEngineDef.tiers.find((t) => t.tier === 1)!;
    // Same wall-clock time as the single-cycle test above
    const result = tickSmeltingEngine(
      engine, copperEngineDef, 1_000 + tierDef.cycleMs, 1_000_000, 1_000_000,
      TURBINE_SMELT_SPEED_MULTIPLIER
    );
    expect(result.ranCycle).toBe(true);
    // Should have run ~3x as many cycles in the same wall-clock window
    expect(result.ingotsProduced).toBeGreaterThanOrEqual(tierDef.ingotsPerCycle * (TURBINE_SMELT_SPEED_MULTIPLIER - 1));
    // Ore consumption scales right along with it - NOT a free bonus
    expect(result.oreConsumed).toBeGreaterThan(copperEngineDef.orePerCycle);
  });

  it("still respects ore/fuel limits even when sped up - the whole point is creating a supply bottleneck", () => {
    const engine = { ...createFreshEngineState(), tier: 1, lastCycleAt: 1_000 };
    const tierDef = copperEngineDef.tiers.find((t) => t.tier === 1)!;
    // Plenty of time to run many cycles, but almost no ore available
    const result = tickSmeltingEngine(
      engine, copperEngineDef, 1_000 + tierDef.cycleMs * 10, copperEngineDef.orePerCycle, 1_000_000,
      TURBINE_SMELT_SPEED_MULTIPLIER
    );
    expect(result.oreConsumed).toBeLessThanOrEqual(copperEngineDef.orePerCycle);
  });
});
