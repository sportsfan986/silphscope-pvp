package com.gbl.overlay

import android.app.Activity
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.media.projection.MediaProjectionManager
import android.net.Uri
import android.os.Bundle
import android.provider.Settings
import android.widget.Toast
import androidx.core.content.ContextCompat

/**
 * Headless Translucent Activity for Tasker Automation:
 * Starts or stops the floating PvP overlay over the current foreground app (e.g., Pokémon GO)
 * without opening MainActivity or leaving the game.
 */
class TaskerOverlayActivity : Activity() {

    private var requestedTeamExtra: String? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        @Suppress("DEPRECATION")
        overridePendingTransition(0, 0)
        handleTaskerIntent(intent)
    }

    override fun onNewIntent(intent: Intent?) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleTaskerIntent(intent)
    }

    private fun handleTaskerIntent(incoming: Intent?) {
        val act = incoming?.action.orEmpty()
        val cmd = (incoming?.getStringExtra("cmd") ?: incoming?.getStringExtra("command")).orEmpty().trim()
        requestedTeamExtra = incoming?.getStringExtra(OverlayService.EXTRA_TEAM_NAME)
            ?: incoming?.getStringExtra("preset")

        val isStop = act.equals(OverlayService.ACTION_STOP_OVERLAY, ignoreCase = true) ||
            act.equals(OverlayService.ACTION_SHORT_STOP, ignoreCase = true) ||
            cmd.equals("stop", ignoreCase = true)

        val isToggle = act.equals(OverlayService.ACTION_TOGGLE_OVERLAY, ignoreCase = true) ||
            act.equals(OverlayService.ACTION_SHORT_TOGGLE, ignoreCase = true) ||
            cmd.equals("toggle", ignoreCase = true)

        val isMinimize = act.equals(OverlayService.ACTION_MINIMIZE_OVERLAY, ignoreCase = true) ||
            cmd.equals("minimize", ignoreCase = true)

        val isRestore = act.equals(OverlayService.ACTION_RESTORE_OVERLAY, ignoreCase = true) ||
            cmd.equals("restore", ignoreCase = true)

        val isOpenBattleLog = act.equals(OverlayService.ACTION_OPEN_BATTLE_LOG, ignoreCase = true) ||
            act.equals(OverlayService.ACTION_SHORT_BATTLE_LOG, ignoreCase = true) ||
            cmd.equals("battle_log", ignoreCase = true)

        when {
            isOpenBattleLog -> {
                val mainIntent = Intent(this, MainActivity::class.java).apply {
                    action = OverlayService.ACTION_OPEN_BATTLE_LOG
                    putExtra("page", "battle_log")
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
                }
                startActivity(mainIntent)
                finishQuietly()
            }
            isStop || (isToggle && OverlayService.isInstanceRunning) -> {
                OverlayService.isInstanceRunning = false
                OverlayService.hasActiveMediaProjection = false
                OverlayService.notifyRunningStateChanged()
                val stopIntent = Intent(this, OverlayService::class.java).apply {
                    action = OverlayService.ACTION_STOP_OVERLAY
                }
                try {
                    startService(stopIntent)
                } catch (_: Exception) {
                    stopService(Intent(this, OverlayService::class.java))
                }
                finishQuietly()
            }
            isMinimize -> {
                if (OverlayService.isInstanceRunning) {
                    val minIntent = Intent(this, OverlayService::class.java).apply {
                        action = OverlayService.ACTION_MINIMIZE_OVERLAY
                    }
                    startService(minIntent)
                }
                finishQuietly()
            }
            isRestore -> {
                if (OverlayService.isInstanceRunning) {
                    val resIntent = Intent(this, OverlayService::class.java).apply {
                        action = OverlayService.ACTION_RESTORE_OVERLAY
                    }
                    startService(resIntent)
                }
                finishQuietly()
            }
            else -> {
                // Default / ACTION_START_OVERLAY
                val prefs = getSharedPreferences("gbl_overlay_prefs", Context.MODE_PRIVATE)
                if (!OverlayService.hasValidScreenNameStatic(prefs)) {
                    Toast.makeText(this, "Please enter your Trainer Screen Name in SilphScope PvP first", Toast.LENGTH_LONG).show()
                    val mainIntent = Intent(this, MainActivity::class.java).apply {
                        putExtra("page", "settings")
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
                    }
                    startActivity(mainIntent)
                    finishQuietly()
                    return
                }
                if (!Settings.canDrawOverlays(this)) {
                    val permIntent = Intent(
                        Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                        Uri.parse("package:$packageName")
                    ).apply {
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    }
                    Toast.makeText(this, "Grant 'Display over other apps' permission for SilphScope PvP", Toast.LENGTH_LONG).show()
                    startActivity(permIntent)
                    finishQuietly()
                    return
                }

                val manualMode = incoming?.getBooleanExtra("manual_mode", false) == true
                if ((OverlayService.isInstanceRunning && OverlayService.hasActiveMediaProjection) || manualMode) {
                    startOverlayServiceWithResult(0, null)
                    finishQuietly()
                    return
                }

                val projMgr = getSystemService(Context.MEDIA_PROJECTION_SERVICE) as? MediaProjectionManager
                if (projMgr != null) {
                    try {
                        @Suppress("DEPRECATION")
                        startActivityForResult(projMgr.createScreenCaptureIntent(), REQ_TASKER_MEDIA_PROJECTION)
                    } catch (_: Exception) {
                        startOverlayServiceWithResult(0, null)
                        finishQuietly()
                    }
                } else {
                    startOverlayServiceWithResult(0, null)
                    finishQuietly()
                }
            }
        }
    }

    @Deprecated("Deprecated in Java")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == REQ_TASKER_MEDIA_PROJECTION) {
            if (resultCode == RESULT_OK && data != null) {
                startOverlayServiceWithResult(resultCode, data)
            } else {
                startOverlayServiceWithResult(0, null)
            }
            finishQuietly()
        }
    }

    private fun startOverlayServiceWithResult(resultCode: Int, data: Intent?) {
        val prefs = getSharedPreferences("gbl_overlay_prefs", Context.MODE_PRIVATE)
        val serviceIntent = Intent(this, OverlayService::class.java).apply {
            action = OverlayService.ACTION_START_OVERLAY
            putExtra(OverlayService.EXTRA_RESULT_CODE, resultCode)
            if (data != null) {
                putExtra(OverlayService.EXTRA_RESULT_DATA, data)
            }
            if (!requestedTeamExtra.isNullOrBlank()) {
                putExtra(OverlayService.EXTRA_TEAM_NAME, requestedTeamExtra)
            }
            putExtra(OverlayService.EXTRA_OPP_COUNT_MODE, prefs.getString("opp_count_mode", "my_fasts") ?: "my_fasts")
            putExtra(OverlayService.EXTRA_ENABLE_4_CHARGED_MOVES, prefs.getBoolean(OverlayService.PREFS_KEY_ENABLE_4_CHARGED_MOVES, false))
            putExtra(OverlayService.EXTRA_DISABLE_BATTLE_TOASTS, prefs.getBoolean(OverlayService.PREFS_KEY_DISABLE_BATTLE_TOASTS, false))
            putExtra(
                OverlayService.EXTRA_AI_ADVICE_HUD_POSITION,
                prefs.getString(OverlayService.PREFS_KEY_AI_ADVICE_HUD_POSITION, OverlayService.DEFAULT_AI_ADVICE_HUD_POSITION)
            )
            putExtra(OverlayService.EXTRA_SHOW_SHIELD_DECISION_OVERLAY, prefs.getBoolean(OverlayService.PREFS_KEY_SHOW_SHIELD_DECISION_OVERLAY, true))
            putExtra(
                OverlayService.EXTRA_CHARGE_CIRCLE_PRIORITY_MODE,
                prefs.getString(OverlayService.PREFS_KEY_CHARGE_CIRCLE_PRIORITY_MODE, OverlayService.DEFAULT_CHARGE_CIRCLE_PRIORITY_MODE)
            )
            putExtra(
                OverlayService.EXTRA_ENABLE_ALT_FAST_MOVE_DETECT,
                prefs.getBoolean(OverlayService.PREFS_KEY_ENABLE_ALT_FAST_MOVE_DETECT, OverlayService.DEFAULT_ENABLE_ALT_FAST_MOVE_DETECT)
            )
            putExtra(OverlayService.EXTRA_FAST_DETECT_TURN_OFFSET, prefs.getInt(OverlayService.PREFS_KEY_FAST_DETECT_TURN_OFFSET, 0).coerceIn(0, 2))
            putExtra(OverlayService.EXTRA_OVERLAY_SCALE_PCT, prefs.getInt("overlay_scale_pct", 78))
            putExtra(OverlayService.EXTRA_OVERLAY_TRANSPARENCY_PCT, prefs.getInt(OverlayService.PREFS_KEY_OVERLAY_TRANSPARENCY_PCT, 50))
            putExtra(OverlayService.EXTRA_APP_THEME_ID, prefs.getString(OverlayService.PREFS_KEY_APP_THEME_ID, "slate") ?: "slate")
        }
        try {
            ContextCompat.startForegroundService(this, serviceIntent)
        } catch (_: Exception) {
            try {
                startService(serviceIntent)
            } catch (_: Exception) {}
        }
    }

    private fun finishQuietly() {
        finish()
        @Suppress("DEPRECATION")
        overridePendingTransition(0, 0)
    }

    companion object {
        private const val REQ_TASKER_MEDIA_PROJECTION = 9401
    }
}

/**
 * BroadcastReceiver for Tasker Send Intent (Target: Broadcast Receiver):
 * Supports starting, stopping, toggling, minimizing, or restoring the overlay and launching the Battle Log page.
 */
class TaskerBroadcastReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        val act = intent?.action.orEmpty()
        val cmd = (intent?.getStringExtra("cmd") ?: intent?.getStringExtra("command")).orEmpty().trim()

        val isStop = act.equals(OverlayService.ACTION_STOP_OVERLAY, ignoreCase = true) ||
            act.equals(OverlayService.ACTION_SHORT_STOP, ignoreCase = true) ||
            cmd.equals("stop", ignoreCase = true)

        val isToggle = act.equals(OverlayService.ACTION_TOGGLE_OVERLAY, ignoreCase = true) ||
            act.equals(OverlayService.ACTION_SHORT_TOGGLE, ignoreCase = true) ||
            cmd.equals("toggle", ignoreCase = true)

        val isMinimize = act.equals(OverlayService.ACTION_MINIMIZE_OVERLAY, ignoreCase = true) ||
            cmd.equals("minimize", ignoreCase = true)

        val isRestore = act.equals(OverlayService.ACTION_RESTORE_OVERLAY, ignoreCase = true) ||
            cmd.equals("restore", ignoreCase = true)

        val isOpenBattleLog = act.equals(OverlayService.ACTION_OPEN_BATTLE_LOG, ignoreCase = true) ||
            act.equals(OverlayService.ACTION_SHORT_BATTLE_LOG, ignoreCase = true) ||
            cmd.equals("battle_log", ignoreCase = true)

        when {
            isOpenBattleLog -> {
                val mainIntent = Intent(context, MainActivity::class.java).apply {
                    action = OverlayService.ACTION_OPEN_BATTLE_LOG
                    putExtra("page", "battle_log")
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
                }
                context.startActivity(mainIntent)
            }
            isStop || (isToggle && OverlayService.isInstanceRunning) -> {
                val wasRunning = OverlayService.isInstanceRunning
                OverlayService.isInstanceRunning = false
                OverlayService.hasActiveMediaProjection = false
                OverlayService.notifyRunningStateChanged()
                if (wasRunning) {
                    val stopIntent = Intent(context, OverlayService::class.java).apply {
                        action = OverlayService.ACTION_STOP_OVERLAY
                    }
                    try {
                        context.startService(stopIntent)
                    } catch (_: Exception) {
                        context.stopService(Intent(context, OverlayService::class.java))
                    }
                } else {
                    context.stopService(Intent(context, OverlayService::class.java))
                }
            }
            isMinimize -> {
                if (OverlayService.isInstanceRunning) {
                    context.startService(Intent(context, OverlayService::class.java).apply {
                        action = OverlayService.ACTION_MINIMIZE_OVERLAY
                    })
                }
            }
            isRestore -> {
                if (OverlayService.isInstanceRunning) {
                    context.startService(Intent(context, OverlayService::class.java).apply {
                        action = OverlayService.ACTION_RESTORE_OVERLAY
                    })
                }
            }
            else -> {
                val prefs = context.getSharedPreferences("gbl_overlay_prefs", Context.MODE_PRIVATE)
                if (!OverlayService.hasValidScreenNameStatic(prefs)) {
                    Toast.makeText(context, "Please enter your Trainer Screen Name in SilphScope PvP first", Toast.LENGTH_LONG).show()
                    val mainIntent = Intent(context, MainActivity::class.java).apply {
                        putExtra("page", "settings")
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
                    }
                    context.startActivity(mainIntent)
                    return
                }
                val manualMode = intent?.getBooleanExtra("manual_mode", false) == true
                if ((OverlayService.isInstanceRunning && OverlayService.hasActiveMediaProjection) || manualMode) {
                    val srvIntent = Intent(context, OverlayService::class.java).apply {
                        action = OverlayService.ACTION_START_OVERLAY
                        intent?.getStringExtra(OverlayService.EXTRA_TEAM_NAME)?.let { putExtra(OverlayService.EXTRA_TEAM_NAME, it) }
                        putExtra(OverlayService.EXTRA_OPP_COUNT_MODE, prefs.getString("opp_count_mode", "my_fasts") ?: "my_fasts")
                        putExtra(OverlayService.EXTRA_ENABLE_4_CHARGED_MOVES, prefs.getBoolean(OverlayService.PREFS_KEY_ENABLE_4_CHARGED_MOVES, false))
                        putExtra(OverlayService.EXTRA_DISABLE_BATTLE_TOASTS, prefs.getBoolean(OverlayService.PREFS_KEY_DISABLE_BATTLE_TOASTS, false))
                        putExtra(
                            OverlayService.EXTRA_AI_ADVICE_HUD_POSITION,
                            prefs.getString(OverlayService.PREFS_KEY_AI_ADVICE_HUD_POSITION, OverlayService.DEFAULT_AI_ADVICE_HUD_POSITION)
                        )
                        putExtra(OverlayService.EXTRA_SHOW_SHIELD_DECISION_OVERLAY, prefs.getBoolean(OverlayService.PREFS_KEY_SHOW_SHIELD_DECISION_OVERLAY, true))
                        putExtra(
                            OverlayService.EXTRA_CHARGE_CIRCLE_PRIORITY_MODE,
                            prefs.getString(OverlayService.PREFS_KEY_CHARGE_CIRCLE_PRIORITY_MODE, OverlayService.DEFAULT_CHARGE_CIRCLE_PRIORITY_MODE)
                        )
                        putExtra(
                            OverlayService.EXTRA_ENABLE_ALT_FAST_MOVE_DETECT,
                            prefs.getBoolean(OverlayService.PREFS_KEY_ENABLE_ALT_FAST_MOVE_DETECT, OverlayService.DEFAULT_ENABLE_ALT_FAST_MOVE_DETECT)
                        )
                        putExtra(OverlayService.EXTRA_FAST_DETECT_TURN_OFFSET, prefs.getInt(OverlayService.PREFS_KEY_FAST_DETECT_TURN_OFFSET, 0).coerceIn(0, 2))
                        putExtra(OverlayService.EXTRA_OVERLAY_SCALE_PCT, prefs.getInt("overlay_scale_pct", 78))
                        putExtra(OverlayService.EXTRA_OVERLAY_TRANSPARENCY_PCT, prefs.getInt(OverlayService.PREFS_KEY_OVERLAY_TRANSPARENCY_PCT, 50))
                        putExtra(OverlayService.EXTRA_APP_THEME_ID, prefs.getString(OverlayService.PREFS_KEY_APP_THEME_ID, "slate") ?: "slate")
                    }
                    try {
                        ContextCompat.startForegroundService(context, srvIntent)
                    } catch (_: Exception) {
                        try {
                            context.startService(srvIntent)
                        } catch (_: Exception) {}
                    }
                } else {
                    val actIntent = Intent(context, TaskerOverlayActivity::class.java).apply {
                        action = OverlayService.ACTION_START_OVERLAY
                        intent?.extras?.let { putExtras(it) }
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_NO_ANIMATION)
                    }
                    context.startActivity(actIntent)
                }
            }
        }
    }
}
