# The Hearth & The Deep — Design Doc Index

*Living documentation, split by concern so any single update only
touches the relevant file. If full context is needed, read all three;
for a focused change, usually only one is needed.*

**Production philosophy:** build one complete loop, then test, before
adding more systems. The current target vertical slice (wake beside the
dying Hearth → mine copper → gather wood → repair forge → smelt ingots →
repair torches → feed Hearth → unlock first color → restore first room →
rekindle → return stronger) is the next milestone to *prove*, not a list
of features to build in isolation. If that loop isn't fun, more content
won't fix it; if it is fun, that's the green light to keep going. See
OPEN_QUESTIONS.md for the current audit status of this loop.

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
- **[docs/wiki/](docs/wiki/Home.md)** — the player-facing wiki (RuneScape/
  Terraria-wiki style): skills, recipes, costs, rooms, materials. This
  is a separate audience from the three docs above — those are for
  whoever (human or Claude) is building the game; the wiki is for
  people playing it. Meant to be published somewhere else (e.g. GitHub
  Pages or a real wiki host) so players don't need the repo itself.
  Update it alongside a session's other doc updates whenever a change
  touches something player-visible (new recipe, cost, room, material).
  Some pages use `<details>` spoiler-collapse blocks for content the
  game itself hides until late-game discovery (e.g. Narag-Bund, the
  rekindle threshold) - keep that pattern for future spoiler-sensitive
  content rather than exposing it plainly.

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

## Starting a new conversation

Conversation length, not file size, is the main cost driver for an
ongoing chat with Claude - every prior message stays "in the room"
for the rest of that thread. The fix is starting fresh conversations
periodically (e.g. after a milestone/commit lands cleanly) rather than
extending one thread indefinitely.

**IMPORTANT - this actually requires a real GitHub repo, not just this
file existing.** Each conversation with Claude runs in its own fresh,
disposable sandbox - nothing on disk persists between conversations.
A previous version of this doc wrongly implied "the repo is just
there" for a fresh session to read, which sent a new conversation
looking for a `dwarf-game/` folder that didn't exist in its container.
The fix: this project's history is pushed to a real GitHub repo
(persists outside any one conversation), and a fresh Claude clones it
at the start of each new session - `git clone` works from Claude's
sandbox with zero credentials needed for a public repo.

**Repo URL: `https://github.com/poa-id/dwarf-game.git`**
(fill this in once the repo is created - see the project owner if this
still says poa-id, the repo may not be pushed yet)

**Paste this as the opening message of a new conversation:**

> This is an ongoing project: a dwarf-themed idle/RPG game called "The
> Hearth & The Deep." Clone https://github.com/poa-id/dwarf-game.git
> into your working directory first. Then read DESIGN.md at the repo
> root (it's a short index), then docs/OPEN_QUESTIONS.md to see what's
> unresolved/in-progress. Only read docs/LORE.md or docs/MECHANICS.md
> if the task actually needs that depth. Once you've oriented, ask me
> what I want to work on - don't start building yet.

**Workflow for ending a session that made real progress:** commit
locally (already standard practice in this project), then `git push`
to the GitHub remote before the conversation ends - a local-only
commit inside that conversation's sandbox is just as lost as an
unzipped file once the session closes. Pushing is what actually
survives.

**Standing instruction for Claude, every session, not just the first:**
keep DESIGN.md/docs/ current as part of doing the work, not as a
separate step that has to be remembered or asked for. Concretely:
- Any new decision, mechanic, or piece of lore settled during a
  session belongs in the relevant doc (LORE vs MECHANICS) before that
  session's work is considered done - not deferred to "later."
- Any gap, placeholder, or known-rough edge introduced or discovered
  gets a line in OPEN_QUESTIONS.md, in the same commit as the code
  that introduced or discovered it.
- When an open question gets resolved, move it OUT of
  OPEN_QUESTIONS.md and INTO the relevant doc as settled fact, rather
  than leaving a stale "resolved!" note sitting in the questions file
  indefinitely (a few resolved items can stay temporarily for
  changelog purposes, per the existing pattern, but should be pruned
  once they're no longer useful history).
- If a doc update would meaningfully change what a fresh session
  needs to know, it belongs in the same commit as the code change -
  docs and code drifting apart is exactly the failure mode this
  structure exists to prevent.
- **Push to the GitHub remote before the conversation ends**, not just
  commit locally - see above, this is the step that actually makes
  the next session's clone work.

