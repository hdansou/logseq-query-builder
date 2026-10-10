async ({ page, frame }) => {
  const out = {};
  const sleep = (ms) => page.waitForTimeout(ms);
  const shown = () => page.evaluate(() => { const c = document.querySelector('iframe[src*="query-builder"]')?.closest(".lsp-iframe-sandbox-container"); return c ? getComputedStyle(c).display !== "none" : null; });
  const open = async () => {
    if (await shown()) { await frame().locator("body").press("Escape"); await sleep(300); }
    const pal = page.locator('input[placeholder*="ommand" i], .cp__cmdk input').first();
    for (let a = 0; a < 3 && !(await pal.count()); a++) { await page.mouse.click(700, 300); await page.keyboard.press("Escape"); await page.keyboard.press("Meta+Shift+P"); await sleep(700); }
    await pal.fill("Query Builder: open"); await sleep(500); await page.keyboard.press("Enter");
    for (let i = 0; i < 40 && !(await shown()); i++) await sleep(100);
    await sleep(700);
  };
  const rect = () => page.evaluate(() => { const c = document.querySelector(".lsp-iframe-sandbox-container[data-pid=logseq-query-builder]"); const r = c.getBoundingClientRect(); return { y: Math.round(r.y), h: Math.round(r.height), bottom: Math.round(r.bottom), win: innerHeight, fit: document.querySelector('style[data-injected-style*="qb-fit"], style[data-ref*="qb-fit"]')?.textContent ?? [...document.querySelectorAll("style")].map((s) => s.textContent).find((t) => t.includes("max-height") && t.includes("logseq-query-builder")) ?? null }; });

  // ---- F8 / FEAT-50: the real 980×700 window -------------------------------------------------
  await page.setViewportSize({ width: 980, height: 700 });
  await open();
  out.f8 = await rect();
  out.f8.insertBox = await frame().locator("[data-fid=insert]").boundingBox();
  out.f8.insertVisible = out.f8.insertBox && out.f8.insertBox.y + out.f8.insertBox.height <= 700;
  await page.screenshot({ path: "f8.png" });

  // ---- F5: click a result → host navigates, panel stays --------------------------------------
  await page.setViewportSize({ width: 1400, height: 1000 });
  await open();
  const f = frame();
  const tag = f.locator("[data-fid=tag-picker]"); await tag.click(); await tag.pressSequentially("book", { delay: 20 });
  for (let i = 0; i < 30 && !(await f.locator("[data-fid=tag-picker] + ul li[role=option]").count()); i++) await sleep(100);
  await f.locator("[data-fid=tag-picker] + ul li[role=option]").first().click(); await sleep(1200);
  const before = await page.evaluate(() => ({ route: location.hash, page: logseq.api.get_current_page?.()?.title ?? null }));
  const first = f.locator("#results .result").first();
  const firstTitle = await first.locator(".t").innerText();
  await first.click(); await sleep(1500);
  out.f5 = { clicked: firstTitle, before, after: await page.evaluate(() => ({ route: location.hash, page: logseq.api.get_current_page?.()?.title ?? null })), panelStillShown: await shown(), countStill: await f.locator("[data-fid=count]").innerText() };

  // ---- F7: theme mode dark → tokens follow; back to light --------------------------------------
  const tokens = () => frame().evaluate(() => { const cs = getComputedStyle(document.documentElement); return { bg: cs.getPropertyValue("--qb-bg").trim(), fg: cs.getPropertyValue("--qb-fg").trim(), bodyBg: getComputedStyle(document.body).backgroundColor }; });
  const hostBg = () => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--ls-primary-background-color").trim());
  const mode = () => page.evaluate(() => document.documentElement.dataset.theme ?? document.documentElement.className);
  out.f7 = { lightMode: await mode(), light: await tokens(), hostLight: await hostBg() };
  await page.evaluate(() => logseq.api.set_theme_mode("dark")); await sleep(2000);
  out.f7.darkMode = await mode(); out.f7.dark = await tokens(); out.f7.hostDark = await hostBg();
  await page.screenshot({ path: "f7-dark.png" });
  await page.evaluate(() => logseq.api.set_theme_mode("light")); await sleep(2000);
  out.f7.backLight = await tokens();
  await frame().locator("body").press("Escape");
  return out;
}
