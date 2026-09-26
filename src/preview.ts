import type { Emitted } from "./emit";
import type { Dq } from "./graph";

/**
 * Runs the emitter's preview query and turns the rows into what the results list needs.
 * The host strips namespaces from pull maps (`{uuid, title, page: {uuid, title}}`), observed live
 * on 2026-09-26; anything else is an error, not a blank row.
 */
export interface ResultRow { uuid: string; title: string; page: { uuid: string; title: string } | null }

export const PAGE_SIZE = 10;

export function normalize(rows: any[]): ResultRow[] {
  return rows
    .map((r) => {
      const m = Array.isArray(r) ? r[0] : r;
      if (!m || typeof m !== "object" || typeof m.uuid !== "string") throw new Error(`preview row is not a pull map: ${JSON.stringify(r)}`);
      return { uuid: m.uuid, title: String(m.title ?? ""), page: m.page ? { uuid: String(m.page.uuid), title: String(m.page.title) } : null };
    })
    .sort((a, b) => a.title.localeCompare(b.title));
}

export async function runPreview(e: Emitted, dq: Dq): Promise<ResultRow[]> {
  return normalize(await dq(e.preview.query, ...e.preview.inputs));
}

export interface Page { shown: ResultRow[]; remaining: number; total: number }

/** The first `pages` × PAGE_SIZE rows; "load more" = pages + 1. */
export function page(rows: ResultRow[], pages: number): Page {
  const shown = rows.slice(0, pages * PAGE_SIZE);
  return { shown, remaining: rows.length - shown.length, total: rows.length };
}
