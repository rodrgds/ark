package expo.modules.arkocr

import android.content.Context

// SPDX-License-Identifier: MIT

fun createImageOcrEngine(context: Context): ImageOcrEngine {
  return UnsupportedImageOcrEngine()
}
