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

Confirm it loaded:

```js
(() => { const p = LSPluginCore._registeredPlugins.get("logseq-query-builder");
         return { status: p.status, entry: p.options.entry } })()
// → { status: "loaded", entry: "http://localhost:8291/index.html" }
```

**This is per-session.** A page reload drops it; paste the snippet again.

## 3. Use it

Press **⌘⇧Q**, or run *"Query Builder: open"* from the command palette. **Esc** or a click on
the backdrop closes it.

## Iterating

Vite hot-reloads the source, but the plugin iframe needs a nudge:

```js
LSPluginCore.reload(["logseq-query-builder"])
```
