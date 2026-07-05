/**
 * Narrator content - the Bastion-style voice: mythic, weary, past-tense,
 * third person. This is pure content, deliberately separate from the
 * trigger/display logic in narrator.ts. Most triggers have a POOL of
 * lines rather than one fixed line, so frequent events (mining strikes)
 * don't repeat to death - see narrator.ts for the anti-repeat picking.
 *
 * Some triggers (waking, first rekindling, first color) intentionally
 * have very few or single lines - they're rare, important moments
 * where repetition isn't a risk and a fixed line carries more weight.
 */

import type { NarratorTrigger } from "../engine/types";

export const NARRATOR_LINES: Record<NarratorTrigger, string[]> = {
  wake_first_ever: ["The dwarf wakes in the dark. He does not remember falling asleep."],

  wake_rekindled: [
    "Another one wakes at the hearth. The mountain doesn't tell him which number he is.",
    "He opens his eyes. The dark opens its eyes too, and waits to see what he'll do with it.",
  ],

  mine_first_strike: ["He picks up the stone. It feels like the first thing anyone has ever held."],

  mine_strike: [
    "The pick finds rock, and rock finds the pick. Neither of them complain.",
    "Stone breaks the way stone has always broken. He's grateful for small mercies.",
    "Ore, this time. Small as it is, it's more than he had an hour ago.",
  ],

  wood_first_strike: [
    "The root tangle gives way under the axe. Something that grew in the dark, felled by something that lives in it.",
  ],

  wood_strike: [
    "The wood splits clean. It remembers being something else, once, before it remembered being this.",
    "Cave-root, stubborn as stone but easier to forgive. He takes what it gives.",
    "Not much of a tree, down here. It didn't need to be much, to be enough.",
  ],

  gem_found: [
    "Something catches the light that has no business catching it. He stops. He looks again.",
    "Not ore. Not rock. Something the mountain kept for itself, until now.",
  ],

  level_up: [
    "His hands remember this now. They didn't, this morning.",
    "Something in him settles into place, the way a tool settles into a worn grip.",
  ],

  color_stage_1: ["For the first time, the dark has a color. It is the color of him."],

  color_stage_later: ["Color creeps into the world like something embarrassed to be noticed. He notices anyway."],

  torch_repaired: [
    "The torch catches. For a small distance in every direction, the mountain remembers what light was for.",
  ],

  area_revealed: [
    "The dark steps back, reluctantly, the way it always does — just far enough to let him through.",
  ],

  stranger_arrival: [
    "Someone else's footsteps. He'd almost forgotten that sound belonged to anyone but him.",
  ],

  companion_befriended: [
    "Something small and coal-backed follows him now, uninvited and unbothered by that. He doesn't tell it to leave.",
  ],

  console_awakened: [
    "The runes answer. Somewhere deep in the stone, something older than any dwarf who ever swung a pick takes notice. The mountain begins to remember itself.",
  ],

  forge_repaired: [
    "The forge catches. Cold iron remembers, even after all this time, what it's for.",
  ],

  merchant_arrived: [
    "Boots on the bridge. Heavier than any single dwarf. Someone found the road.",
  ],

  merchant_trade: [
    "Coin changes hands. It's been a long time since that sound echoed in this hall.",
    "The merchant nods. Business, brief and honest, the way the old holds used to run it.",
  ],
};
