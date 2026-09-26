import "@logseq/libs";

/**
 * The floating panel is the host's main-UI container with drag/resize attrs; the plugin only
 * shows/hides it and sizes it once. The host remembers position after the first drag.
 */
let sized = false;

export function showPanel() {
  if (!sized) {
    logseq.setMainUIAttrs({ draggable: true, resizable: true } as never);
    logseq.setMainUIInlineStyle({ width: "780px", height: "620px", top: "60px", left: "200px", zIndex: 99 } as never);
    sized = true;
  }
  logseq.showMainUI({ autoFocus: true });
}

export function hidePanel() {
  logseq.hideMainUI({ restoreEditingCursor: true });
}
