# Query Builder

Build a Logseq DB query visually — pick tags, add typed property filters, optionally search node
text — see the matching nodes as you go, jump to one, or insert the query into a page as a named,
live query node. No Datalog written by hand.

> **Status: first implementation complete, used on a scratch graph only.** State and next steps:
> [`TASKS.md`](./TASKS.md). Loading it for testing: [`INSTALL-DEV.md`](./INSTALL-DEV.md).
> Design: [`PLAN.md`](./PLAN.md) and the spec in `logseq-query-builder-handoff/`.

## Using it

Open the builder with **⌘⇧Q** (also "Query Builder: open" in the command palette), or type
**/Query Builder** inside a block. The panel floats: drag it by its title bar, resize it from the
corner, click the graph behind it.

| Zone | What it does |
|---|---|
| **Name** | The query's title once inserted. Required for Insert. |
| **Tags** | Autocomplete over your graph's tags, most-used first. Several tags combine with AND / OR; each can be NOT. "any tag" is a presence test. *Include sub-tags* (on by default) also matches tags that extend the chosen one. |
| **Filters** | One row per property: property → operator → value. Operators follow the property's type (text, number, URL, node, asset, date, date-time, checkbox). Rows combine with AND / OR left to right, each can be NOT. Values are picked from what the graph actually holds, with counts; text and numbers also accept free entry; dates accept `today`, `tomorrow`, `yesterday`, `±Nd/w/m/y` or `YYYY-MM-DD`. |
| **Content** | Search the node's own text: contains, does not contain, starts with, or a regular expression. |
| **Results** | The first 10 matches with the values you filtered on and the page they live on; *Show more* reveals the rest. Click or select one to jump to it — the builder stays open. |

The line above the results reads the query back in plain English. The **datalog** toggle in the
footer shows what would be inserted.

### Keys

`↩` pick · `Tab` next control · `⇧↩` add a filter · `⌘↩` insert · `Esc` close a list, then the panel

### Insert

*Insert* writes a `#Query` node: from the shortcut, a new sibling after the block you were editing;
from the slash command, into that block. The node renders as a live query table like a hand-written
one. Relative dates are stored as expressions, so the query stays current. Reopening the builder
while editing that block brings its filters back.

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
