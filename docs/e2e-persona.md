# End-to-end: one week in Maya's graph

A persona-driven acceptance run of the builder against a seeded DB graph, in the installed desktop
app (second instance, `test-logseq-desktop`). The point is not "does each control work" (the unit
and headless suites cover that) but "can a person who keeps their life in an outliner get the
answer they came for, and does the thing they insert keep answering it".

Expected counts are written **before** the run from the seed design below; `scripts/seed-persona.mjs`
builds the graph (`qb-e2e-persona`) and prints the engine's own count for every scenario so a wrong
expectation is caught before the UI is blamed. Observed results and findings are appended as the
run proceeds; every finding becomes a `TASKS.md` item with a failing test before it is fixed.

## Persona

**Maya**, an independent UX researcher. Journals daily; each day's entry nests meeting notes,
decisions and tasks under the meeting they came from. Keeps one page per client project, person
and book. Tags are her schema: `Project` (with a `Client Project` sub-tag), `Person`, `Meeting`,
`Book`, `Idea`, and the built-in `Task`. She reaches for the builder when a question is one hop
past what search gives her: "which open tasks are due this week", "what did I decide with Alice",
"which ideas never attached to a project".

"Today" in the run is **2026-10-09**.

## Seed (what the graph holds)

Tags and their properties

| Tag | Properties |
|---|---|
| Project | ProjStatus (text) · DueDate (date) · Budget (number) |
| Client Project | extends Project |
| Person | Company (text) · Role (text) |
| Meeting | With (node, many) |
| Book | Author (text) · Rating (number) · Finished (checkbox) |
| Idea | — |

Pages

| Page | Tag | Values |
|---|---|---|
| Project Atlas | Project | Active · due 2026-10-20 · 12000 |
| Project Beacon | Client Project | Active · due 2026-10-12 · 30000 |
| Project Comet | Project | On hold · due 2026-11-15 · 5000 |
| Project Dune | Client Project | Done · due 2026-09-30 · 8000 |
| Website Refresh | Project | Active · (no due date) · (no budget) |
| Alice Nguyen | Person | Northwind · PM |
| Bob Osei | Person | Northwind · Designer |
| Chen Wei | Person | Acme · CTO |
| Dana Ruiz | Person | (no company) · Freelancer |
| The Design of Everyday Things | Book | Don Norman · 5 · finished |
| Thinking, Fast and Slow | Book | Daniel Kahneman · 4 · not finished |
| Just Enough Research | Book | Erika Hall · 4 · finished |
| Sprint | Book | Jake Knapp · 3 · not finished |
| Range | Book | David Epstein · (no rating) · not finished |

Blocks (indentation = outline nesting; `T:` = Task with status · priority · deadline)

```
Oct 6th, 2026
  Met with [[Alice Nguyen]] about [[Project Atlas]]            #Meeting  With: Alice
    Decision: ship the research readout by Friday
    Alice wants the budget revisited                           #Idea
  T: Send Atlas report to [[Alice Nguyen]]                     todo · High · 2026-10-10
  Reading [[Thinking, Fast and Slow]]: system 1 notes
Oct 7th, 2026
  Call with [[Chen Wei]] on [[Project Beacon]] scope           #Meeting  With: Chen
    Decision: cut the mobile scope
  T: Draft Beacon interview guide                              doing · Medium · 2026-10-14
  T: Invoice [[Project Dune]]                                  done · Low
  Idea: a template for research readouts, for [[Project Beacon]]   #Idea
Oct 8th, 2026
  Workshop with [[Alice Nguyen]] and [[Bob Osei]]              #Meeting  With: Alice, Bob
    Decision: run 5 interviews next week
    T: Recruit 5 participants for [[Project Atlas]]            todo · High · 2026-10-15
  T: Renew [[Sprint]] library loan                             todo · Low · 2026-11-01
  Thought on [[Range]]: breadth beats depth early
Oct 9th, 2026
  T: Review [[Project Comet]] hold decision                    todo · Medium
  Decision pending on Comet
Project Atlas (page)
  Goals
    Understand onboarding drop-off
  T: Synthesize interview notes                                todo · High · 2026-10-11
  Related: [[Project Beacon]] shares the participant pool
Project Beacon (page)
  T: Kickoff deck                                              done
  Stakeholders: [[Chen Wei]]
```

## Scenarios

Each row is a question Maya would ask, how she would build it, and the count the seed implies.
"CLI" marks the ones the emitter can be checked on the CLI graph (`npm run probe -- qb-e2e-persona`);
relative dates only resolve in the host, so those are checked live only.

| # | Maya asks | Built as | Expected | CLI |
|---|---|---|---|---|
| S1 | What is still on my plate? | Task · Status does not contain Done | 6 | yes |
| S2 | High-priority work due in the next week | Task · Priority contains High · Status does not contain Done · Deadline on or before +7d | 3 (Send Atlas, Synthesize, Recruit) | live |
| S3a | Everything that mentions Atlas | links to · Project Atlas | 2 (Oct 6 meeting, Recruit task) | yes |
| S3b | …including the notes nested under those mentions | ancestor links to · Project Atlas | 4 (the two mentions, plus Decision and Alice wants… under the Oct 6 one) | yes |
| S3c | What is on the Atlas page | on page under · Project Atlas | 4 | yes |
| S4 | Meetings with Alice | Meeting · With contains Alice Nguyen | 2 | yes |
| S5 | Decisions I wrote down | content starts with "Decision:" | 3 | yes |
| S6 | Good books I have not finished | Book · Rating greater than 3 · Finished is false | 1 (Thinking, Fast and Slow) | yes |
| S6b | Books I never rated | Book · Rating is empty | 1 (Range) | yes |
| S7a | Active projects, client ones included | Project (inherit on) · ProjStatus contains Active | 3 | yes |
| S7b | …only the ones I tagged Project myself | same, inherit off | 2 | yes |
| S7c | Client projects | Client Project | 2 | yes |
| S8a | Projects with no due date | Project · DueDate is empty | 1 (Website Refresh) | yes |
| S8b | Big projects | Project · Budget greater than 10000 | 2 | yes |
| S9a | Projects due before November | Project · DueDate before 2026-11-01 | 3 | live (date literal) |
| S9b | Projects still ahead of me | Project · DueDate after today | 3 (Atlas, Beacon, Comet) | live |
| S10 | Ideas that never attached to a project | Idea · NOT links to · any Project | 1 (Alice wants the budget revisited) | yes |
| S11a | People at Northwind | Person · Company contains Northwind | 2 | yes |
| S11b | People with no company on file | Person · Company is empty | 1 (Dana) | yes |
| S12 | Notes that mention anyone from Northwind | links to · any Person whose Company contains Northwind | 3 (Oct 6 meeting, Send Atlas report, Oct 8 workshop) | yes |
| S13 | What the Atlas page points at | is linked from · Project Atlas | 2 (Project Beacon; Oct 20th, 2026 through DueDate: a date value is a link to its journal page) | yes |
| S14 | Tasks on the Atlas page | Task · on page under · Project Atlas | 1 (Synthesize) | yes |
| S15a | Everything I wrote on Oct 8 | scope: on page Oct 8th, 2026 | 5 | yes |
| S15b | …just the tasks | same · Task | 2 | yes |
| S16 | Blocks shaped like an idea | content matches `^Idea:` | 1 | yes |
| S17 | Anything with a tag on it that is not a task | any tag · NOT Task | 3 meetings + 2 ideas + pages carrying tags | yes (count from seed script) |

Then, with the panel:

| # | Flow | Expect |
|---|---|---|
| F1 | Build S2 by keyboard only (⌘⇧F from a journal block, tag, ⇧↩ rows, ⌘↩) | inserted sibling renders "Live query (3)"; read-back is the name |
| F2 | Reopen the inserted S2 block with ⌘⇧F | same chips, same rows, 3 results; Insert rewrites in place |
| F3 | Build S12 (filtered tag target) from `/Query Builder` in a block, insert | block becomes the query, 3 rows in the host table |
| F4 | Reopen F3's block | the target condition row is restored |
| F5 | Click a result row | host navigates to the block, panel stays open |
| F6 | Toggle Show Datalog on S6 | the text is the emitter's output, with embedded idents |
| F7 | Light → dark theme while the panel is open | tokens follow the host |
| F8 | Resize the panel small | footer stays visible; the body scrolls |
| F9 | Each scenario's read-back | reads as an English sentence a non-developer would accept as "what I asked" |
| F10 | Result rows | show the page the node lives on and the values of the filtered properties |

## Run log

### Seed and emitter (2026-10-09)

`node scripts/seed-persona.mjs` builds `qb-e2e-persona` in ~2 min. Engine counts agree with the
design for every scenario; three expectations were corrected on the way, and each correction is
either a fact about Logseq's data model worth knowing or a design definition:

- **S3b = 4, not 2.** *ancestor links to* was defined in FEAT-44 as the mentions themselves and
  everything nested under them, not the nested nodes alone.
- **S13 = 2, not 1.** A date property's value is the journal page, and the page is in
  `:block/refs`, so *is linked from Project Atlas* lists `Oct 20th, 2026` beside `Project Beacon`.
  Defensible (a due date *is* a link to that day); kept.
- **S3c stays 4 but the raw engine says 5:** a text property value (`ProjStatus` "Active") is an
  entity on the Atlas page with `:logseq.property/created-from-property`. The emitter already
  excluded those for *on page under*; the content search and the *on page* scope did not →
  **BUG-10**, fixed with unit tests and two probes (`contains "active"` and `contains "urgent"`,
  the latter a built-in closed value) that now return 0.

CLI facts met while seeding (CLI 533ac43, 2026-10-09), not plugin findings: `upsert task` creates
only under a page (nested tasks are a child block converted with `upsert task --id`); a date value
must be a journal page's db/id; `upsert block --id … --update-properties` recomputes `:block/refs`
from the properties alone and drops the content's `[[links]]`, so properties go on the create call;
a built-in title collision (`Status`, `Due`) is refused for user properties.

`npm run probe -- qb-e2e-persona`: 28 / 28 (every CLI-checkable scenario plus the two regressions).

### Panel, first contact (2026-10-09, Logseq-DB 2.0.2 second instance, 980×700 window)

Opened from the command palette ("Query Builder: open"); the CDP-synthesised `⌘⇧F` does not reach
the host keybinding (not a plugin matter; the shortcut was verified by hand on 2026-09-26).
Driving the real pickers by mouse surfaced three things before S1 could be built:

- **BUG-9.** After a tag pick, the re-rendered picker took focus back and reopened the full tag
  list over the Filters row; the body scrolled to it; the next click landed on the list.
- **BUG-11.** The forced focus at 50/300/800 ms after opening stole focus from a control the user
  had already reached, which reopened the list again after the BUG-9 fix.
- **FEAT-50.** The host restored a layout saved on a bigger window: the panel's bottom 60 px,
  Insert included, sat below the window. Inline position is ignored once a layout is saved, so the
  cap is a stylesheet computed from measured rects on every show.

S1 after the fixes, built by mouse: read-back "Task nodes where Status is not Done", 6 nodes,
each with its status and page.

Then, with "+ add a reference" clickable, the next scenario still could not start:

- **BUG-12.** The panel opens with the tag picker focused and its whole list open, hanging over
  "+ add a filter" and "+ add a reference"; a first click on either picks a tag. The tag picker now
  opens on typing or ↓ only.
- **BUG-13.** "Insert as query block" wrapped onto two lines at the default width.

### Scenarios through the panel (2026-10-09)

Every scenario built with the real pickers by mouse, in a 1400×1000 viewport; the count the panel
shows against the design, and the read-back as shown in the name field:

| # | Count | Read-back |
|---|---|---|
| S1 | 6 ✓ | Task nodes where Status is not Done |
| S2 | 3 ✓ | Task nodes where Priority is High and Status is not Done and Deadline is on or before 7 days from now |
| S3a | 2 ✓ | all nodes that link to Project Atlas |
| S3b | 4 ✓ | all nodes that have an ancestor linking to Project Atlas |
| S3c | 4 ✓ | all nodes that are on a page under Project Atlas |
| S4 | 2 ✓ | Meeting nodes where With is Alice Nguyen |
| S5 | 3 ✓ | all nodes where text starts with "Decision:" |
| S6 | 1 ✓ | Book nodes where Rating is greater than 3 and Finished is false |
| S6b | 1 ✓ | Book nodes where Rating is empty |
| S7a | 3 ✓ | Project nodes where ProjStatus is Active |
| S7b | 2 ✓ | same, sub-tags off |
| S7c | 2 ✓ | Client Project nodes |
| S8a | 1 ✓ | Project nodes where DueDate is empty |
| S8b | 2 ✓ | Project nodes where Budget is greater than 10000 |
| S9a | 3 ✓ | Project nodes where DueDate is before 1 Nov 2026 |
| S9b | 3 ✓ | Project nodes where DueDate is after today |
| S10 | 1 ✓ | Idea nodes that do not link to any Project |
| S11a | 2 ✓ | Person nodes where Company is Northwind |
| S11b | 1 ✓ | Person nodes where Company is empty |
| S12 | 3 ✓ | all nodes that link to any Person whose Company is Northwind |
| S13 | 2 ✓ | all nodes that are linked from Project Atlas |
| S14 | 1 ✓ | Task nodes that are on a page under Project Atlas |
| S15a | 5 ✓ | all nodes on Oct 8th, 2026 |
| S15b | 2 ✓ | Task nodes on Oct 8th, 2026 |
| S16 | 1 ✓ | all nodes where text matches /^Idea:/ |
| S17 | **185 → 27** | any tag and not Task nodes — **BUG-14**: property pages (128), tag pages (24), built-ins and closed values all carry a tag; fixed in the emitter, 27 after |

Result rows carry the page they live on and the values of the filtered properties (S2: "Priority:
High · Status: Todo · Deadline: 2026-10-15"). Esc with a picker's list open closes the list; a
second Esc closes the panel (observed on S9b; documented behaviour).

### Keyboard only (2026-10-09)

- **F1.** Editing a journal block, `⌘⇧F` opens with the cursor in the tag picker. Typed `task` ↩,
  `⇧↩` (cursor in the new row's property picker), `prio` ↩ (operator picker, *contains any*
  preselected) ↩ (value picker) `hi` ↩; `⇧↩` `stat` ↩ `does not` ↩ `done` ↩; `⇧↩` `dead` ↩
  `on or before` ↩ `+7d` ↩. Read-back "Task nodes where Priority is High and Status is not Done
  and Deadline is on or before 7 days from now", 3 nodes. `⌘↩` closed the panel and inserted a
  sibling of the edited block, named by the read-back, rendering "Live query (3)". No mouse.

### Insert and round trip (2026-10-09)

- **F3.** A new block on Oct 9th, `/Query Builder` → panel in slash mode ("Write into this block"),
  S12 built, named "Notes mentioning Northwind people", Insert. The block carries the `Query` tag,
  `:logseq.property/query` with the emitted Datalog, the hidden state property, and the host
  renders "Live query (3)" with the three expected rows.
- **F4.** Editing that block and pressing `⌘⇧F` reopens the builder with the "any Person" chip, the
  "Company is Northwind" condition, the name, 3 nodes and "Write into this block". Opening from the
  command palette instead gives a fresh builder: the palette takes focus from the editor before the
  command runs, so no block is captured. Not a plugin matter, but worth one line in the cheatsheet:
  *reopen with the shortcut, not the palette.*

### Panel behaviour (2026-10-09)

- **F5.** Clicking "Just Enough Research" in a Book query routed the host to that page; the panel
  stayed open with its 5 results.
- **F6.** *datalog* shows the emitted block text with embedded idents (S1, S2, S12 captured above).
- **F7.** Mode light → dark → light: `--qb-bg`/`--qb-fg` went `#ffffff`/`#1d1d1f` → `#1c1c1e`/
  `#f5f5f7` → back, each equal to the host's `--ls-primary-background-color`.
- **F8 / FEAT-50.** At the real 980×700 window with the saved 770×617 layout at top 145 px, the
  stylesheet cap (`max-height: 539px`) left the panel's bottom at 684 px and the Insert button at
  646 px: on screen. The footer stays put and the body scrolls (BUG-5 still holds).
- **F9.** Read-backs read as sentences throughout (table above); the only one a newcomer might
  misread is a bare "same, sub-tags off" being indistinguishable from the inherited form (S7a vs
  S7b: both "Project nodes where ProjStatus is Active"). Noted, not changed: the chip shows the toggle.
- **F10.** Rows carry the page and the filtered properties' values (S2 shows priority, status and
  deadline; S1 the status).

### Summary

26 scenarios and 10 flows, all passing after fixes. Found and fixed, each with a failing test first:
BUG-9 (list reopens after a pick), BUG-10 (property values returned as nodes), BUG-11 (focus
steal on open), BUG-12 (open list covers the zones below), BUG-13 (Insert label wraps), BUG-14
("any tag" matches the schema), BUG-15 (content operator lost before text), FEAT-50 (panel capped
to the viewport). Unit suite 150 → 162 tests; CLI probes 7 → 33 fixtures.

Not changed, recorded: Esc closes an open list before the panel; the command palette cannot reopen
on a block (focus leaves the editor), the shortcut can; a date value is a link to its journal page
(*is linked from* lists it); *ancestor links to* includes the linking nodes themselves.

What the run did not cover: the Library scope on this graph (no Library pages seeded; the CLI
probes on `Library-Test` cover the clause), assets, datetime *between*, a graph large enough to
need "Show more", a real-mouse drag of the panel.

## Re-running

1. `node scripts/seed-persona.mjs` (fresh `qb-e2e-persona`), then `npm run probe -- qb-e2e-persona`.
2. Second desktop instance (`test-logseq-desktop`): `launch.sh 9333`, `cdp.mjs graph qb-e2e-persona`,
   confirm with `eval -e 'return logseq.api.get_current_graph().name'`.
3. `cd scripts/e2e && ./batch.sh` runs every scenario through the real panel (`qb.js` is the runner,
   `scenarios.json` the inputs); `FLOW='…' node frame.mjs flows.js` for insert/reopen,
   `keyboard.js` for the keyboard-only path, `flows2.js` for navigation, theme and the viewport cap.
   `frame.mjs` is the skill's; pass `--port 9333 --frame logseq-query-builder`.
4. `stop.sh 9333`; reseed before trusting the probes again (a UI run inserts blocks).
