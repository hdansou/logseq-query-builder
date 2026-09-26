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

export async function applyTheme() {
  const vals = await logseq.UI.resolveThemeCssPropsVals(THEME_TOKENS);
  if (!vals) return;
  for (const [k, v] of cssVars(vals)) document.documentElement.style.setProperty(k, v);
}

export function watchTheme() {
  void applyTheme();
  logseq.App.onThemeModeChanged(() => void applyTheme());
  logseq.App.onThemeChanged(() => void applyTheme());
}
