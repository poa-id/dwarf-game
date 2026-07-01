/**
 * Production metrics — pure functions over WorldState that calculate
 * the mountain's current output rates. These are the numbers the Console
 * displays once awakened. No state mutation here.
 *
 * Cohesion note: everything converges on Insight. The Console makes this
 * visible — the player can watch Insight/min rise as they invest in
 * drills, upgrade the smelter, and add rekindling multipliers.
 */

import type { WorldState } from "./types";
import { DRILL_DEFINITIONS, drillTierDefinition } from "./drill";

// ---------------------------------------------------------------------------
// Ore production
// ---------------------------------------------------------------------------

export interface DrillMetrics {
  veinId: string;
  name: string;
  tierName: string;
  orePerMin: number;
  coalPerMin: number;
  isRunning: boolean;
  coalBuffer: number;
  oreBuffer: number;
}

export function getDrillMetrics(world: WorldState): DrillMetrics[] {
  const metrics: DrillMetrics[] = [];

  for (const def of DRILL_DEFINITIONS) {
    const drillState = world.drills[def.veinId];
    if (!drillState || drillState.tier === 0) continue;

    const tierDef = drillTierDefinition(def, drillState.tier);
    const cyclesPerMin = 60_000 / tierDef.cycleMs;
    const isRunning =
      drillState.coalBuffer >= def.coalPerCycle &&
      drillState.oreBuffer < 20; // DRILL_ORE_BUFFER_MAX

    metrics.push({
      veinId: def.veinId,
      name: def.name,
      tierName: tierDef.name,
      orePerMin: isRunning ? cyclesPerMin * tierDef.orePerCycle : 0,
      coalPerMin: isRunning ? cyclesPerMin * def.coalPerCycle : 0,
      isRunning,
      coalBuffer: drillState.coalBuffer,
      oreBuffer: drillState.oreBuffer,
    });
  }

  return metrics;
}

export function totalOrePerMin(world: WorldState): number {
  return getDrillMetrics(world).reduce((sum, d) => sum + d.orePerMin, 0);
}

// ---------------------------------------------------------------------------
// Hearth heat
// ---------------------------------------------------------------------------

export interface HearthMetrics {
  fuelReserveTotal: number;
  hearthFuel: number;
  isAutoTending: boolean;
  colorStage: number;
  lifetimeFuel: number;
}

export function getHearthMetrics(world: WorldState): HearthMetrics {
  const fuelReserveTotal = (Object.values(world.fuelReserve) as (number | undefined)[]).reduce(
    (sum: number, v) => sum + (v ?? 0),
    0
  );
  return {
    fuelReserveTotal,
    hearthFuel: world.hearth.fuel,
    isAutoTending: world.hearthTier >= 1,
    colorStage: world.hearth.colorStage,
    lifetimeFuel: world.hearth.lifetimeFuel,
  };
}

// ---------------------------------------------------------------------------
// Insight rate
// ---------------------------------------------------------------------------

/**
 * Estimated Insight per minute based on current drill output.
 * Each ore produced → smithed → grants XP → grants ~5% as Insight.
 * This is an estimate (smelting is manual + probabilistic), not exact.
 * Used for display only — not used in any engine calculation.
 */
export function estimatedInsightPerMin(world: WorldState): number {
  // Rough: 1 ore → ~10 XP when smelted (copper_ingot baseXp) → 0.5 Insight
  const oreMin = totalOrePerMin(world);
  const INSIGHT_PER_ORE_ESTIMATE = 0.5;
  return oreMin * INSIGHT_PER_ORE_ESTIMATE;
}

// ---------------------------------------------------------------------------
// Mountain restoration score
// ---------------------------------------------------------------------------

/**
 * A single number representing how restored the mountain is.
 * This is THE number — the idle game's "cookies per second" equivalent,
 * except it measures state (restoration) not rate (production).
 *
 * Ranges from 0 (dead ember) to a large number that grows as the
 * player repairs structures, upgrades systems, and rekindled more dwarves.
 *
 * Components (all additive, visible in the console breakdown):
 * - Hearth color stage × 1000
 * - Rekindlings × 500  
 * - Each repaired structure (forge, torches, smelter, gemcutting) × 200
 * - Each lit torch × 100
 * - Each drill built × 150 + tier × 50
 * - Smelter tier × 100
 * - Total insight ever earned (as a fraction)
 */
export interface RestorationBreakdown {
  total: number;
  hearthScore: number;
  rekindlingScore: number;
  structureScore: number;
  torchScore: number;
  drillScore: number;
  insightScore: number;
}

export function getRestorationScore(world: WorldState): RestorationBreakdown {
  const hearthScore = world.hearth.colorStage * 1000;

  const rekindlingScore = world.dwarfCount * 500;

  let structureScore = 0;
  if (world.forgeTier >= 1) structureScore += 200;
  if (world.forgeTier >= 2) structureScore += 200;
  if (world.forgeTier >= 3) structureScore += 200;
  if (world.smelterBuilt) structureScore += 200;
  if (world.gemcuttingBuilt) structureScore += 200;
  structureScore += world.smelterTier * 100;

  // Room restoration contributes per stage
  const stockpileStage = world.roomStates["stockpile_room"];
  if (stockpileStage === "cleared") structureScore += 300;
  else if (stockpileStage === "restored") structureScore += 700;
  else if (stockpileStage === "masterwork") structureScore += 1500;

  const torchScore = Object.values(world.litTorches).filter(Boolean).length * 100;

  let drillScore = 0;
  for (const [_veinId, drillState] of Object.entries(world.drills)) {
    if (drillState.tier > 0) {
      drillScore += 150 + drillState.tier * 50;
    }
  }

  // Insight contributes at a diminishing rate — it's a consequence of
  // restoration, not a direct measure of it
  const insightScore = Math.floor(Math.sqrt(world.insightBanked) * 10);

  const total =
    hearthScore +
    rekindlingScore +
    structureScore +
    torchScore +
    drillScore +
    insightScore;

  return {
    total,
    hearthScore,
    rekindlingScore,
    structureScore,
    torchScore,
    drillScore,
    insightScore,
  };
}
