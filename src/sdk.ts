import "@logseq/libs";

/**
 * The few SDK calls whose published typings are narrower than the host actually accepts. Each
 * cast lives here, once, next to the evidence for the shape (docs/probes.md, FEAT-2/3).
 */
export interface MainUIAttrs { draggable?: boolean; resizable?: boolean }
export interface MainUIStyle { width?: string; height?: string; top?: string; left?: string; zIndex?: number }
export interface PropertySchema { type: "default" | "number" | "date" | "datetime" | "checkbox" | "url" | "node" | "asset" | "json" | "string"; cardinality?: "one" | "many"; hide?: boolean; public?: boolean }

/** Host: LSPlugin.core.ts `setMainUIAttrs` reads `draggable` and `resizable` (verified live). */
export const setMainUIAttrs = (attrs: MainUIAttrs) => logseq.setMainUIAttrs(attrs as never);
/** Host assigns these keys onto the container's inline style; position keys are ignored once a layout is saved. */
export const setMainUIInlineStyle = (style: MainUIStyle) => logseq.setMainUIInlineStyle(style as never);
/** Host `upsert_property` schema keys (src/main/logseq/api/db_based.cljs). */
export const upsertProperty = (name: string, schema: PropertySchema) => logseq.Editor.upsertProperty(name, schema as never);
