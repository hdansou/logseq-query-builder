import type { Emitted } from "./emit";
import type { Dq } from "./graph";
import { resolveRefs, type RefTitle } from "./titles";

/**
 * Runs the emitter's preview query and turns the rows into what the results list needs.
 * The host strips namespaces from pull maps (`{uuid, title, page: {uuid, title}}`), observed live
 * on 2026-09-26; anything else is an error, not a blank row.
 */
export interface ResultRow { uuid: string; title: string; page: { uuid: string; title: string } | null; raw: Record<string, unknown> }

export const PAGE_SIZE = 10;

interface PullMap { uuid: string; title?: string; page?: { uuid: string; title: string }; refs?: RefTitle[]; [k: string]: unknown }
const isPullMap = (m: unknown): m is PullMap => !!m && typeof m === "object" && typeof (m as PullMap).uuid === "string";

export function normalize(rows: unknown[]): ResultRow[] {
  return rows
    .map((r) => {
      const m = Array.isArray(r) ? r[0] : r;
      if (!isPullMap(m)) throw new Error(`preview row is not a pull map: ${JSON.stringify(r)}`);
      return { uuid: m.uuid, title: resolveRefs(String(m.title ?? ""), m.refs), page: m.page ? { uuid: String(m.page.uuid), title: String(m.page.title) } : null, raw: m };
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
