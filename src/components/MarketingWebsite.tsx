import React, { useState, useEffect } from 'react';
import { VersionRoadmapInfographic } from './VersionRoadmapInfographic';

export type MarketingSubpage = 'vault' | 'home' | 'live' | 'guide' | 'compare';

export interface MarketingWebsiteProps {
  activeSubpage: MarketingSubpage;
  onSelectSubpage: (page: MarketingSubpage) => void;
  onLaunchWebApp: (initialTab?: 'simulator' | 'presets' | 'battle_log' | 'settings' | 'meta' | 'help' | 'math_validator') => void;
  onOpenMembershipModal: () => void;
  webScreenName: string;
  onChangeWebScreenName: (name: string) => void;
  webMembershipTier: 'free' | 'supporter' | 'pro' | 'vip';
}

export interface DvrReplayItem {
  shareId: string;
  battleId?: string;
  screenName?: string;
  league: string;
  result: 'WIN' | 'LOSS' | string;
  matchupSummary: string;
  durationSec: number;
  videoBytes: number;
  isPinned?: boolean;
  isPublic?: boolean;
  userTierBadge?: string;
  userIssueNote?: string;
  diagnosticReason?: string;
  highlightSec?: number;
  videoStreamUrl?: string;
  traceStreamUrl?: string;
  shareUrl?: string;
  createdAt?: string;
}

const CANONICAL_FEATURED_REPLAYS: DvrReplayItem[] = [
  {
    shareId: 'f_ml_closer',
    battleId: 'log-1794105062689-388',
    screenName: 'Featured',
    league: 'Mega Master League (10000)',
    result: 'WIN',
    matchupSummary: 'Dialga (Origin), Lugia, Kyogre (Primal) vs Zekrom, Kyogre (Primal), Dialga (Origin) • 4 anomalies',
    durationSec: 191,
    videoBytes: 12655475,
    isPinned: true,
    isPublic: true,
    userTierBadge: '🌟 Official Showcase • Shiny Dialga & Closer Swap',
    highlightSec: 100,
    videoStreamUrl: 'https://dvr.silphscopepvp.com/v1/replays/stream/f_ml_closer/video.mp4',
    traceStreamUrl: 'https://dvr.silphscopepvp.com/v1/replays/stream/f_ml_closer/trace.jsonl',
    shareUrl: 'https://dvr.silphscopepvp.com/watch/f_ml_closer'
  },
  {
    shareId: 'f_ul_shield',
    battleId: 'log-1794012768340-568',
    screenName: 'Featured',
    league: 'Mega Ultra League (2500)',
    result: 'WIN',
    matchupSummary: 'Tinkaton, Mimikyu, Swampert vs Greninja, Giratina (Altered), Mewtwo (Armored) • 3 anomalies',
    durationSec: 182,
    videoBytes: 27582434,
    isPinned: true,
    isPublic: true,
    userTierBadge: '🌟 Official Showcase • Shield Call & Backline Predictor',
    highlightSec: 44,
    videoStreamUrl: 'https://dvr.silphscopepvp.com/v1/replays/stream/f_ul_shield/video.mp4',
    traceStreamUrl: 'https://dvr.silphscopepvp.com/v1/replays/stream/f_ul_shield/trace.jsonl',
    shareUrl: 'https://dvr.silphscopepvp.com/watch/f_ul_shield'
  },
  {
    shareId: 'f_gl_debuff',
    battleId: 'log-1794105418391-578',
    screenName: 'Featured',
    league: 'GREAT LEAGUE',
    result: 'WIN',
    matchupSummary: 'Kanto Ninetales, Fearow, Shadow Pidgeot vs Milotic, Corviknight, Shadow Drifblim',
    durationSec: 288,
    videoBytes: 18613976,
    isPinned: true,
    isPublic: true,
    userTierBadge: '🌟 Official Showcase • Debuff Math',
    highlightSec: 118,
    videoStreamUrl: 'https://dvr.silphscopepvp.com/v1/replays/stream/f_gl_debuff/video.mp4',
    traceStreamUrl: 'https://dvr.silphscopepvp.com/v1/replays/stream/f_gl_debuff/trace.jsonl',
    shareUrl: 'https://dvr.silphscopepvp.com/watch/f_gl_debuff'
  }
];

interface HeroShowcaseSlide {
  id: string;
  label: string;
  shortLabel: string;
  league: string;
  gifPath: string;
  posterPath: string;
  watchUrl: string;
  highlightUrl: string;
  caption: string;
  callouts: string[];
}

const HERO_SLIDES: HeroShowcaseSlide[] = [
  {
    id: 'shiny_dialga',
    label: '✨ Shiny Origin Dialga • Roar of Time Pacing (Mega ML)',
    shortLabel: '✨ Shiny Dialga (ML)',
    league: 'MEGA MASTER LEAGUE',
    gifPath: 'screenshots/featured_hero_shiny_dialga.gif',
    posterPath: 'screenshots/featured_hero_shiny_dialga_poster.png',
    watchUrl: 'https://dvr.silphscopepvp.com/watch/f_ml_closer',
    highlightUrl: 'https://dvr.silphscopepvp.com/watch/f_ml_closer?t=18',
    caption:
      '50% Translucent Shiny Origin Dialga HUD over live Mega Master League combat: Roar of Time (65E) READY (100% KO on Zekrom) with 1-Fast Throw Alert & Live Backline Predictor.',
    callouts: [
      '50% Translucent HUD: Opponent CP & HP bars remain 100% visible through the glass',
      'Turn-Exact Alert: "1 LAST FAST -> THROW RoTime NOW! Beat Opp FsBolt"',
      'Live Backline Predictor: "Back: ZAC-C 22% PAL-O 15%" (100% Free in Open Leagues)'
    ]
  },
  {
    id: 'ul_shield',
    label: '🛡️ Shield Decision Call & Disguise Bust (Mega UL)',
    shortLabel: '🛡️ Shield & Bust (UL)',
    league: 'MEGA ULTRA LEAGUE',
    gifPath: 'screenshots/featured_ul_disguise_shield.gif',
    posterPath: 'screenshots/featured_ul_disguise_shield_poster.png',
    watchUrl: 'https://dvr.silphscopepvp.com/watch/f_ul_shield',
    highlightUrl: 'https://dvr.silphscopepvp.com/watch/f_ul_shield?t=44',
    caption:
      'Mimikyu vs. Altered Giratina: Real-time Disguise Bust tracking, Shield Decision verdict, and live 3rd-slot Backline Prediction ("3rd: TINKA 16% FLRG 12%").',
    callouts: [
      'Automatic Mimikyu Disguise Bust & stage tracking in the live header',
      'Asymmetric 9-Shield Matrix (0S/1S/2S) updates dynamically as shields drop',
      'Instant 2-Line AI Coach: "[ABC] STAY IN (PlyRgh) • Farm Locked Opp (34s)"'
    ]
  },
  {
    id: 'gl_debuff',
    label: '📉 Multi-Stage Debuff Math A-2 vs A-1 (Great League)',
    shortLabel: '📉 Debuff Math (GL)',
    league: 'GREAT LEAGUE',
    gifPath: 'screenshots/featured_gl_debuff_math.gif',
    posterPath: 'screenshots/featured_gl_debuff_math_poster.png',
    watchUrl: 'https://dvr.silphscopepvp.com/watch/f_gl_debuff',
    highlightUrl: 'https://dvr.silphscopepvp.com/watch/f_gl_debuff?t=118',
    caption:
      'Shadow Pidgeot (Atk -2) vs. Shadow Drifblim (Atk -1): Every move damage cell scales in real time as Feather Dance & Icy Wind debuffs stack.',
    callouts: [
      'Real-Time Stage Scaling: Tracks [-4..+4] Attack & Defense stages per slot',
      'Incoming Survival Math: "[SHIELD] TANK (0S) -> Twister IN 2F • Survives at 64% HP"',
      'Tracks banked energy & HP across all 3 opponent slots simultaneously'
    ]
  },
  {
    id: 'ml_closer',
    label: '🔄 Instant Closer Swap Alignment (Mega ML)',
    shortLabel: '🔄 Closer Swap (ML)',
    league: 'MEGA MASTER LEAGUE',
    gifPath: 'screenshots/featured_ml_closer_align.gif',
    posterPath: 'screenshots/featured_ml_closer_align_poster.png',
    watchUrl: 'https://dvr.silphscopepvp.com/watch/f_ml_closer',
    highlightUrl: 'https://dvr.silphscopepvp.com/watch/f_ml_closer?t=100',
    caption:
      'Lugia KOs Primal Kyogre -> Opponent Origin Dialga enters -> AI Coach immediately signals "[ABB] SWAP -> KYOG TO CLOSE" to seal the endgame.',
    callouts: [
      'Instant Post-KO Alignment Coach: Signals exact switch window before opponent farms energy',
      'Full 3v3 Bench Ledger: Shows Zekrom (0%), Primal Kyogre (0%), and Origin Dialga (100%)',
      'Zero-Lag 30 FPS Hardware H.264 DVR with frame-synced Web Replay Theater'
    ]
  }
];

export const MarketingWebsite: React.FC<MarketingWebsiteProps> = ({
  activeSubpage,
  onSelectSubpage,
  onLaunchWebApp,
  onOpenMembershipModal,
  webScreenName,
  onChangeWebScreenName,
  webMembershipTier
}) => {
  const [selectedHeroIdx, setSelectedHeroIdx] = useState<number>(0);
  const [heroShowStaticPoster, setHeroShowStaticPoster] = useState<boolean>(false);
  const activeHero = HERO_SLIDES[selectedHeroIdx] || HERO_SLIDES[0];

  // PWA (Progressive Web App) Install Hook & Detection (Branded as SilphScope DVR)
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [showInstallModal, setShowInstallModal] = useState<boolean>(false);
  const [isIos] = useState<boolean>(() => {
    try {
      return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
    } catch {
      return false;
    }
  });
  const [isStandalone] = useState<boolean>(() => {
    try {
      return window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  const handleInstallClick = async () => {
    if (installPrompt) {
      try {
        installPrompt.prompt();
        const choice = await installPrompt.userChoice;
        if (choice.outcome === 'accepted') {
          setInstallPrompt(null);
        }
      } catch {
        setShowInstallModal(true);
      }
    } else {
      setShowInstallModal(true);
    }
  };

  // DVR Replay Vault State
  const [vaultUser, setVaultUser] = useState<string>(() => {
    try {
      return (new URLSearchParams(window.location.search).get('user') || webScreenName || 'Featured').trim();
    } catch {
      return 'Featured';
    }
  });
  const [vaultInputUser, setVaultInputUser] = useState<string>(vaultUser);
  const [vaultFilter, setVaultFilter] = useState<'all' | 'starred' | 'public'>('all');
  const [vaultReplays, setVaultReplays] = useState<DvrReplayItem[]>(CANONICAL_FEATURED_REPLAYS);
  const [loadingVault, setLoadingVault] = useState<boolean>(false);
  const [vaultStats, setVaultStats] = useState<{ total: number; starred: number; public: number }>({
    total: 3,
    starred: 3,
    public: 3
  });
  const [selectedWatchReplay, setSelectedWatchReplay] = useState<DvrReplayItem | null>(null);
  const [ownerLoginOpen, setOwnerLoginOpen] = useState<boolean>(false);
  const [authTab, setAuthTab] = useState<'token' | 'password' | 'github'>('token');
  const [authKey, setAuthKey] = useState<string>('');
  const [authPassword, setAuthPassword] = useState<string>('');
  const [authEmail, setAuthEmail] = useState<string>('');

  const fetchVaultReplays = async (userToFetch: string) => {
    const user = (userToFetch || 'Featured').trim();
    setLoadingVault(true);
    try {
      const res = await fetch(`https://dvr.silphscopepvp.com/v1/replays/list?user=${encodeURIComponent(user)}`, {
        headers: {
          'X-SilphScope-Client-Key': 'ssk_client_v615_telemetry_ingest_9f8a7b6c5d4e3f2a1b0c',
          'X-Trainer-Screen-Name': user
        }
      });
      const data = await res.json();
      if (data && data.ok && Array.isArray(data.items)) {
        setVaultReplays(data.items.length > 0 ? data.items : []);
        setVaultStats({
          total: data.items.length,
          starred: data.totalStarredCount ?? data.items.filter((i: any) => i.isPinned).length,
          public: data.totalPublicCount ?? data.items.filter((i: any) => i.isPublic).length
        });
      } else {
        if (user.toLowerCase() === 'featured') {
          setVaultReplays(CANONICAL_FEATURED_REPLAYS);
        } else {
          setVaultReplays([]);
        }
      }
    } catch {
      if (user.toLowerCase() === 'featured') {
        setVaultReplays(CANONICAL_FEATURED_REPLAYS);
      }
    } finally {
      setLoadingVault(false);
    }
  };

  useEffect(() => {
    if (activeSubpage === 'vault') {
      fetchVaultReplays(vaultUser);
    }
  }, [activeSubpage, vaultUser]);

  // Live View Simulation & Stream State
  const [streamCode, setStreamCode] = useState<string>('SSPVP-LIVE-9042');
  const [isLiveConnected, setIsLiveConnected] = useState<boolean>(false);
  const [isSimulatingLive, setIsSimulatingLive] = useState<boolean>(false);
  const [simTurn, setSimTurn] = useState<number>(0);

  useEffect(() => {
    if (!isSimulatingLive) return;
    const interval = setInterval(() => {
      setSimTurn((t) => (t + 1) % 40);
    }, 500);
    return () => clearInterval(interval);
  }, [isSimulatingLive]);

  const [copiedMsg, setCopiedMsg] = useState<string>('');
  const copyToClipboard = (text: string, label: string = 'Link') => {
    try {
      navigator.clipboard.writeText(text);
      setCopiedMsg(`${label} copied to clipboard!`);
      setTimeout(() => setCopiedMsg(''), 2500);
    } catch {
      setCopiedMsg(`${label} copied!`);
      setTimeout(() => setCopiedMsg(''), 2500);
    }
  };

  const encodedRef = encodeURIComponent((webScreenName || '').trim() || 'trainer');
  const stripeSupporterUrl = `https://buy.stripe.com/4gM3cwf3r8JG7XLamm1Jm07?client_reference_id=${encodedRef}`;
  const stripeProSeasonUrl = `https://buy.stripe.com/8x2aEY8F33pma5TgKK1Jm08?client_reference_id=${encodedRef}`;
  const stripeProIntroUrl = `https://buy.stripe.com/14A4gAcVjf8491P8ee1Jm09?client_reference_id=${encodedRef}`;
  const stripeVipSeasonUrl = `https://buy.stripe.com/9B6fZi3kJ6By4Lzamm1Jm0b?client_reference_id=${encodedRef}`;
  const stripeVipIntroUrl = `https://buy.stripe.com/4gM7sM5sR5xudi5amm1Jm0c?client_reference_id=${encodedRef}`;

  return (
    <div
      className="min-h-screen flex flex-col selection:bg-teal-400/30 selection:text-teal-100"
      style={{
        backgroundColor: '#050B16',
        color: '#ECFEFF',
        backgroundImage:
          'radial-gradient(circle at 18% 12%, rgba(45, 212, 191, 0.11) 0%, transparent 42%), radial-gradient(circle at 82% 18%, rgba(250, 204, 21, 0.08) 0%, transparent 38%), linear-gradient(180deg, #050B16 0%, #081120 55%, #050B16 100%)'
      }}
    >
      {/* Top Sticky Navigation Bar (Shiny Origin Dialga Midnight Theme) */}
      <header
        className="sticky top-0 z-50 backdrop-blur-xl border-b"
        style={{
          backgroundColor: 'rgba(5, 11, 22, 0.88)',
          borderColor: '#19304E'
        }}
      >
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          {/* Brand Logo + Origin Dialga Badge */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => onSelectSubpage('vault')}
              className="flex items-center gap-2.5 text-left group cursor-pointer"
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center border shadow-lg transition-transform group-hover:scale-105"
                style={{
                  backgroundColor: '#0E1B2E',
                  borderColor: '#2DD4BF',
                  boxShadow: '0 0 18px rgba(45, 212, 191, 0.25)'
                }}
              >
                <svg viewBox="0 0 36 36" className="w-7 h-7">
                  <polygon
                    points="18,2 31,9 31,27 18,34 5,27 5,9"
                    fill="rgba(14, 27, 46, 0.9)"
                    stroke="#2DD4BF"
                    strokeWidth="2.2"
                  />
                  <polygon
                    points="18,7 26,12 26,24 18,29 10,24 10,12"
                    fill="none"
                    stroke="#FACC15"
                    strokeWidth="1.8"
                  />
                  <circle cx="18" cy="18" r="3.5" fill="#FACC15" />
                </svg>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-black text-base sm:text-lg tracking-tight text-white">
                    SilphScope <span style={{ color: '#2DD4BF' }}>{activeSubpage === 'vault' ? 'DVR' : 'PvP'}</span>
                  </span>
                  <span
                    className="text-[10px] font-mono font-extrabold uppercase px-2 py-0.5 rounded-full border"
                    style={{
                      color: '#FACC15',
                      borderColor: 'rgba(250, 204, 21, 0.45)',
                      backgroundColor: 'rgba(250, 204, 21, 0.12)'
                    }}
                  >
                    v7.29 • Latest Release
                  </span>
                </div>
                <p className="text-[11px] hidden sm:block" style={{ color: '#99F6E4' }}>
                  {activeSubpage === 'vault'
                    ? 'Cloud Replay Vault • Frame-Synced Video & HUD Overlay'
                    : 'Real-Time 50% Translucent Android HUD • ELO-Adaptive Anti-Meta • Cloud DVR Vault'}
                </p>
              </div>
            </button>
          </div>

          {/* DVR Vault Subpage Streamlined Banner: ONLY links to Main Site, Download APK, Live View */}
          {activeSubpage === 'vault' ? (
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => onSelectSubpage('home')}
                className="px-3.5 py-1.5 rounded-xl font-extrabold text-xs border border-teal-500/40 bg-teal-950/40 text-teal-300 hover:text-white hover:bg-teal-900/50 transition cursor-pointer flex items-center gap-1.5 shadow"
              >
                <span>🏠</span>
                <span>Main Site</span>
              </button>
              <a
                href="https://dl.silphscopepvp.com"
                className="px-3.5 py-1.5 rounded-xl font-black text-xs transition flex items-center gap-1.5 shadow-md hover:brightness-110"
                style={{
                  backgroundColor: '#2DD4BF',
                  color: '#042F2E',
                  boxShadow: '0 0 14px rgba(45, 212, 191, 0.3)'
                }}
              >
                <span>📱</span>
                <span>Download APK</span>
              </a>
              <button
                type="button"
                onClick={() => onSelectSubpage('live')}
                className="px-3.5 py-1.5 rounded-xl font-bold text-xs border border-cyan-500/40 bg-cyan-950/40 text-cyan-300 hover:text-white hover:bg-cyan-900/50 transition cursor-pointer flex items-center gap-1.5 shadow"
              >
                <span>📡</span>
                <span>Live View</span>
              </button>
              {!isStandalone && (
                <button
                  type="button"
                  onClick={handleInstallClick}
                  className="px-3 py-1.5 rounded-xl font-bold text-xs border border-slate-700 bg-[#081120] text-slate-300 hover:text-teal-300 transition cursor-pointer flex items-center gap-1"
                >
                  <span>📲</span>
                  <span className="hidden sm:inline">Install App</span>
                </button>
              )}
            </div>
          ) : (
            /* Other Subpages: keep full switcher as is */
            <>
              <nav
                className="flex items-center gap-1 p-1 rounded-xl border text-xs font-extrabold flex-wrap"
                style={{ backgroundColor: '#081120', borderColor: '#19304E' }}
              >
                <button
                  type="button"
                  onClick={() => onSelectSubpage('vault')}
                  className="px-3 py-1.5 rounded-lg transition cursor-pointer text-teal-200/80 hover:text-white hover:bg-slate-800/60"
                >
                  🎬 DVR Vault
                </button>
                <button
                  type="button"
                  onClick={() => onSelectSubpage('home')}
                  className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                    activeSubpage === 'home'
                      ? 'bg-teal-400 text-slate-950 shadow-md font-black'
                      : 'text-teal-200/80 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  🏠 Overview &amp; Features
                </button>
                <button
                  type="button"
                  onClick={() => onSelectSubpage('live')}
                  className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                    activeSubpage === 'live'
                      ? 'bg-cyan-400 text-slate-950 shadow-md font-black'
                      : 'text-cyan-200/80 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  📡 Live View (Coming Soon)
                </button>
                <button
                  type="button"
                  onClick={() => onSelectSubpage('guide')}
                  className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                    activeSubpage === 'guide'
                      ? 'bg-teal-400 text-slate-950 shadow-md font-black'
                      : 'text-teal-200/80 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  📖 How to Use Overlay
                </button>
                <button
                  type="button"
                  onClick={() => onSelectSubpage('compare')}
                  className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                    activeSubpage === 'compare'
                      ? 'bg-teal-400 text-slate-950 shadow-md font-black'
                      : 'text-teal-200/80 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  ⚔️ vs PvPoke &amp; GOBattleLog
                </button>
                <button
                  type="button"
                  onClick={() => onLaunchWebApp('simulator')}
                  className="px-3 py-1.5 rounded-lg text-amber-300 hover:bg-amber-400/15 border border-amber-400/30 transition cursor-pointer font-black"
                >
                  🧮 Launch Web Simulator &amp; Team Builder
                </button>
              </nav>

              {/* Right Quick Action CTAs */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={handleInstallClick}
                  className="px-3 py-1.5 rounded-xl font-black text-xs border transition flex items-center gap-1.5 hover:brightness-110 cursor-pointer shadow"
                  style={{
                    backgroundColor: 'rgba(14, 27, 46, 0.95)',
                    borderColor: '#2DD4BF',
                    color: '#2DD4BF'
                  }}
                  title="Install SilphScope DVR as a standalone PWA on Android, iOS Safari, or Desktop"
                >
                  <span>📲</span>
                  <span>Install App</span>
                </button>
                <a
                  href="https://dl.silphscopepvp.com"
                  className="px-3.5 py-1.5 rounded-xl font-black text-xs transition flex items-center gap-1.5 shadow-lg hover:brightness-110"
                  style={{
                    backgroundColor: '#2DD4BF',
                    color: '#042F2E',
                    boxShadow: '0 0 16px rgba(45, 212, 191, 0.35)'
                  }}
                >
                  <span>📱 Download APK</span>
                </a>
                <button
                  type="button"
                  onClick={onOpenMembershipModal}
                  className="px-3 py-1.5 rounded-xl font-black text-xs border transition flex items-center gap-1.5 cursor-pointer hover:brightness-110"
                  style={{
                    backgroundColor: 'rgba(250, 204, 21, 0.16)',
                    borderColor: '#FACC15',
                    color: '#FDE047'
                  }}
                >
                  <span>
                    {webMembershipTier === 'vip'
                      ? '👑 VIP Active'
                      : webMembershipTier === 'pro'
                      ? '🏆 Pro Active'
                      : webMembershipTier === 'supporter'
                      ? '🏅 Supporter'
                      : '👑 Upgrade ($2+)'}
                  </span>
                </button>
              </div>
            </>
          )}
        </div>
      </header>

      {/* =====================================================================
          SUBPAGE 1: MAIN MARKETING LANDING PAGE ('home')
         ===================================================================== */}
      {activeSubpage === 'home' && (
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-8 sm:py-12 space-y-16">
          {/* 1. HERO SECTION: Left Pitch & Action Stack + Right Straight-On Vertical 50% HUD Phone */}
          <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
            {/* Left 7 Columns */}
            <div className="lg:col-span-7 space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-extrabold"
                style={{
                  backgroundColor: 'rgba(45, 212, 191, 0.10)',
                  borderColor: 'rgba(45, 212, 191, 0.45)',
                  color: '#2DD4BF'
                }}
              >
                <span>⚡ ZERO-LAG ANDROID OVERLAY</span>
                <span className="text-slate-500">•</span>
                <span style={{ color: '#FACC15' }}>50% TRANSLUCENT HUD</span>
                <span className="text-slate-500">•</span>
                <span>GBL &amp; SHOW 6</span>
              </div>

              <h1 className="text-3xl sm:text-5xl font-black tracking-tight leading-[1.12] text-white">
                Master Every Turn, Shield Call &amp; Swap with{' '}
                <span
                  className="bg-clip-text text-transparent"
                  style={{
                    backgroundImage: 'linear-gradient(90deg, #2DD4BF 0%, #67E8F9 50%, #FACC15 100%)'
                  }}
                >
                  Real-Time PvP Combat Math.
                </span>
              </h1>

              <p className="text-sm sm:text-base leading-relaxed text-slate-300 max-w-2xl">
                SilphScope PvP projects a crystal-clear <strong className="text-teal-300">50% translucent tactical HUD</strong> directly over Pokémon GO. It tracks fast-move turn clocks, banked energy across all 3 opponent slots, real-time multi-stage buff/debuff damage, and live backline probabilities — while automatically logging your battles and building <strong className="text-amber-300">ELO-adaptive Anti-Meta teams</strong> tailored to the exact Pokémon you face.
              </p>

              {/* Prominent 4-Banner Action Stack (Thumb-Friendly on Mobile & Desktop) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <a
                  href="https://dl.silphscopepvp.com"
                  className="p-3.5 rounded-2xl font-black text-sm flex items-center justify-between border shadow-xl transition hover:scale-[1.01]"
                  style={{
                    background: 'linear-gradient(135deg, #2DD4BF 0%, #14B8A6 100%)',
                    borderColor: '#99F6E4',
                    color: '#042F2E',
                    boxShadow: '0 8px 25px rgba(45, 212, 191, 0.28)'
                  }}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">📱</span>
                    <div className="text-left">
                      <div className="text-sm font-black leading-tight">Download Android APK</div>
                      <div className="text-[11px] font-bold opacity-85">Instant 1-Click Direct Release (v7.29)</div>
                    </div>
                  </div>
                  <span className="text-lg font-black">↓</span>
                </a>

                <button
                  type="button"
                  onClick={() => onSelectSubpage('vault')}
                  className="p-3.5 rounded-2xl font-black text-sm flex items-center justify-between border shadow-xl transition hover:scale-[1.01] cursor-pointer text-left"
                  style={{
                    backgroundColor: '#0E1B2E',
                    borderColor: '#2DD4BF',
                    color: '#ECFEFF'
                  }}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">🎬</span>
                    <div className="text-left">
                      <div className="text-sm font-black leading-tight" style={{ color: '#2DD4BF' }}>
                        Cloud DVR Replay Vault
                      </div>
                      <div className="text-[11px] font-medium text-slate-300">
                        Watch @Featured Battles + Frame-Synced HUD
                      </div>
                    </div>
                  </div>
                  <span className="text-teal-300">→</span>
                </button>

                <button
                  type="button"
                  onClick={() => onLaunchWebApp('presets')}
                  className="p-3.5 rounded-2xl font-black text-sm flex items-center justify-between border shadow-xl transition hover:scale-[1.01] cursor-pointer text-left"
                  style={{
                    backgroundColor: '#0E1B2E',
                    borderColor: '#FACC15',
                    color: '#ECFEFF'
                  }}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">🧬</span>
                    <div>
                      <div className="text-sm font-black leading-tight" style={{ color: '#FACC15' }}>
                        Live Anti-Meta Team Builder
                      </div>
                      <div className="text-[11px] font-medium text-slate-300">
                        Fuse Your ELO Battle Logs + PvPoke Ratings
                      </div>
                    </div>
                  </div>
                  <span className="text-amber-300">→</span>
                </button>

                <button
                  type="button"
                  onClick={() => onSelectSubpage('guide')}
                  className="p-3.5 rounded-2xl font-black text-sm flex items-center justify-between border shadow-xl transition hover:scale-[1.01] cursor-pointer text-left"
                  style={{
                    backgroundColor: '#081120',
                    borderColor: '#19304E',
                    color: '#ECFEFF'
                  }}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">📖</span>
                    <div>
                      <div className="text-sm font-black leading-tight text-cyan-300">
                        How to Use the 50% HUD
                      </div>
                      <div className="text-[11px] font-medium text-slate-300">
                        Visual Guide, Shield Calls &amp; Haptic Cues
                      </div>
                    </div>
                  </div>
                  <span className="text-cyan-300">→</span>
                </button>
              </div>

              {/* Key Telemetry Pill Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2">
                {[
                  { k: '50% Alpha', v: 'Crystal-Clear Glass HUD', c: '#2DD4BF' },
                  { k: '±4 Stages', v: 'Live Buff/Debuff Damage', c: '#FACC15' },
                  { k: '100% Free', v: 'In-Game HUD & GBL Export', c: '#34D399' },
                  { k: '$2 Forever', v: 'Supporter Shield HUD Unlock', c: '#67E8F9' }
                ].map((stat) => (
                  <div
                    key={stat.k}
                    className="p-2.5 rounded-xl border"
                    style={{ backgroundColor: 'rgba(14, 27, 46, 0.65)', borderColor: '#19304E' }}
                  >
                    <div className="text-sm font-black font-mono" style={{ color: stat.c }}>
                      {stat.k}
                    </div>
                    <div className="text-[11px] text-slate-300 font-semibold">{stat.v}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right 5 Columns: Straight-On Vertical (Portrait) Phone Frame showcasing Shiny Origin Dialga */}
            <div className="lg:col-span-5 flex flex-col items-center">
              <div
                className="relative w-full max-w-[340px] rounded-[34px] p-2.5 border-4 shadow-2xl"
                style={{
                  backgroundColor: '#081120',
                  borderColor: '#2DD4BF',
                  boxShadow: '0 0 40px rgba(45, 212, 191, 0.22), 0 0 80px rgba(250, 204, 21, 0.10)'
                }}
              >
                <div className="relative rounded-[24px] overflow-hidden border border-teal-400/30 bg-slate-950">
                  <img
                    src={`${import.meta.env.BASE_URL}${heroShowStaticPoster ? activeHero.posterPath : activeHero.gifPath}`}
                    alt={activeHero.label}
                    className="w-full h-auto block"
                  />
                  {/* Floating Bottom Replay Theater Pill */}
                  <div className="absolute bottom-3 inset-x-3 flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-950/90 backdrop-blur-md border border-teal-400/50 shadow-lg">
                    <a
                      href={activeHero.highlightUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-black text-teal-300 hover:text-teal-200 flex items-center gap-1.5"
                    >
                      <span>▶️ Watch Full Battle + Live HUD</span>
                    </a>
                    <button
                      type="button"
                      onClick={() => setHeroShowStaticPoster(!heroShowStaticPoster)}
                      className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] font-mono font-bold text-amber-300 border border-amber-400/40 cursor-pointer"
                      title="Toggle between Animated GIF and High-Res Still Frame"
                    >
                      {heroShowStaticPoster ? '🎞️ Play GIF' : '📸 Still Hi-Res'}
                    </button>
                  </div>
                </div>
              </div>

              {/* 4-Battle Switcher Pills Below Hero Phone */}
              <div className="w-full max-w-[380px] mt-3 space-y-2">
                <div className="flex flex-wrap justify-center gap-1.5">
                  {HERO_SLIDES.map((s, idx) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSelectedHeroIdx(idx)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold border transition cursor-pointer ${
                        idx === selectedHeroIdx
                          ? 'bg-teal-400 text-slate-950 border-teal-300 shadow'
                          : 'bg-slate-900/90 text-slate-300 border-slate-700 hover:border-teal-400/50'
                      }`}
                    >
                      {s.shortLabel}
                    </button>
                  ))}
                </div>
                <div
                  className="p-3 rounded-xl border text-xs space-y-1"
                  style={{ backgroundColor: 'rgba(14, 27, 46, 0.75)', borderColor: '#19304E' }}
                >
                  <div className="font-extrabold text-amber-300">{activeHero.label}</div>
                  <p className="text-[11.5px] text-slate-300 leading-snug">{activeHero.caption}</p>
                </div>
              </div>
            </div>
          </section>

          {/* 2. FEATURED BATTLES SHOWCASE (@Featured • Official Showcase Clickable GIF Cards) */}
          <section
            className="rounded-3xl p-6 sm:p-8 border space-y-6"
            style={{ backgroundColor: '#0E1B2E', borderColor: '#19304E' }}
          >
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider" style={{ color: '#FACC15' }}>
                  <span>🌟 Official @Featured Replay Vault</span>
                  <span>•</span>
                  <span className="text-teal-300">Click Any GIF to Open Full Battle + Live HUD</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-black text-white mt-1">
                  See the 50% Translucent HUD in Real Combat
                </h2>
                <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-3xl">
                  Every battle below was recorded at zero game lag using SilphScope&apos;s hardware H.264 DVR and cloned into our persistent <code className="text-teal-300">@Featured</code> vault. Click any card to open the full replay at <code className="text-amber-300">0:00</code> in the interactive Web Replay Theater, or tap a chapter pill to jump straight to the key moment.
                </p>
              </div>
              <a
                href="https://dvr.silphscopepvp.com/?user=Featured"
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2.5 rounded-xl font-extrabold text-xs border shrink-0 transition hover:brightness-110"
                style={{
                  backgroundColor: 'rgba(250, 204, 21, 0.15)',
                  borderColor: '#FACC15',
                  color: '#FDE047'
                }}
              >
                🎬 Open Full @Featured Vault ↗
              </a>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Featured Battle Card 1: Great League Debuff Math */}
              <div
                className="rounded-2xl border overflow-hidden flex flex-col justify-between transition hover:border-teal-400/70"
                style={{ backgroundColor: '#081120', borderColor: '#19304E' }}
              >
                <div>
                  <button
                    type="button"
                    onClick={() => setSelectedWatchReplay(CANONICAL_FEATURED_REPLAYS.find(r => r.shareId === 'f_gl_debuff') || CANONICAL_FEATURED_REPLAYS[2])}
                    className="block relative group overflow-hidden bg-slate-950 w-full text-left cursor-pointer"
                    title="Click to watch full battle in the Synchronized HUD Replay Theater"
                  >
                    <img
                      src={`${import.meta.env.BASE_URL}screenshots/featured_gl_debuff_math.gif`}
                      alt="Great League Multi-Stage Debuff Math & Shield Call"
                      className="w-full h-[420px] object-cover object-top transition duration-300 group-hover:scale-[1.02]"
                    />
                    <div className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-full bg-slate-950/90 border border-teal-400/60 text-[10.5px] font-extrabold text-teal-300">
                      @Featured • 🌟 Official Showcase
                    </div>
                    <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent flex items-center justify-between">
                      <span className="px-2.5 py-1 rounded-lg bg-teal-400 text-slate-950 font-black text-xs shadow">
                        ▶️ Watch Full Battle (0:00)
                      </span>
                      <span className="text-[11px] font-mono font-bold text-amber-300">
                        WIN • Great League
                      </span>
                    </div>
                  </button>

                  <div className="p-4 space-y-2">
                    <h3 className="font-black text-base text-white">
                      1. Real-Time Multi-Stage Buff/Debuff Math (<code className="text-rose-300">A-2 vs A-1</code>)
                    </h3>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      <strong>Kanto Ninetales, Fearow &amp; Shadow Pidgeot</strong> vs. <strong>Milotic, Corviknight &amp; Shadow Drifblim</strong>. Watch the HUD dynamically recompute exact move damage as Feather Dance and Icy Wind debuffs stack to <code className="text-rose-300">Atk -2</code> and <code className="text-rose-300">Atk -1</code>, confirming Shadow Pidgeot safely tanks at 64% HP.
                    </p>
                  </div>
                </div>

                <div className="px-4 pb-4 pt-2 border-t border-slate-800/80 flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setSelectedWatchReplay(CANONICAL_FEATURED_REPLAYS.find(r => r.shareId === 'f_gl_debuff') || CANONICAL_FEATURED_REPLAYS[2])}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-teal-300 font-bold text-[11px] border border-teal-400/30 cursor-pointer"
                  >
                    ▶️ Start (0:00)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedWatchReplay({ ...(CANONICAL_FEATURED_REPLAYS.find(r => r.shareId === 'f_gl_debuff') || CANONICAL_FEATURED_REPLAYS[2]), highlightSec: 118 })}
                    className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-extrabold text-[11px] border border-amber-400/50 cursor-pointer"
                  >
                    ⚡ Jump to Debuff &amp; Shield Call (1:58)
                  </button>
                </div>
              </div>

              {/* Featured Battle Card 2: Mega Master League Shiny Dialga & Closer Swap */}
              <div
                className="rounded-2xl border overflow-hidden flex flex-col justify-between transition hover:border-teal-400/70"
                style={{ backgroundColor: '#081120', borderColor: '#19304E' }}
              >
                <div>
                  <button
                    type="button"
                    onClick={() => setSelectedWatchReplay(CANONICAL_FEATURED_REPLAYS.find(r => r.shareId === 'f_ml_closer') || CANONICAL_FEATURED_REPLAYS[0])}
                    className="block relative group overflow-hidden bg-slate-950 w-full text-left cursor-pointer"
                    title="Click to watch full battle in the Synchronized HUD Replay Theater"
                  >
                    <img
                      src={`${import.meta.env.BASE_URL}screenshots/featured_ml_closer_align.gif`}
                      alt="Mega Master League Shiny Origin Dialga & Closer Swap Alignment"
                      className="w-full h-[420px] object-cover object-top transition duration-300 group-hover:scale-[1.02]"
                    />
                    <div className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-full bg-slate-950/90 border border-teal-400/60 text-[10.5px] font-extrabold text-teal-300">
                      @Featured • 🌟 Official Showcase
                    </div>
                    <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent flex items-center justify-between">
                      <span className="px-2.5 py-1 rounded-lg bg-teal-400 text-slate-950 font-black text-xs shadow">
                        ▶️ Watch Full Battle (0:00)
                      </span>
                      <span className="text-[11px] font-mono font-bold text-amber-300">
                        WIN • Mega Master
                      </span>
                    </div>
                  </button>

                  <div className="p-4 space-y-2">
                    <h3 className="font-black text-base text-white">
                      2. Shiny Origin Dialga Pacing &amp; Instant Closer Alignment
                    </h3>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      <strong>Shiny Origin Dialga, Lugia &amp; Primal Kyogre</strong> vs. <strong>Zekrom, Primal Kyogre &amp; Origin Dialga</strong>. After Lugia KOs Primal Kyogre and the opponent&apos;s Origin Dialga enters at 100% HP, the 4-Pillar Coach immediately triggers <code className="text-teal-300">[ABB] SWAP -&gt; KYOG TO CLOSE</code>.
                    </p>
                  </div>
                </div>

                <div className="px-4 pb-4 pt-2 border-t border-slate-800/80 flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setSelectedWatchReplay(CANONICAL_FEATURED_REPLAYS.find(r => r.shareId === 'f_ml_closer') || CANONICAL_FEATURED_REPLAYS[0])}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-teal-300 font-bold text-[11px] border border-teal-400/30 cursor-pointer"
                  >
                    ▶️ Start (0:00)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedWatchReplay({ ...(CANONICAL_FEATURED_REPLAYS.find(r => r.shareId === 'f_ml_closer') || CANONICAL_FEATURED_REPLAYS[0]), highlightSec: 18 })}
                    className="px-2.5 py-1 rounded-lg bg-teal-500/20 hover:bg-teal-500/30 text-teal-200 font-extrabold text-[11px] border border-teal-400/50 cursor-pointer"
                  >
                    ✨ Shiny Dialga RoTime (0:18)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedWatchReplay({ ...(CANONICAL_FEATURED_REPLAYS.find(r => r.shareId === 'f_ml_closer') || CANONICAL_FEATURED_REPLAYS[0]), highlightSec: 100 })}
                    className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-extrabold text-[11px] border border-amber-400/50 cursor-pointer"
                  >
                    🔄 Closer Swap (1:40)
                  </button>
                </div>
              </div>

              {/* Featured Battle Card 3: Mega Ultra League Shield Call & Disguise Bust */}
              <div
                className="rounded-2xl border overflow-hidden flex flex-col justify-between transition hover:border-teal-400/70"
                style={{ backgroundColor: '#081120', borderColor: '#19304E' }}
              >
                <div>
                  <button
                    type="button"
                    onClick={() => setSelectedWatchReplay(CANONICAL_FEATURED_REPLAYS.find(r => r.shareId === 'f_ul_shield') || CANONICAL_FEATURED_REPLAYS[1])}
                    className="block relative group overflow-hidden bg-slate-950 w-full text-left cursor-pointer"
                    title="Click to watch full battle in the Synchronized HUD Replay Theater"
                  >
                    <img
                      src={`${import.meta.env.BASE_URL}screenshots/featured_ul_disguise_shield.gif`}
                      alt="Mega Ultra League Shield Call, Disguise Bust & Backline Predictor"
                      className="w-full h-[420px] object-cover object-top transition duration-300 group-hover:scale-[1.02]"
                    />
                    <div className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-full bg-slate-950/90 border border-teal-400/60 text-[10.5px] font-extrabold text-teal-300">
                      @Featured • 🌟 Official Showcase
                    </div>
                    <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent flex items-center justify-between">
                      <span className="px-2.5 py-1 rounded-lg bg-teal-400 text-slate-950 font-black text-xs shadow">
                        ▶️ Watch Full Battle (0:00)
                      </span>
                      <span className="text-[11px] font-mono font-bold text-amber-300">
                        WIN • Mega Ultra
                      </span>
                    </div>
                  </button>

                  <div className="p-4 space-y-2">
                    <h3 className="font-black text-base text-white">
                      3. Shield Decision Call, Disguise Bust &amp; Backline Predictor
                    </h3>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      <strong>Tinkaton, Mimikyu &amp; Swampert</strong> vs. <strong>Greninja, Altered Giratina &amp; Armored Mewtwo</strong>. Demonstrates live <code className="text-amber-300">BLOCKED!</code> shield verification, Mimikyu Disguise state tracking, and real-time 3rd-slot Backline Prediction (<code className="text-teal-300">3rd: TINKA 16% FLRG 12%</code>).
                    </p>
                  </div>
                </div>

                <div className="px-4 pb-4 pt-2 border-t border-slate-800/80 flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setSelectedWatchReplay(CANONICAL_FEATURED_REPLAYS.find(r => r.shareId === 'f_ul_shield') || CANONICAL_FEATURED_REPLAYS[1])}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-teal-300 font-bold text-[11px] border border-teal-400/30 cursor-pointer"
                  >
                    ▶️ Start (0:00)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedWatchReplay({ ...(CANONICAL_FEATURED_REPLAYS.find(r => r.shareId === 'f_ul_shield') || CANONICAL_FEATURED_REPLAYS[1]), highlightSec: 44 })}
                    className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-extrabold text-[11px] border border-amber-400/50 cursor-pointer"
                  >
                    🛡️ Jump to Shield &amp; Predictor (0:44)
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* 3. LIVE ELO-ADAPTIVE ANTI-META GENERATOR + FUTURE 3-WAY META FUSION */}
          <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-6 space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/15 border border-amber-400/40 text-amber-300 text-xs font-extrabold">
                <span>🧬 ADAPTIVE META INTELLIGENCE</span>
                <span>•</span>
                <span>TAILORED TO YOUR ELO</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-white leading-tight">
                Stop Building for Generic Rankings. Counter the Exact Micro-Meta at{' '}
                <span style={{ color: '#2DD4BF' }}>Your Current ELO.</span>
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Static ranking sites assume you face all Top-100 Pokémon equally. In reality, a 2150 ELO pocket looks completely different from a 2750 Legend push. SilphScope PvP automatically records every opponent team you face and applies an <strong className="text-teal-300">exponential recency decay (<code className="font-mono">λ = 0.04</code>)</strong> to fuse your personal battle logs (up to 70% weight) with PvPoke&apos;s baseline ratings.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div
                  className="p-3.5 rounded-2xl border"
                  style={{ backgroundColor: '#0E1B2E', borderColor: '#19304E' }}
                >
                  <div className="font-black text-xs text-teal-300 mb-1">
                    ✅ Live Now: 2-Way Personal + PvPoke Fusion
                  </div>
                  <p className="text-[11.5px] text-slate-300 leading-snug">
                    Synthesizes Top 5 <strong>ABB</strong>, <strong>ABC</strong>, and <strong>Duo-Core</strong> lineups + <strong>⚡ Alternate Moveset Surprises</strong> that specifically punish the leads and cores beating you today.
                  </p>
                </div>
                <div
                  className="p-3.5 rounded-2xl border"
                  style={{ backgroundColor: 'rgba(250, 204, 21, 0.07)', borderColor: 'rgba(250, 204, 21, 0.4)' }}
                >
                  <div className="font-black text-xs text-amber-300 mb-1">
                    🚀 Growing Userbase: 3-Way Meta Fusion
                  </div>
                  <p className="text-[11.5px] text-slate-300 leading-snug">
                    As community telemetry expands, blend <strong>1. Your Personal ELO Logs</strong> + <strong>2. Live Community Crowd Meta</strong> + <strong>3. PvPoke Theoretical Ratings</strong> with customizable sliders.
                  </p>
                </div>
              </div>

              {/* Hybrid Backline Predictor Callout */}
              <div
                className="p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                style={{ backgroundColor: '#081120', borderColor: '#2DD4BF' }}
              >
                <div className="space-y-0.5">
                  <div className="text-xs font-black text-teal-300">
                    🔮 Live Backline Predictor — 100% Free in Open Leagues!
                  </div>
                  <p className="text-[11.5px] text-slate-300">
                    The 2-line in-game HUD predicts the opponent&apos;s unrevealed 2nd &amp; 3rd Pokémon in real time for free in Great, Ultra &amp; Master League. Supporter &amp; Pro unlock Limited/Specialty Cups and the Deep Pair Explorer.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onLaunchWebApp('presets')}
                  className="px-3.5 py-2 rounded-xl bg-teal-400 text-slate-950 font-black text-xs shrink-0 cursor-pointer hover:brightness-110"
                >
                  Try Anti-Meta Builder →
                </button>
              </div>
            </div>

            <div className="lg:col-span-6">
              <div
                className="rounded-2xl overflow-hidden border-2 shadow-2xl"
                style={{ borderColor: '#2DD4BF', boxShadow: '0 0 35px rgba(45, 212, 191, 0.18)' }}
              >
                <img
                  src={`${import.meta.env.BASE_URL}screenshots/elo_adaptive_anti_meta_engine.jpg`}
                  alt="SilphScope PvP Live ELO-Adaptive Anti-Meta Generator"
                  className="w-full h-auto block"
                />
              </div>
            </div>
          </section>

          {/* 4. HEAD-TO-HEAD COMPARISONS: vs. PvPoke & vs. GOBattleLog (+ Free GOBattleLog Export!) */}
          <section className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div>
                <div className="text-xs font-extrabold uppercase tracking-wider text-teal-300">
                  ⚔️ Why Trainers Upgrade to SilphScope PvP
                </div>
                <h2 className="text-2xl sm:text-3xl font-black text-white mt-1">
                  More Power than Static Sims. Fraction of the Cost of Web Loggers.
                </h2>
              </div>
              <button
                type="button"
                onClick={() => onSelectSubpage('compare')}
                className="px-4 py-2 rounded-xl font-extrabold text-xs border border-teal-400/50 text-teal-300 hover:bg-teal-400/10 cursor-pointer shrink-0"
              >
                📊 View Full Deep-Dive Comparison Table →
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Card A: vs PvPoke */}
              <div
                className="rounded-3xl p-5 border flex flex-col justify-between space-y-4"
                style={{ backgroundColor: '#0E1B2E', borderColor: '#19304E' }}
              >
                <div className="space-y-3">
                  <div className="rounded-xl overflow-hidden border border-teal-400/40">
                    <img
                      src={`${import.meta.env.BASE_URL}screenshots/silphscope_vs_pvpoke_teambuilder.jpg`}
                      alt="SilphScope PvP Team Builder vs Static PvPoke Sims"
                      className="w-full h-auto block"
                    />
                  </div>
                  <h3 className="text-lg font-black text-white">
                    SilphScope Team Builder vs. Static PvPoke Sims
                  </h3>
                  <ul className="text-xs text-slate-300 space-y-1.5">
                    <li>
                      • <strong className="text-teal-300">Asymmetric 9-Shield Matrix (0S/1S/2S)</strong>: Evaluates all 9 shield permutations instead of assuming static 1v1 bait perfection.
                    </li>
                    <li>
                      • <strong className="text-teal-300">Role-Specific Auto-Ordering</strong>: Scores #1 Lead, #2 Safe Swap, and #3 Closer separately across <strong>ABB</strong>, <strong>ABC</strong>, and <strong>Duo-Core</strong> playbooks.
                    </li>
                    <li>
                      • <strong className="text-amber-300">⚡ Alternate Moveset Synthesis</strong>: Automatically tests spicy off-meta move combinations to flip your team&apos;s worst core-breakers.
                    </li>
                  </ul>
                </div>
                <button
                  type="button"
                  onClick={() => onLaunchWebApp('presets')}
                  className="w-full py-2.5 rounded-xl font-black text-xs bg-teal-400/15 hover:bg-teal-400/25 text-teal-300 border border-teal-400/40 transition cursor-pointer"
                >
                  Open Interactive Team Builder →
                </button>
              </div>

              {/* Card B: vs GOBattleLog (+ Friendly Free Export Callout) */}
              <div
                className="rounded-3xl p-5 border flex flex-col justify-between space-y-4"
                style={{ backgroundColor: '#0E1B2E', borderColor: '#19304E' }}
              >
                <div className="space-y-3">
                  <div className="rounded-xl overflow-hidden border border-amber-400/40">
                    <img
                      src={`${import.meta.env.BASE_URL}screenshots/silphscope_vs_gobattlelog_analytics.jpg`}
                      alt="SilphScope PvP Battle Logs vs GOBattleLog"
                      className="w-full h-auto block"
                    />
                  </div>
                  <h3 className="text-lg font-black text-white">
                    Personal Logs &amp; Skill Math vs. GOBattleLog
                  </h3>
                  <ul className="text-xs text-slate-300 space-y-1.5">
                    <li>
                      • <strong className="text-teal-300">100% Automatic OCR Logging</strong>: Zero manual typing between sets—captures opponent leads, swaps, move loadouts, and final HP% automatically.
                    </li>
                    <li>
                      • <strong className="text-teal-300">Objective Skill Separation (<code className="font-mono">BMF</code> vs. <code className="font-mono">WAE</code>)</strong>: Separates blind matchmaking luck from your in-battle micro-execution skill and Safe-Swap MVP recovery rate.
                    </li>
                    <li>
                      • <strong className="text-amber-300">🤝 Friendly 1-Click GOBattleLog Export (100% Free in All Tiers!)</strong>: Love contributing to GOBattleLog? Export your auto-recorded SilphScope logs in native <code className="text-teal-300">[mon1 mon2 mon3]</code> GOBattleLog format for free anytime!
                    </li>
                  </ul>
                </div>
                <button
                  type="button"
                  onClick={() => onLaunchWebApp('battle_log')}
                  className="w-full py-2.5 rounded-xl font-black text-xs bg-amber-400/15 hover:bg-amber-400/25 text-amber-300 border border-amber-400/40 transition cursor-pointer"
                >
                  Explore Battle Logs &amp; Free GOBattleLog Export →
                </button>
              </div>
            </div>
          </section>

          {/* 5. 4-TIER MEMBERSHIP MATRIX & PRIORITY SUPPORT QUEUE */}
          <section
            id="pricing"
            className="rounded-3xl p-6 sm:p-8 border space-y-6"
            style={{ backgroundColor: '#0E1B2E', borderColor: '#19304E' }}
          >
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div>
                <div className="text-xs font-extrabold uppercase tracking-wider text-amber-300">
                  💎 Community-First Pricing • No Forced Subscriptions
                </div>
                <h2 className="text-2xl sm:text-3xl font-black text-white mt-1">
                  100% Free Live HUD Forever. Upgrade for Shield HUD &amp; Cloud DVR Vault.
                </h2>
                <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-3xl">
                  Subscribing to <strong>Legend Pro</strong> or <strong>VIP</strong> even once permanently grants you <strong className="text-amber-300">🏅 Lifetime Supporter (Alumni)</strong> status forever—keeping the <strong>🛡️ Attack Incoming! Shield Decision Overlay</strong>, Unlimited Lifetime Battle Logs, and 5 Local DVR Videos unlocked even if your seasonal pass expires.
                </p>
              </div>

              {/* Pre-Checkout Trainer ID Binding Input */}
              <div
                className="p-3 rounded-2xl border flex flex-col gap-1.5 min-w-[270px]"
                style={{ backgroundColor: '#081120', borderColor: '#2DD4BF' }}
              >
                <label className="text-[11px] font-extrabold text-teal-300">
                  🎮 Optional: Enter Trainer ID to Auto-Bind Checkout:
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={webScreenName}
                    onChange={(e) => onChangeWebScreenName(e.target.value)}
                    placeholder="e.g. sportsfan986"
                    className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
                  />
                  <button
                    type="button"
                    onClick={onOpenMembershipModal}
                    className="px-2.5 py-1.5 rounded-lg bg-teal-400/20 border border-teal-400/50 text-teal-300 font-bold text-[11px] cursor-pointer"
                  >
                    🔑 Have Key?
                  </button>
                </div>
              </div>
            </div>

            {/* 4-Tier Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Tier 1: Free */}
              <div
                className="rounded-2xl p-5 border flex flex-col justify-between space-y-4"
                style={{ backgroundColor: '#081120', borderColor: '#19304E' }}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-black text-slate-200">🆓 Free Community</span>
                    <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 text-[10px] font-bold">
                      Forever
                    </span>
                  </div>
                  <div className="text-2xl font-black text-white">$0</div>
                  <ul className="text-xs text-slate-300 space-y-1.5">
                    <li>✅ <strong>100% Free Live 50% HUD &amp; 9-Shield Matrix</strong></li>
                    <li>✅ <strong>Live 2-Line Backline Predictor</strong> (Open GL/UL/ML)</li>
                    <li>✅ <strong>Synchronized Haptics</strong> (Swap Clock &amp; Move Alerts)</li>
                    <li>✅ <strong>1 Local Hardware DVR Video</strong> (15 FPS)</li>
                    <li>✅ <strong>Current Season Logs + Free GOBattleLog Export</strong></li>
                  </ul>
                </div>
                <a
                  href="https://dl.silphscopepvp.com"
                  className="w-full py-2.5 rounded-xl font-black text-xs text-center bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 transition"
                >
                  📱 Download Free APK
                </a>
              </div>

              {/* Tier 2: Lifetime Supporter ($2) */}
              <div
                className="rounded-2xl p-5 border flex flex-col justify-between space-y-4"
                style={{ backgroundColor: '#081120', borderColor: '#38BDF8' }}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-black text-sky-300">🏅 Lifetime Supporter</span>
                    <span className="px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 text-[10px] font-bold border border-sky-400/40">
                      One-Time / Alumni
                    </span>
                  </div>
                  <div className="text-2xl font-black text-white">
                    $2 <span className="text-xs font-normal text-slate-400">One-Time Forever</span>
                  </div>
                  <ul className="text-xs text-slate-300 space-y-1.5">
                    <li>🛡️ <strong>Attack Incoming! Shield Decision HUD Unlocked Forever</strong></li>
                    <li>📜 <strong>Unlimited Lifetime Battle Log History</strong></li>
                    <li>🎥 <strong>5 Local On-Device DVR Videos</strong></li>
                    <li>⚔️ <strong>Core 3 Open Leagues</strong> (GL + UL + ML) Anti-Meta</li>
                    <li>🛠️ <strong>P3 Supporter Diagnostic Priority Badge</strong></li>
                  </ul>
                </div>
                <div className="space-y-1.5">
                  <a
                    href={stripeSupporterUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full py-2.5 rounded-xl font-black text-xs text-center bg-sky-500 hover:bg-sky-400 text-slate-950 transition shadow-lg"
                  >
                    💳 Unlock Supporter ($2 One-Time)
                  </a>
                  <a
                    href="https://buymeacoffee.com/silphscopepvp/e/595787"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full py-1.5 rounded-lg font-bold text-[11px] text-center text-amber-300 hover:bg-amber-400/10 border border-amber-400/30 transition"
                  >
                    ☕ Or $2 on Buy Me a Coffee
                  </a>
                </div>
              </div>

              {/* Tier 3: Legend Pro ($3 Intro / $6 Season) */}
              <div
                className="rounded-2xl p-5 border-2 flex flex-col justify-between space-y-4 relative"
                style={{
                  backgroundColor: '#081120',
                  borderColor: '#2DD4BF',
                  boxShadow: '0 0 28px rgba(45, 212, 191, 0.22)'
                }}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-black text-teal-300">🏆 Legend Pro</span>
                    <span className="px-2 py-0.5 rounded-full bg-teal-400 text-slate-950 text-[10px] font-black">
                      MOST POPULAR
                    </span>
                  </div>
                  <div className="text-2xl font-black text-white">
                    $6<span className="text-xs font-normal text-slate-300">/90d Season ($2/mo)</span>
                  </div>
                  <div className="text-[11px] font-bold text-amber-300 bg-amber-400/10 border border-amber-400/30 rounded-lg px-2 py-1">
                    🎉 Day 15+ First-Season Intro: $3 for Remainder of Season!
                  </div>
                  <ul className="text-xs text-slate-300 space-y-1.5">
                    <li>☁️ <strong>50 Rolling + 10 Starred Cloud DVR Replays (2 GB R2)</strong></li>
                    <li>🎥 <strong>25 Local DVR Battles (5 Full GBL Sets)</strong></li>
                    <li>🏆 <strong>All Limited, Mega &amp; Show 6 Specialty Cups</strong></li>
                    <li>⚡ <strong>Top 5 Teams/Arch + Alt Moveset Synthesis</strong></li>
                    <li>🛠️ <strong>P2 Priority Bug &amp; OCR Diagnostic Queue</strong></li>
                    <li>🏅 <strong>Includes Permanent Supporter Alumni Status</strong></li>
                  </ul>
                </div>
                <div className="space-y-1.5">
                  <a
                    href={stripeProSeasonUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full py-2.5 rounded-xl font-black text-xs text-center bg-teal-400 hover:bg-teal-300 text-slate-950 transition shadow-lg"
                  >
                    💳 Legend Pro Season Pass ($6)
                  </a>
                  <div className="grid grid-cols-2 gap-1.5">
                    <a
                      href={stripeProIntroUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="py-1.5 rounded-lg font-extrabold text-[10.5px] text-center bg-amber-400/20 text-amber-300 border border-amber-400/40 hover:bg-amber-400/30"
                    >
                      ✨ $3 Intro Promo
                    </a>
                    <a
                      href="https://buymeacoffee.com/silphscopepvp/e/595788"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="py-1.5 rounded-lg font-bold text-[10.5px] text-center text-slate-300 border border-slate-700 hover:bg-slate-800"
                    >
                      ☕ BMC ($6)
                    </a>
                  </div>
                </div>
              </div>

              {/* Tier 4: VIP / Coach ($5 Intro / $10 Season) */}
              <div
                className="rounded-2xl p-5 border flex flex-col justify-between space-y-4"
                style={{ backgroundColor: '#081120', borderColor: '#FACC15' }}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-black text-amber-300">👑 VIP / Coach</span>
                    <span className="px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 text-[10px] font-bold border border-amber-400/40">
                      30 FPS + 4 GB Vault
                    </span>
                  </div>
                  <div className="text-2xl font-black text-white">
                    $10<span className="text-xs font-normal text-slate-300">/90d Season ($3.33/mo)</span>
                  </div>
                  <div className="text-[11px] font-bold text-teal-300 bg-teal-400/10 border border-teal-400/30 rounded-lg px-2 py-1">
                    🎉 Day 15+ First-Season Intro: $5 for Remainder of Season!
                  </div>
                  <ul className="text-xs text-slate-300 space-y-1.5">
                    <li>🎥 <strong>30 FPS Smooth Hardware DVR</strong> (+ 15 FPS Saver toggle)</li>
                    <li>☁️ <strong>150 Rolling (365d) + 25 Starred Replays (4 GB R2)</strong></li>
                    <li>📱 <strong>Up to 100 Local On-Device DVR Battles (Slider)</strong></li>
                    <li>🚨 <strong>P1 Highest-Priority Direct Telegram Diagnostic Queue</strong></li>
                    <li>🏅 <strong>Includes Permanent Supporter Alumni Status</strong></li>
                  </ul>
                </div>
                <div className="space-y-1.5">
                  <a
                    href={stripeVipSeasonUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full py-2.5 rounded-xl font-black text-xs text-center bg-amber-400 hover:bg-amber-300 text-slate-950 transition shadow-lg"
                  >
                    👑 VIP / Coach Season Pass ($10)
                  </a>
                  <div className="grid grid-cols-2 gap-1.5">
                    <a
                      href={stripeVipIntroUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="py-1.5 rounded-lg font-extrabold text-[10.5px] text-center bg-teal-400/20 text-teal-300 border border-teal-400/40 hover:bg-teal-400/30"
                    >
                      ✨ $5 Intro Promo
                    </a>
                    <a
                      href="https://buymeacoffee.com/silphscopepvp/e/595789"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="py-1.5 rounded-lg font-bold text-[10.5px] text-center text-slate-300 border border-slate-700 hover:bg-slate-800"
                    >
                      ☕ BMC ($10)
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* 6. VERSION EVOLUTION HISTORY & FUTURE ROADMAP INFOGRAPHIC */}
          <VersionRoadmapInfographic />
        </main>
      )}

      {/* =====================================================================
          SUBPAGE 2: HOW TO USE THE OVERLAY VISUAL GUIDE ('guide')
         ===================================================================== */}
      {activeSubpage === 'guide' && (
        <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8 sm:py-12 space-y-10">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
            <div>
              <div className="text-xs font-extrabold uppercase tracking-wider text-teal-300">
                📖 Visual Field Manual • 50% Translucent HUD
              </div>
              <h1 className="text-2xl sm:text-4xl font-black text-white mt-1">
                How to Read &amp; Master the SilphScope PvP Overlay
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-3xl">
                Designed for split-second readability without ever blocking Pokémon GO&apos;s health bars, nameplates, or charged-move buttons.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onLaunchWebApp('simulator')}
              className="px-4 py-2.5 rounded-xl font-black text-xs bg-teal-400 text-slate-950 cursor-pointer shrink-0 shadow-lg"
            >
              🧮 Practice in Interactive Simulator →
            </button>
          </div>

          {/* Annotated 6-Zone Breakdown with Vertical 50% HUD Frames */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-5 flex flex-col items-center gap-4">
              <div
                className="rounded-3xl p-2 border-2 shadow-2xl max-w-[330px]"
                style={{ backgroundColor: '#081120', borderColor: '#2DD4BF' }}
              >
                <img
                  src={`${import.meta.env.BASE_URL}screenshots/featured_hero_shiny_dialga_poster.png`}
                  alt="Annotated 50% Translucent HUD — Shiny Origin Dialga"
                  className="rounded-2xl w-full h-auto block"
                />
              </div>
              <div
                className="rounded-3xl p-2 border-2 shadow-2xl max-w-[330px]"
                style={{ backgroundColor: '#081120', borderColor: '#FACC15' }}
              >
                <img
                  src={`${import.meta.env.BASE_URL}screenshots/featured_gl_debuff_math_poster.png`}
                  alt="Annotated 50% Translucent HUD — Multi-Stage Debuff Math"
                  className="rounded-2xl w-full h-auto block"
                />
              </div>
            </div>

            <div className="lg:col-span-7 space-y-4">
              {[
                {
                  step: 'Row 1 • Mirrored Live Header',
                  badge: '[CP, HP%, E, 🛡️] | [🛡️, E, HP%, CP]',
                  desc: 'Displays your active Pokémon on the left and the opponent on the right. Tap the top-left Origin Dialga crest once to switch from Full HUD -> Compact HUD -> Minimized Bubble (pauses OCR). Hold the crest for 2 seconds to stop the overlay and open your Battle Log. Live buff/debuff stage badges (e.g., A-2, D+1, BUST) appear automatically whenever stat-stage moves fire.'
                },
                {
                  step: 'Row 2 • Active Matchup & Synchronized Swap Timers',
                  badge: 'Swap: 12s | Opp: 2s + Single 80ms Haptic Pulse',
                  desc: 'Tracks both players’ 50-second switch clocks independently. When the opponent’s switch clock drops below 5 seconds, your phone triggers a single 80ms haptic vibration pulse so you never get caught off-guard by a sudden snipe.'
                },
                {
                  step: 'Row 3 • 3×3 Asymmetric 9-Shield Matchup Matrix',
                  badge: '0S / 1S / 2S Colored Dots Across All 3v3 Slots',
                  desc: 'Shows how all 3 of your Pokémon perform against each revealed opponent Pokémon across 0-shield, 1-shield, and 2-shield scenarios (Green = Win, Grey = Neutral, Red = Loss). For unrevealed opponent slots, displays live Backline Predictor probabilities.'
                },
                {
                  step: 'Rows 4 & 5 • Turn-Exact Move Pacing & Real-Time Stage Damage',
                  badge: 'Double 80ms Haptic Pulse at 1 Fast Move Left',
                  desc: 'Shows how many fast moves remain until each charged attack is ready, plus the exact damage percentage each move will deal against all 3 Pokémon on the other side—automatically scaled for Shadow 1.2x multipliers and live [-4..+4] Attack/Defense buffs and debuffs.'
                },
                {
                  step: 'Row 6 • 2-Line 4-Pillar AI Tactical Coach & Shield Verdict',
                  badge: 'Bottom (Default) or Top HUD Placement',
                  desc: 'Line 1 gives your immediate micro action (e.g., "[SHIELD] TANK (0S) -> Twister IN 2F • Survives at 64% HP" or "1 LAST FAST -> THROW RoTime NOW!"). Line 2 shows live Backline Predictions ("Back: ZAC-C 22% PAL-O 15%") and opponent bench HP/Energy ledgers.'
                },
                {
                  step: '1-Battle Hardware DVR (REC 1) & Post-Battle Flagging',
                  badge: 'Zero-Lag 544×1184 H.264 + Frame Trace',
                  desc: 'Enable "Show 1-Battle DVR Button" in Settings or Always-On DVR. After any battle, tap 🚩 Flag Issue to upload the synchronized video + frame trace to dvr.silphscopepvp.com and share a /watch/:shareId link!'
                }
              ].map((item) => (
                <div
                  key={item.step}
                  className="p-4 rounded-2xl border space-y-1.5"
                  style={{ backgroundColor: '#0E1B2E', borderColor: '#19304E' }}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-black text-sm sm:text-base text-teal-300">{item.step}</h3>
                    <span className="px-2.5 py-0.5 rounded-full bg-slate-950 border border-amber-400/40 text-amber-300 font-mono text-[10.5px] font-bold">
                      {item.badge}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </main>
      )}

      {/* =====================================================================
          SUBPAGE 3: DEEP-DIVE COMPARISONS & COMBAT MATH ('compare')
         ===================================================================== */}
      {activeSubpage === 'compare' && (
        <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8 sm:py-12 space-y-10">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
            <div>
              <div className="text-xs font-extrabold uppercase tracking-wider text-amber-300">
                ⚔️ Side-by-Side Feature &amp; Math Comparison
              </div>
              <h1 className="text-2xl sm:text-4xl font-black text-white mt-1">
                SilphScope PvP vs. PvPoke &amp; GOBattleLog
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-3xl">
                See how SilphScope combines live in-game vision, personal ELO-adaptive team synthesis, and objective skill analytics—while remaining 100% compatible with GOBattleLog exports.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onLaunchWebApp('battle_log')}
              className="px-4 py-2.5 rounded-xl font-black text-xs bg-amber-400 text-slate-950 cursor-pointer shrink-0 shadow-lg"
            >
              📜 Open Battle Logs &amp; Free Export →
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <img
              src={`${import.meta.env.BASE_URL}screenshots/silphscope_vs_pvpoke_teambuilder.jpg`}
              alt="SilphScope vs PvPoke Team Builder"
              className="rounded-2xl border border-teal-400/40 w-full h-auto"
            />
            <img
              src={`${import.meta.env.BASE_URL}screenshots/silphscope_vs_gobattlelog_analytics.jpg`}
              alt="SilphScope vs GOBattleLog Analytics"
              className="rounded-2xl border border-amber-400/40 w-full h-auto"
            />
          </div>

          {/* Comprehensive Feature Matrix Table */}
          <div
            className="rounded-2xl border overflow-x-auto"
            style={{ backgroundColor: '#0E1B2E', borderColor: '#19304E' }}
          >
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-300">
                  <th className="p-3.5 font-black">Capability / Feature</th>
                  <th className="p-3.5 font-black text-teal-300">🛡️ SilphScope PvP</th>
                  <th className="p-3.5 font-black text-slate-400">PvPoke.com</th>
                  <th className="p-3.5 font-black text-slate-400">GOBattleLog.com</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {[
                  [
                    'Real-Time In-Game Android HUD (50% Translucent)',
                    '✅ 100% Free Forever',
                    '❌ Web-Only',
                    '❌ Web-Only'
                  ],
                  [
                    'Automatic OCR Battle Logging (No Manual Typing)',
                    '✅ Automatic 3v3 + Moves + HP%',
                    '❌ None',
                    '❌ Manual Entry Required'
                  ],
                  [
                    '1-Click GOBattleLog Format Export ([mon1 mon2 mon3])',
                    '✅ 100% Free in All Tiers',
                    '—',
                    'Native Format'
                  ],
                  [
                    'ELO-Adaptive Anti-Meta Team Builder',
                    '✅ Fuses Personal Logs (70%) + PvPoke (30%)',
                    'Static Theoretical Rankings Only',
                    'Crowd Scrubbed Charts ($5–$20/mo)'
                  ],
                  [
                    'Real-Time Multi-Stage Buff/Debuff Damage Math',
                    '✅ Live [-4..+4] Atk/Def Scaling',
                    'Static Sandbox Only',
                    '❌ None'
                  ],
                  [
                    'Objective Skill Math (BMF Matchmaking Luck vs. WAE Skill)',
                    '✅ Full BMF, WAE & Safe-Swap MVP Grades',
                    '❌ None',
                    '❌ Win/Loss Count Only'
                  ],
                  [
                    'Synchronized H.264 Battle DVR + Web Replay Theater',
                    '✅ 15/30 FPS DVR + dvr.silphscopepvp.com',
                    '❌ None',
                    '❌ None'
                  ],
                  [
                    'Cost',
                    '✅ $0 Free • $2 Lifetime Supporter • $2/mo eff. Pro',
                    '$0 (Ad-Supported Web)',
                    '$5/mo – $20/mo Subscription'
                  ]
                ].map(([feat, ss, pvp, gbl]) => (
                  <tr key={feat} className="hover:bg-slate-900/40">
                    <td className="p-3.5 font-bold text-white">{feat}</td>
                    <td className="p-3.5 font-extrabold text-teal-300">{ss}</td>
                    <td className="p-3.5 text-slate-400">{pvp}</td>
                    <td className="p-3.5 text-slate-400">{gbl}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </main>
      )}

      {/* SUBPAGE: CLOUD DVR REPLAY VAULT (DEFAULT VIEW ON LAUNCH) */}
      {activeSubpage === 'vault' && (
        <main className="flex-1 max-w-7xl mx-auto px-4 py-4 w-full space-y-4 animate-fadeIn">
          {/* Copied Feedback Toast */}
          {copiedMsg && (
            <div className="fixed bottom-6 right-6 z-50 px-4 py-2.5 rounded-xl bg-teal-400 text-slate-950 font-black text-xs shadow-2xl flex items-center gap-2 border border-teal-300 animate-bounce">
              <span>✓</span>
              <span>{copiedMsg}</span>
            </div>
          )}

          {/* Search, Trainer Selector & Filter Bar (Compact & Sleek) */}
          <div
            className="p-3.5 sm:p-4 rounded-2xl border shadow-xl space-y-3"
            style={{
              backgroundColor: '#0E1B2E',
              borderColor: '#19304E',
              boxShadow: '0 8px 30px rgba(0, 0, 0, 0.4)'
            }}
          >
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
              {/* Trainer Input Bar */}
              <div className="flex items-center gap-2 flex-1">
                <div className="relative flex-1">
                  <span className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-slate-400 text-xs font-mono">
                    👤
                  </span>
                  <input
                    type="text"
                    value={vaultInputUser}
                    onChange={(e) => setVaultInputUser(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        setVaultUser(vaultInputUser);
                        fetchVaultReplays(vaultInputUser);
                      }
                    }}
                    placeholder="Enter Trainer Screen Name or @Featured"
                    className="w-full pl-9 pr-3 py-2 rounded-xl font-mono font-bold text-xs border text-white placeholder-slate-500 focus:outline-none focus:border-teal-400 transition"
                    style={{ backgroundColor: '#081120', borderColor: '#19304E' }}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setVaultUser(vaultInputUser);
                    fetchVaultReplays(vaultInputUser);
                  }}
                  className="px-3.5 py-2 rounded-xl font-extrabold text-xs border transition hover:border-teal-400 text-white cursor-pointer flex items-center gap-1.5 flex-shrink-0"
                  style={{ backgroundColor: '#081120', borderColor: '#2DD4BF' }}
                >
                  <span>🔍</span>
                  <span>View</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setVaultInputUser('Featured');
                    setVaultUser('Featured');
                    fetchVaultReplays('Featured');
                  }}
                  className="px-3 py-2 rounded-xl font-extrabold text-xs border transition hover:border-amber-400 text-amber-300 cursor-pointer flex items-center gap-1 flex-shrink-0"
                  style={{
                    backgroundColor: 'rgba(250, 204, 21, 0.12)',
                    borderColor: 'rgba(250, 204, 21, 0.45)'
                  }}
                >
                  <span>⭐</span>
                  <span>@Featured</span>
                </button>
              </div>

              {/* Share & Owner Action Buttons */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  type="button"
                  onClick={() =>
                    copyToClipboard(
                      `https://dvr.silphscopepvp.com/vault?user=${encodeURIComponent(vaultUser)}`,
                      'Vault URL'
                    )
                  }
                  className="px-2.5 py-2 rounded-lg font-bold text-xs border transition hover:border-slate-500 text-slate-300 cursor-pointer flex items-center gap-1"
                  style={{ backgroundColor: '#081120', borderColor: '#19304E' }}
                >
                  <span>📋</span>
                  <span>Share</span>
                </button>
                <button
                  type="button"
                  onClick={() => setOwnerLoginOpen(true)}
                  className="px-2.5 py-2 rounded-lg font-bold text-xs border transition hover:border-amber-400 text-amber-300 cursor-pointer flex items-center gap-1"
                  style={{ backgroundColor: '#081120', borderColor: 'rgba(250, 204, 21, 0.35)' }}
                >
                  <span>🔐</span>
                  <span>Owner Login</span>
                </button>
              </div>
            </div>

            {/* Vault Summary & Filter Tabs */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 pt-2 border-t border-slate-800/80">
              <div className="flex items-center gap-2 text-xs font-mono text-slate-300">
                <span className="font-bold text-teal-300">@{vaultUser}</span>
                <span>•</span>
                <span className="text-amber-300">⭐ {vaultStats.starred} Starred</span>
                <span>•</span>
                <span className="text-cyan-300">🌐 {vaultStats.public} Public</span>
              </div>

              {/* Filter Pills */}
              <div className="flex items-center gap-1.5">
                {(['all', 'starred', 'public'] as const).map((filter) => {
                  const labels = {
                    all: `All Shared (${vaultStats.total})`,
                    starred: `⭐ Starred (${vaultStats.starred})`,
                    public: `🌐 Public (${vaultStats.public})`
                  };
                  const active = vaultFilter === filter;
                  return (
                    <button
                      key={filter}
                      type="button"
                      onClick={() => setVaultFilter(filter)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                        active
                          ? 'bg-teal-400 text-slate-950 font-black shadow'
                          : 'bg-[#081120] text-slate-300 hover:text-white border border-[#19304E]'
                      }`}
                    >
                      {labels[filter]}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Replays Grid */}
          {loadingVault ? (
            <div className="p-12 text-center rounded-2xl border border-slate-800 bg-[#0E1B2E] space-y-3">
              <div className="inline-block w-8 h-8 border-3 border-teal-400 border-t-transparent rounded-full animate-spin"></div>
              <div className="text-sm font-bold text-teal-300">Fetching DVR Replays for @{vaultUser}...</div>
            </div>
          ) : (
            <div className="space-y-4">
              {(() => {
                const filtered = vaultReplays.filter((item) => {
                  if (vaultFilter === 'starred') return item.isPinned;
                  if (vaultFilter === 'public') return item.isPublic;
                  return true;
                });

                if (filtered.length === 0) {
                  return (
                    <div className="p-12 text-center rounded-2xl border border-slate-800 bg-[#0E1B2E] space-y-3">
                      <div className="text-3xl">🎬</div>
                      <div className="text-base font-bold text-white">No replays found in this view</div>
                      <p className="text-xs text-slate-400 max-w-md mx-auto">
                        Record battles in the SilphScope Android App with 1-Battle DVR to stream and store your battle traces here.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setVaultInputUser('Featured');
                          setVaultUser('Featured');
                          fetchVaultReplays('Featured');
                        }}
                        className="px-4 py-2 rounded-xl bg-teal-400 text-slate-950 font-black text-xs hover:bg-teal-300 transition"
                      >
                        Browse @Featured Showcase Battles
                      </button>
                    </div>
                  );
                }

                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filtered.map((item) => {
                      const isWin = item.result?.toUpperCase().includes('WIN');
                      const mbSize = ((item.videoBytes || 0) / (1024 * 1024)).toFixed(1);
                      return (
                        <div
                          key={item.shareId}
                          className="rounded-2xl border p-4.5 flex flex-col justify-between gap-4 transition hover:border-teal-400/50 hover:shadow-xl"
                          style={{
                            backgroundColor: '#0E1B2E',
                            borderColor: item.isPinned ? '#2DD4BF' : '#19304E',
                            boxShadow: item.isPinned ? '0 0 16px rgba(45, 212, 191, 0.12)' : 'none'
                          }}
                        >
                          {/* Card Header */}
                          <div className="space-y-2.5">
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`px-2.5 py-0.5 rounded-full text-xs font-black border ${
                                    isWin
                                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                      : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                                  }`}
                                >
                                  {item.result || 'BATTLE'}
                                </span>
                                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/35">
                                  {item.league}
                                </span>
                              </div>
                              <span className="text-[11px] font-mono font-bold text-slate-400">
                                {mbSize} MB • {item.durationSec}s
                              </span>
                            </div>

                            {/* Matchup Summary */}
                            <div className="text-sm font-extrabold text-white leading-snug">
                              {item.matchupSummary}
                            </div>

                            {/* Badges / Diagnostics */}
                            <div className="flex items-center gap-2 flex-wrap text-[11px]">
                              <span className="font-mono text-slate-400">
                                @{item.screenName || vaultUser}
                              </span>
                              {item.isPinned && (
                                <span className="px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/40 font-bold">
                                  ⭐ Starred
                                </span>
                              )}
                              {item.isPublic && (
                                <span className="px-2 py-0.5 rounded-full bg-teal-400/15 text-teal-300 border border-teal-400/30 font-bold">
                                  🌐 Public
                                </span>
                              )}
                              {item.userTierBadge && (
                                <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-200 border border-purple-500/40 font-semibold">
                                  {item.userTierBadge}
                                </span>
                              )}
                            </div>

                            {/* Diagnostic Issue Warning */}
                            {item.userIssueNote && (
                              <div className="p-2.5 rounded-xl bg-amber-400/10 border border-amber-400/30 text-amber-200 text-xs flex items-center gap-2">
                                <span>🚩</span>
                                <span>
                                  <strong>Reported Issue:</strong> {item.userIssueNote}
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Card Actions */}
                          <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-800/80 flex-wrap">
                            <div className="flex items-center gap-2 flex-wrap">
                              <button
                                type="button"
                                onClick={() => setSelectedWatchReplay(item)}
                                className="px-3.5 py-1.5 rounded-xl font-black text-xs border shadow transition hover:scale-105 cursor-pointer flex items-center gap-1.5"
                                style={{
                                  backgroundColor: '#2DD4BF',
                                  borderColor: '#2DD4BF',
                                  color: '#042F2E',
                                  boxShadow: '0 2px 10px rgba(45, 212, 191, 0.3)'
                                }}
                              >
                                <span>▶️</span>
                                <span>Watch + HUD</span>
                              </button>
                              {item.highlightSec && (
                                <button
                                  type="button"
                                  onClick={() => setSelectedWatchReplay(item)}
                                  className="px-2.5 py-1.5 rounded-xl font-bold text-xs bg-amber-400/15 hover:bg-amber-400/25 text-amber-300 border border-amber-400/40 transition cursor-pointer"
                                >
                                  🎯 Highlight ({item.highlightSec}s)
                                </button>
                              )}
                            </div>

                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() =>
                                  copyToClipboard(
                                    item.shareUrl || `https://dvr.silphscopepvp.com/watch/${item.shareId}`,
                                    'Replay link'
                                  )
                                }
                                className="px-2.5 py-1.5 rounded-lg font-bold text-[11px] bg-[#081120] text-slate-300 hover:text-white border border-[#19304E] transition cursor-pointer flex items-center gap-1"
                                title="Copy direct replay link"
                              >
                                <span>📋</span>
                                <span>Copy Link</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          )}

          {/* Quick Subpage Transition Hub */}
          <div className="pt-6 border-t border-slate-800 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => onSelectSubpage('home')}
              className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-teal-300 font-bold text-xs transition cursor-pointer flex items-center gap-1.5"
            >
              <span>🏠</span>
              <span>Overview &amp; Features</span>
            </button>
            <button
              type="button"
              onClick={() => onSelectSubpage('live')}
              className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-cyan-500/40 text-cyan-300 font-bold text-xs transition cursor-pointer flex items-center gap-1.5"
            >
              <span>📡</span>
              <span>Live View (Coming Soon)</span>
            </button>
            <button
              type="button"
              onClick={() => onSelectSubpage('guide')}
              className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 font-bold text-xs transition cursor-pointer flex items-center gap-1.5"
            >
              <span>📖</span>
              <span>How to Use HUD</span>
            </button>
            <button
              type="button"
              onClick={() => onLaunchWebApp('presets')}
              className="px-4 py-2 rounded-xl bg-amber-400/20 hover:bg-amber-400/30 border border-amber-400/40 text-amber-300 font-black text-xs transition cursor-pointer flex items-center gap-1.5"
            >
              <span>🧮</span>
              <span>Launch Web Simulator</span>
            </button>
          </div>
        </main>
      )}

      {/* SUBPAGE: LIVE VIEW (COMING SOON) - SECONDARY SCREEN BATTLE HUD */}
      {activeSubpage === 'live' && (
        <main className="flex-1 max-w-7xl mx-auto px-4 py-8 w-full space-y-8 animate-fadeIn">
          {/* Header Strip */}
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-black tracking-wider uppercase border border-cyan-400/40 bg-cyan-400/10 text-cyan-300">
              <span>📡 DUAL-SCREEN BATTLE HUD</span>
              <span className="text-slate-500">•</span>
              <span className="text-amber-300 font-extrabold px-2 py-0.5 rounded-full bg-amber-400/20 border border-amber-400/40">
                COMING SOON
              </span>
              <span className="text-slate-500">•</span>
              <span className="text-teal-300">IPAD &amp; IPHONE READY</span>
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-tight">
              SilphScope Live View{' '}
              <span
                style={{
                  background: 'linear-gradient(90deg, #67E8F9 0%, #2DD4BF 50%, #FACC15 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent'
                }}
              >
                (Coming Soon).
              </span>
            </h1>
            <p className="text-sm sm:text-base text-slate-300 max-w-3xl leading-relaxed">
              Upcoming feature in active development: Stream live combat telemetry from your Android battle phone directly to your iPad, iPhone, Mac, PC, or secondary tablet over zero-lag WebSocket. Test the interactive preview below to see how the secondary HUD will look on your desk!
            </p>
          </div>

          {/* iPad / iPhone PWA Callout */}
          <div
            className="p-5 rounded-2xl border shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
            style={{
              backgroundColor: 'rgba(14, 27, 46, 0.85)',
              borderColor: '#19304E'
            }}
          >
            <div className="flex items-start sm:items-center gap-3">
              <span className="text-3xl">📱</span>
              <div>
                <div className="font-black text-sm text-white">
                  Pro Setup for iPad &amp; iPhone Users
                </div>
                <div className="text-xs text-slate-300 mt-0.5">
                  Tap <strong>Share (⎋)</strong> &rarr; <strong>Add to Home Screen (⊞)</strong> in Safari to install <strong>SilphScope DVR</strong> and dock this HUD edge-to-edge on your tablet stand with zero URL bars.
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={handleInstallClick}
              className="px-3.5 py-2 rounded-xl font-bold text-xs bg-teal-400 text-slate-950 hover:bg-teal-300 transition flex-shrink-0 cursor-pointer shadow"
            >
              📲 Install SilphScope DVR
            </button>
          </div>

          {/* Connection & Live Simulation Card */}
          <div
            className="p-6 rounded-2xl border shadow-xl space-y-4"
            style={{ backgroundColor: '#0E1B2E', borderColor: '#19304E' }}
          >
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <div className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider">
                  Upcoming Feature Preview • Live Stream Simulation
                </div>
                <div className="flex items-center gap-3 mt-1">
                  <span className="font-mono text-xl sm:text-2xl font-black text-teal-300 tracking-wider">
                    {streamCode}
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-black border ${
                      isLiveConnected
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 animate-pulse'
                        : isSimulatingLive
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        : 'bg-slate-800 text-amber-300 border-amber-400/40'
                    }`}
                  >
                    {isLiveConnected
                      ? '🟢 Connected to Host (11ms)'
                      : isSimulatingLive
                      ? `🟡 Interactive Preview Active (Turn ${simTurn})`
                      : '⏳ Coming Soon • Interactive Preview'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setIsSimulatingLive(!isSimulatingLive)}
                  className={`px-4 py-2.5 rounded-xl font-black text-xs border transition cursor-pointer flex items-center gap-2 ${
                    isSimulatingLive
                      ? 'bg-amber-400 text-slate-950 border-amber-400 shadow-lg'
                      : 'bg-slate-800 text-amber-300 border-amber-400/40 hover:bg-slate-700'
                  }`}
                >
                  <span>⚡</span>
                  <span>{isSimulatingLive ? 'Pause Interactive Demo' : '▶️ Test Live View Simulation'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsLiveConnected(!isLiveConnected)}
                  className="px-4 py-2.5 rounded-xl font-bold text-xs bg-teal-400/20 text-teal-300 border border-teal-400/40 hover:bg-teal-400/30 transition cursor-pointer"
                >
                  {isLiveConnected ? 'Disconnect' : 'Connect Android Host'}
                </button>
              </div>
            </div>
          </div>

          {/* Interactive Simulated Live Tactical HUD Stage */}
          <div
            className="rounded-3xl border-2 overflow-hidden shadow-2xl relative"
            style={{
              borderColor: '#2DD4BF',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.7), 0 0 30px rgba(45, 212, 191, 0.15)'
            }}
          >
            {/* Arena Top Bar */}
            <div className="p-3 bg-slate-950/90 border-b border-slate-800 flex items-center justify-between text-xs font-mono font-bold">
              <div className="flex items-center gap-2 text-teal-300">
                <span className="w-2.5 h-2.5 rounded-full bg-teal-400 animate-ping"></span>
                <span>SILPHSCOPE SECONDARY HUD • 50% TRANSLUCENT GLASS</span>
              </div>
              <div className="text-slate-400">
                Turn {simTurn} • {(simTurn * 0.5).toFixed(1)}s • 1 Turn = 0.5s
              </div>
            </div>

            {/* Stadium Visual Stage */}
            <div
              className="p-6 relative min-h-[460px] flex flex-col justify-between"
              style={{
                background:
                  'radial-gradient(circle at 50% 30%, rgba(45, 212, 191, 0.15) 0%, transparent 60%), linear-gradient(180deg, #050B16 0%, #0A1728 50%, #050B16 100%)'
              }}
            >
              {/* Top Mirrored HUD Header */}
              <div
                className="p-4 rounded-2xl border backdrop-blur-md transition-all shadow-xl"
                style={{
                  backgroundColor: 'rgba(8, 17, 32, 0.65)',
                  borderColor: 'rgba(45, 212, 191, 0.4)'
                }}
              >
                <div className="grid grid-cols-12 gap-3 items-center">
                  {/* User Active Pokémon Slot */}
                  <div className="col-span-5 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <div className="font-black text-white flex items-center gap-1.5">
                        <span>✨ Dialga (Origin)</span>
                        <span className="font-mono text-teal-300 text-[11px]">CP 1489</span>
                      </div>
                      <span className="font-mono font-extrabold text-teal-300">
                        {Math.max(15, 100 - simTurn * 2)}%
                      </span>
                    </div>
                    {/* HP Bar */}
                    <div className="w-full h-3 rounded-full bg-slate-900 overflow-hidden border border-slate-700">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-300"
                        style={{ width: `${Math.max(15, 100 - simTurn * 2)}%` }}
                      ></div>
                    </div>
                    {/* Energy Bar & Shields */}
                    <div className="flex items-center justify-between text-[11px] font-mono">
                      <span className="text-amber-300 font-extrabold">
                        ⚡ {Math.min(100, (simTurn * 5) % 100)}E / 65E (RoTime)
                      </span>
                      <span className="text-cyan-300">🛡️ 🛡️</span>
                    </div>
                  </div>

                  {/* Center Matchup Scale */}
                  <div className="col-span-2 text-center">
                    <div className="font-black text-sm text-teal-300">VS</div>
                    <div className="text-[10px] font-mono text-slate-400">R: 584</div>
                  </div>

                  {/* Opponent Active Pokémon Slot */}
                  <div className="col-span-5 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono font-extrabold text-amber-300">
                        {Math.max(20, 95 - simTurn * 1.8)}%
                      </span>
                      <div className="font-black text-white flex items-center gap-1.5">
                        <span className="font-mono text-slate-400 text-[11px]">CP 1494</span>
                        <span>Clodsire</span>
                      </div>
                    </div>
                    {/* HP Bar */}
                    <div className="w-full h-3 rounded-full bg-slate-900 overflow-hidden border border-slate-700">
                      <div
                        className="h-full bg-gradient-to-r from-amber-400 to-rose-500 transition-all duration-300"
                        style={{ width: `${Math.max(20, 95 - simTurn * 1.8)}%` }}
                      ></div>
                    </div>
                    {/* Energy Bar & Shields */}
                    <div className="flex items-center justify-between text-[11px] font-mono">
                      <span className="text-cyan-300">🛡️ 🛡️</span>
                      <span className="text-rose-400 font-extrabold">
                        ⚡ {Math.min(100, ((simTurn + 8) * 4) % 100)}E / 55E (Earthquake)
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 4-Pillar AI Tactical Recommendations Banner */}
              <div
                className="my-6 p-4 rounded-2xl border backdrop-blur-md space-y-2"
                style={{
                  backgroundColor: 'rgba(8, 17, 32, 0.75)',
                  borderColor: 'rgba(250, 204, 21, 0.45)',
                  boxShadow: '0 0 20px rgba(250, 204, 21, 0.1)'
                }}
              >
                <div className="flex items-center justify-between text-xs font-black">
                  <div className="flex items-center gap-2 text-amber-300">
                    <span className="animate-pulse">⚠️</span>
                    <span>PILLAR 3 MOVE PACING: BLINK_1_FAST</span>
                  </div>
                  <span className="text-slate-400 font-mono text-[11px]">Sneak Window: SAFE (1T mon)</span>
                </div>
                <div className="text-xs text-white leading-relaxed font-semibold">
                  Opponent reaches <strong>Earthquake (55E)</strong> in 1 fast move. Throw <strong>Roar of Time (65E) NOW</strong> to secure CMP advantage before window closes.
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-slate-800 text-[11px] font-mono">
                  <div className="text-teal-300">
                    🛡️ <strong>Pillar 4 Verdict:</strong> SHIELD! Unshielded deals 84% (KO). Shielded deals 1 HP.
                  </div>
                  <div className="text-cyan-300 sm:text-right">
                    🔮 <strong>Pillar 1 Backline:</strong> Feraligatr 54% • Mandibuzz 31% • Drapion 15%
                  </div>
                </div>
              </div>

              {/* Bottom Asymmetric 9-Shield Matrix Mini-HUD */}
              <div
                className="p-3.5 rounded-2xl border backdrop-blur-md flex flex-col sm:flex-row items-center justify-between gap-3 text-xs"
                style={{
                  backgroundColor: 'rgba(8, 17, 32, 0.65)',
                  borderColor: 'rgba(45, 212, 191, 0.3)'
                }}
              >
                <div className="flex items-center gap-2">
                  <span className="font-bold text-teal-300">Asymmetric 9-Shield Rating:</span>
                  <span className="px-2 py-0.5 rounded-md bg-teal-400/20 text-teal-300 font-mono font-black">
                    584 (Favorable)
                  </span>
                </div>
                <div className="flex items-center gap-3 font-mono text-[11px] text-slate-300">
                  <span>0S: 512</span>
                  <span>1S: 584</span>
                  <span>2S: 620</span>
                  <span className="text-amber-300 font-bold">Safe-Swap: Tinkaton (+14% win)</span>
                </div>
              </div>
            </div>
          </div>

          {/* 3-Step Setup Instructions */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                step: '1',
                title: 'Enable Relay on Android',
                desc: 'Open SilphScope Settings on your Android phone and toggle "Live View Webcast Relay" ON. Note your broadcast pairing code.'
              },
              {
                step: '2',
                title: 'Open or Install SilphScope DVR',
                desc: 'Open silphscopepvp.com/?view=live on Safari or Chrome, tap Share -> Add to Home Screen to dock SilphScope DVR on your desk stand.'
              },
              {
                step: '3',
                title: 'Zero Latency Combat Math',
                desc: 'Enjoy live turn pacing, shield survival verdict, and backline prediction on your secondary screen while playing!'
              }
            ].map((s) => (
              <div
                key={s.step}
                className="p-5 rounded-2xl border bg-[#0E1B2E] border-[#19304E] space-y-2"
              >
                <div className="w-7 h-7 rounded-lg bg-teal-400/20 border border-teal-400/40 text-teal-300 font-black text-xs flex items-center justify-center">
                  {s.step}
                </div>
                <h3 className="font-black text-sm text-white">{s.title}</h3>
                <p className="text-xs text-slate-300 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>

          {/* Quick Subpage Transition Hub */}
          <div className="pt-6 border-t border-slate-800 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => onSelectSubpage('vault')}
              className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-teal-500/40 text-teal-300 font-black text-xs transition cursor-pointer flex items-center gap-1.5"
            >
              <span>🎬</span>
              <span>Back to DVR Vault</span>
            </button>
            <button
              type="button"
              onClick={() => onSelectSubpage('home')}
              className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 font-bold text-xs transition cursor-pointer flex items-center gap-1.5"
            >
              <span>🏠</span>
              <span>Feature Overview</span>
            </button>
            <button
              type="button"
              onClick={() => onLaunchWebApp('presets')}
              className="px-4 py-2 rounded-xl bg-amber-400/20 hover:bg-amber-400/30 border border-amber-400/40 text-amber-300 font-black text-xs transition cursor-pointer flex items-center gap-1.5"
            >
              <span>🧮</span>
              <span>Web Battle Simulator</span>
            </button>
          </div>
        </main>
      )}

      {/* IN-PAGE REPLAY THEATER MODAL (ZERO TAB OPENING!) */}
      {selectedWatchReplay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
          <div
            className="w-full max-w-5xl rounded-3xl border-2 flex flex-col overflow-hidden shadow-2xl"
            style={{
              backgroundColor: '#081120',
              borderColor: '#2DD4BF',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.8), 0 0 35px rgba(45, 212, 191, 0.25)',
              maxHeight: '94vh'
            }}
          >
            {/* Modal Header */}
            <div className="p-3.5 sm:p-4 bg-[#0E1B2E] border-b border-slate-800 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 overflow-hidden">
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-black border flex-shrink-0 ${
                    selectedWatchReplay.result?.toUpperCase().includes('WIN')
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                  }`}
                >
                  {selectedWatchReplay.result || 'BATTLE'}
                </span>
                <span className="font-extrabold text-xs sm:text-sm text-white truncate">
                  {selectedWatchReplay.matchupSummary}
                </span>
                <span className="hidden sm:inline-block px-2 py-0.5 rounded-full text-[11px] font-mono bg-cyan-400/15 text-cyan-300 border border-cyan-400/30 flex-shrink-0">
                  {selectedWatchReplay.league}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedWatchReplay(null)}
                className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center font-black text-sm flex-shrink-0 cursor-pointer transition"
                title="Close Replay Player"
              >
                ✕
              </button>
            </div>

            {/* Embedded Replay Stage */}
            <div className="flex-1 bg-black min-h-[480px] sm:min-h-[580px] relative">
              <iframe
                src={`https://dvr.silphscopepvp.com/watch/${selectedWatchReplay.shareId}?embed=1${
                  selectedWatchReplay.highlightSec ? `&t=${selectedWatchReplay.highlightSec}` : ''
                }`}
                title="SilphScope Replay Theater"
                className="w-full h-full border-none absolute inset-0"
                allow="fullscreen"
              ></iframe>
            </div>

            {/* Modal Footer Controls */}
            <div className="p-3 bg-[#0E1B2E] border-t border-slate-800 flex items-center justify-between gap-3 flex-wrap text-xs">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    copyToClipboard(
                      selectedWatchReplay.shareUrl ||
                        `https://dvr.silphscopepvp.com/watch/${selectedWatchReplay.shareId}`,
                      'Replay link'
                    )
                  }
                  className="px-3 py-1.5 rounded-lg bg-[#081120] text-teal-300 border border-teal-400/40 hover:bg-teal-400/10 font-bold transition cursor-pointer flex items-center gap-1.5"
                >
                  <span>📋</span>
                  <span>Copy Replay Link</span>
                </button>
                {selectedWatchReplay.highlightSec && (
                  <span className="text-slate-400 font-mono text-[11px] hidden sm:inline">
                    🎯 Highlight loaded at {selectedWatchReplay.highlightSec}s
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedWatchReplay(null)}
                  className="px-4 py-1.5 rounded-lg bg-teal-400 text-slate-950 font-black hover:bg-teal-300 transition cursor-pointer shadow"
                >
                  ✕ Close Theater
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PWA INSTALLATION / ADD TO HOME SCREEN MODAL (BRANDED: SILPHSCOPE DVR) */}
      {showInstallModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
          <div
            className="w-full max-w-lg rounded-3xl border-2 p-6 space-y-5 shadow-2xl relative"
            style={{
              backgroundColor: '#0E1B2E',
              borderColor: '#2DD4BF',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.8), 0 0 35px rgba(45, 212, 191, 0.25)'
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center border shadow-md"
                  style={{ backgroundColor: '#081120', borderColor: '#2DD4BF' }}
                >
                  <svg viewBox="0 0 36 36" className="w-7 h-7">
                    <polygon points="18,2 31,9 31,27 18,34 5,27 5,9" fill="rgba(14, 27, 46, 0.9)" stroke="#2DD4BF" strokeWidth="2.2" />
                    <polygon points="18,7 26,12 26,24 18,29 10,24 10,12" fill="none" stroke="#FACC15" strokeWidth="1.8" />
                    <circle cx="18" cy="18" r="3.5" fill="#FACC15" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-black text-base text-white">Install SilphScope DVR</h3>
                  <p className="text-xs text-slate-300">Full-Screen DVR Vault &amp; Secondary Screen HUD</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowInstallModal(false)}
                className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Platform Instructions */}
            <div className="space-y-3 text-xs leading-relaxed text-slate-200">
              {isIos ? (
                <div className="p-4 rounded-2xl bg-[#081120] border border-cyan-500/40 space-y-3">
                  <div className="font-black text-cyan-300 text-sm flex items-center gap-1.5">
                    <span>🍎</span>
                    <span>iPhone &amp; iPad Safari Instructions:</span>
                  </div>
                  <ol className="list-decimal list-inside space-y-2 text-slate-300">
                    <li>
                      Tap the <strong>Share</strong> button <span className="font-mono text-cyan-300">⎋</span> at the bottom of Safari (or top bar on iPad).
                    </li>
                    <li>
                      Scroll down and tap <strong className="text-white">&ldquo;Add to Home Screen&rdquo;</strong> <span className="font-mono text-cyan-300">⊞</span>.
                    </li>
                    <li>
                      Confirm the name <strong className="text-teal-300">&ldquo;SilphScope DVR&rdquo;</strong> and tap <strong className="text-teal-300">&ldquo;Add&rdquo;</strong> in the top-right corner.
                    </li>
                  </ol>
                  <p className="text-[11px] text-slate-400 pt-1 border-t border-slate-800">
                    <strong>SilphScope DVR</strong> will appear on your Home Screen with the Shiny Origin Dialga icon, launching directly into the DVR Vault and Live HUD with zero browser bars.
                  </p>
                </div>
              ) : (
                <div className="p-4 rounded-2xl bg-[#081120] border border-teal-500/40 space-y-3">
                  <div className="font-black text-teal-300 text-sm flex items-center gap-1.5">
                    <span>🤖</span>
                    <span>Android &amp; Desktop Chrome Instructions:</span>
                  </div>
                  {installPrompt ? (
                    <button
                      type="button"
                      onClick={handleInstallClick}
                      className="w-full py-3 rounded-xl bg-teal-400 text-slate-950 font-black text-sm hover:bg-teal-300 transition shadow-lg cursor-pointer flex items-center justify-center gap-2"
                    >
                      <span>📲</span>
                      <span>Click to Install SilphScope DVR Directly</span>
                    </button>
                  ) : (
                    <ol className="list-decimal list-inside space-y-2 text-slate-300">
                      <li>
                        Tap the browser menu <strong className="text-white">⋮</strong> in the top-right corner.
                      </li>
                      <li>
                        Tap <strong className="text-white">&ldquo;Install SilphScope DVR&rdquo;</strong> or <strong className="text-white">&ldquo;Add to Home screen&rdquo;</strong>.
                      </li>
                      <li>
                        Confirm to enjoy full-screen offline-cached battle replays and Live HUD!
                      </li>
                    </ol>
                  )}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowInstallModal(false)}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* OWNER LOGIN MODAL */}
      {ownerLoginOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
          <div
            className="w-full max-w-md rounded-3xl border-2 p-6 space-y-4 shadow-2xl relative"
            style={{
              backgroundColor: '#0E1B2E',
              borderColor: '#FACC15',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.8), 0 0 35px rgba(250, 204, 21, 0.2)'
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">🔐</span>
                <h3 className="font-black text-base text-white">Cloud DVR Vault Login</h3>
              </div>
              <button
                type="button"
                onClick={() => setOwnerLoginOpen(false)}
                className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Log in with your license key, password, or GitHub account to star replays, manage private battles, and access elevated diagnostic traces.
            </p>

            <div className="flex rounded-xl bg-[#081120] p-1 border border-slate-800 text-xs font-bold">
              {(['token', 'password', 'github'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setAuthTab(tab)}
                  className={`flex-1 py-1.5 rounded-lg transition capitalize ${
                    authTab === tab
                      ? 'bg-amber-400 text-slate-950 font-black'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {tab === 'token' ? 'License Key' : tab}
                </button>
              ))}
            </div>

            {authTab === 'token' && (
              <div className="space-y-3">
                <input
                  type="text"
                  value={authKey}
                  onChange={(e) => setAuthKey(e.target.value)}
                  placeholder="ssk_license_pro_..."
                  className="w-full px-3 py-2.5 rounded-xl font-mono text-xs bg-[#081120] border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (authKey.trim()) {
                      localStorage.setItem('gbl_web_unlock_key_v700', authKey.trim());
                      setOwnerLoginOpen(false);
                      copyToClipboard(authKey.trim(), 'License key saved');
                    }
                  }}
                  className="w-full py-2.5 rounded-xl bg-amber-400 text-slate-950 font-black text-xs hover:bg-amber-300 transition cursor-pointer"
                >
                  Unlock Vault
                </button>
              </div>
            )}

            {authTab === 'password' && (
              <div className="space-y-3">
                <input
                  type="email"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  placeholder="Trainer Email"
                  className="w-full px-3 py-2 rounded-xl text-xs bg-[#081120] border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                />
                <input
                  type="password"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  placeholder="Vault Password"
                  className="w-full px-3 py-2 rounded-xl text-xs bg-[#081120] border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                />
                <button
                  type="button"
                  onClick={() => {
                    setOwnerLoginOpen(false);
                  }}
                  className="w-full py-2.5 rounded-xl bg-amber-400 text-slate-950 font-black text-xs hover:bg-amber-300 transition cursor-pointer"
                >
                  Log In
                </button>
              </div>
            )}

            {authTab === 'github' && (
              <div className="space-y-3 text-center py-2">
                <p className="text-xs text-slate-400">
                  Authorize with GitHub to sync battle logs and unlock your cloud replay storage.
                </p>
                <a
                  href="https://dvr.silphscopepvp.com/v1/auth/github/start"
                  className="block w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-teal-300 font-bold text-xs border border-teal-400/40 transition"
                >
                  Connect with GitHub ↗
                </a>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <footer
        className="border-t py-8 px-4 mt-12 text-xs"
        style={{ backgroundColor: '#050B16', borderColor: '#19304E', color: '#94A3B8' }}
      >
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-black text-white">SilphScope PvP</span>
            <span>•</span>
            <a href="https://silphscopepvp.com" className="text-teal-300 hover:underline">
              silphscopepvp.com
            </a>
            <span>•</span>
            <a href="https://dvr.silphscopepvp.com" className="text-teal-300 hover:underline">
              dvr.silphscopepvp.com
            </a>
            <span>•</span>
            <a href="https://dl.silphscopepvp.com" className="text-amber-300 hover:underline">
              dl.silphscopepvp.com
            </a>
          </div>
          <div className="text-[11px] text-slate-500">
            Zero telemetry sold to third parties. Pokémon and Pokémon GO are trademarks of Nintendo, Creatures Inc., GAME FREAK inc., and Niantic, Inc.
          </div>
        </div>
      </footer>
    </div>
  );
};
