const { chromium } = require("playwright"); const path = require("path");
const EXT = path.resolve(__dirname, "../jira-weekend-marker");
(async () => {
  const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
  const page = await browser.newPage({ viewport: { width: 1750, height: 300 } });
  await page.goto("file://" + path.resolve(__dirname, "fixture.html"));
  await page.addStyleTag({ path: path.join(EXT, "content.css") });
  for (const f of ["holidays.js", "locales.js", "content.js"]) await page.addScriptTag({ path: path.join(EXT, f) });
  await page.waitForTimeout(300);
  for (const [name, s] of [["mask-nocover", { country: "KR", mode: "mask", coverBars: false }], ["mask-cover", { country: "KR", mode: "mask", coverBars: true }], ["hl-cover", { mode: "highlight", coverBars: true }]]) {
    await page.evaluate((s) => { window.__jwm.settings = s; window.__jwm.apply(); }, s);
    await page.waitForTimeout(100);
    // sample pixel at the middle of ACF-1 bar within Sat Sep 19 column (week 1, day 5)
    const pt = await page.evaluate(() => { const r = document.querySelector(".bar").getBoundingClientRect(); return { x: Math.round(400 + 12 + 255 + 36.43 * 5 + 18), y: Math.round(r.top + r.height / 2) }; });
    const buf = await page.screenshot({ clip: { x: pt.x, y: pt.y, width: 1, height: 1 } });
    const { PNG } = require("pngjs"); const img = PNG.sync.read(buf);
    const px = { rgb: [img.data[0], img.data[1], img.data[2]], barCovered: !(img.data[0] === 0x66 && img.data[1] === 0x9d && img.data[2] === 0xf1) };
    console.log(name, JSON.stringify(px));
    await page.screenshot({ path: `out/cover-${name}.png` });
  }
  await browser.close();
})();
