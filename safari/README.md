# Safari build

Safari runs the same WebExtension code (Manifest V3) but only installs extensions that are
wrapped in a native macOS app. Building that wrapper requires macOS and Xcode.

1. `./safari/build-safari.sh` — runs `xcrun safari-web-extension-converter` and creates an
   Xcode project under `safari/build/`.
2. Open the project in Xcode and press **Run**.
3. Safari ▸ Settings ▸ Extensions ▸ enable *Jira Timeline Weekend Marker*.
   For an unsigned build enable **Develop ▸ Allow Unsigned Extensions** first.
4. Visit your Jira site and allow access to `atlassian.net` when Safari asks.

Notes
- `storage.sync` behaves like local storage in Safari (no cross-device sync).
- To distribute outside your own Mac, sign the app with an Apple Developer account
  (Xcode ▸ Signing & Capabilities) or submit it to the App Store.
