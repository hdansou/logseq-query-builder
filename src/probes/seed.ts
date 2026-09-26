import "@logseq/libs";
import { PAGE, addDays, dq, eidByUuid, journalEid } from "./api";

/**
 * Seeds the scratch page with one node per value shape. Idempotent at the tag/property level
 * (upserts), but re-running appends the nodes again, so run it once per scratch graph.
 *
 * Properties land in the plugin namespace (`plugin.property.<host-assigned id, underscore
 * stripped>/<name>`), which has no random suffix. That is the one way the seed differs from a user-made graph; the operator
 * forms are namespace-agnostic, so the probes are still representative.
 */
export const SEED_PROPERTIES = {
  qbStatus: { type: "default" },
  qbTags: { type: "default", cardinality: "many" },
  qbPoints: { type: "number" },
  qbAssignee: { type: "node", cardinality: "many" },
  qbDue: { type: "date" },
  qbWhen: { type: "datetime" },
  qbDone: { type: "checkbox" },
  qbLink: { type: "url" },
} as const;


async function ensureTag(title: string, extendsTitle?: string) {
  let tag = await logseq.Editor.getTag(title);
  if (!tag) tag = await logseq.Editor.createTag(title);
  if (!tag) throw new Error(`could not create tag ${title}`);
  if (extendsTitle) await logseq.Editor.addTagExtends(tag.uuid, extendsTitle);
  return tag;
}

async function node(content: string, tag?: string, props: Record<string, unknown> = {}) {
  const block = await logseq.Editor.appendBlockInPage(PAGE, content);
  if (!block) throw new Error(`could not append ${content}`);
  if (tag) await logseq.Editor.addBlockTag(block.uuid, tag);
  for (const [k, v] of Object.entries(props)) await logseq.Editor.upsertBlockProperty(block.uuid, k, v);
  return block.uuid;
}

export async function seed() {
  const existing = await dq(`[:find ?p :where [?p :block/title "${PAGE}"] [?p :block/tags :logseq.class/Page]]`);
  if (existing.length) throw new Error(`${PAGE} already exists; use a fresh scratch graph`);

  await ensureTag("QBProject");
  await ensureTag("QBSubproject", "QBProject");
  await ensureTag("QBPerson");
  for (const [name, schema] of Object.entries(SEED_PROPERTIES)) await logseq.Editor.upsertProperty(name, schema);

  await logseq.Editor.createPage(PAGE, {}, { redirect: false, createFirstBlock: false });

  const maria = await node("Maria", "QBPerson");
  const tom = await node("Tom", "QBPerson");
  const [mariaE, tomE] = [await eidByUuid(maria), await eidByUuid(tom)];
  const today = new Date();
  const [dToday, dPlus7, dMinus10] = [await journalEid(today), await journalEid(addDays(today, 7)), await journalEid(addDays(today, -10))];
  const now = Date.now();
  const DAY = 86_400_000;

  const alpha = await node("Alpha plan", "QBProject", {
    qbStatus: "Todo", qbTags: ["red", "blue"], qbPoints: 5, qbAssignee: [mariaE],
    qbDue: dToday, qbWhen: now, qbDone: true, qbLink: "https://a.example",
  });
  const beta = await node("Beta invoice", "QBSubproject", {
    qbStatus: "Done", qbTags: ["blue"], qbPoints: 2, qbAssignee: [mariaE, tomE],
    qbDue: dPlus7, qbWhen: now + 7 * DAY, qbDone: false,
  });
  const gamma = await node("Gamma", "QBProject", { qbPoints: 3, qbDue: dMinus10, qbWhen: now - 10 * DAY });
  const delta = await node("Delta invoice", undefined, { qbStatus: "Todo", qbAssignee: [tomE] });
  const epsilon = await node("Epsilon");

  return { page: PAGE, uuids: { maria, tom, alpha, beta, gamma, delta, epsilon }, eids: { mariaE, tomE }, days: { dToday, dPlus7, dMinus10 } };
}
