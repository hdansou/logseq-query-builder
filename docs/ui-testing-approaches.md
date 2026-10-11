# Four ways to test the panel, compared

Written 2026-10-10 after the persona run (`e2e-persona.md`). Everything here is from this repo's
own record: `probes.md` (the Chrome-extension runs of 2026-09-26), the P3/P4 live checks in the
web app with Playwright, and the desktop run of 2026-10-09. Nothing is quoted from vendor docs.

## The four

| | 1. Headless | 2. CDP + desktop app | 3. Claude in Chrome + web app | 4. Playwright + web app |
|---|---|---|---|---|
| What runs | happy-dom in Vitest; the panel rendered from a `Store` with fake `datascriptQuery` and `insert` | the installed Logseq-DB.app, a second instance with its own profile, the real plugin from `dist/`, Playwright attached over CDP inside the plugin frame | app.logseq.com / test.logseq.com (or `localhost:3001` from the Logseq repo) in your Chrome, driven by the extension | the same web app in a Playwright-controlled headed Chrome (`playwright-cli`) |
| Graph | none (fakes) | any CLI-created graph, switched to before any write | your real browser's graphs (in-memory demo or OPFS) | same |
| Plugin loaded how | not loaded; `renderPanel()` composes the zones | from `~/.logseq/preferences.json` externals, the production bundle | `LSPluginCore.register` from the console, per session, random plugin id unless `key` is passed | same |
| Reaches inside the iframe | n/a (it *is* the DOM) | yes: `frame().locator(...)`, real pointer and keyboard events | **no**: synthetic clicks do not reach the cross-origin frame; keys go to whichever frame has focus | yes: `f`-prefixed refs click through; keys to the focused frame |
| Catches | pure rendering, re-render bugs (BUG-3/4/7, 9, 15), focus rules (BUG-11), read-back wording | everything the user sees: host layout (FEAT-50), theme tokens (BUG-8), focus hand-off on open (BUG-11/12), insert + round trip, result navigation, the real Datascript engine | the Datalog forms (P0: 32 operator rows), insert sequence, shortcut collisions, what the host renders | the same as 3 plus in-frame clicks and DOM measurement |
| Misses | anything the host does: focus hand-off, layout memory, theme, the engine, `%` rules, insertion | the web build if it differs; real-mouse-only regions (drag strip, drags into the frame) unless the swift helpers are used | mouse behaviour inside the panel (BUG-9/12 were invisible to it); typing out of phase lands in the host editor (it once created a stray property) | OPFS/SQLite needs headed mode; in-memory demo graphs vanish on reload |
| Cost per run | milliseconds; `npm test` | ~1 min to launch, ~15 s per scenario, 10 min for 26 scenarios × 1 mode | minutes per scenario, by hand, with screenshots between keystrokes | seconds per step, scriptable |
| Setup cost | none | the skill's scripts; a throwaway graph; the plugin installed as an external | the extension, a registered plugin, patience | `pnpm watch` in the Logseq repo or the hosted app; Developer mode for URL install |
| Safe for the user's data | yes | yes if the graph switch is confirmed before any write (it shares `~/.logseq` with the running app) | risky: it is the user's browser profile and graphs | same as 3 |
| Repeatable | fully | fully (seed script, scenario JSON, driver) | no | mostly (refs change per snapshot) |

## What each one actually found here

- **Headless** found and now guards 8 regressions (BUG-3, 4, 5, 7, 9, 11, 12, 15). It is the only
  layer that runs in CI and in under a second. It told the truth about focus restore and the
  select rebuild — once the test *asked*. Its two lies this session: `option.selected` before
  append is ignored, and a picker's list paints a tick after `focus()`.
- **CDP + desktop** found the eight defects of 2026-10-09, five of them in interaction (focus,
  lists, layout), three in the emitter against the real engine (BUG-10, 14, and the S3b/S13
  definitions). It is the only layer that exercised the production bundle, the saved layout, and
  the theme pipeline. Its cost is honest: one instance, one graph, ten minutes per mode.
- **Claude in Chrome** retired the P0 unknowns (32 operator forms, the insert sequence, panel
  drag, the SDK input drop) when there was no panel to click yet. Once there was, it could not
  click into it, and its keyboard-only drive is exactly the path that hides pointer bugs. It also
  typed into the host once. It is a probe tool, not an acceptance tool.
- **Playwright + web app** did the P3/P4 keyboard walkthroughs and the first insert/round-trip
  checks. It can click inside the frame (`f` refs), which the extension cannot, and it is scriptable.
  Its weak point is the environment: a per-session plugin id, graphs that vanish on reload, and a
  web build that can lag the desktop build the user runs (the skill's own note).

## What to use when

| Question | Use |
|---|---|
| Does this control render and survive a re-render? | 1, as a test next to the code, before the fix |
| Does the Datalog return the right rows on a real graph? | the CLI probes (`npm run probe`), then 2 for `:inputs` and `%` |
| Does a person get their answer, by mouse and by keyboard? | 2, the persona run, before a release |
| Is this a host behaviour I cannot name yet? | 3 or 4, as a one-off probe, written up in `probes.md` |
| Something only reproduces in the web build | 4 |
| A real-mouse question (drag regions, drags into the frame) | 2 with the swift helpers, user present |

## The rule the run added

Mouse and keyboard are two products. `Enter` moves focus forward and a click does not, so a zone
that passes by keyboard can still trap a pointer user (BUG-9, 11, 12 were all of that kind). Layer
2 runs every scenario in both modes (`MODE=keys ./batch.sh`); layer 1 gets a mousedown test beside
each Enter test for anything picker-driven.

## Where the hosted web app fits

`test.logseq.com` and `app.logseq.com` serve the same web build as `localhost:3001` without the
`pnpm watch` setup, so layers 3 and 4 work against them unchanged; the plugin still has to be
registered from the console per session, and the build there can be ahead of or behind the
desktop app. For this plugin, which ships to the desktop marketplace, layer 2 tests what users run.
