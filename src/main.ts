import { GridRenderer } from "./render/GridRenderer";
import { TilesetRenderer } from "./render/TilesetRenderer";
import { clearSave } from "./persistence/saveGame";
import { initGameState, getState } from "./game/gameState";
import { initRenderRefs, render } from "./game/render";
import { startGameLoop } from "./game/loop";
import { handlePlayerMove, KEY_TO_DIRECTION } from "./game/movement";
import { handleMineStrike, handleWoodGather, handleTorchRepair, handlePlaceTorch, handleLightPlacedTorch } from "./game/actions";
import { hubCellAt } from "./render/hubContent";
import { nearestOreVein, nearestWoodNode } from "./game/proximity";
import { movePanelHighlight, confirmPanelHighlight } from "./game/panelNavigation";
import { getLastSavedAt } from "./persistence/saveGame";
import { computeOfflineSummary, renderOfflineSummaryBanner } from "./engine/offlineSummary";
import { buildSkillsGridHtml } from "./ui/skillsGridPanel";
import { buildToolsPanelHtml } from "./ui/toolsIconPanel";

const app = document.querySelector<HTMLDivElement>("#app")!;

app.innerHTML = `
  <div class="shell">
    <div class="topbar">
      <h1>the hearth &amp; the deep</h1>
      <div class="topbar-stats">
        <span id="stat-restoration" class="topbar-restoration" style="display:none;"></span>
        <span id="stat-insight" class="topbar-insight">Insight: 0</span>
        <span id="stat-insight-rate" class="topbar-rate"></span>
      </div>
    </div>
    <p class="subtitle">WASD move &middot; F gather &middot; E repair/light &middot; T place torch</p>
    <div class="game-area">

      <!-- LEFT PANEL: tabbed Skills/Bag/Production. Restoration + Insight
           moved to the top bar (2026-07-03) - single source of truth,
           reclaims sidebar space for the tabs below. -->
      <div class="stats-panel stats-panel-left">
        <div class="tab-bar">
          <button class="tab-btn tab-active" data-panel="left" data-tab="skills">Skills</button>
          <button class="tab-btn" data-panel="left" data-tab="bag">Bag</button>
          <button class="tab-btn" data-panel="left" data-tab="production" id="production-tab-btn" style="display:none">⛏</button>
        </div>

        <div class="tab-content" id="tab-skills">
          <div class="stats-section">
            ${buildSkillsGridHtml()}
          </div>
          <div class="stats-section">
            ${buildToolsPanelHtml()}
          </div>
        </div>

        <div class="tab-content" id="tab-bag" style="display:none">
          <div class="stats-section tab-full-height">
            <div id="inventory-list"></div>
          </div>
        </div>

        <div class="tab-content" id="tab-production" style="display:none">
          <div class="stats-section tab-full-height" id="production-panel"></div>
        </div>
      </div>

      <canvas id="game-canvas"></canvas>

      <!-- RIGHT PANEL: context only, no tabs -->
      <div class="stats-panel stats-panel-right">
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

// ── Tab switching ──────────────────────────────────────────────────────────
function setupTabs(panelId: "left") {
  document.querySelectorAll<HTMLButtonElement>(`.tab-btn[data-panel="${panelId}"]`).forEach(btn => {
    btn.addEventListener("click", () => {
      const tab = btn.dataset.tab!;
      document.querySelectorAll<HTMLButtonElement>(`.tab-btn[data-panel="${panelId}"]`)
        .forEach(b => b.classList.remove("tab-active"));
      btn.classList.add("tab-active");
      const allTabs = ["skills", "bag", "production"];
      allTabs.forEach(t => {
        const el = document.getElementById(`tab-${t}`);
        if (el) el.style.display = t === tab ? "" : "none";
      });
    });
  });
}

setupTabs("left");

const renderer = new GridRenderer(canvas, {
  viewportCols: 28,
  viewportRows: 18,
  cellSize: 32,
});

// Tileset mode (sprite art) shares the SAME canvas - whichever renderer
// is active this frame just draws over whatever was there before (both
// clear to black background first thing, same as a single-renderer
// setup would). render.ts's render() picks which one to call based on
// colorStage - see activeRenderer() there. Asset loading is async;
// preload() is kicked off here but NOT awaited before the first
// render() call below - a player starts at colorStage 0 (ASCII mode)
// regardless, so tileset assets have hours of real playtime to finish
// loading in the background before they're ever actually needed.
const tilesetRenderer = new TilesetRenderer(canvas, {
  viewportCols: 28,
  viewportRows: 18,
  cellSize: 32,
});
tilesetRenderer.preload();

initRenderRefs({
  renderer,
  tilesetRenderer,
  zoneHint,
  actionHint,
  contextualPanel,
  statEls: {
    mining: document.querySelector<HTMLParagraphElement>("#stat-mining")!,
    smithing: document.querySelector<HTMLParagraphElement>("#stat-smithing")!,
    hearthkeeping: document.querySelector<HTMLParagraphElement>("#stat-hearthkeeping")!,
    woodcraft: document.querySelector<HTMLParagraphElement>("#stat-woodcraft")!,
    tinkering: document.querySelector<HTMLParagraphElement>("#stat-tinkering")!,
    barMining: document.querySelector<HTMLDivElement>("#bar-mining")!,
    barSmithing: document.querySelector<HTMLDivElement>("#bar-smithing")!,
    barHearthkeeping: document.querySelector<HTMLDivElement>("#bar-hearthkeeping")!,
    barWoodcraft: document.querySelector<HTMLDivElement>("#bar-woodcraft")!,
    barTinkering: document.querySelector<HTMLDivElement>("#bar-tinkering")!,
    inventoryList: document.querySelector<HTMLDivElement>("#inventory-list")!,
    insightDisplay: document.querySelector<HTMLParagraphElement>("#stat-insight")!,
    restorationDisplay: document.querySelector<HTMLParagraphElement>("#stat-restoration")!,
    insightRateDisplay: document.querySelector<HTMLParagraphElement>("#stat-insight-rate")!,
  },
});

const lastSavedAt = getLastSavedAt();
const now = Date.now();
const loadResult = initGameState(narratorContainer);
if (loadResult.discardedIncompatibleSave) {
  actionHint.textContent = "An old save could not be read and was reset.";
} else if (!loadResult.isFreshState) {
  // Existing save — check if meaningful time has passed for offline summary
  const elapsedMs = now - lastSavedAt;
  const summary = computeOfflineSummary(getState().world, elapsedMs);
  const contextualPanel = document.querySelector<HTMLDivElement>("#contextual-panel");
  if (contextualPanel && summary.isSignificant && summary.totalOreProduced > 0) {
    renderOfflineSummaryBanner(summary, contextualPanel);
  }
}

render();
startGameLoop();

window.addEventListener("keydown", (e) => {
  // Repeat-guard covers every action/navigation key, not just F/E/R -
  // extended 2026-06-23 to include arrow keys and Space, since holding
  // Space down could otherwise spam-fire the highlighted row's action
  // (e.g. rapidly burning through wood at the Kiln) on every repeat
  // keydown event, and holding an arrow key would skip rows faster
  // than intended.
  if (e.repeat && (e.key === "Enter" || e.key === "ArrowUp" || e.key === "ArrowDown" || "fFeE".includes(e.key))) {
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

  if (e.key === "e" || e.key === "E") {
    handleTorchRepair(actionHint);
    // Check for nearby placed torches (lit OR unlit)
    const world = getState().world;
    const pos = getState().vessel.position;
    for (const [key] of Object.entries(world.placedTorches)) {
      const [tc, tr] = key.split(",").map(Number);
      if (Math.abs(tc - pos.col) <= 1 && Math.abs(tr - pos.row) <= 1) {
        handleLightPlacedTorch(tc, tr, actionHint);
        break;
      }
    }
    render();
    return;
  }

  // Swallow Space entirely — it has no game action and causes page scroll
  if (e.key === " ") { e.preventDefault(); return; }

  if (e.key === "t" || e.key === "T") {
    const state = getState();
    const world = state.world;
    const drillTiers = Object.fromEntries(Object.entries(world.drills).map(([id, d]) => [id, d.tier]));
    const isWallCell = (col: number, row: number): boolean => {
      const cell = hubCellAt(col, row,
        world.litTorches, world.veinDepletion, world.woodDepletion, world.forgeTier,
        world.smelterBuilt, world.gemcuttingBuilt, world.companion.befriended,
        world.consoleAwakened,
        world.roomStates["stockpile_room"] ?? "ruined",
        world.roomStates["trade_hall"] ?? "ruined",
        world.roomStates["deep_foundry"] ?? "ruined",
        world.roomStates["the_archive"] ?? "ruined",
        drillTiers, world.placedTorches
      );
      return cell.kind === "rock_wall" || cell.kind === "rubble";
    };
    handlePlaceTorch(actionHint, isWallCell);
    render();
    return;
  }

  // Arrow keys are fully reserved for contextual-panel navigation now
  // (2026-06-23, explicit direction) - they no longer move the dwarf
  // even when no panel is open (WASD is the sole movement input). If
  // the panel happens to be empty when an arrow key is pressed (no
  // contextual panel nearby), movePanelHighlight is a no-op - this is
  // deliberate; arrow keys simply do nothing outside panel range,
  // rather than falling back to movement.
  if (e.key === "ArrowUp" || e.key === "ArrowDown") {
    e.preventDefault();
    movePanelHighlight(contextualPanel, e.key === "ArrowUp" ? "up" : "down");
    return;
  }

  // Enter confirms the highlighted row in the contextual panel.
  if (e.key === "Enter") {
    if (confirmPanelHighlight(contextualPanel)) {
      e.preventDefault();
    }
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
