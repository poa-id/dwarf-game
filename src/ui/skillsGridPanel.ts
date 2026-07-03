import { SKILL_ICONS } from "../render/skillIconManifest";

/**
 * The Skills tab has two visual modes now (2026-07-03), gated by the
 * same colorStage threshold that switches the world from ASCII glyphs
 * to real sprite art (TILESET_MODE_MIN_COLOR_STAGE = 2, "Hearthlight" -
 * see render.ts's activeRenderer()). Per the project's own "Perception
 * Is Progression" principle (MECHANICS.md section 8): richly-painted
 * skill badges are exactly the kind of visual reward that should be
 * EARNED alongside the world's own objects gaining form, not shown from
 * the very first minute of a Stage-0 "the world is forgotten" save.
 * Flagged directly by design review - the icon grid was shipped without
 * this gate initially.
 *
 * - Basic mode (colorStage < 2): plain "Mining 1" text rows + a bar -
 *   effectively the pre-icon-grid layout, restored verbatim rather than
 *   invented fresh, since "like before" was the explicit direction.
 * - Icon mode (colorStage >= 2): the RuneScape-style badge grid.
 *
 * Both trees are built into the DOM up front and toggled via display,
 * rather than re-rendering innerHTML on every colorStage change - same
 * pattern the herblore/brewing hidden-until-used rows already use.
 * Distinct ids per mode (stat-mining vs stat-mining-basic, etc.) since
 * they hold different text formats simultaneously (badge = level number
 * only; basic row = "Mining 5" full label) - render.ts updates both on
 * every render() regardless of which is currently visible; that's a
 * pure CSS concern; the DOM writes cost is negligible either way.
 */

interface SkillTileDef {
  id: "mining" | "smithing" | "hearthkeeping" | "woodcraft" | "tinkering" | "herblore" | "brewing";
  label: string;
  hiddenUntilUsed: boolean;
}

const SKILL_TILES: SkillTileDef[] = [
  { id: "mining", label: "Mining", hiddenUntilUsed: false },
  { id: "smithing", label: "Smithing", hiddenUntilUsed: false },
  { id: "hearthkeeping", label: "Hearthkeeping", hiddenUntilUsed: false },
  { id: "woodcraft", label: "Woodcraft", hiddenUntilUsed: false },
  { id: "tinkering", label: "Tinkering", hiddenUntilUsed: false },
  { id: "herblore", label: "Herblore", hiddenUntilUsed: true },
  { id: "brewing", label: "Brewing", hiddenUntilUsed: true },
];

function skillTileHtml(def: SkillTileDef): string {
  const wrapperStyle = def.hiddenUntilUsed ? ` style="display:none"` : "";
  return `
    <div class="skill-tile" id="skill-${def.id}-row"${wrapperStyle} title="${def.label}">
      <div class="skill-icon-wrap">
        <img class="skill-icon" src="${SKILL_ICONS[def.id]}" alt="${def.label}" />
        <span class="skill-level-badge" id="stat-${def.id}">1</span>
      </div>
      <div class="skill-bar"><div class="skill-bar-fill" id="bar-${def.id}"></div></div>
    </div>`;
}

function skillBasicRowHtml(def: SkillTileDef): string {
  const wrapperStyle = def.hiddenUntilUsed ? ` style="display:none"` : "";
  return `
    <div class="skill-row-basic" id="skill-${def.id}-row-basic"${wrapperStyle}>
      <p id="stat-${def.id}-basic">${def.label} 1</p>
      <div class="skill-bar"><div class="skill-bar-fill" id="bar-${def.id}-basic"></div></div>
    </div>`;
}

export function buildSkillsGridHtml(): string {
  // Basic list starts visible, icon grid starts hidden - matches a
  // fresh save's colorStage 0. render()'s first call corrects this
  // either way based on actual state, so this is just a sane default
  // for the one frame before that (and for environments where JS is
  // slow to hydrate).
  return `
    <div class="skills-basic-list" id="skills-basic-list">${SKILL_TILES.map(skillBasicRowHtml).join("")}</div>
    <div class="skills-grid" id="skills-icon-grid" style="display:none">${SKILL_TILES.map(skillTileHtml).join("")}</div>
  `;
}
