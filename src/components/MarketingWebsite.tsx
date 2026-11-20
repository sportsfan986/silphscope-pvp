import React, { useState, useEffect } from 'react';
import { VersionRoadmapInfographic } from './VersionRoadmapInfographic';
import {
  type WebAppThemePalette,
  DEFAULT_APP_THEME_ID,
  renderThemeWatermarkSvg
} from './AppThemeAndModels';

function hexToRgbTriplet(hex: string, fallback: string = '5, 8, 16'): string {
  const clean = String(hex || '').replace('#', '').trim();
  if (clean.length !== 6) return fallback;
  const n = parseInt(clean, 16);
  if (Number.isNaN(n)) return fallback;
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
}

export type MarketingSubpage = 'vault' | 'home' | 'live' | 'guide' | 'compare';

export interface MarketingWebsiteProps {
  activeSubpage: MarketingSubpage;
  onSelectSubpage: (page: MarketingSubpage) => void;
  onLaunchWebApp: (initialTab?: 'simulator' | 'presets' | 'battle_log' | 'settings' | 'meta' | 'iv_lab' | 'help' | 'math_validator') => void;
  onOpenMembershipModal: () => void;
  webScreenName: string;
  onChangeWebScreenName: (name: string) => void;
  webMembershipTier: 'free' | 'comp' | 'supporter' | 'pro' | 'vip';
  activeTheme: WebAppThemePalette;
  showThemeWatermark: boolean;
  isSignedIn: boolean;
  onApplySyncedTheme?: (themeId: string, showWatermark?: boolean) => void;
  onVaultLogout?: () => void;
  onVaultSessionRestored?: (screenName: string, sessionToken: string) => void;
}

export interface DvrReplayItem {
  shareId: string;
  battleId?: string;
  screenName?: string;
  league: string;
  result: 'WIN' | 'LOSS' | string;
  matchupSummary: string;
  showcaseTitle?: string;
  durationSec: number;
  videoBytes: number;
  totalBytes?: number;
  isPinned?: boolean;
  isPublic?: boolean;
  hideNames?: boolean;
  featuredShareId?: string;
  manuallyFlagged?: boolean;
  userTierBadge?: string;
  userIssueNote?: string;
  diagnosticReason?: string;
  highlightSec?: number;
  videoStreamUrl?: string;
  traceStreamUrl?: string;
  shareUrl?: string;
  createdAt?: string;
  uploadedAt?: string;
}

type DvrCpTier = 'ALL' | 'GREAT' | 'ULTRA' | 'MASTER';

function stripDvrLeagueCpSuffix(raw?: string): string {
  const s = String(raw || '')
    .trim()
    .replace(/\s*\((?:≤|<=)?\s*(?:500|1500|2500|10000)(?:\s*CP)?\)\s*$/i, '')
    .trim();
  const u = s.toUpperCase();
  if (u === 'BATTLE FRONTIER (SPECTRAL)' || u === 'BF (SPECTRAL)') return 'BF (Spectral)';
  if (u === 'BATTLE FRONTIER (CAULDRON)' || u === 'BF (CAULDRON)') return 'BF (Cauldron)';
  if (u === 'BATTLE FRONTIER (MASTER)' || u === 'BF (MASTER)') return 'BF (Master)';
  return s.replace(/\bBattle\s+Frontier\b/gi, 'BF');
}

function resolveDvrCpTier(rawLeague?: string): 'GREAT' | 'ULTRA' | 'MASTER' {
  const upper = String(rawLeague || '').trim().toUpperCase();
  if (!upper) return 'GREAT';
  if (upper.includes('(10000)') || upper.includes('MASTER') || upper === 'BATTLE FRONTIER (MASTER)' || upper === 'BF (MASTER)') {
    return 'MASTER';
  }
  if (upper.includes('(2500)') || upper.includes('ULTRA') || upper.includes('CAULDRON')) {
    return 'ULTRA';
  }
  return 'GREAT';
}

function formatDvrCupLabel(leagueKey: string, cpTier: DvrCpTier): string {
  const clean = stripDvrLeagueCpSuffix(leagueKey);
  const u = clean.toUpperCase();
  if (cpTier !== 'ALL' && (u === 'GREAT LEAGUE' || u === 'ULTRA LEAGUE' || u === 'MASTER LEAGUE')) {
    return 'Open / Standard';
  }
  if (cpTier !== 'ALL' && u.startsWith('MEGA ')) {
    return clean;
  }
  if (cpTier !== 'ALL' && u.includes('MEGA')) {
    return `Mega (${clean})`;
  }
  return clean;
}

function sortDvrCupsWithinTier(cups: string[]): string[] {
  const rank = (lg: string) => {
    const u = lg.trim().toUpperCase();
    if (u === 'GREAT LEAGUE' || u === 'ULTRA LEAGUE' || u === 'MASTER LEAGUE') return 0;
    if (u.includes('MEGA')) return 1;
    return 2;
  };
  return Array.from(new Set(cups)).sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}

function formatDvrLocalDateTime(raw?: string): string {
  if (!raw) return '';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

const CANONICAL_FEATURED_REPLAYS: DvrReplayItem[] = [
  {
    shareId: 'f_ul_aura_nidoking',
    battleId: 'log-1794954952774-727',
    screenName: 'Featured',
    league: 'Ultra League',
    result: 'WIN',
    matchupSummary: 'Melmetal, Mimikyu, Moltres (Galarian) vs Shadow Nidoking, Clefable, Kommo-o',
    durationSec: 152,
    videoBytes: 16601071,
    isPinned: true,
    isPublic: true,
    userTierBadge: '🌟 Official Showcase • 3D Shadow Aura & D-3 Math',
    highlightSec: 5,
    videoStreamUrl: 'https://dvr.silphscopepvp.com/v1/replays/stream/f_ul_aura_nidoking/video.mp4',
    traceStreamUrl: 'https://dvr.silphscopepvp.com/v1/replays/stream/f_ul_aura_nidoking/trace.jsonl',
    shareUrl: 'https://dvr.silphscopepvp.com/watch/f_ul_aura_nidoking'
  },
  {
    shareId: 'f_ul_bp_skeledirge',
    battleId: 'log-1794954741814-802',
    screenName: 'Featured',
    league: 'Ultra League',
    result: 'WIN',
    matchupSummary: 'Melmetal, Mimikyu, Moltres (Galarian) vs Tinkaton, Skeledirge, Goodra',
    durationSec: 182,
    videoBytes: 20487404,
    isPinned: true,
    isPublic: true,
    userTierBadge: '🌟 Official Showcase • Live ⚡BP+1 & Shadow: N/A',
    highlightSec: 134,
    videoStreamUrl: 'https://dvr.silphscopepvp.com/v1/replays/stream/f_ul_bp_skeledirge/video.mp4',
    traceStreamUrl: 'https://dvr.silphscopepvp.com/v1/replays/stream/f_ul_bp_skeledirge/trace.jsonl',
    shareUrl: 'https://dvr.silphscopepvp.com/watch/f_ul_bp_skeledirge'
  },
  {
    shareId: 'f_ul_catch_cobalion',
    battleId: 'log-1794963518100-529',
    screenName: 'Featured',
    league: 'Ultra League',
    result: 'WIN',
    matchupSummary: 'Tinkaton, Mimikyu, Swampert vs Drifblim, Weezing (Galarian), Cobalion',
    durationSec: 214,
    videoBytes: 23342531,
    isPinned: true,
    isPublic: true,
    userTierBadge: '🌟 Official Showcase • Disguise Sync & 0F Catch',
    highlightSec: 79,
    videoStreamUrl: 'https://dvr.silphscopepvp.com/v1/replays/stream/f_ul_catch_cobalion/video.mp4',
    traceStreamUrl: 'https://dvr.silphscopepvp.com/v1/replays/stream/f_ul_catch_cobalion/trace.jsonl',
    shareUrl: 'https://dvr.silphscopepvp.com/watch/f_ul_catch_cobalion'
  },
  {
    shareId: 'f_ml_closer',
    battleId: 'log-1794105062689-388',
    screenName: 'Featured',
    league: 'Mega Master League',
    result: 'WIN',
    matchupSummary: 'Dialga (Origin), Lugia, Kyogre (Primal) vs Zekrom, Kyogre (Primal), Dialga (Origin) • 4 anomalies',
    durationSec: 191,
    videoBytes: 12655475,
    isPinned: true,
    isPublic: true,
    userTierBadge: '🌟 Official Showcase • Shiny Dialga & Closer Swap',
    highlightSec: 18,
    videoStreamUrl: 'https://dvr.silphscopepvp.com/v1/replays/stream/f_ml_closer/video.mp4',
    traceStreamUrl: 'https://dvr.silphscopepvp.com/v1/replays/stream/f_ml_closer/trace.jsonl',
    shareUrl: 'https://dvr.silphscopepvp.com/watch/f_ml_closer'
  }
];

interface HeroShowcaseSlide {
  id: string;
  label: string;
  shortLabel: string;
  league: string;
  videoPath: string;
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
    label: '✨ Shiny Origin Dialga • Roar of Time Trace (Mega ML)',
    shortLabel: '✨ Shiny Dialga (ML)',
    league: 'MEGA MASTER LEAGUE',
    videoPath: 'screenshots/featured_hero_shiny_dialga.mp4',
    gifPath: 'screenshots/featured_hero_shiny_dialga.gif',
    posterPath: 'screenshots/featured_hero_shiny_dialga_poster.png',
    watchUrl: 'https://dvr.silphscopepvp.com/watch/f_ml_closer',
    highlightUrl: 'https://dvr.silphscopepvp.com/watch/f_ml_closer?t=18',
    caption:
      'Post-match Browser Replay Theater over Mega Master League footage: scrub to 0:18 to verify Roar of Time (65E) KO thresholds on Zekrom, turn-clock windows, and backline likelihoods.',
    callouts: [
      'Frame-Synced Replay Trace: Video stays clean while you toggle Full/Compact/Off HUD in browser',
      'Turn-Clock Audit: Inspects 1-Fast throw windows & opponent Fusion Bolt pacing post-match',
      'Backline Probability Context: Estimates common partners ("ZAC-C 22% PAL-O 15%") in Open Leagues'
    ]
  },
  {
    id: 'ul_aura_nidoking',
    label: '🟣 3D Shadow Aura & D-3 Stage Replay (Ultra League)',
    shortLabel: '🟣 Shadow Aura (UL)',
    league: 'ULTRA LEAGUE',
    videoPath: 'screenshots/featured_ul_aura_nidoking.mp4',
    gifPath: 'screenshots/featured_ul_aura_nidoking.gif',
    posterPath: 'screenshots/featured_ul_aura_nidoking_poster.png',
    watchUrl: 'https://dvr.silphscopepvp.com/watch/f_ul_aura_nidoking',
    highlightUrl: 'https://dvr.silphscopepvp.com/watch/f_ul_aura_nidoking?t=5',
    caption:
      'Hardware DVR + JSONL telemetry log: verifies Shadow Nidoking at 0:04 via 3D HSV Shadow Aura ("Shadow: 🟣 ON ✓"), narrows Observed-CP IVs (0/14/11), and scrubs D-3 Sand Tomb math.',
    callouts: [
      '3D HSV Shadow Verification: Confirms Shadow: 🟣 ON ✓ in 0.4s without manual logging',
      'Observed-CP IV Narrowing: Tightens candidate IV spreads for post-match KO & survival review',
      '3-Way ELO Meta Logging: Records opponent cores ("SKELE 21% • SAMPH 12%") automatically'
    ]
  },
  {
    id: 'ul_bp_skeledirge',
    label: '⚡ Observed-CP BP+1 & Shadow: N/A Replay (Ultra League)',
    shortLabel: '⚡ Breakpoint Trace (UL)',
    league: 'ULTRA LEAGUE',
    videoPath: 'screenshots/featured_ul_bp_skeledirge.mp4',
    gifPath: 'screenshots/featured_ul_bp_skeledirge.gif',
    posterPath: 'screenshots/featured_ul_bp_skeledirge_poster.png',
    watchUrl: 'https://dvr.silphscopepvp.com/watch/f_ul_bp_skeledirge',
    highlightUrl: 'https://dvr.silphscopepvp.com/watch/f_ul_bp_skeledirge?t=134',
    caption:
      'Replay study of Mimikyu vs. Skeledirge (0/13/12 IVs): reconstructs ⚡BP+1 fast-move breakpoints from Observed CP and verifies fast moves offline via Raw HP-Pulse Cadence.',
    callouts: [
      'Offline Breakpoint Inspection: Surfaces ⚡BP+1 / 🛡️BLK-1 flips directly in the replay timeline',
      'Hybrid OTA Shadow Lock: Keeps Tinkaton, Skeledirge & Goodra locked to Shadow: N/A',
      'Catch-Timing Breakdown: Pinpoints 0F endgame switch windows during post-battle review'
    ]
  },
  {
    id: 'ul_catch_cobalion',
    label: '🎭 A-2/D-1 Disguise Sync & 0F Catch Replay (Ultra League)',
    shortLabel: '🎭 Disguise & Catch (UL)',
    league: 'ULTRA LEAGUE',
    videoPath: 'screenshots/featured_ul_catch_cobalion.mp4',
    gifPath: 'screenshots/featured_ul_catch_cobalion.gif',
    posterPath: 'screenshots/featured_ul_catch_cobalion_poster.png',
    watchUrl: 'https://dvr.silphscopepvp.com/watch/f_ul_catch_cobalion',
    highlightUrl: 'https://dvr.silphscopepvp.com/watch/f_ul_catch_cobalion?t=79',
    caption:
      'Tinkaton, Mimikyu & Swampert vs. Drifblim, Galarian Weezing & Cobalion: clean VOD trace verifying Ghost-VFX-safe Shadow: OFF ✓, A-2/D-1 Disguise Bust sync, and 0F Swap-Catch onto Swampert.',
    callouts: [
      'Ghost-VFX-Safe Shadow Proof: Verifies Drifblim as Shadow: OFF ✓ via ΔHP without aura bleed',
      'Hardened Mimikyu Disguise Sync: Tracks A-2 👹D-1 cleanly without -2 DEF double-counting',
      'Endgame Catch Replay: Scrub straight to 1:45 to study the 0F Brutal Swing catch onto Swampert'
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
  webMembershipTier,
  activeTheme,
  showThemeWatermark,
  isSignedIn,
  onApplySyncedTheme,
  onVaultLogout,
  onVaultSessionRestored
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

  // Cross-subdomain cookie helpers (.silphscopepvp.com) so silphscopepvp.com & dvr.silphscopepvp.com share cached login
  const readSharedVaultCookie = (name: string): string => {
    try {
      const match = document.cookie.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]*)'));
      return match && match[1] ? decodeURIComponent(match[1]).trim() : '';
    } catch {
      return '';
    }
  };

  const writeSharedVaultCookies = (user: string, session: string) => {
    try {
      const isSilphDomain = window.location.hostname.endsWith('silphscopepvp.com');
      const domainAttr = isSilphDomain ? '; domain=.silphscopepvp.com' : '';
      const secureAttr = window.location.protocol === 'https:' ? '; Secure' : '';
      if (user && user.toLowerCase() !== 'featured') {
        document.cookie = `sspvp_vault_user=${encodeURIComponent(user)}; path=/; max-age=31536000; SameSite=Lax${domainAttr}${secureAttr}`;
      }
      if (session) {
        document.cookie = `sspvp_vault_session=${encodeURIComponent(session)}; path=/; max-age=31536000; SameSite=Lax${domainAttr}${secureAttr}`;
      }
    } catch {}
  };

  const clearSharedVaultCookies = () => {
    try {
      const isSilphDomain = window.location.hostname.endsWith('silphscopepvp.com');
      const domainAttr = isSilphDomain ? '; domain=.silphscopepvp.com' : '';
      const secureAttr = window.location.protocol === 'https:' ? '; Secure' : '';
      ['sspvp_vault_user', 'sspvp_vault_session', 'sspvp_theme', 'sspvp_watermark'].forEach((ck) => {
        document.cookie = `${ck}=; path=/; max-age=0; SameSite=Lax${domainAttr}${secureAttr}`;
        document.cookie = `${ck}=; path=/; max-age=0; SameSite=Lax${secureAttr}`;
      });
    } catch {}
  };

  const extractScreenNameFromSessionToken = (token: string): string => {
    try {
      if (!token) return '';
      const parts = token.trim().split('.');
      if ((parts.length === 4 || parts.length === 5) && parts[0]) {
        const expiresMs = Number(parts[2]) || 0;
        if (expiresMs > Date.now() && parts[0].toLowerCase() !== 'featured' && parts[0].toLowerCase() !== 'anonymous') {
          return parts[0];
        }
      }
    } catch {}
    return '';
  };

  // DVR Replay Vault State (Defaults to Logged-In User)
  const [vaultUser, setVaultUser] = useState<string>(() => {
    try {
      const urlUser = new URLSearchParams(window.location.search).get('user');
      if (urlUser && urlUser.trim()) return urlUser.trim();
      const storedVaultUser = (localStorage.getItem('sspvp_vault_user') || '').trim();
      if (storedVaultUser && storedVaultUser.toLowerCase() !== 'featured') {
        return storedVaultUser;
      }
      const storedWebUser = (localStorage.getItem('gbl_web_screen_name_v700') || '').trim();
      if (storedWebUser && storedWebUser.toLowerCase() !== 'featured') {
        return storedWebUser;
      }
      const cookieUser = readSharedVaultCookie('sspvp_vault_user');
      if (cookieUser && cookieUser.toLowerCase() !== 'featured') {
        localStorage.setItem('sspvp_vault_user', cookieUser);
        localStorage.setItem('gbl_web_screen_name_v700', cookieUser);
        return cookieUser;
      }
      const cachedSession = (localStorage.getItem('sspvp_vault_session') || readSharedVaultCookie('sspvp_vault_session')).trim();
      const tokenUser = extractScreenNameFromSessionToken(cachedSession);
      if (tokenUser) {
        localStorage.setItem('sspvp_vault_user', tokenUser);
        localStorage.setItem('gbl_web_screen_name_v700', tokenUser);
        if (cachedSession) localStorage.setItem('sspvp_vault_session', cachedSession);
        return tokenUser;
      }
      if (webScreenName && webScreenName.trim() && webScreenName.toLowerCase() !== 'featured') {
        return webScreenName.trim();
      }
      return 'Featured';
    } catch {
      return 'Featured';
    }
  });
  const [vaultInputUser, setVaultInputUser] = useState<string>(vaultUser);
  const [isVaultOwner, setIsVaultOwner] = useState<boolean>(() => {
    try {
      const sess = localStorage.getItem('sspvp_vault_session') || readSharedVaultCookie('sspvp_vault_session');
      if (sess && !localStorage.getItem('sspvp_vault_session')) {
        localStorage.setItem('sspvp_vault_session', sess);
      }
      return Boolean(sess);
    } catch {
      return false;
    }
  });
  const [vaultFilter, setVaultFilter] = useState<'all' | 'starred' | 'public' | 'private'>('all');
  const [vaultCpTier, setVaultCpTier] = useState<DvrCpTier>('ALL');
  const [vaultCupFilter, setVaultCupFilter] = useState<string>('ALL');
  const [vaultReplays, setVaultReplays] = useState<DvrReplayItem[]>(CANONICAL_FEATURED_REPLAYS);
  const [loadingVault, setLoadingVault] = useState<boolean>(false);
  const [vaultStats, setVaultStats] = useState<{ total: number; starred: number; public: number; private: number }>({
    total: 3,
    starred: 3,
    public: 3,
    private: 0
  });
  const [vaultVisibility, setVaultVisibility] = useState<string>('public_only');
  const [vaultUsageInfo, setVaultUsageInfo] = useState<{
    usedMb: number;
    maxStorageMb: number;
    rollingCount: number;
    maxRollingBattles: number;
    pinnedCount: number;
    maxPinnedBattles: number;
  } | null>(null);
  const [vaultActionBusyId, setVaultActionBusyId] = useState<string>('');
  const [selectedWatchReplay, setSelectedWatchReplay] = useState<DvrReplayItem | null>(null);
  const [selectedWatchSeekSec, setSelectedWatchSeekSec] = useState<number>(0);
  const [ownerLoginOpen, setOwnerLoginOpen] = useState<boolean>(false);
  const [authTab, setAuthTab] = useState<'token' | 'password'>('password');
  const [authKey, setAuthKey] = useState<string>(() => {
    try { return localStorage.getItem('gbl_web_unlock_key_v700') || ''; } catch { return ''; }
  });
  const [authPassword, setAuthPassword] = useState<string>('');
  const [authEmail, setAuthEmail] = useState<string>(() => {
    try { return localStorage.getItem('gbl_web_claim_email_v700') || ''; } catch { return ''; }
  });
  const [authErrorMsg, setAuthErrorMsg] = useState<string>('');
  const [authLoading, setAuthLoading] = useState<boolean>(false);

  const fetchVaultReplays = async (userToFetch: string, forceFull = false) => {
    const user = (userToFetch || 'Featured').trim();
    const isFeat = user.toLowerCase() === 'featured' || user.toLowerCase() === '_featured';
    const sessionToken = localStorage.getItem('sspvp_vault_session') || readSharedVaultCookie('sspvp_vault_session') || '';
    const unlockKey = localStorage.getItem('gbl_web_unlock_key_v700') || '';
    const claimEmail = localStorage.getItem('gbl_web_claim_email_v700') || '';

    const cacheKey = `sspvp_dvr_vault_cache_v2_${user.toLowerCase()}`;
    let cachedPayload: any = null;
    if (!isFeat) {
      try {
        const rawCached = localStorage.getItem(cacheKey);
        if (rawCached) {
          cachedPayload = JSON.parse(rawCached);
        }
      } catch {}
    }

    if (cachedPayload && Array.isArray(cachedPayload.items)) {
      const cachedOwner = Boolean(cachedPayload.isOwner);
      setIsVaultOwner(cachedOwner);
      setVaultReplays(cachedPayload.items);
      const cStarred = cachedPayload.totalStarredCount ?? cachedPayload.items.filter((i: any) => i.isPinned).length;
      const cPublic = cachedPayload.totalPublicCount ?? cachedPayload.items.filter((i: any) => i.isPublic).length;
      const cPrivate = cachedPayload.items.filter((i: any) => !i.isPublic).length;
      setVaultStats({
        total: cachedPayload.items.length,
        starred: cStarred,
        public: cPublic,
        private: cPrivate
      });
      if (cachedPayload.settings?.publicVisibility || cachedPayload.visibility) {
        setVaultVisibility(String(cachedPayload.settings?.publicVisibility || cachedPayload.visibility || 'public_only'));
      }
      if (cachedOwner && cachedPayload.usage) {
        setVaultUsageInfo({
          usedMb: Number(cachedPayload.usage.usedMb ?? 0),
          maxStorageMb: Number(cachedPayload.limits?.maxStorageMb ?? 2048),
          rollingCount: Number(cachedPayload.usage.rollingCount ?? 0),
          maxRollingBattles: Number(cachedPayload.limits?.maxRollingBattles ?? 50),
          pinnedCount: Number(cachedPayload.usage.pinnedCount ?? 0),
          maxPinnedBattles: Number(cachedPayload.limits?.maxPinnedBattles ?? 10)
        });
      }
    } else {
      setLoadingVault(true);
    }

    try {
      const wantOwnerNow = Boolean(sessionToken || unlockKey);
      const canUseDelta =
        !forceFull &&
        !isFeat &&
        cachedPayload &&
        Array.isArray(cachedPayload.items) &&
        Number(cachedPayload.updatedAtMs) > 0 &&
        Boolean(cachedPayload.isOwner) === wantOwnerNow;
      const qs = canUseDelta
        ? `user=${encodeURIComponent(user)}&since=${encodeURIComponent(String(cachedPayload.updatedAtMs))}&delta=1`
        : `user=${encodeURIComponent(user)}`;

      const res = await fetch(`https://dvr.silphscopepvp.com/v1/replays/list?${qs}`, {
        headers: {
          'X-SilphScope-Client-Key': 'ssk_client_v615_telemetry_ingest_9f8a7b6c5d4e3f2a1b0c',
          'X-Trainer-Screen-Name': user,
          'X-Vault-Session': sessionToken,
          'X-SilphScope-Unlock-Key': unlockKey,
          'X-Claim-Email': claimEmail
        }
      });
      const data = await res.json();
      if (data && data.ok) {
        const ownerState = Boolean(data.isOwner);
        let mergedItems: DvrReplayItem[] = Array.isArray(data.items) ? data.items : [];
        if (data.unchanged && cachedPayload && Array.isArray(cachedPayload.items)) {
          mergedItems = cachedPayload.items;
        } else if (data.delta && cachedPayload && Array.isArray(cachedPayload.items)) {
          const delShareSet = new Set<string>(Array.isArray(data.deletedShareIds) ? data.deletedShareIds : []);
          const delBattleSet = new Set<string>(Array.isArray(data.deletedBattleIds) ? data.deletedBattleIds : []);
          const activeShareSet = Array.isArray(data.activeShareIds) ? new Set<string>(data.activeShareIds) : null;
          const byShare = new Map<string, DvrReplayItem>();
          for (const prev of cachedPayload.items) {
            if (!prev?.shareId) continue;
            if (delShareSet.has(prev.shareId) || (prev.battleId && delBattleSet.has(prev.battleId))) continue;
            if (activeShareSet && !activeShareSet.has(prev.shareId)) continue;
            byShare.set(prev.shareId, prev);
          }
          for (const up of Array.isArray(data.upsertedItems) ? data.upsertedItems : []) {
            if (up?.shareId) byShare.set(up.shareId, up);
          }
          mergedItems = Array.from(byShare.values()).sort(
            (a: any, b: any) => new Date(b.uploadedAt || 0).getTime() - new Date(a.uploadedAt || 0).getTime()
          );
        }

        setIsVaultOwner(ownerState);
        setVaultReplays(mergedItems.length > 0 ? mergedItems : []);
        const totalStarred = data.totalStarredCount ?? mergedItems.filter((i: any) => i.isPinned).length;
        const totalPublic = data.totalPublicCount ?? mergedItems.filter((i: any) => i.isPublic).length;
        const totalPrivate = mergedItems.filter((i: any) => !i.isPublic).length;
        setVaultStats({
          total: mergedItems.length,
          starred: totalStarred,
          public: totalPublic,
          private: totalPrivate
        });
        if (data.settings?.publicVisibility || data.visibility) {
          setVaultVisibility(String(data.settings?.publicVisibility || data.visibility || 'public_only'));
        }
        if (ownerState && data.usage) {
          setVaultUsageInfo({
            usedMb: Number(data.usage.usedMb ?? 0),
            maxStorageMb: Number(data.limits?.maxStorageMb ?? 2048),
            rollingCount: Number(data.usage.rollingCount ?? 0),
            maxRollingBattles: Number(data.limits?.maxRollingBattles ?? 50),
            pinnedCount: Number(data.usage.pinnedCount ?? 0),
            maxPinnedBattles: Number(data.limits?.maxPinnedBattles ?? 10)
          });
        } else {
          setVaultUsageInfo(null);
        }
        const activeSess = data.sessionToken || sessionToken;
        if (data.sessionToken) {
          localStorage.setItem('sspvp_vault_session', data.sessionToken);
        }
        if (ownerState && data.screenName) {
          localStorage.setItem('sspvp_vault_user', data.screenName);
          localStorage.setItem('gbl_web_screen_name_v700', data.screenName);
          writeSharedVaultCookies(data.screenName, activeSess);
          if (activeSess) onVaultSessionRestored?.(data.screenName, activeSess);
          if (data.userThemeId) {
            const wmFlag = data.showThemeWatermark !== false;
            onApplySyncedTheme?.(String(data.userThemeId), wmFlag);
            try {
              const isSilphDomain = window.location.hostname.endsWith('silphscopepvp.com');
              const dom = isSilphDomain ? '; domain=.silphscopepvp.com' : '';
              const sec = window.location.protocol === 'https:' ? '; Secure' : '';
              document.cookie = `sspvp_theme=${encodeURIComponent(String(data.userThemeId))}; path=/; max-age=31536000; SameSite=Lax${dom}${sec}`;
              document.cookie = `sspvp_watermark=${wmFlag ? '1' : '0'}; path=/; max-age=31536000; SameSite=Lax${dom}${sec}`;
            } catch {}
          }
        }
        if (!isFeat) {
          try {
            localStorage.setItem(
              cacheKey,
              JSON.stringify({
                ...data,
                items: mergedItems,
                unchanged: false,
                delta: false
              })
            );
          } catch {}
        }
      } else {
        setVaultUsageInfo(null);
        if (user.toLowerCase() === 'featured') {
          setVaultReplays(CANONICAL_FEATURED_REPLAYS);
        } else if (!cachedPayload) {
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

  const recalcVaultStatsFromItems = (items: DvrReplayItem[]) => {
    setVaultStats({
      total: items.length,
      starred: items.filter((i) => Boolean(i.isPinned)).length,
      public: items.filter((i) => Boolean(i.isPublic)).length,
      private: items.filter((i) => !i.isPublic).length
    });
  };

  const buildVaultAuthPayload = () => {
    const sessionToken = localStorage.getItem('sspvp_vault_session') || readSharedVaultCookie('sspvp_vault_session') || '';
    const unlockKey = localStorage.getItem('gbl_web_unlock_key_v700') || '';
    const claimEmail = localStorage.getItem('gbl_web_claim_email_v700') || '';
    const activeOwner = (vaultUser || localStorage.getItem('sspvp_vault_user') || '').trim();
    return {
      activeOwner,
      sessionToken,
      unlockKey,
      claimEmail,
      headers: {
        'Content-Type': 'application/json',
        'X-SilphScope-Client-Key': 'ssk_client_v615_telemetry_ingest_9f8a7b6c5d4e3f2a1b0c',
        'X-Trainer-Screen-Name': activeOwner,
        'X-Vault-Session': sessionToken,
        'X-SilphScope-Unlock-Key': unlockKey,
        'X-Claim-Email': claimEmail
      }
    };
  };

  const handleUpdateVaultVisibility = async (nextVis: string) => {
    const prevVis = vaultVisibility;
    setVaultVisibility(nextVis);
    const auth = buildVaultAuthPayload();
    try {
      const res = await fetch('https://dvr.silphscopepvp.com/v1/replays/settings', {
        method: 'POST',
        headers: auth.headers,
        body: JSON.stringify({
          publicVisibility: nextVis,
          sessionToken: auth.sessionToken,
          unlockKey: auth.unlockKey,
          claimEmail: auth.claimEmail
        })
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        setVaultVisibility(prevVis);
        alert(data?.error || 'Could not update vault visibility.');
        return;
      }
      setCopiedMsg('Vault privacy setting updated!');
      setTimeout(() => setCopiedMsg(''), 2400);
    } catch (e: any) {
      setVaultVisibility(prevVis);
      alert('Error updating visibility: ' + (e?.message || 'offline'));
    }
  };

  const handleToggleStarReplay = async (item: DvrReplayItem) => {
    const nextPinned = !Boolean(item.isPinned);
    const auth = buildVaultAuthPayload();
    setVaultActionBusyId(item.shareId);
    // Optimistic update
    const updated = vaultReplays.map((r) => (r.shareId === item.shareId ? { ...r, isPinned: nextPinned } : r));
    setVaultReplays(updated);
    recalcVaultStatsFromItems(updated);
    try {
      const res = await fetch('https://dvr.silphscopepvp.com/v1/replays/pin', {
        method: 'POST',
        headers: auth.headers,
        body: JSON.stringify({
          battleId: item.battleId || '',
          shareId: item.shareId,
          isPinned: nextPinned,
          sessionToken: auth.sessionToken,
          unlockKey: auth.unlockKey,
          claimEmail: auth.claimEmail
        })
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        fetchVaultReplays(vaultUser);
        alert(data?.error || 'Failed to star/unstar replay.');
        return;
      }
      setCopiedMsg(nextPinned ? '⭐ Starred replay (kept 365 days)!' : 'Removed star from replay');
      setTimeout(() => setCopiedMsg(''), 2200);
    } catch (e: any) {
      fetchVaultReplays(vaultUser);
      alert('Error updating star: ' + (e?.message || 'offline'));
    } finally {
      setVaultActionBusyId('');
    }
  };

  const handleTogglePublicReplay = async (item: DvrReplayItem) => {
    const nextPublic = !Boolean(item.isPublic);
    const auth = buildVaultAuthPayload();
    setVaultActionBusyId(item.shareId);
    const updated = vaultReplays.map((r) => (r.shareId === item.shareId ? { ...r, isPublic: nextPublic } : r));
    setVaultReplays(updated);
    recalcVaultStatsFromItems(updated);
    try {
      const res = await fetch('https://dvr.silphscopepvp.com/v1/replays/pin', {
        method: 'POST',
        headers: auth.headers,
        body: JSON.stringify({
          battleId: item.battleId || '',
          shareId: item.shareId,
          isPublic: nextPublic,
          sessionToken: auth.sessionToken,
          unlockKey: auth.unlockKey,
          claimEmail: auth.claimEmail
        })
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        fetchVaultReplays(vaultUser);
        alert(data?.error || 'Failed to change public/private status.');
        return;
      }
      setCopiedMsg(nextPublic ? '🌐 Replay marked Public!' : '🔒 Replay marked Private!');
      setTimeout(() => setCopiedMsg(''), 2200);
    } catch (e: any) {
      fetchVaultReplays(vaultUser);
      alert('Error updating privacy: ' + (e?.message || 'offline'));
    } finally {
      setVaultActionBusyId('');
    }
  };

  const handleShareReplay = async (item: DvrReplayItem) => {
    const url = item.shareUrl || `https://dvr.silphscopepvp.com/watch/${item.shareId}`;
    const title = `SilphScope DVR • ${item.matchupSummary || item.league}`;
    try {
      if (navigator.share) {
        await navigator.share({ title, text: title, url });
        return;
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
    }
    copyToClipboard(url, 'Replay link');
  };

  const handlePromoteToFeatured = async (item: DvrReplayItem) => {
    const highlightStr = window.prompt(
      'Optional highlight timestamp in seconds (e.g. 44 for T+44s, or leave 0):',
      String(item.highlightSec || 0)
    );
    if (highlightStr === null) return;
    const badgeLabel =
      window.prompt('Showcase badge label:', '🌟 Official Showcase') || '🌟 Official Showcase';
    const auth = buildVaultAuthPayload();
    setVaultActionBusyId(item.shareId);
    try {
      const res = await fetch('https://dvr.silphscopepvp.com/v1/replays/feature', {
        method: 'POST',
        headers: auth.headers,
        body: JSON.stringify({
          shareId: item.shareId,
          highlightSec: Number(highlightStr) || 0,
          badgeLabel,
          sessionToken: auth.sessionToken,
          unlockKey: auth.unlockKey
        })
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        alert(data?.error || 'Failed to promote replay to @Featured.');
        return;
      }
      setCopiedMsg('🌟 Promoted to @Featured Showcase!');
      setTimeout(() => setCopiedMsg(''), 3000);
      fetchVaultReplays(vaultUser);
    } catch (e: any) {
      alert('Error promoting replay: ' + (e?.message || 'offline'));
    } finally {
      setVaultActionBusyId('');
    }
  };

  const handleFlagReplay = async (item: DvrReplayItem, unflag = false) => {
    const auth = buildVaultAuthPayload();
    let devId = 'web_vault_client';
    try {
      devId = localStorage.getItem('silphscope_device_id') || 'web_vault_client';
    } catch {}

    if (unflag) {
      if (!window.confirm(`Unflag and retract the issue report on ${item.battleId || item.shareId}?`)) return;
      setVaultActionBusyId(item.shareId);
      try {
        const res = await fetch('https://dvr.silphscopepvp.com/v1/dvr/unflag', {
          method: 'POST',
          headers: { ...auth.headers, 'X-Device-Hash': devId },
          body: JSON.stringify({
            battleId: item.battleId || '',
            shareId: item.shareId,
            screenName: auth.activeOwner,
            sessionToken: auth.sessionToken,
            unlockKey: auth.unlockKey,
            claimEmail: auth.claimEmail,
            deviceHash: devId
          })
        });
        const data = await res.json();
        if (!res.ok || !data?.ok) {
          alert(data?.error || 'Failed to unflag replay.');
          return;
        }
        setCopiedMsg('↩️ Issue report retracted');
        setTimeout(() => setCopiedMsg(''), 2200);
        fetchVaultReplays(vaultUser);
      } catch (e: any) {
        alert('Error unflagging issue: ' + (e?.message || 'offline'));
      } finally {
        setVaultActionBusyId('');
      }
      return;
    }

    const note = window.prompt(
      `🚩 Flag / Update Issue Report for ${item.battleId || item.shareId}:\nDescribe what went wrong (e.g. HP jump, wrong move count, OCR misread):`,
      item.userIssueNote || ''
    );
    if (note === null) return;
    const cleanNote = note.trim();
    if (!cleanNote) {
      if (item.userIssueNote && window.confirm('Description left blank — unflag & retract this issue report instead?')) {
        handleFlagReplay(item, true);
      }
      return;
    }

    setVaultActionBusyId(item.shareId);
    try {
      const res = await fetch('https://dvr.silphscopepvp.com/v1/dvr/flag', {
        method: 'POST',
        headers: { ...auth.headers, 'X-Device-Hash': devId },
        body: JSON.stringify({
          battleId: item.battleId || '',
          shareId: item.shareId,
          screenName: auth.activeOwner,
          userIssueNote: cleanNote,
          league: item.league || 'GBL',
          matchupSummary: item.matchupSummary || '',
          sessionToken: auth.sessionToken,
          unlockKey: auth.unlockKey,
          claimEmail: auth.claimEmail,
          deviceHash: devId
        })
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        alert(data?.error || 'Failed to flag replay issue.');
        return;
      }
      setCopiedMsg('🚩 Replay flagged for diagnostic review!');
      setTimeout(() => setCopiedMsg(''), 2400);
      fetchVaultReplays(vaultUser);
    } catch (e: any) {
      alert('Error flagging issue: ' + (e?.message || 'offline'));
    } finally {
      setVaultActionBusyId('');
    }
  };

  const handleDeleteReplay = async (item: DvrReplayItem) => {
    if (
      !window.confirm(
        `🗑️ Permanently delete "${item.matchupSummary || item.shareId}" from your Cloud DVR Vault? This cannot be undone.`
      )
    ) {
      return;
    }
    const auth = buildVaultAuthPayload();
    setVaultActionBusyId(item.shareId);
    try {
      const qs = `battleId=${encodeURIComponent(item.battleId || '')}&shareId=${encodeURIComponent(item.shareId)}`;
      const res = await fetch(`https://dvr.silphscopepvp.com/v1/replays/delete?${qs}`, {
        method: 'POST',
        headers: auth.headers,
        body: JSON.stringify({
          battleId: item.battleId || '',
          shareId: item.shareId,
          sessionToken: auth.sessionToken,
          unlockKey: auth.unlockKey,
          claimEmail: auth.claimEmail
        })
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        alert(data?.error || 'Failed to delete replay.');
        return;
      }
      const remaining = vaultReplays.filter((r) => r.shareId !== item.shareId);
      setVaultReplays(remaining);
      recalcVaultStatsFromItems(remaining);
      setCopiedMsg('🗑️ Replay deleted from Cloud Vault');
      setTimeout(() => setCopiedMsg(''), 2400);
    } catch (e: any) {
      alert('Error deleting replay: ' + (e?.message || 'offline'));
    } finally {
      setVaultActionBusyId('');
    }
  };

  const handleTokenLogin = async () => {
    if (!authKey.trim() && !authEmail.trim()) return;
    setAuthLoading(true);
    setAuthErrorMsg('');
    const candidateUser =
      vaultInputUser && vaultInputUser.toLowerCase() !== 'featured'
        ? vaultInputUser.trim()
        : vaultUser.toLowerCase() !== 'featured'
        ? vaultUser.trim()
        : '';
    try {
      const res = await fetch('https://api.silphscopepvp.com/v1/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-SilphScope-Client-Key': 'ssk_client_v615_telemetry_ingest_9f8a7b6c5d4e3f2a1b0c',
          'X-Trainer-Screen-Name': candidateUser || 'trainer'
        },
        body: JSON.stringify({
          unlockKey: authKey.trim().toUpperCase(),
          claimEmail: authEmail.trim().toLowerCase(),
          screenName: candidateUser
        })
      });
      const data = await res.json();
      if (data && data.ok) {
        if (data.sessionToken) localStorage.setItem('sspvp_vault_session', data.sessionToken);
        if (authKey.trim()) localStorage.setItem('gbl_web_unlock_key_v700', authKey.trim().toUpperCase());
        if (authEmail.trim()) localStorage.setItem('gbl_web_claim_email_v700', authEmail.trim().toLowerCase());
        const resolvedName = (data.screenName || candidateUser || '').trim();
        if (resolvedName && resolvedName.toLowerCase() !== 'featured') {
          localStorage.setItem('sspvp_vault_user', resolvedName);
          localStorage.setItem('gbl_web_screen_name_v700', resolvedName);
          writeSharedVaultCookies(resolvedName, data.sessionToken || '');
          setVaultUser(resolvedName);
          setVaultInputUser(resolvedName);
          onChangeWebScreenName(resolvedName);
          if (data.sessionToken) onVaultSessionRestored?.(resolvedName, data.sessionToken);
        }
        setIsVaultOwner(true);
        setOwnerLoginOpen(false);
        fetchVaultReplays(resolvedName || vaultUser);
      } else {
        setAuthErrorMsg(data?.error || 'Invalid Unlock Key or Checkout Email.');
      }
    } catch (e: any) {
      setAuthErrorMsg('Login error: ' + (e?.message || 'offline'));
    } finally {
      setAuthLoading(false);
    }
  };

  const handlePasswordLogin = async () => {
    if (!authPassword.trim()) return;
    setAuthLoading(true);
    setAuthErrorMsg('');
    const userToLogin = (
      authEmail.trim() ||
      (vaultInputUser.toLowerCase() !== 'featured' ? vaultInputUser.trim() : '') ||
      (vaultUser.toLowerCase() !== 'featured' ? vaultUser.trim() : '')
    ).trim();
    try {
      const res = await fetch('https://api.silphscopepvp.com/v1/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-SilphScope-Client-Key': 'ssk_client_v615_telemetry_ingest_9f8a7b6c5d4e3f2a1b0c',
          'X-Trainer-Screen-Name': userToLogin || 'trainer'
        },
        body: JSON.stringify({
          screenName: userToLogin,
          password: authPassword.trim()
        })
      });
      const data = await res.json();
      if (data && data.ok) {
        if (data.sessionToken) localStorage.setItem('sspvp_vault_session', data.sessionToken);
        const resolvedName = (data.screenName || userToLogin || '').trim();
        if (resolvedName && resolvedName.toLowerCase() !== 'featured') {
          localStorage.setItem('sspvp_vault_user', resolvedName);
          localStorage.setItem('gbl_web_screen_name_v700', resolvedName);
          writeSharedVaultCookies(resolvedName, data.sessionToken || '');
          setVaultUser(resolvedName);
          setVaultInputUser(resolvedName);
          onChangeWebScreenName(resolvedName);
          if (data.sessionToken) onVaultSessionRestored?.(resolvedName, data.sessionToken);
        }
        setIsVaultOwner(true);
        setOwnerLoginOpen(false);
        fetchVaultReplays(resolvedName || vaultUser);
      } else {
        setAuthErrorMsg(data?.error || 'Invalid username or password.');
      }
    } catch (e: any) {
      setAuthErrorMsg('Login error: ' + (e?.message || 'offline'));
    } finally {
      setAuthLoading(false);
    }
  };

  // Close full-screen replay theater via Escape key or iframe postMessage
  useEffect(() => {
    if (!selectedWatchReplay) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedWatchReplay(null);
    };
    const onMsg = (e: MessageEvent) => {
      if (e?.data?.type === 'SSPVP_CLOSE_REPLAY') setSelectedWatchReplay(null);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('message', onMsg);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('message', onMsg);
    };
  }, [selectedWatchReplay]);

  // Auto-restore cached session on launch
  useEffect(() => {
    try {
      localStorage.removeItem('sspvp_pending_gh_device');
      const params = new URLSearchParams(window.location.search);
      const sess = (localStorage.getItem('sspvp_vault_session') || readSharedVaultCookie('sspvp_vault_session') || '').trim();
      if (sess && !params.get('user')) {
        const tokenUser = extractScreenNameFromSessionToken(sess);
        if (tokenUser && vaultUser.toLowerCase() === 'featured') {
          localStorage.setItem('sspvp_vault_user', tokenUser);
          localStorage.setItem('gbl_web_screen_name_v700', tokenUser);
          setVaultUser(tokenUser);
          setVaultInputUser(tokenUser);
          onChangeWebScreenName(tokenUser);
        } else if (!tokenUser) {
          fetch('https://api.silphscopepvp.com/v1/auth/login', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-SilphScope-Client-Key': 'ssk_client_v615_telemetry_ingest_9f8a7b6c5d4e3f2a1b0c',
              'X-Vault-Session': sess
            },
            body: JSON.stringify({
              sessionToken: sess
            })
          })
            .then((r) => r.json())
            .then((d) => {
              if (d && d.ok && d.screenName && d.screenName.toLowerCase() !== 'featured') {
                if (d.sessionToken) localStorage.setItem('sspvp_vault_session', d.sessionToken);
                localStorage.setItem('sspvp_vault_user', d.screenName);
                localStorage.setItem('gbl_web_screen_name_v700', d.screenName);
                writeSharedVaultCookies(d.screenName, d.sessionToken || sess);
                setIsVaultOwner(true);
                setVaultUser(d.screenName);
                setVaultInputUser(d.screenName);
                onChangeWebScreenName(d.screenName);
                onVaultSessionRestored?.(d.screenName, d.sessionToken || sess);
              }
            })
            .catch(() => {});
        }
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (activeSubpage === 'vault') {
      fetchVaultReplays(vaultUser);
    }
  }, [activeSubpage, vaultUser]);

  useEffect(() => {
    if (webScreenName && webScreenName.trim() && webScreenName.toLowerCase() !== 'featured') {
      if (vaultUser === 'Featured') {
        setVaultUser(webScreenName.trim());
        setVaultInputUser(webScreenName.trim());
      }
    }
  }, [webScreenName]);

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

  const mkBgRgb = hexToRgbTriplet(activeTheme.bgHex, '5, 8, 16');
  const mkCardRgb = hexToRgbTriplet(activeTheme.cardHex, '11, 21, 38');
  const mkCardAltRgb = hexToRgbTriplet(activeTheme.cardAltHex, '7, 13, 25');
  const mkAccentRgb = hexToRgbTriplet(activeTheme.accentHex, '56, 189, 248');
  const mkAccent2Rgb = hexToRgbTriplet(activeTheme.accentSecondaryHex, '250, 204, 21');

  return (
    <div
      className={`marketing-surface ${activeTheme.isLight ? 'mk-light' : 'mk-dark'} min-h-screen flex flex-col relative overflow-x-hidden transition-colors duration-200`}
      style={{
        ['--mk-bg' as any]: activeTheme.bgHex,
        ['--mk-card' as any]: activeTheme.cardHex,
        ['--mk-card-alt' as any]: activeTheme.cardAltHex,
        ['--mk-border' as any]: activeTheme.borderHex,
        ['--mk-accent' as any]: activeTheme.accentHex,
        ['--mk-accent2' as any]: activeTheme.accentSecondaryHex,
        ['--mk-text' as any]: activeTheme.textPrimaryHex,
        ['--mk-muted' as any]: activeTheme.textSecondaryHex,
        ['--mk-cta-text' as any]: activeTheme.ctaTextHex,
        ['--mk-cta2-text' as any]: activeTheme.ctaSecondaryTextHex,
        ['--mk-bg-rgb' as any]: mkBgRgb,
        ['--mk-card-rgb' as any]: mkCardRgb,
        ['--mk-card-alt-rgb' as any]: mkCardAltRgb,
        ['--mk-accent-rgb' as any]: mkAccentRgb,
        ['--mk-accent2-rgb' as any]: mkAccent2Rgb,
        backgroundColor: activeTheme.bgHex,
        color: activeTheme.textPrimaryHex,
        backgroundImage: `radial-gradient(circle at 12% 8%, rgba(${mkAccentRgb}, ${activeTheme.isLight ? '0.08' : '0.09'}) 0%, transparent 32%), radial-gradient(circle at 88% 36%, rgba(${mkAccent2Rgb}, ${activeTheme.isLight ? '0.06' : '0.06'}) 0%, transparent 28%), linear-gradient(180deg, ${activeTheme.bgHex} 0%, ${activeTheme.cardAltHex} 55%, ${activeTheme.bgHex} 100%)`
      }}
    >
      <style>{`
        .marketing-surface .bg-\\[\\#0E1B2E\\],
        .marketing-surface .bg-\\[\\#0E1B2E\\]\\/90,
        .marketing-surface .bg-\\[\\#0A1526\\],
        .marketing-surface .bg-\\[\\#0c1d33\\],
        .marketing-surface .bg-slate-900,
        .marketing-surface .bg-slate-900\\/90,
        .marketing-surface .bg-slate-900\\/80,
        .marketing-surface .bg-slate-900\\/40 {
          background-color: color-mix(in srgb, var(--mk-card) ${showThemeWatermark ? '78%' : '96%'}, transparent) !important;
          backdrop-filter: ${showThemeWatermark ? 'blur(2px)' : 'none'};
        }
        .marketing-surface .bg-\\[\\#081120\\],
        .marketing-surface .bg-\\[\\#081120\\]\\/90,
        .marketing-surface .bg-\\[\\#07101E\\],
        .marketing-surface .bg-\\[\\#071222\\],
        .marketing-surface .bg-\\[\\#091527\\],
        .marketing-surface .bg-slate-950:not(.mk-media-preserve *):not(.mk-media-preserve),
        .marketing-surface .bg-slate-950\\/90:not(.mk-media-preserve *),
        .marketing-surface .bg-slate-950\\/85:not(.fixed),
        .marketing-surface .bg-slate-950\\/60:not(.mk-media-preserve *) {
          background-color: color-mix(in srgb, var(--mk-card-alt) ${showThemeWatermark ? '76%' : '95%'}, transparent) !important;
        }
        .marketing-surface .bg-slate-800:not(.mk-media-preserve *),
        .marketing-surface .bg-slate-800\\/80:not(.mk-media-preserve *),
        .marketing-surface .bg-slate-800\\/70:not(.mk-media-preserve *),
        .marketing-surface .bg-slate-800\\/60:not(.mk-media-preserve *) {
          background-color: color-mix(in srgb, var(--mk-card-alt) 85%, var(--mk-accent2) 15%) !important;
          border-color: var(--mk-border) !important;
        }
        .marketing-surface .hover\\:bg-\\[\\#0E1B2E\\]:hover {
          background-color: var(--mk-card) !important;
        }
        .marketing-surface .border-\\[\\#19304E\\],
        .marketing-surface .border-slate-800,
        .marketing-surface .border-slate-800\\/80,
        .marketing-surface .border-slate-800\\/70,
        .marketing-surface .border-slate-800\\/60,
        .marketing-surface .border-slate-700,
        .marketing-surface .border-slate-700\\/80,
        .marketing-surface .border-slate-700\\/60 {
          border-color: var(--mk-border) !important;
        }
        .marketing-surface .bg-teal-400,
        .marketing-surface .bg-teal-500,
        .marketing-surface .bg-cyan-400,
        .marketing-surface .bg-cyan-500 {
          background-color: var(--mk-accent) !important;
          color: var(--mk-cta-text) !important;
          border-color: var(--mk-accent) !important;
        }
        .marketing-surface .hover\\:bg-teal-300:hover {
          background-color: var(--mk-accent) !important;
          filter: brightness(1.08);
        }
        .marketing-surface .text-teal-400:not(.mk-media-preserve *),
        .marketing-surface .text-teal-300:not(.mk-media-preserve *),
        .marketing-surface .text-teal-200:not(.mk-media-preserve *),
        .marketing-surface .text-cyan-300:not(.mk-media-preserve *),
        .marketing-surface .text-cyan-200:not(.mk-media-preserve *) {
          color: var(--mk-accent) !important;
        }
        .marketing-surface .text-teal-200\\/80:not(.mk-media-preserve *),
        .marketing-surface .text-cyan-200\\/80:not(.mk-media-preserve *) {
          color: var(--mk-muted) !important;
        }
        .marketing-surface .text-teal-100:not(.mk-media-preserve *) {
          color: var(--mk-text) !important;
        }
        .marketing-surface .hover\\:text-teal-300:hover:not(.mk-media-preserve *),
        .marketing-surface .hover\\:text-teal-200:hover:not(.mk-media-preserve *),
        .marketing-surface .hover\\:text-cyan-200:hover:not(.mk-media-preserve *) {
          color: var(--mk-accent) !important;
        }
        .marketing-surface .text-amber-300:not(.mk-media-preserve *),
        .marketing-surface .text-amber-200:not(.mk-media-preserve *) {
          color: var(--mk-accent2) !important;
        }
        .marketing-surface .border-teal-300,
        .marketing-surface .border-teal-400,
        .marketing-surface .border-teal-400\\/30,
        .marketing-surface .border-teal-400\\/40,
        .marketing-surface .border-teal-400\\/45,
        .marketing-surface .border-teal-400\\/50,
        .marketing-surface .border-teal-400\\/60,
        .marketing-surface .border-teal-500,
        .marketing-surface .border-teal-500\\/30,
        .marketing-surface .border-teal-500\\/40,
        .marketing-surface .border-cyan-400,
        .marketing-surface .border-cyan-400\\/40,
        .marketing-surface .border-cyan-400\\/50,
        .marketing-surface .border-cyan-500,
        .marketing-surface .border-cyan-500\\/35,
        .marketing-surface .border-cyan-500\\/40 {
          border-color: rgba(var(--mk-accent-rgb), 0.45) !important;
        }
        .marketing-surface .hover\\:border-teal-400:hover,
        .marketing-surface .hover\\:border-teal-400\\/50:hover,
        .marketing-surface .hover\\:border-teal-400\\/70:hover {
          border-color: rgba(var(--mk-accent-rgb), 0.78) !important;
        }
        .marketing-surface .ring-teal-400\\/50 {
          --tw-ring-color: rgba(var(--mk-accent-rgb), 0.5) !important;
        }
        .marketing-surface .bg-teal-950,
        .marketing-surface .bg-teal-950\\/40,
        .marketing-surface .bg-cyan-950,
        .marketing-surface .bg-cyan-950\\/40,
        .marketing-surface .bg-teal-400\\/10,
        .marketing-surface .bg-teal-400\\/15,
        .marketing-surface .bg-teal-400\\/20,
        .marketing-surface .bg-teal-500\\/15,
        .marketing-surface .bg-teal-500\\/20,
        .marketing-surface .bg-cyan-400\\/10,
        .marketing-surface .bg-cyan-400\\/15,
        .marketing-surface .bg-cyan-500\\/15,
        .marketing-surface .bg-cyan-500\\/20 {
          background-color: rgba(var(--mk-accent-rgb), 0.14) !important;
        }
        .marketing-surface .hover\\:bg-teal-400\\/10:hover,
        .marketing-surface .hover\\:bg-teal-400\\/25:hover,
        .marketing-surface .hover\\:bg-teal-400\\/30:hover,
        .marketing-surface .hover\\:bg-teal-500\\/25:hover,
        .marketing-surface .hover\\:bg-teal-500\\/30:hover,
        .marketing-surface .hover\\:bg-teal-900\\/50:hover,
        .marketing-surface .hover\\:bg-cyan-900\\/50:hover {
          background-color: rgba(var(--mk-accent-rgb), 0.24) !important;
        }
        .marketing-surface .bg-amber-400\\/15,
        .marketing-surface .bg-amber-400\\/20,
        .marketing-surface .bg-amber-500\\/20 {
          background-color: rgba(var(--mk-accent2-rgb), 0.15) !important;
        }
        .marketing-surface.mk-light .text-white:not(.mk-media-preserve *):not(.bg-teal-400):not(.bg-cyan-400):not(.bg-indigo-600):not(.bg-purple-600):not(.bg-rose-600),
        .marketing-surface.mk-light .text-slate-100:not(.mk-media-preserve *),
        .marketing-surface.mk-light .text-slate-200:not(.mk-media-preserve *),
        .marketing-surface.mk-light .text-teal-100:not(.mk-media-preserve *) {
          color: var(--mk-text) !important;
        }
        .marketing-surface.mk-light .text-slate-300:not(.mk-media-preserve *),
        .marketing-surface.mk-light .text-slate-400:not(.mk-media-preserve *),
        .marketing-surface.mk-light .text-slate-500:not(.mk-media-preserve *) {
          color: var(--mk-muted) !important;
        }
        .marketing-surface.mk-light .text-emerald-300:not(.mk-media-preserve *),
        .marketing-surface.mk-light .text-emerald-200:not(.mk-media-preserve *) {
          color: #047857 !important;
        }
        .marketing-surface.mk-light .text-rose-300:not(.mk-media-preserve *),
        .marketing-surface.mk-light .text-rose-400:not(.mk-media-preserve *),
        .marketing-surface.mk-light .text-rose-200:not(.mk-media-preserve *) {
          color: #BE123C !important;
        }
        .marketing-surface.mk-light .bg-rose-950\\/40,
        .marketing-surface.mk-light .bg-rose-950\\/60 {
          background-color: #FFE4E6 !important;
        }
        .marketing-surface.mk-light input,
        .marketing-surface.mk-light select {
          background-color: var(--mk-card-alt) !important;
          color: var(--mk-text) !important;
          border-color: var(--mk-border) !important;
        }
        .marketing-surface.mk-light .bg-amber-400 {
          color: #050810 !important;
        }
        .marketing-surface.mk-light .mk-media-preserve .text-white {
          color: #FFFFFF !important;
        }
        .marketing-surface.mk-light .mk-media-preserve .text-slate-300,
        .marketing-surface.mk-light .mk-media-preserve .text-slate-400 {
          color: #CBD5E1 !important;
        }
        .marketing-surface.mk-light .mk-media-preserve .text-teal-300 {
          color: #38BDF8 !important;
        }
        .marketing-surface.mk-light .mk-media-preserve .text-amber-300 {
          color: #FDE047 !important;
        }
      `}</style>

      {/* Fixed Centered Transparent-HUD Watermark (default Duel Scope constellation for visitors; synced theme for signed-in users) */}
      {showThemeWatermark && (
        <div
          className="fixed inset-0 pointer-events-none flex items-center justify-center z-0 overflow-hidden"
          style={{ opacity: activeTheme.watermarkAlpha }}
          aria-hidden="true"
        >
          {renderThemeWatermarkSvg(activeTheme.id, 'w-[500px] h-[500px] max-w-[90vw] max-h-[90vh]')}
        </div>
      )}

      {/* Top Sticky Navigation Bar */}
      <header
        className="sticky top-0 z-50 backdrop-blur-xl border-b"
        style={{
          backgroundColor: `rgba(${mkBgRgb}, 0.88)`,
          borderColor: activeTheme.borderHex
        }}
      >
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          {/* Brand Logo */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => onSelectSubpage('vault')}
              className="flex items-center gap-2.5 text-left group cursor-pointer"
            >
              <img
                src={`${import.meta.env.BASE_URL}favicon.svg`}
                alt="SilphScope PvP Icon"
                className="w-10 h-10 rounded-xl shadow-lg border border-sky-400/45 transition-transform group-hover:scale-105"
              />
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-black text-base sm:text-lg tracking-tight" style={{ color: activeTheme.textPrimaryHex }}>
                    SilphScope <span style={{ color: activeTheme.accentHex }}>{activeSubpage === 'vault' ? 'DVR' : 'PvP'}</span>
                  </span>
                  <span
                    className="text-[10px] font-mono font-extrabold uppercase px-2 py-0.5 rounded-full border"
                    style={{
                      color: activeTheme.accentSecondaryHex,
                      borderColor: `rgba(${mkAccent2Rgb}, 0.45)`,
                      backgroundColor: `rgba(${mkAccent2Rgb}, 0.12)`
                    }}
                  >
                    v7.91 • Latest Release
                  </span>
                </div>
                <p className="text-[11px] hidden sm:block" style={{ color: activeTheme.textSecondaryHex }}>
                  {activeSubpage === 'vault'
                    ? 'Cloud Replay Vault • Frame-Synced Video & HUD Overlay'
                    : 'Automated Battle DVR & Auto-Logger • ELO Anti-Meta Builder • Optional Compact HUD'}
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
                  backgroundColor: 'var(--mk-accent)',
                  color: 'var(--mk-cta-text)',
                  boxShadow: '0 0 14px rgba(var(--mk-accent-rgb), 0.3)'
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
                style={{ backgroundColor: 'var(--mk-card-alt)', borderColor: 'var(--mk-border)' }}
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
                  📖 Field Manual &amp; Modes
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
                    backgroundColor: 'rgba(var(--mk-card-rgb), 0.95)',
                    borderColor: 'var(--mk-accent)',
                    color: 'var(--mk-accent)'
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
                    backgroundColor: 'var(--mk-accent)',
                    color: 'var(--mk-cta-text)',
                    boxShadow: '0 0 16px rgba(var(--mk-accent-rgb), 0.35)'
                  }}
                >
                  <span>📱 Download APK</span>
                </a>
                <button
                  type="button"
                  onClick={onOpenMembershipModal}
                  className="px-3 py-1.5 rounded-xl font-black text-xs border transition flex items-center gap-1.5 cursor-pointer hover:brightness-110"
                  style={{
                    backgroundColor: 'rgba(var(--mk-accent2-rgb), 0.16)',
                    borderColor: 'var(--mk-accent2)',
                    color: 'var(--mk-accent2)'
                  }}
                >
                  <span>
                    {webMembershipTier === 'vip'
                      ? '👑 VIP Active'
                      : webMembershipTier === 'pro'
                      ? '🏆 Pro Active'
                      : webMembershipTier === 'supporter'
                      ? '🏅 Supporter'
                      : webMembershipTier === 'comp'
                      ? '🎁 Comp DVR'
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
          {/* 1. HERO SECTION: DVR & Auto-Logging First + Right Browser Replay Theater Phone */}
          <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
            {/* Left 7 Columns */}
            <div className="lg:col-span-7 space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-extrabold flex-wrap"
                style={{
                  backgroundColor: 'rgba(var(--mk-accent-rgb), 0.10)',
                  borderColor: 'rgba(var(--mk-accent-rgb), 0.45)',
                  color: 'var(--mk-accent)'
                }}
              >
                <span>🎬 FRAME-SYNCED BATTLE DVR</span>
                <span className="text-slate-500">•</span>
                <span style={{ color: 'var(--mk-accent2)' }}>📊 ZERO-TYPING AUTO-LOGGER</span>
                <span className="text-slate-500">•</span>
                <span className="text-emerald-300">🔕 LOG-ONLY STEALTH MODE</span>
              </div>

              <h1 className="text-3xl sm:text-5xl font-black tracking-tight leading-[1.12] text-white">
                Record, Auto-Log &amp; Review Every GBL Battle with{' '}
                <span
                  className="bg-clip-text text-transparent"
                  style={{
                    backgroundImage: 'linear-gradient(90deg, var(--mk-accent) 0%, var(--mk-text) 48%, var(--mk-accent2) 100%)'
                  }}
                >
                  Frame-Synced Replay Math.
                </span>
              </h1>

              <p className="text-sm sm:text-base leading-relaxed text-slate-300 max-w-2xl">
                SilphScope PvP pairs <strong className="text-teal-300">hardware Battle DVR + JSONL frame traces</strong> with zero-typing 3v3 battle logging (including <strong className="text-amber-300">free 1-click GOBattleLog export</strong>). Play cleanly with zero HUD on screen in <strong className="text-emerald-300">Log-Only Stealth Mode</strong>, scrub energy and IV calls afterward in the browser Replay Theater, build <strong className="text-amber-300">ELO-adaptive Anti-Meta teams</strong>, or enable the optional Compact move-count reference when practicing.
              </p>

              {/* Prominent 4-Banner Action Stack (1. DVR -> 2. APK -> 3. ELO Anti-Meta -> 4. Guide & Modes) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => onSelectSubpage('vault')}
                  className="p-3.5 rounded-2xl font-black text-sm flex items-center justify-between border shadow-xl transition hover:scale-[1.01] cursor-pointer text-left"
                  style={{
                    background: 'linear-gradient(135deg, var(--mk-accent) 0%, color-mix(in srgb, var(--mk-accent) 82%, var(--mk-bg) 18%) 100%)',
                    borderColor: 'var(--mk-accent)',
                    color: 'var(--mk-cta-text)',
                    boxShadow: '0 8px 25px rgba(var(--mk-accent-rgb), 0.28)'
                  }}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">🎬</span>
                    <div className="text-left">
                      <div className="text-sm font-black leading-tight">Cloud DVR Replay Vault</div>
                      <div className="text-[11px] font-bold opacity-85">
                        Watch @Featured Battles &amp; Scrub Synced Traces
                      </div>
                    </div>
                  </div>
                  <span className="text-lg font-black">→</span>
                </button>

                <a
                  href="https://dl.silphscopepvp.com"
                  className="p-3.5 rounded-2xl font-black text-sm flex items-center justify-between border shadow-xl transition hover:scale-[1.01]"
                  style={{
                    backgroundColor: 'var(--mk-card)',
                    borderColor: 'var(--mk-accent)',
                    color: 'var(--mk-text)'
                  }}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">📱</span>
                    <div className="text-left">
                      <div className="text-sm font-black leading-tight" style={{ color: 'var(--mk-accent)' }}>
                        Download Android APK
                      </div>
                      <div className="text-[11px] font-medium text-slate-300">
                        Instant 1-Click Direct Release (v7.91)
                      </div>
                    </div>
                  </div>
                  <span className="text-teal-300">↓</span>
                </a>

                <button
                  type="button"
                  onClick={() => onLaunchWebApp('presets')}
                  className="p-3.5 rounded-2xl font-black text-sm flex items-center justify-between border shadow-xl transition hover:scale-[1.01] cursor-pointer text-left"
                  style={{
                    backgroundColor: 'var(--mk-card)',
                    borderColor: 'var(--mk-accent2)',
                    color: 'var(--mk-text)'
                  }}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">🧬</span>
                    <div>
                      <div className="text-sm font-black leading-tight" style={{ color: 'var(--mk-accent2)' }}>
                        ELO Anti-Meta Builder &amp; Web Sim
                      </div>
                      <div className="text-[11px] font-medium text-slate-300">
                        iOS &amp; Desktop Friendly • Fuse Logs + PvPoke
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
                    backgroundColor: 'var(--mk-card-alt)',
                    borderColor: 'var(--mk-border)',
                    color: 'var(--mk-text)'
                  }}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">📖</span>
                    <div>
                      <div className="text-sm font-black leading-tight text-cyan-300">
                        Field Manual &amp; 3 Modes
                      </div>
                      <div className="text-[11px] font-medium text-slate-300">
                        Log-Only Stealth, Compact Default &amp; Replay Controls
                      </div>
                    </div>
                  </div>
                  <span className="text-cyan-300">→</span>
                </button>
              </div>

              {/* Key Telemetry Pill Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2">
                {[
                  { k: 'Log-Only', v: 'Zero-HUD Stealth Recording', c: activeTheme.isLight ? '#047857' : '#34D399' },
                  { k: 'Auto-Log', v: 'Free 1-Click GOBattleLog Export', c: 'var(--mk-accent)' },
                  { k: 'ELO Meta', v: 'Personal + PvPoke Anti-Meta', c: 'var(--mk-accent2)' },
                  { k: 'Web + iOS', v: 'Browser DVR & 3v3 Simulator', c: 'var(--mk-accent)' }
                ].map((stat) => (
                  <div
                    key={stat.k}
                    className="p-2.5 rounded-xl border"
                    style={{ backgroundColor: 'rgba(var(--mk-card-rgb), 0.65)', borderColor: 'var(--mk-border)' }}
                  >
                    <div className="text-sm font-black font-mono" style={{ color: stat.c }}>
                      {stat.k}
                    </div>
                    <div className="text-[11px] text-slate-300 font-semibold">{stat.v}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right 5 Columns: Straight-On Vertical (Portrait) Phone Frame showcasing Browser Replay Theater */}
            <div className="lg:col-span-5 flex flex-col items-center">
              <div
                className="relative w-full max-w-[340px] rounded-[34px] p-2.5 border-4 shadow-2xl"
                style={{
                  backgroundColor: 'var(--mk-card-alt)',
                  borderColor: 'var(--mk-accent)',
                  boxShadow: '0 0 40px rgba(var(--mk-accent-rgb), 0.22), 0 0 80px rgba(var(--mk-accent2-rgb), 0.10)'
                }}
              >
                <div className="mk-media-preserve relative rounded-[24px] overflow-hidden border border-teal-400/30 bg-slate-950">
                  {heroShowStaticPoster ? (
                    <img
                      src={`${import.meta.env.BASE_URL}${activeHero.posterPath}`}
                      alt={activeHero.label}
                      className="w-full h-auto block"
                    />
                  ) : (
                    <video
                      key={activeHero.videoPath}
                      src={`${import.meta.env.BASE_URL}${activeHero.videoPath}`}
                      poster={`${import.meta.env.BASE_URL}${activeHero.posterPath}`}
                      autoPlay
                      loop
                      muted
                      playsInline
                      className="w-full h-auto block"
                    />
                  )}
                  {/* Floating Bottom Replay Theater Pill */}
                  <div className="absolute bottom-3 inset-x-3 flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-950/90 backdrop-blur-md border border-teal-400/50 shadow-lg">
                    <a
                      href={activeHero.highlightUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-black text-teal-300 hover:text-teal-200 flex items-center gap-1.5"
                    >
                      <span>▶️ Open Interactive Replay Theater</span>
                    </a>
                    <button
                      type="button"
                      onClick={() => setHeroShowStaticPoster(!heroShowStaticPoster)}
                      className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] font-mono font-bold text-amber-300 border border-amber-400/40 cursor-pointer"
                      title="Toggle between 2x Retina Video and High-Res Still Frame"
                    >
                      {heroShowStaticPoster ? '🎬 Play 2x HD' : '📸 Still 2x Hi-Res'}
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
                  style={{ backgroundColor: 'rgba(var(--mk-card-rgb), 0.75)', borderColor: 'var(--mk-border)' }}
                >
                  <div className="font-extrabold text-amber-300">{activeHero.label}</div>
                  <p className="text-[11.5px] text-slate-300 leading-snug">{activeHero.caption}</p>
                </div>
              </div>
            </div>
          </section>

          {/* 2A. FEATURED BATTLES SHOWCASE (@Featured • Interactive Browser Replay Theater) */}
          <section
            className="rounded-3xl p-6 sm:p-8 border space-y-6"
            style={{ backgroundColor: 'var(--mk-card)', borderColor: 'var(--mk-border)' }}
          >
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider" style={{ color: 'var(--mk-accent2)' }}>
                  <span>🎬 Interactive Browser Replay Theater (@Featured Vault)</span>
                  <span>•</span>
                  <span className="text-teal-300">Post-Match VOD Review on Desktop, iOS &amp; Android</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-black text-white mt-1">
                  Scrub Every Turn, Energy Count &amp; Breakpoint After the Match
                </h2>
                <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-3xl">
                  Every battle below pairs hardware H.264 DVR video with a synchronized <code className="text-teal-300">_deep_trace.jsonl</code> telemetry stream in our persistent <code className="text-teal-300">@Featured</code> vault. Click any card to inspect the replay from <code className="text-amber-300">0:00</code> in your browser — toggling Full HUD, Compact HUD, or clean unassisted video on and off at any turn.
                </p>
              </div>
              <a
                href="https://dvr.silphscopepvp.com/?user=Featured"
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2.5 rounded-xl font-extrabold text-xs border shrink-0 transition hover:brightness-110"
                style={{
                  backgroundColor: 'rgba(var(--mk-accent2-rgb), 0.15)',
                  borderColor: 'var(--mk-accent2)',
                  color: 'var(--mk-accent2)'
                }}
              >
                🎬 Open Full @Featured Vault ↗
              </a>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Featured Battle Card 1: Ultra League 3D Shadow Aura & D-3 Stage Math */}
              <div
                className="rounded-2xl border overflow-hidden flex flex-col justify-between transition hover:border-teal-400/70"
                style={{ backgroundColor: 'var(--mk-card-alt)', borderColor: 'var(--mk-border)' }}
              >
                <div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedWatchSeekSec(0);
                      setSelectedWatchReplay(CANONICAL_FEATURED_REPLAYS.find(r => r.shareId === 'f_ul_aura_nidoking') || CANONICAL_FEATURED_REPLAYS[0]);
                    }}
                    className="block relative group overflow-hidden bg-slate-950 w-full text-left cursor-pointer"
                    title="Click to inspect full battle in the Interactive Browser Replay Theater"
                  >
                    <video
                      src={`${import.meta.env.BASE_URL}screenshots/featured_ul_aura_nidoking.mp4`}
                      poster={`${import.meta.env.BASE_URL}screenshots/featured_ul_aura_nidoking_poster.png`}
                      autoPlay
                      loop
                      muted
                      playsInline
                      className="w-full h-[460px] object-cover object-top transition duration-300 group-hover:scale-[1.02]"
                    />
                    <div className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-full bg-slate-950/90 border border-teal-400/60 text-[10.5px] font-extrabold text-teal-300">
                      @Featured • 🌟 Replay Trace
                    </div>
                    <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent flex items-center justify-between">
                      <span className="px-2.5 py-1 rounded-lg bg-teal-400 text-slate-950 font-black text-xs shadow">
                        ▶️ Inspect Replay (0:00)
                      </span>
                      <span className="text-[11px] font-mono font-bold text-amber-300">
                        WIN • Ultra League
                      </span>
                    </div>
                  </button>

                  <div className="p-4 space-y-2">
                    <h3 className="font-black text-base text-white">
                      1. 3D Shadow Aura &amp; Observed-CP IV Trace (<code className="text-rose-300">D-3</code>)
                    </h3>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      <strong>Melmetal, Mimikyu &amp; Galarian Moltres</strong> vs. <strong>Shadow Nidoking, Clefable &amp; Kommo-o</strong>. Post-match trace confirms <code className="text-purple-300">Shadow: 🟣 ON ✓</code> at 0:04 via 3D HSV aura + dual <code className="text-teal-300">AURA+DHP</code>, narrows Observed-CP IVs (<code className="text-amber-300">0/14/11</code>), and logs <code className="text-rose-300">Def -3</code> Sand Tomb + Disguise Bust.
                    </p>
                  </div>
                </div>

                <div className="px-4 pb-4 pt-2 border-t border-slate-800/80 flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedWatchSeekSec(0);
                      setSelectedWatchReplay(CANONICAL_FEATURED_REPLAYS.find(r => r.shareId === 'f_ul_aura_nidoking') || CANONICAL_FEATURED_REPLAYS[0]);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-teal-300 font-bold text-[11px] border border-teal-400/30 cursor-pointer"
                  >
                    ▶️ Start (0:00)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedWatchSeekSec(5);
                      setSelectedWatchReplay(CANONICAL_FEATURED_REPLAYS.find(r => r.shareId === 'f_ul_aura_nidoking') || CANONICAL_FEATURED_REPLAYS[0]);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-extrabold text-[11px] border border-amber-400/50 cursor-pointer"
                  >
                    🟣 Jump to 3D Aura Lock (0:05)
                  </button>
                </div>
              </div>

              {/* Featured Battle Card 2: Ultra League ⚡BP+1 Breakpoint & Shadow: N/A Trace */}
              <div
                className="rounded-2xl border overflow-hidden flex flex-col justify-between transition hover:border-teal-400/70"
                style={{ backgroundColor: 'var(--mk-card-alt)', borderColor: 'var(--mk-border)' }}
              >
                <div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedWatchSeekSec(0);
                      setSelectedWatchReplay(CANONICAL_FEATURED_REPLAYS.find(r => r.shareId === 'f_ul_bp_skeledirge') || CANONICAL_FEATURED_REPLAYS[1]);
                    }}
                    className="block relative group overflow-hidden bg-slate-950 w-full text-left cursor-pointer"
                    title="Click to inspect full battle in the Interactive Browser Replay Theater"
                  >
                    <video
                      src={`${import.meta.env.BASE_URL}screenshots/featured_ul_bp_skeledirge.mp4`}
                      poster={`${import.meta.env.BASE_URL}screenshots/featured_ul_bp_skeledirge_poster.png`}
                      autoPlay
                      loop
                      muted
                      playsInline
                      className="w-full h-[460px] object-cover object-top transition duration-300 group-hover:scale-[1.02]"
                    />
                    <div className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-full bg-slate-950/90 border border-teal-400/60 text-[10.5px] font-extrabold text-teal-300">
                      @Featured • 🌟 Replay Trace
                    </div>
                    <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent flex items-center justify-between">
                      <span className="px-2.5 py-1 rounded-lg bg-teal-400 text-slate-950 font-black text-xs shadow">
                        ▶️ Inspect Replay (0:00)
                      </span>
                      <span className="text-[11px] font-mono font-bold text-amber-300">
                        WIN • Ultra League
                      </span>
                    </div>
                  </button>

                  <div className="p-4 space-y-2">
                    <h3 className="font-black text-base text-white">
                      2. Offline <code className="text-emerald-300">⚡BP+1</code> Breakpoint &amp; <code className="text-slate-300">Shadow: N/A</code> Lock
                    </h3>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      <strong>Melmetal, Mimikyu &amp; Galarian Moltres</strong> vs. <strong>Tinkaton, Skeledirge &amp; Goodra</strong>. Replay telemetry reconstructs Skeledirge&apos;s Observed-CP IV spread (<code className="text-amber-300">0/13/12</code>) to flag <code className="text-emerald-300">⚡BP+1</code> breakpoints while keeping unreleased Shadows locked to <code className="text-slate-200">Shadow: N/A</code>.
                    </p>
                  </div>
                </div>

                <div className="px-4 pb-4 pt-2 border-t border-slate-800/80 flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedWatchSeekSec(0);
                      setSelectedWatchReplay(CANONICAL_FEATURED_REPLAYS.find(r => r.shareId === 'f_ul_bp_skeledirge') || CANONICAL_FEATURED_REPLAYS[1]);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-teal-300 font-bold text-[11px] border border-teal-400/30 cursor-pointer"
                  >
                    ▶️ Start (0:00)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedWatchSeekSec(27);
                      setSelectedWatchReplay(CANONICAL_FEATURED_REPLAYS.find(r => r.shareId === 'f_ul_bp_skeledirge') || CANONICAL_FEATURED_REPLAYS[1]);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-teal-500/20 hover:bg-teal-500/30 text-teal-200 font-extrabold text-[11px] border border-teal-400/50 cursor-pointer"
                  >
                    🛑 0F Catch (0:27)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedWatchSeekSec(134);
                      setSelectedWatchReplay(CANONICAL_FEATURED_REPLAYS.find(r => r.shareId === 'f_ul_bp_skeledirge') || CANONICAL_FEATURED_REPLAYS[1]);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-extrabold text-[11px] border border-amber-400/50 cursor-pointer"
                  >
                    ⚡ Breakpoint Review (2:14)
                  </button>
                </div>
              </div>

              {/* Featured Battle Card 3: Ultra League Disguise Sync, Non-Shadow Proof & 0F Catch */}
              <div
                className="rounded-2xl border overflow-hidden flex flex-col justify-between transition hover:border-teal-400/70"
                style={{ backgroundColor: 'var(--mk-card-alt)', borderColor: 'var(--mk-border)' }}
              >
                <div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedWatchSeekSec(0);
                      setSelectedWatchReplay(CANONICAL_FEATURED_REPLAYS.find(r => r.shareId === 'f_ul_catch_cobalion') || CANONICAL_FEATURED_REPLAYS[2]);
                    }}
                    className="block relative group overflow-hidden bg-slate-950 w-full text-left cursor-pointer"
                    title="Click to inspect full battle in the Interactive Browser Replay Theater"
                  >
                    <video
                      src={`${import.meta.env.BASE_URL}screenshots/featured_ul_catch_cobalion.mp4`}
                      poster={`${import.meta.env.BASE_URL}screenshots/featured_ul_catch_cobalion_poster.png`}
                      autoPlay
                      loop
                      muted
                      playsInline
                      className="w-full h-[460px] object-cover object-top transition duration-300 group-hover:scale-[1.02]"
                    />
                    <div className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-full bg-slate-950/90 border border-teal-400/60 text-[10.5px] font-extrabold text-teal-300">
                      @Featured • 🌟 Replay Trace
                    </div>
                    <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent flex items-center justify-between">
                      <span className="px-2.5 py-1 rounded-lg bg-teal-400 text-slate-950 font-black text-xs shadow">
                        ▶️ Inspect Replay (0:00)
                      </span>
                      <span className="text-[11px] font-mono font-bold text-amber-300">
                        WIN • Ultra League
                      </span>
                    </div>
                  </button>

                  <div className="p-4 space-y-2">
                    <h3 className="font-black text-base text-white">
                      3. Disguise Sync, Non-Shadow Proof &amp; Endgame Catch
                    </h3>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      <strong>Tinkaton, Mimikyu &amp; Swampert</strong> vs. <strong>Drifblim, Galarian Weezing &amp; Cobalion</strong>. Replay log verifies Drifblim as <code className="text-teal-300">Shadow: OFF ✓</code> without Ghost VFX bleed, syncs <code className="text-rose-300">A-2 👹D-1</code> cleanly, and timestamps a <code className="text-amber-300">0F</code> Swap-Catch onto Swampert.
                    </p>
                  </div>
                </div>

                <div className="px-4 pb-4 pt-2 border-t border-slate-800/80 flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedWatchSeekSec(0);
                      setSelectedWatchReplay(CANONICAL_FEATURED_REPLAYS.find(r => r.shareId === 'f_ul_catch_cobalion') || CANONICAL_FEATURED_REPLAYS[2]);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-teal-300 font-bold text-[11px] border border-teal-400/30 cursor-pointer"
                  >
                    ▶️ Start (0:00)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedWatchSeekSec(79);
                      setSelectedWatchReplay(CANONICAL_FEATURED_REPLAYS.find(r => r.shareId === 'f_ul_catch_cobalion') || CANONICAL_FEATURED_REPLAYS[2]);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-extrabold text-[11px] border border-amber-400/50 cursor-pointer"
                  >
                    🎭 A-2/D-1 Sync (1:19)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedWatchSeekSec(105);
                      setSelectedWatchReplay(CANONICAL_FEATURED_REPLAYS.find(r => r.shareId === 'f_ul_catch_cobalion') || CANONICAL_FEATURED_REPLAYS[2]);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-teal-500/20 hover:bg-teal-500/30 text-teal-200 font-extrabold text-[11px] border border-teal-400/50 cursor-pointer"
                  >
                    🛑 0F Catch (1:45)
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* 2B. LOG-ONLY STEALTH MODE & READ-ONLY SCREEN-CAPTURE ARCHITECTURE */}
          <section
            className="rounded-3xl p-6 sm:p-8 border space-y-6"
            style={{
              background: 'linear-gradient(135deg, rgba(6, 78, 59, 0.35) 0%, rgba(7, 16, 30, 0.96) 55%, rgba(var(--mk-card-rgb), 0.96) 100%)',
              borderColor: 'rgba(16, 185, 129, 0.45)',
              boxShadow: '0 10px 35px rgba(16, 185, 129, 0.10)'
            }}
          >
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="space-y-2 max-w-3xl">
                <div className="flex flex-wrap items-center gap-2 text-xs font-black uppercase tracking-wider text-emerald-300">
                  <span>🔕 Play! Pokémon &amp; Show 6 Tournament Friendly</span>
                  <span className="text-slate-500">•</span>
                  <span className="text-teal-300">Poke Genie &amp; Calcy IV Capture API</span>
                  <span className="text-slate-500">•</span>
                  <span className="text-amber-300">100% Free Across All Tiers</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-black text-white">
                  Read-Only Screen Capture &amp; Zero-HUD Stealth Architecture
                </h2>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                  Want pure, unassisted matches while still automating your battle logs and VOD archives? Press and hold the corner emblem for <strong>2.0 seconds</strong> to activate <strong>Log-Only Stealth Mode</strong>: every floating view is removed (<code className="text-emerald-300 font-mono">View.GONE</code>), haptics are silenced, and background vision quietly records a clean H.264 video + <code className="text-teal-300 font-mono">_deep_trace.jsonl</code> stream so you can tap <code className="text-white font-mono bg-slate-900/80 px-1.5 py-0.5 rounded">📊 Battle Log</code> after the match to review mistakes.
                </p>
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-1 text-[11.5px] text-emerald-200/90 font-medium">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0"></span>
                    <span><strong>2.0s Press-and-Hold:</strong> Toggles Log-Only Stealth Mode (zero HUD, zero haptics)</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-teal-400 shrink-0"></span>
                    <span><strong>Single-Tap Emblem:</strong> Strictly alternates <code className="text-white font-mono bg-slate-900/80 px-1 py-0.5 rounded">Full HUD ↔ Compact HUD</code></span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0"></span>
                    <span><strong>Post-Battle Summary:</strong> 1-Tap <code className="text-white font-mono bg-slate-900/80 px-1 py-0.5 rounded">📊 Battle Log</code> &amp; Cloud DVR upload</span>
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap lg:flex-col items-stretch sm:items-center lg:items-stretch gap-2 shrink-0">
                <a
                  href="https://dl.silphscopepvp.com"
                  className="px-4 py-2.5 rounded-xl font-black text-xs transition flex items-center justify-center gap-1.5 shadow-md hover:brightness-110"
                  style={{ backgroundColor: 'var(--mk-accent)', color: 'var(--mk-cta-text)' }}
                >
                  <span>📱</span>
                  <span>Download APK (v7.91)</span>
                </a>
                <button
                  type="button"
                  onClick={() => onLaunchWebApp('presets')}
                  className="px-4 py-2.5 rounded-xl font-black text-xs border border-amber-400/50 text-amber-300 bg-amber-400/10 hover:bg-amber-400/20 transition cursor-pointer"
                >
                  🌐 Try Web Demo First
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 rounded-2xl border bg-[#0E1B2E]/90 border-[#19304E] space-y-2">
                <div className="w-9 h-9 rounded-xl bg-teal-400/15 border border-teal-400/40 text-teal-300 text-lg flex items-center justify-center">
                  🛡️
                </div>
                <h3 className="font-black text-sm text-white">Zero Game Injection</h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Never touches Pokémon GO&apos;s APK, memory, or network traffic. Runs strictly as an external Android recorder &amp; analyzer without inspecting game packets.
                </p>
              </div>

              <div className="p-4 rounded-2xl border bg-[#0E1B2E]/90 border-[#19304E] space-y-2">
                <div className="w-9 h-9 rounded-xl bg-teal-400/15 border border-teal-400/40 text-teal-300 text-lg flex items-center justify-center">
                  👁️
                </div>
                <h3 className="font-black text-sm text-white">Passive Screen Pixels Only</h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Uses standard Android <code className="text-teal-300">MediaProjection</code> read-only pixels — the exact same OS capture permission used by Poke Genie and Calcy IV since 2016.
                </p>
              </div>

              <div className="p-4 rounded-2xl border bg-[#0E1B2E]/90 border-[#19304E] space-y-2">
                <div className="w-9 h-9 rounded-xl bg-emerald-400/15 border border-emerald-400/40 text-emerald-300 text-lg flex items-center justify-center">
                  🚫
                </div>
                <h3 className="font-black text-sm text-white">Zero Automation or Inputs</h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  No macros, no automated taps, and no GPS spoofing. In Stealth Mode it is completely invisible (<code className="text-emerald-300 font-mono">View.GONE</code>) for pure unassisted battles and VOD logging.
                </p>
              </div>

              <div className="p-4 rounded-2xl border bg-[#0E1B2E]/90 border-[#19304E] space-y-2">
                <div className="w-9 h-9 rounded-xl bg-cyan-400/15 border border-cyan-400/40 text-cyan-300 text-lg flex items-center justify-center">
                  🌐
                </div>
                <h3 className="font-black text-sm text-white">Zero-Install Web &amp; iOS</h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  On iPhone or desktop? Open the interactive Browser Replay Vault, 3v3 Simulator, and ELO Anti-Meta Team Builder in Safari or Chrome with zero downloads.
                </p>
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
                <span style={{ color: 'var(--mk-accent)' }}>Your Current ELO.</span>
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Static ranking sites assume you face all Top-100 Pokémon equally. In reality, a 2150 ELO pocket looks completely different from a 2750 Legend push. SilphScope PvP automatically records every opponent team you face and applies an <strong className="text-teal-300">exponential recency decay (<code className="font-mono">λ = 0.04</code>)</strong> to fuse your personal battle logs (up to 70% weight) with PvPoke&apos;s baseline ratings.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div
                  className="p-3.5 rounded-2xl border"
                  style={{ backgroundColor: 'var(--mk-card)', borderColor: 'var(--mk-border)' }}
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
                  style={{ backgroundColor: 'rgba(var(--mk-accent2-rgb), 0.07)', borderColor: 'rgba(var(--mk-accent2-rgb), 0.4)' }}
                >
                  <div className="font-black text-xs text-amber-300 mb-1">
                    🚀 Growing Userbase: 3-Way Meta Fusion
                  </div>
                  <p className="text-[11.5px] text-slate-300 leading-snug">
                    As community telemetry expands, blend <strong>1. Your Personal ELO Logs</strong> + <strong>2. Live Community Crowd Meta</strong> + <strong>3. PvPoke Theoretical Ratings</strong> with customizable sliders.
                  </p>
                </div>
              </div>

              {/* Hybrid Backline Probability Engine Callout */}
              <div
                className="p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                style={{ backgroundColor: 'var(--mk-card-alt)', borderColor: 'var(--mk-accent)' }}
              >
                <div className="space-y-0.5">
                  <div className="text-xs font-black text-teal-300">
                    🔮 Hybrid Backline Probability Engine — Free in Open Leagues!
                  </div>
                  <p className="text-[11.5px] text-slate-300">
                    Estimates likely unrevealed 2nd &amp; 3rd Pokémon from your ELO battle logs + crowd meta for post-match replay study and optional reference views in Great, Ultra &amp; Master League. Supporter &amp; Pro unlock Limited Cups and the Deep Pair Explorer.
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
                style={{ borderColor: 'var(--mk-accent)', boxShadow: '0 0 35px rgba(var(--mk-accent-rgb), 0.18)' }}
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
                style={{ backgroundColor: 'var(--mk-card)', borderColor: 'var(--mk-border)' }}
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
                style={{ backgroundColor: 'var(--mk-card)', borderColor: 'var(--mk-border)' }}
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

          {/* 4. OPTIONAL REAL-TIME TACTICAL DATA: 3 MODES, YOUR CHOICE */}
          <section
            className="rounded-3xl p-6 sm:p-8 border space-y-6"
            style={{
              background: 'linear-gradient(135deg, rgba(var(--mk-card-rgb), 0.96) 0%, rgba(7, 16, 30, 0.98) 100%)',
              borderColor: 'rgba(var(--mk-accent-rgb), 0.35)',
              boxShadow: '0 10px 35px rgba(15, 23, 42, 0.45)'
            }}
          >
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
              <div className="space-y-2 max-w-3xl">
                <div className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-wider text-cyan-300">
                  <span>🎛️ Optional Android HUD Modes</span>
                  <span className="text-slate-500">•</span>
                  <span className="text-emerald-300">Zero HUD Defaultable Any Time</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-black text-white">
                  Optional Real-Time Tactical Data: 3 Modes, Your Choice
                </h2>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                  Prefer strictly zero overlay during matches, a quiet move-count reference sheet, or full scrim study telemetry? Switch between all three modes cleanly from the corner emblem — without losing battle auto-logging or DVR recording.
                </p>
              </div>

              <div className="flex flex-wrap gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => onSelectSubpage('guide')}
                  className="px-4 py-2.5 rounded-xl font-black text-xs bg-teal-400 hover:bg-teal-300 text-slate-950 transition shadow-md cursor-pointer"
                >
                  📖 Open Field Manual &amp; Modes →
                </button>
                <button
                  type="button"
                  onClick={() => onLaunchWebApp('simulator')}
                  className="px-4 py-2.5 rounded-xl font-bold text-xs bg-slate-900/90 hover:bg-slate-800 text-amber-300 border border-amber-400/40 transition cursor-pointer"
                >
                  🧮 Preview Compact &amp; Full Layouts in Web Simulator →
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Mode 1: Log-Only Stealth */}
              <div className="p-5 rounded-2xl border bg-[#07101E] border-emerald-500/40 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-black text-white">🔕 Mode 1: Log-Only Stealth (Zero HUD)</span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-400/40 text-emerald-300 text-[10px] font-bold shrink-0">
                    Tournament &amp; Clean-Play Safe
                  </span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Hold the top-left emblem for <strong>2.0s</strong> to remove every floating overlay view (<code className="text-emerald-300 font-mono">View.GONE</code>) and mute haptics while silently auto-logging teams and recording frame-synced DVR replays for post-match review.
                </p>
              </div>

              {/* Mode 2: Compact Reference HUD */}
              <div className="p-5 rounded-2xl border bg-[#081120] border-teal-400/45 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-black text-white">⚡ Mode 2: Compact Reference HUD (Default)</span>
                  <span className="px-2 py-0.5 rounded-full bg-teal-400/15 border border-teal-400/45 text-teal-300 text-[10px] font-bold shrink-0">
                    AI Coach OFF by Default
                  </span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Ships with the <code className="text-teal-300 font-mono">Moves (Def)</code> preset (Mirrored Header + Opp/My Attacks + Pacing, with <strong>AI Coach OFF</strong> &amp; <strong>3×3 Matrix OFF</strong>), 6-module granular toggles, and shareable HUD layout URLs.
                </p>
              </div>

              {/* Mode 3: Full Practice HUD */}
              <div className="p-5 rounded-2xl border bg-[#081120] border-amber-400/35 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-black text-white">📐 Mode 3: Full Practice HUD (Opt-In)</span>
                  <span className="px-2 py-0.5 rounded-full bg-amber-400/15 border border-amber-400/40 text-amber-300 text-[10px] font-bold shrink-0">
                    Optional Study &amp; Practice
                  </span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Single-tap the emblem when practicing with friends or studying matchups to expand the full 9-shield matchup matrix, turn pacing bars, and optional Shield Decision cards.
                </p>
              </div>
            </div>
          </section>

          {/* 5. 4-TIER MEMBERSHIP MATRIX & PRIORITY SUPPORT QUEUE */}
          <section
            id="pricing"
            className="rounded-3xl p-6 sm:p-8 border space-y-6"
            style={{ backgroundColor: 'var(--mk-card)', borderColor: 'var(--mk-border)' }}
          >
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div>
                <div className="text-xs font-extrabold uppercase tracking-wider text-amber-300">
                  💎 Community-First Pricing • No Forced Subscriptions
                </div>
                <h2 className="text-2xl sm:text-3xl font-black text-white mt-1">
                  Free Auto-Logger, Replay Viewer &amp; Team Builder Forever. Upgrade for Cloud DVR Vault &amp; All-Cup Anti-Meta.
                </h2>
                <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-3xl">
                  Subscribing to <strong>Legend Pro</strong> or <strong>VIP</strong> even once permanently grants you <strong className="text-amber-300">🏅 Lifetime Supporter (Alumni)</strong> status forever—keeping the <strong>🛡️ Attack Incoming! Shield Decision Overlay</strong>, <strong>🧠 Compact AI Coach</strong>, Unlimited Lifetime Battle Logs, and <strong>25 Local DVR Videos (+ 5 ⭐ Local Pins)</strong> unlocked even if your seasonal pass expires.
                </p>
              </div>

              {/* Pre-Checkout Trainer ID Binding Input */}
              <div
                className="p-3 rounded-2xl border flex flex-col gap-1.5 min-w-[270px]"
                style={{ backgroundColor: 'var(--mk-card-alt)', borderColor: 'var(--mk-accent)' }}
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
                style={{ backgroundColor: 'var(--mk-card-alt)', borderColor: 'var(--mk-border)' }}
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
                    <li>✅ <strong>Current Season Auto-Logs + Free 1-Click GOBattleLog Export</strong></li>
                    <li>✅ <strong>Log-Only Stealth Mode + 5 Local DVR Videos + 2 ⭐ Local Pins</strong> (15 FPS)</li>
                    <li>✅ <strong>Great &amp; Master League Anti-Meta Builder + Web 3v3 Simulator</strong></li>
                    <li>✅ <strong>Customizable Compact HUD (AI Coach OFF) &amp; 9-Shield Matrix</strong></li>
                    <li>✅ <strong>Synchronized Haptics &amp; Open-League Backline Estimates</strong></li>
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
                style={{ backgroundColor: 'var(--mk-card-alt)', borderColor: 'var(--mk-accent)' }}
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
                    <li>🛡️ <strong>Shield Decision HUD + 🧠 Compact AI Coach Unlocked Forever</strong></li>
                    <li>📜 <strong>Unlimited Lifetime Battle Log History</strong></li>
                    <li>🎥 <strong>25 Local DVR Videos + 5 ⭐ Local Pins (1 Full Day)</strong></li>
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
                  backgroundColor: 'var(--mk-card-alt)',
                  borderColor: 'var(--mk-accent)',
                  boxShadow: '0 0 28px rgba(var(--mk-accent-rgb), 0.22)'
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
                    <li>🎥 <strong>50 Local DVR Battles + 10 ⭐ Local Pins (10 GBL Sets)</strong></li>
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
                style={{ backgroundColor: 'var(--mk-card-alt)', borderColor: 'var(--mk-accent2)' }}
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
                    <li>🎥 <strong>30 FPS Smooth Hardware DVR</strong> (Decoupled 900 kbps CBR)</li>
                    <li>☁️ <strong>150 Rolling (365d) + 25 Starred Replays (4 GB R2)</strong></li>
                    <li>📱 <strong>Up to 200 Local DVR Battles (25–200 Slider) + 25 ⭐ Local</strong></li>
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
                📖 Visual Field Manual • Semi-Transparent Overlay &amp; Modes
              </div>
              <h1 className="text-2xl sm:text-4xl font-black text-white mt-1">
                How to Read &amp; Master the SilphScope PvP Overlay
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-3xl">
                Built with adjustable transparency so Pokémon GO&apos;s health bars, nameplates, and charged-move buttons stay crisp — or toggle Log-Only Stealth Mode for zero HUD during live sets.
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

          {/* Annotated 6-Zone Breakdown with Semi-Transparent Overlay Frames */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-5 flex flex-col items-center gap-4">
              <div
                className="rounded-3xl p-2 border-2 shadow-2xl max-w-[330px]"
                style={{ backgroundColor: 'var(--mk-card-alt)', borderColor: 'var(--mk-accent)' }}
              >
                <img
                  src={`${import.meta.env.BASE_URL}screenshots/featured_hero_shiny_dialga_poster.png`}
                  alt="Annotated Semi-Transparent Tactical Battle Overlay"
                  className="rounded-2xl w-full h-auto block"
                />
              </div>
              <div
                className="rounded-3xl p-2 border-2 shadow-2xl max-w-[330px]"
                style={{ backgroundColor: 'var(--mk-card-alt)', borderColor: 'var(--mk-accent2)' }}
              >
                <img
                  src={`${import.meta.env.BASE_URL}screenshots/featured_ul_bp_skeledirge_poster.png`}
                  alt="Annotated Semi-Transparent Overlay — Breakpoint & Shadow Lock"
                  className="rounded-2xl w-full h-auto block"
                />
              </div>
            </div>

            <div className="lg:col-span-7 space-y-4">
              {[
                {
                  step: 'Row 1 • Mirrored Live Header & Auto-Provenance Pills',
                  badge: '[HP%, E, 🛡️] | Shadow: 🟣 ON ✓ / OFF ✓ / N/A | Form ✓',
                  desc: 'Displays your active Pokémon on the left and the opponent on the right, plus 3D HSV Shadow Aura verification (Shadow: 🟣 ON ✓, Shadow: OFF ✓, or Shadow: N/A for unreleased Shadows) and automatic Form ✓ disambiguation. Single-tapping the top-left crest alternates Full HUD <-> Compact HUD, while holding for 2.0s toggles Log-Only Stealth Mode, and idle/post-set bars keep a 1-tap 📊 Battle Log shortcut handy. Live buff/debuff stage badges (e.g., A-2, D-1, D-3, BUST) appear automatically whenever stat-stage moves fire.'
                },
                {
                  step: 'Row 2 • Active Matchup & Synchronized Swap Timers',
                  badge: 'Swap: 12s | Opp: 2s + Single 80ms Haptic Pulse',
                  desc: 'Tracks both players’ 45-second switch clocks independently. When the opponent’s switch clock drops below 5 seconds, your phone triggers a single 80ms haptic vibration pulse so you never get caught off-guard by a sudden snipe.'
                },
                {
                  step: 'Row 3 • 3×3 Asymmetric 9-Shield Matchup Matrix',
                  badge: '0S / 1S / 2S Colored Dots Across All 3v3 Slots',
                  desc: 'Shows how all 3 of your Pokémon perform against each revealed opponent Pokémon across 0-shield, 1-shield, and 2-shield scenarios (Green = Win, Grey = Neutral, Red = Loss). For unrevealed opponent slots, displays live Backline Predictor probabilities.'
                },
                {
                  step: 'Rows 4 & 5 • Turn-Exact Move Pacing, Live Breakpoints & Stage Damage',
                  badge: '⚡BP+1 / 🛡️BLK-1 • Raw-Pulse Cadence ✓ • Double 80ms Haptic',
                  desc: 'Shows fast moves remaining until each charged attack is ready, confirms opponent fast moves via Raw HP-Pulse Turn Cadence (✓), narrows opponent IVs from Observed CP to surface live ⚡BP+1 / 🛡️BLK-1 fast-move breakpoints & bulkpoints, and computes exact damage percentages across all 3 slots—automatically scaled for Shadow 1.2x multipliers and live [-4..+4] Attack/Defense buffs and debuffs.'
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
                },
                {
                  step: 'Tournament Compliance • Competitive Log-Only Stealth Mode',
                  badge: '100% Invisible HUD • 0 Haptics • Headless Auto-Log & DVR',
                  desc: 'Fully compliant with strict Play! Pokémon and Show 6 tournament & referee guidelines. When activated (via Settings or 2.0s crest hold), all floating HUD elements are completely hidden (View.GONE) and haptic vibrations are silenced during live matches. SilphScope continues running headless vision, OCR, and hardware H.264 DVR + _deep_trace.jsonl in the background, automatically logging full 3v3 teams and syncing post-match for between-round coaching, matchup review, and VOD analysis.'
                }
              ].map((item) => (
                <div
                  key={item.step}
                  className="p-4 rounded-2xl border space-y-1.5"
                  style={{ backgroundColor: 'var(--mk-card)', borderColor: 'var(--mk-border)' }}
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
            style={{ backgroundColor: 'var(--mk-card)', borderColor: 'var(--mk-border)' }}
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
                    'Synchronized H.264 Battle DVR + Web Replay Theater',
                    '✅ 15/30 FPS DVR + dvr.silphscopepvp.com',
                    '❌ None',
                    '❌ None'
                  ],
                  [
                    'Tournament-Compliant Log-Only Stealth Mode (0 HUD / 0 Haptics + Headless DVR & Auto-Log)',
                    '✅ Built-In & Free Across All Tiers',
                    '—',
                    '—'
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
                    'Objective Skill Math (BMF Matchmaking Luck vs. WAE Skill)',
                    '✅ Full BMF, WAE & Safe-Swap MVP Grades',
                    '❌ None',
                    '❌ Win/Loss Count Only'
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
                    'Optional Semi-Transparent Android HUD (Adjustable Transparency)',
                    '✅ 100% Free Forever',
                    '❌ Web-Only',
                    '❌ Web-Only'
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
              backgroundColor: 'var(--mk-card)',
              borderColor: 'var(--mk-border)',
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
                    style={{ backgroundColor: 'var(--mk-card-alt)', borderColor: 'var(--mk-border)' }}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setVaultUser(vaultInputUser);
                    fetchVaultReplays(vaultInputUser);
                  }}
                  className="px-3.5 py-2 rounded-xl font-extrabold text-xs border transition hover:border-teal-400 text-white cursor-pointer flex items-center gap-1.5 flex-shrink-0"
                  style={{ backgroundColor: 'var(--mk-card-alt)', borderColor: 'var(--mk-accent)' }}
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
                    backgroundColor: 'rgba(var(--mk-accent2-rgb), 0.12)',
                    borderColor: 'rgba(var(--mk-accent2-rgb), 0.45)'
                  }}
                >
                  <span>⭐</span>
                  <span>@Featured</span>
                </button>
                {(webScreenName || localStorage.getItem('sspvp_vault_user') || localStorage.getItem('gbl_web_screen_name_v700')) && (
                  <button
                    type="button"
                    onClick={() => {
                      const myName = (webScreenName || localStorage.getItem('sspvp_vault_user') || localStorage.getItem('gbl_web_screen_name_v700') || '').trim();
                      if (myName && myName.toLowerCase() !== 'featured') {
                        setVaultInputUser(myName);
                        setVaultUser(myName);
                        fetchVaultReplays(myName);
                      }
                    }}
                    className="px-3 py-2 rounded-xl font-extrabold text-xs border border-teal-400/40 bg-teal-950/40 text-teal-300 hover:text-white transition cursor-pointer flex items-center gap-1 flex-shrink-0"
                    title="Switch to your personal DVR Replay Vault"
                  >
                    <span>👤</span>
                    <span>My Vault</span>
                  </button>
                )}
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
                  style={{ backgroundColor: 'var(--mk-card-alt)', borderColor: 'var(--mk-border)' }}
                >
                  <span>📋</span>
                  <span>Share</span>
                </button>
                {isVaultOwner ? (
                  <button
                    type="button"
                    onClick={() => {
                      localStorage.removeItem('sspvp_vault_session');
                      localStorage.removeItem('sspvp_vault_user');
                      localStorage.removeItem('sspvp_pending_gh_device');
                      clearSharedVaultCookies();
                      setIsVaultOwner(false);
                      setVaultUser('Featured');
                      setVaultInputUser('Featured');
                      onVaultLogout?.();
                      fetchVaultReplays('Featured');
                    }}
                    className="px-2.5 py-2 rounded-lg font-bold text-xs border border-rose-500/40 bg-rose-950/40 text-rose-300 hover:text-white transition cursor-pointer flex items-center gap-1"
                    title="Sign out of owner session"
                  >
                    <span>🚪</span>
                    <span>Log Out</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setOwnerLoginOpen(true)}
                    className="px-2.5 py-2 rounded-lg font-bold text-xs border transition hover:border-amber-400 text-amber-300 cursor-pointer flex items-center gap-1"
                    style={{ backgroundColor: 'var(--mk-card-alt)', borderColor: 'rgba(var(--mk-accent2-rgb), 0.35)' }}
                  >
                    <span>🔐</span>
                    <span>Owner Login</span>
                  </button>
                )}
              </div>
            </div>

            {/* Vault Summary & Filter Tabs */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 pt-2 border-t border-slate-800/80">
              <div className="flex items-center gap-2 text-xs font-mono text-slate-300 flex-wrap">
                <span className="font-bold text-teal-300">@{vaultUser}</span>
                {isVaultOwner && vaultUser.toLowerCase() !== 'featured' && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-black uppercase bg-teal-400/20 text-teal-300 border border-teal-400/40">
                    👑 Owner
                  </span>
                )}
                <span>•</span>
                <span className="text-amber-300">⭐ {vaultStats.starred} Starred</span>
                <span>•</span>
                <span className="text-cyan-300">🌐 {vaultStats.public} Public</span>
                {isVaultOwner && (
                  <>
                    <span>•</span>
                    <span className="text-slate-400">🔒 {vaultStats.private} Private</span>
                  </>
                )}
              </div>

              {/* Filter Pills */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {(isVaultOwner ? (['all', 'starred', 'public', 'private'] as const) : (['all', 'starred', 'public'] as const)).map((filter) => {
                  const labels = {
                    all: `All (${vaultStats.total})`,
                    starred: `⭐ Starred (${vaultStats.starred})`,
                    public: `🌐 Public (${vaultStats.public})`,
                    private: `🔒 Private (${vaultStats.private})`
                  };
                  const active = vaultFilter === filter;
                  return (
                    <button
                      key={filter}
                      type="button"
                      onClick={() => setVaultFilter(filter)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
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

            {/* Tiered League (CP) & Cup Filters (Matches Android Battle Logs) */}
            {vaultReplays.length > 0 && (() => {
              const tierCounts = {
                ALL: vaultReplays.length,
                GREAT: vaultReplays.filter((r) => resolveDvrCpTier(r.league) === 'GREAT').length,
                ULTRA: vaultReplays.filter((r) => resolveDvrCpTier(r.league) === 'ULTRA').length,
                MASTER: vaultReplays.filter((r) => resolveDvrCpTier(r.league) === 'MASTER').length
              };
              const tierScopedReplays =
                vaultCpTier === 'ALL'
                  ? vaultReplays
                  : vaultReplays.filter((r) => resolveDvrCpTier(r.league) === vaultCpTier);
              const availableCups = sortDvrCupsWithinTier(
                tierScopedReplays.map((r) => stripDvrLeagueCpSuffix(r.league)).filter(Boolean)
              );
              const tierAllLabel =
                vaultCpTier === 'ALL'
                  ? `All Cups (${tierScopedReplays.length})`
                  : vaultCpTier === 'GREAT'
                    ? `All Great Cups (${tierScopedReplays.length})`
                    : vaultCpTier === 'ULTRA'
                      ? `All Ultra Cups (${tierScopedReplays.length})`
                      : `All Master Cups (${tierScopedReplays.length})`;
              const tierButtons: Array<{ key: DvrCpTier; label: string }> = [
                { key: 'ALL', label: `All Leagues (${tierCounts.ALL})` },
                { key: 'GREAT', label: `Great (${tierCounts.GREAT})` },
                { key: 'ULTRA', label: `Ultra (${tierCounts.ULTRA})` },
                { key: 'MASTER', label: `Master (${tierCounts.MASTER})` }
              ];
              const cleanVaultCupFilter = stripDvrLeagueCpSuffix(vaultCupFilter);
              return (
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-2 border-t border-slate-800/70">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] font-bold text-slate-400 mr-1">🏆 League:</span>
                    {tierButtons.map((tb) => {
                      const active = vaultCpTier === tb.key;
                      return (
                        <button
                          key={tb.key}
                          type="button"
                          onClick={() => {
                            setVaultCpTier(tb.key);
                            setVaultCupFilter('ALL');
                          }}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                            active
                              ? 'bg-cyan-400 text-slate-950 font-black shadow'
                              : 'bg-[#081120] text-slate-300 hover:text-white border border-[#19304E]'
                          }`}
                        >
                          {tb.label}
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-slate-400 whitespace-nowrap">🏅 Cup:</span>
                    <select
                      value={availableCups.some((c) => c.toUpperCase() === cleanVaultCupFilter.toUpperCase()) ? cleanVaultCupFilter : 'ALL'}
                      onChange={(e) => setVaultCupFilter(e.target.value)}
                      className="px-2.5 py-1 rounded-lg bg-[#081120] border border-[#19304E] text-cyan-200 font-bold text-xs focus:outline-none focus:border-cyan-400 cursor-pointer"
                    >
                      <option value="ALL">{tierAllLabel}</option>
                      {availableCups.map((cup) => {
                        const count = tierScopedReplays.filter(
                          (r) => stripDvrLeagueCpSuffix(r.league).toUpperCase() === cup.toUpperCase()
                        ).length;
                        return (
                          <option key={cup} value={cup}>
                            {formatDvrCupLabel(cup, vaultCpTier)} ({count})
                          </option>
                        );
                      })}
                    </select>
                  </div>
                </div>
              );
            })()}

            {/* Owner Vault Privacy & Storage Quota Bar */}
            {isVaultOwner && vaultUser.toLowerCase() !== 'featured' && (
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-2 border-t border-slate-800/70 text-[11px]">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-slate-300 whitespace-nowrap">🌐 Vault Privacy:</span>
                  <select
                    value={vaultVisibility}
                    onChange={(e) => handleUpdateVaultVisibility(e.target.value)}
                    className="px-2.5 py-1 rounded-lg bg-[#081120] border border-[#19304E] text-teal-200 font-bold text-[11px] focus:outline-none focus:border-teal-400 cursor-pointer"
                  >
                    <option value="public_only">🔒 Private (Only Public Videos Shared)</option>
                    <option value="starred_only">⭐ Only Starred Shared</option>
                    <option value="starred_and_public">⭐+🌐 Starred + Public Shared</option>
                    <option value="all">🌐 All Videos Shared Publicly</option>
                    <option value="none">🚫 No Videos Without Login</option>
                  </select>
                </div>
                {vaultUsageInfo && (
                  <div className="font-mono text-slate-400 flex items-center gap-2 flex-wrap">
                    <span>
                      ☁️ {vaultUsageInfo.usedMb.toFixed(1)}/{vaultUsageInfo.maxStorageMb} MB
                    </span>
                    <span>•</span>
                    <span>
                      Rolling {vaultUsageInfo.rollingCount}/{vaultUsageInfo.maxRollingBattles}
                    </span>
                    <span>•</span>
                    <span className="text-amber-300">
                      ⭐ {vaultUsageInfo.pinnedCount}/{vaultUsageInfo.maxPinnedBattles}
                    </span>
                  </div>
                )}
              </div>
            )}
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
                  if (vaultCpTier !== 'ALL' && resolveDvrCpTier(item.league) !== vaultCpTier) {
                    return false;
                  }
                  if (
                    vaultCupFilter !== 'ALL' &&
                    stripDvrLeagueCpSuffix(item.league).toUpperCase() !== stripDvrLeagueCpSuffix(vaultCupFilter).toUpperCase()
                  ) {
                    return false;
                  }
                  if (vaultFilter === 'starred') return item.isPinned;
                  if (vaultFilter === 'public') return item.isPublic;
                  if (vaultFilter === 'private') return !item.isPublic;
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
                      const mbSize = (((item.totalBytes || item.videoBytes || 0)) / (1024 * 1024)).toFixed(1);
                      const canManageItem = isVaultOwner && vaultUser.toLowerCase() !== 'featured';
                      const isAdminOwner = canManageItem && vaultUser.toLowerCase() === 'sportsfan986';
                      const isItemFlagged = Boolean(item.manuallyFlagged || item.userIssueNote);
                      const isBusy = vaultActionBusyId === item.shareId;
                      return (
                        <div
                          key={item.shareId}
                          className="rounded-2xl border p-4.5 flex flex-col justify-between gap-4 transition hover:border-teal-400/50 hover:shadow-xl"
                          style={{
                            backgroundColor: 'var(--mk-card)',
                            borderColor: item.isPinned ? 'var(--mk-accent)' : 'var(--mk-border)',
                            boxShadow: item.isPinned ? '0 0 16px rgba(var(--mk-accent-rgb), 0.12)' : 'none'
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
                                  {stripDvrLeagueCpSuffix(item.league)}
                                </span>
                              </div>
                              <span className="text-[11px] font-mono font-bold text-slate-400">
                                {mbSize} MB • {item.durationSec}s
                              </span>
                            </div>

                            {/* Matchup Summary */}
                            <div className="text-sm font-extrabold text-white leading-snug">
                              {item.showcaseTitle || item.matchupSummary}
                            </div>

                            {/* Badges / Diagnostics */}
                            <div className="flex items-center gap-2 flex-wrap text-[11px]">
                              <span className="font-mono text-slate-400">
                                @{item.screenName || vaultUser}
                              </span>
                              {formatDvrLocalDateTime(item.createdAt || item.uploadedAt) && (
                                <span className="font-mono text-slate-400">
                                  • 🕒 {formatDvrLocalDateTime(item.createdAt || item.uploadedAt)}
                                </span>
                              )}
                              {item.isPinned && (
                                <span className="px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/40 font-bold">
                                  ⭐ Starred
                                </span>
                              )}
                              {item.isPublic ? (
                                <span className="px-2 py-0.5 rounded-full bg-teal-400/15 text-teal-300 border border-teal-400/30 font-bold">
                                  🌐 Public
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full bg-slate-800/80 text-slate-400 border border-slate-700/70 font-bold">
                                  🔒 Private
                                </span>
                              )}
                              {item.featuredShareId && (
                                <span className="px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-200 border border-amber-400/40 font-bold">
                                  🌟 Featured ({item.featuredShareId})
                                </span>
                              )}
                              {item.userTierBadge && (
                                <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-200 border border-purple-500/40 font-semibold">
                                  {item.userTierBadge}
                                </span>
                              )}
                            </div>

                            {/* Diagnostic Issue Warning */}
                            {isItemFlagged && (
                              <div className="p-2.5 rounded-xl bg-amber-400/10 border border-amber-400/30 text-amber-200 text-xs flex items-center justify-between gap-2 flex-wrap">
                                <div className="flex items-center gap-2">
                                  <span>🚩</span>
                                  <span>
                                    <strong>Reported Issue:</strong>{' '}
                                    {item.userIssueNote || 'Flagged for diagnostic review'}
                                  </span>
                                </div>
                                {canManageItem && (
                                  <button
                                    type="button"
                                    disabled={isBusy}
                                    onClick={() => handleFlagReplay(item, true)}
                                    className="px-2 py-0.5 rounded-lg bg-[#081120] border border-slate-600 text-slate-200 hover:text-white font-bold text-[10.5px] cursor-pointer"
                                    title="Retract this issue report"
                                  >
                                    ↩️ Unflag
                                  </button>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Card Actions */}
                          <div className="flex flex-col gap-2 pt-3 border-t border-slate-800/80">
                            {/* Primary Watch & Share Row */}
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <div className="flex items-center gap-2 flex-wrap">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedWatchSeekSec(0);
                                    setSelectedWatchReplay(item);
                                  }}
                                  className="px-3.5 py-1.5 rounded-xl font-black text-xs border shadow transition hover:scale-105 cursor-pointer flex items-center gap-1.5"
                                  style={{
                                    backgroundColor: 'var(--mk-accent)',
                                    borderColor: 'var(--mk-accent)',
                                    color: 'var(--mk-cta-text)',
                                    boxShadow: '0 2px 10px rgba(var(--mk-accent-rgb), 0.3)'
                                  }}
                                >
                                  <span>▶️</span>
                                  <span>Watch + HUD</span>
                                </button>
                                {item.highlightSec ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedWatchSeekSec(Number(item.highlightSec) || 0);
                                      setSelectedWatchReplay(item);
                                    }}
                                    className="px-2.5 py-1.5 rounded-xl font-bold text-xs bg-amber-400/15 hover:bg-amber-400/25 text-amber-300 border border-amber-400/40 transition cursor-pointer"
                                  >
                                    🎯 Highlight ({item.highlightSec}s)
                                  </button>
                                ) : null}
                              </div>

                              <div className="flex items-center gap-1.5 flex-wrap">
                                <button
                                  type="button"
                                  onClick={() => handleShareReplay(item)}
                                  className="px-2.5 py-1.5 rounded-lg font-bold text-[11px] bg-[#081120] text-teal-300 hover:text-white border border-teal-400/40 transition cursor-pointer flex items-center gap-1"
                                  title="Share replay via native mobile Share sheet or copy link"
                                >
                                  <span>📤</span>
                                  <span>Share</span>
                                </button>
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
                                  <span>Copy</span>
                                </button>
                              </div>
                            </div>

                            {/* Owner & Admin Management Controls Row */}
                            {canManageItem && (
                              <div className="flex items-center justify-between gap-1.5 pt-2 border-t border-slate-800/60 flex-wrap">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {/* Star / Unstar */}
                                  <button
                                    type="button"
                                    disabled={isBusy}
                                    onClick={() => handleToggleStarReplay(item)}
                                    className={`px-2.5 py-1 rounded-lg font-bold text-[11px] border transition cursor-pointer flex items-center gap-1 ${
                                      item.isPinned
                                        ? 'bg-amber-400/20 text-amber-300 border-amber-400/50'
                                        : 'bg-[#081120] text-slate-300 hover:text-amber-200 border-[#19304E]'
                                    }`}
                                    title="Starred replays are pinned and retained for 365 days"
                                  >
                                    <span>{item.isPinned ? '⭐' : '☆'}</span>
                                    <span>{item.isPinned ? 'Starred' : 'Star'}</span>
                                  </button>

                                  {/* Public / Private Toggle */}
                                  <button
                                    type="button"
                                    disabled={isBusy}
                                    onClick={() => handleTogglePublicReplay(item)}
                                    className={`px-2.5 py-1 rounded-lg font-bold text-[11px] border transition cursor-pointer flex items-center gap-1 ${
                                      item.isPublic
                                        ? 'bg-cyan-500/20 text-cyan-200 border-cyan-400/50'
                                        : 'bg-[#081120] text-slate-300 hover:text-cyan-200 border-[#19304E]'
                                    }`}
                                    title="Toggle whether this replay is Public or Private"
                                  >
                                    <span>{item.isPublic ? '🌐' : '🔒'}</span>
                                    <span>{item.isPublic ? 'Public' : 'Private'}</span>
                                  </button>

                                  {/* Flag / Edit Issue */}
                                  <button
                                    type="button"
                                    disabled={isBusy}
                                    onClick={() => handleFlagReplay(item, false)}
                                    className={`px-2.5 py-1 rounded-lg font-bold text-[11px] border transition cursor-pointer flex items-center gap-1 ${
                                      isItemFlagged
                                        ? 'bg-amber-400/15 text-amber-300 border-amber-400/45'
                                        : 'bg-[#081120] text-rose-300 hover:text-rose-200 border-rose-800/60'
                                    }`}
                                    title="Flag an issue on this replay for diagnostic analysis"
                                  >
                                    <span>🚩</span>
                                    <span>{isItemFlagged ? 'Flagged ✓' : 'Flag'}</span>
                                  </button>

                                  {/* Admin-Only Promote to @Featured */}
                                  {isAdminOwner && (
                                    <button
                                      type="button"
                                      disabled={isBusy}
                                      onClick={() => handlePromoteToFeatured(item)}
                                      className={`px-2.5 py-1 rounded-lg font-bold text-[11px] border transition cursor-pointer flex items-center gap-1 ${
                                        item.featuredShareId
                                          ? 'bg-amber-400/20 text-amber-200 border-amber-400/50'
                                          : 'bg-teal-500/15 text-teal-300 hover:bg-teal-500/25 border-teal-400/50'
                                      }`}
                                      title="Admin Only (@sportsfan986): Clone this battle to @Featured Showcase"
                                    >
                                      <span>🌟</span>
                                      <span>
                                        {item.featuredShareId ? 'Featured ✓' : 'Promote to Featured'}
                                      </span>
                                    </button>
                                  )}
                                </div>

                                {/* Delete Replay */}
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() => handleDeleteReplay(item)}
                                  className="px-2.5 py-1 rounded-lg font-bold text-[11px] bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 hover:text-white border border-rose-500/45 transition cursor-pointer flex items-center gap-1"
                                  title="Permanently delete this replay from your Cloud DVR Vault"
                                >
                                  <span>🗑️</span>
                                  <span>Delete</span>
                                </button>
                              </div>
                            )}
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
                  background: 'linear-gradient(90deg, var(--mk-accent) 0%, var(--mk-text) 50%, var(--mk-accent2) 100%)',
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
              backgroundColor: 'rgba(var(--mk-card-rgb), 0.85)',
              borderColor: 'var(--mk-border)'
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
            style={{ backgroundColor: 'var(--mk-card)', borderColor: 'var(--mk-border)' }}
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
            className="mk-media-preserve rounded-3xl border-2 overflow-hidden shadow-2xl relative"
            style={{
              borderColor: 'var(--mk-accent)',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.7), 0 0 30px rgba(var(--mk-accent-rgb), 0.15)'
            }}
          >
            {/* Arena Top Bar */}
            <div className="p-3 bg-slate-950/90 border-b border-slate-800 flex items-center justify-between text-xs font-mono font-bold">
              <div className="flex items-center gap-2 text-teal-300">
                <span className="w-2.5 h-2.5 rounded-full bg-teal-400 animate-ping"></span>
                <span>SILPHSCOPE SECONDARY DISPLAY • ADJUSTABLE TRANSPARENCY</span>
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
                  'radial-gradient(circle at 50% 30%, rgba(var(--mk-accent-rgb), 0.15) 0%, transparent 60%), linear-gradient(180deg, #050810 0%, #0B1526 50%, #050810 100%)'
              }}
            >
              {/* Top Mirrored HUD Header */}
              <div
                className="p-4 rounded-2xl border backdrop-blur-md transition-all shadow-xl"
                style={{
                  backgroundColor: 'rgba(8, 17, 32, 0.65)',
                  borderColor: 'rgba(var(--mk-accent-rgb), 0.4)'
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
                  borderColor: 'rgba(var(--mk-accent2-rgb), 0.45)',
                  boxShadow: '0 0 20px rgba(var(--mk-accent2-rgb), 0.1)'
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
                  borderColor: 'rgba(var(--mk-accent-rgb), 0.3)'
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

      {/* FULL-SCREEN REPLAY THEATER OVERLAY (ZERO BANNERS, FULL-SCREEN BATTLE + BORDERED 'X' RETURN BUTTON) */}
      {selectedWatchReplay && (
        <div className="fixed inset-0 z-50 bg-[#02060d] animate-fadeIn flex flex-col overflow-hidden">
          {/* Floating Top-Right Bordered 'X' Close Button -> Returns to Main DVR Screen */}
          <button
            type="button"
            onClick={() => setSelectedWatchReplay(null)}
            className="fixed top-3 right-3 z-[60] w-9 h-9 rounded-xl bg-[#081120]/90 hover:bg-[#0E1B2E] text-teal-200 hover:text-white flex items-center justify-center font-black text-sm cursor-pointer transition shadow-2xl backdrop-blur-md"
            style={{
              border: '1.5px solid var(--mk-accent)',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.85), 0 0 14px rgba(var(--mk-accent-rgb), 0.35)'
            }}
            title="Close Replay & Return to Vault"
            aria-label="Close Replay"
          >
            ✕
          </button>

          {/* Full-Screen Replay Stage */}
          {(() => {
            const watchParams = new URLSearchParams();
            watchParams.set('embed', '1');
            if (selectedWatchSeekSec > 0) {
              watchParams.set('t', String(selectedWatchSeekSec));
            }
            try {
              const curQs = new URLSearchParams(window.location.search);
              ['hud', 'cmp', 'opp', 'my', 'coach', 'matrix', 'mtx', 'pace', 'pacing', 'tb', 'sh', 'pos', 'adv', 'op', 'sbs', 'anon'].forEach((k) => {
                const v = curQs.get(k);
                if (v !== null && v !== '') {
                  watchParams.set(k, v);
                }
              });
            } catch {}
            watchParams.set('theme', activeTheme.id);
            watchParams.set('wm', showThemeWatermark ? '1' : '0');
            return (
              <iframe
                src={`https://dvr.silphscopepvp.com/watch/${selectedWatchReplay.shareId}?${watchParams.toString()}`}
                title="SilphScope Replay Theater"
                className="w-full h-full flex-1 border-none block bg-black"
                allow="fullscreen; clipboard-write"
              ></iframe>
            );
          })()}
        </div>
      )}

      {/* PWA INSTALLATION / ADD TO HOME SCREEN MODAL (BRANDED: SILPHSCOPE DVR) */}
      {showInstallModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
          <div
            className="w-full max-w-lg rounded-3xl border-2 p-6 space-y-5 shadow-2xl relative"
            style={{
              backgroundColor: 'var(--mk-card)',
              borderColor: 'var(--mk-accent)',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.8), 0 0 35px rgba(var(--mk-accent-rgb), 0.25)'
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img
                  src={`${import.meta.env.BASE_URL}favicon.svg`}
                  alt="SilphScope PvP Icon"
                  className="w-10 h-10 rounded-xl shadow-md border border-sky-400/45"
                />
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
                    <strong>SilphScope DVR</strong> will appear on your Home Screen with the SilphScope emblem icon, launching directly into the DVR Vault and Live HUD with zero browser bars.
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
              backgroundColor: 'var(--mk-card)',
              borderColor: 'var(--mk-accent2)',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.8), 0 0 35px rgba(var(--mk-accent2-rgb), 0.2)'
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
              Log in with your license key or vault password to star replays, manage private battles, and access elevated diagnostic traces.
            </p>

            <div className="flex rounded-xl bg-[#081120] p-1 border border-slate-800 text-xs font-bold">
              {(['token', 'password'] as const).map((tab) => (
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
                  {tab === 'token' ? 'License Key' : 'Password'}
                </button>
              ))}
            </div>

            {authTab === 'token' && (
              <div className="space-y-3">
                <input
                  type="text"
                  value={authKey}
                  onChange={(e) => setAuthKey(e.target.value)}
                  placeholder="Enter SSPVP Unlock Key (SSPVP-PRO-...)"
                  className="w-full px-3 py-2.5 rounded-xl font-mono text-xs bg-[#081120] border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                />
                <input
                  type="email"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  placeholder="Or Checkout Email (optional claim)"
                  className="w-full px-3 py-2 rounded-xl text-xs bg-[#081120] border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                />
                {authErrorMsg && (
                  <div className="p-2.5 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-300 text-xs font-semibold">
                    ⚠️ {authErrorMsg}
                  </div>
                )}
                <button
                  type="button"
                  disabled={authLoading}
                  onClick={handleTokenLogin}
                  className="w-full py-2.5 rounded-xl bg-amber-400 text-slate-950 font-black text-xs hover:bg-amber-300 transition cursor-pointer disabled:opacity-50"
                >
                  {authLoading ? 'Verifying Token...' : 'Unlock Vault'}
                </button>
              </div>
            )}

            {authTab === 'password' && (
              <div className="space-y-3">
                <input
                  type="text"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  placeholder="Trainer Screen Name or Email"
                  className="w-full px-3 py-2 rounded-xl text-xs bg-[#081120] border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                />
                <input
                  type="password"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handlePasswordLogin();
                  }}
                  placeholder="Vault Password"
                  className="w-full px-3 py-2 rounded-xl text-xs bg-[#081120] border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                />
                {authErrorMsg && (
                  <div className="p-2.5 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-300 text-xs font-semibold">
                    ⚠️ {authErrorMsg}
                  </div>
                )}
                <button
                  type="button"
                  disabled={authLoading}
                  onClick={handlePasswordLogin}
                  className="w-full py-2.5 rounded-xl bg-amber-400 text-slate-950 font-black text-xs hover:bg-amber-300 transition cursor-pointer disabled:opacity-50"
                >
                  {authLoading ? 'Signing In...' : 'Log In with Password'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <footer
        className="border-t py-8 px-4 mt-12 text-xs"
        style={{ backgroundColor: activeTheme.bgHex, borderColor: activeTheme.borderHex, color: activeTheme.textSecondaryHex }}
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
