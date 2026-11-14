import "@logseq/libs";
import { emit } from "./emit";
import { LEGACY_STATE_KEY, STATE_KEY, canInsert, deserializeState, handEdited, overwriteWarning, planInsert, runInsert, serializeState, stateSchemaFor } from "./insert";
import { emptyQuery, type Query } from "./model";
import { nodeUuids, refresh } from "./restore";
import { Graph } from "./graph";
import { manifest } from "./manifest";
import { hidePanel, installPanelStyle, showPanel } from "./panel";
import { runPreview } from "./preview";
import { registerProbeCommands } from "./probes";
import { installDevHook } from "./devhook";
import { renderContent } from "./ui/content";
import { createRenderer } from "./ui/render";
import { focusRow, renderRows } from "./ui/rows";
import { Store, nameFor, targetFromEvent, type Target } from "./ui/store";
import { upsertProperty } from "./sdk";
import { watchTheme } from "./theme";
import { renderTags } from "./ui/tags";
import { renderScope } from "./ui/scope";
import { renderRefs } from "./ui/refs";
import { focusTarget } from "./ui/focus";

const dq = (q: string, ...ins: unknown[]) => logseq.DB.datascriptQuery(q, ...ins);

function main() {
  const store = new Store({ preview: (q) => runPreview(emit(q), dq) });
  const graph = new Graph(dq);
  watchTheme({
    later: (fn, ms) => void setTimeout(fn, ms),
    resolveThemeCssPropsVals: (names) => logseq.UI.resolveThemeCssPropsVals(names),
    onThemeModeChanged: (cb) => void logseq.App.onThemeModeChanged(cb),
    onThemeChanged: (cb) => void logseq.App.onThemeChanged(cb),
  });
  installPanelStyle();
  logseq.DB.onChanged(() => graph.invalidate());
  const root = document.getElementById("root")!;
  const close = () => { store.close(); hidePanel(); };

  const insert = async () => {
    const s = store.state;
    const name = nameFor(s);
    const can = canInsert({ guard: s.guard, name, target: s.target });
    if (!can.ok || !s.target) return;
    if (s.overwrite && !s.confirmed) return store.confirm();   // overwriting someone's text takes a second press
    const text = emit(s.q).block;
    const plan = planInsert(s.target, name, text, serializeState({ ...s.q, name }, text));
    console.info("[qb insert]", s.target, plan.map((p) => p.op));
    try {
      await ensureStateProperty();
      await runInsert({
        insertBlock: (after, content, opts) => logseq.Editor.insertBlock(after, content, opts) as Promise<{ uuid: string } | null>,
        updateBlock: (uuid, content) => logseq.Editor.updateBlock(uuid, content),
        addBlockTag: (uuid, tag) => logseq.Editor.addBlockTag(uuid, tag),
        upsertBlockProperty: (uuid, key, value) => logseq.Editor.upsertBlockProperty(uuid, key, value),
      }, plan);
      console.info("[qb insert] done");
      void logseq.UI.showMsg(`Query "${name}" ${s.target.existing ? "updated" : "inserted"}`, "success");
      close();
    } catch (e) {
      console.error("[qb insert] failed", e);
      void logseq.UI.showMsg(`Insert failed: ${e instanceof Error ? e.message : String(e)}`, "error");
    }
  };
  /** The saved-queries list: every block carrying the state property, read when the list is opened. */
  const toggleSaved = async () => {
    if (store.state.saved !== null) return store.setSaved(null);
    store.setSaved("loading");
    try {
      const prop = (await logseq.Editor.getProperty(STATE_KEY)) as { ident?: string } | null;
      const ident = prop?.ident ? (prop.ident.startsWith(":") ? prop.ident : `:${prop.ident}`) : null;
      store.setSaved(ident ? await graph.savedQueries(ident) : []);
    } catch (e) {
      console.error("[qb saved]", e);
      store.setSaved([]);
    }
  };
  const openSaved = (uuid: string) => void open({ uuid, mode: "shortcut" });
  store.subscribe(createRenderer(root, { store, graph, insert, toggleSaved: () => void toggleSaved(), openSaved }, { scope: renderScope, tags: renderTags, rows: renderRows, refs: renderRefs, content: renderContent }));
  /** The round-trip property: a hidden string in our namespace. Ensured at start and again before every write. */
  const ensureStateProperty = async () => {
    const existing = (await logseq.Editor.getProperty(STATE_KEY).catch(() => null)) as { type?: string; hide?: boolean } | null;
    const schema = stateSchemaFor(existing ? { type: existing.type, hide: (existing as Record<string, unknown>)["hide?"] === true || existing.hide === true } : null);
    if (schema) await upsertProperty(STATE_KEY, schema);
  };
  void ensureStateProperty().catch((e) => console.warn("[qb] state property", e));

  const focusFirst = (force = false) => {
    const active = document.activeElement as HTMLElement | null;
    const target = focusTarget(root, active, force);
    if (!target) return;
    // The host editor may re-take top-level focus after the frame is shown (slash-command path);
    // focusing our own window pulls it back into the frame before focusing the control.
    if (force) window.focus();
    target.focus();
    if (import.meta.env.DEV) console.info("[qb focus]", force ? "forced" : "on window focus", "was:", active?.dataset.fid ?? active?.tagName, "now:", (document.activeElement as HTMLElement | null)?.dataset.fid);
  };
  // The host focuses the iframe window when it shows the panel; focus must be placed after that.
  window.addEventListener("focus", () => setTimeout(focusFirst, 0));
  /**
   * Opening on a block that is already a query edits that block, whatever the entry point. With
   * builder state it is restored as chips, checked against the graph as it is now; a query the
   * builder did not write starts empty and is replaced. Neither is overwritten without a warning
   * when that would lose text someone typed.
   */
  const open = async (target: Target | null) => {
    let q: Query | undefined;
    const notices: string[] = [];
    let overwrite: string | null = null;
    if (target) {
      const uuid = target.uuid;
      const raw: unknown = (await logseq.Editor.getBlockProperty(uuid, STATE_KEY).catch(() => null))
        ?? (await logseq.Editor.getBlockProperty(uuid, LEGACY_STATE_KEY).catch(() => null));
      const saved = typeof raw === "string" ? raw : null;
      const restored = saved === null ? null : deserializeState(saved);
      const [queryText, title] = await Promise.all([
        graph.queryText(uuid).catch(() => null),
        graph.nodeTitles([uuid]).then((m) => m.get(uuid) ?? null).catch(() => null),
      ]);
      // From the slash command the block's text is the half-typed command, not the query's name.
      const blockName = target.mode === "shortcut" ? title : null;
      if (restored && saved !== null) {
        const [idents, nodes] = await Promise.all([graph.identTitles(), graph.nodeTitles(nodeUuids(restored))]);
        const fresh = refresh(restored, { idents, nodes });
        q = { ...fresh.q, name: blockName ?? fresh.q.name };
        if (fresh.missing.length) notices.push(`No longer in the graph: ${fresh.missing.join(", ")}. Remove or replace ${fresh.missing.length === 1 ? "it" : "them"}; as written the query cannot match.`);
        target = { ...target, mode: "slash", existing: "builder" };
        overwrite = overwriteWarning(target, handEdited(saved, queryText));
      } else if (queryText !== null) {
        q = { ...emptyQuery(), name: blockName ?? "" };
        target = { ...target, mode: "slash", existing: "foreign" };
        overwrite = overwriteWarning(target, false);
      }
    }
    console.info("[qb open]", target, target?.existing ?? "fresh");
    store.open(target, q, { notices, overwrite });
    showPanel();
    // The host focuses the frame asynchronously; make sure the cursor ends up in the builder.
    for (const ms of [50, 300, 800]) setTimeout(() => focusFirst(true), ms);
  };

  logseq.App.registerCommandPalette(
    { key: "query-builder-open", label: "Query Builder: open", keybinding: { binding: "mod+shift+f", mode: "global" } },
    (e) => void open(targetFromEvent("shortcut", e as { uuid?: string })),
  );
  logseq.Editor.registerBlockContextMenuItem("Open in Query Builder", async (e) => open(targetFromEvent("shortcut", e as { uuid?: string })));
  logseq.Editor.registerSlashCommand("Query Builder", async (e) => open(targetFromEvent("slash", e as { uuid?: string })));

  // Esc closes the panel unless a picker consumed it (pickers stop propagation).
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
  // Shift+Enter adds a filter row from anywhere in the panel (capture: before any picker sees Enter).
  document.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.shiftKey) { e.preventDefault(); e.stopPropagation(); focusRow(store.addRow()); }
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); e.stopPropagation(); void insert(); }
  }, true);

  if (import.meta.env.DEV) { registerProbeCommands(); installDevHook(store); }   // neither reaches the production bundle
  console.info(`[${manifest.id}] ready v${manifest.version}`);
}

logseq.ready(main).catch(console.error);
