import { describe, it, expect } from "vitest";
import { stockpileCapacityPerMaterial, STOCKPILE_BASE_CAPACITY_PER_MATERIAL } from "../rooms";

describe("stockpileCapacityPerMaterial (2026-07-06 - was a dead upgrade before this)", () => {
  it("ruined stage has zero capacity - the mechanic doesn't exist yet", () => {
    expect(stockpileCapacityPerMaterial("ruined")).toBe(0);
  });

  it("cleared stage gets the base capacity", () => {
    expect(stockpileCapacityPerMaterial("cleared")).toBe(STOCKPILE_BASE_CAPACITY_PER_MATERIAL);
  });

  it("restored stage is 3x base, matching the room's own 'capacity ×3' text", () => {
    expect(stockpileCapacityPerMaterial("restored")).toBe(STOCKPILE_BASE_CAPACITY_PER_MATERIAL * 3);
  });

  it("masterwork stage is 10x base, matching the room's own 'capacity ×10' text", () => {
    expect(stockpileCapacityPerMaterial("masterwork")).toBe(STOCKPILE_BASE_CAPACITY_PER_MATERIAL * 10);
  });

  it("each stage strictly increases capacity - upgrading always helps", () => {
    const cleared = stockpileCapacityPerMaterial("cleared");
    const restored = stockpileCapacityPerMaterial("restored");
    const masterwork = stockpileCapacityPerMaterial("masterwork");
    expect(restored).toBeGreaterThan(cleared);
    expect(masterwork).toBeGreaterThan(restored);
  });
});
