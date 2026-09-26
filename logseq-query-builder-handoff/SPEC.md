# Logseq Graphical Query Builder — Requirement

> Exported 2026-09-25 from the Claude Doc
> https://claude.ai/code/artifact/ef12ac42-a69e-446c-942e-0def5c78f5ca (rev 33), byline 2026-09-25.
> **Grounded 2026-09-25** against Logseq source at upstream `master` `f4d37904a6` (worktree
> `logseq-eng-documentation`; paths below are relative to that repo). Inline notes marked
> **[verified]** confirm a claim, **[contradicted]** correct one. The full findings, the decisions
> they force, and the rewritten Datalog sketch are in the **Grounding** section at the end.

## Overview

The query builder lets a Logseq DB user assemble a query visually — pick tags, add typed property
filters, optionally search node content — and either see the matching nodes immediately or insert
the query into a page as a named, live query node. No Datalog or advanced-query syntax is written by
hand.

The builder targets the Logseq DB graph model, where everything is a node and tags act as object
types. Pages, journals and tasks are not separate entities: they are nodes carrying the `page`,
`journal` or `task` tag, so one builder covers all of them.

## Data model

The builder queries one thing — nodes — and narrows them by tag, by property, and by content.

| Concept | Definition | Consequence for the builder |
|---|---|---|
| Node | The unit of the graph. A page contains several nodes. A node may carry no tag at all. | Untagged nodes are still queryable by property and content. |
| Tag | Assigning a tag to a node makes it an object of that type and gives it the tag's property schema. Built-in tags include `page`, `journal`, `task`, `query`; users add custom tags such as `project` or `person`. | Tag filtering is the primary way to scope a query. Once a tag is chosen, its properties are the first suggestions in property rows. |
| Property | A typed key–value attached to a node. Properties can be defined by a tag or applied directly to a node without any tag. A property can be reused across tags (`status` on both `task` and `project`). | Property filters must work with or without a tag constraint. |
| Reference | A `node`-typed property points at another node, e.g. `assignee` → a node tagged `person`. | Value pickers for `node` properties list any node in the graph, with an optional tag constraint to narrow the list. |
| Query node | A query is itself a node carrying the `query` tag, a name, and the query syntax. **[verified]** Tag `:logseq.class/Query`; syntax in the `:logseq.property/query` property (a ref to a value entity whose `:block/title` is the text); name = the block's own `:block/title`. | Inserting a built query means creating a node through the application API with that tag, name and syntax. **[verified]** `insertBlock` → `addBlockTag(uuid, "logseq.class/Query")` → `upsertBlockProperty(uuid, "logseq.property/query", text)` → `updateBlock(uuid, name)`. See Grounding §1. |

## Property types and operators

Eight property types exist. **[contradicted]** Six *may* hold multiple values (`text`, `number`,
`URL`, `date`, `node`, `asset` — the `cardinality-property-types` set); `date-time` and `checkbox`
are always single-valued and stored as raw scalars (ms number, boolean). Cardinality is chosen per
property, so a `date` property can be multi-valued and a `text` one single-valued; the builder
reads `:db/cardinality` from the property entity rather than assuming from the type. The builder
still treats multi-value as the default case. The type of the chosen
property decides which operators and which value control the row offers.

| Type | Cardinality | Operators | Value control |
|---|---|---|---|
| text | multi | contains any, contains all, does not contain, is empty, is not empty | Free text, one or more values |
| node | multi | contains any, contains all, does not contain, is empty, is not empty | Node picker over the whole graph, optional tag constraint |
| URL | multi | contains any, contains all, does not contain, is empty, is not empty | Free text |
| number | multi | contains any, contains all, does not contain, greater than, less than, between, is empty, is not empty | Numeric input, two inputs for between |
| asset | multi | contains any, contains all, is empty, is not empty | Asset picker |
| date | one or many **[contradicted]** | equals, before, on or before, after, on or after, between, is empty, is not empty | Date picker or relative date |
| date-time | single (raw ms) **[verified]** | Same as date, compared at day granularity | Date picker or relative date |
| checkbox | single (raw boolean) **[verified]** | is true, is false | None |

Rules that apply across types:

- *Contains any* matches a node when at least one chosen value is present; *contains all* requires
  every chosen value.
- *Is empty* and *is not empty* need no value and cover the case where a property is applied
  without being filled in.
- For `number`, the comparison operators (greater than, less than, between) match if any held value
  satisfies the condition.

## Builder structure

The builder has three layers, read top to bottom: a tag selector, a stack of property filter rows,
and an optional content search. All three combine with AND.

**Tag selector (top).** Autocompletes over the tags in the graph. Accepts several tags composed
with AND, OR and NOT, evaluated flat left to right. Selecting a tag narrows the graph before any
property row is evaluated and promotes that tag's properties to the top of the property picker.
Leaving it empty queries all nodes, tagged or not. Tag inheritance is on by default — a selected
tag also matches nodes carrying tags that extend it — with a toggle to restrict matching to the
exact tag. When several tags are combined with OR, property rows apply to the union of matching
nodes.

**Property filter rows.** Each row is `property · operator · value`. The property picker lists
every property in the graph, with the selected tags' properties first. The operator list and the
value control come from the property's type (see the table above). Rows are joined with AND or OR
chosen per row, flat left to right, with a NOT toggle on each row.

**Content search.** A separate row type that searches the node's own text rather than a property.
Operators: contains, does not contain, starts with, matches (regular expression).

**Presence.** Alongside the boolean operators, the builder offers *has tag* / *does not have tag*
and *has property* / *does not have property*, so a query can ask whether something is set at all
regardless of its value.

## Date and date-time handling

Date comparisons work at day granularity and accept relative values, because the two most-used
date properties — `scheduled` and `deadline` on the built-in `task` tag — are `date-time` and users
think in days, not timestamps.

- **Operators:** equals, before, on or before, after, on or after, between (inclusive range), is
  empty, is not empty.
- **Day granularity:** *equals 25 Sep 2026* on a `date-time` property matches any timestamp on that
  day. Before/after compare against the start and end of the named day.
- **Relative dates:** the value control accepts the relative expressions the application already
  supports. **[contradicted, partly]** Natively supported query inputs are `:today`, `:tomorrow`,
  `:yesterday` and signed offsets in days, weeks, months or years (`:+7d`, `:-30d`, `:-1w`,
  `:+1m`, `:-1y`), plus their day-boundary forms for `date-time` (`:start-of-today-ms`,
  `:end-of-today-ms`, `:+7d-ms`, `:-3d-start`, `:-3d-end`). **There is no start/end of week or
  month input** (`deps/db/src/logseq/db/frontend/inputs.cljs:69-80`). A relative value is stored
  as the input keyword, not the resolved date, and the host re-resolves it on every run, so a saved
  query stays current. Week and month boundaries are therefore **out of v1** unless the builder
  stores a fixed date for them, which the spec rules out; see Grounding §2 for the decision.
- **Between:** two inputs, each absolute or relative, e.g. *between today and +30d*.

## Results and persistence

The builder works both as an ad-hoc search panel and as a way to insert a live query into a page.

**Results.** A plain list of matching nodes, refreshed as filters change. The first 10 matches are
shown, with a load more action to reveal the rest. Each entry shows the node's content and the page
it lives on, and navigates to the node on click. Table view with property columns is deferred (see
Scope).

**Insert as query node.** An *Insert* action writes the built query into the current page through
the application API, in this order:

1. Create a new node at the cursor position. **[verified]** `logseq.Editor.insertBlock`.
2. Apply the `query` tag, which makes the node a query. **[verified]** `logseq.Editor.addBlockTag`;
   `upsertBlockProperty(..., "tags", ...)` does *not* work, it creates a plugin property.
3. Set the query's name, entered by the user in the builder (required by the `query` tag).
   **[verified]** the name is the block's `:block/title`; a blank title renders as "untitled query".
   It is not required by the schema, only by this spec.
4. Set the query syntax generated from the builder state. The builder emits Datalog (Logseq
   advanced queries), not the simple query DSL, which is too limited for typed operators, negation
   and relative dates. **[verified]** the text must be an EDN map `{:query [:find …] :inputs […]}`;
   a bare `[:find …]` vector is treated as DSL/full-text. `:title` in that map is ignored for user
   query blocks. Regex literals `#"…"` break the EDN reader and silently demote the whole text to
   DSL; use `[(re-pattern "…") ?re]`.

The inserted node then renders its results live, exactly as a hand-written query would. Reopening
the builder on an existing query node should load its filters back into the UI so the query can be
edited visually. **[design decision needed]** Parsing builder state back out of Datalog is
brittle; the plugin should store its own state on the query block in a plugin-namespaced property
(`plugin.property.logseq-query-builder/state`, JSON, no random suffix in plugin namespaces) and
treat the Datalog as derived output. See Grounding §7 (approved 2026-09-25).

## UX and interaction model

The builder ships as a Logseq plugin that queries the graph live at each step, so the user selects
from what actually exists rather than typing identifiers from memory. The user drives structure —
which tags, which properties, which operators — and the plugin supplies the vocabulary.

**Progressive disclosure.** Each choice narrows and populates the next control:

| Step | User action | Plugin fetches | Result |
|---|---|---|---|
| 1 | Opens the tag selector | All tags in the graph | Autocomplete list, most-used first |
| 2 | Picks a tag, e.g. `project` | That tag's property schema | Property picker seeded with the tag's own properties, then all others |
| 3 | Picks a property, e.g. `status` | The property's declared type | Operator list filtered to that type |
| 4 | Picks an operator | The distinct values of that property in the graph | Value picker showing real values with counts |
| 5 | Picks a value | Matching node count | Live result preview |

**Assisted values.** The value control is never a bare text box when the graph can answer it. For
`node` properties it lists real nodes, optionally constrained to a tag; for `text` it offers
existing values with free entry as a fallback; for `date` it offers a picker plus the relative-date
shortcuts. Showing the count beside each value tells the user whether a filter will return anything
before they commit to it.

**Keyboard first.** Speed of building is the point, so a full query must be buildable without the
mouse: every picker accepts typed input that filters the fetched list, arrow keys move through
options, Enter picks, Tab advances to the next control in the row, and a shortcut adds a new row.
Escape closes a picker without changing anything.

**Fetch behaviour.** Lists are fetched on control open, debounced on keystroke, and cached for the
session. A property with a very large value set falls back to search-as-you-type against the graph
rather than loading everything.

**Native theming.** The builder must read as part of the application, not as a visiting app. It
inherits the host's CSS custom properties for colour, type and radius rather than defining its own
palette, so it follows whatever theme the user has installed — light, dark or third-party — without
per-theme work. The same applies to controls: reuse the application's existing chip, popover and
button patterns so the builder's vocabulary matches the rest of the UI. The prototype's palette is
a stand-in, not the intended look. **[contradicted, partly]** The plugin's main UI is an iframe
and receives none of the host's CSS custom properties, classes or components. The host does expose
`logseq.UI.resolveThemeCssPropsVals([...])`, which returns the computed values of named `--ls-*`
variables, and fires `onThemeModeChanged` / `onThemeChanged`, so the builder can copy the
variables into its own `:root` and follow the theme. Reusing the host's chip, popover and button
*components* is not possible from an iframe; only the tokens can be matched. See Grounding §6.

**Entry points.** The builder opens two ways, and closes three.

| Trigger | Context | On close |
|---|---|---|
| Registered keyboard shortcut **[verified]** `registerCommandPalette` with `keybinding {binding: "mod+shift+q"}`; that chord is unclaimed in `shortcut/config.cljs` | Opens anywhere, no target block; the handler still receives the editing block's `uuid` when there is one | Insert writes a new query node at the current position, or the user navigates away with nothing inserted |
| Slash command in a node | Opens with that node as the target **[verified]** the handler receives `{uuid, format, pid}` only; the host removes the slash text itself and the block stays in edit mode | Insert writes the query syntax and name into that node, replacing the slash command |
| Either | User is locating something, not building a query | Click a result to navigate to that node; the builder closes and nothing is written |

**Find and jump.** The third row is a distinct job, not a side effect. Users will open the builder
purely to locate a node — filters as a search tool — so results must be navigable: click, or
keyboard-select, a result to jump to that node in the application. This means Insert is never a
required step, and the results list needs enough context per entry (content, parent page, key
properties) to recognise the right node before clicking.

Clicking a result does not close the builder by default. Filters and results are preserved so the
user can jump to a node, look at it, and come back to select another — the common case when they
are exploring several matches. Whether close-on-click becomes a setting is deferred until real use
shows it is wanted; the default of staying open never loses work.

**Panel placement.** The builder is a floating, non-modal panel: draggable, resizable, no backdrop,
with the graph clickable behind it. This is a v1 decision, not an option. It keeps the horizontal
room the property rows need — property, operator and value side by side — and lets the user move
it aside when it covers a node they have navigated to, which is what the find-and-jump case
demands. **[contradicted, in the builder's favour]** Drag, resize, a title bar with a close button, and
position memory all come from the host: `logseq.setMainUIAttrs({draggable: true, resizable: true})`
plus `setMainUIInlineStyle({width, height, top, left})`. What is *not* provided is click-through:
the main-UI iframe container is full-screen with no `pointer-events` rule, so the app is clickable
behind the panel only because the container is shrunk to the panel's own rectangle. See Grounding
§6.

A docked sidebar is the alternative and is deliberately not offered as a setting in v1: supporting
both means building and maintaining two layouts, since a narrow docked pane would force the
property rows to stack. It moves to the later list, to be revisited if real use asks for it.

*(Diagram in the source doc: "builder panel · 4 zones, top to bottom".)* The panel reads top to
bottom: tags scope the query, filter rows narrow it, content search is optional, and the results
zone doubles as the insert point. Each control shows what the graph returned, so the user sees a
match count before committing to a filter.

**Prototyping.** Three cheap steps before any plugin code, each answering one question:

1. Paper or Figma sketches of two or three layouts — panel, modal, inline block — to settle where
   the builder lives and how a filter row reads. Answers: does the layout make sense at a glance?
2. A clickable prototype of the row-building interaction with fake data, focused on the value
   control changing shape per type. Answers: does progressive disclosure feel helpful or slow?
3. A throwaway plugin build wired to a real graph, testing fetch latency on the tag list and on a
   high-cardinality property. Answers: is live assistance fast enough to feel instant?

**Prototype built.** Steps one and two are done. An interactive prototype runs at
https://claude.ai/artifact/BZTZLcMhbrqV732QRtzcrf (a copy is `prototype.html` in this folder) over
a fake graph of roughly 330 nodes — tasks, bugs extending task, projects, people, meetings, pages,
journals and untagged notes — with a working query engine implementing the real operator semantics
and relative-date resolution.

Two layouts were built and compared: a stacked panel matching the zones described above, and a
sentence-style variant rendering the query as one readable line. **The stacked panel was chosen**
and the sentence variant dropped. The chosen version was then extended with the keyboard flow, a
plain-English read-back line above the results, and a live output pane showing the emitted Datalog
alongside pseudocode, so a non-technical reviewer can check the query without reading Datalog.

Two caveats. The emitted Datalog is a sketch: attribute names are guesses pending the source
verification listed under Open questions. And the prototype's visual styling is its own, not the
host's — see Native theming above.

Step three, a throwaway plugin build wired to a real graph to test fetch latency, is not yet done.

The riskiest part is step 2. The value control is different for each of the eight types, and
getting that wrong makes the builder feel inconsistent no matter how sound the query logic is.

**Natural language (later).** A text box where the user types *urgent tasks assigned to Maria due
this month* and the plugin translates it into builder state — tags, rows, values — which the user
then sees and adjusts in the panel before inserting. The visual builder stays the source of truth;
natural language is a faster way to populate it, not a separate path to Datalog.

## Scope

The first implementation ships flat composition, a list view, and the full typed-operator set;
nesting, table view and graph traversal come later.

| Capability | First implementation | Later |
|---|---|---|
| Tag selector with autocomplete, AND / OR / NOT | Yes | |
| Property rows for all eight types with typed operators | Yes | |
| Multi-value operators (contains any / all) | Yes | |
| Presence operators (has / does not have) | Yes | |
| Content search on the node's own text | Yes | |
| Relative dates and day-granularity comparison | Yes | |
| Plain list of results | Yes | |
| Insert as named query node via API | Yes | |
| Nested grouping with parentheses | | To explore |
| Table view with property columns | | To explore |
| Content search descending into nested children | | To scope, decide on inclusion |
| Querying references / backlinks | | To scope, decide on inclusion |
| Sorting results by a property | | Later stage |
| Natural-language entry that populates the builder | | Later stage |
| Dockable sidebar placement as an alternative to the floating panel | | Later, if asked for |

## Worked scenarios

Each scenario is written as the builder state, then as the pseudocode the builder would generate.

**1. Urgent tasks.** Tag: `task`. Row: `priority` contains any `urgent`.

```
nodes where tag = task
  and priority contains-any [urgent]
```

**2. Maria's open projects due this month.** Tag: `project`. Rows: `assignee` contains any `Maria`
AND `status` does not contain `done` AND `deadline` on or before *end of month*.

```
nodes where tag = project
  and assignee contains-any [Maria]
  and status not-contains [done]
  and deadline <= end-of-month
```

**3. Anything assigned to one of three people.** No tag. Row: `assignee` contains any
`Maria, Tom, Priya`. Switching to contains all would return only nodes assigned to all three.

```
nodes where assignee contains-any [Maria, Tom, Priya]
```

**4. Tasks scheduled this week that mention "invoice".** Tag: `task`. Rows: `scheduled` between
*start of week* and *end of week*. Content: contains `invoice`.

```
nodes where tag = task
  and scheduled between [start-of-week, end-of-week]
  and content contains "invoice"
```

**5. Untagged nodes with a status set.** Tag: NOT any. Row: `status` is not empty. Exercises the
property-without-tag case.

```
nodes where has-tag = false
  and status is-not-empty
```

## Open questions

- [x] Resolved: tag inheritance is on by default — selecting a tag also matches nodes carrying tags
  that extend it — with a toggle in the builder to restrict matching to the exact tag.
- [x] Resolved: when the tag selector holds several tags with OR, property rows apply to the union
  of matching nodes. Per-tag branch rows are deferred with nested grouping, since each branch would
  form its own parenthesised group.
- [x] Resolved: `does not contain` on a multi-value property means none of the chosen values are
  present — the strict negation of contains any. Assignee does not contain Maria, Tom returns nodes
  touching neither.
- [x] Resolved: once nested-children search is built, content search includes nested children by
  default, with an option to turn it off.
- [x] Verified 2026-09-25: the query node schema and API sequence are in Grounding §1. Relative
  dates *are* native query inputs and stay live; the builder stores the input keyword. The
  supported set is narrower than assumed (no week/month boundaries), see Grounding §2.
- [x] Resolved: results show the first 10 matching nodes, with a load more / view more option to
  reveal the rest.

## Grounding (2026-09-25)

Verified against Logseq upstream `master` `f4d37904a6`. Paths are relative to that repo. Each
subsection answers one item of the original "items to confirm" list, states what the source
contradicts, and records the decision it forces. **Live-verified 2026-09-26** on a scratch DB graph
in the web app (`docs/probes.md` in the plugin repo): every operator form in §9, every input in
§2, the insert sequence in §1 (renders "Live query (3)"), the draggable/resizable panel and the
theme tokens in §6. Additional live findings:

- **Plugin SDK must be `@logseq/libs` ^0.3.4.** 0.2.12 silently drops the last `datascriptQuery`
  input (its proxy never appends the namespace tag that the method pops); 0.3.4 fixes it.
- A string input that starts with `[[` is taken for a page reference before EDN reading; the rules
  string is passed with a leading space.
- Property-value entities carry `:block/page`; page-scoped queries must exclude
  `:logseq.property/created-from-property` entities.
- The plugin cannot write `display-type`/`code/lang` on the query value entity (schema validation
  refuses); the block renders without them.
- `:start-of-week` and friends pass through unresolved, confirming §2.

### 1. Query node schema and creation API

| Fact | Evidence |
|---|---|
| Class `:logseq.class/Query`, one class property: `:logseq.property/query` | `deps/db/src/logseq/db/frontend/class.cljs:53-56` |
| `:logseq.property/query` is `:default` type, cardinality one, `:public? true :hide? true` | `deps/db/src/logseq/db/frontend/property.cljs:197-201` |
| Its value is a **ref** to a value entity; the text is that entity's `:block/title` | `property/type.cljs:58-61`, renderer reads `(:block/title (:logseq.property/query block))` at `src/main/frontend/components/block.cljs:3886-3888` |
| A block renders as a query if it has the tag **or** the property | `block.cljs:1266-1269`; results need the property (`:4393-4397`) |
| The query's name is the block's own `:block/title`; blank shows "untitled query" | `block.cljs:2707-2711` |
| `/Query` sets the tag, moves the block title into the value entity, blanks the title | `src/main/frontend/handler/editor.cljs:4143-4161` |
| `/Advanced Query` additionally sets `display-type :code` and `code/lang "clojure"` **on the value entity** | `src/main/frontend/commands.cljs:125-132, 644-652` |

**API sequence for Insert** (all host exports confirmed in `src/main/logseq/api.cljs`):

```js
const { uuid } = await logseq.Editor.insertBlock(targetUuid, name, { sibling: true });
await logseq.Editor.addBlockTag(uuid, "logseq.class/Query");           // api.cljs:217
await logseq.Editor.upsertBlockProperty(uuid, "logseq.property/query", text); // api.cljs:141
```

For the slash-command entry point the target block already exists: skip `insertBlock`, use
`updateBlock(uuid, name)` for the title. Whether the two code sub-properties are needed for the
block to *edit* well (they are not needed to render) is a live check in the first FEAT item.

### 2. Relative dates and day granularity

Resolver: `deps/db/src/logseq/db/frontend/inputs.cljs`, run in the worker on every execution
(`src/main/frontend/worker/handler/query.cljs:158-181`). Stored queries keep the keyword, so they
stay live. **[verified]**

| Input | Resolves to |
|---|---|
| `:today` `:yesterday` `:tomorrow` | journal-day int, e.g. `20260925` |
| `:+7d` `:-30d` `:-1w` `:+1m` `:-1y` | journal-day int (units `d w m y`) |
| `:start-of-today-ms` `:end-of-today-ms` | local ms at 00:00:00.000 / 23:59:59.999 |
| `:+7d-ms` / `:-7d-ms` | ms; `+` = end of that day, `-` = start of that day |
| `:+7d-start` `:+7d-end` `:-3d-start` `:-3d-end` | ms at that day's boundary |
| `:right-now-ms` | ms now |
| `:current-page` `:query-page` `:current-block` `:parent-block` | page name string / block `:db/id` |

**Confirmed 2026-09-25 on request:** offsets such as `-7d` are supported. Any `:[+-]N[dwmy]`
keyword resolves through `get-offset-date` (`inputs.cljs:36-45, 121-126`) and the unit tests cover
`:-1w`, `:-1m`, `:-1y` and `:-365d` (`deps/db/test/logseq/db/frontend/inputs_test.cljs:163-201`).
The builder shows these as "N days/weeks/months/years ago / from now".

**Not supported: start/end of week, month or year** (`inputs.cljs:69-80`, only calendar offsets
from today exist, `:38-46`).

**Decision (approved 2026-09-25):** v1 offers exactly the native set — today, tomorrow,
yesterday, and a signed offset with a unit picker (days / weeks / months / years). "Start of
week", "end of month" and friends are removed from the value control until the host grows such an
input; storing a fixed date for them would violate the "saved queries stay current" rule.

**Value shapes:** a `:date` property value is a ref to a journal page whose `:block/journal-day`
is the int to compare (`property/type.cljs:157-161`, schema `:96`). A `:datetime` value is a raw
ms number (`type.cljs:210-212`); `scheduled` and `deadline` are `:datetime`
(`property.cljs:340-353`). Day granularity for `:datetime` is expressed with the `-ms` /
`-start` / `-end` inputs, so no client-side resolution is needed:

```clojure
;; date property "due" on or before +7d
[?b :user.property/due-Xab12cde ?d] [?d :block/journal-day ?day] [(<= ?day ?in1)]   ; :inputs [:+7d]
;; datetime property scheduled equals today
[?b :logseq.property/scheduled ?ms] [(>= ?ms ?in1)] [(<= ?ms ?in2)]                ; :inputs [:start-of-today-ms :end-of-today-ms]
;; datetime before -3d  (strictly before the start of that day)
[?b :logseq.property/scheduled ?ms] [(< ?ms ?in1)]                                  ; :inputs [:-3d-ms]
;; datetime after +3d   (strictly after the end of that day)
[?b :logseq.property/scheduled ?ms] [(> ?ms ?in1)]                                  ; :inputs [:+3d-ms]
```

Absolute dates are emitted as literals: journal-day ints for `:date`, ms for `:datetime`.

### 3. Attribute namespace

- User property idents are `:user.property/<normalised-name>-<random 8 chars>`; user tags are
  `:user.class/<name>-<suffix>` (`deps/db/src/logseq/db/frontend/db_ident.cljc:66-90`). The
  normaliser drops every character outside `[0-9a-zA-Z*+!_'?<>=-]`, so non-ASCII titles leave only
  the suffix. Titles are not unique: collisions get `-1`, `-2` (`db_ident.cljc:6-26`).
- **Consequence:** the emitter never derives an ident from a title. The builder resolves the
  property/tag entity when the user picks it and embeds the real `:db/ident` in the Datalog. The
  prototype's `:user.property/<name>` guess is wrong for every user property.
- Plugin-owned properties are `:plugin.property.<plugin-id>/<name>` with **no** suffix
  (`src/main/logseq/api/block.cljs:52-64`); a plugin may only write its own namespace (`:94-101`).
- Built-in tags: `:logseq.class/Task`, `Page`, `Journal` (extends Page), `Query`, `Card`,
  `Cards` (extends Query), `Template`, `Tag`, `Property`, `Root`, `Asset`, `Whiteboard`,
  `Comment(s)`, `Code-block`, `Quote-block`, `Math-block`, `Pdf-annotation`
  (`class.cljs:16-104`). Hide from the tag selector: Root, Tag, Property, Page, Asset, Whiteboard,
  Pdf-annotation, Code, Quote, Math, Comments, Comment (`internal-tags` `:118-121`,
  `hide-from-node` classes). Offer: Task, Query, Card, Cards, Template, Journal, plus every
  user class.

### 4. Property types and value shapes

`deps/db/src/logseq/db/frontend/property/type.cljs`:

```clojure
user-built-in-property-types  [:default :number :date :datetime :checkbox :url :node :asset] ; :19-21
cardinality-property-types    #{:default :number :url :date :node :asset}                    ; :34-36
closed-value-property-types   #{:default :number :url}                                       ; :30-32
```

| Spec type | Real type | Stored as | Scalar lives in |
|---|---|---|---|
| text | `:default` | ref to value entity | `:block/title` |
| number | `:number` | ref to value entity | `:logseq.property/value` |
| URL | `:url` | ref to value entity | `:block/title` |
| node | `:node` | ref to the node | target's `:block/title` / `:block/uuid` |
| asset | `:asset` | ref to a node tagged `:logseq.class/Asset` | `:block/title` |
| date | `:date` | ref to a journal page | `:block/journal-day` |
| date-time | `:datetime` | raw ms number | – |
| checkbox | `:checkbox` | raw boolean | – |

Where the property list comes from: `logseq.Editor.getAllProperties()` (`api.cljs:210`), or the
query below, which mirrors the host's own hidden-property rule
(`src/main/frontend/worker/handler/property.cljs:333-357`):

```clojure
[:find ?ident ?title ?type ?card
 :where [?p :block/tags :logseq.class/Property]
        [?p :db/ident ?ident] [?p :block/title ?title]
        [?p :logseq.property/type ?type] [?p :db/cardinality ?card]
        (not [?p :logseq.property/deleted-at _])
        (or (not [?p :logseq.property/built-in? true]) [?p :logseq.property/public? true])
        (not [?p :logseq.property/hide? true])]
```

A tag's own properties: `[?c :logseq.property.class/properties ?p]` (cardinality many,
`property.cljs:172-176`); ancestors' properties via `class-extends` (§5).

Distinct values with counts, grouped by text because open `:default`/`:url` values are one entity
per assignment (`deps/outliner/src/logseq/outliner/property.cljs:457-478`):

```clojure
[:find ?label (count-distinct ?b)
 :in $ ?prop ?empty
 :where [?b ?prop ?v] [(not= ?v ?empty)]
        (not [?v :logseq.property/deleted-at _])
        (or [?v :block/title ?label] [?v :logseq.property/value ?label])]
;; ?empty = the :db/id of :logseq.property/empty-placeholder, looked up once per session
```

Closed choices, including unused ones: `[?cv :block/closed-value-property ?p]` ordered by
`:block/order` (`property/build.cljs:10-22`).

**"Applied but unfilled" exists** for ref types: the singleton `:logseq.property/empty-placeholder`
(`deps/db/src/logseq/db/sqlite/create_graph.cljs:242-244`). *Is empty* must therefore mean
`(or (not [?b ?prop _]) [?b ?prop :logseq.property/empty-placeholder])`, and *is not empty* the
negation of that.

### 5. Tag inheritance

- Attribute `:logseq.property.class/extends`, cardinality many, default parent `:logseq.class/Root`
  (`property.cljs:164-171`, `sqlite/util.cljs:91-99`).
- Rule, parent → descendant (`deps/db/src/logseq/db/frontend/rules.cljc:14-19`):
  ```clojure
  [[(class-extends ?p ?c) [?c :logseq.property.class/extends ?p]]
   [(class-extends ?p ?c) [?t :logseq.property.class/extends ?p] (class-extends ?t ?c)]]
  ```
- Query blocks **auto-inject** any built-in rule named in `:where` and append `%` as the **last**
  `:in` binding (`src/main/frontend/worker/handler/query.cljs:184-203`). `logseq.DB.datascriptQuery`
  does **not** inject rules (`src/main/logseq/api/db.cljs:21-45`), but any string input is read as
  EDN (`worker/handler/query.cljs:108-118`), so the plugin can pass the rule vector as a string.

**Decision:** one emitter, rule-based, `%` placed last in `:in`:

```clojure
;; inherit on
[?tag :db/ident :user.class/project-Kq9x2mzp]
[?b :block/tags ?t] (or [(= ?t ?tag)] (class-extends ?tag ?t))
;; inherit off (exact tag)
[?b :block/tags :user.class/project-Kq9x2mzp]
;; :in $ ?in1 … %   — the block gets % filled by the host; the preview passes the rule as a string input
```

Alternative considered and rejected: expanding descendant tags at build time (what the simple DSL
does, `src/main/frontend/worker/query_dsl.cljs:431-450`). It needs no rules but goes stale when a
new sub-tag is created after insertion.

### 6. Plugin APIs: shortcut, slash command, panel, theming, navigation

| Need | Verified API | Evidence |
|---|---|---|
| Shortcut + palette entry | `logseq.App.registerCommandPalette({key, label, keybinding: {binding: "mod+shift+q", mode: "global"}}, fn)` → host `register_plugin_simple_command` with `palette?` | `libs/src/LSPlugin.user.ts:441-451`, `src/main/logseq/api/plugin.cljs:310-343` |
| Binding conflicts | none checked; a plugin binding silently replaces a built-in on the same handler. `mod+shift+q` is free | `src/main/frontend/modules/shortcut/core.cljs:85-88`, `config.cljs` |
| Handler payload | `{key, label, …, pid, format, uuid}`; `uuid` = editing block or nil | `src/main/frontend/commands.cljs:583-584, 763-773` |
| Slash command | `logseq.Editor.registerSlashCommand(name, fn)`; host runs `clear-current-slash`, `restore-saved-cursor`, then `fn({uuid, format, pid})`; block stays in edit mode | `LSPlugin.user.ts:177-223`, `commands.cljs:619-629` |
| Slash registration latency | list rebuild is debounced 1500 ms | `src/main/frontend/handler/events.cljs:270-271` |
| Floating panel | `logseq.setMainUIAttrs({draggable: true, resizable: true})` + `setMainUIInlineStyle({width, height, top, left})`; host adds title bar, close button, drag, resize, and remembers layout | `libs/src/LSPlugin.core.ts:309-346, 889-998`, `src/main/frontend/modules/layout/core.cljs:15-76` |
| Click-through | none: container is full-screen with no `pointer-events` rule, so the container itself must be sized to the panel | `src/main/frontend/components/plugins.css:663-692` |
| Focus | show focuses the iframe when `autoFocus` is not false and does not exit editing; `hideMainUI({restoreEditingCursor: true})` refocuses the editor | `LSPlugin.core.ts:295-306`, `api/editor.cljs:77-82` |
| Theming | iframe inherits **nothing**; use `logseq.UI.resolveThemeCssPropsVals([...])` and re-run on `App.onThemeModeChanged` / `onThemeChanged` | `libs/src/LSPlugin.caller.ts:283-292`, `src/main/logseq/sdk/ui.cljs:54-63`, `components/theme.cljs:47-58` |
| Tokens to copy | `--ls-primary/secondary/tertiary-background-color`, `--ls-primary/secondary-text-color`, `--ls-border-color`, `--ls-link-text-color`, `--ls-active-primary-color`, `--ls-selection-background-color`, `--ls-font-family`, `--ls-border-radius-low/medium`, `--lx-accent-*`, `--lx-gray-*` | `src/main/frontend/shui/vars-classic.css`, `shui/colors.css` |
| Navigate to a result | `logseq.App.pushState("page", {name: blockUuid})` zooms into the block; `Editor.openInRightSidebar(uuid)` also exists | `api/app.cljs:153-162`, `handler/route.cljs:106-119`, `components/page.cljs:662-679` |
| Live preview | `logseq.DB.datascriptQuery(queryString, ":today", rulesString)` — keyword inputs as strings are resolved; `customQuery` cannot carry `:inputs` | `api/db.cljs:21-45, 47-51`, `db/query_custom.cljs:55-68` |
| Add a tag | `logseq.Editor.addBlockTag(uuid, identOrTitleOrUuid)`; there is no `set_block_tags` | `api.cljs:217`, `api/db_based.cljs:361-372` |

An alternative panel host is `logseq.provideUI({key, template, style, attrs})` with neither `slot`
nor `path`: a float in the **host DOM** that inherits every theme variable and gets drag/resize for
free (`libs/src/common.ts:366-545`). It is rejected for v1 because its content is a sanitised HTML
template with `data-on-click` event wiring, not a live app, which does not fit a keyboard-driven
picker UI. Revisit only if token-copying proves insufficient. **Token copying approved 2026-09-25.**

### 7. Round-trip (reopen an inserted query)

Not in the original list, but the API answers force it. The builder stores its state as JSON in
`plugin.property.logseq-query-builder/state` on the query block; that namespace needs no suffix
and is the only one the plugin may write. On open from a slash command inside a block that has
that property, the builder loads it. Datalog is derived output and is never parsed back.
**Approved 2026-09-25:** an extra hidden property on every inserted query block.

### 8. Content search and predicates

- There is no `:block/content` and `:block/raw-title` is virtual; the attribute is `:block/title`.
  Built-in rule `block-content` is exactly `[?b :block/title ?t] [(clojure.string/includes? ?t ?s)]`
  (`rules.cljc:84-87`).
- Allowed predicate functions are datascript's built-ins only: `= < > <= >= contains? re-find
  re-pattern clojure.string/includes? starts-with? lower-case …` (`datascript/built_ins.cljc:81-109`
  in the fork at `deps.edn:10-11`). No custom functions, no JS functions; everything runs in the
  db worker.
- Caveats: the raw title stores refs as `[[<uuid>]]`, so content search does not see referenced
  page names; matching is case-sensitive, so lower-case both sides. Regex: `[(re-pattern "x") ?re]
  [(re-find ?re ?t)]`, never `#"x"`.
- The simple DSL's quoted-string form uses the search index with a 30-row cap; the builder does
  not use it.

### 9. Rewritten Datalog sketch (replaces the prototype's `datalog()`)

Scenario 2, *Maria's open projects due this month*, with `deadline` a user `:datetime` property and
"this month" rendered as "within 30 days" per §2. This is the emitter's actual output
(`src/emit.ts`, test "full block text"); idents are illustrative, the real ones carry the graph's
random suffixes. Note the ordering: positive clauses first so `?b` is bound before the negation,
and `%` last in `:in`.

```clojure
{:query [:find (pull ?b [*])
 :in $ ?in1 %
 :where
 [?tag1 :db/ident :user.class/project-Kq9x2mzp] [?b :block/tags ?t1] (or [(= ?t1 ?tag1)] (class-extends ?tag1 ?t1))
 [?b :user.property/assignee-Xab12cde ?v1] [?v1 :block/uuid ?x1] [(contains? #{#uuid "0c2f0000-0000-4000-8000-000000000001"} ?x1)]
 [?b :user.property/deadline-Xab12cde ?x3] [(<= ?x3 ?in1)]
 (not [?b :user.property/status-Xab12cde ?v2] [?v2 :block/title ?x2] [(contains? #{"done"} ?x2)])]
 :inputs [:+30d-end]}
```

Read-back line for the same state (`src/readback.ts`): *project nodes where assignee is Maria and
status is not done and deadline is on or before 30 days from now*.

Scenario 4, *tasks scheduled this week that mention "invoice"* (week = today…+7d per §2):

```clojure
{:query [:find (pull ?b [*])
         :in $ ?in1 ?in2 %
         :where
         [?tag :db/ident :logseq.class/Task]
         [?b :block/tags ?t] (or [(= ?t ?tag)] (class-extends ?tag ?t))
         [?b :logseq.property/scheduled ?ms] [(>= ?ms ?in1)] [(<= ?ms ?in2)]
         [?b :block/title ?title] [(clojure.string/lower-case ?title) ?lt]
         [(clojure.string/includes? ?lt "invoice")]]
 :inputs [:start-of-today-ms :+7d-ms]}
```

Scenario 5, *untagged nodes with a status set*:

```clojure
{:query [:find (pull ?b [*])
         :where
         [?b :block/uuid _]
         (not [?b :block/tags _])
         [?e :db/ident :logseq.property/empty-placeholder]
         [?b :user.property/status-Xab12cde ?s] [(not= ?s ?e)]]}
```

Operator table, one definition (property ident `P`, value symbol `?v`, inputs `?inN`):

| Operator | `:where` fragment |
|---|---|
| contains any (ref) | `[?b P ?v] (or [?v :block/title ?x] [?v :logseq.property/value ?x]) [(contains? #{"a" "b"} ?x)]` |
| contains all (ref) | one `[?b P ?vN] [?vN :block/title "a"]` pair per value |
| does not contain | `(not [?b P ?v] [?v :block/title ?x] [(contains? #{…} ?x)])` |
| node contains any | `[?b P ?v] [?v :block/uuid ?u] [(contains? #{#uuid "…"} ?u)]` |
| number > n | `[?b P ?v] [?v :logseq.property/value ?n] [(> ?n 3)]` |
| checkbox is true | `[?b P true]` |
| is empty | `(or (not [?b P _]) [?b P :logseq.property/empty-placeholder])` |
| is not empty | `[?e :db/ident :logseq.property/empty-placeholder] [?b P ?v] [(not= ?v ?e)]` (idents resolve in patterns, not in predicates) |
| date before X | `[?b P ?d] [?d :block/journal-day ?day] [(< ?day ?in1)]` |
| datetime on day X | `[?b P ?ms] [(>= ?ms ?in1)] [(<= ?ms ?in2)]` with `-start`/`-end` inputs |
| has tag | `[?b :block/tags _]` |
| content contains | `[?b :block/title ?t] [(clojure.string/lower-case ?t) ?lt] [(clojure.string/includes? ?lt "x")]` |

Every row above was run live on 2026-09-26 and returned the expected rows (`docs/probes.md`, FEAT-1); `src/emit.test.ts` encodes exactly these forms, and `src/dates.ts` `bounds` is the single definition of the date/datetime comparison semantics.
