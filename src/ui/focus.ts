/**
 * Where the cursor goes when the panel opens or the frame regains focus: the tag picker, else the
 * first control. `force` (used a few times after opening, because the host hands focus to the
 * frame asynchronously) may pull focus away from the host page, but never from a control the user
 * has already reached inside the panel (BUG-11). Returns null when focus should stay where it is.
 */
export function focusTarget(root: HTMLElement, active: Element | null, force: boolean): HTMLElement | null {
  const empty = !active || active === document.body;
  if (!empty && (!force || root.contains(active))) return null;
  return root.querySelector<HTMLElement>("[data-fid=tag-picker]") ?? root.querySelector<HTMLElement>("[data-fid]");
}
