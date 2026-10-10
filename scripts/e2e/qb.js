// Scenario runner for frame.mjs. Reads STEPS (JSON) from the environment and drives the real panel
// through its pickers: open from the command palette, build, wait for results, read everything back.
//   STEPS = {"reset":true, "tags":[{"t":"Task"}], "rows":[{"p":"Status","op":"does not contain","v":["Done"]}],
//            "refs":[{"dir":"links to","target":"Project Atlas","not":true,"conds":[...]}], "content":{"op":"starts with","v":"Decision:"},
//            "scope":{"page":"Oct 8th, 2026"}|"library", "inherit":false, "dsl":true, "keep":true}
async ({ page, frame }) => {
  const S = JSON.parse(process.env.STEPS || "{}");
  const log = [];
  const shown = () => page.evaluate(() => { const c = document.querySelector('iframe[src*="query-builder"]')?.closest(".lsp-iframe-sandbox-container"); return c ? getComputedStyle(c).display !== "none" : null; });
  const sleep = (ms) => page.waitForTimeout(ms);

  // ---- open / reset ---------------------------------------------------------------------------
  if (S.viewport !== false) await page.setViewportSize({ width: 1400, height: 1000 });   // the instance window is 980×700; the remembered panel layout overflows it (FEAT-50)
  if (S.reset !== false) {
    if (await shown()) { await frame().locator("body").press("Escape"); await sleep(300); }
    if (await shown()) log.push("panel did not close on Escape");
    const pal = page.locator('input[placeholder*="ommand" i], .cp__cmdk input').first();
    for (let attempt = 0; attempt < 3 && !(await pal.count()); attempt++) {
      await page.mouse.click(700, 300); await page.keyboard.press("Escape");   // focus back on the host
      await page.keyboard.press("Meta+Shift+P"); await sleep(700);
    }
    await pal.fill("Query Builder: open"); await sleep(500); await page.keyboard.press("Enter");
    for (let i = 0; i < 30 && !(await shown()); i++) await sleep(100);
    await sleep(400);
  }
  const f = () => frame();
  const ctl = (fid) => f().locator(`[data-fid="${fid}"]`);
  const fids = async () => f().locator("[data-fid]").evaluateAll((els) => els.map((e) => e.dataset.fid));

  // ---- picker helpers --------------------------------------------------------------------------
  // Type into a picker, wait for its list, then pick the option whose label matches (or the first).
  async function pick(fid, text, label = text, { free = false } = {}) {
    const input = ctl(fid);
    await input.click();
    if (text !== null) { await input.fill(""); await input.pressSequentially(text, { delay: 15 }); }
    const list = input.locator("xpath=following-sibling::ul");
    if (free) { await input.press("Enter"); await sleep(150); return "free"; }
    const deadline = Date.now() + 4000;
    while (Date.now() < deadline) {
      const n = await list.locator('li[role="option"]').count().catch(() => 0);
      if (n) break;
      await sleep(80);
    }
    const labels = await list.locator('li[role="option"] > span:first-child').allInnerTexts().catch(() => []);
    const i = label == null ? 0 : labels.findIndex((l) => l.trim().toLowerCase() === String(label).toLowerCase());
    if (i < 0) { log.push(`no option "${label}" for ${fid}; saw ${JSON.stringify(labels)}`); if (!labels.length) return null; }
    await list.locator('li[role="option"]').nth(Math.max(i, 0)).click();
    await sleep(120);
    return labels[Math.max(i, 0)];
  }
  const lastRowId = async (prefix) => { const all = await fids(); const m = all.filter((x) => x.startsWith(prefix)).pop(); return m ? m.slice(prefix.length) : null; };

  // ---- scope -----------------------------------------------------------------------------------
  if (S.scope === "library") await ctl("scope-library").click();
  else if (S.scope?.page) await pick("scope-page", S.scope.page);
  if (S.inherit === false) await ctl("inherit").click();

  // ---- tags ------------------------------------------------------------------------------------
  for (const t of S.tags ?? []) {
    const n = await f().locator("[data-fid^=tag-not-]").count();
    await pick("tag-picker", t.t === null ? "any tag" : t.t);
    if (t.not) await ctl(`tag-not-${n}`).click();
    if (t.join === "or" && n > 0) await ctl(`tag-join-${n}`).click();
  }

  // ---- filter rows (query rows and a target's condition rows share this) -----------------------
  async function fillRow(prefix, id, r) {
    await pick(`${prefix}-prop-${id}`, r.p);
    if (r.op) await pick(`${prefix}-op-${id}`, r.op);
    for (const v of r.v ?? []) {
      const all = await fids();
      if (all.includes(`${prefix}-vpick-${id}`)) await pick(`${prefix}-vpick-${id}`, String(v), r.pickLabel ?? String(v), { free: !!r.free });
      else if (all.includes(`${prefix}-val-${id}`) && !(await fids()).includes(`${prefix}-val-${id}-cal`)) { const inp = ctl(`${prefix}-val-${id}`); await inp.fill(String(v)); await inp.press("Tab"); }
      else { await pick(`${prefix}-val-${id}`, String(v), String(v), { free: true }); }   // date control: free text or shortcut
      await sleep(150);
    }
    if (r.v2 !== undefined) { const inp = ctl(`${prefix}-val2-${id}`); if ((await fids()).includes(`${prefix}-val2-${id}-cal`)) await pick(`${prefix}-val2-${id}`, String(r.v2), String(r.v2), { free: true }); else { await inp.fill(String(r.v2)); await inp.press("Tab"); } }
    if (r.not) await ctl(`${prefix}-not-${id}`).click();
    if (r.join === "or") await ctl(`${prefix}-join-${id}`).click();
  }
  for (const r of S.rows ?? []) {
    await ctl("add-row").click(); await sleep(100);
    await fillRow("row", await lastRowId("row-prop-"), r);
  }

  // ---- reference rows --------------------------------------------------------------------------
  for (const r of S.refs ?? []) {
    await ctl("add-ref").click(); await sleep(100);
    const id = await lastRowId("ref-dir-");
    if (r.dir) await pick(`ref-dir-${id}`, r.dir);
    await pick(`ref-target-${id}`, r.target, r.targetLabel ?? r.target);
    if (r.name) { await ctl(`ref-name-${id}`).fill(r.name); await sleep(200); }
    for (const c of r.conds ?? []) {
      await ctl(`ref-cond-${id}`).click(); await sleep(100);
      await fillRow(`trow-${id}`, await lastRowId(`trow-${id}-prop-`), c);
    }
    if (r.not) await ctl(`ref-not-${id}`).click();
    if (r.join === "or") await ctl(`ref-join-${id}`).click();
  }

  // ---- content ---------------------------------------------------------------------------------
  if (S.content) {
    await ctl("content-op").selectOption({ label: S.content.op });
    await ctl("content-text").fill(S.content.v); await sleep(100);
  }
  if (S.name) { await ctl("name").fill(S.name); }

  // ---- settle, read back -----------------------------------------------------------------------
  const countText = async () => (await ctl("count").innerText()).trim();
  for (let i = 0; i < 60; i++) { const c = await countText(); if (c && c !== "running…") break; await sleep(100); }
  await sleep(400);
  const results = await f().locator("#results .result").evaluateAll((els) => els.map((b) => ({ t: b.querySelector(".t")?.textContent, ctx: b.querySelector(".ctx")?.textContent ?? null, m: b.querySelector(".m")?.textContent ?? null })));
  const out = {
    readback: await ctl("name").inputValue(),
    count: await countText(),
    guard: (await f().locator("#guard").innerText()).trim() || null,
    results,
    more: (await ctl("more").count()) ? await ctl("more").innerText() : null,
    log,
  };
  if (S.dsl) { await ctl("showdsl").click(); await sleep(150); out.dsl = await f().locator("#dsl").innerText(); }
  if (S.shot) await page.screenshot({ path: S.shot });
  return out;
}
