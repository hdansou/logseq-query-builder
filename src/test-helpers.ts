import { addRef, setRef, type Query, type RefRow } from "./model";

/** Test-only helpers for the pure suites (no DOM, no SDK import). */

/** Append a reference row and patch it in one step. */
export const withRef = (q: Query, patch: Partial<Omit<RefRow, "id">>): Query => {
  const q2 = addRef(q);
  return setRef(q2, q2.refs[q2.refs.length - 1].id, patch);
};
