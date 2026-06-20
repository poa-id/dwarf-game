/**
 * Toast display for narrator lines. Non-blocking (never pauses or
 * intercepts input), but NOT a free-for-all: only one line is ever
 * visible at a time, and a real queue holds the rest rather than
 * stacking them all on screen at once. The narrator should feel like
 * an occasional, weighty voice - not a notification spamming every
 * keypress.
 *
 * Duration is deliberately generous (7s visible + fade) since these
 * are meant to be read, not glanced at. If lines queue up faster than
 * they can be shown, later ones simply wait - we do not speed up or
 * skip to catch up, since a rushed narrator defeats the point.
 */

const VISIBLE_MS = 4200;
const FADE_MS = 900;

let queue: string[] = [];
let isShowing = false;
let activeContainer: HTMLElement | null = null;

function showNext(): void {
  if (isShowing || queue.length === 0 || !activeContainer) return;
  isShowing = true;

  const line = queue.shift()!;
  const toast = document.createElement("p");
  toast.className = "narrator-toast";
  toast.textContent = line;
  activeContainer.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add("narrator-toast-visible"));

  setTimeout(() => {
    toast.classList.remove("narrator-toast-visible");
    setTimeout(() => {
      toast.remove();
      isShowing = false;
      showNext();
    }, FADE_MS);
  }, VISIBLE_MS);
}

/**
 * Queue a narrator line for display. Safe to call as often as
 * triggers fire - lines queue up and show one at a time, each given
 * its full reading duration, rather than overlapping or replacing
 * whatever's currently showing.
 */
export function showNarratorToast(container: HTMLElement, line: string): void {
  activeContainer = container;
  queue.push(line);
  showNext();
}

/** Clears any pending queue - intended for tests/resets, not normal gameplay use. */
export function resetNarratorToastQueue(): void {
  queue = [];
  isShowing = false;
}
