import { describe, it, expect } from "vitest";
import { applyHearthYieldBonus } from "../yieldCurve";

describe("applyHearthYieldBonus", () => {
  it("with no bonus (0), returns the base amount unchanged", () => {
    expect(applyHearthYieldBonus(5, 0)).toBe(5);
    expect(applyHearthYieldBonus(1, 0)).toBe(1);
  });

  it("applies the bonus additively on top of 1x", () => {
    // 10 * 1.05 = 10.5, rounds to 11 (JS rounds half-up)
    expect(applyHearthYieldBonus(10, 0.05)).toBe(11);
    // 10 * 1.15 = 11.5, rounds to 12
    expect(applyHearthYieldBonus(10, 0.15)).toBe(12);
  });

  it("a small base amount can round the bonus away entirely - not a bug, just rounding", () => {
    // 1 * 1.05 = 1.05, rounds back down to 1 - this is the documented
    // caveat for Smithing/Kiln's flat-1 yields.
    expect(applyHearthYieldBonus(1, 0.05)).toBe(1);
  });

  it("caps the combined multiplier at 3x, same ceiling as the XP multiplier", () => {
    // 1 + 2.5 = 3.5x would exceed the cap - clamped to exactly 3x
    expect(applyHearthYieldBonus(10, 2.5)).toBe(30);
    // Even a much larger bonus doesn't exceed the same cap
    expect(applyHearthYieldBonus(10, 100)).toBe(30);
  });

  it("never returns less than the unboosted amount (floor is 1x, never penalizes)", () => {
    expect(applyHearthYieldBonus(7, 0)).toBeGreaterThanOrEqual(7);
    expect(applyHearthYieldBonus(7, 0.05)).toBeGreaterThanOrEqual(7);
  });
});
