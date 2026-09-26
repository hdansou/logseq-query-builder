# Query Builder — plan

Derived 2026-09-25 from `logseq-query-builder-handoff/SPEC.md` (grounded the same day) and
`prototype.html`. The spec says *what*; this file says *how* and *in what order*. `TASKS.md` holds
the live state. Design decisions that took thought are recorded here with the rejected alternative.

## Shape of the thing

A Logseq plugin (TypeScript, `@logseq/libs`, vite) whose main UI is a **floating, non-modal,
draggable panel**. The user picks tags, adds `property · operator · value` rows and an optional
content search; the plugin fetches the vocabulary from the graph at each step, previews results
live, and on *Insert* writes a named `#Query` node carrying advanced Datalog.

```
 keystroke / pick
      │
      ▼
  builder state (model.ts)  ──►  emit.ts  ──►  {:query […] :inputs […]}  ──┬──► preview.ts ──► results list
      ▲                                                                      │      (datascriptQuery)
      │  vocabulary (graph.ts: tags, properties, values, nodes; cached)      └──► insert.ts  ──► query block
      │                                                                             + state property (round-trip)
   ui/*.ts  (panel, rows, pickers, keyboard)      theme.ts (host tokens → iframe :root)
```

**One emitter.** Preview and Insert share `emit.ts`; only the `:find` pull pattern differs
(narrow for preview, `[*]` for the block). The operator semantics live in exactly one table
(`operators.ts`), and every unit test of the emitter is a row of that table or a spec scenario.

## Verified facts the design rests on

All from SPEC.md § Grounding (upstream `master` `f4d37904a6`). Anything not in this list gets a
probe before a task depends on it.

| Fact | Consequence |
|---|---|
| Query block = tag `:logseq.class/Query` + property `:logseq.property/query` (ref → value entity `:block/title`); name = block `:block/title` | Insert = `insertBlock` → `addBlockTag` → `upsertBlockProperty` → (`updateBlock` for slash path) |
| Query text must be an EDN map; `:title` ignored; `#"…"` breaks the reader | emit `{:query … :inputs …}`; regex via `(re-pattern …)` |
| Relative inputs: `:today/:tomorrow/:yesterday`, `:±N[dwmy]`, `:start-of-today-ms`, `:end-of-today-ms`, `:±N[dwmy]-ms/-start/-end`; no week/month boundaries | `dates.ts` maps the value control to exactly these; absolute dates become literals |
| User idents are suffixed (`:user.property/status-Xab12cde`) | embed the resolved `:db/ident`, never a name |
| Cardinality is per property; datetime = raw ms, checkbox = raw boolean, number → `:logseq.property/value`, others → `:block/title`, date → journal page `:block/journal-day` | `operators.ts` keys on type **and** reads cardinality from the entity |
| `:logseq.property/empty-placeholder` = applied but unfilled | *is empty* covers both shapes |
| `class-extends` rule auto-injected in query blocks, `%` appended last in `:in`; `datascriptQuery` does not inject but reads string inputs as EDN | emit `:in $ ?in1 … %`; preview passes the rule vector as a string |
| Datascript built-ins only; runs in the db worker | no custom fns anywhere in emitted queries |
| Main UI iframe: full-screen container, no click-through; host provides `setMainUIAttrs({draggable, resizable})`, `setMainUIInlineStyle` | shrink the container to the panel; let the host drag/resize/remember |
| Iframe inherits no theme; `logseq.UI.resolveThemeCssPropsVals` + `onThemeModeChanged`/`onThemeChanged` | `theme.ts` copies tokens into `:root` |
| `registerCommandPalette` with `keybinding`; `mod+shift+q` free; handler gets `{uuid?}` | shortcut entry point captures the editing block if any |
| `registerSlashCommand` handler gets `{uuid, format, pid}`; slash text auto-cleared; block stays editing; list rebuild debounced 1.5 s | slash entry point targets that block |
| `pushState('page', {name: uuid})` zooms to a block | result click navigation |
| Plugin may write only `plugin.property.<id>/…`, no suffix | round-trip state property |
| `@logseq/libs` 0.2.12 drops the last `datascriptQuery` input; 0.3.4 does not (live, `docs/probes.md` F1) | depend on `^0.3.4` |

## Phases

Each phase ends in something usable or in a retired risk. Do not start a phase before the previous
one's exit is met.

### P0 — Retire the unknowns (live probes)
Throwaway scripts run from the plugin against a scratch DB graph in the web app, driven through
Chrome. Each probe is a line in `docs/probes.md` with the observed result. This is also the spec's
prototyping step 3 (fetch latency).

- Every row of the operator table in SPEC § Grounding 9, run through `datascriptQuery` with string
  inputs and the rule string. Especially: `(or [(= ?t ?tag)] (class-extends ?tag ?t))` on a
  persisted graph; `:+7d-ms`; `#uuid` literals; `empty-placeholder` comparisons.
- Insert sequence renders a live query table; whether the code sub-properties matter for editing.
- `setMainUIAttrs({draggable, resizable})` + inline size: app clickable beside the panel, layout
  remembered across reload.
- `resolveThemeCssPropsVals` returns values for the token list; changes on theme switch.
- Latency: tag list and a 500-value property, cold and cached.

**Exit:** `docs/probes.md` complete; any form that failed has a replacement recorded in SPEC.md.

### P1 — Pure core, fully tested
`model.ts`, `operators.ts`, `dates.ts`, `emit.ts`, `readback.ts`. No DOM, no Logseq API.

**Exit:** the five spec scenarios emit the verified Datalog byte-for-byte; every operator row has
a test; an all-negative query (only NOT clauses) is refused with a message.

### P2 — Vocabulary and preview
`graph.ts` (tags with counts, properties with type/cardinality/owner tag, values with counts,
node search, asset list), `preview.ts` (run, normalise, page-of-10, load more), result rows with
navigation.

**Exit:** on a real graph the builder is usable as a search tool from the browser console driving
state, before any panel chrome exists.

### P3 — Panel, entry points, keyboard, theme
Floating panel, `⌘⇧F`, palette entry, slash command, progressive disclosure, keyboard-only path,
token theming.

**Exit:** the spec's "keyboard first" paragraph can be performed end to end without a mouse, and
the panel follows a light/dark switch.

### P4 — Insert and round-trip
`insert.ts`: both entry points, name required, state property, reopen from a block that has it.

**Exit:** scenario 2 inserted from a slash command renders a live table with the right rows;
reopening the builder on that block shows the same chips.

### P5 — Polish that the spec names
Debounce and session cache, search-as-you-type fallback for large value sets, context per result
row (page, key properties), "full scan"-style hints if a form proves slow in P0.

## Risks

| # | Risk | Mitigation |
|---|---|---|
| R1 | Emitted forms behave differently on a persisted graph than in unit fixtures (rule + `or` + `not` interplay) | P0 probes every row live before P1 encodes them |
| R2 | Sizing the main-UI container defeats "floating": scroll, resize and position drift | P0 probe; fallback is `provideUI` float in host DOM (rejected for v1 in SPEC § Grounding 6) |
| R3 | Every keystroke is IPC to the host then the worker | debounce 300 ms; cache vocabulary per session; preview only on a complete row |
| R4 | No target block on the shortcut path | Insert is disabled with a hint unless a block was being edited when the panel opened; never invent a location |
| R5 | Slash-command path: the block's existing text becomes the query name | show it prefilled in the name field; user edits before Insert |
| R6 | Property titles collide (`status` twice) | pickers show the owner tag beside the name; emitter uses idents |
| R7 | Scope creep from the prototype (sentence view, table view, nesting) | not in TASKS.md, not built |

## Decisions and rejected alternatives

- **Datalog, not DSL** (spec decision). Confirmed necessary: typed operators, `not`, relative ms inputs.
- **Rule-based tag inheritance** over build-time expansion: stays correct when sub-tags are added
  later; the host injects the rule for blocks and the preview passes it as a string.
- **Embedded idents** over title lookup at query time: survives renames; the builder already has
  the entity when the user picks it.
- **State property for round-trip** over parsing Datalog: parsing is brittle and the plugin
  namespace is free of suffixes. Cost: one hidden property per inserted block (approved).
- **Token copy for theming** over host-DOM float: keeps a real app in the iframe; components are
  re-drawn to match, not reused (approved).
- **Native relative-date set only**: no week/month boundaries until the host has such inputs
  (approved).
- **Preview through `datascriptQuery`**, not `customQuery`: the latter cannot carry `:inputs`.
- **References as rows, direction as the operator** (spec, 2026-09-26): *links to* / *is linked
  from* / *ancestor links to* / *on page under*, target = node, tag (inherited) or filtered set.
  Rejected: a "referenced in page…" scope (one direction, page targets only, could not combine
  with *on page*) and a pinned pseudo-property (no ancestry, no page tree).
- **Ancestry recurses `:block/parent`** through the host's `parent` rule: `:block/path-refs` no
  longer exists in DB graphs (migration 65.11). The Library scope is the same clause with the
  built-in Library page as target.
- **"Is linked from a page" reads the page and its blocks**; tags applied to a block and property
  keys are not links, so they are excluded, as are the host's hidden `$$$views` blocks.

## Out of scope for v1

Nested grouping · table view · content search into children · multi-hop references · unlinked references · sorting ·
natural language · docked sidebar · marketplace packaging until it has been used for a week.
