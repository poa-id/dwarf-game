import type { CellKind } from "./palette";
import type { GridCell } from "./GridRenderer";

/**
 * A single cell within a sprite. `kind` drives both glyph and color via
 * the existing palette system, exactly like single-cell content - a
 * sprite is just multiple GridCells with relative positions, nothing
 * more exotic than that. `null` means "transparent" - don't overwrite
 * whatever is already in the grid at that offset (e.g. a building with
 * an irregular silhouette, not a solid rectangle).
 */
export type SpriteCell = CellKind | null;

export interface Sprite {
  id: string;
  name: string;
  /** Row-major, sprite.rows.length must equal height, each row length must equal width. */
  rows: SpriteCell[][];
}

export function spriteWidth(sprite: Sprite): number {
  return sprite.rows[0]?.length ?? 0;
}

export function spriteHeight(sprite: Sprite): number {
  return sprite.rows.length;
}

/**
 * Validate a sprite's rows are rectangular (every row the same length).
 * Call this once at definition time / in tests, not per-frame - it's a
 * data integrity check, not a hot path.
 */
export function validateSprite(sprite: Sprite): void {
  const width = spriteWidth(sprite);
  for (let r = 0; r < sprite.rows.length; r++) {
    if (sprite.rows[r].length !== width) {
      throw new Error(
        `Sprite "${sprite.id}" row ${r} has length ${sprite.rows[r].length}, expected ${width}`
      );
    }
  }
}

export interface StampOptions {
  /** Top-left grid column/row to place the sprite's [0][0] cell at. */
  col: number;
  row: number;
  /** If true, throws when any part of the sprite would land outside the grid. If false (default), silently clips. */
  strict?: boolean;
}

/**
 * Stamp a sprite onto a flat grid in place... actually returns a NEW
 * grid array (does not mutate the input) so callers can keep treating
 * grid state as immutable, consistent with the rest of the engine.
 */
export function stampSprite(
  grid: GridCell[],
  cols: number,
  rows: number,
  sprite: Sprite,
  options: StampOptions
): GridCell[] {
  const { col: originCol, row: originRow, strict = false } = options;
  const newGrid = grid.slice(); // shallow copy is fine, GridCell objects are replaced wholesale below

  const width = spriteWidth(sprite);
  const height = spriteHeight(sprite);

  for (let sr = 0; sr < height; sr++) {
    for (let sc = 0; sc < width; sc++) {
      const cellKind = sprite.rows[sr][sc];
      if (cellKind === null) continue; // transparent - leave underlying grid cell untouched

      const targetCol = originCol + sc;
      const targetRow = originRow + sr;

      const outOfBounds = targetCol < 0 || targetCol >= cols || targetRow < 0 || targetRow >= rows;
      if (outOfBounds) {
        if (strict) {
          throw new Error(
            `Sprite "${sprite.id}" cell [${sr}][${sc}] lands out of bounds at (${targetCol}, ${targetRow})`
          );
        }
        continue; // clip silently
      }

      newGrid[targetRow * cols + targetCol] = { kind: cellKind };
    }
  }

  return newGrid;
}

/** Build a sprite from a flat row-major array, validating dimensions match. Convenience for compact sprite definitions. */
export function spriteFromRows(id: string, name: string, rows: SpriteCell[][]): Sprite {
  const sprite: Sprite = { id, name, rows };
  validateSprite(sprite);
  return sprite;
}
