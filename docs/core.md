# Core modules (P1)

Pure TypeScript, no DOM, no Logseq API. `npm test` covers all of it.

| Module | Owns | Never does |
|---|---|---|
| `model.ts` | the builder state (`Query`) and pure reducers | know about Datalog or controls |
| `operators.ts` | which operators each property type offers, arity, label, value-control kind | emit anything |
| `dates.ts` | accepted relative expressions, their native input keywords, absolute literals, `bounds` = day-granularity comparison | format UI text beyond `describeRelative` |
| `guard.ts` | whether a query can run: a positive clause exists and OR-joined clauses are positive; `rowComplete` | reorder anything |
| `emit.ts` | state → Datalog for preview and block (same `:where`, different `:find`); variable naming; input dedup; `RULES` | validate (it asserts the guard) |
| `readback.ts` | the plain-English line | – |

Rules that keep the three "exactly one definition" promises from the briefing:

- Operator semantics: `dates.ts` `bounds` for date operators, `emit.ts` `rowClause` for the rest,
  keyed by `OperatorId` from `operators.ts`. Add an operator in `operators.ts` first; the
  `Record<OperatorId, …>` types force the other two to follow.
- Type-to-control: `operators.ts` `controlFor`.
- Datalog emission: `emit.ts` only. Probes import `RULES` from it.

Variable naming in emitted Datalog: tag *i* uses `?tagI`/`?tI`; row *n* uses `?vN`/`?xN`/`?eN`,
contains-all values `?vN_K`; inputs `?in1…` in first-use order, deduplicated by keyword.

Ordering: tags, content, rows are each folded flat left-to-right (OR → `or-join [?b ?in…]`), then
all positive clauses are emitted before negations so `?b` is bound. Within a conjunction that
reordering is semantically free.
