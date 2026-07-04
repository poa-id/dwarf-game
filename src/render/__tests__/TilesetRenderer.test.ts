import { describe, it, expect } from "vitest";
import { findSpriteAnchorOffset } from "../TilesetRenderer";
import type { GridCell } from "../GridRenderer";

/** Builds a getCell that returns `kind` for every cell within the
 * rectangle [originCol, originCol+cols) x [originRow, originRow+rows),
 * and "rock_floor" everywhere else - simulates the real static grid's
 * "every cell in a structure's footprint shares the same CellKind"
 * shape (see hubContent.ts) that caused the original bug. */
function makeFootprintLookup(
  originCol: number,
  originRow: number,
  cols: number,
  rows: number,
  kind: string
) {
  return (col: number, row: number): GridCell => {
    if (col >= originCol && col < originCol + cols && row >= originRow && row < originRow + rows) {
      return { kind } as GridCell;
    }
    return { kind: "rock_floor" } as GridCell;
  };
}

describe("findSpriteAnchorOffset", () => {
  it("returns (0,0) for a 1x1 sprite regardless of position", () => {
    const getCell = makeFootprintLookup(10, 10, 1, 1, "kiln");
    expect(findSpriteAnchorOffset(getCell, 10, 10, "kiln", { cols: 1, rows: 1 })).toEqual({ dc: 0, dr: 0 });
  });

  it("returns (0,0) when already queried at the true anchor (top-left corner)", () => {
    // Hearth: 6x6 footprint at (40,25) - querying the anchor itself
    const getCell = makeFootprintLookup(40, 25, 6, 6, "hearth");
    expect(findSpriteAnchorOffset(getCell, 40, 25, "hearth", { cols: 6, rows: 6 })).toEqual({ dc: 0, dr: 0 });
  });

  it("finds the correct offset from an interior cell - the exact bug scenario", () => {
    // This is the reported bug: the viewport scan reaches an INTERIOR
    // cell of the 6x6 Hearth footprint (not its top-left anchor) first,
    // e.g. because the camera scrolled such that (43,28) - three cells
    // right and three down from the true anchor (40,25) - is the first
    // Hearth-kind cell encountered.
    const getCell = makeFootprintLookup(40, 25, 6, 6, "hearth");
    expect(findSpriteAnchorOffset(getCell, 43, 28, "hearth", { cols: 6, rows: 6 })).toEqual({ dc: 3, dr: 3 });
  });

  it("finds the correct offset from the bottom-right corner cell", () => {
    const getCell = makeFootprintLookup(40, 25, 6, 6, "hearth");
    // bottom-right corner is (45,30) for a 6x6 footprint anchored at (40,25)
    expect(findSpriteAnchorOffset(getCell, 45, 30, "hearth", { cols: 6, rows: 6 })).toEqual({ dc: 5, dr: 5 });
  });

  it("handles a non-square footprint correctly (rows != cols)", () => {
    // Gemcutting is 6x6 in practice, but exercise a genuinely rectangular
    // footprint to make sure rows/cols aren't accidentally swapped.
    const getCell = makeFootprintLookup(50, 10, 4, 2, "forge_4x4"); // 4 wide, 2 tall
    expect(findSpriteAnchorOffset(getCell, 52, 11, "forge_4x4", { cols: 4, rows: 2 })).toEqual({ dc: 2, dr: 1 });
  });

  it("works correctly even when the true anchor is off the queried grid entirely (e.g. off-screen)", () => {
    // The whole point of walking via getCell rather than scan order:
    // getCell can be queried for ANY world position, including ones
    // far outside whatever viewport window is currently rendering, so
    // this still resolves correctly even if the anchor itself would
    // never appear in the current viewport scan at all.
    const getCell = makeFootprintLookup(-10, -10, 6, 6, "hearth"); // anchor is off in negative coordinates
    expect(findSpriteAnchorOffset(getCell, -6, -6, "hearth", { cols: 6, rows: 6 })).toEqual({ dc: 4, dr: 4 });
  });

  it("does not walk past the sprite's own span into an unrelated same-kind structure", () => {
    // Two SEPARATE 3x3 "ore_copper" veins placed with a 1-cell gap
    // between them (cols 10-12 and cols 14-16, both row 20). Querying
    // the second vein's top-left cell (14,20) must not walk backward
    // into the first vein just because it shares the same kind -
    // bounded by span.cols-1 (2 for a 3-wide sprite) stops it in time.
    const getCell = (col: number, row: number): GridCell => {
      const inFirst = col >= 10 && col < 13 && row >= 20 && row < 23;
      const inSecond = col >= 14 && col < 17 && row >= 20 && row < 23;
      return { kind: inFirst || inSecond ? "ore_copper" : "rock_floor" } as GridCell;
    };
    expect(findSpriteAnchorOffset(getCell, 14, 20, "ore_copper", { cols: 3, rows: 3 })).toEqual({ dc: 0, dr: 0 });
  });
});
