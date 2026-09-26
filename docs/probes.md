# Live probes (P0)

Run 2026-09-25/26 against a fresh DB graph `qbscratch` in the web app at `localhost:3001`, plugin
served by vite on `:8291` and registered from the console (`INSTALL-DEV.md`). Every line here was
*observed* in Chrome or in the console; nothing is inferred. Raw results: `docs/probes.jsonl`
(latest line per probe wins; `python3 scripts/summarise_probes.py` prints them).

Seed: page `QB Scratch` with tags `QBProject`, `QBSubproject` (extends `QBProject`), `QBPerson`;
eight plugin-namespaced properties, one per value shape; nodes Maria, Tom, Alpha plan, Beta invoice,
Gamma, Delta invoice, Epsilon (`src/probes/seed.ts`).

## Findings that changed the design

| # | Finding | Consequence |
|---|---|---|
| F1 | **`@logseq/libs` 0.2.12 drops the last `datascriptQuery` input.** Its `datascriptQuery` pops a namespace tag that its proxy never appends (`args.concat(tag)` with the result discarded), so the caller's last real input vanished: `Too few inputs passed, expected: [$ ?x], got: 1`. **0.3.4 appends the tag** (`args.push(tag)`) and inputs pass through. | `package.json` requires `^0.3.4`. No workaround in code. |
| F2 | A string input that **starts with `[[`** is treated as a page reference by the host before EDN reading (`Cannot read properties of null (reading 'toLowerCase')`). A rule vector `[[(class-extends …)] …]` hits this. | The rules string is passed with a leading space. |
| F3 | The host assigns its own plugin id on console registration (`_ccrld6br9`, ignoring `id:`), and **strips the leading underscore** in the property namespace: `:plugin.property.ccrld6br9/qbStatus`. Tags created by the plugin are `:plugin.class.ccrld6br9/QBProject`. | Never build idents from names; resolve by title (`propertyIdent`, `tagIdent`). |
| F4 | Property-**value entities carry `:block/page`** of the owning block's page, so a page-scoped query also returns "Todo", "blue", "https://a.example" as rows. | Scope with `(not [?b :logseq.property/created-from-property _])`. |
| F5 | The plugin **cannot write** `:logseq.property.node/display-type` / `:logseq.property.code/lang` on the query value entity: `Schema validation failed`. | The insert sequence is tag + property only; the block renders and runs without them. |

## FEAT-1 — operator forms (`src/probes/forms.ts`)

32 forms, all scoped to the page; each row's expected titles come from the seed. Result on SDK
0.2.12 with a trailing dummy input: **32 / 32 pass** (2026-09-26 02:29Z). On SDK 0.3.4 without
any workaround: same rows, see "SDK 0.3.4 re-run" below.

| Row | Form (fragment) | Observed |
|---|---|---|
| tag inherit on | `[?tag :db/ident T] [?b :block/tags ?t] (or [(= ?t ?tag)] (class-extends ?tag ?t))` + `%` rules input | Alpha, Beta (sub-tag), Gamma |
| tag exact | `[?b :block/tags T]` | Alpha, Gamma |
| not tag (inherit) | `(not …same…)` | the other four |
| has tag / untagged | `[?b :block/tags _]` / `(not …)` | correct |
| text contains any | `[?b P ?v] (or [?v :block/title ?x] [?v :logseq.property/value ?x]) [(contains? #{…} ?x)]` | correct |
| text contains all | one `[?b P ?vN] [?vN :block/title "x"]` per value | correct |
| text does not contain | `(not [?b P ?v] [?v :block/title ?x] [(contains? #{…} ?x)])` | includes nodes without the property, as specified |
| node contains any / all | `[?v :block/uuid ?u] [(contains? #{#uuid "…"} ?u)]` / one pattern per value | correct; `#uuid` literals read fine |
| number > / between | `[?v :logseq.property/value ?n] [(> ?n 3)]` | correct |
| checkbox true / false | `[?b P true]` | correct, raw boolean |
| is empty | `(or (not [?b P _]) [?b P :logseq.property/empty-placeholder])` | correct (ident resolves in pattern position) |
| is not empty | `[?e :db/ident :logseq.property/empty-placeholder] [?b P ?v] [(not= ?v ?e)]` | correct |
| url contains | `[?v :block/title ?x] [(clojure.string/includes? ?x "…")]` | correct |
| date =, <, <=, >, between | `[?d :block/journal-day ?day] [(op ?day ?inN)]` with `:today`, `:+7d`, `:-7d` | correct |
| datetime on day / before / after / on-or-before | `[?b P ?ms] [(op ?ms ?inN)]` with `:start-of-today-ms`, `:end-of-today-ms`, `:-3d-ms`, `:+3d-ms`, `:+7d-end` | correct |
| content contains / starts with / does not contain | `[(clojure.string/lower-case ?title) ?lt] [(clojure.string/includes? ?lt "…")]` | correct |
| content regex | `[(re-pattern "inv.*ce") ?re] [(re-find ?re ?title)]` | correct |
| scenario 2 / scenario 4 shapes | full combined forms from SPEC § Grounding 9 | Alpha / Beta as expected |

Each form ran in 1–4 ms on this graph.

## Inputs (`inputsProbe`)

`[:find ?y :in $ ?x :where [(str ?x) ?y]]` with the input as a string:

| Input | Resolved |
|---|---|
| `:today` / `:-7d` / `:+7d` / `:-1w` / `:+1m` / `:-1y` | `20260925` / `20260918` / `20261002` / `20260918` / `20261025` / `20250925` |
| `:start-of-today-ms` / `:end-of-today-ms` | local 00:00:00.000 / 23:59:59.999 in ms |
| `:-3d-ms` / `:+3d-ms` | start of that day / end of that day, ms |
| `:+7d-start` / `:+7d-end` | ms at day boundaries |
| `:right-now-ms` | now |
| `:start-of-week` | **unresolved, passes through as the keyword** (confirms SPEC § Grounding 2) |

## FEAT-2 — insert (`insertProbe`)

`appendBlockInPage` → `addBlockTag(uuid, "logseq.class/Query")` → `upsertBlockProperty(uuid,
"logseq.property/query", text)` with the scenario-2 shape (`:in $ ?in1 %`, `:inputs [:+30d-ms]`).

- Read-back: both blocks tagged `:logseq.class/Query`, property text stored verbatim.
- **Rendered in Chrome as "Live query (3)"** with Gamma, Beta invoice, Alpha plan and a Tags
  column: the host injected `class-extends` for `%`, resolved `:+30d-ms`, and inheritance matched
  the sub-tag. Screenshot taken 2026-09-26.
- Code sub-properties on the value entity: refused (F5). Not needed.

## FEAT-3 — panel and theme (`panelProbe`, `themeProbe`)

`setMainUIAttrs({draggable: true, resizable: true})` + `setMainUIInlineStyle({width: "560px",
height: "420px", top: "90px", left: "240px", zIndex: 99})` + `showMainUI({autoFocus: false})`:

- Host added a title bar (plugin id as title, close button) and a bounded container; the
  requested `top/left` applied, the size came out larger (713×531 after one resize) because the
  host's resizable setup owns width/height once initialised.
- **Drag** on the title bar moved the panel (`transform: translate(-139px, -68px)` in the DOM).
- **Resize** from the bottom-right handle grew it.
- **Click-through:** a click on the sidebar outside the panel changed the route to `/graph`; the
  panel stayed open over the new view. Filters would survive navigation.
- Position memory across reload: not verifiable in the console-registration flow, because the
  host assigns a new plugin id per registration and the layout is keyed by it. Re-check with a
  packaged plugin (TASK-5).
- `logseq.UI.resolveThemeCssPropsVals([...])` returned real values in dark mode
  (`--ls-primary-background-color: #002b36`, `--ls-primary-text-color: #a4b5b6`,
  `--ls-border-color: #0e5263`, `--ls-link-text-color: rgb(138, 187, 187)`,
  `--ls-font-family: Inter`, `--ls-border-radius-low/medium: 4px/8px`,
  `--lx-accent-09: hsl(188, 95%, 34%)`); `--lx-gray-03` came back empty on this theme.
  The method is not in the SDK bundle text but works through the proxy's host fallback.

## FEAT-4 — latency (`latencyProbe`)

On the seed graph (7 tags, 34 properties, ~120 nodes): tags with counts 3–4 ms, properties 4 ms
(datalog) vs 66 ms (`getAllProperties` API), values with counts 2 ms, node title search 4 ms,
rule-bearing tag query 2 ms. **Too small a graph to decide P5's search-as-you-type fallback**;
re-run on a real graph before P5.

## SDK 0.3.4 re-run (2026-09-26 02:33Z)

After `npm install @logseq/libs@^0.3.4` and removing the trailing-input workaround:

- **inputs:** all 13 native keywords resolve exactly as before; `:start-of-week` still passes
  through unresolved. F1 is confirmed fixed in 0.3.4.
- **forms:** 27 / 32 by the raw count, but the five diffs are all the same two extra rows,
  `QB inserted query A/B`, which the insert probe had added to the page after the expected lists
  were written (they are tagged, have no `qbStatus`, and do not contain "invoice"). Every
  operator form still returns the right rows; the scope now excludes Query-tagged blocks so the
  count reads 32 / 32 on the next run.
- **theme, latency:** unchanged.

## P2 demo (2026-09-26, `Query Builder: demo (P2)`)

Graph → emit → preview → navigation end to end on the seed graph, rendered as a bare list:

- Read-back: *QBProject nodes where qbStatus is not Done and text contains "a"*; results Alpha plan,
  Gamma (Beta excluded by status) in 26–67 ms including all vocabulary fetches.
- Tags most-used first, structural hidden: Journal (3), QBPerson (2), QBProject (2), Query (2),
  QBSubproject (1), then unused tags at 0.
- Properties for QBProject: alphabetical since the seed declared no class properties; the list
  includes built-in public settings-like properties (**FEAT-28** follow-up).
- Values of qbStatus: Todo (2), Done (1). No closed values on the seed.
- Node search "m": first run returned dozens of built-in property pages; with
  `(not [?b :logseq.property/built-in? true])` it returns Gamma, Maria, Tom.
- **Navigation:** selecting "Gamma · QB Scratch" routed to `#/page/6ab72cbd-361a-…` (tab title
  "Gamma") with the panel and results still open.

**Chrome automation limit.** The extension's synthetic clicks are not delivered into the
cross-origin plugin iframe (verified: `elementFromPoint` is the iframe, pointer-events auto, yet no
click handler fires). Keyboard events follow focus, so UI checks inside the panel are driven by
focusing the iframe from the host (`iframe.focus(); iframe.contentWindow.focus()`) and pressing
Tab/Enter. The host-DOM parts (title bar, drag, resize, click-through) do respond to clicks.
Also: the scaffold's backdrop click-to-close was removed; a floating panel must not close on a
click inside its own frame.

## P3 keyboard walkthrough (2026-09-26)

Spec scenario 2 built with the keyboard alone (the extension cannot click inside the frame):
`⌘⇧Q` → `qbp` ↓ ↩ Esc → `⇧↩` → `qbas` ↩ → Tab → `mar` (node search) ↩ → `⇧↩` → `qbst` ↩ →
`does` ↩ → `Done` ↩ → `⇧↩` → `qbwh` ↩ → `on or b` ↩ → `+30d` Tab. Read-back: *QBProject nodes
where qbAssignee is Maria and qbStatus is not Done and qbWhen is on or before 30 days from now*;
result: Alpha plan. Findings on the way:

- Initial focus must be placed after the host focuses the frame (`window` focus event), and any
  focus jump after a pick must be synchronous: the store renders synchronously and a timer loses
  the race against fast typing.
- Native `<select>` controls did not respond to arrow keys through the extension; the operator
  is now the same picker as everything else and AND/OR are toggle buttons.
- The host's theme tokens came through on load (`--ls-primary-background-color` etc.), so the
  panel rendered in the graph's dark teal palette without any per-theme CSS.
- The scaffold's backdrop click-to-close was removed earlier; a wide dropdown also scrolled the
  frame horizontally until `body { overflow: hidden }`.

## P4 insert and round trip (2026-09-26)

- **Slash path:** `/Query Builder` in an empty block → tag QBProject → name → `⌘↩`. The block was
  renamed, tagged `#Query`, given `:logseq.property/query` and the state JSON, and rendered
  "Live query (3)". The host restored the editor caret into the block afterwards.
- **Shortcut path:** editing "Epsilon" → `⌘⇧Q` → name → tag → `⌘↩` created "Projects after
  Epsilon" as Epsilon's sibling (same parent), rendered "Live query (3)".
- **Round trip:** editing the inserted query block → `⌘⇧Q` reopened the builder with its name and
  chip; restore now applies from either entry point, and Insert then rewrites that block.
- The state property `plugin.property.<id>/state` is a hidden `:string` created once with
  `upsertProperty`; it never shows on the block.

Findings on the way:

- After the frame is shown from a slash command, the host editor takes top-level focus back;
  the frame reclaims it with `window.focus()` in the forced-focus retries.
- Three "empty panel" runs were a test-sequence error, not a defect: after a pick, shift+Tab
  lands on the chip's remove button (it precedes the picker in tab order) and the space in the
  name pressed it, removing the tag. Diagnosed with a temporary keydown logger.
- The name was trimmed on every keystroke and re-rendered, which ate the space in "Open
  projects"; the store now keeps the raw text and trims at use.
- A "/" typed directly after a word does not open the slash menu, so `/Query Builder` appended
  to a query title once; repaired with `update_block`.

## P5 polish (2026-09-26)

- Built-in public properties in the scratch graph, with `:logseq.property/view-context`: Status,
  Priority, Deadline, Scheduled, Assignee, Description have none; Enable property history,
  Hide empty value (`property`), Extends, Enable bidirectional properties, Hide from Node
  (`class`), Page Tags, Published URL, Alias (`page`), Tag Properties (`never`). The picker keeps
  only the first group.
- Pull-map keys from `datascriptQuery`: `:block/*` attributes lose the namespace (`title`,
  `journal-day`); every other attribute keeps the full ident with its colon
  (`:plugin.property.<id>/qbStatus`, `:logseq.property/value`). `context.ts` relies on this.
- Light mode: after `set_theme_mode('light')` the panel re-rendered white with dark text through
  the same token copy. Saving a source file while the panel is open makes vite reload the frame
  and breaks the plugin bridge (black panel) — reload the plugin, do not trust that screenshot.

## Production build (2026-09-26)

`npm run build` produced `dist/` (148 kB JS, 6.9 kB HTML, icon). Served by `vite preview` on
:8292 and registered in the web app the same way as the dev server, the bundle loaded, opened on
`⌘⇧Q`, listed the tags with counts and returned the three QBProject nodes. Dev-only commands
(probes, demo) are absent from the bundle as intended. Position memory across a page reload is
still unverified: console registration assigns a fresh plugin id every time and the host keys the
remembered layout by it, so this needs a real install.

## Real-graph finding (2026-09-26, user's `demolocal2`)

One inserted query block showed a visible `state` property with the JSON in it. The graph held
three `state` properties, one per plugin id that had run: two `string`/hidden (dev instances),
one `default`/unset from the production-bundle instance, i.e. created implicitly by the state write
before the startup `upsertProperty` had taken effect. Fix: `stateSchemaFor` + `ensureStateProperty`
before every write, hiding an existing property without changing its type. The stray one was
repaired in place with `upsert_block_property(<property uuid>, "logseq.property/hide?", true)`.
Setting `hide?` on that `default`-typed property did **not** stop the block from rendering the
value: `:default` values are text entities and render as nested rows under the block regardless of
the flag, whereas the `string`-typed property from the fixed code does not render at all. The
value was removed from the block with `remove_block_property(uuid, "plugin.property.<id>/state")`.
Each console registration gets a fresh id and therefore its own property; a real install has the
stable id `logseq-query-builder`. Consequence for `stateSchemaFor`: hiding an existing
`default`-typed state property is not enough, so a future migration would have to move the value
to a `string` property; for now that case only arises from dev-time races.

## Real-graph finding: Priority missing from the property picker (2026-09-26, `demolocal2`)

`[?p :logseq.property/public? true]` did not match Priority (eid 79) although a pull of the entity
shows `:logseq.property/public? true`, and the same clause matched once `?p` was bound by its ident
first. Every other clause of the picker query matched Priority on its own. Same class of
persisted-graph index anomaly as the `status` case in P0. The picker now reads `built-in?`,
`public?`, `hide?` and `deleted-at` with `get-else` (entity lookups) and filters in code; Priority
is back. Upstream, not ours; not filed yet (mechanism still unproven).

## Scopes (2026-09-26, `demolocal2`)

- Library model (source): built-in page with `:block/name "library"` and `:logseq.property/built-in?
  true`, no ident; membership is the `:block/parent` tree under it, walked by the host `parent`
  rule (`rules.cljc:7-12`); the outline shows page nodes only. The emitter's form:
  `[?lib :block/name "library"] [?lib :logseq.property/built-in? true] (parent ?lib ?lp)
  [?lp :block/tags :logseq.class/Page] (or [(= ?b ?lp)] [?b :block/page ?lp])`. The rules string
  now carries `parent` as well as `class-extends`.
- Referenced-in, live: "Task Testing Page" → Priority, Status, Tags, Task. `:block/refs` includes
  the property and tag entities a block references, not only page/node links; a tag filter on
  top gives the intended "artists mentioned in my book page" result.

## Deleting hidden plugin properties (2026-09-26)

`delete_page(<property uuid>)` returns without error and deletes nothing when the property has
`:logseq.property/hide? true`: the outliner treats a hidden page as built-in and refuses
(`deps/outliner/src/logseq/outliner/page.cljs:128-131`, `entity_util.cljs:58-64`). Clearing the
flag first (`upsert_block_property(uuid, "logseq.property/hide?", false)`) and then deleting works.
Thirteen dev-registration `state` properties were removed from `demolocal2` this way.

## Scope forms re-probed on the CLI (2026-09-26)

Read-only `logseq query` runs against the CLI graph `Demo-Graph` (same Datascript engine as the
host). Recorded here because `demolocal2` had no Library pages, which hid the first finding.

- **BUG-2.** `(or [(= ?b ?lp)] [?b :block/page ?lp])` with `?b` otherwise unbound fails:
  `Insufficient bindings: #{?b} not bound in [(= ?b ?lp)]`. `(or [(identity ?lp) ?b] [?b :block/page ?lp])`
  runs (79 rows for a page and its blocks). The Library scope now uses the `identity` branch.
- Page entities carry their own `:block/refs`: on `Demo-Graph` every page lists `Page` (its tag)
  and `Tags` (the `:block/tags` property), plus real ones (`Formatting Style Guide` →
  `property-example`, `Link to another page` → `Task`). The current "referenced in page…" form
  reads only `[?sb :block/page ?src]`, so a page's own property values never appear.
- Inbound refs `[?b :block/refs ?x]` for `Quick Start` return five rows, two of them the host's
  hidden `Linked references` / `Unlinked references` view blocks on the `$$$views` page; the
  Linked References panel drops them through `entity-util/hidden?`. Excluding blocks whose page
  name starts with `$$$` leaves the three visible ones.
- Inbound refs for a class: `[?x :db/ident :logseq.class/Task] [?b :block/refs ?x]` → 16 blocks,
  15 of them tagged `Task` (tags are refs). With `(not [?b :block/tags ?x])` → 1, which is what the
  host's `get-linked-references` does for classes (`deps/db/src/logseq/db/common/reference.cljs`).

## Reference rows, live (2026-09-26, FEAT-44)

Web app at `localhost:3001`, graph `logseq_db_demolocal2`, plugin from vite `:8291`, driven by keyboard.
Seed added for the run (kept on the graph): pages `Project Iris` and `QB Refs Probe`; on the probe
page a block `Mentions [[Project Iris]] inline` with a child `Nested under the Iris mention, no link
of its own` and a sibling `No links here`; on the Iris page a block linking back to the probe page.

| Row | Read-back | Observed |
|---|---|---|
| links to · Project Iris | all nodes that link to Project Iris | 1 node: the Mentions block |
| ancestor links to · Project Iris | all nodes that have an ancestor linking to Project Iris | 2 nodes: Mentions + its nested child |
| is linked from · Project Iris | all nodes that are linked from Project Iris | 1 node: QB Refs Probe (the page, linked from a block on the Iris page) |
| on page under · QB Refs Probe | all nodes that are on a page under QB Refs Probe | 3 nodes: the page's three blocks |
| on page under · QB Refs Probe AND links to · any Page | … and link to any Page | 1 node: the Mentions block (tag target with inheritance; a name condition input follows the chip) |
| links to · any Task | all nodes that link to any Task | 0 nodes, no error (nothing links to a task on this graph) |
| Insert from `/Query Builder` | block "all nodes that link to Project Iris", Live query (1) | state JSON carries `refs`; ⌘⇧F on the block reopens with the Project Iris chip and 1 node |

Findings:
- **Typed picker text was wiped by a re-render.** A picker's text is not state; when the preview
  came back (300 ms debounce + query) the panel re-rendered and the target picker lost what had
  been typed. `captureFocus` in `render.ts` now restores the input's text and re-dispatches
  `input`. Before the fix, "task" and "iris" typed right after a pick vanished; after it, "qb refs"
  and "page" survived.
- Clearing a target (chip ×) and picking a direction now move focus to the next useful control.
- The host's `datascript_query` from the page console does **not** inject `%` rules (`Too few
  inputs passed, expected: [$ %]`), unlike the CLI; the preview keeps passing the rules string.
- Vite's full reload after an edit blanks the plugin iframe; reload the host page and re-register
  (each registration creates one more hidden `query-builder-state` property under a new plugin id).
- Node search results are sorted by title, so `Project Iris` came third behind two blocks that
  mention "Iris"; pages first would read better (queued as FEAT-46).

## Filtered target set, live (2026-09-26, FEAT-45)

Same setup. Keyboard-driven: *is linked from · any Task* → 2 nodes (Sep 25th, 2026 and Task Testing
Page); *+ condition on the target* opened a condition row under the reference row reading "whose IS
[property] [operator] [value]", the property picker listing Task's own properties first (Deadline,
Priority, Scheduled, Status with the `· Task` hint); picking Status set *contains any*. The keyboard
path into the plugin frame then stopped delivering keys (the focused input ignored Backspace/typing),
so the condition's effect was checked with the emitter's exact clause on the host engine:

| Clause | Result |
|---|---|
| is linked from any Task (no condition) | Sep 25th, 2026 · Task Testing Page |
| … whose Status is Todo | Task Testing Page |
| … whose Status is Doing | Sep 25th, 2026 |

Findings:
- **BUG-4.** The BUG-3 restore (carry typed picker text across a re-render) overwrote a freshly
  picked property's label with the empty text the picker had just cleared. Only text being composed
  is carried now: the picker marks its input `data-typing` while the user types and clears it on
  pick and blur; `captureFocus` restores only that.
- Toggling `⌘⇧F` out of phase sends keystrokes to the host: one run typed "is linked" into the
  Journal table's *New property* box and created a `:user.property/islinked-…` property, deleted
  afterwards. Check the panel is open (screenshot) before typing.
- After a pick, `Tab` from the name condition goes to the row's remove × before the *+ condition*
  button: the button sits after the row line in DOM order.
