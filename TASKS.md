# Query Builder — task tracker

Single source of truth for work in this repo. Nothing gets implemented before it has an entry here.

**Conventions**
- IDs: `FEAT-n` (capability), `BUG-n` (wrong behaviour), `TASK-n` (chore/infra).
- Status: `todo` · `doing` · `done` · `blocked` · `wontfix`.
- Every item names its **acceptance test**. TDD: that test is written and failing before the code.
- One item = one reviewable change. If it needs more than one acceptance test, split it.
- Update this file in the same change as the code. Docs land with the feature, not after.

**Working agreements** (standing)
- TDD — test first, watch it fail, then the smallest code that passes.
- KISS — no abstraction until the second caller exists.
- DRY — but duplication is cheaper than the wrong abstraction; prefer extracting after the third repeat.
- Document as we progress: `README.md` for users, `INSTALL-DEV.md` for testing, this file for state.
- UI-producing items are accepted on what is **rendered**, not on stored state.

---

## Done

| ID | Type | Title | Acceptance |
|---|---|---|---|
| TASK-1 | task | Scaffold: TS + vite + vitest, manifest-shaped `package.json`, empty modal on `⌘⇧Q` | `npx vitest run` green; `npx vite build` produces `dist/`; `npx tsc --noEmit` clean |
| TASK-2 | task | Ground `SPEC.md` against the Logseq source | All seven items answered with `path:line` evidence in `SPEC.md` § Grounding; Datalog sketch rewritten; three decisions flagged for sign-off (relative-date set, round-trip state property, iframe theming by token copy) |
| TASK-3 | task | `PLAN.md` + FEAT breakdown from the grounded spec | `PLAN.md` with phases, risks, verified facts; FEAT-1..27 each with an acceptance test; three decisions approved 2026-09-25 |
| TASK-4 | task | `docs/probes.md` + probe harness (dev-only palette commands, results POSTed to a vite sink → `docs/probes.jsonl`) | 4 unit tests (`harness.test.ts`); `scripts/summarise_probes.py` |
| FEAT-1 | feat | Probe every operator row via `datascriptQuery` on a seeded scratch graph | 32 / 32 forms return the expected rows (`docs/probes.md`); found and fixed: SDK 0.2.12 input drop, `[[`-prefixed rule string, value entities in page scope |
| FEAT-2 | feat | Probe the insert sequence | Chrome: inserted block renders "Live query (3)" with the right rows; code sub-properties refused and unnecessary |
| FEAT-3 | feat | Probe floating panel + theme tokens | Chrome: host title bar, drag, resize, click-through beside the panel, panel survives navigation; 13 of 14 tokens resolved; position memory deferred to a packaged build |
| FEAT-4 | feat | Probe fetch latency | 1–5 ms per fetch on the seed graph, 66–86 ms for `getAllProperties`; too small to decide P5, re-run on a real graph |
| FEAT-5 | feat | `model.ts`: builder state types + `addRow/removeRow/setJoin/toggleNot/setTags/setInherit` reducers | Unit: reducers are pure; a NOT toggle flips one row only; join is per row |
| FEAT-6 | feat | `operators.ts`: single table type → operators → arity / value-control kind | Unit: the eight spec types list exactly the spec's operators; checkbox has no value control; `between` has arity 2 |
| FEAT-7 | feat | `dates.ts`: relative expression → input keyword; absolute → journal-day int or ms; datetime day-granularity uses `-start/-end/-ms` | Unit: `-7d` → `:-7d`; "on or before +7d" on datetime → `:+7d-ms` with `<=`; "after -3d" → `:-3d-end` with `>`; week/month boundaries are not offered |
| FEAT-8 | feat | `emit.ts`: state → `{:query :inputs}` string; `%` last in `:in`; idents embedded; inherit toggle | 21 unit tests: spec scenarios 1–5 (scenario 2 as a full block-text snapshot), every operator row from `docs/probes.md`, AND/OR/NOT composition, input dedup, escaping; preview and block differ only in `:find` |
| FEAT-9 | feat | Guard: refuse an unbounded query (no positive clause) with a message | 7 unit tests: empty, only-NOT, NOT joined with OR refused; NOT anywhere accepted once a positive clause exists (scenario 5) |
| FEAT-10 | feat | `readback.ts`: plain-English line from state | 5 unit tests incl. scenario 2 verbatim, OR/NOT rows, presence tags, content search |
| FEAT-11 | feat | `graph.ts`: tags with usage counts, structural tags hidden | Unit on a fake `datascriptQuery`: sorted most-used first; Page/Tag/Property/Root/Asset absent. Live: matches the graph's All Tags |
| FEAT-12 | feat | `graph.ts`: properties with type, cardinality, owner tags; selected tags' properties first | Unit: ordering rule; hidden/built-in-non-public excluded. Live: `status` shows its owner tag |
| FEAT-13 | feat | `graph.ts`: distinct values with counts (open + closed), node search, asset list | Unit: grouped by text, placeholder excluded. Live: counts equal the graph's |
| FEAT-14 | feat | `preview.ts`: run the emitted query with string inputs + rule string; normalise rows; page of 10 + load more | Unit: paging; rows carry uuid, title, page title. Live: scenario 1 count matches a hand-run query |
| FEAT-15 | feat | Result row navigation via `pushState('page', {name: uuid})`; builder stays open | Chrome 2026-09-26: selecting the Gamma result routed to `#/page/<uuid>` (title "Gamma"), panel and results still there. Driven by keyboard (Tab/Enter) because the Chrome extension cannot deliver synthetic clicks into the cross-origin plugin iframe |
| FEAT-16 | feat | Floating panel: draggable, resizable, container sized to panel, close button | Chrome: drag, resize, click the graph beside it, reload keeps position |
| FEAT-17 | feat | Entry points: `⌘⇧Q` + palette entry (captures editing block uuid if any); slash command "Query Builder" (targets its block) | Chrome 2026-09-26: ⌘⇧Q → footer "No target block"; `/Query Builder` in a block → footer "Insert target: this block" |
| FEAT-18 | feat | Tag selector: autocomplete, AND/OR/NOT, inherit toggle | Chrome 2026-09-26 (keyboard): typed `qbp` filtered to QBPerson/QBProject with counts; ArrowDown+Enter added the chip, read-back "QBProject nodes", 3 results incl. the sub-tag |
| FEAT-19 | feat | Property rows: property → operator → value control per type; per-row join and NOT | Chrome 2026-09-26 (keyboard): ⇧↩ adds a row focused on its property picker, picking defaults the operator, value picker lists Todo (2)/Done (1), chip + read-back + 1 result. Number/date/node controls covered by unit tests; date and node re-checked live in FEAT-21 |
| FEAT-20 | feat | Content search row | Chrome 2026-09-26: `contains "alp"` narrowed the results and appeared in the read-back; the four operators map to the emitter's verified forms |
| FEAT-21 | feat | Keyboard-only path: typed filtering, arrows, Enter, Tab, add-row shortcut, Esc | Chrome 2026-09-26, keyboard only: tag → ⇧↩ → property → operator (typed "does") → node search "mar" → ⇧↩ → … → date "+30d"; read-back matched the spec sentence, result Alpha plan. Operator is a picker, joins are toggle buttons |
| FEAT-22 | feat | Theme: copy host tokens into `:root`; refresh on theme change | Chrome 2026-09-26: panel took the host's teal dark palette after `resolveThemeCssPropsVals`; mode/theme change handlers re-apply (light-mode switch not yet exercised live) |

## Now — P4, insert and round-trip

P3 exit met 2026-09-26: spec scenario 2 built without a mouse; panel follows the host theme tokens. 95 unit tests.

| ID | Type | Title | Status | Acceptance test |
|---|---|---|---|---|
| FEAT-23 | feat | Insert from shortcut path: new sibling of the captured block; disabled with hint when none | todo | Chrome: block renders a live table; no target → button disabled |
| FEAT-24 | feat | Insert from slash path: name = block text (prefilled), tag + property written into that block | todo | Chrome: the slash block becomes the query, name kept |
| FEAT-25 | feat | Round-trip: state JSON in `plugin.property.logseq-query-builder/state`; reopen loads it | todo | Chrome: reopen on the inserted block shows the same chips; Datalog is never parsed |

## Later — P5, polish

| ID | Type | Title | Status | Notes |
|---|---|---|---|---|
| FEAT-26 | feat | Debounce + session cache; search-as-you-type for large value sets | todo | Gate on FEAT-4 numbers |
| FEAT-27 | feat | Result row context: page, key properties | todo | |
| FEAT-29 | feat | Layout: filter rows wrap onto two lines when a value picker is present; results zone gets squeezed at the default panel height | todo | Seen in the FEAT-21 run |
| FEAT-30 | feat | Verify light-mode token refresh live (switch theme with the panel open) | todo | FEAT-22 was checked in dark mode only |
| FEAT-28 | feat | Hide settings-like built-in properties from the property picker (`Enable bidirectional properties`, `Enable property history`, `Hide empty value` passed the host's public/hidden rule live) — probably by `:logseq.property/view-context` | todo | Found in the P2 demo |
| TASK-5 | task | Production build, real `manifest.json`, icon, README for users | todo | |

## Bugs

| ID | Title | Status | Evidence |
|---|---|---|---|

