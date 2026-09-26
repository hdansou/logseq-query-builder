import { emit } from "../emit";
import { guard, type GuardResult } from "../guard";
import { addRef, addRow, emptyQuery, type Query } from "../model";
import type { ResultRow } from "../preview";
import { readback } from "../readback";

/**
 * UI state: the query, where an Insert would go, and the preview. One subscriber (render.ts)
 * re-renders on every change; the preview is debounced 300 ms and only runs when the guard passes.
 */
export type Mode = "shortcut" | "slash";
export interface Target { uuid: string; mode: Mode }

/** What the host hands a palette/shortcut or slash handler: `uuid` is the editing block, if any. */
export function targetFromEvent(mode: Mode, e: { uuid?: string | null }): Target | null {
  return e.uuid ? { uuid: e.uuid, mode } : null;
}

export interface State {
  q: Query;
  target: Target | null;
  guard: GuardResult;
  readback: string;
  results: ResultRow[];
  pages: number;
  loading: boolean;
  error: string | null;
  showDsl: boolean;
}

/**
 * The query's name: what the user typed, or, until they type, the plain-English read-back of the
 * query. An empty or unrunnable query suggests nothing.
 */
export const nameFor = (s: Pick<State, "q" | "guard" | "readback">): string =>
  s.q.name.trim() || (s.guard.ok ? s.readback : "");

export interface StoreDeps { preview: (q: Query) => Promise<ResultRow[]>; debounceMs?: number }

export class Store {
  state: State;
  private listeners = new Set<(s: State) => void>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private run = 0;

  constructor(private deps: StoreDeps) {
    this.state = this.derive(emptyQuery(), { target: null, results: [], pages: 1, loading: false, error: null, showDsl: false });
  }

  private derive(q: Query, rest: Omit<State, "q" | "guard" | "readback"> | State): State {
    const { target, results, pages, loading, error, showDsl } = rest;
    return { q, guard: guard(q), readback: readback(q), target, results, pages, loading, error, showDsl };
  }

  subscribe(fn: (s: State) => void) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  private notify() { for (const fn of this.listeners) fn(this.state); }

  /** Raw text as typed (trimmed only when used), so a trailing space survives the re-render. */
  setName(name: string) {
    this.state = this.derive({ ...this.state.q, name }, this.state);
    this.notify();
  }

  /** Change the query; resets paging and schedules a preview. */
  update(f: (q: Query) => Query) {
    const q = f(this.state.q);
    this.state = this.derive(q, { ...this.state, pages: 1 });
    this.notify();
    this.schedulePreview();
  }

  private schedulePreview() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.preview(), this.deps.debounceMs ?? 300);
  }

  private async preview() {
    const id = ++this.run;
    if (!this.state.guard.ok) {
      this.state = { ...this.state, results: [], loading: false, error: null };
      return this.notify();
    }
    this.state = { ...this.state, loading: true, error: null };
    this.notify();
    try {
      const results = await this.deps.preview(this.state.q);
      if (id !== this.run) return;
      this.state = { ...this.state, results, loading: false };
    } catch (e) {
      if (id !== this.run) return;
      this.state = { ...this.state, loading: false, error: e instanceof Error ? e.message : String(e) };
    }
    this.notify();
  }

  toggleDsl() { this.state = { ...this.state, showDsl: !this.state.showDsl }; this.notify(); }
  /** Adds a row and returns its id so the UI can focus it. */
  addRow(): string {
    this.update(addRow);
    return this.state.q.rows[this.state.q.rows.length - 1].id;
  }
  /** Adds a reference row and returns its id so the UI can focus it. */
  addRef(): string {
    this.update(addRef);
    return this.state.q.refs[this.state.q.refs.length - 1].id;
  }
  loadMore() { this.state = { ...this.state, pages: this.state.pages + 1 }; this.notify(); }

  /** A fresh query for a new session, or a restored one; the target is where Insert will write. */
  open(target: Target | null, q: Query = emptyQuery()) {
    this.state = this.derive(q, { ...this.state, target, results: [], pages: 1, error: null });
    this.notify();
    this.schedulePreview();
  }
  close() { this.notify(); }

  /** Convenience for the UI: the emitted query, or null when the guard refuses. */
  emitted() { return this.state.guard.ok ? emit(this.state.q) : null; }
}
