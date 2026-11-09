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
    version: 'v7.20 – v7.26',
    codename: 'Dual-Source Precision & Hands-Free Auto-Start DVR',
    badge: 'CURRENT',
    date: 'Nov 2026',
    summary: 'Hands-free auto-start battle DVR on intro countdown across all tiers, symmetric dual-source energy auditing, swap-and-throw pre-floor energy restoration, and 10 FPS sub-second debouncing.',
    icon: '⚡',
    accentColor: '#2DD4BF',
    highlights: [
      'Auto-Start Battle DVR (Hands-Free on "3... 2... 1... BATTLE!" countdown for all tiers)',
      'Dual-Source Energy Tracking (E_meter vs. E_hp) with asymmetric shield-call promo',
      'Swap-and-Immediate-Throw rollback restoring true pre-cutscene energy',
      'Two-stage compensated predictive GUI & haptic lead time for safe turn alignment',
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
    id: 'log-only-competitive',
    title: 'Log-Only Stealth Mode for Official Play',
    badge: 'TOURNAMENT INTEGRITY',
    status: 'In Design',
    statusColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    category: 'HUD / Compliance',
    icon: '🔕',
    description: 'Comply with official Play! Pokémon tournament rules: completely hides on-screen overlay and suppresses vibration cues while maintaining headless battle recording and automated logging.',
    keyGoals: [
      '100% invisible HUD overlay (View.GONE) and silenced haptics',
      'Headless background vision, OCR, and hardware DVR encoding',
      'Automatic post-match battle log & deep trace generation without manual keying'
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
    title: 'Multi-IV Matrix Evaluator & Breakpoint Analyzer',
    badge: 'META SIMULATOR',
    status: 'In Design',
    statusColor: 'bg-teal-500/20 text-teal-300 border-teal-500/40',
    category: 'Analytics & Team Builder',
    icon: '⚖️',
    description: 'Multi-select league comparison (GL, UL, ML) evaluating candidate IV spreads side-by-side against the Top 100 meta, outputting W/L records, net flip matchups, and key Fast Move breakpoints/bulkpoints.',
    keyGoals: [
      'Multi-IV candidate input comparing stat-product vs. attack-weight vs. bulk spreads',
      'Top 100 synthetic meta win/loss/tie record comparison across shield scenarios',
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
      'Cloud Delta Sync across multiple devices via GitHub private vault'
    ]
  }
];
