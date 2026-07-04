import { PICKAXE_ICONS, AXE_ICONS } from "../render/toolIconManifest";

/**
 * The tools display (under the Skills tab) has the same two-mode split
 * as the Skills icon grid (see skillsGridPanel.ts's doc comment) - the
 * same Perception Is Progression principle applies to any visually-rich
 * UI, not just world sprites or skill badges, per the note added to
 * MECHANICS.md when that call was first made.
 *
 * - Basic mode (colorStage < 2): the original plain "Pickaxe: Bare
 *   Hands" / "Axe: Bare Hands" text rows, unchanged.
 * - Icon mode (colorStage >= 2): each slot shows the actual tool
 *   sprite for its current tier (empty-slot art at tier 0, i.e. Bare
 *   Hands - a slot that visibly reads as empty rather than a layout
 *   gap), with the tool's name as a caption underneath.
 *
 * Both trees stay in the DOM; render.ts toggles which is visible and
 * writes the current tier's icon `src` + name text into the icon-mode
 * elements every render() call, same as the skills grid's basic-list
 * text.
 */
export function buildToolsPanelHtml(): string {
  return `
    <div id="tools-basic-list"><p id="tools-basic-pickaxe">Pickaxe: Bare Hands</p><p id="tools-basic-axe">Axe: Bare Hands</p></div>
    <div class="tools-icon-grid" id="tools-icon-grid" style="display:none">
      <div class="skill-tile">
        <div class="skill-icon-wrap">
          <img class="skill-icon" id="tools-icon-pickaxe" src="${PICKAXE_ICONS[0]}" alt="Pickaxe" />
        </div>
        <p class="tools-icon-caption" id="tools-caption-pickaxe">Bare Hands</p>
      </div>
      <div class="skill-tile">
        <div class="skill-icon-wrap">
          <img class="skill-icon" id="tools-icon-axe" src="${AXE_ICONS[0]}" alt="Axe" />
        </div>
        <p class="tools-icon-caption" id="tools-caption-axe">Bare Hands</p>
      </div>
    </div>
  `;
}
