import { GridRenderer } from "./render/GridRenderer";
import { buildTestScene } from "./render/testScene";
import { STAGE_PALETTES } from "./render/palette";

const app = document.querySelector<HTMLDivElement>("#app")!;

app.innerHTML = `
  <div class="shell">
    <h1>the hearth &amp; the deep</h1>
    <p class="subtitle">renderer test scene — not real gameplay yet</p>
    <canvas id="game-canvas"></canvas>
    <div class="controls">
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
const renderer = new GridRenderer(canvas, { cols: 40, rows: 20, cellSize: 22 });
const scene = buildTestScene(40, 20);

let currentStage = 0;
renderer.render(scene, currentStage);

document.querySelectorAll<HTMLButtonElement>("button[data-stage]").forEach((btn) => {
  btn.addEventListener("click", () => {
    currentStage = Number(btn.dataset.stage);
    renderer.render(scene, currentStage);
  });
});
