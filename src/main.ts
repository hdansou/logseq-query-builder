import "@logseq/libs";
import { emit } from "./emit";
import { manifest } from "./manifest";
import { hidePanel, showPanel } from "./panel";
import { runPreview } from "./preview";
import { registerProbeCommands } from "./probes";
import { registerDemo } from "./demo";
import { renderContent } from "./ui/content";
import { createRenderer } from "./ui/render";
import { renderRows } from "./ui/rows";
import { Store, targetFromEvent } from "./ui/store";
import { renderTags } from "./ui/tags";

const dq = (q: string, ...ins: unknown[]) => logseq.DB.datascriptQuery(q, ...ins);

function main() {
  const store = new Store({ preview: (q) => runPreview(emit(q), dq) });
  const root = document.getElementById("root")!;
  const close = () => { store.close(); hidePanel(); };
  store.subscribe(createRenderer(root, store, { tags: renderTags, rows: renderRows, content: renderContent }, close));

  const open = (target: ReturnType<typeof targetFromEvent>) => { store.open(target); showPanel(); };

  logseq.App.registerCommandPalette(
    { key: "query-builder-open", label: "Query Builder: open", keybinding: { binding: "mod+shift+q", mode: "global" } },
    (e) => open(targetFromEvent("shortcut", e as { uuid?: string })),
  );
  logseq.Editor.registerSlashCommand("Query Builder", async (e) => open(targetFromEvent("slash", e as { uuid?: string })));

  // Esc closes the panel unless a picker consumed it (pickers stop propagation).
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });

  if (import.meta.env.DEV) {
    registerProbeCommands();
    registerDemo();
  }
  console.info(`[${manifest.id}] ready v${manifest.version}`);
}

logseq.ready(main).catch(console.error);
