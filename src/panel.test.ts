import { describe, expect, it } from "vitest";
import { dragStyle, fitStyle } from "./panel";

/**
 * The host restores the panel's saved layout (percent top/left, pixel size) whatever the window
 * size, and ignores inline position once a layout is saved; a layout saved on a big monitor can
 * leave the footer, Insert included, below a laptop window (FEAT-50). A stylesheet cap keeps the
 * panel inside the viewport.
 */
describe("fitStyle", () => {
  const view = { width: 1000, height: 700 };
  it("is null when the panel already fits", () => {
    expect(fitStyle("_p", { x: 100, y: 60, width: 780, height: 620 }, view)).toBeNull();
  });
  it("caps height and width so the panel ends inside the viewport with a margin", () => {
    const css = fitStyle("_p", { x: 56, y: 145, width: 770, height: 617 }, view)!;
    expect(css).toContain('.lsp-iframe-sandbox-container[data-pid="_p"]');
    expect(css).toContain("max-height: 539px");   // 700 - 145 - 16
    expect(css).not.toContain("max-width");
    expect(fitStyle("_p", { x: 900, y: 0, width: 300, height: 100 }, view)).toContain("max-width: 84px");
  });
  it("refuses an unsafe plugin id, like dragStyle", () => {
    expect(() => fitStyle("a]{", { x: 0, y: 0, width: 2000, height: 2000 }, view)).toThrow(/plugin id/);
  });
});

describe("dragStyle", () => {
  it("scopes the opaque-while-dragging rule to this plugin's container", () => {
    const css = dragStyle("_abc123");
    expect(css).toContain('.lsp-iframe-sandbox-container[data-pid="_abc123"].is-dragging');
    expect(css).toContain("opacity: 1");
    expect(css).not.toContain("undefined");
  });
});
