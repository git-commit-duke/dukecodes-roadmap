# 6. Security labs and projects as data

Status: accepted
Date: 2026-11-04

## Context
Readers want one place that lists every security lab on the roadmap and the projects that ship them. The labs already exist, spread across ten milestone files as reps. Some follow an outside course, such as the free CrowdSec Academy courses, and that course's link and price can change, like a cert's. The roadmap's main rule still holds: progress is measured, not claimed, and a skill that isn't proven yet becomes a lab, never a resume line.

## Decision
- `labs.md` holds two tables. **Labs** groups existing rep IDs under a name, with the tools, an optional outside course or guide, its cost and the day the link and price were checked. **Projects** lists each repo with its milestones, what it is, the security built in and a status: `planned`, `building` or `shipped`.
- A lab has no status column. The build derives it from the ticks of its reps: done, in progress or planned.
- `roadmap check` fails a rep or milestone that doesn't exist, a link that isn't https, a linked resource without a cost or a Checked date, a Checked date in the future, and a `shipped` project without a ledger row (kind `project`) that names it.
- The page gets a Labs view with both tables and an overview section with one card per project. A rep card names its lab and links the course.
- A private repo is listed without a link. A repo whose name would identify a personal machine is listed by its role instead.

## Pros
- One view of the security work, with no second place to tick things: the reps stay the only source of progress.
- Outside courses get the same freshness rule as certs, so a stale price shows its date.
- The research and gap work has a home: a new lab is a table row plus its reps.

## Cons
- A lab's name and grouping are chosen by hand, so a rep can sit in the wrong lab. `roadmap check` only proves the rep exists.
- A project's "Security built in" text is a claim until the repo backs it. A `shipped` status needs proof; the text in a `building` row does not.

## Alternatives considered
- A status column typed by hand: it drifts from the reps and can claim more than the ledger proves.
- Tags on each rep line, such as `[lab: CrowdSec]`: no one-page view, and longer rep lines in every milestone.
- Outside courses in `certs.md`: a course completion certificate is not an industry cert, and mixing them would muddy the cert ladder's totals.
