# Changelog

All notable changes to this plugin are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow semver.

## [Unreleased]

### Added
- Floating, draggable, resizable builder panel opened with `⌘⇧Q`, from the command palette, or with the `/Query Builder` slash command.
- Tag selector with autocomplete over the graph's tags (most-used first), AND / OR / NOT, an "any tag" presence test, and sub-tag inheritance on by default.
- Filter rows (`property · operator · value`) for the eight DB property types, with operators taken from the type, values picked from the graph with usage counts, free entry for text and numbers, node search, and a date control that accepts `today`, `tomorrow`, `yesterday`, `±Nd/w/m/y` or `YYYY-MM-DD`.
- Content search on the node's own text: contains, does not contain, starts with, regular expression.
- The query's plain-English read-back is the suggested name, prefilled in the name field and editable; a toggle shows the Datalog to be inserted.
- Live results (first 10, load more) with the values of the filtered properties and the page each node lives on; selecting a result jumps to it and keeps the builder open.
- Insert as a named, live `#Query` node: a new sibling from the shortcut path, or into the current block from the slash path. Relative dates are stored as native query inputs so inserted queries stay current.
- Reopening the builder on an inserted query block restores its filters from a hidden state property.
- Keyboard-only path: `↩` pick, `Tab` next, `⇧↩` add filter, `⌘↩` insert, `Esc` close.
- Host theme tokens copied into the panel, refreshed on theme change (light and dark verified).

### Security
- Cleared all eight `npm audit` advisories: `dompurify` and `lodash-es` (transitive through `@logseq/libs`) are pinned to patched versions with `overrides`; `esbuild` and `vite-node` are cleared by moving the toolchain to vite 7 and vitest 4.

### Fixed
- The hidden state property's schema is ensured right before every write, never changing an existing property's type; a write racing the startup call could leave a visible, untyped `state` property on the block.

### Notes
- Requires `@logseq/libs` 0.3.4 or later: 0.2.x drops the last input of `datascriptQuery`.
- DB graphs only.
