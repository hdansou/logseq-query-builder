// No SDK import: the `logseq` global is provided by main.ts; importing the SDK here breaks unit tests.

/**
 * The plugin iframe inherits none of the host's CSS. The host does answer
 * `resolveThemeCssPropsVals` with computed values, so the tokens index.html uses as fallbacks are
 * copied onto :root at start and again whenever the theme or its mode changes.
 */
export const THEME_TOKENS = [
  "--ls-primary-background-color", "--ls-secondary-background-color", "--ls-tertiary-background-color",
  "--ls-primary-text-color", "--ls-secondary-text-color", "--ls-border-color", "--ls-link-text-color",
  "--ls-active-primary-color", "--ls-selection-background-color", "--ls-font-family",
  "--ls-border-radius-low", "--ls-border-radius-medium",
];

export function cssVars(vals: Record<string, string | undefined>): [string, string][] {
  return Object.entries(vals).filter((e): e is [string, string] => typeof e[1] === "string" && e[1].trim() !== "");
}

/** The SDK calls `watchTheme` needs; main.ts supplies the real ones, tests pass fakes. */
export interface ThemeDeps {
  /** Runs `fn` after `ms` milliseconds (setTimeout in production). */
  later(fn: () => void, ms: number): void;
  resolveThemeCssPropsVals(names: string[]): Promise<Record<string, string | undefined> | null | undefined>;
  onThemeModeChanged(cb: () => void): void;
  onThemeChanged(cb: () => void): void;
}

/**
 * The host fires theme-changed as it injects the new stylesheet, and the plugin cannot see that load
 * finish (cross-origin), so tokens are resolved again after these delays.
 */
export const RERESOLVE_DELAYS_MS = [250, 1000];

/** Copies the host's tokens onto :root now, and again on every theme or mode change. */
export function watchTheme(deps: ThemeDeps) {
  let latest = 0;
  const apply = async () => {
    const call = ++latest;
    const vals = await deps.resolveThemeCssPropsVals(THEME_TOKENS);
    if (!vals || call !== latest) return; // a newer resolve owns the result
    for (const [k, v] of cssVars(vals)) document.documentElement.style.setProperty(k, v);
  };
  const applyAgain = () => {
    void apply();
    for (const ms of RERESOLVE_DELAYS_MS) deps.later(() => void apply(), ms);
  };
  void apply();
  deps.onThemeModeChanged(applyAgain);
  deps.onThemeChanged(applyAgain);
}
