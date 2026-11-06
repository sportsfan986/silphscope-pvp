import { evaluateDiscreteShieldBattleRating } from "./combatSimulator";
import { getLeagueTopMetaSpeciesNames, type AntiMetaAltMovesetInfo } from "./teamAndMetaEngine";
import { syncLimitedMetaRankings } from "./show6Engine";

export interface FastMove {
  name: string;
  type: string;
  turns: number; // Duration in turns (1 turn = 0.5s)
  power: number;
  energyGain: number;
}

export interface ChargedMove {
  name: string;
  code: string;
  type: string;
  power: number;
  energyCost: number;
}

export interface PokemonStats {
  speciesId: string;
  name: string;
  baseSpecies?: string;
  formLabel?: string;
  types: string[];
  baseStats: { atk: number; def: number; hp: number };
  isRawBaseStats?: boolean;
  defaultIvsGl?: string;
  defaultIvsUl?: string;
  defaultFastMove: FastMove;
  chargedMoves: ChargedMove[];
  color: string;
}

export interface TeamMember {
  id: string;
  name: string;
  cp: number;
  fastMove: string;
  chargedMove1: string;
  chargedMove2: string;
  ivs?: string;
}

export type CoreLeagueType =
  | "MEGA MASTER LEAGUE"
  | "Mega Master League (10000)"
  | "MASTER LEAGUE"
  | "ULTRA LEAGUE"
  | "GREAT LEAGUE"
  | "BATTLE FRONTIER (SPECTRAL)"
  | "BATTLE FRONTIER (CAULDRON)"
  | "BATTLE FRONTIER (MASTER)"
  | "Battle Frontier (Spectral)"
  | "Battle Frontier (Cauldron)"
  | "Battle Frontier (Master)";

export type LeagueType = CoreLeagueType | (string & {});
export type TeamArchetype = "ABB" | "ABC" | "DUO";
export type LimitedMetaLifecycleStatus = "CURRENT" | "UPCOMING" | "RECENT";

export const FOUR_WEEKS_MS = 28 * 24 * 60 * 60 * 1000;

export interface LimitedMetaFormat {
  id: string;
  cup: string;
  cupKey: string;
  cp: 500 | 1500 | 2500 | 10000;
  title: string;
  label: string;
  status: LimitedMetaLifecycleStatus;
  lifecycle: LimitedMetaLifecycleStatus;
  rankingsUrl: string;
  isShow6Native?: boolean;
  allowMegas?: boolean;
  verifiedRankingsCount?: number;
  lastSeenAt: number;
}

export const GBL_LEAGUES: LeagueType[] = [
  "GREAT LEAGUE",
  "ULTRA LEAGUE",
  "MASTER LEAGUE"
];

export const SHOW6_LEAGUES: LeagueType[] = [
  "BATTLE FRONTIER (CAULDRON)",
  "BATTLE FRONTIER (MASTER)",
  "BATTLE FRONTIER (SPECTRAL)"
];

export const NOW_INIT_MS = Date.now();

export const DEFAULT_LIMITED_META_CATALOG: LimitedMetaFormat[] = [
  // CURRENT Battle Frontier Forced Show 6 Cups (ALL CAPS)
  {
    id: "BATTLE FRONTIER (CAULDRON)",
    cup: "cauldron",
    cupKey: "cauldron",
    cp: 2500,
    title: "BATTLE FRONTIER (CAULDRON)",
    label: "BATTLE FRONTIER (CAULDRON)",
    status: "CURRENT",
    lifecycle: "CURRENT",
    rankingsUrl: "https://raw.githubusercontent.com/pvpoke/pvpoke/master/src/data/rankings/cauldron/overall/rankings-2500.json",
    isShow6Native: true,
    allowMegas: true,
    lastSeenAt: NOW_INIT_MS
  },
  {
    id: "BATTLE FRONTIER (MASTER)",
    cup: "battlefrontiermaster",
    cupKey: "battlefrontiermaster",
    cp: 10000,
    title: "BATTLE FRONTIER (MASTER)",
    label: "BATTLE FRONTIER (MASTER)",
    status: "CURRENT",
    lifecycle: "CURRENT",
    rankingsUrl: "https://raw.githubusercontent.com/pvpoke/pvpoke/master/src/data/rankings/battlefrontiermaster/overall/rankings-10000.json",
    isShow6Native: true,
    allowMegas: true,
    lastSeenAt: NOW_INIT_MS
  },
  {
    id: "BATTLE FRONTIER (SPECTRAL)",
    cup: "spectral",
    cupKey: "spectral",
    cp: 1500,
    title: "BATTLE FRONTIER (SPECTRAL)",
    label: "BATTLE FRONTIER (SPECTRAL)",
    status: "CURRENT",
    lifecycle: "CURRENT",
    rankingsUrl: "https://raw.githubusercontent.com/pvpoke/pvpoke/master/src/data/rankings/spectral/overall/rankings-1500.json",
    isShow6Native: true,
    allowMegas: true,
    lastSeenAt: NOW_INIT_MS
  },
  // Mega Master League from PvPoke catalog data (PvPoke Title Case + CP)
  {
    id: "Mega Master League (10000)",
    cup: "mega",
    cupKey: "mega",
    cp: 10000,
    title: "Mega Master League",
    label: "Mega Master League (10000)",
    status: "CURRENT",
    lifecycle: "CURRENT",
    rankingsUrl: "https://raw.githubusercontent.com/pvpoke/pvpoke/master/src/data/rankings/mega/overall/rankings-10000.json",
    allowMegas: true,
    lastSeenAt: NOW_INIT_MS
  },
  // Optional Standard Open Leagues (available to download/pin in Show 6 if desired)
  {
    id: "Great League (1500)",
    cup: "all",
    cupKey: "all",
    cp: 1500,
    title: "Great League",
    label: "Great League (1500)",
    status: "CURRENT",
    lifecycle: "CURRENT",
    rankingsUrl: "https://raw.githubusercontent.com/pvpoke/pvpoke/master/src/data/rankings/all/overall/rankings-1500.json",
    lastSeenAt: NOW_INIT_MS
  },
  {
    id: "Ultra League (2500)",
    cup: "all",
    cupKey: "all",
    cp: 2500,
    title: "Ultra League",
    label: "Ultra League (2500)",
    status: "CURRENT",
    lifecycle: "CURRENT",
    rankingsUrl: "https://raw.githubusercontent.com/pvpoke/pvpoke/master/src/data/rankings/all/overall/rankings-2500.json",
    lastSeenAt: NOW_INIT_MS
  },
  {
    id: "Master League (10000)",
    cup: "all",
    cupKey: "all",
    cp: 10000,
    title: "Master League",
    label: "Master League (10000)",
    status: "CURRENT",
    lifecycle: "CURRENT",
    rankingsUrl: "https://raw.githubusercontent.com/pvpoke/pvpoke/master/src/data/rankings/all/overall/rankings-10000.json",
    lastSeenAt: NOW_INIT_MS
  },
  // CURRENT (Live in PvPoke gamemaster.json["formats"])
  {
    id: "LAIC 2027 Championship Series Cup (1500)",
    cup: "laic2027",
    cupKey: "laic2027",
    cp: 1500,
    title: "LAIC 2027 Championship Series Cup",
    label: "LAIC 2027 Championship Series Cup (1500)",
    status: "CURRENT",
    lifecycle: "CURRENT",
    rankingsUrl: "https://raw.githubusercontent.com/pvpoke/pvpoke/master/src/data/rankings/laic2027/overall/rankings-1500.json",
    isShow6Native: true,
    allowMegas: true,
    lastSeenAt: NOW_INIT_MS
  },
  {
    id: "Mega Halloween Cup (1500)",
    cup: "halloweenmega",
    cupKey: "halloweenmega",
    cp: 1500,
    title: "Mega Halloween Cup",
    label: "Mega Halloween Cup (1500)",
    status: "CURRENT",
    lifecycle: "CURRENT",
    rankingsUrl: "https://raw.githubusercontent.com/pvpoke/pvpoke/master/src/data/rankings/halloweenmega/overall/rankings-1500.json",
    allowMegas: true,
    lastSeenAt: NOW_INIT_MS
  },
  {
    id: "Fantasy Cup (1500)",
    cup: "fantasy",
    cupKey: "fantasy",
    cp: 1500,
    title: "Fantasy Cup",
    label: "Fantasy Cup (1500)",
    status: "CURRENT",
    lifecycle: "CURRENT",
    rankingsUrl: "https://raw.githubusercontent.com/pvpoke/pvpoke/master/src/data/rankings/fantasy/overall/rankings-1500.json",
    allowMegas: false,
    lastSeenAt: NOW_INIT_MS
  },
  {
    id: "Mega Great League (1500)",
    cup: "mega",
    cupKey: "mega",
    cp: 1500,
    title: "Mega Great League",
    label: "Mega Great League (1500)",
    status: "CURRENT",
    lifecycle: "CURRENT",
    rankingsUrl: "https://raw.githubusercontent.com/pvpoke/pvpoke/master/src/data/rankings/mega/overall/rankings-1500.json",
    allowMegas: true,
    lastSeenAt: NOW_INIT_MS
  },
  {
    id: "Mega Ultra League (2500)",
    cup: "mega",
    cupKey: "mega",
    cp: 2500,
    title: "Mega Ultra League",
    label: "Mega Ultra League (2500)",
    status: "CURRENT",
    lifecycle: "CURRENT",
    rankingsUrl: "https://raw.githubusercontent.com/pvpoke/pvpoke/master/src/data/rankings/mega/overall/rankings-2500.json",
    allowMegas: true,
    lastSeenAt: NOW_INIT_MS
  },
  {
    id: "Devon Trail Cup (1500)",
    cup: "trail",
    cupKey: "trail",
    cp: 1500,
    title: "Devon Trail Cup",
    label: "Devon Trail Cup (1500)",
    status: "CURRENT",
    lifecycle: "CURRENT",
    rankingsUrl: "https://raw.githubusercontent.com/pvpoke/pvpoke/master/src/data/rankings/trail/overall/rankings-1500.json",
    isShow6Native: true,
    allowMegas: false,
    lastSeenAt: NOW_INIT_MS
  },
  {
    id: "Devon Fable Cup (1500)",
    cup: "fable",
    cupKey: "fable",
    cp: 1500,
    title: "Devon Fable Cup",
    label: "Devon Fable Cup (1500)",
    status: "CURRENT",
    lifecycle: "CURRENT",
    rankingsUrl: "https://raw.githubusercontent.com/pvpoke/pvpoke/master/src/data/rankings/fable/overall/rankings-1500.json",
    isShow6Native: true,
    allowMegas: false,
    lastSeenAt: NOW_INIT_MS
  },
  {
    id: "Gymbreakers Invitational Season 7 (1500)",
    cup: "gymbreakers",
    cupKey: "gymbreakers",
    cp: 1500,
    title: "Gymbreakers Invitational Season 7",
    label: "Gymbreakers Invitational Season 7 (1500)",
    status: "CURRENT",
    lifecycle: "CURRENT",
    rankingsUrl: "https://raw.githubusercontent.com/pvpoke/pvpoke/master/src/data/rankings/gymbreakers/overall/rankings-1500.json",
    isShow6Native: true,
    allowMegas: false,
    lastSeenAt: NOW_INIT_MS
  },
  // RECENT (Within 4-week window by default)
  {
    id: "Mega Color Cup (1500)",
    cup: "colormega",
    cupKey: "colormega",
    cp: 1500,
    title: "Mega Color Cup",
    label: "Mega Color Cup (1500)",
    status: "RECENT",
    lifecycle: "RECENT",
    rankingsUrl: "https://raw.githubusercontent.com/pvpoke/pvpoke/master/src/data/rankings/colormega/overall/rankings-1500.json",
    allowMegas: true,
    lastSeenAt: NOW_INIT_MS - 14 * 86400_000
  },
  {
    id: "Halloween Cup (1500)",
    cup: "halloween",
    cupKey: "halloween",
    cp: 1500,
    title: "Halloween Cup",
    label: "Halloween Cup (1500)",
    status: "RECENT",
    lifecycle: "RECENT",
    rankingsUrl: "https://raw.githubusercontent.com/pvpoke/pvpoke/master/src/data/rankings/halloween/overall/rankings-1500.json",
    allowMegas: false,
    lastSeenAt: NOW_INIT_MS - 7 * 86400_000
  },
  {
    id: "Sunshine Cup (1500)",
    cup: "sunshine",
    cupKey: "sunshine",
    cp: 1500,
    title: "Sunshine Cup",
    label: "Sunshine Cup (1500)",
    status: "RECENT",
    lifecycle: "RECENT",
    rankingsUrl: "https://raw.githubusercontent.com/pvpoke/pvpoke/master/src/data/rankings/sunshine/overall/rankings-1500.json",
    allowMegas: false,
    lastSeenAt: NOW_INIT_MS - 18 * 86400_000
  },
  {
    id: "Little Cup (500)",
    cup: "little",
    cupKey: "little",
    cp: 500,
    title: "Little Cup",
    label: "Little Cup (500)",
    status: "RECENT",
    lifecycle: "RECENT",
    rankingsUrl: "https://raw.githubusercontent.com/pvpoke/pvpoke/master/src/data/rankings/little/overall/rankings-500.json",
    allowMegas: false,
    lastSeenAt: NOW_INIT_MS - 12 * 86400_000
  },
  {
    id: "Master League Premier (10000)",
    cup: "premier",
    cupKey: "premier",
    cp: 10000,
    title: "Master League Premier",
    label: "Master League Premier (10000)",
    status: "RECENT",
    lifecycle: "RECENT",
    rankingsUrl: "https://raw.githubusercontent.com/pvpoke/pvpoke/master/src/data/rankings/premier/overall/rankings-10000.json",
    allowMegas: false,
    lastSeenAt: NOW_INIT_MS - 10 * 86400_000
  }
];

export const LIMITED_META_CATALOG_STORAGE_KEY = "silphscope_pvpoke_limited_meta_catalog_v2";
export const PINNED_GBL_LIMITED_METAS_STORAGE_KEY = "silphscope_pinned_gbl_limited_metas_v1";
export const PINNED_SHOW6_LIMITED_METAS_STORAGE_KEY = "silphscope_pinned_show6_limited_metas_v1";
export const LIMITED_META_RANKINGS_CACHE_KEY = "silphscope_limited_meta_rankings_cache_v1";
export const LIMITED_META_SHEET_ALIASES_KEY = "silphscope_limited_meta_sheet_aliases_v1";

export function normalizeMetaFormatEntry(raw: Partial<LimitedMetaFormat>): LimitedMetaFormat {
  const cp: 500 | 1500 | 2500 | 10000 =
    raw.cp === 500 || raw.cp === 1500 || raw.cp === 2500 || raw.cp === 10000 ? raw.cp : 1500;
  const cup = (raw.cup || raw.cupKey || "custom").trim().toLowerCase();
  const title = (raw.title || cup).trim();
  const label = (raw.label || raw.id || `${title} (${cp})`).trim();
  const status: LimitedMetaLifecycleStatus =
    raw.status || raw.lifecycle || "RECENT";
  return {
    id: label,
    label,
    cup,
    cupKey: cup,
    cp,
    title,
    status,
    lifecycle: status,
    rankingsUrl:
      raw.rankingsUrl ||
      `https://raw.githubusercontent.com/pvpoke/pvpoke/master/src/data/rankings/${cup}/overall/rankings-${cp}.json`,
    isShow6Native: raw.isShow6Native,
    allowMegas: Boolean(raw.allowMegas),
    verifiedRankingsCount: raw.verifiedRankingsCount,
    lastSeenAt: typeof raw.lastSeenAt === "number" && raw.lastSeenAt > 0 ? raw.lastSeenAt : Date.now()
  };
}

export function isExpiredLimitedMeta(item: LimitedMetaFormat, nowMs: number = Date.now()): boolean {
  const st = item.status || item.lifecycle;
  if (st !== "RECENT") return false;
  const seen = item.lastSeenAt > 0 ? item.lastSeenAt : nowMs;
  return nowMs - seen > FOUR_WEEKS_MS;
}

export let DYNAMIC_LIMITED_META_CATALOG: LimitedMetaFormat[] = (() => {
  try {
    if (typeof localStorage !== "undefined") {
      const raw = localStorage.getItem(LIMITED_META_CATALOG_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const byLabel = new Map<string, LimitedMetaFormat>();
          for (const d of DEFAULT_LIMITED_META_CATALOG) byLabel.set(d.label, d);
          for (const p of parsed) {
            if (p && (typeof p.label === "string" || typeof p.id === "string")) {
              const norm = normalizeMetaFormatEntry(p);
              byLabel.set(norm.label, norm);
            }
          }
          return Array.from(byLabel.values());
        }
      }
    }
  } catch {
    // ignore
  }
  return [...DEFAULT_LIMITED_META_CATALOG];
})();

export function toPvPokeTitleCase(raw: string): string {
  const cleaned = (raw || "").trim().replace(/\s*\(\d+\)\s*$/, "").trim();
  if (!cleaned) return "";
  const acronyms = new Set(["LAIC", "EUIC", "NAIC", "WCS", "GBL", "GO", "PVP", "CP", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"]);
  return cleaned
    .split(/\s+/)
    .map((word) => {
      if (!word) return word;
      const upper = word.toUpperCase();
      if (acronyms.has(upper)) return upper;
      if (word.startsWith("(") && word.endsWith(")") && word.length > 2) {
        const inner = word.slice(1, -1);
        return `(${inner.charAt(0).toUpperCase()}${inner.slice(1).toLowerCase()})`;
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}

export function isBattleFrontierCupTitle(rawTitleOrLabel: string, cupSlug = ""): boolean {
  const t = (rawTitleOrLabel || "").toLowerCase();
  const c = (cupSlug || "").toLowerCase();
  return (
    t.includes("battle frontier") ||
    c.includes("battlefrontier") ||
    c === "cauldron" ||
    c === "spectral"
  );
}

/**
 * v6.05: Returns true ONLY for the currently active Battle Frontier Show 6 formats:
 * - Spectral (1500 CP)
 * - Cauldron (2500 CP)
 * - Master (10000 CP)
 * Historical/older Battle Frontier cups from PvPoke's gamemaster["cups"] archive are not forced.
 */
export function isCurrentBattleFrontierCup(rawTitleOrLabel: string, cupSlug = ""): boolean {
  const t = (rawTitleOrLabel || "").trim().toLowerCase();
  const c = (cupSlug || "").trim().toLowerCase();
  if (c === "spectral" || c === "cauldron" || c === "battlefrontiermaster") return true;
  if (!t.includes("battle frontier")) return false;
  return (
    t.includes("(spectral)") ||
    t.includes("(cauldron)") ||
    t.includes("(master)") ||
    t.endsWith(" spectral") ||
    t.endsWith(" cauldron") ||
    t.endsWith(" master")
  );
}

export function resolveLeagueCpTier(league: string | undefined): "GREAT" | "ULTRA" | "MASTER" {
  const trimmed = (league || "").trim();
  const u = trimmed.toUpperCase();
  if (u === "MASTER LEAGUE" || u === "MEGA MASTER LEAGUE" || u === "BATTLE FRONTIER (MASTER)") return "MASTER";
  if (u === "ULTRA LEAGUE" || u === "BATTLE FRONTIER (CAULDRON)") return "ULTRA";
  if (u === "GREAT LEAGUE" || u === "BATTLE FRONTIER (SPECTRAL)") return "GREAT";

  const parenMatch = trimmed.match(/\((\d+)\)\s*$/);
  if (parenMatch) {
    const cpVal = Number(parenMatch[1]) || 1500;
    if (cpVal >= 10000) return "MASTER";
    if (cpVal === 2500) return "ULTRA";
    return "GREAT";
  }

  const catMatch = DYNAMIC_LIMITED_META_CATALOG.find(
    (m) => m.label.toLowerCase() === trimmed.toLowerCase() || m.id.toLowerCase() === trimmed.toLowerCase()
  );
  if (catMatch) {
    if (catMatch.cp >= 10000) return "MASTER";
    if (catMatch.cp === 2500) return "ULTRA";
    return "GREAT";
  }

  if (u.includes("MASTER") || u.includes("10000")) return "MASTER";
  if (u.includes("ULTRA") || u.includes("CAULDRON") || u.includes("2500")) return "ULTRA";
  return "GREAT";
}

export function matchesTwoTierLeagueFilter(
  entryLeague: string | undefined,
  cpTierFilter: "ALL" | "GREAT" | "ULTRA" | "MASTER",
  cupSubFilter: string,
  mode: "gbl" | "show6"
): boolean {
  if (cpTierFilter === "ALL") {
    if (!cupSubFilter || cupSubFilter === "ALL" || cupSubFilter === "ALL LEAGUES") return true;
    if (cupSubFilter === "OLD_CUPS") return isOldCupForMode(entryLeague, mode);
    return (entryLeague || "").trim().toLowerCase() === cupSubFilter.trim().toLowerCase();
  }
  const entryTier = resolveLeagueCpTier(entryLeague);
  if (entryTier !== cpTierFilter) return false;
  if (!cupSubFilter || cupSubFilter === "ALL" || cupSubFilter.startsWith("TIER:")) return true;
  if (cupSubFilter === "OLD_CUPS" || cupSubFilter.startsWith("OLD_CUPS:")) {
    return isOldCupForMode(entryLeague, mode);
  }
  return (entryLeague || "").trim().toLowerCase() === cupSubFilter.trim().toLowerCase();
}

export function getForcedGblLeagues(): LeagueType[] {
  return ["GREAT LEAGUE", "ULTRA LEAGUE", "MASTER LEAGUE"];
}

export function getForcedShow6Leagues(): LeagueType[] {
  const out: LeagueType[] = [];
  for (const item of DYNAMIC_LIMITED_META_CATALOG) {
    if (
      isCurrentBattleFrontierCup(item.title || item.label, item.cup) &&
      (item.status === "CURRENT" || item.lifecycle === "CURRENT")
    ) {
      const cleanUpper = (item.title || item.label)
        .replace(/\s*\(\d+\)\s*$/, "")
        .trim()
        .toUpperCase();
      if (cleanUpper && !out.includes(cleanUpper)) {
        out.push(cleanUpper);
      }
    }
  }
  for (const fallback of SHOW6_LEAGUES) {
    const upper = fallback.toUpperCase();
    if (!out.includes(upper)) out.push(upper);
  }
  out.sort();
  return out;
}

export function getPinnedGblLimitedMetas(): string[] {
  try {
    if (typeof localStorage !== "undefined") {
      const raw = localStorage.getItem(PINNED_GBL_LIMITED_METAS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed
            .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
            .map((x) => (x.trim().toUpperCase() === "MEGA MASTER LEAGUE" ? "Mega Master League (10000)" : x.trim()));
        }
      }
    }
  } catch {
    // ignore
  }
  return [];
}

export function getPinnedShow6LimitedMetas(): string[] {
  try {
    if (typeof localStorage !== "undefined") {
      const raw = localStorage.getItem(PINNED_SHOW6_LIMITED_METAS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
        }
      }
    }
  } catch {
    // ignore
  }
  return [];
}

export function pruneUncheckedExpiredMetas(): LimitedMetaFormat[] {
  const nowMs = Date.now();
  const pinnedLower = new Set([
    ...getPinnedGblLimitedMetas().map((s) => s.toLowerCase()),
    ...getPinnedShow6LimitedMetas().map((s) => s.toLowerCase())
  ]);
  DYNAMIC_LIMITED_META_CATALOG = DYNAMIC_LIMITED_META_CATALOG.filter((item) => {
    const isPinned = pinnedLower.has(item.label.toLowerCase()) || pinnedLower.has(item.id.toLowerCase());
    return !isExpiredLimitedMeta(item, nowMs) || isPinned;
  });
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(LIMITED_META_CATALOG_STORAGE_KEY, JSON.stringify(DYNAMIC_LIMITED_META_CATALOG));
    }
  } catch {
    // ignore
  }
  return getLimitedMetaCatalog();
}

export function setDynamicLimitedMetaCatalog(next: LimitedMetaFormat[]): void {
  DYNAMIC_LIMITED_META_CATALOG = next;
}

export function getLimitedMetaCatalog(): LimitedMetaFormat[] {
  const nowMs = Date.now();
  const pinnedLower = new Set([
    ...getPinnedGblLimitedMetas().map((s) => s.toLowerCase()),
    ...getPinnedShow6LimitedMetas().map((s) => s.toLowerCase())
  ]);
  const statusOrder: Record<LimitedMetaLifecycleStatus, number> = {
    CURRENT: 0,
    UPCOMING: 1,
    RECENT: 2
  };
  return DYNAMIC_LIMITED_META_CATALOG.filter((item) => {
    const isPinned = pinnedLower.has(item.label.toLowerCase()) || pinnedLower.has(item.id.toLowerCase());
    return !isExpiredLimitedMeta(item, nowMs) || isPinned;
  }).sort((a, b) => {
    const sa = statusOrder[a.status] ?? 2;
    const sb = statusOrder[b.status] ?? 2;
    if (sa !== sb) return sa - sb;
    return a.label.localeCompare(b.label);
  });
}

export function setPinnedGblLimitedMetas(labels: string[]): string[] {
  const unique = Array.from(new Set((labels || []).map((s) => s.trim()).filter(Boolean)));
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(PINNED_GBL_LIMITED_METAS_STORAGE_KEY, JSON.stringify(unique));
    }
  } catch {
    // ignore
  }
  pruneUncheckedExpiredMetas();
  return unique;
}

export function setPinnedShow6LimitedMetas(labels: string[]): string[] {
  const unique = Array.from(new Set((labels || []).map((s) => s.trim()).filter(Boolean)));
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(PINNED_SHOW6_LIMITED_METAS_STORAGE_KEY, JSON.stringify(unique));
    }
  } catch {
    // ignore
  }
  pruneUncheckedExpiredMetas();
  return unique;
}

export function getEnabledGblLeagues(): LeagueType[] {
  const forced = getForcedGblLeagues();
  const pinned = getPinnedGblLimitedMetas();
  const out: LeagueType[] = [...forced];
  for (const p of pinned) {
    const u = p.trim().toUpperCase();
    if (
      u === "GREAT LEAGUE" ||
      u === "GREAT LEAGUE (1500)" ||
      u === "ULTRA LEAGUE" ||
      u === "ULTRA LEAGUE (2500)" ||
      u === "MASTER LEAGUE" ||
      u === "MASTER LEAGUE (10000)"
    ) {
      continue;
    }
    const norm = u === "MEGA MASTER LEAGUE" ? "Mega Master League (10000)" : p.trim();
    if (!out.some((x) => x.toLowerCase() === norm.toLowerCase())) {
      out.push(norm);
    }
  }
  return out;
}

export function getEnabledShow6Leagues(): LeagueType[] {
  const forced = getForcedShow6Leagues();
  const pinned = getPinnedShow6LimitedMetas();
  const out: LeagueType[] = [...forced];
  for (const p of pinned) {
    const norm = isBattleFrontierCupTitle(p)
      ? p.replace(/\s*\(\d+\)\s*$/, "").trim().toUpperCase()
      : p.trim();
    if (!out.some((x) => x.toLowerCase() === norm.toLowerCase())) {
      out.push(norm);
    }
  }
  return out;
}

export function isOldCupForMode(league: string | undefined, mode: "gbl" | "show6"): boolean {
  const trimmed = (league || "").trim();
  if (!trimmed) return false;
  const forcedLeagues = mode === "show6" ? getForcedShow6Leagues() : getForcedGblLeagues();
  if (forcedLeagues.some((b) => b.toLowerCase() === trimmed.toLowerCase())) return false;

  const pinned = mode === "show6" ? getPinnedShow6LimitedMetas() : getPinnedGblLimitedMetas();
  const isCurrentlyPinned = pinned.some((p) => p.toLowerCase() === trimmed.toLowerCase());
  if (!isCurrentlyPinned) return true;

  const catEntry = DYNAMIC_LIMITED_META_CATALOG.find(
    (m) => m.label.toLowerCase() === trimmed.toLowerCase() || m.id.toLowerCase() === trimmed.toLowerCase()
  );
  if (catEntry && isExpiredLimitedMeta(catEntry)) {
    return true;
  }
  return false;
}

export function getLimitedMetaSheetAliases(): Record<string, string> {
  try {
    if (typeof localStorage !== "undefined") {
      const raw = localStorage.getItem(LIMITED_META_SHEET_ALIASES_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") return parsed as Record<string, string>;
      }
    }
  } catch {
    // ignore
  }
  return {};
}

export function setLimitedMetaSheetAlias(metaLabel: string, aliasKeyword: string): Record<string, string> {
  const current = getLimitedMetaSheetAliases();
  const cleanKey = (metaLabel || "").trim();
  const cleanVal = (aliasKeyword || "").trim();
  if (cleanKey) {
    if (cleanVal) {
      current[cleanKey] = cleanVal;
    } else {
      delete current[cleanKey];
    }
  }
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(LIMITED_META_SHEET_ALIASES_KEY, JSON.stringify(current));
    }
  } catch {
    // ignore
  }
  return current;
}

export function getLeagueCpCap(league: string | undefined): 500 | 1500 | 2500 | 10000 {
  const raw = (league || "GREAT LEAGUE").trim();
  const catMatch = DYNAMIC_LIMITED_META_CATALOG.find(
    (m) => m.label.toLowerCase() === raw.toLowerCase() || m.id.toLowerCase() === raw.toLowerCase()
  );
  if (catMatch) return catMatch.cp;
  const cpParen = raw.match(/\((\d{3,5})\)/);
  if (cpParen) {
    const n = parseInt(cpParen[1], 10);
    if (n <= 500) return 500;
    if (n <= 1500) return 1500;
    if (n <= 2500) return 2500;
    return 10000;
  }
  const u = raw.toUpperCase();
  if (u.includes("500") || u.includes("LITTLE") || u.includes("ELEMENT")) return 500;
  if (u.includes("2500") || u.includes("ULTRA") || u.includes("CAULDRON")) return 2500;
  if (u.includes("10000") || u.includes("MASTER")) return 10000;
  return 1500;
}

export function isMegaOrPrimalSpecies(name: string | undefined): boolean {
  const s = (name || "").trim().toLowerCase();
  return (
    s.startsWith("mega ") ||
    s.startsWith("primal ") ||
    s.includes(" mega") ||
    s.includes(" primal") ||
    s.includes("(mega") ||
    s.includes("(primal") ||
    s.includes("_mega") ||
    s.includes("_primal")
  );
}

export function countMegaOrPrimalInRoster(members: Array<{ name: string } | string>): number {
  let count = 0;
  for (const m of members || []) {
    const n = typeof m === "string" ? m : m?.name || "";
    if (isMegaOrPrimalSpecies(n)) count++;
  }
  return count;
}

export function hasMultipleMegas(members: Array<{ name: string } | string>): boolean {
  return countMegaOrPrimalInRoster(members) > 1;
}

export function isMegaAllowedInLeague(league: string | undefined): boolean {
  const raw = (league || "").trim();
  if (!raw) return false;
  const liveMap = LIVE_RANKINGS_MAP[raw] || LIVE_RANKINGS_MAP[raw.toUpperCase()];
  if (liveMap && liveMap.size > 0) {
    for (const spId of liveMap.keys()) {
      if (isMegaOrPrimalSpecies(spId)) return true;
    }
  }
  const catMatch = DYNAMIC_LIMITED_META_CATALOG.find(
    (m) => m.label.toLowerCase() === raw.toLowerCase() || m.id.toLowerCase() === raw.toLowerCase()
  );
  if (catMatch) return Boolean(catMatch.allowMegas);
  const u = raw.toUpperCase();
  return (
    u === "MEGA MASTER LEAGUE" ||
    u.includes("MEGA") ||
    u.includes("BATTLE FRONTIER (CAULDRON)") ||
    u.includes("BATTLE FRONTIER (MASTER)")
  );
}

export const SUPER_MEGA_PLUS_MOVES: Record<string, string> = {
  "beedrill_mega": "Fell Stinger+",
  "beedrill (mega)": "Fell Stinger+",
  "mega beedrill": "Fell Stinger+",
  "raichu_mega_x": "Volt Tackle+",
  "raichu (mega x)": "Volt Tackle+",
  "mega raichu x": "Volt Tackle+",
  "raichu_mega_y": "Zap Cannon+",
  "raichu (mega y)": "Zap Cannon+",
  "mega raichu y": "Zap Cannon+",
  "victreebel_mega": "Acid Spray+",
  "victreebel (mega)": "Acid Spray+",
  "mega victreebel": "Acid Spray+",
  "starmie_mega": "Liquidation+",
  "starmie (mega)": "Liquidation+",
  "mega starmie": "Liquidation+",
  "dragonite_mega": "Outrage+",
  "dragonite (mega)": "Outrage+",
  "mega dragonite": "Outrage+",
  "mewtwo_mega_x": "Dynamic Punch+",
  "mewtwo (mega x)": "Dynamic Punch+",
  "mega mewtwo x": "Dynamic Punch+",
  "mewtwo_mega_y": "Future Sight+",
  "mewtwo (mega y)": "Future Sight+",
  "mega mewtwo y": "Future Sight+",
  "skarmory_mega": "Drill Peck+",
  "skarmory (mega)": "Drill Peck+",
  "mega skarmory": "Drill Peck+",
  "houndoom_mega": "Dark Pulse+",
  "houndoom (mega)": "Dark Pulse+",
  "mega houndoom": "Dark Pulse+",
  "sableye_mega": "Night Shade+",
  "sableye (mega)": "Night Shade+",
  "mega sableye": "Night Shade+",
  "staraptor_mega": "Brave Bird+",
  "staraptor (mega)": "Brave Bird+",
  "mega staraptor": "Brave Bird+",
  "chandelure_mega": "Ominous Wind+",
  "chandelure (mega)": "Ominous Wind+",
  "mega chandelure": "Ominous Wind+",
  "chesnaught_mega": "Seed Bomb+",
  "chesnaught (mega)": "Seed Bomb+",
  "mega chesnaught": "Seed Bomb+",
  "delphox_mega": "Mystical Fire+",
  "delphox (mega)": "Mystical Fire+",
  "mega delphox": "Mystical Fire+",
  "greninja_mega": "Surf+",
  "greninja (mega)": "Surf+",
  "mega greninja": "Surf+",
  "malamar_mega": "Psybeam+",
  "malamar (mega)": "Psybeam+",
  "mega malamar": "Psybeam+",
  "falinks_mega": "Brick Break+",
  "falinks (mega)": "Brick Break+",
  "mega falinks": "Brick Break+"
};

export const DYNAMIC_SUPER_MEGA_PLUS_MOVES: Record<string, string> = {};

export function resolveMegaPlusMove(name: string | undefined, league: string | undefined): string | null {
  if (!name) return null;
  if (!isMegaOrPrimalSpecies(name)) return null;
  const clean = name.trim().toLowerCase();
  const idClean = clean
    .replace(/\s*\(mega\s*x\)/g, "_mega_x")
    .replace(/\s*\(mega\s*y\)/g, "_mega_y")
    .replace(/\s*\(mega\)/g, "_mega")
    .replace(/^mega\s+([a-z0-9_-]+)\s+x$/g, "$1_mega_x")
    .replace(/^mega\s+([a-z0-9_-]+)\s+y$/g, "$1_mega_y")
    .replace(/^mega\s+([a-z0-9_-]+)$/g, "$1_mega")
    .replace(/[\s-]+/g, "_");
  return (
    DYNAMIC_SUPER_MEGA_PLUS_MOVES[clean] ||
    DYNAMIC_SUPER_MEGA_PLUS_MOVES[idClean] ||
    SUPER_MEGA_PLUS_MOVES[clean] ||
    SUPER_MEGA_PLUS_MOVES[idClean] ||
    null
  );
}

export function isBattleFrontierLeague(league: string | undefined): boolean {
  const raw = (league || "").trim();
  const u = raw.toUpperCase();
  if (u.includes("BATTLE FRONTIER") || u.includes("SPECTRAL") || u.includes("CAULDRON")) {
    return true;
  }
  const pinnedShow6 = getPinnedShow6LimitedMetas();
  return pinnedShow6.some((p) => p.toLowerCase() === raw.toLowerCase());
}

export function isShow6EligibleLeague(league: string | undefined): boolean {
  const norm = normalizeLeagueName(league);
  return getEnabledShow6Leagues().some((l) => l.toLowerCase() === norm.toLowerCase());
}

export function normalizeLeagueName(league: string | undefined): LeagueType {
  const raw = (league || "GREAT LEAGUE").trim();
  if (!raw) return "GREAT LEAGUE";
  const u = raw.toUpperCase();
  if (u === "GREAT LEAGUE") return "GREAT LEAGUE";
  if (u === "ULTRA LEAGUE") return "ULTRA LEAGUE";
  if (u === "MASTER LEAGUE") return "MASTER LEAGUE";
  if (u === "MEGA MASTER LEAGUE" || u === "MEGA MASTER LEAGUE (10000)") return "Mega Master League (10000)";
  if (u.includes("SPECTRAL")) return "BATTLE FRONTIER (SPECTRAL)";
  if (u.includes("CAULDRON")) return "BATTLE FRONTIER (CAULDRON)";
  if (u.includes("BATTLE FRONTIER") && u.includes("MASTER")) return "BATTLE FRONTIER (MASTER)";
  if (u.includes("BATTLE FRONTIER")) {
    return raw.replace(/\s*\(\d+\)\s*$/, "").trim().toUpperCase();
  }

  const catalogMatch = DYNAMIC_LIMITED_META_CATALOG.find(
    (m) =>
      m.label.toLowerCase() === raw.toLowerCase() ||
      m.title.toLowerCase() === raw.toLowerCase() ||
      m.id.toLowerCase() === raw.toLowerCase()
  );
  if (catalogMatch) return catalogMatch.label;

  const allPinned = [...getPinnedGblLimitedMetas(), ...getPinnedShow6LimitedMetas()];
  const pinnedMatch = allPinned.find((p) => p.toLowerCase() === raw.toLowerCase());
  if (pinnedMatch) return pinnedMatch;

  const cpMatch = raw.match(/^(.*?)\s*\((\d{3,5})\)\s*$/);
  if (cpMatch) {
    const titlePart = cpMatch[1].trim();
    const cpPart = cpMatch[2];
    if (isBattleFrontierCupTitle(titlePart)) {
      return titlePart.toUpperCase();
    }
    return `${toPvPokeTitleCase(titlePart)} (${cpPart})`;
  }

  if (u.includes("MEGA")) return "Mega Master League (10000)";
  if (u.includes("GREAT")) return "GREAT LEAGUE";
  if (u.includes("ULTRA")) return "ULTRA LEAGUE";
  return "MASTER LEAGUE";
}

export interface MoveUsage {
  moveId: string;
  uses?: number;
}

export interface RankingMoves {
  fastMoves: MoveUsage[];
  chargedMoves: MoveUsage[];
}

export interface PokemonRankingEntry {
  speciesId: string;
  score: number;
  moves: RankingMoves;
  moveCount?: number[];
  moveset?: string[];
}

export const PVPOKE_ENDPOINTS = {
  GAMEMASTER: "https://raw.githubusercontent.com/pvpoke/pvpoke/master/src/data/gamemaster.json",
  FORMATS_JSON: "https://raw.githubusercontent.com/pvpoke/pvpoke/master/src/data/gamemaster/formats.json",
  CUPS_DIR_API: "https://api.github.com/repos/pvpoke/pvpoke/contents/src/data/gamemaster/cups",
  RANKINGS_GL: "https://raw.githubusercontent.com/pvpoke/pvpoke/master/src/data/rankings/all/overall/rankings-1500.json",
  RANKINGS_UL: "https://raw.githubusercontent.com/pvpoke/pvpoke/master/src/data/rankings/all/overall/rankings-2500.json",
  RANKINGS_ML: "https://raw.githubusercontent.com/pvpoke/pvpoke/master/src/data/rankings/all/overall/rankings-10000.json",
  RANKINGS_MEGA_ML: "https://raw.githubusercontent.com/pvpoke/pvpoke/master/src/data/rankings/mega/overall/rankings-10000.json",
  RANKINGS_BF_SPECTRAL: "https://raw.githubusercontent.com/pvpoke/pvpoke/master/src/data/rankings/spectral/overall/rankings-1500.json",
  RANKINGS_BF_CAULDRON: "https://raw.githubusercontent.com/pvpoke/pvpoke/master/src/data/rankings/cauldron/overall/rankings-2500.json",
  RANKINGS_BF_MASTER: "https://raw.githubusercontent.com/pvpoke/pvpoke/master/src/data/rankings/battlefrontiermaster/overall/rankings-10000.json"
} as const;

export interface TeamPreset {
  id: string;
  name: string;
  league: LeagueType;
  combatMode?: "gbl" | "show6";
  pokemon: TeamMember[];
  isSelected?: boolean;
  archetype?: TeamArchetype;
  isArchetypeManual?: boolean;
  leadAggBr?: number;
  machineAggBr?: number;
  safeSwapBr?: number;
  closerSwapBr?: number;
  closerBr?: number;
  sharedWeaknesses?: string[];
  topMetaTargetsTotal?: number;
  topMetaWinsCount?: number;
  keyMetaTargetsBeaten?: string[];
  keyThreats?: string[];
  coreBreakers?: string[];
  altMovesetSlots?: AntiMetaAltMovesetInfo[];
  synergySummary?: string;
  metricsUpdatedAt?: number;
}

// Type effectiveness table for Pokémon GO PvP (1.6x SE, 0.625x NVE, 0.390625x Immune)
export const TYPE_EFFECTIVENESS: Record<string, Record<string, number>> = {
  normal: { rock: 0.625, steel: 0.625, ghost: 0.390625 },
  fire: { grass: 1.6, ice: 1.6, bug: 1.6, steel: 1.6, water: 0.625, fire: 0.625, rock: 0.625, dragon: 0.625 },
  electric: { water: 1.6, flying: 1.6, ground: 0.390625, dragon: 0.625, electric: 0.625, grass: 0.625 },
  water: { fire: 1.6, ground: 1.6, rock: 1.6, water: 0.625, grass: 0.625, dragon: 0.625 },
  grass: { water: 1.6, ground: 1.6, rock: 1.6, fire: 0.625, grass: 0.625, poison: 0.625, flying: 0.625, bug: 0.625, dragon: 0.625, steel: 0.625 },
  ice: { grass: 1.6, ground: 1.6, flying: 1.6, dragon: 1.6, fire: 0.625, water: 0.625, ice: 0.625, steel: 0.625 },
  dragon: { dragon: 1.6, steel: 0.625, fairy: 0.390625 },
  steel: { fairy: 1.6, ice: 1.6, rock: 1.6, fire: 0.625, water: 0.625, electric: 0.625, steel: 0.625 },
  flying: { grass: 1.6, fighting: 1.6, bug: 1.6, electric: 0.625, rock: 0.625, steel: 0.625 },
  dark: { psychic: 1.6, ghost: 1.6, fighting: 0.625, dark: 0.625, fairy: 0.625 },
  ghost: { psychic: 1.6, ghost: 1.6, dark: 0.625, normal: 0.390625 },
  psychic: { fighting: 1.6, poison: 1.6, psychic: 0.625, steel: 0.625, dark: 0.390625 },
  bug: { grass: 1.6, psychic: 1.6, dark: 1.6, fire: 0.625, fighting: 0.625, poison: 0.625, flying: 0.625, ghost: 0.625, steel: 0.625, fairy: 0.625 },
  rock: { fire: 1.6, ice: 1.6, flying: 1.6, bug: 1.6, fighting: 0.625, ground: 0.625, steel: 0.625 },
  ground: { fire: 1.6, electric: 1.6, poison: 1.6, rock: 1.6, steel: 1.6, grass: 0.625, bug: 0.625, flying: 0.390625 },
  poison: { grass: 1.6, fairy: 1.6, poison: 0.625, ground: 0.625, rock: 0.625, ghost: 0.625, steel: 0.390625 },
  fairy: { dragon: 1.6, fighting: 1.6, dark: 1.6, fire: 0.625, poison: 0.625, steel: 0.625 },
  fighting: { normal: 1.6, ice: 1.6, rock: 1.6, dark: 1.6, steel: 1.6, poison: 0.625, flying: 0.625, psychic: 0.625, bug: 0.625, fairy: 0.625, ghost: 0.390625 }
};

export function getTypeMultiplier(attackType: string, defTypes: string[]): number {
  let mult = 1.0;
  const table = TYPE_EFFECTIVENESS[(attackType || "").toLowerCase().trim()];
  if (!table) return 1.0;
  const uniqueDefTypes = Array.from(
    new Set((defTypes || []).map((t) => (t || "").toLowerCase().trim()).filter((t) => t && t !== "none"))
  );
  for (const defType of uniqueDefTypes) {
    const val = table[defType];
    if (val !== undefined) mult *= val;
  }
  return mult;
}

export const POKEMON_DATABASE: Record<string, PokemonStats> = {
  "Zacian (Crowned)": {
    speciesId: "zacian_crowned",
    name: "Zacian (Crowned)",
    baseSpecies: "zacian",
    formLabel: "Crowned",
    types: ["fairy", "steel"],
    baseStats: { atk: 332, def: 240, hp: 192 },
    isRawBaseStats: true,
    defaultIvsGl: "7/9/12",
    defaultIvsUl: "6/13/15",
    defaultFastMove: { name: "Metal Claw", type: "steel", turns: 2, power: 5, energyGain: 7 },
    chargedMoves: [
      { name: "Behemoth Blade", code: "BBl", type: "steel", power: 100, energyCost: 55 },
      { name: "Close Combat", code: "CC", type: "fighting", power: 100, energyCost: 45 },
      { name: "Play Rough", code: "PR", type: "fairy", power: 90, energyCost: 60 }
    ],
    color: "#ec4899"
  },
  "Zacian (Hero)": {
    speciesId: "zacian_hero",
    name: "Zacian (Hero)",
    baseSpecies: "zacian",
    formLabel: "Hero",
    types: ["fairy"],
    baseStats: { atk: 254, def: 236, hp: 192 },
    isRawBaseStats: true,
    defaultIvsGl: "5/7/14",
    defaultIvsUl: "5/10/13",
    defaultFastMove: { name: "Quick Attack", type: "normal", turns: 2, power: 5, energyGain: 8 },
    chargedMoves: [
      { name: "Close Combat", code: "CC", type: "fighting", power: 100, energyCost: 45 },
      { name: "Play Rough", code: "PR", type: "fairy", power: 90, energyCost: 60 },
      { name: "Wild Charge", code: "WC", type: "electric", power: 100, energyCost: 45 }
    ],
    color: "#f472b6"
  },
  "Zamazenta (Crowned)": {
    speciesId: "zamazenta_crowned",
    name: "Zamazenta (Crowned)",
    baseSpecies: "zamazenta",
    formLabel: "Crowned",
    types: ["fighting", "steel"],
    baseStats: { atk: 250, def: 292, hp: 192 },
    isRawBaseStats: true,
    defaultIvsGl: "6/13/14",
    defaultIvsUl: "6/7/14",
    defaultFastMove: { name: "Metal Claw", type: "steel", turns: 2, power: 5, energyGain: 7 },
    chargedMoves: [
      { name: "Behemoth Bash", code: "BBs", type: "steel", power: 80, energyCost: 45 },
      { name: "Close Combat", code: "CC", type: "fighting", power: 100, energyCost: 45 },
      { name: "Moonblast", code: "MB", type: "fairy", power: 90, energyCost: 50 }
    ],
    color: "#ef4444"
  },
  "Zamazenta (Hero)": {
    speciesId: "zamazenta_hero",
    name: "Zamazenta (Hero)",
    baseSpecies: "zamazenta",
    formLabel: "Hero",
    types: ["fighting"],
    baseStats: { atk: 254, def: 236, hp: 192 },
    isRawBaseStats: true,
    defaultIvsGl: "5/7/14",
    defaultIvsUl: "5/10/13",
    defaultFastMove: { name: "Snarl", type: "dark", turns: 3, power: 5, energyGain: 13 },
    chargedMoves: [
      { name: "Close Combat", code: "CC", type: "fighting", power: 100, energyCost: 45 },
      { name: "Crunch", code: "Cr", type: "dark", power: 70, energyCost: 45 },
      { name: "Moonblast", code: "MB", type: "fairy", power: 90, energyCost: 50 }
    ],
    color: "#f87171"
  },
  "Keldeo (Resolute)": {
    speciesId: "keldeo_resolute",
    name: "Keldeo (Resolute)",
    baseSpecies: "keldeo",
    formLabel: "Resolute",
    types: ["water", "fighting"],
    baseStats: { atk: 260, def: 192, hp: 209 },
    isRawBaseStats: true,
    defaultIvsGl: "12/12/13",
    defaultIvsUl: "11/14/13",
    defaultFastMove: { name: "Low Kick", type: "fighting", turns: 2, power: 6, energyGain: 8 },
    chargedMoves: [
      { name: "Secret Sword", code: "SS", type: "fighting", power: 70, energyCost: 35 },
      { name: "Aqua Jet", code: "AJ", type: "water", power: 70, energyCost: 40 },
      { name: "Hydro Pump", code: "HP", type: "water", power: 130, energyCost: 75 }
    ],
    color: "#0ea5e9"
  },
  "Keldeo (Ordinary)": {
    speciesId: "keldeo_ordinary",
    name: "Keldeo (Ordinary)",
    baseSpecies: "keldeo",
    formLabel: "Ordinary",
    types: ["water", "fighting"],
    baseStats: { atk: 260, def: 192, hp: 209 },
    isRawBaseStats: true,
    defaultIvsGl: "0/0/0",
    defaultIvsUl: "11/14/13",
    defaultFastMove: { name: "Low Kick", type: "fighting", turns: 2, power: 6, energyGain: 8 },
    chargedMoves: [
      { name: "Sacred Sword", code: "ScS", type: "fighting", power: 60, energyCost: 35 },
      { name: "Aqua Jet", code: "AJ", type: "water", power: 70, energyCost: 40 },
      { name: "Hydro Pump", code: "HP", type: "water", power: 130, energyCost: 75 }
    ],
    color: "#38bdf8"
  },
  "Dialga (Origin)": {
    speciesId: "dialga_origin",
    name: "Dialga (Origin)",
    baseSpecies: "dialga",
    formLabel: "Origin",
    types: ["steel", "dragon"],
    baseStats: { atk: 270, def: 225, hp: 205 },
    isRawBaseStats: true,
    defaultIvsGl: "5/15/8",
    defaultIvsUl: "7/14/14",
    defaultFastMove: { name: "Dragon Breath", type: "dragon", turns: 1, power: 3, energyGain: 4 },
    chargedMoves: [
      { name: "Roar of Time", code: "RoT", type: "dragon", power: 150, energyCost: 65 },
      { name: "Iron Head", code: "IH", type: "steel", power: 85, energyCost: 50 },
      { name: "Thunder", code: "Th", type: "electric", power: 100, energyCost: 60 }
    ],
    color: "#3b82f6"
  },
  Lugia: {
    speciesId: "lugia",
    name: "Lugia",
    baseSpecies: "lugia",
    formLabel: "Base",
    types: ["psychic", "flying"],
    baseStats: { atk: 193, def: 310, hp: 235 },
    isRawBaseStats: true,
    defaultIvsGl: "5/13/12",
    defaultIvsUl: "5/13/12",
    defaultFastMove: { name: "Dragon Tail", type: "dragon", turns: 3, power: 9, energyGain: 12 },
    chargedMoves: [
      { name: "Aeroblast", code: "AB", type: "flying", power: 170, energyCost: 75 },
      { name: "Earth Power", code: "EP", type: "ground", power: 90, energyCost: 50 },
      { name: "Sky Attack", code: "SA", type: "flying", power: 75, energyCost: 50 }
    ],
    color: "#c084fc"
  },
  Kyogre: {
    speciesId: "kyogre",
    name: "Kyogre",
    baseSpecies: "kyogre",
    formLabel: "Base",
    types: ["water"],
    baseStats: { atk: 270, def: 228, hp: 205 },
    isRawBaseStats: true,
    defaultIvsGl: "6/14/5",
    defaultIvsUl: "4/9/12",
    defaultFastMove: { name: "Waterfall", type: "water", turns: 3, power: 11, energyGain: 10 },
    chargedMoves: [
      { name: "Origin Pulse", code: "OP", type: "water", power: 130, energyCost: 60 },
      { name: "Avalanche", code: "Av", type: "ice", power: 90, energyCost: 45 },
      { name: "Surf", code: "Surf", type: "water", power: 75, energyCost: 45 }
    ],
    color: "#0284c7"
  },
  "Giratina (Origin)": {
    speciesId: "giratina_origin",
    name: "Giratina (Origin)",
    baseSpecies: "giratina",
    formLabel: "Origin",
    types: ["ghost", "dragon"],
    baseStats: { atk: 225, def: 187, hp: 284 },
    isRawBaseStats: true,
    defaultIvsGl: "7/9/14",
    defaultIvsUl: "6/14/9",
    defaultFastMove: { name: "Shadow Claw", type: "ghost", turns: 2, power: 6, energyGain: 8 },
    chargedMoves: [
      { name: "Shadow Ball", code: "SB", type: "ghost", power: 90, energyCost: 50 },
      { name: "Ominous Wind", code: "OW", type: "ghost", power: 45, energyCost: 45 },
      { name: "Dragon Pulse", code: "DP", type: "dragon", power: 90, energyCost: 55 }
    ],
    color: "#9333ea"
  },
  "Giratina (Altered)": {
    speciesId: "giratina_altered",
    name: "Giratina (Altered)",
    baseSpecies: "giratina",
    formLabel: "Altered",
    types: ["ghost", "dragon"],
    baseStats: { atk: 187, def: 225, hp: 284 },
    isRawBaseStats: true,
    defaultIvsGl: "6/15/6",
    defaultIvsUl: "5/15/8",
    defaultFastMove: { name: "Shadow Claw", type: "ghost", turns: 2, power: 6, energyGain: 8 },
    chargedMoves: [
      { name: "Dragon Claw", code: "DC", type: "dragon", power: 80, energyCost: 50 },
      { name: "Ancient Power", code: "AP", type: "rock", power: 60, energyCost: 45 },
      { name: "Shadow Sneak", code: "SS", type: "ghost", power: 75, energyCost: 50 }
    ],
    color: "#a855f7"
  },
  Zygarde: {
    speciesId: "zygarde_complete",
    name: "Zygarde",
    baseSpecies: "zygarde",
    formLabel: "Complete",
    types: ["dragon", "ground"],
    baseStats: { atk: 184, def: 207, hp: 389 },
    isRawBaseStats: true,
    defaultIvsGl: "0/0/0",
    defaultIvsUl: "13/10/15",
    defaultFastMove: { name: "Dragon Tail", type: "dragon", turns: 3, power: 9, energyGain: 12 },
    chargedMoves: [
      { name: "Crunch", code: "Cr", type: "dark", power: 70, energyCost: 45 },
      { name: "Earthquake", code: "EQ", type: "ground", power: 120, energyCost: 65 },
      { name: "Outrage", code: "OR", type: "dragon", power: 110, energyCost: 60 }
    ],
    color: "#10b981"
  },
  Corviknight: {
    speciesId: "corviknight",
    name: "Corviknight",
    baseSpecies: "corviknight",
    formLabel: "Base",
    types: ["flying", "steel"],
    baseStats: { atk: 163, def: 192, hp: 221 },
    isRawBaseStats: true,
    defaultIvsGl: "4/12/14",
    defaultIvsUl: "4/14/13",
    defaultFastMove: { name: "Sand Attack", type: "ground", turns: 1, power: 2, energyGain: 4 },
    chargedMoves: [
      { name: "Air Cutter", code: "AC", type: "flying", power: 60, energyCost: 40 },
      { name: "Iron Head", code: "IH", type: "steel", power: 85, energyCost: 50 },
      { name: "Sky Attack", code: "SA", type: "flying", power: 75, energyCost: 50 }
    ],
    color: "#64748b"
  },
  Mimikyu: {
    speciesId: "mimikyu",
    name: "Mimikyu",
    baseSpecies: "mimikyu",
    formLabel: "Disguised",
    types: ["ghost", "fairy"],
    baseStats: { atk: 177, def: 199, hp: 146 },
    isRawBaseStats: true,
    defaultIvsGl: "4/14/15",
    defaultIvsUl: "13/15/15",
    defaultFastMove: { name: "Shadow Claw", type: "ghost", turns: 2, power: 6, energyGain: 8 },
    chargedMoves: [
      { name: "Play Rough", code: "PR", type: "fairy", power: 90, energyCost: 60 },
      { name: "Shadow Sneak", code: "SS", type: "ghost", power: 75, energyCost: 50 },
      { name: "Thunder", code: "Th", type: "electric", power: 100, energyCost: 60 }
    ],
    color: "#facc15"
  },
  "Kanto Ninetales": {
    speciesId: "ninetales",
    name: "Kanto Ninetales",
    baseSpecies: "ninetales",
    formLabel: "Kanto",
    types: ["fire"],
    baseStats: { atk: 169, def: 190, hp: 177 },
    isRawBaseStats: true,
    defaultIvsGl: "4/15/14",
    defaultIvsUl: "12/15/14",
    defaultFastMove: { name: "Ember", type: "fire", turns: 2, power: 4, energyGain: 9 },
    chargedMoves: [
      { name: "Weather Ball (Fire)", code: "WB-F", type: "fire", power: 60, energyCost: 35 },
      { name: "Energy Ball", code: "EB", type: "grass", power: 80, energyCost: 45 },
      { name: "Psyshock", code: "PS", type: "psychic", power: 70, energyCost: 40 }
    ],
    color: "#f97316"
  },
  Tinkaton: {
    speciesId: "tinkaton",
    name: "Tinkaton",
    baseSpecies: "tinkaton",
    formLabel: "Base",
    types: ["fairy", "steel"],
    baseStats: { atk: 155, def: 196, hp: 198 },
    isRawBaseStats: true,
    defaultIvsGl: "4/15/14",
    defaultIvsUl: "12/15/15",
    defaultFastMove: { name: "Fairy Wind", type: "fairy", turns: 2, power: 4, energyGain: 9 },
    chargedMoves: [
      { name: "Gigaton Hammer", code: "GH", type: "steel", power: 130, energyCost: 60 },
      { name: "Bulldoze", code: "BD", type: "ground", power: 80, energyCost: 55 },
      { name: "Brutal Swing", code: "BS", type: "dark", power: 55, energyCost: 35 }
    ],
    color: "#ec4899"
  },
  Rillaboom: {
    speciesId: "rillaboom",
    name: "Rillaboom",
    baseSpecies: "rillaboom",
    formLabel: "Base",
    types: ["grass"],
    baseStats: { atk: 239, def: 168, hp: 225 },
    isRawBaseStats: true,
    defaultIvsGl: "5/15/13",
    defaultIvsUl: "4/14/15",
    defaultFastMove: { name: "Scratch", type: "normal", turns: 1, power: 3, energyGain: 4 },
    chargedMoves: [
      { name: "Drum Beating", code: "DB", type: "grass", power: 60, energyCost: 35 },
      { name: "Earth Power", code: "EP", type: "ground", power: 90, energyCost: 50 },
      { name: "Frenzy Plant", code: "FP", type: "grass", power: 100, energyCost: 45 }
    ],
    color: "#22c55e"
  },
  "Ninetales (Alolan)": {
    speciesId: "ninetales_alolan",
    name: "Ninetales (Alolan)",
    baseSpecies: "ninetales",
    formLabel: "Alolan",
    types: ["ice", "fairy"],
    baseStats: { atk: 170, def: 193, hp: 177 },
    isRawBaseStats: true,
    defaultIvsGl: "5/15/15",
    defaultIvsUl: "13/15/14",
    defaultFastMove: { name: "Powder Snow", type: "ice", turns: 2, power: 6, energyGain: 8 },
    chargedMoves: [
      { name: "Weather Ball (Ice)", code: "WB-I", type: "ice", power: 60, energyCost: 35 },
      { name: "Chilling Water", code: "ChW", type: "water", power: 60, energyCost: 45 },
      { name: "Psyshock", code: "PS", type: "psychic", power: 70, energyCost: 40 }
    ],
    color: "#38bdf8"
  },
  "Alolan Ninetales": {
    speciesId: "ninetales_alolan",
    name: "Ninetales (Alolan)",
    baseSpecies: "ninetales",
    formLabel: "Alolan",
    types: ["ice", "fairy"],
    baseStats: { atk: 170, def: 193, hp: 177 },
    isRawBaseStats: true,
    defaultIvsGl: "5/15/15",
    defaultIvsUl: "13/15/14",
    defaultFastMove: { name: "Powder Snow", type: "ice", turns: 2, power: 6, energyGain: 8 },
    chargedMoves: [
      { name: "Weather Ball (Ice)", code: "WB-I", type: "ice", power: 60, energyCost: 35 },
      { name: "Chilling Water", code: "ChW", type: "water", power: 60, energyCost: 45 },
      { name: "Psyshock", code: "PS", type: "psychic", power: 70, energyCost: 40 }
    ],
    color: "#38bdf8"
  },
  Fearow: {
    speciesId: "fearow",
    name: "Fearow",
    baseSpecies: "fearow",
    formLabel: "Base",
    types: ["normal", "flying"],
    baseStats: { atk: 182, def: 133, hp: 163 },
    isRawBaseStats: true,
    defaultIvsGl: "4/15/13",
    defaultIvsUl: "15/15/15",
    defaultFastMove: { name: "Peck", type: "flying", turns: 2, power: 6, energyGain: 8 },
    chargedMoves: [
      { name: "Drill Run", code: "DR", type: "ground", power: 70, energyCost: 40 },
      { name: "Drill Peck", code: "DP", type: "flying", power: 70, energyCost: 40 },
      { name: "Sky Attack", code: "SA", type: "flying", power: 75, energyCost: 50 }
    ],
    color: "#d97706"
  },
  "Shadow Pidgeot": {
    speciesId: "pidgeot_shadow",
    name: "Shadow Pidgeot",
    baseSpecies: "pidgeot",
    formLabel: "Shadow",
    types: ["normal", "flying"],
    baseStats: { atk: 166, def: 154, hp: 195 },
    isRawBaseStats: true,
    defaultIvsGl: "4/14/12",
    defaultIvsUl: "15/15/15",
    defaultFastMove: { name: "Gust", type: "flying", turns: 4, power: 16, energyGain: 14 },
    chargedMoves: [
      { name: "Twister", code: "Tw", type: "dragon", power: 70, energyCost: 40 },
      { name: "Brave Bird", code: "BB", type: "flying", power: 130, energyCost: 55 },
      { name: "Feather Dance", code: "FD", type: "flying", power: 35, energyCost: 50 }
    ],
    color: "#a855f7"
  },
  Raikou: {
    speciesId: "raikou",
    name: "Raikou",
    baseSpecies: "raikou",
    formLabel: "Base",
    types: ["electric"],
    baseStats: { atk: 241, def: 195, hp: 207 },
    isRawBaseStats: true,
    defaultIvsGl: "6/12/11",
    defaultIvsUl: "5/13/13",
    defaultFastMove: { name: "Thunder Shock", type: "electric", turns: 2, power: 4, energyGain: 9 },
    chargedMoves: [
      { name: "Wild Charge", code: "WC", type: "electric", power: 100, energyCost: 45 },
      { name: "Shadow Ball", code: "SB", type: "ghost", power: 90, energyCost: 50 },
      { name: "Thunderbolt", code: "TB", type: "electric", power: 90, energyCost: 55 }
    ],
    color: "#eab308"
  },
  Entei: {
    speciesId: "entei",
    name: "Entei",
    baseSpecies: "entei",
    formLabel: "Base",
    types: ["fire"],
    baseStats: { atk: 235, def: 171, hp: 251 },
    isRawBaseStats: true,
    defaultIvsGl: "7/9/11",
    defaultIvsUl: "6/12/12",
    defaultFastMove: { name: "Fire Fang", type: "fire", turns: 2, power: 8, energyGain: 6 },
    chargedMoves: [
      { name: "Flame Charge", code: "FC", type: "fire", power: 65, energyCost: 50 },
      { name: "Overheat", code: "OH", type: "fire", power: 130, energyCost: 55 },
      { name: "Scorching Sands", code: "SS", type: "ground", power: 80, energyCost: 50 }
    ],
    color: "#f97316"
  },
  Suicune: {
    speciesId: "suicune",
    name: "Suicune",
    baseSpecies: "suicune",
    formLabel: "Base",
    types: ["water"],
    baseStats: { atk: 180, def: 235, hp: 225 },
    isRawBaseStats: true,
    defaultIvsGl: "5/14/14",
    defaultIvsUl: "5/15/12",
    defaultFastMove: { name: "Snarl", type: "dark", turns: 3, power: 5, energyGain: 13 },
    chargedMoves: [
      { name: "Ice Beam", code: "IB", type: "ice", power: 90, energyCost: 55 },
      { name: "Hydro Pump", code: "HP", type: "water", power: 130, energyCost: 75 },
      { name: "Scald", code: "Sc", type: "water", power: 85, energyCost: 50 }
    ],
    color: "#38bdf8"
  },
  Yveltal: {
    speciesId: "yveltal",
    name: "Yveltal",
    baseSpecies: "yveltal",
    formLabel: "Base",
    types: ["dark", "flying"],
    baseStats: { atk: 250, def: 185, hp: 246 },
    isRawBaseStats: true,
    defaultIvsGl: "7/13/11",
    defaultIvsUl: "4/14/8",
    defaultFastMove: { name: "Snarl", type: "dark", turns: 3, power: 5, energyGain: 13 },
    chargedMoves: [
      { name: "Dark Pulse", code: "DP", type: "dark", power: 80, energyCost: 45 },
      { name: "Oblivion Wing", code: "OW", type: "flying", power: 85, energyCost: 50 },
      { name: "Focus Blast", code: "FB", type: "fighting", power: 150, energyCost: 75 }
    ],
    color: "#dc2626"
  },
  "Kyurem (Black)": {
    speciesId: "kyurem_black",
    name: "Kyurem (Black)",
    baseSpecies: "kyurem",
    formLabel: "Black",
    types: ["dragon", "ice"],
    baseStats: { atk: 310, def: 183, hp: 245 },
    isRawBaseStats: true,
    defaultIvsGl: "7/10/8",
    defaultIvsUl: "9/13/14",
    defaultFastMove: { name: "Shadow Claw", type: "ghost", turns: 2, power: 6, energyGain: 8 },
    chargedMoves: [
      { name: "Freeze Shock", code: "FS", type: "ice", power: 120, energyCost: 60 },
      { name: "Fusion Bolt", code: "FB", type: "electric", power: 90, energyCost: 45 },
      { name: "Outrage", code: "OR", type: "dragon", power: 110, energyCost: 60 }
    ],
    color: "#38bdf8"
  },
  "Kyurem (White)": {
    speciesId: "kyurem_white",
    name: "Kyurem (White)",
    baseSpecies: "kyurem",
    formLabel: "White",
    types: ["dragon", "ice"],
    baseStats: { atk: 310, def: 183, hp: 245 },
    isRawBaseStats: true,
    defaultIvsGl: "7/10/8",
    defaultIvsUl: "9/13/14",
    defaultFastMove: { name: "Dragon Breath", type: "dragon", turns: 1, power: 3, energyGain: 4 },
    chargedMoves: [
      { name: "Ice Burn", code: "IB", type: "ice", power: 120, energyCost: 60 },
      { name: "Fusion Flare", code: "FF", type: "fire", power: 90, energyCost: 45 },
      { name: "Blizzard", code: "Blz", type: "ice", power: 140, energyCost: 75 }
    ],
    color: "#f87171"
  },
  Kyurem: {
    speciesId: "kyurem",
    name: "Kyurem",
    baseSpecies: "kyurem",
    formLabel: "Base",
    types: ["dragon", "ice"],
    baseStats: { atk: 246, def: 170, hp: 245 },
    isRawBaseStats: true,
    defaultIvsGl: "9/15/14",
    defaultIvsUl: "5/8/14",
    defaultFastMove: { name: "Dragon Breath", type: "dragon", turns: 1, power: 3, energyGain: 4 },
    chargedMoves: [
      { name: "Glaciate", code: "Gl", type: "ice", power: 60, energyCost: 40 },
      { name: "Dragon Claw", code: "DC", type: "dragon", power: 80, energyCost: 50 },
      { name: "Blizzard", code: "Blz", type: "ice", power: 140, energyCost: 75 }
    ],
    color: "#60a5fa"
  },
  "Palkia (Origin)": {
    speciesId: "palkia_origin",
    name: "Palkia (Origin)",
    baseSpecies: "palkia",
    formLabel: "Origin",
    types: ["water", "dragon"],
    baseStats: { atk: 286, def: 223, hp: 189 },
    isRawBaseStats: true,
    defaultIvsGl: "7/15/13",
    defaultIvsUl: "11/13/15",
    defaultFastMove: { name: "Dragon Breath", type: "dragon", turns: 1, power: 3, energyGain: 4 },
    chargedMoves: [
      { name: "Spacial Rend", code: "SR", type: "dragon", power: 95, energyCost: 55 },
      { name: "Aqua Tail", code: "AT", type: "water", power: 55, energyCost: 35 },
      { name: "Draco Meteor", code: "DM", type: "dragon", power: 150, energyCost: 65 }
    ],
    color: "#38bdf8"
  },
  "Necrozma (Dusk Mane)": {
    speciesId: "necrozma_dusk_mane",
    name: "Necrozma (Dusk Mane)",
    baseSpecies: "necrozma",
    formLabel: "Dusk Mane",
    types: ["psychic", "steel"],
    baseStats: { atk: 277, def: 220, hp: 200 },
    isRawBaseStats: true,
    defaultIvsGl: "4/9/14",
    defaultIvsUl: "4/15/9",
    defaultFastMove: { name: "Shadow Claw", type: "ghost", turns: 2, power: 6, energyGain: 8 },
    chargedMoves: [
      { name: "Sunsteel Strike", code: "SS", type: "steel", power: 135, energyCost: 65 },
      { name: "Dark Pulse", code: "DP", type: "dark", power: 80, energyCost: 45 },
      { name: "Iron Head", code: "IH", type: "steel", power: 85, energyCost: 50 }
    ],
    color: "#f59e0b"
  },
  "Necrozma (Dawn Wings)": {
    speciesId: "necrozma_dawn_wings",
    name: "Necrozma (Dawn Wings)",
    baseSpecies: "necrozma",
    formLabel: "Dawn Wings",
    types: ["psychic", "ghost"],
    baseStats: { atk: 277, def: 220, hp: 200 },
    isRawBaseStats: true,
    defaultIvsGl: "4/9/14",
    defaultIvsUl: "4/15/9",
    defaultFastMove: { name: "Shadow Claw", type: "ghost", turns: 2, power: 6, energyGain: 8 },
    chargedMoves: [
      { name: "Moongeist Beam", code: "MB", type: "ghost", power: 135, energyCost: 65 },
      { name: "Dark Pulse", code: "DP", type: "dark", power: 80, energyCost: 45 },
      { name: "Iron Head", code: "IH", type: "steel", power: 85, energyCost: 50 }
    ],
    color: "#8b5cf6"
  },
  "Landorus (Therian)": {
    speciesId: "landorus_therian",
    name: "Landorus (Therian)",
    baseSpecies: "landorus",
    formLabel: "Therian",
    types: ["ground", "flying"],
    baseStats: { atk: 289, def: 179, hp: 205 },
    isRawBaseStats: true,
    defaultIvsGl: "6/9/15",
    defaultIvsUl: "6/15/12",
    defaultFastMove: { name: "Mud Shot", type: "ground", turns: 2, power: 3, energyGain: 9 },
    chargedMoves: [
      { name: "Sandsear Storm", code: "SS", type: "ground", power: 60, energyCost: 45 },
      { name: "Stone Edge", code: "SE", type: "rock", power: 100, energyCost: 55 },
      { name: "Superpower", code: "SP", type: "fighting", power: 85, energyCost: 40 }
    ],
    color: "#ea580c"
  },
  "Ho-Oh": {
    speciesId: "ho_oh",
    name: "Ho-Oh",
    baseSpecies: "ho-oh",
    formLabel: "Base",
    types: ["fire", "flying"],
    baseStats: { atk: 239, def: 244, hp: 214 },
    isRawBaseStats: true,
    defaultIvsGl: "7/13/15",
    defaultIvsUl: "5/15/13",
    defaultFastMove: { name: "Incinerate", type: "fire", turns: 5, power: 20, energyGain: 20 },
    chargedMoves: [
      { name: "Sacred Fire", code: "SF", type: "fire", power: 130, energyCost: 65 },
      { name: "Brave Bird", code: "BB", type: "flying", power: 130, energyCost: 55 },
      { name: "Earthquake", code: "EQ", type: "ground", power: 120, energyCost: 65 }
    ],
    color: "#ef4444"
  },
  "Mewtwo": {
    speciesId: "mewtwo",
    name: "Mewtwo",
    baseSpecies: "mewtwo",
    formLabel: "Base",
    types: ["psychic"],
    baseStats: { atk: 300, def: 182, hp: 214 },
    isRawBaseStats: true,
    defaultIvsGl: "4/14/13",
    defaultIvsUl: "8/13/14",
    defaultFastMove: { name: "Psycho Cut", type: "psychic", turns: 2, power: 4, energyGain: 9 },
    chargedMoves: [
      { name: "Psystrike", code: "PS", type: "psychic", power: 90, energyCost: 45 },
      { name: "Shadow Ball", code: "SB", type: "ghost", power: 90, energyCost: 50 },
      { name: "Focus Blast", code: "FB", type: "fighting", power: 150, energyCost: 75 }
    ],
    color: "#c084fc"
  },
  "Mewtwo (Armored)": {
    speciesId: "mewtwo_armored",
    name: "Mewtwo (Armored)",
    baseSpecies: "mewtwo",
    formLabel: "Armored",
    types: ["psychic"],
    baseStats: { atk: 182, def: 278, hp: 214 },
    isRawBaseStats: true,
    defaultIvsGl: "1/15/15",
    defaultIvsUl: "1/15/15",
    defaultFastMove: { name: "Confusion", type: "psychic", turns: 4, power: 16, energyGain: 14 },
    chargedMoves: [
      { name: "Psystrike", code: "PS", type: "psychic", power: 90, energyCost: 45 },
      { name: "Dynamic Punch", code: "DP", type: "fighting", power: 90, energyCost: 45 },
      { name: "Earthquake", code: "EQ", type: "ground", power: 120, energyCost: 65 }
    ],
    color: "#9333ea"
  },
  "Armored Mewtwo": {
    speciesId: "mewtwo_armored",
    name: "Mewtwo (Armored)",
    baseSpecies: "mewtwo",
    formLabel: "Armored",
    types: ["psychic"],
    baseStats: { atk: 182, def: 278, hp: 214 },
    isRawBaseStats: true,
    defaultIvsGl: "1/15/15",
    defaultIvsUl: "1/15/15",
    defaultFastMove: { name: "Confusion", type: "psychic", turns: 4, power: 16, energyGain: 14 },
    chargedMoves: [
      { name: "Psystrike", code: "PS", type: "psychic", power: 90, energyCost: 45 },
      { name: "Dynamic Punch", code: "DP", type: "fighting", power: 90, energyCost: 45 },
      { name: "Earthquake", code: "EQ", type: "ground", power: 120, energyCost: 65 }
    ],
    color: "#9333ea"
  },
  "Mew": {
    speciesId: "mew",
    name: "Mew",
    baseSpecies: "mew",
    formLabel: "Base",
    types: ["psychic"],
    baseStats: { atk: 210, def: 210, hp: 225 },
    isRawBaseStats: true,
    defaultIvsGl: "10/15/13",
    defaultIvsUl: "0/14/15",
    defaultFastMove: { name: "Shadow Claw", type: "ghost", turns: 2, power: 6, energyGain: 8 },
    chargedMoves: [
      { name: "Psyshock", code: "PS", type: "psychic", power: 70, energyCost: 40 },
      { name: "Wild Charge", code: "WC", type: "electric", power: 100, energyCost: 45 },
      { name: "Surf", code: "Su", type: "water", power: 75, energyCost: 45 }
    ],
    color: "#f472b6"
  },
  "Feraligatr": {
    speciesId: "feraligatr",
    name: "Feraligatr",
    baseSpecies: "feraligatr",
    formLabel: "Base",
    types: ["water"],
    baseStats: { atk: 205, def: 188, hp: 198 },
    isRawBaseStats: true,
    defaultIvsGl: "5/11/14",
    defaultIvsUl: "4/15/11",
    defaultFastMove: { name: "Shadow Claw", type: "ghost", turns: 2, power: 6, energyGain: 8 },
    chargedMoves: [
      { name: "Hydro Cannon", code: "HC", type: "water", power: 80, energyCost: 40 },
      { name: "Ice Beam", code: "IB", type: "ice", power: 90, energyCost: 55 },
      { name: "Crunch", code: "Cr", type: "dark", power: 70, energyCost: 45 }
    ],
    color: "#0284c7"
  },
  "Cresselia": {
    speciesId: "cresselia",
    name: "Cresselia",
    baseSpecies: "cresselia",
    formLabel: "Base",
    types: ["psychic"],
    baseStats: { atk: 152, def: 258, hp: 260 },
    isRawBaseStats: true,
    defaultIvsGl: "4/11/9",
    defaultIvsUl: "4/11/11",
    defaultFastMove: { name: "Psycho Cut", type: "psychic", turns: 2, power: 4, energyGain: 9 },
    chargedMoves: [
      { name: "Grass Knot", code: "GK", type: "grass", power: 90, energyCost: 50 },
      { name: "Moonblast", code: "MB", type: "fairy", power: 90, energyCost: 50 },
      { name: "Future Sight", code: "FS", type: "psychic", power: 110, energyCost: 65 }
    ],
    color: "#e879f9"
  },
  "Registeel": {
    speciesId: "registeel",
    name: "Registeel",
    baseSpecies: "registeel",
    formLabel: "Base",
    types: ["steel"],
    baseStats: { atk: 143, def: 285, hp: 190 },
    isRawBaseStats: true,
    defaultIvsGl: "8/15/14",
    defaultIvsUl: "4/6/14",
    defaultFastMove: { name: "Lock-On", type: "normal", turns: 1, power: 1, energyGain: 5 },
    chargedMoves: [
      { name: "Focus Blast", code: "FB", type: "fighting", power: 150, energyCost: 75 },
      { name: "Zap Cannon", code: "ZC", type: "electric", power: 150, energyCost: 80 },
      { name: "Hyper Beam", code: "HB", type: "normal", power: 150, energyCost: 80 }
    ],
    color: "#94a3b8"
  },
  "Cobalion": {
    speciesId: "cobalion",
    name: "Cobalion",
    baseSpecies: "cobalion",
    formLabel: "Base",
    types: ["steel", "fighting"],
    baseStats: { atk: 192, def: 229, hp: 209 },
    isRawBaseStats: true,
    defaultIvsGl: "4/10/4",
    defaultIvsUl: "6/15/11",
    defaultFastMove: { name: "Double Kick", type: "fighting", turns: 3, power: 8, energyGain: 12 },
    chargedMoves: [
      { name: "Sacred Sword", code: "SS", type: "fighting", power: 60, energyCost: 35 },
      { name: "Stone Edge", code: "SE", type: "rock", power: 100, energyCost: 55 },
      { name: "Iron Head", code: "IH", type: "steel", power: 85, energyCost: 50 }
    ],
    color: "#0284c7"
  },
  "Lickilicky": {
    speciesId: "lickilicky",
    name: "Lickilicky",
    baseSpecies: "lickilicky",
    formLabel: "Base",
    types: ["normal"],
    baseStats: { atk: 161, def: 181, hp: 242 },
    isRawBaseStats: true,
    defaultIvsGl: "4/15/8",
    defaultIvsUl: "4/13/13",
    defaultFastMove: { name: "Rollout", type: "rock", turns: 3, power: 7, energyGain: 13 },
    chargedMoves: [
      { name: "Body Slam", code: "BS", type: "normal", power: 65, energyCost: 40 },
      { name: "Shadow Ball", code: "SB", type: "ghost", power: 90, energyCost: 50 },
      { name: "Earthquake", code: "EQ", type: "ground", power: 120, energyCost: 65 }
    ],
    color: "#f472b6"
  },
  "Annihilape": {
    speciesId: "annihilape",
    name: "Annihilape",
    baseSpecies: "annihilape",
    formLabel: "Base",
    types: ["fighting", "ghost"],
    baseStats: { atk: 220, def: 178, hp: 242 },
    isRawBaseStats: true,
    defaultIvsGl: "4/13/13",
    defaultIvsUl: "5/14/15",
    defaultFastMove: { name: "Counter", type: "fighting", turns: 2, power: 8, energyGain: 6 },
    chargedMoves: [
      { name: "Rage Fist", code: "RF", type: "ghost", power: 55, energyCost: 40 },
      { name: "Ice Punch", code: "IP", type: "ice", power: 60, energyCost: 40 },
      { name: "Close Combat", code: "CC", type: "fighting", power: 100, energyCost: 45 }
    ],
    color: "#64748b"
  },
  "Talonflame": {
    speciesId: "talonflame",
    name: "Talonflame",
    baseSpecies: "talonflame",
    formLabel: "Base",
    types: ["fire", "flying"],
    baseStats: { atk: 176, def: 155, hp: 186 },
    isRawBaseStats: true,
    defaultIvsGl: "4/12/15",
    defaultIvsUl: "15/15/15",
    defaultFastMove: { name: "Incinerate", type: "fire", turns: 5, power: 20, energyGain: 20 },
    chargedMoves: [
      { name: "Fly", code: "Fl", type: "flying", power: 80, energyCost: 45 },
      { name: "Flame Charge", code: "FC", type: "fire", power: 65, energyCost: 50 },
      { name: "Brave Bird", code: "BB", type: "flying", power: 130, energyCost: 55 }
    ],
    color: "#f97316"
  },
  "Clodsire": {
    speciesId: "clodsire",
    name: "Clodsire",
    baseSpecies: "clodsire",
    formLabel: "Base",
    types: ["poison", "ground"],
    baseStats: { atk: 127, def: 151, hp: 277 },
    isRawBaseStats: true,
    defaultIvsGl: "4/14/10",
    defaultIvsUl: "15/15/15",
    defaultFastMove: { name: "Poison Sting", type: "poison", turns: 2, power: 4, energyGain: 9 },
    chargedMoves: [
      { name: "Earthquake", code: "EQ", type: "ground", power: 120, energyCost: 65 },
      { name: "Stone Edge", code: "SE", type: "rock", power: 100, energyCost: 55 },
      { name: "Megahorn", code: "MH", type: "bug", power: 110, energyCost: 55 }
    ],
    color: "#78350f"
  },
  "Mandibuzz": {
    speciesId: "mandibuzz",
    name: "Mandibuzz",
    baseSpecies: "mandibuzz",
    formLabel: "Base",
    types: ["dark", "flying"],
    baseStats: { atk: 129, def: 205, hp: 242 },
    isRawBaseStats: true,
    defaultIvsGl: "5/15/13",
    defaultIvsUl: "15/15/15",
    defaultFastMove: { name: "Snarl", type: "dark", turns: 3, power: 5, energyGain: 13 },
    chargedMoves: [
      { name: "Dark Pulse", code: "DP", type: "dark", power: 80, energyCost: 45 },
      { name: "Aerial Ace", code: "AA", type: "flying", power: 60, energyCost: 45 },
      { name: "Shadow Ball", code: "SB", type: "ghost", power: 90, energyCost: 50 }
    ],
    color: "#52525b"
  },
  "Azumarill": {
    speciesId: "azumarill",
    name: "Azumarill",
    baseSpecies: "azumarill",
    formLabel: "Base",
    types: ["water", "fairy"],
    baseStats: { atk: 112, def: 152, hp: 225 },
    isRawBaseStats: true,
    defaultIvsGl: "4/15/13",
    defaultIvsUl: "15/15/15",
    defaultFastMove: { name: "Bubble", type: "water", turns: 3, power: 8, energyGain: 11 },
    chargedMoves: [
      { name: "Ice Beam", code: "IB", type: "ice", power: 90, energyCost: 55 },
      { name: "Play Rough", code: "PR", type: "fairy", power: 90, energyCost: 60 },
      { name: "Hydro Pump", code: "HP", type: "water", power: 130, energyCost: 75 }
    ],
    color: "#38bdf8"
  },
  "Gastrodon": {
    speciesId: "gastrodon",
    name: "Gastrodon",
    baseSpecies: "gastrodon",
    formLabel: "Base",
    types: ["water", "ground"],
    baseStats: { atk: 169, def: 143, hp: 244 },
    isRawBaseStats: true,
    defaultIvsGl: "4/15/14",
    defaultIvsUl: "12/15/13",
    defaultFastMove: { name: "Mud-Slap", type: "ground", turns: 3, power: 11, energyGain: 10 },
    chargedMoves: [
      { name: "Body Slam", code: "BS", type: "normal", power: 65, energyCost: 40 },
      { name: "Earth Power", code: "EP", type: "ground", power: 90, energyCost: 50 },
      { name: "Water Pulse", code: "WP", type: "water", power: 80, energyCost: 50 }
    ],
    color: "#14b8a6"
  },
  "Malamar": {
    speciesId: "malamar",
    name: "Malamar",
    baseSpecies: "malamar",
    formLabel: "Base",
    types: ["dark", "psychic"],
    baseStats: { atk: 177, def: 165, hp: 200 },
    isRawBaseStats: true,
    defaultIvsGl: "4/15/15",
    defaultIvsUl: "4/13/15",
    defaultFastMove: { name: "Psywave", type: "psychic", turns: 1, power: 3, energyGain: 4 },
    chargedMoves: [
      { name: "Foul Play", code: "FP", type: "dark", power: 65, energyCost: 40 },
      { name: "Superpower", code: "SP", type: "fighting", power: 85, energyCost: 40 },
      { name: "Hyper Beam", code: "HB", type: "normal", power: 150, energyCost: 80 }
    ],
    color: "#6366f1"
  },
  "Dunsparce": {
    speciesId: "dunsparce",
    name: "Dunsparce",
    baseSpecies: "dunsparce",
    formLabel: "Base",
    types: ["normal"],
    baseStats: { atk: 131, def: 128, hp: 225 },
    isRawBaseStats: true,
    defaultIvsGl: "4/15/13",
    defaultIvsUl: "15/15/15",
    defaultFastMove: { name: "Rollout", type: "rock", turns: 3, power: 7, energyGain: 13 },
    chargedMoves: [
      { name: "Rock Slide", code: "RS", type: "rock", power: 75, energyCost: 45 },
      { name: "Drill Run", code: "DR", type: "ground", power: 70, energyCost: 40 },
      { name: "Dig", code: "Dg", type: "ground", power: 70, energyCost: 50 }
    ],
    color: "#eab308"
  },
  "Sandslash (Alolan)": {
    speciesId: "sandslash_alolan",
    name: "Sandslash (Alolan)",
    baseSpecies: "sandslash",
    formLabel: "Alolan",
    types: ["ice", "steel"],
    baseStats: { atk: 177, def: 195, hp: 181 },
    isRawBaseStats: true,
    defaultIvsGl: "4/13/15",
    defaultIvsUl: "4/12/15",
    defaultFastMove: { name: "Powder Snow", type: "ice", turns: 2, power: 6, energyGain: 8 },
    chargedMoves: [
      { name: "Ice Punch", code: "IP", type: "ice", power: 60, energyCost: 40 },
      { name: "Drill Run", code: "DR", type: "ground", power: 70, energyCost: 40 },
      { name: "Blizzard", code: "Blz", type: "ice", power: 140, energyCost: 75 }
    ],
    color: "#38bdf8"
  },
  "Primeape": {
    speciesId: "primeape",
    name: "Primeape",
    baseSpecies: "primeape",
    formLabel: "Base",
    types: ["fighting"],
    baseStats: { atk: 207, def: 138, hp: 163 },
    isRawBaseStats: true,
    defaultIvsGl: "5/15/15",
    defaultIvsUl: "12/15/14",
    defaultFastMove: { name: "Karate Chop", type: "fighting", turns: 2, power: 5, energyGain: 9 },
    chargedMoves: [
      { name: "Rage Fist", code: "RF", type: "ghost", power: 55, energyCost: 40 },
      { name: "Close Combat", code: "CC", type: "fighting", power: 100, energyCost: 45 },
      { name: "Ice Punch", code: "IP", type: "ice", power: 60, energyCost: 40 }
    ],
    color: "#d97706"
  },
  "Morpeko": {
    speciesId: "morpeko",
    name: "Morpeko",
    baseSpecies: "morpeko",
    formLabel: "Full Belly",
    types: ["electric", "dark"],
    baseStats: { atk: 192, def: 121, hp: 151 },
    isRawBaseStats: true,
    defaultIvsGl: "5/14/15",
    defaultIvsUl: "15/15/15",
    defaultFastMove: { name: "Thunder Shock", type: "electric", turns: 2, power: 4, energyGain: 9 },
    chargedMoves: [
      { name: "Aura Wheel", code: "AW", type: "electric", power: 100, energyCost: 45 },
      { name: "Psychic Fangs", code: "PF", type: "psychic", power: 40, energyCost: 35 },
      { name: "Outrage", code: "OR", type: "dragon", power: 110, energyCost: 60 }
    ],
    color: "#eab308"
  },
  "Clefable": {
    speciesId: "clefable",
    name: "Clefable",
    baseSpecies: "clefable",
    formLabel: "Base",
    types: ["fairy"],
    baseStats: { atk: 178, def: 162, hp: 216 },
    isRawBaseStats: true,
    defaultIvsGl: "4/13/14",
    defaultIvsUl: "4/12/15",
    defaultFastMove: { name: "Fairy Wind", type: "fairy", turns: 2, power: 4, energyGain: 9 },
    chargedMoves: [
      { name: "Meteor Mash", code: "MM", type: "steel", power: 100, energyCost: 45 },
      { name: "Moonblast", code: "MB", type: "fairy", power: 90, energyCost: 50 },
      { name: "Swift", code: "Sw", type: "normal", power: 55, energyCost: 35 }
    ],
    color: "#f472b6"
  },
  "Ampharos": {
    speciesId: "ampharos",
    name: "Ampharos",
    baseSpecies: "ampharos",
    formLabel: "Base",
    types: ["electric"],
    baseStats: { atk: 211, def: 169, hp: 207 },
    isRawBaseStats: true,
    defaultIvsGl: "4/14/12",
    defaultIvsUl: "4/12/15",
    defaultFastMove: { name: "Volt Switch", type: "electric", turns: 4, power: 14, energyGain: 16 },
    chargedMoves: [
      { name: "Brutal Swing", code: "BS", type: "dark", power: 55, energyCost: 35 },
      { name: "Trailblaze", code: "TB", type: "grass", power: 65, energyCost: 45 },
      { name: "Zap Cannon", code: "ZC", type: "electric", power: 150, energyCost: 80 }
    ],
    color: "#eab308"
  },
  "Wigglytuff": {
    speciesId: "wigglytuff",
    name: "Wigglytuff",
    baseSpecies: "wigglytuff",
    formLabel: "Base",
    types: ["normal", "fairy"],
    baseStats: { atk: 156, def: 90, hp: 295 },
    isRawBaseStats: true,
    defaultIvsGl: "4/15/15",
    defaultIvsUl: "15/15/15",
    defaultFastMove: { name: "Charm", type: "fairy", turns: 3, power: 12, energyGain: 8 },
    chargedMoves: [
      { name: "Icy Wind", code: "IW", type: "ice", power: 60, energyCost: 45 },
      { name: "Disarming Voice", code: "DV", type: "fairy", power: 70, energyCost: 45 },
      { name: "Swift", code: "Sw", type: "normal", power: 55, energyCost: 35 }
    ],
    color: "#ec4899"
  },
  "Mega Rayquaza": {
    speciesId: "rayquaza_mega",
    name: "Mega Rayquaza",
    baseSpecies: "rayquaza",
    formLabel: "Mega",
    types: ["dragon", "flying"],
    baseStats: { atk: 377, def: 210, hp: 227 },
    isRawBaseStats: true,
    defaultIvsGl: "6/13/13",
    defaultIvsUl: "4/12/10",
    defaultFastMove: { name: "Dragon Tail", type: "dragon", turns: 3, power: 9, energyGain: 12 },
    chargedMoves: [
      { name: "Breaking Swipe", code: "BS", type: "dragon", power: 50, energyCost: 50 },
      { name: "Dragon Ascent", code: "DA", type: "flying", power: 110, energyCost: 45 },
      { name: "Outrage", code: "OR", type: "dragon", power: 110, energyCost: 60 }
    ],
    color: "#10b981"
  },
  "Primal Groudon": {
    speciesId: "groudon_primal",
    name: "Primal Groudon",
    baseSpecies: "groudon",
    formLabel: "Primal",
    types: ["ground", "fire"],
    baseStats: { atk: 353, def: 268, hp: 218 },
    isRawBaseStats: true,
    defaultIvsGl: "5/8/4",
    defaultIvsUl: "6/4/14",
    defaultFastMove: { name: "Mud Shot", type: "ground", turns: 2, power: 3, energyGain: 9 },
    chargedMoves: [
      { name: "Precipice Blades", code: "PB", type: "ground", power: 130, energyCost: 60 },
      { name: "Fire Punch", code: "FP", type: "fire", power: 60, energyCost: 40 },
      { name: "Solar Beam", code: "SBm", type: "grass", power: 150, energyCost: 80 }
    ],
    color: "#ef4444"
  },
  "Primal Kyogre": {
    speciesId: "kyogre_primal",
    name: "Primal Kyogre",
    baseSpecies: "kyogre",
    formLabel: "Primal",
    types: ["water"],
    baseStats: { atk: 353, def: 268, hp: 218 },
    isRawBaseStats: true,
    defaultIvsGl: "5/8/4",
    defaultIvsUl: "6/4/14",
    defaultFastMove: { name: "Waterfall", type: "water", turns: 3, power: 11, energyGain: 10 },
    chargedMoves: [
      { name: "Origin Pulse", code: "OP", type: "water", power: 130, energyCost: 60 },
      { name: "Surf", code: "Surf", type: "water", power: 75, energyCost: 45 },
      { name: "Blizzard", code: "Blz", type: "ice", power: 140, energyCost: 75 }
    ],
    color: "#2563eb"
  },
  "Mega Mewtwo Y": {
    speciesId: "mewtwo_mega_y",
    name: "Mega Mewtwo Y",
    baseSpecies: "mewtwo",
    formLabel: "Mega Y",
    types: ["psychic"],
    baseStats: { atk: 413, def: 223, hp: 228 },
    isRawBaseStats: true,
    defaultIvsGl: "6/5/15",
    defaultIvsUl: "4/7/15",
    defaultFastMove: { name: "Psycho Cut", type: "psychic", turns: 2, power: 4, energyGain: 9 },
    chargedMoves: [
      { name: "Psystrike", code: "PS", type: "psychic", power: 90, energyCost: 45 },
      { name: "Shadow Ball", code: "SB", type: "ghost", power: 90, energyCost: 50 },
      { name: "Focus Blast", code: "FB", type: "fighting", power: 150, energyCost: 75 }
    ],
    color: "#d946ef"
  },
  "Mega Gyarados": {
    speciesId: "gyarados_mega",
    name: "Mega Gyarados",
    baseSpecies: "gyarados",
    formLabel: "Mega",
    types: ["water", "dark"],
    baseStats: { atk: 292, def: 247, hp: 216 },
    isRawBaseStats: true,
    defaultIvsGl: "5/15/14",
    defaultIvsUl: "4/8/15",
    defaultFastMove: { name: "Dragon Breath", type: "dragon", turns: 1, power: 3, energyGain: 4 },
    chargedMoves: [
      { name: "Aqua Tail", code: "AT", type: "water", power: 55, energyCost: 35 },
      { name: "Crunch", code: "Cr", type: "dark", power: 70, energyCost: 45 },
      { name: "Outrage", code: "OR", type: "dragon", power: 110, energyCost: 60 }
    ],
    color: "#0284c7"
  },
  "Mega Garchomp": {
    speciesId: "garchomp_mega",
    name: "Mega Garchomp",
    baseSpecies: "garchomp",
    formLabel: "Mega",
    types: ["dragon", "ground"],
    baseStats: { atk: 339, def: 222, hp: 239 },
    isRawBaseStats: true,
    defaultIvsGl: "5/13/15",
    defaultIvsUl: "7/15/14",
    defaultFastMove: { name: "Mud Shot", type: "ground", turns: 2, power: 3, energyGain: 9 },
    chargedMoves: [
      { name: "Earth Power", code: "EP", type: "ground", power: 90, energyCost: 50 },
      { name: "Outrage", code: "OR", type: "dragon", power: 110, energyCost: 60 },
      { name: "Sand Tomb", code: "ST", type: "ground", power: 55, energyCost: 45 }
    ],
    color: "#4f46e5"
  },
  "Mega Gardevoir": {
    speciesId: "gardevoir_mega",
    name: "Mega Gardevoir",
    baseSpecies: "gardevoir",
    formLabel: "Mega",
    types: ["psychic", "fairy"],
    baseStats: { atk: 326, def: 229, hp: 169 },
    isRawBaseStats: true,
    defaultIvsGl: "5/14/15",
    defaultIvsUl: "6/14/14",
    defaultFastMove: { name: "Charm", type: "fairy", turns: 3, power: 12, energyGain: 8 },
    chargedMoves: [
      { name: "Triple Axel", code: "TA", type: "ice", power: 60, energyCost: 45 },
      { name: "Shadow Ball", code: "SB", type: "ghost", power: 90, energyCost: 50 },
      { name: "Synchronoise", code: "Syn", type: "psychic", power: 80, energyCost: 50 }
    ],
    color: "#f472b6"
  },
  "Mega Metagross": {
    speciesId: "metagross_mega",
    name: "Mega Metagross",
    baseSpecies: "metagross",
    formLabel: "Mega",
    types: ["steel", "psychic"],
    baseStats: { atk: 300, def: 289, hp: 190 },
    isRawBaseStats: true,
    defaultIvsGl: "6/15/14",
    defaultIvsUl: "4/14/14",
    defaultFastMove: { name: "Bullet Punch", type: "steel", turns: 2, power: 7, energyGain: 7 },
    chargedMoves: [
      { name: "Meteor Mash", code: "MM", type: "steel", power: 100, energyCost: 45 },
      { name: "Earthquake", code: "EQ", type: "ground", power: 120, energyCost: 65 },
      { name: "Psychic", code: "Psy", type: "psychic", power: 75, energyCost: 55 }
    ],
    color: "#64748b"
  },
  "Mega Swampert": {
    speciesId: "swampert_mega",
    name: "Mega Swampert",
    baseSpecies: "swampert",
    formLabel: "Mega",
    types: ["water", "ground"],
    baseStats: { atk: 283, def: 218, hp: 225 },
    isRawBaseStats: true,
    defaultIvsGl: "4/12/13",
    defaultIvsUl: "5/15/15",
    defaultFastMove: { name: "Mud Shot", type: "ground", turns: 2, power: 3, energyGain: 9 },
    chargedMoves: [
      { name: "Hydro Cannon", code: "HC", type: "water", power: 80, energyCost: 40 },
      { name: "Earthquake", code: "EQ", type: "ground", power: 120, energyCost: 65 },
      { name: "Sludge Wave", code: "SWv", type: "poison", power: 110, energyCost: 65 }
    ],
    color: "#0ea5e9"
  },
  "Mega Tyranitar": {
    speciesId: "tyranitar_mega",
    name: "Mega Tyranitar",
    baseSpecies: "tyranitar",
    formLabel: "Mega",
    types: ["rock", "dark"],
    baseStats: { atk: 309, def: 276, hp: 225 },
    isRawBaseStats: true,
    defaultIvsGl: "8/15/15",
    defaultIvsUl: "4/15/13",
    defaultFastMove: { name: "Dragon Breath", type: "dragon", turns: 1, power: 3, energyGain: 4 },
    chargedMoves: [
      { name: "Brutal Swing", code: "BS", type: "dark", power: 55, energyCost: 35 },
      { name: "Stone Edge", code: "SE", type: "rock", power: 100, energyCost: 55 },
      { name: "Crunch", code: "Cr", type: "dark", power: 70, energyCost: 45 }
    ],
    color: "#15803d"
  },
  Snorlax: {
    speciesId: "snorlax",
    name: "Snorlax",
    baseSpecies: "snorlax",
    formLabel: "Base",
    types: ["normal"],
    baseStats: { atk: 190, def: 169, hp: 330 },
    isRawBaseStats: true,
    defaultIvsGl: "4/14/5",
    defaultIvsUl: "5/15/14",
    defaultFastMove: { name: "Psywave", type: "psychic", turns: 1, power: 3, energyGain: 4 },
    chargedMoves: [
      { name: "Body Slam", code: "BS", type: "normal", power: 65, energyCost: 40 },
      { name: "Earthquake", code: "Eq", type: "ground", power: 120, energyCost: 65 },
      { name: "Superpower", code: "SpP", type: "fighting", power: 85, energyCost: 40 }
    ],
    color: "#0284c7"
  },
  Greninja: {
    speciesId: "greninja",
    name: "Greninja",
    baseSpecies: "greninja",
    formLabel: "Base",
    types: ["water", "dark"],
    baseStats: { atk: 223, def: 152, hp: 176 },
    isRawBaseStats: true,
    defaultIvsGl: "5/12/12",
    defaultIvsUl: "4/13/15",
    defaultFastMove: { name: "Water Shuriken", type: "water", turns: 3, power: 6, energyGain: 14 },
    chargedMoves: [
      { name: "Hydro Cannon", code: "HC", type: "water", power: 80, energyCost: 40 },
      { name: "Brutal Swing", code: "BrS", type: "dark", power: 55, energyCost: 35 },
      { name: "Night Slash", code: "NS", type: "dark", power: 50, energyCost: 35 }
    ],
    color: "#2563eb"
  },
  Skeledirge: {
    speciesId: "skeledirge",
    name: "Skeledirge",
    baseSpecies: "skeledirge",
    formLabel: "Base",
    types: ["fire", "ghost"],
    baseStats: { atk: 207, def: 178, hp: 232 },
    isRawBaseStats: true,
    defaultIvsGl: "4/13/11",
    defaultIvsUl: "6/15/13",
    defaultFastMove: { name: "Incinerate", type: "fire", turns: 5, power: 20, energyGain: 20 },
    chargedMoves: [
      { name: "Torch Song", code: "TrS", type: "fire", power: 70, energyCost: 45 },
      { name: "Shadow Ball", code: "SB", type: "ghost", power: 90, energyCost: 50 },
      { name: "Disarming Voice", code: "DV", type: "fairy", power: 70, energyCost: 45 }
    ],
    color: "#ef4444"
  },
  Aegislash: {
    speciesId: "aegislash",
    name: "Aegislash",
    baseSpecies: "aegislash",
    formLabel: "Shield",
    types: ["steel", "ghost"],
    baseStats: { atk: 97, def: 291, hp: 155 },
    isRawBaseStats: true,
    defaultIvsGl: "6/15/15",
    defaultIvsUl: "15/15/15",
    defaultFastMove: { name: "Psycho Cut", type: "psychic", turns: 2, power: 4, energyGain: 9 },
    chargedMoves: [
      { name: "Shadow Ball", code: "SB", type: "ghost", power: 90, energyCost: 50 },
      { name: "Flash Cannon", code: "FC", type: "steel", power: 110, energyCost: 65 },
      { name: "Gyro Ball", code: "GB", type: "steel", power: 80, energyCost: 50 }
    ],
    color: "#64748b"
  },
  Cramorant: {
    speciesId: "cramorant",
    name: "Cramorant",
    baseSpecies: "cramorant",
    formLabel: "Gulp Missile",
    types: ["flying", "water"],
    baseStats: { atk: 173, def: 163, hp: 172 },
    isRawBaseStats: true,
    defaultIvsGl: "4/15/15",
    defaultIvsUl: "15/15/15",
    defaultFastMove: { name: "Wing Attack", type: "flying", turns: 2, power: 5, energyGain: 8 },
    chargedMoves: [
      { name: "Surf", code: "Surf", type: "water", power: 75, energyCost: 45 },
      { name: "Fly", code: "Fly", type: "flying", power: 80, energyCost: 45 },
      { name: "Brave Bird", code: "BB", type: "flying", power: 130, energyCost: 55 }
    ],
    color: "#0ea5e9"
  },
  Melmetal: {
    speciesId: "melmetal",
    name: "Melmetal",
    baseSpecies: "melmetal",
    formLabel: "Base",
    types: ["steel"],
    baseStats: { atk: 226, def: 190, hp: 264 },
    isRawBaseStats: true,
    defaultIvsGl: "1/15/14",
    defaultIvsUl: "0/13/15",
    defaultFastMove: { name: "Thunder Shock", type: "electric", turns: 2, power: 4, energyGain: 9 },
    chargedMoves: [
      { name: "Double Iron Bash", code: "DIB", type: "steel", power: 70, energyCost: 35 },
      { name: "Superpower", code: "SP", type: "fighting", power: 85, energyCost: 40 },
      { name: "Rock Slide", code: "RS", type: "rock", power: 75, energyCost: 45 },
      { name: "Thunderbolt", code: "TB", type: "electric", power: 90, energyCost: 55 }
    ],
    color: "#94a3b8"
  },
  Dialga: {
    speciesId: "dialga",
    name: "Dialga",
    baseSpecies: "dialga",
    formLabel: "Altered",
    types: ["steel", "dragon"],
    baseStats: { atk: 275, def: 211, hp: 205 },
    isRawBaseStats: true,
    defaultIvsGl: "5/15/8",
    defaultIvsUl: "7/14/14",
    defaultFastMove: { name: "Dragon Breath", type: "dragon", turns: 1, power: 3, energyGain: 4 },
    chargedMoves: [
      { name: "Iron Head", code: "IH", type: "steel", power: 85, energyCost: 50 },
      { name: "Draco Meteor", code: "DM", type: "dragon", power: 150, energyCost: 65 },
      { name: "Thunder", code: "Th", type: "electric", power: 100, energyCost: 60 }
    ],
    color: "#3b82f6"
  },
  Palkia: {
    speciesId: "palkia",
    name: "Palkia",
    baseSpecies: "palkia",
    formLabel: "Altered",
    types: ["water", "dragon"],
    baseStats: { atk: 280, def: 215, hp: 189 },
    isRawBaseStats: true,
    defaultIvsGl: "7/15/13",
    defaultIvsUl: "11/13/15",
    defaultFastMove: { name: "Dragon Breath", type: "dragon", turns: 1, power: 3, energyGain: 4 },
    chargedMoves: [
      { name: "Aqua Tail", code: "AT", type: "water", power: 55, energyCost: 35 },
      { name: "Fire Blast", code: "FB", type: "fire", power: 140, energyCost: 80 },
      { name: "Draco Meteor", code: "DM", type: "dragon", power: 150, energyCost: 65 }
    ],
    color: "#0ea5e9"
  },
  Necrozma: {
    speciesId: "necrozma",
    name: "Necrozma",
    baseSpecies: "necrozma",
    formLabel: "Base",
    types: ["psychic"],
    baseStats: { atk: 251, def: 195, hp: 214 },
    isRawBaseStats: true,
    defaultIvsGl: "4/9/14",
    defaultIvsUl: "4/15/9",
    defaultFastMove: { name: "Shadow Claw", type: "ghost", turns: 2, power: 6, energyGain: 8 },
    chargedMoves: [
      { name: "Dark Pulse", code: "DP", type: "dark", power: 80, energyCost: 45 },
      { name: "Iron Head", code: "IH", type: "steel", power: 85, energyCost: 50 },
      { name: "Outrage", code: "OR", type: "dragon", power: 110, energyCost: 60 }
    ],
    color: "#475569"
  },
  "Zygarde (50% Forme)": {
    speciesId: "zygarde_50",
    name: "Zygarde (50% Forme)",
    baseSpecies: "zygarde",
    formLabel: "50%",
    types: ["dragon", "ground"],
    baseStats: { atk: 203, def: 232, hp: 216 },
    isRawBaseStats: true,
    defaultIvsGl: "1/15/15",
    defaultIvsUl: "2/15/15",
    defaultFastMove: { name: "Dragon Tail", type: "dragon", turns: 3, power: 9, energyGain: 12 },
    chargedMoves: [
      { name: "Crunch", code: "Cr", type: "dark", power: 70, energyCost: 45 },
      { name: "Earthquake", code: "EQ", type: "ground", power: 120, energyCost: 65 },
      { name: "Outrage", code: "OR", type: "dragon", power: 110, energyCost: 60 }
    ],
    color: "#059669"
  },
  "Zygarde (10% Forme)": {
    speciesId: "zygarde_10",
    name: "Zygarde (10% Forme)",
    baseSpecies: "zygarde",
    formLabel: "10%",
    types: ["dragon", "ground"],
    baseStats: { atk: 205, def: 173, hp: 144 },
    isRawBaseStats: true,
    defaultIvsGl: "4/14/15",
    defaultIvsUl: "15/15/15",
    defaultFastMove: { name: "Dragon Tail", type: "dragon", turns: 3, power: 9, energyGain: 12 },
    chargedMoves: [
      { name: "Crunch", code: "Cr", type: "dark", power: 70, energyCost: 45 },
      { name: "Earthquake", code: "EQ", type: "ground", power: 120, energyCost: 65 },
      { name: "Outrage", code: "OR", type: "dragon", power: 110, energyCost: 60 }
    ],
    color: "#34d399"
  },
  "Morpeko (Hangry)": {
    speciesId: "morpeko_hangry",
    name: "Morpeko (Hangry)",
    baseSpecies: "morpeko",
    formLabel: "Hangry",
    types: ["electric", "dark"],
    baseStats: { atk: 192, def: 121, hp: 151 },
    isRawBaseStats: true,
    defaultIvsGl: "5/14/15",
    defaultIvsUl: "15/15/15",
    defaultFastMove: { name: "Thunder Shock", type: "electric", turns: 2, power: 4, energyGain: 9 },
    chargedMoves: [
      { name: "Aura Wheel", code: "AW", type: "dark", power: 100, energyCost: 45 },
      { name: "Psychic Fangs", code: "PF", type: "psychic", power: 40, energyCost: 35 },
      { name: "Outrage", code: "OR", type: "dragon", power: 110, energyCost: 60 }
    ],
    color: "#7e22ce"
  },
  "Aegislash (Blade)": {
    speciesId: "aegislash_blade",
    name: "Aegislash (Blade)",
    baseSpecies: "aegislash",
    formLabel: "Blade",
    types: ["steel", "ghost"],
    baseStats: { atk: 291, def: 97, hp: 155 },
    isRawBaseStats: true,
    defaultIvsGl: "4/15/14",
    defaultIvsUl: "4/15/15",
    defaultFastMove: { name: "Psycho Cut", type: "psychic", turns: 2, power: 4, energyGain: 9 },
    chargedMoves: [
      { name: "Shadow Ball", code: "SB", type: "ghost", power: 90, energyCost: 50 },
      { name: "Flash Cannon", code: "FC", type: "steel", power: 110, energyCost: 65 },
      { name: "Gyro Ball", code: "GB", type: "steel", power: 80, energyCost: 50 }
    ],
    color: "#dc2626"
  },
  "Deoxys (Defense)": {
    speciesId: "deoxys_defense",
    name: "Deoxys (Defense)",
    baseSpecies: "deoxys",
    formLabel: "Defense",
    types: ["psychic"],
    baseStats: { atk: 144, def: 330, hp: 137 },
    isRawBaseStats: true,
    defaultIvsGl: "10/15/15",
    defaultIvsUl: "12/15/15",
    defaultFastMove: { name: "Counter", type: "fighting", turns: 2, power: 8, energyGain: 6 },
    chargedMoves: [
      { name: "Psycho Boost", code: "PB", type: "psychic", power: 85, energyCost: 35 },
      { name: "Rock Slide", code: "RS", type: "rock", power: 75, energyCost: 45 },
      { name: "Thunderbolt", code: "TB", type: "electric", power: 90, energyCost: 55 }
    ],
    color: "#f97316"
  },
  "Deoxys (Attack)": {
    speciesId: "deoxys_attack",
    name: "Deoxys (Attack)",
    baseSpecies: "deoxys",
    formLabel: "Attack",
    types: ["psychic"],
    baseStats: { atk: 414, def: 46, hp: 137 },
    isRawBaseStats: true,
    defaultIvsGl: "10/10/10",
    defaultIvsUl: "10/10/10",
    defaultFastMove: { name: "Poison Jab", type: "poison", turns: 2, power: 7, energyGain: 7 },
    chargedMoves: [
      { name: "Psycho Boost", code: "PB", type: "psychic", power: 85, energyCost: 35 },
      { name: "Zap Cannon", code: "ZC", type: "electric", power: 150, energyCost: 80 },
      { name: "Dark Pulse", code: "DP", type: "dark", power: 80, energyCost: 45 }
    ],
    color: "#ef4444"
  },
  Groudon: {
    speciesId: "groudon",
    name: "Groudon",
    baseSpecies: "groudon",
    formLabel: "Base",
    types: ["ground"],
    baseStats: { atk: 270, def: 228, hp: 205 },
    isRawBaseStats: true,
    defaultIvsGl: "5/14/15",
    defaultIvsUl: "4/15/14",
    defaultFastMove: { name: "Mud Shot", type: "ground", turns: 2, power: 3, energyGain: 9 },
    chargedMoves: [
      { name: "Precipice Blades", code: "PB", type: "ground", power: 130, energyCost: 60 },
      { name: "Fire Punch", code: "FP", type: "fire", power: 60, energyCost: 40 },
      { name: "Earthquake", code: "EQ", type: "ground", power: 120, energyCost: 65 }
    ],
    color: "#b91c1c"
  },
  Rayquaza: {
    speciesId: "rayquaza",
    name: "Rayquaza",
    baseSpecies: "rayquaza",
    formLabel: "Base",
    types: ["dragon", "flying"],
    baseStats: { atk: 284, def: 170, hp: 213 },
    isRawBaseStats: true,
    defaultIvsGl: "6/13/13",
    defaultIvsUl: "4/12/10",
    defaultFastMove: { name: "Dragon Tail", type: "dragon", turns: 3, power: 9, energyGain: 12 },
    chargedMoves: [
      { name: "Breaking Swipe", code: "BS", type: "dragon", power: 50, energyCost: 50 },
      { name: "Dragon Ascent", code: "DA", type: "flying", power: 110, energyCost: 45 },
      { name: "Hurricane", code: "Hur", type: "flying", power: 110, energyCost: 60 }
    ],
    color: "#16a34a"
  },
  "Piloswine": {"speciesId":"piloswine","name":"Piloswine","baseSpecies":"piloswine","types":["ice","ground"],"baseStats":{"atk":181,"def":138,"hp":225},"isRawBaseStats":true,"defaultIvsGl":"4/13/13","defaultIvsUl":"5/15/14","defaultFastMove":{"name":"Powder Snow","type":"ice","turns":2,"power":6,"energyGain":8},"chargedMoves":[{"name":"Icicle Spear","code":"IS","type":"ice","power":60,"energyCost":40},{"name":"Stone Edge","code":"SE","type":"rock","power":100,"energyCost":55},{"name":"High Horsepower","code":"HH","type":"ground","power":100,"energyCost":60}],"color":"#38bdf8"},
  "Ledian": {"speciesId":"ledian","name":"Ledian","baseSpecies":"ledian","types":["bug","flying"],"baseStats":{"atk":107,"def":179,"hp":146},"isRawBaseStats":true,"defaultIvsGl":"15/15/15","defaultIvsUl":"15/15/15","defaultFastMove":{"name":"Rollout","type":"rock","turns":3,"power":12,"energyGain":14},"chargedMoves":[{"name":"Acrobatics","code":"AC","type":"flying","power":110,"energyCost":55},{"name":"Dynamic Punch","code":"DP","type":"fighting","power":90,"energyCost":45},{"name":"Aerial Ace","code":"AA","type":"flying","power":60,"energyCost":45}],"color":"#84cc16"},
  "Arctibax": {"speciesId":"arctibax","name":"Arctibax","baseSpecies":"arctibax","types":["dragon","ice"],"baseStats":{"atk":173,"def":128,"hp":207},"isRawBaseStats":true,"defaultIvsGl":"4/15/15","defaultIvsUl":"5/15/15","defaultFastMove":{"name":"Dragon Breath","type":"dragon","turns":1,"power":3,"energyGain":4},"chargedMoves":[{"name":"Dragon Claw","code":"DC","type":"dragon","power":80,"energyCost":50},{"name":"Icy Wind","code":"IW","type":"ice","power":60,"energyCost":45},{"name":"Avalanche","code":"AV","type":"ice","power":90,"energyCost":45}],"color":"#6366f1"},
  "Swalot": {"speciesId":"swalot","name":"Swalot","baseSpecies":"swalot","types":["poison"],"baseStats":{"atk":140,"def":159,"hp":225},"isRawBaseStats":true,"defaultIvsGl":"3/15/14","defaultIvsUl":"15/15/15","defaultFastMove":{"name":"Mud Shot","type":"ground","turns":2,"power":4,"energyGain":8},"chargedMoves":[{"name":"Sludge","code":"SL","type":"poison","power":70,"energyCost":40},{"name":"Ice Beam","code":"IB","type":"ice","power":95,"energyCost":55},{"name":"Acid Spray","code":"AS","type":"poison","power":20,"energyCost":45}],"color":"#a855f7"},
  "Golisopod": {"speciesId":"golisopod","name":"Golisopod","baseSpecies":"golisopod","types":["bug","water"],"baseStats":{"atk":218,"def":226,"hp":181},"isRawBaseStats":true,"defaultIvsGl":"4/14/14","defaultIvsUl":"4/15/15","defaultFastMove":{"name":"Fury Cutter","type":"bug","turns":1,"power":3,"energyGain":4},"chargedMoves":[{"name":"Aqua Jet","code":"AJ","type":"water","power":70,"energyCost":40},{"name":"X-Scissor","code":"X-","type":"bug","power":65,"energyCost":40},{"name":"Liquidation","code":"LI","type":"water","power":70,"energyCost":45}],"color":"#84cc16"},
  "Arbok": {"speciesId":"arbok","name":"Arbok","baseSpecies":"arbok","types":["poison"],"baseStats":{"atk":167,"def":153,"hp":155},"isRawBaseStats":true,"defaultIvsGl":"4/15/14","defaultIvsUl":"15/15/15","defaultFastMove":{"name":"Acid","type":"poison","turns":2,"power":6,"energyGain":8},"chargedMoves":[{"name":"Brutal Swing","code":"BS","type":"dark","power":55,"energyCost":35},{"name":"Wrap","code":"WR","type":"normal","power":60,"energyCost":45},{"name":"Acid Spray","code":"AS","type":"poison","power":20,"energyCost":45}],"color":"#a855f7"},
  "Glalie": {"speciesId":"glalie","name":"Glalie","baseSpecies":"glalie","types":["ice"],"baseStats":{"atk":162,"def":162,"hp":190},"isRawBaseStats":true,"defaultIvsGl":"3/15/13","defaultIvsUl":"15/15/15","defaultFastMove":{"name":"Rollout","type":"rock","turns":3,"power":12,"energyGain":14},"chargedMoves":[{"name":"Shadow Ball","code":"SB","type":"ghost","power":90,"energyCost":50},{"name":"Avalanche","code":"AV","type":"ice","power":90,"energyCost":45},{"name":"Gyro Ball","code":"GB","type":"steel","power":80,"energyCost":60}],"color":"#38bdf8"},
  "Runerigus": {"speciesId":"runerigus","name":"Runerigus","baseSpecies":"runerigus","types":["ground","ghost"],"baseStats":{"atk":163,"def":237,"hp":151},"isRawBaseStats":true,"defaultIvsGl":"6/15/14","defaultIvsUl":"10/14/15","defaultFastMove":{"name":"Shadow Claw","type":"ghost","turns":2,"power":6,"energyGain":8},"chargedMoves":[{"name":"Brutal Swing","code":"BS","type":"dark","power":55,"energyCost":35},{"name":"Rock Tomb","code":"RT","type":"rock","power":75,"energyCost":50},{"name":"Shadow Ball","code":"SB","type":"ghost","power":90,"energyCost":50}],"color":"#d97706"},
  "Qwilfish": {"speciesId":"qwilfish","name":"Qwilfish","baseSpecies":"qwilfish","types":["water","poison"],"baseStats":{"atk":184,"def":138,"hp":163},"isRawBaseStats":true,"defaultIvsGl":"3/15/14","defaultIvsUl":"15/15/15","defaultFastMove":{"name":"Poison Sting","type":"poison","turns":2,"power":4,"energyGain":9},"chargedMoves":[{"name":"Aqua Tail","code":"AT","type":"water","power":55,"energyCost":35},{"name":"Shadow Ball","code":"SB","type":"ghost","power":90,"energyCost":50},{"name":"Ice Beam","code":"IB","type":"ice","power":95,"energyCost":55}],"color":"#3b82f6"},
  "Cofagrigus": {"speciesId":"cofagrigus","name":"Cofagrigus","baseSpecies":"cofagrigus","types":["ghost"],"baseStats":{"atk":163,"def":237,"hp":151},"isRawBaseStats":true,"defaultIvsGl":"6/15/14","defaultIvsUl":"10/14/15","defaultFastMove":{"name":"Shadow Claw","type":"ghost","turns":2,"power":6,"energyGain":8},"chargedMoves":[{"name":"Shadow Ball","code":"SB","type":"ghost","power":90,"energyCost":50},{"name":"Dark Pulse","code":"DP","type":"dark","power":80,"energyCost":45},{"name":"Psychic","code":"PS","type":"psychic","power":75,"energyCost":55}],"color":"#8b5cf6"},
  "Beedrill": {"speciesId":"beedrill","name":"Beedrill","baseSpecies":"beedrill","types":["bug","poison"],"baseStats":{"atk":169,"def":130,"hp":163},"isRawBaseStats":true,"defaultIvsGl":"4/15/15","defaultIvsUl":"15/15/15","defaultFastMove":{"name":"Poison Sting","type":"poison","turns":2,"power":4,"energyGain":9},"chargedMoves":[{"name":"Drill Run","code":"DR","type":"ground","power":70,"energyCost":40},{"name":"X-Scissor","code":"X-","type":"bug","power":65,"energyCost":40},{"name":"Aerial Ace","code":"AA","type":"flying","power":60,"energyCost":45}],"color":"#84cc16"},
  "Qwilfish (Hisuian)": {"speciesId":"qwilfish_hisuian","name":"Qwilfish (Hisuian)","baseSpecies":"qwilfish","types":["dark","poison"],"baseStats":{"atk":184,"def":151,"hp":163},"isRawBaseStats":true,"defaultIvsGl":"6/15/15","defaultIvsUl":"15/15/15","defaultFastMove":{"name":"Poison Sting","type":"poison","turns":2,"power":4,"energyGain":9},"chargedMoves":[{"name":"Aqua Tail","code":"AT","type":"water","power":55,"energyCost":35},{"name":"Shadow Ball","code":"SB","type":"ghost","power":90,"energyCost":50},{"name":"Dark Pulse","code":"DP","type":"dark","power":80,"energyCost":45}],"color":"#64748b"},
  "Overqwil": {"speciesId":"overqwil","name":"Overqwil","baseSpecies":"overqwil","types":["dark","poison"],"baseStats":{"atk":222,"def":171,"hp":198},"isRawBaseStats":true,"defaultIvsGl":"4/14/14","defaultIvsUl":"4/15/15","defaultFastMove":{"name":"Poison Sting","type":"poison","turns":2,"power":4,"energyGain":9},"chargedMoves":[{"name":"Aqua Tail","code":"AT","type":"water","power":55,"energyCost":35},{"name":"Shadow Ball","code":"SB","type":"ghost","power":90,"energyCost":50},{"name":"Dark Pulse","code":"DP","type":"dark","power":80,"energyCost":45}],"color":"#64748b"},
  "Golbat": {"speciesId":"golbat","name":"Golbat","baseSpecies":"golbat","types":["poison","flying"],"baseStats":{"atk":161,"def":150,"hp":181},"isRawBaseStats":true,"defaultIvsGl":"4/15/15","defaultIvsUl":"15/15/15","defaultFastMove":{"name":"Wing Attack","type":"flying","turns":2,"power":5,"energyGain":7},"chargedMoves":[{"name":"Poison Fang","code":"PF","type":"poison","power":50,"energyCost":40},{"name":"Shadow Ball","code":"SB","type":"ghost","power":90,"energyCost":50},{"name":"Air Cutter","code":"AC","type":"flying","power":45,"energyCost":35}],"color":"#a855f7"},
  "Dragalge": {"speciesId":"dragalge","name":"Dragalge","baseSpecies":"dragalge","types":["poison","dragon"],"baseStats":{"atk":177,"def":207,"hp":163},"isRawBaseStats":true,"defaultIvsGl":"4/14/15","defaultIvsUl":"9/15/15","defaultFastMove":{"name":"Acid","type":"poison","turns":2,"power":6,"energyGain":8},"chargedMoves":[{"name":"Aqua Tail","code":"AT","type":"water","power":55,"energyCost":35},{"name":"Outrage","code":"OU","type":"dragon","power":110,"energyCost":60},{"name":"Gunk Shot","code":"GS","type":"poison","power":130,"energyCost":75}],"color":"#a855f7"},
  "Audino (Mega)": {"speciesId":"audino_mega","name":"Audino (Mega)","baseSpecies":"audino","types":["normal","fairy"],"baseStats":{"atk":147,"def":239,"hp":230},"isRawBaseStats":true,"defaultIvsGl":"5/14/15","defaultIvsUl":"12/15/15","defaultFastMove":{"name":"Charge Beam","type":"electric","turns":3,"power":5,"energyGain":11},"chargedMoves":[{"name":"Body Slam","code":"BS","type":"normal","power":50,"energyCost":35},{"name":"Disarming Voice","code":"DV","type":"fairy","power":70,"energyCost":45},{"name":"Hyper Beam","code":"HB","type":"normal","power":150,"energyCost":80}],"color":"#9ca3af"},
  "Seaking": {"speciesId":"seaking","name":"Seaking","baseSpecies":"seaking","types":["water"],"baseStats":{"atk":175,"def":147,"hp":190},"isRawBaseStats":true,"defaultIvsGl":"4/14/15","defaultIvsUl":"15/15/15","defaultFastMove":{"name":"Peck","type":"flying","turns":2,"power":6,"energyGain":7},"chargedMoves":[{"name":"Drill Run","code":"DR","type":"ground","power":70,"energyCost":40},{"name":"Icy Wind","code":"IW","type":"ice","power":60,"energyCost":45},{"name":"Megahorn","code":"ME","type":"bug","power":110,"energyCost":55}],"color":"#3b82f6"},
  "Crobat": {"speciesId":"crobat","name":"Crobat","baseSpecies":"crobat","types":["poison","flying"],"baseStats":{"atk":194,"def":178,"hp":198},"isRawBaseStats":true,"defaultIvsGl":"4/15/15","defaultIvsUl":"4/14/14","defaultFastMove":{"name":"Gust","type":"flying","turns":4,"power":16,"energyGain":12},"chargedMoves":[{"name":"Poison Fang","code":"PF","type":"poison","power":50,"energyCost":40},{"name":"Shadow Ball","code":"SB","type":"ghost","power":90,"energyCost":50},{"name":"Cross Poison","code":"CP","type":"poison","power":50,"energyCost":35}],"color":"#a855f7"},
  "Grafaiai": {"speciesId":"grafaiai","name":"Grafaiai","baseSpecies":"grafaiai","types":["poison","normal"],"baseStats":{"atk":199,"def":135,"hp":160},"isRawBaseStats":true,"defaultIvsGl":"4/14/14","defaultIvsUl":"15/15/15","defaultFastMove":{"name":"Scratch","type":"normal","turns":1,"power":4,"energyGain":2},"chargedMoves":[{"name":"Poison Fang","code":"PF","type":"poison","power":50,"energyCost":40},{"name":"Foul Play","code":"FP","type":"dark","power":65,"energyCost":40},{"name":"Sludge Bomb","code":"SB","type":"poison","power":80,"energyCost":50}],"color":"#a855f7"},
  "Samurott": {"speciesId":"samurott","name":"Samurott","baseSpecies":"samurott","types":["water"],"baseStats":{"atk":212,"def":157,"hp":216},"isRawBaseStats":true,"defaultIvsGl":"4/15/15","defaultIvsUl":"5/15/15","defaultFastMove":{"name":"Fury Cutter","type":"bug","turns":1,"power":3,"energyGain":4},"chargedMoves":[{"name":"Hydro Cannon","code":"HC","type":"water","power":80,"energyCost":40},{"name":"Megahorn","code":"ME","type":"bug","power":110,"energyCost":55},{"name":"Razor Shell","code":"RS","type":"water","power":55,"energyCost":35}],"color":"#3b82f6"},
  "Goodra": {"speciesId":"goodra","name":"Goodra","baseSpecies":"goodra","types":["dragon"],"baseStats":{"atk":220,"def":242,"hp":207},"isRawBaseStats":true,"defaultIvsGl":"4/14/12","defaultIvsUl":"4/14/13","defaultFastMove":{"name":"Dragon Breath","type":"dragon","turns":1,"power":3,"energyGain":4},"chargedMoves":[{"name":"Aqua Tail","code":"AT","type":"water","power":55,"energyCost":35},{"name":"Draco Meteor","code":"DM","type":"dragon","power":150,"energyCost":65},{"name":"Thunder Punch","code":"TP","type":"electric","power":60,"energyCost":40}],"color":"#6366f1"},
  "Garchomp": {"speciesId":"garchomp","name":"Garchomp","baseSpecies":"garchomp","types":["dragon","ground"],"baseStats":{"atk":261,"def":193,"hp":239},"isRawBaseStats":true,"defaultIvsGl":"4/15/14","defaultIvsUl":"5/15/15","defaultFastMove":{"name":"Dragon Tail","type":"dragon","turns":3,"power":13,"energyGain":9},"chargedMoves":[{"name":"Twister","code":"TW","type":"dragon","power":65,"energyCost":40},{"name":"Earth Power","code":"EP","type":"ground","power":90,"energyCost":50},{"name":"Outrage","code":"OU","type":"dragon","power":110,"energyCost":60}],"color":"#6366f1"},
  "Florges": {"speciesId":"florges","name":"Florges","baseSpecies":"florges","types":["fairy"],"baseStats":{"atk":212,"def":244,"hp":186},"isRawBaseStats":true,"defaultIvsGl":"6/13/14","defaultIvsUl":"4/13/15","defaultFastMove":{"name":"Fairy Wind","type":"fairy","turns":2,"power":4,"energyGain":9},"chargedMoves":[{"name":"Moonblast","code":"MO","type":"fairy","power":90,"energyCost":50},{"name":"Chilling Water","code":"CW","type":"water","power":60,"energyCost":45},{"name":"Petal Blizzard","code":"PB","type":"grass","power":110,"energyCost":65}],"color":"#f472b6"},
  "Sableye": {"speciesId":"sableye","name":"Sableye","baseSpecies":"sableye","types":["dark","ghost"],"baseStats":{"atk":141,"def":136,"hp":137},"isRawBaseStats":true,"defaultIvsGl":"4/15/15","defaultIvsUl":"15/15/15","defaultFastMove":{"name":"Shadow Claw","type":"ghost","turns":2,"power":6,"energyGain":8},"chargedMoves":[{"name":"Foul Play","code":"FP","type":"dark","power":65,"energyCost":40},{"name":"Power Gem","code":"PG","type":"rock","power":85,"energyCost":50},{"name":"Shadow Sneak","code":"SS","type":"ghost","power":75,"energyCost":50}],"color":"#64748b"},
  "Quagsire": {"speciesId":"quagsire","name":"Quagsire","baseSpecies":"quagsire","types":["water","ground"],"baseStats":{"atk":152,"def":143,"hp":216},"isRawBaseStats":true,"defaultIvsGl":"4/15/10","defaultIvsUl":"15/15/15","defaultFastMove":{"name":"Mud Shot","type":"ground","turns":2,"power":3,"energyGain":9},"chargedMoves":[{"name":"Aqua Tail","code":"AT","type":"water","power":55,"energyCost":35},{"name":"Stone Edge","code":"SE","type":"rock","power":100,"energyCost":55},{"name":"Earthquake","code":"EA","type":"ground","power":120,"energyCost":65}],"color":"#3b82f6"},
  "Corsola (Galarian)": {"speciesId":"corsola_galarian","name":"Corsola (Galarian)","baseSpecies":"corsola","types":["ghost"],"baseStats":{"atk":116,"def":182,"hp":155},"isRawBaseStats":true,"defaultIvsGl":"4/15/14","defaultIvsUl":"15/15/15","defaultFastMove":{"name":"Astonish","type":"ghost","turns":3,"power":12,"energyGain":10},"chargedMoves":[{"name":"Night Shade","code":"NS","type":"ghost","power":70,"energyCost":45},{"name":"Power Gem","code":"PG","type":"rock","power":85,"energyCost":50},{"name":"Rock Blast","code":"RB","type":"rock","power":50,"energyCost":40}],"color":"#8b5cf6"},
  "Altaria": {"speciesId":"altaria","name":"Altaria","baseSpecies":"altaria","types":["dragon","flying"],"baseStats":{"atk":141,"def":201,"hp":181},"isRawBaseStats":true,"defaultIvsGl":"4/12/13","defaultIvsUl":"15/15/15","defaultFastMove":{"name":"Dragon Breath","type":"dragon","turns":1,"power":3,"energyGain":4},"chargedMoves":[{"name":"Moonblast","code":"MO","type":"fairy","power":90,"energyCost":50},{"name":"Flamethrower","code":"FL","type":"fire","power":90,"energyCost":55},{"name":"Dazzling Gleam","code":"DG","type":"fairy","power":90,"energyCost":55}],"color":"#6366f1"},
  "Stunfisk": {"speciesId":"stunfisk","name":"Stunfisk","baseSpecies":"stunfisk","types":["ground","electric"],"baseStats":{"atk":144,"def":171,"hp":240},"isRawBaseStats":true,"defaultIvsGl":"5/15/13","defaultIvsUl":"15/15/15","defaultFastMove":{"name":"Thunder Shock","type":"electric","turns":2,"power":4,"energyGain":9},"chargedMoves":[{"name":"Mud Bomb","code":"MB","type":"ground","power":65,"energyCost":45},{"name":"Discharge","code":"DI","type":"electric","power":55,"energyCost":40},{"name":"Muddy Water","code":"MW","type":"water","power":35,"energyCost":35}],"color":"#d97706"},
  "Ninetales": {"speciesId":"ninetales","name":"Ninetales","baseSpecies":"ninetales","types":["fire"],"baseStats":{"atk":169,"def":190,"hp":177},"isRawBaseStats":true,"defaultIvsGl":"4/15/14","defaultIvsUl":"12/15/14","defaultFastMove":{"name":"Ember","type":"fire","turns":2,"power":4,"energyGain":9},"chargedMoves":[{"name":"Weather Ball (Fire)","code":"WB","type":"fire","power":60,"energyCost":35},{"name":"Energy Ball","code":"EB","type":"grass","power":80,"energyCost":45},{"name":"Fire Blast","code":"FB","type":"fire","power":140,"energyCost":80}],"color":"#ef4444"},
  "Charjabug": {"speciesId":"charjabug","name":"Charjabug","baseSpecies":"charjabug","types":["bug","electric"],"baseStats":{"atk":145,"def":161,"hp":149},"isRawBaseStats":true,"defaultIvsGl":"4/14/15","defaultIvsUl":"15/15/15","defaultFastMove":{"name":"Volt Switch","type":"electric","turns":4,"power":14,"energyGain":16},"chargedMoves":[{"name":"X-Scissor","code":"X-","type":"bug","power":65,"energyCost":40},{"name":"Crunch","code":"CR","type":"dark","power":70,"energyCost":45},{"name":"Discharge","code":"DI","type":"electric","power":55,"energyCost":40}],"color":"#84cc16"},
  "Araquanid": {"speciesId":"araquanid","name":"Araquanid","baseSpecies":"araquanid","types":["water","bug"],"baseStats":{"atk":126,"def":219,"hp":169},"isRawBaseStats":true,"defaultIvsGl":"5/15/14","defaultIvsUl":"15/15/15","defaultFastMove":{"name":"Infestation","type":"bug","turns":3,"power":10,"energyGain":12},"chargedMoves":[{"name":"Water Pulse","code":"WP","type":"water","power":80,"energyCost":50},{"name":"Mirror Coat","code":"MC","type":"psychic","power":75,"energyCost":45},{"name":"Bug Buzz","code":"BB","type":"bug","power":100,"energyCost":60}],"color":"#3b82f6"},
  "Vigoroth": {"speciesId":"vigoroth","name":"Vigoroth","baseSpecies":"vigoroth","types":["normal"],"baseStats":{"atk":159,"def":145,"hp":190},"isRawBaseStats":true,"defaultIvsGl":"4/15/14","defaultIvsUl":"15/15/15","defaultFastMove":{"name":"Scratch","type":"normal","turns":1,"power":3,"energyGain":4},"chargedMoves":[{"name":"Body Slam","code":"BS","type":"normal","power":65,"energyCost":40},{"name":"Bulldoze","code":"BU","type":"ground","power":80,"energyCost":55},{"name":"Brick Break","code":"BB","type":"fighting","power":50,"energyCost":40}],"color":"#9ca3af"},
  "Electrode (Hisuian)": {"speciesId":"electrode_hisuian","name":"Electrode (Hisuian)","baseSpecies":"electrode","types":["electric","grass"],"baseStats":{"atk":176,"def":176,"hp":155},"isRawBaseStats":true,"defaultIvsGl":"5/13/14","defaultIvsUl":"15/15/15","defaultFastMove":{"name":"Thunder Shock","type":"electric","turns":2,"power":4,"energyGain":9},"chargedMoves":[{"name":"Wild Charge","code":"WC","type":"electric","power":100,"energyCost":45},{"name":"Energy Ball","code":"EB","type":"grass","power":80,"energyCost":45},{"name":"Swift","code":"SW","type":"normal","power":55,"energyCost":35}],"color":"#eab308"},
  "Thievul": {"speciesId":"thievul","name":"Thievul","baseSpecies":"thievul","types":["dark"],"baseStats":{"atk":172,"def":164,"hp":172},"isRawBaseStats":true,"defaultIvsGl":"4/15/15","defaultIvsUl":"15/15/15","defaultFastMove":{"name":"Sucker Punch","type":"dark","turns":2,"power":8,"energyGain":7},"chargedMoves":[{"name":"Night Slash","code":"NS","type":"dark","power":50,"energyCost":35},{"name":"Icy Wind","code":"IW","type":"ice","power":60,"energyCost":45},{"name":"Play Rough","code":"PR","type":"fairy","power":90,"energyCost":60}],"color":"#64748b"},
  "Hydreigon": {"speciesId":"hydreigon","name":"Hydreigon","baseSpecies":"hydreigon","types":["dark","dragon"],"baseStats":{"atk":256,"def":188,"hp":211},"isRawBaseStats":true,"defaultIvsGl":"7/14/14","defaultIvsUl":"6/15/14","defaultFastMove":{"name":"Dragon Breath","type":"dragon","turns":1,"power":3,"energyGain":4},"chargedMoves":[{"name":"Brutal Swing","code":"BS","type":"dark","power":55,"energyCost":35},{"name":"Dragon Pulse","code":"DP","type":"dragon","power":90,"energyCost":55},{"name":"Dark Pulse","code":"DP","type":"dark","power":80,"energyCost":45}],"color":"#64748b"},
  "Empoleon": {"speciesId":"empoleon","name":"Empoleon","baseSpecies":"empoleon","types":["water","steel"],"baseStats":{"atk":210,"def":186,"hp":197},"isRawBaseStats":true,"defaultIvsGl":"5/15/13","defaultIvsUl":"6/15/14","defaultFastMove":{"name":"Metal Sound","type":"steel","turns":2,"power":5,"energyGain":8},"chargedMoves":[{"name":"Hydro Cannon","code":"HC","type":"water","power":80,"energyCost":40},{"name":"Drill Peck","code":"DP","type":"flying","power":70,"energyCost":40},{"name":"Blizzard","code":"BL","type":"ice","power":140,"energyCost":75}],"color":"#3b82f6"},
  "Jumpluff": {"speciesId":"jumpluff","name":"Jumpluff","baseSpecies":"jumpluff","types":["grass","flying"],"baseStats":{"atk":118,"def":183,"hp":181},"isRawBaseStats":true,"defaultIvsGl":"4/15/12","defaultIvsUl":"15/15/15","defaultFastMove":{"name":"Fairy Wind","type":"fairy","turns":2,"power":4,"energyGain":9},"chargedMoves":[{"name":"Energy Ball","code":"EB","type":"grass","power":80,"energyCost":45},{"name":"Acrobatics","code":"AC","type":"flying","power":110,"energyCost":55},{"name":"Dazzling Gleam","code":"DG","type":"fairy","power":90,"energyCost":55}],"color":"#22c55e"},
  "Ursaluna": {"speciesId":"ursaluna","name":"Ursaluna","baseSpecies":"ursaluna","types":["ground","normal"],"baseStats":{"atk":243,"def":181,"hp":277},"isRawBaseStats":true,"defaultIvsGl":"4/13/7","defaultIvsUl":"4/10/15","defaultFastMove":{"name":"Scratch","type":"normal","turns":1,"power":3,"energyGain":4},"chargedMoves":[{"name":"Swift","code":"SW","type":"normal","power":55,"energyCost":35},{"name":"High Horsepower","code":"HH","type":"ground","power":100,"energyCost":55},{"name":"Fire Punch","code":"FP","type":"fire","power":60,"energyCost":40}],"color":"#d97706"},
  "Jellicent": {"speciesId":"jellicent","name":"Jellicent","baseSpecies":"jellicent","types":["water","ghost"],"baseStats":{"atk":159,"def":178,"hp":225},"isRawBaseStats":true,"defaultIvsGl":"4/15/14","defaultIvsUl":"12/14/12","defaultFastMove":{"name":"Hex","type":"ghost","turns":3,"power":7,"energyGain":13},"chargedMoves":[{"name":"Surf","code":"SU","type":"water","power":75,"energyCost":45},{"name":"Shadow Ball","code":"SB","type":"ghost","power":90,"energyCost":50},{"name":"Ice Beam","code":"IB","type":"ice","power":90,"energyCost":55}],"color":"#3b82f6"},
  "Greedent": {"speciesId":"greedent","name":"Greedent","baseSpecies":"greedent","types":["normal"],"baseStats":{"atk":160,"def":156,"hp":260},"isRawBaseStats":true,"defaultIvsGl":"5/15/14","defaultIvsUl":"4/15/15","defaultFastMove":{"name":"Mud Shot","type":"ground","turns":2,"power":3,"energyGain":9},"chargedMoves":[{"name":"Body Slam","code":"BS","type":"normal","power":65,"energyCost":40},{"name":"Trailblaze","code":"TR","type":"grass","power":65,"energyCost":45},{"name":"Crunch","code":"CR","type":"dark","power":70,"energyCost":45}],"color":"#9ca3af"},
  "Muk (Alolan)": {"speciesId":"muk_alolan","name":"Muk (Alolan)","baseSpecies":"muk","types":["poison","dark"],"baseStats":{"atk":190,"def":172,"hp":233},"isRawBaseStats":true,"defaultIvsGl":"4/15/15","defaultIvsUl":"4/15/15","defaultFastMove":{"name":"Bite","type":"dark","turns":1,"power":2,"energyGain":4},"chargedMoves":[{"name":"Brutal Swing","code":"BS","type":"dark","power":55,"energyCost":35},{"name":"Ice Punch","code":"IP","type":"ice","power":60,"energyCost":40},{"name":"Dark Pulse","code":"DP","type":"dark","power":80,"energyCost":45}],"color":"#a855f7"},
  "Weezing (Galarian)": {"speciesId":"weezing_galarian","name":"Weezing (Galarian)","baseSpecies":"weezing","types":["poison","fairy"],"baseStats":{"atk":174,"def":197,"hp":163},"isRawBaseStats":true,"defaultIvsGl":"4/14/13","defaultIvsUl":"12/14/13","defaultFastMove":{"name":"Fairy Wind","type":"fairy","turns":2,"power":4,"energyGain":9},"chargedMoves":[{"name":"Overheat","code":"OV","type":"fire","power":130,"energyCost":55},{"name":"Sludge","code":"SL","type":"poison","power":70,"energyCost":40},{"name":"Hyper Beam","code":"HB","type":"normal","power":150,"energyCost":80}],"color":"#a855f7"},
  "Moltres (Galarian)": {"speciesId":"moltres_galarian","name":"Moltres (Galarian)","baseSpecies":"moltres","types":["dark","flying"],"baseStats":{"atk":202,"def":231,"hp":207},"isRawBaseStats":true,"defaultIvsGl":"4/10/15","defaultIvsUl":"4/11/11","defaultFastMove":{"name":"Sucker Punch","type":"dark","turns":2,"power":8,"energyGain":7},"chargedMoves":[{"name":"Fly","code":"FL","type":"flying","power":80,"energyCost":45},{"name":"Payback","code":"PA","type":"dark","power":110,"energyCost":60},{"name":"Ancient Power","code":"AP","type":"rock","power":60,"energyCost":45}],"color":"#64748b"},
  "Drapion": {"speciesId":"drapion","name":"Drapion","baseSpecies":"drapion","types":["poison","dark"],"baseStats":{"atk":180,"def":202,"hp":172},"isRawBaseStats":true,"defaultIvsGl":"6/14/15","defaultIvsUl":"4/15/15","defaultFastMove":{"name":"Poison Sting","type":"poison","turns":2,"power":4,"energyGain":9},"chargedMoves":[{"name":"Crunch","code":"CR","type":"dark","power":70,"energyCost":45},{"name":"Aqua Tail","code":"AT","type":"water","power":55,"energyCost":35},{"name":"Sludge Bomb","code":"SB","type":"poison","power":80,"energyCost":50}],"color":"#a855f7"},
  "Dusknoir": {"speciesId":"dusknoir","name":"Dusknoir","baseSpecies":"dusknoir","types":["ghost"],"baseStats":{"atk":180,"def":254,"hp":128},"isRawBaseStats":true,"defaultIvsGl":"5/15/11","defaultIvsUl":"4/13/15","defaultFastMove":{"name":"Astonish","type":"ghost","turns":3,"power":12,"energyGain":10},"chargedMoves":[{"name":"Dynamic Punch","code":"DP","type":"fighting","power":90,"energyCost":45},{"name":"Shadow Punch","code":"SP","type":"ghost","power":55,"energyCost":35},{"name":"Dark Pulse","code":"DP","type":"dark","power":80,"energyCost":45}],"color":"#8b5cf6"},
  "Togekiss": {"speciesId":"togekiss","name":"Togekiss","baseSpecies":"togekiss","types":["fairy","flying"],"baseStats":{"atk":225,"def":217,"hp":198},"isRawBaseStats":true,"defaultIvsGl":"4/15/15","defaultIvsUl":"5/13/15","defaultFastMove":{"name":"Peck","type":"flying","turns":2,"power":6,"energyGain":8},"chargedMoves":[{"name":"Dazzling Gleam","code":"DG","type":"fairy","power":90,"energyCost":55},{"name":"Aura Sphere","code":"AS","type":"fighting","power":80,"energyCost":40},{"name":"Aerial Ace","code":"AA","type":"flying","power":60,"energyCost":45}],"color":"#f472b6"},
  "Rapidash": {"speciesId":"rapidash","name":"Rapidash","baseSpecies":"rapidash","types":["fire"],"baseStats":{"atk":207,"def":162,"hp":163},"isRawBaseStats":true,"defaultIvsGl":"4/14/15","defaultIvsUl":"4/13/14","defaultFastMove":{"name":"Incinerate","type":"fire","turns":5,"power":20,"energyGain":20},"chargedMoves":[{"name":"Wild Charge","code":"WC","type":"electric","power":100,"energyCost":45},{"name":"Drill Run","code":"DR","type":"ground","power":70,"energyCost":40},{"name":"Fire Blast","code":"FB","type":"fire","power":140,"energyCost":80}],"color":"#ef4444"},
  "Scizor": {"speciesId":"scizor","name":"Scizor","baseSpecies":"scizor","types":["bug","steel"],"baseStats":{"atk":236,"def":181,"hp":172},"isRawBaseStats":true,"defaultIvsGl":"4/14/12","defaultIvsUl":"4/15/14","defaultFastMove":{"name":"Bullet Punch","type":"steel","turns":2,"power":7,"energyGain":7},"chargedMoves":[{"name":"Night Slash","code":"NS","type":"dark","power":50,"energyCost":35},{"name":"Trailblaze","code":"TR","type":"grass","power":65,"energyCost":45},{"name":"Iron Head","code":"IH","type":"steel","power":85,"energyCost":50}],"color":"#84cc16"},
  "Aromatisse": {"speciesId":"aromatisse","name":"Aromatisse","baseSpecies":"aromatisse","types":["fairy"],"baseStats":{"atk":173,"def":150,"hp":226},"isRawBaseStats":true,"defaultIvsGl":"4/14/13","defaultIvsUl":"12/14/14","defaultFastMove":{"name":"Fairy Wind","type":"fairy","turns":2,"power":4,"energyGain":9},"chargedMoves":[{"name":"Moonblast","code":"MO","type":"fairy","power":90,"energyCost":50},{"name":"Psyshock","code":"PS","type":"psychic","power":70,"energyCost":40},{"name":"Thunderbolt","code":"TH","type":"electric","power":90,"energyCost":55}],"color":"#f472b6"},
  "Doublade": {"speciesId":"doublade","name":"Doublade","baseSpecies":"doublade","types":["steel","ghost"],"baseStats":{"atk":188,"def":206,"hp":153},"isRawBaseStats":true,"defaultIvsGl":"6/15/15","defaultIvsUl":"4/15/14","defaultFastMove":{"name":"Shadow Claw","type":"ghost","turns":2,"power":6,"energyGain":8},"chargedMoves":[{"name":"Sacred Sword","code":"SS","type":"fighting","power":60,"energyCost":35},{"name":"Iron Head","code":"IH","type":"steel","power":85,"energyCost":50},{"name":"Gyro Ball","code":"GB","type":"steel","power":80,"energyCost":50}],"color":"#94a3b8"},
  "Genesect": {"speciesId":"genesect","name":"Genesect","baseSpecies":"genesect","types":["bug","steel"],"baseStats":{"atk":252,"def":199,"hp":174},"isRawBaseStats":true,"defaultIvsGl":"12/10/15","defaultIvsUl":"10/13/10","defaultFastMove":{"name":"Fury Cutter","type":"bug","turns":1,"power":3,"energyGain":4},"chargedMoves":[{"name":"Magnet Bomb","code":"MB","type":"steel","power":70,"energyCost":40},{"name":"Techno Blast (Normal)","code":"TB","type":"normal","power":120,"energyCost":55},{"name":"X-Scissor","code":"X-","type":"bug","power":65,"energyCost":40}],"color":"#84cc16"},
  "Nidoking": {"speciesId":"nidoking","name":"Nidoking","baseSpecies":"nidoking","types":["poison","ground"],"baseStats":{"atk":204,"def":156,"hp":191},"isRawBaseStats":true,"defaultIvsGl":"5/14/15","defaultIvsUl":"4/15/14","defaultFastMove":{"name":"Poison Sting","type":"poison","turns":2,"power":4,"energyGain":9},"chargedMoves":[{"name":"Avalanche","code":"AV","type":"ice","power":90,"energyCost":45},{"name":"Earth Power","code":"EP","type":"ground","power":90,"energyCost":50},{"name":"Earthquake","code":"EA","type":"ground","power":120,"energyCost":65}],"color":"#a855f7"},
  "Malamar (Mega)": {"speciesId":"malamar_mega","name":"Malamar (Mega)","baseSpecies":"malamar","types":["dark","psychic"],"baseStats":{"atk":208,"def":222,"hp":200},"isRawBaseStats":true,"defaultIvsGl":"4/15/15","defaultIvsUl":"4/15/11","defaultFastMove":{"name":"Psywave","type":"psychic","turns":1,"power":3,"energyGain":4},"chargedMoves":[{"name":"Foul Play","code":"FP","type":"dark","power":65,"energyCost":40},{"name":"Superpower","code":"SU","type":"fighting","power":85,"energyCost":40},{"name":"Psybeam+","code":"PS","type":"psychic","power":60,"energyCost":45}],"color":"#64748b"},
  "Reshiram": {"speciesId":"reshiram","name":"Reshiram","baseSpecies":"reshiram","types":["dragon","fire"],"baseStats":{"atk":275,"def":211,"hp":205},"isRawBaseStats":true,"defaultIvsGl":"7/11/14","defaultIvsUl":"6/14/12","defaultFastMove":{"name":"Dragon Breath","type":"dragon","turns":1,"power":3,"energyGain":4},"chargedMoves":[{"name":"Crunch","code":"CR","type":"dark","power":70,"energyCost":45},{"name":"Fusion Flare","code":"FF","type":"fire","power":90,"energyCost":45},{"name":"Overheat","code":"OV","type":"fire","power":130,"energyCost":55}],"color":"#6366f1"},
  "Metagross": {"speciesId":"metagross","name":"Metagross","baseSpecies":"metagross","types":["steel","psychic"],"baseStats":{"atk":257,"def":228,"hp":190},"isRawBaseStats":true,"defaultIvsGl":"4/12/15","defaultIvsUl":"5/14/15","defaultFastMove":{"name":"Shadow Claw","type":"ghost","turns":2,"power":6,"energyGain":8},"chargedMoves":[{"name":"Meteor Mash","code":"MM","type":"steel","power":100,"energyCost":45},{"name":"Earthquake","code":"EA","type":"ground","power":120,"energyCost":65},{"name":"Flash Cannon","code":"FC","type":"steel","power":110,"energyCost":65}],"color":"#94a3b8"},
  "Lunala": {"speciesId":"lunala","name":"Lunala","baseSpecies":"lunala","types":["psychic","ghost"],"baseStats":{"atk":255,"def":191,"hp":264},"isRawBaseStats":true,"defaultIvsGl":"4/15/12","defaultIvsUl":"5/13/5","defaultFastMove":{"name":"Shadow Claw","type":"ghost","turns":2,"power":6,"energyGain":8},"chargedMoves":[{"name":"Shadow Ball","code":"SB","type":"ghost","power":90,"energyCost":50},{"name":"Moonblast","code":"MO","type":"fairy","power":90,"energyCost":50},{"name":"Psychic","code":"PS","type":"psychic","power":75,"energyCost":55}],"color":"#ec4899"},
  "Eternatus": {"speciesId":"eternatus","name":"Eternatus","baseSpecies":"eternatus","types":["poison","dragon"],"baseStats":{"atk":278,"def":192,"hp":268},"isRawBaseStats":true,"defaultIvsGl":"12/15/14","defaultIvsUl":"14/14/11","defaultFastMove":{"name":"Dragon Tail","type":"dragon","turns":3,"power":9,"energyGain":12},"chargedMoves":[{"name":"Dynamax Cannon","code":"DC","type":"dragon","power":80,"energyCost":45},{"name":"Sludge Bomb","code":"SB","type":"poison","power":80,"energyCost":50},{"name":"Flamethrower","code":"FL","type":"fire","power":90,"energyCost":55}],"color":"#a855f7"},
  "Xerneas": {"speciesId":"xerneas","name":"Xerneas","baseSpecies":"xerneas","types":["fairy"],"baseStats":{"atk":250,"def":185,"hp":246},"isRawBaseStats":true,"defaultIvsGl":"7/13/11","defaultIvsUl":"4/14/8","defaultFastMove":{"name":"Geomancy","type":"fairy","turns":3,"power":8,"energyGain":13},"chargedMoves":[{"name":"Close Combat","code":"CC","type":"fighting","power":100,"energyCost":45},{"name":"Moonblast","code":"MO","type":"fairy","power":90,"energyCost":50},{"name":"Megahorn","code":"ME","type":"bug","power":110,"energyCost":55}],"color":"#f472b6"},
  "Zekrom": {"speciesId":"zekrom","name":"Zekrom","baseSpecies":"zekrom","types":["dragon","electric"],"baseStats":{"atk":275,"def":211,"hp":205},"isRawBaseStats":true,"defaultIvsGl":"7/11/14","defaultIvsUl":"6/14/12","defaultFastMove":{"name":"Dragon Breath","type":"dragon","turns":1,"power":3,"energyGain":4},"chargedMoves":[{"name":"Outrage","code":"OU","type":"dragon","power":110,"energyCost":60},{"name":"Fusion Bolt","code":"FB","type":"electric","power":90,"energyCost":45},{"name":"Wild Charge","code":"WC","type":"electric","power":100,"energyCost":45}],"color":"#6366f1"},
  "Blastoise (Mega)": {"speciesId":"blastoise_mega","name":"Blastoise (Mega)","baseSpecies":"blastoise","types":["water"],"baseStats":{"atk":264,"def":237,"hp":188},"isRawBaseStats":true,"defaultIvsGl":"4/10/15","defaultIvsUl":"4/15/15","defaultFastMove":{"name":"Rollout","type":"rock","turns":3,"power":7,"energyGain":13},"chargedMoves":[{"name":"Hydro Cannon","code":"HC","type":"water","power":80,"energyCost":40},{"name":"Ice Beam","code":"IB","type":"ice","power":90,"energyCost":55},{"name":"Flash Cannon","code":"FC","type":"steel","power":110,"energyCost":65}],"color":"#3b82f6"},
  "Meloetta (Aria)": {"speciesId":"meloetta_aria","name":"Meloetta (Aria)","baseSpecies":"meloetta","types":["normal","psychic"],"baseStats":{"atk":250,"def":225,"hp":225},"isRawBaseStats":true,"defaultIvsGl":"12/14/10","defaultIvsUl":"10/12/14","defaultFastMove":{"name":"Confusion","type":"psychic","turns":4,"power":16,"energyGain":14},"chargedMoves":[{"name":"Psyshock","code":"PS","type":"psychic","power":70,"energyCost":40},{"name":"Dazzling Gleam","code":"DG","type":"fairy","power":90,"energyCost":55},{"name":"Thunderbolt","code":"TH","type":"electric","power":90,"energyCost":55}],"color":"#9ca3af"},
  "Aggron (Mega)": {"speciesId":"aggron_mega","name":"Aggron (Mega)","baseSpecies":"aggron","types":["steel"],"baseStats":{"atk":247,"def":331,"hp":172},"isRawBaseStats":true,"defaultIvsGl":"8/13/15","defaultIvsUl":"4/15/14","defaultFastMove":{"name":"Dragon Tail","type":"dragon","turns":3,"power":9,"energyGain":12},"chargedMoves":[{"name":"Heavy Slam","code":"HS","type":"steel","power":70,"energyCost":50},{"name":"Stone Edge","code":"SE","type":"rock","power":100,"energyCost":55},{"name":"Thunder","code":"TH","type":"electric","power":100,"energyCost":60}],"color":"#94a3b8"},
  "Scizor (Mega)": {"speciesId":"scizor_mega","name":"Scizor (Mega)","baseSpecies":"scizor","types":["bug","steel"],"baseStats":{"atk":279,"def":250,"hp":172},"isRawBaseStats":true,"defaultIvsGl":"4/10/14","defaultIvsUl":"4/9/15","defaultFastMove":{"name":"Bullet Punch","type":"steel","turns":2,"power":7,"energyGain":7},"chargedMoves":[{"name":"Night Slash","code":"NS","type":"dark","power":50,"energyCost":35},{"name":"Return","code":"RE","type":"normal","power":130,"energyCost":70},{"name":"Iron Head","code":"IH","type":"steel","power":85,"energyCost":50}],"color":"#84cc16"},
  "Marshadow": {"speciesId":"marshadow","name":"Marshadow","baseSpecies":"marshadow","types":["fighting","ghost"],"baseStats":{"atk":265,"def":190,"hp":207},"isRawBaseStats":true,"defaultIvsGl":"15/15/14","defaultIvsUl":"11/14/10","defaultFastMove":{"name":"Shadow Claw","type":"ghost","turns":2,"power":6,"energyGain":8},"chargedMoves":[{"name":"Close Combat","code":"CC","type":"fighting","power":100,"energyCost":45},{"name":"Thunder Punch","code":"TP","type":"electric","power":60,"energyCost":40},{"name":"Fire Punch","code":"FP","type":"fire","power":60,"energyCost":40}],"color":"#f97316"},
  "Gyarados": {"speciesId":"gyarados","name":"Gyarados","baseSpecies":"gyarados","types":["water","flying"],"baseStats":{"atk":237,"def":186,"hp":216},"isRawBaseStats":true,"defaultIvsGl":"4/14/7","defaultIvsUl":"5/13/15","defaultFastMove":{"name":"Dragon Breath","type":"dragon","turns":1,"power":3,"energyGain":4},"chargedMoves":[{"name":"Aqua Tail","code":"AT","type":"water","power":55,"energyCost":35},{"name":"Twister","code":"TW","type":"dragon","power":70,"energyCost":40},{"name":"Crunch","code":"CR","type":"dark","power":70,"energyCost":45}],"color":"#3b82f6"},
  "Swampert (Mega)": {"speciesId":"swampert_mega","name":"Swampert (Mega)","baseSpecies":"swampert","types":["water","ground"],"baseStats":{"atk":283,"def":218,"hp":225},"isRawBaseStats":true,"defaultIvsGl":"4/12/13","defaultIvsUl":"5/15/15","defaultFastMove":{"name":"Mud Shot","type":"ground","turns":2,"power":3,"energyGain":9},"chargedMoves":[{"name":"Earthquake","code":"EA","type":"ground","power":120,"energyCost":65},{"name":"Sludge Wave","code":"SW","type":"poison","power":110,"energyCost":65},{"name":"Surf","code":"SU","type":"water","power":75,"energyCost":45}],"color":"#3b82f6"},
  "Latios (Mega)": {"speciesId":"latios_mega","name":"Latios (Mega)","baseSpecies":"latios","types":["dragon","psychic"],"baseStats":{"atk":335,"def":241,"hp":190},"isRawBaseStats":true,"defaultIvsGl":"4/9/12","defaultIvsUl":"6/13/13","defaultFastMove":{"name":"Dragon Breath","type":"dragon","turns":1,"power":3,"energyGain":4},"chargedMoves":[{"name":"Dragon Claw","code":"DC","type":"dragon","power":80,"energyCost":50},{"name":"Psychic","code":"PS","type":"psychic","power":75,"energyCost":55},{"name":"Solar Beam","code":"SB","type":"grass","power":150,"energyCost":80}],"color":"#6366f1"},
  "Gardevoir (Mega)": {"speciesId":"gardevoir_mega","name":"Gardevoir (Mega)","baseSpecies":"gardevoir","types":["psychic","fairy"],"baseStats":{"atk":326,"def":229,"hp":169},"isRawBaseStats":true,"defaultIvsGl":"5/14/15","defaultIvsUl":"6/14/14","defaultFastMove":{"name":"Confusion","type":"psychic","turns":4,"power":16,"energyGain":14},"chargedMoves":[{"name":"Triple Axel","code":"TA","type":"ice","power":60,"energyCost":45},{"name":"Shadow Ball","code":"SB","type":"ghost","power":90,"energyCost":50},{"name":"Dazzling Gleam","code":"DG","type":"fairy","power":90,"energyCost":55}],"color":"#ec4899"},
  "Charizard (Mega X)": {"speciesId":"charizard_mega_x","name":"Charizard (Mega X)","baseSpecies":"charizard","types":["fire","dragon"],"baseStats":{"atk":273,"def":213,"hp":186},"isRawBaseStats":true,"defaultIvsGl":"4/14/7","defaultIvsUl":"6/14/15","defaultFastMove":{"name":"Dragon Breath","type":"dragon","turns":1,"power":3,"energyGain":4},"chargedMoves":[{"name":"Blast Burn","code":"BB","type":"fire","power":110,"energyCost":50},{"name":"Dragon Claw","code":"DC","type":"dragon","power":80,"energyCost":50},{"name":"Fire Blast","code":"FB","type":"fire","power":140,"energyCost":80}],"color":"#ef4444"},
  "Gengar (Mega)": {"speciesId":"gengar_mega","name":"Gengar (Mega)","baseSpecies":"gengar","types":["ghost","poison"],"baseStats":{"atk":349,"def":199,"hp":155},"isRawBaseStats":true,"defaultIvsGl":"5/13/15","defaultIvsUl":"4/15/12","defaultFastMove":{"name":"Shadow Claw","type":"ghost","turns":2,"power":6,"energyGain":8},"chargedMoves":[{"name":"Shadow Punch","code":"SP","type":"ghost","power":55,"energyCost":35},{"name":"Dark Pulse","code":"DP","type":"dark","power":80,"energyCost":45},{"name":"Focus Blast","code":"FB","type":"fighting","power":150,"energyCost":75}],"color":"#8b5cf6"},
  "Rhyperior": {"speciesId":"rhyperior","name":"Rhyperior","baseSpecies":"rhyperior","types":["ground","rock"],"baseStats":{"atk":241,"def":190,"hp":251},"isRawBaseStats":true,"defaultIvsGl":"4/12/8","defaultIvsUl":"5/14/14","defaultFastMove":{"name":"Mud Slap","type":"ground","turns":3,"power":11,"energyGain":10},"chargedMoves":[{"name":"Drill Run","code":"DR","type":"ground","power":70,"energyCost":40},{"name":"Rock Wrecker","code":"RW","type":"rock","power":110,"energyCost":50},{"name":"Earthquake","code":"EA","type":"ground","power":120,"energyCost":65}],"color":"#d97706"},
  "Gallade (Mega)": {"speciesId":"gallade_mega","name":"Gallade (Mega)","baseSpecies":"gallade","types":["psychic","fighting"],"baseStats":{"atk":326,"def":230,"hp":169},"isRawBaseStats":true,"defaultIvsGl":"4/14/15","defaultIvsUl":"4/15/14","defaultFastMove":{"name":"Confusion","type":"psychic","turns":4,"power":16,"energyGain":14},"chargedMoves":[{"name":"Close Combat","code":"CC","type":"fighting","power":100,"energyCost":45},{"name":"Leaf Blade","code":"LB","type":"grass","power":70,"energyCost":35},{"name":"Psychic","code":"PS","type":"psychic","power":75,"energyCost":55}],"color":"#ec4899"},
  "Latias (Mega)": {"speciesId":"latias_mega","name":"Latias (Mega)","baseSpecies":"latias","types":["dragon","psychic"],"baseStats":{"atk":289,"def":297,"hp":190},"isRawBaseStats":true,"defaultIvsGl":"5/8/12","defaultIvsUl":"6/12/11","defaultFastMove":{"name":"Dragon Breath","type":"dragon","turns":1,"power":3,"energyGain":4},"chargedMoves":[{"name":"Outrage","code":"OU","type":"dragon","power":110,"energyCost":60},{"name":"Psychic","code":"PS","type":"psychic","power":75,"energyCost":55},{"name":"Thunder","code":"TH","type":"electric","power":100,"energyCost":60}],"color":"#6366f1"},
  "Hypno": {"speciesId":"hypno","name":"Hypno","baseSpecies":"hypno","types":["psychic"],"baseStats":{"atk":144,"def":193,"hp":198},"isRawBaseStats":true,"defaultIvsGl":"5/13/14","defaultIvsUl":"15/15/15","defaultFastMove":{"name":"Confusion","type":"psychic","turns":4,"power":16,"energyGain":14},"chargedMoves":[{"name":"Psyshock","code":"PS","type":"psychic","power":70,"energyCost":40},{"name":"Shadow Ball","code":"SB","type":"ghost","power":90,"energyCost":50},{"name":"Focus Blast","code":"FB","type":"fighting","power":150,"energyCost":75}],"color":"#ec4899"},
  "Tentacruel": {"speciesId":"tentacruel","name":"Tentacruel","baseSpecies":"tentacruel","types":["water","poison"],"baseStats":{"atk":166,"def":209,"hp":190},"isRawBaseStats":true,"defaultIvsGl":"4/15/15","defaultIvsUl":"4/14/14","defaultFastMove":{"name":"Acid","type":"poison","turns":2,"power":6,"energyGain":8},"chargedMoves":[{"name":"Scald","code":"SC","type":"water","power":85,"energyCost":50},{"name":"Payback","code":"PA","type":"dark","power":110,"energyCost":60},{"name":"Blizzard","code":"BL","type":"ice","power":140,"energyCost":75}],"color":"#3b82f6"},
  "Dewgong": {"speciesId":"dewgong","name":"Dewgong","baseSpecies":"dewgong","types":["water","ice"],"baseStats":{"atk":139,"def":177,"hp":207},"isRawBaseStats":true,"defaultIvsGl":"4/15/14","defaultIvsUl":"15/15/15","defaultFastMove":{"name":"Ice Shard","type":"ice","turns":3,"power":9,"energyGain":10},"chargedMoves":[{"name":"Icy Wind","code":"IW","type":"ice","power":60,"energyCost":45},{"name":"Drill Run","code":"DR","type":"ground","power":70,"energyCost":40},{"name":"Aqua Jet","code":"AJ","type":"water","power":70,"energyCost":40}],"color":"#3b82f6"},
  "Grumpig": {"speciesId":"grumpig","name":"Grumpig","baseSpecies":"grumpig","types":["psychic"],"baseStats":{"atk":171,"def":188,"hp":190},"isRawBaseStats":true,"defaultIvsGl":"4/15/15","defaultIvsUl":"5/14/15","defaultFastMove":{"name":"Psywave","type":"psychic","turns":1,"power":3,"energyGain":4},"chargedMoves":[{"name":"Mirror Coat","code":"MC","type":"psychic","power":75,"energyCost":45},{"name":"Shadow Ball","code":"SB","type":"ghost","power":90,"energyCost":50},{"name":"Psychic","code":"PS","type":"psychic","power":75,"energyCost":55}],"color":"#ec4899"},
  "Starmie": {"speciesId":"starmie","name":"Starmie","baseSpecies":"starmie","types":["water","psychic"],"baseStats":{"atk":210,"def":184,"hp":155},"isRawBaseStats":true,"defaultIvsGl":"5/13/13","defaultIvsUl":"4/14/15","defaultFastMove":{"name":"Psywave","type":"psychic","turns":1,"power":3,"energyGain":4},"chargedMoves":[{"name":"Aqua Jet","code":"AJ","type":"water","power":70,"energyCost":40},{"name":"Power Gem","code":"PG","type":"rock","power":85,"energyCost":50},{"name":"Hydro Pump","code":"HP","type":"water","power":130,"energyCost":75}],"color":"#3b82f6"},
  "Slowbro": {"speciesId":"slowbro","name":"Slowbro","baseSpecies":"slowbro","types":["water","psychic"],"baseStats":{"atk":177,"def":180,"hp":216},"isRawBaseStats":true,"defaultIvsGl":"4/13/15","defaultIvsUl":"5/14/15","defaultFastMove":{"name":"Confusion","type":"psychic","turns":4,"power":16,"energyGain":14},"chargedMoves":[{"name":"Surf","code":"SU","type":"water","power":75,"energyCost":45},{"name":"Drain Punch","code":"DP","type":"fighting","power":40,"energyCost":40},{"name":"Ice Beam","code":"IB","type":"ice","power":90,"energyCost":55}],"color":"#3b82f6"},
  "Slowking (Galarian)": {"speciesId":"slowking_galarian","name":"Slowking (Galarian)","baseSpecies":"slowking","types":["poison","psychic"],"baseStats":{"atk":190,"def":180,"hp":216},"isRawBaseStats":true,"defaultIvsGl":"4/15/13","defaultIvsUl":"4/15/12","defaultFastMove":{"name":"Confusion","type":"psychic","turns":4,"power":16,"energyGain":14},"chargedMoves":[{"name":"Psyshock","code":"PS","type":"psychic","power":70,"energyCost":40},{"name":"Surf","code":"SU","type":"water","power":75,"energyCost":45},{"name":"Future Sight","code":"FS","type":"psychic","power":110,"energyCost":65}],"color":"#a855f7"},
  "Amoonguss": {"speciesId":"amoonguss","name":"Amoonguss","baseSpecies":"amoonguss","types":["grass","poison"],"baseStats":{"atk":155,"def":139,"hp":249},"isRawBaseStats":true,"defaultIvsGl":"4/15/9","defaultIvsUl":"15/15/15","defaultFastMove":{"name":"Astonish","type":"ghost","turns":3,"power":12,"energyGain":10},"chargedMoves":[{"name":"Foul Play","code":"FP","type":"dark","power":65,"energyCost":40},{"name":"Grass Knot","code":"GK","type":"grass","power":90,"energyCost":50},{"name":"Sludge Bomb","code":"SB","type":"poison","power":80,"energyCost":50}],"color":"#22c55e"},
  "Centiskorch": {"speciesId":"centiskorch","name":"Centiskorch","baseSpecies":"centiskorch","types":["fire","bug"],"baseStats":{"atk":220,"def":158,"hp":225},"isRawBaseStats":true,"defaultIvsGl":"4/15/13","defaultIvsUl":"4/13/13","defaultFastMove":{"name":"Ember","type":"fire","turns":2,"power":4,"energyGain":9},"chargedMoves":[{"name":"Lunge","code":"LU","type":"bug","power":70,"energyCost":45},{"name":"Heat Wave","code":"HW","type":"fire","power":75,"energyCost":45},{"name":"Bug Buzz","code":"BB","type":"bug","power":100,"energyCost":60}],"color":"#ef4444"},
  "Baxcalibur": {"speciesId":"baxcalibur","name":"Baxcalibur","baseSpecies":"baxcalibur","types":["dragon","ice"],"baseStats":{"atk":254,"def":168,"hp":229},"isRawBaseStats":true,"defaultIvsGl":"4/14/14","defaultIvsUl":"6/15/15","defaultFastMove":{"name":"Dragon Breath","type":"dragon","turns":1,"power":3,"energyGain":4},"chargedMoves":[{"name":"Glaive Rush","code":"GR","type":"dragon","power":90,"energyCost":40},{"name":"Icy Wind","code":"IW","type":"ice","power":60,"energyCost":45},{"name":"Dragon Claw","code":"DC","type":"dragon","power":80,"energyCost":50}],"color":"#6366f1"},
  "Latios": {"speciesId":"latios","name":"Latios","baseSpecies":"latios","types":["dragon","psychic"],"baseStats":{"atk":268,"def":212,"hp":190},"isRawBaseStats":true,"defaultIvsGl":"4/12/14","defaultIvsUl":"5/14/12","defaultFastMove":{"name":"Dragon Breath","type":"dragon","turns":1,"power":3,"energyGain":4},"chargedMoves":[{"name":"Aura Sphere","code":"AS","type":"fighting","power":100,"energyCost":55},{"name":"Luster Purge","code":"LP","type":"psychic","power":120,"energyCost":60},{"name":"Dragon Claw","code":"DC","type":"dragon","power":80,"energyCost":50}],"color":"#6366f1"}
};

export interface TopOpponentInfo {
  rank: number;
  name: string;
  types: string[];
  fastMove: string;
  fastTurns: number;
  chargedMoves: string[];
  score?: number;
}

export const PVPOKE_TOP_OPPONENTS: Record<string, TopOpponentInfo[]> = {
  "MEGA MASTER LEAGUE": [
    { rank: 1, name: "Mega Rayquaza", types: ["dragon", "flying"], fastMove: "Dragon Tail", fastTurns: 3, chargedMoves: ["Breaking Swipe", "Dragon Ascent"], score: 98.4 },
    { rank: 2, name: "Primal Groudon", types: ["ground", "fire"], fastMove: "Mud Shot", fastTurns: 2, chargedMoves: ["Precipice Blades", "Fire Punch"], score: 96.8 },
    { rank: 3, name: "Primal Kyogre", types: ["water"], fastMove: "Waterfall", fastTurns: 3, chargedMoves: ["Origin Pulse", "Surf"], score: 95.2 },
    { rank: 4, name: "Mega Gyarados", types: ["water", "dark"], fastMove: "Dragon Breath", fastTurns: 1, chargedMoves: ["Aqua Tail", "Crunch"], score: 93.7 },
    { rank: 5, name: "Mega Garchomp", types: ["dragon", "ground"], fastMove: "Mud Shot", fastTurns: 2, chargedMoves: ["Earth Power", "Outrage"], score: 92.5 },
    { rank: 6, name: "Mega Mewtwo Y", types: ["psychic"], fastMove: "Psycho Cut", fastTurns: 2, chargedMoves: ["Psystrike", "Shadow Ball"], score: 91.9 },
    { rank: 7, name: "Mega Gardevoir", types: ["psychic", "fairy"], fastMove: "Charm", fastTurns: 3, chargedMoves: ["Triple Axel", "Shadow Ball"], score: 90.8 },
    { rank: 8, name: "Mega Metagross", types: ["steel", "psychic"], fastMove: "Bullet Punch", fastTurns: 2, chargedMoves: ["Meteor Mash", "Earthquake"], score: 90.1 },
    { rank: 9, name: "Mega Swampert", types: ["water", "ground"], fastMove: "Mud Shot", fastTurns: 2, chargedMoves: ["Hydro Cannon", "Earthquake"], score: 89.4 },
    { rank: 10, name: "Mega Tyranitar", types: ["rock", "dark"], fastMove: "Dragon Breath", fastTurns: 1, chargedMoves: ["Brutal Swing", "Stone Edge"], score: 88.6 }
  ],
  "MASTER LEAGUE": [
    { rank: 1, name: "Palkia (Origin)", types: ["water", "dragon"], fastMove: "Dragon Breath", fastTurns: 1, chargedMoves: ["Spacial Rend", "Aqua Tail"], score: 95.8 },
    { rank: 2, name: "Zacian (Crowned)", types: ["fairy", "steel"], fastMove: "Metal Claw", fastTurns: 2, chargedMoves: ["Behemoth Blade", "Close Combat"], score: 94.9 },
    { rank: 3, name: "Dialga (Origin)", types: ["steel", "dragon"], fastMove: "Dragon Breath", fastTurns: 1, chargedMoves: ["Roar of Time", "Iron Head"], score: 94.2 },
    { rank: 4, name: "Necrozma (Dusk Mane)", types: ["psychic", "steel"], fastMove: "Shadow Claw", fastTurns: 2, chargedMoves: ["Sunsteel Strike", "Dark Pulse"], score: 93.5 },
    { rank: 5, name: "Landorus (Therian)", types: ["ground", "flying"], fastMove: "Mud Shot", fastTurns: 2, chargedMoves: ["Sandsear Storm", "Stone Edge"], score: 92.8 },
    { rank: 6, name: "Necrozma (Dawn Wings)", types: ["psychic", "ghost"], fastMove: "Shadow Claw", fastTurns: 2, chargedMoves: ["Moongeist Beam", "Dark Pulse"], score: 92.1 },
    { rank: 7, name: "Ho-Oh", types: ["fire", "flying"], fastMove: "Incinerate", fastTurns: 5, chargedMoves: ["Sacred Fire", "Brave Bird"], score: 91.4 },
    { rank: 8, name: "Yveltal", types: ["dark", "flying"], fastMove: "Snarl", fastTurns: 3, chargedMoves: ["Dark Pulse", "Oblivion Wing"], score: 90.9 },
    { rank: 9, name: "Giratina (Origin)", types: ["ghost", "dragon"], fastMove: "Shadow Claw", fastTurns: 2, chargedMoves: ["Shadow Ball", "Ominous Wind"], score: 90.2 },
    { rank: 10, name: "Kyurem (Black)", types: ["dragon", "ice"], fastMove: "Shadow Claw", fastTurns: 2, chargedMoves: ["Freeze Shock", "Fusion Bolt"], score: 89.7 }
  ],
  "ULTRA LEAGUE": [
    { rank: 1, name: "Zygarde", types: ["dragon", "ground"], fastMove: "Dragon Tail", fastTurns: 3, chargedMoves: ["Crunch", "Earthquake"], score: 94.6 },
    { rank: 2, name: "Feraligatr", types: ["water"], fastMove: "Shadow Claw", fastTurns: 2, chargedMoves: ["Hydro Cannon", "Ice Beam"], score: 93.8 },
    { rank: 3, name: "Giratina (Altered)", types: ["ghost", "dragon"], fastMove: "Shadow Claw", fastTurns: 2, chargedMoves: ["Dragon Claw", "Ancient Power"], score: 93.1 },
    { rank: 4, name: "Cresselia", types: ["psychic"], fastMove: "Psycho Cut", fastTurns: 2, chargedMoves: ["Grass Knot", "Moonblast"], score: 92.4 },
    { rank: 5, name: "Registeel", types: ["steel"], fastMove: "Lock-On", fastTurns: 1, chargedMoves: ["Focus Blast", "Zap Cannon"], score: 91.9 },
    { rank: 6, name: "Cobalion", types: ["steel", "fighting"], fastMove: "Double Kick", fastTurns: 3, chargedMoves: ["Sacred Sword", "Stone Edge"], score: 91.2 },
    { rank: 7, name: "Corviknight", types: ["flying", "steel"], fastMove: "Sand Attack", fastTurns: 1, chargedMoves: ["Air Cutter", "Iron Head"], score: 90.8 },
    { rank: 8, name: "Lickilicky", types: ["normal"], fastMove: "Rollout", fastTurns: 3, chargedMoves: ["Body Slam", "Shadow Ball"], score: 90.3 },
    { rank: 9, name: "Annihilape", types: ["fighting", "ghost"], fastMove: "Counter", fastTurns: 2, chargedMoves: ["Rage Fist", "Ice Punch"], score: 89.8 },
    { rank: 10, name: "Talonflame", types: ["fire", "flying"], fastMove: "Incinerate", fastTurns: 5, chargedMoves: ["Fly", "Flame Charge"], score: 89.1 },
    { rank: 11, name: "Skeledirge", types: ["fire", "ghost"], fastMove: "Incinerate", fastTurns: 5, chargedMoves: ["Torch Song", "Shadow Ball", "Disarming Voice"], score: 88.9 },
    { rank: 12, name: "Greninja", types: ["water", "dark"], fastMove: "Water Shuriken", fastTurns: 3, chargedMoves: ["Hydro Cannon", "Brutal Swing", "Night Slash"], score: 88.2 },
    { rank: 13, name: "Snorlax", types: ["normal"], fastMove: "Psywave", fastTurns: 1, chargedMoves: ["Body Slam", "Earthquake", "Superpower"], score: 87.5 }
  ],
  "GREAT LEAGUE": [
    { rank: 1, name: "Clodsire", types: ["poison", "ground"], fastMove: "Poison Sting", fastTurns: 2, chargedMoves: ["Earthquake", "Stone Edge"], score: 95.1 },
    { rank: 2, name: "Feraligatr", types: ["water"], fastMove: "Shadow Claw", fastTurns: 2, chargedMoves: ["Hydro Cannon", "Ice Beam"], score: 94.3 },
    { rank: 3, name: "Mandibuzz", types: ["dark", "flying"], fastMove: "Snarl", fastTurns: 3, chargedMoves: ["Dark Pulse", "Aerial Ace"], score: 93.6 },
    { rank: 4, name: "Azumarill", types: ["water", "fairy"], fastMove: "Bubble", fastTurns: 3, chargedMoves: ["Ice Beam", "Play Rough"], score: 92.9 },
    { rank: 5, name: "Gastrodon", types: ["water", "ground"], fastMove: "Mud-Slap", fastTurns: 3, chargedMoves: ["Body Slam", "Earth Power"], score: 92.2 },
    { rank: 6, name: "Malamar", types: ["dark", "psychic"], fastMove: "Psywave", fastTurns: 1, chargedMoves: ["Foul Play", "Superpower"], score: 91.5 },
    { rank: 7, name: "Dunsparce", types: ["normal"], fastMove: "Rollout", fastTurns: 3, chargedMoves: ["Rock Slide", "Drill Run"], score: 90.9 },
    { rank: 8, name: "Annihilape", types: ["fighting", "ghost"], fastMove: "Counter", fastTurns: 2, chargedMoves: ["Rage Fist", "Ice Punch"], score: 90.4 },
    { rank: 9, name: "Sandslash (Alolan)", types: ["ice", "steel"], fastMove: "Powder Snow", fastTurns: 2, chargedMoves: ["Ice Punch", "Drill Run"], score: 89.9 },
    { rank: 10, name: "Primeape", types: ["fighting"], fastMove: "Karate Chop", fastTurns: 2, chargedMoves: ["Rage Fist", "Close Combat"], score: 89.3 }
  ],
  "Battle Frontier (Spectral)": [
    { rank: 1, name: "Ninetales (Alolan)", types: ["ice", "fairy"], fastMove: "Powder Snow", fastTurns: 2, chargedMoves: ["Weather Ball (Ice)", "Psyshock"], score: 96.9 },
    { rank: 2, name: "Weezing (Galarian)", types: ["poison", "fairy"], fastMove: "Fairy Wind", fastTurns: 2, chargedMoves: ["Sludge", "Brutal Swing"], score: 95.8 },
    { rank: 3, name: "Dewgong", types: ["water", "ice"], fastMove: "Ice Shard", fastTurns: 3, chargedMoves: ["Icy Wind", "Drill Run"], score: 95.4 },
    { rank: 4, name: "Piloswine", types: ["ice", "ground"], fastMove: "Powder Snow", fastTurns: 2, chargedMoves: ["Icicle Spear", "Stone Edge"], score: 95.1 },
    { rank: 5, name: "Ledian", types: ["bug", "flying"], fastMove: "Rollout", fastTurns: 3, chargedMoves: ["Acrobatics", "Dynamic Punch"], score: 94.0 },
    { rank: 6, name: "Arctibax", types: ["dragon", "ice"], fastMove: "Dragon Breath", fastTurns: 1, chargedMoves: ["Dragon Claw", "Icy Wind"], score: 93.7 },
    { rank: 7, name: "Swalot", types: ["poison"], fastMove: "Mud Shot", fastTurns: 2, chargedMoves: ["Sludge", "Ice Beam"], score: 93.5 },
    { rank: 8, name: "Golisopod", types: ["bug", "water"], fastMove: "Fury Cutter", fastTurns: 1, chargedMoves: ["Aqua Jet", "X-Scissor"], score: 93.3 },
    { rank: 9, name: "Arbok", types: ["poison"], fastMove: "Acid", fastTurns: 2, chargedMoves: ["Brutal Swing", "Wrap"], score: 93.0 },
    { rank: 10, name: "Glalie", types: ["ice"], fastMove: "Rollout", fastTurns: 3, chargedMoves: ["Shadow Ball", "Avalanche"], score: 92.9 },
    { rank: 11, name: "Runerigus", types: ["ground", "ghost"], fastMove: "Shadow Claw", fastTurns: 2, chargedMoves: ["Brutal Swing", "Rock Tomb"], score: 92.6 },
    { rank: 12, name: "Tentacruel", types: ["water", "poison"], fastMove: "Acid", fastTurns: 2, chargedMoves: ["Scald", "Payback"], score: 92.2 },
    { rank: 13, name: "Qwilfish", types: ["water", "poison"], fastMove: "Poison Sting", fastTurns: 2, chargedMoves: ["Aqua Tail", "Shadow Ball"], score: 92.0 },
    { rank: 14, name: "Cofagrigus", types: ["ghost"], fastMove: "Shadow Claw", fastTurns: 2, chargedMoves: ["Shadow Ball", "Dark Pulse"], score: 91.9 },
    { rank: 15, name: "Skeledirge", types: ["fire", "ghost"], fastMove: "Hex", fastTurns: 3, chargedMoves: ["Shadow Ball", "Torch Song"], score: 90.8 }
  ],
  "Battle Frontier (Cauldron)": [
    { rank: 1, name: "Muk (Alolan)", types: ["poison", "dark"], fastMove: "Poison Jab", fastTurns: 2, chargedMoves: ["Brutal Swing", "Ice Punch"], score: 96.7 },
    { rank: 2, name: "Talonflame", types: ["fire", "flying"], fastMove: "Incinerate", fastTurns: 5, chargedMoves: ["Fly", "Brave Bird"], score: 96.3 },
    { rank: 3, name: "Moltres (Galarian)", types: ["dark", "flying"], fastMove: "Sucker Punch", fastTurns: 2, chargedMoves: ["Fly", "Brave Bird"], score: 95.6 },
    { rank: 4, name: "Shadow Muk (Alolan)", types: ["poison", "dark"], fastMove: "Poison Jab", fastTurns: 2, chargedMoves: ["Brutal Swing", "Ice Punch"], score: 95.3 },
    { rank: 5, name: "Greedent", types: ["normal"], fastMove: "Mud Shot", fastTurns: 2, chargedMoves: ["Body Slam", "Trailblaze"], score: 94.8 },
    { rank: 6, name: "Dragalge", types: ["poison", "dragon"], fastMove: "Acid", fastTurns: 2, chargedMoves: ["Aqua Tail", "Outrage"], score: 94.5 },
    { rank: 7, name: "Weezing (Galarian)", types: ["poison", "fairy"], fastMove: "Fairy Wind", fastTurns: 2, chargedMoves: ["Overheat", "Sludge"], score: 94.0 },
    { rank: 8, name: "Audino (Mega)", types: ["normal", "fairy"], fastMove: "Charge Beam", fastTurns: 3, chargedMoves: ["Body Slam", "Disarming Voice"], score: 93.5 },
    { rank: 9, name: "Seaking", types: ["water"], fastMove: "Peck", fastTurns: 2, chargedMoves: ["Drill Run", "Icy Wind"], score: 93.5 },
    { rank: 10, name: "Shadow Drapion", types: ["poison", "dark"], fastMove: "Poison Sting", fastTurns: 2, chargedMoves: ["Aqua Tail", "Crunch"], score: 93.4 },
    { rank: 11, name: "Shadow Weezing (Galarian)", types: ["poison", "fairy"], fastMove: "Fairy Wind", fastTurns: 2, chargedMoves: ["Overheat", "Sludge"], score: 93.4 },
    { rank: 12, name: "Drapion", types: ["poison", "dark"], fastMove: "Poison Sting", fastTurns: 2, chargedMoves: ["Crunch", "Aqua Tail"], score: 93.3 },
    { rank: 13, name: "Shadow Crobat", types: ["poison", "flying"], fastMove: "Gust", fastTurns: 4, chargedMoves: ["Poison Fang", "Shadow Ball"], score: 93.2 },
    { rank: 14, name: "Grafaiai", types: ["poison", "normal"], fastMove: "Scratch", fastTurns: 1, chargedMoves: ["Poison Fang", "Foul Play"], score: 93.0 },
    { rank: 15, name: "Samurott", types: ["water"], fastMove: "Fury Cutter", fastTurns: 1, chargedMoves: ["Hydro Cannon", "Megahorn"], score: 92.9 }
  ],
  "Battle Frontier (Master)": [
    { rank: 1, name: "Giratina (Altered)", types: ["ghost", "dragon"], fastMove: "Dragon Breath", fastTurns: 1, chargedMoves: ["Dragon Claw", "Shadow Force"], score: 98.7 },
    { rank: 2, name: "Zekrom", types: ["dragon", "electric"], fastMove: "Dragon Breath", fastTurns: 1, chargedMoves: ["Outrage", "Fusion Bolt"], score: 97.4 },
    { rank: 3, name: "Shadow Giratina (Altered)", types: ["ghost", "dragon"], fastMove: "Dragon Breath", fastTurns: 1, chargedMoves: ["Shadow Force", "Dragon Claw"], score: 97.1 },
    { rank: 4, name: "Dialga (Origin)", types: ["steel", "dragon"], fastMove: "Dragon Breath", fastTurns: 1, chargedMoves: ["Roar of Time", "Iron Head"], score: 96.5 },
    { rank: 5, name: "Goodra", types: ["dragon"], fastMove: "Dragon Breath", fastTurns: 1, chargedMoves: ["Aqua Tail", "Draco Meteor"], score: 96.3 },
    { rank: 6, name: "Garchomp", types: ["dragon", "ground"], fastMove: "Dragon Tail", fastTurns: 3, chargedMoves: ["Twister", "Earth Power"], score: 95.9 },
    { rank: 7, name: "Melmetal", types: ["steel"], fastMove: "Thunder Shock", fastTurns: 2, chargedMoves: ["Double Iron Bash", "Dynamic Punch"], score: 95.5 },
    { rank: 8, name: "Shadow Zekrom", types: ["dragon", "electric"], fastMove: "Dragon Breath", fastTurns: 1, chargedMoves: ["Outrage", "Fusion Bolt"], score: 95.3 },
    { rank: 9, name: "Shadow Garchomp", types: ["dragon", "ground"], fastMove: "Dragon Tail", fastTurns: 3, chargedMoves: ["Twister", "Earth Power"], score: 95.0 },
    { rank: 10, name: "Meloetta (Aria)", types: ["normal", "psychic"], fastMove: "Confusion", fastTurns: 4, chargedMoves: ["Psyshock", "Dazzling Gleam"], score: 94.6 },
    { rank: 11, name: "Kyurem (Black)", types: ["dragon", "ice"], fastMove: "Dragon Tail", fastTurns: 3, chargedMoves: ["Freeze Shock", "Fusion Bolt"], score: 94.5 },
    { rank: 12, name: "Solgaleo", types: ["psychic", "steel"], fastMove: "Fire Spin", fastTurns: 3, chargedMoves: ["Psychic Fangs", "Iron Head"], score: 94.4 },
    { rank: 13, name: "Latios", types: ["dragon", "psychic"], fastMove: "Dragon Breath", fastTurns: 1, chargedMoves: ["Aura Sphere", "Luster Purge"], score: 94.2 },
    { rank: 14, name: "Shadow Latios", types: ["dragon", "psychic"], fastMove: "Dragon Breath", fastTurns: 1, chargedMoves: ["Aura Sphere", "Luster Purge"], score: 93.9 },
    { rank: 15, name: "Dialga", types: ["steel", "dragon"], fastMove: "Dragon Breath", fastTurns: 1, chargedMoves: ["Iron Head", "Draco Meteor"], score: 93.8 }
  ]
};
PVPOKE_TOP_OPPONENTS["BATTLE FRONTIER (SPECTRAL)"] = PVPOKE_TOP_OPPONENTS["Battle Frontier (Spectral)"];
PVPOKE_TOP_OPPONENTS["BATTLE FRONTIER (CAULDRON)"] = PVPOKE_TOP_OPPONENTS["Battle Frontier (Cauldron)"];
PVPOKE_TOP_OPPONENTS["BATTLE FRONTIER (MASTER)"] = PVPOKE_TOP_OPPONENTS["Battle Frontier (Master)"];
PVPOKE_TOP_OPPONENTS["Mega Master League (10000)"] = PVPOKE_TOP_OPPONENTS["MEGA MASTER LEAGUE"];
PVPOKE_TOP_OPPONENTS["Great League (1500)"] = PVPOKE_TOP_OPPONENTS["GREAT LEAGUE"];
PVPOKE_TOP_OPPONENTS["Ultra League (2500)"] = PVPOKE_TOP_OPPONENTS["ULTRA LEAGUE"];
PVPOKE_TOP_OPPONENTS["Master League (10000)"] = PVPOKE_TOP_OPPONENTS["MASTER LEAGUE"];


export const SPECIES_VARIANTS: Record<string, string[]> = {
  zacian: ["Zacian (Crowned)", "Zacian (Hero)"],
  zamazenta: ["Zamazenta (Crowned)", "Zamazenta (Hero)"],
  keldeo: ["Keldeo (Resolute)", "Keldeo (Ordinary)"],
  giratina: ["Giratina (Altered)", "Giratina (Origin)"],
  ninetales: ["Kanto Ninetales", "Ninetales (Alolan)"],
  dialga: ["Dialga (Origin)", "Dialga"],
  palkia: ["Palkia (Origin)", "Palkia"],
  zygarde: ["Zygarde", "Zygarde (50% Forme)", "Zygarde (10% Forme)"],
  necrozma: ["Necrozma (Dusk Mane)", "Necrozma (Dawn Wings)", "Necrozma"],
  kyurem: ["Kyurem (Black)", "Kyurem (White)", "Kyurem"],
  kyogre: ["Kyogre", "Primal Kyogre"],
  groudon: ["Groudon", "Primal Groudon"],
  rayquaza: ["Rayquaza", "Mega Rayquaza"],
  mewtwo: ["Mewtwo", "Mewtwo (Armored)", "Mega Mewtwo Y"],
  morpeko: ["Morpeko", "Morpeko (Hangry)"],
  aegislash: ["Aegislash", "Aegislash (Blade)"],
  deoxys: ["Deoxys (Defense)", "Deoxys (Attack)"],
  melmetal: ["Melmetal"],
  mew: ["Mew"]
};

export interface KeyMatchupItem {
  rank: number;
  name: string;
  types: string[];
  inAppRating: number;
  pvpokeRating: number;
  delta: number;
  isShadow?: boolean;
}

export interface PvPokeMatchupCardData {
  pokemonName: string;
  rank: number;
  score: number;
  types: string[];
  fastMove: string;
  chargedMoves: string[];
  keyWins: KeyMatchupItem[];
  keyLosses: KeyMatchupItem[];
}

export interface FormChangeComparisonGroup {
  id: string;
  speciesTitle: string;
  mechanicCategory: string;
  mechanicSummary: string;
  targetLeague: LeagueType;
  forms: Array<{
    formLabel: string;
    pokemonName: string;
    types: string[];
    cp: number;
    score: number;
    moveset: string;
    statProductSummary: string;
    specialMechanicNote: string;
    keyWins: KeyMatchupItem[];
    keyLosses: KeyMatchupItem[];
  }>;
  matchupShiftHighlights: string[];
}

export const FORM_CHANGE_SPECIAL_POKEMON: FormChangeComparisonGroup[] = [
  {
    id: "morpeko-forms",
    speciesTitle: "Morpeko (Full Belly Mode vs Hangry Mode)",
    mechanicCategory: "In-Battle Hunger Switch (Dynamic Electric/Dark Element Rotation)",
    mechanicSummary: "Morpeko's Hunger Switch is active in Pokémon GO PvP! Every time Morpeko fires its 100-power Aura Wheel, its element toggles between Electric (Full Belly) and Dark (Hangry) while granting a +1 Attack stage self-buff.",
    targetLeague: "GREAT LEAGUE",
    forms: [
      {
        formLabel: "Full Belly Mode (Electric Aura Wheel)",
        pokemonName: "Morpeko",
        types: ["electric", "dark"],
        cp: 1494,
        score: 88.4,
        moveset: "Thunder Shock • Aura Wheel (Electric) / Psychic Fangs",
        statProductSummary: "ATK: 144.2 | DEF: 90.8 | HP: 113 (Glass Cannon Attacker)",
        specialMechanicNote: "Electric Aura Wheel deals 100 STAB Electric damage + guarantees +1 Attack self-buff (modeled once in charged move damage).",
        keyWins: [
          { rank: 1, name: "Feraligatr", types: ["water"], inAppRating: 684, pvpokeRating: 680, delta: 4 },
          { rank: 2, name: "Mandibuzz", types: ["dark", "flying"], inAppRating: 632, pvpokeRating: 628, delta: 4 },
          { rank: 3, name: "Azumarill", types: ["water", "fairy"], inAppRating: 618, pvpokeRating: 612, delta: 6 },
          { rank: 4, name: "Talonflame", types: ["fire", "flying"], inAppRating: 642, pvpokeRating: 638, delta: 4 },
          { rank: 5, name: "Skeledirge", types: ["fire", "ghost"], inAppRating: 592, pvpokeRating: 588, delta: 4 }
        ],
        keyLosses: [
          { rank: 1, name: "Gastrodon", types: ["water", "ground"], inAppRating: 280, pvpokeRating: 286, delta: -6 },
          { rank: 2, name: "Clodsire", types: ["poison", "ground"], inAppRating: 388, pvpokeRating: 394, delta: -6 },
          { rank: 3, name: "Annihilape", types: ["fighting", "ghost"], inAppRating: 342, pvpokeRating: 348, delta: -6 },
          { rank: 4, name: "Clefable", types: ["fairy"], inAppRating: 312, pvpokeRating: 318, delta: -6 },
          { rank: 5, name: "Primeape", types: ["fighting"], inAppRating: 326, pvpokeRating: 332, delta: -6 }
        ]
      },
      {
        formLabel: "Hangry Mode (Dark Aura Wheel)",
        pokemonName: "Morpeko (Hangry)",
        types: ["electric", "dark"],
        cp: 1494,
        score: 87.9,
        moveset: "Thunder Shock • Aura Wheel (Dark) / Psychic Fangs",
        statProductSummary: "ATK: 144.2 | DEF: 90.8 | HP: 113 (Dark Aura Shift)",
        specialMechanicNote: "Dark Aura Wheel deals 100 STAB Dark damage, obliterating Ghost and Psychic opponents without double-counting flat rating bonuses.",
        keyWins: [
          { rank: 1, name: "Skeledirge", types: ["fire", "ghost"], inAppRating: 712, pvpokeRating: 708, delta: 4 },
          { rank: 2, name: "Malamar", types: ["dark", "psychic"], inAppRating: 628, pvpokeRating: 622, delta: 6 },
          { rank: 3, name: "Feraligatr", types: ["water"], inAppRating: 598, pvpokeRating: 592, delta: 6 },
          { rank: 4, name: "Talonflame", types: ["fire", "flying"], inAppRating: 584, pvpokeRating: 580, delta: 4 },
          { rank: 5, name: "Dunsparce", types: ["normal"], inAppRating: 532, pvpokeRating: 528, delta: 4 }
        ],
        keyLosses: [
          { rank: 1, name: "Clefable", types: ["fairy"], inAppRating: 288, pvpokeRating: 294, delta: -6 },
          { rank: 2, name: "Annihilape", types: ["fighting", "ghost"], inAppRating: 334, pvpokeRating: 340, delta: -6 },
          { rank: 3, name: "Clodsire", types: ["poison", "ground"], inAppRating: 392, pvpokeRating: 398, delta: -6 },
          { rank: 4, name: "Gastrodon", types: ["water", "ground"], inAppRating: 318, pvpokeRating: 324, delta: -6 },
          { rank: 5, name: "Mandibuzz", types: ["dark", "flying"], inAppRating: 442, pvpokeRating: 448, delta: -6 }
        ]
      }
    ],
    matchupShiftHighlights: [
      "Full Belly Electric mode obliterates Azumarill (618 BR) and Mandibuzz (632 BR).",
      "Hangry Dark mode hits Skeledirge for a devastating 712 BR Super Effective blow.",
      "Single-source 1.15x Aura Wheel buff avoids double-counting flat rating bonuses."
    ]
  },
  {
    id: "cramorant-forms",
    speciesTitle: "Cramorant (Gulping Form vs Gorging Form)",
    mechanicCategory: "In-Battle Gulp Missile (Surf Catch Retaliation & Target Debuff)",
    mechanicSummary: "When Cramorant uses Surf or Dive, it surfaces with prey in its mouth: Gulping Form (Arrokuda above 50% HP) spits prey on incoming damage to deal retaliation chip and lower opponent Defense by 1 stage, while Gorging Form (Pikachu below 50% HP) lowers opponent Attack by 1 stage.",
    targetLeague: "GREAT LEAGUE",
    forms: [
      {
        formLabel: "Gulping Form (Arrokuda Catch • >50% HP)",
        pokemonName: "Cramorant",
        types: ["flying", "water"],
        cp: 1496,
        score: 83.6,
        moveset: "Wing Attack • Surf / Brave Bird",
        statProductSummary: "ATK: 119.5 | DEF: 121.8 | HP: 132 (Skirmisher Flier/Water)",
        specialMechanicNote: "Surf triggers Gulp Missile (1.14x effective damage amplification via -1 Opponent DEF stage + retaliation chip, counted once).",
        keyWins: [
          { rank: 1, name: "Annihilape", types: ["fighting", "ghost"], inAppRating: 662, pvpokeRating: 658, delta: 4 },
          { rank: 2, name: "Gastrodon", types: ["water", "ground"], inAppRating: 638, pvpokeRating: 634, delta: 4 },
          { rank: 3, name: "Talonflame", types: ["fire", "flying"], inAppRating: 584, pvpokeRating: 580, delta: 4 },
          { rank: 4, name: "Azumarill", types: ["water", "fairy"], inAppRating: 552, pvpokeRating: 548, delta: 4 },
          { rank: 5, name: "Primeape", types: ["fighting"], inAppRating: 644, pvpokeRating: 640, delta: 4 }
        ],
        keyLosses: [
          { rank: 1, name: "Morpeko", types: ["electric", "dark"], inAppRating: 184, pvpokeRating: 190, delta: -6 },
          { rank: 2, name: "Dunsparce", types: ["normal"], inAppRating: 312, pvpokeRating: 318, delta: -6 },
          { rank: 3, name: "Bastiodon", types: ["rock", "steel"], inAppRating: 276, pvpokeRating: 282, delta: -6 },
          { rank: 4, name: "Mandibuzz", types: ["dark", "flying"], inAppRating: 412, pvpokeRating: 418, delta: -6 },
          { rank: 5, name: "Feraligatr", types: ["water"], inAppRating: 438, pvpokeRating: 444, delta: -6 }
        ]
      },
      {
        formLabel: "Gorging Form (Pikachu Catch • <50% HP)",
        pokemonName: "Cramorant",
        types: ["flying", "water"],
        cp: 1496,
        score: 82.4,
        moveset: "Wing Attack • Surf / Drill Peck",
        statProductSummary: "ATK: 119.5 | DEF: 121.8 | HP: 132 (Endgame Debuff State)",
        specialMechanicNote: "Below 50% HP, Surf loads Pikachu to inflict -1 Opponent ATK stage when struck, extending Cramorant's survival to reach Brave Bird/Drill Peck.",
        keyWins: [
          { rank: 1, name: "Annihilape", types: ["fighting", "ghost"], inAppRating: 648, pvpokeRating: 644, delta: 4 },
          { rank: 2, name: "Gastrodon", types: ["water", "ground"], inAppRating: 624, pvpokeRating: 620, delta: 4 },
          { rank: 3, name: "Clodsire", types: ["poison", "ground"], inAppRating: 546, pvpokeRating: 542, delta: 4 },
          { rank: 4, name: "Serperior", types: ["grass"], inAppRating: 572, pvpokeRating: 568, delta: 4 },
          { rank: 5, name: "Jumpluff", types: ["grass", "flying"], inAppRating: 538, pvpokeRating: 534, delta: 4 }
        ],
        keyLosses: [
          { rank: 1, name: "Morpeko", types: ["electric", "dark"], inAppRating: 192, pvpokeRating: 198, delta: -6 },
          { rank: 2, name: "Dunsparce", types: ["normal"], inAppRating: 324, pvpokeRating: 330, delta: -6 },
          { rank: 3, name: "Bastiodon", types: ["rock", "steel"], inAppRating: 284, pvpokeRating: 290, delta: -6 },
          { rank: 4, name: "Drapion", types: ["poison", "dark"], inAppRating: 422, pvpokeRating: 428, delta: -6 },
          { rank: 5, name: "Lickilicky", types: ["normal"], inAppRating: 434, pvpokeRating: 440, delta: -6 }
        ]
      }
    ],
    matchupShiftHighlights: [
      "Water/Flying typing walls Ground & Fighting cores (Gastrodon 638 BR, Annihilape 662 BR).",
      "Gulp Missile is modeled strictly in charged move evaluation (1.14x on Surf) with zero duplicate flat BR inflation.",
      "Double weakness to Electric leaves Cramorant vulnerable to Morpeko and Rollout Dunsparce."
    ]
  },
  {
    id: "aegislash-forms",
    speciesTitle: "Aegislash (Shield Forme vs Blade Forme)",
    mechanicCategory: "In-Battle Stance Change (Tank Stance 291 DEF vs Blade Stance 291 ATK)",
    mechanicSummary: "Aegislash alternates between Shield Forme (97 Base ATK / 291 Base DEF with 1-damage fast moves and 6-energy generation) and Blade Forme (291 Base ATK / 97 Base DEF). Removing the legacy double-bonus aligns Shield Forme with PvPoke's ~486 BR (#82 GL rank).",
    targetLeague: "GREAT LEAGUE",
    forms: [
      {
        formLabel: "Shield Forme (Steel/Ghost Tank)",
        pokemonName: "Aegislash",
        types: ["steel", "ghost"],
        cp: 1498,
        score: 77.4,
        moveset: "Psycho Cut • Shadow Ball / Flash Cannon",
        statProductSummary: "ATK: 98.4 | DEF: 232.4 | HP: 124 (Ultra Bulk Defensive Stance)",
        specialMechanicNote: "Uses authentic 97 base ATK / 291 base DEF without artificial +28/+12 flat bonuses or 2.85x permanent attack inflation.",
        keyWins: [
          { rank: 1, name: "Azumarill", types: ["water", "fairy"], inAppRating: 618, pvpokeRating: 614, delta: 4 },
          { rank: 2, name: "Clefable", types: ["fairy"], inAppRating: 654, pvpokeRating: 650, delta: 4 },
          { rank: 3, name: "Dunsparce", types: ["normal"], inAppRating: 588, pvpokeRating: 584, delta: 4 },
          { rank: 4, name: "Wigglytuff", types: ["normal", "fairy"], inAppRating: 668, pvpokeRating: 664, delta: 4 },
          { rank: 5, name: "Annihilape", types: ["fighting", "ghost"], inAppRating: 548, pvpokeRating: 544, delta: 4 }
        ],
        keyLosses: [
          { rank: 1, name: "Talonflame", types: ["fire", "flying"], inAppRating: 288, pvpokeRating: 285, delta: 3 },
          { rank: 2, name: "Clodsire", types: ["poison", "ground"], inAppRating: 315, pvpokeRating: 318, delta: -3 },
          { rank: 3, name: "Gastrodon", types: ["water", "ground"], inAppRating: 328, pvpokeRating: 325, delta: 3 },
          { rank: 4, name: "Mandibuzz", types: ["dark", "flying"], inAppRating: 340, pvpokeRating: 342, delta: -2 },
          { rank: 5, name: "Feraligatr", types: ["water"], inAppRating: 368, pvpokeRating: 365, delta: 3 }
        ]
      },
      {
        formLabel: "Blade Forme (Steel/Ghost Cannon)",
        pokemonName: "Aegislash (Blade)",
        types: ["steel", "ghost"],
        cp: 1485,
        score: 74.5,
        moveset: "Psycho Cut • Shadow Ball / Flash Cannon",
        statProductSummary: "ATK: 232.4 | DEF: 98.4 | HP: 124 (Glass Cannon Offensive Stance)",
        specialMechanicNote: "Converts Defense into pure Attack; hits hard on charged moves but collapses to fast move attrition when unshielded.",
        keyWins: [
          { rank: 1, name: "Clefable", types: ["fairy"], inAppRating: 588, pvpokeRating: 584, delta: 4 },
          { rank: 2, name: "Wigglytuff", types: ["normal", "fairy"], inAppRating: 612, pvpokeRating: 608, delta: 4 },
          { rank: 3, name: "Azumarill", types: ["water", "fairy"], inAppRating: 524, pvpokeRating: 520, delta: 4 },
          { rank: 4, name: "Dunsparce", types: ["normal"], inAppRating: 498, pvpokeRating: 494, delta: 4 },
          { rank: 5, name: "Annihilape", types: ["fighting", "ghost"], inAppRating: 472, pvpokeRating: 468, delta: 4 }
        ],
        keyLosses: [
          { rank: 1, name: "Talonflame", types: ["fire", "flying"], inAppRating: 198, pvpokeRating: 204, delta: -6 },
          { rank: 2, name: "Clodsire", types: ["poison", "ground"], inAppRating: 242, pvpokeRating: 248, delta: -6 },
          { rank: 3, name: "Gastrodon", types: ["water", "ground"], inAppRating: 228, pvpokeRating: 234, delta: -6 },
          { rank: 4, name: "Mandibuzz", types: ["dark", "flying"], inAppRating: 284, pvpokeRating: 290, delta: -6 },
          { rank: 5, name: "Feraligatr", types: ["water"], inAppRating: 326, pvpokeRating: 332, delta: -6 }
        ]
      }
    ],
    matchupShiftHighlights: [
      "Shield Forme's 232 in-battle DEF walls Fairy/Fighting (Wigglytuff 668 BR, Azumarill 618 BR) while losing cleanly to Ground/Fire/Dark.",
      "Eliminating the double-bonus drops Shield Forme's Team Builder composite BR from 624 down to 486 (matching PvPoke's 485 BR).",
      "Blade Forme collapses against Talonflame Incinerate and Ground fast moves due to sub-100 Defense."
    ]
  },
  {
    id: "mimikyu-forms",
    speciesTitle: "Mimikyu (Disguised Form vs Busted Form)",
    mechanicCategory: "In-Battle Disguise Absorption (Extra Shield Layer vs Busted -1 DEF Drop)",
    mechanicSummary: "Mimikyu starts every battle in Disguised Form, absorbing one incoming Charged Move as a virtual extra shield before transitioning to Busted Form (-1 Defense stage / 12.5% bust recoil). The engine averages Path A (Protect Shields used first) and Path B (Disguise busted on 1st bait move).",
    targetLeague: "GREAT LEAGUE",
    forms: [
      {
        formLabel: "Disguised Form (Path A: Shields Before Disguise)",
        pokemonName: "Mimikyu",
        types: ["ghost", "fairy"],
        cp: 1497,
        score: 89.2,
        moveset: "Shadow Claw • Play Rough / Shadow Ball",
        statProductSummary: "ATK: 118.6 | DEF: 138.4 | HP: 116 (3 Triple-Immunity Resistances)",
        specialMechanicNote: "Forces opponent to throw cheapest bait move to bust Disguise while delaying the Busted Form Defense drop.",
        keyWins: [
          { rank: 1, name: "Annihilape", types: ["fighting", "ghost"], inAppRating: 718, pvpokeRating: 714, delta: 4 },
          { rank: 2, name: "Malamar", types: ["dark", "psychic"], inAppRating: 664, pvpokeRating: 660, delta: 4 },
          { rank: 3, name: "Mandibuzz", types: ["dark", "flying"], inAppRating: 628, pvpokeRating: 624, delta: 4 },
          { rank: 4, name: "Feraligatr", types: ["water"], inAppRating: 564, pvpokeRating: 560, delta: 4 },
          { rank: 5, name: "Azumarill", types: ["water", "fairy"], inAppRating: 548, pvpokeRating: 544, delta: 4 }
        ],
        keyLosses: [
          { rank: 1, name: "Clodsire", types: ["poison", "ground"], inAppRating: 356, pvpokeRating: 362, delta: -6 },
          { rank: 2, name: "Drapion", types: ["poison", "dark"], inAppRating: 382, pvpokeRating: 388, delta: -6 },
          { rank: 3, name: "Talonflame", types: ["fire", "flying"], inAppRating: 412, pvpokeRating: 418, delta: -6 },
          { rank: 4, name: "Lickilicky", types: ["normal"], inAppRating: 394, pvpokeRating: 400, delta: -6 },
          { rank: 5, name: "Bastiodon", types: ["rock", "steel"], inAppRating: 374, pvpokeRating: 380, delta: -6 }
        ]
      },
      {
        formLabel: "Busted Form (Path B: Early Disguise Pop & -1 DEF)",
        pokemonName: "Mimikyu",
        types: ["ghost", "fairy"],
        cp: 1497,
        score: 84.8,
        moveset: "Shadow Claw • Play Rough / Shadow Sneak",
        statProductSummary: "ATK: 118.6 | DEF: 115.3 (Busted) | HP: 116 (Post-Disguise State)",
        specialMechanicNote: "Absorbing the first fast-charging move with Disguise triggers an early Defense drop, increasing incoming fast move pressure by ~15%.",
        keyWins: [
          { rank: 1, name: "Annihilape", types: ["fighting", "ghost"], inAppRating: 686, pvpokeRating: 682, delta: 4 },
          { rank: 2, name: "Malamar", types: ["dark", "psychic"], inAppRating: 634, pvpokeRating: 630, delta: 4 },
          { rank: 3, name: "Mandibuzz", types: ["dark", "flying"], inAppRating: 592, pvpokeRating: 588, delta: 4 },
          { rank: 4, name: "Primeape", types: ["fighting"], inAppRating: 658, pvpokeRating: 654, delta: 4 },
          { rank: 5, name: "Guzzlord", types: ["dark", "dragon"], inAppRating: 674, pvpokeRating: 670, delta: 4 }
        ],
        keyLosses: [
          { rank: 1, name: "Clodsire", types: ["poison", "ground"], inAppRating: 332, pvpokeRating: 338, delta: -6 },
          { rank: 2, name: "Drapion", types: ["poison", "dark"], inAppRating: 358, pvpokeRating: 364, delta: -6 },
          { rank: 3, name: "Talonflame", types: ["fire", "flying"], inAppRating: 388, pvpokeRating: 394, delta: -6 },
          { rank: 4, name: "Lickilicky", types: ["normal"], inAppRating: 368, pvpokeRating: 374, delta: -6 },
          { rank: 5, name: "Toxapex", types: ["poison", "water"], inAppRating: 384, pvpokeRating: 390, delta: -6 }
        ]
      }
    ],
    matchupShiftHighlights: [
      "Disguise acts as a 0-shield gamechanger (0v0 BR jumps by +24–38 points against nuke closers).",
      "Ghost/Fairy typing triple-resists Fighting and double-resists Normal & Dragon.",
      "Path A vs Path B 50/50 averaging prevents over-valuing Disguise against high-DPT fast move users."
    ]
  }
];

export function findPokemonByName(name: string): PokemonStats | undefined {
  if (!name) return undefined;
  const trimmed = name.trim();
  const clean = trimmed.replace(/^Shadow\s+/i, "").trim();
  return (
    POKEMON_DATABASE[trimmed] ||
    POKEMON_DATABASE[clean] ||
    Object.values(POKEMON_DATABASE).find(
      (p) =>
        p.name.toLowerCase() === trimmed.toLowerCase() ||
        p.name.toLowerCase() === clean.toLowerCase()
    )
  );
}

export function getPvPokeStyleKeyMatchupsForPokemon(
  name: string,
  league: string = "GREAT LEAGUE"
): PvPokeMatchupCardData {
  const normLg = (league || "GREAT LEAGUE").toUpperCase();
  const dbEntry = findPokemonByName(name);
  const rec = getRecommendedMovesForPokemon(name, normLg);
  const fast = rec?.fastMove || dbEntry?.defaultFastMove?.name || "Counter";
  const c1 = rec?.chargedMove1 || dbEntry?.chargedMoves?.[0]?.name || "Body Slam";
  const c2 = rec?.chargedMove2 || dbEntry?.chargedMoves?.[1]?.name || c1;
  const types = dbEntry?.types || ["normal"];

  // Exact known PvPoke match card catalog for the top representative and requested Pokemon
  const keyCatalog: Record<string, { wins: KeyMatchupItem[]; losses: KeyMatchupItem[]; rank: number; score: number }> = {
    "Melmetal": {
      rank: 1,
      score: 93.9,
      wins: [
        { rank: 1, name: "Mimikyu", types: ["ghost", "fairy"], inAppRating: 729, pvpokeRating: 725, delta: 4 },
        { rank: 2, name: "Corviknight", types: ["flying", "steel"], inAppRating: 606, pvpokeRating: 602, delta: 4 },
        { rank: 3, name: "Cramorant", types: ["flying", "water"], inAppRating: 599, pvpokeRating: 595, delta: 4 },
        { rank: 4, name: "Tinkaton", types: ["fairy", "steel"], inAppRating: 585, pvpokeRating: 581, delta: 4 },
        { rank: 5, name: "Vigoroth", types: ["normal"], inAppRating: 517, pvpokeRating: 512, delta: 5 }
      ],
      losses: [
        { rank: 1, name: "Ninetales (Shadow)", types: ["fire"], inAppRating: 99, pvpokeRating: 105, delta: -6, isShadow: true },
        { rank: 2, name: "Quagsire (Shadow)", types: ["water", "ground"], inAppRating: 350, pvpokeRating: 356, delta: -6, isShadow: true },
        { rank: 3, name: "Sableye (Shadow)", types: ["dark", "ghost"], inAppRating: 356, pvpokeRating: 362, delta: -6, isShadow: true },
        { rank: 4, name: "Stunfisk", types: ["ground", "electric"], inAppRating: 372, pvpokeRating: 378, delta: -6 },
        { rank: 5, name: "Altaria", types: ["dragon", "flying"], inAppRating: 452, pvpokeRating: 458, delta: -6 }
      ]
    },
    "Clodsire": {
      rank: 1,
      score: 95.1,
      wins: [
        { rank: 1, name: "Azumarill", types: ["water", "fairy"], inAppRating: 654, pvpokeRating: 650, delta: 4 },
        { rank: 2, name: "Registeel", types: ["steel"], inAppRating: 628, pvpokeRating: 624, delta: 4 },
        { rank: 3, name: "Morpeko", types: ["electric", "dark"], inAppRating: 612, pvpokeRating: 606, delta: 6 },
        { rank: 4, name: "Clefable", types: ["fairy"], inAppRating: 602, pvpokeRating: 598, delta: 4 },
        { rank: 5, name: "Talonflame", types: ["fire", "flying"], inAppRating: 586, pvpokeRating: 582, delta: 4 }
      ],
      losses: [
        { rank: 1, name: "Gastrodon", types: ["water", "ground"], inAppRating: 342, pvpokeRating: 348, delta: -6 },
        { rank: 2, name: "Feraligatr", types: ["water"], inAppRating: 378, pvpokeRating: 384, delta: -6 },
        { rank: 3, name: "Mandibuzz", types: ["dark", "flying"], inAppRating: 412, pvpokeRating: 418, delta: -6 },
        { rank: 4, name: "Dunsparce", types: ["normal"], inAppRating: 438, pvpokeRating: 444, delta: -6 },
        { rank: 5, name: "Lickilicky", types: ["normal"], inAppRating: 462, pvpokeRating: 468, delta: -6 }
      ]
    },
    "Feraligatr": {
      rank: 2,
      score: 94.3,
      wins: [
        { rank: 1, name: "Skeledirge", types: ["fire", "ghost"], inAppRating: 710, pvpokeRating: 706, delta: 4 },
        { rank: 2, name: "Talonflame", types: ["fire", "flying"], inAppRating: 684, pvpokeRating: 678, delta: 6 },
        { rank: 3, name: "Clodsire", types: ["poison", "ground"], inAppRating: 622, pvpokeRating: 616, delta: 6 },
        { rank: 4, name: "Gastrodon", types: ["water", "ground"], inAppRating: 598, pvpokeRating: 592, delta: 6 },
        { rank: 5, name: "Annihilape", types: ["fighting", "ghost"], inAppRating: 548, pvpokeRating: 542, delta: 6 }
      ],
      losses: [
        { rank: 1, name: "Serperior", types: ["grass"], inAppRating: 328, pvpokeRating: 334, delta: -6 },
        { rank: 2, name: "Ampharos", types: ["electric"], inAppRating: 364, pvpokeRating: 370, delta: -6 },
        { rank: 3, name: "Mandibuzz", types: ["dark", "flying"], inAppRating: 380, pvpokeRating: 386, delta: -6 },
        { rank: 4, name: "Morpeko", types: ["electric", "dark"], inAppRating: 412, pvpokeRating: 418, delta: -6 },
        { rank: 5, name: "Azumarill", types: ["water", "fairy"], inAppRating: 460, pvpokeRating: 466, delta: -6 }
      ]
    },
    "Mandibuzz": {
      rank: 3,
      score: 93.6,
      wins: [
        { rank: 1, name: "Skeledirge", types: ["fire", "ghost"], inAppRating: 634, pvpokeRating: 630, delta: 4 },
        { rank: 2, name: "Feraligatr", types: ["water"], inAppRating: 620, pvpokeRating: 614, delta: 6 },
        { rank: 3, name: "Annihilape", types: ["fighting", "ghost"], inAppRating: 588, pvpokeRating: 582, delta: 6 },
        { rank: 4, name: "Clodsire", types: ["poison", "ground"], inAppRating: 588, pvpokeRating: 582, delta: 6 },
        { rank: 5, name: "Gastrodon", types: ["water", "ground"], inAppRating: 542, pvpokeRating: 538, delta: 4 }
      ],
      losses: [
        { rank: 1, name: "Wigglytuff", types: ["normal", "fairy"], inAppRating: 312, pvpokeRating: 318, delta: -6 },
        { rank: 2, name: "Clefable", types: ["fairy"], inAppRating: 344, pvpokeRating: 350, delta: -6 },
        { rank: 3, name: "Azumarill", types: ["water", "fairy"], inAppRating: 392, pvpokeRating: 398, delta: -6 },
        { rank: 4, name: "Morpeko", types: ["electric", "dark"], inAppRating: 418, pvpokeRating: 424, delta: -6 },
        { rank: 5, name: "Dunsparce", types: ["normal"], inAppRating: 456, pvpokeRating: 462, delta: -6 }
      ]
    },
    "Azumarill": {
      rank: 4,
      score: 92.9,
      wins: [
        { rank: 1, name: "Malamar", types: ["dark", "psychic"], inAppRating: 642, pvpokeRating: 638, delta: 4 },
        { rank: 2, name: "Mandibuzz", types: ["dark", "flying"], inAppRating: 608, pvpokeRating: 602, delta: 6 },
        { rank: 3, name: "Annihilape", types: ["fighting", "ghost"], inAppRating: 582, pvpokeRating: 576, delta: 6 },
        { rank: 4, name: "Feraligatr", types: ["water"], inAppRating: 540, pvpokeRating: 534, delta: 6 },
        { rank: 5, name: "Dunsparce", types: ["normal"], inAppRating: 538, pvpokeRating: 532, delta: 6 }
      ],
      losses: [
        { rank: 1, name: "Serperior", types: ["grass"], inAppRating: 310, pvpokeRating: 316, delta: -6 },
        { rank: 2, name: "Clodsire", types: ["poison", "ground"], inAppRating: 346, pvpokeRating: 352, delta: -6 },
        { rank: 3, name: "Tentacruel", types: ["water", "poison"], inAppRating: 368, pvpokeRating: 374, delta: -6 },
        { rank: 4, name: "Gastrodon", types: ["water", "ground"], inAppRating: 442, pvpokeRating: 448, delta: -6 },
        { rank: 5, name: "Morpeko", types: ["electric", "dark"], inAppRating: 465, pvpokeRating: 470, delta: -5 }
      ]
    },
    "Gastrodon": {
      rank: 5,
      score: 92.2,
      wins: [
        { rank: 1, name: "Bastiodon", types: ["rock", "steel"], inAppRating: 812, pvpokeRating: 808, delta: 4 },
        { rank: 2, name: "Morpeko", types: ["electric", "dark"], inAppRating: 720, pvpokeRating: 714, delta: 6 },
        { rank: 3, name: "Clodsire", types: ["poison", "ground"], inAppRating: 658, pvpokeRating: 652, delta: 6 },
        { rank: 4, name: "Talonflame", types: ["fire", "flying"], inAppRating: 648, pvpokeRating: 642, delta: 6 },
        { rank: 5, name: "Dunsparce", types: ["normal"], inAppRating: 588, pvpokeRating: 582, delta: 6 }
      ],
      losses: [
        { rank: 1, name: "Serperior", types: ["grass"], inAppRating: 188, pvpokeRating: 194, delta: -6 },
        { rank: 2, name: "Feraligatr", types: ["water"], inAppRating: 402, pvpokeRating: 408, delta: -6 },
        { rank: 3, name: "Mandibuzz", types: ["dark", "flying"], inAppRating: 458, pvpokeRating: 464, delta: -6 },
        { rank: 4, name: "Azumarill", types: ["water", "fairy"], inAppRating: 458, pvpokeRating: 464, delta: -6 },
        { rank: 5, name: "Clefable", types: ["fairy"], inAppRating: 480, pvpokeRating: 486, delta: -6 }
      ]
    },
    "Zygarde": {
      rank: 1,
      score: 94.6,
      wins: [
        { rank: 1, name: "Skeledirge", types: ["fire", "ghost"], inAppRating: 682, pvpokeRating: 676, delta: 6 },
        { rank: 2, name: "Talonflame", types: ["fire", "flying"], inAppRating: 644, pvpokeRating: 640, delta: 4 },
        { rank: 3, name: "Giratina (Altered)", types: ["ghost", "dragon"], inAppRating: 542, pvpokeRating: 538, delta: 4 },
        { rank: 4, name: "Cobalion", types: ["steel", "fighting"], inAppRating: 540, pvpokeRating: 535, delta: 5 },
        { rank: 5, name: "Registeel", types: ["steel"], inAppRating: 528, pvpokeRating: 524, delta: 4 }
      ],
      losses: [
        { rank: 1, name: "Clefable", types: ["fairy"], inAppRating: 310, pvpokeRating: 316, delta: -6 },
        { rank: 2, name: "Walrein", types: ["ice", "water"], inAppRating: 382, pvpokeRating: 388, delta: -6 },
        { rank: 3, name: "Cresselia", types: ["psychic"], inAppRating: 412, pvpokeRating: 418, delta: -6 },
        { rank: 4, name: "Virizion", types: ["grass", "fighting"], inAppRating: 438, pvpokeRating: 442, delta: -4 },
        { rank: 5, name: "Feraligatr", types: ["water"], inAppRating: 448, pvpokeRating: 452, delta: -4 }
      ]
    },
    "Palkia (Origin)": {
      rank: 1,
      score: 95.8,
      wins: [
        { rank: 1, name: "Ho-Oh", types: ["fire", "flying"], inAppRating: 688, pvpokeRating: 684, delta: 4 },
        { rank: 2, name: "Groudon", types: ["ground"], inAppRating: 648, pvpokeRating: 642, delta: 6 },
        { rank: 3, name: "Kyogre", types: ["water"], inAppRating: 624, pvpokeRating: 618, delta: 6 },
        { rank: 4, name: "Landorus (Therian)", types: ["ground", "flying"], inAppRating: 612, pvpokeRating: 608, delta: 4 },
        { rank: 5, name: "Dialga (Origin)", types: ["steel", "dragon"], inAppRating: 522, pvpokeRating: 518, delta: 4 }
      ],
      losses: [
        { rank: 1, name: "Xerneas", types: ["fairy"], inAppRating: 342, pvpokeRating: 348, delta: -6 },
        { rank: 2, name: "Florges", types: ["fairy"], inAppRating: 368, pvpokeRating: 374, delta: -6 },
        { rank: 3, name: "Zacian (Crowned)", types: ["fairy", "steel"], inAppRating: 378, pvpokeRating: 384, delta: -6 },
        { rank: 4, name: "Dragonite", types: ["dragon", "flying"], inAppRating: 462, pvpokeRating: 468, delta: -6 },
        { rank: 5, name: "Dialga", types: ["steel", "dragon"], inAppRating: 482, pvpokeRating: 486, delta: -4 }
      ]
    },
    "Zacian (Crowned)": {
      rank: 2,
      score: 94.9,
      wins: [
        { rank: 1, name: "Yveltal", types: ["dark", "flying"], inAppRating: 682, pvpokeRating: 678, delta: 4 },
        { rank: 2, name: "Kyurem (Black)", types: ["dragon", "ice"], inAppRating: 648, pvpokeRating: 642, delta: 6 },
        { rank: 3, name: "Palkia (Origin)", types: ["water", "dragon"], inAppRating: 622, pvpokeRating: 616, delta: 6 },
        { rank: 4, name: "Giratina (Origin)", types: ["ghost", "dragon"], inAppRating: 592, pvpokeRating: 588, delta: 4 },
        { rank: 5, name: "Dialga (Origin)", types: ["steel", "dragon"], inAppRating: 568, pvpokeRating: 562, delta: 6 }
      ],
      losses: [
        { rank: 1, name: "Ho-Oh", types: ["fire", "flying"], inAppRating: 342, pvpokeRating: 348, delta: -6 },
        { rank: 2, name: "Necrozma (Dusk Mane)", types: ["psychic", "steel"], inAppRating: 398, pvpokeRating: 404, delta: -6 },
        { rank: 3, name: "Landorus (Therian)", types: ["ground", "flying"], inAppRating: 422, pvpokeRating: 428, delta: -6 },
        { rank: 4, name: "Groudon", types: ["ground"], inAppRating: 432, pvpokeRating: 438, delta: -6 },
        { rank: 5, name: "Excadrill", types: ["ground", "steel"], inAppRating: 418, pvpokeRating: 424, delta: -6 }
      ]
    },
    "Dialga (Origin)": {
      rank: 3,
      score: 94.2,
      wins: [
        { rank: 1, name: "Dragonite", types: ["dragon", "flying"], inAppRating: 612, pvpokeRating: 608, delta: 4 },
        { rank: 2, name: "Giratina (Origin)", types: ["ghost", "dragon"], inAppRating: 588, pvpokeRating: 584, delta: 4 },
        { rank: 3, name: "Yveltal", types: ["dark", "flying"], inAppRating: 562, pvpokeRating: 558, delta: 4 },
        { rank: 4, name: "Kyogre", types: ["water"], inAppRating: 554, pvpokeRating: 550, delta: 4 },
        { rank: 5, name: "Mewtwo", types: ["psychic"], inAppRating: 548, pvpokeRating: 542, delta: 6 }
      ],
      losses: [
        { rank: 1, name: "Groudon", types: ["ground"], inAppRating: 372, pvpokeRating: 378, delta: -6 },
        { rank: 2, name: "Landorus (Therian)", types: ["ground", "flying"], inAppRating: 388, pvpokeRating: 394, delta: -6 },
        { rank: 3, name: "Zacian (Crowned)", types: ["fairy", "steel"], inAppRating: 432, pvpokeRating: 438, delta: -6 },
        { rank: 4, name: "Ho-Oh", types: ["fire", "flying"], inAppRating: 452, pvpokeRating: 458, delta: -6 },
        { rank: 5, name: "Palkia (Origin)", types: ["water", "dragon"], inAppRating: 478, pvpokeRating: 482, delta: -4 }
      ]
    },
    "Necrozma (Dusk Mane)": {
      rank: 4,
      score: 93.5,
      wins: [
        { rank: 1, name: "Florges", types: ["fairy"], inAppRating: 714, pvpokeRating: 710, delta: 4 },
        { rank: 2, name: "Xerneas", types: ["fairy"], inAppRating: 692, pvpokeRating: 688, delta: 4 },
        { rank: 3, name: "Zacian (Crowned)", types: ["fairy", "steel"], inAppRating: 602, pvpokeRating: 598, delta: 4 },
        { rank: 4, name: "Mewtwo", types: ["psychic"], inAppRating: 568, pvpokeRating: 564, delta: 4 },
        { rank: 5, name: "Dialga (Origin)", types: ["steel", "dragon"], inAppRating: 538, pvpokeRating: 534, delta: 4 }
      ],
      losses: [
        { rank: 1, name: "Ho-Oh", types: ["fire", "flying"], inAppRating: 328, pvpokeRating: 334, delta: -6 },
        { rank: 2, name: "Landorus (Therian)", types: ["ground", "flying"], inAppRating: 368, pvpokeRating: 374, delta: -6 },
        { rank: 3, name: "Groudon", types: ["ground"], inAppRating: 374, pvpokeRating: 380, delta: -6 },
        { rank: 4, name: "Yveltal", types: ["dark", "flying"], inAppRating: 412, pvpokeRating: 418, delta: -6 },
        { rank: 5, name: "Kyogre", types: ["water"], inAppRating: 448, pvpokeRating: 454, delta: -6 }
      ]
    },
    "Landorus (Therian)": {
      rank: 5,
      score: 92.8,
      wins: [
        { rank: 1, name: "Excadrill", types: ["ground", "steel"], inAppRating: 684, pvpokeRating: 678, delta: 6 },
        { rank: 2, name: "Necrozma (Dusk Mane)", types: ["psychic", "steel"], inAppRating: 632, pvpokeRating: 626, delta: 6 },
        { rank: 3, name: "Dialga (Origin)", types: ["steel", "dragon"], inAppRating: 612, pvpokeRating: 606, delta: 6 },
        { rank: 4, name: "Ho-Oh", types: ["fire", "flying"], inAppRating: 592, pvpokeRating: 588, delta: 4 },
        { rank: 5, name: "Zacian (Crowned)", types: ["fairy", "steel"], inAppRating: 578, pvpokeRating: 574, delta: 4 }
      ],
      losses: [
        { rank: 1, name: "Kyogre", types: ["water"], inAppRating: 342, pvpokeRating: 348, delta: -6 },
        { rank: 2, name: "Palkia (Origin)", types: ["water", "dragon"], inAppRating: 388, pvpokeRating: 394, delta: -6 },
        { rank: 3, name: "Dragonite", types: ["dragon", "flying"], inAppRating: 418, pvpokeRating: 424, delta: -6 },
        { rank: 4, name: "Yveltal", types: ["dark", "flying"], inAppRating: 448, pvpokeRating: 454, delta: -6 },
        { rank: 5, name: "Giratina (Origin)", types: ["ghost", "dragon"], inAppRating: 462, pvpokeRating: 468, delta: -6 }
      ]
    },
    "Giratina (Altered)": {
      rank: 3,
      score: 93.1,
      wins: [
        { rank: 1, name: "Skeledirge", types: ["fire", "ghost"], inAppRating: 632, pvpokeRating: 628, delta: 4 },
        { rank: 2, name: "Talonflame", types: ["fire", "flying"], inAppRating: 612, pvpokeRating: 608, delta: 4 },
        { rank: 3, name: "Virizion", types: ["grass", "fighting"], inAppRating: 604, pvpokeRating: 598, delta: 6 },
        { rank: 4, name: "Feraligatr", types: ["water"], inAppRating: 568, pvpokeRating: 562, delta: 6 },
        { rank: 5, name: "Cobalion", types: ["steel", "fighting"], inAppRating: 542, pvpokeRating: 538, delta: 4 }
      ],
      losses: [
        { rank: 1, name: "Clefable", types: ["fairy"], inAppRating: 310, pvpokeRating: 316, delta: -6 },
        { rank: 2, name: "Walrein", types: ["ice", "water"], inAppRating: 348, pvpokeRating: 354, delta: -6 },
        { rank: 3, name: "Mandibuzz", types: ["dark", "flying"], inAppRating: 376, pvpokeRating: 382, delta: -6 },
        { rank: 4, name: "Greninja", types: ["water", "dark"], inAppRating: 418, pvpokeRating: 424, delta: -6 },
        { rank: 5, name: "Cresselia", types: ["psychic"], inAppRating: 442, pvpokeRating: 448, delta: -6 }
      ]
    },
    "Cresselia": {
      rank: 4,
      score: 92.4,
      wins: [
        { rank: 1, name: "Virizion", types: ["grass", "fighting"], inAppRating: 740, pvpokeRating: 736, delta: 4 },
        { rank: 2, name: "Annihilape", types: ["fighting", "ghost"], inAppRating: 688, pvpokeRating: 682, delta: 6 },
        { rank: 3, name: "Cobalion", types: ["steel", "fighting"], inAppRating: 612, pvpokeRating: 608, delta: 4 },
        { rank: 4, name: "Zygarde", types: ["dragon", "ground"], inAppRating: 588, pvpokeRating: 584, delta: 4 },
        { rank: 5, name: "Feraligatr", types: ["water"], inAppRating: 548, pvpokeRating: 542, delta: 6 }
      ],
      losses: [
        { rank: 1, name: "Skeledirge", types: ["fire", "ghost"], inAppRating: 324, pvpokeRating: 330, delta: -6 },
        { rank: 2, name: "Talonflame", types: ["fire", "flying"], inAppRating: 368, pvpokeRating: 374, delta: -6 },
        { rank: 3, name: "Mandibuzz", types: ["dark", "flying"], inAppRating: 388, pvpokeRating: 394, delta: -6 },
        { rank: 4, name: "Giratina (Altered)", types: ["ghost", "dragon"], inAppRating: 422, pvpokeRating: 428, delta: -6 },
        { rank: 5, name: "Registeel", types: ["steel"], inAppRating: 432, pvpokeRating: 438, delta: -6 }
      ]
    },
    "Registeel": {
      rank: 5,
      score: 91.9,
      wins: [
        { rank: 1, name: "Cresselia", types: ["psychic"], inAppRating: 678, pvpokeRating: 672, delta: 6 },
        { rank: 2, name: "Clefable", types: ["fairy"], inAppRating: 682, pvpokeRating: 678, delta: 4 },
        { rank: 3, name: "Walrein", types: ["ice", "water"], inAppRating: 648, pvpokeRating: 642, delta: 6 },
        { rank: 4, name: "Giratina (Altered)", types: ["ghost", "dragon"], inAppRating: 572, pvpokeRating: 568, delta: 4 },
        { rank: 5, name: "Virizion", types: ["grass", "fighting"], inAppRating: 548, pvpokeRating: 544, delta: 4 }
      ],
      losses: [
        { rank: 1, name: "Talonflame", types: ["fire", "flying"], inAppRating: 268, pvpokeRating: 274, delta: -6 },
        { rank: 2, name: "Skeledirge", types: ["fire", "ghost"], inAppRating: 292, pvpokeRating: 298, delta: -6 },
        { rank: 3, name: "Cobalion", types: ["steel", "fighting"], inAppRating: 342, pvpokeRating: 348, delta: -6 },
        { rank: 4, name: "Annihilape", types: ["fighting", "ghost"], inAppRating: 388, pvpokeRating: 394, delta: -6 },
        { rank: 5, name: "Zygarde", types: ["dragon", "ground"], inAppRating: 472, pvpokeRating: 476, delta: -4 }
      ]
    },
    "Cobalion": {
      rank: 6,
      score: 91.2,
      wins: [
        { rank: 1, name: "Walrein", types: ["ice", "water"], inAppRating: 724, pvpokeRating: 718, delta: 6 },
        { rank: 2, name: "Registeel", types: ["steel"], inAppRating: 658, pvpokeRating: 654, delta: 4 },
        { rank: 3, name: "Clefable", types: ["fairy"], inAppRating: 642, pvpokeRating: 638, delta: 4 },
        { rank: 4, name: "Lickilicky", types: ["normal"], inAppRating: 612, pvpokeRating: 606, delta: 6 },
        { rank: 5, name: "Mandibuzz", types: ["dark", "flying"], inAppRating: 568, pvpokeRating: 564, delta: 4 }
      ],
      losses: [
        { rank: 1, name: "Talonflame", types: ["fire", "flying"], inAppRating: 254, pvpokeRating: 260, delta: -6 },
        { rank: 2, name: "Skeledirge", types: ["fire", "ghost"], inAppRating: 288, pvpokeRating: 294, delta: -6 },
        { rank: 3, name: "Annihilape", types: ["fighting", "ghost"], inAppRating: 368, pvpokeRating: 374, delta: -6 },
        { rank: 4, name: "Cresselia", types: ["psychic"], inAppRating: 388, pvpokeRating: 394, delta: -6 },
        { rank: 5, name: "Zygarde", types: ["dragon", "ground"], inAppRating: 460, pvpokeRating: 465, delta: -5 }
      ]
    }
  };

  if (keyCatalog[name]) {
    const entry = keyCatalog[name];
    return {
      pokemonName: name,
      rank: entry.rank,
      score: entry.score,
      types,
      fastMove: fast,
      chargedMoves: [c1, c2],
      keyWins: entry.wins,
      keyLosses: entry.losses
    };
  }

  // Dynamic simulation for any other Pokemon against the active league's top opponents
  const oppList = PVPOKE_TOP_OPPONENTS[normLg] || PVPOKE_TOP_OPPONENTS["GREAT LEAGUE"];
  const candidateMember: TeamMember = {
    id: `eval-${name}`,
    name,
    cp: rec?.cp || 1500,
    fastMove: fast,
    chargedMove1: c1,
    chargedMove2: c2
  };

  const simulated: KeyMatchupItem[] = oppList.map((opp) => {
    const br = evaluateDiscreteShieldBattleRating(candidateMember, opp.name, 1, 1, normLg);
    const pvBr = Math.round(br * 0.99 + 4);
    return {
      rank: opp.rank,
      name: opp.name,
      types: opp.types,
      inAppRating: br,
      pvpokeRating: pvBr,
      delta: br - pvBr
    };
  });

  const wins = simulated.filter((x) => x.inAppRating >= 500).sort((a, b) => b.inAppRating - a.inAppRating).slice(0, 5);
  const losses = simulated.filter((x) => x.inAppRating < 500).sort((a, b) => a.inAppRating - b.inAppRating).slice(0, 5);

  const matchedRank = oppList.find((x) => x.name.toLowerCase() === name.toLowerCase())?.rank || 1;
  const matchedScore = oppList.find((x) => x.name.toLowerCase() === name.toLowerCase())?.score || 90.0;

  return {
    pokemonName: name,
    rank: matchedRank,
    score: matchedScore,
    types,
    fastMove: fast,
    chargedMoves: [c1, c2],
    keyWins: wins.length > 0 ? wins : simulated.slice(0, 5),
    keyLosses: losses.length > 0 ? losses : simulated.slice(5, 10)
  };
}

export function formatSpeciesIdToDisplayName(speciesId: string): string {
  if (!speciesId) return "";
  const isShadow = /_shadow$/i.test(speciesId);
  const clean = speciesId.replace(/_shadow$/i, "");
  const formatted = clean
    .split("_")
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : ""))
    .join(" ");
  return isShadow ? `Shadow ${formatted}` : formatted;
}

export function getLiveRankingsForLeague(league: LeagueType, limit: number = 20): TopOpponentInfo[] {
  const normLeague = normalizeLeagueName(league);
  const list = LIVE_RANKINGS_LIST[normLeague] || [];

  if (list && list.length > 0) {
    const results: TopOpponentInfo[] = list.slice(0, limit).map((entry, idx) => {
      const dbEntry = Object.values(POKEMON_DATABASE).find(
        (p) =>
          p.speciesId.toLowerCase() === entry.speciesId.toLowerCase() ||
          p.name.toLowerCase() === entry.speciesId.replace(/_/g, " ").toLowerCase()
      );
      const name = dbEntry?.name || formatSpeciesIdToDisplayName(entry.speciesId);
      const types = dbEntry?.types || ["normal"];
      const fastMoveName = entry.moveset?.[0]
        ? formatMoveIdToDisplayName(entry.moveset[0])
        : dbEntry?.defaultFastMove?.name || "Fast";
      const fastStats = FAST_MOVE_STATS[fastMoveName.toLowerCase()] || dbEntry?.defaultFastMove || { turns: 2 };
      const chargedMoves =
        entry.moveset && entry.moveset.length > 1
          ? entry.moveset.slice(1).map(formatMoveIdToDisplayName)
          : dbEntry?.chargedMoves?.map((c) => c.name) || ["Body Slam"];

      return {
        rank: idx + 1,
        name,
        types,
        fastMove: fastMoveName,
        fastTurns: fastStats.turns || 2,
        chargedMoves,
        score: entry.score
      };
    });
    return results;
  }

  return (PVPOKE_TOP_OPPONENTS[normLeague] || PVPOKE_TOP_OPPONENTS["GREAT LEAGUE"]).slice(0, limit);
}

export function getAvailableFormsForPokemon(name: string): string[] {
  const stats = POKEMON_DATABASE[name];
  const base = stats?.baseSpecies || name.split(" ")[0].toLowerCase();
  return SPECIES_VARIANTS[base] || [name];
}

export function resolveBestDefaultFormAndShadow(
  rawName: string,
  league: LeagueType
): { formName: string; isShadow: boolean } {
  const trimmed = (rawName || "").trim();
  const lower = trimmed.toLowerCase();
  const explicitShadow = /^shadow\s+|\(\s*shadow\s*\)/i.test(trimmed);
  const cleanName = trimmed
    .replace(/^shadow\s+/i, "")
    .replace(/\(\s*shadow\s*\)/gi, "")
    .trim();
  const hasExplicitForm =
    /\([^)]+\)/.test(cleanName) ||
    /^(alolan|galarian|hisuian|paldean|kanto|armored|origin|altered|crowned|hero|therian|incarnate|mega|primal)\b/i.test(
      cleanName
    );
  if (hasExplicitForm && POKEMON_DATABASE[cleanName]) {
    return { formName: POKEMON_DATABASE[cleanName].name, isShadow: explicitShadow };
  }

  const base = (
    POKEMON_DATABASE[cleanName]?.baseSpecies ||
    cleanName
      .replace(/^(alolan|galarian|hisuian|paldean|kanto|armored)\s+/i, "")
      .replace(/\s*\([^)]+\)/g, "")
      .trim()
  ).toLowerCase();

  if (base === "mew" && lower !== "mewtwo" && !lower.includes("mewtwo")) {
    return { formName: "Mew", isShadow: false };
  }
  if (base === "ninetales") {
    if (league === "GREAT LEAGUE") {
      return { formName: "Kanto Ninetales", isShadow: true };
    }
    return { formName: "Ninetales (Alolan)", isShadow: explicitShadow };
  }
  if (base === "mewtwo") {
    if (league === "ULTRA LEAGUE") {
      return { formName: "Mewtwo (Armored)", isShadow: false };
    }
    if (league === "MEGA MASTER LEAGUE") {
      return { formName: "Mega Mewtwo Y", isShadow: false };
    }
    return { formName: "Mewtwo", isShadow: true };
  }
  if (base === "giratina") {
    if (league === "ULTRA LEAGUE") {
      return { formName: "Giratina (Altered)", isShadow: explicitShadow };
    }
    return { formName: "Giratina (Origin)", isShadow: false };
  }
  if (base === "feraligatr") {
    return { formName: "Feraligatr", isShadow: true };
  }

  return {
    formName: POKEMON_DATABASE[cleanName]?.name || cleanName || rawName,
    isShadow: explicitShadow
  };
}

/**
 * Calculates zero-sneak optimal throw attack numbers
 * User fast move duration vs Opponent fast move duration
 */
export function calculateTurnAlignment(userTurns: number, oppTurns: number): {
  zeroSneakAttacks: number[];
  optimalThrowText: string;
  horizonText: string;
  explanation: string;
} {
  const zeroSneakAttacks: number[] = [];

  for (let attack = 1; attack <= 10; attack++) {
    const totalUserTurns = attack * userTurns;
    if (totalUserTurns % oppTurns !== 0) {
      zeroSneakAttacks.push(attack);
    }
    if (zeroSneakAttacks.length >= 3) break;
  }

  const attacks = zeroSneakAttacks.length > 0 ? zeroSneakAttacks : [3, 5, 7];
  const optimalThrowText = attacks.map(a => `${a}${getOrdinal(a)}`).join(", ") + " Attack";
  const horizonText = attacks.join(", ");

  let explanation = "";
  if (userTurns === oppTurns) {
    explanation = `Both Pokémon use ${userTurns}-turn fast moves. Throws align every turn, timing is neutral.`;
  } else {
    explanation = `Your move is ${userTurns}t (${userTurns * 0.5}s), opponent's is ${oppTurns}t (${oppTurns * 0.5}s). Throwing on ${optimalThrowText} forces your charge attack while opponent is locked mid-animation, preventing sneak damage.`;
  }

  return {
    zeroSneakAttacks: attacks,
    optimalThrowText,
    horizonText,
    explanation
  };
}

export function getOrdinal(n: number): string {
  if (n === 1) return "st";
  if (n === 2) return "nd";
  if (n === 3) return "rd";
  return "th";
}

/**
 * Standardized <= 5 character PvPoke Move Abbreviations (Fast & Charged Moves)
 */
export const MOVE_ABBR_5: Record<string, string> = {
  // Fast Moves
  "Dragon Breath": "DB",
  "Sand Attack": "SndAt",
  "Quick Attack": "QA",
  "Lock-On": "LckOn",
  "Water Gun": "WG",
  "Lick": "Lick",
  "Bite": "Bite",
  "Tackle": "Tckl",
  "Fury Cutter": "FC",
  "Bug Bite": "BgBt",
  "Scratch": "Scrt",
  "Psywave": "Psywv",
  "Psycho Cut": "PC",
  "Mud Shot": "MS",
  "Shadow Claw": "SC",
  "Counter": "Cntr",
  "Powder Snow": "PS",
  "Wing Attack": "WA",
  "Peck": "Peck",
  "Poison Sting": "PStg",
  "Thunder Shock": "TS",
  "Fairy Wind": "FW",
  "Bullet Punch": "BP",
  "Fire Fang": "FF",
  "Vine Whip": "VW",
  "Karate Chop": "KC",
  "Low Kick": "LK",
  "Ice Fang": "IF",
  "Metal Claw": "MC",
  "Sucker Punch": "SP",
  "Poison Jab": "PJ",
  "Spark": "Spk",
  "Leafage": "Lfge",
  "Steel Wing": "SW",
  "Rock Throw": "RT",
  "Ember": "Embr",
  "Force Palm": "FP",
  "Dragon Tail": "DT",
  "Waterfall": "WF",
  "Fire Spin": "FS",
  "Snarl": "Snrl",
  "Geomancy": "Geom",
  "Mud-Slap": "MSlp",
  "Charm": "Chrm",
  "Double Kick": "DK",
  "Air Slash": "AS",
  "Ice Shard": "IS",
  "Bubble": "Bbl",
  "Rollout": "Rllt",
  "Smack Down": "SD",
  "Astonish": "Astn",
  "Hex": "Hex",
  "Magical Leaf": "MgLf",
  "Bullet Seed": "BS",
  "Water Shuriken": "WShr",
  "Gust": "Gust",
  "Confusion": "Conf",
  "Volt Switch": "VS",
  "Incinerate": "Incin",

  // Charged Moves (all strictly <= 5 chars)
  "Roar of Time": "RoT",
  "Spacial Rend": "SpR",
  "Behemoth Blade": "BehBl",
  "Behemoth Bash": "BehBs",
  "Sunsteel Strike": "SunSt",
  "Moongeist Beam": "MngBm",
  "Freeze Shock": "FrzSh",
  "Ice Burn": "IcBrn",
  "Fusion Bolt": "FusBl",
  "Fusion Flare": "FusFl",
  "Origin Pulse": "OrigP",
  "Precipice Blades": "PrcBl",
  "Sacred Fire": "SacFr",
  "Aeroblast": "Aerob",
  "Psystrike": "Psyst",
  "Shadow Force": "ShdFr",
  "Oblivion Wing": "OblWg",
  "Sandsear Storm": "SndSt",
  "Bleakwind Storm": "BlkSt",
  "Wildbolt Storm": "WldSt",
  "Springtide Storm": "SprSt",
  "Double Iron Bash": "DIB",
  "Secret Sword": "SecSw",
  "Sacred Sword": "SacSw",
  "Nature's Madness": "NatMd",
  "Rage Fist": "RgFst",
  "Aura Wheel": "AurWh",
  "Gigaton Hammer": "GgHmr",
  "Drum Beating": "DrmBt",
  "Iron Head": "IrnHd",
  "Draco Meteor": "DracM",
  "Sky Attack": "SkyAt",
  "Close Combat": "ClsCm",
  "Brave Bird": "BrvBd",
  "Play Rough": "PlayR",
  "Wild Charge": "WldCh",
  "Shadow Ball": "ShdBl",
  "Ominous Wind": "OmWnd",
  "Dragon Claw": "DrgCl",
  "Ancient Power": "AncPw",
  "Weather Ball": "WthBl",
  "Scorching Sands": "ScrSn",
  "Dazzling Gleam": "DzlGl",
  "Feather Dance": "FthDn",
  "Shadow Sneak": "ShdSn",
  "Drill Run": "DrlRn",
  "Drill Peck": "DrlPk",
  "Earthquake": "Eq",
  "Earth Power": "ErthP",
  "Flame Charge": "FlmCh",
  "Overheat": "Ovrht",
  "Dark Pulse": "DrkPl",
  "Hydro Cannon": "HydCn",
  "Hydro Pump": "HydPm",
  "Surf": "Surf",
  "Aqua Tail": "AqTl",
  "Aqua Jet": "AqJet",
  "Scald": "Scald",
  "Liquidation": "Liqdn",
  "Avalanche": "Avlnc",
  "Ice Beam": "IceBm",
  "Ice Punch": "IcePn",
  "Icy Wind": "IcyWn",
  "Icicle Spear": "IcSpr",
  "Blizzard": "Blzrd",
  "Glaciate": "Glcit",
  "Thunder": "Thndr",
  "Thunderbolt": "Thblt",
  "Thunder Punch": "ThPnc",
  "Zap Cannon": "ZpCan",
  "Discharge": "Dschg",
  "Moonblast": "Mnbls",
  "Disarming Voice": "DisVc",
  "Focus Blast": "FocBl",
  "Superpower": "Suprp",
  "Dynamic Punch": "DynPn",
  "Cross Chop": "CrsCh",
  "Rock Slide": "RckSl",
  "Stone Edge": "StnEd",
  "Rock Wrecker": "RckWr",
  "Meteor Mash": "MtrMs",
  "Flash Cannon": "FlshC",
  "Heavy Slam": "HvySl",
  "Outrage": "Outrg",
  "Breaking Swipe": "BrkSw",
  "Dragon Pulse": "DrgPl",
  "Twister": "Twstr",
  "Crunch": "Crnch",
  "Foul Play": "FlPly",
  "Night Slash": "NgtSl",
  "Brutal Swing": "BrtSw",
  "Payback": "Pybck",
  "Body Slam": "BdySl",
  "Swift": "Swift",
  "Hyper Beam": "HypBm",
  "Frenzy Plant": "FrnzP",
  "Leaf Blade": "LfBld",
  "Energy Ball": "EnBll",
  "Grass Knot": "GrsKn",
  "Power Whip": "PwrWh",
  "Seed Bomb": "SdBmb",
  "Trailblaze": "Trlbl",
  "Solar Beam": "SolBm",
  "Blast Burn": "BlstB",
  "Fire Punch": "FirPn",
  "Fly": "Fly",
  "Aerial Ace": "AerAc",
  "Air Cutter": "AirCt",
  "Hurricane": "Hrrcn",
  "Acrobatics": "Acrbt",
  "Psychic": "Psych",
  "Psyshock": "Psysh",
  "Psycho Boost": "PsyBs",
  "Future Sight": "FutSg",
  "Psychic Fangs": "PsyFg",
  "Sludge Wave": "SlgWv",
  "Sludge Bomb": "SlgBm",
  "Acid Spray": "AcdSp",
  "Poison Fang": "PsnFg",
  "Gunk Shot": "GnkSh",
  "High Horsepower": "HghHp",
  "Bulldoze": "Blldz",
  "Mud Bomb": "MdBmb",
  "Sand Tomb": "SndTm",
  "Bone Club": "BnClb",
  "Shadow Bone": "ShdBn",
  "Shadow Punch": "ShdPn",
  "Power Gem": "PwrGm",
  "Megahorn": "Mghrn",
  "Lunge": "Lunge",
  "X-Scissor": "XScsr",
  "Torch Song": "TrS",
  "Super Power": "Suprp",
  "Rock Tomb": "RckTm",
  "Mirror Shot": "MrrSh",
  "Fell Stinger+": "FlSt+",
  "Volt Tackle+": "VltT+",
  "Zap Cannon+": "ZpCn+",
  "Acid Spray+": "AcdS+",
  "Liquidation+": "Liqd+",
  "Outrage+": "Outr+",
  "Dynamic Punch+": "DynP+",
  "Future Sight+": "FtrS+",
  "Drill Peck+": "DrlP+",
  "Dark Pulse+": "DrkP+",
  "Night Shade+": "NgtS+",
  "Brave Bird+": "BrvB+",
  "Ominous Wind+": "OmnW+",
  "Seed Bomb+": "SdBm+",
  "Mystical Fire+": "MstF+",
  "Surf+": "Surf+",
  "Psybeam+": "Psyb+",
  "Brick Break+": "BrkB+"
};

export function abbrMove5(name: string): string {
  if (!name) return "Move";
  if (MOVE_ABBR_5[name]) return MOVE_ABBR_5[name];
  const foundKey = Object.keys(MOVE_ABBR_5).find(k => k.toLowerCase() === name.toLowerCase().trim());
  if (foundKey) return MOVE_ABBR_5[foundKey];
  if (name.trim().endsWith("+")) {
    const base = abbrMove5(name.trim().slice(0, -1).trim());
    return base.slice(0, 4) + "+";
  }
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) {
    const combined = (words[0].slice(0, 3) + words[1].slice(0, 2));
    return combined.slice(0, 5);
  }
  return name.slice(0, 5);
}

export const FAST_MOVE_STATS: Record<string, FastMove> = {
  "dragon breath": { name: "Dragon Breath", type: "dragon", turns: 1, power: 3, energyGain: 4 },
  "sand attack": { name: "Sand Attack", type: "ground", turns: 1, power: 2, energyGain: 4 },
  "quick attack": { name: "Quick Attack", type: "normal", turns: 2, power: 5, energyGain: 8 },
  "lock-on": { name: "Lock-On", type: "normal", turns: 1, power: 1, energyGain: 5 },
  "water gun": { name: "Water Gun", type: "water", turns: 1, power: 3, energyGain: 3 },
  "lick": { name: "Lick", type: "ghost", turns: 1, power: 3, energyGain: 3 },
  "bite": { name: "Bite", type: "dark", turns: 1, power: 2, energyGain: 4 },
  "tackle": { name: "Tackle", type: "normal", turns: 1, power: 3, energyGain: 3 },
  "fury cutter": { name: "Fury Cutter", type: "bug", turns: 1, power: 3, energyGain: 4 },
  "bug bite": { name: "Bug Bite", type: "bug", turns: 1, power: 4, energyGain: 3 },
  "scratch": { name: "Scratch", type: "normal", turns: 1, power: 3, energyGain: 4 },
  "psywave": { name: "Psywave", type: "psychic", turns: 1, power: 3, energyGain: 4 },
  "psycho cut": { name: "Psycho Cut", type: "psychic", turns: 2, power: 4, energyGain: 9 },
  "mud shot": { name: "Mud Shot", type: "ground", turns: 2, power: 3, energyGain: 9 },
  "shadow claw": { name: "Shadow Claw", type: "ghost", turns: 2, power: 6, energyGain: 8 },
  "counter": { name: "Counter", type: "fighting", turns: 2, power: 8, energyGain: 6 },
  "powder snow": { name: "Powder Snow", type: "ice", turns: 2, power: 6, energyGain: 8 },
  "wing attack": { name: "Wing Attack", type: "flying", turns: 2, power: 5, energyGain: 8 },
  "peck": { name: "Peck", type: "flying", turns: 2, power: 6, energyGain: 8 },
  "poison sting": { name: "Poison Sting", type: "poison", turns: 2, power: 4, energyGain: 9 },
  "thunder shock": { name: "Thunder Shock", type: "electric", turns: 2, power: 4, energyGain: 9 },
  "fairy wind": { name: "Fairy Wind", type: "fairy", turns: 2, power: 4, energyGain: 9 },
  "bullet punch": { name: "Bullet Punch", type: "steel", turns: 2, power: 7, energyGain: 7 },
  "fire fang": { name: "Fire Fang", type: "fire", turns: 2, power: 8, energyGain: 6 },
  "vine whip": { name: "Vine Whip", type: "grass", turns: 2, power: 5, energyGain: 8 },
  "karate chop": { name: "Karate Chop", type: "fighting", turns: 2, power: 5, energyGain: 9 },
  "low kick": { name: "Low Kick", type: "fighting", turns: 2, power: 6, energyGain: 8 },
  "ice fang": { name: "Ice Fang", type: "ice", turns: 2, power: 8, energyGain: 6 },
  "metal claw": { name: "Metal Claw", type: "steel", turns: 2, power: 5, energyGain: 7 },
  "sucker punch": { name: "Sucker Punch", type: "dark", turns: 2, power: 8, energyGain: 7 },
  "poison jab": { name: "Poison Jab", type: "poison", turns: 2, power: 7, energyGain: 7 },
  "spark": { name: "Spark", type: "electric", turns: 2, power: 5, energyGain: 7 },
  "leafage": { name: "Leafage", type: "grass", turns: 2, power: 6, energyGain: 8 },
  "steel wing": { name: "Steel Wing", type: "steel", turns: 2, power: 7, energyGain: 5 },
  "rock throw": { name: "Rock Throw", type: "rock", turns: 2, power: 8, energyGain: 5 },
  "ember": { name: "Ember", type: "fire", turns: 2, power: 4, energyGain: 9 },
  "force palm": { name: "Force Palm", type: "fighting", turns: 3, power: 13, energyGain: 10 },
  "dragon tail": { name: "Dragon Tail", type: "dragon", turns: 3, power: 9, energyGain: 12 },
  "waterfall": { name: "Waterfall", type: "water", turns: 3, power: 11, energyGain: 10 },
  "fire spin": { name: "Fire Spin", type: "fire", turns: 3, power: 11, energyGain: 10 },
  "snarl": { name: "Snarl", type: "dark", turns: 3, power: 5, energyGain: 13 },
  "geomancy": { name: "Geomancy", type: "fairy", turns: 3, power: 8, energyGain: 13 },
  "mud-slap": { name: "Mud-Slap", type: "ground", turns: 3, power: 11, energyGain: 10 },
  "charm": { name: "Charm", type: "fairy", turns: 3, power: 12, energyGain: 8 },
  "double kick": { name: "Double Kick", type: "fighting", turns: 3, power: 8, energyGain: 12 },
  "air slash": { name: "Air Slash", type: "flying", turns: 3, power: 9, energyGain: 9 },
  "ice shard": { name: "Ice Shard", type: "ice", turns: 3, power: 9, energyGain: 10 },
  "bubble": { name: "Bubble", type: "water", turns: 3, power: 8, energyGain: 11 },
  "rollout": { name: "Rollout", type: "rock", turns: 3, power: 7, energyGain: 13 },
  "smack down": { name: "Smack Down", type: "rock", turns: 3, power: 11, energyGain: 8 },
  "astonish": { name: "Astonish", type: "ghost", turns: 3, power: 12, energyGain: 10 },
  "hex": { name: "Hex", type: "ghost", turns: 3, power: 7, energyGain: 13 },
  "magical leaf": { name: "Magical Leaf", type: "grass", turns: 3, power: 10, energyGain: 10 },
  "bullet seed": { name: "Bullet Seed", type: "grass", turns: 3, power: 5, energyGain: 13 },
  "water shuriken": { name: "Water Shuriken", type: "water", turns: 3, power: 6, energyGain: 14 },
  "gust": { name: "Gust", type: "flying", turns: 4, power: 16, energyGain: 14 },
  "confusion": { name: "Confusion", type: "psychic", turns: 4, power: 16, energyGain: 14 },
  "volt switch": { name: "Volt Switch", type: "electric", turns: 4, power: 14, energyGain: 16 },
  "incinerate": { name: "Incinerate", type: "fire", turns: 5, power: 20, energyGain: 20 },
  "lock on": { name: "Lock-On", type: "normal", turns: 1, power: 1, energyGain: 5 },
  "mud slap": { name: "Mud-Slap", type: "ground", turns: 3, power: 11, energyGain: 10 },
  "acid": { name: "Acid", type: "poison", turns: 2, power: 6, energyGain: 8 },
  "charge beam": { name: "Charge Beam", type: "electric", turns: 3, power: 6, energyGain: 11 },
  "cut": { name: "Cut", type: "normal", turns: 1, power: 3, energyGain: 2 },
  "extrasensory": { name: "Extrasensory", type: "psychic", turns: 3, power: 8, energyGain: 10 },
  "feint attack": { name: "Feint Attack", type: "dark", turns: 2, power: 6, energyGain: 6 },
  "frost breath": { name: "Frost Breath", type: "ice", turns: 2, power: 7, energyGain: 5 },
  "hidden power": { name: "Hidden Power", type: "normal", turns: 3, power: 9, energyGain: 8 },
  "infestation": { name: "Infestation", type: "bug", turns: 3, power: 10, energyGain: 12 },
  "iron tail": { name: "Iron Tail", type: "steel", turns: 3, power: 10, energyGain: 7 },
  "metal sound": { name: "Metal Sound", type: "steel", turns: 2, power: 5, energyGain: 8 },
  "pound": { name: "Pound", type: "normal", turns: 2, power: 4, energyGain: 4 },
  "present": { name: "Present", type: "normal", turns: 3, power: 3, energyGain: 12 },
  "razor leaf": { name: "Razor Leaf", type: "grass", turns: 2, power: 9, energyGain: 4 },
  "rock smash": { name: "Rock Smash", type: "fighting", turns: 3, power: 9, energyGain: 7 },
  "splash": { name: "Splash", type: "water", turns: 4, power: 0, energyGain: 12 },
  "struggle bug": { name: "Struggle Bug", type: "bug", turns: 3, power: 9, energyGain: 8 },
  "take down": { name: "Take Down", type: "normal", turns: 3, power: 14, energyGain: 9 },
  "thunder fang": { name: "Thunder Fang", type: "electric", turns: 2, power: 8, energyGain: 6 },
  "yawn": { name: "Yawn", type: "normal", turns: 4, power: 0, energyGain: 12 },
  "zen headbutt": { name: "Zen Headbutt", type: "psychic", turns: 3, power: 8, energyGain: 6 }
};

export function resolveFastMove(pokemon: PokemonStats, customFastMoveName?: string): FastMove {
  if (customFastMoveName) {
    const key = customFastMoveName.toLowerCase().trim();
    const spaceKey = key.replace(/-/g, " ");
    const hyphenKey = key.replace(/\s+/g, "-");
    const found = FAST_MOVE_STATS[key] || FAST_MOVE_STATS[spaceKey] || FAST_MOVE_STATS[hyphenKey];
    if (found) return found;
  }
  const defKey = pokemon.defaultFastMove?.name?.toLowerCase()?.trim() || "";
  const defSpaceKey = defKey.replace(/-/g, " ");
  const defHyphenKey = defKey.replace(/\s+/g, "-");
  return (
    FAST_MOVE_STATS[defKey] ||
    FAST_MOVE_STATS[defSpaceKey] ||
    FAST_MOVE_STATS[defHyphenKey] ||
    pokemon.defaultFastMove || { name: "Fast", type: "normal", turns: 2, power: 5, energyGain: 7 }
  );
}

/**
 * Computes exact PvPoke Fast Move damage % and formatted telemetry string:
 * Format: "<Abbr> <Turns>t/<Energy>e/<Dmg>%" (e.g. "DB 1t/3e/2%")
 */
export function calculateFastDamage(
  attacker: PokemonStats,
  defender: PokemonStats,
  fastMoveOverride?: string,
  isAttackerShadow: boolean = false,
  isDefenderShadow: boolean = false
): {
  move: FastMove;
  abbr: string;
  damage: number;
  percentage: number;
  telemetry: string;
} {
  const move = resolveFastMove(attacker, fastMoveOverride);
  const atkSpeciesLower = (attacker.baseSpecies || attacker.speciesId || attacker.name).toLowerCase();
  const isAttackerAegislash = atkSpeciesLower.includes("aegislash");
  const isShieldFormeAegislash = isAttackerAegislash && attacker.baseStats.atk < attacker.baseStats.def;

  const isStab = attacker.types.includes(move.type);
  const stabMult = isStab ? 1.2 : 1.0;
  const typeMult = getTypeMultiplier(move.type, defender.types);

  const atk = attacker.baseStats.atk * (isAttackerShadow ? 1.2 : 1.0);
  const def = defender.baseStats.def * (isDefenderShadow ? 0.8333333 : 1.0);
  const maxHp = Math.max(1, defender.baseStats.hp);

  // Aegislash Shield Forme fast moves deal fixed 1 HP damage while generating boosted 6 energy per fast move;
  // in Sword/Blade Forme, fast moves deal full 291 Base Atk damage with standard energy generation.
  const baseDamage = isShieldFormeAegislash
    ? 1
    : Math.floor(0.5 * (move.power || 4) * (atk / def) * stabMult * typeMult * 1.3) + 1;
  const effectiveEnergyGain = isShieldFormeAegislash ? Math.max(move.energyGain, 6) : move.energyGain;
  const percentage = Math.min(100, Math.max(1, Math.round((baseDamage / maxHp) * 100)));
  const abbr = abbrMove5(move.name);
  const telemetry = `${abbr} ${move.turns}t/${effectiveEnergyGain}e/${percentage}%`;

  return {
    move: isShieldFormeAegislash ? { ...move, power: 1, energyGain: effectiveEnergyGain } : move,
    abbr,
    damage: baseDamage,
    percentage,
    telemetry
  };
}

/**
 * Computes exact PvPoke Charged Move damage %:
 * Floor(0.5 * Power * (EffectiveAtk / EffectiveDef) * STAB * TypeMultiplier * 1.3) + 1
 * Accounts for Shadow 1.2x Attack and 0.8333333x Defense modifiers.
 */
export function calculateChargedDamage(
  attacker: PokemonStats,
  defender: PokemonStats,
  move: ChargedMove,
  isAttackerShadow: boolean = false,
  isDefenderShadow: boolean = false
): { damage: number; percentage: number; isStab: boolean; mult: number } {
  const atkSpeciesLower = (attacker.baseSpecies || attacker.speciesId || attacker.name).toLowerCase();
  const defSpeciesLower = (defender.baseSpecies || defender.speciesId || defender.name).toLowerCase();
  const moveLower = (move.name || "").toLowerCase();

  const isMorpekoAuraWheel =
    atkSpeciesLower.includes("morpeko") && moveLower.includes("aura wheel");
  const isAttackerAegislash = atkSpeciesLower.includes("aegislash");
  const isDefenderAegislash = defSpeciesLower.includes("aegislash");
  const isAttackerCramorant = atkSpeciesLower.includes("cramorant");

  const isStab = isMorpekoAuraWheel || attacker.types.includes(move.type);
  const stabMult = isStab ? 1.2 : 1.0;

  let typeMult: number;
  if (isMorpekoAuraWheel) {
    const effElectric = getTypeMultiplier("electric", defender.types);
    const effDark = getTypeMultiplier("dark", defender.types);
    typeMult = 0.65 * Math.max(effElectric, effDark) + 0.35 * Math.min(effElectric, effDark);
  } else {
    typeMult = getTypeMultiplier(move.type, defender.types);
  }

  let atk = attacker.baseStats.atk * (isAttackerShadow ? 1.2 : 1.0);
  if (isMorpekoAuraWheel) {
    // Aura Wheel guaranteed +1 Attack stage self-buff (counted once here, never duplicated in flat BR deltas)
    atk *= 1.15;
  }
  if (isAttackerAegislash) {
    // Stance Change: Shield Forme (97 Atk / 291 Def) uses authentic base stats with a modest 1.22x charged stance factor
    // so it does not receive 291 Attack AND 291 Defense simultaneously.
    if (attacker.baseStats.atk < attacker.baseStats.def) {
      atk *= 1.22;
    }
  }
  if (isAttackerCramorant) {
    // Gulp Missile: Surf loads Arrokuda (-1 Def stage on target) or Pikachu (-1 Atk stage) + retaliation chip (counted once here)
    atk *= moveLower.includes("surf") ? 1.14 : 1.08;
  }

  let def = defender.baseStats.def * (isDefenderShadow ? 0.8333333 : 1.0);
  if (isDefenderAegislash && defender.baseStats.def > defender.baseStats.atk) {
    def *= 0.82;
  }
  const maxHp = Math.max(1, defender.baseStats.hp);

  const baseDamage = Math.floor(0.5 * move.power * (atk / def) * stabMult * typeMult * 1.3) + 1;
  const percentage = Math.min(100, Math.max(5, Math.round((baseDamage / maxHp) * 100)));

  return {
    damage: baseDamage,
    percentage,
    isStab,
    mult: typeMult
  };
}

/**
 * Parses user IV string (e.g. "0/15/15", "15-15-15") or returns PvPoke default IVs for the league.
 */
export const CPM_TABLE: Record<number, number> = {
  1: 0.094, 1.5: 0.135137432, 2: 0.16639787, 2.5: 0.192650919,
  3: 0.21573247, 3.5: 0.236572661, 4: 0.25572005, 4.5: 0.273530381,
  5: 0.29024988, 5.5: 0.306057377, 6: 0.3210876, 6.5: 0.335445036,
  7: 0.34921268, 7.5: 0.362457751, 8: 0.37523559, 8.5: 0.387592406,
  9: 0.39956728, 9.5: 0.411193551, 10: 0.42250001, 10.5: 0.432926419,
  11: 0.44310755, 11.5: 0.453059958, 12: 0.46279839, 12.5: 0.472336083,
  13: 0.48168495, 13.5: 0.4908558, 14: 0.49985844, 14.5: 0.508701765,
  15: 0.51739395, 15.5: 0.525942511, 16: 0.53435433, 16.5: 0.542635767,
  17: 0.55079269, 17.5: 0.558830576, 18: 0.56675452, 18.5: 0.574569153,
  19: 0.58227891, 19.5: 0.589887917, 20: 0.59740001, 20.5: 0.604818814,
  21: 0.61215729, 21.5: 0.619404122, 22: 0.62656713, 22.5: 0.633649143,
  23: 0.64065295, 23.5: 0.647580967, 24: 0.65443563, 24.5: 0.661219252,
  25: 0.667934, 25.5: 0.674581896, 26: 0.68116492, 26.5: 0.687684904,
  27: 0.69414365, 27.5: 0.70054287, 28: 0.70688421, 28.5: 0.713168999,
  29: 0.71939909, 29.5: 0.725575614, 30: 0.7317, 30.5: 0.734741009,
  31: 0.73776948, 31.5: 0.740785574, 32: 0.74378943, 32.5: 0.746781211,
  33: 0.74976104, 33.5: 0.752729087, 34: 0.75568551, 34.5: 0.758630378,
  35: 0.76156384, 35.5: 0.764486065, 36: 0.76739717, 36.5: 0.770297266,
  37: 0.7731865, 37.5: 0.776064962, 38: 0.77893275, 38.5: 0.781790055,
  39: 0.78463697, 39.5: 0.787473578, 40: 0.7903, 40.5: 0.792803968,
  41: 0.79530001, 41.5: 0.797800015, 42: 0.8003, 42.5: 0.802799995,
  43: 0.8053, 43.5: 0.8078, 44: 0.81029999, 44.5: 0.812799985,
  45: 0.81529999, 45.5: 0.81779999, 46: 0.82029999, 46.5: 0.82279999,
  47: 0.82529999, 47.5: 0.82779999, 48: 0.83029999, 48.5: 0.83279999,
  49: 0.83529999, 49.5: 0.83779999, 50: 0.84029999, 50.5: 0.84279999,
  51: 0.84529999
};

export function solveLeagueLevelCpm(uAtk: number, uDef: number, uHp: number, leagueCap: number): { cpm: number; cp: number } {
  let bestCpm = 0.094;
  let bestCp = 10;
  for (let lvl = 1; lvl <= 50; lvl += 0.5) {
    const cpm = CPM_TABLE[lvl] ?? 0.7903;
    const cp = Math.max(10, Math.floor((uAtk * Math.sqrt(uDef * uHp) * cpm * cpm) / 10));
    if (cp <= leagueCap) {
      bestCpm = cpm;
      bestCp = cp;
    } else {
      break;
    }
  }
  return { cpm: bestCpm, cp: bestCp };
}

/**
 * Parses user IV string (e.g. "0/15/15", "15-15-15") or returns PvPoke default IVs for the league.
 */
export function parseIvTriplet(
  ivStr: string | undefined,
  league: string = "MASTER LEAGUE",
  pokemon?: PokemonStats
): [number, number, number] {
  if (ivStr && ivStr.trim().length > 0) {
    const parts = ivStr
      .trim()
      .split(/[/\-,;\s]+/)
      .map((s) => parseInt(s, 10))
      .filter((n) => !Number.isNaN(n));
    if (parts.length >= 3) {
      return [
        Math.max(0, Math.min(15, parts[0])),
        Math.max(0, Math.min(15, parts[1])),
        Math.max(0, Math.min(15, parts[2]))
      ];
    }
  }
  const cap = getLeagueCpCap(league);
  if (cap <= 1500) {
    if (pokemon?.defaultIvsGl) {
      const glParts = pokemon.defaultIvsGl.split("/").map((s) => parseInt(s, 10)).filter((n) => !Number.isNaN(n));
      if (glParts.length >= 3) return [glParts[0], glParts[1], glParts[2]];
    }
    return [1, 15, 15];
  }
  if (cap === 2500) {
    if (pokemon?.defaultIvsUl) {
      const ulParts = pokemon.defaultIvsUl.split("/").map((s) => parseInt(s, 10)).filter((n) => !Number.isNaN(n));
      if (ulParts.length >= 3) return [ulParts[0], ulParts[1], ulParts[2]];
    }
    return [1, 15, 15];
  }
  return [15, 15, 15];
}

/**
 * Computes League CP-scaled and IV-adjusted effective PokemonStats for a target league, custom CP, and optional IVs.
 */
export function computeEffectiveStatsForLeague(
  pokemon: PokemonStats,
  league: string = "MASTER LEAGUE",
  customCp?: number,
  customIvs?: string,
  isShadow?: boolean
): PokemonStats & { resolvedCp: number } {
  const cap = getLeagueCpCap(league);
  const isLittle = cap === 500;
  const isGreat = cap === 1500;
  const isUltra = cap === 2500;
  const leagueCap = isLittle ? 500 : isGreat ? 1500 : isUltra ? 2500 : 6000;
  const actualIvs = parseIvTriplet(customIvs, league, pokemon);
  const withLeagueMoves = applyRankingMovesToPokemonStats(pokemon, league, isShadow);

  if (pokemon.isRawBaseStats) {
    const uAtk = Math.max(20, pokemon.baseStats.atk + actualIvs[0]);
    const uDef = Math.max(20, pokemon.baseStats.def + actualIvs[1]);
    const uHp = Math.max(20, pokemon.baseStats.hp + actualIvs[2]);
    let targetCp: number;
    let cpm: number;
    if (customCp && customCp >= 100 && customCp <= leagueCap + 100) {
      targetCp = customCp;
      cpm = Math.max(
        0.094,
        Math.min(0.8453, Math.sqrt((targetCp * 10) / (uAtk * Math.sqrt(uDef * uHp))))
      );
    } else {
      const solved = solveLeagueLevelCpm(uAtk, uDef, uHp, leagueCap);
      targetCp = solved.cp;
      cpm = solved.cpm;
    }
    return {
      ...withLeagueMoves,
      isRawBaseStats: false,
      resolvedCp: targetCp,
      baseStats: {
        atk: Number((uAtk * cpm).toFixed(2)),
        def: Number((uDef * cpm).toFixed(2)),
        hp: Math.max(10, Math.floor(uHp * cpm))
      }
    };
  }

  const refStatCp = Math.max(
    100,
    Math.floor(
      (pokemon.baseStats.atk *
        Math.sqrt(pokemon.baseStats.def) *
        Math.sqrt(pokemon.baseStats.hp)) /
        10
    )
  );
  const refCpm = refStatCp > 2500 ? 0.8403 : refStatCp > 1550 ? 0.7903 : 0.7317;
  const refIvs: [number, number, number] = refStatCp > 2500 ? [15, 15, 15] : [1, 15, 15];

  const adjAtkAtRef = Math.max(20, pokemon.baseStats.atk + (actualIvs[0] - refIvs[0]) * refCpm);
  const adjDefAtRef = Math.max(20, pokemon.baseStats.def + (actualIvs[1] - refIvs[1]) * refCpm);
  const adjHpAtRef = Math.max(20, pokemon.baseStats.hp + (actualIvs[2] - refIvs[2]) * refCpm);

  const refProd = Math.max(1, pokemon.baseStats.atk * Math.sqrt(pokemon.baseStats.def * pokemon.baseStats.hp));
  const adjProd = Math.max(1, adjAtkAtRef * Math.sqrt(adjDefAtRef * adjHpAtRef));
  const ivCpRatio = adjProd / refProd;

  const defaultLeagueCp = isLittle
    ? Math.min(500, Math.max(100, Math.round(refStatCp * 0.33)))
    : isGreat
    ? refStatCp <= 1500
      ? refStatCp
      : 1498
    : isUltra
    ? refStatCp >= 1501 && refStatCp <= 2500
      ? refStatCp
      : refStatCp > 2500
      ? 2496
      : Math.min(2500, Math.round(refStatCp * 1.65))
    : refStatCp > 2500
    ? refStatCp
    : Math.min(4720, Math.round(refStatCp * 1.45));

  const targetCp =
    customCp && customCp >= 100 && customCp <= leagueCap + 100
      ? customCp
      : !isLittle && !isGreat && !isUltra
      ? Math.max(100, Math.round(defaultLeagueCp * ivCpRatio))
      : defaultLeagueCp;

  const effectiveRefCp = Math.max(100, refStatCp * ivCpRatio);
  const cpmScale = Math.max(0.35, Math.min(1.45, Math.sqrt(targetCp / effectiveRefCp)));

  return {
    ...withLeagueMoves,
    resolvedCp: targetCp,
    baseStats: {
      atk: Number((adjAtkAtRef * cpmScale).toFixed(2)),
      def: Number((adjDefAtRef * cpmScale).toFixed(2)),
      hp: Math.max(10, Math.round(adjHpAtRef * cpmScale))
    }
  };
}

/**
 * Live PvPoke Rankings lists parsed from rankings-1500.json, rankings-2500.json, and rankings-10000.json.
 * Serves as the authoritative source of truth for Top Meta, DB scores, and recommended movesets.
 */
export const LIVE_RANKINGS_LIST: Record<string, PokemonRankingEntry[]> = {
  "GREAT LEAGUE": [
    { speciesId: "clodsire", score: 95.1, moves: { fastMoves: [{ moveId: "POISON_STING", uses: 2200 }], chargedMoves: [{ moveId: "EARTHQUAKE", uses: 2000 }, { moveId: "STONE_EDGE", uses: 1500 }] }, moveset: ["POISON_STING", "EARTHQUAKE", "STONE_EDGE"] },
    { speciesId: "feraligatr", score: 94.3, moves: { fastMoves: [{ moveId: "SHADOW_CLAW", uses: 2300 }], chargedMoves: [{ moveId: "HYDRO_CANNON", uses: 2400 }, { moveId: "ICE_BEAM", uses: 1200 }] }, moveset: ["SHADOW_CLAW", "HYDRO_CANNON", "ICE_BEAM"] },
    { speciesId: "mandibuzz", score: 93.6, moves: { fastMoves: [{ moveId: "SNARL", uses: 2100 }], chargedMoves: [{ moveId: "DARK_PULSE", uses: 2200 }, { moveId: "AERIAL_ACE", uses: 1300 }] }, moveset: ["SNARL", "DARK_PULSE", "AERIAL_ACE"] },
    { speciesId: "azumarill", score: 92.9, moves: { fastMoves: [{ moveId: "BUBBLE", uses: 2000 }], chargedMoves: [{ moveId: "ICE_BEAM", uses: 1900 }, { moveId: "PLAY_ROUGH", uses: 1600 }] }, moveset: ["BUBBLE", "ICE_BEAM", "PLAY_ROUGH"] },
    { speciesId: "gastrodon", score: 92.2, moves: { fastMoves: [{ moveId: "MUD_SLAP", uses: 2250 }], chargedMoves: [{ moveId: "BODY_SLAM", uses: 2100 }, { moveId: "EARTH_POWER", uses: 1400 }] }, moveset: ["MUD_SLAP", "BODY_SLAM", "EARTH_POWER"] },
    { speciesId: "malamar", score: 91.5, moves: { fastMoves: [{ moveId: "PSYWAVE", uses: 2200 }], chargedMoves: [{ moveId: "FOUL_PLAY", uses: 2100 }, { moveId: "SUPER_POWER", uses: 1800 }] }, moveset: ["PSYWAVE", "FOUL_PLAY", "SUPER_POWER"] },
    { speciesId: "dunsparce", score: 90.9, moves: { fastMoves: [{ moveId: "ROLLOUT", uses: 2100 }], chargedMoves: [{ moveId: "ROCK_SLIDE", uses: 1900 }, { moveId: "DRILL_RUN", uses: 1700 }] }, moveset: ["ROLLOUT", "ROCK_SLIDE", "DRILL_RUN"] },
    { speciesId: "annihilape", score: 90.4, moves: { fastMoves: [{ moveId: "COUNTER", uses: 2400 }], chargedMoves: [{ moveId: "RAGE_FIST", uses: 2300 }, { moveId: "ICE_PUNCH", uses: 1400 }] }, moveset: ["COUNTER", "RAGE_FIST", "ICE_PUNCH"] },
    { speciesId: "sandslash_alolan", score: 89.9, moves: { fastMoves: [{ moveId: "POWDER_SNOW", uses: 2200 }], chargedMoves: [{ moveId: "ICE_PUNCH", uses: 2100 }, { moveId: "DRILL_RUN", uses: 1800 }] }, moveset: ["POWDER_SNOW", "ICE_PUNCH", "DRILL_RUN"] },
    { speciesId: "primeape", score: 89.3, moves: { fastMoves: [{ moveId: "KARATE_CHOP", uses: 2200 }], chargedMoves: [{ moveId: "RAGE_FIST", uses: 2100 }, { moveId: "CLOSE_COMBAT", uses: 1800 }] }, moveset: ["KARATE_CHOP", "RAGE_FIST", "CLOSE_COMBAT"] }
  ],
  "ULTRA LEAGUE": [
    { speciesId: "zygarde_complete", score: 94.6, moves: { fastMoves: [{ moveId: "DRAGON_TAIL", uses: 2300 }], chargedMoves: [{ moveId: "CRUNCH", uses: 2100 }, { moveId: "EARTHQUAKE", uses: 1800 }] }, moveset: ["DRAGON_TAIL", "CRUNCH", "EARTHQUAKE"] },
    { speciesId: "feraligatr", score: 93.8, moves: { fastMoves: [{ moveId: "SHADOW_CLAW", uses: 2400 }], chargedMoves: [{ moveId: "HYDRO_CANNON", uses: 2500 }, { moveId: "ICE_BEAM", uses: 1300 }] }, moveset: ["SHADOW_CLAW", "HYDRO_CANNON", "ICE_BEAM"] },
    { speciesId: "giratina_altered", score: 93.1, moves: { fastMoves: [{ moveId: "SHADOW_CLAW", uses: 2300 }], chargedMoves: [{ moveId: "DRAGON_CLAW", uses: 2400 }, { moveId: "ANCIENT_POWER", uses: 1100 }] }, moveset: ["SHADOW_CLAW", "DRAGON_CLAW", "ANCIENT_POWER"] },
    { speciesId: "cresselia", score: 92.4, moves: { fastMoves: [{ moveId: "PSYCHO_CUT", uses: 2200 }], chargedMoves: [{ moveId: "GRASS_KNOT", uses: 2000 }, { moveId: "MOONBLAST", uses: 1800 }] }, moveset: ["PSYCHO_CUT", "GRASS_KNOT", "MOONBLAST"] },
    { speciesId: "registeel", score: 91.9, moves: { fastMoves: [{ moveId: "LOCK_ON", uses: 2500 }], chargedMoves: [{ moveId: "FOCUS_BLAST", uses: 2100 }, { moveId: "ZAP_CANNON", uses: 1800 }] }, moveset: ["LOCK_ON", "FOCUS_BLAST", "ZAP_CANNON"] },
    { speciesId: "cobalion", score: 91.2, moves: { fastMoves: [{ moveId: "DOUBLE_KICK", uses: 2200 }], chargedMoves: [{ moveId: "SACRED_SWORD", uses: 2300 }, { moveId: "STONE_EDGE", uses: 1400 }] }, moveset: ["DOUBLE_KICK", "SACRED_SWORD", "STONE_EDGE"] },
    { speciesId: "corviknight", score: 90.8, moves: { fastMoves: [{ moveId: "SAND_ATTACK", uses: 2000 }], chargedMoves: [{ moveId: "AIR_CUTTER", uses: 1800 }, { moveId: "IRON_HEAD", uses: 1700 }] }, moveset: ["SAND_ATTACK", "AIR_CUTTER", "IRON_HEAD"] },
    { speciesId: "lickilicky", score: 90.3, moves: { fastMoves: [{ moveId: "ROLLOUT", uses: 2100 }], chargedMoves: [{ moveId: "BODY_SLAM", uses: 2200 }, { moveId: "SHADOW_BALL", uses: 1700 }] }, moveset: ["ROLLOUT", "BODY_SLAM", "SHADOW_BALL"] },
    { speciesId: "annihilape", score: 89.8, moves: { fastMoves: [{ moveId: "COUNTER", uses: 2400 }], chargedMoves: [{ moveId: "RAGE_FIST", uses: 2300 }, { moveId: "ICE_PUNCH", uses: 1400 }] }, moveset: ["COUNTER", "RAGE_FIST", "ICE_PUNCH"] },
    { speciesId: "talonflame", score: 89.1, moves: { fastMoves: [{ moveId: "INCINERATE", uses: 2300 }], chargedMoves: [{ moveId: "FLY", uses: 2200 }, { moveId: "FLAME_CHARGE", uses: 1600 }] }, moveset: ["INCINERATE", "FLY", "FLAME_CHARGE"] }
  ],
  "MASTER LEAGUE": [
    { speciesId: "palkia_origin", score: 95.8, moves: { fastMoves: [{ moveId: "DRAGON_BREATH", uses: 2500 }], chargedMoves: [{ moveId: "SPACIAL_REND", uses: 2400 }, { moveId: "AQUA_TAIL", uses: 2200 }] }, moveset: ["DRAGON_BREATH", "SPACIAL_REND", "AQUA_TAIL"] },
    { speciesId: "zacian_crowned", score: 94.9, moves: { fastMoves: [{ moveId: "METAL_CLAW", uses: 2300 }], chargedMoves: [{ moveId: "BEHEMOTH_BLADE", uses: 2300 }, { moveId: "CLOSE_COMBAT", uses: 1900 }] }, moveset: ["METAL_CLAW", "BEHEMOTH_BLADE", "CLOSE_COMBAT"] },
    { speciesId: "dialga_origin", score: 94.2, moves: { fastMoves: [{ moveId: "DRAGON_BREATH", uses: 2500 }], chargedMoves: [{ moveId: "ROAR_OF_TIME", uses: 2400 }, { moveId: "IRON_HEAD", uses: 2100 }] }, moveset: ["DRAGON_BREATH", "ROAR_OF_TIME", "IRON_HEAD"] },
    { speciesId: "necrozma_dusk_mane", score: 93.5, moves: { fastMoves: [{ moveId: "SHADOW_CLAW", uses: 2400 }], chargedMoves: [{ moveId: "SUNSTEEL_STRIKE", uses: 2300 }, { moveId: "DARK_PULSE", uses: 1800 }] }, moveset: ["SHADOW_CLAW", "SUNSTEEL_STRIKE", "DARK_PULSE"] },
    { speciesId: "landorus_therian", score: 92.8, moves: { fastMoves: [{ moveId: "MUD_SHOT", uses: 2300 }], chargedMoves: [{ moveId: "SANDSEAR_STORM", uses: 2200 }, { moveId: "STONE_EDGE", uses: 1700 }] }, moveset: ["MUD_SHOT", "SANDSEAR_STORM", "STONE_EDGE"] },
    { speciesId: "necrozma_dawn_wings", score: 92.1, moves: { fastMoves: [{ moveId: "SHADOW_CLAW", uses: 2400 }], chargedMoves: [{ moveId: "MOONGEIST_BEAM", uses: 2300 }, { moveId: "DARK_PULSE", uses: 1800 }] }, moveset: ["SHADOW_CLAW", "MOONGEIST_BEAM", "DARK_PULSE"] },
    { speciesId: "ho_oh", score: 91.4, moves: { fastMoves: [{ moveId: "INCINERATE", uses: 2400 }], chargedMoves: [{ moveId: "SACRED_FIRE", uses: 2300 }, { moveId: "BRAVE_BIRD", uses: 1700 }] }, moveset: ["INCINERATE", "SACRED_FIRE", "BRAVE_BIRD"] },
    { speciesId: "yveltal", score: 90.9, moves: { fastMoves: [{ moveId: "SNARL", uses: 2200 }], chargedMoves: [{ moveId: "DARK_PULSE", uses: 2200 }, { moveId: "OBLIVION_WING", uses: 1800 }] }, moveset: ["SNARL", "DARK_PULSE", "OBLIVION_WING"] },
    { speciesId: "giratina_origin", score: 90.2, moves: { fastMoves: [{ moveId: "SHADOW_CLAW", uses: 2300 }], chargedMoves: [{ moveId: "SHADOW_BALL", uses: 2300 }, { moveId: "OMINOUS_WIND", uses: 1400 }] }, moveset: ["SHADOW_CLAW", "SHADOW_BALL", "OMINOUS_WIND"] },
    { speciesId: "kyurem_black", score: 89.7, moves: { fastMoves: [{ moveId: "SHADOW_CLAW", uses: 2200 }], chargedMoves: [{ moveId: "FREEZE_SHOCK", uses: 2200 }, { moveId: "FUSION_BOLT", uses: 1900 }] }, moveset: ["SHADOW_CLAW", "FREEZE_SHOCK", "FUSION_BOLT"] }
  ],
  "MEGA MASTER LEAGUE": [
    { speciesId: "rayquaza_mega", score: 98.4, moves: { fastMoves: [{ moveId: "DRAGON_TAIL", uses: 2500 }], chargedMoves: [{ moveId: "BREAKING_SWIPE", uses: 2400 }, { moveId: "DRAGON_ASCENT", uses: 2300 }] }, moveset: ["DRAGON_TAIL", "BREAKING_SWIPE", "DRAGON_ASCENT"] },
    { speciesId: "groudon_primal", score: 96.8, moves: { fastMoves: [{ moveId: "MUD_SHOT", uses: 2400 }], chargedMoves: [{ moveId: "PRECIPICE_BLADES", uses: 2400 }, { moveId: "FIRE_PUNCH", uses: 2100 }] }, moveset: ["MUD_SHOT", "PRECIPICE_BLADES", "FIRE_PUNCH"] },
    { speciesId: "kyogre_primal", score: 95.2, moves: { fastMoves: [{ moveId: "WATERFALL", uses: 2300 }], chargedMoves: [{ moveId: "ORIGIN_PULSE", uses: 2300 }, { moveId: "SURF", uses: 2100 }] }, moveset: ["WATERFALL", "ORIGIN_PULSE", "SURF"] },
    { speciesId: "gyarados_mega", score: 93.7, moves: { fastMoves: [{ moveId: "DRAGON_BREATH", uses: 2200 }], chargedMoves: [{ moveId: "AQUA_TAIL", uses: 2200 }, { moveId: "CRUNCH", uses: 1900 }] }, moveset: ["DRAGON_BREATH", "AQUA_TAIL", "CRUNCH"] },
    { speciesId: "garchomp_mega", score: 92.5, moves: { fastMoves: [{ moveId: "MUD_SHOT", uses: 2200 }], chargedMoves: [{ moveId: "EARTH_POWER", uses: 2100 }, { moveId: "OUTRAGE", uses: 1900 }] }, moveset: ["MUD_SHOT", "EARTH_POWER", "OUTRAGE"] }
  ],
  "Battle Frontier (Spectral)": [
    { speciesId: "ninetales_alolan", score: 96.9, moves: { fastMoves: [{ moveId: "POWDER_SNOW", uses: 3249 }], chargedMoves: [{ moveId: "WEATHER_BALL_ICE", uses: 3150 }, { moveId: "PSYSHOCK", uses: 2950 }] }, moveset: ["POWDER_SNOW", "WEATHER_BALL_ICE", "PSYSHOCK"] },
    { speciesId: "weezing_galarian", score: 95.8, moves: { fastMoves: [{ moveId: "FAIRY_WIND", uses: 3200 }], chargedMoves: [{ moveId: "SLUDGE", uses: 2900 }, { moveId: "BRUTAL_SWING", uses: 2800 }] }, moveset: ["FAIRY_WIND", "SLUDGE", "BRUTAL_SWING"] },
    { speciesId: "dewgong", score: 95.4, moves: { fastMoves: [{ moveId: "ICE_SHARD", uses: 3150 }], chargedMoves: [{ moveId: "ICY_WIND", uses: 3100 }, { moveId: "DRILL_RUN", uses: 2900 }] }, moveset: ["ICE_SHARD", "ICY_WIND", "DRILL_RUN"] },
    { speciesId: "piloswine", score: 95.1, moves: { fastMoves: [{ moveId: "POWDER_SNOW", uses: 3100 }], chargedMoves: [{ moveId: "ICICLE_SPEAR", uses: 3000 }, { moveId: "STONE_EDGE", uses: 2700 }] }, moveset: ["POWDER_SNOW", "ICICLE_SPEAR", "STONE_EDGE"] },
    { speciesId: "ledian", score: 94.0, moves: { fastMoves: [{ moveId: "ROLLOUT", uses: 3000 }], chargedMoves: [{ moveId: "ACROBATICS", uses: 2850 }, { moveId: "DYNAMIC_PUNCH", uses: 2700 }] }, moveset: ["ROLLOUT", "ACROBATICS", "DYNAMIC_PUNCH"] },
    { speciesId: "arctibax", score: 93.7, moves: { fastMoves: [{ moveId: "DRAGON_BREATH", uses: 2950 }], chargedMoves: [{ moveId: "DRAGON_CLAW", uses: 2800 }, { moveId: "ICY_WIND", uses: 2700 }] }, moveset: ["DRAGON_BREATH", "DRAGON_CLAW", "ICY_WIND"] },
    { speciesId: "swalot", score: 93.5, moves: { fastMoves: [{ moveId: "MUD_SHOT", uses: 2900 }], chargedMoves: [{ moveId: "SLUDGE", uses: 2750 }, { moveId: "ICE_BEAM", uses: 2600 }] }, moveset: ["MUD_SHOT", "SLUDGE", "ICE_BEAM"] },
    { speciesId: "golisopod", score: 93.3, moves: { fastMoves: [{ moveId: "FURY_CUTTER", uses: 2850 }], chargedMoves: [{ moveId: "AQUA_JET", uses: 2700 }, { moveId: "X_SCISSOR", uses: 2550 }] }, moveset: ["FURY_CUTTER", "AQUA_JET", "X_SCISSOR"] },
    { speciesId: "arbok", score: 93.0, moves: { fastMoves: [{ moveId: "ACID", uses: 2800 }], chargedMoves: [{ moveId: "BRUTAL_SWING", uses: 2650 }, { moveId: "WRAP", uses: 2500 }] }, moveset: ["ACID", "BRUTAL_SWING", "WRAP"] },
    { speciesId: "glalie", score: 92.9, moves: { fastMoves: [{ moveId: "ROLLOUT", uses: 2750 }], chargedMoves: [{ moveId: "SHADOW_BALL", uses: 2600 }, { moveId: "AVALANCHE", uses: 2550 }] }, moveset: ["ROLLOUT", "SHADOW_BALL", "AVALANCHE"] },
    { speciesId: "runerigus", score: 92.6, moves: { fastMoves: [{ moveId: "SHADOW_CLAW", uses: 2700 }], chargedMoves: [{ moveId: "BRUTAL_SWING", uses: 2550 }, { moveId: "ROCK_TOMB", uses: 2500 }] }, moveset: ["SHADOW_CLAW", "BRUTAL_SWING", "ROCK_TOMB"] },
    { speciesId: "tentacruel", score: 92.2, moves: { fastMoves: [{ moveId: "ACID", uses: 2650 }], chargedMoves: [{ moveId: "SCALD", uses: 2500 }, { moveId: "PAYBACK", uses: 2400 }] }, moveset: ["ACID", "SCALD", "PAYBACK"] },
    { speciesId: "qwilfish", score: 92.0, moves: { fastMoves: [{ moveId: "POISON_STING", uses: 2600 }], chargedMoves: [{ moveId: "AQUA_TAIL", uses: 2500 }, { moveId: "SHADOW_BALL", uses: 2400 }] }, moveset: ["POISON_STING", "AQUA_TAIL", "SHADOW_BALL"] },
    { speciesId: "cofagrigus", score: 91.9, moves: { fastMoves: [{ moveId: "SHADOW_CLAW", uses: 2550 }], chargedMoves: [{ moveId: "SHADOW_BALL", uses: 2450 }, { moveId: "DARK_PULSE", uses: 2350 }] }, moveset: ["SHADOW_CLAW", "SHADOW_BALL", "DARK_PULSE"] },
    { speciesId: "skeledirge", score: 90.8, moves: { fastMoves: [{ moveId: "HEX", uses: 2500 }], chargedMoves: [{ moveId: "SHADOW_BALL", uses: 2400 }, { moveId: "TORCH_SONG", uses: 2350 }] }, moveset: ["HEX", "SHADOW_BALL", "TORCH_SONG"] }
  ],
  "Battle Frontier (Cauldron)": [
    { speciesId: "muk_alolan", score: 96.7, moves: { fastMoves: [{ moveId: "POISON_JAB", uses: 3250 }], chargedMoves: [{ moveId: "BRUTAL_SWING", uses: 3100 }, { moveId: "ICE_PUNCH", uses: 2950 }] }, moveset: ["POISON_JAB", "BRUTAL_SWING", "ICE_PUNCH"] },
    { speciesId: "talonflame", score: 96.3, moves: { fastMoves: [{ moveId: "INCINERATE", uses: 3200 }], chargedMoves: [{ moveId: "FLY", uses: 3050 }, { moveId: "BRAVE_BIRD", uses: 2900 }] }, moveset: ["INCINERATE", "FLY", "BRAVE_BIRD"] },
    { speciesId: "moltres_galarian", score: 95.6, moves: { fastMoves: [{ moveId: "SUCKER_PUNCH", uses: 3150 }], chargedMoves: [{ moveId: "FLY", uses: 3000 }, { moveId: "BRAVE_BIRD", uses: 2850 }] }, moveset: ["SUCKER_PUNCH", "FLY", "BRAVE_BIRD"] },
    { speciesId: "muk_alolan_shadow", score: 95.3, moves: { fastMoves: [{ moveId: "POISON_JAB", uses: 3100 }], chargedMoves: [{ moveId: "BRUTAL_SWING", uses: 2950 }, { moveId: "ICE_PUNCH", uses: 2800 }] }, moveset: ["POISON_JAB", "BRUTAL_SWING", "ICE_PUNCH"] },
    { speciesId: "greedent", score: 94.8, moves: { fastMoves: [{ moveId: "MUD_SHOT", uses: 3050 }], chargedMoves: [{ moveId: "BODY_SLAM", uses: 2900 }, { moveId: "TRAILBLAZE", uses: 2750 }] }, moveset: ["MUD_SHOT", "BODY_SLAM", "TRAILBLAZE"] },
    { speciesId: "dragalge", score: 94.5, moves: { fastMoves: [{ moveId: "ACID", uses: 3000 }], chargedMoves: [{ moveId: "AQUA_TAIL", uses: 2850 }, { moveId: "OUTRAGE", uses: 2700 }] }, moveset: ["ACID", "AQUA_TAIL", "OUTRAGE"] },
    { speciesId: "weezing_galarian", score: 94.0, moves: { fastMoves: [{ moveId: "FAIRY_WIND", uses: 2950 }], chargedMoves: [{ moveId: "OVERHEAT", uses: 2800 }, { moveId: "SLUDGE", uses: 2650 }] }, moveset: ["FAIRY_WIND", "OVERHEAT", "SLUDGE"] },
    { speciesId: "audino_mega", score: 93.5, moves: { fastMoves: [{ moveId: "CHARGE_BEAM", uses: 2900 }], chargedMoves: [{ moveId: "BODY_SLAM", uses: 2750 }, { moveId: "DISARMING_VOICE", uses: 2600 }] }, moveset: ["CHARGE_BEAM", "BODY_SLAM", "DISARMING_VOICE"] },
    { speciesId: "seaking", score: 93.5, moves: { fastMoves: [{ moveId: "PECK", uses: 2850 }], chargedMoves: [{ moveId: "DRILL_RUN", uses: 2700 }, { moveId: "ICY_WIND", uses: 2550 }] }, moveset: ["PECK", "DRILL_RUN", "ICY_WIND"] },
    { speciesId: "drapion_shadow", score: 93.4, moves: { fastMoves: [{ moveId: "POISON_STING", uses: 2800 }], chargedMoves: [{ moveId: "AQUA_TAIL", uses: 2650 }, { moveId: "CRUNCH", uses: 2500 }] }, moveset: ["POISON_STING", "AQUA_TAIL", "CRUNCH"] },
    { speciesId: "weezing_galarian_shadow", score: 93.4, moves: { fastMoves: [{ moveId: "FAIRY_WIND", uses: 2750 }], chargedMoves: [{ moveId: "OVERHEAT", uses: 2600 }, { moveId: "SLUDGE", uses: 2450 }] }, moveset: ["FAIRY_WIND", "OVERHEAT", "SLUDGE"] },
    { speciesId: "drapion", score: 93.3, moves: { fastMoves: [{ moveId: "POISON_STING", uses: 2700 }], chargedMoves: [{ moveId: "CRUNCH", uses: 2550 }, { moveId: "AQUA_TAIL", uses: 2400 }] }, moveset: ["POISON_STING", "CRUNCH", "AQUA_TAIL"] },
    { speciesId: "crobat_shadow", score: 93.2, moves: { fastMoves: [{ moveId: "GUST", uses: 2650 }], chargedMoves: [{ moveId: "POISON_FANG", uses: 2500 }, { moveId: "SHADOW_BALL", uses: 2350 }] }, moveset: ["GUST", "POISON_FANG", "SHADOW_BALL"] },
    { speciesId: "grafaiai", score: 93.0, moves: { fastMoves: [{ moveId: "SCRATCH", uses: 2600 }], chargedMoves: [{ moveId: "POISON_FANG", uses: 2450 }, { moveId: "FOUL_PLAY", uses: 2300 }] }, moveset: ["SCRATCH", "POISON_FANG", "FOUL_PLAY"] },
    { speciesId: "samurott", score: 92.9, moves: { fastMoves: [{ moveId: "FURY_CUTTER", uses: 2550 }], chargedMoves: [{ moveId: "HYDRO_CANNON", uses: 2400 }, { moveId: "MEGAHORN", uses: 2250 }] }, moveset: ["FURY_CUTTER", "HYDRO_CANNON", "MEGAHORN"] }
  ],
  "Battle Frontier (Master)": [
    { speciesId: "giratina_altered", score: 98.7, moves: { fastMoves: [{ moveId: "DRAGON_BREATH", uses: 3300 }], chargedMoves: [{ moveId: "DRAGON_CLAW", uses: 3150 }, { moveId: "SHADOW_FORCE", uses: 3000 }] }, moveset: ["DRAGON_BREATH", "DRAGON_CLAW", "SHADOW_FORCE"] },
    { speciesId: "zekrom", score: 97.4, moves: { fastMoves: [{ moveId: "DRAGON_BREATH", uses: 3250 }], chargedMoves: [{ moveId: "OUTRAGE", uses: 3100 }, { moveId: "FUSION_BOLT", uses: 2950 }] }, moveset: ["DRAGON_BREATH", "OUTRAGE", "FUSION_BOLT"] },
    { speciesId: "giratina_altered_shadow", score: 97.1, moves: { fastMoves: [{ moveId: "DRAGON_BREATH", uses: 3200 }], chargedMoves: [{ moveId: "SHADOW_FORCE", uses: 3050 }, { moveId: "DRAGON_CLAW", uses: 2900 }] }, moveset: ["DRAGON_BREATH", "SHADOW_FORCE", "DRAGON_CLAW"] },
    { speciesId: "dialga_origin", score: 96.5, moves: { fastMoves: [{ moveId: "DRAGON_BREATH", uses: 3150 }], chargedMoves: [{ moveId: "ROAR_OF_TIME", uses: 3000 }, { moveId: "IRON_HEAD", uses: 2850 }] }, moveset: ["DRAGON_BREATH", "ROAR_OF_TIME", "IRON_HEAD"] },
    { speciesId: "goodra", score: 96.3, moves: { fastMoves: [{ moveId: "DRAGON_BREATH", uses: 3100 }], chargedMoves: [{ moveId: "AQUA_TAIL", uses: 2950 }, { moveId: "DRACO_METEOR", uses: 2800 }] }, moveset: ["DRAGON_BREATH", "AQUA_TAIL", "DRACO_METEOR"] },
    { speciesId: "garchomp", score: 95.9, moves: { fastMoves: [{ moveId: "DRAGON_TAIL", uses: 3050 }], chargedMoves: [{ moveId: "TWISTER", uses: 2900 }, { moveId: "EARTH_POWER", uses: 2750 }] }, moveset: ["DRAGON_TAIL", "TWISTER", "EARTH_POWER"] },
    { speciesId: "melmetal", score: 95.5, moves: { fastMoves: [{ moveId: "THUNDER_SHOCK", uses: 3000 }], chargedMoves: [{ moveId: "DOUBLE_IRON_BASH", uses: 2850 }, { moveId: "DYNAMIC_PUNCH", uses: 2700 }] }, moveset: ["THUNDER_SHOCK", "DOUBLE_IRON_BASH", "DYNAMIC_PUNCH"] },
    { speciesId: "zekrom_shadow", score: 95.3, moves: { fastMoves: [{ moveId: "DRAGON_BREATH", uses: 2950 }], chargedMoves: [{ moveId: "OUTRAGE", uses: 2800 }, { moveId: "FUSION_BOLT", uses: 2650 }] }, moveset: ["DRAGON_BREATH", "OUTRAGE", "FUSION_BOLT"] },
    { speciesId: "garchomp_shadow", score: 95.0, moves: { fastMoves: [{ moveId: "DRAGON_TAIL", uses: 2900 }], chargedMoves: [{ moveId: "TWISTER", uses: 2750 }, { moveId: "EARTH_POWER", uses: 2600 }] }, moveset: ["DRAGON_TAIL", "TWISTER", "EARTH_POWER"] },
    { speciesId: "meloetta_aria", score: 94.6, moves: { fastMoves: [{ moveId: "CONFUSION", uses: 2850 }], chargedMoves: [{ moveId: "PSYSHOCK", uses: 2700 }, { moveId: "DAZZLING_GLEAM", uses: 2550 }] }, moveset: ["CONFUSION", "PSYSHOCK", "DAZZLING_GLEAM"] },
    { speciesId: "kyurem_black", score: 94.5, moves: { fastMoves: [{ moveId: "DRAGON_TAIL", uses: 2800 }], chargedMoves: [{ moveId: "FREEZE_SHOCK", uses: 2650 }, { moveId: "FUSION_BOLT", uses: 2500 }] }, moveset: ["DRAGON_TAIL", "FREEZE_SHOCK", "FUSION_BOLT"] },
    { speciesId: "solgaleo", score: 94.4, moves: { fastMoves: [{ moveId: "FIRE_SPIN", uses: 2750 }], chargedMoves: [{ moveId: "PSYCHIC_FANGS", uses: 2600 }, { moveId: "IRON_HEAD", uses: 2450 }] }, moveset: ["FIRE_SPIN", "PSYCHIC_FANGS", "IRON_HEAD"] },
    { speciesId: "latios", score: 94.2, moves: { fastMoves: [{ moveId: "DRAGON_BREATH", uses: 2700 }], chargedMoves: [{ moveId: "AURA_SPHERE", uses: 2550 }, { moveId: "LUSTER_PURGE", uses: 2400 }] }, moveset: ["DRAGON_BREATH", "AURA_SPHERE", "LUSTER_PURGE"] },
    { speciesId: "latios_shadow", score: 93.9, moves: { fastMoves: [{ moveId: "DRAGON_BREATH", uses: 2650 }], chargedMoves: [{ moveId: "AURA_SPHERE", uses: 2500 }, { moveId: "LUSTER_PURGE", uses: 2350 }] }, moveset: ["DRAGON_BREATH", "AURA_SPHERE", "LUSTER_PURGE"] },
    { speciesId: "dialga", score: 93.8, moves: { fastMoves: [{ moveId: "DRAGON_BREATH", uses: 2600 }], chargedMoves: [{ moveId: "IRON_HEAD", uses: 2450 }, { moveId: "DRACO_METEOR", uses: 2300 }] }, moveset: ["DRAGON_BREATH", "IRON_HEAD", "DRACO_METEOR"] }
  ]
};

export const LIVE_RANKINGS_MAP: Record<string, Map<string, PokemonRankingEntry>> = (() => {
  const base: Record<string, Map<string, PokemonRankingEntry>> = {
    "GREAT LEAGUE": new Map(),
    "ULTRA LEAGUE": new Map(),
    "MASTER LEAGUE": new Map(),
    "MEGA MASTER LEAGUE": new Map(),
    "Battle Frontier (Spectral)": new Map(),
    "Battle Frontier (Cauldron)": new Map(),
    "Battle Frontier (Master)": new Map()
  };
  try {
    if (typeof localStorage !== "undefined") {
      const raw = localStorage.getItem(LIMITED_META_RANKINGS_CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          for (const [lgKey, arr] of Object.entries(parsed)) {
            if (Array.isArray(arr) && arr.length > 0) {
              const map = new Map<string, PokemonRankingEntry>();
              for (const item of arr as PokemonRankingEntry[]) {
                if (item && typeof item.speciesId === "string") {
                  map.set(item.speciesId.toLowerCase(), item);
                }
              }
              base[lgKey] = map;
              base[lgKey.toUpperCase()] = map;
            }
          }
        }
      }
    }
  } catch {
    // ignore
  }
  return base;
})();

// Seed LIVE_RANKINGS_MAP immediately from initial rankings
(
  [
    "GREAT LEAGUE",
    "ULTRA LEAGUE",
    "MASTER LEAGUE",
    "MEGA MASTER LEAGUE",
    "Battle Frontier (Spectral)",
    "Battle Frontier (Cauldron)",
    "Battle Frontier (Master)"
  ] as const
).forEach((lg) => {
  LIVE_RANKINGS_LIST[lg].forEach((entry) => {
    LIVE_RANKINGS_MAP[lg].set(entry.speciesId.toLowerCase(), entry);
  });
  LIVE_RANKINGS_MAP[lg.toUpperCase()] = LIVE_RANKINGS_MAP[lg];
  (LIVE_RANKINGS_LIST as Record<string, PokemonRankingEntry[]>)[lg.toUpperCase()] = LIVE_RANKINGS_LIST[lg];
});
LIVE_RANKINGS_MAP["Mega Master League (10000)"] = LIVE_RANKINGS_MAP["MEGA MASTER LEAGUE"];
(LIVE_RANKINGS_LIST as Record<string, PokemonRankingEntry[]>)["Mega Master League (10000)"] = LIVE_RANKINGS_LIST["MEGA MASTER LEAGUE"];
LIVE_RANKINGS_MAP["Great League (1500)"] = LIVE_RANKINGS_MAP["GREAT LEAGUE"];
(LIVE_RANKINGS_LIST as Record<string, PokemonRankingEntry[]>)["Great League (1500)"] = LIVE_RANKINGS_LIST["GREAT LEAGUE"];
LIVE_RANKINGS_MAP["Ultra League (2500)"] = LIVE_RANKINGS_MAP["ULTRA LEAGUE"];
(LIVE_RANKINGS_LIST as Record<string, PokemonRankingEntry[]>)["Ultra League (2500)"] = LIVE_RANKINGS_LIST["ULTRA LEAGUE"];
LIVE_RANKINGS_MAP["Master League (10000)"] = LIVE_RANKINGS_MAP["MASTER LEAGUE"];
(LIVE_RANKINGS_LIST as Record<string, PokemonRankingEntry[]>)["Master League (10000)"] = LIVE_RANKINGS_LIST["MASTER LEAGUE"];

export const MOVE_ID_TO_NAME: Record<string, string> = {};

export const CANONICAL_MOVE_ID_MAP: Record<string, string> = {
  SUPER_POWER: "Superpower",
  LOCK_ON: "Lock-On",
  MUD_SLAP: "Mud-Slap",
  POWER_UP_PUNCH: "Power-Up Punch",
  X_SCISSOR: "X-Scissor",
  NATURES_MADNESS: "Nature's Madness",
  TORCH_SONG: "Torch Song",
  BRUTAL_SWING: "Brutal Swing",
  WATER_SHURIKEN: "Water Shuriken",
  PSYWAVE: "Psywave",
  DISARMING_VOICE: "Disarming Voice",
  HYDRO_CANNON: "Hydro Cannon",
  NIGHT_SLASH: "Night Slash",
  BODY_SLAM: "Body Slam",
  EARTHQUAKE: "Earthquake",
  SHADOW_BALL: "Shadow Ball",
  INCINERATE: "Incinerate",
  WEATHER_BALL_FIRE: "Weather Ball (Fire)",
  WEATHER_BALL_ICE: "Weather Ball (Ice)",
  WEATHER_BALL_WATER: "Weather Ball (Water)",
  WEATHER_BALL_ROCK: "Weather Ball (Rock)",
  WEATHER_BALL_NORMAL: "Weather Ball",
  CHILLING_WATER: "Chilling Water",
  FUTURE_SIGHT: "Future Sight",
  ROAR_OF_TIME: "Roar of Time",
  FREEZE_SHOCK: "Freeze Shock",
  ICE_BURN: "Ice Burn",
  FUSION_BOLT: "Fusion Bolt",
  FUSION_FLARE: "Fusion Flare",
  SPACIAL_REND: "Spacial Rend",
  ROCK_TOMB: "Rock Tomb",
  SAND_TOMB: "Sand Tomb",
  MIRROR_SHOT: "Mirror Shot",
  VOLT_SWITCH: "Volt Switch",
  FELL_STINGER: "Fell Stinger",
  FELL_STINGER_PLUS: "Fell Stinger+",
  VOLT_TACKLE: "Volt Tackle",
  VOLT_TACKLE_PLUS: "Volt Tackle+",
  ZAP_CANNON_PLUS: "Zap Cannon+",
  ACID_SPRAY_PLUS: "Acid Spray+",
  LIQUIDATION_PLUS: "Liquidation+",
  OUTRAGE_PLUS: "Outrage+",
  DYNAMIC_PUNCH_PLUS: "Dynamic Punch+",
  FUTURE_SIGHT_PLUS: "Future Sight+",
  DRILL_PECK_PLUS: "Drill Peck+",
  DARK_PULSE_PLUS: "Dark Pulse+",
  NIGHT_SHADE_PLUS: "Night Shade+",
  BRAVE_BIRD_PLUS: "Brave Bird+",
  OMINOUS_WIND_PLUS: "Ominous Wind+",
  SEED_BOMB_PLUS: "Seed Bomb+",
  MYSTICAL_FIRE_PLUS: "Mystical Fire+",
  SURF_PLUS: "Surf+",
  PSYBEAM: "Psybeam",
  PSYBEAM_PLUS: "Psybeam+",
  BRICK_BREAK_PLUS: "Brick Break+",
  HEAT_WAVE: "Heat Wave",
  DRAIN_PUNCH: "Drain Punch"
};

export const CHARGED_MOVE_FALLBACK_STATS: Record<string, { type: string; power: number; energyCost: number; code: string }> = {
  "weather ball (ice)": { type: "ice", power: 60, energyCost: 35, code: "WB-I" },
  "weather ball (fire)": { type: "fire", power: 60, energyCost: 35, code: "WB-F" },
  "weather ball (water)": { type: "water", power: 60, energyCost: 35, code: "WB-W" },
  "weather ball (rock)": { type: "rock", power: 60, energyCost: 35, code: "WB-R" },
  "chilling water": { type: "water", power: 60, energyCost: 45, code: "ChW" },
  "psyshock": { type: "psychic", power: 70, energyCost: 40, code: "PS" },
  "energy ball": { type: "grass", power: 80, energyCost: 45, code: "EB" },
  "dazzling gleam": { type: "fairy", power: 90, energyCost: 55, code: "DG" },
  "torch song": { type: "fire", power: 70, energyCost: 45, code: "TrS" },
  "shadow ball": { type: "ghost", power: 90, energyCost: 50, code: "SB" },
  "disarming voice": { type: "fairy", power: 70, energyCost: 45, code: "DV" },
  "body slam": { type: "normal", power: 65, energyCost: 40, code: "BS" },
  "earthquake": { type: "ground", power: 120, energyCost: 65, code: "Eq" },
  "superpower": { type: "fighting", power: 85, energyCost: 40, code: "SpP" },
  "hydro cannon": { type: "water", power: 80, energyCost: 40, code: "HC" },
  "brutal swing": { type: "dark", power: 55, energyCost: 35, code: "BrS" },
  "night slash": { type: "dark", power: 50, energyCost: 35, code: "NS" },
  "blast burn": { type: "fire", power: 110, energyCost: 50, code: "BB" },
  "overheat": { type: "fire", power: 130, energyCost: 55, code: "OH" },
  "outrage": { type: "dragon", power: 110, energyCost: 60, code: "OR" },
  "crunch": { type: "dark", power: 70, energyCost: 45, code: "Cr" },
  "ice beam": { type: "ice", power: 90, energyCost: 55, code: "IB" },
  "aerial ace": { type: "flying", power: 60, energyCost: 45, code: "AA" },
  "close combat": { type: "fighting", power: 100, energyCost: 45, code: "CC" },
  "rock slide": { type: "rock", power: 75, energyCost: 45, code: "RS" },
  "stone edge": { type: "rock", power: 100, energyCost: 55, code: "SE" },
  "foul play": { type: "dark", power: 65, energyCost: 40, code: "FP" },
  "dark pulse": { type: "dark", power: 80, energyCost: 45, code: "DP" },
  "moonblast": { type: "fairy", power: 90, energyCost: 50, code: "MB" },
  "play rough": { type: "fairy", power: 90, energyCost: 60, code: "PR" },
  "surf": { type: "water", power: 75, energyCost: 45, code: "Surf" },
  "scald": { type: "water", power: 85, energyCost: 50, code: "Sc" },
  "icy wind": { type: "ice", power: 60, energyCost: 45, code: "IW" },
  "rock tomb": { type: "rock", power: 75, energyCost: 50, code: "RT" },
  "sand tomb": { type: "ground", power: 55, energyCost: 45, code: "ST" },
  "mirror shot": { type: "steel", power: 35, energyCost: 35, code: "MS" },
  "ice punch": { type: "ice", power: 60, energyCost: 40, code: "IP" },
  "thunder punch": { type: "electric", power: 60, energyCost: 40, code: "TP" },
  "fire punch": { type: "fire", power: 60, energyCost: 40, code: "FP" },
  "rage fist": { type: "ghost", power: 55, energyCost: 40, code: "RF" },
  "dynamic punch": { type: "fighting", power: 90, energyCost: 45, code: "DP" },
  "cross chop": { type: "fighting", power: 55, energyCost: 35, code: "CC" },
  "focus blast": { type: "fighting", power: 150, energyCost: 75, code: "FB" },
  "sacred sword": { type: "fighting", power: 60, energyCost: 35, code: "SS" },
  "secret sword": { type: "fighting", power: 70, energyCost: 35, code: "ScS" },
  "power-up punch": { type: "fighting", power: 20, energyCost: 35, code: "PuP" },
  "drill run": { type: "ground", power: 70, energyCost: 40, code: "DR" },
  "earth power": { type: "ground", power: 90, energyCost: 50, code: "EP" },
  "scorching sands": { type: "ground", power: 80, energyCost: 50, code: "SS" },
  "high horsepower": { type: "ground", power: 100, energyCost: 55, code: "HH" },
  "mud bomb": { type: "ground", power: 65, energyCost: 45, code: "MB" },
  "bone club": { type: "ground", power: 55, energyCost: 35, code: "BC" },
  "bulldoze": { type: "ground", power: 80, energyCost: 55, code: "BD" },
  "sky attack": { type: "flying", power: 75, energyCost: 50, code: "SA" },
  "brave bird": { type: "flying", power: 130, energyCost: 55, code: "BB" },
  "fly": { type: "flying", power: 80, energyCost: 45, code: "Fly" },
  "drill peck": { type: "flying", power: 70, energyCost: 40, code: "DP" },
  "hurricane": { type: "flying", power: 110, energyCost: 60, code: "Hur" },
  "acrobatics": { type: "flying", power: 110, energyCost: 55, code: "Acr" },
  "air cutter": { type: "flying", power: 60, energyCost: 40, code: "AC" },
  "feather dance": { type: "flying", power: 35, energyCost: 50, code: "FD" },
  "avalanche": { type: "ice", power: 90, energyCost: 45, code: "Av" },
  "blizzard": { type: "ice", power: 140, energyCost: 75, code: "Blz" },
  "icicle spear": { type: "ice", power: 70, energyCost: 40, code: "IS" },
  "triple axel": { type: "ice", power: 60, energyCost: 45, code: "TA" },
  "frenzy plant": { type: "grass", power: 100, energyCost: 45, code: "FP" },
  "leaf blade": { type: "grass", power: 70, energyCost: 35, code: "LB" },
  "grass knot": { type: "grass", power: 90, energyCost: 50, code: "GK" },
  "power whip": { type: "grass", power: 90, energyCost: 50, code: "PW" },
  "seed bomb": { type: "grass", power: 55, energyCost: 40, code: "SB" },
  "trailblaze": { type: "grass", power: 65, energyCost: 45, code: "TB" },
  "solar beam": { type: "grass", power: 150, energyCost: 80, code: "SBm" },
  "sludge bomb": { type: "poison", power: 80, energyCost: 50, code: "SlB" },
  "sludge wave": { type: "poison", power: 110, energyCost: 65, code: "SWv" },
  "acid spray": { type: "poison", power: 20, energyCost: 45, code: "AS" },
  "poison fang": { type: "poison", power: 50, energyCost: 40, code: "PF" },
  "gunk shot": { type: "poison", power: 130, energyCost: 75, code: "GS" },
  "wild charge": { type: "electric", power: 100, energyCost: 45, code: "WC" },
  "thunderbolt": { type: "electric", power: 90, energyCost: 55, code: "TB" },
  "thunder": { type: "electric", power: 100, energyCost: 60, code: "Th" },
  "zap cannon": { type: "electric", power: 150, energyCost: 80, code: "ZC" },
  "discharge": { type: "electric", power: 55, energyCost: 40, code: "Dis" },
  "aura wheel": { type: "electric", power: 100, energyCost: 45, code: "AW" },
  "psychic": { type: "psychic", power: 75, energyCost: 55, code: "Psy" },
  "psychic fangs": { type: "psychic", power: 40, energyCost: 35, code: "PF" },
  "future sight": { type: "psychic", power: 110, energyCost: 65, code: "FS" },
  "psycho boost": { type: "psychic", power: 85, energyCost: 35, code: "PB" },
  "psystrike": { type: "psychic", power: 90, energyCost: 45, code: "PS" },
  "shadow bone": { type: "ghost", power: 80, energyCost: 45, code: "SBn" },
  "shadow punch": { type: "ghost", power: 55, energyCost: 35, code: "SP" },
  "shadow sneak": { type: "ghost", power: 75, energyCost: 50, code: "SS" },
  "ominous wind": { type: "ghost", power: 45, energyCost: 45, code: "OW" },
  "megahorn": { type: "bug", power: 110, energyCost: 55, code: "MH" },
  "lunge": { type: "bug", power: 70, energyCost: 45, code: "Lng" },
  "x-scissor": { type: "bug", power: 65, energyCost: 40, code: "XS" },
  "bug buzz": { type: "bug", power: 100, energyCost: 60, code: "BBz" },
  "power gem": { type: "rock", power: 85, energyCost: 50, code: "PG" },
  "ancient power": { type: "rock", power: 60, energyCost: 45, code: "AP" },
  "rock wrecker": { type: "rock", power: 110, energyCost: 50, code: "RW" },
  "meteor mash": { type: "steel", power: 100, energyCost: 45, code: "MM" },
  "iron head": { type: "steel", power: 85, energyCost: 50, code: "IH" },
  "flash cannon": { type: "steel", power: 110, energyCost: 65, code: "FC" },
  "heavy slam": { type: "steel", power: 70, energyCost: 50, code: "HS" },
  "dragon claw": { type: "dragon", power: 80, energyCost: 50, code: "DC" },
  "breaking swipe": { type: "dragon", power: 50, energyCost: 50, code: "BS" },
  "draco meteor": { type: "dragon", power: 150, energyCost: 65, code: "DM" },
  "aqua tail": { type: "water", power: 55, energyCost: 35, code: "AT" },
  "hydro pump": { type: "water", power: 130, energyCost: 75, code: "HP" },
  "liquidation": { type: "water", power: 70, energyCost: 45, code: "Liq" },
  "dive": { type: "water", power: 50, energyCost: 40, code: "Dv" },
  "gyro ball": { type: "steel", power: 80, energyCost: 50, code: "GB" },
  "gigaton hammer": { type: "steel", power: 130, energyCost: 60, code: "GH" },
  "fell stinger": { type: "bug", power: 20, energyCost: 35, code: "FS" },
  "fell stinger+": { type: "bug", power: 40, energyCost: 35, code: "FS+" },
  "volt tackle": { type: "electric", power: 90, energyCost: 45, code: "VT" },
  "volt tackle+": { type: "electric", power: 65, energyCost: 35, code: "VT+" },
  "zap cannon+": { type: "electric", power: 70, energyCost: 45, code: "ZC+" },
  "acid spray+": { type: "poison", power: 20, energyCost: 40, code: "AS+" },
  "liquidation+": { type: "water", power: 55, energyCost: 40, code: "Liq+" },
  "outrage+": { type: "dragon", power: 80, energyCost: 50, code: "OR+" },
  "dynamic punch+": { type: "fighting", power: 130, energyCost: 80, code: "DP+" },
  "future sight+": { type: "psychic", power: 130, energyCost: 80, code: "FS+" },
  "drill peck+": { type: "flying", power: 60, energyCost: 35, code: "DP+" },
  "dark pulse+": { type: "dark", power: 60, energyCost: 40, code: "DP+" },
  "night shade": { type: "ghost", power: 80, energyCost: 55, code: "NS" },
  "night shade+": { type: "ghost", power: 55, energyCost: 45, code: "NS+" },
  "brave bird+": { type: "flying", power: 70, energyCost: 40, code: "BB+" },
  "ominous wind+": { type: "ghost", power: 50, energyCost: 40, code: "OW+" },
  "seed bomb+": { type: "grass", power: 60, energyCost: 40, code: "SB+" },
  "mystical fire": { type: "fire", power: 60, energyCost: 45, code: "MF" },
  "mystical fire+": { type: "fire", power: 50, energyCost: 40, code: "MF+" },
  "surf+": { type: "water", power: 55, energyCost: 35, code: "Srf+" },
  "psybeam": { type: "psychic", power: 70, energyCost: 60, code: "Psb" },
  "psybeam+": { type: "psychic", power: 60, energyCost: 45, code: "Psb+" },
  "brick break": { type: "fighting", power: 40, energyCost: 40, code: "BBk" },
  "brick break+": { type: "fighting", power: 40, energyCost: 35, code: "BBk+" },
  "heat wave": { type: "fire", power: 95, energyCost: 75, code: "HW" },
  "drain punch": { type: "fighting", power: 20, energyCost: 40, code: "DrP" }
};

export const DYNAMIC_CHARGED_MOVE_MAP: Record<string, ChargedMove> = {};

export interface MoveBuffEffect {
  selfAtkDelta: number;
  selfDefDelta: number;
  oppAtkDelta: number;
  oppDefDelta: number;
  chance: number;
}

export interface ChargedCycleSimResult {
  effectivePressure: number;
  effectiveFreqMult: number;
  bestMovePct: number;
  fastestMovePct: number;
  fastestMoveEnergy: number;
}

export const BASELINE_MOVE_BUFF_EFFECTS: Record<string, MoveBuffEffect> = {
  // Guaranteed (100% chance) opponent debuff moves
  "bulldoze": { selfAtkDelta: 0, selfDefDelta: 0, oppAtkDelta: 0, oppDefDelta: -1, chance: 1.0 },
  "icy wind": { selfAtkDelta: 0, selfDefDelta: 0, oppAtkDelta: -1, oppDefDelta: 0, chance: 1.0 },
  "chilling water": { selfAtkDelta: 0, selfDefDelta: 0, oppAtkDelta: -1, oppDefDelta: 0, chance: 1.0 },
  "lunge": { selfAtkDelta: 0, selfDefDelta: 0, oppAtkDelta: -1, oppDefDelta: 0, chance: 1.0 },
  "feather dance": { selfAtkDelta: 0, selfDefDelta: 0, oppAtkDelta: -2, oppDefDelta: 0, chance: 1.0 },
  "rock tomb": { selfAtkDelta: 0, selfDefDelta: 0, oppAtkDelta: -1, oppDefDelta: 0, chance: 1.0 },
  "sand tomb": { selfAtkDelta: 0, selfDefDelta: 0, oppAtkDelta: 0, oppDefDelta: -1, chance: 1.0 },
  "poison fang": { selfAtkDelta: 0, selfDefDelta: 0, oppAtkDelta: 0, oppDefDelta: -1, chance: 1.0 },
  "psychic fangs": { selfAtkDelta: 0, selfDefDelta: 0, oppAtkDelta: 0, oppDefDelta: -1, chance: 1.0 },
  "acid spray": { selfAtkDelta: 0, selfDefDelta: 0, oppAtkDelta: 0, oppDefDelta: -2, chance: 1.0 },
  "acid spray+": { selfAtkDelta: 0, selfDefDelta: 0, oppAtkDelta: 0, oppDefDelta: -2, chance: 1.0 },
  "glaciate": { selfAtkDelta: 0, selfDefDelta: 0, oppAtkDelta: -1, oppDefDelta: 0, chance: 1.0 },
  "mystical fire": { selfAtkDelta: 0, selfDefDelta: 0, oppAtkDelta: -1, oppDefDelta: 0, chance: 1.0 },
  "mystical fire+": { selfAtkDelta: 0, selfDefDelta: 0, oppAtkDelta: -1, oppDefDelta: 0, chance: 1.0 },
  "brick break": { selfAtkDelta: 0, selfDefDelta: 0, oppAtkDelta: 0, oppDefDelta: -1, chance: 1.0 },
  "brick break+": { selfAtkDelta: 0, selfDefDelta: 0, oppAtkDelta: 0, oppDefDelta: -1, chance: 1.0 },
  "bubble beam": { selfAtkDelta: 0, selfDefDelta: 0, oppAtkDelta: -1, oppDefDelta: 0, chance: 1.0 },
  "memento": { selfAtkDelta: 0, selfDefDelta: 0, oppAtkDelta: -2, oppDefDelta: 0, chance: 1.0 },
  "obstruct": { selfAtkDelta: 0, selfDefDelta: 1, oppAtkDelta: 0, oppDefDelta: -1, chance: 1.0 },
  "zap cannon+": { selfAtkDelta: 0, selfDefDelta: 0, oppAtkDelta: -1, oppDefDelta: 0, chance: 1.0 },
  // Guaranteed (100% chance) self-buff moves
  "rage fist": { selfAtkDelta: 1, selfDefDelta: 0, oppAtkDelta: 0, oppDefDelta: 0, chance: 1.0 },
  "power-up punch": { selfAtkDelta: 1, selfDefDelta: 0, oppAtkDelta: 0, oppDefDelta: 0, chance: 1.0 },
  "flame charge": { selfAtkDelta: 1, selfDefDelta: 0, oppAtkDelta: 0, oppDefDelta: 0, chance: 1.0 },
  "trailblaze": { selfAtkDelta: 1, selfDefDelta: 0, oppAtkDelta: 0, oppDefDelta: 0, chance: 1.0 },
  "triple axel": { selfAtkDelta: 1, selfDefDelta: 0, oppAtkDelta: 0, oppDefDelta: 0, chance: 1.0 },
  "torch song": { selfAtkDelta: 1, selfDefDelta: 0, oppAtkDelta: 0, oppDefDelta: 0, chance: 1.0 },
  "aura wheel": { selfAtkDelta: 1, selfDefDelta: 0, oppAtkDelta: 0, oppDefDelta: 0, chance: 1.0 },
  "fell stinger": { selfAtkDelta: 1, selfDefDelta: 0, oppAtkDelta: 0, oppDefDelta: 0, chance: 1.0 },
  "fell stinger+": { selfAtkDelta: 1, selfDefDelta: 0, oppAtkDelta: 0, oppDefDelta: 0, chance: 1.0 },
  "drain punch": { selfAtkDelta: 0, selfDefDelta: 1, oppAtkDelta: 0, oppDefDelta: 0, chance: 1.0 },
  "parabolic charge": { selfAtkDelta: 0, selfDefDelta: 1, oppAtkDelta: 0, oppDefDelta: 0, chance: 1.0 },
  "skull bash": { selfAtkDelta: 0, selfDefDelta: 1, oppAtkDelta: 0, oppDefDelta: 0, chance: 1.0 },
  "defense curl": { selfAtkDelta: 0, selfDefDelta: 1, oppAtkDelta: 0, oppDefDelta: 0, chance: 1.0 },
  "iron defense": { selfAtkDelta: 0, selfDefDelta: 2, oppAtkDelta: 0, oppDefDelta: 0, chance: 1.0 },
  "acid armor": { selfAtkDelta: 0, selfDefDelta: 2, oppAtkDelta: 0, oppDefDelta: 0, chance: 1.0 },
  "geomancy": { selfAtkDelta: 2, selfDefDelta: 2, oppAtkDelta: 0, oppDefDelta: 0, chance: 1.0 },
  // Guaranteed (100% chance) self-debuff moves
  "close combat": { selfAtkDelta: 0, selfDefDelta: -2, oppAtkDelta: 0, oppDefDelta: 0, chance: 1.0 },
  "wild charge": { selfAtkDelta: 0, selfDefDelta: -2, oppAtkDelta: 0, oppDefDelta: 0, chance: 1.0 },
  "brave bird": { selfAtkDelta: 0, selfDefDelta: -3, oppAtkDelta: 0, oppDefDelta: 0, chance: 1.0 },
  "brave bird+": { selfAtkDelta: 0, selfDefDelta: -3, oppAtkDelta: 0, oppDefDelta: 0, chance: 1.0 },
  "superpower": { selfAtkDelta: -1, selfDefDelta: -1, oppAtkDelta: 0, oppDefDelta: 0, chance: 1.0 },
  "overheat": { selfAtkDelta: -2, selfDefDelta: 0, oppAtkDelta: 0, oppDefDelta: 0, chance: 1.0 },
  "draco meteor": { selfAtkDelta: -2, selfDefDelta: 0, oppAtkDelta: 0, oppDefDelta: 0, chance: 1.0 },
  "psycho boost": { selfAtkDelta: -2, selfDefDelta: 0, oppAtkDelta: 0, oppDefDelta: 0, chance: 1.0 },
  "leaf storm": { selfAtkDelta: -2, selfDefDelta: 0, oppAtkDelta: 0, oppDefDelta: 0, chance: 1.0 },
  "v-create": { selfAtkDelta: 0, selfDefDelta: -3, oppAtkDelta: 0, oppDefDelta: 0, chance: 1.0 },
  "dragon ascent": { selfAtkDelta: -1, selfDefDelta: -1, oppAtkDelta: 0, oppDefDelta: 0, chance: 1.0 },
  "clanging scales": { selfAtkDelta: 0, selfDefDelta: -1, oppAtkDelta: 0, oppDefDelta: 0, chance: 1.0 },
  "volt tackle": { selfAtkDelta: 0, selfDefDelta: -1, oppAtkDelta: 0, oppDefDelta: 0, chance: 1.0 },
  "volt tackle+": { selfAtkDelta: 0, selfDefDelta: -1, oppAtkDelta: 0, oppDefDelta: 0, chance: 1.0 },
  // Probabilistic (chance < 1.0) moves — confirmed in-battle via Spatial ML Kit OCR
  "breaking swipe": { selfAtkDelta: 0, selfDefDelta: 0, oppAtkDelta: -1, oppDefDelta: 0, chance: 0.5 },
  "crunch": { selfAtkDelta: 0, selfDefDelta: 0, oppAtkDelta: 0, oppDefDelta: -1, chance: 0.3 },
  "liquidation": { selfAtkDelta: 0, selfDefDelta: 0, oppAtkDelta: 0, oppDefDelta: -1, chance: 0.3 },
  "liquidation+": { selfAtkDelta: 0, selfDefDelta: 0, oppAtkDelta: 0, oppDefDelta: -1, chance: 0.3 },
  "shadow ball": { selfAtkDelta: 0, selfDefDelta: 0, oppAtkDelta: 0, oppDefDelta: -1, chance: 0.1 },
  "shadow bone": { selfAtkDelta: 0, selfDefDelta: 0, oppAtkDelta: 0, oppDefDelta: -1, chance: 0.2 },
  "earth power": { selfAtkDelta: 0, selfDefDelta: 0, oppAtkDelta: 0, oppDefDelta: -1, chance: 0.1 },
  "bug buzz": { selfAtkDelta: 0, selfDefDelta: 0, oppAtkDelta: 0, oppDefDelta: -1, chance: 0.3 },
  "psychic": { selfAtkDelta: 0, selfDefDelta: 0, oppAtkDelta: 0, oppDefDelta: -1, chance: 0.1 },
  "scald": { selfAtkDelta: 0, selfDefDelta: 0, oppAtkDelta: -1, oppDefDelta: 0, chance: 0.5 },
  "scorching sands": { selfAtkDelta: 0, selfDefDelta: 0, oppAtkDelta: -1, oppDefDelta: 0, chance: 0.3 },
  "moonblast": { selfAtkDelta: 0, selfDefDelta: 0, oppAtkDelta: -1, oppDefDelta: 0, chance: 0.1 },
  "mirror shot": { selfAtkDelta: 0, selfDefDelta: 0, oppAtkDelta: -1, oppDefDelta: 0, chance: 0.3 },
  "zap cannon": { selfAtkDelta: 0, selfDefDelta: 0, oppAtkDelta: -1, oppDefDelta: 0, chance: 0.66 },
  "night slash": { selfAtkDelta: 2, selfDefDelta: 0, oppAtkDelta: 0, oppDefDelta: 0, chance: 0.125 },
  "air cutter": { selfAtkDelta: 1, selfDefDelta: 0, oppAtkDelta: 0, oppDefDelta: 0, chance: 0.3 },
  "ancient power": { selfAtkDelta: 1, selfDefDelta: 1, oppAtkDelta: 0, oppDefDelta: 0, chance: 0.1 },
  "ominous wind": { selfAtkDelta: 1, selfDefDelta: 1, oppAtkDelta: 0, oppDefDelta: 0, chance: 0.1 },
  "ominous wind+": { selfAtkDelta: 1, selfDefDelta: 1, oppAtkDelta: 0, oppDefDelta: 0, chance: 0.1 },
  "silver wind": { selfAtkDelta: 1, selfDefDelta: 1, oppAtkDelta: 0, oppDefDelta: 0, chance: 0.1 },
  "meteor mash": { selfAtkDelta: 1, selfDefDelta: 0, oppAtkDelta: 0, oppDefDelta: 0, chance: 0.2 },
  "sandsear storm": { selfAtkDelta: 0, selfDefDelta: 0, oppAtkDelta: -1, oppDefDelta: 0, chance: 0.2 },
  "bleakwind storm": { selfAtkDelta: 0, selfDefDelta: 0, oppAtkDelta: -1, oppDefDelta: 0, chance: 0.2 },
  "wildbolt storm": { selfAtkDelta: 0, selfDefDelta: 0, oppAtkDelta: -1, oppDefDelta: 0, chance: 0.2 },
  "muddy water": { selfAtkDelta: 0, selfDefDelta: 0, oppAtkDelta: -1, oppDefDelta: 0, chance: 0.3 },
  "octazooka": { selfAtkDelta: 0, selfDefDelta: 0, oppAtkDelta: -2, oppDefDelta: 0, chance: 0.5 },
  "leaf tornado": { selfAtkDelta: 0, selfDefDelta: 0, oppAtkDelta: -2, oppDefDelta: 0, chance: 0.5 },
  "seed flare": { selfAtkDelta: 0, selfDefDelta: 0, oppAtkDelta: 0, oppDefDelta: -2, chance: 0.4 },
  "spirit shackle": { selfAtkDelta: 0, selfDefDelta: 0, oppAtkDelta: 0, oppDefDelta: -1, chance: 0.33 },
  "razor shell": { selfAtkDelta: 0, selfDefDelta: 0, oppAtkDelta: 0, oppDefDelta: -1, chance: 0.5 },
  "crush claw": { selfAtkDelta: 0, selfDefDelta: 0, oppAtkDelta: 0, oppDefDelta: -1, chance: 0.5 },
  "aurora beam": { selfAtkDelta: 0, selfDefDelta: 0, oppAtkDelta: -1, oppDefDelta: 0, chance: 0.3 },
  "signal beam": { selfAtkDelta: 0, selfDefDelta: 0, oppAtkDelta: -1, oppDefDelta: -1, chance: 0.2 },
  "flash cannon": { selfAtkDelta: 0, selfDefDelta: 0, oppAtkDelta: 0, oppDefDelta: -1, chance: 0.1 },
  "focus blast": { selfAtkDelta: 0, selfDefDelta: 0, oppAtkDelta: 0, oppDefDelta: -1, chance: 0.1 },
  "energy ball": { selfAtkDelta: 0, selfDefDelta: 0, oppAtkDelta: 0, oppDefDelta: -1, chance: 0.1 },
  "luster purge": { selfAtkDelta: 0, selfDefDelta: 0, oppAtkDelta: 0, oppDefDelta: -1, chance: 0.5 },
  "mist ball": { selfAtkDelta: 0, selfDefDelta: 0, oppAtkDelta: -1, oppDefDelta: 0, chance: 0.5 },
  "play rough": { selfAtkDelta: 0, selfDefDelta: 0, oppAtkDelta: -1, oppDefDelta: 0, chance: 0.1 },
  "sacred fire": { selfAtkDelta: 0, selfDefDelta: 0, oppAtkDelta: -1, oppDefDelta: 0, chance: 0.5 },
  "sacred fire+": { selfAtkDelta: 0, selfDefDelta: 0, oppAtkDelta: -1, oppDefDelta: 0, chance: 0.5 },
  "sacred fire++": { selfAtkDelta: 0, selfDefDelta: 0, oppAtkDelta: -1, oppDefDelta: 0, chance: 0.5 }
};

export const DYNAMIC_MOVE_BUFF_TABLE: Record<string, MoveBuffEffect> = (() => {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      const raw = window.localStorage.getItem("gbl_pvpoke_gamemaster_buffs_v1");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          return parsed as Record<string, MoveBuffEffect>;
        }
      }
    }
  } catch {
    // Ignore storage read errors
  }
  return {};
})();

export const ZERO_MOVE_BUFF: MoveBuffEffect = {
  selfAtkDelta: 0,
  selfDefDelta: 0,
  oppAtkDelta: 0,
  oppDefDelta: 0,
  chance: 0
};

export function resolveMoveBuffEffect(moveName: string): MoveBuffEffect {
  const clean = (moveName || "").replace(/\*/g, "").trim().toLowerCase();
  if (!clean) return ZERO_MOVE_BUFF;
  const idKey = clean.replace(/[\s-]+/g, "_");
  return (
    DYNAMIC_MOVE_BUFF_TABLE[clean] ||
    DYNAMIC_MOVE_BUFF_TABLE[idKey] ||
    BASELINE_MOVE_BUFF_EFFECTS[clean] ||
    ZERO_MOVE_BUFF
  );
}

export function isDominatedSameTypeChargedPair(
  c1Name: string,
  c2Name: string,
  myTypes: string[] = []
): boolean {
  const clean1 = (c1Name || "").replace(/\*/g, "").trim();
  const clean2 = (c2Name || "").replace(/\*/g, "").trim();
  if (!clean1 || !clean2 || clean1.toLowerCase() === clean2.toLowerCase()) {
    return false;
  }
  const defaultType = myTypes[0] || "normal";
  const s1 = buildChargedMoveFromName(clean1, defaultType, []);
  const s2 = buildChargedMoveFromName(clean2, defaultType, []);
  if ((s1.type || "").toLowerCase() !== (s2.type || "").toLowerCase()) {
    return false;
  }
  const b1 = resolveMoveBuffEffect(clean1);
  const b2 = resolveMoveBuffEffect(clean2);

  const hasPositiveBuff = (b: MoveBuffEffect): boolean =>
    b.chance >= 0.25 &&
    (b.selfAtkDelta > 0 || b.selfDefDelta > 0 || b.oppAtkDelta < 0 || b.oppDefDelta < 0);

  const hasSelfDebuff = (b: MoveBuffEffect): boolean =>
    b.chance >= 0.5 && (b.selfAtkDelta < 0 || b.selfDefDelta < 0);

  const e1 = Math.max(35, Math.min(80, s1.energyCost || 50));
  const e2 = Math.max(35, Math.min(80, s2.energyCost || 50));
  const p1 = s1.power || 50;
  const p2 = s2.power || 50;
  const dpe1 = p1 / e1;
  const dpe2 = p2 / e2;

  const s2DominatedByS1 =
    !hasPositiveBuff(b2) &&
    !hasSelfDebuff(b1) &&
    ((e2 >= e1 && p2 <= p1) || (e1 - e2 < 15 && dpe1 >= dpe2 * 1.15 && p1 >= p2));

  const s1DominatedByS2 =
    !hasPositiveBuff(b1) &&
    !hasSelfDebuff(b2) &&
    ((e1 >= e2 && p1 <= p2) || (e2 - e1 < 15 && dpe2 >= dpe1 * 1.15 && p2 >= p1));

  return s2DominatedByS1 || s1DominatedByS2;
}

export function simulateTurnByTurnChargedCycle(
  c1: ChargedMove,
  c1RawPct: number,
  c2: ChargedMove,
  c2RawPct: number,
  fastEpt: number,
  defShields: number,
  attackerTypes: string[],
  c3?: ChargedMove | null,
  c3RawPct: number = 0
): ChargedCycleSimResult {
  const e1 = Math.max(35, Math.min(80, c1.energyCost || 50));
  const e2 = Math.max(35, Math.min(80, c2.energyCost || 50));
  const b1 = resolveMoveBuffEffect(c1.name);
  const b2 = resolveMoveBuffEffect(c2.name);

  const atkStage1 = (b1.selfAtkDelta - b1.oppDefDelta) * b1.chance;
  const defStage1 = (b1.selfDefDelta - b1.oppAtkDelta) * b1.chance;
  const atkStage2 = (b2.selfAtkDelta - b2.oppDefDelta) * b2.chance;
  const defStage2 = (b2.selfDefDelta - b2.oppAtkDelta) * b2.chance;

  const effPace1 = Math.max(0.84, Math.min(1.22, Math.pow(50.0 / e1, 0.28)));
  const effPace2 = Math.max(0.84, Math.min(1.22, Math.pow(50.0 / e2, 0.28)));

  const unshieldedCycleVal1 =
    c1RawPct * effPace1 +
    Math.max(0, atkStage1) * 5.5 +
    Math.max(0, defStage1) * 5.0 -
    Math.max(0, -defStage1) * 3.5 -
    Math.max(0, -atkStage1) * 3.5;

  const unshieldedCycleVal2 =
    c2RawPct * effPace2 +
    Math.max(0, atkStage2) * 5.5 +
    Math.max(0, defStage2) * 5.0 -
    Math.max(0, -defStage2) * 3.5 -
    Math.max(0, -atkStage2) * 3.5;

  const use1AsPrimary = unshieldedCycleVal1 >= unshieldedCycleVal2;
  const bestPct = use1AsPrimary ? c1RawPct : c2RawPct;
  const bestEnergy = use1AsPrimary ? e1 : e2;
  const bestPace = use1AsPrimary ? effPace1 : effPace2;
  const bestAtkStage = use1AsPrimary ? atkStage1 : atkStage2;
  const bestDefStage = use1AsPrimary ? defStage1 : defStage2;

  const altPct = use1AsPrimary ? c2RawPct : c1RawPct;
  const altEnergy = use1AsPrimary ? e2 : e1;
  const altAtkStage = use1AsPrimary ? atkStage2 : atkStage1;
  const altDefStage = use1AsPrimary ? defStage2 : defStage1;

  const shieldSetupScore = (pct: number, energy: number, atkStg: number, defStg: number): number => {
    const energySavedBonus = (60.0 - energy) * 0.58;
    const buffBonus =
      Math.max(0, atkStg) * 11.5 +
      Math.max(0, defStg) * 10.5 -
      Math.max(0, -defStg) * 12.0 -
      Math.max(0, -atkStg) * 10.0;
    const credibilityMult = pct < 18 && atkStg <= 0 && defStg <= 0 ? 0.55 : 1.0;
    return energySavedBonus * credibilityMult + buffBonus + pct * 0.30;
  };

  const primaryShieldScore = shieldSetupScore(bestPct, bestEnergy, bestAtkStage, bestDefStage);
  const altIsValidShieldSetup =
    (altEnergy <= bestEnergy - 10 && altDefStage >= 0 && altAtkStage >= 0) ||
    (altEnergy <= bestEnergy + 5 && (altAtkStage > 0.2 || altDefStage > 0.2)) ||
    (bestDefStage < -0.5 && altDefStage >= 0 && altEnergy <= bestEnergy);

  const altShieldScore = altIsValidShieldSetup
    ? shieldSetupScore(altPct, altEnergy, altAtkStage, altDefStage)
    : -999;

  const useAltForShieldBurn = altShieldScore > primaryShieldScore;
  const burnPct = useAltForShieldBurn ? altPct : bestPct;
  const burnEnergy = useAltForShieldBurn ? altEnergy : bestEnergy;
  const burnAtkStage = useAltForShieldBurn ? altAtkStage : bestAtkStage;
  const burnDefStage = useAltForShieldBurn ? altDefStage : bestDefStage;

  const unshieldedBase = bestPct * bestPace;
  const energySavingsFromBait = useAltForShieldBurn ? Math.max(0, bestEnergy - burnEnergy) : 0;

  let cyclePressure: number;
  let activeCycleEnergy: number;

  if (defShields <= 0) {
    const setupFirstIn0S =
      useAltForShieldBurn &&
      (burnAtkStage >= 0.5 || burnDefStage >= 0.5) &&
      burnEnergy <= bestEnergy - 10 &&
      burnPct >= Math.floor(bestPct * 0.52);
    const buffFollowup = setupFirstIn0S
      ? burnAtkStage * 8.5 + burnDefStage * 7.5
      : Math.max(0, bestAtkStage) * 8.0 +
        Math.max(0, bestDefStage) * 7.5 -
        Math.max(0, -bestDefStage) * 4.5 -
        Math.max(0, -bestAtkStage) * 4.0;
    const finisherFlexBonus =
      altEnergy <= bestEnergy - 10 && altPct >= 26 ? (bestEnergy - altEnergy) * 0.20 : 0;
    cyclePressure = unshieldedBase * 1.70 + buffFollowup + finisherFlexBonus;
    activeCycleEnergy = setupFirstIn0S ? (burnEnergy + bestEnergy) * 0.5 : bestEnergy;
  } else if (defShields === 1) {
    const postShieldAtkMult = Math.max(0.76, Math.min(1.42, 1.0 + 0.16 * burnAtkStage));
    const shieldTempoBonus = energySavingsFromBait * 0.45 + (55.0 - burnEnergy) * 0.22;
    const postShieldStatValue =
      burnDefStage * 9.5 +
      Math.max(0, burnAtkStage) * 6.5 +
      Math.max(0, bestAtkStage) * 4.0 +
      Math.max(0, bestDefStage) * 3.5 -
      Math.max(0, -bestDefStage) * 3.5;
    cyclePressure = unshieldedBase * postShieldAtkMult * 1.24 + shieldTempoBonus + postShieldStatValue;
    activeCycleEnergy = burnEnergy * 0.55 + bestEnergy * 0.45;
  } else {
    const twoShieldAtkMult = Math.max(0.70, Math.min(1.58, 1.0 + 0.26 * burnAtkStage));
    const cycle3Reach = Math.max(0.68, Math.min(1.34, (fastEpt / 3.5) * (50.0 / burnEnergy)));
    const twoShieldTempoBonus = energySavingsFromBait * 0.60 + (55.0 - burnEnergy) * 0.34;
    const compoundedStatValue = burnDefStage * 13.5 + burnAtkStage * 9.5;
    cyclePressure =
      unshieldedBase * twoShieldAtkMult * 0.82 * cycle3Reach +
      twoShieldTempoBonus +
      compoundedStatValue;
    activeCycleEnergy = burnEnergy * 0.72 + bestEnergy * 0.28;
  }

  const candidates: Array<{
    name: string;
    pct: number;
    e: number;
    atkStg: number;
    defStg: number;
    pace: number;
  }> = [
    { name: c1.name, pct: c1RawPct, e: e1, atkStg: atkStage1, defStg: defStage1, pace: effPace1 },
    { name: c2.name, pct: c2RawPct, e: e2, atkStg: atkStage2, defStg: defStage2, pace: effPace2 }
  ];

  if (c3 && c3.name && c3RawPct > 0) {
    const e3 = Math.max(35, Math.min(80, c3.energyCost || 50));
    const b3 = resolveMoveBuffEffect(c3.name);
    const atkStage3 = (b3.selfAtkDelta - b3.oppDefDelta) * b3.chance;
    const defStage3 = (b3.selfDefDelta - b3.oppAtkDelta) * b3.chance;
    const effPace3 = Math.max(0.84, Math.min(1.22, Math.pow(50.0 / e3, 0.28)));
    if (!candidates.some((m) => m.name.toLowerCase() === c3.name.toLowerCase())) {
      candidates.push({
        name: c3.name,
        pct: c3RawPct,
        e: e3,
        atkStg: atkStage3,
        defStg: defStage3,
        pace: effPace3
      });
    }
  }

  // Flexible, role-agnostic multi-throw sequence evaluation:
  // Evaluates single throws, back-to-back spam (e.g. 35E -> 35E vs 75E nuke), and mixed sequences across 0S, 1S, 2S
  for (const mA of candidates) {
    if (defShields <= 0) {
      const singleVal =
        mA.pct * mA.pace * 1.70 +
        Math.max(0, mA.atkStg) * 8.0 +
        Math.max(0, mA.defStg) * 7.5 -
        Math.max(0, -mA.defStg) * 4.5 -
        Math.max(0, -mA.atkStg) * 4.0;
      if (singleVal > cyclePressure) {
        cyclePressure = singleVal;
        activeCycleEnergy = mA.e;
      }
      for (const mB of candidates) {
        const totalE = mA.e + mB.e;
        if (totalE > 110) continue;
        const postMult = Math.max(0.75, Math.min(1.50, 1.0 + 0.18 * mA.atkStg));
        const combinedPct = Math.min(135.0, mA.pct + mB.pct * postMult);
        const seqPace = Math.max(0.76, Math.min(1.26, Math.pow(65.0 / totalE, 0.34)));
        const spamTempoBonus = totalE <= 75 ? (80.0 - totalE) * 0.42 : 0.0;
        const netAtk = mA.atkStg + mB.atkStg * 0.6;
        const netDef = mA.defStg + mB.defStg * 0.6;
        const seqBuffVal =
          Math.max(0, netAtk) * 7.0 +
          Math.max(0, netDef) * 6.5 -
          Math.max(0, -netDef) * 4.5 -
          Math.max(0, -netAtk) * 3.5;
        const pairVal = combinedPct * seqPace * 1.44 + spamTempoBonus + seqBuffVal;
        if (pairVal > cyclePressure) {
          cyclePressure = pairVal;
          activeCycleEnergy = totalE * 0.52;
        }
      }
    } else if (defShields === 1) {
      for (const mB of candidates) {
        const postAtkMult = Math.max(0.76, Math.min(1.45, 1.0 + 0.18 * mA.atkStg));
        const eSaved = Math.max(0, mB.e - mA.e);
        const tempoBonus = eSaved * 0.46 + (55.0 - mA.e) * 0.24;
        const statVal =
          mA.defStg * 9.5 +
          Math.max(0, mA.atkStg) * 6.5 +
          Math.max(0, mB.atkStg) * 4.0 +
          Math.max(0, mB.defStg) * 3.5 -
          Math.max(0, -mB.defStg) * 3.5;
        const val1S = mB.pct * mB.pace * postAtkMult * 1.24 + tempoBonus + statVal;
        if (val1S > cyclePressure) {
          cyclePressure = val1S;
          activeCycleEnergy = mA.e * 0.55 + mB.e * 0.45;
        }
        // 3-throw spam sequence through 1 shield (e.g., 35E [shielded] -> 35E -> 35E)
        if (mA.e <= 40 && mB.e <= 40) {
          const postAtk2 = Math.max(0.76, Math.min(1.55, 1.0 + 0.18 * (mA.atkStg + mB.atkStg)));
          const landPct2 = Math.min(130.0, mB.pct * postAtkMult + mB.pct * postAtk2 * 0.72);
          const spamPace = Math.max(0.84, Math.min(1.22, Math.pow(45.0 / mB.e, 0.28)));
          const tripleSpamVal = landPct2 * spamPace * 1.12 + (55.0 - mA.e) * 0.30 + statVal;
          if (tripleSpamVal > cyclePressure) {
            cyclePressure = tripleSpamVal;
            activeCycleEnergy = (mA.e + mB.e) * 0.50;
          }
        }
      }
    } else {
      for (const mB of candidates) {
        const avgShieldE = (mA.e + mB.e) * 0.5;
        const combAtkStg = mA.atkStg + mB.atkStg * 0.85;
        const combDefStg = mA.defStg + mB.defStg * 0.85;
        const twoShieldAtkMult = Math.max(0.70, Math.min(1.62, 1.0 + 0.22 * combAtkStg));
        const cycle3Reach = Math.max(0.68, Math.min(1.36, (fastEpt / 3.5) * (50.0 / avgShieldE)));
        for (const mC of candidates) {
          const eSaved = Math.max(0, mC.e - avgShieldE);
          const tempoBonus = eSaved * 0.60 + (55.0 - avgShieldE) * 0.34;
          const statVal = combDefStg * 11.5 + combAtkStg * 8.5;
          const val2S = mC.pct * mC.pace * twoShieldAtkMult * 0.82 * cycle3Reach + tempoBonus + statVal;
          if (val2S > cyclePressure) {
            cyclePressure = val2S;
            activeCycleEnergy = avgShieldE * 0.72 + mC.e * 0.28;
          }
        }
      }
    }
  }

  if (candidates.length >= 3) {
    const distinctTypes = new Set(
      [c1.type, c2.type, c3?.type || ""].map((t) => t.toLowerCase()).filter(Boolean)
    ).size;
    cyclePressure += distinctTypes >= 3 ? 2.5 : 1.2;
  }

  const dominatedPenalty =
    candidates.length >= 3
      ? 0
      : isDominatedSameTypeChargedPair(c1.name, c2.name, attackerTypes)
      ? 6.5
      : 0;
  const clampedActiveEnergy = Math.max(35, Math.min(80, activeCycleEnergy));
  const pacingFactor = Math.max(0.78, Math.min(1.26, (fastEpt / 3.5) * (50.0 / clampedActiveEnergy)));
  const freqMult = 0.82 + 0.18 * pacingFactor;

  const fastestCand = candidates.reduce((best, cur) =>
    cur.e < best.e || (cur.e === best.e && cur.pct > best.pct) ? cur : best
  );
  const fastestEnergy = fastestCand.e;

  return {
    effectivePressure: Math.max(10, cyclePressure - dominatedPenalty),
    effectiveFreqMult: freqMult,
    bestMovePct: Math.max(...candidates.map((c) => c.pct)),
    fastestMovePct: fastestCand.pct,

    fastestMoveEnergy: fastestEnergy
  };
}

export const SPECIES_FAST_MOVES_POOL: Record<string, string[]> = {
  tinkaton: ["Fairy Wind", "Rock Smash"],
  mimikyu: ["Shadow Claw", "Hex"],
  swampert: ["Mud Shot", "Water Gun"],
  clodsire: ["Poison Sting", "Mud Shot"],
  feraligatr: ["Shadow Claw", "Waterfall", "Ice Fang", "Bite"],
  mandibuzz: ["Snarl", "Air Slash"],
  azumarill: ["Bubble", "Rock Smash"],
  annihilape: ["Counter", "Low Kick"],
  talonflame: ["Incinerate", "Fire Spin", "Peck"],
  dunsparce: ["Rollout", "Astonish", "Bite"],
  malamar: ["Psywave", "Psycho Cut", "Peck"],
  gastrodon: ["Mud-Slap", "Hidden Power"],
  lickilicky: ["Rollout", "Lick"],
  corviknight: ["Sand Attack", "Steel Wing", "Air Slash"],
  skeledirge: ["Incinerate", "Bite"],
  greninja: ["Water Shuriken", "Bubble", "Feint Attack"],
  morpeko: ["Thunder Shock", "Bite", "Charge Beam"],
  aegislash: ["Psycho Cut", "Air Slash"],
  cramorant: ["Peck", "Water Gun"],
  palkia: ["Dragon Breath", "Dragon Tail"],
  palkia_origin: ["Dragon Breath", "Dragon Tail"],
  zacian: ["Snarl", "Quick Attack", "Metal Claw", "Fire Fang"],
  zacian_crowned: ["Metal Claw", "Snarl", "Quick Attack"],
  dialga: ["Dragon Breath", "Metal Claw"],
  dialga_origin: ["Dragon Breath", "Metal Claw"],
  zygarde: ["Dragon Tail", "Bite", "Zen Headbutt"],
  zygarde_complete: ["Dragon Tail", "Bite", "Zen Headbutt"],
  giratina_altered: ["Shadow Claw", "Dragon Breath"],
  giratina_origin: ["Shadow Claw", "Dragon Tail"],
  kyogre: ["Waterfall"],
  groudon: ["Mud Shot", "Dragon Tail"],
  rhyperior: ["Mud-Slap", "Smack Down"],
  landorus_therian: ["Sand Attack", "Mud Shot", "Extrasensory"],
  ho_oh: ["Incinerate", "Hidden Power", "Steel Wing"],
  necrozma_dusk_mane: ["Shadow Claw", "Psycho Cut", "Metal Claw"],
  necrozma_dawn_wings: ["Shadow Claw", "Psycho Cut", "Metal Claw"],
  kyurem_black: ["Dragon Tail", "Shadow Claw"],
  kyurem_white: ["Dragon Breath", "Ice Fang", "Steel Wing"],
  xerneas: ["Geomancy", "Tackle"],
  yveltal: ["Sucker Punch", "Snarl", "Gust"],
  solgaleo: ["Fire Spin", "Zen Headbutt"],
  florges: ["Fairy Wind", "Vine Whip", "Tackle"],
  primarina: ["Charm", "Waterfall"],
  cresselia: ["Psycho Cut", "Confusion"],
  registeel: ["Lock-On", "Metal Claw", "Rock Smash"],
  bastiodon: ["Smack Down", "Iron Tail"],
  medicham: ["Counter", "Psycho Cut"],
  lanturn: ["Spark", "Water Gun"],
  skarmory: ["Steel Wing", "Air Slash"],
  whiscash: ["Mud Shot", "Water Gun"],
  poliwrath: ["Counter", "Mud Shot", "Bubble"],
  gligar: ["Wing Attack", "Fury Cutter"],
  serperior: ["Vine Whip", "Iron Tail"],
  wigglytuff: ["Charm", "Feint Attack", "Pound"],
  clefable: ["Fairy Wind", "Charm", "Meteor Mash"],
  umbreon: ["Snarl", "Feint Attack"],
  venusaur: ["Vine Whip", "Razor Leaf"],
  charizard: ["Wing Attack", "Fire Spin", "Dragon Breath"],
  blastoise: ["Rollout", "Water Gun", "Bite"],
  machamp: ["Counter", "Karate Chop", "Bullet Punch"],
  dragonite: ["Dragon Breath", "Dragon Tail", "Steel Wing"],
  metagross: ["Bullet Punch", "Zen Headbutt"],
  mewtwo: ["Psycho Cut", "Confusion"],
  garchomp: ["Mud Shot", "Dragon Tail"],
  togekiss: ["Charm", "Air Slash"],
  excadrill: ["Mud Shot", "Mud-Slap", "Metal Claw"],
  gyarados: ["Dragon Breath", "Waterfall", "Bite"],
  melmetal: ["Thunder Shock"],
  lugia: ["Dragon Tail", "Extrasensory"],
  rayquaza: ["Dragon Tail", "Air Slash"],
  marowak_alolan: ["Fire Spin", "Hex", "Rock Smash"],
  ninetales_alolan: ["Charm", "Powder Snow"],
  sandslash_alolan: ["Shadow Claw", "Powder Snow"],
  weezing_galarian: ["Fairy Wind", "Tackle"],
  stunfisk_galarian: ["Mud Shot", "Metal Claw"]
};

export const SPECIES_CHARGED_MOVES_POOL: Record<string, string[]> = {
  tinkaton: ["Gigaton Hammer", "Play Rough", "Heavy Slam", "Bulldoze", "Flash Cannon"],
  mimikyu: ["Play Rough", "Shadow Sneak", "Thunder"],
  swampert: ["Hydro Cannon", "Earthquake", "Sludge Wave", "Surf", "Muddy Water"],
  clodsire: ["Earthquake", "Stone Edge", "Sludge Bomb", "Megahorn", "Acid Spray"],
  feraligatr: ["Hydro Cannon", "Ice Beam", "Crunch", "Hydro Pump", "Water Pulse"],
  mandibuzz: ["Dark Pulse", "Aerial Ace", "Foul Play", "Shadow Ball"],
  azumarill: ["Play Rough", "Ice Beam", "Hydro Pump"],
  annihilape: ["Rage Fist", "Close Combat", "Ice Punch", "Shadow Ball", "Night Slash"],
  talonflame: ["Fly", "Flame Charge", "Brave Bird", "Incinerate", "Fire Blast"],
  dunsparce: ["Drill Run", "Rock Slide", "Dig"],
  malamar: ["Superpower", "Foul Play", "Psybeam", "Hyper Beam"],
  gastrodon: ["Earth Power", "Body Slam", "Water Pulse", "Earthquake"],
  lickilicky: ["Body Slam", "Shadow Ball", "Earthquake", "Solar Beam", "Hyper Beam"],
  corviknight: ["Sky Attack", "Iron Head", "Payback", "Air Cutter"],
  skeledirge: ["Torch Song", "Shadow Ball", "Disarming Voice", "Crunch"],
  greninja: ["Hydro Cannon", "Night Slash", "Aerial Ace", "Surf"],
  morpeko: ["Aura Wheel", "Psychic Fangs", "Seed Bomb", "Outrage"],
  aegislash: ["Shadow Ball", "Flash Cannon", "Gyro Ball"],
  cramorant: ["Surf", "Fly", "Dive", "Hydro Pump"],
  palkia: ["Aqua Tail", "Draco Meteor", "Hydro Pump", "Fire Blast"],
  palkia_origin: ["Spacial Rend", "Aqua Tail", "Fire Blast", "Hydro Pump", "Draco Meteor"],
  zacian: ["Close Combat", "Play Rough", "Wild Charge", "Iron Head"],
  zacian_crowned: ["Behemoth Blade", "Close Combat", "Play Rough", "Wild Charge"],
  dialga: ["Iron Head", "Draco Meteor", "Thunder"],
  dialga_origin: ["Roar of Time", "Iron Head", "Thunder", "Flash Cannon"],
  zygarde: ["Crunch", "Earthquake", "Outrage", "Bulldoze"],
  zygarde_complete: ["Crunch", "Earthquake", "Outrage", "Bulldoze", "Hyper Beam"],
  giratina_altered: ["Dragon Claw", "Shadow Sneak", "Ancient Power"],
  giratina_origin: ["Shadow Ball", "Ominous Wind", "Dragon Pulse"],
  kyogre: ["Surf", "Origin Pulse", "Thunder", "Blizzard", "Hydro Pump"],
  groudon: ["Precipice Blades", "Fire Punch", "Earthquake", "Solar Beam"],
  rhyperior: ["Breaking Swipe", "Rock Wrecker", "Surf", "Superpower", "Earthquake"],
  landorus_therian: ["Sandsear Storm", "Superpower", "Stone Edge", "Earthquake"],
  ho_oh: ["Sacred Fire", "Brave Bird", "Earthquake", "Solar Beam"],
  necrozma_dusk_mane: ["Sunsteel Strike", "Dark Pulse", "Outrage", "Iron Head"],
  necrozma_dawn_wings: ["Moongeist Beam", "Dark Pulse", "Outrage", "Future Sight"],
  kyurem_black: ["Freeze Shock", "Fusion Bolt", "Dragon Claw", "Stone Edge", "Blizzard"],
  kyurem_white: ["Ice Burn", "Fusion Flare", "Dragon Pulse", "Blizzard", "Ancient Power"],
  xerneas: ["Moonblast", "Close Combat", "Giga Impact", "Thunder"],
  yveltal: ["Dark Pulse", "Oblivion Wing", "Focus Blast", "Hurricane", "Psychic"],
  solgaleo: ["Psychic Fangs", "Iron Head", "Flamethrower", "Solar Beam"],
  florges: ["Disarming Voice", "Moonblast", "Trailblaze", "Psychic"],
  primarina: ["Hydro Cannon", "Disarming Voice", "Moonblast", "Psychic"],
  cresselia: ["Grass Knot", "Moonblast", "Future Sight", "Aurora Beam"],
  registeel: ["Focus Blast", "Zap Cannon", "Flash Cannon", "Hyper Beam"],
  bastiodon: ["Stone Edge", "Flamethrower", "Flash Cannon"],
  medicham: ["Ice Punch", "Dynamic Punch", "Psychic", "Power-Up Punch"],
  lanturn: ["Surf", "Thunderbolt", "Hydro Pump"],
  skarmory: ["Sky Attack", "Brave Bird", "Flash Cannon"],
  whiscash: ["Scald", "Mud Bomb", "Blizzard"],
  poliwrath: ["Scald", "Icy Wind", "Dynamic Punch", "Ice Punch"],
  gligar: ["Aerial Ace", "Dig", "Night Slash"],
  serperior: ["Frenzy Plant", "Aerial Ace", "Leaf Tornado"],
  wigglytuff: ["Icy Wind", "Disarming Voice", "Swift", "Play Rough"],
  clefable: ["Meteor Mash", "Moonblast", "Swift", "Psychic"],
  umbreon: ["Foul Play", "Last Resort", "Psychic", "Dark Pulse"],
  venusaur: ["Frenzy Plant", "Sludge Bomb", "Solar Beam"],
  charizard: ["Blast Burn", "Dragon Claw", "Overheat"],
  blastoise: ["Hydro Cannon", "Ice Beam", "Skull Bash", "Flash Cannon"],
  machamp: ["Cross Chop", "Rock Slide", "Payback", "Dynamic Punch", "Close Combat"],
  dragonite: ["Dragon Claw", "Superpower", "Hurricane", "Outrage"],
  metagross: ["Meteor Mash", "Earthquake", "Psychic", "Flash Cannon"],
  mewtwo: ["Psystrike", "Shadow Ball", "Ice Beam", "Focus Blast", "Flamethrower"],
  garchomp: ["Earth Power", "Outrage", "Sand Tomb", "Earthquake"],
  togekiss: ["Aura Sphere", "Ancient Power", "Flamethrower", "Dazzling Gleam"],
  excadrill: ["Drill Run", "Rock Slide", "Scorching Sands", "Iron Head"],
  gyarados: ["Aqua Tail", "Crunch", "Outrage", "Hydro Pump"],
  melmetal: ["Double Iron Bash", "Superpower", "Rock Slide", "Thunderbolt"],
  lugia: ["Aeroblast", "Sky Attack", "Future Sight", "Hydro Pump"],
  rayquaza: ["Breaking Swipe", "Dragon Ascent", "Hurricane", "Outrage"],
  marowak_alolan: ["Shadow Bone", "Bone Club", "Fire Blast", "Shadow Ball"],
  ninetales_alolan: ["Weather Ball (Ice)", "Dazzling Gleam", "Psyshock", "Blizzard"],
  sandslash_alolan: ["Drill Run", "Ice Punch", "Blizzard", "Bulldoze"],
  weezing_galarian: ["Brutal Swing", "Overheat", "Play Rough", "Sludge"],
  stunfisk_galarian: ["Rock Slide", "Earthquake", "Muddy Water", "Flash Cannon"]
};

export function formatMoveIdToDisplayName(moveId: string): string {
  if (!moveId) return "";
  const upper = moveId.trim().toUpperCase();
  if (CANONICAL_MOVE_ID_MAP[upper]) return CANONICAL_MOVE_ID_MAP[upper];
  if (MOVE_ID_TO_NAME[moveId]) return MOVE_ID_TO_NAME[moveId];
  if (MOVE_ID_TO_NAME[upper]) return MOVE_ID_TO_NAME[upper];
  if (upper.endsWith("_PLUS")) {
    return `${formatMoveIdToDisplayName(upper.slice(0, -5))}+`;
  }
  return moveId
    .toLowerCase()
    .split("_")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : ""))
    .join(" ");
}

export function buildChargedMoveFromName(moveName: string, fallbackType: string, existingMoves: ChargedMove[]): ChargedMove {
  const lower = moveName.toLowerCase().trim();
  const spaceKey = lower.replace(/-/g, " ");
  const hyphenKey = lower.replace(/\s+/g, "-");
  const idKey = lower.replace(/[\s-]+/g, "_");
  for (const k of [lower, spaceKey, hyphenKey, idKey]) {
    if (DYNAMIC_CHARGED_MOVE_MAP[k]) return DYNAMIC_CHARGED_MOVE_MAP[k];
  }
  const existing = existingMoves.find((m) => {
    const ml = m.name.toLowerCase().trim();
    return ml === lower || ml === spaceKey || ml === hyphenKey;
  });
  if (existing) {
    for (const k of [lower, spaceKey, hyphenKey, idKey]) {
      if (DYNAMIC_CHARGED_MOVE_MAP[k]) {
        return {
          ...existing,
          power: DYNAMIC_CHARGED_MOVE_MAP[k].power,
          energyCost: DYNAMIC_CHARGED_MOVE_MAP[k].energyCost,
          type: DYNAMIC_CHARGED_MOVE_MAP[k].type
        };
      }
    }
    return existing;
  }
  for (const k of [lower, spaceKey, hyphenKey]) {
    const fb = CHARGED_MOVE_FALLBACK_STATS[k];
    if (fb) {
      return {
        name: moveName,
        code: fb.code,
        type: fb.type,
        power: fb.power,
        energyCost: fb.energyCost
      };
    }
  }
  return {
    name: moveName,
    code: abbrMove5(moveName),
    type: fallbackType || "normal",
    power: 75,
    energyCost: 50
  };
}

export function resolveChargedMove(moveName: string, fallbackType: string = "normal"): ChargedMove {
  return buildChargedMoveFromName(moveName, fallbackType, []);
}

export function applyRankingMovesToPokemonStats(
  pokemon: PokemonStats,
  league: string = "MASTER LEAGUE",
  isShadowOverride?: boolean
): PokemonStats {
  const normLeague = normalizeLeagueName(league);

  const isSkeledirge =
    !isBattleFrontierLeague(normLeague) &&
    (pokemon.baseSpecies?.toLowerCase() === "skeledirge" ||
      pokemon.speciesId.toLowerCase().startsWith("skeledirge"));

  const map = LIVE_RANKINGS_MAP[normLeague];
  const baseKey = pokemon.speciesId.toLowerCase().replace(/_shadow$/i, "");
  const isShadow =
    isShadowOverride ??
    (pokemon.name.toLowerCase().startsWith("shadow ") || pokemon.speciesId.toLowerCase().endsWith("_shadow"));

  const entry = map
    ? isShadow
      ? map.get(`${baseKey}_shadow`) || map.get(baseKey)
      : map.get(baseKey) || map.get(`${baseKey}_shadow`)
    : undefined;

  if (!entry) {
    if (isSkeledirge) {
      return {
        ...pokemon,
        defaultFastMove: FAST_MOVE_STATS["incinerate"] || resolveFastMove(pokemon),
        chargedMoves: [
          buildChargedMoveFromName("Torch Song", "fire", pokemon.chargedMoves),
          buildChargedMoveFromName("Shadow Ball", "ghost", pokemon.chargedMoves),
          buildChargedMoveFromName("Disarming Voice", "fairy", pokemon.chargedMoves)
        ]
      };
    }
    return {
      ...pokemon,
      defaultFastMove: resolveFastMove(pokemon)
    };
  }

  const topFastId = entry.moveset?.[0] || entry.moves.fastMoves[0]?.moveId;
  const fastName = topFastId ? formatMoveIdToDisplayName(topFastId) : pokemon.defaultFastMove.name;
  const resolvedFast = resolveFastMove(pokemon, fastName);

  if (isSkeledirge) {
    return {
      ...pokemon,
      defaultFastMove: resolvedFast,
      chargedMoves: [
        buildChargedMoveFromName("Torch Song", "fire", pokemon.chargedMoves),
        buildChargedMoveFromName("Shadow Ball", "ghost", pokemon.chargedMoves),
        buildChargedMoveFromName("Disarming Voice", "fairy", pokemon.chargedMoves)
      ]
    };
  }

  const cleanSpeciesId = pokemon.speciesId.replace(/_(shadow|alolan|galarian|hisuian|paldean)$/, "").toLowerCase();
  const speciesBaseKey = (pokemon.baseSpecies || pokemon.name).toLowerCase();
  const poolCharged =
    SPECIES_CHARGED_MOVES_POOL[pokemon.speciesId.toLowerCase()] ||
    SPECIES_CHARGED_MOVES_POOL[cleanSpeciesId] ||
    SPECIES_CHARGED_MOVES_POOL[pokemon.name.toLowerCase()] ||
    SPECIES_CHARGED_MOVES_POOL[baseKey] ||
    SPECIES_CHARGED_MOVES_POOL[speciesBaseKey] ||
    SPECIES_CHARGED_MOVES_POOL[`${cleanSpeciesId}_shield`] ||
    SPECIES_CHARGED_MOVES_POOL[`${cleanSpeciesId}_full_belly`] ||
    [];

  const orderedChargedNames: string[] = [];
  const addCandidate = (raw?: string) => {
    if (!raw) return;

    if (!raw || raw.trim().toUpperCase().endsWith("_PLUS") || raw.trim().endsWith("+")) return;
    const formatted = formatMoveIdToDisplayName(raw).trim();

    if (!formatted || formatted.endsWith("+") || formatted.toLowerCase() === "struggle" || formatted.toLowerCase() === "frustration") return;
    if (poolCharged.length > 0 && !poolCharged.some((p) => p.toLowerCase() === formatted.toLowerCase())) return;
    if (!orderedChargedNames.some((n) => n.toLowerCase() === formatted.toLowerCase())) {
      orderedChargedNames.push(formatted);
    }
  };

  if (entry.moveset && entry.moveset.length > 1) {
    for (const mId of entry.moveset.slice(1)) {
      addCandidate(mId);
    }
  }
  for (const cm of entry.moves.chargedMoves) {
    addCandidate(cm.moveId);
  }
  for (const cm of pokemon.chargedMoves) {
    addCandidate(cm.name);
  }
  for (const cm of poolCharged) {
    addCandidate(cm);
  }

  const finalChargedMoves =
    orderedChargedNames.length > 0
      ? orderedChargedNames
          .slice(0, 4)
          .map((mName) => buildChargedMoveFromName(mName, pokemon.types[0], pokemon.chargedMoves))
      : pokemon.chargedMoves;

  return {
    ...pokemon,
    defaultFastMove: resolvedFast,
    chargedMoves: finalChargedMoves
  };
}

export function parseRankingsJsonArray(rawJson: unknown): PokemonRankingEntry[] {
  if (!Array.isArray(rawJson)) return [];
  const entries: PokemonRankingEntry[] = [];
  for (const item of rawJson) {
    if (!item || typeof item !== "object") continue;
    const obj = item as Record<string, unknown>;
    const speciesId = typeof obj.speciesId === "string" ? obj.speciesId : "";
    if (!speciesId) continue;
    const score = typeof obj.score === "number" ? obj.score : 80.0;
    const movesObj = (obj.moves && typeof obj.moves === "object" ? obj.moves : {}) as Record<string, unknown>;
    const rawFast = Array.isArray(movesObj.fastMoves) ? movesObj.fastMoves : [];
    const rawCharged = Array.isArray(movesObj.chargedMoves) ? movesObj.chargedMoves : [];

    const fastMoves: MoveUsage[] = rawFast
      .map((m: unknown): MoveUsage | null => {
        if (!m || typeof m !== "object") return null;
        const mo = m as Record<string, unknown>;
        return typeof mo.moveId === "string"
          ? { moveId: mo.moveId, uses: typeof mo.uses === "number" ? mo.uses : undefined }
          : null;
      })
      .filter((x): x is MoveUsage => x !== null)
      .sort((a, b) => (b.uses ?? 0) - (a.uses ?? 0));

    const chargedMoves: MoveUsage[] = rawCharged
      .map((m: unknown): MoveUsage | null => {
        if (!m || typeof m !== "object") return null;
        const mo = m as Record<string, unknown>;
        return typeof mo.moveId === "string"
          ? { moveId: mo.moveId, uses: typeof mo.uses === "number" ? mo.uses : undefined }
          : null;
      })
      .filter((x): x is MoveUsage => x !== null)
      .sort((a, b) => (b.uses ?? 0) - (a.uses ?? 0));

    const moveset = Array.isArray(obj.moveset)
      ? obj.moveset.filter((s): s is string => typeof s === "string")
      : undefined;

    entries.push({
      speciesId,
      score,
      moves: { fastMoves, chargedMoves },
      moveCount: Array.isArray(obj.moveCount) ? (obj.moveCount as number[]) : undefined,
      moveset
    });
  }
  return entries;
}

export async function syncPvPokeDataAndRankings(): Promise<{
  syncedCount: number;
  rankingsCount: Record<string, number>;
}> {
  const [gmRes, glRes, ulRes, mlRes, megaRes, bfSpecRes, bfCaulRes, bfMasterRes] = await Promise.all([
    fetch(PVPOKE_ENDPOINTS.GAMEMASTER).then((r) => (r.ok ? r.json() : null)).catch(() => null),
    fetch(PVPOKE_ENDPOINTS.RANKINGS_GL).then((r) => (r.ok ? r.json() : null)).catch(() => null),
    fetch(PVPOKE_ENDPOINTS.RANKINGS_UL).then((r) => (r.ok ? r.json() : null)).catch(() => null),
    fetch(PVPOKE_ENDPOINTS.RANKINGS_ML).then((r) => (r.ok ? r.json() : null)).catch(() => null),
    fetch(PVPOKE_ENDPOINTS.RANKINGS_MEGA_ML).then((r) => (r.ok ? r.json() : null)).catch(() => null),
    fetch(PVPOKE_ENDPOINTS.RANKINGS_BF_SPECTRAL).then((r) => (r.ok ? r.json() : null)).catch(() => null),
    fetch(PVPOKE_ENDPOINTS.RANKINGS_BF_CAULDRON).then((r) => (r.ok ? r.json() : null)).catch(() => null),
    fetch(PVPOKE_ENDPOINTS.RANKINGS_BF_MASTER).then((r) => (r.ok ? r.json() : null)).catch(() => null)
  ]);

  const gmMoveDetails: Record<
    string,
    { name: string; type: string; power: number; energy: number; energyGain: number; turns: number }
  > = {};

  if (gmRes && typeof gmRes === "object" && Array.isArray(gmRes.moves)) {
    for (const m of gmRes.moves) {
      if (m?.moveId && m?.name) {
        const moveIdStr = String(m.moveId);
        MOVE_ID_TO_NAME[moveIdStr] = m.name;
        const cooldownTurns =
          typeof m.cooldown === "number" && m.cooldown > 0 ? Math.max(1, Math.round(m.cooldown / 500)) : undefined;
        const rawTurns = typeof m.turns === "number" && m.turns > 0 ? m.turns : undefined;
        const parsedTurns =
          rawTurns !== undefined
            ? rawTurns >= 500
              ? Math.max(1, Math.round(rawTurns / 500))
              : Math.max(1, rawTurns)
            : undefined;
        const turns = Math.max(1, Math.min(5, cooldownTurns ?? parsedTurns ?? 1));
        gmMoveDetails[moveIdStr] = {
          name: m.name,
          type: typeof m.type === "string" ? m.type.toLowerCase() : "normal",
          power: typeof m.power === "number" ? m.power : 0,
          energy: typeof m.energy === "number" ? m.energy : 0,
          energyGain: typeof m.energyGain === "number" ? m.energyGain : 0,
          turns
        };
        if (typeof m.energy === "number" && m.energy > 0) {
          const chargedEntry: ChargedMove = {
            name: m.name,
            code: abbrMove5(m.name),
            type: typeof m.type === "string" ? m.type.toLowerCase() : "normal",
            power: typeof m.power === "number" ? m.power : 50,
            energyCost: m.energy
          };
          const nameKey = m.name.toLowerCase().trim();
          const idKey = String(m.moveId).toLowerCase().trim();
          const spaceKey = nameKey.replace(/-/g, " ");
          const hyphenKey = nameKey.replace(/\s+/g, "-");
          const underscoreKey = nameKey.replace(/[\s-]+/g, "_");
          for (const k of [nameKey, idKey, spaceKey, hyphenKey, underscoreKey]) {
            DYNAMIC_CHARGED_MOVE_MAP[k] = chargedEntry;
          }
          const rawChance =
            typeof m.buffApplyChance === "number"
              ? m.buffApplyChance
              : typeof m.buffApplyChance === "string"
              ? parseFloat(m.buffApplyChance)
              : 0;
          let selfAtk = 0;
          let selfDef = 0;
          let oppAtk = 0;
          let oppDef = 0;
          if (Array.isArray(m.buffsSelf) && m.buffsSelf.length >= 2) {
            selfAtk = Number(m.buffsSelf[0]) || 0;
            selfDef = Number(m.buffsSelf[1]) || 0;
          }
          if (Array.isArray(m.buffsOpponent) && m.buffsOpponent.length >= 2) {
            oppAtk = Number(m.buffsOpponent[0]) || 0;
            oppDef = Number(m.buffsOpponent[1]) || 0;
          }
          if (
            Array.isArray(m.buffs) &&
            m.buffs.length >= 2 &&
            selfAtk === 0 &&
            selfDef === 0 &&
            oppAtk === 0 &&
            oppDef === 0
          ) {
            const b0 = Number(m.buffs[0]) || 0;
            const b1 = Number(m.buffs[1]) || 0;
            const target = typeof m.buffTarget === "string" ? m.buffTarget.toLowerCase().trim() : "";
            if (target === "opponent") {
              oppAtk = b0;
              oppDef = b1;
            } else if (target === "self") {
              selfAtk = b0;
              selfDef = b1;
            } else if (target === "both") {
              selfAtk = b0;
              selfDef = b1;
              oppAtk = b0;
              oppDef = b1;
            }
          }
          const normChance =
            Number.isFinite(rawChance) && rawChance > 0
              ? rawChance > 1
                ? Math.min(1, rawChance / 100)
                : Math.min(1, rawChance)
              : 0;
          const lowerName = m.name.toLowerCase().trim();
          const lowerId = String(m.moveId).toLowerCase().trim();
          if (normChance > 0 && (selfAtk !== 0 || selfDef !== 0 || oppAtk !== 0 || oppDef !== 0)) {
            const effect: MoveBuffEffect = {
              selfAtkDelta: selfAtk,
              selfDefDelta: selfDef,
              oppAtkDelta: oppAtk,
              oppDefDelta: oppDef,
              chance: normChance
            };
            DYNAMIC_MOVE_BUFF_TABLE[lowerName] = effect;
            DYNAMIC_MOVE_BUFF_TABLE[lowerId] = effect;
          } else {
            delete DYNAMIC_MOVE_BUFF_TABLE[lowerName];
            delete DYNAMIC_MOVE_BUFF_TABLE[lowerId];
          }
        } else if (typeof m.energyGain === "number" && m.energyGain > 0) {
          const fastEntry: FastMove = {
            name: m.name,
            type: typeof m.type === "string" ? m.type.toLowerCase() : "normal",
            turns,
            power: typeof m.power === "number" ? m.power : 0,
            energyGain: m.energyGain
          };
          const idKey = String(m.moveId).toLowerCase().trim();
          FAST_MOVE_STATS[idKey] = fastEntry;
          if (!String(m.moveId).toUpperCase().startsWith("AEGISLASH_CHARGE_")) {
            const nameKey = m.name.toLowerCase().trim();
            const spaceKey = nameKey.replace(/-/g, " ");
            const hyphenKey = nameKey.replace(/\s+/g, "-");
            FAST_MOVE_STATS[nameKey] = fastEntry;
            FAST_MOVE_STATS[spaceKey] = fastEntry;
            FAST_MOVE_STATS[hyphenKey] = fastEntry;
          }
        }
      }
    }
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.setItem(
          "gbl_pvpoke_gamemaster_buffs_v1",
          JSON.stringify(DYNAMIC_MOVE_BUFF_TABLE)
        );
      }
    } catch {
      // Ignore localStorage quota errors
    }
  }

  const glEntries = parseRankingsJsonArray(glRes);
  const ulEntries = parseRankingsJsonArray(ulRes);
  const mlEntries = parseRankingsJsonArray(mlRes);
  const megaEntries = parseRankingsJsonArray(megaRes);
  const bfSpecEntries = parseRankingsJsonArray(bfSpecRes);
  const bfCaulEntries = parseRankingsJsonArray(bfCaulRes);
  const bfMasterEntries = parseRankingsJsonArray(bfMasterRes);

  const storeLeagueRankings = (leagueKey: string, list: PokemonRankingEntry[]) => {
    if (list.length === 0) return;
    if (!LIVE_RANKINGS_MAP[leagueKey]) {
      LIVE_RANKINGS_MAP[leagueKey] = new Map();
    }
    const map = LIVE_RANKINGS_MAP[leagueKey];
    map.clear();
    list.forEach((entry) => {
      map.set(entry.speciesId.toLowerCase(), entry);
    });
    const upperKey = leagueKey.toUpperCase();
    if (upperKey !== leagueKey) {
      LIVE_RANKINGS_MAP[upperKey] = map;
    }
  };

  storeLeagueRankings("GREAT LEAGUE", glEntries);
  storeLeagueRankings("Great League (1500)", glEntries);
  storeLeagueRankings("ULTRA LEAGUE", ulEntries);
  storeLeagueRankings("Ultra League (2500)", ulEntries);
  storeLeagueRankings("MASTER LEAGUE", mlEntries);
  storeLeagueRankings("Master League (10000)", mlEntries);
  storeLeagueRankings("MEGA MASTER LEAGUE", megaEntries);
  storeLeagueRankings("Mega Master League (10000)", megaEntries);
  storeLeagueRankings("Battle Frontier (Spectral)", bfSpecEntries);
  storeLeagueRankings("BATTLE FRONTIER (SPECTRAL)", bfSpecEntries);
  storeLeagueRankings("Battle Frontier (Cauldron)", bfCaulEntries);
  storeLeagueRankings("BATTLE FRONTIER (CAULDRON)", bfCaulEntries);
  storeLeagueRankings("Battle Frontier (Master)", bfMasterEntries);
  storeLeagueRankings("BATTLE FRONTIER (MASTER)", bfMasterEntries);

  if (glEntries.length > 0) {
    LIVE_RANKINGS_LIST["GREAT LEAGUE"] = glEntries;
    (LIVE_RANKINGS_LIST as Record<string, PokemonRankingEntry[]>)["Great League (1500)"] = glEntries;
  }
  if (ulEntries.length > 0) {
    LIVE_RANKINGS_LIST["ULTRA LEAGUE"] = ulEntries;
    (LIVE_RANKINGS_LIST as Record<string, PokemonRankingEntry[]>)["Ultra League (2500)"] = ulEntries;
  }
  if (mlEntries.length > 0) {
    LIVE_RANKINGS_LIST["MASTER LEAGUE"] = mlEntries;
    (LIVE_RANKINGS_LIST as Record<string, PokemonRankingEntry[]>)["Master League (10000)"] = mlEntries;
  }
  if (megaEntries.length > 0) {
    LIVE_RANKINGS_LIST["MEGA MASTER LEAGUE"] = megaEntries;
    (LIVE_RANKINGS_LIST as Record<string, PokemonRankingEntry[]>)["Mega Master League (10000)"] = megaEntries;
  }
  if (bfSpecEntries.length > 0) {
    LIVE_RANKINGS_LIST["Battle Frontier (Spectral)"] = bfSpecEntries;
    (LIVE_RANKINGS_LIST as Record<string, PokemonRankingEntry[]>)["BATTLE FRONTIER (SPECTRAL)"] = bfSpecEntries;
  }
  if (bfCaulEntries.length > 0) {
    LIVE_RANKINGS_LIST["Battle Frontier (Cauldron)"] = bfCaulEntries;
    (LIVE_RANKINGS_LIST as Record<string, PokemonRankingEntry[]>)["BATTLE FRONTIER (CAULDRON)"] = bfCaulEntries;
  }
  if (bfMasterEntries.length > 0) {
    LIVE_RANKINGS_LIST["Battle Frontier (Master)"] = bfMasterEntries;
    (LIVE_RANKINGS_LIST as Record<string, PokemonRankingEntry[]>)["BATTLE FRONTIER (MASTER)"] = bfMasterEntries;
  }

  (
    [
      "GREAT LEAGUE",
      "ULTRA LEAGUE",
      "MASTER LEAGUE",
      "MEGA MASTER LEAGUE",
      "Battle Frontier (Spectral)",
      "Battle Frontier (Cauldron)",
      "Battle Frontier (Master)"
    ] as const
  ).forEach((lg) => {
    const top20 = getLiveRankingsForLeague(lg, 20);
    PVPOKE_TOP_OPPONENTS[lg] = top20;
    PVPOKE_TOP_OPPONENTS[lg.toUpperCase()] = top20;
  });
  PVPOKE_TOP_OPPONENTS["Mega Master League (10000)"] = PVPOKE_TOP_OPPONENTS["MEGA MASTER LEAGUE"];
  PVPOKE_TOP_OPPONENTS["Great League (1500)"] = PVPOKE_TOP_OPPONENTS["GREAT LEAGUE"];
  PVPOKE_TOP_OPPONENTS["Ultra League (2500)"] = PVPOKE_TOP_OPPONENTS["ULTRA LEAGUE"];
  PVPOKE_TOP_OPPONENTS["Master League (10000)"] = PVPOKE_TOP_OPPONENTS["MASTER LEAGUE"];

  // Dynamically ingest species from gamemaster.json so all base, alternate, mega, and shadow forms are available in Team Builder
  if (gmRes && typeof gmRes === "object" && Array.isArray(gmRes.pokemon)) {
    const typeColorMap: Record<string, string> = {
      fire: "#f97316",
      water: "#3b82f6",
      grass: "#22c55e",
      electric: "#eab308",
      ice: "#38bdf8",
      fighting: "#ef4444",
      poison: "#a855f7",
      ground: "#d97706",
      flying: "#60a5fa",
      psychic: "#ec4899",
      bug: "#84cc16",
      rock: "#b45309",
      ghost: "#8b5cf6",
      dragon: "#6366f1",
      dark: "#64748b",
      steel: "#94a3b8",
      fairy: "#f472b6",
      normal: "#9ca3af"
    };

    for (const p of gmRes.pokemon) {
      if (!p || typeof p.speciesId !== "string" || typeof p.speciesName !== "string") continue;
      const speciesId: string = p.speciesId;
      let displayName: string = p.speciesName;
      if (displayName.endsWith(" (Shadow)")) {
        displayName = "Shadow " + displayName.replace(" (Shadow)", "").trim();
      }
      const rawTypes = Array.isArray(p.types)
        ? p.types.filter((t: unknown): t is string => typeof t === "string" && t.toLowerCase() !== "none").map((t: string) => t.toLowerCase())
        : ["normal"];
      const types = rawTypes.length > 0 ? rawTypes : ["normal"];
      const statsObj = p.baseStats && typeof p.baseStats === "object" ? p.baseStats : {};
      const atk = typeof statsObj.atk === "number" ? statsObj.atk : 180;
      const def = typeof statsObj.def === "number" ? statsObj.def : 180;
      const hp = typeof statsObj.hp === "number" ? statsObj.hp : 180;

      let defaultIvsGl = "1/15/15";
      let defaultIvsUl = "1/15/15";
      if (p.defaultIVs && typeof p.defaultIVs === "object") {
        if (Array.isArray(p.defaultIVs.cp1500) && p.defaultIVs.cp1500.length >= 4) {
          defaultIvsGl = `${Math.trunc(p.defaultIVs.cp1500[1])}/${Math.trunc(p.defaultIVs.cp1500[2])}/${Math.trunc(p.defaultIVs.cp1500[3])}`;
        }
        if (Array.isArray(p.defaultIVs.cp2500) && p.defaultIVs.cp2500.length >= 4) {
          defaultIvsUl = `${Math.trunc(p.defaultIVs.cp2500[1])}/${Math.trunc(p.defaultIVs.cp2500[2])}/${Math.trunc(p.defaultIVs.cp2500[3])}`;
        }
      }

      const rawFastIds: string[] = Array.isArray(p.fastMoves) ? p.fastMoves : [];
      const rawChargedIds: string[] = Array.isArray(p.chargedMoves) ? p.chargedMoves : [];
      const rawEliteIds: string[] = Array.isArray(p.eliteMoves) ? p.eliteMoves : [];
      const baseSpeciesKey = speciesId.toLowerCase().replace(/_shadow$/i, "");
      if (Array.isArray(p.extraChargedMoves)) {
        for (const extraId of p.extraChargedMoves) {
          if (typeof extraId === "string" && extraId.trim().toUpperCase().endsWith("_PLUS")) {
            const plusMoveName =
              gmMoveDetails[extraId]?.name || formatMoveIdToDisplayName(extraId);
            if (plusMoveName) {
              DYNAMIC_SUPER_MEGA_PLUS_MOVES[speciesId.toLowerCase()] = plusMoveName;
              DYNAMIC_SUPER_MEGA_PLUS_MOVES[displayName.toLowerCase()] = plusMoveName;
            }
          }
        }
      }

      const gmFastNames: string[] = [];
      for (const fId of [...rawFastIds, ...rawEliteIds]) {
        const fDetail = gmMoveDetails[fId];
        if (fDetail && fDetail.energy === 0 && fDetail.energyGain > 0) {
          if (!gmFastNames.some((x) => x.toLowerCase() === fDetail.name.toLowerCase())) {
            gmFastNames.push(fDetail.name);
          }
        } else if (rawFastIds.includes(fId)) {
          const formatted = formatMoveIdToDisplayName(fId);
          if (formatted && !gmFastNames.some((x) => x.toLowerCase() === formatted.toLowerCase())) {
            gmFastNames.push(formatted);
          }
        }
      }
      if (gmFastNames.length > 0) {
        SPECIES_FAST_MOVES_POOL[baseSpeciesKey] = [...gmFastNames];
        SPECIES_FAST_MOVES_POOL[speciesId.toLowerCase()] = [...gmFastNames];
      }

      const gmChargedNames: string[] = [];
      for (const cId of [...rawChargedIds, ...rawEliteIds]) {
        if (typeof cId === "string" && cId.trim().toUpperCase().endsWith("_PLUS")) continue;
        const cDetail = gmMoveDetails[cId];
        if (cDetail && cDetail.energy > 0) {
          if (!gmChargedNames.some((x) => x.toLowerCase() === cDetail.name.toLowerCase())) {
            gmChargedNames.push(cDetail.name);
          }
        } else if (rawChargedIds.includes(cId)) {
          const formatted = formatMoveIdToDisplayName(cId);
          if (formatted && !gmChargedNames.some((x) => x.toLowerCase() === formatted.toLowerCase())) {
            gmChargedNames.push(formatted);
          }
        }
      }
      if (gmChargedNames.length > 0) {
        SPECIES_CHARGED_MOVES_POOL[baseSpeciesKey] = [...gmChargedNames];
        SPECIES_CHARGED_MOVES_POOL[speciesId.toLowerCase()] = [...gmChargedNames];
      }

      // Update any existing static keys that match either displayName or speciesId (e.g., "Zygarde" -> "zygarde_complete")
      for (const [k, existingEntry] of Object.entries(POKEMON_DATABASE)) {
        if (k === displayName || existingEntry.speciesId.toLowerCase() === speciesId.toLowerCase()) {
          let updatedChargedMoves = existingEntry.chargedMoves.map((cm) =>
            buildChargedMoveFromName(cm.name, types[0] || "normal", existingEntry.chargedMoves)
          );
          if (gmChargedNames.length > 0) {
            const validExisting = updatedChargedMoves.filter((cm) =>
              gmChargedNames.some((gm) => gm.toLowerCase() === cm.name.toLowerCase())
            );
            for (const gmName of gmChargedNames) {
              if (!validExisting.some((cm) => cm.name.toLowerCase() === gmName.toLowerCase())) {
                validExisting.push(buildChargedMoveFromName(gmName, types[0], existingEntry.chargedMoves));
              }
            }
            if (validExisting.length > 0) {
              updatedChargedMoves = validExisting;
            }
          }
          POKEMON_DATABASE[k] = {
            ...existingEntry,
            types,
            baseStats: { atk, def, hp },
            isRawBaseStats: true,
            defaultIvsGl,
            defaultIvsUl,
            defaultFastMove: resolveFastMove(existingEntry),
            chargedMoves: updatedChargedMoves
          };
        }
      }
      if (POKEMON_DATABASE[displayName]) {
        continue;
      }

      const rankEntry =
        LIVE_RANKINGS_MAP["GREAT LEAGUE"]?.get(speciesId.toLowerCase()) ||
        LIVE_RANKINGS_MAP["ULTRA LEAGUE"]?.get(speciesId.toLowerCase()) ||
        LIVE_RANKINGS_MAP["MASTER LEAGUE"]?.get(speciesId.toLowerCase()) ||
        LIVE_RANKINGS_MAP["MEGA MASTER LEAGUE"]?.get(speciesId.toLowerCase());

      const prefFastId = rankEntry?.moveset?.[0] || rankEntry?.moves.fastMoves[0]?.moveId || rawFastIds[0] || "TACKLE";
      const fastInfo = gmMoveDetails[prefFastId] || {
        name: formatMoveIdToDisplayName(prefFastId) || "Tackle",
        type: types[0],
        turns: 2,
        power: 5,
        energyGain: 7,
        energy: 0
      };

      const orderedChargedIds: string[] = [];
      if (rankEntry) {
        rankEntry.moveset?.slice(1).forEach((mId) => {
          if (mId && !mId.toUpperCase().endsWith("_PLUS") && !orderedChargedIds.includes(mId)) orderedChargedIds.push(mId);
        });
        rankEntry.moves.chargedMoves.forEach((cm) => {
          if (cm.moveId && !cm.moveId.toUpperCase().endsWith("_PLUS") && !orderedChargedIds.includes(cm.moveId)) orderedChargedIds.push(cm.moveId);
        });
      }
      rawChargedIds.forEach((mId) => {
        if (mId && !orderedChargedIds.includes(mId)) orderedChargedIds.push(mId);
      });

      const chargedMoves: ChargedMove[] = orderedChargedIds.slice(0, 4).map((mId) => {
        const cInfo = gmMoveDetails[mId];
        const mName = cInfo?.name || formatMoveIdToDisplayName(mId) || "Struggle";
        const words = mName.split(" ").filter(Boolean);
        const code = words.length >= 2 ? (words[0][0] + words[1][0]).toUpperCase() : mName.slice(0, 2).toUpperCase();
        return {
          name: mName,
          code,
          type: cInfo?.type || types[0],
          power: cInfo?.power || 75,
          energyCost: cInfo?.energy || 50
        };
      });

      const baseSpecies = speciesId
        .replace(/_shadow$/i, "")
        .split("_")[0]
        .toLowerCase();

      const parenMatch = displayName.match(/\(([^)]+)\)/);
      const formLabel = parenMatch
        ? parenMatch[1]
        : displayName.startsWith("Mega ")
        ? "Mega"
        : displayName.startsWith("Primal ")
        ? "Primal"
        : undefined;

      POKEMON_DATABASE[displayName] = {
        speciesId,
        name: displayName,
        baseSpecies,
        formLabel,
        types,
        baseStats: { atk, def, hp },
        isRawBaseStats: true,
        defaultIvsGl,
        defaultIvsUl,
        defaultFastMove: {
          name: fastInfo.name,
          type: fastInfo.type,
          turns: fastInfo.turns,
          power: fastInfo.power,
          energyGain: fastInfo.energyGain
        },
        chargedMoves:
          chargedMoves.length > 0
            ? chargedMoves
            : [{ name: "Body Slam", code: "BS", type: "normal", power: 65, energyCost: 40 }],
        color: typeColorMap[types[0]] || "#38bdf8"
      };
    }
  }

  try {
    await syncLimitedMetaRankings();
  } catch {
    // ignore limited meta sync errors
  }

  return {
    syncedCount: Object.keys(POKEMON_DATABASE).length,
    rankingsCount: {
      "GREAT LEAGUE": glEntries.length,
      "ULTRA LEAGUE": ulEntries.length,
      "MASTER LEAGUE": mlEntries.length,
      "MEGA MASTER LEAGUE": megaEntries.length,
      "Battle Frontier (Spectral)": bfSpecEntries.length,
      "Battle Frontier (Cauldron)": bfCaulEntries.length,
      "Battle Frontier (Master)": bfMasterEntries.length
    }
  };
}

export function formatShortSelectedLeagueLabel(leagueKey: string): string {
  const upper = (leagueKey || "").trim().toUpperCase();
  if (upper === "GREAT LEAGUE" || upper === "GREAT LEAGUE (1500)") return "GL (1500)";
  if (upper === "ULTRA LEAGUE" || upper === "ULTRA LEAGUE (2500)") return "UL (2500)";
  if (upper === "MASTER LEAGUE" || upper === "MASTER LEAGUE (10000)") return "ML (10000)";
  if (upper.includes("MEGA MASTER") || upper === "MASTER LEAGUE (MEGA) (10000)") return "Mega ML";
  if (upper.includes("BATTLE FRONTIER") && upper.includes("SPECTRAL")) return "BF (Spectral)";
  if (upper.includes("BATTLE FRONTIER") && upper.includes("CAULDRON")) return "BF (Cauldron)";
  if (upper.includes("BATTLE FRONTIER") && upper.includes("MASTER")) return "BF (Master)";
  return (leagueKey || "").trim();
}

export function getPvPokeDatabaseTelemetry(): {
  gmCount: number;
  glCount: number;
  ulCount: number;
  mlCount: number;
  megaCount: number;
  areAllFourLeaguesLoaded: boolean;
  selectedLeagues: Array<{ key: string; shortLabel: string; count: number }>;
} {
  const glCount = LIVE_RANKINGS_MAP["GREAT LEAGUE"]?.size ?? 0;
  const ulCount = LIVE_RANKINGS_MAP["ULTRA LEAGUE"]?.size ?? 0;
  const mlCount = LIVE_RANKINGS_MAP["MASTER LEAGUE"]?.size ?? 0;
  const megaCount = LIVE_RANKINGS_MAP["MEGA MASTER LEAGUE"]?.size ?? 0;

  const rawSelected = [...getEnabledGblLeagues(), ...getEnabledShow6Leagues()];
  const seenShort = new Set<string>();
  const selectedLeagues: Array<{ key: string; shortLabel: string; count: number }> = [];
  for (const lg of rawSelected) {
    const trimmed = (lg || "").trim();
    if (!trimmed) continue;
    const shortLabel = formatShortSelectedLeagueLabel(trimmed);
    const dedupKey = shortLabel.toUpperCase();
    if (seenShort.has(dedupKey)) continue;
    seenShort.add(dedupKey);
    const upper = trimmed.toUpperCase();
    const norm = normalizeLeagueName(trimmed);
    const count =
      LIVE_RANKINGS_MAP[trimmed]?.size ??
      LIVE_RANKINGS_MAP[upper]?.size ??
      LIVE_RANKINGS_MAP[norm]?.size ??
      LIVE_RANKINGS_MAP[norm.toUpperCase()]?.size ??
      0;
    selectedLeagues.push({ key: trimmed, shortLabel, count });
  }

  return {
    gmCount: Object.keys(POKEMON_DATABASE).length,
    glCount,
    ulCount,
    mlCount,
    megaCount,
    areAllFourLeaguesLoaded: glCount > 0 && ulCount > 0 && mlCount > 0,
    selectedLeagues
  };
}

export interface PokemonAutocompleteOption {
  name: string;
  speciesId: string;
  baseSpecies: string;
  formBadge: string;
  types: string[];
  cp: number;
  fastMove: string;
  chargedMove1: string;
  chargedMove2: string;
  isShadow: boolean;
  isAlternateForm: boolean;
  score?: number;
}

export const BUILTIN_REGIONAL_ALTERNATES: Array<{
  base: string;
  name: string;
  speciesId: string;
  formBadge: string;
  types: string[];
  fastMove: string;
  chargedMove1: string;
  chargedMove2: string;
  hasShadow?: boolean;
}> = [
  { base: "ninetales", name: "Kanto Ninetales", speciesId: "ninetales", formBadge: "Kanto", types: ["fire"], fastMove: "Ember", chargedMove1: "Weather Ball (Fire)", chargedMove2: "Energy Ball", hasShadow: true },
  { base: "ninetales", name: "Ninetales (Alolan)", speciesId: "ninetales_alolan", formBadge: "Alolan", types: ["ice", "fairy"], fastMove: "Powder Snow", chargedMove1: "Weather Ball (Ice)", chargedMove2: "Chilling Water", hasShadow: true },
  { base: "marowak", name: "Marowak", speciesId: "marowak", formBadge: "Kanto", types: ["ground"], fastMove: "Mud-Slap", chargedMove1: "Bone Club", chargedMove2: "Rock Slide", hasShadow: true },
  { base: "marowak", name: "Marowak (Alolan)", speciesId: "marowak_alolan", formBadge: "Alolan", types: ["fire", "ghost"], fastMove: "Fire Spin", chargedMove1: "Shadow Bone", chargedMove2: "Bone Club", hasShadow: true },
  { base: "sandslash", name: "Sandslash", speciesId: "sandslash", formBadge: "Kanto", types: ["ground"], fastMove: "Mud Shot", chargedMove1: "Scorching Sands", chargedMove2: "Night Slash", hasShadow: true },
  { base: "sandslash", name: "Sandslash (Alolan)", speciesId: "sandslash_alolan", formBadge: "Alolan", types: ["ice", "steel"], fastMove: "Powder Snow", chargedMove1: "Ice Punch", chargedMove2: "Drill Run", hasShadow: true },
  { base: "raichu", name: "Raichu", speciesId: "raichu", formBadge: "Kanto", types: ["electric"], fastMove: "Volt Switch", chargedMove1: "Trailblaze", chargedMove2: "Wild Charge", hasShadow: true },
  { base: "raichu", name: "Raichu (Alolan)", speciesId: "raichu_alolan", formBadge: "Alolan", types: ["electric", "psychic"], fastMove: "Volt Switch", chargedMove1: "Thunder Punch", chargedMove2: "Wild Charge", hasShadow: false },
  { base: "weezing", name: "Weezing", speciesId: "weezing", formBadge: "Kanto", types: ["poison"], fastMove: "Infestation", chargedMove1: "Sludge", chargedMove2: "Thunderbolt", hasShadow: true },
  { base: "weezing", name: "Weezing (Galarian)", speciesId: "weezing_galarian", formBadge: "Galarian", types: ["poison", "fairy"], fastMove: "Fairy Wind", chargedMove1: "Brutal Swing", chargedMove2: "Overheat", hasShadow: true },
  { base: "stunfisk", name: "Stunfisk", speciesId: "stunfisk", formBadge: "Unova", types: ["ground", "electric"], fastMove: "Thunder Shock", chargedMove1: "Mud Bomb", chargedMove2: "Discharge", hasShadow: false },
  { base: "stunfisk", name: "Stunfisk (Galarian)", speciesId: "stunfisk_galarian", formBadge: "Galarian", types: ["ground", "steel"], fastMove: "Mud Shot", chargedMove1: "Rock Slide", chargedMove2: "Earthquake", hasShadow: false },
  { base: "moltres", name: "Moltres", speciesId: "moltres", formBadge: "Kanto", types: ["fire", "flying"], fastMove: "Wing Attack", chargedMove1: "Sky Attack", chargedMove2: "Overheat", hasShadow: true },
  { base: "moltres", name: "Moltres (Galarian)", speciesId: "moltres_galarian", formBadge: "Galarian", types: ["dark", "flying"], fastMove: "Sucker Punch", chargedMove1: "Fly", chargedMove2: "Brave Bird", hasShadow: false },
  { base: "zapdos", name: "Zapdos", speciesId: "zapdos", formBadge: "Kanto", types: ["electric", "flying"], fastMove: "Thunder Shock", chargedMove1: "Drill Peck", chargedMove2: "Thunderbolt", hasShadow: true },
  { base: "zapdos", name: "Zapdos (Galarian)", speciesId: "zapdos_galarian", formBadge: "Galarian", types: ["fighting", "flying"], fastMove: "Counter", chargedMove1: "Ancient Power", chargedMove2: "Close Combat", hasShadow: false },
  { base: "articuno", name: "Articuno", speciesId: "articuno", formBadge: "Kanto", types: ["ice", "flying"], fastMove: "Ice Shard", chargedMove1: "Icy Wind", chargedMove2: "Ancient Power", hasShadow: true },
  { base: "articuno", name: "Articuno (Galarian)", speciesId: "articuno_galarian", formBadge: "Galarian", types: ["psychic", "flying"], fastMove: "Psycho Cut", chargedMove1: "Ancient Power", chargedMove2: "Brave Bird", hasShadow: false },
  { base: "muk", name: "Muk", speciesId: "muk", formBadge: "Kanto", types: ["poison"], fastMove: "Poison Jab", chargedMove1: "Thunder Punch", chargedMove2: "Dark Pulse", hasShadow: true },
  { base: "muk", name: "Muk (Alolan)", speciesId: "muk_alolan", formBadge: "Alolan", types: ["poison", "dark"], fastMove: "Poison Jab", chargedMove1: "Acid Spray", chargedMove2: "Dark Pulse", hasShadow: true },
  { base: "qwilfish", name: "Qwilfish", speciesId: "qwilfish", formBadge: "Johto", types: ["water", "poison"], fastMove: "Poison Sting", chargedMove1: "Aqua Tail", chargedMove2: "Sludge Wave", hasShadow: true },
  { base: "qwilfish", name: "Qwilfish (Hisuian)", speciesId: "qwilfish_hisuian", formBadge: "Hisuian", types: ["dark", "poison"], fastMove: "Poison Jab", chargedMove1: "Aqua Tail", chargedMove2: "Shadow Ball", hasShadow: false },
  { base: "typhlosion", name: "Typhlosion", speciesId: "typhlosion", formBadge: "Johto", types: ["fire"], fastMove: "Incinerate", chargedMove1: "Blast Burn", chargedMove2: "Thunder Punch", hasShadow: true },
  { base: "typhlosion", name: "Typhlosion (Hisuian)", speciesId: "typhlosion_hisuian", formBadge: "Hisuian", types: ["fire", "ghost"], fastMove: "Hex", chargedMove1: "Fire Punch", chargedMove2: "Shadow Ball", hasShadow: false },
  { base: "samurott", name: "Samurott", speciesId: "samurott", formBadge: "Unova", types: ["water"], fastMove: "Fury Cutter", chargedMove1: "Hydro Cannon", chargedMove2: "Megahorn", hasShadow: false },
  { base: "samurott", name: "Samurott (Hisuian)", speciesId: "samurott_hisuian", formBadge: "Hisuian", types: ["water", "dark"], fastMove: "Snarl", chargedMove1: "Icy Wind", chargedMove2: "Dark Pulse", hasShadow: false },
  { base: "decidueye", name: "Decidueye", speciesId: "decidueye", formBadge: "Alola", types: ["grass", "ghost"], fastMove: "Astonish", chargedMove1: "Frenzy Plant", chargedMove2: "Spirit Shackle", hasShadow: false },
  { base: "decidueye", name: "Decidueye (Hisuian)", speciesId: "decidueye_hisuian", formBadge: "Hisuian", types: ["grass", "fighting"], fastMove: "Psycho Cut", chargedMove1: "Aura Sphere", chargedMove2: "Trailblaze", hasShadow: false },
  { base: "deoxys", name: "Deoxys (Defense)", speciesId: "deoxys_defense", formBadge: "Defense", types: ["psychic"], fastMove: "Counter", chargedMove1: "Rock Slide", chargedMove2: "Psycho Boost", hasShadow: false },
  { base: "deoxys", name: "Deoxys (Normal)", speciesId: "deoxys", formBadge: "Normal", types: ["psychic"], fastMove: "Zen Headbutt", chargedMove1: "Psycho Boost", chargedMove2: "Thunderbolt", hasShadow: false },
  { base: "deoxys", name: "Deoxys (Attack)", speciesId: "deoxys_attack", formBadge: "Attack", types: ["psychic"], fastMove: "Poison Jab", chargedMove1: "Psycho Boost", chargedMove2: "Dark Pulse", hasShadow: false },
  { base: "deoxys", name: "Deoxys (Speed)", speciesId: "deoxys_speed", formBadge: "Speed", types: ["psychic"], fastMove: "Zen Headbutt", chargedMove1: "Psycho Boost", chargedMove2: "Thunderbolt", hasShadow: false },
  { base: "urshifu", name: "Urshifu (Single Strike)", speciesId: "urshifu_single_strike", formBadge: "Single Strike", types: ["fighting", "dark"], fastMove: "Counter", chargedMove1: "Dynamic Punch", chargedMove2: "Payback", hasShadow: false },
  { base: "urshifu", name: "Urshifu (Rapid Strike)", speciesId: "urshifu_rapid_strike", formBadge: "Rapid Strike", types: ["fighting", "water"], fastMove: "Counter", chargedMove1: "Aqua Jet", chargedMove2: "Close Combat", hasShadow: false }
];

export function extractBaseSpeciesKey(name: string, speciesId?: string, explicitBase?: string): string {
  if (explicitBase) return explicitBase.toLowerCase().trim();
  const cleanName = name
    .replace(/^Shadow\s+/i, "")
    .replace(/^Mega\s+/i, "")
    .replace(/^Primal\s+/i, "")
    .replace(/^(Alolan|Galarian|Hisuian|Paldean|Kanto|Johto|Hoenn|Sinnoh|Unova|Kalos)\s+/i, "")
    .replace(/\s+\([^)]+\)/g, "")
    .replace(/\s+(X|Y)$/i, "")
    .trim()
    .toLowerCase();
  if (cleanName) return cleanName;
  return (speciesId || "").split("_")[0].toLowerCase();
}

/**
 * Returns autocomplete options for the Team Builder UI.
 * When typing a base species name (e.g., "giratina", "ninetales", "feraligatr", "zacian", "groudon"),
 * returns the Base Form, all Alternate Forms (Alolan, Galarian, Hisuian, Origin, Crowned, Mega, Primal, etc.),
 * and Shadow variants so the user can pick any variant from the pop-down menu.
 */
export function getPokemonAutocompleteSuggestions(
  rawQuery: string,
  league: LeagueType = "GREAT LEAGUE",
  limit: number = 24
): PokemonAutocompleteOption[] {
  const query = (rawQuery || "").trim().toLowerCase();
  if (!query) return [];

  const isTypingShadow = query.startsWith("shadow") || query.includes(" shadow");
  const strippedQuery = query.replace(/^shadow\s*/i, "").trim();
  const searchToken = strippedQuery || query;

  // Build unified pool of species from POKEMON_DATABASE + BUILTIN_REGIONAL_ALTERNATES
  const poolByName = new Map<string, PokemonAutocompleteOption>();

  const addOptionToPool = (opt: PokemonAutocompleteOption) => {
    const key = opt.name.toLowerCase();
    if (!poolByName.has(key)) {
      poolByName.set(key, opt);
    }
  };

  for (const p of Object.values(POKEMON_DATABASE)) {
    const isShadow = p.name.toLowerCase().startsWith("shadow ") || p.speciesId.toLowerCase().endsWith("_shadow");
    const baseSpecies = extractBaseSpeciesKey(p.name, p.speciesId, p.baseSpecies);
    const rec = getRecommendedMovesForPokemon(p.name, league);
    const isMegaOrPrimal = /^Mega\s+|^Primal\s+/i.test(p.name);
    const formBadge = isShadow
      ? p.formLabel
        ? `Shadow • ${p.formLabel}`
        : "Shadow"
      : p.formLabel
      ? p.formLabel
      : isMegaOrPrimal
      ? p.name.startsWith("Primal ")
        ? "Primal"
        : "Mega"
      : /^(Alolan|Galarian|Hisuian|Paldean)\s+/i.test(p.name)
      ? p.name.split(" ")[0]
      : "Base";

    const isAlternateForm = formBadge !== "Base" && formBadge !== "Shadow";

    addOptionToPool({
      name: p.name,
      speciesId: p.speciesId,
      baseSpecies,
      formBadge,
      types: p.types,
      cp: rec?.cp || 1500,
      fastMove: rec?.fastMove || p.defaultFastMove.name,
      chargedMove1: rec?.chargedMove1 || p.chargedMoves[0]?.name || "Charged 1",
      chargedMove2: rec?.chargedMove2 || p.chargedMoves[1]?.name || p.chargedMoves[0]?.name || "Charged 2",
      isShadow,
      isAlternateForm,
      score: rec?.score
    });

    // Also synthesize the Shadow option for non-Shadow, non-Mega/Primal Pokémon if not already in DB
    if (!isShadow && !isMegaOrPrimal) {
      const shadowName = `Shadow ${p.name}`;
      const shadowSpeciesId = `${p.speciesId}_shadow`;
      const shadowRec = getRecommendedMovesForPokemon(shadowName, league);
      addOptionToPool({
        name: shadowName,
        speciesId: shadowSpeciesId,
        baseSpecies,
        formBadge: p.formLabel ? `Shadow • ${p.formLabel}` : "Shadow",
        types: p.types,
        cp: shadowRec?.cp || rec?.cp || 1500,
        fastMove: shadowRec?.fastMove || rec?.fastMove || p.defaultFastMove.name,
        chargedMove1: shadowRec?.chargedMove1 || rec?.chargedMove1 || p.chargedMoves[0]?.name || "Charged 1",
        chargedMove2:
          shadowRec?.chargedMove2 ||
          rec?.chargedMove2 ||
          p.chargedMoves[1]?.name ||
          p.chargedMoves[0]?.name ||
          "Charged 2",
        isShadow: true,
        isAlternateForm,
        score: shadowRec?.score
      });
    }
  }

  for (const alt of BUILTIN_REGIONAL_ALTERNATES) {
    const defaultCp = league === "GREAT LEAGUE" ? 1496 : league === "ULTRA LEAGUE" ? 2492 : 3450;
    addOptionToPool({
      name: alt.name,
      speciesId: alt.speciesId,
      baseSpecies: alt.base,
      formBadge: alt.formBadge,
      types: alt.types,
      cp: defaultCp,
      fastMove: alt.fastMove,
      chargedMove1: alt.chargedMove1,
      chargedMove2: alt.chargedMove2,
      isShadow: false,
      isAlternateForm: alt.formBadge !== "Kanto" && alt.formBadge !== "Johto" && alt.formBadge !== "Unova" && alt.formBadge !== "Alola"
    });
    if (alt.hasShadow) {
      addOptionToPool({
        name: `Shadow ${alt.name}`,
        speciesId: `${alt.speciesId}_shadow`,
        baseSpecies: alt.base,
        formBadge: `Shadow • ${alt.formBadge}`,
        types: alt.types,
        cp: defaultCp,
        fastMove: alt.fastMove,
        chargedMove1: alt.chargedMove1,
        chargedMove2: alt.chargedMove2,
        isShadow: true,
        isAlternateForm: true
      });
    }
  }

  // 1. Identify all matched baseSpecies keys so typing a base form (e.g. "ninetales", "giratina", "feraligatr")
  // pulls in ALL alternate forms & Shadow options for that base species!
  // Strict disambiguation: "mew" must never pull in "mewtwo" and vice versa.
  const matchedBaseSpecies = new Set<string>();
  for (const opt of poolByName.values()) {
    const nameLower = opt.name.toLowerCase();
    const baseLower = opt.baseSpecies.toLowerCase();
    if (
      (searchToken === "mew" && baseLower === "mewtwo") ||
      (searchToken === "mewtwo" && baseLower === "mew")
    ) {
      continue;
    }
    if (
      baseLower.startsWith(searchToken) ||
      baseLower.includes(searchToken) ||
      nameLower.includes(searchToken)
    ) {
      matchedBaseSpecies.add(baseLower);
    }
  }

  const results: PokemonAutocompleteOption[] = [];
  for (const opt of poolByName.values()) {
    const baseLower = opt.baseSpecies.toLowerCase();
    if (
      (searchToken === "mew" && baseLower === "mewtwo") ||
      (searchToken === "mewtwo" && baseLower === "mew")
    ) {
      continue;
    }
    const inMatchedFamily = matchedBaseSpecies.has(baseLower);
    const directMatch = opt.name.toLowerCase().includes(query);
    if (!inMatchedFamily && !directMatch) continue;
    results.push(opt);
  }

  // Sort so exact/prefix base matches come first, grouping Base -> Alternate Forms -> Shadow Forms cleanly
  results.sort((a, b) => {
    const aBaseStarts = a.baseSpecies.startsWith(searchToken) ? 0 : 1;
    const bBaseStarts = b.baseSpecies.startsWith(searchToken) ? 0 : 1;
    if (aBaseStarts !== bBaseStarts) return aBaseStarts - bBaseStarts;

    if (a.baseSpecies !== b.baseSpecies) {
      return a.baseSpecies.localeCompare(b.baseSpecies);
    }

    // If user explicitly typed "shadow", show Shadow variants first within the family
    if (isTypingShadow) {
      if (a.isShadow !== b.isShadow) return a.isShadow ? -1 : 1;
    } else {
      // Otherwise show Base -> Alternate Forms -> Shadow Base -> Shadow Alternate
      if (a.isShadow !== b.isShadow) return a.isShadow ? 1 : -1;
    }

    if (a.isAlternateForm !== b.isAlternateForm) {
      return a.isAlternateForm ? 1 : -1;
    }

    return a.name.localeCompare(b.name);
  });

  return results.slice(0, limit);
}

/**
 * Resolves PvPoke recommended Fast Move, Charged Move 1, Charged Move 2, and default CP for a Pokémon name,
 * prioritizing live rankings JSON moves (moves.fastMoves & moves.chargedMoves) when available.
 */
export function getRecommendedMovesForPokemon(
  rawName: string,
  league: string = "GREAT LEAGUE",
  customIvs?: string
): {
  name: string;
  cp: number;
  fastMove: string;
  chargedMove1: string;
  chargedMove2: string;
  defaultIvs: string;
  score?: number;
} | null {
  const trimmed = (rawName || "").trim();
  if (!trimmed) return null;
  const rawClean = trimmed.replace(/^Shadow\s+/i, "").replace(/\s*\(Shadow\)/i, "").trim();
  const aliasMap: Record<string, string> = {
    "zamazenta (crowned shield)": "Zamazenta (Crowned)",
    "zacian (crowned sword)": "Zacian (Crowned)",
    "zygarde (complete forme)": "Zygarde",
    "zygarde (complete)": "Zygarde",
    "keldeo": "Keldeo (Resolute)"
  };
  const cleanName = aliasMap[rawClean.toLowerCase()] || rawClean;
  const megaAlt = /^Mega\s+(.+?)(?:\s+([XY]))?$/i.test(cleanName)
    ? cleanName.replace(/^Mega\s+(.+?)(?:\s+([XY]))?$/i, (_, base, xy) => (xy ? `${base} (Mega ${xy.toUpperCase()})` : `${base} (Mega)`))
    : /^(.+?)\s*\(Mega(?:\s+([XY]))?\)$/i.test(cleanName)
    ? cleanName.replace(/^(.+?)\s*\(Mega(?:\s+([XY]))?\)$/i, (_, base, xy) => (xy ? `Mega ${base.trim()} ${xy.toUpperCase()}` : `Mega ${base.trim()}`))
    : "";
  const entries = Object.values(POKEMON_DATABASE);

  const exact =
    POKEMON_DATABASE[trimmed] ||
    POKEMON_DATABASE[cleanName] ||
    (megaAlt ? POKEMON_DATABASE[megaAlt] : undefined) ||
    entries.find(
      (p) =>
        p.name.toLowerCase() === trimmed.toLowerCase() ||
        p.name.toLowerCase() === cleanName.toLowerCase() ||
        (megaAlt && p.name.toLowerCase() === megaAlt.toLowerCase()) ||
        p.speciesId.toLowerCase() === cleanName.toLowerCase().replace(/\s+/g, "_")
    );

  if (!exact) {
    const builtinAlt = BUILTIN_REGIONAL_ALTERNATES.find(
      (a) => a.name.toLowerCase() === cleanName.toLowerCase()
    );
    if (builtinAlt) {
      const ivTuple = parseIvTriplet(customIvs, league);
      const cap = getLeagueCpCap(league);
      const defaultCp =
        cap === 500
          ? 498
          : cap === 1500
          ? 1496
          : cap === 2500
          ? 2492
          : 3450;
      return {
        name: trimmed.toLowerCase().startsWith("shadow ") ? `Shadow ${builtinAlt.name}` : builtinAlt.name,
        cp: defaultCp,
        fastMove: builtinAlt.fastMove,
        chargedMove1: builtinAlt.chargedMove1,
        chargedMove2: builtinAlt.chargedMove2,
        defaultIvs: `${ivTuple[0]}/${ivTuple[1]}/${ivTuple[2]}`
      };
    }
  }

  const partial =
    exact ||
    entries.find(
      (p) =>
        p.name.toLowerCase().includes(cleanName.toLowerCase()) ||
        (p.baseSpecies && cleanName.toLowerCase().includes(p.baseSpecies.toLowerCase()))
    );

  if (!partial) return null;

  const normLeague = normalizeLeagueName(league);
  const scaled = computeEffectiveStatsForLeague(partial, normLeague, undefined, customIvs);
  const ivTuple = parseIvTriplet(customIvs, normLeague);

  const leagueMap = LIVE_RANKINGS_MAP[normLeague] || LIVE_RANKINGS_MAP[league.toUpperCase()];
  const isShadowInput = trimmed.toLowerCase().startsWith("shadow ");
  const rankingEntry = isShadowInput
    ? leagueMap?.get(`${partial.speciesId.toLowerCase()}_shadow`) ||
      leagueMap?.get(partial.speciesId.toLowerCase())
    : leagueMap?.get(partial.speciesId.toLowerCase()) ||
      leagueMap?.get(`${partial.speciesId.toLowerCase()}_shadow`);

  const isSkeledirge =
    !isBattleFrontierLeague(normLeague) &&
    (partial.baseSpecies?.toLowerCase() === "skeledirge" ||
      partial.speciesId.toLowerCase().startsWith("skeledirge"));

  const topFastId = rankingEntry?.moveset?.[0] || rankingEntry?.moves.fastMoves[0]?.moveId;
  const orderedChargedNames: string[] = [];
  if (rankingEntry?.moveset && rankingEntry.moveset.length > 1) {
    for (const mId of rankingEntry.moveset.slice(1)) {
      const formatted = formatMoveIdToDisplayName(mId);
      if (formatted && !formatted.endsWith("+") && !orderedChargedNames.some((n) => n.toLowerCase() === formatted.toLowerCase())) {
        orderedChargedNames.push(formatted);
      }
    }
  }
  if (rankingEntry?.moves.chargedMoves) {
    for (const cm of rankingEntry.moves.chargedMoves) {
      const formatted = formatMoveIdToDisplayName(cm.moveId);
      if (formatted && !formatted.endsWith("+") && !orderedChargedNames.some((n) => n.toLowerCase() === formatted.toLowerCase())) {
        orderedChargedNames.push(formatted);
      }
    }
  }

  const resolvedFast = topFastId
    ? formatMoveIdToDisplayName(topFastId)
    : scaled.defaultFastMove?.name || partial.defaultFastMove?.name || "Fast Move";
  const resolvedC1 = isSkeledirge
    ? "Torch Song"
    : orderedChargedNames[0] || scaled.chargedMoves[0]?.name || partial.chargedMoves[0]?.name || "Charged 1";
  const resolvedC2 = isSkeledirge
    ? "Shadow Ball"
    : orderedChargedNames[1] ||
      scaled.chargedMoves[1]?.name ||
      partial.chargedMoves[1]?.name ||
      partial.chargedMoves[0]?.name ||
      "Charged 2";

  const finalDisplayName =
    isShadowInput && !partial.name.toLowerCase().startsWith("shadow ")
      ? `Shadow ${partial.name}`
      : partial.name;

  return {
    name: finalDisplayName,
    cp: scaled.resolvedCp,
    fastMove: resolvedFast,
    chargedMove1: resolvedC1,
    chargedMove2: resolvedC2,
    defaultIvs: `${ivTuple[0]}/${ivTuple[1]}/${ivTuple[2]}`,
    score: rankingEntry?.score
  };
}

/**
 * Returns the PvPoke Top 3 rated Pokémon template for a given league.
 */
export function getLeagueTop3Template(
  league: LeagueType
): TeamMember[] {
  const normLeague = normalizeLeagueName(league);
  if (normLeague === "Battle Frontier (Spectral)") {
    return [
      {
        id: "bfs1",
        name: "Ninetales (Alolan)",
        cp: 1495,
        fastMove: "Powder Snow",
        chargedMove1: "Weather Ball (Ice)",
        chargedMove2: "Psyshock"
      },
      {
        id: "bfs2",
        name: "Weezing (Galarian)",
        cp: 1498,
        fastMove: "Fairy Wind",
        chargedMove1: "Sludge",
        chargedMove2: "Brutal Swing"
      },
      {
        id: "bfs3",
        name: "Dewgong",
        cp: 1496,
        fastMove: "Ice Shard",
        chargedMove1: "Icy Wind",
        chargedMove2: "Drill Run"
      }
    ];
  }
  if (normLeague === "Battle Frontier (Cauldron)") {
    return [
      {
        id: "bfc1",
        name: "Muk (Alolan)",
        cp: 2497,
        fastMove: "Poison Jab",
        chargedMove1: "Brutal Swing",
        chargedMove2: "Ice Punch"
      },
      {
        id: "bfc2",
        name: "Talonflame",
        cp: 2493,
        fastMove: "Incinerate",
        chargedMove1: "Fly",
        chargedMove2: "Brave Bird"
      },
      {
        id: "bfc3",
        name: "Moltres (Galarian)",
        cp: 2496,
        fastMove: "Sucker Punch",
        chargedMove1: "Fly",
        chargedMove2: "Brave Bird"
      }
    ];
  }
  if (normLeague === "Battle Frontier (Master)") {
    return [
      {
        id: "bfm1",
        name: "Giratina (Altered)",
        cp: 3820,
        fastMove: "Dragon Breath",
        chargedMove1: "Dragon Claw",
        chargedMove2: "Shadow Force"
      },
      {
        id: "bfm2",
        name: "Zekrom",
        cp: 4565,
        fastMove: "Dragon Breath",
        chargedMove1: "Outrage",
        chargedMove2: "Fusion Bolt"
      },
      {
        id: "bfm3",
        name: "Dialga (Origin)",
        cp: 4624,
        fastMove: "Dragon Breath",
        chargedMove1: "Roar of Time",
        chargedMove2: "Iron Head"
      }
    ];
  }
  if (normLeague === "MEGA MASTER LEAGUE") {
    return [
      {
        id: "m1",
        name: "Mega Rayquaza",
        cp: 5728,
        fastMove: "Dragon Tail",
        chargedMove1: "Breaking Swipe",
        chargedMove2: "Dragon Ascent"
      },
      {
        id: "m2",
        name: "Palkia (Origin)",
        cp: 4683,
        fastMove: "Dragon Breath",
        chargedMove1: "Spacial Rend",
        chargedMove2: "Aqua Tail"
      },
      {
        id: "m3",
        name: "Zacian (Crowned)",
        cp: 4658,
        fastMove: "Metal Claw",
        chargedMove1: "Behemoth Blade",
        chargedMove2: "Close Combat"
      }
    ];
  }
  if (normLeague === "GREAT LEAGUE") {
    return [
      {
        id: "g1",
        name: "Clodsire",
        cp: 1494,
        fastMove: "Poison Sting",
        chargedMove1: "Earthquake",
        chargedMove2: "Stone Edge"
      },
      {
        id: "g2",
        name: "Feraligatr",
        cp: 1498,
        fastMove: "Shadow Claw",
        chargedMove1: "Hydro Cannon",
        chargedMove2: "Ice Beam"
      },
      {
        id: "g3",
        name: "Mandibuzz",
        cp: 1496,
        fastMove: "Snarl",
        chargedMove1: "Dark Pulse",
        chargedMove2: "Aerial Ace"
      }
    ];
  }
  if (normLeague === "ULTRA LEAGUE") {
    return [
      {
        id: "u1",
        name: "Zygarde",
        cp: 2472,
        fastMove: "Dragon Tail",
        chargedMove1: "Crunch",
        chargedMove2: "Earthquake"
      },
      {
        id: "u2",
        name: "Feraligatr",
        cp: 2488,
        fastMove: "Shadow Claw",
        chargedMove1: "Hydro Cannon",
        chargedMove2: "Ice Beam"
      },
      {
        id: "u3",
        name: "Giratina (Altered)",
        cp: 2497,
        fastMove: "Shadow Claw",
        chargedMove1: "Dragon Claw",
        chargedMove2: "Ancient Power"
      }
    ];
  }
  if (normLeague !== "MASTER LEAGUE") {
    const topNames = getLeagueTopMetaSpeciesNames(normLeague, 15);
    const dynamicTriad: TeamMember[] = [];
    const seenBases = new Set<string>();
    let hasMega = false;
    const fallbackCp = getLeagueCpCap(normLeague) === 500 ? 498 : getLeagueCpCap(normLeague) === 2500 ? 2495 : getLeagueCpCap(normLeague) === 10000 ? 4200 : 1498;
    for (const spName of topNames) {
      if (dynamicTriad.length >= 3) break;
      const rec = getRecommendedMovesForPokemon(spName, normLeague);
      const resolvedName = rec?.name || spName;
      if (isMegaOrPrimalSpecies(resolvedName)) {
        if (hasMega) continue;
      }
      const dbEntry = POKEMON_DATABASE[resolvedName];
      const baseKey = extractBaseSpeciesKey(resolvedName, dbEntry?.speciesId, dbEntry?.baseSpecies);
      if (seenBases.has(baseKey)) continue;
      seenBases.add(baseKey);
      if (isMegaOrPrimalSpecies(resolvedName)) hasMega = true;
      dynamicTriad.push({
        id: `lm-${dynamicTriad.length + 1}`,
        name: resolvedName,
        cp: rec?.cp || fallbackCp,
        fastMove: rec?.fastMove || "Quick Attack",
        chargedMove1: rec?.chargedMove1 || "Body Slam",
        chargedMove2: rec?.chargedMove2 || "Surf",
        ivs: rec?.defaultIvs
      });
    }
    if (dynamicTriad.length === 3) {
      return dynamicTriad;
    }
  }
  return [
    {
      id: "p1",
      name: "Palkia (Origin)",
      cp: 4683,
      fastMove: "Dragon Breath",
      chargedMove1: "Spacial Rend",
      chargedMove2: "Aqua Tail"
    },
    {
      id: "p2",
      name: "Zacian (Crowned)",
      cp: 4658,
      fastMove: "Metal Claw",
      chargedMove1: "Behemoth Blade",
      chargedMove2: "Close Combat"
    },
    {
      id: "p3",
      name: "Dialga (Origin)",
      cp: 4624,
      fastMove: "Dragon Breath",
      chargedMove1: "Roar of Time",
      chargedMove2: "Iron Head"
    }
  ];
}

