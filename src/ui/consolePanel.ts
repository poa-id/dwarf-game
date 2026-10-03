/**
 * The Mountain Console panel — shown when the dwarf stands near the
 * ancient stone terminal in the northwest quadrant of the central hall.
 *
 * Two states:
 * 1. Unawakened — a single action: "Awaken the Console." One press,
 *    the terminal flickers to life, the narrator speaks, and the
 *    production metrics panel permanently exists from that moment on.
 *
 * 2. Awakened — the full production dashboard: ore rates, hearth
 *    status, restoration score, insight/min estimate. The mountain's
 *    memory made visible.
 *
 * Lore: operated by the spirit of past dwarves. The mountain itself
 * is the machine — dwarven lives are whispers it keeps. Activating
 * the console is activating the mountain's self-awareness.
 */

import type { GameState } from "../engine/types";
import {
  getDrillMetrics,
  getHearthMetrics,
  getRestorationScore,
  estimatedInsightPerMin,
  totalOrePerMin,
  forgeStageName,
  smelterStageName,
} from "../engine/production";
import { applyCompanionTraining, companionHaulTierDef, normalizeLogisticsPolicy, type LogisticsLane } from "../engine/companion";
import { stockpileCapacityPerMaterial } from "../engine/rooms";

export function renderConsolePanel(
  state: GameState,
  container: HTMLElement,
  onAwaken: () => void,
  onLogisticsChange?: (kind: "reserve" | "lane", key: string, delta: number) => void,
): void {
  container.innerHTML = "";

  if (!state.world.consoleAwakened) {
    // Unawakened state — minimal, mysterious
    container.innerHTML = `
      <h2>Ancient Terminal</h2>
      <p class="reserve-status" style="color: #7ab8d4;">The runes are cold. Something here remembers.</p>
      <div class="recipe-row" data-action="awaken">
        <div class="recipe-name">Awaken the Console</div>
        <div class="recipe-status">Press F — no cost. The mountain has been waiting.</div>
      </div>
    `;

    container.querySelector<HTMLDivElement>("[data-action='awaken']")?.addEventListener("click", onAwaken);
    return;
  }

  // Awakened — full production dashboard
  const drills = getDrillMetrics(state.world);
  const hearth = getHearthMetrics(state.world);
  const restoration = getRestorationScore(state.world);
  const oreMin = totalOrePerMin(state.world);
  const insightMin = estimatedInsightPerMin(state.world);
  const rekindleBonus = Math.round(state.world.rekindleMultiplier * 100);
  const haulTier = applyCompanionTraining(
    companionHaulTierDef(state.world.companion.tier),
    state.world.companion.trainingRank ?? 0,
  );
  const logisticsPerMin = haulTier.haulAmountPerTrip * (60_000 / haulTier.haulIntervalMs);
  const logisticsMode = state.world.companion.logisticsMode ?? "balanced";
  const logisticsPolicy = normalizeLogisticsPolicy(state.world.companion.logisticsPolicy);
  const laneWeightTotal = Object.values(logisticsPolicy.laneWeights).reduce((sum, value) => sum + value, 0) || 1;
  const laneLabels: Record<LogisticsLane, string> = {
    outputs: "Clear machine outputs",
    extractors: "Refuel drills & harvesters",
    processors: "Feed smelting processors",
    hearth: "Supply the Hearth",
  };

  const colorStageName = ["The Dark", "First Ember", "Hearthlight", "True Color"][hearth.colorStage] ?? "Unknown";

  // Drill status section
  const drillRows = drills.length === 0
    ? `<p class="reserve-status">No drills running.</p>`
    : drills.map(d => `
        <div class="recipe-row ${d.isRunning ? "" : "recipe-row-disabled"}">
          <div class="recipe-name">${d.name} — ${d.tierName}</div>
          <div class="recipe-status">${d.isRunning
            ? `${(d.orePerMin / 60).toFixed(2)} ore/s · output rank ${d.outputRank} · coal ${d.coalBuffer}/${d.coalBufferMax}`
            : `Stopped · ore ${d.oreBuffer}/${d.oreBufferMax} · coal ${d.coalBuffer}/${d.coalBufferMax}`
          }</div>
        </div>
      `).join("");

  // Restoration breakdown
  const restorationBreakdown = [
    hearth.colorStage > 0 ? `Hearth warmth: +${restoration.hearthScore}` : null,
    state.world.dwarfCount > 0 ? `${state.world.dwarfCount} rekindled lives: +${restoration.rekindlingScore}` : null,
    restoration.structureScore > 0 ? `Restored structures: +${restoration.structureScore}` : null,
    restoration.torchScore > 0 ? `Lit torches: +${restoration.torchScore}` : null,
    restoration.drillScore > 0 ? `Active drills: +${restoration.drillScore}` : null,
  ].filter(Boolean).join(" · ");

  container.innerHTML = `
    <h2>Mountain Console</h2>
    <p class="reserve-status" style="color: #7ab8d4; margin-bottom: 8px;">
      The mountain remembers. ${state.world.dwarfCount} dwarf${state.world.dwarfCount !== 1 ? "s" : ""} have worked this stone.
    </p>

    <div style="margin-bottom: 12px;">
      <div class="reserve-status"><strong>Restoration</strong></div>
      <div class="reserve-status" style="font-size: 1.4em; color: #e09a20;">${restoration.total.toLocaleString()}</div>
      ${restorationBreakdown ? `<div class="reserve-status" style="font-size: 0.8em; opacity: 0.7;">${restorationBreakdown}</div>` : ""}
    </div>

    <div style="margin-bottom: 12px;">
      <div class="reserve-status"><strong>Production</strong></div>
      <div class="reserve-status">${oreMin > 0 ? `${(oreMin / 60).toFixed(2)} ore/s` : "No idle production"} · ${insightMin > 0 ? `~${(insightMin / 60).toFixed(2)} insight/s` : "mine manually for insight"}</div>
      ${rekindleBonus > 0 ? `<div class="reserve-status" style="color: #8accd8;">Mountain memory: +${rekindleBonus}% yield (${state.world.dwarfCount} lives)</div>` : ""}
      ${state.world.companion.befriended ? `<div class="reserve-status" style="color: #c6a15b;">Narag-Bund logistics: ${(logisticsPerMin / 60).toFixed(2)} resources/s · harness rank ${state.world.companion.trainingRank ?? 0} · ${logisticsMode.replace("_", " ")}</div>` : ""}
    </div>

    ${state.world.companion.befriended ? `
      <div style="margin-bottom:12px;">
        <div class="reserve-status"><strong>Logistics Allocation</strong></div>
        <div class="reserve-status">Protected stock stays in storage. Unused route capacity automatically flows to routes that still need it.</div>
        <div class="recipe-row" data-logistics-kind="reserve" data-logistics-key="coal">
          <div class="recipe-name">Protected coal</div>
          <div class="recipe-status"><button class="batch-btn" data-delta="-5">−5</button> ${logisticsPolicy.reserveMinimums.coal ?? 0} kept in Stockpile <button class="batch-btn" data-delta="5">+5</button></div>
        </div>
        ${(Object.keys(laneLabels) as LogisticsLane[]).map((lane) => `
          <div class="recipe-row" data-logistics-kind="lane" data-logistics-key="${lane}">
            <div class="recipe-name">${laneLabels[lane]}</div>
            <div class="recipe-status"><button class="batch-btn" data-delta="-5">−5</button> ${Math.round(logisticsPolicy.laneWeights[lane] / laneWeightTotal * 100)}% share <button class="batch-btn" data-delta="5">+5</button></div>
          </div>`).join("")}
      </div>` : ""}

    <div style="margin-bottom: 12px;">
      <div class="reserve-status"><strong>Hearth</strong></div>
      <div class="reserve-status">${colorStageName} · Fuel: ${Math.floor(hearth.hearthFuel)} · Reserve: ${hearth.fuelReserveTotal} · ${hearth.isAutoTending ? "Auto-tending" : "Needs stoking"}</div>
      <div class="reserve-status">Lifetime fuel burned: ${hearth.lifetimeFuel.toLocaleString()}</div>
    </div>

    <div style="margin-bottom: 12px;">
      <div class="reserve-status"><strong>Structures</strong></div>
      <div class="reserve-status">Forge: ${forgeStageName(state.world.forgeTier)} · Smelter: ${smelterStageName(state.world.smelterBuilt, state.world.smelterTier)}${state.world.gemcuttingBuilt ? " · Gemcutting: Built" : ""}${state.world.sawmillBuilt ? " · Sawmill: Built" : ""}</div>
    </div>

    <div style="margin-bottom: 4px;">
      <div class="reserve-status"><strong>Drills</strong></div>
      ${drillRows}
    </div>

    ${(() => {
      const stockpileStage = state.world.roomStates["stockpile_room"] ?? "ruined";
      if (stockpileStage === "ruined") return "";
      const entries = Object.entries(state.world.stockpileOre).filter(([, v]) => v > 0);
      const capacity = stockpileCapacityPerMaterial(stockpileStage, state.world.stockpileExpansionRank ?? 0);
      const contents = entries.length > 0
        ? entries.map(([mat, amt]) => `${amt} ${mat.replace("_ore","").replace("_"," ")}`).join(", ")
        : "empty";
      return `
        <div style="margin-bottom: 4px;">
          <div class="reserve-status"><strong>Stockpile</strong> (${stockpileStage}) · ${capacity}/material · expansion rank ${state.world.stockpileExpansionRank ?? 0}</div>
          <div class="reserve-status">${contents}</div>
        </div>
      `;
    })()}

    ${(() => {
      const depth = state.world.mineshaftDepth;
      if (depth === 0) return "";
      const depthNames = ["", "Surface", "First Deep", "Second Deep"];
      const gardenActive = state.world.gardenSlots.filter(s => s.unlocked && s.plantId).length;
      const gardenReady = state.world.gardenSlots.filter(s => s.unlocked && s.stage === 3).length;
      const engineCount = Object.keys(state.world.smeltingEngines).length;
      const parts = [
        `Mine shaft: ${depthNames[depth] ?? `Depth ${depth}`}`,
        gardenActive > 0 ? `Garden: ${gardenActive} plant${gardenActive !== 1 ? "s" : ""} growing${gardenReady > 0 ? ` (${gardenReady} ready)` : ""}` : null,
        engineCount > 0 ? `Smelting engines: ${engineCount}` : null,
      ].filter(Boolean).join(" · ");
      return parts ? `<div class="reserve-status" style="opacity:0.75;">${parts}</div>` : "";
    })()}
  `;

  container.querySelectorAll<HTMLButtonElement>("[data-logistics-kind] .batch-btn").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      const row = button.closest<HTMLElement>("[data-logistics-kind]");
      if (!row) return;
      onLogisticsChange?.(row.dataset.logisticsKind as "reserve" | "lane", row.dataset.logisticsKey ?? "", Number(button.dataset.delta ?? 0));
    });
  });
}

export function performAwakenConsole(state: GameState): GameState {
  if (state.world.consoleAwakened) return state;
  return {
    ...state,
    world: { ...state.world, consoleAwakened: true },
  };
}

export function performAdjustLogisticsPolicy(
  state: GameState,
  kind: "reserve" | "lane",
  key: string,
  delta: number,
): GameState {
  const policy = normalizeLogisticsPolicy(state.world.companion.logisticsPolicy);
  if (kind === "reserve") {
    policy.reserveMinimums[key] = Math.max(0, Math.min(10_000, (policy.reserveMinimums[key] ?? 0) + delta));
  } else if (["outputs", "extractors", "processors", "hearth"].includes(key)) {
    const lane = key as LogisticsLane;
    policy.laneWeights[lane] = Math.max(0, Math.min(100, policy.laneWeights[lane] + delta));
    if (Object.values(policy.laneWeights).every((value) => value === 0)) policy.laneWeights[lane] = 5;
  }
  return {
    ...state,
    world: { ...state.world, companion: { ...state.world.companion, logisticsPolicy: policy } },
  };
}
