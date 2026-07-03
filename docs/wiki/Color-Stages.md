# Color Stages — Perception Is Progression

The world begins in a genuine 2-color constraint: true black background, one uniform gray foreground for absolutely everything — walls, floor, ore, the dwarf, the unlit hearth. Only shape carries meaning. This is deliberate impoverishment, not "color hasn't been added yet."

As the Hearth accumulates lifetime fuel, the world permanently gains more of itself back. This isn't a cosmetic upgrade track — restoring your own ability to *perceive* the mountain is treated as core to the game, not decoration on top of it.

| Stage | Label | Lifetime fuel required | What changes |
|---|---|---|---|
| 0 | The Dark | 0 | Pure 2-bit glyphs. Nothing has color. |
| 1 | First Ember | 500 | Hearth and Forge gain warm color. Triggered by your **first rekindling**. |
| 2 | Hearthlight | 5,000 | Materials differentiate by color; the renderer switches from glyphs to real sprite art. UI chrome (like the Skills tab) also gains its painted version at this threshold. |
| 3 | True Color | 50,000 | Full natural palette — a different *kind* of light than Stage 2, not just more saturation. |
| 4 | Architecture *(future)* | 100,000 (+ restoration score 3,000) | Not yet built |
| 5 | The Mountain Remembers *(future)* | 250,000 (+ restoration score 8,000) | Not yet built |

Stage 0 is capped **until you've rekindled at least once** — even if lifetime fuel crosses the Stage 1 threshold, the world stays gray until you've actually chosen to rekindle. Crossing that threshold and clicking Rekindle for the first time are meant to be the same moment.

## Two renderers

- **Glyph mode** — monospace characters, active at Stage 0 and 1.
- **Sprite mode** — real tile art from the Vettlingr tileset, active from Stage 2 onward. This is the big visual jump; Stage 3 doesn't change the tileset's look further, only the ambient palette. Later stages (architecture, memory) are meant to be felt other ways once built.
