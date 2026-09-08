/* UI strings per language (shared by content script and popup).
 * Language is chosen from the selected country (KR→ko, US→en, CN→zh, IN→hi)
 * unless the user overrides it in the popup.
 */
// eslint-disable-next-line no-unused-vars
const JWM_LOCALES = {
  en: {
    barsLegend: "Issue bars",
    showWorkdays: "Show working-day count in bars",
    dueWarning: "Warn when the due date is a day off",
    colorsLegend: "Colors",
    highlightColor: "Highlight color",
    intensity: "Intensity",
    warnColor: "Warning color",
    reset: "Reset colors",
    workdaysShort: "{n}d",
    workdaysTitle: "{n} working days ({from} – {to}, weekends and holidays excluded)",
    dueOffTitle: "Due date {date} is a day off: {name}",
    regionLegend: "Country & language",
    _name: "English",
    title: "Jira Timeline Weekend Marker",
    country: "Country",
    countryAuto: "Auto (browser language)",
    language: "Language",
    languageAuto: "Auto (follow country)",
    modeLegend: "Display",
    modeHighlight: "Highlight in red",
    modeMask: "Hide from timeline (mask)",
    modeOff: "Off",
    optionsLegend: "Options",
    useHolidays: "Include public holidays",
    coverBars: "Cover issue bars too",
    customLegend: "Custom days off",
    customPlaceholder: "2026-12-31 Company workshop\n2027-01-02 Founding day",
    customHint: "One per line as YYYY-MM-DD name. Saved automatically.",
    customDefault: "Custom day off",
    saved: "Saved · applied to open Jira tabs.",
    notJira: "This tab is not a Jira page.",
    noTimeline: "Timeline not found in this tab yet (try reloading the page).",
    weeksOnly: "Works in the timeline's Weeks view only (Months/Quarters have no day cells).",
    noAnchor: "Found {n} day cells but could not determine the date anchor.",
    detected: "Detected {weeks} weeks · anchor {anchor}",
    saturday: "Saturday",
    sunday: "Sunday",
    workday: "Working day",
    countries: { KR: "South Korea", US: "United States", CN: "China", IN: "India" }
  },
  ko: {
    barsLegend: "이슈 막대",
    showWorkdays: "막대에 근무일 수 표시",
    dueWarning: "기한이 주말·공휴일이면 경고",
    colorsLegend: "색상",
    highlightColor: "강조 색상",
    intensity: "강도",
    warnColor: "경고 색상",
    reset: "색상 초기화",
    workdaysShort: "{n}일",
    workdaysTitle: "근무일 {n}일 ({from} ~ {to}, 주말·휴일 제외)",
    dueOffTitle: "기한 {date}은(는) 휴일입니다: {name}",
    regionLegend: "국가 · 언어",
    _name: "한국어",
    title: "Jira Timeline Weekend Marker",
    country: "국가",
    countryAuto: "자동 (브라우저 언어)",
    language: "언어",
    languageAuto: "자동 (국가에 따름)",
    modeLegend: "표시 방식",
    modeHighlight: "빨갛게 강조",
    modeMask: "화면에서 가리기(마스킹)",
    modeOff: "끄기",
    optionsLegend: "옵션",
    useHolidays: "공휴일 포함",
    coverBars: "이슈 막대 위까지 덮기",
    customLegend: "사용자 지정 휴일",
    customPlaceholder: "2026-12-31 워크숍\n2027-01-02 창립기념일",
    customHint: "한 줄에 하나씩 YYYY-MM-DD 이름 형식. 저장은 자동입니다.",
    customDefault: "사용자 지정 휴일",
    saved: "저장됨 · 열려 있는 Jira 탭에 바로 반영됩니다.",
    notJira: "현재 탭은 Jira 페이지가 아닙니다.",
    noTimeline: "이 탭에서 타임라인을 아직 찾지 못했습니다. (페이지 새로고침 필요할 수 있음)",
    weeksOnly: "타임라인의 '주' 단위 보기에서만 동작합니다. (월/분기 보기는 요일 셀이 없음)",
    noAnchor: "요일 셀 {n}개를 찾았지만 날짜 기준점을 계산하지 못했습니다.",
    detected: "감지: {weeks}주 · 기준일 {anchor}",
    saturday: "토요일",
    sunday: "일요일",
    workday: "근무일",
    countries: { KR: "대한민국", US: "미국", CN: "중국", IN: "인도" }
  },
  zh: {
    barsLegend: "任务条",
    showWorkdays: "在任务条中显示工作日数",
    dueWarning: "截止日为休息日时警告",
    colorsLegend: "颜色",
    highlightColor: "高亮颜色",
    intensity: "强度",
    warnColor: "警告颜色",
    reset: "重置颜色",
    workdaysShort: "{n}天",
    workdaysTitle: "{n} 个工作日（{from} – {to}，不含周末和节假日）",
    dueOffTitle: "截止日 {date} 为休息日：{name}",
    regionLegend: "国家与语言",
    _name: "中文",
    title: "Jira Timeline Weekend Marker",
    country: "国家/地区",
    countryAuto: "自动（浏览器语言）",
    language: "语言",
    languageAuto: "自动（跟随国家）",
    modeLegend: "显示方式",
    modeHighlight: "红色高亮",
    modeMask: "从时间线中隐藏（遮罩）",
    modeOff: "关闭",
    optionsLegend: "选项",
    useHolidays: "包含法定节假日",
    coverBars: "同时覆盖任务条",
    customLegend: "自定义休息日",
    customPlaceholder: "2026-12-31 公司团建\n2027-01-02 司庆日",
    customHint: "每行一个，格式 YYYY-MM-DD 名称。自动保存。",
    customDefault: "自定义休息日",
    saved: "已保存 · 已应用到打开的 Jira 标签页。",
    notJira: "当前标签页不是 Jira 页面。",
    noTimeline: "尚未在此标签页中找到时间线（请尝试刷新页面）。",
    weeksOnly: "仅在时间线的“周”视图中生效（月/季度视图没有日期单元格）。",
    noAnchor: "找到 {n} 个日期单元格，但无法确定日期基准。",
    detected: "已识别 {weeks} 周 · 基准日 {anchor}",
    saturday: "星期六",
    sunday: "星期日",
    workday: "工作日",
    countries: { KR: "韩国", US: "美国", CN: "中国", IN: "印度" }
  },
  hi: {
    barsLegend: "इश्यू बार",
    showWorkdays: "बार में कार्यदिवसों की संख्या दिखाएँ",
    dueWarning: "नियत तिथि अवकाश पर हो तो चेतावनी दें",
    colorsLegend: "रंग",
    highlightColor: "हाइलाइट रंग",
    intensity: "तीव्रता",
    warnColor: "चेतावनी रंग",
    reset: "रंग रीसेट करें",
    workdaysShort: "{n} दिन",
    workdaysTitle: "{n} कार्यदिवस ({from} – {to}, सप्ताहांत और अवकाश छोड़कर)",
    dueOffTitle: "नियत तिथि {date} अवकाश है: {name}",
    regionLegend: "देश और भाषा",
    _name: "हिन्दी",
    title: "Jira Timeline Weekend Marker",
    country: "देश",
    countryAuto: "स्वचालित (ब्राउज़र भाषा)",
    language: "भाषा",
    languageAuto: "स्वचालित (देश के अनुसार)",
    modeLegend: "प्रदर्शन",
    modeHighlight: "लाल रंग में हाइलाइट करें",
    modeMask: "टाइमलाइन से छिपाएँ (मास्क)",
    modeOff: "बंद",
    optionsLegend: "विकल्प",
    useHolidays: "सार्वजनिक अवकाश शामिल करें",
    coverBars: "इश्यू बार को भी ढकें",
    customLegend: "कस्टम अवकाश",
    customPlaceholder: "2026-12-31 कंपनी वर्कशॉप\n2027-01-02 स्थापना दिवस",
    customHint: "प्रति पंक्ति एक, प्रारूप YYYY-MM-DD नाम। स्वतः सहेजा जाता है।",
    customDefault: "कस्टम अवकाश",
    saved: "सहेजा गया · खुले Jira टैब पर लागू।",
    notJira: "यह टैब Jira पेज नहीं है।",
    noTimeline: "इस टैब में टाइमलाइन अभी नहीं मिली (पेज रीलोड करके देखें)।",
    weeksOnly: "केवल टाइमलाइन के 'सप्ताह' दृश्य में काम करता है (माह/तिमाही दृश्य में दिन सेल नहीं होते)।",
    noAnchor: "{n} दिन सेल मिले, लेकिन तिथि संदर्भ तय नहीं हो सका।",
    detected: "पहचाना गया: {weeks} सप्ताह · संदर्भ तिथि {anchor}",
    saturday: "शनिवार",
    sunday: "रविवार",
    workday: "कार्यदिवस",
    countries: { KR: "दक्षिण कोरिया", US: "संयुक्त राज्य अमेरिका", CN: "चीन", IN: "भारत" }
  }
};

const JWM_COUNTRY_LANG = { KR: "ko", US: "en", CN: "zh", IN: "hi" };

/** Detect a default country from the browser language; falls back to US. */
// eslint-disable-next-line no-unused-vars
function jwmDetectCountry() {
  try {
    const raw = (navigator.language || (navigator.languages && navigator.languages[0]) || "").toLowerCase();
    if (!raw) return "US";
    if (raw.startsWith("ko")) return "KR";
    if (raw.startsWith("zh")) return "CN";
    if (raw.startsWith("hi") || raw.endsWith("-in")) return "IN";
    return "US";
  } catch (e) {
    return "US";
  }
}

/** Resolve effective country / language from settings. */
// eslint-disable-next-line no-unused-vars
function jwmResolveLocale(settings) {
  const country = settings.country && JWM_HOLIDAYS[settings.country] ? settings.country : jwmDetectCountry();
  const lang = settings.language && JWM_LOCALES[settings.language] ? settings.language : (JWM_COUNTRY_LANG[country] || "en");
  return { country, lang, t: JWM_LOCALES[lang] || JWM_LOCALES.en };
}
