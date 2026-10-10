// node scripts/seed-persona.mjs [graph]: build the persona graph described in docs/e2e-persona.md
// from scratch with the logseq CLI, then print the engine's count for each scenario next to the
// count the design predicts. A mismatch means the seed (or the prediction) is wrong, not the plugin.
import { execFileSync } from "node:child_process";

const GRAPH = process.argv[2] ?? "qb-e2e-persona";

function cli(...args) {
  const out = execFileSync("logseq", [...args, "-g", GRAPH, "-o", "json"], { encoding: "utf8", timeout: 60000 }).trim();
  let j;
  try { j = JSON.parse(out); } catch { throw new Error(`${args.join(" ")}\n${out}`); }
  if (j.status !== "ok") throw new Error(`${args.join(" ")}\n${out}`);
  return j.data;
}
const one = (data) => data.result?.[0];
const q = (query) => {
  const out = execFileSync("logseq", ["query", "-g", GRAPH, "-o", "edn", "--query", query], { encoding: "utf8", timeout: 60000 });
  return out;
};
const countOf = (where) => {
  const m = /:result \(\[(\d+)\]\)/.exec(q(`[:find (count-distinct ?b) :where ${where}]`));
  return m ? Number(m[1]) : 0;
};
const idByDay = (day) => { const m = /\[(\d+)\]/.exec(q(`[:find ?p :where [?p :block/journal-day ${day}]]`)); if (!m) throw new Error(`no journal ${day}`); return Number(m[1]); };

// ---- fresh graph --------------------------------------------------------------------------------
try { execFileSync("logseq", ["graph", "remove", "-g", GRAPH, "-o", "json"], { encoding: "utf8" }); } catch { /* did not exist, or locked: create will say */ }
try { cli("graph", "create"); } catch (e) { if (!/exists/.test(String(e))) throw e; }

// ---- schema -------------------------------------------------------------------------------------
for (const t of ["Project", "Person", "Meeting", "Book", "Idea", "Client Project"]) cli("upsert", "tag", "--name", t);
const props = [
  ["ProjStatus", "default", "one"], ["DueDate", "date", "one"], ["Budget", "number", "one"],
  ["Company", "default", "one"], ["Role", "default", "one"],
  ["With", "node", "many"],
  ["Author", "default", "one"], ["Rating", "number", "one"], ["Finished", "checkbox", "one"],
];
for (const [name, type, card] of props) cli("upsert", "property", "--name", name, "--type", type, "--cardinality", card);
cli("upsert", "tag", "--name", "Project", "--add-properties", '["ProjStatus" "DueDate" "Budget"]');
cli("upsert", "tag", "--name", "Person", "--add-properties", '["Company" "Role"]');
cli("upsert", "tag", "--name", "Meeting", "--add-properties", '["With"]');
cli("upsert", "tag", "--name", "Book", "--add-properties", '["Author" "Rating" "Finished"]');

const idents = Object.fromEntries(cli("list", "property").items.filter((p) => String(p["db/ident"]).startsWith("user.")).map((p) => [p["block/title"], ":" + p["db/ident"]]));
const tags = Object.fromEntries(cli("list", "tag").items.map((t) => [t["block/title"], t["db/id"]]));
cli("upsert", "page", "--id", String(tags["Client Project"]), "--update-properties", `{:logseq.property.class/extends [${tags.Project}]}`);

// ---- journal pages (a date value must point at a journal page entity) ---------------------------
const days = { "Sep 30th, 2026": 20260930, "Oct 6th, 2026": 20261006, "Oct 7th, 2026": 20261007, "Oct 8th, 2026": 20261008, "Oct 9th, 2026": 20261009, "Oct 12th, 2026": 20261012, "Oct 20th, 2026": 20261020, "Nov 15th, 2026": 20261115 };
const journal = {};
for (const [title, day] of Object.entries(days)) {
  const id = one(cli("upsert", "block", "--target-page", title, "--content", "seed"));
  cli("remove", "block", "--id", String(id));
  journal[day] = idByDay(day);
}

// ---- pages --------------------------------------------------------------------------------------
const edn = (v) => (typeof v === "string" ? JSON.stringify(v) : String(v));
function page(title, tag, values) {
  cli("upsert", "page", "--page", title, "--update-tags", `["${tag}"]`);
  const pairs = Object.entries(values).map(([k, v]) => `${idents[k]} ${edn(v)}`).join(" ");
  if (pairs) cli("upsert", "page", "--page", title, "--update-properties", `{${pairs}}`);
}
page("Project Atlas", "Project", { ProjStatus: "Active", DueDate: journal[20261020], Budget: 12000 });
page("Project Beacon", "Client Project", { ProjStatus: "Active", DueDate: journal[20261012], Budget: 30000 });
page("Project Comet", "Project", { ProjStatus: "On hold", DueDate: journal[20261115], Budget: 5000 });
page("Project Dune", "Client Project", { ProjStatus: "Done", DueDate: journal[20260930], Budget: 8000 });
page("Website Refresh", "Project", { ProjStatus: "Active" });
page("Alice Nguyen", "Person", { Company: "Northwind", Role: "PM" });
page("Bob Osei", "Person", { Company: "Northwind", Role: "Designer" });
page("Chen Wei", "Person", { Company: "Acme", Role: "CTO" });
page("Dana Ruiz", "Person", { Role: "Freelancer" });
page("The Design of Everyday Things", "Book", { Author: "Don Norman", Rating: 5, Finished: true });
page("Thinking, Fast and Slow", "Book", { Author: "Daniel Kahneman", Rating: 4, Finished: false });
page("Just Enough Research", "Book", { Author: "Erika Hall", Rating: 4, Finished: true });
page("Sprint", "Book", { Author: "Jake Knapp", Rating: 3, Finished: false });
page("Range", "Book", { Author: "David Epstein", Finished: false });

// ---- blocks -------------------------------------------------------------------------------------
const pageId = (title) => { const m = /\[(\d+)\]/.exec(q(`[:find ?p :where [?p :block/title ${JSON.stringify(title)}] [?p :block/name]]`)); return Number(m[1]); };
// Properties go on the create call: `upsert block --id … --update-properties` recomputes
// :block/refs from the properties alone and drops the content's [[links]] (CLI 533ac43, 2026-10-09).
const block = (where, content, opts = {}) => {
  const args = ["upsert", "block", "--content", content, ...(where.page ? ["--target-page", where.page] : ["--target-id", String(where.under), "--pos", "last-child"])];
  if (opts.tags) args.push("--update-tags", `[${opts.tags.map((t) => JSON.stringify(t)).join(" ")}]`);
  if (opts.props) args.push("--update-properties", `{${Object.entries(opts.props).map(([k, v]) => `${idents[k]} ${v}`).join(" ")}}`);
  return one(cli(...args));
};
// `upsert task` creates only under a page; a nested task is a child block converted in place.
const task = (where, content, status, priority, deadline) => {
  const args = ["upsert", "task", "--status", status];
  if (where.page) args.push("--content", content, "--target-page", where.page); else args.push("--id", String(block(where, content)));
  if (priority) args.push("--priority", priority);
  if (deadline) args.push("--deadline", `${deadline}T12:00:00.000Z`);
  return one(cli(...args));
};
const who = (...names) => `[${names.map((n) => pageId(n)).join(" ")}]`;

let m = block({ page: "Oct 6th, 2026" }, "Met with [[Alice Nguyen]] about [[Project Atlas]]", { tags: ["Meeting"], props: { With: who("Alice Nguyen") } });
block({ under: m }, "Decision: ship the research readout by Friday");
block({ under: m }, "Alice wants the budget revisited", { tags: ["Idea"] });
task({ page: "Oct 6th, 2026" }, "Send Atlas report to [[Alice Nguyen]]", "todo", "high", "2026-10-10");
block({ page: "Oct 6th, 2026" }, "Reading [[Thinking, Fast and Slow]]: system 1 notes");

m = block({ page: "Oct 7th, 2026" }, "Call with [[Chen Wei]] on [[Project Beacon]] scope", { tags: ["Meeting"], props: { With: who("Chen Wei") } });
block({ under: m }, "Decision: cut the mobile scope");
task({ page: "Oct 7th, 2026" }, "Draft Beacon interview guide", "doing", "medium", "2026-10-14");
task({ page: "Oct 7th, 2026" }, "Invoice [[Project Dune]]", "done", "low");
block({ page: "Oct 7th, 2026" }, "Idea: a template for research readouts, for [[Project Beacon]]", { tags: ["Idea"] });

m = block({ page: "Oct 8th, 2026" }, "Workshop with [[Alice Nguyen]] and [[Bob Osei]]", { tags: ["Meeting"], props: { With: who("Alice Nguyen", "Bob Osei") } });
block({ under: m }, "Decision: run 5 interviews next week");
task({ under: m }, "Recruit 5 participants for [[Project Atlas]]", "todo", "high", "2026-10-15");
task({ page: "Oct 8th, 2026" }, "Renew [[Sprint]] library loan", "todo", "low", "2026-11-01");
block({ page: "Oct 8th, 2026" }, "Thought on [[Range]]: breadth beats depth early");

task({ page: "Oct 9th, 2026" }, "Review [[Project Comet]] hold decision", "todo", "medium");
block({ page: "Oct 9th, 2026" }, "Decision pending on Comet");

const g = block({ page: "Project Atlas" }, "Goals");
block({ under: g }, "Understand onboarding drop-off");
task({ page: "Project Atlas" }, "Synthesize interview notes", "todo", "high", "2026-10-11");
block({ page: "Project Atlas" }, "Related: [[Project Beacon]] shares the participant pool");
task({ page: "Project Beacon" }, "Kickoff deck", "done");
block({ page: "Project Beacon" }, "Stakeholders: [[Chen Wei]]");

// ---- the engine's count per scenario, next to the design's -------------------------------------
const P = idents, T = tags;
const ex = (title) => `[?x :block/title ${JSON.stringify(title)}] [?x :block/name]`;
const rules = (where) => where; // plain Datalog; sub-tag inheritance is spelled out where a scenario needs it
const checks = [
  ["S1", 6, `[?b :block/tags :logseq.class/Task] (not [?b :logseq.property/status :logseq.property/status.done])`],
  ["S3a", 2, `${ex("Project Atlas")} [?b :block/refs ?x]`],
  // the mentions themselves and everything nested under them (FEAT-44's definition of the direction)
  ["S3b", 4, `${ex("Project Atlas")} [?a :block/refs ?x] (or-join [?a ?b] [(identity ?a) ?b] [?b :block/parent ?a])`],
  // a text property value is an entity on the page too (`created-from-property`); Maya does not count it
  ["S3c", 4, `${ex("Project Atlas")} [?b :block/page ?x] (not [?b :logseq.property/created-from-property _])`],
  ["S4", 2, `[?b :block/tags ${T.Meeting}] ${ex("Alice Nguyen")} [?b ${P.With} ?x]`],
  ["S5", 3, `[?b :block/title ?t] [(clojure.string/starts-with? ?t "Decision:")]`],
  ["S6", 1, `[?b :block/tags ${T.Book}] [?b ${P.Rating} ?rv] [?rv :logseq.property/value ?r] [(> ?r 3)] [?b ${P.Finished} false]`],
  ["S6b", 1, `[?b :block/tags ${T.Book}] (not [?b ${P.Rating}])`],
  ["S7a", 3, `(or [?b :block/tags ${T.Project}] [?b :block/tags ${T["Client Project"]}]) [?b ${P.ProjStatus} ?v] [?v :block/title "Active"]`],
  ["S7b", 2, `[?b :block/tags ${T.Project}] [?b ${P.ProjStatus} ?v] [?v :block/title "Active"]`],
  ["S7c", 2, `[?b :block/tags ${T["Client Project"]}]`],
  ["S8a", 1, `(or [?b :block/tags ${T.Project}] [?b :block/tags ${T["Client Project"]}]) (not [?b ${P.DueDate}])`],
  ["S8b", 2, `(or [?b :block/tags ${T.Project}] [?b :block/tags ${T["Client Project"]}]) [?b ${P.Budget} ?bv] [?bv :logseq.property/value ?n] [(> ?n 10000)]`],
  ["S9a", 3, `(or [?b :block/tags ${T.Project}] [?b :block/tags ${T["Client Project"]}]) [?b ${P.DueDate} ?j] [?j :block/journal-day ?d] [(< ?d 20261101)]`],
  ["S9b", 3, `(or [?b :block/tags ${T.Project}] [?b :block/tags ${T["Client Project"]}]) [?b ${P.DueDate} ?j] [?j :block/journal-day ?d] [(> ?d 20261009)]`],
  ["S10", 1, `[?b :block/tags ${T.Idea}] (not [?b :block/refs ?p] (or [?p :block/tags ${T.Project}] [?p :block/tags ${T["Client Project"]}]))`],
  ["S11a", 2, `[?b :block/tags ${T.Person}] [?b ${P.Company} ?v] [?v :block/title "Northwind"]`],
  ["S11b", 1, `[?b :block/tags ${T.Person}] (not [?b ${P.Company}])`],
  ["S12", 3, `[?b :block/refs ?p] [?p :block/tags ${T.Person}] [?p ${P.Company} ?v] [?v :block/title "Northwind"]`],
  // Beacon (inline link) and Oct 20th, 2026 (the DueDate value is a journal page): a date is a link too
  ["S13", 2, `${ex("Project Atlas")} (or [(identity ?x) ?s] [?s :block/page ?x]) [?s :block/refs ?b] (not [?b :block/tags :logseq.class/Property]) (not [?b :block/tags :logseq.class/Tag]) (not [?s :block/tags ?b]) [?b :block/name]`],
  ["S14", 1, `${ex("Project Atlas")} [?b :block/page ?x] [?b :block/tags :logseq.class/Task]`],
  ["S15a", 5, `[?p :block/journal-day 20261008] [?b :block/page ?p]`],
  ["S15b", 2, `[?p :block/journal-day 20261008] [?b :block/page ?p] [?b :block/tags :logseq.class/Task]`],
  ["S16", 1, `[?b :block/title ?t] [(re-pattern "^Idea:") ?re] [(re-find ?re ?t)]`],
  ["S2 (absolute: deadline ≤ Oct 16)", 3, `[?b :block/tags :logseq.class/Task] [?b :logseq.property/priority :logseq.property/priority.high] (not [?b :logseq.property/status :logseq.property/status.done]) [?b :logseq.property/deadline ?ms] [(<= ?ms 1792627199999)]`],
];
let bad = 0;
for (const [name, expected, where] of checks) {
  const got = countOf(rules(where));
  const ok = got === expected;
  if (!ok) bad++;
  console.log(`${ok ? "ok  " : "DIFF"} ${name.padEnd(36)} expected ${expected}  engine ${got}`);
}
console.log(bad ? `\n${bad} scenario(s) differ from the design: fix the seed or the expectation before running the UI` : "\nseed matches the design");
process.exit(bad ? 1 : 0);
