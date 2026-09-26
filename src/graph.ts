import { str } from "./edn";
import type { PropertyRef, PropertyType, TagRef } from "./model";

/**
 * The graph's vocabulary, fetched live and cached for the session. Every method is a datalog
 * query through an injected `dq` (datascriptQuery in the plugin, a fake in tests). Nothing here
 * guesses an ident: everything is read from the graph.
 */
/** A datascript row: one cell per :find element. Cells are typed at the one boundary, `rows<T>()`. */
export type Row = unknown[];
export type Dq = (query: string, ...inputs: unknown[]) => Promise<Row[]>;

export interface TagInfo extends TagRef { uuid: string; count: number }
export interface PropertyInfo extends PropertyRef { uuid: string; owners: string[] }
export interface ValueInfo { label: string; count: number; uuid: string }
export interface NodeInfo { uuid: string; title: string; page: { uuid: string; title: string } | null }
/** The host strips `:block/` from pull-map keys (observed live). */
interface NodePull { uuid: string; title: string; page?: { uuid: string; title: string } }
export interface AssetInfo { uuid: string; title: string }

/** Where a ref value entity keeps its comparable scalar (same rule as the emitter). */
const labelAttr = (type: PropertyType) => (type === "number" ? ":logseq.property/value" : ":block/title");

const BUILDER_TYPES: ReadonlySet<string> = new Set(["default", "number", "url", "node", "asset", "date", "datetime", "checkbox"]);

/**
 * Built-in classes nobody filters by (SPEC § Grounding 3). `Page` is deliberately NOT here: "all
 * pages" and "pages tagged X" are real questions, and Journal is offered on the same basis.
 */
export const STRUCTURAL_TAGS: ReadonlySet<string> = new Set([
  ":logseq.class/Root", ":logseq.class/Tag", ":logseq.class/Property", ":logseq.class/Asset",
  ":logseq.class/Whiteboard", ":logseq.class/Pdf-annotation", ":logseq.class/Code-block", ":logseq.class/Quote-block",
  ":logseq.class/Math-block", ":logseq.class/Comments", ":logseq.class/Comment",
]);

export class Graph {
  private cache = new Map<string, Promise<Row[]>>();
  constructor(private dq: Dq) {}

  invalidate() { this.cache.clear(); }

  /** The single typed boundary: the caller states the tuple shape its :find produces. */
  private rows<T extends Row>(query: string, ...inputs: unknown[]): Promise<T[]> {
    const key = query + JSON.stringify(inputs);
    let hit = this.cache.get(key);
    if (!hit) {
      hit = this.dq(query, ...inputs);
      this.cache.set(key, hit);
    }
    return hit as Promise<T[]>;
  }

  /** All user-facing tags, most-used first; unused tags last with count 0. */
  async tags(): Promise<TagInfo[]> {
    const [all, counts] = await Promise.all([
      this.rows<[string, string, string]>(`[:find ?i ?title ?u :where [?t :block/tags :logseq.class/Tag] [?t :db/ident ?i] [?t :block/title ?title] [?t :block/uuid ?u] (not [?t :logseq.property/deleted-at _])]`),
      this.rows<[string, number]>(`[:find ?i (count ?b) :where [?t :block/tags :logseq.class/Tag] [?t :db/ident ?i] [?b :block/tags ?t]]`),
    ]);
    const count = new Map(counts.map(([ident, n]) => [ident, n]));
    return all
      .map(([ident, title, uuid]) => ({ ident, title, uuid, count: count.get(ident) ?? 0 }))
      .filter((t) => !STRUCTURAL_TAGS.has(t.ident))
      .sort((a, b) => b.count - a.count || a.title.localeCompare(b.title));
  }

  /**
   * User-visible properties (the host's own hidden rule: deleted, hidden, or built-in-and-not-public
   * are dropped) with their owner tags. With `selected` tag idents, those tags' properties come first.
   *
   * The visibility flags are read with `get-else` (an entity lookup) and filtered here rather than
   * scanned by value: on a persisted graph the attribute index for `:logseq.property/public?`
   * missed Priority, so `[?p :logseq.property/public? true]` dropped it (docs/probes.md).
   */
  async properties(selected: string[] = []): Promise<PropertyInfo[]> {
    const [rows, owners] = await Promise.all([
      this.rows<[string, string, string, string, string, string, boolean, boolean, boolean, unknown]>(
        `[:find ?i ?title ?u ?type ?card ?vc ?bi ?pub ?hide ?del :where [?p :block/tags :logseq.class/Property] [?p :db/ident ?i] [?p :block/title ?title] [?p :block/uuid ?u] [?p :logseq.property/type ?type] [?p :db/cardinality ?card] [(get-else $ ?p :logseq.property/view-context :none) ?vc] [(get-else $ ?p :logseq.property/built-in? false) ?bi] [(get-else $ ?p :logseq.property/public? false) ?pub] [(get-else $ ?p :logseq.property/hide? false) ?hide] [(get-else $ ?p :logseq.property/deleted-at false) ?del]]`,
      ),
      this.rows<[string, string]>(`[:find ?pi ?ci :where [?c :logseq.property.class/properties ?p] [?p :db/ident ?pi] [?c :db/ident ?ci]]`),
    ]);
    const ownersOf = new Map<string, string[]>();
    for (const [pi, ci] of owners) ownersOf.set(pi, [...(ownersOf.get(pi) ?? []), ci]);
    const sel = new Set(selected);
    // Settings-like built-ins (Enable property history, Extends, Page Tags…) carry a view-context of
    // property/class/page/never; node-level properties (Status, Deadline…) carry none. Observed live.
    return rows
      .filter(([, , , type, , vc, builtIn, pub, hide, deleted]) =>
        !deleted && !hide && (!builtIn || pub) && BUILDER_TYPES.has(type) && vc.endsWith("none"))
      .map(([ident, title, uuid, type, card]): PropertyInfo => ({
        ident, title, uuid, type: type as PropertyType,
        cardinality: card.endsWith("many") ? "many" : "one", owners: ownersOf.get(ident) ?? [],
      }))
      .sort((a, b) => {
        const ao = a.owners.some((o) => sel.has(o)) ? 0 : 1, bo = b.owners.some((o) => sel.has(o)) ? 0 : 1;
        return ao - bo || a.title.localeCompare(b.title);
      });
  }

  /**
   * Distinct existing values of a ref-typed property with usage counts: closed choices first in
   * their own order (count 0 when unused), then open values by count. Grouped by label because
   * open text/url values are one entity per assignment.
   */
  async values(p: PropertyRef): Promise<ValueInfo[]> {
    const attr = labelAttr(p.type);
    const [closed, used] = await Promise.all([
      this.rows<[string, string | number, string]>(`[:find ?u ?label ?order :in $ ?prop :where [?p :db/ident ?prop] [?cv :block/closed-value-property ?p] [?cv :block/uuid ?u] [?cv :block/order ?order] [?cv ${attr} ?label]]`, p.ident),
      this.rows<[string | number, number, string]>(`[:find ?label (count-distinct ?b) ?u :in $ ?prop :where [?e :db/ident :logseq.property/empty-placeholder] [?b ?prop ?v] [(not= ?v ?e)] (not [?v :logseq.property/deleted-at _]) [?v ${attr} ?label] [?v :block/uuid ?u]]`, p.ident),
    ]);
    const counts = new Map<string, { count: number; uuid: string }>();
    for (const [label, n, u] of used) {
      const key = String(label);
      const prev = counts.get(key);
      counts.set(key, { count: (prev?.count ?? 0) + n, uuid: prev?.uuid ?? u });
    }
    const closedList = [...closed]
      .sort((a, b) => a[2].localeCompare(b[2]))
      .map(([uuid, label]): ValueInfo => ({ label: String(label), count: counts.get(String(label))?.count ?? 0, uuid }));
    const closedLabels = new Set(closedList.map((c) => c.label));
    const openList = [...counts.entries()]
      .filter(([label]) => !closedLabels.has(label))
      .map(([label, { count, uuid }]): ValueInfo => ({ label, count, uuid }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
    return [...closedList, ...openList];
  }

  /** Nodes whose title contains the needle (case-insensitive), optionally constrained to a tag. Built-in entities (property and class pages) are excluded: observed live, they swamped the list. */
  async nodes(needle: string, tagIdent?: string, limit = 20): Promise<NodeInfo[]> {
    const tag = tagIdent ? ` [?b :block/tags ${tagIdent}]` : "";
    const rows = await this.rows<[NodePull]>(
      `[:find (pull ?b [:block/uuid :block/title {:block/page [:block/uuid :block/title]}]) :where [?b :block/title ?title] [?b :block/uuid _]${tag} (not [?b :logseq.property/created-from-property _]) (not [?b :logseq.property/built-in? true]) [(clojure.string/lower-case ?title) ?lt] [(clojure.string/includes? ?lt ${str(needle.toLowerCase())})]]`,
    );
    return rows
      .map(([m]): NodeInfo => ({ uuid: m.uuid, title: m.title, page: m.page ? { uuid: m.page.uuid, title: m.page.title } : null }))
      .sort((a, b) => a.title.localeCompare(b.title))
      .slice(0, limit);
  }

  /** Pages (not built-in ones) whose title contains the needle, for the "on page" scope. */
  async pages(needle: string, limit = 20): Promise<AssetInfo[]> {
    const rows = await this.rows<[string, string]>(
      `[:find ?u ?title :where [?p :block/name _] [?p :block/title ?title] [?p :block/uuid ?u] (not [?p :logseq.property/built-in? true]) (not [?p :block/tags :logseq.class/Property]) (not [?p :block/tags :logseq.class/Tag]) [(clojure.string/lower-case ?title) ?lt] [(clojure.string/includes? ?lt ${str(needle.toLowerCase())})]]`,
    );
    return rows.map(([uuid, title]) => ({ uuid, title })).sort((a, b) => a.title.localeCompare(b.title)).slice(0, limit);
  }

  async assets(): Promise<AssetInfo[]> {
    const rows = await this.rows<[string, string]>(`[:find ?u ?title :where [?a :block/tags :logseq.class/Asset] [?a :block/uuid ?u] [?a :block/title ?title]]`);
    return rows.map(([uuid, title]) => ({ uuid, title })).sort((a, b) => a.title.localeCompare(b.title));
  }
}
