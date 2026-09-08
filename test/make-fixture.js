// Jira 타임라인 DOM 구조를 흉내 낸 테스트 픽스처 생성기
const fs = require("fs");
const WEEKS = 5;
const START = new Date(2026, 8, 7); // 2026-09-07 (Mon)
const TODAY = new Date(2026, 8, 8);
const WEEK_W = 255, TOTAL = WEEK_W * WEEKS;
const MON = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const addDays = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };
const pct = (i) => (i / WEEKS * 100).toFixed(4);
const rpct = (i) => ((WEEKS - i - 1) / WEEKS * 100).toFixed(4);

function columns() {
  return Array.from({ length: WEEKS }, (_, i) =>
    `<div data-testid="timeline.chart-overlays.columns-overlay.column-${i}" class="col" style="left: ${pct(i)}%; right: ${rpct(i)}%;"></div>`
  ).join("");
}
function overlayContainer() { return `<div class="ovl" style="width:${TOTAL}px">${columns()}</div>`; }

function headerWeeks() {
  return Array.from({ length: WEEKS }, (_, i) => {
    const d0 = addDays(START, i * 7), d6 = addDays(d0, 6);
    let label = MON[d0.getMonth()] + (d0.getMonth() !== d6.getMonth() ? " / " + MON[d6.getMonth()] : "") + " ";
    const days = Array.from({ length: 7 }, (_, d) => {
      const dt = addDays(d0, d);
      return `<span data-testid="timeline.ui.timeline-table-kit.header.chart.calendar-cells.week.day-${d}" class="day">${dt.getDate()}</span>`;
    }).join("");
    const isToday = TODAY >= d0 && TODAY <= d6;
    const attrs = isToday
      ? `aria-label="Today is ${TODAY.getFullYear()}. ${TODAY.getMonth() + 1}. ${TODAY.getDate()}." data-highlighted="true"`
      : `data-highlighted="false"`;
    return `<div ${attrs} class="week" style="left: ${pct(i)}%; right: ${rpct(i)}%;"><small>${label}</small><div class="days">${days}</div></div>`;
  }).join("");
}

function bar(startOff, endOff, color, small, withLabel = true) {
  const left = startOff * WEEK_W / 7, right = TOTAL - (endOff + 1) * WEEK_W / 7;
  const f = (d) => `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
  const s = addDays(START, startOff), e = addDays(START, endOff);
  const label = withLabel ? `aria-label="시작 날짜 ${f(s)}, 기한 날짜 ${f(e)}, 색상 BLUE"` : "";
  const id = `${startOff}-${endOff}`;
  return `<div data-testid="roadmap.timeline-table-kit.ui.chart-item-content.date-content.bar.draggable-bar-ari:issue/${id}-container" data-issmallbar="${!!small}" class="bar${small ? " small" : ""}" style="left:${left}px;right:${right}px;background:${color}"><div class="inner" ${label} role="button"></div></div>`;
}
function row(i, key, name, b, resolved = false) {
  return `<tr data-testid="native-issue-table.ui.issue-row"><td class="key"><a data-testid="native-issue-table.common.ui.issue-cells.issue-key.issue-key-cell" href="#" style="${resolved ? "text-decoration: line-through" : ""}">${key}</a></td><td class="sum">${name}</td>
  <td class="chart"><div class="barwrap" style="width:${TOTAL}px">${b}</div></td></tr>`;
}

const html = `<!doctype html><html><head><meta charset="utf-8"><title>fixture</title>
<style>
  :root{--ds-surface:#fff}
  body{font:12px sans-serif;margin:12px}
  table{border-collapse:collapse;width:${400 + TOTAL}px;table-layout:fixed}
  td,th{border-bottom:1px solid #ddd;padding:0;height:40px;vertical-align:middle}
  .key{width:80px;padding-left:8px}.sum{width:300px}
  th.chart,td.chart{position:relative;width:${TOTAL}px}
  .ovl{position:absolute;top:0;bottom:0;left:0;pointer-events:none}
  .col{position:absolute;top:0;bottom:0;border-left:1px solid #eee;box-sizing:border-box;z-index:0}
  .jira-timeline{position:relative}
  .body-ovl{height:calc(100% - 41px)}
  .labels{position:relative;width:${TOTAL}px;height:40px}
  .week{position:absolute;top:0;bottom:0;display:flex;flex-direction:column}
  .week small{color:#626f86;padding-left:4px;height:16px}
  .days{display:flex}.day{display:inline-block;width:${(WEEK_W / 7).toFixed(3)}px;text-align:center;color:#626f86;font-size:11px}
  .barwrap{position:relative;height:40px}
  .bar{position:absolute;top:8px;height:24px;border-radius:3px;z-index:3;display:flex;align-items:center;justify-content:flex-end}.inner{position:absolute;inset:0}.bar.small{top:12px;height:16px}
</style></head><body>
<h3>fixture: ${WEEKS} weeks from 2026-09-07 (today 2026-09-08)</h3>
<div class="jira-timeline"><table><thead><tr><th class="key">Key</th><th class="sum">Summary</th>
<th class="chart">${overlayContainer()}<div class="labels">${headerWeeks()}</div></th></tr></thead>
<tbody id="tbody">
${row(0, "ACF-1", "추석 전후 작업", bar(9, 20, "#669DF1"))}
${row(1, "ACF-2", "주말 걸친 작업", bar(3, 8, "#94C748"))}
${row(2, "ACF-3", "10월 초 작업 (label 없음)", bar(24, 33, "#F5CD47", true, false))}
${row(3, "ACF-4", "좁은 막대, 토요일 마감", bar(10, 12, "#8F7EE7", false))}
${row(4, "ACF-5", "기한 초과 (9/1~9/4)", bar(-6, -3, "#F87462"))}
${row(5, "ACF-6", "마감 임박 (9/7~9/10)", bar(0, 3, "#6CC3E0"))}
${row(6, "ACF-7", "오늘 마감 (9/8)", bar(1, 1, "#9DD9EE"))}
${row(7, "ACF-8", "완료된 이슈, 기한 초과", bar(-5, -4, "#8590A2"), true)}
</tbody></table><div class="ovl body-ovl" style="width:${TOTAL}px;top:41px;left:${400}px">${columns()}</div></div>
</body></html>`;
fs.writeFileSync(__dirname + "/fixture.html", html);
console.log("fixture written");
