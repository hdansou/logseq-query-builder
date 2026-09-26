import "@logseq/libs";
import { PAGE, RULES, dq, propertyIdent, tagIdent } from "./api";

/** FEAT-2: does the insert sequence produce a block that renders as a live query table? */
export async function insertProbe() {
  const project = await tagIdent("QBProject");
  const when = await propertyIdent("qbWhen");
  const text = `{:query [:find (pull ?b [*]) :in $ ?in1 %
 :where [?tag :db/ident ${project}] [?b :block/tags ?t] (or [(= ?t ?tag)] (class-extends ?tag ?t))
        [?b ${when} ?ms] [(<= ?ms ?in1)]]
 :inputs [:+30d-ms]}`;

  const a = await logseq.Editor.appendBlockInPage(PAGE, "QB inserted query A (tag+property only)");
  if (!a) throw new Error("append A failed");
  await logseq.Editor.addBlockTag(a.uuid, "logseq.class/Query");
  await logseq.Editor.upsertBlockProperty(a.uuid, "logseq.property/query", text);

  const b = await logseq.Editor.appendBlockInPage(PAGE, "QB inserted query B (plus code sub-properties)");
  if (!b) throw new Error("append B failed");
  await logseq.Editor.addBlockTag(b.uuid, "logseq.class/Query");
  await logseq.Editor.upsertBlockProperty(b.uuid, "logseq.property/query", text);
  const valueUuid = (await dq(`[:find ?u :where [?b :block/uuid #uuid "${b.uuid}"] [?b :logseq.property/query ?v] [?v :block/uuid ?u]]`))[0]?.[0];
  let subProps: unknown = "skipped: no value entity";
  if (valueUuid) {
    try {
      await logseq.Editor.upsertBlockProperty(valueUuid, "logseq.property.node/display-type", ":code");
      await logseq.Editor.upsertBlockProperty(valueUuid, "logseq.property.code/lang", "clojure");
      subProps = "written";
    } catch (e) {
      subProps = { error: e instanceof Error ? e.message : String(e) };
    }
  }
  const readback = await dq(`[:find ?u ?tag ?q :where [?b :block/uuid ?u] [(contains? #{#uuid "${a.uuid}" #uuid "${b.uuid}"} ?u)] [?b :block/tags ?t] [?t :db/ident ?tag] [?b :logseq.property/query ?v] [?v :block/title ?q]]`);
  return { a: a.uuid, b: b.uuid, valueUuid, subProps, readback };
}

/** FEAT-3a: host-provided drag/resize on the main UI container, sized to a panel. */
export async function panelProbe() {
  logseq.setMainUIAttrs({ draggable: true, resizable: true } as never);
  logseq.setMainUIInlineStyle({ width: "560px", height: "420px", top: "90px", left: "240px", zIndex: 99 } as never);
  logseq.showMainUI({ autoFocus: false });
  return { shown: true, note: "verify in Chrome: title bar, drag, resize, app clickable beside it, position after reload" };
}

export const THEME_TOKENS = [
  "--ls-primary-background-color", "--ls-secondary-background-color", "--ls-tertiary-background-color",
  "--ls-primary-text-color", "--ls-secondary-text-color", "--ls-border-color", "--ls-link-text-color",
  "--ls-active-primary-color", "--ls-selection-background-color", "--ls-font-family",
  "--ls-border-radius-low", "--ls-border-radius-medium", "--lx-accent-09", "--lx-gray-03",
];

/** FEAT-3b: can the iframe learn the host's theme tokens? */
export async function themeProbe() {
  const cfg = await logseq.App.getUserConfigs();
  const vals = await logseq.UI.resolveThemeCssPropsVals(THEME_TOKENS);
  return { mode: cfg.preferredThemeMode, vals };
}

/** FEAT-4: fetch latency for the vocabulary the builder needs. */
export async function latencyProbe() {
  const timed = async (name: string, fn: () => Promise<unknown>) => {
    const t0 = performance.now();
    const r = await fn();
    return { name, ms: Math.round(performance.now() - t0), n: Array.isArray(r) ? r.length : undefined };
  };
  const tags = () => dq(`[:find ?title (count ?b) :where [?t :block/tags :logseq.class/Tag] [?t :block/title ?title] [?b :block/tags ?t]]`);
  const props = () => dq(`[:find ?i ?t ?ty ?card :where [?p :block/tags :logseq.class/Property] [?p :db/ident ?i] [?p :block/title ?t] [?p :logseq.property/type ?ty] [?p :db/cardinality ?card] (not [?p :logseq.property/deleted-at _]) (or (not [?p :logseq.property/built-in? true]) [?p :logseq.property/public? true])]`);
  const status = await propertyIdent("qbStatus");
  const values = () => dq(`[:find ?label (count-distinct ?b) :where [?b ${status} ?v] (not [?v :logseq.property/deleted-at _]) (or [?v :block/title ?label] [?v :logseq.property/value ?label])]`);
  const nodes = () => dq(`[:find ?u ?t :where [?b :block/title ?t] [?b :block/uuid ?u] [(clojure.string/lower-case ?t) ?lt] [(clojure.string/includes? ?lt "a")]]`);
  const withRules = () => dq(`[:find ?title :in $ % :where [?tag :db/ident :logseq.class/Task] [?b :block/tags ?t] (or [(= ?t ?tag)] (class-extends ?tag ?t)) [?b :block/title ?title]]`, RULES);
  return [
    await timed("tags+counts cold", tags), await timed("tags+counts warm", tags),
    await timed("properties (datalog)", props), await timed("getAllProperties (api)", () => logseq.Editor.getAllProperties()),
    await timed("getAllTags (api)", () => logseq.Editor.getAllTags()),
    await timed("values+counts qbStatus", values), await timed("node search 'a'", nodes),
    await timed("tag query with rules input", withRules),
  ];
}
