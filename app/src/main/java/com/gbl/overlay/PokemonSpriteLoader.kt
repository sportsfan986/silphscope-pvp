package com.gbl.overlay

import android.content.Context
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.view.Gravity
import android.view.View
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.TextView
import coil.ImageLoader
import coil.disk.DiskCache
import coil.memory.MemoryCache
import coil.request.ErrorResult
import coil.request.ImageRequest
import coil.request.SuccessResult
import java.io.File
import java.text.Normalizer
import java.util.concurrent.ConcurrentHashMap

/**
 * Lightweight Coil-backed Pokémon sprite loader with Showdown HOME/Dex slug resolution,
 * National Dex PokeAPI fallback, type-colored monogram fallback, and Shadow aura/dot styling.
 */
object PokemonSpriteLoader {

    const val SPRITE_WIDGET_TAG: String = "pokemon_sprite_widget"

    data class SpriteSpec(
        val slug: String,
        val baseSlug: String,
        val isShadow: Boolean,
        val dex: Int,
        val primaryColor: Int,
        val monogram: String,
        val urls: List<String>
    )

    private val FAILED_URLS: MutableSet<String> = ConcurrentHashMap.newKeySet<String>()

    @Volatile
    private var cachedImageLoader: ImageLoader? = null

    private val DEFAULT_OMITTED_FORM_SLUGS: Set<String> = setOf(
        "altered", "hero", "ordinary", "incarnate", "normal", "shield",
        "fullbelly", "full_belly", "singlestrike", "single_strike", "standard",
        "aria", "land", "confined", "midday", "baile", "overcast", "amped",
        "solo", "male", "average", "50", "50%", "west", "westsea", "west_sea",
        "plant", "kanto", "johto", "hoenn", "sinnoh", "unova", "kalos",
        "alola", "base", "armored", "apex"
    )

    private val FORM_SLUG_ALIASES: Map<String, String> = mapOf(
        "alolan" to "alola",
        "alola" to "alola",
        "galarian" to "galar",
        "galar" to "galar",
        "hisuian" to "hisui",
        "hisui" to "hisui",
        "paldean" to "paldea",
        "paldea" to "paldea",
        "paldeacombat" to "paldeacombat",
        "paldeancombat" to "paldeacombat",
        "combat" to "paldeacombat",
        "paldeablaze" to "paldeablaze",
        "paldeanblaze" to "paldeablaze",
        "blaze" to "paldeablaze",
        "paldeaaqua" to "paldeaaqua",
        "paldeanaqua" to "paldeaaqua",
        "aqua" to "paldeaaqua",
        "galarianstandard" to "galar",
        "galarstandard" to "galar",
        "galarianzen" to "galarzen",
        "galarzen" to "galarzen",
        "crownedsword" to "crowned",
        "crownedshield" to "crowned",
        "crowned" to "crowned",
        "origin" to "origin",
        "complete" to "complete",
        "10" to "10",
        "10%" to "10",
        "black" to "black",
        "white" to "white",
        "duskmane" to "duskmane",
        "dawnwings" to "dawnwings",
        "ultra" to "ultra",
        "rapidstrike" to "rapidstrike",
        "hangry" to "hangry",
        "blade" to "blade",
        "defense" to "defense",
        "attack" to "attack",
        "speed" to "speed",
        "therian" to "therian",
        "resolute" to "resolute",
        "pirouette" to "pirouette",
        "sky" to "sky",
        "unbound" to "unbound",
        "ice" to "ice",
        "icerider" to "ice",
        "shadowrider" to "shadow",
        "midnight" to "midnight",
        "dusk" to "dusk",
        "pompom" to "pompom",
        "pau" to "pau",
        "sensu" to "sensu",
        "sunny" to "sunshine",
        "sunshine" to "sunshine",
        "rainy" to "rainy",
        "snowy" to "snowy",
        "trash" to "trash",
        "sandy" to "sandy",
        "wash" to "wash",
        "heat" to "heat",
        "frost" to "frost",
        "fan" to "fan",
        "mow" to "mow",
        "east" to "east",
        "eastsea" to "east",
        "lowkey" to "lowkey",
        "bloodmoon" to "bloodmoon",
        "wellspring" to "wellspring",
        "hearthflame" to "hearthflame",
        "cornerstone" to "cornerstone",
        "small" to "small",
        "large" to "large",
        "super" to "super",
        "female" to "f",
        "f" to "f",
        "zen" to "zen",
        "therianforme" to "therian",
        "originforme" to "origin",
        "megax" to "megax",
        "megay" to "megay",
        "mega" to "mega",
        "primal" to "primal",
        "school" to "school",
        "busted" to "busted",
        "gulping" to "gulping",
        "gorging" to "gorging",
        "noice" to "noice",
        "crownedform" to "crowned"
    )

    private val TWO_WORD_BASES: Set<String> = setOf(
        "ho_oh", "porygon_z", "mr_mime", "mr_rime", "mime_jr", "type_null",
        "jangmo_o", "hakamo_o", "kommo_o", "tapu_koko", "tapu_lele", "tapu_bulu", "tapu_fini",
        "great_tusk", "scream_tail", "brute_bonnet", "flutter_mane", "slither_wing", "sandy_shocks",
        "iron_treads", "iron_bundle", "iron_hands", "iron_jugulis", "iron_moth", "iron_thorns",
        "roaring_moon", "iron_valiant", "walking_wake", "iron_leaves", "gouging_fire",
        "raging_bolt", "iron_boulder", "iron_crown", "wo_chien", "chien_pao", "ting_lu", "chi_yu"
    )

    private val STATIC_SPECIES_DEX_MAP: Map<String, Int> = mapOf(
        "bulbasaur" to 1, "ivysaur" to 2, "venusaur" to 3, "charmander" to 4, "charmeleon" to 5,
        "charizard" to 6, "squirtle" to 7, "wartortle" to 8, "blastoise" to 9, "butterfree" to 12,
        "beedrill" to 15, "pidgeot" to 18, "fearow" to 22, "pikachu" to 25, "raichu" to 26,
        "sandshrew" to 27, "sandslash" to 28, "nidoranf" to 29, "nidoqueen" to 31, "nidoranm" to 32,
        "nidoking" to 34, "clefable" to 36, "ninetales" to 38, "wigglytuff" to 40, "golbat" to 42,
        "vileplume" to 45, "primeape" to 57, "arcanine" to 59, "poliwrath" to 62, "alakazam" to 65,
        "machamp" to 68, "victreebel" to 71, "tentacruel" to 73, "golem" to 76, "rapidash" to 78,
        "slowbro" to 80, "dewgong" to 87, "muk" to 89, "cloyster" to 91, "gengar" to 94,
        "hypno" to 97, "marowak" to 105, "hitmonlee" to 106, "hitmonchan" to 107, "lickitung" to 108,
        "weezing" to 110, "rhydon" to 112, "gyarados" to 130, "lapras" to 131, "snorlax" to 143,
        "articuno" to 144, "zapdos" to 145, "moltres" to 146, "dragonair" to 148, "dragonite" to 149,
        "mewtwo" to 150, "mew" to 151, "meganium" to 154, "typhlosion" to 157, "feraligatr" to 160,
        "noctowl" to 164, "lanturn" to 171, "ampharos" to 181, "azumarill" to 184, "politoed" to 186,
        "jumpluff" to 189, "quagsire" to 195, "umbreon" to 197, "slowking" to 199, "forretress" to 205,
        "dunsparce" to 206, "gligar" to 207, "steelix" to 208, "qwilfish" to 211, "scizor" to 212,
        "heracross" to 214, "skarmory" to 227, "kingdra" to 230, "raikou" to 243, "entei" to 244,
        "suicune" to 245, "tyranitar" to 248, "lugia" to 249, "hooh" to 250, "sceptile" to 254,
        "blaziken" to 257, "swampert" to 260, "pelipper" to 279, "gardevoir" to 282, "vigoroth" to 288,
        "sableye" to 302, "mawile" to 303, "aggron" to 306, "medicham" to 308, "altaria" to 334,
        "whiscash" to 340, "cradily" to 346, "milotic" to 350, "tropius" to 357, "walrein" to 365,
        "regirock" to 377, "regice" to 378, "registeel" to 379, "latias" to 380, "latios" to 381,
        "kyogre" to 382, "groudon" to 383, "rayquaza" to 384, "jirachi" to 385, "deoxys" to 386,
        "empoleon" to 395, "luxray" to 405, "bastiodon" to 411, "gastrodon" to 423, "drifblim" to 426,
        "bronzong" to 437, "garchomp" to 445, "lucario" to 448, "hippowdon" to 450, "drapion" to 452,
        "toxicroak" to 454, "abomasnow" to 460, "lickilicky" to 463, "rhyperior" to 464, "togekiss" to 468,
        "gliscor" to 472, "mamoswine" to 473, "gallade" to 475, "probopass" to 476, "dusknoir" to 477,
        "froslass" to 478, "dialga" to 483, "palkia" to 484, "heatran" to 485, "giratina" to 487,
        "cresselia" to 488, "serperior" to 497, "samurott" to 503, "excadrill" to 530, "conkeldurr" to 534,
        "whimsicott" to 547, "scrafty" to 560, "cofagrigus" to 563, "jellicent" to 593, "galvantula" to 596,
        "ferrothorn" to 598, "stunfisk" to 618, "mandibuzz" to 630, "hydreigon" to 635, "cobalion" to 638,
        "terrakion" to 639, "virizion" to 640, "tornadus" to 641, "thundurus" to 642, "reshiram" to 643,
        "zekrom" to 644, "landorus" to 645, "kyurem" to 646, "keldeo" to 647, "meloetta" to 648,
        "genesect" to 649, "chesnaught" to 652, "greninja" to 658, "diggersby" to 660, "talonflame" to 663,
        "florges" to 671, "malamar" to 687, "dragalge" to 691, "carbink" to 703, "goodra" to 706,
        "trevenant" to 709, "xerneas" to 716, "yveltal" to 717, "zygarde" to 718, "decidueye" to 724,
        "primarina" to 730, "vikavolt" to 738, "toxapex" to 748, "araquanid" to 752, "salazzle" to 758,
        "golisopod" to 768, "mimikyu" to 778, "tapukoko" to 785, "tapulele" to 786, "tapubulu" to 787,
        "tapufini" to 788, "solgaleo" to 791, "lunala" to 792, "necrozma" to 800, "melmetal" to 809,
        "rillaboom" to 812, "corviknight" to 823, "obstagoon" to 862, "perrserker" to 863, "runerigus" to 867,
        "morpeko" to 877, "zacian" to 888, "zamazenta" to 889, "eternatus" to 890, "urshifu" to 892,
        "zarude" to 893, "calyrex" to 898, "ursaluna" to 901, "sneasler" to 903, "enamorus" to 905,
        "skeledirge" to 911, "annihilape" to 979, "clodsire" to 980, "tinkaton" to 959, "gholdengo" to 1000
    )

    private val TYPE_PRIMARY_COLORS: Map<String, Int> = mapOf(
        "fire" to 0xFFF97316.toInt(),
        "water" to 0xFF3B82F6.toInt(),
        "grass" to 0xFF22C55E.toInt(),
        "electric" to 0xFFEAB308.toInt(),
        "ice" to 0xFF38BDF8.toInt(),
        "fighting" to 0xFFEF4444.toInt(),
        "poison" to 0xFFA855F7.toInt(),
        "ground" to 0xFFD97706.toInt(),
        "flying" to 0xFF60A5FA.toInt(),
        "psychic" to 0xFFEC4899.toInt(),
        "bug" to 0xFF84CC16.toInt(),
        "rock" to 0xFFB45309.toInt(),
        "ghost" to 0xFF8B5CF6.toInt(),
        "dragon" to 0xFF6366F1.toInt(),
        "dark" to 0xFF64748B.toInt(),
        "steel" to 0xFF94A3B8.toInt(),
        "fairy" to 0xFFF472B6.toInt(),
        "normal" to 0xFF9CA3AF.toInt()
    )

    private val DIACRITICS_REGEX = Regex("[\\u0300-\\u036f]")
    private val NON_ALNUM_REGEX = Regex("[^a-z0-9]")
    private val FORM_CLEAN_REGEX = Regex("['’.:\\-_\\s]")
    private val SHADOW_PREFIX_REGEX = Regex("^shadow\\s+", RegexOption.IGNORE_CASE)
    private val SHADOW_PAREN_SUFFIX_REGEX = Regex("\\s*\\(shadow\\)\\s*$", RegexOption.IGNORE_CASE)
    private val SHADOW_ID_SUFFIX_REGEX = Regex("_shadow$", RegexOption.IGNORE_CASE)
    private val CALYREX_SHADOW_PAREN_REGEX = Regex("^(?:shadow\\s+)?calyrex\\s*\\(\\s*shadow(?:\\s+rider)?\\s*\\)$", RegexOption.IGNORE_CASE)
    private val CALYREX_SHADOW_SLUG_REGEX = Regex("^(?:shadow\\s+)?calyrex[_\\-\\s]+shadow(?:[_\\-\\s]*rider)?(?:[_\\-\\s]+shadow)?$", RegexOption.IGNORE_CASE)
    private val CALYREX_DOUBLE_SHADOW_REGEX = Regex("_shadow_shadow$", RegexOption.IGNORE_CASE)
    private val MEGA_PREFIX_REGEX = Regex("^Mega\\s+(.+?)(?:\\s+(X|Y))?$", RegexOption.IGNORE_CASE)
    private val PRIMAL_PREFIX_REGEX = Regex("^Primal\\s+(.+)$", RegexOption.IGNORE_CASE)
    private val FORM_PREFIX_REGEX = Regex(
        "^(Alolan|Galarian|Hisuian|Paldean|Kanto|Johto|Hoenn|Sinnoh|Unova|Kalos|Alola|Origin|Therian|Crowned|Armored)\\s+(.+)$",
        RegexOption.IGNORE_CASE
    )
    private val PAREN_FORM_REGEX = Regex("^(.+?)\\s*\\(([^)]+)\\)\\s*$")

    private fun getImageLoader(context: Context): ImageLoader {
        cachedImageLoader?.let { return it }
        synchronized(this) {
            cachedImageLoader?.let { return it }
            val appCtx = context.applicationContext
            val loader = ImageLoader.Builder(appCtx)
                .diskCache {
                    DiskCache.Builder()
                        .directory(File(appCtx.cacheDir, "pokemon_sprites"))
                        .maxSizeBytes(40L * 1024L * 1024L)
                        .build()
                }
                .memoryCache {
                    MemoryCache.Builder(appCtx)
                        .maxSizePercent(0.15)
                        .build()
                }
                .respectCacheHeaders(false)
                .crossfade(100)
                .build()
            cachedImageLoader = loader
            return loader
        }
    }

    private fun sanitizeAlnum(str: String): String {
        val norm = Normalizer.normalize(str, Normalizer.Form.NFD)
        return DIACRITICS_REGEX.replace(norm, "")
            .lowercase()
            .replace(NON_ALNUM_REGEX, "")
    }

    private fun normalizeFormToken(rawForm: String, baseAlnum: String): String {
        val norm = Normalizer.normalize(rawForm, Normalizer.Form.NFD)
        val cleaned = DIACRITICS_REGEX.replace(norm, "")
            .lowercase()
            .replace(FORM_CLEAN_REGEX, "")
        if (cleaned.isEmpty()) return ""

        if (cleaned == "shadow" && baseAlnum == "calyrex") return "shadow"
        if (DEFAULT_OMITTED_FORM_SLUGS.contains(cleaned)) return ""

        if (cleaned == "sunny" && baseAlnum == "castform") return "sunny"
        if (cleaned == "sunny" && baseAlnum == "cherrim") return "sunshine"

        if (cleaned == "f" || cleaned == "female") {
            if (baseAlnum == "nidoran") return "f"
            if (baseAlnum == "meowstic" ||
                baseAlnum == "indeedee" ||
                baseAlnum == "basculegion" ||
                baseAlnum == "oinkologne" ||
                baseAlnum == "pyroar"
            ) {
                return "f"
            }
            return ""
        }

        return FORM_SLUG_ALIASES[cleaned] ?: cleaned
    }

    private fun lookupMetaAndDex(rawName: String, cleanName: String, baseSlug: String): Pair<OverlayService.Companion.PokemonMeta?, Int> {
        val candidates = listOf(rawName.trim(), cleanName.trim())
        var matchedMeta: OverlayService.Companion.PokemonMeta? = null
        val combined = OverlayService.DYNAMIC_POKEMON_DATABASE + OverlayService.POKEMON_META_DATABASE
        for (cand in candidates) {
            if (cand.isEmpty()) continue
            val m = combined.firstOrNull {
                it.name.equals(cand, ignoreCase = true) ||
                    it.speciesId.equals(cand, ignoreCase = true)
            }
            if (m != null) {
                matchedMeta = m
                break
            }
        }
        val dexFromMeta = matchedMeta?.dex?.takeIf { it > 0 } ?: 0
        if (dexFromMeta > 0) return matchedMeta to dexFromMeta

        val dynMap = OverlayService.DYNAMIC_SPECIES_DEX_MAP
        val dynDex = dynMap[rawName.trim().lowercase()]
            ?: dynMap[cleanName.trim().lowercase()]
            ?: dynMap[baseSlug]
            ?: 0
        if (dynDex > 0) return matchedMeta to dynDex

        val staticDex = STATIC_SPECIES_DEX_MAP[baseSlug] ?: 0
        return matchedMeta to staticDex
    }

    fun resolveSpriteSpec(rawNameOrId: String, explicitShadow: Boolean? = null): SpriteSpec {
        var working = rawNameOrId.trim()
        if (working.isEmpty()) {
            return SpriteSpec("", "", explicitShadow == true, 0, 0xFF38BDF8.toInt(), "?", emptyList())
        }

        var isShadow = false
        val isCalyrexShadowForm =
            CALYREX_SHADOW_PAREN_REGEX.matches(working) || CALYREX_SHADOW_SLUG_REGEX.matches(working)
        if (SHADOW_PREFIX_REGEX.containsMatchIn(working)) {
            isShadow = true
            working = SHADOW_PREFIX_REGEX.replace(working, "").trim()
        }
        if (SHADOW_PAREN_SUFFIX_REGEX.containsMatchIn(working) && !isCalyrexShadowForm) {
            isShadow = true
            working = SHADOW_PAREN_SUFFIX_REGEX.replace(working, "").trim()
        }
        if (SHADOW_ID_SUFFIX_REGEX.containsMatchIn(working)) {
            if (!isCalyrexShadowForm) {
                isShadow = true
                working = SHADOW_ID_SUFFIX_REGEX.replace(working, "").trim()
            } else if (CALYREX_DOUBLE_SHADOW_REGEX.containsMatchIn(working)) {
                isShadow = true
                working = SHADOW_ID_SUFFIX_REGEX.replace(working, "").trim()
            }
        }

        working = working
            .replace("♀", " (Female)")
            .replace("♂", " (Male)")
            .trim()
        val cleanName = working

        var slug: String
        var baseSlug: String

        if (working.contains("_") && !working.contains(" ")) {
            val parts = working.lowercase().split("_").filter { it.isNotEmpty() }
            val basePartsCount = if (parts.size >= 2 && TWO_WORD_BASES.contains("${parts[0]}_${parts[1]}")) 2 else 1
            baseSlug = sanitizeAlnum(parts.take(basePartsCount).joinToString(""))
            val formRaw = parts.drop(basePartsCount).joinToString("_")
            val formSlug = normalizeFormToken(formRaw, baseSlug)
            if (baseSlug == "nidoran" && (formRaw == "female" || formSlug == "f")) {
                slug = "nidoranf"
                baseSlug = "nidoranf"
            } else if (baseSlug == "nidoran" && (formRaw == "male" || formSlug == "m")) {
                slug = "nidoranm"
                baseSlug = "nidoranm"
            } else {
                slug = if (formSlug.isNotEmpty()) "$baseSlug-$formSlug" else baseSlug
            }
        } else {
            val megaMatch = MEGA_PREFIX_REGEX.matchEntire(working)
            val primalMatch = PRIMAL_PREFIX_REGEX.matchEntire(working)
            if (megaMatch != null) {
                baseSlug = sanitizeAlnum(megaMatch.groupValues[1])
                val xy = megaMatch.groupValues.getOrNull(2).orEmpty().lowercase()
                val suffix = if (xy.isNotEmpty()) "mega$xy" else "mega"
                slug = "$baseSlug-$suffix"
            } else if (primalMatch != null) {
                baseSlug = sanitizeAlnum(primalMatch.groupValues[1])
                slug = "$baseSlug-primal"
            } else {
                val formTokens = mutableListOf<String>()
                var remainder = working
                val prefixMatch = FORM_PREFIX_REGEX.matchEntire(remainder)
                if (prefixMatch != null) {
                    formTokens.add(prefixMatch.groupValues[1])
                    remainder = prefixMatch.groupValues[2].trim()
                }
                val parenMatch = PAREN_FORM_REGEX.matchEntire(remainder)
                if (parenMatch != null) {
                    remainder = parenMatch.groupValues[1].trim()
                    formTokens.add(parenMatch.groupValues[2].trim())
                }
                baseSlug = sanitizeAlnum(remainder)
                val combinedRawForm = formTokens.joinToString("")
                if (baseSlug == "nidoran") {
                    val fLower = combinedRawForm.lowercase()
                    if (fLower.contains("female") || fLower == "f") {
                        slug = "nidoranf"
                        baseSlug = "nidoranf"
                    } else if (fLower.contains("male") || fLower == "m") {
                        slug = "nidoranm"
                        baseSlug = "nidoranm"
                    } else {
                        slug = baseSlug
                    }
                } else {
                    val formSlug = normalizeFormToken(combinedRawForm, baseSlug)
                    slug = if (formSlug.isNotEmpty()) "$baseSlug-$formSlug" else baseSlug
                }
            }
        }

        val finalShadow = explicitShadow?.let { it || isShadow } ?: isShadow
        val (meta, dex) = lookupMetaAndDex(rawNameOrId, cleanName, baseSlug)
        val primaryType = meta?.types?.firstOrNull()?.lowercase().orEmpty()
        val primaryColor = TYPE_PRIMARY_COLORS[primaryType] ?: 0xFF38BDF8.toInt()
        val alphaOnly = cleanName.replace(Regex("[^a-zA-Z0-9]"), "")
        val monogram = if (alphaOnly.isNotEmpty()) alphaOnly.take(2).uppercase() else "?"

        val urls = linkedSetOf<String>()
        if (slug.isNotEmpty()) {
            urls.add("https://play.pokemonshowdown.com/sprites/dex/$slug.png")
            urls.add("https://play.pokemonshowdown.com/sprites/home/$slug.png")
            if (slug != baseSlug && baseSlug.isNotEmpty()) {
                urls.add("https://play.pokemonshowdown.com/sprites/dex/$baseSlug.png")
            }
        }
        if (dex > 0) {
            urls.add("https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/home/$dex.png")
        }

        return SpriteSpec(
            slug = slug,
            baseSlug = baseSlug,
            isShadow = finalShadow,
            dex = dex,
            primaryColor = primaryColor,
            monogram = monogram,
            urls = urls.toList()
        )
    }

    fun createSpriteView(
        context: Context,
        rawName: String,
        sizeDp: Int,
        isShadowOverride: Boolean? = null
    ): FrameLayout {
        val density = context.resources.displayMetrics.density
        val sizePx = (sizeDp * density).toInt().coerceAtLeast(1)

        val container = FrameLayout(context).apply {
            tag = SPRITE_WIDGET_TAG
            layoutParams = FrameLayout.LayoutParams(sizePx, sizePx)
            clipChildren = false
            clipToPadding = false
        }

        // Child 0: Subtle purple radial aura for Shadow Pokémon
        val shadowGlow = View(context).apply {
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )
            background = GradientDrawable().apply {
                gradientType = GradientDrawable.RADIAL_GRADIENT
                gradientRadius = (sizePx * 0.55f).coerceAtLeast(8f)
                colors = intArrayOf(0x99A855F7.toInt(), 0x00A855F7)
            }
            visibility = View.GONE
        }

        // Child 1: Sprite ImageView loaded via Coil
        val imageView = ImageView(context).apply {
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )
            scaleType = ImageView.ScaleType.FIT_CENTER
        }

        // Child 2: Circular type-colored monogram fallback badge (visible only if all CDNs fail)
        val fallbackTv = TextView(context).apply {
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )
            gravity = Gravity.CENTER
            setTextColor(0xFFFFFFFF.toInt())
            typeface = Typeface.DEFAULT_BOLD
            textSize = (sizeDp * 0.36f).coerceIn(8f, 14f)
            visibility = View.GONE
        }

        // Child 3: Tiny bottom-right purple flame indicator dot for Shadow Pokémon (0dp height growth)
        val dotDp = if (sizeDp >= 24) 7 else 6
        val dotPx = (dotDp * density).toInt().coerceAtLeast(4)
        val shadowDot = View(context).apply {
            layoutParams = FrameLayout.LayoutParams(dotPx, dotPx, Gravity.BOTTOM or Gravity.END)
            background = GradientDrawable().apply {
                shape = GradientDrawable.OVAL
                setColor(0xFFC084FC.toInt())
                setStroke((1 * density).toInt().coerceAtLeast(1), 0xFF2E1065.toInt())
            }
            visibility = View.GONE
        }

        container.addView(shadowGlow)
        container.addView(imageView)
        container.addView(fallbackTv)
        container.addView(shadowDot)

        bindSpriteView(container, rawName, sizeDp, isShadowOverride)
        return container
    }

    fun bindSpriteView(
        container: FrameLayout,
        rawName: String,
        sizeDp: Int,
        isShadowOverride: Boolean? = null
    ) {
        val context = container.context
        val density = context.resources.displayMetrics.density
        val sizePx = (sizeDp * density).toInt().coerceAtLeast(1)

        if (container.childCount < 4) {
            container.removeAllViews()
            val fresh = createSpriteView(context, rawName, sizeDp, isShadowOverride)
            while (fresh.childCount > 0) {
                val c = fresh.getChildAt(0)
                fresh.removeViewAt(0)
                container.addView(c)
            }
            return
        }

        container.tag = SPRITE_WIDGET_TAG
        val shadowGlow = container.getChildAt(0)
        val imageView = container.getChildAt(1) as ImageView
        val fallbackTv = container.getChildAt(2) as TextView
        val shadowDot = container.getChildAt(3)

        val spec = resolveSpriteSpec(rawName, isShadowOverride)
        shadowGlow.visibility = if (spec.isShadow) View.VISIBLE else View.GONE
        shadowDot.visibility = if (spec.isShadow) View.VISIBLE else View.GONE

        fallbackTv.text = spec.monogram
        fallbackTv.background = GradientDrawable().apply {
            shape = GradientDrawable.OVAL
            setColor((spec.primaryColor and 0x00FFFFFF) or 0x38000000)
            setStroke((1 * density).toInt().coerceAtLeast(1), spec.primaryColor)
        }

        val candidates = spec.urls.filter { !FAILED_URLS.contains(it) }
        val bindKey = "${spec.slug}|${spec.isShadow}|$sizePx|${rawName.trim().lowercase()}"
        imageView.tag = bindKey

        if (candidates.isEmpty()) {
            imageView.setImageDrawable(null)
            imageView.visibility = View.GONE
            fallbackTv.visibility = View.VISIBLE
            return
        }

        imageView.visibility = View.VISIBLE
        fallbackTv.visibility = View.GONE

        val loader = getImageLoader(context)

        fun loadCandidate(index: Int) {
            if (imageView.tag != bindKey) return
            if (index >= candidates.size) {
                imageView.setImageDrawable(null)
                imageView.visibility = View.GONE
                fallbackTv.visibility = View.VISIBLE
                return
            }
            val url = candidates[index]
            if (FAILED_URLS.contains(url)) {
                loadCandidate(index + 1)
                return
            }
            val req = ImageRequest.Builder(context)
                .data(url)
                .size(sizePx, sizePx)
                .target(imageView)
                .listener(object : ImageRequest.Listener {
                    override fun onSuccess(request: ImageRequest, result: SuccessResult) {
                        if (imageView.tag == bindKey) {
                            imageView.visibility = View.VISIBLE
                            fallbackTv.visibility = View.GONE
                        }
                    }

                    override fun onError(request: ImageRequest, result: ErrorResult) {
                        FAILED_URLS.add(url)
                        if (imageView.tag == bindKey) {
                            loadCandidate(index + 1)
                        }
                    }
                })
                .build()
            loader.enqueue(req)
        }

        loadCandidate(0)
    }
}
