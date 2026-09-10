// Unit-style checks for the working-day / deadline logic (countWorkdays, dueStatus)
// and for the "today" reference used by the deadline warning.
const { chromium } = require("playwright"); const path = require("path");
const EXT = path.resolve(__dirname, "..");
const assert = (cond, msg) => { if (!cond) { console.error("FAIL:", msg); process.exitCode = 1; } else console.log("ok:", msg); };
(async () => {
  const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
  const ctx = await browser.newContext({ locale: "ko-KR", viewport: { width: 1750, height: 480 } });
  const page = await ctx.newPage();
  const errors = []; page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto("file://" + path.resolve(__dirname, "fixture.html"));
  await page.addStyleTag({ path: path.join(EXT, "content.css") });
  for (const f of ["holidays.js", "locales.js", "content.js"]) await page.addScriptTag({ path: path.join(EXT, f) });
  await page.waitForTimeout(200);
  await page.evaluate(() => { window.__jwm.settings = { country: "KR", useHolidays: true, dueWarnDays: 3 }; });

  const wd = (a, b, limit) => page.evaluate(([a, b, limit]) => {
    const d = (s) => { const [y, m, dd] = s.split("-").map(Number); return new Date(y, m - 1, dd); };
    return window.__jwm.countWorkdays(d(a), d(b), limit === undefined ? Infinity : limit);
  }, [a, b, limit]);
  const due = (end, today) => page.evaluate(([end, today]) => {
    const d = (s) => { const [y, m, dd] = s.split("-").map(Number); return new Date(y, m - 1, dd); };
    const r = window.__jwm.dueStatus(d(end), d(today));
    return r && { kind: r.kind, n: r.n };
  }, [end, today]);

  // ---- countWorkdays (KR, 2026-09: Chuseok 24–26; no substitute holiday on 28)
  assert(await wd("2026-09-11", "2026-09-15") === 3, "Fri..Tue = 3 working days (Fri, Mon, Tue)");
  assert(await wd("2026-09-12", "2026-09-13") === 0, "Sat..Sun = 0");
  assert(await wd("2026-09-08", "2026-09-08") === 1, "single working day = 1");
  assert(await wd("2026-09-21", "2026-09-30") === 6, "Chuseok week: 21,22,23,28,29,30 = 6 (24,25,26 holiday)");
  assert(await wd("2026-09-01", "2026-12-31", 3) === 4, "limit=3 stops early at 4");

  // ---- dueStatus with today = 2026-09-08 (Tue), N = 3
  assert(JSON.stringify(await due("2026-09-07", "2026-09-08")) === '{"kind":"overdue","n":1}', "due yesterday -> overdue 1 day");
  assert(JSON.stringify(await due("2026-09-08", "2026-09-08")) === '{"kind":"soon","n":0}', "due today -> soon, 0 left");
  assert(JSON.stringify(await due("2026-09-09", "2026-09-08")) === '{"kind":"soon","n":1}', "due tomorrow -> 1 working day left");
  assert(JSON.stringify(await due("2026-09-11", "2026-09-08")) === '{"kind":"soon","n":3}', "due Fri -> 3 left (Wed, Thu, Fri)");
  assert(await due("2026-09-14", "2026-09-08") === null, "due next Mon -> 4 left -> no warning");
  assert(JSON.stringify(await due("2026-09-13", "2026-09-08")) === '{"kind":"soon","n":3}', "due Sun -> 3 left (weekend adds nothing)");
  assert(await due("2026-09-29", "2026-09-21") === null, "Mon 21 -> Tue 29 across Chuseok: 22,23,28,29 = 4 -> no warning");
  assert(JSON.stringify(await due("2026-09-28", "2026-09-21")) === '{"kind":"soon","n":3}', "Mon 21 -> Mon 28 across Chuseok: 22,23,28 = 3 -> soon");
  // today on a weekend
  assert(JSON.stringify(await due("2026-09-14", "2026-09-12")) === '{"kind":"soon","n":1}', "today Sat, due Mon -> 1 left");
  // N = 0 : only due today / due on non-working day
  await page.evaluate(() => { window.__jwm.settings = { dueWarnDays: 0 }; });
  assert(JSON.stringify(await due("2026-09-08", "2026-09-08")) === '{"kind":"soon","n":0}', "N=0, due today -> soon");
  assert(await due("2026-09-09", "2026-09-08") === null, "N=0, due tomorrow -> none");
  await page.evaluate(() => { window.__jwm.settings = { dueWarnDays: 3 }; });

  // ---- "today" reference: with the Today marker the model anchor is today
  const anchor1 = await page.evaluate(() => { const m = window.__jwm.buildWeekModel(); return { isToday: !!m.anchor.isToday, date: m.anchor.date.toISOString().slice(0, 10) }; });
  assert(anchor1.isToday && anchor1.date === "2026-09-08", "anchor from Today marker: " + JSON.stringify(anchor1));
  // remove the Today marker -> fallback to month label; anchor must NOT be treated as today
  await page.evaluate(() => { document.querySelectorAll("[aria-label^='Today is']").forEach((e) => { e.removeAttribute("aria-label"); e.removeAttribute("data-highlighted"); }); });
  const anchor2 = await page.evaluate(() => { const m = window.__jwm.buildWeekModel(); return { isToday: !!m.anchor.isToday, date: m.anchor.date.toISOString().slice(0, 10) }; });
  assert(!anchor2.isToday, "anchor from month label is not flagged as today: " + JSON.stringify(anchor2));
  await page.evaluate(() => window.__jwm.apply());
  await page.waitForTimeout(150);
  // with the real date far from the fixture (2026-09), no bar may be flagged as "due soon" relative to the fixture's first day
  const flagged = await page.evaluate(() => [...document.querySelectorAll(".jwm-warn-icon")].map((e) => e.dataset.jwmDue));
  console.log("fallback-anchor flags (real today = " + new Date().toISOString().slice(0, 10) + "):", JSON.stringify(flagged));
  console.log("errors:", errors);
  assert(errors.length === 0, "no page errors");
  await browser.close();
})();
