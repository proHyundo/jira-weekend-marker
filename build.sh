#!/usr/bin/env bash
# Build release artifacts into dist/
#   jira-weekend-marker-<v>-chrome-edge.zip      Chrome / Edge / any Chromium browser (Windows, macOS, Linux)
#   jira-weekend-marker-<v>-safari-source.zip    Safari: source + converter script (build with Xcode on macOS)
set -euo pipefail
cd "$(dirname "$0")"

VERSION=$(sed -n 's/.*"version": *"\([^"]*\)".*/\1/p' manifest.json | head -1)
NAME="jira-weekend-marker"
DIST="dist"
STAGE="$DIST/stage"
FILES=(manifest.json content.js content.css holidays.js locales.js popup.html popup.js icons _locales LICENSE README.md)

rm -rf "$DIST"
mkdir -p "$STAGE/$NAME"
cp -R "${FILES[@]}" "$STAGE/$NAME/"

# Chrome / Edge: plain WebExtension package
( cd "$STAGE" && zip -qr "../$NAME-$VERSION-chrome-edge.zip" "$NAME" -x '*.DS_Store' )

# Safari: same sources + converter script and instructions
mkdir -p "$STAGE/$NAME/safari"
cp safari/build-safari.sh safari/README.md "$STAGE/$NAME/safari/"
( cd "$STAGE" && zip -qr "../$NAME-$VERSION-safari-source.zip" "$NAME" -x '*.DS_Store' )

rm -rf "$STAGE"
echo "Built version $VERSION:"
ls -1 "$DIST"
