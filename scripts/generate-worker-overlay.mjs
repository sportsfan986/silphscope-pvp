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

// 3. Parse RECOMMENDED_CHARGED_MOVES and COMMON_THIRD_CHARGED_MOVE
const recCharged = {};
const recRegex = /"([^"]+)"\s+to\s+Triple\("([^"]+)",\s*"([^"]+)",\s*"([^"]+)"\)/g;
while ((m = recRegex.exec(ktSrc)) !== null) {
  recCharged[m[1].trim().toLowerCase()] = [m[2].trim(), m[3].trim(), m[4].trim()];
}
const thirdCharged = extractKtMap("val COMMON_THIRD_CHARGED_MOVE");

// 4. Parse POKEMON_META_DATABASE from PokemonDatabase.kt
const speciesMap = {};
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

  const entry = {
    name,
    speciesId,
    baseSpecies,
    formLabel,
    types: types.length ? types : ["normal"],
    defaultCp,
    fastMove,
    fastTurns,
    c1,
    c2,
    c3,
    atk,
    def,
    hp
  };
  speciesMap[name.toLowerCase()] = entry;
  speciesMap[speciesId.toLowerCase()] = entry;
  if (!speciesMap[baseSpecies.toLowerCase()]) {
    speciesMap[baseSpecies.toLowerCase()] = entry;
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

const compactDb = {
  species: speciesMap,
  fastMoves,
  chargedMoves
};

const output = `// Auto-generated by scripts/generate-worker-overlay.mjs — DO NOT EDIT MANUALLY
export const OVERLAY_HTML = ${JSON.stringify(overlayHtml)};
export const COMPACT_PVP_DB = ${JSON.stringify(compactDb)};
`;

fs.writeFileSync(outPath, output, "utf8");
console.log(
  `Generated ${outPath}: OVERLAY_HTML=${overlayHtml.length} chars, species=${Object.keys(speciesMap).length}, fastMoves=${Object.keys(fastMoves).length}, chargedMoves=${Object.keys(chargedMoves).length}`
);
