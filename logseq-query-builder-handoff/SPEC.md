# Logseq Graphical Query Builder — Requirement

> Exported 2026-09-25 from the Claude Doc
> https://claude.ai/code/artifact/ef12ac42-a69e-446c-942e-0def5c78f5ca (rev 33), byline 2026-09-25.
> Grounding against the Logseq source is recorded in the **Grounding** section at the end; verified
> identifiers replace assumed ones in place and are marked `[verified]`.

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
| Query node | A query is itself a node carrying the `query` tag, a name, and the query syntax. | Inserting a built query means creating a node through the application API with that tag, name and syntax. |

## Property types and operators

Eight property types exist. Five hold multiple values; only `date`, `date-time` and `checkbox` are
single-valued, so the builder treats multi-value as the default case. The type of the chosen
property decides which operators and which value control the row offers.

| Type | Cardinality | Operators | Value control |
|---|---|---|---|
| text | multi | contains any, contains all, does not contain, is empty, is not empty | Free text, one or more values |
| node | multi | contains any, contains all, does not contain, is empty, is not empty | Node picker over the whole graph, optional tag constraint |
| URL | multi | contains any, contains all, does not contain, is empty, is not empty | Free text |
| number | multi | contains any, contains all, does not contain, greater than, less than, between, is empty, is not empty | Numeric input, two inputs for between |
| asset | multi | contains any, contains all, is empty, is not empty | Asset picker |
| date | single | equals, before, on or before, after, on or after, between, is empty, is not empty | Date picker or relative date |
| date-time | single | Same as date, compared at day granularity | Date picker or relative date |
| checkbox | single | is true, is false | None |

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
  supports — today, tomorrow, yesterday, start/end of this week, start/end of this month, and
  offsets such as +7d or -30d. A relative value is stored as the expression, not the resolved date,
  so a saved query stays current.
- **Between:** two inputs, each absolute or relative, e.g. *between today and end of month*.

## Results and persistence

The builder works both as an ad-hoc search panel and as a way to insert a live query into a page.

**Results.** A plain list of matching nodes, refreshed as filters change. The first 10 matches are
shown, with a load more action to reveal the rest. Each entry shows the node's content and the page
it lives on, and navigates to the node on click. Table view with property columns is deferred (see
Scope).

**Insert as query node.** An *Insert* action writes the built query into the current page through
the application API, in this order:

1. Create a new node at the cursor position.
2. Apply the `query` tag, which makes the node a query.
3. Set the query's name, entered by the user in the builder (required by the `query` tag).
4. Set the query syntax generated from the builder state. The builder emits Datalog (Logseq
   advanced queries), not the simple query DSL, which is too limited for typed operators, negation
   and relative dates.

The inserted node then renders its results live, exactly as a hand-written query would. Reopening
the builder on an existing query node should load its filters back into the UI so the query can be
edited visually.

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
a stand-in, not the intended look.

**Entry points.** The builder opens two ways, and closes three.

| Trigger | Context | On close |
|---|---|---|
| Registered keyboard shortcut | Opens anywhere, no target block | Insert writes a new query node at the current position, or the user navigates away with nothing inserted |
| Slash command in a node | Opens with that node as the target | Insert writes the query syntax and name into that node, replacing the slash command |
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
demands. The cost is that drag, resize, position memory and focus handling are all custom, where a
docked sidebar would come from the host.

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
- [ ] To verify against the source, not to decide here: the exact query syntax and attribute schema
  the API expects on a `query` node. Relative dates are believed to be supported natively, so the
  builder should comply with the built-in representation rather than resolving them itself and
  storing fixed dates — this must be confirmed.
- [x] Resolved: results show the first 10 matching nodes, with a load more / view more option to
  reveal the rest.

**Grounding this document against the source.** This specification is deliberately at the level of
intent and behaviour. Once it is settled, the next step is to open the Logseq repository with
Claude Code and refine the document against the actual implementation, replacing assumed
identifiers with verified ones. Items to confirm there:

- The schema of a `query` node: which attributes hold the query itself and its name, and what the
  API expects on creation.
- How relative date expressions are represented and resolved internally, and whether a stored query
  keeps them live.
- The real attribute namespace for user-defined properties and for tags, which the Datalog emitter
  currently guesses.
- How tag inheritance is stored, and whether a query can match extending tags without enumerating
  them.
- The plugin APIs for registering a keyboard shortcut and a slash command, and what the slash
  command handler receives about the invoking node.
- Which CSS custom properties the host exposes for theming, and the existing chip, popover and
  button patterns to reuse.
- Whether the plugin can render a floating, non-modal panel, and what the host provides for
  position and focus handling.
