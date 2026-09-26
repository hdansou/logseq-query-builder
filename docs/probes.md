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
