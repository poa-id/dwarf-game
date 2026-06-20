import { GridRenderer } from "./render/GridRenderer";
import { hubCellAt } from "./render/hubContent";
import { createInitialGameState } from "./engine/rekindle";
import { attemptMove, type Direction } from "./engine/movement";
import { markVisibleCellsExplored } from "./engine/exploration";
import { cellVisibility, DEFAULT_LIGHT_RADIUS, zoneContaining } from "./engine/visibility";
import type { NarratorTrigger } from "./engine/types";
import { cellKey } from "./engine/types";
import { LIGHT_SOURCES, ORE_VEINS } from "./engine/hubMap";
import { isNearTorch, repairTorch } from "./engine/torches";
import { attemptMineStrike, ROCK_NODES, addOreToInventory } from "./engine/mining";
import { triggerNarration } from "./narration/narrator";
import { showNarratorToast } from "./narration/toast";

const app = document.querySelector<HTMLDivElement>("#app")!;

app.innerHTML = `
  <div class="shell">
    <h1>the hearth &amp; the deep</h1>
    <p class="subtitle">WASD/arrows to move &middot; F to strike rock &middot; E to repair a torch</p>
    <canvas id="game-canvas"></canvas>
    <p class="hint" id="zone-hint"></p>
    <p class="hint" id="action-hint"></p>
    <div class="narrator-container" id="narrator-container"></div>
  </div>
`;

const canvas = document.querySelector<HTMLCanvasElement>("#game-canvas")!;
const zoneHint = document.querySelector<HTMLParagraphElement>("#zone-hint")!;
const actionHint = document.querySelector<HTMLParagraphElement>("#action-hint")!;
const narratorContainer = document.querySelector<HTMLDivElement>("#narrator-container")!;

const renderer = new GridRenderer(canvas, {
  viewportCols: 25,
  viewportRows: 17,
  cellSize: 24,
});

let state = createInitialGameState(Date.now());

/** Fires a narrator trigger, shows the toast if a line was returned, and persists the updated narrator state. */
function narrate(trigger: NarratorTrigger): void {
  const result = triggerNarration(trigger, state.narrator, Math.random());
  state = { ...state, narrator: result.state };
  if (result.line) showNarratorToast(narratorContainer, result.line);
}

// The very first thing that happens, ever.
narrate("wake_first_ever");

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

function nearestUnrepairedTorch() {
  const { position } = state.vessel;
  return LIGHT_SOURCES.find(
    (t) => !state.world.litTorches[t.id] && isNearTorch(position.col, position.row, t)
  );
}

function nearestOreVein() {
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

  actionHint.textContent = "";
}

function render(): void {
  const { position } = state.vessel;

  renderer.render(
    (col, row) => {
      if (col === position.col && row === position.row) return { kind: "dwarf" };
      return hubCellAt(col, row, state.world.litTorches);
    },
    (col, row) =>
      cellVisibility(col, row, position, state.world, cellKey(col, row), DEFAULT_LIGHT_RADIUS),
    position.col,
    position.row,
    state.world.hearth.colorStage
  );

  updateZoneHint();
  updateActionHint();
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

  const isFirstStrikeEver = !state.narrator.firedOnceTriggers.includes("mine_first_strike");
  const result = attemptMineStrike(rockNode, miningSkill, state.world.forgeTier, Math.random());

  if (!result.success) {
    return; // a miss - no state change, no narration; the swing just didn't land
  }

  const newInventory = addOreToInventory(state.vessel.inventory, result.oreGained);
  const newMiningSkill = { ...miningSkill, level: result.newLevel, xp: miningSkill.xp + result.xpGained };

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

  const moveResult = attemptMove(state.vessel.position, direction, state.world);
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
