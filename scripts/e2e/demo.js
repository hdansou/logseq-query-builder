// Demo clips (frame.mjs, like flows.js). Drives the real panel at a human pace with a visible
// pointer and a caption bar, and saves a screenshot stream that scripts/e2e/demo.sh turns into a
// clip. CLIP = edit | defaults | filters ; OUT = directory for the frames.
async ({ page, frame }) => {
  const fs = require("node:fs"), path = require("node:path");
  const CLIP = process.env.CLIP || "edit", OUT = process.env.OUT;
  const { sleep, shown, closePanel, openFromPalette } = require(path.join(process.cwd(), "common.js"))({ page, frame });
  await page.setViewportSize({ width: 1280, height: 920 });
  await closePanel();
  await page.mouse.click(640, 60); await page.keyboard.press("Escape");

  // ---- pointer and caption, drawn in the host page above the plugin frame ----------------------
  await page.evaluate(() => {
    document.getElementById("qb-demo")?.remove();
    const root = document.createElement("div"); root.id = "qb-demo";
    root.innerHTML = `<div id="qb-demo-cap" style="position:fixed;left:50%;top:12px;transform:translateX(-50%);max-width:900px;padding:10px 18px;border-radius:10px;background:rgba(20,22,28,.92);color:#fff;font:600 17px/1.35 Inter,system-ui,sans-serif;box-shadow:0 8px 30px rgba(0,0,0,.35);opacity:0;transition:opacity .25s;text-align:center"></div>
      <div id="qb-demo-ptr" style="position:fixed;left:640px;top:430px;width:22px;height:22px;margin:-11px 0 0 -11px;border-radius:50%;background:rgba(255,170,0,.35);border:2px solid #ff9d00;transition:left .45s ease,top .45s ease,transform .12s"></div>`;
    root.style.cssText = "position:fixed;inset:0;z-index:2147483647;pointer-events:none";
    document.body.appendChild(root);
  });
  const caption = async (text, hold = 1400) => {
    await page.evaluate((t) => { const c = document.getElementById("qb-demo-cap"); c.textContent = t; c.style.opacity = t ? "1" : "0"; }, text);
    await sleep(hold);
  };
  const pointTo = async (x, y) => { await page.evaluate(([x, y]) => { const p = document.getElementById("qb-demo-ptr"); p.style.left = x + "px"; p.style.top = y + "px"; }, [x, y]); await sleep(520); };
  const pulse = async () => { await page.evaluate(() => { const p = document.getElementById("qb-demo-ptr"); p.style.transform = "scale(.6)"; setTimeout(() => (p.style.transform = ""), 140); }); await sleep(160); };
  const click = async (loc, opts = {}) => {
    await loc.waitFor({ timeout: 8000 });
    await loc.scrollIntoViewIfNeeded().catch(() => {});
    const b = await loc.boundingBox();
    if (b) { await pointTo(b.x + Math.min(b.width / 2, 60), b.y + b.height / 2); await pulse(); }
    await loc.click(opts); await sleep(450);
  };

  // ---- frame capture ----------------------------------------------------------------------------
  fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
  let recording = true, n = 0; const stamps = [];
  const recorder = (async () => {
    while (recording) {
      const file = path.join(OUT, `f${String(n).padStart(5, "0")}.jpg`);
      const t = Date.now();
      try { await page.screenshot({ path: file, type: "jpeg", quality: 88 }); stamps.push([file, t]); n++; } catch { /* a navigation in flight */ }
      const spent = Date.now() - t; if (spent < 90) await sleep(90 - spent);
    }
  })();
  const finish = async () => {
    await sleep(900); recording = false; await recorder;
    const lines = stamps.map(([file, t], i) => `file '${file}'\nduration ${(((stamps[i + 1]?.[1] ?? t + 400) - t) / 1000).toFixed(3)}`);
    fs.writeFileSync(path.join(OUT, "frames.txt"), lines.join("\n") + `\nfile '${stamps[stamps.length - 1][0]}'\n`);
    await page.evaluate(() => document.getElementById("qb-demo")?.remove());
    return { clip: CLIP, frames: n, seconds: Math.round((stamps[stamps.length - 1][1] - stamps[0][1]) / 1000) };
  };

  // ---- panel helpers ----------------------------------------------------------------------------
  const ctl = (fid) => frame().locator(`[data-fid="${fid}"]`);
  const fids = () => frame().locator("[data-fid]").evaluateAll((els) => els.map((e) => e.dataset.fid));
  const api = (fn, ...args) => page.evaluate(async ([fn, args]) => logseq.api[fn](...args), [fn, args]);
  const dq = (q) => page.evaluate(async (q) => logseq.api.datascript_query(q), q);
  const waitShown = async (want = true) => { for (let i = 0; i < 60 && (await shown()) !== want; i++) await sleep(100); await sleep(800); };
  const pick = async (fid, text, label = text) => {
    const input = ctl(fid); await click(input);
    await input.fill(""); await input.pressSequentially(text, { delay: 70 });
    const li = input.locator("xpath=following-sibling::ul").locator('li[role="option"]').filter({ hasText: label }).first();
    await li.waitFor({ timeout: 5000 }); await sleep(350); await click(li); await sleep(500);
  };
  // Select-all then type: clearing the name first would bring its suggestion back under the caret.
  const type = async (fid, text, commit = "Tab") => { const input = ctl(fid); await click(input); await input.press("Meta+A"); await input.pressSequentially(text, { delay: 70 }); if (commit) await input.press(commit); await sleep(700); };
  const rowId = async () => (await fids()).filter((f) => f.startsWith("row-prop-")).pop().slice("row-prop-".length);
  const addRow = async () => { await click(ctl("add-row")); return rowId(); };
  const count = () => ctl("count").innerText();
  const settle = async () => { for (let i = 0; i < 40 && /running/.test(await count()); i++) await sleep(100); await sleep(900); };
  const openOn = async (uuid) => {
    const bullet = page.locator(`.bullet-container[blockid="${uuid}"]`).first();
    await bullet.waitFor({ timeout: 8000 });
    const b = await bullet.boundingBox(); await pointTo(b.x + b.width / 2, b.y + b.height / 2); await pulse();
    await bullet.click({ button: "right" }); await sleep(900);
    await click(page.getByText("Open in Query Builder", { exact: true }).first());
    await waitShown();
  };
  const fromPalette = async () => { await openFromPalette(); await sleep(500); };
  // A fresh page per run. A deleted page keeps its name in the recycle bin and cannot be recreated
  // under it (observed live), so the first free name of a few is taken instead of deleting.
  const demoPage = async (names, blocks) => {
    let name = null;
    for (const n of names) if (!(await api("get_page", n).catch(() => null))) { name = n; break; }
    if (!name) throw new Error(`every demo page name is taken: ${names.join(", ")}`);
    await api("create_page", name, {}, { redirect: false }); await sleep(900);
    const out = [];
    for (const b of blocks) out.push((await api("append_block_in_page", name, b)).uuid);
    await api("push_state", "page", { name }); await sleep(1500);   // the redirect does not always navigate
    return { name, uuids: out };
  };
  // Two tasks with no status of their own, under names that read well on screen.
  for (const [from, to] of [["Bare task one", "Book the venue"], ["Bare task two", "Call the caterer"]]) {
    const hit = await dq(`[:find ?u :where [?b :block/title "${from}"] [?b :block/uuid ?u]]`);
    if (hit[0]) await api("update_block", String(hit[0][0]), to);
  }

  // The page those two tasks live on, under a name that reads well too.
  const stale = await api("get_page", "QB Defaults").catch(() => null);
  if (stale) { await api("rename_page", stale.uuid, "Event planning"); await sleep(1000); }
  if (!(await api("get_page", "Event planning").catch(() => null))) throw new Error("backdrop page missing: seed two status-less tasks on a page named Event planning");
  const BACKDROP = "Event planning";

  // =================================== clips ===================================================
  if (CLIP === "edit") {
    const made0 = await demoPage(["This week", "Week notes", "Review notes", "Planning notes", "Team notes"], ["Things to look at this week"]);
    const PAGE = made0.name, anchor = made0.uuids[0];
    await caption("Right-click any block → Open in Query Builder", 1600);
    await openOn(anchor);
    await caption("Build a query: open tasks");
    await pick("tag-picker", "Task");
    let id = await addRow();
    await pick(`row-prop-${id}`, "Status"); await pick(`row-op-${id}`, "does not", "does not contain"); await pick(`row-vpick-${id}`, "Done");
    await settle();
    await type("name", "Open tasks", null);
    await caption("Insert writes it as a live query block", 900);
    await click(ctl("insert")); await waitShown(false); await sleep(1800);
    const made = await dq(`[:find ?u :where [?b :block/title "Open tasks"] [?b :block/uuid ?u] [?b :logseq.property/query _] [?b :block/page ?p] [?p :block/title "${PAGE}"]]`);
    const uuid = String(made[0][0]);

    await caption("New: reopen the query from its block to edit it", 1800);
    await openOn(uuid);
    await caption("The filters come back as chips, and the button reads Update query", 2600);
    id = await addRow();
    await pick(`row-prop-${id}`, "Priority"); await pick(`row-vpick-${id}`, "High");
    await settle();
    await type("name", "Open high-priority tasks", null);
    await caption("Change it, then Update query rewrites the same block", 1600);
    await click(ctl("insert")); await waitShown(false); await sleep(1800);

    await caption("New: every saved query is listed in the panel — no need to find its block", 1800);
    await fromPalette();
    await click(ctl("saved")); await sleep(1600);
    await click(frame().locator("#saved .result").filter({ hasText: "Open high-priority tasks" }).first()); await sleep(2200);
    await closePanel();

    await caption("If someone edits the query text by hand…", 1500);
    const text = (await dq(`[:find ?qt :where [?b :block/uuid #uuid "${uuid}"] [?b :logseq.property/query ?q] [?q :block/title ?qt]]`))[0][0];
    await api("upsert_block_property", uuid, "logseq.property/query", text.replace(":where", ":where\n [?b :block/title _]")); await sleep(900);
    await openOn(uuid);
    await caption("…the builder warns before overwriting, and asks for a second press", 2600);
    await click(ctl("insert")); await sleep(2200);
    await closePanel();

    await caption("A query the builder did not write can be replaced in place", 1600);
    const foreign = (await api("append_block_in_page", PAGE, "Hand-written: doing")).uuid;
    await api("add_block_tag", foreign, "logseq.class/Query");
    await api("upsert_block_property", foreign, "logseq.property/query", "(task Doing)"); await sleep(1500);
    await openOn(foreign);
    await caption("It opens empty, with Replace this query and a warning", 3000);
    await closePanel();
    await caption("", 200);
    return finish();
  }

  if (CLIP === "defaults") {
    await api("push_state", "page", { name: BACKDROP }); await sleep(1500);
    await caption("Two tasks with no status set: Logseq shows them as Todo", 2600);
    await fromPalette();
    await caption("Fixed: “Status is Todo” now finds them", 1400);
    await pick("tag-picker", "Task");
    let id = await addRow();
    await pick(`row-prop-${id}`, "Status");
    await click(ctl(`row-vpick-${id}`)); await sleep(1800);   // the list shows Todo with its count
    await pick(`row-vpick-${id}`, "Todo");
    await settle();
    await caption("7 tasks: 5 with a stored Todo, plus the 2 that only show the default", 3200);
    await caption("And they no longer count as “Status is empty”", 1400);
    await pick(`row-op-${id}`, "is empty");
    await settle();
    await caption("0 nodes: nothing on a Task has an empty status", 2600);
    await closePanel(); await caption("", 200);
    return finish();
  }

  if (CLIP === "filters") {
    await api("push_state", "page", { name: BACKDROP }); await sleep(1200);
    await fromPalette();
    await caption("New: filter by when a node was created or updated", 1600);
    await pick("tag-picker", "Task");
    let id = await addRow();
    await pick(`row-prop-${id}`, "created", "Node created at");
    await pick(`row-op-${id}`, "on or after", "on or after");
    await pick(`row-val-${id}`, "-7d");
    await settle();
    await caption("Tasks created in the last 7 days; each row shows the date", 3000);
    await caption("Or by when it last changed", 900);
    await pick(`row-prop-${id}`, "updated", "Node updated at");
    await pick(`row-op-${id}`, "before", "before");
    await pick(`row-val-${id}`, "today");
    await settle();
    await caption("Not touched today. Same relative dates as any date filter: today, -7d, +1m…", 3000);
    await caption("", 300);
    await closePanel(); await sleep(400);

    await fromPalette();
    await caption("New: match part of a text value", 1600);
    await pick("tag-picker", "Person");
    id = await addRow();
    await pick(`row-prop-${id}`, "Company");
    await pick(`row-op-${id}`, "includes", "includes text");
    await type(`row-val-${id}`, "north");
    await settle();
    await caption("Company includes “north”, case-insensitive", 2600);
    await pick(`row-op-${id}`, "starts", "starts with");
    await type(`row-val-${id}`, "ac");
    await settle();
    await caption("…or starts with “ac”", 2400);
    await closePanel(); await caption("", 200);
    return finish();
  }
  recording = false; await recorder;
  return { error: `unknown CLIP ${CLIP}` };
}
