# docs/

The source of record for *what* the plugin is lives in `../logseq-query-builder-handoff/`:

- `SPEC.md` — the requirement (exported from the Claude Doc, then grounded against the Logseq source)
- `prototype.html` — the interactive prototype; read it for behaviour the prose leaves implicit
- `BRIEFING.md` — how to work on this repo

This folder holds developer-facing notes written as the build proceeds:

| File | What it is |
|---|---|
| `cheatsheet.md` | For users who have never written a query: the panel in one sentence, the reference directions, the keys |
| `probes.md` | Live probes (P0 onwards): every emitted form run on a real graph, with what came back and what it changed |
| `probes-cli.json` | Emitter fixtures checked read-only on CLI graphs (`npm run probe -- <graph>`); titles are resolved on the graph |
| `e2e-persona.md` | The acceptance run: a persona, a seeded graph, scenarios with pre-committed counts, flows, run log, how to re-run |
| `ui-testing-approaches.md` | Headless vs CDP+desktop vs Claude-in-Chrome vs Playwright on the web app: what each found here, when to use which |
| `security-audit.md` | TASK-9: the audit, its findings and what was fixed |
| `bug-1-report.md` | Draft report on the upstream index bug (BUG-1), for review before filing |
| `screenshot.jpg`, `example-*.jpg` | The README images: the panel and three examples, captured on the Logseq KM sample graph (2026-10-11) |
| `core.md` | The pure core modules (P1): what each does and how `npm test` covers it |
