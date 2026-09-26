import { setScope } from "../model";
import { createPicker } from "./picker";
import type { ZoneRenderer } from "./render";

/** Scope zone: anywhere · referenced in a page · in the Library. One choice, shown as toggles. */
export const renderScope: ZoneRenderer = (root, s, { store, graph }) => {
  root.innerHTML = "";
  const label = document.createElement("div"); label.className = "zone-label"; label.textContent = "Scope";
  const hint = document.createElement("span"); hint.className = "hint"; hint.textContent = "where to look";
  label.appendChild(hint); root.appendChild(label);

  const line = document.createElement("div"); line.className = "flex";
  const kind = s.q.scope.kind;
  const tog = (fid: string, text: string, on: boolean, onClick: () => void) => {
    const b = document.createElement("button"); b.className = "btn" + (on ? " primary" : ""); b.textContent = text; b.dataset.fid = fid;
    b.setAttribute("aria-pressed", String(on));
    b.addEventListener("click", onClick);
    return b;
  };
  line.appendChild(tog("scope-any", "anywhere", kind === "anywhere", () => store.update((q) => setScope(q, { kind: "anywhere" }))));
  line.appendChild(tog("scope-library", "in the Library", kind === "library", () => store.update((q) => setScope(q, { kind: "library" }))));
  line.appendChild(tog("scope-ref", "referenced in page…", kind === "referenced-in", () => {
    // Picking the page is the choice; until then keep the current scope and focus the picker.
    document.querySelector<HTMLElement>("[data-fid=scope-page]")?.focus();
  }));
  if (kind === "referenced-in") {
    const chip = document.createElement("span"); chip.className = "chip";
    chip.appendChild(document.createTextNode(s.q.scope.page.title));
    const x = document.createElement("button"); x.className = "x"; x.textContent = "×"; x.dataset.fid = "scope-x"; x.title = "Back to anywhere";
    x.addEventListener("click", () => store.update((q) => setScope(q, { kind: "anywhere" })));
    chip.appendChild(x);
    line.appendChild(chip);
  }
  line.appendChild(createPicker<{ uuid: string; title: string }>({
    fid: "scope-page", placeholder: kind === "referenced-in" ? "change page…" : "page…", width: "180px",
    search: async (t) => (await graph.pages(t)).map((p) => ({ id: p.uuid, label: p.title, value: p })),
    onPick: (o) => store.update((q) => setScope(q, { kind: "referenced-in", page: o.value })),
  }));
  root.appendChild(line);
};
