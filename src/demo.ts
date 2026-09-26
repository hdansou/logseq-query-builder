import "@logseq/libs";
import { emit } from "./emit";
import { Graph } from "./graph";
import { addRow, addTag, emptyQuery, setContent, setRow } from "./model";
import { navigateTo } from "./nav";
import { page, runPreview } from "./preview";
import { readback } from "./readback";
import { postToSink } from "./probes/harness";

/**
 * P2 exit check, dev-only: drive the core + graph + preview end to end from a palette command and
 * render a bare results list, before any real panel exists. Replaced by the P3 UI.
 */
export async function demo() {
  const graph = new Graph((q, ...ins) => logseq.DB.datascriptQuery(q, ...ins));
  const t0 = performance.now();
  const tags = await graph.tags();
  const project = tags.find((t) => t.title === "QBProject");
  if (!project) throw new Error("seed the scratch graph first");
  const props = await graph.properties([project.ident]);
  const status = props.find((p) => p.title === "qbStatus");
  if (!status) throw new Error("qbStatus not found");
  const values = await graph.values(status);
  const people = await graph.nodes("m", undefined);

  let q = addTag(emptyQuery(), project);
  q = addRow(q);
  q = setRow(q, q.rows[0].id, { property: status, op: "not-contains", values: [{ kind: "text", text: "Done" }] });
  q = setContent(q, { op: "contains", value: "a" });
  const e = emit(q);
  const rows = await runPreview(e, (qq, ...ins) => logseq.DB.datascriptQuery(qq, ...ins));
  const shown = page(rows, 1);
  const ms = Math.round(performance.now() - t0);

  const el = document.getElementById("content")!;
  el.innerHTML = "";
  const h = (tag: string, text: string) => { const n = document.createElement(tag); n.textContent = text; el.appendChild(n); return n; };
  h("p", readback(q)).style.fontWeight = "600";
  h("p", `tags: ${tags.map((t) => `${t.title} (${t.count})`).join(", ")}`);
  h("p", `properties for ${project.title}: ${props.slice(0, 6).map((p) => `${p.title}:${p.type}${p.owners.length ? "*" : ""}`).join(", ")} …`);
  h("p", `values of ${status.title}: ${values.map((v) => `${v.label} (${v.count})`).join(", ")}`);
  h("p", `nodes matching "m": ${people.map((n) => n.title).join(", ")}`);
  h("p", `results ${shown.shown.length} of ${shown.total} in ${ms} ms — click one`);
  for (const r of shown.shown) {
    const b = document.createElement("button");
    b.textContent = `${r.title}${r.page ? `  ·  ${r.page.title}` : ""}`;
    b.style.cssText = "display:block;margin:4px 0;padding:6px 10px;background:#2a2e41;color:#e8e6e3;border:0;border-radius:6px;cursor:pointer;font:inherit";
    b.addEventListener("click", () => void navigateTo(r.uuid));
    el.appendChild(b);
  }
  await postToSink({ probe: "demo", ok: true, ms, at: new Date().toISOString(), detail: { readback: readback(q), tags, propertiesTop: props.slice(0, 6), values, people, results: rows, block: e.block } });
}

export function registerDemo() {
  logseq.App.registerCommandPalette({ key: "qb-demo", label: "Query Builder: demo (P2)" }, async () => {
    logseq.setMainUIAttrs({ draggable: true, resizable: true } as never);
    logseq.setMainUIInlineStyle({ width: "620px", height: "480px", top: "80px", left: "260px", zIndex: 99 } as never);
    logseq.showMainUI({ autoFocus: false });
    await demo();
  });
}
