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
- UI-producing items are accepted on **both the mouse and the keyboard path**: Enter moves focus forward and a click does not, so they fail differently (BUG-9/11/12 passed by keyboard and trapped a mouse user). The persona run (`docs/e2e-persona.md`) is the release gate; a new zone gets a scenario there before it is done.

---

## Done

| ID | Type | Title | Acceptance |
|---|---|---|---|
| TASK-1 | task | Scaffold: TS + vite + vitest, manifest-shaped `package.json`, empty modal on `⌘⇧F` | `npx vitest run` green; `npx vite build` produces `dist/`; `npx tsc --noEmit` clean |
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
| FEAT-17 | feat | Entry points: `⌘⇧F` + palette entry (captures editing block uuid if any); slash command "Query Builder" (targets its block) | Chrome 2026-09-26: ⌘⇧F → footer "No target block"; `/Query Builder` in a block → footer "Insert target: this block" |
| FEAT-18 | feat | Tag selector: autocomplete, AND/OR/NOT, inherit toggle | Chrome 2026-09-26 (keyboard): typed `qbp` filtered to QBPerson/QBProject with counts; ArrowDown+Enter added the chip, read-back "QBProject nodes", 3 results incl. the sub-tag |
| FEAT-19 | feat | Property rows: property → operator → value control per type; per-row join and NOT | Chrome 2026-09-26 (keyboard): ⇧↩ adds a row focused on its property picker, picking defaults the operator, value picker lists Todo (2)/Done (1), chip + read-back + 1 result. Number/date/node controls covered by unit tests; date and node re-checked live in FEAT-21 |
| FEAT-20 | feat | Content search row | Chrome 2026-09-26: `contains "alp"` narrowed the results and appeared in the read-back; the four operators map to the emitter's verified forms |
| FEAT-21 | feat | Keyboard-only path: typed filtering, arrows, Enter, Tab, add-row shortcut, Esc | Chrome 2026-09-26, keyboard only: tag → ⇧↩ → property → operator (typed "does") → node search "mar" → ⇧↩ → … → date "+30d"; read-back matched the spec sentence, result Alpha plan. Operator is a picker, joins are toggle buttons |
| FEAT-22 | feat | Theme: copy host tokens into `:root`; refresh on theme change | Chrome 2026-09-26: panel took the host's teal dark palette after `resolveThemeCssPropsVals`; mode/theme change handlers re-apply (light-mode switch not yet exercised live) |
| FEAT-23 | feat | Insert from shortcut path: new sibling of the captured block; disabled with hint when none | Chrome 2026-09-26 (keyboard): editing Epsilon → ⌘⇧F → name → tag → ⌘↩ created "Projects after Epsilon" as Epsilon's sibling, rendered "Live query (3)"; with no target the button is disabled with the reason in the footer |
| FEAT-24 | feat | Insert from slash path: tag + query + state written into that block, name from the builder | Chrome 2026-09-26 (keyboard): `/Query Builder` → tag QBProject → name → ⌘↩; the block became "Live query (3)" with tag, `:logseq.property/query` and the state JSON. Name prefill from block text dropped: the slash text is the whole content |
| FEAT-25 | feat | Round-trip: state JSON in `plugin.property.<id>/state`; reopen loads it | Chrome 2026-09-26: editing the inserted query block + ⌘⇧F reopened with its name and QBProject chip; restore works from either entry point and then Insert rewrites that block |

## Production-hardening pass (2026-09-26)

Applied: A1 demo removed; A3 bundle checked free of dev code; C6 `CHANGELOG.md`; C7 README privacy
section; C8 dev-only note in `INSTALL-DEV.md`; E11 `.gitignore`; E12 MIT `LICENSE` (Danzu); E13
manifest fields (`author`, `license`, `repository`, `engines`, `packageManager`, `logseq.supportsDB`,
`supportsDBOnly`, `minSDKVersion`, icon at repo root); E14 `ci.yml` + `publish.yml` (Node 22).
Also applied: D9 overrides (`dompurify` ^3.4.16, `lodash-es` ^4.18.1, resolved exactly) and D10 vite 7.3.6 +
vitest 4.1.11; `npm audit` reports 0 vulnerabilities; suite, typecheck and build green on the new toolchain.
Then: A2 raw probe log untracked; B4 `sdk.ts` holds the SDK casts; B5 `graph.ts` rows typed at one boundary;
E15 private repo `hdansou/logseq-query-builder` created and `main` pushed; E16 README screenshot from the
scratch graph (`docs/screenshot.jpg`); E17 handoff folder kept and named as the design record in the README.
Open: replace the screenshot with a real-graph capture before the marketplace PR; make the repo public then.

## Production-hardening pass 2 (2026-09-26, evening)

Delta over the morning pass, after the references work. Applied: one `el()` factory (`src/ui/dom.ts`)
instead of three copies; shared test helpers (`src/test-helpers.ts` pure, `src/ui/test-panel.ts` DOM
harness) instead of duplicated `withRef`/`panel()`; the `[qb focus]` diagnostic gated to dev builds.
Checked and clean: `npm audit` 0 with `happy-dom` added; CI runs typecheck, test, build; README,
CHANGELOG, cheatsheet, privacy and security-audit match `src/`; new `probes/`, `scripts/`,
`docs/probes-cli.json` intentional. Deferred: `"web": true` in the manifest, since neither the
host source nor the skills confirm the field is read; revisit at the manifest PR. Release prep
(version, tag) stays with the marketplace path.

## Production-hardening pass 3 (2026-10-11)

Two weeks and eight source fixes after pass 2. `src/` clean on A/B (no dialogs, logging, `any`
or stubs; dev hooks gated). Applied: D1 `source-map-js` 1.2.2 (transitive via vite → postcss,
lockfile refresh; `npm audit` 0); E1 `batch.sh` finds the skill's `frame.mjs` through `$FRAME`
with the `~/.claude/skills` default and fails loudly if missing; E2 one `scripts/e2e/common.js`
(panel shown, close, open from palette) instead of four copies; C1 README *Install* section
(release zip, load unpacked, DB graph only). Toolchain: CI and `engines` on Node 24 (`.nvmrc`),
suite, typecheck, build green on 24.9.0 and 22.20.0; `@logseq/libs` 0.3.4 is the newest published
(npm's `latest` tag still points at 0.0.17; 0.3.x is on `next`). Checked and matching: CHANGELOG
`[Unreleased]` and README carry every fix since pass 2. Deferred: E3 real-graph screenshot before
the marketplace PR; version, tag and the manifest PR stay with the release path; FEAT-51 open.

## Now — reference rows (rescope of FEAT-38, 2026-09-26)

The requirement doc gained a *Reference querying* section (SPEC.md, grounded in §10) and the
prototype a References zone. Direction is an operator, target is a node, a tag (with inheritance)
or a filtered set, one hop, linked references only. Decisions taken here: *in the Library* becomes
*on page under* the built-in Library page (one clause); *referenced in page…* is removed,
superseded by *is linked from · page*; hidden `$$$views` blocks are excluded like the host's panel.

| ID | Type | Title | Status | Acceptance test |
|---|---|---|---|---|
| FEAT-38 | feat | Rescope "referenced in page…" | done | Superseded by FEAT-39..45; the decision and its grounding are SPEC.md §Reference querying and §10 |
| FEAT-39 | feat | `model.ts`: `RefRow` (direction · target · NOT · join), target = node \| tag (+ name condition), reducers, `Query.refs`; state round-trip keeps `refs`, older state reads as `[]` | done | Unit: reducers pure; `deserializeState` of a v1 state without `refs` yields `refs: []` |
| FEAT-40 | feat | `emit.ts`: one clause per direction (SPEC §10 table), tag target with inheritance, name condition; Library scope emitted through the same `under` helper; `referenced-in` scope gone | done | Unit: the four directions match the probed forms verbatim; tag target sets `rules`; ancestor/under set `rules`; NOT wraps; Library scope = under `library` |
| FEAT-41 | feat | Guard + read-back: a ref row is positive unless NOT; sentence "task nodes that link to Project Iris and whose ancestor links to any project" | done | Unit: guard accepts a lone ref row and refuses a lone NOT ref row; read-back phrases for the four directions, tag targets, name condition, NOT |
| FEAT-42 | feat | `ui/refs.ts`: References zone — rows with direction picker, target picker (tags first, then node search), *name…* narrow for tag targets, NOT, AND/OR, remove, "+ add reference"; keyboard path like filter rows | done | Unit: add → pick direction → pick target renders the chip and updates the store; live: prototype's three demo cases on `demolocal2` / `Library-Test` |
| FEAT-43 | feat | Scope zone: drop *referenced in page…*; README, CHANGELOG, `docs/probes.md` updated | done | Unit: scope zone renders three toggles; README scope table has no *referenced in* row |
| FEAT-44 | feat | Live check in the web app: links to, is linked from, ancestor links to, on page under, tag target with name | done | Chrome 2026-09-26 on `demolocal2` with a seeded probe page (`docs/probes.md` "Reference rows, live"): four directions, AND of two rows, tag target, insert + reopen. Found and fixed: typed picker text wiped by the results re-render (BUG-3). Library tree covered by the CLI probe on `Library-Test` |
| FEAT-45 | feat | Filtered target: property conditions on the target set (spec *A filtered target set*), reusing the row controls | done | Unit: `rowClause` takes a subject var, row list ops shared (`rowsAdd/Set/…`), 6 tests; UI: *+ condition on the target* under a tag target renders filter-row controls with the tag's properties first (Chrome 2026-09-26); the clause checked on the host engine, `docs/probes.md` "Filtered target set" |
| FEAT-46 | feat | Reference target search: pages before blocks, then by title | done |
| FEAT-47 | feat | Result rows and node search show `[[title]]`, not `[[uuid]]` (user report 2026-09-26) | done | Unit: `resolveRefs`, normalize, nodes; pull patterns carry `{:block/refs [:block/uuid :block/title]}`. Live: the Mentions row reads "Mentions [[Project Iris]] inline" | Unit: `targetOptions` order; live: typing `iris` lists `Project Iris` first |
| FEAT-48 | feat | Newcomer cheatsheet `docs/cheatsheet.md` (user request 2026-09-26) | done | README links it; every example uses controls that exist |
| FEAT-49 | feat | Magnifier icon at the left of the name row (user request 2026-09-26; the host title bar stays, it is the drag handle) | done | Live: inline SVG beside a two-line name, count aligned with the first line |
| TASK-6 | task | DOM unit tests for the zones (happy-dom): render from a state, assert what is on screen; regression tests for BUG-3/4/5/7 | done | `src/ui/zones.test.ts` green under `@vitest-environment happy-dom` |
| TASK-7 | task | Dev-only test hook in the plugin frame: `postMessage` protocol to read state/rendered text, set the query, click a control by fid, type into one | done | Live 2026-09-26: one host-console script built the FEAT-45 case and read back its result (`docs/probes.md`); Enter waits for a picker's option list; documented in INSTALL-DEV.md; absent from the production bundle |
| TASK-8 | task | `npm run probe -- <graph>`: run the emitter's clauses read-only on a CLI graph and compare counts with `docs/probes-cli.json`; `--record` writes observed counts | done | Fixtures for Demo-Graph and Library-Test pass; a changed clause fails |
| TASK-9 | task | Security audit before the marketplace release | done | `docs/security-audit.md`: risk LOW; SEC-001..003 fixed with tests, SEC-004/005 informational |
| FEAT-50 | feat | Keep the panel inside the window: the host restores a saved layout (percent top/left, pixel size) whatever the window size and ignores inline position once a layout is saved, so a layout saved on a large screen put the footer, Insert included, below a 700 px window (e2e persona run, 2026-10-09) | done | Unit (`panel.test.ts`, `fitStyle`): max-height / max-width from the measured container and viewport rects, 16 px margin, null when it fits. Live: 980×700 window, saved 770×617 layout at top 145 px → footer visible |
| TASK-10 | task | Persona end-to-end run on a seeded graph (`docs/e2e-persona.md`, `scripts/seed-persona.mjs`, 26 scenarios + 10 flows) in the installed desktop app | done | Seed matches the design (engine counts); 33 emitter probes green on `qb-e2e-persona`; 26 scenarios and 10 flows pass through the real panel after the fixes BUG-9..15 and FEAT-50 (`docs/e2e-persona.md` § Run log) |
| TASK-11 | task | Keyboard mode for the persona runner: every scenario by keys as well as by mouse (`MODE=keys ./batch.sh`), since the two paths fail differently | done | 2026-10-10: 25 / 25 by keys, counts and read-backs equal to the mouse pass (`docs/e2e-persona.md` § Keyboard pass) |
| FEAT-51 | feat | Content operator as a picker instead of the native `<select>`: the only control in the panel that is not type-to-filter, and the only one a synthetic keyboard cannot drive on macOS (its popup is an NSMenu) | todo — product call | Unit: the BUG-15 test rewritten for a picker; keys-mode run drives it without the direct-set fallback |
| IDEA-1 | idea | Graph view of the results with one-hop neighbours; click a neighbour to add a "links to" reference row (user idea 2026-09-26) | later — after a week of real use and v1.0.0 | Prototype: results + neighbours, cap 50, SVG, click-to-add-reference only. Judge on whether it leads to a query the list would not have |
| BUG-8 | bug | Theme switch could leave stale tokens: tokens were resolved only at the theme-changed event, which fires before the new stylesheet loads (same defect as Planner T02, `2c90798`) | done | Unit: fake host whose token changes only after a simulated stylesheet load; re-resolve at 250/1000 ms, last call wins (`src/theme.test.ts`). Live: switch theme in the host and compare the panel to the host tokens Confirmed live 2026-10-04 on Logseq-DB 2.0.1 (second instance): switching between two dark themes, the tokens read at the event were the old theme's; 1.8 s later they matched the host. |
| BUG-5 | bug | Footer disappeared when the panel was resized small (user report 2026-09-26) | done | `#body` scrolls, footer `flex-shrink: 0`; live: footer visible in the default size, scroll region above it |
| BUG-7 | bug | Spaces typed into the query name vanished: the field was re-rendered from the trimmed name after every keystroke | done | The field shows the raw typed text while the user types, the trimmed name only at insert; live: a 140-character name typed with spaces intact |
| BUG-6 | bug | Long query name cut off at the right (user report 2026-09-26) | done | The name is a one-row textarea that grows with its text; Enter is swallowed, ⌘↩ still inserts; caret survives the per-keystroke re-render |
| BUG-4 | bug | The BUG-3 restore blanked a freshly picked property (the picker had cleared its text; the restore wrote "" over the new label) | done | Picker marks `data-typing` while composing; `captureFocus` carries over only that. Live: "Status" stays picked |
| BUG-3 | bug | Text typed into any picker was lost when the preview's results re-rendered the panel | done | `captureFocus` restores the focused input's text and re-dispatches `input`; live: "qb refs" survives the re-render (`docs/probes.md`) |

## Then — daily use

| ID | Type | Title | Status | Acceptance test |
|---|---|---|---|---|
| FEAT-31 | feat | `Page` selectable in the tag picker | done | Unit: Page listed with its count; live: "Page nodes" query lists pages |
| FEAT-32 | feat | **Scope: referenced in a page** (the spec's deferred "references / backlinks") | done | Scope zone with a page picker; emitter `[?src :block/uuid …] [?sb :block/page ?src] [?sb :block/refs ?b]` first. Live on `demolocal2`: "all nodes referenced in Task Testing Page" → 4 nodes (Priority, Status, Tags, Task: property and tag entities count as references; a tag filter narrows to the artists-in-a-book case) |
| FEAT-34 | feat | Result count in the header row, not under the list | done | Live screenshot |
| FEAT-37 | feat | Round-trip property renamed `query-builder-state` (was `state`), old name still read | done | Unit + live: inserted block shows the new title under "Show hidden properties" |
| FEAT-36 | feat | Scope *on page…* (blocks that live on a page), beside *referenced in page…* | done | Unit: emitter/read-back; live: "Task nodes on Task Testing Page" lists the page's seven tasks |
| FEAT-35 | feat | Native calendar beside the date text field; text stays the source of truth | done | Live: pick a day → field shows the ISO date, preview updates; typed `-7d` still works |
| FEAT-33 | feat | **Scope: inside the Library** | done (live check pending data) | Grounded: Library = built-in page `library`, membership = `:block/parent` tree, host `parent` rule; emitter takes those pages and blocks on them. Live: runs without error on `demolocal2`, which has no Library pages yet; re-check on a graph that has some |


P5 and TASK-5 done 2026-09-26: every first-implementation item in the spec's scope table is built and live-verified on the scratch graph (104 unit tests, `docs/probes.md`). The next gate is the plan's own: use it on a real graph for a week before marketplace work; open items from that go here.

| ID | Type | Title | Status | Notes |
|---|---|---|---|---|
| FEAT-26 | feat | Debounce + session cache; search-as-you-type for large value sets | done (partial) | Preview debounced 300 ms (store), vocabulary cached per session and invalidated on `DB.onChanged` (graph.ts), node search is already search-as-you-type. A value-list fallback for huge properties is deferred until a real graph shows a need (FEAT-4 measured ms on the seed graph) |
| FEAT-27 | feat | Result row context: page, key properties | done | Rows show the values of the properties the query filters on (`context.ts`, 3 unit tests); live: "qbStatus: Todo · QB Scratch". Pull-map keys keep the full ident except `:block/*` (observed live) |
| FEAT-29 | feat | Layout: filter rows wrap onto two lines when a value picker is present; results zone gets squeezed at the default panel height | done | Default panel 780×620, narrower pickers, remove button no longer pushed right, results min-height 120; the host keeps a user's own size once dragged |
| FEAT-30 | feat | Verify light-mode token refresh live | done | Live: `set_theme_mode('light')` → panel white with dark text and host link colours; guard bar colours now derive from the host background |
| FEAT-28 | feat | Hide settings-like built-in properties from the property picker | done | Built-ins with a `:logseq.property/view-context` (property/class/page/never) are dropped; node-level ones (Status, Deadline, Assignee…) have none. Live: typing `ena` finds nothing |
| TASK-5 | task | Production build, manifest, icon, README for users | done | `package.json` is the manifest (`main: dist/index.html`, icon in `dist/`); `npm run build` → 148 kB bundle; loaded from `vite preview` on :8292 in the web app and built a query live. Position memory across reload still needs a stable id, i.e. a real install; see `docs/probes.md` |

## Bugs

| ID | Title | Status | Evidence |
|---|---|---|---|
| BUG-1 | **Upstream, unverified:** attribute-index scans miss datoms on a persisted graph (`[?p :logseq.property/public? true]` misses Priority; `status` clauses in P0) | verified 2026-10-09 — mechanism reproduced, trigger not; draft issue in `docs/bug-1-report.md`, awaiting review before filing | `docs/probes.md` "Priority missing" and the P0 `status` notes. Worked around in `graph.ts` with `get-else`. To verify: reproduce on a fresh graph after a full reload (not in-memory), compare `(d/datoms db :avet :logseq.property/public?)` against `:eavt` for the same entity, check whether an EDN export/import round trip clears it, then file at logseq/db-test with the minimal repro. Do not "fix" in this plugin beyond the workaround |
| BUG-15 | A content operator chosen before any text was typed snapped back to "contains": with empty text the zone stored no content clause, and the re-render rebuilt the select from state (e2e persona run S5/S16, 2026-10-09) | done | Unit (`zones.test.ts`, "content zone"): the operator survives a re-render; an operator without text is not a filter (guard, read-back, emitter use `contentActive`). Live: S5 reads "text starts with", S16 "text matches /^Idea:/" |
| BUG-14 | "Any tag" matched the graph's schema: every property and tag page carries a tag (Property, Tag), built-in pages too, and closed values are tagged entities, so *any tag and not Task* returned 185 nodes on a graph with 27 tagged user nodes (e2e persona run S17, 2026-10-09) | done | Unit (`emit.test.ts`, "any tag (presence)"): Property/Tag-tagged, built-in and property-value entities excluded; the negated form stays plain presence. CLI probe S17 = 27 |
| BUG-12 | The panel opened with the tag picker focused and its full list open, hanging over "+ add a filter" and "+ add a reference"; a mouse user's first click on either button picked a tag instead (e2e persona run, 2026-10-09) | done | Unit (`zones.test.ts`, BUG-12): focus alone keeps the tag list closed; typing or ArrowDown opens it (`openOnFocus: false`, picker option). Live: the References row can be added right after opening |
| BUG-13 | "Insert as query block" wrapped onto two lines in the footer at the default panel width (e2e persona run, 2026-10-09) | done | `.btn { white-space: nowrap }`; live screenshot |
| BUG-11 | Opening the panel forced focus into the tag picker at 50/300/800 ms; a user who had already reached another control within that second lost it, and the tag picker's focus handler reopened the full tag list over the Filters zone (e2e persona run, 2026-10-09; it is what made the BUG-9 symptom come back after the BUG-9 fix) | done | Unit (`focus.test.ts`): forced focus pulls from the host page, never from a control inside the panel. Live: S1 built by mouse right after opening, no focus jump |
| BUG-9 | After a tag (or any value) was picked, the re-rendered picker took focus back and its focus handler reopened the full list, which hung over the next zone and scrolled the body to it; a mouse user's next click landed on the list (e2e persona run, 2026-10-09) | done | Unit (`zones.test.ts`, BUG-9): a mouse pick leaves the fresh picker focused with its list closed; a list that was open when results arrived stays open. `captureFocus` records whether the list was open and restores focus "quiet" when it was not. Live: S1 built by mouse without the tag list covering the Filters row |
| BUG-10 | A content search, the *on page* scope and (already) *on page under* bound property-value entities: a text value such as ProjStatus "Active" lives on the node's page and a closed value such as Priority "High" has a title, so `contains "active"` returned the value itself as a node (e2e persona run, 2026-10-09) | done | Unit (`emit.test.ts`): content and on-page clauses carry `(not [?b :logseq.property/created-from-property _])`; CLI probes S5x/S5y on `qb-e2e-persona` return 0 |
| BUG-2 | Library scope threw `Insufficient bindings: #{?b} not bound in [(= ?b ?lp)]` once the Library held a page; the live check on `demolocal2` passed only because its Library was empty | done | Found while probing scope forms on the CLI graph `Demo-Graph` (2026-09-26). The page branch of the `or` now binds `?b` with `[(identity ?lp) ?b]`; unit test updated |

