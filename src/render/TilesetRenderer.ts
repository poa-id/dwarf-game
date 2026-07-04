import { TILE_MANIFEST } from "./tilesetManifest";
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
const REMEMBERED_OPACITY = 0.45; // ambient dim — visible but clearly not lit

/**
 * Finds the true top-left anchor of a multi-tile sprite's footprint,
 * given the CURRENT cell (which may be anywhere within that footprint,
 * not necessarily the anchor). Pure function of `getCell` - extracted
 * out of TilesetRenderer.render() specifically so this logic (the fix
 * for the "sprite renders out of position, then snaps into place as
 * the camera approaches" bug reported 2026-07-03) has real unit test
 * coverage without needing a canvas/rendering context at all. See
 * render()'s call site for the full rationale.
 *
 * Returns the anchor's offset FROM the given cell, i.e. (0,0) for a
 * 1x1 sprite or for a multi-tile sprite whose given cell already IS
 * the anchor; positive values mean the anchor is up/left of the given
 * cell.
 */
export function findSpriteAnchorOffset(
  getCell: CellLookup,
  mapCol: number,
  mapRow: number,
  kind: string,
  span: { cols: number; rows: number }
): { dc: number; dr: number } {
  if (span.cols <= 1 && span.rows <= 1) return { dc: 0, dr: 0 };

  let dc = 0;
  while (dc < span.cols - 1 && getCell(mapCol - dc - 1, mapRow).kind === kind) dc++;
  let dr = 0;
  while (dr < span.rows - 1 && getCell(mapCol, mapRow - dr - 1).kind === kind) dr++;
  return { dc, dr };
}

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

    this.ctx.fillStyle = "#000000";
    this.ctx.fillRect(0, 0, viewportCols * cellSize, viewportRows * cellSize);

    // Track viewport cells that have already been painted by a multi-tile
    // sprite anchored at a prior cell - key: `${vCol},${vRow}`.
    const coveredBySprite = new Set<string>();

    for (let vRow = 0; vRow < viewportRows; vRow++) {
      for (let vCol = 0; vCol < viewportCols; vCol++) {
        // Skip interior cells already painted when their anchor was drawn.
        if (coveredBySprite.has(`${vCol},${vRow}`)) continue;

        const mapCol = originCol + vCol;
        const mapRow = originRow + vRow;

        const visibility = getVisibility(mapCol, mapRow);
        if (visibility === "hidden") continue;

        const cell = getCell(mapCol, mapRow);
        if (cell.kind === "void") continue;

        const def = TILE_MANIFEST[cell.kind];
        const drawable = this.cache.getDrawable(def);
        if (!drawable) continue;

        this.ctx.globalAlpha = visibility === "remembered" ? REMEMBERED_OPACITY : 1;

        const span = def.tileSpan ?? { cols: 1, rows: 1 };

        // For multi-tile sprites, find the TRUE top-left anchor rather
        // than assuming (mapCol, mapRow) is it. The underlying static
        // grid sets EVERY cell within a structure's footprint to the
        // same CellKind (see hubContent.ts's set() calls for the
        // Hearth/Forge/ore veins/etc - correct for the ASCII renderer,
        // where each cell independently draws its own glyph and a solid
        // block of the same character is exactly what a big structure
        // should look like). But it means THIS renderer can't assume
        // whatever cell the viewport scan happens to reach first IS the
        // anchor - if the camera scrolls such that an INTERIOR cell of
        // the footprint enters the viewport before the true top-left
        // corner does, drawing the whole sprite anchored there is wrong
        // (visibly "out of position" until the camera scrolls far
        // enough that the real anchor is what gets scanned first - the
        // exact "renders out of position, then snaps as you approach"
        // bug reported 2026-07-03). See findSpriteAnchorOffset's own
        // doc comment for why this is a separate, independently-tested
        // pure function rather than inlined here.
        const { dc, dr } = findSpriteAnchorOffset(getCell, mapCol, mapRow, cell.kind, span);
        const anchorVCol = vCol - dc;
        const anchorVRow = vRow - dr;

        const x = anchorVCol * cellSize;
        const y = anchorVRow * cellSize;

        // Draw at the sprite's natural span (multiple cells wide/tall).
        const drawW = span.cols * cellSize;
        const drawH = span.rows * cellSize;
        const srcW = (drawable as HTMLCanvasElement).width ?? (drawable as HTMLImageElement).naturalWidth;
        const srcH = (drawable as HTMLCanvasElement).height ?? (drawable as HTMLImageElement).naturalHeight;
        this.ctx.drawImage(drawable, 0, 0, srcW, srcH, x, y, drawW, drawH);

        // Mark every viewport cell this sprite's footprint covers
        // (relative to the real anchor, not the cell that triggered
        // this draw) so we don't try to draw it again when the loop
        // reaches them - including cells earlier in scan order than
        // the current one, which is fine: re-marking them covered after
        // the fact doesn't undo anything, since either they were
        // skipped already (visibility/void) or this IS the first time
        // any cell in this footprint got this far.
        for (let dr2 = 0; dr2 < span.rows; dr2++) {
          for (let dc2 = 0; dc2 < span.cols; dc2++) {
            coveredBySprite.add(`${anchorVCol + dc2},${anchorVRow + dr2}`);
          }
        }
      }
    }

    this.ctx.globalAlpha = 1;
  }

  get dimensions() {
    return { viewportCols: this.config.viewportCols, viewportRows: this.config.viewportRows };
  }
}
