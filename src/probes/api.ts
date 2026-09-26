import "@logseq/libs";
import type { Row } from "../graph";

/** Thin helpers over the plugin API used only by probes and the seed. */

export const PAGE = "QB Scratch";

/**
 * Note: @logseq/libs 0.2.12 drops the caller's LAST input here (its proxy never appended the
 * namespace tag that `datascriptQuery` pops). 0.3.4 appends the tag, so inputs pass through.
 * This project requires ^0.3.4 for that reason; do not downgrade.
 */
export async function dq(query: string, ...inputs: unknown[]): Promise<Row[]> {
  const rows: unknown = await logseq.DB.datascriptQuery(query, ...inputs);
  return Array.isArray(rows) ? (rows as Row[]) : [];
}

const identCache = new Map<string, string>();
/** Property ident by title, the way the real builder will resolve it (idents are never guessed). */
export async function propertyIdent(title: string): Promise<string> {
  const hit = identCache.get(title);
  if (hit) return hit;
  const rows = await dq(
    `[:find ?i :where [?p :block/tags :logseq.class/Property] [?p :block/title "${title}"] [?p :db/ident ?i]]`,
  );
  if (!rows.length) throw new Error(`property not found: ${title}`);
  identCache.set(title, String(rows[0][0]));
  return String(rows[0][0]);
}

export async function tagIdent(title: string): Promise<string> {
  const rows = await dq(
    `[:find ?i :where [?t :block/tags :logseq.class/Tag] [?t :block/title "${title}"] [?t :db/ident ?i]]`,
  );
  if (!rows.length) throw new Error(`tag not found: ${title}`);
  return String(rows[0][0]);
}

export async function eidByUuid(uuid: string): Promise<number> {
  const rows = await dq(`[:find ?e :where [?e :block/uuid #uuid "${uuid}"]]`);
  if (!rows.length) throw new Error(`no entity for uuid ${uuid}`);
  return Number(rows[0][0]);
}

export async function eidByIdent(ident: string): Promise<number> {
  const rows = await dq(`[:find ?e :where [?e :db/ident ${ident}]]`);
  if (!rows.length) throw new Error(`no entity for ident ${ident}`);
  return Number(rows[0][0]);
}

export function journalDay(d: Date): number {
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
/** Journal title in the two formats a scratch graph is likely to use. */
export function journalTitle(d: Date, format: string): string {
  if (format === "yyyy-MM-dd")
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  if (format === "MMM do, yyyy") return `${MONTHS[d.getMonth()]} ${ordinal(d.getDate())}, ${d.getFullYear()}`;
  throw new Error(`unsupported journal format: ${format}`);
}

/** Entity id of the journal page for a day, creating it if needed. */
export async function journalEid(d: Date): Promise<number> {
  const day = journalDay(d);
  const found = await dq(`[:find ?e :where [?e :block/journal-day ${day}]]`);
  if (found.length) return Number(found[0][0]);
  const cfg = await logseq.App.getUserConfigs();
  const title = journalTitle(d, cfg.preferredDateFormat);
  await logseq.Editor.createPage(title, {}, { journal: true, redirect: false, createFirstBlock: false });
  const again = await dq(`[:find ?e :where [?e :block/journal-day ${day}]]`);
  if (!again.length) throw new Error(`journal page ${title} not created`);
  return Number(again[0][0]);
}

export { RULES } from "../emit";
