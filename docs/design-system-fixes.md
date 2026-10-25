# Design system fixes

The page uses the Dukecodes Design System unchanged (`site/ds/`, hash-locked). Where a component doesn't fit, `site/app.css` or `site/app.js` patches it and marks the spot `DS fix`. This list goes upstream, to the design system's artifact (linked in `site/ds.lock.json`). Each fix there lets this repo delete a patch.

Checked against v10.3 (`1792897507-43e5`) on 2026-10-25.

No open fixes: the page patches no design-system class.

When a component doesn't fit, add a row here:

| Component | Problem | Patch here | Fix upstream |
|-----------|---------|------------|--------------|

## Fixed upstream
- v10.3: `CommandPalette` ranks the whole query typed as one run above scattered letters, and matches the kind as a run. "M3" now lists milestone M3 first, as the search hint promises.
- v10.2: `CommandPalette` sizes its kind column to the longest kind, so "concept" fits. The page's 58px patch is gone.
- v10.2: `GateSimulator` lets a gate's name take the spare height, so the "where" lines stay level when a name wraps on a phone. The page's patch is gone.
- v10: `StepCard` has a `readOnly` mode: a status mark instead of a checkbox, and the whole header is one button. It no longer clips. Rep cards use it.
- v10: `GateSimulator` takes skipped gates, zones, a log, `autoplay` and `play`. The page's own simulator is gone.
- v10: `CommandPalette` takes `hotkeys` (the page's "/"), `emptyHint`, `compact` and `--dk-kbtn-min`.
- v10: `ProgressRing` takes `hideLabel`, and its figure fits any size.
- v10: `LiveConsole` takes its last line from the scenario (`pass`) and sizes itself to the longest run.
- v10: `BentoCard` and `Flashcards` no longer clip.
- v9: `TopologyTrace` demo data carried private network addresses, which this repo's leak scan rejects. v9 uses documentation examples instead.

When a release fixes a row, delete the patch and the row in the same change.
