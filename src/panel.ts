import "@logseq/libs";
import { setMainUIAttrs, setMainUIInlineStyle } from "./sdk";

/**
 * The floating panel is the host's main-UI container with drag/resize attrs; the plugin only
 * shows/hides it and sizes it once. The host remembers position after the first drag.
 */
let sized = false;

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
