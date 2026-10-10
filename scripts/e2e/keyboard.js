// F1: keyboard only. A journal block is being edited; ⌘⇧F opens the builder on it; S2 is built with
// keys alone (type to filter, ↩ to pick, Tab to move, ⇧↩ for a new filter row); ⌘↩ inserts a sibling.
async ({ page, frame }) => {
  const log = [];
  const sleep = (ms) => page.waitForTimeout(ms);
  const shown = () => page.evaluate(() => { const c = document.querySelector('iframe[src*="query-builder"]')?.closest(".lsp-iframe-sandbox-container"); return c ? getComputedStyle(c).display !== "none" : null; });
  await page.setViewportSize({ width: 1400, height: 1000 });
  if (await shown()) { await frame().locator("body").press("Escape"); await sleep(300); }
  // a block to open from
  const uuid = await page.evaluate(async () => { await logseq.api.push_state("page", { name: "Oct 9th, 2026" }); await new Promise((r) => setTimeout(r, 800)); const b = await logseq.api.append_block_in_page("Oct 9th, 2026", "Keyboard run anchor"); await logseq.api.edit_block(b.uuid); return b.uuid; });
  await sleep(600);
  await page.keyboard.press("Meta+Shift+F");
  for (let i = 0; i < 40 && !(await shown()); i++) await sleep(100);
  await sleep(900);
  if (!(await shown())) return { error: "panel did not open on ⌘⇧F", log };
  const f = () => frame();
  const active = () => f().evaluate(() => document.activeElement?.dataset?.fid ?? document.activeElement?.tagName);
  log.push(["focus on open", await active()]);
  const kb = page.keyboard;
  const waitList = async () => { for (let i = 0; i < 40; i++) { const fid = await active(); const n = await f().locator(`[data-fid="${fid}"] + ul li[role=option]`).count().catch(() => 0); if (n) return n; await sleep(100); } return 0; };

  // tag: Task
  await kb.type("task", { delay: 30 }); await waitList(); await kb.press("Enter"); await sleep(300);
  log.push(["after tag", await active(), (await f().locator(".chip").allInnerTexts()).map((c) => c.replace(/\n/g, " "))]);
  // row 1: Priority contains any High
  await kb.press("Shift+Enter"); await sleep(200); log.push(["after ⇧↩", await active()]);
  await kb.type("prio", { delay: 30 }); await waitList(); await kb.press("Enter"); await sleep(300); log.push(["after property", await active()]);
  await kb.press("Enter"); await sleep(300); log.push(["after operator ↩", await active()]);   // first operator is already picked; Enter on the operator picker keeps it
  await kb.type("hi", { delay: 30 }); await waitList(); await kb.press("Enter"); await sleep(400); log.push(["after value", await active()]);
  // row 2: Status does not contain Done
  await kb.press("Shift+Enter"); await sleep(200);
  await kb.type("stat", { delay: 30 }); await waitList(); await kb.press("Enter"); await sleep(300);
  await kb.type("does not", { delay: 30 }); await waitList(); await kb.press("Enter"); await sleep(300); log.push(["after op2", await active()]);
  await kb.type("done", { delay: 30 }); await waitList(); await kb.press("Enter"); await sleep(400);
  // row 3: Deadline on or before +7d
  await kb.press("Shift+Enter"); await sleep(200);
  await kb.type("dead", { delay: 30 }); await waitList(); await kb.press("Enter"); await sleep(300);
  await kb.type("on or before", { delay: 30 }); await waitList(); await kb.press("Enter"); await sleep(300); log.push(["after op3", await active()]);
  await kb.type("+7d", { delay: 30 }); await sleep(200); await kb.press("Enter"); await sleep(800);
  const built = { readback: await f().locator("[data-fid=name]").inputValue(), count: await f().locator("[data-fid=count]").innerText(), rows: (await f().locator("#rows, .zone .row").allInnerTexts()).map((t) => t.replace(/\n/g, " ").slice(0, 90)), results: await f().locator("#results .result .t").allInnerTexts() };
  log.push(["built", built]);
  const insertLabel = await f().locator("[data-fid=insert]").innerText();
  await kb.press("Meta+Enter");
  for (let i = 0; i < 50 && (await shown()); i++) await sleep(100);
  await sleep(2500);
  const host = await page.evaluate(async (anchor) => {
    const a = await logseq.api.get_block(anchor);
    const page_ = await logseq.api.get_page_blocks_tree("Oct 9th, 2026");
    const idx = page_.findIndex((b) => b.uuid === anchor);
    const next = page_[idx + 1];
    const el = next && document.querySelector(`[blockid="${next.uuid}"]`);
    const m = el && /Live query \((\d+)\)/.exec(el.innerText);
    return { anchorTitle: a?.title, sibling: next && { title: next.title, tags: (next.tags ?? []).map((t) => t.title), hasState: typeof next.properties?.[":plugin.property.logseq-query-builder/query-builder-state"] === "string" }, count: m ? Number(m[1]) : null };
  }, uuid);
  await page.screenshot({ path: "f1.png" });
  return { log, insertLabel, closed: !(await shown()), host };
}
