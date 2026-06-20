import { describe, it, expect } from "vitest";
import {
  tickHearth,
  createInitialHearth,
  FUEL_ABSORPTION_RATE_PER_SEC,
  MAX_OFFLINE_CATCHUP_MS,
} from "../hearth";
import { COLOR_STAGES } from "../colorStages";

describe("tickHearth - basic absorption", () => {
  it("absorbs nothing when no time has passed", () => {
    const now = 1_000_000;
    const hearth = createInitialHearth(now);
    const result = tickHearth(hearth, now, 100);
    expect(result.fuelAbsorbed).toBe(0);
  });

  it("absorbs fuel proportional to elapsed time when fuel is available", () => {
    const start = 1_000_000;
    const hearth = createInitialHearth(start);
    const tenSecondsLater = start + 10_000;
    const result = tickHearth(hearth, tenSecondsLater, 1000);
    expect(result.fuelAbsorbed).toBeCloseTo(10 * FUEL_ABSORPTION_RATE_PER_SEC, 5);
  });

  it("is capped by bankedFuelAvailable, never absorbs more than exists", () => {
    const start = 1_000_000;
    const hearth = createInitialHearth(start);
    const tenSecondsLater = start + 10_000;
    // only 1 fuel available, even though 10s of absorption would want 5
    const result = tickHearth(hearth, tenSecondsLater, 1);
    expect(result.fuelAbsorbed).toBe(1);
  });

  it("never goes negative if now < lastUpdated (clock skew safety)", () => {
    const start = 1_000_000;
    const hearth = createInitialHearth(start);
    const result = tickHearth(hearth, start - 5000, 1000);
    expect(result.fuelAbsorbed).toBe(0);
  });
});

describe("tickHearth - offline catch-up cap", () => {
  it("caps elapsed time at MAX_OFFLINE_CATCHUP_MS even if real elapsed is much larger", () => {
    const start = 1_000_000;
    const hearth = createInitialHearth(start);
    const oneWeekLater = start + 7 * 24 * 60 * 60 * 1000;
    const hugeFuelAvailable = 1_000_000;
    const result = tickHearth(hearth, oneWeekLater, hugeFuelAvailable);
    const expectedMaxAbsorption =
      (MAX_OFFLINE_CATCHUP_MS / 1000) * FUEL_ABSORPTION_RATE_PER_SEC;
    expect(result.fuelAbsorbed).toBeCloseTo(expectedMaxAbsorption, 5);
  });

  it("lastUpdated always advances to `now`, even when capped (prevents re-claiming the same window twice)", () => {
    const start = 1_000_000;
    const hearth = createInitialHearth(start);
    const oneWeekLater = start + 7 * 24 * 60 * 60 * 1000;
    const result = tickHearth(hearth, oneWeekLater, 1_000_000);
    expect(result.hearth.lastUpdated).toBe(oneWeekLater);
  });
});

describe("tickHearth - color stage progression", () => {
  it("reports colorStageIncreased=true when crossing a threshold", () => {
    const start = 0;
    const hearth = createInitialHearth(start);
    const firstThreshold = COLOR_STAGES[1].fuelThreshold; // 500
    // enough time for absorption to exceed threshold, fuel freely available
    const secondsNeeded = firstThreshold / FUEL_ABSORPTION_RATE_PER_SEC;
    const result = tickHearth(hearth, start + secondsNeeded * 1000, Infinity);
    expect(result.colorStageIncreased).toBe(true);
    expect(result.hearth.colorStage).toBe(1);
  });

  it("does not increase colorStage if fuel availability blocks absorption", () => {
    const start = 0;
    const hearth = createInitialHearth(start);
    const secondsNeeded = COLOR_STAGES[1].fuelThreshold / FUEL_ABSORPTION_RATE_PER_SEC;
    // time passes, but ZERO fuel is available -> no absorption -> no stage change
    const result = tickHearth(hearth, start + secondsNeeded * 1000, 0);
    expect(result.colorStageIncreased).toBe(false);
    expect(result.hearth.colorStage).toBe(0);
  });

  it("lifetimeFuel never decreases across repeated ticks, even though fuel (current) is just a balance", () => {
    let hearth = createInitialHearth(0);
    let t = 0;
    for (let i = 0; i < 5; i++) {
      t += 10_000;
      const result = tickHearth(hearth, t, 1000);
      expect(result.hearth.lifetimeFuel).toBeGreaterThanOrEqual(hearth.lifetimeFuel);
      hearth = result.hearth;
    }
  });
});
