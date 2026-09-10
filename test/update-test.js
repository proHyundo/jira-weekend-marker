// Node-only unit test for the release check in background.js (no browser needed).
// A fake `chrome` namespace and a fake `fetch` are installed before the file is evaluated.
const fs = require("fs"); const path = require("path"); const vm = require("vm");
const assert = (cond, msg) => { if (!cond) { console.error("FAIL:", msg); process.exitCode = 1; } else console.log("ok:", msg); };

function makeEnv({ version = "0.0.7", checkUpdates = true, release, status = 200, local = {} } = {}) {
  const sync = { checkUpdates };
  const localStore = { ...local };
  const badges = [];
  const alarms = {};
  const listeners = { onInstalled: [], onStartup: [], onAlarm: [], onChanged: [], onMessage: [] };
  const chrome = {
    runtime: {
      getManifest: () => ({ version }),
      onInstalled: { addListener: (f) => listeners.onInstalled.push(f) },
      onStartup: { addListener: (f) => listeners.onStartup.push(f) },
      onMessage: { addListener: (f) => listeners.onMessage.push(f) }
    },
    storage: {
      sync: { get: (d, cb) => cb({ ...d, ...sync }), set: (o, cb) => { Object.assign(sync, o); cb && cb(); } },
      local: { get: (d, cb) => cb({ ...d, ...localStore }), set: (o, cb) => { Object.assign(localStore, o); cb && cb(); } },
      onChanged: { addListener: (f) => listeners.onChanged.push(f) }
    },
    alarms: {
      get: (name, cb) => cb(alarms[name]),
      create: (name, info) => { alarms[name] = { name, ...info }; },
      onAlarm: { addListener: (f) => listeners.onAlarm.push(f) }
    },
    action: { setBadgeText: ({ text }) => badges.push(text), setBadgeBackgroundColor: () => {} }
  };
  const fetchCalls = [];
  const fetch = async (url, opts) => {
    fetchCalls.push({ url, opts });
    return { ok: status >= 200 && status < 300, status, json: async () => release };
  };
  const ctx = vm.createContext({ chrome, fetch, console, setTimeout, Promise, Date, Error, String, Math, parseInt, Number, Object, Array, RegExp });
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "background.js"), "utf8"), ctx, { filename: "background.js" });
  const send = (msg) => new Promise((resolve) => { listeners.onMessage[0](msg, {}, resolve); });
  return { chrome, sync, localStore, badges, alarms, listeners, fetchCalls, send };
}

(async () => {
  // 1. newer release -> badge + stored state
  let env = makeEnv({ version: "0.0.7", release: { tag_name: "v0.1.0", html_url: "https://github.com/proHyundo/jira-weekend-marker/releases/tag/v0.1.0" } });
  let r = await env.send({ type: "jwm:checkUpdate", force: true });
  assert(r.enabled && r.latestVersion === "0.1.0" && r.latestUrl.endsWith("/tag/v0.1.0"), "newer release reported: " + JSON.stringify(r));
  assert(env.badges.includes("NEW"), "badge NEW shown for newer release");
  assert(env.localStore.notifiedVersion === "0.1.0", "notifiedVersion stored");
  assert(env.fetchCalls[0].url === "https://api.github.com/repos/proHyundo/jira-weekend-marker/releases/latest", "fetches GitHub latest-release endpoint");
  assert(env.fetchCalls[0].opts.credentials === "omit", "fetch sends no credentials");
  // second check within the staleness window -> no new fetch, no second badge
  env.badges.length = 0;
  r = await env.send({ type: "jwm:checkUpdate", force: false });
  assert(env.fetchCalls.length === 1 && r.latestVersion === "0.1.0", "cached result reused within 20h");
  assert(env.badges.length === 0, "no repeated badge for the same version");

  // 2. same version -> no badge, no update
  env = makeEnv({ version: "0.0.7", release: { tag_name: "v0.0.7", html_url: "https://github.com/proHyundo/jira-weekend-marker/releases/tag/v0.0.7" } });
  r = await env.send({ type: "jwm:checkUpdate", force: true });
  assert(r.latestVersion === "0.0.7" && !env.badges.includes("NEW"), "same version -> no badge");

  // 3. older release than installed (e.g. dev build) -> no badge
  env = makeEnv({ version: "0.1.0", release: { tag_name: "v0.0.9", html_url: "https://github.com/proHyundo/jira-weekend-marker/releases/tag/v0.0.9" } });
  r = await env.send({ type: "jwm:checkUpdate", force: true });
  assert(!env.badges.includes("NEW"), "older release -> no badge");

  // 4. option off -> no fetch, cache cleared
  env = makeEnv({ checkUpdates: false, release: { tag_name: "v9.9.9" }, local: { latestVersion: "9.9.9", latestUrl: "x" } });
  r = await env.send({ type: "jwm:checkUpdate", force: true });
  assert(r.enabled === false && env.fetchCalls.length === 0 && env.localStore.latestVersion === "", "disabled -> no fetch, cache cleared");

  // 5. malformed tag / foreign URL -> ignored / replaced
  env = makeEnv({ release: { tag_name: "latest-build", html_url: "https://evil.example/x" } });
  r = await env.send({ type: "jwm:checkUpdate", force: true });
  assert(!r.latestVersion && !env.badges.includes("NEW"), "malformed tag ignored");
  env = makeEnv({ release: { tag_name: "v0.2.0", html_url: "https://evil.example/x" } });
  r = await env.send({ type: "jwm:checkUpdate", force: true });
  assert(r.latestUrl === "https://github.com/proHyundo/jira-weekend-marker/releases/tag/v0.2.0", "foreign html_url replaced by repo release URL");

  // 6. HTTP error -> error reported, previous state kept
  env = makeEnv({ status: 403, release: {}, local: { latestVersion: "0.0.8", latestUrl: "https://github.com/proHyundo/jira-weekend-marker/releases/tag/v0.0.8" } });
  r = await env.send({ type: "jwm:checkUpdate", force: true });
  assert(r.error && r.latestVersion === "0.0.8", "HTTP error keeps previous state: " + r.error);

  // 7. install / update hooks
  env = makeEnv({ release: { tag_name: "v0.0.7" } });
  env.listeners.onInstalled[0]({ reason: "update", previousVersion: "0.0.6" });
  await new Promise((r) => setTimeout(r, 10)); // alarm scheduling is async
  assert(env.badges.includes("NEW") && env.localStore.seenVersion === null && env.localStore.updatedFrom === "0.0.6", "update event -> NEW badge + what's-new state");
  assert(env.alarms["jwm-update-check"] && env.alarms["jwm-update-check"].periodInMinutes === 1440, "daily alarm scheduled on install");
  env.badges.length = 0;
  env.listeners.onAlarm[0]({ name: "jwm-update-check" });
  await new Promise((r) => setTimeout(r, 10));
  assert(env.fetchCalls.length === 1, "alarm triggers a check");
  // toggling the option on triggers an immediate check
  env.localStore.latestCheckedAt = Date.now();
  env.listeners.onChanged[0]({ checkUpdates: { newValue: true } }, "sync");
  await new Promise((r) => setTimeout(r, 10));
  assert(env.fetchCalls.length === 2, "enabling the option forces a check");
  console.log("done");
})();
