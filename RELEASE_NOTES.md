# Jira Timeline Weekend Marker v0.0.1

Highlights or hides weekend and public-holiday columns in the Jira Cloud timeline (Weeks view).

## What's new

- **Four countries**: South Korea, United States, China, India — auto-selected from the browser language (fallback: US), changeable in the popup.
- **Four UI languages**: English, 한국어, 中文, हिन्दी — follows the selected country, can be overridden.
- **Holiday calendars through 2028** (KR substitute holidays and 2026 new holidays, US federal holidays by rule, CN State Council schedules incl. 调休 working weekends, IN DoPT gazetted holidays). 2027–2028 dates for CN/IN are provisional until official notices are published.
- Cross-browser packaging for Chrome, Edge and Safari; localized store listing.

## Downloads

| File | Browser | OS | Install |
|---|---|---|---|
| `jira-weekend-marker-0.0.1-chrome-edge.zip` | Chrome, Edge, other Chromium browsers | Windows / macOS / Linux | Unzip → `chrome://extensions` or `edge://extensions` → Developer mode → *Load unpacked* |
| `jira-weekend-marker-0.0.1-safari-source.zip` | Safari | macOS | Unzip → `./safari/build-safari.sh` → Run in Xcode → enable in Safari ▸ Settings ▸ Extensions |
| `jira-weekend-marker-0.0.1-safari-macos-app.zip` | Safari (unsigned app) | macOS | Unzip → open the app once → Safari ▸ Develop ▸ *Allow Unsigned Extensions* → enable in Settings ▸ Extensions |

## Notes

- Works in the timeline's **Weeks** zoom level only.
- Upgrading from the initial (untagged) build keeps your settings (`useKrHolidays` is migrated to `useHolidays`).
- Safari: `storage.sync` behaves like local storage; grant access to `atlassian.net` when prompted.

---

# Jira Timeline Weekend Marker v0.0.1 (한국어)

Jira Cloud 타임라인(주 단위 보기)에서 주말·공휴일 열을 빨갛게 강조하거나 화면에서 가립니다.

## 새로운 기능

- **4개 국가 지원**: 대한민국·미국·중국·인도. 브라우저 언어로 자동 선택되며(판별 불가 시 미국) 팝업에서 변경할 수 있습니다.
- **4개 UI 언어**: 한국어·English·中文·हिन्दी. 선택한 국가의 언어를 따르며 별도로 바꿀 수 있습니다.
- **2028년까지의 공휴일 데이터** (한국 대체공휴일·2026년 신설 휴일, 미국 연방 공휴일 규칙 계산, 중국 국무원 공지 및 조휴 근무일, 인도 DoPT 관보 휴일). 중국·인도의 2027~2028 날짜는 공식 발표 전까지 잠정치입니다.
- Chrome·Edge·Safari용 크로스 브라우저 패키징, 스토어 설명 다국어화.

## 다운로드

| 파일 | 브라우저 | OS | 설치 |
|---|---|---|---|
| `jira-weekend-marker-0.0.1-chrome-edge.zip` | Chrome, Edge 등 Chromium 계열 | Windows / macOS / Linux | 압축 해제 → `chrome://extensions` 또는 `edge://extensions` → 개발자 모드 → *압축해제된 확장 프로그램을 로드* |
| `jira-weekend-marker-0.0.1-safari-source.zip` | Safari | macOS | 압축 해제 → `./safari/build-safari.sh` → Xcode에서 Run → Safari ▸ 설정 ▸ 확장 프로그램에서 활성화 |
| `jira-weekend-marker-0.0.1-safari-macos-app.zip` | Safari (미서명 앱) | macOS | 압축 해제 → 앱 한 번 실행 → Safari ▸ 개발자용 ▸ *서명되지 않은 확장 프로그램 허용* → 설정 ▸ 확장 프로그램에서 활성화 |

## 참고

- 타임라인의 **주(Weeks)** 단위 보기에서만 동작합니다.
- 초기(태그 없는) 빌드에서 업그레이드해도 설정이 유지됩니다(`useKrHolidays` → `useHolidays` 자동 이전).
- Safari에서는 `storage.sync`가 로컬 저장소처럼 동작하며, 처음 접속 시 `atlassian.net` 접근 권한을 허용해야 합니다.
