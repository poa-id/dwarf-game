import { describe, it, expect } from "vitest";
import { renderSmeltingEnginePanel } from "../smeltingEnginePanel";
import type { GameState } from "../../engine/types";

/**
 * This is the exact bug reported 2026-07-05: "Smelting ingots is not
 * working. I have the materials and I can't smelt, clicking nor
 * pressing enter." Root cause was `container.innerHTML += x` in
 * renderSmeltingEnginePanel - equivalent to
 * `container.innerHTML = container.innerHTML + x`, which destroys
 * EVERY existing DOM node in the container (including whatever the
 * Smithing panel rendered into the same container just before this
 * runs - see render.ts's forge context) and rebuilds fresh nodes from
 * the re-serialized HTML string. The markup looks identical, so rows
 * still LOOK right, but the new nodes have no event listeners at all
 * (listeners are runtime JS bindings, not something that round-trips
 * through innerHTML serialization). This only manifested once a
 * Smelting Engine was actually unlocked (the function returns early
 * with no DOM writes at all before that), which is why it wasn't
 * caught earlier in a playthrough.
 *
 * This test doesn't invoke the full Smithing panel (would need a
 * complete GameState/SmithRecipe fixture) - it directly reproduces the
 * scenario that matters: SOME pre-existing row with a click listener
 * already in the container, then renderSmeltingEnginePanel runs on
 * that same container. If it still destroys the listener, this fails.
 */
function makeStateWithUnlockedCopperEngine(): GameState {
  return {
    world: {
      forgeTier: 1,
      smelterBuilt: true,
      ironPurifyingUnlocked: false,
      smelterTier: 0,
      roomStates: {},
      smeltingEngines: {},
    },
    vessel: {
      inventory: { copper_ingot: 100, iron_ingot: 100, wood: 100 },
    },
  } as unknown as GameState;
}

describe("renderSmeltingEnginePanel (2026-07-05 regression - innerHTML += destroyed prior listeners)", () => {
  it("does not destroy a pre-existing row's click listener in the same container", () => {
    const container = document.createElement("div");

    // Simulate what renderSmithingPanel would have already put in the
    // container before renderSmeltingEnginePanel runs (same container,
    // same forge context - see render.ts).
    container.innerHTML = `<div class="recipe-row" data-recipe-id="copper_ingot">existing smithing row</div>`;
    const existingRow = container.querySelector<HTMLElement>('[data-recipe-id="copper_ingot"]')!;
    let clicked = false;
    existingRow.addEventListener("click", () => { clicked = true; });

    const state = makeStateWithUnlockedCopperEngine();
    renderSmeltingEnginePanel(state, container, () => {}, () => {});

    // Re-query - if the node was destroyed and recreated, this finds a
    // DIFFERENT element that never had the listener attached, and the
    // click below would silently do nothing.
    const rowAfter = container.querySelector<HTMLElement>('[data-recipe-id="copper_ingot"]')!;
    expect(rowAfter).toBe(existingRow); // same node identity - proves it wasn't destroyed
    rowAfter.click();
    expect(clicked).toBe(true);
  });

  it("still actually renders the smelting engine section's own content", () => {
    const container = document.createElement("div");
    const state = makeStateWithUnlockedCopperEngine();
    renderSmeltingEnginePanel(state, container, () => {}, () => {});
    expect(container.textContent).toContain("Smelting Engines");
    expect(container.querySelector('[data-engine-build="copper_engine"]')).not.toBeNull();
  });

  it("the build row's own click listener works (sanity check on the fix's own new rows, not just pre-existing ones)", () => {
    const container = document.createElement("div");
    const state = makeStateWithUnlockedCopperEngine();
    let builtId: string | null = null;
    renderSmeltingEnginePanel(state, container, (id) => { builtId = id; }, () => {});

    const buildRow = container.querySelector<HTMLElement>('[data-engine-build="copper_engine"]')!;
    buildRow.click();
    expect(builtId).toBe("copper_engine");
  });
});
