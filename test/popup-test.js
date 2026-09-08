const { chromium } = require("playwright"); const path = require("path");
const EXT = path.resolve(__dirname, "../jira-weekend-marker");
(async () => {
  const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
  for (const [loc, country] of [["ko-KR", null], ["en-US", "CN"], ["en-US", "IN"]]) {
    const ctx = await browser.newContext({ locale: loc, viewport: { width: 360, height: 560 } });
    const page = await ctx.newPage();
    const errs = []; page.on("pageerror", e => errs.push(String(e)));
    await page.addInitScript((country) => {
      const store = country ? { country } : {};
      window.chrome = { storage: { sync: { get: (k, cb) => cb({ ...store }), set: (p, cb) => { Object.assign(store, p); cb && cb(); } } },
        tabs: { query: async () => [{ id: 1, url: "https://x.atlassian.net/jira" }], sendMessage: (id, m, cb) => cb({ dayCells: 35, weeks: 5, anchor: "2026-09-08" }) },
        runtime: { lastError: null, getManifest: () => ({ version: "0.0.4" }) } }; window.chrome.storage.local = { get: (d, cb) => cb({ seenVersion: null }), set: () => {} }; window.chrome.action = { setBadgeText: () => {} };
    }, country);
    await page.goto("file://" + path.join(EXT, "popup.html"));
    await page.waitForTimeout(300);
    const txt = await page.evaluate(() => [document.querySelector("legend").textContent, document.querySelector("#country").selectedOptions[0].textContent, document.querySelector("#status").textContent, document.documentElement.lang].join(" | "));
    console.log(loc, country, "=>", txt, errs);
    await page.screenshot({ path: `out/popup-${loc}-${country}.png` });
    await ctx.close();
  }
  await browser.close();
})();
