# Design system fixes

The page uses the Dukecodes Design System unchanged (`site/ds/`, hash-locked). Where a component doesn't fit, `site/app.css` or `site/app.js` patches it and marks the spot `DS fix`. This list is for `dukecodes-project-template`, where the design system is built. Each fix there lets this repo delete a patch.

Checked against v9 (`1792886826-addb`) on 2026-10-25.

| Component | Problem | Patch here | Fix upstream |
|-----------|---------|------------|--------------|
| `StepCard` | Always shows a checkbox, so any visitor could tick a rep. Progress here must come from git. | `RepCard` in `app.js` borrows its classes and shows a read-only status mark. | A `readOnly` prop, or a controlled `done` with no checkbox. |
| `StepCard` | `overflow: hidden` cuts off glossary popups. The header is a clickable `div`; only the small arrow is a real button, so keyboard users get a much smaller target. | `RepCard` makes the whole header one `button`; `.rm-rep` in `app.css` lets content overflow. | Let content overflow; make the whole header one `button`. |
| `GateSimulator` | No skipped gates and no log, so it can't show `--no-verify` slipping past the hooks and getting caught in CI. | `Simulator` in `app.js`, drawn with the system's gate, track and packet classes. | A list of skipped gates per attack, and an optional log. |
| `LiveConsole` | Ends every passing run with a hard-coded "deployed to lab" line. Its fixed 168px minimum height fits its own demo, so a longer run makes the box grow as lines type in. | `app.css` hides the extra line and sizes the box from `--rm-lines`, which `app.js` sets. | Take the last line from the scenario; size the box from the line count. |
| `CommandPalette` | The no-match hint names a Minirack step (`pve-11`). The trigger is at least 260px wide, too wide for a phone header. The 44px kind column is too narrow for "concept". | `.rm-palette` in `app.css` swaps in the roadmap's own hint and narrows the trigger. | An `empty` prop for the hint, a narrower trigger on small screens, a wider kind column. |
| `CommandPalette` | Opens only from its own button or hotkey; there is no `open` prop. | None. The glossary's empty state names the shortcut instead. | An `open` and `onOpenChange` pair. |
| `ProgressRing` | At 34px the label doesn't fit inside the ring. | `.rm-hring` hides it visually; screen readers still get it. | Hide the visible label below a size threshold. |
| `BentoCard` | `overflow: hidden` cuts off glossary popups. | `.dk-glow` in `app.css` lets them overflow and keeps the glow's rounded corners. | Let content overflow. |
| `Flashcards` | A fixed 170px height cuts off longer answers. | `.rm-flashwrap` in `app.css` sets 250px and scrolls inside the card. | Grow to fit, or scroll inside the card. |

## Fixed upstream
- v9: `TopologyTrace` demo data carried private network addresses, which this repo's leak scan rejects. v9 uses documentation examples instead.

When a release fixes a row, delete the patch and the row in the same change.
