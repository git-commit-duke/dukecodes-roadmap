# Writing and design style

Every dukecodes repo looks and reads the same: Mission Control. The goal is that someone with no tech background can follow any page, and an interviewer can see how you think.

## Voice
- Plain English. Define every term the first time, or link the glossary.
- Short sentences. One idea each. Lead with what to do, then why.
- No "simply", "just", "obviously". If it were obvious, they wouldn't be reading.
- Say what you don't know. Label claims:

| Label | Means |
|-------|-------|
| `FACT` | Read in an official doc or verified by running it. Add the date or link. |
| `INFERENCE` | Reasoned from facts, not stated anywhere. |
| `ASSUMPTION` | A guess. Flag it so the reader can check. |
| `PROPOSAL` | A design idea, not a decision until approved. |

## Every step has four parts
1. **Why**: what goes wrong without it.
2. **Do**: exact command or click path. One copyable block.
3. **Check it worked**: what the reader should see.
4. **Undo**: how to get back.

Add a risk badge: `safe` (repeatable), `caution` (changes config you can undo), `destructive` (erases data), `danger` (can lock you out). Template: `docs/runbooks/_template.md` in `dukecodes-project-template`.

## Visual design
- Tokens and components: the Dukecodes Design System in `site/ds/` (`tokens.css`, `bundle.css`, `bundle.js`). The canonical copy is the design system's artifact, linked in `site/ds.lock.json`. Don't fork it; sync from there.
- Fonts: Bricolage Grotesque (headings), IBM Plex Sans (body), JetBrains Mono (labels, code).
- Colors carry meaning: amber = current / attention, teal = links and facts, green = done / safe, red = risk, violet = unverified or proposal.
- Light and dark both ship. Every text color needs a pair in `site/contrast.json`, and `scripts/check_site.py` fails any pair below WCAG AA: 4.5:1 for text, 3:1 for marks like bars and focus rings.
- Each repo's page is data, not code. In this repo the data is the roadmap itself: `milestones/`, `ledger.csv`, `certs.md`, `skills-matrix.md`, `glossary.md`, `labs.md` and `showcase.toml`. `roadmap build` turns it into `site/roadmap.json`, and `site/app.js` draws it with design-system components.
- Progress comes from git, never from a visitor's clicks, so this repo draws its own views instead of the template's project page. Where a component doesn't fit, the patch is marked `DS fix` and listed in [design-system-fixes.md](design-system-fixes.md). See [ADR 5](adr/0005-design-system-page.md).

## Roadmap formats
| File | Format | Checked by |
|------|--------|------------|
| `milestones/m<n>-<slug>.md` | Title, `**Key:**` lines, then six `##` sections in a fixed order. Reps: `- [ ] M1-R1 · do this · done when: test` | `roadmap check` |
| `ledger.csv` | `date,milestone,rep,kind,claim,evidence,verify`, one row per proof | `roadmap check` |
| `certs.md`, `skills-matrix.md` | One Markdown table each, exact headers | `roadmap check` |
| `glossary.md` | `- **Term**: definition.` in alphabetical order | `roadmap check` |
| `labs.md` | Two tables, exact headers. Labs: rep IDs, and a Resource link needs a Cost and a Checked date. Projects: `planned`, `building` or `shipped` | `roadmap check` |
| `concepts/<slug>.md` | From `templates/concept.md`; `**Reviewed:**` line once reviewed | `roadmap check` |

Motion respects "reduce motion". Every feature works without it.
