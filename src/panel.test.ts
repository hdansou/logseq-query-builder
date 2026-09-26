import { describe, expect, it } from "vitest";
import { dragStyle } from "./panel";

describe("dragStyle", () => {
  it("scopes the opaque-while-dragging rule to this plugin's container", () => {
    const css = dragStyle("_abc123");
    expect(css).toContain('.lsp-iframe-sandbox-container[data-pid="_abc123"].is-dragging');
    expect(css).toContain("opacity: 1");
    expect(css).not.toContain("undefined");
  });
});
