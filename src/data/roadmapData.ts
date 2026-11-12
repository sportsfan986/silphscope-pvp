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
    version: 'v7.36',
    codename: 'True 1.0x Real-Time 30 FPS DVR Playback & Trace Serialization Fix',
    badge: 'CURRENT',
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
    summary: 'Ultra-compact 2-line in-game tactical recommendations, synchronized cadence haptics, and complete Battle Frontier / Show 6 mode support.',
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
    codename: 'Shield Decision Overlay & Battle Frontier Show 6',
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
    id: 'non-std-moves-elo',
    title: 'Non-Standard Movesets & ELO-Weighted Meta Feeding',
    badge: 'ADAPTIVE META',
    status: 'Planned',
    statusColor: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    category: 'Analytics & Team Builder',
    icon: '🎯',
    description: 'Detect spicy/off-meta movesets, weight moveset frequencies by player ELO band, and feed real-world ladder data into the Anti-Meta Generator and Expected Moveset HUD.',
    keyGoals: [
      'Dynamic ELO bracket moveset weighting (actual ladder vs. paper PvPoke)',
      'Spice Badge highlight in Battle Log cards (zero clutter if standard)',
      'Adaptive shield bait vs. nuke probability matrices in the live HUD'
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
    id: 'iv-checker-matrix',
    title: 'Multi-IV Matrix Evaluator, Breakpoint Analyzer & 3-Field Numeric Input',
    badge: 'META SIMULATOR',
    status: 'In Design',
    statusColor: 'bg-teal-500/20 text-teal-300 border-teal-500/40',
    category: 'Analytics & Team Builder',
    icon: '⚖️',
    description: 'Multi-select league comparison (GL, UL, ML) evaluating candidate IV spreads side-by-side against the Top 100 meta with real-time auto-CP recalculation, 3 numeric IV fields (Atk/Def/Sta) or dropdown pickers, W/L delta records, and Fast Move breakpoint/bulkpoint highlighting.',
    keyGoals: [
      'Universal 3-box numeric IV inputs [Atk][Def][Sta] with optional 0–15 dropdown selector',
      'Real-time automatic CP and Level recomputation upon IV adjustment',
      'Top 100 synthetic meta win/loss/tie record comparison & net flip matchups',
      'Automated Fast Move breakpoint (+1 dmg) & bulkpoint (-1 dmg taken) delta highlighting'
    ]
  },
  {
    id: 'built-pokemon-roster-ivs',
    title: 'Built Pokémon IV Storage & Roster Integration',
    badge: 'TEAM BUILDER & SYNC',
    status: 'In Design',
    statusColor: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
    category: 'Analytics & Team Builder',
    icon: '📦',
    description: 'Save exact built IV spreads (Atk/Def/Sta + Level) from the IV checker or team builder into a personal roster, feeding true CMP ties and precise damage intake into all team sims.',
    keyGoals: [
      '1-Click "Save to Built Roster" from the Multi-IV Matrix Evaluator',
      'Team Preset integration: attach actual owned IVs to custom team slots',
      'Cloud Delta Sync across multiple devices via Cloudflare D1 Vault'
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
    id: 'in-app-apk-update-checker',
    title: 'In-App APK Update Notifications, Changelog Summary & Direct Download',
    badge: 'ANDROID NATIVE',
    status: 'In Design',
    statusColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    category: 'HUD / Combat Engine',
    icon: '📲',
    description: 'Automated in-app alert inside MainActivity notifying players when a newer APK is available, displaying high-level release notes and a 1-tap download link to dl.silphscopepvp.com.',
    keyGoals: [
      'Remote version check against GitHub Releases / Cloudflare API on startup',
      'Dismissible update card with bulleted highlights of fixes and new features',
      '1-tap direct APK download and install trigger via dl.silphscopepvp.com'
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
      'User theme preference synced across devices via Cloudflare profile metadata & GitHub vault'
    ]
  }
];
