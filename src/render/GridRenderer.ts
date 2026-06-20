import { paletteForStage, GLYPHS, type CellKind } from "./palette";

export interface GridCell {
  kind: CellKind;
}

export interface RenderConfig {
  cols: number;
  rows: number;
  cellSize: number; // pixels per cell, square cells
  fontFamily: string;
}

const DEFAULT_CONFIG: RenderConfig = {
  cols: 40,
  rows: 20,
  cellSize: 20,
  fontFamily: '"Courier New", monospace',
};

export class GridRenderer {
  private ctx: CanvasRenderingContext2D;
  private config: RenderConfig;

  constructor(canvas: HTMLCanvasElement, config: Partial<RenderConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not get 2d context from canvas");
    this.ctx = ctx;

    canvas.width = this.config.cols * this.config.cellSize;
    canvas.height = this.config.rows * this.config.cellSize;
  }

  /**
   * Render a full grid. `grid` is a flat array, row-major, length
   * cols*rows. `colorStage` picks the palette. This redraws everything
   * every call — at this scale (tens of cells, low update frequency for
   * an idle/skill game) that's far simpler than dirty-rect tracking and
   * costs nothing measurable. Revisit only if profiling says otherwise.
   */
  render(grid: GridCell[], colorStage: number): void {
    const { cols, rows, cellSize, fontFamily } = this.config;
    const palette = paletteForStage(colorStage);

    if (grid.length !== cols * rows) {
      throw new Error(`Grid length ${grid.length} does not match cols*rows ${cols * rows}`);
    }

    // Background
    this.ctx.fillStyle = palette.background;
    this.ctx.fillRect(0, 0, cols * cellSize, rows * cellSize);

    // Glyphs
    this.ctx.font = `${Math.floor(cellSize * 0.8)}px ${fontFamily}`;
    this.ctx.textAlign = "center";
    this.ctx.textBaseline = "middle";

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const cell = grid[row * cols + col];
        if (cell.kind === "void") continue; // skip drawing empty space, it's just background

        const glyph = GLYPHS[cell.kind];
        const color = palette.colors[cell.kind];
        this.ctx.fillStyle = color;

        const x = col * cellSize + cellSize / 2;
        const y = row * cellSize + cellSize / 2;
        this.ctx.fillText(glyph, x, y);
      }
    }
  }

  get dimensions() {
    return { cols: this.config.cols, rows: this.config.rows };
  }
}

export function createEmptyGrid(cols: number, rows: number): GridCell[] {
  return new Array(cols * rows).fill(null).map(() => ({ kind: "void" as CellKind }));
}
