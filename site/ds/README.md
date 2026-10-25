Build interactive learning pages that feel like a control room: calm neutral surfaces, mono labels on everything, and one amber light that says *you are here*. Anything that can be shown moving is shown moving; anything that can be tried can be tried. Static text is the fallback.

## Interaction rules

1. **Motion carries state, never decoration.** A packet moves because traffic flows, a card sweeps amber because an agent is working, confetti fires because a stage was verified. Nothing loops for looks.
2. **Teach by breaking things.** Give every security idea a try-the-attack moment (GateSimulator) before the explanation.
3. **Answer every input within 100ms:** lift, glow, press or toast.
4. **Show success before the command runs.** Pair each command with its expected output (TerminalReplay, CodeBlock + expectation).
5. **Keep pause one click away.** Live components pause on a button (LiveConsole, SwarmBoard, TopologyTrace's Pause motion) and on hover, and stop on their own off-screen and in hidden tabs.
6. **Give the keyboard everything.** ⌘K / Ctrl K search, Space to flip, ← → to grade, Enter on map nodes, Esc to close. Every control shows the 2px `focus-ring`.
7. **Make reduced motion a full experience.** Under `prefers-reduced-motion` CSS motion, packets and pulses stop, typed and streamed text appears whole, and simulations change state without animating. Nothing hides behind motion.
8. **Celebrate verified progress only.** Call `Dukecodes.celebrate(el)` for a finished stage, a perfect deck or a clean deploy, never on load.
9. **Label simulations.** Live components fed demo data say "demo data" until they read real runs or saved ticks. Built-in demo data is fictional: documentation addresses (192.0.2.0/24, 198.51.100.0/24), a generic ISP and generic hardware, never a real network.

## Which component teaches what

| Learning job | Component |
|---|---|
| Hook a visitor in three seconds | LiveConsole |
| Show progress as motion | SwarmBoard, ProgressRing |
| Explain a network | TopologyTrace |
| Explain defense in depth | GateSimulator |
| Show what success looks like | TerminalReplay |
| Make it stick tomorrow | Flashcards |
| Decode jargon in place | GlossaryTerm |
| Find anything fast | CommandPalette |
| Sum up the value | BentoCard, StatTile |

## Content fundamentals

- **Voice:** a senior engineer pairing with you. Second person, imperative, short declarative sentences: "Tick as you go." "Copy anything precious before any step erases a drive."
- **Every step answers four questions:** why, what to type, how to check it worked, how to undo it.
- **Label every claim:** `FACT`, `INFERENCE`, `COMMUNITY`, `PROPOSAL`, `ASSUMPTION`; confidence `HIGH` / `MED` / `LOW`. Anything not confirmed by the owner stays marked unconfirmed.
- **Show risk before the click:** safe, caution, destructive or danger as a Chip in the step header.
- **Pair every red state with its fix.**
- Sentence case everywhere except mono eyebrows (UPPERCASE, 0.12em tracking). Real names and numbers; no marketing words, no emoji.

## Visual foundations

**Ground.** `bg-100` under a 24px (`space-9`) blueprint grid in `grid-line`. Put content on panels (`panel-100`, 1px `line-100`, `radius-xl`, `shadow-panel`); nest tiles in `panel-200`; never a panel inside a panel. Terminals, consoles and the swarm feed are dark in both themes: `code-bg` with the `code-*` colours.

**Colour is signal.**

| Token | Means | Small text on grounds and tints |
|---|---|---|
| `amber` | live, current, in flight: active stage, packet, 10G links, glows | `amber-strong` |
| `teal` | links, verified, where a command runs, 2.5G links | `teal-strong` |
| `green` | done, safe, passed, power | `green-strong` |
| `red` | danger, blocked, the LIVE dot | `red` |
| `violet` | unconfirmed, proposal, Tailscale | `violet` |
| `node-*` | node identity as a stripe or dot only | — |

Each signal hue has a `-soft` tint for callout and chip grounds. One amber thing shouts per view.

**Text pairs.** Set copy in `ink-100`, secondary copy in `ink-200`, small muted copy (eyebrows, IDs, captions, hop lists) in `ink-muted`. Keep `ink-300` for dotted underlines, idle borders and text 24px or larger. Put text on filled colours in `on-fill`; never white on `amber`. Every text pair in both themes holds at least 4.5:1.

**Focus.** 2px solid `focus-ring` (alias of `amber-strong`), 2px offset, on every control; on code surfaces the ring is `code-warn`. It holds at least 4.6:1 on every ground.

**Glow.** `shadow-glow-amber` marks live things (the hero console, the gate a packet is at); `shadow-glow-green` marks completion. Static cards never glow; BentoCards glow only under the pointer. `shadow-pop` lifts the palette and tooltips; `scrim` dims behind the palette.

**Type.** Bricolage Grotesque (`--font-display`, 700–800, −0.015em) for headings and big figures; IBM Plex Sans (`--font-body`, 15/1.55) for reading and `button` labels; JetBrains Mono (`--font-mono`) for every label, ID, chip, command and number that is data. The page loads all three from Google Fonts; outside it, add `https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,700;12..96,800&family=IBM+Plex+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500;700&display=swap`.

**Shape.** Radii grow with size: `radius-xs` 4 → `radius-sm` 6 → `radius-md` 9 → `radius-lg` 10 → `radius-xl` 14 → `radius-pill`.

**Motion timing.** Hover 150–200ms; state changes 250ms ease-out; packet hops 560–900ms per segment; card flip 550ms; count-up 900ms ease-out cubic; live feeds tick every 450–560ms; the LIVE dot pulses every 1.6s.

**Dark mode** is a full theme: near-black slate grounds, brighter signal hues, the grid at 3.5% white.

## Topology language

1G = 2px `ink-300`; 2.5G = 3px `teal`; 10G = 5px `amber`; dashed `violet` = Tailscale; dashed `red` = lab-only bridge; dotted `green` = UPS power; dashed box with TO BUY = hardware not owned yet. Each box carries a 4px `node-*` stripe; owned hosts show a pulsing `green` status dot. The packet is a 6px `amber` dot with glow; a blocked hop turns its link `red` and stamps an X at the midpoint.

## Iconography

Stroke icons at 2.4–3px in `currentColor`: search, check, cross, chevron, play. The brand mark is three stacked rack units in a 2px `ink-100` frame: `amber`, `teal`, `ink-300`. No emoji, no illustrations, no gradient fills beyond the glow.

## Using the components

Load `tokens.css`, `components/bundle.css`, React 18 and `components/bundle.js`, then mount from `window.Dukecodes`. `bundle.css` paints `body` with the blueprint ground. Component roots carry a `dk-` class and inner parts use short names scoped under them, so keep page CSS off bare class names such as `.grid` or `.b`. Live components take their content as data props (scenarios, stages, traces, attacks, cards, items), so the same parts power any guide.

## Intentional additions

Added beyond the source runbook, at the owner's request, for interactive learning: LiveConsole, GateSimulator, TerminalReplay, Flashcards, BentoCard, `celebrate()` and SwarmBoard's live simulation.
