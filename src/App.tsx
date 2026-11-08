import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Shield,
  Zap,
  Target,
  Layers,
  Settings,
  Download,
  Copy,
  Check,
  Plus,
  Trash2,
  Play,
  RotateCcw,
  Smartphone,
  Eye,
  Scan,
  Sparkles,
  Info,
  ChevronDown,
  Swords,
  GripVertical,
  RefreshCw,
  ArrowUp,
  ArrowDown,
  ArrowLeftRight,
  BarChart2,
  Calculator,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import {
  POKEMON_DATABASE,
  INITIAL_PRESETS,
  TeamPreset,
  TeamMember,
  TeamArchetype,
  LeagueType,
  GBL_LEAGUES,
  SHOW6_LEAGUES,
  isBattleFrontierLeague,
  normalizeLeagueName,
  calculateTurnAlignment,
  resolveFastMove,
  resolveChargedMove,
  calculateFastDamage,
  calculateChargedDamage,
  calculateShieldMatrix,
  calculateOpponentMoveTimingRows,
  calculateMyMoveTimingRows,
  getAvailableFormsForPokemon,
  resolveBestDefaultFormAndShadow,
  abbrMove5,
  OppCountMode,
  PokemonStats,
  PVPOKE_TOP_OPPONENTS,
  TopOpponentInfo,
  computeEffectiveStatsForLeague,
  getRecommendedMovesForPokemon,
  getLeagueTop3Template,
  syncPvPokeDataAndRankings,
  getPvPokeDatabaseTelemetry,
  getPokemonAutocompleteSuggestions,
  PokemonAutocompleteOption,
  MatchupTierThresholds,
  DEFAULT_MATCHUP_TIER_THRESHOLDS,
  MATCHUP_TIER_THRESHOLDS_STORAGE_KEY,
  getStoredMatchupTierThresholds,
  MachineBrThresholds,
  DEFAULT_MACHINE_BR_THRESHOLDS,
  MACHINE_BR_THRESHOLDS_STORAGE_KEY,
  getStoredMachineBrThresholds,
  getSingleSlotBrTierInfo,
  getMachineBrTierInfo,
  evaluateOrAutoOrderTeam,
  evaluateTeamPresetMetrics,
  recalculateAllPresetsMetrics,
  RoleUpgradeSuggestion,
  TeamRoleRecommendationsResult,
  recommendTop3UpgradesPerRole,
  AlternateMovesetSuggestion,
  TeamMovesetOptimizationResult,
  recommendTop3AlternateMovesetsForTeam,
  evaluateSingleSlotAgainstBlendedMeta,
  computeBlendedSeasonMeta,
  getLiveRankingsForLeague,
  FORM_CHANGE_SPECIAL_POKEMON,
  getPvPokeStyleKeyMatchupsForPokemon,
  AEGISLASH_DOUBLE_BONUS_AUDIT,
  TOP_5_LEAGUE_SPECIES,
  PvPokeMatchupCardData,
  KeyMatchupItem,
  FormChangeComparisonGroup,
  precomputeTeam9x9ShieldMatrixAgainstMeta,
  getOverlayRealtime9x9Matchup,
  PrecomputedTeam9x9State,
  generateAntiMetaTeamOptions,
  formatAntiMetaDefaultTeamName,
  parseFeaturedRankRangeQuery,
  AntiMetaTeamOption,
  AntiMetaTeamBuilderResult,
  COMPETITIVE_ARCHETYPE_PLAYBOOKS,
  computeTacticalLeadAndSwapRecommendation,
  TacticalRecommendationResult,
  scaleBrByHpRatio,
  inferUnshieldedChargedMoveName,
  AppCombatMode,
  Show6RosterOf6Preset,
  Show6Pick3MatchupResult,
  BlindShow6RosterResult,
  Show6LiveBacklinePredictionResult,
  parsePokemonListInput,
  evaluateShow6Pick3Matchup,
  generateBlindShow6Roster,
  predictShow6UnrevealedBackline,
  getDefaultShow6RosterNames,
  INITIAL_SHOW6_ROSTERS_OF_6,
  INITIAL_SHOW6_OPPONENT_ROSTERS_OF_6,
  INITIAL_SHOW6_PRESETS_OF_3,
  isShow6EligibleLeague,
  isMegaOrPrimalSpecies,
  hasMultipleMegas,
  resolveMegaPlusMove,
  getSavedBfUsageSheetUrl,
  setSavedBfUsageSheetUrl,
  getSavedBfCoresSheetUrl,
  setSavedBfCoresSheetUrl,
  getShow6UsageAndCoreWeightPct,
  setShow6UsageAndCoreWeightPct,
  syncBattleFrontierUsageAndCores,
  getBattleFrontierCountsSummary,
  BATTLE_FRONTIER_USAGE_MAP,
  BATTLE_FRONTIER_CORES_MAP,
  recommendShow6RosterSlotUpgrades,
  recommendShow6RosterSlotMovesets,
  Show6SlotUpgradeSuggestion,
  Show6MovesetSuggestion,
  MostLikelyFormatOpponent6Info,
  getMostLikelyMetaOpponent6ForFormat,
  getAllFormatsMostLikelyMetaOpponent6,
  rescaleTeamMembersForLeague,
  LimitedMetaFormat,
  getLimitedMetaCatalog,
  getPinnedGblLimitedMetas,
  setPinnedGblLimitedMetas,
  getPinnedShow6LimitedMetas,
  setPinnedShow6LimitedMetas,
  getEnabledGblLeagues,
  getEnabledShow6Leagues,
  getForcedGblLeagues,
  getForcedShow6Leagues,
  isBattleFrontierCupTitle,
  isCurrentBattleFrontierCup,
  resolveLeagueCpTier,
  matchesTwoTierLeagueFilter,
  getLimitedMetaSheetAliases,
  setLimitedMetaSheetAlias,
  getLeagueCpCap,
  isExpiredLimitedMeta,
  isOldCupForMode,
  syncLimitedMetaRankings,
  fetchPvPokeLimitedMetasFromGitHub
} from './data/gblData';
import {
  BattleQualityMetadata,
  BattleTimelineEvent,
  calculateBattleQuality,
  calculateAggregateWAE,
  migrateExistingBattleLogs,
  reparseAllCompletedBattleLogs,
  resolveLogEntryQuality
} from './data/battleQuality';

import {
  renderGblModeLogo,
  renderBattleFrontierLogo,
  renderTierDots,
  type WebBattleLogEntry,
  type WebAiTrainingLogRecord,
  AI_LOG_RETENTION_MS,
  deriveFirstSwapAndSwitchAdvantageWeb,
  type GblSeasonInfo,
  DEFAULT_SEASONS_FALLBACK,
  type WebAppThemePalette,
  WEB_APP_THEMES,
  renderThemeOverlayIcon
} from './components/AppThemeAndModels';
import { MetaTab } from './components/MetaTab';
import { HelpTab } from './components/HelpTab';
import { MathValidatorTab } from './components/MathValidatorTab';
import { TrashBinModals } from './components/TrashBinModals';
import { DocumentationModals } from './components/DocumentationModals';
import { MarketingWebsite, type MarketingSubpage } from './components/MarketingWebsite';
export type { WebBattleLogEntry, WebAiTrainingLogRecord, GblSeasonInfo, WebAppThemePalette };
export { WEB_APP_THEMES };
export default function App() {
  // Site View Router ('marketing' for Landing Page / Guide / Compare vs 'app' for Web Simulator & Team Builder)
  const [siteView, setSiteView] = useState<'marketing' | 'app'>(() => {
    try {
      const path = window.location.pathname.toLowerCase();
      const params = new URLSearchParams(window.location.search);
      const view = (params.get('view') || '').toLowerCase();
      if (path.endsWith('/app') || view === 'app' || view === 'simulator' || view === 'teams' || view === 'logs') {
        return 'app';
      }
    } catch {}
    return 'marketing';
  });
  const [marketingSubpage, setMarketingSubpage] = useState<MarketingSubpage>(() => {
    try {
      const path = window.location.pathname.toLowerCase();
      const view = (new URLSearchParams(window.location.search).get('view') || '').toLowerCase();
      if (path.endsWith('/guide') || view === 'guide') return 'guide';
      if (path.endsWith('/compare') || view === 'compare') return 'compare';
    } catch {}
    return 'home';
  });

  // Navigation tabs (reordered: Teams, Battle Logs, Settings, Meta, Help, Math Validator)
  const [activeTab, setActiveTab] = useState<'simulator' | 'presets' | 'battle_log' | 'settings' | 'meta' | 'help' | 'math_validator'>('simulator');
  const [validatorLeague, setValidatorLeague] = useState<LeagueType>('GREAT LEAGUE');
  const [validatorSubTab, setValidatorSubTab] = useState<'matrix_cards' | 'form_changes' | 'aegislash_audit' | 'cross_validation'>('matrix_cards');
  const [selectedCardSpecies, setSelectedCardSpecies] = useState<string>('Melmetal');
  const [expandedFormId, setExpandedFormId] = useState<string>('morpeko-forms');

  // v7.00 Web Membership Tier, License Unlock & Cloud Vault Theater State
  const [webMembershipTier, setWebMembershipTier] = useState<'free' | 'supporter' | 'pro' | 'vip'>(() => {
    try {
      const saved = (localStorage.getItem('gbl_web_membership_tier_v700') || 'free').toLowerCase();
      if (saved === 'vip' || saved === 'pro' || saved === 'supporter') return saved;
    } catch {}
    return 'free';
  });
  const [webScreenName, setWebScreenName] = useState<string>(() => {
    try {
      return localStorage.getItem('gbl_web_screen_name_v700') || '';
    } catch {
      return '';
    }
  });
  const [webUnlockKey, setWebUnlockKey] = useState<string>(() => {
    try {
      return localStorage.getItem('gbl_web_unlock_key_v700') || '';
    } catch {
      return '';
    }
  });
  const [webClaimEmail, setWebClaimEmail] = useState<string>(() => {
    try {
      return localStorage.getItem('gbl_web_claim_email_v700') || '';
    } catch {
      return '';
    }
  });
  const [showMembershipModal, setShowMembershipModal] = useState<boolean>(false);
  const [membershipStatusMsg, setMembershipStatusMsg] = useState<string>('');
  const [webAuthTab, setWebAuthTab] = useState<'token' | 'password' | 'github'>('token');
  const [webPassword, setWebPassword] = useState<string>('');
  const [webNewPassword, setWebNewPassword] = useState<string>('');
  const [webSessionToken, setWebSessionToken] = useState<string>(() => {
    try {
      return localStorage.getItem('sspvp_vault_session') || '';
    } catch {
      return '';
    }
  });
  const [webVaultVisibility, setWebVaultVisibility] = useState<
    'public_only' | 'starred_only' | 'starred_and_public' | 'all' | 'none'
  >('public_only');
  const [ghDeviceCodeInfo, setGhDeviceCodeInfo] = useState<{
    device_code: string;
    user_code: string;
    verification_uri: string;
  } | null>(null);
  const ghPollTimerRef = useRef<number | null>(null);
  const lastGhPollMsRef = useRef<number>(0);
  const pendingGhLinkTokenRef = useRef<string>('');

  const CLIENT_INGEST_KEY_PUBLIC = 'ssk_client_v615_telemetry_ingest_9f8a7b6c5d4e3f2a1b0c';

  const handleVerifyWebMembership = async () => {
    const cleanName = webScreenName.trim();
    const cleanKey = webUnlockKey.trim().toUpperCase();
    const cleanEmail = webClaimEmail.trim().toLowerCase();
    const cleanPw = webPassword.trim();
    const cleanGhTok = (localStorage.getItem('gbl_sync_github_token') || '').trim();
    if (!cleanName && webAuthTab !== 'github') {
      setMembershipStatusMsg('⚠️ Enter your Trainer Screen Name first.');
      return;
    }
    if (webAuthTab === 'token' && !cleanKey && !cleanEmail) {
      setMembershipStatusMsg('⚠️ Enter your SSPVP Unlock Key or Checkout Email.');
      return;
    }
    if (webAuthTab === 'password' && !cleanPw) {
      setMembershipStatusMsg('⚠️ Enter your Vault Password.');
      return;
    }
    if (webAuthTab === 'github' && !cleanGhTok) {
      await handleStartWebGitHubLogin();
      return;
    }
    setMembershipStatusMsg('⏳ Authenticating with SilphScope Cloud Vault...');
    try {
      const resp = await fetch('https://api.silphscopepvp.com/v1/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-SilphScope-Client-Key': CLIENT_INGEST_KEY_PUBLIC,
          'X-Trainer-Screen-Name': cleanName || 'sportsfan986'
        },
        body: JSON.stringify({
          screenName: cleanName,
          unlockKey: webAuthTab === 'token' ? cleanKey : '',
          claimEmail: webAuthTab === 'token' ? cleanEmail : '',
          password: webAuthTab === 'password' ? cleanPw : '',
          githubToken: webAuthTab === 'github' ? cleanGhTok : '',
          pendingGhLinkToken: pendingGhLinkTokenRef.current || '',
          deviceHash: 'web-' + (cleanName || 'browser')
        })
      });
      const data = await resp.json();
      if (data && data.ok) {
        pendingGhLinkTokenRef.current = '';
        const t = String(data.tier || 'free').toLowerCase() as 'free' | 'supporter' | 'pro' | 'vip';
        setWebMembershipTier(t);
        if (data.screenName) setWebScreenName(data.screenName);
        localStorage.setItem('gbl_web_membership_tier_v700', t);
        localStorage.setItem('gbl_web_screen_name_v700', data.screenName || cleanName);
        if (data.sessionToken) {
          setWebSessionToken(data.sessionToken);
          localStorage.setItem('sspvp_vault_session', data.sessionToken);
        }
        if (cleanKey) {
          setWebUnlockKey(cleanKey);
          localStorage.setItem('gbl_web_unlock_key_v700', cleanKey);
        }
        if (data.settings?.publicVisibility) {
          setWebVaultVisibility(data.settings.publicVisibility);
        }
        setMembershipStatusMsg(
          `✅ Signed in as @${data.screenName || cleanName} (${t.toUpperCase()} Tier)${data.githubUsername ? ` • GitHub: @${data.githubUsername}` : ''}!`
        );
      } else {
        setMembershipStatusMsg(`❌ ${data?.error || 'Authentication failed. Check your credentials.'}`);
      }
    } catch (e: any) {
      setMembershipStatusMsg(`⚠️ Network error: ${e?.message || 'offline'}`);
    }
  };

  const pollWebGitHubDeviceNow = async (deviceCode: string, isManualClick = false, delayMs = 6500) => {
    if (!deviceCode) return;
    const now = Date.now();
    if (!isManualClick && now - lastGhPollMsRef.current < 5200) return;
    lastGhPollMsRef.current = now;
    if (isManualClick) {
      setMembershipStatusMsg('🔄 Checking GitHub authorization status...');
    }
    try {
      const pollResp = await fetch('https://api.silphscopepvp.com/v1/auth/github/poll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-SilphScope-Client-Key': CLIENT_INGEST_KEY_PUBLIC },
        body: JSON.stringify({
          device_code: deviceCode,
          screenName: webScreenName.trim(),
          unlockKey: webUnlockKey.trim().toUpperCase()
        })
      });
      const pollData = await pollResp.json();
      if (pollData.status === 'pending') {
        const nextDelay =
          pollData.slowDown || pollData.interval
            ? (Math.max(10, Number(pollData.interval) || 10) + 2) * 1000
            : delayMs;
        if (isManualClick) {
          setMembershipStatusMsg(
            '⏳ Still waiting for GitHub authorization. Click "Authorize" in the GitHub tab, wait 5s, and click Finish Sign-In again.'
          );
        }
        if (ghPollTimerRef.current) window.clearTimeout(ghPollTimerRef.current);
        ghPollTimerRef.current = window.setTimeout(
          () => pollWebGitHubDeviceNow(deviceCode, false, nextDelay),
          nextDelay
        );
        return;
      }
      if (ghPollTimerRef.current) window.clearTimeout(ghPollTimerRef.current);
      ghPollTimerRef.current = null;
      setGhDeviceCodeInfo(null);
      if (pollData.ok && pollData.sessionToken) {
        pendingGhLinkTokenRef.current = '';
        const t = String(pollData.tier || 'free').toLowerCase() as 'free' | 'supporter' | 'pro' | 'vip';
        setWebMembershipTier(t);
        setWebScreenName(pollData.screenName || webScreenName);
        setWebSessionToken(pollData.sessionToken);
        localStorage.setItem('gbl_web_membership_tier_v700', t);
        localStorage.setItem('gbl_web_screen_name_v700', pollData.screenName || webScreenName);
        localStorage.setItem('sspvp_vault_session', pollData.sessionToken);
        setMembershipStatusMsg(
          `✅ Signed in via GitHub (@${pollData.githubUsername}) -> Trainer @${pollData.screenName} (${t.toUpperCase()})!`
        );
      } else {
        if (pollData.pendingGhLinkToken) {
          pendingGhLinkTokenRef.current = String(pollData.pendingGhLinkToken);
        }
        setMembershipStatusMsg(`❌ ${pollData.error || 'GitHub login did not match an account.'}`);
      }
    } catch {
      if (ghPollTimerRef.current) window.clearTimeout(ghPollTimerRef.current);
      ghPollTimerRef.current = window.setTimeout(
        () => pollWebGitHubDeviceNow(deviceCode, false, delayMs),
        delayMs
      );
    }
  };

  const handleStartWebGitHubLogin = async () => {
    setMembershipStatusMsg('⏳ Requesting GitHub OAuth Device Code...');
    if (ghPollTimerRef.current) window.clearTimeout(ghPollTimerRef.current);
    try {
      const resp = await fetch('https://api.silphscopepvp.com/v1/auth/github/device-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-SilphScope-Client-Key': CLIENT_INGEST_KEY_PUBLIC }
      });
      const data = await resp.json();
      if (!resp.ok || !data.ok) {
        setMembershipStatusMsg(`❌ ${data?.error || 'Failed to start GitHub login.'}`);
        return;
      }
      const codeInfo = {
        device_code: data.device_code,
        user_code: data.user_code,
        verification_uri: data.verification_uri
      };
      setGhDeviceCodeInfo(codeInfo);
      try {
        navigator.clipboard.writeText(data.user_code);
      } catch {}
      window.open(data.verification_uri, '_blank', 'noopener');
      setMembershipStatusMsg(
        `🐙 Enter code ${data.user_code} on GitHub (copied to clipboard). Auto-unlocks when you return!`
      );

      const initialDelayMs = (Math.max(5, Number(data.interval) || 5) + 1.5) * 1000;
      lastGhPollMsRef.current = Date.now();
      ghPollTimerRef.current = window.setTimeout(
        () => pollWebGitHubDeviceNow(data.device_code, false, initialDelayMs),
        initialDelayMs
      );
    } catch (e: any) {
      setMembershipStatusMsg(`⚠️ Error starting GitHub login: ${e?.message || 'offline'}`);
    }
  };

  const handleSaveWebPassword = async () => {
    const cleanName = webScreenName.trim();
    const newPw = webNewPassword.trim();
    if (!cleanName || newPw.length < 8) {
      setMembershipStatusMsg('⚠️ Enter your Trainer ID and a new password of at least 8 characters.');
      return;
    }
    try {
      const resp = await fetch('https://api.silphscopepvp.com/v1/auth/set-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-SilphScope-Client-Key': CLIENT_INGEST_KEY_PUBLIC,
          'X-Trainer-Screen-Name': cleanName,
          'X-Vault-Session': webSessionToken,
          'X-SilphScope-Unlock-Key': webUnlockKey.trim().toUpperCase()
        },
        body: JSON.stringify({
          screenName: cleanName,
          newPassword: newPw,
          sessionToken: webSessionToken,
          unlockKey: webUnlockKey.trim().toUpperCase()
        })
      });
      const data = await resp.json();
      if (resp.ok && data.ok) {
        if (data.sessionToken) {
          setWebSessionToken(data.sessionToken);
          localStorage.setItem('sspvp_vault_session', data.sessionToken);
        }
        setWebNewPassword('');
        setMembershipStatusMsg(`✅ Password saved for @${cleanName}! You can now sign in with Username + Password anywhere.`);
      } else {
        setMembershipStatusMsg(`❌ ${data?.error || 'Failed to save password.'}`);
      }
    } catch (e: any) {
      setMembershipStatusMsg(`⚠️ Error saving password: ${e?.message || 'offline'}`);
    }
  };

  const handleUpdateWebVaultVisibility = async (
    vis: 'public_only' | 'starred_only' | 'starred_and_public' | 'all' | 'none'
  ) => {
    setWebVaultVisibility(vis);
    const cleanName = webScreenName.trim();
    if (!cleanName) return;
    try {
      const resp = await fetch('https://api.silphscopepvp.com/v1/replays/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-SilphScope-Client-Key': CLIENT_INGEST_KEY_PUBLIC,
          'X-Trainer-Screen-Name': cleanName,
          'X-Vault-Session': webSessionToken,
          'X-SilphScope-Unlock-Key': webUnlockKey.trim().toUpperCase()
        },
        body: JSON.stringify({
          publicVisibility: vis,
          sessionToken: webSessionToken,
          unlockKey: webUnlockKey.trim().toUpperCase()
        })
      });
      const data = await resp.json();
      if (resp.ok && data.ok) {
        const label =
          vis === 'public_only'
            ? '🔒 Private (Only Shows Videos Made Public)'
            : vis === 'starred_only'
            ? '⭐ Starred Only'
            : vis === 'starred_and_public'
            ? '⭐+🌐 Starred + Private (Starred or Made Public)'
            : vis === 'all'
            ? '🌐 All Videos Shared (Overrides Per-Video Private)'
            : '🚫 No Videos Shared Without Login';
        setMembershipStatusMsg(`✅ Updated @${cleanName}'s DVR Vault visibility to: ${label}`);
      }
    } catch {}
  };

  // v6.00 AI Advice HUD Position ("bottom" default for higher visibility vs "top")
  const [aiAdviceHudPosition, setAiAdviceHudPositionState] = useState<'bottom' | 'top'>(() => {
    try {
      return localStorage.getItem('gbl_ai_advice_hud_position') === 'top' ? 'top' : 'bottom';
    } catch {
      return 'bottom';
    }
  });
  const handleSetAiAdviceHudPosition = (pos: 'bottom' | 'top') => {
    setAiAdviceHudPositionState(pos);
    try {
      localStorage.setItem('gbl_ai_advice_hud_position', pos);
    } catch {}
  };

  // Overlay HUD Mode ("full" default vs "compact") & 3x3 Matchup Matrix Visibility in Compact HUD
  const [overlayHudMode, setOverlayHudModeState] = useState<'full' | 'compact'>(() => {
    try {
      return localStorage.getItem('gbl_overlay_hud_mode') === 'compact' ? 'compact' : 'full';
    } catch {
      return 'full';
    }
  });
  const handleSetOverlayHudMode = (mode: 'full' | 'compact') => {
    setOverlayHudModeState(mode);
    try {
      localStorage.setItem('gbl_overlay_hud_mode', mode);
    } catch {}
  };

  const [compactHudShowMatrix, setCompactHudShowMatrixState] = useState<boolean>(() => {
    try {
      return localStorage.getItem('gbl_compact_hud_show_matrix') === 'true';
    } catch {
      return false;
    }
  });
  const handleSetCompactHudShowMatrix = (show: boolean) => {
    setCompactHudShowMatrixState(show);
    try {
      localStorage.setItem('gbl_compact_hud_show_matrix', String(show));
    } catch {}
  };

  // v6.00 📊 Meta Tab State (Mode-Independent League Selectors, Scope Toggle & Collapsible Drawer Default Collapsed)
  const [metaTabGblLeague, setMetaTabGblLeague] = useState<LeagueType>(() => {
    try {
      return (localStorage.getItem('gbl_meta_tab_league_gbl') as LeagueType) || 'GREAT LEAGUE';
    } catch {
      return 'GREAT LEAGUE';
    }
  });
  const [metaTabShow6League, setMetaTabShow6League] = useState<LeagueType>(() => {
    try {
      return (localStorage.getItem('gbl_meta_tab_league_show6') as LeagueType) || 'Battle Frontier (Spectral)';
    } catch {
      return 'Battle Frontier (Spectral)';
    }
  });
  const [metaTabScope, setMetaTabScope] = useState<'season' | 'last25' | 'last50'>('season');
  const [isMetaSettingsOpen, setIsMetaSettingsOpen] = useState<boolean>(false);
  const [gblLogWeightCapPct, setGblLogWeightCapPct] = useState<number>(() => {
    try {
      const saved = Number(localStorage.getItem('gbl_meta_log_weight_cap_pct'));
      if (!Number.isNaN(saved) && saved >= 0 && saved <= 100) return saved;
    } catch {}
    return 70;
  });
  const [gblRecencyDecay, setGblRecencyDecay] = useState<0.02 | 0.04 | 0.07>(() => {
    try {
      const saved = Number(localStorage.getItem('gbl_meta_recency_decay_lambda'));
      if (saved === 0.02 || saved === 0.04 || saved === 0.07) return saved;
    } catch {}
    return 0.04;
  });
  const [show6RecencyDecay, setShow6RecencyDecay] = useState<0.02 | 0.04 | 0.07>(() => {
    try {
      const saved = Number(localStorage.getItem('gbl_show6_recency_decay_lambda'));
      if (saved === 0.02 || saved === 0.04 || saved === 0.07) return saved;
    } catch {}
    return 0.04;
  });
  // v6.01 GBL Blind 3 Limited Cup Same-CP Standard League Blending (Default: 50% fade start weight & Fast 0.10 decay)
  const [limitedStdBlendPctGbl, setLimitedStdBlendPctGbl] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('gbl_limited_std_blend_pct_gbl_v601');
      if (saved !== null) {
        const n = Number(saved);
        if (!Number.isNaN(n) && n >= 0 && n <= 100) return n;
      }
    } catch {}
    return 50;
  });
  const [limitedStdDecayGbl, setLimitedStdDecayGbl] = useState<0.03 | 0.06 | 0.10>(() => {
    try {
      const saved = Number(localStorage.getItem('gbl_limited_std_decay_gbl_v601'));
      if (saved === 0.03 || saved === 0.06 || saved === 0.10) return saved;
    } catch {}
    return 0.10;
  });
  const [limitedStdBlendPctShow6, setLimitedStdBlendPctShow6] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('gbl_limited_std_blend_pct_show6');
      if (saved !== null) {
        const n = Number(saved);
        if (!Number.isNaN(n) && n >= 0 && n <= 100) return n;
      }
    } catch {}
    return 25;
  });
  const [limitedStdDecayShow6, setLimitedStdDecayShow6] = useState<0.03 | 0.06 | 0.10>(() => {
    try {
      const saved = Number(localStorage.getItem('gbl_limited_std_decay_show6'));
      if (saved === 0.03 || saved === 0.06 || saved === 0.10) return saved;
    } catch {}
    return 0.06;
  });

  // Anti-Meta Team Builder State (Team Presets Page: 0, 1, or 2 Featured Pokémon + League -> 5 ABB & 5 ABC Teams)
  const [showAntiMetaBuilder, setShowAntiMetaBuilder] = useState<boolean>(true);
  const [antiMetaLeague, setAntiMetaLeague] = useState<LeagueType>('GREAT LEAGUE');
  const [antiMetaFeat1, setAntiMetaFeat1] = useState<string>('');
  const [antiMetaFeat2, setAntiMetaFeat2] = useState<string>('');
  const [antiMetaDropdownSlot, setAntiMetaDropdownSlot] = useState<1 | 2 | null>(null);
  const [antiMetaResult, setAntiMetaResult] = useState<AntiMetaTeamBuilderResult | null>(null);
  const [isGeneratingAntiMeta, setIsGeneratingAntiMeta] = useState<boolean>(false);

  // Floating Overlay Visibility & Minimized Bubble State
  const [isOverlayVisible, setIsOverlayVisible] = useState(true);
  const [isOverlayMinimized, setIsOverlayMinimized] = useState(false);

  // PvPoke Gamemaster + League Rankings Sync State
  const [isSyncingPvPoke, setIsSyncingPvPoke] = useState(false);
  const [pvPokeSyncStatus, setPvPokeSyncStatus] = useState<string>('Syncing GameMaster & 4 League Rankings...');
  const [lastSyncedAt, setLastSyncedAt] = useState<string>(() => {
    try {
      return localStorage.getItem('gbl_last_sync_timestamp') || 'Not synced yet';
    } catch {
      return 'Not synced yet';
    }
  });
  const [dbTelemetry, setDbTelemetry] = useState(() => getPvPokeDatabaseTelemetry());

  // Drag-and-drop state for rearranging Team Presets
  const [draggedPresetIndex, setDraggedPresetIndex] = useState<number | null>(null);
  const [dragOverPresetIndex, setDragOverPresetIndex] = useState<number | null>(null);

  // Autocomplete pop-down state for Team Builder UI slots (1, 2, 3)
  const [activeAutocompleteSlot, setActiveAutocompleteSlot] = useState<1 | 2 | 3 | null>(null);
  const [autocompleteHighlightIdx, setAutocompleteHighlightIdx] = useState<number>(0);

  // App Setting (Not in Overlay): Opponent Fast Move Count Basis ("my_fasts" default vs "opp_fasts")
  const [oppCountMode, setOppCountMode] = useState<OppCountMode>(() => {
    try {
      const saved = localStorage.getItem('gbl_opp_count_mode');
      return saved === 'opp_fasts' ? 'opp_fasts' : 'my_fasts';
    } catch {
      return 'my_fasts';
    }
  });

  const handleSetOppCountMode = (mode: OppCountMode) => {
    setOppCountMode(mode);
    try {
      localStorage.setItem('gbl_opp_count_mode', mode);
    } catch {}
  };

  // App Setting: Enable 4 Charged Moves in Overlay (Default: false -> 3 moves)
  const [enable4ChargedMoves, setEnable4ChargedMoves] = useState<boolean>(() => {
    try {
      return localStorage.getItem('gbl_enable_4_charged_moves') === 'true';
    } catch {
      return false;
    }
  });

  const handleSetEnable4ChargedMoves = (enabled: boolean) => {
    setEnable4ChargedMoves(enabled);
    try {
      localStorage.setItem('gbl_enable_4_charged_moves', String(enabled));
    } catch {}
  };

  // App Setting: Disable Battle Toast Messages (Default: false -> Toasts Enabled)
  const [disableBattleToasts, setDisableBattleToasts] = useState<boolean>(() => {
    try {
      return localStorage.getItem('gbl_disable_battle_toasts') === 'true';
    } catch {
      return false;
    }
  });

  const handleSetDisableBattleToasts = (disabled: boolean) => {
    setDisableBattleToasts(disabled);
    try {
      localStorage.setItem('gbl_disable_battle_toasts', String(disabled));
    } catch {}
  };

  // App Setting: Show Lead & Swap Tactical Recommendations GUI Row in Overlay (Default: true -> Enabled)
  const [showTacticalRec, setShowTacticalRec] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('gbl_show_tactical_rec');
      return saved === null ? true : saved !== 'false';
    } catch {
      return true;
    }
  });

  const handleSetShowTacticalRec = (show: boolean) => {
    setShowTacticalRec(show);
    try {
      localStorage.setItem('gbl_show_tactical_rec', String(show));
    } catch {}
  };

  // v6.02 One-Time Optimal Scanner Defaults Migration (HP = ON, Energy = ON, 2 Samples, ±2% Tol, 200ms Lead, +1t Offset, Strict Alt Fast, 8% Chip Tol, 4.0s Swap Rollback)
  const [enableHpTracking, setEnableHpTracking] = useState<boolean>(() => {
    try {
      const migrated602 = localStorage.getItem('gbl_v602_scanner_defaults_migrated') === 'true';
      if (!migrated602) {
        localStorage.setItem('gbl_v602_scanner_defaults_migrated', 'true');
        localStorage.setItem('gbl_installed_version_code', '1602');
        localStorage.setItem('gbl_enable_hp_tracking', 'true');
        localStorage.setItem('gbl_enable_energy_tracking', 'true');
        localStorage.setItem('gbl_hp_debounce_samples', '2');
        localStorage.setItem('gbl_energy_debounce_samples', '2');
        localStorage.setItem('gbl_proactive_energy_lead_ms', '200');
        localStorage.setItem('gbl_fast_detect_turn_offset', '1');
        localStorage.setItem('gbl_alt_fast_detect_strictness', 'strict');
        localStorage.setItem('gbl_shield_chip_tolerance_pct', '8');
        localStorage.setItem('gbl_swap_throw_rollback_window_ms', '4000');
        return true;
      }
      const saved = localStorage.getItem('gbl_enable_hp_tracking');
      return saved === null ? true : saved === 'true';
    } catch {
      return true;
    }
  });

  const handleSetEnableHpTracking = (enabled: boolean) => {
    setEnableHpTracking(enabled);
    try {
      localStorage.setItem('gbl_enable_hp_tracking', String(enabled));
    } catch {}
  };

  const [enableEnergyTracking, setEnableEnergyTracking] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('gbl_enable_energy_tracking');
      return saved === null ? true : saved === 'true';
    } catch {
      return true;
    }
  });

  const handleSetEnableEnergyTracking = (enabled: boolean) => {
    setEnableEnergyTracking(enabled);
    try {
      localStorage.setItem('gbl_enable_energy_tracking', String(enabled));
    } catch {}
  };

  // v3.89 Settings: Independent HP Bar Meter Debounce (2..4 matching samples, ±2% HP tolerance)
  const [hpDebounceSamples, setHpDebounceSamples] = useState<2 | 3 | 4>(() => {
    try {
      const saved = Number(localStorage.getItem('gbl_hp_debounce_samples'));
      if (saved === 2 || saved === 3 || saved === 4) return saved;
    } catch {}
    return 2;
  });

  const updateHpDebounceSamples = (samples: 2 | 3 | 4) => {
    setHpDebounceSamples(samples);
    try {
      localStorage.setItem('gbl_hp_debounce_samples', String(samples));
    } catch {}
  };

  // v3.86 Settings: Low-Latency Energy Meter Debounce (2..4 matching samples, ±2% circle fill tolerance) & Live Energy Update Toasts
  const [energyDebounceSamples, setEnergyDebounceSamples] = useState<2 | 3 | 4>(() => {
    try {
      const saved = Number(localStorage.getItem('gbl_energy_debounce_samples'));
      if (saved === 2 || saved === 3 || saved === 4) return saved;
    } catch {}
    return 2;
  });

  const updateEnergyDebounceSamples = (samples: 2 | 3 | 4) => {
    setEnergyDebounceSamples(samples);
    try {
      localStorage.setItem('gbl_energy_debounce_samples', String(samples));
    } catch {}
  };

  // v6.02 Settings: Proactive Fast-Move Energy Lead Time (0ms Off, 200ms Default, 300ms, 400ms) with >500ms 1-Turn Lag Rollback
  const [proactiveEnergyLeadMs, setProactiveEnergyLeadMs] = useState<0 | 200 | 300 | 400>(() => {
    try {
      const saved = localStorage.getItem('gbl_proactive_energy_lead_ms');
      if (saved !== null) {
        const num = Number(saved);
        if (num === 0 || num === 200 || num === 300 || num === 400) return num;
      }
    } catch {}
    return 200;
  });

  const updateProactiveEnergyLeadMs = (leadMs: 0 | 200 | 300 | 400) => {
    setProactiveEnergyLeadMs(leadMs);
    try {
      localStorage.setItem('gbl_proactive_energy_lead_ms', String(leadMs));
    } catch {}
  };

  const [energyUpdateToasts, setEnergyUpdateToasts] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('gbl_energy_update_toasts');
      if (saved !== null) return saved === 'true';
    } catch {}
    return true;
  });

  const toggleEnergyUpdateToasts = () => {
    setEnergyUpdateToasts((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('gbl_energy_update_toasts', String(next));
      } catch {}
      return next;
    });
  };

  const [fastDetectTurnOffset, setFastDetectTurnOffset] = useState<0 | 1 | 2 | 3>(() => {
    try {
      const saved = localStorage.getItem('gbl_fast_detect_turn_offset');
      if (saved !== null) {
        const num = Number(saved);
        if (num === 0 || num === 1 || num === 2 || num === 3) return num;
      }
    } catch {}
    return 1;
  });

  const handleSetFastDetectTurnOffset = (offset: 0 | 1 | 2 | 3) => {
    setFastDetectTurnOffset(offset);
    try {
      localStorage.setItem('gbl_fast_detect_turn_offset', String(offset));
    } catch {}
  };

  // v6.02 New Scanner Tuning Controls: Alt Fast Strictness, Pre-Zoom Shield Chip Tolerance, Swap-Throw Rollback Window
  const [altFastDetectStrictness, setAltFastDetectStrictness] = useState<'strict' | 'balanced' | 'aggressive'>(() => {
    try {
      const saved = localStorage.getItem('gbl_alt_fast_detect_strictness');
      if (saved === 'strict' || saved === 'balanced' || saved === 'aggressive') return saved;
    } catch {}
    return 'strict';
  });

  const handleSetAltFastDetectStrictness = (mode: 'strict' | 'balanced' | 'aggressive') => {
    setAltFastDetectStrictness(mode);
    try {
      localStorage.setItem('gbl_alt_fast_detect_strictness', mode);
    } catch {}
  };

  const [shieldChipTolerancePct, setShieldChipTolerancePct] = useState<3 | 6 | 8 | 10>(() => {
    try {
      const saved = Number(localStorage.getItem('gbl_shield_chip_tolerance_pct'));
      if (saved === 3 || saved === 6 || saved === 8 || saved === 10) return saved;
    } catch {}
    return 8;
  });

  const handleSetShieldChipTolerancePct = (tol: 3 | 6 | 8 | 10) => {
    setShieldChipTolerancePct(tol);
    try {
      localStorage.setItem('gbl_shield_chip_tolerance_pct', String(tol));
    } catch {}
  };

  const [swapThrowRollbackWindowMs, setSwapThrowRollbackWindowMs] = useState<0 | 3000 | 4000 | 5000>(() => {
    try {
      const saved = localStorage.getItem('gbl_swap_throw_rollback_window_ms');
      if (saved !== null) {
        const num = Number(saved);
        if (num === 0 || num === 3000 || num === 4000 || num === 5000) return num;
      }
    } catch {}
    return 4000;
  });

  // v6.06: Haptics & Tactical Vibration Alerts (Synchronized with Swap Clock & Charged Move Blink Indicators)
  const [hapticMasterEnabled, setHapticMasterEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('gbl_haptic_master_enabled');
      if (saved !== null) return saved === 'true';
    } catch {}
    return true;
  });
  const [hapticOppSwapEnabled, setHapticOppSwapEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('gbl_haptic_opp_swap_enabled');
      if (saved !== null) return saved === 'true';
    } catch {}
    return true;
  });
  const [hapticOppSwapWarnSec, setHapticOppSwapWarnSec] = useState<number>(() => {
    try {
      const saved = Number(localStorage.getItem('gbl_haptic_opp_swap_warn_sec'));
      if (saved >= 2 && saved <= 10) return saved;
    } catch {}
    return 5;
  });
  const [hapticOppChargeWarnEnabled, setHapticOppChargeWarnEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('gbl_haptic_opp_charge_warn_enabled');
      if (saved !== null) return saved === 'true';
    } catch {}
    return true;
  });
  const [hapticChargeTimingFasts, setHapticChargeTimingFasts] = useState<1 | 2>(() => {
    try {
      const saved = Number(localStorage.getItem('gbl_haptic_charge_timing_fasts'));
      if (saved === 1 || saved === 2) return saved;
    } catch {}
    return 1;
  });

  const triggerWebSinglePulse = () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(80);
      }
    } catch {}
  };

  const triggerWebDoublePulse = () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([80, 80, 80]);
      }
    } catch {}
  };

  const handleSetSwapThrowRollbackWindowMs = (winMs: 0 | 3000 | 4000 | 5000) => {
    setSwapThrowRollbackWindowMs(winMs);
    try {
      localStorage.setItem('gbl_swap_throw_rollback_window_ms', String(winMs));
    } catch {}
  };

  // v3.80 Simulator Interactive State: Opponent Fast Move Confirmation Status & Confirmed Used Opponent Charged Moves
  const [simOppFastMoveStatus, setSimOppFastMoveStatus] = useState<'unconfirmed' | 'confirmed_standard' | 'confirmed_non_standard'>('unconfirmed');
  const [simConfirmedOppMoves, setSimConfirmedOppMoves] = useState<string[]>([]);

  const minimizeHoldTimerRef = useRef<number | null>(null);
  const minimizeHoldTriggeredRef = useRef<boolean>(false);

  const [showArchetypePlaybook, setShowArchetypePlaybook] = useState<boolean>(false);

  // App-Level Setting: Overlay Screen Width Scale (50% - 100%, Default 78%, step 2%)
  const [overlayScalePct, setOverlayScalePct] = useState<number>(() => {
    try {
      const saved = Number(localStorage.getItem('gbl_overlay_scale_pct'));
      if (!Number.isNaN(saved) && saved >= 50 && saved <= 100) {
        return Math.round(saved / 2) * 2;
      }
    } catch {}
    return 78;
  });

  const handleSetOverlayScalePct = (pct: number) => {
    const clamped = Math.max(50, Math.min(100, Math.round(pct / 2) * 2));
    setOverlayScalePct(clamped);
    try {
      localStorage.setItem('gbl_overlay_scale_pct', String(clamped));
    } catch {}
  };

  // App-Level Setting: Overlay Background Transparency (0% - 100%, Default 50%, step 2%)
  const [overlayTransparencyPct, setOverlayTransparencyPct] = useState<number>(() => {
    try {
      const migrated = localStorage.getItem('gbl_v702_overlay_transparency_50_migrated');
      const saved = localStorage.getItem('gbl_overlay_transparency_pct');
      if (!migrated) {
        localStorage.setItem('gbl_v702_overlay_transparency_50_migrated', '1');
        if (saved === null || saved === '72') {
          localStorage.setItem('gbl_overlay_transparency_pct', '50');
          return 50;
        }
      }
      if (saved !== null) {
        const num = Number(saved);
        if (!Number.isNaN(num) && num >= 0 && num <= 100) {
          return Math.round(num / 2) * 2;
        }
      }
    } catch {}
    return 50;
  });

  const handleSetOverlayTransparencyPct = (pct: number) => {
    const clamped = Math.max(0, Math.min(100, Math.round(pct / 2) * 2));
    setOverlayTransparencyPct(clamped);
    try {
      localStorage.setItem('gbl_overlay_transparency_pct', String(clamped));
    } catch {}
  };

  // App-Level Setting: App & Overlay Theme + Background Emblem Watermark (v3.06)
  const [appThemeId, setAppThemeId] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('gbl_app_theme_id');
      if (saved === 'amoled_cyan' || saved === 'amoled_matrix') return 'dialga_shiny_midnight';
      if (saved === 'sylveon_light') return 'sylveon_pink';
      if (saved && WEB_APP_THEMES.some((t) => t.id === saved)) return saved;
    } catch {}
    return 'dialga_shiny_midnight';
  });

  const handleSetAppThemeId = (themeId: string) => {
    setAppThemeId(themeId);
    try {
      localStorage.setItem('gbl_app_theme_id', themeId);
    } catch {}
  };

  const [showThemeWatermark, setShowThemeWatermark] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('gbl_show_theme_watermark');
      return saved === null ? true : saved === 'true';
    } catch {
      return true;
    }
  });

  const handleSetShowThemeWatermark = (show: boolean) => {
    setShowThemeWatermark(show);
    try {
      localStorage.setItem('gbl_show_theme_watermark', String(show));
    } catch {}
  };

  const activeTheme = useMemo(
    () => WEB_APP_THEMES.find((t) => t.id === appThemeId) || WEB_APP_THEMES[0],
    [appThemeId]
  );

  // Provisioned Battle Log State (Page 3) + Tombstones + Seasons + 2-Device Sync
  const [deviceId] = useState<string>(() => {
    try {
      const existing = localStorage.getItem('gbl_sync_device_id');
      if (existing) return existing;
      const created = 'web-' + Math.random().toString(36).substring(2, 10);
      localStorage.setItem('gbl_sync_device_id', created);
      return created;
    } catch {
      return 'web-local';
    }
  });

  // v5.00 App Combat Mode: Standard GBL (Blind 3 PvP) vs Show 6 (Battle Frontier / Pick-3)
  const [appCombatMode, setAppCombatModeState] = useState<AppCombatMode>(() => {
    try {
      return localStorage.getItem('gbl_app_combat_mode') === 'show6' ? 'show6' : 'gbl';
    } catch {
      return 'gbl';
    }
  });

  const handleSetAppCombatMode = (mode: AppCombatMode) => {
    setAppCombatModeState(mode);
    try {
      localStorage.setItem('gbl_app_combat_mode', mode);
    } catch {}
    if (mode === 'show6') {
      if (!isShow6EligibleLeague(antiMetaLeague)) {
        setAntiMetaLeague('Battle Frontier (Spectral)');
      }
      if (selectedOpponentLeague !== 'AUTO' && !isShow6EligibleLeague(selectedOpponentLeague)) {
        setSelectedOpponentLeague('AUTO');
      }
    } else {
      if (isBattleFrontierLeague(antiMetaLeague)) {
        setAntiMetaLeague('GREAT LEAGUE');
      }
      if (selectedOpponentLeague !== 'AUTO' && isBattleFrontierLeague(selectedOpponentLeague)) {
        setSelectedOpponentLeague('AUTO');
      }
    }
    setActiveTeamsCpTierFilter('ALL');
    setActiveTeamsLeagueFilter('ALL');
    setLogFilterCpTier('ALL');
    setLogFilterLeague('ALL LEAGUES');
    setStartBattleToast(
      mode === 'show6'
        ? '🏛️ Switched to Show 6 Mode (Spectral / Cauldron / Master • Independent Teams, Trash & Battle Logs)'
        : '🛡️ Switched to Standard GBL Mode (Blind 3 PvP • Independent Teams, Trash & Battle Logs)'
    );
    setTimeout(() => setStartBattleToast(null), 2200);
  };

  // Independent Battle Logs: Standard GBL ('gbl_battle_logs_v1') vs Show 6 ('gbl_show6_battle_logs_v1')
  const [gblBattleLogs, setGblBattleLogs] = useState<WebBattleLogEntry[]>(() => {
    try {
      const raw = localStorage.getItem('gbl_battle_logs_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  });

  const [show6BattleLogs, setShow6BattleLogs] = useState<WebBattleLogEntry[]>(() => {
    try {
      const raw = localStorage.getItem('gbl_show6_battle_logs_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  });

  const battleLogs = appCombatMode === 'show6' ? show6BattleLogs : gblBattleLogs;
  const setBattleLogs: React.Dispatch<React.SetStateAction<WebBattleLogEntry[]>> =
    appCombatMode === 'show6' ? setShow6BattleLogs : setGblBattleLogs;
  const activeBattleLogStorageKey =
    appCombatMode === 'show6' ? 'gbl_show6_battle_logs_v1' : 'gbl_battle_logs_v1';

  const [aiTrainingLogs, setAiTrainingLogs] = useState<WebAiTrainingLogRecord[]>(() => {
    try {
      const raw = localStorage.getItem('gbl_ai_training_logs_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const cutoff = Date.now() - AI_LOG_RETENTION_MS;
          return parsed.filter((item: WebAiTrainingLogRecord) => item && item.timestampMs >= cutoff);
        }
      }
    } catch {}
    return [];
  });

  const [deletedLogIds, setDeletedLogIds] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem('gbl_deleted_log_ids_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  });

  const [deletedTeamIds, setDeletedTeamIds] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem('gbl_deleted_team_ids_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  });

  const [gblDeletedBattlesTrash, setGblDeletedBattlesTrash] = useState<WebBattleLogEntry[]>(() => {
    try {
      const raw = localStorage.getItem('gbl_deleted_battles_trash_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  });

  const [show6DeletedBattlesTrash, setShow6DeletedBattlesTrash] = useState<WebBattleLogEntry[]>(() => {
    try {
      const raw = localStorage.getItem('gbl_show6_deleted_battles_trash_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  });

  const deletedBattlesTrash = appCombatMode === 'show6' ? show6DeletedBattlesTrash : gblDeletedBattlesTrash;
  const activeDeletedBattlesTrashStorageKey =
    appCombatMode === 'show6' ? 'gbl_show6_deleted_battles_trash_v1' : 'gbl_deleted_battles_trash_v1';

  const [gblDeletedTeamsTrash, setGblDeletedTeamsTrash] = useState<TeamPreset[]>(() => {
    try {
      const raw = localStorage.getItem('gbl_deleted_teams_trash_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  });

  const [show6DeletedTeamsTrash, setShow6DeletedTeamsTrash] = useState<TeamPreset[]>(() => {
    try {
      const raw = localStorage.getItem('gbl_show6_deleted_teams_trash_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  });

  const deletedTeamsTrash = appCombatMode === 'show6' ? show6DeletedTeamsTrash : gblDeletedTeamsTrash;

  const [show6DeletedRostersTrash, setShow6DeletedRostersTrash] = useState<
    Array<{ target: 'MY' | 'OPP'; roster: Show6RosterOf6Preset }>
  >(() => {
    try {
      const raw = localStorage.getItem('gbl_show6_deleted_rosters_trash_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  });

  const [showBattlesTrashModal, setShowBattlesTrashModal] = useState<boolean>(false);
  const [showTeamsTrashModal, setShowTeamsTrashModal] = useState<boolean>(false);
  const [undoBanner, setUndoBanner] = useState<{ message: string; onUndo: () => void } | null>(null);
  const [exportFormatMode, setExportFormatMode] = useState<'GO_BATTLE_LOG' | 'STANDARD'>('GO_BATTLE_LOG');
  const [tierThresholds, setTierThresholds] = useState<MatchupTierThresholds>(() => getStoredMatchupTierThresholds());
  const [machineBrThresholds, setMachineBrThresholds] = useState<MachineBrThresholds>(() => getStoredMachineBrThresholds());

  const updateTierThresholds = (next: MatchupTierThresholds) => {
    setTierThresholds(next);
    try {
      localStorage.setItem(MATCHUP_TIER_THRESHOLDS_STORAGE_KEY, JSON.stringify(next));
    } catch {}
  };

  const restoreDefaultTierThresholds = () => {
    updateTierThresholds({ ...DEFAULT_MATCHUP_TIER_THRESHOLDS });
  };

  const updateMachineBrThresholds = (next: MachineBrThresholds) => {
    setMachineBrThresholds(next);
    try {
      localStorage.setItem(MACHINE_BR_THRESHOLDS_STORAGE_KEY, JSON.stringify(next));
    } catch {}
  };

  const restoreDefaultMachineBrThresholds = () => {
    updateMachineBrThresholds({ ...DEFAULT_MACHINE_BR_THRESHOLDS });
  };

  const triggerUndoBanner = (message: string, onUndo: () => void) => {
    setUndoBanner({ message, onUndo });
  };

  useEffect(() => {
    if (!undoBanner) return;
    const timer = setTimeout(() => {
      setUndoBanner(null);
    }, 9000);
    return () => clearTimeout(timer);
  }, [undoBanner]);

  const saveDeletedBattlesTrashToStorage = (list: WebBattleLogEntry[]) => {
    const unique = Array.from(new Map(list.map((item) => [item.id, item])).values()).slice(0, 200);
    if (appCombatMode === 'show6') {
      setShow6DeletedBattlesTrash(unique);
      try {
        localStorage.setItem('gbl_show6_deleted_battles_trash_v1', JSON.stringify(unique));
      } catch {}
    } else {
      setGblDeletedBattlesTrash(unique);
      try {
        localStorage.setItem('gbl_deleted_battles_trash_v1', JSON.stringify(unique));
      } catch {}
    }
  };

  const saveDeletedTeamsTrashToStorage = (list: TeamPreset[]) => {
    const unique = Array.from(new Map(list.map((item) => [item.id, item])).values()).slice(0, 50);
    if (appCombatMode === 'show6') {
      setShow6DeletedTeamsTrash(unique);
      try {
        localStorage.setItem('gbl_show6_deleted_teams_trash_v1', JSON.stringify(unique));
      } catch {}
    } else {
      setGblDeletedTeamsTrash(unique);
      try {
        localStorage.setItem('gbl_deleted_teams_trash_v1', JSON.stringify(unique));
      } catch {}
    }
  };

  const saveShow6DeletedRostersTrashToStorage = (
    list: Array<{ target: 'MY' | 'OPP'; roster: Show6RosterOf6Preset }>
  ) => {
    const unique = Array.from(new Map(list.map((item) => [item.roster.id, item])).values()).slice(0, 50);
    setShow6DeletedRostersTrash(unique);
    try {
      localStorage.setItem('gbl_show6_deleted_rosters_trash_v1', JSON.stringify(unique));
    } catch {}
  };

  const [seasonsList, setSeasonsList] = useState<GblSeasonInfo[]>(() => {
    try {
      const raw = localStorage.getItem('gbl_scraped_seasons_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return DEFAULT_SEASONS_FALLBACK;
  });

  // Battle Log Filter & Modal States (v6.05 2-Tier CP Range -> Cup / Format Filter)
  const [logFilterCpTier, setLogFilterCpTier] = useState<'ALL' | 'GREAT' | 'ULTRA' | 'MASTER'>('ALL');
  const [logFilterLeague, setLogFilterLeague] = useState<string>('ALL LEAGUES');
  const [logFilterTeamId, setLogFilterTeamId] = useState<string>('ALL TEAMS');
  const [logFilterTimeframe, setLogFilterTimeframe] = useState<'DAY' | 'YESTERDAY' | 'WEEK' | 'CURRENT_SEASON' | 'PREVIOUS_SEASON' | 'ALL'>('ALL');
  const [exportPromptAction, setExportPromptAction] = useState<'COPY' | 'SHARE' | null>(null);
  const [editingLogEntry, setEditingLogEntry] = useState<WebBattleLogEntry | null>(null);
  const [replayLogEntry, setReplayLogEntry] = useState<WebBattleLogEntry | null>(null);
  const [replayUserIdx, setReplayUserIdx] = useState<number>(0);
  const [replayOppIdx, setReplayOppIdx] = useState<number>(0);
  const [replayOppShadow, setReplayOppShadow] = useState<boolean>(false);
  const [showHelpMetricGuideModal, setShowHelpMetricGuideModal] = useState<boolean>(false);
  const [helpMetricGuideTopic, setHelpMetricGuideTopic] = useState<'wae' | 'bmf' | 'badges'>('wae');
  const [showOverlayQuickHelpModal, setShowOverlayQuickHelpModal] = useState<boolean>(false);

  // Two-Device Cloud & Delta Sync States
  const [githubGistToken, setGithubGistToken] = useState<string>(() => localStorage.getItem('gbl_sync_github_token') || '');
  const [githubGistId, setGithubGistId] = useState<string>(() => localStorage.getItem('gbl_sync_github_gist_id') || '');
  const [lastCloudSyncStatus, setLastCloudSyncStatus] = useState<string>(() => localStorage.getItem('gbl_last_cloud_sync_ts') || 'Ready for 2-device delta sync');
  const [isSyncingCloud, setIsSyncingCloud] = useState<boolean>(false);
  const [showImportBundleModal, setShowImportBundleModal] = useState<boolean>(false);
  const [importBundleText, setImportBundleText] = useState<string>('');

  const saveBattleLogsToStorage = (logs: WebBattleLogEntry[]) => {
    // Keep Main Battle Logs permanently compact (timelineEvents live in 7-day AI Training Logs)
    const compact = logs
      .map((entry) =>
        entry.timelineEvents && entry.timelineEvents.length > 0
          ? { ...entry, timelineEvents: [] }
          : entry
      )
      .sort((a, b) => b.timestampMs - a.timestampMs);
    setBattleLogs(compact);
    try {
      localStorage.setItem(activeBattleLogStorageKey, JSON.stringify(compact));
    } catch {}
  };

  const saveAiTrainingLogsToStorage = (logs: WebAiTrainingLogRecord[]) => {
    const cutoff = Date.now() - AI_LOG_RETENTION_MS;
    const uniqueFresh = Array.from(
      new Map(
        logs
          .filter((item) => item && item.timestampMs >= cutoff)
          .sort((a, b) => b.timestampMs - a.timestampMs)
          .map((item) => [item.battleId, item])
      ).values()
    ).slice(0, 250);
    setAiTrainingLogs(uniqueFresh);
    try {
      localStorage.setItem('gbl_ai_training_logs_v1', JSON.stringify(uniqueFresh));
    } catch {}
  };

  // v3.50 One-Time Legacy Log Split & 7-Day Auto-Purge Script
  const runOneTimeAiLogSplitAndCleanup = (silent: boolean = false) => {
    const now = Date.now();
    const cutoff = now - AI_LOG_RETENTION_MS;
    let splitCount = 0;
    let purgedCount = 0;

    const existingAiMap = new Map<string, WebAiTrainingLogRecord>();
    aiTrainingLogs.forEach((item) => {
      if (item.timestampMs >= cutoff) {
        existingAiMap.set(item.battleId, item);
      } else {
        purgedCount++;
      }
    });

    const updatedMain = battleLogs.map((entry) => {
      const embedded = entry.timelineEvents || [];
      const existingAi = existingAiMap.get(entry.id);
      const eventsForDerive = embedded.length > 0 ? embedded : existingAi?.timelineEvents || [];

      if (embedded.length > 0) {
        if (entry.timestampMs >= cutoff) {
          splitCount++;
          existingAiMap.set(entry.id, {
            battleId: entry.id,
            timestampMs: entry.timestampMs,
            league: entry.league,
            userTeamName: entry.userTeamName,
            userPokemon: entry.userPokemon,
            opponents: entry.opponents,
            leadMatchup: entry.leadMatchup,
            result: entry.result,
            battleDurationSec: entry.battleDurationSec,
            adherenceRatePct: entry.adherenceRatePct,
            recommendationsIssuedCount: entry.recommendationsIssuedCount,
            recommendationsFollowedCount: entry.recommendationsFollowedCount,
            timelineEvents: embedded
          });
        } else {
          purgedCount++;
        }
      }

      const derived =
        entry.firstSwapActor && entry.switchAdvantage
          ? { firstSwapActor: entry.firstSwapActor, switchAdvantage: entry.switchAdvantage }
          : deriveFirstSwapAndSwitchAdvantageWeb(
              eventsForDerive,
              entry.leadMatchup,
              entry.result,
              entry.opponents?.length || 0
            );

      const lastEv = eventsForDerive[eventsForDerive.length - 1];
      const finalUserHp =
        entry.finalUserHpPct && entry.finalUserHpPct.length > 0
          ? entry.finalUserHpPct
          : lastEv?.userSlotHpPct && lastEv.userSlotHpPct.length > 0
          ? lastEv.userSlotHpPct
          : entry.result === 'WIN'
          ? [45, 0, 100]
          : [0, 0, 0];
      const finalOppHp =
        entry.finalOppHpPct && entry.finalOppHpPct.length > 0
          ? entry.finalOppHpPct
          : lastEv?.oppSlotHpPct && lastEv.oppSlotHpPct.length > 0
          ? lastEv.oppSlotHpPct
          : entry.result === 'WIN'
          ? [0, 0, 0]
          : [0, 35, 100];

      return {
        ...entry,
        timelineEvents: [],
        finalUserHpPct: finalUserHp,
        finalOppHpPct: finalOppHp,
        firstSwapActor: derived.firstSwapActor,
        switchAdvantage: derived.switchAdvantage
      };
    });

    const freshAiList = Array.from(existingAiMap.values()).sort((a, b) => b.timestampMs - a.timestampMs);
    saveAiTrainingLogsToStorage(freshAiList);
    saveBattleLogsToStorage(updatedMain);
    try {
      localStorage.setItem('gbl_ai_logs_split_v350_done', 'true');
    } catch {}

    if (!silent) {
      setStartBattleToast(
        `✅ AI Log Split & >7d Purge: ${updatedMain.length} main logs compacted • ${splitCount} split • ${purgedCount} >7d purged`
      );
      setTimeout(() => setStartBattleToast(null), 2600);
    }
  };

  const addDeletedTombstone = (id: string) => {
    setDeletedLogIds((prev) => {
      const next = Array.from(new Set([...prev, id]));
      try {
        localStorage.setItem('gbl_deleted_log_ids_v1', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const restoreBattleLogsFromTrash = (entriesToRestore: WebBattleLogEntry[]) => {
    if (entriesToRestore.length === 0) return;
    const now = Date.now();
    const restoreIds = new Set(entriesToRestore.map((e) => e.id));
    setDeletedLogIds((prev) => {
      const next = prev.filter((id) => !restoreIds.has(id));
      try {
        localStorage.setItem('gbl_deleted_log_ids_v1', JSON.stringify(next));
      } catch {}
      return next;
    });
    saveDeletedBattlesTrashToStorage(deletedBattlesTrash.filter((e) => !restoreIds.has(e.id)));
    setBattleLogs((prev) => {
      const filteredPrev = prev.filter((e) => !restoreIds.has(e.id));
      const updated = [
        ...entriesToRestore.map((e) => ({ ...e, updatedAt: now })),
        ...filteredPrev
      ].sort((a, b) => b.timestampMs - a.timestampMs);
      try {
        localStorage.setItem(activeBattleLogStorageKey, JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const restoreTeamPresetsFromTrash = (teamsToRestore: TeamPreset[]) => {
    if (teamsToRestore.length === 0) return;
    const restoreIds = new Set(teamsToRestore.map((t) => t.id));
    setDeletedTeamIds((prev) => {
      const next = prev.filter((id) => !restoreIds.has(id));
      try {
        localStorage.setItem('gbl_deleted_team_ids_v1', JSON.stringify(next));
      } catch {}
      return next;
    });
    saveDeletedTeamsTrashToStorage(deletedTeamsTrash.filter((t) => !restoreIds.has(t.id)));
    setPresets((prev) => {
      const filteredPrev = prev.filter((p) => !restoreIds.has(p.id));
      return [...filteredPrev, ...teamsToRestore];
    });
  };

  const handleDeleteSingleBattleLog = (entry: WebBattleLogEntry) => {
    saveDeletedBattlesTrashToStorage([entry, ...deletedBattlesTrash.filter((b) => b.id !== entry.id)]);
    addDeletedTombstone(entry.id);
    saveBattleLogsToStorage(battleLogs.filter((b) => b.id !== entry.id));
    const oppFirst = entry.opponents[0] || 'Opponent';
    triggerUndoBanner(`🗑️ Battle (${entry.result} vs ${oppFirst}) moved to Trash`, () => {
      restoreBattleLogsFromTrash([entry]);
    });
  };

  const handleClearBattleLogs = () => {
    if (battleLogs.length === 0) return;
    const clearedCopy = [...battleLogs];
    saveDeletedBattlesTrashToStorage([...clearedCopy, ...deletedBattlesTrash]);
    clearedCopy.forEach((b) => addDeletedTombstone(b.id));
    saveBattleLogsToStorage([]);
    triggerUndoBanner(`🗑️ ${clearedCopy.length} battle(s) moved to Trash`, () => {
      restoreBattleLogsFromTrash(clearedCopy);
    });
  };

  // Overlay Custom Position (Positioned below top header: y=118px, x=8px so it never obscures top opponent HP bar)
  const [overlayPos, setOverlayPos] = useState<{ x: number; y: number }>({ x: 8, y: 118 });

  // Mouse & Touch drag handling for moving overlay or minimized bubble in simulator
  const [isDragging, setIsDragging] = useState(false);
  const [didMoveDuringDrag, setDidMoveDuringDrag] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number; initialOverlayX: number; initialOverlayY: number }>({
    x: 0,
    y: 0,
    initialOverlayX: 8,
    initialOverlayY: 118
  });

  const onDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    setIsDragging(true);
    setDidMoveDuringDrag(false);
    setDragStart({
      x: clientX,
      y: clientY,
      initialOverlayX: overlayPos.x,
      initialOverlayY: overlayPos.y
    });
  };

  const onDragMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDragging) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const deltaX = clientX - dragStart.x;
    const deltaY = clientY - dragStart.y;
    if (Math.abs(deltaX) > 6 || Math.abs(deltaY) > 6) {
      setDidMoveDuringDrag(true);
    }
    const maxX = isOverlayMinimized ? 330 : 110;
    const maxY = isOverlayMinimized ? 700 : 440;
    const newX = Math.max(0, Math.min(dragStart.initialOverlayX + deltaX, maxX));
    const newY = Math.max(22, Math.min(dragStart.initialOverlayY + deltaY, maxY));
    setOverlayPos({ x: newX, y: newY });
  };

  const onDragEnd = () => {
    setIsDragging(false);
  };

  // Standard GBL Team Presets State (persisted in 'gbl_user_teams_persistent' — strictly Blind 3 PvP teams)
  const [gblPresets, setGblPresets] = useState<TeamPreset[]>(() => {
    const sanitizeGblList = (arr: any[]): TeamPreset[] =>
      arr
        .filter((p) => p && p.combatMode !== 'show6' && !String(p.id || '').startsWith('show6-preset3-'))
        .map((p) => ({
          ...p,
          league:
            String(p.league || '').trim().toUpperCase() === 'MEGA MASTER LEAGUE'
              ? 'Mega Master League (10000)'
              : normalizeLeagueName(p.league),
          combatMode: 'gbl' as const
        }));
    try {
      const persistent = localStorage.getItem('gbl_user_teams_persistent');
      if (persistent) {
        const parsed = JSON.parse(persistent);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const clean = sanitizeGblList(parsed);
          if (clean.length > 0) return clean;
        }
      }
      const legacyKeys = [
        'gbl_team_presets_v6',
        'gbl_team_presets_v5',
        'gbl_team_presets_v4',
        'gbl_team_presets_v3',
        'gbl_team_presets_v2',
        'gbl_team_presets'
      ];
      for (const key of legacyKeys) {
        const legacy = localStorage.getItem(key);
        if (legacy) {
          const parsed = JSON.parse(legacy);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const clean = sanitizeGblList(parsed);
            if (clean.length > 0) {
              localStorage.setItem('gbl_user_teams_persistent', JSON.stringify(clean));
              return clean;
            }
          }
        }
      }
    } catch (e) {
      console.error(e);
    }
    return INITIAL_PRESETS.map((p) => ({
      ...p,
      league:
        String(p.league || '').trim().toUpperCase() === 'MEGA MASTER LEAGUE'
          ? 'Mega Master League (10000)'
          : normalizeLeagueName(p.league),
      combatMode: 'gbl' as const
    }));
  });

  const [gblSelectedPresetId, setGblSelectedPresetId] = useState<string>(() => {
    return localStorage.getItem('gbl_selected_preset_id') || 'preset-ml-1';
  });

  // Show 6 Mode Independent Storage: Teams of 3 for Overlay ('gbl_show6_presets_of_3_v1'), My Teams of 6 ('gbl_show6_rosters_of_6_v1'), & Opponent Teams of 6 ('gbl_show6_opp_rosters_of_6_v1')
  // Strictly isolated: Blind 3 PvP teams never appear here unless intentionally cloned over as a separate entry.
  const [show6Presets3, setShow6Presets3] = useState<TeamPreset[]>(() => {
    const gblDefaultIds = new Set(['preset-ml-1', 'preset-gl-1', 'preset-ul-1', 'preset-mega-1', 'show6-preset3-gl-1']);
    try {
      const saved = localStorage.getItem('gbl_show6_presets_of_3_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const filtered = parsed
            .filter((p: any) => p && p.combatMode !== 'gbl' && !gblDefaultIds.has(String(p.id || '')))
            .map((p: any) => ({
              ...p,
              league: normalizeLeagueName(p.league),
              combatMode: 'show6' as const
            }));
          if (filtered.length > 0) return filtered;
        }
      }
    } catch {}
    return INITIAL_SHOW6_PRESETS_OF_3.map((p) => ({ ...p, combatMode: 'show6' as const }));
  });

  const [show6SelectedPreset3Id, setShow6SelectedPreset3Id] = useState<string>(() => {
    const saved = localStorage.getItem('gbl_show6_selected_preset3_id') || 'show6-preset3-spectral-1';
    return saved === 'show6-preset3-gl-1' ? 'show6-preset3-spectral-1' : saved;
  });

  const [show6Rosters6, setShow6Rosters6] = useState<Show6RosterOf6Preset[]>(() => {
    try {
      const saved = localStorage.getItem('gbl_show6_rosters_of_6_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const cleaned = parsed
            .filter((r: any) => r && r.id !== 'show6-roster6-gl-1')
            .map((r: any) => {
              const norm = normalizeLeagueName(r?.league);
              if (isShow6EligibleLeague(norm)) return { ...r, league: norm };
              const u = String(r?.league || '').toUpperCase();
              const mappedLg: LeagueType = u.includes('ULTRA')
                ? 'BATTLE FRONTIER (CAULDRON)'
                : u.includes('MASTER')
                ? 'BATTLE FRONTIER (MASTER)'
                : 'BATTLE FRONTIER (SPECTRAL)';
              return { ...r, league: mappedLg };
            });
          if (cleaned.length > 0) return cleaned;
        }
      }
    } catch {}
    return INITIAL_SHOW6_ROSTERS_OF_6;
  });

  const [selectedShow6Roster6Id, setSelectedShow6Roster6Id] = useState<string>(() => {
    const saved = localStorage.getItem('gbl_selected_show6_roster6_id') || 'show6-roster6-spectral-1';
    return saved === 'show6-roster6-gl-1' ? 'show6-roster6-spectral-1' : saved;
  });

  const [show6OpponentRosters6, setShow6OpponentRosters6] = useState<Show6RosterOf6Preset[]>(() => {
    try {
      const saved = localStorage.getItem('gbl_show6_opp_rosters_of_6_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const cleaned = parsed
            .filter((r: any) => r && r.id !== 'show6-opp-roster6-gl-1')
            .map((r: any) => {
              const norm = normalizeLeagueName(r?.league);
              if (isShow6EligibleLeague(norm)) return { ...r, league: norm };
              const u = String(r?.league || '').toUpperCase();
              const mappedLg: LeagueType = u.includes('ULTRA')
                ? 'BATTLE FRONTIER (CAULDRON)'
                : u.includes('MASTER')
                ? 'BATTLE FRONTIER (MASTER)'
                : 'BATTLE FRONTIER (SPECTRAL)';
              return { ...r, league: mappedLg };
            });
          if (cleaned.length > 0) return cleaned;
        }
      }
    } catch {}
    return INITIAL_SHOW6_OPPONENT_ROSTERS_OF_6;
  });

  const [selectedShow6OppRoster6Id, setSelectedShow6OppRoster6Id] = useState<string>(() => {
    const saved = localStorage.getItem('gbl_selected_show6_opp_roster6_id') || 'show6-opp-roster6-spectral-1';
    return saved === 'show6-opp-roster6-gl-1' ? 'show6-opp-roster6-spectral-1' : saved;
  });
  const [show6NewOppRosterName, setShow6NewOppRosterName] = useState<string>('');

  useEffect(() => {
    try {
      localStorage.setItem('gbl_show6_opp_rosters_of_6_v1', JSON.stringify(show6OpponentRosters6));
    } catch {}
  }, [show6OpponentRosters6]);

  useEffect(() => {
    try {
      localStorage.setItem('gbl_selected_show6_opp_roster6_id', selectedShow6OppRoster6Id);
    } catch {}
  }, [selectedShow6OppRoster6Id]);

  useEffect(() => {
    try {
      localStorage.setItem('gbl_user_teams_persistent', JSON.stringify(gblPresets));
    } catch {}
  }, [gblPresets]);

  useEffect(() => {
    try {
      localStorage.setItem('gbl_selected_preset_id', gblSelectedPresetId);
    } catch {}
  }, [gblSelectedPresetId]);

  useEffect(() => {
    try {
      localStorage.setItem('gbl_show6_presets_of_3_v1', JSON.stringify(show6Presets3));
    } catch {}
  }, [show6Presets3]);

  useEffect(() => {
    try {
      localStorage.setItem('gbl_show6_selected_preset3_id', show6SelectedPreset3Id);
    } catch {}
  }, [show6SelectedPreset3Id]);

  useEffect(() => {
    try {
      localStorage.setItem('gbl_show6_rosters_of_6_v1', JSON.stringify(show6Rosters6));
    } catch {}
  }, [show6Rosters6]);

  useEffect(() => {
    try {
      localStorage.setItem('gbl_selected_show6_roster6_id', selectedShow6Roster6Id);
    } catch {}
  }, [selectedShow6Roster6Id]);

  // Mode-Aware Active Teams of 3 (Automatically switches between Standard GBL Teams and Show 6 Overlay Teams of 3)
  const presets = appCombatMode === 'show6' ? show6Presets3 : gblPresets;
  const setPresets: React.Dispatch<React.SetStateAction<TeamPreset[]>> =
    appCombatMode === 'show6' ? setShow6Presets3 : setGblPresets;
  const selectedPresetId = appCombatMode === 'show6' ? show6SelectedPreset3Id : gblSelectedPresetId;
  const setSelectedPresetId: React.Dispatch<React.SetStateAction<string>> =
    appCombatMode === 'show6' ? setShow6SelectedPreset3Id : setGblSelectedPresetId;

  const activePreset = useMemo(() => {
    return presets.find((p) => p.id === selectedPresetId) || presets[0] || INITIAL_PRESETS[0];
  }, [presets, selectedPresetId]);

  // ============================================================================
  // PVPOKE LIMITED METAS CATALOG, PINNED METAS PER MODE, & MY TEAMS 2-TIER FILTER TABS
  // ============================================================================
  const [activeTeamsCpTierFilter, setActiveTeamsCpTierFilter] = useState<'ALL' | 'GREAT' | 'ULTRA' | 'MASTER'>('ALL');
  const [activeTeamsLeagueFilter, setActiveTeamsLeagueFilter] = useState<'ALL' | LeagueType>('ALL');
  const [limitedMetaCatalog, setLimitedMetaCatalog] = useState<LimitedMetaFormat[]>(() => getLimitedMetaCatalog());
  const [pinnedGblMetas, setPinnedGblMetasState] = useState<string[]>(() => getPinnedGblLimitedMetas());
  const [pinnedShow6Metas, setPinnedShow6MetasState] = useState<string[]>(() => getPinnedShow6LimitedMetas());
  const [limitedMetaSheetAliases, setLimitedMetaSheetAliasesState] = useState<Record<string, string>>(() =>
    getLimitedMetaSheetAliases()
  );
  const [isSyncingPvPokeMetas, setIsSyncingPvPokeMetas] = useState<boolean>(false);
  const [pvPokeMetasSyncStatus, setPvPokeMetasSyncStatus] = useState<string>(
    'PvPoke GitHub Formats Ready • Grouped into Current, Upcoming & Recent (Obsolete Archived Cups Hidden)'
  );
  const [limitedMetaSearchQuery, setLimitedMetaSearchQuery] = useState<string>('');
  const [modalCloneTargetLeague, setModalCloneTargetLeague] = useState<LeagueType>('GREAT LEAGUE');
  const [show6ModalCloneTargetLeague, setShow6ModalCloneTargetLeague] = useState<LeagueType>('BATTLE FRONTIER (SPECTRAL)');

  // Multi-Select Battle Log Reassignment State
  const [isBattleLogMultiSelectMode, setIsBattleLogMultiSelectMode] = useState<boolean>(false);
  const [selectedBattleLogIds, setSelectedBattleLogIds] = useState<string[]>([]);
  const [reassignTargetLeague, setReassignTargetLeague] = useState<LeagueType>('GREAT LEAGUE');

  const forcedGblLeagues = useMemo(() => getForcedGblLeagues(), []);
  const forcedShow6Leagues = useMemo(() => getForcedShow6Leagues(), [limitedMetaCatalog]);
  const enabledGblLeagues = useMemo(() => getEnabledGblLeagues(), [pinnedGblMetas, limitedMetaCatalog]);
  const enabledShow6Leagues = useMemo(() => getEnabledShow6Leagues(), [pinnedShow6Metas, limitedMetaCatalog]);
  const allEnabledLeaguesCombined = useMemo(
    () => Array.from(new Set([...enabledGblLeagues, ...enabledShow6Leagues])),
    [enabledGblLeagues, enabledShow6Leagues]
  );

  // Sync rankings for forced Show 6 Battle Frontier cups + any pinned Limited Metas on startup, and remap legacy Mega Master / Battle Frontier logs
  useEffect(() => {
    const allToSync = Array.from(new Set([...forcedShow6Leagues, ...pinnedGblMetas, ...pinnedShow6Metas]));
    allToSync.forEach((metaId) => {
      syncLimitedMetaRankings(metaId).catch(() => {});
    });

    // Remap legacy "MEGA MASTER LEAGUE" and mixed-case Battle Frontier cups in stored battle logs
    setGblBattleLogs((prev) => {
      let changed = false;
      const next = prev.map((b) => {
        const norm = normalizeLeagueName(b.league);
        if (norm !== b.league) {
          changed = true;
          return { ...b, league: norm };
        }
        return b;
      });
      if (changed) {
        try {
          localStorage.setItem('gbl_battle_logs_v1', JSON.stringify(next));
        } catch {}
      }
      return changed ? next : prev;
    });
    setShow6BattleLogs((prev) => {
      let changed = false;
      const next = prev.map((b) => {
        const norm = normalizeLeagueName(b.league);
        if (norm !== b.league) {
          changed = true;
          return { ...b, league: norm };
        }
        return b;
      });
      if (changed) {
        try {
          localStorage.setItem('gbl_show6_battle_logs_v1', JSON.stringify(next));
        } catch {}
      }
      return changed ? next : prev;
    });
  }, []);

  const handleTogglePinnedGblMeta = async (metaId: string) => {
    const exists = pinnedGblMetas.includes(metaId);
    const next = exists ? pinnedGblMetas.filter((id) => id !== metaId) : [...pinnedGblMetas, metaId];
    setPinnedGblLimitedMetas(next);
    setPinnedGblMetasState(next);
    setLimitedMetaCatalog(getLimitedMetaCatalog());
    setDbTelemetry(getPvPokeDatabaseTelemetry());
    if (!exists) {
      setStartBattleToast(`🔄 Fetching PvPoke rankings for ${metaId}...`);
      const count = await syncLimitedMetaRankings(metaId);
      setLimitedMetaCatalog(getLimitedMetaCatalog());
      setDbTelemetry(getPvPokeDatabaseTelemetry());
      setStartBattleToast(
        count > 0
          ? `✅ Pinned "${metaId}" to Standard GBL (${count} ranked Pokémon synced from PvPoke GitHub)!`
          : `✅ Pinned "${metaId}" to Standard GBL!`
      );
      setTimeout(() => setStartBattleToast(null), 2600);
    } else {
      const hasPresetForCup = presets.some((p) => p.league.toLowerCase() === metaId.toLowerCase());
      if (activeTeamsLeagueFilter === metaId) {
        setActiveTeamsLeagueFilter(hasPresetForCup ? 'OLD_CUPS' : 'ALL');
      }
      if (logFilterLeague.toLowerCase() === metaId.toLowerCase()) {
        setLogFilterLeague('OLD_CUPS');
      }
      setStartBattleToast(
        hasPresetForCup
          ? `Removed "${metaId}" from GBL selector (existing teams moved to "Old Cups" filter).`
          : `Removed "${metaId}" from Standard GBL selector.`
      );
      setTimeout(() => setStartBattleToast(null), 2400);
    }
  };

  const handleTogglePinnedShow6Meta = async (metaId: string) => {
    const exists = pinnedShow6Metas.includes(metaId);
    const next = exists ? pinnedShow6Metas.filter((id) => id !== metaId) : [...pinnedShow6Metas, metaId];
    setPinnedShow6LimitedMetas(next);
    setPinnedShow6MetasState(next);
    setLimitedMetaCatalog(getLimitedMetaCatalog());
    setDbTelemetry(getPvPokeDatabaseTelemetry());
    if (!exists) {
      setStartBattleToast(`🔄 Fetching PvPoke rankings for ${metaId}...`);
      const count = await syncLimitedMetaRankings(metaId);
      setLimitedMetaCatalog(getLimitedMetaCatalog());
      setDbTelemetry(getPvPokeDatabaseTelemetry());
      setStartBattleToast(
        count > 0
          ? `🏛️ Pinned "${metaId}" to Battle Frontier / Show 6 (${count} ranked Pokémon synced)!`
          : `🏛️ Pinned "${metaId}" to Battle Frontier / Show 6!`
      );
      setTimeout(() => setStartBattleToast(null), 2600);
    } else {
      const hasPresetForCup = presets.some((p) => p.league.toLowerCase() === metaId.toLowerCase());
      if (activeTeamsLeagueFilter === metaId) {
        setActiveTeamsLeagueFilter(hasPresetForCup ? 'OLD_CUPS' : 'ALL');
      }
      if (logFilterLeague.toLowerCase() === metaId.toLowerCase()) {
        setLogFilterLeague('OLD_CUPS');
      }
      setStartBattleToast(
        hasPresetForCup
          ? `Removed "${metaId}" from Show 6 selector (existing teams moved to "Old Cups" filter).`
          : `Removed "${metaId}" from Battle Frontier / Show 6 selector.`
      );
      setTimeout(() => setStartBattleToast(null), 2400);
    }
  };

  const handleUpdateLimitedMetaSheetAlias = (metaId: string, aliasKeyword: string) => {
    setLimitedMetaSheetAlias(metaId, aliasKeyword);
    setLimitedMetaSheetAliasesState(getLimitedMetaSheetAliases());
  };

  const handleSyncPvPokeLimitedMetasFromGitHub = async () => {
    setIsSyncingPvPokeMetas(true);
    setPvPokeMetasSyncStatus('Querying PvPoke GitHub formats.json, active cups/*.json & verifying rankings-{cp}.json...');
    try {
      const res = await fetchPvPokeLimitedMetasFromGitHub();
      setLimitedMetaCatalog(res.formats);
      setPvPokeMetasSyncStatus(res.statusMessage);
      setStartBattleToast(`🌐 ${res.statusMessage}`);
      setTimeout(() => setStartBattleToast(null), 2800);
    } catch {
      setPvPokeMetasSyncStatus('Using cached PvPoke Limited Meta catalog');
    } finally {
      setIsSyncingPvPokeMetas(false);
    }
  };

  // ============================================================================
  // SHOW 6 DUAL TEAM BUILDERS STATE (Mode 1: 6v6 Pick-3 & Mode 2: Blind Show-6)
  // ============================================================================
  const [show6ActiveBuilderTab, setShow6ActiveBuilderTab] = useState<'pick3' | 'blind6'>('pick3');
  const [show6Pick3League, setShow6Pick3League] = useState<LeagueType>('Battle Frontier (Spectral)');
  const [show6My6, setShow6My6] = useState<string[]>(() => {
    const def = getDefaultShow6RosterNames('Battle Frontier (Spectral)');
    return def.my6;
  });
  const [show6Opponent6, setShow6Opponent6] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('gbl_show6_opponent_6_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length === 6) {
          const isOldGlDefault =
            parsed[0] === 'Clodsire' ||
            parsed[0] === 'Azumarill' ||
            parsed.includes('Annihilape');
          if (!isOldGlDefault) return parsed;
        }
      }
    } catch {}
    return getDefaultShow6RosterNames('Battle Frontier (Spectral)').opp6;
  });
  const [show6NewRosterName, setShow6NewRosterName] = useState<string>('');
  const [show6SlotAutocomplete, setShow6SlotAutocomplete] = useState<{
    group: 'my6' | 'opp6' | 'lock6';
    idx: number;
  } | null>(null);
  const [show6Pick3Result, setShow6Pick3Result] = useState<Show6Pick3MatchupResult | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem('gbl_show6_opponent_6_v1', JSON.stringify(show6Opponent6));
    } catch {}
  }, [show6Opponent6]);

  // Mode 2: Blind Show 6 Meta Roster Builder State (Per-League Persisted Whitelist & Banlist + Clear Option)
  const [blindShow6League, setBlindShow6League] = useState<LeagueType>('Battle Frontier (Spectral)');
  const [blindShow6LockedSlots, setBlindShow6LockedSlots] = useState<string[]>(['', '', '', '', '']);
  const [blindShow6FilterMode, setBlindShow6FilterMode] = useState<'OPEN' | 'WHITELIST' | 'BANLIST'>('OPEN');
  // User's Clarifying Answer #3: Method to choose Option 2 (Comma/Newline Text Paste) or Option 3 (Autocomplete Chip Picker)
  const [blindShow6InputMethod, setBlindShow6InputMethod] = useState<'text' | 'chips'>('chips');

  const [show6WhitelistByLeague, setShow6WhitelistByLeague] = useState<Record<string, string[]>>(() => {
    const emptyMap: Record<string, string[]> = {
      'GREAT LEAGUE': [],
      'ULTRA LEAGUE': [],
      'MASTER LEAGUE': [],
      'MEGA MASTER LEAGUE': [],
      'Battle Frontier (Spectral)': [],
      'Battle Frontier (Cauldron)': [],
      'Battle Frontier (Master)': []
    };
    try {
      const raw = localStorage.getItem('gbl_show6_whitelist_by_league_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          return { ...emptyMap, ...parsed };
        }
      }
    } catch {}
    return emptyMap;
  });

  const [show6BanlistByLeague, setShow6BanlistByLeague] = useState<Record<string, string[]>>(() => {
    const emptyMap: Record<string, string[]> = {
      'GREAT LEAGUE': [],
      'ULTRA LEAGUE': [],
      'MASTER LEAGUE': [],
      'MEGA MASTER LEAGUE': [],
      'Battle Frontier (Spectral)': [],
      'Battle Frontier (Cauldron)': [],
      'Battle Frontier (Master)': []
    };
    try {
      const raw = localStorage.getItem('gbl_show6_banlist_by_league_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          return { ...emptyMap, ...parsed };
        }
      }
    } catch {}
    return emptyMap;
  });

  useEffect(() => {
    try {
      localStorage.setItem('gbl_show6_whitelist_by_league_v1', JSON.stringify(show6WhitelistByLeague));
    } catch {}
  }, [show6WhitelistByLeague]);

  useEffect(() => {
    try {
      localStorage.setItem('gbl_show6_banlist_by_league_v1', JSON.stringify(show6BanlistByLeague));
    } catch {}
  }, [show6BanlistByLeague]);

  // Derived active league Whitelist / Banlist chips & text + per-league update and clear helpers
  const activeLeagueWhitelistChips = show6WhitelistByLeague[blindShow6League] || [];
  const activeLeagueBanlistChips = show6BanlistByLeague[blindShow6League] || [];
  const blindShow6FilterChips =
    blindShow6FilterMode === 'WHITELIST'
      ? activeLeagueWhitelistChips
      : blindShow6FilterMode === 'BANLIST'
      ? activeLeagueBanlistChips
      : [];

  const [blindShow6FilterTextDraft, setBlindShow6FilterTextDraft] = useState<string>(() =>
    (show6WhitelistByLeague['Battle Frontier (Spectral)'] || []).join(', ')
  );

  // Sync text draft whenever league or filter mode changes
  useEffect(() => {
    const list =
      blindShow6FilterMode === 'WHITELIST'
        ? show6WhitelistByLeague[blindShow6League] || []
        : blindShow6FilterMode === 'BANLIST'
        ? show6BanlistByLeague[blindShow6League] || []
        : [];
    setBlindShow6FilterTextDraft(list.join(', '));
  }, [blindShow6League, blindShow6FilterMode]);

  const updateActiveLeagueFilterList = (nextChips: string[], nextRawText?: string) => {
    const deduped = Array.from(new Set(nextChips.map((c) => c.trim()).filter(Boolean)));
    if (blindShow6FilterMode === 'WHITELIST') {
      setShow6WhitelistByLeague((prev) => ({
        ...prev,
        [blindShow6League]: deduped
      }));
    } else if (blindShow6FilterMode === 'BANLIST') {
      setShow6BanlistByLeague((prev) => ({
        ...prev,
        [blindShow6League]: deduped
      }));
    }
    setBlindShow6FilterTextDraft(nextRawText !== undefined ? nextRawText : deduped.join(', '));
  };

  const handleClearLeagueFilterList = (target: 'WHITELIST' | 'BANLIST' | 'BOTH') => {
    if (target === 'WHITELIST' || target === 'BOTH') {
      setShow6WhitelistByLeague((prev) => ({
        ...prev,
        [blindShow6League]: []
      }));
    }
    if (target === 'BANLIST' || target === 'BOTH') {
      setShow6BanlistByLeague((prev) => ({
        ...prev,
        [blindShow6League]: []
      }));
    }
    setBlindShow6FilterTextDraft('');
    setStartBattleToast(
      target === 'BOTH'
        ? `🧹 Cleared persisted Whitelist & Banlist for ${blindShow6League}!`
        : `🧹 Cleared persisted ${target === 'WHITELIST' ? 'Whitelist' : 'Banlist'} for ${blindShow6League}!`
    );
    setTimeout(() => setStartBattleToast(null), 2200);
  };

  const [blindShow6FilterChipQuery, setBlindShow6FilterChipQuery] = useState<string>('');
  const [blindShow6HistoricalText, setBlindShow6HistoricalText] = useState<string>(
    'Ninetales (Alolan), Weezing (Galarian), Dewgong, Piloswine, Ledian, Arctibax'
  );
  const [blindShow6HistoricalChips, setBlindShow6HistoricalChips] = useState<string[]>([
    'Ninetales (Alolan)',
    'Weezing (Galarian)',
    'Dewgong',
    'Piloswine',
    'Ledian',
    'Arctibax'
  ]);
  const [blindShow6HistoricalChipQuery, setBlindShow6HistoricalChipQuery] = useState<string>('');
  const [blindShow6HistoricalWeightPct, setBlindShow6HistoricalWeightPct] = useState<number>(35);
  const [blindShow6Result, setBlindShow6Result] = useState<BlindShow6RosterResult | null>(null);

  useEffect(() => {
    if (siteView !== 'app' || appCombatMode !== 'show6') return;
    const timer = setTimeout(() => {
      if (!show6Pick3Result) {
        setShow6Pick3Result(
          evaluateShow6Pick3Matchup(
            'Battle Frontier (Spectral)',
            getDefaultShow6RosterNames('Battle Frontier (Spectral)').my6,
            getDefaultShow6RosterNames('Battle Frontier (Spectral)').opp6
          )
        );
      }
      if (!blindShow6Result) {
        setBlindShow6Result(
          generateBlindShow6Roster({
            league: 'Battle Frontier (Spectral)',
            lockedCoreNames: [],
            metaFilterMode: 'OPEN',
            whitelistNames: [],
            banlistNames: [],
            historicalExpectedNames: ['Ninetales (Alolan)', 'Weezing (Galarian)', 'Dewgong', 'Piloswine', 'Ledian', 'Arctibax'],
            historicalWeightPct: 35
          })
        );
      }
    }, 30);
    return () => clearTimeout(timer);
  }, [siteView, appCombatMode]);

  const handleRunShow6Pick3Optimizer = (
    overrideLeague?: LeagueType,
    overrideMy6?: string[],
    overrideOpp6?: string[]
  ) => {
    const lg = overrideLeague || show6Pick3League;
    const m6 = overrideMy6 || show6My6;
    const o6 = overrideOpp6 || show6Opponent6;
    const res = evaluateShow6Pick3Matchup(lg, m6, o6);
    setShow6Pick3Result(res);
  };

  // Battle Frontier Meta Usage & Most-Used Cores Sync + Weighting State
  const [bfUsageSheetUrl, setBfUsageSheetUrl] = useState<string>(() => getSavedBfUsageSheetUrl());
  const [bfCoresSheetUrl, setBfCoresSheetUrl] = useState<string>(() => getSavedBfCoresSheetUrl());
  const [show6UsageWeightPct, setShow6UsageWeightPctState] = useState<number>(() => getShow6UsageAndCoreWeightPct());
  const [isSyncingBfSheets, setIsSyncingBfSheets] = useState<boolean>(false);
  const [bfSheetSyncStatus, setBfSheetSyncStatus] = useState<string>(() => {
    try {
      return (
        localStorage.getItem('gbl_bf_sheets_last_sync_status_v2') ||
        getBattleFrontierCountsSummary('Pre-loaded Season 3 Cycle 1')
      );
    } catch {
      return getBattleFrontierCountsSummary('Pre-loaded Season 3 Cycle 1');
    }
  });
  const [showOneBattleDvrBtn, setShowOneBattleDvrBtn] = useState<boolean>(() => {
    try {
      return localStorage.getItem('gbl_show_one_battle_dvr_btn') === 'true';
    } catch {
      return false;
    }
  });
  const [isOneBattleDvrArmed, setIsOneBattleDvrArmed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('gbl_arm_one_battle_dvr') === 'true';
    } catch {
      return false;
    }
  });

  const handleChangeShow6UsageWeightPct = (val: number) => {
    const clamped = Math.max(0, Math.min(100, Math.round(val)));
    setShow6UsageWeightPctState(clamped);
    setShow6UsageAndCoreWeightPct(clamped);
    handleRunShow6Pick3Optimizer(show6Pick3League, show6My6, show6Opponent6);
  };

  const handleSyncBattleFrontierSheets = async () => {
    setIsSyncingBfSheets(true);
    try {
      setSavedBfUsageSheetUrl(bfUsageSheetUrl);
      setSavedBfCoresSheetUrl(bfCoresSheetUrl);
      const res = await syncBattleFrontierUsageAndCores(bfUsageSheetUrl, bfCoresSheetUrl);
      setBfSheetSyncStatus(res.summary);
      try {
        localStorage.setItem('gbl_bf_sheets_last_sync_status_v2', res.summary);
      } catch {}
      handleRunShow6Pick3Optimizer(show6Pick3League, show6My6, show6Opponent6);
      setStartBattleToast(`🏛️ ${res.summary}`);
      setTimeout(() => setStartBattleToast(null), 2800);
    } catch (err) {
      setStartBattleToast('⚠️ Could not reach Google Sheets CSV export — using cached Battle Frontier Usage & Cores');
      setTimeout(() => setStartBattleToast(null), 2800);
    } finally {
      setIsSyncingBfSheets(false);
    }
  };

  // Pick-6 Team Editor Modal State (Supports editing both My 6 and Opponent 6 stored rosters + Role Swap)
  const [editingShow6RosterModal, setEditingShow6RosterModal] = useState<{
    target: 'MY' | 'OPP';
    originalTarget: 'MY' | 'OPP';
    isNewFromBuilder?: boolean;
    roster: Show6RosterOf6Preset;
  } | null>(null);
  const [activeShow6EditorSlotIdx, setActiveShow6EditorSlotIdx] = useState<number>(0);
  const [show6EditorSlotUpgrades, setShow6EditorSlotUpgrades] = useState<Show6SlotUpgradeSuggestion[]>([]);
  const [show6EditorSlotMovesets, setShow6EditorSlotMovesets] = useState<Show6MovesetSuggestion[]>([]);
  const [show6EditorSlotAutocompleteIdx, setShow6EditorSlotAutocompleteIdx] = useState<number | null>(null);
  const [show6OppLineupViewMode, setShow6OppLineupViewMode] = useState<'archetypes' | 'top6'>('archetypes');
  const [showMostLikelyOpp6FormatsBar, setShowMostLikelyOpp6FormatsBar] = useState<boolean>(true);

  const mostLikelyOpponent6ByFormat = useMemo(
    () => (siteView === 'app' && appCombatMode === 'show6' ? getAllFormatsMostLikelyMetaOpponent6() : []),
    [siteView, appCombatMode, show6UsageWeightPct, bfSheetSyncStatus, pvPokeSyncStatus]
  );

  const refreshShow6EditorSuggestions = (roster: Show6RosterOf6Preset, slotIdx: number) => {
    const upgrades = recommendShow6RosterSlotUpgrades(roster.pokemon, slotIdx, roster.league);
    const movesets = recommendShow6RosterSlotMovesets(roster.pokemon, slotIdx, roster.league);
    setShow6EditorSlotUpgrades(upgrades);
    setShow6EditorSlotMovesets(movesets);
  };

  const openShow6RosterEditor = (roster: Show6RosterOf6Preset, target: 'MY' | 'OPP', isNewFromBuilder = false) => {
    const cloned: Show6RosterOf6Preset = {
      ...roster,
      pokemon: roster.pokemon.map((p, idx) => ({ ...p, id: p.id || `s6-${idx + 1}` }))
    };
    setEditingShow6RosterModal({ target, originalTarget: target, isNewFromBuilder, roster: cloned });
    setActiveShow6EditorSlotIdx(0);
    refreshShow6EditorSuggestions(cloned, 0);
  };

  const openActiveBuilderRosterEditor = (target: 'MY' | 'OPP') => {
    const lg = show6Pick3League;
    const sourceNames = target === 'MY' ? show6My6 : show6Opponent6;
    const members: TeamMember[] = sourceNames.map((name, idx) => {
      if (target === 'MY' && show6Pick3Result?.my6SimulatedBestMoves[idx]?.name === name) {
        return { ...show6Pick3Result.my6SimulatedBestMoves[idx], id: `s6-${idx + 1}` };
      }
      const rec = getRecommendedMovesForPokemon(name, lg);
      return {
        id: `s6-${idx + 1}`,
        name: rec?.name || name,
        cp: rec?.cp || (lg === 'Battle Frontier (Cauldron)' ? 2500 : lg === 'Battle Frontier (Master)' ? 4000 : 1500),
        fastMove: rec?.fastMove || 'Tackle',
        chargedMove1: rec?.chargedMove1 || 'Body Slam',
        chargedMove2: rec?.chargedMove2 || 'Surf'
      };
    });
    const tempRoster: Show6RosterOf6Preset = {
      id: target === 'MY' ? selectedShow6Roster6Id || `show6-roster-${Date.now()}` : selectedShow6OppRoster6Id || `show6-opp-roster-${Date.now()}`,
      name:
        target === 'MY'
          ? `My ${lg} Show 6 (${members.slice(0, 3).map((m) => m.name.split(' ')[0]).join('/')})`
          : `Opp ${lg} Show 6 (${members.slice(0, 3).map((m) => m.name.split(' ')[0]).join('/')})`,
      league: lg,
      pokemon: members,
      notes: target === 'MY' ? 'Edited My Show 6 Roster' : 'Edited Opponent Show 6 Roster',
      updatedAt: Date.now()
    };
    openShow6RosterEditor(tempRoster, target, true);
  };

  const handleSaveEditedShow6Roster = () => {
    if (!editingShow6RosterModal) return;
    const { target, originalTarget, isNewFromBuilder, roster } = editingShow6RosterModal;
    if (hasMultipleMegas(roster.pokemon)) {
      setStartBattleToast('⚠️ Max 1 Mega/Primal Pokémon allowed per Show 6 team!');
      setTimeout(() => setStartBattleToast(null), 2600);
      return;
    }
    const updatedRoster: Show6RosterOf6Preset = {
      ...roster,
      name: roster.name.trim() || `${target === 'MY' ? 'My' : 'Opp'} Show 6 (${roster.league})`,
      updatedAt: Date.now()
    };
    // If side was switched inside the editor (e.g. MY -> OPP or OPP -> MY), remove from original list if >1
    if (!isNewFromBuilder && originalTarget && originalTarget !== target) {
      if (originalTarget === 'MY' && show6Rosters6.length > 1) {
        setShow6Rosters6((prev) => prev.filter((r) => r.id !== updatedRoster.id));
      } else if (originalTarget === 'OPP' && show6OpponentRosters6.length > 1) {
        setShow6OpponentRosters6((prev) => prev.filter((r) => r.id !== updatedRoster.id));
      }
    }
    if (target === 'MY') {
      setShow6Rosters6((prev) => {
        const idx = prev.findIndex((r) => r.id === updatedRoster.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = updatedRoster;
          return next;
        }
        return [updatedRoster, ...prev];
      });
      setSelectedShow6Roster6Id(updatedRoster.id);
      const nextNames = updatedRoster.pokemon.map((m) => m.name);
      setShow6Pick3League(updatedRoster.league);
      setShow6My6(nextNames);
      handleRunShow6Pick3Optimizer(updatedRoster.league, nextNames, show6Opponent6);
    } else {
      setShow6OpponentRosters6((prev) => {
        const idx = prev.findIndex((r) => r.id === updatedRoster.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = updatedRoster;
          return next;
        }
        return [updatedRoster, ...prev];
      });
      setSelectedShow6OppRoster6Id(updatedRoster.id);
      const nextNames = updatedRoster.pokemon.map((m) => m.name);
      setShow6Pick3League(updatedRoster.league);
      setShow6Opponent6(nextNames);
      handleRunShow6Pick3Optimizer(updatedRoster.league, show6My6, nextNames);
    }
    setEditingShow6RosterModal(null);
    setStartBattleToast(`✅ Saved ${target === 'MY' ? 'My' : 'Opponent'} Pick-6 Team: "${updatedRoster.name}"`);
    setTimeout(() => setStartBattleToast(null), 2400);
  };

  // Clone any Show 6 Roster of 6 (My or Opponent) inside the Pick-6 Editor Modal with optional target league or side
  const handleCloneShow6Roster6 = (
    roster: Show6RosterOf6Preset,
    sourceSide: 'MY' | 'OPP',
    targetLeagueOverride?: LeagueType,
    targetSideOverride?: 'MY' | 'OPP'
  ) => {
    const destLeague = targetLeagueOverride || roster.league;
    const destSide = targetSideOverride || sourceSide;
    const newId = `show6-clone-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const rescaledMembers =
      destLeague !== roster.league
        ? rescaleTeamMembersForLeague(roster.pokemon, destLeague)
        : roster.pokemon;
    const clonedRoster: Show6RosterOf6Preset = {
      ...roster,
      id: newId,
      name:
        destSide !== sourceSide
          ? `[${destSide === 'MY' ? 'My' : 'Opp'} Copy] ${roster.name}`
          : destLeague !== roster.league
          ? `${roster.name} (${destLeague.split(' ')[0]})`
          : `${roster.name} (Copy)`,
      league: destLeague,
      pokemon: rescaledMembers.map((p, idx) => ({ ...p, id: `s6-c-${idx + 1}` })),
      updatedAt: Date.now()
    };
    if (destSide === 'MY') {
      setShow6Rosters6((prev) => [clonedRoster, ...prev]);
      setSelectedShow6Roster6Id(newId);
    } else {
      setShow6OpponentRosters6((prev) => [clonedRoster, ...prev]);
      setSelectedShow6OppRoster6Id(newId);
    }
    openShow6RosterEditor(clonedRoster, destSide, false);
    setStartBattleToast(
      `📋 Cloned as new ${destSide === 'MY' ? 'My' : 'Opponent'} Show 6 entry in ${destLeague} — now editing the copy!`
    );
    setTimeout(() => setStartBattleToast(null), 2600);
  };

  // Direct inline Swap My <-> Opponent on any Show 6 Roster of 6 card
  const handleSwapShow6RosterSide = (roster: Show6RosterOf6Preset, fromSide: 'MY' | 'OPP') => {
    const targetSide: 'MY' | 'OPP' = fromSide === 'MY' ? 'OPP' : 'MY';
    const newId = `show6-swap-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const swappedName =
      fromSide === 'MY'
        ? roster.name.replace(/^My\s+/i, 'Opp ').includes('Opp')
          ? roster.name.replace(/^My\s+/i, 'Opp ')
          : `[Opp] ${roster.name}`
        : roster.name.replace(/^\[?Opp\]?\s*/i, 'My ');
    const swappedRoster: Show6RosterOf6Preset = {
      ...roster,
      id: newId,
      name: swappedName,
      pokemon: roster.pokemon.map((p, idx) => ({ ...p, id: `s6-sw-${idx + 1}` })),
      updatedAt: Date.now()
    };
    const names = swappedRoster.pokemon.map((p) => p.name);
    if (targetSide === 'OPP') {
      setShow6OpponentRosters6((prev) => [swappedRoster, ...prev]);
      setSelectedShow6OppRoster6Id(newId);
      setShow6Pick3League(swappedRoster.league);
      setShow6Opponent6(names);
      handleRunShow6Pick3Optimizer(swappedRoster.league, show6My6, names);
    } else {
      setShow6Rosters6((prev) => [swappedRoster, ...prev]);
      setSelectedShow6Roster6Id(newId);
      setShow6Pick3League(swappedRoster.league);
      setShow6My6(names);
      handleRunShow6Pick3Optimizer(swappedRoster.league, names, show6Opponent6);
    }
    setStartBattleToast(
      `⇄ Swapped "${roster.name}" to ${targetSide === 'MY' ? 'My Show 6 Teams' : 'Opponent Show 6 Teams'} & loaded into 6v6 Simulator!`
    );
    setTimeout(() => setStartBattleToast(null), 2600);
  };

  // Flip active My 6 and Opponent 6 inside the 6v6 Pick-3 Simulator
  const handleFlipActiveMy6AndOpp6 = () => {
    const prevMy = [...show6My6];
    const prevOpp = [...show6Opponent6];
    setShow6My6(prevOpp);
    setShow6Opponent6(prevMy);
    handleRunShow6Pick3Optimizer(show6Pick3League, prevOpp, prevMy);
    setStartBattleToast('⇄ Flipped Active My 6 ⇄ Opponent 6 in Pick-3 Simulator!');
    setTimeout(() => setStartBattleToast(null), 2200);
  };

  // Copy a Show 6 Roster of 6's Top 3 Core to Standard GBL (Blind 3) Mode
  const handleCopyShow6RosterToGblBlind3 = (roster: Show6RosterOf6Preset) => {
    const sim = evaluateShow6Pick3Matchup(
      roster.league,
      roster.pokemon,
      getMostLikelyMetaOpponent6ForFormat(roster.league).pokemonNames
    );
    const bestTrio =
      sim.topAbcLineups[0]?.members ||
      sim.topAbbLineups[0]?.members ||
      sim.topDuoLineups[0]?.members ||
      roster.pokemon.slice(0, 3);
    const hasMega = bestTrio.some((m) => isMegaOrPrimalSpecies(m.name));
    const targetGblLeague: LeagueType =
      roster.league === 'Battle Frontier (Cauldron)'
        ? 'ULTRA LEAGUE'
        : roster.league === 'Battle Frontier (Master)'
        ? hasMega
          ? 'MEGA MASTER LEAGUE'
          : 'MASTER LEAGUE'
        : 'GREAT LEAGUE';
    const rescaled = rescaleTeamMembersForLeague(bestTrio, targetGblLeague);
    const newId = `gbl-from-s6-${Date.now()}`;
    const basePreset: TeamPreset = {
      id: newId,
      name: `[From Show 6] ${rescaled.map((m) => m.name.split(' ')[0]).join(' / ')}`,
      league: targetGblLeague,
      pokemon: rescaled.map((m, idx) => ({ ...m, id: `p${idx + 1}` })),
      combatMode: 'gbl'
    };
    const evaluated = evaluateTeamPresetMetrics(
      basePreset,
      gblBattleLogs,
      activeSeasonBounds.startMs,
      activeSeasonBounds.endMs,
      true
    );
    setGblPresets((prev) => [evaluated, ...prev]);
    setGblSelectedPresetId(newId);
    setEditingShow6RosterModal(null);
    setAppCombatModeState('gbl');
    try {
      localStorage.setItem('gbl_app_combat_mode', 'gbl');
    } catch {}
    openEditPresetModal(evaluated);
    setStartBattleToast(`🛡️ Copied Top 3 Core to Standard GBL (${targetGblLeague}) & opened Team Editor!`);
    setTimeout(() => setStartBattleToast(null), 2800);
  };

  const handleSaveMy6AsRosterPreset = (customName?: string, membersOverride?: TeamMember[], leagueOverride?: LeagueType) => {
    const lg = leagueOverride || show6Pick3League;
    const members: TeamMember[] =
      membersOverride ||
      (show6Pick3Result?.my6SimulatedBestMoves.length === 6
        ? show6Pick3Result.my6SimulatedBestMoves
        : show6My6.map((name, idx) => {
            const rec = getRecommendedMovesForPokemon(name, lg);
            return {
              id: `s6-${idx + 1}`,
              name: rec?.name || name,
              cp: rec?.cp || 1500,
              fastMove: rec?.fastMove || 'Tackle',
              chargedMove1: rec?.chargedMove1 || 'Body Slam',
              chargedMove2: rec?.chargedMove2 || 'Surf'
            };
          }));
    if (hasMultipleMegas(members)) {
      setStartBattleToast('⚠️ Max 1 Mega/Primal Pokémon allowed per Show 6 team!');
      setTimeout(() => setStartBattleToast(null), 2600);
      return;
    }
    const newId = `show6-roster-${Date.now()}`;
    const rosterTitle =
      (customName ?? show6NewRosterName).trim() ||
      `Show 6 ${lg.split(' ')[0]} (${members.slice(0, 3).map((m) => m.name.split(' ')[0]).join('/')})`;
    const created: Show6RosterOf6Preset = {
      id: newId,
      name: rosterTitle,
      league: lg,
      pokemon: members,
      notes: 'Saved Show 6 Tournament Roster (Simulated Best Movesets)',
      updatedAt: Date.now()
    };
    setShow6Rosters6((prev) => [created, ...prev]);
    setSelectedShow6Roster6Id(newId);
    setShow6NewRosterName('');
    setStartBattleToast(`🏛️ Saved My Show 6 Team: "${rosterTitle}"`);
    setTimeout(() => setStartBattleToast(null), 2200);
  };

  const handleSaveOpp6AsRosterPreset = (customName?: string, membersOverride?: TeamMember[], leagueOverride?: LeagueType) => {
    const lg = leagueOverride || show6Pick3League;
    const members: TeamMember[] =
      membersOverride ||
      show6Opponent6.map((name, idx) => {
        const rec = getRecommendedMovesForPokemon(name, lg);
        return {
          id: `opp6-${idx + 1}`,
          name: rec?.name || name,
          cp: rec?.cp || 1500,
          fastMove: rec?.fastMove || 'Tackle',
          chargedMove1: rec?.chargedMove1 || 'Body Slam',
          chargedMove2: rec?.chargedMove2 || 'Surf'
        };
      });
    if (hasMultipleMegas(members)) {
      setStartBattleToast('⚠️ Max 1 Mega/Primal Pokémon allowed per Opponent Show 6 team!');
      setTimeout(() => setStartBattleToast(null), 2600);
      return;
    }
    const newId = `show6-opp-roster-${Date.now()}`;
    const rosterTitle =
      (customName ?? show6NewOppRosterName).trim() ||
      `Opp ${lg.split(' ')[0]} (${members.slice(0, 3).map((m) => m.name.split(' ')[0]).join('/')})`;
    const created: Show6RosterOf6Preset = {
      id: newId,
      name: rosterTitle,
      league: lg,
      pokemon: members,
      notes: 'Saved Opponent Show 6 Roster (Constrains Live Overlay AI)',
      updatedAt: Date.now()
    };
    setShow6OpponentRosters6((prev) => [created, ...prev]);
    setSelectedShow6OppRoster6Id(newId);
    setShow6NewOppRosterName('');
    setStartBattleToast(`⚔️ Saved Opponent Show 6 Team: "${rosterTitle}"`);
    setTimeout(() => setStartBattleToast(null), 2200);
  };

  const handleDeleteShow6Roster6 = (roster: Show6RosterOf6Preset, target: 'MY' | 'OPP') => {
    if (target === 'MY' && show6Rosters6.length <= 1) {
      setStartBattleToast('⚠️ Keep at least 1 stored Show 6 roster in the app.');
      setTimeout(() => setStartBattleToast(null), 2200);
      return;
    }
    if (target === 'OPP' && show6OpponentRosters6.length <= 1) {
      setStartBattleToast('⚠️ Keep at least 1 stored Opponent Show 6 roster in the app.');
      setTimeout(() => setStartBattleToast(null), 2200);
      return;
    }
    saveShow6DeletedRostersTrashToStorage([
      { target, roster },
      ...show6DeletedRostersTrash.filter((item) => item.roster.id !== roster.id)
    ]);
    if (target === 'MY') {
      const next = show6Rosters6.filter((r) => r.id !== roster.id);
      setShow6Rosters6(next);
      if (selectedShow6Roster6Id === roster.id && next[0]) {
        setSelectedShow6Roster6Id(next[0].id);
      }
    } else {
      const next = show6OpponentRosters6.filter((r) => r.id !== roster.id);
      setShow6OpponentRosters6(next);
      if (selectedShow6OppRoster6Id === roster.id && next[0]) {
        setSelectedShow6OppRoster6Id(next[0].id);
      }
    }
    triggerUndoBanner(`🗑️ ${target === 'MY' ? 'My' : 'Opponent'} Show 6 '${roster.name}' moved to Show 6 Trash`, () => {
      if (target === 'MY') {
        setShow6Rosters6((prev) => [roster, ...prev.filter((r) => r.id !== roster.id)]);
      } else {
        setShow6OpponentRosters6((prev) => [roster, ...prev.filter((r) => r.id !== roster.id)]);
      }
      saveShow6DeletedRostersTrashToStorage(
        show6DeletedRostersTrash.filter((item) => item.roster.id !== roster.id)
      );
    });
  };

  const handleEquipShow6LineupToOverlay = (
    members: TeamMember[],
    archetype: TeamArchetype,
    league: LeagueType,
    labelSuffix: string
  ) => {
    const newId = `show6-trio-${Date.now()}`;
    const monNames = members.map((m) => m.name.split(' ')[0]).join('/');
    const basePreset: TeamPreset = {
      id: newId,
      name: `Show 6 ${archetype}: ${monNames} (${labelSuffix})`,
      league,
      pokemon: members.map((m, idx) => ({ ...m, id: `p${idx + 1}` })),
      archetype,
      isArchetypeManual: true,
      combatMode: 'show6'
    };
    const evaluated = evaluateTeamPresetMetrics(
      basePreset,
      show6BattleLogs,
      activeSeasonBounds.startMs,
      activeSeasonBounds.endMs,
      false
    );
    setShow6Presets3((prev) => [evaluated, ...prev]);
    setShow6SelectedPreset3Id(newId);
    if (appCombatMode !== 'show6') {
      setAppCombatModeState('show6');
      try {
        localStorage.setItem('gbl_app_combat_mode', 'show6');
      } catch {}
    }
    setStartBattleToast(`⚡ Equipped "${evaluated.name}" to Show 6 Overlay (Team of 3)!`);
    setTimeout(() => setStartBattleToast(null), 2400);
  };

  const handleRunBlindShow6Optimizer = () => {
    const whitelistForLeague =
      blindShow6FilterMode === 'WHITELIST' && blindShow6InputMethod === 'text'
        ? parsePokemonListInput(blindShow6FilterTextDraft, blindShow6League)
        : show6WhitelistByLeague[blindShow6League] || [];
    const banlistForLeague =
      blindShow6FilterMode === 'BANLIST' && blindShow6InputMethod === 'text'
        ? parsePokemonListInput(blindShow6FilterTextDraft, blindShow6League)
        : show6BanlistByLeague[blindShow6League] || [];
    const histList =
      blindShow6InputMethod === 'text'
        ? parsePokemonListInput(blindShow6HistoricalText, blindShow6League)
        : blindShow6HistoricalChips;
    const res = generateBlindShow6Roster({
      league: blindShow6League,
      lockedCoreNames: blindShow6LockedSlots.filter((s) => s.trim().length > 0),
      metaFilterMode: blindShow6FilterMode,
      whitelistNames: blindShow6FilterMode === 'WHITELIST' ? whitelistForLeague : [],
      banlistNames: blindShow6FilterMode === 'BANLIST' ? banlistForLeague : [],
      historicalExpectedNames: histList,
      historicalWeightPct: blindShow6HistoricalWeightPct
    });
    setBlindShow6Result(res);
  };

  const handleImportHistoricalFromShow6Logs = () => {
    const sourceLogs = show6BattleLogs.length > 0 ? show6BattleLogs : gblBattleLogs;
    const seen = Array.from(
      new Set(
        sourceLogs
          .filter((b) => !b.league || b.league === blindShow6League)
          .flatMap((b) => b.opponents || [])
          .filter(Boolean)
      )
    );
    if (seen.length === 0) {
      setStartBattleToast('ℹ️ No logged opponents found for this league yet — using default historical list.');
      setTimeout(() => setStartBattleToast(null), 2200);
      return;
    }
    setBlindShow6HistoricalChips(seen);
    setBlindShow6HistoricalText(seen.join(', '));
    setStartBattleToast(`📥 Imported ${seen.length} historical opponent species from Battle Logs!`);
    setTimeout(() => setStartBattleToast(null), 2200);
  };

  const activeSeasonBounds = useMemo(() => {
    const now = Date.now();
    return (
      seasonsList.find((s) => now >= s.startMs && now <= s.endMs) ||
      seasonsList[0] ||
      DEFAULT_SEASONS_FALLBACK[0]
    );
  }, [seasonsList]);

  const recalculateAllPresetsWithSeasonMeta = (
    presetsToRecalc: TeamPreset[] = presets,
    logsToUse: WebBattleLogEntry[] = battleLogs
  ) => {
    const updated = recalculateAllPresetsMetrics(
      presetsToRecalc,
      logsToUse,
      activeSeasonBounds.startMs,
      activeSeasonBounds.endMs
    );
    setPresets(updated);
    return updated;
  };

  // Ensure all presets have current-season blended Lead/Machine/Swap BR & ABB/ABC metrics on load or when season battle logs update
  useEffect(() => {
    if (siteView === 'marketing') return;
    const timer = setTimeout(() => {
      setPresets((prev) =>
        recalculateAllPresetsMetrics(
          prev,
          battleLogs,
          activeSeasonBounds.startMs,
          activeSeasonBounds.endMs
        )
      );
    }, 60);
    return () => clearTimeout(timer);
  }, [siteView, appCombatMode, battleLogs.length, activeSeasonBounds.startMs, activeSeasonBounds.endMs]);

  const [reparseBattlesStatus, setReparseBattlesStatus] = useState<string>(
    'Re-evaluates all logged battles with latest 2.56x dual-type & Shadow 1.2x damage + Win Quality (WAE) metrics'
  );

  const handleReparseAllCompletedBattles = (silent: boolean = false) => {
    const reparsedActive = reparseAllCompletedBattleLogs(battleLogs, presets, activeBattleLogStorageKey);
    setBattleLogs(reparsedActive);
    const reparsedTrash = reparseAllCompletedBattleLogs(deletedBattlesTrash, presets, activeDeletedBattlesTrashStorageKey);
    saveDeletedBattlesTrashToStorage(reparsedTrash);
    const agg = calculateAggregateWAE(reparsedActive, presets);
    const timeStr = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    setReparseBattlesStatus(
      `✅ Reparsed ${reparsedActive.length} completed battle(s) at ${timeStr} • Ranked: ${agg.rankedCount} • Exec WAE: ${agg.formatted} • Luck: ${agg.luckFormatted}`
    );
    if (!silent) {
      try {
        localStorage.setItem('gbl_damage_reparse_version', '500');
      } catch {}
    }
  };

  // Phase 3: Retroactive migration & v2.93 BMF / Exec WAE / Badges & Contextual Flags migration
  useEffect(() => {
    let reparseVer = 0;
    try {
      reparseVer = Number(localStorage.getItem('gbl_damage_reparse_version') || '0');
    } catch {}
    if (reparseVer < 215) {
      handleReparseAllCompletedBattles(true);
      try {
        localStorage.setItem('gbl_damage_reparse_version', '293');
      } catch {}
      return;
    }
    const migActive = migrateExistingBattleLogs(battleLogs, presets, activeBattleLogStorageKey);
    if (migActive.didMigrate) {
      setBattleLogs(migActive.logs);
    }
    const migTrash = migrateExistingBattleLogs(deletedBattlesTrash, presets, activeDeletedBattlesTrashStorageKey);
    if (migTrash.didMigrate) {
      saveDeletedBattlesTrashToStorage(migTrash.logs);
    }
    try {
      if (localStorage.getItem('gbl_ai_logs_split_v350_done') !== 'true') {
        runOneTimeAiLogSplitAndCleanup(true);
      }
    } catch {}
  }, [presets, appCombatMode]);

  // Battle Simulation State (Fixed Opponent Discovery Order: [1st seen, 2nd seen, 3rd seen])
  const [activeOpponentKey, setActiveOpponentKey] = useState<string>('Zacian (Crowned)');
  const [isOpponentShadow, setIsOpponentShadow] = useState<boolean>(false);
  const [activeUserSlotIndex, setActiveUserSlotIndex] = useState<number>(0);
  const [userTurnsElapsed, setUserTurnsElapsed] = useState<number>(0);
  const [oppTurnsElapsed, setOppTurnsElapsed] = useState<number>(0);
  const [userEnergy, setUserEnergy] = useState<number>(36);
  const [oppEnergy, setOppEnergy] = useState<number>(40);
  const [userSlotEnergy, setUserSlotEnergy] = useState<number[]>([36, 0, 0]);
  const [oppSlotEnergy, setOppSlotEnergy] = useState<number[]>([40, 0, 0]);
  const [playerSlotEverOnField, setPlayerSlotEverOnField] = useState<boolean[]>([true, false, false]);
  const [scanHzMode, setScanHzMode] = useState<'2Hz' | '1Hz'>('2Hz');
  const [scanTurnOffsetMs, setScanTurnOffsetMs] = useState<number>(120);
  const [userShields, setUserShields] = useState<number>(2);
  const [oppShields, setOppShields] = useState<number>(2);

  // v2.33 & v3.34: Dual 50s Countdown State Machines, Midpoint Swap Clock, 1st-Frame Provisional / 2nd-Frame Validity Bit & Post-Faint Prompt
  const [playerSwapEndTimeMs, setPlayerSwapEndTimeMs] = useState<number>(0);
  const [oppSwapEndTimeMs, setOppSwapEndTimeMs] = useState<number>(0);
  const [playerPokeballCount, setPlayerPokeballCount] = useState<number>(3);
  const [oppPokeballCount, setOppPokeballCount] = useState<number>(3);
  const [playerFaintedSlots, setPlayerFaintedSlots] = useState<boolean[]>([false, false, false]);
  const [oppFaintedSlots, setOppFaintedSlots] = useState<boolean[]>([false, false, false]);
  const [userSlotHpPct, setUserSlotHpPct] = useState<number[]>([100, 100, 100]);
  const [oppSlotHpPct, setOppSlotHpPct] = useState<number[]>([100, 100, 100]);
  const [isAttackIncomingPrompt, setIsAttackIncomingPrompt] = useState<boolean>(false);
  const [isPlayerTurnOne, setIsPlayerTurnOne] = useState<boolean>(true);
  const [isOppTurnOne, setIsOppTurnOne] = useState<boolean>(true);
  const [isPostFaintPromptActive, setIsPostFaintPromptActive] = useState<boolean>(false);
  const [lastOppSwitchWasFaint, setLastOppSwitchWasFaint] = useState<boolean>(false);
  const [lastPlayerSwitchWasFaint, setLastPlayerSwitchWasFaint] = useState<boolean>(false);
  const [oppSwitchValidityLatched, setOppSwitchValidityLatched] = useState<boolean>(true);
  const [playerSwitchValidityLatched, setPlayerSwitchValidityLatched] = useState<boolean>(true);
  const [lastConfirmedOppFrameTimeMs, setLastConfirmedOppFrameTimeMs] = useState<number>(() => Date.now());
  const [lastConfirmedPlayerFrameTimeMs, setLastConfirmedPlayerFrameTimeMs] = useState<number>(() => Date.now());
  const [provisionalOppPrevState, setProvisionalOppPrevState] = useState<{
    prevOppName: string;
    prevSlotIdx: number;
    prevSwapEndTimeMs: number;
    prevLastOppSwitchWasFaint: boolean;
  } | null>(null);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  // Phase 2: Clock Synchronization (t_0) & Live Timeline Event Logger
  const [battleClockAnchorMs, setBattleClockAnchorMs] = useState<number>(() => Date.now());
  const [battleTimelineEvents, setBattleTimelineEvents] = useState<BattleTimelineEvent[]>([]);
  const [lastClearedTimelineEvents, setLastClearedTimelineEvents] = useState<BattleTimelineEvent[]>([]);
  const [lastClearedBattleDurationSec, setLastClearedBattleDurationSec] = useState<number | undefined>(undefined);

  const getRelativeBattleSeconds = (anchorOverrideMs?: number) => {
    const t0 = anchorOverrideMs ?? battleClockAnchorMs;
    if (!t0 || t0 <= 0) return 0.0;
    return Number((Math.max(0, Date.now() - t0) / 1000.0).toFixed(2));
  };

  const getMidpointSwapStartTimeMs = (lastOldFrameMs: number, firstNewFrameMs: number) => {
    if (lastOldFrameMs <= 0 || firstNewFrameMs <= lastOldFrameMs || firstNewFrameMs - lastOldFrameMs > 6000) {
      return firstNewFrameMs;
    }
    return Math.round((lastOldFrameMs + firstNewFrameMs) / 2);
  };

  useEffect(() => {
    const now = Date.now();
    if (playerSwapEndTimeMs <= now && oppSwapEndTimeMs <= now) return;
    setNowMs(now);
    const timer = setInterval(() => {
      const tick = Date.now();
      setNowMs(tick);
      if (playerSwapEndTimeMs <= tick && oppSwapEndTimeMs <= tick) {
        clearInterval(timer);
      }
    }, 250);
    return () => clearInterval(timer);
  }, [playerSwapEndTimeMs, oppSwapEndTimeMs]);

  const playerSwapRemainingSec = Math.max(0, Math.ceil((playerSwapEndTimeMs - nowMs) / 1000));
  const oppSwapRemainingSec = Math.max(0, Math.ceil((oppSwapEndTimeMs - nowMs) / 1000));

  // Scanned Opponents (Fixed Discovery Order: Slot 0 = 1st Seen, Slot 1 = 2nd Seen, Slot 2 = 3rd Seen)
  const [scannedOpponents, setScannedOpponents] = useState<string[]>(['Zacian (Crowned)', 'Yveltal', 'Entei']);
  const [lastClearedOpponents, setLastClearedOpponents] = useState<string[]>([]);
  const [lastClearedLeadMatchup, setLastClearedLeadMatchup] = useState<'FAVORABLE' | 'NEUTRAL' | 'NEGATIVE'>('NEUTRAL');
  const [activeOpponentSlotIndex, setActiveOpponentSlotIndex] = useState<number>(0);
  const [isWaitingOpponent, setIsWaitingOpponent] = useState<boolean>(false);
  const [isBattleActive, setIsBattleActive] = useState<boolean>(true);
  const [showOpponentPicker, setShowOpponentPicker] = useState<boolean>(false);
  const [showStartBattleMenu, setShowStartBattleMenu] = useState<boolean>(false);
  const [manualLeadMatchupOverride, setManualLeadMatchupOverride] = useState<'FAVORABLE' | 'NEUTRAL' | 'NEGATIVE' | null>(null);
  const [startBattleToast, setStartBattleToast] = useState<string | null>(null);
  const [selectedOpponentLeague, setSelectedOpponentLeague] = useState<'AUTO' | LeagueType>('AUTO');

  // Scrape GBL Season dates from ScrapedDuck API on startup
  useEffect(() => {
    fetch('https://raw.githubusercontent.com/bigfoott/ScrapedDuck/data/events.min.json')
      .then((r) => r.json())
      .then((arr) => {
        if (!Array.isArray(arr)) return;
        const scraped: GblSeasonInfo[] = [];
        for (const ev of arr) {
          if (ev?.eventType === 'season' || ev?.heading === 'Season') {
            const sMs = new Date(ev.start).getTime();
            const eMs = new Date(ev.end).getTime();
            if (!Number.isNaN(sMs) && !Number.isNaN(eMs)) {
              scraped.push({
                eventID: ev.eventID || 'season',
                name: ev.name || 'GBL Season',
                startMs: sMs,
                endMs: eMs,
                rawStart: ev.start,
                rawEnd: ev.end
              });
            }
          }
        }
        if (scraped.length > 0) {
          const mergedMap = new Map<string, GblSeasonInfo>();
          DEFAULT_SEASONS_FALLBACK.forEach((s) => mergedMap.set(s.eventID, s));
          scraped.forEach((s) => mergedMap.set(s.eventID, s));
          const merged = Array.from(mergedMap.values()).sort((a, b) => b.startMs - a.startMs);
          setSeasonsList(merged);
          try {
            localStorage.setItem('gbl_scraped_seasons_v1', JSON.stringify(merged));
          } catch {}
        }
      })
      .catch(() => {});
  }, []);

  // Auto-sync PvPoke gamemaster.json + selected league rankings JSONs on startup
  useEffect(() => {
    let mounted = true;
    syncPvPokeDataAndRankings()
      .then((res) => {
        if (!mounted) return;
        const tel = getPvPokeDatabaseTelemetry();
        setDbTelemetry(tel);
        const totalRanked = tel.selectedLeagues.reduce((sum, item) => sum + item.count, 0);
        const nowStr = new Date().toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: 'numeric',
          minute: '2-digit'
        });
        if (totalRanked > 0) {
          setLastSyncedAt(nowStr);
          try {
            localStorage.setItem('gbl_last_sync_timestamp', nowStr);
          } catch {}
          const summaryStr = tel.selectedLeagues.map((l) => `${l.shortLabel}: ${l.count}`).join(' • ');
          setPvPokeSyncStatus(
            `Last Updated: ${nowStr} • GameMaster: ${res.syncedCount} Pokémon • ${summaryStr}`
          );
          setPresets((prev) =>
            recalculateAllPresetsMetrics(
              prev,
              battleLogs,
              activeSeasonBounds.startMs,
              activeSeasonBounds.endMs
            )
          );
        }
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  const handleManualPvPokeSync = async () => {
    setIsSyncingPvPoke(true);
    setPvPokeSyncStatus('Syncing gamemaster + selected league rankings...');
    try {
      const res = await syncPvPokeDataAndRankings();
      const tel = getPvPokeDatabaseTelemetry();
      setDbTelemetry(tel);
      const totalRanked = tel.selectedLeagues.reduce((sum, item) => sum + item.count, 0);
      const nowStr = new Date().toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      });
      if (totalRanked > 0) {
        setLastSyncedAt(nowStr);
        try {
          localStorage.setItem('gbl_last_sync_timestamp', nowStr);
        } catch {}
      }
      recalculateAllPresetsWithSeasonMeta(presets, battleLogs);
      const summaryStr = tel.selectedLeagues.map((l) => `${l.shortLabel}: ${l.count}`).join(' • ');
      setPvPokeSyncStatus(
        totalRanked > 0
          ? `Last Updated: ${nowStr} • GameMaster: ${res.syncedCount} Pokémon • ${summaryStr}`
          : `Loaded ${res.syncedCount} species (offline fallback)`
      );
    } catch {
      setPvPokeSyncStatus('Sync failed — using cached rankings');
    } finally {
      setIsSyncingPvPoke(false);
    }
  };

  const handleMovePreset = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= presets.length || toIndex >= presets.length) {
      return;
    }
    setPresets((prev) => {
      const updated = [...prev];
      const [moved] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, moved);
      return updated;
    });
  };

  // Preset Create / Edit Dialog State
  const [isNewPresetOpen, setIsNewPresetOpen] = useState(false);
  const [editingPresetId, setEditingPresetId] = useState<string | null>(null);
  const [newPresetName, setNewPresetName] = useState('');
  const [newPresetLeague, setNewPresetLeague] = useState<LeagueType>('GREAT LEAGUE');
  const [manualArchetypeOverride, setManualArchetypeOverride] = useState<TeamArchetype | undefined>(undefined);
  const [modalAutoDetectSummary, setModalAutoDetectSummary] = useState<string | null>(null);
  const [p1Name, setP1Name] = useState('Clodsire');
  const [p1Cp, setP1Cp] = useState(1494);
  const [p1Ivs, setP1Ivs] = useState('');
  const [p1Fast, setP1Fast] = useState('Poison Sting');
  const [p1C1, setP1C1] = useState('Earthquake');
  const [p1C2, setP1C2] = useState('Stone Edge');
  const [p1PlusLevel, setP1PlusLevel] = useState<number>(4);

  const [p2Name, setP2Name] = useState('Feraligatr');
  const [p2Cp, setP2Cp] = useState(1498);
  const [p2Ivs, setP2Ivs] = useState('');
  const [p2Fast, setP2Fast] = useState('Shadow Claw');
  const [p2C1, setP2C1] = useState('Hydro Cannon');
  const [p2C2, setP2C2] = useState('Ice Beam');
  const [p2PlusLevel, setP2PlusLevel] = useState<number>(4);

  const [p3Name, setP3Name] = useState('Mandibuzz');
  const [p3Cp, setP3Cp] = useState(1496);
  const [p3Ivs, setP3Ivs] = useState('');
  const [p3Fast, setP3Fast] = useState('Snarl');
  const [p3C1, setP3C1] = useState('Dark Pulse');
  const [p3C2, setP3C2] = useState('Aerial Ace');
  const [p3PlusLevel, setP3PlusLevel] = useState<number>(4);

  // Clipboard Copy State
  const [copiedFile, setCopiedFile] = useState(false);

  const getBaseSpeciesKey = (name: string) => {
    const dbEntry = POKEMON_DATABASE[name];
    if (dbEntry?.baseSpecies) return dbEntry.baseSpecies.toLowerCase();
    return name
      .replace(/^Shadow\s+/i, '')
      .replace(/^Kanto\s+/i, '')
      .replace(/^Alolan\s+/i, '')
      .split(' ')[0]
      .toLowerCase();
  };

  // Actions for Overlay: Start Battle (clears opponents & matrix immediately, activates 1 Hz OCR, switches button to Stop Battle)
  const handleStartBattle = () => {
    setLastClearedOpponents([]);
    setLastClearedTimelineEvents([]);
    setLastClearedBattleDurationSec(undefined);
    setScannedOpponents([]);
    setActiveOpponentSlotIndex(0);
    setIsWaitingOpponent(true);
    setIsBattleActive(true);
    setActiveOpponentKey('Waiting...');
    setIsOpponentShadow(false);
    setManualLeadMatchupOverride(null);
    setShowStartBattleMenu(false);
    setShowOpponentPicker(false);
    setUserTurnsElapsed(0);
    setOppTurnsElapsed(0);
    setUserEnergy(0);
    setOppEnergy(0);
    // Phase 2: Reset clock anchor (initialized when opponent lead is recognized) & timeline events
    setBattleClockAnchorMs(0);
    setBattleTimelineEvents([]);
    // v2.33: Reset swap timers, shields, and Pokéball faint state to initial (0s Ready, 3 balls, 2 shields)
    setPlayerSwapEndTimeMs(0);
    setOppSwapEndTimeMs(0);
    setPlayerPokeballCount(3);
    setOppPokeballCount(3);
    setUserShields(2);
    setOppShields(2);
    setPlayerFaintedSlots([false, false, false]);
    setOppFaintedSlots([false, false, false]);
    setUserSlotHpPct([100, 100, 100]);
    setOppSlotHpPct([100, 100, 100]);
    setIsAttackIncomingPrompt(false);
    setIsPlayerTurnOne(true);
    setIsOppTurnOne(true);
    setIsPostFaintPromptActive(false);
    setLastOppSwitchWasFaint(false);
    setLastPlayerSwitchWasFaint(false);
    setOppSwitchValidityLatched(true);
    setPlayerSwitchValidityLatched(true);
    setProvisionalOppPrevState(null);
    setLastConfirmedOppFrameTimeMs(Date.now());
    setLastConfirmedPlayerFrameTimeMs(Date.now());
  };

  // Stop Battle: pauses battle & opens the Win/Loss log option bar
  const handleStopBattle = () => {
    setShowOpponentPicker(false);
    if (!isWaitingOpponent && scannedOpponents.length > 0) {
      setLastClearedOpponents([...scannedOpponents]);
      setLastClearedLeadMatchup(currentLeadMatchup);
      setLastClearedTimelineEvents([...battleTimelineEvents]);
      setLastClearedBattleDurationSec(getRelativeBattleSeconds());
    }
    setIsBattleActive(false);
    setShowStartBattleMenu(true);
  };

  // Dismiss post-stop log bar without logging
  const handleSkipLoggingStoppedBattle = () => {
    setShowStartBattleMenu(false);
    setIsBattleActive(false);
    setLastClearedOpponents([]);
    setLastClearedTimelineEvents([]);
    setLastClearedBattleDurationSec(undefined);
    setScannedOpponents([]);
    setActiveOpponentSlotIndex(0);
    setIsWaitingOpponent(true);
    setActiveOpponentKey('Waiting...');
    setIsOpponentShadow(false);
    setManualLeadMatchupOverride(null);
    setUserTurnsElapsed(0);
    setOppTurnsElapsed(0);
    setUserEnergy(0);
    setOppEnergy(0);
    setBattleClockAnchorMs(0);
    setBattleTimelineEvents([]);
    setPlayerSwapEndTimeMs(0);
    setOppSwapEndTimeMs(0);
    setPlayerPokeballCount(3);
    setOppPokeballCount(3);
    setUserShields(2);
    setOppShields(2);
    setPlayerFaintedSlots([false, false, false]);
    setOppFaintedSlots([false, false, false]);
    setUserSlotHpPct([100, 100, 100]);
    setOppSlotHpPct([100, 100, 100]);
    setIsAttackIncomingPrompt(false);
    setIsPostFaintPromptActive(false);
    setLastOppSwitchWasFaint(false);
    setLastPlayerSwitchWasFaint(false);
    setOppSwitchValidityLatched(true);
    setPlayerSwitchValidityLatched(true);
    setProvisionalOppPrevState(null);
  };

  // Fixed Opponent Discovery Order: [1st seen, 2nd seen, 3rd seen] NEVER reorders when swapping active opponent!
  const handleSwapActiveOpponent = (rawInputName: string, markProvisionalFrame1: boolean = false) => {
    const currentLeagueForDefault: LeagueType =
      selectedOpponentLeague === 'AUTO' ? (activePreset?.league || 'MASTER LEAGUE') : selectedOpponentLeague;
    const resolvedDefault = resolveBestDefaultFormAndShadow(rawInputName, currentLeagueForDefault);
    const name = resolvedDefault.formName;
    setIsOpponentShadow(resolvedDefault.isShadow);

    const nowFrameMs = Date.now();
    const wasWaiting = isWaitingOpponent;
    const prevBase = getBaseSpeciesKey(activeOpponentKey);
    const targetBase = getBaseSpeciesKey(name);

    setActiveOpponentKey(name);
    setIsWaitingOpponent(false);
    setIsBattleActive(true);
    setShowOpponentPicker(false);
    setShowStartBattleMenu(false);
    setLastClearedOpponents([]);
    setOppTurnsElapsed(0);
    setOppEnergy(0);

    // State Machine:
    // Turn 1 lead spawn (wasWaiting) starts at 0s Ready and initializes Clock Anchor t_0 = 0.00s.
    // Subsequent True Tactical Swap (!wasWaiting && species changed && prior slot not fainted) starts at Midpoint(lastOldFrameMs, firstNewFrameMs) + 50s.
    if (wasWaiting) {
      setBattleClockAnchorMs(nowFrameMs);
      setBattleTimelineEvents([]);
      setOppSwapEndTimeMs(0);
      setOppPokeballCount(3);
      setOppFaintedSlots([false, false, false]);
      setUserSlotHpPct([100, 100, 100]);
      setOppSlotHpPct([100, 100, 100]);
      setIsAttackIncomingPrompt(false);
      setLastOppSwitchWasFaint(false);
      setOppSwitchValidityLatched(true);
      setProvisionalOppPrevState(null);
      setLastConfirmedOppFrameTimeMs(nowFrameMs);
    } else if (targetBase !== prevBase) {
      const prevOppMon = scannedOpponents[activeOpponentSlotIndex] || activeOpponentKey;
      const isFaintSwitch = !!oppFaintedSlots[activeOpponentSlotIndex];
      const relT = getRelativeBattleSeconds();
      const midpointStartMs = getMidpointSwapStartTimeMs(lastConfirmedOppFrameTimeMs, nowFrameMs);
      const userAliveCount = Math.max(1, 3 - playerFaintedSlots.filter(Boolean).length);
      const oppAliveCount = Math.max(1, 3 - oppFaintedSlots.filter(Boolean).length);

      setProvisionalOppPrevState({
        prevOppName: prevOppMon,
        prevSlotIdx: activeOpponentSlotIndex,
        prevSwapEndTimeMs: oppSwapEndTimeMs,
        prevLastOppSwitchWasFaint: lastOppSwitchWasFaint
      });
      setOppSwitchValidityLatched(!markProvisionalFrame1);

      if (!isFaintSwitch) {
        const nextEndMs = midpointStartMs + 50000;
        const nextOppRemSec = Math.max(0, Math.ceil((nextEndMs - nowFrameMs) / 1000));
        setOppSwapEndTimeMs(nextEndMs);
        setLastOppSwitchWasFaint(false);
        setBattleTimelineEvents((prevEv) => [
          ...prevEv,
          {
            type: 'SWAP',
            actor: 'opp',
            t: relT,
            pokemonIn: name,
            pokemonOut: prevOppMon,
            userShieldsRemaining: userShields,
            oppShieldsRemaining: oppShields,
            recommendedAction: activeTacticalRec?.actionLabel || null,
            recommendedGoal: activeTacticalRec?.goalText || null,
            decisionPhase: activeTacticalRec?.phaseBadge || 'OPP_SWAP',
            recommendedTargetPokemon: activeTacticalRec?.recommendedSwapPokemon || null,
            playerSwapRemainingSec,
            oppSwapRemainingSec: nextOppRemSec,
            userAliveCount,
            oppAliveCount,
            lastPlayerSwitchWasFaint,
            lastOppSwitchWasFaint: false,
            candidateScores: activeTacticalRec?.candidateScores || null,
            validityLatched: !markProvisionalFrame1
          }
        ]);
      } else {
        setLastOppSwitchWasFaint(true);
        setBattleTimelineEvents((prevEv) => [
          ...prevEv,
          {
            type: 'FAINT',
            actor: 'opp',
            t: relT,
            pokemonFainted: prevOppMon,
            pokemonIn: name,
            pokemonOut: prevOppMon,
            userShieldsRemaining: userShields,
            oppShieldsRemaining: oppShields,
            recommendedAction: activeTacticalRec?.actionLabel || null,
            recommendedGoal: activeTacticalRec?.goalText || null,
            decisionPhase: 'OPP_FAINT_ENTRY',
            recommendedTargetPokemon: activeTacticalRec?.recommendedSwapPokemon || null,
            playerSwapRemainingSec,
            oppSwapRemainingSec,
            userAliveCount,
            oppAliveCount,
            lastPlayerSwitchWasFaint,
            lastOppSwitchWasFaint: true,
            candidateScores: activeTacticalRec?.candidateScores || null,
            validityLatched: !markProvisionalFrame1
          }
        ]);
      }
      setLastConfirmedOppFrameTimeMs(nowFrameMs);
    } else {
      setOppSwitchValidityLatched(true);
      setLastConfirmedOppFrameTimeMs(nowFrameMs);
    }
    setIsOppTurnOne(false);

    setScannedOpponents((prev) => {
      const existingIdx = prev.findIndex((n) => getBaseSpeciesKey(n) === targetBase);
      let resolvedSlot = 0;
      let nextList = prev;
      if (existingIdx >= 0) {
        const updated = [...prev];
        updated[existingIdx] = name;
        resolvedSlot = existingIdx;
        nextList = updated;
      } else if (prev.length < 3) {
        const appended = [...prev, name];
        resolvedSlot = appended.length - 1;
        nextList = appended;
      } else {
        const replaced = [...prev];
        const targetSlot = Math.max(0, Math.min(activeOpponentSlotIndex, 2));
        replaced[targetSlot] = name;
        resolvedSlot = targetSlot;
        nextList = replaced;
      }
      setActiveOpponentSlotIndex(resolvedSlot);
      setOppFaintedSlots((prevFainted) => {
        if (!prevFainted[resolvedSlot]) return prevFainted;
        const nextFainted = [...prevFainted];
        nextFainted[resolvedSlot] = false;
        setOppPokeballCount(Math.max(1, 3 - nextFainted.filter(Boolean).length));
        return nextFainted;
      });
      return nextList;
    });
  };

  // Latch or Revert a 1st-Frame Provisional Opponent Swap (Frame 2 OCR validation)
  const handleLatchOrRevertProvisionalOppSwap = (confirmLatch: boolean) => {
    if (confirmLatch) {
      setOppSwitchValidityLatched(true);
      setProvisionalOppPrevState(null);
      setBattleTimelineEvents((prevEv) => {
        if (prevEv.length === 0) return prevEv;
        const updated = [...prevEv];
        updated[updated.length - 1] = {
          ...updated[updated.length - 1],
          validityLatched: true
        };
        return updated;
      });
      setStartBattleToast('✓ Frame 2 OCR Confirmed: Swap Validity Latched');
      setTimeout(() => setStartBattleToast(null), 1600);
    } else if (provisionalOppPrevState) {
      setActiveOpponentKey(provisionalOppPrevState.prevOppName);
      setActiveOpponentSlotIndex(provisionalOppPrevState.prevSlotIdx);
      setOppSwapEndTimeMs(provisionalOppPrevState.prevSwapEndTimeMs);
      setLastOppSwitchWasFaint(provisionalOppPrevState.prevLastOppSwitchWasFaint);
      setOppSwitchValidityLatched(true);
      setProvisionalOppPrevState(null);
      setBattleTimelineEvents((prevEv) => prevEv.slice(0, -1));
      setStartBattleToast('↩ Frame 2 OCR Reverted 1-Frame Glitch (Timer Restored)');
      setTimeout(() => setStartBattleToast(null), 1800);
    }
  };

  // Player Lead/Roster Switch with Resurrection Guard & Recommendation Adherence Tracking
  const handleSelectUserSlot = (slotIdx: number) => {
    const nowFrameMs = Date.now();
    if (playerFaintedSlots[slotIdx]) {
      setPlayerFaintedSlots((prev) => {
        const next = [...prev];
        next[slotIdx] = false;
        setPlayerPokeballCount(Math.max(1, 3 - next.filter(Boolean).length));
        return next;
      });
    }
    if (slotIdx === activeUserSlotIndex && !isPostFaintPromptActive) return;
    const isPrevFainted = isPostFaintPromptActive || !!playerFaintedSlots[activeUserSlotIndex];
    const prevUserMon = activePreset?.pokemon[activeUserSlotIndex]?.name || '';
    const nextUserMon = activePreset?.pokemon[slotIdx]?.name || '';
    const recSlot = activeTacticalRec?.recommendedSwapSlotIndex;
    const followedRec =
      recSlot !== null && recSlot !== undefined
        ? recSlot === slotIdx
        : activeTacticalRec?.actionLabel?.toUpperCase().includes('SWAP') ||
          activeTacticalRec?.actionLabel?.toUpperCase().includes('SEND IN')
        ? true
        : false;
    const userAliveCount = Math.max(1, 3 - playerFaintedSlots.filter(Boolean).length);
    const oppAliveCount = Math.max(1, 3 - oppFaintedSlots.filter(Boolean).length);

    if (!isWaitingOpponent) {
      const relT = getRelativeBattleSeconds();
      if (!isPrevFainted) {
        const midpointStartMs = getMidpointSwapStartTimeMs(lastConfirmedPlayerFrameTimeMs, nowFrameMs);
        const nextEndMs = midpointStartMs + 50000;
        const nextPlayerRemSec = Math.max(0, Math.ceil((nextEndMs - nowFrameMs) / 1000));
        setPlayerSwapEndTimeMs(nextEndMs);
        setLastPlayerSwitchWasFaint(false);
        setBattleTimelineEvents((prevEv) => [
          ...prevEv,
          {
            type: 'SWAP',
            actor: 'user',
            t: relT,
            pokemonIn: nextUserMon,
            pokemonOut: prevUserMon,
            userShieldsRemaining: userShields,
            oppShieldsRemaining: oppShields,
            recommendedAction: activeTacticalRec?.actionLabel || null,
            recommendedGoal: activeTacticalRec?.goalText || null,
            decisionPhase: activeTacticalRec?.phaseBadge || 'MID_GAME',
            recommendedTargetPokemon: activeTacticalRec?.recommendedSwapPokemon || null,
            playerSwapRemainingSec: nextPlayerRemSec,
            oppSwapRemainingSec,
            userAliveCount,
            oppAliveCount,
            lastPlayerSwitchWasFaint: false,
            lastOppSwitchWasFaint,
            candidateScores: activeTacticalRec?.candidateScores || null,
            followedRecommendation: followedRec,
            validityLatched: true
          }
        ]);
      } else {
        setLastPlayerSwitchWasFaint(true);
        setBattleTimelineEvents((prevEv) => [
          ...prevEv,
          {
            type: 'FAINT',
            actor: 'user',
            t: relT,
            pokemonFainted: prevUserMon,
            pokemonIn: nextUserMon,
            pokemonOut: prevUserMon,
            userShieldsRemaining: userShields,
            oppShieldsRemaining: oppShields,
            recommendedAction: activeTacticalRec?.actionLabel || null,
            recommendedGoal: activeTacticalRec?.goalText || null,
            decisionPhase: isPostFaintPromptActive ? 'POST_FAINT_SWAP' : activeTacticalRec?.phaseBadge || 'POST_FAINT_SWAP',
            recommendedTargetPokemon: activeTacticalRec?.recommendedSwapPokemon || null,
            playerSwapRemainingSec,
            oppSwapRemainingSec,
            userAliveCount,
            oppAliveCount,
            lastPlayerSwitchWasFaint: true,
            lastOppSwitchWasFaint,
            candidateScores: activeTacticalRec?.candidateScores || null,
            followedRecommendation: followedRec,
            validityLatched: true
          }
        ]);
      }
    }
    setLastConfirmedPlayerFrameTimeMs(nowFrameMs);
    setPlayerSwitchValidityLatched(true);
    setIsPostFaintPromptActive(false);
    setIsPlayerTurnOne(false);
    setPlayerSlotEverOnField((prev) => {
      if (prev[slotIdx]) return prev;
      const next = [...prev];
      next[slotIdx] = true;
      return next;
    });
    setActiveUserSlotIndex(slotIdx);
  };

  const handleSimulatePlayerSwap = () => {
    const nowFrameMs = Date.now();
    const liveNext = [1, 2].map((offset) => (activeUserSlotIndex + offset) % 3).find((idx) => !playerFaintedSlots[idx]);
    const nextSlot = liveNext !== undefined ? liveNext : (activeUserSlotIndex + 1) % 3;
    const prevUserMon = activePreset?.pokemon[activeUserSlotIndex]?.name || 'Lead';
    const nextUserMon = activePreset?.pokemon[nextSlot]?.name || 'Swap';
    const midpointStartMs = getMidpointSwapStartTimeMs(lastConfirmedPlayerFrameTimeMs, nowFrameMs);
    const nextEndMs = midpointStartMs + 50000;
    const followedRec = activeTacticalRec?.recommendedSwapSlotIndex === nextSlot;

    setPlayerFaintedSlots((prev) => {
      if (!prev[nextSlot] && !prev[activeUserSlotIndex]) return prev;
      const next = [...prev];
      next[nextSlot] = false;
      next[activeUserSlotIndex] = false;
      setPlayerPokeballCount(Math.max(1, 3 - next.filter(Boolean).length));
      return next;
    });
    if (!isWaitingOpponent) {
      const relT = getRelativeBattleSeconds();
      setBattleTimelineEvents((prevEv) => [
        ...prevEv,
        {
          type: 'SWAP',
          actor: 'user',
          t: relT,
          pokemonIn: nextUserMon,
          pokemonOut: prevUserMon,
          userShieldsRemaining: userShields,
          oppShieldsRemaining: oppShields,
          recommendedAction: activeTacticalRec?.actionLabel || null,
          recommendedGoal: activeTacticalRec?.goalText || null,
          decisionPhase: activeTacticalRec?.phaseBadge || 'MID_GAME',
          recommendedTargetPokemon: activeTacticalRec?.recommendedSwapPokemon || null,
          playerSwapRemainingSec: 50,
          oppSwapRemainingSec,
          userAliveCount: Math.max(1, 3 - playerFaintedSlots.filter(Boolean).length),
          oppAliveCount: Math.max(1, 3 - oppFaintedSlots.filter(Boolean).length),
          lastPlayerSwitchWasFaint: false,
          lastOppSwitchWasFaint,
          candidateScores: activeTacticalRec?.candidateScores || null,
          followedRecommendation: followedRec,
          validityLatched: true
        }
      ]);
    }
    setPlayerSwapEndTimeMs(nextEndMs);
    setLastConfirmedPlayerFrameTimeMs(nowFrameMs);
    setLastPlayerSwitchWasFaint(false);
    setIsPostFaintPromptActive(false);
    setIsPlayerTurnOne(false);
    setActiveUserSlotIndex(nextSlot);
    setStartBattleToast(`Player Tactical Swap -> ${nextUserMon} (Midpoint 50s timer)`);
    setTimeout(() => setStartBattleToast(null), 1800);
  };

  const handleSimulateOpponentSwap = (provisionalFrame1Only: boolean = false) => {
    const nowFrameMs = Date.now();
    const midpointStartMs = getMidpointSwapStartTimeMs(lastConfirmedOppFrameTimeMs, nowFrameMs);
    const nextEndMs = midpointStartMs + 50000;
    if (scannedOpponents.length > 1) {
      const len = scannedOpponents.length;
      const liveNext = [1, 2]
        .map((offset) => (activeOpponentSlotIndex + offset) % len)
        .find((idx) => !oppFaintedSlots[idx]);
      const nextSlot = liveNext !== undefined ? liveNext : (activeOpponentSlotIndex + 1) % len;
      const prevOppMon = scannedOpponents[activeOpponentSlotIndex] || activeOpponentKey;
      const nextOppMon = scannedOpponents[nextSlot];
      setProvisionalOppPrevState({
        prevOppName: prevOppMon,
        prevSlotIdx: activeOpponentSlotIndex,
        prevSwapEndTimeMs: oppSwapEndTimeMs,
        prevLastOppSwitchWasFaint: lastOppSwitchWasFaint
      });
      setOppSwitchValidityLatched(!provisionalFrame1Only);
      setOppFaintedSlots((prev) => {
        if (!prev[nextSlot] && !prev[activeOpponentSlotIndex]) return prev;
        const next = [...prev];
        next[nextSlot] = false;
        next[activeOpponentSlotIndex] = false;
        setOppPokeballCount(Math.max(1, 3 - next.filter(Boolean).length));
        return next;
      });
      if (!isWaitingOpponent) {
        const relT = getRelativeBattleSeconds();
        setBattleTimelineEvents((prevEv) => [
          ...prevEv,
          {
            type: 'SWAP',
            actor: 'opp',
            t: relT,
            pokemonIn: nextOppMon,
            pokemonOut: prevOppMon,
            userShieldsRemaining: userShields,
            oppShieldsRemaining: oppShields,
            recommendedAction: activeTacticalRec?.actionLabel || null,
            recommendedGoal: activeTacticalRec?.goalText || null,
            decisionPhase: activeTacticalRec?.phaseBadge || 'OPP_SWAP',
            recommendedTargetPokemon: activeTacticalRec?.recommendedSwapPokemon || null,
            playerSwapRemainingSec,
            oppSwapRemainingSec: 50,
            userAliveCount: Math.max(1, 3 - playerFaintedSlots.filter(Boolean).length),
            oppAliveCount: Math.max(1, 3 - oppFaintedSlots.filter(Boolean).length),
            lastPlayerSwitchWasFaint,
            lastOppSwitchWasFaint: false,
            candidateScores: activeTacticalRec?.candidateScores || null,
            validityLatched: !provisionalFrame1Only
          }
        ]);
      }
      setActiveOpponentSlotIndex(nextSlot);
      setActiveOpponentKey(nextOppMon);
    }
    setOppSwapEndTimeMs(nextEndMs);
    setLastConfirmedOppFrameTimeMs(nowFrameMs);
    setLastOppSwitchWasFaint(false);
    setIsOppTurnOne(false);
    setStartBattleToast(
      provisionalFrame1Only
        ? `Frame 1 Provisional Swap Detected ([1F] Midpoint Clock Started)`
        : `Opponent Tactical Swap (50s Midpoint Timer Reset)`
    );
    setTimeout(() => setStartBattleToast(null), 1800);
  };

  // Trigger "Switch in a new Pokémon?" Post-Faint Prompt so user can see the multi-factor replacement recommendation
  const handleSimulatePlayerFaint = () => {
    const faintedMon = activePreset?.pokemon[activeUserSlotIndex]?.name || 'Lead';
    const nextFainted = [...playerFaintedSlots];
    nextFainted[activeUserSlotIndex] = true;
    const nextUserHp = [...userSlotHpPct];
    nextUserHp[activeUserSlotIndex] = 0;
    setUserSlotHpPct(nextUserHp);
    setIsAttackIncomingPrompt(false);
    const aliveRemaining = [0, 1, 2].filter((idx) => !nextFainted[idx]);
    setPlayerFaintedSlots(nextFainted);
    setPlayerPokeballCount(Math.max(1, aliveRemaining.length));
    setLastPlayerSwitchWasFaint(true);

    if (aliveRemaining.length >= 2) {
      // Open "Switch in a new Pokémon?" prompt mode so the recommendation banner ranks the 2 remaining bench options!
      setIsPostFaintPromptActive(true);
      if (!isWaitingOpponent) {
        const relT = getRelativeBattleSeconds();
        setBattleTimelineEvents((prevEv) => [
          ...prevEv,
          {
            type: 'POST_FAINT_PROMPT',
            actor: 'user',
            t: relT,
            pokemonFainted: faintedMon,
            pokemonOut: faintedMon,
            userShieldsRemaining: userShields,
            oppShieldsRemaining: oppShields,
            decisionPhase: 'POST_FAINT_SWAP',
            playerSwapRemainingSec,
            oppSwapRemainingSec,
            userAliveCount: aliveRemaining.length,
            oppAliveCount: Math.max(1, 3 - oppFaintedSlots.filter(Boolean).length),
            lastPlayerSwitchWasFaint: true,
            lastOppSwitchWasFaint,
            userSlotHpPct: nextUserHp,
            oppSlotHpPct
          }
        ]);
      }
      setStartBattleToast(`"Switch in a new Pokémon?" Active — See SEND IN Recommendation!`);
      setTimeout(() => setStartBattleToast(null), 2400);
    } else {
      const lastIdx = aliveRemaining[0] ?? 0;
      const nextMon = activePreset?.pokemon[lastIdx]?.name || null;
      setIsPostFaintPromptActive(false);
      setActiveUserSlotIndex(lastIdx);
      if (!isWaitingOpponent) {
        const relT = getRelativeBattleSeconds();
        setBattleTimelineEvents((prevEv) => [
          ...prevEv,
          {
            type: 'FAINT',
            actor: 'user',
            t: relT,
            pokemonFainted: faintedMon,
            pokemonIn: nextMon,
            pokemonOut: faintedMon,
            userShieldsRemaining: userShields,
            oppShieldsRemaining: oppShields,
            decisionPhase: 'END_GAME',
            playerSwapRemainingSec,
            oppSwapRemainingSec,
            userAliveCount: 1,
            oppAliveCount: Math.max(1, 3 - oppFaintedSlots.filter(Boolean).length),
            lastPlayerSwitchWasFaint: true,
            lastOppSwitchWasFaint,
            userSlotHpPct: nextUserHp,
            oppSlotHpPct
          }
        ]);
      }
      setStartBattleToast(`Player Faint -> Last Pokémon ${nextMon} Sent In (Timer Preserved)`);
      setTimeout(() => setStartBattleToast(null), 2000);
    }
  };

  const handleSimulateOpponentFaint = () => {
    const faintedOpp = scannedOpponents[activeOpponentSlotIndex] || activeOpponentKey;
    const nextFainted = [...oppFaintedSlots];
    nextFainted[activeOpponentSlotIndex] = true;
    const nextOppHp = [...oppSlotHpPct];
    nextOppHp[activeOpponentSlotIndex] = 0;
    setOppSlotHpPct(nextOppHp);
    setOppFaintedSlots(nextFainted);
    setOppPokeballCount(Math.max(1, 3 - nextFainted.filter(Boolean).length));
    setLastOppSwitchWasFaint(true);
    const nextLiveIdx = scannedOpponents.findIndex((_, idx) => idx !== activeOpponentSlotIndex && !nextFainted[idx]);
    const nextOpp = nextLiveIdx >= 0 ? scannedOpponents[nextLiveIdx] : null;
    if (nextLiveIdx >= 0) {
      setActiveOpponentSlotIndex(nextLiveIdx);
      setActiveOpponentKey(scannedOpponents[nextLiveIdx]);
    }
    if (!isWaitingOpponent) {
      const relT = getRelativeBattleSeconds();
      setBattleTimelineEvents((prevEv) => [
        ...prevEv,
        {
          type: 'FAINT',
          actor: 'opp',
          t: relT,
          pokemonFainted: faintedOpp,
          pokemonIn: nextOpp,
          pokemonOut: faintedOpp,
          userShieldsRemaining: userShields,
          oppShieldsRemaining: oppShields,
          recommendedAction: activeTacticalRec?.actionLabel || null,
          recommendedGoal: activeTacticalRec?.goalText || null,
          decisionPhase: 'OPP_FAINT_ENTRY',
          playerSwapRemainingSec,
          oppSwapRemainingSec,
          userAliveCount: Math.max(1, 3 - playerFaintedSlots.filter(Boolean).length),
          oppAliveCount: Math.max(1, 3 - nextFainted.filter(Boolean).length),
          lastPlayerSwitchWasFaint,
          lastOppSwitchWasFaint: true,
          userSlotHpPct,
          oppSlotHpPct: nextOppHp
        }
      ]);
    }
    // Faint Replacement: Do NOT reset swap clock (preserve existing timer)
    setStartBattleToast(`Opponent Faint Replacement (-1 Pokéball, Opp Swap Clock Preserved)`);
    setTimeout(() => setStartBattleToast(null), 2000);
  };

  const handleUsePlayerShield = () => {
    const nextShields = Math.max(0, userShields - 1);
    const shieldNum = userShields >= 2 ? 1 : 2;
    const activeMon = activePreset?.pokemon[activeUserSlotIndex]?.name || 'Lead';
    const recPlan = (activeTacticalRec?.shieldPlan || '').toUpperCase();
    const followedShieldPlan =
      recPlan.includes('0S') || recPlan.includes('DO NOT') || recPlan.includes('NEVER')
        ? false
        : recPlan.includes('1S') || recPlan.includes('2S') || recPlan.includes('SHIELD') || recPlan.includes('COMMIT')
        ? true
        : null;
    if (!isWaitingOpponent && userShields > 0) {
      const relT = getRelativeBattleSeconds();
      setBattleTimelineEvents((prevEv) => [
        ...prevEv,
        {
          type: 'SHIELD',
          actor: 'user',
          t: relT,
          shieldNumber: shieldNum,
          activePokemon: activeMon,
          pokemonShielded: activeMon,
          userShieldsRemaining: nextShields,
          oppShieldsRemaining: oppShields,
          recommendedAction: activeTacticalRec?.actionLabel || null,
          recommendedGoal: activeTacticalRec?.goalText || null,
          decisionPhase: activeTacticalRec?.phaseBadge || 'MID_GAME',
          playerSwapRemainingSec,
          oppSwapRemainingSec,
          userAliveCount: Math.max(1, 3 - playerFaintedSlots.filter(Boolean).length),
          oppAliveCount: Math.max(1, 3 - oppFaintedSlots.filter(Boolean).length),
          lastPlayerSwitchWasFaint,
          lastOppSwitchWasFaint,
          followedRecommendation: followedShieldPlan
        }
      ]);
    }
    setUserShields(nextShields);
    setStartBattleToast(`🛡️ Player Shield Used (${nextShields} left)`);
    setTimeout(() => setStartBattleToast(null), 1800);
  };

  const handleUseOpponentShield = () => {
    const nextShields = Math.max(0, oppShields - 1);
    const shieldNum = oppShields >= 2 ? 1 : 2;
    const activeOppMon = scannedOpponents[activeOpponentSlotIndex] || activeOpponentKey;
    if (!isWaitingOpponent && oppShields > 0) {
      const relT = getRelativeBattleSeconds();
      setBattleTimelineEvents((prevEv) => [
        ...prevEv,
        {
          type: 'SHIELD',
          actor: 'opp',
          t: relT,
          shieldNumber: shieldNum,
          activePokemon: activeOppMon,
          pokemonShielded: activeOppMon,
          userShieldsRemaining: userShields,
          oppShieldsRemaining: nextShields,
          recommendedAction: activeTacticalRec?.actionLabel || null,
          recommendedGoal: activeTacticalRec?.goalText || null,
          decisionPhase: activeTacticalRec?.phaseBadge || 'MID_GAME',
          playerSwapRemainingSec,
          oppSwapRemainingSec,
          userAliveCount: Math.max(1, 3 - playerFaintedSlots.filter(Boolean).length),
          oppAliveCount: Math.max(1, 3 - oppFaintedSlots.filter(Boolean).length),
          lastPlayerSwitchWasFaint,
          lastOppSwitchWasFaint
        }
      ]);
    }
    setOppShields(nextShields);
    setStartBattleToast(`🛡️ Opponent Shield Used (${nextShields} left)`);
    setTimeout(() => setStartBattleToast(null), 1800);
  };

  const handleResetTimersAndBalls = () => {
    const nowFrameMs = Date.now();
    setBattleClockAnchorMs(nowFrameMs);
    setBattleTimelineEvents([]);
    setPlayerSwapEndTimeMs(0);
    setOppSwapEndTimeMs(0);
    setPlayerPokeballCount(3);
    setOppPokeballCount(3);
    setUserShields(2);
    setOppShields(2);
    setPlayerFaintedSlots([false, false, false]);
    setOppFaintedSlots([false, false, false]);
    setUserSlotHpPct([100, 100, 100]);
    setOppSlotHpPct([100, 100, 100]);
    setIsAttackIncomingPrompt(false);
    setIsPlayerTurnOne(true);
    setIsOppTurnOne(true);
    setIsPostFaintPromptActive(false);
    setLastOppSwitchWasFaint(false);
    setLastPlayerSwitchWasFaint(false);
    setOppSwitchValidityLatched(true);
    setPlayerSwitchValidityLatched(true);
    setProvisionalOppPrevState(null);
    setLastConfirmedOppFrameTimeMs(nowFrameMs);
    setLastConfirmedPlayerFrameTimeMs(nowFrameMs);
    setStartBattleToast(`Match Reset (100% HP, 3 Balls, 2 Shields, t_0 = 0.00s)`);
    setTimeout(() => setStartBattleToast(null), 1800);
  };

  // Update active player slot's persistent HP%
  const handleUpdateUserActiveHp = (newHpPct: number) => {
    const clamped = Math.max(0, Math.min(100, Math.round(newHpPct)));
    setUserSlotHpPct((prev) => {
      const next = [...prev];
      next[activeUserSlotIndex] = clamped;
      return next;
    });
    if (clamped <= 0 && !playerFaintedSlots[activeUserSlotIndex]) {
      handleSimulatePlayerFaint();
    }
  };

  // Update active opponent slot's persistent HP%
  const handleUpdateOppActiveHp = (newHpPct: number) => {
    const targetIdx = Math.max(0, Math.min(activeOpponentSlotIndex, 2));
    const clamped = Math.max(0, Math.min(100, Math.round(newHpPct)));
    setOppSlotHpPct((prev) => {
      const next = [...prev];
      next[targetIdx] = clamped;
      return next;
    });
    if (clamped <= 0 && !oppFaintedSlots[targetIdx]) {
      handleSimulateOpponentFaint();
    }
  };

  const handleSelectOpponent = (name: string) => {
    handleSwapActiveOpponent(name);
  };

  const handleSwapNextBenchOpponent = () => {
    if (scannedOpponents.length <= 1) return;
    const nextSlot = (activeOpponentSlotIndex + 1) % scannedOpponents.length;
    const nextActive = scannedOpponents[nextSlot];
    setActiveOpponentSlotIndex(nextSlot);
    setActiveOpponentKey(nextActive);
    setIsWaitingOpponent(false);
    setOppTurnsElapsed(0);
    setOppEnergy(0);
  };

  const activeOpponentLeague = selectedOpponentLeague === 'AUTO' ? (activePreset?.league || 'MASTER LEAGUE') : selectedOpponentLeague;
  const currentTopOpponents: TopOpponentInfo[] = PVPOKE_TOP_OPPONENTS[activeOpponentLeague] || PVPOKE_TOP_OPPONENTS['MASTER LEAGUE'] || [];

  // Active Pokémon stats scaled for the active League CP and user IVs (auto-defaulting to PvPoke IVs if blank)
  const safeActiveOppSlot = Math.max(0, Math.min(activeOpponentSlotIndex, Math.max(0, scannedOpponents.length - 1)));
  const activeOpponentName = (!isWaitingOpponent && scannedOpponents.length > 0)
    ? (scannedOpponents[safeActiveOppSlot] || scannedOpponents[0])
    : activeOpponentKey;
  const rawActiveOpponent = POKEMON_DATABASE[activeOpponentName] || POKEMON_DATABASE[activeOpponentKey] || POKEMON_DATABASE['Zacian (Crowned)'];
  const activeOpponent = useMemo(() => {
    return computeEffectiveStatsForLeague(rawActiveOpponent, activeOpponentLeague, undefined, undefined, isOpponentShadow);
  }, [rawActiveOpponent, activeOpponentLeague, isOpponentShadow, pvPokeSyncStatus]);

  // Precompute 9x9 Shield Matrix for Active Team vs Top 200 League Meta before launching/running Overlay
  const precomputed9x9State: PrecomputedTeam9x9State = useMemo(() => {
    if (siteView !== 'app') {
      return {
        teamSignature: 'deferred',
        league: activePreset?.league || 'GREAT LEAGUE',
        teamNames: ['Clodsire', 'Feraligatr', 'Mandibuzz'],
        opponentsMap: new Map(),
        metaDepth: 0,
        totalCellsComputed: 0,
        elapsedMs: 0,
        computedAt: 0
      };
    }
    const metaDepth = activeTab === 'simulator' ? 120 : 12;
    return precomputeTeam9x9ShieldMatrixAgainstMeta(
      activePreset?.pokemon || [],
      activePreset?.league || 'GREAT LEAGUE',
      tierThresholds,
      metaDepth
    );
  }, [siteView, activeTab, activePreset, tierThresholds, lastSyncedAt]);

  const activeRealtime9x9Lookup = useMemo(() => {
    return getOverlayRealtime9x9Matchup(
      activeOpponentName,
      activePreset?.pokemon || [],
      isOpponentShadow,
      activePreset?.league || 'GREAT LEAGUE'
    );
  }, [activeOpponentName, activePreset, isOpponentShadow, precomputed9x9State]);

  // Compute opponent charged move damage bounds against active player Pokémon for Shield vs No-Shield callout
  const activeOppChargedMoveBounds = useMemo(() => {
    const mySlot = activePreset?.pokemon[activeUserSlotIndex] || activePreset?.pokemon[0];
    const myName = mySlot?.name || 'Palkia (Origin)';
    const myShad = myName.toLowerCase().includes('shadow');
    const rawMyStats = POKEMON_DATABASE[myName] || POKEMON_DATABASE['Palkia (Origin)'];
    const myEffStats = computeEffectiveStatsForLeague(
      rawMyStats,
      activePreset?.league || activeOpponentLeague,
      mySlot?.cp,
      mySlot?.ivs,
      myShad
    );
    const candidateMoves: Array<{ name: string; damagePct: number }> = (activeOpponent?.chargedMoves || []).map((cm) => {
      const dmg = calculateChargedDamage(activeOpponent, myEffStats, cm, isOpponentShadow, myShad);
      return { name: cm.name, damagePct: dmg.percentage };
    });
    if (candidateMoves.length === 0) {
      return {
        maxDmgPct: 55,
        minDmgPct: 30,
        maxMoveName: 'Charged Move',
        minMoveName: 'Bait Move',
        thirdDmgPct: 0,
        thirdMoveName: '',
        fourthDmgPct: 0,
        fourthMoveName: '',
        candidateMoves: [] as Array<{ name: string; damagePct: number }>
      };
    }
    // Primary Shield Callouts are strictly based on the top 2 charged attacks (moves 1 & 2)
    // Moves 3 & 4 are checked separately to append a KO warning if they can KO
    const topTwo = candidateMoves.slice(0, 2);
    const sortedTopTwoDesc = [...topTwo].sort((a, b) => b.damagePct - a.damagePct);
    const move3 = candidateMoves[2];
    const move4 = candidateMoves[3];
    return {
      maxDmgPct: sortedTopTwoDesc[0].damagePct,
      minDmgPct: sortedTopTwoDesc[sortedTopTwoDesc.length - 1].damagePct,
      maxMoveName: sortedTopTwoDesc[0].name,
      minMoveName: sortedTopTwoDesc[sortedTopTwoDesc.length - 1].name,
      thirdDmgPct: move3?.damagePct ?? 0,
      thirdMoveName: move3?.name ?? '',
      fourthDmgPct: move4?.damagePct ?? 0,
      fourthMoveName: move4?.name ?? '',
      candidateMoves
    };
  }, [activeOpponent, activePreset, activeUserSlotIndex, activeOpponentLeague, isOpponentShadow]);

  // Lead, Swap, Post-Faint, Persistent-HP & Shield Callout Tactical Recommendation (v5.00 Show 6 Known-Opponent-6 Aware)
  const activeTacticalRec: TacticalRecommendationResult | null = useMemo(() => {
    if (isWaitingOpponent || scannedOpponents.length === 0 || !activePreset?.pokemon?.length) {
      return null;
    }
    const rec = computeTacticalLeadAndSwapRecommendation({
      team: activePreset.pokemon,
      archetype: activePreset.archetype || 'ABC',
      activeUserIdx: activeUserSlotIndex,
      scannedOpponents,
      activeOppName: activeOpponentName,
      userShields,
      oppShields,
      userFaintedSlots: playerFaintedSlots,
      oppFaintedSlots,
      userSlotHpPct,
      oppSlotHpPct,
      activeOppSlotIdx: safeActiveOppSlot,
      playerSwapRemainingSec,
      oppSwapRemainingSec,
      lastOppSwitchWasFaint,
      isPostFaintPrompt: isPostFaintPromptActive,
      isAttackIncomingPrompt,
      maxOppMoveDmgPct: activeOppChargedMoveBounds.maxDmgPct,
      minOppMoveDmgPct: activeOppChargedMoveBounds.minDmgPct,
      maxOppMoveName: activeOppChargedMoveBounds.maxMoveName,
      minOppMoveName: activeOppChargedMoveBounds.minMoveName,
      thirdOppMoveDmgPct: activeOppChargedMoveBounds.thirdDmgPct,
      thirdOppMoveName: activeOppChargedMoveBounds.thirdMoveName,
      fourthOppMoveDmgPct: activeOppChargedMoveBounds.fourthDmgPct,
      fourthOppMoveName: activeOppChargedMoveBounds.fourthMoveName,
      league: activePreset.league,
      knownOpponent6: appCombatMode === 'show6' ? show6Opponent6 : undefined
    });
    return rec && rec.visible ? rec : null;
  }, [
    isWaitingOpponent,
    scannedOpponents,
    activePreset,
    activeUserSlotIndex,
    safeActiveOppSlot,
    playerFaintedSlots,
    oppFaintedSlots,
    userSlotHpPct,
    oppSlotHpPct,
    isAttackIncomingPrompt,
    activeOppChargedMoveBounds,
    battleTimelineEvents,
    activeOpponentName,
    isOpponentShadow,
    userShields,
    oppShields,
    playerSwapRemainingSec,
    oppSwapRemainingSec,
    lastOppSwitchWasFaint,
    isPostFaintPromptActive,
    appCombatMode,
    show6Opponent6
  ]);

  const show6LiveBacklinePrediction: Show6LiveBacklinePredictionResult | null = useMemo(() => {
    if (appCombatMode !== 'show6') return null;
    return predictShow6UnrevealedBackline(
      activePreset?.league || 'GREAT LEAGUE',
      show6Opponent6,
      isWaitingOpponent ? [] : scannedOpponents,
      activePreset?.pokemon || []
    );
  }, [appCombatMode, activePreset, show6Opponent6, isWaitingOpponent, scannedOpponents]);

  // Resolve an Opponent Charged Attack (either Shielded 1S or Unshielded Tank with conservative move inference)
  const handleResolveOppChargedAttack = (useShield: boolean, simulatedMoveIdx: number = 0) => {
    const activeMon = activePreset?.pokemon[activeUserSlotIndex]?.name || 'Lead';
    const activeOppMon = scannedOpponents[safeActiveOppSlot] || activeOpponentName;
    const hpBefore = userSlotHpPct[activeUserSlotIndex] ?? 100;
    const shouldShield = useShield && userShields > 0;
    const recActionUpper = (activeTacticalRec?.actionLabel || '').toUpperCase();
    const recWantedShield = recActionUpper.includes('SHIELD (1S)');
    const recWantedTank = recActionUpper.includes('NO SHIELD') || recActionUpper.includes('TANK');
    const followedShieldCall =
      recWantedShield ? shouldShield : recWantedTank ? !shouldShield : null;

    if (shouldShield) {
      const nextShields = Math.max(0, userShields - 1);
      setUserShields(nextShields);
      setIsAttackIncomingPrompt(false);
      // v3.50: Deduct cheapest charged move energy cost when opponent charged move is shielded
      const cheapestOppCost = Math.min(
        ...activeOpponent.chargedMoves.map((m) => resolveChargedMove(m.name, activeOpponent.types[0]).energyCost || m.energyCost || 40),
        45
      );
      const nextOppE = Math.max(0, (oppSlotEnergy[safeActiveOppSlot] ?? oppEnergy) - cheapestOppCost);
      setOppEnergy(nextOppE);
      setOppSlotEnergy((prev) => {
        const next = [...prev];
        next[safeActiveOppSlot] = nextOppE;
        return next;
      });
      setScanTurnOffsetMs(Date.now() % 500);
      if (!isWaitingOpponent) {
        const relT = getRelativeBattleSeconds();
        setBattleTimelineEvents((prevEv) => [
          ...prevEv,
          {
            type: 'CHARGED_ATTACK',
            actor: 'opp',
            t: relT,
            activePokemon: activeOppMon,
            pokemonShielded: activeMon,
            shieldNumber: userShields >= 2 ? 1 : 2,
            userShieldsRemaining: nextShields,
            oppShieldsRemaining: oppShields,
            recommendedAction: activeTacticalRec?.actionLabel || null,
            recommendedGoal: activeTacticalRec?.goalText || null,
            decisionPhase: 'SHIELD_CALL',
            playerSwapRemainingSec,
            oppSwapRemainingSec,
            userAliveCount: Math.max(1, 3 - playerFaintedSlots.filter(Boolean).length),
            oppAliveCount: Math.max(1, 3 - oppFaintedSlots.filter(Boolean).length),
            lastPlayerSwitchWasFaint,
            lastOppSwitchWasFaint,
            followedRecommendation: followedShieldCall,
            shielded: true,
            hpBeforePct: hpBefore,
            hpAfterPct: hpBefore,
            hpDeltaPct: 0,
            inferredMoveName: null,
            userSlotHpPct,
            oppSlotHpPct
          }
        ]);
      }
      setStartBattleToast(`🛡️ Shielded ${activeOppMon} (-${cheapestOppCost}E cheapest • ${nextOppE}E left)`);
      setTimeout(() => setStartBattleToast(null), 2000);
      return;
    }

    // Unshielded: apply damage from chosen opponent charged move
    const chosenMove =
      activeOppChargedMoveBounds.candidateMoves[simulatedMoveIdx] ||
      activeOppChargedMoveBounds.candidateMoves[0] || {
        name: activeOppChargedMoveBounds.maxMoveName,
        damagePct: activeOppChargedMoveBounds.maxDmgPct
      };
    const hpAfter = Math.max(0, hpBefore - chosenMove.damagePct);
    const actualDelta = hpBefore - hpAfter;
    const inferredMove = inferUnshieldedChargedMoveName(
      actualDelta,
      false,
      activeOppChargedMoveBounds.candidateMoves
    );
    // v3.50: Deduct exact move energy if identified by damage delta, or cheapest move energy if unknown
    const matchedMoveObj = activeOpponent.chargedMoves.find(
      (m) => inferredMove && m.name.toLowerCase() === inferredMove.toLowerCase()
    );
    const resolvedInferredCost = inferredMove ? resolveChargedMove(inferredMove, activeOpponent.types[0]).energyCost : undefined;
    const cheapestOppCost = Math.min(
      ...activeOpponent.chargedMoves.map((m) => resolveChargedMove(m.name, activeOpponent.types[0]).energyCost || m.energyCost || 40),
      45
    );
    const deductedEnergy = resolvedInferredCost || matchedMoveObj?.energyCost || cheapestOppCost;
    const nextOppE = Math.max(0, (oppSlotEnergy[safeActiveOppSlot] ?? oppEnergy) - deductedEnergy);
    setOppEnergy(nextOppE);
    setOppSlotEnergy((prev) => {
      const next = [...prev];
      next[safeActiveOppSlot] = nextOppE;
      return next;
    });
    setScanTurnOffsetMs(Date.now() % 500);
    const nextUserHp = [...userSlotHpPct];
    nextUserHp[activeUserSlotIndex] = hpAfter;
    setUserSlotHpPct(nextUserHp);
    setIsAttackIncomingPrompt(false);

    if (!isWaitingOpponent) {
      const relT = getRelativeBattleSeconds();
      setBattleTimelineEvents((prevEv) => [
        ...prevEv,
        {
          type: 'CHARGED_ATTACK',
          actor: 'opp',
          t: relT,
          activePokemon: activeOppMon,
          userShieldsRemaining: userShields,
          oppShieldsRemaining: oppShields,
          recommendedAction: activeTacticalRec?.actionLabel || null,
          recommendedGoal: activeTacticalRec?.goalText || null,
          decisionPhase: 'SHIELD_CALL',
          playerSwapRemainingSec,
          oppSwapRemainingSec,
          userAliveCount: Math.max(1, 3 - playerFaintedSlots.filter(Boolean).length),
          oppAliveCount: Math.max(1, 3 - oppFaintedSlots.filter(Boolean).length),
          lastPlayerSwitchWasFaint,
          lastOppSwitchWasFaint,
          followedRecommendation: followedShieldCall,
          shielded: false,
          hpBeforePct: hpBefore,
          hpAfterPct: hpAfter,
          hpDeltaPct: actualDelta,
          inferredMoveName: inferredMove,
          userSlotHpPct: nextUserHp,
          oppSlotHpPct
        }
      ]);
    }

    if (hpAfter <= 0) {
      handleSimulatePlayerFaint();
    } else {
      const moveSuffix = inferredMove ? ` • ${inferredMove}` : '';
      setStartBattleToast(`⚡ Opp Charged Attack (-${actualDelta}% HP -> ${hpAfter}% HP${moveSuffix})`);
      setTimeout(() => setStartBattleToast(null), 2200);
    }
  };

  // Simulate or log Player throwing a Charged Attack
  const handleThrowMyChargedAttack = (moveIdx: number = 0, forceOppShield: boolean = false) => {
    const activeMon = activePreset?.pokemon[activeUserSlotIndex]?.name || 'Lead';
    const activeOppMon = scannedOpponents[safeActiveOppSlot] || activeOpponentName;
    const hpBefore = oppSlotHpPct[safeActiveOppSlot] ?? 100;
    const myRows = myMoveTimingInfo || [];
    const chosenRow = myRows[moveIdx] || myRows[0];
    const dmgPct = chosenRow?.oppDamages?.[safeActiveOppSlot]?.dmgPct ?? chosenRow?.dmgPct ?? 45;
    const oppUsesShield = forceOppShield && oppShields > 0;

    if (oppUsesShield) {
      const nextOppShields = Math.max(0, oppShields - 1);
      setOppShields(nextOppShields);
      if (!isWaitingOpponent) {
        const relT = getRelativeBattleSeconds();
        setBattleTimelineEvents((prevEv) => [
          ...prevEv,
          {
            type: 'CHARGED_ATTACK',
            actor: 'user',
            t: relT,
            activePokemon: activeMon,
            pokemonShielded: activeOppMon,
            shieldNumber: oppShields >= 2 ? 1 : 2,
            userShieldsRemaining: userShields,
            oppShieldsRemaining: nextOppShields,
            recommendedAction: activeTacticalRec?.actionLabel || null,
            recommendedGoal: activeTacticalRec?.goalText || null,
            decisionPhase: activeTacticalRec?.phaseBadge || 'MID_GAME',
            playerSwapRemainingSec,
            oppSwapRemainingSec,
            userAliveCount: Math.max(1, 3 - playerFaintedSlots.filter(Boolean).length),
            oppAliveCount: Math.max(1, 3 - oppFaintedSlots.filter(Boolean).length),
            lastPlayerSwitchWasFaint,
            lastOppSwitchWasFaint,
            shielded: true,
            hpBeforePct: hpBefore,
            hpAfterPct: hpBefore,
            hpDeltaPct: 0,
            inferredMoveName: null,
            userSlotHpPct,
            oppSlotHpPct
          }
        ]);
      }
      setStartBattleToast(`⚡ ${activeMon} Charged Attack (Blocked by Opp Shield • ${nextOppShields}S left)`);
      setTimeout(() => setStartBattleToast(null), 2000);
      return;
    }

    const hpAfter = Math.max(0, hpBefore - dmgPct);
    const actualDelta = hpBefore - hpAfter;
    const myCandidateMoves = myRows.map((r) => ({
      name: r.name,
      damagePct: r.oppDamages?.[safeActiveOppSlot]?.dmgPct ?? r.dmgPct
    }));
    const inferredMove = inferUnshieldedChargedMoveName(actualDelta, false, myCandidateMoves);
    const nextOppHp = [...oppSlotHpPct];
    nextOppHp[safeActiveOppSlot] = hpAfter;
    setOppSlotHpPct(nextOppHp);

    if (!isWaitingOpponent) {
      const relT = getRelativeBattleSeconds();
      setBattleTimelineEvents((prevEv) => [
        ...prevEv,
        {
          type: 'CHARGED_ATTACK',
          actor: 'user',
          t: relT,
          activePokemon: activeMon,
          userShieldsRemaining: userShields,
          oppShieldsRemaining: oppShields,
          recommendedAction: activeTacticalRec?.actionLabel || null,
          recommendedGoal: activeTacticalRec?.goalText || null,
          decisionPhase: activeTacticalRec?.phaseBadge || 'MID_GAME',
          playerSwapRemainingSec,
          oppSwapRemainingSec,
          userAliveCount: Math.max(1, 3 - playerFaintedSlots.filter(Boolean).length),
          oppAliveCount: Math.max(1, 3 - oppFaintedSlots.filter(Boolean).length),
          lastPlayerSwitchWasFaint,
          lastOppSwitchWasFaint,
          shielded: false,
          hpBeforePct: hpBefore,
          hpAfterPct: hpAfter,
          hpDeltaPct: actualDelta,
          inferredMoveName: inferredMove,
          userSlotHpPct,
          oppSlotHpPct: nextOppHp
        }
      ]);
    }

    if (hpAfter <= 0) {
      handleSimulateOpponentFaint();
    } else {
      const moveSuffix = inferredMove ? ` • ${inferredMove}` : '';
      setStartBattleToast(`⚡ ${activeMon} Charged Attack (-${actualDelta}% Opp HP -> ${hpAfter}% HP${moveSuffix})`);
      setTimeout(() => setStartBattleToast(null), 2200);
    }
  };

  // Auto-calculated Lead Matchup (Slot 0 1st-seen opponent vs Your Lead p1)
  const currentLeadMatchup: 'FAVORABLE' | 'NEUTRAL' | 'NEGATIVE' = useMemo(() => {
    if (manualLeadMatchupOverride) return manualLeadMatchupOverride;
    if (isWaitingOpponent || scannedOpponents.length === 0) return lastClearedLeadMatchup || 'NEUTRAL';
    const firstSeenOpp = scannedOpponents[0];
    const m = calculateShieldMatrix(
      firstSeenOpp,
      activePreset.pokemon,
      safeActiveOppSlot === 0 && isOpponentShadow,
      activePreset.league
    );
    const tokens = (m.p1 || 'W,N,L').split(',');
    const oneShield = (tokens[1] || tokens[0] || 'N').trim().toUpperCase();
    if (oneShield === 'SW' || oneShield === 'W') return 'FAVORABLE';
    if (oneShield === 'SL' || oneShield === 'L') return 'NEGATIVE';
    return 'NEUTRAL';
  }, [manualLeadMatchupOverride, isWaitingOpponent, scannedOpponents, activePreset, safeActiveOppSlot, isOpponentShadow, lastClearedLeadMatchup]);

  const handleCycleLeadMatchup = () => {
    const next =
      currentLeadMatchup === 'FAVORABLE'
        ? 'NEUTRAL'
        : currentLeadMatchup === 'NEUTRAL'
        ? 'NEGATIVE'
        : 'FAVORABLE';
    setManualLeadMatchupOverride(next);
  };

  const handleLogBattleFromOverlay = (result: 'WIN' | 'LOSS') => {
    const now = Date.now();
    const oppsToLog = (!isWaitingOpponent && scannedOpponents.length > 0)
      ? [...scannedOpponents]
      : [...lastClearedOpponents];
    const eventsToLog = (!isWaitingOpponent && battleTimelineEvents.length > 0)
      ? [...battleTimelineEvents]
      : [...lastClearedTimelineEvents];
    const durationSec = (!isWaitingOpponent && battleClockAnchorMs > 0)
      ? getRelativeBattleSeconds()
      : lastClearedBattleDurationSec;
    const userFaintsCount = Math.max(
      playerFaintedSlots.filter(Boolean).length,
      eventsToLog.filter((e) => e.type === 'FAINT' && e.actor === 'user').length
    );
    const oppFaintsCount = Math.max(
      oppFaintedSlots.filter(Boolean).length,
      eventsToLog.filter((e) => e.type === 'FAINT' && e.actor === 'opp').length
    );
    const userMons = activePreset.pokemon.map((p) => p.name);
    const qualityMeta = calculateBattleQuality(
      userMons,
      oppsToLog,
      activePreset.league,
      undefined,
      undefined,
      result,
      eventsToLog.length > 0 ? eventsToLog : undefined,
      oppsToLog.length > 0
        ? {
            totalDurationSec: durationSec,
            userFaints: userFaintsCount,
            oppFaints: oppFaintsCount,
            userShieldsRemaining: userShields,
            oppShieldsRemaining: oppShields
          }
        : undefined
    );
    const evalEvents = eventsToLog.filter(
      (e) => e.followedRecommendation === true || e.followedRecommendation === false
    );
    const recsIssued = evalEvents.length;
    const recsFollowed = evalEvents.filter((e) => e.followedRecommendation === true).length;
    const adherencePct = recsIssued > 0 ? Math.round((recsFollowed * 100) / recsIssued) : null;

    const { firstSwapActor, switchAdvantage } = deriveFirstSwapAndSwitchAdvantageWeb(
      eventsToLog,
      currentLeadMatchup,
      result,
      oppsToLog.length
    );
    const finalUserHpSnapshot = userSlotHpPct.map((hp, idx) =>
      playerFaintedSlots[idx] ? 0 : Math.max(0, Math.min(100, Math.round(hp)))
    );
    const finalOppHpSnapshot = oppSlotHpPct.map((hp, idx) =>
      oppFaintedSlots[idx] ? 0 : Math.max(0, Math.min(100, Math.round(hp)))
    );
    const battleId = `log-${now}-${Math.random().toString(36).slice(2, 7)}`;

    const newEntry: WebBattleLogEntry = {
      id: battleId,
      timestampMs: now,
      league: activePreset.league,
      presetId: activePreset.id,
      userTeamName: activePreset.name,
      userPokemon: userMons,
      opponents: oppsToLog,
      result,
      leadMatchup: currentLeadMatchup,
      bmfScore: qualityMeta ? qualityMeta.pPre : null,
      execWae: qualityMeta ? qualityMeta.execWae : null,
      badges: qualityMeta ? [qualityMeta.badgeLabel] : [],
      flags: qualityMeta ? qualityMeta.contextualFlags : [],
      quality: qualityMeta,
      timelineEvents: [],
      battleDurationSec: durationSec,
      userFaints: userFaintsCount,
      oppFaints: oppFaintsCount,
      userShieldsRemaining: userShields,
      oppShieldsRemaining: oppShields,
      finalUserHpPct: finalUserHpSnapshot,
      finalOppHpPct: finalOppHpSnapshot,
      firstSwapActor,
      switchAdvantage,
      adherenceRatePct: adherencePct,
      recommendationsIssuedCount: recsIssued,
      recommendationsFollowedCount: recsFollowed,
      deviceId,
      updatedAt: now
    };
    saveBattleLogsToStorage([newEntry, ...battleLogs]);
    if (eventsToLog.length > 0) {
      saveAiTrainingLogsToStorage([
        {
          battleId,
          timestampMs: now,
          league: activePreset.league,
          userTeamName: activePreset.name,
          userPokemon: userMons,
          opponents: oppsToLog,
          leadMatchup: currentLeadMatchup,
          result,
          battleDurationSec: durationSec,
          adherenceRatePct: adherencePct,
          recommendationsIssuedCount: recsIssued,
          recommendationsFollowedCount: recsFollowed,
          timelineEvents: eventsToLog
        },
        ...aiTrainingLogs
      ]);
    }
    setLastClearedOpponents([]);
    setLastClearedTimelineEvents([]);
    setLastClearedBattleDurationSec(undefined);
    setLastClearedLeadMatchup('NEUTRAL');
    if (!disableBattleToasts) {
      setStartBattleToast(result === 'WIN' ? '🏆 Win Logged!' : '💀 Loss Logged!');
      setTimeout(() => setStartBattleToast(null), 1100);
    }
    handleSkipLoggingStoppedBattle();
  };

  const buildAiTrainingDatasetJsonl = (entries: WebBattleLogEntry[] = battleLogs) => {
    const aiMap = new Map<string, WebAiTrainingLogRecord>();
    aiTrainingLogs.forEach((rec) => aiMap.set(rec.battleId, rec));
    return entries
      .map((b) => {
        const aiRec = aiMap.get(b.id);
        const sourceEvents =
          aiRec && aiRec.timelineEvents.length > 0
            ? aiRec.timelineEvents
            : b.timelineEvents || [];
        const events = sourceEvents.map((ev) => ({
          t: ev.t,
          actor: ev.actor,
          type: ev.type,
          pokemonIn: ev.pokemonIn || null,
          pokemonOut: ev.pokemonOut || null,
          pokemonFainted: ev.pokemonFainted || null,
          shieldNumber: ev.shieldNumber ?? null,
          userShieldsRemaining: ev.userShieldsRemaining,
          oppShieldsRemaining: ev.oppShieldsRemaining,
          decisionPhase: ev.decisionPhase || null,
          recommendedAction: ev.recommendedAction || null,
          recommendedGoal: ev.recommendedGoal || null,
          recommendedTargetPokemon: ev.recommendedTargetPokemon || null,
          playerSwapRemainingSec: ev.playerSwapRemainingSec ?? null,
          oppSwapRemainingSec: ev.oppSwapRemainingSec ?? null,
          userAliveCount: ev.userAliveCount ?? null,
          oppAliveCount: ev.oppAliveCount ?? null,
          lastPlayerSwitchWasFaint: ev.lastPlayerSwitchWasFaint ?? null,
          lastOppSwitchWasFaint: ev.lastOppSwitchWasFaint ?? null,
          candidateScores: ev.candidateScores || null,
          followedRecommendation: ev.followedRecommendation ?? null,
          validityLatched: ev.validityLatched ?? true,
          shielded: ev.shielded ?? null,
          hpBeforePct: ev.hpBeforePct ?? null,
          hpAfterPct: ev.hpAfterPct ?? null,
          hpDeltaPct: ev.hpDeltaPct ?? null,
          inferredMoveName: ev.inferredMoveName ?? null,
          userSlotHpPct: ev.userSlotHpPct ?? null,
          oppSlotHpPct: ev.oppSlotHpPct ?? null
        }));
        return JSON.stringify({
          schemaVersion: '3.50-ai-decision-tree',
          battleId: b.id,
          timestampMs: b.timestampMs,
          league: b.league,
          userTeamName: b.userTeamName,
          userTeam: b.userPokemon,
          opponentsRevealed: b.opponents,
          leadMatchup: b.leadMatchup,
          outcome: b.result,
          bmfScore: b.bmfScore ?? null,
          execWae: b.execWae ?? null,
          battleDurationSec: b.battleDurationSec ?? aiRec?.battleDurationSec ?? null,
          userFaints: b.userFaints ?? null,
          oppFaints: b.oppFaints ?? null,
          userShieldsRemaining: b.userShieldsRemaining ?? null,
          oppShieldsRemaining: b.oppShieldsRemaining ?? null,
          finalUserHpPct: b.finalUserHpPct ?? null,
          finalOppHpPct: b.finalOppHpPct ?? null,
          firstSwapActor: b.firstSwapActor ?? null,
          switchAdvantage: b.switchAdvantage ?? null,
          recommendationsIssuedCount: b.recommendationsIssuedCount ?? aiRec?.recommendationsIssuedCount ?? 0,
          recommendationsFollowedCount: b.recommendationsFollowedCount ?? aiRec?.recommendationsFollowedCount ?? 0,
          adherenceRatePct: b.adherenceRatePct ?? aiRec?.adherenceRatePct ?? null,
          aiLogRetentionStatus: aiRec ? 'ACTIVE_7D' : 'PURGED_OVER_7D',
          decisionNodes: events
        });
      })
      .join('\n');
  };

  const activeUserSlot = activePreset?.pokemon[activeUserSlotIndex] || activePreset?.pokemon[0];
  const userLeadName = activeUserSlot?.name || 'Palkia (Origin)';
  const isUserShadow = userLeadName.toLowerCase().includes('shadow');
  const rawUserActivePokemon = POKEMON_DATABASE[userLeadName] || POKEMON_DATABASE['Palkia (Origin)'] || POKEMON_DATABASE['Dialga (Origin)'];
  const userActivePokemon = useMemo(() => {
    return computeEffectiveStatsForLeague(
      rawUserActivePokemon,
      activePreset?.league || activeOpponentLeague,
      activeUserSlot?.cp,
      activeUserSlot?.ivs,
      isUserShadow
    );
  }, [rawUserActivePokemon, activePreset?.league, activeOpponentLeague, activeUserSlot?.cp, activeUserSlot?.ivs, isUserShadow, pvPokeSyncStatus]);

  const availableForms = useMemo(() => {
    return getAvailableFormsForPokemon(activeOpponent.name);
  }, [activeOpponent.name]);

  const handleCycleForm = () => {
    if (availableForms.length <= 1) return;
    const idx = availableForms.indexOf(activeOpponent.name);
    const nextForm = availableForms[(idx + 1) % availableForms.length];
    handleSelectOpponent(nextForm);
  };

  // Calculations (respecting live PvPoke GameMaster FAST_MOVE_STATS and custom fast move turns if edited)
  const FAST_MOVE_TURN_LOOKUP: Record<string, number> = {
    'dragon breath': 1,
    'sand attack': 1,
    'quick attack': 2,
    'lock-on': 1,
    'lock on': 1,
    'scratch': 1,
    'bite': 1,
    'tackle': 1,
    'water gun': 1,
    'lick': 1,
    'fury cutter': 1,
    'bug bite': 1,
    'psywave': 1,
    'psycho cut': 2,
    'mud shot': 2,
    'shadow claw': 2,
    'counter': 2,
    'powder snow': 2,
    'wing attack': 2,
    'peck': 2,
    'poison sting': 2,
    'thunder shock': 2,
    'metal claw': 2,
    'fire fang': 2,
    'dragon tail': 3,
    'waterfall': 3,
    'fire spin': 3,
    'snarl': 3,
    'charm': 3,
    'double kick': 3,
    'gust': 4,
    'confusion': 4,
    'volt switch': 4,
    'incinerate': 5
  };

  const userFastMoveName = activeUserSlot?.fastMove || userActivePokemon?.defaultFastMove?.name || 'Fast Move';
  const resolvedUserFastMove = resolveFastMove(userActivePokemon, userFastMoveName);
  const resolvedOppFastMove = resolveFastMove(activeOpponent);
  const userFastTurns = resolvedUserFastMove?.turns || FAST_MOVE_TURN_LOOKUP[userFastMoveName.toLowerCase().trim()] || userActivePokemon?.defaultFastMove?.turns || 2;
  const oppFastTurns = resolvedOppFastMove?.turns || activeOpponent?.defaultFastMove?.turns || 2;
  const turnAlignInfo = calculateTurnAlignment(userFastTurns, oppFastTurns);

  const oppFastInfo = useMemo(() => {
    return calculateFastDamage(
      activeOpponent,
      userActivePokemon,
      undefined,
      isOpponentShadow,
      isUserShadow
    );
  }, [activeOpponent, userActivePokemon, isOpponentShadow, isUserShadow]);

  const userFastInfo = useMemo(() => {
    return calculateFastDamage(
      userActivePokemon,
      activeOpponent,
      userFastMoveName,
      isUserShadow,
      isOpponentShadow
    );
  }, [userActivePokemon, activeOpponent, userFastMoveName, isUserShadow, isOpponentShadow]);

  const myCustomChargedMoves = useMemo(() => {
    return [
      activeUserSlot?.chargedMove1 || userActivePokemon.chargedMoves[0]?.name || 'Move 1',
      activeUserSlot?.chargedMove2 || userActivePokemon.chargedMoves[1]?.name || 'Move 2'
    ];
  }, [activeUserSlot, userActivePokemon]);

  const oppMoveTimingInfo = useMemo(() => {
    return calculateOpponentMoveTimingRows(
      activeOpponent,
      userLeadName,
      activePreset.pokemon.map(p => p.name),
      isOpponentShadow,
      userFastTurns,
      userFastMoveName,
      myCustomChargedMoves,
      oppCountMode,
      activePreset?.league || activeOpponentLeague,
      activePreset.pokemon,
      enable4ChargedMoves
    );
  }, [activeOpponent, userLeadName, activePreset, isOpponentShadow, userFastTurns, userFastMoveName, myCustomChargedMoves, oppCountMode, activeOpponentLeague, enable4ChargedMoves]);

  const oppReadyTaps = useMemo(() => {
    return oppMoveTimingInfo.rows.map(r => r.myTapAtReady);
  }, [oppMoveTimingInfo]);

  const myMoveTimingInfo = useMemo(() => {
    return calculateMyMoveTimingRows(
      userLeadName,
      activeOpponent,
      myCustomChargedMoves,
      oppReadyTaps,
      isOpponentShadow,
      userFastTurns,
      userFastMoveName,
      scannedOpponents,
      oppMoveTimingInfo.maxHorizonTurns,
      activePreset?.league || activeOpponentLeague,
      activeUserSlot,
      enable4ChargedMoves
    );
  }, [userLeadName, activeOpponent, myCustomChargedMoves, oppReadyTaps, isOpponentShadow, userFastTurns, userFastMoveName, scannedOpponents, oppMoveTimingInfo.maxHorizonTurns, activePreset?.league, activeOpponentLeague, activeUserSlot, enable4ChargedMoves]);

  const abbrPoke3 = (name: string, isShad: boolean = false) => {
    const clean = name
      .replace(/^Shadow\s+/i, '')
      .replace(/^Kanto\s+/i, '')
      .replace(/^Alolan\s+/i, '')
      .split(' ')[0]
      .slice(0, 3);
    const prefix = isShad || /^Shadow\s+/i.test(name) ? 'S-' : '';
    return prefix + clean;
  };

  const abbrMoveName = (name: string) => {
    return abbrMove5(name);
  };

  // Damage Calculations (Opponent -> Player & Player -> Opponent with Shadow modifiers & custom moves)
  const oppDamageData = useMemo(() => {
    const oppFastGain = resolveFastMove(activeOpponent)?.energyGain || activeOpponent.defaultFastMove.energyGain || 8;
    return activeOpponent.chargedMoves.map(move => {
      const calc = calculateChargedDamage(activeOpponent, userActivePokemon, move, isOpponentShadow, isUserShadow);
      const tapsNeeded = Math.max(0, Math.ceil((move.energyCost - oppEnergy) / oppFastGain));
      return {
        move,
        ...calc,
        tapsNeeded,
        isReady: oppEnergy >= move.energyCost
      };
    });
  }, [activeOpponent, userActivePokemon, oppEnergy, isOpponentShadow, isUserShadow]);

  const myDamageData = useMemo(() => {
    const customMoveNames = [
      activeUserSlot?.chargedMove1 || userActivePokemon.chargedMoves[0]?.name || 'Move 1',
      activeUserSlot?.chargedMove2 || userActivePokemon.chargedMoves[1]?.name || 'Move 2'
    ];
    const CUSTOM_MOVE_STATS: Record<string, { type: string; power: number }> = {
      'Twister': { type: 'dragon', power: 50 },
      'Brave Bird': { type: 'flying', power: 130 },
      'Feather Dance': { type: 'flying', power: 35 },
      'Weather Ball': { type: 'fire', power: 55 },
      'Scorching Sands': { type: 'ground', power: 80 },
      'Sky Attack': { type: 'flying', power: 75 },
      'Drill Run': { type: 'ground', power: 80 },
      'Crunch': { type: 'dark', power: 70 },
      'Earthquake': { type: 'ground', power: 110 },
      'Iron Head': { type: 'steel', power: 70 },
      'Play Rough': { type: 'fairy', power: 90 },
      'Shadow Sneak': { type: 'ghost', power: 50 },
      'Roar of Time': { type: 'dragon', power: 150 },
      'Aeroblast': { type: 'flying', power: 170 },
      'Surf': { type: 'water', power: 65 },
      'Origin Pulse': { type: 'water', power: 130 }
    };
    return customMoveNames.map((mName, idx) => {
      const existingMove = userActivePokemon.chargedMoves.find(m => m.name.toLowerCase() === mName.toLowerCase()) ||
        userActivePokemon.chargedMoves[idx];
      const override = CUSTOM_MOVE_STATS[mName];
      const resolved = resolveChargedMove(mName, userActivePokemon.types[0] || 'normal');
      const moveObj = {
        name: mName,
        code: resolved.code || mName.slice(0, 2).toUpperCase(),
        type: override?.type || resolved.type || existingMove?.type || userActivePokemon.types[0] || 'normal',
        power: override?.power || resolved.power || existingMove?.power || 80,
        energyCost: resolved.energyCost || existingMove?.energyCost || 50
      };
      const calc = calculateChargedDamage(userActivePokemon, activeOpponent, moveObj, isUserShadow, isOpponentShadow);
      return {
        move: moveObj,
        ...calc
      };
    });
  }, [userActivePokemon, activeOpponent, isUserShadow, isOpponentShadow, activeUserSlot]);

  // Fast move click handler in simulator
  const handleFastAttack = () => {
    const newTurns = userTurnsElapsed + 1;
    setUserTurnsElapsed(newTurns);
    const uFastGain = resolveFastMove(userActivePokemon, activeUserSlot?.fastMove)?.energyGain || userActivePokemon.defaultFastMove.energyGain || 8;
    const oFastGain = resolveFastMove(activeOpponent)?.energyGain || activeOpponent.defaultFastMove.energyGain || 8;
    setUserEnergy(prev => Math.min(100, prev + uFastGain));

    // Opponent also attacks
    setOppTurnsElapsed(prev => prev + 1);
    setOppEnergy(prev => Math.min(100, prev + oFastGain));
  };

  const applyLeagueTop3TemplateToForm = (league: LeagueType) => {
    const top3 = getLeagueTop3Template(league);
    setP1Name(top3[0].name);
    setP1Cp(top3[0].cp);
    setP1Ivs('');
    setP1Fast(top3[0].fastMove);
    setP1C1(top3[0].chargedMove1);
    setP1C2(top3[0].chargedMove2);
    setP1PlusLevel(top3[0].plusMoveLevel ?? 4);

    setP2Name(top3[1].name);
    setP2Cp(top3[1].cp);
    setP2Ivs('');
    setP2Fast(top3[1].fastMove);
    setP2C1(top3[1].chargedMove1);
    setP2C2(top3[1].chargedMove2);
    setP2PlusLevel(top3[1].plusMoveLevel ?? 4);

    setP3Name(top3[2].name);
    setP3Cp(top3[2].cp);
    setP3Ivs('');
    setP3Fast(top3[2].fastMove);
    setP3C1(top3[2].chargedMove1);
    setP3C2(top3[2].chargedMove2);
    setP3PlusLevel(top3[2].plusMoveLevel ?? 4);
  };

  const handleAutoFillSlotMoves = (
    slotIdx: 1 | 2 | 3,
    rawName: string,
    league: LeagueType,
    customIvs?: string
  ) => {
    const rec = getRecommendedMovesForPokemon(rawName, league, customIvs);
    if (!rec) return;
    if (slotIdx === 1) {
      if (!p1Fast.trim()) setP1Fast(rec.fastMove);
      if (!p1C1.trim()) setP1C1(rec.chargedMove1);
      if (!p1C2.trim()) setP1C2(rec.chargedMove2);
      if (!p1Cp || p1Cp <= 0) setP1Cp(rec.cp);
    } else if (slotIdx === 2) {
      if (!p2Fast.trim()) setP2Fast(rec.fastMove);
      if (!p2C1.trim()) setP2C1(rec.chargedMove1);
      if (!p2C2.trim()) setP2C2(rec.chargedMove2);
      if (!p2Cp || p2Cp <= 0) setP2Cp(rec.cp);
    } else {
      if (!p3Fast.trim()) setP3Fast(rec.fastMove);
      if (!p3C1.trim()) setP3C1(rec.chargedMove1);
      if (!p3C2.trim()) setP3C2(rec.chargedMove2);
      if (!p3Cp || p3Cp <= 0) setP3Cp(rec.cp);
    }
  };

  const handleSelectAutocompletePokemon = (slotIdx: 1 | 2 | 3, opt: PokemonAutocompleteOption) => {
    const customIvs = slotIdx === 1 ? p1Ivs : slotIdx === 2 ? p2Ivs : p3Ivs;
    const rec = getRecommendedMovesForPokemon(opt.name, newPresetLeague, customIvs);
    const fast = rec?.fastMove || opt.fastMove;
    const c1 = rec?.chargedMove1 || opt.chargedMove1;
    const c2 = rec?.chargedMove2 || opt.chargedMove2;
    const cp = rec?.cp || opt.cp;

    if (slotIdx === 1) {
      setP1Name(opt.name);
      setP1Fast(fast);
      setP1C1(c1);
      setP1C2(c2);
      setP1Cp(cp);
    } else if (slotIdx === 2) {
      setP2Name(opt.name);
      setP2Fast(fast);
      setP2C1(c1);
      setP2C2(c2);
      setP2Cp(cp);
    } else {
      setP3Name(opt.name);
      setP3Fast(fast);
      setP3C1(c1);
      setP3C2(c2);
      setP3Cp(cp);
    }
    setActiveAutocompleteSlot(null);
    setAutocompleteHighlightIdx(0);
  };

  const slot1Suggestions = useMemo(
    () => (activeAutocompleteSlot === 1 ? getPokemonAutocompleteSuggestions(p1Name, newPresetLeague, 18) : []),
    [activeAutocompleteSlot, p1Name, newPresetLeague]
  );
  const slot2Suggestions = useMemo(
    () => (activeAutocompleteSlot === 2 ? getPokemonAutocompleteSuggestions(p2Name, newPresetLeague, 18) : []),
    [activeAutocompleteSlot, p2Name, newPresetLeague]
  );
  const slot3Suggestions = useMemo(
    () => (activeAutocompleteSlot === 3 ? getPokemonAutocompleteSuggestions(p3Name, newPresetLeague, 18) : []),
    [activeAutocompleteSlot, p3Name, newPresetLeague]
  );

  const [modalRoleRecommendations, setModalRoleRecommendations] = useState<TeamRoleRecommendationsResult | null>(null);
  const [isSuggestingUpgrades, setIsSuggestingUpgrades] = useState<boolean>(false);
  const [modalMovesetRecommendations, setModalMovesetRecommendations] = useState<TeamMovesetOptimizationResult | null>(null);
  const [isSimulatingMovesets, setIsSimulatingMovesets] = useState<boolean>(false);

  const openCreatePresetModal = () => {
    const defaultLeague: LeagueType =
      appCombatMode === 'show6'
        ? isBattleFrontierLeague(activePreset?.league)
          ? activePreset.league
          : 'Battle Frontier (Spectral)'
        : activePreset?.league && !isBattleFrontierLeague(activePreset.league)
        ? activePreset.league
        : 'GREAT LEAGUE';
    setEditingPresetId(null);
    setNewPresetName('');
    setNewPresetLeague(defaultLeague);
    setManualArchetypeOverride(undefined);
    setModalAutoDetectSummary(null);
    setModalRoleRecommendations(null);
    setModalMovesetRecommendations(null);
    applyLeagueTop3TemplateToForm(defaultLeague);
    setIsNewPresetOpen(true);
  };

  const openEditPresetModal = (preset: TeamPreset) => {
    setEditingPresetId(preset.id);
    setNewPresetName(preset.name);
    setNewPresetLeague(preset.league);
    setManualArchetypeOverride(preset.isArchetypeManual ? preset.archetype : undefined);
    setModalAutoDetectSummary(null);
    setModalRoleRecommendations(null);
    setModalMovesetRecommendations(null);
    const s1 = preset.pokemon[0];
    const s2 = preset.pokemon[1];
    const s3 = preset.pokemon[2];
    if (s1) {
      setP1Name(s1.name);
      setP1Cp(s1.cp);
      setP1Ivs(s1.ivs || '');
      setP1Fast(s1.fastMove);
      setP1C1(s1.chargedMove1);
      setP1C2(s1.chargedMove2);
      setP1PlusLevel(s1.plusMoveLevel ?? 4);
    }
    if (s2) {
      setP2Name(s2.name);
      setP2Cp(s2.cp);
      setP2Ivs(s2.ivs || '');
      setP2Fast(s2.fastMove);
      setP2C1(s2.chargedMove1);
      setP2C2(s2.chargedMove2);
      setP2PlusLevel(s2.plusMoveLevel ?? 4);
    }
    if (s3) {
      setP3Name(s3.name);
      setP3Cp(s3.cp);
      setP3Ivs(s3.ivs || '');
      setP3Fast(s3.fastMove);
      setP3C1(s3.chargedMove1);
      setP3C2(s3.chargedMove2);
      setP3PlusLevel(s3.plusMoveLevel ?? 4);
    }
    setModalCloneTargetLeague(preset.league);
    setIsNewPresetOpen(true);
  };

  const buildModalMembersArray = (): TeamMember[] => {
    const top3 = getLeagueTop3Template(newPresetLeague);
    const resolveSlot = (
      id: string,
      rawName: string,
      rawCp: number,
      rawFast: string,
      rawC1: string,
      rawC2: string,
      rawIvs: string,
      plusMoveLevel: number,
      fallback: TeamMember
    ): TeamMember => {
      const finalName = rawName.trim() || fallback.name;
      const cleanIvs = rawIvs.trim() || undefined;
      const rec = getRecommendedMovesForPokemon(finalName, newPresetLeague, cleanIvs);
      return {
        id,
        name: finalName,
        cp: rawCp > 0 ? rawCp : rec?.cp || fallback.cp,
        fastMove: rawFast.trim() || rec?.fastMove || fallback.fastMove,
        chargedMove1: rawC1.trim() || rec?.chargedMove1 || fallback.chargedMove1,
        chargedMove2: rawC2.trim() || rec?.chargedMove2 || fallback.chargedMove2,
        ivs: cleanIvs,
        plusMoveLevel: Math.max(0, Math.min(4, plusMoveLevel ?? 4))
      };
    };
    return [
      resolveSlot('p1', p1Name, p1Cp, p1Fast, p1C1, p1C2, p1Ivs, p1PlusLevel, top3[0]),
      resolveSlot('p2', p2Name, p2Cp, p2Fast, p2C1, p2C2, p2Ivs, p2PlusLevel, top3[1]),
      resolveSlot('p3', p3Name, p3Cp, p3Fast, p3C1, p3C2, p3Ivs, p3PlusLevel, top3[2])
    ];
  };

  const applyOrderedMembersToModalForm = (ordered: TeamMember[]) => {
    const [m1, m2, m3] = ordered;
    if (m1) {
      setP1Name(m1.name);
      setP1Cp(m1.cp);
      setP1Ivs(m1.ivs || '');
      setP1Fast(m1.fastMove);
      setP1C1(m1.chargedMove1);
      setP1C2(m1.chargedMove2);
      setP1PlusLevel(m1.plusMoveLevel ?? 4);
    }
    if (m2) {
      setP2Name(m2.name);
      setP2Cp(m2.cp);
      setP2Ivs(m2.ivs || '');
      setP2Fast(m2.fastMove);
      setP2C1(m2.chargedMove1);
      setP2C2(m2.chargedMove2);
      setP2PlusLevel(m2.plusMoveLevel ?? 4);
    }
    if (m3) {
      setP3Name(m3.name);
      setP3Cp(m3.cp);
      setP3Ivs(m3.ivs || '');
      setP3Fast(m3.fastMove);
      setP3C1(m3.chargedMove1);
      setP3C2(m3.chargedMove2);
      setP3PlusLevel(m3.plusMoveLevel ?? 4);
    }
  };

  const modalLiveEvaluation = useMemo(() => {
    const members = buildModalMembersArray();
    if (siteView !== 'app' || !isNewPresetOpen) {
      return {
        orderedPokemon: members,
        archetype: (manualArchetypeOverride || 'ABC') as TeamArchetype,
        sharedWeaknesses: [],
        leadAggBr: 525,
        machineAggBr: 600,
        safeSwapBr: 520,
        closerSwapBr: 520,
        closerBr: 525,
        seasonMatchCount: 0,
        wHistPct: 0,
        wMetaPct: 100,
        slotMetrics: [],
        topMetaTargetsTotal: 50,
        topMetaWinsCount: 35,
        keyMetaTargetsBeaten: [],
        keyThreats: [],
        coreBreakers: [],
        altMovesetSlots: [],
        synergySummary: 'Open Team Editor to evaluate live role & meta metrics.',
        reasonSummary: 'Open Team Editor to evaluate live role & meta metrics.'
      };
    }
    return evaluateOrAutoOrderTeam(
      members,
      newPresetLeague,
      battleLogs,
      activeSeasonBounds.startMs,
      activeSeasonBounds.endMs,
      false,
      manualArchetypeOverride
    );
  }, [
    siteView,
    isNewPresetOpen,
    p1Name, p1Cp, p1Ivs, p1Fast, p1C1, p1C2, p1PlusLevel,
    p2Name, p2Cp, p2Ivs, p2Fast, p2C1, p2C2, p2PlusLevel,
    p3Name, p3Cp, p3Ivs, p3Fast, p3C1, p3C2, p3PlusLevel,
    newPresetLeague,
    manualArchetypeOverride,
    battleLogs,
    activeSeasonBounds.startMs,
    activeSeasonBounds.endMs
  ]);

  const handleAutoDetectAndOrderModal = () => {
    const members = buildModalMembersArray();
    const res = evaluateOrAutoOrderTeam(
      members,
      newPresetLeague,
      battleLogs,
      activeSeasonBounds.startMs,
      activeSeasonBounds.endMs,
      true,
      manualArchetypeOverride
    );
    applyOrderedMembersToModalForm(res.orderedPokemon);
    if (editingPresetId) {
      setPresets((prev) =>
        prev.map((p) => {
          if (p.id !== editingPresetId) return p;
          return {
            ...p,
            league: newPresetLeague,
            pokemon: res.orderedPokemon,
            archetype: res.archetype,
            isArchetypeManual: !!manualArchetypeOverride,
            leadAggBr: res.leadAggBr,
            machineAggBr: res.machineAggBr,
            safeSwapBr: res.safeSwapBr,
            closerSwapBr: res.closerSwapBr,
            sharedWeaknesses: res.sharedWeaknesses,
            topMetaTargetsTotal: res.topMetaTargetsTotal,
            topMetaWinsCount: res.topMetaWinsCount,
            keyMetaTargetsBeaten: res.keyMetaTargetsBeaten,
            keyThreats: res.keyThreats,
            coreBreakers: res.coreBreakers,
            altMovesetSlots: res.altMovesetSlots,
            synergySummary: res.synergySummary
          };
        })
      );
    }
    const s1 = res.orderedPokemon[0];
    const s2 = res.orderedPokemon[1];
    const s3 = res.orderedPokemon[2];
    if (res.archetype === 'ABB') {
      const sharedStr = res.sharedWeaknesses.length > 0 ? res.sharedWeaknesses.join(', ').toUpperCase() : 'shared meta';
      setModalAutoDetectSummary(
        `⚡ Auto-Detected ABB Lineup (Shared ${sharedStr} weakness covered by ${s1.name}) • Summary & Key Wins/Threats/Core Breakers Updated → #1 Lead (A): ${s1.name} (Lead BR ${res.leadAggBr}) • #2 Bait Swap (B1): ${s2.name} (Swap BR ${res.safeSwapBr}) • #3 Sweeper (B2): ${s3.name} (Closer BR ${res.closerSwapBr})`
      );
    } else if (res.archetype === 'DUO') {
      setModalAutoDetectSummary(
        `⚡ Auto-Detected Duo-Core (Yin & Yang Reciprocal Core: ${s1.name} + ${s3.name} cover each other's weaknesses; Slot 1 & 3 can swap to adapt to meta) → #1 Core 1 Lead: ${s1.name} (Lead BR ${res.leadAggBr}) • #2 Pivot Safe Swap: ${s2.name} (Swap BR ${res.safeSwapBr}) • #3 Core 2 Co-Core: ${s3.name} (Closer BR ${res.closerSwapBr})`
      );
    } else {
      setModalAutoDetectSummary(
        `⚡ Auto-Detected ABC Balanced Core • Summary & Key Wins/Threats/Core Breakers Updated → #1 Lead: ${s1.name} (Lead BR ${res.leadAggBr}) • #2 Safe Swap: ${s2.name} (Swap BR ${res.safeSwapBr}) • #3 Closer: ${s3.name} (Closer BR ${res.closerSwapBr})`
      );
    }
  };

  const handleSwapModalSlots = (slotA: 1 | 2 | 3, slotB: 1 | 2 | 3) => {
    const members = buildModalMembersArray();
    const idxA = slotA - 1;
    const idxB = slotB - 1;
    const next = [...members];
    const temp = next[idxA];
    next[idxA] = { ...next[idxB], id: `p${slotA}` };
    next[idxB] = { ...temp, id: `p${slotB}` };
    applyOrderedMembersToModalForm(next);
    setModalAutoDetectSummary(`⇄ Swapped Slot ${slotA} (${next[idxA].name}) and Slot ${slotB} (${next[idxB].name})`);
  };

  const handleSuggestRoleUpgradesModal = () => {
    setIsSuggestingUpgrades(true);
    setTimeout(() => {
      try {
        const members = buildModalMembersArray();
        const res = recommendTop3UpgradesPerRole(
          members,
          newPresetLeague,
          battleLogs,
          activeSeasonBounds.startMs,
          activeSeasonBounds.endMs,
          manualArchetypeOverride
        );
        setModalRoleRecommendations(res);
        setModalAutoDetectSummary(
          `✨ Top-200 Role Upgrades Ready (${res.candidatesEvaluated} meta candidates simulated for ${newPresetLeague}) — Tap any of the Top 5 green chips below Slot 1, Slot 2, or Slot 3 to apply!`
        );
      } finally {
        setIsSuggestingUpgrades(false);
      }
    }, 10);
  };

  const handleApplyRoleUpgradeChip = (slotIdx: 1 | 2 | 3, sug: RoleUpgradeSuggestion) => {
    const members = buildModalMembersArray();
    const next = [...members];
    next[slotIdx - 1] = { ...sug.candidate, id: `p${slotIdx}` };
    applyOrderedMembersToModalForm(next);
    const updatedRecs = recommendTop3UpgradesPerRole(
      next,
      newPresetLeague,
      battleLogs,
      activeSeasonBounds.startMs,
      activeSeasonBounds.endMs,
      manualArchetypeOverride
    );
    setModalRoleRecommendations(updatedRecs);
    const machSign = sug.deltaMachBr >= 0 ? `+${sug.deltaMachBr}` : `${sug.deltaMachBr}`;
    const roleSign = sug.deltaRoleBr >= 0 ? `+${sug.deltaRoleBr}` : `${sug.deltaRoleBr}`;
    setModalAutoDetectSummary(
      `✅ Replaced Slot ${slotIdx} (${sug.roleLabel}) with ${sug.candidate.name} (${roleSign} Role BR • ${machSign} Team Core BR)`
    );
  };

  const handleOptimizeTeamMovesetsModal = () => {
    setIsSimulatingMovesets(true);
    setTimeout(() => {
      try {
        const members = buildModalMembersArray();
        const res = recommendTop3AlternateMovesetsForTeam(
          members,
          newPresetLeague,
          battleLogs,
          activeSeasonBounds.startMs,
          activeSeasonBounds.endMs,
          manualArchetypeOverride
        );
        setModalMovesetRecommendations(res);
        const top1 = res.top3OverallMovesets[0];
        const topSummary = top1
          ? `Best move swap: ${top1.pokemonName} → ${top1.proposedFastMove} + ${top1.proposedChargedMove1}/${top1.proposedChargedMove2} (${top1.deltaMachineBr >= 0 ? `+${top1.deltaMachineBr}` : top1.deltaMachineBr} Team Core BR, ${top1.deltaRoleBr >= 0 ? `+${top1.deltaRoleBr}` : top1.deltaRoleBr} ${top1.roleLabel} BR)`
          : 'Current movesets are already optimal!';
        setModalAutoDetectSummary(
          `🎯 Simulated ${res.totalCombosSimulated} move combinations for your current team (75% default + 25% alt weighted 9x9 matrix) — ${topSummary}`
        );
      } finally {
        setIsSimulatingMovesets(false);
      }
    }, 10);
  };

  const handleApplyMovesetUpgradeChip = (sug: AlternateMovesetSuggestion) => {
    const members = buildModalMembersArray();
    const next = [...members];
    const idx = sug.slotIndex;
    if (next[idx]) {
      next[idx] = {
        ...next[idx],
        fastMove: sug.proposedFastMove,
        chargedMove1: sug.proposedChargedMove1,
        chargedMove2: sug.proposedChargedMove2
      };
    }
    applyOrderedMembersToModalForm(next);
    const updatedMoves = recommendTop3AlternateMovesetsForTeam(
      next,
      newPresetLeague,
      battleLogs,
      activeSeasonBounds.startMs,
      activeSeasonBounds.endMs,
      manualArchetypeOverride
    );
    setModalMovesetRecommendations(updatedMoves);
    const machSign = sug.deltaMachineBr >= 0 ? `+${sug.deltaMachineBr}` : `${sug.deltaMachineBr}`;
    const leadSign = sug.deltaLeadAggBr >= 0 ? `+${sug.deltaLeadAggBr}` : `${sug.deltaLeadAggBr}`;
    const roleSign = sug.deltaRoleBr >= 0 ? `+${sug.deltaRoleBr}` : `${sug.deltaRoleBr}`;
    setModalAutoDetectSummary(
      `✅ Applied Moveset to Slot ${sug.slotIndex + 1} (${sug.pokemonName}): ${sug.proposedFastMove} + ${sug.proposedChargedMove1}/${sug.proposedChargedMove2} (${roleSign} ${sug.roleLabel} Positional BR • ${machSign} Team Core BR • ${leadSign} Team Lead BR)`
    );
  };

  const handleAutoDetectSavedPreset = (presetId: string) => {
    setPresets((prev) =>
      prev.map((p) => {
        if (p.id !== presetId) return p;
        return evaluateTeamPresetMetrics(
          p,
          battleLogs,
          activeSeasonBounds.startMs,
          activeSeasonBounds.endMs,
          true
        );
      })
    );
  };

  const handleSwapSavedPresetSlots = (presetId: string, idxA: number, idxB: number) => {
    setPresets((prev) =>
      prev.map((p) => {
        if (p.id !== presetId || p.pokemon.length < 3) return p;
        const nextMons = [...p.pokemon];
        const tmp = nextMons[idxA];
        nextMons[idxA] = { ...nextMons[idxB], id: `p${idxA + 1}` };
        nextMons[idxB] = { ...tmp, id: `p${idxB + 1}` };
        return evaluateTeamPresetMetrics(
          { ...p, pokemon: nextMons },
          battleLogs,
          activeSeasonBounds.startMs,
          activeSeasonBounds.endMs,
          false
        );
      })
    );
  };

  // Handle Preset Creation or Editing (auto-fills any blank moves or CP from PvPoke recommendations)
  const handleCreatePreset = (e: React.FormEvent) => {
    e.preventDefault();
    const targetId = editingPresetId || `preset-${Date.now()}`;
    const members = buildModalMembersArray();

    if (hasMultipleMegas(members)) {
      setStartBattleToast('⚠️ Each team can only contain at most 1 Mega/Primal Pokémon!');
      setTimeout(() => setStartBattleToast(null), 2600);
      return;
    }

    const basePreset: TeamPreset = {
      id: targetId,
      name: newPresetName.trim() || `${newPresetLeague} Custom`,
      league: newPresetLeague,
      pokemon: members,
      archetype: manualArchetypeOverride,
      isArchetypeManual: !!manualArchetypeOverride,
      combatMode: appCombatMode
    };

    const savedPreset = evaluateTeamPresetMetrics(
      basePreset,
      battleLogs,
      activeSeasonBounds.startMs,
      activeSeasonBounds.endMs,
      false
    );

    setPresets(prev => {
      const idx = prev.findIndex(p => p.id === targetId);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = savedPreset;
        return next;
      }
      return [...prev, savedPreset];
    });
    setSelectedPresetId(targetId);
    setIsNewPresetOpen(false);
    setEditingPresetId(null);
    setModalAutoDetectSummary(null);
  };

  // Clone any 3-Pokémon Team Preset inside the Edit Team Modal (supports changing Target League/Meta)
  const handleClonePreset3 = (preset: TeamPreset, targetLeagueOverride?: LeagueType) => {
    const destLeague = targetLeagueOverride || preset.league;
    const rawMembers = isNewPresetOpen ? buildModalMembersArray() : preset.pokemon;
    if (hasMultipleMegas(rawMembers)) {
      setStartBattleToast('⚠️ Max 1 Mega/Primal Pokémon allowed per team of 3!');
      setTimeout(() => setStartBattleToast(null), 2600);
      return;
    }
    const rescaled =
      destLeague !== preset.league ? rescaleTeamMembersForLeague(rawMembers, destLeague) : rawMembers;
    const newId = `preset-clone-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const baseName = (isNewPresetOpen ? newPresetName.trim() : preset.name) || preset.name;
    const clonedBase: TeamPreset = {
      ...preset,
      id: newId,
      name: destLeague !== preset.league ? `${baseName} (${destLeague.split(' ')[0]})` : `${baseName} (Copy)`,
      league: destLeague,
      pokemon: rescaled.map((p, idx) => ({ ...p, id: `p${idx + 1}` })),
      combatMode: appCombatMode
    };
    const evaluated = evaluateTeamPresetMetrics(
      clonedBase,
      battleLogs,
      activeSeasonBounds.startMs,
      activeSeasonBounds.endMs,
      false
    );
    setPresets((prev) => [evaluated, ...prev]);
    setSelectedPresetId(newId);
    openEditPresetModal(evaluated);
    setStartBattleToast(`📋 Cloned as new team in ${destLeague} — now editing "${evaluated.name}"!`);
    setTimeout(() => setStartBattleToast(null), 2600);
  };

  // Bidirectional Copy between Standard GBL (Blind 3) and Show 6 (Trio of 3 OR Auto-Filled Roster of 6) inside Edit Team Modal
  const handleCopyPreset3CrossMode = (
    preset: TeamPreset,
    targetMode: 'show6_trio' | 'show6_autofill6' | 'gbl_blind3',
    targetLeagueOverride?: LeagueType
  ) => {
    const rawMembers = isNewPresetOpen ? buildModalMembersArray() : preset.pokemon;
    const sourceName = (isNewPresetOpen ? newPresetName.trim() : preset.name) || preset.name;
    if (hasMultipleMegas(rawMembers)) {
      setStartBattleToast('⚠️ Max 1 Mega/Primal Pokémon allowed per team!');
      setTimeout(() => setStartBattleToast(null), 2600);
      return;
    }

    if (targetMode === 'show6_trio') {
      const defaultShow6Lg: LeagueType =
        preset.league === 'ULTRA LEAGUE'
          ? 'Battle Frontier (Cauldron)'
          : preset.league === 'MASTER LEAGUE' || preset.league === 'MEGA MASTER LEAGUE'
          ? 'Battle Frontier (Master)'
          : isShow6EligibleLeague(preset.league)
          ? preset.league
          : 'GREAT LEAGUE';
      const targetShow6League: LeagueType =
        targetLeagueOverride && isShow6EligibleLeague(targetLeagueOverride)
          ? targetLeagueOverride
          : defaultShow6Lg;
      const rescaled = rescaleTeamMembersForLeague(rawMembers, targetShow6League);
      const newId = `show6-from-gbl3-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const basePreset: TeamPreset = {
        id: newId,
        name: `[From GBL] ${sourceName}`,
        league: targetShow6League,
        pokemon: rescaled.map((m, idx) => ({ ...m, id: `p${idx + 1}` })),
        archetype: preset.archetype,
        isArchetypeManual: preset.isArchetypeManual,
        combatMode: 'show6'
      };
      const evaluated = evaluateTeamPresetMetrics(
        basePreset,
        show6BattleLogs,
        activeSeasonBounds.startMs,
        activeSeasonBounds.endMs,
        false
      );
      setShow6Presets3((prev) => [evaluated, ...prev]);
      setShow6SelectedPreset3Id(newId);
      setAppCombatModeState('show6');
      try {
        localStorage.setItem('gbl_app_combat_mode', 'show6');
      } catch {}
      openEditPresetModal(evaluated);
      setStartBattleToast(`🏛️ Cloned "${sourceName}" as a separate Show 6 Trio (${targetShow6League})!`);
      setTimeout(() => setStartBattleToast(null), 2600);
      return;
    }

    if (targetMode === 'show6_autofill6') {
      const defaultShow6Lg: LeagueType =
        preset.league === 'ULTRA LEAGUE'
          ? 'Battle Frontier (Cauldron)'
          : preset.league === 'MASTER LEAGUE' || preset.league === 'MEGA MASTER LEAGUE'
          ? 'Battle Frontier (Master)'
          : isShow6EligibleLeague(preset.league)
          ? preset.league
          : 'Battle Frontier (Spectral)';
      const targetShow6League: LeagueType =
        targetLeagueOverride && isShow6EligibleLeague(targetLeagueOverride)
          ? targetLeagueOverride
          : defaultShow6Lg;
      const locked3Names = rawMembers.map((p) => p.name);
      const blindRes = generateBlindShow6Roster({
        league: targetShow6League,
        lockedCoreNames: locked3Names,
        metaFilterMode: 'OPEN',
        historicalExpectedNames: getMostLikelyMetaOpponent6ForFormat(targetShow6League).pokemonNames,
        historicalWeightPct: 35
      });
      const origByClean = new Map<string, TeamMember>();
      for (const m of rescaleTeamMembersForLeague(rawMembers, targetShow6League)) {
        origByClean.set(m.name.toLowerCase(), m);
      }
      const final6Members: TeamMember[] = blindRes.roster6.map((m, idx) => {
        const matchOrig = origByClean.get(m.name.toLowerCase());
        return matchOrig ? { ...matchOrig, id: `s6-af-${idx + 1}` } : { ...m, id: `s6-af-${idx + 1}` };
      });
      const newRosterId = `show6-autofill6-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const createdRoster: Show6RosterOf6Preset = {
        id: newRosterId,
        name: `[Auto-6 from GBL] ${locked3Names.map((n) => n.split(' ')[0]).join('/')} + 3`,
        league: targetShow6League,
        pokemon: final6Members,
        notes: `Built from Blind 3 preset "${sourceName}" + 3 synergistic meta/core partners`,
        updatedAt: Date.now()
      };
      setShow6Rosters6((prev) => [createdRoster, ...prev]);
      setSelectedShow6Roster6Id(newRosterId);
      const nextNames = final6Members.map((m) => m.name);
      setShow6Pick3League(targetShow6League);
      setShow6My6(nextNames);
      handleRunShow6Pick3Optimizer(targetShow6League, nextNames, show6Opponent6);
      setIsNewPresetOpen(false);
      setAppCombatModeState('show6');
      try {
        localStorage.setItem('gbl_app_combat_mode', 'show6');
      } catch {}
      openShow6RosterEditor(createdRoster, 'MY', false);
      setStartBattleToast(
        `🏛️ Locked ${locked3Names.join('/')} & Auto-Filled 3 Partners for Show 6 (${targetShow6League})!`
      );
      setTimeout(() => setStartBattleToast(null), 2800);
      return;
    }

    // targetMode === 'gbl_blind3': Copy Show 6 Trio of 3 -> Standard GBL Blind 3 as a separate entry
    const hasMega = rawMembers.some((m) => isMegaOrPrimalSpecies(m.name));
    const defaultGblLg: LeagueType =
      preset.league === 'Battle Frontier (Cauldron)' || getLeagueCpCap(preset.league) === 2500
        ? 'ULTRA LEAGUE'
        : preset.league === 'Battle Frontier (Master)' || getLeagueCpCap(preset.league) === 10000
        ? hasMega
          ? 'MEGA MASTER LEAGUE'
          : 'MASTER LEAGUE'
        : 'GREAT LEAGUE';
    const targetGblLeague: LeagueType = targetLeagueOverride || defaultGblLg;
    const rescaled = rescaleTeamMembersForLeague(rawMembers, targetGblLeague);
    const newId = `gbl-from-s6trio-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const basePreset: TeamPreset = {
      id: newId,
      name: `[From Show 6] ${sourceName.replace(/^Show 6\s+/i, '')}`,
      league: targetGblLeague,
      pokemon: rescaled.map((m, idx) => ({ ...m, id: `p${idx + 1}` })),
      archetype: preset.archetype,
      isArchetypeManual: preset.isArchetypeManual,
      combatMode: 'gbl'
    };
    const evaluated = evaluateTeamPresetMetrics(
      basePreset,
      gblBattleLogs,
      activeSeasonBounds.startMs,
      activeSeasonBounds.endMs,
      false
    );
    setGblPresets((prev) => [evaluated, ...prev]);
    setGblSelectedPresetId(newId);
    setAppCombatModeState('gbl');
    try {
      localStorage.setItem('gbl_app_combat_mode', 'gbl');
    } catch {}
    openEditPresetModal(evaluated);
    setStartBattleToast(`🛡️ Cloned "${sourceName}" as a separate Standard GBL team (${targetGblLeague})!`);
    setTimeout(() => setStartBattleToast(null), 2600);
  };

  // Swap a Show 6 Trio (3-mon card) into Opponent's 6 in the 6v6 Pick-3 Simulator
  const handleSwapShow6TrioToOpp6 = (preset: TeamPreset) => {
    const targetLeague: LeagueType = isShow6EligibleLeague(preset.league)
      ? preset.league
      : 'Battle Frontier (Spectral)';
    const trioNames = preset.pokemon.map((p) => p.name);
    const formatMetaOpp = getMostLikelyMetaOpponent6ForFormat(targetLeague).pokemonNames;
    const combinedOpp6: string[] = [...trioNames];
    for (const cand of [...show6Opponent6, ...formatMetaOpp]) {
      if (combinedOpp6.length >= 6) break;
      if (!combinedOpp6.some((n) => n.toLowerCase() === cand.toLowerCase())) {
        combinedOpp6.push(cand);
      }
    }
    setShow6Pick3League(targetLeague);
    setShow6Opponent6(combinedOpp6.slice(0, 6));
    handleRunShow6Pick3Optimizer(targetLeague, show6My6, combinedOpp6.slice(0, 6));
    setStartBattleToast(`⇄ Loaded Trio (${trioNames.join('/')}) into Opponent's 6 in Pick-3 Simulator!`);
    setTimeout(() => setStartBattleToast(null), 2400);
  };

  // Anti-Meta Team Builder: Generate Best ABB + ABC + Duo Teams (Tier-Gated in v7.00) & Select Option to Create + Open Edit Modal
  const handleGenerateAntiMetaTeams = (
    overrideLeague?: LeagueType,
    overrideFeat1?: string,
    overrideFeat2?: string
  ) => {
    const targetLeague = overrideLeague || antiMetaLeague;
    const normLg = normalizeLeagueName(targetLeague);
    const isGlOrMl = normLg === 'GREAT LEAGUE' || normLg === 'MASTER LEAGUE';
    const isCore3 = isGlOrMl || normLg === 'ULTRA LEAGUE';
    if (webMembershipTier === 'free' && !isGlOrMl) {
      setShowMembershipModal(true);
      setMembershipStatusMsg(`🔒 ${targetLeague} requires Lifetime Supporter ($2) for Ultra League or Legend Pro ($3 Intro / $6 Season) for Limited/Mega Cups!`);
      return;
    }
    if (webMembershipTier === 'supporter' && !isCore3) {
      setShowMembershipModal(true);
      setMembershipStatusMsg(`🏆 ${targetLeague} is a Limited/Mega Cup and requires Legend Pro ($3 First-Season Intro / $6 Season Pass)!`);
      return;
    }
    const f1 = (overrideFeat1 !== undefined ? overrideFeat1 : antiMetaFeat1).trim();
    const f2 = (overrideFeat2 !== undefined ? overrideFeat2 : antiMetaFeat2).trim();
    const featuredList = [f1, f2].filter((s) => s.length > 0);
    setIsGeneratingAntiMeta(true);
    setTimeout(() => {
      try {
        const res = generateAntiMetaTeamOptions(
          targetLeague,
          featuredList,
          battleLogs,
          activeSeasonBounds
        );
        const maxPerArch = webMembershipTier === 'pro' || webMembershipTier === 'vip' ? 5 : webMembershipTier === 'supporter' ? 2 : 1;
        setAntiMetaResult({
          ...res,
          top5AbbTeams: res.top5AbbTeams.slice(0, maxPerArch),
          top5AbcTeams: res.top5AbcTeams.slice(0, maxPerArch),
          top5DuoTeams: (res.top5DuoTeams || []).slice(0, maxPerArch)
        });
      } finally {
        setIsGeneratingAntiMeta(false);
      }
    }, 20);
  };

  useEffect(() => {
    if (siteView !== 'app' || activeTab !== 'presets' || !showAntiMetaBuilder) return;
    const normTarget = normalizeLeagueName(antiMetaLeague);
    if (antiMetaResult && antiMetaResult.league === normTarget) return;
    let cancelled = false;
    setIsGeneratingAntiMeta(true);
    const timer = setTimeout(() => {
      if (cancelled) return;
      try {
        const featuredList = [antiMetaFeat1.trim(), antiMetaFeat2.trim()].filter((s) => s.length > 0);
        const res = generateAntiMetaTeamOptions(
          antiMetaLeague,
          featuredList,
          battleLogs,
          activeSeasonBounds
        );
        if (cancelled) return;
        const maxPerArch = webMembershipTier === 'pro' || webMembershipTier === 'vip' ? 5 : webMembershipTier === 'supporter' ? 2 : 1;
        setAntiMetaResult({
          ...res,
          top5AbbTeams: res.top5AbbTeams.slice(0, maxPerArch),
          top5AbcTeams: res.top5AbcTeams.slice(0, maxPerArch),
          top5DuoTeams: (res.top5DuoTeams || []).slice(0, maxPerArch)
        });
      } finally {
        if (!cancelled) setIsGeneratingAntiMeta(false);
      }
    }, 25);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [siteView, activeTab, showAntiMetaBuilder, antiMetaLeague, webMembershipTier]);

  const handleSelectAntiMetaTeamOption = (option: AntiMetaTeamOption) => {
    const newId = `preset-antimeta-${Date.now()}`;
    const defaultName = formatAntiMetaDefaultTeamName(option.league, new Date());
    const createdPreset: TeamPreset = evaluateTeamPresetMetrics(
      {
        id: newId,
        name: defaultName,
        league: option.league as LeagueType,
        pokemon: option.pokemon.map((m, idx) => ({
          ...m,
          id: `p${idx + 1}`
        })),
        archetype: option.archetype,
        isArchetypeManual: true,
        sharedWeaknesses: option.sharedWeaknesses
      },
      battleLogs,
      activeSeasonBounds.startMs,
      activeSeasonBounds.endMs,
      false
    );

    setPresets((prev) => [createdPreset, ...prev]);
    setSelectedPresetId(newId);
    setStartBattleToast(`✨ Created "${defaultName}" — Opening Team Editor`);
    setTimeout(() => setStartBattleToast(null), 2600);
    // Immediately open the Edit Team modal so user can modify like any other team (Requirement 2c)
    openEditPresetModal(createdPreset);
  };

  const handleDeletePreset = (id: string) => {
    if (presets.length <= 1) {
      return;
    }
    const target = presets.find((p) => p.id === id);
    if (target) {
      saveDeletedTeamsTrashToStorage([target, ...deletedTeamsTrash.filter((t) => t.id !== id)]);
      setDeletedTeamIds((prev) => {
        const next = Array.from(new Set([...prev, id]));
        try {
          localStorage.setItem('gbl_deleted_team_ids_v1', JSON.stringify(next));
        } catch {}
        return next;
      });
    }
    const updated = presets.filter(p => p.id !== id);
    setPresets(updated);
    if (selectedPresetId === id) {
      setSelectedPresetId(updated[0].id);
    }
    if (target) {
      triggerUndoBanner(`🗑️ Team '${target.name}' moved to Trash`, () => {
        restoreTeamPresetsFromTrash([target]);
      });
    }
  };


  const modeBannerWord = appCombatMode === 'show6' ? 'Show 6' : 'GBL';

  return (
    <div
      className="theme-surface min-h-screen flex flex-col font-sans selection:bg-sky-500 selection:text-white relative overflow-x-hidden transition-colors duration-200"
      style={{
        backgroundColor: activeTheme.bgHex,
        color: activeTheme.textPrimaryHex
      }}
    >
      {/* Dynamic CSS Theme Surface, Dual-Accent & Page Transparency Overrides */}
      <style>{`
        .theme-surface .bg-slate-900:not(.overlay-hud-preserve *),
        .theme-surface .bg-slate-900\\/80:not(.overlay-hud-preserve *),
        .theme-surface .bg-slate-900\\/90:not(.overlay-hud-preserve *),
        .theme-surface .bg-slate-900\\/70:not(.overlay-hud-preserve *),
        .theme-surface .bg-slate-900\\/60:not(.overlay-hud-preserve *) {
          background-color: color-mix(in srgb, ${activeTheme.cardHex} ${showThemeWatermark && activeTheme.emblemType !== 'none' ? '74%' : '96%'}, transparent) !important;
        }
        .theme-surface .bg-slate-950:not(.overlay-hud-preserve *),
        .theme-surface .bg-slate-950\\/70:not(.overlay-hud-preserve *),
        .theme-surface .bg-slate-950\\/80:not(.overlay-hud-preserve *),
        .theme-surface .bg-slate-950\\/60:not(.overlay-hud-preserve *),
        .theme-surface .bg-slate-950\\/90:not(.overlay-hud-preserve *) {
          background-color: color-mix(in srgb, ${activeTheme.cardAltHex} ${showThemeWatermark && activeTheme.emblemType !== 'none' ? '68%' : '94%'}, transparent) !important;
        }
        .theme-surface .bg-slate-800:not(.overlay-hud-preserve *),
        .theme-surface .bg-slate-800\\/60:not(.overlay-hud-preserve *) {
          background-color: color-mix(in srgb, ${activeTheme.cardAltHex} ${showThemeWatermark && activeTheme.emblemType !== 'none' ? '76%' : '95%'}, ${activeTheme.accentSecondaryHex} 14%) !important;
          border-color: color-mix(in srgb, ${activeTheme.borderHex} 70%, ${activeTheme.accentSecondaryHex} 30%) !important;
        }
        .theme-surface .border-slate-800:not(.overlay-hud-preserve *),
        .theme-surface .border-slate-700:not(.overlay-hud-preserve *),
        .theme-surface .border-slate-800\\/80:not(.overlay-hud-preserve *),
        .theme-surface .border-slate-700\\/60:not(.overlay-hud-preserve *) {
          border-color: ${activeTheme.borderHex} !important;
        }
        .theme-surface .bg-sky-500:not(.overlay-hud-preserve *),
        .theme-surface .bg-sky-600:not(.overlay-hud-preserve *),
        .theme-surface .bg-blue-600:not(.overlay-hud-preserve *) {
          background-color: ${activeTheme.accentHex} !important;
          color: ${activeTheme.isLight ? '#FFFFFF' : '#080C14'} !important;
        }
        .theme-surface .bg-emerald-600:not(.overlay-hud-preserve *) {
          background-color: ${activeTheme.accentSecondaryHex} !important;
          color: ${activeTheme.isLight ? '#FFFFFF' : '#080C14'} !important;
        }
        .theme-surface .bg-emerald-600\\/25:not(.overlay-hud-preserve *),
        .theme-surface .bg-purple-600\\/25:not(.overlay-hud-preserve *) {
          background-color: color-mix(in srgb, ${activeTheme.accentSecondaryHex} 22%, transparent) !important;
          border-color: color-mix(in srgb, ${activeTheme.accentSecondaryHex} 60%, transparent) !important;
          color: ${activeTheme.accentSecondaryHex} !important;
        }
        .theme-surface .bg-sky-500\\/20:not(.overlay-hud-preserve *),
        .theme-surface .bg-sky-500\\/15:not(.overlay-hud-preserve *),
        .theme-surface .bg-sky-500\\/10:not(.overlay-hud-preserve *),
        .theme-surface .bg-sky-600\\/25:not(.overlay-hud-preserve *) {
          background-color: rgba(${activeTheme.overlayHeaderRgb}, 0.20) !important;
        }
        .theme-surface .text-sky-400:not(.overlay-hud-preserve *),
        .theme-surface .text-sky-300:not(.overlay-hud-preserve *),
        .theme-surface .text-sky-200:not(.overlay-hud-preserve *) {
          color: ${activeTheme.accentHex} !important;
        }
        .theme-surface .text-amber-300:not(.overlay-hud-preserve *),
        .theme-surface .text-amber-400:not(.overlay-hud-preserve *),
        .theme-surface .text-purple-200:not(.overlay-hud-preserve *),
        .theme-surface .text-purple-300:not(.overlay-hud-preserve *) {
          color: ${activeTheme.accentSecondaryHex} !important;
        }
        .theme-surface .border-sky-400:not(.overlay-hud-preserve *),
        .theme-surface .border-sky-500:not(.overlay-hud-preserve *),
        .theme-surface .border-sky-400\\/40:not(.overlay-hud-preserve *),
        .theme-surface .border-sky-400\\/50:not(.overlay-hud-preserve *),
        .theme-surface .border-sky-500\\/40:not(.overlay-hud-preserve *),
        .theme-surface .border-sky-500\\/30:not(.overlay-hud-preserve *) {
          border-color: ${activeTheme.accentHex} !important;
        }
        .theme-surface input[type="range"] {
          accent-color: ${activeTheme.accentHex} !important;
        }
        ${
          activeTheme.isLight
            ? `
        .theme-surface .text-white:not(.overlay-hud-preserve *),
        .theme-surface .text-slate-100:not(.overlay-hud-preserve *),
        .theme-surface .text-slate-200:not(.overlay-hud-preserve *) {
          color: ${activeTheme.textPrimaryHex} !important;
        }
        .theme-surface .text-slate-300:not(.overlay-hud-preserve *),
        .theme-surface .text-slate-400:not(.overlay-hud-preserve *),
        .theme-surface .text-slate-500:not(.overlay-hud-preserve *) {
          color: ${activeTheme.textSecondaryHex} !important;
        }
        `
            : ''
        }
      `}</style>

      {/* Centered Non-Interactive Background Emblem Watermark (Dialga / Instinct / Mystic / Valor / Sylveon) */}
      {showThemeWatermark && activeTheme.emblemType !== 'none' && (
        <div
          className="fixed inset-0 pointer-events-none flex items-center justify-center z-0 overflow-hidden"
          style={{ opacity: activeTheme.watermarkAlpha }}
          aria-hidden="true"
        >
          {activeTheme.emblemType === 'dialga' && (
            <svg viewBox="0 0 240 240" className="w-[440px] h-[440px]">
              <path
                fill="none"
                stroke="#2DD4BF"
                strokeWidth="4"
                d="M120,10 L196,42 L228,120 L196,198 L120,230 L44,198 L12,120 L44,42 Z"
              />
              <path
                fill="none"
                stroke="#FACC15"
                strokeWidth="5"
                d="M120,44 L178,76 L178,164 L120,196 L62,164 L62,76 Z"
              />
              <path
                fill="#FACC15"
                d="M62,76 L22,52 L48,92 Z M178,76 L218,52 L192,92 Z M56,120 L14,120 L56,132 Z M184,120 L226,120 L184,132 Z M62,164 L26,188 L54,148 Z M178,164 L214,188 L186,148 Z"
              />
              <path
                fill="#14B8A6"
                stroke="#67E8F9"
                strokeWidth="3"
                d="M120,14 L138,48 L156,32 L144,76 L186,98 L152,134 L168,188 L142,174 L120,224 L98,174 L72,188 L88,134 L54,98 L96,76 L84,32 L102,48 Z"
              />
              <path
                fill="#081224"
                stroke="#FACC15"
                strokeWidth="4"
                d="M120,84 L152,120 L120,156 L88,120 Z"
              />
              <path fill="#67E8F9" d="M120,96 L140,120 L120,144 L100,120 Z" />
            </svg>
          )}
          {activeTheme.emblemType === 'instinct' && (
            <svg viewBox="0 0 240 240" className="w-[420px] h-[420px]">
              <path fill="#FACC15" d="M120,8 L224,120 L120,232 L16,120 Z M120,24 L32,120 L120,216 L208,120 Z" />
              <path fill="#F59E0B" d="M120,38 L196,120 L120,202 L44,120 Z M120,50 L56,120 L120,190 L184,120 Z" />
              <path
                fill="#FACC15"
                d="M120,44 L132,78 L168,52 L152,92 L206,72 L168,114 L218,110 L166,138 L198,162 L148,154 L164,192 L128,166 L120,212 L112,166 L76,192 L92,154 L42,162 L74,138 L22,110 L72,114 L34,72 L88,92 L72,52 L108,78 Z"
              />
            </svg>
          )}
          {activeTheme.emblemType === 'mystic' && (
            <svg viewBox="0 0 240 240" className="w-[420px] h-[420px]">
              <path
                fill="#3B82F6"
                d="M120,10 L208,58 L208,162 L120,230 L32,162 L32,58 Z M120,26 L46,66 L46,154 L120,212 L194,154 L194,66 Z"
              />
              <path fill="#38BDF8" d="M120,36 L146,84 L120,132 L94,84 Z" />
              <path
                fill="#3B82F6"
                d="M120,56 L134,82 L192,62 L164,112 L202,122 L152,144 L168,176 L132,160 L120,222 L108,160 L72,176 L88,144 L38,122 L76,112 L48,62 L106,82 Z"
              />
            </svg>
          )}
          {activeTheme.emblemType === 'valor' && (
            <svg viewBox="0 0 240 240" className="w-[420px] h-[420px]">
              <path
                fill="#EF4444"
                d="M120,12 C168,46 212,92 212,144 C212,190 172,226 120,232 C68,226 28,190 28,144 C28,92 72,46 120,12 Z M120,32 C82,62 46,100 46,144 C46,180 78,210 120,216 C162,210 194,180 194,144 C194,100 158,62 120,32 Z"
              />
              <path
                fill="#F97316"
                d="M120,42 L134,68 L156,52 L148,86 L198,64 L172,108 L206,102 L168,136 L192,158 L148,154 L162,188 L128,170 L120,214 L112,170 L78,188 L92,154 L48,158 L72,136 L34,102 L68,108 L42,64 L92,86 L84,52 L106,68 Z"
              />
            </svg>
          )}
          {activeTheme.emblemType === 'sylveon' && (
            <svg viewBox="0 0 240 240" className="w-[420px] h-[420px]">
              <path
                fill="#EC4899"
                d="M120,20 C175,20 220,65 220,120 C220,175 175,220 120,220 C65,220 20,175 20,120 C20,65 65,20 120,20 Z M120,32 C71,32 32,71 32,120 C32,169 71,208 120,208 C169,208 208,169 208,120 C208,71 169,32 120,32 Z"
              />
              <path
                fill="#38BDF8"
                d="M96,126 C76,154 48,176 26,198 L44,206 C66,186 90,164 108,138 Z M144,126 C164,154 192,176 214,198 L196,206 C174,186 150,164 132,138 Z"
              />
              <path
                fill="#EC4899"
                d="M104,132 C88,164 68,192 52,218 L70,222 C84,196 102,168 116,138 Z M136,132 C152,164 172,192 188,218 L170,222 C156,196 138,168 124,138 Z"
              />
              <path
                fill="#EC4899"
                d="M112,108 C84,72 42,66 30,92 C18,118 48,148 112,124 Z M128,108 C156,72 198,66 210,92 C222,118 192,148 128,124 Z"
              />
              <path
                fill="#38BDF8"
                d="M106,112 C86,88 56,84 48,100 C40,116 62,134 106,120 Z M134,112 C154,88 184,84 192,100 C200,116 178,134 134,120 Z"
              />
              <path
                fill="#F472B6"
                d="M120,96 C133,96 144,107 144,120 C144,133 133,144 120,144 C107,144 96,133 96,120 C96,107 107,96 120,96 Z"
              />
              <path
                fill="#38BDF8"
                d="M120,28 L126,46 L144,52 L126,58 L120,76 L114,58 L96,52 L114,46 Z M56,36 L60,48 L72,52 L60,56 L56,68 L52,56 L40,52 L52,48 Z M184,36 L188,48 L200,52 L188,56 L184,68 L180,56 L168,52 L180,48 Z"
              />
            </svg>
          )}
        </div>
      )}

      {siteView === 'marketing' ? (
        <MarketingWebsite
          activeSubpage={marketingSubpage}
          onSelectSubpage={(page) => {
            setMarketingSubpage(page);
            try {
              window.scrollTo({ top: 0, behavior: 'smooth' });
              window.history.pushState({}, '', page === 'home' ? '/' : `/?view=${page}`);
            } catch {}
          }}
          onLaunchWebApp={(initialTab) => {
            if (initialTab) setActiveTab(initialTab);
            setSiteView('app');
            try {
              window.scrollTo({ top: 0, behavior: 'smooth' });
              window.history.pushState({}, '', '/?view=app');
            } catch {}
          }}
          onOpenMembershipModal={() => setShowMembershipModal(true)}
          webScreenName={webScreenName}
          onChangeWebScreenName={setWebScreenName}
          webMembershipTier={webMembershipTier}
        />
      ) : (
        <>
      {/* Top Application Navbar */}
      <header
        className="border-b backdrop-blur sticky top-0 z-50 px-4 py-3 transition-colors"
        style={{
          backgroundColor: activeTheme.cardHex,
          borderColor: activeTheme.borderHex
        }}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img
              src={`${import.meta.env.BASE_URL}favicon.svg`}
              alt="SilphScope PvP Icon"
              className="w-10 h-10 rounded-xl shadow-lg border"
              style={{ borderColor: activeTheme.accentHex }}
            />
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="font-bold text-base md:text-lg tracking-tight" style={{ color: activeTheme.textPrimaryHex }}>
                  SilphScope PvP
                </h1>
                <span
                  className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded border"
                  style={{
                    color: activeTheme.accentHex,
                    borderColor: activeTheme.accentHex,
                    backgroundColor: `${activeTheme.accentHex}1A`
                  }}
                >
                  v7.21 • Android Native Overlay
                </span>
                {/* Main Banner Active Mode Emblem & Badge (GBL Shield vs Battle Frontier Star Emblem) */}
                <button
                  type="button"
                  onClick={() => handleSetAppCombatMode(appCombatMode === 'show6' ? 'gbl' : 'show6')}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-[10.5px] font-extrabold uppercase tracking-wider border transition shadow-sm ${
                    appCombatMode === 'show6'
                      ? 'bg-amber-500/20 border-amber-400 text-amber-200 hover:bg-amber-500/30'
                      : 'bg-sky-500/20 border-sky-400 text-sky-200 hover:bg-sky-500/30'
                  }`}
                  title="Active Combat Mode (Click to toggle between Standard GBL Blind 3 Mode and Show 6 Battle Frontier Mode, or configure in Settings)"
                >
                  {appCombatMode === 'show6' ? renderBattleFrontierLogo(16) : renderGblModeLogo(16)}
                  <span>
                    {appCombatMode === 'show6'
                      ? 'SHOW 6 MODE • BATTLE FRONTIER (PICK 3)'
                      : 'GBL MODE • BLIND 3 PVP'}
                  </span>
                </button>
              </div>
              <p className="text-xs hidden sm:block" style={{ color: activeTheme.textSecondaryHex }}>
                {appCombatMode === 'show6'
                  ? 'Show 6 Tournament & Battle Frontier Pick-3 Mode • Known Opponent 6 AI Backline Predictor, 6v6 Pick-3 & Blind Show 6 Meta Builders'
                  : 'Standard GBL Blind 3 PvP Mode • 4-Pillar 2-Line AI Tactical Coach, Personalized Meta Cores & Anti-Meta Team Builder'}
              </p>
            </div>
          </div>

          {/* Navigation Tabs & Donation Button */}
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <button
              type="button"
              onClick={() => {
                setSiteView('marketing');
                setMarketingSubpage('home');
                try {
                  window.history.pushState({}, '', '/');
                } catch {}
              }}
              className="px-3 py-1.5 rounded-xl bg-teal-400/15 hover:bg-teal-400/25 border border-teal-400/50 text-teal-300 font-extrabold text-xs flex items-center gap-1.5 transition cursor-pointer"
              title="Return to SilphScopePvP.com Showcase & Featured Replays"
            >
              <span>🏠 Home / Showcase</span>
            </button>
            <nav className="flex items-center gap-1 bg-slate-950/70 p-1 rounded-xl border border-slate-800 text-xs font-semibold flex-wrap">
              <button
                onClick={() => setActiveTab('simulator')}
                className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
                  activeTab === 'simulator'
                    ? 'bg-sky-500 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>Overlay Simulator</span>
              </button>
              <button
                onClick={() => setActiveTab('presets')}
                className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
                  activeTab === 'presets'
                    ? 'bg-sky-500 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>{appCombatMode === 'show6' ? '🏛️ Show 6 Teams' : '⚔️ Teams'}</span>
                <span className="ml-0.5 px-1.5 py-0.2 rounded-full bg-slate-800 text-[10px] text-sky-400 border border-slate-700">
                  {appCombatMode === 'show6' ? `${show6Rosters6.length}×6 · ${presets.length}×3` : presets.length}
                </span>
              </button>
              <button
                onClick={() => setActiveTab('battle_log')}
                className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
                  activeTab === 'battle_log'
                    ? 'bg-sky-500 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Target className="w-3.5 h-3.5" />
                <span>{appCombatMode === 'show6' ? '📜 Show 6 Log' : '📜 Battle Log'}</span>
                <span className="ml-0.5 px-1.5 py-0.2 rounded-full bg-slate-800 text-[10px] text-amber-300 border border-slate-700">
                  {battleLogs.length}
                </span>
              </button>
              <button
                onClick={() => setActiveTab('settings')}
                className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
                  activeTab === 'settings'
                    ? 'bg-sky-500 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Settings className="w-3.5 h-3.5" />
                <span>⚙️ Settings</span>
              </button>
              <button
                onClick={() => setActiveTab('meta')}
                className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
                  activeTab === 'meta'
                    ? 'bg-sky-500 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <BarChart2 className="w-3.5 h-3.5" />
                <span>📊 Meta</span>
              </button>
              <button
                onClick={() => setActiveTab('math_validator')}
                className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
                  activeTab === 'math_validator'
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <BarChart2 className="w-3.5 h-3.5" />
                <span>📊 Math Validator</span>
              </button>
            </nav>

            <button
              type="button"
              onClick={() => setShowMembershipModal(true)}
              className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs flex items-center gap-1.5 shadow-lg shadow-indigo-600/20 transition"
              title="Manage SilphScope PvP Membership Tier, Unlock Key & Cloud Vault"
            >
              <span>
                {webMembershipTier === 'vip'
                  ? '👑 VIP Active'
                  : webMembershipTier === 'pro'
                  ? '🏆 Pro Active'
                  : webMembershipTier === 'supporter'
                  ? '🏅 Supporter'
                  : '🔑 Unlock Pro / Tiers'}
              </span>
            </button>

            <a
              href="https://buymeacoffee.com/silphscopepvp"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs flex items-center gap-1.5 shadow-lg shadow-amber-500/20 transition"
              title="Support SilphScope PvP on Buy Me a Coffee (PokéCoins & Season Passes)"
            >
              <span>☕ Buy Me a Coffee</span>
            </a>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6">
        {/* Persistent Overlay Launch, Mode Banner Logo, Status & Help Button Bar (Mirrors Android Top Region) */}
        <div className="mb-5 p-3.5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5 text-xs sm:text-sm font-bold text-sky-400">
            <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded-xl bg-slate-950 border border-slate-800">
              {appCombatMode === 'show6' ? renderBattleFrontierLogo(20) : renderGblModeLogo(20)}
              <span className={appCombatMode === 'show6' ? 'text-amber-300 font-extrabold' : 'text-sky-300 font-extrabold'}>
                {isOverlayVisible
                  ? isBattleActive
                    ? `Status: ${modeBannerWord} Battle Active`
                    : `Status: ${modeBannerWord} Overlay Active`
                  : `Status: ${modeBannerWord} Idle`}
              </span>
            </span>
            <span className="px-2 py-0.5 rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-[10px] font-mono">
              ⚡ Precomputed 9x9 Matrix: Top {precomputed9x9State.metaDepth} {precomputed9x9State.league} Meta ({precomputed9x9State.totalCellsComputed} cells • {precomputed9x9State.elapsedMs}ms)
            </span>
            {appCombatMode === 'show6' && (
              <span className="px-2 py-0.5 rounded-lg bg-amber-500/15 border border-amber-500/40 text-amber-300 text-[10px] font-mono">
                🏛️ Show 6 AI Constrained to Known Opponent 6 ({show6Opponent6.slice(0, 3).map((n) => n.split(' ')[0]).join('/')}...)
              </span>
            )}
            <span
              className={`px-2 py-0.5 rounded-lg text-[10px] font-mono border ${
                activeRealtime9x9Lookup.source === 'PRECOMPUTED_TOP200'
                  ? 'bg-sky-500/15 border-sky-500/40 text-sky-300'
                  : 'bg-amber-500/15 border-amber-500/40 text-amber-300'
              }`}
            >
              {activeRealtime9x9Lookup.source === 'PRECOMPUTED_TOP200'
                ? `🎯 ${activeOpponentName}: O(1) Precomputed 9x9 Hit`
                : `⚙️ ${activeOpponentName}: Real-Time Rough Math Fallback`}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('help')}
              className={`px-3.5 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 transition shadow-sm border ${
                activeTab === 'help'
                  ? 'bg-sky-500 border-sky-400 text-white'
                  : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-sky-300'
              }`}
              title="Open the complete Help & Overlay Guide page"
            >
              <span>❓ Help</span>
            </button>
            <button
              type="button"
              onClick={() => {
                const nextVisible = !isOverlayVisible;
                if (nextVisible) {
                  precomputeTeam9x9ShieldMatrixAgainstMeta(
                    activePreset?.pokemon || [],
                    activePreset?.league || 'GREAT LEAGUE',
                    tierThresholds,
                    200
                  );
                  setIsOverlayMinimized(false);
                  recalculateAllPresetsWithSeasonMeta(presets, battleLogs);
                }
                setIsOverlayVisible(nextVisible);
              }}
              className={`px-4 py-2 rounded-xl font-bold text-xs text-white transition shadow-lg ${
                isOverlayVisible
                  ? 'bg-blue-600 hover:bg-blue-500 shadow-blue-600/20'
                  : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20'
              }`}
            >
              {isOverlayVisible ? 'Stop Battle Overlay' : 'Start Battle Overlay'}
            </button>
          </div>
        </div>
        {/* Interactive Quick Undo Toast Banner */}
        {undoBanner && (
          <div className="mb-4 px-4 py-2.5 rounded-xl bg-amber-950/90 border border-amber-400/60 shadow-lg flex items-center justify-between gap-3">
            <span className="text-xs font-bold text-amber-200">{undoBanner.message}</span>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  const fn = undoBanner.onUndo;
                  setUndoBanner(null);
                  fn();
                }}
                className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs transition"
              >
                ♻️ UNDO
              </button>
              <button
                type="button"
                onClick={() => setUndoBanner(null)}
                className="px-2 py-1 text-slate-400 hover:text-white text-xs font-bold"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 1: INTERACTIVE BATTLE ARENA & FLOATING OVERLAY SIMULATOR
           ========================================================================= */}
        {activeTab === 'simulator' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Left: Phone Screen Canvas with Floating HUD */}
            <div className="lg:col-span-7 flex flex-col items-center">
              <div className="w-full flex items-center justify-between mb-3 px-1 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-300">Overlay HUD:</span>
                  <button
                    type="button"
                    onClick={() => handleSetOverlayHudMode(overlayHudMode === 'compact' ? 'full' : 'compact')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-extrabold border transition flex items-center gap-1.5 ${
                      overlayHudMode === 'compact'
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/50 hover:bg-emerald-500/30'
                        : 'bg-sky-500/20 text-sky-300 border-sky-400/40 hover:bg-sky-500/30'
                    }`}
                    title="Click to toggle between Full HUD and Compact HUD (or tap the top-left emblem on the overlay to cycle Full → Compact → Minimized)"
                  >
                    <span>{overlayHudMode === 'compact' ? '⚡ Compact HUD' : '📐 Full HUD'}</span>
                    {overlayHudMode === 'compact' && (
                      <span className="text-[10px] font-mono opacity-80">
                        ({compactHudShowMatrix ? '3×3 Matrix ON' : '3×3 Matrix OFF'})
                      </span>
                    )}
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsOverlayVisible(!isOverlayVisible)}
                    className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 px-2 py-1 rounded bg-slate-900 border border-slate-800"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>{isOverlayVisible ? 'Hide HUD' : 'Show HUD'}</span>
                  </button>
                  <button
                    onClick={() => {
                      setUserTurnsElapsed(0);
                      setOppTurnsElapsed(0);
                      setUserEnergy(36);
                      setOppEnergy(40);
                    }}
                    className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 px-2 py-1 rounded bg-slate-900 border border-slate-800"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset Turns</span>
                  </button>
                </div>
              </div>

              {/* Real-time Overlay Placement & Nudge Control Bar */}
              <div className="w-full max-w-[390px] mb-2.5 px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between text-xs shadow-md">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="font-semibold text-slate-300">HUD Pos:</span>
                  <span className="font-mono text-sky-400 font-bold bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">
                    X:{overlayPos.x} Y:{overlayPos.y}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-emerald-400 font-semibold px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
                    Clear of Opponent HP ✅
                  </span>
                  
                  {/* Quick Nudge Buttons */}
                  <div className="flex items-center gap-0.5 ml-1">
                    <button
                      onClick={() => setOverlayPos(prev => ({ ...prev, y: Math.max(20, prev.y - 8) }))}
                      className="w-5 h-5 rounded bg-slate-800 hover:bg-slate-700 active:scale-95 text-white font-bold flex items-center justify-center text-[10px]"
                      title="Nudge Up"
                    >
                      ▲
                    </button>
                    <button
                      onClick={() => setOverlayPos(prev => ({ ...prev, y: Math.min(420, prev.y + 8) }))}
                      className="w-5 h-5 rounded bg-slate-800 hover:bg-slate-700 active:scale-95 text-white font-bold flex items-center justify-center text-[10px]"
                      title="Nudge Down"
                    >
                      ▼
                    </button>
                    <button
                      onClick={() => setOverlayPos(prev => ({ ...prev, x: Math.max(0, prev.x - 6) }))}
                      className="w-5 h-5 rounded bg-slate-800 hover:bg-slate-700 active:scale-95 text-white font-bold flex items-center justify-center text-[10px]"
                      title="Nudge Left"
                    >
                      ◄
                    </button>
                    <button
                      onClick={() => setOverlayPos(prev => ({ ...prev, x: Math.min(105, prev.x + 6) }))}
                      className="w-5 h-5 rounded bg-slate-800 hover:bg-slate-700 active:scale-95 text-white font-bold flex items-center justify-center text-[10px]"
                      title="Nudge Right"
                    >
                      ►
                    </button>
                    <button
                      onClick={() => setOverlayPos({ x: 8, y: 118 })}
                      className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-sky-600 text-[10px] text-slate-300 hover:text-white font-semibold transition ml-0.5"
                      title="Reset to Default Position"
                    >
                      Reset
                    </button>
                  </div>
                </div>
              </div>

              {/* Mobile Device Frame simulating Pokémon GO Screen (with drag event listeners) */}
              <div 
                onMouseMove={onDragMove}
                onMouseUp={onDragEnd}
                onMouseLeave={onDragEnd}
                onTouchMove={onDragMove}
                onTouchEnd={onDragEnd}
                className="overlay-hud-preserve relative w-full max-w-[390px] h-[780px] rounded-[38px] border-[6px] border-slate-800 bg-slate-900 shadow-2xl overflow-hidden flex flex-col justify-between select-none"
              >
                
                {/* Pokémon GO Battle Background with Sky & Rain Atmosphere */}
                <div 
                  className="absolute inset-0 bg-cover bg-center pointer-events-none"
                  style={{
                    backgroundImage: `linear-gradient(to bottom, rgba(15, 23, 42, 0.45) 0%, rgba(30, 41, 59, 0.25) 45%, rgba(15, 23, 42, 0.85) 100%), radial-gradient(circle at 50% 30%, #334155 0%, #0f172a 100%)`
                  }}
                >
                  {/* Subtle animated battle atmosphere grid */}
                  <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:16px_16px]" />
                </div>

                {/* Status Bar / Notch */}
                <div className="relative z-10 pt-2.5 px-6 flex justify-between items-center text-[11px] font-semibold text-slate-300">
                  <span>10:40</span>
                  <div className="w-4 h-4 rounded-full bg-black/60 border border-slate-700/60" />
                  <div className="flex items-center gap-1.5">
                    <span>5G</span>
                    <div className="w-4 h-2 border border-slate-400 rounded-sm flex items-center p-0.5">
                      <div className="h-full w-full bg-slate-300 rounded-2xs" />
                    </div>
                  </div>
                </div>

                {/* Top Opponent & Player Headers (Matching Pokémon GO Battle HUD) */}
                <div className="relative z-10 px-4 pt-1 flex justify-between items-start">
                  {/* Player Header */}
                  <div className="bg-slate-900/80 backdrop-blur-md rounded-xl p-2.5 border border-slate-700/60 shadow-lg w-[145px]">
                    <div className="flex justify-between items-center text-[10.5px]">
                      <span className="font-bold text-slate-200 truncate">{userActivePokemon.name.split(' ')[0]}*</span>
                      <span className="font-semibold text-slate-400">CP 4624</span>
                    </div>
                    {/* Pokeballs & Shields */}
                    <div className="flex items-center justify-between mt-1.5 text-[9px] text-slate-400">
                      <div className="flex gap-1">
                        <span className="text-red-500">🔴</span>
                        <span className="text-red-500">🔴</span>
                        <span className="text-red-500">🔴</span>
                      </div>
                      <div className="flex gap-0.5">
                        <span className="text-purple-400">🛡️</span>
                        <span className="text-purple-400">🛡️</span>
                      </div>
                    </div>
                  </div>

                  {/* Opponent Header (Target of ML Kit OCR) */}
                  <div 
                    id="ocr-opponent-header-crop"
                    className="relative bg-slate-900/80 backdrop-blur-md rounded-xl p-2.5 border border-sky-400/50 shadow-lg w-[145px]"
                  >
                    {/* Bounding box indicator showing OCR scan region */}
                    <span className="absolute -top-2 -right-1 text-[8px] bg-sky-500 text-white font-bold px-1 rounded shadow">
                      ML Kit OCR
                    </span>
                    <div className="flex justify-between items-center text-[10.5px]">
                      <span className="font-semibold text-slate-400">CP 4108</span>
                      <span className="font-bold text-amber-300">{activeOpponent.name}</span>
                    </div>
                    {/* Pokeballs & Shields */}
                    <div className="flex items-center justify-between mt-1.5 text-[9px] text-slate-400">
                      <div className="flex gap-0.5">
                        <span className="text-purple-400">🛡️</span>
                        <span className="text-purple-400">🛡️</span>
                      </div>
                      <div className="flex gap-1">
                        <span className="text-red-500">🔴</span>
                        <span className="text-red-500">🔴</span>
                        <span className="text-red-500">🔴</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Center 3D Battle Arena (Opponent Sprite & Player Sprite) */}
                <div className="relative flex-1 flex flex-col justify-between py-6 px-4">
                  
                  {/* Opponent Pokémon Sprite & Trainer */}
                  <div className="flex justify-end pr-8 pt-6">
                    <div className="relative flex flex-col items-center">
                      <div className="w-32 h-32 rounded-full bg-amber-500/10 filter blur-xl absolute" />
                      <div className="text-6xl select-none filter drop-shadow-[0_10px_20px_rgba(0,0,0,0.8)]">
                        {activeOpponent.name === 'Entei' ? '🦁' : activeOpponent.name === 'Yveltal' ? '🦅' : '🐺'}
                      </div>
                      <div className="mt-1 text-center font-bold text-sm text-amber-200 [text-shadow:0_2px_4px_#000]">
                        {activeOpponent.name}
                      </div>
                      <div className="text-[10px] text-slate-300 font-semibold font-mono [text-shadow:0_1px_2px_#000]">
                        {oppFastInfo.telemetry}
                      </div>
                    </div>
                  </div>

                  {/* Player Pokémon Sprite */}
                  <div className="flex justify-start pl-6 pb-6">
                    <div className="relative flex flex-col items-center">
                      <div className="w-36 h-36 rounded-full bg-sky-500/10 filter blur-xl absolute" />
                      <div className="text-7xl select-none filter drop-shadow-[0_10px_20px_rgba(0,0,0,0.8)]">
                        {userActivePokemon.name.includes('Dialga') ? '🦕' : userActivePokemon.name.includes('Luxray') ? '⚡' : '🐋'}
                      </div>
                      <div className="mt-1 text-center font-bold text-sm text-sky-200 [text-shadow:0_2px_4px_#000]">
                        {userActivePokemon.name}
                      </div>
                      <div className="text-[10px] text-slate-300 font-semibold font-mono [text-shadow:0_1px_2px_#000]">
                        {userFastInfo.telemetry}
                      </div>
                    </div>
                  </div>

                  {/* =========================================================================
                      FLOATING OVERLAY OPTION 1: Top-Left Sky Trench OR Minimized App-Icon Bubble
                     ========================================================================= */}
                  {isOverlayVisible && isOverlayMinimized && (
                    <div
                      onMouseDown={onDragStart}
                      onTouchStart={onDragStart}
                      onClick={() => {
                        if (!didMoveDuringDrag) {
                          setIsOverlayMinimized(false);
                          handleSetOverlayHudMode('full');
                        }
                      }}
                      title="Drag bubble anywhere • Tap to restore Full HUD & resume 1 Hz OCR"
                      style={{
                        top: `${overlayPos.y}px`,
                        left: `${overlayPos.x}px`,
                        borderColor: `rgb(${activeTheme.overlayHeaderRgb})`,
                        boxShadow: `0 4px 16px rgba(0,0,0,0.85), 0 0 10px rgba(${activeTheme.overlayHeaderRgb}, 0.55)`
                      }}
                      className={`absolute z-30 w-12 h-12 rounded-full bg-slate-950 border-2 flex items-center justify-center cursor-pointer active:scale-95 transition-transform ${
                        isDragging ? 'ring-2 ring-amber-400' : ''
                      }`}
                    >
                      {renderThemeOverlayIcon(activeTheme.id, 28)}
                      <span className="absolute -bottom-2 px-1 py-0.2 rounded bg-amber-500 text-slate-950 font-black text-[7px] uppercase tracking-tighter shadow">
                        OCR Paused
                      </span>
                    </div>
                  )}

                  {isOverlayVisible && !isOverlayMinimized && (
                    <div 
                      className={`absolute z-30 rounded-lg p-1.5 shadow-lg transition-all ${
                        isDragging ? 'ring-2 ring-amber-400' : ''
                      }`}
                      style={{
                        top: `${overlayPos.y}px`,
                        left: `${overlayPos.x}px`,
                        width: '286px',
                        transform: `scale(${(overlayScalePct / 78).toFixed(4)})`,
                        transformOrigin: 'top left',
                        background: `rgba(${activeTheme.overlayBgRgb}, ${((100 - overlayTransparencyPct) / 100).toFixed(3)})`,
                        borderColor: `rgba(${activeTheme.overlayBorderRgb}, ${Math.max(0.08, ((100 - overlayTransparencyPct) / 100) * 0.65).toFixed(3)})`,
                        borderWidth: '1px',
                        borderStyle: 'solid',
                        backdropFilter: overlayTransparencyPct >= 96 ? 'none' : 'blur(3px)',
                        WebkitBackdropFilter: overlayTransparencyPct >= 96 ? 'none' : 'blur(3px)',
                        textShadow: '0 1px 2px rgba(0, 0, 0, 0.98), 0 0 4px rgba(0, 0, 0, 0.95)'
                      }}
                    >
                      {/* v6.03 Header row: Transparent background + Minimize/Pause OCR icon + OCR:101/495ms badge (colorized when active, grey when inactive) + Mirrored [CP, HP, Energy, Shield] | [Shield, Energy, HP, CP] */}
                      <div
                        className="flex items-center justify-between gap-1 px-0.5 py-0.5 mb-0.5"
                      >
                        <div className="flex items-center gap-1 shrink-0 font-mono text-[7px] font-extrabold">
                          <button
                            type="button"
                            onPointerDown={(e) => {
                              e.stopPropagation();
                              minimizeHoldTriggeredRef.current = false;
                              if (minimizeHoldTimerRef.current) {
                                window.clearTimeout(minimizeHoldTimerRef.current);
                              }
                              minimizeHoldTimerRef.current = window.setTimeout(() => {
                                minimizeHoldTriggeredRef.current = true;
                                setIsOverlayVisible(false);
                                setActiveTab('battle_log');
                                setStartBattleToast('🛑 Overlay stopped (2s hold) • Opened Battle Log');
                                setTimeout(() => setStartBattleToast(null), 2200);
                              }, 2000);
                            }}
                            onPointerUp={(e) => {
                              e.stopPropagation();
                              if (minimizeHoldTimerRef.current) {
                                window.clearTimeout(minimizeHoldTimerRef.current);
                                minimizeHoldTimerRef.current = null;
                              }
                              if (!minimizeHoldTriggeredRef.current) {
                                if (overlayHudMode === 'full') {
                                  handleSetOverlayHudMode('compact');
                                } else {
                                  setIsOverlayMinimized(true);
                                }
                              }
                              minimizeHoldTriggeredRef.current = false;
                            }}
                            onPointerCancel={() => {
                              if (minimizeHoldTimerRef.current) {
                                window.clearTimeout(minimizeHoldTimerRef.current);
                                minimizeHoldTimerRef.current = null;
                              }
                              minimizeHoldTriggeredRef.current = false;
                            }}
                            className="px-1 py-0.5 rounded text-white text-[10px] leading-tight shrink-0 shadow-sm active:scale-90 transition border flex items-center justify-center"
                            style={{
                              backgroundColor: `rgba(${activeTheme.overlayHeaderRgb}, 0.28)`,
                              borderColor: `rgba(${activeTheme.overlayHeaderRgb}, 0.75)`
                            }}
                            title="Tap: Cycle Full → Compact → Minimize (Pause OCR) • Hold 2s: Stop overlay & go to Battle Log"
                          >
                            {renderThemeOverlayIcon(activeTheme.id, 13)}
                          </button>
                          <span
                            className={`px-1 py-0.5 rounded border leading-none shrink-0 transition ${
                              isBattleActive
                                ? 'border-cyan-400/65 bg-cyan-950/85 text-cyan-200 shadow-sm'
                                : 'border-slate-500/40 bg-slate-900/60 text-slate-400'
                            }`}
                            title={
                              isBattleActive
                                ? 'Active Battle Scanning — Pixel HP: 101ms • ML Kit OCR: 495ms'
                                : 'Inactive (1 Hz Standby) — Pixel HP & ML Kit OCR rates'
                            }
                          >
                            {isBattleActive
                              ? `OCR:101/${scanHzMode === '2Hz' ? '495' : '820'}ms`
                              : scannedOpponents.length > 0
                              ? `OCR:101/${scanHzMode === '2Hz' ? '495' : '820'}ms`
                              : 'OCR:---/---ms'}
                          </span>
                        </div>

                        {/* Right-aligned cluster: Mirrored My [CP, Health, Energy, Shield] | Opp [Shield, Energy, Health, CP] */}
                        <div className="flex items-center justify-end gap-0.5 ml-auto shrink-0 font-mono text-[7px] font-extrabold">
                          {/* My CP, Health, Energy, Shield badges */}
                          {(activePreset.pokemon[activeUserSlotIndex]?.cp ?? 1500) > 0 && (
                            <span
                              className="px-1 py-0.5 rounded border border-slate-400/45 bg-slate-800/85 text-slate-200 leading-none shrink-0"
                              title={`My Active Pokémon CP: ${activePreset.pokemon[activeUserSlotIndex]?.cp ?? 1500}`}
                            >
                              CP{activePreset.pokemon[activeUserSlotIndex]?.cp ?? 1500}
                            </span>
                          )}
                          {enableHpTracking && (
                            <span
                              className={`px-1 py-0.5 rounded border leading-none shrink-0 ${
                                (userSlotHpPct[activeUserSlotIndex] ?? 100) <= 0
                                  ? 'text-slate-400 bg-slate-900/60 border-slate-700 line-through'
                                  : (userSlotHpPct[activeUserSlotIndex] ?? 100) <= 22
                                  ? 'text-rose-200 bg-rose-950/70 border-rose-400/70'
                                  : (userSlotHpPct[activeUserSlotIndex] ?? 100) <= 50
                                  ? 'text-amber-200 bg-amber-950/70 border-amber-400/70'
                                  : 'text-emerald-200 bg-emerald-950/70 border-emerald-400/70'
                              }`}
                              title={`My Active Pokémon HP: ${userSlotHpPct[activeUserSlotIndex] ?? 100}%`}
                            >
                              {userSlotHpPct[activeUserSlotIndex] ?? 100}%
                            </span>
                          )}
                          {enableEnergyTracking && (
                            <span
                              className="px-1 py-0.5 rounded border border-sky-400/60 bg-sky-950/75 text-sky-200 leading-none shrink-0"
                              title={`My Active Pokémon Energy: ${userSlotEnergy[activeUserSlotIndex] ?? userEnergy}E`}
                            >
                              {userSlotEnergy[activeUserSlotIndex] ?? userEnergy}E
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              const next = userShields > 0 ? userShields - 1 : 2;
                              setUserShields(next);
                            }}
                            className={`px-1 py-0.5 rounded border leading-none transition-all flex items-center gap-0.5 active:scale-95 cursor-pointer shrink-0 ${
                              userShields === 0
                                ? 'opacity-50 text-slate-400 bg-slate-900/60 border-slate-700 line-through'
                                : 'text-sky-200 border-sky-400/50 hover:bg-sky-900/50'
                            }`}
                            style={{
                              borderColor: userShields > 0 ? `rgba(${activeTheme.overlayHeaderRgb}, 0.65)` : undefined,
                              backgroundColor: userShields > 0 ? `rgba(${activeTheme.overlayHeaderRgb}, 0.22)` : undefined,
                              color: userShields > 0 ? activeTheme.accentHex : undefined
                            }}
                            title={`Your Shields: ${userShields}/2 remaining (Tap to cycle 2->1->0->2)`}
                          >
                            <span className="text-[7px]">🛡️</span>
                            <span>{userShields}</span>
                          </button>

                          {/* Small vertical bar separator between My badges and Opponent badges */}
                          <span className="text-slate-400/75 px-0.5 select-none leading-none font-bold">|</span>

                          {/* Opp Shield, Energy, Health, CP badges (mirrored symmetry) */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              const next = oppShields > 0 ? oppShields - 1 : 2;
                              setOppShields(next);
                            }}
                            className={`px-1 py-0.5 rounded border leading-none transition-all flex items-center gap-0.5 active:scale-95 cursor-pointer shrink-0 ${
                              oppShields === 0
                                ? 'opacity-50 text-slate-400 bg-slate-900/60 border-slate-700 line-through'
                                : 'text-pink-300 bg-pink-950/60 border-pink-500/50 hover:bg-pink-900/50'
                            }`}
                            title={`Opponent Shields: ${oppShields}/2 remaining (Tap to cycle 2->1->0->2)`}
                          >
                            <span className="text-[7px]">🛡️</span>
                            <span>{oppShields}</span>
                          </button>
                          {enableEnergyTracking && (() => {
                            const activeOppE = oppSlotEnergy[safeActiveOppSlot] ?? oppEnergy;
                            const cheapestOppCost = Math.min(
                              ...activeOpponent.chargedMoves.map((m) => resolveChargedMove(m.name, activeOpponent.types[0]).energyCost || m.energyCost || 40),
                              45
                            );
                            const oppRdy = activeOppE >= cheapestOppCost;
                            return (
                              <span
                                className={`px-1 py-0.5 rounded border leading-none shrink-0 ${
                                  oppRdy
                                    ? 'text-yellow-200 bg-amber-700/75 border-yellow-300/90'
                                    : 'text-amber-200 bg-amber-950/75 border-amber-400/60'
                                }`}
                                title={`Active Opponent Energy: ${activeOppE}E${oppRdy ? ' (Move Ready)' : ''}`}
                              >
                                {activeOppE}E{oppRdy ? '!' : ''}
                              </span>
                            );
                          })()}
                          {enableHpTracking && (
                            <span
                              className={`px-1 py-0.5 rounded border leading-none shrink-0 ${
                                (oppSlotHpPct[safeActiveOppSlot] ?? 100) <= 0
                                  ? 'text-slate-400 bg-slate-900/60 border-slate-700 line-through'
                                  : (oppSlotHpPct[safeActiveOppSlot] ?? 100) <= 22
                                  ? 'text-rose-200 bg-rose-950/70 border-rose-400/70'
                                  : (oppSlotHpPct[safeActiveOppSlot] ?? 100) <= 50
                                  ? 'text-amber-200 bg-amber-950/70 border-amber-400/70'
                                  : 'text-emerald-200 bg-emerald-950/70 border-emerald-400/70'
                              }`}
                              title={`Active Opponent Pokémon HP: ${oppSlotHpPct[safeActiveOppSlot] ?? 100}%`}
                            >
                              {oppSlotHpPct[safeActiveOppSlot] ?? 100}%
                            </span>
                          )}
                          {!isWaitingOpponent && (
                            <span
                              className="px-1 py-0.5 rounded border border-slate-400/45 bg-slate-800/85 text-slate-200 leading-none shrink-0"
                              title="Opponent Active Pokémon CP (scanned via OCR)"
                            >
                              CP{activeOpponentLeague.includes('ULTRA') ? 2498 : activeOpponentLeague.includes('MASTER') ? 4280 : 1498}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* v6.00 Top Placement Option: 4-Pillar Condensed 2-Line AI Tactical Coach (when aiAdviceHudPosition === 'top') */}
                      {showTacticalRec && activeTacticalRec && aiAdviceHudPosition === 'top' && (() => {
                        const oppFastGain = resolveFastMove(activeOpponent)?.energyGain || activeOpponent.defaultFastMove?.energyGain || 8;
                        const cheapestOppCost = Math.min(
                          ...activeOpponent.chargedMoves.map((m) => resolveChargedMove(m.name, activeOpponent.types[0]).energyCost || m.energyCost || 40),
                          45
                        );
                        const curOppE = oppSlotEnergy[safeActiveOppSlot] ?? oppEnergy;
                        const oppFastsToMove = Math.max(0, Math.ceil((cheapestOppCost - curOppE) / Math.max(1, oppFastGain)));
                        const myFastDmg = Math.max(1, Math.round(userFastInfo.percentage || 4));
                        const curOppHp = oppSlotHpPct[safeActiveOppSlot] ?? 100;
                        const fastsToKoOpp = Math.max(1, Math.ceil(curOppHp / myFastDmg));
                        const canFarmDown = fastsToKoOpp <= oppFastsToMove && curOppHp <= 32;
                        const myShortMove = abbrMove5(myMoveTimingInfo?.[0]?.name || 'Move');
                        const oppShortMove = abbrMove5(activeOppChargedMoveBounds.minMoveName || 'Move');
                        const timingState =
                          isAttackIncomingPrompt
                            ? 'SHIELD_CALL'
                            : canFarmDown
                            ? 'FARM_DOWN_SAFE'
                            : oppFastsToMove === 0
                            ? 'IMMEDIATE_0_FAST'
                            : oppFastsToMove >= 1 && oppFastsToMove <= hapticChargeTimingFasts
                            ? 'BLINK_1_FAST'
                            : oppFastsToMove === 2
                            ? 'WARN_2_FASTS'
                            : 'NORMAL';
                        const line1Text =
                          timingState === 'FARM_DOWN_SAFE'
                            ? `FARM DOWN: ${fastsToKoOpp}F TO KO (Pre-${oppShortMove})`
                            : timingState === 'IMMEDIATE_0_FAST'
                            ? `🛑 0F LEFT -> THROW ${myShortMove} NOW!`
                            : timingState === 'BLINK_1_FAST'
                            ? oppFastsToMove === 1
                              ? `🚨 1 LAST FAST -> THROW ${myShortMove} NOW!`
                              : `🚨 ${oppFastsToMove}F -> THROW ${myShortMove} (Pre-${oppShortMove})!`
                            : timingState === 'WARN_2_FASTS'
                            ? `⚠️ 2F -> THROW ${myShortMove} (Pre-${oppShortMove})`
                            : `${activeTacticalRec.actionLabel || activeTacticalRec.actionText} [${activeTacticalRec.shieldPlan}] · ${(activeTacticalRec.goalText || '').slice(0, 22)}`;
                        const s6PairsTop =
                          show6LiveBacklinePrediction?.mostLikelyPairs ||
                          show6LiveBacklinePrediction?.predictions ||
                          [];
                        const backlineLine2 =
                          appCombatMode === 'show6' && show6LiveBacklinePrediction
                            ? s6PairsTop.length > 0
                              ? `🔮 S6: ${s6PairsTop.slice(0, 2).map((p) => `${(p.backlineNames || []).map((n) => abbrPoke3(n)).join('+')} ${p.probabilityPct}%`).join(' · ')}`
                              : `🔮 S6: ${show6LiveBacklinePrediction.tacticalSummary.slice(0, 42)}`
                            : scannedOpponents.length <= 2
                            ? `🔮 Back: HO-OH 64% · PAL-O 52% | Rsk:MED`
                            : `🔮 All 3 Opponents Revealed`;
                        return (
                          <div
                            className={`flex flex-col gap-0.5 px-1.5 py-1 rounded border my-0.5 font-mono text-[7.1px] leading-tight transition-all ${
                              timingState === 'IMMEDIATE_0_FAST'
                                ? 'bg-red-950/90 border-red-400 text-white animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.65)]'
                                : timingState === 'BLINK_1_FAST'
                                ? 'bg-rose-950/90 border-amber-300 text-amber-100 animate-pulse shadow-[0_0_8px_rgba(251,191,36,0.55)]'
                                : timingState === 'WARN_2_FASTS'
                                ? 'bg-amber-950/90 border-amber-400 text-amber-100'
                                : activeTacticalRec.urgencyColor === 'emerald' || timingState === 'FARM_DOWN_SAFE'
                                ? 'bg-emerald-950/80 border-emerald-400/60 text-emerald-200'
                                : activeTacticalRec.urgencyColor === 'sky'
                                ? 'bg-sky-950/80 border-sky-400/60 text-sky-200'
                                : activeTacticalRec.urgencyColor === 'rose'
                                ? 'bg-rose-950/80 border-rose-400/60 text-rose-200'
                                : 'bg-amber-950/80 border-amber-400/60 text-amber-200'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-1 min-w-0">
                              <span className="font-extrabold truncate">{line1Text}</span>
                              {isAttackIncomingPrompt && userShields > 0 && (
                                <div className="flex items-center gap-0.5 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => handleResolveOppChargedAttack(true, 0)}
                                    className="px-1 py-0.2 rounded bg-pink-500/40 text-pink-100 font-extrabold text-[6.5px] border border-pink-300/60"
                                  >
                                    🛡️1S
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleResolveOppChargedAttack(false, 0)}
                                    className="px-1 py-0.2 rounded bg-sky-500/35 text-sky-100 font-extrabold text-[6.5px] border border-sky-300/60"
                                  >
                                    0S
                                  </button>
                                </div>
                              )}
                            </div>
                            <div className="text-[6.8px] text-cyan-200/95 font-bold truncate border-t border-white/10 pt-0.5">
                              {backlineLine2}
                            </div>
                          </div>
                        );
                      })()}

                      {/* Action Toolbar: 2-Row Compact Buttons (Visible in Full HUD, or in Compact HUD when idle Waiting...) */}
                      {(overlayHudMode !== 'compact' || ((isWaitingOpponent || scannedOpponents.length === 0) && !isBattleActive)) && (
                      <div
                        className="flex items-stretch justify-between gap-0.5 p-1 rounded border border-white/10 my-1"
                        style={{
                          background: `rgba(0, 0, 0, ${(((100 - overlayTransparencyPct) / 100) * 0.65).toFixed(3)})`
                        }}
                      >
                        <div className="flex items-stretch gap-0.5">
                          <button
                            onClick={() => {
                              if (isBattleActive) {
                                handleStopBattle();
                              } else {
                                handleStartBattle();
                              }
                            }}
                            className={`font-bold text-[7px] leading-[1.05] px-1 py-0.5 rounded border transition active:scale-95 flex flex-col items-center justify-center text-center whitespace-pre-line ${
                              isBattleActive
                                ? 'bg-red-600/60 hover:bg-red-600/75 text-white border-red-300 shadow-[0_0_5px_rgba(239,68,68,0.5)]'
                                : 'bg-emerald-500/35 hover:bg-emerald-500/50 text-emerald-100 border-emerald-400/75'
                            }`}
                            title={
                              isBattleActive
                                ? 'Stop current battle and open option to log Win/Loss'
                                : 'Immediately reset opponent list & empty matrix to start a new battle'
                            }
                          >
                            {startBattleToast ? (
                              <span>{startBattleToast}</span>
                            ) : isBattleActive ? (
                              <span>{'🛑 Stop\nBattle'}</span>
                            ) : (
                              <span>{'Start\nBattle'}</span>
                            )}
                          </button>
                          <button
                            onClick={() => {
                              setShowStartBattleMenu(false);
                              setShowOpponentPicker(!showOpponentPicker);
                            }}
                            className={`font-bold text-[7px] leading-[1.05] px-1 py-0.5 rounded border transition active:scale-95 flex flex-col items-center justify-center text-center whitespace-pre-line ${
                              showOpponentPicker
                                ? 'bg-amber-500/60 text-white border-amber-300 shadow-[0_0_5px_rgba(245,158,11,0.5)]'
                                : 'bg-emerald-500/30 text-emerald-200 border-emerald-400/50 hover:bg-emerald-500/45'
                            }`}
                            title="Swap opponent from PvPoke Top 10 Meta"
                          >
                            {'🔄\nSwap ▾'}
                          </button>
                          <button
                            onClick={() => setIsOpponentShadow(!isOpponentShadow)}
                            className={`font-bold text-[7px] leading-[1.05] px-1 py-0.5 rounded border transition active:scale-95 flex flex-col items-center justify-center text-center whitespace-pre-line ${
                              isOpponentShadow
                                ? 'bg-purple-600/60 text-white border-purple-300 shadow-[0_0_5px_rgba(168,85,247,0.5)]'
                                : 'bg-purple-500/25 text-purple-200 border-purple-400/50 hover:bg-purple-500/35'
                            }`}
                            title="Toggle 1.2x Attack / 0.833x Defense Shadow modifier"
                          >
                            {`Shadow:\n${isOpponentShadow ? 'ON' : 'OFF'}`}
                          </button>
                          <button
                            onClick={handleCycleForm}
                            disabled={availableForms.length <= 1 || isWaitingOpponent}
                            className={`font-bold text-[7px] leading-[1.05] px-1 py-0.5 rounded border transition flex flex-col items-center justify-center text-center whitespace-pre-line ${
                              availableForms.length > 1 && !isWaitingOpponent
                                ? 'bg-sky-500/30 hover:bg-sky-500/45 text-sky-100 border-sky-300/60 active:scale-95 cursor-pointer'
                                : 'bg-slate-800/30 text-slate-500 border-slate-700/40 opacity-50 cursor-not-allowed'
                            }`}
                            title="Cycle regional or alternate form"
                          >
                            {`Form:\n${(activeOpponent.formLabel || 'Base').slice(0, 6)}`}
                          </button>
                        </div>
                        <div className="flex items-stretch gap-0.5">
                          {activePreset.pokemon.map((member, idx) => {
                            const slotHp = playerFaintedSlots[idx] ? 0 : (userSlotHpPct[idx] ?? 100);
                            const cleanCode = member.name
                              .replace(/^Shadow\s+/i, '')
                              .replace(/^Kanto\s+/i, '')
                              .replace(/^Alolan\s+/i, '')
                              .replace(/^Galarian\s+/i, '')
                              .replace(/^Hisuian\s+/i, '')
                              .replace(/^Paldean\s+/i, '')
                              .replace(/[^a-zA-Z0-9]/g, '')
                              .slice(0, 3)
                              .toUpperCase();
                            return (
                              <button
                                key={member.id}
                                onClick={() => handleSelectUserSlot(idx)}
                                className={`text-[7.5px] leading-[1.05] font-bold px-1 py-0.5 rounded border transition flex flex-col items-center justify-center text-center min-w-[27px] ${
                                  activeUserSlotIndex === idx && !playerFaintedSlots[idx]
                                    ? 'bg-emerald-500/40 text-white border-emerald-400'
                                    : playerFaintedSlots[idx]
                                    ? 'bg-slate-900/30 text-slate-500 border-white/10 opacity-35 line-through'
                                    : 'bg-slate-900/50 text-slate-200 border-white/20 hover:bg-slate-800'
                                }`}
                                title={`${member.name} (${playerFaintedSlots[idx] ? 'Fainted' : `${slotHp}% HP anchored`})`}
                              >
                                <span>{cleanCode}:</span>
                                <span
                                  className={`text-[6.5px] font-mono ${
                                    playerFaintedSlots[idx]
                                      ? 'text-slate-500'
                                      : slotHp > 50
                                      ? 'text-emerald-300'
                                      : slotHp > 20
                                      ? 'text-amber-300'
                                      : 'text-rose-300'
                                  }`}
                                >
                                  {slotHp}%
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      )}

                      {/* Idle (Waiting...) Screen Banner: Selected Team Pokémon & League Display across Full and Compact HUD modes */}
                      {(isWaitingOpponent || scannedOpponents.length === 0) && (
                        <div className="my-1 px-1.5 py-1 rounded bg-slate-950/75 border border-sky-400/35 flex flex-col gap-1 text-[7.5px]">
                          <div className="flex items-center justify-between gap-1 border-b border-white/10 pb-0.5">
                            <div className="flex items-center gap-1 min-w-0">
                              <span className="px-1 py-0.2 rounded bg-sky-500/20 border border-sky-400/55 text-sky-300 font-extrabold font-mono text-[6.8px] uppercase shrink-0">
                                {activePreset.league}
                              </span>
                              <span className="text-slate-300 font-bold truncate" title={activePreset.name}>
                                {activePreset.name}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleSetOverlayHudMode(overlayHudMode === 'compact' ? 'full' : 'compact')}
                              className={`px-1 py-0.2 rounded border font-mono font-extrabold text-[6.5px] uppercase shrink-0 transition ${
                                overlayHudMode === 'compact'
                                  ? 'bg-emerald-500/20 border-emerald-400/60 text-emerald-300 hover:bg-emerald-500/35'
                                  : 'bg-sky-500/20 border-sky-400/60 text-sky-300 hover:bg-sky-500/35'
                              }`}
                              title="Tap to toggle Full HUD vs Compact HUD"
                            >
                              {overlayHudMode === 'compact' ? '⚡ COMPACT HUD' : '📐 FULL HUD'}
                            </button>
                          </div>
                          <div className="grid grid-cols-3 gap-1">
                            {activePreset.pokemon.map((member, idx) => {
                              const isActv = idx === activeUserSlotIndex;
                              return (
                                <button
                                  key={`idle-pill-${member.id}`}
                                  type="button"
                                  onClick={() => handleSelectUserSlot(idx)}
                                  className={`px-1 py-0.5 rounded border text-left transition flex items-center justify-between gap-0.5 min-w-0 ${
                                    isActv
                                      ? 'bg-emerald-500/25 border-emerald-400/80 text-white font-extrabold shadow-[0_0_5px_rgba(16,185,129,0.25)]'
                                      : 'bg-slate-900/70 border-white/15 text-slate-200 hover:bg-slate-800 font-bold'
                                  }`}
                                  title={`Select ${member.name} as active Lead`}
                                >
                                  <span className="truncate text-[7px]">
                                    <span className="text-sky-400 mr-0.5">#{idx + 1}</span>
                                    {member.name}
                                  </span>
                                  {member.cp > 0 && (
                                    <span className="text-[6px] font-mono text-slate-400 shrink-0">
                                      {member.cp}
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* v3.40: Pokéball Counts, Shield Counts, Persistent Floating HP% & Charged Attack Simulator Controls */}
                      {(overlayHudMode !== 'compact' || ((isWaitingOpponent || scannedOpponents.length === 0) && !isBattleActive)) && (
                      <div className="flex flex-col gap-0.5 px-1 py-0.5 bg-black/35 rounded border border-white/10 text-[7px] font-mono my-0.5">
                        <div className="flex items-center justify-between gap-1">
                          <div className="flex items-center gap-1">
                            <span className="text-slate-400 font-bold">You:</span>
                            <span className="flex items-center tracking-tighter" title={`Player Pokéballs: ${playerPokeballCount}/3 remaining`}>
                              {[0, 1, 2].map((i) => (
                                <span key={i} className={i < playerPokeballCount ? 'text-red-500' : 'text-slate-600 opacity-40'}>●</span>
                              ))}
                            </span>
                            <span className="text-pink-400 font-bold ml-0.5" title={`Player Shields: ${userShields}/2 remaining`}>
                              🛡️{userShields}
                            </span>
                            <button
                              type="button"
                              onClick={handleSimulatePlayerSwap}
                              className="px-1 py-0.2 rounded bg-sky-500/20 hover:bg-sky-500/40 text-sky-200 border border-sky-400/30"
                              title="Simulate True Swap for Player (resets to 50s, preserves current slot HP%)"
                            >
                              Swap P
                            </button>
                            <button
                              type="button"
                              onClick={handleSimulatePlayerFaint}
                              className="px-1 py-0.2 rounded bg-red-500/20 hover:bg-red-500/40 text-red-200 border border-red-400/30"
                              title="Simulate Player Faint (-1 ball, dims column, preserves swap timer)"
                            >
                              Faint P
                            </button>
                            <button
                              type="button"
                              onClick={() => handleThrowMyChargedAttack(0, false)}
                              className="px-1 py-0.2 rounded bg-amber-500/25 hover:bg-amber-500/45 text-amber-200 border border-amber-400/40"
                              title="Simulate throwing your Charged Move 1 (unshielded HP drop + logs CHARGED_ATTACK)"
                            >
                              ⚡My Atk
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={handleResetTimersAndBalls}
                            className="px-1 py-0.2 rounded bg-slate-700/50 hover:bg-slate-600 text-slate-300 border border-slate-500/30 ml-auto"
                            title="Reset all swap clocks to 0s (Ready), restore 100% HP, 3 Pokéballs and 2 Shields"
                          >
                            ↺
                          </button>
                        </div>
                        <div className="flex items-center justify-between gap-1">
                          <div className="flex items-center gap-1">
                            <span className="text-slate-400 font-bold">Opp:</span>
                            <span className="flex items-center tracking-tighter" title={`Opponent Pokéballs: ${oppPokeballCount}/3 remaining`}>
                              {[0, 1, 2].map((i) => (
                                <span key={i} className={i < oppPokeballCount ? 'text-red-500' : 'text-slate-600 opacity-40'}>●</span>
                              ))}
                            </span>
                            <span className="text-pink-400 font-bold ml-0.5" title={`Opponent Shields: ${oppShields}/2 remaining`}>
                              🛡️{oppShields}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleSimulateOpponentSwap(false)}
                              className="px-1 py-0.2 rounded bg-sky-500/20 hover:bg-sky-500/40 text-sky-200 border border-sky-400/30"
                              title="Simulate True Swap for Opponent (resets to 50s, preserves current slot HP%)"
                            >
                              Swap Opp
                            </button>
                            <button
                              type="button"
                              onClick={handleSimulateOpponentFaint}
                              className="px-1 py-0.2 rounded bg-red-500/20 hover:bg-red-500/40 text-red-200 border border-red-400/30"
                              title="Simulate Opponent Faint (-1 ball, dims column, preserves swap timer)"
                            >
                              Faint Opp
                            </button>
                            <button
                              type="button"
                              onClick={() => setIsAttackIncomingPrompt((prev) => !prev)}
                              className={`px-1 py-0.2 rounded border transition ${
                                isAttackIncomingPrompt
                                  ? 'bg-rose-500/50 text-white border-rose-300 animate-pulse'
                                  : 'bg-rose-500/20 hover:bg-rose-500/40 text-rose-200 border-rose-400/40'
                              }`}
                              title='Simulate "Attack incoming! Use a Protect Shield?" prompt to trigger instant Shield vs No-Shield recommendation'
                            >
                              ⚡Opp Atk
                            </button>
                          </div>
                        </div>
                        {/* Persistent Floating HP% & Energy Controls + 2Hz/1Hz Turn-Offset Telemetry */}
                        <div className="grid grid-cols-2 gap-1.5 pt-0.5 border-t border-white/10 items-center">
                          <div className="flex items-center gap-1" title="Adjust Active Player Pokémon HP% (persists when swapped to bench)">
                            <span className="text-emerald-300 font-bold shrink-0">
                              HP:{userSlotHpPct[activeUserSlotIndex] ?? 100}%
                            </span>
                            <input
                              type="range"
                              min={5}
                              max={100}
                              step={5}
                              value={userSlotHpPct[activeUserSlotIndex] ?? 100}
                              onChange={(e) => handleUpdateUserActiveHp(Number(e.target.value))}
                              className="w-full h-1 accent-emerald-400 cursor-pointer"
                            />
                          </div>
                          <div className="flex items-center gap-1" title="Adjust Active Opponent Pokémon HP% (persists when swapped to bench)">
                            <span className="text-amber-300 font-bold shrink-0">
                              Opp:{oppSlotHpPct[safeActiveOppSlot] ?? 100}%
                            </span>
                            <input
                              type="range"
                              min={5}
                              max={100}
                              step={5}
                              value={oppSlotHpPct[safeActiveOppSlot] ?? 100}
                              onChange={(e) => handleUpdateOppActiveHp(Number(e.target.value))}
                              className="w-full h-1 accent-amber-400 cursor-pointer"
                            />
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-1 pt-0.5 border-t border-white/10">
                          <button
                            type="button"
                            onClick={() => setScanHzMode((prev) => (prev === '2Hz' ? '1Hz' : '2Hz'))}
                            className="px-1 py-0.2 rounded bg-emerald-500/20 hover:bg-emerald-500/35 text-emerald-200 border border-emerald-400/40"
                            title="Toggle Locked 2.00 Hz (500ms = 1 turn) vs 1.00 Hz (1000ms = 2 turns with 0.5s mid-turn extrapolation)"
                          >
                            ⏱️ {scanHzMode} Lock ({scanHzMode === '2Hz' ? '500ms/1t' : '1000ms/2t'}) • Δt={scanTurnOffsetMs}ms
                          </button>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                const gain = resolveFastMove(activeOpponent)?.energyGain || activeOpponent.defaultFastMove?.energyGain || 8;
                                const nextE = Math.min(100, (oppSlotEnergy[safeActiveOppSlot] ?? oppEnergy) + gain);
                                setOppEnergy(nextE);
                                setOppSlotEnergy((prev) => {
                                  const next = [...prev];
                                  next[safeActiveOppSlot] = nextE;
                                  return next;
                                });
                                const fDmg = Math.max(1, Math.round(oppFastInfo.percentage || 3));
                                const curMyHp = userSlotHpPct[activeUserSlotIndex] ?? 100;
                                const nextHp = Math.max(1, curMyHp - fDmg);
                                handleUpdateUserActiveHp(nextHp);
                                if (100 - nextHp >= 10 && simOppFastMoveStatus === 'unconfirmed') {
                                  setSimOppFastMoveStatus('confirmed_standard');
                                }
                                setScanTurnOffsetMs(Date.now() % 500);
                              }}
                              className="px-1 py-0.2 rounded bg-cyan-500/25 hover:bg-cyan-500/40 text-cyan-200 border border-cyan-400/40"
                              title="Simulate 1 Opponent Fast Move (+Energy & >=10% HP Fast Move Confirmation)"
                            >
                              +1 Opp Fast ({oppSlotEnergy[safeActiveOppSlot] ?? oppEnergy}E)
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setSimOppFastMoveStatus((prev) =>
                                  prev === 'unconfirmed'
                                    ? 'confirmed_standard'
                                    : prev === 'confirmed_standard'
                                    ? 'confirmed_non_standard'
                                    : 'unconfirmed'
                                )
                              }
                              className="px-1 py-0.2 rounded bg-amber-500/25 hover:bg-amber-500/40 text-amber-200 border border-amber-400/40"
                              title="Cycle v3.80 Opponent Fast Move Status: Unconfirmed (Italic) -> Confirmed Standard (Bold) -> Confirmed Non-Standard (Theme Badge)"
                            >
                              {simOppFastMoveStatus === 'confirmed_non_standard'
                                ? 'Fast: Non-Std'
                                : simOppFastMoveStatus === 'confirmed_standard'
                                ? 'Fast: Std ✓'
                                : 'Fast: Unconf'}
                            </button>
                          </div>
                        </div>
                      </div>
                      )}

                      {/* In-Overlay Post-Stop Log Result Action Menu (Lead Matchup + Win/Loss/Skip) */}
                      {showStartBattleMenu && (
                        <div className="flex items-center justify-between gap-1 bg-slate-950/95 border border-sky-400/75 rounded p-1 my-1 shadow-xl text-[7.5px]">
                          <button
                            type="button"
                            onClick={handleCycleLeadMatchup}
                            className={`px-1.5 py-0.5 rounded font-extrabold border transition ${
                              currentLeadMatchup === 'FAVORABLE'
                                ? 'bg-emerald-600/35 border-emerald-400 text-emerald-200'
                                : currentLeadMatchup === 'NEGATIVE'
                                ? 'bg-red-600/35 border-red-400 text-red-200'
                                : 'bg-slate-700/50 border-slate-400 text-slate-200'
                            }`}
                            title="Tap to cycle Lead Matchup (Auto-detected from 1st-seen opponent vs your Lead)"
                          >
                            Lead: {currentLeadMatchup === 'FAVORABLE' ? 'Fav' : currentLeadMatchup === 'NEGATIVE' ? 'Neg' : 'Neu'}
                          </button>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleLogBattleFromOverlay('WIN')}
                              className="px-1.5 py-0.5 rounded font-extrabold bg-emerald-600/45 hover:bg-emerald-500/60 border border-emerald-300 text-emerald-100"
                            >
                              🏆 Win
                            </button>
                            <button
                              type="button"
                              onClick={() => handleLogBattleFromOverlay('LOSS')}
                              className="px-1.5 py-0.5 rounded font-extrabold bg-red-600/45 hover:bg-red-500/60 border border-red-300 text-red-100"
                            >
                              💀 Loss
                            </button>
                            <button
                              type="button"
                              onClick={handleSkipLoggingStoppedBattle}
                              className="px-1.5 py-0.5 rounded font-bold bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-300 hover:text-white"
                              title="Dismiss without logging"
                            >
                              ✕ Skip
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Floating PvPoke Top 10 Opponent Swap Popover in Overlay */}
                      {showOpponentPicker && (
                        <div className="bg-slate-950/95 border border-sky-400/50 rounded-lg p-2 my-1 shadow-2xl backdrop-blur-md z-40 text-[8px]">
                          <div className="flex items-center justify-between pb-1 border-b border-white/10 mb-1.5">
                            <span className="font-bold text-amber-200">
                              Top 10 Opponents ({activeOpponentLeague.split(' ')[0]}):
                            </span>
                            <button
                              onClick={() => setShowOpponentPicker(false)}
                              className="text-slate-400 hover:text-white px-1 text-[9px] font-bold"
                            >
                              ✕
                            </button>
                          </div>
                          <div className="grid grid-cols-2 gap-1 max-h-[140px] overflow-y-auto scrollbar-none">
                            {currentTopOpponents.map((topMon) => (
                              <button
                                key={topMon.name}
                                onClick={() => handleSelectOpponent(topMon.name)}
                                className={`px-1.5 py-1 rounded text-left font-semibold border flex items-center justify-between transition ${
                                  activeOpponent.name === topMon.name
                                    ? 'bg-sky-500/35 border-sky-400 text-sky-100 font-bold'
                                    : 'bg-slate-900/80 border-slate-700/60 text-slate-200 hover:bg-slate-800'
                                }`}
                              >
                                <span className="truncate">#{topMon.rank} {topMon.name.split(' ')[0]}</span>
                                <span className="text-[7px] text-amber-300 shrink-0 ml-1 font-mono">{topMon.fastTurns}t</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* 3v3 Matchup Matrix Dots (FIXED Discovery Order: #1 1st seen, #2 2nd seen, #3 3rd seen) */}
                      {!(isWaitingOpponent || scannedOpponents.length === 0) && (overlayHudMode !== 'compact' || compactHudShowMatrix) && (
                      <div className="my-1 py-1 px-1.5 bg-black/20 rounded flex flex-col gap-0.5 text-[9.5px]">
                        <>
                            <div className="flex items-center justify-between gap-1.5 px-1.5 pb-1 mb-0.5 border-b border-white/10">
                              <span className="text-[7.5px] font-bold text-slate-400 tracking-tight truncate">
                                OPP / MY BANKED E
                              </span>
                              <div className="flex items-center gap-[1px] text-[8.5px] font-mono shrink-0">
                                {[0, 1, 2].map((slotIdx) => {
                                  const pMon = activePreset.pokemon[slotIdx];
                                  const pInit = pMon?.name.charAt(0).toUpperCase() || `P${slotIdx + 1}`;
                                  const isFainted = !!playerFaintedSlots[slotIdx] || (userSlotHpPct[slotIdx] ?? 100) <= 0;
                                  const slotE = isFainted
                                    ? 0
                                    : slotIdx === activeUserSlotIndex
                                    ? userSlotEnergy[slotIdx] ?? userEnergy
                                    : userSlotEnergy[slotIdx] ?? 0;
                                  const hasEntered = !!playerSlotEverOnField[slotIdx] || slotIdx === activeUserSlotIndex || slotE > 0 || isFainted;
                                  const eSuffix = isFainted ? '0E' : hasEntered ? `${slotE}E` : '-E';
                                  return (
                                    <React.Fragment key={`banked-hdr-${slotIdx}`}>
                                      {slotIdx > 0 && <span className="text-white/25 mx-[1.5px] text-[8px]">|</span>}
                                      <span
                                        className={`w-[34px] inline-flex items-center justify-center font-extrabold tracking-tighter ${
                                          eSuffix === '-E'
                                            ? 'text-slate-400'
                                            : slotE > 0 && !isFainted
                                            ? 'text-yellow-300'
                                            : 'text-slate-300'
                                        }`}
                                        title={`${pMon?.name || pInit}: ${eSuffix === '-E' ? 'Never entered field (-E)' : `Banked Energy ${eSuffix}`}`}
                                      >
                                        {pInit}:{eSuffix}
                                      </span>
                                    </React.Fragment>
                                  );
                                })}
                              </div>
                            </div>
                            {scannedOpponents.map((oppName, idx) => {
                              const isActiveSlot = idx === safeActiveOppSlot;
                              const matrix = calculateShieldMatrix(
                                oppName,
                                activePreset.pokemon,
                                isActiveSlot && isOpponentShadow,
                                activePreset.league
                              );
                              const fullOppDisplay = (isActiveSlot && isOpponentShadow ? 'S-' : '') + oppName;

                              const isOppFainted = !!oppFaintedSlots[idx];
                              const slotOppStats = POKEMON_DATABASE[oppName] || activeOpponent;
                              const cheapestMoveE = Math.min(
                                ...(slotOppStats?.chargedMoves || []).map((m) => resolveChargedMove(m.name, slotOppStats?.types?.[0] || 'normal').energyCost || m.energyCost || 40),
                                45
                              );
                              const slotOppE = isOppFainted
                                ? 0
                                : idx === safeActiveOppSlot
                                ? oppSlotEnergy[idx] ?? oppEnergy
                                : oppSlotEnergy[idx] ?? 0;
                              const isSlotMoveReady = !isOppFainted && slotOppE >= cheapestMoveE;
                              const slotEnergyLabel = isSlotMoveReady ? `${slotOppE}E READY` : `${slotOppE}E`;
                              return (
                                <div
                                  key={`${oppName}-${idx}`}
                                  onClick={() => handleSwapActiveOpponent(oppName)}
                                  className={`flex items-center justify-between gap-1.5 px-1.5 py-0.5 rounded cursor-pointer transition ${
                                    isOppFainted
                                      ? 'opacity-35 line-through bg-black/20'
                                      : isActiveSlot
                                      ? 'bg-sky-500/25 border border-sky-400/50 shadow-[0_0_8px_rgba(56,189,248,0.25)]'
                                      : 'hover:bg-white/10 border border-transparent'
                                  }`}
                                  title={isOppFainted ? `#${idx + 1} Seen: ${oppName} (Fainted)` : isActiveSlot ? `#${idx + 1} Seen: ${oppName} (Active on field • ${slotEnergyLabel})` : `Click to set #${idx + 1} (${oppName}) as active opponent (${slotEnergyLabel})`}
                                >
                                  <div className="flex items-center gap-1 min-w-[114px] max-w-[146px] flex-1 overflow-hidden">
                                    <span className={`text-[8px] font-bold shrink-0 ${isOppFainted ? 'text-slate-500' : isActiveSlot ? 'text-sky-300' : 'text-slate-400'}`}>
                                      #{idx + 1}
                                    </span>
                                    <span className={`font-bold truncate text-[9.5px] ${isOppFainted ? 'text-slate-400 line-through' : 'text-slate-100'}`} title={fullOppDisplay}>
                                      {fullOppDisplay}
                                    </span>
                                    <span
                                      className={`text-[7px] font-mono font-bold shrink-0 ${
                                        isOppFainted
                                          ? 'text-slate-500 line-through'
                                          : (oppSlotHpPct[idx] ?? 100) > 50
                                          ? 'text-emerald-300'
                                          : (oppSlotHpPct[idx] ?? 100) > 20
                                          ? 'text-amber-300'
                                          : 'text-rose-300'
                                      }`}
                                      title={`Persisted Opponent HP: ${isOppFainted ? 0 : (oppSlotHpPct[idx] ?? 100)}%`}
                                    >
                                      {isOppFainted ? 0 : (oppSlotHpPct[idx] ?? 100)}%
                                    </span>
                                    {!isOppFainted && (
                                      <span
                                        className={`text-[6.5px] font-mono font-black px-1 py-0.2 rounded border shrink-0 leading-none ${
                                          isSlotMoveReady
                                            ? 'text-yellow-200 bg-amber-700/75 border-yellow-300/90 shadow-[0_0_4px_rgba(250,204,21,0.5)]'
                                            : 'text-sky-200 bg-sky-950/70 border-sky-400/50'
                                        }`}
                                        title={`Opponent Energy: ${slotOppE}E (Cheapest Move: ${cheapestMoveE}E)`}
                                      >
                                        {slotEnergyLabel}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-[1px] text-[9px] font-mono shrink-0">
                                    <span className="w-[34px] inline-flex items-center justify-center">{renderTierDots(matrix.p1)}</span>
                                    <span className="text-white/25 mx-[1.5px] text-[8px]">|</span>
                                    <span className="w-[34px] inline-flex items-center justify-center">{renderTierDots(matrix.p2)}</span>
                                    <span className="text-white/25 mx-[1.5px] text-[8px]">|</span>
                                    <span className="w-[34px] inline-flex items-center justify-center">{renderTierDots(matrix.p3)}</span>
                                  </div>
                                </div>
                              );
                            })}
                          </>
                      </div>
                      )}

                      {/* Opponent Attacks & My Attacks (Segmented Range Bars + 3-Column Damage Matrices with Vertical Highlight) */}
                      {overlayHudMode !== 'compact' && !isWaitingOpponent && scannedOpponents.length > 0 && (
                        <div className="flex flex-col gap-0.5 my-1">
                          {/* Opponent Attacks Section Header (2-Line) + 3-Team Column Headers & Opponent Swap Clock */}
                          <div className="grid grid-cols-[minmax(0,1fr)_84px] items-stretch gap-1 px-1 pt-0.5">
                            <div className="flex flex-col justify-between gap-0.5 pr-1 min-w-0">
                              <div className="text-[7.5px] font-extrabold text-slate-400 uppercase tracking-wider flex items-center justify-between gap-1 min-w-0">
                                <span className="flex items-center gap-1 min-w-0 shrink-0">
                                  <span className="shrink-0">Opp Attacks</span>
                                  <span
                                    className={`text-[7px] font-mono font-extrabold px-1 py-0.2 rounded border leading-none shrink-0 ${
                                      (oppSlotHpPct[safeActiveOppSlot] ?? 100) <= 0
                                        ? 'text-slate-400 bg-slate-900/60 border-slate-700 line-through'
                                        : (oppSlotHpPct[safeActiveOppSlot] ?? 100) <= 22
                                        ? 'text-rose-200 bg-rose-950/70 border-rose-400/70'
                                        : (oppSlotHpPct[safeActiveOppSlot] ?? 100) <= 50
                                        ? 'text-amber-200 bg-amber-950/70 border-amber-400/70'
                                        : 'text-emerald-200 bg-emerald-950/70 border-emerald-400/70'
                                    }`}
                                    title={`Active Opponent HP: ${oppSlotHpPct[safeActiveOppSlot] ?? 100}%`}
                                  >
                                    {oppSlotHpPct[safeActiveOppSlot] ?? 100}%
                                  </span>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const next = oppShields > 0 ? oppShields - 1 : 2;
                                      setOppShields(next);
                                    }}
                                    className={`px-1 py-0.2 rounded border text-[7px] font-mono font-extrabold leading-none transition-all flex items-center gap-0.5 active:scale-95 cursor-pointer shrink-0 ${
                                      oppShields === 0
                                        ? 'opacity-50 text-slate-400 bg-slate-900/60 border-slate-700 line-through'
                                        : 'text-amber-300 bg-amber-950/60 border-amber-400/60 hover:bg-amber-900/50'
                                    }`}
                                    title={`Opponent Shields: ${oppShields}/2 remaining (Tap to cycle 2->1->0->2)`}
                                  >
                                    <span className="text-[7px]">🛡️</span>
                                    <span>{oppShields}</span>
                                  </button>
                                </span>
                                <span className="flex items-center gap-1 shrink-0">
                                  <span
                                    className={`text-[7px] font-mono font-black px-1 py-0.2 rounded border leading-none ${
                                      !oppMoveTimingInfo.winsCmp
                                        ? 'bg-emerald-500/25 border-emerald-400/80 text-slate-100'
                                        : 'bg-red-500/25 border-red-400/80 text-slate-100'
                                    }`}
                                    title={!oppMoveTimingInfo.winsCmp ? 'Opponent wins CMP tie' : 'Opponent loses CMP tie'}
                                  >
                                    CMP
                                    <span className={!oppMoveTimingInfo.winsCmp ? 'text-emerald-400 ml-0.5' : 'text-red-400 ml-0.5'}>
                                      {!oppMoveTimingInfo.winsCmp ? '✓' : '✗'}
                                    </span>
                                  </span>
                                  <span
                                    className={`font-mono font-extrabold text-[7px] px-1 py-0.2 rounded border leading-none transition-colors shrink-0 ${
                                      !oppSwitchValidityLatched
                                        ? 'text-cyan-300 bg-cyan-950/70 border-cyan-400/80 animate-pulse'
                                        : oppSwapRemainingSec <= 0
                                        ? 'text-[#FF3B30] bg-red-950/60 border-red-500/60 shadow-[0_0_6px_rgba(255,59,48,0.35)]'
                                        : oppSwapRemainingSec <= hapticOppSwapWarnSec
                                        ? 'text-white bg-rose-600/90 border-rose-300 animate-pulse shadow-[0_0_7px_rgba(244,63,94,0.85)]'
                                        : oppSwapRemainingSec < 10
                                        ? 'text-[#FFD700] bg-amber-950/60 border-amber-400/60'
                                        : 'text-white bg-black/45 border-white/40'
                                    }`}
                                    title={
                                      !oppSwitchValidityLatched
                                        ? 'Frame 1 Provisional Swap Detected — Awaiting Frame 2 OCR Validity Latch'
                                        : 'Opponent Swap Countdown (50s midpoint countdown, resets on Manual Swap)'
                                    }
                                  >
                                    Swap: {oppSwapRemainingSec}s{!oppSwitchValidityLatched ? ' [1F]' : ''}
                                  </span>
                                </span>
                              </div>
                              <div className="flex items-center justify-between gap-1 min-w-0 leading-tight">
                                <span className="text-amber-300 font-extrabold text-[7.5px] font-mono normal-case truncate min-w-0 flex-1">
                                  {abbrPoke3(activeOpponent.name, false)} {oppSlotHpPct[safeActiveOppSlot] ?? 100}% ·{' '}
                                  {simOppFastMoveStatus === 'confirmed_non_standard' ? (
                                    <span
                                      className="inline-block font-black not-italic rounded px-1 py-0"
                                      style={{
                                        backgroundColor: `${activeTheme.accentSecondaryHex}3D`,
                                        border: `1px solid ${activeTheme.accentSecondaryHex}`,
                                        color: activeTheme.accentSecondaryHex
                                      }}
                                      title="Confirmed Non-Standard Fast Move (>=10% HP damage check)"
                                    >
                                      {oppFastInfo.telemetry}
                                    </span>
                                  ) : simOppFastMoveStatus === 'confirmed_standard' ? (
                                    <span className="font-black not-italic" title="Confirmed Standard Fast Move (>=10% HP damage check)">
                                      {oppFastInfo.telemetry}
                                    </span>
                                  ) : (
                                    <span className="italic font-bold opacity-90" title="Unconfirmed Standard Fast Move (awaiting >=10% HP damage check)">
                                      {oppFastInfo.telemetry}
                                    </span>
                                  )}
                                </span>
                                {(() => {
                                  const activeOppE = oppSlotEnergy[safeActiveOppSlot] ?? oppEnergy;
                                  const cheapestOppCost = Math.min(
                                    ...activeOpponent.chargedMoves.map((m) => resolveChargedMove(m.name, activeOpponent.types[0]).energyCost || m.energyCost || 40),
                                    45
                                  );
                                  const oppRdy = activeOppE >= cheapestOppCost;
                                  return (
                                    <span
                                      className={`text-[6.8px] font-mono font-black px-1 py-0.2 rounded border shrink-0 leading-none ${
                                        oppRdy
                                          ? 'text-yellow-200 bg-amber-700/75 border-yellow-300/90 shadow-[0_0_4px_rgba(250,204,21,0.5)]'
                                          : 'text-sky-200 bg-sky-950/70 border-sky-400/50'
                                      }`}
                                      title={`Opponent Energy: ${activeOppE}E (Cheapest Charged Move: ${cheapestOppCost}E)`}
                                    >
                                      {activeOppE}E{oppRdy ? ' READY' : ''}
                                    </span>
                                  );
                                })()}
                              </div>
                            </div>
                            <div className="grid grid-cols-3 w-[84px] text-center font-mono text-[7.5px] font-extrabold items-stretch">
                              {[0, 1, 2].map((slotIdx) => {
                                const memberName = activePreset.pokemon[slotIdx]?.name || '';
                                const code = memberName
                                  ? abbrPoke3(memberName, false).toUpperCase().slice(0, 3)
                                  : '---';
                                const isActv = slotIdx === activeUserSlotIndex;
                                const isFainted = !isActv && !!playerFaintedSlots[slotIdx];
                                const slotHp = isFainted ? 0 : (userSlotHpPct[slotIdx] ?? 100);
                                const hpColorCls = isFainted
                                  ? 'text-slate-500'
                                  : slotHp > 50
                                  ? 'text-emerald-300'
                                  : slotHp > 20
                                  ? 'text-amber-300'
                                  : 'text-rose-300';
                                return (
                                  <span
                                    key={slotIdx}
                                    onClick={() => handleSelectUserSlot(slotIdx)}
                                    className={`py-0.5 leading-[1.05] transition flex flex-col items-center justify-between cursor-pointer ${
                                      isFainted
                                        ? 'opacity-35 text-[#5A6577] line-through'
                                        : isActv
                                        ? 'bg-sky-500/25 text-sky-200 border-t border-x border-sky-400/80 rounded-t shadow-[0_0_6px_rgba(56,189,248,0.25)]'
                                        : 'text-slate-400'
                                    }`}
                                    title={isFainted ? `${memberName} (Fainted)` : `${memberName} (${slotHp}% HP)`}
                                  >
                                    <span>{code}</span>
                                    <span className={`text-[6.8px] font-mono ${hpColorCls}`}>{slotHp}%</span>
                                  </span>
                                );
                              })}
                            </div>
                          </div>

                          {/* Opponent Attack Rows (Turn-Aligned Proportional Bars + Multi-Cycle Support) */}
                          <div className="flex flex-col gap-[2px]">
                            {(oppMoveTimingInfo?.rows || [])
                              .filter((row) =>
                                simConfirmedOppMoves.length >= 2
                                  ? simConfirmedOppMoves.includes(row.name)
                                  : true
                              )
                              .map((row, rIdx, rowArr) => {
                              const isLastRow = rIdx === rowArr.length - 1;
                              const isConfirmedUsed = simConfirmedOppMoves.includes(row.name);
                              const threatLevel =
                                row.activeDmgPct >= 60 || row.activeEff >= 1.5
                                  ? 'high'
                                  : row.activeDmgPct <= 30 || (row.activeEff <= 0.65 && row.activeDmgPct < 45)
                                  ? 'low'
                                  : 'mid';
                              const titleColor =
                                threatLevel === 'high'
                                  ? 'text-red-300'
                                  : threatLevel === 'low'
                                  ? 'text-emerald-300'
                                  : 'text-amber-300';

                              return (
                                <div
                                  key={row.name}
                                  className="bg-slate-950/55 border border-slate-400/20 rounded px-1 py-0.5 grid grid-cols-[44px_1fr_84px] items-center gap-1 tabular-nums"
                                >
                                  {/* Left: <=5 Char Move Name (Top, inside theme-aware badge if confirmed used) & Energy/Turns (Bottom) */}
                                  <div
                                    className="flex flex-col leading-tight min-w-0 cursor-pointer"
                                    onClick={() =>
                                      setSimConfirmedOppMoves((prev) =>
                                        prev.includes(row.name)
                                          ? prev.filter((m) => m !== row.name)
                                          : [...prev, row.name].slice(0, 2)
                                      )
                                    }
                                    title={`${row.name}${isConfirmedUsed ? ' (Confirmed Used — Tap to toggle)' : ' (Tap to simulate "' + activeOpponent.name + ' used ' + row.name + '!" OCR confirmation)'}`}
                                  >
                                    <span
                                      className={`text-[8.5px] font-extrabold truncate self-start max-w-full ${titleColor} ${
                                        isConfirmedUsed ? 'px-1 rounded' : ''
                                      }`}
                                      style={
                                        isConfirmedUsed
                                          ? {
                                              backgroundColor: `rgba(${activeTheme.overlayHeaderRgb}, 0.24)`,
                                              border: `1px solid ${activeTheme.accentHex}`,
                                              boxShadow: `0 0 4px rgba(${activeTheme.overlayHeaderRgb}, 0.35)`
                                            }
                                          : undefined
                                      }
                                    >
                                      {row.shortName}
                                    </span>
                                    <span className="text-[7.5px] text-slate-300 font-mono truncate">
                                      {row.energy}e/{row.displayReadyCount}f
                                    </span>
                                  </div>

                                  {/* Center: Turn-Aligned Proportional Multi-Cycle Segmented Bar */}
                                  <div className="flex items-center justify-start min-w-0 w-full bg-slate-900/45 rounded p-[1px]">
                                    <div className="flex items-center justify-start w-full">
                                      {(row.cycles || []).map((cycle) => (
                                        <div
                                          key={cycle.cycleIndex}
                                          style={{ width: `${cycle.widthPct}%` }}
                                          className="flex items-center gap-[1.5px] pr-[1.5px] last:pr-0 min-w-0 shrink-0"
                                        >
                                          {cycle.rangeLabel ? (
                                            <span
                                              className="flex-1 min-w-0 text-center rounded px-1 py-0.5 text-[7px] font-extrabold truncate bg-sky-600/35 border border-sky-400/70 text-sky-200 leading-none"
                                              title={`Throw ${cycle.cycleIndex} charging taps: ${cycle.rangeLabel} (Turns ${cycle.startTurn + 1}–${cycle.readyTurn})`}
                                            >
                                              {cycle.rangeLabel}
                                            </span>
                                          ) : null}
                                          {cycle.readyState === 'cmp' ? (
                                            <span
                                              className="rounded px-1 py-0.5 text-[7px] font-extrabold whitespace-nowrap bg-green-600/55 border border-green-300 text-white leading-none shrink-0"
                                              title={`Throw #${cycle.cycleIndex} ready at Turn ${cycle.readyTurn} (Tap ${cycle.readyLabel} · CMP Win)`}
                                            >
                                              {cycle.readyLabel}
                                            </span>
                                          ) : (
                                            <span
                                              className="rounded px-1 py-0.5 text-[7px] font-extrabold whitespace-nowrap bg-red-600/55 border border-red-300 text-white leading-none shrink-0"
                                              title={`Throw #${cycle.cycleIndex} ready at Turn ${cycle.readyTurn} (Tap ${cycle.readyLabel} · Catch/CMP)`}
                                            >
                                              {cycle.readyLabel}
                                            </span>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  </div>

                                  {/* Right: 3-Pokemon Team Damage % Columns with Vertical Active Highlight, Faint Dimming & KO Range Highlighting */}
                                  <div className="grid grid-cols-3 w-[84px] items-center text-center font-mono shrink-0">
                                    {(row.teamDamages || []).map((cell, cIdx) => {
                                      const isActv = cIdx === activeUserSlotIndex;
                                      const isFainted = !isActv && !!playerFaintedSlots[cIdx];
                                      const targetUserHp = isFainted ? 0 : (userSlotHpPct[cIdx] ?? 100);
                                      const isKoRange = !isFainted && !cell.isEmpty && cell.dmgPct >= targetUserHp;
                                      const textCls =
                                        isFainted
                                          ? 'text-[#5A6577] opacity-35'
                                          : isKoRange
                                          ? 'text-rose-200 font-black'
                                          : cell.tier === 'resist'
                                          ? 'text-emerald-300'
                                          : cell.tier === 'weak'
                                          ? 'text-red-300'
                                          : 'text-amber-200';
                                      return (
                                        <div
                                          key={cIdx}
                                          className={`py-0.5 text-[7.5px] font-extrabold leading-tight ${textCls} ${
                                            isFainted
                                              ? 'bg-slate-950/40 opacity-35'
                                              : isKoRange
                                              ? 'bg-rose-600/35 border border-rose-400/80 rounded-xs'
                                              : isActv
                                              ? `bg-sky-500/25 border-x border-sky-400/80 shadow-[inset_0_0_6px_rgba(56,189,248,0.25)] ${
                                                  isLastRow ? 'border-b rounded-b' : ''
                                                }`
                                              : 'bg-slate-900/40'
                                          }`}
                                          title={
                                            isFainted
                                              ? `${cell.name} (Fainted)`
                                              : `${cell.name} (${targetUserHp}% HP): ${cell.dmgPct}%${isKoRange ? ' — LETHAL KO RANGE!' : ''}`
                                          }
                                        >
                                          {cell.isEmpty ? '—' : isKoRange ? `KO ${cell.dmgPct}%` : `${cell.dmgPct}%`}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {/* My Attacks Section Header (2-Line) + 3-Opponent Column Headers & Player Swap Clock */}
                          <div className="grid grid-cols-[minmax(0,1fr)_84px] items-stretch gap-1 px-1 pt-1">
                            <div className="flex flex-col justify-between gap-0.5 pr-1 min-w-0">
                              <div className="text-[7.5px] font-extrabold text-slate-400 uppercase tracking-wider flex items-center justify-between gap-1 min-w-0">
                                <span className="flex items-center gap-1 min-w-0 shrink-0">
                                  <span className="shrink-0">My Attacks</span>
                                  <span
                                    className={`text-[7px] font-mono font-extrabold px-1 py-0.2 rounded border leading-none shrink-0 ${
                                      (userSlotHpPct[activeUserSlotIndex] ?? 100) <= 0
                                        ? 'text-slate-400 bg-slate-900/60 border-slate-700 line-through'
                                        : (userSlotHpPct[activeUserSlotIndex] ?? 100) <= 22
                                        ? 'text-rose-200 bg-rose-950/70 border-rose-400/70'
                                        : (userSlotHpPct[activeUserSlotIndex] ?? 100) <= 50
                                        ? 'text-amber-200 bg-amber-950/70 border-amber-400/70'
                                        : 'text-emerald-200 bg-emerald-950/70 border-emerald-400/70'
                                    }`}
                                    title={`Active Player Pokémon HP: ${userSlotHpPct[activeUserSlotIndex] ?? 100}%`}
                                  >
                                    {userSlotHpPct[activeUserSlotIndex] ?? 100}%
                                  </span>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const next = userShields > 0 ? userShields - 1 : 2;
                                      setUserShields(next);
                                    }}
                                    className={`px-1 py-0.2 rounded border text-[7px] font-mono font-extrabold leading-none transition-all flex items-center gap-0.5 active:scale-95 cursor-pointer shrink-0 ${
                                      userShields === 0
                                        ? 'opacity-50 text-slate-400 bg-slate-900/60 border-slate-700 line-through'
                                        : 'text-sky-200 border-sky-400/50 hover:bg-sky-900/50'
                                    }`}
                                    style={{
                                      borderColor: userShields > 0 ? `rgba(${activeTheme.overlayHeaderRgb}, 0.65)` : undefined,
                                      backgroundColor: userShields > 0 ? `rgba(${activeTheme.overlayHeaderRgb}, 0.22)` : undefined,
                                      color: userShields > 0 ? activeTheme.accentHex : undefined
                                    }}
                                    title={`Your Shields: ${userShields}/2 remaining (Tap to cycle 2->1->0->2)`}
                                  >
                                    <span className="text-[7px]">🛡️</span>
                                    <span>{userShields}</span>
                                  </button>
                                </span>
                                <span className="flex items-center gap-1 shrink-0">
                                  <span
                                    className={`text-[7px] font-mono font-black px-1 py-0.2 rounded border leading-none ${
                                      oppMoveTimingInfo.winsCmp
                                        ? 'bg-emerald-500/25 border-emerald-400/80 text-slate-100'
                                        : 'bg-red-500/25 border-red-400/80 text-slate-100'
                                    }`}
                                    title={oppMoveTimingInfo.winsCmp ? 'Your Pokémon wins CMP tie' : 'Your Pokémon loses CMP tie'}
                                  >
                                    CMP
                                    <span className={oppMoveTimingInfo.winsCmp ? 'text-emerald-400 ml-0.5' : 'text-red-400 ml-0.5'}>
                                      {oppMoveTimingInfo.winsCmp ? '✓' : '✗'}
                                    </span>
                                  </span>
                                  <span
                                    className={`font-mono font-extrabold text-[7px] px-1 py-0.2 rounded border leading-none transition-colors shrink-0 ${
                                      !playerSwitchValidityLatched
                                        ? 'text-cyan-300 bg-cyan-950/70 border-cyan-400/80 animate-pulse'
                                        : playerSwapRemainingSec <= 0
                                        ? 'text-[#00FF00] bg-emerald-950/60 border-emerald-500/60 shadow-[0_0_6px_rgba(0,255,0,0.35)]'
                                        : playerSwapRemainingSec < 10
                                        ? 'text-[#FFD700] bg-amber-950/60 border-amber-400/60'
                                        : 'text-white bg-black/45 border-white/40'
                                    }`}
                                    title="Player Swap Countdown (50s midpoint countdown, resets on Manual Swap)"
                                  >
                                    Swap: {playerSwapRemainingSec}s{!playerSwitchValidityLatched ? ' [1F]' : ''}
                                  </span>
                                </span>
                              </div>
                              <div className="flex items-center justify-between gap-1 min-w-0 leading-tight">
                                <span className="text-sky-300 font-extrabold text-[7.5px] font-mono normal-case truncate min-w-0 flex-1">
                                  {abbrPoke3(userLeadName, false)} {userSlotHpPct[activeUserSlotIndex] ?? 100}% · {userFastInfo.telemetry}
                                </span>
                                {(() => {
                                  const activeUserE = userSlotEnergy[activeUserSlotIndex] ?? userEnergy;
                                  const cheapestUserCost = Math.min(
                                    ...(myMoveTimingInfo || []).map((r) => r.energy || 50),
                                    45
                                  );
                                  const userRdy = (myMoveTimingInfo || []).length > 0 && activeUserE >= cheapestUserCost;
                                  return (
                                    <span
                                      className={`text-[6.8px] font-mono font-black px-1 py-0.2 rounded border shrink-0 leading-none ${
                                        userRdy
                                          ? 'text-yellow-200 bg-amber-700/75 border-yellow-300/90 shadow-[0_0_4px_rgba(250,204,21,0.5)]'
                                          : 'text-sky-200 bg-sky-950/70 border-sky-400/50'
                                      }`}
                                      title={`Your Active Pokémon Energy: ${activeUserE}E`}
                                    >
                                      {activeUserE}E{userRdy ? ' READY' : ''}
                                    </span>
                                  );
                                })()}
                              </div>
                            </div>
                            <div className="grid grid-cols-3 w-[84px] text-center font-mono text-[7.5px] font-extrabold items-stretch">
                              {[0, 1, 2].map((oppIdx) => {
                                const oppName = scannedOpponents[oppIdx] || '';
                                const code = oppName
                                  ? abbrPoke3(oppName, false).toUpperCase().slice(0, 3)
                                  : '---';
                                const isActv = oppIdx === safeActiveOppSlot;
                                const isFainted = !isActv && !!oppFaintedSlots[oppIdx];
                                const oppHp = oppName ? (isFainted ? 0 : (oppSlotHpPct[oppIdx] ?? 100)) : null;
                                const hpColorCls = !oppName
                                  ? 'text-slate-600'
                                  : isFainted
                                  ? 'text-slate-500'
                                  : (oppHp ?? 100) > 50
                                  ? 'text-emerald-300'
                                  : (oppHp ?? 100) > 20
                                  ? 'text-amber-300'
                                  : 'text-rose-300';
                                return (
                                  <span
                                    key={oppIdx}
                                    onClick={() => oppName && handleSwapActiveOpponent(oppName)}
                                    className={`py-0.5 leading-[1.05] transition flex flex-col items-center justify-between ${oppName ? 'cursor-pointer' : ''} ${
                                      isFainted
                                        ? 'opacity-35 text-[#5A6577] line-through'
                                        : oppName && isActv
                                        ? 'bg-sky-500/25 text-sky-200 border-t border-x border-sky-400/80 rounded-t shadow-[0_0_6px_rgba(56,189,248,0.25)]'
                                        : 'text-slate-400'
                                    }`}
                                    title={isFainted ? `${oppName} (Fainted)` : oppName ? `${oppName} (${oppHp}% HP)` : 'Unscanned slot'}
                                  >
                                    <span>{code}</span>
                                    <span className={`text-[6.8px] font-mono ${hpColorCls}`}>{oppHp !== null ? `${oppHp}%` : '—'}</span>
                                  </span>
                                );
                              })}
                            </div>
                          </div>

                          {/* My Attack Rows (Turn-Aligned Proportional Bars + Multi-Cycle & Safe Throw Numbers) */}
                          <div className="flex flex-col gap-[2px]">
                            {(myMoveTimingInfo || []).map((row, rIdx, rowArr) => {
                              const isLastRow = rIdx === rowArr.length - 1;
                              const threatLevel =
                                row.dmgPct >= 60 || row.eff >= 1.5
                                  ? 'high'
                                  : row.dmgPct <= 35 || row.eff <= 0.65
                                  ? 'low'
                                  : 'mid';
                              const titleColor =
                                threatLevel === 'high'
                                  ? 'text-emerald-300'
                                  : threatLevel === 'low'
                                  ? 'text-red-300'
                                  : 'text-amber-300';

                              return (
                                <div
                                  key={row.name}
                                  className="bg-slate-950/55 border border-slate-400/20 rounded px-1 py-0.5 grid grid-cols-[44px_1fr_84px] items-center gap-1 tabular-nums"
                                >
                                  {/* Left: <=5 Char Move Name (Top) & Energy/Turns (Bottom) */}
                                  <div className="flex flex-col leading-tight min-w-0">
                                    <span className={`text-[8.5px] font-extrabold truncate ${titleColor}`} title={row.name}>
                                      {row.shortName}
                                    </span>
                                    <span className="text-[7.5px] text-slate-300 font-mono truncate">
                                      {row.energy}e/{row.myTapsNeeded}f
                                    </span>
                                  </div>

                                  {/* Center: Turn-Aligned Proportional Multi-Cycle Bar with Leak-Free Safe Throw Numbers */}
                                  <div className="flex items-center justify-start min-w-0 w-full bg-slate-900/45 rounded p-[1px]">
                                    <div className="flex items-center justify-start w-full">
                                      {(row.cycles || []).map((cycle) => (
                                        <div
                                          key={cycle.cycleIndex}
                                          style={{ width: `${cycle.widthPct}%` }}
                                          className="flex items-center gap-[1.5px] pr-[1.5px] last:pr-0 min-w-0 shrink-0"
                                        >
                                          {cycle.rangeLabel ? (
                                            <span
                                              className={`flex-1 min-w-0 text-center rounded px-1 py-0.5 text-[7px] font-extrabold truncate leading-none ${
                                                cycle.hasZeroSneak
                                                  ? 'bg-sky-600/35 border border-sky-400/70 text-sky-200'
                                                  : 'bg-slate-700/45 border border-slate-400/40 text-slate-300'
                                              }`}
                                              title={
                                                cycle.hasZeroSneak
                                                  ? `Leak-free (zero-sneak) throw taps: ${cycle.rangeLabel} (Turns ${cycle.startTurn + 1}–${cycle.readyTurn})`
                                                  : `Co-aligned charging taps (Turns ${cycle.startTurn + 1}–${cycle.readyTurn})`
                                              }
                                            >
                                              {cycle.rangeLabel}
                                            </span>
                                          ) : null}
                                          {cycle.readyState === 'cmp' ? (
                                            <span
                                              className="rounded px-1 py-0.5 text-[7px] font-extrabold whitespace-nowrap bg-green-600/55 border border-green-300 text-white leading-none shrink-0"
                                              title={`Throw #${cycle.cycleIndex} ready at Turn ${cycle.readyTurn} (${cycle.readyLabel} · CMP Win)`}
                                            >
                                              {cycle.readyLabel}
                                            </span>
                                          ) : cycle.readyState === 'cmp-loss' ? (
                                            <span
                                              className="rounded px-1 py-0.5 text-[7px] font-extrabold whitespace-nowrap bg-red-600/55 border border-red-300 text-white leading-none shrink-0"
                                              title={`Throw #${cycle.cycleIndex} ready at Turn ${cycle.readyTurn} (${cycle.readyLabel} · CMP Loss)`}
                                            >
                                              {cycle.readyLabel}
                                            </span>
                                          ) : (
                                            <span
                                              className="rounded px-1 py-0.5 text-[7px] font-extrabold whitespace-nowrap bg-sky-600/35 border border-sky-400/70 text-sky-200 leading-none shrink-0"
                                              title={`Throw #${cycle.cycleIndex} ready at Turn ${cycle.readyTurn} (${cycle.readyLabel})`}
                                            >
                                              {cycle.readyLabel}
                                            </span>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  </div>

                                  {/* Right: 3-Opponent Outgoing Damage % Columns with Vertical Active Highlight, Faint Dimming & KO Range Highlighting */}
                                  <div className="grid grid-cols-3 w-[84px] items-center text-center font-mono shrink-0">
                                    {(row.oppDamages || []).map((cell, cIdx) => {
                                      const isActv = cIdx === safeActiveOppSlot;
                                      const isFainted = !isActv && !!oppFaintedSlots[cIdx];
                                      const targetOppHp = isFainted ? 0 : (oppSlotHpPct[cIdx] ?? 100);
                                      const isKoRange = !isFainted && !cell.isEmpty && cell.dmgPct >= targetOppHp;
                                      const textCls = isFainted
                                        ? 'text-[#5A6577] opacity-35'
                                        : cell.isEmpty
                                        ? 'text-slate-500'
                                        : isKoRange
                                        ? 'text-emerald-200 font-black'
                                        : cell.tier === 'resist'
                                        ? 'text-emerald-300'
                                        : cell.tier === 'weak'
                                        ? 'text-red-300'
                                        : 'text-amber-200';
                                      return (
                                        <div
                                          key={cIdx}
                                          className={`py-0.5 text-[7.5px] font-extrabold leading-tight ${textCls} ${
                                            isFainted
                                              ? 'bg-slate-950/40 opacity-35'
                                              : isKoRange
                                              ? 'bg-emerald-600/35 border border-emerald-400/80 rounded-xs shadow-[0_0_6px_rgba(16,185,129,0.3)]'
                                              : isActv
                                              ? `bg-sky-500/25 border-x border-sky-400/80 shadow-[inset_0_0_6px_rgba(56,189,248,0.25)] ${
                                                  isLastRow ? 'border-b rounded-b' : ''
                                                }`
                                              : 'bg-slate-900/40'
                                          }`}
                                          title={
                                            isFainted
                                              ? `${cell.name} (Fainted)`
                                              : cell.isEmpty
                                              ? 'Unscanned opponent slot'
                                              : `${cell.name} (${targetOppHp}% HP): ${cell.dmgPct}%${isKoRange ? ' — IN KO RANGE!' : ''}`
                                          }
                                        >
                                          {cell.isEmpty ? '—' : isKoRange ? `KO ${cell.dmgPct}%` : `${cell.dmgPct}%`}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* v6.00 Bottom Placement (New Default): 4-Pillar Condensed 2-Line AI Tactical Coach */}
                      {showTacticalRec && activeTacticalRec && aiAdviceHudPosition === 'bottom' && (() => {
                        const oppFastGain = resolveFastMove(activeOpponent)?.energyGain || activeOpponent.defaultFastMove?.energyGain || 8;
                        const cheapestOppCost = Math.min(
                          ...activeOpponent.chargedMoves.map((m) => resolveChargedMove(m.name, activeOpponent.types[0]).energyCost || m.energyCost || 40),
                          45
                        );
                        const curOppE = oppSlotEnergy[safeActiveOppSlot] ?? oppEnergy;
                        const oppFastsToMove = Math.max(0, Math.ceil((cheapestOppCost - curOppE) / Math.max(1, oppFastGain)));
                        const myFastDmg = Math.max(1, Math.round(userFastInfo.percentage || 4));
                        const curOppHp = oppSlotHpPct[safeActiveOppSlot] ?? 100;
                        const fastsToKoOpp = Math.max(1, Math.ceil(curOppHp / myFastDmg));
                        const canFarmDown = fastsToKoOpp <= oppFastsToMove && curOppHp <= 32;
                        const myShortMove = abbrMove5(myMoveTimingInfo?.[0]?.name || 'Move');
                        const oppShortMove = abbrMove5(activeOppChargedMoveBounds.minMoveName || 'Move');
                        const timingState =
                          isAttackIncomingPrompt
                            ? 'SHIELD_CALL'
                            : canFarmDown
                            ? 'FARM_DOWN_SAFE'
                            : oppFastsToMove === 0
                            ? 'IMMEDIATE_0_FAST'
                            : oppFastsToMove >= 1 && oppFastsToMove <= hapticChargeTimingFasts
                            ? 'BLINK_1_FAST'
                            : oppFastsToMove === 2
                            ? 'WARN_2_FASTS'
                            : 'NORMAL';
                        const line1Text =
                          timingState === 'FARM_DOWN_SAFE'
                            ? `FARM DOWN: ${fastsToKoOpp}F TO KO (Pre-${oppShortMove})`
                            : timingState === 'IMMEDIATE_0_FAST'
                            ? `🛑 0F LEFT -> THROW ${myShortMove} NOW!`
                            : timingState === 'BLINK_1_FAST'
                            ? oppFastsToMove === 1
                              ? `🚨 1 LAST FAST -> THROW ${myShortMove} NOW!`
                              : `🚨 ${oppFastsToMove}F -> THROW ${myShortMove} (Pre-${oppShortMove})!`
                            : timingState === 'WARN_2_FASTS'
                            ? `⚠️ 2F -> THROW ${myShortMove} (Pre-${oppShortMove})`
                            : `${activeTacticalRec.actionLabel || activeTacticalRec.actionText} [${activeTacticalRec.shieldPlan}] · ${(activeTacticalRec.goalText || '').slice(0, 22)}`;
                        const s6PairsBot =
                          show6LiveBacklinePrediction?.mostLikelyPairs ||
                          show6LiveBacklinePrediction?.predictions ||
                          [];
                        const backlineLine2 =
                          appCombatMode === 'show6' && show6LiveBacklinePrediction
                            ? s6PairsBot.length > 0
                              ? `🔮 S6: ${s6PairsBot.slice(0, 2).map((p) => `${(p.backlineNames || []).map((n) => abbrPoke3(n)).join('+')} ${p.probabilityPct}%`).join(' · ')}`
                              : `🔮 S6: ${show6LiveBacklinePrediction.tacticalSummary.slice(0, 42)}`
                            : scannedOpponents.length <= 2
                            ? `🔮 Back: HO-OH 64% · PAL-O 52% | Rsk:MED`
                            : `🔮 All 3 Opponents Revealed`;
                        return (
                          <div
                            className={`flex flex-col gap-0.5 px-1.5 py-1 rounded border mt-1 font-mono text-[7.1px] leading-tight transition-all ${
                              timingState === 'IMMEDIATE_0_FAST'
                                ? 'bg-red-950/90 border-red-400 text-white animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.65)]'
                                : timingState === 'BLINK_1_FAST'
                                ? 'bg-rose-950/90 border-amber-300 text-amber-100 animate-pulse shadow-[0_0_8px_rgba(251,191,36,0.55)]'
                                : timingState === 'WARN_2_FASTS'
                                ? 'bg-amber-950/90 border-amber-400 text-amber-100'
                                : activeTacticalRec.urgencyColor === 'emerald' || timingState === 'FARM_DOWN_SAFE'
                                ? 'bg-emerald-950/80 border-emerald-400/60 text-emerald-200'
                                : activeTacticalRec.urgencyColor === 'sky'
                                ? 'bg-sky-950/80 border-sky-400/60 text-sky-200'
                                : activeTacticalRec.urgencyColor === 'rose'
                                ? 'bg-rose-950/80 border-rose-400/60 text-rose-200'
                                : 'bg-amber-950/80 border-amber-400/60 text-amber-200'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-1 min-w-0">
                              <span className="font-extrabold truncate">{line1Text}</span>
                              {isAttackIncomingPrompt && userShields > 0 && (
                                <div className="flex items-center gap-0.5 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => handleResolveOppChargedAttack(true, 0)}
                                    className="px-1 py-0.2 rounded bg-pink-500/40 text-pink-100 font-extrabold text-[6.5px] border border-pink-300/60"
                                  >
                                    🛡️1S
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleResolveOppChargedAttack(false, 0)}
                                    className="px-1 py-0.2 rounded bg-sky-500/35 text-sky-100 font-extrabold text-[6.5px] border border-sky-300/60"
                                  >
                                    0S
                                  </button>
                                </div>
                              )}
                            </div>
                            <div className="text-[6.8px] text-cyan-200/95 font-bold truncate border-t border-white/10 pt-0.5">
                              {backlineLine2}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {/* Switch Pokémon Bench Icons */}
                  <div className="absolute right-3 bottom-24 flex flex-col gap-2">
                    <button className="w-11 h-11 rounded-full bg-slate-900/80 border border-slate-700 shadow-lg flex flex-col items-center justify-center p-0.5 active:scale-95">
                      <span className="text-xs">🕊️</span>
                      <span className="text-[7.5px] font-bold text-slate-300">CP 4179</span>
                    </button>
                    <button className="w-11 h-11 rounded-full bg-slate-900/80 border border-slate-700 shadow-lg flex flex-col items-center justify-center p-0.5 active:scale-95">
                      <span className="text-xs">🐋</span>
                      <span className="text-[7.5px] font-bold text-slate-300">CP 4652</span>
                    </button>
                  </div>

                </div>

                {/* Bottom Charge Attack Circles & Tap Controls */}
                <div className="relative z-10 px-4 pb-5 pt-2 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent flex items-center justify-center gap-4">
                  {/* Charge Move 1 */}
                  <div className="relative flex flex-col items-center">
                    <button 
                      onClick={() => handleThrowMyChargedAttack(0, false)}
                      className="w-16 h-16 rounded-full bg-gradient-to-tr from-amber-600 to-amber-400 border-2 border-amber-300 shadow-lg shadow-amber-500/30 flex items-center justify-center active:scale-90 transition transform"
                      title={`Throw ${userActivePokemon.chargedMoves[0]?.name || 'Charge Move 1'} (applies damage to active opponent HP% & logs CHARGED_ATTACK)`}
                    >
                      <Zap className="w-7 h-7 text-white fill-white" />
                    </button>
                    <span className="text-[9px] font-bold text-amber-200 mt-1 uppercase">
                      {userActivePokemon.chargedMoves[0]?.name.split(' ')[0] || 'MOVE 1'}
                    </span>
                  </div>

                  {/* Charge Move 2 */}
                  {userActivePokemon.chargedMoves[1] && (
                    <div className="relative flex flex-col items-center">
                      <button 
                        onClick={() => handleThrowMyChargedAttack(1, false)}
                        className="w-16 h-16 rounded-full bg-gradient-to-tr from-sky-600 to-sky-400 border-2 border-sky-300 shadow-lg shadow-sky-500/30 flex items-center justify-center active:scale-90 transition transform"
                        title={`Throw ${userActivePokemon.chargedMoves[1]?.name || 'Charge Move 2'} (applies damage to active opponent HP% & logs CHARGED_ATTACK)`}
                      >
                        <Shield className="w-7 h-7 text-white" />
                      </button>
                      <span className="text-[9px] font-bold text-sky-200 mt-1 uppercase">
                        {userActivePokemon.chargedMoves[1]?.name.split(' ')[0]}
                      </span>
                    </div>
                  )}
                </div>

              </div>
            </div>

            {/* Right: Live Battle Simulation Controller & Presets Quick Switcher */}
            <div className="lg:col-span-5 flex flex-col gap-5">
              
              {/* Battle Simulation Controls Card */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-sm text-white flex items-center gap-2">
                    <Play className="w-4 h-4 text-sky-400" />
                    <span>Live Battle Tap & Turn Simulator</span>
                  </h3>
                  <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                    Turn Count: <strong>{userTurnsElapsed}</strong>
                  </span>
                </div>

                <p className="text-xs text-slate-400 mb-4">
                  Tap the button below to simulate Fast Attacks in real-time. Watch how the overlay highlights when you reach the exact zero-sneak window!
                </p>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <button
                    onClick={handleFastAttack}
                    className="col-span-2 py-3 px-4 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 active:scale-[0.98] font-bold text-sm text-white shadow-lg shadow-sky-500/25 flex items-center justify-center gap-2 transition"
                  >
                    <Zap className="w-4 h-4" />
                    <span>Tap Fast Attack ({userActivePokemon.defaultFastMove?.name || 'Fast'})</span>
                  </button>

                  <button
                    onClick={() => setUserShields(prev => (prev > 0 ? prev - 1 : 2))}
                    className="py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-300 flex items-center justify-center gap-1.5"
                  >
                    <Shield className="w-3.5 h-3.5 text-purple-400" />
                    <span>Your Shields: {userShields}</span>
                  </button>

                  <button
                    onClick={() => setOppShields(prev => (prev > 0 ? prev - 1 : 2))}
                    className="py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-300 flex items-center justify-center gap-1.5"
                  >
                    <Shield className="w-3.5 h-3.5 text-red-400" />
                    <span>Opp Shields: {oppShields}</span>
                  </button>
                </div>

                {/* v3.34: Post-Faint Prompt, Counter-Swap Minimax & 1st-Frame / 2nd-Frame Validity Simulator */}
                <div className="mb-3 p-3 rounded-xl bg-slate-950/75 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-200">
                      v3.34 Swap Clock, Faint &amp; 2-Frame Validity Simulator
                    </span>
                    <span className="text-[10px] font-mono text-emerald-400">
                      Midpoint Clock + Minimax
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 text-[11px] font-bold">
                    <button
                      type="button"
                      onClick={handleSimulatePlayerFaint}
                      className="py-1.5 px-2 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-200 transition"
                      title="Simulate your active Pokémon fainting to trigger the 'Switch in a new Pokémon?' multi-factor recommendation"
                    >
                      💀 My Mon Faints (Prompt)
                    </button>
                    <button
                      type="button"
                      onClick={handleSimulateOpponentFaint}
                      className="py-1.5 px-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 transition"
                      title="Simulate opponent faint replacement (Opp Swap Clock does NOT reset — triggers Counter-Swap Minimax)"
                    >
                      💀 Opp Faints (No Clock Reset)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSimulateOpponentSwap(true)}
                      className="py-1.5 px-2 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-200 transition"
                      title="Simulate Frame 1 OCR Opponent Swap (updates HUD immediately with [1F] validity bit & midpoint swap clock)"
                    >
                      ⚡ Opp Swap (Frame 1 [1F])
                    </button>
                    {!oppSwitchValidityLatched ? (
                      <div className="grid grid-cols-2 gap-1">
                        <button
                          type="button"
                          onClick={() => handleLatchOrRevertProvisionalOppSwap(true)}
                          className="py-1.5 px-1.5 rounded-lg bg-emerald-500/25 hover:bg-emerald-500/35 border border-emerald-400/60 text-emerald-200 text-[10px] transition"
                        >
                          ✓ Latch F2
                        </button>
                        <button
                          type="button"
                          onClick={() => handleLatchOrRevertProvisionalOppSwap(false)}
                          className="py-1.5 px-1.5 rounded-lg bg-red-500/25 hover:bg-red-500/35 border border-red-400/60 text-red-200 text-[10px] transition"
                        >
                          ↩ Revert F2
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={handleResetTimersAndBalls}
                        className="py-1.5 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 transition"
                      >
                        🔄 Reset Clocks &amp; Balls
                      </button>
                    )}
                  </div>
                </div>

                {/* App Setting (Not on Overlay): Opponent Fast Move Count Basis */}
                <div className="mb-3 p-3 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-200">
                      Opponent Move Count Basis
                    </span>
                    <span className="text-[10px] font-mono text-sky-400">
                      App Setting · Turn-Aligned
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-900 rounded-lg border border-slate-800">
                    <button
                      onClick={() => handleSetOppCountMode('my_fasts')}
                      className={`py-1.5 px-2 rounded-md text-xs font-bold transition ${
                        oppCountMode === 'my_fasts'
                          ? 'bg-sky-500/25 border border-sky-400/70 text-sky-200 shadow-sm'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      My Fast Moves (Default)
                    </button>
                    <button
                      onClick={() => handleSetOppCountMode('opp_fasts')}
                      className={`py-1.5 px-2 rounded-md text-xs font-bold transition ${
                        oppCountMode === 'opp_fasts'
                          ? 'bg-sky-500/25 border border-sky-400/70 text-sky-200 shadow-sm'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Opponent Fast Moves
                    </button>
                  </div>
                </div>

                {/* App Setting: Opponent Charged Moves Shown in Overlay (3 vs 4 Charged Moves) */}
                <div className="mb-3 p-3 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-200">
                      Opponent Charged Moves in Overlay
                    </span>
                    <span className="text-[10px] font-mono text-sky-400">
                      {enable4ChargedMoves ? 'Official + Top 2 Usage' : 'Official + Top Usage'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-900 rounded-lg border border-slate-800">
                    <button
                      onClick={() => handleSetEnable4ChargedMoves(false)}
                      className={`py-1.5 px-2 rounded-md text-xs font-bold transition ${
                        !enable4ChargedMoves
                          ? 'bg-sky-500/25 border border-sky-400/70 text-sky-200 shadow-sm'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      3 Charged Moves (Default)
                    </button>
                    <button
                      onClick={() => handleSetEnable4ChargedMoves(true)}
                      className={`py-1.5 px-2 rounded-md text-xs font-bold transition ${
                        enable4ChargedMoves
                          ? 'bg-sky-500/25 border border-sky-400/70 text-sky-200 shadow-sm'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      4 Charged Moves
                    </button>
                  </div>
                </div>

                {/* Live PvPoke GameMaster & Selected League Rankings Status Card */}
                <div className="mb-4 p-3 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <span className="text-xs font-bold text-slate-200 block">
                        PvPoke Live Database &amp; Selected League Status ({dbTelemetry.selectedLeagues.length} Leagues)
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        Last Updated: <strong className="text-emerald-400">{lastSyncedAt}</strong>
                      </span>
                    </div>
                    <button
                      onClick={handleManualPvPokeSync}
                      disabled={isSyncingPvPoke}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-sky-300 text-[11px] font-bold flex items-center gap-1 transition shrink-0"
                    >
                      <RefreshCw className={`w-3 h-3 ${isSyncingPvPoke ? 'animate-spin' : ''}`} />
                      <span>{isSyncingPvPoke ? 'Syncing...' : 'Sync PvPoke'}</span>
                    </button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-center text-[10px] font-mono">
                    <div className="p-1.5 rounded bg-slate-900 border border-slate-800">
                      <span className="text-slate-400 block text-[9px]">GameMaster</span>
                      <strong className="text-white">{dbTelemetry.gmCount}</strong>
                    </div>
                    {dbTelemetry.selectedLeagues.map((lg) => (
                      <div key={lg.key} className="p-1.5 rounded bg-slate-900 border border-slate-800">
                        <span className="text-sky-400 block text-[9px] truncate" title={lg.key}>
                          {lg.shortLabel}
                        </span>
                        <strong className="text-white">{lg.count}</strong>
                      </div>
                    ))}
                  </div>
                </div>

                {/* App Setting (Not on Overlay): Overlay Screen Width Scale (50% - 100%, Default 78%) */}
                <div className="mb-4 p-3 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-200">
                      Overlay Size (% of Screen Width)
                    </span>
                    <button
                      onClick={() => handleSetOverlayScalePct(78)}
                      className="text-xs font-mono font-bold text-sky-400 hover:text-sky-300 transition"
                      title="Click to reset to 78% Default"
                    >
                      {overlayScalePct === 78 ? '78% (Default)' : `${overlayScalePct}%`}
                    </button>
                  </div>

                  <input
                    type="range"
                    min={50}
                    max={100}
                    step={2}
                    value={overlayScalePct}
                    onChange={(e) => handleSetOverlayScalePct(Number(e.target.value))}
                    className="w-full accent-sky-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                  />

                  {/* Scale Bounds & 78% Default Tick Mark (56% along 50-100 range) */}
                  <div className="relative h-4 text-[10px] font-mono text-slate-400">
                    <span className="absolute left-0">50%</span>
                    <button
                      type="button"
                      onClick={() => handleSetOverlayScalePct(78)}
                      style={{ left: '56%', transform: 'translateX(-50%)' }}
                      className="absolute text-sky-400 hover:text-sky-300 font-bold transition"
                      title="Reset to 78% Default"
                    >
                      ▲ 78% Default
                    </button>
                    <span className="absolute right-0">100%</span>
                  </div>
                </div>

                {/* App Setting: Overlay Background Transparency (0% - 100%, Default 50%) */}
                <div className="mb-4 p-3 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-slate-200 block">
                        Overlay Background Transparency
                      </span>
                      <span className="text-[10px] text-slate-400">
                        Adjusts background panel only — text &amp; move bars stay 100% readable
                      </span>
                    </div>
                    <button
                      onClick={() => handleSetOverlayTransparencyPct(50)}
                      className="text-xs font-mono font-bold text-sky-400 hover:text-sky-300 transition shrink-0"
                      title="Click to reset to 50% Default"
                    >
                      {overlayTransparencyPct === 50 ? '50% (Default)' : `${overlayTransparencyPct}%`}
                    </button>
                  </div>

                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={2}
                    value={overlayTransparencyPct}
                    onChange={(e) => handleSetOverlayTransparencyPct(Number(e.target.value))}
                    className="w-full accent-sky-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                  />

                  {/* Transparency Bounds & 50% Default Tick Mark */}
                  <div className="relative h-4 text-[10px] font-mono text-slate-400">
                    <span className="absolute left-0">0% (Solid)</span>
                    <button
                      type="button"
                      onClick={() => handleSetOverlayTransparencyPct(50)}
                      style={{ left: '50%', transform: 'translateX(-50%)' }}
                      className="absolute text-sky-400 hover:text-sky-300 font-bold transition"
                      title="Reset to 50% Default"
                    >
                      ▲ 50% Default
                    </button>
                    <span className="absolute right-0">100% (Clear)</span>
                  </div>
                </div>

                {/* Swap In Opponent Pokémon (PvPoke Top 10 Meta & OCR Switch Simulator) */}
                <div className="pt-4 border-t border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Swords className="w-4 h-4 text-amber-400" />
                      <div>
                        <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                          Swap In Opponent (PvPoke Top 10)
                        </h4>
                        <p className="text-[10px] text-slate-400">
                          Simulate in-battle swaps or OCR detection to test battle matrix & move timing updates.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* League Switcher Tabs */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px] scrollbar-none">
                    <button
                      onClick={() => setSelectedOpponentLeague('AUTO')}
                      className={`px-2.5 py-1 rounded-lg font-bold border transition shrink-0 ${
                        selectedOpponentLeague === 'AUTO'
                          ? 'bg-sky-500/20 border-sky-400 text-sky-200 shadow-[0_0_8px_rgba(56,189,248,0.25)]'
                          : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Auto ({activePreset.league.includes('Spectral') ? 'Spectral' : activePreset.league.includes('Cauldron') ? 'Cauldron' : activePreset.league.includes('Battle Frontier') ? 'BF Master' : activePreset.league.split(' ')[0]})
                    </button>
                    {(appCombatMode === 'show6' ? enabledShow6Leagues : enabledGblLeagues).map((lg) => (
                      <button
                        key={lg}
                        onClick={() => setSelectedOpponentLeague(lg)}
                        className={`px-2.5 py-1 rounded-lg font-bold border transition shrink-0 ${
                          selectedOpponentLeague === lg
                            ? 'bg-sky-500/20 border-sky-400 text-sky-200 shadow-[0_0_8px_rgba(56,189,248,0.25)]'
                            : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {lg === 'Battle Frontier (Spectral)'
                          ? 'BF Spectral'
                          : lg === 'Battle Frontier (Cauldron)'
                          ? 'BF Cauldron'
                          : lg === 'Battle Frontier (Master)'
                          ? 'BF Master'
                          : lg === 'MEGA MASTER LEAGUE'
                          ? 'MEGA ML'
                          : lg.replace(/\s*\(\d+\)\s*$/, '')}
                      </button>
                    ))}
                  </div>

                  {/* Quick Action Simulation Buttons */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleStartBattle}
                      className="flex-1 py-1.5 px-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-200 text-xs font-bold flex items-center justify-center gap-1.5 transition active:scale-[0.98]"
                      title="Reset opponent team to test 1 Hz OCR scanning standby"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Reset Opp (Test 1 Hz OCR)</span>
                    </button>
                    <button
                      onClick={handleSwapNextBenchOpponent}
                      disabled={scannedOpponents.length <= 1}
                      className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition active:scale-[0.98] ${
                        scannedOpponents.length > 1
                          ? 'bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200'
                          : 'bg-slate-800/40 border border-slate-700/40 text-slate-500 opacity-50 cursor-not-allowed'
                      }`}
                      title={scannedOpponents.length > 1 ? `Swap to bench: ${scannedOpponents[1]}` : 'Need >=2 scanned opponents to rotate'}
                    >
                      <Swords className="w-3.5 h-3.5" />
                      <span>Swap Bench Opponent</span>
                    </button>
                  </div>

                  {/* Top 10 PvPoke Opponents Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[310px] overflow-y-auto pr-1">
                    {currentTopOpponents.map((mon) => {
                      const isActiveLead = !isWaitingOpponent && scannedOpponents[0] === mon.name;
                      const benchIdx = !isWaitingOpponent ? scannedOpponents.indexOf(mon.name) : -1;
                      const isBench = benchIdx > 0;

                      return (
                        <button
                          key={mon.name}
                          onClick={() => handleSwapActiveOpponent(mon.name)}
                          className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between gap-1.5 relative group ${
                            isActiveLead
                              ? 'bg-sky-500/20 border-sky-400 shadow-[0_0_12px_rgba(56,189,248,0.25)] ring-1 ring-sky-400/50'
                              : isBench
                              ? 'bg-amber-500/15 border-amber-400/50 hover:bg-amber-500/25'
                              : 'bg-slate-950/60 border-slate-800/90 hover:border-slate-700 hover:bg-slate-900/80'
                          }`}
                        >
                          <div className="flex items-center justify-between w-full gap-1">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-slate-800 text-amber-400 font-mono">
                                #{mon.rank}
                              </span>
                              <span className="font-bold text-xs text-white truncate">
                                {mon.name}
                              </span>
                            </div>
                            {isActiveLead ? (
                              <span className="text-[9px] font-extrabold bg-sky-400 text-slate-950 px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0 animate-pulse">
                                Active Lead
                              </span>
                            ) : isBench ? (
                              <span className="text-[9px] font-bold bg-amber-400/30 text-amber-200 border border-amber-400/50 px-1.5 py-0.5 rounded shrink-0">
                                Bench #{benchIdx + 1}
                              </span>
                            ) : (
                              <span className="text-[9px] font-semibold text-slate-400 group-hover:text-sky-300 transition shrink-0">
                                Swap In ▾
                              </span>
                            )}
                          </div>

                          <div className="flex items-center justify-between text-[10px] text-slate-300 w-full pt-1 border-t border-white/5">
                            <span className="font-semibold text-amber-300">
                              ⚡ {mon.fastTurns}t {mon.fastMove}
                            </span>
                            <span className="text-slate-400 truncate max-w-[125px] font-mono text-[9px]">
                              {mon.chargedMoves.join(' + ')}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Show 6 Live Overlay AI: Known Opponent 6 Backline Predictor & Swap Picker (Strictly Constrained to Known Opponent 6) */}
              {appCombatMode === 'show6' && show6LiveBacklinePrediction && (
                <div className="bg-slate-900 border border-amber-500/50 rounded-2xl p-5 shadow-xl space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {renderBattleFrontierLogo(20)}
                      <div>
                        <h3 className="font-extrabold text-sm text-amber-300">
                          Show 6 AI • Known Opponent 6 Backline Predictor
                        </h3>
                        <p className="text-[10.5px] text-slate-400">
                          AI predictions &amp; tactical swap/shield callouts are strictly constrained to the unrevealed Pokémon in Opponent&apos;s Known 6.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab('presets')}
                      className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/50 text-amber-200 text-[10.5px] font-bold shrink-0"
                    >
                      Edit Opp 6 →
                    </button>
                  </div>

                  {/* Known Opponent 6 Quick Swap-In Strip */}
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                      Opponent&apos;s Known 6 Roster (Tap to Swap In / Reveal in Battle)
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                      {show6LiveBacklinePrediction.knownOpponent6.map((monName, idx) => {
                        const isRevealed =
                          !isWaitingOpponent &&
                          scannedOpponents.some((s) => s.toLowerCase() === monName.toLowerCase());
                        const isActiveNow =
                          !isWaitingOpponent && activeOpponentName.toLowerCase() === monName.toLowerCase();
                        return (
                          <button
                            key={`${monName}-${idx}`}
                            type="button"
                            onClick={() => handleSwapActiveOpponent(monName)}
                            className={`px-2.5 py-1.5 rounded-xl border text-left text-xs font-bold transition flex items-center justify-between gap-1 ${
                              isActiveNow
                                ? 'bg-sky-500/25 border-sky-400 text-sky-200 shadow-sm'
                                : isRevealed
                                ? 'bg-emerald-500/20 border-emerald-400/60 text-emerald-200'
                                : 'bg-slate-950/80 border-slate-800 text-slate-300 hover:border-amber-400/60 hover:text-amber-200'
                            }`}
                          >
                            <span className="truncate">
                              #{idx + 1} {monName}
                            </span>
                            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-900 shrink-0">
                              {isActiveNow ? 'ACTIVE' : isRevealed ? 'SEEN' : 'UNSEEN'}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* AI Unrevealed Backline Pair Predictions */}
                  <div className="p-3 rounded-xl bg-slate-950/90 border border-amber-500/30 space-y-2">
                    <div className="text-[11px] font-bold text-amber-200">
                      {show6LiveBacklinePrediction.tacticalSummary}
                    </div>
                    {show6LiveBacklinePrediction.mostLikelyPairs.length > 0 && (
                      <div className="space-y-1.5 pt-1">
                        {show6LiveBacklinePrediction.mostLikelyPairs.slice(0, 3).map((pair, pIdx) => (
                          <div
                            key={`${pair.backlineNames.join('-')}-${pIdx}`}
                            className="p-2 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between gap-2 text-[11px]"
                          >
                            <div>
                              <span className="font-extrabold text-white">
                                #{pIdx + 1} Predicted Backline: {pair.backlineNames.join(' + ')}
                              </span>
                              <span className="block text-[10px] text-slate-400">{pair.rationale}</span>
                            </div>
                            <span className="px-2 py-0.5 rounded-md bg-amber-500/20 border border-amber-400/50 text-amber-300 font-mono font-extrabold text-xs shrink-0">
                              {pair.probabilityPct}%
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Active Team Preset Summary Card */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-emerald-400" />
                    <h3 className="font-bold text-sm text-white">
                      {appCombatMode === 'show6' ? 'Active Show 6 Overlay Trio (Team of 3)' : 'Active Team Preset'}
                    </h3>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    {activePreset.league}
                  </span>
                </div>

                <div className="text-xs font-semibold text-slate-200 mb-3">
                  {activePreset.name}
                </div>

                <div className="space-y-2">
                  {activePreset.pokemon.map((poke, index) => (
                    <div
                      key={poke.id || index}
                      className="flex items-center justify-between p-2 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center font-bold text-[10px] text-slate-400">
                          {index + 1}
                        </span>
                        <div>
                          <span className="font-bold text-slate-200">{poke.name}</span>
                          <span className="text-[10px] text-slate-400 ml-1.5 font-mono">CP {poke.cp}</span>
                        </div>
                      </div>
                      <div className="text-[11px] text-slate-400 text-right">
                        <span>{poke.fastMove}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800 flex justify-between items-center text-xs">
                  <span className="text-slate-400">Want to add more teams?</span>
                  <button
                    onClick={() => setActiveTab('presets')}
                    className="text-sky-400 hover:text-sky-300 font-semibold flex items-center gap-1"
                  >
                    <span>Manage Presets</span>
                    <span>→</span>
                  </button>
                </div>
              </div>

              {/* Real-time Math Breakdown Card */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl text-xs space-y-3">
                <h4 className="font-bold text-slate-200 flex items-center gap-1.5">
                  <Info className="w-4 h-4 text-sky-400" />
                  <span>Calculated Overlay Values</span>
                </h4>
                <div className="grid grid-cols-2 gap-2 text-slate-300">
                  <div className="p-2 rounded bg-slate-950/60 border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">Fast Move Alignment</span>
                    <strong className="text-white text-xs">{userFastTurns}t vs {oppFastTurns}t</strong>
                  </div>
                  <div className="p-2 rounded bg-slate-950/60 border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">Optimal Zero-Sneak Throws</span>
                    <strong className="text-emerald-400 text-xs">{turnAlignInfo.optimalThrowText}</strong>
                  </div>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  {turnAlignInfo.explanation}
                </p>
              </div>

            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 2: CUSTOM GBL TEAM PRESETS & SHOW 6 TEAMS / DUAL BUILDERS HUB
           ========================================================================= */}
        {activeTab === 'presets' && (
          <div className="space-y-6">
            {/* =====================================================================
                SHOW 6 MODE HUB: SAVED TEAMS OF 6 + DUAL SHOW 6 TEAM BUILDERS
               ===================================================================== */}
            {appCombatMode === 'show6' && (
              <div className="space-y-6">
                {/* Section A: Saved My Show 6 Rosters & Saved Opponent Show 6 Rosters (Teams of 6) */}
                <div className="bg-slate-900 border border-amber-500/40 rounded-2xl p-6 shadow-2xl space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
                    <div className="flex items-center gap-3">
                      {renderBattleFrontierLogo(28)}
                      <div>
                        <h2 className="text-lg font-extrabold text-white flex items-center gap-2 flex-wrap">
                          <span>Saved My Show 6 Rosters (Teams of 6)</span>
                          <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/50 text-amber-300 text-[10px] font-bold">
                            {show6Rosters6.length} My Rosters
                          </span>
                        </h2>
                        <p className="text-xs text-slate-400">
                          Load any saved Team of 6 into the 6v6 Pick-3 Optimizer, or click <strong>✎ Edit / Suggest</strong> to optimize individual slots with alternate Pokémon &amp; moveset recommendations!
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => setShowTeamsTrashModal(true)}
                        className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-amber-300 font-bold text-xs flex items-center gap-1.5 transition"
                        title="Open Show 6 Trash Bin (Separate from Standard GBL Trash)"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Show 6 Trash ({deletedTeamsTrash.length + show6DeletedRostersTrash.length})</span>
                      </button>
                      <input
                        type="text"
                        value={show6NewRosterName}
                        onChange={(e) => setShow6NewRosterName(e.target.value)}
                        placeholder="My Roster Name (e.g. GL Show 6 Core)"
                        className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveMy6AsRosterPreset()}
                        className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs shadow-lg transition shrink-0"
                      >
                        💾 Save My 6
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {show6Rosters6.map((roster) => {
                      const isSel = roster.id === selectedShow6Roster6Id;
                      return (
                        <div
                          key={roster.id}
                          className={`p-4 rounded-xl border transition flex flex-col justify-between gap-3 ${
                            isSel
                              ? 'bg-amber-500/10 border-amber-400/70 shadow-lg'
                              : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <span className="font-extrabold text-sm text-white block">{roster.name}</span>
                              <span className="text-[10px] font-mono text-amber-300">{roster.league}</span>
                            </div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedShow6Roster6Id(roster.id);
                                  const names = roster.pokemon.map((p) => p.name);
                                  setShow6Pick3League(roster.league);
                                  setShow6My6(names);
                                  handleRunShow6Pick3Optimizer(roster.league, names, show6Opponent6);
                                }}
                                className="px-2.5 py-1 rounded-lg bg-sky-500/25 hover:bg-sky-500/40 border border-sky-400/60 text-sky-200 text-[11px] font-bold transition"
                              >
                                ⚡ Load 6
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSwapShow6RosterSide(roster, 'MY')}
                                className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/35 border border-amber-400/50 text-amber-200 text-[11px] font-bold transition"
                                title="Swap / Copy this My Show 6 Team to Opponent Show 6 Teams & load into Simulator"
                              >
                                ⇄ Swap My/Opp
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setShow6ModalCloneTargetLeague(roster.league);
                                  openShow6RosterEditor(roster, 'MY');
                                }}
                                className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/35 border border-emerald-400/50 text-emerald-200 text-[11px] font-bold transition"
                                title="Edit Pick-6 Team, Suggest Upgrades, or Clone / Cross-Mode Copy inside the Editor"
                              >
                                ✎ Edit / Clone
                              </button>
                              {show6Rosters6.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteShow6Roster6(roster, 'MY')}
                                  className="px-2 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/35 border border-rose-400/40 text-rose-200 text-[11px] font-bold"
                                  title="Delete My Roster of 6"
                                >
                                  🗑️
                                </button>
                              )}
                            </div>
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                            {roster.pokemon.slice(0, 6).map((m, idx) => (
                              <div
                                key={`${roster.id}-${idx}`}
                                className="px-2 py-1 rounded-lg bg-slate-900 border border-slate-800 text-[11px]"
                              >
                                <span className="font-bold text-white block truncate">
                                  #{idx + 1} {m.name}
                                </span>
                                <span className="text-[9.5px] text-slate-400 font-mono block truncate">
                                  {m.fastMove} • {m.chargedMove1}/{m.chargedMove2}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Saved Opponent Show 6 Rosters (Teams of 6) */}
                  <div className="pt-4 border-t border-slate-800 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                          <span>⚔️ Saved Opponent Show 6 Rosters (Teams of 6)</span>
                          <span className="px-2 py-0.5 rounded-full bg-rose-500/20 border border-rose-400/50 text-rose-300 text-[10px] font-bold">
                            {show6OpponentRosters6.length} Opponent Rosters
                          </span>
                        </h3>
                        <p className="text-xs text-slate-400">
                          Store tournament opponents&apos; Pick-6 teams to quickly load into the 6v6 Pick-3 Simulator and constrain Live Overlay AI backline predictions!
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <input
                          type="text"
                          value={show6NewOppRosterName}
                          onChange={(e) => setShow6NewOppRosterName(e.target.value)}
                          placeholder="Opponent Name / Scouting Tag..."
                          className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveOpp6AsRosterPreset()}
                          className="px-3.5 py-2 rounded-xl bg-rose-500 hover:bg-rose-400 text-slate-950 font-extrabold text-xs shadow-lg transition shrink-0"
                        >
                          💾 Save Opp 6
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {show6OpponentRosters6.map((oppRoster) => {
                        const isSelOpp = oppRoster.id === selectedShow6OppRoster6Id;
                        return (
                          <div
                            key={oppRoster.id}
                            className={`p-4 rounded-xl border transition flex flex-col justify-between gap-3 ${
                              isSelOpp
                                ? 'bg-rose-500/10 border-rose-400/70 shadow-lg'
                                : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div>
                                <span className="font-extrabold text-sm text-white block">{oppRoster.name}</span>
                                <span className="text-[10px] font-mono text-rose-300">{oppRoster.league}</span>
                              </div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedShow6OppRoster6Id(oppRoster.id);
                                    const names = oppRoster.pokemon.map((p) => p.name);
                                    setShow6Pick3League(oppRoster.league);
                                    setShow6Opponent6(names);
                                    handleRunShow6Pick3Optimizer(oppRoster.league, show6My6, names);
                                  }}
                                  className="px-2.5 py-1 rounded-lg bg-amber-500/25 hover:bg-amber-500/40 border border-amber-400/60 text-amber-200 text-[11px] font-bold transition"
                                >
                                  ⚡ Load Opp 6
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleSwapShow6RosterSide(oppRoster, 'OPP')}
                                  className="px-2.5 py-1 rounded-lg bg-sky-500/20 hover:bg-sky-500/35 border border-sky-400/50 text-sky-200 text-[11px] font-bold transition"
                                  title="Swap / Copy this Opponent Show 6 Team to My Show 6 Teams & load into Simulator"
                                >
                                  ⇄ Swap My/Opp
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setShow6ModalCloneTargetLeague(oppRoster.league);
                                    openShow6RosterEditor(oppRoster, 'OPP');
                                  }}
                                  className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/35 border border-emerald-400/50 text-emerald-200 text-[11px] font-bold transition"
                                  title="Edit Opponent Pick-6 Team, Suggest Upgrades, or Clone / Cross-Mode Copy inside the Editor"
                                >
                                  ✎ Edit / Clone
                                </button>
                                {show6OpponentRosters6.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteShow6Roster6(oppRoster, 'OPP')}
                                    className="px-2 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/35 border border-rose-400/40 text-rose-200 text-[11px] font-bold"
                                    title="Delete Opponent Roster of 6"
                                  >
                                    🗑️
                                  </button>
                                )}
                              </div>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                              {oppRoster.pokemon.slice(0, 6).map((m, idx) => (
                                <div
                                  key={`${oppRoster.id}-${idx}`}
                                  className="px-2 py-1 rounded-lg bg-slate-900 border border-slate-800 text-[11px]"
                                >
                                  <span className="font-bold text-white block truncate">
                                    #{idx + 1} {m.name}
                                  </span>
                                  <span className="text-[9.5px] text-slate-400 font-mono block truncate">
                                    {m.fastMove} • {m.chargedMove1}/{m.chargedMove2}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Section B: Dual Show 6 Team Builders Card */}
                <div className="bg-slate-900 border border-amber-500/40 rounded-2xl p-6 shadow-2xl space-y-5">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-4">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {renderBattleFrontierLogo(22)}
                        <h3 className="text-lg font-extrabold text-white">
                          Show 6 Dual Team Builders (6v6 Pick-3 Optimizer &amp; Blind Show-6 Meta Roster Builder)
                        </h3>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">
                        Switch between <strong>Builder 1 (6v6 Matchup Pick-3 Optimizer)</strong> when you know your opponent&apos;s 6 Pokémon and <strong>Builder 2 (Blind Show 6 Meta Roster Builder)</strong> to construct your optimal 6-Pokémon tournament roster before knowing opponents.
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 bg-slate-950 p-1.5 rounded-xl border border-slate-800 text-xs font-extrabold shrink-0">
                      <button
                        type="button"
                        onClick={() => setShow6ActiveBuilderTab('pick3')}
                        className={`px-3.5 py-2 rounded-lg transition ${
                          show6ActiveBuilderTab === 'pick3'
                            ? 'bg-amber-500 text-slate-950 shadow'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        ⚔️ Builder 1: 6v6 Pick-3 Optimizer
                      </button>
                      <button
                        type="button"
                        onClick={() => setShow6ActiveBuilderTab('blind6')}
                        className={`px-3.5 py-2 rounded-lg transition ${
                          show6ActiveBuilderTab === 'blind6'
                            ? 'bg-sky-500 text-slate-950 shadow'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        🌐 Builder 2: Blind Show 6 Meta Builder
                      </button>
                    </div>
                  </div>

                  {/* ===============================================================
                      BUILDER 1: 6v6 MATCHUP PICK-3 OPTIMIZER (Mode 1)
                     =============================================================== */}
                  {show6ActiveBuilderTab === 'pick3' && (
                    <div className="space-y-5">
                      <div className="p-3.5 rounded-xl bg-slate-950/90 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="text-xs text-slate-300 space-y-0.5">
                          <div className="font-bold text-amber-300">
                            🎯 Mode 1 Rules: Unknown Opponent Movesets + Simulated Best Movesets for Your 6 + Viability Weighting
                          </div>
                          <p className="text-[11px] text-slate-400">
                            Opponent movesets are treated as unknown using the exact Team Builder weighting (75% PvPoke default + 25% alternate moveset combinations). Simulates the highest-BR movesets for your 6 Pokémon, weights all 120 opponent 3-Pokémon teams by viability, and recommends the <strong>Top 3 ABB</strong>, <strong>Top 3 ABC</strong>, and <strong>Top 3 Duo-Core</strong> teams for both You and Your Opponent!
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 flex-wrap">
                          <select
                            value={show6Pick3League}
                            onChange={(e) => {
                              const nextLg = e.target.value as LeagueType;
                              setShow6Pick3League(nextLg);
                              const def = getDefaultShow6RosterNames(nextLg);
                              setShow6My6(def.my6);
                              setShow6Opponent6(def.opp6);
                              handleRunShow6Pick3Optimizer(nextLg, def.my6, def.opp6);
                            }}
                            className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white"
                          >
                            {enabledShow6Leagues.map((lg) => (
                              <option key={lg} value={lg}>
                                {lg} ({getLeagueCpCap(lg) >= 10000 ? 'Uncapped CP' : `${getLeagueCpCap(lg)} CP`})
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={handleFlipActiveMy6AndOpp6}
                            className="px-3 py-2 rounded-xl bg-purple-500/20 hover:bg-purple-500/35 border border-purple-400/50 text-purple-200 font-extrabold text-xs transition"
                            title="Swap Active My 6 and Opponent 6 in the 6v6 Simulator"
                          >
                            ⇄ Flip My 6 / Opp 6
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRunShow6Pick3Optimizer()}
                            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs shadow-lg transition"
                          >
                            ⚡ Simulate 14,400 Lineups
                          </button>
                        </div>
                      </div>

                      {/* Most Likely Meta Opponent 6 of Each Format Quick-Loader Panel */}
                      <div className="p-4 rounded-xl bg-slate-950/90 border border-rose-500/35 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <span className="text-xs font-extrabold text-rose-300 flex items-center gap-1.5">
                              <span>🔥 Most Likely Meta Opponent Team (6) of Each Format</span>
                              <span className="px-2 py-0.5 rounded bg-rose-500/20 border border-rose-400/40 text-rose-200 text-[10px] font-mono">
                                Top Cores + Weighted Meta Usage
                              </span>
                            </span>
                            <p className="text-[11px] text-slate-400">
                              Synthesized from each format&apos;s #1/#2 Battle Frontier Common Cores + highest-usage tournament Pokémon (≤1 Mega, Species Clause enforced). Click any format below to load its Most Likely Opponent 6 into the simulator!
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setShowMostLikelyOpp6FormatsBar((prev) => !prev)}
                            className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[11px] font-bold text-slate-300"
                          >
                            {showMostLikelyOpp6FormatsBar ? 'Hide Format Cards ▲' : 'Show Format Cards ▼'}
                          </button>
                        </div>

                        {showMostLikelyOpp6FormatsBar && (
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2.5">
                            {mostLikelyOpponent6ByFormat.map((fmt) => {
                              const isActiveFmt = fmt.league === show6Pick3League;
                              return (
                                <div
                                  key={fmt.league}
                                  className={`p-3 rounded-xl border transition flex flex-col justify-between gap-2 ${
                                    isActiveFmt
                                      ? 'bg-rose-500/10 border-rose-400/70 shadow-md'
                                      : 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
                                  }`}
                                >
                                  <div className="space-y-1">
                                    <div className="flex items-center justify-between gap-1">
                                      <span className="text-xs font-extrabold text-white">{fmt.shortLabel}</span>
                                      <span className="px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-400/40 text-amber-300 font-mono text-[9.5px] font-bold">
                                        Avg {fmt.avgUsagePct}% Usage
                                      </span>
                                    </div>
                                    {fmt.featuredCores.length > 0 && (
                                      <div className="text-[10px] font-mono text-rose-300 truncate">
                                        🔥 {fmt.featuredCores[0]}
                                      </div>
                                    )}
                                    <div className="flex flex-wrap gap-1 pt-1">
                                      {fmt.pokemonNames.map((mon, mIdx) => (
                                        <span
                                          key={`${fmt.league}-${mIdx}-${mon}`}
                                          className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 text-[10px] font-bold text-slate-200"
                                        >
                                          #{mIdx + 1} {mon}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1.5 pt-1">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setShow6Pick3League(fmt.league);
                                        setShow6Opponent6(fmt.pokemonNames);
                                        handleRunShow6Pick3Optimizer(fmt.league, show6My6, fmt.pokemonNames);
                                        setStartBattleToast(
                                          `🔥 Loaded Most Likely ${fmt.shortLabel} Opponent 6 (${fmt.pokemonNames.slice(0, 3).join('/')}...)!`
                                        );
                                        setTimeout(() => setStartBattleToast(null), 2400);
                                      }}
                                      className="flex-1 py-1.5 px-2 rounded-lg bg-rose-500 hover:bg-rose-400 text-slate-950 font-extrabold text-[10.5px] transition shadow"
                                    >
                                      ⚡ Load as Opp 6
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleSaveOpp6AsRosterPreset(
                                          `Meta Opp 6: ${fmt.shortLabel}`,
                                          fmt.members,
                                          fmt.league
                                        )
                                      }
                                      className="py-1.5 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-rose-200 font-bold text-[10.5px] transition"
                                      title="Save this Format's Most Likely Opponent 6 to Saved Opponent Rosters"
                                    >
                                      💾 Save
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* 6v6 Roster Entry Grid: Your 6 vs Opponent's 6 */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {/* Your 6 Pokémon */}
                        <div className="p-4 rounded-xl bg-slate-950/80 border border-sky-500/40 space-y-3">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <span className="text-xs font-extrabold uppercase tracking-wider text-sky-400">
                              🛡️ Your 6 Pokémon (Best Movesets Auto-Simulated)
                            </span>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => openActiveBuilderRosterEditor('MY')}
                                className="px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-400/50 text-[10px] font-bold text-emerald-300 hover:bg-emerald-500/30"
                              >
                                ✎ Edit &amp; Suggest Upgrades/Moves
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const def = getDefaultShow6RosterNames(show6Pick3League);
                                  setShow6My6(def.my6);
                                  handleRunShow6Pick3Optimizer(show6Pick3League, def.my6, show6Opponent6);
                                }}
                                className="text-[10px] font-bold text-sky-300 hover:underline"
                              >
                                Load League Template
                              </button>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {show6My6.map((val, idx) => {
                              const isFocused =
                                show6SlotAutocomplete?.group === 'my6' && show6SlotAutocomplete.idx === idx;
                              const sugs = isFocused
                                ? getPokemonAutocompleteSuggestions(val, show6Pick3League, 8)
                                : [];
                              const simMember = show6Pick3Result?.my6SimulatedBestMoves[idx];
                              return (
                                <div key={`my6-${idx}`} className="relative space-y-1">
                                  <label className="block text-[10px] font-bold text-slate-400">
                                    My Slot #{idx + 1}
                                  </label>
                                  <input
                                    type="text"
                                    value={val}
                                    onFocus={() => setShow6SlotAutocomplete({ group: 'my6', idx })}
                                    onChange={(e) => {
                                      const next = [...show6My6];
                                      next[idx] = e.target.value;
                                      setShow6My6(next);
                                      setShow6SlotAutocomplete({ group: 'my6', idx });
                                    }}
                                    onBlur={() =>
                                      setTimeout(() => {
                                        setShow6SlotAutocomplete((prev) =>
                                          prev?.group === 'my6' && prev.idx === idx ? null : prev
                                        );
                                      }, 160)
                                    }
                                    className="w-full bg-slate-900 border border-slate-700 focus:border-sky-400 rounded-lg px-2.5 py-1.5 text-xs font-bold text-white"
                                    placeholder={`My Pokémon #${idx + 1}`}
                                  />
                                  {simMember && (
                                    <div className="text-[9.5px] font-mono text-emerald-300 truncate">
                                      ✨ {simMember.fastMove} + {simMember.chargedMove1}/{simMember.chargedMove2}
                                      {resolveMegaPlusMove(simMember.name, show6Pick3League) ? ` [+ ${resolveMegaPlusMove(simMember.name, show6Pick3League)}]` : ''}
                                    </div>
                                  )}
                                  {isFocused && sugs.length > 0 && (
                                    <div className="absolute left-0 right-0 top-full mt-1 z-50 max-h-44 overflow-y-auto rounded-xl bg-slate-900 border border-sky-400 shadow-2xl divide-y divide-slate-800">
                                      {sugs.map((opt) => (
                                        <button
                                          key={opt.name}
                                          type="button"
                                          onMouseDown={(e) => {
                                            e.preventDefault();
                                            const next = [...show6My6];
                                            next[idx] = opt.name;
                                            setShow6My6(next);
                                            setShow6SlotAutocomplete(null);
                                            handleRunShow6Pick3Optimizer(show6Pick3League, next, show6Opponent6);
                                          }}
                                          className="w-full px-2.5 py-1.5 text-left text-xs font-bold text-white hover:bg-sky-500/25 flex items-center justify-between"
                                        >
                                          <span className="truncate">{opt.name}</span>
                                          <span className="text-[9px] font-mono text-sky-300">CP {opt.cp}</span>
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Opponent's 6 Pokémon */}
                        <div className="p-4 rounded-xl bg-slate-950/80 border border-amber-500/40 space-y-3">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <span className="text-xs font-extrabold uppercase tracking-wider text-amber-400">
                              ⚔️ Opponent&apos;s 6 Pokémon (Constrains Live Overlay AI)
                            </span>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <button
                                type="button"
                                onClick={() => {
                                  const metaOpp = getMostLikelyMetaOpponent6ForFormat(show6Pick3League);
                                  setShow6Opponent6(metaOpp.pokemonNames);
                                  handleRunShow6Pick3Optimizer(show6Pick3League, show6My6, metaOpp.pokemonNames);
                                  setStartBattleToast(`🔥 Loaded Most Likely ${metaOpp.shortLabel} Opponent 6!`);
                                  setTimeout(() => setStartBattleToast(null), 2200);
                                }}
                                className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-400/50 text-[10px] font-bold text-amber-300 hover:bg-amber-500/30"
                                title="Load the Most Likely Meta Opponent 6 for the selected league format"
                              >
                                🔥 Most Likely Meta Opp 6
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSaveOpp6AsRosterPreset()}
                                className="px-2 py-0.5 rounded bg-rose-500/20 border border-rose-400/50 text-[10px] font-bold text-rose-300 hover:bg-rose-500/30"
                              >
                                💾 Save Opp 6
                              </button>
                              <button
                                type="button"
                                onClick={() => openActiveBuilderRosterEditor('OPP')}
                                className="px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-400/50 text-[10px] font-bold text-emerald-300 hover:bg-emerald-500/30"
                              >
                                ✎ Edit Opp 6
                              </button>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {show6Opponent6.map((val, idx) => {
                              const isFocused =
                                show6SlotAutocomplete?.group === 'opp6' && show6SlotAutocomplete.idx === idx;
                              const sugs = isFocused
                                ? getPokemonAutocompleteSuggestions(val, show6Pick3League, 8)
                                : [];
                              return (
                                <div key={`opp6-${idx}`} className="relative space-y-1">
                                  <label className="block text-[10px] font-bold text-slate-400">
                                    Opp Slot #{idx + 1}
                                  </label>
                                  <input
                                    type="text"
                                    value={val}
                                    onFocus={() => setShow6SlotAutocomplete({ group: 'opp6', idx })}
                                    onChange={(e) => {
                                      const next = [...show6Opponent6];
                                      next[idx] = e.target.value;
                                      setShow6Opponent6(next);
                                      setShow6SlotAutocomplete({ group: 'opp6', idx });
                                    }}
                                    onBlur={() =>
                                      setTimeout(() => {
                                        setShow6SlotAutocomplete((prev) =>
                                          prev?.group === 'opp6' && prev.idx === idx ? null : prev
                                        );
                                      }, 160)
                                    }
                                    className="w-full bg-slate-900 border border-slate-700 focus:border-amber-400 rounded-lg px-2.5 py-1.5 text-xs font-bold text-white"
                                    placeholder={`Opp Pokémon #${idx + 1}`}
                                  />
                                  <div className="text-[9.5px] font-mono text-amber-300/90 truncate">
                                    🎲 Unknown Moves (75%/25% Wtd)
                                  </div>
                                  {isFocused && sugs.length > 0 && (
                                    <div className="absolute left-0 right-0 top-full mt-1 z-50 max-h-44 overflow-y-auto rounded-xl bg-slate-900 border border-amber-400 shadow-2xl divide-y divide-slate-800">
                                      {sugs.map((opt) => (
                                        <button
                                          key={opt.name}
                                          type="button"
                                          onMouseDown={(e) => {
                                            e.preventDefault();
                                            const next = [...show6Opponent6];
                                            next[idx] = opt.name;
                                            setShow6Opponent6(next);
                                            setShow6SlotAutocomplete(null);
                                            handleRunShow6Pick3Optimizer(show6Pick3League, show6My6, next);
                                          }}
                                          className="w-full px-2.5 py-1.5 text-left text-xs font-bold text-white hover:bg-amber-500/25 flex items-center justify-between"
                                        >
                                          <span className="truncate">{opt.name}</span>
                                          <span className="text-[9px] font-mono text-amber-300">CP {opt.cp}</span>
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      {/* Pick-3 Simulation Results: Opponent Most Likely Teams (by Archetype or Top 6) + Your 3 ABB, 3 ABC, 3 Duo-Core Options */}
                      {show6Pick3Result && (
                        <div className="space-y-5">
                          {/* Most Likely Opponent 3-Pokemon Lineups Panel (Supports Both Archetype Breakdown ABB/ABC/Duo AND Overall Top 6) */}
                          <div className="p-4 rounded-xl bg-slate-950/90 border border-amber-500/35 space-y-3">
                            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
                              <div>
                                <span className="text-xs font-extrabold text-amber-300 block">
                                  📊 Most Likely Opponent Pick-3 Teams from Opponent&apos;s 6 (Weighted by Viability, Meta Usage &amp; Common Cores)
                                </span>
                                <span className="text-[10.5px] font-mono text-slate-400">
                                  {show6Pick3Result.totalMatchupsSimulated.toLocaleString()} ordered 3v3 matchups simulated in {show6Pick3Result.elapsedMs}ms
                                </span>
                              </div>
                              <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800 text-[10.5px] font-bold">
                                <button
                                  type="button"
                                  onClick={() => setShow6OppLineupViewMode('archetypes')}
                                  className={`px-2.5 py-1 rounded-md transition ${
                                    show6OppLineupViewMode === 'archetypes'
                                      ? 'bg-amber-500 text-slate-950 font-extrabold'
                                      : 'text-slate-400 hover:text-white'
                                  }`}
                                >
                                  🎯 By Format Archetype (3 ABB / 3 ABC / 3 Duo)
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setShow6OppLineupViewMode('top6')}
                                  className={`px-2.5 py-1 rounded-md transition ${
                                    show6OppLineupViewMode === 'top6'
                                      ? 'bg-amber-500 text-slate-950 font-extrabold'
                                      : 'text-slate-400 hover:text-white'
                                  }`}
                                >
                                  🏆 Top 6 Overall Viable Trios
                                </button>
                              </div>
                            </div>

                            {show6OppLineupViewMode === 'archetypes' ? (
                              <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                                {(
                                  [
                                    {
                                      title: 'Opponent Top 3 ABB Trios',
                                      subtitle: 'Opp Lead A covers shared B1/B2 backline',
                                      badgeCls: 'text-amber-300 border-amber-500/40 bg-amber-500/10',
                                      items: show6Pick3Result.oppTop3AbbTeams || []
                                    },
                                    {
                                      title: 'Opponent Top 3 ABC Trios',
                                      subtitle: 'Opp Balanced Lead / Swap / Closer',
                                      badgeCls: 'text-sky-300 border-sky-500/40 bg-sky-500/10',
                                      items: show6Pick3Result.oppTop3AbcTeams || []
                                    },
                                    {
                                      title: 'Opponent Top 3 Duo-Core Trios',
                                      subtitle: 'Opp Reciprocal Core + Safe Swap Pivot',
                                      badgeCls: 'text-emerald-300 border-emerald-500/40 bg-emerald-500/10',
                                      items: show6Pick3Result.oppTop3DuoTeams || []
                                    }
                                  ] as const
                                ).map((oppGroup) => (
                                  <div
                                    key={oppGroup.title}
                                    className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2"
                                  >
                                    <div className="border-b border-slate-800 pb-1.5">
                                      <h5 className="font-extrabold text-xs text-white">{oppGroup.title}</h5>
                                      <p className="text-[10px] text-slate-400">{oppGroup.subtitle}</p>
                                    </div>
                                    <div className="space-y-2">
                                      {oppGroup.items.map((oppLineup, idx) => (
                                        <div
                                          key={oppLineup.id}
                                          className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/90 space-y-1.5 text-xs"
                                        >
                                          <div className="flex items-center justify-between gap-1.5">
                                            <span className={`px-1.5 py-0.5 rounded text-[9.5px] font-extrabold border ${oppGroup.badgeCls}`}>
                                              Opp #{idx + 1} {oppLineup.archetype}
                                            </span>
                                            <div className="flex items-center gap-1 font-mono text-[10px]">
                                              <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-300">
                                                Score {oppLineup.viabilityScore}
                                              </span>
                                              <span className="px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-400/40 text-amber-300 font-extrabold">
                                                {oppLineup.viabilityWeightPct.toFixed(1)}% Wt
                                              </span>
                                            </div>
                                          </div>
                                          <div className="font-bold text-white text-[11.5px]">
                                            1. {oppLineup.lead} <span className="text-slate-500">/</span> 2. {oppLineup.swap}{' '}
                                            <span className="text-slate-500">/</span> 3. {oppLineup.closer}
                                          </div>
                                          <div className="text-[10px] text-slate-400 leading-snug">
                                            {oppLineup.rationale}
                                          </div>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              const members: TeamMember[] = oppLineup.names.map((n, mIdx) => {
                                                const rec = getRecommendedMovesForPokemon(n, show6Pick3League);
                                                return {
                                                  id: `p${mIdx + 1}`,
                                                  name: rec?.name || n,
                                                  cp: rec?.cp || 1500,
                                                  fastMove: rec?.fastMove || 'Tackle',
                                                  chargedMove1: rec?.chargedMove1 || 'Body Slam',
                                                  chargedMove2: rec?.chargedMove2 || 'Surf',
                                                  ivs: rec?.defaultIvs
                                                };
                                              });
                                              handleEquipShow6LineupToOverlay(
                                                members,
                                                oppLineup.archetype,
                                                show6Pick3League,
                                                `Opp ${oppLineup.archetype} Score ${oppLineup.viabilityScore}`
                                              );
                                            }}
                                            className="w-full py-1 px-2 rounded bg-slate-800 hover:bg-sky-500/25 border border-slate-700 hover:border-sky-400/50 text-sky-300 font-bold text-[10px] transition"
                                            title="Clone & Equip this Opponent Trio as Your Show 6 Overlay Trio"
                                          >
                                            📋 Clone Trio to My Show 6 Overlay (3)
                                          </button>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                {show6Pick3Result.topOpponentViableLineups.slice(0, 6).map((oppLineup, idx) => (
                                  <div
                                    key={`opp-viable-${idx}`}
                                    className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex flex-col justify-between gap-2 text-xs"
                                  >
                                    <div className="flex items-center justify-between gap-2">
                                      <div className="min-w-0">
                                        <span className="font-bold text-white block truncate">
                                          #{idx + 1} {oppLineup.names.join(' / ')}
                                        </span>
                                        <span className="text-[10px] text-slate-400 font-mono">
                                          Archetype: {oppLineup.archetype} • Score {oppLineup.viabilityScore}
                                        </span>
                                      </div>
                                      <span className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-400/40 text-amber-300 font-mono font-extrabold text-[11px] shrink-0">
                                        {oppLineup.viabilityWeightPct.toFixed(1)}% Wt
                                      </span>
                                    </div>
                                    <div className="text-[10px] text-slate-400 truncate">{oppLineup.rationale}</div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* 3 Options per Team Type for YOU: Top 3 ABB, Top 3 ABC, Top 3 Duo-Core */}
                          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                            {(
                              [
                                {
                                  title: 'Your Top 3 ABB Lineups',
                                  subtitle: 'Lead A covers shared B1/B2 backline weakness',
                                  badgeColor: 'text-amber-300 border-amber-500/40 bg-amber-500/10',
                                  items: show6Pick3Result.topAbbLineups
                                },
                                {
                                  title: 'Your Top 3 ABC Lineups',
                                  subtitle: 'Balanced triangular coverage core',
                                  badgeColor: 'text-sky-300 border-sky-500/40 bg-sky-500/10',
                                  items: show6Pick3Result.topAbcLineups
                                },
                                {
                                  title: 'Your Top 3 Duo-Core Lineups',
                                  subtitle: 'Reciprocal Core + Pivot Safe Swap',
                                  badgeColor: 'text-emerald-300 border-emerald-500/40 bg-emerald-500/10',
                                  items: show6Pick3Result.topDuoLineups
                                }
                              ] as const
                            ).map((group) => (
                              <div
                                key={group.title}
                                className="p-4 rounded-2xl bg-slate-950/90 border border-slate-800 space-y-3"
                              >
                                <div className="border-b border-slate-800 pb-2">
                                  <h4 className="font-extrabold text-sm text-white">{group.title}</h4>
                                  <p className="text-[10.5px] text-slate-400">{group.subtitle}</p>
                                </div>

                                <div className="space-y-3">
                                  {group.items.map((lineup, idx) => (
                                    <div
                                      key={lineup.id}
                                      className="p-3 rounded-xl bg-slate-900 border border-slate-800 hover:border-sky-500/50 transition space-y-2"
                                    >
                                      <div className="flex items-center justify-between gap-2">
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold border ${group.badgeColor}`}>
                                          Option #{idx + 1} • {lineup.archetype}
                                        </span>
                                        <div className="flex items-center gap-1.5 font-mono text-[11px]">
                                          <span className="px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 font-extrabold">
                                            Exp BR {lineup.expectedWeightedBr}
                                          </span>
                                          <span className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-300">
                                            Min {lineup.worstCaseBr}
                                          </span>
                                        </div>
                                      </div>

                                      <div className="space-y-1">
                                        {lineup.members.map((m, mIdx) => (
                                          <div
                                            key={`${lineup.id}-m-${mIdx}`}
                                            className="px-2 py-1 rounded bg-slate-950/80 border border-slate-800/80 flex items-center justify-between gap-2 text-[11px]"
                                          >
                                            <span className="font-extrabold text-white truncate">
                                              {mIdx === 0 ? '1. Lead:' : mIdx === 1 ? '2. Swap:' : '3. Closer:'} {m.name}
                                            </span>
                                            <span className="text-[9.5px] font-mono text-sky-300 truncate shrink-0">
                                              {m.fastMove} + {m.chargedMove1}/{m.chargedMove2}
                                              {resolveMegaPlusMove(m.name, show6Pick3League) ? ` [+ ${resolveMegaPlusMove(m.name, show6Pick3League)}]` : ''}
                                            </span>
                                          </div>
                                        ))}
                                      </div>

                                      <div className="text-[10px] text-slate-400 space-y-0.5">
                                        <div className="text-emerald-300 truncate">
                                          ✅ Beats: {lineup.strongestAgainst.slice(0, 2).join(' • ')}
                                        </div>
                                        <div className="text-rose-300 truncate">
                                          ⚠️ Watch: {lineup.dangerLineups.slice(0, 1).join(' • ')}
                                        </div>
                                      </div>

                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleEquipShow6LineupToOverlay(
                                            lineup.members,
                                            lineup.archetype,
                                            show6Pick3League,
                                            `Exp BR ${lineup.expectedWeightedBr}`
                                          )
                                        }
                                        className="w-full py-1.5 px-3 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-extrabold text-xs transition shadow"
                                      >
                                        ⚡ Save &amp; Equip to Show 6 Overlay (Team of 3)
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ===============================================================
                      BUILDER 2: BLIND SHOW 6 META ROSTER BUILDER (Mode 2)
                     =============================================================== */}
                  {show6ActiveBuilderTab === 'blind6' && (
                    <div className="space-y-5">
                      <div className="p-3.5 rounded-xl bg-slate-950/90 border border-sky-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="text-xs text-slate-300 space-y-0.5">
                          <div className="font-bold text-sky-300">
                            🌐 Mode 2: Blind Show 6 Tournament Roster Optimizer (PvPoke Meta + Limited Cup Ban/Whitelist + Historical Opponents)
                          </div>
                          <p className="text-[11px] text-slate-400">
                            Constructs an optimal 6-Pokémon roster with mutually covering ABB, ABC, and Duo-Core trios before knowing your opponent&apos;s 6. Lock 0–5 core Pokémon, import a Whitelist or Banlist, and weight Expected Historical Pokémon vs. the PvPoke Meta.
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <select
                            value={blindShow6League}
                            onChange={(e) => {
                              const nextLg = e.target.value as LeagueType;
                              setBlindShow6League(nextLg);
                              const sampleHist = getDefaultShow6RosterNames(nextLg).opp6;
                              setBlindShow6HistoricalChips(sampleHist);
                              setBlindShow6HistoricalText(sampleHist.join(', '));
                            }}
                            className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white"
                          >
                            {enabledShow6Leagues.map((lg) => (
                              <option key={lg} value={lg}>
                                {lg} ({getLeagueCpCap(lg) >= 10000 ? 'Uncapped CP' : `${getLeagueCpCap(lg)} CP`})
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={handleRunBlindShow6Optimizer}
                            className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-extrabold text-xs shadow-lg transition"
                          >
                            ✨ Build Optimal Blind Show 6
                          </button>
                        </div>
                      </div>

                      {/* Lockable Core Slots (0 to 5 Pokémon) */}
                      <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-extrabold text-white">
                            🔒 Lockable Core Slots (Optional: Lock 0 to 5 Pokémon to Build Around)
                          </span>
                          <button
                            type="button"
                            onClick={() => setBlindShow6LockedSlots(['', '', '', '', ''])}
                            className="text-[10px] font-bold text-slate-400 hover:text-white"
                          >
                            Clear Locks
                          </button>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                          {blindShow6LockedSlots.map((val, idx) => {
                            const isFocused =
                              show6SlotAutocomplete?.group === 'lock6' && show6SlotAutocomplete.idx === idx;
                            const sugs = isFocused
                              ? getPokemonAutocompleteSuggestions(val, blindShow6League, 8)
                              : [];
                            return (
                              <div key={`lock6-${idx}`} className="relative">
                                <input
                                  type="text"
                                  value={val}
                                  onFocus={() => setShow6SlotAutocomplete({ group: 'lock6', idx })}
                                  onChange={(e) => {
                                    const next = [...blindShow6LockedSlots];
                                    next[idx] = e.target.value;
                                    setBlindShow6LockedSlots(next);
                                    setShow6SlotAutocomplete({ group: 'lock6', idx });
                                  }}
                                  onBlur={() =>
                                    setTimeout(() => {
                                      setShow6SlotAutocomplete((prev) =>
                                        prev?.group === 'lock6' && prev.idx === idx ? null : prev
                                      );
                                    }, 160)
                                  }
                                  placeholder={`Lock Slot #${idx + 1} (Opt)`}
                                  className="w-full bg-slate-900 border border-slate-700 focus:border-sky-400 rounded-lg px-2.5 py-1.5 text-xs text-white"
                                />
                                {isFocused && sugs.length > 0 && (
                                  <div className="absolute left-0 right-0 top-full mt-1 z-50 max-h-44 overflow-y-auto rounded-xl bg-slate-900 border border-sky-400 shadow-2xl divide-y divide-slate-800">
                                    {sugs.map((opt) => (
                                      <button
                                        key={opt.name}
                                        type="button"
                                        onMouseDown={(e) => {
                                          e.preventDefault();
                                          const next = [...blindShow6LockedSlots];
                                          next[idx] = opt.name;
                                          setBlindShow6LockedSlots(next);
                                          setShow6SlotAutocomplete(null);
                                        }}
                                        className="w-full px-2.5 py-1.5 text-left text-xs font-bold text-white hover:bg-sky-500/25 flex items-center justify-between"
                                      >
                                        <span className="truncate">{opt.name}</span>
                                        <span className="text-[9px] font-mono text-sky-300">CP {opt.cp}</span>
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Input Method Selector (Option 2 Text Paste vs Option 3 Interactive Chip Picker) + Cup Filter + Historical Weight */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {/* Left: Cup Rules (Open / Whitelist / Banlist — Persisted Per League + Clear Option) */}
                        <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <span className="text-xs font-extrabold text-purple-300 block">
                                🛡️ Limited Meta Filter (Persisted Per League: {blindShow6League.split(' ')[0]})
                              </span>
                              <span className="text-[10px] text-slate-400">
                                Saved for {blindShow6League}: <strong>{activeLeagueWhitelistChips.length} Whitelisted</strong> • <strong>{activeLeagueBanlistChips.length} Banned</strong>
                              </span>
                            </div>
                            {/* User's Clarifying Answer #3: Method Selector between Text Paste and Chip Picker */}
                            <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800 text-[10px] font-bold">
                              <button
                                type="button"
                                onClick={() => setBlindShow6InputMethod('text')}
                                className={`px-2 py-1 rounded ${
                                  blindShow6InputMethod === 'text'
                                    ? 'bg-purple-500 text-white'
                                    : 'text-slate-400 hover:text-white'
                                }`}
                              >
                                📝 Text Paste
                              </button>
                              <button
                                type="button"
                                onClick={() => setBlindShow6InputMethod('chips')}
                                className={`px-2 py-1 rounded ${
                                  blindShow6InputMethod === 'chips'
                                    ? 'bg-purple-500 text-white'
                                    : 'text-slate-400 hover:text-white'
                                }`}
                              >
                                🏷️ Chip Picker
                              </button>
                            </div>
                          </div>

                          <div className="grid grid-cols-3 gap-1.5 text-xs font-bold">
                            {(['OPEN', 'WHITELIST', 'BANLIST'] as const).map((m) => (
                              <button
                                key={m}
                                type="button"
                                onClick={() => setBlindShow6FilterMode(m)}
                                className={`py-1.5 rounded-lg border transition ${
                                  blindShow6FilterMode === m
                                    ? 'bg-purple-500/25 border-purple-400 text-purple-200'
                                    : 'bg-slate-900 border-slate-800 text-slate-400'
                                }`}
                              >
                                {m === 'OPEN'
                                  ? 'Open Meta'
                                  : m === 'WHITELIST'
                                  ? `Whitelist (${activeLeagueWhitelistChips.length})`
                                  : `Banlist (${activeLeagueBanlistChips.length})`}
                              </button>
                            ))}
                          </div>

                          {/* Per-League Clear Whitelist / Banlist Buttons */}
                          <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1 border-t border-slate-800/80">
                            <span className="text-[10px] font-mono text-slate-400">
                              Auto-saved for {blindShow6League}
                            </span>
                            <div className="flex flex-wrap items-center gap-1.5">
                              {blindShow6FilterMode !== 'OPEN' && (
                                <button
                                  type="button"
                                  onClick={() => handleClearLeagueFilterList(blindShow6FilterMode)}
                                  className="px-2 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 text-[10px] font-bold transition"
                                >
                                  🗑️ Clear {blindShow6FilterMode === 'WHITELIST' ? 'Whitelist' : 'Banlist'} ({blindShow6League.split(' ')[0]})
                                </button>
                              )}
                              {(activeLeagueWhitelistChips.length > 0 || activeLeagueBanlistChips.length > 0) && (
                                <button
                                  type="button"
                                  onClick={() => handleClearLeagueFilterList('BOTH')}
                                  className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-rose-950/60 border border-slate-700 hover:border-rose-500/40 text-slate-300 hover:text-rose-200 text-[10px] font-bold transition"
                                >
                                  🧹 Clear Both ({blindShow6League.split(' ')[0]})
                                </button>
                              )}
                            </div>
                          </div>

                          {blindShow6FilterMode !== 'OPEN' && (
                            <div className="space-y-2">
                              {blindShow6InputMethod === 'text' ? (
                                <textarea
                                  rows={3}
                                  value={blindShow6FilterTextDraft}
                                  onChange={(e) => {
                                    const rawVal = e.target.value;
                                    const parsed = parsePokemonListInput(rawVal, blindShow6League);
                                    updateActiveLeagueFilterList(parsed, rawVal);
                                  }}
                                  placeholder={`Paste comma or newline-separated Pokémon for ${blindShow6League} ${blindShow6FilterMode.toLowerCase()} (auto-persisted per league)...`}
                                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs text-white font-mono"
                                />
                              ) : (
                                <div className="space-y-2">
                                  <div className="flex gap-1.5">
                                    <input
                                      type="text"
                                      value={blindShow6FilterChipQuery}
                                      onChange={(e) => setBlindShow6FilterChipQuery(e.target.value)}
                                      placeholder={`Type Pokémon to add to ${blindShow6League} ${blindShow6FilterMode.toLowerCase()}...`}
                                      className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                                    />
                                  </div>
                                  {blindShow6FilterChipQuery.trim().length > 0 && (
                                    <div className="flex flex-wrap gap-1">
                                      {getPokemonAutocompleteSuggestions(
                                        blindShow6FilterChipQuery,
                                        blindShow6League,
                                        6
                                      ).map((opt) => (
                                        <button
                                          key={opt.name}
                                          type="button"
                                          onClick={() => {
                                            if (!blindShow6FilterChips.includes(opt.name)) {
                                              const next = [...blindShow6FilterChips, opt.name];
                                              updateActiveLeagueFilterList(next);
                                            }
                                            setBlindShow6FilterChipQuery('');
                                          }}
                                          className="px-2 py-1 rounded-md bg-purple-500/20 hover:bg-purple-500/35 border border-purple-400/50 text-purple-200 text-[11px] font-bold"
                                        >
                                          + {opt.name}
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                  <div className="flex flex-wrap gap-1.5 pt-1">
                                    {blindShow6FilterChips.map((chip) => (
                                      <span
                                        key={chip}
                                        className="px-2 py-0.5 rounded-full bg-slate-900 border border-purple-400/50 text-purple-200 text-[11px] font-bold inline-flex items-center gap-1"
                                      >
                                        <span>{chip}</span>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const next = blindShow6FilterChips.filter((c) => c !== chip);
                                            updateActiveLeagueFilterList(next);
                                          }}
                                          className="text-slate-400 hover:text-white"
                                        >
                                          ✕
                                        </button>
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Right: Expected Historical Pokémon & Weight Slider */}
                        <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-xs font-extrabold text-emerald-300">
                              📜 Expected Historical Pokémon &amp; Weight Slider
                            </span>
                            <button
                              type="button"
                              onClick={handleImportHistoricalFromShow6Logs}
                              className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/50 text-emerald-200 text-[10.5px] font-bold"
                            >
                              📥 Pull from Battle Logs
                            </button>
                          </div>

                          {/* Historical vs Meta Weight Slider */}
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-[11px] font-mono">
                              <span className="text-sky-300">
                                PvPoke Meta Weight: <strong>{100 - blindShow6HistoricalWeightPct}%</strong>
                              </span>
                              <span className="text-emerald-300">
                                Historical Match Weight: <strong>{blindShow6HistoricalWeightPct}%</strong>
                              </span>
                            </div>
                            <input
                              type="range"
                              min={0}
                              max={100}
                              step={5}
                              value={blindShow6HistoricalWeightPct}
                              onChange={(e) => setBlindShow6HistoricalWeightPct(Number(e.target.value))}
                              className="w-full accent-emerald-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                            />
                          </div>

                          {blindShow6InputMethod === 'text' ? (
                            <textarea
                              rows={3}
                              value={blindShow6HistoricalText}
                              onChange={(e) => {
                                setBlindShow6HistoricalText(e.target.value);
                                setBlindShow6HistoricalChips(
                                  parsePokemonListInput(e.target.value, blindShow6League)
                                );
                              }}
                              placeholder="Paste expected opponent Pokémon from historical matches (comma or newline separated)..."
                              className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs text-white font-mono"
                            />
                          ) : (
                            <div className="space-y-2">
                              <input
                                type="text"
                                value={blindShow6HistoricalChipQuery}
                                onChange={(e) => setBlindShow6HistoricalChipQuery(e.target.value)}
                                placeholder="Type Pokémon to add to Expected Historical Opponents..."
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                              />
                              {blindShow6HistoricalChipQuery.trim().length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                  {getPokemonAutocompleteSuggestions(
                                    blindShow6HistoricalChipQuery,
                                    blindShow6League,
                                    6
                                  ).map((opt) => (
                                    <button
                                      key={opt.name}
                                      type="button"
                                      onClick={() => {
                                        const next = [...blindShow6HistoricalChips, opt.name];
                                        setBlindShow6HistoricalChips(next);
                                        setBlindShow6HistoricalText(next.join(', '));
                                        setBlindShow6HistoricalChipQuery('');
                                      }}
                                      className="px-2 py-1 rounded-md bg-emerald-500/20 hover:bg-emerald-500/35 border border-emerald-400/50 text-emerald-200 text-[11px] font-bold"
                                    >
                                      + {opt.name}
                                    </button>
                                  ))}
                                </div>
                              )}
                              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                                {blindShow6HistoricalChips.map((chip, cIdx) => (
                                  <span
                                    key={`${chip}-${cIdx}`}
                                    className="px-2 py-0.5 rounded-full bg-slate-900 border border-emerald-400/50 text-emerald-200 text-[11px] font-bold inline-flex items-center gap-1"
                                  >
                                    <span>{chip}</span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const next = blindShow6HistoricalChips.filter((_, i) => i !== cIdx);
                                        setBlindShow6HistoricalChips(next);
                                        setBlindShow6HistoricalText(next.join(', '));
                                      }}
                                      className="text-slate-400 hover:text-white"
                                    >
                                      ✕
                                    </button>
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Blind Show 6 Generated Roster Result */}
                      {blindShow6Result && (
                        <div className="p-4 rounded-2xl bg-slate-950/90 border border-sky-500/40 space-y-4">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                            <div>
                              <h4 className="font-extrabold text-sm text-white">
                                🏆 Recommended Blind Show 6 Tournament Roster ({blindShow6Result.league})
                              </h4>
                              <p className="text-[11px] text-slate-400">
                                Overall Blended Score: <strong className="text-emerald-300">{blindShow6Result.overallBlendedScore} BR</strong> • {blindShow6Result.eligiblePoolCount} eligible meta species evaluated in {blindShow6Result.elapsedMs}ms
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                const members = blindShow6Result.roster.map((r) => r.member);
                                handleSaveMy6AsRosterPreset(
                                  `Blind Show 6 ${blindShow6Result.league.split(' ')[0]}`,
                                  members,
                                  blindShow6Result.league
                                );
                                setShow6Pick3League(blindShow6Result.league);
                                setShow6My6(members.map((m) => m.name));
                              }}
                              className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs shadow transition shrink-0"
                            >
                              💾 Save to Show 6 Teams of 6 &amp; Load into 6v6 Optimizer
                            </button>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                            {blindShow6Result.roster.map((slot, idx) => (
                              <div
                                key={`blind-slot-${idx}-${slot.member.name}`}
                                className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5"
                              >
                                <div className="flex items-center justify-between gap-1">
                                  <span className="font-extrabold text-xs text-white truncate">
                                    #{idx + 1} {slot.member.name}
                                  </span>
                                  <span className="px-2 py-0.5 rounded bg-sky-500/20 border border-sky-400/40 text-sky-300 font-mono text-[10px] font-bold">
                                    Blended {slot.blendedBr}
                                  </span>
                                </div>
                                <div className="text-[10px] font-semibold text-amber-300">
                                  {slot.roleBadge}
                                </div>
                                <div className="text-[10px] font-mono text-slate-300 truncate">
                                  {slot.member.fastMove} + {slot.member.chargedMove1}/{slot.member.chargedMove2}
                                  {resolveMegaPlusMove(slot.member.name, blindShow6Result.league) ? ` [+ ${resolveMegaPlusMove(slot.member.name, blindShow6Result.league)}]` : ''}
                                </div>
                                <div className="text-[9.5px] font-mono text-slate-400 flex items-center justify-between pt-1 border-t border-slate-800">
                                  <span>Meta BR: {slot.metaBr}</span>
                                  <span>Hist BR: {slot.historicalBr}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Layers className="w-5 h-5 text-sky-400" />
                  <span>
                    {appCombatMode === 'show6'
                      ? 'Show 6 Overlay Trios (Saved Teams of 3 for Floating HUD)'
                      : 'Custom GBL Team Presets'}
                  </span>
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Drag cards by the grip handle (or use ↑/↓) to rearrange team order. Type any Pokémon base name in the Team Builder to autocomplete Base, Shadow, and Alternate Forms with PvPoke rankings moves!
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-emerald-400 font-semibold">
                  <span>✓ {pvPokeSyncStatus}</span>
                  <span className="px-2 py-0.5 rounded-md bg-sky-500/15 border border-sky-500/40 text-sky-300 font-mono">
                    ⚡ Precomputed 9x9 Matrix: Top {precomputed9x9State.metaDepth} {precomputed9x9State.league} Meta ({precomputed9x9State.totalCellsComputed} cells in {precomputed9x9State.elapsedMs}ms)
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 flex-wrap">
                <button
                  onClick={() => {
                    const nextOpen = !showAntiMetaBuilder;
                    setShowAntiMetaBuilder(nextOpen);
                    if (nextOpen && !antiMetaResult) {
                      handleGenerateAntiMetaTeams();
                    }
                  }}
                  className={`py-2.5 px-3.5 rounded-xl border font-bold text-xs flex items-center gap-1.5 transition ${
                    showAntiMetaBuilder
                      ? 'bg-purple-600/25 border-purple-400 text-purple-200 shadow-lg shadow-purple-500/10'
                      : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-purple-300'
                  }`}
                  title="Generate Best 5 ABB and Best 5 ABC Anti-Meta Teams featuring 0, 1, or 2 Pokémon"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Anti-Meta Team Builder</span>
                </button>
                <button
                  onClick={() => setShowTeamsTrashModal(true)}
                  className="py-2.5 px-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-amber-300 font-bold text-xs flex items-center gap-1.5 transition"
                  title="Restore accidentally deleted team presets"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>
                    Trash (
                    {appCombatMode === 'show6'
                      ? deletedTeamsTrash.length + show6DeletedRostersTrash.length
                      : deletedTeamsTrash.length}
                    )
                  </span>
                </button>
                <button
                  onClick={handleManualPvPokeSync}
                  disabled={isSyncingPvPoke}
                  className="py-2.5 px-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-sky-300 font-bold text-xs flex items-center gap-1.5 transition"
                  title="Fetch latest PvPoke gamemaster.json + selected league rankings JSONs"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncingPvPoke ? 'animate-spin' : ''}`} />
                  <span>{isSyncingPvPoke ? 'Syncing Rankings...' : 'Sync PvPoke + Rankings'}</span>
                </button>
                <button
                  onClick={openCreatePresetModal}
                  className="py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-emerald-600/25 transition shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create New Preset</span>
                </button>
              </div>
            </div>

            {/* =====================================================================
                ANTI-META TEAM BUILDER PANEL (Requirements 2a, 2b, 2c)
               ===================================================================== */}
            {showAntiMetaBuilder && (() => {
              const feat1RankRange = parseFeaturedRankRangeQuery(antiMetaFeat1);
              const feat2RankRange = parseFeaturedRankRangeQuery(antiMetaFeat2);
              const feat1Suggestions = feat1RankRange
                ? []
                : getPokemonAutocompleteSuggestions(antiMetaFeat1, antiMetaLeague, 12);
              const feat2Suggestions = feat2RankRange
                ? []
                : getPokemonAutocompleteSuggestions(antiMetaFeat2, antiMetaLeague, 12);
              const defaultPreviewName = formatAntiMetaDefaultTeamName(antiMetaLeague, new Date());

              return (
                <div className="bg-slate-900 border border-purple-500/40 rounded-2xl p-6 shadow-2xl space-y-5">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-4">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Sparkles className="w-5 h-5 text-purple-400" />
                        <h3 className="text-lg font-extrabold text-white">
                          Anti-Meta Team Builder (Best 5 ABB, 5 ABC &amp; 5 Duo-Core Generator)
                        </h3>
                        <span className="px-2.5 py-0.5 rounded-full bg-purple-500/20 border border-purple-500/40 text-purple-300 text-[10px] font-bold">
                          Live PvPoke Rankings Sourced
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">
                        Select a League and optionally enter <strong className="text-slate-200">0, 1, or 2 Pokémon or Rank Ranges</strong> (e.g. <code className="text-purple-300 font-mono">200-</code> for Rank #200+, <code className="text-purple-300 font-mono">-10</code> for Top 10, <code className="text-purple-300 font-mono">100-200</code> for #100–#200). Generates the <strong className="text-amber-300">Best 5 ABB</strong>, <strong className="text-sky-300">Best 5 ABC</strong>, and <strong className="text-emerald-300">Best 5 Duo-Core</strong> Anti-Meta teams. Selecting any team creates <code className="text-emerald-300 font-mono">{defaultPreviewName}</code> and opens the Edit Team screen immediately.
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 flex-wrap">
                      <button
                        type="button"
                        onClick={() => setShowArchetypePlaybook((prev) => !prev)}
                        className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-emerald-300 font-bold text-xs flex items-center gap-1.5 transition"
                      >
                        <Info className="w-3.5 h-3.5" />
                        <span>{showArchetypePlaybook ? 'Hide Archetype Playbooks' : '📚 Duo-Core / ABC / ABB Playbooks'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleGenerateAntiMetaTeams()}
                        className="py-2.5 px-4 rounded-xl bg-purple-600 hover:bg-purple-500 active:scale-95 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-purple-600/25 transition"
                      >
                        <Sparkles className="w-4 h-4" />
                        <span>Generate 5 ABB + 5 ABC + 5 Duo-Core</span>
                      </button>
                    </div>
                  </div>

                  {/* Competitive Archetype Playbooks (Duo-Core, ABC, ABB Strategy Guide) */}
                  {showArchetypePlaybook && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-slate-950/90 border border-slate-800 rounded-xl p-4 text-xs">
                      {(['DUO', 'ABC', 'ABB'] as const).map((archKey) => {
                        const pb = COMPETITIVE_ARCHETYPE_PLAYBOOKS[archKey];
                        const badgeCls =
                          archKey === 'ABB'
                            ? 'text-amber-300 border-amber-500/40 bg-amber-500/10'
                            : archKey === 'DUO'
                            ? 'text-emerald-300 border-emerald-500/40 bg-emerald-500/10'
                            : 'text-sky-300 border-sky-500/40 bg-sky-500/10';
                        return (
                          <div key={archKey} className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <span className={`px-2 py-0.5 rounded font-black text-[10.5px] border ${badgeCls}`}>
                                {pb.title}
                              </span>
                            </div>
                            <p className="text-[11px] font-semibold text-slate-200">{pb.subtitle}</p>
                            <p className="text-[10.5px] text-slate-400 leading-relaxed">{pb.howToPlay}</p>
                            <ul className="space-y-1 text-[10px] text-slate-300 list-disc pl-4">
                              {pb.proTactics.map((pillar, pIdx) => (
                                <li key={pIdx}>{pillar}</li>
                              ))}
                            </ul>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Step 2a: League + 0, 1, or 2 Featured Pokémon or Rank Range Inputs */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* League Selection */}
                    <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-3.5 space-y-2">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                        1. Target League
                      </label>
                      <div className="grid grid-cols-2 gap-1.5 max-h-40 overflow-y-auto pr-1">
                        {(appCombatMode === 'show6' ? enabledShow6Leagues : enabledGblLeagues).map((lgId) => {
                          const shortLbl =
                            lgId === 'GREAT LEAGUE'
                              ? 'Great (1500)'
                              : lgId === 'ULTRA LEAGUE'
                              ? 'Ultra (2500)'
                              : lgId === 'MASTER LEAGUE'
                              ? 'Master (ML)'
                              : lgId === 'MEGA MASTER LEAGUE'
                              ? 'Mega ML'
                              : lgId === 'Battle Frontier (Spectral)'
                              ? 'Spectral (1500)'
                              : lgId === 'Battle Frontier (Cauldron)'
                              ? 'Cauldron (2500)'
                              : lgId === 'Battle Frontier (Master)'
                              ? 'BF Master'
                              : lgId;
                          return (
                            <button
                              key={lgId}
                              type="button"
                              onClick={() => {
                                setAntiMetaLeague(lgId);
                                handleGenerateAntiMetaTeams(lgId, antiMetaFeat1, antiMetaFeat2);
                              }}
                              className={`px-2.5 py-2 rounded-lg text-xs font-bold transition border truncate ${
                                antiMetaLeague === lgId
                                  ? 'bg-sky-600 text-white border-sky-400 shadow'
                                  : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700'
                              }`}
                              title={lgId}
                            >
                              {shortLbl}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Featured Pokémon / Rank Range #1 (Optional) */}
                    <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-3.5 space-y-2 relative">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                          2. Featured Pokémon or Rank Range #1
                        </label>
                        {antiMetaFeat1 && (
                          <button
                            type="button"
                            onClick={() => {
                              setAntiMetaFeat1('');
                              handleGenerateAntiMetaTeams(antiMetaLeague, '', antiMetaFeat2);
                            }}
                            className="text-[10px] text-rose-400 hover:text-rose-300 font-bold"
                          >
                            Clear ×
                          </button>
                        )}
                      </div>
                      <input
                        type="text"
                        value={antiMetaFeat1}
                        onFocus={() => setAntiMetaDropdownSlot(1)}
                        onBlur={() => setTimeout(() => setAntiMetaDropdownSlot((s) => (s === 1 ? null : s)), 180)}
                        onChange={(e) => {
                          setAntiMetaFeat1(e.target.value);
                          setAntiMetaDropdownSlot(1);
                        }}
                        placeholder="Pokémon or rank range (e.g. Feraligatr, 200-, -10, 100-200)..."
                        className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-sky-400"
                      />
                      <div className="flex items-center gap-1 flex-wrap">
                        <span className="text-[9.5px] text-slate-500">Quick Rank Range:</span>
                        {(['-10', '100-200', '200-'] as const).map((rr) => (
                          <button
                            key={`f1-rr-${rr}`}
                            type="button"
                            onClick={() => {
                              setAntiMetaFeat1(rr);
                              setAntiMetaDropdownSlot(null);
                              handleGenerateAntiMetaTeams(antiMetaLeague, rr, antiMetaFeat2);
                            }}
                            className={`px-1.5 py-0.5 rounded text-[9.5px] font-mono font-bold border transition ${
                              antiMetaFeat1.trim() === rr
                                ? 'bg-purple-500/25 border-purple-400 text-purple-200'
                                : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
                            }`}
                          >
                            {rr}
                          </button>
                        ))}
                      </div>
                      {antiMetaDropdownSlot === 1 && feat1Suggestions.length > 0 && (
                        <div className="absolute left-3.5 right-3.5 top-[76px] z-40 max-h-52 overflow-y-auto rounded-xl bg-slate-900 border border-slate-700 shadow-2xl divide-y divide-slate-800">
                          {feat1Suggestions.map((opt) => (
                            <button
                              key={opt.name}
                              type="button"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                setAntiMetaFeat1(opt.name);
                                setAntiMetaDropdownSlot(null);
                                handleGenerateAntiMetaTeams(antiMetaLeague, opt.name, antiMetaFeat2);
                              }}
                              className="w-full px-3 py-2 text-left text-xs hover:bg-slate-800 flex items-center justify-between"
                            >
                              <span className="font-bold text-white">{opt.name}</span>
                              <span className="text-[10px] text-slate-400">
                                {opt.types.join('/')} • CP {opt.cp}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                      <p className="text-[10px] text-slate-400">
                        {feat1RankRange
                          ? `Must include: ${feat1RankRange.label}`
                          : antiMetaFeat1.trim()
                          ? `Must include: ${antiMetaFeat1.trim()}`
                          : '0 picked: full league Anti-Meta scan'}
                      </p>
                    </div>

                    {/* Featured Pokémon / Rank Range #2 (Optional) */}
                    <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-3.5 space-y-2 relative">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                          3. Featured Pokémon or Rank Range #2
                        </label>
                        {antiMetaFeat2 && (
                          <button
                            type="button"
                            onClick={() => {
                              setAntiMetaFeat2('');
                              handleGenerateAntiMetaTeams(antiMetaLeague, antiMetaFeat1, '');
                            }}
                            className="text-[10px] text-rose-400 hover:text-rose-300 font-bold"
                          >
                            Clear ×
                          </button>
                        )}
                      </div>
                      <input
                        type="text"
                        value={antiMetaFeat2}
                        onFocus={() => setAntiMetaDropdownSlot(2)}
                        onBlur={() => setTimeout(() => setAntiMetaDropdownSlot((s) => (s === 2 ? null : s)), 180)}
                        onChange={(e) => {
                          setAntiMetaFeat2(e.target.value);
                          setAntiMetaDropdownSlot(2);
                        }}
                        placeholder="2nd Pokémon or rank range (e.g. 200-, -10, 100-200)..."
                        className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-sky-400"
                      />
                      <div className="flex items-center gap-1 flex-wrap">
                        <span className="text-[9.5px] text-slate-500">Quick Rank Range:</span>
                        {(['-10', '100-200', '200-'] as const).map((rr) => (
                          <button
                            key={`f2-rr-${rr}`}
                            type="button"
                            onClick={() => {
                              setAntiMetaFeat2(rr);
                              setAntiMetaDropdownSlot(null);
                              handleGenerateAntiMetaTeams(antiMetaLeague, antiMetaFeat1, rr);
                            }}
                            className={`px-1.5 py-0.5 rounded text-[9.5px] font-mono font-bold border transition ${
                              antiMetaFeat2.trim() === rr
                                ? 'bg-purple-500/25 border-purple-400 text-purple-200'
                                : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
                            }`}
                          >
                            {rr}
                          </button>
                        ))}
                      </div>
                      {antiMetaDropdownSlot === 2 && feat2Suggestions.length > 0 && (
                        <div className="absolute left-3.5 right-3.5 top-[76px] z-40 max-h-52 overflow-y-auto rounded-xl bg-slate-900 border border-slate-700 shadow-2xl divide-y divide-slate-800">
                          {feat2Suggestions.map((opt) => (
                            <button
                              key={opt.name}
                              type="button"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                setAntiMetaFeat2(opt.name);
                                setAntiMetaDropdownSlot(null);
                                handleGenerateAntiMetaTeams(antiMetaLeague, antiMetaFeat1, opt.name);
                              }}
                              className="w-full px-3 py-2 text-left text-xs hover:bg-slate-800 flex items-center justify-between"
                            >
                              <span className="font-bold text-white">{opt.name}</span>
                              <span className="text-[10px] text-slate-400">
                                {opt.types.join('/')} • CP {opt.cp}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                      <p className="text-[10px] text-slate-400">
                        {feat2RankRange
                          ? `Must include: ${feat2RankRange.label}`
                          : antiMetaFeat2.trim()
                          ? `Must include: ${antiMetaFeat2.trim()}`
                          : 'Leave blank for 0 or 1 featured Pokémon'}
                      </p>
                    </div>
                  </div>

                  {/* Step 2b & 2c: Display Best ABB, ABC & Duo-Core Anti-Meta Team Options (Tier-Gated in v7.00) */}
                  {(() => {
                    const maxPerArch =
                      webMembershipTier === 'pro' || webMembershipTier === 'vip'
                        ? 5
                        : webMembershipTier === 'supporter'
                        ? 2
                        : 1;
                    const isProOrVipTier = webMembershipTier === 'pro' || webMembershipTier === 'vip';
                    if (!antiMetaResult || isGeneratingAntiMeta) {
                      return (
                        <div className="bg-slate-950/90 border border-purple-500/40 rounded-xl p-6 text-center space-y-2 animate-pulse">
                          <div className="text-sm font-extrabold text-purple-300">
                            ⚡ Simulating {antiMetaLeague} Top-100 Role-Weighted Meta &amp; Alternate Movesets...
                          </div>
                          <div className="text-xs text-slate-400">
                            Evaluating ABB, ABC, and Symmetric Duo-Core lineups against Top 50 Meta Threats &amp; Core Breakers
                          </div>
                        </div>
                      );
                    }
                    const rawResult = antiMetaResult;
                    const currentResult = {
                      ...rawResult,
                      top5AbbTeams: rawResult.top5AbbTeams.slice(0, maxPerArch),
                      top5AbcTeams: rawResult.top5AbcTeams.slice(0, maxPerArch),
                      top5DuoTeams: (rawResult.top5DuoTeams || []).slice(0, maxPerArch)
                    };

                    const renderOptionCard = (opt: AntiMetaTeamOption) => {
                      const machBadge = getMachineBrTierInfo(opt.machineAggBr, machineBrThresholds);
                      const leadBadge = getSingleSlotBrTierInfo(opt.leadAggBr, tierThresholds);
                      const swapBadge = getSingleSlotBrTierInfo(opt.safeSwapBr, tierThresholds);
                      const closerBadge = getSingleSlotBrTierInfo(opt.closerBr, tierThresholds);
                      const totalMetaDepth = opt.topMetaTargetsTotal || 50;
                      const anyAltMoves = (opt.altMovesetSlots || []).some((s) => s.isAltMoveset);

                      return (
                        <div
                          key={opt.id}
                          className="bg-slate-950/90 border border-slate-800 hover:border-sky-500/60 rounded-xl p-4 space-y-3 transition shadow-md"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                                  opt.archetype === 'ABB'
                                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                    : opt.archetype === 'DUO'
                                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                    : 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                                }`}
                              >
                                #{opt.rank} {opt.archetype === 'DUO' ? 'DUO-CORE' : opt.archetype}
                              </span>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${machBadge.badgeClass}`}>
                                Core BR {opt.machineAggBr}
                              </span>
                              <span className="text-[10px] text-emerald-400 font-semibold">
                                Beats {opt.topMetaWinsCount}/{totalMetaDepth} Top Meta
                              </span>
                              {anyAltMoves && (
                                <span className="px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-400/50 text-amber-300 text-[9px] font-extrabold">
                                  ⚡ Alt Moveset Simmed
                                </span>
                              )}
                            </div>

                            <button
                              type="button"
                              onClick={() => handleSelectAntiMetaTeamOption(opt)}
                              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold text-[11px] flex items-center gap-1.5 shadow transition shrink-0"
                              title={`Create "${defaultPreviewName}" and open Edit Team modal`}
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Use &amp; Edit Team</span>
                            </button>
                          </div>

                          {/* 3 Team Slots */}
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            {opt.pokemon.map((mon, sIdx) => {
                              const roleTag =
                                opt.archetype === 'ABB'
                                  ? sIdx === 0
                                    ? '[A] Lead'
                                    : sIdx === 1
                                    ? '[B1] Bait Swap'
                                    : '[B2] Sweeper'
                                  : opt.archetype === 'DUO'
                                  ? sIdx === 0
                                    ? '[Core 1] Lead'
                                    : sIdx === 1
                                    ? '[Pivot] Safe Swap'
                                    : '[Core 2] Co-Core'
                                  : sIdx === 0
                                  ? '[Lead]'
                                  : sIdx === 1
                                  ? '[Safe Swap]'
                                  : '[Closer]';
                              const roleBr =
                                sIdx === 0 ? opt.leadAggBr : sIdx === 1 ? opt.safeSwapBr : opt.closerBr;
                              const roleBadge =
                                sIdx === 0 ? leadBadge : sIdx === 1 ? swapBadge : closerBadge;
                              const isFeat = opt.featuredNamesIncluded.some(
                                (fn) => fn.toLowerCase() === mon.name.toLowerCase()
                              );
                              const featRankNum = opt.featuredRankMap?.[mon.name];
                              const altInfo = opt.altMovesetSlots?.[sIdx];
                              const isAltMove = Boolean(altInfo?.isAltMoveset);

                              return (
                                <div
                                  key={`${opt.id}-slot-${sIdx}`}
                                  className={`p-2.5 rounded-lg border ${
                                    isFeat
                                      ? 'bg-purple-950/30 border-purple-500/50'
                                      : isAltMove
                                      ? 'bg-amber-950/20 border-amber-500/40'
                                      : 'bg-slate-900/90 border-slate-800'
                                  }`}
                                >
                                  <div className="flex items-center justify-between gap-1">
                                    <span className="text-[10px] font-bold text-slate-400">{roleTag}</span>
                                    <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${roleBadge.badgeClass}`}>
                                      {roleBr} BR
                                    </span>
                                  </div>
                                  <div className="font-bold text-xs text-white mt-1 truncate flex items-center gap-1 flex-wrap">
                                    <span>{mon.name}</span>
                                    {isFeat && (
                                      <span className="text-[9px] px-1 rounded bg-purple-500/30 text-purple-200 font-extrabold">
                                        ★ Pick{featRankNum ? ` (#${featRankNum})` : ''}
                                      </span>
                                    )}
                                    {isAltMove && (
                                      <span
                                        className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/25 border border-amber-400/50 text-amber-200 font-extrabold"
                                        title={`Standard: ${altInfo?.standardFastMove} + ${altInfo?.standardCharged1}/${altInfo?.standardCharged2}`}
                                      >
                                        {isProOrVipTier
                                          ? `⚡ Alt Moveset${altInfo && altInfo.roleBrDelta > 0 ? ` (+${altInfo.roleBrDelta} BR)` : ''}`
                                          : `🔒 ⚡ Pro Alt Moveset${altInfo && altInfo.roleBrDelta > 0 ? ` (+${altInfo.roleBrDelta} BR)` : ''} Available`}
                                      </span>
                                    )}
                                  </div>
                                  <div
                                    className={`text-[10px] truncate mt-0.5 ${
                                      isAltMove && isProOrVipTier ? 'text-amber-300 font-semibold' : 'text-slate-400'
                                    }`}
                                  >
                                    {isAltMove && !isProOrVipTier && altInfo
                                      ? `${altInfo.standardFastMove} • ${altInfo.standardCharged1}/${altInfo.standardCharged2}`
                                      : `${mon.fastMove} • ${mon.chargedMove1}/${mon.chargedMove2}`}
                                    {resolveMegaPlusMove(mon.name, opt.league) ? ` [+ ${resolveMegaPlusMove(mon.name, opt.league)}]` : ''}
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {/* Key Wins, Key Threats & Core Breakers Breakdown */}
                          <div className="space-y-1 text-[10px] pt-1.5 border-t border-slate-900">
                            <p className="text-slate-400 leading-relaxed">{opt.synergySummary}</p>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 pt-1">
                              <div className="bg-emerald-950/25 border border-emerald-500/30 rounded-lg px-2 py-1">
                                <span className="font-bold text-emerald-400 block">
                                  ✅ Key Wins ({opt.topMetaWinsCount}/{totalMetaDepth})
                                </span>
                                <span className="text-slate-300">
                                  {opt.keyMetaTargetsBeaten.length > 0
                                    ? opt.keyMetaTargetsBeaten.slice(0, 4).join(', ')
                                    : 'Balanced field coverage'}
                                </span>
                              </div>
                              <div className="bg-amber-950/25 border border-amber-500/30 rounded-lg px-2 py-1">
                                <span className="font-bold text-amber-300 block">
                                  ⚠️ Key Threats (Slot 1/2/3 BR)
                                </span>
                                <span className="text-slate-300 font-mono text-[9.5px]">
                                  {opt.keyThreats && opt.keyThreats.length > 0
                                    ? opt.keyThreats.slice(0, 4).join(', ')
                                    : 'No severe lead+backline threats'}
                                </span>
                              </div>
                              <div className="bg-rose-950/25 border border-rose-500/30 rounded-lg px-2 py-1">
                                <span className="font-bold text-rose-300 block">
                                  🚨 Core Breakers (Slot 1/2/3 BR)
                                </span>
                                <span className="text-slate-300 font-mono text-[9.5px]">
                                  {opt.coreBreakers && opt.coreBreakers.length > 0
                                    ? opt.coreBreakers.slice(0, 4).join(', ')
                                    : 'None (0 in Top 50 Meta)'}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    };

                    const displayedMetaList = currentResult.top50MetaList || currentResult.top25MetaList || [];
                    const duoTeamsList = currentResult.top5DuoTeams || [];

                    return (
                      <div className="space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300 bg-slate-950/70 px-3.5 py-2 rounded-xl border border-slate-800">
                          <span>
                            Showing <strong className="text-amber-300">Top {currentResult.top5AbbTeams.length} ABB</strong>,{' '}
                            <strong className="text-sky-300">Top {currentResult.top5AbcTeams.length} ABC</strong> &amp;{' '}
                            <strong className="text-emerald-300">Top {duoTeamsList.length} Duo-Core</strong> Anti-Meta Teams for{' '}
                            <strong className="text-white">{currentResult.league}</strong>
                            {currentResult.featuredPokemon.length > 0
                              ? ` featuring ${currentResult.featuredPokemon.join(' + ')}`
                              : ' (0 featured picks — full Top-100 role-weighted meta optimization)'}
                            {' • '}
                            <span className="text-purple-300">
                              {currentResult.candidatesEvaluated} trios + {currentResult.movesetCombosSimulated || 0} alt movesets simmed
                            </span>
                          </span>
                          <span className="text-[11px] text-emerald-400 font-mono">
                            Default Team Name on Select: &quot;{defaultPreviewName}&quot;
                          </span>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                          {/* Section 1: Best 5 ABB Teams */}
                          <div className="space-y-3">
                            <div className="flex items-center justify-between border-b border-amber-500/30 pb-2">
                              <h4 className="text-sm font-extrabold text-amber-300 flex items-center gap-2">
                                <span>🛡️ Best 5 ABB Anti-Meta Lineups (Bait &amp; Sweep)</span>
                              </h4>
                              <span className="text-[10px] text-slate-400">
                                Lead A covers shared B1/B2 weakness
                              </span>
                            </div>
                            {currentResult.top5AbbTeams.map((opt) => renderOptionCard(opt))}
                          </div>

                          {/* Section 2: Best 5 ABC Teams */}
                          <div className="space-y-3">
                            <div className="flex items-center justify-between border-b border-sky-500/30 pb-2">
                              <h4 className="text-sm font-extrabold text-sky-300 flex items-center gap-2">
                                <span>⚔️ Best 5 ABC Anti-Meta Lineups (Balanced Core)</span>
                              </h4>
                              <span className="text-[10px] text-slate-400">
                                Diversified Lead / Safe Swap / Closer
                              </span>
                            </div>
                            {currentResult.top5AbcTeams.map((opt) => renderOptionCard(opt))}
                          </div>
                        </div>

                        {/* Section 3: Best 5 Duo-Core Teams */}
                        {duoTeamsList.length > 0 && (
                          <div className="space-y-3 pt-2">
                            <div className="flex flex-wrap items-center justify-between border-b border-emerald-500/30 pb-2 gap-2">
                              <h4 className="text-sm font-extrabold text-emerald-300 flex items-center gap-2">
                                <span>☯️ Best 5 Duo-Core Anti-Meta Lineups (Symmetric Yin &amp; Yang Core + Safe Swap Pivot)</span>
                              </h4>
                              <span className="text-[10px] text-slate-400">
                                Slot 1 &amp; Slot 3 cover each other&apos;s weaknesses (interchangeable Lead/Co-Core) + Slot 2 Safe Switch
                              </span>
                            </div>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                              {duoTeamsList.map((opt) => renderOptionCard(opt))}
                            </div>
                          </div>
                        )}

                        {!isProOrVipTier && (
                          <div className="bg-indigo-950/60 border border-amber-400/50 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="space-y-1">
                              <h5 className="text-xs font-extrabold text-amber-300">
                                🏆 Unlock All 15 Anti-Meta Teams, Limited Cups &amp; ⚡ Alternate Moveset Role Synthesis
                              </h5>
                              <p className="text-[11px] text-slate-300">
                                Free tier shows 1 team per archetype (GL/ML) with standard movesets. Upgrade to <strong>Lifetime Supporter ($2)</strong> for the 🛡️ Attack Incoming! Shield Decision Overlay + Ultra League + 2 teams/archetype + Unlimited Battle Log History, or <strong>Legend Pro ($3 First-Season Intro / $6 Season Pass)</strong> for all 15 teams, Limited/Mega Cups, and ⚡ Alt Movesets!
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => setShowMembershipModal(true)}
                              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shrink-0 transition shadow-lg"
                            >
                              🔑 Unlock Tiers / Enter Key
                            </button>
                          </div>
                        )}

                        {/* Bottom Card: Top 50 Meta Determined by SilphScope with Meta BR in Parentheses */}
                        <div className="bg-slate-950/85 border border-slate-800 rounded-xl p-4 space-y-2.5">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <h5 className="text-xs font-extrabold text-purple-300 uppercase tracking-wider">
                              🎯 Top 50 {currentResult.league} Meta Determined by SilphScope (Meta Battle Ranking in Parentheses • All 50 Used for Key Wins, Threats &amp; Core Breakers Audit)
                            </h5>
                            <span className="text-[10px] text-slate-400">
                              {currentResult.metaSummaryLabel || 'Built against Top-100 Synthetic Role-Weighted Meta blended with Season Logs'}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {displayedMetaList.map((entry) => (
                              <span
                                key={`top50-meta-${entry.rank}-${entry.name}`}
                                className="px-2 py-1 rounded-lg bg-slate-900 border border-slate-800 text-[10px] text-slate-200 font-medium"
                              >
                                <strong className="text-purple-400 font-mono">#{entry.rank}</strong> {entry.name}{' '}
                                <span className="text-sky-300 font-mono">
                                  ({entry.metaBr ?? 500} BR • {entry.weightPct}%)
                                </span>
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              );
            })()}

            {/* 2-Tier League & Cup Filter Tabs for My Teams (Tier 1: CP Range -> Tier 2: Cup / Format + Old Cups) */}
            {(() => {
              const modeActiveCups = (appCombatMode === 'show6' ? enabledShow6Leagues : enabledGblLeagues).filter(
                (lg) => !isOldCupForMode(lg, appCombatMode)
              );
              const formatCupSubLabel = (lg: string) => {
                const u = lg.trim().toUpperCase();
                if (u === 'GREAT LEAGUE' || u === 'ULTRA LEAGUE' || u === 'MASTER LEAGUE') return 'Open / Standard';
                if (u.includes('MEGA')) return `Mega (${lg})`;
                if (lg === 'Battle Frontier (Spectral)' || u === 'BATTLE FRONTIER (SPECTRAL)') return 'BF Spectral';
                if (lg === 'Battle Frontier (Cauldron)' || u === 'BATTLE FRONTIER (CAULDRON)') return 'BF Cauldron';
                if (lg === 'Battle Frontier (Master)' || u === 'BATTLE FRONTIER (MASTER)') return 'BF Master';
                return lg;
              };
              const sortTierCups = (cups: string[]) =>
                [...cups].sort((a, b) => {
                  const rank = (x: string) => {
                    const u = x.trim().toUpperCase();
                    if (u === 'GREAT LEAGUE' || u === 'ULTRA LEAGUE' || u === 'MASTER LEAGUE') return 0;
                    if (u.includes('MEGA')) return 1;
                    return 2;
                  };
                  const ra = rank(a);
                  const rb = rank(b);
                  return ra !== rb ? ra - rb : a.localeCompare(b);
                });

              const tier1Options: Array<{ key: 'ALL' | 'GREAT' | 'ULTRA' | 'MASTER'; label: string; count: number }> = [
                { key: 'ALL', label: 'All CP Tiers', count: presets.length },
                {
                  key: 'GREAT',
                  label: 'Great (≤1500)',
                  count: presets.filter((p) => resolveLeagueCpTier(p.league) === 'GREAT').length
                },
                {
                  key: 'ULTRA',
                  label: 'Ultra (2500)',
                  count: presets.filter((p) => resolveLeagueCpTier(p.league) === 'ULTRA').length
                },
                {
                  key: 'MASTER',
                  label: 'Master (10000)',
                  count: presets.filter((p) => resolveLeagueCpTier(p.league) === 'MASTER').length
                }
              ];

              const tierPresets =
                activeTeamsCpTierFilter === 'ALL'
                  ? presets
                  : presets.filter((p) => resolveLeagueCpTier(p.league) === activeTeamsCpTierFilter);
              const tierActiveCups =
                activeTeamsCpTierFilter === 'ALL'
                  ? []
                  : sortTierCups(modeActiveCups.filter((lg) => resolveLeagueCpTier(lg) === activeTeamsCpTierFilter));
              const tierOldCupsCount =
                activeTeamsCpTierFilter === 'ALL'
                  ? 0
                  : tierPresets.filter((p) => isOldCupForMode(p.league, appCombatMode)).length;
              const tierName =
                activeTeamsCpTierFilter === 'GREAT'
                  ? 'Great'
                  : activeTeamsCpTierFilter === 'ULTRA'
                  ? 'Ultra'
                  : 'Master';

              return (
                <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 space-y-2.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 mr-1">
                        {appCombatMode === 'show6' ? '🏛️ Tier 1 — CP Range:' : '🛡️ Tier 1 — CP Range:'}
                      </span>
                      {tier1Options.map((t1) => {
                        const isSelected = activeTeamsCpTierFilter === t1.key;
                        return (
                          <button
                            key={t1.key}
                            type="button"
                            onClick={() => {
                              setActiveTeamsCpTierFilter(t1.key);
                              setActiveTeamsLeagueFilter(t1.key === 'ALL' ? 'ALL' : (`TIER:${t1.key}` as LeagueType));
                            }}
                            className={`px-3 py-1.5 rounded-xl text-xs font-extrabold border transition flex items-center gap-1.5 ${
                              isSelected
                                ? 'bg-sky-500 text-slate-950 border-sky-400 shadow'
                                : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                            }`}
                          >
                            <span>{t1.label}</span>
                            <span
                              className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                                isSelected
                                  ? 'bg-slate-950/25 text-slate-950 font-black'
                                  : 'bg-slate-800 text-slate-400'
                              }`}
                            >
                              {t1.count}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab('settings')}
                      className="text-[11px] font-bold text-purple-300 hover:text-purple-200 underline shrink-0"
                    >
                      ⚙️ + Pin PvPoke Limited Metas in Settings
                    </button>
                  </div>

                  {activeTeamsCpTierFilter !== 'ALL' && (
                    <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-slate-800/80">
                      <span className="text-[10.5px] font-extrabold uppercase tracking-wider text-emerald-400 mr-1">
                        🏆 Tier 2 — {tierName} Cup:
                      </span>
                      <button
                        type="button"
                        onClick={() => setActiveTeamsLeagueFilter(`TIER:${activeTeamsCpTierFilter}` as LeagueType)}
                        className={`px-2.5 py-1 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 ${
                          activeTeamsLeagueFilter === `TIER:${activeTeamsCpTierFilter}` || activeTeamsLeagueFilter === 'ALL'
                            ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow'
                            : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <span>All {tierName} Cups</span>
                        <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-slate-950/25">
                          {tierPresets.length}
                        </span>
                      </button>
                      {tierActiveCups.map((lg) => {
                        const count = tierPresets.filter((p) => p.league.toLowerCase() === lg.toLowerCase()).length;
                        const isSelected = activeTeamsLeagueFilter.toLowerCase() === lg.toLowerCase();
                        return (
                          <button
                            key={lg}
                            type="button"
                            onClick={() => setActiveTeamsLeagueFilter(lg)}
                            className={`px-2.5 py-1 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 ${
                              isSelected
                                ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow'
                                : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                            }`}
                          >
                            <span>{formatCupSubLabel(lg)}</span>
                            <span
                              className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                                isSelected
                                  ? 'bg-slate-950/25 text-slate-950 font-black'
                                  : 'bg-slate-800 text-slate-400'
                              }`}
                            >
                              {count}
                            </span>
                          </button>
                        );
                      })}
                      {(tierOldCupsCount > 0 || activeTeamsLeagueFilter === `OLD_CUPS:${activeTeamsCpTierFilter}`) && (
                        <button
                          type="button"
                          onClick={() => setActiveTeamsLeagueFilter(`OLD_CUPS:${activeTeamsCpTierFilter}` as LeagueType)}
                          title={`Teams from unsynced/unchecked or expired >4w ${tierName} cups`}
                          className={`px-2.5 py-1 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 ${
                            activeTeamsLeagueFilter === `OLD_CUPS:${activeTeamsCpTierFilter}`
                              ? 'bg-amber-500 text-slate-950 border-amber-400 shadow'
                              : 'bg-slate-950 border-amber-500/40 text-amber-300 hover:border-amber-400'
                          }`}
                        >
                          <span>🗄️ Old Cups</span>
                          <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-amber-500/20">
                            {tierOldCupsCount}
                          </span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Presets Grid (Unified Anti-Meta Generator Look & Feel + Key Wins / Threats / Core Breakers Summary) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {presets
                .map((preset, presetIdx) => ({ preset, presetIdx }))
                .filter(({ preset }) =>
                  matchesTwoTierLeagueFilter(
                    preset.league,
                    activeTeamsCpTierFilter,
                    activeTeamsLeagueFilter,
                    appCombatMode
                  )
                )
                .map(({ preset, presetIdx }) => {
                const isSelected = preset.id === selectedPresetId;
                const isDragged = draggedPresetIndex === presetIdx;
                const isDragOver = dragOverPresetIndex === presetIdx && draggedPresetIndex !== presetIdx;
                const arch: TeamArchetype = preset.archetype || 'ABC';
                const leadBr = preset.leadAggBr ?? 500;
                const machBr = preset.machineAggBr ?? 580;
                const safeSwapBr = preset.safeSwapBr ?? 500;
                const closerSwapBr = preset.closerSwapBr ?? 500;
                const leadTierInfo = getSingleSlotBrTierInfo(leadBr, tierThresholds);
                const machTierInfo = getMachineBrTierInfo(machBr, machineBrThresholds);
                const slot2SwapTierInfo = getSingleSlotBrTierInfo(safeSwapBr, tierThresholds);
                const slot3SwapTierInfo = getSingleSlotBrTierInfo(closerSwapBr, tierThresholds);
                const totalMetaDepth = preset.topMetaTargetsTotal || 50;
                const topWinsCount = preset.topMetaWinsCount ?? 0;

                return (
                  <div
                    key={preset.id}
                    draggable
                    onDragStart={(e) => {
                      setDraggedPresetIndex(presetIdx);
                      e.dataTransfer.effectAllowed = 'move';
                      e.dataTransfer.setData('text/plain', String(presetIdx));
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                      if (dragOverPresetIndex !== presetIdx) {
                        setDragOverPresetIndex(presetIdx);
                      }
                    }}
                    onDragLeave={() => {
                      if (dragOverPresetIndex === presetIdx) {
                        setDragOverPresetIndex(null);
                      }
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      const fromIdx =
                        draggedPresetIndex !== null
                          ? draggedPresetIndex
                          : parseInt(e.dataTransfer.getData('text/plain'), 10);
                      if (!Number.isNaN(fromIdx) && fromIdx !== presetIdx) {
                        handleMovePreset(fromIdx, presetIdx);
                      }
                      setDraggedPresetIndex(null);
                      setDragOverPresetIndex(null);
                    }}
                    onDragEnd={() => {
                      setDraggedPresetIndex(null);
                      setDragOverPresetIndex(null);
                    }}
                    className={`rounded-2xl p-5 border transition-all flex flex-col justify-between cursor-grab active:cursor-grabbing space-y-3 ${
                      isDragged ? 'opacity-45 scale-[0.98]' : ''
                    } ${
                      isDragOver
                        ? 'ring-2 ring-amber-400 border-amber-400 bg-slate-900'
                        : isSelected
                        ? 'bg-gradient-to-b from-sky-950/60 to-slate-900 border-sky-400 shadow-xl shadow-sky-500/10'
                        : 'bg-slate-950/90 border-slate-800 hover:border-sky-500/60 shadow-md'
                    }`}
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className="text-slate-500 hover:text-slate-300 cursor-grab active:cursor-grabbing p-0.5 rounded"
                            title="Drag to rearrange team preset order"
                          >
                            <GripVertical className="w-4 h-4" />
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${
                            preset.league === 'MEGA MASTER LEAGUE'
                              ? 'bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/30'
                              : preset.league === 'MASTER LEAGUE'
                              ? 'bg-purple-500/10 text-purple-300 border-purple-500/20'
                              : preset.league === 'ULTRA LEAGUE'
                              ? 'bg-amber-500/10 text-amber-300 border-amber-500/20'
                              : 'bg-sky-500/15 text-sky-300 border-sky-400/30'
                          }`}>
                            {preset.league}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-black uppercase border ${
                              arch === 'ABB'
                                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                : arch === 'DUO'
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                : 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                            }`}
                          >
                            #{presetIdx + 1} {arch === 'DUO' ? 'DUO-CORE' : arch}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${machTierInfo.badgeClass}`}>
                            Core BR {machBr}
                          </span>
                          <span className="text-[10px] text-emerald-400 font-semibold">
                            Beats {topWinsCount}/{totalMetaDepth} Top Meta
                          </span>
                        </div>

                        <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end">
                          <button
                            type="button"
                            disabled={presetIdx === 0}
                            onClick={() => handleMovePreset(presetIdx, presetIdx - 1)}
                            className="p-1 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition"
                            title="Move Team Up"
                          >
                            <ArrowUp className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            disabled={presetIdx === presets.length - 1}
                            onClick={() => handleMovePreset(presetIdx, presetIdx + 1)}
                            className="p-1 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition"
                            title="Move Team Down"
                          >
                            <ArrowDown className="w-3 h-3" />
                          </button>
                          {isSelected ? (
                            <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                              <Check className="w-3 h-3" />
                              <span>Active</span>
                            </span>
                          ) : (
                            <button
                              onClick={() => setSelectedPresetId(preset.id)}
                              className="text-xs text-sky-400 hover:text-white font-semibold px-2 py-0.5 rounded bg-slate-800 hover:bg-sky-600 border border-slate-700 transition"
                            >
                              Select
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleAutoDetectSavedPreset(preset.id)}
                            className="text-[11px] text-amber-300 hover:text-slate-950 font-bold px-2 py-0.5 rounded bg-amber-500/15 hover:bg-amber-400 border border-amber-500/40 transition"
                            title="Auto-Detect Style (ABB/ABC/DUO), move Safe Swap to Slot 2, and refresh Key Wins / Threats / Core Breakers summary"
                          >
                            ⚡ Auto-Detect
                          </button>
                          {arch === 'DUO' && (
                            <button
                              type="button"
                              onClick={() => handleSwapSavedPresetSlots(preset.id, 0, 2)}
                              className="text-[11px] text-emerald-300 hover:text-slate-950 font-bold px-2 py-0.5 rounded bg-emerald-500/15 hover:bg-emerald-400 border border-emerald-500/40 transition"
                              title="Duo-Core Yin & Yang Swap: Swap Slot 1 (Core 1 Lead) and Slot 3 (Core 2 Co-Core) to adapt to meta changes"
                            >
                              ☯️ Swap 1⇄3
                            </button>
                          )}
                          <button
                            onClick={() => openEditPresetModal(preset)}
                            className="text-xs text-white font-bold px-2.5 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 transition"
                            title="Edit Team, Moves, IVs, CP, or Clone / Cross-Mode Copy inside the Editor"
                          >
                            ✎ Edit / Clone
                          </button>
                          <button
                            onClick={() => handleDeletePreset(preset.id)}
                            className="text-slate-400 hover:text-rose-400 p-1 rounded hover:bg-rose-500/10 transition"
                            title="Delete Preset"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <h3 className="font-bold text-base text-white">
                          {preset.name}
                        </h3>
                        <span
                          className={`text-[10px] font-mono font-extrabold px-2 py-0.5 rounded border ${leadTierInfo.colorClass}`}
                        >
                          Lead BR: {leadBr} ({leadTierInfo.tier})
                        </span>
                      </div>

                      {/* 3 Team Slots (Clean Summary: Role, Pokemon Name & IVs/CP only) */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {preset.pokemon.map((member, index) => {
                          const roleTag =
                            arch === 'ABB'
                              ? index === 0
                                ? '[A] Lead'
                                : index === 1
                                ? '[B1] Bait Swap'
                                : '[B2] Sweeper'
                              : arch === 'DUO'
                              ? index === 0
                                ? '[Core 1] Lead'
                                : index === 1
                                ? '[Pivot] Safe Swap'
                                : '[Core 2] Co-Core'
                              : index === 0
                              ? '[Lead]'
                              : index === 1
                              ? '[Safe Swap]'
                              : '[Closer]';
                          const slotMetricBr = index === 0 ? leadBr : index === 1 ? safeSwapBr : closerSwapBr;
                          const slotTierInfo =
                            index === 0 ? leadTierInfo : index === 1 ? slot2SwapTierInfo : slot3SwapTierInfo;

                          return (
                            <div
                              key={member.id || index}
                              className="p-2.5 rounded-lg border bg-slate-900/90 border-slate-800"
                            >
                              <div className="flex items-center justify-between gap-1">
                                <span className="text-[10px] font-bold text-slate-400">{roleTag}</span>
                                <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${slotTierInfo.badgeClass}`}>
                                  {slotMetricBr} BR
                                </span>
                              </div>
                              <div className="font-bold text-xs text-white mt-1 truncate">
                                {member.name}
                                {resolveMegaPlusMove(member.name, preset.league) && (
                                  <span
                                    className={`ml-1 text-[9px] font-mono font-bold ${
                                      (member.plusMoveLevel ?? 4) <= 0 ? 'text-slate-400' : 'text-amber-300'
                                    }`}
                                  >
                                    [+ {resolveMegaPlusMove(member.name, preset.league)}{' '}
                                    {(member.plusMoveLevel ?? 4) <= 0 ? 'Off' : `Lv${member.plusMoveLevel ?? 4}`}]
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center justify-between gap-1 mt-1 pt-1 border-t border-slate-800/60 text-[9.5px] font-mono">
                                {member.ivs ? (
                                  <span className="text-emerald-400 font-semibold">IV {member.ivs}</span>
                                ) : (
                                  <span className="text-slate-400">PvPoke IVs</span>
                                )}
                                <span className="text-sky-400 font-bold">CP {member.cp}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Key Wins, Key Threats & Core Breakers Summary Breakdown (No moveset/description clutter) */}
                      <div className="text-[10px] pt-1.5 border-t border-slate-900">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
                          <div className="bg-emerald-950/25 border border-emerald-500/30 rounded-lg px-2 py-1">
                            <span className="font-bold text-emerald-400 block">
                              ✅ Key Wins ({topWinsCount}/{totalMetaDepth})
                            </span>
                            <span className="text-slate-300">
                              {preset.keyMetaTargetsBeaten && preset.keyMetaTargetsBeaten.length > 0
                                ? preset.keyMetaTargetsBeaten.slice(0, 4).join(', ')
                                : 'Balanced field coverage'}
                            </span>
                          </div>
                          <div className="bg-amber-950/25 border border-amber-500/30 rounded-lg px-2 py-1">
                            <span className="font-bold text-amber-300 block">
                              ⚠️ Key Threats (Slot 1/2/3 BR)
                            </span>
                            <span className="text-slate-300 font-mono text-[9.5px]">
                              {preset.keyThreats && preset.keyThreats.length > 0
                                ? preset.keyThreats.slice(0, 4).join(', ')
                                : 'No severe lead+backline threats'}
                            </span>
                          </div>
                          <div className="bg-rose-950/25 border border-rose-500/30 rounded-lg px-2 py-1">
                            <span className="font-bold text-rose-300 block">
                              🚨 Core Breakers (Slot 1/2/3 BR)
                            </span>
                            <span className="text-slate-300 font-mono text-[9.5px]">
                              {preset.coreBreakers && preset.coreBreakers.length > 0
                                ? preset.coreBreakers.slice(0, 4).join(', ')
                                : 'None (0 in Top 50 Meta)'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Modal Dialog for Creating or Editing Preset & Moves (Team Builder UI with Pop-Down Autocomplete) */}
            {isNewPresetOpen && (
              <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
                <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 my-8">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
                    <h3 className="font-bold text-base text-white flex items-center gap-2">
                      <Plus className="w-4 h-4 text-emerald-400" />
                      <span>{editingPresetId ? 'Edit Team, Moves & IVs' : 'Create Custom GBL Team Preset'}</span>
                    </h3>
                    <button
                      onClick={() => {
                        setIsNewPresetOpen(false);
                        setEditingPresetId(null);
                        setActiveAutocompleteSlot(null);
                      }}
                      className="text-slate-400 hover:text-white text-lg font-bold"
                    >
                      ✕
                    </button>
                  </div>

                  <p className="text-[11px] text-slate-400 mb-3">
                    Type a Pokémon name (e.g. <strong className="text-sky-300">Giratina</strong>, <strong className="text-sky-300">Ninetales</strong>, <strong className="text-sky-300">Feraligatr</strong>, <strong className="text-sky-300">Zacian</strong>) to open the autocomplete menu with <strong className="text-purple-300">Shadow</strong> and <strong className="text-amber-300">Alternate Form</strong> options and auto-fill PvPoke recommended moves!
                  </p>

                  <form onSubmit={handleCreatePreset} className="space-y-3.5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">
                          Preset Name
                        </label>
                        <input
                          type="text"
                          value={newPresetName}
                          onChange={(e) => setNewPresetName(e.target.value)}
                          placeholder="e.g. Great League Team"
                          className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-400"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">
                          League Category
                        </label>
                        <select
                          value={newPresetLeague}
                          onChange={(e) => {
                            const nextL = e.target.value as LeagueType;
                            setNewPresetLeague(nextL);
                            if (!editingPresetId) {
                              applyLeagueTop3TemplateToForm(nextL);
                            } else {
                              // Rescale existing 3 Pokémon CPs and IVs for the newly selected league
                              const currentMembers = buildModalMembersArray();
                              const rescaled = rescaleTeamMembersForLeague(currentMembers, nextL);
                              applyOrderedMembersToModalForm(rescaled);
                              setModalAutoDetectSummary(
                                `🔄 Rescaled CPs & default IVs for ${nextL}`
                              );
                            }
                          }}
                          className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-400"
                        >
                          {(appCombatMode === 'show6' ? enabledShow6Leagues : enabledGblLeagues).map((lg) => (
                            <option key={lg} value={lg}>
                              {lg} ({getLeagueCpCap(lg) >= 10000 ? 'No CP Limit' : `Max ${getLeagueCpCap(lg)} CP`})
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Relocated Clone & Cross-Mode Copy Panel Inside Edit Team Card */}
                    <div className="p-3.5 rounded-xl bg-slate-950/90 border border-emerald-500/35 space-y-2.5">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <div className="text-xs font-extrabold text-emerald-300 flex items-center gap-1.5">
                            <span>📋 Clone or Copy Team to Any League, Limited Meta, or Mode</span>
                          </div>
                          <p className="text-[10.5px] text-slate-400">
                            Creates a brand-new independent team entry (with auto-rescaled CP &amp; legal moves) and switches the editor to the new copy.
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-[10px] font-bold text-slate-400 uppercase">Target Format:</span>
                          <select
                            value={modalCloneTargetLeague}
                            onChange={(e) => setModalCloneTargetLeague(e.target.value as LeagueType)}
                            className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-bold text-white"
                          >
                            {allEnabledLeaguesCombined.map((lg) => (
                              <option key={lg} value={lg}>
                                {lg} ({getLeagueCpCap(lg) >= 10000 ? 'Uncapped' : `${getLeagueCpCap(lg)} CP`})
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            const currentObj: TeamPreset =
                              presets.find((p) => p.id === editingPresetId) || {
                                id: editingPresetId || `temp-${Date.now()}`,
                                name: newPresetName.trim() || `${newPresetLeague} Team`,
                                league: newPresetLeague,
                                pokemon: buildModalMembersArray(),
                                combatMode: appCombatMode
                              };
                            handleClonePreset3(currentObj, modalCloneTargetLeague);
                          }}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs transition shadow"
                        >
                          📋 Clone in {appCombatMode === 'show6' ? 'Show 6 (Trio)' : 'Standard GBL'} ({modalCloneTargetLeague.split(' ')[0]})
                        </button>

                        {appCombatMode === 'gbl' ? (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                const currentObj: TeamPreset =
                                  presets.find((p) => p.id === editingPresetId) || {
                                    id: editingPresetId || `temp-${Date.now()}`,
                                    name: newPresetName.trim() || `${newPresetLeague} Team`,
                                    league: newPresetLeague,
                                    pokemon: buildModalMembersArray(),
                                    combatMode: 'gbl'
                                  };
                                handleCopyPreset3CrossMode(currentObj, 'show6_trio', modalCloneTargetLeague);
                              }}
                              className="px-3 py-1.5 rounded-lg bg-sky-500/20 hover:bg-sky-500/35 border border-sky-400/50 text-sky-200 font-bold text-xs transition"
                            >
                              🏛️ Copy to Show 6 Trio (Separate Entry)
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const currentObj: TeamPreset =
                                  presets.find((p) => p.id === editingPresetId) || {
                                    id: editingPresetId || `temp-${Date.now()}`,
                                    name: newPresetName.trim() || `${newPresetLeague} Team`,
                                    league: newPresetLeague,
                                    pokemon: buildModalMembersArray(),
                                    combatMode: 'gbl'
                                  };
                                handleCopyPreset3CrossMode(currentObj, 'show6_autofill6', modalCloneTargetLeague);
                              }}
                              className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/35 border border-amber-400/50 text-amber-200 font-bold text-xs transition"
                            >
                              🏛️ Lock 3 &amp; Auto-Fill Show 6 Roster of 6
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                const currentObj: TeamPreset =
                                  presets.find((p) => p.id === editingPresetId) || {
                                    id: editingPresetId || `temp-${Date.now()}`,
                                    name: newPresetName.trim() || `${newPresetLeague} Trio`,
                                    league: newPresetLeague,
                                    pokemon: buildModalMembersArray(),
                                    combatMode: 'show6'
                                  };
                                handleCopyPreset3CrossMode(currentObj, 'gbl_blind3', modalCloneTargetLeague);
                              }}
                              className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/35 border border-amber-400/50 text-amber-200 font-bold text-xs transition"
                            >
                              🛡️ Copy to Standard GBL Blind 3 (Separate Entry)
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const currentObj: TeamPreset =
                                  presets.find((p) => p.id === editingPresetId) || {
                                    id: editingPresetId || `temp-${Date.now()}`,
                                    name: newPresetName.trim() || `${newPresetLeague} Trio`,
                                    league: newPresetLeague,
                                    pokemon: buildModalMembersArray(),
                                    combatMode: 'show6'
                                  };
                                handleSwapShow6TrioToOpp6(currentObj);
                              }}
                              className="px-3 py-1.5 rounded-lg bg-purple-500/20 hover:bg-purple-500/35 border border-purple-400/50 text-purple-200 font-bold text-xs transition"
                            >
                              ⇄ Swap / Load Trio into Opponent&apos;s 6
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* ABB / ABC Team Style Auto-Detection, Aggregate BR & Key Wins / Threats / Core Breakers Summary Panel */}
                    {(() => {
                      const mLeadTier = getSingleSlotBrTierInfo(modalLiveEvaluation.leadAggBr, tierThresholds);
                      const mMachTier = getMachineBrTierInfo(modalLiveEvaluation.machineAggBr, machineBrThresholds);
                      const mSlot2SwapTier = getSingleSlotBrTierInfo(modalLiveEvaluation.safeSwapBr, tierThresholds);
                      const mSlot3SwapTier = getSingleSlotBrTierInfo(modalLiveEvaluation.closerSwapBr, tierThresholds);
                      const modalTotalMetaDepth = modalLiveEvaluation.topMetaTargetsTotal || 50;
                      const modalWinsCount = modalLiveEvaluation.topMetaWinsCount ?? 0;
                      const modalAnyAltMoves = (modalLiveEvaluation.altMovesetSlots || []).some((s) => s.isAltMoveset);
                      return (
                        <div className="p-3.5 rounded-xl bg-slate-950/90 border border-sky-500/40 space-y-2.5">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span
                                className={`text-[10px] font-black px-2 py-0.5 rounded border uppercase ${
                                  modalLiveEvaluation.archetype === 'ABB'
                                    ? 'bg-amber-500/20 text-amber-300 border-amber-400/50'
                                    : modalLiveEvaluation.archetype === 'DUO'
                                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/50'
                                    : 'bg-sky-500/20 text-sky-300 border-sky-400/50'
                                }`}
                              >
                                Style: [{modalLiveEvaluation.archetype === 'DUO' ? 'DUO-CORE' : modalLiveEvaluation.archetype}]
                              </span>
                              <span
                                className={`text-[10px] font-mono font-extrabold px-2 py-0.5 rounded border ${mMachTier.colorClass}`}
                                title="Core Coverage BR: 3-mon core coverage ceiling across the Top-100 blended season meta"
                              >
                                Core BR: {modalLiveEvaluation.machineAggBr} ({mMachTier.label})
                              </span>
                              <span
                                className={`text-[10px] font-mono font-extrabold px-2 py-0.5 rounded border ${mLeadTier.colorClass}`}
                              >
                                Lead BR: {modalLiveEvaluation.leadAggBr} ({mLeadTier.tier})
                              </span>
                              <span className="text-[10px] text-emerald-400 font-semibold">
                                Beats {modalWinsCount}/{modalTotalMetaDepth} Top Meta
                              </span>
                              {modalAnyAltMoves && (
                                <span className="px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-400/50 text-amber-300 text-[9px] font-extrabold">
                                  ⚡ Alt Moveset
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1 text-[10px]">
                              <span className="text-slate-400">Style Mode:</span>
                              {(['AUTO', 'ABB', 'ABC', 'DUO'] as const).map((mode) => {
                                const isActiveMode =
                                  (mode === 'AUTO' && !manualArchetypeOverride) ||
                                  manualArchetypeOverride === mode;
                                return (
                                  <button
                                    key={mode}
                                    type="button"
                                    onClick={() =>
                                      setManualArchetypeOverride(mode === 'AUTO' ? undefined : mode)
                                    }
                                    className={`px-1.5 py-0.5 rounded font-bold border transition ${
                                      isActiveMode
                                        ? 'bg-sky-500/25 border-sky-400 text-white'
                                        : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
                                    }`}
                                  >
                                    {mode}
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5">
                            <button
                              type="button"
                              onClick={handleAutoDetectAndOrderModal}
                              className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs flex items-center gap-1.5 shadow-md transition"
                            >
                              <Sparkles className="w-3.5 h-3.5" />
                              <span>⚡ Auto-Detect Style &amp; Update Team Summary</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSwapModalSlots(1, 2)}
                              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-mono font-bold text-[11px] flex items-center gap-1 transition"
                              title="Swap Slot 1 (Lead) and Slot 2 (Safe Swap)"
                            >
                              <ArrowLeftRight className="w-3 h-3" />
                              <span>Slot 1 ⇄ 2</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSwapModalSlots(2, 3)}
                              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-mono font-bold text-[11px] flex items-center gap-1 transition"
                              title="Swap Slot 2 (Safe Swap) and Slot 3 (Closer)"
                            >
                              <ArrowLeftRight className="w-3 h-3" />
                              <span>Slot 2 ⇄ 3</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSwapModalSlots(1, 3)}
                              className="px-2.5 py-1.5 rounded-lg bg-emerald-950/60 hover:bg-emerald-900/70 border border-emerald-500/40 text-emerald-200 font-mono font-bold text-[11px] flex items-center gap-1 transition"
                              title="Duo-Core Yin & Yang Swap: Swap Slot 1 (Core 1 Lead) and Slot 3 (Core 2 Co-Core)"
                            >
                              <ArrowLeftRight className="w-3 h-3" />
                              <span>☯️ Slot 1 ⇄ 3</span>
                            </button>
                            <button
                              type="button"
                              onClick={handleSuggestRoleUpgradesModal}
                              disabled={isSuggestingUpgrades}
                              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-extrabold text-xs flex items-center gap-1.5 shadow-md transition"
                              title="Simulate Top 200 league meta candidates (including Shadows & species clause) against the Top 100 meta field to suggest 5 better upgrades for Lead, Safe Swap, and Closer"
                            >
                              <Sparkles className="w-3.5 h-3.5" />
                              <span>
                                {isSuggestingUpgrades
                                  ? '⏳ Simulating Top-200 Meta...'
                                  : '✨ Suggest Top-200 Role Upgrades (5 Per Role)'}
                              </span>
                            </button>
                            <button
                              type="button"
                              onClick={handleOptimizeTeamMovesetsModal}
                              disabled={isSimulatingMovesets}
                              className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-extrabold text-xs flex items-center gap-1.5 shadow-md transition"
                              title="Simulate all legal Fast + Charged move combinations for your current 3 Pokémon using the 75%/25% weighted 9x9 shield matrix and propose the Best 3 alternate movesets with Team Rating and Positional Ranking impact"
                            >
                              <Swords className="w-3.5 h-3.5" />
                              <span>
                                {isSimulatingMovesets
                                  ? '⏳ Simulating Team Move Combos...'
                                  : '🎯 Simulate Moves & Propose Best 3 Alternate Movesets'}
                              </span>
                            </button>
                          </div>

                          {modalMovesetRecommendations && modalMovesetRecommendations.top3OverallMovesets.length > 0 && (
                            <div className="p-2.5 rounded-xl bg-indigo-950/60 border border-indigo-500/40 space-y-1.5">
                              <div className="flex items-center justify-between flex-wrap gap-1 text-[10.5px] font-bold text-indigo-200">
                                <span>
                                  🎯 Best 3 Alternate Movesets Across Current Team ({modalMovesetRecommendations.totalCombosSimulated} Move Combos Simulated • Tap to Apply):
                                </span>
                                <span className="text-slate-400 font-mono text-[10px]">
                                  Baseline Core BR: {modalMovesetRecommendations.baselineEval.machineAggBr} • Lead BR: {modalMovesetRecommendations.baselineEval.leadAggBr}
                                </span>
                              </div>
                              <div className="grid grid-cols-1 gap-1.5">
                                {modalMovesetRecommendations.top3OverallMovesets.map((sug, idx) => (
                                  <button
                                    key={`overall-move-${sug.slotIndex}-${idx}-${sug.proposedFastMove}-${sug.proposedChargedMove1}-${sug.proposedChargedMove2}`}
                                    type="button"
                                    onClick={() => handleApplyMovesetUpgradeChip(sug)}
                                    className="px-2.5 py-1.5 rounded-lg bg-indigo-900/50 hover:bg-indigo-800/70 border border-indigo-400/40 text-left transition flex flex-col sm:flex-row sm:items-center justify-between gap-1"
                                  >
                                    <div className="min-w-0">
                                      <span className="text-[11px] font-extrabold text-indigo-200">
                                        #{idx + 1} Slot {sug.slotIndex + 1} ({sug.roleLabel}) {sug.pokemonName}:{' '}
                                      </span>
                                      <span className="text-[11px] font-mono font-bold text-white">
                                        {sug.proposedFastMove} + {sug.proposedChargedMove1} / {sug.proposedChargedMove2}
                                      </span>
                                    </div>
                                    <div className="text-[10px] font-mono font-bold text-indigo-200 shrink-0 flex items-center gap-2">
                                      <span className={sug.deltaMachineBr >= 0 ? 'text-emerald-300' : 'text-amber-300'}>
                                        Team Core: {sug.newMachineBr} ({sug.deltaMachineBr >= 0 ? `+${sug.deltaMachineBr}` : sug.deltaMachineBr})
                                      </span>
                                      <span>•</span>
                                      <span className={sug.deltaRoleBr >= 0 ? 'text-sky-300' : 'text-amber-300'}>
                                        {sug.roleLabel} Pos BR: {sug.newRoleBr} ({sug.deltaRoleBr >= 0 ? `+${sug.deltaRoleBr}` : sug.deltaRoleBr})
                                      </span>
                                    </div>
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          <div className="text-[10.5px] text-slate-300 font-mono flex flex-wrap items-center justify-between gap-2">
                            <span>
                              Slot 2 Swap BR:{' '}
                              <strong className={mSlot2SwapTier.colorClass.split(' ')[0]}>
                                {modalLiveEvaluation.safeSwapBr} ({mSlot2SwapTier.tier})
                              </strong>{' '}
                              • Slot 3 Closer BR:{' '}
                              <strong className={mSlot3SwapTier.colorClass.split(' ')[0]}>
                                {modalLiveEvaluation.closerSwapBr} ({mSlot3SwapTier.tier})
                              </strong>
                            </span>
                            {modalLiveEvaluation.sharedWeaknesses.length > 0 && (
                              <span className="text-amber-300">
                                Shared B-Pair Weaknesses: {modalLiveEvaluation.sharedWeaknesses.join(', ').toUpperCase()}
                              </span>
                            )}
                          </div>

                          {/* Key Wins, Key Threats & Core Breakers Summary (Matches Anti-Meta Generator) */}
                          <div className="space-y-1 text-[10px] pt-1.5 border-t border-slate-900">
                            {modalLiveEvaluation.synergySummary && (
                              <p className="text-slate-400 leading-relaxed">{modalLiveEvaluation.synergySummary}</p>
                            )}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 pt-1">
                              <div className="bg-emerald-950/25 border border-emerald-500/30 rounded-lg px-2 py-1">
                                <span className="font-bold text-emerald-400 block">
                                  ✅ Key Wins ({modalWinsCount}/{modalTotalMetaDepth})
                                </span>
                                <span className="text-slate-300">
                                  {modalLiveEvaluation.keyMetaTargetsBeaten.length > 0
                                    ? modalLiveEvaluation.keyMetaTargetsBeaten.slice(0, 4).join(', ')
                                    : 'Balanced field coverage'}
                                </span>
                              </div>
                              <div className="bg-amber-950/25 border border-amber-500/30 rounded-lg px-2 py-1">
                                <span className="font-bold text-amber-300 block">
                                  ⚠️ Key Threats (Slot 1/2/3 BR)
                                </span>
                                <span className="text-slate-300 font-mono text-[9.5px]">
                                  {modalLiveEvaluation.keyThreats && modalLiveEvaluation.keyThreats.length > 0
                                    ? modalLiveEvaluation.keyThreats.slice(0, 4).join(', ')
                                    : 'No severe lead+backline threats'}
                                </span>
                              </div>
                              <div className="bg-rose-950/25 border border-rose-500/30 rounded-lg px-2 py-1">
                                <span className="font-bold text-rose-300 block">
                                  🚨 Core Breakers (Slot 1/2/3 BR)
                                </span>
                                <span className="text-slate-300 font-mono text-[9.5px]">
                                  {modalLiveEvaluation.coreBreakers && modalLiveEvaluation.coreBreakers.length > 0
                                    ? modalLiveEvaluation.coreBreakers.slice(0, 4).join(', ')
                                    : 'None (0 in Top 50 Meta)'}
                                </span>
                              </div>
                            </div>
                          </div>

                          {modalAutoDetectSummary && (
                            <div className="p-2 rounded-lg bg-emerald-950/50 border border-emerald-500/40 text-[11px] text-emerald-200">
                              {modalAutoDetectSummary}
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* Slot 1 */}
                    <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl space-y-2">
                      <div className="flex items-center justify-between flex-wrap gap-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-sky-400">
                            Slot 1 ({modalLiveEvaluation.archetype === 'ABB' ? 'Lead A' : modalLiveEvaluation.archetype === 'DUO' ? 'Core 1 Lead' : 'Lead'}, IVs &amp; Moveset)
                          </span>
                          <span
                            className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border ${
                              getSingleSlotBrTierInfo(modalLiveEvaluation.leadAggBr, tierThresholds).colorClass
                            }`}
                          >
                            Lead BR: {modalLiveEvaluation.leadAggBr}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const rec = getRecommendedMovesForPokemon(p1Name, newPresetLeague, p1Ivs);
                            if (rec) {
                              setP1Name(rec.name);
                              setP1Fast(rec.fastMove);
                              setP1C1(rec.chargedMove1);
                              setP1C2(rec.chargedMove2);
                              setP1Cp(rec.cp);
                            }
                          }}
                          className="text-[10px] text-sky-400 hover:text-sky-300 font-semibold"
                        >
                          Auto-Fill PvPoke Moves
                        </button>
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        <div className="col-span-2 relative">
                          <input
                            type="text"
                            value={p1Name}
                            onFocus={() => {
                              setActiveAutocompleteSlot(1);
                              setAutocompleteHighlightIdx(0);
                            }}
                            onChange={(e) => {
                              const val = e.target.value;
                              setP1Name(val);
                              setActiveAutocompleteSlot(1);
                              setAutocompleteHighlightIdx(0);
                              const rec = getRecommendedMovesForPokemon(val, newPresetLeague, p1Ivs);
                              if (rec) {
                                if (!p1Fast.trim()) setP1Fast(rec.fastMove);
                                if (!p1C1.trim()) setP1C1(rec.chargedMove1);
                                if (!p1C2.trim()) setP1C2(rec.chargedMove2);
                                if (!p1Cp || p1Cp <= 0) setP1Cp(rec.cp);
                              }
                            }}
                            onKeyDown={(e) => {
                              if (activeAutocompleteSlot !== 1 || slot1Suggestions.length === 0) return;
                              if (e.key === 'ArrowDown') {
                                e.preventDefault();
                                setAutocompleteHighlightIdx((prev) => (prev + 1) % slot1Suggestions.length);
                              } else if (e.key === 'ArrowUp') {
                                e.preventDefault();
                                setAutocompleteHighlightIdx((prev) => (prev - 1 + slot1Suggestions.length) % slot1Suggestions.length);
                              } else if (e.key === 'Enter') {
                                const chosen = slot1Suggestions[autocompleteHighlightIdx] || slot1Suggestions[0];
                                if (chosen) {
                                  e.preventDefault();
                                  handleSelectAutocompletePokemon(1, chosen);
                                }
                              } else if (e.key === 'Escape') {
                                setActiveAutocompleteSlot(null);
                              }
                            }}
                            onBlur={() => {
                              setTimeout(() => {
                                setActiveAutocompleteSlot((prev) => (prev === 1 ? null : prev));
                              }, 180);
                              handleAutoFillSlotMoves(1, p1Name, newPresetLeague, p1Ivs);
                            }}
                            placeholder="Type Pokémon (e.g. Giratina, Ninetales)"
                            autoComplete="off"
                            className="w-full bg-slate-900 border border-slate-700 focus:border-sky-400 focus:outline-none rounded-lg px-2.5 py-1.5 text-xs text-white"
                            required
                          />
                          {activeAutocompleteSlot === 1 && slot1Suggestions.length > 0 && (
                            <div className="absolute left-0 right-0 top-full mt-1 z-50 max-h-56 overflow-y-auto rounded-xl bg-slate-900 border border-sky-500/50 shadow-2xl divide-y divide-slate-800/80">
                              {slot1Suggestions.map((opt, idx) => (
                                <button
                                  key={opt.name}
                                  type="button"
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    handleSelectAutocompletePokemon(1, opt);
                                  }}
                                  className={`w-full px-2.5 py-1.5 text-left flex items-center justify-between gap-2 transition ${
                                    idx === autocompleteHighlightIdx
                                      ? 'bg-sky-500/25 text-white'
                                      : 'hover:bg-slate-800/90 text-slate-200'
                                  }`}
                                >
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="font-bold text-xs text-white truncate">{opt.name}</span>
                                      <span
                                        className={`text-[9px] font-bold px-1.5 py-0.2 rounded border uppercase ${
                                          opt.isShadow
                                            ? 'bg-purple-500/25 text-purple-200 border-purple-400/50'
                                            : opt.isAlternateForm
                                            ? 'bg-amber-500/20 text-amber-200 border-amber-400/40'
                                            : 'bg-slate-800 text-slate-300 border-slate-700'
                                        }`}
                                      >
                                        {opt.formBadge}
                                      </span>
                                    </div>
                                    <div className="text-[10px] text-slate-400 truncate">
                                      {opt.fastMove} • {opt.chargedMove1} / {opt.chargedMove2}
                                      {resolveMegaPlusMove(opt.name, newPresetLeague) ? ` [+ ${resolveMegaPlusMove(opt.name, newPresetLeague)}]` : ''}
                                    </div>
                                  </div>
                                  <span className="text-[10px] font-mono font-bold text-sky-400 shrink-0">
                                    CP {opt.cp}
                                  </span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        <input
                          type="number"
                          value={p1Cp || ''}
                          onChange={(e) => setP1Cp(parseInt(e.target.value) || 0)}
                          placeholder="CP (Auto)"
                          className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                        />
                        <input
                          type="text"
                          value={p1Ivs}
                          onChange={(e) => setP1Ivs(e.target.value)}
                          placeholder="IVs (opt)"
                          title="Optional Atk/Def/HP IVs (e.g. 0/15/15). Defaults to PvPoke IVs if blank."
                          className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white"
                        />
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <input
                          type="text"
                          value={p1Fast}
                          onChange={(e) => setP1Fast(e.target.value)}
                          placeholder="Fast Move (Auto)"
                          className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-[11px] text-white"
                        />
                        <input
                          type="text"
                          value={p1C1}
                          onChange={(e) => setP1C1(e.target.value)}
                          placeholder="Charged 1 (Auto)"
                          className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-[11px] text-white"
                        />
                        <input
                          type="text"
                          value={p1C2}
                          onChange={(e) => setP1C2(e.target.value)}
                          placeholder="Charged 2 (Auto)"
                          className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-[11px] text-white"
                        />
                      </div>
                      {resolveMegaPlusMove(p1Name, newPresetLeague) && (
                        <div className="px-2.5 py-1.5 rounded-lg bg-purple-950/60 border border-purple-500/50 space-y-1.5">
                          <div className="flex items-center justify-between gap-2 flex-wrap text-[10.5px] font-mono font-bold">
                            <span className={p1PlusLevel <= 0 ? 'text-slate-400' : 'text-purple-200'}>
                              🔥 +3rd Move: {resolveMegaPlusMove(p1Name, newPresetLeague)} •{' '}
                              {p1PlusLevel <= 0
                                ? 'Off (Not Unlocked)'
                                : `Lv${p1PlusLevel} (${(1.0 + (p1PlusLevel - 1) * 0.1).toFixed(1)}x Power)`}
                            </span>
                            <span className="text-[9.5px] text-amber-300/90">Opp Assumed = Lv4 (1.3x)</span>
                          </div>
                          <div className="grid grid-cols-5 gap-1">
                            {[
                              { lv: 0, label: 'Off' },
                              { lv: 1, label: 'Lv1 (1.0x)' },
                              { lv: 2, label: 'Lv2 (1.1x)' },
                              { lv: 3, label: 'Lv3 (1.2x)' },
                              { lv: 4, label: 'Lv4 (1.3x)' }
                            ].map((opt) => {
                              const active = p1PlusLevel === opt.lv;
                              return (
                                <button
                                  key={`p1-plus-${opt.lv}`}
                                  type="button"
                                  onClick={() => setP1PlusLevel(opt.lv)}
                                  className={`py-1 px-1 rounded text-[9.5px] font-mono font-bold border transition ${
                                    active
                                      ? opt.lv === 0
                                        ? 'bg-rose-600/80 border-rose-400 text-white'
                                        : 'bg-purple-600 border-purple-300 text-white shadow'
                                      : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'
                                  }`}
                                >
                                  {opt.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      {modalRoleRecommendations && (
                        <div className="pt-1.5 border-t border-slate-800/80 space-y-1.5">
                          <div className="flex items-center justify-between text-[10px] font-bold text-emerald-300">
                            <span>✨ Top 5 Recommended Lead Upgrades (Top-200 Meta • One-Tap Replace):</span>
                            <span className="text-slate-400 font-mono">Current Lead BR: {modalRoleRecommendations.currentLeadBr}</span>
                          </div>
                          {modalRoleRecommendations.slot1LeadUpgrades.length === 0 ? (
                            <div className="text-[10.5px] text-emerald-400 font-semibold">
                              ✅ Optimal Lead — No higher-scoring Top-200 upgrade found!
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                              {modalRoleRecommendations.slot1LeadUpgrades.map((sug, idx) => (
                                <button
                                  key={sug.candidate.name}
                                  type="button"
                                  onClick={() => handleApplyRoleUpgradeChip(1, sug)}
                                  className="px-2 py-1.5 rounded-lg bg-emerald-950/70 hover:bg-emerald-900/80 border border-emerald-500/50 text-left transition flex flex-col justify-between gap-0.5"
                                  title={`${sug.summaryBadge} • Moves: ${sug.candidate.fastMove} + ${sug.candidate.chargedMove1}/${sug.candidate.chargedMove2}${resolveMegaPlusMove(sug.candidate.name, newPresetLeague) ? ` + ${resolveMegaPlusMove(sug.candidate.name, newPresetLeague)} [Mega4]` : ''}`}
                                >
                                  <div className="flex items-center justify-between gap-1">
                                    <span className="text-[11px] font-extrabold text-emerald-200 truncate">
                                      #{idx + 1} {sug.candidate.name}
                                    </span>
                                    <span className="text-[9.5px] font-mono font-bold text-emerald-300 shrink-0">
                                      {sug.deltaMachBr >= 0 ? `+${sug.deltaMachBr}` : sug.deltaMachBr} Core BR
                                    </span>
                                  </div>
                                  <div className="text-[9.5px] font-mono text-emerald-300/90 truncate">
                                    {sug.candidate.fastMove} + {sug.candidate.chargedMove1}/{sug.candidate.chargedMove2}
                                    {resolveMegaPlusMove(sug.candidate.name, newPresetLeague) ? ` + ${resolveMegaPlusMove(sug.candidate.name, newPresetLeague)} [Mega4]` : ''}
                                  </div>
                                  <div className="text-[9.5px] font-mono text-slate-300 truncate">
                                    Lead BR {sug.newRoleBr} ({sug.deltaRoleBr >= 0 ? `+${sug.deltaRoleBr}` : sug.deltaRoleBr}) • Core {sug.newMachineAggBr} [{sug.newArchetype}]
                                  </div>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                      {modalMovesetRecommendations && (
                        <div className="pt-1.5 border-t border-slate-800/80 space-y-1.5">
                          <div className="flex items-center justify-between text-[10px] font-bold text-indigo-300">
                            <span>🎯 Best 3 Alternate Movesets for {p1Name || 'Slot 1'} (Team Rating &amp; Lead Positional BR):</span>
                            <span className="text-slate-400 font-mono">Current Lead BR: {modalMovesetRecommendations.baselineEval.leadAggBr}</span>
                          </div>
                          {modalMovesetRecommendations.slot1MovesetUpgrades.length === 0 ? (
                            <div className="text-[10.5px] text-indigo-300 font-semibold">
                              No alternate move combinations found for this Pokémon.
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 gap-1.5">
                              {modalMovesetRecommendations.slot1MovesetUpgrades.map((sug, idx) => (
                                <button
                                  key={`s1-move-${idx}-${sug.proposedFastMove}-${sug.proposedChargedMove1}-${sug.proposedChargedMove2}`}
                                  type="button"
                                  onClick={() => handleApplyMovesetUpgradeChip(sug)}
                                  className="px-2 py-1.5 rounded-lg bg-indigo-950/70 hover:bg-indigo-900/80 border border-indigo-500/50 text-left transition flex flex-col justify-between gap-0.5"
                                  title={sug.summaryBadge}
                                >
                                  <div className="flex items-center justify-between gap-1">
                                    <span className="text-[11px] font-extrabold text-indigo-200 truncate">
                                      #{idx + 1} {sug.proposedFastMove} + {sug.proposedChargedMove1} / {sug.proposedChargedMove2}
                                      {resolveMegaPlusMove(sug.pokemonName, newPresetLeague) ? ` + ${resolveMegaPlusMove(sug.pokemonName, newPresetLeague)} [Mega4]` : ''}
                                    </span>
                                    <span className="text-[9.5px] font-mono font-bold text-emerald-300 shrink-0">
                                      Team Core {sug.newMachineBr} ({sug.deltaMachineBr >= 0 ? `+${sug.deltaMachineBr}` : sug.deltaMachineBr})
                                    </span>
                                  </div>
                                  <div className="text-[9.5px] font-mono text-slate-300 truncate">
                                    Positional Lead BR: {sug.newRoleBr} ({sug.deltaRoleBr >= 0 ? `+${sug.deltaRoleBr}` : sug.deltaRoleBr}) • Team Lead Agg: {sug.newLeadAggBr} ({sug.deltaLeadAggBr >= 0 ? `+${sug.deltaLeadAggBr}` : sug.deltaLeadAggBr})
                                  </div>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Slot 2 */}
                    <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl space-y-2">
                      <div className="flex items-center justify-between flex-wrap gap-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-purple-400">
                            Slot 2 ({modalLiveEvaluation.archetype === 'ABB' ? 'Bait Swap B1' : modalLiveEvaluation.archetype === 'DUO' ? 'Pivot Safe Swap' : 'Safe Swap'}, IVs &amp; Moveset)
                          </span>
                          <span
                            className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border ${
                              getSingleSlotBrTierInfo(modalLiveEvaluation.safeSwapBr, tierThresholds).colorClass
                            }`}
                          >
                            Swap BR: {modalLiveEvaluation.safeSwapBr}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const rec = getRecommendedMovesForPokemon(p2Name, newPresetLeague, p2Ivs);
                            if (rec) {
                              setP2Name(rec.name);
                              setP2Fast(rec.fastMove);
                              setP2C1(rec.chargedMove1);
                              setP2C2(rec.chargedMove2);
                              setP2Cp(rec.cp);
                            }
                          }}
                          className="text-[10px] text-purple-400 hover:text-purple-300 font-semibold"
                        >
                          Auto-Fill PvPoke Moves
                        </button>
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        <div className="col-span-2 relative">
                          <input
                            type="text"
                            value={p2Name}
                            onFocus={() => {
                              setActiveAutocompleteSlot(2);
                              setAutocompleteHighlightIdx(0);
                            }}
                            onChange={(e) => {
                              const val = e.target.value;
                              setP2Name(val);
                              setActiveAutocompleteSlot(2);
                              setAutocompleteHighlightIdx(0);
                              const rec = getRecommendedMovesForPokemon(val, newPresetLeague, p2Ivs);
                              if (rec) {
                                if (!p2Fast.trim()) setP2Fast(rec.fastMove);
                                if (!p2C1.trim()) setP2C1(rec.chargedMove1);
                                if (!p2C2.trim()) setP2C2(rec.chargedMove2);
                                if (!p2Cp || p2Cp <= 0) setP2Cp(rec.cp);
                              }
                            }}
                            onKeyDown={(e) => {
                              if (activeAutocompleteSlot !== 2 || slot2Suggestions.length === 0) return;
                              if (e.key === 'ArrowDown') {
                                e.preventDefault();
                                setAutocompleteHighlightIdx((prev) => (prev + 1) % slot2Suggestions.length);
                              } else if (e.key === 'ArrowUp') {
                                e.preventDefault();
                                setAutocompleteHighlightIdx((prev) => (prev - 1 + slot2Suggestions.length) % slot2Suggestions.length);
                              } else if (e.key === 'Enter') {
                                const chosen = slot2Suggestions[autocompleteHighlightIdx] || slot2Suggestions[0];
                                if (chosen) {
                                  e.preventDefault();
                                  handleSelectAutocompletePokemon(2, chosen);
                                }
                              } else if (e.key === 'Escape') {
                                setActiveAutocompleteSlot(null);
                              }
                            }}
                            onBlur={() => {
                              setTimeout(() => {
                                setActiveAutocompleteSlot((prev) => (prev === 2 ? null : prev));
                              }, 180);
                              handleAutoFillSlotMoves(2, p2Name, newPresetLeague, p2Ivs);
                            }}
                            placeholder="Type Pokémon (e.g. Feraligatr, Marowak)"
                            autoComplete="off"
                            className="w-full bg-slate-900 border border-slate-700 focus:border-purple-400 focus:outline-none rounded-lg px-2.5 py-1.5 text-xs text-white"
                            required
                          />
                          {activeAutocompleteSlot === 2 && slot2Suggestions.length > 0 && (
                            <div className="absolute left-0 right-0 top-full mt-1 z-50 max-h-56 overflow-y-auto rounded-xl bg-slate-900 border border-purple-500/50 shadow-2xl divide-y divide-slate-800/80">
                              {slot2Suggestions.map((opt, idx) => (
                                <button
                                  key={opt.name}
                                  type="button"
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    handleSelectAutocompletePokemon(2, opt);
                                  }}
                                  className={`w-full px-2.5 py-1.5 text-left flex items-center justify-between gap-2 transition ${
                                    idx === autocompleteHighlightIdx
                                      ? 'bg-purple-500/25 text-white'
                                      : 'hover:bg-slate-800/90 text-slate-200'
                                  }`}
                                >
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="font-bold text-xs text-white truncate">{opt.name}</span>
                                      <span
                                        className={`text-[9px] font-bold px-1.5 py-0.2 rounded border uppercase ${
                                          opt.isShadow
                                            ? 'bg-purple-500/25 text-purple-200 border-purple-400/50'
                                            : opt.isAlternateForm
                                            ? 'bg-amber-500/20 text-amber-200 border-amber-400/40'
                                            : 'bg-slate-800 text-slate-300 border-slate-700'
                                        }`}
                                      >
                                        {opt.formBadge}
                                      </span>
                                    </div>
                                    <div className="text-[10px] text-slate-400 truncate">
                                      {opt.fastMove} • {opt.chargedMove1} / {opt.chargedMove2}
                                      {resolveMegaPlusMove(opt.name, newPresetLeague) ? ` [+ ${resolveMegaPlusMove(opt.name, newPresetLeague)}]` : ''}
                                    </div>
                                  </div>
                                  <span className="text-[10px] font-mono font-bold text-purple-300 shrink-0">
                                    CP {opt.cp}
                                  </span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        <input
                          type="number"
                          value={p2Cp || ''}
                          onChange={(e) => setP2Cp(parseInt(e.target.value) || 0)}
                          placeholder="CP (Auto)"
                          className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                        />
                        <input
                          type="text"
                          value={p2Ivs}
                          onChange={(e) => setP2Ivs(e.target.value)}
                          placeholder="IVs (opt)"
                          title="Optional Atk/Def/HP IVs (e.g. 0/15/15). Defaults to PvPoke IVs if blank."
                          className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white"
                        />
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <input
                          type="text"
                          value={p2Fast}
                          onChange={(e) => setP2Fast(e.target.value)}
                          placeholder="Fast Move (Auto)"
                          className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-[11px] text-white"
                        />
                        <input
                          type="text"
                          value={p2C1}
                          onChange={(e) => setP2C1(e.target.value)}
                          placeholder="Charged 1 (Auto)"
                          className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-[11px] text-white"
                        />
                        <input
                          type="text"
                          value={p2C2}
                          onChange={(e) => setP2C2(e.target.value)}
                          placeholder="Charged 2 (Auto)"
                          className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-[11px] text-white"
                        />
                      </div>
                      {resolveMegaPlusMove(p2Name, newPresetLeague) && (
                        <div className="px-2.5 py-1.5 rounded-lg bg-purple-950/60 border border-purple-500/50 space-y-1.5">
                          <div className="flex items-center justify-between gap-2 flex-wrap text-[10.5px] font-mono font-bold">
                            <span className={p2PlusLevel <= 0 ? 'text-slate-400' : 'text-purple-200'}>
                              🔥 +3rd Move: {resolveMegaPlusMove(p2Name, newPresetLeague)} •{' '}
                              {p2PlusLevel <= 0
                                ? 'Off (Not Unlocked)'
                                : `Lv${p2PlusLevel} (${(1.0 + (p2PlusLevel - 1) * 0.1).toFixed(1)}x Power)`}
                            </span>
                            <span className="text-[9.5px] text-amber-300/90">Opp Assumed = Lv4 (1.3x)</span>
                          </div>
                          <div className="grid grid-cols-5 gap-1">
                            {[
                              { lv: 0, label: 'Off' },
                              { lv: 1, label: 'Lv1 (1.0x)' },
                              { lv: 2, label: 'Lv2 (1.1x)' },
                              { lv: 3, label: 'Lv3 (1.2x)' },
                              { lv: 4, label: 'Lv4 (1.3x)' }
                            ].map((opt) => {
                              const active = p2PlusLevel === opt.lv;
                              return (
                                <button
                                  key={`p2-plus-${opt.lv}`}
                                  type="button"
                                  onClick={() => setP2PlusLevel(opt.lv)}
                                  className={`py-1 px-1 rounded text-[9.5px] font-mono font-bold border transition ${
                                    active
                                      ? opt.lv === 0
                                        ? 'bg-rose-600/80 border-rose-400 text-white'
                                        : 'bg-purple-600 border-purple-300 text-white shadow'
                                      : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'
                                  }`}
                                >
                                  {opt.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      {modalRoleRecommendations && (
                        <div className="pt-1.5 border-t border-slate-800/80 space-y-1.5">
                          <div className="flex items-center justify-between text-[10px] font-bold text-emerald-300">
                            <span>✨ Top 5 Recommended Safe Swap Upgrades (Top-200 Meta • One-Tap Replace):</span>
                            <span className="text-slate-400 font-mono">Current Swap BR: {modalRoleRecommendations.currentSafeSwapBr}</span>
                          </div>
                          {modalRoleRecommendations.slot2SafeSwapUpgrades.length === 0 ? (
                            <div className="text-[10.5px] text-emerald-400 font-semibold">
                              ✅ Optimal Safe Swap — No higher-scoring Top-200 upgrade found!
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                              {modalRoleRecommendations.slot2SafeSwapUpgrades.map((sug, idx) => (
                                <button
                                  key={sug.candidate.name}
                                  type="button"
                                  onClick={() => handleApplyRoleUpgradeChip(2, sug)}
                                  className="px-2 py-1.5 rounded-lg bg-emerald-950/70 hover:bg-emerald-900/80 border border-emerald-500/50 text-left transition flex flex-col justify-between gap-0.5"
                                  title={`${sug.summaryBadge} • Moves: ${sug.candidate.fastMove} + ${sug.candidate.chargedMove1}/${sug.candidate.chargedMove2}${resolveMegaPlusMove(sug.candidate.name, newPresetLeague) ? ` + ${resolveMegaPlusMove(sug.candidate.name, newPresetLeague)} [Mega4]` : ''}`}
                                >
                                  <div className="flex items-center justify-between gap-1">
                                    <span className="text-[11px] font-extrabold text-emerald-200 truncate">
                                      #{idx + 1} {sug.candidate.name}
                                    </span>
                                    <span className="text-[9.5px] font-mono font-bold text-emerald-300 shrink-0">
                                      {sug.deltaMachBr >= 0 ? `+${sug.deltaMachBr}` : sug.deltaMachBr} Core BR
                                    </span>
                                  </div>
                                  <div className="text-[9.5px] font-mono text-emerald-300/90 truncate">
                                    {sug.candidate.fastMove} + {sug.candidate.chargedMove1}/{sug.candidate.chargedMove2}
                                    {resolveMegaPlusMove(sug.candidate.name, newPresetLeague) ? ` + ${resolveMegaPlusMove(sug.candidate.name, newPresetLeague)} [Mega4]` : ''}
                                  </div>
                                  <div className="text-[9.5px] font-mono text-slate-300 truncate">
                                    Swap BR {sug.newRoleBr} ({sug.deltaRoleBr >= 0 ? `+${sug.deltaRoleBr}` : sug.deltaRoleBr}) • Core {sug.newMachineAggBr} [{sug.newArchetype}]
                                  </div>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                      {modalMovesetRecommendations && (
                        <div className="pt-1.5 border-t border-slate-800/80 space-y-1.5">
                          <div className="flex items-center justify-between text-[10px] font-bold text-indigo-300">
                            <span>🎯 Best 3 Alternate Movesets for {p2Name || 'Slot 2'} (Team Rating &amp; Swap Positional BR):</span>
                            <span className="text-slate-400 font-mono">Current Swap BR: {modalMovesetRecommendations.baselineEval.safeSwapBr}</span>
                          </div>
                          {modalMovesetRecommendations.slot2MovesetUpgrades.length === 0 ? (
                            <div className="text-[10.5px] text-indigo-300 font-semibold">
                              No alternate move combinations found for this Pokémon.
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 gap-1.5">
                              {modalMovesetRecommendations.slot2MovesetUpgrades.map((sug, idx) => (
                                <button
                                  key={`s2-move-${idx}-${sug.proposedFastMove}-${sug.proposedChargedMove1}-${sug.proposedChargedMove2}`}
                                  type="button"
                                  onClick={() => handleApplyMovesetUpgradeChip(sug)}
                                  className="px-2 py-1.5 rounded-lg bg-indigo-950/70 hover:bg-indigo-900/80 border border-indigo-500/50 text-left transition flex flex-col justify-between gap-0.5"
                                  title={sug.summaryBadge}
                                >
                                  <div className="flex items-center justify-between gap-1">
                                    <span className="text-[11px] font-extrabold text-indigo-200 truncate">
                                      #{idx + 1} {sug.proposedFastMove} + {sug.proposedChargedMove1} / {sug.proposedChargedMove2}
                                      {resolveMegaPlusMove(sug.pokemonName, newPresetLeague) ? ` + ${resolveMegaPlusMove(sug.pokemonName, newPresetLeague)} [Mega4]` : ''}
                                    </span>
                                    <span className="text-[9.5px] font-mono font-bold text-emerald-300 shrink-0">
                                      Team Core {sug.newMachineBr} ({sug.deltaMachineBr >= 0 ? `+${sug.deltaMachineBr}` : sug.deltaMachineBr})
                                    </span>
                                  </div>
                                  <div className="text-[9.5px] font-mono text-slate-300 truncate">
                                    Positional Swap BR: {sug.newRoleBr} ({sug.deltaRoleBr >= 0 ? `+${sug.deltaRoleBr}` : sug.deltaRoleBr}) • Team Lead Agg: {sug.newLeadAggBr} ({sug.deltaLeadAggBr >= 0 ? `+${sug.deltaLeadAggBr}` : sug.deltaLeadAggBr})
                                  </div>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Slot 3 */}
                    <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl space-y-2">
                      <div className="flex items-center justify-between flex-wrap gap-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-amber-400">
                            Slot 3 ({modalLiveEvaluation.archetype === 'ABB' ? 'Sweeper B2' : modalLiveEvaluation.archetype === 'DUO' ? 'Core 2 Co-Core' : 'Closer'}, IVs &amp; Moveset)
                          </span>
                          <span
                            className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border ${
                              getSingleSlotBrTierInfo(modalLiveEvaluation.closerSwapBr, tierThresholds).colorClass
                            }`}
                          >
                            Swap BR: {modalLiveEvaluation.closerSwapBr}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const rec = getRecommendedMovesForPokemon(p3Name, newPresetLeague, p3Ivs);
                            if (rec) {
                              setP3Name(rec.name);
                              setP3Fast(rec.fastMove);
                              setP3C1(rec.chargedMove1);
                              setP3C2(rec.chargedMove2);
                              setP3Cp(rec.cp);
                            }
                          }}
                          className="text-[10px] text-amber-400 hover:text-amber-300 font-semibold"
                        >
                          Auto-Fill PvPoke Moves
                        </button>
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        <div className="col-span-2 relative">
                          <input
                            type="text"
                            value={p3Name}
                            onFocus={() => {
                              setActiveAutocompleteSlot(3);
                              setAutocompleteHighlightIdx(0);
                            }}
                            onChange={(e) => {
                              const val = e.target.value;
                              setP3Name(val);
                              setActiveAutocompleteSlot(3);
                              setAutocompleteHighlightIdx(0);
                              const rec = getRecommendedMovesForPokemon(val, newPresetLeague, p3Ivs);
                              if (rec) {
                                if (!p3Fast.trim()) setP3Fast(rec.fastMove);
                                if (!p3C1.trim()) setP3C1(rec.chargedMove1);
                                if (!p3C2.trim()) setP3C2(rec.chargedMove2);
                                if (!p3Cp || p3Cp <= 0) setP3Cp(rec.cp);
                              }
                            }}
                            onKeyDown={(e) => {
                              if (activeAutocompleteSlot !== 3 || slot3Suggestions.length === 0) return;
                              if (e.key === 'ArrowDown') {
                                e.preventDefault();
                                setAutocompleteHighlightIdx((prev) => (prev + 1) % slot3Suggestions.length);
                              } else if (e.key === 'ArrowUp') {
                                e.preventDefault();
                                setAutocompleteHighlightIdx((prev) => (prev - 1 + slot3Suggestions.length) % slot3Suggestions.length);
                              } else if (e.key === 'Enter') {
                                const chosen = slot3Suggestions[autocompleteHighlightIdx] || slot3Suggestions[0];
                                if (chosen) {
                                  e.preventDefault();
                                  handleSelectAutocompletePokemon(3, chosen);
                                }
                              } else if (e.key === 'Escape') {
                                setActiveAutocompleteSlot(null);
                              }
                            }}
                            onBlur={() => {
                              setTimeout(() => {
                                setActiveAutocompleteSlot((prev) => (prev === 3 ? null : prev));
                              }, 180);
                              handleAutoFillSlotMoves(3, p3Name, newPresetLeague, p3Ivs);
                            }}
                            placeholder="Type Pokémon (e.g. Zacian, Weezing)"
                            autoComplete="off"
                            className="w-full bg-slate-900 border border-slate-700 focus:border-amber-400 focus:outline-none rounded-lg px-2.5 py-1.5 text-xs text-white"
                            required
                          />
                          {activeAutocompleteSlot === 3 && slot3Suggestions.length > 0 && (
                            <div className="absolute left-0 right-0 top-full mt-1 z-50 max-h-56 overflow-y-auto rounded-xl bg-slate-900 border border-amber-500/50 shadow-2xl divide-y divide-slate-800/80">
                              {slot3Suggestions.map((opt, idx) => (
                                <button
                                  key={opt.name}
                                  type="button"
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    handleSelectAutocompletePokemon(3, opt);
                                  }}
                                  className={`w-full px-2.5 py-1.5 text-left flex items-center justify-between gap-2 transition ${
                                    idx === autocompleteHighlightIdx
                                      ? 'bg-amber-500/25 text-white'
                                      : 'hover:bg-slate-800/90 text-slate-200'
                                  }`}
                                >
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="font-bold text-xs text-white truncate">{opt.name}</span>
                                      <span
                                        className={`text-[9px] font-bold px-1.5 py-0.2 rounded border uppercase ${
                                          opt.isShadow
                                            ? 'bg-purple-500/25 text-purple-200 border-purple-400/50'
                                            : opt.isAlternateForm
                                            ? 'bg-amber-500/20 text-amber-200 border-amber-400/40'
                                            : 'bg-slate-800 text-slate-300 border-slate-700'
                                        }`}
                                      >
                                        {opt.formBadge}
                                      </span>
                                    </div>
                                    <div className="text-[10px] text-slate-400 truncate">
                                      {opt.fastMove} • {opt.chargedMove1} / {opt.chargedMove2}
                                      {resolveMegaPlusMove(opt.name, newPresetLeague) ? ` [+ ${resolveMegaPlusMove(opt.name, newPresetLeague)}]` : ''}
                                    </div>
                                  </div>
                                  <span className="text-[10px] font-mono font-bold text-amber-300 shrink-0">
                                    CP {opt.cp}
                                  </span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        <input
                          type="number"
                          value={p3Cp || ''}
                          onChange={(e) => setP3Cp(parseInt(e.target.value) || 0)}
                          placeholder="CP (Auto)"
                          className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                        />
                        <input
                          type="text"
                          value={p3Ivs}
                          onChange={(e) => setP3Ivs(e.target.value)}
                          placeholder="IVs (opt)"
                          title="Optional Atk/Def/HP IVs (e.g. 0/15/15). Defaults to PvPoke IVs if blank."
                          className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white"
                        />
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <input
                          type="text"
                          value={p3Fast}
                          onChange={(e) => setP3Fast(e.target.value)}
                          placeholder="Fast Move (Auto)"
                          className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-[11px] text-white"
                        />
                        <input
                          type="text"
                          value={p3C1}
                          onChange={(e) => setP3C1(e.target.value)}
                          placeholder="Charged 1 (Auto)"
                          className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-[11px] text-white"
                        />
                        <input
                          type="text"
                          value={p3C2}
                          onChange={(e) => setP3C2(e.target.value)}
                          placeholder="Charged 2 (Auto)"
                          className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-[11px] text-white"
                        />
                      </div>
                      {resolveMegaPlusMove(p3Name, newPresetLeague) && (
                        <div className="px-2.5 py-1.5 rounded-lg bg-purple-950/60 border border-purple-500/50 space-y-1.5">
                          <div className="flex items-center justify-between gap-2 flex-wrap text-[10.5px] font-mono font-bold">
                            <span className={p3PlusLevel <= 0 ? 'text-slate-400' : 'text-purple-200'}>
                              🔥 +3rd Move: {resolveMegaPlusMove(p3Name, newPresetLeague)} •{' '}
                              {p3PlusLevel <= 0
                                ? 'Off (Not Unlocked)'
                                : `Lv${p3PlusLevel} (${(1.0 + (p3PlusLevel - 1) * 0.1).toFixed(1)}x Power)`}
                            </span>
                            <span className="text-[9.5px] text-amber-300/90">Opp Assumed = Lv4 (1.3x)</span>
                          </div>
                          <div className="grid grid-cols-5 gap-1">
                            {[
                              { lv: 0, label: 'Off' },
                              { lv: 1, label: 'Lv1 (1.0x)' },
                              { lv: 2, label: 'Lv2 (1.1x)' },
                              { lv: 3, label: 'Lv3 (1.2x)' },
                              { lv: 4, label: 'Lv4 (1.3x)' }
                            ].map((opt) => {
                              const active = p3PlusLevel === opt.lv;
                              return (
                                <button
                                  key={`p3-plus-${opt.lv}`}
                                  type="button"
                                  onClick={() => setP3PlusLevel(opt.lv)}
                                  className={`py-1 px-1 rounded text-[9.5px] font-mono font-bold border transition ${
                                    active
                                      ? opt.lv === 0
                                        ? 'bg-rose-600/80 border-rose-400 text-white'
                                        : 'bg-purple-600 border-purple-300 text-white shadow'
                                      : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'
                                  }`}
                                >
                                  {opt.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      {modalRoleRecommendations && (
                        <div className="pt-1.5 border-t border-slate-800/80 space-y-1.5">
                          <div className="flex items-center justify-between text-[10px] font-bold text-emerald-300">
                            <span>✨ Top 5 Recommended Closer Upgrades (Top-200 Meta • One-Tap Replace):</span>
                            <span className="text-slate-400 font-mono">Current Closer BR: {modalRoleRecommendations.currentCloserBr}</span>
                          </div>
                          {modalRoleRecommendations.slot3CloserUpgrades.length === 0 ? (
                            <div className="text-[10.5px] text-emerald-400 font-semibold">
                              ✅ Optimal Closer — No higher-scoring Top-200 upgrade found!
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                              {modalRoleRecommendations.slot3CloserUpgrades.map((sug, idx) => (
                                <button
                                  key={sug.candidate.name}
                                  type="button"
                                  onClick={() => handleApplyRoleUpgradeChip(3, sug)}
                                  className="px-2 py-1.5 rounded-lg bg-emerald-950/70 hover:bg-emerald-900/80 border border-emerald-500/50 text-left transition flex flex-col justify-between gap-0.5"
                                  title={`${sug.summaryBadge} • Moves: ${sug.candidate.fastMove} + ${sug.candidate.chargedMove1}/${sug.candidate.chargedMove2}${resolveMegaPlusMove(sug.candidate.name, newPresetLeague) ? ` + ${resolveMegaPlusMove(sug.candidate.name, newPresetLeague)} [Mega4]` : ''}`}
                                >
                                  <div className="flex items-center justify-between gap-1">
                                    <span className="text-[11px] font-extrabold text-emerald-200 truncate">
                                      #{idx + 1} {sug.candidate.name}
                                    </span>
                                    <span className="text-[9.5px] font-mono font-bold text-emerald-300 shrink-0">
                                      {sug.deltaMachBr >= 0 ? `+${sug.deltaMachBr}` : sug.deltaMachBr} Core BR
                                    </span>
                                  </div>
                                  <div className="text-[9.5px] font-mono text-emerald-300/90 truncate">
                                    {sug.candidate.fastMove} + {sug.candidate.chargedMove1}/{sug.candidate.chargedMove2}
                                    {resolveMegaPlusMove(sug.candidate.name, newPresetLeague) ? ` + ${resolveMegaPlusMove(sug.candidate.name, newPresetLeague)} [Mega4]` : ''}
                                  </div>
                                  <div className="text-[9.5px] font-mono text-slate-300 truncate">
                                    Swap BR {sug.newRoleBr} ({sug.deltaRoleBr >= 0 ? `+${sug.deltaRoleBr}` : sug.deltaRoleBr}) • Core {sug.newMachineAggBr} [{sug.newArchetype}]
                                  </div>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                      {modalMovesetRecommendations && (
                        <div className="pt-1.5 border-t border-slate-800/80 space-y-1.5">
                          <div className="flex items-center justify-between text-[10px] font-bold text-indigo-300">
                            <span>🎯 Best 3 Alternate Movesets for {p3Name || 'Slot 3'} (Team Rating &amp; Closer Positional BR):</span>
                            <span className="text-slate-400 font-mono">Current Closer BR: {modalMovesetRecommendations.baselineEval.closerBr}</span>
                          </div>
                          {modalMovesetRecommendations.slot3MovesetUpgrades.length === 0 ? (
                            <div className="text-[10.5px] text-indigo-300 font-semibold">
                              No alternate move combinations found for this Pokémon.
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 gap-1.5">
                              {modalMovesetRecommendations.slot3MovesetUpgrades.map((sug, idx) => (
                                <button
                                  key={`s3-move-${idx}-${sug.proposedFastMove}-${sug.proposedChargedMove1}-${sug.proposedChargedMove2}`}
                                  type="button"
                                  onClick={() => handleApplyMovesetUpgradeChip(sug)}
                                  className="px-2 py-1.5 rounded-lg bg-indigo-950/70 hover:bg-indigo-900/80 border border-indigo-500/50 text-left transition flex flex-col justify-between gap-0.5"
                                  title={sug.summaryBadge}
                                >
                                  <div className="flex items-center justify-between gap-1">
                                    <span className="text-[11px] font-extrabold text-indigo-200 truncate">
                                      #{idx + 1} {sug.proposedFastMove} + {sug.proposedChargedMove1} / {sug.proposedChargedMove2}
                                      {resolveMegaPlusMove(sug.pokemonName, newPresetLeague) ? ` + ${resolveMegaPlusMove(sug.pokemonName, newPresetLeague)} [Mega4]` : ''}
                                    </span>
                                    <span className="text-[9.5px] font-mono font-bold text-emerald-300 shrink-0">
                                      Team Core {sug.newMachineBr} ({sug.deltaMachineBr >= 0 ? `+${sug.deltaMachineBr}` : sug.deltaMachineBr})
                                    </span>
                                  </div>
                                  <div className="text-[9.5px] font-mono text-slate-300 truncate">
                                    Positional Closer BR: {sug.newRoleBr} ({sug.deltaRoleBr >= 0 ? `+${sug.deltaRoleBr}` : sug.deltaRoleBr}) • Swap BR: {sug.newSwapBr}
                                  </div>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                      <button
                        type="button"
                        onClick={() => {
                          setIsNewPresetOpen(false);
                          setEditingPresetId(null);
                          setActiveAutocompleteSlot(null);
                        }}
                        className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/20"
                      >
                        {editingPresetId ? 'Save Team & Moves' : 'Create Preset'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* =========================================================================
            PAGE 2: DEDICATED OVERLAY & DATABASE SETTINGS PAGE
           ========================================================================= */}
        {activeTab === 'settings' && (
          <div className="max-w-3xl mx-auto space-y-5">
            {/* 3-Page Quick Switcher Banner (Teams • Battle Log • Settings) */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Settings className="w-5 h-5 text-sky-400" />
                  <span>Overlay &amp; Database Settings</span>
                </h2>
                <p className="text-xs text-slate-400">
                  Reorganized v3.02 layout: Theme, Overlay Size &amp; Background Transparency grouped at the top.
                </p>
              </div>
              <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-bold shrink-0">
                <button
                  onClick={() => setActiveTab('presets')}
                  className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-white transition"
                >
                  ⚔️ Teams
                </button>
                <button
                  onClick={() => setActiveTab('battle_log')}
                  className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-white transition"
                >
                  📜 Battle Log
                </button>
                <button
                  onClick={() => setActiveTab('settings')}
                  className="px-3 py-1.5 rounded-lg bg-sky-500 text-white shadow-sm"
                >
                  ⚙️ Settings
                </button>
              </div>
            </div>

            {/* ===================================================================
                CARD 0 (v5.00): APP COMBAT MODE TOGGLE (STANDARD GBL vs SHOW 6)
               =================================================================== */}
            <div
              className={`border rounded-2xl p-5 shadow-xl space-y-4 ${
                appCombatMode === 'show6'
                  ? 'bg-gradient-to-br from-amber-950/60 via-slate-900 to-slate-950 border-amber-500/50'
                  : 'bg-slate-900 border-slate-800'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                <div>
                  <span className="text-sm font-extrabold text-amber-300 flex items-center gap-2">
                    <span>{appCombatMode === 'show6' ? '🏛️' : '🛡️'} App Combat Mode (Standard GBL vs. Show 6 Battle Frontier)</span>
                    <span className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 text-amber-200 text-[10px] font-mono">
                      v6.26
                    </span>
                  </span>
                  <span className="text-xs text-slate-400 block mt-0.5">
                    Switch between <strong>Standard GBL (Blind 3 PvP)</strong> and <strong>Show 6 (Battle Frontier / Pick-3)</strong>. Show 6 Mode features its own independent Battle Logs, Teams of 6 &amp; Teams of 3 storage, Dual Show 6 Team Builders, and Known-Opponent-6 AI backline constraints.
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {appCombatMode === 'show6'
                    ? renderBattleFrontierLogo('w-8 h-8 shrink-0')
                    : renderGblModeLogo('w-8 h-8 shrink-0')}
                  <span
                    className={`px-2.5 py-1 rounded-xl text-xs font-extrabold border font-mono ${
                      appCombatMode === 'show6'
                        ? 'bg-amber-500/20 border-amber-400/60 text-amber-200'
                        : 'bg-sky-500/20 border-sky-400/60 text-sky-200'
                    }`}
                  >
                    {appCombatMode === 'show6' ? 'SHOW 6 ACTIVE' : 'STANDARD GBL ACTIVE'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => handleSetAppCombatMode('gbl')}
                  className={`p-3.5 rounded-xl border text-left transition flex items-start gap-3 ${
                    appCombatMode === 'gbl'
                      ? 'bg-sky-950/70 border-sky-400 text-white shadow-lg shadow-sky-900/20'
                      : 'bg-slate-950/80 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                  }`}
                >
                  {renderGblModeLogo('w-8 h-8 shrink-0 mt-0.5')}
                  <div>
                    <div className="text-xs font-extrabold text-sky-300 flex items-center gap-1.5">
                      <span>🛡️ Standard GBL Mode (Blind 3 PvP)</span>
                      {appCombatMode === 'gbl' && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-sky-500/30 text-sky-200 font-mono">ACTIVE</span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Standard GO Battle League blind 3v3 teams, Top-50 meta backline predictor, and standard GBL battle logs.
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleSetAppCombatMode('show6')}
                  className={`p-3.5 rounded-xl border text-left transition flex items-start gap-3 ${
                    appCombatMode === 'show6'
                      ? 'bg-amber-950/70 border-amber-400 text-white shadow-lg shadow-amber-900/20'
                      : 'bg-slate-950/80 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                  }`}
                >
                  {renderBattleFrontierLogo('w-8 h-8 shrink-0 mt-0.5')}
                  <div>
                    <div className="text-xs font-extrabold text-amber-300 flex items-center gap-1.5">
                      <span>🏛️ Show 6 Mode (Battle Frontier / Pick-3)</span>
                      {appCombatMode === 'show6' && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/30 text-amber-200 font-mono">ACTIVE</span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Stores Teams of 6 &amp; Teams of 3, 6v6 Pick-3 Optimizer (3 ABB / 3 ABC / 3 Duo-Core), Blind Show 6 Roster Builder, independent Show 6 logs, and Known-Opponent-6 AI predictions.
                    </p>
                  </div>
                </button>
              </div>
            </div>

            {/* ===================================================================
                CARD 1 (TOP): APP & OVERLAY THEME, SIZE & TRANSPARENCY
               =================================================================== */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                <div>
                  <span className="text-sm font-bold text-sky-400 block">
                    🎨 App &amp; Overlay Theme, Size &amp; Transparency
                  </span>
                  <span className="text-xs text-slate-400">
                    Themes the main app and subtly accents the floating HUD border &amp; header while keeping all tactical damage, shield, and timer colors untouched.
                  </span>
                </div>
                {/* 5-Dot Live Theme Swatch Preview */}
                <div className="flex items-center gap-1.5 shrink-0 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
                  <span
                    className="w-4 h-4 rounded-full border border-white/25"
                    style={{ backgroundColor: activeTheme.bgHex }}
                    title="App Background"
                  />
                  <span
                    className="w-4 h-4 rounded-full border border-white/25"
                    style={{ backgroundColor: activeTheme.cardHex }}
                    title="Card Surface"
                  />
                  <span
                    className="w-4 h-4 rounded-full border border-white/25"
                    style={{ backgroundColor: activeTheme.accentHex }}
                    title="Primary Accent"
                  />
                  <span
                    className="w-4 h-4 rounded-full border border-white/25"
                    style={{ backgroundColor: activeTheme.accentSecondaryHex }}
                    title="Secondary Accent"
                  />
                  <span
                    className="w-4 h-4 rounded-full border border-white/25"
                    style={{ backgroundColor: activeTheme.textPrimaryHex }}
                    title="Primary Text"
                  />
                </div>
              </div>

              {/* Theme Selector Dropdown + Quick Grid */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-white">
                    Select Theme (Default, 2 AMOLED, 6 Pokémon GO Team Dark/Light, Sylveon Light)
                  </label>
                  <span className="text-[11px] font-mono font-bold" style={{ color: activeTheme.accentHex }}>
                    {activeTheme.name}
                  </span>
                </div>
                <select
                  value={appThemeId}
                  onChange={(e) => handleSetAppThemeId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-bold text-white cursor-pointer"
                >
                  {WEB_APP_THEMES.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400 font-mono">{activeTheme.description}</p>
              </div>

              {/* Background Emblem Watermark Toggle */}
              <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-950 border border-slate-800">
                <div>
                  <span className="text-xs font-bold text-white block">
                    Show Background Emblem Watermark (Instinct / Mystic / Valor / Sylveon)
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Displays a subtle vector team crest or Sylveon fairy ribbon watermark behind the main app when a Team or Sylveon theme is active.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleSetShowThemeWatermark(!showThemeWatermark)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold border transition shrink-0 ${
                    showThemeWatermark
                      ? 'bg-sky-500/25 border-sky-400 text-sky-300'
                      : 'bg-slate-900 border-slate-700 text-slate-400'
                  }`}
                >
                  {showThemeWatermark ? 'Watermark ON' : 'Watermark OFF'}
                </button>
              </div>

              {/* Overlay Size Slider (Grouped inside Card 1) */}
              <div className="pt-2 border-t border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-white block">
                      Overlay Size (% of Screen Width)
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Proportionally scales the floating overlay container, fonts, and move timing bars (50%–100%).
                    </span>
                  </div>
                  <button
                    onClick={() => handleSetOverlayScalePct(78)}
                    className="text-xs font-mono font-bold text-sky-400 hover:text-sky-300 transition"
                  >
                    {overlayScalePct === 78 ? '78% (Default)' : `${overlayScalePct}%`}
                  </button>
                </div>
                <input
                  type="range"
                  min={50}
                  max={100}
                  step={2}
                  value={overlayScalePct}
                  onChange={(e) => handleSetOverlayScalePct(Number(e.target.value))}
                  className="w-full accent-sky-400 cursor-pointer h-2 bg-slate-800 rounded-lg"
                />
                <div className="relative h-4 text-[10px] font-mono text-slate-400">
                  <span className="absolute left-0">50%</span>
                  <button
                    type="button"
                    onClick={() => handleSetOverlayScalePct(78)}
                    style={{ left: '56%', transform: 'translateX(-50%)' }}
                    className="absolute text-sky-400 hover:text-sky-300 font-bold transition"
                  >
                    ▲ 78% Default
                  </button>
                  <span className="absolute right-0">100%</span>
                </div>
              </div>

              {/* Overlay Background Transparency Slider (Grouped inside Card 1) */}
              <div className="pt-2 border-t border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-white block">
                      Overlay Background Transparency
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Adjusts only the background panel opacity while keeping text, shield dots, and move bars 100% readable.
                    </span>
                  </div>
                  <button
                    onClick={() => handleSetOverlayTransparencyPct(50)}
                    className="text-xs font-mono font-bold text-sky-400 hover:text-sky-300 transition"
                  >
                    {overlayTransparencyPct === 50 ? '50% (Default)' : `${overlayTransparencyPct}%`}
                  </button>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={2}
                  value={overlayTransparencyPct}
                  onChange={(e) => handleSetOverlayTransparencyPct(Number(e.target.value))}
                  className="w-full accent-sky-400 cursor-pointer h-2 bg-slate-800 rounded-lg"
                />
                <div className="relative h-4 text-[10px] font-mono text-slate-400">
                  <span className="absolute left-0">0% (Solid)</span>
                  <button
                    type="button"
                    onClick={() => handleSetOverlayTransparencyPct(50)}
                    style={{ left: '50%', transform: 'translateX(-50%)' }}
                    className="absolute text-sky-400 hover:text-sky-300 font-bold transition"
                  >
                    ▲ 50% Default
                  </button>
                  <span className="absolute right-0">100% (Clear)</span>
                </div>
              </div>
            </div>

            {/* ===================================================================
                1B. HAPTICS & TACTICAL VIBRATION ALERTS (v6.06)
               =================================================================== */}
            <div className="p-5 rounded-2xl bg-slate-900 border border-sky-500/35 shadow-xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                <div>
                  <span className="text-sm font-extrabold text-sky-400">
                    📳 Haptics &amp; Tactical Vibration Alerts (v6.06)
                  </span>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Distinct short pulses synchronized with the visual blink indicators on the floating overlay: <strong className="text-amber-300">80ms single pulse</strong> when Opponent Swap Clock reaches the warning threshold, and <strong className="text-rose-300">80ms double pulse</strong> when Opponent is 1 (or 2) fast moves away from throwing.
                  </p>
                </div>
                <label className="inline-flex items-center gap-2 cursor-pointer shrink-0 bg-slate-950 border border-slate-800 px-3 py-2 rounded-xl">
                  <span className="text-xs font-bold text-slate-200">Master Haptics</span>
                  <input
                    type="checkbox"
                    checked={hapticMasterEnabled}
                    onChange={(e) => {
                      const next = e.target.checked;
                      setHapticMasterEnabled(next);
                      try { localStorage.setItem('gbl_haptic_master_enabled', String(next)); } catch {}
                    }}
                    className="w-4 h-4 accent-sky-400 rounded cursor-pointer"
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. Opponent Swap Clock Alert */}
                <div className="p-4 rounded-xl bg-slate-950/90 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-xs font-bold text-white">Opponent Swap Clock Alert (80ms Single Pulse)</div>
                      <div className="text-[10px] text-slate-400">Tied to Swap Clock warning blink threshold</div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={triggerWebSinglePulse}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-400 font-mono font-bold text-[10px] border border-slate-700 transition"
                      >
                        Test 1x
                      </button>
                      <input
                        type="checkbox"
                        checked={hapticOppSwapEnabled}
                        onChange={(e) => {
                          const next = e.target.checked;
                          setHapticOppSwapEnabled(next);
                          try { localStorage.setItem('gbl_haptic_opp_swap_enabled', String(next)); } catch {}
                        }}
                        className="w-4 h-4 accent-amber-400 rounded cursor-pointer"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-300">Blink &amp; Vibration Threshold:</span>
                      <span className="font-mono font-bold text-amber-400">
                        ≤ {hapticOppSwapWarnSec}s {hapticOppSwapWarnSec === 5 ? '(Default)' : ''}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={2}
                      max={10}
                      step={1}
                      value={hapticOppSwapWarnSec}
                      onChange={(e) => {
                        const sec = Number(e.target.value);
                        setHapticOppSwapWarnSec(sec);
                        try { localStorage.setItem('gbl_haptic_opp_swap_warn_sec', String(sec)); } catch {}
                      }}
                      className="w-full accent-amber-400 cursor-pointer h-2 bg-slate-800 rounded-lg"
                    />
                  </div>
                </div>

                {/* 2. Opponent Charged Move Warning */}
                <div className="p-4 rounded-xl bg-slate-950/90 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-xs font-bold text-white">Opp Charged Move Alert (80ms Double Pulse)</div>
                      <div className="text-[10px] text-slate-400">Tied to Tactical Recommendation blinking throw/catch warning</div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={triggerWebDoublePulse}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-rose-400 font-mono font-bold text-[10px] border border-slate-700 transition"
                      >
                        Test 2x
                      </button>
                      <input
                        type="checkbox"
                        checked={hapticOppChargeWarnEnabled}
                        onChange={(e) => {
                          const next = e.target.checked;
                          setHapticOppChargeWarnEnabled(next);
                          try { localStorage.setItem('gbl_haptic_opp_charge_warn_enabled', String(next)); } catch {}
                        }}
                        className="w-4 h-4 accent-rose-500 rounded cursor-pointer"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <span className="text-[11px] text-slate-300">Blink &amp; Double-Pulse Lead:</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setHapticChargeTimingFasts(1);
                          try { localStorage.setItem('gbl_haptic_charge_timing_fasts', '1'); } catch {}
                        }}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition ${
                          hapticChargeTimingFasts === 1
                            ? 'bg-rose-600 text-white shadow'
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        1 Fast Away (Default)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setHapticChargeTimingFasts(2);
                          try { localStorage.setItem('gbl_haptic_charge_timing_fasts', '2'); } catch {}
                        }}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition ${
                          hapticChargeTimingFasts === 2
                            ? 'bg-rose-600 text-white shadow'
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        2 Fasts Away
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ===================================================================
                PVPOKE GITHUB LIMITED METAS IMPORTER & DUAL SELECTOR (GBL + SHOW 6)
               =================================================================== */}
            <div className="p-5 rounded-2xl bg-slate-900 border border-purple-500/40 shadow-xl space-y-4">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-extrabold text-white">
                      🌐 PvPoke GitHub Limited Metas Selector (Dedicated GBL &amp; Battle Frontier Formats)
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40 font-mono">
                      GBL Pinned: {pinnedGblMetas.length} • Show 6 Pinned: {pinnedShow6Metas.length}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Pulls verified ranked formats directly from the official <code className="text-purple-300 font-mono">pvpoke/pvpoke</code> GitHub repository (<code className="text-sky-300 font-mono">formats.json</code> + active <code className="text-sky-300 font-mono">cups/*.json</code> + verified <code className="text-sky-300 font-mono">rankings-&#123;cp&#125;.json</code>). Automatically groups metas into <strong className="text-emerald-300">🟢 Current</strong>, <strong className="text-sky-300">🔜 Upcoming</strong>, and <strong className="text-amber-300">🕒 Recent (This Season)</strong> while hiding obsolete archived formats. Pin any number of Limited Metas independently for <strong className="text-sky-300">Standard GBL (Blind 3)</strong> and <strong className="text-amber-300">Battle Frontier (Show 6)</strong>!
                  </p>
                  <div className="text-[11px] font-mono text-emerald-400">{pvPokeMetasSyncStatus}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  <input
                    type="text"
                    value={limitedMetaSearchQuery}
                    onChange={(e) => setLimitedMetaSearchQuery(e.target.value)}
                    placeholder="Search cup (e.g. Fantasy, Retro, Kanto)..."
                    className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white w-56"
                  />
                  <button
                    type="button"
                    onClick={handleSyncPvPokeLimitedMetasFromGitHub}
                    disabled={isSyncingPvPokeMetas}
                    className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-extrabold text-xs transition shadow-lg flex items-center gap-1.5"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncingPvPokeMetas ? 'animate-spin' : ''}`} />
                    <span>{isSyncingPvPokeMetas ? 'Syncing PvPoke GitHub...' : '🔄 Sync Metas from PvPoke GitHub'}</span>
                  </button>
                </div>
              </div>

              {/* LOCKED FORCED DEFAULT LEAGUES AT TOP OF SELECT METAS */}
              <div className="p-3.5 rounded-xl bg-slate-950/90 border border-sky-500/40 space-y-2.5">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-xs font-extrabold text-white flex items-center gap-1.5">
                    🔒 Forced Default Leagues (Locked Active &amp; Auto-Downloaded at Top of Mode Lists)
                  </span>
                  <span className="text-[10.5px] font-mono text-slate-400">
                    Forced cups use ALL CAPS • Optional selectable cups use PvPoke Title Case (CP)
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="p-2.5 rounded-lg bg-slate-900/90 border border-sky-500/30 space-y-1.5">
                    <div className="text-[11px] font-extrabold text-sky-300">
                      🌍 Blind 3 PvP (Standard GBL) — Forced Top Defaults:
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {forcedGblLeagues.map((lg) => (
                        <span
                          key={lg}
                          className="px-2.5 py-1 rounded-md bg-sky-500/20 border border-sky-400/50 text-sky-200 text-[10.5px] font-black font-mono flex items-center gap-1"
                        >
                          <span>🔒</span>
                          <span>{lg}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-900/90 border border-amber-500/30 space-y-1.5">
                    <div className="text-[11px] font-extrabold text-amber-300">
                      🏛️ Show 6 Pick 3 (Battle Frontier) — Forced Top Defaults (All &quot;Battle Frontier&quot; Cups):
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {forcedShow6Leagues.map((lg) => (
                        <span
                          key={lg}
                          className="px-2.5 py-1 rounded-md bg-amber-500/20 border border-amber-400/50 text-amber-200 text-[10.5px] font-black font-mono flex items-center gap-1"
                        >
                          <span>🔒</span>
                          <span>{lg}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {(['CURRENT', 'UPCOMING', 'RECENT'] as const).map((statusGroup) => {
                const q = limitedMetaSearchQuery.trim().toLowerCase();
                const groupFormats = limitedMetaCatalog.filter(
                  (f) =>
                    f.lifecycle === statusGroup &&
                    (!q ||
                      f.id.toLowerCase().includes(q) ||
                      f.title.toLowerCase().includes(q) ||
                      f.cupKey.toLowerCase().includes(q))
                );
                if (groupFormats.length === 0) return null;

                const groupHeader =
                  statusGroup === 'CURRENT'
                    ? {
                        badge: '🟢 CURRENT ROTATION',
                        desc: 'Live in PvPoke formats.json with active rankings (hideRankings != true)',
                        cls: 'text-emerald-300 border-emerald-500/40 bg-emerald-500/10'
                      }
                    : statusGroup === 'UPCOMING'
                    ? {
                        badge: '🔜 UPCOMING / SCHEDULED',
                        desc: 'Pre-staged in PvPoke active cups/ with verified rankings-{cp}.json',
                        cls: 'text-sky-300 border-sky-500/40 bg-sky-500/10'
                      }
                    : {
                        badge: '🕒 RECENT (≤ 4 WEEKS)',
                        desc: 'Selectable for 4 weeks after last seen on PvPoke (expired >4w cups auto-delete when unchecked)',
                        cls: 'text-amber-300 border-amber-500/40 bg-amber-500/10'
                      };

                return (
                  <div key={statusGroup} className="space-y-2.5">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span className={`px-2.5 py-0.5 rounded-md text-[10.5px] font-black border ${groupHeader.cls}`}>
                          {groupHeader.badge} ({groupFormats.length})
                        </span>
                        <span className="text-[11px] text-slate-400">{groupHeader.desc}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                      {groupFormats.map((fmt) => {
                        const isForcedShow6BF =
                          isCurrentBattleFrontierCup(fmt.title || fmt.label, fmt.cup) && fmt.status === 'CURRENT';
                        const isStandardOpenCup = fmt.cup === 'all';
                        const isPinnedGbl = isStandardOpenCup || pinnedGblMetas.includes(fmt.id);
                        const isPinnedShow6 = isForcedShow6BF || pinnedShow6Metas.includes(fmt.id);
                        const sheetAlias = limitedMetaSheetAliases[fmt.id] || '';
                        const isExpired4w = isExpiredLimitedMeta(fmt);
                        const daysAgo = fmt.lastSeenAt
                          ? Math.max(0, Math.floor((Date.now() - fmt.lastSeenAt) / (24 * 60 * 60 * 1000)))
                          : 0;
                        return (
                          <div
                            key={fmt.id}
                            className={`p-3 rounded-xl border transition space-y-2 ${
                              isExpired4w
                                ? 'bg-rose-950/25 border-rose-500/60 shadow-md'
                                : isPinnedGbl || isPinnedShow6
                                ? 'bg-slate-950 border-purple-400/60 shadow-md'
                                : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="font-extrabold text-xs text-white truncate" title={fmt.id}>
                                  {fmt.id}
                                </div>
                                <div className="text-[10px] font-mono text-slate-400">
                                  cup: <span className="text-purple-300">{fmt.cupKey}</span> • Max CP:{' '}
                                  <span className="text-sky-300">{fmt.cp >= 10000 ? 'Uncapped' : fmt.cp}</span>
                                  {fmt.allowMegas ? ' • 🧬 Max 1 Mega/Primal' : ''}
                                  {fmt.lifecycle === 'RECENT' && !isExpired4w ? ` • 🕒 ${daysAgo}d ago` : ''}
                                </div>
                                {isExpired4w && (
                                  <div className="text-[10px] font-extrabold text-rose-300 mt-0.5">
                                    ⚠️ Expired (&gt;4w, {daysAgo}d ago) — kept while pinned; uncheck to delete
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-1.5 pt-1">
                              <button
                                type="button"
                                onClick={() => {
                                  if (isStandardOpenCup) {
                                    setStartBattleToast(`🔒 ${fmt.title.toUpperCase()} is a forced default in Blind 3 PvP.`);
                                    return;
                                  }
                                  handleTogglePinnedGblMeta(fmt.id);
                                }}
                                className={`px-2 py-1.5 rounded-lg text-[10.5px] font-extrabold border transition flex items-center justify-center gap-1 ${
                                  isStandardOpenCup
                                    ? 'bg-sky-900/50 text-sky-200 border-sky-400/60 cursor-default'
                                    : isPinnedGbl
                                    ? 'bg-sky-500 text-slate-950 border-sky-300 shadow'
                                    : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-sky-500/50'
                                }`}
                              >
                                <span>
                                  {isStandardOpenCup ? '🔒 GBL Forced' : isPinnedGbl ? '✓ GBL Pinned' : '+ Pin to GBL'}
                                </span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  if (isForcedShow6BF) {
                                    setStartBattleToast(`🔒 ${fmt.id} is a forced Battle Frontier default in Show 6.`);
                                    return;
                                  }
                                  handleTogglePinnedShow6Meta(fmt.id);
                                }}
                                className={`px-2 py-1.5 rounded-lg text-[10.5px] font-extrabold border transition flex items-center justify-center gap-1 ${
                                  isForcedShow6BF
                                    ? 'bg-amber-900/50 text-amber-200 border-amber-400/60 cursor-default'
                                    : isPinnedShow6
                                    ? 'bg-amber-500 text-slate-950 border-amber-300 shadow'
                                    : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-amber-500/50'
                                }`}
                              >
                                <span>
                                  {isForcedShow6BF
                                    ? '🔒 Show 6 Forced'
                                    : isPinnedShow6
                                    ? '✓ Show 6 Pinned'
                                    : '+ Pin to Show 6'}
                                </span>
                              </button>
                            </div>

                            {isPinnedShow6 && (
                              <div className="pt-1.5 border-t border-slate-800/80 space-y-1">
                                <label className="block text-[9.5px] font-bold text-amber-300">
                                  Optional Battle Frontier Sheet Tab/Column Keyword (blank = 100% PvPoke Rankings):
                                </label>
                                <input
                                  type="text"
                                  value={sheetAlias}
                                  onChange={(e) => handleUpdateLimitedMetaSheetAlias(fmt.id, e.target.value)}
                                  placeholder="e.g. Retro, Fantasy, Great..."
                                  className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-[10.5px] text-white font-mono"
                                />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ===================================================================
                CARD 2: OVERLAY HUD BEHAVIOR & 5-TIER MATCHUP THRESHOLDS
               =================================================================== */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-white">Opponent Move Count Basis</span>
                  <span className="text-[10px] font-mono text-sky-400">Turn-Aligned</span>
                </div>
                <p className="text-xs text-slate-400">
                  Choose whether opponent move bars count your fast attacks or the opponent&apos;s fast attacks.
                </p>
                <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-950 rounded-xl border border-slate-800">
                  <button
                    onClick={() => handleSetOppCountMode('my_fasts')}
                    className={`py-2 px-2 rounded-lg text-xs font-bold transition ${
                      oppCountMode === 'my_fasts'
                        ? 'bg-sky-500/25 border border-sky-400/70 text-sky-200'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    My Fasts (Default)
                  </button>
                  <button
                    onClick={() => handleSetOppCountMode('opp_fasts')}
                    className={`py-2 px-2 rounded-lg text-xs font-bold transition ${
                      oppCountMode === 'opp_fasts'
                        ? 'bg-sky-500/25 border border-sky-400/70 text-sky-200'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Their Fasts
                  </button>
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-white">Opponent Charged Moves</span>
                  <span className="text-[10px] font-mono text-sky-400">
                    {enable4ChargedMoves ? '4 Moves Shown' : '3 Moves (Default)'}
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Show PvPoke&apos;s 2 official moves + top 1 usage move (3 Moves) or top 2 usage moves (4 Moves).
                </p>
                <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-950 rounded-xl border border-slate-800">
                  <button
                    onClick={() => handleSetEnable4ChargedMoves(false)}
                    className={`py-2 px-2 rounded-lg text-xs font-bold transition ${
                      !enable4ChargedMoves
                        ? 'bg-sky-500/25 border border-sky-400/70 text-sky-200'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    3 Moves (Default)
                  </button>
                  <button
                    onClick={() => handleSetEnable4ChargedMoves(true)}
                    className={`py-2 px-2 rounded-lg text-xs font-bold transition ${
                      enable4ChargedMoves
                        ? 'bg-sky-500/25 border border-sky-400/70 text-sky-200'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    4 Moves
                  </button>
                </div>
              </div>
            </div>

            {/* Battle Toast Messages Setting */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-white">Battle Toast Messages</span>
                <span className="text-[10px] font-mono text-sky-400">
                  {disableBattleToasts ? 'Toasts Off' : 'Toasts On (Default)'}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Enable or disable floating toast popups during battle (Battle Start/Stop, Switches &amp; Logs).
              </p>
              <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-950 rounded-xl border border-slate-800">
                <button
                  onClick={() => handleSetDisableBattleToasts(false)}
                  className={`py-2 px-2 rounded-lg text-xs font-bold transition ${
                    !disableBattleToasts
                      ? 'bg-sky-500/25 border border-sky-400/70 text-sky-200'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Toasts On (Default)
                </button>
                <button
                  onClick={() => handleSetDisableBattleToasts(true)}
                  className={`py-2 px-2 rounded-lg text-xs font-bold transition ${
                    disableBattleToasts
                      ? 'bg-sky-500/25 border border-sky-400/70 text-sky-200'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Toasts Off
                </button>
              </div>
            </div>

            {/* Lead & Swap Tactical Recommendations GUI Toggle + v6.00 Bottom (Default) vs Top Position Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-emerald-400 flex items-center gap-2">
                  <Swords className="w-4 h-4" />
                  <span>🧠 4-Pillar 2-Line AI Tactical Coach &amp; HUD Position (v6.02)</span>
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/40 text-emerald-300">
                  {showTacticalRec ? `Enabled • ${aiAdviceHudPosition === 'bottom' ? 'Bottom (Def)' : 'Top'}` : 'Disabled'}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Displays a condensed <strong>2-line AI Tactical Coach</strong> (Line 1: Primary Action + Color-Coded Farm-Down / Throw &amp; Catch Timing Alerts; Line 2: Learned + Meta Core Opponent Backline Prediction). Default position is <strong>Bottom of HUD</strong> for maximum visibility near your charge move buttons.
              </p>
              <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-950 rounded-xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => handleSetShowTacticalRec(true)}
                  className={`py-2 px-2 rounded-lg text-xs font-bold transition ${
                    showTacticalRec
                      ? 'bg-emerald-500/25 border border-emerald-400/70 text-emerald-200'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Recommendations On (Default)
                </button>
                <button
                  type="button"
                  onClick={() => handleSetShowTacticalRec(false)}
                  className={`py-2 px-2 rounded-lg text-xs font-bold transition ${
                    !showTacticalRec
                      ? 'bg-slate-800 border border-slate-600 text-slate-200'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Recommendations Off
                </button>
              </div>
              <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-950 rounded-xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => handleSetAiAdviceHudPosition('bottom')}
                  className={`py-2 px-2 rounded-lg text-xs font-bold transition ${
                    aiAdviceHudPosition === 'bottom'
                      ? 'bg-sky-500/25 border border-sky-400/70 text-sky-200'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  ⬇️ AI Advice: Bottom of HUD (Default)
                </button>
                <button
                  type="button"
                  onClick={() => handleSetAiAdviceHudPosition('top')}
                  className={`py-2 px-2 rounded-lg text-xs font-bold transition ${
                    aiAdviceHudPosition === 'top'
                      ? 'bg-sky-500/25 border border-sky-400/70 text-sky-200'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  ⬆️ AI Advice: Top of HUD
                </button>
              </div>
            </div>

            {/* Overlay HUD Mode (Full vs. Compact) & 3x3 Matchup Matrix Visibility in Compact Mode */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-sky-400 flex items-center gap-2">
                  <span>📐 Overlay HUD Mode (Full vs. Compact) &amp; Compact 3×3 Matrix</span>
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-500/15 border border-sky-500/40 text-sky-300">
                  {overlayHudMode === 'compact'
                    ? `Compact HUD • 3×3 Matrix ${compactHudShowMatrix ? 'ON' : 'OFF (Def)'}`
                    : 'Full HUD (Def)'}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                <strong>Compact HUD</strong> shows only the Mirrored Header, 2-Line AI Tactical Coach, Shield Decision Card (on incoming charged attack), and Post-Battle Log. Tapping the top-left emblem on the overlay cycles <strong>Full → Compact → Minimized</strong>. In idle (<code>Waiting...</code>) state, both Full and Compact HUDs display your selected League, Team Name, and 3 Team Pokémon, and Compact HUD auto-hides the action toolbar once battle begins.
              </p>
              <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-950 rounded-xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => handleSetOverlayHudMode('full')}
                  className={`py-2 px-2 rounded-lg text-xs font-bold transition ${
                    overlayHudMode === 'full'
                      ? 'bg-sky-500/25 border border-sky-400/70 text-sky-200'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  📐 Full HUD (Default)
                </button>
                <button
                  type="button"
                  onClick={() => handleSetOverlayHudMode('compact')}
                  className={`py-2 px-2 rounded-lg text-xs font-bold transition ${
                    overlayHudMode === 'compact'
                      ? 'bg-emerald-500/25 border border-emerald-400/70 text-emerald-200'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  ⚡ Compact HUD
                </button>
              </div>
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-300">📊 3×3 Matchup Matrix in Compact HUD</span>
                  <span className="text-[10px] font-mono text-slate-400">
                    {compactHudShowMatrix ? 'Visible in Compact Mode' : 'Hidden in Compact Mode (Default)'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-950 rounded-xl border border-slate-800">
                  <button
                    type="button"
                    onClick={() => handleSetCompactHudShowMatrix(false)}
                    className={`py-2 px-2 rounded-lg text-xs font-bold transition ${
                      !compactHudShowMatrix
                        ? 'bg-slate-800 border border-slate-600 text-slate-200'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    📊 3×3 Matrix in Compact: OFF (Default)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetCompactHudShowMatrix(true)}
                    className={`py-2 px-2 rounded-lg text-xs font-bold transition ${
                      compactHudShowMatrix
                        ? 'bg-emerald-500/25 border border-emerald-400/70 text-emerald-200'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    📊 3×3 Matrix in Compact: ON
                  </button>
                </div>
              </div>
            </div>

            {/* v6.02 Default ON Settings: Live HP Bar Tracking & Live Energy Counting */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-emerald-400 flex items-center gap-2">
                  <span>❤️ Live HP Bar Tracking (Overlay • v6.02 Default ON)</span>
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/40 text-emerald-300">
                  {enableHpTracking ? 'ON (Default)' : 'OFF'}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                <strong>Enabled by default in v6.02</strong>. Displays live Player &amp; Opponent HP% badges on the floating overlay header, 3v3 matrix rows, and team buttons, and powers 25s faint KO sync and swap-throw attribution.
              </p>
              <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-950 rounded-xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => handleSetEnableHpTracking(true)}
                  className={`py-2 px-2 rounded-lg text-xs font-bold transition ${
                    enableHpTracking
                      ? 'bg-emerald-500/25 border border-emerald-400/70 text-emerald-200'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  HP Tracking: ON (Default)
                </button>
                <button
                  type="button"
                  onClick={() => handleSetEnableHpTracking(false)}
                  className={`py-2 px-2 rounded-lg text-xs font-bold transition ${
                    !enableHpTracking
                      ? 'bg-slate-800 border border-slate-600 text-slate-200'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  HP Tracking: OFF
                </button>
              </div>
            </div>

            {/* v3.89 HP Bar Meter Debounce & Upward Self-Correction Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-emerald-400 flex items-center gap-2">
                    <span>❤️ HP Bar Meter Debounce &amp; Upward Self-Correction (v6.02)</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Requires <strong>N consecutive matching HP bar samples</strong> (<code>±2%</code> default tolerance) before updating, detects lethal disappearing HP bar KOs, and immediately <strong>self-corrects upward</strong> on clean stable HP bars.
                  </p>
                </div>
              </div>

              <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-3 font-mono text-[11px] text-emerald-200 space-y-1">
                <div>
                  • Active: {hpDebounceSamples} Matching Samples ({hpDebounceSamples === 2 ? 'Default • Fastest Response' : hpDebounceSamples === 3 ? 'Balanced Noise Rejection' : 'Strict Filtering'}, ±2% HP Tolerance)
                </div>
                <div>• Lethal Disappearing HP Bar KO Sync: Enabled (25s faint-to-throw retroactive window)</div>
                <div>• Shield Call Prompts: Always corrects with clean stable HP meters</div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300 block">
                  Matching HP Samples Required (±2% Tolerance)
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {([2, 3, 4] as const).map((cnt) => (
                    <button
                      key={cnt}
                      type="button"
                      onClick={() => updateHpDebounceSamples(cnt)}
                      className={`py-2 px-3 rounded-xl text-xs font-bold border transition ${
                        hpDebounceSamples === cnt
                          ? 'bg-emerald-500/25 border-emerald-400 text-emerald-200 shadow'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {cnt} Samples {cnt === 2 ? '(Def)' : ''}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-sky-400 flex items-center gap-2">
                  <span>⚡ Live Energy &amp; Fast-Move Counting (Overlay • v6.02 Default ON)</span>
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-500/15 border border-sky-500/40 text-sky-300">
                  {enableEnergyTracking ? 'ON (Default)' : 'OFF'}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                <strong>Enabled by default in v6.02</strong>. Runs the predictive + self-correcting fast-move energy loop with 2nd-move tap lag compensation and displays live Energy &amp; Charged Move READY badges on the overlay.
              </p>
              <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-950 rounded-xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => handleSetEnableEnergyTracking(true)}
                  className={`py-2 px-2 rounded-lg text-xs font-bold transition ${
                    enableEnergyTracking
                      ? 'bg-sky-500/25 border border-sky-400/70 text-sky-200'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Energy Counting: ON (Default)
                </button>
                <button
                  type="button"
                  onClick={() => handleSetEnableEnergyTracking(false)}
                  className={`py-2 px-2 rounded-lg text-xs font-bold transition ${
                    !enableEnergyTracking
                      ? 'bg-slate-800 border border-slate-600 text-slate-200'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Energy Counting: OFF
                </button>
              </div>
            </div>

            {/* v6.02 Energy Meter Debounce, Proactive ~200ms Lead & Slowest Move Snap Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-sky-400 flex items-center gap-2">
                    <span>⚡ Energy Meter Debounce &amp; Proactive Lead (v6.02)</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Combines a low-latency <strong>circle fill debounce</strong> (<code>±2%</code> tolerance) on your slowest charge move (<code>max(cost1, cost2)</code>) with <strong>Proactive Fast-Move Energy Lead</strong> (default <code>200ms</code> early, matching 2-sample debounce latency at 10Hz).
                  </p>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-slate-300 space-y-1">
                <div>• <strong className="text-sky-400">Active Debounce</strong> = {energyDebounceSamples} Matching Samples <span className="text-slate-500">(Default: 2 • ±2% Circle Fill Tolerance)</span></div>
                <div>• <strong className="text-cyan-300">Proactive Energy Lead</strong> = {proactiveEnergyLeadMs === 0 ? 'Off (0ms)' : `${proactiveEnergyLeadMs}ms Early`} <span className="text-slate-500">(Default: 200ms • Auto-rollback if circle lags &gt; 500ms)</span></div>
                <div>• <strong className="text-emerald-300">2nd-Move Tap Lag Credit</strong> = Credits +1 in-flight fast move when circle peak + 1 fast move covers 2nd move cost</div>
                <div>• <strong className="text-amber-300">ENERGY_CAP_DRIFT Filter</strong> = Suppresses false cap-drift logs when tracked energy already covers thrown move</div>
                <div>• <strong className="text-violet-300">Live Energy Update Toasts</strong> = {energyUpdateToasts ? 'Enabled (⚡ [Move] ([Cost]E) • Circle [X]% → [Y]E)' : 'Muted'}</div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {([2, 3, 4] as const).map((cnt) => (
                  <button
                    key={cnt}
                    type="button"
                    onClick={() => updateEnergyDebounceSamples(cnt)}
                    className={`px-3 py-2.5 rounded-xl text-xs font-bold border transition whitespace-nowrap ${
                      energyDebounceSamples === cnt
                        ? 'bg-sky-600 border-sky-400 text-white shadow-lg shadow-sky-900/30'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                    }`}
                  >
                    {cnt === 2 ? '2 Samples (Default)' : cnt === 3 ? '3 Samples (Balanced)' : '4 Samples (Strict)'}
                  </button>
                ))}
              </div>

              {/* v6.02 Proactive Fast-Move Energy Lead Selector */}
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-sky-300">
                    ⚡ Proactive Fast-Move Energy Lead Time (v6.02 Default: 200ms)
                  </label>
                  <span className="text-[10px] font-mono text-sky-400">
                    {proactiveEnergyLeadMs === 0 ? 'Off (0ms)' : `${proactiveEnergyLeadMs}ms Early • >500ms Lag Rollback`}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Applies Player &amp; Opponent fast-move energy and turn counts early before the 200ms debounce finishes so energy transitions right on the turn boundary without phantom pre-turn ticks.
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {([0, 200, 300, 400] as const).map((leadVal) => (
                    <button
                      key={leadVal}
                      type="button"
                      onClick={() => updateProactiveEnergyLeadMs(leadVal)}
                      className={`px-2.5 py-2 rounded-xl text-xs font-bold border transition whitespace-nowrap ${
                        proactiveEnergyLeadMs === leadVal
                          ? 'bg-sky-600 border-sky-400 text-white shadow-lg shadow-sky-900/30'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                      }`}
                    >
                      {leadVal === 0 ? 'Off (0ms)' : leadVal === 200 ? '200ms (Def)' : `${leadVal}ms`}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-800">
                <div>
                  <div className="text-xs font-bold text-slate-200">⚡ Live Energy &amp; Circle % Battle Toasts</div>
                  <div className="text-[11px] text-slate-400">
                    {energyUpdateToasts
                      ? 'Active: Displays ⚡ [Move] ([Cost]E) • Circle [X]% → [Y]E on every energy change'
                      : 'Muted: Hides diagnostic energy update toasts during battle'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={toggleEnergyUpdateToasts}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition shrink-0 whitespace-nowrap ${
                    energyUpdateToasts
                      ? 'bg-emerald-600 border-emerald-400 text-white'
                      : 'bg-slate-800 border-slate-700 text-slate-400'
                  }`}
                >
                  {energyUpdateToasts ? 'Toasts On' : 'Toasts Off'}
                </button>
              </div>
            </div>

            {/* v6.02 Non-Standard Opponent Fast Move Detection Turn Offset (0 / +1 Default / +2 / +3 Turns) & Strictness */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-amber-400 flex items-center gap-2">
                  <span>🔍 Non-Standard Fast Move Detection Offset &amp; Strictness (v6.02)</span>
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/40 text-amber-300">
                  +{fastDetectTurnOffset}t {fastDetectTurnOffset === 1 ? '(Def)' : ''} • {altFastDetectStrictness.toUpperCase()}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Default <code>+1 Turn</code> waits <code>500ms</code> after a multi-turn fast move hits so the player&apos;s HP bar animation finishes draining before comparing standard vs. non-standard fast move damage. <strong>Strict (Default)</strong> requires <code>&ge; 10</code> elapsed turns, <code>&ge; 3</code> completed cycles, <code>&ge; 12%</code> cumulative fast damage, and blocks un-inferable <code>Hidden Power (*)</code> overrides.
              </p>
              <div className="grid grid-cols-4 gap-1.5 p-1 bg-slate-950 rounded-xl border border-slate-800">
                {([0, 1, 2, 3] as const).map((offsetVal) => (
                  <button
                    key={offsetVal}
                    type="button"
                    onClick={() => handleSetFastDetectTurnOffset(offsetVal)}
                    className={`py-2 px-2 rounded-lg text-xs font-bold transition ${
                      fastDetectTurnOffset === offsetVal
                        ? 'bg-amber-500/25 border border-amber-400/70 text-amber-200'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    +{offsetVal} {offsetVal === 1 ? 'Turn (Def)' : offsetVal === 0 ? 'Turns' : 'Turns'}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-950 rounded-xl border border-slate-800">
                {(['strict', 'balanced', 'aggressive'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => handleSetAltFastDetectStrictness(mode)}
                    className={`py-2 px-2 rounded-lg text-xs font-bold transition ${
                      altFastDetectStrictness === mode
                        ? 'bg-emerald-500/25 border border-emerald-400/70 text-emerald-200'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {mode === 'strict' ? 'Strict (Def • ≥3 Cyc)' : mode === 'balanced' ? 'Balanced (≥2 Cyc)' : 'Aggressive (1 Cyc)'}
                  </button>
                ))}
              </div>
            </div>

            {/* v6.02 Swap-Throw Rollback, Pre-Zoom Shield Chip Tolerance & 5-Profile Shadow Telemetry Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-cyan-400 flex items-center gap-2">
                  <span>🔄 Swap-Throw Attribution Rollback, Shield Chip Tolerance &amp; Shadow Telemetry (v6.02)</span>
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/15 border border-cyan-500/40 text-cyan-300">
                  Chip ≤{shieldChipTolerancePct}% • Rollback {swapThrowRollbackWindowMs === 0 ? 'Off' : `${(swapThrowRollbackWindowMs / 1000).toFixed(1)}s`}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Matches <code>&quot;&lt;Pokemon&gt; used &lt;Move&gt;!&quot;</code> against all 3 user slots, known opponent bench slots, and the full PvPoke database when a Pokémon swaps in and immediately throws before nameplate OCR updates. If top nameplate OCR reveals a new Pokémon within the rollback window whose moveset owns the move, SilphScope refunds the previous slot&apos;s energy and transfers move lock + deduction to the newly swapped Pokémon.
              </p>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300 block">
                  🛡️ Pre-Zoom Fast-Move Chip Shield Tolerance (Treats ≤X% HP drop during charged move zoom as Shielded + 1 fast move)
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {([3, 6, 8, 10] as const).map((tol) => (
                    <button
                      key={tol}
                      type="button"
                      onClick={() => handleSetShieldChipTolerancePct(tol)}
                      className={`py-2 px-2 rounded-xl text-xs font-bold border transition ${
                        shieldChipTolerancePct === tol
                          ? 'bg-sky-500/25 border-sky-400 text-sky-200'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      ≤{tol}%{tol === 8 ? ' (Def)' : ''}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-800">
                <label className="text-xs font-bold text-slate-300 block">
                  🔄 Post-Throw Nameplate Swap Rollback Window (Refunds old slot &amp; transfers energy/move lock on late swap OCR)
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {([0, 3000, 4000, 5000] as const).map((winMs) => (
                    <button
                      key={winMs}
                      type="button"
                      onClick={() => handleSetSwapThrowRollbackWindowMs(winMs)}
                      className={`py-2 px-2 rounded-xl text-xs font-bold border transition ${
                        swapThrowRollbackWindowMs === winMs
                          ? 'bg-emerald-500/25 border-emerald-400 text-emerald-200'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {winMs === 0 ? 'Off (0s)' : winMs === 4000 ? '4.0s (Def)' : `${(winMs / 1000).toFixed(1)}s`}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 font-mono text-[11px] text-slate-300 space-y-1">
                <div className="text-cyan-300 font-bold">📊 Zero-Lag Post-Battle 5-Profile Shadow Telemetry (0% Active Combat CPU Overhead):</div>
                <div>• Records lightweight scalar ticks during battle and replays 5 candidate profiles once after battle ends:</div>
                <div className="text-slate-400 pl-2">1. <strong className="text-emerald-300">ACTIVE_USER</strong> (Your live GUI settings) vs. 2. <strong className="text-sky-300">V602_RECOMMENDED</strong> (2-sample, ±2%, 200ms, +1t, Strict)</div>
                <div className="text-slate-400 pl-2">3. <strong className="text-amber-300">ULTRA_FAST_150MS</strong> vs. 4. <strong className="text-violet-300">CONSERVATIVE_3_SAMPLE</strong> vs. 5. <strong className="text-rose-300">AGGRESSIVE_ALT_FAST</strong></div>
              </div>
            </div>

            {/* 5-Tier 0s/1s/2s Matchup Rating Thresholds Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-sky-400 flex items-center gap-2">
                    <Target className="w-4 h-4" />
                    <span>🎯 5-Tier 0s/1s/2s Matchup Thresholds (SW, W, N, L, SL)</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Configure rating cutoffs used to compute 0s/1s/2s matchup codes and lead classifications. Defaults shown in ().
                  </p>
                </div>
                <button
                  type="button"
                  onClick={restoreDefaultTierThresholds}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold transition shrink-0"
                >
                  ↺ Restore Defaults (620 / 530 / 470 / 380)
                </button>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-slate-300 space-y-1">
                <div>• <strong className="text-emerald-400">SW</strong> = Strong Win (rating &gt;= {tierThresholds.swMin}) <span className="text-slate-500">(Default: 620)</span></div>
                <div>• <strong className="text-green-300">W</strong>  = Win ({tierThresholds.wMin} &lt;= rating &lt; {tierThresholds.swMin}) <span className="text-slate-500">(Default: 530 &lt;= rating &lt; 620)</span></div>
                <div>• <strong className="text-slate-400">N</strong>  = Neutral / Grey ({tierThresholds.lMax} &lt; rating &lt; {tierThresholds.wMin}) <span className="text-slate-500">(Default: 470 &lt; rating &lt; 530)</span></div>
                <div>• <strong className="text-rose-300">L</strong>  = Loss ({tierThresholds.slMax} &lt; rating &lt;= {tierThresholds.lMax}) <span className="text-slate-500">(Default: 380 &lt; rating &lt;= 470)</span></div>
                <div>• <strong className="text-rose-500">SL</strong> = Strong Loss (rating &lt;= {tierThresholds.slMax}) <span className="text-slate-500">(Default: &lt;= 380)</span></div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-emerald-400 mb-1">
                    SW Strong Win &gt;= (620)
                  </label>
                  <input
                    type="number"
                    value={tierThresholds.swMin}
                    placeholder="(620)"
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      if (!Number.isNaN(val)) {
                        updateTierThresholds({ ...tierThresholds, swMin: val });
                      }
                    }}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-green-300 mb-1">
                    W Win &gt;= (530)
                  </label>
                  <input
                    type="number"
                    value={tierThresholds.wMin}
                    placeholder="(530)"
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      if (!Number.isNaN(val)) {
                        updateTierThresholds({ ...tierThresholds, wMin: val });
                      }
                    }}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-rose-300 mb-1">
                    L Loss &lt;= (470)
                  </label>
                  <input
                    type="number"
                    value={tierThresholds.lMax}
                    placeholder="(470)"
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      if (!Number.isNaN(val)) {
                        updateTierThresholds({ ...tierThresholds, lMax: val });
                      }
                    }}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-rose-500 mb-1">
                    SL Strong Loss &lt;= (380)
                  </label>
                  <input
                    type="number"
                    value={tierThresholds.slMax}
                    placeholder="(380)"
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      if (!Number.isNaN(val)) {
                        updateTierThresholds({ ...tierThresholds, slMax: val });
                      }
                    }}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Core Coverage BR (Core BR) Thresholds Card (Dedicated 3-Mon Core Coverage Scale) */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-emerald-400 flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    <span>🛡️ Core Coverage BR Thresholds (Core BR — 3-Mon Team Ceiling)</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Because Core Coverage BR (Core BR) takes the best counter across all 3 team members against the Top-100 blended season field, it naturally scores higher than single-mon Lead/Swap BR. Customize its 5-tier color scale below.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={restoreDefaultMachineBrThresholds}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold transition shrink-0"
                >
                  ↺ Restore Defaults (650 / 610 / 580 / 540)
                </button>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-slate-300 space-y-1">
                <div>• <strong className="text-emerald-400">Elite Core</strong> = Dominant 3-Mon Coverage (Core BR &gt;= {machineBrThresholds.eliteMin}) <span className="text-slate-500">(Default: 650)</span></div>
                <div>• <strong className="text-green-300">Solid Core</strong> = Well-Rounded Coverage ({machineBrThresholds.solidMin} &lt;= Core BR &lt; {machineBrThresholds.eliteMin}) <span className="text-slate-500">(Default: 610–649)</span></div>
                <div>• <strong className="text-amber-300">Playable</strong> = Manageable Coverage ({machineBrThresholds.playableMin} &lt;= Core BR &lt; {machineBrThresholds.solidMin}) <span className="text-slate-500">(Default: 580–609)</span></div>
                <div>• <strong className="text-rose-300">Risky</strong> = Core Blindspot Warning ({machineBrThresholds.riskyMin} &lt;= Core BR &lt; {machineBrThresholds.playableMin}) <span className="text-slate-500">(Default: 540–579)</span></div>
                <div>• <strong className="text-rose-500">Severe Blindspot</strong> = Triple/Core Weakness (Core BR &lt; {machineBrThresholds.riskyMin}) <span className="text-slate-500">(Default: &lt; 540)</span></div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-emerald-400 mb-1">
                    Elite Core &gt;= (650)
                  </label>
                  <input
                    type="number"
                    value={machineBrThresholds.eliteMin}
                    placeholder="(650)"
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      if (!Number.isNaN(val)) {
                        updateMachineBrThresholds({ ...machineBrThresholds, eliteMin: val });
                      }
                    }}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-green-300 mb-1">
                    Solid Core &gt;= (610)
                  </label>
                  <input
                    type="number"
                    value={machineBrThresholds.solidMin}
                    placeholder="(610)"
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      if (!Number.isNaN(val)) {
                        updateMachineBrThresholds({ ...machineBrThresholds, solidMin: val });
                      }
                    }}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-amber-300 mb-1">
                    Playable &gt;= (580)
                  </label>
                  <input
                    type="number"
                    value={machineBrThresholds.playableMin}
                    placeholder="(580)"
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      if (!Number.isNaN(val)) {
                        updateMachineBrThresholds({ ...machineBrThresholds, playableMin: val });
                      }
                    }}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-rose-300 mb-1">
                    Risky &gt;= (540)
                  </label>
                  <input
                    type="number"
                    value={machineBrThresholds.riskyMin}
                    placeholder="(540)"
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      if (!Number.isNaN(val)) {
                        updateMachineBrThresholds({ ...machineBrThresholds, riskyMin: val });
                      }
                    }}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono"
                  />
                </div>
              </div>
            </div>

            {/* ===================================================================
                CARD 3: MULTI-DEVICE CLOUD & DELTA SYNC
               =================================================================== */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-bold text-white block">
                    ☁️ Multi-Device Auto Delta Sync (Teams + Battle Logs)
                  </span>
                  <span className="text-xs text-slate-400">
                    Sign in with GitHub once on each device. Each user&apos;s logs sync privately to their own GitHub account across unlimited devices.
                  </span>
                </div>
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  Per-User Vault
                </span>
              </div>

              <div className="flex flex-wrap gap-2">
                <a
                  href="https://github.com/settings/tokens/new?description=SilphScope+PvP+Cloud+Sync&scopes=gist"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-lg shadow-emerald-600/20"
                >
                  🔑 Login with GitHub (Generate Sync Token)
                </a>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <input
                  type="password"
                  value={githubGistToken}
                  onChange={(e) => {
                    setGithubGistToken(e.target.value);
                    try {
                      localStorage.setItem('gbl_sync_github_token', e.target.value);
                    } catch {}
                  }}
                  placeholder="GitHub OAuth / Personal Access Token (Auto-filled on Android Login)"
                  className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500"
                />
                <input
                  type="text"
                  value={githubGistId}
                  onChange={(e) => {
                    setGithubGistId(e.target.value);
                    try {
                      localStorage.setItem('gbl_sync_github_gist_id', e.target.value);
                    } catch {}
                  }}
                  placeholder="Optional Gist Vault ID (Auto-discovered per user account)"
                  className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 font-mono"
                />
              </div>

              <div className="text-[11px] font-mono text-emerald-400">
                Status: {lastCloudSyncStatus}
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={isSyncingCloud}
                  onClick={async () => {
                    const tok = githubGistToken.trim();
                    if (!tok) {
                      alert('Tap "🔑 Login with GitHub" above to generate a token, or use Export/Import Bundle.');
                      return;
                    }
                    setIsSyncingCloud(true);
                    setLastCloudSyncStatus('Reconciling deltas with GitHub Gist...');
                    try {
                      let mergedLogs = [...battleLogs];
                      let mergedPresets = [...presets];
                      let mergedTombstones = new Set<string>(deletedLogIds);
                      let activeGistId = githubGistId.trim();

                      if (activeGistId) {
                        const getRes = await fetch(`https://api.github.com/gists/${activeGistId}`, {
                          headers: {
                            Authorization: `Bearer ${tok}`,
                            Accept: 'application/vnd.github+json'
                          }
                        });
                        if (getRes.ok) {
                          const gistJson = await getRes.json();
                          const content = gistJson?.files?.['gbl_delta_sync_v2.json']?.content;
                          if (content) {
                            const remote = JSON.parse(content);
                            if (Array.isArray(remote.deletedLogIds)) {
                              remote.deletedLogIds.forEach((id: string) => mergedTombstones.add(id));
                            }
                            if (Array.isArray(remote.battleLogs)) {
                              const logMap = new Map<string, WebBattleLogEntry>();
                              mergedLogs.forEach((l) => {
                                if (!mergedTombstones.has(l.id)) logMap.set(l.id, l);
                              });
                              remote.battleLogs.forEach((r: WebBattleLogEntry) => {
                                if (!r?.id || mergedTombstones.has(r.id)) return;
                                const existing = logMap.get(r.id);
                                if (!existing || (r.updatedAt || r.timestampMs) > (existing.updatedAt || existing.timestampMs)) {
                                  logMap.set(r.id, r);
                                }
                              });
                              mergedLogs = Array.from(logMap.values()).sort((a, b) => b.timestampMs - a.timestampMs);
                            }
                            if (Array.isArray(remote.teamPresets)) {
                              const pMap = new Map<string, TeamPreset>();
                              mergedPresets.forEach((p) => pMap.set(p.id, p));
                              remote.teamPresets.forEach((rp: TeamPreset) => {
                                if (rp?.id) pMap.set(rp.id, rp);
                              });
                              mergedPresets = Array.from(pMap.values());
                            }
                          }
                        }
                      }

                      saveBattleLogsToStorage(mergedLogs);
                      setPresets(mergedPresets);
                      const tombArr = Array.from(mergedTombstones);
                      setDeletedLogIds(tombArr);
                      localStorage.setItem('gbl_deleted_log_ids_v1', JSON.stringify(tombArr));

                      const bundleStr = JSON.stringify(
                        {
                          schemaVersion: 2,
                          exportedAt: Date.now(),
                          deviceId,
                          teamPresets: mergedPresets,
                          battleLogs: mergedLogs,
                          deletedLogIds: tombArr
                        },
                        null,
                        2
                      );

                      const url = activeGistId
                        ? `https://api.github.com/gists/${activeGistId}`
                        : 'https://api.github.com/gists';
                      const upRes = await fetch(url, {
                        method: activeGistId ? 'PATCH' : 'POST',
                        headers: {
                          Authorization: `Bearer ${tok}`,
                          Accept: 'application/vnd.github+json',
                          'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                          description: 'SilphScope PvP v3.10 Multi-Device Delta Sync Vault',
                          public: false,
                          files: {
                            'gbl_delta_sync_v2.json': { content: bundleStr }
                          }
                        })
                      });
                      if (upRes.ok) {
                        const upJson = await upRes.json();
                        if (upJson.id) {
                          setGithubGistId(upJson.id);
                          localStorage.setItem('gbl_sync_github_gist_id', upJson.id);
                        }
                        const ts = `${new Date().toLocaleTimeString()} • ${mergedLogs.length} battles, ${mergedPresets.length} teams`;
                        setLastCloudSyncStatus(`Synced ${ts}`);
                        localStorage.setItem('gbl_last_cloud_sync_ts', `Synced ${ts}`);
                      } else {
                        setLastCloudSyncStatus(`Sync HTTP ${upRes.status}`);
                      }
                    } catch (err: any) {
                      setLastCloudSyncStatus(`Sync error: ${err?.message || 'failed'}`);
                    } finally {
                      setIsSyncingCloud(false);
                    }
                  }}
                  className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition"
                >
                  {isSyncingCloud ? 'Syncing...' : '🔄 Sync Now'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const bundle = JSON.stringify(
                      {
                        schemaVersion: 2,
                        exportedAt: Date.now(),
                        deviceId,
                        teamPresets: presets,
                        battleLogs,
                        deletedLogIds
                      },
                      null,
                      2
                    );
                    navigator.clipboard.writeText(bundle);
                    setLastCloudSyncStatus('Delta Sync Bundle copied to clipboard!');
                  }}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-sky-300 text-xs font-bold transition"
                >
                  📤 Copy Delta Bundle
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setImportBundleText('');
                    setShowImportBundleModal(true);
                  }}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-amber-300 text-xs font-bold transition"
                >
                  📥 Import &amp; Reconcile Bundle
                </button>
              </div>
            </div>

            {/* ===================================================================
                CARD 3B: 1-BATTLE FULL-SCREEN DVR & ENHANCED ENERGY/HP DIAGNOSTICS (v6.42)
               =================================================================== */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                <div>
                  <span className="text-sm font-bold text-white block">
                    🎥 1-Battle Full-Screen DVR + Deep Frame Trace &amp; Energy/HP Diagnostics (v6.42)
                  </span>
                  <span className="text-xs text-slate-400">
                    Zero-lag hardware H.264 544×1184 recording reusing existing OCR frames with burned-in timestamp header (<code className="text-amber-300">F#0042 T+14.35s U:88%(88%)/35E O:23%(23%)/7E</code>) + frame-by-frame <code className="text-sky-300">_deep_trace.jsonl</code>. Requires a custom (non-random) Debug ID; the overlay DVR button appears immediately when the overlay or battle starts so you can arm before combat begins.
                  </span>
                </div>
                <span
                  className={`px-2.5 py-1 rounded-xl text-[10px] font-bold font-mono shrink-0 border ${
                    isOneBattleDvrArmed
                      ? 'bg-rose-500/20 border-rose-500/50 text-rose-300'
                      : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}
                >
                  {isOneBattleDvrArmed ? '🔴 ARMED (1 BATTLE)' : '⚪ DISARMED'}
                </span>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const next = !showOneBattleDvrBtn;
                    setShowOneBattleDvrBtn(next);
                    try {
                      localStorage.setItem('gbl_show_one_battle_dvr_btn', String(next));
                    } catch {}
                  }}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition ${
                    showOneBattleDvrBtn
                      ? 'bg-sky-600 border-sky-400 text-white'
                      : 'bg-slate-950 border-slate-800 text-slate-300'
                  }`}
                >
                  🎥 Overlay 1-Battle DVR Btn: {showOneBattleDvrBtn ? 'ON' : 'OFF'}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const next = !isOneBattleDvrArmed;
                    setIsOneBattleDvrArmed(next);
                    try {
                      localStorage.setItem('gbl_arm_one_battle_dvr', String(next));
                    } catch {}
                  }}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition ${
                    isOneBattleDvrArmed
                      ? 'bg-rose-600 border-rose-400 text-white shadow-lg shadow-rose-600/25'
                      : 'bg-amber-600 hover:bg-amber-500 border-amber-400 text-white'
                  }`}
                >
                  {isOneBattleDvrArmed ? '🔴 DVR ARMED (Tap to Disarm)' : '🔴 Arm 1-Battle DVR'}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] font-mono pt-1">
                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-sky-400 font-bold block">1. Raw vs. Committed HP% + Row Y</span>
                  <span className="text-slate-400">Logs raw pixel fill, committed debounced HP%, and locked scan row Y every tick.</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-amber-400 font-bold block">2. Post-Cutscene Dual-HP Audit</span>
                  <span className="text-slate-400">Audits +220ms, +650ms &amp; +1200ms HP rescans for both players after every charged move.</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-emerald-400 font-bold block">3. Energy Mutation Ledger</span>
                  <span className="text-slate-400">Tracks FAST_CADENCE, CIRCLE_FILL_SYNC, POST_THROW_DEDUCT, SWAP_BANK &amp; RETRO_FIX.</span>
                </div>
              </div>
            </div>

            {/* ===================================================================
                CARD 4: PVPOKE DATABASE & RETROACTIVE REPARSE MAINTENANCE
               =================================================================== */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <span className="text-sm font-bold text-white block">
                    PvPoke Live Database &amp; Selected League Rankings ({dbTelemetry.selectedLeagues.length} Leagues)
                  </span>
                  <span className="text-xs text-slate-400 font-mono">
                    Last Updated: <strong className="text-emerald-400">{lastSyncedAt}</strong>
                  </span>
                </div>
                <button
                  onClick={handleManualPvPokeSync}
                  disabled={isSyncingPvPoke}
                  className="px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold flex items-center gap-1.5 transition shrink-0 shadow-lg shadow-sky-600/20"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncingPvPoke ? 'animate-spin' : ''}`} />
                  <span>{isSyncingPvPoke ? 'Syncing...' : 'Sync PvPoke'}</span>
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-2 text-center text-xs font-mono">
                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-slate-400 block text-[10px]">GameMaster</span>
                  <strong className="text-white text-sm">{dbTelemetry.gmCount}</strong>
                </div>
                {dbTelemetry.selectedLeagues.map((lg) => (
                  <div key={lg.key} className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-sky-400 block text-[10px] truncate" title={lg.key}>
                      {lg.shortLabel}
                    </span>
                    <strong className="text-white text-sm">{lg.count}</strong>
                  </div>
                ))}
              </div>
            </div>

            {/* ===================================================================
                CARD 4B: BATTLE FRONTIER META USAGE & MOST-USED CORES GOOGLE SHEETS + WEIGHTING SLIDER
               =================================================================== */}
            <div className="bg-slate-900 border border-amber-500/40 rounded-2xl p-5 shadow-xl space-y-4">
              {(() => {
                const glMons = (BATTLE_FRONTIER_USAGE_MAP['GREAT LEAGUE'] || []).length;
                const glCores = (BATTLE_FRONTIER_CORES_MAP['GREAT LEAGUE'] || []).length;
                const specMons = (BATTLE_FRONTIER_USAGE_MAP['Battle Frontier (Spectral)'] || []).length;
                const specCores = (BATTLE_FRONTIER_CORES_MAP['Battle Frontier (Spectral)'] || []).length;
                const caulMons = (BATTLE_FRONTIER_USAGE_MAP['Battle Frontier (Cauldron)'] || []).length;
                const caulCores = (BATTLE_FRONTIER_CORES_MAP['Battle Frontier (Cauldron)'] || []).length;
                const mlMons = (BATTLE_FRONTIER_USAGE_MAP['Battle Frontier (Master)'] || []).length;
                const mlCores = (BATTLE_FRONTIER_CORES_MAP['Battle Frontier (Master)'] || []).length;
                const totalMons = glMons + specMons + caulMons + mlMons;
                const totalCores = glCores + specCores + caulCores + mlCores;
                return (
                  <>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                      <div>
                        <span className="text-sm font-extrabold text-amber-300 block">
                          🏛️ Battle Frontier Show 6 Meta Usage (Week - All) &amp; Most-Used Cores Sync
                        </span>
                        <span className="text-xs text-slate-400 font-mono">
                          Status: <strong className="text-emerald-400">{bfSheetSyncStatus}</strong>
                        </span>
                      </div>
                      <span className="px-2.5 py-1 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-200 text-[10px] font-bold font-mono shrink-0">
                        Total: {totalMons} Mons • {totalCores} Cores (4 Leagues)
                      </span>
                    </div>

                    {/* Per-League & Total Count Breakdown Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center font-mono text-xs">
                      <div className="p-2 rounded-xl bg-slate-950 border border-slate-800">
                        <span className="text-sky-400 block text-[10px] font-bold">Great League</span>
                        <strong className="text-white text-xs">{glMons} Mons • {glCores} Cores</strong>
                      </div>
                      <div className="p-2 rounded-xl bg-slate-950 border border-slate-800">
                        <span className="text-purple-400 block text-[10px] font-bold">Spectral Cup</span>
                        <strong className="text-white text-xs">{specMons} Mons • {specCores} Cores</strong>
                      </div>
                      <div className="p-2 rounded-xl bg-slate-950 border border-slate-800">
                        <span className="text-amber-400 block text-[10px] font-bold">Cauldron Cup</span>
                        <strong className="text-white text-xs">{caulMons} Mons • {caulCores} Cores</strong>
                      </div>
                      <div className="p-2 rounded-xl bg-slate-950 border border-slate-800">
                        <span className="text-rose-400 block text-[10px] font-bold">Master League</span>
                        <strong className="text-white text-xs">{mlMons} Mons • {mlCores} Cores</strong>
                      </div>
                      <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 col-span-2 sm:col-span-1">
                        <span className="text-amber-300 block text-[10px] font-bold">All 4 Leagues</span>
                        <strong className="text-emerald-300 text-xs">{totalMons} Mons • {totalCores} Cores</strong>
                      </div>
                    </div>
                  </>
                );
              })()}

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">
                    1. Battle Frontier Meta Usage Sheet Link (Week - All / Cumulative Tab):
                  </label>
                  <input
                    type="text"
                    value={bfUsageSheetUrl}
                    onChange={(e) => setBfUsageSheetUrl(e.target.value)}
                    placeholder="https://docs.google.com/spreadsheets/d/.../edit?gid=466174368"
                    className="w-full bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-xl px-3 py-2 text-xs text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-300 mb-1">
                    2. Battle Frontier Most-Used Cores Sheet Link:
                  </label>
                  <input
                    type="text"
                    value={bfCoresSheetUrl}
                    onChange={(e) => setBfCoresSheetUrl(e.target.value)}
                    placeholder="https://docs.google.com/spreadsheets/d/.../edit?gid=94099054"
                    className="w-full bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-xl px-3 py-2 text-xs text-white font-mono"
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleSyncBattleFrontierSheets}
                    disabled={isSyncingBfSheets}
                    className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs flex items-center gap-2 shadow-lg transition"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncingBfSheets ? 'animate-spin' : ''}`} />
                    <span>
                      {isSyncingBfSheets
                        ? 'Importing Battle Frontier Sheets...'
                        : '📥 Save Links & Import Battle Frontier Usage + Cores'}
                    </span>
                  </button>
                  <span className="text-[11px] text-slate-400 font-mono">
                    {getBattleFrontierCountsSummary('Loaded')}
                  </span>
                </div>
              </div>

              {/* Show 6 Meta Fusion Weighting Slider (Default 65% Usage & Cores / 35% PvPoke Rankings) */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-white">
                    ⚖️ Show 6 Meta &amp; Core Weighting vs. Straight PvPoke Rankings
                  </span>
                  <span className="font-mono font-extrabold text-amber-300">
                    {show6UsageWeightPct}% Imported Usage &amp; Cores / {100 - show6UsageWeightPct}% PvPoke Rankings
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={show6UsageWeightPct}
                  onChange={(e) => handleChangeShow6UsageWeightPct(Number(e.target.value))}
                  className="w-full accent-amber-500 cursor-pointer"
                />
                <div className="flex justify-between items-center text-[10px] text-slate-400">
                  <span>0% (100% Straight PvPoke)</span>
                  <button
                    type="button"
                    onClick={() => handleChangeShow6UsageWeightPct(65)}
                    className="text-amber-300 hover:underline font-bold"
                  >
                    Reset Default (65% Usage &amp; Cores / 35% PvPoke)
                  </button>
                  <span>100% (Pure BF Usage &amp; Cores)</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            PAGE 3: GBL BATTLE LOG, SEASON EXPORT & INTERACTIVE POST-GAME REPLAY
           ========================================================================= */}
        {activeTab === 'battle_log' && (() => {
          const nowMs = Date.now();
          const currentSeason =
            seasonsList.find((s) => nowMs >= s.startMs && nowMs <= s.endMs) || seasonsList[0] || DEFAULT_SEASONS_FALLBACK[0];
          const currIdx = seasonsList.indexOf(currentSeason);
          const prevSeason =
            currIdx >= 0 && currIdx + 1 < seasonsList.length
              ? seasonsList[currIdx + 1]
              : DEFAULT_SEASONS_FALLBACK[1];

          const filterByRange = (
            entries: WebBattleLogEntry[],
            rangeCode: 'DAY' | 'YESTERDAY' | 'WEEK' | 'CURRENT_SEASON' | 'PREVIOUS_SEASON' | 'ALL'
          ) => {
            const startOfToday = new Date();
            startOfToday.setHours(0, 0, 0, 0);
            const startOfYesterday = new Date(startOfToday);
            startOfYesterday.setDate(startOfYesterday.getDate() - 1);
            const sevenDaysAgo = nowMs - 7 * 24 * 60 * 60 * 1000;
            const isPastGrace = nowMs > currentSeason.startMs + 14 * 24 * 60 * 60 * 1000;
            return entries.filter((e) => {
              if (webMembershipTier === 'free' && e.timestampMs < currentSeason.startMs && isPastGrace) {
                return false;
              }
              const leagueOk = matchesTwoTierLeagueFilter(
                e.league,
                logFilterCpTier,
                logFilterLeague,
                appCombatMode
              );
              const teamOk =
                logFilterTeamId === 'ALL TEAMS' ||
                e.presetId === logFilterTeamId ||
                e.userTeamName === presets.find((p) => p.id === logFilterTeamId)?.name;
              const timeOk =
                rangeCode === 'DAY'
                  ? e.timestampMs >= startOfToday.getTime()
                  : rangeCode === 'YESTERDAY'
                  ? e.timestampMs >= startOfYesterday.getTime() && e.timestampMs < startOfToday.getTime()
                  : rangeCode === 'WEEK'
                  ? e.timestampMs >= sevenDaysAgo
                  : rangeCode === 'CURRENT_SEASON'
                  ? e.timestampMs >= currentSeason.startMs && e.timestampMs <= currentSeason.endMs
                  : rangeCode === 'PREVIOUS_SEASON'
                  ? e.timestampMs >= prevSeason.startMs && e.timestampMs <= prevSeason.endMs
                  : true;
              return leagueOk && teamOk && timeOk;
            });
          };

          const filteredLogs = filterByRange(battleLogs, logFilterTimeframe);
          const wins = filteredLogs.filter((e) => e.result === 'WIN').length;
          const losses = filteredLogs.filter((e) => e.result === 'LOSS').length;
          const total = wins + losses;
          const winRate = total > 0 ? Math.round((wins * 100) / total) : 0;
          const favCount = filteredLogs.filter((e) => e.leadMatchup === 'FAVORABLE').length;
          const neuCount = filteredLogs.filter((e) => e.leadMatchup === 'NEUTRAL').length;
          const negCount = filteredLogs.filter((e) => e.leadMatchup === 'NEGATIVE').length;
          const aggregateWae = calculateAggregateWAE(filteredLogs, presets);

          // Group filtered logs by day for daily section headers with WAE
          const groupedByDay: Array<{ dayLabel: string; entries: WebBattleLogEntry[] }> = [];
          const dayMap = new Map<string, WebBattleLogEntry[]>();
          filteredLogs.forEach((entry) => {
            const dLabel = new Date(entry.timestampMs).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric'
            });
            const existing = dayMap.get(dLabel);
            if (existing) {
              existing.push(entry);
            } else {
              const arr = [entry];
              dayMap.set(dLabel, arr);
              groupedByDay.push({ dayLabel: dLabel, entries: arr });
            }
          });

          const formatExportPokemonName = (rawName: string): string => {
            let working = (rawName || '').trim();
            if (!working) return '';
            if (/^(unknown|waiting\.\.\.)$/i.test(working)) return working;

            let isShadow = false;
            let megaPrimalSuffix = '';

            const parenShadowRegex = /\(\s*shadow\s*\)/gi;
            if (parenShadowRegex.test(working)) {
              isShadow = true;
              working = working.replace(parenShadowRegex, ' ').trim();
            }

            const leadingShadowRegex = /^shadow[\s_-]+(?!rider\b)/i;
            if (leadingShadowRegex.test(working)) {
              isShadow = true;
              working = working.replace(leadingShadowRegex, '').trim();
            }

            const trailingShadowRegex = /[\s_-]+shadow$/i;
            if (trailingShadowRegex.test(working)) {
              isShadow = true;
              working = working.replace(trailingShadowRegex, '').trim();
            }

            if (
              working.length > 1 &&
              working.endsWith('S') &&
              /[a-z]/.test(working.slice(0, -1)) &&
              !/_MEGA_S$/i.test(working)
            ) {
              isShadow = true;
              working = working.slice(0, -1).trim();
            }

            const parenForms: string[] = [];
            const parenRegex = /\(([^)]+)\)/g;
            let match: RegExpExecArray | null;
            while ((match = parenRegex.exec(working)) !== null) {
              const inside = match[1].trim();
              if (!inside || /^(base|shadow)$/i.test(inside)) continue;
              const megaParenMatch = inside.match(/^mega(?:[\s_-]+([xy]))?$/i);
              if (megaParenMatch) {
                megaPrimalSuffix = megaParenMatch[1] ? `_MEGA_${megaParenMatch[1].toUpperCase()}` : '_MEGA';
              } else if (/^primal$/i.test(inside)) {
                megaPrimalSuffix = '_PRIMAL';
              } else if (/^[xy]$/i.test(inside) && /^mega[\s_-]+/i.test(working)) {
                megaPrimalSuffix = `_MEGA_${inside.toUpperCase()}`;
              } else {
                parenForms.push(inside);
              }
            }
            let basePart = working.replace(parenRegex, ' ').replace(/\s+/g, ' ').trim();
            let formPart = parenForms.join('_');

            const trailingMegaPrimalMatch = basePart.match(/^(.+?)[\s_-]+(mega(?:[\s_-]+[xy])?|primal)$/i);
            if (trailingMegaPrimalMatch) {
              basePart = trailingMegaPrimalMatch[1].trim();
              const mpRaw = trailingMegaPrimalMatch[2].trim();
              if (/^primal$/i.test(mpRaw)) {
                megaPrimalSuffix = '_PRIMAL';
              } else {
                const xy = mpRaw.match(/([xy])$/i);
                megaPrimalSuffix = xy ? `_MEGA_${xy[1].toUpperCase()}` : '_MEGA';
              }
            }

            const prefixFormRegex =
              /^(dusk[\s_-]+mane|dawn[\s_-]+wings|single[\s_-]+strike|rapid[\s_-]+strike|crowned[\s_-]+sword|crowned[\s_-]+shield|ice[\s_-]+rider|shadow[\s_-]+rider|galarian[\s_-]+standard|galarian[\s_-]+zen|paldean[\s_-]+combat|paldean[\s_-]+blaze|paldean[\s_-]+aqua|blue[\s_-]+striped|red[\s_-]+striped|white[\s_-]+striped|east[\s_-]+sea|west[\s_-]+sea|full[\s_-]+belly|pom[\s_-]+pom|kanto|kantonian|alolan|alola|galarian|galar|hisuian|hisui|paldean|paldea|unovan|unova|johto|hoenn|sinnoh|kalos|altered|origin|origine|therian|incarnate|crowned|hero|black|white|single|rapid|mega|primal|defense|attack|speed|normal|aria|pirouette|complete|unbound|confined|resolute|ordinary|sky|land|bloodmoon|armored|apex|wash|heat|frost|mow|fan|sunny|rainy|snowy|plant|trash|burn|chill|douse|shock|midnight|midday|dusk|baile|pau|pa'u|sensu|zen|standard|combat|blaze|aqua|hangry)[\s_-]+(.+)$/i;
            const prefixMatch = basePart.match(prefixFormRegex);
            if (prefixMatch) {
              const extractedPrefix = prefixMatch[1].trim();
              let remainingBase = prefixMatch[2].trim();
              if (/^mega$/i.test(extractedPrefix)) {
                const megaXYMatch = remainingBase.match(/^(.+?)[\s_-]+([xy])$/i);
                if (megaXYMatch) {
                  remainingBase = megaXYMatch[1].trim();
                  megaPrimalSuffix = `_MEGA_${megaXYMatch[2].toUpperCase()}`;
                } else if (!megaPrimalSuffix) {
                  megaPrimalSuffix = '_MEGA';
                }
                basePart = remainingBase;
              } else if (/^primal$/i.test(extractedPrefix)) {
                megaPrimalSuffix = '_PRIMAL';
                basePart = remainingBase;
              } else {
                basePart = remainingBase;
                formPart = formPart ? `${extractedPrefix}_${formPart}` : extractedPrefix;
              }
            } else {
              const sandyMatch = basePart.match(/^(sandy)[\s_-]+(wormadam.*)$/i);
              if (sandyMatch) {
                const extractedPrefix = sandyMatch[1].trim();
                basePart = sandyMatch[2].trim();
                formPart = formPart ? `${extractedPrefix}_${formPart}` : extractedPrefix;
              }
            }

            if (megaPrimalSuffix) {
              isShadow = false;
            }

            let normBase = basePart
              .toLowerCase()
              .replace(/[\s-]+/g, '_')
              .replace(/_+/g, '_')
              .replace(/^_+|_+$/g, '');

            if (normBase === 'giratine') normBase = 'giratina';
            else if (normBase.startsWith('giratine_')) normBase = 'giratina_' + normBase.slice('giratine_'.length);
            if (normBase === 'ninetails') normBase = 'ninetales';
            else if (normBase.startsWith('ninetails_')) normBase = 'ninetales_' + normBase.slice('ninetails_'.length);

            const normForm = formPart
              .toLowerCase()
              .replace(/[\s-]+/g, '_')
              .replace(/_+/g, '_')
              .replace(/^_+|_+$/g, '');

            const combined =
              normForm && normForm !== 'base' && !normBase.endsWith(`_${normForm}`)
                ? `${normBase}_${normForm}`
                : normBase;

            if (megaPrimalSuffix) {
              return `${combined}${megaPrimalSuffix}`;
            }
            return isShadow ? `${combined}S` : combined;
          };

          const normalizeDailyLeadKey = (rawLead?: string): string => {
            const formatted = formatExportPokemonName((rawLead || '').trim()).trim().toLowerCase();
            if (!formatted || formatted === 'unknown' || formatted === 'waiting...' || formatted === 'none') {
              return '';
            }
            return formatted;
          };

          const countUniqueLeads = (entries: WebBattleLogEntry[]): number => {
            const set = new Set<string>();
            entries.forEach((e) => {
              const k = normalizeDailyLeadKey(e.opponents?.[0]);
              if (k) set.add(k);
            });
            return set.size;
          };

          const uniqueCount = countUniqueLeads(filteredLogs);

          const resolveUserTeamInfo = (entry: WebBattleLogEntry) => {
            const matchedPreset = presets.find(
              (p) =>
                (entry.presetId && p.id === entry.presetId) ||
                p.name.toLowerCase() === (entry.userTeamName || '').toLowerCase()
            );
            const tName = (entry.userTeamName || '').trim() || matchedPreset?.name || 'My Team';
            const directMons = (entry.userPokemon || []).map((m) => m.trim()).filter(Boolean);
            const presetMons = (matchedPreset?.pokemon || []).map((p) => p.name.trim()).filter(Boolean);
            const rawMons = directMons.length > 0 ? directMons : presetMons.length > 0 ? presetMons : [tName];
            const mons = rawMons.map((m) => formatExportPokemonName(m));
            const monsBracket = `[${mons.join(' ')}]`;
            const groupKey = `${tName.toLowerCase()}||${mons.join(' ').toLowerCase()}`;
            return { teamName: tName, mons, monsBracket, groupKey };
          };

          const buildCopyGblText = (
            rangeCode: 'DAY' | 'YESTERDAY' | 'WEEK' | 'CURRENT_SEASON' | 'PREVIOUS_SEASON' | 'ALL' = logFilterTimeframe
          ) => {
            const list = [...filterByRange(battleLogs, rangeCode)].sort((a, b) => b.timestampMs - a.timestampMs);
            if (list.length === 0) {
              const chosenPreset =
                logFilterTeamId !== 'ALL TEAMS'
                  ? presets.find((p) => p.id === logFilterTeamId)
                  : presets.find((p) => p.isSelected) || presets[0];
              const fallbackMons = (chosenPreset?.pokemon || [])
                .map((p) => formatExportPokemonName(p.name.trim()))
                .filter(Boolean);
              return fallbackMons.length > 0 ? `[${fallbackMons.join(' ')}]` : '[My Team]';
            }

            const teamGroups = new Map<string, WebBattleLogEntry[]>();
            list.forEach((b) => {
              const info = resolveUserTeamInfo(b);
              const existing = teamGroups.get(info.monsBracket);
              if (existing) {
                existing.push(b);
              } else {
                teamGroups.set(info.monsBracket, [b]);
              }
            });

            const sortedBlocks = Array.from(teamGroups.entries()).sort((a, b) => {
              const maxA = Math.max(...a[1].map((x) => x.timestampMs));
              const maxB = Math.max(...b[1].map((x) => x.timestampMs));
              return maxB - maxA;
            });

            return sortedBlocks
              .map(([monsBracket, entries]) => {
                const sortedEntries = [...entries].sort((a, b) => b.timestampMs - a.timestampMs);
                const rows = sortedEntries.map((entry) => {
                  const oppList = (entry.opponents || [])
                    .map((o) => formatExportPokemonName(o.trim()))
                    .filter(Boolean);
                  const oppStr = oppList.length > 0 ? oppList.join(' ') : 'Unknown';
                  const wl = entry.result === 'WIN' ? 'W' : 'L';
                  return `${oppStr} ${wl}`;
                });
                return [monsBracket, ...rows].join('\n');
              })
              .join('\n\n');
          };

          const buildPlainTextSummary = (
            rangeCode: 'DAY' | 'YESTERDAY' | 'WEEK' | 'CURRENT_SEASON' | 'PREVIOUS_SEASON' | 'ALL'
          ) => {
            const list = [...filterByRange(battleLogs, rangeCode)].sort((a, b) => b.timestampMs - a.timestampMs);
            const w = list.filter((e) => e.result === 'WIN').length;
            const l = list.filter((e) => e.result === 'LOSS').length;
            const tot = w + l;
            const pct = tot > 0 ? Math.round((w * 100) / tot) : 0;
            const fv = list.filter((e) => e.leadMatchup === 'FAVORABLE').length;
            const nu = list.filter((e) => e.leadMatchup === 'NEUTRAL').length;
            const ng = list.filter((e) => e.leadMatchup === 'NEGATIVE').length;
            const uq = countUniqueLeads(list);
            const waeInfo = calculateAggregateWAE(list, presets);
            const rangeTitle =
              rangeCode === 'DAY'
                ? 'Day (Today)'
                : rangeCode === 'YESTERDAY'
                ? 'Yesterday'
                : rangeCode === 'WEEK'
                ? 'This Week (Last 7 Days)'
                : rangeCode === 'CURRENT_SEASON'
                ? `Current Season (${currentSeason.name})`
                : rangeCode === 'PREVIOUS_SEASON'
                ? `Previous Season (${prevSeason.name})`
                : 'All Time';
            const teamName =
              logFilterTeamId === 'ALL TEAMS'
                ? 'All Teams'
                : presets.find((p) => p.id === logFilterTeamId)?.name || 'Selected Team';
            const leagueHeader = logFilterLeague === 'ALL LEAGUES' ? 'All Leagues' : logFilterLeague;
            const lines: string[] = [
              `SilphScope PvP Battle Log — ${leagueHeader}`,
              `Team: ${teamName}`,
              `Range: ${rangeTitle}`,
              `Overall Record:${w}W-${l}L(${pct}%) • Leads:${fv} Fav/${nu} Neu/${ng} Neg/${uq} Unique • WAE:${waeInfo.formatted} • Luck:${waeInfo.luckFormatted}`
            ];
            if (list.length === 0) {
              lines.push('', 'No battles logged in this timeframe.');
              return lines.join('\n');
            }
            const dayGroups: Array<{ dayStr: string; items: WebBattleLogEntry[] }> = [];
            const dMap = new Map<string, WebBattleLogEntry[]>();
            list.forEach((b) => {
              const dStr = new Date(b.timestampMs).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
              });
              const existing = dMap.get(dStr);
              if (existing) {
                existing.push(b);
              } else {
                const arr = [b];
                dMap.set(dStr, arr);
                dayGroups.push({ dayStr: dStr, items: arr });
              }
            });

            dayGroups.forEach(({ dayStr, items }) => {
              // Count same-day opponent lead occurrences across all battles on this calendar day
              const dayLeadCounts = new Map<string, number>();
              items.forEach((b) => {
                const leadKey = normalizeDailyLeadKey(b.opponents?.[0]);
                if (leadKey) {
                  dayLeadCounts.set(leadKey, (dayLeadCounts.get(leadKey) || 0) + 1);
                }
              });

              const dayTeamsMap = new Map<string, WebBattleLogEntry[]>();
              items.forEach((b) => {
                const tInfo = resolveUserTeamInfo(b);
                const existing = dayTeamsMap.get(tInfo.groupKey);
                if (existing) {
                  existing.push(b);
                } else {
                  dayTeamsMap.set(tInfo.groupKey, [b]);
                }
              });

              const sortedDayTeams = Array.from(dayTeamsMap.values()).sort((a, b) => {
                if (b.length !== a.length) return b.length - a.length;
                const maxA = Math.max(...a.map((x) => x.timestampMs));
                const maxB = Math.max(...b.map((x) => x.timestampMs));
                return maxB - maxA;
              });

              sortedDayTeams.forEach((teamItems) => {
                const tInfo = resolveUserTeamInfo(teamItems[0]);
                const dw = teamItems.filter((e) => e.result === 'WIN').length;
                const dl = teamItems.filter((e) => e.result === 'LOSS').length;
                const dtot = dw + dl;
                const dpct = dtot > 0 ? Math.round((dw * 100) / dtot) : 0;
                const dfv = teamItems.filter((e) => e.leadMatchup === 'FAVORABLE').length;
                const dnu = teamItems.filter((e) => e.leadMatchup === 'NEUTRAL').length;
                const dng = teamItems.filter((e) => e.leadMatchup === 'NEGATIVE').length;
                const duq = countUniqueLeads(teamItems);
                const dwae = calculateAggregateWAE(teamItems, presets);
                lines.push(
                  '',
                  `=== ${dayStr} - ${tInfo.teamName} ${tInfo.monsBracket} Daily Record:${dw}W-${dl}L(${dpct}%) [Leads:${dfv} Fav/${dnu} Neu/${dng} Neg/${duq} Unique] • WAE:${dwae.formatted} • Luck:${dwae.luckFormatted} ===`
                );
                [...teamItems]
                  .sort((a, b) => b.timestampMs - a.timestampMs)
                  .forEach((b) => {
                    const wl = b.result === 'WIN' ? 'W' : 'L';
                    const leadTag =
                      b.leadMatchup === 'FAVORABLE' ? 'F' : b.leadMatchup === 'NEGATIVE' ? 'U' : 'N';
                    const q = resolveLogEntryQuality(b, presets);
                    const matchPPre = q ? (typeof q.pPre === 'number' ? q.pPre : q.pWin) : null;
                    const matchTag =
                      matchPPre === null ? 'N' : matchPPre > 0.6 ? 'F' : matchPPre < 0.4 ? 'U' : 'N';
                    const leadKey = normalizeDailyLeadKey(b.opponents?.[0]);
                    const isRepeatedLeadToday = !!leadKey && (dayLeadCounts.get(leadKey) || 0) >= 2;
                    const oppList = (b.opponents || [])
                      .map((o) => formatExportPokemonName(o.trim()))
                      .filter(Boolean)
                      .map((formatted, idx) => (idx === 0 && isRepeatedLeadToday ? `**${formatted}**` : formatted));
                    const oppStr = oppList.length > 0 ? oppList.join(' ') : 'Unknown';
                    lines.push(`${wl} (L->${leadTag}, M->${matchTag}) ${oppStr}`);
                  });
              });
            });
            return lines.join('\n');
          };

          return (
            <div className="max-w-4xl mx-auto space-y-5">
              {/* 4-Page Quick Switcher Banner (Teams • Battle Logs • Settings • Help) */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2 flex-wrap">
                    <Target className="w-5 h-5 text-sky-400" />
                    <span>
                      {appCombatMode === 'show6'
                        ? '🏛️ Show 6 Battle Logs, Season Export & Interactive Replay'
                        : '📜 GBL Battle Logs, Season Export & Interactive Replay'}
                    </span>
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                        appCombatMode === 'show6'
                          ? 'bg-amber-500/20 border-amber-400/50 text-amber-200'
                          : 'bg-sky-500/20 border-sky-400/50 text-sky-200'
                      }`}
                    >
                      {appCombatMode === 'show6'
                        ? `Independent Show 6 Vault (${show6BattleLogs.length} Battles)`
                        : `Standard GBL Vault (${gblBattleLogs.length} Battles)`}
                    </span>
                  </h2>
                  <p className="text-xs text-slate-400">
                    {appCombatMode === 'show6'
                      ? 'Independent Show 6 Mode battle history! Click any battle card (or 🔍 Replay) to inspect the 3v3 matrix.'
                      : 'Standard GBL Mode battle history! Click any battle card (or 🔍 Replay) to inspect the interactive 3v3 overlay matrix.'}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-bold shrink-0">
                  <button
                    onClick={() => setActiveTab('presets')}
                    className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-white transition"
                  >
                    ⚔️ Teams
                  </button>
                  <button
                    onClick={() => setActiveTab('battle_log')}
                    className="px-3 py-1.5 rounded-lg bg-sky-500 text-white shadow-sm"
                  >
                    📜 Battle Log
                  </button>
                  <button
                    onClick={() => setActiveTab('settings')}
                    className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-white transition"
                  >
                    ⚙️ Settings
                  </button>
                </div>
              </div>

              {/* Filter & Export Controls Card (2-Tier CP Range -> Cup / Format Filter) */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-sky-400 mb-1">
                      Tier 1 — CP Range
                    </label>
                    <select
                      value={logFilterCpTier}
                      onChange={(e) => {
                        const nextTier = e.target.value as 'ALL' | 'GREAT' | 'ULTRA' | 'MASTER';
                        setLogFilterCpTier(nextTier);
                        setLogFilterLeague(nextTier === 'ALL' ? 'ALL LEAGUES' : `TIER:${nextTier}`);
                        setLogFilterTeamId('ALL TEAMS');
                      }}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-semibold"
                    >
                      <option value="ALL">All CP Tiers ({battleLogs.length})</option>
                      <option value="GREAT">
                        Great ≤1500 ({battleLogs.filter((b) => resolveLeagueCpTier(b.league) === 'GREAT').length})
                      </option>
                      <option value="ULTRA">
                        Ultra 2500 ({battleLogs.filter((b) => resolveLeagueCpTier(b.league) === 'ULTRA').length})
                      </option>
                      <option value="MASTER">
                        Master 10000 ({battleLogs.filter((b) => resolveLeagueCpTier(b.league) === 'MASTER').length})
                      </option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase text-emerald-400 mb-1">
                      Tier 2 — Cup / Format
                    </label>
                    <select
                      value={logFilterLeague}
                      onChange={(e) => {
                        setLogFilterLeague(e.target.value);
                        setLogFilterTeamId('ALL TEAMS');
                      }}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-semibold"
                    >
                      {logFilterCpTier === 'ALL' ? (
                        <>
                          <option value="ALL LEAGUES">All Cups ({battleLogs.length})</option>
                          {(appCombatMode === 'show6' ? enabledShow6Leagues : enabledGblLeagues)
                            .filter((lg) => !isOldCupForMode(lg, appCombatMode))
                            .map((lg) => {
                              const c = battleLogs.filter((b) => b.league.toLowerCase() === lg.toLowerCase()).length;
                              return (
                                <option key={lg} value={lg}>
                                  {lg} ({c})
                                </option>
                              );
                            })}
                          {(() => {
                            const oldCupLogsCount = battleLogs.filter((e) =>
                              isOldCupForMode(e.league, appCombatMode)
                            ).length;
                            if (oldCupLogsCount === 0 && logFilterLeague !== 'OLD_CUPS') return null;
                            return <option value="OLD_CUPS">🗄️ Old Cups ({oldCupLogsCount})</option>;
                          })()}
                        </>
                      ) : (
                        (() => {
                          const tierName =
                            logFilterCpTier === 'GREAT'
                              ? 'Great'
                              : logFilterCpTier === 'ULTRA'
                              ? 'Ultra'
                              : 'Master';
                          const tierLogs = battleLogs.filter((b) => resolveLeagueCpTier(b.league) === logFilterCpTier);
                          const tierActiveCups = (
                            appCombatMode === 'show6' ? enabledShow6Leagues : enabledGblLeagues
                          )
                            .filter(
                              (lg) =>
                                !isOldCupForMode(lg, appCombatMode) && resolveLeagueCpTier(lg) === logFilterCpTier
                            )
                            .sort((a, b) => {
                              const rank = (x: string) => {
                                const u = x.trim().toUpperCase();
                                if (u === 'GREAT LEAGUE' || u === 'ULTRA LEAGUE' || u === 'MASTER LEAGUE') return 0;
                                if (u.includes('MEGA')) return 1;
                                return 2;
                              };
                              const ra = rank(a);
                              const rb = rank(b);
                              return ra !== rb ? ra - rb : a.localeCompare(b);
                            });
                          const tierOldLogsCount = tierLogs.filter((b) =>
                            isOldCupForMode(b.league, appCombatMode)
                          ).length;
                          const formatSubOption = (lg: string) => {
                            const u = lg.trim().toUpperCase();
                            if (u === 'GREAT LEAGUE' || u === 'ULTRA LEAGUE' || u === 'MASTER LEAGUE') {
                              return `Open / Standard (${lg})`;
                            }
                            if (u.includes('MEGA')) return `Mega (${lg})`;
                            return lg;
                          };
                          return (
                            <>
                              <option value={`TIER:${logFilterCpTier}`}>
                                All {tierName} Cups ({tierLogs.length})
                              </option>
                              {tierActiveCups.map((lg) => {
                                const c = tierLogs.filter(
                                  (b) => b.league.toLowerCase() === lg.toLowerCase()
                                ).length;
                                return (
                                  <option key={lg} value={lg}>
                                    {formatSubOption(lg)} ({c})
                                  </option>
                                );
                              })}
                              {(tierOldLogsCount > 0 || logFilterLeague === `OLD_CUPS:${logFilterCpTier}`) && (
                                <option value={`OLD_CUPS:${logFilterCpTier}`}>
                                  🗄️ Old Cups ({tierOldLogsCount})
                                </option>
                              )}
                            </>
                          );
                        })()
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Team Preset Filter</label>
                    <select
                      value={logFilterTeamId}
                      onChange={(e) => setLogFilterTeamId(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-semibold"
                    >
                      {(() => {
                        const matchingPresets = presets.filter((p) =>
                          matchesTwoTierLeagueFilter(p.league, logFilterCpTier, logFilterLeague, appCombatMode)
                        );
                        return (
                          <>
                            <option value="ALL TEAMS">All Teams ({matchingPresets.length})</option>
                            {matchingPresets.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name} ({p.league.split(' ')[0]})
                              </option>
                            ))}
                          </>
                        );
                      })()}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                      Timeframe (ScrapedDuck Seasons)
                    </label>
                    <select
                      value={logFilterTimeframe}
                      onChange={(e) => setLogFilterTimeframe(e.target.value as any)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-semibold"
                    >
                      <option value="DAY">Day (Today)</option>
                      <option value="YESTERDAY">Yesterday</option>
                      <option value="WEEK">Week (Last 7 Days)</option>
                      <option value="CURRENT_SEASON">Current Season ({currentSeason.name})</option>
                      <option value="PREVIOUS_SEASON">Previous Season ({prevSeason.name})</option>
                      <option value="ALL">All Time</option>
                    </select>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const gblText = buildCopyGblText(logFilterTimeframe);
                        navigator.clipboard.writeText(gblText);
                        setCopiedFile(true);
                        setTimeout(() => setCopiedFile(false), 2000);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-sky-600/25 hover:bg-sky-600/40 border border-sky-400/50 text-sky-200 text-xs font-bold transition"
                    >
                      {copiedFile ? '✓ Copied GBL!' : '📋 Copy GBL'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setExportFormatMode('STANDARD');
                        setExportPromptAction('SHARE');
                      }}
                      className="px-3 py-1.5 rounded-xl bg-emerald-600/25 hover:bg-emerald-600/40 border border-emerald-400/50 text-emerald-200 text-xs font-bold transition"
                    >
                      📤 Share Log Summary
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('settings')}
                      className="px-3 py-1.5 rounded-xl bg-purple-600/25 hover:bg-purple-600/40 border border-purple-400/50 text-purple-200 text-xs font-bold transition"
                    >
                      ☁️ Multi-Device Cloud Sync
                    </button>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => {
                        const nextMode = !isBattleLogMultiSelectMode;
                        setIsBattleLogMultiSelectMode(nextMode);
                        if (!nextMode) setSelectedBattleLogIds([]);
                      }}
                      className={`px-3 py-1.5 rounded-xl border text-xs font-extrabold transition flex items-center gap-1.5 ${
                        isBattleLogMultiSelectMode
                          ? 'bg-emerald-500 text-slate-950 border-emerald-300 shadow-lg'
                          : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-emerald-300'
                      }`}
                    >
                      <span>{isBattleLogMultiSelectMode ? `☑️ Exit Multi-Select (${selectedBattleLogIds.length})` : '☑️ Multi-Select Battles'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setHelpMetricGuideTopic('wae');
                        setShowHelpMetricGuideModal(true);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-sky-300 text-xs font-bold flex items-center gap-1.5 transition"
                    >
                      <Info className="w-3.5 h-3.5 text-sky-400" />
                      <span>Help &amp; Metric Guide</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowBattlesTrashModal(true)}
                      className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-amber-300 text-xs font-bold transition"
                    >
                      🗑️ Trash ({deletedBattlesTrash.length})
                    </button>
                    {battleLogs.length > 0 && (
                      <button
                        type="button"
                        onClick={handleClearBattleLogs}
                        className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white text-xs font-bold transition"
                      >
                        Clear All
                      </button>
                    )}
                  </div>
                </div>

                {/* MULTI-SELECT BATTLE LOG REASSIGNMENT BAR */}
                {isBattleLogMultiSelectMode && (
                  <div className="p-3.5 rounded-xl bg-emerald-950/35 border border-emerald-500/50 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 border border-emerald-400/50 text-emerald-200 text-xs font-black font-mono">
                        ☑️ {selectedBattleLogIds.length} Battle(s) Selected
                      </span>
                      <button
                        type="button"
                        onClick={() => setSelectedBattleLogIds(filteredLogs.map((b) => b.id))}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs font-bold text-sky-300 transition"
                      >
                        Select All Filtered ({filteredLogs.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedBattleLogIds([])}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs font-bold text-slate-300 transition"
                      >
                        Clear Selection
                      </button>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <label className="text-xs font-bold text-emerald-200">Reassign Selected To League/Cup:</label>
                      <select
                        value={reassignTargetLeague}
                        onChange={(e) => setReassignTargetLeague(e.target.value as LeagueType)}
                        className="bg-slate-950 border border-emerald-500/60 rounded-xl px-3 py-1.5 text-xs font-extrabold text-white"
                      >
                        {Array.from(
                          new Set([
                            ...allEnabledLeaguesCombined,
                            ...limitedMetaCatalog.map((m) => m.label)
                          ])
                        ).map((lg) => (
                          <option key={lg} value={lg}>
                            {lg}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        disabled={selectedBattleLogIds.length === 0}
                        onClick={() => {
                          if (selectedBattleLogIds.length === 0) return;
                          const selectedSet = new Set(selectedBattleLogIds);
                          const targetLg = normalizeLeagueName(reassignTargetLeague);
                          const updated = battleLogs.map((entry) => {
                            if (!selectedSet.has(entry.id)) return entry;
                            const nextEntry: WebBattleLogEntry = {
                              ...entry,
                              league: targetLg,
                              updatedAt: Date.now()
                            };
                            const recomputedQuality = resolveLogEntryQuality(nextEntry, presets);
                            if (recomputedQuality) {
                              nextEntry.quality = recomputedQuality;
                              nextEntry.bmfScore = recomputedQuality.pPre;
                              nextEntry.execWae = recomputedQuality.execWae;
                            }
                            return nextEntry;
                          });
                          saveBattleLogsToStorage(updated);
                          setStartBattleToast(
                            `🏷️ Reassigned ${selectedBattleLogIds.length} battle(s) to ${targetLg}`
                          );
                          setSelectedBattleLogIds([]);
                          setIsBattleLogMultiSelectMode(false);
                        }}
                        className="px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 font-black text-xs transition shadow-lg"
                      >
                        🏷️ Apply League ({selectedBattleLogIds.length})
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Summary Metrics Row (5-Stat Responsive Grid: Record, Lead Matchups, Win Rate, Exec WAE, Matchup Luck) */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-center shadow-xl">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    RECORD (W - L)
                  </span>
                  <strong className="text-base sm:text-lg font-extrabold text-white tabular-nums">
                    {wins}W - {losses}L ({total})
                  </strong>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-center shadow-xl">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    LEAD MATCHUPS
                  </span>
                  <strong className="text-base sm:text-lg font-extrabold text-sky-400 tabular-nums">
                    {favCount}+/{neuCount}o/{negCount}-/{uniqueCount}u
                  </strong>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-center shadow-xl">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    WIN RATE
                  </span>
                  <strong className="text-base sm:text-lg font-extrabold text-amber-400 tabular-nums">{winRate}%</strong>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-center shadow-xl">
                  <div className="flex items-center justify-center gap-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      EXEC WAE
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setHelpMetricGuideTopic('wae');
                        setShowHelpMetricGuideModal(true);
                      }}
                      title="Open Help & Metric Guide: Execution WAE"
                      aria-label="Open Help & Metric Guide: Execution WAE"
                      className="w-4 h-4 rounded-full bg-slate-800 hover:bg-sky-500/20 border border-slate-700 hover:border-sky-400/50 text-sky-400 inline-flex items-center justify-center text-[10px] font-bold transition"
                    >
                      i
                    </button>
                  </div>
                  <strong
                    style={{
                      color:
                        aggregateWae.waePct === null
                          ? '#94a3b8'
                          : aggregateWae.waePct >= 0
                          ? '#4ade80'
                          : '#f43f5e'
                    }}
                    className="text-base sm:text-lg font-extrabold tabular-nums"
                  >
                    {aggregateWae.formatted}
                  </strong>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-center shadow-xl col-span-2 sm:col-span-1">
                  <div className="flex items-center justify-center gap-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      MATCHUP LUCK
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setHelpMetricGuideTopic('bmf');
                        setShowHelpMetricGuideModal(true);
                      }}
                      title="Open Help & Metric Guide: Matchup Luck (BMF)"
                      aria-label="Open Help & Metric Guide: Matchup Luck (BMF)"
                      className="w-4 h-4 rounded-full bg-slate-800 hover:bg-sky-500/20 border border-slate-700 hover:border-sky-400/50 text-sky-400 inline-flex items-center justify-center text-[10px] font-bold transition"
                    >
                      i
                    </button>
                  </div>
                  <strong
                    style={{
                      color:
                        aggregateWae.luckPct === null
                          ? '#94a3b8'
                          : aggregateWae.luckPct > 50
                          ? '#38bdf8'
                          : aggregateWae.luckPct < 50
                          ? '#fb923c'
                          : '#94a3b8'
                    }}
                    className="text-base sm:text-lg font-extrabold tabular-nums"
                  >
                    {aggregateWae.luckFormatted}
                  </strong>
                </div>
              </div>

              {/* v6.06: Lead-Loss Recovery Rate & Safe-Swap Efficiency Summary Banner */}
              {(() => {
                const favLogs = filteredLogs.filter((l) => l.leadMatchup === 'FAVORABLE');
                const favWins = favLogs.filter((l) => l.result === 'WIN').length;
                const favLosses = favLogs.filter((l) => l.result === 'LOSS').length;
                const favTotal = favWins + favLosses;
                const favPct = favTotal > 0 ? Math.round((favWins / favTotal) * 100) : null;

                const negLogs = filteredLogs.filter(
                  (l) =>
                    l.leadMatchup === 'NEGATIVE' ||
                    (l.leadMatchup !== 'FAVORABLE' && (l as any).firstSwapActor === 'user')
                );
                const negWins = negLogs.filter((l) => l.result === 'WIN').length;
                const negLosses = negLogs.filter((l) => l.result === 'LOSS').length;
                const negTotal = negWins + negLosses;
                const negPct = negTotal > 0 ? Math.round((negWins / negTotal) * 100) : null;
                const recGrade =
                  negPct === null
                    ? '—'
                    : negPct >= 45
                    ? 'S'
                    : negPct >= 35
                    ? 'A'
                    : negPct >= 25
                    ? 'B'
                    : 'C';

                const swapStats = new Map<string, { wins: number; total: number }>();
                for (const entry of negLogs) {
                  if (entry.result !== 'WIN' && entry.result !== 'LOSS') continue;
                  const evs: any[] = (entry as any).timelineEvents || [];
                  const firstUserSwitch = evs.find(
                    (ev) =>
                      String(ev.type || '').toUpperCase() === 'SWITCH' &&
                      String(ev.actor || '').toLowerCase() === 'user'
                  );
                  const swapMon =
                    firstUserSwitch?.pokemonEntering ||
                    firstUserSwitch?.activePokemon ||
                    entry.userPokemon?.[1] ||
                    '';
                  if (swapMon) {
                    const prev = swapStats.get(swapMon) || { wins: 0, total: 0 };
                    swapStats.set(swapMon, {
                      wins: prev.wins + (entry.result === 'WIN' ? 1 : 0),
                      total: prev.total + 1
                    });
                  }
                }
                const sortedSwaps = Array.from(swapStats.entries()).sort((a, b) => {
                  if (b[1].wins !== a[1].wins) return b[1].wins - a[1].wins;
                  const rA = a[1].wins / Math.max(1, a[1].total);
                  const rB = b[1].wins / Math.max(1, b[1].total);
                  if (rB !== rA) return rB - rA;
                  return b[1].total - a[1].total;
                });
                const mvpEntry = sortedSwaps[0];
                const mvpPct = mvpEntry ? Math.round((mvpEntry[1].wins / Math.max(1, mvpEntry[1].total)) * 100) : null;

                return (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-950/90 border border-slate-800 rounded-2xl px-4 py-3 shadow-lg">
                    <div className="flex items-center justify-between sm:flex-col sm:items-start gap-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        LEAD WON CONVERSION
                      </span>
                      <strong
                        className={`text-sm sm:text-base font-extrabold tabular-nums ${
                          favPct === null
                            ? 'text-slate-400'
                            : favPct >= 70
                            ? 'text-emerald-400'
                            : favPct >= 55
                            ? 'text-amber-400'
                            : 'text-rose-400'
                        }`}
                      >
                        {favPct === null ? '—% (0W-0L)' : `${favPct}% · ${favWins}W-${favLosses}L`}
                      </strong>
                    </div>
                    <div className="flex items-center justify-between sm:flex-col sm:items-start gap-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        LEAD LOST RECOVERY RATE
                      </span>
                      <strong
                        className={`text-sm sm:text-base font-extrabold tabular-nums ${
                          negPct === null
                            ? 'text-slate-400'
                            : negPct >= 45
                            ? 'text-emerald-400'
                            : negPct >= 35
                            ? 'text-sky-400'
                            : negPct >= 25
                            ? 'text-amber-400'
                            : 'text-rose-400'
                        }`}
                      >
                        {negPct === null
                          ? '—% (0W-0L)'
                          : `${negPct}% [${recGrade}] · ${negWins}W-${negLosses}L`}
                      </strong>
                    </div>
                    <div className="flex items-center justify-between sm:flex-col sm:items-start gap-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        SAFE-SWAP MVP
                      </span>
                      <strong className="text-sm sm:text-base font-extrabold text-amber-300 tabular-nums">
                        {mvpEntry && mvpPct !== null
                          ? `${mvpEntry[0]} · ${mvpPct}% (${mvpEntry[1].wins}/${mvpEntry[1].total})`
                          : '—'}
                      </strong>
                    </div>
                  </div>
                );
              })()}

              {/* Battle Log List Container */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-white">
                    Logged Battles ({filteredLogs.length}) •{' '}
                    {isBattleLogMultiSelectMode
                      ? 'Tap battles to select & reassign to another league/cup'
                      : 'Tap any battle to open Interactive Overlay Replay'}
                  </span>
                  <span className="text-[11px] font-mono text-slate-400">
                    Season: {currentSeason.name} (Start {currentSeason.rawStart.slice(0, 10)})
                  </span>
                </div>

                {filteredLogs.length === 0 ? (
                  <div className="p-6 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-300 space-y-2">
                    <div className="text-sm font-bold text-white">
                      📜 No Battles Logged in Selected Filter
                    </div>
                    <p className="text-slate-400 leading-relaxed">
                      In the floating overlay, tap <strong>⚔️ Start Battle</strong> when a match begins and <strong>🛑 Stop Battle</strong> when it ends to record a <strong>🏆 Win</strong> or <strong>💀 Loss</strong> with auto-detected <strong>Lead Matchup (Fav / Neu / Neg)</strong>, <strong>Quality of Win/Loss (WAE)</strong>, and fixed <strong>[1st seen, 2nd seen, 3rd seen]</strong> opponent order!
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {groupedByDay.map((dayGroup) => {
                      const dWins = dayGroup.entries.filter((e) => e.result === 'WIN').length;
                      const dLosses = dayGroup.entries.filter((e) => e.result === 'LOSS').length;
                      const dTotal = dWins + dLosses;
                      const dPct = dTotal > 0 ? Math.round((dWins * 100) / dTotal) : 0;
                      const dFav = dayGroup.entries.filter((e) => e.leadMatchup === 'FAVORABLE').length;
                      const dNeu = dayGroup.entries.filter((e) => e.leadMatchup === 'NEUTRAL').length;
                      const dNeg = dayGroup.entries.filter((e) => e.leadMatchup === 'NEGATIVE').length;
                      const dUnique = countUniqueLeads(dayGroup.entries);
                      const dWae = calculateAggregateWAE(dayGroup.entries, presets);

                      // Track same-day repeated opponent leads and chronological occurrence (#1 of N, #2 of N)
                      const dayLeadCounts = new Map<string, number>();
                      const dayLeadOccurrenceByEntryId = new Map<string, number>();
                      const chronologicalDayEntries = [...dayGroup.entries].sort((a, b) => a.timestampMs - b.timestampMs);
                      chronologicalDayEntries.forEach((e) => {
                        const k = normalizeDailyLeadKey(e.opponents?.[0]);
                        if (k) {
                          const nextOcc = (dayLeadCounts.get(k) || 0) + 1;
                          dayLeadCounts.set(k, nextOcc);
                          dayLeadOccurrenceByEntryId.set(e.id, nextOcc);
                        }
                      });

                      return (
                        <div key={dayGroup.dayLabel} className="space-y-2">
                          <div className="px-2 py-1 text-[11.5px] font-bold text-sky-400 flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80">
                            <span>
                              📅 {dayGroup.dayLabel} — Daily Record:{dWins}W-{dLosses}L({dPct}%) • Leads:{dFav} Fav/{dNeu} Neu/{dNeg} Neg/{dUnique} Unique • WAE:
                              <span
                                style={{
                                  color:
                                    dWae.waePct === null
                                      ? '#94a3b8'
                                      : dWae.waePct >= 0
                                      ? '#4ade80'
                                      : '#f43f5e'
                                }}
                              >
                                {dWae.formatted}
                              </span>
                              {' '}• Luck:
                              <span
                                style={{
                                  color:
                                    dWae.luckPct === null
                                      ? '#94a3b8'
                                      : dWae.luckPct > 50
                                      ? '#38bdf8'
                                      : dWae.luckPct < 50
                                      ? '#fb923c'
                                      : '#94a3b8'
                                }}
                              >
                                {dWae.luckFormatted}
                              </span>
                            </span>
                          </div>

                          {dayGroup.entries.map((entry) => {
                            const isWin = entry.result === 'WIN';
                            const leadLabel =
                              entry.leadMatchup === 'FAVORABLE'
                                ? 'Fav'
                                : entry.leadMatchup === 'NEGATIVE'
                                ? 'Neg'
                                : 'Neu';
                            const entryLeadKey = normalizeDailyLeadKey(entry.opponents?.[0]);
                            const dayLeadCount = entryLeadKey ? dayLeadCounts.get(entryLeadKey) || 0 : 0;
                            const isRepeatedLeadToday = dayLeadCount >= 2;
                            const leadOccIdx = dayLeadOccurrenceByEntryId.get(entry.id) || 1;
                            const quality = resolveLogEntryQuality(entry, presets);
                            const bmfPct = quality ? Math.round(quality.pPre * 100) : null;
                            const execWaeVal = quality
                              ? typeof quality.execWae === 'number'
                                ? quality.execWae
                                : quality.deltaQ
                              : null;
                            const deltaQSign = execWaeVal !== null && execWaeVal >= 0 ? '+' : '';
                            const deltaQText =
                              execWaeVal !== null ? `${deltaQSign}${(execWaeVal * 100).toFixed(1)}%` : null;

                            const getBadgeStyle = (label?: string): { bg: string; text: string; border: string } => {
                              switch (label) {
                                case 'Clutch Win':
                                  return {
                                    bg: 'rgba(34, 211, 238, 0.16)',
                                    text: '#22d3ee',
                                    border: 'rgba(34, 211, 238, 0.45)'
                                  };
                                case 'Skill Win':
                                  return {
                                    bg: 'rgba(74, 222, 128, 0.16)',
                                    text: '#4ade80',
                                    border: 'rgba(74, 222, 128, 0.45)'
                                  };
                                case 'Blunder Loss':
                                  return {
                                    bg: 'rgba(244, 63, 94, 0.16)',
                                    text: '#f43f5e',
                                    border: 'rgba(244, 63, 94, 0.45)'
                                  };
                                case 'Tough Loss':
                                  return {
                                    bg: 'rgba(251, 146, 60, 0.16)',
                                    text: '#fb923c',
                                    border: 'rgba(251, 146, 60, 0.45)'
                                  };
                                default:
                                  return {
                                    bg: 'rgba(148, 163, 184, 0.15)',
                                    text: '#94a3b8',
                                    border: 'rgba(148, 163, 184, 0.4)'
                                  };
                              }
                            };

                            const getContextualFlagClass = (flag: string): string => {
                              if (flag.includes('Double Shield Pocket')) {
                                return 'bg-rose-500/15 text-rose-300 border-rose-400/40';
                              }
                              if (flag.includes('Shield in Pocket')) {
                                return 'bg-amber-500/15 text-amber-300 border-amber-400/40';
                              }
                              if (flag.includes('Clean Sweep')) {
                                return 'bg-emerald-500/15 text-emerald-300 border-emerald-400/40';
                              }
                              if (flag.includes('Shield Advantage')) {
                                return 'bg-sky-500/15 text-sky-300 border-sky-400/40';
                              }
                              return 'bg-amber-500/15 text-amber-300 border-amber-400/40';
                            };

                            const badgeStyle = getBadgeStyle(quality?.badgeLabel);
                            const contextualFlags: string[] = quality?.contextualFlags || entry.flags || [];

                            const isSelectedForReassign = selectedBattleLogIds.includes(entry.id);

                            return (
                              <div
                                key={entry.id}
                                onClick={() => {
                                  if (isBattleLogMultiSelectMode) {
                                    setSelectedBattleLogIds((prev) =>
                                      prev.includes(entry.id)
                                        ? prev.filter((id) => id !== entry.id)
                                        : [...prev, entry.id]
                                    );
                                    return;
                                  }
                                  setReplayLogEntry(entry);
                                  setReplayUserIdx(0);
                                  setReplayOppIdx(0);
                                  setReplayOppShadow(false);
                                }}
                                className={`p-3.5 rounded-xl bg-slate-950 hover:bg-slate-900/90 border cursor-pointer transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs ${
                                  isBattleLogMultiSelectMode && isSelectedForReassign
                                    ? 'border-emerald-400 bg-emerald-950/20 shadow-[0_0_12px_rgba(16,185,129,0.2)]'
                                    : isRepeatedLeadToday
                                    ? 'border-amber-400/70 shadow-[0_0_12px_rgba(251,191,36,0.12)]'
                                    : 'border-slate-800 hover:border-sky-500/50'
                                }`}
                              >
                                <div className="space-y-1.5">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    {isBattleLogMultiSelectMode && (
                                      <input
                                        type="checkbox"
                                        checked={isSelectedForReassign}
                                        onChange={(e) => {
                                          e.stopPropagation();
                                          setSelectedBattleLogIds((prev) =>
                                            prev.includes(entry.id)
                                              ? prev.filter((id) => id !== entry.id)
                                              : [...prev, entry.id]
                                          );
                                        }}
                                        onClick={(e) => e.stopPropagation()}
                                        className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
                                      />
                                    )}
                                    <span
                                      className={`px-2 py-0.5 rounded font-extrabold text-[10px] border ${
                                        isWin
                                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                          : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                                      }`}
                                    >
                                      {isWin ? '🏆 WIN' : '💀 LOSS'}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const nextLead: 'FAVORABLE' | 'NEUTRAL' | 'NEGATIVE' =
                                          entry.leadMatchup === 'FAVORABLE'
                                            ? 'NEUTRAL'
                                            : entry.leadMatchup === 'NEUTRAL'
                                            ? 'NEGATIVE'
                                            : 'FAVORABLE';
                                        const updated = battleLogs.map((b) =>
                                          b.id === entry.id ? { ...b, leadMatchup: nextLead, updatedAt: Date.now() } : b
                                        );
                                        saveBattleLogsToStorage(updated);
                                      }}
                                      className={`px-2 py-0.5 rounded font-bold text-[10px] border ${
                                        entry.leadMatchup === 'FAVORABLE'
                                          ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                          : entry.leadMatchup === 'NEGATIVE'
                                          ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                                          : 'bg-slate-800 text-slate-300 border-slate-700'
                                      }`}
                                      title="Click to toggle Lead Matchup (Fav / Neu / Neg)"
                                    >
                                      Lead: {leadLabel} ↻
                                    </button>
                                    {isRepeatedLeadToday && (
                                      <span className="px-2 py-0.5 rounded-full font-extrabold text-[10px] bg-amber-500/20 text-amber-300 border border-amber-400/50">
                                        🔁 Repeat Lead (#{leadOccIdx} of {dayLeadCount} Today)
                                      </span>
                                    )}
                                    <span className="font-bold text-sky-400">
                                      {entry.league}
                                    </span>
                                    <span className="text-[11px] font-mono text-slate-400">
                                      {new Date(entry.timestampMs).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                                    </span>
                                  </div>

                                  <div className="text-slate-200">
                                    <span className="text-slate-400">Team:</span>{' '}
                                    <strong className="text-white">{entry.userTeamName}</strong>{' '}
                                    <span className="text-slate-400">({(entry.userPokemon || []).join(' / ')})</span>
                                  </div>
                                  <div className="text-amber-200">
                                    <span className="text-slate-400">Opponents (1st → 2nd → 3rd):</span>{' '}
                                    <strong>
                                      {entry.opponents.length > 0
                                        ? entry.opponents.map((o, i) => (
                                            <React.Fragment key={i}>
                                              {i > 0 && '  •  '}
                                              <span
                                                className={
                                                  i === 0 && isRepeatedLeadToday
                                                    ? 'text-amber-300 underline decoration-amber-400/70 font-extrabold'
                                                    : ''
                                                }
                                              >
                                                #{i + 1} {o}
                                                {i === 0 && isRepeatedLeadToday ? ' 🔁' : ''}
                                              </span>
                                            </React.Fragment>
                                          ))
                                        : 'None Scanned'}
                                    </strong>
                                  </div>

                                  {/* Phase 3: Primary Performance Badge & Contextual Event Flags (Pills) Container */}
                                  <div className="pt-0.5 flex items-center gap-1.5 flex-wrap">
                                    {quality ? (
                                      <>
                                        <span
                                          style={{
                                            backgroundColor: badgeStyle.bg,
                                            color: badgeStyle.text,
                                            borderColor: badgeStyle.border
                                          }}
                                          className="px-2.5 py-0.5 rounded-md font-extrabold text-[10.5px] border inline-flex items-center gap-1"
                                        >
                                          <span>{quality.badgeLabel}</span>
                                          <span>•</span>
                                          <span>BMF: {bmfPct}%</span>
                                          <span>•</span>
                                          <span>WAE: {deltaQText}</span>
                                        </span>
                                        {contextualFlags.map((flag) => (
                                          <span
                                            key={flag}
                                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getContextualFlagClass(flag)}`}
                                          >
                                            {flag}
                                          </span>
                                        ))}
                                      </>
                                    ) : (
                                      <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-900 text-slate-500 border border-slate-800">
                                        Unranked (Incomplete Match — 2nd Opponent Unseen)
                                      </span>
                                    )}
                                  </div>
                                  {/* v3.50 Permanent Main Log Summary Badges: Final HP/Shields + First Swap Actor & Switch Advantage */}
                                  <div className="pt-0.5 flex items-center gap-2 flex-wrap text-[10.5px] text-slate-300 font-mono">
                                    <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800">
                                      🛡️ End Shields: You {entry.userShieldsRemaining ?? 0}S vs Opp {entry.oppShieldsRemaining ?? 0}S
                                    </span>
                                    <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800">
                                      ❤️ End HP: You [{(entry.finalUserHpPct || [isWin ? 45 : 0, 0, 100]).join('% / ')}%] vs Opp [{(entry.finalOppHpPct || [0, isWin ? 0 : 40, 100]).join('% / ')}%]
                                    </span>
                                    <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-sky-300">
                                      🔄 1st Swap: {entry.firstSwapActor || 'NONE'} • Switch Adv: {entry.switchAdvantage || 'NEUTRAL'}
                                    </span>
                                  </div>
                                </div>

                                <div
                                  className="flex items-center gap-1.5 shrink-0"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setReplayLogEntry(entry);
                                      setReplayUserIdx(0);
                                      setReplayOppIdx(0);
                                      setReplayOppShadow(false);
                                    }}
                                    className="px-2.5 py-1.5 rounded-lg bg-sky-500/20 hover:bg-sky-500/35 border border-sky-400/50 text-sky-200 font-bold text-[11px] transition"
                                  >
                                    {aiTrainingLogs.some((a) => a.battleId === entry.id)
                                      ? '🎬 Full 7d Replay'
                                      : '🔍 Summary Replay'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (webMembershipTier !== 'pro' && webMembershipTier !== 'vip') {
                                        setShowMembershipModal(true);
                                        setMembershipStatusMsg('🎬 Cloud DVR Video & Trace Theater and "What-If" Mid-Battle Branching require Legend Pro ($3 Intro / $6 Season) or VIP!');
                                        return;
                                      }
                                      window.open(
                                        `https://dvr.silphscopepvp.com/vault?user=${encodeURIComponent(webScreenName || 'sportsfan986')}&key=${encodeURIComponent(webUnlockKey)}`,
                                        '_blank'
                                      );
                                    }}
                                    className="px-2.5 py-1.5 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/35 border border-indigo-400/50 text-indigo-200 font-bold text-[11px] transition"
                                    title="Open Cloud DVR Video & Frame-by-Frame Trace Theater (Pro / VIP)"
                                  >
                                    🎥 Cloud DVR
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (webMembershipTier !== 'pro' && webMembershipTier !== 'vip') {
                                        setShowMembershipModal(true);
                                        setMembershipStatusMsg('🌿 "What-If" Mid-Battle Simulator Branching requires Legend Pro ($3 Intro / $6 Season) or VIP!');
                                        return;
                                      }
                                      if (entry.opponents?.length) {
                                        setScannedOpponents(entry.opponents.slice(0, 3));
                                        setActiveOpponentSlotIndex(0);
                                        setActiveOpponentKey(entry.opponents[0]);
                                        setIsWaitingOpponent(false);
                                      }
                                      setUserShields(entry.userShieldsRemaining ?? 1);
                                      setOppShields(entry.oppShieldsRemaining ?? 1);
                                      setActiveTab('simulator');
                                      setIsOverlayVisible(true);
                                      setStartBattleToast(`🌿 Branched Battle vs ${entry.opponents.join('/')} into Live Simulator!`);
                                      setTimeout(() => setStartBattleToast(null), 2600);
                                    }}
                                    className="px-2.5 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/35 border border-emerald-400/50 text-emerald-200 font-bold text-[11px] transition"
                                    title='Branch this battle into the Interactive Overlay Simulator ("What-If" Mode — Pro / VIP)'
                                  >
                                    🌿 What-If Sim
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditingLogEntry({ ...entry })}
                                    className="px-2.5 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/35 border border-amber-400/50 text-amber-200 font-bold text-[11px] transition"
                                  >
                                    ✏️ Edit
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteSingleBattleLog(entry)}
                                    className="px-2.5 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/35 border border-rose-400/50 text-rose-200 font-bold text-[11px] transition"
                                    title="Move battle to Trash"
                                  >
                                    🗑️
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Timeframe Summary Export Prompt Modal */}
              {exportPromptAction && (
                <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
                  <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <h3 className="font-bold text-sm text-white">
                        {exportPromptAction === 'COPY' ? '📋 Copy Battle Log Summary' : '📤 Share Battle Log Summary'}
                      </h3>
                      <button
                        onClick={() => setExportPromptAction(null)}
                        className="text-slate-400 hover:text-white font-bold"
                      >
                        ✕
                      </button>
                    </div>

                    <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 font-mono text-[10.5px] text-slate-300 whitespace-pre-wrap max-h-36 overflow-y-auto">
                      {buildPlainTextSummary(logFilterTimeframe)}
                    </div>

                    <p className="text-xs text-slate-300">
                      Select timeframe to {exportPromptAction === 'COPY' ? 'copy' : 'share'}:
                    </p>
                    <div className="space-y-2">
                      {(
                        [
                          { code: 'DAY', label: 'Day (Today)' },
                          { code: 'YESTERDAY', label: 'Yesterday' },
                          { code: 'WEEK', label: 'Week (Last 7 Days)' },
                          { code: 'CURRENT_SEASON', label: `Current Season (${currentSeason.name})` },
                          { code: 'PREVIOUS_SEASON', label: `Previous Season (${prevSeason.name})` },
                          { code: 'ALL', label: 'All Time' }
                        ] as const
                      ).map((opt) => (
                        <button
                          key={opt.code}
                          type="button"
                          onClick={async () => {
                            const text = buildPlainTextSummary(opt.code);
                            navigator.clipboard.writeText(text);
                            if (exportPromptAction === 'SHARE' && navigator.share) {
                              try {
                                await navigator.share({ title: 'SilphScope PvP Battle Log', text });
                              } catch {}
                            }
                            setExportPromptAction(null);
                          }}
                          className="w-full py-2.5 px-3 rounded-xl bg-slate-950 hover:bg-sky-500/20 border border-slate-800 hover:border-sky-400 text-left text-xs font-bold text-white flex items-center justify-between transition"
                        >
                          <span>{opt.label}</span>
                          <span className="text-[10px] font-mono text-sky-400">
                            {filterByRange(battleLogs, opt.code).length} battles →
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Edit Logged Battle Modal */}
              {editingLogEntry && (
                <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
                  <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <h3 className="font-bold text-sm text-white">✏️ Edit Logged Battle</h3>
                      <button
                        onClick={() => setEditingLogEntry(null)}
                        className="text-slate-400 hover:text-white font-bold"
                      >
                        ✕
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => setEditingLogEntry({ ...editingLogEntry, result: 'WIN' })}
                        className={`py-2 rounded-xl font-bold border ${
                          editingLogEntry.result === 'WIN'
                            ? 'bg-emerald-600/35 border-emerald-400 text-emerald-200'
                            : 'bg-slate-950 border-slate-800 text-slate-400'
                        }`}
                      >
                        🏆 WIN
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingLogEntry({ ...editingLogEntry, result: 'LOSS' })}
                        className={`py-2 rounded-xl font-bold border ${
                          editingLogEntry.result === 'LOSS'
                            ? 'bg-rose-600/35 border-rose-400 text-rose-200'
                            : 'bg-slate-950 border-slate-800 text-slate-400'
                        }`}
                      >
                        💀 LOSS
                      </button>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-xs">
                      {(['FAVORABLE', 'NEUTRAL', 'NEGATIVE'] as const).map((lm) => (
                        <button
                          key={lm}
                          type="button"
                          onClick={() => setEditingLogEntry({ ...editingLogEntry, leadMatchup: lm })}
                          className={`py-1.5 rounded-xl font-bold border text-[11px] ${
                            editingLogEntry.leadMatchup === lm
                              ? 'bg-sky-500/30 border-sky-400 text-sky-200'
                              : 'bg-slate-950 border-slate-800 text-slate-400'
                          }`}
                        >
                          Lead: {lm.slice(0, 3)}
                        </button>
                      ))}
                    </div>

                    <div className="space-y-2 text-xs">
                      {[0, 1, 2].map((slotIdx) => (
                        <div key={slotIdx}>
                          <label className="block text-[10px] text-slate-400 mb-0.5">
                            Opponent #{slotIdx + 1} ({slotIdx === 0 ? '1st Seen Lead' : slotIdx === 1 ? '2nd Seen Swap' : '3rd Seen Closer'})
                          </label>
                          <input
                            type="text"
                            value={editingLogEntry.opponents[slotIdx] || ''}
                            onChange={(e) => {
                              const nextOpps = [...editingLogEntry.opponents];
                              nextOpps[slotIdx] = e.target.value;
                              setEditingLogEntry({
                                ...editingLogEntry,
                                opponents: nextOpps.filter((x) => x.trim().length > 0)
                              });
                            }}
                            placeholder={`Opponent #${slotIdx + 1}`}
                            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white"
                          />
                        </div>
                      ))}
                    </div>

                    <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                      <button
                        type="button"
                        onClick={() => setEditingLogEntry(null)}
                        className="px-3 py-1.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const recomputedQuality = resolveLogEntryQuality(
                            { ...editingLogEntry, quality: undefined },
                            presets
                          );
                          const updated = battleLogs.map((b) =>
                            b.id === editingLogEntry.id
                              ? {
                                  ...editingLogEntry,
                                  bmfScore: recomputedQuality ? recomputedQuality.pPre : null,
                                  execWae: recomputedQuality ? recomputedQuality.execWae : null,
                                  badges: recomputedQuality ? [recomputedQuality.badgeLabel] : [],
                                  flags: recomputedQuality ? recomputedQuality.contextualFlags : [],
                                  quality: recomputedQuality,
                                  updatedAt: Date.now()
                                }
                              : b
                          );
                          saveBattleLogsToStorage(updated);
                          setEditingLogEntry(null);
                        }}
                        className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold"
                      >
                        Save Changes
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Interactive Post-Game Overlay Replay Inspector Modal */}
              {replayLogEntry && (() => {
                const replayTeamNames =
                  replayLogEntry.userPokemon && replayLogEntry.userPokemon.length === 3
                    ? replayLogEntry.userPokemon
                    : activePreset.pokemon.map((p) => p.name);
                const replayOpps =
                  replayLogEntry.opponents && replayLogEntry.opponents.length > 0
                    ? replayLogEntry.opponents
                    : ['Zacian (Crowned)'];
                const safeUserSlot = Math.max(0, Math.min(replayUserIdx, replayTeamNames.length - 1));
                const safeOppSlot = Math.max(0, Math.min(replayOppIdx, replayOpps.length - 1));
                const activeReplayUserMon = replayTeamNames[safeUserSlot] || 'Palkia (Origin)';
                const activeReplayOppMon = replayOpps[safeOppSlot] || replayOpps[0];
                const rawOpp = POKEMON_DATABASE[activeReplayOppMon] || POKEMON_DATABASE['Zacian (Crowned)'];
                const effOpp = computeEffectiveStatsForLeague(
                  rawOpp,
                  (replayLogEntry.league as LeagueType) || 'GREAT LEAGUE',
                  undefined,
                  undefined,
                  replayOppShadow
                );
                const recUser = getRecommendedMovesForPokemon(
                  activeReplayUserMon,
                  (replayLogEntry.league as LeagueType) || 'GREAT LEAGUE'
                );
                const userFast = recUser?.fastMove || 'Dragon Breath';
                const rawUserStats = POKEMON_DATABASE[activeReplayUserMon] || Object.values(POKEMON_DATABASE).find((p) => p.name.toLowerCase() === activeReplayUserMon.toLowerCase()) || POKEMON_DATABASE['Palkia (Origin)'];
                const userTurns = resolveFastMove(rawUserStats, userFast)?.turns || FAST_MOVE_TURN_LOOKUP[userFast.toLowerCase()] || 2;
                const userCharged = [recUser?.chargedMove1 || 'Aqua Tail', recUser?.chargedMove2 || 'Spacial Rend'];
                const replayOppTiming = calculateOpponentMoveTimingRows(
                  effOpp,
                  activeReplayUserMon,
                  replayTeamNames,
                  replayOppShadow,
                  userTurns,
                  userFast,
                  userCharged,
                  oppCountMode,
                  (replayLogEntry.league as LeagueType) || 'GREAT LEAGUE',
                  undefined,
                  enable4ChargedMoves
                );
                const replayMyTiming = calculateMyMoveTimingRows(
                  activeReplayUserMon,
                  effOpp,
                  userCharged,
                  replayOppTiming.rows.map((r) => r.myTapAtReady),
                  replayOppShadow,
                  userTurns,
                  userFast,
                  replayOpps,
                  replayOppTiming.maxHorizonTurns,
                  (replayLogEntry.league as LeagueType) || 'GREAT LEAGUE',
                  undefined,
                  enable4ChargedMoves
                );

                return (
                  <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
                    <div
                      className="relative overflow-hidden border rounded-2xl max-w-lg w-full p-5 shadow-2xl space-y-3"
                      style={{
                        backgroundColor: activeTheme.bgHex,
                        borderColor: activeTheme.accentHex
                      }}
                    >
                      {showThemeWatermark && activeTheme.emblemType !== 'none' && (
                        <div
                          className="absolute inset-0 pointer-events-none flex items-center justify-center z-0"
                          style={{ opacity: activeTheme.isLight ? 0.24 : 0.20 }}
                        >
                          {renderThemeOverlayIcon(activeTheme.id, 260)}
                        </div>
                      )}
                      <div className="relative z-10 flex items-center justify-between border-b border-slate-800 pb-2.5">
                        <div>
                          <h3 className="font-bold text-sm text-white flex items-center gap-2">
                            <span>🔍 Post-Game Interactive Overlay Replay</span>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
                                replayLogEntry.result === 'WIN'
                                  ? 'bg-emerald-500/20 text-emerald-300'
                                  : 'bg-rose-500/20 text-rose-300'
                              }`}
                            >
                              {replayLogEntry.result}
                            </span>
                          </h3>
                          <p className="text-[11px] text-slate-400">
                            Tap any of your 3 Pokémon or any of the 3 opponents (#1, #2, #3) below to inspect shield scenarios, move counts &amp; swap options!
                          </p>
                        </div>
                        <button
                          onClick={() => setReplayLogEntry(null)}
                          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold"
                        >
                          ✕ Close
                        </button>
                      </div>

                      {/* Interactive Overlay HUD Replica */}
                      <div
                        className="relative z-10 rounded-xl border p-3 space-y-2.5 text-xs"
                        style={{
                          backgroundColor: `rgba(${activeTheme.overlayBgRgb}, ${showThemeWatermark && activeTheme.emblemType !== 'none' ? 0.62 : 0.85})`,
                          borderColor: activeTheme.accentHex
                        }}
                      >
                        <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-800">
                          <div className="flex items-center gap-1.5">
                            <span className="font-extrabold text-amber-300">
                              VS #{safeOppSlot + 1} {replayOppShadow ? 'S-' : ''}{activeReplayOppMon}
                            </span>
                            <button
                              type="button"
                              onClick={() => setReplayOppShadow(!replayOppShadow)}
                              className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                                replayOppShadow
                                  ? 'bg-purple-600/50 border-purple-300 text-white'
                                  : 'bg-slate-900 border-slate-700 text-purple-300'
                              }`}
                            >
                              Shadow: {replayOppShadow ? 'ON' : 'OFF'}
                            </button>
                          </div>
                          <div className="flex items-center gap-1">
                            {replayTeamNames.map((mName, idx) => (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => setReplayUserIdx(idx)}
                                className={`px-2 py-0.5 rounded text-[10px] font-bold border transition ${
                                  safeUserSlot === idx
                                    ? 'bg-sky-500/35 border-sky-400 text-white'
                                    : 'bg-slate-900 border-slate-700 text-slate-300 hover:text-white'
                                }`}
                              >
                                {mName.split(' ')[0].slice(0, 6)}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* 3v3 Matchup Matrix (Fixed 1st/2nd/3rd seen order) */}
                        <div className="space-y-1 bg-slate-900/70 p-2 rounded-lg border border-slate-800">
                          {replayOpps.map((oppName, idx) => {
                            const isActv = idx === safeOppSlot;
                            const m = calculateShieldMatrix(oppName, replayTeamNames, isActv && replayOppShadow);
                            return (
                              <div
                                key={`${oppName}-${idx}`}
                                onClick={() => setReplayOppIdx(idx)}
                                className={`flex items-center justify-between px-2 py-1 rounded cursor-pointer transition ${
                                  isActv
                                    ? 'bg-sky-500/25 border border-sky-400/60'
                                    : 'hover:bg-slate-800/70 border border-transparent'
                                }`}
                              >
                                <span className="font-bold text-white">
                                  <span className="text-sky-400 mr-1">#{idx + 1}</span>
                                  {oppName}
                                </span>
                                <div className="flex items-center gap-2 font-mono text-[10px]">
                                  <span>{replayTeamNames[0]?.charAt(0) || '1'}: {renderTierDots(m.p1)}</span>
                                  <span>{replayTeamNames[1]?.charAt(0) || '2'}: {renderTierDots(m.p2)}</span>
                                  <span>{replayTeamNames[2]?.charAt(0) || '3'}: {renderTierDots(m.p3)}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Opponent Attacks vs Your 3 Team Members */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase">
                            <span>Opponent Charged Moves ({activeReplayOppMon})</span>
                            <span>Damage vs {replayTeamNames.map((n) => n.slice(0, 3)).join(' / ')}</span>
                          </div>
                          {replayOppTiming.rows.map((r) => (
                            <div
                              key={r.name}
                              className="flex items-center justify-between bg-slate-900/80 border border-slate-800 rounded px-2 py-1 text-[11px]"
                            >
                              <div>
                                <strong className="text-amber-300">{r.name}</strong>{' '}
                                <span className="text-slate-400 font-mono">({r.energy}e / {r.displayReadyCount}f)</span>
                              </div>
                              <div className="flex items-center gap-2 font-mono">
                                {r.teamDamages.map((td, cIdx) => (
                                  <span
                                    key={cIdx}
                                    className={`px-1.5 py-0.5 rounded ${
                                      cIdx === safeUserSlot
                                        ? 'bg-sky-500/25 border border-sky-400/60 text-white font-bold'
                                        : 'text-slate-400'
                                    }`}
                                  >
                                    {td.dmgPct}%
                                  </span>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Your Active Pokemon Attacks vs 3 Opponents */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase">
                            <span>Your Moves ({activeReplayUserMon})</span>
                            <span>Damage vs #1 / #2 / #3</span>
                          </div>
                          {replayMyTiming.map((r) => (
                            <div
                              key={r.name}
                              className="flex items-center justify-between bg-slate-900/80 border border-slate-800 rounded px-2 py-1 text-[11px]"
                            >
                              <div>
                                <strong className="text-sky-300">{r.name}</strong>{' '}
                                <span className="text-slate-400 font-mono">({r.energy}e / {r.myTapsNeeded}f)</span>
                              </div>
                              <div className="flex items-center gap-2 font-mono">
                                {r.oppDamages.map((od, cIdx) => (
                                  <span
                                    key={cIdx}
                                    className={`px-1.5 py-0.5 rounded ${
                                      cIdx === safeOppSlot
                                        ? 'bg-sky-500/25 border border-sky-400/60 text-white font-bold'
                                        : 'text-slate-400'
                                    }`}
                                  >
                                    {od.isEmpty ? '—' : `${od.dmgPct}%`}
                                  </span>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          );
        })()}

        {/* Import & Reconcile Delta Sync Bundle Modal */}
        {showImportBundleModal && (
          <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-5 shadow-2xl space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <h3 className="font-bold text-sm text-white">📥 Import &amp; Reconcile Delta Sync Bundle</h3>
                <button
                  onClick={() => setShowImportBundleModal(false)}
                  className="text-slate-400 hover:text-white font-bold"
                >
                  ✕
                </button>
              </div>
              <textarea
                rows={7}
                value={importBundleText}
                onChange={(e) => setImportBundleText(e.target.value)}
                placeholder="Paste JSON bundle exported from your other device..."
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs font-mono text-white"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowImportBundleModal(false)}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    try {
                      const remote = JSON.parse(importBundleText);
                      const mergedTombstones = new Set<string>(deletedLogIds);
                      if (Array.isArray(remote.deletedLogIds)) {
                        remote.deletedLogIds.forEach((id: string) => mergedTombstones.add(id));
                      }
                      const logMap = new Map<string, WebBattleLogEntry>();
                      battleLogs.forEach((l) => {
                        if (!mergedTombstones.has(l.id)) logMap.set(l.id, l);
                      });
                      if (Array.isArray(remote.battleLogs)) {
                        remote.battleLogs.forEach((r: WebBattleLogEntry) => {
                          if (!r?.id || mergedTombstones.has(r.id)) return;
                          const existing = logMap.get(r.id);
                          if (!existing || (r.updatedAt || r.timestampMs) > (existing.updatedAt || existing.timestampMs)) {
                            logMap.set(r.id, r);
                          }
                        });
                      }
                      const mergedLogs = Array.from(logMap.values()).sort((a, b) => b.timestampMs - a.timestampMs);
                      saveBattleLogsToStorage(mergedLogs);

                      if (Array.isArray(remote.teamPresets)) {
                        const pMap = new Map<string, TeamPreset>();
                        presets.forEach((p) => pMap.set(p.id, p));
                        remote.teamPresets.forEach((rp: TeamPreset) => {
                          if (rp?.id) pMap.set(rp.id, rp);
                        });
                        setPresets(Array.from(pMap.values()));
                      }
                      const tombArr = Array.from(mergedTombstones);
                      setDeletedLogIds(tombArr);
                      localStorage.setItem('gbl_deleted_log_ids_v1', JSON.stringify(tombArr));
                      setLastCloudSyncStatus(`Reconciled bundle (${mergedLogs.length} battles)`);
                      setShowImportBundleModal(false);
                    } catch {
                      alert('Invalid Delta Sync JSON bundle.');
                    }
                  }}
                  className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold"
                >
                  Reconcile Deltas
                </button>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 4 (v6.00): 📊 META TAB (PERSONALIZED TOP META CORES, TOP POKÉMON & COLLAPSIBLE TUNING)
           ========================================================================= */}
        {activeTab === 'meta' && (
          <MetaTab
            appCombatMode={appCombatMode}
            metaTabShow6League={metaTabShow6League}
            setMetaTabShow6League={setMetaTabShow6League}
            metaTabGblLeague={metaTabGblLeague}
            setMetaTabGblLeague={setMetaTabGblLeague}
            enabledShow6Leagues={enabledShow6Leagues}
            enabledGblLeagues={enabledGblLeagues}
            limitedStdBlendPctGbl={limitedStdBlendPctGbl}
            setLimitedStdBlendPctGbl={setLimitedStdBlendPctGbl}
            limitedStdDecayGbl={limitedStdDecayGbl}
            setLimitedStdDecayGbl={setLimitedStdDecayGbl}
            battleLogs={battleLogs}
            activeSeasonBounds={activeSeasonBounds}
            metaTabScope={metaTabScope}
            setMetaTabScope={setMetaTabScope}
            show6RecencyDecay={show6RecencyDecay}
            setShow6RecencyDecay={setShow6RecencyDecay}
            gblRecencyDecay={gblRecencyDecay}
            setGblRecencyDecay={setGblRecencyDecay}
            isMetaSettingsOpen={isMetaSettingsOpen}
            setIsMetaSettingsOpen={setIsMetaSettingsOpen}
            show6UsageWeightPct={show6UsageWeightPct}
            handleChangeShow6UsageWeightPct={handleChangeShow6UsageWeightPct}
            gblLogWeightCapPct={gblLogWeightCapPct}
            setGblLogWeightCapPct={setGblLogWeightCapPct}
            webMembershipTier={webMembershipTier}
            onOpenMembershipModal={() => setShowMembershipModal(true)}
            onBuildAntiNemesisTeam={(lg) => {
              setAntiMetaLeague(lg);
              setActiveTab('presets');
              handleGenerateAntiMetaTeams(lg);
            }}
          />
        )}

        {/* =========================================================================
            HELP PAGE (OPENED WHEN THE ❓ HELP BUTTON IN STATUS BAR IS PRESSED)
           ========================================================================= */}
        {activeTab === 'help' && (
          <HelpTab
            setActiveTab={setActiveTab}
            setShowOverlayQuickHelpModal={setShowOverlayQuickHelpModal}
            setShowHelpMetricGuideModal={setShowHelpMetricGuideModal}
            setHelpMetricGuideTopic={setHelpMetricGuideTopic}
          />
        )}

        {/* =========================================================================
            TAB: RANKINGS & MATH VALIDATOR (5 POKÉMON PER LEAGUE)
           ========================================================================= */}
        {activeTab === 'math_validator' && (
          <MathValidatorTab
            validatorLeague={validatorLeague}
            setValidatorLeague={setValidatorLeague}
            validatorSubTab={validatorSubTab}
            setValidatorSubTab={setValidatorSubTab}
            expandedFormId={expandedFormId}
            setExpandedFormId={setExpandedFormId}
            setSelectedCardSpecies={setSelectedCardSpecies}
          />
        )}

        {/* Pick-6 Team Editor Modal (Edit My 6 or Opponent 6 Roster + Suggest Alternate Pokémon & Alternate Moves) */}
        {editingShow6RosterModal && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
            <div className="bg-slate-900 border border-amber-500/50 rounded-2xl max-w-4xl w-full p-5 shadow-2xl space-y-4 my-auto max-h-[92vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                  <h3 className="font-extrabold text-base text-white flex items-center gap-2">
                    <span>
                      {editingShow6RosterModal.target === 'MY'
                        ? '🛡️ Edit My Pick-6 Tournament Roster'
                        : '⚔️ Edit Opponent Pick-6 Tournament Roster'}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-400/50 text-amber-300 text-[10px] font-mono">
                      Max 1 Mega • Weighted Meta + Core Simulator
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Click any of the 6 slots below to inspect &amp; apply <strong>Top Alternate Pokémon Upgrades</strong> and <strong>Top Alternate Movesets</strong> against the fused Battle Frontier Usage + Core + PvPoke meta!
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingShow6RosterModal(null)}
                  className="text-slate-400 hover:text-white font-bold text-lg px-2"
                >
                  ✕
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Roster Name</label>
                  <input
                    type="text"
                    value={editingShow6RosterModal.roster.name}
                    onChange={(e) =>
                      setEditingShow6RosterModal((prev) =>
                        prev ? { ...prev, roster: { ...prev.roster, name: e.target.value } } : null
                      )
                    }
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Show 6 League Format (Auto-Rescales CP)
                  </label>
                  <select
                    value={editingShow6RosterModal.roster.league}
                    onChange={(e) => {
                      const nextLg = e.target.value as LeagueType;
                      const rescaledPokemon = rescaleTeamMembersForLeague(
                        editingShow6RosterModal.roster.pokemon,
                        nextLg
                      );
                      const updatedRoster: Show6RosterOf6Preset = {
                        ...editingShow6RosterModal.roster,
                        league: nextLg,
                        pokemon: rescaledPokemon
                      };
                      setEditingShow6RosterModal({
                        ...editingShow6RosterModal,
                        roster: updatedRoster
                      });
                      refreshShow6EditorSuggestions(updatedRoster, activeShow6EditorSlotIdx);
                    }}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-bold"
                  >
                    {enabledShow6Leagues.map((lg) => (
                      <option key={lg} value={lg}>
                        {lg} ({getLeagueCpCap(lg) >= 10000 ? 'Uncapped CP' : `${getLeagueCpCap(lg)} CP`})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Team Role (Swap My ⇄ Opponent)
                  </label>
                  <div className="grid grid-cols-2 gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-700">
                    <button
                      type="button"
                      onClick={() =>
                        setEditingShow6RosterModal((prev) =>
                          prev ? { ...prev, target: 'MY' } : null
                        )
                      }
                      className={`py-1.5 px-2 rounded-lg text-[11px] font-extrabold transition ${
                        editingShow6RosterModal.target === 'MY'
                          ? 'bg-sky-500 text-slate-950 shadow'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      🛡️ My Show 6
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setEditingShow6RosterModal((prev) =>
                          prev ? { ...prev, target: 'OPP' } : null
                        )
                      }
                      className={`py-1.5 px-2 rounded-lg text-[11px] font-extrabold transition ${
                        editingShow6RosterModal.target === 'OPP'
                          ? 'bg-rose-500 text-slate-950 shadow'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      ⚔️ Opponent 6
                    </button>
                  </div>
                </div>
              </div>

              {/* Relocated Clone & Cross-Mode Copy Panel Inside Pick-6 Edit Team Modal */}
              <div className="p-3.5 rounded-xl bg-slate-950/90 border border-sky-500/35 space-y-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="text-xs font-extrabold text-sky-300">
                      📋 Clone Pick-6 Team or Copy Top-3 Core to Standard GBL (Blind 3)
                    </div>
                    <p className="text-[10.5px] text-slate-400">
                      Clone this 6-Pokémon roster into any Show 6 League/Limited Meta (My 6 or Opponent 6) or copy its Top-3 Core to Standard GBL as a separate entry.
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Target Format:</span>
                    <select
                      value={show6ModalCloneTargetLeague}
                      onChange={(e) => setShow6ModalCloneTargetLeague(e.target.value as LeagueType)}
                      className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-bold text-white"
                    >
                      {enabledShow6Leagues.map((lg) => (
                        <option key={lg} value={lg}>
                          {lg}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() =>
                      handleCloneShow6Roster6(
                        editingShow6RosterModal.roster,
                        editingShow6RosterModal.target,
                        show6ModalCloneTargetLeague,
                        'MY'
                      )
                    }
                    className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-extrabold text-xs transition shadow"
                  >
                    📋 Clone as My Show 6 ({show6ModalCloneTargetLeague.split(' ')[0]})
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      handleCloneShow6Roster6(
                        editingShow6RosterModal.roster,
                        editingShow6RosterModal.target,
                        show6ModalCloneTargetLeague,
                        'OPP'
                      )
                    }
                    className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs transition shadow"
                  >
                    ⚔️ Clone as Opponent Show 6 ({show6ModalCloneTargetLeague.split(' ')[0]})
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCopyShow6RosterToGblBlind3(editingShow6RosterModal.roster)}
                    className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/35 border border-amber-400/50 text-amber-200 font-bold text-xs transition"
                  >
                    🛡️ Copy Top-3 Core to Standard GBL (Blind 3)
                  </button>
                </div>
              </div>

              {/* 6 Pokémon Slots Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {editingShow6RosterModal.roster.pokemon.slice(0, 6).map((member, sIdx) => {
                  const isSelectedSlot = activeShow6EditorSlotIdx === sIdx;
                  const isAutoFocused = show6EditorSlotAutocompleteIdx === sIdx;
                  const autoSugs = isAutoFocused
                    ? getPokemonAutocompleteSuggestions(member.name, editingShow6RosterModal.roster.league, 8)
                    : [];
                  const spEntry =
                    POKEMON_DATABASE[member.name] ||
                    POKEMON_DATABASE[member.name.replace(/^Shadow\s+/i, '').trim()];
                  const fastPool: string[] = spEntry
                    ? [spEntry.defaultFastMove.name]
                    : [member.fastMove];
                  const chargedPool: string[] = spEntry
                    ? spEntry.chargedMoves.map((cm) => cm.name)
                    : [member.chargedMove1, member.chargedMove2];

                  const updateSlotMember = (patch: Partial<TeamMember>, recalculate = false) => {
                    const nextPokemon = [...editingShow6RosterModal.roster.pokemon];
                    nextPokemon[sIdx] = { ...nextPokemon[sIdx], ...patch };
                    const nextRoster = { ...editingShow6RosterModal.roster, pokemon: nextPokemon };
                    setEditingShow6RosterModal({ ...editingShow6RosterModal, roster: nextRoster });
                    if (recalculate) {
                      refreshShow6EditorSuggestions(nextRoster, sIdx);
                    }
                  };

                  return (
                    <div
                      key={`edit-s6-${sIdx}`}
                      onClick={() => {
                        if (activeShow6EditorSlotIdx !== sIdx) {
                          setActiveShow6EditorSlotIdx(sIdx);
                          refreshShow6EditorSuggestions(editingShow6RosterModal.roster, sIdx);
                        }
                      }}
                      className={`p-3 rounded-xl border transition cursor-pointer space-y-2 relative ${
                        isSelectedSlot
                          ? 'bg-amber-500/10 border-amber-400 shadow-lg'
                          : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-extrabold text-amber-300">
                          Slot #{sIdx + 1} {isMegaOrPrimalSpecies(member.name) ? '🧬 MEGA' : ''}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400">
                          {isSelectedSlot ? '✨ Active Optimizer Slot' : 'Click to Suggest'}
                        </span>
                      </div>

                      <div className="relative">
                        <input
                          type="text"
                          value={member.name}
                          onFocus={() => {
                            setActiveShow6EditorSlotIdx(sIdx);
                            setShow6EditorSlotAutocompleteIdx(sIdx);
                          }}
                          onChange={(e) => {
                            updateSlotMember({ name: e.target.value });
                            setShow6EditorSlotAutocompleteIdx(sIdx);
                          }}
                          onBlur={() =>
                            setTimeout(() => {
                              setShow6EditorSlotAutocompleteIdx((prev) => (prev === sIdx ? null : prev));
                            }, 160)
                          }
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-bold text-white"
                          placeholder={`Pokémon #${sIdx + 1}`}
                        />
                        {isAutoFocused && autoSugs.length > 0 && (
                          <div className="absolute left-0 right-0 top-full mt-1 z-50 max-h-44 overflow-y-auto rounded-xl bg-slate-900 border border-amber-400 shadow-2xl divide-y divide-slate-800">
                            {autoSugs.map((opt) => (
                              <button
                                key={opt.name}
                                type="button"
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  const rec = getRecommendedMovesForPokemon(
                                    opt.name,
                                    editingShow6RosterModal.roster.league
                                  );
                                  updateSlotMember(
                                    {
                                      name: opt.name,
                                      cp: rec?.cp || opt.cp,
                                      fastMove: rec?.fastMove || member.fastMove,
                                      chargedMove1: rec?.chargedMove1 || member.chargedMove1,
                                      chargedMove2: rec?.chargedMove2 || member.chargedMove2
                                    },
                                    true
                                  );
                                  setShow6EditorSlotAutocompleteIdx(null);
                                }}
                                className="w-full px-2.5 py-1.5 text-left text-xs font-bold text-white hover:bg-amber-500/25 flex items-center justify-between"
                              >
                                <span className="truncate">{opt.name}</span>
                                <span className="text-[9px] font-mono text-amber-300">CP {opt.cp}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-1 gap-1.5 text-[11px]">
                        <select
                          value={member.fastMove}
                          onChange={(e) => updateSlotMember({ fastMove: e.target.value }, true)}
                          className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-slate-200 font-mono"
                        >
                          {Array.from(new Set([member.fastMove, ...fastPool])).map((fm) => (
                            <option key={fm} value={fm}>
                              Fast: {fm}
                            </option>
                          ))}
                        </select>
                        <div className="grid grid-cols-2 gap-1">
                          <select
                            value={member.chargedMove1}
                            onChange={(e) => updateSlotMember({ chargedMove1: e.target.value }, true)}
                            className="w-full bg-slate-900 border border-slate-800 rounded px-1.5 py-1 text-slate-200 font-mono text-[10px]"
                          >
                            {Array.from(new Set([member.chargedMove1, ...chargedPool])).map((cm) => (
                              <option key={cm} value={cm}>
                                C1: {cm}
                              </option>
                            ))}
                          </select>
                          <select
                            value={member.chargedMove2}
                            onChange={(e) => updateSlotMember({ chargedMove2: e.target.value }, true)}
                            className="w-full bg-slate-900 border border-slate-800 rounded px-1.5 py-1 text-slate-200 font-mono text-[10px]"
                          >
                            {Array.from(new Set([member.chargedMove2, ...chargedPool])).map((cm) => (
                              <option key={cm} value={cm}>
                                C2: {cm}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Per-Slot Recommendations Panel (Alternate Pokémon Upgrades & Alternate Movesets) */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-2 border-t border-slate-800">
                {/* Suggest Alternate Pokémon for Active Slot */}
                <div className="p-3.5 rounded-xl bg-slate-950 border border-emerald-500/40 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-emerald-300">
                      🔄 Suggest Alternate Pokémon for Slot #{activeShow6EditorSlotIdx + 1} (
                      {editingShow6RosterModal.roster.pokemon[activeShow6EditorSlotIdx]?.name})
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        refreshShow6EditorSuggestions(editingShow6RosterModal.roster, activeShow6EditorSlotIdx)
                      }
                      className="text-[10px] font-bold text-emerald-400 hover:underline"
                    >
                      Recalculate
                    </button>
                  </div>
                  {show6EditorSlotUpgrades.length === 0 ? (
                    <p className="text-[11px] text-slate-400">
                      Click any slot card above to compute top Battle Frontier meta &amp; core Pokémon replacements.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {show6EditorSlotUpgrades.map((sug) => (
                        <div
                          key={sug.replacement.name}
                          className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between gap-2 text-xs"
                        >
                          <div className="min-w-0">
                            <div className="font-bold text-white flex items-center gap-1.5 flex-wrap">
                              <span>{sug.replacement.name}</span>
                              <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono text-[10px]">
                                BR {sug.newBr} ({sug.deltaBr >= 0 ? `+${sug.deltaBr}` : sug.deltaBr})
                              </span>
                              {sug.usagePct > 0 && (
                                <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono text-[10px]">
                                  Usage {sug.usagePct.toFixed(1)}%
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono truncate">
                              {sug.replacement.fastMove} + {sug.replacement.chargedMove1}/{sug.replacement.chargedMove2}
                              {resolveMegaPlusMove(sug.replacement.name, editingShow6RosterModal.roster.league) ? ` [+ ${resolveMegaPlusMove(sug.replacement.name, editingShow6RosterModal.roster.league)}]` : ''}
                            </div>
                            <div className="text-[10px] text-sky-300">{sug.synergyReason}</div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const nextPokemon = [...editingShow6RosterModal.roster.pokemon];
                              nextPokemon[activeShow6EditorSlotIdx] = {
                                ...sug.replacement,
                                id: `s6-${activeShow6EditorSlotIdx + 1}`
                              };
                              const nextRoster = { ...editingShow6RosterModal.roster, pokemon: nextPokemon };
                              setEditingShow6RosterModal({ ...editingShow6RosterModal, roster: nextRoster });
                              refreshShow6EditorSuggestions(nextRoster, activeShow6EditorSlotIdx);
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] shrink-0"
                          >
                            Swap In
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Suggest Alternate Movesets for Active Slot */}
                <div className="p-3.5 rounded-xl bg-slate-950 border border-sky-500/40 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-sky-300">
                      ⚡ Suggest Alternate Moves for Slot #{activeShow6EditorSlotIdx + 1} (
                      {editingShow6RosterModal.roster.pokemon[activeShow6EditorSlotIdx]?.name})
                    </span>
                  </div>
                  {show6EditorSlotMovesets.length === 0 ? (
                    <p className="text-[11px] text-slate-400">
                      No alternate legal movesets found for this species.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {show6EditorSlotMovesets.map((ms, mIdx) => (
                        <div
                          key={`${ms.fastMove}-${ms.chargedMove1}-${ms.chargedMove2}-${mIdx}`}
                          className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between gap-2 text-xs"
                        >
                          <div className="min-w-0">
                            <div className="font-bold text-white font-mono truncate">
                              {ms.fastMove} + {ms.chargedMove1} / {ms.chargedMove2}
                              {resolveMegaPlusMove(editingShow6RosterModal.roster.pokemon[activeShow6EditorSlotIdx]?.name, editingShow6RosterModal.roster.league) ? ` [+ ${resolveMegaPlusMove(editingShow6RosterModal.roster.pokemon[activeShow6EditorSlotIdx]?.name, editingShow6RosterModal.roster.league)}]` : ''}
                            </div>
                            <div className="text-[10px] text-slate-400 flex items-center gap-2">
                              <span className="text-sky-300 font-mono">
                                Projected BR {ms.projectedBr} ({ms.deltaBr >= 0 ? `+${ms.deltaBr}` : ms.deltaBr})
                              </span>
                              <span>• {ms.reason}</span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const nextPokemon = [...editingShow6RosterModal.roster.pokemon];
                              nextPokemon[activeShow6EditorSlotIdx] = {
                                ...nextPokemon[activeShow6EditorSlotIdx],
                                fastMove: ms.fastMove,
                                chargedMove1: ms.chargedMove1,
                                chargedMove2: ms.chargedMove2
                              };
                              const nextRoster = { ...editingShow6RosterModal.roster, pokemon: nextPokemon };
                              setEditingShow6RosterModal({ ...editingShow6RosterModal, roster: nextRoster });
                              refreshShow6EditorSuggestions(nextRoster, activeShow6EditorSlotIdx);
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-bold text-[11px] shrink-0"
                          >
                            Apply Moves
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                <span className="text-[11px] text-slate-400">
                  {hasMultipleMegas(editingShow6RosterModal.roster.pokemon) ? (
                    <strong className="text-rose-400">
                      ⚠️ Invalid: Team contains more than 1 Mega/Primal Pokémon!
                    </strong>
                  ) : (
                    '✅ Valid Show 6 Roster (≤ 1 Mega/Primal)'
                  )}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingShow6RosterModal(null)}
                    className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveEditedShow6Roster}
                    className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold shadow-lg"
                  >
                    💾 Save &amp; Load Pick-6 Roster
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Deleted Teams Trash Bin Modal (Separate for Show 6 Mode vs Standard GBL Mode) */}
        <TrashBinModals
          showTeamsTrashModal={showTeamsTrashModal}
          setShowTeamsTrashModal={setShowTeamsTrashModal}
          appCombatMode={appCombatMode}
          deletedTeamsTrash={deletedTeamsTrash}
          show6DeletedRostersTrash={show6DeletedRostersTrash}
          setShow6Rosters6={setShow6Rosters6}
          setShow6OpponentRosters6={setShow6OpponentRosters6}
          saveShow6DeletedRostersTrashToStorage={saveShow6DeletedRostersTrashToStorage}
          restoreTeamPresetsFromTrash={restoreTeamPresetsFromTrash}
          saveDeletedTeamsTrashToStorage={saveDeletedTeamsTrashToStorage}
          showBattlesTrashModal={showBattlesTrashModal}
          setShowBattlesTrashModal={setShowBattlesTrashModal}
          deletedBattlesTrash={deletedBattlesTrash}
          restoreBattleLogsFromTrash={restoreBattleLogsFromTrash}
          saveDeletedBattlesTrashToStorage={saveDeletedBattlesTrashToStorage}
        />

        {/* Help & Metric Guide Modal (v3.00 Documentation Modal) */}
        <DocumentationModals
          showHelpMetricGuideModal={showHelpMetricGuideModal}
          setShowHelpMetricGuideModal={setShowHelpMetricGuideModal}
          helpMetricGuideTopic={helpMetricGuideTopic}
          setHelpMetricGuideTopic={setHelpMetricGuideTopic}
          showOverlayQuickHelpModal={showOverlayQuickHelpModal}
          setShowOverlayQuickHelpModal={setShowOverlayQuickHelpModal}
          setActiveTab={setActiveTab}
        />
      </main>

      {/* Footer */}
      <footer
        className="border-t py-4 px-6 text-center text-xs relative z-10"
        style={{
          borderColor: activeTheme.borderHex,
          color: activeTheme.textSecondaryHex
        }}
      >
        SilphScope PvP v7.21 Overlay • <a href="https://silphscopepvp.com" className="underline">silphscopepvp.com</a> • <a href="https://dvr.silphscopepvp.com" className="underline">dvr.silphscopepvp.com</a> • <a href="https://dl.silphscopepvp.com" className="underline">dl.silphscopepvp.com</a>
      </footer>
        </>
      )}

      {/* v7.13 Membership Tiers, Unlock Key Verification & Stripe / Buy Me a Coffee Modal */}
      {showMembershipModal && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-slate-900 border border-indigo-500/50 rounded-2xl max-w-3xl w-full p-5 shadow-2xl space-y-4 my-auto max-h-[92vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                  <h3 className="font-extrabold text-base text-white flex items-center gap-2">
                    <span>🔑 SilphScope PvP v7.00 Membership Tiers &amp; Cloud Vault Unlock</span>
                    <span className="px-2 py-0.5 rounded bg-indigo-500/20 border border-indigo-400/50 text-indigo-300 text-[10px] font-mono uppercase">
                      Active: {webMembershipTier}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    The real-time floating HUD, 9-shield matrix, energy cadence &amp; haptics are <strong>100% Free forever</strong>. Unlock Cloud DVR Replays, Lifetime Battle Log History &amp; Full Anti-Meta Role Synthesis below!
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowMembershipModal(false)}
                  className="text-slate-400 hover:text-white font-bold text-lg px-2"
                >
                  ✕
                </button>
              </div>

              {membershipStatusMsg && (
                <div className="p-3 rounded-xl bg-slate-950 border border-amber-400/50 text-xs font-bold text-amber-200">
                  {membershipStatusMsg}
                </div>
              )}

              {/* 4-Tier Comparison Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                  <div className="font-extrabold text-slate-200">🆓 Free Community</div>
                  <div className="text-base font-black text-white">$0</div>
                  <ul className="text-[10.5px] text-slate-400 space-y-1">
                    <li>• Live 9-Shield Matrix &amp; Haptics</li>
                    <li>• Current Season Logs (+14d grace)</li>
                    <li>• 1 Local DVR Battle (15 FPS)</li>
                    <li>• GL &amp; ML Anti-Meta (1/arch)</li>
                    <li className="text-rose-400/90">• No Shield Decision HUD Card</li>
                  </ul>
                </div>

                <div className="p-3 rounded-xl bg-slate-950 border border-sky-500/40 space-y-1.5">
                  <div className="font-extrabold text-sky-300">🏅 Lifetime Supporter</div>
                  <div className="text-base font-black text-white">$2 One-Time / Alumni</div>
                  <ul className="text-[10.5px] text-slate-300 space-y-1">
                    <li>• <strong>🛡️ Attack Incoming! Shield Decision HUD</strong></li>
                    <li>• <strong>Unlimited Lifetime Battle Logs</strong></li>
                    <li>• 5 Local DVR Battles (15 FPS)</li>
                    <li>• Core 3 (GL/UL/ML • 2/arch)</li>
                    <li>• 365d Pinned Cloud Retention</li>
                  </ul>
                  <a
                    href="https://buy.stripe.com/4gM3cwf3r8JG7XLamm1Jm07"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full text-center py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-bold text-[11px] mt-2"
                  >
                    💳 $2 Stripe Unlock
                  </a>
                </div>

                <div className="p-3 rounded-xl bg-indigo-950/40 border border-amber-400/60 space-y-1.5">
                  <div className="font-extrabold text-amber-300">🏆 Legend Pro Pass</div>
                  <div className="text-base font-black text-white">$3 Intro / $6 Season</div>
                  <ul className="text-[10.5px] text-slate-200 space-y-1">
                    <li>• <strong>🛡️ Shield HUD + Supporter Forever</strong></li>
                    <li>• <strong>50 Cloud R2 Replays + 10 Pinned (15 FPS)</strong></li>
                    <li>• 25 Local DVR Battles (5 Sets)</li>
                    <li>• <strong>All Limited Cups + Top 5/Arch</strong></li>
                    <li>• <strong>⚡ Alt Movesets + Nemesis Sim</strong></li>
                  </ul>
                  <div className="space-y-1 pt-1">
                    <a
                      href="https://buy.stripe.com/14A4gAcVjf8491P8ee1Jm09"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block w-full text-center py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-[10.5px]"
                    >
                      💳 $3 Day 15+ First Season
                    </a>
                    <a
                      href="https://buy.stripe.com/8x2aEY8F33pma5TgKK1Jm08"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block w-full text-center py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[10.5px]"
                    >
                      💳 $6 Full 90d Season Pass
                    </a>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-purple-950/30 border border-purple-400/50 space-y-1.5">
                  <div className="font-extrabold text-purple-300">👑 VIP / Coach Pass</div>
                  <div className="text-base font-black text-white">$5 Intro / $10 Season</div>
                  <ul className="text-[10.5px] text-slate-200 space-y-1">
                    <li>• <strong>🎥 30 FPS Smooth DVR (+ 15 FPS Saver)</strong></li>
                    <li>• <strong>150 Cloud Replays (365d) + 25 Pin</strong></li>
                    <li>• Up to 100 Local DVR Battles (Slider)</li>
                    <li>• <strong>🛡️ Shield HUD + All Pro &amp; Alumni Perks</strong></li>
                  </ul>
                  <div className="space-y-1 pt-1">
                    <a
                      href="https://buy.stripe.com/4gM7sM5sR5xudi5amm1Jm0c"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block w-full text-center py-1.5 rounded-lg bg-purple-500 hover:bg-purple-400 text-white font-black text-[10.5px]"
                    >
                      💳 $5 Day 15+ First Season
                    </a>
                    <a
                      href="https://buy.stripe.com/9B6fZi3kJ6By4Lzamm1Jm0b"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block w-full text-center py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-purple-200 font-bold text-[10.5px]"
                    >
                      💳 $10 Full 90d Season Pass
                    </a>
                  </div>
                </div>
              </div>

              {/* Activate / Login via Username+Token, Username+Password, or GitHub OAuth */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs font-extrabold text-sky-300">
                    🔐 Sign In / Activate Membership &amp; DVR Vault:
                  </div>
                  <div className="flex items-center gap-1.5">
                    {(['token', 'password', 'github'] as const).map((tab) => (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => setWebAuthTab(tab)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition ${
                          webAuthTab === tab
                            ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                            : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
                        }`}
                      >
                        {tab === 'token'
                          ? '🔑 Username + Token'
                          : tab === 'password'
                          ? '🔒 Username + Password'
                          : '🐙 GitHub Login'}
                      </button>
                    ))}
                  </div>
                </div>

                {webAuthTab === 'token' && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <input
                      type="text"
                      value={webScreenName}
                      onChange={(e) => setWebScreenName(e.target.value)}
                      placeholder="Trainer Screen Name (e.g. sportsfan986)"
                      className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-bold"
                    />
                    <input
                      type="text"
                      value={webUnlockKey}
                      onChange={(e) => setWebUnlockKey(e.target.value)}
                      placeholder="Unlock Key (SSPVP-PRO-...)"
                      className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-amber-300 font-mono font-bold"
                    />
                    <input
                      type="email"
                      value={webClaimEmail}
                      onChange={(e) => setWebClaimEmail(e.target.value)}
                      placeholder="Or Checkout Email"
                      className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                    />
                  </div>
                )}

                {webAuthTab === 'password' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <input
                      type="text"
                      value={webScreenName}
                      onChange={(e) => setWebScreenName(e.target.value)}
                      placeholder="Trainer Screen Name (e.g. sportsfan986)"
                      className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-bold"
                    />
                    <input
                      type="password"
                      value={webPassword}
                      onChange={(e) => setWebPassword(e.target.value)}
                      placeholder="Vault Password"
                      className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                    />
                  </div>
                )}

                {webAuthTab === 'github' && (
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <input
                        type="text"
                        value={webScreenName}
                        onChange={(e) => setWebScreenName(e.target.value)}
                        placeholder="Trainer Screen Name (optional if matches GitHub)"
                        className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-bold flex-1 min-w-[200px]"
                      />
                      <button
                        type="button"
                        onClick={handleStartWebGitHubLogin}
                        className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white font-extrabold text-xs shadow transition"
                      >
                        🐙 1-Click Sign In with GitHub
                      </button>
                    </div>
                    {ghDeviceCodeInfo && (
                      <div className="p-2.5 rounded-xl bg-slate-900 border border-sky-500/50 flex flex-wrap items-center justify-between gap-2 text-xs">
                        <span className="text-slate-300">
                          1. Copy Code:{' '}
                          <strong className="text-sky-300 font-mono text-sm px-2 py-0.5 bg-slate-950 rounded">
                            {ghDeviceCodeInfo.user_code}
                          </strong>
                        </span>
                        <div className="flex flex-wrap items-center gap-2">
                          <a
                            href={ghDeviceCodeInfo.verification_uri}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1 rounded-lg bg-emerald-600 text-white font-bold"
                          >
                            2. Open GitHub &amp; Authorize ↗
                          </a>
                          <button
                            type="button"
                            onClick={() => pollWebGitHubDeviceNow(ghDeviceCodeInfo.device_code, true)}
                            className="px-3 py-1 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-bold"
                          >
                            ✅ 3. I&apos;ve Authorized — Finish Sign-In
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    {webAuthTab !== 'github' && (
                      <button
                        type="button"
                        onClick={handleVerifyWebMembership}
                        className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs shadow-lg transition"
                      >
                        ✅ Sign In &amp; Activate Membership
                      </button>
                    )}
                    <a
                      href={`https://dvr.silphscopepvp.com/vault${webScreenName.trim() ? `?user=${encodeURIComponent(webScreenName.trim())}` : ''}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-sky-300 font-bold text-xs transition"
                    >
                      🎬 Open Cloud DVR Vault Page
                    </a>
                  </div>
                  <a
                    href="https://buymeacoffee.com/silphscopepvp"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3.5 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/50 text-amber-300 font-bold text-xs transition"
                  >
                    ☕ Prefer Buy Me a Coffee (PokéCoins)?
                  </a>
                </div>

                {/* Owner DVR Vault Visibility & Set Password Controls */}
                {(webSessionToken || webMembershipTier !== 'free') && (
                  <div className="pt-3 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="space-y-1">
                      <label className="font-bold text-slate-300 block">
                        🌐 Public DVR Vault Visibility (/vault?user={webScreenName.trim() || 'you'}):
                      </label>
                      <select
                        value={webVaultVisibility}
                        onChange={(e) =>
                          handleUpdateWebVaultVisibility(
                            e.target.value as
                              | 'public_only'
                              | 'starred_only'
                              | 'starred_and_public'
                              | 'all'
                              | 'none'
                          )
                        }
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white font-bold"
                      >
                        <option value="public_only">🔒 Private (Only shows ones manually made public)</option>
                        <option value="starred_only">⭐ Starred only</option>
                        <option value="starred_and_public">⭐+🌐 Starred + Private (Starred or manually made public)</option>
                        <option value="all">🌐 All videos shared (Overrides per-video private)</option>
                        <option value="none">🚫 No videos shared without login</option>
                      </select>
                      <div className="text-[10.5px] text-slate-400">
                        Direct <code>/watch/...</code> share links always work for anyone you send them to. Only you can ⭐ Star/Unstar videos.
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="font-bold text-slate-300 block">
                        🔒 Set / Update Password for Username+Password Login:
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="password"
                          value={webNewPassword}
                          onChange={(e) => setWebNewPassword(e.target.value)}
                          placeholder="New Password (min 6 chars)"
                          className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white"
                        />
                        <button
                          type="button"
                          onClick={handleSaveWebPassword}
                          className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shrink-0"
                        >
                          💾 Save
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
    </div>
  );
}
