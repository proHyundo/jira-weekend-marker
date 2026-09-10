/* Background service worker.
 *
 * 1. After the browser updates the extension, mark the toolbar icon with a
 *    "NEW" badge; the popup then shows a "What's new" link until it has been
 *    opened once.
 * 2. Once a day (chrome.alarms) ask GitHub for the latest release and, if it is
 *    newer than the installed version, show the badge and let the popup offer a
 *    download link. Unpacked / side-loaded installs never auto-update, so this
 *    is the only way existing users learn that a new version exists.
 *    The check can be turned off in the popup (setting `checkUpdates`).
 *    Only the tag name and the release page URL are read from the response; both
 *    are validated before being stored.
 */
// Prefer the callback-style `chrome` namespace (also provided by Firefox and Safari);
// `call()` below accepts either callbacks or returned promises.
const api = typeof chrome !== "undefined" && chrome.runtime ? chrome : browser;

const REPO = "proHyundo/jira-weekend-marker";
const LATEST_API = `https://api.github.com/repos/${REPO}/releases/latest`;
const RELEASE_URL_PREFIX = `https://github.com/${REPO}/releases/`;
const ALARM = "jwm-update-check";
const PERIOD_MIN = 24 * 60;          // once a day
const STALE_MS = 20 * 60 * 60 * 1000; // popup-triggered check only if the last one is older than this
const VERSION_RE = /^v?(\d+(?:\.\d+){0,3})$/;

const settingsStore = api.storage.sync || api.storage.local;

function currentVersion() {
  return String(api.runtime.getManifest().version);
}

function compareVersions(a, b) {
  const pa = String(a).split(".").map((n) => parseInt(n, 10) || 0);
  const pb = String(b).split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d > 0 ? 1 : -1;
  }
  return 0;
}

function setBadge(text) {
  try {
    api.action.setBadgeText({ text });
    if (text) api.action.setBadgeBackgroundColor({ color: "#de350b" });
  } catch (e) {
    /* action API unavailable in this browser */
  }
}

/** Run an extension API call that may either take a callback or return a promise. */
const call = (invoke) =>
  new Promise((resolve, reject) => {
    let r;
    try {
      r = invoke((v) => resolve(v));
    } catch (e) {
      reject(e);
      return;
    }
    if (r && typeof r.then === "function") r.then(resolve, reject);
  });
const localGet = (defaults) => call((cb) => api.storage.local.get(defaults, cb)).then((v) => v || defaults);
const localSet = (obj) => call((cb) => api.storage.local.set(obj, cb));
const settingsGet = (defaults) => call((cb) => settingsStore.get(defaults, cb)).then((v) => v || defaults);

/** Query GitHub for the latest release. Returns { version, url } or null. */
async function fetchLatest() {
  const res = await fetch(LATEST_API, {
    headers: { Accept: "application/vnd.github+json" },
    cache: "no-store",
    credentials: "omit",
    redirect: "follow"
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  const m = VERSION_RE.exec(String(data && data.tag_name || "").trim());
  if (!m) return null;
  const url = String(data.html_url || "");
  return {
    version: m[1],
    url: url.startsWith(RELEASE_URL_PREFIX) ? url : `${RELEASE_URL_PREFIX}tag/v${m[1]}`
  };
}

/**
 * Check for a newer release. `force` skips the staleness test.
 * Returns the state the popup needs: { enabled, latestVersion, latestUrl, checkedAt, error }.
 */
async function checkForUpdate(force) {
  const { checkUpdates } = await settingsGet({ checkUpdates: true });
  const state = await localGet({ latestVersion: "", latestUrl: "", latestCheckedAt: 0, notifiedVersion: "" });
  if (checkUpdates === false) {
    if (state.latestVersion) await localSet({ latestVersion: "", latestUrl: "", latestCheckedAt: 0 });
    return { enabled: false };
  }
  const now = Date.now();
  if (!force && state.latestCheckedAt && now - state.latestCheckedAt < STALE_MS) {
    return { enabled: true, latestVersion: state.latestVersion, latestUrl: state.latestUrl, checkedAt: state.latestCheckedAt };
  }
  try {
    const latest = await fetchLatest();
    const patch = { latestCheckedAt: now };
    if (latest) {
      patch.latestVersion = latest.version;
      patch.latestUrl = latest.url;
      if (compareVersions(latest.version, currentVersion()) > 0 && state.notifiedVersion !== latest.version) {
        patch.notifiedVersion = latest.version;
        setBadge("NEW");
      }
    }
    await localSet(patch);
    return { enabled: true, latestVersion: patch.latestVersion || state.latestVersion, latestUrl: patch.latestUrl || state.latestUrl, checkedAt: now };
  } catch (e) {
    return { enabled: true, latestVersion: state.latestVersion, latestUrl: state.latestUrl, checkedAt: state.latestCheckedAt, error: String(e && e.message || e) };
  }
}

function scheduleChecks() {
  if (!api.alarms) return;
  call((cb) => api.alarms.get(ALARM, cb)).then((existing) => {
    if (!existing) api.alarms.create(ALARM, { delayInMinutes: 1, periodInMinutes: PERIOD_MIN });
  }, () => {});
}

api.runtime.onInstalled.addListener((details) => {
  const version = currentVersion();
  if (details.reason === "update") {
    api.storage.local.set({ seenVersion: null, updatedFrom: details.previousVersion || "" });
    setBadge("NEW");
  } else {
    api.storage.local.set({ seenVersion: version });
  }
  // A freshly installed/updated build is the newest we know of: reset the release cache.
  api.storage.local.set({ latestVersion: "", latestUrl: "", latestCheckedAt: 0, notifiedVersion: "" });
  scheduleChecks();
});

api.runtime.onStartup.addListener(scheduleChecks);

if (api.alarms) {
  api.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === ALARM) checkForUpdate(false);
  });
}

// Turning the option on in the popup triggers an immediate check; turning it off clears the cache.
if (api.storage.onChanged) {
  api.storage.onChanged.addListener((changes, area) => {
    if ((area === "sync" || area === "local") && changes.checkUpdates) checkForUpdate(true);
  });
}

api.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === "jwm:checkUpdate") {
    checkForUpdate(!!msg.force).then(sendResponse, (e) => sendResponse({ enabled: true, error: String(e) }));
    return true; // async response
  }
  return false;
});
