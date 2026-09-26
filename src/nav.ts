import "@logseq/libs";

/** Zoom the app to a node. The builder stays open; the host only changes the route. */
export function navigateTo(uuid: string) {
  return logseq.App.pushState("page", { name: uuid });
}
