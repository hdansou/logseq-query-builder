import type { TagClause } from "../model";
import { addTag, removeTag, setInherit, setTag } from "../model";
import { createPicker, type Option } from "./picker";
import type { ZoneRenderer } from "./render";

/** Tag selector: chips with AND/OR/NOT, an autocomplete over the graph's tags, the inherit toggle. */
export const renderTags: ZoneRenderer = (root, s, { store, graph }) => {
  root.innerHTML = "";
  const label = document.createElement("div");
  label.className = "zone-label";
  label.textContent = "Tags";
  const hint = document.createElement("span"); hint.className = "hint"; hint.textContent = "empty = all nodes";
  label.appendChild(hint);
  root.appendChild(label);

  const line = document.createElement("div"); line.className = "flex";
  s.q.tags.forEach((t, i) => {
    if (i > 0) {
      const join = document.createElement("select"); join.className = "join"; join.dataset.fid = `tag-join-${i}`;
      for (const j of ["and", "or"]) { const opt = document.createElement("option"); opt.value = j; opt.textContent = j.toUpperCase(); opt.selected = t.join === j; join.appendChild(opt); }
      join.addEventListener("change", () => store.update((q) => setTag(q, i, { join: join.value as TagClause["join"] })));
      line.appendChild(join);
    }
    const chip = document.createElement("span"); chip.className = "chip" + (t.not ? " neg" : "");
    const not = document.createElement("button"); not.className = "tog" + (t.not ? " on" : ""); not.textContent = t.not ? "NOT" : "IS"; not.dataset.fid = `tag-not-${i}`;
    not.title = "Toggle NOT";
    not.addEventListener("click", () => store.update((q) => setTag(q, i, { not: !t.not })));
    const name = document.createElement("span"); name.textContent = t.tag ? t.tag.title : "any tag";
    const x = document.createElement("button"); x.className = "x"; x.textContent = "×"; x.dataset.fid = `tag-x-${i}`; x.title = "Remove";
    x.addEventListener("click", () => store.update((q) => removeTag(q, i)));
    chip.append(not, name, x);
    line.appendChild(chip);
  });

  line.appendChild(createPicker<TagClause["tag"]>({
    fid: "tag-picker",
    placeholder: s.q.tags.length ? "add tag…" : "tag…",
    options: async () => {
      const tags = await graph.tags();
      const opts: Option<TagClause["tag"]>[] = tags.map((t) => ({ id: t.ident, label: t.title, hint: `${t.count}`, value: { ident: t.ident, title: t.title } }));
      opts.push({ id: "*", label: "any tag", hint: "presence", value: null });
      return opts;
    },
    onPick: (o) => store.update((q) => addTag(q, o.value)),
  }));

  const inherit = document.createElement("label"); inherit.className = "flex"; inherit.style.marginLeft = "auto"; inherit.style.fontSize = "11.5px";
  const cb = document.createElement("input"); cb.type = "checkbox"; cb.checked = s.q.inherit; cb.dataset.fid = "inherit";
  cb.addEventListener("change", () => store.update((q) => setInherit(q, cb.checked)));
  inherit.append(cb, document.createTextNode(" include sub-tags"));
  line.appendChild(inherit);
  root.appendChild(line);
};
