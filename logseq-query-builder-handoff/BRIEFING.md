# Logseq Graphical Query Builder — handoff to Claude Code

## What this is
A Logseq DB plugin that lets a user build a query visually — pick tags, add typed
property filters, optionally search node content — then either jump to a result or
insert the query into a page as a named, live `query` node.

## Files in this bundle
- `SPEC.md` — exported 2026-09-25 from the Claude Doc
  (https://claude.ai/code/artifact/ef12ac42-a69e-446c-942e-0def5c78f5ca, rev 33) and
  grounded against the Logseq source the same day (see its final **Grounding** section).
  It is the requirement — intent and behaviour, not implementation — and the source of
  truth for *what* to build. The Claude Doc is now behind this file.
- `prototype.html` — a working, self-contained prototype. Open it in a browser, or read
  the source. It contains a fake graph of ~330 nodes, a query engine implementing the
  real operator semantics, relative-date resolution, the keyboard flow, and a Datalog
  emitter. **Read this for behaviour the prose spec leaves implicit.**
- `BRIEFING.md` — this file.

## Status
The spec is settled at the level of intent. It has NOT been checked against the Logseq
source. Assumed identifiers — attribute names, the query node schema, plugin API shapes —
are guesses. The Datalog the prototype emits is a sketch for the same reason.

## First task, before any feature work
Ground the spec against the actual Logseq repository. The "Grounding this document
against the source" list at the end of SPEC.md enumerates what to verify. Update SPEC.md
in place, replacing assumed identifiers with verified ones, and note anything the source
contradicts. Do not start building until this is done — several design decisions depend
on the answers.

Of particular note: relative dates are believed to be natively supported. If so, the
builder must store the relative expression and let the host resolve it, NOT resolve it
itself and store a fixed date, or saved queries will go stale.

## How to work

**Test-driven development.** Write the failing test first, then the code that passes it.
Every behaviour in the spec should have a test that would fail if the behaviour
regressed. The operator semantics table in SPEC.md is directly translatable into test
cases — start there.

**KISS.** Prefer the simple implementation. The spec deliberately defers nesting, table
view and dual layouts to avoid premature generality; don't reintroduce them speculatively.

**DRY.** The operator semantics, the type-to-control mapping and the Datalog emission
each have exactly one definition. If the same rule is expressed in two places, collapse it.

**Task decomposition.** Break the work into well-defined, independently verifiable tasks
before starting, and work through them continuously. Each task should have a clear done
condition expressed as passing tests.

**Sub-agents.** Use them where work is genuinely parallelisable — e.g. source
verification of separate subsystems, or building independent test suites — rather than
serialising everything.

**Version control.** Commit incrementally with Git as work proceeds — one commit per
completed task, made when its tests pass, not one large commit at the end. Commit
messages should say what changed and why, so the history is readable as a record of the
build. Keep the working tree clean between tasks.

**Documentation as you go.** Document changes as they are made, not retrospectively.
That means keeping SPEC.md current when implementation reveals something the spec got
wrong or left out, recording design decisions and their rationale where they are made,
and maintaining developer-facing notes on how to run, test and extend the plugin. A
decision that took thought is worth a sentence explaining why the alternative was
rejected.

## UI validation
Use the Logseq web app together with the Chrome integration to validate the UI against
the spec, rather than relying only on unit tests over the fake graph. Confirm that each
feature described in SPEC.md is actually implemented and behaves as written — the
progressive-disclosure flow, the keyboard-only path, the floating panel, the two entry
points, and click-through navigation from a result.

## Decisions already made — do not relitigate without reason
- Emit Datalog (advanced queries), not the simple query DSL.
- Flat left-to-right composition in v1; nested grouping deferred.
- Floating, draggable, non-modal panel. Not a docked sidebar, and not both.
- Clicking a result does not close the builder.
- Tag inheritance on by default, with a toggle for exact-tag matching.
- Results: first 10, load more.
- Theme from the host's CSS custom properties; no bespoke palette.
- Keyboard-first: the whole query must be buildable without a mouse.
