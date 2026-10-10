import type { Graph } from "../graph";
import { formatContext } from "../context";
import { canInsert } from "../insert";
import { navigateTo } from "../nav";
import { page } from "../preview";
import { el } from "./dom";
import { nameFor, type State, type Store } from "./store";

/**
 * Renders the whole panel from state on every change. Zones are filled in by their own modules
 * (tags.ts, rows.ts, content.ts); this file owns the frame, read-back, guard bar, results, footer.
 */
export interface Ctx { store: Store; graph: Graph; insert: () => Promise<void> }
export type ZoneRenderer = (root: HTMLElement, s: State, ctx: Ctx) => void;

/**
 * Remember which control had focus (its text and caret) across a full re-render. A picker's typed
 * text is not state, so a re-render caused by results arriving would otherwise wipe what the user
 * is typing; restoring it and re-dispatching `input` lets the picker refresh its list. Only text
 * being composed (`data-typing`, set by the picker) is carried over: after a pick the new input
 * carries its own label, which must not be overwritten. Observed live: text typed into the target
 * picker vanished when the preview came back; then a picked property was blanked by the restore.
 */
const isText = (n: Element | null): n is HTMLInputElement | HTMLTextAreaElement => n instanceof HTMLInputElement || n instanceof HTMLTextAreaElement;

function captureFocus() {
  const a = document.activeElement as HTMLElement | null;
  const fid = a?.dataset.fid;
  const sel = isText(a) ? [a.selectionStart, a.selectionEnd] : null;
  const val = isText(a) && a.dataset.typing === "1" ? a.value : null;
  // A picker's list is re-created closed; reopen it only if it was open. After a pick the list is
  // closed, and focusing the fresh input must not pop the whole list back over the next zone
  // (BUG-9: the tag list covered the Filters row after every tag pick).
  const list = a?.parentElement?.querySelector("ul");
  const listOpen = !!list && !list.hidden;
  return () => {
    if (!fid) return;
    const n = document.querySelector<HTMLElement>(`[data-fid="${CSS.escape(fid)}"]`);
    if (!n) return;
    if (list && !listOpen) n.dataset.quiet = "1";
    n.focus();
    if (isText(n)) {
      if (val !== null && n.value !== val) { n.value = val; n.dispatchEvent(new Event("input")); }
      if (sel && sel[0] !== null) n.setSelectionRange(sel[0], sel[1]);
    }
  };
}

export function createRenderer(root: HTMLElement, ctx: Ctx, zones: { scope: ZoneRenderer; tags: ZoneRenderer; rows: ZoneRenderer; refs: ZoneRenderer; content: ZoneRenderer }) {
  const { store } = ctx;
  return (s: State) => {
    const restore = captureFocus();
    root.innerHTML = "";
    // Everything above the footer scrolls as one; the footer stays put however small the panel is.
    const body = el("div"); body.id = "body"; root.appendChild(body);

    const head = el("div", "zone flex head");
    // A magnifier marks the row as the query's name (inline SVG: the plugin frame has no icon font).
    const glass = el("span", "glass");
    glass.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>`;
    glass.title = "Query";
    head.appendChild(glass);
    // Prefilled with the read-back sentence until the user types their own name (or clears it).
    // A textarea that grows with its text, so a long sentence wraps instead of being cut off.
    const name = el("textarea", "name") as HTMLTextAreaElement;
    name.rows = 1;
    name.placeholder = "Query name";
    name.value = s.q.name.trim() ? s.q.name : nameFor(s);   // raw while typing (a trailing space must survive the re-render); the suggestion otherwise
    name.title = s.q.name.trim() ? "Your name for this query" : "Suggested from the filters; edit or replace it";
    name.dataset.fid = "name";
    const fit = () => { name.style.height = "0"; name.style.height = `${name.scrollHeight}px`; };
    // Commit on every keystroke: a blur-time change would re-render mid Tab and lose the focus move.
    name.addEventListener("input", () => { fit(); store.setName(name.value); });
    name.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.metaKey && !e.ctrlKey && !e.shiftKey) e.preventDefault(); });   // one line; ⌘↩ still inserts
    head.appendChild(name);
    // Result count lives up here, at the right end of the name row.
    const count = el("span", "count", s.error ? "error" : !s.guard.ok ? "" : s.loading ? "running…" : `${s.results.length} node${s.results.length === 1 ? "" : "s"}`);
    count.dataset.fid = "count";
    head.appendChild(count);
    body.appendChild(head);
    fit();

    const scope = el("div", "zone"); zones.scope(scope, s, ctx); body.appendChild(scope);
    const tags = el("div", "zone"); zones.tags(tags, s, ctx); body.appendChild(tags);
    const rows = el("div", "zone"); zones.rows(rows, s, ctx); body.appendChild(rows);
    const refs = el("div", "zone"); zones.refs(refs, s, ctx); body.appendChild(refs);
    const content = el("div", "zone"); zones.content(content, s, ctx); body.appendChild(content);

    const g = el("div", "guard"); g.id = "guard";
    if (!s.guard.ok) { g.classList.add("on"); g.textContent = s.guard.reason; }
    body.appendChild(g);

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
    body.appendChild(results);

    const dsl = el("pre", "", store.emitted()?.block ?? ""); dsl.id = "dsl"; if (s.showDsl) dsl.classList.add("on"); body.appendChild(dsl);

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
