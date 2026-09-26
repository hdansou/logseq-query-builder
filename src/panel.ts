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
export const dragStyle = (pid: string) =>
  `.lsp-iframe-sandbox-container[data-pid="${pid}"].is-dragging { opacity: 1; }`;

export function installPanelStyle() {
  logseq.provideStyle(dragStyle(logseq.baseInfo.id));
}

export function showPanel() {
  if (!sized) {
    setMainUIAttrs({ draggable: true, resizable: true });
    setMainUIInlineStyle({ width: "780px", height: "620px", top: "60px", left: "200px", zIndex: 99 });
    sized = true;
  }
  logseq.showMainUI({ autoFocus: true });
}

export function hidePanel() {
  logseq.hideMainUI({ restoreEditingCursor: true });
}
