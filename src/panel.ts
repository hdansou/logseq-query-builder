// No SDK import: the `logseq` global comes from main.ts; importing the SDK here breaks unit tests.
import { setMainUIAttrs, setMainUIInlineStyle } from "./sdk";

/**
 * The floating panel is the host's main-UI container with drag/resize attrs; the plugin only
 * shows/hides it and sizes it once. The host remembers position after the first drag.
 */
let sized = false;

/**
 * While dragging, the host fades the whole container to 70% and lays a translucent dark handle
 * over it as feedback (plugins.css `.is-dragging`). On a light page that makes a light panel look
 * transparent. Injected into the host document, scoped to this plugin's container, it keeps the
 * panel opaque; the handle's tint remains as the drag cue.
 */
export const dragStyle = (pid: string) => `${container(pid)}.is-dragging { opacity: 1; }`;   // the id is host-assigned, but it lands in a selector: validated in container()

export function installPanelStyle() {
  logseq.provideStyle(dragStyle(logseq.baseInfo.id));
}

const container = (pid: string) => {
  if (!/^[\w-]+$/.test(pid)) throw new Error(`invalid plugin id for a CSS selector: ${JSON.stringify(pid)}`);
  return `.lsp-iframe-sandbox-container[data-pid="${pid}"]`;
};

export interface Rect { x: number; y: number; width: number; height: number }
export interface Size { width: number; height: number }
const MARGIN = 16;

/**
 * The host restores a saved layout as percent top/left and pixel size whatever the window, and
 * ignores inline position once a layout is saved (sdk.ts). A layout saved on a large screen can
 * put the footer, Insert included, below a smaller window. A stylesheet cap wins over the inline
 * size and keeps the panel inside the viewport; null when nothing sticks out (FEAT-50).
 */
export function fitStyle(pid: string, panel: Rect, view: Size): string | null {
  const rules: string[] = [];
  if (panel.y + panel.height > view.height - MARGIN) rules.push(`max-height: ${Math.round(view.height - panel.y - MARGIN)}px`);
  if (panel.x + panel.width > view.width - MARGIN) rules.push(`max-width: ${Math.round(view.width - panel.x - MARGIN)}px`);
  return rules.length ? `${container(pid)} { ${rules.join("; ")}; }` : null;
}

/** Measure the container and the viewport in the host, then cap the container if it sticks out. */
async function fitToViewport() {
  const pid = logseq.baseInfo.id;
  const [panel, view] = await Promise.all([logseq.UI.queryElementRect(container(pid)), logseq.UI.queryElementRect(".theme-container")]);
  if (!panel || !view) return;
  const style = fitStyle(pid, panel, view);
  logseq.provideStyle({ key: "qb-fit", style: style ?? `${container(pid)} {}` });
}

export function showPanel() {
  if (!sized) {
    setMainUIAttrs({ draggable: true, resizable: true });
    setMainUIInlineStyle({ width: "780px", height: "620px", top: "60px", left: "200px", zIndex: 99 });
    sized = true;
  }
  logseq.showMainUI({ autoFocus: true });
  setTimeout(() => void fitToViewport().catch((e) => console.warn("[qb] fit", e)), 100);   // after the host applied the saved layout
}

export function hidePanel() {
  logseq.hideMainUI({ restoreEditingCursor: true });
}
