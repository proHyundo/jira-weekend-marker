/* global JWM_LOCALES, JWM_HOLIDAYS, jwmResolveLocale, jwmDetectCountry */
const DEFAULTS = {
  mode: "highlight",
  country: "auto",
  language: "auto",
  useHolidays: true,
  coverBars: false,
  customHolidays: "",
  showWorkdays: true,
  dueWarning: true,
  dueWarnDays: 3,
  highlightColor: "#de350b",
  highlightAlpha: 0.12,
  warnColor: "#e2b203"
};
const COUNTRIES = ["KR", "US", "CN", "IN"];
const LANGS = ["en", "ko", "zh", "hi"];

const ext = typeof chrome !== "undefined" && chrome.storage ? chrome : browser;
const storage = ext.storage.sync || ext.storage.local;
const $ = (sel) => document.querySelector(sel);
const statusEl = $("#status");

let settings = { ...DEFAULTS };
let t = JWM_LOCALES.en;

function fmt(str, vars) {
  return String(str).replace(/\{(\w+)\}/g, (_, k) => (vars && k in vars ? vars[k] : ""));
}

function fillSelect(sel, entries, value) {
  sel.innerHTML = "";
  for (const [v, label] of entries) {
    const o = document.createElement("option");
    o.value = v;
    o.textContent = label;
    sel.appendChild(o);
  }
  sel.value = value;
}

function render() {
  const r = jwmResolveLocale(settings);
  t = r.t;
  document.documentElement.lang = r.lang;

  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.dataset.i18n;
    if (t[key]) el.textContent = t[key];
  });

  const detected = jwmDetectCountry();
  fillSelect(
    $("#country"),
    [["auto", `${t.countryAuto} · ${t.countries[detected]}`], ...COUNTRIES.map((c) => [c, t.countries[c]])],
    settings.country
  );
  fillSelect(
    $("#language"),
    [["auto", `${t.languageAuto} · ${JWM_LOCALES[r.lang]._name}`], ...LANGS.map((l) => [l, JWM_LOCALES[l]._name])],
    settings.language
  );

  document.querySelectorAll('input[name="mode"]').forEach((el) => (el.checked = el.value === settings.mode));
  $("#useHolidays").checked = !!settings.useHolidays;
  $("#coverBars").checked = !!settings.coverBars;
  $("#showWorkdays").checked = !!settings.showWorkdays;
  $("#dueWarning").checked = !!settings.dueWarning;
  const days = Number.isFinite(Number(settings.dueWarnDays)) ? Number(settings.dueWarnDays) : DEFAULTS.dueWarnDays;
  $("#dueWarnDays").value = days;
  $("#dueWarnDays").disabled = !settings.dueWarning;
  $("#dueWarnDaysLabel").textContent = fmt(t.dueWarnDays, { n: days });
  $("#highlightColor").value = settings.highlightColor || DEFAULTS.highlightColor;
  $("#warnColor").value = settings.warnColor || DEFAULTS.warnColor;
  const alpha = Number(settings.highlightAlpha) || DEFAULTS.highlightAlpha;
  $("#highlightAlpha").value = alpha;
  $("#highlightAlphaVal").textContent = `${Math.round(alpha * 100)}%`;
  const ta = $("#customHolidays");
  ta.placeholder = t.customPlaceholder;
  if (ta.value !== settings.customHolidays) ta.value = settings.customHolidays || "";
}

function save(patch) {
  Object.assign(settings, patch);
  storage.set(patch, () => {
    render();
    statusEl.textContent = t.saved;
    setTimeout(refreshStatus, 500);
  });
}

async function refreshStatus() {
  try {
    const [tab] = await ext.tabs.query({ active: true, currentWindow: true });
    if (!tab || !/^https:\/\/[^/]+\.(atlassian\.net|jira\.com)\//.test(tab.url || "")) {
      statusEl.textContent = t.notJira;
      return;
    }
    ext.tabs.sendMessage(tab.id, { type: "jwm:status" }, (res) => {
      if (ext.runtime.lastError || !res) {
        statusEl.textContent = t.noTimeline;
      } else if (!res.dayCells) {
        statusEl.textContent = t.weeksOnly;
      } else if (!res.weeks) {
        statusEl.textContent = fmt(t.noAnchor, { n: res.dayCells });
      } else {
        statusEl.textContent = fmt(t.detected, { weeks: res.weeks, anchor: res.anchor });
      }
    });
  } catch (e) {
    statusEl.textContent = "";
  }
}

// 업데이트 알림: background.js 가 남긴 표식을 확인해 "새 버전" 안내를 보여 주고 배지를 지운다
const RELEASES_URL = "https://github.com/proHyundo/jira-weekend-marker/releases/tag/v";
function showWhatsNew() {
  try {
    const version = ext.runtime.getManifest().version;
    ext.storage.local.get({ seenVersion: null, updatedFrom: "" }, (v) => {
      if (v.seenVersion !== version) {
        const box = $("#whatsnew");
        const link = $("#whatsnewLink");
        link.href = RELEASES_URL + version;
        link.textContent = fmt(JWM_LOCALES[jwmResolveLocale(settings).lang].updated, { v: version });
        box.hidden = false;
        link.addEventListener("click", () => {
          ext.storage.local.set({ seenVersion: version });
          box.hidden = true;
        });
        ext.storage.local.set({ seenVersion: version });
      }
      if (ext.action && ext.action.setBadgeText) ext.action.setBadgeText({ text: "" });
    });
  } catch (e) {
    /* ignore */
  }
}

storage.get(null, (items) => {
  const s = { ...DEFAULTS, ...(items || {}) };
  if (typeof items?.useKrHolidays === "boolean" && typeof items?.useHolidays !== "boolean") s.useHolidays = items.useKrHolidays;
  settings = s;
  render();
  refreshStatus();
  showWhatsNew();
});

$("#country").addEventListener("change", (e) => save({ country: e.target.value }));
$("#language").addEventListener("change", (e) => save({ language: e.target.value }));
document.querySelectorAll('input[name="mode"]').forEach((r) =>
  r.addEventListener("change", () => r.checked && save({ mode: r.value }))
);
$("#useHolidays").addEventListener("change", (e) => save({ useHolidays: e.target.checked }));
$("#coverBars").addEventListener("change", (e) => save({ coverBars: e.target.checked }));
$("#showWorkdays").addEventListener("change", (e) => save({ showWorkdays: e.target.checked }));
$("#dueWarning").addEventListener("change", (e) => save({ dueWarning: e.target.checked }));
$("#dueWarnDays").addEventListener("change", (e) => {
  const n = Math.max(0, Math.min(60, parseInt(e.target.value, 10) || 0));
  save({ dueWarnDays: n });
});
$("#highlightColor").addEventListener("change", (e) => save({ highlightColor: e.target.value }));
$("#warnColor").addEventListener("change", (e) => save({ warnColor: e.target.value }));
$("#highlightAlpha").addEventListener("input", (e) => {
  $("#highlightAlphaVal").textContent = `${Math.round(e.target.value * 100)}%`;
});
$("#highlightAlpha").addEventListener("change", (e) => save({ highlightAlpha: Number(e.target.value) }));
$("#resetColors").addEventListener("click", () =>
  save({ highlightColor: DEFAULTS.highlightColor, highlightAlpha: DEFAULTS.highlightAlpha, warnColor: DEFAULTS.warnColor })
);

let timer;
$("#customHolidays").addEventListener("input", (e) => {
  clearTimeout(timer);
  const value = e.target.value;
  timer = setTimeout(() => save({ customHolidays: value }), 400);
});
