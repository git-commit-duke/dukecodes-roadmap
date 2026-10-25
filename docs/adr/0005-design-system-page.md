# 5. Showcase page on the Dukecodes Design System

Status: accepted
Date: 2026-10-25

Supersedes [ADR 3](0003-showcase-page.md).

## Context
Every dukecodes repo now shares one design: the Dukecodes Design System (DS). It is a set of React components, design tokens and a contrast kit, published as a claude.ai artifact; each repo hash-locks its own copy. ADR 3's page had its own renderer and copied CSS, so it would drift further from the DS with every release. Repos also stay separate: one repo may read another but never edits it. So the DS is copied in, not linked.

## Decision
- The page is plain files in `site/`: `index.html`, `theme.js`, `app.js`, `app.css` and `favicon.svg`. The DS sits in `site/ds/` and React 18.3.1 in `site/vendor/`. `app.js` builds every view from DS components with `React.createElement`. There is no bundler and no build step for the page.
- `roadmap build` writes data only: `site/roadmap.json` and the README scoreboard. `app.js` fetches that JSON from its own folder.
- `site/ds/` is copied unchanged from the design system's artifact, and `site/vendor/` from the React npm tarballs. `site/ds.lock.json` records each file's SHA-256, so an edited or extra file fails the page check.
- The Content-Security-Policy is the template's, word for word. Scripts load from this site only, and none are inline. Styles come from this site and Google Fonts. Trusted Types is on with no policies, so the browser refuses to turn any string into HTML or script.
- `scripts/check_site.py`, copied from the template, enforces this on every commit: the exact CSP, the lock hashes, no HTML or code sinks in any page script (the DS bundle included), `fetch` only to relative files, CSS that loads nothing, and WCAG AA contrast for every text colour in both themes (`site/contrast.json`).
- Where a DS component can't do the job, the page builds its own from DS classes and tokens, prefixed `rm-`, and lists the gap in [design-system-fixes.md](../design-system-fixes.md) so the design system can close it. At first that meant the gate simulator with its skip lane, read-only rep cards and the walkthrough deck. DS v10 (2026-10-25) closed the first two gaps, so the deck is the only one left.

## Pros
- One look across every repo. A DS release arrives as a copy plus a hash check.
- The same security story as ADR 3, now enforced twice: by a script at commit time and by the browser at runtime.
- `app.js` is plain JavaScript that anyone can read without a toolchain.

## Cons
- The page needs a web server (`make preview`), because browsers block `fetch` on a `file://` page.
- React joins the supply chain. It is one pinned version, vendored and hash-locked, and never fetched from a CDN.
- `ds/bundle.js` is minified code built in another repo. The page check scans it for sinks here. Semgrep skips it, because a finding there can only be fixed in the template.

## Alternatives considered
- Keep ADR 3's single-file page: it drifts from the DS with every release.
- Load the DS from its published artifact at runtime: breaks repo isolation and the CSP, and this page would change whenever that one does.
- Inline the data in `index.html`: the CSP would need a new hash on every build. A static `index.html` plus a JSON file keeps the policy identical to the template's.
