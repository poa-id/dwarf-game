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
| P1 | Narag-Bund | Detailed silhouette, but much of the 4×4 canvas is empty and its tonal mass is softer than nearby structures. | Reframe larger; reinforce head/carapace contrast without changing character identity. | Queued |
| P1 | Oxen / Siginhakhd | Similar low canvas occupancy and soft edge read; can feel pasted over the garden rather than present in it. | Reframe and add a restrained contact shadow/base cue. | Queued |
| P1 | Turbine | Reads clearly but has a brighter white steam plume and a different rendering density from the Forge machinery. | Harmonize palette and pixel density; preserve animation-like steam cue. | Queued |
| P2 | Sawmill | Dark and visually flat at normal zoom despite a useful square footprint. | Raise wood/metal separation and focal lighting. | Queued |
| P2 | Smelter add-on | Strong orange focal point, but its tall rectangular composition competes with its declared 3×3 footprint. | Recompose around a broader base or revise span/anchor. | Queued |
| P2 | Mountain Console | Crisp enough, but much less detailed and lower-contrast than the newest hero structures. | Keep silhouette; enrich screen/rune focal area. | Queued |
| P3 | Drills | Copper/iron/deep variants do not share perfectly consistent footprint and visual density. | Normalize silhouette scale while keeping metal identity. | Queued |

## Completed trials

### Trading Post v2

- Generated as a new transparent-background asset using the original Trading
  Post for subject continuity and Hearth/Forge as strict style references.
- Downsampled to the existing native 160×160 (5×5 tiles) contract.
- Alpha thresholded after resize so visible pixels remain solid and edges do
  not become ghostly.
- Integrated non-destructively; the original `trade_post.png` remains in the
  repository for direct comparison or rollback.
