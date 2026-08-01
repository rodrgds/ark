package expo.modules.arkocr

import android.content.Context
import android.graphics.Bitmap
import android.net.Uri
import expo.modules.kotlin.Promise

// SPDX-License-Identifier: MIT

/**
 * F-Droid build engine. Google ML Kit is proprietary and cannot ship on
 * F-Droid, so image and scanned-PDF OCR report a typed unsupported result
 * instead of silently failing. PDF text-layer extraction (PDFBox) remains
 * available through the shared module.
 */
class UnsupportedImageOcrEngine : ImageOcrEngine {
  override val capabilities = ArkOcrCapabilities(
    distribution = "fdroid",
    imageOcr = false,
    pdfOcr = false
  )

  override fun recognizeFile(context: Context, uri: Uri, promise: Promise) {
    promise.reject(
      "ERR_OCR_UNAVAILABLE",
      "Image text recognition is not available in this build. Ark's F-Droid build ships without Google ML Kit.",
      null
    )
  }

  override fun recognizeBitmap(context: Context, bitmap: Bitmap, promise: Promise) {
    promise.reject(
      "ERR_OCR_UNAVAILABLE",
      "Scanned PDF text recognition is not available in this build. Ark's F-Droid build ships without Google ML Kit.",
      null
    )
  }
}
