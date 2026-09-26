import { PAGE, RULES, dq, propertyIdent, tagIdent } from "./api";

/**
 * FEAT-1: every operator row from SPEC § Grounding 9, run through datascriptQuery exactly as the
 * emitter will produce it. Every query is scoped to the scratch page so counts are deterministic.
 * `expect` lists the titles the seed makes true.
 */
interface Form {
  name: string;
  where: string;
  inputs?: string[];   // string EDN, as the plugin will send them
  rules?: boolean;     // append % and pass RULES as the last input
  expect: string[];
}

/**
 * Page scope. Property-value entities also carry :block/page, so they are excluded explicitly;
 * so are the query blocks the insert probe adds, which would otherwise shift every expected list.
 */
const SCOPE = `[?b :block/page ?pg] [?pg :block/title "${PAGE}"] [?b :block/title ?title]
  (not [?b :logseq.property/created-from-property _]) (not [?b :block/tags :logseq.class/Query])`;

async function forms(): Promise<Form[]> {
  const project = await tagIdent("QBProject");
  const I: Record<string, string> = {};
  for (const n of ["qbStatus", "qbTags", "qbPoints", "qbAssignee", "qbDue", "qbWhen", "qbDone", "qbLink"]) I[n] = await propertyIdent(n);
  const P = (n: string) => I[n];
  const tomUuid = (await dq(`[:find ?u :where [?b :block/title "Tom"] [?b :block/uuid ?u]]`))[0][0];
  const mariaUuid = (await dq(`[:find ?u :where [?b :block/title "Maria"] [?b :block/uuid ?u]]`))[0][0];
  return [
    { name: "tag inherit on", rules: true, expect: ["Alpha plan", "Beta invoice", "Gamma"],
      where: `[?tag :db/ident ${project}] [?b :block/tags ?t] (or [(= ?t ?tag)] (class-extends ?tag ?t))` },
    { name: "tag exact", expect: ["Alpha plan", "Gamma"], where: `[?b :block/tags ${project}]` },
    { name: "not tag (inherit)", rules: true, expect: ["Maria", "Tom", "Delta invoice", "Epsilon"],
      where: `[?tag :db/ident ${project}] (not [?b :block/tags ?t] (or [(= ?t ?tag)] (class-extends ?tag ?t)))` },
    { name: "has tag", expect: ["Maria", "Tom", "Alpha plan", "Beta invoice", "Gamma"], where: `[?b :block/tags _]` },
    { name: "untagged", expect: ["Delta invoice", "Epsilon"], where: `(not [?b :block/tags _])` },
    { name: "text contains any", expect: ["Alpha plan", "Beta invoice", "Delta invoice"],
      where: `[?b ${P("qbStatus")} ?v] (or [?v :block/title ?x] [?v :logseq.property/value ?x]) [(contains? #{"Todo" "Done"} ?x)]` },
    { name: "text contains all (many)", expect: ["Alpha plan"],
      where: `[?b ${P("qbTags")} ?v1] [?v1 :block/title "red"] [?b ${P("qbTags")} ?v2] [?v2 :block/title "blue"]` },
    { name: "text does not contain", expect: ["Maria", "Tom", "Beta invoice", "Gamma", "Epsilon"],
      where: `(not [?b ${P("qbStatus")} ?v] [?v :block/title ?x] [(contains? #{"Todo"} ?x)])` },
    { name: "node contains any", expect: ["Beta invoice", "Delta invoice"],
      where: `[?b ${P("qbAssignee")} ?v] [?v :block/uuid ?u] [(contains? #{#uuid "${tomUuid}"} ?u)]` },
    { name: "node contains all", expect: ["Beta invoice"],
      where: `[?b ${P("qbAssignee")} ?v1] [?v1 :block/uuid #uuid "${mariaUuid}"] [?b ${P("qbAssignee")} ?v2] [?v2 :block/uuid #uuid "${tomUuid}"]` },
    { name: "number >", expect: ["Alpha plan"], where: `[?b ${P("qbPoints")} ?v] [?v :logseq.property/value ?n] [(> ?n 3)]` },
    { name: "number between", expect: ["Beta invoice", "Gamma"], where: `[?b ${P("qbPoints")} ?v] [?v :logseq.property/value ?n] [(>= ?n 2)] [(<= ?n 3)]` },
    { name: "checkbox true", expect: ["Alpha plan"], where: `[?b ${P("qbDone")} true]` },
    { name: "checkbox false", expect: ["Beta invoice"], where: `[?b ${P("qbDone")} false]` },
    { name: "is empty", expect: ["Maria", "Tom", "Gamma", "Epsilon"],
      where: `(or (not [?b ${P("qbStatus")} _]) [?b ${P("qbStatus")} :logseq.property/empty-placeholder])` },
    { name: "is not empty", expect: ["Alpha plan", "Beta invoice", "Delta invoice"],
      where: `[?e :db/ident :logseq.property/empty-placeholder] [?b ${P("qbStatus")} ?v] [(not= ?v ?e)]` },
    { name: "url contains", expect: ["Alpha plan"],
      where: `[?b ${P("qbLink")} ?v] [?v :block/title ?x] [(clojure.string/includes? ?x "a.example")]` },
    { name: "date equals today", inputs: [":today"], expect: ["Alpha plan"],
      where: `[?b ${P("qbDue")} ?d] [?d :block/journal-day ?day] [(= ?day ?in1)]` },
    { name: "date before today", inputs: [":today"], expect: ["Gamma"],
      where: `[?b ${P("qbDue")} ?d] [?d :block/journal-day ?day] [(< ?day ?in1)]` },
    { name: "date on or before +7d", inputs: [":+7d"], expect: ["Alpha plan", "Beta invoice", "Gamma"],
      where: `[?b ${P("qbDue")} ?d] [?d :block/journal-day ?day] [(<= ?day ?in1)]` },
    { name: "date after -7d (offset input)", inputs: [":-7d"], expect: ["Alpha plan", "Beta invoice"],
      where: `[?b ${P("qbDue")} ?d] [?d :block/journal-day ?day] [(> ?day ?in1)]` },
    { name: "date between today and +7d", inputs: [":today", ":+7d"], expect: ["Alpha plan", "Beta invoice"],
      where: `[?b ${P("qbDue")} ?d] [?d :block/journal-day ?day] [(>= ?day ?in1)] [(<= ?day ?in2)]` },
    { name: "datetime on today", inputs: [":start-of-today-ms", ":end-of-today-ms"], expect: ["Alpha plan"],
      where: `[?b ${P("qbWhen")} ?ms] [(>= ?ms ?in1)] [(<= ?ms ?in2)]` },
    { name: "datetime before -3d (start)", inputs: [":-3d-ms"], expect: ["Gamma"],
      where: `[?b ${P("qbWhen")} ?ms] [(< ?ms ?in1)]` },
    { name: "datetime after +3d (end)", inputs: [":+3d-ms"], expect: ["Beta invoice"],
      where: `[?b ${P("qbWhen")} ?ms] [(> ?ms ?in1)]` },
    { name: "datetime on or before +7d-end", inputs: [":+7d-end"], expect: ["Alpha plan", "Beta invoice", "Gamma"],
      where: `[?b ${P("qbWhen")} ?ms] [(<= ?ms ?in1)]` },
    { name: "content contains (lower)", expect: ["Beta invoice", "Delta invoice"],
      where: `[(clojure.string/lower-case ?title) ?lt] [(clojure.string/includes? ?lt "invoice")]` },
    { name: "content starts with", expect: ["Alpha plan"], where: `[(clojure.string/lower-case ?title) ?lt] [(clojure.string/starts-with? ?lt "alpha")]` },
    { name: "content does not contain", expect: ["Maria", "Tom", "Alpha plan", "Gamma", "Epsilon"],
      where: `[(clojure.string/lower-case ?title) ?lt] (not [(clojure.string/includes? ?lt "invoice")])` },
    { name: "content regex via re-pattern", expect: ["Beta invoice", "Delta invoice"],
      where: `[(re-pattern "inv.*ce") ?re] [(re-find ?re ?title)]` },
    { name: "scenario 2 shape", rules: true, inputs: [":+30d-ms"], expect: ["Alpha plan"],
      where: `[?tag :db/ident ${project}] [?b :block/tags ?t] (or [(= ?t ?tag)] (class-extends ?tag ?t))
              [?b ${P("qbAssignee")} ?a] [?a :block/uuid #uuid "${mariaUuid}"]
              (not [?b ${P("qbStatus")} ?s] [?s :block/title "Done"])
              [?b ${P("qbWhen")} ?ms] [(<= ?ms ?in1)]` },
    { name: "scenario 4 shape", rules: true, inputs: [":start-of-today-ms", ":+7d-ms"], expect: ["Beta invoice"],
      where: `[?tag :db/ident ${project}] [?b :block/tags ?t] (or [(= ?t ?tag)] (class-extends ?tag ?t))
              [?b ${P("qbWhen")} ?ms] [(>= ?ms ?in1)] [(<= ?ms ?in2)]
              [(clojure.string/lower-case ?title) ?lt] [(clojure.string/includes? ?lt "invoice")]` },
  ];
}

export function buildQuery(f: Form): { query: string; inputs: unknown[] } {
  const ins = (f.inputs ?? []).map((_, i) => `?in${i + 1}`);
  const inClause = ins.length || f.rules ? ` :in $ ${ins.join(" ")}${f.rules ? " %" : ""}` : "";
  const query = `[:find ?title${inClause} :where ${SCOPE} ${f.where}]`;
  const inputs: unknown[] = [...(f.inputs ?? [])];
  if (f.rules) inputs.push(RULES);
  return { query, inputs };
}

export async function runForms() {
  const out = [];
  for (const f of await forms()) {
    const { query, inputs } = buildQuery(f);
    const t0 = performance.now();
    let got: string[] = [];
    let error: string | undefined;
    try {
      got = (await dq(query, ...inputs)).map((r) => String(r[0])).sort();
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
    const expect = [...f.expect].sort();
    out.push({ name: f.name, pass: !error && JSON.stringify(got) === JSON.stringify(expect), got, expect, error, ms: Math.round(performance.now() - t0), query, inputs });
  }
  return out;
}

export async function inputsProbe() {
  const names = [":today", ":-7d", ":+7d", ":-1w", ":+1m", ":-1y", ":start-of-today-ms", ":end-of-today-ms", ":-3d-ms", ":+3d-ms", ":+7d-start", ":+7d-end", ":right-now-ms", ":start-of-week"];
  const out: Record<string, unknown> = {};
  for (const n of names) {
    try {
      out[n] = (await dq(`[:find ?y :in $ ?x :where [(str ?x) ?y]]`, n))[0]?.[0];
    } catch (e) {
      out[n] = { error: e instanceof Error ? e.message : String(e) };
    }
  }
  return out;
}
