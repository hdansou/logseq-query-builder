import type { NodeInfo, TagInfo } from "../graph";
import { removeRef, setRef, type RefDirection, type RefRow, type RefTarget } from "../model";
import { createPicker, filterOptions, type Option } from "./picker";
import type { Ctx, ZoneRenderer } from "./render";
import { joinToggle } from "./rows";

/**
 * References zone (spec § Reference querying): one row per relationship, `direction · target`,
 * with per-row AND/OR and NOT like filter rows. The target is one node or every node carrying a
 * tag, optionally narrowed by a name fragment.
 */
export const DIRECTIONS: { id: RefDirection; label: string }[] = [
  { id: "links-to", label: "links to" },
  { id: "linked-from", label: "is linked from" },
  { id: "ancestor-links-to", label: "ancestor links to" },
  { id: "under", label: "on page under" },
];
const dirLabel = (id: RefDirection) => DIRECTIONS.find((d) => d.id === id)!.label;

/** Tags first ("any project", count as hint), then the nodes the graph search returned. */
export function targetOptions(tags: TagInfo[], nodes: NodeInfo[], text = ""): Option<RefTarget>[] {
  const tagOpts: Option<RefTarget>[] = tags.map((t) => ({
    id: t.ident, label: `any ${t.title}`, hint: `${t.count}`, value: { kind: "tag", tag: { ident: t.ident, title: t.title }, name: "" },
  }));
  const nodeOpts: Option<RefTarget>[] = nodes.map((n) => ({
    id: n.uuid, label: n.title, hint: n.page?.title, value: { kind: "node", uuid: n.uuid, title: n.title },
  }));
  return [...filterOptions(tagOpts, text), ...nodeOpts];
}

const el = (tag: string, cls?: string, text?: string) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };

function renderRef(r: RefRow, i: number, ctx: Ctx): HTMLElement {
  const { store, graph } = ctx;
  const line = el("div", "row");
  if (i > 0) line.appendChild(joinToggle(`ref-join-${r.id}`, r.join, (j) => store.update((q) => setRef(q, r.id, { join: j }))));
  else line.appendChild(el("span", "spacer", "that"));

  const not = el("button", "tog" + (r.not ? " on" : ""), r.not ? "NOT" : "IS") as HTMLButtonElement;
  not.dataset.fid = `ref-not-${r.id}`; not.title = "Toggle NOT";
  not.addEventListener("click", () => store.update((q) => setRef(q, r.id, { not: !r.not })));
  line.appendChild(not);

  line.appendChild(createPicker<RefDirection>({
    fid: `ref-dir-${r.id}`, placeholder: "direction…", initial: dirLabel(r.dir), keepOnPick: true, showAllOnFocus: true, width: "150px",
    options: async () => DIRECTIONS.map((d) => ({ id: d.id, label: d.label, value: d.id })),
    onPick: (o) => {
      store.update((q) => setRef(q, r.id, { dir: o.value }));
      document.querySelector<HTMLElement>(`[data-fid="ref-target-${r.id}"]`)?.focus();   // render is synchronous
    },
  }));

  if (r.target) {
    const t = r.target;
    const chip = el("span", "chip" + (r.not ? " neg" : ""));
    chip.appendChild(el("span", undefined, t.kind === "node" ? t.title : `any ${t.tag.title}`));
    const x = el("button", "x", "×") as HTMLButtonElement; x.dataset.fid = `ref-clear-${r.id}`; x.title = "Change target";
    x.addEventListener("click", () => store.update((q) => setRef(q, r.id, { target: null })));
    chip.appendChild(x);
    line.appendChild(chip);
    if (t.kind === "tag") {
      // Name condition on the target set: "any project named like iris". Commits on every keystroke.
      const name = document.createElement("input");
      name.dataset.fid = `ref-name-${r.id}`; name.placeholder = "named like…"; name.value = t.name; name.style.minWidth = "120px";
      name.title = "Narrow the target set to titles containing this text";
      name.addEventListener("input", () => store.update((q) => setRef(q, r.id, { target: { ...t, name: name.value } })));
      line.appendChild(name);
    }
  } else {
    line.appendChild(createPicker<RefTarget>({
      fid: `ref-target-${r.id}`, placeholder: "any tag, or a node…", width: "200px",
      search: async (text) => targetOptions(await graph.tags(), text.trim() ? await graph.nodes(text) : [], text),
      onPick: (o) => {
        store.update((q) => setRef(q, r.id, { target: o.value }));
        document.querySelector<HTMLElement>(`[data-fid="ref-name-${r.id}"], [data-fid="ref-x-${r.id}"]`)?.focus();
      },
    }));
  }

  const x = el("button", "x", "×") as HTMLButtonElement; x.dataset.fid = `ref-x-${r.id}`; x.title = "Remove reference";
  x.addEventListener("click", () => store.update((q) => removeRef(q, r.id)));
  line.appendChild(x);
  return line;
}

/** Put the cursor in a row's direction picker (the store renders synchronously, so no timer). */
export function focusRef(id: string) {
  document.querySelector<HTMLElement>(`[data-fid="ref-dir-${id}"]`)?.focus();
}

export const renderRefs: ZoneRenderer = (root, s, ctx) => {
  root.innerHTML = "";
  const label = el("div", "zone-label", "References");
  label.appendChild(el("span", "hint", "one hop · linked references only"));
  root.appendChild(label);
  s.q.refs.forEach((r, i) => root.appendChild(renderRef(r, i, ctx)));
  const add = el("button", "btn", s.q.refs.length ? "+ reference" : "+ add a reference") as HTMLButtonElement;
  add.dataset.fid = "add-ref";
  add.addEventListener("click", () => focusRef(ctx.store.addRef()));
  root.appendChild(add);
};
