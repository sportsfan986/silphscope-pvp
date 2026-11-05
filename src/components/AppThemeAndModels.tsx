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
      aria-label="Battle Frontier Show 6 Emblem"
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

export function renderThemeOverlayIcon(themeId: string, sizePx: number = 14) {
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

