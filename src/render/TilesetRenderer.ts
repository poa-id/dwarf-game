import { NATIVE_TILE_SIZE } from "./tilesetManifest";
import { TileCache } from "./TileCache";
import type { GridCell } from "./GridRenderer";

export interface TilesetRenderConfig {
  cols: number;
  rows: number;
  cellSize: number; // on-screen pixels per cell; native art is 32x32, scaled to fit
}

const DEFAULT_CONFIG: TilesetRenderConfig = {
  cols: 40,
  rows: 20,
  cellSize: 32,
};

/**
 * Draws the same GridCell[] data the ASCII GridRenderer draws, but as
 * real sprite art instead of monospace glyphs. This is intentionally a
 * drop-in alternative, not a replacement - same input shape, same
 * colorStage parameter (currently unused here since these are full-
 * color tiles by nature, but kept for interface parity and in case we
 * later want tileset-mode to ALSO darken/desaturate at low colorStage,
 * e.g. for an "ember-lit tileset" look between pure-ASCII and full
 * color tileset mode).
 */
export class TilesetRenderer {
  private ctx: CanvasRenderingContext2D;
  private config: TilesetRenderConfig;
  private cache: TileCache;

  constructor(canvas: HTMLCanvasElement, config: Partial<TilesetRenderConfig> = {}, cache?: TileCache) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not get 2d context from canvas");
    this.ctx = ctx;
    this.cache = cache ?? new TileCache();

    canvas.width = this.config.cols * this.config.cellSize;
    canvas.height = this.config.rows * this.config.cellSize;

    // Tile art is small (32x32) and scaled up/down to cellSize - keep it
    // crisp/pixelated rather than blurred, consistent with the game's
    // deliberately retro identity.
    this.ctx.imageSmoothingEnabled = false;
  }

  async preload(): Promise<void> {
    await this.cache.preloadAll();
  }

  render(grid: GridCell[]): void {
    const { cols, rows, cellSize } = this.config;

    if (grid.length !== cols * rows) {
      throw new Error(`Grid length ${grid.length} does not match cols*rows ${cols * rows}`);
    }

    this.ctx.fillStyle = "#000000";
    this.ctx.fillRect(0, 0, cols * cellSize, rows * cellSize);

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const cell = grid[row * cols + col];
        if (cell.kind === "void") continue;

        const drawable = this.cache.getDrawableForKind(cell.kind);
        if (!drawable) continue; // asset not loaded yet - skip rather than throw, keeps render() safe to call anytime

        const x = col * cellSize;
        const y = row * cellSize;
        this.ctx.drawImage(drawable, 0, 0, NATIVE_TILE_SIZE, NATIVE_TILE_SIZE, x, y, cellSize, cellSize);
      }
    }
  }

  get dimensions() {
    return { cols: this.config.cols, rows: this.config.rows };
  }
}
