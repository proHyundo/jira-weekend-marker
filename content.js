/* Jira Timeline Weekend Marker - content script
 *
 * 동작 원리
 *  1. 타임라인 헤더의 요일 셀( data-testid="...calendar-cells.week.day-N" )을 주(week) 단위로 묶는다.
 *  2. "Today is YYYY. M. D." aria-label 이 붙은 주(또는 "Sep '25" 같은 월 라벨)를 기준점으로 삼아
 *     모든 요일 셀의 실제 날짜를 계산한다.
 *  3. 주말/공휴일에 해당하는 요일 인덱스를 구해, 각 행의 주 단위 컬럼 오버레이
 *     ( data-testid="timeline.chart-overlays.columns-overlay.column-N" ) 안에 1/7 폭의 음영 DIV 를 삽입한다.
 *  4. 모드(highlight / mask / off)는 <html data-jwm-mode> 속성으로 전달하고 스타일은 content.css 가 담당한다.
 *  5. Jira 는 React 로 수시로 재렌더링하므로 MutationObserver 로 변화를 감지해 멱등하게 다시 적용한다.
 */
(() => {
  "use strict";

  const DAY_PREFIX = "timeline.ui.timeline-table-kit.header.chart.calendar-cells.week.day-";
  const COL_PREFIX = "timeline.chart-overlays.columns-overlay.column-";
  const SHADE_CLASS = "jwm-shade";
  const DAY_CLASS = "jwm-day-off";
  const WORKDAY_CLASS = "jwm-day-work";
  const ROWSHADE_CLASS = "jwm-rowshade";
  const ROW_SELECTOR = 'tr[data-testid="native-issue-table.ui.issue-row"]';
  const KEY_LINK_SELECTOR = '[data-testid="native-issue-table.common.ui.issue-cells.issue-key.issue-key-cell"]';
  const BADGE_CLASS = "jwm-badge";
  const DUE_CLASS = "jwm-due-off";
  const BAR_SELECTOR = '[data-testid^="roadmap.timeline-table-kit.ui.chart-item-content.date-content.bar.draggable-bar-"][data-testid$="-container"]';

  const DEFAULTS = {
    mode: "highlight",        // "highlight" | "mask" | "off"
    country: "auto",          // "auto" | "KR" | "US" | "CN" | "IN"
    language: "auto",         // "auto" | "en" | "ko" | "zh" | "hi"
    useHolidays: true,        // 내장 공휴일 사용
    coverBars: false,         // 음영을 막대 위에도 덮을지
    customHolidays: "",       // "YYYY-MM-DD 이름" 줄 단위
    showWorkdays: true,       // 막대 안에 근무일 수 배지
    dueWarning: true,         // 마감 경고: 기한 초과 또는 N 근무일 이내 (아이콘 + 테두리)
    dueWarnDays: 3,           // 마감 임박 기준 근무일 수
    highlightColor: "#de350b",// 강조 색상
    highlightAlpha: 0.12,     // 강조 음영 투명도 (0.05 ~ 0.6)
    warnColor: "#e2b203"      // 경고 색상 (짙은 노란색)
  };
  const HEX_RE = /^#([0-9a-f]{6})$/i;
  const hexToRgb = (hex) => {
    const m = HEX_RE.exec(String(hex || "").trim());
    if (!m) return null;
    const n = parseInt(m[1], 16);
    return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
  };
  const fmt = (str, vars) => String(str).replace(/\{(\w+)\}/g, (_, k) => (vars && k in vars ? vars[k] : ""));

  // chrome.* (callback style) is available in Chrome, Edge, Safari and Firefox; browser.* is the fallback
  const ext = typeof chrome !== "undefined" && chrome.storage ? chrome : (typeof browser !== "undefined" && browser.storage ? browser : null);
  const storage = ext && ext.storage ? (ext.storage.sync || ext.storage.local) : null;
  let settings = { ...DEFAULTS };
  let holidayMap = new Map();   // iso -> name
  let workdayMap = new Map();   // iso -> reason (weekend days that are working days)
  let weekendDays = [0, 6];
  let t = JWM_LOCALES.en;       // active UI strings
  let locale = { country: "US", lang: "en" };
  let scheduled = false;
  let applying = false;

  /* ------------------------------------------------------------------ utils */
  const pad = (n) => String(n).padStart(2, "0");
  const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const addDays = (d, n) => {
    const r = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    r.setDate(r.getDate() + n);
    return r;
  };

  const MONTHS = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
    jul: 6, aug: 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11
  };

  function rebuildHolidayMap() {
    const r = jwmResolveLocale(settings);
    locale = { country: r.country, lang: r.lang };
    t = r.t;
    const thisYear = new Date().getFullYear();
    const cal = jwmBuildCalendar(r.country, thisYear - 3, thisYear + 5);
    weekendDays = cal.weekend;
    workdayMap = cal.workdays;
    holidayMap = settings.useHolidays ? cal.holidays : new Map();
    String(settings.customHolidays || "")
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((line) => {
        const m = line.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})\s*(.*)$/);
        if (!m) return;
        const key = `${m[1]}-${pad(+m[2])}-${pad(+m[3])}`;
        holidayMap.set(key, m[4] || t.customDefault);
      });
  }

  /** 날짜가 쉬는 날이면 { kind, name } 반환, 아니면 null */
  function offInfo(date) {
    const key = iso(date);
    const holiday = holidayMap.get(key);
    if (holiday) return { kind: "holiday", name: holiday };
    const dow = date.getDay();
    if (weekendDays.includes(dow)) {
      // 중국 조휴(调休)처럼 주말이지만 근무일로 지정된 날은 제외
      if (workdayMap.has(key)) return null;
      return { kind: "weekend", name: dow === 6 ? t.saturday : t.sunday };
    }
    return null;
  }

  /* ---------------------------------------------------------- DOM 분석 */
  function leftKey(el) {
    const v = parseFloat(el.style.left);
    return Number.isFinite(v) ? v.toFixed(3) : null;
  }

  /** 헤더에서 주(week) 목록을 만들고 각 요일 셀의 실제 날짜를 계산한다. */
  function buildWeekModel() {
    const spans = document.querySelectorAll(`[data-testid^="${DAY_PREFIX}"]`);
    if (!spans.length) return null;

    const byEl = new Map();
    const weeks = [];
    spans.forEach((span) => {
      const weekEl = span.parentElement && span.parentElement.parentElement;
      if (!weekEl) return;
      let w = byEl.get(weekEl);
      if (!w) {
        w = { el: weekEl, days: [], left: parseFloat(weekEl.style.left) };
        byEl.set(weekEl, w);
        weeks.push(w);
      }
      const idx = parseInt(span.dataset.testid.slice(DAY_PREFIX.length), 10);
      const num = parseInt(span.textContent.trim(), 10);
      if (Number.isFinite(idx)) w.days[idx] = { el: span, num };
    });
    if (!weeks.length) return null;

    // DOM 순서가 곧 시간 순서이지만, left% 가 있으면 그것으로 정렬해 안전하게.
    if (weeks.every((w) => Number.isFinite(w.left))) weeks.sort((a, b) => a.left - b.left);
    weeks.forEach((w, i) => (w.index = i));

    // ---- 기준점 찾기 (1순위: Today 주, 2순위: 연도가 명시된 단일 월 라벨)
    let anchor = null; // { weekIndex, dayIndex, date }
    for (const w of weeks) {
      const label = w.el.getAttribute("aria-label") || "";
      const highlighted = w.el.getAttribute("data-highlighted") === "true";
      const m = label.match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/);
      if (!highlighted && !m) continue;
      const today = m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date();
      const di = w.days.findIndex((d) => d && d.num === today.getDate());
      if (di >= 0) {
        anchor = { weekIndex: w.index, dayIndex: di, date: today };
        break;
      }
    }
    if (!anchor) {
      for (const w of weeks) {
        const small = w.el.querySelector("small");
        const text = small ? small.textContent.trim() : "";
        const d0 = w.days.find(Boolean);
        if (!d0) continue;
        const d0i = w.days.indexOf(d0);
        // "Sep '25"  /  "Sep"  (현재 연도는 생략됨)
        let m = text.match(/^([A-Za-z]{3,4})\.?\s*(?:'(\d{2}))?$/);
        if (m && MONTHS[m[1].toLowerCase()] !== undefined) {
          const year = m[2] ? 2000 + +m[2] : new Date().getFullYear();
          anchor = { weekIndex: w.index, dayIndex: d0i, date: new Date(year, MONTHS[m[1].toLowerCase()], d0.num) };
          break;
        }
        // "2025년 9월" / "9월"
        m = text.match(/^(?:(\d{4})년\s*)?(\d{1,2})월$/);
        if (m) {
          const year = m[1] ? +m[1] : new Date().getFullYear();
          anchor = { weekIndex: w.index, dayIndex: d0i, date: new Date(year, +m[2] - 1, d0.num) };
          break;
        }
      }
    }
    if (!anchor) return null;

    // ---- 모든 요일 셀에 날짜 부여
    for (const w of weeks) {
      w.byLeft = leftKey(w.el);
      w.off = []; // [{ dayIndex, kind, name }]
      for (let d = 0; d < 7; d++) {
        const offset = (w.index - anchor.weekIndex) * 7 + (d - anchor.dayIndex);
        const date = addDays(anchor.date, offset);
        const cell = w.days[d];
        if (cell) {
          cell.date = date;
          if (cell.num !== date.getDate()) {
            // 기준점 계산이 어긋나면 로그만 남기고 계속 진행
            console.debug("[jwm] day mismatch", iso(date), "cell shows", cell.num);
          }
        }
        const info = offInfo(date);
        if (info) w.off.push({ dayIndex: d, ...info, date });
        else if (cell && workdayMap.has(iso(date))) cell.workday = workdayMap.get(iso(date));
      }
    }
    const anchorAbs = anchor.weekIndex * 7 + anchor.dayIndex;
    const dateAt = (absIdx) => addDays(anchor.date, absIdx - anchorAbs);
    return { weeks, anchor, dateAt, totalDays: weeks.length * 7 };
  }

  /* ---------------------------------------------------------- 막대(이슈 바) */
  /** aria-label 의 두 날짜(YYYY/MM/DD 등) 또는 픽셀 위치로 막대의 시작/종료 날짜를 구한다. */
  function barDates(bar, model) {
    const labelEl = bar.querySelector("[aria-label]");
    const label = labelEl ? labelEl.getAttribute("aria-label") || "" : "";
    const found = [...label.matchAll(/(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})/g)];
    if (found.length >= 2) {
      const d = (m) => new Date(+m[1], +m[2] - 1, +m[3]);
      return { start: d(found[0]), end: d(found[1]), source: "label" };
    }
    // 픽셀 기반 추정: left/right(px) 와 실제 폭으로 전체 폭을 복원해 하루 폭을 계산
    const left = parseFloat(bar.style.left);
    const right = parseFloat(bar.style.right);
    const width = bar.getBoundingClientRect().width;
    if (!Number.isFinite(left) || !Number.isFinite(right) || width <= 0) return null;
    const total = left + right + width;
    const dayW = total / model.totalDays;
    if (!(dayW > 0)) return null;
    const startIdx = Math.round(left / dayW);
    const endIdx = Math.round((total - right) / dayW) - 1;
    if (endIdx < startIdx) return null;
    return { start: model.dateAt(startIdx), end: model.dateAt(endIdx), source: "pixel" };
  }

  function countWorkdays(start, end) {
    let n = 0;
    for (let d = start; d <= end; d = addDays(d, 1)) if (!offInfo(d)) n++;
    return n;
  }

  /** 경고 아이콘 SVG 를 DOM API 로 생성 (innerHTML 미사용) */
  function makeWarnIcon(kind) {
    const NS = "http://www.w3.org/2000/svg";
    const span = document.createElement("span");
    span.className = "jwm-warn-icon";
    span.dataset.jwmDue = kind;
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 0 16 16");
    svg.setAttribute("width", "12");
    svg.setAttribute("height", "12");
    svg.setAttribute("aria-hidden", "true");
    const path = document.createElementNS(NS, "path");
    path.setAttribute("fill", "currentColor");
    path.setAttribute("d", "M6.24 1.17c.76-1.4 2.76-1.4 3.52 0l5.9 10.88c.72 1.33-.24 2.95-1.76 2.95H2.1C.58 15-.38 13.38.34 12.05zM8 10.75a1 1 0 1 0 0 2 1 1 0 0 0 0-2M7.25 4.5v5h1.5v-5z");
    svg.appendChild(path);
    span.appendChild(svg);
    return span;
  }

  /** 행이 완료(해결)된 이슈인지: 이슈 키 링크의 취소선으로 판단 (언어 무관) */
  function isResolvedRow(bar) {
    const row = bar.closest(ROW_SELECTOR);
    const link = row && row.querySelector(KEY_LINK_SELECTOR);
    if (!link) return false;
    try {
      return getComputedStyle(link).textDecorationLine.includes("line-through");
    } catch (e) {
      return false;
    }
  }

  /** 마감 경고 판정: 기한 초과 또는 오늘부터 N 근무일 이내 */
  function dueStatus(end, today) {
    const parsed = parseInt(settings.dueWarnDays, 10);
    const days = Number.isFinite(parsed) ? Math.max(0, parsed) : DEFAULTS.dueWarnDays;
    const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    if (end < t0) {
      const overdue = Math.round((t0 - end) / 86400000);
      return { kind: "overdue", n: overdue, title: fmt(t.dueOverdueTitle, { date: iso(end), n: overdue }) };
    }
    const remaining = end.getTime() === t0.getTime() ? 0 : countWorkdays(addDays(t0, 1), end);
    if (remaining <= days) {
      return { kind: "soon", n: remaining, title: fmt(t.dueSoonTitle, { date: iso(end), n: remaining }) };
    }
    return null;
  }

  function applyBars(model) {
    const wantBadge = settings.showWorkdays || settings.dueWarning;
    const today = model.anchor.date;
    document.querySelectorAll(BAR_SELECTOR).forEach((bar) => {
      observeBar(bar);
      let badge = bar.querySelector(`:scope > .${BADGE_CLASS}`);
      const dates = wantBadge ? barDates(bar, model) : null;
      const due = dates && settings.dueWarning && !isResolvedRow(bar) ? dueStatus(dates.end, today) : null;
      const workdays = dates && settings.showWorkdays ? countWorkdays(dates.start, dates.end) : null;
      if (!dates || (!due && workdays === null)) {
        if (badge) badge.remove();
        bar.classList.remove(DUE_CLASS);
        return;
      }
      const key = `${iso(dates.start)}|${iso(dates.end)}|${workdays}|${due ? due.kind + due.n : ""}|${locale.lang}`;
      if (!badge) {
        badge = document.createElement("span");
        badge.className = BADGE_CLASS;
        bar.appendChild(badge);
      }
      if (badge.dataset.jwmKey !== key) {
        badge.dataset.jwmKey = key;
        const titles = [];
        badge.replaceChildren();
        if (due) {
          badge.appendChild(makeWarnIcon(due.kind));
          titles.push(due.title);
        }
        if (workdays !== null) {
          const daysEl = document.createElement("span");
          daysEl.className = "jwm-days";
          daysEl.textContent = fmt(t.workdaysShort, { n: workdays });
          badge.appendChild(daysEl);
          titles.push(fmt(t.workdaysTitle, { n: workdays, from: iso(dates.start), to: iso(dates.end) }));
        }
        badge.title = titles.join("\n");
      }
      // 좁은 막대는 배지를 막대 바깥(오른쪽)으로
      const width = bar.getBoundingClientRect().width;
      badge.classList.toggle("jwm-badge-outside", width > 0 && width < 56);
      bar.classList.toggle(DUE_CLASS, !!due);
    });
  }

  const observedBars = new WeakSet();
  let barObserver = null;
  function observeBar(bar) {
    if (observedBars.has(bar)) return;
    observedBars.add(bar);
    if (!barObserver) {
      barObserver = new MutationObserver(() => schedule());
    }
    barObserver.observe(bar, { attributes: true, attributeFilter: ["style", "aria-label"], subtree: true });
  }

  /* ---------------------------------------------------------- DOM 적용 */
  function applyHeader(model) {
    for (const w of model.weeks) {
      const offByIdx = new Map(w.off.map((o) => [o.dayIndex, o]));
      w.days.forEach((cell, d) => {
        if (!cell) return;
        const o = offByIdx.get(d);
        if (o) {
          cell.el.classList.add(DAY_CLASS);
          cell.el.classList.remove(WORKDAY_CLASS);
          if (cell.el.dataset.jwmKind !== o.kind) cell.el.dataset.jwmKind = o.kind;
          const title = `${iso(o.date)} ${o.name}`;
          if (cell.el.title !== title) cell.el.title = title;
        } else {
          if (cell.el.classList.contains(DAY_CLASS)) {
            cell.el.classList.remove(DAY_CLASS);
            delete cell.el.dataset.jwmKind;
            cell.el.removeAttribute("title");
          }
          if (cell.workday) {
            cell.el.classList.add(WORKDAY_CLASS);
            const title = `${iso(cell.date)} ${t.workday}: ${cell.workday}`;
            if (cell.el.title !== title) cell.el.title = title;
          } else if (cell.el.classList.contains(WORKDAY_CLASS)) {
            cell.el.classList.remove(WORKDAY_CLASS);
            cell.el.removeAttribute("title");
          }
        }
      });
    }
  }

  function applyColumns(model) {
    const weeksByLeft = new Map();
    model.weeks.forEach((w) => w.byLeft && weeksByLeft.set(w.byLeft, w));
    const cols = document.querySelectorAll(`[data-testid^="${COL_PREFIX}"]`);
    cols.forEach((col) => {
      const key = leftKey(col);
      let week = key ? weeksByLeft.get(key) : null;
      if (!week) {
        const n = parseInt(col.dataset.testid.slice(COL_PREFIX.length), 10);
        week = model.weeks[n];
      }
      if (!week) return;
      syncShades(col, week.off);
    });
  }

  function syncShades(col, offs) {
    // 셀(th/td) 안의 오버레이인지, 테이블 뒤에 붙는 전체 높이 오버레이인지 표시 (덮기 모드에서 후자는 숨김)
    const scope = col.closest("th,td") ? "cell" : "table";
    const existing = new Map();
    col.querySelectorAll(`:scope > .${SHADE_CLASS}`).forEach((el) => existing.set(el.dataset.jwmD, el));
    const wanted = new Set();
    for (const o of offs) {
      const key = String(o.dayIndex);
      wanted.add(key);
      let el = existing.get(key);
      if (!el) {
        el = document.createElement("div");
        el.className = SHADE_CLASS;
        el.dataset.jwmD = key;
        el.style.left = `${(o.dayIndex / 7) * 100}%`;
        el.style.width = `${100 / 7}%`;
        col.appendChild(el);
      }
      if (el.dataset.jwmKind !== o.kind) el.dataset.jwmKind = o.kind;
      if (el.dataset.jwmScope !== scope) el.dataset.jwmScope = scope;
    }
    existing.forEach((el, key) => {
      if (!wanted.has(key)) el.remove();
    });
  }

  /* 덮기 모드: 각 이슈 행의 막대 컨테이너 안에 행 전용 음영을 넣는다.
   * Jira 의 주 단위 컬럼 오버레이(z-index:0)를 끌어올리면 고정(sticky) 열과 푸터 위까지 덮어 버리므로,
   * 막대(z-index:3)와 같은 컨테이너 안에 z-index:4 음영을 두어 막대와 똑같이 스크롤·클리핑되게 한다.
   * 성능을 위해 행마다 DIV 하나에 linear-gradient 로 모든 휴일 구간을 그린다. */
  function rowShadeGradient(model) {
    const stops = [];
    const unit = 100 / model.totalDays;
    for (const w of model.weeks) {
      for (const o of w.off) {
        const a = ((w.index * 7 + o.dayIndex) * unit).toFixed(4);
        const b = ((w.index * 7 + o.dayIndex + 1) * unit).toFixed(4);
        const c = o.kind === "holiday" ? "var(--jwm-rowshade-holiday)" : "var(--jwm-rowshade)";
        stops.push(`transparent ${a}%, ${c} ${a}%, ${c} ${b}%, transparent ${b}%`);
      }
    }
    return stops.length ? `linear-gradient(to right, ${stops.join(", ")})` : "none";
  }

  function applyRowShades(model) {
    const rows = document.querySelectorAll(ROW_SELECTOR);
    if (!settings.coverBars) {
      document.querySelectorAll(`.${ROWSHADE_CLASS}`).forEach((el) => el.remove());
      return;
    }
    const gradient = rowShadeGradient(model);
    rows.forEach((row) => {
      const bar = row.querySelector(BAR_SELECTOR);
      const wrapper = bar ? bar.parentElement : (row.lastElementChild && row.lastElementChild.firstElementChild);
      if (!wrapper || wrapper.tagName !== "DIV") return;
      let el = wrapper.querySelector(`:scope > .${ROWSHADE_CLASS}`);
      if (!el) {
        el = document.createElement("div");
        el.className = ROWSHADE_CLASS;
        wrapper.appendChild(el);
      }
      if (el.style.backgroundImage !== gradient) el.style.backgroundImage = gradient;
    });
  }

  function clearAll() {
    document.querySelectorAll(`.${SHADE_CLASS}, .${ROWSHADE_CLASS}`).forEach((el) => el.remove());
    document.querySelectorAll(`.${BADGE_CLASS}`).forEach((el) => el.remove());
    document.querySelectorAll(`.${DUE_CLASS}`).forEach((el) => el.classList.remove(DUE_CLASS));
    document.querySelectorAll(`.${DAY_CLASS}, .${WORKDAY_CLASS}`).forEach((el) => {
      el.classList.remove(DAY_CLASS, WORKDAY_CLASS);
      delete el.dataset.jwmKind;
      el.removeAttribute("title");
    });
  }

  function apply() {
    if (applying) return;
    applying = true;
    try {
      const root = document.documentElement;
      root.setAttribute("data-jwm-mode", settings.mode);
      if (settings.coverBars) root.setAttribute("data-jwm-cover", "1");
      else root.removeAttribute("data-jwm-cover");
      root.style.setProperty("--jwm-hl-rgb", hexToRgb(settings.highlightColor) || hexToRgb(DEFAULTS.highlightColor));
      const alpha = Number(settings.highlightAlpha);
      root.style.setProperty("--jwm-hl-alpha", String(Number.isFinite(alpha) ? Math.min(0.9, Math.max(0.02, alpha)) : DEFAULTS.highlightAlpha));
      root.style.setProperty("--jwm-warn", HEX_RE.test(settings.warnColor || "") ? settings.warnColor : DEFAULTS.warnColor);

      if (settings.mode === "off") {
        clearAll();
        return;
      }
      const model = buildWeekModel();
      if (!model) {
        clearAll();
        return;
      }
      applyHeader(model);
      applyColumns(model);
      applyRowShades(model);
      applyBars(model);
    } catch (e) {
      console.warn("[jwm] apply failed", e);
    } finally {
      applying = false;
    }
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    setTimeout(() => {
      scheduled = false;
      apply();
    }, 120);
  }

  /* ---------------------------------------------------------- 설정 / 감시 */
  const MODES = ["highlight", "mask", "off"];
  /** storage 에서 온 값을 신뢰하지 않고 타입/범위를 검증한다. */
  function sanitize(s) {
    const out = { ...s };
    if (!MODES.includes(out.mode)) out.mode = DEFAULTS.mode;
    if (typeof out.country !== "string" || !(out.country === "auto" || JWM_HOLIDAYS[out.country])) out.country = "auto";
    if (typeof out.language !== "string" || !(out.language === "auto" || JWM_LOCALES[out.language])) out.language = "auto";
    for (const k of ["useHolidays", "coverBars", "showWorkdays", "dueWarning"]) out[k] = Boolean(out[k]);
    out.customHolidays = typeof out.customHolidays === "string" ? out.customHolidays.slice(0, 20000) : "";
    const days = parseInt(out.dueWarnDays, 10);
    out.dueWarnDays = Number.isFinite(days) ? Math.min(60, Math.max(0, days)) : DEFAULTS.dueWarnDays;
    const alpha = Number(out.highlightAlpha);
    out.highlightAlpha = Number.isFinite(alpha) ? Math.min(0.9, Math.max(0.02, alpha)) : DEFAULTS.highlightAlpha;
    if (!HEX_RE.test(String(out.highlightColor))) out.highlightColor = DEFAULTS.highlightColor;
    if (!HEX_RE.test(String(out.warnColor))) out.warnColor = DEFAULTS.warnColor;
    return out;
  }

  function normalize(items) {
    const s = { ...DEFAULTS, ...items };
    // v1.0 → v1.1 migration
    if (typeof items.useKrHolidays === "boolean" && typeof items.useHolidays !== "boolean") s.useHolidays = items.useKrHolidays;
    return sanitize(s);
  }

  function loadSettings(cb) {
    if (!storage) {
      cb();
      return;
    }
    let done = false;
    const finish = (items) => {
      if (done) return;
      done = true;
      settings = normalize(items || {});
      cb();
    };
    try {
      const p = storage.get(null, finish);
      if (p && typeof p.then === "function") p.then(finish, () => finish({}));
    } catch (e) {
      finish({});
    }
  }

  function start() {
    rebuildHolidayMap();
    apply();

    const observer = new MutationObserver((records) => {
      // 우리가 삽입한 노드만 바뀐 경우는 무시
      const relevant = records.some((r) =>
        [...r.addedNodes, ...r.removedNodes].some(
          (n) => !(n.nodeType === 1 && n.classList && (n.classList.contains(SHADE_CLASS) || n.classList.contains(BADGE_CLASS) || n.classList.contains(ROWSHADE_CLASS)))
        )
      );
      if (relevant) schedule();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    if (ext && ext.storage && ext.storage.onChanged) {
      ext.storage.onChanged.addListener((changes, area) => {
        if (area !== "sync" && area !== "local") return;
        for (const k of Object.keys(changes)) {
          if (k in DEFAULTS) settings[k] = changes[k].newValue ?? DEFAULTS[k];
        }
        settings = sanitize(settings);
        rebuildHolidayMap();
        clearAll();
        apply();
      });
    }
    if (ext && ext.runtime && ext.runtime.onMessage) {
      ext.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
        if (msg && msg.type === "jwm:status") {
          const model = settings.mode === "off" ? null : buildWeekModel();
          sendResponse({
            weeks: model ? model.weeks.length : 0,
            anchor: model ? iso(model.anchor.date) : null,
            dayCells: document.querySelectorAll(`[data-testid^="${DAY_PREFIX}"]`).length,
            country: locale.country,
            lang: locale.lang
          });
        }
      });
    }
  }

  // 테스트용 훅: 확장으로 실행될 때(chrome.runtime.id 존재)는 페이지에 노출하지 않는다.
  const isExtensionContext = !!(ext && ext.runtime && ext.runtime.id);
  if (!isExtensionContext) window.__jwm = {
    apply,
    get locale() { return locale; },
    get settings() { return settings; },
    set settings(v) { settings = { ...settings, ...v }; rebuildHolidayMap(); }
  };

  loadSettings(start);
})();
