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
import com.gbl.overlay.OverlayService.Companion.activeShow6UsageWeightPct
import com.gbl.overlay.OverlayService.Companion.ALL_18_TYPES
import com.gbl.overlay.OverlayService.Companion.BATTLE_FRONTIER_CORES_MAP
import com.gbl.overlay.OverlayService.Companion.BATTLE_FRONTIER_USAGE_MAP
import com.gbl.overlay.OverlayService.Companion.BattleFrontierCoreEntry
import com.gbl.overlay.OverlayService.Companion.BlindShow6RosterResult
import com.gbl.overlay.OverlayService.Companion.BlindShow6RosterSlot
import com.gbl.overlay.OverlayService.Companion.CRITICAL_META_TYPES
import com.gbl.overlay.OverlayService.Companion.DEFAULT_BF_CORES_SHEET_URL
import com.gbl.overlay.OverlayService.Companion.DEFAULT_BF_USAGE_SHEET_URL
import com.gbl.overlay.OverlayService.Companion.DEFAULT_LIMITED_META_CATALOG
import com.gbl.overlay.OverlayService.Companion.formatCatalogLeagueKeyStatic
import com.gbl.overlay.OverlayService.Companion.FormResolver
import com.gbl.overlay.OverlayService.Companion.FOUR_WEEKS_MS
import com.gbl.overlay.OverlayService.Companion.getEnabledShow6LeaguesStatic
import com.gbl.overlay.OverlayService.Companion.getForcedShow6LeaguesStatic
import com.gbl.overlay.OverlayService.Companion.getLimitedMetaCatalogStatic
import com.gbl.overlay.OverlayService.Companion.getPinnedGblLimitedMetasStatic
import com.gbl.overlay.OverlayService.Companion.getPinnedShow6LimitedMetasStatic
import com.gbl.overlay.OverlayService.Companion.isBattleFrontierFormatTitleStatic
import com.gbl.overlay.OverlayService.Companion.isBattleFrontierLeagueStatic
import com.gbl.overlay.OverlayService.Companion.isCurrentBattleFrontierCupStatic
import com.gbl.overlay.OverlayService.Companion.isExpiredLimitedMetaStatic
import com.gbl.overlay.OverlayService.Companion.LAST_LOADED_META_CATALOG
import com.gbl.overlay.OverlayService.Companion.LimitedMetaFormat
import com.gbl.overlay.OverlayService.Companion.LIVE_RANKINGS_MAP
import com.gbl.overlay.OverlayService.Companion.normalizeLeagueKeyStatic
import com.gbl.overlay.OverlayService.Companion.PREFS_KEY_BF_CORES_JSON
import com.gbl.overlay.OverlayService.Companion.PREFS_KEY_BF_CORES_SHEET_URL
import com.gbl.overlay.OverlayService.Companion.PREFS_KEY_BF_LAST_SYNC_MS
import com.gbl.overlay.OverlayService.Companion.PREFS_KEY_BF_USAGE_JSON
import com.gbl.overlay.OverlayService.Companion.PREFS_KEY_BF_USAGE_SHEET_URL
import com.gbl.overlay.OverlayService.Companion.PREFS_KEY_LIMITED_META_CATALOG_JSON
import com.gbl.overlay.OverlayService.Companion.Show6OpponentViableLineup
import com.gbl.overlay.OverlayService.Companion.Show6Pick3LineupRec
import com.gbl.overlay.OverlayService.Companion.Show6Pick3OptimizerResult
import com.gbl.overlay.OverlayService.Companion.Show6RosterSlotMovesetRec
import com.gbl.overlay.OverlayService.Companion.Show6RosterSlotUpgradeRec
import com.gbl.overlay.OverlayService.Companion.sortLimitedMetasByLifecycleStatic
import com.gbl.overlay.OverlayService.Companion.toPvPokeTitleCaseStatic

// =============================================================================
// Show6Engine.kt - Show 6 Pick 3 Battle Frontier Engine, PvPoke Limited Meta
// Sync, Google Sheets Sync, 120x120 Minimax Optimizer & Roster Upgraders
// =============================================================================

internal object Show6StaticData {
    val BATTLE_FRONTIER_USAGE_MAP: MutableMap<String, MutableMap<String, Double>> = java.util.concurrent.ConcurrentHashMap<String, MutableMap<String, Double>>().apply {
        put("GREAT LEAGUE", java.util.concurrent.ConcurrentHashMap<String, Double>().apply {
            put("Florges", 47.43); put("Sableye", 37.3); put("Melmetal", 37.14); put("Quagsire", 36.5)
            put("Corsola (Galarian)", 31.51); put("Corviknight", 30.55); put("Clodsire", 29.58); put("Dunsparce", 28.46)
            put("Altaria", 27.01); put("Stunfisk", 25.08); put("Ninetales", 23.95); put("Cramorant", 22.67)
            put("Charjabug", 18.81); put("Araquanid", 17.36); put("Vigoroth", 15.59); put("Tinkaton", 14.31)
            put("Electrode (Hisuian)", 11.9); put("Thievul", 11.74); put("Ninetales (Alolan)", 11.25); put("Hydreigon", 9.65)
            put("Empoleon", 8.84); put("Jumpluff", 8.68); put("Ursaluna", 5.47); put("Fearow", 5.31)
            put("Jellicent", 5.14); put("Forretress", 3.86); put("Azumarill", 3.7); put("Kingdra", 3.7)
            put("Lanturn", 3.7); put("Cradily", 3.54); put("Rillaboom", 3.05); put("Annihilape", 2.73)
            put("Feraligatr", 2.73); put("Marowak", 2.73); put("Hippowdon", 2.41); put("Politoed", 2.09)
            put("Guzzlord", 1.77); put("Morpeko", 1.61); put("Pangoro", 1.61); put("Greninja", 1.45)
            put("Medicham", 1.45); put("Diggersby", 1.29); put("Dondozo", 1.29); put("Furret", 1.29)
            put("Houndoom", 1.29); put("Malamar", 1.29); put("Talonflame", 1.29); put("Dusclops", 1.13)
            put("Togetic", 1.13); put("Drapion", 0.96); put("Snorlax", 0.96); put("Umbreon", 0.96)
            put("Deoxys (Defense)", 0.8); put("Sandslash (Alolan)", 0.8); put("Toxapex", 0.8); put("Blastoise", 0.64)
            put("Dusknoir", 0.64); put("Golisopod", 0.64); put("Mantine", 0.64); put("Marowak (Alolan)", 0.64)
            put("Persian", 0.64); put("Piloswine", 0.64); put("Sealeo", 0.64); put("Blaziken", 0.48)
            put("Clefable", 0.48); put("Dragonite", 0.48); put("Gastrodon", 0.48); put("Goodra", 0.48)
            put("Gourgeist", 0.48); put("Lickilicky", 0.48); put("Lickitung", 0.48); put("Spidops", 0.48)
            put("Swampert", 0.48); put("Teddiursa", 0.48); put("Weezing (Galarian)", 0.48); put("Zweilous", 0.48)
            put("Aegislash (Shield)", 0.32); put("Carbink", 0.32); put("Dewgong", 0.32); put("Froslass", 0.32)
            put("Golurk", 0.32); put("Regidrago", 0.32); put("Samurott", 0.32); put("Seaking", 0.32)
            put("Stunfisk (Galarian)", 0.32); put("Tentacruel", 0.32); put("Toedscruel", 0.32); put("Toucannon", 0.32)
            put("Turtonator", 0.32); put("Victreebel", 0.32); put("Articuno", 0.16); put("Articuno (Galarian)", 0.16)
            put("Bastiodon", 0.16); put("Bulbasaur", 0.16); put("Camerupt", 0.16); put("Cetitan", 0.16)
            put("Charmander", 0.16); put("Chesnaught", 0.16); put("Cresselia", 0.16); put("Dragonair", 0.16)
            put("Drilbur", 0.16); put("Farfetch'd (Galarian)", 0.16); put("Hakamo-o", 0.16); put("Hariyama", 0.16)
            put("Kommo-o", 0.16); put("Lapras", 0.16); put("Lopunny", 0.16); put("Mandibuzz", 0.16)
            put("Mightyena", 0.16); put("Oinkologne (Female)", 0.16); put("Oranguru", 0.16); put("Pachirisu", 0.16)
            put("Primarina", 0.16); put("Primeape", 0.16); put("Seismitoad", 0.16); put("Shelgon", 0.16)
            put("Swalot", 0.16); put("Throh", 0.16); put("Togekiss", 0.16); put("Torkoal", 0.16)
            put("Typhlosion", 0.16); put("Voltorb (Hisuian)", 0.16); put("Walrein", 0.16); put("Wigglytuff", 0.16)
        })
        put("BATTLE FRONTIER (SPECTRAL)", java.util.concurrent.ConcurrentHashMap<String, Double>().apply {
            put("Golisopod", 80.6); put("Weezing (Galarian)", 77.7); put("Cofagrigus", 49.11); put("Arctibax", 46.22)
            put("Charjabug", 44.61); put("Glalie", 40.82); put("Hypno", 35.99); put("Tentacruel", 29.79)
            put("Skeledirge", 19.81); put("Dewgong", 18.04); put("Grumpig", 16.26); put("Ninetales (Alolan)", 15.86)
            put("Starmie", 14.17); put("Runerigus", 13.04); put("Piloswine", 11.59); put("Slowbro", 11.51)
            put("Qwilfish", 9.02); put("Slowking (Galarian)", 7.89); put("Arbok", 7.81); put("Ledian", 7.0)
            put("Amoonguss", 5.31); put("Swalot", 5.31); put("Dragalge", 5.23); put("Centiskorch", 3.62)
            put("Baxcalibur", 3.14); put("Weezing", 2.74); put("Avalugg", 2.01); put("Bruxish", 1.69)
            put("Raichu (Alolan)", 1.29); put("Froslass", 1.21); put("Wormadam (Sandy)", 1.21); put("Claydol", 0.89)
            put("Medicham", 0.81); put("Golbat", 0.72); put("Nidoqueen", 0.64); put("Vanillish", 0.64)
            put("Ariados", 0.56); put("Slowbro (Galarian)", 0.56); put("Abomasnow", 0.48); put("Drifblim", 0.48)
            put("Muk", 0.4); put("Cetitan", 0.32); put("Gourgeist", 0.32); put("Delphox", 0.24)
            put("Mamoswine", 0.24); put("Nidorina", 0.24); put("Salazzle", 0.24); put("Toxicroak", 0.24)
            put("Venomoth", 0.24); put("Castform (Snowy)", 0.16); put("Grimer", 0.16); put("Heracross", 0.16)
            put("Lampent", 0.16); put("Smoochum", 0.16); put("Swoobat", 0.16); put("Trevenant", 0.16)
            put("Venusaur", 0.16); put("Victreebel", 0.16); put("Ceruledge", 0.08); put("Chimecho", 0.08)
            put("Frigibax", 0.08); put("Galvantula", 0.08); put("Houndstone", 0.08); put("Mismagius", 0.08)
            put("Wobbuffet", 0.08); put("Xatu", 0.08)
        })
        put("BATTLE FRONTIER (CAULDRON)", java.util.concurrent.ConcurrentHashMap<String, Double>().apply {
            put("Greedent", 52.58); put("Muk (Alolan)", 52.26); put("Ursaluna", 50.32); put("Weezing (Galarian)", 45.0)
            put("Jellicent", 40.32); put("Talonflame", 34.52); put("Clefable", 31.77); put("Greninja", 31.77)
            put("Giratina (Altered)", 24.52); put("Moltres (Galarian)", 21.29); put("Samurott", 21.29); put("Seaking", 20.32)
            put("Drapion", 19.19); put("Crobat", 18.06); put("Dragalge", 17.74); put("Dusknoir", 12.74)
            put("Togekiss", 9.68); put("Florges", 7.26); put("Rapidash", 6.94); put("Scizor", 5.81)
            put("Aromatisse", 5.0); put("Doublade", 5.0); put("Genesect", 5.0); put("Nidoking", 4.68)
            put("Audino (Mega)", 4.52); put("Primarina", 4.19); put("Sandslash", 4.19); put("Golisopod", 4.03)
            put("Ninetales", 4.03); put("Malamar (Mega)", 3.71); put("Ninetales (Alolan)", 2.9); put("Turtonator", 2.58)
            put("Clodsire", 2.26); put("Overqwil", 2.1); put("Malamar", 1.94); put("Runerigus", 1.94)
            put("Galvantula", 1.77); put("Pangoro", 1.77); put("Annihilape", 1.45); put("Tapu Fini", 1.45)
            put("Toxtricity", 1.45); put("Grafaiai", 1.13); put("Drifblim", 0.97); put("Typhlosion", 0.97)
            put("Golurk", 0.65); put("Charizard", 0.48); put("Hydreigon", 0.48); put("Mandibuzz", 0.48)
            put("Muk", 0.48); put("Samurott (Hisuian)", 0.48); put("Skeledirge", 0.48); put("Toxicroak", 0.48)
            put("Umbreon", 0.48); put("Beedrill (Mega)", 0.32); put("Bombirdier", 0.32); put("Victreebel", 0.32)
            put("Blaziken", 0.16); put("Camerupt", 0.16); put("Charizard (Mega X)", 0.16); put("Cofagrigus", 0.16)
            put("Diancie", 0.16); put("Gourgeist", 0.16); put("Krookodile", 0.16); put("Morpeko", 0.16)
            put("Qwilfish", 0.16); put("Scizor (Mega)", 0.16); put("Tyranitar", 0.16); put("Venusaur", 0.16)
            put("Victreebel (Mega)", 0.16)
        })
        put("BATTLE FRONTIER (MASTER)", java.util.concurrent.ConcurrentHashMap<String, Double>().apply {
            put("Zamazenta (Crowned)", 29.28); put("Ursaluna", 24.84); put("Dialga (Origin)", 24.01); put("Zacian (Crowned)", 23.85)
            put("Reshiram", 23.68); put("Metagross", 22.37); put("Groudon", 20.56); put("Lugia", 20.07)
            put("Lunala", 19.74); put("Florges", 19.41); put("Necrozma (Dawn Wings)", 19.08); put("Zygarde", 18.59)
            put("Keldeo (Resolute)", 18.26); put("Eternatus", 16.78); put("Palkia", 16.45); put("Xerneas", 15.62)
            put("Kyurem (White)", 14.47); put("Palkia (Origin)", 13.98); put("Zekrom", 13.98); put("Blastoise (Mega)", 12.83)
            put("Kyurem (Black)", 12.5); put("Kyogre", 12.17); put("Necrozma (Dusk Mane)", 11.35); put("Melmetal", 11.18)
            put("Meloetta (Aria)", 10.86); put("Yveltal", 9.87); put("Landorus (Therian)", 9.7); put("Aggron (Mega)", 9.54)
            put("Scizor (Mega)", 9.21); put("Marshadow", 8.88); put("Ho-Oh", 8.72); put("Gyarados", 7.89)
            put("Swampert (Mega)", 7.89); put("Latios (Mega)", 7.73); put("Gardevoir (Mega)", 7.07); put("Charizard (Mega X)", 6.74)
            put("Gengar (Mega)", 5.92); put("Rhyperior", 5.26); put("Giratina (Altered)", 4.93); put("Gallade (Mega)", 4.77)
            put("Garchomp", 3.95); put("Latias (Mega)", 3.95); put("Aerodactyl (Mega)", 3.29); put("Mewtwo", 2.8)
            put("Blaziken (Mega)", 2.47); put("Houndoom (Mega)", 2.14); put("Togekiss", 1.97); put("Urshifu (Single Strike)", 1.48)
            put("Primarina", 1.32); put("Tapu Lele", 1.32); put("Lucario (Mega)", 1.15); put("Staraptor (Mega)", 1.15)
            put("Kingambit", 0.99); put("Mamoswine", 0.99); put("Zacian (Hero)", 0.99); put("Gholdengo", 0.66)
            put("Hydreigon", 0.66); put("Solgaleo", 0.66); put("Tyranitar", 0.66); put("Alakazam (Mega)", 0.49)
            put("Keldeo (Ordinary)", 0.49); put("Snorlax", 0.49); put("Abomasnow (Mega)", 0.33); put("Ampharos (Mega)", 0.33)
            put("Annihilape", 0.33); put("Chandelure", 0.33); put("Dragonite", 0.33); put("Enamorus (Therian)", 0.33)
            put("Giratina (Origin)", 0.33); put("Raichu (Mega Y)", 0.33); put("Slowbro (Mega)", 0.33); put("Starmie (Mega)", 0.33)
            put("Tapu Bulu", 0.33); put("Baxcalibur", 0.16); put("Darkrai", 0.16); put("Dialga", 0.16)
            put("Gardevoir", 0.16); put("Genesect", 0.16); put("Grimmsnarl", 0.16); put("Kangaskhan (Mega)", 0.16)
            put("Kartana", 0.16); put("Kyurem", 0.16); put("Moltres (Galarian)", 0.16); put("Rillaboom", 0.16)
            put("Steelix (Mega)", 0.16); put("Zamazenta (Hero)", 0.16); put("Zarude", 0.16)
        })
    }

    val BATTLE_FRONTIER_CORES_MAP: MutableMap<String, MutableList<BattleFrontierCoreEntry>> = java.util.concurrent.ConcurrentHashMap<String, MutableList<BattleFrontierCoreEntry>>().apply {
        put("GREAT LEAGUE", java.util.concurrent.CopyOnWriteArrayList(listOf(
            BattleFrontierCoreEntry("Florges", "Melmetal", 21.32),
            BattleFrontierCoreEntry("Melmetal", "Quagsire", 19.9),
            BattleFrontierCoreEntry("Sableye", "Florges", 18.73),
            BattleFrontierCoreEntry("Florges", "Quagsire", 18.6),
            BattleFrontierCoreEntry("Melmetal", "Altaria", 16.93),
            BattleFrontierCoreEntry("Florges", "Altaria", 16.28),
            BattleFrontierCoreEntry("Florges", "Corviknight", 16.02),
            BattleFrontierCoreEntry("Melmetal", "Corsola (Galarian)", 14.99),
            BattleFrontierCoreEntry("Florges", "Corsola (Galarian)", 14.73),
            BattleFrontierCoreEntry("Quagsire", "Corsola (Galarian)", 14.08),
            BattleFrontierCoreEntry("Quagsire", "Altaria", 13.57),
            BattleFrontierCoreEntry("Clodsire", "Florges", 13.18),
            BattleFrontierCoreEntry("Florges", "Dunsparce", 13.18),
            BattleFrontierCoreEntry("Sableye", "Corviknight", 12.53),
            BattleFrontierCoreEntry("Sableye", "Clodsire", 12.4),
            BattleFrontierCoreEntry("Melmetal", "Ninetales", 12.02),
            BattleFrontierCoreEntry("Dunsparce", "Quagsire", 11.37),
            BattleFrontierCoreEntry("Corviknight", "Quagsire", 11.24),
            BattleFrontierCoreEntry("Corviknight", "Dunsparce", 10.59),
            BattleFrontierCoreEntry("Sableye", "Melmetal", 10.59),
            BattleFrontierCoreEntry("Florges", "Ninetales", 10.47),
            BattleFrontierCoreEntry("Sableye", "Stunfisk", 10.47),
            BattleFrontierCoreEntry("Dunsparce", "Altaria", 10.34),
            BattleFrontierCoreEntry("Sableye", "Cramorant", 10.34),
            BattleFrontierCoreEntry("Sableye", "Dunsparce", 10.34)
        )))
        put("BATTLE FRONTIER (SPECTRAL)", java.util.concurrent.CopyOnWriteArrayList(listOf(
            BattleFrontierCoreEntry("Weezing (Galarian)", "Golisopod", 63.45),
            BattleFrontierCoreEntry("Weezing (Galarian)", "Cofagrigus", 41.2),
            BattleFrontierCoreEntry("Cofagrigus", "Golisopod", 37.9),
            BattleFrontierCoreEntry("Weezing (Galarian)", "Arctibax", 35.96),
            BattleFrontierCoreEntry("Weezing (Galarian)", "Charjabug", 35.9),
            BattleFrontierCoreEntry("Golisopod", "Glalie", 35.45),
            BattleFrontierCoreEntry("Golisopod", "Arctibax", 35.38),
            BattleFrontierCoreEntry("Golisopod", "Charjabug", 32.47),
            BattleFrontierCoreEntry("Weezing (Galarian)", "Glalie", 30.6),
            BattleFrontierCoreEntry("Golisopod", "Hypno", 29.5),
            BattleFrontierCoreEntry("Weezing (Galarian)", "Hypno", 29.5),
            BattleFrontierCoreEntry("Golisopod", "Tentacruel", 25.23),
            BattleFrontierCoreEntry("Weezing (Galarian)", "Tentacruel", 22.64),
            BattleFrontierCoreEntry("Cofagrigus", "Arctibax", 21.73),
            BattleFrontierCoreEntry("Cofagrigus", "Glalie", 21.15),
            BattleFrontierCoreEntry("Cofagrigus", "Charjabug", 19.15),
            BattleFrontierCoreEntry("Cofagrigus", "Hypno", 16.56),
            BattleFrontierCoreEntry("Charjabug", "Glalie", 16.24),
            BattleFrontierCoreEntry("Arctibax", "Charjabug", 15.98),
            BattleFrontierCoreEntry("Arctibax", "Glalie", 15.72),
            BattleFrontierCoreEntry("Golisopod", "Skeledirge", 15.52),
            BattleFrontierCoreEntry("Arctibax", "Hypno", 15.33),
            BattleFrontierCoreEntry("Cofagrigus", "Tentacruel", 14.81),
            BattleFrontierCoreEntry("Hypno", "Glalie", 14.17),
            BattleFrontierCoreEntry("Golisopod", "Grumpig", 13.97)
        )))
        put("BATTLE FRONTIER (CAULDRON)", java.util.concurrent.CopyOnWriteArrayList(listOf(
            BattleFrontierCoreEntry("Muk (Alolan)", "Greedent", 27.2),
            BattleFrontierCoreEntry("Muk (Alolan)", "Ursaluna", 25.91),
            BattleFrontierCoreEntry("Weezing (Galarian)", "Greedent", 23.45),
            BattleFrontierCoreEntry("Jellicent", "Muk (Alolan)", 22.02),
            BattleFrontierCoreEntry("Greedent", "Ursaluna", 20.47),
            BattleFrontierCoreEntry("Weezing (Galarian)", "Muk (Alolan)", 20.47),
            BattleFrontierCoreEntry("Weezing (Galarian)", "Ursaluna", 20.08),
            BattleFrontierCoreEntry("Greedent", "Talonflame", 19.82),
            BattleFrontierCoreEntry("Weezing (Galarian)", "Jellicent", 19.43),
            BattleFrontierCoreEntry("Jellicent", "Greedent", 18.91),
            BattleFrontierCoreEntry("Muk (Alolan)", "Talonflame", 18.78),
            BattleFrontierCoreEntry("Greedent", "Greninja", 18.13),
            BattleFrontierCoreEntry("Jellicent", "Ursaluna", 18.01),
            BattleFrontierCoreEntry("Greedent", "Clefable", 17.36),
            BattleFrontierCoreEntry("Weezing (Galarian)", "Greninja", 15.8),
            BattleFrontierCoreEntry("Muk (Alolan)", "Greninja", 15.28),
            BattleFrontierCoreEntry("Muk (Alolan)", "Clefable", 15.16),
            BattleFrontierCoreEntry("Talonflame", "Ursaluna", 15.04),
            BattleFrontierCoreEntry("Weezing (Galarian)", "Talonflame", 14.9),
            BattleFrontierCoreEntry("Muk (Alolan)", "Giratina (Altered)", 14.77),
            BattleFrontierCoreEntry("Clefable", "Ursaluna", 14.64),
            BattleFrontierCoreEntry("Jellicent", "Talonflame", 12.69),
            BattleFrontierCoreEntry("Muk (Alolan)", "Samurott", 12.69),
            BattleFrontierCoreEntry("Clefable", "Greninja", 12.56),
            BattleFrontierCoreEntry("Ursaluna", "Greninja", 12.56)
        )))
        put("BATTLE FRONTIER (MASTER)", java.util.concurrent.CopyOnWriteArrayList(listOf(
            BattleFrontierCoreEntry("Keldeo (Resolute)", "Dialga (Origin)", 10.95),
            BattleFrontierCoreEntry("Florges", "Dialga (Origin)", 9.89),
            BattleFrontierCoreEntry("Dialga (Origin)", "Landorus (Therian)", 8.84),
            BattleFrontierCoreEntry("Lugia", "Ursaluna", 8.31),
            BattleFrontierCoreEntry("Palkia (Origin)", "Xerneas", 7.52),
            BattleFrontierCoreEntry("Necrozma (Dawn Wings)", "Zamazenta (Crowned)", 7.26),
            BattleFrontierCoreEntry("Dialga (Origin)", "Zekrom", 6.99),
            BattleFrontierCoreEntry("Keldeo (Resolute)", "Landorus (Therian)", 6.86),
            BattleFrontierCoreEntry("Metagross", "Zamazenta (Crowned)", 6.86),
            BattleFrontierCoreEntry("Keldeo (Resolute)", "Zekrom", 6.33),
            BattleFrontierCoreEntry("Landorus (Therian)", "Melmetal", 6.33),
            BattleFrontierCoreEntry("Landorus (Therian)", "Florges", 6.2),
            BattleFrontierCoreEntry("Zygarde", "Zamazenta (Crowned)", 6.2),
            BattleFrontierCoreEntry("Lunala", "Reshiram", 6.07),
            BattleFrontierCoreEntry("Zamazenta (Crowned)", "Palkia", 6.07),
            BattleFrontierCoreEntry("Ursaluna", "Kyurem (White)", 5.94),
            BattleFrontierCoreEntry("Ursaluna", "Reshiram", 5.94),
            BattleFrontierCoreEntry("Dialga (Origin)", "Blastoise (Mega)", 5.8),
            BattleFrontierCoreEntry("Keldeo (Resolute)", "Florges", 5.8),
            BattleFrontierCoreEntry("Keldeo (Resolute)", "Meloetta (Aria)", 5.67),
            BattleFrontierCoreEntry("Dialga (Origin)", "Melmetal", 5.54),
            BattleFrontierCoreEntry("Lunala", "Zacian (Crowned)", 5.54),
            BattleFrontierCoreEntry("Reshiram", "Zacian (Crowned)", 5.54),
            BattleFrontierCoreEntry("Dialga (Origin)", "Groudon", 5.41),
            BattleFrontierCoreEntry("Melmetal", "Florges", 5.41)
        )))
    }
}

internal fun OverlayService.Companion.isShow6EligibleLeagueStatic(league: String, prefs: SharedPreferences? = null): Boolean {
    if (prefs != null && getEnabledShow6LeaguesStatic(prefs).any { it.equals(league, ignoreCase = true) }) {
        return true
    }
    val norm = normalizeLeagueKeyStatic(league)
    return isBattleFrontierLeagueStatic(norm) || getForcedShow6LeaguesStatic(prefs).any { it.equals(league, ignoreCase = true) }
}

internal fun OverlayService.Companion.syncPinnedLimitedMetaRankingsBlocking(
    prefs: SharedPreferences,
    filesDir: java.io.File,
    forceRefresh: Boolean = false
): Int {
    val catalog = getLimitedMetaCatalogStatic(prefs)
    val allActiveKeys = (
        getForcedShow6LeaguesStatic(prefs) +
            getPinnedGblLimitedMetasStatic(prefs) +
            getPinnedShow6LimitedMetasStatic(prefs)
        ).distinct()
    var loadedCount = 0
    for (key in allActiveKeys) {
        val fmt = catalog.find { it.leagueKey.equals(key, ignoreCase = true) || it.title.equals(key, ignoreCase = true) } ?: continue
        val normKey = fmt.leagueKey.uppercase()
        val cacheFile = java.io.File(filesDir, "pvpoke_rankings_meta_${fmt.cup}_${fmt.cp}.json")
        if (!forceRefresh) {
            if (!LIVE_RANKINGS_MAP[normKey].isNullOrEmpty()) {
                loadedCount++
                continue
            }
            if (cacheFile.exists() && cacheFile.length() > 200) {
                val count = parseRankingsJsonStatic(normKey, cacheFile.readText())
                if (count > 0) {
                    loadedCount++
                    continue
                }
            }
        }
        try {
            val conn = (java.net.URL(fmt.rankingsUrl).openConnection() as java.net.HttpURLConnection).apply {
                connectTimeout = 7000
                readTimeout = 7000
                setRequestProperty("User-Agent", "SilphScopePvP/6.04")
            }
            if (conn.responseCode in 200..299) {
                val body = conn.inputStream.bufferedReader().use { it.readText() }
                if (body.length > 200) {
                    cacheFile.writeText(body)
                    val count = parseRankingsJsonStatic(normKey, body)
                    if (count > 0) loadedCount++
                }
            } else if (cacheFile.exists() && cacheFile.length() > 200) {
                val count = parseRankingsJsonStatic(normKey, cacheFile.readText())
                if (count > 0) loadedCount++
            }
        } catch (_: Exception) {
            if (cacheFile.exists() && cacheFile.length() > 200) {
                val count = parseRankingsJsonStatic(normKey, cacheFile.readText())
                if (count > 0) loadedCount++
            }
        }
    }
    return loadedCount
}

internal fun OverlayService.Companion.detectMegaOrPrimalInRankingsJsonStatic(jsonBody: String): Boolean {
    return try {
        val arr = JsonParser.parseString(jsonBody).asJsonArray
        for (el in arr) {
            if (!el.isJsonObject) continue
            val obj = el.asJsonObject
            val spId = obj.optString("speciesId").orEmpty()
            val spName = obj.optString("speciesName").orEmpty()
            if (isMegaOrPrimalSpeciesStatic(spId) || isMegaOrPrimalSpeciesStatic(spName)) {
                return true
            }
        }
        false
    } catch (_: Exception) {
        val lower = jsonBody.lowercase()
        lower.contains("_mega\"") || lower.contains("_primal\"") || lower.contains("(mega") || lower.contains("(primal")
    }
}

internal fun OverlayService.Companion.fetchPvPokeLimitedMetasBlocking(prefs: SharedPreferences, filesDir: java.io.File): String {
    val nowMs = System.currentTimeMillis()
    val sevenDaysMs = 7L * 24L * 60L * 60L * 1000L
    val skipBaseCups = setOf("all", "overall", "premierclassic", "classic", "custom")
    val skipTitles = setOf("GREAT LEAGUE", "ULTRA LEAGUE", "MASTER LEAGUE")
    val pinnedKeysLower = (getPinnedGblLimitedMetasStatic(prefs) + getPinnedShow6LimitedMetasStatic(prefs))
        .map { it.lowercase() }
        .toSet()

    // Load previously persisted catalog so we preserve lastSeenAt when a format leaves gamemaster.json["formats"]
    val previousByKey = LinkedHashMap<String, LimitedMetaFormat>()
    for (item in DEFAULT_LIMITED_META_CATALOG) {
        previousByKey[item.leagueKey.uppercase()] = item
    }
    val rawSaved = prefs.getString(PREFS_KEY_LIMITED_META_CATALOG_JSON, null)
    if (!rawSaved.isNullOrBlank()) {
        try {
            val type = object : TypeToken<List<LimitedMetaFormat>>() {}.type
            val parsed: List<LimitedMetaFormat>? = Gson().fromJson(rawSaved, type)
            parsed?.forEach { item ->
                if (item.leagueKey.isNotBlank()) {
                    val normKey = formatCatalogLeagueKeyStatic(item.title.ifBlank { item.leagueKey }, item.cp, item.cup)
                    previousByKey[normKey.uppercase()] = item.copy(leagueKey = normKey)
                }
            }
        } catch (_: Exception) {}
    }

    // Start with previous entries demoted from CURRENT to RECENT (preserving their lastSeenAt) until re-confirmed live
    val byKey = LinkedHashMap<String, LimitedMetaFormat>()
    for ((k, prev) in previousByKey) {
        val demotedStatus = if (prev.lifecycleStatus == "CURRENT" && prev.category != "standard_open") "RECENT" else prev.lifecycleStatus
        byKey[k] = prev.copy(lifecycleStatus = demotedStatus)
    }

    val liveFormatCups = HashSet<String>()

    fun verifyRankingsAndDetectMega(rankingsUrl: String, fallbackAllowMega: Boolean): Pair<Boolean, Boolean> {
        return try {
            val conn = (java.net.URL(rankingsUrl).openConnection() as java.net.HttpURLConnection).apply {
                connectTimeout = 6500
                readTimeout = 6500
                setRequestProperty("User-Agent", "SilphScopePvP/5.10")
            }
            if (conn.responseCode in 200..299) {
                val body = conn.inputStream.bufferedReader().use { it.readText() }
                if (body.length > 200) {
                    true to detectMegaOrPrimalInRankingsJsonStatic(body)
                } else false to fallbackAllowMega
            } else false to fallbackAllowMega
        } catch (_: Exception) {
            false to fallbackAllowMega
        }
    }

    fun fetchCupLastCommitMs(cupSlug: String): Long? {
        return try {
            val apiUrl = "https://api.github.com/repos/pvpoke/pvpoke/commits?path=src/data/rankings/$cupSlug&per_page=1"
            val conn = (java.net.URL(apiUrl).openConnection() as java.net.HttpURLConnection).apply {
                connectTimeout = 5000
                readTimeout = 5000
                setRequestProperty("User-Agent", "SilphScopePvP/5.10")
            }
            if (conn.responseCode in 200..299) {
                val arr = JsonParser.parseString(conn.inputStream.bufferedReader().use { it.readText() }).asJsonArray
                if (arr.size() > 0) {
                    val isoDate = arr[0].asJsonObject
                        .getAsJsonObject("commit")
                        ?.getAsJsonObject("committer")
                        ?.optString("date")
                    if (!isoDate.isNullOrBlank()) {
                        java.time.Instant.parse(isoDate).toEpochMilli()
                    } else null
                } else null
            } else null
        } catch (_: Exception) {
            null
        }
    }

    try {
        // 1. Primary Source: Compiled PvPoke gamemaster.json (matches live pvpoke.com dropdown)
        val gmUrl = "https://raw.githubusercontent.com/pvpoke/pvpoke/master/src/data/gamemaster.json"
        val conn = (java.net.URL(gmUrl).openConnection() as java.net.HttpURLConnection).apply {
            connectTimeout = 9000
            readTimeout = 9000
            setRequestProperty("User-Agent", "SilphScopePvP/5.10")
        }
        if (conn.responseCode in 200..299) {
            val text = conn.inputStream.bufferedReader().use { it.readText() }
            val root = JsonParser.parseString(text).asJsonObject

            // 1A: Parse root["formats"]
            val formatsArr = root.getAsJsonArray("formats")
            if (formatsArr != null) {
                for (el in formatsArr) {
                    if (!el.isJsonObject) continue
                    val obj = el.asJsonObject
                    val hideRankings = obj.get("hideRankings")?.takeIf { it.isJsonPrimitive }?.asBoolean ?: false
                    if (hideRankings) continue
                    val showFormat = obj.get("showFormat")?.takeIf { it.isJsonPrimitive }?.asBoolean ?: true
                    val cup = obj.optString("cup")?.trim()?.lowercase().orEmpty()
                    val rawTitle = obj.optString("title")?.trim().orEmpty()
                    val cp = obj.optInt("cp") ?: 1500
                    val meta = obj.optString("meta")?.trim()?.lowercase().orEmpty()
                    if (cup.isEmpty() || rawTitle.isEmpty() || cup in skipBaseCups) continue
                    if (rawTitle.uppercase() in skipTitles) continue

                    liveFormatCups.add("${cup}_${cp}")
                    val isBf = isBattleFrontierFormatTitleStatic(rawTitle, cup) ||
                        meta.contains("frontier") ||
                        cup == "laic2027" ||
                        cup == "trail" ||
                        cup == "fable" ||
                        cup == "gymbreakers"
                    val leagueKey = formatCatalogLeagueKeyStatic(rawTitle, cp, cup)
                    val displayTitle = if (isBattleFrontierFormatTitleStatic(rawTitle, cup)) {
                        leagueKey.uppercase()
                    } else {
                        toPvPokeTitleCaseStatic(rawTitle)
                    }
                    if (leagueKey.uppercase() in skipTitles) continue
                    val rankingsUrl = "https://raw.githubusercontent.com/pvpoke/pvpoke/master/src/data/rankings/$cup/overall/rankings-$cp.json"
                    val prev = previousByKey[leagueKey.uppercase()]
                    val (ok, hasMegas) = verifyRankingsAndDetectMega(rankingsUrl, prev?.allowsMega ?: false)
                    if (!ok && prev == null) continue
                    val cat = when {
                        isBf -> "battle_frontier"
                        cup == "premier" || cup == "mega" -> "premier_mega"
                        else -> "gbl"
                    }
                    val status = if (!showFormat) "UPCOMING" else "CURRENT"
                    byKey[leagueKey.uppercase()] = LimitedMetaFormat(
                        id = "${cup}_${cp}",
                        title = displayTitle,
                        cup = cup,
                        cp = cp,
                        leagueKey = leagueKey,
                        category = cat,
                        lifecycleStatus = status,
                        rankingsUrl = rankingsUrl,
                        sheetTabAlias = prev?.sheetTabAlias ?: meta.ifEmpty { cup },
                        lastSeenAt = nowMs,
                        allowsMega = hasMegas
                    )
                }
            }

            // 1B: Parse root["cups"] for additional UPCOMING (newly staged <= 7d) or RECENT (<= 28d) cups not in live formats
            val cupsArr = root.getAsJsonArray("cups")
            if (cupsArr != null) {
                for (el in cupsArr) {
                    if (!el.isJsonObject) continue
                    val cupObj = el.asJsonObject
                    val cup = cupObj.optString("name")?.trim()?.lowercase().orEmpty()
                    val rawTitle = cupObj.optString("title")?.trim().orEmpty()
                    val cp = cupObj.optInt("league") ?: 1500
                    if (cup.isEmpty() || rawTitle.isEmpty() || cup in skipBaseCups) continue
                    if (rawTitle.uppercase() in skipTitles || rawTitle.equals("All Pokemon", ignoreCase = true)) continue
                    val cupCpId = "${cup}_${cp}"
                    if (cupCpId in liveFormatCups) continue

                    val leagueKey = formatCatalogLeagueKeyStatic(rawTitle, cp, cup)
                    val displayTitle = if (isBattleFrontierFormatTitleStatic(rawTitle, cup)) {
                        leagueKey.uppercase()
                    } else {
                        toPvPokeTitleCaseStatic(rawTitle)
                    }
                    if (leagueKey.uppercase() in skipTitles) continue

                    val rankingsUrl = "https://raw.githubusercontent.com/pvpoke/pvpoke/master/src/data/rankings/$cup/overall/rankings-$cp.json"
                    val prev = previousByKey[leagueKey.uppercase()]
                    val commitMs = fetchCupLastCommitMs(cup) ?: prev?.lastSeenAt ?: (nowMs - 21L * 86400_000L)
                    val ageMs = nowMs - commitMs
                    val isPinned = leagueKey.lowercase() in pinnedKeysLower
                    val isBfForced = isCurrentBattleFrontierCupStatic(rawTitle, cup)
                    // Skip unpinned cups older than 4 weeks
                    if (ageMs > FOUR_WEEKS_MS && !isPinned && !isBfForced) continue

                    val (ok, hasMegas) = verifyRankingsAndDetectMega(rankingsUrl, prev?.allowsMega ?: false)
                    if (!ok) continue

                    val status = if (ageMs <= sevenDaysMs && prev == null) "UPCOMING" else "RECENT"
                    byKey[leagueKey.uppercase()] = LimitedMetaFormat(
                        id = cupCpId,
                        title = displayTitle,
                        cup = cup,
                        cp = cp,
                        leagueKey = leagueKey,
                        category = if (isBattleFrontierFormatTitleStatic(rawTitle, cup)) "battle_frontier" else (prev?.category ?: "gbl"),
                        lifecycleStatus = status,
                        rankingsUrl = rankingsUrl,
                        sheetTabAlias = prev?.sheetTabAlias ?: cup,
                        lastSeenAt = commitMs,
                        allowsMega = hasMegas
                    )
                }
            }
        }
    } catch (_: Exception) {}

    // 2. Check non-master branches on pvpoke/pvpoke updated within the last 14 days for staged UPCOMING metas
    try {
        val branchesUrl = "https://api.github.com/repos/pvpoke/pvpoke/branches?per_page=10"
        val bConn = (java.net.URL(branchesUrl).openConnection() as java.net.HttpURLConnection).apply {
            connectTimeout = 5000
            readTimeout = 5000
            setRequestProperty("User-Agent", "SilphScopePvP/6.05")
        }
        if (bConn.responseCode in 200..299) {
            val bArr = JsonParser.parseString(bConn.inputStream.bufferedReader().use { it.readText() }).asJsonArray
            for (bEl in bArr) {
                val bObj = bEl.asJsonObject
                val bName = bObj.optString("name").orEmpty()
                if (bName.isEmpty() || bName == "master" || bName == "main") continue
                val branchFormatsUrl = "https://raw.githubusercontent.com/pvpoke/pvpoke/$bName/src/data/gamemaster/formats.json"
                val fConn = (java.net.URL(branchFormatsUrl).openConnection() as java.net.HttpURLConnection).apply {
                    connectTimeout = 4500
                    readTimeout = 4500
                    setRequestProperty("User-Agent", "SilphScopePvP/6.05")
                }
                if (fConn.responseCode in 200..299) {
                    val fArr = JsonParser.parseString(fConn.inputStream.bufferedReader().use { it.readText() }).asJsonArray
                    for (fEl in fArr) {
                        if (!fEl.isJsonObject) continue
                        val fObj = fEl.asJsonObject
                        val cup = fObj.optString("cup")?.trim()?.lowercase().orEmpty()
                        val rawTitle = fObj.optString("title")?.trim().orEmpty()
                        val cp = fObj.optInt("cp") ?: 1500
                        if (cup.isEmpty() || rawTitle.isEmpty() || cup in skipBaseCups) continue
                        val leagueKey = formatCatalogLeagueKeyStatic(rawTitle, cp, cup)
                        val displayTitle = if (isBattleFrontierFormatTitleStatic(rawTitle, cup)) {
                            leagueKey.uppercase()
                        } else {
                            toPvPokeTitleCaseStatic(rawTitle)
                        }
                        if (byKey.containsKey(leagueKey.uppercase())) continue
                        val rUrl = "https://raw.githubusercontent.com/pvpoke/pvpoke/$bName/src/data/rankings/$cup/overall/rankings-$cp.json"
                        val (ok, hasMegas) = verifyRankingsAndDetectMega(rUrl, false)
                        if (ok) {
                            byKey[leagueKey.uppercase()] = LimitedMetaFormat(
                                id = "${cup}_${cp}",
                                title = displayTitle,
                                cup = cup,
                                cp = cp,
                                leagueKey = leagueKey,
                                category = if (isBattleFrontierFormatTitleStatic(rawTitle, cup)) "battle_frontier" else "gbl",
                                lifecycleStatus = "UPCOMING",
                                rankingsUrl = rUrl,
                                sheetTabAlias = cup,
                                lastSeenAt = nowMs,
                                allowsMega = hasMegas
                            )
                        }
                    }
                }
            }
        }
    } catch (_: Exception) {}

    // 3. Enforce 4-week (28-day) expiration: keep expired RECENT metas ONLY if still checked/pinned or CURRENT Battle Frontier forced
    val filtered = byKey.values.filter { item ->
        val isPinned = item.leagueKey.lowercase() in pinnedKeysLower
        val isBfForced = item.lifecycleStatus.equals("CURRENT", ignoreCase = true) &&
            isCurrentBattleFrontierCupStatic(item.title.ifBlank { item.leagueKey }, item.cup)
        !isExpiredLimitedMetaStatic(item, nowMs) || isPinned || isBfForced
    }

    val sorted = sortLimitedMetasByLifecycleStatic(filtered)
    LAST_LOADED_META_CATALOG = sorted
    prefs.edit().putString(PREFS_KEY_LIMITED_META_CATALOG_JSON, Gson().toJson(sorted)).apply()
    val synced = syncPinnedLimitedMetaRankingsBlocking(prefs, filesDir)
    val curCount = sorted.count { it.lifecycleStatus == "CURRENT" }
    val upCount = sorted.count { it.lifecycleStatus == "UPCOMING" }
    val recCount = sorted.count { it.lifecycleStatus == "RECENT" }
    return "✅ PvPoke GitHub Synced: ${sorted.size} Verified Metas (🟢 $curCount Current • 🔜 $upCount Upcoming • 🕒 $recCount Recent ≤4w • $synced Pinned Loaded)"
}

internal fun OverlayService.Companion.isMegaOrPrimalSpeciesStatic(name: String): Boolean {
    val lower = name.trim().lowercase()
    return lower.contains("(mega") ||
        lower.startsWith("mega ") ||
        lower.contains(" mega") ||
        lower.contains("_mega") ||
        lower.contains("(primal") ||
        lower.startsWith("primal ") ||
        lower.contains(" primal") ||
        lower.contains("_primal")
}

internal fun OverlayService.Companion.countMegaOrPrimalInListStatic(names: List<String>): Int {
    return names.count { isMegaOrPrimalSpeciesStatic(it) }
}

internal fun OverlayService.Companion.hasMultipleMegasStatic(names: List<String>): Boolean {
    return countMegaOrPrimalInListStatic(names) > 1
}

internal fun OverlayService.Companion.getBattleFrontierLeagueCountsSummaryStatic(prefix: String = "Battle Frontier Data"): String {
    val glM = BATTLE_FRONTIER_USAGE_MAP["GREAT LEAGUE"]?.size ?: 0
    val glC = BATTLE_FRONTIER_CORES_MAP["GREAT LEAGUE"]?.size ?: 0
    val spM = BATTLE_FRONTIER_USAGE_MAP["BATTLE FRONTIER (SPECTRAL)"]?.size ?: 0
    val spC = BATTLE_FRONTIER_CORES_MAP["BATTLE FRONTIER (SPECTRAL)"]?.size ?: 0
    val caM = BATTLE_FRONTIER_USAGE_MAP["BATTLE FRONTIER (CAULDRON)"]?.size ?: 0
    val caC = BATTLE_FRONTIER_CORES_MAP["BATTLE FRONTIER (CAULDRON)"]?.size ?: 0
    val mlM = BATTLE_FRONTIER_USAGE_MAP["BATTLE FRONTIER (MASTER)"]?.size ?: 0
    val mlC = BATTLE_FRONTIER_CORES_MAP["BATTLE FRONTIER (MASTER)"]?.size ?: 0
    val totalM = glM + spM + caM + mlM
    val totalC = glC + spC + caC + mlC
    return "$prefix — GL: ${glM} Mons / ${glC} Cores • Spectral: ${spM} Mons / ${spC} Cores • Cauldron: ${caM} Mons / ${caC} Cores • Master: ${mlM} Mons / ${mlC} Cores (Total: ${totalM} Mons • ${totalC} Cores)"
}

internal fun OverlayService.Companion.splitCsvRowStatic(line: String): List<String> {
    val result = ArrayList<String>()
    val current = StringBuilder()
    var inQuotes = false
    for (ch in line) {
        if (ch == '"') {
            inQuotes = !inQuotes
        } else if (ch == ',' && !inQuotes) {
            result.add(current.toString().trim())
            current.setLength(0)
        } else {
            current.append(ch)
        }
    }
    result.add(current.toString().trim())
    return result
}

internal fun OverlayService.Companion.mapBfHeaderCellToLeagueKeyStatic(cell: String): String? {
    val lower = cell.trim().lowercase()
    if (lower.isEmpty()) return null
    if (lower.contains("great league")) return "GREAT LEAGUE"
    if (lower.contains("spectral")) return "BATTLE FRONTIER (SPECTRAL)"
    if (lower.contains("cauldron")) return "BATTLE FRONTIER (CAULDRON)"
    if (lower.contains("master league") || lower == "battle frontier (master)") return "BATTLE FRONTIER (MASTER)"
    return null
}

internal fun OverlayService.Companion.normalizeBfSpeciesAliasStatic(rawName: String): String {
    val clean = rawName.trim().replace(Regex("^Shadow\\s+", RegexOption.IGNORE_CASE), "").trim()
    return when (clean.lowercase()) {
        "zamazenta (crowned shield)" -> "Zamazenta (Crowned)"
        "zacian (crowned sword)" -> "Zacian (Crowned)"
        "zygarde (complete forme)", "zygarde (complete)" -> "Zygarde"
        else -> clean
    }
}

internal fun OverlayService.Companion.loadCachedBattleFrontierUsageAndCores(prefs: android.content.SharedPreferences) {
    try {
        val usageJson = prefs.getString(PREFS_KEY_BF_USAGE_JSON, null)
        if (!usageJson.isNullOrBlank()) {
            val parsed: Map<String, Map<String, Double>>? = Gson().fromJson(
                usageJson,
                object : TypeToken<Map<String, Map<String, Double>>>() {}.type
            )
            parsed?.forEach { (league, map) ->
                if (map.isNotEmpty()) {
                    BATTLE_FRONTIER_USAGE_MAP[league] = java.util.concurrent.ConcurrentHashMap(map)
                }
            }
        }
        val coresJson = prefs.getString(PREFS_KEY_BF_CORES_JSON, null)
        if (!coresJson.isNullOrBlank()) {
            val parsedCores: Map<String, List<BattleFrontierCoreEntry>>? = Gson().fromJson(
                coresJson,
                object : TypeToken<Map<String, List<BattleFrontierCoreEntry>>>() {}.type
            )
            parsedCores?.forEach { (league, list) ->
                if (list.isNotEmpty()) {
                    BATTLE_FRONTIER_CORES_MAP[league] = java.util.concurrent.CopyOnWriteArrayList(list)
                }
            }
        }
    } catch (_: Exception) {}
}

internal fun OverlayService.Companion.toGoogleSheetCsvExportUrlStatic(rawUrl: String, fallbackGid: String): String {
    val trimmed = rawUrl.trim()
    if (trimmed.contains("/export?format=csv")) return trimmed
    val idMatch = Regex("/spreadsheets/d/([a-zA-Z0-9-_]+)").find(trimmed) ?: return trimmed
    val gidMatch = Regex("[?#&]gid=([0-9]+)").find(trimmed)
    val gid = gidMatch?.groupValues?.getOrNull(1) ?: fallbackGid
    return "https://docs.google.com/spreadsheets/d/${idMatch.groupValues[1]}/export?format=csv&gid=$gid"
}

internal fun OverlayService.Companion.syncBattleFrontierSheetsBlocking(
    prefs: android.content.SharedPreferences,
    usageUrlInput: String,
    coresUrlInput: String
): String {
    val cleanUsageUrl = usageUrlInput.trim().ifEmpty { DEFAULT_BF_USAGE_SHEET_URL }
    val cleanCoresUrl = coresUrlInput.trim().ifEmpty { DEFAULT_BF_CORES_SHEET_URL }
    prefs.edit()
        .putString(PREFS_KEY_BF_USAGE_SHEET_URL, cleanUsageUrl)
        .putString(PREFS_KEY_BF_CORES_SHEET_URL, cleanCoresUrl)
        .apply()

    val targetLeagues = listOf(
        "GREAT LEAGUE",
        "BATTLE FRONTIER (SPECTRAL)",
        "BATTLE FRONTIER (CAULDRON)",
        "BATTLE FRONTIER (MASTER)"
    )

    // 1. Fetch & Parse Usage CSV (8-column horizontal blocks per league, skipping LAIC 2027)
    try {
        val csvUrl = toGoogleSheetCsvExportUrlStatic(cleanUsageUrl, "466174368")
        val conn = (java.net.URL(csvUrl).openConnection() as java.net.HttpURLConnection).apply {
            connectTimeout = 8000
            readTimeout = 8000
            setRequestProperty("User-Agent", "SilphScopePvP/5.04")
        }
        if (conn.responseCode in 200..299) {
            val text = conn.inputStream.bufferedReader().use { it.readText() }
            val rows = text.lines().map { splitCsvRowStatic(it) }
            val colBlocks = ArrayList<Pair<String, Int>>()
            var dataStartRow = 5
            for (r in 0 until minOf(8, rows.size)) {
                val row = rows[r]
                val detected = ArrayList<Pair<String, Int>>()
                for (c in row.indices) {
                    val lg = mapBfHeaderCellToLeagueKeyStatic(row[c])
                    if (lg != null) {
                        detected.add(lg to c)
                    }
                }
                if (detected.size >= 2) {
                    colBlocks.addAll(detected)
                    dataStartRow = r + 2
                    break
                }
            }
            if (colBlocks.isEmpty()) {
                colBlocks.add("GREAT LEAGUE" to 0)
                colBlocks.add("BATTLE FRONTIER (CAULDRON)" to 8)
                colBlocks.add("BATTLE FRONTIER (MASTER)" to 16)
                colBlocks.add("BATTLE FRONTIER (SPECTRAL)" to 32)
            }
            val parsedUsage = targetLeagues.associateWith { LinkedHashMap<String, Double>() }
            for (r in dataStartRow until rows.size) {
                val row = rows[r]
                for ((lgKey, baseCol) in colBlocks) {
                    val rawName = row.getOrNull(baseCol)?.trim()?.trim('"') ?: ""
                    val pctStr = row.getOrNull(baseCol + 1)?.trim()?.trim('"')?.replace("%", "") ?: ""
                    val pct = pctStr.toDoubleOrNull()
                    if (rawName.isNotEmpty() && !rawName.equals("Pokemon", ignoreCase = true) && pct != null && pct > 0.0) {
                        val normSpecies = normalizeBfSpeciesAliasStatic(rawName)
                        parsedUsage[lgKey]?.put(normSpecies, pct)
                    }
                }
            }
            parsedUsage.forEach { (lgKey, map) ->
                if (map.isNotEmpty()) {
                    BATTLE_FRONTIER_USAGE_MAP[lgKey] = java.util.concurrent.ConcurrentHashMap(map)
                }
            }
        }
    } catch (_: Exception) {}

    // 2. Fetch & Parse Cores CSV (4-column horizontal blocks per league, skipping LAIC 2027)
    try {
        val csvUrl = toGoogleSheetCsvExportUrlStatic(cleanCoresUrl, "94099054")
        val conn = (java.net.URL(csvUrl).openConnection() as java.net.HttpURLConnection).apply {
            connectTimeout = 8000
            readTimeout = 8000
            setRequestProperty("User-Agent", "SilphScopePvP/5.04")
        }
        if (conn.responseCode in 200..299) {
            val text = conn.inputStream.bufferedReader().use { it.readText() }
            val rows = text.lines().map { splitCsvRowStatic(it) }
            val colBlocks = ArrayList<Pair<String, Int>>()
            var dataStartRow = 5
            for (r in 0 until minOf(8, rows.size)) {
                val row = rows[r]
                val detected = ArrayList<Pair<String, Int>>()
                for (c in row.indices) {
                    val lg = mapBfHeaderCellToLeagueKeyStatic(row[c])
                    if (lg != null) {
                        detected.add(lg to c)
                    }
                }
                if (detected.size >= 2) {
                    colBlocks.addAll(detected)
                    dataStartRow = r + 2
                    break
                }
            }
            if (colBlocks.isEmpty()) {
                colBlocks.add("GREAT LEAGUE" to 0)
                colBlocks.add("BATTLE FRONTIER (CAULDRON)" to 4)
                colBlocks.add("BATTLE FRONTIER (MASTER)" to 8)
                colBlocks.add("BATTLE FRONTIER (SPECTRAL)" to 16)
            }
            val parsedLists = targetLeagues.associateWith { ArrayList<BattleFrontierCoreEntry>() }
            for (r in dataStartRow until rows.size) {
                val row = rows[r]
                for ((lgKey, baseCol) in colBlocks) {
                    val rawA = row.getOrNull(baseCol)?.trim()?.trim('"') ?: ""
                    val rawB = row.getOrNull(baseCol + 1)?.trim()?.trim('"') ?: ""
                    val pctStr = row.getOrNull(baseCol + 2)?.trim()?.trim('"')?.replace("%", "") ?: ""
                    if (rawA.isNotEmpty() && rawB.isNotEmpty() && !rawA.equals("Pokemon", ignoreCase = true)) {
                        val pct = pctStr.toDoubleOrNull()
                        if (pct != null && pct > 0.0) {
                            val monA = normalizeBfSpeciesAliasStatic(rawA)
                            val monB = normalizeBfSpeciesAliasStatic(rawB)
                            val list = parsedLists[lgKey]!!
                            if (list.none { it.monA.equals(monA, true) && it.monB.equals(monB, true) }) {
                                list.add(BattleFrontierCoreEntry(monA, monB, pct))
                            }
                        }
                    }
                }
            }
            parsedLists.forEach { (lgKey, list) ->
                if (list.isNotEmpty()) {
                    BATTLE_FRONTIER_CORES_MAP[lgKey] = java.util.concurrent.CopyOnWriteArrayList(list)
                }
            }
        }
    } catch (_: Exception) {}

    prefs.edit()
        .putString(PREFS_KEY_BF_USAGE_JSON, Gson().toJson(BATTLE_FRONTIER_USAGE_MAP))
        .putString(PREFS_KEY_BF_CORES_JSON, Gson().toJson(BATTLE_FRONTIER_CORES_MAP))
        .putLong(PREFS_KEY_BF_LAST_SYNC_MS, System.currentTimeMillis())
        .apply()

    return getBattleFrontierLeagueCountsSummaryStatic("✅ Synced Battle Frontier Sheets")
}

internal fun OverlayService.Companion.getShow6UsagePctStatic(league: String, speciesName: String): Double {
    val normLeague = normalizeLeagueKeyStatic(league)
    val usageMap = BATTLE_FRONTIER_USAGE_MAP[normLeague] ?: BATTLE_FRONTIER_USAGE_MAP["GREAT LEAGUE"] ?: return 0.0
    val clean = speciesName.replace(Regex("^Shadow\\s+", RegexOption.IGNORE_CASE), "").trim()
    usageMap[clean]?.let { return it }
    val lower = clean.lowercase()
    usageMap.entries.firstOrNull { it.key.lowercase() == lower }?.let { return it.value }
    val base = FormResolver.extractBaseSpecies(clean).lowercase()
    usageMap.entries.firstOrNull { FormResolver.extractBaseSpecies(it.key).lowercase() == base }?.let { return it.value * 0.85 }
    return 0.0
}

internal fun OverlayService.Companion.findShow6CommonCoreEntryStatic(league: String, mon1: String, mon2: String): BattleFrontierCoreEntry? {
    val normLeague = normalizeLeagueKeyStatic(league)
    val cores = BATTLE_FRONTIER_CORES_MAP[normLeague] ?: BATTLE_FRONTIER_CORES_MAP["GREAT LEAGUE"] ?: return null
    val b1 = FormResolver.extractBaseSpecies(mon1).lowercase()
    val b2 = FormResolver.extractBaseSpecies(mon2).lowercase()
    if (b1.isEmpty() || b2.isEmpty() || b1 == b2) return null
    return cores.firstOrNull { c ->
        val ca = FormResolver.extractBaseSpecies(c.monA).lowercase()
        val cb = FormResolver.extractBaseSpecies(c.monB).lowercase()
        (ca == b1 && cb == b2) || (ca == b2 && cb == b1)
    }
}

internal fun OverlayService.Companion.calculateShow6TrioCoreBonusPctStatic(league: String, trioNames: List<String>): Pair<Double, String> {
    var totalCorePct = 0.0
    var topLabel = ""
    var bestPairPct = 0.0
    for (i in trioNames.indices) {
        for (j in (i + 1) until trioNames.size) {
            val match = findShow6CommonCoreEntryStatic(league, trioNames[i], trioNames[j])
            if (match != null) {
                totalCorePct += match.usagePct
                if (match.usagePct > bestPairPct) {
                    bestPairPct = match.usagePct
                    topLabel = "${match.monA} + ${match.monB} (${match.usagePct}%)"
                }
            }
        }
    }
    return totalCorePct to topLabel
}

internal fun OverlayService.Companion.getMostLikelyMetaOpponent6Static(league: String): List<String> {
    val normLeague = normalizeLeagueKeyStatic(league)
    val picked = ArrayList<String>(6)
    val usedBase = HashSet<String>()
    var hasMega = false

    fun tryAddMon(rawName: String): Boolean {
        if (picked.size >= 6) return false
        val clean = rawName.trim()
        if (clean.isEmpty()) return false
        val resolved = resolveRecommendedMovesForSpecies(clean, normLeague)?.name ?: clean
        val base = FormResolver.extractBaseSpecies(resolved).lowercase()
        if (base.isEmpty() || base in usedBase) return false
        val isMega = isMegaOrPrimalSpeciesStatic(resolved)
        if (isMega && hasMega) return false
        usedBase.add(base)
        if (isMega) hasMega = true
        picked.add(resolved)
        return true
    }

    val cores = BATTLE_FRONTIER_CORES_MAP[normLeague]?.sortedByDescending { it.usagePct }.orEmpty()
    for (c in cores) {
        if (picked.size >= 4) break
        tryAddMon(c.monA)
        tryAddMon(c.monB)
    }

    val usageEntries = BATTLE_FRONTIER_USAGE_MAP[normLeague]?.entries?.sortedByDescending { it.value }.orEmpty()
    for (e in usageEntries) {
        if (picked.size >= 6) break
        tryAddMon(e.key)
    }

    if (picked.size < 6) {
        for (cand in getTop100MetaCandidatesForLeagueStatic(normLeague, 30)) {
            if (picked.size >= 6) break
            tryAddMon(cand.name)
        }
    }
    return picked.take(6)
}

@JvmName("evaluateShow6Pick3MatchupFromNamesStatic")
internal fun OverlayService.Companion.evaluateShow6Pick3MatchupStatic(
    league: String,
    my6RawNames: List<String>,
    opp6RawNames: List<String>
): Show6Pick3OptimizerResult {
    val slots = my6RawNames.map { raw ->
        TeamMember(
            name = raw.trim(),
            cp = 0,
            fastMove = "",
            chargedMove1 = "",
            chargedMove2 = "",
            ivs = null
        )
    }
    return evaluateShow6Pick3MatchupStatic(league, slots, opp6RawNames)
}

/**
 * Show 6 Mode 1: 6v6 Matchup Pick-3 Optimizer
 * - Opponent movesets are unknown -> uses standard 75%/25% weighted moveset distribution in calculateMatchupRatingStatic.
 * - Simulates best movesets for Your 6 Pokémon against Opponent's 6.
 * - Weighs Opponent 3-Pokémon lineups of highest viability highest when evaluating all 120 x 120 = 14,400 ordered 3v3 lineups.
 * - Returns 3 options for each team type: Top 3 ABB, Top 3 ABC, Top 3 Duo-Core.
 */
internal fun OverlayService.Companion.evaluateShow6Pick3MatchupStatic(
    league: String,
    my6NamesOrSlots: List<TeamMember>,
    opp6RawNames: List<String>
): Show6Pick3OptimizerResult {
    val t0 = System.currentTimeMillis()
    val normLeague = normalizeLeagueKeyStatic(league)
    val isGreat = normLeague == "GREAT LEAGUE" || normLeague == "BATTLE FRONTIER (SPECTRAL)"
    val isUltra = normLeague == "ULTRA LEAGUE" || normLeague == "BATTLE FRONTIER (CAULDRON)"
    val fallbackPool = getTop100MetaCandidatesForLeagueStatic(normLeague, 24)

    val rawMy6 = ArrayList<TeamMember>(6)
    for (i in 0 until 6) {
        val input = my6NamesOrSlots.getOrNull(i)
        val name = input?.name?.trim()?.takeIf { it.isNotEmpty() }
            ?: fallbackPool.getOrNull(i)?.name ?: "Clodsire"
        val resolved = resolveRecommendedMovesForSpecies(name, normLeague)
        val scaled = if (resolved != null) computeEffectiveCombatStats(resolved, normLeague) else null
        val defIvs = when {
            isGreat -> scaled?.defaultIvsGl ?: "4/15/14"
            isUltra -> scaled?.defaultIvsUl ?: "4/15/14"
            else -> "15/15/15"
        }
        rawMy6.add(
            TeamMember(
                name = scaled?.name ?: name,
                cp = input?.cp?.takeIf { it > 0 } ?: scaled?.defaultCp ?: 1500,
                fastMove = input?.fastMove?.takeIf { it.isNotBlank() } ?: scaled?.defaultFastMove ?: "Mud Shot",
                chargedMove1 = input?.chargedMove1?.takeIf { it.isNotBlank() } ?: scaled?.chargedMove1 ?: "Earthquake",
                chargedMove2 = input?.chargedMove2?.takeIf { it.isNotBlank() } ?: scaled?.chargedMove2 ?: "Stone Edge",
                ivs = input?.ivs ?: defIvs
            )
        )
    }

    val opp6Names = ArrayList<String>(6)
    for (i in 0 until 6) {
        val rawName = opp6RawNames.getOrNull(i)?.trim()?.takeIf { it.isNotEmpty() }
            ?: fallbackPool.getOrNull(i + 6)?.name ?: "Feraligatr"
        val resolved = resolveRecommendedMovesForSpecies(rawName, normLeague)
        val displayName = if (rawName.startsWith("Shadow ", ignoreCase = true) && resolved != null && !resolved.name.startsWith("Shadow ", ignoreCase = true)) {
            "Shadow ${resolved.name}"
        } else {
            resolved?.name ?: rawName
        }
        opp6Names.add(displayName)
    }

    // Stage 1: Simulate best movesets for Your 6 Pokémon against the Opponent's 6
    val myOptimized6 = rawMy6.map { slot ->
        val (rawFast, rawCharged) = getAvailableMovePoolForSpeciesStatic(slot.name, normLeague)
        val fastPool = rawFast.filter { it.isNotBlank() && !it.equals("Struggle", ignoreCase = true) }.distinctBy { it.lowercase() }.take(3).ifEmpty { listOf(slot.fastMove) }
        val chargedPool = rawCharged.filter { it.isNotBlank() && !it.equals("Struggle", ignoreCase = true) && !it.equals("Frustration", ignoreCase = true) }.distinctBy { it.lowercase() }.take(4).ifEmpty { listOf(slot.chargedMove1, slot.chargedMove2).distinct() }
        val pairs = ArrayList<Pair<String, String>>()
        if (chargedPool.size <= 1) {
            val m = chargedPool.firstOrNull() ?: slot.chargedMove1
            pairs.add(m to m)
        } else {
            for (a in 0 until chargedPool.size) {
                for (b in (a + 1) until chargedPool.size) {
                    pairs.add(chargedPool[a] to chargedPool[b])
                }
            }
        }
        var bestMember = slot
        var bestAvgBr = -1.0
        for (fMove in fastPool) {
            for ((c1, c2) in pairs) {
                var sumBr = 0.0
                for (oppName in opp6Names) {
                    val b11 = calculateMatchupRatingStatic(slot.name, oppName, 1, 1, normLeague, fMove, c1, c2, slot.cp, slot.ivs)
                    val b00 = calculateMatchupRatingStatic(slot.name, oppName, 0, 0, normLeague, fMove, c1, c2, slot.cp, slot.ivs)
                    sumBr += 0.65 * b11 + 0.35 * b00
                }
                val avg = sumBr / 6.0
                if (avg > bestAvgBr) {
                    bestAvgBr = avg
                    bestMember = slot.copy(fastMove = fMove, chargedMove1 = c1, chargedMove2 = c2)
                }
            }
        }
        bestMember
    }

    // Stage 2: Precompute 6x6 role-specific matchup matrices (Opponent movesets weighted 75%/25% inside calculateMatchupRatingStatic)
    val leadBrMatrix = Array(6) { DoubleArray(6) }
    val swapBrMatrix = Array(6) { DoubleArray(6) }
    val closerBrMatrix = Array(6) { DoubleArray(6) }
    for (u in 0 until 6) {
        val uSlot = myOptimized6[u]
        for (o in 0 until 6) {
            val oName = opp6Names[o]
            val b00 = calculateMatchupRatingStatic(uSlot.name, oName, 0, 0, normLeague, uSlot.fastMove, uSlot.chargedMove1, uSlot.chargedMove2, uSlot.cp, uSlot.ivs).toDouble()
            val b11 = calculateMatchupRatingStatic(uSlot.name, oName, 1, 1, normLeague, uSlot.fastMove, uSlot.chargedMove1, uSlot.chargedMove2, uSlot.cp, uSlot.ivs).toDouble()
            val b22 = calculateMatchupRatingStatic(uSlot.name, oName, 2, 2, normLeague, uSlot.fastMove, uSlot.chargedMove1, uSlot.chargedMove2, uSlot.cp, uSlot.ivs).toDouble()
            val b10 = calculateMatchupRatingStatic(uSlot.name, oName, 1, 0, normLeague, uSlot.fastMove, uSlot.chargedMove1, uSlot.chargedMove2, uSlot.cp, uSlot.ivs).toDouble()
            val b01 = calculateMatchupRatingStatic(uSlot.name, oName, 0, 1, normLeague, uSlot.fastMove, uSlot.chargedMove1, uSlot.chargedMove2, uSlot.cp, uSlot.ivs).toDouble()
            leadBrMatrix[u][o] = 0.50 * b11 + 0.35 * b22 + 0.15 * b00
            swapBrMatrix[u][o] = 0.45 * b11 + 0.25 * b10 + 0.20 * b01 + 0.10 * b00
            closerBrMatrix[u][o] = 0.55 * b00 + 0.25 * b10 + 0.20 * b11
        }
    }

    fun getTypesAndProfile(name: String): Triple<List<String>, Set<String>, Set<String>> {
        val meta = resolveRecommendedMovesForSpecies(name, normLeague)
        val types = meta?.types?.map { it.lowercase() }?.ifEmpty { listOf("normal") } ?: listOf("normal")
        val weaks = ALL_18_TYPES.filter { getTypeEffectivenessStatic(it, types) > 1.05 }.toSet()
        val resists = ALL_18_TYPES.filter { getTypeEffectivenessStatic(it, types) < 0.95 }.toSet()
        return Triple(types, weaks, resists)
    }

    val myProfiles = myOptimized6.map { getTypesAndProfile(it.name) }
    val oppProfiles = opp6Names.map { getTypesAndProfile(it) }

    fun classifyOrderedTrio(
        i0: Int,
        i1: Int,
        i2: Int,
        profiles: List<Triple<List<String>, Set<String>, Set<String>>>
    ): Pair<String, List<String>> {
        val w0 = profiles[i0].second
        val r0 = profiles[i0].third
        val w1 = profiles[i1].second
        val r1 = profiles[i1].third
        val w2 = profiles[i2].second
        val r2 = profiles[i2].third

        val backShared = w1.intersect(w2)
        val coveredByLead = backShared.filter { it in r0 && it !in w0 }
        if (coveredByLead.isNotEmpty() && (backShared.size >= 2 || coveredByLead.any { it in CRITICAL_META_TYPES })) {
            return "ABB" to coveredByLead.map { it.replaceFirstChar { c -> c.uppercase() } }
        }

        val c0Covers2 = w2.filter { it in r0 }
        val c2Covers0 = w0.filter { it in r2 }
        if (w0.intersect(w2).isEmpty() && c0Covers2.isNotEmpty() && c2Covers0.isNotEmpty() && (c0Covers2.size + c2Covers0.size) >= 2) {
            val mut = (c0Covers2 + c2Covers0).distinct().map { it.replaceFirstChar { c -> c.uppercase() } }
            return "DUO" to mut
        }
        return "ABC" to emptyList()
    }

    val allOrdered120 = ArrayList<Triple<Int, Int, Int>>(120)
    for (a in 0 until 6) {
        for (b in 0 until 6) {
            if (b == a) continue
            for (c in 0 until 6) {
                if (c == a || c == b) continue
                allOrdered120.add(Triple(a, b, c))
            }
        }
    }

    val wUsageAndCores = (activeShow6UsageWeightPct.coerceIn(0, 100) / 100.0)
    val maxLeagueUsage = (BATTLE_FRONTIER_USAGE_MAP[normLeague]?.values?.maxOrNull() ?: 50.0).coerceAtLeast(10.0)

    // Stage 3: Score all 120 Opponent 3-Pokémon lineups by structural viability, Battle Frontier Usage %, Common Core multiplier & 1-Mega limit
    data class OppTrioEval(
        val indices: Triple<Int, Int, Int>,
        val names: List<String>,
        val archetype: String,
        val viabilityBr: Int,
        val rawExpWeight: Double
    )

    val oppTrios = allOrdered120.mapNotNull { (o0, o1, o2) ->
        val trioNames = listOf(opp6Names[o0], opp6Names[o1], opp6Names[o2])
        if (hasMultipleMegasStatic(trioNames)) return@mapNotNull null
        val (arch, _) = classifyOrderedTrio(o0, o1, o2, oppProfiles)
        var leadVsMy6 = 0.0
        var swapVsMy6 = 0.0
        var closerVsMy6 = 0.0
        for (u in 0 until 6) {
            leadVsMy6 += (1000.0 - leadBrMatrix[u][o0])
            swapVsMy6 += (1000.0 - swapBrMatrix[u][o1])
            closerVsMy6 += (1000.0 - closerBrMatrix[u][o2])
        }
        leadVsMy6 /= 6.0
        swapVsMy6 /= 6.0
        closerVsMy6 /= 6.0
        val structBonus = when (arch) {
            "ABB" -> 18.0
            "DUO" -> 14.0
            else -> 8.0
        }
        val avgUsagePct = trioNames.map { getShow6UsagePctStatic(normLeague, it) }.average()
        val (coreSumPct, _) = calculateShow6TrioCoreBonusPctStatic(normLeague, trioNames)
        val usageAndCoreBonusBr = wUsageAndCores * ((avgUsagePct / maxLeagueUsage) * 32.0 + min(42.0, coreSumPct * 0.85))
        val viab = (0.40 * leadVsMy6 + 0.32 * swapVsMy6 + 0.28 * closerVsMy6 + structBonus + usageAndCoreBonusBr).roundToInt().coerceIn(250, 860)
        val coreMultiplier = 1.0 + wUsageAndCores * min(0.75, coreSumPct / 40.0)
        val expW = kotlin.math.exp((viab - 500.0) / 38.0) * coreMultiplier
        OppTrioEval(Triple(o0, o1, o2), trioNames, arch, viab, expW)
    }
    val totalOppExpW = oppTrios.sumOf { it.rawExpWeight }.takeIf { it > 0.0 } ?: 1.0

    val sortedOppTrios = oppTrios.sortedByDescending { it.viabilityBr }
    val topViableOppLineups = sortedOppTrios.take(8).mapIndexed { idx, ot ->
        Show6OpponentViableLineup(
            rank = idx + 1,
            pokemonNames = ot.names,
            archetype = ot.archetype,
            viabilityScore = ot.viabilityBr,
            normalizedWeightPct = ((ot.rawExpWeight / totalOppExpW) * 1000.0).roundToInt() / 10.0
        )
    }

    fun pickTop3OppArchetype(targetArch: String): List<Show6OpponentViableLineup> {
        val chosen = ArrayList<Show6OpponentViableLineup>(3)
        val seenSigs = HashSet<String>()
        val primary = sortedOppTrios.filter { it.archetype.equals(targetArch, ignoreCase = true) }
        for (ot in (primary + sortedOppTrios)) {
            if (chosen.size >= 3) break
            val sig = ot.names.map { it.lowercase() }.sorted().joinToString("|")
            if (seenSigs.add(sig)) {
                chosen.add(
                    Show6OpponentViableLineup(
                        rank = chosen.size + 1,
                        pokemonNames = ot.names,
                        archetype = targetArch,
                        viabilityScore = ot.viabilityBr,
                        normalizedWeightPct = ((ot.rawExpWeight / totalOppExpW) * 1000.0).roundToInt() / 10.0
                    )
                )
            }
        }
        return chosen
    }

    val oppTop3Abb = pickTop3OppArchetype("ABB")
    val oppTop3Abc = pickTop3OppArchetype("ABC")
    val oppTop3Duo = pickTop3OppArchetype("DUO")

    // Stage 4: Evaluate all 120 Player 3-Pokémon lineups against all 120 viability-weighted Opponent lineups
    val abbList = ArrayList<Show6Pick3LineupRec>()
    val abcList = ArrayList<Show6Pick3LineupRec>()
    val duoList = ArrayList<Show6Pick3LineupRec>()

    for ((u0, u1, u2) in allOrdered120) {
        val members = listOf(myOptimized6[u0], myOptimized6[u1], myOptimized6[u2])
        if (hasMultipleMegasStatic(members.map { it.name })) continue
        val (arch, sharedWeaks) = classifyOrderedTrio(u0, u1, u2, myProfiles)
        var weightedBrSum = 0.0
        var worstBr = 999.0
        var worstOppLabel = ""
        var beatenCount = 0

        for (ot in oppTrios) {
            val (o0, o1, o2) = ot.indices
            val normW = ot.rawExpWeight / totalOppExpW
            val lBr = leadBrMatrix[u0][o0]
            val alignA = (swapBrMatrix[u1][o1] + closerBrMatrix[u2][o2]) * 0.5
            val alignB = (swapBrMatrix[u1][o2] + closerBrMatrix[u2][o1]) * 0.5
            val backBr = 0.68 * max(alignA, alignB) + 0.32 * min(alignA, alignB)
            val teamBr = 0.42 * lBr + 0.58 * backBr

            weightedBrSum += normW * teamBr
            if (teamBr >= 505.0) beatenCount++
            if (teamBr < worstBr) {
                worstBr = teamBr
                worstOppLabel = "${ot.names[0]} / ${ot.names[1]} / ${ot.names[2]} (${teamBr.roundToInt()} BR)"
            }
        }

        val lAgg = (0 until 6).map { leadBrMatrix[u0][it] }.average().roundToInt().coerceIn(200, 850)
        val sAgg = (0 until 6).map { swapBrMatrix[u1][it] }.average().roundToInt().coerceIn(200, 850)
        val cAgg = (0 until 6).map { closerBrMatrix[u2][it] }.average().roundToInt().coerceIn(200, 850)
        val (myCoreSumPct, myTopCoreLabel) = calculateShow6TrioCoreBonusPctStatic(normLeague, members.map { it.name })
        val myCoreBonusBr = wUsageAndCores * min(18.0, myCoreSumPct * 0.35)
        val wExpBr = (weightedBrSum + myCoreBonusBr).roundToInt().coerceIn(200, 850)
        val wMinBr = worstBr.roundToInt().coerceIn(150, 850)
        val compScore = ((0.72 * (weightedBrSum + myCoreBonusBr) + 0.28 * worstBr) * 10.0).roundToInt() / 10.0
        val coreSuffix = if (myTopCoreLabel.isNotEmpty()) " • 🔥 Core: $myTopCoreLabel" else ""

        val summary = when (arch) {
            "ABB" -> "ABB Pick-3: ${members[0].name} (Lead A) covers ${sharedWeaks.joinToString("/").ifEmpty { "Backline" }} for ${members[1].name} (B1) & ${members[2].name} (B2)$coreSuffix • Beats $beatenCount/${oppTrios.size} Opp Trios • Worst vs: $worstOppLabel"
            "DUO" -> "Duo-Core Pick-3: ${members[0].name} (Core 1) & ${members[2].name} (Core 2) cover ${sharedWeaks.joinToString("/").ifEmpty { "Core" }} w/ ${members[1].name} Pivot$coreSuffix • Beats $beatenCount/${oppTrios.size} Opp Trios • Worst vs: $worstOppLabel"
            else -> "ABC Balanced Pick-3: ${members[0].name} Lead + ${members[1].name} Safe Swap + ${members[2].name} Closer$coreSuffix • Beats $beatenCount/${oppTrios.size} Opp Trios • Worst vs: $worstOppLabel"
        }

        val option = Show6Pick3LineupRec(
            id = "show6-${arch.lowercase()}-$u0-$u1-$u2",
            archetype = arch,
            rank = 0,
            league = normLeague,
            pokemon = members,
            weightedExpectedBr = wExpBr,
            worstCaseMinimaxBr = wMinBr,
            compositeScore = compScore,
            leadAggBr = lAgg,
            safeSwapBr = sAgg,
            closerBr = cAgg,
            machineAggBr = wExpBr,
            sharedWeaknesses = sharedWeaks,
            topOppLineupsBeatenCount = beatenCount,
            totalOppLineupsEvaluated = max(1, oppTrios.size),
            worstCounterLineupLabel = worstOppLabel,
            synergySummary = summary
        )

        when (arch) {
            "ABB" -> abbList.add(option)
            "DUO" -> duoList.add(option)
            else -> abcList.add(option)
        }
    }

    // Ensure each of the 3 archetypes has at least 3 options even if the 6-mon pool is heavily skewed
    val allSorted = (abbList + abcList + duoList).sortedByDescending { it.compositeScore }
    fun fillTop3(primary: List<Show6Pick3LineupRec>, targetArch: String): List<Show6Pick3LineupRec> {
        val sorted = primary.sortedByDescending { it.compositeScore }.toMutableList()
        if (sorted.size < 3) {
            for (cand in allSorted) {
                if (sorted.size >= 3) break
                if (sorted.none { it.pokemon.map { m -> m.name } == cand.pokemon.map { m -> m.name } }) {
                    sorted.add(cand.copy(archetype = targetArch))
                }
            }
        }
        return sorted.take(3).mapIndexed { idx, item -> item.copy(rank = idx + 1) }
    }

    return Show6Pick3OptimizerResult(
        league = normLeague,
        myOptimized6 = myOptimized6,
        opp6Names = opp6Names,
        top3AbbTeams = fillTop3(abbList, "ABB"),
        top3AbcTeams = fillTop3(abcList, "ABC"),
        top3DuoTeams = fillTop3(duoList, "DUO"),
        topViableOpponentLineups = topViableOppLineups,
        oppTop3AbbTeams = oppTop3Abb,
        oppTop3AbcTeams = oppTop3Abc,
        oppTop3DuoTeams = oppTop3Duo,
        totalMatchupsSimulated = 14400,
        elapsedMs = max(1L, System.currentTimeMillis() - t0)
    )
}

/**
 * Show 6 Mode 2: Blind Show 6 Meta Roster Builder
 * - Builds an optimal 6-Pokémon tournament roster before knowing Opponent's 6.
 * - Supports 0–5 locked core Pokémon, Banlist or Whitelist filter, Expected Historical Pokémon list,
 *   and Historical vs. PvPoke Meta Weight Slider (0%–100%).
 */
internal fun OverlayService.Companion.generateBlindShow6RosterStatic(
    league: String,
    lockedCoreNames: List<String> = emptyList(),
    filterMode: String = "NONE", // "NONE" | "BANLIST" | "WHITELIST"
    filterPokemonNames: List<String> = emptyList(),
    expectedHistoricalNames: List<String> = emptyList(),
    historicalWeightPct: Int = 35
): BlindShow6RosterResult {
    val filterPokemonList = filterPokemonNames
    val expectedHistoricalPokemon = expectedHistoricalNames
    val t0 = System.currentTimeMillis()
    val normLeague = normalizeLeagueKeyStatic(league)
    val baseCandidates = getTop100MetaCandidatesForLeagueStatic(normLeague, 120)
    val filterBaseSet = filterPokemonList.map { FormResolver.extractBaseSpecies(it).lowercase() }.filter { it.isNotEmpty() }.toSet()
    val filterExactSet = filterPokemonList.map { it.trim().lowercase() }.filter { it.isNotEmpty() }.toSet()

    val eligiblePool = baseCandidates.filter { cand ->
        val baseSp = FormResolver.extractBaseSpecies(cand.name).lowercase()
        val nameLower = cand.name.lowercase()
        when (filterMode.uppercase()) {
            "BANLIST", "BAN" -> baseSp !in filterBaseSet && nameLower !in filterExactSet
            "WHITELIST", "WHITE" -> if (filterBaseSet.isEmpty()) true else (baseSp in filterBaseSet || nameLower in filterExactSet)
            else -> true
        }
    }.ifEmpty { baseCandidates.take(30) }

    // Build blended target threat distribution (Fused Battle Frontier Usage + Cores + PvPoke Meta + Expected Historical Pokémon)
    val wHist = (historicalWeightPct.coerceIn(0, 100) / 100.0)
    val wMeta = 1.0 - wHist
    val wUsage = (activeShow6UsageWeightPct.coerceIn(0, 100) / 100.0)
    val maxLeagueUsage = (BATTLE_FRONTIER_USAGE_MAP[normLeague]?.values?.maxOrNull() ?: 50.0).coerceAtLeast(10.0)
    val metaTargets = eligiblePool.take(40).map { it.name }
    val histClean = expectedHistoricalPokemon.map { it.trim() }.filter { it.isNotEmpty() }
    val targetWeights = LinkedHashMap<String, Double>()

    metaTargets.forEachIndexed { idx, name ->
        val pvpokeRankW = kotlin.math.exp(-0.045 * idx.toDouble())
        val usagePct = getShow6UsagePctStatic(normLeague, name)
        val usageNormW = if (usagePct > 0.0) (usagePct / maxLeagueUsage).coerceIn(0.08, 1.35) else 0.12
        val fusedW = (1.0 - wUsage) * pvpokeRankW + wUsage * usageNormW
        targetWeights[name] = (targetWeights[name] ?: 0.0) + wMeta * fusedW
    }
    if (histClean.isNotEmpty() && wHist > 0.0) {
        val perEntry = wHist / histClean.size.toDouble()
        for (rawH in histClean) {
            val resolved = resolveRecommendedMovesForSpecies(rawH, normLeague)?.name ?: rawH
            targetWeights[resolved] = (targetWeights[resolved] ?: 0.0) + perEntry * 12.0
        }
    }
    val topThreats = targetWeights.entries.sortedByDescending { it.value }.take(30).map { it.key }.ifEmpty { metaTargets.take(25) }

    val roster = ArrayList<TeamMember>(6)
    val usedBaseSpecies = HashSet<String>()
    val lockedIncluded = ArrayList<String>()

    for (rawLock in lockedCoreNames.take(5)) {
        val clean = rawLock.trim()
        if (clean.isEmpty()) continue
        val match = eligiblePool.find { it.name.equals(clean, ignoreCase = true) }
            ?: baseCandidates.find { it.name.equals(clean, ignoreCase = true) }
            ?: eligiblePool.find { FormResolver.extractBaseSpecies(it.name).equals(FormResolver.extractBaseSpecies(clean), ignoreCase = true) }
        if (match != null) {
            val bSp = FormResolver.extractBaseSpecies(match.name).lowercase()
            val wouldExceedMega = isMegaOrPrimalSpeciesStatic(match.name) && roster.any { isMegaOrPrimalSpeciesStatic(it.name) }
            if (!wouldExceedMega && usedBaseSpecies.add(bSp)) {
                roster.add(match)
                lockedIncluded.add(match.name)
            }
        }
    }

    // Greedily add complementary Pokémon up to 6 that maximize threat coverage, Common Core synergy & enforce Max 1 Mega
    val candidateSubPool = eligiblePool.take(48)
    val brCache = HashMap<String, Int>()
    fun getBr1s(c: TeamMember, opp: String): Int {
        val k = "${c.name.lowercase()}|${opp.lowercase()}"
        return brCache.getOrPut(k) {
            calculateMatchupRatingStatic(c.name, opp, 1, 1, normLeague, c.fastMove, c.chargedMove1, c.chargedMove2, c.cp, c.ivs)
        }
    }

    while (roster.size < 6) {
        var bestCand: TeamMember? = null
        var bestScore = Double.NEGATIVE_INFINITY
        val alreadyHasMega = roster.any { isMegaOrPrimalSpeciesStatic(it.name) }

        for (cand in candidateSubPool) {
            val bSp = FormResolver.extractBaseSpecies(cand.name).lowercase()
            if (bSp in usedBaseSpecies) continue
            if (alreadyHasMega && isMegaOrPrimalSpeciesStatic(cand.name)) continue
            var covGain = 0.0
            for (t in topThreats) {
                val existingBest = if (roster.isEmpty()) 420 else roster.maxOf { getBr1s(it, t) }
                val candBr = getBr1s(cand, t)
                val w = targetWeights[t] ?: 0.1
                if (existingBest < 515 && candBr >= 525) {
                    covGain += w * (candBr - existingBest) * 2.2
                } else {
                    covGain += w * max(0, candBr - 480) * 0.45
                }
            }
            // Common Core synergy bonus with existing roster members + Usage % bonus
            val coreBonus = roster.sumOf { existing ->
                findShow6CommonCoreEntryStatic(normLeague, existing.name, cand.name)?.usagePct ?: 0.0
            } * wUsage * 1.4
            val usageBonus = getShow6UsagePctStatic(normLeague, cand.name) * wUsage * 0.65
            // Type diversity bonus
            val candTypes = resolveRecommendedMovesForSpecies(cand.name, normLeague)?.types?.map { it.lowercase() }.orEmpty()
            val existingTypes = roster.flatMap { resolveRecommendedMovesForSpecies(it.name, normLeague)?.types?.map { t -> t.lowercase() }.orEmpty() }.toSet()
            val newTypeBonus = candTypes.count { it !in existingTypes } * 18.0
            val total = covGain + newTypeBonus + coreBonus + usageBonus
            if (total > bestScore) {
                bestScore = total
                bestCand = cand
            }
        }
        val chosen = bestCand ?: eligiblePool.firstOrNull {
            FormResolver.extractBaseSpecies(it.name).lowercase() !in usedBaseSpecies &&
                !(alreadyHasMega && isMegaOrPrimalSpeciesStatic(it.name))
        } ?: break
        usedBaseSpecies.add(FormResolver.extractBaseSpecies(chosen.name).lowercase())
        roster.add(chosen)
    }

    // Audit 6-Pokémon roster against topThreats
    var coveredCount = 0
    val coreBreakers = ArrayList<String>()
    for (t in topThreats) {
        val brs = roster.map { getBr1s(it, t) }
        val wins = brs.count { it >= 515 }
        if (wins >= 2) coveredCount++
        if (brs.all { it < 490 }) coreBreakers.add(t)
    }
    val covPct = ((coveredCount * 100.0) / max(1, topThreats.size).toDouble()).roundToInt().coerceIn(10, 100)

    val selfPick3 = evaluateShow6Pick3MatchupStatic(normLeague, roster, topThreats.take(6))
    val roleLabels = listOf("Core Anchor", "Safe Pivot", "Core Breaker", "Anti-Flyer/Tank", "Closer Sweep", "Flex Counter")
    val roster6Slots = selfPick3.myOptimized6.mapIndexed { idx, member ->
        val beaten = topThreats.filter { getBr1s(member, it) >= 525 }.take(4).ifEmpty { topThreats.take(2) }
        val avgScore = topThreats.map { getBr1s(member, it) }.average().roundToInt().coerceIn(350, 820)
        val isLocked = lockedIncluded.any { it.equals(member.name, ignoreCase = true) }
        BlindShow6RosterSlot(
            pokemon = member,
            roleLabel = if (isLocked) "Locked Core" else roleLabels.getOrElse(idx) { "Flex Slot" },
            metaScore = avgScore,
            coveredThreats = beaten
        )
    }

    val filterLabel = when (filterMode.uppercase()) {
        "BANLIST", "BAN" -> "Banlist (${filterPokemonList.size} banned)"
        "WHITELIST", "WHITE" -> "Whitelist (${filterPokemonList.size} allowed)"
        else -> "Open Meta (No Ban/Whitelist)"
    }

    return BlindShow6RosterResult(
        league = normLeague,
        roster = selfPick3.myOptimized6,
        roster6 = roster6Slots,
        lockedSlotsIncluded = lockedIncluded,
        metaCoveragePct = covPct,
        metaPoolSize = eligiblePool.size,
        coreBreakerCount = coreBreakers.size,
        coreBreakers = coreBreakers.take(6),
        topAbbLineup = selfPick3.top3AbbTeams.firstOrNull()?.pokemon ?: roster.take(3),
        topAbcLineup = selfPick3.top3AbcTeams.firstOrNull()?.pokemon ?: roster.take(3),
        topDuoLineup = selfPick3.top3DuoTeams.firstOrNull()?.pokemon ?: roster.take(3),
        filterSummary = "$filterLabel • ${activeShow6UsageWeightPct}% BF Usage & Cores / ${100 - activeShow6UsageWeightPct}% PvPoke",
        elapsedMs = max(1L, System.currentTimeMillis() - t0)
    )
}

/**
 * Pick-6 Team Editor: Suggest Top 5 Alternate Pokémon Upgrades for a specific slot (0..5)
 */
internal fun OverlayService.Companion.recommendShow6RosterSlotUpgradesStatic(
    league: String,
    currentRoster6: List<TeamMember>,
    slotIndex: Int
): List<Show6RosterSlotUpgradeRec> {
    val normLeague = normalizeLeagueKeyStatic(league)
    val candidates = getTop100MetaCandidatesForLeagueStatic(normLeague, 55)
    val other5 = currentRoster6.filterIndexed { idx, _ -> idx != slotIndex }
    val otherBaseSet = other5.map { FormResolver.extractBaseSpecies(it.name).lowercase() }.toSet()
    val otherHasMega = other5.any { isMegaOrPrimalSpeciesStatic(it.name) }
    val currentSlot = currentRoster6.getOrNull(slotIndex)
    val metaThreats = candidates.take(20).map { it.name }
    val wUsage = activeShow6UsageWeightPct.coerceIn(0, 100) / 100.0

    fun evalMemberScore(member: TeamMember): Triple<Double, Int, String> {
        var weightedBr = 0.0
        var weightSum = 0.0
        metaThreats.forEachIndexed { idx, tName ->
            val uPct = getShow6UsagePctStatic(normLeague, tName)
            val w = (1.0 - wUsage) * kotlin.math.exp(-0.05 * idx) + wUsage * ((uPct / 45.0).coerceIn(0.15, 1.3))
            val br = calculateMatchupRatingStatic(member.name, tName, 1, 1, normLeague, member.fastMove, member.chargedMove1, member.chargedMove2, member.cp, member.ivs)
            val teammateBest = other5.maxOfOrNull { tm ->
                calculateMatchupRatingStatic(tm.name, tName, 1, 1, normLeague, tm.fastMove, tm.chargedMove1, tm.chargedMove2, tm.cp, tm.ivs)
            } ?: 450
            val synergyLift = if (teammateBest < 495 && br >= 525) (br - teammateBest) * 0.45 else 0.0
            weightedBr += w * (br + synergyLift)
            weightSum += w
        }
        val baseBr = (weightedBr / max(0.01, weightSum)).roundToInt().coerceIn(320, 780)
        var bestCoreLabel = ""
        var coreSum = 0.0
        for (tm in other5) {
            val c = findShow6CommonCoreEntryStatic(normLeague, member.name, tm.name)
            if (c != null) {
                coreSum += c.usagePct
                if (bestCoreLabel.isEmpty()) bestCoreLabel = "${c.monA} + ${c.monB} (${c.usagePct}%)"
            }
        }
        val uPct = getShow6UsagePctStatic(normLeague, member.name)
        val totalComposite = baseBr + wUsage * (uPct * 0.45 + min(30.0, coreSum * 0.65))
        return Triple(totalComposite, baseBr, bestCoreLabel)
    }

    val baselineScore = if (currentSlot != null && currentSlot.name.isNotBlank()) evalMemberScore(currentSlot).first else 480.0
    val recs = ArrayList<Show6RosterSlotUpgradeRec>()
    for (cand in candidates.take(40)) {
        val bSp = FormResolver.extractBaseSpecies(cand.name).lowercase()
        if (bSp in otherBaseSet) continue
        if (currentSlot != null && bSp == FormResolver.extractBaseSpecies(currentSlot.name).lowercase()) continue
        if (otherHasMega && isMegaOrPrimalSpeciesStatic(cand.name)) continue
        val (comp, br, coreLbl) = evalMemberScore(cand)
        val gain = ((comp - baselineScore) * 10.0).roundToInt() / 10.0
        val uPct = getShow6UsagePctStatic(normLeague, cand.name)
        val reason = buildString {
            append("${cand.fastMove} + ${cand.chargedMove1}/${cand.chargedMove2} • Meta BR $br")
            if (uPct > 0.0) append(" • Usage ${uPct}%")
            if (coreLbl.isNotEmpty()) append(" • 🔥 Core: $coreLbl")
        }
        recs.add(Show6RosterSlotUpgradeRec(cand, gain, br, uPct, coreLbl, reason))
    }
    return recs.sortedByDescending { it.weightedScoreGain }.take(5)
}

/**
 * Pick-6 Team Editor: Suggest Top 4 Alternate Movesets for a specific Pokémon in the league
 */
internal fun OverlayService.Companion.recommendShow6RosterSlotMovesetsStatic(
    league: String,
    member: TeamMember
): List<Show6RosterSlotMovesetRec> {
    val normLeague = normalizeLeagueKeyStatic(league)
    val metaThreats = getTop100MetaCandidatesForLeagueStatic(normLeague, 16).map { it.name }
    val (rawFast, rawCharged) = getAvailableMovePoolForSpeciesStatic(member.name, normLeague)
    val fastPool = (listOf(member.fastMove) + rawFast).filter { it.isNotBlank() && !it.equals("Struggle", true) }.distinctBy { it.lowercase() }.take(4)
    val chargedPool = (listOf(member.chargedMove1, member.chargedMove2) + rawCharged).filter { it.isNotBlank() && !it.equals("Struggle", true) && !it.equals("Frustration", true) }.distinctBy { it.lowercase() }.take(5)
    val pairs = ArrayList<Pair<String, String>>()
    if (chargedPool.size <= 1) {
        val c = chargedPool.firstOrNull() ?: member.chargedMove1.ifBlank { "Body Slam" }
        pairs.add(c to c)
    } else {
        for (i in 0 until chargedPool.size) {
            for (j in (i + 1) until chargedPool.size) {
                pairs.add(chargedPool[i] to chargedPool[j])
            }
        }
    }
    fun evalMovesetBr(f: String, c1: String, c2: String): Int {
        if (metaThreats.isEmpty()) return 500
        val avg = metaThreats.map { opp ->
            val b11 = calculateMatchupRatingStatic(member.name, opp, 1, 1, normLeague, f, c1, c2, member.cp, member.ivs)
            val b00 = calculateMatchupRatingStatic(member.name, opp, 0, 0, normLeague, f, c1, c2, member.cp, member.ivs)
            0.68 * b11 + 0.32 * b00
        }.average()
        return avg.roundToInt().coerceIn(250, 820)
    }
    val curBr = evalMovesetBr(member.fastMove, member.chargedMove1, member.chargedMove2)
    val results = ArrayList<Show6RosterSlotMovesetRec>()
    for (f in fastPool) {
        for ((c1, c2) in pairs) {
            val br = evalMovesetBr(f, c1, c2)
            val isCur = f.equals(member.fastMove, true) &&
                ((c1.equals(member.chargedMove1, true) && c2.equals(member.chargedMove2, true)) ||
                    (c1.equals(member.chargedMove2, true) && c2.equals(member.chargedMove1, true)))
            results.add(Show6RosterSlotMovesetRec(f, c1, c2, br, br - curBr, isCur))
        }
    }
    return results.sortedByDescending { it.avgBrVsMeta }.take(4)
}
