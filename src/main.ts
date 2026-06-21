import { GridRenderer } from "./render/GridRenderer";
import { hubCellAt } from "./render/hubContent";
import { isSolidCellKind } from "./render/palette";
import { attemptMove, type Direction } from "./engine/movement";
import { markVisibleCellsExplored } from "./engine/exploration";
import { cellVisibility, DEFAULT_LIGHT_RADIUS, zoneContaining } from "./engine/visibility";
import type { NarratorTrigger } from "./engine/types";
import { cellKey, MATERIALS } from "./engine/types";
import { LIGHT_SOURCES, ORE_VEINS, WOOD_NODE_PLACEMENTS, ZONES } from "./engine/hubMap";
import { isNearTorch, repairTorch } from "./engine/torches";
import {
  attemptMineStrike,
  applyMineResult,
  ROCK_NODES,
  createFreshDepletionState,
  isExhausted as isOreExhausted,
} from "./engine/mining";
import {
  attemptWoodGather,
  applyWoodGatherResult,
  WOOD_NODES,
  isExhausted as isWoodExhausted,
} from "./engine/woodcraft";
import { canAffordForgeRepair, applyForgeRepair, FORGE_REPAIR_COST } from "./engine/smithing";
import { xpIntoCurrentLevel, xpNeededForNextLevel } from "./engine/xpCurve";
import { triggerNarration } from "./narration/narrator";
import { showNarratorToast } from "./narration/toast";
import { loadGame, saveGame, clearSave } from "./persistence/saveGame";

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
  woodcraft: document.querySelector<HTMLParagraphElement>("#stat-woodcraft")!,
  barMining: document.querySelector<HTMLDivElement>("#bar-mining")!,
  barSmithing: document.querySelector<HTMLDivElement>("#bar-smithing")!,
  barHearthkeeping: document.querySelector<HTMLDivElement>("#bar-hearthkeeping")!,
  barWoodcraft: document.querySelector<HTMLDivElement>("#bar-woodcraft")!,
  inventoryList: document.querySelector<HTMLDivElement>("#inventory-list")!,
};

/**
 * Returns a 0-100 fill percentage for a skill's progress toward its
 * next level. Deliberately the ONLY thing exposed to the UI - never
 * the raw xpIntoCurrentLevel/xpNeededForNextLevel numbers themselves.
 * The player should feel "I'm getting close" without ever seeing an
 * exact XP curve - that opacity is intentional (see DESIGN.md §4).
 */
function levelProgressPercent(totalXp: number): number {
  const needed = xpNeededForNextLevel(totalXp);
  if (needed === 0) return 100; // max level - bar reads full, nothing more to chase
  const into = xpIntoCurrentLevel(totalXp);
  return Math.min(100, (into / needed) * 100);
}

function updateStatsPanel(): void {
  const { skills, inventory } = state.vessel;
  statEls.mining.textContent = `Mining ${skills.mining.level}`;
  statEls.smithing.textContent = `Smithing ${skills.smithing.level}`;
  statEls.hearthkeeping.textContent = `Hearthkeeping ${skills.hearthkeeping.level}`;
  statEls.woodcraft.textContent = `Woodcraft ${skills.woodcraft.level}`;

  statEls.barMining.style.width = `${levelProgressPercent(skills.mining.xp)}%`;
  statEls.barSmithing.style.width = `${levelProgressPercent(skills.smithing.xp)}%`;
  statEls.barHearthkeeping.style.width = `${levelProgressPercent(skills.hearthkeeping.xp)}%`;
  statEls.barWoodcraft.style.width = `${levelProgressPercent(skills.woodcraft.xp)}%`;

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
    return !isOreExhausted(rockNode, depletion);
  });
}

function nearestAnyVein() {
  const { position } = state.vessel;
  return ORE_VEINS.find(
    (v) => Math.abs(v.position.col - position.col) <= 1 && Math.abs(v.position.row - position.row) <= 1
  );
}

function nearestWoodNode() {
  const { position } = state.vessel;
  return WOOD_NODE_PLACEMENTS.find((w) => {
    const inRange =
      Math.abs(w.position.col - position.col) <= 1 && Math.abs(w.position.row - position.row) <= 1;
    if (!inRange) return false;
    const woodNode = WOOD_NODES.find((n) => n.id === w.woodNodeId);
    if (!woodNode) return false;
    const depletion = state.world.woodDepletion[w.id] ?? createFreshDepletionState();
    return !isWoodExhausted(woodNode, depletion);
  });
}

function nearestAnyWoodNode() {
  const { position } = state.vessel;
  return WOOD_NODE_PLACEMENTS.find(
    (w) => Math.abs(w.position.col - position.col) <= 1 && Math.abs(w.position.row - position.row) <= 1
  );
}

/** The forge room's center, where the broken/working forge sits - used to check proximity for repair. */
const FORGE_ROOM = ZONES.find((z) => z.id === "forge_room")!;
const FORGE_CENTER = {
  col: FORGE_ROOM.bounds.col + Math.floor(FORGE_ROOM.bounds.width / 2),
  row: FORGE_ROOM.bounds.row + Math.floor(FORGE_ROOM.bounds.height / 2),
};

function isNearForge(): boolean {
  const { position } = state.vessel;
  return (
    Math.abs(position.col - FORGE_CENTER.col) <= 2 && Math.abs(position.row - FORGE_CENTER.row) <= 2
  );
}

function isForgeRepaired(): boolean {
  return state.world.forgeTier >= 1;
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

  if (isNearForge() && !isForgeRepaired()) {
    const costText = Object.entries(FORGE_REPAIR_COST)
      .map(([res, amt]) => `${amt} ${MATERIALS[res]?.name ?? res}`)
      .join(", ");
    actionHint.textContent = `Press R to repair the forge (${costText})`;
    return;
  }

  const vein = nearestOreVein();
  if (vein) {
    actionHint.textContent = "Press F to strike the vein";
    return;
  }

  const woodNode = nearestWoodNode();
  if (woodNode) {
    actionHint.textContent = "Press F to cut the root tangle";
    return;
  }

  const anyVein = nearestAnyVein();
  if (anyVein) {
    actionHint.textContent = "This vein is exhausted. Nothing left to take.";
    return;
  }

  const anyWoodNode = nearestAnyWoodNode();
  if (anyWoodNode) {
    actionHint.textContent = "This root tangle is exhausted. Nothing left to cut.";
    return;
  }

  actionHint.textContent = "";
}

function isSolidAt(col: number, row: number): boolean {
  return isSolidCellKind(
    hubCellAt(
      col,
      row,
      state.world.litTorches,
      state.world.veinDepletion,
      state.world.woodDepletion,
      state.world.forgeTier
    ).kind
  );
}

function render(): void {
  const { position } = state.vessel;

  renderer.render(
    (col, row) => {
      if (col === position.col && row === position.row) return { kind: "dwarf" };
      return hubCellAt(
        col,
        row,
        state.world.litTorches,
        state.world.veinDepletion,
        state.world.woodDepletion,
        state.world.forgeTier
      );
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
  if (isOreExhausted(rockNode, depletion)) {
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

function handleWoodGather(): void {
  const woodPlacement = nearestWoodNode();
  if (!woodPlacement) return;

  const woodNode = WOOD_NODES.find((n) => n.id === woodPlacement.woodNodeId);
  if (!woodNode) return;

  const woodcraftSkill = state.vessel.skills.woodcraft;
  if (woodcraftSkill.level < woodNode.requiredLevel) return; // defensive, shouldn't happen for the starter node

  const depletion = state.world.woodDepletion[woodPlacement.id] ?? createFreshDepletionState();
  if (isWoodExhausted(woodNode, depletion)) {
    actionHint.textContent = `The ${woodNode.name.toLowerCase()} is exhausted.`;
    return;
  }

  const result = attemptWoodGather(woodNode, woodcraftSkill, state.world.forgeTier, depletion, Math.random());

  state = {
    ...state,
    world: {
      ...state.world,
      woodDepletion: { ...state.world.woodDepletion, [woodPlacement.id]: result.newDepletion },
    },
  };

  if (!result.success) {
    render();
    return;
  }

  const newInventory = applyWoodGatherResult(state.vessel.inventory, result);
  const newWoodcraftSkill = {
    ...woodcraftSkill,
    level: result.newLevel,
    xp: woodcraftSkill.xp + result.xpGained,
  };

  state = {
    ...state,
    vessel: {
      ...state.vessel,
      inventory: newInventory,
      skills: { ...state.vessel.skills, woodcraft: newWoodcraftSkill },
    },
  };

  // Reuses the mining narration triggers for now rather than adding a
  // parallel wood_first_gather/wood_gather pair - see DESIGN.md if/when
  // Woodcraft earns its own distinct narrator voice; for now "the pick
  // finds rock" lines would be wrong for wood, so this deliberately
  // narrates nothing rather than show a mismatched line. Worth a real
  // pass once Woodcraft's narrative identity is settled.
  if (result.leveledUp) narrate("level_up");

  render();
}

function handleForgeRepair(): void {
  if (!isNearForge() || isForgeRepaired()) return;

  if (!canAffordForgeRepair(state.vessel.inventory)) {
    const costText = Object.entries(FORGE_REPAIR_COST)
      .map(([res, amt]) => `${amt} ${MATERIALS[res]?.name ?? res}`)
      .join(", ");
    actionHint.textContent = `Not enough materials to repair the forge (need ${costText}).`;
    return;
  }

  const newInventory = applyForgeRepair(state.vessel.inventory);
  state = {
    ...state,
    world: { ...state.world, forgeTier: 1 },
    vessel: { ...state.vessel, inventory: newInventory },
  };

  showNarratorToast(
    narratorContainer,
    "The forge catches. Cold iron remembers, even after all this time, what it's for."
  );

  render();
}

window.addEventListener("keydown", (e) => {
  // Browsers fire repeated keydown events (e.repeat=true) while a key
  // is held - without this guard, holding F would mine every few
  // milliseconds for as long as the key stayed down. Mining and
  // repairing are meant to be deliberate, one-press-one-action moments,
  // not something a held key can spam. Movement is exempted below -
  // holding an arrow key to walk a long corridor is normal and fine.
  if (e.repeat && "fFeErR".includes(e.key)) {
    return;
  }

  if (e.key === "f" || e.key === "F") {
    if (nearestOreVein()) {
      handleMineStrike();
    } else if (nearestWoodNode()) {
      handleWoodGather();
    }
    return;
  }

  if (e.key === "r" || e.key === "R") {
    handleForgeRepair();
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
  if (!moveResult.moved) {
    if (moveResult.blockedReason === "locked_zone") {
      actionHint.textContent = "Something blocks the way - not yet rebuilt, not yet open to him.";
    }
    return; // blocked - no state change, no render/save needed
  }

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
