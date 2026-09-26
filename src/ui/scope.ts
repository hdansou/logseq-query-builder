import { setScope } from "../model";
import { createPicker } from "./picker";
import type { ZoneRenderer } from "./render";

/** Scope zone: anywhere · in the Library · on a page. One choice, shown as toggles; the page picker fills *on page*. */
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
  const sc = s.q.scope;
  const withPage = (page: { uuid: string; title: string }) => store.update((q) => setScope(q, { kind: "on-page", page }));
  const focusPage = () => document.querySelector<HTMLElement>("[data-fid=scope-page]")?.focus();
  line.appendChild(tog("scope-on", "on page…", kind === "on-page", focusPage));
  if (sc.kind === "on-page") {
    const chip = document.createElement("span"); chip.className = "chip";
    chip.appendChild(document.createTextNode(sc.page.title));
    const x = document.createElement("button"); x.className = "x"; x.textContent = "×"; x.dataset.fid = "scope-x"; x.title = "Back to anywhere";
    x.addEventListener("click", () => store.update((q) => setScope(q, { kind: "anywhere" })));
    chip.appendChild(x);
    line.appendChild(chip);
  }
  line.appendChild(createPicker<{ uuid: string; title: string }>({
    fid: "scope-page", placeholder: sc.kind === "on-page" ? "change page…" : "page…", width: "180px",
    search: async (t) => (await graph.pages(t)).map((p) => ({ id: p.uuid, label: p.title, value: p })),
    onPick: (o) => withPage(o.value),
  }));
  root.appendChild(line);
};
