/**
 * Room-state framework — Ruined/Cleared/Restored/Masterwork
 *
 * Every room in the Hub exists on this four-stage restoration arc.
 * The Forge was always the prototype (broken/repaired), now generalized.
 *
 * Stage meanings:
 *   ruined     — collapsed, rubble-filled, inaccessible or barely usable
 *   cleared    — rubble removed, basic function possible, not yet optimized
 *   restored   — working as intended, full function unlocked
 *   masterwork — peak state, usually unlocked through True-metals or deep investment
 *
 * This drives both the visual restoration (what the player SEE changes)
 * and the mechanical restoration score in production.ts.
 *
 * Each room definition describes:
 * - Its zone ID (for zone-unlock integration)
 * - Its stage costs and descriptions
 * - What unlocks at each stage
 */

export type RoomStage = "ruined" | "cleared" | "restored" | "masterwork";

export const ROOM_STAGE_ORDER: RoomStage[] = ["ruined", "cleared", "restored", "masterwork"];

export function nextStage(current: RoomStage): RoomStage | null {
  const idx = ROOM_STAGE_ORDER.indexOf(current);
  return idx < ROOM_STAGE_ORDER.length - 1 ? ROOM_STAGE_ORDER[idx + 1] : null;
}

export function stageIndex(stage: RoomStage): number {
  return ROOM_STAGE_ORDER.indexOf(stage);
}

export interface RoomStageDef {
  stage: RoomStage;
  label: string;
  description: string;
  /** Material cost to advance TO this stage */
  cost: Record<string, number>;
  /** Insight cost to advance TO this stage (0 = none) */
  insightCost: number;
  /** What becomes available at this stage */
  unlocks: string;
}

export interface RoomDefinition {
  id: string;
  name: string;
  zoneId: string;
  stages: RoomStageDef[];
}

export const ROOM_DEFINITIONS: RoomDefinition[] = [
  // ── Stockpile Room (sealed_east → unlocked) ──────────────────────────
  // The east wing, currently rubble. Becomes the mountain's ore reserve —
  // the physical place where drills deposit automatically, where the
  // accumulated wealth of machine-work is held. Restoring it makes the
  // idle loop visible: the room fills while the dwarf does other things.
  {
    id: "stockpile_room",
    name: "The Stockpile",
    zoneId: "sealed_east",
    stages: [
      {
        stage: "ruined",
        label: "Collapsed East Wing",
        description: "Rubble fills what was once a storage hall. Chests, shelves, all buried.",
        cost: {},
        insightCost: 0,
        unlocks: "Nothing yet.",
      },
      {
        stage: "cleared",
        label: "East Wing Cleared",
        description: "The rubble is moved. Stone floor exposed. A single battered chest remains.",
        cost: { wood: 20, copper_ingot: 5 },
        insightCost: 300,
        unlocks: "Manual ore storage. Drills can deposit ore here automatically.",
      },
      {
        stage: "restored",
        label: "The Stockpile",
        description: "Shelves rebuilt. Ore bins sorted by type. The mountain has a working treasury again.",
        cost: { copper_ingot: 20, iron_ingot: 10, wood: 30 },
        insightCost: 800,
        unlocks: "Stockpile capacity ×3. Narag-Bund hauls ore from drills to stockpile automatically.",
      },
      {
        stage: "masterwork",
        label: "The Deep Archive",
        description: "Iron-banded shelves, carved ore-runics on each bin. The old organization returns.",
        cost: { iron_ingot: 30, true_copper: 3 },
        insightCost: 2000,
        unlocks: "Stockpile capacity ×10. Shows ore/min rate on the Mountain Console.",
      },
    ],
  },
];

export function roomById(id: string): RoomDefinition | undefined {
  return ROOM_DEFINITIONS.find((r) => r.id === id);
}

export function stageDef(room: RoomDefinition, stage: RoomStage): RoomStageDef {
  return room.stages.find((s) => s.stage === stage) ?? room.stages[0];
}

export function canAdvanceRoom(
  room: RoomDefinition,
  currentStage: RoomStage,
  inventory: Record<string, number>,
  insightBanked: number
): boolean {
  const next = nextStage(currentStage);
  if (!next) return false;
  const def = stageDef(room, next);
  if (insightBanked < def.insightCost) return false;
  for (const [mat, amt] of Object.entries(def.cost)) {
    if ((inventory[mat] ?? 0) < amt) return false;
  }
  return true;
}
