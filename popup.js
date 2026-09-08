const DEFAULTS = {
  mode: "highlight",
  useKrHolidays: true,
  coverBars: false,
  customHolidays: ""
};

const $ = (sel) => document.querySelector(sel);
const statusEl = $("#status");

function render(s) {
  document.querySelectorAll('input[name="mode"]').forEach((r) => (r.checked = r.value === s.mode));
  $("#useKrHolidays").checked = !!s.useKrHolidays;
  $("#coverBars").checked = !!s.coverBars;
  $("#customHolidays").value = s.customHolidays || "";
}

function save(patch) {
  chrome.storage.sync.set(patch, () => {
    statusEl.textContent = "저장됨 · 열려 있는 Jira 탭에 바로 반영됩니다.";
    setTimeout(refreshStatus, 400);
  });
}

async function refreshStatus() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !/^https:\/\/[^/]+\.(atlassian\.net|jira\.com)\//.test(tab.url || "")) {
      statusEl.textContent = "현재 탭은 Jira 페이지가 아닙니다.";
      return;
    }
    chrome.tabs.sendMessage(tab.id, { type: "jwm:status" }, (res) => {
      if (chrome.runtime.lastError || !res) {
        statusEl.textContent = "이 탭에서 타임라인을 아직 찾지 못했습니다. (페이지 새로고침 필요할 수 있음)";
        return;
      }
      if (!res.dayCells) {
        statusEl.textContent = "타임라인의 '주' 단위 보기에서만 동작합니다. (월/분기 보기는 요일 셀이 없음)";
      } else if (!res.weeks) {
        statusEl.textContent = `요일 셀 ${res.dayCells}개를 찾았지만 날짜 기준점을 계산하지 못했습니다.`;
      } else {
        statusEl.textContent = `감지: ${res.weeks}주 · 기준일 ${res.anchor}`;
      }
    });
  } catch (e) {
    statusEl.textContent = "";
  }
}

chrome.storage.sync.get(DEFAULTS, (items) => {
  render({ ...DEFAULTS, ...items });
  refreshStatus();
});

document.querySelectorAll('input[name="mode"]').forEach((r) =>
  r.addEventListener("change", () => r.checked && save({ mode: r.value }))
);
$("#useKrHolidays").addEventListener("change", (e) => save({ useKrHolidays: e.target.checked }));
$("#coverBars").addEventListener("change", (e) => save({ coverBars: e.target.checked }));

let t;
$("#customHolidays").addEventListener("input", (e) => {
  clearTimeout(t);
  t = setTimeout(() => save({ customHolidays: e.target.value }), 400);
});
