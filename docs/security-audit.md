# Security audit — 2026-09-26

Scope: the whole plugin (`src/`, `scripts/`, `probes/`, manifest, dependencies) at commit ec7a74a.
Risk level: **LOW**. The plugin runs inside Logseq's plugin sandbox, has no network access, no
credentials and no server side; it reads the user's graph through the plugin API and writes only
the block the user asks it to.

## Attack surface

| Boundary | What crosses it |
|---|---|
| User input | picker text, free-text values, a regular expression, the query name |
| Graph data | tag/property idents and node uuids from the graph; the saved `query-builder-state` JSON on a query block, which travels with a shared or synced graph |
| Host page | `postMessage` into the frame (dev builds only); `provideStyle` CSS injected into the host document |
| Outbound | none in production; the dev probe sink POSTs to the vite server |

## Findings

**SEC-001 · medium, fixed.** Idents and uuids were embedded verbatim in the emitted Datalog. They
come from the graph and from a block's saved state, so a crafted state property on a shared graph
could close the `#uuid "…"` literal and append clauses. Impact was bounded to a read-only query in
the reader's own graph (Datascript exposes no arbitrary code execution), but the emitter now
refuses any uuid or ident outside a safe character set and fails fast (`src/emit.ts`, unit test).
User-typed text was already escaped through `str()`.

**SEC-002 · low, fixed.** The dev-only `postMessage` hook accepted messages from any window that
could reach the frame. It now answers only the embedding host page (`e.source === window.parent`).
The hook is compiled out of production builds (verified: the bundle contains no `qbReply`).

**SEC-003 · low, fixed.** The plugin id is interpolated into a CSS attribute selector passed to
`provideStyle`. It is host-assigned, but a `"` or `]` would escape the selector; the id is now
validated against `[\w-]+` before use.

**SEC-004 · informational.** The content search's *matches* operator passes the user's regular
expression to `re-pattern`. A catastrophic pattern would stall the user's own app, and an inserted
query block re-runs on every graph change. Same exposure as typing the query by hand; not changed.

**SEC-005 · informational.** Console logs carry block uuids and the insert plan (no secrets, no
content). Acceptable for a local plugin.

## Checklist results

- No `eval`, `new Function` or HTML from data: `innerHTML` is used only to clear containers and for
  one static SVG. Pickers build DOM with `textContent`.
- No shell from user input: the probe test uses `execFileSync` with an argument array; the graph
  name comes from the developer's command line.
- No secrets in the tree; `.env*` ignored; no `.env` files present.
- Dependencies: one runtime dependency (`@logseq/libs`), `npm audit` 0 vulnerabilities, transitive
  `dompurify` and `lodash-es` pinned by `overrides`, lockfile committed.
- No crypto, no file system, no cookies, no storage outside the graph.

## Re-run

`npm audit`, then `npx vitest run src/emit.test.ts -t SEC-001`, and grep the built bundle for
`qbReply` (must be absent).
