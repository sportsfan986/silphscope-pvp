#!/usr/bin/env bash
set -euo pipefail

# Usage: ./scripts/bump_version.sh [explicit_version]
# Example: ./scripts/bump_version.sh v6.11
# If no version is passed, increments sub-version by 1 (e.g. v6.10 -> v6.11)

CURRENT_TAG=$(cat VERSION 2>/dev/null | tr -d '[:space:]' || echo "v6.10")
CURRENT_NUM="${CURRENT_TAG#v}"

if [ $# -ge 1 ] && [ -n "$1" ]; then
  RAW_ARG="${1#v}"
  NEW_NUM="$RAW_ARG"
else
  MAJOR=$(echo "$CURRENT_NUM" | cut -d. -f1)
  MINOR_STR=$(echo "$CURRENT_NUM" | cut -d. -f2)
  MINOR_VAL=$((10#$MINOR_STR + 1))
  NEW_NUM=$(printf "%d.%02d" "$MAJOR" "$MINOR_VAL")
fi

NEW_TAG="v${NEW_NUM}"
MAJOR_PART=$(echo "$NEW_NUM" | cut -d. -f1)
MINOR_PART=$(echo "$NEW_NUM" | cut -d. -f2)
VERSION_CODE=$((1000 + 10#$MAJOR_PART * 100 + 10#$MINOR_PART))

echo "$NEW_TAG" > VERSION

# 1. Android Gradle module
sed -i "s/versionCode = [0-9]\+/versionCode = ${VERSION_CODE}/g" app/build.gradle.kts
sed -i "s/versionName = \"[^\"]*\"/versionName = \"${NEW_NUM}\"/g" app/build.gradle.kts

# 2. Kotlin single source of truth constant
sed -i "s/const val APP_VERSION = \"[^\"]*\"/const val APP_VERSION = \"${NEW_NUM}\"/g" app/src/main/java/com/gbl/overlay/OverlayService.kt

# 3. Web package.json & App.tsx
sed -i "s/\"version\": \"[^\"]*\"/\"version\": \"${NEW_NUM}.0\"/g" package.json
sed -i "s/v[0-9]\+\.[0-9]\+ • Android Native Overlay/${NEW_TAG} • Android Native Overlay/g" src/App.tsx
sed -i "s/SilphScope PvP v[0-9]\+\.[0-9]\+ Overlay/SilphScope PvP ${NEW_TAG} Overlay/g" src/App.tsx

# 4. Documentation headers
sed -i "s/(v[0-9]\+\.[0-9]\+)/(v${NEW_NUM})/g" README.md
sed -i "s/silphscope-pvp-v[0-9]\+\.[0-9]\+\.apk/silphscope-pvp-${NEW_TAG}.apk/g" README.md
sed -i "s/\*\*Current Version\*\*: \`v[0-9]\+\.[0-9]\+\` (\`versionCode = [0-9]\+\`)/\*\*Current Version\*\*: \`${NEW_TAG}\` (\`versionCode = ${VERSION_CODE}\`)/g" ANTIGRAVITY.md

echo "Updated version to ${NEW_TAG} (versionCode=${VERSION_CODE}, versionName=${NEW_NUM}) across all targets."
