import { describe, it, expect, beforeEach } from "vitest";
import { saveGame, loadGame, clearSave, CURRENT_SAVE_VERSION } from "../saveGame";
import { createInitialGameState } from "../../engine/rekindle";

// vitest's default environment may not have a real localStorage - if
// this fails to run, check vite.config / vitest config for
// environment: "jsdom" or similar. These tests assume it's available.

beforeEach(() => {
  localStorage.clear();
});

describe("saveGame / loadGame round trip", () => {
  it("loading with no prior save returns a fresh state", () => {
    const result = loadGame(1000);
    expect(result.isFreshState).toBe(true);
    expect(result.discardedIncompatibleSave).toBe(false);
    expect(result.state.saveVersion).toBe(CURRENT_SAVE_VERSION);
  });

  it("a saved state round-trips correctly through save then load", () => {
    const original = createInitialGameState(1000);
    const modified = {
      ...original,
      vessel: {
        ...original.vessel,
        skills: {
          ...original.vessel.skills,
          mining: { id: "mining" as const, level: 15, xp: 12345 },
        },
        inventory: { copper_ore: 7, coal: 3 },
      },
    };

    saveGame(modified);
    const result = loadGame(2000);

    expect(result.isFreshState).toBe(false);
    expect(result.state.vessel.skills.mining.level).toBe(15);
    expect(result.state.vessel.skills.mining.xp).toBe(12345);
    expect(result.state.vessel.inventory.copper_ore).toBe(7);
    expect(result.state.vessel.inventory.coal).toBe(3);
  });

  it("preserves World state across the round trip, including nested records", () => {
    const original = createInitialGameState(1000);
    const modified = {
      ...original,
      world: {
        ...original.world,
        forgeTier: 2,
        litTorches: { torch_corridor_forge: true as const },
        exploredCells: { "10,10": true as const, "11,10": true as const },
        veinDepletion: { hearth_hall_copper: { totalYielded: 25 } },
      },
    };

    saveGame(modified);
    const result = loadGame(2000);

    expect(result.state.world.forgeTier).toBe(2);
    expect(result.state.world.litTorches).toEqual({ torch_corridor_forge: true });
    expect(result.state.world.exploredCells).toEqual({ "10,10": true, "11,10": true });
    expect(result.state.world.veinDepletion).toEqual({ hearth_hall_copper: { totalYielded: 25 } });
  });
});

describe("loadGame - corruption handling", () => {
  it("discards and returns fresh state if localStorage contains invalid JSON", () => {
    localStorage.setItem("dwarf-game-save", "{not valid json at all");
    const result = loadGame(1000);
    expect(result.isFreshState).toBe(true);
    expect(result.discardedIncompatibleSave).toBe(true);
  });

  it("discards and returns fresh state if the JSON is valid but doesn't look like a GameState", () => {
    localStorage.setItem("dwarf-game-save", JSON.stringify({ foo: "bar", not: "a save" }));
    const result = loadGame(1000);
    expect(result.isFreshState).toBe(true);
    expect(result.discardedIncompatibleSave).toBe(true);
  });

  it("discards if saveVersion is missing entirely", () => {
    const original = createInitialGameState(1000);
    const { saveVersion, ...withoutVersion } = original;
    localStorage.setItem("dwarf-game-save", JSON.stringify(withoutVersion));
    const result = loadGame(1000);
    expect(result.discardedIncompatibleSave).toBe(true);
  });
});

describe("loadGame - backfilling additive fields from older saves", () => {
  it("backfills a missing woodDepletion field without discarding the save", () => {
    const original = createInitialGameState(1000);
    const oldShaped: any = { ...original, world: { ...original.world } };
    delete oldShaped.world.woodDepletion;
    localStorage.setItem("dwarf-game-save", JSON.stringify(oldShaped));

    const result = loadGame(2000);
    expect(result.isFreshState).toBe(false); // NOT discarded - backfilled instead
    expect(result.state.world.woodDepletion).toEqual({});
  });

  it("backfills a missing woodcraft skill on the vessel", () => {
    const original = createInitialGameState(1000);
    const oldShaped: any = {
      ...original,
      vessel: { ...original.vessel, skills: { ...original.vessel.skills } },
    };
    delete oldShaped.vessel.skills.woodcraft;
    localStorage.setItem("dwarf-game-save", JSON.stringify(oldShaped));

    const result = loadGame(2000);
    expect(result.state.vessel.skills.woodcraft).toEqual({ id: "woodcraft", level: 1, xp: 0 });
  });

  it("backfills a missing toolsForged field (pre-dates smithed tools entirely) at bare-hands defaults", () => {
    const original = createInitialGameState(1000);
    const oldShaped: any = { ...original, world: { ...original.world } };
    delete oldShaped.world.toolsForged;
    localStorage.setItem("dwarf-game-save", JSON.stringify(oldShaped));

    const result = loadGame(2000);
    expect(result.isFreshState).toBe(false); // NOT discarded - backfilled instead
    expect(result.state.world.toolsForged).toEqual({ pickaxe: 0, axe: 0 });
  });

  it("backfills a missing lifetimeFuelAtLastRekindle field (pre-dates the rekindle diminishing-returns penalty) at 0", () => {
    const original = createInitialGameState(1000);
    const oldShaped: any = { ...original, world: { ...original.world } };
    delete oldShaped.world.lifetimeFuelAtLastRekindle;
    localStorage.setItem("dwarf-game-save", JSON.stringify(oldShaped));

    const result = loadGame(2000);
    expect(result.isFreshState).toBe(false);
    expect(result.state.world.lifetimeFuelAtLastRekindle).toBe(0);
  });

  it("preserves all OTHER existing data while backfilling - it's additive, not a reset", () => {
    const original = createInitialGameState(1000);
    const oldShaped: any = { ...original, world: { ...original.world, forgeTier: 3 } };
    delete oldShaped.world.woodDepletion;
    localStorage.setItem("dwarf-game-save", JSON.stringify(oldShaped));

    const result = loadGame(2000);
    expect(result.state.world.forgeTier).toBe(3); // untouched by the backfill
  });
});

describe("clearSave", () => {
  it("removes the save so a subsequent load returns fresh state", () => {
    const original = createInitialGameState(1000);
    saveGame(original);
    expect(loadGame(1000).isFreshState).toBe(false);

    clearSave();
    expect(loadGame(1000).isFreshState).toBe(true);
  });
});
