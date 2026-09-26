import { setContent, type ContentOp } from "../model";
import type { ZoneRenderer } from "./render";

/** Content search: one optional row over the node's own text. */
const OPS: [ContentOp, string][] = [["contains", "contains"], ["not-contains", "does not contain"], ["starts-with", "starts with"], ["matches", "matches regex"]];

export const renderContent: ZoneRenderer = (root, s, { store }) => {
  root.innerHTML = "";
  const label = document.createElement("div"); label.className = "zone-label"; label.textContent = "Content";
  const hint = document.createElement("span"); hint.className = "hint"; hint.textContent = "the node's own text, case-insensitive";
  label.appendChild(hint); root.appendChild(label);

  const line = document.createElement("div"); line.className = "row";
  const sel = document.createElement("select"); sel.dataset.fid = "content-op";
  for (const [v, text] of OPS) { const o = document.createElement("option"); o.value = v; o.textContent = text; o.selected = (s.q.content?.op ?? "contains") === v; sel.appendChild(o); }
  const input = document.createElement("input"); input.dataset.fid = "content-text"; input.className = "date"; input.style.width = "260px";
  input.placeholder = "text… (empty = no content filter)"; input.value = s.q.content?.value ?? ""; input.autocomplete = "off";
  const apply = () => {
    const value = input.value.trim();
    store.update((q) => setContent(q, value ? { op: sel.value as ContentOp, value } : null));
  };
  sel.addEventListener("change", apply);
  input.addEventListener("change", apply);
  line.append(sel, input);
  root.appendChild(line);
};
