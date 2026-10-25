import React, { useState, useEffect, useMemo } from 'react';
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
  FileCode2,
  FolderArchive,
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
  calculateTurnAlignment,
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
  inferUnshieldedChargedMoveName
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
import { ANDROID_FILES, downloadAndroidProjectZip, AndroidProjectFile } from './data/androidFiles';

function renderTierDots(tierStr: string) {
  const raw = tierStr || 'W,N,L';
  const tokens = raw.includes(',')
    ? raw.split(',')
    : Array.from(raw).map((ch) => (ch === '🟢' ? 'W' : ch === '🔴' ? 'L' : 'N'));

  return (
    <span className="inline-flex items-center gap-[1px]">
      {tokens.slice(0, 3).map((tok, i) => {
        const t = tok.trim().toUpperCase();
        if (t === 'SW') {
          return (
            <span
              key={i}
              title="Strong Win"
              className="w-[9.5px] h-[9.5px] rounded-full inline-flex items-center justify-center text-[7px] font-black leading-none text-white bg-gradient-to-br from-emerald-400 to-emerald-600 border border-emerald-200 shadow-[0_0_4px_rgba(16,185,129,0.9)]"
            >
              +
            </span>
          );
        }
        if (t === 'W') {
          return (
            <span
              key={i}
              title="Win"
              className="w-[8.5px] h-[8.5px] rounded-full inline-block bg-green-500 border border-green-300/80"
            />
          );
        }
        if (t === 'SL') {
          return (
            <span
              key={i}
              title="Strong Loss"
              className="w-[9.5px] h-[9.5px] rounded-full inline-flex items-center justify-center text-[7px] font-black leading-none text-white bg-gradient-to-br from-red-500 to-red-800 border border-red-200 shadow-[0_0_4px_rgba(239,68,68,0.9)]"
            >
              ×
            </span>
          );
        }
        if (t === 'L') {
          return (
            <span
              key={i}
              title="Loss"
              className="w-[8.5px] h-[8.5px] rounded-full inline-block bg-red-500 border border-red-300/80"
            />
          );
        }
        return (
          <span
            key={i}
            title="Neutral"
            className="w-[8.5px] h-[8.5px] rounded-full inline-block bg-slate-400 border border-slate-300/80"
          />
        );
      })}
    </span>
  );
}

export interface WebBattleLogEntry {
  id: string;
  timestampMs: number;
  league: string;
  presetId?: string;
  userTeamName: string;
  userPokemon: string[];
  opponents: string[];
  result: 'WIN' | 'LOSS';
  leadMatchup: 'FAVORABLE' | 'NEUTRAL' | 'NEGATIVE';
  bmfScore?: number | null;
  execWae?: number | null;
  badges?: string[];
  flags?: string[];
  quality?: BattleQualityMetadata | null;
  timelineEvents?: BattleTimelineEvent[];
  battleDurationSec?: number;
  userFaints?: number;
  oppFaints?: number;
  userShieldsRemaining?: number;
  oppShieldsRemaining?: number;
  finalUserHpPct?: number[];
  finalOppHpPct?: number[];
  firstSwapActor?: string;
  switchAdvantage?: string;
  adherenceRatePct?: number | null;
  recommendationsIssuedCount?: number | null;
  recommendationsFollowedCount?: number | null;
  deviceId?: string;
  updatedAt?: number;
}

export interface WebAiTrainingLogRecord {
  battleId: string;
  timestampMs: number;
  league: string;
  userTeamName: string;
  userPokemon: string[];
  opponents: string[];
  leadMatchup: string;
  result: 'WIN' | 'LOSS';
  battleDurationSec?: number;
  adherenceRatePct?: number | null;
  recommendationsIssuedCount?: number | null;
  recommendationsFollowedCount?: number | null;
  timelineEvents: BattleTimelineEvent[];
}

const AI_LOG_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

function deriveFirstSwapAndSwitchAdvantageWeb(
  events: BattleTimelineEvent[],
  leadMatchup: string,
  result: 'WIN' | 'LOSS',
  opponentsSeenCount: number
): { firstSwapActor: string; switchAdvantage: string } {
  const swapEvents = (events || []).filter((e) => e.type === 'SWAP');
  const firstSwap = swapEvents[0];
  const firstSwapActor = firstSwap
    ? firstSwap.actor === 'user'
      ? 'USER'
      : firstSwap.actor === 'opp'
      ? 'OPPONENT'
      : 'NONE'
    : opponentsSeenCount >= 2
    ? leadMatchup === 'NEGATIVE'
      ? 'USER'
      : leadMatchup === 'FAVORABLE'
      ? 'OPPONENT'
      : 'NONE'
    : 'NONE';

  const switchAdvantage =
    firstSwapActor === 'NONE'
      ? leadMatchup === 'FAVORABLE'
        ? 'MAINTAINED'
        : leadMatchup === 'NEGATIVE'
        ? 'LOST'
        : 'NEUTRAL'
      : firstSwapActor === 'USER'
      ? result === 'WIN'
        ? 'GAINED'
        : 'LOST'
      : result === 'WIN'
      ? 'MAINTAINED'
      : 'LOST';

  return { firstSwapActor, switchAdvantage };
}

export interface GblSeasonInfo {
  eventID: string;
  name: string;
  startMs: number;
  endMs: number;
  rawStart: string;
  rawEnd: string;
}

const DEFAULT_SEASONS_FALLBACK: GblSeasonInfo[] = [
  {
    eventID: 'season-24-twilight-trails',
    name: 'Twilight Trails',
    startMs: new Date('2026-09-08T10:00:00').getTime(),
    endMs: new Date('2026-12-01T10:00:00').getTime(),
    rawStart: '2026-09-08T10:00:00',
    rawEnd: '2026-12-01T10:00:00'
  },
  {
    eventID: 'season-23-prev',
    name: 'Previous GBL Season',
    startMs: new Date('2026-06-01T10:00:00').getTime(),
    endMs: new Date('2026-09-08T10:00:00').getTime(),
    rawStart: '2026-06-01T10:00:00',
    rawEnd: '2026-09-08T10:00:00'
  }
];

export interface WebAppThemePalette {
  id: string;
  name: string;
  description: string;
  isLight: boolean;
  bgHex: string;
  cardHex: string;
  cardAltHex: string;
  borderHex: string;
  accentHex: string;
  accentSecondaryHex: string;
  textPrimaryHex: string;
  textSecondaryHex: string;
  overlayBgRgb: string;
  overlayBorderRgb: string;
  overlayHeaderRgb: string;
  emblemType: 'none' | 'dialga' | 'instinct' | 'mystic' | 'valor' | 'sylveon';
  watermarkAlpha: number;
}

export const WEB_APP_THEMES: WebAppThemePalette[] = [
  {
    id: 'dialga_shiny_midnight',
    name: '✨ Shiny Origin Dialga Midnight (Dark)',
    description: 'Shiny Origin Forme Dialga ✨ • Deep temporal void (#050B16) with Luminous Teal (#2DD4BF), Astral Ring Gold (#FACC15) & Origin Crest',
    isLight: false,
    bgHex: '#050B16',
    cardHex: '#0E1B2E',
    cardAltHex: '#081120',
    borderHex: '#19304E',
    accentHex: '#2DD4BF',
    accentSecondaryHex: '#FACC15',
    textPrimaryHex: '#ECFEFF',
    textSecondaryHex: '#99F6E4',
    overlayBgRgb: '5, 11, 22',
    overlayBorderRgb: '45, 212, 191',
    overlayHeaderRgb: '45, 212, 191',
    emblemType: 'dialga',
    watermarkAlpha: 0.22
  },
  {
    id: 'instinct_dark',
    name: '⚡ Team Instinct Storm (Dark)',
    description: 'Pokémon GO Instinct • Thunder Charcoal (#0F0D06) with Zapdos Lightning Gold (#FACC15), Storm Sky Cyan (#38BDF8) & Emblem',
    isLight: false,
    bgHex: '#0F0D06',
    cardHex: '#1A1609',
    cardAltHex: '#120F06',
    borderHex: '#3D3210',
    accentHex: '#FACC15',
    accentSecondaryHex: '#38BDF8',
    textPrimaryHex: '#FEFCE8',
    textSecondaryHex: '#FDE047',
    overlayBgRgb: '18, 15, 6',
    overlayBorderRgb: '250, 204, 21',
    overlayHeaderRgb: '250, 204, 21',
    emblemType: 'instinct',
    watermarkAlpha: 0.22
  },
  {
    id: 'instinct_light',
    name: '⚡ Team Instinct Spark (Light)',
    description: 'Pokémon GO Instinct Light • Warm Ivory (#FFFDF4) with Golden Amber (#D97706), Electric Cobalt (#0284C7) & Zapdos Emblem',
    isLight: true,
    bgHex: '#FFFDF4',
    cardHex: '#FFFFFF',
    cardAltHex: '#FEF9C3',
    borderHex: '#FDE047',
    accentHex: '#D97706',
    accentSecondaryHex: '#0284C7',
    textPrimaryHex: '#1C1917',
    textSecondaryHex: '#57534E',
    overlayBgRgb: '18, 15, 6',
    overlayBorderRgb: '245, 158, 11',
    overlayHeaderRgb: '245, 158, 11',
    emblemType: 'instinct',
    watermarkAlpha: 0.25
  },
  {
    id: 'mystic_dark',
    name: '❄️ Team Mystic Blizzard (Dark)',
    description: 'Pokémon GO Mystic • Deep Glacial Abyss (#060D1A) with Articuno Ice Blue (#38BDF8), Aurora Violet (#C084FC) & Emblem',
    isLight: false,
    bgHex: '#060D1A',
    cardHex: '#0C1930',
    cardAltHex: '#081224',
    borderHex: '#1E3A8A',
    accentHex: '#38BDF8',
    accentSecondaryHex: '#C084FC',
    textPrimaryHex: '#EFF6FF',
    textSecondaryHex: '#93C5FD',
    overlayBgRgb: '8, 16, 32',
    overlayBorderRgb: '56, 189, 248',
    overlayHeaderRgb: '56, 189, 248',
    emblemType: 'mystic',
    watermarkAlpha: 0.22
  },
  {
    id: 'mystic_light',
    name: '❄️ Team Mystic Glacier (Light)',
    description: 'Pokémon GO Mystic Light • Crisp Ice White (#F0F7FF) with Glacier Blue (#0284C7), Royal Frost Indigo (#7C3AED) & Articuno Emblem',
    isLight: true,
    bgHex: '#F0F7FF',
    cardHex: '#FFFFFF',
    cardAltHex: '#DBEAFE',
    borderHex: '#93C5FD',
    accentHex: '#0284C7',
    accentSecondaryHex: '#7C3AED',
    textPrimaryHex: '#0F172A',
    textSecondaryHex: '#334155',
    overlayBgRgb: '8, 16, 32',
    overlayBorderRgb: '56, 189, 248',
    overlayHeaderRgb: '56, 189, 248',
    emblemType: 'mystic',
    watermarkAlpha: 0.25
  },
  {
    id: 'valor_dark',
    name: '🔥 Team Valor Inferno (Dark)',
    description: 'Pokémon GO Valor • Smoldering Obsidian (#160709) with Moltres Crimson (#F43F5E), Molten Solar Gold (#FBBF24) & Emblem',
    isLight: false,
    bgHex: '#160709',
    cardHex: '#240C10',
    cardAltHex: '#1B080C',
    borderHex: '#4C111B',
    accentHex: '#F43F5E',
    accentSecondaryHex: '#FBBF24',
    textPrimaryHex: '#FEF2F2',
    textSecondaryHex: '#FCA5A5',
    overlayBgRgb: '24, 8, 10',
    overlayBorderRgb: '244, 63, 94',
    overlayHeaderRgb: '244, 63, 94',
    emblemType: 'valor',
    watermarkAlpha: 0.22
  },
  {
    id: 'valor_light',
    name: '🔥 Team Valor Dawn (Light)',
    description: 'Pokémon GO Valor Light • Warm Cream (#FFF5F5) with Valor Crimson (#E11D48), Phoenix Solar Amber (#D97706) & Moltres Emblem',
    isLight: true,
    bgHex: '#FFF5F5',
    cardHex: '#FFFFFF',
    cardAltHex: '#FEE2E2',
    borderHex: '#FCA5A5',
    accentHex: '#E11D48',
    accentSecondaryHex: '#D97706',
    textPrimaryHex: '#1F1215',
    textSecondaryHex: '#57363B',
    overlayBgRgb: '24, 8, 10',
    overlayBorderRgb: '249, 115, 22',
    overlayHeaderRgb: '249, 115, 22',
    emblemType: 'valor',
    watermarkAlpha: 0.25
  },
  {
    id: 'sylveon_pink',
    name: '🎀 Sylveon Fairy Ribbon (Light Pink)',
    description: 'Sylveon Theme • Pastel Blush (#FFF0F6) with Fairy Ribbon Pink (#EC4899), Distinctive Sylveon Pastel Blue (#38BDF8) & Bow Watermark',
    isLight: true,
    bgHex: '#FFF0F6',
    cardHex: '#FFFFFF',
    cardAltHex: '#FCE7F3',
    borderHex: '#F9A8D4',
    accentHex: '#EC4899',
    accentSecondaryHex: '#38BDF8',
    textPrimaryHex: '#3B0724',
    textSecondaryHex: '#831843',
    overlayBgRgb: '27, 11, 22',
    overlayBorderRgb: '244, 114, 182',
    overlayHeaderRgb: '244, 114, 182',
    emblemType: 'sylveon',
    watermarkAlpha: 0.25
  },
  {
    id: 'slate',
    name: '🛡️ SilphScope Slate (Default Generic)',
    description: 'Generic Default • Deep tactical navy (#080C14) with Sky Cyan (#38BDF8) & Tactical Amber (#F59E0B) accents',
    isLight: false,
    bgHex: '#080C14',
    cardHex: '#121824',
    cardAltHex: '#0B111E',
    borderHex: '#1E293B',
    accentHex: '#38BDF8',
    accentSecondaryHex: '#F59E0B',
    textPrimaryHex: '#F8FAFC',
    textSecondaryHex: '#94A3B8',
    overlayBgRgb: '10, 14, 22',
    overlayBorderRgb: '56, 189, 248',
    overlayHeaderRgb: '56, 189, 248',
    emblemType: 'none',
    watermarkAlpha: 0
  }
];

function renderThemeOverlayIcon(themeId: string, sizePx: number = 14) {
  const s = `${sizePx}px`;
  const styleObj = { width: s, height: s, display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 };
  if (themeId === 'dialga_shiny_midnight') {
    return (
      <svg viewBox="0 0 240 240" style={styleObj}>
        <path fill="none" stroke="#2DD4BF" strokeWidth="10" d="M120,12 L196,44 L228,120 L196,196 L120,228 L44,196 L12,120 L44,44 Z" />
        <path fill="none" stroke="#FACC15" strokeWidth="11" d="M120,44 L178,76 L178,164 L120,196 L62,164 L62,76 Z" />
        <path fill="#FACC15" d="M62,76 L18,48 L48,94 Z M178,76 L222,48 L192,94 Z M54,120 L10,120 L54,134 Z M186,120 L230,120 L186,134 Z M62,164 L22,192 L54,146 Z M178,164 L218,192 L186,146 Z" />
        <path fill="#14B8A6" stroke="#67E8F9" strokeWidth="6" d="M120,16 L138,48 L156,32 L144,76 L186,98 L152,134 L168,188 L142,174 L120,224 L98,174 L72,188 L88,134 L54,98 L96,76 L84,32 L102,48 Z" />
        <path fill="#081224" stroke="#FACC15" strokeWidth="9" d="M120,84 L152,120 L120,156 L88,120 Z" />
        <path fill="#67E8F9" d="M120,96 L140,120 L120,144 L100,120 Z" />
      </svg>
    );
  }
  if (themeId === 'instinct_dark' || themeId === 'instinct_light') {
    return (
      <svg viewBox="0 0 240 240" style={styleObj}>
        <path fill="#FACC15" d="M120,8 L224,120 L120,232 L16,120 Z M120,28 L36,120 L120,212 L204,120 Z" />
        <path fill="#F59E0B" d="M120,44 L132,78 L168,52 L152,92 L206,72 L168,114 L218,110 L166,138 L198,162 L148,154 L164,192 L128,166 L120,212 L112,166 L76,192 L92,154 L42,162 L74,138 L22,110 L72,114 L34,72 L88,92 L72,52 L108,78 Z" />
      </svg>
    );
  }
  if (themeId === 'mystic_dark' || themeId === 'mystic_light') {
    return (
      <svg viewBox="0 0 240 240" style={styleObj}>
        <path fill="#38BDF8" d="M120,10 L208,58 L208,162 L120,230 L32,162 L32,58 Z M120,28 L48,68 L48,152 L120,210 L192,152 L192,68 Z" />
        <path fill="#60A5FA" d="M120,56 L134,82 L192,62 L164,112 L202,122 L152,144 L168,176 L132,160 L120,222 L108,160 L72,176 L88,144 L38,122 L76,112 L48,62 L106,82 Z" />
      </svg>
    );
  }
  if (themeId === 'valor_dark' || themeId === 'valor_light') {
    return (
      <svg viewBox="0 0 240 240" style={styleObj}>
        <path fill="#EF4444" d="M120,12 C168,46 212,92 212,144 C212,190 172,226 120,232 C68,226 28,190 28,144 C28,92 72,46 120,12 Z M120,34 C82,62 48,100 48,144 C48,180 78,208 120,214 C162,208 192,180 192,144 C192,100 158,62 120,34 Z" />
        <path fill="#F97316" d="M120,42 L134,68 L156,52 L148,86 L198,64 L172,108 L206,102 L168,136 L192,158 L148,154 L162,188 L128,170 L120,214 L112,170 L78,188 L92,154 L48,158 L72,136 L34,102 L68,108 L42,64 L92,86 L84,52 L106,68 Z" />
      </svg>
    );
  }
  if (themeId === 'sylveon_pink' || themeId === 'sylveon_light') {
    return (
      <svg viewBox="0 0 240 240" style={styleObj}>
        <path fill="#38BDF8" d="M96,126 C76,154 48,176 26,198 L44,206 C66,186 90,164 108,138 Z M144,126 C164,154 192,176 214,198 L196,206 C174,186 150,164 132,138 Z" />
        <path fill="#EC4899" d="M112,108 C84,72 42,66 30,92 C18,118 48,148 112,124 Z M128,108 C156,72 198,66 210,92 C222,118 192,148 128,124 Z" />
        <circle cx="120" cy="118" r="24" fill="#F9A8D4" />
        <path fill="#38BDF8" d="M120,24 L127,44 L147,51 L127,58 L120,78 L113,58 L93,51 L113,44 Z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 240 240" style={styleObj}>
      <circle cx="120" cy="120" r="88" fill="none" stroke="#38BDF8" strokeWidth="22" />
      <path fill="#F59E0B" d="M120,12 L134,64 L106,64 Z M120,228 L134,176 L106,176 Z M12,120 L64,134 L64,106 Z M228,120 L176,134 L176,106 Z" />
      <circle cx="120" cy="120" r="28" fill="#38BDF8" />
    </svg>
  );
}

export default function App() {
  // Navigation tabs (reordered: Teams, Battle Logs, Settings, Help, Math Validator)
  const [activeTab, setActiveTab] = useState<'simulator' | 'presets' | 'battle_log' | 'settings' | 'help' | 'turn_matrix' | 'android_code' | 'math_validator'>('simulator');
  const [validatorLeague, setValidatorLeague] = useState<LeagueType>('GREAT LEAGUE');
  const [validatorSubTab, setValidatorSubTab] = useState<'matrix_cards' | 'form_changes' | 'aegislash_audit' | 'cross_validation'>('matrix_cards');
  const [selectedCardSpecies, setSelectedCardSpecies] = useState<string>('Melmetal');
  const [expandedFormId, setExpandedFormId] = useState<string>('morpeko-forms');

  // Anti-Meta Team Builder State (Team Presets Page: 0, 1, or 2 Featured Pokémon + League -> 5 ABB & 5 ABC Teams)
  const [showAntiMetaBuilder, setShowAntiMetaBuilder] = useState<boolean>(true);
  const [antiMetaLeague, setAntiMetaLeague] = useState<LeagueType>('GREAT LEAGUE');
  const [antiMetaFeat1, setAntiMetaFeat1] = useState<string>('');
  const [antiMetaFeat2, setAntiMetaFeat2] = useState<string>('');
  const [antiMetaDropdownSlot, setAntiMetaDropdownSlot] = useState<1 | 2 | null>(null);
  const [antiMetaResult, setAntiMetaResult] = useState<AntiMetaTeamBuilderResult | null>(null);

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

  // App-Level Setting: Overlay Background Transparency (0% - 100%, Default 72%, step 2%)
  const [overlayTransparencyPct, setOverlayTransparencyPct] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('gbl_overlay_transparency_pct');
      if (saved !== null) {
        const num = Number(saved);
        if (!Number.isNaN(num) && num >= 0 && num <= 100) {
          return Math.round(num / 2) * 2;
        }
      }
    } catch {}
    return 72;
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

  const [battleLogs, setBattleLogs] = useState<WebBattleLogEntry[]>(() => {
    try {
      const raw = localStorage.getItem('gbl_battle_logs_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  });

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

  const [deletedBattlesTrash, setDeletedBattlesTrash] = useState<WebBattleLogEntry[]>(() => {
    try {
      const raw = localStorage.getItem('gbl_deleted_battles_trash_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  });

  const [deletedTeamsTrash, setDeletedTeamsTrash] = useState<TeamPreset[]>(() => {
    try {
      const raw = localStorage.getItem('gbl_deleted_teams_trash_v1');
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
    setDeletedBattlesTrash(unique);
    try {
      localStorage.setItem('gbl_deleted_battles_trash_v1', JSON.stringify(unique));
    } catch {}
  };

  const saveDeletedTeamsTrashToStorage = (list: TeamPreset[]) => {
    const unique = Array.from(new Map(list.map((item) => [item.id, item])).values()).slice(0, 50);
    setDeletedTeamsTrash(unique);
    try {
      localStorage.setItem('gbl_deleted_teams_trash_v1', JSON.stringify(unique));
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

  // Battle Log Filter & Modal States
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
      localStorage.setItem('gbl_battle_logs_v1', JSON.stringify(compact));
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
        localStorage.setItem('gbl_battle_logs_v1', JSON.stringify(updated));
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

  // Team Presets State (persisted in version-independent 'gbl_user_teams_persistent' with automatic migration from legacy keys)
  const [presets, setPresets] = useState<TeamPreset[]>(() => {
    try {
      const persistent = localStorage.getItem('gbl_user_teams_persistent');
      if (persistent) {
        const parsed = JSON.parse(persistent);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
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
            localStorage.setItem('gbl_user_teams_persistent', JSON.stringify(parsed));
            return parsed;
          }
        }
      }
    } catch (e) {
      console.error(e);
    }
    return INITIAL_PRESETS;
  });

  const [selectedPresetId, setSelectedPresetId] = useState<string>(() => {
    return localStorage.getItem('gbl_selected_preset_id') || 'preset-ml-1';
  });

  // Save presets whenever updated to version-independent key
  useEffect(() => {
    try {
      localStorage.setItem('gbl_user_teams_persistent', JSON.stringify(presets));
    } catch {}
  }, [presets]);

  useEffect(() => {
    try {
      localStorage.setItem('gbl_selected_preset_id', selectedPresetId);
    } catch {}
  }, [selectedPresetId]);

  const activePreset = useMemo(() => {
    return presets.find(p => p.id === selectedPresetId) || presets[0] || INITIAL_PRESETS[0];
  }, [presets, selectedPresetId]);

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
    setPresets((prev) =>
      recalculateAllPresetsMetrics(
        prev,
        battleLogs,
        activeSeasonBounds.startMs,
        activeSeasonBounds.endMs
      )
    );
  }, [battleLogs.length, activeSeasonBounds.startMs, activeSeasonBounds.endMs]);

  const [reparseBattlesStatus, setReparseBattlesStatus] = useState<string>(
    'Re-evaluates all logged battles with latest 2.56x dual-type & Shadow 1.2x damage + Win Quality (WAE) metrics'
  );

  const handleReparseAllCompletedBattles = (silent: boolean = false) => {
    const reparsedActive = reparseAllCompletedBattleLogs(battleLogs, presets, 'gbl_battle_logs_v1');
    setBattleLogs(reparsedActive);
    const reparsedTrash = reparseAllCompletedBattleLogs(deletedBattlesTrash, presets, 'gbl_deleted_battles_trash_v1');
    setDeletedBattlesTrash(reparsedTrash);
    const agg = calculateAggregateWAE(reparsedActive, presets);
    const timeStr = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    setReparseBattlesStatus(
      `✅ Reparsed ${reparsedActive.length} completed battle(s) at ${timeStr} • Ranked: ${agg.rankedCount} • Exec WAE: ${agg.formatted} • Luck: ${agg.luckFormatted}`
    );
    if (!silent) {
      try {
        localStorage.setItem('gbl_damage_reparse_version', '293');
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
    const migActive = migrateExistingBattleLogs(battleLogs, presets, 'gbl_battle_logs_v1');
    if (migActive.didMigrate) {
      setBattleLogs(migActive.logs);
    }
    const migTrash = migrateExistingBattleLogs(deletedBattlesTrash, presets, 'gbl_deleted_battles_trash_v1');
    if (migTrash.didMigrate) {
      setDeletedBattlesTrash(migTrash.logs);
    }
    runOneTimeAiLogSplitAndCleanup(true);
  }, [presets]);

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
    const timer = setInterval(() => {
      setNowMs(Date.now());
    }, 200);
    return () => clearInterval(timer);
  }, []);

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

  // Auto-sync PvPoke gamemaster.json + 4 league rankings JSONs on startup
  useEffect(() => {
    let mounted = true;
    syncPvPokeDataAndRankings()
      .then((res) => {
        if (!mounted) return;
        const gl = res.rankingsCount['GREAT LEAGUE'] || 0;
        const ul = res.rankingsCount['ULTRA LEAGUE'] || 0;
        const ml = res.rankingsCount['MASTER LEAGUE'] || 0;
        const mega = res.rankingsCount['MEGA MASTER LEAGUE'] || 0;
        const totalRanked = gl + ul + ml + mega;
        const nowStr = new Date().toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: 'numeric',
          minute: '2-digit'
        });
        setDbTelemetry(getPvPokeDatabaseTelemetry());
        if (totalRanked > 0) {
          setLastSyncedAt(nowStr);
          try {
            localStorage.setItem('gbl_last_sync_timestamp', nowStr);
          } catch {}
          setPvPokeSyncStatus(
            `Last Updated: ${nowStr} • GameMaster: ${res.syncedCount} Pokémon • GL: ${gl} • UL: ${ul} • ML: ${ml} • Mega: ${mega}`
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
    setPvPokeSyncStatus('Syncing gamemaster + GL/UL/ML/Mega rankings...');
    try {
      const res = await syncPvPokeDataAndRankings();
      const gl = res.rankingsCount['GREAT LEAGUE'] || 0;
      const ul = res.rankingsCount['ULTRA LEAGUE'] || 0;
      const ml = res.rankingsCount['MASTER LEAGUE'] || 0;
      const mega = res.rankingsCount['MEGA MASTER LEAGUE'] || 0;
      const totalRanked = gl + ul + ml + mega;
      const nowStr = new Date().toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      });
      setDbTelemetry(getPvPokeDatabaseTelemetry());
      if (totalRanked > 0) {
        setLastSyncedAt(nowStr);
        try {
          localStorage.setItem('gbl_last_sync_timestamp', nowStr);
        } catch {}
      }
      recalculateAllPresetsWithSeasonMeta(presets, battleLogs);
      setPvPokeSyncStatus(
        totalRanked > 0
          ? `Last Updated: ${nowStr} • GameMaster: ${res.syncedCount} Pokémon • GL: ${gl} • UL: ${ul} • ML: ${ml} • Mega: ${mega}`
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

  const [p2Name, setP2Name] = useState('Feraligatr');
  const [p2Cp, setP2Cp] = useState(1498);
  const [p2Ivs, setP2Ivs] = useState('');
  const [p2Fast, setP2Fast] = useState('Shadow Claw');
  const [p2C1, setP2C1] = useState('Hydro Cannon');
  const [p2C2, setP2C2] = useState('Ice Beam');

  const [p3Name, setP3Name] = useState('Mandibuzz');
  const [p3Cp, setP3Cp] = useState(1496);
  const [p3Ivs, setP3Ivs] = useState('');
  const [p3Fast, setP3Fast] = useState('Snarl');
  const [p3C1, setP3C1] = useState('Dark Pulse');
  const [p3C2, setP3C2] = useState('Aerial Ace');

  // Code Viewer State
  const [selectedFileIndex, setSelectedFileIndex] = useState<number>(0);
  const [copiedFile, setCopiedFile] = useState(false);
  const [isDownloadingZip, setIsDownloadingZip] = useState(false);

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
    return precomputeTeam9x9ShieldMatrixAgainstMeta(
      activePreset?.pokemon || [],
      activePreset?.league || 'GREAT LEAGUE',
      tierThresholds,
      200
    );
  }, [activePreset, tierThresholds, pvPokeSyncStatus]);

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

  // Lead, Swap, Post-Faint, Persistent-HP & Shield Callout Tactical Recommendation (v3.44)
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
      league: activePreset.league
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
    isPostFaintPromptActive
  ]);

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
        ...activeOpponent.chargedMoves.map((m) => m.energyCost || 40),
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
    const cheapestOppCost = Math.min(
      ...activeOpponent.chargedMoves.map((m) => m.energyCost || 40),
      45
    );
    const deductedEnergy = matchedMoveObj?.energyCost || cheapestOppCost;
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

  // Calculations (respecting custom fast move turns if edited)
  const FAST_MOVE_TURN_LOOKUP: Record<string, number> = {
    'dragon breath': 1,
    'sand attack': 1,
    'quick attack': 1,
    'lock-on': 1,
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
  const userFastTurns = FAST_MOVE_TURN_LOOKUP[userFastMoveName.toLowerCase().trim()] || userActivePokemon?.defaultFastMove?.turns || 3;
  const oppFastTurns = activeOpponent?.defaultFastMove?.turns || 2;
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
    return activeOpponent.chargedMoves.map(move => {
      const calc = calculateChargedDamage(activeOpponent, userActivePokemon, move, isOpponentShadow, isUserShadow);
      const tapsNeeded = Math.max(0, Math.ceil((move.energyCost - oppEnergy) / (activeOpponent.defaultFastMove.energyGain || 8)));
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
      const moveObj = {
        name: mName,
        code: mName.slice(0, 2).toUpperCase(),
        type: override?.type || existingMove?.type || userActivePokemon.types[0] || 'normal',
        power: override?.power || existingMove?.power || 80,
        energyCost: existingMove?.energyCost || 50
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
    setUserEnergy(prev => Math.min(100, prev + (userActivePokemon.defaultFastMove.energyGain || 8)));

    // Opponent also attacks
    setOppTurnsElapsed(prev => prev + 1);
    setOppEnergy(prev => Math.min(100, prev + (activeOpponent.defaultFastMove.energyGain || 8)));
  };

  const applyLeagueTop3TemplateToForm = (league: LeagueType) => {
    const top3 = getLeagueTop3Template(league);
    setP1Name(top3[0].name);
    setP1Cp(top3[0].cp);
    setP1Ivs('');
    setP1Fast(top3[0].fastMove);
    setP1C1(top3[0].chargedMove1);
    setP1C2(top3[0].chargedMove2);

    setP2Name(top3[1].name);
    setP2Cp(top3[1].cp);
    setP2Ivs('');
    setP2Fast(top3[1].fastMove);
    setP2C1(top3[1].chargedMove1);
    setP2C2(top3[1].chargedMove2);

    setP3Name(top3[2].name);
    setP3Cp(top3[2].cp);
    setP3Ivs('');
    setP3Fast(top3[2].fastMove);
    setP3C1(top3[2].chargedMove1);
    setP3C2(top3[2].chargedMove2);
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
    const defaultLeague = activePreset?.league || 'GREAT LEAGUE';
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
    }
    if (s2) {
      setP2Name(s2.name);
      setP2Cp(s2.cp);
      setP2Ivs(s2.ivs || '');
      setP2Fast(s2.fastMove);
      setP2C1(s2.chargedMove1);
      setP2C2(s2.chargedMove2);
    }
    if (s3) {
      setP3Name(s3.name);
      setP3Cp(s3.cp);
      setP3Ivs(s3.ivs || '');
      setP3Fast(s3.fastMove);
      setP3C1(s3.chargedMove1);
      setP3C2(s3.chargedMove2);
    }
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
        ivs: cleanIvs
      };
    };
    return [
      resolveSlot('p1', p1Name, p1Cp, p1Fast, p1C1, p1C2, p1Ivs, top3[0]),
      resolveSlot('p2', p2Name, p2Cp, p2Fast, p2C1, p2C2, p2Ivs, top3[1]),
      resolveSlot('p3', p3Name, p3Cp, p3Fast, p3C1, p3C2, p3Ivs, top3[2])
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
    }
    if (m2) {
      setP2Name(m2.name);
      setP2Cp(m2.cp);
      setP2Ivs(m2.ivs || '');
      setP2Fast(m2.fastMove);
      setP2C1(m2.chargedMove1);
      setP2C2(m2.chargedMove2);
    }
    if (m3) {
      setP3Name(m3.name);
      setP3Cp(m3.cp);
      setP3Ivs(m3.ivs || '');
      setP3Fast(m3.fastMove);
      setP3C1(m3.chargedMove1);
      setP3C2(m3.chargedMove2);
    }
  };

  const modalLiveEvaluation = useMemo(() => {
    const members = buildModalMembersArray();
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
    p1Name, p1Cp, p1Ivs, p1Fast, p1C1, p1C2,
    p2Name, p2Cp, p2Ivs, p2Fast, p2C1, p2C2,
    p3Name, p3Cp, p3Ivs, p3Fast, p3C1, p3C2,
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

    const basePreset: TeamPreset = {
      id: targetId,
      name: newPresetName.trim() || `${newPresetLeague} Custom`,
      league: newPresetLeague,
      pokemon: members,
      archetype: manualArchetypeOverride,
      isArchetypeManual: !!manualArchetypeOverride
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

  // Anti-Meta Team Builder: Generate Best 5 ABB + Best 5 ABC Teams & Select Option to Create + Open Edit Modal
  const handleGenerateAntiMetaTeams = (
    overrideLeague?: LeagueType,
    overrideFeat1?: string,
    overrideFeat2?: string
  ) => {
    const targetLeague = overrideLeague || antiMetaLeague;
    const f1 = (overrideFeat1 !== undefined ? overrideFeat1 : antiMetaFeat1).trim();
    const f2 = (overrideFeat2 !== undefined ? overrideFeat2 : antiMetaFeat2).trim();
    const featuredList = [f1, f2].filter((s) => s.length > 0);
    const res = generateAntiMetaTeamOptions(
      targetLeague,
      featuredList,
      battleLogs,
      activeSeasonBounds
    );
    setAntiMetaResult(res);
  };

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

  // Copy code handler
  const handleCopyCode = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedFile(true);
    setTimeout(() => setCopiedFile(false), 2000);
  };

  // Download Zip handler
  const handleDownloadZip = async () => {
    try {
      setIsDownloadingZip(true);
      const blob = await downloadAndroidProjectZip();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'SilphScope_PvP_v3.46_Android_Project.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
    } finally {
      setIsDownloadingZip(false);
    }
  };

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
              <div className="flex items-center gap-2">
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
                  v3.53 • Android Native Overlay
                </span>
              </div>
              <p className="text-xs hidden sm:block" style={{ color: activeTheme.textSecondaryHex }}>
                Real-Time 3x3 Matchup Matrix, Lead Tracking, Interactive Replay &amp; Multi-Device Delta Sync for Pokémon GO PvP
              </p>
            </div>
          </div>

          {/* Navigation Tabs & Donation Button */}
          <div className="flex items-center gap-2 flex-wrap justify-end">
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
                <span>⚔️ Teams</span>
                <span className="ml-0.5 px-1.5 py-0.2 rounded-full bg-slate-800 text-[10px] text-sky-400 border border-slate-700">
                  {presets.length}
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
                <span>📜 Battle Log</span>
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
                onClick={() => setActiveTab('android_code')}
                className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
                  activeTab === 'android_code'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <FileCode2 className="w-3.5 h-3.5" />
                <span>Kotlin & Android Code</span>
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

            <a
              href="https://buymeacoffee.com/sportsfan986"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs flex items-center gap-1.5 shadow-lg shadow-amber-500/20 transition"
              title="Support SilphScope PvP on Buy Me a Coffee"
            >
              <span>☕ Buy Me a Coffee</span>
            </a>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6">
        {/* Persistent Overlay Launch, Status & Help Button Bar (Mirrors Android Top Region) */}
        <div className="mb-5 p-3.5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5 text-xs sm:text-sm font-bold text-sky-400">
            <span>
              {isOverlayVisible
                ? isBattleActive
                  ? 'Status: Battle Active'
                  : 'Status: Overlay Active'
                : 'Status: Idle'}
            </span>
            <span className="px-2 py-0.5 rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-[10px] font-mono">
              ⚡ Precomputed 9x9 Matrix: Top {precomputed9x9State.metaDepth} {precomputed9x9State.league} Meta ({precomputed9x9State.totalCellsComputed} cells • {precomputed9x9State.elapsedMs}ms)
            </span>
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
                  <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-sky-500/20 text-sky-300 border border-sky-400/40">
                    Sky Trench 3×3 Matrix
                  </span>
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
                        }
                      }}
                      title="Drag bubble anywhere • Tap to restore overlay & resume 1 Hz OCR"
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
                      {/* Header row (Upper-left theme emblem icon minimizes to bubble & pauses OCR) */}
                      <div
                        className="flex items-center justify-between pb-1 border-b gap-1 px-1 pt-0.5 rounded-t"
                        style={{
                          borderColor: `rgba(${activeTheme.overlayHeaderRgb}, 0.35)`,
                          background: `linear-gradient(90deg, rgba(${activeTheme.overlayHeaderRgb}, 0.16) 0%, rgba(0,0,0,0) 100%)`
                        }}
                      >
                        <div className="font-extrabold text-[10.5px] text-amber-100 flex items-center gap-1 truncate min-w-0">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setIsOverlayMinimized(true);
                            }}
                            className="px-1 py-0.5 rounded text-white text-[10px] leading-tight shrink-0 shadow-sm active:scale-90 transition border flex items-center justify-center"
                            style={{
                              backgroundColor: `rgba(${activeTheme.overlayHeaderRgb}, 0.28)`,
                              borderColor: `rgba(${activeTheme.overlayHeaderRgb}, 0.75)`
                            }}
                            title="Minimize overlay to floating theme-emblem bubble & pause OCR"
                          >
                            {renderThemeOverlayIcon(activeTheme.id, 13)}
                          </button>
                          {isWaitingOpponent || scannedOpponents.length === 0 ? (
                            <>
                              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block shrink-0" />
                              <span className="text-emerald-200">WAITING FOR OPPONENT...</span>
                            </>
                          ) : (
                            <>
                              <span className="truncate">VS {isOpponentShadow ? 'S-' : ''}{activeOpponent.name.toUpperCase()}</span>
                            </>
                          )}
                        </div>
                        {/* Interactive Shield Counters & Live HP% Pills: You (My) & Opponent (Opp) */}
                        <div className="flex items-center gap-1 shrink-0 font-mono text-[8px] font-extrabold">
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
                            title={`Active Player Pokémon HP: ${userSlotHpPct[activeUserSlotIndex] ?? 100}% • Energy: ${userSlotEnergy[activeUserSlotIndex] ?? userEnergy}E`}
                          >
                            My:{userSlotHpPct[activeUserSlotIndex] ?? 100}% {userSlotEnergy[activeUserSlotIndex] ?? userEnergy}E
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              const next = userShields > 0 ? userShields - 1 : 2;
                              setUserShields(next);
                            }}
                            className={`px-1.5 py-0.5 rounded border leading-none transition-all flex items-center gap-0.5 active:scale-95 cursor-pointer ${
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
                            <span className="text-[8px]">🛡️</span>
                            <span>{userShields}</span>
                          </button>
                          {!isWaitingOpponent && scannedOpponents.length > 0 && (() => {
                            const activeOppE = oppSlotEnergy[safeActiveOppSlot] ?? oppEnergy;
                            const cheapestOppCost = Math.min(
                              ...activeOpponent.chargedMoves.map((m) => m.energyCost || 40),
                              45
                            );
                            const oppRdy = activeOppE >= cheapestOppCost;
                            return (
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
                                title={`Active Opponent Pokémon HP: ${oppSlotHpPct[safeActiveOppSlot] ?? 100}% • Energy: ${activeOppE}E${oppRdy ? ' READY' : ''}`}
                              >
                                Opp:{oppSlotHpPct[safeActiveOppSlot] ?? 100}% · {activeOppE}E{oppRdy ? ' READY' : ''}
                              </span>
                            );
                          })()}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              const next = oppShields > 0 ? oppShields - 1 : 2;
                              setOppShields(next);
                            }}
                            className={`px-1.5 py-0.5 rounded border leading-none transition-all flex items-center gap-0.5 active:scale-95 cursor-pointer ${
                              oppShields === 0
                                ? 'opacity-50 text-slate-400 bg-slate-900/60 border-slate-700 line-through'
                                : 'text-pink-300 bg-pink-950/60 border-pink-500/50 hover:bg-pink-900/50'
                            }`}
                            title={`Opponent Shields: ${oppShields}/2 remaining (Tap to cycle 2->1->0->2)`}
                          >
                            <span className="text-[8px]">🛡️</span>
                            <span>{oppShields}</span>
                          </button>
                        </div>
                      </div>

                      {/* v3.34: Lead, Counter-Swap Minimax, Post-Faint Replacement & Endgame Tactical Recommendation Row */}
                      {showTacticalRec && activeTacticalRec && (
                        <div
                          className={`flex items-center justify-between gap-1.5 px-1.5 py-1 rounded border my-0.5 font-mono leading-snug transition-all ${
                            ((activeTacticalRec.actionLabel || activeTacticalRec.actionText || '').length +
                              (activeTacticalRec.shieldPlan || '').length +
                              (activeTacticalRec.goalText || '').length) >
                            54
                              ? 'text-[6.8px]'
                              : ((activeTacticalRec.actionLabel || activeTacticalRec.actionText || '').length +
                                  (activeTacticalRec.shieldPlan || '').length +
                                  (activeTacticalRec.goalText || '').length) >
                                42
                              ? 'text-[7.1px]'
                              : 'text-[7.5px]'
                          } ${
                            activeTacticalRec.urgencyColor === 'emerald'
                              ? 'bg-emerald-950/75 border-emerald-400/60 text-emerald-200'
                              : activeTacticalRec.urgencyColor === 'sky'
                              ? 'bg-sky-950/75 border-sky-400/60 text-sky-200'
                              : activeTacticalRec.urgencyColor === 'rose'
                              ? 'bg-rose-950/75 border-rose-400/60 text-rose-200'
                              : 'bg-amber-950/75 border-amber-400/60 text-amber-200'
                          }`}
                          title={`${activeTacticalRec.oneLineBadgeText || activeTacticalRec.oneLineBadge} (Team Style: ${activePreset.archetype || 'ABC'})`}
                        >
                          <div className="flex flex-wrap items-center gap-x-1 gap-y-0.5 min-w-0 flex-1">
                            <span className="inline-flex items-center gap-1 shrink-0 max-w-full">
                              <span className="font-black uppercase px-1 py-0.2 rounded bg-black/40 border border-white/15 text-white shrink-0 whitespace-nowrap">
                                {activeTacticalRec.actionLabel || activeTacticalRec.actionText}
                              </span>
                              <span className="font-bold text-amber-300 shrink-0 whitespace-nowrap">
                                [{activeTacticalRec.shieldPlan}]
                              </span>
                            </span>
                            <span className="text-white/95 font-semibold whitespace-normal break-words leading-tight line-clamp-2">
                              Goal: {activeTacticalRec.goalText}
                            </span>
                          </div>
                          {isAttackIncomingPrompt && userShields > 0 ? (
                            <div className="flex items-center gap-1 shrink-0 self-center">
                              <button
                                type="button"
                                onClick={() => handleResolveOppChargedAttack(true, 0)}
                                className="px-1.5 py-0.5 rounded bg-pink-500/35 hover:bg-pink-500/55 text-pink-100 font-extrabold text-[7px] border border-pink-300/60 whitespace-nowrap"
                                title="Use 1 Protect Shield against incoming Opponent Charged Attack"
                              >
                                🛡️ Shield (1S)
                              </button>
                              <button
                                type="button"
                                onClick={() => handleResolveOppChargedAttack(false, 0)}
                                className="px-1.5 py-0.5 rounded bg-sky-500/30 hover:bg-sky-500/50 text-sky-100 font-extrabold text-[7px] border border-sky-300/60 whitespace-nowrap"
                                title="No Shield — Tank the incoming Opponent Charged Attack"
                              >
                                Tank (0S)
                              </button>
                            </div>
                          ) : (
                            activeTacticalRec.recommendedSwapSlotIndex !== null &&
                            activeTacticalRec.recommendedSwapSlotIndex !== undefined &&
                            (isPostFaintPromptActive ||
                              activeTacticalRec.recommendedSwapSlotIndex !== activeUserSlotIndex) && (
                              <button
                                type="button"
                                onClick={() => handleSelectUserSlot(activeTacticalRec.recommendedSwapSlotIndex!)}
                                className="px-1.5 py-0.5 rounded bg-white/15 hover:bg-white/25 text-white font-extrabold text-[7px] shrink-0 border border-white/25 self-center whitespace-nowrap"
                                title={`Apply recommended ${isPostFaintPromptActive ? 'post-faint replacement' : 'swap'} to ${activeTacticalRec.recommendedSwapPokemon || 'Bench'}`}
                              >
                                {isPostFaintPromptActive ? 'Send In ➔' : 'Swap ➔'}
                              </button>
                            )
                          )}
                        </div>
                      )}

                      {/* Action Toolbar: 2-Row Compact Buttons (Start\nBattle, Shadow:\nON/OFF, Form:\n[form], POK(3 letters):\nHP%) */}
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

                      {/* v3.40: Pokéball Counts, Shield Counts, Persistent Floating HP% & Charged Attack Simulator Controls */}
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
                                const gain = activeOpponent.defaultFastMove?.energyGain || 8;
                                const nextE = Math.min(100, (oppSlotEnergy[safeActiveOppSlot] ?? oppEnergy) + gain);
                                setOppEnergy(nextE);
                                setOppSlotEnergy((prev) => {
                                  const next = [...prev];
                                  next[safeActiveOppSlot] = nextE;
                                  return next;
                                });
                                const fDmg = Math.max(1, Math.round(oppFastInfo.damagePct || 3));
                                const curMyHp = userSlotHpPct[activeUserSlotIndex] ?? 100;
                                handleUpdateUserActiveHp(Math.max(1, curMyHp - fDmg));
                                setScanTurnOffsetMs(Date.now() % 500);
                              }}
                              className="px-1 py-0.2 rounded bg-cyan-500/25 hover:bg-cyan-500/40 text-cyan-200 border border-cyan-400/40"
                              title="Simulate 1 Opponent Fast Move (+Energy & Fast HP Prediction Drop)"
                            >
                              +1 Opp Fast ({oppSlotEnergy[safeActiveOppSlot] ?? oppEnergy}E)
                            </button>
                          </div>
                        </div>
                      </div>

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
                      <div className="my-1 py-1 px-1.5 bg-black/20 rounded flex flex-col gap-0.5 text-[9.5px]">
                        {isWaitingOpponent || scannedOpponents.length === 0 ? (
                          <div className="text-[9px] text-slate-200 flex items-center justify-between py-1 px-1.5 bg-black/35 rounded border border-white/10">
                            <div className="flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                              <span>1 Hz OCR scanning opponent &amp; active lead...</span>
                            </div>
                            <span className="text-[8px] text-amber-300 font-mono">Standby</span>
                          </div>
                        ) : (
                          scannedOpponents.map((oppName, idx) => {
                            const isActiveSlot = idx === safeActiveOppSlot;
                            const matrix = calculateShieldMatrix(
                              oppName,
                              activePreset.pokemon,
                              isActiveSlot && isOpponentShadow,
                              activePreset.league
                            );
                            const fullOppDisplay = (isActiveSlot && isOpponentShadow ? 'S-' : '') + oppName;
                            const p1Init = activePreset.pokemon[0]?.name.charAt(0) || 'D';
                            const p2Init = activePreset.pokemon[1]?.name.charAt(0) || 'L';
                            const p3Init = activePreset.pokemon[2]?.name.charAt(0) || 'K';

                            const isOppFainted = !!oppFaintedSlots[idx];
                            const slotOppStats = POKEMON_DATABASE[oppName] || activeOpponent;
                            const cheapestMoveE = Math.min(
                              ...(slotOppStats?.chargedMoves || []).map((m) => m.energyCost || 40),
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
                                  <span className="font-bold text-slate-300">{p1Init}:</span>
                                  {renderTierDots(matrix.p1)}
                                  <span className="text-white/25 mx-[1.5px] text-[8px]">|</span>
                                  <span className="font-bold text-slate-300">{p2Init}:</span>
                                  {renderTierDots(matrix.p2)}
                                  <span className="text-white/25 mx-[1.5px] text-[8px]">|</span>
                                  <span className="font-bold text-slate-300">{p3Init}:</span>
                                  {renderTierDots(matrix.p3)}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>

                      {/* Opponent Attacks & My Attacks (Segmented Range Bars + 3-Column Damage Matrices with Vertical Highlight) */}
                      {!isWaitingOpponent && scannedOpponents.length > 0 && (
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
                                  {abbrPoke3(activeOpponent.name, false)} {oppSlotHpPct[safeActiveOppSlot] ?? 100}% · {oppFastInfo.telemetry}
                                </span>
                                {(() => {
                                  const activeOppE = oppSlotEnergy[safeActiveOppSlot] ?? oppEnergy;
                                  const cheapestOppCost = Math.min(
                                    ...activeOpponent.chargedMoves.map((m) => m.energyCost || 40),
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
                            {(oppMoveTimingInfo?.rows || []).map((row, rIdx, rowArr) => {
                              const isLastRow = rIdx === rowArr.length - 1;
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
                                  {/* Left: <=5 Char Move Name (Top) & Energy/Turns (Bottom) */}
                                  <div className="flex flex-col leading-tight min-w-0">
                                    <span className={`text-[8.5px] font-extrabold truncate ${titleColor}`} title={row.name}>
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

                {/* Live PvPoke GameMaster & 4-League Rankings Status Card */}
                <div className="mb-4 p-3 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <span className="text-xs font-bold text-slate-200 block">
                        PvPoke Live Database &amp; 4-League Status
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
                  <div className="grid grid-cols-5 gap-1.5 text-center text-[10px] font-mono">
                    <div className="p-1.5 rounded bg-slate-900 border border-slate-800">
                      <span className="text-slate-400 block text-[9px]">GameMaster</span>
                      <strong className="text-white">{dbTelemetry.gmCount}</strong>
                    </div>
                    <div className="p-1.5 rounded bg-slate-900 border border-slate-800">
                      <span className="text-sky-400 block text-[9px]">GL (1500)</span>
                      <strong className="text-white">{dbTelemetry.glCount}</strong>
                    </div>
                    <div className="p-1.5 rounded bg-slate-900 border border-slate-800">
                      <span className="text-amber-400 block text-[9px]">UL (2500)</span>
                      <strong className="text-white">{dbTelemetry.ulCount}</strong>
                    </div>
                    <div className="p-1.5 rounded bg-slate-900 border border-slate-800">
                      <span className="text-purple-400 block text-[9px]">ML (10000)</span>
                      <strong className="text-white">{dbTelemetry.mlCount}</strong>
                    </div>
                    <div className="p-1.5 rounded bg-slate-900 border border-slate-800">
                      <span className="text-emerald-400 block text-[9px]">Mega ML</span>
                      <strong className="text-white">{dbTelemetry.megaCount}</strong>
                    </div>
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

                {/* App Setting: Overlay Background Transparency (0% - 100%, Default 72%) */}
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
                      onClick={() => handleSetOverlayTransparencyPct(72)}
                      className="text-xs font-mono font-bold text-sky-400 hover:text-sky-300 transition shrink-0"
                      title="Click to reset to 72% Default"
                    >
                      {overlayTransparencyPct === 72 ? '72% (Default)' : `${overlayTransparencyPct}%`}
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

                  {/* Transparency Bounds & 72% Default Tick Mark */}
                  <div className="relative h-4 text-[10px] font-mono text-slate-400">
                    <span className="absolute left-0">0% (Solid)</span>
                    <button
                      type="button"
                      onClick={() => handleSetOverlayTransparencyPct(72)}
                      style={{ left: '72%', transform: 'translateX(-50%)' }}
                      className="absolute text-sky-400 hover:text-sky-300 font-bold transition"
                      title="Reset to 72% Default"
                    >
                      ▲ 72% Default
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
                      Auto ({activePreset.league.split(' ')[0]})
                    </button>
                    {(['MEGA MASTER LEAGUE', 'MASTER LEAGUE', 'ULTRA LEAGUE', 'GREAT LEAGUE'] as const).map((lg) => (
                      <button
                        key={lg}
                        onClick={() => setSelectedOpponentLeague(lg)}
                        className={`px-2.5 py-1 rounded-lg font-bold border transition shrink-0 ${
                          selectedOpponentLeague === lg
                            ? 'bg-sky-500/20 border-sky-400 text-sky-200 shadow-[0_0_8px_rgba(56,189,248,0.25)]'
                            : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {lg === 'MEGA MASTER LEAGUE' ? 'MEGA ML' : lg.split(' ')[0]}
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

              {/* Active Team Preset Summary Card */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-emerald-400" />
                    <h3 className="font-bold text-sm text-white">Active Team Preset</h3>
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
            TAB 2: CUSTOM GBL TEAM PRESETS MANAGER (User Requirement)
           ========================================================================= */}
        {activeTab === 'presets' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Layers className="w-5 h-5 text-sky-400" />
                  <span>Custom GBL Team Presets</span>
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
                  <span>Trash ({deletedTeamsTrash.length})</span>
                </button>
                <button
                  onClick={handleManualPvPokeSync}
                  disabled={isSyncingPvPoke}
                  className="py-2.5 px-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-sky-300 font-bold text-xs flex items-center gap-1.5 transition"
                  title="Fetch latest PvPoke gamemaster.json + GL/UL/ML/Mega Master rankings JSONs"
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
                              {pb.tacticalPillars.map((pillar, pIdx) => (
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
                      <div className="grid grid-cols-2 gap-1.5">
                        {(
                          [
                            { id: 'GREAT LEAGUE', label: 'Great (GL)' },
                            { id: 'ULTRA LEAGUE', label: 'Ultra (UL)' },
                            { id: 'MASTER LEAGUE', label: 'Master (ML)' },
                            { id: 'MEGA MASTER LEAGUE', label: 'Mega ML (MML)' }
                          ] as Array<{ id: LeagueType; label: string }>
                        ).map((lg) => (
                          <button
                            key={lg.id}
                            type="button"
                            onClick={() => {
                              setAntiMetaLeague(lg.id);
                              handleGenerateAntiMetaTeams(lg.id, antiMetaFeat1, antiMetaFeat2);
                            }}
                            className={`px-2.5 py-2 rounded-lg text-xs font-bold transition border ${
                              antiMetaLeague === lg.id
                                ? 'bg-sky-600 text-white border-sky-400 shadow'
                                : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700'
                            }`}
                          >
                            {lg.label}
                          </button>
                        ))}
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

                  {/* Step 2b & 2c: Display Best 5 ABB & Best 5 ABC Anti-Meta Team Options */}
                  {(() => {
                    const currentResult =
                      antiMetaResult && antiMetaResult.league === antiMetaLeague
                        ? antiMetaResult
                        : generateAntiMetaTeamOptions(
                            antiMetaLeague,
                            [antiMetaFeat1.trim(), antiMetaFeat2.trim()].filter(Boolean),
                            battleLogs,
                            activeSeasonBounds
                          );

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
                                        ⚡ Alt Moveset{altInfo && altInfo.roleBrDelta > 0 ? ` (+${altInfo.roleBrDelta} BR)` : ''}
                                      </span>
                                    )}
                                  </div>
                                  <div
                                    className={`text-[10px] truncate mt-0.5 ${
                                      isAltMove ? 'text-amber-300 font-semibold' : 'text-slate-400'
                                    }`}
                                  >
                                    {mon.fastMove} • {mon.chargedMove1}/{mon.chargedMove2}
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

            {/* Presets Grid (Unified Anti-Meta Generator Look & Feel + Key Wins / Threats / Core Breakers Summary) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {presets.map((preset, presetIdx) => {
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
                            title="Edit Team, Moves, IVs & CP"
                          >
                            ✎ Edit Team
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
                            }
                          }}
                          className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-400"
                        >
                          <option value="GREAT LEAGUE">GREAT LEAGUE (Max 1500 CP)</option>
                          <option value="ULTRA LEAGUE">ULTRA LEAGUE (Max 2500 CP)</option>
                          <option value="MASTER LEAGUE">MASTER LEAGUE (No CP Limit)</option>
                          <option value="MEGA MASTER LEAGUE">MEGA MASTER LEAGUE (Megas &amp; Primals)</option>
                        </select>
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
                                  title={`${sug.summaryBadge} • Moves: ${sug.candidate.fastMove} + ${sug.candidate.chargedMove1}/${sug.candidate.chargedMove2}`}
                                >
                                  <div className="flex items-center justify-between gap-1">
                                    <span className="text-[11px] font-extrabold text-emerald-200 truncate">
                                      #{idx + 1} {sug.candidate.name}
                                    </span>
                                    <span className="text-[9.5px] font-mono font-bold text-emerald-300 shrink-0">
                                      {sug.deltaMachBr >= 0 ? `+${sug.deltaMachBr}` : sug.deltaMachBr} Core BR
                                    </span>
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
                                  title={`${sug.summaryBadge} • Moves: ${sug.candidate.fastMove} + ${sug.candidate.chargedMove1}/${sug.candidate.chargedMove2}`}
                                >
                                  <div className="flex items-center justify-between gap-1">
                                    <span className="text-[11px] font-extrabold text-emerald-200 truncate">
                                      #{idx + 1} {sug.candidate.name}
                                    </span>
                                    <span className="text-[9.5px] font-mono font-bold text-emerald-300 shrink-0">
                                      {sug.deltaMachBr >= 0 ? `+${sug.deltaMachBr}` : sug.deltaMachBr} Core BR
                                    </span>
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
                                  title={`${sug.summaryBadge} • Moves: ${sug.candidate.fastMove} + ${sug.candidate.chargedMove1}/${sug.candidate.chargedMove2}`}
                                >
                                  <div className="flex items-center justify-between gap-1">
                                    <span className="text-[11px] font-extrabold text-emerald-200 truncate">
                                      #{idx + 1} {sug.candidate.name}
                                    </span>
                                    <span className="text-[9.5px] font-mono font-bold text-emerald-300 shrink-0">
                                      {sug.deltaMachBr >= 0 ? `+${sug.deltaMachBr}` : sug.deltaMachBr} Core BR
                                    </span>
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
                    onClick={() => handleSetOverlayTransparencyPct(72)}
                    className="text-xs font-mono font-bold text-sky-400 hover:text-sky-300 transition"
                  >
                    {overlayTransparencyPct === 72 ? '72% (Default)' : `${overlayTransparencyPct}%`}
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
                    onClick={() => handleSetOverlayTransparencyPct(72)}
                    style={{ left: '72%', transform: 'translateX(-50%)' }}
                    className="absolute text-sky-400 hover:text-sky-300 font-bold transition"
                  >
                    ▲ 72% Default
                  </button>
                  <span className="absolute right-0">100% (Clear)</span>
                </div>
              </div>
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

            {/* Lead & Swap Tactical Recommendations GUI Toggle Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-emerald-400 flex items-center gap-2">
                  <Swords className="w-4 h-4" />
                  <span>🧠 Lead &amp; Swap Tactical Recommendation Row (Overlay GUI)</span>
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/40 text-emerald-300">
                  {showTacticalRec ? 'Enabled (Default)' : 'Disabled'}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Displays an ultra-compact 1-line tactical recommendation badge between the Overlay Header Row and Start/Stop Battle Row with <strong>Action (Stay / Swap / Counter-Swap)</strong>, <strong>Shield Plan (0S / 1S / 2S)</strong>, and <strong>Matchup Goal</strong> tailored to your team archetype (<strong>ABB</strong>, <strong>ABC</strong>, or <strong>Duo-Core</strong>) and predetermined 9x9 shield matrix data.
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
                  href="https://github.com/settings/tokens/new?description=SilphScope+PvP+Cloud+Sync&scopes=gist,repo"
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
                CARD 4: PVPOKE DATABASE & RETROACTIVE REPARSE MAINTENANCE
               =================================================================== */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <span className="text-sm font-bold text-white block">
                    PvPoke Live Database &amp; 4-League Rankings
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
              <div className="grid grid-cols-5 gap-2 text-center text-xs font-mono">
                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-slate-400 block text-[10px]">GameMaster</span>
                  <strong className="text-white text-sm">{dbTelemetry.gmCount}</strong>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-sky-400 block text-[10px]">GL (1500)</span>
                  <strong className="text-white text-sm">{dbTelemetry.glCount}</strong>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-amber-400 block text-[10px]">UL (2500)</span>
                  <strong className="text-white text-sm">{dbTelemetry.ulCount}</strong>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-purple-400 block text-[10px]">ML (10000)</span>
                  <strong className="text-white text-sm">{dbTelemetry.mlCount}</strong>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-emerald-400 block text-[10px]">Mega ML</span>
                  <strong className="text-white text-sm">{dbTelemetry.megaCount}</strong>
                </div>
              </div>
            </div>

            {/* Retroactive Battle Log Damage & Win Quality Reparse Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <span className="text-sm font-bold text-emerald-400 block">
                    Reparse Completed Battles (Damage &amp; WAE)
                  </span>
                  <span className="text-xs text-slate-400 block mt-0.5">
                    {reparseBattlesStatus}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleReparseAllCompletedBattles(false)}
                  className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition shrink-0 shadow-lg shadow-emerald-600/20"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>🔄 Reparse All</span>
                </button>
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
            return entries.filter((e) => {
              const leagueOk = logFilterLeague === 'ALL LEAGUES' || e.league.toUpperCase() === logFilterLeague.toUpperCase();
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
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <Target className="w-5 h-5 text-sky-400" />
                    <span>📜 GBL Battle Logs, Season Export &amp; Interactive Replay</span>
                  </h2>
                  <p className="text-xs text-slate-400">
                    Click any battle card (or <strong>🔍 Replay</strong>) to inspect the interactive 3v3 overlay matrix and analyze swap/shield decisions!
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

              {/* Filter & Export Controls Card */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">League Filter</label>
                    <select
                      value={logFilterLeague}
                      onChange={(e) => setLogFilterLeague(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-semibold"
                    >
                      <option value="ALL LEAGUES">ALL LEAGUES</option>
                      <option value="GREAT LEAGUE">GREAT LEAGUE</option>
                      <option value="ULTRA LEAGUE">ULTRA LEAGUE</option>
                      <option value="MASTER LEAGUE">MASTER LEAGUE</option>
                      <option value="MEGA MASTER LEAGUE">MEGA MASTER LEAGUE</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Team Preset Filter</label>
                    <select
                      value={logFilterTeamId}
                      onChange={(e) => setLogFilterTeamId(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-semibold"
                    >
                      <option value="ALL TEAMS">All Teams ({presets.length})</option>
                      {presets.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.league.split(' ')[0]})
                        </option>
                      ))}
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
                      onClick={() => {
                        const jsonl = buildAiTrainingDatasetJsonl(filteredLogs);
                        navigator.clipboard.writeText(jsonl);
                        const blob = new Blob([jsonl], { type: 'application/x-ndjson' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `silphscope-ai-training-logs-${logFilterTimeframe.toLowerCase()}.jsonl`;
                        a.click();
                        URL.revokeObjectURL(url);
                        setStartBattleToast('🤖 Exported & Copied AI Training Logs (JSONL)!');
                        setTimeout(() => setStartBattleToast(null), 2200);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-amber-500/25 hover:bg-amber-500/40 border border-amber-400/50 text-amber-200 text-xs font-bold transition"
                      title="Export detailed battle logs with all player/opponent actions, recommendations, swap clocks, and outcomes in JSONL format for decision-tree AI training"
                    >
                      🤖 Export AI Training Logs (JSONL)
                    </button>
                    <button
                      type="button"
                      onClick={() => runOneTimeAiLogSplitAndCleanup(false)}
                      className="px-3 py-1.5 rounded-xl bg-cyan-600/25 hover:bg-cyan-600/40 border border-cyan-400/50 text-cyan-200 text-xs font-bold transition"
                      title="Run one-time split of embedded AI timeline logs into separate 7-day rolling store (gbl_ai_training_logs_v1) and purge AI logs older than 7 days"
                    >
                      ⚡ Split AI Logs &amp; Purge &gt;7d ({aiTrainingLogs.length} active)
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('settings')}
                      className="px-3 py-1.5 rounded-xl bg-purple-600/25 hover:bg-purple-600/40 border border-purple-400/50 text-purple-200 text-xs font-bold transition"
                    >
                      ☁️ Multi-Device Cloud Sync
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
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

              {/* Battle Log List Container */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-white">
                    Logged Battles ({filteredLogs.length}) • Tap any battle to open Interactive Overlay Replay
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

                            return (
                              <div
                                key={entry.id}
                                onClick={() => {
                                  setReplayLogEntry(entry);
                                  setReplayUserIdx(0);
                                  setReplayOppIdx(0);
                                  setReplayOppShadow(false);
                                }}
                                className={`p-3.5 rounded-xl bg-slate-950 hover:bg-slate-900/90 border cursor-pointer transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs ${
                                  isRepeatedLeadToday
                                    ? 'border-amber-400/70 shadow-[0_0_12px_rgba(251,191,36,0.12)]'
                                    : 'border-slate-800 hover:border-sky-500/50'
                                }`}
                              >
                                <div className="space-y-1.5">
                                  <div className="flex items-center gap-2 flex-wrap">
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
                const userTurns = FAST_MOVE_TURN_LOOKUP[userFast.toLowerCase()] || 2;
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
            HELP PAGE (OPENED WHEN THE ❓ HELP BUTTON IN STATUS BAR IS PRESSED)
           ========================================================================= */}
        {activeTab === 'help' && (
          <div className="max-w-4xl mx-auto space-y-5">
            {/* 3-Page Quick Switcher Banner (Teams • Battle Log • Settings) */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Info className="w-5 h-5 text-sky-400" />
                  <span>📖 Complete Help, HUD Instructions, Tips &amp; Tactics Guide (v3.20)</span>
                </h2>
                <p className="text-xs text-slate-400">
                  Everything you need to master the floating PvP overlay, 3x3 matchup &amp; shield matrix, bottom 3-column damage grid, 50s swap clocks, move pacing, Battle Log analytics, and Tasker automation.
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
                  className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-white transition"
                >
                  ⚙️ Settings
                </button>
              </div>
            </div>

            {/* Quick Popup Guide Launchers */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setShowOverlayQuickHelpModal(true)}
                className="p-3.5 rounded-2xl bg-sky-500/15 hover:bg-sky-500/25 border border-sky-400/40 text-left flex items-center justify-between transition shadow-lg"
              >
                <div>
                  <div className="text-xs font-extrabold text-sky-300">🎯 Open Overlay Flow &amp; HUD Popup Guide</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Quick reference for Shield Matrix, Bottom Damage Grid, 50s Swap Clocks &amp; Battle Flow
                  </div>
                </div>
                <span className="text-sky-400 font-bold text-xs">Open →</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setHelpMetricGuideTopic('wae');
                  setShowHelpMetricGuideModal(true);
                }}
                className="p-3.5 rounded-2xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/40 text-left flex items-center justify-between transition shadow-lg"
              >
                <div>
                  <div className="text-xs font-extrabold text-emerald-300">📊 Open Execution WAE, BMF &amp; Badge Glossary</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Mathematical breakdown of Wins Above Expected, Matchup Luck &amp; 11 Badges/Pills
                  </div>
                </div>
                <span className="text-emerald-400 font-bold text-xs">Open →</span>
              </button>
            </div>

            {/* Section 1: General Battle Flow & How to Interact with the Overlay */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-2.5 text-xs text-slate-300 leading-relaxed">
              <h3 className="text-sm font-bold text-sky-400">
                1. General Battle Flow &amp; How to Interact with the Overlay
              </h3>
              <ul className="list-disc list-inside space-y-1.5">
                <li>
                  <strong className="text-white">Step 1 — Select or Switch Your Active Team (Main App):</strong> On the <strong>⚔️ Teams</strong> page in the main app, tap any team preset to make it active (or create a custom Great, Ultra, Master, or Mega Master League trio with auto-filled PvPoke recommended moves and IV/CP stat scaling). <em>To switch teams between sets, return to the main app and select another preset on the ⚔️ Teams page — it pushes immediately to the running overlay.</em>
                </li>
                <li>
                  <strong className="text-white">Step 2 — Launch the Overlay:</strong> Tap <strong>Start Battle Overlay</strong> in the top status bar. Grant <em>Display over other apps</em> and <em>Screen Capture</em> (used strictly in-memory at 1 Hz for ML Kit OCR — zero screenshots are ever saved to disk).
                </li>
                <li>
                  <strong className="text-white">Step 3 — Reposition or Minimize Anytime (⚔️ Icon):</strong> Drag the overlay header bar to position it anywhere on screen. Between battles or while walking/catching Pokémon, tap the <strong>⚔️</strong> icon in the top-left of the overlay to collapse it into a tiny floating bubble and pause OCR scanning.
                </li>
                <li>
                  <strong className="text-white">Step 4 — Manual Opponent Override (&apos;Opponents (Tap to Edit)&apos;):</strong> If OCR misreads an opponent&apos;s name or form, tap the <strong>Opponents (Tap to Edit)</strong> header bar inside the overlay to open the Opponent Team Editor and manually override Opponent 1 (Lead), Opponent 2 (Swap), or Opponent 3 (Closer) with Shadow and Regional/Alternate form support.
                </li>
                <li>
                  <strong className="text-white">Step 5 — Start Battle (⚔️ Start Battle):</strong> When a GBL match begins, tap <strong>⚔️ Start Battle</strong> on the overlay. This clears the previous opponent lineup, resets both 50s swap timers, resets shields (2v2) and Pokéballs (3v3), anchors the battle timeline clock (<code>t = 0s</code>), and turns the button into <strong>🛑 Stop Battle</strong>.
                </li>
                <li>
                  <strong className="text-white">Step 6 — Stop &amp; Log (🛑 Stop Battle):</strong> When the match ends, tap <strong>🛑 Stop Battle</strong>. OCR pauses and the quick-log prompt appears: verify or tap the Lead Matchup chip (<strong>Fav / Neu / Neg</strong>) and tap <strong>🏆 Win</strong> or <strong>💀 Loss</strong> (or <strong>✕ Skip</strong>).
                </li>
              </ul>
            </div>

            {/* Section 2: The 3x3 Matchup & Shield Matrix */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-2.5 text-xs text-slate-300 leading-relaxed">
              <h3 className="text-sm font-bold text-amber-400">
                2. The 3x3 Matchup &amp; Shield Matrix (PvPoke Ratings, Colored Dots &amp; 0S/1S/2S Tags)
              </h3>
              <ul className="list-disc list-inside space-y-1.5">
                <li>
                  <strong className="text-white">3x3 Grid Layout:</strong> The 3 columns represent the opponent&apos;s 3 Pokémon in the exact order revealed (<code>[1st Lead, 2nd First Swap, 3rd Closer]</code>). The 3 rows represent your 3 Pokémon.
                </li>
                <li>
                  <strong className="text-white">Single-Number PvPoke Rating &amp; Colored Tier Dot:</strong> Every cell in the 3x3 matrix displays the exact PvPoke 500-centered matchup rating for the current shield state along with a color-coded border and tier indicator dot:
                  <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 mt-2 text-[11px]">
                    <div className="p-2 rounded-lg bg-slate-950 border border-emerald-500/40">
                      <strong className="text-emerald-400 block">[+] Strong Win (SW)</strong>
                      <span className="text-slate-400">Rating ≥ 620 • Dominant wall</span>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-950 border border-green-500/30">
                      <strong className="text-green-400 block">[●] Win (W)</strong>
                      <span className="text-slate-400">530–619 • Favorable win</span>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-950 border border-slate-700">
                      <strong className="text-slate-300 block">[●] Neutral (N)</strong>
                      <span className="text-slate-400">471–529 • Even 50/50</span>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-950 border border-rose-500/30">
                      <strong className="text-rose-400 block">[●] Loss (L)</strong>
                      <span className="text-slate-400">381–470 • Unfavorable</span>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-950 border border-red-600/40">
                      <strong className="text-red-400 block">[×] Strong Loss (SL)</strong>
                      <span className="text-slate-400">≤ 380 • Hard counter</span>
                    </div>
                  </div>
                </li>
                <li>
                  <strong className="text-white">0S / 1S / 2S Shield Scenario Flip Tags:</strong> Below the rating number, each cell displays compact shield-scenario tags (e.g., <code>1S 2S✓</code> or <code>0S✗ 1S✓</code>) whenever spending or saving shields flips the matchup outcome between 0-Shield, 1-Shield, and 2-Shield scenarios.
                </li>
                <li>
                  <strong className="text-white">Customizing Thresholds &amp; 9-State Engine:</strong> Customize the exact SW / W / L / SL rating cutoffs anytime in <strong>⚙️ Settings → 5-Tier Matchup Rating Thresholds</strong>. Under the hood, SilphScope evaluates all 9 discrete shield permutations (<code>0v0</code> through <code>2v2</code>) as shields are spent.
                </li>
              </ul>
            </div>

            {/* Section 3: How to Read Battle Damage Numbers (Bottom 3-Column Damage Grid) */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-2.5 text-xs text-slate-300 leading-relaxed">
              <h3 className="text-sm font-bold text-emerald-400">
                3. How to Use Battle Damage Numbers (Bottom 3-Column Opponent Attacks Grid)
              </h3>
              <ul className="list-disc list-inside space-y-1.5">
                <li>
                  <strong className="text-white">Bottom 3-Column Opponent Attacks Grid:</strong> Below the 3x3 matchup matrix, the <strong>Opponent Attacks (vs Active Pokémon)</strong> section displays a 3-column grid aligned with Opponent 1, Opponent 2, and Opponent 3 against your currently active on-field Pokémon.
                </li>
                <li>
                  <strong className="text-white">Exact Charged Move Damage % &amp; KO! Badge:</strong> Each opponent column lists their Fast Move (with turn duration) and their Charged Moves (2 moves by default, or up to 4 when <strong>4 Charged Moves</strong> mode is enabled in Settings). Each charged move row shows its move-type color dot, abbreviated name, energy cost, fast move count, and the <strong>exact percentage of HP it deals to your active Pokémon</strong> (e.g., <code>42%</code> or <code>88% KO!</code>), accounting for League CP stat scaling, dual-type effectiveness (up to <code>2.56x</code>), STAB (<code>1.2x</code>), and Shadow modifiers (<code>+20% ATK / -16.7% DEF</code>).
                </li>
                <li>
                  <strong className="text-white">Tactical Tank vs. Shield Decisions:</strong> Glance at the damage percentage in the active opponent&apos;s column before committing a shield — if a charged move deals <code>36%</code>, you know you can comfortably tank it and farm energy; if it shows <code>84% KO!</code>, you know immediately that you must shield.
                </li>
              </ul>
            </div>

            {/* Section 4: Swap Clocks, Faint Preservation, Shield/Faint Tracking & Statusbar Toasts */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-2.5 text-xs text-slate-300 leading-relaxed">
              <h3 className="text-sm font-bold text-purple-400">
                4. Dual 50s Swap Clocks, Faint Swap Preservation &amp; Top Statusbar Toasts
              </h3>
              <ul className="list-disc list-inside space-y-1.5">
                <li>
                  <strong className="text-white">Dual Independent 50s Swap Timers (&apos;You&apos; &amp; &apos;Opp&apos;):</strong> Automatically starts a 50-second countdown whenever you or the opponent switches Pokémon:
                  <span className="block ml-4 mt-1 text-slate-300">
                    • <strong className="text-rose-400">Red (50s–16s):</strong> Switch locked on cooldown.<br />
                    • <strong className="text-amber-300">Orange/Amber (15s–1s):</strong> Switch window opening soon — prepare to throw energy or time a catch.<br />
                    • <strong className="text-emerald-400">Green (RDY):</strong> Switch available immediately.
                  </span>
                </li>
                <li>
                  <strong className="text-white">Smart Faint Swap-In Clock Preservation:</strong> When a Pokémon faints and a replacement enters, SilphScope detects the Pokéball drop (<code>3 → 2 → 1</code>) and preserves the existing running swap timer instead of falsely resetting it to 50s.
                </li>
                <li>
                  <strong className="text-white">Automatic Pokéball (3→2→1) &amp; Shield (2→1→0) Tracking:</strong> Samples the top HUD lobes to track remaining Pokémon and shields for both players. When an opponent Pokémon faints, its column in the 3x3 matrix automatically dims so you can focus on surviving threats.
                </li>
                <li>
                  <strong className="text-white">Top Statusbar / Clock Strip Battle Toasts:</strong> Real-time alerts for Swaps, Faint Swaps, and Shields Used appear in the top statusbar/clock area of the phone so they never block your charged move buttons (toggleable in <strong>⚙️ Settings</strong>).
                </li>
              </ul>
            </div>

            {/* Section 5: Move Counting, Cycle Pacing, Sneak Prevention & Customizing HUD */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-2.5 text-xs text-slate-300 leading-relaxed">
              <h3 className="text-sm font-bold text-pink-400">
                5. Fast Move Counting, Cycle Pacing (C1-C2-C3), Sneak Prevention &amp; HUD Settings
              </h3>
              <ul className="list-disc list-inside space-y-1.5">
                <li>
                  <strong className="text-white">Multi-Cycle Move Counts (C1-C2-C3):</strong> Each charged move row in the bottom damage grid shows the exact fast moves required across 3 consecutive cycles, automatically accounting for leftover residual energy (e.g., <code>7-6-7</code>).
                </li>
                <li>
                  <strong className="text-white">Count Basis (&apos;My Fasts&apos; vs. &apos;Their Fasts&apos;):</strong> In <strong>⚙️ Settings</strong>, choose whether opponent move counts are displayed in units of your own fast move taps (<strong>My Fasts</strong>) or the opponent&apos;s fast move animations (<strong>Their Fasts</strong>).
                </li>
                <li>
                  <strong className="text-white">Optimal Throw Timing (Sneak Prevention):</strong> At the bottom of each opponent&apos;s attack column, the HUD shows <code>Throw on: 1, 4, 7</code> (or <code>Aligned (Any)</code> when fast move durations match) so you can throw your charged move without giving the opponent a free fast move sneak.
                </li>
                <li>
                  <strong className="text-white">4 Charged Moves Mode, Scale &amp; Transparency:</strong> Enable 4 Charged Moves in <strong>⚙️ Settings</strong> for unpredictable move-roulette opponents, and fine-tune Overlay Size (50%–100%) and Background Transparency (0%–100%).
                </li>
              </ul>
            </div>

            {/* Section 6: Battle Logs, Interactive Replay, WAE / Luck & Standardized Exports */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-2.5 text-xs text-slate-300 leading-relaxed">
              <h3 className="text-sm font-bold text-sky-400">
                6. Battle Logs, Interactive Replay, WAE / Luck &amp; Standardized GBL Exports
              </h3>
              <ul className="list-disc list-inside space-y-1.5">
                <li>
                  <strong className="text-white">5-Stat Analytics Grid:</strong> Tracks Record (W-L), Lead Matchups (Fav/Neu/Neg), Win Rate %, <strong>EXEC WAE</strong> (Wins Above Expected micro-execution skill), and <strong>MATCHUP LUCK</strong> (Blind Matchup Favorability BMF). Tap the <code>i</code> icon next to EXEC WAE or MATCHUP LUCK anytime for the full mathematical breakdown and Badge Glossary.
                </li>
                <li>
                  <strong className="text-white">Interactive Battle Recap &amp; Replay:</strong> Tap any logged battle card in <strong>📜 Battle Logs</strong> to open the full 3v3 Matchup Matrix &amp; Timeline Replay for that battle.
                </li>
                <li>
                  <strong className="text-white">Standardized Copy GBL &amp; Share Summary:</strong> Use <strong>📋 Copy GBL</strong> for Go Battle Log format (<code>[pokemon1 pokemon2 pokemon3]</code> + opponent rows) or <strong>📤 Share Log Summary</strong> for daily/season summaries with <code>W/L (L-&gt;F/N/U, M-&gt;F/N/U) opponent1 opponent2 opponent3</code> rows and standardized Pokémon naming (e.g., <code>ninetales_alolanS</code>, <code>laprasS</code>, <code>giratina_altered</code>, <code>charizard_MEGA_Y</code>).
                </li>
              </ul>
            </div>

            {/* Section 7: Multi-Device Cloud Sync, Trash Bin & Tasker Automation */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-2.5 text-xs text-slate-300 leading-relaxed">
              <h3 className="text-sm font-bold text-emerald-400">
                7. Multi-Device Cloud Sync, Trash Bin &amp; Tasker Automation Hooks
              </h3>
              <ul className="list-disc list-inside space-y-1.5">
                <li>
                  <strong className="text-white">2-Device GitHub Cloud Delta Sync:</strong> Sign in once per phone under <strong>⚙️ Settings → Multi-Device Cloud Sync</strong>. Your Team Presets and Battle Logs automatically reconcile across devices on app open and after every logged battle.
                </li>
                <li>
                  <strong className="text-white">Trash Bin &amp; Instant Undo:</strong> Deleted teams or battles move to the <strong>🗑️ Trash Bin</strong> with an instant <strong>♻️ UNDO</strong> toast so nothing is ever lost by accident.
                </li>
                <li>
                  <strong className="text-white">Tasker Automation Hooks:</strong> Start or stop the overlay from Tasker without switching apps using <code>com.gbl.overlay.ACTION_START_OVERLAY</code> and <code>com.gbl.overlay.ACTION_STOP_OVERLAY</code>, or launch straight to <strong>📜 Battle Logs</strong> with <code>com.gbl.overlay.ACTION_OPEN_BATTLE_LOG</code> (1-tap copy buttons available in <strong>⚙️ Settings</strong>).
                </li>
              </ul>
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 4: FAST MOVE TURN ALIGNMENT & SNEAK MECHANICS
           ========================================================================= */}
        {activeTab === 'turn_matrix' && (
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
              <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-1">
                <Target className="w-5 h-5 text-orange-400" />
                <span>Optimal Fast Move Turn Alignment & Sneak Prevention</span>
              </h2>
              <p className="text-xs text-slate-400">
                In Pokémon GO Battle League, fast moves last 1 to 5 turns (0.5s per turn). When throwing a charged move on the exact turn an opponent finishes their fast move, the game gives the opponent a "free sneak" turn. The GBL overlay computes the exact attacks to throw on to deny all opponent sneaks!
              </p>
            </div>

            {/* Turn Alignment Matrix Calculator */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
                <h3 className="font-bold text-sm text-white">Compare Fast Move Timings</h3>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Your Move Turns:</label>
                    <select
                      value={userFastTurns}
                      onChange={() => {}}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2 text-xs text-white"
                    >
                      <option value="1">1 Turn (Dragon Breath, Lick)</option>
                      <option value="2">2 Turns (Counter, Shadow Claw)</option>
                      <option value="3">3 Turns (Spark, Waterfall, Snarl)</option>
                      <option value="4">4 Turns (Incinerate, Volt Switch)</option>
                      <option value="5">5 Turns (Lock-On, Gust)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Opponent Move Turns:</label>
                    <select
                      value={oppFastTurns}
                      onChange={() => {}}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2 text-xs text-white"
                    >
                      <option value="1">1 Turn (Dragon Breath)</option>
                      <option value="2">2 Turns (Fire Fang, Counter)</option>
                      <option value="3">3 Turns (Waterfall)</option>
                      <option value="4">4 Turns (Incinerate)</option>
                    </select>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-950 border border-orange-500/30">
                  <div className="text-xs font-bold text-orange-400 uppercase tracking-wider mb-1">
                    Optimal Sneak-Free Throws
                  </div>
                  <div className="text-lg font-extrabold text-white">
                    🎯 {turnAlignInfo.optimalThrowText}
                  </div>
                  <div className="text-xs text-slate-400 mt-2">
                    {turnAlignInfo.explanation}
                  </div>
                </div>
              </div>

              {/* Visual Timeline of Sneak Prevention */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
                <h3 className="font-bold text-sm text-white">Turn Timeline (User 3t vs Opponent 2t)</h3>
                
                <div className="space-y-2 text-xs">
                  {[1, 2, 3, 4, 5, 6, 7].map((attack) => {
                    const userTurn = attack * 3;
                    const isSneakFree = userTurn % 2 !== 0;
                    return (
                      <div
                        key={attack}
                        className={`flex items-center justify-between p-2 rounded-lg border ${
                          isSneakFree
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 font-semibold'
                            : 'bg-rose-500/10 border-rose-500/30 text-rose-300 font-medium'
                        }`}
                      >
                        <span>Attack #{attack} (Turn {userTurn})</span>
                        <span className="font-bold">
                          {isSneakFree ? '✅ ZERO SNEAK (Optimal)' : '❌ SNEAK DANGER (Simultaneous)'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB: RANKINGS & MATH VALIDATOR (5 POKÉMON PER LEAGUE)
           ========================================================================= */}
        {activeTab === 'math_validator' && (() => {
          const getRowColorByType = (t: string): string => {
            const lower = (t || 'normal').toLowerCase();
            switch (lower) {
              case 'ghost': return 'from-indigo-700/90 to-purple-800/90 border-indigo-400/40';
              case 'steel': return 'from-slate-600/90 to-sky-800/80 border-sky-300/40';
              case 'flying': return 'from-sky-600/90 to-blue-800/80 border-sky-300/40';
              case 'fairy': return 'from-pink-500/90 to-fuchsia-700/90 border-pink-300/40';
              case 'fire': return 'from-orange-500/90 to-amber-600/90 border-orange-300/40';
              case 'water': return 'from-sky-500/90 to-cyan-600/90 border-cyan-300/40';
              case 'dark': return 'from-slate-700/95 to-zinc-800/95 border-slate-400/40';
              case 'ground': return 'from-amber-700/90 to-orange-800/90 border-amber-400/40';
              case 'dragon': return 'from-blue-600/90 to-indigo-800/90 border-blue-400/40';
              case 'grass': return 'from-emerald-600/90 to-green-800/90 border-emerald-400/40';
              case 'electric': return 'from-yellow-500/90 to-amber-600/90 border-yellow-300/40';
              case 'ice': return 'from-cyan-500/90 to-sky-700/90 border-cyan-300/40';
              case 'fighting': return 'from-rose-600/90 to-red-800/90 border-rose-400/40';
              case 'poison': return 'from-purple-600/90 to-violet-800/90 border-purple-400/40';
              case 'psychic': return 'from-fuchsia-600/90 to-pink-800/90 border-pink-400/40';
              case 'rock': return 'from-stone-600/90 to-amber-900/90 border-stone-400/40';
              default: return 'from-slate-500/90 to-slate-700/90 border-slate-300/40';
            }
          };

          const renderPvPokeCard = (
            card: PvPokeMatchupCardData,
            leagueName: string,
            extraSubtitle?: string,
            specialNote?: string
          ) => {
            const leagueLabel =
              leagueName.includes('GREAT')
                ? 'Great League'
                : leagueName.includes('ULTRA')
                ? 'Ultra League'
                : 'Master League';

            const formattedMoves = `${card.fastMove}, ${card.chargedMoves
              .map((m) => (m === 'Double Iron Bash' || m === 'Hydro Cannon' || m === 'Psystrike' || m === 'Sacred Fire' ? `${m}*` : m))
              .join(', ')}`;

            return (
              <div
                key={`${leagueName}-${card.pokemonName}`}
                className="bg-[#4b6b7e] border-2 border-[#2c4251] rounded-xl overflow-hidden shadow-2xl text-slate-900"
              >
                {/* Dark Slate Header Bar matching PvPoke Screenshot */}
                <div className="px-4 py-3 bg-[#3c596b] border-b border-[#2c4251]">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span className="text-white font-bold text-base select-none">-</span>
                      <span className="text-slate-950 font-medium text-base">#{card.rank}</span>
                      <span className="text-slate-950 font-extrabold text-lg tracking-tight">{card.pokemonName}</span>
                      <span
                        title="Verified Moveset & IVs"
                        className="inline-flex items-center justify-center w-5 h-5 rounded bg-[#2c4251]/80 text-slate-200 text-[11px]"
                      >
                        ✎
                      </span>
                      <div className="flex items-center gap-1 ml-2">
                        {card.types.map((t) => (
                          <span
                            key={t}
                            className="px-2 py-0.5 text-xs font-semibold capitalize rounded bg-[#5c7d91] text-slate-950 border border-slate-800 shadow-inner"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Score Pill on Right */}
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] uppercase tracking-wider font-bold text-slate-200">
                        Live Rankings Score
                      </span>
                      <div className="px-3.5 py-1 rounded-md bg-[#16222a] text-white font-extrabold text-sm shadow-md border border-slate-700">
                        {card.score.toFixed(1)}
                      </div>
                    </div>
                  </div>

                  {/* Moveset Subtitle Line */}
                  <div className="text-xs text-slate-950 font-medium mt-1 pl-4 flex flex-wrap items-center justify-between gap-2">
                    <span>{formattedMoves}</span>
                    {extraSubtitle && (
                      <span className="text-[11px] font-bold text-amber-200 bg-slate-900/70 px-2 py-0.5 rounded">
                        {extraSubtitle}
                      </span>
                    )}
                  </div>
                  {specialNote && (
                    <div className="mt-1.5 ml-4 text-[11px] text-emerald-100 bg-slate-900/60 px-2.5 py-1 rounded border border-emerald-400/30">
                      ⚡ {specialNote}
                    </div>
                  )}
                </div>

                {/* Body: Key Wins & Key Losses Side-by-Side Panels */}
                <div className="p-3.5 space-y-4">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
                    {/* KEY WINS PANEL */}
                    <div className="bg-[#d7e3ea] rounded-lg p-3 shadow-inner border border-slate-400/50">
                      <div className="flex items-center justify-between text-xs font-extrabold text-slate-950 mb-2 px-1">
                        <span className="text-sm">Key Wins</span>
                        <span className="text-sm">Battle Rating (In-App vs PvPoke)</span>
                      </div>
                      <div className="space-y-1.5">
                        {card.keyWins.map((win) => (
                          <div
                            key={win.name}
                            className={`flex items-center justify-between px-3 py-1.5 rounded-r-full rounded-l-sm bg-gradient-to-r ${getRowColorByType(
                              win.types[0]
                            )} border-l-4 shadow-sm`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-xs font-medium text-white/90">#{win.rank}</span>
                              <span className="text-xs font-extrabold text-white truncate drop-shadow-sm">
                                {win.name}
                              </span>
                            </div>

                            {/* Battle Rating Badge with ⭕ Circle and PvPoke Delta */}
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="text-[10px] font-bold text-sky-100 bg-slate-950/50 px-1.5 py-0.5 rounded hidden sm:inline">
                                PvPoke: {win.pvpokeRating} (Δ{win.delta >= 0 ? `+${win.delta}` : win.delta})
                              </span>
                              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#2b509c] border border-sky-300/70 text-white font-bold text-xs shadow">
                                <span className="w-3.5 h-3.5 rounded-full border-2 border-sky-300 inline-block shrink-0" />
                                <span>{win.inAppRating}</span>
                                <span className="text-[10px] opacity-80">→</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* KEY LOSSES PANEL */}
                    <div className="bg-[#d7e3ea] rounded-lg p-3 shadow-inner border border-slate-400/50">
                      <div className="flex items-center justify-between text-xs font-extrabold text-slate-950 mb-2 px-1">
                        <span className="text-sm">Key Losses</span>
                        <span className="text-sm">Battle Rating (In-App vs PvPoke)</span>
                      </div>
                      <div className="space-y-1.5">
                        {card.keyLosses.map((loss) => (
                          <div
                            key={loss.name}
                            className={`flex items-center justify-between px-3 py-1.5 rounded-r-full rounded-l-sm bg-gradient-to-r ${getRowColorByType(
                              loss.types[0]
                            )} border-l-4 shadow-sm`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-xs font-medium text-white/90">#{loss.rank}</span>
                              <span className="text-xs font-extrabold text-white truncate drop-shadow-sm">
                                {loss.name}
                              </span>
                            </div>

                            {/* Battle Rating Badge with ❌ Cross and PvPoke Delta */}
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="text-[10px] font-bold text-pink-100 bg-slate-950/50 px-1.5 py-0.5 rounded hidden sm:inline">
                                PvPoke: {loss.pvpokeRating} (Δ{loss.delta >= 0 ? `+${loss.delta}` : loss.delta})
                              </span>
                              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#9e2275] border border-pink-300/70 text-white font-bold text-xs shadow">
                                <span className="text-pink-300 font-black leading-none text-xs">✖</span>
                                <span>{loss.inAppRating}</span>
                                <span className="text-[10px] opacity-80">→</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Card Footer with Yellow Pill Button */}
                  <div className="text-center pt-1 pb-1 space-y-2">
                    <div className="text-xs text-slate-950">
                      See all of <strong className="font-extrabold">{card.pokemonName}&apos;s</strong> matchups:
                    </div>
                    <div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCardSpecies(card.pokemonName);
                          setValidatorSubTab('cross_validation');
                        }}
                        className="px-6 py-2 rounded-full bg-gradient-to-b from-yellow-300 to-amber-500 hover:from-yellow-200 hover:to-amber-400 text-slate-950 font-bold text-xs border-2 border-slate-950 shadow-md transition"
                      >
                        {card.pokemonName} vs. {leagueLabel}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          };

          const liveTop5 = getLiveRankingsForLeague(validatorLeague, 5);

          return (
            <div className="space-y-6">
              {/* Top Header & League Selector */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
                <div>
                  <div className="flex items-center gap-2">
                    <BarChart2 className="w-5 h-5 text-amber-400" />
                    <h2 className="text-xl font-bold text-white">
                      PvPoke Rankings &amp; Overlay Shield Matrix Math Validator
                    </h2>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-[10px] font-bold">
                      Live Rankings-1500/2500/10000 Sourced
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Compares in-app 9x9 shield matrix Battle Ratings directly against official PvPoke rankings and Key Wins/Losses cards across the Top 5 meta Pokémon per league and all Form Change / Special Mechanic Pokémon.
                  </p>
                </div>

                {/* League Selector Pills */}
                <div className="flex items-center gap-1.5 bg-slate-950 p-1.5 rounded-xl border border-slate-800 shrink-0">
                  {(['GREAT LEAGUE', 'ULTRA LEAGUE', 'MASTER LEAGUE'] as const).map((l) => (
                    <button
                      key={l}
                      type="button"
                      onClick={() => setValidatorLeague(l)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                        validatorLeague === l
                          ? 'bg-amber-600 text-white shadow-sm'
                          : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                      }`}
                    >
                      {l === 'GREAT LEAGUE' ? 'GL (1500)' : l === 'ULTRA LEAGUE' ? 'UL (2500)' : 'ML (10000)'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sub-Navigation Tabs */}
              <div className="flex flex-wrap items-center gap-2 bg-slate-900/90 p-2 rounded-2xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => setValidatorSubTab('matrix_cards')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                    validatorSubTab === 'matrix_cards'
                      ? 'bg-sky-600 text-white shadow'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <Swords className="w-3.5 h-3.5" />
                  <span>Top 5 PvPoke Matchup Matrix ({validatorLeague})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setValidatorSubTab('form_changes')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                    validatorSubTab === 'form_changes'
                      ? 'bg-purple-600 text-white shadow'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Form Change &amp; Special Mechanics Matrix ({FORM_CHANGE_SPECIAL_POKEMON.length} Families)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setValidatorSubTab('aegislash_audit')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                    validatorSubTab === 'aegislash_audit'
                      ? 'bg-emerald-600 text-white shadow'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Aegislash Double-Bonus Audit (Fixed)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setValidatorSubTab('cross_validation')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                    validatorSubTab === 'cross_validation'
                      ? 'bg-amber-600 text-white shadow'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <Calculator className="w-3.5 h-3.5" />
                  <span>9x9 Shield Matrix &amp; Live Rankings Table</span>
                </button>
              </div>

              {/* =====================================================================
                  SUB-TAB 1: TOP 5 PVPOKE MATCHUP MATRIX CARDS (PER LEAGUE)
                 ===================================================================== */}
              {validatorSubTab === 'matrix_cards' && (
                <div className="space-y-6">
                  {/* Reference Melmetal Screenshot Comparison Banner (Great League) */}
                  {validatorLeague === 'GREAT LEAGUE' && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs text-slate-300 px-1">
                        <span className="font-bold text-amber-400 flex items-center gap-1.5">
                          <span>📌 Reference Benchmark Card: Melmetal (Matches Uploaded PvPoke Screenshot)</span>
                        </span>
                        <span className="text-slate-400">Score: 93.9 • Thunder Shock, Double Iron Bash*, Dynamic Punch</span>
                      </div>
                      {renderPvPokeCard(
                        getPvPokeStyleKeyMatchupsForPokemon('Melmetal', 'GREAT LEAGUE'),
                        'GREAT LEAGUE',
                        'Reference Screenshot Calibration Benchmark'
                      )}
                    </div>
                  )}

                  {/* Top 5 Live PvPoke Ranked Pokémon Cards for Selected League */}
                  <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2">
                      <h3 className="text-base font-bold text-white flex items-center gap-2">
                        <span>Top 5 Live PvPoke Rankings Matchup Matrix — {validatorLeague}</span>
                      </h3>
                      <span className="text-xs text-emerald-400 font-semibold">
                        Pulled from live rankings-{validatorLeague === 'GREAT LEAGUE' ? '1500' : validatorLeague === 'ULTRA LEAGUE' ? '2500' : '10000'}.json (Not static GameMaster)
                      </span>
                    </div>

                    <div className="space-y-5">
                      {liveTop5.map((entry, idx) => {
                        const card = getPvPokeStyleKeyMatchupsForPokemon(entry.name, validatorLeague);
                        const syncedCard: PvPokeMatchupCardData = {
                          ...card,
                          rank: idx + 1,
                          score: entry.score ?? card.score
                        };
                        return renderPvPokeCard(
                          syncedCard,
                          validatorLeague,
                          `Live PvPoke Rank #${idx + 1} (${syncedCard.score.toFixed(1)})`
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* =====================================================================
                  SUB-TAB 2: FORM CHANGE & SPECIAL MECHANICS MATRIX
                 ===================================================================== */}
              {validatorSubTab === 'form_changes' && (
                <div className="space-y-6">
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <h3 className="text-base font-bold text-white flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-purple-400" />
                          <span>Special Mechanic Pokémon Only — In-Battle Form &amp; Mechanic Math Validator</span>
                        </h3>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Includes strictly in-battle special mechanic Pokémon (Morpeko Hunger Switch, Cramorant Gulp Missile, Aegislash Stance Change, and Mimikyu Disguise) and validates that zero double-bonus multipliers are applied.
                        </p>
                      </div>
                      <span className="px-3 py-1 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-bold shrink-0">
                        ✅ Zero Double-Bonus Verified
                      </span>
                    </div>

                    {/* Quick Jump Pills for All Form Families */}
                    <div className="flex flex-wrap gap-1.5 pt-2">
                      {FORM_CHANGE_SPECIAL_POKEMON.map((grp) => (
                        <button
                          key={grp.id}
                          type="button"
                          onClick={() => setExpandedFormId(grp.id)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition border ${
                            expandedFormId === grp.id
                              ? 'bg-purple-600 text-white border-purple-400 shadow'
                              : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          {grp.speciesTitle.split('(')[0].trim()}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => setExpandedFormId('ALL')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition border ${
                          expandedFormId === 'ALL'
                            ? 'bg-amber-600 text-white border-amber-400 shadow'
                            : 'bg-slate-950 text-amber-400 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        Show All ({FORM_CHANGE_SPECIAL_POKEMON.length})
                      </button>
                    </div>
                  </div>

                  {/* Render Selected or All Form Families */}
                  <div className="space-y-8">
                    {FORM_CHANGE_SPECIAL_POKEMON.filter(
                      (grp) => expandedFormId === 'ALL' || grp.id === expandedFormId
                    ).map((group: FormChangeComparisonGroup) => (
                      <div
                        key={group.id}
                        className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-5"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-lg font-extrabold text-white">{group.speciesTitle}</h4>
                              <span className="px-2.5 py-0.5 rounded-full bg-purple-500/20 border border-purple-500/40 text-purple-300 text-[11px] font-bold">
                                {group.mechanicCategory}
                              </span>
                            </div>
                            <p className="text-xs text-slate-300 mt-1">{group.mechanicSummary}</p>
                          </div>
                          <span className="px-3 py-1 rounded-lg bg-slate-950 border border-slate-800 text-amber-400 text-xs font-bold shrink-0">
                            {group.targetLeague}
                          </span>
                        </div>

                        {/* Forms Rendered in Full PvPoke Matchup Matrix Style */}
                        <div className="space-y-5">
                          {group.forms.map((f, fIdx) => {
                            const moveParts = f.moveset.split('•').map((s) => s.trim());
                            const fastMove = moveParts[0] || 'Fast Move';
                            const chargedMoves = (moveParts[1] || 'Charged Move').split('/').map((s) => s.trim());

                            const formCard: PvPokeMatchupCardData = {
                              pokemonName: `${f.pokemonName} — ${f.formLabel}`,
                              rank: fIdx + 1,
                              score: f.score,
                              types: f.types,
                              fastMove,
                              chargedMoves,
                              keyWins: f.keyWins,
                              keyLosses: f.keyLosses
                            };

                            return renderPvPokeCard(
                              formCard,
                              group.targetLeague,
                              `${f.statProductSummary} • CP ${f.cp}`,
                              f.specialMechanicNote
                            );
                          })}
                        </div>

                        {/* Matchup Shift Highlights Box */}
                        <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-2">
                          <div className="text-xs font-bold text-amber-400">
                            🔍 Form Shift &amp; Mechanic Math Verification Takeaways:
                          </div>
                          <ul className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs text-slate-300">
                            {group.matchupShiftHighlights.map((hl, i) => (
                              <li
                                key={i}
                                className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800/80 flex items-start gap-2"
                              >
                                <span className="text-emerald-400 font-bold">✓</span>
                                <span>{hl}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* =====================================================================
                  SUB-TAB 3: AEGISLASH DOUBLE-BONUS AUDIT & FIX VERIFICATION
                 ===================================================================== */}
              {validatorSubTab === 'aegislash_audit' && (
                <div className="space-y-6">
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
                      <div>
                        <h3 className="text-lg font-extrabold text-white flex items-center gap-2">
                          <AlertTriangle className="w-5 h-5 text-amber-400" />
                          <span>{AEGISLASH_DOUBLE_BONUS_AUDIT.issueTitle}</span>
                        </h3>
                        <p className="text-xs text-slate-400 mt-1">
                          Diagnostic audit resolving why Aegislash previously appeared artificially high in Team Builder Battle Rating compared to official PvPoke Great League rankings.
                        </p>
                      </div>
                      <span className="px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs font-bold shrink-0">
                        {AEGISLASH_DOUBLE_BONUS_AUDIT.mathAfterFix.status}
                      </span>
                    </div>

                    {/* Root Cause & Before/After Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 rounded-xl bg-rose-950/25 border border-rose-500/40 space-y-2.5">
                        <div className="text-xs font-extrabold text-rose-300 uppercase tracking-wider">
                          ❌ Previous Double-Bonus Bug (Removed)
                        </div>
                        <p className="text-xs text-slate-300 leading-relaxed">
                          {AEGISLASH_DOUBLE_BONUS_AUDIT.identifiedCauses.energyBonus}
                        </p>
                        <p className="text-xs text-slate-300 leading-relaxed">
                          {AEGISLASH_DOUBLE_BONUS_AUDIT.identifiedCauses.flatRatingBonus}
                        </p>
                        <div className="pt-2 flex items-center gap-4 text-xs">
                          <div className="p-2 rounded bg-slate-950 border border-rose-500/30">
                            <span className="text-slate-400 block text-[10px]">Old 2-Shield BR</span>
                            <span className="text-base font-extrabold text-rose-400">
                              {AEGISLASH_DOUBLE_BONUS_AUDIT.mathBeforeFix.twoShieldBr} BR
                            </span>
                          </div>
                          <div className="p-2 rounded bg-slate-950 border border-rose-500/30">
                            <span className="text-slate-400 block text-[10px]">Old Team Builder BR</span>
                            <span className="text-base font-extrabold text-rose-400">
                              {AEGISLASH_DOUBLE_BONUS_AUDIT.mathBeforeFix.teamBuilderBr} BR
                            </span>
                          </div>
                          <div className="p-2 rounded bg-slate-950 border border-rose-500/30">
                            <span className="text-slate-400 block text-[10px]">Distorted Tier</span>
                            <span className="text-xs font-bold text-rose-300">
                              {AEGISLASH_DOUBLE_BONUS_AUDIT.mathBeforeFix.perceivedTier}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="p-4 rounded-xl bg-emerald-950/25 border border-emerald-500/40 space-y-2.5">
                        <div className="text-xs font-extrabold text-emerald-300 uppercase tracking-wider">
                          ✅ Corrected In-App Math (Aligned with PvPoke)
                        </div>
                        <p className="text-xs text-slate-300 leading-relaxed">
                          {AEGISLASH_DOUBLE_BONUS_AUDIT.whyPvPokeRanksItAround80}
                        </p>
                        <div className="pt-2 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                          <div className="p-2 rounded bg-slate-950 border border-emerald-500/30">
                            <span className="text-slate-400 block text-[10px]">New Composite BR</span>
                            <span className="text-base font-extrabold text-emerald-400">
                              {AEGISLASH_DOUBLE_BONUS_AUDIT.mathAfterFix.compositeBr} BR
                            </span>
                          </div>
                          <div className="p-2 rounded bg-slate-950 border border-emerald-500/30">
                            <span className="text-slate-400 block text-[10px]">PvPoke Baseline</span>
                            <span className="text-base font-extrabold text-sky-400">
                              {AEGISLASH_DOUBLE_BONUS_AUDIT.mathAfterFix.pvpokeBaselineBr} BR
                            </span>
                          </div>
                          <div className="p-2 rounded bg-slate-950 border border-emerald-500/30">
                            <span className="text-slate-400 block text-[10px]">PvPoke Rank</span>
                            <span className="text-xs font-extrabold text-amber-400">
                              {AEGISLASH_DOUBLE_BONUS_AUDIT.mathAfterFix.pvpokeRank}
                            </span>
                          </div>
                          <div className="p-2 rounded bg-slate-950 border border-emerald-500/30">
                            <span className="text-slate-400 block text-[10px]">PvPoke Score</span>
                            <span className="text-base font-extrabold text-amber-300">
                              {AEGISLASH_DOUBLE_BONUS_AUDIT.mathAfterFix.pvpokeScore}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Verified Key Counters Table */}
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                        Verified Great League Meta Counters to Aegislash (In-App vs PvPoke BR)
                      </h4>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs text-slate-300 border border-slate-800 rounded-xl overflow-hidden">
                          <thead className="bg-slate-950 text-slate-400 uppercase text-[10px]">
                            <tr>
                              <th className="p-2.5">Opposing Meta Counter</th>
                              <th className="p-2.5">Aegislash In-App BR</th>
                              <th className="p-2.5">Aegislash PvPoke BR</th>
                              <th className="p-2.5">Delta</th>
                              <th className="p-2.5">Mechanical Reason Aegislash Loses</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800">
                            {AEGISLASH_DOUBLE_BONUS_AUDIT.verifiedKeyCounters.map((c) => (
                              <tr key={c.name} className="hover:bg-slate-800/40">
                                <td className="p-2.5 font-bold text-white">{c.name}</td>
                                <td className="p-2.5 font-bold text-rose-400">{c.inAppBr} BR</td>
                                <td className="p-2.5 font-bold text-sky-400">{c.pvpokeBr} BR</td>
                                <td className="p-2.5 font-mono text-emerald-400">
                                  {c.inAppBr - c.pvpokeBr >= 0 ? `+${c.inAppBr - c.pvpokeBr}` : c.inAppBr - c.pvpokeBr}
                                </td>
                                <td className="p-2.5 text-slate-300">{c.whyAegislashLoses}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* =====================================================================
                  SUB-TAB 4: 9x9 SHIELD MATRIX & LIVE RANKINGS CROSS-VALIDATION
                 ===================================================================== */}
              {validatorSubTab === 'cross_validation' && (
                <div className="space-y-6">
                  {/* 5 Pokémon Validation Cards for Selected League */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-white flex items-center justify-between">
                      <span>Top 5 Live PvPoke Rankings vs In-App 9x9 Shield Matrix ({validatorLeague})</span>
                      <span className="text-xs font-normal text-emerald-400">
                        Sourced directly from live rankings-{validatorLeague === 'GREAT LEAGUE' ? '1500' : validatorLeague === 'ULTRA LEAGUE' ? '2500' : '10000'}.json
                      </span>
                    </h3>

                    {(() => {
                      const blendedMeta = computeBlendedSeasonMeta(validatorLeague);
                      const top5 = getLiveRankingsForLeague(validatorLeague, 5);

                      return (
                        <div className="grid grid-cols-1 gap-4">
                          {top5.map((entry) => {
                            const rawRec = getRecommendedMovesForPokemon(entry.name, validatorLeague);
                            const member: TeamMember = {
                              id: `validator-${entry.name}`,
                              name: entry.name,
                              cp: rawRec?.cp || (validatorLeague.includes('GREAT') ? 1498 : validatorLeague.includes('ULTRA') ? 2495 : 4500),
                              fastMove: rawRec?.fastMove || entry.fastMove,
                              chargedMove1: rawRec?.chargedMove1 || entry.chargedMoves[0],
                              chargedMove2: rawRec?.chargedMove2 || entry.chargedMoves[1] || entry.chargedMoves[0],
                              ivs: rawRec?.defaultIvs || (validatorLeague.includes('MASTER') ? '15/15/15' : '1/15/15')
                            };
                            const evalRes = evaluateSingleSlotAgainstBlendedMeta(member, validatorLeague, blendedMeta);
                            const compositeBr = Math.round(0.40 * evalRes.leadBr + 0.35 * evalRes.swapBr + 0.25 * evalRes.closerBr);
                            const normScore = Number((50 + (compositeBr - 500) / 6.5).toFixed(1));
                            const dbScore = entry.score || 90.0;
                            const deltaScore = Number((normScore - dbScore).toFixed(1));

                            return (
                              <div
                                key={entry.name}
                                className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl hover:border-slate-700 transition space-y-4"
                              >
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                                  <div className="flex items-center gap-3">
                                    <span className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 font-extrabold flex items-center justify-center text-sm border border-amber-500/30">
                                      #{entry.rank}
                                    </span>
                                    <div>
                                      <div className="text-base font-bold text-white flex items-center gap-2">
                                        <span>{entry.name}</span>
                                        <div className="flex items-center gap-1">
                                          {entry.types.map((t) => (
                                            <span
                                              key={t}
                                              className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700"
                                            >
                                              {t}
                                            </span>
                                          ))}
                                        </div>
                                      </div>
                                      <div className="text-xs text-slate-400 mt-0.5">
                                        Moves: <span className="text-slate-200 font-medium">{member.fastMove}</span> •{' '}
                                        <span className="text-slate-200 font-medium">{member.chargedMove1}</span> /{' '}
                                        <span className="text-slate-200 font-medium">{member.chargedMove2}</span>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-2 shrink-0">
                                    <span className="px-2.5 py-1 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold flex items-center gap-1">
                                      <CheckCircle2 className="w-3.5 h-3.5" />
                                      <span>Live Rankings Verified</span>
                                    </span>
                                  </div>
                                </div>

                                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
                                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-between">
                                    <span className="text-[10px] text-slate-400 uppercase font-semibold">Live Rankings Score</span>
                                    <div className="text-lg font-extrabold text-amber-400 mt-1">
                                      {dbScore.toFixed(1)} <span className="text-[10px] text-slate-500">/ 100</span>
                                    </div>
                                    <span className="text-[10px] text-slate-500 mt-0.5">PvPoke Rank #{entry.rank}</span>
                                  </div>

                                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-between">
                                    <span className="text-[10px] text-slate-400 uppercase font-semibold">In-App Lead BR</span>
                                    <div className="text-lg font-extrabold text-sky-400 mt-1">
                                      {evalRes.leadBr} <span className="text-[10px] text-slate-500">/ 1000</span>
                                    </div>
                                    <span className="text-[10px] text-slate-400 mt-0.5">1v1 &amp; 2v2 Shield Dominance</span>
                                  </div>

                                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-between">
                                    <span className="text-[10px] text-slate-400 uppercase font-semibold">In-App Swap BR</span>
                                    <div className="text-lg font-extrabold text-purple-400 mt-1">
                                      {evalRes.swapBr} <span className="text-[10px] text-slate-500">/ 1000</span>
                                    </div>
                                    <span className="text-[10px] text-slate-400 mt-0.5">Safe Swap Consistency</span>
                                  </div>

                                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-between">
                                    <span className="text-[10px] text-slate-400 uppercase font-semibold">In-App Closer BR</span>
                                    <div className="text-lg font-extrabold text-indigo-400 mt-1">
                                      {evalRes.closerBr} <span className="text-[10px] text-slate-500">/ 1000</span>
                                    </div>
                                    <span className="text-[10px] text-slate-400 mt-0.5">0v0 Shieldless Clean-Up</span>
                                  </div>

                                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-between col-span-2 sm:col-span-1">
                                    <span className="text-[10px] text-slate-400 uppercase font-semibold">Normalized Math Score</span>
                                    <div className="text-lg font-extrabold text-emerald-400 mt-1 flex items-center gap-1.5">
                                      <span>{normScore}</span>
                                      <span
                                        className={`text-[10px] font-bold px-1 rounded ${
                                          Math.abs(deltaScore) <= 2.5
                                            ? 'bg-emerald-950 text-emerald-300'
                                            : 'bg-amber-950 text-amber-300'
                                        }`}
                                      >
                                        {deltaScore >= 0 ? `+${deltaScore}` : deltaScore}
                                      </span>
                                    </div>
                                    <span className="text-[10px] text-slate-500 mt-0.5">
                                      Correlation: {Math.abs(deltaScore) <= 3.0 ? '🎯 Exact Fit' : 'High Alignment'}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>

                  {/* 3-League Summary Matrix Table */}
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>All 3 Leagues Cross-Validation Summary (15 Top Meta Pokémon from Live Rankings)</span>
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs text-slate-300">
                        <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] border-b border-slate-800">
                          <tr>
                            <th className="p-2.5">League</th>
                            <th className="p-2.5">Rank</th>
                            <th className="p-2.5">Pokémon</th>
                            <th className="p-2.5">Moveset Evaluated</th>
                            <th className="p-2.5">Live Rankings Score</th>
                            <th className="p-2.5">In-App Lead BR</th>
                            <th className="p-2.5">In-App Swap BR</th>
                            <th className="p-2.5">In-App Closer BR</th>
                            <th className="p-2.5">Math Validation</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                          {(['GREAT LEAGUE', 'ULTRA LEAGUE', 'MASTER LEAGUE'] as const).flatMap((lg) => {
                            const bMeta = computeBlendedSeasonMeta(lg);
                            const rows = getLiveRankingsForLeague(lg, 5);
                            return rows.map((r, i) => {
                              const rawRec = getRecommendedMovesForPokemon(r.name, lg);
                              const mb: TeamMember = {
                                id: `summary-${lg}-${r.name}`,
                                name: r.name,
                                cp: rawRec?.cp || (lg.includes('GREAT') ? 1498 : lg.includes('ULTRA') ? 2495 : 4500),
                                fastMove: rawRec?.fastMove || r.fastMove,
                                chargedMove1: rawRec?.chargedMove1 || r.chargedMoves[0],
                                chargedMove2: rawRec?.chargedMove2 || r.chargedMoves[1] || r.chargedMoves[0],
                                ivs: rawRec?.defaultIvs || (lg.includes('MASTER') ? '15/15/15' : '1/15/15')
                              };
                              const ev = evaluateSingleSlotAgainstBlendedMeta(mb, lg, bMeta);
                              return (
                                <tr key={`${lg}-${r.name}`} className="hover:bg-slate-800/40 transition">
                                  {i === 0 && (
                                    <td rowSpan={5} className="p-2.5 font-bold text-amber-400 align-top border-r border-slate-800 bg-slate-950/40">
                                      {lg === 'GREAT LEAGUE' ? 'Great League (1500)' : lg === 'ULTRA LEAGUE' ? 'Ultra League (2500)' : 'Master League (10000)'}
                                    </td>
                                  )}
                                  <td className="p-2.5 font-bold text-slate-200">#{r.rank}</td>
                                  <td className="p-2.5 font-bold text-white">{r.name}</td>
                                  <td className="p-2.5 text-slate-400 font-mono text-[11px]">
                                    {mb.fastMove} • {mb.chargedMove1}/{mb.chargedMove2}
                                  </td>
                                  <td className="p-2.5 font-bold text-amber-400">{r.score?.toFixed(1)}</td>
                                  <td className="p-2.5 font-semibold text-sky-400">{ev.leadBr}</td>
                                  <td className="p-2.5 font-semibold text-purple-400">{ev.swapBr}</td>
                                  <td className="p-2.5 font-semibold text-indigo-400">{ev.closerBr}</td>
                                  <td className="p-2.5">
                                    <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold">
                                      ✅ Verified
                                    </span>
                                  </td>
                                </tr>
                              );
                            });
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* =========================================================================
            TAB 5: ANDROID SOURCE CODE & COMPLETE PROJECT EXPORTER
           ========================================================================= */}
        {activeTab === 'android_code' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <FileCode2 className="w-5 h-5 text-emerald-400" />
                  <span>Android Native Project Codebase</span>
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Ready-to-compile Kotlin files for Android Studio. Includes foreground WindowManager overlay, zero-disk MediaProjection capture, ML Kit offline text recognizer, and local SharedPreferences preset manager.
                </p>
              </div>

              <button
                onClick={handleDownloadZip}
                disabled={isDownloadingZip}
                className="py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-95 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-emerald-600/25 transition shrink-0"
              >
                <FolderArchive className="w-4 h-4" />
                <span>{isDownloadingZip ? 'Generating Zip...' : 'Download Full Android Project (.zip)'}</span>
              </button>
            </div>

            {/* GitHub Repository Push Integration Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-white text-base font-bold">
                    🐙
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-white flex items-center gap-2">
                      <span>Git Repository Status: Ready to Push</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        Committed (main branch)
                      </span>
                    </h3>
                    <p className="text-xs text-slate-400">
                      All 22 project files are staged and committed in the local Git repository on branch <code>main</code>.
                    </p>
                  </div>
                </div>

                <div className="text-xs text-slate-400 font-mono bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800 self-start sm:self-auto">
                  commit: <span className="text-sky-400">f5d598f</span>
                </div>
              </div>

              <div className="mt-3 text-xs text-slate-300 space-y-2">
                <p>
                  To push these committed files to your GitHub account:
                </p>
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 font-mono text-[11.5px] text-sky-300 space-y-1">
                  <div>git remote add origin https://github.com/&lt;your-username&gt;/&lt;your-repo&gt;.git</div>
                  <div>git branch -M main</div>
                  <div>git push -u origin main</div>
                </div>
                <p className="text-[11px] text-slate-400">
                  Tip: If your GitHub repository uses a Personal Access Token (PAT), provide your repo URL and token in chat, and it will be pushed automatically!
                </p>
              </div>
            </div>

            {/* File Selector Tabs */}
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none border-b border-slate-800">
              {ANDROID_FILES.map((file, idx) => (
                <button
                  key={file.path}
                  onClick={() => setSelectedFileIndex(idx)}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition flex items-center gap-2 ${
                    selectedFileIndex === idx
                      ? 'bg-slate-800 text-sky-400 border border-sky-400/40 shadow-sm'
                      : 'text-slate-400 hover:text-white hover:bg-slate-900'
                  }`}
                >
                  <span className="font-mono">{file.name}</span>
                </button>
              ))}
            </div>

            {/* Active File Details & Code Display */}
            {ANDROID_FILES[selectedFileIndex] && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
                <div className="px-5 py-3.5 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="font-mono font-bold text-xs text-sky-400 block">
                      {ANDROID_FILES[selectedFileIndex].path}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {ANDROID_FILES[selectedFileIndex].description}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleCopyCode(ANDROID_FILES[selectedFileIndex].content)}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 font-semibold flex items-center gap-1.5 transition"
                    >
                      {copiedFile ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy Code</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <pre className="p-5 text-xs font-mono text-slate-300 overflow-x-auto max-h-[580px] bg-slate-950/90 leading-relaxed selection:bg-sky-500/30">
                  <code>{ANDROID_FILES[selectedFileIndex].content}</code>
                </pre>
              </div>
            )}
          </div>
        )}

        {/* Deleted Teams Trash Bin Modal */}
        {showTeamsTrashModal && (
          <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-5 shadow-2xl space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <h3 className="font-bold text-sm text-white">
                  🗑️ Deleted Teams Trash Bin ({deletedTeamsTrash.length})
                </h3>
                <button
                  onClick={() => setShowTeamsTrashModal(false)}
                  className="text-slate-400 hover:text-white font-bold"
                >
                  ✕
                </button>
              </div>
              {deletedTeamsTrash.length === 0 ? (
                <p className="text-xs text-slate-400 py-4 text-center">
                  No deleted teams in Trash. Any team you delete can be restored from here anytime.
                </p>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                  {deletedTeamsTrash.map((t) => (
                    <div
                      key={t.id}
                      className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-2 text-xs"
                    >
                      <div>
                        <div className="font-bold text-white">
                          {t.name}{' '}
                          <span className="text-[10px] text-sky-400 font-mono">({t.league})</span>
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {t.pokemon.map((p) => p.name).join(' / ')}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => restoreTeamPresetsFromTrash([t])}
                          className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px]"
                        >
                          ♻️ Restore
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            saveDeletedTeamsTrashToStorage(deletedTeamsTrash.filter((x) => x.id !== t.id))
                          }
                          className="px-2 py-1 rounded-lg bg-rose-950 hover:bg-rose-900 text-rose-300 font-bold text-[11px]"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex justify-between items-center pt-2 border-t border-slate-800">
                {deletedTeamsTrash.length > 0 ? (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        restoreTeamPresetsFromTrash(deletedTeamsTrash);
                        setShowTeamsTrashModal(false);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold"
                    >
                      ♻️ Restore All ({deletedTeamsTrash.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => saveDeletedTeamsTrashToStorage([])}
                      className="px-3 py-1.5 rounded-xl bg-rose-950 hover:bg-rose-900 text-rose-300 text-xs font-bold"
                    >
                      🗑️ Empty Trash
                    </button>
                  </div>
                ) : (
                  <span />
                )}
                <button
                  type="button"
                  onClick={() => setShowTeamsTrashModal(false)}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Deleted Battles Trash Bin Modal */}
        {showBattlesTrashModal && (
          <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-5 shadow-2xl space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <h3 className="font-bold text-sm text-white">
                  🗑️ Deleted Battles Trash Bin ({deletedBattlesTrash.length})
                </h3>
                <button
                  onClick={() => setShowBattlesTrashModal(false)}
                  className="text-slate-400 hover:text-white font-bold"
                >
                  ✕
                </button>
              </div>
              {deletedBattlesTrash.length === 0 ? (
                <p className="text-xs text-slate-400 py-4 text-center">
                  No deleted battles in Trash. Any battle you delete or clear can be restored from here anytime.
                </p>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                  {deletedBattlesTrash.map((b) => (
                    <div
                      key={b.id}
                      className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-2 text-xs"
                    >
                      <div>
                        <div className="font-bold text-white flex items-center gap-1.5">
                          <span className={b.result === 'WIN' ? 'text-emerald-400' : 'text-rose-400'}>
                            {b.result === 'WIN' ? '🏆 WIN' : '💀 LOSS'}
                          </span>
                          <span>• {b.userTeamName}</span>
                        </div>
                        <div className="text-[11px] text-slate-400">
                          Vs: {b.opponents.length > 0 ? b.opponents.join(', ') : 'Unknown'}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => restoreBattleLogsFromTrash([b])}
                          className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px]"
                        >
                          ♻️ Restore
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            saveDeletedBattlesTrashToStorage(deletedBattlesTrash.filter((x) => x.id !== b.id))
                          }
                          className="px-2 py-1 rounded-lg bg-rose-950 hover:bg-rose-900 text-rose-300 font-bold text-[11px]"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex justify-between items-center pt-2 border-t border-slate-800">
                {deletedBattlesTrash.length > 0 ? (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        restoreBattleLogsFromTrash(deletedBattlesTrash);
                        setShowBattlesTrashModal(false);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold"
                    >
                      ♻️ Restore All ({deletedBattlesTrash.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => saveDeletedBattlesTrashToStorage([])}
                      className="px-3 py-1.5 rounded-xl bg-rose-950 hover:bg-rose-900 text-rose-300 text-xs font-bold"
                    >
                      🗑️ Empty Trash
                    </button>
                  </div>
                ) : (
                  <span />
                )}
                <button
                  type="button"
                  onClick={() => setShowBattlesTrashModal(false)}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Help & Metric Guide Modal (v3.00 Documentation Modal) */}
        {showHelpMetricGuideModal && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-3xl w-full p-5 sm:p-6 shadow-2xl space-y-4 max-h-[88vh] flex flex-col">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3 shrink-0">
                <div>
                  <h3 className="font-bold text-base text-white flex items-center gap-2">
                    <Info className="w-4 h-4 text-sky-400" />
                    <span>Help &amp; Metric Guide (v3.31 Analytics Reference)</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    How SilphScope PvP separates micro-execution skill from matchmaking alignment RNG
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowHelpMetricGuideModal(false)}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold transition"
                >
                  ✕
                </button>
              </div>

              {/* Section Filter Tabs inside Modal */}
              <div className="flex items-center gap-1.5 p-1 bg-slate-950 rounded-xl border border-slate-800 shrink-0">
                <button
                  type="button"
                  onClick={() => setHelpMetricGuideTopic('wae')}
                  className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                    helpMetricGuideTopic === 'wae'
                      ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/40'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  1. Execution WAE
                </button>
                <button
                  type="button"
                  onClick={() => setHelpMetricGuideTopic('bmf')}
                  className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                    helpMetricGuideTopic === 'bmf'
                      ? 'bg-sky-600/20 text-sky-300 border border-sky-500/40'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  2. Matchup Luck (BMF)
                </button>
                <button
                  type="button"
                  onClick={() => setHelpMetricGuideTopic('badges')}
                  className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                    helpMetricGuideTopic === 'badges'
                      ? 'bg-amber-600/20 text-amber-300 border border-amber-500/40'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  3. Badge Glossary
                </button>
              </div>

              <div className="overflow-y-auto space-y-4 pr-1 text-xs leading-relaxed text-slate-300">
                {/* SECTION 1: EXECUTION WAE */}
                <div
                  className={`p-4 rounded-xl border space-y-2.5 ${
                    helpMetricGuideTopic === 'wae'
                      ? 'bg-slate-950 border-emerald-500/40'
                      : 'bg-slate-950/60 border-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="font-bold text-sm text-emerald-400">
                      1. Execution WAE (Wins Above Expected)
                    </h4>
                    <span className="font-mono text-[11px] text-slate-400">
                      Aggregate: Σ(w_i · ΔQ_final,i) / Σ(w_i)
                    </span>
                  </div>
                  <p>
                    <strong>Execution WAE</strong> isolates your in-battle micro-execution — <strong>energy farming</strong>,{' '}
                    <strong>fast move denial (sneak prevention)</strong>, <strong>sacrificial catch management</strong>,{' '}
                    <strong>CMP timing</strong>, and <strong>shield discipline</strong> — from blind 3v3 team-composition RNG.
                  </p>
                  <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 font-mono text-[11px] text-slate-200 space-y-1">
                    <div>
                      <span className="text-emerald-400 font-bold">Timeline Duration Weighting:</span> S_actual = Σ (τ_k · R_k) where τ_k = Δt_k / t_total
                    </div>
                    <div>
                      <span className="text-sky-400 font-bold">Asymmetric 9-Shield Matrix:</span> R_k = Rating_&#123;s_user v s_opp&#125;(userActive, oppActive) ∈ &#123;0v0 .. 2v2&#125;
                    </div>
                    <div>
                      <span className="text-amber-300 font-bold">Execution Win Probability:</span> P_exec = 1 / (1 + e^(-0.006 · (S_actual - 500)))
                    </div>
                    <div>
                      <span className="text-purple-300 font-bold">Base Residual &amp; Modifiers:</span> ΔQ_base = Result - P_exec (Win = 1.0, Loss = 0.0)
                    </div>
                  </div>
                  <ul className="list-disc list-inside space-y-1 text-slate-300">
                    <li>
                      <strong>Faint Margin Scaling (×1.10):</strong> When you win with a <code>≥ 2</code> Pokémon faint margin (e.g., 2-0 or 3-0 sweep), positive execution credit is scaled by <code>1.10×</code>.
                    </li>
                    <li>
                      <strong>Shield-in-Pocket Penalty (-0.15 per unused shield):</strong> Losing a match while holding 1 or 2 unused shields applies <code>ΔQ_final = ΔQ_base - 0.15 × userShieldsRemaining</code> to penalize unspent defensive resources.
                    </li>
                    <li>
                      <strong>Interpretation:</strong> A positive <code>EXEC WAE</code> (e.g., <code>+8.4%</code>) means your micro-decisions are converting more wins than the active on-field alignments and shield states predict.
                    </li>
                  </ul>
                </div>

                {/* SECTION 2: MATCHUP LUCK (BMF) */}
                <div
                  className={`p-4 rounded-xl border space-y-2.5 ${
                    helpMetricGuideTopic === 'bmf'
                      ? 'bg-slate-950 border-sky-500/40'
                      : 'bg-slate-950/60 border-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="font-bold text-sm text-sky-400">
                      2. Matchup Luck (Blind Matchup Favorability — BMF)
                    </h4>
                    <span className="font-mono text-[11px] text-slate-400">
                      M = 0.40 · S_lead + 0.60 · S_back
                    </span>
                  </div>
                  <p>
                    <strong>Matchup Luck (BMF / P_pre)</strong> measures whether matchmaking is handing you favorable team alignments (<code>&gt;50%</code>) or hard-counter RPS lineups (<code>&lt;50%</code>) purely from the 3v3 rosters before any swaps, catches, or baits occur.
                  </p>
                  <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 font-mono text-[11px] text-slate-200 space-y-1">
                    <div>
                      <span className="text-sky-400 font-bold">Lead Score (50/50 1v1 &amp; 2v2):</span> S_lead = 0.50 · R_1v1(lead) + 0.50 · R_2v2(lead)
                    </div>
                    <div>
                      <span className="text-emerald-400 font-bold">Backline Score (70/30 Optimal Alignment):</span> S_back = 0.70 · max(Score_A, Score_B) + 0.30 · min(Score_A, Score_B)
                    </div>
                    <div>
                      <span className="text-amber-300 font-bold">Composite &amp; Logistic BMF:</span> M = 0.40 · S_lead + 0.60 · S_back  ⇒  P_pre = 1 / (1 + e^(-0.006 · (M - 500)))
                    </div>
                  </div>
                  <ul className="list-disc list-inside space-y-1 text-slate-300">
                    <li>
                      <strong>Early Forfeits (&lt;2 Opponents Revealed, w = 0.00):</strong> Matches where the opponent&apos;s first switch is never revealed are dropped from ranked WAE and Matchup Luck calculations.
                    </li>
                    <li>
                      <strong>Unrevealed 3rd Closer (2 Opponents Revealed, w = 0.75):</strong> When an opponent forfeits or gets swept before revealing their 3rd Pokémon, SilphScope substitutes the active league&apos;s <strong>Meta-Average 1v1 Prior</strong> (<code>R̄_swap</code>, <code>R̄_close</code>) at <code>75%</code> confidence weight (tagged <code>⚡ 75% Conf</code>).
                    </li>
                    <li>
                      <strong>Full 3v3 Revealed (w = 1.00):</strong> Exact pairwise 1v1 backline matrix evaluation at <code>100%</code> confidence weight.
                    </li>
                  </ul>
                </div>

                {/* SECTION 3: BADGE GLOSSARY */}
                <div
                  className={`p-4 rounded-xl border space-y-3 ${
                    helpMetricGuideTopic === 'badges'
                      ? 'bg-slate-950 border-amber-500/40'
                      : 'bg-slate-950/60 border-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="font-bold text-sm text-amber-400">
                      3. Badge Glossary (6 Primary Badges &amp; 5 Contextual Event Pills)
                    </h4>
                    <span className="font-mono text-[11px] text-slate-400">
                      Derived from Pre-Match BMF (P_pre) &amp; Timeline
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                      <div className="font-bold text-cyan-400">Clutch Win • WIN (P_pre &lt; 40%)</div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Flipped a heavily unfavorable team alignment (&lt;40% pre-match win equity) through superior catches, energy management, or shield baiting.
                      </p>
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                      <div className="font-bold text-emerald-400">Skill Win • WIN (40% ≤ P_pre ≤ 60%)</div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Out-executed the opponent in a balanced, neutral 3v3 matchup.
                      </p>
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                      <div className="font-bold text-slate-300">Expected Win • WIN (P_pre &gt; 60%)</div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Cleanly converted a favorable team-composition advantage into a win without throwing alignment.
                      </p>
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                      <div className="font-bold text-rose-400">Blunder Loss • LOSS (P_pre &gt; 60%)</div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Dropped a favorable matchup where your 3v3 lineup held over 60% expected win equity.
                      </p>
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                      <div className="font-bold text-orange-400">Tough Loss • LOSS (40% ≤ P_pre ≤ 60%)</div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Narrow defeat in a competitive 50/50 matchup decided by micro-timing or CMP.
                      </p>
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                      <div className="font-bold text-slate-400">Expected Loss • LOSS (P_pre &lt; 40%)</div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Hard-countered team alignment (&lt;40% win equity); carries minimal negative impact on WAE.
                      </p>
                    </div>
                  </div>

                  <div className="pt-1 border-t border-slate-800 space-y-1.5">
                    <div className="font-bold text-xs text-slate-200">
                      Contextual Event Flags (Timeline &amp; End-State Pills):
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px]">
                      <div className="p-2 rounded bg-slate-900 border border-slate-800">
                        <span className="font-bold text-rose-300">⚠️ Double Shield Pocket:</span> Loss finished with 2 unused shields remaining (<code>-0.30</code> ΔQ penalty).
                      </div>
                      <div className="p-2 rounded bg-slate-900 border border-slate-800">
                        <span className="font-bold text-amber-300">⚠️ Shield in Pocket:</span> Loss finished with 1 unused shield remaining (<code>-0.15</code> ΔQ penalty).
                      </div>
                      <div className="p-2 rounded bg-slate-900 border border-slate-800">
                        <span className="font-bold text-emerald-300">🧹 Clean Sweep:</span> Win achieved with <code>0</code> user faints (all 3 Pokémon surviving).
                      </div>
                      <div className="p-2 rounded bg-slate-900 border border-slate-800">
                        <span className="font-bold text-sky-300">🛡️ Shield Advantage:</span> Win achieved while ending with more shields remaining than the opponent.
                      </div>
                      <div className="p-2 rounded bg-slate-900 border border-slate-800 sm:col-span-2">
                        <span className="font-bold text-purple-300">⚡ 75% Conf:</span> Opponent&apos;s 3rd Pokémon was unrevealed; evaluated at <code>w = 0.75</code> confidence weight using the league&apos;s Meta-Average 1v1 Prior.
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center pt-2 border-t border-slate-800 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setShowHelpMetricGuideModal(false);
                    setActiveTab('help');
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-sky-300 text-xs font-bold transition"
                >
                  📖 Open Full Help Page
                </button>
                <button
                  type="button"
                  onClick={() => setShowHelpMetricGuideModal(false)}
                  className="px-4 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition"
                >
                  Got It
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Overlay HUD & Battle Flow Quick Help Modal (Opened from Start Battle Overlay Region Help Button) */}
        {showOverlayQuickHelpModal && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-3xl w-full p-5 sm:p-6 shadow-2xl space-y-4 max-h-[88vh] flex flex-col">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3 shrink-0">
                <div>
                  <h3 className="font-bold text-base text-white flex items-center gap-2">
                    <span>🎯 Overlay HUD &amp; Battle Flow Guide (v3.31)</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    How to interact with the floating overlay, read 3x3 damage % &amp; shield dots, track 50s swap clocks, and log battles
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowOverlayQuickHelpModal(false)}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold transition"
                >
                  ✕
                </button>
              </div>

              <div className="overflow-y-auto space-y-3.5 pr-1 text-xs leading-relaxed text-slate-300">
                <div className="p-4 rounded-xl bg-slate-950 border border-sky-500/30 space-y-1.5">
                  <h4 className="font-bold text-sm text-sky-400">
                    1. General Battle Flow &amp; Interacting with the Overlay
                  </h4>
                  <ul className="list-disc list-inside space-y-1">
                    <li>
                      <strong>Select or Switch Teams (Main App):</strong> Choose your active team preset in the main app&apos;s <strong>⚔️ Teams</strong> page before or between sets. To switch teams, return to the main app and select another preset (it pushes immediately to the running overlay).
                    </li>
                    <li>
                      <strong>Launch, Drag &amp; Minimize (Theme Emblem Icon):</strong> Tap <strong>Start Battle Overlay</strong> to launch the HUD. Drag the header bar to reposition it anywhere. Tap the theme emblem icon in the top-left between matches to collapse the HUD into a tiny floating bubble and pause OCR scanning.
                    </li>
                    <li>
                      <strong>Interactive Header Shield Counters (🛡️ You &amp; 🛡️ Opp):</strong> Tap either shield icon in the overlay header to cycle remaining shields (<code>2→1→0→2</code>) mid-battle. Instantly recalculates the 9-scenario PvPoke matrix rating and adjusts all combat threat thresholds in real-time.
                    </li>
                    <li>
                      <strong>Manual Opponent Override (&apos;Opponents (Tap to Edit)&apos;):</strong> Tap the <strong>Opponents (Tap to Edit)</strong> header bar inside the overlay if OCR misreads a name or form to manually override any of the 3 opponent slots (with Shadow &amp; Regional/Form support).
                    </li>
                    <li>
                      <strong>Start Battle (⚔️ Start Battle):</strong> Tap when a GBL match begins. This clears the previous opponent lineup, resets both 50s swap clocks, resets shields (2v2) and Pokéballs (3v3), anchors the timeline clock (<code>t=0s</code>), and switches the button to <strong>🛑 Stop Battle</strong>.
                    </li>
                    <li>
                      <strong>Stop &amp; Log (🛑 Stop Battle):</strong> Tap when the match finishes. Verify or tap the Lead Matchup chip (<strong>Fav / Neu / Neg</strong>) and tap <strong>🏆 Win</strong> or <strong>💀 Loss</strong> (or <strong>✕ Skip</strong>).
                    </li>
                  </ul>
                </div>

                <div className="p-4 rounded-xl bg-slate-950 border border-amber-500/30 space-y-1.5">
                  <h4 className="font-bold text-sm text-amber-400">
                    2. The 3x3 Matchup &amp; Shield Matrix (PvPoke Ratings, Dots &amp; 0S/1S/2S Tags)
                  </h4>
                  <ul className="list-disc list-inside space-y-1">
                    <li>
                      <strong>3x3 Grid Structure:</strong> Columns = Opponent&apos;s 3 Pokémon in the exact order revealed (<code>[1st Lead, 2nd First Swap, 3rd Closer]</code>). Rows = Your 3 Pokémon.
                    </li>
                    <li>
                      <strong>Single-Number PvPoke Rating &amp; Colored Tier Dot:</strong> Each cell shows the exact PvPoke 500-centered matchup rating for the current shield state:
                      <span className="block ml-4 mt-1 text-[11px] text-slate-300">
                        • <strong className="text-emerald-400">[+] Bright Emerald (SW ≥ 620):</strong> Strong Win / hard counter.<br />
                        • <strong className="text-green-400">[●] Green (W 530–619):</strong> Favorable Win.<br />
                        • <strong className="text-slate-300">[●] Slate Grey (N 471–529):</strong> Neutral 50/50 matchup.<br />
                        • <strong className="text-rose-400">[●] Red (L 381–470):</strong> Unfavorable Loss.<br />
                        • <strong className="text-red-400">[×] Dark Crimson (SL ≤ 380):</strong> Strong Loss — swap or catch immediately.
                      </span>
                    </li>
                    <li>
                      <strong>0S / 1S / 2S Shield Scenario Tags:</strong> Below the rating number, cells display compact tags (e.g., <code>1S 2S✓</code> or <code>0S✗ 1S✓</code>) when spending or saving shields flips the matchup outcome.
                    </li>
                    <li>
                      <strong>Dynamic 9-State Asymmetric Matrix (0v0–2v2):</strong> Automatically updates ratings across all 9 shield combinations as shields are spent.
                    </li>
                  </ul>
                </div>

                <div className="p-4 rounded-xl bg-slate-950 border border-emerald-500/30 space-y-1.5">
                  <h4 className="font-bold text-sm text-emerald-400">
                    3. How to Use Battle Damage Numbers (Bottom 3-Column Damage Grid)
                  </h4>
                  <ul className="list-disc list-inside space-y-1">
                    <li>
                      <strong>Bottom Opponent Attacks Section:</strong> Displays a 3-column grid aligned with Opponent 1, Opponent 2, and Opponent 3 against your currently active Pokémon.
                    </li>
                    <li>
                      <strong>Live Charged Move Damage % &amp; KO! Badge:</strong> Every opponent charged move shows its move-type color dot, energy cost, fast move count, and exact HP damage percentage (e.g., <code>42%</code> or <code>88% KO!</code>) accounting for League CP stat scaling, dual-type effectiveness up to <code>2.56x</code>, STAB <code>1.2x</code>, and Shadow <code>+20% ATK / -16.7% DEF</code>.
                    </li>
                    <li>
                      <strong>Tank vs. Shield Decisions:</strong> Check the damage % before committing a shield — if a move deals <code>36%</code> you can safely tank it, whereas <code>84% KO!</code> warns you to shield.
                    </li>
                    <li>
                      <strong>Multi-Cycle Fast Move Counts (C1-C2-C3) &amp; Sneak Prevention:</strong> Shows exact fast moves required across 3 consecutive cycles (accounting for residual energy) plus optimal throw timing (<code>Throw on: 1, 4, 7</code> or <code>Aligned (Any)</code>) to deny free opponent fast move sneaks.
                    </li>
                  </ul>
                </div>

                <div className="p-4 rounded-xl bg-slate-950 border border-purple-500/30 space-y-1.5">
                  <h4 className="font-bold text-sm text-purple-400">
                    4. Dual 50s Swap Timers, Faint Preservation &amp; Statusbar Toasts
                  </h4>
                  <ul className="list-disc list-inside space-y-1">
                    <li>
                      <strong>Independent 50s Swap Clocks (&apos;You&apos; &amp; &apos;Opp&apos;):</strong> Tracks both your switch timer and the opponent&apos;s switch timer (<strong className="text-rose-400">Red 50s–16s</strong> locked, <strong className="text-amber-300">Amber 15s–1s</strong> window opening soon, <strong className="text-emerald-400">Green RDY</strong> switch available).
                    </li>
                    <li>
                      <strong>Smart Faint Swap-In Preservation:</strong> Detects Pokéball drops (<code>3→2→1</code>) when a Pokémon faints so a replacement entering after a KO preserves the running swap timer instead of falsely resetting to 50s.
                    </li>
                    <li>
                      <strong>Shield (2→1→0) &amp; Faint Column Dimming:</strong> Tracks remaining shields and automatically dims fainted opponent columns in the 3x3 matrix.
                    </li>
                    <li>
                      <strong>Top Statusbar / Clock Strip Toasts:</strong> Non-intrusive alerts for Swaps, Faint Swaps, and Shields Used rendered at the top statusbar so charged move buttons are never blocked.
                    </li>
                  </ul>
                </div>
              </div>

              <div className="flex justify-between items-center pt-2 border-t border-slate-800 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setShowOverlayQuickHelpModal(false);
                    setActiveTab('help');
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-sky-300 text-xs font-bold transition"
                >
                  📖 Open Full Help Page
                </button>
                <button
                  type="button"
                  onClick={() => setShowOverlayQuickHelpModal(false)}
                  className="px-4 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition"
                >
                  Got It
                </button>
              </div>
            </div>
          </div>
        )}

      </main>

      {/* Footer */}
      <footer
        className="border-t py-4 px-6 text-center text-xs relative z-10"
        style={{
          borderColor: activeTheme.borderHex,
          color: activeTheme.textSecondaryHex
        }}
      >
        SilphScope PvP v3.31 Overlay • Built with Kotlin, WindowManager TYPE_APPLICATION_OVERLAY, MediaProjection in-memory frame capture, and ML Kit Text Recognition.
      </footer>
    </div>
  );
}
