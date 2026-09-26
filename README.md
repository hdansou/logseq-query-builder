# Query Builder

Build a Logseq DB query visually — choose where to look, pick tags, add typed property filters,
optionally search node text — see the matching nodes as you go, jump to one, or insert the query
into a page as a named, live query node. No Datalog written by hand.

![Query Builder panel: a tag chip, three typed filter rows, the plain-English read-back and a matching node with its property values](docs/screenshot.jpg)

> **Status: first implementation complete, used on a scratch graph only.** State and next steps:
> [`TASKS.md`](./TASKS.md). Loading it for testing: [`INSTALL-DEV.md`](./INSTALL-DEV.md).
> Design record: [`PLAN.md`](./PLAN.md), the spec and prototype in `logseq-query-builder-handoff/`,
> live findings in [`docs/probes.md`](./docs/probes.md). Changes: [`CHANGELOG.md`](./CHANGELOG.md).

## Using it

Open the builder with **⌘⇧F** (also "Query Builder: open" in the command palette), or type
**/Query Builder** inside a block. While the plugin is enabled, ⌘⇧F
takes over Logseq's toggle-favorite shortcut; rebind either in Logseq's keymap settings. The panel floats: drag it by its title bar, resize it from the
corner, click the graph behind it.

| Zone | What it does |
|---|---|
| **Scope** | Where to look: *anywhere* (default), *in the Library*, *on page…*, or *referenced in page…*. See [Scopes](#scopes). |
| **Name** | The query's title once inserted. Prefilled with a plain-English reading of your filters; edit or replace it. |
| **Tags** | Autocomplete over your graph's tags, most-used first. Several tags combine with AND / OR; each can be NOT. "any tag" is a presence test. *Include sub-tags* (on by default) also matches tags that extend the chosen one. |
| **Filters** | One row per property: property → operator → value. Operators follow the property's type (text, number, URL, node, asset, date, date-time, checkbox). Rows combine with AND / OR left to right, each can be NOT. Values are picked from what the graph actually holds, with counts; text and numbers also accept free entry; dates accept `today`, `tomorrow`, `yesterday`, `±Nd/w/m/y` or `YYYY-MM-DD`, typed or picked from the calendar button beside the field. |
| **Content** | Search the node's own text: contains, does not contain, starts with, or a regular expression. |
| **Results** | The first 10 matches with the values you filtered on and the page they live on; *Show more* reveals the rest. Click or select one to jump to it — the builder stays open. |

The **datalog** toggle in the footer shows what would be inserted.

### Scopes

A scope narrows the whole query before tags and filters apply. It counts as a filter on its own,
so a scope with only NOT filters still runs.

| Scope | Returns | Typical use |
|---|---|---|
| **anywhere** | every node in the graph | the default |
| **in the Library** | pages inside Logseq's Library page (any depth) and the blocks on them | "tasks in my library pages", "library pages without a description" |
| **on page…** | the blocks that live on the page you pick | "tasks on my Sprint page" |
| **referenced in page…** | nodes that the blocks of the page you pick reference | pick your `Book` page, add the tag `artist`: every artist mentioned in that book, without leaving the page |

*On page…* and *referenced in page…* are different questions: the tasks written on a page are *on*
it; the people, books or tags those tasks mention are *referenced in* it. Two details about
*referenced in page…*: references are taken from the page's blocks, not from the page's own
properties, and Logseq records the properties and tags a block uses as references too.
Without a tag or filter you will therefore see entries such as *Status* or *Task* among the
results; add the tag you are after and they drop out.

### Keys

`↩` pick · `Tab` next control · `⇧↩` add a filter · `⌘↩` insert · `Esc` close a list, then the panel

### Insert

*Insert* writes a `#Query` node: from the shortcut, a new sibling after the block you were editing;
from the slash command, into that block. The node renders as a live query table like a hand-written
one. Relative dates are stored as expressions, so the query stays current. Reopening the builder
while editing that block brings its filters back.

## Privacy

The plugin reads your graph through the Logseq plugin API to fill its pickers and preview results.
It writes only what you ask it to: the target block (tag, query text, title) and one hidden
property on that block, `query-builder-state`, holding your filters as JSON so the block reopens in
the builder with the same chips. It is hidden by default; Logseq's per-block "Show hidden
properties" toggle reveals it. Nothing is sent anywhere; there is no network
access, telemetry or storage outside your graph.

## Limits (first implementation)

Flat composition only (no parenthesised groups), a list view (no table), relative dates limited to
what the host resolves natively (no "start of week"), no sorting. See `TASKS.md` for what comes
later.

## Development

```bash
npm install
npm run dev        # vite on :8291 — see INSTALL-DEV.md to load it in the web app
npm test           # vitest
npm run typecheck
npm run build      # dist/
```
