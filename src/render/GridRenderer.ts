import { paletteForStage, GLYPHS, type CellKind } from "./palette";
import type { CellVisibility } from "../engine/visibility";

export interface GridCell {
  kind: CellKind;
}

export interface RenderConfig {
  /** Viewport size in cells - NOT the full map size. We only ever draw what's near the dwarf. */
  viewportCols: number;
  viewportRows: number;
  cellSize: number; // pixels per cell, square cells
  fontFamily: string;
}

const DEFAULT_CONFIG: RenderConfig = {
  viewportCols: 32,
  viewportRows: 22,
  cellSize: 24,
  fontFamily: '"Courier New", monospace',
};

/**
 * Looks up a cell kind at a given map coordinate. Implemented as a
 * callback rather than requiring the full map as a dense array, since
 * the Hub can be much larger than any one screen (80x50 = 4000 cells)
 * and most of it is static/known content - no need to materialize a
 * full array just to render a 25x17 window of it.
 */
export type CellLookup = (col: number, row: number) => GridCell;

/**
 * Reports the current visibility state for a map coordinate - hidden,
 * remembered (dim, explored but not currently lit), or lit (full
 * brightness, within the dwarf's torch radius). Renderer-agnostic;
 * comes from the engine's visibility module.
 */
export type VisibilityLookup = (col: number, row: number) => CellVisibility;

/** How much to dim a "remembered" cell's color, as a 0-1 multiplier applied via canvas alpha. */
const REMEMBERED_OPACITY = 0.35;

/**
 * The shared shape both GridRenderer (ASCII) and TilesetRenderer
 * (sprite art) satisfy - lets render.ts hold either one polymorphically
 * and swap between them based on colorStage, without caring which is
 * actually active. See render.ts's `activeRenderer()` for the swap
 * logic, and TilesetRenderer.ts's docstring for why this interface
 * genuinely matching (not just "intended to," as an earlier version
 * claimed) mattered enough to be worth fixing.
 */
export interface Renderer {
  render(
    getCell: CellLookup,
    getVisibility: VisibilityLookup,
    centerCol: number,
    centerRow: number,
    colorStage: number
  ): void;
}

export class GridRenderer implements Renderer {
  private ctx: CanvasRenderingContext2D;
  private config: RenderConfig;

  constructor(canvas: HTMLCanvasElement, config: Partial<RenderConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not get 2d context from canvas");
    this.ctx = ctx;

    canvas.width = this.config.viewportCols * this.config.cellSize;
    canvas.height = this.config.viewportRows * this.config.cellSize;
  }

  /**
   * Render a viewport-sized window of the map, centered on `centerCol`/
   * `centerRow` (typically the dwarf's position). Only ever touches
   * viewportCols*viewportRows cells - cheap regardless of how big the
   * full Hub map is, since we never materialize or iterate the whole
   * thing just to draw a screen's worth of it.
   */
  render(
    getCell: CellLookup,
    getVisibility: VisibilityLookup,
    centerCol: number,
    centerRow: number,
    colorStage: number
  ): void {
    const { viewportCols, viewportRows, cellSize, fontFamily } = this.config;
    const palette = paletteForStage(colorStage);

    const originCol = centerCol - Math.floor(viewportCols / 2);
    const originRow = centerRow - Math.floor(viewportRows / 2);

    // True void background - what you get when nothing has been drawn:
    // unexplored darkness, exactly matching the "hidden" visibility state.
    this.ctx.fillStyle = "#000000";
    this.ctx.fillRect(0, 0, viewportCols * cellSize, viewportRows * cellSize);

    this.ctx.font = `${Math.floor(cellSize * 0.8)}px ${fontFamily}`;
    this.ctx.textAlign = "center";
    this.ctx.textBaseline = "middle";

    for (let vRow = 0; vRow < viewportRows; vRow++) {
      for (let vCol = 0; vCol < viewportCols; vCol++) {
        const mapCol = originCol + vCol;
        const mapRow = originRow + vRow;

        const visibility = getVisibility(mapCol, mapRow);
        if (visibility === "hidden") continue; // leave as pure void background

        const cell = getCell(mapCol, mapRow);
        if (cell.kind === "void") continue;

        const glyph = GLYPHS[cell.kind];
        const color = palette.colors[cell.kind];

        this.ctx.globalAlpha = visibility === "remembered" ? REMEMBERED_OPACITY : 1;
        this.ctx.fillStyle = color;

        const x = vCol * cellSize + cellSize / 2;
        const y = vRow * cellSize + cellSize / 2;
        this.ctx.fillText(glyph, x, y);
      }
    }

    this.ctx.globalAlpha = 1; // reset for any other consumer of this context
  }

  get dimensions() {
    return { viewportCols: this.config.viewportCols, viewportRows: this.config.viewportRows };
  }
}

export function createEmptyGrid(cols: number, rows: number): GridCell[] {
  return new Array(cols * rows).fill(null).map(() => ({ kind: "void" as CellKind }));
}
