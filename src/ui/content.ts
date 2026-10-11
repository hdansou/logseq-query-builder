import { setContent, type ContentOp } from "../model";
import { createPicker } from "./picker";
import type { ZoneRenderer } from "./render";

/** Content search: one optional row over the node's own text. */
const OPS: { id: ContentOp; label: string }[] = [
  { id: "contains", label: "contains" }, { id: "not-contains", label: "does not contain" },
  { id: "starts-with", label: "starts with" }, { id: "matches", label: "matches regex" },
];
const labelOf = (op: ContentOp) => OPS.find((o) => o.id === op)!.label;

export const renderContent: ZoneRenderer = (root, s, { store }) => {
  root.innerHTML = "";
  const label = document.createElement("div"); label.className = "zone-label"; label.textContent = "Content";
  const hint = document.createElement("span"); hint.className = "hint"; hint.textContent = "the node's own text, case-insensitive";
  label.appendChild(hint); root.appendChild(label);

  const line = document.createElement("div"); line.className = "row";
  const op = s.q.content?.op ?? "contains";
  const input = document.createElement("input"); input.dataset.fid = "content-text"; input.className = "date"; input.style.width = "260px";
  input.placeholder = "text… (empty = no content filter)"; input.value = s.q.content?.value ?? ""; input.autocomplete = "off";
  // The operator is kept even with no text yet, so choosing it first survives the re-render (BUG-15).
  const apply = (chosen: ContentOp) => store.update((q) => setContent(q, { op: chosen, value: input.value.trim() }));
  // The same picker as every other operator (FEAT-51): the list shows on focus, typing filters it, ↓ ↩ picks.
  const picker = createPicker<ContentOp>({
    fid: "content-op", placeholder: "operator…", initial: labelOf(op), showAllOnFocus: true, keepOnPick: true, width: "130px",
    options: async () => OPS.map((o) => ({ id: o.id, label: o.label, value: o.id })),
    onPick: (o) => apply(o.value),
  });
  input.addEventListener("change", () => apply(op));
  line.append(picker, input);
  root.appendChild(line);
};
