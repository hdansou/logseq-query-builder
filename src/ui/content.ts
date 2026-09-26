import type { ZoneRenderer } from "./render";
export const renderContent: ZoneRenderer = (root) => { root.innerHTML = '<div class="zone-label">Content <span class="hint">FEAT-20</span></div>'; };
