import { NATIVE_TILE_SIZE } from "./tilesetManifest";
import { TileCache } from "./TileCache";
import type { CellLookup, VisibilityLookup, Renderer } from "./GridRenderer";

export interface TilesetRenderConfig {
  /** Viewport size in cells - NOT the full map size, matches GridRenderer's field names exactly for interface parity. */
  viewportCols: number;
  viewportRows: number;
  cellSize: number; // on-screen pixels per cell; native art is 32x32, scaled to fit
}

const DEFAULT_CONFIG: TilesetRenderConfig = {
  viewportCols: 32,
  viewportRows: 22,
  cellSize: 24,
};

/** How much to dim a "remembered" cell, as a 0-1 alpha multiplier - matches GridRenderer's REMEMBERED_OPACITY exactly, so switching renderers doesn't change how fog-of-war reads. */
const REMEMBERED_OPACITY = 0.35;

/**
 * Draws real sprite art instead of monospace glyphs - the tileset-mode
 * counterpart to GridRenderer, genuinely sharing its render() signature
 * (callback-based cell/visibility lookups, viewport centered on the
 * dwarf) so render.ts can swap between the two transparently based on
 * colorStage. This did NOT used to be true: an earlier version of this
 * file took a flat pre-built GridCell[] array with no viewport
 * windowing or visibility/fog-of-war handling at all - genuinely
 * incompatible with GridRenderer despite a docstring claiming "drop-in
 * alternative." Fixed 2026-06-23, when the renderer was actually wired
 * up for the first time (previously instantiated nowhere - tileset mode
 * existed in the codebase but had literally never been switched to).
 *
 * colorStage is accepted but NOT used to vary the tileset's own
 * appearance further (no per-stage tint variants) - per explicit
 * project direction, tileset mode has one fixed look once it activates;
 * colorStage's role here is purely "which renderer is active" (decided
 * by the CALLER, see render.ts), not "how should THIS renderer's output
 * change." Kept as a parameter anyway for true interface parity with
 * GridRenderer, and in case a future "ember-lit tileset" look between
 * stages is ever wanted.
 */
export class TilesetRenderer implements Renderer {
  private ctx: CanvasRenderingContext2D;
  private config: TilesetRenderConfig;
  private cache: TileCache;

  constructor(canvas: HTMLCanvasElement, config: Partial<TilesetRenderConfig> = {}, cache?: TileCache) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not get 2d context from canvas");
    this.ctx = ctx;
    this.cache = cache ?? new TileCache();

    canvas.width = this.config.viewportCols * this.config.cellSize;
    canvas.height = this.config.viewportRows * this.config.cellSize;

    // Tile art is small (32x32) and scaled up/down to cellSize - keep it
    // crisp/pixelated rather than blurred, consistent with the game's
    // deliberately retro identity.
    this.ctx.imageSmoothingEnabled = false;
  }

  async preload(): Promise<void> {
    await this.cache.preloadAll();
  }

  /**
   * Same signature as GridRenderer.render() - see that file's
   * docstring for the full rationale (lazy per-cell lookups rather
   * than materializing the whole map, viewport centered on
   * centerCol/centerRow). colorStage is accepted for interface parity
   * but doesn't change this renderer's own tinting - see this class's
   * docstring above.
   */
  render(
    getCell: CellLookup,
    getVisibility: VisibilityLookup,
    centerCol: number,
    centerRow: number,
    _colorStage: number
  ): void {
    const { viewportCols, viewportRows, cellSize } = this.config;

    const originCol = centerCol - Math.floor(viewportCols / 2);
    const originRow = centerRow - Math.floor(viewportRows / 2);

    // True void background - same "unexplored darkness" baseline as
    // GridRenderer, so a hidden cell looks identical regardless of
    // which renderer is currently active.
    this.ctx.fillStyle = "#000000";
    this.ctx.fillRect(0, 0, viewportCols * cellSize, viewportRows * cellSize);

    for (let vRow = 0; vRow < viewportRows; vRow++) {
      for (let vCol = 0; vCol < viewportCols; vCol++) {
        const mapCol = originCol + vCol;
        const mapRow = originRow + vRow;

        const visibility = getVisibility(mapCol, mapRow);
        if (visibility === "hidden") continue; // leave as pure void background

        const cell = getCell(mapCol, mapRow);
        if (cell.kind === "void") continue;

        const drawable = this.cache.getDrawableForKind(cell.kind);
        if (!drawable) continue; // asset not loaded yet - skip rather than throw, keeps render() safe to call anytime

        this.ctx.globalAlpha = visibility === "remembered" ? REMEMBERED_OPACITY : 1;

        const x = vCol * cellSize;
        const y = vRow * cellSize;
        this.ctx.drawImage(drawable, 0, 0, NATIVE_TILE_SIZE, NATIVE_TILE_SIZE, x, y, cellSize, cellSize);
      }
    }

    this.ctx.globalAlpha = 1; // reset for any other consumer of this context
  }

  get dimensions() {
    return { viewportCols: this.config.viewportCols, viewportRows: this.config.viewportRows };
  }
}
