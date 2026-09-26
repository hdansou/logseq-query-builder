import "@logseq/libs";
import { manifest } from "./manifest";
import { registerProbeCommands } from "./probes";
import { registerDemo } from "./demo";

const COMMAND_KEY = "query-builder-open";

function close() {
  logseq.hideMainUI({ restoreEditingCursor: true });
}

function open() {
  logseq.showMainUI({ autoFocus: true });
}

function main() {
  logseq.App.registerCommandPalette(
    { key: COMMAND_KEY, label: "Query Builder: open", keybinding: { binding: "mod+shift+q" } },
    open,
  );
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
  });
  if (import.meta.env.DEV) {
    registerProbeCommands();
    registerDemo();
  }
  console.info(`[${manifest.id}] ready v${manifest.version}`);
}

logseq.ready(main).catch(console.error);
