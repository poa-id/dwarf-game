# The Mine Shaft

An independent upgrade path from the room-restoration system — repairing and deepening the shaft is what actually makes new ore veins accessible in the Mine room, separate from any Mining-level gate on the veins themselves.

| Depth | Label | Repair/dig cost | Insight cost | Unlocks |
|---|---|---|---|---|
| 0 | Broken Shaft | — | — | Nothing yet |
| 1 | Shaft Restored | 30 Wood, 10 Copper Ingot, 5 Iron Ingot | 400 | Coal Drill buildable. All existing veins (copper/iron/coal/deepstone) accessible. Drill cycle speed +10% |
| 2 | First Deep | 20 Iron Ingot, 8 Deepstone Ingot, 5 Ironwood | 2,000 | Starstone ore *(vein not yet placed — see below)* |
| 3 | Second Deep | 20 Deepstone Ingot, 5 True Iron, 2 True Deepstone | 5,000 | Future tier — unbuilt |

## Starstone

Depth 2 promises a new vein, but as of now this is a pure stub: the `starstone_ore` and `starstone_ingot` materials exist in the data model, but there's no `RockNode` for it, no vein placement on the map, and no smelt recipe. Reaching depth 2 currently unlocks nothing playable yet.
