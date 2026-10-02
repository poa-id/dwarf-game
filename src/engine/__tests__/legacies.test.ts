import { describe, expect, it } from "vitest";
import { buyLegacy, legacyCost, legacyHearthEfficiency, legacyXpBonus, legacyYieldBonus } from "../legacies";
import { createInitialGameState } from "../rekindle";

describe("Legacies", () => {
  it("spends Remembrance and makes each branch mechanically real", () => {
    let state = createInitialGameState(0);
    state = { ...state, world: { ...state.world, remembranceBanked: 10 } };
    state = buyLegacy(state, "inherited_hands");
    state = buyLegacy(state, "hearthline");
    state = buyLegacy(state, "deep_memory");
    expect(state.world.remembranceBanked).toBe(7);
    expect(legacyYieldBonus(state.world)).toBe(0.05);
    expect(legacyHearthEfficiency(state.world)).toBe(1.1);
    expect(legacyXpBonus(state.world)).toBe(0.05);
    expect(state.world.rekindleMultiplier).toBe(0.05);
  });

  it("raises costs with rank and refuses unaffordable memories", () => {
    let state = createInitialGameState(0);
    state = { ...state, world: { ...state.world, remembranceBanked: 1 } };
    state = buyLegacy(state, "hearthline");
    expect(legacyCost(state.world, "hearthline")).toBe(2);
    expect(buyLegacy(state, "hearthline")).toBe(state);
  });
});
