import pkg from "../package.json";

/** The plugin manifest fields Logseq reads from package.json. */
export const manifest = {
  id: pkg.logseq.id,
  title: pkg.logseq.title,
  main: pkg.logseq.main,
  version: pkg.version,
};
