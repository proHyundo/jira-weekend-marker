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

  const DEFAULTS = {
    mode: "highlight",        // "highlight" | "mask" | "off"
    useKrHolidays: true,      // 내장 한국 공휴일 사용
    coverBars: false,         // 음영을 막대 위에도 덮을지
    customHolidays: ""        // "YYYY-MM-DD 이름" 줄 단위
  };

  const hasChrome = typeof chrome !== "undefined" && chrome.storage && chrome.storage.sync;
  let settings = { ...DEFAULTS };
  let holidayMap = new Map();
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
    holidayMap = new Map();
    if (settings.useKrHolidays && typeof JWM_KR_HOLIDAYS === "object") {
      for (const [k, v] of Object.entries(JWM_KR_HOLIDAYS)) holidayMap.set(k, v);
    }
    String(settings.customHolidays || "")
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((line) => {
        const m = line.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})\s*(.*)$/);
        if (!m) return;
        const key = `${m[1]}-${pad(+m[2])}-${pad(+m[3])}`;
        holidayMap.set(key, m[4] || "사용자 지정 휴일");
      });
  }

  /** 날짜가 쉬는 날이면 { kind, name } 반환, 아니면 null */
  function offInfo(date) {
    const key = iso(date);
    const holiday = holidayMap.get(key);
    const dow = date.getDay();
    if (holiday) return { kind: "holiday", name: holiday };
    if (dow === 0 || dow === 6) return { kind: "weekend", name: dow === 6 ? "토요일" : "일요일" };
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
      }
    }
    return { weeks, anchor };
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
          if (cell.el.dataset.jwmKind !== o.kind) cell.el.dataset.jwmKind = o.kind;
          const title = `${iso(o.date)} ${o.name}`;
          if (cell.el.title !== title) cell.el.title = title;
        } else if (cell.el.classList.contains(DAY_CLASS)) {
          cell.el.classList.remove(DAY_CLASS);
          delete cell.el.dataset.jwmKind;
          cell.el.removeAttribute("title");
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
    }
    existing.forEach((el, key) => {
      if (!wanted.has(key)) el.remove();
    });
  }

  function clearAll() {
    document.querySelectorAll(`.${SHADE_CLASS}`).forEach((el) => el.remove());
    document.querySelectorAll(`.${DAY_CLASS}`).forEach((el) => {
      el.classList.remove(DAY_CLASS);
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
  function loadSettings(cb) {
    if (!hasChrome) {
      cb();
      return;
    }
    chrome.storage.sync.get(DEFAULTS, (items) => {
      settings = { ...DEFAULTS, ...items };
      cb();
    });
  }

  function start() {
    rebuildHolidayMap();
    apply();

    const observer = new MutationObserver((records) => {
      // 우리가 삽입한 노드만 바뀐 경우는 무시
      const relevant = records.some((r) =>
        [...r.addedNodes, ...r.removedNodes].some(
          (n) => !(n.nodeType === 1 && n.classList && n.classList.contains(SHADE_CLASS))
        )
      );
      if (relevant) schedule();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    if (hasChrome) {
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== "sync") return;
        for (const k of Object.keys(changes)) {
          if (k in DEFAULTS) settings[k] = changes[k].newValue ?? DEFAULTS[k];
        }
        rebuildHolidayMap();
        clearAll();
        apply();
      });
      chrome.runtime.onMessage?.addListener((msg, _sender, sendResponse) => {
        if (msg && msg.type === "jwm:status") {
          const model = settings.mode === "off" ? null : buildWeekModel();
          sendResponse({
            weeks: model ? model.weeks.length : 0,
            anchor: model ? iso(model.anchor.date) : null,
            dayCells: document.querySelectorAll(`[data-testid^="${DAY_PREFIX}"]`).length
          });
        }
      });
    }
  }

  // 테스트/디버깅용 훅
  window.__jwm = { apply, get settings() { return settings; }, set settings(v) { settings = { ...settings, ...v }; rebuildHolidayMap(); } };

  loadSettings(start);
})();
