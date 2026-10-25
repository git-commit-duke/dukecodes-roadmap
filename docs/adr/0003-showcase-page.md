# 3. One self-contained showcase page with a strict CSP

Status: superseded by [ADR 5](0005-design-system-page.md)
Date: 2026-10-24

## Context
The showcase must look and behave like Mission Control, the shared dukecodes design, and it may become public. A portfolio page for a security role is itself a security sample: interviewers can open dev tools.

## Decision
- `roadmap build` writes one file, `site/index.html`, with the CSS, the data and the script inlined.
- A Content-Security-Policy pins the inline style and script by SHA-256 hash. Only Google Fonts may load from outside. No third-party scripts.
- The policy also turns on Trusted Types, so the browser itself refuses any attempt to parse a string as HTML.
- The renderer (`site/src/roadmap.js`) builds every element with `createElement` and `textContent`. Markdown is turned into safe tokens in Python first; only `https` links and repo paths survive.
- Design tokens and components are synced unchanged from `dukecodes-project-template` (`site/assets/`). Roadmap-only styles live in `site/src/roadmap.css`, prefixed `rm-`.
- The shared `mc.js` renderer isn't used here. Its progress ticks live in each visitor's browser, but roadmap progress has to come from git, where it is checked. It also writes inline `style` attributes, which this CSP blocks.

## Pros
- Works offline, from a file, on GitHub Pages or as a Claude artifact, with the same bytes.
- An XSS bug in the renderer would be blocked twice: no HTML parsing of data, and Trusted Types.
- Deterministic output, so CI can prove the page matches the source files.

## Cons
- Any change to the CSS or script changes its hash. The build recomputes it, so editing `site/index.html` by hand breaks the page on purpose.
- A second renderer to maintain next to `mc.js`. Shared class names keep the look in sync.

## Alternatives considered
- Reuse `mc.js` with a generated `project.json`: loses git-backed progress and the strict CSP.
- A framework (React, Svelte): more power than one page needs, plus a build chain and a supply chain to audit.
