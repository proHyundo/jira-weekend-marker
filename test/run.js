const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");
const EXT = path.resolve(__dirname, "../jira-weekend-marker");
const out = path.join(__dirname, "out"); fs.mkdirSync(out, { recursive: true });

async function load(browser, locale) {
  const ctx = await browser.newContext({ locale, viewport: { width: 1750, height: 320 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "warning" || m.type() === "error") errors.push(m.text()); });
  await page.goto("file://" + path.resolve(__dirname, "fixture.html"));
  await page.addStyleTag({ path: path.join(EXT, "content.css") });
  for (const f of ["holidays.js", "locales.js", "content.js"]) await page.addScriptTag({ path: path.join(EXT, f) });
  await page.waitForTimeout(300);
  return { page, ctx, errors };
}

const summarize = (page) => page.evaluate(() => ({
  locale: window.__jwm.locale,
  days: [...document.querySelectorAll(".jwm-day-off")].map((e) => e.title),
  work: [...document.querySelectorAll(".jwm-day-work")].map((e) => e.title),
  shades: document.querySelectorAll(".jwm-shade").length
}));

(async () => {
  const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
  let allErrors = [];

  // 1) auto-detect by browser language
  for (const [loc, expect] of [["ko-KR", "KR"], ["en-US", "US"], ["zh-CN", "CN"], ["hi-IN", "IN"], ["en-IN", "IN"], ["fr-FR", "US"]]) {
    const { page, ctx, errors } = await load(browser, loc);
    const r = await summarize(page);
    console.log(`auto ${loc} -> ${r.locale.country}/${r.locale.lang} ${r.locale.country === expect ? "OK" : "FAIL(expected " + expect + ")"} | ${r.days.length} off days, first holiday: ${r.days.find((d) => !/토요일|일요일|Saturday|Sunday|星期|शनिवार|रविवार/.test(d)) || "-"}`);
    if (loc === "ko-KR") await page.screenshot({ path: path.join(out, "kr.png") });
    allErrors.push(...errors);
    await ctx.close();
  }

  // 2) explicit country selection on a fixed page
  const { page, ctx, errors } = await load(browser, "en-US");
  for (const c of ["KR", "US", "CN", "IN"]) {
    await page.evaluate((c) => { window.__jwm.settings = { country: c }; window.__jwm.apply(); }, c);
    await page.waitForTimeout(100);
    const r = await summarize(page);
    console.log(`\n[${c}] lang=${r.locale.lang} shades=${r.shades}\n  off: ${r.days.join(" | ")}\n  workdays: ${r.work.join(" | ") || "-"}`);
    await page.screenshot({ path: path.join(out, `country-${c}.png`) });
  }
  // language override
  await page.evaluate(() => { window.__jwm.settings = { country: "IN", language: "en" }; window.__jwm.apply(); });
  console.log("\nIN + en override:", (await summarize(page)).days.slice(0, 3));
  allErrors.push(...errors);
  await ctx.close();

  // 3) US rule generator sanity
  const us = await (async () => {
    const { page, ctx } = await load(browser, "en-US");
    const r = await page.evaluate(() => Object.entries(JWM_HOLIDAYS.US.generate(2026)).concat(Object.entries(JWM_HOLIDAYS.US.generate(2027))));
    await ctx.close();
    return r;
  })();
  console.log("\nUS 2026-2027:", us.map(([d, n]) => `${d} ${n}`).join("; "));

  console.log("\nerrors:", allErrors);
  await browser.close();
})();
