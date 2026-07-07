import { describe, it, expect } from "vitest";
import { renderSmeltingEnginePanel } from "../smeltingEnginePanel";
import { renderSmelterPanel } from "../smelterPanel";
import { renderTurbinePanel } from "../turbinePanel";
import type { GameState } from "../../engine/types";

/**
 * Reported directly: "I cant smelt ingots now :( i have the necesary
 * materials." Root cause: when the Smelter and Turbine panels were
 * folded into the Forge's combined contextual panel (alongside
 * Smithing and Smelting Engines, all in the SAME container now), both
 * still used `container.innerHTML = ...` internally - which they'd
 * always done, correctly, back when each had its own dedicated,
 * exclusively-owned container. Once multiple panels render into the
 * same container in sequence, `innerHTML=` on anything after the
 * first one destroys every DOM node written by whatever ran before it
 * (same bug class the Smelting Engine panel had back on 2026-07-05,
 * before it was fixed to append). Since Turbine always ran LAST in the
 * sequence, its innerHTML= wiped out Smithing, Smelting Engines, AND
 * the Smelter every single render - only the Turbine's own content
 * ever actually appeared in the DOM. Fixed both to
 * insertAdjacentHTML("beforeend", ...) instead.
 *
 * This test reproduces the real render.ts sequence directly: Smithing
 * placeholder -> Smelting Engines -> Smelter -> Turbine, all into one
 * shared container, then checks every panel's content survived.
 */
function makeForgeState(): GameState {
  return {
    world: {
      forgeTier: 3,
      smelterBuilt: true,
      smelterTier: 1,
      insightBanked: 10000,
      trueMetalSpentOnXpPerk: 0,
      ironPurifyingUnlocked: false,
      ironSmelterTier: 0,
      smeltingEngines: {},
      turbineBuilt: false,
      mineshaftDepth: 2,
      roomStates: {},
    },
    vessel: {
      inventory: { copper_ingot: 1000, iron_ingot: 1000, coal: 1000, deepstone_ingot: 100 },
    },
  } as unknown as GameState;
}

describe("Forge combined panel sequence (2026-07-07 regression - 'I cant smelt ingots now')", () => {
  it("Smithing, Smelting Engines, Smelter, and Turbine ALL survive in the same container after the full sequence", () => {
    const container = document.createElement("div");
    const state = makeForgeState();

    // Simulate render.ts's actual sequence in the Forge's combined block
    container.innerHTML = `<div data-recipe-id="copper_ingot">smithing row</div>`; // stand-in for renderSmithingPanel's own innerHTML=
    renderSmeltingEnginePanel(state, container, () => {}, () => {});
    renderSmelterPanel(state, container, () => {}, () => {}, () => {}, () => {}, () => {}, () => {});
    renderTurbinePanel(state, container, () => {});

    // All four should be present at once - previously only the LAST
    // one (Turbine) would have survived.
    expect(container.querySelector('[data-recipe-id="copper_ingot"]')).not.toBeNull();
    expect(container.textContent).toContain("Smelting Engines");
    expect(container.textContent).toContain("the smelter");
    expect(container.textContent).toContain("the turbine");
  });

  it("the Smelter's purify row is actually clickable after Turbine renders afterward (the exact reported symptom)", () => {
    const container = document.createElement("div");
    const state = makeForgeState();
    let purified = false;

    container.innerHTML = `<div>smithing placeholder</div>`;
    renderSmeltingEnginePanel(state, container, () => {}, () => {});
    renderSmelterPanel(state, container, () => {}, () => { purified = true; }, () => {}, () => {}, () => {}, () => {});
    renderTurbinePanel(state, container, () => {}); // runs AFTER Smelter - this is what broke it

    const purifyRow = container.querySelector<HTMLElement>('[data-action="purify"][data-ingot="copper_ingot"]');
    expect(purifyRow).not.toBeNull(); // would be null if Turbine's innerHTML= wiped the Smelter's rows
    purifyRow!.click();
    expect(purified).toBe(true);
  });
});
