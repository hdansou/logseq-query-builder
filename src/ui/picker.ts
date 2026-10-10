/**
 * The one autocomplete control: an input whose typed text filters a list; arrows move, Enter
 * picks, Tab advances, Escape closes the list without changing anything. Used for tags,
 * properties and values. Pure parts (filterOptions, pickerKey) are unit-tested; the DOM is thin.
 */
export interface Option<T> { id: string; label: string; hint?: string; value: T }

export function filterOptions<T>(options: Option<T>[], text: string): Option<T>[] {
  const t = text.trim().toLowerCase();
  if (!t) return options;
  const starts = options.filter((o) => o.label.toLowerCase().startsWith(t));
  const inside = options.filter((o) => !o.label.toLowerCase().startsWith(t) && o.label.toLowerCase().includes(t));
  return [...starts, ...inside];
}

export interface PickerState { open: boolean; index: number }
export type PickerAction = "pick" | "free" | "close" | "advance";

export function pickerKey(s: PickerState, key: string, count: number): { state: PickerState; action?: PickerAction } {
  switch (key) {
    case "ArrowDown": return { state: { open: true, index: s.open ? (s.index + 1) % Math.max(count, 1) : 0 } };
    case "ArrowUp": return { state: { open: true, index: s.open ? (s.index - 1 + Math.max(count, 1)) % Math.max(count, 1) : 0 } };
    case "Enter": return s.open && count > 0 ? { state: { ...s, open: false }, action: "pick" } : { state: { ...s, open: false }, action: "free" };
    case "Escape": return s.open ? { state: { ...s, open: false }, action: "close" } : { state: s };
    case "Tab": return { state: { ...s, open: false }, action: "advance" };
    default: return { state: s };
  }
}

export interface PickerOpts<T> {
  fid: string;
  placeholder: string;
  /** Static options, fetched when the list first opens. */
  options?: () => Promise<Option<T>[]>;
  /** Async search per keystroke (debounced); replaces `options` filtering. */
  search?: (text: string) => Promise<Option<T>[]>;
  onPick: (o: Option<T>) => void;
  /** Enter with no highlighted option; when absent, free text is ignored. Return false to refuse it (the text stays). */
  onFree?: (text: string) => void | boolean;
  initial?: string;
  /** Single-value controls: show the picked label in the input instead of clearing it. */
  keepOnPick?: boolean;
  /** Show every option when focused, ignoring the current text until the user types. */
  showAllOnFocus?: boolean;
  /** False: focus alone keeps the list closed; typing or ArrowDown opens it (the tag picker sits above two zones its list would cover). */
  openOnFocus?: boolean;
  autoFocus?: boolean;
  width?: string;
}

export function createPicker<T>(o: PickerOpts<T>): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "picker";
  const input = document.createElement("input");
  input.dataset.fid = o.fid;
  input.placeholder = o.placeholder;
  input.autocomplete = "off";
  input.spellcheck = false;
  input.value = o.initial ?? "";
  if (o.width) input.style.minWidth = o.width;
  const list = document.createElement("ul");
  list.setAttribute("role", "listbox");
  list.hidden = true;
  wrap.append(input, list);

  let all: Option<T>[] = [];
  let shown: Option<T>[] = [];
  let st: PickerState = { open: false, index: 0 };
  let searchTimer: ReturnType<typeof setTimeout> | null = null;
  let typed = false;

  const paint = () => {
    list.hidden = !st.open;
    if (!st.open) return;
    list.innerHTML = "";
    if (!shown.length) { const e = document.createElement("li"); e.className = "empty"; e.textContent = o.onFree ? "No match — Enter keeps the text" : "No match"; list.appendChild(e); return; }
    shown.forEach((opt, i) => {
      const li = document.createElement("li");
      li.className = i === st.index ? "sel" : "";
      li.setAttribute("role", "option");
      const l = document.createElement("span"); l.textContent = opt.label; li.appendChild(l);
      if (opt.hint) { const h = document.createElement("span"); h.className = "hint"; h.textContent = opt.hint; li.appendChild(h); }
      li.addEventListener("mousedown", (e) => { e.preventDefault(); pick(opt); });
      list.appendChild(li);
    });
    list.children[st.index]?.scrollIntoView({ block: "nearest" });
  };

  const refresh = async () => {
    if (o.search) {
      if (searchTimer) clearTimeout(searchTimer);
      searchTimer = setTimeout(async () => { shown = await o.search!(input.value); st = { ...st, index: 0 }; paint(); }, 200);
      return;
    }
    if (!all.length && o.options) all = await o.options();
    shown = filterOptions(all, o.showAllOnFocus && !typed ? "" : input.value);
    st = { ...st, index: Math.min(st.index, Math.max(shown.length - 1, 0)) };
    paint();
  };

  const pick = (opt: Option<T>) => { st = { open: false, index: 0 }; input.value = o.keepOnPick ? opt.label : ""; delete input.dataset.typing; paint(); o.onPick(opt); };

  // `data-quiet` (set by render.ts when it restores focus after a re-render) means: take focus, keep the list as it was (closed).
  input.addEventListener("focus", () => {
    typed = false;
    if (input.dataset.quiet === "1") { delete input.dataset.quiet; return; }
    if (o.openOnFocus === false) return;
    st = { ...st, open: true }; if (o.showAllOnFocus) input.select(); void refresh();
  });
  // `data-typing` marks text the user is composing, so a full re-render (render.ts) can carry it over.
  input.addEventListener("input", () => { typed = true; input.dataset.typing = "1"; st = { ...st, open: true, index: 0 }; void refresh(); });
  input.addEventListener("blur", () => { st = { ...st, open: false }; delete input.dataset.typing; paint(); });
  input.addEventListener("keydown", (e) => {
    const r = pickerKey(st, e.key, shown.length);
    st = r.state;
    switch (r.action) {
      case "pick": e.preventDefault(); pick(shown[r.state.index]); return;
      case "free":
        if (o.onFree && input.value.trim()) {
          e.preventDefault();
          const t = input.value.trim();
          if (o.onFree(t) === false) { input.classList.add("invalid"); setTimeout(() => input.classList.remove("invalid"), 800); paint(); return; }
          if (!o.keepOnPick) input.value = "";
          paint();
        } else paint();
        return;
      case "close": e.preventDefault(); e.stopPropagation(); paint(); return;   // Esc closes the list, not the panel
      case "advance": paint(); return;
      default: if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); void refresh(); }
    }
  });
  if (o.autoFocus) queueMicrotask(() => input.focus());
  return wrap;
}
