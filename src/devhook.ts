import type { Store } from "./ui/store";
import type { Query } from "./model";

/**
 * Dev-only test hook. The plugin frame is cross-origin to the host page, so automation cannot
 * click into it; this lets a script on the host page drive the panel through `postMessage`:
 *   { qb: "state", id }            → query, guard, read-back, result titles, rendered text
 *   { qb: "set", id, query }        → replace the builder state
 *   { qb: "click", id, fid }        → click a control by its data-fid
 *   { qb: "type", id, fid, text }   → focus a control, set its text, fire `input` (a picker opens)
 *   { qb: "key", id, fid, key }     → dispatch a keydown (Enter, ArrowDown, Tab, Escape…); on a picker,
 *                                      Enter/ArrowDown first wait (≤ 3 s) for its list to hold options
 *   { qb: "fids", id }              → every data-fid on screen
 * Every message is answered with { qbReply: id, ... }. Installed only when `import.meta.env.DEV`.
 */
export type DevMessage =
  | { qb: "state"; id: string }
  | { qb: "set"; id: string; query: Query }
  | { qb: "click"; id: string; fid: string }
  | { qb: "type"; id: string; fid: string; text: string }
  | { qb: "key"; id: string; fid: string; key: string }
  | { qb: "fids"; id: string };

const control = (fid: string) => document.querySelector<HTMLElement>(`[data-fid="${CSS.escape(fid)}"]`);

/** A picker's option list, once its (debounced, async) search has painted something. */
async function awaitOptions(input: HTMLElement, ms = 3000): Promise<boolean> {
  const list = input.parentElement?.querySelector("ul");
  if (!list) return true;
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    if (!list.hidden && list.querySelector('li[role="option"]')) return true;
    await new Promise((r) => setTimeout(r, 50));
  }
  return false;
}

export async function handleDevMessage(store: Store, m: DevMessage): Promise<Record<string, unknown>> {
  switch (m.qb) {
    case "state": {
      const s = store.state;
      return { query: s.q, guard: s.guard, readback: s.readback, results: s.results.map((r) => r.title), text: document.getElementById("root")?.textContent ?? "" };
    }
    case "set": store.update(() => m.query); return { ok: true };
    case "click": { const el = control(m.fid); if (!el) return { error: `no control ${m.fid}` }; el.click(); return { ok: true }; }
    case "type": {
      const el = control(m.fid);
      if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) return { error: `no text control ${m.fid}` };
      el.focus(); el.value = m.text; el.dispatchEvent(new Event("input", { bubbles: true }));
      return { ok: true };
    }
    case "key": {
      const el = control(m.fid); if (!el) return { error: `no control ${m.fid}` };
      el.focus();
      const ready = m.key === "Enter" || m.key === "ArrowDown" ? await awaitOptions(el) : true;
      el.dispatchEvent(new KeyboardEvent("keydown", { key: m.key, bubbles: true, cancelable: true }));
      return ready ? { ok: true } : { ok: true, warning: "the picker's list never opened; the key went to an empty list" };
    }
    case "fids": return { fids: [...document.querySelectorAll<HTMLElement>("[data-fid]")].map((e) => e.dataset.fid) };
  }
}

export function installDevHook(store: Store) {
  window.addEventListener("message", (e) => {
    const m = e.data as Partial<DevMessage> | null;
    if (!m || typeof m !== "object" || !("qb" in m) || !e.source) return;
    const source = e.source as Window;
    handleDevMessage(store, m as DevMessage)
      .catch((err) => ({ error: String(err) }))
      .then((reply) => source.postMessage({ qbReply: m.id, ...reply }, "*"));
  });
}
