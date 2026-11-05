# 7. The labs page holds the whole security plan

Status: accepted
Date: 2026-11-04

## Context
The labs research (practice resources, capstones, trial clocks and the order to work in) lived in a separate document, while the roadmap page showed only the Labs and Projects tables from ADR 6. Two places drift: a price or a trial length fixed in one stays wrong in the other. The roadmap is meant to be the one page that grows as the work does, so the research belongs in its sources, under the same checks as the rest.

## Decision
- `labs.md` gets five more sections, in page order: **Start here** (the top picks, in milestone order, each with the evidence it leaves), **Practice** (courses, ranges and tools, each with an area, cost, time, a 1 to 5 job value and a label), **Capstones** (several labs joined into one piece of work, with the project it ships in and the interview question it answers), **Clocks** (deadlines and trial lengths) and **Choices to make**.
- `certs.md` keeps its Ladder table and gains **Skipped for now** and **Choices to make**. Both are one-line `- ` bullets, so the page can show all of each.
- No status is typed by hand. A Start here step, a capstone and a practice row take their status from the ticks of their reps, as labs do.
- `roadmap check` fails a missing section, a rep that doesn't exist, a Start here step out of milestone order or without evidence, a practice link that isn't https, an area outside the fixed list, a missing cost or time, a value outside 1 to 5, a `FACT` row without a link and a Checked date, a Checked date in the future, a resource listed twice or already a lab's resource, a capstone that ships in an unlisted project, clocks out of order (dates first, earliest first, then lengths) and anything but one-line bullets under Choices to make or Skipped for now.
- The page counts the days to a clock in the browser. `roadmap.json` holds only the date, so a build stays deterministic and no check fails because a day passed. A passed clock shows as passed until its row is deleted.
- The Labs and Certs views draw each section under its own id with an "On this page" list. A rep card lists its practice resources, and the search covers practice, capstones and clocks.

## Pros
- One source for every lab, course, price and deadline, with the same freshness rule as certs.
- The order to work in and the trial clocks sit next to the reps they serve, so a trial isn't started before the VM is ready.
- A new resource is one table row; the checks catch a bad link, a stale date or a rep that was renamed.

## Cons
- Value is a judgment (INFERENCE), not a measurement. The legend says so, and the check only enforces the scale.
- More tables to keep current. A passed clock stays on the page until someone deletes its row.
- labs.md is long. The page's section links make it easier to read than the file.

## Alternatives considered
- Keep the research as a separate document: two copies of each price and date, and nothing checks the document.
- More columns in the Labs table: one lab has many resources, so the rows would grow past what a table can show.
- Count the days at build time: `roadmap.json` would change every day and `build --check` would fail in CI without a source change.
- A computed value score: there is no data source for job value, so a number would look more certain than it is.
