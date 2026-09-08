/* global JWM_LOCALES, JWM_HOLIDAYS, jwmResolveLocale, jwmDetectCountry */
const DEFAULTS = {
  mode: "highlight",
  country: "auto",
  language: "auto",
  useHolidays: true,
  coverBars: false,
  customHolidays: ""
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

storage.get(null, (items) => {
  const s = { ...DEFAULTS, ...(items || {}) };
  if (typeof items?.useKrHolidays === "boolean" && typeof items?.useHolidays !== "boolean") s.useHolidays = items.useKrHolidays;
  settings = s;
  render();
  refreshStatus();
});

$("#country").addEventListener("change", (e) => save({ country: e.target.value }));
$("#language").addEventListener("change", (e) => save({ language: e.target.value }));
document.querySelectorAll('input[name="mode"]').forEach((r) =>
  r.addEventListener("change", () => r.checked && save({ mode: r.value }))
);
$("#useHolidays").addEventListener("change", (e) => save({ useHolidays: e.target.checked }));
$("#coverBars").addEventListener("change", (e) => save({ coverBars: e.target.checked }));

let timer;
$("#customHolidays").addEventListener("input", (e) => {
  clearTimeout(timer);
  const value = e.target.value;
  timer = setTimeout(() => save({ customHolidays: value }), 400);
});
