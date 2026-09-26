import "@logseq/libs";
import { emit } from "./emit";
import { LEGACY_STATE_KEY, STATE_KEY, canInsert, deserializeState, planInsert, runInsert, serializeState, stateSchemaFor } from "./insert";
import { Graph } from "./graph";
import { manifest } from "./manifest";
import { hidePanel, installPanelStyle, showPanel } from "./panel";
import { runPreview } from "./preview";
import { registerProbeCommands } from "./probes";
import { renderContent } from "./ui/content";
import { createRenderer } from "./ui/render";
import { focusRow, renderRows } from "./ui/rows";
import { Store, nameFor, targetFromEvent } from "./ui/store";
import { upsertProperty } from "./sdk";
import { watchTheme } from "./theme";
import { renderTags } from "./ui/tags";
import { renderScope } from "./ui/scope";

const dq = (q: string, ...ins: unknown[]) => logseq.DB.datascriptQuery(q, ...ins);

function main() {
  const store = new Store({ preview: (q) => runPreview(emit(q), dq) });
  const graph = new Graph(dq);
  watchTheme();
  installPanelStyle();
  logseq.DB.onChanged(() => graph.invalidate());
  const root = document.getElementById("root")!;
  const close = () => { store.close(); hidePanel(); };

  const insert = async () => {
    const s = store.state;
    const name = nameFor(s);
    const can = canInsert({ guard: s.guard, name, target: s.target });
    if (!can.ok || !s.target) return;
    const plan = planInsert(s.target, name, emit(s.q).block, serializeState({ ...s.q, name }));
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
      void logseq.UI.showMsg(`Query "${name}" inserted`, "success");
      close();
    } catch (e) {
      console.error("[qb insert] failed", e);
      void logseq.UI.showMsg(`Insert failed: ${e instanceof Error ? e.message : String(e)}`, "error");
    }
  };
  store.subscribe(createRenderer(root, { store, graph, insert }, { scope: renderScope, tags: renderTags, rows: renderRows, content: renderContent }));
  /** The round-trip property: a hidden string in our namespace. Ensured at start and again before every write. */
  const ensureStateProperty = async () => {
    const existing = (await logseq.Editor.getProperty(STATE_KEY).catch(() => null)) as { type?: string; hide?: boolean } | null;
    const schema = stateSchemaFor(existing ? { type: existing.type, hide: (existing as Record<string, unknown>)["hide?"] === true || existing.hide === true } : null);
    if (schema) await upsertProperty(STATE_KEY, schema);
  };
  void ensureStateProperty().catch((e) => console.warn("[qb] state property", e));

  const focusFirst = (force = false) => {
    const active = document.activeElement as HTMLElement | null;
    if (!force && active && active !== document.body) return;
    const target = root.querySelector<HTMLElement>("[data-fid=tag-picker]") ?? root.querySelector<HTMLElement>("[data-fid]");
    // The host editor may re-take top-level focus after the frame is shown (slash-command path);
    // focusing our own window pulls it back into the frame before focusing the control.
    if (force) window.focus();
    target?.focus();
    console.info("[qb focus]", force ? "forced" : "on window focus", "was:", active?.dataset.fid ?? active?.tagName, "now:", (document.activeElement as HTMLElement | null)?.dataset.fid);
  };
  // The host focuses the iframe window when it shows the panel; focus must be placed after that.
  window.addEventListener("focus", () => setTimeout(focusFirst, 0));
  /**
   * Opening on a block that already carries builder state (from either entry point) restores it
   * as chips, and Insert then rewrites that block instead of creating a sibling.
   */
  const open = async (target: ReturnType<typeof targetFromEvent>) => {
    let restored = null;
    if (target) {
      const saved = (await logseq.Editor.getBlockProperty(target.uuid, STATE_KEY).catch(() => null))
        ?? (await logseq.Editor.getBlockProperty(target.uuid, LEGACY_STATE_KEY).catch(() => null));
      restored = typeof saved === "string" ? deserializeState(saved) : null;
    }
    if (restored && target) target = { ...target, mode: "slash" };
    console.info("[qb open]", target, restored ? "restored" : "fresh");
    store.open(target, restored ?? undefined);
    showPanel();
    // The host focuses the frame asynchronously; make sure the cursor ends up in the builder.
    for (const ms of [50, 300, 800]) setTimeout(() => focusFirst(true), ms);
  };

  logseq.App.registerCommandPalette(
    { key: "query-builder-open", label: "Query Builder: open", keybinding: { binding: "mod+shift+f", mode: "global" } },
    (e) => void open(targetFromEvent("shortcut", e as { uuid?: string })),
  );
  logseq.Editor.registerSlashCommand("Query Builder", async (e) => open(targetFromEvent("slash", e as { uuid?: string })));

  // Esc closes the panel unless a picker consumed it (pickers stop propagation).
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
  // Shift+Enter adds a filter row from anywhere in the panel (capture: before any picker sees Enter).
  document.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.shiftKey) { e.preventDefault(); e.stopPropagation(); focusRow(store.addRow()); }
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); e.stopPropagation(); void insert(); }
  }, true);

  if (import.meta.env.DEV) registerProbeCommands();   // probe commands never reach the production bundle
  console.info(`[${manifest.id}] ready v${manifest.version}`);
}

logseq.ready(main).catch(console.error);
