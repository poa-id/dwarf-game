import { GridRenderer, type Renderer } from "../render/GridRenderer";
import { TilesetRenderer } from "../render/TilesetRenderer";
import { hubCellAt } from "../render/hubContent";
import { cellVisibility, DEFAULT_LIGHT_RADIUS, zoneContaining } from "../engine/visibility";
import { cellKey, MATERIALS } from "../engine/types";
import { xpIntoCurrentLevel, xpNeededForNextLevel } from "../engine/xpCurve";
import { FORGE_REPAIR_COST } from "../engine/smithing";
import { bestAvailablePickaxe } from "../engine/mining";
import { bestAvailableAxe } from "../engine/woodcraft";
import { getState, setState, narrate, persist } from "./gameState";
import {
  nearestUnrepairedTorch,
  nearestOreVein,
  nearestAnyVein,
  nearestWoodNode,
  nearestAnyWoodNode,
  isNearForge,
  isForgeRepaired,
  isNearHearth,
  isNearKiln,
} from "./proximity";
import { renderSmithingPanel, performSmith, performForgeTool } from "../ui/smithingPanel";
import { renderHearthPanel, performStoke, performHearthUpgrade, performRekindle } from "../ui/hearthPanel";
import { renderKilnPanel, performCharcoalBurn } from "../ui/kilnPanel";
import { reapplyPanelHighlight, resetPanelHighlight } from "./panelNavigation";

export interface RenderRefs {
  renderer: GridRenderer;
  tilesetRenderer: TilesetRenderer;
  zoneHint: HTMLElement;
  actionHint: HTMLElement;
  contextualPanel: HTMLElement;
  statEls: {
    mining: HTMLElement;
    smithing: HTMLElement;
    hearthkeeping: HTMLElement;
    woodcraft: HTMLElement;
    barMining: HTMLElement;
    barSmithing: HTMLElement;
    barHearthkeeping: HTMLElement;
    barWoodcraft: HTMLElement;
    inventoryList: HTMLElement;
    toolsList: HTMLElement;
  };
}

let refs: RenderRefs;

/** Must be called once during boot with the DOM elements render() etc. will write into. */
export function initRenderRefs(r: RenderRefs): void {
  refs = r;
}

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
  const { skills, inventory } = getState().vessel;
  const { toolsForged } = getState().world;
  refs.statEls.mining.textContent = `Mining ${skills.mining.level}`;
  refs.statEls.smithing.textContent = `Smithing ${skills.smithing.level}`;
  refs.statEls.hearthkeeping.textContent = `Hearthkeeping ${skills.hearthkeeping.level}`;
  refs.statEls.woodcraft.textContent = `Woodcraft ${skills.woodcraft.level}`;

  (refs.statEls.barMining as HTMLDivElement).style.width = `${levelProgressPercent(skills.mining.xp)}%`;
  (refs.statEls.barSmithing as HTMLDivElement).style.width = `${levelProgressPercent(skills.smithing.xp)}%`;
  (refs.statEls.barHearthkeeping as HTMLDivElement).style.width = `${levelProgressPercent(skills.hearthkeeping.xp)}%`;
  (refs.statEls.barWoodcraft as HTMLDivElement).style.width = `${levelProgressPercent(skills.woodcraft.xp)}%`;

  // Tools - shows what's CURRENTLY equipped per slot (bestAvailablePickaxe/
  // bestAvailableAxe already pick the right ToolTier given the forged
  // tier), not the forging recipes themselves (those live in the
  // Smithing panel - see smithingPanel.ts). "Bare Hands" at tier 0 is
  // shown plainly, not hidden, since there's nothing to spoil here -
  // unlike Narag-Bund, knowing bare-handed mining exists isn't a
  // discovery moment worth gating.
  const pickaxe = bestAvailablePickaxe(toolsForged.pickaxe);
  const axe = bestAvailableAxe(toolsForged.axe);
  refs.statEls.toolsList.innerHTML = `<p>Pickaxe: ${pickaxe.name}</p><p>Axe: ${axe.name}</p>`;

  const heldEntries = Object.entries(inventory).filter(([, amount]) => (amount ?? 0) > 0);
  if (heldEntries.length === 0) {
    refs.statEls.inventoryList.innerHTML = `<p class="inventory-empty">nothing yet</p>`;
    return;
  }

  refs.statEls.inventoryList.innerHTML = heldEntries
    .map(([materialId, amount]) => {
      const def = MATERIALS[materialId];
      const label = def?.name ?? materialId;
      return `<p>${label}: ${amount}</p>`;
    })
    .join("");
}

function updateZoneHint(): void {
  const { position } = getState().vessel;
  const zone = zoneContaining(position.col, position.row);
  refs.zoneHint.textContent = zone ? zone.name : "the dark halls";
}

export function updateActionHint(): void {
  const torch = nearestUnrepairedTorch();
  if (torch) {
    const costText = Object.entries(torch.repairCost)
      .map(([res, amt]) => `${amt} ${res}`)
      .join(", ");
    refs.actionHint.textContent = `Press E to repair ${torch.name} (${costText})`;
    return;
  }

  if (isNearForge() && !isForgeRepaired()) {
    const costText = Object.entries(FORGE_REPAIR_COST)
      .map(([res, amt]) => `${amt} ${MATERIALS[res]?.name ?? res}`)
      .join(", ");
    refs.actionHint.textContent = `Press R to repair the forge (${costText})`;
    return;
  }

  const vein = nearestOreVein();
  if (vein) {
    refs.actionHint.textContent = "Press F to strike the vein";
    return;
  }

  const woodNode = nearestWoodNode();
  if (woodNode) {
    refs.actionHint.textContent = "Press F to cut the root tangle";
    return;
  }

  const anyVein = nearestAnyVein();
  if (anyVein) {
    refs.actionHint.textContent = "This vein is exhausted. Nothing left to take.";
    return;
  }

  const anyWoodNode = nearestAnyWoodNode();
  if (anyWoodNode) {
    refs.actionHint.textContent = "This root tangle is exhausted. Nothing left to cut.";
    return;
  }

  refs.actionHint.textContent = "";
}

/**
 * Tracks which panel was active on the PREVIOUS call, purely to detect
 * a switch (e.g. walked from the Forge to the Hearth) so the keyboard
 * highlight resets to row 0 rather than carrying over an index that
 * made sense for a different panel's row count. See panelNavigation.ts.
 */
let lastActivePanelKind: "forge" | "hearth" | "kiln" | "none" = "none";

/**
 * Decides which contextual panel (if any) applies given the dwarf's
 * current position, and renders it into the reserved panel space.
 * Forge takes priority over Hearth and Kiln if somehow ranges
 * overlapped (they don't, given the map layout, but the priority
 * order is explicit rather than accidental). Kiln is checked after
 * Hearth for the same reason - explicit, not because overlap is
 * expected. Shows nothing - panel collapses to empty - when none are
 * nearby, per the "reserved space, not a popup" UI philosophy: the
 * layout never jumps, the panel area is just sometimes empty.
 */
function updateContextualPanel(): void {
  const state = getState();

  if (isNearForge() && isForgeRepaired()) {
    if (lastActivePanelKind !== "forge") resetPanelHighlight();
    lastActivePanelKind = "forge";
    renderSmithingPanel(
      state,
      refs.contextualPanel,
      (recipe) => {
        const outcome = performSmith(getState(), recipe);
        setState(outcome.newState);
        if (outcome.leveledUp) narrate("level_up");
        render();
      },
      (toolRecipe) => {
        const outcome = performForgeTool(getState(), toolRecipe);
        setState(outcome.newState);
        if (outcome.leveledUp) narrate("level_up");
        render();
      }
    );
    reapplyPanelHighlight(refs.contextualPanel);
    return;
  }

  if (isNearHearth()) {
    if (lastActivePanelKind !== "hearth") resetPanelHighlight();
    lastActivePanelKind = "hearth";
    renderHearthPanel(
      state,
      refs.contextualPanel,
      (materialId, target) => {
        const outcome = performStoke(getState(), materialId, target);
        setState(outcome.newState);
        if (outcome.colorStageIncreased) {
          const already = getState().narrator.firedOnceTriggers.includes("color_stage_1");
          narrate(already ? "color_stage_later" : "color_stage_1");
        }
        if (outcome.leveledUp) narrate("level_up");
        render();
      },
      () => {
        const wasBefriendedBefore = getState().world.companion.befriended;
        setState(performHearthUpgrade(getState()));
        if (!wasBefriendedBefore && getState().world.companion.befriended) {
          narrate("companion_befriended");
        }
        render();
      },
      () => {
        const result = performRekindle(getState());
        if (!result) return; // defensive - the panel shouldn't have offered this below threshold
        setState(result.newState);
        // wake_rekindled, not wake_first_ever - this dwarf is new, but
        // the world (and the player) have been here before. See
        // gameState.ts's comment on why this trigger was previously
        // unreachable - this onRekindle callback is its first and only
        // real caller.
        narrate("wake_rekindled");
        render();
      }
    );
    reapplyPanelHighlight(refs.contextualPanel);
    return;
  }

  if (isNearKiln()) {
    if (lastActivePanelKind !== "kiln") resetPanelHighlight();
    lastActivePanelKind = "kiln";
    renderKilnPanel(state, refs.contextualPanel, () => {
      const outcome = performCharcoalBurn(getState());
      setState(outcome.newState);
      if (outcome.leveledUp) narrate("level_up");
      render();
    });
    reapplyPanelHighlight(refs.contextualPanel);
    return;
  }

  lastActivePanelKind = "none";
  refs.contextualPanel.innerHTML = "";
}

// Tileset mode activates at colorStage 2+ ("Hearthlight" - materials
// gain identity, per MECHANICS.md's Perception Is Progression framing)
// - ASCII glyphs are used at Stage 0/1, matching the "world is
// forgotten/undifferentiated" feel those stages are meant to convey.
// This is the FIRST time TilesetRenderer is actually switched to
// anywhere - it existed fully asset-backed and type-complete since
// earlier this session, but nothing ever selected it (see its own
// docstring for the full history). Stage 3 does NOT change the
// tileset's own appearance further per explicit direction - one fixed
// look from Stage 2 onward; further stage progress is felt other ways.
const TILESET_MODE_MIN_COLOR_STAGE = 2;

function activeRenderer(colorStage: number): Renderer {
  return colorStage >= TILESET_MODE_MIN_COLOR_STAGE ? refs.tilesetRenderer : refs.renderer;
}

export function render(): void {
  const state = getState();
  const { position } = state.vessel;
  const colorStage = state.world.hearth.colorStage;

  activeRenderer(colorStage).render(
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
    colorStage
  );

  updateZoneHint();
  updateActionHint();
  updateStatsPanel();
  updateContextualPanel();
  persist();
}
