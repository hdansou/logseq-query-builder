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

## Now — P0, retire the unknowns

| ID | Type | Title | Status | Acceptance test |
|---|---|---|---|---|
| TASK-4 | task | `docs/probes.md` scaffold + a probe harness: a dev-only command in the plugin that runs a named probe and logs JSON to the console | todo | Running "Query Builder: probe <name>" from the palette prints `{probe, ok, detail}` to the console; unit test for the harness's result shape |
| FEAT-1 | feat | Probe every operator row (SPEC § Grounding 9) via `datascriptQuery` with string inputs and the rule string, on a scratch graph seeded with one node per shape | todo | `docs/probes.md` has one line per row with the observed row count; any failing row has a replacement form recorded in SPEC.md |
| FEAT-2 | feat | Probe the insert sequence: `insertBlock` → `addBlockTag` → `upsertBlockProperty`; with and without the code sub-properties | todo | Chrome: the block renders a live query table with the expected rows; `docs/probes.md` records whether the sub-properties change editing |
| FEAT-3 | feat | Probe the floating panel: `setMainUIAttrs({draggable, resizable})` + inline size; theme tokens via `resolveThemeCssPropsVals` | todo | Chrome: app clickable beside the panel, position kept across reload, tokens returned and changed on light/dark switch; recorded in `docs/probes.md` |
| FEAT-4 | feat | Probe latency: tag list, property list, a 500-value property, cold and cached | todo | `docs/probes.md` records ms for each; decides whether P5's search-as-you-type fallback is needed in v1 |

## Next — P1, pure core

| ID | Type | Title | Status | Acceptance test |
|---|---|---|---|---|
| FEAT-5 | feat | `model.ts`: builder state types + `addRow/removeRow/setJoin/toggleNot/setTags/setInherit` reducers | todo | Unit: reducers are pure; a NOT toggle flips one row only; join is per row |
| FEAT-6 | feat | `operators.ts`: single table type → operators → arity / value-control kind | todo | Unit: the eight spec types list exactly the spec's operators; checkbox has no value control; `between` has arity 2 |
| FEAT-7 | feat | `dates.ts`: relative expression → input keyword; absolute → journal-day int or ms; datetime day-granularity uses `-start/-end/-ms` | todo | Unit: `-7d` → `:-7d`; "on or before +7d" on datetime → `:+7d-ms` with `<=`; "after -3d" → `:-3d-end` with `>`; week/month boundaries are not offered |
| FEAT-8 | feat | `emit.ts`: state → `{:query :inputs}` string; `%` last in `:in`; idents embedded; inherit toggle | todo | Unit: spec scenarios 1–5 match SPEC § Grounding 9 byte-for-byte; every operator row has a test; preview and block differ only in `:find` |
| FEAT-9 | feat | Guard: refuse an unbounded query (no positive clause) with a message | todo | Unit: only-NOT rows → `{ok:false, reason}`; adding a tag makes it ok |
| FEAT-10 | feat | `readback.ts`: plain-English line from state | todo | Unit: scenario 2 reads "project nodes where assignee is Maria and status is not done and deadline is on or before 30 days from now" |

## Then — P2, vocabulary and preview

| ID | Type | Title | Status | Acceptance test |
|---|---|---|---|---|
| FEAT-11 | feat | `graph.ts`: tags with usage counts, structural tags hidden | todo | Unit on a fake `datascriptQuery`: sorted most-used first; Page/Tag/Property/Root/Asset absent. Live: matches the graph's All Tags |
| FEAT-12 | feat | `graph.ts`: properties with type, cardinality, owner tags; selected tags' properties first | todo | Unit: ordering rule; hidden/built-in-non-public excluded. Live: `status` shows its owner tag |
| FEAT-13 | feat | `graph.ts`: distinct values with counts (open + closed), node search, asset list | todo | Unit: grouped by text, placeholder excluded. Live: counts equal the graph's |
| FEAT-14 | feat | `preview.ts`: run the emitted query with string inputs + rule string; normalise rows; page of 10 + load more | todo | Unit: paging; rows carry uuid, title, page title. Live: scenario 1 count matches a hand-run query |
| FEAT-15 | feat | Result row navigation via `pushState('page', {name: uuid})`; builder stays open | todo | Chrome: click zooms to the block; panel and filters still there |

## Then — P3, panel, entry points, keyboard, theme

| ID | Type | Title | Status | Acceptance test |
|---|---|---|---|---|
| FEAT-16 | feat | Floating panel: draggable, resizable, container sized to panel, close button | todo | Chrome: drag, resize, click the graph beside it, reload keeps position |
| FEAT-17 | feat | Entry points: `⌘⇧Q` + palette entry (captures editing block uuid if any); slash command "Query Builder" (targets its block) | todo | Chrome: both open the panel; the target block is shown in the footer or "no target" |
| FEAT-18 | feat | Tag selector: autocomplete, AND/OR/NOT, inherit toggle | todo | Chrome: pick `project`, toggle inherit, readback and preview change |
| FEAT-19 | feat | Property rows: property → operator → value control per type; per-row join and NOT | todo | Chrome: each of the eight types shows its control; `between` shows two inputs |
| FEAT-20 | feat | Content search row | todo | Chrome: contains / does not contain / starts with / matches; regex emitted via `re-pattern` |
| FEAT-21 | feat | Keyboard-only path: typed filtering, arrows, Enter, Tab, add-row shortcut, Esc | todo | Chrome (keyboard only): scenario 2 built without a mouse |
| FEAT-22 | feat | Theme: copy host tokens into `:root`; refresh on theme change | todo | Chrome: light/dark switch re-colours the panel |

## Then — P4, insert and round-trip

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
| TASK-5 | task | Production build, real `manifest.json`, icon, README for users | todo | |

## Bugs

| ID | Title | Status | Evidence |
|---|---|---|---|

