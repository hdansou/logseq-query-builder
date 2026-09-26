import type { PropertyRef } from "./model";

/**
 * Result-row context: the values of the properties the query filters on, so a row can be
 * recognised before clicking. The pull pattern and the formatter are the only two places that
 * know how each type's value is stored (mirrors emit.ts valueAttr).
 */
function pullFor(p: PropertyRef): string {
  switch (p.type) {
    case "number": return `{${p.ident} [:logseq.property/value]}`;
    case "date": return `{${p.ident} [:block/journal-day :block/title]}`;
    case "datetime": case "checkbox": return p.ident;
    default: return `{${p.ident} [:block/title]}`;
  }
}

export function contextPull(props: PropertyRef[]): string {
  const seen = new Set<string>();
  return props.filter((p) => !seen.has(p.ident) && seen.add(p.ident)).map(pullFor).join(" ");
}

/**
 * Pull-map keys as the host returns them (observed live): `:block/*` attributes lose their
 * namespace (`title`, `journal-day`), every other attribute keeps its full ident with the colon
 * (`:user.property/status-1`, `:logseq.property/value`).
 */
const key = (ident: string) => ident;

const pad = (n: number) => String(n).padStart(2, "0");
const field = (v: unknown, k: string): unknown => (v && typeof v === "object" ? (v as Record<string, unknown>)[k] : undefined);

function one(p: PropertyRef, v: unknown): string {
  switch (p.type) {
    case "number": return String(field(v, ":logseq.property/value") ?? v);
    case "date": return String(field(v, "title") ?? field(v, "journal-day") ?? v);
    case "datetime": { const d = new Date(Number(v)); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
    case "checkbox": return v ? "yes" : "no";
    default: return String(field(v, "title") ?? v);
  }
}

export function formatContext(props: PropertyRef[], m: Record<string, unknown>): string {
  const parts: string[] = [];
  const seen = new Set<string>();
  for (const p of props) {
    if (seen.has(p.ident)) continue;
    seen.add(p.ident);
    const v = m[key(p.ident)];
    if (v === undefined || v === null) continue;
    const text = Array.isArray(v) ? v.map((x) => one(p, x)).join(", ") : one(p, v);
    parts.push(`${p.title}: ${text}`);
  }
  return parts.join(" · ");
}
