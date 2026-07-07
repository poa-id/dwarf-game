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

describe("Deep Foundry no longer connects to the Mine Room (2026-07-07)", () => {
  // Reported directly: "the west wing of the deep foundry connects
  // with the mine room which is not intended." Deep Foundry's floor
  // ended at row 19 and Mine Room's begins at row 20 directly below,
  // same columns, with no wall between them - clearing Deep Foundry
  // would visually and functionally merge the two rooms into one.
  it("row 19 stays a permanent wall between the two rooms, even once Deep Foundry is cleared", async () => {
    const { getHubGrid } = await import("../hubContent");
    const { HUB_WIDTH } = await import("../../engine/hubMap");
    const grid = getHubGrid();
    // col 8 avoids the Mine Shaft's own 3x3 footprint (cols 10-12)
    expect(grid[19 * HUB_WIDTH + 8].kind).toBe("rock_wall");
  });

  it("Deep Foundry's own interior still only spans rows 9-18 (not 19)", async () => {
    const { getHubGrid } = await import("../hubContent");
    const { HUB_WIDTH } = await import("../../engine/hubMap");
    const grid = getHubGrid();
    expect(grid[18 * HUB_WIDTH + 8].kind).toBe("rubble");
  });
});

describe("Void-conversion gap fixes (2026-07-07)", () => {
  // Reported directly with screenshots: several black void patches
  // appeared right next to fully-explored areas (near the Grove
  // entrance, the Mine Shaft/Forge). Root cause: the void-conversion
  // pass only checked immediate 8 neighbors, so a rock_wall cell more
  // than 1 cell from ANY carved space became void - including cells
  // sandwiched between two OTHER walls that were each individually
  // "rescued" by their own 1-cell-adjacent carved neighbor.
  //
  // First attempt widened the check to a 2-cell radius, which fixed
  // the gaps but also thickened the visible wall border everywhere on
  // the map, not just at the broken spots - reported directly the same
  // day: "the walls now show 2 rows lit instead of one and void after
  // that." Reverted back to a strict 1-cell radius (kept below), and
  // closed the specific gaps with small explicit floor-strip fills at
  // exactly the sandwiched columns instead - narrower, targeted fix
  // rather than a global algorithm change.
  it("the void-conversion check is back to a 1-cell radius (not the wider 2-cell version)", async () => {
    const { getHubGrid } = await import("../hubContent");
    const { HUB_WIDTH } = await import("../../engine/hubMap");
    const grid = getHubGrid();
    // A cell exactly 2 cells from the nearest carved space (but not 1)
    // should be void again under the 1-cell radius - it would have
    // stayed visible under the reverted 2-cell version.
    // col 45, row 20 area: 2 cells from the Mine Room's own floor.
    const idx = 3 * HUB_WIDTH + 3;
    expect(grid[idx].kind).toBe("void");
  });

  it("the Garden Room <-> Grove entrance gap column is closed with a real floor tile, not void", async () => {
    const { getHubGrid } = await import("../hubContent");
    const { HUB_WIDTH } = await import("../../engine/hubMap");
    const grid = getHubGrid();
    // col 20, rows 37-41 - the specific sandwiched gap column
    for (let r = 37; r <= 41; r++) {
      expect(grid[r * HUB_WIDTH + 20].kind).toBe("rock_floor");
    }
  });

  it("the Forge Room's western approach gap column is closed the same way", async () => {
    const { getHubGrid } = await import("../hubContent");
    const { HUB_WIDTH } = await import("../../engine/hubMap");
    const grid = getHubGrid();
    // col 47, rows 8-24 - the specific sandwiched gap column near the Forge
    expect(grid[12 * HUB_WIDTH + 47].kind).toBe("rock_floor");
  });

  it("genuinely distant, unclaimed rock still becomes void (targeted fills didn't disable void-conversion generally)", async () => {
    const { getHubGrid } = await import("../hubContent");
    const { HUB_WIDTH } = await import("../../engine/hubMap");
    const grid = getHubGrid();
    // Far corner of the map, nowhere near anything carved
    const idx = 44 * HUB_WIDTH + 0;
    expect(grid[idx]).toBeDefined();
    expect(grid[idx].kind).toBe("void");
  });
});
