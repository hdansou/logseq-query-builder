import { Graph } from "../graph";
import { renderContent } from "./content";
import { renderRefs } from "./refs";
import { createRenderer } from "./render";
import { renderRows } from "./rows";
import { renderScope } from "./scope";
import { Store } from "./store";
import { renderTags } from "./tags";

/**
 * Test-only: the whole panel rendered into a headless DOM from a fresh store (happy-dom suites).
 * Kept apart from test-helpers.ts because importing the UI pulls in the SDK, which needs a window.
 */
/** The whole panel rendered into a headless DOM from a fresh store (happy-dom suites). */
export function renderPanel(): { root: HTMLElement; store: Store } {
  document.body.innerHTML = '<div id="root"></div>';
  (globalThis as { CSS?: unknown }).CSS ??= { escape: (s: string) => s };
  const root = document.getElementById("root")!;
  const store = new Store({ preview: async () => [], debounceMs: 0 });
  const render = createRenderer(root, { store, graph: new Graph(async () => []), insert: async () => {} },
    { scope: renderScope, tags: renderTags, rows: renderRows, refs: renderRefs, content: renderContent });
  store.subscribe(render);
  render(store.state);
  return { root, store };
}
