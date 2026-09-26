import "@logseq/libs";
import { emit } from "./emit";
import { Graph } from "./graph";
import { manifest } from "./manifest";
import { hidePanel, showPanel } from "./panel";
import { runPreview } from "./preview";
import { registerProbeCommands } from "./probes";
import { registerDemo } from "./demo";
import { renderContent } from "./ui/content";
import { createRenderer } from "./ui/render";
import { focusRow, renderRows } from "./ui/rows";
import { Store, targetFromEvent } from "./ui/store";
import { watchTheme } from "./theme";
import { renderTags } from "./ui/tags";

const dq = (q: string, ...ins: unknown[]) => logseq.DB.datascriptQuery(q, ...ins);

function main() {
  const store = new Store({ preview: (q) => runPreview(emit(q), dq) });
  const graph = new Graph(dq);
  watchTheme();
  logseq.DB.onChanged(() => graph.invalidate());
  const root = document.getElementById("root")!;
  const close = () => { store.close(); hidePanel(); };
  store.subscribe(createRenderer(root, { store, graph }, { tags: renderTags, rows: renderRows, content: renderContent }));

  const focusFirst = () => {
    if (document.activeElement && document.activeElement !== document.body) return;
    (root.querySelector<HTMLElement>("[data-fid=tag-picker]") ?? root.querySelector<HTMLElement>("[data-fid]"))?.focus();
  };
  // The host focuses the iframe window when it shows the panel; focus must be placed after that.
  window.addEventListener("focus", () => setTimeout(focusFirst, 0));
  const open = (target: ReturnType<typeof targetFromEvent>) => { store.open(target); showPanel(); setTimeout(focusFirst, 50); };

  logseq.App.registerCommandPalette(
    { key: "query-builder-open", label: "Query Builder: open", keybinding: { binding: "mod+shift+q", mode: "global" } },
    (e) => open(targetFromEvent("shortcut", e as { uuid?: string })),
  );
  logseq.Editor.registerSlashCommand("Query Builder", async (e) => open(targetFromEvent("slash", e as { uuid?: string })));

  // Esc closes the panel unless a picker consumed it (pickers stop propagation).
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
  // Shift+Enter adds a filter row from anywhere in the panel (capture: before any picker sees Enter).
  document.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.shiftKey) { e.preventDefault(); e.stopPropagation(); focusRow(store.addRow()); }
  }, true);

  if (import.meta.env.DEV) {
    registerProbeCommands();
    registerDemo();
  }
  console.info(`[${manifest.id}] ready v${manifest.version}`);
}

logseq.ready(main).catch(console.error);
