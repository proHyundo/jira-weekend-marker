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

# Xcode 26's converter derives the parent app's bundle id from the app name
# (com.prohyundo.Jira-Timeline-Weekend-Marker) while the extension gets
# <bundle-identifier>.Extension, and xcodebuild then rejects the mismatch
# ("Embedded binary's bundle identifier is not prefixed with the parent app's").
# Normalise every PRODUCT_BUNDLE_IDENTIFIER in the generated project.
BUNDLE_ID="com.prohyundo.jira-weekend-marker"
find "$OUT" -name 'project.pbxproj' -print0 | while IFS= read -r -d '' PBX; do
  python3 - "$PBX" "$BUNDLE_ID" <<'PY'
import re, sys
path, base = sys.argv[1], sys.argv[2]
src = open(path).read()
def fix(m):
    value = m.group(1)
    new = base + ".Extension" if value.rstrip('"').endswith(".Extension") else base
    return f"PRODUCT_BUNDLE_IDENTIFIER = {new};"
out, n = re.subn(r'PRODUCT_BUNDLE_IDENTIFIER = ("?[^";]+"?);', fix, src)
open(path, "w").write(out)
print(f"patched {n} bundle identifier(s) in {path}")
PY
done

echo
echo "Xcode project created under: $OUT"
echo "Open it in Xcode and press Run; then enable the extension in Safari > Settings > Extensions."
echo "For an unsigned build, first turn on Safari > Develop > Allow Unsigned Extensions."
