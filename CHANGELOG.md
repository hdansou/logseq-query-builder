# Changelog

All notable changes to this plugin are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow semver.

## [Unreleased]

### Added
- Floating, draggable, resizable builder panel opened with `⌘⇧F`, from the command palette, or with the `/Query Builder` slash command.
- Tag selector with autocomplete over the graph's tags (most-used first), AND / OR / NOT, an "any tag" presence test, and sub-tag inheritance on by default.
- Filter rows (`property · operator · value`) for the eight DB property types, with operators taken from the type, values picked from the graph with usage counts, free entry for text and numbers, node search, and a date control that accepts `today`, `tomorrow`, `yesterday`, `±Nd/w/m/y` or `YYYY-MM-DD`.
- Content search on the node's own text: contains, does not contain, starts with, regular expression.
- The query's plain-English read-back is the suggested name, prefilled in the name field and editable; a toggle shows the Datalog to be inserted.
- Live results (first 10, load more) with the values of the filtered properties and the page each node lives on; selecting a result jumps to it and keeps the builder open.
- Insert as a named, live `#Query` node: a new sibling from the shortcut path, or into the current block from the slash path. Relative dates are stored as native query inputs so inserted queries stay current.
- Reopening the builder on an inserted query block restores its filters from a hidden state property.
- Keyboard-only path: `⌘⇧F` open, `↩` pick, `Tab` next, `⇧↩` add filter, `⌘↩` insert, `Esc` close.
- Host theme tokens copied into the panel, refreshed on theme change (light and dark verified).

### Internal
- Persona end-to-end run: `scripts/seed-persona.mjs` builds a realistic graph with the CLI and checks the engine's count for every scenario against the design; `docs/e2e-persona.md` holds the scenarios, flows and run log. CLI probe fixtures can now name tags, properties, pages and node targets by title (idents and uuids are resolved on the graph).
- Headless DOM tests for the panel (happy-dom), a dev-only `postMessage` test hook for driving the panel from the host page, and `npm run probe -- <graph>` to check emitted Datalog counts on a CLI graph (`docs/probes-cli.json`).

### Security
- Security audit (`docs/security-audit.md`): idents and uuids from the graph or a saved state are validated before they are embedded in the emitted Datalog; the dev-only test hook answers only the host page; the plugin id is validated before it enters a CSS selector.
- Cleared all eight `npm audit` advisories: `dompurify` and `lodash-es` (transitive through `@logseq/libs`) are pinned to patched versions with `overrides`; `esbuild` and `vite-node` are cleared by moving the toolchain to vite 7 and vitest 4.

### Fixed
- A content search, the *on page* scope and *on page under* no longer return property values as nodes: a text value such as "Active" is an entity on the node's page and a closed value such as Priority's "High" has a title, so `contains "active"` listed the value itself (BUG-10, found in the persona run on 2026-10-09).
- A content operator chosen before the text is typed is kept; it used to snap back to "contains" (BUG-15).
- "Any tag" now means the user's tagged nodes: property and tag pages, built-in pages and closed values no longer count (BUG-14; 185 → 27 on the persona graph).
- Picking a tag or value with the mouse no longer pops the whole option list back open over the next zone; a list that was open when results arrived stays open (BUG-9).
- Opening the panel no longer pulls focus back into the tag picker from a control the user has already reached in the first second (BUG-11).
- The tag list no longer opens by itself when the panel opens; it opens on typing or ↓, so the Filters and References buttons under it are clickable at once (BUG-12). The Insert button's label no longer wraps (BUG-13).
- The panel stays inside the window: a layout saved on a large screen could put the footer, Insert included, below a smaller window; the panel is now capped to the viewport each time it opens (FEAT-50).
- Theme switch could leave the panel on the previous theme's colours: the host fires theme-changed while it injects the new stylesheet, before it has loaded, so the tokens were read too early. They are now read again 250 ms and 1000 ms after each theme or mode change, and the last read wins. Confirmed live 2026-10-04 on Logseq-DB 2.0.1 (second instance): switching between two dark themes, the tokens read at the event were the old theme's; 1.8 s later they matched the host.
- The result count sits at the right end of the name row instead of under the list.
- `Page` is offered in the tag selector, so "all pages" and "pages tagged X" can be built; it had been hidden with the structural tags.
- Text typed into a picker is no longer lost when live results arrive and the panel re-renders; only text being composed is carried over, so a freshly picked property keeps its label.
- In the reference target search, pages come before blocks.
- A newcomer cheatsheet, `docs/cheatsheet.md`, linked from the README.
- A magnifier icon marks the query name row.
- The footer stays visible when the panel is resized small: everything above it scrolls as one.
- A long query name wraps onto more lines instead of being cut off at the right, and spaces typed into it are no longer swallowed.
- Result rows and node search show `[[Project Iris]]` instead of `[[<uuid>]]`: links in a block's title are resolved through its pulled references.
- The Library scope no longer fails with `Insufficient bindings` on a graph whose Library holds pages: the "page itself" branch of its `or` now binds the result variable with `identity` instead of comparing an unbound one.
- Result rows are vertically centred and separated by a hairline, so one row is distinguishable from the next.
- Priority (and any property whose `public?` datom is missing from the attribute index on a persisted graph) now appears in the property picker: visibility flags are read per entity instead of scanned by value.
- The panel stays opaque while being dragged; the host fades dragged plugin windows to 70%, which read as transparent on light themes.
- The open shortcut is `⌘⇧F`, not `⌘⇧Q`, which is the macOS log-out chord. It takes over Logseq's toggle-favorite while the plugin is enabled; rebind in the keymap settings if needed.
- The hidden state property's schema is ensured right before every write, never changing an existing property's type; a write racing the startup call could leave a visible, untyped `state` property on the block.

### Added (after the first implementation)
- **Scope** zone above the tags, choosing where the query looks:
  - *anywhere* (default);
  - *in the Library*: pages inside Logseq's built-in Library page, at any depth, and the blocks on them;
  - *on page…*: the blocks that live on a page picked by title.
  A scope counts as a positive clause, so a scope with only NOT filters can run. The read-back says "on X" or "in the Library"; queries saved before scopes existed reopen as *anywhere*.
- **References** zone between the filters and the content search, one row per relationship: *links to*, *is linked from*, *ancestor links to* or *on page under*, then a target that is one node or *any \<tag\>* (sub-tags included), optionally narrowed by a name fragment. Rows combine with AND / OR and can be NOT; a reference row counts as a positive clause. *Is linked from* a page reads the page and its blocks; a tag's own objects and a block's property keys are not treated as links; blocks on Logseq's hidden view pages are left out. The short-lived *referenced in page…* scope is gone: it is *is linked from · page*. Queries saved before reference rows existed reopen without any. A tag target also takes property conditions (*+ condition on the target*), evaluated on the target set with the filter-row controls: "is linked from any Task whose Status is Todo".
- `Page` is offered in the tag selector, so "all pages" and "pages tagged X" can be built.
- The round-trip property is named `query-builder-state` instead of `state`, so it cannot be mistaken for a user's own property; blocks inserted under the old name still reopen.
- Date values use the same picker as everything else: focus shows the relative shortcuts with their meaning (`-7d · 7 days ago`), typing filters them, and free text accepts an ISO day or any `±Nd/w/m/y`. A calendar button beside it fills in a day. The browser datalist is gone; its arrow only listed entries matching the current text.

### Notes
- Requires `@logseq/libs` 0.3.4 or later: 0.2.x drops the last input of `datascriptQuery`.
- DB graphs only.
