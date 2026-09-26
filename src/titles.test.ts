import { describe, expect, it } from "vitest";
import { resolveRefs } from "./titles";

describe("resolveRefs", () => {
  const refs = [{ uuid: "6ab8332f-ece6-4b85-a59e-b9fa705a4eca", title: "Project Iris" }, { uuid: "0000-page", title: "QB Refs Probe" }];
  it("replaces [[uuid]] links with [[title]] using the block's refs", () => {
    expect(resolveRefs("Mentions [[6ab8332f-ece6-4b85-a59e-b9fa705a4eca]] inline and [[0000-page]]", refs)).toBe("Mentions [[Project Iris]] inline and [[QB Refs Probe]]");
  });
  it("leaves links it cannot resolve, plain text and missing refs alone", () => {
    expect(resolveRefs("See [[unknown-uuid]] here", refs)).toBe("See [[unknown-uuid]] here");
    expect(resolveRefs("No links", undefined)).toBe("No links");
    expect(resolveRefs("[[0000-page]]", [])).toBe("[[0000-page]]");
  });
});
