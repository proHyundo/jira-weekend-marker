#!/usr/bin/env bash
# Wrap the WebExtension in a Safari (macOS) app using Xcode's converter.
# Requires macOS with Xcode installed.
#   ./safari/build-safari.sh            -> creates safari/build/<project> and opens it in Xcode
#   ./safari/build-safari.sh --no-open  -> create only (used by CI)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/safari/build"
OPEN_FLAG=""
[[ "${1:-}" == "--no-open" ]] && OPEN_FLAG="--no-open"

if ! command -v xcrun >/dev/null 2>&1; then
  echo "xcrun not found. Install Xcode from the App Store first." >&2
  exit 1
fi

rm -rf "$OUT"
mkdir -p "$OUT"
xcrun safari-web-extension-converter "$ROOT" \
  --project-location "$OUT" \
  --app-name "Jira Timeline Weekend Marker" \
  --bundle-identifier "com.prohyundo.jira-weekend-marker" \
  --macos-only \
  --copy-resources \
  --force \
  $OPEN_FLAG

echo
echo "Xcode project created under: $OUT"
echo "Open it in Xcode and press Run; then enable the extension in Safari > Settings > Extensions."
echo "For an unsigned build, first turn on Safari > Develop > Allow Unsigned Extensions."
