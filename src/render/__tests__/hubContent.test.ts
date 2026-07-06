import { describe, it, expect } from "vitest";
import { hubCellAt, getHubGrid } from "../hubContent";
import { HUB_WIDTH } from "../../engine/hubMap";

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

describe("Floor zones (2026-07-05, direct instruction: floor2 for mines/garden, floor4 for hearth/forge/gemcutting)", () => {
  const grid = getHubGrid();
  const kindAt = (col: number, row: number) => grid[row * HUB_WIDTH + col].kind;

  it("Mine Room floor is rock_floor_mines", () => {
    expect(kindAt(10, 25)).toBe("rock_floor_mines"); // well inside cols 6-18, rows 20-30
  });

  it("Garden Room floor is rock_floor_mines", () => {
    // Room is cols 6-18, rows 35-45; planters occupy cols 6/10/14 at
    // rows 39-41/43-45 - col 17 is clear of all of them.
    expect(kindAt(17, 40)).toBe("rock_floor_mines");
  });

  it("Forge Room floor is rock_floor_dev", () => {
    // Room is cols 52-63, rows 9-19; Forge itself occupies cols
    // 54-60, rows 9-15 (7x7) and Smelter sits below it - pick a point
    // clear of both structures but still in the room.
    expect(kindAt(62, 18)).toBe("rock_floor_dev");
  });

  it("Tinkering Room (Gemcutting) floor is rock_floor_dev", () => {
    // Room is cols 52-63, rows 36-46; Gemcutting occupies cols
    // 56-61 rows 38-43, Sawmill cols 52-54 rows 38-40 - pick a point
    // clear of both.
    expect(kindAt(62, 44)).toBe("rock_floor_dev");
  });

  it("Hearth Hall (central circle) floor is rock_floor_dev", () => {
    // MAP_CENTER itself (40,25) is inside the Hearth's OWN 6x6
    // footprint (which legitimately overlays its own floor - not a
    // bug) - sample a circle point outside the Hearth/Console
    // footprints instead, still well within the radius-9 circle.
    expect(kindAt(32, 25)).toBe("rock_floor_dev");
  });

  it("a corridor (not explicitly zoned) stays the plain default floor", () => {
    // NW horizontal corridor, fill(6,9,31,11) - far from every room
    // and outside the Hearth Hall's radius-9 circle.
    expect(kindAt(20, 10)).toBe("rock_floor");
  });
});

describe("South-facing wall variant (2026-07-05)", () => {
  const grid = getHubGrid();
  const kindAt = (col: number, row: number) => grid[row * HUB_WIDTH + col].kind;

  it("the wall directly south of (below) a room's floor is rock_wall_south", () => {
    // Mine Room's floor ends at row 30; row 31 is the wall bordering
    // it from the south side - its NORTH neighbor (row 30) is floor.
    expect(kindAt(10, 31)).toBe("rock_wall_south");
  });

  it("a wall bordering a room on the north side stays plain rock_wall (not south-facing)", () => {
    // Mine Room's floor starts at row 20; row 19 is the wall bordering
    // it from the NORTH side. Column 15 specifically (not 10-12, which
    // is where the Mine Shaft structure sits) to sample plain wall.
    expect(kindAt(15, 19)).toBe("rock_wall");
  });

  it("deep interior rock (converted to void) is never marked south-facing", () => {
    // Far from any carved space - should be void, not any wall kind at all
    const idx = 5 * HUB_WIDTH + 5;
    expect(grid[idx].kind).toBe("void");
  });
});
