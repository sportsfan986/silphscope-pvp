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
    version: 'v7.44',
    codename: 'Guided Idle HUD ELO Scanner, 5-Battle Set Reprompt & Passive GBL Lobby/Modal OCR Fix',
    badge: 'CURRENT',
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
    id: 'shadow-detect',
    title: 'Shadow Pokémon State Detection',
    badge: 'VISION PIPELINE',
    status: 'Planned',
    statusColor: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
    category: 'HUD / Combat Engine',
    icon: '🟣',
    description: 'Automatic classification of base vs. Shadow forms to immediately factor in +20% Atk bonus and -20% Def penalty into break-point calculations and turn-to-KO math.',
    keyGoals: [
      'Upper-right opponent model HSV particle flare sampling on entry',
      'Visual bleed filter when player active Pokémon is also Shadow',
      'Damage-delta cross-verification with fast-move tracker'
    ]
  },
  {
    id: 'fast-move-damage',
    title: 'Fast Move Damage Tracking & Dynamic Verification',
    badge: 'REAL-TIME MATH',
    status: 'In Design',
    statusColor: 'bg-teal-500/20 text-teal-300 border-teal-500/40',
    category: 'HUD / Combat Engine',
    icon: '⚡',
    description: 'Measure discrete HP bar pixel delta (ΔHP) per fast move cadence tick against theoretical tables to confirm unknown fast moves and verify Shadow status in real time.',
    keyGoals: [
      'Differentiate ambiguous 2-turn & 3-turn move variants instantly',
      'Empirical +20% damage signature to confirm or refute Shadow status',
      'Live stat breakpoint and bulkpoint detection'
    ]
  },
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
  },
  {
    id: 'cross-platform-theme-persistence',
    title: 'Unified Cross-Platform Theme Persistence (Shiny Dialga Default + User Sync)',
    badge: 'DESIGN & SYNC',
    status: 'In Design',
    statusColor: 'bg-teal-500/20 text-teal-300 border-teal-500/40',
    category: 'Analytics & Team Builder',
    icon: '🎨',
    description: 'Ensure Shiny Origin Dialga Midnight remains the default aesthetic everywhere, while persisting custom chosen themes across the Marketing Website, Web Simulator, and personal Cloud Vault for logged-in users.',
    keyGoals: [
      'Shiny Origin Dialga Midnight invariant default for first load & anonymous sessions',
      'Dynamic CSS theme variables applied consistently across Marketing site & Simulator',
      'User theme preference synced across devices via Cloudflare D1 Vault Sync'
    ]
  }
];
