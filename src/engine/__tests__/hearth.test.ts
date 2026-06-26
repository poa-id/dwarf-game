import { describe, it, expect } from "vitest";
import {
  tickHearth,
  createInitialHearth,
  FUEL_ABSORPTION_RATE_PER_SEC,
  MAX_OFFLINE_CATCHUP_MS,
  stokeFireDirectly,
  stokeReserve,
  deductFuelValueFromReserve,
  advanceCompanionHauling,
  HAUL_INTERVAL_MS,
  HAUL_AMOUNT_PER_TRIP,
  nextHearthUpgrade,
  canAffordHearthUpgrade,
  isAutoTendingUnlocked,
  HEARTH_UPGRADES,
} from "../hearth";
import { COLOR_STAGES } from "../colorStages";
import type { ResourceBag, HearthState } from "../types";

describe("tickHearth - basic absorption", () => {
  it("absorbs nothing when no time has passed", () => {
    const now = 1_000_000;
    const hearth = createInitialHearth(now);
    const result = tickHearth(hearth, now, 100, true);
    expect(result.fuelAbsorbed).toBe(0);
  });

  it("absorbs fuel proportional to elapsed time when fuel is available", () => {
    const start = 1_000_000;
    const hearth = createInitialHearth(start);
    const tenSecondsLater = start + 10_000;
    const result = tickHearth(hearth, tenSecondsLater, 1000, true);
    expect(result.fuelAbsorbed).toBeCloseTo(10 * FUEL_ABSORPTION_RATE_PER_SEC, 5);
  });

  it("is capped by bankedFuelAvailable, never absorbs more than exists", () => {
    const start = 1_000_000;
    const hearth = createInitialHearth(start);
    const tenSecondsLater = start + 10_000;
    // only 1 fuel available, even though 10s of absorption would want 5
    const result = tickHearth(hearth, tenSecondsLater, 1, true);
    expect(result.fuelAbsorbed).toBe(1);
  });

  it("never goes negative if now < lastUpdated (clock skew safety)", () => {
    const start = 1_000_000;
    const hearth = createInitialHearth(start);
    const result = tickHearth(hearth, start - 5000, 1000, true);
    expect(result.fuelAbsorbed).toBe(0);
  });
});

describe("tickHearth - offline catch-up cap", () => {
  it("caps elapsed time at MAX_OFFLINE_CATCHUP_MS even if real elapsed is much larger", () => {
    const start = 1_000_000;
    const hearth = createInitialHearth(start);
    const oneWeekLater = start + 7 * 24 * 60 * 60 * 1000;
    const hugeFuelAvailable = 1_000_000;
    const result = tickHearth(hearth, oneWeekLater, hugeFuelAvailable, true);
    const expectedMaxAbsorption =
      (MAX_OFFLINE_CATCHUP_MS / 1000) * FUEL_ABSORPTION_RATE_PER_SEC;
    expect(result.fuelAbsorbed).toBeCloseTo(expectedMaxAbsorption, 5);
  });

  it("lastUpdated always advances to `now`, even when capped (prevents re-claiming the same window twice)", () => {
    const start = 1_000_000;
    const hearth = createInitialHearth(start);
    const oneWeekLater = start + 7 * 24 * 60 * 60 * 1000;
    const result = tickHearth(hearth, oneWeekLater, 1_000_000, true);
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
    const result = tickHearth(hearth, start + secondsNeeded * 1000, Infinity, true);
    expect(result.colorStageIncreased).toBe(true);
    expect(result.hearth.colorStage).toBe(1);
  });

  it("does not increase colorStage if fuel availability blocks absorption", () => {
    const start = 0;
    const hearth = createInitialHearth(start);
    const secondsNeeded = COLOR_STAGES[1].fuelThreshold / FUEL_ABSORPTION_RATE_PER_SEC;
    // time passes, but ZERO fuel is available -> no absorption -> no stage change
    const result = tickHearth(hearth, start + secondsNeeded * 1000, 0, true);
    expect(result.colorStageIncreased).toBe(false);
    expect(result.hearth.colorStage).toBe(0);
  });

  it("lifetimeFuel never decreases across repeated ticks, even though fuel (current) is just a balance", () => {
    let hearth = createInitialHearth(0);
    let t = 0;
    for (let i = 0; i < 5; i++) {
      t += 10_000;
      const result = tickHearth(hearth, t, 1000, true);
      expect(result.hearth.lifetimeFuel).toBeGreaterThanOrEqual(hearth.lifetimeFuel);
      hearth = result.hearth;
    }
  });
});

describe("stokeFireDirectly", () => {
  it("throws for a material that isn't a recognized hearth fuel", () => {
    const hearth = createInitialHearth(0);
    const inv: ResourceBag = { copper_ore: 10 };
    expect(() => stokeFireDirectly(hearth, inv, "copper_ore", 1, 1000, true)).toThrow();
  });

  it("throws if amount is not positive", () => {
    const hearth = createInitialHearth(0);
    const inv: ResourceBag = { coal: 10 };
    expect(() => stokeFireDirectly(hearth, inv, "coal", 0, 1000, true)).toThrow();
  });

  it("throws if there isn't enough of the material held", () => {
    const hearth = createInitialHearth(0);
    const inv: ResourceBag = { coal: 2 };
    expect(() => stokeFireDirectly(hearth, inv, "coal", 5, 1000, true)).toThrow();
  });

  it("adds fuelAdded weighted by the material's heatValue (coal=10)", () => {
    const hearth = createInitialHearth(0);
    const inv: ResourceBag = { coal: 5 };
    const result = stokeFireDirectly(hearth, inv, "coal", 3, 1000, true);
    expect(result.fuelAdded).toBe(30); // 3 * 10
  });

  it("adds fuelAdded weighted by wood's lower heatValue (wood=4)", () => {
    const hearth = createInitialHearth(0);
    const inv: ResourceBag = { wood: 5 };
    const result = stokeFireDirectly(hearth, inv, "wood", 3, 1000, true);
    expect(result.fuelAdded).toBe(12); // 3 * 4
  });

  it("deducts exactly the stoked amount from inventory", () => {
    const hearth = createInitialHearth(0);
    const inv: ResourceBag = { coal: 10 };
    const result = stokeFireDirectly(hearth, inv, "coal", 4, 1000, true);
    expect(result.inventory.coal).toBe(6);
  });

  it("increases lifetimeFuel and updates lastUpdated to `now`", () => {
    const hearth = createInitialHearth(0);
    const inv: ResourceBag = { coal: 10 };
    const result = stokeFireDirectly(hearth, inv, "coal", 2, 5000, true);
    expect(result.hearth.lifetimeFuel).toBe(20);
    expect(result.hearth.lastUpdated).toBe(5000);
  });

  it("reports colorStageIncreased when stoking crosses a threshold", () => {
    const hearth = createInitialHearth(0);
    const threshold = COLOR_STAGES[1].fuelThreshold; // 500
    const coalNeeded = Math.ceil(threshold / 10); // heatValue 10 per coal
    const inv: ResourceBag = { coal: coalNeeded };
    const result = stokeFireDirectly(hearth, inv, "coal", coalNeeded, 1000, true);
    expect(result.colorStageIncreased).toBe(true);
  });

  it("does not mutate the input hearth or inventory (pure function)", () => {
    const hearth = createInitialHearth(0);
    const inv: ResourceBag = { coal: 10 };
    stokeFireDirectly(hearth, inv, "coal", 3, 1000, true);
    expect(hearth.lifetimeFuel).toBe(0);
    expect(inv.coal).toBe(10);
  });
});

describe("hearth upgrades", () => {
  it("nextHearthUpgrade(0) returns tier 1 (Friend of Burden)", () => {
    expect(nextHearthUpgrade(0)?.name).toBe("Friend of Burden");
  });

  it("returns null once all upgrades are exhausted", () => {
    const maxTier = HEARTH_UPGRADES[HEARTH_UPGRADES.length - 1].tier;
    expect(nextHearthUpgrade(maxTier)).toBeNull();
  });

  it("canAffordHearthUpgrade respects insight cost for tier 1", () => {
    expect(canAffordHearthUpgrade(100, 0)).toBe(false); // costs 250
    expect(canAffordHearthUpgrade(250, 0)).toBe(true);
  });

  it("isAutoTendingUnlocked is false below tier 1, true at tier 1+", () => {
    expect(isAutoTendingUnlocked(0)).toBe(false);
    expect(isAutoTendingUnlocked(1)).toBe(true);
    expect(isAutoTendingUnlocked(2)).toBe(true);
  });
});

describe("stokeReserve", () => {
  it("moves material from inventory into the reserve, not the fire", () => {
    const inv: ResourceBag = { coal: 10 };
    const reserve: ResourceBag = {};
    const result = stokeReserve(inv, reserve, "coal", 4);
    expect(result.inventory.coal).toBe(6);
    expect(result.fuelReserve.coal).toBe(4);
  });

  it("throws for a non-fuel material", () => {
    const inv: ResourceBag = { copper_ore: 10 };
    expect(() => stokeReserve(inv, {}, "copper_ore", 1)).toThrow();
  });

  it("throws if not enough held", () => {
    const inv: ResourceBag = { coal: 2 };
    expect(() => stokeReserve(inv, {}, "coal", 5)).toThrow();
  });

  it("accumulates correctly across multiple bankings", () => {
    let inv: ResourceBag = { coal: 10 };
    let reserve: ResourceBag = {};
    let result = stokeReserve(inv, reserve, "coal", 3);
    inv = result.inventory;
    reserve = result.fuelReserve;
    result = stokeReserve(inv, reserve, "coal", 2);
    expect(result.fuelReserve.coal).toBe(5);
  });
});

describe("deductFuelValueFromReserve", () => {
  it("deducts coal (highest heat) before wood when both are present", () => {
    const reserve: ResourceBag = { coal: 5, wood: 5 }; // coal heat=10, wood heat=4
    const result = deductFuelValueFromReserve(reserve, 30); // should consume 3 coal (30 value), leave wood untouched
    expect(result.coal).toBe(2);
    expect(result.wood).toBe(5);
  });

  it("falls back to wood once coal runs out", () => {
    const reserve: ResourceBag = { coal: 2, wood: 5 }; // 2 coal = 20 value
    const result = deductFuelValueFromReserve(reserve, 30); // needs 10 more value -> 2.5 wood
    expect(result.coal).toBe(0);
    expect(result.wood).toBeCloseTo(2.5, 5);
  });

  it("never goes negative if the reserve has less than requested", () => {
    const reserve: ResourceBag = { coal: 1 };
    const result = deductFuelValueFromReserve(reserve, 1000);
    expect(result.coal).toBe(0);
  });

  it("does not mutate the input reserve", () => {
    const reserve: ResourceBag = { coal: 5 };
    deductFuelValueFromReserve(reserve, 10);
    expect(reserve.coal).toBe(5);
  });
});

describe("advanceCompanionHauling", () => {
  it("hauls nothing if less than one full interval has elapsed", () => {
    const inv: ResourceBag = { coal: 10 };
    const result = advanceCompanionHauling(inv, {}, 0, HAUL_INTERVAL_MS - 1);
    expect(result.hauled).toBe(false);
    expect(result.inventory).toEqual(inv);
  });

  it("hauls HAUL_AMOUNT_PER_TRIP once exactly one interval has elapsed", () => {
    const inv: ResourceBag = { coal: 10 };
    const result = advanceCompanionHauling(inv, {}, 0, HAUL_INTERVAL_MS);
    expect(result.hauled).toBe(true);
    expect(result.fuelReserve.coal).toBe(HAUL_AMOUNT_PER_TRIP);
    expect(result.inventory.coal).toBe(10 - HAUL_AMOUNT_PER_TRIP);
  });

  it("hauls multiple trips worth if a large time gap elapsed (offline catch-up)", () => {
    const inv: ResourceBag = { coal: 10 };
    const result = advanceCompanionHauling(inv, {}, 0, HAUL_INTERVAL_MS * 3);
    expect(result.fuelReserve.coal).toBe(HAUL_AMOUNT_PER_TRIP * 3);
  });

  it("picks whichever fuel material is currently held in greater quantity", () => {
    const inv: ResourceBag = { coal: 2, wood: 50 };
    const result = advanceCompanionHauling(inv, {}, 0, HAUL_INTERVAL_MS);
    expect(result.fuelReserve.wood).toBe(HAUL_AMOUNT_PER_TRIP);
    expect(result.fuelReserve.coal).toBeUndefined();
  });

  it("caps hauled amount at what's actually held, even across many elapsed trips", () => {
    const inv: ResourceBag = { coal: 2 };
    const result = advanceCompanionHauling(inv, {}, 0, HAUL_INTERVAL_MS * 10); // would want 10 trips worth, only 2 coal exists
    expect(result.fuelReserve.coal).toBe(2);
    expect(result.inventory.coal).toBe(0);
  });

  it("still advances the clock even with nothing to haul, to avoid a backlog once fuel exists again", () => {
    const result = advanceCompanionHauling({}, {}, 0, HAUL_INTERVAL_MS * 3);
    expect(result.hauled).toBe(false);
    expect(result.lastHaulAt).toBe(HAUL_INTERVAL_MS * 3);
  });

  it("does not mutate inputs", () => {
    const inv: ResourceBag = { coal: 10 };
    const reserve: ResourceBag = {};
    advanceCompanionHauling(inv, reserve, 0, HAUL_INTERVAL_MS);
    expect(inv.coal).toBe(10);
    expect(reserve).toEqual({});
  });
});

describe("colorStage capped before the first rekindle (fixed 2026-06-23 - was a real bug)", () => {
  it("stokeFireDirectly: lifetimeFuel crosses the Stage 1 threshold, but colorStage stays 0 if hasRekindledOnce=false", () => {
    const hearth = createInitialHearth(0);
    const inv: ResourceBag = { coal: 100 };
    // 60 coal * heatValue 10 = 600 fuel value, comfortably past the 500 threshold
    const result = stokeFireDirectly(hearth, inv, "coal", 60, 1000, false);
    expect(result.hearth.lifetimeFuel).toBeGreaterThanOrEqual(COLOR_STAGES[1].fuelThreshold);
    expect(result.hearth.colorStage).toBe(0); // capped - the player hasn't actually rekindled yet
  });

  it("stokeFireDirectly: the SAME fuel crossing, but hasRekindledOnce=true, reaches the real stage", () => {
    const hearth = createInitialHearth(0);
    const inv: ResourceBag = { coal: 100 };
    const result = stokeFireDirectly(hearth, inv, "coal", 60, 1000, true);
    expect(result.hearth.colorStage).toBe(1); // uncapped - matches the real pure-fuel stage
  });

  it("tickHearth: same capping behavior for the passive path", () => {
    const start = 1_000_000;
    const hearth = { ...createInitialHearth(start), lifetimeFuel: 499 };
    const tenSecondsLater = start + 10_000; // absorbs 10s * 0.5/sec = 5 fuel value -> crosses 500
    const cappedResult = tickHearth(hearth, tenSecondsLater, 1000, false);
    expect(cappedResult.hearth.lifetimeFuel).toBeGreaterThanOrEqual(COLOR_STAGES[1].fuelThreshold);
    expect(cappedResult.hearth.colorStage).toBe(0);

    const uncappedResult = tickHearth(hearth, tenSecondsLater, 1000, true);
    expect(uncappedResult.hearth.colorStage).toBe(1);
  });

  it("colorStageIncreased is false while capped, even though real lifetime fuel growth occurred - prevents the color_stage_1 narrator line from firing early", () => {
    const hearth = createInitialHearth(0);
    const inv: ResourceBag = { coal: 100 };
    const result = stokeFireDirectly(hearth, inv, "coal", 60, 1000, false);
    expect(result.colorStageIncreased).toBe(false);
  });

  it("once uncapped (post-rekindle), a FUTURE stoke correctly reports colorStageIncreased", () => {
    // Simulates: capped while pre-rekindle (lifetimeFuel already past
    // 500, colorStage pinned at 0), THEN the player rekindles, THEN
    // stokes again - colorStage should now actually jump to 1 and
    // report the increase, even though lifetimeFuel itself didn't
    // newly cross anything (it already had).
    const cappedHearth: HearthState = {
      ...createInitialHearth(0),
      lifetimeFuel: 600,
      colorStage: 0, // still pinned, as it would be while capped
    };
    const inv: ResourceBag = { coal: 10 };
    const result = stokeFireDirectly(cappedHearth, inv, "coal", 1, 1000, true); // hasRekindledOnce now true
    expect(result.hearth.colorStage).toBe(1);
    expect(result.colorStageIncreased).toBe(true);
  });

  it("stages 2 and 3 are NOT capped once the player has rekindled once - they remain pure functions of lifetimeFuel, exactly as before this fix", () => {
    const hearth = { ...createInitialHearth(0), lifetimeFuel: 4999 };
    const inv: ResourceBag = { coal: 100 };
    // 1 coal = 10 fuel value, pushes lifetimeFuel to 5009, past the Stage 2 threshold (5000)
    const result = stokeFireDirectly(hearth, inv, "coal", 1, 1000, true);
    expect(result.hearth.colorStage).toBe(2);
  });
});
