// Insert and round-trip flows (F1–F4). FLOW env = JSON:
//   { "open": "slash" | "palette-editing", "page": "Oct 9th, 2026", "build": {<qb.js STEPS without reset>}, "name": "...", "insert": true, "reopen": true }
// Reuses qb.js by setting STEPS and calling it through eval, so the build step is the same code the scenarios use.
async ({ page, frame }) => {
  const F = JSON.parse(process.env.FLOW || "{}");
  const log = [];
  const { sleep, shown, closePanel } = require(require("node:path").join(process.cwd(), "common.js"))({ page, frame });
  await page.setViewportSize({ width: 1400, height: 1000 });
  await closePanel();
  await page.mouse.click(700, 300); await page.keyboard.press("Escape");

  // ---- go to the page and start a fresh last block (through the API: robust to the page DOM) ----
  await page.evaluate(async (name) => { await logseq.api.push_state("page", { name }); }, F.page);
  await sleep(1200);
  const editing = await page.evaluate(async (name) => { const b = await logseq.api.append_block_in_page(name, ""); await logseq.api.edit_block(b.uuid); return b.uuid; }, F.page);
  await sleep(600);
  log.push(["new block", editing, await page.evaluate(() => !!document.activeElement?.closest?.(".editor-wrapper, .block-editor") || document.activeElement?.tagName)]);

  if (F.open === "slash") {
    await page.keyboard.type("/Query Builder", { delay: 30 });
    await sleep(900);
    const item = page.locator(".ui__ac-group .menu-link, .cp__palette-item, [data-testid=cmdk-item], .ui__ac-item").filter({ hasText: /^Query Builder$/ }).first();
    if (await item.count()) await item.click(); else await page.keyboard.press("Enter");
  } else {
    // "palette-editing": the block is being edited; the palette command should capture it (shortcut path)
    await page.keyboard.press("Meta+Shift+P"); await sleep(700);
    const pal = page.locator('input[placeholder*="ommand" i], .cp__cmdk input').first();   // not openFromPalette: the editing block must keep focus until the palette opens
    await pal.fill("Query Builder: open"); await sleep(500); await page.keyboard.press("Enter");
  }
  for (let i = 0; i < 40 && !(await shown()); i++) await sleep(100);
  await sleep(600);
  if (!(await shown())) return { error: "panel did not open", log };
  const footer = await frame().locator("#footer").innerText();
  log.push(["footer on open", footer.replace(/\n/g, " ").slice(0, 120)]);

  // ---- build through the scenario runner (same code path) -------------------------------------
  process.env.STEPS = JSON.stringify({ ...F.build, reset: false, viewport: false, name: F.name });
  const run = eval("(" + require("node:fs").readFileSync(require("node:path").join(process.cwd(), "qb.js"), "utf8") + ")");
  const built = await run({ page, frame });
  const out = { built: { readback: built.readback, count: built.count, results: built.results.map((r) => r.t), log: built.log }, log };
  if (!F.insert) return out;

  // ---- insert ---------------------------------------------------------------------------------
  const btn = frame().locator("[data-fid=insert]");
  out.insertLabel = await btn.innerText();
  out.insertDisabled = await btn.isDisabled();
  if (out.insertDisabled) { out.reason = await frame().locator("#footer span").first().innerText(); return out; }
  await btn.click();
  for (let i = 0; i < 50 && (await shown()); i++) await sleep(100);
  out.closedAfterInsert = !(await shown());
  await sleep(2500);
  // The query block in the host, by the uuid of the block the slash command ran in.
  const host = await page.evaluate(async (u) => {
    const b = await logseq.api.get_block(u);
    const el = document.querySelector(`[blockid="${u}"]`);
    const text = el?.innerText ?? "";
    const m = /Live query \((\d+)\)/.exec(text);
    return { found: !!b, uuid: u, title: b?.title, tags: (b?.tags ?? []).map((t) => t.title), hasQuery: !!b?.properties?.[":logseq.property/query"], hasState: typeof b?.properties?.[":plugin.property.logseq-query-builder/query-builder-state"] === "string", count: m ? Number(m[1]) : null, rows: text.split("\n").filter((l) => /\[\[|Workshop|Send|Met|Recruit|Synth/.test(l)).slice(0, 8) };
  }, editing);
  out.host = host;
  if (!F.reopen || !host.found) return out;

  // ---- reopen on that block: edit it, then the command palette (restore path) ------------------
  await page.evaluate(async (u) => { await logseq.api.edit_block(u); }, host.uuid);
  await sleep(600);
  await page.keyboard.press("Meta+Shift+P"); await sleep(700);
  const pal = page.locator('input[placeholder*="ommand" i], .cp__cmdk input').first();
  await pal.fill("Query Builder: open"); await sleep(500); await page.keyboard.press("Enter");
  for (let i = 0; i < 40 && !(await shown()); i++) await sleep(100);
  await sleep(1500);
  const f = frame();
  const chips = await f.locator(".chip").allInnerTexts();
  const rowText = await f.locator(".row").allInnerTexts();
  out.reopened = { chips: chips.map((c) => c.replace(/\n/g, " ")), rows: rowText.map((c) => c.replace(/\n/g, " ")), name: await f.locator("[data-fid=name]").inputValue(), count: await f.locator("[data-fid=count]").innerText(), insertLabel: await f.locator("[data-fid=insert]").innerText() };
  if (F.shot) await page.screenshot({ path: F.shot });
  await f.locator("body").press("Escape");
  return out;
}
