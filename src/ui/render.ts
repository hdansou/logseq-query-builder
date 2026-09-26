import type { Graph } from "../graph";
import { formatContext } from "../context";
import { canInsert } from "../insert";
import { navigateTo } from "../nav";
import { page } from "../preview";
import { nameFor, type State, type Store } from "./store";

/**
 * Renders the whole panel from state on every change. Zones are filled in by their own modules
 * (tags.ts, rows.ts, content.ts); this file owns the frame, read-back, guard bar, results, footer.
 */
export interface Ctx { store: Store; graph: Graph; insert: () => Promise<void> }
export type ZoneRenderer = (root: HTMLElement, s: State, ctx: Ctx) => void;

const el = (tag: string, cls?: string, text?: string) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
};

/** Remember which control had focus (and its caret) across a full re-render. */
function captureFocus() {
  const a = document.activeElement as HTMLElement | null;
  const fid = a?.dataset.fid;
  const sel = a instanceof HTMLInputElement ? [a.selectionStart, a.selectionEnd] : null;
  return () => {
    if (!fid) return;
    const n = document.querySelector<HTMLElement>(`[data-fid="${CSS.escape(fid)}"]`);
    if (!n) return;
    n.focus();
    if (n instanceof HTMLInputElement && sel && sel[0] !== null) n.setSelectionRange(sel[0], sel[1]);
  };
}

export function createRenderer(root: HTMLElement, ctx: Ctx, zones: { scope: ZoneRenderer; tags: ZoneRenderer; rows: ZoneRenderer; content: ZoneRenderer }) {
  const { store } = ctx;
  return (s: State) => {
    const restore = captureFocus();
    root.innerHTML = "";

    const head = el("div", "zone flex");
    // Prefilled with the read-back sentence until the user types their own name (or clears it).
    const name = el("input", "name") as HTMLInputElement;
    name.placeholder = "Query name";
    name.value = nameFor(s);
    name.title = s.q.name.trim() ? "Your name for this query" : "Suggested from the filters; edit or replace it";
    name.dataset.fid = "name";
    // Commit on every keystroke: a blur-time change would re-render mid Tab and lose the focus move.
    name.addEventListener("input", () => store.setName(name.value));
    head.appendChild(name);
    // Result count lives up here, at the right end of the name row.
    const count = el("span", "count", s.error ? "error" : !s.guard.ok ? "" : s.loading ? "running…" : `${s.results.length} node${s.results.length === 1 ? "" : "s"}`);
    count.dataset.fid = "count";
    head.appendChild(count);
    root.appendChild(head);

    const scope = el("div", "zone"); zones.scope(scope, s, ctx); root.appendChild(scope);
    const tags = el("div", "zone"); zones.tags(tags, s, ctx); root.appendChild(tags);
    const rows = el("div", "zone"); zones.rows(rows, s, ctx); root.appendChild(rows);
    const content = el("div", "zone"); zones.content(content, s, ctx); root.appendChild(content);

    const g = el("div", "guard"); g.id = "guard";
    if (!s.guard.ok) { g.classList.add("on"); g.textContent = s.guard.reason; }
    root.appendChild(g);

    const results = el("div"); results.id = "results";
    if (s.error) results.appendChild(el("div", "empty-results", `Query failed: ${s.error}`));
    else if (!s.guard.ok) results.appendChild(el("div", "empty-results", "Add a tag or a filter to see results."));
    else if (s.loading && !s.results.length) results.appendChild(el("div", "empty-results", "Running…"));
    else {
      const p = page(s.results, s.pages);
      if (!p.total) results.appendChild(el("div", "empty-results", "No matching nodes."));
      p.shown.forEach((r, i) => {
        const b = el("button", "result") as HTMLButtonElement;
        b.dataset.fid = `result-${i}`;
        b.appendChild(el("span", "t", r.title || "(untitled)"));
        const ctxText = formatContext(s.q.rows.flatMap((row) => (row.property ? [row.property] : [])), r.raw);
        if (ctxText) b.appendChild(el("span", "ctx", ctxText));
        if (r.page) b.appendChild(el("span", "m", r.page.title));
        b.addEventListener("click", () => void navigateTo(r.uuid));
        results.appendChild(b);
      });
      if (p.remaining) {
        const more = el("button", "btn", `Show ${Math.min(10, p.remaining)} more (${p.remaining} left)`);
        more.style.margin = "6px 14px 10px";
        more.dataset.fid = "more";
        more.addEventListener("click", () => store.loadMore());
        results.appendChild(more);
      }
    }
    root.appendChild(results);

    const dsl = el("pre", "", store.emitted()?.block ?? ""); dsl.id = "dsl"; if (s.showDsl) dsl.classList.add("on"); root.appendChild(dsl);

    const foot = el("div"); foot.id = "footer";
    const can = canInsert({ guard: s.guard, name: nameFor(s), target: s.target });
    const insertBtn = el("button", "btn primary", s.target?.mode === "slash" ? "Write into this block" : "Insert as query block") as HTMLButtonElement;
    insertBtn.dataset.fid = "insert";
    insertBtn.disabled = !can.ok;
    insertBtn.title = can.ok ? "⌘↩" : can.reason;
    insertBtn.addEventListener("click", () => void ctx.insert());
    foot.appendChild(insertBtn);
    foot.appendChild(el("span", "", can.ok ? "" : can.reason));
    const showDsl = el("button", "tog" + (s.showDsl ? " on" : ""), "datalog");
    showDsl.dataset.fid = "showdsl";
    showDsl.addEventListener("click", () => store.toggleDsl());
    foot.appendChild(showDsl);
    const keys = el("span", "keys");
    for (const k of ["↩ pick", "Tab next", "⇧↩ add filter", "⌘↩ insert", "Esc close"]) keys.appendChild(el("span", "", k));
    foot.appendChild(keys);
    root.appendChild(foot);

    restore();
  };
}
