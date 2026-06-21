import { GridRenderer } from "./render/GridRenderer";
import { hubCellAt } from "./render/hubContent";
import { isSolidCellKind } from "./render/palette";
import { attemptMove, type Direction } from "./engine/movement";
import { markVisibleCellsExplored } from "./engine/exploration";
import { cellVisibility, DEFAULT_LIGHT_RADIUS, zoneContaining } from "./engine/visibility";
import type { NarratorTrigger } from "./engine/types";
import { cellKey, MATERIALS } from "./engine/types";
import { LIGHT_SOURCES, ORE_VEINS } from "./engine/hubMap";
import { isNearTorch, repairTorch } from "./engine/torches";
import {
  attemptMineStrike,
  applyMineResult,
  ROCK_NODES,
  createFreshDepletionState,
  isExhausted,
} from "./engine/mining";
import { triggerNarration } from "./narration/narrator";
import { showNarratorToast } from "./narration/toast";
import { loadGame, saveGame, clearSave } from "./persistence/saveGame";

const app = document.querySelector<HTMLDivElement>("#app")!;

app.innerHTML = `
  <div class="shell">
    <h1>the hearth &amp; the deep</h1>
    <p class="subtitle">WASD/arrows to move &middot; F to strike rock &middot; E to repair a torch</p>
    <div class="game-area">
      <canvas id="game-canvas"></canvas>
      <div class="stats-panel">
        <div class="stats-section">
          <h2>the dwarf</h2>
          <p id="stat-mining">Mining 1</p>
          <p id="stat-smithing">Smithing 1</p>
          <p id="stat-hearthkeeping">Hearthkeeping 1</p>
        </div>
        <div class="stats-section">
          <h2>carried</h2>
          <div id="inventory-list"></div>
        </div>
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

const statEls = {
  mining: document.querySelector<HTMLParagraphElement>("#stat-mining")!,
  smithing: document.querySelector<HTMLParagraphElement>("#stat-smithing")!,
  hearthkeeping: document.querySelector<HTMLParagraphElement>("#stat-hearthkeeping")!,
  inventoryList: document.querySelector<HTMLDivElement>("#inventory-list")!,
};

function updateStatsPanel(): void {
  const { skills, inventory } = state.vessel;
  statEls.mining.textContent = `Mining ${skills.mining.level}`;
  statEls.smithing.textContent = `Smithing ${skills.smithing.level}`;
  statEls.hearthkeeping.textContent = `Hearthkeeping ${skills.hearthkeeping.level}`;

  const heldEntries = Object.entries(inventory).filter(([, amount]) => (amount ?? 0) > 0);
  if (heldEntries.length === 0) {
    statEls.inventoryList.innerHTML = `<p class="inventory-empty">nothing yet</p>`;
    return;
  }

  statEls.inventoryList.innerHTML = heldEntries
    .map(([materialId, amount]) => {
      const def = MATERIALS[materialId];
      const label = def?.name ?? materialId;
      return `<p>${label}: ${amount}</p>`;
    })
    .join("");
}

const renderer = new GridRenderer(canvas, {
  viewportCols: 25,
  viewportRows: 17,
  cellSize: 24,
});

const loadResult = loadGame(Date.now());
let state = loadResult.state;

/** Fires a narrator trigger, shows the toast if a line was returned, and persists the updated narrator state. */
function narrate(trigger: NarratorTrigger): void {
  const result = triggerNarration(trigger, state.narrator, Math.random(), Math.random());
  state = { ...state, narrator: result.state };
  if (result.line) showNarratorToast(narratorContainer, result.line);
}

if (loadResult.discardedIncompatibleSave) {
  actionHint.textContent = "An old save could not be read and was reset.";
}

if (loadResult.isFreshState) {
  // True first boot ever - no save existed at all.
  narrate("wake_first_ever");
  // Mark the dwarf's starting position explored immediately, so the
  // very first frame already shows the lit area around him rather
  // than a single empty render before any movement happens.
  state = {
    ...state,
    world: {
      ...state.world,
      exploredCells: markVisibleCellsExplored(state.world.exploredCells, state.vessel.position),
    },
  };
} else {
  // A save existed - this is a returning player reopening the game,
  // NOT a rekindling (that's a deliberate in-game action, not "the
  // page reloaded"). Nothing narrates here; waking after a normal
  // reload isn't a meaningful enough moment to comment on, and we
  // don't want wake_rekindled firing every time someone refreshes the
  // tab - that trigger is reserved for the actual rekindle() action.
}

function persist(): void {
  saveGame(state);
}

function updateZoneHint(): void {
  const { position } = state.vessel;
  const zone = zoneContaining(position.col, position.row);
  zoneHint.textContent = zone ? zone.name : "the dark halls";
}

function nearestUnrepairedTorch() {
  const { position } = state.vessel;
  return LIGHT_SOURCES.find(
    (t) => !state.world.litTorches[t.id] && isNearTorch(position.col, position.row, t)
  );
}

function nearestOreVein() {
  const { position } = state.vessel;
  return ORE_VEINS.find((v) => {
    const inRange =
      Math.abs(v.position.col - position.col) <= 1 && Math.abs(v.position.row - position.row) <= 1;
    if (!inRange) return false;
    const rockNode = ROCK_NODES.find((n) => n.id === v.rockNodeId);
    if (!rockNode) return false;
    const depletion = state.world.veinDepletion[v.id] ?? createFreshDepletionState();
    return !isExhausted(rockNode, depletion);
  });
}

function nearestAnyVein() {
  const { position } = state.vessel;
  return ORE_VEINS.find(
    (v) => Math.abs(v.position.col - position.col) <= 1 && Math.abs(v.position.row - position.row) <= 1
  );
}

function updateActionHint(): void {
  const torch = nearestUnrepairedTorch();
  if (torch) {
    const costText = Object.entries(torch.repairCost)
      .map(([res, amt]) => `${amt} ${res}`)
      .join(", ");
    actionHint.textContent = `Press E to repair ${torch.name} (${costText})`;
    return;
  }

  const vein = nearestOreVein();
  if (vein) {
    actionHint.textContent = "Press F to strike the vein";
    return;
  }

  const anyVein = nearestAnyVein();
  if (anyVein) {
    actionHint.textContent = "This vein is exhausted. Nothing left to take.";
    return;
  }

  actionHint.textContent = "";
}

function isSolidAt(col: number, row: number): boolean {
  return isSolidCellKind(hubCellAt(col, row, state.world.litTorches, state.world.veinDepletion).kind);
}

function render(): void {
  const { position } = state.vessel;

  renderer.render(
    (col, row) => {
      if (col === position.col && row === position.row) return { kind: "dwarf" };
      return hubCellAt(col, row, state.world.litTorches, state.world.veinDepletion);
    },
    (col, row) =>
      cellVisibility(col, row, position, state.world, cellKey(col, row), DEFAULT_LIGHT_RADIUS),
    position.col,
    position.row,
    state.world.hearth.colorStage
  );

  updateZoneHint();
  updateActionHint();
  updateStatsPanel();
  persist();
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

function handleMineStrike(): void {
  const vein = nearestOreVein();
  if (!vein) return;

  const rockNode = ROCK_NODES.find((n) => n.id === vein.rockNodeId);
  if (!rockNode) return;

  const miningSkill = state.vessel.skills.mining;
  if (miningSkill.level < rockNode.requiredLevel) return; // shouldn't happen for the starter vein, defensive only

  const depletion = state.world.veinDepletion[vein.id] ?? createFreshDepletionState();
  if (isExhausted(rockNode, depletion)) {
    actionHint.textContent = `The ${rockNode.name.toLowerCase()} is exhausted.`;
    return;
  }

  const isFirstStrikeEver = !state.narrator.firedOnceTriggers.includes("mine_first_strike");
  const result = attemptMineStrike(rockNode, miningSkill, state.world.forgeTier, depletion, Math.random());

  state = {
    ...state,
    world: {
      ...state.world,
      veinDepletion: { ...state.world.veinDepletion, [vein.id]: result.newDepletion },
    },
  };

  if (!result.success) {
    render();
    return; // a miss - no material/xp change, no narration; the swing just didn't land
  }

  const newInventory = applyMineResult(state.vessel.inventory, result);
  const newMiningSkill = {
    ...miningSkill,
    level: result.newLevel,
    xp: miningSkill.xp + result.xpGained,
  };

  state = {
    ...state,
    vessel: {
      ...state.vessel,
      inventory: newInventory,
      skills: { ...state.vessel.skills, mining: newMiningSkill },
    },
  };

  narrate(isFirstStrikeEver ? "mine_first_strike" : "mine_strike");
  if (result.leveledUp) narrate("level_up");

  render();
}

window.addEventListener("keydown", (e) => {
  if (e.key === "f" || e.key === "F") {
    handleMineStrike();
    return;
  }

  if (e.key === "e" || e.key === "E") {
    const torch = nearestUnrepairedTorch();
    if (!torch) return;
    const outcome = repairTorch(state, torch);
    if (outcome.ok) {
      state = outcome.newState;
      narrate("torch_repaired");
      render();
    } else if (outcome.reason === "cannot_afford") {
      actionHint.textContent = `Not enough resources to repair ${torch.name}.`;
    }
    return;
  }

  const direction = KEY_TO_DIRECTION[e.key];
  if (!direction) return;
  e.preventDefault();

  const moveResult = attemptMove(state.vessel.position, direction, state.world, isSolidAt);
  if (!moveResult.moved) return; // blocked - nothing to update or redraw

  const newExplored = markVisibleCellsExplored(state.world.exploredCells, moveResult.position);
  const enteredZone = zoneContaining(moveResult.position.col, moveResult.position.row);
  const isFirstVisitToThisZone =
    enteredZone !== null && !state.world.loreFlags.includes(`visited_${enteredZone.id}`);

  state = {
    ...state,
    world: {
      ...state.world,
      exploredCells: newExplored,
      loreFlags: isFirstVisitToThisZone
        ? [...state.world.loreFlags, `visited_${enteredZone!.id}`]
        : state.world.loreFlags,
    },
    vessel: { ...state.vessel, position: moveResult.position },
  };

  if (isFirstVisitToThisZone) narrate("area_revealed");

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
