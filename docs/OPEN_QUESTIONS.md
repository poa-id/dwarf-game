# The Hearth & The Deep — Open Questions

*Part of the design doc set — see ../DESIGN.md for the index. This file changes fastest — update it whenever a gap is resolved or discovered.*

## 11. Open Questions / Explicit Gaps

Tracked here so they don't get silently forgotten. Remove from this list
once resolved (and reflect the resolution in the relevant section above).

- **Idle-game bulk action multiplier (agreed, not yet built):** any
  repeatable spend/produce action (stoking, smithing) should support a
  shared x1/x5/x10/MAX multiplier selector (Cookie Clicker convention) -
  needed once quantities scale into the thousands+. Should be ONE
  reusable mechanic, not duplicated per-feature. Still not built -
  current stoke/smith actions are all fixed at quantity 1 per click.
- **"Deepened Hearth" (tier 2) has no actual mechanical effect yet:**
  its description promises fuel efficiency, but nothing in `tickHearth`
  or `deductFuelValueFromReserve` currently reads `hearthTier` to apply
  any multiplier - buying it right now would cost 150 Insight for
  flavor text only. Needs either a real efficiency calculation or
  honest removal until one exists.
- **Mine Entrance UI (shape agreed, not built):** interacting with the
  Mine Entrance zone should open a dedicated panel - depth-gated nodes,
  cart speed + auto-collection upgrades. Still not built. The Tunnel
  Entrance zone itself is currently gated on `hearth_color_stage_at_least(1)`
  - worth revisiting given the forge_room precedent of "always reachable,
  contents start broken/rubble" might fit better here too.
- **Torch upgrades beyond initial repair (agreed, not built):** more
  light radius, other unspecified effects, after the base repair.
- **Organic cave shape / rubble rendering (§6):** PARTIALLY done - the
  forge now genuinely renders as broken/rubble (`forge_broken`) until
  repaired, proving the rubble-state pattern works. The broader organic/
  irregular CAVE SHAPE (vs. the current rectangular zone bounds) is
  still not implemented - this was specifically about wall geometry,
  not the rubble-vs-built rendering, which is now real for the forge.
- **Wandering strangers (§10):** model agreed, nothing built - distinct
  from Narag-Bund (§10a), which IS built.
- **Torch repair cost balance**: current costs (3-5 copper_ingot) are
  placeholder guesses, unplaytested against real ingot production rate.
- **Woodcraft has no narrator voice yet:** `handleWoodGather` in
  `main.ts` deliberately narrates nothing for routine gathers (Mining's
  "the pick finds rock" lines would be wrong for cutting wood) - needs
  its own line pool once Woodcraft's narrative identity is decided.
- **Repeat-key guard doesn't cover the new contextual panel clicks:**
  the `e.repeat` fix (movement/main.ts) only applies to keyboard
  shortcuts (F/E/R) - the Smithing/Hearth panel buttons are mouse
  clicks with no analogous "don't double-fire" guard. Probably fine
  (mouse click-spam isn't the same failure mode as a held key) but
  worth a deliberate look once played with a mouse for real.
- **Narag-Bund's haul interval/amount are unplaytested guesses:**
  `HAUL_INTERVAL_MS=10000`, `HAUL_AMOUNT_PER_TRIP=1` were picked to
  "feel like a creature on its own schedule" per the design discussion,
  but have not been tuned against real play.

### Resolved this session (kept for history, remove once stale)
- ~~Save/load: does not exist yet.~~ **RESOLVED** — see §12.
- ~~No forge interaction in `main.ts`.~~ **RESOLVED** — forge starts
  broken (`forge_broken`), repaired via wood+copper ore (R key near
  the forge), then usable.
- ~~Smithing has no UI.~~ **RESOLVED** — contextual recipe panel
  (`ui/smithingPanel.ts`) appears when standing near a repaired forge.
- ~~No way to actually feed the Hearth deliberately.~~ **RESOLVED** —
  dual stoke targets (fire directly / reserve), contextual Hearth panel
  (`ui/hearthPanel.ts`), see §5/§10a.
- ~~Hearth never actually ticked during play.~~ **RESOLVED** — found
  and fixed: `tickHearth` was fully built/tested but nothing in
  `main.ts` ever called it. A real `setInterval` game-tick loop now
  drives both `tickHearth` and Narag-Bund's hauling, every 1s.
- ~~Contextual UI panel pattern undecided.~~ **RESOLVED** — one
  reserved panel area, populated by proximity to known interactive
  objects, collapses to empty otherwise. Confirmed pattern for future
  discoverable UI sections.
