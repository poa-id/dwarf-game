# Visual asset audit

Living art-direction checklist for map sprites. The grid remains the collision
and placement skeleton; rendered structures may extend across that footprint
when a stronger silhouette or composition needs it.

## Direction

- Match the crisp, dense rendering of `hearth_4x4`, `forge_4x4`, and
  `gemcutting_4x4`.
- Structure sprites should fill their declared tile span and remain readable at
  the game's normal zoom.
- Transparent backgrounds must use hard, clean alpha edges. Avoid partially
  transparent visible pixels that make structures look ghostly.
- Prefer dark stone and blackened metal with restrained warm or material-color
  highlights. Important silhouettes should not disappear into rock floors.
- Preserve a visually obvious approach/entrance wherever the collision layout
  expects the player to interact.

## Audit queue

| Priority | Asset | Finding | Proposed treatment | Status |
| --- | --- | --- | --- | --- |
| P0 | Trading Post | Original 5×5 asset occupied too little of its canvas, was bottom-heavy and too dark against the floor. It read as a translucent decorative blob rather than a major room landmark. | Larger square market silhouette, stronger local contrast, clean alpha, visible front entrance. | Replaced by `trade_post_v2.png` |
| P1 | Narag-Bund | Original left much of the 4×4 canvas empty and its tonal mass was softer than nearby structures. | Larger coal-black armored silhouette, distinct legs/head, cargo role made explicit. | Replaced by `narag_bund_v2.png` |
| P1 | Oxen / Siginhakhd | Original had low canvas occupancy and a soft edge read. | Larger garden-worker silhouette with horns, seeds, herbs and tools readable at 3×3. | Replaced by `oxen_v2.png` |
| P1 | Turbine | Reads clearly but has a brighter white steam plume and a different rendering density from the Forge machinery. | Harmonize palette and pixel density; preserve animation-like steam cue. | Queued |
| P2 | Sawmill | Original was dark and visually flat at normal zoom despite a useful square footprint. | Strong saw focal point, separated timber/metal materials and broad grounded base. | Replaced by `sawmill_v2.png` |
| P2 | Smelter add-on | Strong orange focal point, but its tall rectangular composition competes with its declared 3×3 footprint. | Recompose around a broader base or revise span/anchor. | Queued |
| P2 | Mountain Console | Crisp enough, but much less detailed and lower-contrast than the newest hero structures. | Keep silhouette; enrich screen/rune focal area. | Queued |
| P3 | Drills | Copper/iron/deep variants do not share perfectly consistent footprint and visual density. | Normalize silhouette scale while keeping metal identity. | Queued |
| P0 | Player dwarf | Original 32×32 silhouette was narrow, noisy and easy to lose at map distance. | Broad helmet/shoulder silhouette, high-contrast beard and one amber light cue. | Replaced by `dwarf_v2.png` |

## Completed trials

### Trading Post v2

- Generated as a new transparent-background asset using the original Trading
  Post for subject continuity and Hearth/Forge as strict style references.
- Downsampled to the existing native 160×160 (5×5 tiles) contract.
- Alpha thresholded after resize so visible pixels remain solid and edges do
  not become ghostly.
- Integrated non-destructively; the original `trade_post.png` remains in the
  repository for direct comparison or rollback.

### Readability pass: dwarf, Sawmill and companions

- Each asset was generated independently from its original identity reference,
  using Hearth/Forge/Trading Post v2 as the shared art-direction references.
- Every result was reduced to its actual renderer contract (32×32, 96×96 or
  128×128), sharpened once, alpha-thresholded, and compared side-by-side at
  native scale before integration.
- Original assets remain available for rollback.
