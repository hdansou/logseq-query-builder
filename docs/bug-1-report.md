# BUG-1 — `:avet` scans miss datoms whose attribute was indexed after they were written

Draft for review, 2026-10-09. Nothing has been filed. Companion to the BUG-1 row in `TASKS.md`,
the "Priority missing from the property picker" note in `docs/probes.md`, and the `get-else`
workaround in `src/graph.ts` (`Graph.properties`).

## Verdict: REPRODUCED (mechanism), trigger on the original graph NOT REPRODUCED

The symptom — `[?p :logseq.property/public? true]` misses an entity whose pull shows
`:logseq.property/public? true`, while the same clause matches once `?p` is bound first — is a real
behaviour of the Datascript fork Logseq ships, and it was reproduced end to end on a throwaway graph
through the shipped db-worker (Logseq-DB 2.0.2, CLI revision `533ac43-dirty`). The mechanism is
established: a constant-value clause on an indexed attribute is answered from the `:avet` index;
the fork never back-fills `:avet` when an attribute *becomes* indexed (`:db/index true` transacted
as a datom), so any datom written while the attribute was unindexed is invisible to `:avet` for the
life of the graph; the storage layer persists the three indexes verbatim, so a restart, a
`graph validate`, or a `.sqlite` copy all keep the gap. An EDN export/import clears it because the
importer transacts schema datoms first. What was **not** reproduced is how `demolocal2` got into
that state: a fresh graph, the same graph after restarts, and two existing graphs (`Demo-Graph`,
`Library-Test`) all have a complete index. The original graph no longer exists on this machine, so
the real-world trigger stays a hypothesis (candidates below). Treat the "persisted-graph index
anomaly" wording in `probes.md` as half right: the gap is created in-session by a schema change and
then *persisted*; the persisted store is not where it originates.

## Environment

| Item | Value |
|---|---|
| OS | macOS 26.6.2 (Darwin 25.6.0), arm64 |
| Logseq desktop | `/Applications/Logseq-DB.app` and `/Applications/Logseq.app`, both 2.0.2 |
| CLI | `~/.local/bin/logseq` = `ELECTRON_RUN_AS_NODE` + `Logseq-DB.app/.../app.asar/js/logseq-cli.js`; `logseq --version`: build 2026-10-07T12:56:36Z, revision `533ac43-dirty` (same engine as the desktop db-worker) |
| db-worker | db-worker-node started by the CLI (`owner-source cli`), same revision |
| Graph schema version | `{:major 65 :minor 34}` (fresh graph) |
| Datascript | Logseq fork `logseq/datascript` @ `3f141af97b70e1f14c65eaa119acd822ebece37e` (2026-05-03), per `deps.edn` of the `logseq/logseq` checkout at `2.0.1-692-g5824434a74`; also run directly with Clojure CLI 1.12.5 for the library-level demo |
| Source checkout used for reading | `~/Projects/src/github.com/logseq` (2026-09-18) |

## What was checked, in the order of the TASKS.md plan

### 1. Fresh graph, after a full reload

Graph `qb-bug1-probe` created with `logseq graph create`. Queries right after creation, after
`server stop` / `server start` (restore from SQLite), after adding a public property and a
prioritised task and restarting again — all identical: the constant clause matches both Priority
and Status, 26 (then 27) entities carry `public? true`, 88 carry a `public?` value at all.

```sh
G=qb-bug1-probe
logseq graph create --graph $G
logseq query -g $G -o edn --query '[:find ?i :where [?p :logseq.property/public? true] [?p :db/ident ?i] [(contains? #{:logseq.property/priority :logseq.property/status} ?i)]]'
# => #{[:logseq.property/status] [:logseq.property/priority]}
logseq server stop -g $G; logseq server start -g $G   # same result after restore
```

Same result, read-only, on the user's `Demo-Graph` (initial schema 64.8, now 65.34) and
`Library-Test` (65.1 → 65.34): both list Priority from the constant clause, 26 public entities each.

### 2. `:avet` vs `:eavt` for the same entity

The CLI exposes no `d/datoms`, so the comparison was made with the two query shapes that use the
two indexes (constant-value clause → `:avet`; entity-bound clause → `:eavt`), plus `pull` and
`get-else`. On healthy graphs they agree. On the deliberately broken graph (step 4) they diverge
exactly as `probes.md` describes:

| Query | Result on broken `qb-bug1-probe` |
|---|---|
| `[?p :logseq.property/public? true] [?p :db/ident ?i]` (filtered to priority/status) | `#{[:logseq.property/status]}` — **Priority missing** |
| `[?p :logseq.property/public? ?v] [?p :db/ident ?i]` | `#{[:logseq.property/status true] [:logseq.property/priority true]}` |
| `[?p :db/ident :logseq.property/priority] [?p :logseq.property/public? ?v]` | `#{[81 true]}` |
| `(pull ?p [:db/id :logseq.property/public?])` for Priority | `{:db/id 81 :logseq.property/public? true}` |
| `[(get-else $ ?p :logseq.property/public? false) ?pub]` | `[:logseq.property/priority true]` |
| `(count ?p)` for `public? true` | 26 (was 27 before the break) |

### 3. Export/import round trip

- **EDN**: `graph export --type edn` of the broken graph still contains `[81 :logseq.property/public? true]`;
  importing it into a new graph gives a complete index (constant clause lists Priority again).
  Reason: `datoms-for-import` in `deps/db/src/logseq/db/sqlite/export.cljs` puts the schema datoms
  (`:db/index`, `:db/valueType`, `:db/cardinality`, `:db/ident`) first, so every value datom is
  transacted while its attribute is already indexed.
- **SQLite**: `graph export --type sqlite` + `graph import --type sqlite` into a new graph **keeps
  the gap** — it copies the stored indexes.
- `logseq graph validate` on the broken graph: `:errors nil`. The validator does not look at
  index consistency.
- Restart (`server stop`/`start`, which restores through `d/restore-conn`): gap kept.

### 4. Mechanism

Established by reading the fork and confirmed by running it:

1. `:logseq.property/public?` **is** indexed. Every property entity built by
   `sqlite-util/build-new-property` carries `:db/index true` (`deps/db/src/logseq/db/sqlite/util.cljs:81`);
   the export shows `[16 :db/index true]` on the `public?` property entity (eid 16 in a fresh
   graph) and `[81 :db/index true]` on Priority. So a constant-value clause is resolved through
   `:avet` (`datascript.db/-datoms`, `validate-indexed`), not `:aevt`.
2. Schema lives in datoms. The fork's `with-datom` (`src/datascript/db.cljc` ~1475) decides
   `indexing?` from the schema *at the moment the datom is added*; when a schema datom such as
   `[16 :db/index true]` arrives it only runs `update-schema` + `update-rschema`. **Nothing
   re-inserts already-present datoms of that attribute into `:avet`.** Retracting the index flag
   likewise leaves `:avet` entries behind (not exercised here).
3. Persistence keeps the gap. `logseq.db.common.sqlite/get-storage-conn` uses `d/restore-conn`,
   and `datascript.storage/restore-impl` rebuilds the DB record from the stored `eavt`, `aevt`
   and `avet` roots verbatim. Only a path that re-transacts datoms (`d/init-db`,
   `conn-from-datoms`, the EDN importer) recomputes `:avet`.
4. Logseq's own worker relies on the index being complete: `frontend.worker.pipeline/reference-attrs`
   reads `(d/datoms db :avet :logseq.property/public? false)` to decide which properties are
   private; `render_affected_keys/status-value?` reads `:avet :logseq.property/status` when the
   schema says it is indexed (and falls back to a query when it is not — upstream already knows
   graphs exist where `status` is unindexed). A gap therefore affects more than plugin queries.

Library-level demo (`scratchpad/avet_demo/demo.clj`, run with the pinned fork):

```
constant clause [?e :p/public? true]  -> (102)            ; only the datom added after :db/index
variable clause [?e :p/public? ?v]    -> (100 101 102)
entity-bound    [100 :p/public? ?v]   -> [true]
avet datoms: [[102 :p/public? true]]
eavt datoms: [[100 ...] [101 ...] [102 ...]]
```

Logseq-level repro through the shipped worker (the CLI has no raw transact, so the
`thread-api/transact` HTTP endpoint of the CLI-owned db-worker-node was used):

```sh
G=qb-bug1-probe; R=logseq_db_qb-bug1-probe
logseq graph create --graph $G          # Priority is eid 81, the public? property is eid 16 on a fresh graph
PORT=$(logseq server list | awk -v g=$G '$2==g {print $5}')
# one transaction: un-index public?, (re)write Priority's datom, re-index public?
curl -s -X POST http://127.0.0.1:$PORT/v1/invoke -H 'content-type: application/json' --data-binary @- <<EOF
{"method":"thread-api/transact","argsTransit":"[\"$R\",[[\"~:db/retract\",81,\"~:logseq.property/public?\",true]],[\"^ \"],null]"}
EOF
curl -s -X POST http://127.0.0.1:$PORT/v1/invoke -H 'content-type: application/json' --data-binary @- <<EOF
{"method":"thread-api/transact","argsTransit":"[\"$R\",[[\"~:db/retract\",16,\"~:db/index\",true],[\"~:db/add\",81,\"~:logseq.property/public?\",true],[\"~:db/add\",16,\"~:db/index\",true]],[\"^ \"],null]"}
EOF
logseq query -g $G -o edn --query '[:find ?i :where [?p :logseq.property/public? true] [?p :db/ident ?i] [(contains? #{:logseq.property/priority :logseq.property/status} ?i)]]'
# observed: #{[:logseq.property/status]}            expected: #{[:logseq.property/status] [:logseq.property/priority]}
logseq query -g $G -o edn --query '[:find ?p ?v :where [?p :db/ident :logseq.property/priority] [?p :logseq.property/public? ?v]]'
# observed: #{[81 true]}
logseq server stop -g $G && logseq server start -g $G   # gap survives the restore
logseq graph validate -g $G                             # :errors nil
```

Two observations from getting there:

- Un-indexing in one transaction and adding the datom in a *separate* transaction fails with
  `Attribute :logseq.property/public? should be marked as :db/index true`: the post-transact
  pipeline (`reference-attrs`) reads `:avet` for `public?` and the fork raises when the attribute is
  not indexed. The three operations had to share one transaction. The same error text is
  db-test #957 ("Import Error: Attribute :block/journal-day should be marked as :db/index true",
  labelled can't reproduce), which is likely the same class: code reading `:avet` while the
  stored schema disagrees with `db-schema/schema`.
- The `:db/add` of a datom that already exists is a no-op, so the repro needs a retract first.

### 5. Desktop app

Not run. The CLI binary *is* the desktop app's bundle (`Logseq-DB.app` 2.0.2, run with
`ELECTRON_RUN_AS_NODE`), and the plugin's `logseq.DB.datascriptQuery` path is
`logseq.api.db/datascript_query` → `frontend.db.async/<q` → `<invoke-db-worker :thread-api/q` →
`d/q` on the worker's conn (`src/main/frontend/worker/handler/query.cljs:18`) — the same engine and
the same code path the CLI exercises. The null hypothesis that the plugin observation was an
artifact of the plugin API (renderer-side partial DB, host query rewrite, extra SDK input) is
therefore unlikely: `<q` sends the query unchanged (only pull patterns are transformed, and only
with `advanced-query?`), and the renderer DB is not involved. If a desktop check is still wanted,
the same transaction can be sent from the desktop console with
`logseq.api` → `state/<invoke-db-worker :thread-api/transact` on a throwaway graph.

### What remains a hypothesis: how `demolocal2` got the gap

Nothing on this machine reproduces the *trigger* without a hand-made schema transaction. Fresh
graph creation is safe because `db-property/built-in-properties` is an `ordered-map` and the
`public?` property (defined near the top) gets its entity, and `:db/index true`, before the
built-ins that carry `public? true`. Candidates, none verified:

1. **Schema repairs on open.** `frontend.worker.db.fix/check-and-fix-schema!` runs on every graph
   open and transacts `db-schema/schema` diffs (including `:db/index`) onto the live conn; the
   validator's `fix-extends-cardinality!` adds `:db/index true` to `extends`. Any attribute whose
   index flag is (re)set this way keeps its older datoms out of `:avet`. `db-schema/schema` only
   covers `:block/*` and `:file/*` attributes, so this explains #957-style `:block/journal-day`
   cases, not `public?` directly.
2. **Out-of-order transactions for property attributes.** Anything that transacts a property's
   value datoms before the property entity's `:db/index true` — an older build, a migration that
   back-fills a built-in property, RTC/sync replay, or a block-level EDN import — produces the gap
   for exactly the entities written early. The P0 `status` case (fresh web-app graph on a dev
   build at `localhost:3001`) fits this better than the persisted-store theory; the
   `status-value?` guard in `render_affected_keys.cljs` shows upstream has met unindexed `status`.
3. **A stale `:avet` after an index flag was retracted and re-added** (type change of a property,
   closed-value rebuilds). Not exercised.

The P0 `status` note itself could not be found in `docs/probes.md` beyond the cross-reference in
the Priority section; if the raw observation is in `docs/probes.jsonl`, it did not surface in a
grep for `index`.

## Recommendation

- Keep **BUG-1 open as an upstream bug**, re-titled: "Datascript `:avet` is not rebuilt when an
  attribute becomes indexed; the gap is persisted and survives restarts, `validate`, and sqlite
  copies". It is reproducible on demand (above) and has user-visible consequences inside Logseq
  (`reference-attrs` privacy decisions, `status` lookups, any constant-value query from plugins or
  advanced queries). The *trigger* in normal use is unproven; say so in the issue.
- File at **logseq/db-test** (issues enabled; `logseq/datascript` has issues disabled). The draft
  below follows its `Bug Report` form.
- Suggested fixes to propose, in order of cost: (a) in the fork's `with-datom`, when a schema datom
  turns `:db/index` on, back-fill `:avet` from `:aevt` for that attribute (and drop entries when it
  turns off); (b) make `graph validate` (or `check-and-fix-schema!`) compare `:avet` cardinality per
  indexed attribute against `:aevt` and rebuild through `init-db` when they differ; (c) at least
  document that EDN export/import is the repair.

## Draft issue body (logseq/db-test, "Bug Report" form) — for review, not filed

**Search first** — searched for `avet`, `db/index`, `should be marked as :db/index`; #957 shares
the error text but reports the crash, not the stale index.

**What Happened?**

A Datascript query with a constant value on an indexed attribute (`[?p :logseq.property/public? true]`)
misses entities that a pull, a `get-else`, or an entity-bound clause (`[?p :db/ident X] [?p :logseq.property/public? ?v]`)
all return. The cause is that the Datascript fork does not back-fill the `:avet` index when an
attribute becomes indexed: datoms written while `:db/index` was absent for that attribute are never
added to `:avet`, and the storage layer persists the three indexes as they are. The gap survives a
restart (`d/restore-conn`), `logseq graph validate` reports no errors, and a sqlite export/import
carries it over. An EDN export/import repairs it (the importer transacts schema datoms first).

Logseq itself reads `:avet` for these attributes (`frontend.worker.pipeline/reference-attrs` on
`:logseq.property/public? false`; `render_affected_keys/status-value?` on `:logseq.property/status`),
so a gap changes behaviour beyond plugin queries. First seen in a real graph where the built-in
Priority property vanished from a plugin's property picker; reproduced on a fresh graph by replaying
the schema change below.

**Reproduce the Bug**

Fresh graph, CLI-owned db-worker-node (no desktop app has it open). The CLI has no raw transact, so
the worker's `/v1/invoke` endpoint is used for the schema change; eids 16 (property `public?`) and
81 (Priority) are what a fresh 65.34 graph assigns — check with `logseq debug pull --ident ...`.

```sh
G=avet-repro; R=logseq_db_$G
logseq graph create --graph $G
PORT=$(logseq server list | awk -v g=$G '$2==g {print $5}')
# inv <transit-args>: POST a thread-api/transact with the args given as a transit-json string
inv() { printf '%s' "$1" | python3 -c 'import json,sys; print(json.dumps({"method":"thread-api/transact","argsTransit":sys.stdin.read()}))' | curl -s -X POST http://127.0.0.1:$PORT/v1/invoke -H 'content-type: application/json' --data-binary @-; echo; }
inv '["'$R'",[["~:db/retract",81,"~:logseq.property/public?",true]],["^ "],null]'
inv '["'$R'",[["~:db/retract",16,"~:db/index",true],["~:db/add",81,"~:logseq.property/public?",true],["~:db/add",16,"~:db/index",true]],["^ "],null]'
Q='[:find ?i :where [?p :logseq.property/public? true] [?p :db/ident ?i] [(contains? #{:logseq.property/priority :logseq.property/status} ?i)]]'
logseq query -g $G -o edn --query "$Q"
logseq query -g $G -o edn --query '[:find ?p ?v :where [?p :db/ident :logseq.property/priority] [?p :logseq.property/public? ?v]]'
logseq server stop -g $G && logseq server start -g $G && logseq query -g $G -o edn --query "$Q"
logseq graph validate -g $G
```

Observed:

```
#{[:logseq.property/status]}                 ; Priority missing from the constant-value clause
#{[81 true]}                                 ; but present when the entity is bound first
#{[:logseq.property/status]}                 ; still missing after restart
result {... :errors nil ...}                 ; validate sees nothing
```

The same split reproduces with the fork alone (`logseq/datascript` @ `3f141af`): create a conn with
`{:db/ident {:db/unique :db.unique/identity}}`, transact `{:db/ident :p/public? :db/cardinality :db.cardinality/one}`,
add `[100 :p/public? true]`, then `[[:db/add [:db/ident :p/public?] :db/index true]]`, then
`[101 :p/public? true]`: `(d/q '[:find [?e ...] :where [?e :p/public? true]] db)` → `[101]`,
`(d/datoms db :avet :p/public?)` → one datom, `:eavt` → two.

Side finding: doing the un-index and the re-add in *separate* transactions fails with
`Attribute :logseq.property/public? should be marked as :db/index true`, raised from the
post-transact pipeline's `:avet` read — the same message as #957.

**Expected Behavior**

Turning `:db/index` on for an attribute re-indexes its existing datoms (or the change is rejected),
so `[?e :attr v]`, `[?e :attr ?v]`, `pull` and `get-else` agree; `graph validate` flags an `:avet`
that disagrees with `:aevt` for an indexed attribute.

**Browser, Desktop or Mobile Platform Information**

macOS 26.6.2 arm64; Logseq-DB.app 2.0.2; CLI revision `533ac43-dirty` (build 2026-10-07), db-worker-node
owned by the CLI; graph schema version 65.34; Datascript fork `3f141af97b70e1f14c65eaa119acd822ebece37e`.

**Additional Context**

How a real graph reaches this state without a hand-made transaction is not pinned down. Candidates:
`check-and-fix-schema!` / `fix-extends-cardinality!` setting `:db/index` on a live conn, migrations or
sync replay that write a property's values before its `:db/index true` datom, or an index flag that
was retracted and re-added. Fresh graph creation is safe (built-in properties are an ordered map).

## Should the `get-else` workaround in `src/graph.ts` stay?

**Yes.** `Graph.properties` reads `built-in?`, `public?`, `hide?` and `deleted-at` with `get-else`
(entity lookups via `:eavt`) and filters in code. That path is immune to the `:avet` gap, the cost
is negligible on the property-entity set (a few hundred rows), and the alternative (trusting
`:avet`) is exactly what failed on a real graph. Keep it until upstream rebuilds `:avet` on schema
change *and* the user's graphs have been through a path that recomputes the index (EDN re-import or
an upstream repair). Two notes for the code:

- The comment at `src/graph.ts:71-73` can be sharpened from "the attribute index for
  `:logseq.property/public?` missed Priority" to "`:avet` is not rebuilt when an attribute becomes
  indexed; see docs/bug-1-report.md".
- The same consideration applies to any other constant-value clause the emitter produces on a
  *property-entity* attribute (`hide?`, `built-in?`). Clauses on *block* property values
  (`[?b :user.property/x ?v]`) bind `?b` through other clauses first in the emitted forms and are
  resolved through `:eavt`/`:aevt`, so they are not affected unless they stand alone.

## Housekeeping

- The broken graph `qb-bug1-probe` is kept under `~/logseq/graphs` for inspection (its server is
  CLI-owned; `logseq graph remove -g qb-bug1-probe` when done). The round-trip graphs
  (`qb-bug1-probe-rt`…`rt4`) were removed. No user graph was written to; `Demo-Graph` and
  `Library-Test` were only queried and their CLI servers stopped afterwards.
- Scratch files (EDN/sqlite exports, `invoke.sh`, `avet_demo/demo.clj`) live in the session
  scratchpad, not in the repo.
