import { createEmptyGrid, type GridCell } from "./GridRenderer";
import { stampSprite } from "./sprites";
import { CAVE_LURKER, FORGE_BUILDING } from "./exampleSprites";

/**
 * Builds a simple static test scene: stone walls around the edge, a
 * scatter of ore veins, the dwarf in the middle, a stamped forge
 * building (4x4), and a stamped cave lurker foe (2x4). This is NOT real
 * game logic — just enough visual content to judge whether the glyph/
 * palette choices AND multi-cell sprite stamping read well.
 */
export function buildTestScene(cols: number, rows: number): GridCell[] {
  let grid = createEmptyGrid(cols, rows);

  const set = (col: number, row: number, kind: GridCell["kind"]) => {
    if (col < 0 || col >= cols || row < 0 || row >= rows) return;
    grid[row * cols + col] = { kind };
  };

  // border walls
  for (let col = 0; col < cols; col++) {
    set(col, 0, "rock_wall");
    set(col, rows - 1, "rock_wall");
  }
  for (let row = 0; row < rows; row++) {
    set(0, row, "rock_wall");
    set(cols - 1, row, "rock_wall");
  }

  // floor fill
  for (let row = 1; row < rows - 1; row++) {
    for (let col = 1; col < cols - 1; col++) {
      set(col, row, "rock_floor");
    }
  }

  // scattered ore veins
  const oreSpots: Array<[number, number, GridCell["kind"]]> = [
    [8, 5, "ore_copper"],
    [12, 8, "ore_iron"],
    [20, 12, "ore_iron"],
    [30, 6, "ore_deep"],
    [15, 14, "ore_copper"],
  ];
  for (const [c, r, kind] of oreSpots) set(c, r, kind);

  // the hearth, central-ish, the thing this whole world orbits
  set(4, 8, "hearth");

  // the dwarf, somewhere in the middle of the action
  set(10, 10, "dwarf");

  // stamp a 4x4 forge building (replaces the old single-cell forge placement)
  grid = stampSprite(grid, cols, rows, FORGE_BUILDING, { col: 2, row: 2 });

  // stamp a 2x4 foe lurking in a far corner
  grid = stampSprite(grid, cols, rows, CAVE_LURKER, { col: 33, row: 9 });

  return grid;
}

