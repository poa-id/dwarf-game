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

describe("Sealed rooms have a real rubble interior, not void (2026-07-06 regression)", () => {
  // Reported directly with a screenshot: "The stockpile room looks
  // really weird." Root cause: only a thin rubble "face" was filled at
  // each sealed room's entrance - the room's actual interior defaulted
  // to rock_wall in the static grid, got voided by the void-conversion
  // pass, and stayed void forever even after the room was cleared
  // (the "reveal on clear" overrides only ever converted rubble/
  // rock_wall, never void). Checking deep-interior points (well clear
  // of each room's approach corridor, which must legitimately stay
  // open) against the STATIC grid confirms they're rubble, not void.
  it("Stockpile (sealed_east) interior is rubble, not void", async () => {
    const { getHubGrid } = await import("../hubContent");
    const { HUB_WIDTH } = await import("../../engine/hubMap");
    const grid = getHubGrid();
    // row 25 overlaps the E-stub corridor's full-width band (cols
    // 49-63, rows 23-25) - row 28 is clear of it.
    expect(grid[28 * HUB_WIDTH + 58].kind).toBe("rubble");
  });

  it("Trade Hall (sealed_south) interior is rubble, not void", async () => {
    const { getHubGrid } = await import("../hubContent");
    const { HUB_WIDTH } = await import("../../engine/hubMap");
    const grid = getHubGrid();
    expect(grid[40 * HUB_WIDTH + 36].kind).toBe("rubble");
  });

  it("Deep Foundry (sealed_northwest) interior is rubble, not void", async () => {
    const { getHubGrid } = await import("../hubContent");
    const { HUB_WIDTH } = await import("../../engine/hubMap");
    const grid = getHubGrid();
    expect(grid[15 * HUB_WIDTH + 10].kind).toBe("rubble");
  });

  it("Archive (sealed_north) interior is rubble, not void", async () => {
    const { getHubGrid } = await import("../hubContent");
    const { HUB_WIDTH } = await import("../../engine/hubMap");
    const grid = getHubGrid();
    expect(grid[8 * HUB_WIDTH + 36].kind).toBe("rubble");
  });

  it("each sealed room's approach corridor stays open (not swallowed by the full-room rubble fill)", async () => {
    const { getHubGrid } = await import("../hubContent");
    const { HUB_WIDTH } = await import("../../engine/hubMap");
    const grid = getHubGrid();
    // Stockpile's approach corridor at col 50, row 25 (within cols 49-51)
    expect(grid[25 * HUB_WIDTH + 50].kind).toBe("rock_floor");
  });
});

describe("Ancient Grove entrance placement (2026-07-06)", () => {
  it("is placed as a static 4x4 structure at its documented position", async () => {
    const { getHubGrid } = await import("../hubContent");
    const { HUB_WIDTH, GROVE_ENTRANCE_POSITION } = await import("../../engine/hubMap");
    const grid = getHubGrid();
    for (let dr = 0; dr < 4; dr++) {
      for (let dc = 0; dc < 4; dc++) {
        const idx = (GROVE_ENTRANCE_POSITION.row + dr) * HUB_WIDTH + (GROVE_ENTRANCE_POSITION.col + dc);
        expect(grid[idx].kind).toBe("grove_entrance");
      }
    }
  });

  it("does not block the corridor to the Garden Room", async () => {
    const { getHubGrid } = await import("../hubContent");
    const { HUB_WIDTH } = await import("../../engine/hubMap");
    const grid = getHubGrid();
    // The corridor itself is rows 42-44; grove sits at rows 38-41, well clear of it.
    expect(grid[43 * HUB_WIDTH + 24].kind).toBe("rock_floor");
  });
});

describe("Void-conversion radius widened to 2 cells (2026-07-07 regression)", () => {
  // Reported directly with screenshots: several black void patches
  // appeared right next to fully-explored areas (near the Grove
  // entrance, the Mine Shaft). Root cause: the void-conversion pass
  // only checked immediate 8 neighbors, so any gap of solid rock MORE
  // than 1 cell thick between two carved features (e.g. the 2-column
  // gap between the Garden Room's east wall and the Grove entrance's
  // west wall) failed that check on every one of its own cells, even
  // sitting directly between two explored areas.
  it("the gap between the Garden Room and the Grove entrance is now solid wall, not void", async () => {
    const { getHubGrid } = await import("../hubContent");
    const { HUB_WIDTH } = await import("../../engine/hubMap");
    const grid = getHubGrid();
    // cols 20-21, rows 37-40 - previously void
    for (let r = 37; r <= 40; r++) {
      for (let c = 20; c <= 21; c++) {
        expect(grid[r * HUB_WIDTH + c].kind).toBe("rock_wall");
      }
    }
  });

  it("genuinely distant, unclaimed rock still becomes void (the fix didn't just disable void-conversion)", async () => {
    const { getHubGrid } = await import("../hubContent");
    const { HUB_WIDTH } = await import("../../engine/hubMap");
    const grid = getHubGrid();
    // Far corner of the map, nowhere near anything carved
    const idx = 44 * HUB_WIDTH + 0;
    expect(grid[idx]).toBeDefined();
    expect(grid[idx].kind).toBe("void");
  });
});
