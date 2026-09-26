# Query Builder — task tracker

Single source of truth for work in this repo. Nothing gets implemented before it has an entry here.

**Conventions**
- IDs: `FEAT-n` (capability), `BUG-n` (wrong behaviour), `TASK-n` (chore/infra).
- Status: `todo` · `doing` · `done` · `blocked` · `wontfix`.
- Every item names its **acceptance test**. TDD: that test is written and failing before the code.
- One item = one reviewable change. If it needs more than one acceptance test, split it.
- Update this file in the same change as the code. Docs land with the feature, not after.

**Working agreements** (standing)
- TDD — test first, watch it fail, then the smallest code that passes.
- KISS — no abstraction until the second caller exists.
- DRY — but duplication is cheaper than the wrong abstraction; prefer extracting after the third repeat.
- Document as we progress: `README.md` for users, `INSTALL-DEV.md` for testing, this file for state.
- UI-producing items are accepted on what is **rendered**, not on stored state.

---

## Done

| ID | Type | Title | Acceptance |
|---|---|---|---|
| TASK-1 | task | Scaffold: TS + vite + vitest, manifest-shaped `package.json`, empty modal on `⌘⇧Q` | `npx vitest run` green; `npx vite build` produces `dist/`; `npx tsc --noEmit` clean |
| TASK-2 | task | Ground `SPEC.md` against the Logseq source | All seven items answered with `path:line` evidence in `SPEC.md` § Grounding; Datalog sketch rewritten; three decisions flagged for sign-off (relative-date set, round-trip state property, iframe theming by token copy) |

## Now

| ID | Type | Title | Status | Acceptance test |
|---|---|---|---|---|
| TASK-3 | task | Derive `PLAN.md` from the grounded spec; break the first implementation into FEAT items here | todo (blocked on the three sign-offs in `SPEC.md` § Grounding 2, 6, 7) | `PLAN.md` exists with phases, risks, verified-API list; every FEAT item has an acceptance test named |

## Next

_(filled from TASK-3)_

## Bugs

| ID | Title | Status | Evidence |
|---|---|---|---|

