import { GridRenderer } from "./render/GridRenderer";
import { TilesetRenderer } from "./render/TilesetRenderer";
import { buildTestScene } from "./render/testScene";
import { STAGE_PALETTES } from "./render/palette";

const app = document.querySelector<HTMLDivElement>("#app")!;

app.innerHTML = `
  <div class="shell">
    <h1>the hearth &amp; the deep</h1>
    <p class="subtitle">renderer test scene — not real gameplay yet</p>
    <canvas id="game-canvas"></canvas>
    <div class="controls">
      <span>mode:</span>
      <button data-mode="ascii" class="active">ascii</button>
      <button data-mode="tileset">tileset</button>
    </div>
    <div class="controls" id="stage-controls">
      <span>color stage:</span>
      ${STAGE_PALETTES.map(
        (p) => `<button data-stage="${p.stage}">${p.stage} — ${stageLabel(p.stage)}</button>`
      ).join("")}
    </div>
  </div>
`;

function stageLabel(stage: number): string {
  const labels = ["The Dark", "First Ember", "Hearthlight", "True Color"];
  return labels[stage] ?? `stage ${stage}`;
}

const canvas = document.querySelector<HTMLCanvasElement>("#game-canvas")!;
const scene = buildTestScene(40, 20);

const asciiRenderer = new GridRenderer(canvas, { cols: 40, rows: 20, cellSize: 22 });
const tilesetRenderer = new TilesetRenderer(canvas, { cols: 40, rows: 20, cellSize: 22 });

let mode: "ascii" | "tileset" = "ascii";
let currentStage = 0;
let tilesetReady = false;

function renderCurrent() {
  if (mode === "ascii") {
    asciiRenderer.render(scene, currentStage);
  } else if (tilesetReady) {
    tilesetRenderer.render(scene);
  }
}

renderCurrent();

// preload tileset assets in the background; re-render once ready if we're already in tileset mode
tilesetRenderer.preload().then(() => {
  tilesetReady = true;
  if (mode === "tileset") renderCurrent();
});

document.querySelectorAll<HTMLButtonElement>("button[data-stage]").forEach((btn) => {
  btn.addEventListener("click", () => {
    currentStage = Number(btn.dataset.stage);
    renderCurrent();
  });
});

const stageControls = document.querySelector<HTMLDivElement>("#stage-controls")!;

document.querySelectorAll<HTMLButtonElement>("button[data-mode]").forEach((btn) => {
  btn.addEventListener("click", () => {
    mode = btn.dataset.mode as "ascii" | "tileset";
    document
      .querySelectorAll<HTMLButtonElement>("button[data-mode]")
      .forEach((b) => b.classList.toggle("active", b === btn));
    stageControls.style.display = mode === "ascii" ? "flex" : "none";
    if (mode === "tileset" && !tilesetReady) return; // will render once preload resolves
    renderCurrent();
  });
});
