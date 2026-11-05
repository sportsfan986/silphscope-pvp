# Contributing to SilphScope PvP

Thank you for your interest in contributing to **SilphScope PvP**! This document provides guidelines, setup instructions, architectural principles, and verification workflows for developers and AI agents working on this repository.

---

## 1. Project Overview & Tech Stack

SilphScope PvP is a dual-target codebase:
1. **Android Application (`com.gbl.overlay`)**:
   - **Language**: Kotlin 2.0+ (targeting JVM 17, Android SDK 35, Min SDK 26).
   - **Architecture**: Foreground service (`OverlayService.kt`) managing a floating overlay window (`WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY`), in-memory screen analysis via `MediaProjection` + Android `ImageReader`, Google ML Kit Text Recognition, hardware-accelerated H.264 DVR via `MediaCodec`, and `MainActivity.kt` for settings, team presets, and battle logs.
   - **HUD Layer**: Lightweight HTML5/CSS3/Vanilla JS HUD (`overlay.html`) rendered inside an Android `WebView` with hardware acceleration and bidirectional communication via `JavascriptInterface` (`AndroidBridge`).
2. **Web Dashboard & PvP Simulator**:
   - **Language**: TypeScript + React 19.
   - **Bundler & Styling**: Vite + Tailwind CSS.
   - **Data Layer**: Live synchronization with PvPoke `gamemaster.json` and official league rankings JSONs, client-side localStorage vault, and GitHub OAuth Device Flow sync.

---

## 2. Development Environment & Prerequisites

To develop, build, and test both targets locally:
- **Java Development Kit**: JDK 17 (recommended: Eclipse Temurin or Azul Zulu 17).
- **Android SDK**: Compile SDK 35, Build Tools 35.0.0, Platform Tools.
- **Node.js**: Node 20+ (LTS).
- **Git**: Git 2.30+ configured with access to GitHub.

---

## 3. Canonical Directory Structure

All Android application sources live exclusively inside `app/`, and all React Web Simulator sources live inside `src/`:

```
silphscope-pvp/
├── app/                                 # Android application module (Single Source of Truth)
│   ├── build.gradle.kts                 # Canonical Android module Gradle configuration
│   ├── proguard-rules.pro               # ProGuard/R8 keep rules for WebView JS bridge, Gson & ML Kit
│   └── src/main/
│       ├── AndroidManifest.xml          # Canonical Android manifest
│       ├── assets/
│       │   └── overlay.html             # Canonical overlay HUD loaded by Android WebView
│       ├── java/com/gbl/overlay/
│       │   ├── MainActivity.kt          # Canonical main activity
│       │   └── OverlayService.kt        # Canonical background overlay service
│       └── res/layout/
│           ├── activity_main.xml        # Canonical main activity layout
│           ├── dialog_create_preset.xml # Canonical preset editor dialog layout
│           └── item_team_preset.xml     # Canonical team preset row layout
├── src/                                 # React Web Simulator source code
│   ├── App.tsx                          # Main React dashboard & analytics
│   └── data/
│       ├── gblData.ts                   # PvPoke database, combat math, team builders & Show 6 engine
│       └── battleQuality.ts             # BMF & Dynamic Execution WAE engine
├── scripts/                             # Release & telemetry utility scripts
│   ├── bump_version.sh                  # Unified version bump script across Android, Web & Docs
│   └── ingest-telemetry.mjs             # Multi-source AI telemetry & anomaly ingestion script
├── docs/                                # Documentation, screenshots, guides
├── ANTIGRAVITY.md                       # Comprehensive agent knowledge & historical log
├── CONTRIBUTING.md                      # This developer guide
├── CHANGELOG.md                         # Detailed version changelog
└── package.json                         # Node dependencies & Vite build scripts
```

---

## 4. Building & Running

### 4.1. Web Dashboard (Vite + React)
```bash
# Install dependencies
npm install

# Start local development server on port 3000
npm run dev

# Verify TypeScript and build production bundle
npm run build

# Run linter
npm run lint
```

### 4.2. Android Application (Gradle)
```bash
# Grant execute permissions to Gradle wrapper
chmod +x ./gradlew

# Build debug APK
./gradlew assembleDebug

# Build release signed APK (uses release.keystore if present, or falls back to debug signing)
./gradlew assembleRelease
```
The resulting APKs will be located at:
- Debug: `app/build/outputs/apk/debug/app-debug.apk`
- Release: `app/build/outputs/apk/release/app-release.apk`

### 4.3. Installing to a Connected Device via ADB
```bash
adb install -r app/build/outputs/apk/release/app-release.apk
```

---

## 5. Architectural Principles & Performance Invariants

1. **Zero Game FPS Impact on Pokémon GO**:
   - Screen capture uses a single shared `VirtualDisplay` at low frame rate (~1–10 FPS depending on user settings).
   - Never capture duplicate frames; reuse existing memory buffers.
   - Heavy pixel math and ML Kit OCR run strictly on background `HandlerThread` workers (`Process.THREAD_PRIORITY_BACKGROUND`).
2. **Single MediaProjection Token Constraint (Android 14+)**:
   - Android 14+ prohibits creating multiple `VirtualDisplay` instances from a single `MediaProjection` token.
   - The 1-Battle Full-Screen H.264 DVR (`MediaCodec` `video/avc`) **must reuse the already-captured in-memory bitmap** by rendering it onto `MediaCodec.createInputSurface()`. Never attempt to start a second virtual display.
3. **Data Privacy & Isolated Branches**:
   - Zero telemetry is sent to 3rd party servers.
   - Anomaly diagnostics and 1-Battle DVR recordings upload strictly to the isolated `ai-telemetry-logs` branch on GitHub.
   - Never commit API keys or private tokens; use GitHub OAuth Device Flow with local SharedPreferences storage.
4. **Haptic & Visual Alert Synchronization**:
   - Visual alerts (e.g. blinking HUD badges) and vibration alerts (e.g. single 80ms pulse for swap clock, double 80ms pulse for opponent charged move warning) must trigger off identical threshold evaluation logic.
   - Provide independent settings toggles and threshold tuning sliders for all haptic cues.

---

## 6. Versioning & Release Protocol

1. **Bumping Version**:
   - Run `./scripts/bump_version.sh vX.XX` (or `./scripts/bump_version.sh` to increment by `+0.01`), which automatically updates `VERSION`, `app/build.gradle.kts`, `OverlayService.APP_VERSION`, `package.json`, `src/App.tsx`, `README.md`, and `ANTIGRAVITY.md`.
   - Add the new release entry at the top of `CHANGELOG.md` (which `.github/workflows/android.yml` automatically extracts into the GitHub Release body).
2. **Git Tagging & GitHub Actions**:
   - Committing and pushing to `main` triggers GitHub Actions (`.github/workflows/android.yml`).
   - GitHub Actions automatically compiles `silphscope-pvp-v<version>.apk`, creates a GitHub Release with notes extracted from `CHANGELOG.md`, and publishes the signed artifact.
   - Verify workflow runs at `https://github.com/sportsfan986/silphscope-pvp/actions`.

---

## 7. Submitting Changes

1. **Self-Contained Commits**: Write clear, descriptive commit messages documenting the feature or fix.
2. **Compile Before Push**: Always run `npm run lint`, `npm run build`, and `./gradlew assembleRelease` before pushing.
3. **Consult Antigravity Guidelines**: For detailed subsystem logic, telemetry schemas, and full design decision logs, refer to [`ANTIGRAVITY.md`](./ANTIGRAVITY.md).
