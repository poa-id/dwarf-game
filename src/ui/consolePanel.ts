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

export function renderConsolePanel(
  state: GameState,
  container: HTMLElement,
  onAwaken: () => void
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

  const colorStageName = ["The Dark", "First Ember", "Hearthlight", "True Color"][hearth.colorStage] ?? "Unknown";

  // Drill status section
  const drillRows = drills.length === 0
    ? `<p class="reserve-status">No drills running.</p>`
    : drills.map(d => `
        <div class="recipe-row ${d.isRunning ? "" : "recipe-row-disabled"}">
          <div class="recipe-name">${d.name} — ${d.tierName}</div>
          <div class="recipe-status">${d.isRunning
            ? `${d.orePerMin.toFixed(1)} ore/min · coal ${d.coalBuffer}/20`
            : `Stopped · ore ${d.oreBuffer}/20 · coal ${d.coalBuffer}/20`
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
      <div class="reserve-status">${oreMin > 0 ? `${oreMin.toFixed(1)} ore/min` : "No idle production"} · ${insightMin > 0 ? `~${insightMin.toFixed(1)} insight/min` : "mine manually for insight"}</div>
      ${rekindleBonus > 0 ? `<div class="reserve-status" style="color: #8accd8;">Mountain memory: +${rekindleBonus}% yield (${state.world.dwarfCount} lives)</div>` : ""}
    </div>

    <div style="margin-bottom: 12px;">
      <div class="reserve-status"><strong>Hearth</strong></div>
      <div class="reserve-status">${colorStageName} · Fuel: ${Math.floor(hearth.hearthFuel)} · Reserve: ${hearth.fuelReserveTotal} · ${hearth.isAutoTending ? "Auto-tending" : "Needs stoking"}</div>
      <div class="reserve-status">Lifetime fuel burned: ${hearth.lifetimeFuel.toLocaleString()}</div>
    </div>

    <div style="margin-bottom: 12px;">
      <div class="reserve-status"><strong>Structures</strong></div>
      <div class="reserve-status">Forge: ${forgeStageName(state.world.forgeTier)} · Smelter: ${smelterStageName(state.world.smelterBuilt, state.world.smelterTier)}${state.world.gemcuttingBuilt ? " · Gemcutting: Built" : ""}</div>
    </div>

    <div style="margin-bottom: 4px;">
      <div class="reserve-status"><strong>Drills</strong></div>
      ${drillRows}
    </div>

    ${(() => {
      const stockpileStage = state.world.roomStates["stockpile_room"] ?? "ruined";
      if (stockpileStage === "ruined") return "";
      const entries = Object.entries(state.world.stockpileOre).filter(([, v]) => v > 0);
      const contents = entries.length > 0
        ? entries.map(([mat, amt]) => `${amt} ${mat.replace("_ore","").replace("_"," ")}`).join(", ")
        : "empty";
      return `
        <div style="margin-bottom: 4px;">
          <div class="reserve-status"><strong>Stockpile</strong> (${stockpileStage})</div>
          <div class="reserve-status">${contents}</div>
        </div>
      `;
    })()}
  `;
}

export function performAwakenConsole(state: GameState): GameState {
  if (state.world.consoleAwakened) return state;
  return {
    ...state,
    world: { ...state.world, consoleAwakened: true },
  };
}
