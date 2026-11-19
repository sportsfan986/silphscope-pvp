export interface VersionRelease {
  version: string;
  codename: string;
  badge?: string;
  date: string;
  summary: string;
  highlights: string[];
  icon: string;
  accentColor: string; // Tailwind border/text color class or hex
}

export interface RoadmapItem {
  id: string;
  title: string;
  badge: string;
  status: 'Completed' | 'In Progress' | 'In Design' | 'Planned' | 'Researching';
  statusColor: string;
  category: string;
  description: string;
  icon: string;
  keyGoals: string[];
}

export const VERSION_EVOLUTION_HISTORY: VersionRelease[] = [
  {
    version: 'v7.81',
    codename: 'Website, Roadmap, Download Portal & PWA Manifest Theme Polish',
    badge: 'CURRENT',
    date: 'Nov 2026',
    summary: 'Eliminates all remaining Shiny Origin Dialga teal/navy leaks across the marketing site, Version Roadmap infographic, dl.silphscopepvp.com download portal, and PWA manifests so every web surface honors Duel Scope Midnight Black by default and syncs dynamically with user themes.',
    icon: '🎨',
    accentColor: '#38BDF8',
    highlights: [
      'Vertically separated mobile Hero radial glows and expanded MarketingWebsite.tsx CSS overrides across all 64 teal/cyan classes, muted nav pills, Hero gradients, Vault/Live View panels, and VersionRoadmapInfographic cards',
      'Themed dl.silphscopepvp.com with Duel Scope Midnight Black tokens, transparent-HUD watermark, and signed-in cookie continuity while keeping anonymous visitors on the clean default',
      'Updated index.html, public/manifest.json, public/manifest.webmanifest, and Worker manifest endpoints to #050810'
    ]
  },
  {
    version: 'v7.80',
    codename: 'Duel Scope Midnight Black Default, 11-Theme WCAG AA+ Suite & Cross-Platform Cloud Sync',
    date: 'Nov 2026',
    summary: 'Promotes Duel Scope Midnight Black derived from the 2B Duel Scope emblem as the universal default across Android, Live HUD, Web Simulator, Marketing Website, and Cloud Vault/Watch; adds 5 new PvP OLED themes with translucent HUD reticle & 10-theme constellation watermarks; audits all 11 retained palettes to WCAG 2.1 AA+ contrast; and syncs theme & watermark preferences across every signed-in device via Cloudflare D1 and shared cookies.',
    icon: '⚔️',
    accentColor: '#38BDF8',
    highlights: [
      'Promoted Duel Scope Midnight Black (duel_scope_midnight) as the universal default across all 5 surfaces while keeping Shiny Origin Dialga Midnight selectable and scrubbing internal codenames from public banners/titles',
      'Designed translucent HUD viewfinder watermarks & 2B Duel Scope constellation crest featuring miniature emblems from all 10 sibling themes across Android VectorDrawables, overlay.html, Web Simulator, Marketing & Cloudflare Vault',
      'Pruned redundant low-contrast themes with auto-migration, added 5 new PvP OLED/Void themes, and added WCAG AA contrastingInkColor() / Light-mode card, pill, badge & dialog contrast fixes everywhere',
      'Wired bi-directional Cloudflare D1 userSettings + .silphscopepvp.com cookie theme & watermark sync across Android, HUD, Web Simulator, Marketing Website, Cloud Vault, and /watch/:shareId Replay Theater'
    ]
  },
  {
    version: 'v7.77',
    codename: 'Replay-First & Auto-Logger Website Rebrand + Natural Transparency Copy',
    date: 'Nov 2026',
    summary: 'Reorganizes silphscopepvp.com and dl.silphscopepvp.com around Battle DVR, zero-typing auto-logging (free GOBattleLog export), and ELO Anti-Meta first with optional 3-mode tactical data, replacing rigid "50% translucent" / "Ban-Proof Guarantee" jargon with clearer semi-transparent, adjustable transparency, and Read-Only Screen Capture copy.',
    icon: '🎬',
    accentColor: '#2DD4BF',
    highlights: [
      'Reordered the website and dl.silphscopepvp.com around 1. Hardware Battle DVR & Zero-Typing Auto-Logging, 2. ELO-Adaptive Meta & Anti-Meta Builder (+ Free GOBattleLog Export), and 3. Optional 3-Mode Tactical Data',
      'Promoted the @Featured Browser Replay Theater and Log-Only Stealth / Read-Only Screen Capture architecture directly below the Hero for desktop, iOS, and Android visitors',
      'Refreshed Landing, Field Manual (?view=guide), Comparison Table (?view=compare), Live View (?view=live), and PWA manifest wording to natural "semi-transparent" and "adjustable transparency" descriptions'
    ]
  },
  {
    version: 'v7.76',
    codename: 'Compact Mode Default (AI Coach OFF) & Clean Web DVR Viewport',
    date: 'Nov 2026',
    summary: 'Switches new-user defaults on Android and the Web Simulator to Compact Mode (Moves (Def) preset with AI Tactical Coach OFF and 3x3 Matrix OFF) while keeping Cloud DVR replays on Full HUD and removing the top toast telemetry pill from all Web DVR modes.',
    icon: '⚡',
    accentColor: '#34D399',
    highlights: [
      'Defaulted new Android and Web Simulator sessions to Compact HUD (Moves (Def): Mirrored Header [HP/E/Shields] + Opp Attacks + My Attacks + Pacing + Shield Call, with AI Tactical Coach OFF and 3x3 Matrix OFF)',
      'Preserved Cloud DVR (/watch/:shareId) defaulting to Full HUD for post-battle analysis while explicitly encoding hud=full on shared Full HUD Web Simulator links',
      'Removed the redundant #dual-energy-pill top toast bar from all Web DVR Replay Theater modes so web video playback matches the clean native Android viewport'
    ]
  },
  {
    version: 'v7.75',
    codename: 'Bottom-Attached Shield Call & AI Coach DVR Parity, Moves (Def) Compact HUD & Shareable URL Config',
    date: 'Nov 2026',
    summary: 'Fixes DVR Replay bottom Shield Call & AI Tactical Coach anchoring to match Android, upgrades the default Compact HUD preset to Moves (Def) across Android/Web/DVR with full 6-module granular controls, and encodes live HUD layouts into shareable URL query parameters.',
    icon: '🎛️',
    accentColor: '#2DD4BF',
    highlights: [
      'Fixed DVR Replay aiAdviceHudPosition defaulting to top instead of bottom so the 2-line AI Coach and Shield Decision Card stay attached to the bottom of the main overlay (matching Android), and added Shield Call card rendering to Web Simulator and DVR canvas exports',
      'Refined the default Compact HUD preset to Moves (Def) (Header [Shields/E] + Opp Attacks + My Attacks + Pacing + Shield Call) across Android Settings (2x2 preset grid), overlay.html, Web Simulator, and Cloud DVR',
      'Added full 6-module Granular Compact HUD controls (Opp, Mine, Coach, Matrix, Pacing, Toolbar Mode) + Shield toggle directly above DVR/Simulator controls, encoded into real-time ?hud=compact&cmp=...&sh=1 URL parameters with live address-bar sync and Marketing Website iframe parameter forwarding'
    ]
  },
  {
    version: 'v7.74',
    codename: 'Combat Telemetry Fixes, Cross-Platform Dynamic Shadow Eligibility & 2-Tier Local DVR Quota',
    date: 'Nov 2026',
    summary: 'Hardens combat OCR/energy edge cases from v7.70 telemetry, replaces Web hardcoded nonShadowBases with live PvPoke gamemaster + rankings Shadow eligibility synced across Android/Web/Worker, and upgrades local DVR telemetry caching with a 6 GB soft / 20 GB hard quota and un-truncated version audit matrices.',
    icon: '🛡️',
    accentColor: '#38BDF8',
    highlights: [
      'Fixed 0-shield Mimikyu Disguise bust accounting (shielded=true, 1% chip), post-cutscene user-swap noisy-circle cadence fallback, bench OCR cross-species overwrite guards, and 1.6s purple stat-stage/swap-in VFX shadow-aura gates',
      'Replaced Web hardcoded nonShadowBases with live PvPoke gamemaster "shadoweligible" + rankings DYNAMIC_SHADOW_ELIGIBLE_KEYS (unlocking Shadow Corviknight & 9 other stale-blocked Shadows), gave Android OTA keys precedence, and added scripts/sync-pvpoke-shadows.mjs',
      'Upgraded local telemetry retention to a 6 GB soft cap (<72h & unresolved issues protected) + 20 GB oldest-first hard ceiling, removed base64 bloat & top-40 truncation from anomaly digests, and fixed dvrTraceIntegrityAudit tracePath scanning'
    ]
  },
  {
    version: 'v7.73',
    codename: 'Multi-Meta Mega/Primal Slot Tracking, Live Mega Auto-Detection & Standard/Mega Auto-Merge',
    date: 'Nov 2026',
    summary: 'Unifies Standard and Mega/Primal teams with per-slot Mega designations (max 1 per team), automatic Mega form/CP resolution across multi-meta pools, live Mega/Primal OCR auto-detection with a 1-tap HUD toggle, and a one-time idempotent Standard/Mega team auto-merge.',
    icon: '🧬',
    accentColor: '#E879F9',
    highlights: [
      'Added per-slot Mega/Primal picker chips (`megaFormName`) in Android & Web Team Editors with dynamic CP scaling, sprite switching, and per-meta simulation in both Standard (GL/UL/ML) and Mega (MGL/MUL/MML) pools',
      'Wired live Mega/Primal auto-detection on CHOOSE YOUR PARTY and combat frames (up to 8000 CP, nameplate OCR, Super Mega + move buttons, Go banners, and Mega opponents) with a 1-tap Mega ON/OFF pill in overlay.html',
      'Added an idempotent v7.73+ Standard/Mega team auto-merge migration on Android and Web plus trailing space-separated form sprite parsing (e.g. Dialga Origin)'
    ]
  },
  {
    version: 'v7.72',
    codename: 'Direct In-App APK Downloads (/direct) & Full Android 2B Icon Suite',
    date: 'Nov 2026',
    summary: 'Routes Android in-app updates straight to the signed APK via dl.silphscopepvp.com/direct and upgrades the unified 2B Split-Arc Duel Scope icon across the 0.84x launcher foreground, Android 13+ monochrome themed layer, full-scale in-app header logo, and notification bar.',
    icon: '🚀',
    accentColor: '#38BDF8',
    highlights: [
      'Added dl.silphscopepvp.com/direct (/latest, /apk) 302 APK redirect with 60s cache TTL, updated /v1/version/latest downloadUrl, and wired normalizeDirectApkDownloadUrl() + GitHub .apk asset parsing in MainActivity.kt & OverlayService.kt',
      'Upgraded ic_launcher_foreground.xml to bold 0.84x scale with thicker 6.4dp split energy arcs and 6.0dp catch bullseye while adding ic_launcher_monochrome.xml to both adaptive mipmap XMLs for Android 13+ Pixel Themed Icons',
      'Replaced ic_gbl_logo.xml with a full-scale 1.0x 2B Duel Scope vector matching favicon.svg 1:1 and updated OverlayService notification setSmallIcon to R.drawable.ic_launcher_monochrome'
    ]
  },
  {
    version: 'v7.71',
    codename: 'Inline Mega Helix Icons Across League Badges, Filter Chips & Idle Overlay',
    date: 'Nov 2026',
    summary: 'Replaces Mega league abbreviations (MGL, MUL, MML, Mega GL/UL/ML) and Mega Limited Cup prefixes with an inline 4-stop rainbow Mega Helix vector glyph across Android, Web, and the idle HUD overlay while keeping exports and dropdowns plain ASCII.',
    icon: '🧬',
    accentColor: '#E879F9',
    highlights: [
      'Bundled a crisp 42×56 evenOdd Mega Helix vector glyph with a 4-stop Mega gradient (#FF5EC4 → #E879F9 → #38BDF8 → #4ADE80) in ic_mega_helix.xml, MegaBadge.tsx, and overlay.html',
      'Wired MegaBadgeUi.stylize() & formatCupChip() in MainActivity.kt across Team Builder pills, Record per-meta splits, multi-meta pool rows, Tier 2 tabs, Anti-Meta/IV Lab cup chips, Edit Team chips, and IV rankings strip',
      'Wired <MegaMetaText /> in App.tsx & IvLabTab.tsx plus formatOverlayMegaHtml() in the idle HUD .idle-league-pill while preserving plain ASCII in copy/share exports, Toasts, and native <option> elements'
    ]
  },
  {
    version: 'v7.70',
    codename: 'High-Res Pokémon Sprites, Unified 2B Duel Scope Icon & TOS-Safe Website Upgrade',
    date: 'Nov 2026',
    summary: 'Introduces high-res Showdown HOME sprites in the Web Simulator Battle Arena and selective zero-bloat mini sprites across Team Builder card headers, Pokémon autocomplete dropdowns, Meta, and IV Lab (powered by Coil 2.7.0 on Android), rolls out the unified 2B Split-Arc Duel Scope icon everywhere, and launches the 100% TOS-Safe website & download landing page.',
    icon: '🖼️',
    accentColor: '#38BDF8',
    highlights: [
      'Replaced Web Battle Arena emojis with 112px/128px HOME 3D sprites, subtle idle float, multi-CDN Showdown HOME/Dex + PokeAPI dex fallback, and Shadow purple aura + corner flame indicators (zero overlay sprites)',
      'Added compact 3-Pokémon mini sprite strips in the Team Builder card header whitespace (item_team_preset.xml + Web cards) with zero card height growth',
      'Added zero-bloat mini sprites to Android & Web Pokémon autocomplete dropdowns, Meta Top Threats/Cores rows, IV Lab Target Species, and Built Pokémon Roster cards via Coil 2.7.0 (40 MB cache) & <PokemonSprite>',
      'Unified 2B (Split-Arc Duel Scope) icon across Android adaptive launcher, favicon/PWA SVGs, overlay emblem, and Cloudflare Vault/Download pages alongside the 100% TOS-Safe website & dl.silphscopepvp.com landing page'
    ]
  },
  {
    version: 'v7.64',
    codename: 'Full-Height Right-Rail Team Card Controls & Zero Left Gutter',
    date: 'Nov 2026',
    summary: 'Moves the 6-dot drag icon into the unified right-hand vertical rail alongside Radio, Edit, Delete, and ▲/▼ with weighted spacing spanning the card height, eliminating the left gutter completely.',
    icon: '📐',
    accentColor: '#38BDF8',
    highlights: [
      'Removed left drag-handle gutter in item_team_preset.xml so team content spans edge-to-edge on the left',
      'Ordered the right 32dp vertical rail as Radio, Edit, gap, Delete, gap, ▲, ⋮⋮, ▼ with proportional Space weights filling the full card height'
    ]
  },
  {
    version: 'v7.63',
    codename: 'Compact Right-Rail Team Card Controls & Expanded Horizontal Card Width',
    date: 'Nov 2026',
    summary: 'Consolidates the Team Card active Radio button, Edit, Delete, and ▲/▼ reorder controls into one slim 32dp vertical rail on the right while keeping a compact 16dp drag handle on the left, expanding usable horizontal card width for long team names and multi-meta BR pools.',
    icon: '📐',
    accentColor: '#38BDF8',
    highlights: [
      'Stacked Select Radio, Edit, Delete, and ▲/▼ vertically inside one 32dp right-hand column in item_team_preset.xml',
      'Removed left-side Radio gutter and trimmed card horizontal padding to reclaim ~108dp of width for team names, multi-meta pool BR boxes, and slot rows'
    ]
  },
  {
    version: 'v7.62',
    codename: 'Multi-Select Assigned Metas Editor, Per-Meta Pool BR Cards & Battle Log Team Unification',
    date: 'Nov 2026',
    summary: 'Replaces single-select League dropdowns in Edit Team with a CP-Tier bar + inline checkable multi-meta grid (fixing assigned chip persistence on edit open), displays full Core/Beats/Lead/Swap/Closer BR rows for every assigned meta pool on main Team Cards with 1-tap switching, and unifies merged team names & multi-meta filters in Battle Logs.',
    icon: '📊',
    accentColor: '#38BDF8',
    highlights: [
      'CP-Tier bar (Great 1500 / Ultra 2500 / Master 10000) + wrapped multi-select checkable meta chips (☑/☐ assign + tap name to preview ★ BR) inside Android & Web Edit Team dialogs, fixing v7.61 extra-meta reset on open',
      'Full per-pool BR rows ([MUL], [UL]) cached via MetaPoolBrSnapshot on Team Cards with 1-tap pool switching and compact MUL ⇄ UL header badges so long team names stop truncating',
      'Battle Log Team Preset filters match across all assignedLeagues + presetId, and exports/groupings consolidate merged log entries under the survivor preset name',
      'Preserves existing updatedAt timestamps during Web D1 sync pushes so signature backfills never override D1 deletions'
    ]
  },
  {
    version: 'v7.61',
    codename: 'Multi-Meta Team Assignments, One-Time Team Merge, Live GBL Schedule & PoGO Party Name Sync',
    date: 'Nov 2026',
    summary: 'Unifies teams shared across multiple same-CP metas (e.g., UL + MUL) with 1-tap HUD/card meta cycling, pulls live ScrapedDuck GBL rotation schedules, merges duplicate teams once on first launch of v7.61+ across Android, Web & Cloudflare D1, prompts to sync PoGO party names, and adds Overall + Per-Meta W-L team badges.',
    icon: '🔁',
    accentColor: '#38BDF8',
    highlights: [
      'Added assignedLeagues multi-meta chips in Android & Web Edit Team modals plus 1-tap ⇄ meta switching on Team Cards and the Idle HUD .idle-league-pill',
      'Fetches live ScrapedDuck GBL rotation schedules (6h TTL + 36h window bridge) so "CHOOSE YOUR PARTY" OCR auto-resolves UL vs. MUL when Pokémon GO omits the cup badge',
      'Runs an idempotent one-time v7.61+ merge across Android prefs, Web localStorage, and all active D1 Vault accounts — consolidating duplicate teams, re-pointing battle log presetIds while preserving per-battle league, and tombstoning merged duplicates',
      'Adds non-intrusive onResume PoGO Battle Party rename prompt (Rename / Not Now / Don\'t Ask Again) and Overall + Per-Meta W-L breakdown badges on Team Cards'
    ]
  },
  {
    version: 'v7.60',
    codename: 'Auto-Detect Team & League from "Choose Your Party" + Idle HUD Auto Team Scan Toggle',
    date: 'Nov 2026',
    summary: 'Adds a persistent 🔍 Auto team-scan toggle right beside your 3 Pokémon on the idle HUD, parsing League/CP caps, PvP IV nicknames, 3-tier regional/Shadow sprites, and matching saved TeamPresets with swipe preview & automatic lock on Matchmaking or battle start.',
    icon: '🔍',
    accentColor: '#2DD4BF',
    highlights: [
      'Added persistent 🔍 Auto / 🔍 Off toggle pill inside .idle-team-line2 across Full & Compact HUDs (with instant 3s fast-scan burst on enable and non-destructive swipe preview strip)',
      'Piggybacks on shared idle OCR on "CHOOSE YOUR PARTY" with peek-card X-clamping (0.085..0.910), League/Max-CP parsing, and custom party title matching (!= "New Party")',
      'Strips PvP IV prefixes/suffixes and CamelCase move codes (e.g., X1113MelmEFD -> Melmetal, U1Mimikyu, ⓊMoltres, U1Tinkaton+, ⓊSwampert99) with 4+ char stems and Lv51 CP legality checks',
      '3-tier regional form & Shadow disambiguation via My Built Pokémon exact CP lookup, 14x14 sprite-box HSV palette sampling (e.g., Galarian vs. Kanto Moltres, Lucky-safe), and PvPoke rank priors',
      'Strict saved-preset-only matching with 2-frame swipe settle preview and automatic team + Slot-0 Lead lock on [✓ Use], Matchmaking, 3-2-1 countdown, or "Go!" battle start'
    ]
  },
  {
    version: 'v7.56',
    codename: 'Shadow Aura & Entry-OCR Hardening, Strict OCR-Only Mimikyu Disguise, Shield Sync & Survey Refresh',
    date: 'Nov 2026',
    summary: 'Eliminates Go-banner player Shadow leaks and Fairy Wind Aura blocks, unlocks 3D Shadow Aura sampling when 1 action circle dims, enforces strict OCR-only Mimikyu Disguise busts, fixes BLOCKED! & KO-faint shield desyncs, and refreshes the in-app post-battle 1-tap survey pool.',
    icon: '🛡️',
    accentColor: '#A855F7',
    highlights: [
      'Scoped Go-banner Shadow checks to the Go line itself (fixing opp nameplate leaks onto player switch-ins) and removed non-purple Fairy Wind / Dragon Breath / Charm from PURPLE_VFX_FAST_MOVES',
      'Unlocked 3D HSV Shadow Aura sampling (|| circle gate, locked oppSlotBaselineHpRowY fallback, <400ms blink retention, 600ms confirm) plus defenderPokemon-scoped timeline backfill and pre-exit debuff deduplication',
      'Enforced strict OCR-only Mimikyu Disguise busting—requiring explicit "disguise is busted!" text and removing all pixel, timeout, and !wasShielded Disguise fallbacks',
      'Deduplicated mid/post-charge BLOCKED! shield counters, refunded provisional shields on confirmed post-charge KO faints, and synced >8.5s match-winning KO throws',
      'Replaced stale v7.08–v7.25 post-battle feedback prompts with 4 context-triggered v7.56 checks (Mimikyu Bust, Opp Shadow, Shield Sync, Auto Form & BP/Bulk)'
    ]
  },
  {
    version: 'v7.55',
    codename: '2x Retina @Featured Battle Showcases, Replay HUD v7.54 Parity & Non-Truncating Breakpoint Pills',
    date: 'Nov 2026',
    summary: 'Promotes three clean 0-anomaly v7.53 Ultra League wins to @Featured with 2x Retina (1088x2368, 24 fps) homepage media, upgrades /watch/:shareId to full v7.54 HUD parity, removes double-dimmed HUD glass opacity, and prevents live Breakpoint micro-pills from truncating behind ellipsis.',
    icon: '🎬',
    accentColor: '#2DD4BF',
    highlights: [
      'Promoted f_ul_aura_nidoking (3D HSV Shadow Aura + D-3 math), f_ul_bp_skeledirge (live ⚡BP+1 + Shadow: N/A), and f_ul_catch_cobalion (Shadow: OFF ✓ + A-2/D-1 Disguise sync + 0F Catch) to @Featured with 2x Retina 1088x2368 MP4 & poster assets and fixed ?t= chapter deep-linking',
      'Extracted #sky-my-bp-pill and #sky-opp-bp-pill outside text-overflow: ellipsis spans in overlay.html so ⚡BP+1, ⚠️BP+1, and 🛡️BLK-1 badges always render unclipped next to READY pills',
      'Upgraded Cloudflare Replay Theater to v7.54 parity with crisp 1.0 text opacity over 50% translucent glass, 511-key Shadow eligibility + pokemonDb.ts species backfill (333 species) & multi-form lists, and true videoElapsedMs duration extraction',
      'Added oppShadowEligible, oppFormVerified, oppFormLocked, and oppFormSource trace emission to BattleDvrEngine.kt'
    ]
  },
  {
    version: 'v7.54',
    codename: 'Persistent Idle & Post-Set "📊 Battle Log" Controls, 120s Post-Battle Bar & Non-DVR Stop Guard',
    date: 'Nov 2026',
    summary: 'Restores 1-tap "Stop Overlay & Open Battle Log" access across idle between-battle toolbars, Compact hidden-toolbar headers, and GBL end-of-set / ELO Locked banners while extending the post-battle auto-logged window to 120s and protecting non-DVR Stop snapshots.',
    icon: '📊',
    accentColor: '#10B981',
    highlights: [
      'Idle Toolbar & Horizon Belt swap inactive Form: Base for a persistent 📊 Battle Log button whenever !isBattleActive (restoring Form: automatically on battle start and hidden in /watch replays)',
      'Added 📊 Battle Log / 📊 Log buttons inside the 5/5 Set Complete and ✅ ELO Locked banners (extended from 4s to 12s) plus a Compact HUD hidden-toolbar 📊 LOG header pill',
      'Extended the post-battle #auto-logged-banner timeout from 45s to 120s so set-reward encounters do not prematurely dismiss post-battle exit and editing controls',
      'Fixed stopCurrentBattle() so non-DVR battles >= 10s retain detected opponent snapshots for manual logging instead of tripping stoppedBattleDiscardDvr'
    ]
  },
  {
    version: 'v7.53',
    codename: 'Automatic Multi-Form Disambiguation & Raw HP-Pulse Turn-Cadence Engine',
    date: 'Nov 2026',
    summary: 'Automatically resolves multi-form Pokémon (e.g., Giratina, Landorus, Zacian, Urshifu, Alolan/Galarian variants) using observed nameplate CP caps, BANNER_OCR signature/EPT moves, and joint stats/cadence, powered by an assumption-free 380ms-debounced raw HP-pulse turn-cadence ring buffer.',
    icon: '🔄',
    accentColor: '#2DD4BF',
    highlights: [
      'Form-isolated move pools (isBaseOrKantoForm guard + Urshifu/Zamazenta/Morpeko keys) paired with Level-51 max-CP +15 margin and non-Mega legality filtering on sibling forms',
      'BANNER_OCR multi-form pooling & automatic form flipping on signature charged moves or EPT-infeasible throws (never noisy HP_DELTA guesses alone), with Shadow re-validation & retroactive timeline sync',
      'Separates manual #btn-cycle-form locks (🔒) from auto-verified forms (✓ with OBS_CP / CHARGED_MOVE / CHARGED_EPT / FAST_CADENCE / FAST_MOVE_DHP provenance) across HUD and Replay Vault',
      'Assumption-free 380ms-debounced raw HP-pulse turn-cadence engine enabling cadence-led Non-Standard Fast Move confirmation (wonByCadence), (2t+Shadow) vs (3t+Normal) tie-breaking, and asymmetric 1t vs 2t merged-tick guards'
    ]
  },
  {
    version: 'v7.52',
    codename: 'Hybrid OTA Shadow Eligibility Catalog, Corroborated Charged ΔHP & Settle-Window Latch',
    date: 'Nov 2026',
    summary: 'Eliminates false Shadow detections on unreleased Shadow species and post-charge fast-move bleed with a hybrid compiled + 24h in-app OTA PvPoke Shadow catalog, locked HUD N/A toggle, post-charge ΔHP settle latches, observed-CP charged damage math, and corroborated single-charge flip rules.',
    icon: '🟣',
    accentColor: '#A855F7',
    highlights: [
      'Hybrid compiled baseline (STATIC_RELEASED_SHADOW_KEYS) + live in-app OTA Shadow registration (DYNAMIC_SHADOW_ELIGIBLE_KEYS) with 24h background staleness refresh so newly released Rocket Shadows unlock automatically without an APK update',
      'Locks unreleased Shadow species (e.g., Tinkaton, Origin Dialga/Palkia/Giratina, Galarian Moltres) to Normal and dims #btn-toggle-shadow to Shadow: N/A across Full/Compact HUDs',
      'Latches post-charge ΔHP settle windows after 2 stable combat frames (and bounds CMP intervention to +6.5s) while passing oppSlotObservedCp IV narrowing into IN_CHG_DHP and OUT_CHG_DHP',
      'Requires >=1 positive 3D Aura frame or multi-hit Fast ΔHP trend before any single charged move can flip Normal -> Shadow, and opens clean entry aura sampling before Ghost/purple fast-move VFX hit'
    ]
  },
  {
    version: 'v7.51',
    codename: 'Shield Carryover & Mimikyu Disguise Hardening, Non-GBL Screen Exclusion, Shadow Aura Lock & Minigame Timeout Fix',
    date: 'Nov 2026',
    summary: 'Hardens live battle shield tracking against stale outgoing "BLOCKED!" banner carryover and 0–3% Protect Shield deadlocks, fixes Mimikyu Disguise double-debuffing (-2 DEF) and premature Disguise busts, blocks false battle starts/species locks on Pokédex & catch summary cards with clean aborted-Stop resets, guards against false non-aura Shadow DHP flips, and stops victory-fade duplicate KO events and mid-swipe minigame splits.',
    icon: '🛡️',
    accentColor: '#38BDF8',
    highlights: [
      'Timestamp-burst & incoming-prompt carryover suppression prevents fading outgoing "BLOCKED!" banners from deducting your Protect Shield on an immediate incoming opponent charge',
      'Fixed 26.6s user shield decrement deadlock by aligning 0–3% Protect Shield chip handling and fixing the post-finalization "BLOCKED!" provisional-shield guard',
      'Always refreshes Mimikyu Disguise callout deduplication timers, suppresses trailing Disguise "DEFENSE FELL!" double-debuffs (-2 DEF), and holds ambiguous 0–3% shield hits until shield pixel confirmation',
      'Excludes Pokédex/Storage/Catch cards (POKÉDEX, POWER UP, APPRAISE, TRANSFER, NEW ATTACK), clears stray detections on aborted <10s Stop taps, resets cleanly on 3-2-1, guards non-aura Shadow DHP flips, and fixes victory-fade duplicate moves & slow minigame timeouts'
    ]
  },
  {
    version: 'v7.50',
    codename: '3D HSV Shadow Aura Detection, Bidirectional ΔHP & Joint Fast-Move Verification, Observed-CP Best-Guess IVs & Live Breakpoints/Bulkpoints',
    date: 'Nov 2026',
    summary: 'Completes Roadmap Features #1 and #2 with zero-allocation 3D HSV + temporal-motion Shadow aura detection (with purple-species, foreground Shadow bleed, and Ghost VFX confounder rejection), stat-stage-aware Joint (FastMove × ShadowState) + turn-cadence verification, observed-CP Best-Guess Opponent IV charged damage deltas, and live integer HP Breakpoint/Bulkpoint pills across Full & Compact HUDs.',
    icon: '🟣',
    accentColor: '#A855F7',
    highlights: [
      'Zero-allocation 24×16 3D HSV + temporal RGB motion Shadow aura scanner on the Vision thread with purple-species, foreground Shadow bleed (12×8 probe), and Ghost/purple VFX confounder gates',
      'Separated manual user Shadow locks (🔒) from PvPoke priors and auto-verified provenance (✓), with unshielded incoming/outgoing charged & fast ΔHP verification and retroactive timeline sync',
      'Stat-stage-aware Joint (FastMove × ShadowState) + 1t–5t interval cadence evaluator preventing false non-standard fast move overrides under unresolved Shadow states or stat buffs/debuffs',
      'Observed-CP Best-Guess Opponent IV narrowing driving live charged ivDeltaPct (↑/↓), CMP, Shield Decision Overlay math, and Option A ±1 HP/hit Breakpoint/Bulkpoint micro-pills across HUD & DVR Replay'
    ]
  },
  {
    version: 'v7.45',
    codename: 'Passive Scroll-Down ELO Auto-OCR Fix, Live GBL Set Counter Sync & Split HUD Touch Keypad',
    date: 'Nov 2026',
    summary: 'Unblocks passive scroll-down ELO auto-OCR on white GBL lobby cards and adjacent battery overlays (-mA), syncs HUD set battle counts (0/5–5/5) directly from Pokémon GO\'s on-screen "X/5 battles played" text, and splits [🎯 ELO (X/5)][✏️] into 1-tap Scan plus a zero-IME in-overlay touch keypad with ± steppers.',
    icon: '🎯',
    accentColor: '#2DD4BF',
    highlights: [
      'Unblocked passive GBL lobby ELO OCR from white-card wake lockout (isWakeTransitionActive), added scroll-sensitive 6×12 luma invalidation, and switched to token-level element parsing with strict CURRENT SEASON header anchoring',
      'Live OCR sync of Pokémon GO\'s on-screen "X/5 battles played" label keeps the HUD set counter (0/5–5/5) accurate even for battles played earlier or across devices, triggering ELO prompts at 5/5 or set wrap',
      'Surfaces once-per-lobby verification feedback when scrolled auto-scan locks an unchanged rating (±0) instead of staying silent',
      'Split [🎯 ELO (X/5)][✏️] idle HUD pill with a native zero-IME 0–9 touch keypad modal featuring -30/-15/-5/+5/+15/+30 steppers and < R20'
    ]
  },
  {
    version: 'v7.44',
    codename: 'Guided Idle HUD ELO Scanner, 5-Battle Set Reprompt & Passive GBL Lobby/Modal OCR Fix',
    date: 'Nov 2026',
    summary: 'Fixes passive idle ELO auto-OCR across waiting/mint-teal GBL lobby frames and 2nd-frame signature locks, adds a clickable idle ELO set-progress chip (N/5) with automatic 5-battle reprompt banner ([📷 Scan ELO], [✓ Same], [⌨️ Type], [✕ Snooze]), Guided 250ms Scroll-to-Scan mode, and forward set-rating stamping with D1 sync.',
    icon: '🎯',
    accentColor: '#2DD4BF',
    highlights: [
      'Fixes 4 passive ELO OCR blockers: isBattleActive="Waiting..." lobby gate, mint/teal gradient pixel gate, 4.5s 2nd-frame self-lock, and adjacent-line/row-neighbor parsing',
      'Clickable 🎯 ELO (N/5) idle chip + automatic 5-battle Set Complete reprompt ([📷 Scan ELO], [✓ Same], [⌨️ Type], [✕ Snooze]) that collapses immediately on 3-2-1 start',
      'Guided 250ms live scroll-to-scan OCR mode (~0.5s lock on scrolled CURRENT SEASON or End-of-Set modal) with haptic confirmation, set delta display, and Cloudflare D1 sync',
      'Native in-overlay numeric ⌨️ Type dialog with < R20 Unranked prompt snooze and forward-only new-set ELO stamping (keeping 120s first-R20 reveal backfill)'
    ]
  },
  {
    version: 'v7.43',
    codename: 'BF Label Streamlining, 2-Row Multi-Cup Anti-Meta & IV Lab Cup Rankings + Overall W-L-T',
    date: 'Nov 2026',
    summary: 'Upgrades Anti-Meta Team Builder and IV Lab with 2-row GL/UL/ML/ALL -> Open + Limited multi-cup filters with strict Row 2 pruning, adds Shadow-aware Cup #Rank and Overall (7-Shield / Even 3) W-L-T records + Combined Multi-Cup summaries, abbreviates Battle Frontier labels to BF everywhere, and streamlines workspace release verification.',
    icon: '⚖️',
    accentColor: '#06B6D4',
    highlights: [
      '2-row multi-select GL / UL / ML / ALL + Open & Limited Cup filters with strict Row 2 visibility pruning in both Anti-Meta Team Builder and IV Lab across Android and Web',
      'Shadow-aware Cup #Rank (exact league lookup) and Overall (7-Shield / Even 3) W-L-T + ±ΔW vs R1 summary bars on every IV Lab candidate card plus Combined Multi-Cup Summary',
      'Clean "BF" abbreviation (BF (Spectral), BF (Cauldron), BF (Master)) across Android APK, HUD, Web Simulator, Marketing site, and Cloudflare DVR while preserving canonical sync keys',
      'Streamlined workspace docs, modular skills, archived pre-v7 changelog, and automated pre-commit release parity verification (npm run release:check)'
    ]
  },
  {
    version: 'v7.42',
    codename: 'Mimikyu Disguise vs. Shield Latch, Post-Charge Lethal KO Sync, Early 3-2-1 Wake-Up & Clean League Labels',
    date: 'Nov 2026',
    summary: 'Resolves Mimikyu Disguise vs. Protect Shield desyncs with a two-way ambiguous-block latch and refund safety net, adds post-charge lethal KO / replacement & Morpeko form-shift HP sync, wakes 3-2-1 countdowns at "3"/"2" on 3v3 Pokeballs or explicit-CP nameplates, updates nightly audit classifiers, and removes CP limit suffixes from league/cup labels across Android, Web, and DVR.',
    icon: '🛡️',
    accentColor: '#A855F7',
    highlights: [
      'Two-way ambiguous-"BLOCKED!" Mimikyu Disguise vs. Protect Shield latch with pixel shield disambiguation, StatStageChange defender preference, and +1 shield refund safety net',
      'Post-user-charge 2-frame lethal KO HP commit, fainted-defender replacement guard against false switch-catches, and Morpeko Hangry/Full Belly transition hold',
      'Early "3"/"2" countdown wake-up via 3v3 opening Pokeballs or explicit-CP nameplate visibility with 150ms idle burst OCR',
      'Clean league & cup labels without CP limit suffixes across Android, Web Simulator, and Cloudflare DVR Replay Theater'
    ]
  },
  {
    version: 'v7.41',
    codename: '3-Way ELO-Weighted Crowd Meta Fusion, Non-Standard Moveset Spice Detection & In-App APK Update Notifier',
    date: 'Nov 2026',
    summary: 'Introduces 3-way ELO-weighted crowd meta and moveset blending across Android, Web Simulator, and Cloudflare D1, idle-only GBL ELO Auto-OCR with Rank-20 reveal backfill, Spice Badge non-standard moveset highlights on Battle Log cards, and automated in-app APK update alerts.',
    icon: '🎯',
    accentColor: '#F59E0B',
    highlights: [
      'Idle-only GBL ELO Auto-OCR on End-of-Set modals & scrolled Current Season badges (plus 120s Rank-20 backfill & cross-device D1 sync), zero active-combat CPU overhead',
      '3-way meta & moveset fusion blending Recency-weighted personal season logs, ELO-weighted Cloudflare D1 crowd telemetry (/v1/meta/crowd-elo), and PvPoke baselines for Anti-Meta Team Generation & Live HUD / Shield Decision Overlays',
      'Observed opponent fast & charged moveset persistence on battle logs with clean 🌶️ Spice badges for confirmed non-standard moves',
      'Automated In-App APK Update Notifier (/v1/version/latest) in MainActivity with release changelog highlights, manual Settings check, and 1-tap dl.silphscopepvp.com download'
    ]
  },
  {
    version: 'v7.40',
    codename: '45s Switch Clock, 15Hz High-Perf Burst Vision, Instant Shield OCR, Cutscene Swap-Catch & Back-to-Back Charge HP Sync',
    date: 'Nov 2026',
    summary: 'Upgrades GBL live combat telemetry across Android and Web Simulator with the 45s switch cooldown, default High-Perf 15Hz vision + 150ms burst OCR (with optional Battery Saver toggle), early 3-2-1 lead locking & Turn-0 swap preservation, immediate mid-cutscene BLOCKED! shield decrements, cutscene swap-catch tracking, back-to-back charge HP commits, and synchronous backline prediction updates.',
    icon: '⚡',
    accentColor: '#38BDF8',
    highlights: [
      '45s GBL switch cooldown across all Android HUD/midpoint clocks, Web Simulator timers, docs, and haptics + 2-frame cutscene swap-catch unlock',
      'Default High-Perf 15Hz (66ms) vision loop & 150ms OCR burst (cutscenes, 3-2-1 intro, swaps, >=12% HP jumps, Pokeball transitions) with cloud-synced Battery Saver toggle',
      'Early 3-2-1 lead lock on nameplate + explicit CP and tightened opening self-correction preserving genuine Turn-0 swaps',
      'Immediate mid-cutscene BLOCKED! shield decrement (deduplicated with finalization & Mimikyu Disguise safe), switch-fade shield guard, match-ending KO HP sync, and atomic backline prediction updates'
    ]
  },
  {
    version: 'v7.39',
    codename: '7-Scenario Asymmetric Shield Flips, Fast Move BP/Bulkpoint Lists & Matchup Tier Outliers',
    date: 'Nov 2026',
    summary: 'Refines the IV Lab Multi-IV Matrix breakdown across Android and Web Simulator by replacing generic non-flipping BR noise with 4 focused categories: Fast Move Breakpoints & Bulkpoints split by Pokémon, 7-scenario realistic asymmetric shield-tree Win/Loss flips, sensitivity-tunable Matchup Tier Outliers, and CMP tie flips.',
    icon: '🎯',
    accentColor: '#14B8A6',
    highlights: [
      '4-Category Segmented Breakdown (Fast BP/Bulk, Shield Flips, Tier Outliers, CMP) removing noisy generic non-flipping BR drift rows',
      'Fast Move Breakpoints & Bulkpoints explicitly organized by Pokémon with corrected damage-taken signs and color coding',
      '7-Scenario Asymmetric Shielding Tree (0v0, 1v1, 2v2, 1v0, 0v1, 2v1, 1v2) with 7 Realistic vs Even 3 scope toggle and per-shield before/after BR deltas',
      'Sub-Tier Matchup Outlier detection (Strong/Solid/Soft W & Close/Solid/Strong L) with configurable ≥35/≥40/≥50/≥75 BR sensitivity'
    ]
  },
  {
    version: 'v7.38',
    codename: 'IV Lab (Multi-IV Matrix & Breakpoint Engine), Universal 3-Box IV Inputs & My Built Pokémon Roster',
    date: 'Nov 2026',
    summary: 'Introduces the new IV Lab tab next to Meta across both Android and Web Simulator featuring side-by-side Multi-IV Matrix evaluation against Rank #1 Stat Product and custom candidate spreads, fast-move Breakpoints/Bulkpoints and CMP tie flips, universal 3-box [ATK][DEF][STA] inputs with real-time auto-CP recalculation, and Cloudflare D1-synced Built Pokémon roster linking.',
    icon: '⚖️',
    accentColor: '#14B8A6',
    highlights: [
      'Multi-IV Matrix Evaluator (GL, UL, ML & active cups) comparing Rank #1 Stat Product and custom candidates side-by-side across 0v0/1v1/2v2 shields',
      'Automated Fast Move Breakpoint (+1 dmg), Bulkpoint (-1 dmg taken), CMP Flip, and Extra Charged-Cycle Survival matchup surfacing',
      'Universal 3-box [ATK][DEF][STA] numeric inputs + optional 0–15 dropdowns + Best Buddy Lv51 toggle with instant league optimal CP/Level solving',
      'My Built Pokémon Roster supporting multi-copy specimens, 1-click Save Built, smart Team Builder & Show 6 auto-fill, and Cloudflare D1 Vault delta sync'
    ]
  },
  {
    version: 'v7.37',
    codename: 'Instant Pre-Battle Wake-Up, Zero-Lock 30 FPS Hardware DVR & Combat Energy/Shield Hardening',
    date: 'Nov 2026',
    summary: 'Eliminates v7.34–v7.35 CPU optimization regressions with unconditional 100ms intro detection and screen dim/flash wake-up, zero-contention hardware DVR Surface scaling, full-corridor HP scanning, MainLooper payload serialization, and four live combat energy/shield fixes (plus Cloud DVR Vault upload auth & retry queueing).',
    icon: '🚀',
    accentColor: '#38BDF8',
    highlights: [
      'Unconditional 100ms pre-battle intro countdown checks + 6x6 luma dim/white-flash wake-up & turn-0 "Go, <Species>!" lead registration safety net',
      'Zero-contention 30 FPS VIP hardware Surface DVR scaling outside captureLock + MainLooper-serialized HUD payload pushes + full-corridor zero-alloc HP scanning',
      '1-turn fast-move floor-quantization guard with pre/post-banner EPT feasibility revert, non-backward snuck-move energy tracking, and turn-scaled deficit promotion',
      'OCR-confirmed BLOCKED! shield lock preventing post-cutscene fast moves from refunding spent shields, plus Cloud DVR Vault upload auth & retry queueing'
    ]
  },
  {
    version: 'v7.36',
    codename: 'True 1.0x Real-Time 30 FPS DVR Playback & Trace Serialization Fix',
    date: 'Nov 2026',
    summary: 'Resolved a v7.35 JSON serialization substring slicing bug causing trailing videoElapsedMs:0 in deep frame traces and slow-motion replay playback, locked mp4TimeCompressionRatio to 1.0x for modern recordings, and added automated daily DVR trace integrity auditing.',
    icon: '⚡',
    accentColor: '#38BDF8',
    highlights: [
      'Eliminated string-slicing trace serialization in BattleDvrEngine in favor of clean gson.toJson(finalTrace)',
      'Guaranteed accurate non-duplicate videoElapsedMs timestamps in all recorded _deep_trace.jsonl lines',
      'Locked mp4TimeCompressionRatio = 1.0f in MainActivity for modern v7.02+ (versionCode >= 1702) recordings',
      'Restored flawless 1.0x real-time 30 FPS playback in In-App and Web Replay viewers without artificial slow-motion',
      'Added automated nightly DVR trace integrity scanner auditing JSON serialization and timing spans'
    ]
  },
  {
    version: 'v7.35',
    codename: 'Decoupled 30 FPS VIP & 15 FPS Standard Hardware DVR Ticker',
    date: 'Nov 2026',
    summary: 'Decoupled GBLBattleDvrThread from the 100ms vision loop with fractional postAtTime pacing and locked 30 FPS Smooth (900 kbps CBR) VIP DVR, eliminating VFR stutter and hardening tier persistence.',
    icon: '🎥',
    accentColor: '#A855F7',
    highlights: [
      'Decoupled GBLBattleDvrThread operating on dedicated drift-free fractional postAtTime pacing',
      'True constant-frame-rate 30.0 FPS VIP DVR (900 kbps CBR) and 15.0 FPS Standard DVR (720 kbps CBR)',
      'Single-pass MediaProjection captureLock with dedicated reusableVisionScreenBitmap & dvrScaledBitmap',
      'Locked VIP / Coach Pass DVR strictly to 30 FPS Smooth, removing legacy 15 FPS toggle and auto-resetting prefs',
      'Hardened Cloud Vault and Replay List tier persistence checks across sync sessions'
    ]
  },
  {
    version: 'v7.34',
    codename: 'Older-Phone CPU & Memory Engine + Species-Clause Backline Predictor',
    date: 'Nov 2026',
    summary: 'Zero-allocation active-battle vision & OCR packing, 2-stage floating HP row-lock corridor windowing, WebView GPU compositor relief, and Species-Clause consolidated semi-dynamic backline predictions — keeping exact 100ms/67ms/33ms scan cadences and native resolution.',
    icon: '🚀',
    accentColor: '#2DD4BF',
    highlights: [
      'Zero-allocation screen capture, OCR sub-crop packing & reusable 544×1184 hardware H.264 DVR frame buffers',
      '2-stage HP Row-Lock corridor windowing (±14px fast lock with instant same-tick full-corridor fallback)',
      'Removed floating WebView backdrop-filter blur over live 60 FPS video + coalesced IPC & Stealth WebView pause',
      'Species-Clause Pokédex family consolidation in Backline Predictor eliminating Shadow+Normal duplicate pairs',
      'Automated daily Semi-Dynamic & Species-Clause audit verifying live weakness coverage, PvPoke blend & mid-battle updates'
    ]
  },
  {
    version: 'v7.33',
    codename: 'True O(Δ) Cloud Vault & DVR Delta Sync + Instant Cold-Start Launch',
    date: 'Nov 2026',
    summary: 'End-to-end O(Δ) delta synchronization across Cloudflare D1 Vaults and Cloud R2 DVR Replay Vaults with zero-echo D1 short-circuiting, instant local cache hydration, and Main-thread cold-start optimizations.',
    icon: '⚡',
    accentColor: '#2DD4BF',
    highlights: [
      'True O(Δ) Cloudflare D1 Vault push & pull across Android and Web Simulator with zero-echo D1 short-circuiting',
      'Manual syncs run fast delta syncs by default with a dedicated Force Full Vault Resync troubleshooting option',
      'Cloud R2 DVR Replay Vault delta API (?since=...&delta=1) + instant local cache hydration on Android & Web',
      'Eliminated read-path Cloudflare KV writes on /v1/replays/list unless quota pruning evicted expired items',
      'Instant Android cold-start & resume via self-invalidating Battle Log/Telemetry caches and off-thread DVR stats'
    ]
  },
  {
    version: 'v7.32',
    codename: 'Modular Compact HUD Customizer, CMP-Tie HP Precision & Clean Replay Timelines',
    date: 'Nov 2026',
    summary: 'Modular Compact HUD Customizer with 3 quick presets and 6 independent multi-select element chips synced across Live Overlay, DVR Replay Theater, and Cloudflare D1 Vaults, CMP-tie 1-frame post-charge HP commit precision, and pruned post-battle DVR timelines.',
    icon: '🧩',
    accentColor: '#2DD4BF',
    highlights: [
      'Modular Compact HUD Customizer: 3 quick presets (Minimal, Coach + Opp, Full-Lite) + 6 independent element chips',
      'Independently show/hide Opp Attacks, My Attacks, 2-Line Coach, 3x3 Matrix, Move Pacing strip, and DVR/Action Bar',
      'Instant live WebView updates without restarting the overlay + synced across devices via Cloudflare D1 Vault Sync',
      'CMP-Tie 1-Frame Post-Charge HP Commit Fix ensuring accurate opponent HP during immediate CMP Attack incoming! prompts',
      'Pruned post-battle DVR timeline events and streamlined Vault Password web/PWA authentication'
    ]
  },
  {
    version: 'v7.31',
    codename: 'Cloudflare D1 Multi-Device Vault Sync & Global Meta Analytics',
    date: 'Nov 2026',
    summary: 'Zero-GitHub multi-device cloud delta synchronization on Cloudflare D1 for Battle Logs, Team Presets, and App Settings with passwordless initial migration, salted PBKDF2 Vault Password security, and structured SQL meta analytics.',
    icon: '☁️',
    accentColor: '#38BDF8',
    highlights: [
      'Cloudflare D1 Delta Sync (/v1/sync/vault) replacing GitHub Gist/Repo sync with zero GitHub token required',
      'Seamless passwordless initial vault migration + in-app prompt to lock vault with a PBKDF2-SHA256 password',
      'Hardware Keystore AES-256-GCM session token protection across Android and Web Simulator',
      'Incremental cursor-based row sync staying well inside Cloudflare Free Tier limits (0 KV sync writes)',
      'Structured D1 battle_logs columns powering future userbase-wide league & ELO meta analytics'
    ]
  },
  {
    version: 'v7.30',
    codename: 'Log-Only Tournament Stealth Mode & 2-State HUD Emblem Redesign',
    date: 'Nov 2026',
    summary: 'Tournament-compliant Log-Only Stealth Mode for official Play! Pokémon and Show 6 play with 100% invisible HUD and silenced haptics, seamless headless background DVR and auto-logging, simplified 2-state HUD emblem toggle, and 1-tap post-battle Battle Log navigation.',
    icon: '🔕',
    accentColor: '#10B981',
    highlights: [
      'Log-Only Stealth Mode for official Play! Pokémon & Show 6 tournament compliance',
      '100% invisible overlay (View.GONE) and zero haptic vibrations or alerts during live play',
      'Headless background vision, pixel HP/energy tracking, and hardware H.264 DVR + _deep_trace.jsonl',
      'Redesigned HUD Emblem: Single-tap strictly alternates Full HUD ↔ Compact HUD; 2.0s hold toggles Log-Only Stealth Mode',
      'Post-Battle Summary 1-Tap "📊 Battle Log" button to stop overlay and open battle history'
    ]
  },
  {
    version: 'v7.20 – v7.29',
    codename: 'Dual-Source Precision, Hands-Free DVR & Issue Flagging/Unflagging',
    date: 'Nov 2026',
    summary: 'Hands-free auto-start battle DVR on intro countdown across all tiers, 1-tap issue report flagging & unflagging across App/Vault/Web, symmetric dual-source energy auditing, and swap-and-throw pre-floor energy restoration.',
    icon: '⚡',
    accentColor: '#2DD4BF',
    highlights: [
      'Auto-Start Battle DVR (Hands-Free on "3... 2... 1... BATTLE!" countdown for all tiers)',
      '1-Tap Issue Flagging & Unflagging across Android App, Cloud DVR Vault, and Web Replay Theater',
      'Dual-Source Energy Tracking (E_meter vs. E_hp) with asymmetric shield-call promo',
      'Swap-and-Immediate-Throw rollback restoring true pre-cutscene energy',
      'Dynamic over-the-air daily battle survey question pool & AI settings sync',
    ]
  },
  {
    version: 'v7.00 – v7.14',
    codename: 'Cloud DVR Replay Vault & 4-Tier Community Architecture',
    date: 'Nov 2026',
    summary: 'Cloudflare R2 synchronized web replay theater, 30 FPS smooth hardware H.264 DVR encoding, and fair community pricing with permanent Alumni perks.',
    icon: '☁️',
    accentColor: '#38BDF8',
    highlights: [
      'Cloud R2 Replay Vault (/vault & /watch/:shareId) with synchronized 50% HUD player',
      'Hardware H.264 AVC zero-overhead encoder (15 FPS saver / 30 FPS smooth)',
      'Community-First pricing ($2 Supporter, $3–$6 Pro, $5–$10 VIP) with Alumni unlock',
      'Multi-League Mega/Master floating HP-bar tracking geometry',
    ]
  },
  {
    version: 'v6.00 – v6.51',
    codename: '4-Pillar AI Tactical Coach & Super Mega Plus Moves',
    date: 'Early Nov 2026',
    summary: 'Ultra-compact 2-line in-game tactical recommendations, synchronized cadence haptics, and complete BF / Show 6 mode support.',
    icon: '🧠',
    accentColor: '#A78BFA',
    highlights: [
      '4-Pillar AI Coach: Backline predictions, lead alignment risk & turn warnings',
      'Synchronized haptics engine (single pulse on switch clock, double pulse on imminent move)',
      'Lead-Loss Recovery Rate & Safe-Swap MVP post-battle analytics',
      'Super Mega Plus Move (Lv1..Lv4) asymmetric scaling & 9-shield matrix integration',
    ]
  },
  {
    version: 'v4.00 – v5.13',
    codename: 'Shield Decision Overlay & BF Show 6',
    date: 'Late Oct 2026',
    summary: 'Cutscene-gated "Attack incoming!" instant shield math, Show 6 tournament roster drafting, and 100E ceiling step latching.',
    icon: '🛡️',
    accentColor: '#F59E0B',
    highlights: [
      '🛡️ "Attack Incoming!" instant shield/tank calculator during swipe minigames',
      'Show 6 Mode with AI suggestions, pick-3 matrix, and saved opponent rosters',
      'Sub-50E multi-round energy tracking up to 100E ceiling latch',
      'Active battle OCR throttling with high-frequency 100ms pixel HP loop',
    ]
  },
  {
    version: 'v2.00 – v3.99',
    codename: 'Asymmetric 9-Shield Matrix, BMF & Real-Time Pixel Scanner',
    date: 'Mid Oct 2026',
    summary: 'Breakthrough 9-shield combat matrix (0v0 to 2v2), Blind Matchup Favorability (BMF), Dynamic Execution WAE, and low-latency floating HP scanner.',
    icon: '📊',
    accentColor: '#10B981',
    highlights: [
      'Full 9-Shield Matrix evaluating (s_user, s_opp) across all shield states',
      'Objective skill metrics: BMF (matchup luck) vs. WAE (turn execution skill)',
      'Zero-lag horizontal row-lock pixel HP scanner with monotonic clamp',
      'Multi-Device GitHub Gist cloud delta sync for teams and battle logs',
    ]
  },
  {
    version: 'v1.00 – v1.30',
    codename: 'Genesis: Floating PvP HUD & Live PvPoke Engine',
    date: 'Early Oct 2026',
    summary: 'The original lightweight Android floating overlay with real-time PvPoke battle ratings, 3x3 matchup table, and team manager.',
    icon: '🚀',
    accentColor: '#94A3B8',
    highlights: [
      'Android floating overlay (TYPE_APPLICATION_OVERLAY) over Pokémon GO',
      'Live PvPoke combat math and dynamic rankings sync',
      '3x3 matrix showing type matchups and damage percentages',
      'One-tap team builder with Great, Ultra, and Master League presets',
    ]
  }
];

export const ACTIVE_ROADMAP_ITEMS: RoadmapItem[] = [
  {
    id: 'dual-screen-telemetry',
    title: 'Real-Time Dual-Screen Telemetry Streaming',
    badge: 'COACH & STREAMER',
    status: 'Researching',
    statusColor: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
    category: 'Networking & Web',
    icon: '📡',
    description: 'Stream live combat telemetry (HP, turns, energy, 9-shield matrix) to a companion laptop, second phone, or OBS browser source over ultra-low latency local LAN WebSocket.',
    keyGoals: [
      'Zero-clutter primary mobile screen while companion laptop displays full HUD',
      'Real-time practice partner & coach spectator view with live turn clocks',
      'Streamer OBS browser dock integration without covering phone display'
    ]
  },
  {
    id: 'dual-device-calibration-lab',
    title: 'Dual-Device Symmetrical Practice Lab (Ground-Truth Energy Calibration)',
    badge: 'LAB & CALIBRATION',
    status: 'In Design',
    statusColor: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
    category: 'Lab & Diagnostics',
    icon: '🧪',
    description: 'Sync two test accounts in direct friend battles to cross-validate Phone A tracked opponent energy against Phone B actual player meter, refining millisecond turn pacing and snuck fast-move attribution.',
    keyGoals: [
      'Paired QR / 4-digit calibration room linking two testing devices simultaneously',
      'Frame-by-frame ground truth comparison: Tracked Opponent E vs. Actual User E',
      'Automated delta reporting for snuck moves, catch-up latency, and debounce tuning'
    ]
  }
];
