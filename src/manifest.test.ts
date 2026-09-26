import { describe, expect, it } from "vitest";
import { manifest } from "./manifest";

describe("manifest", () => {
  it("names the plugin the way Logseq's loader expects", () => {
    expect(manifest.id).toBe("logseq-query-builder");
    expect(manifest.title).toBe("Query Builder");
    expect(manifest.main).toBe("dist/index.html");   // the production bundle; vite serves the source in dev
  });

  it("carries a semver version", () => {
    expect(manifest.version).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
