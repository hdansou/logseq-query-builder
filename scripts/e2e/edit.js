// Editing an existing query (frame.mjs, like flows.js): insert one, reopen it from the saved list,
// update it, hand-edit its text and title, reopen (warning + second press), a foreign #Query block
// (replace), a renamed and a deleted tag (stale chips), and the block context menu entry.
async ({ page, frame }) => {
  const out = {};
  const { sleep, shown, closePanel, openFromPalette } = require(require("node:path").join(process.cwd(), "common.js"))({ page, frame });
  await page.setViewportSize({ width: 1400, height: 1000 });
  await closePanel();
  const ctl = (fid) => frame().locator(`[data-fid="${fid}"]`);
  const panel = async () => ({
    button: await ctl("insert").innerText(),
    name: await ctl("name").inputValue(),
    notices: await frame().locator(".notice").allInnerTexts(),
    chips: await frame().locator(".chip").allInnerTexts().then((c) => c.map((t) => t.replace(/\s+/g, " ").trim())),
    count: await ctl("count").innerText(),
  });
  const api = (fn, ...args) => page.evaluate(async ([fn, args]) => logseq.api[fn](...args), [fn, args]);
  const dq = (q) => page.evaluate(async (q) => logseq.api.datascript_query(q), q);
  const block = async (uuid) => {
    const rows = await dq(`[:find ?t ?qt :where [?b :block/uuid #uuid "${uuid}"] [?b :block/title ?t] [?b :logseq.property/query ?q] [?q :block/title ?qt]]`);
    return rows[0] ? { title: rows[0][0], query: rows[0][1] } : null;
  };
  const waitShown = async (want = true) => { for (let i = 0; i < 50 && (await shown()) !== want; i++) await sleep(100); await sleep(700); };
  // Through the block's context menu: the entry this feature adds, and the one a mouse user will find.
  const openOn = async (uuid) => {
    await closePanel(); await page.keyboard.press("Escape"); await sleep(300);
    const bullet = page.locator(`.bullet-container[blockid="${uuid}"]`).first();
    await bullet.waitFor({ timeout: 8000 });
    await bullet.click({ button: "right" }); await sleep(600);
    await page.getByText("Open in Query Builder", { exact: true }).first().click();
    await waitShown();
  };
  const pickTag = async (text) => {
    const input = ctl("tag-picker"); await input.click(); await input.pressSequentially(text, { delay: 15 });
    const li = input.locator("xpath=following-sibling::ul").locator('li[role="option"]').first();
    await li.waitFor({ timeout: 4000 }); await li.click(); await sleep(600);
  };
  const openSaved = async (name) => {
    await closePanel(); await openFromPalette();
    await ctl("saved").click(); await sleep(800);
    const rows = await frame().locator("#saved .result").allInnerTexts();
    await frame().locator("#saved .result").filter({ hasText: name }).first().click(); await sleep(1200);
    return rows.map((r) => r.replace(/\n/g, " · "));
  };

  // ---- a page with an anchor block --------------------------------------------------------------
  const PAGE = "QB Edit Test " + Date.now().toString(36);
  await api("create_page", PAGE, {}, { redirect: true }); await sleep(1200);
  const anchor = (await api("append_block_in_page", PAGE, "anchor")).uuid;
  await api("create_tag", "QBTemp").catch(() => null);
  const tempTag = await api("get_page", "QBTemp");
  const tagged = (await api("append_block_in_page", PAGE, "a temp thing")).uuid;
  await api("add_block_tag", tagged, "QBTemp"); await sleep(500);

  // ---- 1. insert a query from the anchor --------------------------------------------------------
  await openOn(anchor);
  out.fresh = (await panel()).button;
  await pickTag("QBTemp");
  await ctl("name").fill("Temp things");
  await ctl("insert").click(); await waitShown(false);
  const made = await dq(`[:find ?u :where [?b :block/title "Temp things"] [?b :block/uuid ?u] [?b :logseq.property/query _]]`);
  const uuid = String(made[0]?.[0]);
  out.inserted = await block(uuid);

  // ---- 2. reopen from the saved list (no editing block), update ---------------------------------
  out.savedList = await openSaved("Temp things");
  out.reopened = await panel();
  await ctl("name").fill("Temp things v2");
  await ctl("insert").click(); await waitShown(false);
  out.updated = (await block(uuid))?.title;
  out.siblingsNamedV2 = (await dq(`[:find ?u :where [?b :block/title "Temp things v2"] [?b :block/uuid ?u]]`)).length;

  // ---- 3. rename the block and edit the query text by hand, reopen ------------------------------
  await api("update_block", uuid, "Renamed by hand");
  const before = (await block(uuid)).query;
  await api("upsert_block_property", uuid, "logseq.property/query", before.replace(":where", ":where\n [?b :block/title _]"));
  await sleep(600);
  out.savedList2 = await openSaved("Renamed by hand");
  out.handEdited = await panel();
  await ctl("insert").click(); await sleep(400);
  out.afterFirstPress = { button: await ctl("insert").innerText(), stillOpen: await shown(), textKept: (await block(uuid)).query.includes("[?b :block/title _]") };
  await ctl("insert").click(); await waitShown(false);
  out.afterSecondPress = { block: (await block(uuid))?.title, textRewritten: !(await block(uuid)).query.includes("[?b :block/title _]") };
  await openOn(uuid);
  out.cleanAgain = await panel();

  // ---- 4. renamed tag, then deleted tag ---------------------------------------------------------
  await closePanel();
  await api("rename_page", tempTag.uuid, "QBTemp Renamed").catch((e) => { out.renameError = String(e); });
  await sleep(800);
  await openOn(uuid);
  out.afterTagRename = await panel();
  await closePanel();
  await api("delete_page", "QBTemp Renamed").catch((e) => { out.deleteError = String(e); });
  await sleep(800);
  await openOn(uuid);
  out.afterTagDelete = await panel();

  // ---- 5. a query the builder did not write -----------------------------------------------------
  await closePanel();
  const foreign = (await api("append_block_in_page", PAGE, "Hand-written todos")).uuid;
  await api("add_block_tag", foreign, "logseq.class/Query");
  await api("upsert_block_property", foreign, "logseq.property/query", "(task Todo)"); await sleep(600);
  await openOn(foreign);
  out.foreign = await panel();
  await pickTag("Task");
  await ctl("insert").click(); await sleep(400);
  out.foreignFirstPress = { button: await ctl("insert").innerText(), query: (await block(foreign)).query };
  await ctl("insert").click(); await waitShown(false);
  const f2 = await block(foreign);
  out.foreignReplaced = { title: f2.title, datalog: f2.query.startsWith("{:query") };
  await openOn(foreign);
  out.foreignNowBuilder = await panel();
  await frame().locator("#root").screenshot({ path: process.env.SHOT || "/dev/null" }).catch(() => {});

  // ---- 6. the shortcut on an editing block -----------------------------------------------------
  await closePanel();
  await api("edit_block", uuid); await sleep(600);
  await page.keyboard.press("Meta+Alt+KeyF"); await waitShown();
  out.fromShortcut = (await shown()) ? await panel() : "panel did not open on the synthesised shortcut";
  await closePanel();
  return { page: PAGE, uuid, ...out };
}
