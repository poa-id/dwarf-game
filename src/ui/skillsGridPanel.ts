import { SKILL_ICONS } from "../render/skillIconManifest";

/**
 * The Skills tab used to be a vertical list of "Mining 1" text rows with
 * a thin bar underneath. Replaced 2026-07-03 with a RuneScape-inspired
 * icon grid: badge art + a level number overlaid on the badge + a thin
 * XP bar beneath. Herblore and Brewing tiles stay hidden (display:none)
 * until the player has actually earned XP in them, same gating as
 * before - just now on the tile wrapper instead of a row.
 *
 * Element ids are preserved from the old markup (stat-mining, bar-mining,
 * skill-herblore-row, etc.) so src/game/render.ts's DOM writes work
 * unchanged - only the *content* it writes into stat-* elements changes
 * (level number only, not "Mining 5", since the name now lives on the
 * icon + tooltip instead of as row text).
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

export function buildSkillsGridHtml(): string {
  return `<div class="skills-grid">${SKILL_TILES.map(skillTileHtml).join("")}</div>`;
}
