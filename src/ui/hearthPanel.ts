import {
  HEARTH_FUEL_MATERIALS,
  stokeFireDirectly,
  stokeReserve,
  nextHearthUpgrade,
  canAffordHearthUpgrade,
  isAutoTendingUnlocked,
  reserveBurnSecondsRemaining,
  HEARTHKEEPING_XP_PER_FUEL_VALUE,
  nextYieldPerkTier,
  trueMetalNeededForNextYieldPerkTier,
} from "../engine/hearth";
import { rekindle, REKINDLE_FUEL_THRESHOLD } from "../engine/rekindle";
import type { RekindleResult } from "../engine/rekindle";
import { getMaterialAmount, MATERIALS } from "../engine/types";
import type { GameState, MaterialId } from "../engine/types";
import { xpPerkBonus } from "../engine/smelter";
import { applyDwarfCountXpMultiplier, levelForXp } from "../engine/xpCurve";

const STOKE_AMOUNT = 1; // fixed burst size for now - see DESIGN.md's x1/x5/x10/MAX open item for the eventual bulk-action upgrade

// Visual reference point for the burn gauge's "full bar" - NOT a real
// cap on the reserve itself (the reserve is uncapped, see hearth.ts).
// 60 seconds of sustained auto-burn reads as "well-stocked" at a
// glance; beyond that the bar simply shows full rather than needing an
// ever-larger denominator. The actual seconds number is also shown as
// text alongside the bar, so precision isn't lost above the visual cap.
const GAUGE_FULL_AT_SECONDS = 60;

// The rekindle option appears in this panel the moment lifetimeFuel
// crosses the Stage 1 threshold (REKINDLE_FUEL_THRESHOLD, imported from
// rekindle.ts) - the same threshold that triggers the color_stage_1
// narrator line and the world's first color (see colorStages.ts's
// comment: "crossing it IS the rekindling event"). Deliberately NOT a
// separate/new threshold - reaching Stage 1 already IS "the dwarf could
// rekindle now," narratively. Per project owner's explicit direction
// (2026-06-22): this must stay completely silent beforehand - no
// counter, no narrator foreshadowing, no visible progress toward it
// anywhere in the UI. The option simply exists, or doesn't, the next
// time this panel renders.

// A brief, purely-visual "the fire just got fed" flash - module-level
// because renderHearthPanel rebuilds its container's innerHTML on every
// call (including the one triggered immediately after a stoke), so a
// CSS class applied directly to a clicked element would be wiped out
// before the player ever saw it. This flag survives that re-render;
// triggerStokeFlash() sets it and schedules its own clearing.
let stokeFlashActive = false;
function triggerStokeFlash(): void {
  stokeFlashActive = true;
  setTimeout(() => {
    stokeFlashActive = false;
  }, 500);
}

export type StokeTarget = "fire" | "reserve";

export function renderHearthPanel(
  state: GameState,
  container: HTMLElement,
  onStoke: (materialId: MaterialId, target: StokeTarget) => void,
  onUpgrade: () => void,
  onSpendTrueMetalOnYield: () => void,
  onRekindle: () => void
): void {
  // Only render a fuel row for materials the player actually holds -
  // per explicit project direction (2026-06-23, playtesting feedback:
  // "show what interacts with what the player has, not all options").
  // Previously every HEARTH_FUEL_MATERIALS entry always rendered both
  // rows (Feed/Bank), regardless of holdings - with 3 fuel types that
  // was 6 rows of mostly "Have: 0" clutter. Held materials are sorted
  // by heatValue descending so the best fuel the player has leads.
  const heldFuels = HEARTH_FUEL_MATERIALS.filter(
    (materialId) => getMaterialAmount(state.vessel.inventory, materialId) > 0
  ).sort((a, b) => (MATERIALS[b]?.heatValue ?? 0) - (MATERIALS[a]?.heatValue ?? 0));

  const fuelRows =
    heldFuels.length === 0
      ? `<p class="inventory-empty">No fuel carried yet.</p>`
      : heldFuels
          .map((materialId) => {
            const held = getMaterialAmount(state.vessel.inventory, materialId);
            const label = MATERIALS[materialId]?.name ?? materialId;
            // Currently unreachable in practice (heldFuels already
            // filters to held>0, and STOKE_AMOUNT is 1) - kept as a
            // safeguard for whenever STOKE_AMOUNT becomes a real
            // multi-unit bulk action (see its own comment above).
            const canStoke = held >= STOKE_AMOUNT;
            const disabledClass = canStoke ? "" : "recipe-row-disabled";
            return `
              <div class="recipe-row ${disabledClass}" data-stoke-material="${materialId}" data-stoke-target="fire">
                <div class="recipe-name">Feed the fire: ${label}</div>
                <div class="recipe-status">Have: ${held}</div>
              </div>
              <div class="recipe-row ${disabledClass}" data-stoke-material="${materialId}" data-stoke-target="reserve">
                <div class="recipe-name">Bank in reserve: ${label}</div>
                <div class="recipe-status">Have: ${held}</div>
              </div>
            `;
          })
          .join("");

  const reserveEntries = Object.entries(state.world.fuelReserve).filter(([, amt]) => (amt ?? 0) > 0);
  const reserveText =
    reserveEntries.length === 0
      ? "Empty."
      : reserveEntries
          .map(([id, amt]) => `${MATERIALS[id]?.name ?? id}: ${amt}`)
          .join(", ");

  // The burn gauge - a REAL, persisted reading of how many seconds the
  // reserve can sustain auto-burn at the current rate
  // (reserveBurnSecondsRemaining), not a cosmetic animation. Only shown
  // once auto-tending is actually running (hearthTier >= 1) - before
  // that, tickHearth never consumes the reserve at all, so a gauge here
  // would just be a static, meaningless number stuck at "full."
  const autoTendingOn = isAutoTendingUnlocked(state.world.hearthTier);
  const burnSeconds = reserveBurnSecondsRemaining(state.world.fuelReserve);
  const gaugePercent = Math.min(100, (burnSeconds / GAUGE_FULL_AT_SECONDS) * 100);
  const burnGauge = autoTendingOn
    ? `
      <div class="burn-gauge-row">
        <div class="burn-gauge-label">Burning (auto)</div>
        <div class="burn-gauge-track">
          <div class="burn-gauge-fill" style="width: ${gaugePercent}%"></div>
        </div>
        <div class="burn-gauge-seconds">~${Math.round(burnSeconds)}s left</div>
      </div>
    `
    : "";

  // Discovery gating: an upgrade the player can't yet afford doesn't
  // render AT ALL - no header, no disabled row, no hint of its name or
  // existence. This is deliberate (2026-06-22) - Friend of Burden's
  // description names Narag-Bund outright, so showing it pre-emptively
  // as a grayed-out row would spoil a companion the player hasn't met.
  // Reaching the Insight cost IS the discovery moment; before that,
  // there is simply nothing here to see. See hearth.ts's comment on
  // HEARTH_UPGRADES tier 1 for the cost rationale.
  const upgrade = nextHearthUpgrade(state.world.hearthTier);
  const affordableUpgrade =
    upgrade && canAffordHearthUpgrade(state.world.insightBanked, state.world.hearthTier) ? upgrade : null;

  const upgradeSection = affordableUpgrade
    ? `
      <h2>upgrade</h2>
      <div class="recipe-row" data-hearth-upgrade="true">
        <div class="recipe-name">${affordableUpgrade.name}</div>
        <div class="recipe-status">${affordableUpgrade.description} (${affordableUpgrade.insightCost} Insight)</div>
      </div>
    `
    : "";

  // The Hearth's global yield perk (added 2026-06-23) - the genuine
  // counterpart to the Smelter's XP perk tree. Same discovery-gating
  // principle: only renders once the player actually holds enough
  // True-metal to afford the next tier, never as a permanently visible
  // disabled row. Mirrors smelterPanel.ts's perk-section markup
  // exactly - SEPARATE running total (trueMetalSpentOnYieldPerk) from
  // the Smelter's own (trueMetalSpentOnXpPerk), even though both
  // spend the same True-metal currency.
  const nextYieldTier = nextYieldPerkTier(state.world.trueMetalSpentOnYieldPerk);
  const trueMetalNeededForYield = trueMetalNeededForNextYieldPerkTier(state.world.trueMetalSpentOnYieldPerk);
  const heldTrueMetalTotal = Object.keys(MATERIALS)
    .filter((id) => MATERIALS[id]?.category === "true_metal")
    .reduce((sum, id) => sum + getMaterialAmount(state.vessel.inventory, id), 0);

  const yieldPerkSection =
    nextYieldTier && trueMetalNeededForYield !== null && heldTrueMetalTotal >= trueMetalNeededForYield
      ? `
        <h2>the hearth provides</h2>
        <div class="recipe-row" data-action="spend-true-metal-yield">
          <div class="recipe-name">Tier ${nextYieldTier.tier}: +${Math.round(nextYieldTier.yieldBonus * 100)}% all yield, permanently</div>
          <div class="recipe-status">Spend ${trueMetalNeededForYield} True-metal</div>
        </div>
      `
      : "";

  // The rekindle option - see REKINDLE_FUEL_THRESHOLD's comment above
  // for why this checks lifetimeFuel directly rather than a separate
  // flag, and why it must give no warning beforehand. No status text,
  // no cost shown, no countdown - it simply isn't here until it is.
  const canRekindle = state.world.hearth.lifetimeFuel >= REKINDLE_FUEL_THRESHOLD;
  const rekindleSection = canRekindle
    ? `
      <div class="recipe-row rekindle-row" data-rekindle="true">
        <div class="recipe-name">Rekindle</div>
        <div class="recipe-status">Give yourself to the flame. The mountain remembers what you leave behind.</div>
      </div>
    `
    : "";

  container.innerHTML = `
    <h2>the hearth</h2>
    ${fuelRows}
    <p class="reserve-status">Reserve: ${reserveText}</p>
    ${burnGauge}
    <div class="stoke-flash ${stokeFlashActive ? "stoke-flash-active" : ""}" id="stoke-flash"></div>
    ${upgradeSection}
    ${yieldPerkSection}
    ${rekindleSection}
  `;

  container.querySelectorAll<HTMLDivElement>("[data-stoke-material]").forEach((row) => {
    row.addEventListener("click", () => {
      if (row.classList.contains("recipe-row-disabled")) return;
      const materialId = row.dataset.stokeMaterial as MaterialId;
      const target = row.dataset.stokeTarget as StokeTarget;
      // Direct "feed the fire" stokes are consumed instantly by the
      // engine with no other visible trace - the flash IS the feedback.
      // Reserve-banking doesn't need this, it already shows up
      // immediately in the burn gauge above.
      if (target === "fire") triggerStokeFlash();
      onStoke(materialId, target);
    });
  });

  // The upgrade row, when present, is always affordable now (see
  // upgradeSection above) - no disabled-class check needed here.
  const upgradeEl = container.querySelector<HTMLDivElement>("[data-hearth-upgrade]");
  upgradeEl?.addEventListener("click", onUpgrade);

  // Same "always affordable when rendered at all" discovery-gating
  // principle as the upgrade row above.
  const yieldPerkEl = container.querySelector<HTMLDivElement>('[data-action="spend-true-metal-yield"]');
  yieldPerkEl?.addEventListener("click", onSpendTrueMetalOnYield);

  // Rekindling is permanent and irreversible (the current dwarf is
  // gone, his skills and inventory with him) - a confirm dialog is
  // mandatory here, mirroring main.ts's existing reset-save pattern.
  const rekindleEl = container.querySelector<HTMLDivElement>("[data-rekindle]");
  rekindleEl?.addEventListener("click", () => {
    const confirmed = window.confirm(
      "Rekindle now? This dwarf's skills and everything he carries will be gone. What he built into the mountain - the forge, the hearth, the kiln, every torch - remains. There is no undoing this."
    );
    if (!confirmed) return;
    onRekindle();
  });
}

export interface StokeOutcome {
  newState: GameState;
  fuelAdded: number;
  colorStageIncreased: boolean;
  leveledUp: boolean;
}

export function performStoke(state: GameState, materialId: MaterialId, target: StokeTarget): StokeOutcome {
  if (target === "fire") {
    const hasRekindledOnce = state.world.dwarfCount > 0;
    const result = stokeFireDirectly(
      state.world.hearth,
      state.vessel.inventory,
      materialId,
      STOKE_AMOUNT,
      Date.now(),
      hasRekindledOnce
    );

    // Direct stoking grants Hearthkeeping XP immediately, scaled by the
    // same per-fuel-value rate as the Hearth's passive tick (see
    // loop.ts's HEARTHKEEPING_XP_PER_FUEL_VALUE) - this path burns
    // instantly, so there's no "wait for it to be consumed" delay the
    // way banking-to-reserve has. Per explicit project direction
    // (2026-06-23): banking alone grants nothing; XP comes from the
    // fuel actually being burned, immediate or passive.
    const rawXp = result.fuelAdded * HEARTHKEEPING_XP_PER_FUEL_VALUE;
    const multipliedXp = applyDwarfCountXpMultiplier(rawXp, state.world.dwarfCount, xpPerkBonus(state.world.trueMetalSpentOnXpPerk));
    const oldLevel = state.vessel.skills.hearthkeeping.level;
    const newHearthkeepingXp = state.vessel.skills.hearthkeeping.xp + multipliedXp;
    const newHearthkeeping = {
      ...state.vessel.skills.hearthkeeping,
      level: levelForXp(newHearthkeepingXp),
      xp: newHearthkeepingXp,
    };

    const newState: GameState = {
      ...state,
      world: { ...state.world, hearth: result.hearth },
      vessel: {
        ...state.vessel,
        inventory: result.inventory,
        skills: { ...state.vessel.skills, hearthkeeping: newHearthkeeping },
      },
    };
    return {
      newState,
      fuelAdded: result.fuelAdded,
      colorStageIncreased: result.colorStageIncreased,
      leveledUp: newHearthkeeping.level > oldLevel,
    };
  }

  // Banking to the reserve grants NO XP here - by explicit design, XP
  // comes from fuel actually being burned. This path only stockpiles;
  // the XP is granted later, in loop.ts's gameTick, at the moment
  // tickHearth actually consumes this banked fuel passively.
  const result = stokeReserve(state.vessel.inventory, state.world.fuelReserve, materialId, STOKE_AMOUNT);
  const newState: GameState = {
    ...state,
    world: { ...state.world, fuelReserve: result.fuelReserve },
    vessel: { ...state.vessel, inventory: result.inventory },
  };
  return { newState, fuelAdded: 0, colorStageIncreased: false, leveledUp: false };
}

export function performHearthUpgrade(state: GameState): GameState {
  const upgrade = nextHearthUpgrade(state.world.hearthTier);
  if (!upgrade) return state;
  if (!canAffordHearthUpgrade(state.world.insightBanked, state.world.hearthTier)) return state;

  return {
    ...state,
    world: {
      ...state.world,
      hearthTier: upgrade.tier,
      insightBanked: state.world.insightBanked - upgrade.insightCost,
      // Tier 1 specifically is the moment Narag-Bund is befriended -
      // every tier beyond that is a further Hearth upgrade, not a new
      // companion, so this only flips true once and stays true.
      companion:
        upgrade.tier === 1
          ? { ...state.world.companion, befriended: true }
          : state.world.companion,
    },
  };
}

/**
 * Panel-layer wrapper around the engine's rekindle() - guards against
 * calling it below the threshold (defensive; the UI shouldn't offer
 * the option below threshold in the first place, same invariant
 * pattern as the rest of the engine) and hands back the full
 * RekindleResult so the caller (render.ts) can decide which narrator
 * trigger to fire.
 */
export function performRekindle(state: GameState): RekindleResult | null {
  if (state.world.hearth.lifetimeFuel < REKINDLE_FUEL_THRESHOLD) return null;
  return rekindle(state);
}

/**
 * Spends True-metal toward the Hearth's yield-perk tree's next tier.
 * Mirrors smelterPanel.ts's performSpendTrueMetalOnPerk exactly, but
 * updates the SEPARATE trueMetalSpentOnYieldPerk running total
 * instead of the Smelter's trueMetalSpentOnXpPerk - the two trees
 * track independently even though both draw from the same True-metal
 * materials in inventory.
 */
export function performSpendTrueMetalOnYield(state: GameState): GameState {
  const needed = trueMetalNeededForNextYieldPerkTier(state.world.trueMetalSpentOnYieldPerk);
  if (needed === null || needed <= 0) return state;

  const trueMetalIds = Object.keys(MATERIALS).filter((id) => MATERIALS[id]?.category === "true_metal");
  let remaining = needed;
  let newInventory = { ...state.vessel.inventory };

  for (const id of trueMetalIds) {
    if (remaining <= 0) break;
    const held = getMaterialAmount(newInventory, id);
    const spend = Math.min(held, remaining);
    if (spend > 0) {
      newInventory = { ...newInventory, [id]: held - spend };
      remaining -= spend;
    }
  }

  if (remaining > 0) return state;

  return {
    ...state,
    world: { ...state.world, trueMetalSpentOnYieldPerk: state.world.trueMetalSpentOnYieldPerk + needed },
    vessel: { ...state.vessel, inventory: newInventory },
  };
}
