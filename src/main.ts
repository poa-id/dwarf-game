import { GridRenderer } from "./render/GridRenderer";
import { clearSave } from "./persistence/saveGame";
import { initGameState } from "./game/gameState";
import { initRenderRefs, render } from "./game/render";
import { startGameLoop } from "./game/loop";
import { handlePlayerMove, KEY_TO_DIRECTION } from "./game/movement";
import { handleMineStrike, handleWoodGather, handleForgeRepair, handleTorchRepair } from "./game/actions";
import { nearestOreVein, nearestWoodNode } from "./game/proximity";

const app = document.querySelector<HTMLDivElement>("#app")!;

app.innerHTML = `
  <div class="shell">
    <h1>the hearth &amp; the deep</h1>
    <p class="subtitle">WASD/arrows to move &middot; F to gather &middot; E to repair a torch &middot; R to repair the forge</p>
    <div class="game-area">
      <canvas id="game-canvas"></canvas>
      <div class="stats-panel">
        <div class="stats-section">
          <h2>the dwarf</h2>
          <div class="skill-row">
            <p id="stat-mining">Mining 1</p>
            <div class="skill-bar"><div class="skill-bar-fill" id="bar-mining"></div></div>
          </div>
          <div class="skill-row">
            <p id="stat-smithing">Smithing 1</p>
            <div class="skill-bar"><div class="skill-bar-fill" id="bar-smithing"></div></div>
          </div>
          <div class="skill-row">
            <p id="stat-hearthkeeping">Hearthkeeping 1</p>
            <div class="skill-bar"><div class="skill-bar-fill" id="bar-hearthkeeping"></div></div>
          </div>
          <div class="skill-row">
            <p id="stat-woodcraft">Woodcraft 1</p>
            <div class="skill-bar"><div class="skill-bar-fill" id="bar-woodcraft"></div></div>
          </div>
        </div>
        <div class="stats-section">
          <h2>carried</h2>
          <div id="inventory-list"></div>
        </div>
        <div class="stats-section contextual-panel" id="contextual-panel"></div>
      </div>
    </div>
    <p class="hint" id="zone-hint"></p>
    <p class="hint" id="action-hint"></p>
    <div class="narrator-container" id="narrator-container"></div>
    <button id="reset-save-btn" class="reset-btn">reset save</button>
  </div>
`;

const canvas = document.querySelector<HTMLCanvasElement>("#game-canvas")!;
const zoneHint = document.querySelector<HTMLParagraphElement>("#zone-hint")!;
const actionHint = document.querySelector<HTMLParagraphElement>("#action-hint")!;
const narratorContainer = document.querySelector<HTMLDivElement>("#narrator-container")!;
const contextualPanel = document.querySelector<HTMLDivElement>("#contextual-panel")!;

const renderer = new GridRenderer(canvas, {
  viewportCols: 25,
  viewportRows: 17,
  cellSize: 24,
});

initRenderRefs({
  renderer,
  zoneHint,
  actionHint,
  contextualPanel,
  statEls: {
    mining: document.querySelector<HTMLParagraphElement>("#stat-mining")!,
    smithing: document.querySelector<HTMLParagraphElement>("#stat-smithing")!,
    hearthkeeping: document.querySelector<HTMLParagraphElement>("#stat-hearthkeeping")!,
    woodcraft: document.querySelector<HTMLParagraphElement>("#stat-woodcraft")!,
    barMining: document.querySelector<HTMLDivElement>("#bar-mining")!,
    barSmithing: document.querySelector<HTMLDivElement>("#bar-smithing")!,
    barHearthkeeping: document.querySelector<HTMLDivElement>("#bar-hearthkeeping")!,
    barWoodcraft: document.querySelector<HTMLDivElement>("#bar-woodcraft")!,
    inventoryList: document.querySelector<HTMLDivElement>("#inventory-list")!,
  },
});

const loadResult = initGameState(narratorContainer);
if (loadResult.discardedIncompatibleSave) {
  actionHint.textContent = "An old save could not be read and was reset.";
}

render();
startGameLoop();

window.addEventListener("keydown", (e) => {
  if (e.repeat && "fFeErR".includes(e.key)) {
    return;
  }

  if (e.key === "f" || e.key === "F") {
    if (nearestOreVein()) {
      handleMineStrike(actionHint);
    } else if (nearestWoodNode()) {
      handleWoodGather();
    }
    render();
    return;
  }

  if (e.key === "r" || e.key === "R") {
    handleForgeRepair(narratorContainer, actionHint);
    render();
    return;
  }

  if (e.key === "e" || e.key === "E") {
    handleTorchRepair(actionHint);
    render();
    return;
  }

  const direction = KEY_TO_DIRECTION[e.key];
  if (!direction) return;
  e.preventDefault();

  const outcome = handlePlayerMove(direction);
  if (!outcome.moved) {
    if (outcome.blockedMessage) actionHint.textContent = outcome.blockedMessage;
    return;
  }

  render();
});

const resetButton = document.querySelector<HTMLButtonElement>("#reset-save-btn")!;
resetButton.addEventListener("click", () => {
  const confirmed = window.confirm(
    "This will permanently erase the current save - the mountain, every dwarf's progress, all of it. Are you sure?"
  );
  if (!confirmed) return;
  clearSave();
  window.location.reload();
});
