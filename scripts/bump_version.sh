#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   ./scripts/bump_version.sh                 # Increment sub-version by +0.01 (e.g. v7.42 -> v7.43)
#   ./scripts/bump_version.sh vX.XX           # Set an explicit version
#   ./scripts/bump_version.sh --check [flags] # Run zero-token release parity & tag-collision checks

if [ "${1:-}" = "--check" ]; then
  shift
  exec node scripts/verify-release-ready.mjs "$@"
fi

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
sed -i "s/const val APP_VERSION_CODE = [0-9]\+/const val APP_VERSION_CODE = ${VERSION_CODE}/g" app/src/main/java/com/gbl/overlay/OverlayService.kt

# 3. Web package.json & App.tsx
sed -i "s/\"version\": \"[^\"]*\"/\"version\": \"${NEW_NUM}.0\"/g" package.json
sed -i "s/v[0-9]\+\.[0-9]\+ • Android Native Overlay/${NEW_TAG} • Android Native Overlay/g" src/App.tsx
sed -i "s/SilphScope PvP v[0-9]\+\.[0-9]\+ Overlay/SilphScope PvP ${NEW_TAG} Overlay/g" src/App.tsx

# 4. Documentation headers
sed -i "s/(v[0-9]\+\.[0-9]\+)/(${NEW_TAG})/g" README.md
sed -i "s/silphscope-pvp-v[0-9]\+\.[0-9]\+\.apk/silphscope-pvp-${NEW_TAG}.apk/g" README.md
if [ -f AGENTS.md ]; then
  sed -i "s/\*\*Current Version\*\*: \`v[0-9]\+\.[0-9]\+\` (\`versionCode = [0-9]\+\`)/\*\*Current Version\*\*: \`${NEW_TAG}\` (\`versionCode = ${VERSION_CODE}\`)/g" AGENTS.md
fi

# 5. Marketing Website header badge & direct download button release label
sed -i "s/v[0-9]\+\.[0-9]\+ • Latest Release/${NEW_TAG} • Latest Release/g" src/components/MarketingWebsite.tsx
sed -i "s/Instant 1-Click Direct Release (v[0-9]\+\.[0-9]\+)/Instant 1-Click Direct Release (${NEW_TAG})/g" src/components/MarketingWebsite.tsx

# 6. Cloudflare Worker & Roadmap Infographic fallback
sed -i "s/WORKER_VERSION = \"[^\"]*\"/WORKER_VERSION = \"${NEW_NUM}.0\"/g" cloudflare/telemetry-worker/wrangler.toml
sed -i "s/SilphScope-PvP-Version-Check\/[0-9]\+\.[0-9]\+/SilphScope-PvP-Version-Check\/${NEW_NUM}/g" cloudflare/telemetry-worker/worker.mjs
sed -i "s/VERSION_EVOLUTION_HISTORY\[0\]?\.version || 'v[0-9]\+\.[0-9]\+'/VERSION_EVOLUTION_HISTORY[0]?.version || '${NEW_TAG}'/g" src/components/VersionRoadmapInfographic.tsx

echo "Updated version to ${NEW_TAG} (versionCode=${VERSION_CODE}, versionName=${NEW_NUM}) across all targets."
