import type { FilterRow, Query, RefRow, TagRef } from "./model";

/**
 * A saved query's state holds snapshots: each tag, property and node is kept with the title it had
 * when the query was written. The emitted query embeds idents and uuids, so it survives a rename,
 * but the chips would show the old name, and something deleted since would sit there looking fine
 * while matching nothing. On reopen the snapshots are checked against the graph: titles are
 * brought up to date and what no longer exists is listed.
 */
export interface Vocabulary {
  /** ident → current title, for every tag and property still in the graph. */
  idents: ReadonlyMap<string, string>;
  /** uuid → current title, for the nodes the query names. */
  nodes: ReadonlyMap<string, string>;
}

/** Every node uuid the query names: scope page, node values, node targets. */
export function nodeUuids(q: Query): string[] {
  const out = new Set<string>();
  if (q.scope.kind === "on-page") out.add(q.scope.page.uuid);
  const fromRows = (rows: FilterRow[]) => { for (const r of rows) for (const v of r.values) if (v.kind === "ref") out.add(v.uuid); };
  fromRows(q.rows);
  for (const r of q.refs) {
    if (r.target?.kind === "node") out.add(r.target.uuid);
    if (r.target?.kind === "tag") fromRows(r.target.rows);
  }
  return [...out];
}

export function refresh(q: Query, v: Vocabulary): { q: Query; missing: string[] } {
  const missing = new Set<string>();
  const node = <T extends { uuid: string; title: string }>(n: T, what: string): T => {
    const title = v.nodes.get(n.uuid);
    if (title === undefined) { missing.add(`${what} “${n.title}”`); return n; }
    return title === n.title ? n : { ...n, title };
  };
  const named = <T extends { ident: string; title: string }>(e: T, what: string): T => {
    const title = v.idents.get(e.ident);
    if (title === undefined) { missing.add(`${what} “${e.title}”`); return e; }
    return title === e.title ? e : { ...e, title };
  };
  const tag = (t: TagRef) => named(t, "tag");
  const rows = (list: FilterRow[]): FilterRow[] => list.map((r) => ({
    ...r,
    property: r.property && named(r.property, "property"),
    values: r.values.map((val) => (val.kind === "ref" ? node(val, "node") : val)),
  }));
  const ref = (r: RefRow): RefRow => {
    if (r.target?.kind === "node") return { ...r, target: node(r.target, "node") };
    if (r.target?.kind === "tag") return { ...r, target: { ...r.target, tag: tag(r.target.tag), rows: rows(r.target.rows) } };
    return r;
  };
  const out: Query = {
    ...q,
    scope: q.scope.kind === "on-page" ? { kind: "on-page", page: node(q.scope.page, "page") } : q.scope,
    tags: q.tags.map((t) => (t.tag ? { ...t, tag: tag(t.tag) } : t)),
    rows: rows(q.rows),
    refs: q.refs.map(ref),
  };
  return { q: out, missing: [...missing] };
}
