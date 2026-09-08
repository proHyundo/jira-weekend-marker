const { chromium } = require("playwright"); const path = require("path");
const EXT = path.resolve(__dirname, "../jira-weekend-marker");
(async () => {
  const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
  const ctx = await browser.newContext({ locale: "ko-KR", viewport: { width: 1750, height: 480 } });
  const page = await ctx.newPage();
  const errors = []; page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto("file://" + path.resolve(__dirname, "fixture.html"));
  await page.addStyleTag({ path: path.join(EXT, "content.css") });
  for (const f of ["holidays.js", "locales.js", "content.js"]) await page.addScriptTag({ path: path.join(EXT, f) });
  await page.waitForTimeout(300);
  const dump = () => page.evaluate(() => [...document.querySelectorAll(".jwm-badge")].map((b) => ({
    bar: b.parentElement.dataset.testid.replace(/.*issue\//, ""), text: b.textContent.trim(), title: b.title, due: b.parentElement.classList.contains("jwm-due-off"), dueKind: b.querySelector(".jwm-warn-icon")?.dataset.jwmDue || ""
  })));
  console.log("KR default:", JSON.stringify(await dump(), null, 1));
  await page.screenshot({ path: "out/bars-ko.png" });
  await page.evaluate(() => { window.__jwm.settings = { country: "US", highlightColor: "#2684ff", highlightAlpha: 0.3, warnColor: "#ff0000" }; window.__jwm.apply(); });
  await page.waitForTimeout(150);
  console.log("US recolored:", JSON.stringify(await dump()));
  console.log("css vars:", await page.evaluate(() => document.documentElement.style.cssText));
  await page.screenshot({ path: "out/bars-us-color.png" });
  // drag simulation: move bar 3 by one day -> badge must update via attribute observer
  await page.evaluate(() => { const b = document.querySelectorAll(".bar")[1]; b.style.left = (parseFloat(b.style.left) + 255 / 7) + "px"; b.querySelector(".inner").setAttribute("aria-label", "시작 날짜 2026/09/11, 기한 날짜 2026/09/15, 색상 BLUE"); });
  await page.waitForTimeout(300);
  console.log("after move:", JSON.stringify((await dump())[1]));
  await page.evaluate(() => { window.__jwm.settings = { country: "KR", showWorkdays: false, dueWarning: true }; window.__jwm.apply(); });
  console.log("workdays off, warning on ->", JSON.stringify(await dump()));
  await page.evaluate(() => { window.__jwm.settings = { showWorkdays: false, dueWarning: false }; window.__jwm.apply(); });
  console.log("both off -> badges:", (await dump()).length);
  await page.evaluate(() => { window.__jwm.settings = { showWorkdays: true, dueWarning: true, coverBars: true, mode: "mask" }; window.__jwm.apply(); });
  await page.waitForTimeout(150);
  console.log("cover:", await page.evaluate(() => ({ rowshades: document.querySelectorAll(".jwm-rowshade").length, tableShadesHidden: [...document.querySelectorAll('.jwm-shade[data-jwm-scope="table"]')].every((e) => getComputedStyle(e).display === "none"), stops: (document.querySelector(".jwm-rowshade").style.backgroundImage.match(/transparent/g) || []).length / 2 })));
  await page.screenshot({ path: "out/bars-cover-mask.png" });
  await page.evaluate(() => { window.__jwm.settings = { coverBars: false, mode: "highlight" }; window.__jwm.apply(); });
  console.log("cover off -> rowshades:", await page.evaluate(() => document.querySelectorAll(".jwm-rowshade").length));
  console.log("errors:", errors);
  await browser.close();
})();
