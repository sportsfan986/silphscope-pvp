import React from 'react';
import type { BattleQualityMetadata, BattleTimelineEvent } from '../data/battleQuality';

export function renderGblModeLogo(sizeOrClass: number | string = 22) {
  const isNum = typeof sizeOrClass === 'number';
  const s = isNum ? `${sizeOrClass}px` : undefined;
  return (
    <svg
      viewBox="0 0 64 64"
      className={!isNum ? sizeOrClass : undefined}
      style={
        isNum
          ? { width: s, height: s, display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }
          : { display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }
      }
      aria-label="GBL Blind 3 Shield Emblem"
    >
      <defs>
        <linearGradient id="gblShieldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#38BDF8" />
          <stop offset="55%" stopColor="#2563EB" />
          <stop offset="100%" stopColor="#1E1B4B" />
        </linearGradient>
      </defs>
      <path
        d="M32 4 L56 14 V31 C56 46 45 56 32 60 C19 56 8 46 8 31 V14 Z"
        fill="url(#gblShieldGrad)"
        stroke="#FACC15"
        strokeWidth="3"
      />
      <path d="M12 29 H52" stroke="#F8FAFC" strokeWidth="2.5" />
      <circle cx="32" cy="29" r="7" fill="#0F172A" stroke="#FACC15" strokeWidth="2.5" />
      <circle cx="32" cy="29" r="3" fill="#38BDF8" />
      <path d="M22 16 L32 22 L42 16" fill="none" stroke="#FACC15" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

export function renderBattleFrontierLogo(sizeOrClass: number | string = 22) {
  const isNum = typeof sizeOrClass === 'number';
  const s = isNum ? `${sizeOrClass}px` : undefined;
  return (
    <svg
      viewBox="0 0 64 64"
      className={!isNum ? sizeOrClass : undefined}
      style={
        isNum
          ? { width: s, height: s, display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }
          : { display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }
      }
      aria-label="BF Show 6 Emblem"
    >
      <defs>
        <linearGradient id="bfGoldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FDE047" />
          <stop offset="50%" stopColor="#F59E0B" />
          <stop offset="100%" stopColor="#B45309" />
        </linearGradient>
      </defs>
      <polygon
        points="32,3 41,19 59,19 45,31 51,49 32,39 13,49 19,31 5,19 23,19"
        fill="url(#bfGoldGrad)"
        stroke="#FEF08A"
        strokeWidth="2.2"
      />
      <polygon
        points="32,13 44,32 32,51 20,32"
        fill="#EF4444"
        stroke="#FEF08A"
        strokeWidth="2"
      />
      <circle cx="32" cy="32" r="5.5" fill="#0F172A" stroke="#38BDF8" strokeWidth="2" />
      <circle cx="32" cy="32" r="2.2" fill="#FDE047" />
    </svg>
  );
}

export function renderTierDots(tierStr: string) {
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
  userElo?: number | null;
  oppObservedMoves?: {
    species: string;
    fastMove?: string | null;
    fastStatus?: string | null;
    chargedMoves?: string[];
    shadowSource?: string | null;
    observedCp?: number | null;
    bestGuessIvs?: string | null;
    bpBulkTags?: string[];
  }[];
  issueFlagged?: boolean;
  issueNote?: string;
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

export const AI_LOG_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

export function deriveFirstSwapAndSwitchAdvantageWeb(
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

export const DEFAULT_SEASONS_FALLBACK: GblSeasonInfo[] = [
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

export const DEFAULT_APP_THEME_ID = 'duel_scope_midnight';

export const CANONICAL_THEME_IDS = [
  'duel_scope_midnight',
  'dialga_shiny_midnight',
  'umbreon_shiny_oled',
  'giratina_distortion',
  'shadow_mewtwo_violet',
  'rayquaza_emerald_oled',
  'mimikyu_twilight',
  'instinct_dark',
  'valor_dark',
  'mystic_light',
  'sylveon_pink'
] as const;

export function normalizeAppThemeId(raw?: string | null): string {
  const clean = String(raw || '').trim();
  if (!clean) return DEFAULT_APP_THEME_ID;
  if (clean === 'amoled_cyan' || clean === 'amoled_matrix' || clean === 'slate') {
    return DEFAULT_APP_THEME_ID;
  }
  if (clean === 'instinct_light') return 'instinct_dark';
  if (clean === 'valor_light') return 'valor_dark';
  if (clean === 'mystic_dark') return 'mystic_light';
  if (clean === 'sylveon_light') return 'sylveon_pink';
  return WEB_APP_THEMES.some((t) => t.id === clean) ? clean : DEFAULT_APP_THEME_ID;
}

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
  ctaTextHex: string;
  ctaSecondaryTextHex: string;
  overlayBgRgb: string;
  overlayBorderRgb: string;
  overlayHeaderRgb: string;
  emblemType:
    | 'duel_scope'
    | 'dialga'
    | 'umbreon'
    | 'giratina'
    | 'mewtwo'
    | 'rayquaza'
    | 'mimikyu'
    | 'instinct'
    | 'valor'
    | 'mystic'
    | 'sylveon';
  watermarkAlpha: number;
}

export const WEB_APP_THEMES: WebAppThemePalette[] = [
  {
    id: 'duel_scope_midnight',
    name: '⚔️ Duel Scope Midnight Black (Default)',
    description:
      'Universal Default • True OLED Midnight (#050810) with Left Duel Arc Cyan (#38BDF8), Solar Gold (#FACC15) & Transparent HUD Constellation Watermark',
    isLight: false,
    bgHex: '#050810',
    cardHex: '#0B1526',
    cardAltHex: '#070D19',
    borderHex: '#1E293B',
    accentHex: '#38BDF8',
    accentSecondaryHex: '#FACC15',
    textPrimaryHex: '#F8FAFC',
    textSecondaryHex: '#94A3B8',
    ctaTextHex: '#050810',
    ctaSecondaryTextHex: '#050810',
    overlayBgRgb: '5, 8, 16',
    overlayBorderRgb: '56, 189, 248',
    overlayHeaderRgb: '56, 189, 248',
    emblemType: 'duel_scope',
    watermarkAlpha: 0.22
  },
  {
    id: 'dialga_shiny_midnight',
    name: '✨ Shiny Origin Dialga Midnight (Dark)',
    description:
      'Shiny Origin Forme Dialga ✨ • Deep temporal void (#050B16) with Luminous Teal (#2DD4BF), Astral Ring Gold (#FACC15) & Origin HUD Reticle',
    isLight: false,
    bgHex: '#050B16',
    cardHex: '#0E1B2E',
    cardAltHex: '#081120',
    borderHex: '#19304E',
    accentHex: '#2DD4BF',
    accentSecondaryHex: '#FACC15',
    textPrimaryHex: '#ECFEFF',
    textSecondaryHex: '#99F6E4',
    ctaTextHex: '#050810',
    ctaSecondaryTextHex: '#050810',
    overlayBgRgb: '5, 11, 22',
    overlayBorderRgb: '45, 212, 191',
    overlayHeaderRgb: '45, 212, 191',
    emblemType: 'dialga',
    watermarkAlpha: 0.22
  },
  {
    id: 'umbreon_shiny_oled',
    name: '🌙 Shiny Umbreon OLED (Dark)',
    description:
      'Pure #000000 OLED Black with glowing Shiny Umbreon Electric-Cyan Rings (#38BDF8), Crimson Highlights (#FB7185) & Lunar HUD Reticle',
    isLight: false,
    bgHex: '#000000',
    cardHex: '#0A0F1A',
    cardAltHex: '#05080F',
    borderHex: '#1B2A41',
    accentHex: '#38BDF8',
    accentSecondaryHex: '#FB7185',
    textPrimaryHex: '#F1F5F9',
    textSecondaryHex: '#93C5FD',
    ctaTextHex: '#050810',
    ctaSecondaryTextHex: '#050810',
    overlayBgRgb: '2, 5, 10',
    overlayBorderRgb: '56, 189, 248',
    overlayHeaderRgb: '56, 189, 248',
    emblemType: 'umbreon',
    watermarkAlpha: 0.22
  },
  {
    id: 'giratina_distortion',
    name: '👁️ Giratina Distortion Void (Dark)',
    description:
      'Origin Distortion World • Ultraviolet Obsidian (#09050B) with Distortion Crimson (#FB7185), Sovereign Gold (#FBBF24) & Wing Reticle',
    isLight: false,
    bgHex: '#09050B',
    cardHex: '#160D1C',
    cardAltHex: '#0F0814',
    borderHex: '#3B1D4A',
    accentHex: '#FB7185',
    accentSecondaryHex: '#FBBF24',
    textPrimaryHex: '#FAF5FF',
    textSecondaryHex: '#D8B4FE',
    ctaTextHex: '#050810',
    ctaSecondaryTextHex: '#050810',
    overlayBgRgb: '12, 6, 16',
    overlayBorderRgb: '251, 113, 133',
    overlayHeaderRgb: '251, 113, 133',
    emblemType: 'giratina',
    watermarkAlpha: 0.22
  },
  {
    id: 'shadow_mewtwo_violet',
    name: '🔮 Shadow Mewtwo Violet (Dark)',
    description:
      'Shadow Aura Violet • Deep Psychic Void (#080510) with Shadow Violet (#C084FC), Psystrike Cyan (#38BDF8) & Psychic Helix Reticle',
    isLight: false,
    bgHex: '#080510',
    cardHex: '#130C24',
    cardAltHex: '#0C0718',
    borderHex: '#311B5C',
    accentHex: '#C084FC',
    accentSecondaryHex: '#38BDF8',
    textPrimaryHex: '#F5F3FF',
    textSecondaryHex: '#C4B5FD',
    ctaTextHex: '#050810',
    ctaSecondaryTextHex: '#050810',
    overlayBgRgb: '10, 6, 20',
    overlayBorderRgb: '192, 132, 252',
    overlayHeaderRgb: '192, 132, 252',
    emblemType: 'mewtwo',
    watermarkAlpha: 0.22
  },
  {
    id: 'rayquaza_emerald_oled',
    name: '🐉 Shiny Rayquaza Obsidian (Dark)',
    description:
      'Black Mega Scales • Deep Emerald OLED (#030A07) with Luminous Emerald (#34D399), Delta Gold (#FACC15) & Sky-Delta Reticle',
    isLight: false,
    bgHex: '#030A07',
    cardHex: '#0A1A13',
    cardAltHex: '#06110C',
    borderHex: '#183D2C',
    accentHex: '#34D399',
    accentSecondaryHex: '#FACC15',
    textPrimaryHex: '#ECFDF5',
    textSecondaryHex: '#A7F3D0',
    ctaTextHex: '#050810',
    ctaSecondaryTextHex: '#050810',
    overlayBgRgb: '4, 14, 10',
    overlayBorderRgb: '52, 211, 153',
    overlayHeaderRgb: '52, 211, 153',
    emblemType: 'rayquaza',
    watermarkAlpha: 0.22
  },
  {
    id: 'mimikyu_twilight',
    name: '🎭 Mimikyu Twilight (Dark)',
    description:
      'Disguise Twilight • Warm Charcoal (#0B0908) with Ragged Gold (#FDE047), Spectral Lavender (#A78BFA) & Disguise Reticle',
    isLight: false,
    bgHex: '#0B0908',
    cardHex: '#181411',
    cardAltHex: '#110E0C',
    borderHex: '#3B3126',
    accentHex: '#FDE047',
    accentSecondaryHex: '#A78BFA',
    textPrimaryHex: '#FEFCE8',
    textSecondaryHex: '#D6CFC4',
    ctaTextHex: '#050810',
    ctaSecondaryTextHex: '#050810',
    overlayBgRgb: '14, 11, 9',
    overlayBorderRgb: '253, 224, 71',
    overlayHeaderRgb: '253, 224, 71',
    emblemType: 'mimikyu',
    watermarkAlpha: 0.22
  },
  {
    id: 'instinct_dark',
    name: '⚡ Team Instinct Storm (Dark)',
    description:
      'Pokémon GO Instinct • Thunder Charcoal (#0F0D06) with Zapdos Lightning Gold (#FACC15), Storm Cyan (#38BDF8) & HUD Crest',
    isLight: false,
    bgHex: '#0F0D06',
    cardHex: '#1A1609',
    cardAltHex: '#120F06',
    borderHex: '#3D3210',
    accentHex: '#FACC15',
    accentSecondaryHex: '#38BDF8',
    textPrimaryHex: '#FEFCE8',
    textSecondaryHex: '#FDE047',
    ctaTextHex: '#050810',
    ctaSecondaryTextHex: '#050810',
    overlayBgRgb: '18, 14, 4',
    overlayBorderRgb: '250, 204, 21',
    overlayHeaderRgb: '250, 204, 21',
    emblemType: 'instinct',
    watermarkAlpha: 0.22
  },
  {
    id: 'valor_dark',
    name: '🔥 Team Valor Inferno (Dark)',
    description:
      'Pokémon GO Valor • Smoldering Obsidian (#160709) with Moltres Rose-Crimson (#FB7185), Phoenix Gold (#FBBF24) & HUD Crest',
    isLight: false,
    bgHex: '#160709',
    cardHex: '#240C10',
    cardAltHex: '#1B080C',
    borderHex: '#4C111B',
    accentHex: '#FB7185',
    accentSecondaryHex: '#FBBF24',
    textPrimaryHex: '#FEF2F2',
    textSecondaryHex: '#FCA5A5',
    ctaTextHex: '#050810',
    ctaSecondaryTextHex: '#050810',
    overlayBgRgb: '24, 7, 12',
    overlayBorderRgb: '251, 113, 133',
    overlayHeaderRgb: '251, 113, 133',
    emblemType: 'valor',
    watermarkAlpha: 0.22
  },
  {
    id: 'mystic_light',
    name: '❄️ Team Mystic Glacier (Light)',
    description:
      'Pokémon GO Mystic Daylight • Crisp Ice White (#F0F7FF) with WCAG-AA Glacier Cobalt (#0369A1), Royal Indigo (#6D28D9) & Frost HUD Reticle',
    isLight: true,
    bgHex: '#F0F7FF',
    cardHex: '#FFFFFF',
    cardAltHex: '#E0F2FE',
    borderHex: '#7DD3FC',
    accentHex: '#0369A1',
    accentSecondaryHex: '#6D28D9',
    textPrimaryHex: '#0F172A',
    textSecondaryHex: '#334155',
    ctaTextHex: '#FFFFFF',
    ctaSecondaryTextHex: '#FFFFFF',
    overlayBgRgb: '8, 18, 38',
    overlayBorderRgb: '56, 189, 248',
    overlayHeaderRgb: '56, 189, 248',
    emblemType: 'mystic',
    watermarkAlpha: 0.18
  },
  {
    id: 'sylveon_pink',
    name: '🎀 Sylveon Fairy Ribbon (Light)',
    description:
      'Sylveon Daylight • Pastel Blush (#FFF0F6) with WCAG-AA Deep Berry Rose (#BE185D), Deep Sky Cobalt (#0369A1) & Ribbon HUD Reticle',
    isLight: true,
    bgHex: '#FFF0F6',
    cardHex: '#FFFFFF',
    cardAltHex: '#FCE7F3',
    borderHex: '#F472B6',
    accentHex: '#BE185D',
    accentSecondaryHex: '#0369A1',
    textPrimaryHex: '#3B0724',
    textSecondaryHex: '#701A45',
    ctaTextHex: '#FFFFFF',
    ctaSecondaryTextHex: '#FFFFFF',
    overlayBgRgb: '27, 11, 22',
    overlayBorderRgb: '244, 114, 182',
    overlayHeaderRgb: '244, 114, 182',
    emblemType: 'sylveon',
    watermarkAlpha: 0.18
  }
];

function renderDuelScopeSvgCore(gradPrefix: string, styleObj: React.CSSProperties, className?: string) {
  const lId = gradPrefix + 'L';
  const rId = gradPrefix + 'R';
  return (
    <svg viewBox="0 0 108 108" style={styleObj} className={className}>
      <defs>
        <linearGradient id={lId} x1="25" y1="83" x2="38" y2="21" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#38BDF8" />
          <stop offset="100%" stopColor="#2563EB" />
        </linearGradient>
        <linearGradient id={rId} x1="70" y1="21" x2="78" y2="81" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FACC15" />
          <stop offset="55%" stopColor="#F97316" />
          <stop offset="100%" stopColor="#EF4444" />
        </linearGradient>
      </defs>
      <circle cx="54" cy="54" r="36" fill="#0B1526" stroke="#1E293B" strokeWidth="2" />
      <path d="M33,83.3 A36,36 0 0,1 38,21.8" fill="none" stroke={'url(#' + lId + ')'} strokeWidth="6.2" strokeLinecap="round" />
      <path d="M70,21.8 A36,36 0 0,1 77.5,81" fill="none" stroke={'url(#' + rId + ')'} strokeWidth="6.2" strokeLinecap="round" />
      <path d="M47,14 L61,25 M61,14 L47,25" stroke="#FACC15" strokeWidth="3" strokeLinecap="round" />
      <circle cx="54" cy="19.5" r="1.6" fill="#FEF08A" />
      <circle cx="40.5" cy="19.5" r="2.6" fill="#38BDF8" />
      <circle cx="67.5" cy="19.5" r="2.6" fill="#EF4444" />
      <rect x="37.6" y="37.6" width="9.2" height="9.2" rx="2.4" fill="#22C55E" />
      <rect x="49.4" y="37.6" width="9.2" height="9.2" rx="2.4" fill="#22C55E" />
      <rect x="61.2" y="37.6" width="9.2" height="9.2" rx="2.4" fill="#EF4444" />
      <rect x="37.6" y="49.4" width="9.2" height="9.2" rx="2.4" fill="#22C55E" />
      <rect x="49.4" y="49.4" width="9.2" height="9.2" rx="2.4" fill="#EF4444" />
      <rect x="61.2" y="49.4" width="9.2" height="9.2" rx="2.4" fill="#EF4444" />
      <rect x="37.6" y="61.2" width="9.2" height="9.2" rx="2.4" fill="#38BDF8" />
      <rect x="49.4" y="61.2" width="9.2" height="9.2" rx="2.4" fill="#475569" />
      <rect x="61.2" y="61.2" width="9.2" height="9.2" rx="2.4" fill="#475569" />
      <path d="M54,85 L58.5,87.5 L58.5,91.5 L54,94.5 L49.5,91.5 L49.5,87.5 Z" fill="#0E2038" stroke="#38BDF8" strokeWidth="1.6" strokeLinejoin="round" />
      <circle cx="76.5" cy="80.5" r="6.6" fill="#DC2626" stroke="#FCA5A5" strokeWidth="1.8" />
      <circle cx="76.5" cy="80.5" r="2.2" fill="#FFFFFF" />
    </svg>
  );
}

export function renderThemeOverlayIcon(themeId: string, sizePx: number = 14) {
  const normId = normalizeAppThemeId(themeId);
  const s = sizePx + 'px';
  const styleObj: React.CSSProperties = { width: s, height: s, display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 };
  if (normId === 'duel_scope_midnight') {
    return renderDuelScopeSvgCore('ss2bIco', styleObj);
  }
  if (normId === 'dialga_shiny_midnight') {
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
  if (normId === 'umbreon_shiny_oled') {
    return (
      <svg viewBox="0 0 240 240" style={styleObj}>
        <circle cx="120" cy="120" r="88" fill="#05080F" stroke="#38BDF8" strokeWidth="18" />
        <circle cx="120" cy="120" r="56" fill="none" stroke="#38BDF8" strokeWidth="10" strokeDasharray="36 16" />
        <path fill="#FB7185" d="M74,116 Q96,102 114,118 Q94,132 74,116 Z M166,116 Q144,102 126,118 Q146,132 166,116 Z" />
        <circle cx="120" cy="64" r="14" fill="none" stroke="#38BDF8" strokeWidth="8" />
      </svg>
    );
  }
  if (normId === 'giratina_distortion') {
    return (
      <svg viewBox="0 0 240 240" style={styleObj}>
        <path fill="#160D1C" stroke="#FB7185" strokeWidth="10" d="M120,18 L188,62 L176,164 L120,222 L64,164 L52,62 Z" />
        <path fill="#FB7185" d="M32,54 L88,92 L72,134 L18,108 Z M208,54 L152,92 L168,134 L222,108 Z" />
        <path fill="none" stroke="#FBBF24" strokeWidth="12" d="M76,78 Q120,44 164,78 M82,126 Q120,104 158,126 M92,172 Q120,154 148,172" />
        <polygon points="120,66 138,94 120,122 102,94" fill="#FBBF24" />
      </svg>
    );
  }
  if (normId === 'shadow_mewtwo_violet') {
    return (
      <svg viewBox="0 0 240 240" style={styleObj}>
        <path fill="none" stroke="#C084FC" strokeWidth="14" d="M46,158 C34,104 68,46 120,34 C172,46 206,104 194,158 C184,196 146,216 120,216 C94,216 56,196 46,158 Z" />
        <path fill="#A855F7" d="M120,44 L152,86 L136,154 L120,192 L104,154 L88,86 Z" />
        <circle cx="120" cy="112" r="24" fill="#38BDF8" stroke="#F5F3FF" strokeWidth="6" />
      </svg>
    );
  }
  if (normId === 'rayquaza_emerald_oled') {
    return (
      <svg viewBox="0 0 240 240" style={styleObj}>
        <polygon points="120,16 218,186 22,186" fill="#0A1A13" stroke="#34D399" strokeWidth="12" strokeLinejoin="round" />
        <polygon points="120,56 178,160 62,160" fill="none" stroke="#FACC15" strokeWidth="10" strokeLinejoin="round" />
        <circle cx="120" cy="128" r="20" fill="#34D399" />
      </svg>
    );
  }
  if (normId === 'mimikyu_twilight') {
    return (
      <svg viewBox="0 0 240 240" style={styleObj}>
        <path fill="#181411" stroke="#FDE047" strokeWidth="10" d="M84,82 L46,26 L98,58 L142,58 L194,26 L156,82 L174,178 L120,206 L66,178 Z" />
        <path fill="none" stroke="#A78BFA" strokeWidth="11" strokeLinecap="round" d="M86,112 L104,130 M104,112 L86,130 M136,112 L154,130 M154,112 L136,130" />
        <path fill="none" stroke="#FDE047" strokeWidth="9" strokeLinecap="round" d="M90,156 L105,146 L120,158 L135,146 L150,156" />
      </svg>
    );
  }
  if (normId === 'instinct_dark') {
    return (
      <svg viewBox="0 0 240 240" style={styleObj}>
        <path fill="#FACC15" d="M120,8 L224,120 L120,232 L16,120 Z M120,28 L36,120 L120,212 L204,120 Z" />
        <path fill="#F59E0B" d="M120,44 L132,78 L168,52 L152,92 L206,72 L168,114 L218,110 L166,138 L198,162 L148,154 L164,192 L128,166 L120,212 L112,166 L76,192 L92,154 L42,162 L74,138 L22,110 L72,114 L34,72 L88,92 L72,52 L108,78 Z" />
      </svg>
    );
  }
  if (normId === 'mystic_light') {
    return (
      <svg viewBox="0 0 240 240" style={styleObj}>
        <path fill="#0369A1" d="M120,10 L208,58 L208,162 L120,230 L32,162 L32,58 Z M120,28 L48,68 L48,152 L120,210 L192,152 L192,68 Z" />
        <path fill="#38BDF8" d="M120,56 L134,82 L192,62 L164,112 L202,122 L152,144 L168,176 L132,160 L120,222 L108,160 L72,176 L88,144 L38,122 L76,112 L48,62 L106,82 Z" />
      </svg>
    );
  }
  if (normId === 'valor_dark') {
    return (
      <svg viewBox="0 0 240 240" style={styleObj}>
        <path fill="#FB7185" d="M120,12 C168,46 212,92 212,144 C212,190 172,226 120,232 C68,226 28,190 28,144 C28,92 72,46 120,12 Z M120,34 C82,62 48,100 48,144 C48,180 78,208 120,214 C162,208 192,180 192,144 C192,100 158,62 120,34 Z" />
        <path fill="#FBBF24" d="M120,42 L134,68 L156,52 L148,86 L198,64 L172,108 L206,102 L168,136 L192,158 L148,154 L162,188 L128,170 L120,214 L112,170 L78,188 L92,154 L48,158 L72,136 L34,102 L68,108 L42,64 L92,86 L84,52 L106,68 Z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 240 240" style={styleObj}>
      <path fill="#0369A1" d="M96,126 C76,154 48,176 26,198 L44,206 C66,186 90,164 108,138 Z M144,126 C164,154 192,176 214,198 L196,206 C174,186 150,164 132,138 Z" />
      <path fill="#BE185D" d="M112,108 C84,72 42,66 30,92 C18,118 48,148 112,124 Z M128,108 C156,72 198,66 210,92 C222,118 192,148 128,124 Z" />
      <circle cx="120" cy="118" r="24" fill="#F472B6" />
      <path fill="#0369A1" d="M120,24 L127,44 L147,51 L127,58 L120,78 L113,58 L93,51 L113,44 Z" />
    </svg>
  );
}

/**
 * Renders a transparent-HUD-reticle-framed vector watermark for the active theme.
 * Surrounds every emblem with translucent glass viewfinder brackets and tactical scope rings
 * to convey SilphScope PvP's transparent overlay identity; for duel_scope_midnight,
 * encircles the central 2B Duel Scope with miniature emblems from all 10 sibling themes.
 */
export function renderThemeWatermarkSvg(themeId: string, className: string = 'w-[440px] h-[440px]') {
  const normId = normalizeAppThemeId(themeId);
  const theme = WEB_APP_THEMES.find((t) => t.id === normId) || WEB_APP_THEMES[0];
  const frameStroke = theme.accentHex;
  const frameAltStroke = theme.accentSecondaryHex;

  const hudReticleFrame = (
    <g>
      <circle cx="120" cy="120" r="108" fill={frameStroke} fillOpacity="0.045" stroke={frameStroke} strokeOpacity="0.24" strokeWidth="1.2" strokeDasharray="5 5" />
      <circle cx="120" cy="120" r="78" fill="none" stroke={frameAltStroke} strokeOpacity="0.18" strokeWidth="1" strokeDasharray="3 6" />
      <path
        fill="none"
        stroke={frameStroke}
        strokeOpacity="0.48"
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M14,38 L14,14 L38,14 M202,14 L226,14 L226,38 M14,202 L14,226 L38,226 M202,226 L226,226 L226,202"
      />
      <path
        stroke={frameAltStroke}
        strokeOpacity="0.32"
        strokeWidth="1.5"
        strokeLinecap="round"
        d="M120,4 L120,16 M120,224 L120,236 M4,120 L16,120 M224,120 L236,120"
      />
    </g>
  );

  if (normId === 'duel_scope_midnight') {
    return (
      <svg viewBox="0 0 240 240" className={className}>
        <defs>
          <linearGradient id="wmDsL" x1="25" y1="83" x2="38" y2="21" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#38BDF8" />
            <stop offset="100%" stopColor="#2563EB" />
          </linearGradient>
          <linearGradient id="wmDsR" x1="70" y1="21" x2="78" y2="81" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FACC15" />
            <stop offset="55%" stopColor="#F97316" />
            <stop offset="100%" stopColor="#EF4444" />
          </linearGradient>
        </defs>
        {hudReticleFrame}
        <circle cx="120" cy="120" r="93" fill="none" stroke="#38BDF8" strokeOpacity="0.22" strokeWidth="1.2" strokeDasharray="4 4" />
        <g transform="translate(120,27)">
          <circle r="11.5" fill="#050B16" fillOpacity="0.82" stroke="#2DD4BF" strokeOpacity="0.7" strokeWidth="1.1" />
          <polygon points="0,-7 6,0 0,7 -6,0" fill="#2DD4BF" stroke="#FACC15" strokeWidth="1.2" />
        </g>
        <g transform="translate(174.7,44.8)">
          <circle r="11.5" fill="#000000" fillOpacity="0.82" stroke="#38BDF8" strokeOpacity="0.7" strokeWidth="1.1" />
          <circle r="5.5" fill="none" stroke="#38BDF8" strokeWidth="2.1" />
          <circle r="1.8" fill="#FB7185" />
        </g>
        <g transform="translate(208.4,91.3)">
          <circle r="11.5" fill="#09050B" fillOpacity="0.82" stroke="#FB7185" strokeOpacity="0.7" strokeWidth="1.1" />
          <path d="M-6,-4 L0,-1 L6,-4 L4,5 L0,2 L-4,5 Z" fill="#FB7185" />
          <polygon points="0,-6 2.5,-2 0,2 -2.5,-2" fill="#FBBF24" />
        </g>
        <g transform="translate(208.4,148.7)">
          <circle r="11.5" fill="#080510" fillOpacity="0.82" stroke="#C084FC" strokeOpacity="0.7" strokeWidth="1.1" />
          <path d="M-5,4 C-6,-4 0,-7 0,-7 C0,-7 6,-4 5,4" fill="none" stroke="#C084FC" strokeWidth="2.2" />
          <circle cx="0" cy="0" r="2.6" fill="#38BDF8" />
        </g>
        <g transform="translate(174.7,195.2)">
          <circle r="11.5" fill="#030A07" fillOpacity="0.82" stroke="#34D399" strokeOpacity="0.7" strokeWidth="1.1" />
          <polygon points="0,-6.5 6.5,5.5 -6.5,5.5" fill="none" stroke="#34D399" strokeWidth="2" strokeLinejoin="round" />
          <circle cx="0" cy="1.5" r="2" fill="#FACC15" />
        </g>
        <g transform="translate(120,213)">
          <circle r="11.5" fill="#0B0908" fillOpacity="0.82" stroke="#FDE047" strokeOpacity="0.7" strokeWidth="1.1" />
          <path d="M-4,-1 L-6,-7 L-1,-3 L1,-3 L6,-7 L4,-1 L5,6 L-5,6 Z" fill="#FDE047" />
          <circle cx="-2" cy="1.5" r="1" fill="#0B0908" />
          <circle cx="2" cy="1.5" r="1" fill="#0B0908" />
        </g>
        <g transform="translate(65.3,195.2)">
          <circle r="11.5" fill="#0F0D06" fillOpacity="0.82" stroke="#FACC15" strokeOpacity="0.7" strokeWidth="1.1" />
          <polygon points="1,-7 -4,1 0,1 -1,7 4,-1 0,-1" fill="#FACC15" />
        </g>
        <g transform="translate(31.6,148.7)">
          <circle r="11.5" fill="#160709" fillOpacity="0.82" stroke="#FB7185" strokeOpacity="0.7" strokeWidth="1.1" />
          <path d="M0,-7 C4,-3 5,2 0,7 C-5,2 -4,-3 0,-7 Z" fill="#FB7185" />
          <circle cx="0" cy="2" r="2" fill="#FBBF24" />
        </g>
        <g transform="translate(31.6,91.3)">
          <circle r="11.5" fill="#060D1A" fillOpacity="0.82" stroke="#38BDF8" strokeOpacity="0.7" strokeWidth="1.1" />
          <polygon points="0,-6.5 5.5,-3 5.5,3 0,6.5 -5.5,3 -5.5,-3" fill="none" stroke="#38BDF8" strokeWidth="2" />
          <circle cx="0" cy="0" r="2.2" fill="#6D28D9" />
        </g>
        <g transform="translate(65.3,44.8)">
          <circle r="11.5" fill="#1B0B16" fillOpacity="0.82" stroke="#F472B6" strokeOpacity="0.7" strokeWidth="1.1" />
          <path d="M0,0 L-6,-4 L-6,4 Z M0,0 L6,-4 L6,4 Z" fill="#EC4899" />
          <circle cx="0" cy="0" r="2.2" fill="#38BDF8" />
        </g>
        <g transform="translate(55,55) scale(1.2037)">
          <circle cx="54" cy="54" r="36" fill="#0B1526" stroke="#1E293B" strokeWidth="2" />
          <path d="M33,83.3 A36,36 0 0,1 38,21.8" fill="none" stroke="url(#wmDsL)" strokeWidth="6.2" strokeLinecap="round" />
          <path d="M70,21.8 A36,36 0 0,1 77.5,81" fill="none" stroke="url(#wmDsR)" strokeWidth="6.2" strokeLinecap="round" />
          <path d="M47,14 L61,25 M61,14 L47,25" stroke="#FACC15" strokeWidth="3" strokeLinecap="round" />
          <circle cx="54" cy="19.5" r="1.6" fill="#FEF08A" />
          <circle cx="40.5" cy="19.5" r="2.6" fill="#38BDF8" />
          <circle cx="67.5" cy="19.5" r="2.6" fill="#EF4444" />
          <rect x="37.6" y="37.6" width="9.2" height="9.2" rx="2.4" fill="#22C55E" />
          <rect x="49.4" y="37.6" width="9.2" height="9.2" rx="2.4" fill="#22C55E" />
          <rect x="61.2" y="37.6" width="9.2" height="9.2" rx="2.4" fill="#EF4444" />
          <rect x="37.6" y="49.4" width="9.2" height="9.2" rx="2.4" fill="#22C55E" />
          <rect x="49.4" y="49.4" width="9.2" height="9.2" rx="2.4" fill="#EF4444" />
          <rect x="61.2" y="49.4" width="9.2" height="9.2" rx="2.4" fill="#EF4444" />
          <rect x="37.6" y="61.2" width="9.2" height="9.2" rx="2.4" fill="#38BDF8" />
          <rect x="49.4" y="61.2" width="9.2" height="9.2" rx="2.4" fill="#475569" />
          <rect x="61.2" y="61.2" width="9.2" height="9.2" rx="2.4" fill="#475569" />
          <path d="M54,85 L58.5,87.5 L58.5,91.5 L54,94.5 L49.5,91.5 L49.5,87.5 Z" fill="#0E2038" stroke="#38BDF8" strokeWidth="1.6" strokeLinejoin="round" />
          <circle cx="76.5" cy="80.5" r="6.6" fill="#DC2626" stroke="#FCA5A5" strokeWidth="1.8" />
          <circle cx="76.5" cy="80.5" r="2.2" fill="#FFFFFF" />
        </g>
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 240 240" className={className}>
      {hudReticleFrame}
      <g transform="translate(30,30) scale(0.75)">
        {normId === 'dialga_shiny_midnight' && (
          <>
            <path fill="none" stroke="#2DD4BF" strokeWidth="8" d="M120,10 L196,42 L228,120 L196,198 L120,230 L44,198 L12,120 L44,42 Z" />
            <path fill="none" stroke="#FACC15" strokeWidth="9" d="M120,44 L178,76 L178,164 L120,196 L62,164 L62,76 Z" />
            <path fill="#FACC15" d="M62,76 L22,52 L48,92 Z M178,76 L218,52 L192,92 Z M56,120 L14,120 L56,132 Z M184,120 L226,120 L184,132 Z M62,164 L26,188 L54,148 Z M178,164 L214,188 L186,148 Z" />
            <path fill="#14B8A6" stroke="#67E8F9" strokeWidth="5" d="M120,14 L138,48 L156,32 L144,76 L186,98 L152,134 L168,188 L142,174 L120,224 L98,174 L72,188 L88,134 L54,98 L96,76 L84,32 L102,48 Z" />
            <path fill="#081224" stroke="#FACC15" strokeWidth="7" d="M120,84 L152,120 L120,156 L88,120 Z" />
            <path fill="#67E8F9" d="M120,96 L140,120 L120,144 L100,120 Z" />
          </>
        )}
        {normId === 'umbreon_shiny_oled' && (
          <>
            <circle cx="120" cy="120" r="88" fill="#05080F" stroke="#38BDF8" strokeWidth="14" />
            <circle cx="120" cy="120" r="56" fill="none" stroke="#38BDF8" strokeWidth="8" strokeDasharray="32 14" />
            <path fill="#FB7185" d="M74,116 Q96,102 114,118 Q94,132 74,116 Z M166,116 Q144,102 126,118 Q146,132 166,116 Z" />
            <circle cx="120" cy="60" r="16" fill="none" stroke="#38BDF8" strokeWidth="7" />
          </>
        )}
        {normId === 'giratina_distortion' && (
          <>
            <path fill="#160D1C" stroke="#FB7185" strokeWidth="8" d="M120,18 L188,62 L176,164 L120,222 L64,164 L52,62 Z" />
            <path fill="#FB7185" d="M24,48 L88,92 L72,136 L14,106 Z M216,48 L152,92 L168,136 L226,106 Z" />
            <path fill="none" stroke="#FBBF24" strokeWidth="10" d="M76,78 Q120,44 164,78 M82,126 Q120,104 158,126 M92,172 Q120,154 148,172" />
            <polygon points="120,66 138,94 120,122 102,94" fill="#FBBF24" />
          </>
        )}
        {normId === 'shadow_mewtwo_violet' && (
          <>
            <path fill="none" stroke="#C084FC" strokeWidth="12" d="M46,158 C34,104 68,46 120,34 C172,46 206,104 194,158 C184,196 146,216 120,216 C94,216 56,196 46,158 Z" />
            <path fill="#A855F7" d="M120,44 L152,86 L136,154 L120,192 L104,154 L88,86 Z" />
            <circle cx="120" cy="112" r="24" fill="#38BDF8" stroke="#F5F3FF" strokeWidth="6" />
          </>
        )}
        {normId === 'rayquaza_emerald_oled' && (
          <>
            <polygon points="120,16 218,186 22,186" fill="#0A1A13" stroke="#34D399" strokeWidth="10" strokeLinejoin="round" />
            <polygon points="120,56 178,160 62,160" fill="none" stroke="#FACC15" strokeWidth="8" strokeLinejoin="round" />
            <circle cx="120" cy="128" r="22" fill="#34D399" />
          </>
        )}
        {normId === 'mimikyu_twilight' && (
          <>
            <path fill="#181411" stroke="#FDE047" strokeWidth="8" d="M84,82 L46,26 L98,58 L142,58 L194,26 L156,82 L174,178 L120,206 L66,178 Z" />
            <path fill="none" stroke="#A78BFA" strokeWidth="10" strokeLinecap="round" d="M86,112 L104,130 M104,112 L86,130 M136,112 L154,130 M154,112 L136,130" />
            <path fill="none" stroke="#FDE047" strokeWidth="8" strokeLinecap="round" d="M90,156 L105,146 L120,158 L135,146 L150,156" />
          </>
        )}
        {normId === 'instinct_dark' && (
          <>
            <path fill="#FACC15" d="M120,8 L224,120 L120,232 L16,120 Z M120,28 L36,120 L120,212 L204,120 Z" />
            <path fill="#F59E0B" d="M120,44 L132,78 L168,52 L152,92 L206,72 L168,114 L218,110 L166,138 L198,162 L148,154 L164,192 L128,166 L120,212 L112,166 L76,192 L92,154 L42,162 L74,138 L22,110 L72,114 L34,72 L88,92 L72,52 L108,78 Z" />
          </>
        )}
        {normId === 'valor_dark' && (
          <>
            <path fill="#FB7185" d="M120,12 C168,46 212,92 212,144 C212,190 172,226 120,232 C68,226 28,190 28,144 C28,92 72,46 120,12 Z M120,34 C82,62 48,100 48,144 C48,180 78,208 120,214 C162,208 192,180 192,144 C192,100 158,62 120,34 Z" />
            <path fill="#FBBF24" d="M120,42 L134,68 L156,52 L148,86 L198,64 L172,108 L206,102 L168,136 L192,158 L148,154 L162,188 L128,170 L120,214 L112,170 L78,188 L92,154 L48,158 L72,136 L34,102 L68,108 L42,64 L92,86 L84,52 L106,68 Z" />
          </>
        )}
        {normId === 'mystic_light' && (
          <>
            <path fill="#0369A1" d="M120,10 L208,58 L208,162 L120,230 L32,162 L32,58 Z M120,28 L48,68 L48,152 L120,210 L192,152 L192,68 Z" />
            <path fill="#38BDF8" d="M120,56 L134,82 L192,62 L164,112 L202,122 L152,144 L168,176 L132,160 L120,222 L108,160 L72,176 L88,144 L38,122 L76,112 L48,62 L106,82 Z" />
          </>
        )}
        {normId === 'sylveon_pink' && (
          <>
            <path fill="#0369A1" d="M96,126 C76,154 48,176 26,198 L44,206 C66,186 90,164 108,138 Z M144,126 C164,154 192,176 214,198 L196,206 C174,186 150,164 132,138 Z" />
            <path fill="#BE185D" d="M112,108 C84,72 42,66 30,92 C18,118 48,148 112,124 Z M128,108 C156,72 198,66 210,92 C222,118 192,148 128,124 Z" />
            <circle cx="120" cy="118" r="24" fill="#F472B6" />
            <path fill="#0369A1" d="M120,24 L127,44 L147,51 L127,58 L120,78 L113,58 L93,51 L113,44 Z" />
          </>
        )}
      </g>
    </svg>
  );
}
