import { describe, it, expect } from "vitest";
import {
  pickLine,
  triggerNarration,
  createInitialNarratorState,
  hasFiredOnce,
} from "../narrator";
import { NARRATOR_LINES } from "../lines";

describe("pickLine", () => {
  it("always returns the single line for a one-line pool, regardless of roll", () => {
    const result1 = pickLine("wake_first_ever", null, 0);
    const result2 = pickLine("wake_first_ever", null, 0.99);
    expect(result1).toBe(NARRATOR_LINES.wake_first_ever[0]);
    expect(result2).toBe(NARRATOR_LINES.wake_first_ever[0]);
  });

  it("never returns the same line as lastShown for a multi-line pool", () => {
    const pool = NARRATOR_LINES.mine_strike;
    const lastShown = pool[0];
    // try every roll across the range, should never come back to lastShown
    for (let roll = 0; roll < 1; roll += 0.05) {
      const result = pickLine("mine_strike", lastShown, roll);
      expect(result).not.toBe(lastShown);
    }
  });

  it("can return any line in the pool except lastShown across many rolls", () => {
    const pool = NARRATOR_LINES.mine_strike;
    const seen = new Set<string>();
    for (let roll = 0; roll < 1; roll += 0.01) {
      seen.add(pickLine("mine_strike", null, roll));
    }
    // with lastShown=null, all lines should be reachable
    expect(seen.size).toBe(pool.length);
  });
});

describe("triggerNarration - one-time triggers", () => {
  it("fires the first time and returns a non-null line", () => {
    const state = createInitialNarratorState();
    const result = triggerNarration("wake_first_ever", state, 0.5);
    expect(result.line).not.toBeNull();
    expect(hasFiredOnce(result.state, "wake_first_ever")).toBe(true);
  });

  it("does NOT fire a second time - returns null line, state unchanged in firedOnceTriggers", () => {
    const state = createInitialNarratorState();
    const first = triggerNarration("wake_first_ever", state, 0.5);
    const second = triggerNarration("wake_first_ever", first.state, 0.9);
    expect(second.line).toBeNull();
  });

  it("color_stage_1 (the rekindling reward line) only ever fires once", () => {
    let state = createInitialNarratorState();
    const first = triggerNarration("color_stage_1", state, 0.1);
    state = first.state;
    expect(first.line).not.toBeNull();

    const second = triggerNarration("color_stage_1", state, 0.1);
    expect(second.line).toBeNull();
  });
});

describe("triggerNarration - repeatable triggers", () => {
  it("fires every time for a repeatable trigger like mine_strike", () => {
    let state = createInitialNarratorState();
    for (let i = 0; i < 5; i++) {
      const result = triggerNarration("mine_strike", state, Math.random());
      expect(result.line).not.toBeNull();
      state = result.state;
    }
  });

  it("tracks lastShownByTrigger so consecutive calls avoid repeating the same line", () => {
    let state = createInitialNarratorState();
    const first = triggerNarration("mine_strike", state, 0.1);
    state = first.state;
    const second = triggerNarration("mine_strike", state, 0.1); // same roll, different lastShown context
    expect(second.line).not.toBe(first.line);
  });

  it("different triggers track lastShown independently - no cross-contamination", () => {
    let state = createInitialNarratorState();
    const mineLine = triggerNarration("mine_strike", state, 0.3);
    state = mineLine.state;
    const levelLine = triggerNarration("level_up", state, 0.3);
    // level_up's pool is unaffected by mine_strike's lastShown
    expect(state.lastShownByTrigger.mine_strike).toBe(mineLine.line);
    expect(levelLine.state.lastShownByTrigger.level_up).toBe(levelLine.line);
  });
});

describe("triggerNarration - purity", () => {
  it("does not mutate the input state", () => {
    const state = createInitialNarratorState();
    const before = JSON.stringify(state);
    triggerNarration("mine_strike", state, 0.5);
    expect(JSON.stringify(state)).toBe(before);
  });
});
