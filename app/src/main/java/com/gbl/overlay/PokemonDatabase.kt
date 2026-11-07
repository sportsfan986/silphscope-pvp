package com.gbl.overlay

import android.annotation.SuppressLint
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.content.pm.ServiceInfo
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.PixelFormat
import android.graphics.Rect
import android.graphics.RectF
import android.hardware.display.DisplayManager
import android.hardware.display.VirtualDisplay
import android.media.ImageReader
import android.media.MediaCodec
import android.media.MediaCodecInfo
import android.media.MediaFormat
import android.media.MediaMuxer
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.os.Handler
import android.os.HandlerThread
import android.os.IBinder
import android.os.Looper
import android.os.Process
import android.view.Gravity
import android.view.MotionEvent
import android.view.Surface
import android.view.WindowManager
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.text.TextUtils
import android.util.TypedValue
import android.view.View
import android.webkit.JavascriptInterface
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.core.app.NotificationCompat
import androidx.lifecycle.LifecycleService
import androidx.lifecycle.lifecycleScope
import com.google.gson.Gson
import com.google.gson.JsonArray
import com.google.gson.JsonParser
import com.google.gson.reflect.TypeToken
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.Text
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.File
import java.util.concurrent.CopyOnWriteArrayList
import kotlin.coroutines.resume
import kotlin.math.ceil
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

import com.gbl.overlay.OverlayService.*
import com.gbl.overlay.OverlayService.Companion.activeTierLMax
import com.gbl.overlay.OverlayService.Companion.activeTierWMin
import com.gbl.overlay.OverlayService.Companion.ALL_SHIELD_PERMUTATIONS
import com.gbl.overlay.OverlayService.Companion.BASELINE_MOVE_BUFF_EFFECTS
import com.gbl.overlay.OverlayService.Companion.CACHED_ALL_POKEMON_META
import com.gbl.overlay.OverlayService.Companion.CANONICAL_MOVE_ID_MAP
import com.gbl.overlay.OverlayService.Companion.ChargedCycleSimResult
import com.gbl.overlay.OverlayService.Companion.COMMON_THIRD_CHARGED_MOVE
import com.gbl.overlay.OverlayService.Companion.CPM_TABLE
import com.gbl.overlay.OverlayService.Companion.DEFAULT_LIMITED_META_CATALOG
import com.gbl.overlay.OverlayService.Companion.DYNAMIC_FAST_ENERGY
import com.gbl.overlay.OverlayService.Companion.DYNAMIC_FAST_POWER
import com.gbl.overlay.OverlayService.Companion.DYNAMIC_FAST_TURNS
import com.gbl.overlay.OverlayService.Companion.DYNAMIC_FAST_TYPE
import com.gbl.overlay.OverlayService.Companion.DYNAMIC_MOVE_BUFF_TABLE
import com.gbl.overlay.OverlayService.Companion.DYNAMIC_MOVE_DATABASE
import com.gbl.overlay.OverlayService.Companion.DYNAMIC_MOVE_ID_TO_NAME
import com.gbl.overlay.OverlayService.Companion.DYNAMIC_POKEMON_DATABASE
import com.gbl.overlay.OverlayService.Companion.FALLBACK_SPECIES_CHARGED_POOL
import com.gbl.overlay.OverlayService.Companion.FALLBACK_SPECIES_FAST_POOL
import com.gbl.overlay.OverlayService.Companion.FAST_MOVE_ENERGY
import com.gbl.overlay.OverlayService.Companion.FAST_MOVE_TURNS
import com.gbl.overlay.OverlayService.Companion.fastMovePowerMapStatic
import com.gbl.overlay.OverlayService.Companion.fastMoveTypeMapStatic
import com.gbl.overlay.OverlayService.Companion.FormResolver
import com.gbl.overlay.OverlayService.Companion.getEnabledGblLeaguesStatic
import com.gbl.overlay.OverlayService.Companion.getEnabledShow6LeaguesStatic
import com.gbl.overlay.OverlayService.Companion.getLeagueCpCapStatic
import com.gbl.overlay.OverlayService.Companion.LimitedMetaFormat
import com.gbl.overlay.OverlayService.Companion.LIVE_RANKINGS_MAP
import com.gbl.overlay.OverlayService.Companion.MOVE_DATABASE
import com.gbl.overlay.OverlayService.Companion.MOVE_ENERGY_COST
import com.gbl.overlay.OverlayService.Companion.MoveBuffEffect
import com.gbl.overlay.OverlayService.Companion.MoveStats
import com.gbl.overlay.OverlayService.Companion.MoveUsage
import com.gbl.overlay.OverlayService.Companion.normalizeLeagueKeyStatic
import com.gbl.overlay.OverlayService.Companion.POKEMON_META_DATABASE
import com.gbl.overlay.OverlayService.Companion.PokemonAutocompleteSuggestion
import com.gbl.overlay.OverlayService.Companion.PokemonMeta
import com.gbl.overlay.OverlayService.Companion.PokemonRankingEntry
import com.gbl.overlay.OverlayService.Companion.RankingMoves
import com.gbl.overlay.OverlayService.Companion.RECOMMENDED_CHARGED_MOVES
import com.gbl.overlay.OverlayService.Companion.REQUIRED_LEAGUE_KEYS
import com.gbl.overlay.OverlayService.Companion.RESOLVED_SPECIES_CACHE
import com.gbl.overlay.OverlayService.Companion.SPECIES_CHARGED_MOVES_POOL
import com.gbl.overlay.OverlayService.Companion.SPECIES_FAST_MOVES_POOL
import com.gbl.overlay.OverlayService.Companion.STATIC_MOVE_DATABASE_LOOKUP
import com.gbl.overlay.OverlayService.Companion.STATIC_MOVE_ENERGY_LOOKUP
import com.gbl.overlay.OverlayService.Companion.SUPER_MEGA_PLUS_MOVES
import com.gbl.overlay.OverlayService.Companion.DYNAMIC_SUPER_MEGA_PLUS_MOVES
import com.gbl.overlay.OverlayService.Companion.resolveMegaPlusMoveStatic
import com.gbl.overlay.OverlayService.Companion.TOP_30_RANKED_POOL_CACHE
import com.gbl.overlay.OverlayService.Companion.TOP_META_POOL_CACHE

// =============================================================================
// PokemonDatabase.kt - Static & Dynamic Species/Move Databases, Gamemaster &
// Rankings Parsers, and Turn-by-Turn 1v1/2v2 PvPoke Combat Math Simulator
// =============================================================================

internal object PokemonStaticData {
    // Default catalog aligned with live compiled PvPoke src/data/gamemaster.json formats
    val DEFAULT_LIMITED_META_CATALOG: List<LimitedMetaFormat> = listOf(
        // Forced Show 6 Battle Frontier Cups (ALL CAPS, dynamically matched via "Battle Frontier")
        LimitedMetaFormat("cauldron_2500", "BATTLE FRONTIER (CAULDRON)", "cauldron", 2500, "BATTLE FRONTIER (CAULDRON)", "battle_frontier", "CURRENT", "https://raw.githubusercontent.com/pvpoke/pvpoke/master/src/data/rankings/cauldron/overall/rankings-2500.json", "cauldron", 1793491200000L, true),
        LimitedMetaFormat("battlefrontiermaster_10000", "BATTLE FRONTIER (MASTER)", "battlefrontiermaster", 10000, "BATTLE FRONTIER (MASTER)", "battle_frontier", "CURRENT", "https://raw.githubusercontent.com/pvpoke/pvpoke/master/src/data/rankings/battlefrontiermaster/overall/rankings-10000.json", "master", 1793491200000L, true),
        LimitedMetaFormat("spectral_1500", "BATTLE FRONTIER (SPECTRAL)", "spectral", 1500, "BATTLE FRONTIER (SPECTRAL)", "battle_frontier", "CURRENT", "https://raw.githubusercontent.com/pvpoke/pvpoke/master/src/data/rankings/spectral/overall/rankings-1500.json", "spectral", 1793491200000L, false),
        // Optional Standard Open Leagues (User-selectable in Show 6 mode; forced as GREAT/ULTRA/MASTER LEAGUE in Blind 3 mode)
        LimitedMetaFormat("all_1500", "Great League", "all", 1500, "Great League (1500)", "standard_open", "CURRENT", "https://raw.githubusercontent.com/pvpoke/pvpoke/master/src/data/rankings/all/overall/rankings-1500.json", "great", 1793491200000L, false),
        LimitedMetaFormat("all_2500", "Ultra League", "all", 2500, "Ultra League (2500)", "standard_open", "CURRENT", "https://raw.githubusercontent.com/pvpoke/pvpoke/master/src/data/rankings/all/overall/rankings-2500.json", "ultra", 1793491200000L, false),
        LimitedMetaFormat("all_10000", "Master League", "all", 10000, "Master League (10000)", "standard_open", "CURRENT", "https://raw.githubusercontent.com/pvpoke/pvpoke/master/src/data/rankings/all/overall/rankings-10000.json", "master", 1793491200000L, false),
        // CURRENT (Live in PvPoke gamemaster.json["formats"])
        LimitedMetaFormat("mega_10000", "Mega Master League", "mega", 10000, "Mega Master League (10000)", "premier_mega", "CURRENT", "https://raw.githubusercontent.com/pvpoke/pvpoke/master/src/data/rankings/mega/overall/rankings-10000.json", "mega", 1793491200000L, true),
        LimitedMetaFormat("mega_1500", "Mega Great League", "mega", 1500, "Mega Great League (1500)", "premier_mega", "CURRENT", "https://raw.githubusercontent.com/pvpoke/pvpoke/master/src/data/rankings/mega/overall/rankings-1500.json", "megagreat", 1793491200000L, true),
        LimitedMetaFormat("mega_2500", "Mega Ultra League", "mega", 2500, "Mega Ultra League (2500)", "premier_mega", "CURRENT", "https://raw.githubusercontent.com/pvpoke/pvpoke/master/src/data/rankings/mega/overall/rankings-2500.json", "megaultra", 1793491200000L, true),
        LimitedMetaFormat("laic2027_1500", "LAIC 2027 Championship Series Cup", "laic2027", 1500, "LAIC 2027 Championship Series Cup (1500)", "battle_frontier", "CURRENT", "https://raw.githubusercontent.com/pvpoke/pvpoke/master/src/data/rankings/laic2027/overall/rankings-1500.json", "laic2027", 1793491200000L, true),
        LimitedMetaFormat("halloweenmega_1500", "Mega Halloween Cup", "halloweenmega", 1500, "Mega Halloween Cup (1500)", "gbl", "CURRENT", "https://raw.githubusercontent.com/pvpoke/pvpoke/master/src/data/rankings/halloweenmega/overall/rankings-1500.json", "halloweenmega", 1793491200000L, true),
        LimitedMetaFormat("fantasy_1500", "Fantasy Cup", "fantasy", 1500, "Fantasy Cup (1500)", "gbl", "CURRENT", "https://raw.githubusercontent.com/pvpoke/pvpoke/master/src/data/rankings/fantasy/overall/rankings-1500.json", "fantasy", 1793491200000L, false),
        LimitedMetaFormat("trail_1500", "Devon Trail Cup", "trail", 1500, "Devon Trail Cup (1500)", "battle_frontier", "CURRENT", "https://raw.githubusercontent.com/pvpoke/pvpoke/master/src/data/rankings/trail/overall/rankings-1500.json", "trail", 1793491200000L, false),
        LimitedMetaFormat("fable_1500", "Devon Fable Cup", "fable", 1500, "Devon Fable Cup (1500)", "battle_frontier", "CURRENT", "https://raw.githubusercontent.com/pvpoke/pvpoke/master/src/data/rankings/fable/overall/rankings-1500.json", "fable", 1793491200000L, false),
        LimitedMetaFormat("gymbreakers_1500", "Gymbreakers Invitational Season 7", "gymbreakers", 1500, "Gymbreakers Invitational Season 7 (1500)", "battle_frontier", "CURRENT", "https://raw.githubusercontent.com/pvpoke/pvpoke/master/src/data/rankings/gymbreakers/overall/rankings-1500.json", "gymbreakers", 1793491200000L, false),
        // RECENT (Within 4-week window by default)
        LimitedMetaFormat("colormega_1500", "Mega Color Cup", "colormega", 1500, "Mega Color Cup (1500)", "gbl", "RECENT", "https://raw.githubusercontent.com/pvpoke/pvpoke/master/src/data/rankings/colormega/overall/rankings-1500.json", "colormega", System.currentTimeMillis() - 14L * 86400_000L, true),
        LimitedMetaFormat("halloween_1500", "Halloween Cup", "halloween", 1500, "Halloween Cup (1500)", "gbl", "RECENT", "https://raw.githubusercontent.com/pvpoke/pvpoke/master/src/data/rankings/halloween/overall/rankings-1500.json", "halloween", System.currentTimeMillis() - 7L * 86400_000L, false),
        LimitedMetaFormat("sunshine_1500", "Sunshine Cup", "sunshine", 1500, "Sunshine Cup (1500)", "gbl", "RECENT", "https://raw.githubusercontent.com/pvpoke/pvpoke/master/src/data/rankings/sunshine/overall/rankings-1500.json", "sunshine", System.currentTimeMillis() - 18L * 86400_000L, false),
        LimitedMetaFormat("little_500", "Little Cup", "little", 500, "Little Cup (500)", "gbl", "RECENT", "https://raw.githubusercontent.com/pvpoke/pvpoke/master/src/data/rankings/little/overall/rankings-500.json", "little", System.currentTimeMillis() - 12L * 86400_000L, false),
        LimitedMetaFormat("premier_10000", "Master League Premier", "premier", 10000, "Master League Premier (10000)", "premier_mega", "RECENT", "https://raw.githubusercontent.com/pvpoke/pvpoke/master/src/data/rankings/premier/overall/rankings-10000.json", "premier", System.currentTimeMillis() - 10L * 86400_000L, false)
    )

    val BASELINE_MOVE_BUFF_EFFECTS: Map<String, MoveBuffEffect> = mapOf(
        "bulldoze" to MoveBuffEffect(0, 0, 0, -1, 1.0),
        "icy wind" to MoveBuffEffect(0, 0, -1, 0, 1.0),
        "chilling water" to MoveBuffEffect(0, 0, -1, 0, 1.0),
        "lunge" to MoveBuffEffect(0, 0, -1, 0, 1.0),
        "breaking swipe" to MoveBuffEffect(0, 0, -1, 0, 0.5),
        "feather dance" to MoveBuffEffect(0, 0, -2, 0, 1.0),
        "rock tomb" to MoveBuffEffect(0, 0, -1, 0, 1.0),
        "sand tomb" to MoveBuffEffect(0, 0, 0, -1, 1.0),
        "poison fang" to MoveBuffEffect(0, 0, 0, -1, 1.0),
        "psychic fangs" to MoveBuffEffect(0, 0, 0, -1, 1.0),
        "acid spray" to MoveBuffEffect(0, 0, 0, -2, 1.0),
        "obstruct" to MoveBuffEffect(0, 1, 0, -1, 1.0),
        "parabolic charge" to MoveBuffEffect(0, 1, 0, 0, 1.0),
        "skull bash" to MoveBuffEffect(0, 1, 0, 0, 1.0),
        "defense curl" to MoveBuffEffect(0, 1, 0, 0, 1.0),
        "iron defense" to MoveBuffEffect(0, 2, 0, 0, 1.0),
        "acid armor" to MoveBuffEffect(0, 2, 0, 0, 1.0),
        "bubble beam" to MoveBuffEffect(0, 0, -1, 0, 1.0),
        "glaciate" to MoveBuffEffect(0, 0, -1, 0, 1.0),
        "bleakwind storm" to MoveBuffEffect(0, 0, -1, 0, 1.0),
        "sandsear storm" to MoveBuffEffect(0, 0, -1, 0, 1.0),
        "wildbolt storm" to MoveBuffEffect(0, 0, -1, 0, 1.0),
        "springtide storm" to MoveBuffEffect(0, 0, -1, 0, 1.0),
        "mystical power" to MoveBuffEffect(1, 1, 0, 0, 1.0),
        "fleur cannon" to MoveBuffEffect(-2, 0, 0, 0, 1.0),
        "clanging scales" to MoveBuffEffect(0, -1, 0, 0, 1.0),
        "make it rain" to MoveBuffEffect(-1, 0, 0, 0, 1.0),
        "headlong rush" to MoveBuffEffect(0, -1, 0, 0, 1.0),
        "armor cannon" to MoveBuffEffect(0, -1, 0, 0, 1.0),
        "crunch" to MoveBuffEffect(0, 0, 0, -1, 0.3),
        "liquidation" to MoveBuffEffect(0, 0, 0, -1, 0.3),
        "shadow ball" to MoveBuffEffect(0, 0, 0, -1, 0.1),
        "shadow bone" to MoveBuffEffect(0, 0, 0, -1, 0.2),
        "earth power" to MoveBuffEffect(0, 0, 0, -1, 0.1),
        "bug buzz" to MoveBuffEffect(0, 0, 0, -1, 0.3),
        "psychic" to MoveBuffEffect(0, 0, 0, -1, 0.1),
        "flash cannon" to MoveBuffEffect(0, 0, 0, -1, 0.1),
        "focus blast" to MoveBuffEffect(0, 0, 0, -1, 0.1),
        "energy ball" to MoveBuffEffect(0, 0, 0, -1, 0.1),
        "luster purge" to MoveBuffEffect(0, 0, 0, -1, 0.5),
        "seed flare" to MoveBuffEffect(0, 0, 0, -2, 0.4),
        "razor shell" to MoveBuffEffect(0, 0, 0, -1, 0.5),
        "crush claw" to MoveBuffEffect(0, 0, 0, -1, 0.5),
        "scald" to MoveBuffEffect(0, 0, -1, 0, 0.5),
        "scorching sands" to MoveBuffEffect(0, 0, -1, 0, 0.3),
        "moonblast" to MoveBuffEffect(0, 0, -1, 0, 0.1),
        "play rough" to MoveBuffEffect(0, 0, -1, 0, 0.1),
        "mist ball" to MoveBuffEffect(0, 0, -1, 0, 0.5),
        "mirror shot" to MoveBuffEffect(0, 0, -1, 0, 0.3),
        "muddy water" to MoveBuffEffect(0, 0, -1, 0, 0.3),
        "octazooka" to MoveBuffEffect(0, 0, -2, 0, 0.5),
        "leaf tornado" to MoveBuffEffect(0, 0, -2, 0, 0.5),
        "aurora beam" to MoveBuffEffect(0, 0, -1, 0, 0.1),
        "signal beam" to MoveBuffEffect(0, 0, -1, -1, 0.2),
        "zap cannon" to MoveBuffEffect(0, 0, -1, 0, 0.66),
        "rage fist" to MoveBuffEffect(1, 0, 0, 0, 1.0),
        "power-up punch" to MoveBuffEffect(1, 0, 0, 0, 1.0),
        "flame charge" to MoveBuffEffect(1, 0, 0, 0, 1.0),
        "trailblaze" to MoveBuffEffect(1, 0, 0, 0, 1.0),
        "triple axel" to MoveBuffEffect(1, 0, 0, 0, 1.0),
        "torch song" to MoveBuffEffect(1, 0, 0, 0, 1.0),
        "aura wheel" to MoveBuffEffect(1, 0, 0, 0, 1.0),
        "night slash" to MoveBuffEffect(2, 0, 0, 0, 0.125),
        "cross poison" to MoveBuffEffect(2, 0, 0, 0, 0.125),
        "blaze kick" to MoveBuffEffect(1, 0, 0, 0, 0.125),
        "crabhammer" to MoveBuffEffect(2, 0, 0, 0, 0.125),
        "aeroblast" to MoveBuffEffect(2, 0, 0, 0, 0.125),
        "sacred fire" to MoveBuffEffect(0, 0, -1, 0, 0.5),
        "magma storm" to MoveBuffEffect(0, 0, 0, -1, 0.3),
        "air cutter" to MoveBuffEffect(1, 0, 0, 0, 0.3),
        "meteor mash" to MoveBuffEffect(1, 0, 0, 0, 0.1),
        "ancient power" to MoveBuffEffect(1, 1, 0, 0, 0.1),
        "ominous wind" to MoveBuffEffect(1, 1, 0, 0, 0.1),
        "silver wind" to MoveBuffEffect(1, 1, 0, 0, 0.1),
        "steel wing" to MoveBuffEffect(0, 1, 0, 0, 0.1),
        "meteor beam" to MoveBuffEffect(1, 0, 0, 0, 1.0),
        "close combat" to MoveBuffEffect(0, -2, 0, 0, 1.0),
        "wild charge" to MoveBuffEffect(0, -2, 0, 0, 1.0),
        "brave bird" to MoveBuffEffect(0, -3, 0, 0, 1.0),
        "superpower" to MoveBuffEffect(-1, -1, 0, 0, 1.0),
        "overheat" to MoveBuffEffect(-2, 0, 0, 0, 1.0),
        "draco meteor" to MoveBuffEffect(-2, 0, 0, 0, 1.0),
        "psycho boost" to MoveBuffEffect(-2, 0, 0, 0, 1.0),
        "leaf storm" to MoveBuffEffect(-2, 0, 0, 0, 1.0),
        "v-create" to MoveBuffEffect(0, -3, 0, 0, 1.0),
        "fell stinger" to MoveBuffEffect(1, 0, 0, 0, 1.0),
        "volt tackle" to MoveBuffEffect(0, -1, 0, 0, 1.0),
        "drain punch" to MoveBuffEffect(0, 1, 0, 0, 1.0),
        "brick break" to MoveBuffEffect(0, 0, 0, -1, 1.0),
        "mystical fire" to MoveBuffEffect(0, 0, -1, 0, 1.0),
        "fell stinger+" to MoveBuffEffect(1, 0, 0, 0, 1.0),
        "volt tackle+" to MoveBuffEffect(0, -1, 0, 0, 1.0),
        "zap cannon+" to MoveBuffEffect(0, 0, -1, 0, 1.0),
        "acid spray+" to MoveBuffEffect(0, 0, 0, -2, 1.0),
        "liquidation+" to MoveBuffEffect(0, 0, 0, -1, 0.3),
        "brave bird+" to MoveBuffEffect(0, -3, 0, 0, 1.0),
        "ominous wind+" to MoveBuffEffect(1, 1, 0, 0, 0.1),
        "mystical fire+" to MoveBuffEffect(0, 0, -1, 0, 1.0),
        "brick break+" to MoveBuffEffect(0, 0, 0, -1, 1.0)
    )

    val SUPER_MEGA_PLUS_MOVES: Map<String, String> = mapOf(
        "beedrill_mega" to "Fell Stinger+",
        "beedrill (mega)" to "Fell Stinger+",
        "mega beedrill" to "Fell Stinger+",
        "raichu_mega_x" to "Volt Tackle+",
        "raichu (mega x)" to "Volt Tackle+",
        "mega raichu x" to "Volt Tackle+",
        "mega raichu (x)" to "Volt Tackle+",
        "raichu_mega_y" to "Zap Cannon+",
        "raichu (mega y)" to "Zap Cannon+",
        "mega raichu y" to "Zap Cannon+",
        "mega raichu (y)" to "Zap Cannon+",
        "victreebel_mega" to "Acid Spray+",
        "victreebel (mega)" to "Acid Spray+",
        "mega victreebel" to "Acid Spray+",
        "starmie_mega" to "Liquidation+",
        "starmie (mega)" to "Liquidation+",
        "mega starmie" to "Liquidation+",
        "dragonite_mega" to "Outrage+",
        "dragonite (mega)" to "Outrage+",
        "mega dragonite" to "Outrage+",
        "mewtwo_mega_x" to "Dynamic Punch+",
        "mewtwo (mega x)" to "Dynamic Punch+",
        "mega mewtwo x" to "Dynamic Punch+",
        "mega mewtwo (x)" to "Dynamic Punch+",
        "mewtwo_mega_y" to "Future Sight+",
        "mewtwo (mega y)" to "Future Sight+",
        "mega mewtwo y" to "Future Sight+",
        "mega mewtwo (y)" to "Future Sight+",
        "skarmory_mega" to "Drill Peck+",
        "skarmory (mega)" to "Drill Peck+",
        "mega skarmory" to "Drill Peck+",
        "houndoom_mega" to "Dark Pulse+",
        "houndoom (mega)" to "Dark Pulse+",
        "mega houndoom" to "Dark Pulse+",
        "sableye_mega" to "Night Shade+",
        "sableye (mega)" to "Night Shade+",
        "mega sableye" to "Night Shade+",
        "staraptor_mega" to "Brave Bird+",
        "staraptor (mega)" to "Brave Bird+",
        "mega staraptor" to "Brave Bird+",
        "chandelure_mega" to "Ominous Wind+",
        "chandelure (mega)" to "Ominous Wind+",
        "mega chandelure" to "Ominous Wind+",
        "chesnaught_mega" to "Seed Bomb+",
        "chesnaught (mega)" to "Seed Bomb+",
        "mega chesnaught" to "Seed Bomb+",
        "delphox_mega" to "Mystical Fire+",
        "delphox (mega)" to "Mystical Fire+",
        "mega delphox" to "Mystical Fire+",
        "greninja_mega" to "Surf+",
        "greninja (mega)" to "Surf+",
        "mega greninja" to "Surf+",
        "malamar_mega" to "Psybeam+",
        "malamar (mega)" to "Psybeam+",
        "mega malamar" to "Psybeam+",
        "falinks_mega" to "Brick Break+",
        "falinks (mega)" to "Brick Break+",
        "mega falinks" to "Brick Break+"
    )

    val RECOMMENDED_CHARGED_MOVES: Map<String, Triple<String, String, String>> = mapOf(
        "Rillaboom" to Triple("Drum Beating", "Earth Power", "Frenzy Plant"),
        "rillaboom" to Triple("Drum Beating", "Earth Power", "Frenzy Plant"),
        "Tinkaton" to Triple("Gigaton Hammer", "Bulldoze", "Play Rough"),
        "tinkaton" to Triple("Gigaton Hammer", "Bulldoze", "Play Rough"),
        "Kanto Ninetales" to Triple("Weather Ball (Fire)", "Energy Ball", "Psyshock"),
        "ninetales" to Triple("Weather Ball (Fire)", "Energy Ball", "Psyshock"),
        "Ninetales (Alolan)" to Triple("Weather Ball (Ice)", "Chilling Water", "Psyshock"),
        "Alolan Ninetales" to Triple("Weather Ball (Ice)", "Chilling Water", "Psyshock"),
        "ninetales_alolan" to Triple("Weather Ball (Ice)", "Chilling Water", "Psyshock"),
        "ninetales_alolan_shadow" to Triple("Weather Ball (Ice)", "Chilling Water", "Psyshock"),
        "Corviknight" to Triple("Air Cutter", "Iron Head", "Sky Attack"),
        "corviknight" to Triple("Air Cutter", "Iron Head", "Sky Attack"),
        "Dusknoir" to Triple("Shadow Punch", "Dynamic Punch", "Shadow Ball"),
        "dusknoir" to Triple("Shadow Punch", "Dynamic Punch", "Shadow Ball"),
        "dusknoir_shadow" to Triple("Shadow Punch", "Dynamic Punch", "Shadow Ball"),
        "Dusclops" to Triple("Ice Punch", "Shadow Punch", "Poltergeist"),
        "dusclops" to Triple("Ice Punch", "Shadow Punch", "Poltergeist"),
        "dusclops_shadow" to Triple("Ice Punch", "Shadow Punch", "Poltergeist"),
        "Lugia" to Triple("Aeroblast", "Earth Power", "Hydro Pump"),
        "lugia" to Triple("Aeroblast", "Earth Power", "Hydro Pump"),
        "Kyogre" to Triple("Origin Pulse", "Avalanche", "Surf"),
        "kyogre" to Triple("Origin Pulse", "Avalanche", "Surf"),
        "Fearow" to Triple("Drill Run", "Drill Peck", "Twister"),
        "fearow" to Triple("Drill Run", "Drill Peck", "Twister"),
        "Zacian (Crowned)" to Triple("Behemoth Blade", "Close Combat", "Play Rough"),
        "zacian_crowned" to Triple("Behemoth Blade", "Close Combat", "Play Rough"),
        "zacian" to Triple("Close Combat", "Play Rough", "Wild Charge"),
        "Zamazenta (Crowned)" to Triple("Behemoth Bash", "Close Combat", "Moonblast"),
        "zamazenta_crowned" to Triple("Behemoth Bash", "Close Combat", "Moonblast"),
        "zamazenta" to Triple("Close Combat", "Crunch", "Moonblast"),
        "Keldeo (Resolute)" to Triple("Secret Sword", "Aqua Jet", "Hydro Pump"),
        "keldeo_resolute" to Triple("Secret Sword", "Aqua Jet", "Hydro Pump"),
        "Keldeo (Ordinary)" to Triple("Sacred Sword", "Aqua Jet", "Hydro Pump"),
        "keldeo" to Triple("Sacred Sword", "Aqua Jet", "Hydro Pump"),
        "Kyurem (Black)" to Triple("Freeze Shock", "Fusion Bolt", "Outrage"),
        "kyurem_black" to Triple("Freeze Shock", "Fusion Bolt", "Outrage"),
        "Kyurem (White)" to Triple("Ice Burn", "Fusion Flare", "Blizzard"),
        "kyurem_white" to Triple("Ice Burn", "Fusion Flare", "Blizzard"),
        "Kyurem" to Triple("Glaciate", "Dragon Claw", "Blizzard"),
        "kyurem" to Triple("Glaciate", "Dragon Claw", "Blizzard"),
        "Zygarde" to Triple("Crunch", "Earthquake", "Outrage"),
        "zygarde" to Triple("Crunch", "Earthquake", "Outrage"),
        "Ampharos" to Triple("Brutal Swing", "Trailblaze", "Zap Cannon"),
        "ampharos" to Triple("Brutal Swing", "Trailblaze", "Zap Cannon"),
        "Dialga (Origin)" to Triple("Roar of Time", "Iron Head", "Thunder"),
        "dialga_origin" to Triple("Roar of Time", "Iron Head", "Thunder"),
        "Dialga" to Triple("Draco Meteor", "Iron Head", "Thunder"),
        "dialga" to Triple("Draco Meteor", "Iron Head", "Thunder"),
        "Palkia (Origin)" to Triple("Spacial Rend", "Aqua Tail", "Hydro Pump"),
        "palkia_origin" to Triple("Spacial Rend", "Aqua Tail", "Hydro Pump"),
        "Palkia" to Triple("Aqua Tail", "Draco Meteor", "Fire Blast"),
        "palkia" to Triple("Aqua Tail", "Draco Meteor", "Fire Blast"),
        "Groudon" to Triple("Precipice Blades", "Fire Punch", "Earthquake"),
        "groudon" to Triple("Precipice Blades", "Fire Punch", "Earthquake"),
        "Ho-Oh" to Triple("Sacred Fire", "Brave Bird", "Earthquake"),
        "ho_oh" to Triple("Sacred Fire", "Brave Bird", "Earthquake"),
        "ho-oh" to Triple("Sacred Fire", "Brave Bird", "Earthquake"),
        "Yveltal" to Triple("Dark Pulse", "Oblivion Wing", "Focus Blast"),
        "yveltal" to Triple("Dark Pulse", "Oblivion Wing", "Focus Blast"),
        "Xerneas" to Triple("Close Combat", "Moonblast", "Megahorn"),
        "xerneas" to Triple("Close Combat", "Moonblast", "Megahorn"),
        "Landorus (Therian)" to Triple("Sandsear Storm", "Stone Edge", "Superpower"),
        "landorus_therian" to Triple("Sandsear Storm", "Stone Edge", "Superpower"),
        "Necrozma (Dusk Mane)" to Triple("Sunsteel Strike", "Dark Pulse", "Iron Head"),
        "necrozma_dusk_mane" to Triple("Sunsteel Strike", "Dark Pulse", "Iron Head"),
        "Necrozma (Dawn Wings)" to Triple("Moongeist Beam", "Dark Pulse", "Iron Head"),
        "necrozma_dawn_wings" to Triple("Moongeist Beam", "Dark Pulse", "Iron Head"),
        "Mewtwo (Armored)" to Triple("Psystrike", "Dynamic Punch", "Earthquake"),
        "Armored Mewtwo" to Triple("Psystrike", "Dynamic Punch", "Earthquake"),
        "mewtwo_armored" to Triple("Psystrike", "Dynamic Punch", "Earthquake"),
        "Mewtwo" to Triple("Psystrike", "Shadow Ball", "Focus Blast"),
        "mewtwo" to Triple("Psystrike", "Shadow Ball", "Focus Blast"),
        "Mew" to Triple("Psyshock", "Wild Charge", "Surf"),
        "mew" to Triple("Psyshock", "Wild Charge", "Surf"),
        "Rhyperior" to Triple("Rock Wrecker", "Breaking Swipe", "Superpower"),
        "rhyperior" to Triple("Rock Wrecker", "Breaking Swipe", "Superpower"),
        "Dragonite" to Triple("Dragon Claw", "Superpower", "Outrage"),
        "dragonite" to Triple("Dragon Claw", "Superpower", "Outrage"),
        "Metagross" to Triple("Meteor Mash", "Earthquake", "Psychic"),
        "metagross" to Triple("Meteor Mash", "Earthquake", "Psychic"),
        "Melmetal" to Triple("Superpower", "Rock Slide", "Double Iron Bash"),
        "melmetal" to Triple("Superpower", "Rock Slide", "Double Iron Bash"),
        "Excadrill" to Triple("Drill Run", "Rock Slide", "Iron Head"),
        "excadrill" to Triple("Drill Run", "Rock Slide", "Iron Head"),
        "Mamoswine" to Triple("Avalanche", "High Horsepower", "Stone Edge"),
        "mamoswine" to Triple("Avalanche", "High Horsepower", "Stone Edge"),
        "Clodsire" to Triple("Earthquake", "Stone Edge", "Sludge Bomb"),
        "clodsire" to Triple("Earthquake", "Stone Edge", "Sludge Bomb"),
        "Feraligatr" to Triple("Hydro Cannon", "Ice Beam", "Crunch"),
        "feraligatr" to Triple("Hydro Cannon", "Ice Beam", "Crunch"),
        "Mandibuzz" to Triple("Dark Pulse", "Aerial Ace", "Foul Play"),
        "mandibuzz" to Triple("Dark Pulse", "Aerial Ace", "Foul Play"),
        "Azumarill" to Triple("Ice Beam", "Play Rough", "Hydro Pump"),
        "azumarill" to Triple("Ice Beam", "Play Rough", "Hydro Pump"),
        "Gastrodon" to Triple("Body Slam", "Earth Power", "Water Pulse"),
        "gastrodon" to Triple("Body Slam", "Earth Power", "Water Pulse"),
        "Annihilape" to Triple("Rage Fist", "Ice Punch", "Close Combat"),
        "annihilape" to Triple("Rage Fist", "Ice Punch", "Close Combat"),
        "Primeape" to Triple("Rage Fist", "Close Combat", "Ice Punch"),
        "primeape" to Triple("Rage Fist", "Close Combat", "Ice Punch"),
        "Cresselia" to Triple("Grass Knot", "Moonblast", "Future Sight"),
        "cresselia" to Triple("Grass Knot", "Moonblast", "Future Sight"),
        "Swampert" to Triple("Hydro Cannon", "Earthquake", "Sludge Wave"),
        "swampert" to Triple("Hydro Cannon", "Earthquake", "Sludge Wave"),
        "Quagsire" to Triple("Aqua Tail", "Stone Edge", "Mud Bomb"),
        "quagsire" to Triple("Aqua Tail", "Stone Edge", "Mud Bomb"),
        "Whiscash" to Triple("Scald", "Mud Bomb", "Blizzard"),
        "whiscash" to Triple("Scald", "Mud Bomb", "Blizzard"),
        "Talonflame" to Triple("Fly", "Flame Charge", "Brave Bird"),
        "talonflame" to Triple("Fly", "Flame Charge", "Brave Bird"),
        "Serperior" to Triple("Frenzy Plant", "Aerial Ace", "Leaf Tornado"),
        "serperior" to Triple("Frenzy Plant", "Aerial Ace", "Leaf Tornado"),
        "Skeledirge" to Triple("Torch Song", "Shadow Ball", "Disarming Voice"),
        "skeledirge" to Triple("Torch Song", "Shadow Ball", "Disarming Voice"),
        "Snorlax" to Triple("Body Slam", "Earthquake", "Superpower"),
        "snorlax" to Triple("Body Slam", "Earthquake", "Superpower"),
        "Shadow Snorlax" to Triple("Body Slam", "Superpower", "Earthquake"),
        "snorlax_shadow" to Triple("Body Slam", "Superpower", "Earthquake"),
        "Greninja" to Triple("Hydro Cannon", "Brutal Swing", "Night Slash"),
        "greninja" to Triple("Hydro Cannon", "Brutal Swing", "Night Slash"),
        "Shadow Greninja" to Triple("Hydro Cannon", "Night Slash", "Brutal Swing"),
        "greninja_shadow" to Triple("Hydro Cannon", "Night Slash", "Brutal Swing"),
        "Lickilicky" to Triple("Body Slam", "Shadow Ball", "Earthquake"),
        "lickilicky" to Triple("Body Slam", "Shadow Ball", "Earthquake"),
        "Lickitung" to Triple("Body Slam", "Power Whip", "Stomp"),
        "lickitung" to Triple("Body Slam", "Power Whip", "Stomp"),
        "Skarmory" to Triple("Brave Bird", "Sky Attack", "Flash Cannon"),
        "skarmory" to Triple("Brave Bird", "Sky Attack", "Flash Cannon"),
        "Registeel" to Triple("Zap Cannon", "Focus Blast", "Hyper Beam"),
        "registeel" to Triple("Zap Cannon", "Focus Blast", "Hyper Beam"),
        "Trevenant" to Triple("Seed Bomb", "Shadow Ball", "Foul Play"),
        "trevenant" to Triple("Seed Bomb", "Shadow Ball", "Foul Play"),
        "Morpeko" to Triple("Aura Wheel", "Psychic Fangs", "Outrage"),
        "morpeko" to Triple("Aura Wheel", "Psychic Fangs", "Outrage"),
        "Poliwrath" to Triple("Icy Wind", "Scald", "Dynamic Punch"),
        "poliwrath" to Triple("Icy Wind", "Scald", "Dynamic Punch"),
        "Pelipper" to Triple("Weather Ball", "Hurricane", "Hydro Pump"),
        "pelipper" to Triple("Weather Ball", "Hurricane", "Hydro Pump"),
        "Mantine" to Triple("Aerial Ace", "Ice Beam", "Water Pulse"),
        "mantine" to Triple("Aerial Ace", "Ice Beam", "Water Pulse"),
        "Dewgong" to Triple("Icy Wind", "Drill Run", "Blizzard"),
        "dewgong" to Triple("Icy Wind", "Drill Run", "Blizzard"),
        "Walrein" to Triple("Icicle Spear", "Earthquake", "Blizzard"),
        "walrein" to Triple("Icicle Spear", "Earthquake", "Blizzard"),
        "Mimikyu" to Triple("Play Rough", "Shadow Sneak", "Thunder"),
        "mimikyu" to Triple("Play Rough", "Shadow Sneak", "Thunder"),
        "Aegislash" to Triple("Shadow Ball", "Flash Cannon", "Gyro Ball"),
        "aegislash" to Triple("Shadow Ball", "Flash Cannon", "Gyro Ball"),
        "aegislash_shield" to Triple("Shadow Ball", "Flash Cannon", "Gyro Ball"),
        "Cramorant" to Triple("Surf", "Fly", "Dive"),
        "cramorant" to Triple("Surf", "Fly", "Dive"),
        "Gholdengo" to Triple("Shadow Ball", "Focus Blast", "Dazzling Gleam"),
        "gholdengo" to Triple("Shadow Ball", "Focus Blast", "Dazzling Gleam"),
        "Baxcalibur" to Triple("Avalanche", "Dragon Claw", "Blizzard"),
        "baxcalibur" to Triple("Avalanche", "Dragon Claw", "Blizzard")
    )

    val COMMON_THIRD_CHARGED_MOVE: Map<String, String> = mapOf(
        "Dialga (Origin)" to "Thunder",
        "Dialga" to "Thunder",
        "Palkia (Origin)" to "Hydro Pump",
        "Palkia" to "Hydro Pump",
        "Zacian (Crowned)" to "Play Rough",
        "Zacian (Hero)" to "Wild Charge",
        "Zamazenta (Crowned)" to "Moonblast",
        "Zamazenta (Hero)" to "Moonblast",
        "Keldeo (Resolute)" to "Hydro Pump",
        "Keldeo (Ordinary)" to "Hydro Pump",
        "Zygarde" to "Outrage",
        "Lugia" to "Sky Attack",
        "Kyogre" to "Surf",
        "Groudon" to "Solar Beam",
        "Giratina (Origin)" to "Dragon Pulse",
        "Giratina (Altered)" to "Shadow Sneak",
        "Mewtwo (Armored)" to "Earthquake",
        "Armored Mewtwo" to "Earthquake",
        "Mewtwo" to "Shadow Ball",
        "Mew" to "Surf",
        "Xerneas" to "Megahorn",
        "Yveltal" to "Focus Blast",
        "Landorus (Therian)" to "Superpower",
        "Landorus (Incarnate)" to "Outrage",
        "Ho-Oh" to "Solar Beam",
        "Necrozma (Dusk Mane)" to "Outrage",
        "Necrozma (Dawn Wings)" to "Outrage",
        "Solgaleo" to "Solar Beam",
        "Lunala" to "Future Sight",
        "Dragonite" to "Hurricane",
        "Metagross" to "Psychic",
        "Excadrill" to "Iron Head",
        "Rhyperior" to "Surf",
        "Garchomp" to "Earth Power",
        "Mamoswine" to "Stone Edge",
        "Florges" to "Psychic",
        "Reshiram" to "Crunch",
        "Zekrom" to "Outrage",
        "Kyurem (Black)" to "Outrage",
        "Kyurem (White)" to "Blizzard",
        "Kyurem" to "Blizzard",
        "Primarina" to "Moonblast",
        "Ursaluna" to "Swift",
        "Togekiss" to "Ancient Power",
        "Gyarados" to "Outrage",
        "Melmetal" to "Thunderbolt",
        "Zarude" to "Energy Ball",
        "Marshadow" to "Close Combat",
        "Enamorus" to "Grass Knot",
        "Corviknight" to "Payback",
        "Mimikyu" to "Thunder",
        "Aegislash" to "Gyro Ball",
        "Cramorant" to "Dive",
        "Kanto Ninetales" to "Overheat",
        "Ninetales (Alolan)" to "Psyshock",
        "Fearow" to "Sky Attack",
        "Shadow Pidgeot" to "Feather Dance",
        "Pidgeot" to "Air Cutter",
        "Deoxys (Defense)" to "Thunderbolt",
        "Deoxys (Normal)" to "Hyper Beam",
        "Cresselia" to "Future Sight",
        "Registeel" to "Flash Cannon",
        "Swampert" to "Sludge Wave",
        "Feraligatr" to "Crunch",
        "Talonflame" to "Fly",
        "Clodsire" to "Megahorn",
        "Azumarill" to "Hydro Pump",
        "Bastiodon" to "Flash Cannon",
        "Lickilicky" to "Solar Beam",
        "Mandibuzz" to "Shadow Ball",
        "Umbreon" to "Psychic",
        "Annihilape" to "Close Combat",
        "Poliwrath" to "Dynamic Punch",
        "Medicham" to "Psychic",
        "Sableye" to "Shadow Sneak",
        "Carbink" to "Power Gem",
        "Skarmory" to "Flash Cannon",
        "Altaria" to "Dazzling Gleam",
        "Pelipper" to "Blizzard",
        "Mantine" to "Water Pulse",
        "Lanturn" to "Hydro Pump",
        "Whiscash" to "Blizzard",
        "Quagsire" to "Sludge Bomb",
        "Gastrodon" to "Water Pulse",
        "Dunsparce" to "Drill Run",
        "Wigglytuff" to "Disarming Voice",
        "Clefable" to "Psychic",
        "Charizard" to "Overheat",
        "Venusaur" to "Petal Blizzard",
        "Serperior" to "Aerial Ace",
        "Abomasnow" to "Outrage",
        "Walrein" to "Water Pulse",
        "Dewgong" to "Blizzard",
        "Lapras" to "Blizzard",
        "Sandslash (Alolan)" to "Blizzard",
        "Marowak (Alolan)" to "Fire Punch",
        "Trevenant" to "Foul Play",
        "Jellicent" to "Ice Beam",
        "Drifblim" to "Mystical Fire",
        "Froslass" to "Crunch",
        "Skeledirge" to "Disarming Voice",
        "Snorlax" to "Superpower",
        "Shadow Snorlax" to "Earthquake",
        "Typhlosion" to "Solar Beam",
        "Goodra" to "Power Whip",
        "Guzzlord" to "Sludge Bomb",
        "Zweilous" to "Dragon Pulse",
        "Virizion" to "Stone Edge",
        "Cobalion" to "Iron Head",
        "Tapu Fini" to "Ice Beam",
        "Tapu Lele" to "Future Sight",
        "Tapu Bulu" to "Megahorn",
        "Tapu Koko" to "Thunder",
        "Tentacruel" to "Blizzard",
        "Toxapex" to "Gunk Shot",
        "Drapion" to "Sludge Bomb",
        "Skuntank" to "Sludge Bomb",
        "Muk (Alolan)" to "Gunk Shot",
        "Obstagoon" to "Hyper Beam",
        "Scrafty" to "Acid Spray",
        "Machamp" to "Payback",
        "Primeape" to "Close Combat",
        "Pangoro" to "Iron Head",
        "Malamar" to "Hyper Beam",
        "Stunfisk" to "Muddy Water",
        "Stunfisk (Galarian)" to "Flash Cannon",
        "Steelix" to "Heavy Slam",
        "Empoleon" to "Blizzard",
        "Greninja" to "Night Slash",
        "Shadow Greninja" to "Brutal Swing",
        "Samurott" to "Blizzard",
        "Golisopod" to "Aerial Ace",
        "Araquanid" to "Water Pulse",
        "Ariados" to "Trailblaze",
        "Charjabug" to "Crunch",
        "Galvantula" to "Energy Ball",
        "Ampharos" to "Focus Blast",
        "Magnezone" to "Flash Cannon",
        "Togedemaru" to "Gyro Ball",
        "Morpeko" to "Outrage",
        "Raikou" to "Thunderbolt",
        "Entei" to "Overheat",
        "Suicune" to "Hydro Pump",
        "Zapdos" to "Ancient Power",
        "Zapdos (Galarian)" to "Payback",
        "Moltres" to "Overheat",
        "Moltres (Galarian)" to "Payback",
        "Articuno" to "Hurricane",
        "Articuno (Galarian)" to "Future Sight",
        "Jumpluff" to "Dazzling Gleam",
        "Tropius" to "Aerial Ace",
        "Noctowl" to "Psychic",
        "Gligar" to "Night Slash",
        "Gliscor" to "Sand Tomb"
    )

    val MOVE_DATABASE: Map<String, MoveStats> = mapOf(
        "Behemoth Blade" to MoveStats("Behemoth Blade", "steel", 100, 55),
        "Behemoth Bash" to MoveStats("Behemoth Bash", "steel", 80, 45),
        "Secret Sword" to MoveStats("Secret Sword", "fighting", 70, 35),
        "Aqua Jet" to MoveStats("Aqua Jet", "water", 70, 40),
        "Double Iron Bash" to MoveStats("Double Iron Bash", "steel", 70, 35),
        "Bleakwind Storm" to MoveStats("Bleakwind Storm", "flying", 60, 45),
        "Wildbolt Storm" to MoveStats("Wildbolt Storm", "electric", 60, 45),
        "Springtide Storm" to MoveStats("Springtide Storm", "fairy", 60, 45),
        "Roar of Time" to MoveStats("Roar of Time", "dragon", 150, 65),
        "Iron Head" to MoveStats("Iron Head", "steel", 85, 50),
        "Draco Meteor" to MoveStats("Draco Meteor", "dragon", 150, 65),
        "Thunder" to MoveStats("Thunder", "electric", 100, 60),
        "Aeroblast" to MoveStats("Aeroblast", "flying", 170, 75),
        "Sky Attack" to MoveStats("Sky Attack", "flying", 75, 50),
        "Future Sight" to MoveStats("Future Sight", "psychic", 110, 65),
        "Surf" to MoveStats("Surf", "water", 75, 45),
        "Origin Pulse" to MoveStats("Origin Pulse", "water", 130, 60),
        "Hydro Pump" to MoveStats("Hydro Pump", "water", 130, 75),
        "Blizzard" to MoveStats("Blizzard", "ice", 140, 75),
        "Close Combat" to MoveStats("Close Combat", "fighting", 100, 45),
        "Brave Bird" to MoveStats("Brave Bird", "flying", 130, 55),
        "Play Rough" to MoveStats("Play Rough", "fairy", 90, 60),
        "Wild Charge" to MoveStats("Wild Charge", "electric", 100, 45),
        "Shadow Ball" to MoveStats("Shadow Ball", "ghost", 90, 50),
        "Ominous Wind" to MoveStats("Ominous Wind", "ghost", 45, 45),
        "Dragon Claw" to MoveStats("Dragon Claw", "dragon", 80, 50),
        "Ancient Power" to MoveStats("Ancient Power", "rock", 60, 45),
        "Shadow Force" to MoveStats("Shadow Force", "ghost", 120, 65),
        "Spacial Rend" to MoveStats("Spacial Rend", "dragon", 95, 55),
        "Aqua Tail" to MoveStats("Aqua Tail", "water", 55, 35),
        "Precipice Blades" to MoveStats("Precipice Blades", "ground", 130, 60),
        "Fire Punch" to MoveStats("Fire Punch", "fire", 60, 40),
        "Psystrike" to MoveStats("Psystrike", "psychic", 90, 45),
        "Ice Beam" to MoveStats("Ice Beam", "ice", 90, 55),
        "Moonblast" to MoveStats("Moonblast", "fairy", 90, 50),
        "Dark Pulse" to MoveStats("Dark Pulse", "dark", 80, 45),
        "Oblivion Wing" to MoveStats("Oblivion Wing", "flying", 85, 50),
        "Crunch" to MoveStats("Crunch", "dark", 70, 45),
        "Earthquake" to MoveStats("Earthquake", "ground", 120, 65),
        "Sandsear Storm" to MoveStats("Sandsear Storm", "ground", 60, 45),
        "Stone Edge" to MoveStats("Stone Edge", "rock", 100, 55),
        "Superpower" to MoveStats("Superpower", "fighting", 85, 40),
        "Sacred Fire" to MoveStats("Sacred Fire", "fire", 130, 65),
        "Sunsteel Strike" to MoveStats("Sunsteel Strike", "steel", 135, 65),
        "Moongeist Beam" to MoveStats("Moongeist Beam", "ghost", 135, 65),
        "Rock Slide" to MoveStats("Rock Slide", "rock", 75, 45),
        "Earth Power" to MoveStats("Earth Power", "ground", 90, 50),
        "Outrage" to MoveStats("Outrage", "dragon", 110, 60),
        "Meteor Mash" to MoveStats("Meteor Mash", "steel", 100, 45),
        "Drill Run" to MoveStats("Drill Run", "ground", 70, 40),
        "Rock Wrecker" to MoveStats("Rock Wrecker", "rock", 110, 50),
        "Breaking Swipe" to MoveStats("Breaking Swipe", "dragon", 50, 50),
        "Avalanche" to MoveStats("Avalanche", "ice", 90, 45),
        "High Horsepower" to MoveStats("High Horsepower", "ground", 100, 55),
        "Ice Punch" to MoveStats("Ice Punch", "ice", 60, 40),
        "Fusion Flare" to MoveStats("Fusion Flare", "fire", 90, 45),
        "Overheat" to MoveStats("Overheat", "fire", 130, 55),
        "Fusion Bolt" to MoveStats("Fusion Bolt", "electric", 90, 45),
        "Glaciate" to MoveStats("Glaciate", "ice", 60, 40),
        "Disarming Voice" to MoveStats("Disarming Voice", "fairy", 70, 45),
        "Hydro Cannon" to MoveStats("Hydro Cannon", "water", 80, 40),
        "Weather Ball" to MoveStats("Weather Ball", "ice", 60, 35),
        "Weather Ball (Ice)" to MoveStats("Weather Ball (Ice)", "ice", 60, 35),
        "Weather Ball (Fire)" to MoveStats("Weather Ball (Fire)", "fire", 60, 35),
        "Weather Ball (Water)" to MoveStats("Weather Ball (Water)", "water", 60, 35),
        "Weather Ball (Rock)" to MoveStats("Weather Ball (Rock)", "rock", 60, 35),
        "Chilling Water" to MoveStats("Chilling Water", "water", 60, 45),
        "Dazzling Gleam" to MoveStats("Dazzling Gleam", "fairy", 90, 55),
        "Scorching Sands" to MoveStats("Scorching Sands", "ground", 80, 50),
        "Psycho Boost" to MoveStats("Psycho Boost", "psychic", 85, 35),
        "Thunderbolt" to MoveStats("Thunderbolt", "electric", 90, 55),
        "Grass Knot" to MoveStats("Grass Knot", "grass", 90, 50),
        "Sacred Sword" to MoveStats("Sacred Sword", "fighting", 60, 35),
        "Leaf Blade" to MoveStats("Leaf Blade", "grass", 70, 35),
        "Aerial Ace" to MoveStats("Aerial Ace", "flying", 60, 45),
        "Fly" to MoveStats("Fly", "flying", 80, 45),
        "Flame Charge" to MoveStats("Flame Charge", "fire", 65, 50),
        "Blast Burn" to MoveStats("Blast Burn", "fire", 110, 50),
        "Feather Dance" to MoveStats("Feather Dance", "flying", 35, 50),
        "Shadow Sneak" to MoveStats("Shadow Sneak", "ghost", 75, 50),
        "Twister" to MoveStats("Twister", "dragon", 70, 40),
        "Air Cutter" to MoveStats("Air Cutter", "flying", 45, 35),
        "Payback" to MoveStats("Payback", "dark", 110, 60),
        "Body Slam" to MoveStats("Body Slam", "normal", 65, 40),
        "Foul Play" to MoveStats("Foul Play", "dark", 65, 40),
        "Night Slash" to MoveStats("Night Slash", "dark", 50, 35),
        "Cross Chop" to MoveStats("Cross Chop", "fighting", 55, 35),
        "Dynamic Punch" to MoveStats("Dynamic Punch", "fighting", 90, 45),
        "Aura Sphere" to MoveStats("Aura Sphere", "fighting", 80, 40),
        "Focus Blast" to MoveStats("Focus Blast", "fighting", 150, 75),
        "Sludge Bomb" to MoveStats("Sludge Bomb", "poison", 80, 50),
        "Sludge Wave" to MoveStats("Sludge Wave", "poison", 110, 65),
        "Acid Spray" to MoveStats("Acid Spray", "poison", 20, 45),
        "Poison Fang" to MoveStats("Poison Fang", "poison", 50, 40),
        "Cross Poison" to MoveStats("Cross Poison", "poison", 50, 35),
        "Gunk Shot" to MoveStats("Gunk Shot", "poison", 130, 75),
        "Mud Bomb" to MoveStats("Mud Bomb", "ground", 65, 45),
        "Bone Club" to MoveStats("Bone Club", "ground", 55, 35),
        "Shadow Bone" to MoveStats("Shadow Bone", "ghost", 80, 45),
        "Hurricane" to MoveStats("Hurricane", "flying", 110, 60),
        "Acrobatics" to MoveStats("Acrobatics", "flying", 110, 55),
        "Drill Peck" to MoveStats("Drill Peck", "flying", 70, 40),
        "Psychic" to MoveStats("Psychic", "psychic", 75, 55),
        "Psyshock" to MoveStats("Psyshock", "psychic", 70, 40),
        "Psychic Fangs" to MoveStats("Psychic Fangs", "psychic", 40, 35),
        "Lunge" to MoveStats("Lunge", "bug", 70, 45),
        "Megahorn" to MoveStats("Megahorn", "bug", 110, 55),
        "X-Scissor" to MoveStats("X-Scissor", "bug", 65, 40),
        "Power Gem" to MoveStats("Power Gem", "rock", 85, 50),
        "Meteor Beam" to MoveStats("Meteor Beam", "rock", 120, 60),
        "Night Shade" to MoveStats("Night Shade", "ghost", 70, 45),
        "Icy Wind" to MoveStats("Icy Wind", "ice", 60, 45),
        "Triple Axel" to MoveStats("Triple Axel", "ice", 60, 45),
        "Icicle Spear" to MoveStats("Icicle Spear", "ice", 70, 40),
        "Freeze Shock" to MoveStats("Freeze Shock", "ice", 120, 60),
        "Ice Burn" to MoveStats("Ice Burn", "ice", 120, 60),
        "Dragon Pulse" to MoveStats("Dragon Pulse", "dragon", 90, 55),
        "Brutal Swing" to MoveStats("Brutal Swing", "dark", 55, 35),
        "Flash Cannon" to MoveStats("Flash Cannon", "steel", 110, 65),
        "Heavy Slam" to MoveStats("Heavy Slam", "steel", 70, 50),
        "Magnet Bomb" to MoveStats("Magnet Bomb", "steel", 70, 40),
        "Mirror Shot" to MoveStats("Mirror Shot", "steel", 35, 35),
        "Doom Desire" to MoveStats("Doom Desire", "steel", 80, 40),
        "Frenzy Plant" to MoveStats("Frenzy Plant", "grass", 100, 45),
        "Energy Ball" to MoveStats("Energy Ball", "grass", 80, 45),
        "Seed Bomb" to MoveStats("Seed Bomb", "grass", 55, 40),
        "Power Whip" to MoveStats("Power Whip", "grass", 90, 50),
        "Trailblaze" to MoveStats("Trailblaze", "grass", 65, 45),
        "Solar Beam" to MoveStats("Solar Beam", "grass", 150, 80),
        "Discharge" to MoveStats("Discharge", "electric", 55, 40),
        "Zap Cannon" to MoveStats("Zap Cannon", "electric", 150, 80),
        "Scald" to MoveStats("Scald", "water", 85, 50),
        "Liquidation" to MoveStats("Liquidation", "water", 70, 45),
        "Muddy Water" to MoveStats("Muddy Water", "water", 35, 35),
        "Water Pulse" to MoveStats("Water Pulse", "water", 80, 50),
        "Nature's Madness" to MoveStats("Nature's Madness", "fairy", 80, 50),
        "Swift" to MoveStats("Swift", "normal", 55, 35),
        "Hyper Beam" to MoveStats("Hyper Beam", "normal", 150, 80),
        "Aura Wheel" to MoveStats("Aura Wheel", "electric", 100, 45),
        "Rage Fist" to MoveStats("Rage Fist", "ghost", 55, 40),
        "Torch Song" to MoveStats("Torch Song", "fire", 70, 45),
        "Super Power" to MoveStats("Superpower", "fighting", 85, 40),
        "Drum Beating" to MoveStats("Drum Beating", "grass", 60, 35),
        "Gigaton Hammer" to MoveStats("Gigaton Hammer", "steel", 130, 60),
        "Bulldoze" to MoveStats("Bulldoze", "ground", 80, 55),
        "Air Cutter" to MoveStats("Air Cutter", "flying", 45, 35),
        "Rock Tomb" to MoveStats("Rock Tomb", "rock", 75, 50),
        "Sand Tomb" to MoveStats("Sand Tomb", "ground", 55, 45),
        "Thunder Punch" to MoveStats("Thunder Punch", "electric", 60, 40),
        "Flamethrower" to MoveStats("Flamethrower", "fire", 90, 55),
        "Fire Blast" to MoveStats("Fire Blast", "fire", 140, 80),
        "Last Resort" to MoveStats("Last Resort", "normal", 90, 55),
        "Brine" to MoveStats("Brine", "water", 100, 60),
        "Dig" to MoveStats("Dig", "ground", 70, 50),
        "Shadow Punch" to MoveStats("Shadow Punch", "ghost", 55, 35),
        "Spirit Shackle" to MoveStats("Spirit Shackle", "ghost", 50, 40),
        "Darkest Lariat" to MoveStats("Darkest Lariat", "dark", 120, 60),
        "Power-Up Punch" to MoveStats("Power-Up Punch", "fighting", 20, 35),
        "Bubble Beam" to MoveStats("Bubble Beam", "water", 50, 50),
        "Bug Buzz" to MoveStats("Bug Buzz", "bug", 100, 60),
        "Leaf Tornado" to MoveStats("Leaf Tornado", "grass", 45, 40),
        "Stomp" to MoveStats("Stomp", "normal", 55, 40),
        "Petal Blizzard" to MoveStats("Petal Blizzard", "grass", 110, 65),
        "Mystical Fire" to MoveStats("Mystical Fire", "fire", 60, 45),
        "Gyro Ball" to MoveStats("Gyro Ball", "steel", 80, 50),
        "Dive" to MoveStats("Dive", "water", 50, 40),
        "Skull Bash" to MoveStats("Skull Bash", "normal", 130, 75),
        "Beak Blast" to MoveStats("Beak Blast", "flying", 110, 55),
        "Rock Blast" to MoveStats("Rock Blast", "rock", 50, 40),
        "Brick Break" to MoveStats("Brick Break", "fighting", 40, 35),
        "Poltergeist" to MoveStats("Poltergeist", "ghost", 140, 75),
        "Boomburst" to MoveStats("Boomburst", "normal", 150, 70),
        "Fell Stinger" to MoveStats("Fell Stinger", "bug", 20, 35),
        "Volt Tackle" to MoveStats("Volt Tackle", "electric", 90, 40),
        "Psybeam" to MoveStats("Psybeam", "psychic", 70, 60),
        "Heat Wave" to MoveStats("Heat Wave", "fire", 75, 45),
        "Drain Punch" to MoveStats("Drain Punch", "fighting", 40, 40),
        "Fell Stinger+" to MoveStats("Fell Stinger+", "bug", 40, 35),
        "Volt Tackle+" to MoveStats("Volt Tackle+", "electric", 65, 35),
        "Zap Cannon+" to MoveStats("Zap Cannon+", "electric", 70, 45),
        "Acid Spray+" to MoveStats("Acid Spray+", "poison", 20, 40),
        "Liquidation+" to MoveStats("Liquidation+", "water", 55, 40),
        "Outrage+" to MoveStats("Outrage+", "dragon", 80, 50),
        "Dynamic Punch+" to MoveStats("Dynamic Punch+", "fighting", 130, 80),
        "Future Sight+" to MoveStats("Future Sight+", "psychic", 130, 80),
        "Drill Peck+" to MoveStats("Drill Peck+", "flying", 60, 35),
        "Dark Pulse+" to MoveStats("Dark Pulse+", "dark", 60, 40),
        "Night Shade+" to MoveStats("Night Shade+", "ghost", 55, 45),
        "Brave Bird+" to MoveStats("Brave Bird+", "flying", 70, 40),
        "Ominous Wind+" to MoveStats("Ominous Wind+", "ghost", 50, 40),
        "Seed Bomb+" to MoveStats("Seed Bomb+", "grass", 60, 40),
        "Mystical Fire+" to MoveStats("Mystical Fire+", "fire", 50, 40),
        "Surf+" to MoveStats("Surf+", "water", 55, 35),
        "Psybeam+" to MoveStats("Psybeam+", "psychic", 60, 45),
        "Brick Break+" to MoveStats("Brick Break+", "fighting", 40, 35)
    )

    val FAST_MOVE_TURNS: Map<String, Int> = mapOf(
        "ember" to 2,
        "dragon breath" to 1,
        "sand attack" to 1,
        "quick attack" to 2,
        "lock-on" to 1,
        "lock on" to 1,
        "water gun" to 1,
        "lick" to 1,
        "bite" to 1,
        "tackle" to 1,
        "fury cutter" to 1,
        "bug bite" to 1,
        "scratch" to 1,
        "cut" to 1,
        "psycho cut" to 2,
        "mud shot" to 2,
        "shadow claw" to 2,
        "counter" to 2,
        "powder snow" to 2,
        "wing attack" to 2,
        "peck" to 2,
        "poison sting" to 2,
        "thunder shock" to 2,
        "fairy wind" to 2,
        "bullet punch" to 2,
        "fire fang" to 2,
        "vine whip" to 2,
        "karate chop" to 2,
        "low kick" to 2,
        "ice fang" to 2,
        "thunder fang" to 2,
        "metal claw" to 2,
        "metal sound" to 2,
        "sucker punch" to 2,
        "poison jab" to 2,
        "spark" to 2,
        "leafage" to 2,
        "steel wing" to 2,
        "acid" to 2,
        "feint attack" to 2,
        "frost breath" to 2,
        "pound" to 2,
        "razor leaf" to 2,
        "psywave" to 1,
        "force palm" to 3,
        "dragon tail" to 3,
        "waterfall" to 3,
        "fire spin" to 3,
        "snarl" to 3,
        "geomancy" to 3,
        "mud-slap" to 3,
        "mud slap" to 3,
        "charm" to 3,
        "double kick" to 3,
        "air slash" to 3,
        "ice shard" to 3,
        "bubble" to 3,
        "rollout" to 3,
        "smack down" to 3,
        "astonish" to 3,
        "hex" to 3,
        "magical leaf" to 3,
        "bullet seed" to 3,
        "rock throw" to 2,
        "water shuriken" to 3,
        "charge beam" to 3,
        "extrasensory" to 3,
        "hidden power" to 3,
        "infestation" to 3,
        "iron tail" to 3,
        "present" to 3,
        "rock smash" to 3,
        "struggle bug" to 3,
        "take down" to 3,
        "zen headbutt" to 3,
        "gust" to 4,
        "confusion" to 4,
        "volt switch" to 4,
        "splash" to 4,
        "yawn" to 4,
        "incinerate" to 5
    )

    val POKEMON_META_DATABASE: List<PokemonMeta> = listOf<PokemonMeta>(
        // --- Multi-Form & Regional Variants ---
        PokemonMeta("Zacian (Crowned)", "zacian_crowned", "zacian", "Crowned", listOf("fairy", "steel"), 4620, "Metal Claw", 2, "Behemoth Blade", "Close Combat", 52, 48, atk = 332.0, def = 240.0, hp = 192, glRank = 400, ulRank = 300, mlRank = 2, chargedMove3 = "Play Rough", isRawBaseStats = true, defaultIvsGl = "7/9/12", defaultIvsUl = "6/13/15"),
        PokemonMeta("Zacian (Hero)", "zacian_hero", "zacian", "Hero", listOf("fairy"), 4329, "Quick Attack", 2, "Close Combat", "Play Rough", 44, 42, atk = 254.0, def = 236.0, hp = 192, glRank = 420, ulRank = 310, mlRank = 18, chargedMove3 = "Wild Charge", isRawBaseStats = true, defaultIvsGl = "5/7/14", defaultIvsUl = "5/10/13"),
        PokemonMeta("Zamazenta (Crowned)", "zamazenta_crowned", "zamazenta", "Crowned", listOf("fighting", "steel"), 4620, "Metal Claw", 2, "Behemoth Bash", "Close Combat", 46, 48, atk = 250.0, def = 292.0, hp = 192, glRank = 390, ulRank = 280, mlRank = 12, chargedMove3 = "Moonblast", isRawBaseStats = true, defaultIvsGl = "6/13/14", defaultIvsUl = "6/7/14"),
        PokemonMeta("Zamazenta (Hero)", "zamazenta_hero", "zamazenta", "Hero", listOf("fighting"), 4329, "Snarl", 3, "Close Combat", "Crunch", 46, 32, atk = 254.0, def = 236.0, hp = 192, glRank = 410, ulRank = 290, mlRank = 20, chargedMove3 = "Moonblast", isRawBaseStats = true, defaultIvsGl = "5/7/14", defaultIvsUl = "5/10/13"),
        PokemonMeta("Keldeo (Resolute)", "keldeo_resolute", "keldeo", "Resolute", listOf("water", "fighting"), 4181, "Low Kick", 2, "Secret Sword", "Aqua Jet", 42, 38, atk = 260.0, def = 192.0, hp = 209, glRank = 140, ulRank = 65, mlRank = 14, chargedMove3 = "Hydro Pump", isRawBaseStats = true, defaultIvsGl = "12/12/13", defaultIvsUl = "11/14/13"),
        PokemonMeta("Keldeo (Ordinary)", "keldeo_ordinary", "keldeo", "Ordinary", listOf("water", "fighting"), 4181, "Low Kick", 2, "Sacred Sword", "Aqua Jet", 38, 38, atk = 260.0, def = 192.0, hp = 209, glRank = 150, ulRank = 70, mlRank = 19, chargedMove3 = "Hydro Pump", isRawBaseStats = true, defaultIvsGl = "0/0/0", defaultIvsUl = "11/14/13"),
        PokemonMeta("Giratina (Origin)", "giratina_origin", "giratina", "Origin", listOf("ghost", "dragon"), 4164, "Shadow Claw", 2, "Shadow Ball", "Ominous Wind", 46, 22, atk = 225.0, def = 187.0, hp = 284, glRank = 180, ulRank = 35, mlRank = 9, isRawBaseStats = true, defaultIvsGl = "7/9/14", defaultIvsUl = "6/14/9"),
        PokemonMeta("Giratina (Altered)", "giratina_altered", "giratina", "Altered", listOf("ghost", "dragon"), 3820, "Shadow Claw", 2, "Dragon Claw", "Ancient Power", 28, 26, atk = 187.0, def = 225.0, hp = 284, glRank = 190, ulRank = 3, mlRank = 26, isRawBaseStats = true, defaultIvsGl = "6/15/6", defaultIvsUl = "5/15/8"),
        PokemonMeta("Ninetales (Alolan)", "ninetales_alolan", "ninetales", "Alolan", listOf("ice", "fairy"), 2610, "Powder Snow", 2, "Weather Ball (Ice)", "Chilling Water", 34, 46, atk = 170.0, def = 193.0, hp = 177, glRank = 28, ulRank = 25, mlRank = 320, chargedMove3 = "Psyshock", isRawBaseStats = true, defaultIvsGl = "5/15/15", defaultIvsUl = "13/15/14"),
        PokemonMeta("Kanto Ninetales", "ninetales", "ninetales", "Kanto", listOf("fire"), 1498, "Ember", 2, "Weather Ball (Fire)", "Energy Ball", 34, 44, atk = 169.0, def = 190.0, hp = 177, glRank = 11, ulRank = 34, mlRank = 350, chargedMove3 = "Psyshock", isRawBaseStats = true, defaultIvsGl = "4/15/14", defaultIvsUl = "12/15/14"),
        PokemonMeta("Mewtwo (Armored)", "mewtwo_armored", "mewtwo", "Armored", listOf("psychic"), 2499, "Confusion", 4, "Psystrike", "Dynamic Punch", 45, 45, atk = 182.0, def = 278.0, hp = 214, glRank = 420, ulRank = 32, mlRank = 180, chargedMove3 = "Earthquake", isRawBaseStats = true, defaultIvsGl = "10/15/15", defaultIvsUl = "1/15/15"),
        PokemonMeta("Deoxys (Defense)", "deoxys_defense", "deoxys", "Defense", listOf("psychic"), 2570, "Counter", 2, "Psycho Boost", "Thunderbolt", 36, 44, atk = 144.0, def = 330.0, hp = 137, glRank = 24, ulRank = 48, mlRank = 390, isRawBaseStats = true, defaultIvsGl = "12/12/15", defaultIvsUl = "11/13/14"),
        PokemonMeta("Deoxys (Normal)", "deoxys_normal", "deoxys", "Normal", listOf("psychic"), 3573, "Counter", 2, "Psycho Boost", "Thunderbolt", 48, 56, atk = 345.0, def = 115.0, hp = 137, glRank = 650, ulRank = 600, mlRank = 450, isRawBaseStats = true, defaultIvsGl = "11/11/14", defaultIvsUl = "12/13/11"),
        PokemonMeta("Dialga (Origin)", "dialga_origin", "dialga", "Origin", listOf("steel", "dragon"), 4624, "Dragon Breath", 1, "Roar of Time", "Iron Head", 52, 34, atk = 270.0, def = 225.0, hp = 205, glRank = 350, ulRank = 240, mlRank = 3, isRawBaseStats = true, defaultIvsGl = "5/15/8", defaultIvsUl = "7/14/14"),
        PokemonMeta("Dialga", "dialga", "dialga", "Altered", listOf("steel", "dragon"), 4565, "Dragon Breath", 1, "Draco Meteor", "Iron Head", 50, 32, atk = 275.0, def = 211.0, hp = 205, glRank = 360, ulRank = 250, mlRank = 14, isRawBaseStats = true, defaultIvsGl = "7/11/14", defaultIvsUl = "6/14/12"),
        PokemonMeta("Palkia (Origin)", "palkia_origin", "palkia", "Origin", listOf("water", "dragon"), 4683, "Dragon Breath", 1, "Spacial Rend", "Aqua Tail", 46, 28, atk = 286.0, def = 223.0, hp = 189, glRank = 330, ulRank = 210, mlRank = 1, isRawBaseStats = true, defaultIvsGl = "7/15/13", defaultIvsUl = "11/13/15"),
        PokemonMeta("Palkia", "palkia", "palkia", "Altered", listOf("water", "dragon"), 4512, "Dragon Breath", 1, "Aqua Tail", "Draco Meteor", 28, 52, atk = 280.0, def = 215.0, hp = 189, glRank = 340, ulRank = 230, mlRank = 22, isRawBaseStats = true, defaultIvsGl = "5/15/4", defaultIvsUl = "5/10/13"),
        PokemonMeta("Landorus (Therian)", "landorus_therian", "landorus", "Therian", listOf("ground", "flying"), 4434, "Mud Shot", 2, "Sandsear Storm", "Stone Edge", 42, 46, atk = 289.0, def = 179.0, hp = 205, glRank = 280, ulRank = 190, mlRank = 5, isRawBaseStats = true, defaultIvsGl = "6/9/15", defaultIvsUl = "6/15/12"),
        PokemonMeta("Landorus (Incarnate)", "landorus", "landorus", "Incarnate", listOf("ground", "flying"), 4057, "Mud Shot", 2, "Earth Power", "Rock Slide", 44, 36, atk = 261.0, def = 182.0, hp = 205, glRank = 310, ulRank = 210, mlRank = 42, isRawBaseStats = true, defaultIvsGl = "10/13/14", defaultIvsUl = "5/8/11"),
        PokemonMeta("Necrozma (Dusk Mane)", "necrozma_dusk_mane", "necrozma", "Dusk Mane", listOf("psychic", "steel"), 4634, "Shadow Claw", 2, "Sunsteel Strike", "Dark Pulse", 54, 40, atk = 277.0, def = 220.0, hp = 200, glRank = 400, ulRank = 280, mlRank = 4, isRawBaseStats = true, defaultIvsGl = "4/9/14", defaultIvsUl = "4/15/9"),
        PokemonMeta("Necrozma (Dawn Wings)", "necrozma_dawn_wings", "necrozma", "Dawn Wings", listOf("psychic", "ghost"), 4634, "Shadow Claw", 2, "Moongeist Beam", "Dark Pulse", 54, 40, atk = 277.0, def = 220.0, hp = 200, glRank = 405, ulRank = 285, mlRank = 6, isRawBaseStats = true, defaultIvsGl = "4/9/14", defaultIvsUl = "4/15/9"),
        PokemonMeta("Necrozma", "necrozma", "necrozma", "Base", listOf("psychic"), 4163, "Shadow Claw", 2, "Dark Pulse", "Iron Head", 38, 30, atk = 251.0, def = 195.0, hp = 219, glRank = 450, ulRank = 310, mlRank = 65, isRawBaseStats = true, defaultIvsGl = "4/13/13", defaultIvsUl = "4/11/15"),
        PokemonMeta("Kyurem (Black)", "kyurem_black", "kyurem", "Black", listOf("dragon", "ice"), 4605, "Shadow Claw", 2, "Freeze Shock", "Fusion Bolt", 58, 48, atk = 310.0, def = 183.0, hp = 245, glRank = 200, ulRank = 80, mlRank = 1, chargedMove3 = "Outrage", isRawBaseStats = true, defaultIvsGl = "7/10/8", defaultIvsUl = "9/13/14"),
        PokemonMeta("Kyurem (White)", "kyurem_white", "kyurem", "White", listOf("dragon", "ice"), 4605, "Dragon Breath", 1, "Ice Burn", "Fusion Flare", 58, 48, atk = 310.0, def = 183.0, hp = 245, glRank = 210, ulRank = 85, mlRank = 2, chargedMove3 = "Blizzard", isRawBaseStats = true, defaultIvsGl = "7/10/8", defaultIvsUl = "9/13/14"),
        PokemonMeta("Kyurem", "kyurem", "kyurem", "Base", listOf("dragon", "ice"), 4041, "Dragon Breath", 1, "Glaciate", "Dragon Claw", 38, 30, atk = 246.0, def = 170.0, hp = 245, glRank = 310, ulRank = 95, mlRank = 18, chargedMove3 = "Blizzard", isRawBaseStats = true, defaultIvsGl = "9/15/14", defaultIvsUl = "5/8/14"),
        PokemonMeta("Enamorus (Incarnate)", "enamorus", "enamorus", "Incarnate", listOf("fairy", "flying"), 3873, "Fairy Wind", 2, "Fly", "Dazzling Gleam", 42, 48, atk = 281.0, def = 162.0, hp = 179, glRank = 280, ulRank = 130, mlRank = 17, isRawBaseStats = true, defaultIvsGl = "7/13/11", defaultIvsUl = "5/13/9"),
        PokemonMeta("Enamorus (Therian)", "enamorus_therian", "enamorus", "Therian", listOf("fairy", "flying"), 3873, "Fairy Wind", 2, "Fly", "Moonblast", 42, 50, atk = 250.0, def = 201.0, hp = 179, glRank = 290, ulRank = 140, mlRank = 25, isRawBaseStats = true, defaultIvsGl = "4/9/11", defaultIvsUl = "6/15/11"),
        PokemonMeta("Urshifu (Single Strike)", "urshifu_single", "urshifu", "Single", listOf("fighting", "dark"), 4077, "Counter", 2, "Dynamic Punch", "Payback", 44, 52, atk = 254.0, def = 177.0, hp = 225, glRank = 210, ulRank = 110, mlRank = 22, isRawBaseStats = true, defaultIvsGl = "10/12/10", defaultIvsUl = "13/13/14"),
        PokemonMeta("Urshifu (Rapid Strike)", "urshifu_rapid", "urshifu", "Rapid", listOf("fighting", "water"), 4077, "Counter", 2, "Aqua Jet", "Close Combat", 34, 48, atk = 254.0, def = 177.0, hp = 225, glRank = 215, ulRank = 115, mlRank = 24, isRawBaseStats = true, defaultIvsGl = "10/12/10", defaultIvsUl = "13/13/14"),
        PokemonMeta("Sandslash (Alolan)", "sandslash_alolan", "sandslash", "Alolan", listOf("ice", "steel"), 2432, "Powder Snow", 2, "Ice Punch", "Drill Run", 32, 42, atk = 177.0, def = 195.0, hp = 181, glRank = 9, ulRank = 16, mlRank = 350, isRawBaseStats = true, defaultIvsGl = "4/13/15", defaultIvsUl = "4/12/15"),
        PokemonMeta("Sandslash", "sandslash", "sandslash", "Kanto", listOf("ground"), 2374, "Mud Shot", 2, "Scorching Sands", "Night Slash", 42, 28, atk = 182.0, def = 175.0, hp = 181, glRank = 48, ulRank = 75, mlRank = 380, isRawBaseStats = true, defaultIvsGl = "4/15/13", defaultIvsUl = "4/13/14"),
        PokemonMeta("Marowak (Alolan)", "marowak_alolan", "marowak", "Alolan", listOf("fire", "ghost"), 1835, "Fire Spin", 3, "Bone Club", "Shadow Bone", 28, 44, atk = 144.0, def = 186.0, hp = 155, glRank = 35, ulRank = 310, mlRank = 450, isRawBaseStats = true, defaultIvsGl = "4/15/14", defaultIvsUl = "15/15/15"),
        PokemonMeta("Marowak", "marowak", "marowak", "Kanto", listOf("ground"), 1835, "Mud-Slap", 3, "Bone Club", "Rock Slide", 28, 40, atk = 144.0, def = 186.0, hp = 155, glRank = 12, ulRank = 290, mlRank = 440, isRawBaseStats = true, defaultIvsGl = "4/15/14", defaultIvsUl = "15/15/15"),
        PokemonMeta("Stunfisk (Galarian)", "stunfisk_galarian", "stunfisk", "Galarian", listOf("ground", "steel"), 2445, "Mud Shot", 2, "Rock Slide", "Earthquake", 38, 52, atk = 144.0, def = 171.0, hp = 240, glRank = 30, ulRank = 28, mlRank = 340, isRawBaseStats = true, defaultIvsGl = "5/15/13", defaultIvsUl = "15/15/15"),
        PokemonMeta("Stunfisk", "stunfisk", "stunfisk", "Unovan", listOf("ground", "electric"), 2445, "Thunder Shock", 2, "Mud Bomb", "Discharge", 34, 38, atk = 144.0, def = 171.0, hp = 240, glRank = 26, ulRank = 34, mlRank = 350, isRawBaseStats = true, defaultIvsGl = "5/15/13", defaultIvsUl = "15/15/15"),
        PokemonMeta("Muk (Alolan)", "muk_alolan", "muk", "Alolan", listOf("poison", "dark"), 2757, "Poison Jab", 2, "Dark Pulse", "Acid Spray", 40, 20, atk = 190.0, def = 172.0, hp = 233, glRank = 95, ulRank = 22, mlRank = 180, isRawBaseStats = true, defaultIvsGl = "4/15/15", defaultIvsUl = "4/15/15"),
        PokemonMeta("Muk", "muk", "muk", "Kanto", listOf("poison"), 2757, "Poison Jab", 2, "Thunder Punch", "Dark Pulse", 32, 40, atk = 190.0, def = 172.0, hp = 233, glRank = 110, ulRank = 36, mlRank = 190, isRawBaseStats = true, defaultIvsGl = "4/15/15", defaultIvsUl = "4/15/15"),
        PokemonMeta("Weezing (Galarian)", "weezing_galarian", "weezing", "Galarian", listOf("poison", "fairy"), 2488, "Fairy Wind", 2, "Brutal Swing", "Overheat", 34, 62, atk = 174.0, def = 197.0, hp = 163, glRank = 25, ulRank = 11, mlRank = 290, isRawBaseStats = true, defaultIvsGl = "4/14/13", defaultIvsUl = "12/14/13"),
        PokemonMeta("Qwilfish (Hisuian)", "qwilfish_hisuian", "qwilfish", "Hisuian", listOf("dark", "poison"), 2290, "Poison Sting", 2, "Aqua Tail", "Shadow Ball", 30, 44, atk = 184.0, def = 151.0, hp = 163, glRank = 36, ulRank = 90, mlRank = 380, isRawBaseStats = true, defaultIvsGl = "4/14/15", defaultIvsUl = "15/15/15"),

        // --- User Custom Great & Ultra League Team Pokémon ---
        PokemonMeta("Fearow", "fearow", "fearow", "Base", listOf("normal", "flying"), 1500, "Peck", 2, "Drill Run", "Drill Peck", 42, 34, atk = 182.0, def = 133.0, hp = 163, glRank = 85, ulRank = 250, mlRank = 420, isRawBaseStats = true, defaultIvsGl = "4/15/13", defaultIvsUl = "15/15/15"),
        PokemonMeta("Shadow Pidgeot", "pidgeot_shadow", "pidgeot", "Shadow", listOf("normal", "flying"), 1490, "Gust", 4, "Twister", "Brave Bird", 28, 62, atk = 166.0, def = 154.0, hp = 195, glRank = 28, ulRank = 18, mlRank = 310, isRawBaseStats = true, defaultIvsGl = "4/14/12", defaultIvsUl = "15/15/15"),
        PokemonMeta("Pidgeot", "pidgeot", "pidgeot", "Base", listOf("normal", "flying"), 1490, "Gust", 4, "Twister", "Brave Bird", 24, 52, atk = 166.0, def = 154.0, hp = 195, glRank = 32, ulRank = 15, mlRank = 300, isRawBaseStats = true, defaultIvsGl = "4/14/12", defaultIvsUl = "15/15/15"),
        PokemonMeta("Zygarde", "zygarde_complete", "zygarde", "Complete", listOf("dragon", "ground"), 2472, "Dragon Tail", 3, "Crunch", "Earthquake", 32, 52, atk = 184.0, def = 207.0, hp = 389, glRank = 80, ulRank = 1, mlRank = 5, isRawBaseStats = true, defaultIvsGl = "0/0/0", defaultIvsUl = "13/10/15"),
        PokemonMeta("Corviknight", "corviknight", "corviknight", "Base", listOf("flying", "steel"), 2499, "Sand Attack", 1, "Air Cutter", "Iron Head", 32, 34, atk = 163.0, def = 192.0, hp = 221, glRank = 14, ulRank = 7, mlRank = 120, chargedMove3 = "Sky Attack", isRawBaseStats = true, defaultIvsGl = "4/12/14", defaultIvsUl = "4/14/13"),
        PokemonMeta("Mimikyu", "mimikyu", "mimikyu", "Disguised", listOf("ghost", "fairy"), 2497, "Shadow Claw", 2, "Play Rough", "Shadow Sneak", 44, 28, atk = 177.0, def = 199.0, hp = 146, glRank = 40, ulRank = 25, mlRank = 210, chargedMove3 = "Thunder", isRawBaseStats = true, defaultIvsGl = "4/14/15", defaultIvsUl = "13/15/15"),
        PokemonMeta("Aegislash", "aegislash", "aegislash", "Shield", listOf("steel", "ghost"), 1499, "Psycho Cut", 2, "Shadow Ball", "Flash Cannon", 46, 52, atk = 97.0, def = 291.0, hp = 155, glRank = 16, ulRank = 30, mlRank = 240, chargedMove3 = "Gyro Ball", isRawBaseStats = true, defaultIvsGl = "4/15/15", defaultIvsUl = "15/15/15"),
        PokemonMeta("Cramorant", "cramorant", "cramorant", "Gulping", listOf("flying", "water"), 1499, "Peck", 2, "Surf", "Fly", 34, 42, atk = 173.0, def = 163.0, hp = 172, glRank = 26, ulRank = 38, mlRank = 320, chargedMove3 = "Dive", chargedMove4 = "Hydro Pump", isRawBaseStats = true, defaultIvsGl = "4/15/14", defaultIvsUl = "15/15/15"),

        // --- Master League Core Meta ---
        PokemonMeta("Lugia", "lugia", "lugia", "Base", listOf("psychic", "flying"), 4179, "Dragon Tail", 3, "Aeroblast", "Earth Power", 54, 34, atk = 193.0, def = 310.0, hp = 235, glRank = 75, ulRank = 45, mlRank = 12, isRawBaseStats = true, defaultIvsGl = "5/13/12", defaultIvsUl = "5/13/12"),
        PokemonMeta("Kyogre", "kyogre", "kyogre", "Base", listOf("water"), 4652, "Waterfall", 3, "Origin Pulse", "Avalanche", 56, 40, atk = 270.0, def = 228.0, hp = 205, glRank = 310, ulRank = 180, mlRank = 10, isRawBaseStats = true, defaultIvsGl = "6/14/5", defaultIvsUl = "4/9/12"),
        PokemonMeta("Groudon", "groudon", "groudon", "Base", listOf("ground"), 4652, "Mud Shot", 2, "Precipice Blades", "Fire Punch", 55, 26, atk = 270.0, def = 228.0, hp = 205, glRank = 300, ulRank = 175, mlRank = 11, isRawBaseStats = true, defaultIvsGl = "6/14/5", defaultIvsUl = "4/9/12"),
        PokemonMeta("Ho-Oh", "ho_oh", "ho-oh", "Base", listOf("fire", "flying"), 4367, "Incinerate", 5, "Sacred Fire", "Brave Bird", 54, 52, atk = 239.0, def = 244.0, hp = 214, glRank = 140, ulRank = 70, mlRank = 7, isRawBaseStats = true, defaultIvsGl = "7/13/15", defaultIvsUl = "5/15/13"),
        PokemonMeta("Yveltal", "yveltal", "yveltal", "Base", listOf("dark", "flying"), 4275, "Snarl", 3, "Dark Pulse", "Oblivion Wing", 42, 42, atk = 250.0, def = 185.0, hp = 246, glRank = 260, ulRank = 95, mlRank = 8, isRawBaseStats = true, defaultIvsGl = "7/13/11", defaultIvsUl = "4/14/8"),
        PokemonMeta("Xerneas", "xerneas", "xerneas", "Base", listOf("fairy"), 4275, "Geomancy", 3, "Close Combat", "Moonblast", 44, 48, atk = 250.0, def = 185.0, hp = 246, glRank = 270, ulRank = 98, mlRank = 13, isRawBaseStats = true, defaultIvsGl = "7/13/11", defaultIvsUl = "4/14/8"),
        PokemonMeta("Solgaleo", "solgaleo", "solgaleo", "Base", listOf("psychic", "steel"), 4545, "Fire Spin", 3, "Psychic Fangs", "Iron Head", 24, 32, atk = 255.0, def = 191.0, hp = 264, glRank = 290, ulRank = 120, mlRank = 15, isRawBaseStats = true, defaultIvsGl = "4/15/12", defaultIvsUl = "5/13/5"),
        PokemonMeta("Lunala", "lunala", "lunala", "Base", listOf("psychic", "ghost"), 4545, "Shadow Claw", 2, "Shadow Ball", "Moonblast", 46, 48, atk = 255.0, def = 191.0, hp = 264, glRank = 310, ulRank = 140, mlRank = 18, isRawBaseStats = true, defaultIvsGl = "4/15/12", defaultIvsUl = "5/13/5"),
        PokemonMeta("Mewtwo", "mewtwo", "mewtwo", "Base", listOf("psychic"), 4724, "Psycho Cut", 2, "Psystrike", "Shadow Ball", 48, 44, atk = 300.0, def = 182.0, hp = 214, glRank = 380, ulRank = 210, mlRank = 8, isRawBaseStats = true, defaultIvsGl = "4/14/13", defaultIvsUl = "8/13/14"),
        PokemonMeta("Mew", "mew", "mew", "Base", listOf("psychic"), 3691, "Shadow Claw", 2, "Psyshock", "Wild Charge", 38, 45, atk = 210.0, def = 210.0, hp = 225, glRank = 92, ulRank = 78, mlRank = 58, chargedMove3 = "Surf", isRawBaseStats = true, defaultIvsGl = "10/15/13", defaultIvsUl = "10/15/15"),
        PokemonMeta("Rhyperior", "rhyperior", "rhyperior", "Base", listOf("ground", "rock"), 4221, "Mud-Slap", 3, "Rock Wrecker", "Breaking Swipe", 52, 25, atk = 241.0, def = 190.0, hp = 251, glRank = 210, ulRank = 110, mlRank = 9, isRawBaseStats = true, defaultIvsGl = "4/12/8", defaultIvsUl = "5/14/14"),
        PokemonMeta("Dragonite", "dragonite", "dragonite", "Base", listOf("dragon", "flying"), 4287, "Dragon Breath", 1, "Dragon Claw", "Superpower", 30, 42, atk = 263.0, def = 198.0, hp = 209, glRank = 95, ulRank = 52, mlRank = 19, isRawBaseStats = true, defaultIvsGl = "4/13/14", defaultIvsUl = "5/15/13"),
        PokemonMeta("Garchomp", "garchomp", "garchomp", "Base", listOf("dragon", "ground"), 4479, "Mud Shot", 2, "Earth Power", "Outrage", 48, 48, atk = 261.0, def = 193.0, hp = 239, glRank = 220, ulRank = 130, mlRank = 24, isRawBaseStats = true, defaultIvsGl = "4/10/14", defaultIvsUl = "4/15/14"),
        PokemonMeta("Metagross", "metagross", "metagross", "Base", listOf("steel", "psychic"), 4286, "Bullet Punch", 2, "Meteor Mash", "Earthquake", 48, 52, atk = 257.0, def = 228.0, hp = 190, glRank = 290, ulRank = 160, mlRank = 25, isRawBaseStats = true, defaultIvsGl = "4/12/15", defaultIvsUl = "5/14/15"),
        PokemonMeta("Melmetal", "melmetal", "melmetal", "Base", listOf("steel"), 4144, "Thunder Shock", 2, "Superpower", "Rock Slide", 42, 34, atk = 226.0, def = 190.0, hp = 264, glRank = 130, ulRank = 65, mlRank = 23, isRawBaseStats = true, defaultIvsGl = "4/10/14", defaultIvsUl = "4/15/14"),
        PokemonMeta("Florges", "florges", "florges", "Base", listOf("fairy"), 3657, "Fairy Wind", 2, "Disarming Voice", "Moonblast", 30, 48, atk = 212.0, def = 244.0, hp = 186, glRank = 110, ulRank = 38, mlRank = 20, isRawBaseStats = true, defaultIvsGl = "6/13/14", defaultIvsUl = "4/13/15"),
        PokemonMeta("Primarina", "primarina", "primarina", "Base", listOf("water", "fairy"), 3618, "Charm", 3, "Hydro Cannon", "Moonblast", 42, 48, atk = 232.0, def = 195.0, hp = 190, glRank = 90, ulRank = 42, mlRank = 21, isRawBaseStats = true, defaultIvsGl = "7/15/14", defaultIvsUl = "5/14/15"),
        PokemonMeta("Mamoswine", "mamoswine", "mamoswine", "Base", listOf("ice", "ground"), 3763, "Powder Snow", 2, "Avalanche", "High Horsepower", 44, 48, atk = 247.0, def = 146.0, hp = 242, glRank = 190, ulRank = 120, mlRank = 27, isRawBaseStats = true, defaultIvsGl = "4/15/14", defaultIvsUl = "4/14/15"),
        PokemonMeta("Excadrill", "excadrill", "excadrill", "Base", listOf("ground", "steel"), 3667, "Mud Shot", 2, "Drill Run", "Rock Slide", 40, 32, atk = 255.0, def = 129.0, hp = 242, glRank = 230, ulRank = 140, mlRank = 28, isRawBaseStats = true, defaultIvsGl = "4/14/13", defaultIvsUl = "6/15/13"),
        PokemonMeta("Reshiram", "reshiram", "reshiram", "Base", listOf("dragon", "fire"), 4565, "Dragon Breath", 1, "Fusion Flare", "Overheat", 52, 70, atk = 275.0, def = 211.0, hp = 205, glRank = 350, ulRank = 220, mlRank = 29, isRawBaseStats = true, defaultIvsGl = "7/11/14", defaultIvsUl = "6/14/12"),
        PokemonMeta("Zekrom", "zekrom", "zekrom", "Base", listOf("dragon", "electric"), 4565, "Dragon Breath", 1, "Fusion Bolt", "Crunch", 50, 32, atk = 275.0, def = 211.0, hp = 205, glRank = 345, ulRank = 215, mlRank = 30, isRawBaseStats = true, defaultIvsGl = "7/11/14", defaultIvsUl = "6/14/12"),
        PokemonMeta("Raikou", "raikou", "raikou", "Base", listOf("electric"), 3902, "Thunder Shock", 2, "Wild Charge", "Shadow Ball", 48, 44, atk = 241.0, def = 195.0, hp = 207, glRank = 180, ulRank = 115, mlRank = 45, isRawBaseStats = true, defaultIvsGl = "6/12/11", defaultIvsUl = "5/13/13"),
        PokemonMeta("Entei", "entei", "entei", "Base", listOf("fire"), 3926, "Fire Fang", 2, "Flame Charge", "Overheat", 28, 72, atk = 235.0, def = 171.0, hp = 251, glRank = 240, ulRank = 165, mlRank = 55, isRawBaseStats = true, defaultIvsGl = "7/9/11", defaultIvsUl = "6/12/12"),
        PokemonMeta("Suicune", "suicune", "suicune", "Base", listOf("water"), 3372, "Snarl", 3, "Ice Beam", "Hydro Pump", 36, 52, atk = 180.0, def = 235.0, hp = 225, glRank = 170, ulRank = 95, mlRank = 75, isRawBaseStats = true, defaultIvsGl = "5/14/14", defaultIvsUl = "5/15/12"),
        PokemonMeta("Zarude", "zarude", "zarude", "Base", listOf("dark", "grass"), 4334, "Vine Whip", 2, "Dark Pulse", "Power Whip", 40, 44, atk = 242.0, def = 215.0, hp = 233, glRank = 210, ulRank = 95, mlRank = 17, isRawBaseStats = true, defaultIvsGl = "13/11/12", defaultIvsUl = "11/12/10"),
        PokemonMeta("Meloetta", "meloetta_aria", "meloetta", "Aria", listOf("normal", "psychic"), 4490, "Quick Attack", 2, "Psyshock", "Dazzling Gleam", 34, 46, atk = 250.0, def = 225.0, hp = 225, glRank = 260, ulRank = 110, mlRank = 16, isRawBaseStats = true, defaultIvsGl = "12/14/10", defaultIvsUl = "10/12/14"),
        PokemonMeta("Ursaluna", "ursaluna", "ursaluna", "Base", listOf("ground", "normal"), 4358, "Tackle", 1, "Ice Punch", "High Horsepower", 30, 50, atk = 243.0, def = 181.0, hp = 277, glRank = 250, ulRank = 130, mlRank = 21, isRawBaseStats = true, defaultIvsGl = "4/13/7", defaultIvsUl = "4/10/15"),
        PokemonMeta("Togekiss", "togekiss", "togekiss", "Base", listOf("fairy", "flying"), 3767, "Charm", 3, "Ancient Power", "Aura Sphere", 30, 46, atk = 225.0, def = 217.0, hp = 198, glRank = 150, ulRank = 48, mlRank = 24, isRawBaseStats = true, defaultIvsGl = "4/15/15", defaultIvsUl = "5/13/15"),
        PokemonMeta("Gyarados", "gyarados", "gyarados", "Base", listOf("water", "flying"), 3834, "Dragon Breath", 1, "Aqua Tail", "Crunch", 28, 34, atk = 237.0, def = 186.0, hp = 216, glRank = 160, ulRank = 42, mlRank = 26, isRawBaseStats = true, defaultIvsGl = "4/14/7", defaultIvsUl = "5/13/15"),
        PokemonMeta("Snorlax", "snorlax", "snorlax", "Base", listOf("normal"), 3647, "Psywave", 1, "Body Slam", "Earthquake", 26, 52, atk = 190.0, def = 169.0, hp = 330, glRank = 95, ulRank = 38, mlRank = 30, chargedMove3 = "Superpower", isRawBaseStats = true, defaultIvsGl = "4/14/5", defaultIvsUl = "5/15/14"),
        PokemonMeta("Gholdengo", "gholdengo", "gholdengo", "Base", listOf("steel", "ghost"), 3976, "Hex", 3, "Shadow Ball", "Focus Blast", 46, 56, atk = 252.0, def = 190.0, hp = 202, glRank = 280, ulRank = 140, mlRank = 23, isRawBaseStats = true, defaultIvsGl = "4/15/15", defaultIvsUl = "4/14/15"),
        PokemonMeta("Baxcalibur", "baxcalibur", "baxcalibur", "Base", listOf("dragon", "ice"), 4286, "Dragon Breath", 1, "Avalanche", "Dragon Claw", 44, 28, atk = 254.0, def = 168.0, hp = 229, glRank = 90, ulRank = 55, mlRank = 22, isRawBaseStats = true, defaultIvsGl = "4/14/14", defaultIvsUl = "6/15/15"),
        PokemonMeta("Tapu Bulu", "tapu_bulu", "tapu bulu", "Base", listOf("grass", "fairy"), 3865, "Bullet Seed", 3, "Nature's Madness", "Grass Knot", 42, 44, atk = 249.0, def = 215.0, hp = 172, glRank = 290, ulRank = 110, mlRank = 14, isRawBaseStats = true, defaultIvsGl = "4/13/5", defaultIvsUl = "5/8/14"),
        PokemonMeta("Tapu Fini", "tapu_fini", "tapu fini", "Base", listOf("water", "fairy"), 3230, "Water Gun", 1, "Surf", "Nature's Madness", 34, 42, atk = 189.0, def = 254.0, hp = 172, glRank = 32, ulRank = 3, mlRank = 55, isRawBaseStats = true, defaultIvsGl = "5/11/4", defaultIvsUl = "5/11/14"),
        PokemonMeta("Tapu Lele", "tapu_lele", "tapu lele", "Base", listOf("psychic", "fairy"), 3950, "Astonish", 3, "Nature's Madness", "Psyshock", 44, 36, atk = 259.0, def = 208.0, hp = 172, glRank = 300, ulRank = 120, mlRank = 19, isRawBaseStats = true, defaultIvsGl = "5/9/10", defaultIvsUl = "5/14/13"),
        PokemonMeta("Tapu Koko", "tapu_koko", "tapu koko", "Base", listOf("electric", "fairy"), 3582, "Volt Switch", 4, "Nature's Madness", "Brave Bird", 42, 52, atk = 250.0, def = 181.0, hp = 172, glRank = 270, ulRank = 95, mlRank = 35, isRawBaseStats = true, defaultIvsGl = "6/7/15", defaultIvsUl = "6/12/12"),

        // --- Great League & Ultra League Core Meta ---
        PokemonMeta("Clodsire", "clodsire", "clodsire", "Base", listOf("poison", "ground"), 1494, "Poison Sting", 2, "Earthquake", "Stone Edge", 46, 42, atk = 127.0, def = 151.0, hp = 277, glRank = 1, ulRank = 90, mlRank = 400, isRawBaseStats = true, defaultIvsGl = "4/14/10", defaultIvsUl = "15/15/15"),
        PokemonMeta("Feraligatr", "feraligatr", "feraligatr", "Base", listOf("water"), 2488, "Shadow Claw", 2, "Hydro Cannon", "Ice Beam", 44, 38, atk = 205.0, def = 188.0, hp = 198, glRank = 2, ulRank = 2, mlRank = 85, isRawBaseStats = true, defaultIvsGl = "5/11/14", defaultIvsUl = "4/15/11"),
        PokemonMeta("Mandibuzz", "mandibuzz", "mandibuzz", "Base", listOf("dark", "flying"), 2417, "Snarl", 3, "Dark Pulse", "Aerial Ace", 38, 28, atk = 129.0, def = 205.0, hp = 242, glRank = 3, ulRank = 12, mlRank = 280, isRawBaseStats = true, defaultIvsGl = "5/15/13", defaultIvsUl = "15/15/15"),
        PokemonMeta("Azumarill", "azumarill", "azumarill", "Base", listOf("water", "fairy"), 1499, "Bubble", 3, "Ice Beam", "Play Rough", 36, 40, atk = 112.0, def = 152.0, hp = 225, glRank = 4, ulRank = 350, mlRank = 500, isRawBaseStats = true, defaultIvsGl = "4/15/13", defaultIvsUl = "15/15/15"),
        PokemonMeta("Gastrodon", "gastrodon", "gastrodon", "Base", listOf("water", "ground"), 2485, "Mud-Slap", 3, "Body Slam", "Earth Power", 26, 44, atk = 169.0, def = 143.0, hp = 244, glRank = 5, ulRank = 24, mlRank = 310, isRawBaseStats = true, defaultIvsGl = "4/15/14", defaultIvsUl = "12/15/13"),
        PokemonMeta("Malamar", "malamar", "malamar", "Base", listOf("dark", "psychic"), 2488, "Psywave", 1, "Foul Play", "Superpower", 36, 42, atk = 177.0, def = 165.0, hp = 200, glRank = 6, ulRank = 18, mlRank = 320, isRawBaseStats = true, defaultIvsGl = "4/15/15", defaultIvsUl = "4/13/15"),
        PokemonMeta("Dunsparce", "dunsparce", "dunsparce", "Base", listOf("normal"), 1498, "Rollout", 3, "Rock Slide", "Drill Run", 36, 40, atk = 131.0, def = 128.0, hp = 225, glRank = 7, ulRank = 310, mlRank = 480, isRawBaseStats = true, defaultIvsGl = "4/15/13", defaultIvsUl = "15/15/15"),
        PokemonMeta("Annihilape", "annihilape", "annihilape", "Base", listOf("fighting", "ghost"), 3695, "Counter", 2, "Rage Fist", "Ice Punch", 32, 30, atk = 220.0, def = 178.0, hp = 242, glRank = 8, ulRank = 9, mlRank = 32, isRawBaseStats = true, defaultIvsGl = "4/13/13", defaultIvsUl = "5/14/15"),
        PokemonMeta("Primeape", "primeape", "primeape", "Base", listOf("fighting"), 2488, "Karate Chop", 2, "Rage Fist", "Close Combat", 32, 48, atk = 207.0, def = 138.0, hp = 163, glRank = 10, ulRank = 20, mlRank = 340, isRawBaseStats = true, defaultIvsGl = "5/15/15", defaultIvsUl = "12/15/14"),
        PokemonMeta("Cresselia", "cresselia", "cresselia", "Base", listOf("psychic"), 2488, "Psycho Cut", 2, "Grass Knot", "Moonblast", 36, 46, atk = 152.0, def = 258.0, hp = 260, glRank = 11, ulRank = 4, mlRank = 110, isRawBaseStats = true, defaultIvsGl = "4/11/9", defaultIvsUl = "4/11/11"),
        PokemonMeta("Jumpluff", "jumpluff", "jumpluff", "Base", listOf("grass", "flying"), 1498, "Fairy Wind", 2, "Aerial Ace", "Energy Ball", 28, 42, atk = 118.0, def = 183.0, hp = 181, glRank = 13, ulRank = 300, mlRank = 480, isRawBaseStats = true, defaultIvsGl = "4/15/12", defaultIvsUl = "15/15/15"),
        PokemonMeta("Swampert", "swampert", "swampert", "Base", listOf("water", "ground"), 2495, "Mud Shot", 2, "Hydro Cannon", "Earthquake", 44, 52, atk = 208.0, def = 175.0, hp = 225, glRank = 15, ulRank = 14, mlRank = 60, chargedMove3 = "Sludge Wave", chargedMove4 = "Surf", isRawBaseStats = true, defaultIvsGl = "6/15/12", defaultIvsUl = "4/15/14"),
        PokemonMeta("Quagsire", "quagsire", "quagsire", "Base", listOf("water", "ground"), 1499, "Mud Shot", 2, "Aqua Tail", "Stone Edge", 28, 46, atk = 152.0, def = 143.0, hp = 216, glRank = 17, ulRank = 280, mlRank = 450, isRawBaseStats = true, defaultIvsGl = "4/15/10", defaultIvsUl = "15/15/15"),
        PokemonMeta("Whiscash", "whiscash", "whiscash", "Base", listOf("water", "ground"), 1499, "Mud Shot", 2, "Scald", "Mud Bomb", 40, 32, atk = 151.0, def = 141.0, hp = 242, glRank = 19, ulRank = 290, mlRank = 450, isRawBaseStats = true, defaultIvsGl = "4/15/15", defaultIvsUl = "15/15/15"),
        PokemonMeta("Talonflame", "talonflame", "talonflame", "Base", listOf("fire", "flying"), 2493, "Incinerate", 5, "Fly", "Flame Charge", 42, 28, atk = 176.0, def = 155.0, hp = 186, glRank = 18, ulRank = 10, mlRank = 180, isRawBaseStats = true, defaultIvsGl = "4/12/15", defaultIvsUl = "15/15/15"),
        PokemonMeta("Serperior", "serperior", "serperior", "Base", listOf("grass"), 2480, "Vine Whip", 2, "Frenzy Plant", "Aerial Ace", 44, 28, atk = 161.0, def = 204.0, hp = 181, glRank = 20, ulRank = 26, mlRank = 310, isRawBaseStats = true, defaultIvsGl = "4/9/14", defaultIvsUl = "13/15/15"),
        PokemonMeta("Wigglytuff", "wigglytuff", "wigglytuff", "Base", listOf("normal", "fairy"), 1499, "Charm", 3, "Icy Wind", "Swift", 30, 32, atk = 156.0, def = 90.0, hp = 295, glRank = 21, ulRank = 320, mlRank = 480, isRawBaseStats = true, defaultIvsGl = "4/15/15", defaultIvsUl = "15/15/15"),
        PokemonMeta("Clefable", "clefable", "clefable", "Base", listOf("fairy"), 2488, "Fairy Wind", 2, "Meteor Mash", "Swift", 46, 30, atk = 178.0, def = 162.0, hp = 216, glRank = 23, ulRank = 13, mlRank = 240, isRawBaseStats = true, defaultIvsGl = "4/13/14", defaultIvsUl = "4/12/15"),
        PokemonMeta("Skeledirge", "skeledirge", "skeledirge", "Base", listOf("fire", "ghost"), 2491, "Incinerate", 5, "Torch Song", "Shadow Ball", 38, 46, atk = 207.0, def = 178.0, hp = 232, glRank = 22, ulRank = 15, mlRank = 70, chargedMove3 = "Disarming Voice", isRawBaseStats = true, defaultIvsGl = "4/13/11", defaultIvsUl = "6/15/13"),
        PokemonMeta("Lickilicky", "lickilicky", "lickilicky", "Base", listOf("normal"), 2488, "Rollout", 3, "Body Slam", "Shadow Ball", 26, 44, atk = 161.0, def = 181.0, hp = 242, glRank = 27, ulRank = 8, mlRank = 210, isRawBaseStats = true, defaultIvsGl = "4/15/8", defaultIvsUl = "4/13/13"),
        PokemonMeta("Lickitung", "lickitung", "lickitung", "Base", listOf("normal"), 1499, "Lick", 1, "Body Slam", "Power Whip", 26, 42, atk = 108.0, def = 137.0, hp = 207, glRank = 29, ulRank = 400, mlRank = 500, isRawBaseStats = true, defaultIvsGl = "7/15/15", defaultIvsUl = "15/15/15"),
        PokemonMeta("Bastiodon", "bastiodon", "bastiodon", "Base", listOf("rock", "steel"), 1499, "Smack Down", 3, "Stone Edge", "Flamethrower", 42, 38, atk = 94.0, def = 286.0, hp = 155, glRank = 31, ulRank = 400, mlRank = 500, isRawBaseStats = true, defaultIvsGl = "4/15/14", defaultIvsUl = "15/15/15"),
        PokemonMeta("Carbink", "carbink", "carbink", "Base", listOf("rock", "fairy"), 1499, "Rock Throw", 2, "Rock Slide", "Moonblast", 36, 46, atk = 95.0, def = 285.0, hp = 137, glRank = 33, ulRank = 410, mlRank = 500, isRawBaseStats = true, defaultIvsGl = "5/15/13", defaultIvsUl = "15/15/15"),
        PokemonMeta("Registeel", "registeel", "registeel", "Base", listOf("steel"), 2488, "Lock-On", 1, "Focus Blast", "Zap Cannon", 56, 56, atk = 143.0, def = 285.0, hp = 190, glRank = 34, ulRank = 5, mlRank = 190, isRawBaseStats = true, defaultIvsGl = "8/15/14", defaultIvsUl = "4/6/14"),
        PokemonMeta("Skarmory", "skarmory", "skarmory", "Base", listOf("steel", "flying"), 2380, "Steel Wing", 2, "Sky Attack", "Brave Bird", 36, 52, atk = 148.0, def = 226.0, hp = 163, glRank = 37, ulRank = 65, mlRank = 360, isRawBaseStats = true, defaultIvsGl = "4/14/12", defaultIvsUl = "15/15/15"),
        PokemonMeta("Umbreon", "umbreon", "umbreon", "Base", listOf("dark"), 2416, "Snarl", 3, "Foul Play", "Last Resort", 34, 40, atk = 126.0, def = 240.0, hp = 216, glRank = 38, ulRank = 30, mlRank = 340, isRawBaseStats = true, defaultIvsGl = "4/15/9", defaultIvsUl = "15/15/15"),
        PokemonMeta("Lanturn", "lanturn", "lanturn", "Base", listOf("water", "electric"), 1499, "Spark", 2, "Surf", "Thunderbolt", 34, 44, atk = 146.0, def = 137.0, hp = 268, glRank = 39, ulRank = 260, mlRank = 450, isRawBaseStats = true, defaultIvsGl = "5/15/12", defaultIvsUl = "15/15/15"),
        PokemonMeta("Medicham", "medicham", "medicham", "Base", listOf("fighting", "psychic"), 1499, "Counter", 2, "Ice Punch", "Psychic", 28, 38, atk = 121.0, def = 152.0, hp = 155, glRank = 41, ulRank = 420, mlRank = 500, isRawBaseStats = true, defaultIvsGl = "7/15/14", defaultIvsUl = "15/15/15"),
        PokemonMeta("Sableye", "sableye", "sableye", "Base", listOf("dark", "ghost"), 1499, "Shadow Claw", 2, "Foul Play", "Power Gem", 36, 40, atk = 141.0, def = 136.0, hp = 137, glRank = 42, ulRank = 410, mlRank = 500, isRawBaseStats = true, defaultIvsGl = "4/15/15", defaultIvsUl = "15/15/15"),
        PokemonMeta("Drapion", "drapion", "drapion", "Base", listOf("poison", "dark"), 2488, "Poison Sting", 2, "Crunch", "Aqua Tail", 34, 28, atk = 180.0, def = 202.0, hp = 172, glRank = 43, ulRank = 17, mlRank = 260, isRawBaseStats = true, defaultIvsGl = "6/14/15", defaultIvsUl = "4/15/15"),
        PokemonMeta("Toxapex", "toxapex", "toxapex", "Base", listOf("poison", "water"), 1499, "Poison Jab", 2, "Brine", "Sludge Wave", 28, 48, atk = 114.0, def = 273.0, hp = 137, glRank = 44, ulRank = 380, mlRank = 490, isRawBaseStats = true, defaultIvsGl = "4/15/15", defaultIvsUl = "15/15/15"),
        PokemonMeta("Gligar", "gligar", "gligar", "Base", listOf("ground", "flying"), 1499, "Wing Attack", 2, "Aerial Ace", "Dig", 28, 44, atk = 143.0, def = 184.0, hp = 163, glRank = 45, ulRank = 360, mlRank = 490, isRawBaseStats = true, defaultIvsGl = "4/13/15", defaultIvsUl = "15/15/15"),
        PokemonMeta("Gliscor", "gliscor", "gliscor", "Base", listOf("ground", "flying"), 2492, "Wing Attack", 2, "Night Slash", "Earthquake", 28, 52, atk = 185.0, def = 222.0, hp = 181, glRank = 65, ulRank = 29, mlRank = 180, isRawBaseStats = true, defaultIvsGl = "4/14/9", defaultIvsUl = "4/15/11"),
        PokemonMeta("Poliwrath", "poliwrath", "poliwrath", "Base", listOf("water", "fighting"), 2495, "Counter", 2, "Icy Wind", "Scald", 30, 42, atk = 182.0, def = 184.0, hp = 207, glRank = 46, ulRank = 19, mlRank = 190, isRawBaseStats = true, defaultIvsGl = "5/13/15", defaultIvsUl = "4/14/15"),
        PokemonMeta("Pelipper", "pelipper", "pelipper", "Base", listOf("water", "flying"), 1499, "Wing Attack", 2, "Weather Ball", "Hurricane", 32, 52, atk = 175.0, def = 174.0, hp = 155, glRank = 47, ulRank = 280, mlRank = 460, isRawBaseStats = true, defaultIvsGl = "6/15/14", defaultIvsUl = "15/15/15"),
        PokemonMeta("Mantine", "mantine", "mantine", "Base", listOf("water", "flying"), 1499, "Wing Attack", 2, "Aerial Ace", "Ice Beam", 28, 38, atk = 148.0, def = 226.0, hp = 163, glRank = 49, ulRank = 240, mlRank = 440, isRawBaseStats = true, defaultIvsGl = "4/14/12", defaultIvsUl = "15/15/15"),
        PokemonMeta("Dewgong", "dewgong", "dewgong", "Base", listOf("water", "ice"), 1499, "Ice Shard", 3, "Icy Wind", "Drill Run", 30, 40, atk = 139.0, def = 177.0, hp = 207, glRank = 50, ulRank = 290, mlRank = 460, isRawBaseStats = true, defaultIvsGl = "4/15/14", defaultIvsUl = "15/15/15"),
        PokemonMeta("Walrein", "walrein", "walrein", "Base", listOf("ice", "water"), 2492, "Powder Snow", 2, "Icicle Spear", "Earthquake", 32, 52, atk = 182.0, def = 176.0, hp = 242, glRank = 68, ulRank = 33, mlRank = 170, isRawBaseStats = true, defaultIvsGl = "4/14/14", defaultIvsUl = "4/13/14"),
        PokemonMeta("Abomasnow", "abomasnow", "abomasnow", "Base", listOf("grass", "ice"), 2485, "Powder Snow", 2, "Weather Ball", "Energy Ball", 32, 44, atk = 178.0, def = 158.0, hp = 207, glRank = 52, ulRank = 37, mlRank = 280, isRawBaseStats = true, defaultIvsGl = "4/15/15", defaultIvsUl = "4/15/11"),
        PokemonMeta("Trevenant", "trevenant", "trevenant", "Base", listOf("ghost", "grass"), 2492, "Shadow Claw", 2, "Seed Bomb", "Shadow Ball", 32, 46, atk = 201.0, def = 154.0, hp = 198, glRank = 54, ulRank = 31, mlRank = 220, isRawBaseStats = true, defaultIvsGl = "3/13/12", defaultIvsUl = "4/14/10"),
        PokemonMeta("Goodra", "goodra", "goodra", "Base", listOf("dragon"), 2495, "Dragon Breath", 1, "Aqua Tail", "Thunder Punch", 28, 30, atk = 220.0, def = 242.0, hp = 207, glRank = 56, ulRank = 36, mlRank = 85, isRawBaseStats = true, defaultIvsGl = "4/9/12", defaultIvsUl = "5/15/15"),
        PokemonMeta("Guzzlord", "guzzlord", "guzzlord", "Base", listOf("dark", "dragon"), 2492, "Dragon Tail", 3, "Dragon Claw", "Crunch", 28, 34, atk = 188.0, def = 99.0, hp = 440, glRank = 60, ulRank = 21, mlRank = 160, isRawBaseStats = true, defaultIvsGl = "4/13/10", defaultIvsUl = "4/15/14"),
        PokemonMeta("Morpeko", "morpeko", "morpeko", "Full Belly", listOf("electric", "dark"), 1499, "Thunder Shock", 2, "Aura Wheel", "Psychic Fangs", 52, 24, atk = 192.0, def = 121.0, hp = 151, glRank = 15, ulRank = 340, mlRank = 480, isRawBaseStats = true, defaultIvsGl = "5/14/15", defaultIvsUl = "15/15/15"),
        PokemonMeta("Dusknoir", "dusknoir", "dusknoir", "Base", listOf("ghost"), 2480, "Astonish", 3, "Shadow Punch", "Dynamic Punch", 28, 42, atk = 180.0, def = 254.0, hp = 128, glRank = 55, ulRank = 40, mlRank = 290, isRawBaseStats = true, defaultIvsGl = "5/15/11", defaultIvsUl = "4/13/15"),
        PokemonMeta("Pangoro", "pangoro", "pangoro", "Base", listOf("fighting", "dark"), 2492, "Karate Chop", 2, "Night Slash", "Close Combat", 28, 48, atk = 226.0, def = 146.0, hp = 216, glRank = 59, ulRank = 27, mlRank = 180, isRawBaseStats = true, defaultIvsGl = "4/15/14", defaultIvsUl = "4/15/15"),
        PokemonMeta("Greedent", "greedent", "greedent", "Base", listOf("normal"), 2485, "Mud Shot", 2, "Body Slam", "Crunch", 26, 34, atk = 160.0, def = 156.0, hp = 260, glRank = 64, ulRank = 23, mlRank = 290, isRawBaseStats = true, defaultIvsGl = "5/15/14", defaultIvsUl = "4/15/15"),
        PokemonMeta("Dubwool", "dubwool", "dubwool", "Base", listOf("normal"), 2478, "Double Kick", 3, "Body Slam", "Payback", 26, 50, atk = 159.0, def = 198.0, hp = 176, glRank = 66, ulRank = 39, mlRank = 300, isRawBaseStats = true, defaultIvsGl = "5/14/14", defaultIvsUl = "15/15/15"),
        PokemonMeta("Ampharos", "ampharos", "ampharos", "Base", listOf("electric"), 2495, "Volt Switch", 4, "Brutal Swing", "Trailblaze", 32, 34, atk = 211.0, def = 169.0, hp = 207, glRank = 92, ulRank = 41, mlRank = 210, isRawBaseStats = true, defaultIvsGl = "4/14/12", defaultIvsUl = "4/12/15"),
        PokemonMeta("Tentacruel", "tentacruel", "tentacruel", "Base", listOf("water", "poison"), 2485, "Poison Jab", 2, "Scald", "Acid Spray", 40, 20, atk = 166.0, def = 209.0, hp = 190, glRank = 70, ulRank = 18, mlRank = 260, isRawBaseStats = true, defaultIvsGl = "4/15/15", defaultIvsUl = "4/14/14"),
        PokemonMeta("Cobalion", "cobalion", "cobalion", "Base", listOf("steel", "fighting"), 2492, "Double Kick", 3, "Sacred Sword", "Stone Edge", 38, 42, atk = 192.0, def = 229.0, hp = 209, glRank = 95, ulRank = 6, mlRank = 90, isRawBaseStats = true, defaultIvsGl = "4/10/4", defaultIvsUl = "6/15/11"),
        PokemonMeta("Virizion", "virizion", "virizion", "Base", listOf("grass", "fighting"), 2490, "Double Kick", 3, "Sacred Sword", "Leaf Blade", 38, 36, atk = 192.0, def = 229.0, hp = 209, glRank = 110, ulRank = 8, mlRank = 95, isRawBaseStats = true, defaultIvsGl = "4/10/4", defaultIvsUl = "6/15/11"),
        PokemonMeta("Venusaur", "venusaur", "venusaur", "Base", listOf("grass", "poison"), 2495, "Vine Whip", 2, "Frenzy Plant", "Sludge Bomb", 46, 40, atk = 198.0, def = 189.0, hp = 190, glRank = 72, ulRank = 44, mlRank = 220, isRawBaseStats = true, defaultIvsGl = "4/13/14", defaultIvsUl = "4/14/15"),
        PokemonMeta("Charizard", "charizard", "charizard", "Base", listOf("fire", "flying"), 2495, "Wing Attack", 2, "Blast Burn", "Dragon Claw", 50, 28, atk = 223.0, def = 173.0, hp = 186, glRank = 78, ulRank = 46, mlRank = 190, isRawBaseStats = true, defaultIvsGl = "5/14/15", defaultIvsUl = "4/13/14"),
        PokemonMeta("Blastoise", "blastoise", "blastoise", "Base", listOf("water"), 2466, "Rollout", 3, "Hydro Cannon", "Ice Beam", 44, 38, atk = 171.0, def = 207.0, hp = 188, glRank = 62, ulRank = 43, mlRank = 250, isRawBaseStats = true, defaultIvsGl = "4/8/15", defaultIvsUl = "5/15/15"),
        PokemonMeta("Greninja", "greninja", "greninja", "Base", listOf("water", "dark"), 2492, "Water Shuriken", 3, "Hydro Cannon", "Brutal Swing", 44, 34, atk = 223.0, def = 152.0, hp = 176, glRank = 74, ulRank = 35, mlRank = 210, chargedMove3 = "Night Slash", isRawBaseStats = true, defaultIvsGl = "5/12/12", defaultIvsUl = "4/13/15"),
        PokemonMeta("Chesnaught", "chesnaught", "chesnaught", "Base", listOf("grass", "fighting"), 2492, "Vine Whip", 2, "Frenzy Plant", "Superpower", 46, 42, atk = 201.0, def = 204.0, hp = 204, glRank = 67, ulRank = 50, mlRank = 160, isRawBaseStats = true, defaultIvsGl = "4/14/9", defaultIvsUl = "4/15/11"),
        PokemonMeta("Typhlosion", "typhlosion", "typhlosion", "Base", listOf("fire"), 2495, "Incinerate", 5, "Blast Burn", "Thunder Punch", 50, 30, atk = 223.0, def = 173.0, hp = 186, glRank = 76, ulRank = 47, mlRank = 230, isRawBaseStats = true, defaultIvsGl = "5/14/15", defaultIvsUl = "4/13/14"),
        PokemonMeta("Decidueye", "decidueye", "decidueye", "Base", listOf("grass", "ghost"), 2492, "Astonish", 3, "Frenzy Plant", "Spirit Shackle", 46, 36, atk = 210.0, def = 179.0, hp = 186, glRank = 79, ulRank = 54, mlRank = 240, isRawBaseStats = true, defaultIvsGl = "4/14/14", defaultIvsUl = "4/14/12"),
        PokemonMeta("Incineroar", "incineroar", "incineroar", "Base", listOf("fire", "dark"), 2495, "Snarl", 3, "Blast Burn", "Darkest Lariat", 50, 44, atk = 214.0, def = 175.0, hp = 216, glRank = 88, ulRank = 52, mlRank = 170, isRawBaseStats = true, defaultIvsGl = "4/15/12", defaultIvsUl = "4/15/14"),
        PokemonMeta("Empoleon", "empoleon", "empoleon", "Base", listOf("water", "steel"), 2495, "Steel Wing", 2, "Hydro Cannon", "Drill Peck", 44, 34, atk = 210.0, def = 186.0, hp = 197, glRank = 71, ulRank = 49, mlRank = 180, isRawBaseStats = true, defaultIvsGl = "5/15/13", defaultIvsUl = "6/15/14"),
        PokemonMeta("Machamp", "machamp", "machamp", "Base", listOf("fighting"), 2495, "Karate Chop", 2, "Cross Chop", "Stone Edge", 28, 44, atk = 234.0, def = 159.0, hp = 207, glRank = 73, ulRank = 51, mlRank = 120, isRawBaseStats = true, defaultIvsGl = "5/15/12", defaultIvsUl = "4/15/14"),
        PokemonMeta("Scrafty", "scrafty", "scrafty", "Base", listOf("dark", "fighting"), 2283, "Counter", 2, "Foul Play", "Power-Up Punch", 36, 20, atk = 163.0, def = 222.0, hp = 163, glRank = 82, ulRank = 58, mlRank = 340, isRawBaseStats = true, defaultIvsGl = "4/15/14", defaultIvsUl = "12/12/14"),
        PokemonMeta("Obstagoon", "obstagoon", "obstagoon", "Base", listOf("dark", "normal"), 2492, "Counter", 2, "Night Slash", "Cross Chop", 28, 28, atk = 180.0, def = 194.0, hp = 212, glRank = 84, ulRank = 56, mlRank = 210, isRawBaseStats = true, defaultIvsGl = "5/15/12", defaultIvsUl = "4/15/14"),
        PokemonMeta("Diggersby", "diggersby", "diggersby", "Base", listOf("normal", "ground"), 1499, "Quick Attack", 2, "Scorching Sands", "Fire Punch", 40, 28, atk = 112.0, def = 155.0, hp = 198, glRank = 36, ulRank = 380, mlRank = 490, isRawBaseStats = true, defaultIvsGl = "4/15/14", defaultIvsUl = "15/15/15"),
        PokemonMeta("Jellicent", "jellicent", "jellicent", "Base", listOf("water", "ghost"), 2488, "Hex", 3, "Surf", "Shadow Ball", 34, 46, atk = 159.0, def = 178.0, hp = 225, glRank = 61, ulRank = 28, mlRank = 270, isRawBaseStats = true, defaultIvsGl = "4/15/14", defaultIvsUl = "12/14/12"),
        PokemonMeta("Cofagrigus", "cofagrigus", "cofagrigus", "Base", listOf("ghost"), 2480, "Shadow Claw", 2, "Shadow Ball", "Dark Pulse", 46, 38, atk = 163.0, def = 237.0, hp = 151, glRank = 86, ulRank = 60, mlRank = 310, isRawBaseStats = true, defaultIvsGl = "6/13/14", defaultIvsUl = "12/12/15"),
        PokemonMeta("Runerigus", "runerigus", "runerigus", "Base", listOf("ground", "ghost"), 2480, "Shadow Claw", 2, "Sand Tomb", "Shadow Ball", 24, 46, atk = 163.0, def = 237.0, hp = 151, glRank = 89, ulRank = 62, mlRank = 315, isRawBaseStats = true, defaultIvsGl = "6/13/14", defaultIvsUl = "12/12/15"),
        PokemonMeta("Ferrothorn", "ferrothorn", "ferrothorn", "Base", listOf("grass", "steel"), 2480, "Bullet Seed", 3, "Power Whip", "Thunder", 42, 44, atk = 158.0, def = 223.0, hp = 179, glRank = 51, ulRank = 64, mlRank = 290, isRawBaseStats = true, defaultIvsGl = "4/8/15", defaultIvsUl = "13/14/15"),
        PokemonMeta("Galvantula", "galvantula", "galvantula", "Base", listOf("bug", "electric"), 2494, "Volt Switch", 4, "Lunge", "Discharge", 32, 36, atk = 201.0, def = 128.0, hp = 172, glRank = 87, ulRank = 68, mlRank = 350, isRawBaseStats = true, defaultIvsGl = "4/15/9", defaultIvsUl = "15/15/15"),
        PokemonMeta("Araquanid", "araquanid", "araquanid", "Base", listOf("water", "bug"), 1499, "Bug Bite", 1, "Bubble Beam", "Bug Buzz", 22, 44, atk = 126.0, def = 219.0, hp = 169, glRank = 53, ulRank = 320, mlRank = 480, isRawBaseStats = true, defaultIvsGl = "5/15/14", defaultIvsUl = "15/15/15"),
        PokemonMeta("Golisopod", "golisopod", "golisopod", "Base", listOf("bug", "water"), 2495, "Shadow Claw", 2, "Liquidation", "X-Scissor", 36, 32, atk = 218.0, def = 226.0, hp = 181, glRank = 69, ulRank = 24, mlRank = 150, isRawBaseStats = true, defaultIvsGl = "4/15/13", defaultIvsUl = "5/13/15"),
        PokemonMeta("Altaria", "altaria", "altaria", "Base", listOf("dragon", "flying"), 1499, "Dragon Breath", 1, "Sky Attack", "Moonblast", 36, 48, atk = 141.0, def = 201.0, hp = 181, glRank = 63, ulRank = 310, mlRank = 470, isRawBaseStats = true, defaultIvsGl = "4/12/13", defaultIvsUl = "15/15/15"),
        PokemonMeta("Noctowl", "noctowl", "noctowl", "Base", listOf("normal", "flying"), 1499, "Wing Attack", 2, "Sky Attack", "Shadow Ball", 36, 44, atk = 145.0, def = 156.0, hp = 225, glRank = 90, ulRank = 340, mlRank = 480, isRawBaseStats = true, defaultIvsGl = "4/14/14", defaultIvsUl = "15/15/15"),
        PokemonMeta("Vigoroth", "vigoroth", "vigoroth", "Base", listOf("normal"), 1499, "Counter", 2, "Body Slam", "Rock Slide", 26, 36, atk = 159.0, def = 145.0, hp = 190, glRank = 77, ulRank = 360, mlRank = 490, isRawBaseStats = true, defaultIvsGl = "4/15/14", defaultIvsUl = "15/15/15"),
        PokemonMeta("Toxicroak", "toxicroak", "toxicroak", "Base", listOf("poison", "fighting"), 2488, "Mud Shot", 2, "Mud Bomb", "Shadow Ball", 32, 44, atk = 211.0, def = 133.0, hp = 195, glRank = 81, ulRank = 57, mlRank = 290, isRawBaseStats = true, defaultIvsGl = "4/15/9", defaultIvsUl = "4/15/14"),
        PokemonMeta("Nidoqueen", "nidoqueen", "nidoqueen", "Base", listOf("poison", "ground"), 2488, "Poison Jab", 2, "Poison Fang", "Earth Power", 24, 46, atk = 180.0, def = 173.0, hp = 207, glRank = 83, ulRank = 59, mlRank = 260, isRawBaseStats = true, defaultIvsGl = "4/14/13", defaultIvsUl = "4/13/15"),
        PokemonMeta("Steelix", "steelix", "steelix", "Base", listOf("steel", "ground"), 2485, "Dragon Tail", 3, "Breaking Swipe", "Earthquake", 24, 52, atk = 148.0, def = 272.0, hp = 181, glRank = 80, ulRank = 30, mlRank = 250, isRawBaseStats = true, defaultIvsGl = "4/11/14", defaultIvsUl = "4/14/15"),
        PokemonMeta("Tinkaton", "tinkaton", "tinkaton", "Base", listOf("fairy", "steel"), 2488, "Fairy Wind", 2, "Gigaton Hammer", "Bulldoze", 42, 36, atk = 155.0, def = 196.0, hp = 198, glRank = 40, ulRank = 32, mlRank = 260, chargedMove3 = "Play Rough", chargedMove4 = "Heavy Slam", isRawBaseStats = true, defaultIvsGl = "4/15/14", defaultIvsUl = "12/15/15"),
        PokemonMeta("Rillaboom", "rillaboom", "rillaboom", "Base", listOf("grass"), 2485, "Scratch", 1, "Drum Beating", "Earth Power", 36, 44, atk = 239.0, def = 168.0, hp = 225, glRank = 82, ulRank = 45, mlRank = 88, chargedMove3 = "Frenzy Plant", isRawBaseStats = true, defaultIvsGl = "5/15/13", defaultIvsUl = "4/14/15"),
        PokemonMeta("Cetitan", "cetitan", "cetitan", "Base", listOf("ice"), 2495, "Powder Snow", 2, "Body Slam", "Avalanche", 26, 44, atk = 208.0, def = 123.0, hp = 347, glRank = 57, ulRank = 38, mlRank = 95, isRawBaseStats = true, defaultIvsGl = "4/13/10", defaultIvsUl = "4/15/15"),
        PokemonMeta("Bellibolt", "bellibolt", "bellibolt", "Base", listOf("electric"), 2492, "Sucker Punch", 2, "Discharge", "Zap Cannon", 34, 56, atk = 184.0, def = 165.0, hp = 240, glRank = 75, ulRank = 42, mlRank = 220, isRawBaseStats = true, defaultIvsGl = "4/15/12", defaultIvsUl = "4/15/15"),
        PokemonMeta("Toucannon", "toucannon", "toucannon", "Base", listOf("normal", "flying"), 2488, "Bullet Seed", 3, "Beak Blast", "Drill Peck", 42, 34, atk = 222.0, def = 146.0, hp = 190, glRank = 95, ulRank = 88, mlRank = 290, chargedMove3 = "Rock Blast", isRawBaseStats = true, defaultIvsGl = "4/14/15", defaultIvsUl = "4/15/15"),
        PokemonMeta("Golurk", "golurk", "golurk", "Base", listOf("ground", "ghost"), 2488, "Mud-Slap", 3, "Shadow Punch", "Dynamic Punch", 28, 42, atk = 222.0, def = 154.0, hp = 205, glRank = 45, ulRank = 42, mlRank = 240, chargedMove3 = "Earth Power", chargedMove4 = "Poltergeist", isRawBaseStats = true, defaultIvsGl = "4/15/14", defaultIvsUl = "4/15/15"),
        PokemonMeta("Dondozo", "dondozo", "dondozo", "Base", listOf("water"), 2488, "Waterfall", 3, "Surf", "Liquidation", 34, 38, atk = 178.0, def = 178.0, hp = 312, glRank = 55, ulRank = 35, mlRank = 180, chargedMove3 = "Body Slam", isRawBaseStats = true, defaultIvsGl = "4/15/14", defaultIvsUl = "4/15/15"),
        PokemonMeta("Volcanion", "volcanion", "volcanion", "Base", listOf("fire", "water"), 3985, "Incinerate", 5, "Overheat", "Earth Power", 64, 46, atk = 252.0, def = 216.0, hp = 190, glRank = 140, ulRank = 65, mlRank = 28, chargedMove3 = "Sludge Bomb", chargedMove4 = "Hydro Pump", isRawBaseStats = true, defaultIvsGl = "10/14/14", defaultIvsUl = "10/15/15"),
        PokemonMeta("Kommo-o", "kommo_o", "kommo-o", "Base", listOf("dragon", "fighting"), 2488, "Dragon Tail", 3, "Clanging Scales", "Close Combat", 48, 46, atk = 222.0, def = 240.0, hp = 181, glRank = 48, ulRank = 30, mlRank = 95, chargedMove3 = "Brick Break", chargedMove4 = "Boomburst", isRawBaseStats = true, defaultIvsGl = "4/14/15", defaultIvsUl = "4/15/14"),
        PokemonMeta("Regidrago", "regidrago", "regidrago", "Base", listOf("dragon"), 2488, "Dragon Breath", 1, "Breaking Swipe", "Outrage", 26, 48, atk = 202.0, def = 101.0, hp = 400, glRank = 62, ulRank = 36, mlRank = 110, chargedMove3 = "Dragon Pulse", isRawBaseStats = true, defaultIvsGl = "4/15/14", defaultIvsUl = "4/15/15"),
        // --- Super Mega (Mega Level 4 Fixed 3rd '+' Charged Move) Species ---
        PokemonMeta("Beedrill (Mega)", "beedrill_mega", "beedrill", "Mega", listOf("bug", "poison"), 3824, "Poison Jab", 2, "Drill Run", "X-Scissor", 38, 32, atk = 303.0, def = 148.0, hp = 163, glRank = 60, ulRank = 45, mlRank = 80, chargedMove3 = "Sludge Bomb", isRawBaseStats = true),
        PokemonMeta("Raichu (Mega X)", "raichu_mega_x", "raichu", "Mega X", listOf("electric"), 3768, "Volt Switch", 4, "Wild Charge", "Surf", 48, 34, atk = 277.0, def = 203.0, hp = 155, glRank = 40, ulRank = 30, mlRank = 50, chargedMove3 = "Brick Break", isRawBaseStats = true),
        PokemonMeta("Raichu (Mega Y)", "raichu_mega_y", "raichu", "Mega Y", listOf("electric"), 4020, "Volt Switch", 4, "Wild Charge", "Surf", 48, 34, atk = 339.0, def = 157.0, hp = 155, glRank = 42, ulRank = 32, mlRank = 48, chargedMove3 = "Trailblaze", isRawBaseStats = true),
        PokemonMeta("Victreebel (Mega)", "victreebel_mega", "victreebel", "Mega", listOf("grass", "poison"), 3762, "Magical Leaf", 3, "Leaf Blade", "Sludge Bomb", 38, 42, atk = 265.0, def = 181.0, hp = 190, glRank = 55, ulRank = 40, mlRank = 70, chargedMove3 = "Leaf Tornado", isRawBaseStats = true),
        PokemonMeta("Starmie (Mega)", "starmie_mega", "starmie", "Mega", listOf("water", "psychic"), 4125, "Psywave", 1, "Surf", "Power Gem", 34, 42, atk = 276.0, def = 229.0, hp = 155, glRank = 20, ulRank = 18, mlRank = 35, chargedMove3 = "Ice Beam", isRawBaseStats = true),
        PokemonMeta("Dragonite (Mega)", "dragonite_mega", "dragonite", "Mega", listOf("dragon", "flying"), 5280, "Dragon Breath", 1, "Dragon Claw", "Superpower", 34, 42, atk = 299.0, def = 255.0, hp = 209, glRank = 35, ulRank = 20, mlRank = 3, chargedMove3 = "Thunder Punch", isRawBaseStats = true),
        PokemonMeta("Mewtwo (Mega X)", "mewtwo_mega_x", "mewtwo", "Mega X", listOf("psychic", "fighting"), 6450, "Psycho Cut", 2, "Psystrike", "Shadow Ball", 50, 44, atk = 399.0, def = 215.0, hp = 228, glRank = 30, ulRank = 15, mlRank = 2, chargedMove3 = "Ice Beam", isRawBaseStats = true),
        PokemonMeta("Mewtwo (Mega Y)", "mewtwo_mega_y", "mewtwo", "Mega Y", listOf("psychic"), 6806, "Psycho Cut", 2, "Psystrike", "Shadow Ball", 52, 46, atk = 413.0, def = 223.0, hp = 228, glRank = 28, ulRank = 12, mlRank = 1, chargedMove3 = "Focus Blast", isRawBaseStats = true),
        PokemonMeta("Skarmory (Mega)", "skarmory_mega", "skarmory", "Mega", listOf("steel", "flying"), 3960, "Steel Wing", 2, "Sky Attack", "Drill Run", 36, 38, atk = 273.0, def = 228.0, hp = 163, glRank = 15, ulRank = 14, mlRank = 40, chargedMove3 = "Brave Bird", isRawBaseStats = true),
        PokemonMeta("Houndoom (Mega)", "houndoom_mega", "houndoom", "Mega", listOf("dark", "fire"), 4344, "Snarl", 3, "Foul Play", "Flamethrower", 36, 44, atk = 289.0, def = 194.0, hp = 181, glRank = 50, ulRank = 35, mlRank = 55, chargedMove3 = "Crunch", isRawBaseStats = true),
        PokemonMeta("Sableye (Mega)", "sableye_mega", "sableye", "Mega", listOf("dark", "ghost"), 2198, "Shadow Claw", 2, "Foul Play", "Power Gem", 36, 42, atk = 151.0, def = 216.0, hp = 137, glRank = 1, ulRank = 60, mlRank = 200, chargedMove3 = "Dazzling Gleam", isRawBaseStats = true),
        PokemonMeta("Staraptor (Mega)", "staraptor_mega", "staraptor", "Mega", listOf("fighting", "flying"), 4326, "Sand Attack", 1, "Close Combat", "Fly", 48, 42, atk = 278.0, def = 207.0, hp = 198, glRank = 25, ulRank = 22, mlRank = 38, chargedMove3 = "Brave Bird", isRawBaseStats = true),
        PokemonMeta("Chandelure (Mega)", "chandelure_mega", "chandelure", "Mega", listOf("ghost", "fire"), 4668, "Incinerate", 5, "Shadow Ball", "Flame Charge", 48, 36, atk = 335.0, def = 227.0, hp = 155, glRank = 45, ulRank = 28, mlRank = 25, chargedMove3 = "Overheat", isRawBaseStats = true),
        PokemonMeta("Chesnaught (Mega)", "chesnaught_mega", "chesnaught", "Mega", listOf("grass", "fighting"), 4656, "Vine Whip", 2, "Frenzy Plant", "Superpower", 46, 42, atk = 242.0, def = 282.0, hp = 204, glRank = 12, ulRank = 8, mlRank = 12, chargedMove3 = "Thunder Punch", isRawBaseStats = true),
        PokemonMeta("Delphox (Mega)", "delphox_mega", "delphox", "Mega", listOf("fire", "psychic"), 4915, "Fire Spin", 3, "Blast Burn", "Psyshock", 50, 38, atk = 331.0, def = 235.0, hp = 181, glRank = 38, ulRank = 24, mlRank = 18, chargedMove3 = "Flame Charge", isRawBaseStats = true),
        PokemonMeta("Greninja (Mega)", "greninja_mega", "greninja", "Mega", listOf("water", "dark"), 3964, "Water Shuriken", 3, "Hydro Cannon", "Night Slash", 44, 34, atk = 299.0, def = 180.0, hp = 176, glRank = 8, ulRank = 6, mlRank = 16, chargedMove3 = "Brutal Swing", isRawBaseStats = true),
        PokemonMeta("Malamar (Mega)", "malamar_mega", "malamar", "Mega", listOf("dark", "psychic"), 3540, "Psywave", 1, "Foul Play", "Superpower", 36, 42, atk = 208.0, def = 222.0, hp = 200, glRank = 4, ulRank = 5, mlRank = 32, chargedMove3 = "Hyper Beam", isRawBaseStats = true),
        PokemonMeta("Falinks (Mega)", "falinks_mega", "falinks", "Mega", listOf("fighting"), 3920, "Counter", 2, "Superpower", "Megahorn", 42, 48, atk = 267.0, def = 229.0, hp = 163, glRank = 18, ulRank = 15, mlRank = 42, chargedMove3 = "Brick Break", isRawBaseStats = true)
    )

    val FALLBACK_SPECIES_FAST_POOL: Map<String, List<String>> = mapOf(
        "tinkaton" to listOf("Fairy Wind", "Rock Smash"),
        "mimikyu" to listOf("Shadow Claw", "Hex"),
        "swampert" to listOf("Mud Shot", "Water Gun"),
        "feraligatr" to listOf("Shadow Claw", "Waterfall", "Ice Fang"),
        "clodsire" to listOf("Poison Sting", "Mud Shot"),
        "azumarill" to listOf("Bubble", "Rock Smash"),
        "annihilape" to listOf("Counter", "Low Kick"),
        "primeape" to listOf("Karate Chop", "Counter"),
        "mandibuzz" to listOf("Snarl", "Air Slash"),
        "talonflame" to listOf("Incinerate", "Fire Spin", "Peck"),
        "skeledirge" to listOf("Incinerate", "Bite"),
        "cresselia" to listOf("Psycho Cut", "Confusion"),
        "giratina_altered" to listOf("Shadow Claw", "Dragon Breath"),
        "giratina_origin" to listOf("Shadow Claw", "Dragon Tail"),
        "poliwrath" to listOf("Counter", "Mud Shot", "Bubble"),
        "gastrodon" to listOf("Mud-Slap", "Hidden Power"),
        "quagsire" to listOf("Mud Shot", "Water Gun"),
        "whiscash" to listOf("Mud Shot", "Water Gun"),
        "lickilicky" to listOf("Rollout", "Lick"),
        "serperior" to listOf("Vine Whip", "Iron Tail"),
        "corviknight" to listOf("Sand Attack", "Steel Wing", "Air Slash"),
        "aegislash" to listOf("Psycho Cut", "Air Slash"),
        "cramorant" to listOf("Peck", "Water Gun"),
        "morpeko" to listOf("Thunder Shock", "Bite", "Charge Beam"),
        "palkia_origin" to listOf("Dragon Breath", "Dragon Tail"),
        "dialga_origin" to listOf("Dragon Breath", "Metal Claw"),
        "zacian_crowned" to listOf("Metal Claw", "Snarl", "Quick Attack"),
        "zacian_hero" to listOf("Snarl", "Quick Attack", "Metal Claw"),
        "zamazenta_crowned" to listOf("Metal Claw", "Snarl", "Ice Fang"),
        "kyurem_black" to listOf("Shadow Claw", "Dragon Tail"),
        "kyurem_white" to listOf("Dragon Breath", "Ice Fang", "Steel Wing"),
        "landorus_therian" to listOf("Mud Shot", "Extrasensory"),
        "ho_oh" to listOf("Incinerate", "Hidden Power"),
        "necrozma_dusk_mane" to listOf("Shadow Claw", "Psycho Cut", "Metal Claw"),
        "necrozma_dawn_wings" to listOf("Shadow Claw", "Psycho Cut", "Metal Claw"),
        "rhyperior" to listOf("Mud-Slap", "Smack Down"),
        "yveltal" to listOf("Sucker Punch", "Snarl", "Gust"),
        "xerneas" to listOf("Geomancy", "Tackle"),
        "mewtwo" to listOf("Psycho Cut", "Confusion"),
        "mewtwo_armored" to listOf("Confusion", "Iron Tail"),
        "zygarde_complete" to listOf("Dragon Tail", "Bite"),
        "florges" to listOf("Fairy Wind", "Vine Whip"),
        "dragonite" to listOf("Dragon Breath", "Dragon Tail", "Steel Wing"),
        "metagross" to listOf("Bullet Punch", "Zen Headbutt"),
        "excadrill" to listOf("Mud Shot", "Mud-Slap", "Metal Claw"),
        "mamoswine" to listOf("Powder Snow", "Mud-Slap"),
        "groudon" to listOf("Mud Shot", "Dragon Tail"),
        "kyogre" to listOf("Waterfall"),
        "lugia" to listOf("Dragon Tail", "Extrasensory"),
        "snorlax" to listOf("Lick", "Zen Headbutt"),
        "greninja" to listOf("Water Shuriken", "Bubble", "Feint Attack"),
        "trevenant" to listOf("Shadow Claw", "Sucker Punch"),
        "dewgong" to listOf("Ice Shard", "Frost Breath"),
        "walrein" to listOf("Powder Snow", "Frost Breath", "Waterfall"),
        "sandslash_alolan" to listOf("Powder Snow", "Shadow Claw"),
        "ninetales_alolan" to listOf("Powder Snow", "Charm"),
        "ninetales" to listOf("Ember", "Fire Spin", "Feint Attack"),
        "weezing_galarian" to listOf("Fairy Wind", "Tackle"),
        "drapion" to listOf("Poison Sting", "Ice Fang", "Bite"),
        "dunsparce" to listOf("Rollout", "Astonish", "Bite"),
        "wigglytuff" to listOf("Charm", "Feint Attack"),
        "clefable" to listOf("Fairy Wind", "Charm"),
        "bastiodon" to listOf("Smack Down", "Iron Tail"),
        "carbink" to listOf("Rock Throw", "Tackle"),
        "umbreon" to listOf("Snarl", "Feint Attack"),
        "medicham" to listOf("Counter", "Psycho Cut"),
        "sableye" to listOf("Shadow Claw", "Feint Attack"),
        "skarmory" to listOf("Steel Wing", "Air Slash"),
        "altaria" to listOf("Dragon Breath", "Peck"),
        "pelipper" to listOf("Wing Attack", "Water Gun"),
        "mantine" to listOf("Wing Attack", "Bubble", "Bullet Seed"),
        "lanturn" to listOf("Spark", "Water Gun"),
        "jellicent" to listOf("Hex", "Bubble"),
        "abomasnow" to listOf("Powder Snow", "Leafage"),
        "venusaur" to listOf("Vine Whip", "Razor Leaf"),
        "charizard" to listOf("Wing Attack", "Dragon Breath", "Fire Spin"),
        "machamp" to listOf("Counter", "Karate Chop"),
        "scrafty" to listOf("Counter", "Snarl"),
        "obstagoon" to listOf("Counter", "Lick"),
        "malamar" to listOf("Psywave", "Psycho Cut"),
        "guzzlord" to listOf("Dragon Tail", "Snarl"),
        "cobalion" to listOf("Double Kick", "Metal Claw"),
        "virizion" to listOf("Double Kick", "Quick Attack"),
        "registeel" to listOf("Lock-On", "Metal Claw"),
        "melmetal" to listOf("Thunder Shock"),
        "tapu_fini" to listOf("Water Gun", "Hidden Power"),
        "toucannon" to listOf("Bullet Seed", "Peck", "Rock Smash"),
        "golurk" to listOf("Mud-Slap", "Astonish"),
        "dondozo" to listOf("Waterfall", "Tackle"),
        "volcanion" to listOf("Incinerate", "Water Gun"),
        "kommo_o" to listOf("Dragon Tail", "Poison Jab"),
        "regidrago" to listOf("Dragon Breath", "Bite")
    )

    val FALLBACK_SPECIES_CHARGED_POOL: Map<String, List<String>> = mapOf(
        "tinkaton" to listOf("Gigaton Hammer", "Play Rough", "Bulldoze", "Heavy Slam", "Flash Cannon"),
        "mimikyu" to listOf("Play Rough", "Shadow Sneak", "Thunder"),
        "swampert" to listOf("Hydro Cannon", "Earthquake", "Sludge Wave", "Surf", "Muddy Water"),
        "feraligatr" to listOf("Hydro Cannon", "Ice Beam", "Crunch", "Water Pulse"),
        "clodsire" to listOf("Earthquake", "Stone Edge", "Sludge Bomb", "Megahorn", "Acid Spray"),
        "azumarill" to listOf("Ice Beam", "Play Rough", "Hydro Pump"),
        "annihilape" to listOf("Rage Fist", "Ice Punch", "Close Combat", "Shadow Ball", "Night Slash"),
        "primeape" to listOf("Rage Fist", "Close Combat", "Ice Punch", "Night Slash"),
        "mandibuzz" to listOf("Dark Pulse", "Aerial Ace", "Foul Play", "Shadow Ball"),
        "talonflame" to listOf("Fly", "Flame Charge", "Brave Bird", "Incinerate"),
        "skeledirge" to listOf("Torch Song", "Shadow Ball", "Disarming Voice", "Crunch"),
        "cresselia" to listOf("Grass Knot", "Moonblast", "Future Sight", "Aurora Beam"),
        "giratina_altered" to listOf("Dragon Claw", "Ancient Power", "Shadow Sneak", "Shadow Force"),
        "giratina_origin" to listOf("Shadow Ball", "Ominous Wind", "Dragon Pulse", "Shadow Force"),
        "poliwrath" to listOf("Icy Wind", "Scald", "Dynamic Punch", "Ice Punch", "Power-Up Punch"),
        "gastrodon" to listOf("Body Slam", "Earth Power", "Water Pulse", "Earthquake"),
        "quagsire" to listOf("Aqua Tail", "Stone Edge", "Mud Bomb", "Sludge Bomb", "Earthquake"),
        "whiscash" to listOf("Scald", "Mud Bomb", "Blizzard", "Water Pulse"),
        "lickilicky" to listOf("Body Slam", "Shadow Ball", "Earthquake", "Solar Beam"),
        "serperior" to listOf("Frenzy Plant", "Aerial Ace", "Leaf Tornado"),
        "corviknight" to listOf("Air Cutter", "Iron Head", "Sky Attack", "Payback"),
        "dusknoir" to listOf("Shadow Punch", "Dynamic Punch", "Shadow Ball", "Dark Pulse", "Poltergeist", "Ominous Wind", "Psychic"),
        "dusclops" to listOf("Ice Punch", "Shadow Punch", "Poltergeist", "Fire Punch", "Return"),
        "zygarde" to listOf("Crunch", "Earthquake", "Bulldoze", "Outrage"),
        "aegislash" to listOf("Shadow Ball", "Flash Cannon", "Gyro Ball"),
        "cramorant" to listOf("Surf", "Fly", "Dive", "Hydro Pump"),
        "morpeko" to listOf("Aura Wheel", "Psychic Fangs", "Outrage", "Seed Bomb"),
        "palkia_origin" to listOf("Spacial Rend", "Aqua Tail", "Hydro Pump", "Fire Blast"),
        "dialga_origin" to listOf("Roar of Time", "Iron Head", "Thunder", "Flash Cannon"),
        "zacian_crowned" to listOf("Behemoth Blade", "Close Combat", "Play Rough", "Wild Charge"),
        "zacian_hero" to listOf("Close Combat", "Play Rough", "Wild Charge", "Iron Head"),
        "zamazenta_crowned" to listOf("Behemoth Bash", "Close Combat", "Moonblast", "Crunch"),
        "kyurem_black" to listOf("Freeze Shock", "Fusion Bolt", "Outrage", "Blizzard", "Iron Head"),
        "kyurem_white" to listOf("Ice Burn", "Fusion Flare", "Blizzard", "Dragon Pulse", "Focus Blast"),
        "landorus_therian" to listOf("Sandsear Storm", "Stone Edge", "Superpower", "Earthquake"),
        "ho_oh" to listOf("Sacred Fire", "Brave Bird", "Earthquake", "Solar Beam"),
        "necrozma_dusk_mane" to listOf("Sunsteel Strike", "Dark Pulse", "Iron Head", "Outrage"),
        "necrozma_dawn_wings" to listOf("Moongeist Beam", "Dark Pulse", "Iron Head", "Outrage"),
        "rhyperior" to listOf("Rock Wrecker", "Breaking Swipe", "Superpower", "Surf", "Earthquake"),
        "yveltal" to listOf("Dark Pulse", "Oblivion Wing", "Focus Blast", "Hurricane"),
        "xerneas" to listOf("Close Combat", "Moonblast", "Megahorn", "Thunder"),
        "mewtwo" to listOf("Psystrike", "Shadow Ball", "Focus Blast", "Ice Beam", "Flamethrower"),
        "mewtwo_armored" to listOf("Psystrike", "Dynamic Punch", "Earthquake", "Rock Slide"),
        "zygarde_complete" to listOf("Crunch", "Earthquake", "Outrage", "Bulldoze"),
        "florges" to listOf("Disarming Voice", "Moonblast", "Trailblaze", "Psychic"),
        "dragonite" to listOf("Dragon Claw", "Superpower", "Outrage", "Hurricane", "Draco Meteor"),
        "metagross" to listOf("Meteor Mash", "Earthquake", "Psychic", "Flash Cannon"),
        "excadrill" to listOf("Drill Run", "Rock Slide", "Iron Head", "Earthquake"),
        "mamoswine" to listOf("Avalanche", "High Horsepower", "Stone Edge", "Bulldoze"),
        "groudon" to listOf("Precipice Blades", "Fire Punch", "Earthquake", "Solar Beam"),
        "kyogre" to listOf("Surf", "Origin Pulse", "Blizzard", "Thunder", "Hydro Pump"),
        "lugia" to listOf("Sky Attack", "Aeroblast", "Hydro Pump", "Future Sight"),
        "snorlax" to listOf("Body Slam", "Superpower", "Earthquake", "Outrage"),
        "greninja" to listOf("Hydro Cannon", "Night Slash", "Brutal Swing", "Aerial Ace"),
        "trevenant" to listOf("Seed Bomb", "Shadow Ball", "Foul Play"),
        "dewgong" to listOf("Icy Wind", "Drill Run", "Blizzard", "Water Pulse"),
        "walrein" to listOf("Icicle Spear", "Earthquake", "Blizzard", "Water Pulse"),
        "sandslash_alolan" to listOf("Ice Punch", "Drill Run", "Blizzard", "Bulldoze"),
        "ninetales_alolan" to listOf("Weather Ball (Ice)", "Chilling Water", "Psyshock", "Dazzling Gleam"),
        "ninetales" to listOf("Weather Ball (Fire)", "Overheat", "Scorching Sands", "Psyshock", "Solar Beam"),
        "weezing_galarian" to listOf("Brutal Swing", "Overheat", "Play Rough", "Sludge"),
        "drapion" to listOf("Crunch", "Aqua Tail", "Sludge Bomb", "Fell Stinger"),
        "dunsparce" to listOf("Rock Slide", "Drill Run", "Ice Beam"),
        "wigglytuff" to listOf("Icy Wind", "Swift", "Disarming Voice", "Play Rough"),
        "clefable" to listOf("Swift", "Meteor Mash", "Moonblast", "Psychic"),
        "bastiodon" to listOf("Stone Edge", "Flamethrower", "Flash Cannon"),
        "carbink" to listOf("Rock Slide", "Moonblast", "Power Gem"),
        "umbreon" to listOf("Foul Play", "Last Resort", "Dark Pulse", "Psychic"),
        "medicham" to listOf("Ice Punch", "Dynamic Punch", "Psychic", "Power-Up Punch"),
        "sableye" to listOf("Foul Play", "Power Gem", "Shadow Sneak"),
        "skarmory" to listOf("Sky Attack", "Brave Bird", "Flash Cannon"),
        "altaria" to listOf("Sky Attack", "Moonblast", "Dazzling Gleam", "Dragon Pulse"),
        "pelipper" to listOf("Weather Ball", "Hurricane", "Blizzard", "Hydro Pump"),
        "mantine" to listOf("Aerial Ace", "Ice Beam", "Water Pulse", "Bubble Beam"),
        "lanturn" to listOf("Surf", "Thunderbolt", "Water Pulse", "Hydro Pump"),
        "jellicent" to listOf("Surf", "Shadow Ball", "Ice Beam", "Bubble Beam"),
        "abomasnow" to listOf("Weather Ball (Ice)", "Energy Ball", "Icy Wind", "Outrage"),
        "venusaur" to listOf("Frenzy Plant", "Sludge Bomb", "Petal Blizzard"),
        "charizard" to listOf("Blast Burn", "Dragon Claw", "Air Cutter", "Overheat"),
        "machamp" to listOf("Cross Chop", "Rock Slide", "Payback", "Close Combat"),
        "scrafty" to listOf("Thunder Punch", "Foul Play", "Power-Up Punch", "Acid Spray"),
        "obstagoon" to listOf("Night Slash", "Cross Chop", "Obstruct", "Hyper Beam"),
        "malamar" to listOf("Superpower", "Foul Play", "Psybeam", "Hyper Beam"),
        "guzzlord" to listOf("Dragon Claw", "Crunch", "Brutal Swing", "Sludge Bomb"),
        "cobalion" to listOf("Sacred Sword", "Stone Edge", "Iron Head"),
        "virizion" to listOf("Sacred Sword", "Leaf Blade", "Stone Edge"),
        "registeel" to listOf("Focus Blast", "Zap Cannon", "Flash Cannon"),
        "melmetal" to listOf("Double Iron Bash", "Superpower", "Rock Slide", "Thunderbolt", "Flash Cannon", "Hyper Beam"),
        "tapu_fini" to listOf("Surf", "Nature's Madness", "Moonblast", "Ice Beam"),
        "toucannon" to listOf("Beak Blast", "Drill Peck", "Rock Blast", "Flash Cannon"),
        "golurk" to listOf("Shadow Punch", "Dynamic Punch", "Earth Power", "Poltergeist"),
        "dondozo" to listOf("Surf", "Liquidation", "Body Slam", "Outrage", "Hydro Pump"),
        "volcanion" to listOf("Overheat", "Earth Power", "Sludge Bomb", "Hydro Pump"),
        "kommo_o" to listOf("Clanging Scales", "Close Combat", "Brick Break", "Boomburst", "Dragon Claw"),
        "regidrago" to listOf("Breaking Swipe", "Outrage", "Dragon Pulse", "Hyper Beam")
    )

    val FAST_MOVE_ENERGY: Map<String, Int> = mapOf(
        "dragon breath" to 4,
        "sand attack" to 4,
        "quick attack" to 8,
        "lock-on" to 5,
        "lock on" to 5,
        "water gun" to 3,
        "lick" to 3,
        "bite" to 4,
        "tackle" to 3,
        "fury cutter" to 4,
        "bug bite" to 3,
        "scratch" to 4,
        "cut" to 2,
        "psywave" to 4,
        "psycho cut" to 9,
        "mud shot" to 9,
        "shadow claw" to 8,
        "counter" to 6,
        "powder snow" to 8,
        "wing attack" to 8,
        "peck" to 8,
        "poison sting" to 9,
        "thunder shock" to 9,
        "fairy wind" to 9,
        "bullet punch" to 7,
        "fire fang" to 6,
        "vine whip" to 8,
        "karate chop" to 9,
        "low kick" to 8,
        "ice fang" to 6,
        "thunder fang" to 6,
        "metal claw" to 7,
        "metal sound" to 8,
        "sucker punch" to 7,
        "poison jab" to 7,
        "spark" to 7,
        "leafage" to 8,
        "steel wing" to 5,
        "rock throw" to 5,
        "acid" to 8,
        "feint attack" to 6,
        "frost breath" to 5,
        "pound" to 4,
        "razor leaf" to 4,
        "force palm" to 10,
        "dragon tail" to 12,
        "waterfall" to 10,
        "fire spin" to 10,
        "snarl" to 13,
        "geomancy" to 13,
        "mud-slap" to 10,
        "mud slap" to 10,
        "charm" to 8,
        "double kick" to 12,
        "air slash" to 9,
        "ice shard" to 10,
        "bubble" to 11,
        "rollout" to 13,
        "smack down" to 8,
        "astonish" to 10,
        "hex" to 13,
        "magical leaf" to 10,
        "bullet seed" to 13,
        "water shuriken" to 14,
        "charge beam" to 11,
        "extrasensory" to 10,
        "hidden power" to 8,
        "infestation" to 12,
        "iron tail" to 7,
        "present" to 12,
        "rock smash" to 7,
        "struggle bug" to 8,
        "take down" to 9,
        "zen headbutt" to 6,
        "gust" to 14,
        "confusion" to 14,
        "volt switch" to 16,
        "splash" to 12,
        "yawn" to 12,
        "incinerate" to 20,
        "ember" to 9
    )

    val MOVE_ENERGY_COST: Map<String, Int> = mapOf(

        "Drum Beating" to 35,
        "Gigaton Hammer" to 60,
        "Bulldoze" to 55,
        "Air Cutter" to 35,
        "Behemoth Blade" to 55,
        "Behemoth Bash" to 45,
        "Secret Sword" to 35,
        "Sacred Sword" to 35,
        "Aqua Jet" to 40,
        "Double Iron Bash" to 35,
        "Bleakwind Storm" to 45,
        "Wildbolt Storm" to 45,
        "Springtide Storm" to 45,
        "Roar of Time" to 65,
        "Iron Head" to 50,
        "Draco Meteor" to 65,
        "Thunder" to 60,
        "Aeroblast" to 75,
        "Sky Attack" to 50,
        "Future Sight" to 65,
        "Surf" to 45,
        "Origin Pulse" to 60,
        "Hydro Pump" to 75,
        "Blizzard" to 75,
        "Close Combat" to 45,
        "Brave Bird" to 55,
        "Play Rough" to 60,
        "Wild Charge" to 45,
        "Shadow Ball" to 50,
        "Ominous Wind" to 45,
        "Dragon Claw" to 50,
        "Ancient Power" to 45,
        "Shadow Force" to 65,
        "Spacial Rend" to 55,
        "Aqua Tail" to 35,
        "Precipice Blades" to 60,
        "Fire Punch" to 40,
        "Psystrike" to 45,
        "Ice Beam" to 55,
        "Moonblast" to 50,
        "Dark Pulse" to 45,
        "Oblivion Wing" to 50,
        "Crunch" to 45,
        "Earthquake" to 65,
        "Sandsear Storm" to 45,
        "Stone Edge" to 55,
        "Superpower" to 40,
        "Sacred Fire" to 65,
        "Sunsteel Strike" to 65,
        "Moongeist Beam" to 65,
        "Rock Slide" to 45,
        "Earth Power" to 50,
        "Outrage" to 60,
        "Meteor Mash" to 45,
        "Drill Run" to 40,
        "Rock Wrecker" to 50,
        "Breaking Swipe" to 50,
        "Avalanche" to 45,
        "High Horsepower" to 55,
        "Ice Punch" to 40,
        "Fusion Flare" to 45,
        "Overheat" to 55,
        "Fusion Bolt" to 45,
        "Glaciate" to 40,
        "Disarming Voice" to 45,
        "Hydro Cannon" to 40,
        "Weather Ball" to 35,
        "Weather Ball (Ice)" to 35,
        "Weather Ball (Fire)" to 35,
        "Weather Ball (Water)" to 35,
        "Weather Ball (Rock)" to 35,
        "Chilling Water" to 45,
        "Dazzling Gleam" to 55,
        "Scorching Sands" to 50,
        "Psycho Boost" to 35,
        "Thunderbolt" to 55,
        "Grass Knot" to 50,
        "Leaf Blade" to 35,
        "Aerial Ace" to 45,
        "Fly" to 45,
        "Flame Charge" to 50,
        "Blast Burn" to 50,
        "Feather Dance" to 50,
        "Shadow Sneak" to 50,
        "Twister" to 40,
        "Air Cutter" to 35,
        "Payback" to 60,
        "Body Slam" to 40,
        "Foul Play" to 40,
        "Night Slash" to 35,
        "Cross Chop" to 35,
        "Dynamic Punch" to 45,
        "Aura Sphere" to 40,
        "Focus Blast" to 75,
        "Sludge Bomb" to 50,
        "Sludge Wave" to 65,
        "Acid Spray" to 45,
        "Poison Fang" to 40,
        "Cross Poison" to 35,
        "Gunk Shot" to 75,
        "Mud Bomb" to 45,
        "Bone Club" to 35,
        "Shadow Bone" to 45,
        "Hurricane" to 60,
        "Acrobatics" to 55,
        "Drill Peck" to 40,
        "Psychic" to 55,
        "Psyshock" to 40,
        "Psychic Fangs" to 35,
        "Lunge" to 45,
        "Megahorn" to 55,
        "X-Scissor" to 40,
        "Power Gem" to 50,
        "Meteor Beam" to 60,
        "Night Shade" to 45,
        "Icy Wind" to 45,
        "Triple Axel" to 45,
        "Icicle Spear" to 40,
        "Freeze Shock" to 60,
        "Ice Burn" to 60,
        "Dragon Pulse" to 55,
        "Brutal Swing" to 35,
        "Flash Cannon" to 65,
        "Heavy Slam" to 50,
        "Magnet Bomb" to 40,
        "Mirror Shot" to 35,
        "Doom Desire" to 40,
        "Frenzy Plant" to 45,
        "Energy Ball" to 45,
        "Seed Bomb" to 40,
        "Power Whip" to 50,
        "Trailblaze" to 45,
        "Solar Beam" to 80,
        "Discharge" to 40,
        "Zap Cannon" to 80,
        "Scald" to 50,
        "Liquidation" to 45,
        "Muddy Water" to 35,
        "Water Pulse" to 50,
        "Nature's Madness" to 50,
        "Swift" to 35,
        "Hyper Beam" to 80,
        "Aura Wheel" to 45,
        "Rage Fist" to 40,
        "Torch Song" to 45,
        "Super Power" to 40,
        "Rock Tomb" to 50,
        "Sand Tomb" to 45,
        "Thunder Punch" to 40,
        "Flamethrower" to 55,
        "Fire Blast" to 80,
        "Last Resort" to 55,
        "Brine" to 60,
        "Dig" to 50,
        "Shadow Punch" to 35,
        "Spirit Shackle" to 40,
        "Darkest Lariat" to 60,
        "Power-Up Punch" to 35,
        "Bubble Beam" to 50,
        "Bug Buzz" to 60,
        "Leaf Tornado" to 40,
        "Stomp" to 40,
        "Petal Blizzard" to 65,
        "Mystical Fire" to 45,
        "Gyro Ball" to 50,
        "Dive" to 40,
        "Skull Bash" to 75,
        "Beak Blast" to 55,
        "Rock Blast" to 40,
        "Brick Break" to 35,
        "Poltergeist" to 75,
        "Boomburst" to 70,
        "Fell Stinger" to 35,
        "Volt Tackle" to 40,
        "Psybeam" to 60,
        "Heat Wave" to 45,
        "Drain Punch" to 40,
        "Fell Stinger+" to 35,
        "Volt Tackle+" to 35,
        "Zap Cannon+" to 45,
        "Acid Spray+" to 40,
        "Liquidation+" to 40,
        "Outrage+" to 50,
        "Dynamic Punch+" to 80,
        "Future Sight+" to 80,
        "Drill Peck+" to 35,
        "Dark Pulse+" to 40,
        "Night Shade+" to 45,
        "Brave Bird+" to 40,
        "Ominous Wind+" to 40,
        "Seed Bomb+" to 40,
        "Mystical Fire+" to 40,
        "Surf+" to 35,
        "Psybeam+" to 45,
        "Brick Break+" to 35
    )

    internal val CPM_TABLE: List<Pair<Double, Double>> = listOf(
        1.0 to 0.094, 1.5 to 0.135137432, 2.0 to 0.16639787, 2.5 to 0.192650919,
        3.0 to 0.21573247, 3.5 to 0.236572661, 4.0 to 0.25572005, 4.5 to 0.273530381,
        5.0 to 0.29024988, 5.5 to 0.306057377, 6.0 to 0.3210876, 6.5 to 0.335445036,
        7.0 to 0.34921268, 7.5 to 0.362457751, 8.0 to 0.37523559, 8.5 to 0.387592406,
        9.0 to 0.39956728, 9.5 to 0.411193551, 10.0 to 0.42250001, 10.5 to 0.432926419,
        11.0 to 0.44310755, 11.5 to 0.453059958, 12.0 to 0.46279839, 12.5 to 0.472336083,
        13.0 to 0.48168495, 13.5 to 0.4908558, 14.0 to 0.49985844, 14.5 to 0.508701765,
        15.0 to 0.51739395, 15.5 to 0.525942511, 16.0 to 0.53435433, 16.5 to 0.542635767,
        17.0 to 0.55079269, 17.5 to 0.558830576, 18.0 to 0.56675452, 18.5 to 0.574569153,
        19.0 to 0.58227891, 19.5 to 0.589887917, 20.0 to 0.59740001, 20.5 to 0.604818814,
        21.0 to 0.61215729, 21.5 to 0.619404122, 22.0 to 0.62656713, 22.5 to 0.633649143,
        23.0 to 0.64065295, 23.5 to 0.647580967, 24.0 to 0.65443563, 24.5 to 0.661219252,
        25.0 to 0.667934, 25.5 to 0.674581896, 26.0 to 0.68116492, 26.5 to 0.687684904,
        27.0 to 0.69414365, 27.5 to 0.70054287, 28.0 to 0.70688421, 28.5 to 0.713168999,
        29.0 to 0.71939909, 29.5 to 0.725575614, 30.0 to 0.7317, 30.5 to 0.734741009,
        31.0 to 0.73776948, 31.5 to 0.740785574, 32.0 to 0.74378943, 32.5 to 0.746781211,
        33.0 to 0.74976104, 33.5 to 0.752729087, 34.0 to 0.75568551, 34.5 to 0.758630378,
        35.0 to 0.76156384, 35.5 to 0.764486065, 36.0 to 0.76739717, 36.5 to 0.770297266,
        37.0 to 0.7731865, 37.5 to 0.776064962, 38.0 to 0.77893275, 38.5 to 0.781790055,
        39.0 to 0.78463697, 39.5 to 0.787473578, 40.0 to 0.7903, 40.5 to 0.792803968,
        41.0 to 0.79530001, 41.5 to 0.797800015, 42.0 to 0.8003, 42.5 to 0.802799995,
        43.0 to 0.8053, 43.5 to 0.8078, 44.0 to 0.81029999, 44.5 to 0.812799985,
        45.0 to 0.81529999, 45.5 to 0.81779999, 46.0 to 0.82029999, 46.5 to 0.82279999,
        47.0 to 0.82529999, 47.5 to 0.82779999, 48.0 to 0.83029999, 48.5 to 0.83279999,
        49.0 to 0.83529999, 49.5 to 0.83779999, 50.0 to 0.84029999
    )

    internal val fastMovePowerMapStatic: Map<String, Int> = mapOf<String, Int>(
        "dragon breath" to 3, "sand attack" to 2, "quick attack" to 5, "lock-on" to 1, "lock on" to 1,
        "water gun" to 3, "lick" to 3, "bite" to 2, "tackle" to 3, "fury cutter" to 3, "bug bite" to 4,
        "scratch" to 3, "cut" to 3, "psywave" to 3, "psycho cut" to 4, "mud shot" to 3, "shadow claw" to 6,
        "counter" to 8, "powder snow" to 6, "wing attack" to 5, "peck" to 6, "poison sting" to 4,
        "thunder shock" to 4, "fairy wind" to 4, "bullet punch" to 7, "fire fang" to 8, "vine whip" to 5,
        "karate chop" to 5, "low kick" to 6, "ice fang" to 8, "thunder fang" to 8, "metal claw" to 5,
        "metal sound" to 5, "sucker punch" to 8, "poison jab" to 7, "spark" to 5, "leafage" to 6,
        "steel wing" to 7, "rock throw" to 8, "ember" to 4, "acid" to 6, "feint attack" to 6,
        "frost breath" to 7, "pound" to 4, "razor leaf" to 9, "force palm" to 13, "dragon tail" to 9,
        "waterfall" to 11, "fire spin" to 11, "snarl" to 5, "geomancy" to 8, "mud-slap" to 11,
        "mud slap" to 11, "charm" to 12, "double kick" to 8, "air slash" to 9, "ice shard" to 9,
        "bubble" to 8, "rollout" to 7, "smack down" to 11, "astonish" to 12, "hex" to 7,
        "magical leaf" to 10, "bullet seed" to 5, "water shuriken" to 6, "charge beam" to 6,
        "extrasensory" to 8, "hidden power" to 9, "infestation" to 10, "iron tail" to 10,
        "present" to 3, "rock smash" to 9, "struggle bug" to 9, "take down" to 14, "zen headbutt" to 8,
        "gust" to 16, "confusion" to 16, "volt switch" to 14, "splash" to 0, "yawn" to 0, "incinerate" to 20
    )

    internal val fastMoveTypeMapStatic: Map<String, String> = mapOf<String, String>(
        "dragon breath" to "dragon", "sand attack" to "ground", "quick attack" to "normal",
        "lock-on" to "normal", "lock on" to "normal", "water gun" to "water", "lick" to "ghost", "bite" to "dark",
        "tackle" to "normal", "fury cutter" to "bug", "bug bite" to "bug", "scratch" to "normal", "cut" to "normal",
        "psywave" to "psychic", "psycho cut" to "psychic", "mud shot" to "ground",
        "shadow claw" to "ghost", "counter" to "fighting", "powder snow" to "ice",
        "wing attack" to "flying", "peck" to "flying", "poison sting" to "poison",
        "thunder shock" to "electric", "fairy wind" to "fairy", "bullet punch" to "steel",
        "fire fang" to "fire", "vine whip" to "grass", "karate chop" to "fighting",
        "low kick" to "fighting", "ice fang" to "ice", "thunder fang" to "electric", "metal claw" to "steel",
        "metal sound" to "steel", "sucker punch" to "dark", "poison jab" to "poison", "spark" to "electric",
        "leafage" to "grass", "steel wing" to "steel", "rock throw" to "rock", "ember" to "fire",
        "acid" to "poison", "feint attack" to "dark", "frost breath" to "ice", "pound" to "normal", "razor leaf" to "grass",
        "force palm" to "fighting", "dragon tail" to "dragon", "waterfall" to "water",
        "fire spin" to "fire", "snarl" to "dark", "geomancy" to "fairy", "mud-slap" to "ground", "mud slap" to "ground",
        "charm" to "fairy", "double kick" to "fighting", "air slash" to "flying",
        "ice shard" to "ice", "bubble" to "water", "rollout" to "rock", "smack down" to "rock",
        "astonish" to "ghost", "hex" to "ghost", "magical leaf" to "grass",
        "bullet seed" to "grass", "water shuriken" to "water", "charge beam" to "electric",
        "extrasensory" to "psychic", "hidden power" to "normal", "infestation" to "bug", "iron tail" to "steel",
        "present" to "normal", "rock smash" to "fighting", "struggle bug" to "bug", "take down" to "normal",
        "zen headbutt" to "psychic", "gust" to "flying", "confusion" to "psychic", "volt switch" to "electric",
        "splash" to "water", "yawn" to "normal", "incinerate" to "fire"
    )

    val ALL_SHIELD_PERMUTATIONS: List<Triple<Int, Int, String>> = listOf(
        Triple(0, 0, "0v0"),
        Triple(0, 1, "0v1"),
        Triple(0, 2, "0v2"),
        Triple(1, 0, "1v0"),
        Triple(1, 1, "1v1"),
        Triple(1, 2, "1v2"),
        Triple(2, 0, "2v0"),
        Triple(2, 1, "2v1"),
        Triple(2, 2, "2v2")
    )
}

internal fun OverlayService.Companion.getPvpStageMultiplierStatic(stage: Int): Double {
    val s = stage.coerceIn(-4, 4)
    return if (s >= 0) {
        (4.0 + s.toDouble()) / 4.0
    } else {
        4.0 / (4.0 - s.toDouble())
    }
}

internal fun OverlayService.Companion.isMimikyuSpeciesStatic(name: String?): Boolean {
    if (name.isNullOrBlank()) return false
    return name.lowercase().contains("mimikyu")
}

internal fun OverlayService.Companion.resolveMoveBuffEffectStatic(moveName: String): MoveBuffEffect {
    val clean = moveName.replace("*", "").trim().lowercase()
    if (clean.isEmpty()) return MoveBuffEffect()
    val idKey = clean.replace(" ", "_").replace("-", "_")
    return DYNAMIC_MOVE_BUFF_TABLE[clean]
        ?: DYNAMIC_MOVE_BUFF_TABLE[idKey]
        ?: BASELINE_MOVE_BUFF_EFFECTS[clean]
        ?: MoveBuffEffect()
}

internal fun OverlayService.Companion.isDominatedSameTypeChargedPairStatic(
    c1Name: String,
    c2Name: String,
    myTypes: List<String> = emptyList()
): Boolean {
    val clean1 = c1Name.replace("*", "").trim()
    val clean2 = c2Name.replace("*", "").trim()
    if (clean1.isEmpty() || clean2.isEmpty() || clean1.equals(clean2, ignoreCase = true)) {
        return false
    }
    val defaultType = myTypes.firstOrNull() ?: "normal"
    val s1 = resolveChargedMoveStatsStatic(clean1, defaultType)
    val s2 = resolveChargedMoveStatsStatic(clean2, defaultType)
    if (!s1.type.equals(s2.type, ignoreCase = true)) {
        return false
    }
    val b1 = resolveMoveBuffEffectStatic(clean1)
    val b2 = resolveMoveBuffEffectStatic(clean2)

    fun hasPositiveBuff(b: MoveBuffEffect): Boolean =
        b.chance >= 0.25 && (b.selfAtkDelta > 0 || b.selfDefDelta > 0 || b.oppAtkDelta < 0 || b.oppDefDelta < 0)

    fun hasSelfDebuff(b: MoveBuffEffect): Boolean =
        b.chance >= 0.50 && (b.selfAtkDelta < 0 || b.selfDefDelta < 0)

    val e1 = s1.energyCost.coerceIn(35, 80)
    val e2 = s2.energyCost.coerceIn(35, 80)
    val dpe1 = s1.power.toDouble() / e1.toDouble()
    val dpe2 = s2.power.toDouble() / e2.toDouble()

    // Check if s2 is dominated by s1
    val s2DominatedByS1 = !hasPositiveBuff(b2) && !hasSelfDebuff(b1) && (
        (e2 >= e1 && s2.power <= s1.power) ||
            (e1 - e2 < 15 && dpe1 >= dpe2 * 1.15 && s1.power >= s2.power)
        )
    // Check if s1 is dominated by s2
    val s1DominatedByS2 = !hasPositiveBuff(b1) && !hasSelfDebuff(b2) && (
        (e1 >= e2 && s1.power <= s2.power) ||
            (e2 - e1 < 15 && dpe2 >= dpe1 * 1.15 && s2.power >= s1.power)
        )
    return s2DominatedByS1 || s1DominatedByS2
}

internal fun OverlayService.Companion.simulateTurnByTurnChargedCycleStatic(
    c1Name: String,
    c1Pct: Int,
    c1Stats: MoveStats,
    c2Name: String,
    c2Pct: Int,
    c2Stats: MoveStats,
    fastEpt: Double,
    defShields: Int,
    attackerTypes: List<String>,
    c3Name: String? = null,
    c3Pct: Int = 0,
    c3Stats: MoveStats? = null
): ChargedCycleSimResult {
    data class SimMoveCandidate(
        val name: String,
        val pct: Int,
        val energy: Int,
        val type: String,
        val atkStage: Double,
        val defStage: Double,
        val effPace: Double
    )

    fun buildCandidate(name: String, pct: Int, stats: MoveStats): SimMoveCandidate {
        val e = stats.energyCost.coerceIn(35, 80)
        val b = resolveMoveBuffEffectStatic(name)
        val atkStg = (b.selfAtkDelta - b.oppDefDelta).toDouble() * b.chance
        val defStg = (b.selfDefDelta - b.oppAtkDelta).toDouble() * b.chance
        val pace = Math.pow(50.0 / e.toDouble(), 0.28).coerceIn(0.84, 1.22)
        return SimMoveCandidate(
            name = name.trim(),
            pct = pct.coerceIn(5, 100),
            energy = e,
            type = stats.type.lowercase().trim(),
            atkStage = atkStg,
            defStage = defStg,
            effPace = pace
        )
    }

    val moves = mutableListOf<SimMoveCandidate>()
    val m1 = buildCandidate(c1Name, c1Pct, c1Stats)
    moves.add(m1)
    if (c2Name.isNotBlank() && !c2Name.trim().equals(c1Name.trim(), ignoreCase = true)) {
        moves.add(buildCandidate(c2Name, c2Pct, c2Stats))
    } else if (moves.size == 1) {
        moves.add(buildCandidate(c2Name, c2Pct, c2Stats))
    }
    val hasDistinctThirdMove = !c3Name.isNullOrBlank() && c3Pct > 0 && c3Stats != null &&
        moves.none { it.name.equals(c3Name.trim(), ignoreCase = true) }
    if (hasDistinctThirdMove) {
        moves.add(buildCandidate(c3Name!!, c3Pct, c3Stats!!))
    }

    data class SequenceEval(
        val label: String,
        val pressure: Double,
        val activeEnergy: Double
    )

    val sequenceEvals = mutableListOf<SequenceEval>()

    // Helper: evaluate unshielded single throw OR rapid back-to-back 2-throw sequence (mA -> mB, including mA == mB spam!)
    fun evalUnshieldedPayload(
        mA: SimMoveCandidate,
        mB: SimMoveCandidate? = null,
        priorAtkStage: Double = 0.0
    ): Triple<Double, Double, Double> {
        val firstMult = (1.0 + 0.16 * priorAtkStage).coerceIn(0.74, 1.45)
        if (mB == null) {
            val base = (mA.pct.toDouble() * firstMult) * mA.effPace
            val buffVal = max(0.0, mA.atkStage) * 8.0 + max(0.0, mA.defStage) * 7.5 -
                max(0.0, -mA.defStage) * 4.5 - max(0.0, -mA.atkStage) * 4.0
            return Triple(base, buffVal, mA.energy.toDouble())
        }
        val totalE = (mA.energy + mB.energy).toDouble()
        val d1 = mA.pct.toDouble() * firstMult
        val secondMult = (1.0 + 0.18 * (priorAtkStage + mA.atkStage)).coerceIn(0.72, 1.48)
        val d2 = mB.pct.toDouble() * secondMult
        val totalDmg = d1 + d2
        // Normalize 2-throw cumulative damage to a 50E cycle while rewarding low total energy (e.g. 35E+35E=70E vs 75E-80E nuke)
        val seqPace = (50.0 / totalE) * Math.pow(76.0 / totalE, 0.22).coerceIn(0.82, 1.18)
        val koReachBonus = if (totalDmg >= 96.0 && totalE <= 80.0) {
            (85.0 - totalE).coerceAtLeast(3.0) * 0.24
        } else 0.0
        val earlyReleaseBonus = if (mA.energy <= 40 && totalE <= 80.0) {
            (45 - mA.energy).toDouble() * 0.18
        } else 0.0
        val base = totalDmg * seqPace + koReachBonus + earlyReleaseBonus
        val buffVal = mA.atkStage * 8.5 + mA.defStage * 7.5 +
            max(0.0, mB.atkStage) * 4.0 + max(0.0, mB.defStage) * 3.5 -
            max(0.0, -mB.defStage) * 3.2 - max(0.0, -mB.atkStage) * 2.8
        val effEnergy = mA.energy * 0.55 + mB.energy * 0.45
        return Triple(base, buffVal, effEnergy)
    }

    when {
        defShields <= 0 -> {
            // 0 Shields: flexibly compare single throws AND all ordered 2-throw sequences (including 35E -> 35E back-to-back)
            for (i in moves.indices) {
                val mA = moves[i]
                val (singleBase, singleBuff, singleE) = evalUnshieldedPayload(mA, null, 0.0)
                sequenceEvals.add(
                    SequenceEval(
                        label = "1x:${mA.name}",
                        pressure = singleBase * 1.70 + singleBuff,
                        activeEnergy = singleE
                    )
                )
                for (j in moves.indices) {
                    val mB = moves[j]
                    if (mA.energy + mB.energy <= 95) {
                        val (pairBase, pairBuff, pairE) = evalUnshieldedPayload(mA, mB, 0.0)
                        sequenceEvals.add(
                            SequenceEval(
                                label = "2x:${mA.name}->${mB.name}",
                                pressure = pairBase * 1.70 + pairBuff,
                                activeEnergy = pairE
                            )
                        )
                    }
                }
            }
        }
        defShields == 1 -> {
            // 1 Shield: evaluate all ordered (mA [shielded] -> mB) AND rapid 3-throw (mA [shielded] -> mB -> mC) sequences
            for (i in moves.indices) {
                val mA = moves[i]
                val credibilityMult = if (mA.pct < 18 && mA.atkStage <= 0.0 && mA.defStage <= 0.0) 0.55 else 1.0
                val shieldThrowStatVal = mA.defStage * 9.5 + max(0.0, mA.atkStage) * 6.5 -
                    max(0.0, -mA.defStage) * 11.0 - max(0.0, -mA.atkStage) * 8.5
                for (j in moves.indices) {
                    val mB = moves[j]
                    val (followBase, followBuff, followE) = evalUnshieldedPayload(mB, null, mA.atkStage)
                    val energySavings = max(0.0, followE - mA.energy.toDouble())
                    val tempoBonus = (energySavings * 0.45 + (55.0 - mA.energy.toDouble()) * 0.22) * credibilityMult
                    val totalPressure = (followBase * 1.24) + tempoBonus + shieldThrowStatVal + followBuff * 0.50
                    sequenceEvals.add(
                        SequenceEval(
                            label = "1S:${mA.name}->${mB.name}",
                            pressure = totalPressure,
                            activeEnergy = mA.energy * 0.55 + followE * 0.45
                        )
                    )
                    // Also check rapid post-shield double-tap (mA [shielded] -> mB -> mC) when mB + mC <= 80E
                    for (k in moves.indices) {
                        val mC = moves[k]
                        if (mB.energy + mC.energy <= 80) {
                            val (dblBase, dblBuff, dblE) = evalUnshieldedPayload(mB, mC, mA.atkStage)
                            val dblSavings = max(0.0, (mB.energy + mC.energy) * 0.55 - mA.energy.toDouble())
                            val dblTempo = (dblSavings * 0.45 + (55.0 - mA.energy.toDouble()) * 0.22) * credibilityMult
                            sequenceEvals.add(
                                SequenceEval(
                                    label = "1S-3x:${mA.name}->${mB.name}->${mC.name}",
                                    pressure = (dblBase * 1.24) + dblTempo + shieldThrowStatVal + dblBuff * 0.45,
                                    activeEnergy = mA.energy * 0.52 + dblE * 0.48
                                )
                            )
                        }
                    }
                }
            }
        }
        else -> {
            // 2 Shields: evaluate all ordered (mA [shielded] -> mB [shielded] -> mC [or mC->mC spam]) sequences
            for (i in moves.indices) {
                val mA = moves[i]
                for (j in moves.indices) {
                    val mB = moves[j]
                    val burnEnergy = (mA.energy + mB.energy) * 0.5
                    val avgBurnAtk = (mA.atkStage + mB.atkStage) * 0.5
                    val avgBurnDef = (mA.defStage + mB.defStage) * 0.5
                    val cycle3Reach = ((fastEpt / 3.5) * (50.0 / burnEnergy)).coerceIn(0.68, 1.34)
                    val compoundedStatValue = avgBurnDef * 13.5 + avgBurnAtk * 9.5 -
                        max(0.0, -avgBurnDef) * 9.0 - max(0.0, -avgBurnAtk) * 7.0
                    for (k in moves.indices) {
                        val mC = moves[k]
                        val (followBase, _, followE) = if (mC.energy <= 38) {
                            val (sBase, sBuff, sE) = evalUnshieldedPayload(mC, null, avgBurnAtk * 1.55)
                            val (dBase, dBuff, dE) = evalUnshieldedPayload(mC, mC, avgBurnAtk * 1.55)
                            if (dBase >= sBase) Triple(dBase, dBuff, dE) else Triple(sBase, sBuff, sE)
                        } else {
                            evalUnshieldedPayload(mC, null, avgBurnAtk * 1.55)
                        }
                        val energySavings = max(0.0, followE - burnEnergy)
                        val twoShieldTempoBonus = energySavings * 0.60 + (55.0 - burnEnergy) * 0.34
                        val totalPressure = (followBase * 0.82 * cycle3Reach) + twoShieldTempoBonus + compoundedStatValue
                        sequenceEvals.add(
                            SequenceEval(
                                label = "2S:${mA.name}->${mB.name}->${mC.name}",
                                pressure = totalPressure,
                                activeEnergy = burnEnergy * 0.72 + followE * 0.28
                            )
                        )
                    }
                }
            }
        }
    }

    val sortedSeqs = sequenceEvals.sortedByDescending { it.pressure }
    val topSeq = sortedSeqs.firstOrNull() ?: SequenceEval("default", 35.0, 50.0)
    val secondSeq = sortedSeqs.firstOrNull { it.label != topSeq.label } ?: topSeq
    val blendedPressure = topSeq.pressure * 0.85 + secondSeq.pressure * 0.15
    val activeCycleEnergy = topSeq.activeEnergy * 0.85 + secondSeq.activeEnergy * 0.15

    // 3-Move coverage & pacing versatility bonus when Super Mega has 3 active moves
    val threeMoveVersatilityBonus = if (hasDistinctThirdMove) {
        val distinctTypesCount = moves.map { it.type }.distinct().size
        val energySpread = (moves.maxOf { it.energy } - moves.minOf { it.energy }).coerceAtLeast(0)
        (distinctTypesCount - 1).coerceAtLeast(0) * 2.2 + (energySpread.coerceAtMost(35) * 0.06)
    } else 0.0

    val dominatedPenalty = if (!hasDistinctThirdMove && isDominatedSameTypeChargedPairStatic(c1Name, c2Name, attackerTypes)) {
        6.5
    } else {
        0.0
    }
    val pacingFactor = ((fastEpt / 3.5) * (50.0 / activeCycleEnergy.coerceIn(35.0, 80.0))).coerceIn(0.78, 1.26)
    val freqMult = 0.82 + 0.18 * pacingFactor
    val bestMovePct = moves.maxOf { it.pct }
    val minEnergy = moves.minOf { it.energy }
    val fastestPct = moves.filter { it.energy == minEnergy }.minOf { it.pct }

    return ChargedCycleSimResult(
        effectivePressure = (blendedPressure + threeMoveVersatilityBonus - dominatedPenalty).coerceAtLeast(10.0),
        effectiveFreqMult = freqMult,
        bestMovePct = bestMovePct,
        fastestMovePct = fastestPct
    )
}

internal fun OverlayService.Companion.applyRecommendedMoves(meta: PokemonMeta): PokemonMeta {
    val cleanSpeciesId = meta.speciesId.lowercase().removeSuffix("_shadow")
    val isBaseForm = cleanSpeciesId == meta.baseSpecies.lowercase() &&
        (meta.formLabel.equals("Base", ignoreCase = true) ||
            meta.formLabel.equals("Kanto", ignoreCase = true) ||
            meta.formLabel.equals("Shadow", ignoreCase = true))
    val rec = RECOMMENDED_CHARGED_MOVES[meta.name]
        ?: RECOMMENDED_CHARGED_MOVES[meta.speciesId.lowercase()]
        ?: RECOMMENDED_CHARGED_MOVES[cleanSpeciesId]
        ?: if (isBaseForm) RECOMMENDED_CHARGED_MOVES[meta.baseSpecies.lowercase()] else null
    if (rec == null) return meta

    val legalPool = SPECIES_CHARGED_MOVES_POOL[meta.speciesId.lowercase()]
        ?: SPECIES_CHARGED_MOVES_POOL[cleanSpeciesId]
        ?: SPECIES_CHARGED_MOVES_POOL[meta.name.lowercase()]
    if (!legalPool.isNullOrEmpty()) {
        val candidateOrder = listOf(
            rec.first,
            rec.second,
            rec.third,
            meta.chargedMove1,
            meta.chargedMove2,
            meta.chargedMove3,
            meta.chargedMove4
        )
        val validOrdered = mutableListOf<String>()
        for (cand in candidateOrder) {
            val matched = legalPool.firstOrNull { it.equals(cand.trim(), ignoreCase = true) }
            if (matched != null && validOrdered.none { it.equals(matched, ignoreCase = true) }) {
                validOrdered.add(matched)
            }
        }
        for (legalMove in legalPool) {
            if (validOrdered.none { it.equals(legalMove, ignoreCase = true) }) {
                validOrdered.add(legalMove)
            }
        }
        return meta.copy(
            chargedMove1 = validOrdered.getOrNull(0) ?: meta.chargedMove1,
            chargedMove2 = validOrdered.getOrNull(1) ?: validOrdered.getOrNull(0) ?: meta.chargedMove2,
            chargedMove3 = validOrdered.getOrNull(2) ?: "",
            chargedMove4 = validOrdered.getOrNull(3) ?: ""
        )
    }

    return meta.copy(
        chargedMove1 = rec.first,
        chargedMove2 = rec.second,
        chargedMove3 = rec.third
    )
}

internal fun OverlayService.Companion.resolveChargedMoveStatsStatic(moveName: String, fallbackType: String = "normal"): MoveStats {
    val trimmed = moveName.trim()
    if (trimmed.isEmpty()) {
        return MoveStats(trimmed, fallbackType.lowercase().ifBlank { "normal" }, 80, 50)
    }
    val lower = trimmed.lowercase()
    val spaceKey = lower.replace('-', ' ')
    val hyphenKey = lower.replace(' ', '-')
    val underscoreKey = spaceKey.replace(' ', '_')
    if (DYNAMIC_MOVE_DATABASE.isNotEmpty()) {
        DYNAMIC_MOVE_DATABASE[trimmed]?.let { return it }
        DYNAMIC_MOVE_DATABASE[lower]?.let { return it }
        DYNAMIC_MOVE_DATABASE[spaceKey]?.let { return it }
        DYNAMIC_MOVE_DATABASE[hyphenKey]?.let { return it }
        DYNAMIC_MOVE_DATABASE[underscoreKey]?.let { return it }
    }
    MOVE_DATABASE[trimmed]?.let { return it }
    STATIC_MOVE_DATABASE_LOOKUP[lower]?.let { return it }
    STATIC_MOVE_DATABASE_LOOKUP[spaceKey]?.let { return it }
    STATIC_MOVE_DATABASE_LOOKUP[hyphenKey]?.let { return it }
    STATIC_MOVE_DATABASE_LOOKUP[underscoreKey]?.let { return it }
    val fallbackCost = MOVE_ENERGY_COST[trimmed]
        ?: STATIC_MOVE_ENERGY_LOOKUP[lower]
        ?: STATIC_MOVE_ENERGY_LOOKUP[spaceKey]
        ?: STATIC_MOVE_ENERGY_LOOKUP[hyphenKey]
        ?: 50
    return MoveStats(trimmed, fallbackType.lowercase().ifBlank { "normal" }, 80, fallbackCost)
}

internal fun OverlayService.Companion.resolveFastTurnsStatic(moveName: String, fallback: Int = 2): Int {
    val k = moveName.lowercase().trim()
    if (k.isEmpty()) return fallback
    val spaceK = k.replace('-', ' ')
    val hyphenK = spaceK.replace(' ', '-')
    return DYNAMIC_FAST_TURNS[k]
        ?: DYNAMIC_FAST_TURNS[spaceK]
        ?: DYNAMIC_FAST_TURNS[hyphenK]
        ?: FAST_MOVE_TURNS[k]
        ?: FAST_MOVE_TURNS[spaceK]
        ?: FAST_MOVE_TURNS[hyphenK]
        ?: fallback
}

internal fun OverlayService.Companion.resolveFastEnergyStatic(moveName: String, fallbackTurns: Int = 2): Int {
    val k = moveName.lowercase().trim()
    val defaultEnergy = (fallbackTurns * 4).coerceAtLeast(3)
    if (k.isEmpty()) return defaultEnergy
    val spaceK = k.replace('-', ' ')
    val hyphenK = spaceK.replace(' ', '-')
    return DYNAMIC_FAST_ENERGY[k]
        ?: DYNAMIC_FAST_ENERGY[spaceK]
        ?: DYNAMIC_FAST_ENERGY[hyphenK]
        ?: FAST_MOVE_ENERGY[k]
        ?: FAST_MOVE_ENERGY[spaceK]
        ?: FAST_MOVE_ENERGY[hyphenK]
        ?: defaultEnergy
}

internal fun OverlayService.Companion.resolveFastPowerStatic(moveName: String, fallbackTurns: Int = 2): Int {
    val k = moveName.lowercase().trim()
    val defaultPower = (fallbackTurns * 3).coerceAtLeast(3)
    if (k.isEmpty()) return defaultPower
    val spaceK = k.replace('-', ' ')
    val hyphenK = spaceK.replace(' ', '-')
    return DYNAMIC_FAST_POWER[k]
        ?: DYNAMIC_FAST_POWER[spaceK]
        ?: DYNAMIC_FAST_POWER[hyphenK]
        ?: fastMovePowerMapStatic[k]
        ?: fastMovePowerMapStatic[spaceK]
        ?: fastMovePowerMapStatic[hyphenK]
        ?: defaultPower
}

internal fun OverlayService.Companion.resolveFastTypeStatic(moveName: String, fallbackType: String = "normal"): String {
    val k = moveName.lowercase().trim()
    if (k.isEmpty()) return fallbackType
    val spaceK = k.replace('-', ' ')
    val hyphenK = spaceK.replace(' ', '-')
    return DYNAMIC_FAST_TYPE[k]
        ?: DYNAMIC_FAST_TYPE[spaceK]
        ?: DYNAMIC_FAST_TYPE[hyphenK]
        ?: fastMoveTypeMapStatic[k]
        ?: fastMoveTypeMapStatic[spaceK]
        ?: fastMoveTypeMapStatic[hyphenK]
        ?: fallbackType
}

internal fun OverlayService.Companion.clearSimulationCachesStatic() {
    CACHED_ALL_POKEMON_META = null
    RESOLVED_SPECIES_CACHE.clear()
    TOP_META_POOL_CACHE.clear()
    TOP_30_RANKED_POOL_CACHE.clear()
}

internal fun OverlayService.Companion.getAllPokemonMeta(): List<PokemonMeta> {
    CACHED_ALL_POKEMON_META?.let { return it }
    val merged = if (DYNAMIC_POKEMON_DATABASE.isEmpty()) {
        POKEMON_META_DATABASE
    } else {
        val dynIds = DYNAMIC_POKEMON_DATABASE.map { it.speciesId.lowercase() }.toSet()
        DYNAMIC_POKEMON_DATABASE + POKEMON_META_DATABASE.filter { !dynIds.contains(it.speciesId.lowercase()) }
    }
    if (DYNAMIC_POKEMON_DATABASE.isNotEmpty()) {
        CACHED_ALL_POKEMON_META = merged
    }
    return merged
}

internal fun OverlayService.Companion.areAllFourLeaguesLoaded(): Boolean {
    return REQUIRED_LEAGUE_KEYS.all { key ->
        val map = LIVE_RANKINGS_MAP[key] ?: LIVE_RANKINGS_MAP[key.removeSuffix(" (10000)")]
        map != null && map.isNotEmpty()
    }
}

internal fun OverlayService.Companion.getGamemasterLoadedCount(): Int {
    return if (DYNAMIC_POKEMON_DATABASE.isNotEmpty()) {
        POKEMON_META_DATABASE.size + DYNAMIC_POKEMON_DATABASE.size
    } else {
        0
    }
}

internal fun OverlayService.Companion.getLeagueRankingsCount(leagueKey: String): Int {
    val trimmed = leagueKey.trim()
    if (trimmed.isEmpty()) return 0
    val upper = trimmed.uppercase()
    LIVE_RANKINGS_MAP[upper]?.size?.takeIf { it > 0 }?.let { return it }
    val norm = normalizeLeagueKeyStatic(trimmed).uppercase()
    LIVE_RANKINGS_MAP[norm]?.size?.takeIf { it > 0 }?.let { return it }
    val withoutCp = upper.replace(Regex("\\s*\\(\\d+\\)\\s*$"), "").trim()
    return LIVE_RANKINGS_MAP[withoutCp]?.size ?: 0
}

internal fun OverlayService.Companion.formatShortSelectedLeagueLabelStatic(leagueKey: String): String {
    val upper = leagueKey.trim().uppercase()
    return when {
        upper == "GREAT LEAGUE" || upper == "GREAT LEAGUE (1500)" -> "GL"
        upper == "ULTRA LEAGUE" || upper == "ULTRA LEAGUE (2500)" -> "UL"
        upper == "MASTER LEAGUE" || upper == "MASTER LEAGUE (10000)" -> "ML"
        upper.contains("MEGA MASTER") || upper == "MASTER LEAGUE (MEGA) (10000)" -> "Mega ML"
        upper.contains("BATTLE FRONTIER") && upper.contains("SPECTRAL") -> "BF (Spectral)"
        upper.contains("BATTLE FRONTIER") && upper.contains("CAULDRON") -> "BF (Cauldron)"
        upper.contains("BATTLE FRONTIER") && upper.contains("MASTER") -> "BF (Master)"
        else -> leagueKey.trim()
    }
}

internal fun OverlayService.Companion.getSelectedLeaguesRankingsCountsStatic(prefs: SharedPreferences): List<Pair<String, Int>> {
    val allSelected = (getEnabledGblLeaguesStatic(prefs) + getEnabledShow6LeaguesStatic(prefs))
        .map { it.trim() }
        .filter { it.isNotEmpty() }
    val deduped = LinkedHashMap<String, String>()
    for (lg in allSelected) {
        val shortLabel = formatShortSelectedLeagueLabelStatic(lg)
        val dedupKey = shortLabel.uppercase()
        if (!deduped.containsKey(dedupKey)) {
            deduped[dedupKey] = lg
        }
    }
    return deduped.entries.map { (shortUpper, rawKey) ->
        val displayLabel = formatShortSelectedLeagueLabelStatic(rawKey).ifBlank { shortUpper }
        displayLabel to getLeagueRankingsCount(rawKey)
    }
}

internal fun OverlayService.Companion.formatSelectedLeaguesStatusSummaryStatic(prefs: SharedPreferences): String {
    val counts = getSelectedLeaguesRankingsCountsStatic(prefs)
    if (counts.isEmpty()) return "GL: ${getLeagueRankingsCount("GREAT LEAGUE")} • UL: ${getLeagueRankingsCount("ULTRA LEAGUE")} • ML: ${getLeagueRankingsCount("MASTER LEAGUE")}"
    return counts.joinToString(" • ") { (label, count) -> "$label: $count" }
}

internal fun OverlayService.Companion.formatMoveIdDisplay(moveId: String): String {
    if (moveId.isBlank()) return ""
    val upper = moveId.trim().uppercase()
    CANONICAL_MOVE_ID_MAP[upper]?.let { return it }
    DYNAMIC_MOVE_ID_TO_NAME[moveId]?.let { return it }
    DYNAMIC_MOVE_ID_TO_NAME[upper]?.let { return it }
    if (upper.endsWith("_PLUS")) {
        val baseId = upper.removeSuffix("_PLUS")
        val baseDisplay = CANONICAL_MOVE_ID_MAP[baseId]
            ?: DYNAMIC_MOVE_ID_TO_NAME[baseId]
            ?: baseId.lowercase().split("_").joinToString(" ") { w -> w.replaceFirstChar { c -> c.uppercase() } }
        return if (baseDisplay.endsWith("+")) baseDisplay else "$baseDisplay+"
    }
    return moveId.lowercase().split("_").joinToString(" ") { w ->
        w.replaceFirstChar { c -> c.uppercase() }
    }
}

internal fun com.google.gson.JsonObject.optString(key: String): String? =
    get(key)?.takeIf { !it.isJsonNull && it.isJsonPrimitive }?.let { runCatching { it.asString }.getOrNull() }

internal fun com.google.gson.JsonObject.optInt(key: String): Int? =
    get(key)?.takeIf { !it.isJsonNull && it.isJsonPrimitive }?.let { runCatching { it.asDouble.toInt() }.getOrNull() }

internal fun com.google.gson.JsonObject.optDouble(key: String): Double? =
    get(key)?.takeIf { !it.isJsonNull && it.isJsonPrimitive }?.let { runCatching { it.asDouble }.getOrNull() }

internal fun com.google.gson.JsonObject.optJsonArray(key: String): com.google.gson.JsonArray? =
    get(key)?.takeIf { !it.isJsonNull && it.isJsonArray }?.asJsonArray

internal fun com.google.gson.JsonObject.optJsonObject(key: String): com.google.gson.JsonObject? =
    get(key)?.takeIf { !it.isJsonNull && it.isJsonObject }?.asJsonObject

internal fun OverlayService.Companion.parseRankingsJsonStatic(leagueKey: String, jsonStr: String): Int {
    return try {
        val arr = JsonParser.parseString(jsonStr).asJsonArray
        val leagueMap = java.util.concurrent.ConcurrentHashMap<String, PokemonRankingEntry>()
        var rankCounter = 1
        for (el in arr) {
            try {
                if (!el.isJsonObject) continue
                val obj = el.asJsonObject
                val speciesId = obj.optString("speciesId")?.takeIf { it.isNotBlank() } ?: continue
                val score = obj.optDouble("score") ?: 80.0
                val entryRank = rankCounter++
                val movesObj = obj.optJsonObject("moves")

                val fastList = mutableListOf<MoveUsage>()
                val rawFast = movesObj?.optJsonArray("fastMoves")
                if (rawFast != null) {
                    for (fm in rawFast) {
                        if (!fm.isJsonObject) continue
                        val fmObj = fm.asJsonObject
                        val mId = fmObj.optString("moveId")?.takeIf { it.isNotBlank() } ?: continue
                        val uses = fmObj.optInt("uses")
                        fastList.add(MoveUsage(mId, uses))
                    }
                }
                fastList.sortByDescending { it.uses ?: 0 }

                val chargedList = mutableListOf<MoveUsage>()
                val rawCharged = movesObj?.optJsonArray("chargedMoves")
                if (rawCharged != null) {
                    for (cm in rawCharged) {
                        if (!cm.isJsonObject) continue
                        val cmObj = cm.asJsonObject
                        val mId = cmObj.optString("moveId")?.takeIf { it.isNotBlank() } ?: continue
                        val uses = cmObj.optInt("uses")
                        chargedList.add(MoveUsage(mId, uses))
                    }
                }
                chargedList.sortByDescending { it.uses ?: 0 }

                val movesetList = mutableListOf<String>()
                val movesetArr = obj.optJsonArray("moveset")
                if (movesetArr != null && movesetArr.size() > 0) {
                    for (i in 0 until movesetArr.size()) {
                        val msEl = movesetArr.get(i)
                        val msId = if (msEl != null && !msEl.isJsonNull && msEl.isJsonPrimitive) msEl.asString else null
                        if (!msId.isNullOrBlank()) movesetList.add(msId)
                    }
                    if (fastList.isEmpty() && movesetList.isNotEmpty()) {
                        fastList.add(MoveUsage(movesetList[0], 100))
                    }
                    if (chargedList.isEmpty() && movesetList.size > 1) {
                        for (i in 1 until movesetList.size) {
                            chargedList.add(MoveUsage(movesetList[i], 100 - i))
                        }
                    }
                }

                val moveCountList = mutableListOf<Int>()
                val mcArr = obj.optJsonArray("moveCount")
                if (mcArr != null) {
                    for (mc in mcArr) {
                        if (mc != null && !mc.isJsonNull && mc.isJsonPrimitive) {
                            runCatching { mc.asDouble.toInt() }.getOrNull()?.let { moveCountList.add(it) }
                        }
                    }
                }

                leagueMap[speciesId.lowercase()] = PokemonRankingEntry(
                    speciesId = speciesId,
                    score = score,
                    moves = RankingMoves(fastMoves = fastList, chargedMoves = chargedList),
                    moveCount = moveCountList.takeIf { it.isNotEmpty() },
                    moveset = movesetList.takeIf { it.isNotEmpty() },
                    rank = entryRank
                )
            } catch (_: Exception) {
                // Skip individual malformed entry without aborting league parsing
            }
        }
        val upperKey = leagueKey.uppercase()
        LIVE_RANKINGS_MAP[upperKey] = leagueMap
        when (upperKey) {
            "GREAT LEAGUE", "GREAT LEAGUE (1500)" -> {
                LIVE_RANKINGS_MAP["GREAT LEAGUE"] = leagueMap
                LIVE_RANKINGS_MAP["GREAT LEAGUE (1500)"] = leagueMap
            }
            "ULTRA LEAGUE", "ULTRA LEAGUE (2500)" -> {
                LIVE_RANKINGS_MAP["ULTRA LEAGUE"] = leagueMap
                LIVE_RANKINGS_MAP["ULTRA LEAGUE (2500)"] = leagueMap
            }
            "MASTER LEAGUE", "MASTER LEAGUE (10000)" -> {
                LIVE_RANKINGS_MAP["MASTER LEAGUE"] = leagueMap
                LIVE_RANKINGS_MAP["MASTER LEAGUE (10000)"] = leagueMap
            }
            "MEGA MASTER LEAGUE", "MEGA MASTER LEAGUE (10000)", "MASTER LEAGUE (MEGA) (10000)" -> {
                LIVE_RANKINGS_MAP["MEGA MASTER LEAGUE"] = leagueMap
                LIVE_RANKINGS_MAP["MEGA MASTER LEAGUE (10000)"] = leagueMap
            }
        }
        clearSimulationCachesStatic()
        leagueMap.size
    } catch (_: Exception) {
        0
    }
}

internal fun OverlayService.Companion.resolveRankingsMapForLeagueStatic(league: String): Map<String, PokemonRankingEntry>? {
    val normLeague = normalizeLeagueKeyStatic(league)
    LIVE_RANKINGS_MAP[normLeague]?.takeIf { it.isNotEmpty() }?.let { return it }
    val upperRaw = league.trim().uppercase()
    LIVE_RANKINGS_MAP[upperRaw]?.takeIf { it.isNotEmpty() }?.let { return it }
    val withoutCp = normLeague.replace(Regex("\\s*\\(\\d+\\)\\s*$"), "").trim().uppercase()
    LIVE_RANKINGS_MAP[withoutCp]?.takeIf { it.isNotEmpty() }?.let { return it }
    val stdLeague = getSameCpStandardLeagueKeyStatic(league)
    return LIVE_RANKINGS_MAP[stdLeague]?.takeIf { it.isNotEmpty() }
        ?: LIVE_RANKINGS_MAP[normalizeLeagueKeyStatic(stdLeague)]?.takeIf { it.isNotEmpty() }
}

internal fun OverlayService.Companion.applyRankingMovesForLeague(meta: PokemonMeta, league: String, isShadow: Boolean = false): PokemonMeta {
    val isSkeledirge = meta.baseSpecies.equals("skeledirge", ignoreCase = true) ||
        meta.speciesId.startsWith("skeledirge", ignoreCase = true)

    val map = resolveRankingsMapForLeagueStatic(league)
    val baseKey = meta.speciesId.lowercase().removeSuffix("_shadow")
    val effectiveShadow = isShadow || meta.name.startsWith("Shadow ", ignoreCase = true) || meta.speciesId.endsWith("_shadow", ignoreCase = true)
    val entry = if (map != null) {
        if (effectiveShadow) {
            map["${baseKey}_shadow"] ?: map[baseKey]
        } else {
            map[baseKey] ?: map["${baseKey}_shadow"]
        }
    } else null

    if (entry == null) {
        if (isSkeledirge) {
            return meta.copy(
                defaultFastMove = "Incinerate",
                fastTurns = 5,
                chargedMove1 = "Torch Song",
                chargedMove2 = "Shadow Ball",
                chargedMove3 = "Disarming Voice"
            )
        }
        return applyRecommendedMoves(meta)
    }

    val cleanSpeciesId = meta.speciesId.lowercase().removeSuffix("_shadow").removeSuffix("_alolan").removeSuffix("_galarian").removeSuffix("_hisuian").removeSuffix("_paldean")
    val speciesBaseKey = FormResolver.extractBaseSpecies(meta.name).lowercase()

    val gmFastPool = SPECIES_FAST_MOVES_POOL[meta.speciesId.lowercase()]
        ?: SPECIES_FAST_MOVES_POOL[cleanSpeciesId]
        ?: SPECIES_FAST_MOVES_POOL[meta.name.lowercase()]
        ?: SPECIES_FAST_MOVES_POOL[speciesBaseKey]
        ?: SPECIES_FAST_MOVES_POOL["${cleanSpeciesId}_shield"]
        ?: SPECIES_FAST_MOVES_POOL["${cleanSpeciesId}_full_belly"]

    val effectiveFastPool = if (!gmFastPool.isNullOrEmpty()) {
        gmFastPool
    } else {
        FALLBACK_SPECIES_FAST_POOL[cleanSpeciesId]
            ?: FALLBACK_SPECIES_FAST_POOL[speciesBaseKey]
            ?: FALLBACK_SPECIES_FAST_POOL[meta.name.lowercase()]
    }

    // Priority 1: Official recommended moveset[0] for Fast Move, fallback to highest-uses fastMoves[0]
    val topFastId = entry.moveset?.getOrNull(0)?.takeIf { it.isNotBlank() }
        ?: entry.moves.fastMoves.firstOrNull()?.moveId

    val validFastCandidate = topFastId?.let { formatMoveIdDisplay(it) }?.takeIf { cand ->
        cand.isNotBlank() && (effectiveFastPool.isNullOrEmpty() || effectiveFastPool.any { it.equals(cand, ignoreCase = true) })
    }
    val fastName = validFastCandidate ?: meta.defaultFastMove
    val fastTurns = resolveFastTurnsStatic(fastName, meta.fastTurns)

    if (isSkeledirge) {
        return meta.copy(
            defaultFastMove = fastName,
            fastTurns = fastTurns,
            chargedMove1 = "Torch Song",
            chargedMove2 = "Shadow Ball",
            chargedMove3 = "Disarming Voice"
        )
    }

    val gmChargedPool = SPECIES_CHARGED_MOVES_POOL[meta.speciesId.lowercase()]
        ?: SPECIES_CHARGED_MOVES_POOL[cleanSpeciesId]
        ?: SPECIES_CHARGED_MOVES_POOL[meta.name.lowercase()]
        ?: SPECIES_CHARGED_MOVES_POOL[speciesBaseKey]
        ?: SPECIES_CHARGED_MOVES_POOL["${cleanSpeciesId}_shield"]
        ?: SPECIES_CHARGED_MOVES_POOL["${cleanSpeciesId}_full_belly"]

    val effectiveChargedPool = if (!gmChargedPool.isNullOrEmpty()) {
        gmChargedPool
    } else {
        FALLBACK_SPECIES_CHARGED_POOL[cleanSpeciesId]
            ?: FALLBACK_SPECIES_CHARGED_POOL[speciesBaseKey]
            ?: FALLBACK_SPECIES_CHARGED_POOL[meta.name.lowercase()]
    }

    val orderedChargedNames = mutableListOf<String>()
    fun addCandidate(raw: String?) {
        if (raw != null && raw.trim().uppercase().endsWith("_PLUS")) return
        val formatted = raw?.let { formatMoveIdDisplay(it) }?.trim().orEmpty()
        if (formatted.isBlank() || formatted.endsWith("+") || formatted.equals("Struggle", ignoreCase = true) || formatted.equals("Frustration", ignoreCase = true)) return
        if (!effectiveChargedPool.isNullOrEmpty() && effectiveChargedPool.none { it.equals(formatted, ignoreCase = true) }) return
        if (orderedChargedNames.none { it.equals(formatted, ignoreCase = true) }) {
            orderedChargedNames.add(formatted)
        }
    }

    entry.moveset?.drop(1)?.forEach { mId -> addCandidate(mId) }
    entry.moves.chargedMoves.forEach { cm -> addCandidate(cm.moveId) }
    addCandidate(meta.chargedMove1)
    addCandidate(meta.chargedMove2)
    addCandidate(meta.chargedMove3)
    addCandidate(meta.chargedMove4)
    effectiveChargedPool?.forEach { addCandidate(it) }

    val c1Name = orderedChargedNames.getOrNull(0) ?: meta.chargedMove1
    val c2Name = orderedChargedNames.getOrNull(1) ?: orderedChargedNames.getOrNull(0) ?: meta.chargedMove2
    val c3Name = orderedChargedNames.getOrNull(2) ?: ""
    val c4Name = orderedChargedNames.getOrNull(3) ?: ""

    return meta.copy(
        defaultFastMove = fastName,
        fastTurns = fastTurns,
        chargedMove1 = c1Name,
        chargedMove2 = c2Name,
        chargedMove3 = c3Name,
        chargedMove4 = c4Name
    )
}

/**
 * Returns autocomplete suggestions for the Team Builder UI.
 * When typing a base form (e.g. "giratina", "ninetales", "feraligatr", "zacian"),
 * returns Base + all Alternate Forms + Shadow variants.
 */
internal fun OverlayService.Companion.getAutocompletePokemonSuggestions(
    rawQuery: String,
    league: String = "GREAT LEAGUE",
    limit: Int = 20
): List<PokemonAutocompleteSuggestion> {
    val query = rawQuery.trim().lowercase()
    if (query.isEmpty()) return emptyList()

    val isTypingShadow = query.startsWith("shadow") || query.contains(" shadow")
    val strippedQuery = query.removePrefix("shadow").trim()
    val searchToken = strippedQuery.ifEmpty { query }

    val allMeta = getAllPokemonMeta()
    val poolByName = LinkedHashMap<String, PokemonAutocompleteSuggestion>()

    for (meta in allMeta) {
        val isShadow = meta.name.startsWith("Shadow ", ignoreCase = true) || meta.speciesId.endsWith("_shadow", ignoreCase = true)
        val isMegaOrPrimal = meta.name.startsWith("Mega ", ignoreCase = true) || meta.name.startsWith("Primal ", ignoreCase = true) || meta.speciesId.contains("_mega") || meta.speciesId.contains("_primal")
        val baseKey = FormResolver.extractBaseSpecies(meta.name)
        val rankedMeta = computeEffectiveCombatStats(applyRankingMovesForLeague(applyRecommendedMoves(meta), league, isShadow), league)
        val plusMove = resolveMegaPlusMoveStatic(meta.name, league)
        val badge = when {
            isShadow && meta.formLabel != "Base" && meta.formLabel != "Shadow" -> "Shadow • ${meta.formLabel}"
            isShadow -> "Shadow"
            isMegaOrPrimal -> {
                val baseMegaBadge = if (meta.name.startsWith("Primal", ignoreCase = true)) "Primal" else "Mega"
                if (plusMove != null) "$baseMegaBadge • +$plusMove" else baseMegaBadge
            }
            else -> meta.formLabel
        }
        val isAlt = badge != "Base" && badge != "Shadow"

        val keyLower = meta.name.lowercase()
        if (!poolByName.containsKey(keyLower)) {
            poolByName[keyLower] = PokemonAutocompleteSuggestion(
                name = meta.name,
                speciesId = meta.speciesId,
                baseSpecies = baseKey,
                formBadge = badge,
                cp = rankedMeta.defaultCp,
                fastMove = rankedMeta.defaultFastMove,
                chargedMove1 = rankedMeta.chargedMove1,
                chargedMove2 = rankedMeta.chargedMove2,
                isShadow = isShadow,
                isAlternateForm = isAlt
            )
        }

        // Synthesize Shadow option for eligible non-Shadow, non-Mega/Primal Pokémon
        if (!isShadow && !isMegaOrPrimal) {
            val shadowName = "Shadow ${meta.name}"
            val shadowKey = shadowName.lowercase()
            if (!poolByName.containsKey(shadowKey)) {
                val shadowRanked = computeEffectiveCombatStats(applyRankingMovesForLeague(applyRecommendedMoves(meta), league, true), league)
                poolByName[shadowKey] = PokemonAutocompleteSuggestion(
                    name = shadowName,
                    speciesId = "${meta.speciesId}_shadow",
                    baseSpecies = baseKey,
                    formBadge = if (meta.formLabel != "Base") "Shadow • ${meta.formLabel}" else "Shadow",
                    cp = shadowRanked.defaultCp,
                    fastMove = shadowRanked.defaultFastMove,
                    chargedMove1 = shadowRanked.chargedMove1,
                    chargedMove2 = shadowRanked.chargedMove2,
                    isShadow = true,
                    isAlternateForm = isAlt
                )
            }
        }
    }

    val matchedFamilies = HashSet<String>()
    for (opt in poolByName.values) {
        if (opt.baseSpecies.startsWith(searchToken) || opt.baseSpecies.contains(searchToken) || opt.name.lowercase().contains(searchToken)) {
            matchedFamilies.add(opt.baseSpecies)
        }
    }

    val results = poolByName.values.filter { opt ->
        matchedFamilies.contains(opt.baseSpecies) || opt.name.lowercase().contains(query)
    }.sortedWith(
        Comparator { a, b ->
            val aStarts = if (a.baseSpecies.startsWith(searchToken)) 0 else 1
            val bStarts = if (b.baseSpecies.startsWith(searchToken)) 0 else 1
            if (aStarts != bStarts) return@Comparator aStarts - bStarts
            val famCmp = a.baseSpecies.compareTo(b.baseSpecies)
            if (famCmp != 0) return@Comparator famCmp
            if (isTypingShadow) {
                if (a.isShadow != b.isShadow) return@Comparator if (a.isShadow) -1 else 1
            } else {
                if (a.isShadow != b.isShadow) return@Comparator if (a.isShadow) 1 else -1
            }
            if (a.isAlternateForm != b.isAlternateForm) return@Comparator if (a.isAlternateForm) 1 else -1
            a.name.compareTo(b.name)
        }
    )

    return results.take(limit)
}

internal fun OverlayService.Companion.solveLeagueLevelCpm(uAtk: Double, uDef: Double, uHp: Double, leagueCap: Int): Pair<Double, Int> {
    var bestCpm = 0.094
    var bestCp = 10
    for ((_, cpm) in CPM_TABLE) {
        val cp = floor(uAtk * kotlin.math.sqrt(uDef * uHp) * cpm * cpm / 10.0).toInt().coerceAtLeast(10)
        if (cp <= leagueCap) {
            bestCpm = cpm
            bestCp = cp
        } else {
            break
        }
    }
    return bestCpm to bestCp
}

/**
 * Resolves PvPoke recommended Fast Move, Charged Move 1, Charged Move 2, and default CP for a Pokémon name,
 * prioritizing live rankings JSON moves when available.
 */
internal fun OverlayService.Companion.resolveRecommendedMovesForSpecies(
    rawName: String,
    league: String = "GREAT LEAGUE",
    customCp: Int? = null,
    customIvs: String? = null
): PokemonMeta? {
    val trimmed = rawName.trim()
    if (trimmed.isEmpty()) return null
    val normLeague = normalizeLeagueKeyStatic(league)
    val cacheKey = "${trimmed.lowercase()}|$normLeague|${customCp ?: -1}|${customIvs?.trim()?.lowercase().orEmpty()}"
    RESOLVED_SPECIES_CACHE[cacheKey]?.let { return it }

    val isShadowInput = trimmed.startsWith("Shadow ", ignoreCase = true) || trimmed.contains("(Shadow)", ignoreCase = true)
    val cleanNoShadow = trimmed
        .replace(Regex("^Shadow\\s+", RegexOption.IGNORE_CASE), "")
        .replace(Regex("\\s*\\(Shadow\\)", RegexOption.IGNORE_CASE), "")
        .trim()
    val allMeta = getAllPokemonMeta()

    fun cacheAndReturn(resolved: PokemonMeta?): PokemonMeta? {
        if (resolved != null) {
            if (RESOLVED_SPECIES_CACHE.size > 6000) RESOLVED_SPECIES_CACHE.clear()
            RESOLVED_SPECIES_CACHE[cacheKey] = resolved
        }
        return resolved
    }

    val exactByName = allMeta.find {
        it.name.equals(trimmed, ignoreCase = true) ||
            it.name.equals(cleanNoShadow, ignoreCase = true) ||
            (cleanNoShadow.contains("zygarde", ignoreCase = true) && cleanNoShadow.contains("complete", ignoreCase = true) && it.speciesId.equals("zygarde_complete", ignoreCase = true))
    }
    if (exactByName != null) {
        val withRankMoves = applyRankingMovesForLeague(applyRecommendedMoves(exactByName), normLeague, isShadowInput)
        return cacheAndReturn(computeEffectiveCombatStats(withRankMoves, normLeague, customCp, customIvs))
    }

    val base = FormResolver.extractBaseSpecies(cleanNoShadow)
    val variants = FormResolver.getVariantsForSpecies(base, normLeague)
    if (variants.isNotEmpty()) {
        val chosen = FormResolver.resolveBestDefaultVariant(variants.first(), cleanNoShadow, normLeague)
        val withRankMoves = applyRankingMovesForLeague(applyRecommendedMoves(chosen), normLeague, isShadowInput)
        return cacheAndReturn(computeEffectiveCombatStats(withRankMoves, normLeague, customCp, customIvs))
    }

    val exactById = allMeta.find {
        it.speciesId.equals(cleanNoShadow.replace(" ", "_"), ignoreCase = true)
    }
    if (exactById != null) {
        val withRankMoves = applyRankingMovesForLeague(applyRecommendedMoves(exactById), normLeague, isShadowInput)
        return cacheAndReturn(computeEffectiveCombatStats(withRankMoves, normLeague, customCp, customIvs))
    }

    val partial = allMeta.firstOrNull {
        val candBase = it.baseSpecies.lowercase()
        val queryBase = base.lowercase()
        if ((candBase == "mew" && queryBase == "mewtwo") || (candBase == "mewtwo" && queryBase == "mew")) {
            false
        } else {
            it.name.lowercase().contains(cleanNoShadow.lowercase()) ||
                cleanNoShadow.lowercase().contains(candBase)
        }
    }
    return cacheAndReturn(partial?.let {
        val withRankMoves = applyRankingMovesForLeague(applyRecommendedMoves(it), normLeague, isShadowInput)
        computeEffectiveCombatStats(withRankMoves, normLeague, customCp, customIvs)
    })
}

/**
 * Parses user IV string (e.g. "0/15/15", "15-15-15", "15 15 15") or returns PvPoke default IVs for the league.
 */
internal fun OverlayService.Companion.parseIvTriplet(ivStr: String?, league: String, meta: PokemonMeta): Triple<Int, Int, Int> {
    if (!ivStr.isNullOrBlank()) {
        val parts = ivStr.trim().split(Regex("[/\\-,\\s]+")).mapNotNull { it.toIntOrNull() }
        if (parts.size >= 3) {
            return Triple(
                parts[0].coerceIn(0, 15),
                parts[1].coerceIn(0, 15),
                parts[2].coerceIn(0, 15)
            )
        }
    }
    val cpCap = getLeagueCpCapStatic(league)
    return when {
        cpCap <= 1500 -> {
            val glParts = meta.defaultIvsGl.split("/").mapNotNull { it.toIntOrNull() }
            if (glParts.size >= 3) Triple(glParts[0], glParts[1], glParts[2]) else Triple(1, 15, 15)
        }
        cpCap == 2500 -> {
            val ulParts = meta.defaultIvsUl.split("/").mapNotNull { it.toIntOrNull() }
            if (ulParts.size >= 3) Triple(ulParts[0], ulParts[1], ulParts[2]) else Triple(1, 15, 15)
        }
        else -> Triple(15, 15, 15)
    }
}

/**
 * Computes League CP-scaled and IV-adjusted effective combat stats (Atk, Def, HP, and CP).
 * Automatically defaults to PvPoke standard IVs and official half-level CPM when customIvs/customCp is blank.
 */
internal fun OverlayService.Companion.computeEffectiveCombatStats(
    meta: PokemonMeta,
    league: String,
    customCp: Int? = null,
    customIvs: String? = null
): PokemonMeta {
    val cpCap = getLeagueCpCapStatic(league)
    val isLittle = cpCap == 500
    val isGreat = cpCap <= 1500
    val isUltra = cpCap == 2500
    val leagueCap = when {
        isLittle -> 500
        isGreat -> 1500
        isUltra -> 2500
        else -> 6000
    }

    val actualIvs = parseIvTriplet(customIvs, league, meta)

    if (meta.isRawBaseStats) {
        val uAtk = (meta.atk + actualIvs.first).coerceAtLeast(20.0)
        val uDef = (meta.def + actualIvs.second).coerceAtLeast(20.0)
        val uHp = (meta.hp.toDouble() + actualIvs.third).coerceAtLeast(20.0)
        val (cpm, targetCp) = if (customCp != null && customCp in 100..(leagueCap + 100)) {
            val solvedCpm = kotlin.math.sqrt((customCp * 10.0) / (uAtk * kotlin.math.sqrt(uDef * uHp))).coerceIn(0.094, 0.8453)
            solvedCpm to customCp
        } else {
            solveLeagueLevelCpm(uAtk, uDef, uHp, leagueCap)
        }
        return meta.copy(
            defaultCp = targetCp,
            atk = uAtk * cpm,
            def = uDef * cpm,
            hp = floor(uHp * cpm).toInt().coerceAtLeast(10),
            isRawBaseStats = false
        )
    }

    // Static POKEMON_META_DATABASE entries: derive true reference CP from actual (atk, def, hp) stat product
    val statRefCp = floor(meta.atk * kotlin.math.sqrt(meta.def * meta.hp.toDouble()) / 10.0).coerceAtLeast(100.0)
    val refCpm = when {
        statRefCp > 2500.0 -> 0.8403
        statRefCp > 1550.0 -> 0.7903
        else -> 0.7317
    }
    val refIvs = when {
        statRefCp > 2500.0 -> Triple(15, 15, 15)
        else -> Triple(1, 15, 15)
    }

    val adjAtkAtRef = (meta.atk + (actualIvs.first - refIvs.first) * refCpm).coerceAtLeast(20.0)
    val adjDefAtRef = (meta.def + (actualIvs.second - refIvs.second) * refCpm).coerceAtLeast(20.0)
    val adjHpAtRef = (meta.hp.toDouble() + (actualIvs.third - refIvs.third) * refCpm).coerceAtLeast(20.0)

    val refProd = (meta.atk * kotlin.math.sqrt(meta.def * meta.hp.toDouble())).coerceAtLeast(1.0)
    val adjProd = (adjAtkAtRef * kotlin.math.sqrt(adjDefAtRef * adjHpAtRef)).coerceAtLeast(1.0)
    val ivCpRatio = adjProd / refProd

    val defaultLeagueCp = when {
        isGreat -> if (meta.defaultCp <= 1500) meta.defaultCp else 1498
        isUltra -> when {
            meta.defaultCp in 1501..2500 -> meta.defaultCp
            meta.defaultCp > 2500 -> 2496
            else -> min(2500, (statRefCp * 1.65).roundToInt())
        }
        else -> if (meta.defaultCp > 2500) meta.defaultCp else (statRefCp * 1.45).roundToInt().coerceAtMost(4720)
    }

    val targetCp = if (customCp != null && customCp in 100..(leagueCap + 100)) {
        customCp
    } else if (!isGreat && !isUltra) {
        (defaultLeagueCp * ivCpRatio).roundToInt().coerceAtLeast(100)
    } else {
        defaultLeagueCp
    }

    val effectiveRefCp = (statRefCp * ivCpRatio).coerceAtLeast(100.0)
    val cpmScale = kotlin.math.sqrt(targetCp.toDouble() / effectiveRefCp).coerceIn(0.35, 1.45)

    return meta.copy(
        defaultCp = targetCp,
        atk = adjAtkAtRef * cpmScale,
        def = adjDefAtRef * cpmScale,
        hp = (adjHpAtRef * cpmScale).roundToInt().coerceAtLeast(10)
    )
}

internal fun OverlayService.Companion.parseGamemasterJsonStatic(jsonStr: String) {
    try {
        val root = JsonParser.parseString(jsonStr).asJsonObject
        val movesArr: JsonArray? = root.optJsonArray("moves")
        val fastMoveNames = HashMap<String, String>()
        if (movesArr != null) {
            for (el in movesArr) {
                try {
                    if (!el.isJsonObject) continue
                    val obj = el.asJsonObject
                    val moveId = obj.optString("moveId")?.takeIf { it.isNotBlank() } ?: continue
                    val rawName = obj.optString("name")?.takeIf { it.isNotBlank() } ?: moveId
                    val name = CANONICAL_MOVE_ID_MAP[moveId.uppercase()] ?: rawName
                    val type = obj.optString("type")?.lowercase() ?: "normal"
                    val power = obj.optInt("power") ?: 0
                    val energyGain = obj.optInt("energyGain") ?: 0
                    val energyCost = obj.optInt("energy") ?: 50
                    val turns = (obj.optInt("turns")?.takeIf { it in 1..5 }
                        ?: ((obj.optInt("cooldown") ?: 1000) / 500)).coerceIn(1, 5)
                    DYNAMIC_MOVE_ID_TO_NAME[moveId] = name
                    if (energyGain > 0) {
                        fastMoveNames[moveId] = name
                        val idKey = moveId.lowercase().trim()
                        DYNAMIC_FAST_TURNS[idKey] = turns
                        DYNAMIC_FAST_ENERGY[idKey] = energyGain
                        DYNAMIC_FAST_POWER[idKey] = power
                        DYNAMIC_FAST_TYPE[idKey] = type
                        if (!moveId.startsWith("AEGISLASH_CHARGE_", ignoreCase = true)) {
                            val nameKey = name.lowercase().trim()
                            val rawKey = rawName.lowercase().trim()
                            val spaceKey = nameKey.replace("-", " ")
                            val hyphenKey = nameKey.replace(Regex("\\s+"), "-")
                            for (k in listOf(nameKey, rawKey, spaceKey, hyphenKey).distinct()) {
                                if (k.isNotBlank()) {
                                    DYNAMIC_FAST_TURNS[k] = turns
                                    DYNAMIC_FAST_ENERGY[k] = energyGain
                                    DYNAMIC_FAST_POWER[k] = power
                                    DYNAMIC_FAST_TYPE[k] = type
                                }
                            }
                        }
                    } else {
                        val chargedPower = if (power > 0) power else 50
                        val chargedStats = MoveStats(name, type, chargedPower, energyCost)
                        DYNAMIC_MOVE_DATABASE[name] = chargedStats
                        val nameKey = name.lowercase().trim()
                        val rawKey = rawName.lowercase().trim()
                        val idKey = moveId.lowercase().trim()
                        val spaceKey = nameKey.replace("-", " ")
                        val hyphenKey = nameKey.replace(Regex("\\s+"), "-")
                        val underscoreKey = nameKey.replace(Regex("[\\s-]+"), "_")
                        for (k in listOf(nameKey, rawKey, idKey, spaceKey, hyphenKey, underscoreKey).distinct()) {
                            if (k.isNotBlank()) {
                                DYNAMIC_MOVE_DATABASE[k] = chargedStats
                            }
                        }
                        val rawChance = obj.optDouble("buffApplyChance")
                            ?: obj.optString("buffApplyChance")?.toDoubleOrNull()
                            ?: 0.0
                        var selfAtk = 0
                        var selfDef = 0
                        var oppAtk = 0
                        var oppDef = 0
                        val buffsSelfArr = obj.optJsonArray("buffsSelf")
                        val buffsOppArr = obj.optJsonArray("buffsOpponent")
                        val buffsArr = obj.optJsonArray("buffs")
                        val buffTarget = obj.optString("buffTarget")?.lowercase()?.trim() ?: ""
                        if (buffsSelfArr != null && buffsSelfArr.size() >= 2) {
                            selfAtk = runCatching { buffsSelfArr.get(0).asInt }.getOrDefault(0)
                            selfDef = runCatching { buffsSelfArr.get(1).asInt }.getOrDefault(0)
                        }
                        if (buffsOppArr != null && buffsOppArr.size() >= 2) {
                            oppAtk = runCatching { buffsOppArr.get(0).asInt }.getOrDefault(0)
                            oppDef = runCatching { buffsOppArr.get(1).asInt }.getOrDefault(0)
                        }
                        if (buffsArr != null && buffsArr.size() >= 2 && selfAtk == 0 && selfDef == 0 && oppAtk == 0 && oppDef == 0) {
                            val b0 = runCatching { buffsArr.get(0).asInt }.getOrDefault(0)
                            val b1 = runCatching { buffsArr.get(1).asInt }.getOrDefault(0)
                            when (buffTarget) {
                                "opponent" -> {
                                    oppAtk = b0
                                    oppDef = b1
                                }
                                "self" -> {
                                    selfAtk = b0
                                    selfDef = b1
                                }
                                "both" -> {
                                    selfAtk = b0
                                    selfDef = b1
                                    oppAtk = b0
                                    oppDef = b1
                                }
                            }
                        }
                        val normChance = if (rawChance > 1.0) (rawChance / 100.0).coerceIn(0.0, 1.0) else rawChance.coerceIn(0.0, 1.0)
                        if (normChance > 0.0 && (selfAtk != 0 || selfDef != 0 || oppAtk != 0 || oppDef != 0)) {
                            val parsedBuff = MoveBuffEffect(selfAtk, selfDef, oppAtk, oppDef, normChance)
                            DYNAMIC_MOVE_BUFF_TABLE[name.lowercase().trim()] = parsedBuff
                            DYNAMIC_MOVE_BUFF_TABLE[moveId.lowercase().trim()] = parsedBuff
                        } else {
                            DYNAMIC_MOVE_BUFF_TABLE.remove(name.lowercase().trim())
                            DYNAMIC_MOVE_BUFF_TABLE.remove(moveId.lowercase().trim())
                        }
                    }
                } catch (_: Exception) {}
            }
        }

        val pokemonArr: JsonArray? = root.optJsonArray("pokemon")
        if (pokemonArr != null) {
            val existingById = POKEMON_META_DATABASE.associateBy { it.speciesId.lowercase() }
            val parsedList = mutableListOf<PokemonMeta>()
            for (el in pokemonArr) {
                try {
                    if (!el.isJsonObject) continue
                    val obj = el.asJsonObject
                    val speciesId = obj.optString("speciesId")?.takeIf { it.isNotBlank() } ?: continue
                    val existingStatic = existingById[speciesId.lowercase()]

                    val rawSpeciesName = obj.optString("speciesName")?.takeIf { it.isNotBlank() } ?: continue
                    val speciesName = if (rawSpeciesName.endsWith(" (Shadow)")) {
                        "Shadow " + rawSpeciesName.removeSuffix(" (Shadow)").trim()
                    } else {
                        rawSpeciesName
                    }
                    val baseSpecies = FormResolver.extractBaseSpecies(speciesName)

                    val formLabel = Regex("\\((.*?)\\)").find(rawSpeciesName)?.groupValues?.getOrNull(1)
                        ?: if (speciesName.startsWith("Mega ", ignoreCase = true)) "Mega"
                        else if (speciesName.startsWith("Primal ", ignoreCase = true)) "Primal"
                        else "Base"

                    val typesArr = obj.optJsonArray("types")
                    val types = mutableListOf<String>()
                    if (typesArr != null) {
                        for (t in typesArr) {
                            if (t != null && !t.isJsonNull && t.isJsonPrimitive) {
                                val ts = t.asString
                                if (ts != "none") types.add(ts.lowercase())
                            }
                        }
                    }
                    if (types.isEmpty()) types.add("normal")

                    val baseStats = obj.optJsonObject("baseStats")
                    val atk = baseStats?.optDouble("atk") ?: 180.0
                    val def = baseStats?.optDouble("def") ?: 170.0
                    val hp = baseStats?.optInt("hp") ?: 160

                    var defaultIvsGl = "1/15/15"
                    var defaultIvsUl = "1/15/15"
                    val defaultIvsObj = obj.optJsonObject("defaultIVs")
                    if (defaultIvsObj != null) {
                        val cp1500 = defaultIvsObj.optJsonArray("cp1500")
                        if (cp1500 != null && cp1500.size() >= 4) {
                            runCatching {
                                defaultIvsGl = "${cp1500.get(1).asDouble.toInt()}/${cp1500.get(2).asDouble.toInt()}/${cp1500.get(3).asDouble.toInt()}"
                            }
                        }
                        val cp2500 = defaultIvsObj.optJsonArray("cp2500")
                        if (cp2500 != null && cp2500.size() >= 4) {
                            runCatching {
                                defaultIvsUl = "${cp2500.get(1).asDouble.toInt()}/${cp2500.get(2).asDouble.toInt()}/${cp2500.get(3).asDouble.toInt()}"
                            }
                        }
                    }

                    val rankEntry = LIVE_RANKINGS_MAP["GREAT LEAGUE"]?.get(speciesId.lowercase())
                        ?: LIVE_RANKINGS_MAP["ULTRA LEAGUE"]?.get(speciesId.lowercase())
                        ?: LIVE_RANKINGS_MAP["MASTER LEAGUE"]?.get(speciesId.lowercase())
                        ?: LIVE_RANKINGS_MAP["MEGA MASTER LEAGUE"]?.get(speciesId.lowercase())

                    val fastMovesArr = obj.optJsonArray("fastMoves")
                    val eliteArr = obj.optJsonArray("eliteMoves")
                    val orderedFastIds = mutableListOf<String>()
                    rankEntry?.moveset?.getOrNull(0)?.takeIf { it.isNotBlank() }?.let { orderedFastIds.add(it) }
                    rankEntry?.moves?.fastMoves?.forEach { fm ->
                        if (fm.moveId.isNotBlank() && !orderedFastIds.contains(fm.moveId)) {
                            orderedFastIds.add(fm.moveId)
                        }
                    }
                    if (eliteArr != null) {
                        for (em in eliteArr) {
                            if (em != null && !em.isJsonNull && em.isJsonPrimitive) {
                                val emId = em.asString
                                if (fastMoveNames.containsKey(emId) && !orderedFastIds.contains(emId)) {
                                    orderedFastIds.add(emId)
                                }
                            }
                        }
                    }
                    if (fastMovesArr != null) {
                        for (fm in fastMovesArr) {
                            if (fm != null && !fm.isJsonNull && fm.isJsonPrimitive) {
                                val fmId = fm.asString
                                if (fmId.isNotBlank() && !orderedFastIds.contains(fmId)) {
                                    orderedFastIds.add(fmId)
                                }
                            }
                        }
                    }
                    val firstFastId = orderedFastIds.firstOrNull() ?: "TACKLE"
                    val fastMoveName = fastMoveNames[firstFastId]
                        ?: formatMoveIdDisplay(firstFastId)
                    val fastTurns = resolveFastTurnsStatic(fastMoveName, 2)

                    val chargedArr = obj.optJsonArray("chargedMoves")
                    val extraChargedArr = obj.optJsonArray("extraChargedMoves")
                    if (extraChargedArr != null) {
                        for (ecm in extraChargedArr) {
                            if (ecm != null && !ecm.isJsonNull && ecm.isJsonPrimitive) {
                                val ecmId = ecm.asString.trim()
                                if (ecmId.uppercase().endsWith("_PLUS")) {
                                    val plusDisplay = formatMoveIdDisplay(ecmId)
                                    DYNAMIC_SUPER_MEGA_PLUS_MOVES[speciesId.lowercase()] = plusDisplay
                                    DYNAMIC_SUPER_MEGA_PLUS_MOVES[speciesName.lowercase()] = plusDisplay
                                    existingStatic?.name?.lowercase()?.let { DYNAMIC_SUPER_MEGA_PLUS_MOVES[it] = plusDisplay }
                                }
                            }
                        }
                    }
                    val orderedChargedIds = mutableListOf<String>()
                    rankEntry?.moveset?.drop(1)?.forEach { msId ->
                        if (msId.isNotBlank() && !msId.uppercase().endsWith("_PLUS") && !orderedChargedIds.contains(msId)) {
                            orderedChargedIds.add(msId)
                        }
                    }
                    rankEntry?.moves?.chargedMoves?.forEach { cm ->
                        if (cm.moveId.isNotBlank() && !cm.moveId.uppercase().endsWith("_PLUS") && !orderedChargedIds.contains(cm.moveId)) {
                            orderedChargedIds.add(cm.moveId)
                        }
                    }
                    if (eliteArr != null) {
                        for (em in eliteArr) {
                            if (em != null && !em.isJsonNull && em.isJsonPrimitive) {
                                val emId = em.asString
                                if (!fastMoveNames.containsKey(emId) && !emId.uppercase().endsWith("_PLUS") && !orderedChargedIds.contains(emId)) {
                                    orderedChargedIds.add(emId)
                                }
                            }
                        }
                    }
                    if (chargedArr != null) {
                        for (cm in chargedArr) {
                            if (cm != null && !cm.isJsonNull && cm.isJsonPrimitive) {
                                val cmId = cm.asString
                                if (!cmId.uppercase().endsWith("_PLUS") && !orderedChargedIds.contains(cmId)) {
                                    orderedChargedIds.add(cmId)
                                }
                            }
                        }
                    }

                    val formattedFastPool = orderedFastIds.map { fastMoveNames[it] ?: formatMoveIdDisplay(it) }.filter { it.isNotBlank() }.distinct()
                    val formattedChargedPool = orderedChargedIds.map { formatMoveIdDisplay(it) }.filter { it.isNotBlank() && !it.endsWith("+") }.distinct()
                    if (formattedFastPool.isNotEmpty()) {
                        SPECIES_FAST_MOVES_POOL[speciesId.lowercase()] = formattedFastPool
                        SPECIES_FAST_MOVES_POOL[speciesName.lowercase()] = formattedFastPool
                    }
                    if (formattedChargedPool.isNotEmpty()) {
                        SPECIES_CHARGED_MOVES_POOL[speciesId.lowercase()] = formattedChargedPool
                        SPECIES_CHARGED_MOVES_POOL[speciesName.lowercase()] = formattedChargedPool
                    }

                    val c1Id = orderedChargedIds.getOrNull(0) ?: "BODY_SLAM"
                    val c2Id = orderedChargedIds.getOrNull(1) ?: c1Id
                    val c3Id = orderedChargedIds.getOrNull(2) ?: ""
                    val c4Id = orderedChargedIds.getOrNull(3) ?: ""
                    val c1Name = formatMoveIdDisplay(c1Id)
                    val c2Name = formatMoveIdDisplay(c2Id)
                    val c3Name = if (c3Id.isNotBlank()) formatMoveIdDisplay(c3Id) else ""
                    val c4Name = if (c4Id.isNotBlank()) formatMoveIdDisplay(c4Id) else ""

                    val baseMeta = PokemonMeta(
                        name = existingStatic?.name ?: speciesName,
                        speciesId = speciesId,
                        baseSpecies = existingStatic?.baseSpecies ?: baseSpecies,
                        formLabel = existingStatic?.formLabel ?: formLabel,
                        types = types,
                        defaultCp = existingStatic?.defaultCp ?: 2500,
                        defaultFastMove = fastMoveName,
                        fastTurns = fastTurns,
                        chargedMove1 = c1Name,
                        chargedMove2 = c2Name,
                        atk = atk,
                        def = def,
                        hp = hp,
                        glRank = existingStatic?.glRank ?: 500,
                        ulRank = existingStatic?.ulRank ?: 500,
                        mlRank = existingStatic?.mlRank ?: 500,
                        chargedMove3 = c3Name,
                        chargedMove4 = c4Name,
                        isRawBaseStats = true,
                        defaultIvsGl = defaultIvsGl,
                        defaultIvsUl = defaultIvsUl
                    )
                    parsedList.add(applyRecommendedMoves(baseMeta))
                } catch (_: Exception) {}
            }
            DYNAMIC_POKEMON_DATABASE.clear()
            DYNAMIC_POKEMON_DATABASE.addAll(parsedList)
            clearSimulationCachesStatic()
        }
    } catch (_: Exception) {}
}

internal fun OverlayService.Companion.getTypeEffectivenessStatic(moveType: String, defenderTypes: List<String>): Double {
    var multiplier = 1.0
    val atk = moveType.lowercase().trim()
    for (def in defenderTypes.map { it.lowercase().trim() }.filter { it.isNotEmpty() && it != "none" }.distinct()) {
        val eff = when (atk) {
            "normal" -> when (def) { "rock", "steel" -> 0.625; "ghost" -> 0.390625; else -> 1.0 }
            "fire" -> when (def) { "grass", "ice", "bug", "steel" -> 1.6; "fire", "water", "rock", "dragon" -> 0.625; else -> 1.0 }
            "water" -> when (def) { "fire", "ground", "rock" -> 1.6; "water", "grass", "dragon" -> 0.625; else -> 1.0 }
            "electric" -> when (def) { "water", "flying" -> 1.6; "electric", "grass", "dragon" -> 0.625; "ground" -> 0.390625; else -> 1.0 }
            "grass" -> when (def) { "water", "ground", "rock" -> 1.6; "fire", "grass", "poison", "flying", "bug", "dragon", "steel" -> 0.625; else -> 1.0 }
            "ice" -> when (def) { "grass", "ground", "flying", "dragon" -> 1.6; "fire", "water", "ice", "steel" -> 0.625; else -> 1.0 }
            "fighting" -> when (def) { "normal", "ice", "rock", "dark", "steel" -> 1.6; "poison", "flying", "psychic", "bug", "fairy" -> 0.625; "ghost" -> 0.390625; else -> 1.0 }
            "poison" -> when (def) { "grass", "fairy" -> 1.6; "poison", "ground", "rock", "ghost" -> 0.625; "steel" -> 0.390625; else -> 1.0 }
            "ground" -> when (def) { "fire", "electric", "poison", "rock", "steel" -> 1.6; "grass", "bug" -> 0.625; "flying" -> 0.390625; else -> 1.0 }
            "flying" -> when (def) { "grass", "fighting", "bug" -> 1.6; "electric", "rock", "steel" -> 0.625; else -> 1.0 }
            "psychic" -> when (def) { "fighting", "poison" -> 1.6; "psychic", "steel" -> 0.625; "dark" -> 0.390625; else -> 1.0 }
            "bug" -> when (def) { "grass", "psychic", "dark" -> 1.6; "fire", "fighting", "poison", "flying", "ghost", "steel", "fairy" -> 0.625; else -> 1.0 }
            "rock" -> when (def) { "fire", "ice", "flying", "bug" -> 1.6; "fighting", "ground", "steel" -> 0.625; else -> 1.0 }
            "ghost" -> when (def) { "psychic", "ghost" -> 1.6; "dark" -> 0.625; "normal" -> 0.390625; else -> 1.0 }
            "dragon" -> when (def) { "dragon" -> 1.6; "steel" -> 0.625; "fairy" -> 0.390625; else -> 1.0 }
            "dark" -> when (def) { "psychic", "ghost" -> 1.6; "fighting", "dark", "fairy" -> 0.625; else -> 1.0 }
            "steel" -> when (def) { "ice", "rock", "fairy" -> 1.6; "fire", "water", "electric", "steel" -> 0.625; else -> 1.0 }
            "fairy" -> when (def) { "fighting", "dragon", "dark" -> 1.6; "fire", "poison", "steel" -> 0.625; else -> 1.0 }
            else -> 1.0
        }
        multiplier *= eff
    }
    return multiplier
}

internal fun OverlayService.Companion.getPlusMovePowerMultiplierStatic(level: Int): Double = when {
    level <= 0 -> 0.0
    level == 1 -> 1.00
    level == 2 -> 1.10
    level == 3 -> 1.20
    else -> 1.30
}

internal fun OverlayService.Companion.calculateChargedMoveDamagePctStatic(
    attacker: PokemonMeta,
    defender: PokemonMeta,
    moveName: String,
    isAttackerShadow: Boolean,
    isDefenderShadow: Boolean,
    plusMoveLevel: Int = 4
): Int {
    val moveStats = resolveChargedMoveStatsStatic(moveName, attacker.types.firstOrNull() ?: "normal")
    val isMorpeko = attacker.baseSpecies.equals("morpeko", ignoreCase = true)
    val isAuraWheel = isMorpeko && moveName.equals("Aura Wheel", ignoreCase = true)
    val isAegislash = attacker.baseSpecies.equals("aegislash", ignoreCase = true)
    val isAttackerCramorant = attacker.baseSpecies.equals("cramorant", ignoreCase = true)
    val isDefenderCramorant = defender.baseSpecies.equals("cramorant", ignoreCase = true)

    val stab = if (isAuraWheel || attacker.types.any { it.equals(moveStats.type, ignoreCase = true) }) 1.2 else 1.0
    val typeEff = if (isAuraWheel) {
        // Hunger Switch alternates Aura Wheel between Electric (Full Belly) and Dark (Hangry) every Charged Attack
        val effElectric = getTypeEffectivenessStatic("electric", defender.types)
        val effDark = getTypeEffectivenessStatic("dark", defender.types)
        0.60 * max(effElectric, effDark) + 0.40 * min(effElectric, effDark)
    } else {
        getTypeEffectivenessStatic(moveStats.type, defender.types)
    }

    // Aegislash Stance Change: Shield Forme (97 Base Atk / 291 Base Def) swaps into fragile Blade Forme (291 Base Atk / 97 Base Def) when attacking.
    // Because Shield Forme's 291 Base Def is already modeled in effectiveDef, use a balanced 1.22x net Stance Change factor (never 2.85x, which would grant 291 Atk and 291 Def simultaneously).
    val stanceAtkMultiplier = if (isAegislash && attacker.atk < attacker.def * 0.65) 1.22 else 1.0
    // Morpeko Aura Wheel (+1 Atk stage) & Cramorant Gulp Missile Gulping Form (-1 Opp Def stage after Surf catch)
    val buffAtkMultiplier = when {
        isAuraWheel -> 1.20
        isMorpeko -> 1.12
        isAttackerCramorant -> 1.12
        else -> 1.0
    }
    // Cramorant Gulp Missile Gorging Form (-1 Opp Atk stage at <=50% HP)
    val defenderGulpMultiplier = if (isDefenderCramorant) 1.08 else 1.0

    val effectiveAtk = attacker.atk * (if (isAttackerShadow) 1.2 else 1.0) * stanceAtkMultiplier * buffAtkMultiplier
    val effectiveDef = defender.def * (if (isDefenderShadow) 0.8333333 else 1.0) * defenderGulpMultiplier
    val isPlusMove = moveName.trim().endsWith("+")
    val plusMult = if (isPlusMove) getPlusMovePowerMultiplierStatic(plusMoveLevel) else 1.0
    if (isPlusMove && plusMult <= 0.0) return 0
    val effectivePower = if (isPlusMove) (moveStats.power.toDouble() / 1.3) * plusMult else moveStats.power.toDouble()
    val rawDamage = floor(0.5 * effectivePower * (effectiveAtk / effectiveDef) * stab * typeEff * 1.3) + 1.0
    return ((rawDamage / defender.hp.toDouble()) * 100.0).roundToInt().coerceIn(5, 100)
}

internal fun OverlayService.Companion.getAvailableMovePoolForSpeciesStatic(
    rawName: String,
    league: String = "GREAT LEAGUE"
): Pair<List<String>, List<String>> {
    val meta = resolveRecommendedMovesForSpecies(rawName, league)
        ?: POKEMON_META_DATABASE.first()
    val cleanSpeciesId = meta.speciesId.lowercase().removeSuffix("_shadow")
    val baseKey = meta.baseSpecies.lowercase()
    val rankEntry = resolveRankingsMapForLeagueStatic(league)?.let { map ->
        map[meta.speciesId.lowercase()] ?: map[cleanSpeciesId] ?: map["${cleanSpeciesId}_shadow"]
    }

    val gmFastPool = SPECIES_FAST_MOVES_POOL[meta.speciesId.lowercase()]
        ?: SPECIES_FAST_MOVES_POOL[cleanSpeciesId]
        ?: SPECIES_FAST_MOVES_POOL[meta.name.lowercase()]
        ?: SPECIES_FAST_MOVES_POOL[baseKey]
        ?: SPECIES_FAST_MOVES_POOL["${cleanSpeciesId}_shield"]
        ?: SPECIES_FAST_MOVES_POOL["${cleanSpeciesId}_full_belly"]

    val effectiveFastPool = if (!gmFastPool.isNullOrEmpty()) {
        gmFastPool
    } else {
        FALLBACK_SPECIES_FAST_POOL[cleanSpeciesId]
            ?: FALLBACK_SPECIES_FAST_POOL[baseKey]
            ?: FALLBACK_SPECIES_FAST_POOL[meta.name.lowercase()]
    }

    val fastList = mutableListOf<String>()
    fun addFast(name: String?) {
        val trimmed = name?.trim().orEmpty()
        if (trimmed.isEmpty() || trimmed.equals("Struggle", ignoreCase = true)) return
        if (!effectiveFastPool.isNullOrEmpty() && effectiveFastPool.none { it.equals(trimmed, ignoreCase = true) }) {
            return
        }
        if (fastList.none { it.equals(trimmed, ignoreCase = true) }) {
            fastList.add(trimmed)
        }
    }

    rankEntry?.moveset?.getOrNull(0)?.let { addFast(formatMoveIdDisplay(it)) }
    addFast(meta.defaultFastMove)
    rankEntry?.moves?.fastMoves?.forEach { addFast(formatMoveIdDisplay(it.moveId)) }
    effectiveFastPool?.forEach { addFast(it) }
    if (fastList.isEmpty() && meta.defaultFastMove.isNotBlank()) {
        fastList.add(meta.defaultFastMove.trim())
    }

    val gmChargedPool = SPECIES_CHARGED_MOVES_POOL[meta.speciesId.lowercase()]
        ?: SPECIES_CHARGED_MOVES_POOL[cleanSpeciesId]
        ?: SPECIES_CHARGED_MOVES_POOL[meta.name.lowercase()]
        ?: SPECIES_CHARGED_MOVES_POOL[baseKey]
        ?: SPECIES_CHARGED_MOVES_POOL["${cleanSpeciesId}_shield"]
        ?: SPECIES_CHARGED_MOVES_POOL["${cleanSpeciesId}_full_belly"]

    val effectiveChargedPool = if (!gmChargedPool.isNullOrEmpty()) {
        gmChargedPool
    } else {
        FALLBACK_SPECIES_CHARGED_POOL[cleanSpeciesId]
            ?: FALLBACK_SPECIES_CHARGED_POOL[baseKey]
            ?: FALLBACK_SPECIES_CHARGED_POOL[meta.name.lowercase()]
    }

    val chargedList = mutableListOf<String>()
    fun addCharged(name: String?) {
        val trimmed = name?.trim().orEmpty()
        if (trimmed.isEmpty() || trimmed.equals("Struggle", ignoreCase = true) || trimmed.equals("Frustration", ignoreCase = true) || trimmed.endsWith("+")) return
        if (!effectiveChargedPool.isNullOrEmpty() && effectiveChargedPool.none { it.equals(trimmed, ignoreCase = true) }) {
            return
        }
        if (chargedList.none { it.equals(trimmed, ignoreCase = true) }) {
            chargedList.add(trimmed)
        }
    }

    rankEntry?.moveset?.drop(1)?.forEach { addCharged(formatMoveIdDisplay(it)) }
    addCharged(meta.chargedMove1)
    addCharged(meta.chargedMove2)
    addCharged(meta.chargedMove3)
    addCharged(meta.chargedMove4)
    rankEntry?.moves?.chargedMoves?.forEach { addCharged(formatMoveIdDisplay(it.moveId)) }
    effectiveChargedPool?.forEach { addCharged(it) }
    if (chargedList.size < 3) {
        val common3rd = COMMON_THIRD_CHARGED_MOVE[meta.name]
            ?: COMMON_THIRD_CHARGED_MOVE.entries.firstOrNull { it.key.equals(meta.name, ignoreCase = true) }?.value
        if (!common3rd.isNullOrBlank()) {
            addCharged(common3rd)
        }
    }
    if (chargedList.isEmpty() && meta.chargedMove1.isNotBlank()) {
        chargedList.add(meta.chargedMove1.trim())
    }

    return fastList to chargedList
}

/**
 * Phase 1: Evaluates discrete battle rating across all 9 shield permutations
 * (s_user v s_opp in {0, 1, 2}^2): 0v0, 0v1, 0v2, 1v0, 1v1, 1v2, 2v0, 2v1, 2v2
 * using a weighted average of opponent PvPoke move combinations:
 *  - 1a (75% weight): default PvPoke moveset (fast1 / charge1 / charge2)
 *  - 1b (25% weight split equally = 5% each):
 *      fast1/charge1/charge3, fast1/charge1/charge4, fast1/charge2/charge3,
 *      fast1/charge2/charge4, fast2/charge1/charge2
 * Explicitly models unique PvP mechanics for Morpeko (Hunger Switch + Aura Wheel),
 * Mimikyu (Disguise free 1st unshielded charged block + Busted Form -1 Def stage),
 * Aegislash (Stance Change Shield ⇄ Blade Forme), and Cramorant (Gulp Missile Gulping/Gorging Form).
 */
internal fun OverlayService.Companion.calculateMatchupRatingStatic(
    myName: String,
    oppName: String,
    userShields: Int,
    oppShields: Int,
    league: String,
    myFastMove: String? = null,
    myCharged1: String? = null,
    myCharged2: String? = null,
    myCp: Int? = null,
    myIvs: String? = null,
    myPlusMoveLevel: Int? = 4
): Int {
    val sUser = userShields.coerceIn(0, 2)
    val sOpp = oppShields.coerceIn(0, 2)

    val myShadow = myName.trim().startsWith("Shadow ", ignoreCase = true) || myName.contains("(Shadow)", ignoreCase = true)
    val oppShadow = oppName.trim().startsWith("Shadow ", ignoreCase = true) || oppName.contains("(Shadow)", ignoreCase = true)

    val myMeta = resolveRecommendedMovesForSpecies(myName, league, myCp, myIvs)
        ?: POKEMON_META_DATABASE.first().let { computeEffectiveCombatStats(it, league, myCp, myIvs) }
    val oppMeta = resolveRecommendedMovesForSpecies(oppName, league)
        ?: POKEMON_META_DATABASE.first().let { computeEffectiveCombatStats(it, league) }

    val myIsMimikyu = myMeta.baseSpecies.equals("mimikyu", ignoreCase = true)
    val oppIsMimikyu = oppMeta.baseSpecies.equals("mimikyu", ignoreCase = true)
    val myIsAegislash = myMeta.baseSpecies.equals("aegislash", ignoreCase = true)
    val oppIsAegislash = oppMeta.baseSpecies.equals("aegislash", ignoreCase = true)

    val uFast = myFastMove?.takeIf { it.isNotBlank() } ?: myMeta.defaultFastMove
    val uC1 = myCharged1?.takeIf { it.isNotBlank() } ?: myMeta.chargedMove1
    val uC2 = myCharged2?.takeIf { it.isNotBlank() } ?: myMeta.chargedMove2
    val effectiveUserPlusLvl = (myPlusMoveLevel ?: 4).coerceIn(0, 4)
    val userPlusMove = if (effectiveUserPlusLvl <= 0) null else (resolveMegaPlusMoveStatic(myMeta.name, league) ?: resolveMegaPlusMoveStatic(myName, league))
    val oppPlusMove = resolveMegaPlusMoveStatic(oppMeta.name, league) ?: resolveMegaPlusMoveStatic(oppName, league)

    val userC1Stats = resolveChargedMoveStatsStatic(uC1, myMeta.types.firstOrNull() ?: "normal")
    val userC2Stats = resolveChargedMoveStatsStatic(uC2, myMeta.types.firstOrNull() ?: "normal")
    val userC3Stats = userPlusMove?.let { resolveChargedMoveStatsStatic(it, myMeta.types.firstOrNull() ?: "normal") }
    val userC1Pct = calculateChargedMoveDamagePctStatic(myMeta, oppMeta, uC1, myShadow, oppShadow)
    val userC2Pct = calculateChargedMoveDamagePctStatic(myMeta, oppMeta, uC2, myShadow, oppShadow)
    val userC3Pct = userPlusMove?.let { calculateChargedMoveDamagePctStatic(myMeta, oppMeta, it, myShadow, oppShadow, effectiveUserPlusLvl) } ?: 0
    val bestUserCharged = max(max(userC1Pct, userC2Pct), userC3Pct)
    val minUserCharged = if (userC3Pct > 0) min(min(userC1Pct, userC2Pct), userC3Pct) else min(userC1Pct, userC2Pct)
    val fastestUserChargedPct = listOfNotNull(
        userC1Stats.energyCost to userC1Pct,
        userC2Stats.energyCost to userC2Pct,
        if (userC3Stats != null && userC3Pct > 0) userC3Stats.energyCost to userC3Pct else null
    ).minByOrNull { it.first }?.second ?: minUserCharged

    val uFastKey = uFast.lowercase().trim()
    val userFastType = resolveFastTypeStatic(uFastKey, myMeta.types.firstOrNull() ?: "normal")
    val userFastTurns = resolveFastTurnsStatic(uFastKey, myMeta.fastTurns).coerceAtLeast(1)
    val userFastEnergy = resolveFastEnergyStatic(uFastKey, userFastTurns).coerceAtLeast(1)
    val userFastEpt = userFastEnergy.toDouble() / userFastTurns.toDouble()
    val rawUserFastEff = getTypeEffectivenessStatic(userFastType, oppMeta.types)

    fun getAegislashFastDmgMult(shields: Int): Double = when (shields) {
        2 -> 0.42
        1 -> 0.68
        else -> 1.12
    }

    val userFastEff = if (myIsAegislash) rawUserFastEff * getAegislashFastDmgMult(sUser) else rawUserFastEff
    val shadowBulkDelta = (if (myShadow) -12 else 0) + (if (oppShadow) 12 else 0)

    fun chargedPressureAgainstShields(bestPct: Int, minPct: Int, defShields: Int): Double = when (defShields) {
        0 -> bestPct * 1.7
        1 -> ((bestPct + minPct) * 0.5) * 1.4
        else -> minPct * 1.0
    }

    fun computeMimikyuIncomingEvaluation(
        mimiShields: Int,
        oppBestPct: Int,
        oppMinPct: Int,
        oppFastestPct: Int
    ): Pair<Double, Double> {
        val cheaperBaitRatio = (oppFastestPct.toDouble() / max(1, oppBestPct).toDouble()).coerceIn(0.42, 1.0)
        val baitTempoTax = (1.0 - cheaperBaitRatio) * 18.0

        val pressureAllShieldsFirst = when (mimiShields) {
            0 -> ((oppFastestPct * 0.30 + oppBestPct * 0.70) * 1.22) - baitTempoTax
            1 -> ((oppFastestPct * 0.55 + oppMinPct * 0.45) * 0.90) - baitTempoTax * 1.25
            else -> (oppFastestPct * 0.62) - baitTempoTax * 1.45
        }
        val bonusAllShieldsFirst = when (mimiShields) {
            0 -> 28.0 + oppBestPct * 0.20 - 11.0
            1 -> 26.0 + oppBestPct * 0.18 - 6.0
            else -> 22.0 + oppBestPct * 0.15 - 3.0
        }

        val bustedMult = 1.25 // Exact -1 Defense stage multiplier (1.0 / 0.80 = 1.25x incoming damage)
        val pressureDisguiseFirst = when (mimiShields) {
            0 -> ((oppFastestPct * 0.30 + oppBestPct * 0.70 * bustedMult) * 1.28) - baitTempoTax * 0.85
            1 -> ((oppFastestPct * 0.45 + ((oppBestPct + oppMinPct) * 0.5 * bustedMult) * 0.55) * 1.04) - baitTempoTax * 0.90
            else -> (oppFastestPct * 0.76 * bustedMult) - baitTempoTax * 0.95
        }
        val bonusDisguiseFirst = when (mimiShields) {
            0 -> 24.0 + oppBestPct * 0.18 - 14.0
            1 -> 19.0 + oppBestPct * 0.15 - 13.0
            else -> 14.0 + oppBestPct * 0.12 - 12.0
        }

        return ((pressureAllShieldsFirst + pressureDisguiseFirst) * 0.5) to ((bonusAllShieldsFirst + bonusDisguiseFirst) * 0.5)
    }

    val userSim = simulateTurnByTurnChargedCycleStatic(
        c1Name = uC1,
        c1Pct = userC1Pct,
        c1Stats = userC1Stats,
        c2Name = uC2,
        c2Pct = userC2Pct,
        c2Stats = userC2Stats,
        fastEpt = userFastEpt,
        defShields = sOpp,
        attackerTypes = myMeta.types,
        c3Name = userPlusMove,
        c3Pct = userC3Pct,
        c3Stats = userC3Stats
    )
    val userChargedFreqMult = userSim.effectiveFreqMult

    val userRawPressure: Double
    val oppMimikyuDelta: Double
    if (oppIsMimikyu) {
        val (incPressure, mimiBonus) = computeMimikyuIncomingEvaluation(sOpp, bestUserCharged, minUserCharged, fastestUserChargedPct)
        userRawPressure = incPressure
        oppMimikyuDelta = mimiBonus
    } else {
        userRawPressure = userSim.effectivePressure
        oppMimikyuDelta = 0.0
    }

    val avgShields = (sUser + sOpp) * 0.5
    val fastWeight = if (avgShields <= 1.0) {
        95.0 + avgShields * 25.0
    } else {
        120.0 + (avgShields - 1.0) * 35.0
    }
    val shadowMultiplier = if (avgShields <= 1.0) 1.0 else avgShields
    val effectiveShadowDelta = shadowBulkDelta * shadowMultiplier
    val shieldDiff = (sUser - sOpp).toDouble()

    val oppC3Stats = oppPlusMove?.let { resolveChargedMoveStatsStatic(it, oppMeta.types.firstOrNull() ?: "normal") }
    val oppC3Pct = oppPlusMove?.let { calculateChargedMoveDamagePctStatic(oppMeta, myMeta, it, oppShadow, myShadow) } ?: 0

    fun evaluateAgainstOppMoveset(oFastName: String, oC1Name: String, oC2Name: String): Double {
        val oppC1Stats = resolveChargedMoveStatsStatic(oC1Name, oppMeta.types.firstOrNull() ?: "normal")
        val oppC2Stats = resolveChargedMoveStatsStatic(oC2Name, oppMeta.types.firstOrNull() ?: "normal")
        val oppC1Pct = calculateChargedMoveDamagePctStatic(oppMeta, myMeta, oC1Name, oppShadow, myShadow)
        val oppC2Pct = calculateChargedMoveDamagePctStatic(oppMeta, myMeta, oC2Name, oppShadow, myShadow)
        val bestOppCharged = max(max(oppC1Pct, oppC2Pct), oppC3Pct)
        val minOppCharged = if (oppC3Pct > 0) min(min(oppC1Pct, oppC2Pct), oppC3Pct) else min(oppC1Pct, oppC2Pct)
        val fastestOppChargedPct = listOfNotNull(
            oppC1Stats.energyCost to oppC1Pct,
            oppC2Stats.energyCost to oppC2Pct,
            if (oppC3Stats != null && oppC3Pct > 0) oppC3Stats.energyCost to oppC3Pct else null
        ).minByOrNull { it.first }?.second ?: minOppCharged

        val oFastKey = oFastName.lowercase().trim()
        val oppFastType = resolveFastTypeStatic(oFastKey, oppMeta.types.firstOrNull() ?: "normal")
        val oppFastTurns = resolveFastTurnsStatic(oFastKey, oppMeta.fastTurns).coerceAtLeast(1)
        val oppFastEnergy = resolveFastEnergyStatic(oFastKey, oppFastTurns).coerceAtLeast(1)
        val oppFastEpt = oppFastEnergy.toDouble() / oppFastTurns.toDouble()
        val rawOppFastEff = getTypeEffectivenessStatic(oppFastType, myMeta.types)
        val oppFastEff = if (oppIsAegislash) rawOppFastEff * getAegislashFastDmgMult(sOpp) else rawOppFastEff

        val oppSim = simulateTurnByTurnChargedCycleStatic(
            c1Name = oC1Name,
            c1Pct = oppC1Pct,
            c1Stats = oppC1Stats,
            c2Name = oC2Name,
            c2Pct = oppC2Pct,
            c2Stats = oppC2Stats,
            fastEpt = oppFastEpt,
            defShields = sUser,
            attackerTypes = oppMeta.types,
            c3Name = oppPlusMove,
            c3Pct = oppC3Pct,
            c3Stats = oppC3Stats
        )
        val oppChargedFreqMult = oppSim.effectiveFreqMult

        val oppRawPressure: Double
        val myMimikyuDelta: Double
        if (myIsMimikyu) {
            val (incPressure, mimiBonus) = computeMimikyuIncomingEvaluation(sUser, bestOppCharged, minOppCharged, fastestOppChargedPct)
            oppRawPressure = incPressure
            myMimikyuDelta = mimiBonus
        } else {
            oppRawPressure = oppSim.effectivePressure
            myMimikyuDelta = 0.0
        }

        val userChargedImpact = userRawPressure * userChargedFreqMult
        val oppChargedImpact = oppRawPressure * oppChargedFreqMult
        val chargedDelta = 2.0 * (userChargedImpact - oppChargedImpact)
        val fastDelta = (userFastEff - oppFastEff) * fastWeight
        val shieldAdvantageDelta = shieldDiff * (85.0 + 0.65 * ((bestOppCharged + bestUserCharged) * 0.5))

        // Special mechanics (Morpeko Aura Wheel, Cramorant Gulp Missile, Aegislash Stance Change)
        // are already modeled in calculateChargedMoveDamagePctStatic & getAegislashFastDmgMult.
        // Do not add flat rating double-bonuses here.
        val uniqueMechanicsDelta = (myMimikyuDelta - oppMimikyuDelta)

        val totalDelta = chargedDelta + fastDelta + effectiveShadowDelta + shieldAdvantageDelta + uniqueMechanicsDelta
        return (500.0 + totalDelta).coerceIn(150.0, 850.0)
    }

    val (oppFastPool, oppChargedPool) = getAvailableMovePoolForSpeciesStatic(oppMeta.name, league)
    val fast1 = oppFastPool.getOrNull(0) ?: oppMeta.defaultFastMove
    val fast2 = oppFastPool.getOrNull(1)?.takeIf { !it.equals(fast1, ignoreCase = true) }
    val charge1 = oppChargedPool.getOrNull(0) ?: oppMeta.chargedMove1
    val charge2 = oppChargedPool.getOrNull(1)?.takeIf { !it.equals(charge1, ignoreCase = true) }
    val charge3 = oppChargedPool.getOrNull(2)?.takeIf {
        !it.equals(charge1, ignoreCase = true) && (charge2 == null || !it.equals(charge2, ignoreCase = true))
    }
    val charge4 = oppChargedPool.getOrNull(3)?.takeIf {
        !it.equals(charge1, ignoreCase = true) &&
            (charge2 == null || !it.equals(charge2, ignoreCase = true)) &&
            (charge3 == null || !it.equals(charge3, ignoreCase = true))
    }
    val effectiveCharge2 = charge2 ?: charge1

    // 1a. 75% weight to default PvPoke moveset (fast1 / charge1 / charge2)
    val br1a = evaluateAgainstOppMoveset(fast1, charge1, effectiveCharge2)

    // 1b. Equally weight the valid alternate PvPoke move combinations that actually exist for this species:
    //     fast1/charge1/charge3, fast1/charge1/charge4, fast1/charge2/charge3, fast1/charge2/charge4, fast2/charge1/charge2
    val altCombos1b = mutableListOf<Double>()
    if (charge3 != null) {
        altCombos1b.add(evaluateAgainstOppMoveset(fast1, charge1, charge3))
    }
    if (charge4 != null) {
        altCombos1b.add(evaluateAgainstOppMoveset(fast1, charge1, charge4))
    }
    if (charge2 != null && charge3 != null) {
        altCombos1b.add(evaluateAgainstOppMoveset(fast1, charge2, charge3))
    }
    if (charge2 != null && charge4 != null) {
        altCombos1b.add(evaluateAgainstOppMoveset(fast1, charge2, charge4))
    }
    if (fast2 != null) {
        altCombos1b.add(evaluateAgainstOppMoveset(fast2, charge1, effectiveCharge2))
    }

    val weightedBr = if (altCombos1b.isNotEmpty()) {
        0.75 * br1a + 0.25 * (altCombos1b.sum() / altCombos1b.size.toDouble())
    } else {
        br1a
    }
    return weightedBr.roundToInt().coerceIn(150, 850)
}

internal fun OverlayService.Companion.calculateAllShieldPermutationsStatic(
    myName: String,
    oppName: String,
    league: String,
    myFastMove: String? = null,
    myCharged1: String? = null,
    myCharged2: String? = null,
    myCp: Int? = null,
    myIvs: String? = null,
    myPlusMoveLevel: Int? = 4
): Map<String, Int> {
    return ALL_SHIELD_PERMUTATIONS.associate { (sUser, sOpp, code) ->
        code to calculateMatchupRatingStatic(
            myName = myName,
            oppName = oppName,
            userShields = sUser,
            oppShields = sOpp,
            league = league,
            myFastMove = myFastMove,
            myCharged1 = myCharged1,
            myCharged2 = myCharged2,
            myCp = myCp,
            myIvs = myIvs,
            myPlusMoveLevel = myPlusMoveLevel
        )
    }
}

internal fun OverlayService.Companion.calculate1v1And2v2RatingsStatic(
    myName: String,
    oppName: String,
    league: String,
    myFastMove: String? = null,
    myCharged1: String? = null,
    myCharged2: String? = null,
    myCp: Int? = null,
    myIvs: String? = null,
    myPlusMoveLevel: Int? = 4
): Pair<Int, Int> {
    val r1v1 = calculateMatchupRatingStatic(
        myName, oppName, 1, 1, league, myFastMove, myCharged1, myCharged2, myCp, myIvs, myPlusMoveLevel
    )
    val r2v2 = calculateMatchupRatingStatic(
        myName, oppName, 2, 2, league, myFastMove, myCharged1, myCharged2, myCp, myIvs, myPlusMoveLevel
    )
    return r1v1 to r2v2
}

/**
 * Computes the unweighted average 1v1 battle rating (R_bar) of a given Pokémon
 * against the active league's top meta list.
 */
internal fun OverlayService.Companion.computeMetaAverage1v1RatingStatic(
    pokemonName: String,
    league: String,
    myFastMove: String? = null,
    myCharged1: String? = null,
    myCharged2: String? = null,
    myCp: Int? = null,
    myIvs: String? = null,
    metaPool: List<String>? = null,
    myPlusMoveLevel: Int? = 4
): Double {
    val activeMetaPool = metaPool?.takeIf { it.isNotEmpty() } ?: getTopMetaPoolForLeagueStatic(league)
    if (activeMetaPool.isEmpty()) return 500.0
    return activeMetaPool.map { metaMon ->
        calculateMatchupRatingStatic(
            myName = pokemonName,
            oppName = metaMon,
            userShields = 1,
            oppShields = 1,
            league = league,
            myFastMove = myFastMove,
            myCharged1 = myCharged1,
            myCharged2 = myCharged2,
            myCp = myCp,
            myIvs = myIvs,
            myPlusMoveLevel = myPlusMoveLevel
        ).toDouble()
    }.average()
}

internal fun OverlayService.Companion.calculateAutoLeadMatchupStatic(
    myLead: String,
    oppLead: String,
    league: String,
    myFastMove: String? = null,
    myCharged1: String? = null,
    myCharged2: String? = null,
    myCp: Int? = null,
    myIvs: String? = null,
    myPlusMoveLevel: Int? = 4
): String {
    if (myLead.isBlank() || oppLead.isBlank()) return "NEUTRAL"
    val rating1s = calculateMatchupRatingStatic(
        myName = myLead,
        oppName = oppLead,
        userShields = 1,
        oppShields = 1,
        league = league,
        myFastMove = myFastMove,
        myCharged1 = myCharged1,
        myCharged2 = myCharged2,
        myCp = myCp,
        myIvs = myIvs,
        myPlusMoveLevel = myPlusMoveLevel
    )
    return when {
        rating1s >= activeTierWMin -> "FAVORABLE"
        rating1s <= activeTierLMax -> "NEGATIVE"
        else -> "NEUTRAL"
    }
}

internal fun OverlayService.Companion.getTopMetaPoolForLeagueStatic(league: String): List<String> {
    val normLeague = normalizeLeagueKeyStatic(league)
    TOP_META_POOL_CACHE[normLeague]?.let { return it }
    val candidates = getTop100MetaCandidatesForLeagueStatic(normLeague, 100).map { it.name }
    if (candidates.isNotEmpty()) {
        if (DYNAMIC_POKEMON_DATABASE.isNotEmpty()) {
            TOP_META_POOL_CACHE[normLeague] = candidates
        }
        return candidates
    }
    val isGreat = normLeague == "GREAT LEAGUE" || normLeague == "BATTLE FRONTIER (SPECTRAL)"
    val isUltra = normLeague == "ULTRA LEAGUE" || normLeague == "BATTLE FRONTIER (CAULDRON)"
    val sorted = getAllPokemonMeta()
        .filter { !it.speciesId.endsWith("_shadow", ignoreCase = true) && !it.name.startsWith("Shadow ", ignoreCase = true) }
        .sortedBy {
            when {
                isGreat -> it.glRank
                isUltra -> it.ulRank
                else -> it.mlRank
            }
        }
        .take(100)
        .map { it.name }
    val result = if (sorted.isNotEmpty()) sorted else listOf("Azumarill", "Clodsire", "Annihilape", "Feraligatr", "Mandibuzz", "Gastrodon")
    if (DYNAMIC_POKEMON_DATABASE.isNotEmpty()) {
        TOP_META_POOL_CACHE[normLeague] = result
    }
    return result
}
