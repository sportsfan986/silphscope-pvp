# AGENTS.md — SilphScope PvP Workspace Rules

> **Repository**: `https://github.com/sportsfan986/silphscope-pvp`  
> **Current Version**: `v7.50` (`versionCode = 1750`)  
> **Domains**: `silphscopepvp.com` (Web/Sim) • `dvr.silphscopepvp.com` (Cloud Vault & `/watch/:shareId`) • `api.silphscopepvp.com` (Worker API) • `dl.silphscopepvp.com` (APK)

---

## 1. Hard Stop Gates (Zero Exceptions)

1. **Stop-and-Confirm Versioning Gate (NEVER Overwrite Published Releases)**:
   - Pushing to `main` triggers `.github/workflows/android.yml`, which reads `versionName` from `app/build.gradle.kts` and uploads `silphscope-pvp-v<versionName>.apk` to that GitHub Release with `overwrite_files: true` and `gh release upload --clobber`.
   - **NEVER run `git commit` or `git push` on `main` if `VERSION` / `app/build.gradle.kts` still matches an already-published git tag/release.**
   - Even if the user explicitly says `"commit and push"`, **STOP and ask** whether to bump to the next `vX.XX` version first (`bash scripts/bump_version.sh` + `CHANGELOG.md` + `src/data/roadmapData.ts` + `npm run release:check`) or hold changes uncommitted for the next/daily build.
2. **No Debug Builds & No Local APK Packaging**:
   - **NEVER** run `./gradlew assembleDebug` or `./gradlew assembleRelease` locally unless the user explicitly asks for a local APK artifact. Verify Web locally (`npm run lint && npm run build`) and leave signed APK builds to GitHub Actions (`.github/workflows/android.yml`).
3. **Interactive Approval & New-Chat Model Gate**:
   - Never silently implement features, refactor, or cut releases without explicit user approval (`ask_question` or a plan artifact with `RequestFeedback: true`).
   - Whenever starting or recommending a standalone new chat for a feature, **always ask the user which model to use in that chat first**.
4. **Rule File Size Budget**:
   - Keep `AGENTS.md` strictly under **20,000 bytes** (Antigravity truncates rule files over `24,000` bytes). Store pricing/checkout URLs in [pricing-and-checkout](.agents/skills/pricing-and-checkout/SKILL.md), telemetry/DVR runbooks in [telemetry-and-dvr-ops](.agents/skills/telemetry-and-dvr-ops/SKILL.md), and deep architecture/math specs in [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md).

---

## 2. Model & Subagent Routing

- **Tier 0 (`0 AI Tokens` — Local Node/ffmpeg)**: Run telemetry sync/audits (`npm run telemetry:sync`, `scripts/nightly-telemetry-audit.mjs`), D1 meta queries (`npm run meta:summary`), and release checks (`npm run release:check`) locally.
- **Tier 1 (`flash` / `flash_lite` Subagents)**: **Always** delegate visual OCR, `4x6` contact-sheet, and DVR keyframe inspection via `invoke_subagent(TypeName: "research", Model: "flash")`, and delegate mechanical CI workflow polling to Flash. Never inspect video frames directly on Pro/Carbon.
- **Tier 2 (`Orchestrator (Carbon)` / `Carbon Medium`)**: Default for multi-file plans, root-cause diagnostics, and all Kotlin / TypeScript / Cloudflare Worker / HUD code wiring (in Orchestrator mode, write clean plans and hand off via `exit_plan_mode`; in standalone chats, use Carbon Medium for code wiring and Carbon Low for compiler fixes).
- **Tier 3 (`Carbon High` — Ask First)**: Proactively ask via `ask_question` before switching to Carbon High for new combat math engines or complex vision/concurrency pipeline overhauls.

---

## 3. Canonical File Map & Local Toolchain (No Root Mirrors)

- **Android (`app/src/main/java/com/gbl/overlay/`)**: `OverlayService.kt` (`APP_VERSION`, `APP_VERSION_CODE`), `MainActivity.kt`, `AppModels.kt`, `PokemonDatabase.kt`, `TeamAndMetaEngine.kt`, `Show6Engine.kt`, `IvMatrixEngine.kt`, `PixelScannerEngine.kt`, `BattleDvrEngine.kt`, `GitHubCloudSync.kt` *(handles Cloudflare D1 `/v1/sync/vault` + R2 DVR uploads despite legacy filename)*, `TaskerIntegration.kt`; HUD & resources in `app/src/main/assets/overlay.html`, `app/src/main/res/layout/`, `app/build.gradle.kts`, `app/proguard-rules.pro`.
- **Web (`src/`)**: `src/App.tsx`, `src/components/MarketingWebsite.tsx`, `VersionRoadmapInfographic.tsx`, `AppThemeAndModels.tsx`, `MetaTab.tsx`, `IvLabTab.tsx`, `IvTripletInput.tsx`, `HelpTab.tsx`, `MathValidatorTab.tsx`, `TrashBinModals.tsx`, `DocumentationModals.tsx`; data engines in `src/data/pokemonDb.ts`, `combatSimulator.ts`, `teamAndMetaEngine.ts`, `show6Engine.ts`, `ivMatrixEngine.ts`, `battleQuality.ts`, `roadmapData.ts`, `gblData.ts` (barrel).
- **Cloudflare Worker (`cloudflare/telemetry-worker/`)**: `worker.mjs`, `wrangler.toml`, `schema.sql` (D1 `silphscope-sync-db`, R2 `silphscope-replays`, KV `TELEMETRY_KV`).
- **Windows Toolchain PATH**: Prepend `C:\Users\Chris\.nodejs\node-v22.14.0-win-x64` and `C:\Users\Chris\.jdks\jdk-17.0.21+9\bin` to `PATH` before invoking `node`/`npm`/`keytool`. Always run `.sh` scripts via `"C:\Program Files\Git\bin\bash.exe"` (never WSL `C:\Windows\System32\bash.exe`).

---

## 4. Critical Technical, UI & Security Invariants

- **Android 14+ Single `VirtualDisplay` & Threading**: Never create a second `VirtualDisplay` from `MediaProjection`. Share the single 1-pass `ImageReader` frame under `captureLock` across Vision (`15Hz` High-Perf / `10Hz` Battery Saver) and `GBLBattleDvrThread` (`30 FPS` VIP / `15 FPS` Standard). Never block the main UI thread with OCR, image compression, or disk/network I/O; keep `recalculateAndPushBattleData()` marshaled onto `Looper.getMainLooper()`.
- **Kotlin K2 & 7 GB CI Runner Caps**: Always annotate explicit types (`: List<T>`, `: Map<K, V>`) on large static Kotlin collections so K2 skips global return-type inference. Preserve `gradle.properties` JVM caps (`-Xmx2560m` Gradle, `-Xmx3072m` Kotlin daemon) and `checkReleaseBuilds = false`.
- **APK Signature Scheme v3 Lineage (`minSdk = 31`)**: In `RELEASE_LINEAGE_B64`, prior signer `gblkey` **must** keep `--set-installed-data true` and `--set-rollback false` so in-place upgrades never fail with `INSTALL_FAILED_UPDATE_INCOMPATIBLE`.
- **HUD Controls, Theme & Clean League Labels**:
  - Preserve `#btn-minimize-sword` single-tap (`Full HUD` ↔ `Compact HUD`), 2.0s hold (**Log-Only Stealth Mode**), and post-battle `📊 Battle Log` button in `overlay.html`.
  - Keep league/cup labels CP-suffix-free (`Great League`/`Great`/`GL`, `Ultra League`/`Ultra`/`UL`, `Master League`/`Master`/`ML`).
  - Keep `Shiny Origin Dialga Midnight` as the default theme everywhere, and **never** include internal theme codenames (e.g., `"Origin Dialga Edition"`) in public marketing header banners.
- **Cloudflare Worker Escaping & CSP (`worker.mjs`)**:
  - Inside JS template literals (`` `...` ``) in `renderWatchSharePage` / `renderVaultDashboardPage`, **always double-escape regex backslashes** (`\\s+`, `\\*`, `\\r?\\n` — single `/\*/g` renders as `/*/g` block comments and breaks `/watch/:shareId`) and use `safeJsonForScript()`.
  - Attach `DEFAULT_CSP_HEADER` only when `isHtml === true`, preserving PvPoke/GitHub/Google Sheets `connect-src` and `*.silphscopepvp.com` `frame-src`/`frame-ancestors`.
- **Security & Privacy (`v7.13`)**:
  - *Worker*: Use dedicated `wrangler secret` keys (`ADMIN_API_KEY`, `STRIPE_WEBHOOK_SECRET`, `BMC_WEBHOOK_SECRET`, `SESSION_HMAC_KEY`, `LICENSE_HMAC_KEY`, `PASSWORD_PEPPER`), `timingSafeEqualStr()`, `crypto.getRandomValues()`, and server-side `verifyGitHubTokenIdentity()`. Never expose full unlock keys or raw OAuth tokens in unauthenticated responses; keep local admin creds only in gitignored `.env.admin`.
  - *Android & Web*: Encrypt sensitive `SharedPreferences` via `OverlayService.putEncryptedPref` / `getEncryptedPref` (Android Keystore `AES/GCM/NoPadding`, `enc1:` prefix). Mask active Unlock Keys behind `🔒 Unlock Key Secured (SSPVP-••••)`. Keep R8 enabled (`isMinifyEnabled = true`, `@Keep` on `@JavascriptInterface` bridges), disable WebView file/universal access, and **keep `TaskerOverlayActivity` & `TaskerBroadcastReceiver` exported** in `AndroidManifest.xml`.

---

## 5. Release Checklist (`vX.XX`)

1. Bump version across all synced targets: `"C:\Program Files\Git\bin\bash.exe" scripts/bump_version.sh` (`+0.01` default, or pass `vX.XX`).
2. Prepend `## vX.XX (YYYY-MM-DD) — <Summary Title>` (unbracketed `vX.XX`) + bullet highlights to [CHANGELOG.md](./CHANGELOG.md) (drives GitHub Release notes and `/v1/version/latest`).
3. Update [src/data/roadmapData.ts](./src/data/roadmapData.ts): prepend `vX.XX` to `VERSION_EVOLUTION_HISTORY` and **remove any newly completed items from `ACTIVE_ROADMAP_ITEMS`**.
4. Run `npm run release:check && npm run lint && npm run build` (all must exit `0`).
5. If `cloudflare/telemetry-worker/` changed, deploy Worker (`npx wrangler deploy`).
6. Commit and push to `origin main`, then monitor `Build Android APK` (`android.yml`) and `Deploy Web Simulator to GitHub Pages` (`deploy-pages.yml`) until `silphscope-pvp-vX.XX.apk` is published.
