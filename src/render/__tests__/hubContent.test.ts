import { describe, it, expect } from "vitest";
import { hubCellAt } from "../hubContent";

/**
 * Reported directly (2026-07-05): "the coal drill upgrade is placing
 * the copper drill sprite." Root cause: the drill-kind ternary chain
 * in hubCellAt had explicit checks for iron_vein and deepstone, but
 * silently fell through to "drill_copper" for anything else -
 * including coal_seam - despite "drill_coal" being a fully registered,
 * distinct CellKind with its own sprite (see tilesetManifest.ts) that
 * was simply never reached by the chain.
 */
describe("hubCellAt (2026-07-05 regression - coal drill sprite)", () => {
  it("shows drill_coal, not drill_copper, on a drilled coal vein", () => {
    // mine_coal vein is at (16, 28), a 3x3 footprint (cols 16-18, rows 28-30)
    const cell = hubCellAt(
      16, 28,
      {}, {}, {}, 0, false, false, false, false,
      "ruined", "ruined", "ruined", "ruined",
      { mine_coal: 1 } // drillTiers - a tier-1 drill built on the coal vein
    );
    expect(cell.kind).toBe("drill_coal");
  });

  it("still shows drill_copper on a drilled copper vein (sanity check the fix didn't break the existing cases)", () => {
    // mine_copper vein is at (6, 28), 3x3
    const cell = hubCellAt(
      6, 28,
      {}, {}, {}, 0, false, false, false, false,
      "ruined", "ruined", "ruined", "ruined",
      { mine_copper: 1 }
    );
    expect(cell.kind).toBe("drill_copper");
  });
});
