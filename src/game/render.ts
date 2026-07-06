import { GridRenderer, type Renderer } from "../render/GridRenderer";
import { TilesetRenderer } from "../render/TilesetRenderer";
import { hubCellAt } from "../render/hubContent";
import { isSolidCellKind } from "../render/palette";
import { cellVisibility, DEFAULT_LIGHT_RADIUS, zoneContaining } from "../engine/visibility";
import { cellKey, MATERIALS, getMaterialAmount } from "../engine/types";
import { xpIntoCurrentLevel, xpNeededForNextLevel } from "../engine/xpCurve";
import { bestAvailablePickaxe, ROCK_NODES } from "../engine/mining";
import { PICKAXE_ICONS, AXE_ICONS } from "../render/toolIconManifest";
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
  isNearSawmill,
  isNearTurbine,
  isNearSmelter,
  isNearGemcutting,
  isNearConsole,
  isNearGarden,
  isNearCompanion,
} from "./proximity";
import { renderSmithingPanel, performSmith, performForgeTool, performForgeUpgrade, renderForgeRepairPanel, performForgeRepair } from "../ui/smithingPanel";
import { canAffordSmithRecipe } from "../engine/smithing";
import { renderSmeltingEnginePanel, performBuildEngine, performCollectEngine, performUpgradeEngine } from "../ui/smeltingEnginePanel";
import {
  renderHearthPanel,
  performStoke,
  performHearthUpgrade,
  performSpendTrueMetalOnYield,
  performRekindle,
  STOKE_AMOUNT,
} from "../ui/hearthPanel";
import { nextHaulMaterial, secondsUntilNextHaul } from "../engine/hearth";
import { renderKilnPanel, performCharcoalBurn, performRenderHearthsap } from "../ui/kilnPanel";
import { canAffordCharcoalBurn } from "../engine/kiln";
import { renderSawmillPanel, performSawmillBuild, performSawPlanks } from "../ui/sawmillPanel";
import { renderTurbinePanel, performTurbineBuild } from "../ui/turbinePanel";
import { canAffordPlankSaw } from "../engine/sawmill";
import {
  renderSmelterPanel,
  performSmelterBuild,
  performPurify,
  performSmelterTierUpgrade,
  performUnlockIronPurifying,
  performIronSmelterTierUpgrade,
  performSpendTrueMetalOnPerk,
} from "../ui/smelterPanel";
import { canAffordPurify } from "../engine/smelter";
import {
  renderGemcuttingPanel,
  performGemcuttingBuild,
  performCutGem,
  performGemcuttingTierUpgrade,
  performSpendCutGemOnPerk,
} from "../ui/gemcuttingPanel";
import { canAffordCutGem } from "../engine/gemcutting";
import { renderDrillSection, performBuildDrill, performRefuelDrill, performCollectDrillOre, performUpgradeDrill, performUpgradeDrillBuffer } from "../ui/drillPanel";
import { renderConsolePanel, performAwakenConsole } from "../ui/consolePanel";
import { renderStockpilePanel, performAdvanceStockpileRoom, performCollectStockpile, isNearStockpile } from "../ui/stockpilePanel";
import { renderGardenPanel, performPlantSeed, performHarvestSlot, performUnlockPlanter } from "../ui/gardenPanel";
import { renderTradeHallPanel, performAdvanceTradeHall, performTrade, isNearTradeHall } from "../ui/tradeHallPanel";
import { renderRoomPanel, performAdvanceRoom, isNearDeepFoundry, isNearArchive } from "../ui/roomPanel";
import { renderMineshaftPanel, performMineshaftUpgrade, isNearMineshaft } from "../ui/mineshaftPanel";
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
    // Show the Production tab on the right panel once console is awakened
    const prodTabBtn = document.getElementById("production-tab-btn");
    if (prodTabBtn) prodTabBtn.style.display = "";
    // Update production panel content
    const prodPanel = document.getElementById("production-panel");
    if (prodPanel) {
      const s = getState();
      renderConsolePanel(s, prodPanel, () => {
        const wasAwakened = getState().world.consoleAwakened;
        setState(performAwakenConsole(getState()));
        if (!wasAwakened) narrate("console_awakened");
        render();
      });
    }
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

  refs.statEls.mining.textContent = `${skills.mining.level}`;
  refs.statEls.smithing.textContent = `${skills.smithing.level}`;
  refs.statEls.hearthkeeping.textContent = `${skills.hearthkeeping.level}`;
  refs.statEls.woodcraft.textContent = `${skills.woodcraft.level}`;
  refs.statEls.tinkering.textContent = `${skills.tinkering.level}`;

  (refs.statEls.barMining as HTMLDivElement).style.width = `${levelProgressPercent(skills.mining.xp)}%`;
  (refs.statEls.barSmithing as HTMLDivElement).style.width = `${levelProgressPercent(skills.smithing.xp)}%`;
  (refs.statEls.barHearthkeeping as HTMLDivElement).style.width = `${levelProgressPercent(skills.hearthkeeping.xp)}%`;
  (refs.statEls.barWoodcraft as HTMLDivElement).style.width = `${levelProgressPercent(skills.woodcraft.xp)}%`;
  (refs.statEls.barTinkering as HTMLDivElement).style.width = `${levelProgressPercent(skills.tinkering.xp)}%`;

  // Herblore and Brewing — shown once the player has actually used them
  const herbloreRow = document.getElementById("skill-herblore-row");
  const brewingRow = document.getElementById("skill-brewing-row");
  const herbloreEl = document.getElementById("stat-herblore");
  const herbloreBar = document.getElementById("bar-herblore");
  const brewingEl = document.getElementById("stat-brewing");
  const brewingBar = document.getElementById("bar-brewing");
  if (herbloreRow && skills.herblore && skills.herblore.xp > 0) {
    herbloreRow.style.display = "";
    if (herbloreEl) herbloreEl.textContent = `${skills.herblore.level}`;
    if (herbloreBar) (herbloreBar as HTMLDivElement).style.width = `${levelProgressPercent(skills.herblore.xp)}%`;
  }
  if (brewingRow && skills.brewing && skills.brewing.xp > 0) {
    brewingRow.style.display = "";
    if (brewingEl) brewingEl.textContent = `${skills.brewing.level}`;
    if (brewingBar) (brewingBar as HTMLDivElement).style.width = `${levelProgressPercent(skills.brewing.xp)}%`;
  }

  // Skills tab: basic text-row list vs. icon badge grid, gated by the
  // same colorStage threshold that switches the world to sprite art
  // (TILESET_MODE_MIN_COLOR_STAGE, defined below) - see skillsGridPanel.ts's
  // doc comment. Both trees stay in the DOM at all times; only display
  // toggles, same pattern as the herblore/brewing reveal above.
  const basicLabels: Record<string, string> = {
    mining: "Mining", smithing: "Smithing", hearthkeeping: "Hearthkeeping",
    woodcraft: "Woodcraft", tinkering: "Tinkering", herblore: "Herblore", brewing: "Brewing",
  };
  const basicLevels: Record<string, number> = {
    mining: skills.mining.level, smithing: skills.smithing.level, hearthkeeping: skills.hearthkeeping.level,
    woodcraft: skills.woodcraft.level, tinkering: skills.tinkering.level,
    herblore: skills.herblore?.level ?? 1, brewing: skills.brewing?.level ?? 1,
  };
  const basicXp: Record<string, number> = {
    mining: skills.mining.xp, smithing: skills.smithing.xp, hearthkeeping: skills.hearthkeeping.xp,
    woodcraft: skills.woodcraft.xp, tinkering: skills.tinkering.xp,
    herblore: skills.herblore?.xp ?? 0, brewing: skills.brewing?.xp ?? 0,
  };
  for (const id of Object.keys(basicLabels)) {
    const el = document.getElementById(`stat-${id}-basic`);
    const bar = document.getElementById(`bar-${id}-basic`);
    if (el) el.textContent = `${basicLabels[id]} ${basicLevels[id]}`;
    if (bar) (bar as HTMLDivElement).style.width = `${levelProgressPercent(basicXp[id])}%`;
    if (id === "herblore" || id === "brewing") {
      const rowBasic = document.getElementById(`skill-${id}-row-basic`);
      if (rowBasic && basicXp[id] > 0) rowBasic.style.display = "";
    }
  }

  const skillsAdvanced = world.hearth.colorStage >= TILESET_MODE_MIN_COLOR_STAGE;
  const basicList = document.getElementById("skills-basic-list");
  const iconGrid = document.getElementById("skills-icon-grid");
  if (basicList) basicList.style.display = skillsAdvanced ? "none" : "";
  if (iconGrid) iconGrid.style.display = skillsAdvanced ? "" : "none";

  // Tools - shows what's CURRENTLY equipped per slot (bestAvailablePickaxe/
  // bestAvailableAxe already pick the right ToolTier given the forged
  // tier), not the forging recipes themselves (those live in the
  // Smithing panel - see smithingPanel.ts). "Bare Hands" at tier 0 is
  // shown plainly, not hidden, since there's nothing to spoil here -
  // unlike Narag-Bund, knowing bare-handed mining exists isn't a
  // discovery moment worth gating.
  //
  // Same basic-text/icon dual mode as the skills grid (2026-07-03) -
  // gated on the same skillsAdvanced flag computed above, per the
  // Perception Is Progression principle noted in MECHANICS.md.
  const pickaxe = bestAvailablePickaxe(toolsForged.pickaxe);
  const axe = bestAvailableAxe(toolsForged.axe);

  const basicPickaxeEl = document.getElementById("tools-basic-pickaxe");
  const basicAxeEl = document.getElementById("tools-basic-axe");
  if (basicPickaxeEl) basicPickaxeEl.textContent = `Pickaxe: ${pickaxe.name}`;
  if (basicAxeEl) basicAxeEl.textContent = `Axe: ${axe.name}`;

  const iconPickaxeEl = document.getElementById("tools-icon-pickaxe") as HTMLImageElement | null;
  const iconAxeEl = document.getElementById("tools-icon-axe") as HTMLImageElement | null;
  const captionPickaxeEl = document.getElementById("tools-caption-pickaxe");
  const captionAxeEl = document.getElementById("tools-caption-axe");
  if (iconPickaxeEl) iconPickaxeEl.src = PICKAXE_ICONS[pickaxe.tier] ?? PICKAXE_ICONS[0];
  if (iconAxeEl) iconAxeEl.src = AXE_ICONS[axe.tier] ?? AXE_ICONS[0];
  if (captionPickaxeEl) captionPickaxeEl.textContent = pickaxe.name;
  if (captionAxeEl) captionAxeEl.textContent = axe.name;

  const toolsBasicList = document.getElementById("tools-basic-list");
  const toolsIconGrid = document.getElementById("tools-icon-grid");
  if (toolsBasicList) toolsBasicList.style.display = skillsAdvanced ? "none" : "";
  if (toolsIconGrid) toolsIconGrid.style.display = skillsAdvanced ? "" : "none";

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
      : "The console waits — select 'Awaken' from the menu.";
    return;
  }

  if (isNearHearth()) {
    const fuel = Math.floor(world.hearth.fuel);
    const reserve = (Object.values(world.fuelReserve) as (number | undefined)[]).reduce((s: number, v) => s + (v ?? 0), 0);
    refs.actionHint.textContent = world.hearthTier >= 1
      ? `Hearth — fuel ${fuel} · reserve ${reserve}`
      : `Hearth — ${fuel} fuel · press Enter to stoke`;
    return;
  }

  if (isNearKiln()) {
    refs.actionHint.textContent = "Kiln — press Enter to burn charcoal";
    return;
  }

  if (isNearGarden()) {
    const readySlots = world.gardenSlots.filter(s => s.unlocked && s.stage === 3).length;
    if (readySlots > 0) {
      refs.actionHint.textContent = `Garden — ${readySlots} slot${readySlots !== 1 ? "s" : ""} ready to harvest`;
    } else {
      refs.actionHint.textContent = "The garden waits";
    }
    return;
  }

  if (isNearForge() && !isForgeRepaired()) {
    refs.actionHint.textContent = "The forge lies cold — select 'Repair the Forge' from the menu.";
    return;
  }

  if (isNearForge() && isForgeRepaired()) {
    refs.actionHint.textContent = `Forge — tier ${world.forgeTier} · press Enter to smith`;
    return;
  }

  if (isNearSmelter() && world.smelterBuilt) {
    refs.actionHint.textContent = `Smelter — tier ${world.smelterTier} · press Enter to purify`;
    return;
  }

  if (isNearSawmill() && world.sawmillBuilt) {
    refs.actionHint.textContent = "Sawmill — press Enter to saw planks";
    return;
  }

  if (isNearTurbine()) {
    refs.actionHint.textContent = world.turbineBuilt
      ? "The Turbine — running"
      : "The Turbine — select 'Build the Turbine' from the menu";
    return;
  }

  if (isNearGemcutting() && world.gemcuttingBuilt) {
    refs.actionHint.textContent = "Gemcutting station — press Enter to cut gems";
    return;
  }

  const stockpileStage = world.roomStates["stockpile_room"] ?? "ruined";
  if (isNearStockpile(position, stockpileStage)) {
    if (stockpileStage === "ruined") {
      refs.actionHint.textContent = "Collapsed east wing — press Enter to clear the rubble";
    } else {
      const total = Object.values(world.stockpileOre).reduce((s, v) => s + (v ?? 0), 0);
      refs.actionHint.textContent = `Stockpile (${stockpileStage}) — ${total} ore stored`;
    }
    return;
  }

  if (isNearMineshaft(position)) {
    const shaftDepth = world.mineshaftDepth;
    refs.actionHint.textContent = shaftDepth === 0
      ? "Broken mine shaft — repair it to begin"
      : `Mine Shaft — depth ${shaftDepth}`;
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
    const rockNode = ROCK_NODES.find((n) => n.id === vein.rockNodeId);
    const miningLevel = getState().vessel.skills.mining.level;
    const reqLevel = rockNode?.requiredLevel ?? 1;
    if (miningLevel < reqLevel) {
      // Only show the level requirement once the player is within 5 levels
      // of unlocking it — don't spoil distant content
      if (reqLevel - miningLevel <= 5) {
        refs.actionHint.textContent = `${rockNode?.id.replace("_"," ") ?? vein.rockNodeId} — needs Mining level ${reqLevel}`;
      } else {
        refs.actionHint.textContent = "This vein is too dense to mine yet.";
      }
    } else {
      const drill = world.drills[vein.id];
      refs.actionHint.textContent = drill
        ? `F to mine · drill ${drill.coalBuffer > 0 ? "running" : "needs coal"}`
        : `F to strike the vein`;
    }
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

  // Check for nearby placed torches
  const nearbyPlacedTorch = (() => {
    const { position } = getState().vessel;
    const torches = world.placedTorches;
    for (const [key, isLit] of Object.entries(torches)) {
      const [tc, tr] = key.split(",").map(Number);
      if (Math.abs(tc - position.col) <= 1 && Math.abs(tr - position.row) <= 1) {
        return { key, isLit };
      }
    }
    return null;
  })();

  if (nearbyPlacedTorch) {
    refs.actionHint.textContent = nearbyPlacedTorch.isLit
      ? "E — remove torch (+1 Wood)"
      : "E — light torch (1 Copper Ingot)";
    return;
  }

  // Show torch placement hint only when adjacent to a wall and carrying materials
  const { inventory } = getState().vessel;
  if ((inventory["wood"] ?? 0) >= 1 && (inventory["coal"] ?? 0) >= 1) {
    const pos = getState().vessel.position;
    const s = getState();
    const w = s.world;
    const drillTiers = Object.fromEntries(Object.entries(w.drills).map(([id, d]) => [id, d.tier]));
    const adjacentWall = [
      { col: pos.col, row: pos.row - 1 },
      { col: pos.col, row: pos.row + 1 },
      { col: pos.col - 1, row: pos.row },
      { col: pos.col + 1, row: pos.row },
    ].some(c => {
      const cell = hubCellAt(c.col, c.row, w.litTorches, w.veinDepletion, w.woodDepletion,
        w.forgeTier, w.smelterBuilt, w.gemcuttingBuilt, w.companion.befriended,
        w.consoleAwakened, w.roomStates["stockpile_room"] ?? "ruined",
        w.roomStates["trade_hall"] ?? "ruined", w.roomStates["deep_foundry"] ?? "ruined",
        w.roomStates["the_archive"] ?? "ruined", drillTiers, w.placedTorches, w.mineshaftDepth, w.gardenSlots,
        w.sawmillBuilt, w.turbineBuilt);
      return cell.kind === "rock_wall" || cell.kind === "rubble";
    });
    if (adjacentWall) {
      refs.actionHint.textContent = "T — place torch on nearby wall";
    }
  }
}

/**
 * Tracks which panel was active on the PREVIOUS call, purely to detect
 * a switch (e.g. walked from the Forge to the Hearth) so the keyboard
 * highlight resets to row 0 rather than carrying over an index that
 * made sense for a different panel's row count. See panelNavigation.ts.
 */
let lastActivePanelKind: "console" | "companion" | "forge" | "hearth" | "kiln" | "smelter" | "sawmill" | "turbine" | "gemcutting" | "drill" | "stockpile" | "garden" | "trade" | "foundry" | "archive" | "mineshaft" | "none" = "none";

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

  // Narag-Bund companion panel — shown when near him once befriended
  if (isNearCompanion()) {
    if (lastActivePanelKind !== "companion") resetPanelHighlight();
    lastActivePanelKind = "companion";
    refs.contextualPanel.innerHTML = "";
    const world = state.world;
    const haulTarget = nextHaulMaterial(state.vessel.inventory);
    const haulLabel = haulTarget ? (MATERIALS[haulTarget]?.name ?? haulTarget) : null;
    const secsLeft = Math.ceil(secondsUntilNextHaul(world.companion.lastHaulAt, Date.now()));
    const haulStatus = haulLabel
      ? `Hauling ${haulLabel} to the reserve in ~${secsLeft}s`
      : "Nothing to haul — carry some fuel";
    const drillStatus = world.hearthTier >= 2
      ? `Hauling coal to drills (Hearth tier ${world.hearthTier})`
      : "Will haul coal to drills at Hearth tier 2";
    refs.contextualPanel.innerHTML = `
      <h2>Narag-Bund</h2>
      <p class="reserve-status">Coal-beetle. Black-head. He stays.</p>
      <p class="reserve-status" style="color:#c87820;">${haulStatus}</p>
      <p class="reserve-status">${drillStatus}</p>
      <p class="reserve-status" style="font-size:0.68em;opacity:0.55;">Haul interval: 10s · Next: ~${secsLeft}s</p>
    `;
    return;
  }

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

  if (isNearForge() && !isForgeRepaired()) {
    if (lastActivePanelKind !== "forge") resetPanelHighlight();
    lastActivePanelKind = "forge";
    renderForgeRepairPanel(state, refs.contextualPanel, () => {
      const before = getState();
      const after = performForgeRepair(before);
      if (after.world.forgeTier > before.world.forgeTier) {
        narrate("forge_repaired");
      }
      setState(after);
      render();
    });
    reapplyPanelHighlight(refs.contextualPanel);
    return;
  }

  if (isNearForge() && isForgeRepaired()) {
    if (lastActivePanelKind !== "forge") resetPanelHighlight();
    lastActivePanelKind = "forge";
    renderSmithingPanel(
      state,
      refs.contextualPanel,
      (recipe, times = 1) => {
        let s = getState();
        let leveledUp = false;
        for (let i = 0; i < times; i++) {
          if (!canAffordSmithRecipe(recipe, s.vessel.inventory)) break;
          const outcome = performSmith(s, recipe);
          s = outcome.newState;
          if (outcome.leveledUp) leveledUp = true;
        }
        setState(s);
        if (leveledUp) narrate("level_up");
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
    // Smelting engines appended below the smithing panel in the same forge context
    renderSmeltingEnginePanel(
      state,
      refs.contextualPanel,
      (id) => { setState(performBuildEngine(getState(), id)); render(); },
      (id) => { setState(performCollectEngine(getState(), id)); render(); },
      (id) => { setState(performUpgradeEngine(getState(), id)); render(); }
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
      (materialId, target, times = 1) => {
        let s = getState();
        let colorStageIncreased = false;
        let leveledUp = false;
        for (let i = 0; i < times; i++) {
          if (getMaterialAmount(s.vessel.inventory, materialId) < STOKE_AMOUNT) break;
          const outcome = performStoke(s, materialId, target);
          s = outcome.newState;
          if (outcome.colorStageIncreased) colorStageIncreased = true;
          if (outcome.leveledUp) leveledUp = true;
        }
        setState(s);
        if (colorStageIncreased) {
          const already = getState().narrator.firedOnceTriggers.includes("color_stage_1");
          narrate(already ? "color_stage_later" : "color_stage_1");
        }
        if (leveledUp) narrate("level_up");
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
      (times = 1) => {
        let s = getState();
        let leveledUp = false;
        for (let i = 0; i < times; i++) {
          if (!canAffordCharcoalBurn(s.vessel.inventory)) break;
          const outcome = performCharcoalBurn(s);
          s = outcome.newState;
          if (outcome.leveledUp) leveledUp = true;
        }
        setState(s);
        if (leveledUp) narrate("level_up");
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
      (slotIndex: number, plantId: string) => { setState(performPlantSeed(getState(), slotIndex, plantId)); render(); },
      (slotIndex: number) => { setState(performHarvestSlot(getState(), slotIndex)); render(); },
      (slotIndex: number) => { setState(performUnlockPlanter(getState(), slotIndex)); render(); }
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
      (ingotMaterialId, times = 1) => {
        let s = getState();
        let leveledUp = false;
        for (let i = 0; i < times; i++) {
          if (!canAffordPurify(s.vessel.inventory, ingotMaterialId)) break;
          const outcome = performPurify(s, ingotMaterialId);
          s = outcome.newState;
          if (outcome.leveledUp) leveledUp = true;
        }
        setState(s);
        if (leveledUp) narrate("level_up");
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

  if (isNearSawmill()) {
    if (lastActivePanelKind !== "sawmill") resetPanelHighlight();
    lastActivePanelKind = "sawmill";
    renderSawmillPanel(
      state,
      refs.contextualPanel,
      () => {
        setState(performSawmillBuild(getState()));
        render();
      },
      (times = 1) => {
        let s = getState();
        let leveledUp = false;
        for (let i = 0; i < times; i++) {
          if (!canAffordPlankSaw(s.vessel.inventory)) break;
          const outcome = performSawPlanks(s);
          s = outcome.newState;
          if (outcome.leveledUp) leveledUp = true;
        }
        setState(s);
        if (leveledUp) narrate("level_up");
        render();
      }
    );
    reapplyPanelHighlight(refs.contextualPanel);
    return;
  }

  if (isNearTurbine()) {
    if (lastActivePanelKind !== "turbine") resetPanelHighlight();
    lastActivePanelKind = "turbine";
    renderTurbinePanel(state, refs.contextualPanel, () => {
      setState(performTurbineBuild(getState()));
      render();
    });
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
      (roughMaterialId, times = 1) => {
        let s = getState();
        let leveledUp = false;
        for (let i = 0; i < times; i++) {
          if (!canAffordCutGem(roughMaterialId, s.vessel.skills.tinkering.level, s.vessel.inventory)) break;
          const outcome = performCutGem(s, roughMaterialId);
          s = outcome.newState;
          if (outcome.leveledUp) leveledUp = true;
        }
        setState(s);
        if (leveledUp) narrate("level_up");
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

  // Mine Shaft — north wall of mine room
  if (isNearMineshaft(position)) {
    if (lastActivePanelKind !== "mineshaft") resetPanelHighlight();
    lastActivePanelKind = "mineshaft";
    refs.contextualPanel.innerHTML = "";
    renderMineshaftPanel(state, refs.contextualPanel, () => {
      setState(performMineshaftUpgrade(getState()));
      render();
    });
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
        state.world.placedTorches,
        state.world.mineshaftDepth,
        state.world.gardenSlots,
        state.world.sawmillBuilt,
        state.world.turbineBuilt
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
        state.world.placedTorches,
        state.world.mineshaftDepth,
        state.world.gardenSlots,
        state.world.sawmillBuilt,
        state.world.turbineBuilt
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
            state.world.placedTorches,
            state.world.mineshaftDepth,
            state.world.gardenSlots,
            state.world.sawmillBuilt,
            state.world.turbineBuilt
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
