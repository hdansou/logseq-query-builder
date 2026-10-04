// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { RERESOLVE_DELAYS_MS, THEME_TOKENS, cssVars, watchTheme, type ThemeDeps } from "./theme";

describe("cssVars", () => {
  it("keeps only tokens the host resolved to a non-empty value", () => {
    expect(cssVars({ "--ls-primary-background-color": "#002b36", "--lx-gray-03": "", "--ls-font-family": undefined })).toEqual([
      ["--ls-primary-background-color", "#002b36"],
    ]);
  });
  it("asks for the tokens index.html falls back on", () => {
    for (const t of ["--ls-primary-background-color", "--ls-primary-text-color", "--ls-border-color", "--ls-link-text-color", "--ls-font-family", "--ls-border-radius-low"])
      expect(THEME_TOKENS).toContain(t);
  });
});

const BG = "--ls-primary-background-color";

/** A fake host: the token value changes only when `loadStylesheet` runs, after the theme-changed event fired. */
function fakeHost(initial: string) {
  let value = initial;
  let onMode: () => void = () => {};
  let onTheme: () => void = () => {};
  const timers: Array<{ fn: () => void; ms: number }> = [];
  const deps = {
    later: vi.fn((fn: () => void, ms: number) => void timers.push({ fn, ms })),
    resolveThemeCssPropsVals: vi.fn(async (): Promise<Record<string, string>> => ({ [BG]: value })),
    onThemeModeChanged: vi.fn((cb: () => void) => void (onMode = cb)),
    onThemeChanged: vi.fn((cb: () => void) => void (onTheme = cb)),
  } satisfies ThemeDeps;
  return {
    deps, timers,
    fireTheme: () => onTheme(), fireMode: () => onMode(),
    loadStylesheet: (v: string) => void (value = v),
    runTimers: () => timers.splice(0).forEach((t) => t.fn()),
  };
}
const flush = () => new Promise((r) => setTimeout(r, 0));
const bg = () => document.documentElement.style.getPropertyValue(BG);

describe("watchTheme", () => {
  it("re-resolves after the new stylesheet has loaded (theme-changed fires before the load)", async () => {
    const h = fakeHost("#ffffff");
    watchTheme(h.deps);
    await flush();
    expect(bg()).toBe("#ffffff");
    h.fireTheme(); // host injects the <link>; computed styles still belong to the old theme
    await flush();
    expect(bg()).toBe("#ffffff");
    expect(h.timers.map((t) => t.ms)).toEqual(RERESOLVE_DELAYS_MS);
    h.loadStylesheet("#002b36");
    h.runTimers();
    await flush();
    expect(bg()).toBe("#002b36");
  });

  it("does the same on a mode change", async () => {
    const h = fakeHost("#ffffff");
    watchTheme(h.deps);
    await flush();
    h.fireMode();
    expect(h.timers.map((t) => t.ms)).toEqual(RERESOLVE_DELAYS_MS);
  });

  it("last call wins: a slow earlier resolve does not overwrite a newer one", async () => {
    const h = fakeHost("#ffffff");
    watchTheme(h.deps);
    await flush();
    let settleOld: (v: Record<string, string>) => void = () => {};
    h.deps.resolveThemeCssPropsVals.mockReturnValueOnce(new Promise<Record<string, string>>((r) => void (settleOld = r)));
    h.fireTheme();
    h.deps.resolveThemeCssPropsVals.mockResolvedValueOnce({ [BG]: "#111111" });
    h.fireTheme();
    await flush();
    settleOld({ [BG]: "#999999" });
    await flush();
    expect(bg()).toBe("#111111");
  });
});
