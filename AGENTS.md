# SilphScope PvP — Workspace Agent Rules & Optimized Build Instructions

Always follow the architecture, single-source-of-truth paths, and release runbook in @[ANTIGRAVITY.md](./ANTIGRAVITY.md).

## 1. CI/CD-First Optimized Build Workflow (Mandatory Default)
- **Do NOT run full local Android builds (`./gradlew assembleRelease`) on Windows** unless the user explicitly asks for a local APK build.
- **Auto-Increment Version by `+0.01` on New Releases**: Whenever shipping a new release or build and the user does not specify an explicit version number, automatically increment the current version in `VERSION` by `+0.01` (e.g., `v6.21` -> `v6.22`, `versionCode = 1000 + MAJOR * 100 + MINOR` -> `1622`) across `VERSION`, `app/build.gradle.kts`, `OverlayService.APP_VERSION`, `MainActivity.kt`, `GitHubCloudSync.kt`, `activity_main.xml`, `overlay.html`, `package.json`, `src/App.tsx`, `README.md`, `ANTIGRAVITY.md`, and `CHANGELOG.md` (or via `./scripts/bump_version.sh`).
- **Fast Local Gate**: Prepend Node 22 (`C:\Users\Chris\.nodejs\node-v22.14.0-win-x64`) to `PATH` and run `npm run lint && npm run build` locally to verify strict TypeScript and Vite bundling in ~15 seconds.
- **Push, Monitor CI & Auto-Remediate Failures**: Commit and push to `origin main` (and tag `vX.XX` for releases), then monitor `.github/workflows/android.yml` (`Build Android APK`, ~2–3 min) and `.github/workflows/deploy-pages.yml` (`Deploy Web Simulator to GitHub Pages`, ~45s) via the GitHub Actions API until completion. Use the `schedule` tool (~2 min timer) rather than rapid polling loops.
  - **On Success**: Verify that `silphscope-pvp-vX.XX.apk` is attached to the GitHub Release and notify the user with the release link.
  - **On Failure**: Immediately fetch the failed job logs via the GitHub Actions API, diagnose and fix the root cause, push the fix to `origin main`, and continue monitoring until the release succeeds.

## 2. Gradle & Kotlin K2 Build-Speed Invariants (Keep CI Builds Under 3.5 Minutes)
- **Never overcommit JVM RAM in `gradle.properties`**: GitHub Actions `ubuntu-latest` runners have **7 GB RAM**. Keep `org.gradle.jvmargs` (`-Xmx2560m`) + `kotlin.daemon.jvmargs` (`-Xmx3072m`) under 5.6 GB combined with `-XX:+UseParallelGC` and `kotlin.incremental=true` so the runner never swaps to disk.
- **Explicit types on large Kotlin collections**: Always specify explicit return types (`: List<PokemonMeta>`, `: Map<String, Int>`, `: Map<String, String>`, etc.) on large `listOf(...)` / `mapOf(...)` declarations so the Kotlin K2 compiler (`2.0.21+`) does not stall on quadratic return-type inference.
- **Keep `--build-cache` and `checkReleaseBuilds = false`**: Always pass `--build-cache` to `./gradlew assembleRelease` in `.github/workflows/android.yml` and keep `lint { checkReleaseBuilds = false }` in `app/build.gradle.kts`.

## 3. Android Release Signing & v3 Key Rotation Guardrails
- **Never commit keystores or tokens to Git**: `keystore.properties`, `*.keystore`, `*.jks`, and `*.lineage` must remain gitignored.
- **v3 Rotation Lineage (`RELEASE_LINEAGE_B64`)**: Must keep `--set-installed-data true` and `--set-rollback false` on the ancestor key so existing installations upgrade seamlessly in place without triggering Android Package Manager conflicts or Google Play Protect unrecognized-developer blocks.
