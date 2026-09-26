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

Press **⌘⇧Q**, or run *"Query Builder: open"* from the command palette. **Esc** or a click on
the backdrop closes it.

## Iterating

Vite hot-reloads the source, but the plugin iframe needs a nudge (use the id from above):

```js
LSPluginCore.reload(["_ccrld6br9"])
```

After changing `node_modules` (e.g. an SDK upgrade) restart vite with `--force`.

## Probes (dev builds only)

`Query Builder: probe <name>` palette commands run the P0 probes; results are POSTed to the dev
server and appended to `docs/probes.jsonl`. `probe seed` builds the scratch page once per graph;
`probe ALL` runs the read-only ones. Summarise with `python3 scripts/summarise_probes.py`.

## Driving the panel from browser automation

Synthetic clicks from the Claude-in-Chrome extension do not reach the plugin iframe (it is
cross-origin). Focus the frame from the host console and use the keyboard:

```js
const f = document.querySelector("iframe.lsp-iframe-sandbox"); f.focus(); f.contentWindow.focus();
```

then Tab / Enter / Escape. Manual mouse use in a real browser is unaffected.
