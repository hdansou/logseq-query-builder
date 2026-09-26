/**
 * Block titles in DB graphs store links as `[[<uuid>]]`; the host renders them as the referenced
 * node's title. Anything the builder shows as plain text (result rows, node search) resolves them
 * the same way, from the block's pulled `:block/refs`.
 */
export interface RefTitle { uuid: string; title: string }

const LINK = /\[\[([^[\]]+)\]\]/g;   // only a link whose text is a pulled ref's uuid is rewritten

export function resolveRefs(title: string, refs: RefTitle[] | undefined): string {
  if (!refs?.length) return title;
  const byUuid = new Map(refs.map((r) => [r.uuid, r.title]));
  return title.replace(LINK, (whole, uuid: string) => {
    const t = byUuid.get(uuid);
    return t === undefined ? whole : `[[${t}]]`;
  });
}
