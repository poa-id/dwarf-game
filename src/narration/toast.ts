/**
 * Minimal toast display for narrator lines. Non-blocking: appends a
 * line, lets it fade, removes it - never pauses or intercepts input.
 * Multiple toasts can stack briefly if triggers fire in quick
 * succession; each manages its own lifecycle independently.
 */

const FADE_AFTER_MS = 3200;
const REMOVE_AFTER_MS = 4000; // gives the CSS fade transition time to finish before DOM removal

export function showNarratorToast(container: HTMLElement, line: string): void {
  const toast = document.createElement("p");
  toast.className = "narrator-toast";
  toast.textContent = line;
  container.appendChild(toast);

  // Force a reflow-triggered transition: add the "visible" class on the
  // next frame rather than immediately, so the CSS transition actually
  // animates in rather than starting in its end state.
  requestAnimationFrame(() => toast.classList.add("narrator-toast-visible"));

  setTimeout(() => toast.classList.remove("narrator-toast-visible"), FADE_AFTER_MS);
  setTimeout(() => toast.remove(), REMOVE_AFTER_MS);
}
