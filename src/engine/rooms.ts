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

  // ── Garden Room (SW — always accessible, needs restoration) ──────────
  {
    id: "garden_room",
    name: "The Garden",
    zoneId: "garden_room",
    stages: [
      {
        stage: "ruined",
        label: "Overgrown Garden",
        description: "The planters collapsed long ago. Cave roots tangle through broken stone.",
        cost: {},
        insightCost: 0,
        unlocks: "Nothing yet. The wood node still works.",
      },
      {
        stage: "cleared",
        label: "Garden Cleared",
        description: "Two planters rebuilt. Soil turned. Something could grow here.",
        cost: { wood: 30, copper_ingot: 8 },
        insightCost: 200,
        unlocks: "2 garden slots. Plant stoneshroom spores (drop from wood cutting).",
      },
      {
        stage: "restored",
        label: "The Garden",
        description: "Six planters, the old watering channel cleared. The ancient seed chest found — sealed, but real.",
        cost: { copper_ingot: 15, iron_ingot: 5, wood: 40 },
        insightCost: 600,
        unlocks: "6 garden slots. Ancient seed chest opened — plant Ironwood saplings.",
      },
      {
        stage: "masterwork",
        label: "The Deep Garden",
        description: "The old growth-light veins rekindled. Whatever grows here grows faster.",
        cost: { iron_ingot: 20, true_copper: 2, ironwood: 10 },
        insightCost: 1500,
        unlocks: "10 garden slots. All growth cycles 30% faster.",
      },
    ],
  },

  // ── Trade Hall (sealed_south → unlocked at restoration 2000) ────────
  {
    id: "trade_hall",
    name: "The Trade Hall",
    zoneId: "sealed_south",
    stages: [
      {
        stage: "ruined",
        label: "Collapsed South Wing",
        description: "Rubble. There's a brass fitting in the stone — some kind of merchant's post, once.",
        cost: {},
        insightCost: 0,
        unlocks: "Nothing yet. Requires restoration score 2,000.",
      },
      {
        stage: "cleared",
        label: "Trade Post (Stub)",
        description: "The merchant's post cleared. A bell mounted at the road entrance. Someone will come.",
        cost: { wood: 25, copper_ingot: 10, iron_ingot: 3 },
        insightCost: 500,
        unlocks: "Merchant arrives every 10 minutes. Trade cut gems for rare materials.",
      },
      {
        stage: "restored",
        label: "The Trade Hall",
        description: "Shelves stocked, scales restored. Merchants arrive more often and offer better rates.",
        cost: { iron_ingot: 15, copper_ingot: 20, wood: 30 },
        insightCost: 1200,
        unlocks: "Merchant arrives every 5 minutes. Expanded inventory.",
      },
      {
        stage: "masterwork",
        label: "The Great Exchange",
        description: "Word has spread. Merchants come in caravans. The mountain is on the trade routes again.",
        cost: { iron_ingot: 30, true_copper: 3, true_iron: 1 },
        insightCost: 3000,
        unlocks: "Merchant always present. Exotic goods. Cave Fern spores available.",
      },
    ],
  },

  // ── Deep Foundry (sealed_northwest → unlocked at restoration 4000) ──
  {
    id: "deep_foundry",
    name: "The Deep Foundry",
    zoneId: "sealed_northwest",
    stages: [
      {
        stage: "ruined",
        label: "Collapsed Northwest Wing",
        description: "Collapsed. Through gaps in the rubble — enormous furnace brickwork, cold for centuries.",
        cost: {},
        insightCost: 0,
        unlocks: "Nothing yet. Requires restoration score 4,000.",
      },
      {
        stage: "cleared",
        label: "Deep Foundry (Stub)",
        description: "The great furnace cleared. Cold still, but the brickwork is sound.",
        cost: { iron_ingot: 20, wood: 20, deepstone_ingot: 5 },
        insightCost: 1000,
        unlocks: "Deepstone tool recipes unlocked. Better smelt success rate.",
      },
      {
        stage: "restored",
        label: "The Deep Foundry",
        description: "The great furnace lit. Deepstone glows in the crucible. The old craft returns.",
        cost: { iron_ingot: 40, deepstone_ingot: 15, true_iron: 2 },
        insightCost: 2500,
        unlocks: "Iron drill buildable. Hearthsap smelting. Deep Foundry upgrades.",
      },
      {
        stage: "masterwork",
        label: "The Grand Forge",
        description: "Both furnaces running. The mountain makes its own tools again.",
        cost: { deepstone_ingot: 30, true_deepstone: 2 },
        insightCost: 5000,
        unlocks: "Starstone recipes. Drill Bit tool. Maximum forge yield.",
      },
    ],
  },

  // ── The Archive (sealed_north → unlocked at restoration 6000) ───────
  {
    id: "the_archive",
    name: "The Archive",
    zoneId: "sealed_north",
    stages: [
      {
        stage: "ruined",
        label: "Collapsed North Passage",
        description: "Sealed. Older than anything else. The rubble here feels deliberate — as if something was protected.",
        cost: {},
        insightCost: 0,
        unlocks: "Nothing yet. Requires restoration score 6,000.",
      },
      {
        stage: "cleared",
        label: "The Archive (Stub)",
        description: "Tablets, runes, shelving of carved stone. The mountain's own history.",
        cost: { true_copper: 3, true_iron: 2, ironwood: 10 },
        insightCost: 2000,
        unlocks: "Console upgrade: full lore display. Deeper mountain history unlocked.",
      },
      {
        stage: "restored",
        label: "The Archive",
        description: "The runes speak. Every dwarf who ever worked here is named in the stone.",
        cost: { true_iron: 5, true_deepstone: 2, ironwood: 20 },
        insightCost: 5000,
        unlocks: "Insight gain +20% permanently. Full mountain memory visible.",
      },
      {
        stage: "masterwork",
        label: "The Deep Record",
        description: "The mountain speaks. Not metaphor. The console now renders the mountain's own voice.",
        cost: { true_deepstone: 5 },
        insightCost: 10000,
        unlocks: "The Narrator speaks as the mountain itself. Maximum restoration.",
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