import { str } from "./edn";
import type { PropertyRef, PropertyType, TagRef } from "./model";

/**
 * The graph's vocabulary, fetched live and cached for the session. Every method is a datalog
 * query through an injected `dq` (datascriptQuery in the plugin, a fake in tests). Nothing here
 * guesses an ident: everything is read from the graph.
 */
export type Dq = (query: string, ...inputs: unknown[]) => Promise<any[]>;

export interface TagInfo extends TagRef { uuid: string; count: number }
export interface PropertyInfo extends PropertyRef { uuid: string; owners: string[] }
export interface ValueInfo { label: string; count: number; uuid: string }
export interface NodeInfo { uuid: string; title: string; page: { uuid: string; title: string } | null }
export interface AssetInfo { uuid: string; title: string }

/** Where a ref value entity keeps its comparable scalar (same rule as the emitter). */
const labelAttr = (type: PropertyType) => (type === "number" ? ":logseq.property/value" : ":block/title");

const BUILDER_TYPES: ReadonlySet<string> = new Set(["default", "number", "url", "node", "asset", "date", "datetime", "checkbox"]);

/** Built-in classes nobody filters by (SPEC § Grounding 3). */
export const STRUCTURAL_TAGS: ReadonlySet<string> = new Set([
  ":logseq.class/Root", ":logseq.class/Tag", ":logseq.class/Property", ":logseq.class/Page", ":logseq.class/Asset",
  ":logseq.class/Whiteboard", ":logseq.class/Pdf-annotation", ":logseq.class/Code-block", ":logseq.class/Quote-block",
  ":logseq.class/Math-block", ":logseq.class/Comments", ":logseq.class/Comment",
]);

export class Graph {
  private cache = new Map<string, Promise<any[]>>();
  constructor(private dq: Dq) {}

  invalidate() { this.cache.clear(); }

  private cached(query: string, ...inputs: unknown[]): Promise<any[]> {
    const key = query + JSON.stringify(inputs);
    let hit = this.cache.get(key);
    if (!hit) {
      hit = this.dq(query, ...inputs);
      this.cache.set(key, hit);
    }
    return hit;
  }

  /** All user-facing tags, most-used first; unused tags last with count 0. */
  async tags(): Promise<TagInfo[]> {
    const [all, counts] = await Promise.all([
      this.cached(`[:find ?i ?title ?u :where [?t :block/tags :logseq.class/Tag] [?t :db/ident ?i] [?t :block/title ?title] [?t :block/uuid ?u] (not [?t :logseq.property/deleted-at _])]`),
      this.cached(`[:find ?i (count ?b) :where [?t :block/tags :logseq.class/Tag] [?t :db/ident ?i] [?b :block/tags ?t]]`),
    ]);
    const count = new Map(counts.map((r: any[]) => [String(r[0]), Number(r[1])]));
    return all
      .map((r: any[]) => ({ ident: String(r[0]), title: String(r[1]), uuid: String(r[2]), count: count.get(String(r[0])) ?? 0 }))
      .filter((t) => !STRUCTURAL_TAGS.has(t.ident))
      .sort((a, b) => b.count - a.count || a.title.localeCompare(b.title));
  }

  /**
   * User-visible properties (the host's own hidden rule: deleted, hidden, or built-in-and-not-public
   * are dropped) with their owner tags. With `selected` tag idents, those tags' properties come first.
   */
  async properties(selected: string[] = []): Promise<PropertyInfo[]> {
    const [rows, owners] = await Promise.all([
      this.cached(`[:find ?i ?title ?u ?type ?card ?vc :where [?p :block/tags :logseq.class/Property] [?p :db/ident ?i] [?p :block/title ?title] [?p :block/uuid ?u] [?p :logseq.property/type ?type] [?p :db/cardinality ?card] (not [?p :logseq.property/deleted-at _]) (not [?p :logseq.property/hide? true]) (or (not [?p :logseq.property/built-in? true]) [?p :logseq.property/public? true]) [(get-else $ ?p :logseq.property/view-context :none) ?vc]]`),
      this.cached(`[:find ?pi ?ci :where [?c :logseq.property.class/properties ?p] [?p :db/ident ?pi] [?c :db/ident ?ci]]`),
    ]);
    const ownersOf = new Map<string, string[]>();
    for (const [pi, ci] of owners) ownersOf.set(String(pi), [...(ownersOf.get(String(pi)) ?? []), String(ci)]);
    const sel = new Set(selected);
    // Settings-like built-ins (Enable property history, Extends, Page Tags…) carry a view-context of
    // property/class/page/never; node-level properties (Status, Deadline…) carry none. Observed live.
    return rows
      .filter((r: any[]) => BUILDER_TYPES.has(String(r[3])) && String(r[5]).endsWith("none"))
      .map((r: any[]): PropertyInfo => ({
        ident: String(r[0]), title: String(r[1]), uuid: String(r[2]), type: String(r[3]) as PropertyType,
        cardinality: String(r[4]).endsWith("many") ? "many" : "one", owners: ownersOf.get(String(r[0])) ?? [],
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
      this.cached(`[:find ?u ?label ?order :in $ ?prop :where [?p :db/ident ?prop] [?cv :block/closed-value-property ?p] [?cv :block/uuid ?u] [?cv :block/order ?order] [?cv ${attr} ?label]]`, p.ident),
      this.cached(`[:find ?label (count-distinct ?b) ?u :in $ ?prop :where [?e :db/ident :logseq.property/empty-placeholder] [?b ?prop ?v] [(not= ?v ?e)] (not [?v :logseq.property/deleted-at _]) [?v ${attr} ?label] [?v :block/uuid ?u]]`, p.ident),
    ]);
    const counts = new Map<string, { count: number; uuid: string }>();
    for (const [label, n, u] of used) {
      const key = String(label);
      const prev = counts.get(key);
      counts.set(key, { count: (prev?.count ?? 0) + Number(n), uuid: prev?.uuid ?? String(u) });
    }
    const closedList = [...closed]
      .sort((a: any[], b: any[]) => String(a[2]).localeCompare(String(b[2])))
      .map((r: any[]): ValueInfo => ({ label: String(r[1]), count: counts.get(String(r[1]))?.count ?? 0, uuid: String(r[0]) }));
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
    const rows = await this.cached(
      `[:find (pull ?b [:block/uuid :block/title {:block/page [:block/uuid :block/title]}]) :where [?b :block/title ?title] [?b :block/uuid _]${tag} (not [?b :logseq.property/created-from-property _]) (not [?b :logseq.property/built-in? true]) [(clojure.string/lower-case ?title) ?lt] [(clojure.string/includes? ?lt ${str(needle.toLowerCase())})]]`,
    );
    return rows
      .map((r: any[]) => r[0])
      .map((m: any): NodeInfo => ({ uuid: String(m.uuid), title: String(m.title), page: m.page ? { uuid: String(m.page.uuid), title: String(m.page.title) } : null }))
      .sort((a, b) => a.title.localeCompare(b.title))
      .slice(0, limit);
  }

  async assets(): Promise<AssetInfo[]> {
    const rows = await this.cached(`[:find ?u ?title :where [?a :block/tags :logseq.class/Asset] [?a :block/uuid ?u] [?a :block/title ?title]]`);
    return rows.map((r: any[]) => ({ uuid: String(r[0]), title: String(r[1]) })).sort((a: AssetInfo, b: AssetInfo) => a.title.localeCompare(b.title));
  }
}
