// Shared by the e2e scripts (qb.js, flows.js, flows2.js, keyboard.js), which frame.mjs evals with
// scripts/e2e as the working directory: require(path.join(process.cwd(), "common.js"))({ page, frame }).
module.exports = ({ page, frame }) => {
  const sleep = (ms) => page.waitForTimeout(ms);
  // Is the plugin's iframe container displayed? null when the plugin is not loaded at all.
  const shown = () => page.evaluate(() => { const c = document.querySelector('iframe[src*="query-builder"]')?.closest(".lsp-iframe-sandbox-container"); return c ? getComputedStyle(c).display !== "none" : null; });
  // Esc closes an open list first, then the panel; a third Esc is never needed.
  const closePanel = async (log) => {
    if (await shown()) { await frame().locator("body").press("Escape"); await sleep(300); }
    if (await shown()) { await frame().locator("body").press("Escape"); await sleep(300); }
    if ((await shown()) && log) log.push("panel did not close on Escape");
  };
  // Open a fresh builder from the command palette (focus is put back on the host first).
  const openFromPalette = async () => {
    const pal = page.locator('input[placeholder*="ommand" i], .cp__cmdk input').first();
    for (let attempt = 0; attempt < 3 && !(await pal.count()); attempt++) {
      await page.mouse.click(700, 300); await page.keyboard.press("Escape");
      await page.keyboard.press("Meta+Shift+P"); await sleep(700);
    }
    await pal.fill("Query Builder: open"); await sleep(500); await page.keyboard.press("Enter");
    for (let i = 0; i < 40 && !(await shown()); i++) await sleep(100);
    await sleep(600);
  };
  return { sleep, shown, closePanel, openFromPalette };
};
