import { describe, expect, it } from "vitest";
import { THEME_TOKENS, cssVars } from "./theme";

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
