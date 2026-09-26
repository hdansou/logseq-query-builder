# Testing Query Builder in the web app

The normal "Load plugin from web url" flow **cannot work in the web app**: `load_plugin_config`
is Electron-only, and `_resolveResourceFullUrl` rewrites the entry onto Logseq's plugin CDN unless
told otherwise. Both have escape hatches; the snippet below uses them.

## 1. Start the dev server

```bash
cd ~/Projects/src/github.com/logseq-query-builder
npm run dev
```

Check: `curl -s -o /dev/null -w '%{http_code}\n' http://localhost:8291/package.json` → `200`.

## 2. Register the plugin from the browser console

Open http://localhost:3001, then DevTools → Console, and paste:

```js
LSPluginCore.register({
  url: "http://localhost:8291",
  id: "logseq-query-builder",
  webPkg: {
    name: "logseq-query-builder",
    version: "0.1.0",
    description: "Build Logseq DB queries visually",
    main: "index.html",
    author: "dzu",
    installedFromUserWebUrl: "http://localhost:8291",
    logseq: { id: "logseq-query-builder", title: "Query Builder", main: "index.html" }
  }
})
```

- `webPkg` supplies the manifest inline, so the Electron-only fetch is skipped.
- `installedFromUserWebUrl` **inside** `webPkg` stops the CDN rewrite.

Confirm it loaded. The host ignores the `id` you pass and assigns its own (e.g. `_ccrld6br9`),
so look the plugin up by entry:

```js
(() => { const p = [...LSPluginCore._registeredPlugins.values()].find(p => p.options.entry?.startsWith("http://localhost:8291"));
         return { id: p.id, status: p.status } })()
// → { id: "_ccrld6br9", status: "loaded" }
```

Consequences of the generated id: plugin-owned properties are namespaced
`plugin.property.<id without leading underscore>/…`, and the host's remembered panel layout is
keyed by it, so neither survives re-registration.

**This is per-session.** A page reload drops it; paste the snippet again.

## 3. Use it

Press **⌘⇧F**, or run *"Query Builder: open"* from the command palette. **Esc** or a click on
the backdrop closes it.

## Iterating

Vite hot-reloads the source, but the plugin iframe needs a nudge (use the id from above):

```js
LSPluginCore.reload(["_ccrld6br9"])
```

After changing `node_modules` (e.g. an SDK upgrade) restart vite with `--force`.

## Probes (dev builds only)

The probe palette commands and the `/__probe` result sink exist only when vite serves the source
(`import.meta.env.DEV`). They are not part of `npm run build`; `grep -c probe dist/assets/*.js`
should print 0.

`Query Builder: probe <name>` palette commands run the P0 probes; results are POSTed to the dev
server and appended to `docs/probes.jsonl` (ignored by git; `docs/probes.md` is the curated record). `probe seed` builds the scratch page once per graph;
`probe ALL` runs the read-only ones. Summarise with `python3 scripts/summarise_probes.py`.

## Driving the panel from browser automation

Synthetic clicks from the Claude-in-Chrome extension do not reach the plugin iframe (it is
cross-origin). Focus the frame from the host console and use the keyboard:

```js
const f = document.querySelector("iframe.lsp-iframe-sandbox"); f.focus(); f.contentWindow.focus();
```

then Tab / Enter / Escape. Manual mouse use in a real browser is unaffected.

## Checking the production build

```bash
npm run build          # dist/
npm run preview        # serves dist/ on :8292
```

Register it exactly like the dev server, with `url: "http://localhost:8292"` and
`installedFromUserWebUrl: "http://localhost:8292"`; `main` stays `index.html` because the preview
server's root *is* `dist/`.

## Driving the panel from the host console (dev builds only)

The plugin frame is cross-origin, so browser automation cannot click into it. Dev builds install a
`postMessage` hook (`src/devhook.ts`). From DevTools on the host page:

```js
const qb = (msg) => new Promise((res) => {
  const id = Math.random().toString(36).slice(2);
  const f = document.querySelector('iframe[src*="8291"]');
  const h = (e) => { if (e.data?.qbReply === id) { window.removeEventListener("message", h); res(e.data); } };
  window.addEventListener("message", h);
  f.contentWindow.postMessage({ ...msg, id }, "*");
});
await qb({ qb: "click", fid: "add-ref" });
const { fids } = await qb({ qb: "fids" });
const target = fids.find((f) => f.startsWith("ref-target-"));
await qb({ qb: "type", fid: target, text: "iris" });      // opens the picker
await qb({ qb: "key", fid: target, key: "Enter" });        // picks the highlighted option
await qb({ qb: "state" });                                 // { query, guard, readback, results, text }
```

Messages: `state`, `set` (`query`), `click` (`fid`), `type` (`fid`, `text`), `key` (`fid`, `key`),
`fids`. The hook is absent from the production bundle.

## Checking emitted Datalog on a CLI graph

```bash
npm run probe -- Demo-Graph            # runs docs/probes-cli.json fixtures for that graph, compares counts
npm run probe -- Library-Test --record # rewrites the expected counts with what the graph returns
```

Read-only; fixtures name targets by title and are resolved on the graph. Date inputs are not
supported by the CLI, keep fixtures date-free. Unit tests stay green without any graph (the probe
file is skipped unless `QB_PROBE_GRAPH` is set).
