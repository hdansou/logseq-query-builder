import type { ZoneRenderer } from "./render";
export const renderTags: ZoneRenderer = (root) => { root.innerHTML = '<div class="zone-label">Tags <span class="hint">FEAT-18</span></div>'; };
