import { describe, it, expect } from "vitest";
import {
  spriteFromRows,
  validateSprite,
  spriteWidth,
  spriteHeight,
  stampSprite,
} from "../sprites";
import { createEmptyGrid } from "../GridRenderer";

describe("spriteFromRows / validateSprite", () => {
  it("accepts a rectangular sprite", () => {
    expect(() =>
      spriteFromRows("test", "Test", [
        ["rock_wall", "rock_wall"],
        ["rock_wall", "rock_wall"],
      ])
    ).not.toThrow();
  });

  it("throws if rows have inconsistent lengths", () => {
    expect(() =>
      validateSprite({
        id: "bad",
        name: "Bad",
        rows: [["rock_wall", "rock_wall"], ["rock_wall"]],
      })
    ).toThrow();
  });
});

describe("spriteWidth / spriteHeight", () => {
  it("reports correct dimensions for a 2x4 sprite", () => {
    const sprite = spriteFromRows("s", "S", [
      ["rock_wall", "rock_wall"],
      ["rock_wall", "rock_wall"],
      ["rock_wall", "rock_wall"],
      ["rock_wall", "rock_wall"],
    ]);
    expect(spriteWidth(sprite)).toBe(2);
    expect(spriteHeight(sprite)).toBe(4);
  });

  it("reports correct dimensions for a 4x4 sprite", () => {
    const sprite = spriteFromRows(
      "s",
      "S",
      Array.from({ length: 4 }, () => Array(4).fill("rock_wall"))
    );
    expect(spriteWidth(sprite)).toBe(4);
    expect(spriteHeight(sprite)).toBe(4);
  });
});

describe("stampSprite", () => {
  const cols = 10;
  const rows = 10;

  it("places sprite cells at the correct grid positions", () => {
    const grid = createEmptyGrid(cols, rows);
    const sprite = spriteFromRows("s", "S", [
      ["ore_copper", "ore_iron"],
      ["ore_iron", "ore_copper"],
    ]);
    const result = stampSprite(grid, cols, rows, sprite, { col: 3, row: 3 });
    expect(result[3 * cols + 3].kind).toBe("ore_copper");
    expect(result[3 * cols + 4].kind).toBe("ore_iron");
    expect(result[4 * cols + 3].kind).toBe("ore_iron");
    expect(result[4 * cols + 4].kind).toBe("ore_copper");
  });

  it("does not mutate the original grid", () => {
    const grid = createEmptyGrid(cols, rows);
    const sprite = spriteFromRows("s", "S", [["ore_copper"]]);
    stampSprite(grid, cols, rows, sprite, { col: 0, row: 0 });
    expect(grid[0].kind).toBe("void"); // original untouched
  });

  it("respects null cells as transparent, leaving underlying grid untouched", () => {
    let grid = createEmptyGrid(cols, rows);
    // pre-fill one cell with something distinctive
    grid[5 * cols + 5] = { kind: "hearth" };
    const sprite = spriteFromRows("s", "S", [
      [null, "rock_wall"],
      ["rock_wall", null],
    ]);
    const result = stampSprite(grid, cols, rows, sprite, { col: 5, row: 5 });
    // top-left of sprite is null -> the pre-existing hearth cell should survive
    expect(result[5 * cols + 5].kind).toBe("hearth");
    // bottom-right is also null
    expect(result[6 * cols + 6].kind).toBe("void");
    // the two non-null diagonal cells got stamped
    expect(result[5 * cols + 6].kind).toBe("rock_wall");
    expect(result[6 * cols + 5].kind).toBe("rock_wall");
  });

  it("clips silently when part of the sprite goes out of bounds (default behavior)", () => {
    const grid = createEmptyGrid(cols, rows);
    const sprite = spriteFromRows("s", "S", [
      ["ore_copper", "ore_copper"],
      ["ore_copper", "ore_copper"],
    ]);
    // place so right column and bottom row are off-grid
    expect(() =>
      stampSprite(grid, cols, rows, sprite, { col: cols - 1, row: rows - 1 })
    ).not.toThrow();
    const result = stampSprite(grid, cols, rows, sprite, { col: cols - 1, row: rows - 1 });
    // only the in-bounds top-left cell of the sprite should have landed
    expect(result[(rows - 1) * cols + (cols - 1)].kind).toBe("ore_copper");
  });

  it("throws when strict=true and sprite goes out of bounds", () => {
    const grid = createEmptyGrid(cols, rows);
    const sprite = spriteFromRows("s", "S", [["ore_copper", "ore_copper"]]);
    expect(() =>
      stampSprite(grid, cols, rows, sprite, { col: cols - 1, row: 0, strict: true })
    ).toThrow();
  });

  it("a 4x4 sprite stamps all 16 cells correctly when fully in bounds", () => {
    const grid = createEmptyGrid(cols, rows);
    const sprite = spriteFromRows(
      "big",
      "Big",
      Array.from({ length: 4 }, () => Array(4).fill("rock_wall") as ("rock_wall")[])
    );
    const result = stampSprite(grid, cols, rows, sprite, { col: 2, row: 2 });
    let count = 0;
    for (let r = 2; r < 6; r++) {
      for (let c = 2; c < 6; c++) {
        if (result[r * cols + c].kind === "rock_wall") count++;
      }
    }
    expect(count).toBe(16);
  });
});
