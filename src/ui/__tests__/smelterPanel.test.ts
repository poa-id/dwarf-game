import { describe, it, expect, vi } from "vitest";
import { renderSmelterPanel } from "../smelterPanel";
import type { GameState } from "../../engine/types";

/**
 * Reported directly: "the batch options are not working in the
 * smelter." Root cause: the batch buttons (×5/×10/×50) were rendered
 * with a `data-batch-purify` attribute that nothing in the click
 * wiring ever queried for - the wiring only ever attached listeners to
 * `.recipe-row[data-action]` elements, and the batch buttons are
 * separate `<button class="batch-btn">` siblings, not recipe rows.
 * The buttons existed and looked normal, but firing zero clicks at
 * all was structurally guaranteed before this fix.
 */
function makeStateWithSmelter(): GameState {
  return {
    world: {
      smelterBuilt: true,
      smelterTier: 1,
      insightBanked: 0,
      trueMetalSpentOnXpPerk: 0,
      ironPurifyingUnlocked: false,
      ironSmelterTier: 0,
    },
    vessel: {
      inventory: { copper_ingot: 1000, coal: 1000 },
    },
  } as unknown as GameState;
}

describe("renderSmelterPanel batch buttons (regression - were never wired at all)", () => {
  it("clicking the ×5 batch button calls onPurify with times=5", () => {
    const container = document.createElement("div");
    const onPurify = vi.fn();

    renderSmelterPanel(
      makeStateWithSmelter(),
      container,
      () => {},
      onPurify,
      () => {},
      () => {},
      () => {},
      () => {}
    );

    const batchBtn = container.querySelector<HTMLButtonElement>(
      '.batch-btn[data-action="purify"][data-times="5"]'
    );
    expect(batchBtn).not.toBeNull();
    batchBtn!.click();

    expect(onPurify).toHaveBeenCalledWith("copper_ingot", 5);
  });

  it("clicking the ×50 batch button calls onPurify with times=50", () => {
    const container = document.createElement("div");
    const onPurify = vi.fn();

    renderSmelterPanel(
      makeStateWithSmelter(),
      container,
      () => {},
      onPurify,
      () => {},
      () => {},
      () => {},
      () => {}
    );

    const batchBtn = container.querySelector<HTMLButtonElement>(
      '.batch-btn[data-action="purify"][data-times="50"]'
    );
    expect(batchBtn).not.toBeNull();
    batchBtn!.click();

    expect(onPurify).toHaveBeenCalledWith("copper_ingot", 50);
  });

  it("clicking a batch button does not also fire the single-purify row's click handler (no double-fire)", () => {
    const container = document.createElement("div");
    const onPurify = vi.fn();

    renderSmelterPanel(
      makeStateWithSmelter(),
      container,
      () => {},
      onPurify,
      () => {},
      () => {},
      () => {},
      () => {}
    );

    const batchBtn = container.querySelector<HTMLButtonElement>(
      '.batch-btn[data-action="purify"][data-times="10"]'
    );
    batchBtn!.click();

    // Should be called exactly once (the batch handler), not twice
    // (once for the batch button, once more if the click bubbled up
    // to a parent .recipe-row[data-action="purify"] listener too).
    expect(onPurify).toHaveBeenCalledTimes(1);
  });
});
