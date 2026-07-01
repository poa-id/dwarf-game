/**
 * Offline summary — shown once on game load when significant time has
 * passed since the last save. Tells the player what happened while
 * they were away: what the drills produced, what the hearth burned.
 *
 * The mountain didn't stop while you were gone. It kept working.
 */

import type { WorldState } from "../engine/types";
import { DRILL_DEFINITIONS, drillTierDefinition, DRILL_ORE_BUFFER_MAX } from "../engine/drill";
import { MATERIALS } from "../engine/types";

const SIGNIFICANT_OFFLINE_MS = 5 * 60 * 1000; // 5 minutes

export interface OfflineSummary {
  elapsedMinutes: number;
  drillOreProduced: Array<{ oreName: string; amount: number }>;
  hearthFuelConsumed: number;
  totalOreProduced: number;
  isSignificant: boolean;
}

export function computeOfflineSummary(
  world: WorldState,
  elapsedMs: number
): OfflineSummary {
  const isSignificant = elapsedMs >= SIGNIFICANT_OFFLINE_MS;
  const elapsedMinutes = Math.round(elapsedMs / 60_000);

  const drillOreProduced: Array<{ oreName: string; amount: number }> = [];
  let totalOreProduced = 0;

  if (isSignificant) {
    for (const def of DRILL_DEFINITIONS) {
      const drillState = world.drills[def.veinId];
      if (!drillState || drillState.tier === 0) continue;

      const tierDef = drillTierDefinition(def, drillState.tier);
      const maxCycles = Math.floor(drillState.coalBuffer / def.coalPerCycle);
      const oreSpace = DRILL_ORE_BUFFER_MAX - drillState.oreBuffer;
      const maxBySpace = Math.floor(oreSpace / tierDef.orePerCycle);
      const timeCycles = Math.floor(elapsedMs / tierDef.cycleMs);
      const cyclesRun = Math.min(maxCycles, maxBySpace, timeCycles);
      const oreProduced = cyclesRun * tierDef.orePerCycle;

      if (oreProduced > 0) {
        const oreName = MATERIALS[def.oreMaterialId]?.name ?? def.oreMaterialId;
        drillOreProduced.push({ oreName, amount: oreProduced });
        totalOreProduced += oreProduced;
      }
    }
  }

  return {
    elapsedMinutes,
    drillOreProduced,
    hearthFuelConsumed: 0, // hearth.ts handles actual deduction; this is for display
    totalOreProduced,
    isSignificant,
  };
}

export function renderOfflineSummaryBanner(
  summary: OfflineSummary,
  container: HTMLElement
): void {
  if (!summary.isSignificant || summary.totalOreProduced === 0) return;

  const banner = document.createElement("div");
  banner.style.cssText = `
    background: rgba(90, 154, 184, 0.15);
    border: 1px solid #5a9ab8;
    border-radius: 4px;
    padding: 8px 12px;
    margin-bottom: 8px;
    font-size: 0.85em;
    color: #8accd8;
  `;

  const oreLines = summary.drillOreProduced
    .map(d => `${d.amount} ${d.oreName}`)
    .join(", ");

  banner.innerHTML = `
    <strong>While you were away (${summary.elapsedMinutes} min):</strong><br/>
    ${oreLines ? `Drills produced: ${oreLines}` : "Drills were idle or empty."}
  `;

  // Auto-dismiss after 12 seconds
  container.prepend(banner);
  setTimeout(() => banner.remove(), 12_000);
}
