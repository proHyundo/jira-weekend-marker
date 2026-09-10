const { chromium } = require("playwright"); const path = require("path");
const EXT = path.resolve(__dirname, "..");
(async () => {
  const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
  for (const [loc, country] of [["ko-KR", null], ["en-US", "CN"], ["en-US", "IN"]]) {
    const ctx = await browser.newContext({ locale: loc, viewport: { width: 360, height: 560 } });
    const page = await ctx.newPage();
    const errs = []; page.on("pageerror", e => errs.push(String(e)));
    await page.addInitScript((country) => {
      const store = country ? { country } : {};
      window.chrome = { storage: { sync: { get: (k, cb) => cb({ ...store }), set: (p, cb) => { Object.assign(store, p); cb && cb(); } } },
        tabs: { query: async () => [{ id: 1, url: "https://x.atlassian.net/jira/software/projects/ACF/boards/1/timeline" }], sendMessage: (id, m, cb) => cb({ dayCells: 35, weeks: 5, anchor: "2026-09-08" }) },
        runtime: { lastError: null, getManifest: () => ({ version: "0.0.4" }),
          sendMessage: (m, cb) => cb(m.type === "jwm:checkUpdate" ? { enabled: true, latestVersion: "0.9.0", latestUrl: "https://github.com/proHyundo/jira-weekend-marker/releases/tag/v0.9.0" } : null) } };
      window.chrome.storage.local = { get: (d, cb) => cb({ seenVersion: null }), set: () => {} }; window.chrome.action = { setBadgeText: () => {} };
    }, country);
    await page.goto("file://" + path.join(EXT, "popup.html"));
    await page.waitForTimeout(300);
    const txt = await page.evaluate(() => [document.querySelector("legend").textContent, document.querySelector("#country").selectedOptions[0].textContent, document.querySelector("#status").textContent, document.documentElement.lang].join(" | "));
    console.log(loc, country, "=>", txt, errs);
    const upd = await page.evaluate(() => ({ hidden: document.querySelector("#update").hidden, text: document.querySelector("#updateLink").textContent, href: document.querySelector("#updateLink").href, checkbox: document.querySelector("#checkUpdates").checked }));
    console.log("  update box:", JSON.stringify(upd));
    if (upd.hidden || !upd.text.includes("0.9.0") || !upd.href.endsWith("/tag/v0.9.0") || !upd.checkbox) { console.error("FAIL: update box not shown correctly"); process.exitCode = 1; }
    if (errs.length) { console.error("FAIL: page errors", errs); process.exitCode = 1; }
    await page.screenshot({ path: `out/popup-${loc}-${country}.png` });
    await ctx.close();
  }
  await browser.close();
})();
