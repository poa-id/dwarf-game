import { GridRenderer } from "./render/GridRenderer";
import { hubCellAt } from "./render/hubContent";
import { createInitialGameState } from "./engine/rekindle";
import { attemptMove, type Direction } from "./engine/movement";
import { markVisibleCellsExplored } from "./engine/exploration";
import { cellVisibility, DEFAULT_LIGHT_RADIUS, zoneContaining } from "./engine/visibility";
import { cellKey } from "./engine/types";

const app = document.querySelector<HTMLDivElement>("#app")!;

app.innerHTML = `
  <div class="shell">
    <h1>the hearth &amp; the deep</h1>
    <p class="subtitle">WASD or arrow keys to move</p>
    <canvas id="game-canvas"></canvas>
    <p class="hint" id="zone-hint"></p>
  </div>
`;

const canvas = document.querySelector<HTMLCanvasElement>("#game-canvas")!;
const zoneHint = document.querySelector<HTMLParagraphElement>("#zone-hint")!;

const renderer = new GridRenderer(canvas, {
  viewportCols: 25,
  viewportRows: 17,
  cellSize: 24,
});

let state = createInitialGameState(Date.now());

// Mark the dwarf's starting position explored immediately, so the very
// first frame already shows the lit area around him rather than a
// single empty render before any movement happens.
state = {
  ...state,
  world: {
    ...state.world,
    exploredCells: markVisibleCellsExplored(state.world.exploredCells, state.vessel.position),
  },
};

function updateZoneHint(): void {
  const { position } = state.vessel;
  const zone = zoneContaining(position.col, position.row);
  zoneHint.textContent = zone ? zone.name : "the dark halls";
}

function render(): void {
  const { position } = state.vessel;

  renderer.render(
    (col, row) => {
      if (col === position.col && row === position.row) return { kind: "dwarf" };
      return hubCellAt(col, row);
    },
    (col, row) =>
      cellVisibility(col, row, position, state.world, cellKey(col, row), DEFAULT_LIGHT_RADIUS),
    position.col,
    position.row,
    state.world.hearth.colorStage
  );

  updateZoneHint();
}

render();

const KEY_TO_DIRECTION: Record<string, Direction> = {
  w: "up",
  ArrowUp: "up",
  s: "down",
  ArrowDown: "down",
  a: "left",
  ArrowLeft: "left",
  d: "right",
  ArrowRight: "right",
};

window.addEventListener("keydown", (e) => {
  const direction = KEY_TO_DIRECTION[e.key];
  if (!direction) return;
  e.preventDefault();

  const moveResult = attemptMove(state.vessel.position, direction, state.world);
  if (!moveResult.moved) return; // blocked - nothing to update or redraw

  const newExplored = markVisibleCellsExplored(state.world.exploredCells, moveResult.position);

  state = {
    ...state,
    world: { ...state.world, exploredCells: newExplored },
    vessel: { ...state.vessel, position: moveResult.position },
  };

  render();
});
