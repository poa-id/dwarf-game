import { GridRenderer, type Renderer } from "../render/GridRenderer";
import { TilesetRenderer } from "../render/TilesetRenderer";
import { hubCellAt } from "../render/hubContent";
import { isSolidCellKind } from "../render/palette";
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
  isNearSmelter,
  isNearGemcutting,
  isNearConsole,
  isNearGarden,
} from "./proximity";
import { renderSmithingPanel, performSmith, performForgeTool, performForgeUpgrade } from "../ui/smithingPanel";
import {
  renderHearthPanel,
  performStoke,
  performHearthUpgrade,
  performSpendTrueMetalOnYield,
  performRekindle,
} from "../ui/hearthPanel";
import { renderKilnPanel, performCharcoalBurn, performRenderHearthsap } from "../ui/kilnPanel";
import {
  renderSmelterPanel,
  performSmelterBuild,
  performPurify,
  performSmelterTierUpgrade,
  performUnlockIronPurifying,
  performIronSmelterTierUpgrade,
  performSpendTrueMetalOnPerk,
} from "../ui/smelterPanel";
import {
  renderGemcuttingPanel,
  performGemcuttingBuild,
  performCutGem,
  performGemcuttingTierUpgrade,
  performSpendCutGemOnPerk,
} from "../ui/gemcuttingPanel";
import { renderDrillSection, performBuildDrill, performRefuelDrill, performCollectDrillOre, performUpgradeDrill, performUpgradeDrillBuffer } from "../ui/drillPanel";
import { renderConsolePanel, performAwakenConsole } from "../ui/consolePanel";
import { renderStockpilePanel, performAdvanceStockpileRoom, performCollectStockpile, isNearStockpile } from "../ui/stockpilePanel";
import { renderGardenPanel, performAdvanceGardenRoom, performPlantSeed, performHarvestSlot } from "../ui/gardenPanel";
import { renderTradeHallPanel, performAdvanceTradeHall, performTrade, isNearTradeHall } from "../ui/tradeHallPanel";
import { renderRoomPanel, performAdvanceRoom, isNearDeepFoundry, isNearArchive } from "../ui/roomPanel";
import { getRestorationScore, estimatedInsightPerMin } from "../engine/production";
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
    tinkering: HTMLElement;
    barMining: HTMLElement;
    barSmithing: HTMLElement;
    barHearthkeeping: HTMLElement;
    barWoodcraft: HTMLElement;
    barTinkering: HTMLElement;
    inventoryList: HTMLElement;
    toolsList: HTMLElement;
    insightDisplay: HTMLElement;
    restorationDisplay: HTMLElement;
    insightRateDisplay: HTMLElement;
  };
}

let refs: RenderRefs;

// ---------------------------------------------------------------------------
// Insight/min rolling estimate — 60s window, sampled each render
// ---------------------------------------------------------------------------
let insightSampleHistory: Array<{ insight: number; time: number }> = [];
const INSIGHT_SAMPLE_WINDOW_MS = 60_000;

function recordInsightSample(insight: number): void {
  const now = Date.now();
  insightSampleHistory.push({ insight, time: now });
  // Keep only samples within the window
  insightSampleHistory = insightSampleHistory.filter(
    (s) => now - s.time <= INSIGHT_SAMPLE_WINDOW_MS
  );
}

function insightPerMinFromSamples(): number {
  if (insightSampleHistory.length < 2) return 0;
  const oldest = insightSampleHistory[0];
  const newest = insightSampleHistory[insightSampleHistory.length - 1];
  const deltaInsight = newest.insight - oldest.insight;
  const deltaMs = newest.time - oldest.time;
  if (deltaMs < 5_000 || deltaInsight <= 0) return 0; // need at least 5s of data
  return (deltaInsight / deltaMs) * 60_000;
}

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
  const world = getState().world;
  const { toolsForged, insightBanked } = world;

  // Restoration score — the primary "how alive is this mountain" number.
  // Only shown once the console is awakened (the mountain is self-aware).
  const restoration = getRestorationScore(world);
  if (world.consoleAwakened) {
    refs.statEls.restorationDisplay.textContent = `Restoration: ${restoration.total.toLocaleString()}`;
    refs.statEls.restorationDisplay.style.display = "";
  } else {
    refs.statEls.restorationDisplay.style.display = "none";
  }

  // Insight display + live rolling rate (falls back to idle estimate)
  refs.statEls.insightDisplay.textContent = `Insight: ${Math.floor(insightBanked)}`;
  recordInsightSample(insightBanked);
  const liveMin = insightPerMinFromSamples();
  const idleMin = estimatedInsightPerMin(world);
  const displayRate = liveMin > 0.05 ? liveMin : idleMin;
  if (world.consoleAwakened && displayRate > 0.05) {
    refs.statEls.insightRateDisplay.textContent = `+${displayRate.toFixed(1)}/min`;
    refs.statEls.insightRateDisplay.style.display = "";
  } else {
    refs.statEls.insightRateDisplay.style.display = "none";
  }

  refs.statEls.mining.textContent = `Mining ${skills.mining.level}`;
  refs.statEls.smithing.textContent = `Smithing ${skills.smithing.level}`;
  refs.statEls.hearthkeeping.textContent = `Hearthkeeping ${skills.hearthkeeping.level}`;
  refs.statEls.woodcraft.textContent = `Woodcraft ${skills.woodcraft.level}`;
  refs.statEls.tinkering.textContent = `Tinkering ${skills.tinkering.level}`;

  (refs.statEls.barMining as HTMLDivElement).style.width = `${levelProgressPercent(skills.mining.xp)}%`;
  (refs.statEls.barSmithing as HTMLDivElement).style.width = `${levelProgressPercent(skills.smithing.xp)}%`;
  (refs.statEls.barHearthkeeping as HTMLDivElement).style.width = `${levelProgressPercent(skills.hearthkeeping.xp)}%`;
  (refs.statEls.barWoodcraft as HTMLDivElement).style.width = `${levelProgressPercent(skills.woodcraft.xp)}%`;
  (refs.statEls.barTinkering as HTMLDivElement).style.width = `${levelProgressPercent(skills.tinkering.xp)}%`;

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
  const state = getState();
  const { position } = state.vessel;
  const world = state.world;

  if (isNearConsole()) {
    refs.actionHint.textContent = world.consoleAwakened
      ? "The mountain watches."
      : "Press F — awaken the console.";
    return;
  }

  if (isNearHearth()) {
    const fuel = Math.floor(world.hearth.fuel);
    const reserve = (Object.values(world.fuelReserve) as (number | undefined)[]).reduce((s: number, v) => s + (v ?? 0), 0);
    refs.actionHint.textContent = world.hearthTier >= 1
      ? `Hearth — fuel ${fuel} · reserve ${reserve}`
      : `Hearth — ${fuel} fuel · press F to stoke`;
    return;
  }

  if (isNearKiln()) {
    refs.actionHint.textContent = "Kiln — press F to burn charcoal";
    return;
  }

  if (isNearGarden()) {
    const gardenStage = world.roomStates["garden_room"] ?? "ruined";
    const readySlots = world.gardenSlots.filter(s => s.readyCount > 0).length;
    if (readySlots > 0) {
      refs.actionHint.textContent = `Garden (${gardenStage}) — ${readySlots} slot${readySlots !== 1 ? "s" : ""} ready to harvest`;
    } else {
      refs.actionHint.textContent = gardenStage === "ruined"
        ? "Overgrown garden — restore it to plant seeds"
        : `Garden (${gardenStage}) — ${world.gardenSlots.length} slots`;
    }
    return;
  }

  if (isNearForge() && !isForgeRepaired()) {
    const costText = Object.entries(FORGE_REPAIR_COST)
      .map(([res, amt]) => `${amt} ${MATERIALS[res]?.name ?? res}`)
      .join(", ");
    refs.actionHint.textContent = `Press R to repair the forge (${costText})`;
    return;
  }

  if (isNearForge() && isForgeRepaired()) {
    refs.actionHint.textContent = `Forge — tier ${world.forgeTier} · press F to smith`;
    return;
  }

  if (isNearSmelter() && world.smelterBuilt) {
    refs.actionHint.textContent = `Smelter — tier ${world.smelterTier} · press F to purify`;
    return;
  }

  if (isNearGemcutting() && world.gemcuttingBuilt) {
    refs.actionHint.textContent = "Gemcutting station — press F to cut gems";
    return;
  }

  const stockpileStage = world.roomStates["stockpile_room"] ?? "ruined";
  if (isNearStockpile(position, stockpileStage)) {
    if (stockpileStage === "ruined") {
      refs.actionHint.textContent = "Collapsed east wing — press F to clear the rubble";
    } else {
      const total = Object.values(world.stockpileOre).reduce((s, v) => s + (v ?? 0), 0);
      refs.actionHint.textContent = `Stockpile (${stockpileStage}) — ${total} ore stored`;
    }
    return;
  }

  if (isNearDeepFoundry(position)) {
    const stage = world.roomStates["deep_foundry"] ?? "ruined";
    refs.actionHint.textContent = stage === "ruined"
      ? "Collapsed northwest wing — the great furnace waits"
      : `Deep Foundry (${stage})`;
    return;
  }

  if (isNearArchive(position)) {
    const stage = world.roomStates["the_archive"] ?? "ruined";
    refs.actionHint.textContent = stage === "ruined"
      ? "Sealed north passage — something was protected here"
      : `The Archive (${stage})`;
    return;
  }

  const torch = nearestUnrepairedTorch();
  if (torch) {
    const costText = Object.entries(torch.repairCost)
      .map(([res, amt]) => `${amt} ${res}`)
      .join(", ");
    refs.actionHint.textContent = `Press E to repair ${torch.name} (${costText})`;
    return;
  }

  const vein = nearestOreVein();
  if (vein) {
    const drill = world.drills[vein.id];
    refs.actionHint.textContent = drill
      ? `Press F to mine · drill ${drill.coalBuffer > 0 ? "running" : "needs coal"}`
      : "Press F to strike the vein";
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

  // Show torch placement hint when player has materials
  const { inventory } = getState().vessel;
  if ((inventory["wood"] ?? 0) >= 1 && (inventory["coal"] ?? 0) >= 1) {
    refs.actionHint.textContent = "T — place torch on nearby wall";
  }
}

/**
 * Tracks which panel was active on the PREVIOUS call, purely to detect
 * a switch (e.g. walked from the Forge to the Hearth) so the keyboard
 * highlight resets to row 0 rather than carrying over an index that
 * made sense for a different panel's row count. See panelNavigation.ts.
 */
let lastActivePanelKind: "console" | "forge" | "hearth" | "kiln" | "smelter" | "gemcutting" | "drill" | "stockpile" | "garden" | "trade" | "foundry" | "archive" | "none" = "none";

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
  const { position } = state.vessel;

  if (isNearConsole()) {
    if (lastActivePanelKind !== "console") resetPanelHighlight();
    lastActivePanelKind = "console";
    refs.contextualPanel.innerHTML = "";
    renderConsolePanel(
      state,
      refs.contextualPanel,
      () => {
        const wasAwakened = getState().world.consoleAwakened;
        setState(performAwakenConsole(getState()));
        if (!wasAwakened) narrate("console_awakened");
        render();
      }
    );
    reapplyPanelHighlight(refs.contextualPanel);
    return;
  }

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
      },
      () => {
        setState(performForgeUpgrade(getState()));
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
        setState(performSpendTrueMetalOnYield(getState()));
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
    renderKilnPanel(state, refs.contextualPanel,
      () => {
        const outcome = performCharcoalBurn(getState());
        setState(outcome.newState);
        if (outcome.leveledUp) narrate("level_up");
        render();
      },
      () => {
        const outcome = performRenderHearthsap(getState());
        setState(outcome.newState);
        if (outcome.leveledUp) narrate("level_up");
        render();
      }
    );
    reapplyPanelHighlight(refs.contextualPanel);
    return;
  }

  if (isNearGarden()) {
    if (lastActivePanelKind !== "garden") resetPanelHighlight();
    lastActivePanelKind = "garden";
    refs.contextualPanel.innerHTML = "";
    renderGardenPanel(
      state,
      refs.contextualPanel,
      () => { setState(performAdvanceGardenRoom(getState())); render(); },
      (slotIndex, plantId) => { setState(performPlantSeed(getState(), slotIndex, plantId)); render(); },
      (slotIndex) => { setState(performHarvestSlot(getState(), slotIndex)); render(); }
    );
    reapplyPanelHighlight(refs.contextualPanel);
    return;
  }

  if (isNearSmelter()) {
    if (lastActivePanelKind !== "smelter") resetPanelHighlight();
    lastActivePanelKind = "smelter";
    renderSmelterPanel(
      state,
      refs.contextualPanel,
      () => {
        const outcome = performSmelterBuild(getState());
        setState(outcome.newState);
        render();
      },
      (ingotMaterialId) => {
        const outcome = performPurify(getState(), ingotMaterialId);
        setState(outcome.newState);
        if (outcome.leveledUp) narrate("level_up");
        render();
      },
      () => {
        setState(performSmelterTierUpgrade(getState()));
        render();
      },
      () => {
        setState(performUnlockIronPurifying(getState()));
        render();
      },
      () => {
        setState(performIronSmelterTierUpgrade(getState()));
        render();
      },
      () => {
        setState(performSpendTrueMetalOnPerk(getState()));
        render();
      }
    );
    reapplyPanelHighlight(refs.contextualPanel);
    return;
  }

  if (isNearGemcutting()) {
    if (lastActivePanelKind !== "gemcutting") resetPanelHighlight();
    lastActivePanelKind = "gemcutting";
    renderGemcuttingPanel(
      state,
      refs.contextualPanel,
      () => {
        const outcome = performGemcuttingBuild(getState());
        setState(outcome.newState);
        render();
      },
      (roughMaterialId) => {
        const outcome = performCutGem(getState(), roughMaterialId);
        setState(outcome.newState);
        if (outcome.leveledUp) narrate("level_up");
        render();
      },
      () => {
        setState(performGemcuttingTierUpgrade(getState()));
        render();
      },
      () => {
        setState(performSpendCutGemOnPerk(getState()));
        render();
      }
    );
    reapplyPanelHighlight(refs.contextualPanel);
    return;
  }

  // Trade Hall panel — south passage and the sealed south room
  if (isNearTradeHall(position)) {
    if (lastActivePanelKind !== "trade") resetPanelHighlight();
    lastActivePanelKind = "trade";
    refs.contextualPanel.innerHTML = "";

    // Fire one-time narrator line when merchant is present for the first time
    const tradeStage = state.world.roomStates["trade_hall"] ?? "ruined";
    const merchantNow = tradeStage !== "ruined" && (Date.now() - state.world.lastMerchantAt) >= (tradeStage === "masterwork" ? 0 : tradeStage === "restored" ? 5*60*1000 : 10*60*1000);
    if (merchantNow && !state.narrator.firedOnceTriggers.includes("merchant_arrived")) {
      narrate("merchant_arrived");
    }

    renderTradeHallPanel(
      state,
      refs.contextualPanel,
      () => { setState(performAdvanceTradeHall(getState())); render(); },
      (offerId) => {
        const s = performTrade(getState(), offerId);
        setState(s);
        narrate("merchant_trade");
        render();
      }
    );
    reapplyPanelHighlight(refs.contextualPanel);
    return;
  }

  // Stockpile room panel — east wing. Shown when near the rubble face or chest.
  const stockpileStage = state.world.roomStates["stockpile_room"] ?? "ruined";
  if (isNearStockpile(position, stockpileStage)) {
    if (lastActivePanelKind !== "stockpile") resetPanelHighlight();
    lastActivePanelKind = "stockpile";
    refs.contextualPanel.innerHTML = "";
    renderStockpilePanel(
      state,
      refs.contextualPanel,
      () => {
        const s = getState();
        const currentStage = s.world.roomStates["stockpile_room"] ?? "ruined";
        const hasOre = Object.values(s.world.stockpileOre).some(v => (v as number) > 0);
        if (hasOre && currentStage !== "ruined") {
          setState(performCollectStockpile(s));
        } else {
          setState(performAdvanceStockpileRoom(s));
        }
        render();
      }
    );
    reapplyPanelHighlight(refs.contextualPanel);
    return;
  }

  // Deep Foundry — NW wing
  if (isNearDeepFoundry(position)) {
    if (lastActivePanelKind !== "foundry") resetPanelHighlight();
    lastActivePanelKind = "foundry";
    refs.contextualPanel.innerHTML = "";
    renderRoomPanel("deep_foundry", state, refs.contextualPanel, () => {
      setState(performAdvanceRoom(getState(), "deep_foundry")); render();
    });
    reapplyPanelHighlight(refs.contextualPanel);
    return;
  }

  // The Archive — north wing
  if (isNearArchive(position)) {
    if (lastActivePanelKind !== "archive") resetPanelHighlight();
    lastActivePanelKind = "archive";
    refs.contextualPanel.innerHTML = "";
    renderRoomPanel("the_archive", state, refs.contextualPanel, () => {
      setState(performAdvanceRoom(getState(), "the_archive")); render();
    });
    reapplyPanelHighlight(refs.contextualPanel);
    return;
  }

  // Drill panel — shown when near any ore vein (including those with no
  // drill yet, so the player can build one). Uses vein proximity from
  // the existing nearestOreVein() check rather than its own proximity fn.
  const nearVein = nearestOreVein();
  if (nearVein) {
    if (lastActivePanelKind !== "drill") {
      resetPanelHighlight();
      refs.contextualPanel.innerHTML = "";
    }
    lastActivePanelKind = "drill";
    refs.contextualPanel.innerHTML = "";
    renderDrillSection(
      state,
      nearVein.id,
      refs.contextualPanel,
      () => { setState(performBuildDrill(getState(), nearVein.id)); render(); },
      () => { setState(performRefuelDrill(getState(), nearVein.id)); render(); },
      () => { setState(performCollectDrillOre(getState(), nearVein.id)); render(); },
      () => { setState(performUpgradeDrill(getState(), nearVein.id)); render(); },
      () => { setState(performUpgradeDrillBuffer(getState(), nearVein.id)); render(); }
    );
    if (refs.contextualPanel.innerHTML) reapplyPanelHighlight(refs.contextualPanel);
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
        state.world.forgeTier,
        state.world.smelterBuilt,
        state.world.gemcuttingBuilt,
        state.world.companion.befriended,
        state.world.consoleAwakened,
        state.world.roomStates["stockpile_room"] ?? "ruined",
        state.world.roomStates["trade_hall"] ?? "ruined",
        state.world.roomStates["deep_foundry"] ?? "ruined",
        state.world.roomStates["the_archive"] ?? "ruined",
        Object.fromEntries(Object.entries(state.world.drills).map(([id, d]) => [id, d.tier])),
        state.world.placedTorches
      );
    },
    (col, row) => {
      const drillTiers = Object.fromEntries(Object.entries(state.world.drills).map(([id, d]) => [id, d.tier]));
      const cell = hubCellAt(
        col, row,
        state.world.litTorches,
        state.world.veinDepletion,
        state.world.woodDepletion,
        state.world.forgeTier,
        state.world.smelterBuilt,
        state.world.gemcuttingBuilt,
        state.world.companion.befriended,
        state.world.consoleAwakened,
        state.world.roomStates["stockpile_room"] ?? "ruined",
        state.world.roomStates["trade_hall"] ?? "ruined",
        state.world.roomStates["deep_foundry"] ?? "ruined",
        state.world.roomStates["the_archive"] ?? "ruined",
        drillTiers,
        state.world.placedTorches
      );
      const isSolid = (c: number, r: number) =>
        isSolidCellKind(
          hubCellAt(c, r,
            state.world.litTorches,
            state.world.veinDepletion,
            state.world.woodDepletion,
            state.world.forgeTier,
            state.world.smelterBuilt,
            state.world.gemcuttingBuilt,
            state.world.companion.befriended,
            state.world.consoleAwakened,
            state.world.roomStates["stockpile_room"] ?? "ruined",
            state.world.roomStates["trade_hall"] ?? "ruined",
            state.world.roomStates["deep_foundry"] ?? "ruined",
            state.world.roomStates["the_archive"] ?? "ruined",
            drillTiers,
            state.world.placedTorches
          ).kind
        );
      return cellVisibility(col, row, position, state.world, cellKey(col, row), DEFAULT_LIGHT_RADIUS, cell.kind, isSolid);
    },
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
