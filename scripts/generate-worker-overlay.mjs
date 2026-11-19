import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const overlayHtmlPath = path.join(rootDir, "app", "src", "main", "assets", "overlay.html");
const ktDbPath = path.join(rootDir, "app", "src", "main", "java", "com", "gbl", "overlay", "PokemonDatabase.kt");
const tsDbPath = path.join(rootDir, "src", "data", "pokemonDb.ts");
const outPath = path.join(rootDir, "cloudflare", "telemetry-worker", "overlay-asset.mjs");

const overlayHtml = fs.readFileSync(overlayHtmlPath, "utf8");
const ktSrc = fs.readFileSync(ktDbPath, "utf8");
const tsSrc = fs.readFileSync(tsDbPath, "utf8");

// 1. Parse MOVE_DATABASE from PokemonDatabase.kt
const chargedMoves = {};
const moveRegex = /"([^"]+)"\s+to\s+MoveStats\("([^"]+)",\s*"([^"]+)",\s*(\d+),\s*(\d+)\)/g;
let m;
while ((m = moveRegex.exec(ktSrc)) !== null) {
  const key = m[1].trim().toLowerCase();
  chargedMoves[key] = {
    name: m[2].trim(),
    type: m[3].trim().toLowerCase(),
    power: Number(m[4]),
    energy: Number(m[5])
  };
}

// Also parse MOVE_ENERGY_COST fallback from PokemonDatabase.kt
const energyCostBlockMatch = ktSrc.match(/val MOVE_ENERGY_COST:\s*Map<String,\s*Int>\s*=\s*mapOf\(([\s\S]*?)\n\s*\)/);
if (energyCostBlockMatch) {
  const costRegex = /"([^"]+)"\s+to\s+(\d+)/g;
  let cm;
  while ((cm = costRegex.exec(energyCostBlockMatch[1])) !== null) {
    const k = cm[1].trim().toLowerCase();
    if (!chargedMoves[k]) {
      chargedMoves[k] = {
        name: cm[1].trim(),
        type: "normal",
        power: 80,
        energy: Number(cm[2])
      };
    }
  }
}

// 2. Parse fast moves from PokemonDatabase.kt
const fastMoves = {};
function extractKtMap(blockName) {
  const re = new RegExp(`${blockName}[^=]*=\\s*mapOf(?:<[^>]+>)?\\(([\\s\\S]*?)\\n\\s*\\)`);
  const match = ktSrc.match(re);
  if (!match) return {};
  const out = {};
  const itemRe = /"([^"]+)"\s+to\s+(?:"([^"]+)"|(\d+))/g;
  let im;
  while ((im = itemRe.exec(match[1])) !== null) {
    out[im[1].trim().toLowerCase()] = im[2] !== undefined ? im[2] : Number(im[3]);
  }
  return out;
}

const fastTurnsMap = extractKtMap("val FAST_MOVE_TURNS");
const fastEnergyMap = extractKtMap("val FAST_MOVE_ENERGY");
const fastPowerMap = extractKtMap("val fastMovePowerMapStatic");
const fastTypeMap = extractKtMap("val fastMoveTypeMapStatic");

for (const k of new Set([
  ...Object.keys(fastTurnsMap),
  ...Object.keys(fastEnergyMap),
  ...Object.keys(fastPowerMap),
  ...Object.keys(fastTypeMap)
])) {
  const turns = fastTurnsMap[k] || 2;
  fastMoves[k] = {
    turns,
    energy: fastEnergyMap[k] || Math.max(3, turns * 4),
    power: fastPowerMap[k] !== undefined ? fastPowerMap[k] : Math.max(3, turns * 3),
    type: fastTypeMap[k] || "normal"
  };
}

// 3. Parse RECOMMENDED_CHARGED_MOVES, COMMON_THIRD_CHARGED_MOVE, and species charged move pools
const recCharged = {};
const recRegex = /"([^"]+)"\s+to\s+Triple\("([^"]+)",\s*"([^"]+)",\s*"([^"]+)"\)/g;
while ((m = recRegex.exec(ktSrc)) !== null) {
  recCharged[m[1].trim().toLowerCase()] = [m[2].trim(), m[3].trim(), m[4].trim()];
}
const thirdCharged = extractKtMap("val COMMON_THIRD_CHARGED_MOVE");

const speciesChargedPoolMap = {};
const tsPoolBlockMatch = tsSrc.match(/export const SPECIES_CHARGED_MOVES_POOL:\s*Record<string,\s*string\[\]>\s*=\s*\{([\s\S]*?)\n\};/);
if (tsPoolBlockMatch) {
  const lineRe = /^\s*([a-zA-Z0-9_]+|"[^"]+")\s*:\s*\[([^\]]*)\]/gm;
  let pm;
  while ((pm = lineRe.exec(tsPoolBlockMatch[1])) !== null) {
    const rawKey = pm[1].replace(/"/g, "").trim().toLowerCase();
    const moves = pm[2]
      .split(",")
      .map((s) => s.replace(/"/g, "").trim())
      .filter(Boolean);
    if (moves.length > 0) {
      speciesChargedPoolMap[rawKey] = moves;
    }
  }
}
const ktFallbackPoolMatch = ktSrc.match(/val FALLBACK_SPECIES_CHARGED_POOL:\s*Map<String,\s*List<String>>\s*=\s*mapOf\(([\s\S]*?)\n\s*\)/);
if (ktFallbackPoolMatch) {
  const ktPoolRe = /"([^"]+)"\s+to\s+listOf\(([^)]*)\)/g;
  let km;
  while ((km = ktPoolRe.exec(ktFallbackPoolMatch[1])) !== null) {
    const rawKey = km[1].trim().toLowerCase();
    const moves = km[2]
      .split(",")
      .map((s) => s.replace(/"/g, "").trim())
      .filter(Boolean);
    if (moves.length > 0 && !speciesChargedPoolMap[rawKey]) {
      speciesChargedPoolMap[rawKey] = moves;
    }
  }
}

// 4. Parse STATIC_RELEASED_SHADOW_KEYS & POKEMON_META_DATABASE from PokemonDatabase.kt
const staticShadowSet = new Set();
const staticShadowMatch = ktSrc.match(/val STATIC_RELEASED_SHADOW_KEYS:\s*Set<String>\s*=\s*setOf\(([\s\S]*?)\n\s*\)/);
if (staticShadowMatch) {
  const skRe = /"([^"]+)"/g;
  let sm;
  while ((sm = skRe.exec(staticShadowMatch[1])) !== null) {
    staticShadowSet.add(sm[1].trim().toLowerCase());
  }
}

function computeShadowEligible(name, speciesId, formLabel) {
  const idLower = String(speciesId || "").toLowerCase().replace(/_shadow$/, "").trim();
  const nameLower = String(name || "").toLowerCase();
  if (idLower === "mewtwo_armored" || nameLower.includes("armored")) return false;
  if (
    idLower.includes("_mega") ||
    idLower.includes("_primal") ||
    nameLower.startsWith("mega ") ||
    nameLower.startsWith("primal ")
  ) {
    return false;
  }
  const idHyphen = idLower.replace(/-/g, "_");
  const cleanForm = String(formLabel || "").trim().toLowerCase();
  const formQualId =
    cleanForm && cleanForm !== "base" && cleanForm !== "shadow"
      ? `${idHyphen}_${cleanForm.replace(/[^a-z0-9]+/g, "_")}`
      : null;
  const cleanName = nameLower
    .replace(/^shadow\s+/, "")
    .replace(/\s*\(shadow\)$/, "")
    .trim();
  return Boolean(
    (idLower && staticShadowSet.has(idLower)) ||
      (idHyphen && staticShadowSet.has(idHyphen)) ||
      (formQualId && staticShadowSet.has(formQualId)) ||
      (cleanName && staticShadowSet.has(cleanName))
  );
}

const speciesMap = {};
const formsByBase = new Map();
const parsedEntries = [];
const pokeLineRegex = /PokemonMeta\(\s*"([^"]+)"\s*,\s*"([^"]+)"\s*,\s*"([^"]+)"\s*,\s*"([^"]+)"\s*,\s*listOf\(([^)]*)\)\s*,\s*(\d+)\s*,\s*"([^"]+)"\s*,\s*(\d+)\s*,\s*"([^"]+)"\s*,\s*"([^"]+)"\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*atk\s*=\s*([\d.]+)\s*,\s*def\s*=\s*([\d.]+)\s*,\s*hp\s*=\s*(\d+)([^)]*)\)/g;
while ((m = pokeLineRegex.exec(ktSrc)) !== null) {
  const name = m[1].trim();
  const speciesId = m[2].trim();
  const baseSpecies = m[3].trim();
  const formLabel = m[4].trim();
  const types = m[5]
    .split(",")
    .map((s) => s.replace(/"/g, "").trim().toLowerCase())
    .filter(Boolean);
  const defaultCp = Number(m[6]);
  const fastMove = m[7].trim();
  const fastTurns = Number(m[8]);
  let c1 = m[9].trim();
  let c2 = m[10].trim();
  const atk = Number(m[13]);
  const def = Number(m[14]);
  const hp = Number(m[15]);
  const rest = m[16] || "";
  const c3Match = rest.match(/chargedMove3\s*=\s*"([^"]*)"/);
  let c3 = c3Match ? c3Match[1].trim() : "";
  const c4Match = rest.match(/chargedMove4\s*=\s*"([^"]*)"/);
  const c4 = c4Match ? c4Match[1].trim() : "";

  const rec =
    recCharged[name.toLowerCase()] ||
    recCharged[speciesId.toLowerCase()] ||
    recCharged[baseSpecies.toLowerCase()];
  if (rec) {
    c1 = rec[0] || c1;
    c2 = rec[1] || c2;
    c3 = rec[2] || c3;
  }
  if (!c3) {
    c3 = thirdCharged[name.toLowerCase()] || thirdCharged[baseSpecies.toLowerCase()] || "";
  }

  const cleanSpeciesId = speciesId.toLowerCase().replace(/_shadow$/, "");
  const rawPool =
    speciesChargedPoolMap[speciesId.toLowerCase()] ||
    speciesChargedPoolMap[cleanSpeciesId] ||
    speciesChargedPoolMap[name.toLowerCase()] ||
    speciesChargedPoolMap[baseSpecies.toLowerCase()] ||
    [];
  const pool = [];
  for (const cand of [c1, c2, c3, c4, ...rawPool]) {
    const trimmed = (cand || "").trim();
    if (trimmed && !pool.some((p) => p.toLowerCase() === trimmed.toLowerCase())) {
      pool.push(trimmed);
    }
  }

  const baseKey = baseSpecies.toLowerCase();
  if (formLabel && formLabel.toLowerCase() !== "shadow") {
    if (!formsByBase.has(baseKey)) formsByBase.set(baseKey, []);
    const arr = formsByBase.get(baseKey);
    if (!arr.some((f) => f.toLowerCase() === formLabel.toLowerCase())) {
      arr.push(formLabel);
    }
  }

  const entry = {
    name,
    speciesId,
    baseSpecies,
    formLabel,
    shadowEligible: computeShadowEligible(name, speciesId, formLabel),
    forms: [formLabel || "Base"],
    types: types.length ? types : ["normal"],
    defaultCp,
    fastMove,
    fastTurns,
    c1,
    c2,
    c3,
    pool,
    atk,
    def,
    hp
  };
  parsedEntries.push(entry);
  speciesMap[name.toLowerCase()] = entry;
  speciesMap[speciesId.toLowerCase()] = entry;
  if (!speciesMap[baseKey]) {
    speciesMap[baseKey] = entry;
  }
}

for (const entry of parsedEntries) {
  const baseForms = formsByBase.get(entry.baseSpecies.toLowerCase());
  if (baseForms && baseForms.length > 0) {
    entry.forms = baseForms;
  }
}

// Also enrich from src/data/pokemonDb.tsChargedMove & FastMove definitions if any are missing
const tsChargedRegex = /\{\s*name:\s*"([^"]+)",\s*code:\s*"[^"]*",\s*type:\s*"([^"]+)",\s*power:\s*(\d+),\s*energyCost:\s*(\d+)\s*\}/g;
while ((m = tsChargedRegex.exec(tsSrc)) !== null) {
  const k = m[1].trim().toLowerCase();
  if (!chargedMoves[k]) {
    chargedMoves[k] = {
      name: m[1].trim(),
      type: m[2].trim().toLowerCase(),
      power: Number(m[3]),
      energy: Number(m[4])
    };
  }
}

// Supplement speciesMap with single-line JSON species definitions from src/data/pokemonDb.ts (e.g. Nidoking)
const tsJsonSpeciesRegex = /^\s*"([^"]+)":\s*(\{"speciesId":[^\n]+\}),?\s*$/gm;
while ((m = tsJsonSpeciesRegex.exec(tsSrc)) !== null) {
  try {
    const obj = JSON.parse(m[2]);
    if (!obj || !obj.name || !obj.speciesId) continue;
    const spName = String(obj.name).trim();
    const spId = String(obj.speciesId).trim();
    const baseSp = String(obj.baseSpecies || spId.replace(/_shadow$/, "")).trim();
    const formLbl = String(obj.formLabel || "Base").trim();
    const keyLower = spName.toLowerCase();
    const idLower = spId.toLowerCase();
    if (speciesMap[keyLower] || speciesMap[idLower]) continue;
    const chNames = Array.isArray(obj.chargedMoves) ? obj.chargedMoves.map((c) => String(c.name || "").trim()).filter(Boolean) : [];
    const pool = [...new Set([...chNames, ...(speciesChargedPoolMap[idLower] || speciesChargedPoolMap[keyLower] || [])])];
    const entry = {
      name: spName,
      speciesId: spId,
      baseSpecies: baseSp,
      formLabel: formLbl,
      shadowEligible: computeShadowEligible(spName, spId, formLbl),
      forms: [formLbl || "Base"],
      types: Array.isArray(obj.types) && obj.types.length ? obj.types.map((t) => String(t).toLowerCase()) : ["normal"],
      defaultCp: 1500,
      fastMove: obj.defaultFastMove?.name || "Tackle",
      fastTurns: Number(obj.defaultFastMove?.turns) || 2,
      c1: chNames[0] || "Body Slam",
      c2: chNames[1] || "Surf",
      c3: chNames[2] || "",
      pool,
      atk: Number(obj.baseStats?.atk) || 175,
      def: Number(obj.baseStats?.def) || 175,
      hp: Number(obj.baseStats?.hp) || 180
    };
    speciesMap[keyLower] = entry;
    speciesMap[idLower] = entry;
    if (!speciesMap[baseSp.toLowerCase()]) {
      speciesMap[baseSp.toLowerCase()] = entry;
    }
  } catch {}
}

const compactDb = {
  species: speciesMap,
  fastMoves,
  chargedMoves,
  shadowEligibleKeys: Array.from(staticShadowSet)
};

const output = `// Auto-generated by scripts/generate-worker-overlay.mjs — DO NOT EDIT MANUALLY
export const OVERLAY_HTML = ${JSON.stringify(overlayHtml)};
export const COMPACT_PVP_DB = ${JSON.stringify(compactDb)};
`;

fs.writeFileSync(outPath, output, "utf8");
console.log(
  `Generated ${outPath}: OVERLAY_HTML=${overlayHtml.length} chars, species=${Object.keys(speciesMap).length}, fastMoves=${Object.keys(fastMoves).length}, chargedMoves=${Object.keys(chargedMoves).length}`
);
