# Security & Privacy

## What the extension can access

| Permission | Why |
|---|---|
| `storage` | Saves your settings (mode, country, colors, custom days off). Synced through the browser profile (`storage.sync`); nothing leaves the browser otherwise. |
| `alarms` | Schedules the once-a-day new-version check (see below). |
| Host access `https://*.atlassian.net/jira/*` | The content script must read the timeline DOM on Jira Cloud pages. It is **not** injected on Confluence (`/wiki/`), Bitbucket or any other site. |

No other permissions are requested: no `tabs`, `webRequest`, `cookies`, `notifications`, `scripting`, and no `web_accessible_resources`.

## What it does with data

- It reads only the timeline header cells and issue-bar positions/labels that are already visible on the page, and computes dates locally.
- Its **only network request** is the new-version check: once a day (and when the popup is opened after more than 20 hours) the background worker fetches `https://api.github.com/repos/proHyundo/jira-weekend-marker/releases/latest` with `credentials: "omit"`. The request carries no identifier, no settings and no page data; only the release tag and the release page URL are read from the response, and both are validated (`vX.Y.Z` pattern, URL must be under `github.com/proHyundo/jira-weekend-marker/`) before being stored. The check can be disabled in the popup (*Check for new versions*). There is no analytics, no telemetry, no remote holiday feed. Holiday data is bundled in `holidays.js`.
- Settings are the only stored data. Custom day names are shown back to you as tooltips only.
- The popup's "What's new" and "New version available" links open the GitHub release page in a new tab (`rel="noopener"`). Downloads are never performed by the extension itself.

## Hardening measures in the code

- Manifest V3 with the default extension CSP (no inline scripts, no `eval`).
- No `innerHTML`: all injected elements (shading, badges, SVG icon) are built with DOM APIs; text comes through `textContent`/`title`.
- Every value read from `storage` is validated (`sanitize()` in `content.js`): mode/country/language are checked against allow-lists, colors must match `#rrggbb`, numbers are clamped, free text is length-limited.
- The debug hook `window.__jwm` is only exposed when the script is not running as an extension (i.e. in the test harness).
- `runtime.onMessage` only accepts messages from the extension itself; nothing is exposed to web pages (`externally_connectable` is not declared).
- GitHub Actions: third-party actions pinned to commit SHAs, `contents: write` granted only to the release job, checkout with `persist-credentials: false`.

## Reporting a vulnerability

Please open a GitHub issue (or contact the maintainer privately for sensitive reports) with steps to reproduce. Fixes are released as a new tagged version; existing users see a "NEW" badge on the toolbar icon when the daily check finds the new release, and again after updating.
