package com.gbl.overlay

import android.content.Context
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.drawable.Drawable
import android.text.Spannable
import android.text.SpannableStringBuilder
import android.text.style.ImageSpan
import androidx.core.content.ContextCompat
import kotlin.math.roundToInt

/**
 * Renders inline Mega Evolution Helix icons wherever Mega league abbreviations
 * (`MGL`, `MUL`, `MML`, `Mega GL/UL/ML`) or Mega Limited Cup prefixes (`Mega <Cup>`)
 * appear in rich Android UI TextViews and Buttons.
 */
object MegaBadgeUi {

    private val MEGA_TOKEN_REGEX = Regex(
        """\bM(GL|UL|ML)\b|\b[Mm][Ee][Gg][Aa]\s+(GL|UL|ML|gl|ul|ml)\b|\b[Mm][Ee][Gg][Aa]\s+(?=[A-Za-z0-9(])"""
    )

    private class SpacedMegaImageSpan(
        drawable: Drawable,
        private val rightGapPx: Int
    ) : ImageSpan(drawable, ALIGN_CENTER) {

        override fun getSize(
            paint: Paint,
            text: CharSequence?,
            start: Int,
            end: Int,
            fm: Paint.FontMetricsInt?
        ): Int {
            return super.getSize(paint, text, start, end, fm) + rightGapPx
        }

        override fun draw(
            canvas: Canvas,
            text: CharSequence?,
            start: Int,
            end: Int,
            x: Float,
            top: Int,
            y: Int,
            bottom: Int,
            paint: Paint
        ) {
            super.draw(canvas, text, start, end, x, top, y, bottom, paint)
        }
    }

    /**
     * Converts Mega abbreviations inside [input] into inline Mega Helix `ImageSpan`s
     * followed immediately by `GL` / `UL` / `ML` (or the cup/league name for `Mega <Cup>`).
     * Non-Mega abbreviations (`GL`, `UL`, `ML`, `MLP`, `Melmetal`, `Meganium`) are untouched.
     */
    fun stylize(
        context: Context,
        input: CharSequence,
        textSizeSp: Float = 12f
    ): CharSequence {
        if (input.isEmpty()) return input
        val raw = input.toString()
        val matches = MEGA_TOKEN_REGEX.findAll(raw).toList()
        if (matches.isEmpty()) return input

        val density = context.resources.displayMetrics.density
        val iconHeightPx = (textSizeSp * density * 1.18f).roundToInt().coerceAtLeast((10f * density).roundToInt())
        val iconWidthPx = (iconHeightPx * (42f / 56f)).roundToInt().coerceAtLeast((8f * density).roundToInt())
        val tightGapPx = (0.75f * density).roundToInt()
        val wordGapPx = (2.0f * density).roundToInt()

        val ssb = input as? SpannableStringBuilder ?: SpannableStringBuilder(input)
        val baseDrawable = ContextCompat.getDrawable(context, R.drawable.ic_mega_helix) ?: return input

        // Apply replacements in reverse offset order so earlier indices & existing Html spans stay intact.
        for (match in matches.asReversed()) {
            val start = match.range.first
            val end = match.range.last + 1
            val tierShort = match.groups[1]?.value ?: match.groups[2]?.value
            val gapPx = if (tierShort != null) tightGapPx else wordGapPx
            val replacement = if (tierShort != null) "\uFFFC${tierShort.uppercase()}" else "\uFFFC"

            val drawable = (baseDrawable.constantState?.newDrawable(context.resources) ?: baseDrawable).mutate()
            drawable.setBounds(0, 0, iconWidthPx, iconHeightPx)

            ssb.replace(start, end, replacement)
            ssb.setSpan(
                SpacedMegaImageSpan(drawable, gapPx),
                start,
                start + 1,
                Spannable.SPAN_EXCLUSIVE_EXCLUSIVE
            )
        }
        return ssb
    }

    /**
     * Formats a normalized or raw league key as an interactive chip label with the Mega Helix icon
     * for Mega GL / Mega UL / Mega ML and any Mega Limited Cup.
     */
    fun formatCupChip(
        context: Context,
        leagueKey: String,
        prefix: String = "",
        suffix: String = "",
        textSizeSp: Float = 11f
    ): CharSequence {
        val norm = OverlayService.normalizeLeagueKeyStatic(leagueKey)
        val shortLbl = when (norm) {
            "GREAT LEAGUE" -> "Open GL"
            "ULTRA LEAGUE" -> "Open UL"
            "MASTER LEAGUE" -> "Open ML"
            "MEGA GREAT LEAGUE" -> "Mega GL"
            "MEGA ULTRA LEAGUE" -> "Mega UL"
            "MEGA MASTER LEAGUE" -> "Mega ML"
            else -> OverlayService.formatLeagueDisplayLabelStatic(leagueKey)
        }
        return stylize(context, "$prefix$shortLbl$suffix", textSizeSp)
    }
}
