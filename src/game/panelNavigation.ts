/**
 * Keyboard navigation for contextual panels (Forge/Hearth/Kiln) - added
 * 2026-06-23 per explicit project direction: "WASD stays movement,
 * arrow keys become menu navigation... pre-select the first option
 * when in interaction range so a single confirm key acts on it
 * immediately." Deliberately panel-agnostic: every contextual panel's
 * interactable rows already share the `.recipe-row` class (with
 * `.recipe-row-disabled` as a modifier for unavailable ones) - this
 * module operates purely on that existing DOM convention rather than
 * requiring each panel's render function to know anything about
 * keyboard state. Highlighting a row and "confirming" it (Space) just
 * dispatches a real click on the underlying element, so every panel's
 * existing onClick wiring keeps working unchanged.
 *
 * Arrow Up/Down moves between rows, CLAMPING at the ends (no
 * wraparound) - explicit design call. Space confirms the highlighted
 * row's action - also explicit (not Enter, not re-using F).
 */

const HIGHLIGHT_CLASS = "recipe-row-highlighted";

function getNavigableRows(panel: HTMLElement): HTMLElement[] {
  return Array.from(panel.querySelectorAll<HTMLElement>(".recipe-row")).filter(
    (row) => !row.classList.contains("recipe-row-disabled")
  );
}

let highlightedIndex = 0;

/**
 * Re-applies the highlight after a panel re-render (which rebuilds
 * innerHTML from scratch every time, wiping out any class previously
 * applied to a now-destroyed element). Called every time render()
 * runs, not just on keyboard input - this is what makes "pre-select
 * the first option" work: the moment a panel's rows exist at all
 * (player walked into range), row 0 is already highlighted without
 * needing an arrow-key press first. Clamps highlightedIndex to the
 * new row count, in case the panel shrank (e.g. an upgrade just got
 * purchased and its row disappeared).
 */
export function reapplyPanelHighlight(panel: HTMLElement): void {
  const rows = getNavigableRows(panel);
  if (rows.length === 0) return;

  highlightedIndex = Math.min(highlightedIndex, rows.length - 1);
  rows[highlightedIndex]?.classList.add(HIGHLIGHT_CLASS);
}

/** Arrow Up/Down - moves the highlight, clamping at the panel's ends (no wraparound, explicit design call). Resets to row 0 if the panel was empty or this is the first navigation since it opened. */
export function movePanelHighlight(panel: HTMLElement, direction: "up" | "down"): void {
  const rows = getNavigableRows(panel);
  if (rows.length === 0) return;

  rows[highlightedIndex]?.classList.remove(HIGHLIGHT_CLASS);

  const delta = direction === "up" ? -1 : 1;
  highlightedIndex = Math.max(0, Math.min(rows.length - 1, highlightedIndex + delta));

  rows[highlightedIndex]?.classList.add(HIGHLIGHT_CLASS);
}

/** Space - confirms the currently highlighted row by dispatching a real click on it, so the panel's existing onClick wiring fires unchanged. Returns true if a row was actually confirmed (so the caller knows whether to preventDefault). */
export function confirmPanelHighlight(panel: HTMLElement): boolean {
  const rows = getNavigableRows(panel);
  const row = rows[highlightedIndex];
  if (!row) return false;
  row.click();
  return true;
}

/** Resets the highlight back to the first row - called whenever the contextual panel's CONTENT changes identity (e.g. walking from the Forge to the Hearth), so the highlight doesn't carry over an unrelated index from a different panel's row count. */
export function resetPanelHighlight(): void {
  highlightedIndex = 0;
}
