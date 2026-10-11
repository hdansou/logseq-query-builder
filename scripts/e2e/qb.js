// Scenario runner for frame.mjs (test-logseq-desktop). Reads STEPS (JSON) from the environment and
// drives the real panel: open from the command palette, build, wait for results, read everything back.
//   STEPS = {"mode":"mouse"|"keys", "tags":[{"t":"Task"}], "rows":[{"p":"Status","op":"does not contain","v":["Done"]}],
//            "refs":[{"dir":"links to","target":"Project Atlas","not":true,"conds":[...]}], "content":{"op":"starts with","v":"Decision:"},
//            "scope":{"page":"Oct 8th, 2026"}|"library", "inherit":false, "dsl":true, "name":"…", "shot":"x.png"}
// mode "mouse": click controls, click options. mode "keys": reach controls with Tab/⇧Tab, type to filter,
// ↓ to the option, ↩ to pick, ⇧↩ for a new filter row, ↩ on buttons. The
// two fail differently (Enter moves focus forward, a click does not), so a zone is checked in both.
async ({ page, frame }) => {
  const S = JSON.parse(process.env.STEPS || "{}");
  const keys = S.mode === "keys";
  const log = [];
  const { sleep, shown, closePanel, openFromPalette } = require(require("node:path").join(process.cwd(), "common.js"))({ page, frame });

  // ---- open / reset ---------------------------------------------------------------------------
  if (S.viewport !== false) await page.setViewportSize({ width: 1400, height: 1000 });   // the instance window is 980×700
  if (S.reset !== false) {
    await closePanel(log);
    await openFromPalette();
  }
  const f = () => frame();
  const ctl = (fid) => f().locator(`[data-fid="${fid}"]`);
  const fids = async () => f().locator("[data-fid]").evaluateAll((els) => els.map((e) => e.dataset.fid));
  const active = () => f().evaluate(() => document.activeElement?.dataset?.fid ?? null);
  const listOf = (fid) => ctl(fid).locator("xpath=following-sibling::ul");
  const waitList = async (fid) => { const deadline = Date.now() + 4000; while (Date.now() < deadline) { if (await listOf(fid).locator('li[role="option"]').count().catch(() => 0)) return true; await sleep(80); } return false; };
  const labelsOf = (fid) => listOf(fid).locator('li[role="option"] > span:first-child').allInnerTexts().catch(() => []);
  const match = (labels, label) => (label == null ? 0 : labels.findIndex((l) => l.trim().toLowerCase() === String(label).toLowerCase()));

  // ---- primitives: mouse ---------------------------------------------------------------------
  const mouse = {
    async focus(fid) { await ctl(fid).click(); },
    async press(fid) { await ctl(fid).click(); },
    async pick(fid, text, label, { free = false } = {}) {
      const input = ctl(fid); await input.click();
      if (text !== null) { await input.fill(""); await input.pressSequentially(text, { delay: 15 }); }
      if (free) { await input.press("Enter"); await sleep(150); return "free"; }
      await waitList(fid);
      const labels = await labelsOf(fid); const i = match(labels, label);
      if (i < 0) { log.push(`no option "${label}" for ${fid}; saw ${JSON.stringify(labels)}`); if (!labels.length) return null; }
      await listOf(fid).locator('li[role="option"]').nth(Math.max(i, 0)).click(); await sleep(120);
      return labels[Math.max(i, 0)];
    },
    async text(fid, value) { const el = ctl(fid); await el.fill(String(value)); await el.press("Tab"); },
    async addRow() { await ctl("add-row").click(); },
  };

  // ---- primitives: keyboard ------------------------------------------------------------------
  const kb = page.keyboard;
  // Tab toward the control along DOM order (a NOT toggle sits before its picker, so that can mean
  // ⇧Tab); stop at the frame's edge, since focus that leaves the iframe does not come back by Tab.
  const reach = async (fid) => {
    const cur = await active();
    if (cur === fid) return true;
    const order = await fids();
    const key = cur && order.indexOf(fid) < order.indexOf(cur) ? "Shift+Tab" : "Tab";
    for (let i = 0; i < 40; i++) {
      await kb.press(key);
      const now = await active();
      if (now === fid) return true;
      if (now === null) break;
    }
    log.push(`could not reach ${fid} by ${key} (focus at ${await active()})`);
    return false;
  };
  const keysP = {
    async focus(fid) { await reach(fid); },
    async press(fid) { if (await reach(fid)) { await kb.press("Enter"); } },
    async pick(fid, text, label, { free = false } = {}) {
      if (!(await reach(fid))) return null;
      if (text !== null) { await kb.press("Meta+A"); await kb.press("Backspace"); await kb.type(text, { delay: 15 }); }
      if (free) { await kb.press("Enter"); await sleep(150); return "free"; }
      await waitList(fid);
      const labels = await labelsOf(fid); const i = match(labels, label);
      if (i < 0) { log.push(`no option "${label}" for ${fid}; saw ${JSON.stringify(labels)}`); if (!labels.length) return null; }
      for (let k = 0; k < Math.max(i, 0); k++) await kb.press("ArrowDown");
      await kb.press("Enter"); await sleep(120);
      return labels[Math.max(i, 0)];
    },
    async text(fid, value) { if (await reach(fid)) { await kb.type(String(value), { delay: 15 }); await kb.press("Tab"); } },
    async addRow() { await kb.press("Shift+Enter"); },
  };
  const M = keys ? keysP : mouse;
  const lastId = async (prefix) => { const all = await fids(); const m = all.filter((x) => x.startsWith(prefix)).pop(); return m ? m.slice(prefix.length) : null; };

  // ---- scope / inherit -------------------------------------------------------------------------
  if (S.scope === "library") await M.press("scope-library");
  else if (S.scope?.page) await M.pick("scope-page", S.scope.page, S.scope.page);
  if (S.inherit === false) { if (keys) { await reach("inherit"); await kb.press("Space"); } else await ctl("inherit").click(); }

  // ---- tags ------------------------------------------------------------------------------------
  for (const t of S.tags ?? []) {
    const n = await f().locator("[data-fid^=tag-not-]").count();
    await M.pick("tag-picker", t.t === null ? "any tag" : t.t, t.t === null ? "any tag" : t.t);
    if (t.not) await M.press(`tag-not-${n}`);
    if (t.join === "or" && n > 0) await M.press(`tag-join-${n}`);
  }

  // ---- filter rows (the query's rows and a target's condition rows share this) ----------------
  async function fillRow(prefix, id, r) {
    await M.pick(`${prefix}-prop-${id}`, r.p, r.p);
    if (r.op) await M.pick(`${prefix}-op-${id}`, r.op, r.op);
    for (const v of r.v ?? []) {
      const all = await fids();
      if (all.includes(`${prefix}-vpick-${id}`)) await M.pick(`${prefix}-vpick-${id}`, String(v), r.pickLabel ?? String(v), { free: !!r.free });
      else if (all.includes(`${prefix}-val-${id}`) && !all.includes(`${prefix}-val-${id}-cal`)) await M.text(`${prefix}-val-${id}`, v);
      else await M.pick(`${prefix}-val-${id}`, String(v), String(v), { free: true });   // date control: free text or shortcut
      await sleep(150);
    }
    if (r.v2 !== undefined) { if ((await fids()).includes(`${prefix}-val2-${id}-cal`)) await M.pick(`${prefix}-val2-${id}`, String(r.v2), String(r.v2), { free: true }); else await M.text(`${prefix}-val2-${id}`, r.v2); }
    if (r.not) await M.press(`${prefix}-not-${id}`);
    if (r.join === "or") await M.press(`${prefix}-join-${id}`);
  }
  for (const r of S.rows ?? []) {
    await M.addRow(); await sleep(120);
    await fillRow("row", await lastId("row-prop-"), r);
  }

  // ---- reference rows --------------------------------------------------------------------------
  for (const r of S.refs ?? []) {
    await M.press("add-ref"); await sleep(120);
    const id = await lastId("ref-dir-");
    if (r.dir) await M.pick(`ref-dir-${id}`, r.dir, r.dir);
    await M.pick(`ref-target-${id}`, r.target, r.targetLabel ?? r.target);
    if (r.name) { if (keys) { await reach(`ref-name-${id}`); await kb.type(r.name, { delay: 15 }); } else await ctl(`ref-name-${id}`).fill(r.name); await sleep(200); }
    for (const c of r.conds ?? []) {
      await M.press(`ref-cond-${id}`); await sleep(120);
      await fillRow(`trow-${id}`, await lastId(`trow-${id}-prop-`), c);
    }
    if (r.not) await M.press(`ref-not-${id}`);
    if (r.join === "or") await M.press(`ref-join-${id}`);
  }

  // ---- content ---------------------------------------------------------------------------------
  if (S.content) {
    await M.pick("content-op", S.content.op, S.content.op);
    if (keys) { await reach("content-text"); await kb.type(S.content.v, { delay: 15 }); await kb.press("Tab"); } else { await ctl("content-text").fill(S.content.v); await ctl("content-text").press("Tab"); }
    await sleep(100);
  }
  if (S.name) { if (keys) { await reach("name"); await kb.press("Meta+A"); await kb.type(S.name, { delay: 10 }); } else await ctl("name").fill(S.name); }

  // ---- settle, read back -----------------------------------------------------------------------
  const countText = async () => (await ctl("count").innerText()).trim();
  for (let i = 0; i < 60; i++) { const c = await countText(); if (c && c !== "running…") break; await sleep(100); }
  await sleep(400);
  const results = await f().locator("#results .result").evaluateAll((els) => els.map((b) => ({ t: b.querySelector(".t")?.textContent, ctx: b.querySelector(".ctx")?.textContent ?? null, m: b.querySelector(".m")?.textContent ?? null })));
  const out = {
    mode: keys ? "keys" : "mouse",
    readback: await ctl("name").inputValue(),
    count: await countText(),
    guard: (await f().locator("#guard").innerText()).trim() || null,
    results,
    more: (await ctl("more").count()) ? await ctl("more").innerText() : null,
    log,
  };
  if (S.dsl) { await M.press("showdsl"); await sleep(150); out.dsl = await f().locator("#dsl").innerText(); }
  if (S.shot) await page.screenshot({ path: S.shot });
  return out;
}
