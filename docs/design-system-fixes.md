# Design system fixes

The page uses the Dukecodes Design System unchanged (`site/ds/`, hash-locked). Where a component doesn't fit, `site/app.css` or `site/app.js` patches it and marks the spot `DS fix`. This list is for `dukecodes-project-template`, where the design system is built. Each fix there lets this repo delete a patch.

Checked against v10 (`1792893432-6fee`) on 2026-10-25.

| Component | Problem | Patch here | Fix upstream |
|-----------|---------|------------|--------------|
| `CommandPalette` | The result kind column is 44px, too narrow for "concept". | `.rm-palette` in `app.css` widens it to 58px. | Size the column to the longest kind, or widen it. |
| `GateSimulator` | When a gate's name wraps to two lines (on phones), its "where" line drops below its neighbours'. | `app.css` lets the name take the spare height, so the lines stay level. | Let the name grow in the gate's column. |

## Fixed upstream
- v10: `StepCard` has a `readOnly` mode: a status mark instead of a checkbox, and the whole header is one button. It no longer clips. Rep cards use it.
- v10: `GateSimulator` takes skipped gates, zones, a log, `autoplay` and `play`. The page's own simulator is gone.
- v10: `CommandPalette` takes `hotkeys` (the page's "/"), `emptyHint`, `compact` and `--dk-kbtn-min`.
- v10: `ProgressRing` takes `hideLabel`, and its figure fits any size.
- v10: `LiveConsole` takes its last line from the scenario (`pass`) and sizes itself to the longest run.
- v10: `BentoCard` and `Flashcards` no longer clip.
- v9: `TopologyTrace` demo data carried private network addresses, which this repo's leak scan rejects. v9 uses documentation examples instead.

When a release fixes a row, delete the patch and the row in the same change.
