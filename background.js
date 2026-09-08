/* Background service worker: mark the toolbar icon after an update so existing
 * users notice the new version. The popup clears the badge and shows a
 * "What's new" link until the version has been seen once. */
const api = typeof browser !== "undefined" && browser.runtime ? browser : chrome;

api.runtime.onInstalled.addListener((details) => {
  const version = api.runtime.getManifest().version;
  if (details.reason !== "update") {
    api.storage.local.set({ seenVersion: version });
    return;
  }
  api.storage.local.set({ seenVersion: null, updatedFrom: details.previousVersion || "" });
  try {
    api.action.setBadgeText({ text: "NEW" });
    api.action.setBadgeBackgroundColor({ color: "#de350b" });
  } catch (e) {
    /* action API unavailable in this browser */
  }
});
