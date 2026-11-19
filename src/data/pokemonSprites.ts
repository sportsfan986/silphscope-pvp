import { findPokemonByName, lookupPokemonDex } from "./pokemonDb";

export const FAILED_SPRITE_URLS: Set<string> = new Set();

export function markSpriteUrlFailed(url: string): void {
  if (url) FAILED_SPRITE_URLS.add(url);
}

export interface PokemonSpriteSpec {
  slug: string;
  baseSlug: string;
  isShadow: boolean;
  dex?: number;
  primaryColor: string;
  monogram: string;
  miniUrls: string[];
  arenaUrls: string[];
}

const DEFAULT_OMITTED_FORM_SLUGS: Set<string> = new Set([
  "altered",
  "hero",
  "ordinary",
  "incarnate",
  "normal",
  "shield",
  "fullbelly",
  "full_belly",
  "singlestrike",
  "single_strike",
  "standard",
  "aria",
  "land",
  "confined",
  "midday",
  "baile",
  "overcast",
  "amped",
  "solo",
  "male",
  "average",
  "50",
  "50%",
  "west",
  "westsea",
  "west_sea",
  "plant",
  "kanto",
  "johto",
  "hoenn",
  "sinnoh",
  "unova",
  "kalos",
  "alola",
  "base",
  "armored",
  "apex"
]);

const FORM_SLUG_ALIASES: Record<string, string> = {
  alolan: "alola",
  alola: "alola",
  galarian: "galar",
  galar: "galar",
  hisuian: "hisui",
  hisui: "hisui",
  paldean: "paldea",
  paldea: "paldea",
  paldeacombat: "paldeacombat",
  paldeancombat: "paldeacombat",
  combat: "paldeacombat",
  paldeablaze: "paldeablaze",
  paldeanblaze: "paldeablaze",
  blaze: "paldeablaze",
  paldeaaqua: "paldeaaqua",
  paldeanaqua: "paldeaaqua",
  aqua: "paldeaaqua",
  galarianstandard: "galar",
  galarstandard: "galar",
  galarianzen: "galarzen",
  galarzen: "galarzen",
  crownedsword: "crowned",
  crownedshield: "crowned",
  crowned: "crowned",
  origin: "origin",
  complete: "complete",
  "10": "10",
  "10%": "10",
  black: "black",
  white: "white",
  duskmane: "duskmane",
  dawnwings: "dawnwings",
  ultra: "ultra",
  rapidstrike: "rapidstrike",
  hangry: "hangry",
  blade: "blade",
  defense: "defense",
  attack: "attack",
  speed: "speed",
  therian: "therian",
  resolute: "resolute",
  pirouette: "pirouette",
  sky: "sky",
  unbound: "unbound",
  ice: "ice",
  icerider: "ice",
  shadowrider: "shadow",
  midnight: "midnight",
  dusk: "dusk",
  pompom: "pompom",
  pau: "pau",
  sensu: "sensu",
  sunny: "sunshine",
  sunshine: "sunshine",
  rainy: "rainy",
  snowy: "snowy",
  trash: "trash",
  sandy: "sandy",
  wash: "wash",
  heat: "heat",
  frost: "frost",
  fan: "fan",
  mow: "mow",
  east: "east",
  eastsea: "east",
  lowkey: "lowkey",
  bloodmoon: "bloodmoon",
  wellspring: "wellspring",
  hearthflame: "hearthflame",
  cornerstone: "cornerstone",
  small: "small",
  large: "large",
  super: "super",
  female: "f",
  f: "f",
  zen: "zen",
  therianforme: "therian",
  originforme: "origin",
  megax: "megax",
  megay: "megay",
  mega: "mega",
  primal: "primal",
  school: "school",
  busted: "busted",
  gulping: "gulping",
  gorging: "gorging",
  noice: "noice",
  crownedform: "crowned"
};

const TYPE_PRIMARY_COLORS: Record<string, string> = {
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

function sanitizeAlnum(str: string): string {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function normalizeFormToken(rawForm: string, baseAlnum: string): string {
  const cleaned = rawForm
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['’.:\-_\s]/g, "");
  if (!cleaned) return "";

  if (cleaned === "shadow" && baseAlnum === "calyrex") return "shadow";
  if (DEFAULT_OMITTED_FORM_SLUGS.has(cleaned)) return "";

  if (cleaned === "sunny" && baseAlnum === "castform") return "sunny";
  if (cleaned === "sunny" && baseAlnum === "cherrim") return "sunshine";

  if (cleaned === "f" || cleaned === "female") {
    if (baseAlnum === "nidoran") return "f";
    if (
      baseAlnum === "meowstic" ||
      baseAlnum === "indeedee" ||
      baseAlnum === "basculegion" ||
      baseAlnum === "oinkologne" ||
      baseAlnum === "pyroar"
    ) {
      return "f";
    }
    return "";
  }

  return FORM_SLUG_ALIASES[cleaned] ?? cleaned;
}

export function resolveShowdownSpriteSlug(rawNameOrId: string): {
  slug: string;
  baseSlug: string;
  isShadow: boolean;
  cleanName: string;
} {
  let working = String(rawNameOrId || "").trim();
  if (!working) {
    return { slug: "", baseSlug: "", isShadow: false, cleanName: "" };
  }

  let isShadow = false;
  const isCalyrexShadowForm =
    /^(?:shadow\s+)?calyrex\s*\(\s*shadow(?:\s+rider)?\s*\)$/i.test(working) ||
    /^(?:shadow\s+)?calyrex[_\-\s]+shadow(?:[_\-\s]*rider)?(?:[_\-\s]+shadow)?$/i.test(working);
  if (/^shadow\s+/i.test(working)) {
    isShadow = true;
    working = working.replace(/^shadow\s+/i, "").trim();
  }
  if (/\s*\(shadow\)\s*$/i.test(working) && !isCalyrexShadowForm) {
    isShadow = true;
    working = working.replace(/\s*\(shadow\)\s*$/i, "").trim();
  }
  if (/_shadow$/i.test(working)) {
    if (!isCalyrexShadowForm) {
      isShadow = true;
      working = working.replace(/_shadow$/i, "").trim();
    } else if (/_shadow_shadow$/i.test(working)) {
      isShadow = true;
      working = working.replace(/_shadow$/i, "").trim();
    }
  }

  working = working
    .replace(/♀/g, " (Female)")
    .replace(/♂/g, " (Male)")
    .trim();

  const cleanName = working;

  // Handle underscore speciesId format (e.g. "moltres_galarian", "charizard_mega_x", "necrozma_dusk_mane")
  if (working.includes("_") && !working.includes(" ")) {
    const parts = working.toLowerCase().split("_").filter(Boolean);
    // Multi-word base species with underscores in PvPoke (ho_oh, porygon_z, tapu_fini, mr_mime, mr_rime, jangmo_o, kommo_o, hakamo_o, mime_jr, type_null, great_tusk, etc.)
    const twoWordBases = new Set([
      "ho_oh",
      "porygon_z",
      "mr_mime",
      "mr_rime",
      "mime_jr",
      "type_null",
      "jangmo_o",
      "hakamo_o",
      "kommo_o",
      "tapu_koko",
      "tapu_lele",
      "tapu_bulu",
      "tapu_fini",
      "great_tusk",
      "scream_tail",
      "brute_bonnet",
      "flutter_mane",
      "slither_wing",
      "sandy_shocks",
      "iron_treads",
      "iron_bundle",
      "iron_hands",
      "iron_jugulis",
      "iron_moth",
      "iron_thorns",
      "roaring_moon",
      "iron_valiant",
      "walking_wake",
      "iron_leaves",
      "gouging_fire",
      "raging_bolt",
      "iron_boulder",
      "iron_crown",
      "wo_chien",
      "chien_pao",
      "ting_lu",
      "chi_yu"
    ]);
    let basePartsCount = 1;
    if (parts.length >= 2 && twoWordBases.has(`${parts[0]}_${parts[1]}`)) {
      basePartsCount = 2;
    }
    const baseSlug = sanitizeAlnum(parts.slice(0, basePartsCount).join(""));
    const formRaw = parts.slice(basePartsCount).join("_");
    const formSlug = normalizeFormToken(formRaw, baseSlug);
    if (baseSlug === "nidoran" && (formRaw === "female" || formSlug === "f")) {
      return { slug: "nidoranf", baseSlug: "nidoranf", isShadow, cleanName };
    }
    if (baseSlug === "nidoran" && (formRaw === "male" || formRaw === "m")) {
      return { slug: "nidoranm", baseSlug: "nidoranm", isShadow, cleanName };
    }
    const slug = formSlug ? `${baseSlug}-${formSlug}` : baseSlug;
    return { slug, baseSlug, isShadow, cleanName };
  }

  // Handle Mega / Primal prefixes: "Mega Charizard X", "Mega Swampert", "Primal Groudon"
  const megaMatch = working.match(/^Mega\s+(.+?)(?:\s+(X|Y))?$/i);
  if (megaMatch) {
    const baseSlug = sanitizeAlnum(megaMatch[1]);
    const suffix = megaMatch[2] ? `mega${megaMatch[2].toLowerCase()}` : "mega";
    return { slug: `${baseSlug}-${suffix}`, baseSlug, isShadow, cleanName };
  }
  const primalMatch = working.match(/^Primal\s+(.+)$/i);
  if (primalMatch) {
    const baseSlug = sanitizeAlnum(primalMatch[1]);
    return { slug: `${baseSlug}-primal`, baseSlug, isShadow, cleanName };
  }

  // Handle prefix regionals/forms: "Alolan Ninetales", "Galarian Moltres", "Hisuian Sneasel", "Paldean Wooper", "Kanto Ninetales", "Origin Dialga"
  let formTokens: string[] = [];
  const prefixMatch = working.match(
    /^(Alolan|Galarian|Hisuian|Paldean|Kanto|Johto|Hoenn|Sinnoh|Unova|Kalos|Alola|Origin|Therian|Crowned|Armored)\s+(.+)$/i
  );
  if (prefixMatch) {
    formTokens.push(prefixMatch[1]);
    working = prefixMatch[2].trim();
  }

  // Handle parenthetical forms: "Moltres (Galarian)", "Tauros (Paldean Blaze)", "Nidoran (Female)"
  const parenMatch = working.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
  if (parenMatch) {
    working = parenMatch[1].trim();
    formTokens.push(parenMatch[2].trim());
  }

  const baseSlug = sanitizeAlnum(working);
  const combinedRawForm = formTokens.join("");

  if (baseSlug === "nidoran") {
    const fLower = combinedRawForm.toLowerCase();
    if (fLower.includes("female") || fLower === "f") {
      return { slug: "nidoranf", baseSlug: "nidoranf", isShadow, cleanName };
    }
    if (fLower.includes("male") || fLower === "m") {
      return { slug: "nidoranm", baseSlug: "nidoranm", isShadow, cleanName };
    }
  }

  // Special multi-form base adjustments (e.g. Urshifu Rapid Strike, Necrozma Dusk Mane, Calyrex Shadow)
  const formSlug = normalizeFormToken(combinedRawForm, baseSlug);
  const slug = formSlug ? `${baseSlug}-${formSlug}` : baseSlug;
  return { slug, baseSlug, isShadow, cleanName };
}

function dedupeNonEmpty(list: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of list) {
    if (item && !seen.has(item)) {
      seen.add(item);
      out.push(item);
    }
  }
  return out;
}

export function resolvePokemonSpriteSpec(
  rawNameOrId: string,
  explicitShadow?: boolean
): PokemonSpriteSpec {
  const { slug, baseSlug, isShadow: parsedShadow, cleanName } = resolveShowdownSpriteSlug(rawNameOrId);
  const isShadow = explicitShadow !== undefined ? explicitShadow || parsedShadow : parsedShadow;
  const dbEntry = findPokemonByName(rawNameOrId) || (cleanName ? findPokemonByName(cleanName) : undefined);
  const dex = dbEntry?.dex ?? lookupPokemonDex(rawNameOrId) ?? (cleanName ? lookupPokemonDex(cleanName) : undefined);

  const primaryType = dbEntry?.types?.[0]?.toLowerCase() || "";
  const primaryColor = dbEntry?.color || TYPE_PRIMARY_COLORS[primaryType] || "#38bdf8";

  const alphaOnly = cleanName.replace(/[^a-zA-Z0-9]/g, "");
  const monogram = alphaOnly ? alphaOnly.slice(0, 2).toUpperCase() : "?";

  const miniUrls = slug
    ? dedupeNonEmpty([
        `https://play.pokemonshowdown.com/sprites/dex/${slug}.png`,
        `https://play.pokemonshowdown.com/sprites/home/${slug}.png`,
        slug !== baseSlug ? `https://play.pokemonshowdown.com/sprites/dex/${baseSlug}.png` : "",
        dex && dex > 0
          ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/home/${dex}.png`
          : ""
      ])
    : [];

  const arenaUrls = slug
    ? dedupeNonEmpty([
        `https://play.pokemonshowdown.com/sprites/home/${slug}.png`,
        `https://play.pokemonshowdown.com/sprites/dex/${slug}.png`,
        slug !== baseSlug ? `https://play.pokemonshowdown.com/sprites/home/${baseSlug}.png` : "",
        dex && dex > 0
          ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/home/${dex}.png`
          : ""
      ])
    : [];

  return {
    slug,
    baseSlug,
    isShadow,
    dex,
    primaryColor,
    monogram,
    miniUrls,
    arenaUrls
  };
}
