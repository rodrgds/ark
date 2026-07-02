package expo.modules.arksystemcolors

import android.graphics.Color
import android.os.Build
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlin.math.max
import kotlin.math.min

class ArkSystemColorsModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ArkSystemColors")

    AsyncFunction("getAccentColors") {
      val context = appContext.reactContext ?: appContext.currentActivity
      if (context == null) {
        return@AsyncFunction unavailable("Android context is not available.")
      }

      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
        return@AsyncFunction unavailable("Android Material You colors require Android 12 or newer.")
      }

      val darkAccent = resolveAndroidColor(context, "system_accent1_200")
        ?: resolveAndroidColor(context, "system_accent1_300")
        ?: resolveAndroidColor(context, "system_accent1_500")
      val lightAccent = resolveAndroidColor(context, "system_accent1_700")
        ?: resolveAndroidColor(context, "system_accent1_600")
        ?: resolveAndroidColor(context, "system_accent1_500")

      if (darkAccent == null && lightAccent == null) {
        return@AsyncFunction unavailable("Android did not expose Material You accent resources.")
      }

      val dark = darkAccent ?: lightAccent!!
      val light = lightAccent ?: darkAccent!!

      mapOf(
        "available" to true,
        "source" to "android-material-you",
        "colors" to mapOf(
          "oled" to accentPayload(dark),
          "dark" to accentPayload(dark),
          "light" to accentPayload(light)
        )
      )
    }
  }

  private fun unavailable(reason: String): Map<String, Any?> =
    mapOf(
      "available" to false,
      "source" to "unsupported",
      "reason" to reason
    )

  private fun resolveAndroidColor(context: android.content.Context, name: String): String? {
    val id = context.resources.getIdentifier(name, "color", "android")
    if (id == 0) return null
    return try {
      colorToHex(context.getColor(id))
    } catch (_: Exception) {
      null
    }
  }

  private fun accentPayload(hex: String): Map<String, String> =
    mapOf(
      "primary" to hex,
      "primaryForeground" to foregroundFor(hex)
    )

  private fun colorToHex(color: Int): String {
    return "#%02X%02X%02X".format(Color.red(color), Color.green(color), Color.blue(color))
  }

  private fun foregroundFor(hex: String): String {
    val color = Color.parseColor(hex)
    val red = linear(Color.red(color) / 255.0)
    val green = linear(Color.green(color) / 255.0)
    val blue = linear(Color.blue(color) / 255.0)
    val luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue
    val contrastWithBlack = (luminance + 0.05) / 0.05
    val contrastWithWhite = 1.05 / (luminance + 0.05)
    return if (contrastWithBlack >= contrastWithWhite) "#0C0F0B" else "#FFFFFF"
  }

  private fun linear(value: Double): Double {
    val clamped = min(max(value, 0.0), 1.0)
    return if (clamped <= 0.03928) clamped / 12.92 else Math.pow((clamped + 0.055) / 1.055, 2.4)
  }
}
