# The Hearth & The Deep — Design Doc Index

*Living documentation, split by concern so any single update only
touches the relevant file. If full context is needed, read all three;
for a focused change, usually only one is needed.*

- **[docs/LORE.md](docs/LORE.md)** — the pitch, the rekindling myth,
  the narrator's voice and rules, NPCs and Narag-Bund. Read this for
  *why* something should feel a certain way, or to write new narrator
  lines / lore content in the right voice.
- **[docs/MECHANICS.md](docs/MECHANICS.md)** — the World/Vessel/
  Narrator state model, skills, materials & economy, the Hub map,
  visibility/movement, visual identity, persistence. Read this for
  *how* a system actually works before changing or extending it.
- **[docs/OPEN_QUESTIONS.md](docs/OPEN_QUESTIONS.md)** — gaps,
  placeholders, and unresolved decisions. Changes fastest of the
  three; check here before assuming something is finished, and update
  it the moment something gets resolved or a new gap is found.

## Quick orientation for a fresh session

If picking this project up without the conversation history that
produced it:

1. Read this index, then skim the three docs above - they're each a
   few hundred lines, not thousands.
2. The actual code lives in `src/`, organized as:
   - `src/engine/` — pure game logic, no DOM/rendering, heavily
     tested. Source of truth for what's actually true about the
     game's rules.
   - `src/render/` — canvas rendering, tileset/ASCII art, the Hub's
     static map content.
   - `src/game/` — the live game's mutable state, UI wiring, input
     handling, the tick loop. Thin glue between engine and DOM.
   - `src/ui/` — contextual panel components (Smithing, Hearth).
   - `src/narration/` — the narrator's content and trigger logic.
   - `src/persistence/` — save/load.
   - `src/main.ts` — boots everything. Should stay small; if it's
     growing past ~150 lines again, that's a signal to extract a new
     `src/game/` module rather than let it keep growing.
3. `npx vitest run` runs the full test suite (200+ tests as of this
   writing) - a fast way to confirm the engine layer still behaves as
   documented before trusting any of the above.
4. Git history (`git log --oneline`) is itself a reasonably accurate
   changelog - commit messages in this repo explain *why*, not just
   *what*, specifically so they're useful context later without
   re-reading the original conversation.
